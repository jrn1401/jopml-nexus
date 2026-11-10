import { sb, q, projects as loadProjects } from "../lib/api.js";
import { h, icon, badge, EVENT_STATUS, fmtDateTime, fmtEUR, fmtNum, fmtAgo, empty, formModal, confirmDialog, toast, toastErr, meter, md } from "../lib/ui.js";
import { donut } from "../lib/charts.js";
import { timeline, fileRow, lazy } from "../lib/modules.js";
import { uploadDialog, download } from "../lib/actions.js";

const SECTIONS = {
  task: ["Aufgaben", "check", "Neue Aufgabe"], tech: ["Technik", "zap", "Technik hinzufügen"], cost: ["Kosten", "wallet", "Kostenposten"],
  schedule: ["Zeitplan", "clock", "Programmpunkt"], guest: ["Gästeliste", "users", "Gast hinzufügen"],
  location: ["Locations", "pin", "Location hinzufügen"], income: ["Einnahmen", "chart", "Einnahme"],
};
export const LOC_STATUS = { anfrage: ["Angefragt", "b-idle"], angebot: ["Angebot da", "b-pri"], besichtigung: ["Besichtigung", "b-acc"], favorit: ["Favorit", "b-warn"], gebucht: ["Gebucht", "b-ok"], abgesagt: ["Abgesagt", "b-bad"] };

export default async function eventView({ args: [id] }) {
  const ev = await q(sb.from("cc_events").select("*").eq("id", id).maybeSingle());
  if (!ev) return empty("calendar", "Event nicht gefunden", null, h("a.btn", { href: "#/events" }, "Zu den Events"));
  let items = await q(sb.from("cc_event_items").select("*").eq("event_id", id).order("at", { ascending: true, nullsFirst: false }).order("created_at"));
  const projects = await loadProjects();
  const proj = projects.find((p) => p.id === ev.project_id);
  const root = h("div");

  const reload = async () => { items = await q(sb.from("cc_event_items").select("*").eq("event_id", id).order("at", { ascending: true, nullsFirst: false }).order("created_at")); draw(); };
  function addItem(kind, item) {
    const f = [{ name: "title", label: kind === "guest" ? "Name" : "Titel", required: true, value: item?.title, max: 200 }];
    if (kind === "schedule" || kind === "task") f.push({ name: "at", label: kind === "schedule" ? "Uhrzeit" : "Fällig am", type: "datetime-local", value: item?.at ? toLocal(item.at) : "", half: true });
    if (kind === "cost" || kind === "tech" || kind === "income" || kind === "location") f.push({ name: "amount", label: kind === "location" ? "Miete/Angebot (€)" : kind === "income" ? "Betrag (€, erwartet)" : "Betrag (€)", type: "number", step: "0.01", min: 0, value: item?.amount ?? "", half: true });
    if (kind === "location") f.push({ name: "status", label: "Status", type: "select", value: item?.status || "anfrage", half: true, options: Object.entries(LOC_STATUS).map(([k, v]) => [k, v[0]]) });
    if (kind === "location" || kind === "tech" || kind === "cost") f.push({ name: "contact", label: "Kontakt", value: item?.contact, half: true, max: 200, placeholder: "Name, Telefon oder E-Mail" });
    if (kind === "location" || kind === "tech") f.push({ name: "url", label: "Link", value: item?.url, half: true, max: 500, placeholder: "https://…" });
    f.push({ name: "note", label: "Notiz", type: "textarea", rows: 2, value: item?.note, max: 2000 });
    formModal(item ? "Bearbeiten" : SECTIONS[kind][2], f, async (v) => {
      if (v.url && !/^https?:\/\//i.test(v.url)) throw new Error("Link muss mit https:// beginnen.");
      const row = { event_id: id, kind, title: v.title, note: v.note || "", at: v.at ? new Date(v.at).toISOString() : null, amount: v.amount === "" || v.amount === undefined ? null : Number(v.amount),
        status: v.status ?? item?.status ?? null, contact: v.contact ?? item?.contact ?? null, url: v.url ?? item?.url ?? null };
      if (item) await q(sb.from("cc_event_items").update(row).eq("id", item.id)); else await q(sb.from("cc_event_items").insert(row));
      await reload();
    });
  }
  const toLocal = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };

  function section(kind) {
    const list = items.filter((i) => i.kind === kind);
    const [title, ic, addLabel] = SECTIONS[kind];
    const done = list.filter((i) => i.done).length;
    return h("section.card",
      h("div.card-head", h("h3.row", icon(ic, ""), title, list.length ? h("span.faint", { style: { fontWeight: 400 } }, kind === "task" || kind === "tech" || kind === "guest" ? `${done}/${list.length}` : list.length) : null),
        h("button.btn.sm.ghost", { onclick: () => addItem(kind) }, icon("plus"), addLabel)),
      h("div.card-body", list.length ? h("div.list", list.map((it) => h("div.list-item",
        kind !== "cost" && kind !== "schedule" && kind !== "location" && kind !== "income" ? h("input", { type: "checkbox", checked: it.done, "aria-label": kind === "guest" ? "Bestätigt" : "Erledigt", style: { width: "18px", height: "18px", accentColor: "var(--primary)" },
          onchange: async (e) => { try { await q(sb.from("cc_event_items").update({ done: e.target.checked }).eq("id", it.id)); it.done = e.target.checked; draw(); } catch (er) { toastErr(er); } } }) : null,
        kind === "schedule" ? h("span.mono", { style: { minWidth: "48px", color: "var(--primary)" } }, it.at ? new Date(it.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "–") : null,
        h("div.li-main", h("div.li-title", { style: it.done && kind !== "guest" ? { textDecoration: "line-through", color: "var(--text-3)" } : null }, it.title),
          it.note || it.contact || (it.at && kind === "task") ? h("div.li-sub", [it.at && kind === "task" ? `fällig ${fmtDateTime(it.at)}` : null, it.contact, it.note].filter(Boolean).join(" · ")) : null,
          it.url ? h("a.li-sub", { href: it.url, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--primary)" } }, icon("external"), " ", it.url.replace(/^https?:\/\//, "").slice(0, 50)) : null),
        kind === "task" && !it.done && it.at && new Date(it.at) < Date.now() ? h("span.badge.b-bad", "überfällig") : null,
        kind === "location" ? badge(LOC_STATUS, it.status || "anfrage") : null,
        it.amount !== null ? h("span.nowrap", fmtEUR(it.amount)) : null,
        h("button.icon-btn", { "aria-label": "Bearbeiten", onclick: () => addItem(kind, it) }, icon("edit")),
        h("button.icon-btn", { "aria-label": "Löschen", onclick: async () => { if (await confirmDialog("Eintrag löschen?", `„${it.title}“ wird entfernt.`, { ok: "Löschen" })) { await q(sb.from("cc_event_items").delete().eq("id", it.id)); reload(); } } }, icon("trash")))))
        : h("div.faint", { style: { fontSize: "13px" } }, "Noch keine Einträge.")));
  }

  function draw() {
    const costs = items.filter((i) => i.kind === "cost" || (i.kind === "tech" && i.amount !== null) || (i.kind === "location" && i.status === "gebucht" && i.amount !== null));
    const income = items.filter((i) => i.kind === "income").reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const price = Number(ev.metadata?.ticket_price) || null;
    const spent = costs.reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const budget = ev.budget !== null ? Number(ev.budget) : null;
    const tasks = items.filter((i) => i.kind === "task" || i.kind === "tech");
    const guests = items.filter((i) => i.kind === "guest");
    root.replaceChildren(
      h("div.crumb", h("a", { href: "#/events" }, "Events"), icon("chevronR", ""), h("span", ev.name)),
      h("div.page-head", h("div", h("h1", ev.name), h("div.row.wrap", { style: { gap: "8px", marginTop: "8px" } }, badge(EVENT_STATUS, ev.status),
        h("span.faint", { style: { fontSize: "13px" } }, [ev.event_date ? `${fmtDateTime(ev.event_date)} (${fmtAgo(ev.event_date)})` : "ohne Datum", ev.location].filter(Boolean).join(" · ")),
        proj ? h("a.tag", { href: `#/projects/${proj.id}` }, icon("folder", ""), " ", proj.name) : null)),
        h("div.actions", h("button.btn", { onclick: edit }, icon("edit"), "Bearbeiten"),
          h("button.btn.ghost", { onclick: exportCsv, title: "Alle Einträge als CSV (Excel)" }, icon("download"), "CSV"),
          ev.event_date ? h("button.btn.ghost", { onclick: exportIcs, title: "Event + Termine in den Kalender" }, icon("calendar"), "Kalender") : null,
          h("button.btn.ghost", { onclick: duplicate, title: "Als Vorlage kopieren" }, icon("copy"), "Duplizieren"),
          h("button.btn.danger", { onclick: del }, icon("trash"), "Löschen"))),
      h("div.grid.g-4", { style: { marginBottom: "16px" } },
        h("div.card.stat", h("div.k", icon("wallet"), "Budget"), h("div.v", budget !== null ? fmtEUR(budget) : "–"),
          budget ? meter((spent / budget) * 100, [80, 100]) : null, h("div.d", budget !== null ? `${fmtEUR(spent)} verplant · ${fmtEUR(budget - spent)} übrig` : `${fmtEUR(spent)} verplant · kein Budget gesetzt`)),
        h("div.card.stat", h("div.k", icon("check"), "Aufgaben"), h("div.v", `${tasks.filter((t) => t.done).length}`, h("small", `/ ${tasks.length}`)), tasks.length ? meter((tasks.filter((t) => t.done).length / tasks.length) * 100, [101, 101]) : null),
        h("div.card.stat", h("div.k", icon("users"), "Gäste"), h("div.v", fmtNum(guests.length), h("small", ev.expected_guests !== null ? `/ ${fmtNum(ev.expected_guests)} erwartet` : "")), h("div.d", `${guests.filter((g) => g.done).length} bestätigt`)),
        h("div.card.stat", h("div.k", icon("chart"), "Ergebnis"), h("div.v", { style: { color: income - spent < 0 ? "var(--bad)" : income ? "var(--ok)" : "" } }, fmtEUR(income - spent)),
          h("div.d", [`${fmtEUR(income)} Einnahmen`, price ? `Break-even bei ${fmtNum(Math.ceil(spent / price))} Tickets à ${fmtEUR(price)}` : "Ticketpreis unter „Bearbeiten“ setzen"].join(" · ")))),
      ev.description ? h("section.card.card-pad", { style: { marginBottom: "16px" } }, md(ev.description)) : null,
      h("div.grid.g-2", section("task"), section("location"), section("schedule"), section("tech"), section("cost"), section("income"),
        h("section.card", h("div.card-head", h("h3", "Kostenplanung")), h("div.card-body",
          costs.length ? donut(costs.map((c) => ({ name: c.title, value: Number(c.amount) || 0 })), { fmt: fmtEUR, center: fmtEUR(spent).replace(/,\d\d/, "") }) : h("div.faint", "Kosten und Technik mit Betrag erscheinen hier."))),
        section("guest"),
        h("section.card", h("div.card-head", h("h3", "Dokumente"), proj ? h("button.btn.sm.ghost", { onclick: () => uploadDialog({ projectId: proj.id, onDone: draw }) }, icon("upload"), "Hochladen") : null),
          h("div.card-body", proj ? lazy(async () => {
            const f = await q(sb.from("cc_files").select("id,file_name,rel_path,file_size,uploaded_at,storage_path,version").eq("project_id", proj.id).eq("is_current", true).order("uploaded_at", { ascending: false }).limit(15));
            return f.length ? h("div.list", f.map((x) => fileRow(x))) : h("div.faint", "Noch keine Dokumente im verknüpften Projekt.");
          }) : h("div.faint", { style: { fontSize: "13px" } }, "Verknüpfe das Event mit einem Projekt (Bearbeiten), um Dokumente dort abzulegen."))),
        h("section.card", h("div.card-head", h("h3", "Aktivitätsverlauf")), h("div.card-body", lazy(async () => {
          const a = await q(sb.from("cc_activities").select("*").like("description", `%${ev.name.replace(/[%_]/g, "")}%`).in("kind", ["event_created", "event_updated"]).order("created_at", { ascending: false }).limit(15));
          return a.length ? timeline(a) : h("div.faint", "Keine Einträge.");
        })))));
  }
  function edit() {
    formModal("Event bearbeiten", [
      { name: "name", label: "Eventname", required: true, value: ev.name, max: 120 },
      { name: "event_date", label: "Datum & Uhrzeit", type: "datetime-local", value: ev.event_date ? toLocal(ev.event_date) : "", half: true },
      { name: "location", label: "Location", value: ev.location, half: true, max: 160 },
      { name: "budget", label: "Budget (€)", type: "number", step: "0.01", min: 0, value: ev.budget ?? "", half: true },
      { name: "expected_guests", label: "Erwartete Gäste", type: "number", min: 0, value: ev.expected_guests ?? "", half: true },
      { name: "ticket_price", label: "Ticketpreis (€)", type: "number", step: "0.01", min: 0, value: ev.metadata?.ticket_price ?? "", half: true },
      { name: "status", label: "Status", type: "select", value: ev.status, options: Object.entries(EVENT_STATUS).map(([k, v]) => [k, v[0]]), half: true },
      { name: "project_id", label: "Projekt", type: "select", value: ev.project_id || "", half: true, options: [["", "– keins –"], ...projects.map((p) => [p.id, p.name])] },
      { name: "description", label: "Beschreibung", type: "textarea", value: ev.description },
    ], async (v) => {
      await q(sb.from("cc_events").update({ name: v.name, location: v.location, status: v.status, description: v.description, project_id: v.project_id || null,
        event_date: v.event_date ? new Date(v.event_date).toISOString() : null, budget: v.budget === "" ? null : Number(v.budget),
        expected_guests: v.expected_guests === "" ? null : parseInt(v.expected_guests, 10),
        metadata: { ...(ev.metadata || {}), ticket_price: v.ticket_price === "" ? null : Number(v.ticket_price) } }).eq("id", id));
      toast("Gespeichert"); dispatchEvent(new Event("hashchange"));
    });
  }
  async function del() {
    if (!(await confirmDialog("Event löschen?", `„${ev.name}“ mit allen Aufgaben, Kosten und Gästen wird dauerhaft gelöscht.`, { ok: "Endgültig löschen" }))) return;
    try { await q(sb.from("cc_events").delete().eq("id", id)); await sb.from("cc_activities").insert({ kind: "event_deleted", description: `Event gelöscht: ${ev.name}`, status: "warning" }); toast("Event gelöscht"); location.hash = "#/events"; }
    catch (e) { toastErr(e); }
  }
  function exportCsv() {
    const esc = (v) => { const t = v === null || v === undefined ? "" : String(v); return /[";\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
    const lines = [["Bereich", "Titel", "Erledigt", "Status", "Datum/Uhrzeit", "Betrag (€)", "Kontakt", "Link", "Notiz"].join(";"),
      ...items.map((i) => [SECTIONS[i.kind]?.[0] || i.kind, i.title, i.done ? "ja" : "nein", i.kind === "location" ? LOC_STATUS[i.status]?.[0] || "" : "", i.at ? fmtDateTime(i.at) : "",
        i.amount !== null ? String(i.amount).replace(".", ",") : "", i.contact, i.url, i.note].map(esc).join(";"))];
    download(`${ev.name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}.csv`, "\ufeff" + lines.join("\r\n"), "text/csv");
  }
  function exportIcs() {
    const dt = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
    const txt = (t) => String(t || "").replace(/\\/g, "\\\\").replace(/[,;]/g, (m) => "\\" + m).replace(/\n/g, "\\n");
    const vev = (uid, start, mins, title, loc, desc) => ["BEGIN:VEVENT", `UID:${uid}@jopml-nexus`, `DTSTAMP:${dt(Date.now())}`, `DTSTART:${dt(start)}`,
      `DTEND:${dt(new Date(start).getTime() + mins * 60000)}`, `SUMMARY:${txt(title)}`, loc ? `LOCATION:${txt(loc)}` : null, desc ? `DESCRIPTION:${txt(desc)}` : null, "END:VEVENT"].filter(Boolean);
    const out = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//JOPML Nexus//DE", vev(ev.id, ev.event_date, 360, ev.name, ev.location, ev.description),
      ...items.filter((i) => i.at && (i.kind === "task" || i.kind === "schedule")).map((i) => vev(i.id, i.at, 30, `${i.kind === "task" ? "Aufgabe" : "Programm"}: ${i.title} (${ev.name})`, ev.location, i.note)), "END:VCALENDAR"].flat();
    download(`${ev.name.replace(/[^\wäöüÄÖÜß-]+/g, "_")}.ics`, out.join("\r\n"), "text/calendar");
  }
  async function duplicate() {
    try {
      const copy = await q(sb.from("cc_events").insert({ name: `${ev.name} (Kopie)`.slice(0, 120), description: ev.description, location: ev.location, event_date: null,
        status: "idea", budget: ev.budget, expected_guests: ev.expected_guests, project_id: ev.project_id, metadata: ev.metadata || {} }).select("id").single());
      const rows = items.filter((i) => i.kind !== "guest").map((i) => ({ event_id: copy.id, kind: i.kind, title: i.title, note: i.note, amount: i.amount, status: i.kind === "location" ? "anfrage" : null, contact: i.contact, url: i.url, done: false }));
      if (rows.length) await q(sb.from("cc_event_items").insert(rows));
      toast("Event dupliziert (ohne Gäste und Termine)"); location.hash = `#/events/${copy.id}`;
    } catch (e) { toastErr(e); }
  }
  draw();
  return root;
}
