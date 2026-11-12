import { sb, q, api, projects as loadProjects } from "../lib/api.js";
import { h, icon, badge, EVENT_STATUS, fmtDateTime, fmtEUR, fmtNum, fmtAgo, empty, formModal, confirmDialog, toast, toastErr, meter, md } from "../lib/ui.js";
import { donut, barChart, lineChart, PALETTE } from "../lib/charts.js";
import { timeline, fileRow, lazy } from "../lib/modules.js";
import { uploadDialog, download } from "../lib/actions.js";
import { openShareDialog } from "../lib/share.js";
import { importDialog } from "../lib/eventfrog.js";

const SECTIONS = {
  task: ["Aufgaben", "check", "Neue Aufgabe"], tech: ["Technik", "zap", "Technik hinzufügen"], cost: ["Kosten", "wallet", "Kostenposten"],
  schedule: ["Zeitplan", "clock", "Programmpunkt"], guest: ["Gästeliste", "users", "Gast hinzufügen"],
  location: ["Locations", "pin", "Location hinzufügen"], income: ["Einnahmen", "chart", "Einnahme"],
  shift: ["Schichtplan", "clock", "Neue Schicht"], post: ["Posting-Plan", "send", "Beitrag planen"],
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
    if (["schedule", "task", "shift", "post"].includes(kind)) f.push({ name: "at", label: kind === "schedule" ? "Uhrzeit" : kind === "shift" ? "Beginn" : kind === "post" ? "Posten am" : "Fällig am", type: "datetime-local", value: item?.at ? toLocal(item.at) : "", half: true });
    if (kind === "shift") f.push({ name: "ends_at", label: "Ende", type: "datetime-local", value: item?.ends_at ? toLocal(item.ends_at) : "", half: true });
    if (kind === "post") f.push({ name: "contact", label: "Kanal", value: item?.contact, half: true, max: 200, placeholder: "Instagram, TikTok …" });
    if (["task", "tech", "shift", "post"].includes(kind)) f.push({ name: "assignee", label: kind === "shift" ? "Wer übernimmt die Schicht?" : "Zuständig", value: item?.assignee, half: true, max: 120, placeholder: "Name" });
    if (kind === "cost" || kind === "tech" || kind === "income" || kind === "location") f.push({ name: "amount", label: kind === "location" ? "Miete/Angebot (€)" : kind === "income" ? "Betrag (€, erwartet)" : "Betrag (€)", type: "number", step: "0.01", min: 0, value: item?.amount ?? "", half: true });
    if (kind === "location") f.push({ name: "status", label: "Status", type: "select", value: item?.status || "anfrage", half: true, options: Object.entries(LOC_STATUS).map(([k, v]) => [k, v[0]]) });
    if (kind === "location" || kind === "tech" || kind === "cost") f.push({ name: "contact", label: "Kontakt", value: item?.contact, half: true, max: 200, placeholder: "Name, Telefon oder E-Mail" });
    if (kind === "location" || kind === "tech") f.push({ name: "url", label: "Link", value: item?.url, half: true, max: 500, placeholder: "https://…" });
    if (["cost", "tech", "income"].includes(kind)) f.push({ name: "actual", label: "Tatsächlich (€) – nach der Rechnung", type: "number", step: "0.01", min: 0, value: item?.actual ?? "", half: true });
    if (["cost", "tech"].includes(kind)) f.push({ name: "paid", label: "Schon bezahlt", type: "checkbox", value: !!item?.paid });
    f.push({ name: "note", label: "Notiz", type: "textarea", rows: 2, value: item?.note, max: 2000 });
    formModal(item ? "Bearbeiten" : SECTIONS[kind][2], f, async (v) => {
      if (v.url && !/^https?:\/\//i.test(v.url)) throw new Error("Link muss mit https:// beginnen.");
      const row = { event_id: id, kind, title: v.title, note: v.note || "", at: v.at ? new Date(v.at).toISOString() : null, amount: v.amount === "" || v.amount === undefined ? null : Number(v.amount),
        status: v.status ?? item?.status ?? null, contact: v.contact ?? item?.contact ?? null, url: v.url ?? item?.url ?? null,
        actual: v.actual === "" || v.actual === undefined ? null : Number(v.actual), paid: v.paid ?? item?.paid ?? false,
        assignee: (v.assignee ?? item?.assignee) || null, ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : null, reminded_at: null };
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
        kind !== "cost" && kind !== "schedule" && kind !== "location" && kind !== "income" ? h("input", { type: "checkbox", checked: it.done, "aria-label": kind === "guest" ? "Bestätigt" : "Erledigt", title: kind === "post" ? "Gepostet" : kind === "shift" ? "Bestätigt" : null, style: { width: "18px", height: "18px", accentColor: "var(--primary)" },
          onchange: async (e) => { try { await q(sb.from("cc_event_items").update({ done: e.target.checked }).eq("id", it.id)); it.done = e.target.checked; draw(); } catch (er) { toastErr(er); } } }) : null,
        kind === "schedule" ? h("span.mono", { style: { minWidth: "48px", color: "var(--primary)" } }, it.at ? new Date(it.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "–") : null,
        h("div.li-main", h("div.li-title", { style: it.done && kind !== "guest" ? { textDecoration: "line-through", color: "var(--text-3)" } : null }, it.title),
          it.note || it.contact || it.assignee || (it.at && ["task", "shift", "post"].includes(kind)) ? h("div.li-sub", [it.at && kind === "task" ? `fällig ${fmtDateTime(it.at)}` : it.at && kind !== "schedule" ? fmtDateTime(it.at) : null,
            it.ends_at ? `bis ${new Date(it.ends_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : null, it.assignee ? (kind === "shift" ? it.assignee : `zuständig: ${it.assignee}`) : null, it.contact, it.note].filter(Boolean).join(" · ")) : null,
          it.url ? h("a.li-sub", { href: it.url, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--primary)" } }, icon("external"), " ", it.url.replace(/^https?:\/\//, "").slice(0, 50)) : null),
        kind === "task" && !it.done && it.at && new Date(it.at) < Date.now() ? h("span.badge.b-bad", "überfällig") : null,
        kind === "location" ? badge(LOC_STATUS, it.status || "anfrage") : null,
        kind === "shift" && !it.assignee ? h("span.badge.b-warn", "frei") : null,
        it.paid ? h("span.badge.b-ok", "bezahlt") : null,
        it.amount !== null || it.actual !== null ? h("span.nowrap", { title: it.actual !== null ? `geplant ${fmtEUR(it.amount)}` : "geplant" }, fmtEUR(it.actual ?? it.amount), it.actual !== null && it.amount !== null && Number(it.actual) !== Number(it.amount) ? h("small.faint", ` (Plan ${fmtEUR(it.amount)})`) : null) : null,
        h("button.icon-btn", { "aria-label": "Bearbeiten", onclick: () => addItem(kind, it) }, icon("edit")),
        h("button.icon-btn", { "aria-label": "Löschen", onclick: async () => { if (await confirmDialog("Eintrag löschen?", `„${it.title}“ wird entfernt.`, { ok: "Löschen" })) { await q(sb.from("cc_event_items").delete().eq("id", it.id)); reload(); } } }, icon("trash")))))
        : h("div.faint", { style: { fontSize: "13px" } }, "Noch keine Einträge.")));
  }

  function draw() {
    const costs = items.filter((i) => i.kind === "cost" || (i.kind === "tech" && i.amount !== null) || (i.kind === "location" && i.status === "gebucht" && i.amount !== null));
    const income = items.filter((i) => i.kind === "income").reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const price = Number(ev.metadata?.ticket_price) || null;
    const spent = costs.reduce((a, i) => a + (Number(i.actual ?? i.amount) || 0), 0);
    const budget = ev.budget !== null ? Number(ev.budget) : null;
    const tasks = items.filter((i) => i.kind === "task" || i.kind === "tech");
    const guests = items.filter((i) => i.kind === "guest");
    root.replaceChildren(
      h("div.crumb", h("a", { href: "#/events" }, "Events"), icon("chevronR", ""), h("span", ev.name)),
      h("div.page-head", h("div", h("h1", ev.name), h("div.row.wrap", { style: { gap: "8px", marginTop: "8px" } }, badge(EVENT_STATUS, ev.status),
        h("span.faint", { style: { fontSize: "13px" } }, [ev.event_date ? `${fmtDateTime(ev.event_date)} (${fmtAgo(ev.event_date)})` : "ohne Datum", ev.location].filter(Boolean).join(" · ")),
        proj ? h("a.tag", { href: `#/projects/${proj.id}` }, icon("folder", ""), " ", proj.name) : null)),
        h("div.actions", h("button.btn.primary", { onclick: () => openShareDialog("event", id, ev.name) }, icon("users"), "Teilen"), h("button.btn", { onclick: edit }, icon("edit"), "Bearbeiten"),
          h("a.btn", { href: `#/door/${id}`, title: "Barverkauf, Wechselgeld, Gästeliste und Auslastung am Abend" }, icon("ticket"), "Abendkasse"),
          h("button.btn", { onclick: () => importDialog(ev, () => dispatchEvent(new Event("hashchange"))), title: "Ticketverkäufe aus Eventfrog-Export übernehmen" }, icon("ticket"), "Eventfrog-Import"),
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
          h("div.d", [`${fmtEUR(income)} Einnahmen`, income && ev.expected_guests ? `Break-even bei ca. ${fmtNum(Math.ceil(spent / (income / ev.expected_guests)))} Gästen (alle Einnahmen pro Gast)` : price ? `Break-even bei ${fmtNum(Math.ceil(spent / price))} Tickets à ${fmtEUR(price)}` : "Ticketpreis unter „Bearbeiten“ setzen"].join(" · ")))),
      ev.description ? h("section.card.card-pad", { style: { marginBottom: "16px" } }, md(ev.description)) : null,
      ticketCard(),
      settleCard(costs, income),
      h("div.grid.g-2", section("task"), section("location"), section("schedule"), section("shift"), section("tech"), section("cost"), section("income"), section("post"), commentsCard(),
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
  // Abrechnung: Plan gegen Ist, offene Rechnungen, Break-even und Verkaufsprognose
  function settleCard(costs, incomePlan) {
    const t = ev.metadata?.tickets || {};
    const plan = costs.reduce((a, i) => a + (Number(i.amount) || 0), 0);
    const ist = costs.reduce((a, i) => a + (Number(i.actual ?? i.amount) || 0), 0);
    const open = costs.filter((i) => !i.paid).reduce((a, i) => a + (Number(i.actual ?? i.amount) || 0), 0);
    const otherIncome = items.filter((i) => i.kind === "income").reduce((a, i) => a + (Number(i.actual ?? 0) || 0), 0);
    const ticketRev = Number(t.revenue) || 0, sold = Number(t.sold) || 0, cap = Number(t.capacity) || ev.expected_guests || null;
    const avg = sold ? ticketRev / sold : Number(ev.metadata?.ticket_price) || (t.tiers?.length ? t.tiers.reduce((a, x) => a + (Number(x.price) || 0) * (x.capacity || 1), 0) / t.tiers.reduce((a, x) => a + (x.capacity || 1), 0) : null);
    const be = avg ? Math.ceil(ist / avg) : null;
    const days = ev.event_date ? Math.ceil((new Date(ev.event_date) - Date.now()) / 864e5) : null;
    // Prognose: Verkaufstempo der letzten 14 Tage bis zum Event fortschreiben (nur wenn schon verkauft wurde)
    const daily = (t.daily || []).slice(-14), pace = daily.length ? daily.reduce((a, d) => a + d.n, 0) / 14 : 0;
    const forecast = pace && days > 0 ? Math.min(cap || Infinity, Math.round(sold + pace * days)) : null;
    const k = (label, value, sub, color) => h("div", h("div.k.faint", { style: { fontSize: "12px" } }, label), h("div", { style: { fontSize: "22px", fontWeight: 650, color: color || "" } }, value), sub ? h("div.faint", { style: { fontSize: "12px" } }, sub) : null);
    const result = ticketRev + otherIncome - ist;
    if (!costs.length && !sold && !incomePlan) return null;
    return h("section.card", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3.row", icon("wallet"), "Abrechnung"), h("span.sub", days !== null && days >= 0 ? `noch ${days} Tage` : days !== null ? "Event vorbei – Ist-Beträge eintragen" : "")),
      h("div.card-body", h("div.grid.g-4", { style: { gap: "14px" } },
        k("Kosten: Plan → Ist", `${fmtEUR(plan)} → ${fmtEUR(ist)}`, ist > plan ? `${fmtEUR(ist - plan)} über Plan` : ist < plan ? `${fmtEUR(plan - ist)} unter Plan` : "im Plan", ist > plan ? "var(--bad)" : ""),
        k("Noch zu bezahlen", fmtEUR(open), `${costs.filter((i) => !i.paid).length} offene Posten`),
        k("Einnahmen bisher", fmtEUR(ticketRev + otherIncome), `${fmtEUR(ticketRev)} Tickets${otherIncome ? ` + ${fmtEUR(otherIncome)} sonstige` : ""} · geplant ${fmtEUR(incomePlan)}`),
        k("Ergebnis bisher", fmtEUR(result), result < 0 ? "noch nicht gedeckt" : "Kosten gedeckt", result < 0 ? "var(--bad)" : "var(--ok)")),
        be ? h("div", { style: { marginTop: "14px" } }, h("div.row.between", { style: { fontSize: "13px", marginBottom: "4px" } },
          h("span", h("strong", `Break-even bei ${fmtNum(be)} Tickets`), ` (Ø ${fmtEUR(avg)} pro Ticket)`), h("span.faint", `${fmtNum(sold)} verkauft${sold >= be ? " – Kosten gedeckt" : ` · es fehlen ${fmtNum(be - sold)}`}`)),
          meter(Math.min(100, (sold / be) * 100), [101, 101]),
          cap && be > cap ? h("div.sync-err", `Achtung: Der Break-even (${be}) liegt über der Kapazität (${cap}). Kosten senken oder Preise erhöhen.`) : null,
          forecast !== null ? h("div.faint", { style: { fontSize: "12.5px", marginTop: "6px" } }, `Prognose: bei gleichem Tempo (${pace.toFixed(1).replace(".", ",")} Tickets/Tag) etwa ${fmtNum(forecast)} Tickets bis zum Event${cap ? ` von ${fmtNum(cap)}` : ""}.`) : null) : null));
  }
  function commentsCard() {
    const box = h("div.card-body.stack", h("div.skel", { style: { height: "50px" } }));
    const ta = h("textarea.input", { rows: 2, maxlength: 2000, placeholder: "Notiz oder Nachricht ans Team …", "aria-label": "Kommentar" });
    async function load() {
      const c = await q(sb.from("cc_comments").select("*").eq("event_id", id).order("created_at"));
      box.replaceChildren(c.length ? h("div.list", c.map((x) => h("div.list-item", h("div.li-main", h("div.li-sub", `${x.author} · ${fmtAgo(x.created_at)}`), h("div", { style: { whiteSpace: "pre-wrap", fontSize: "14px" } }, x.body)),
        h("button.icon-btn", { "aria-label": "Löschen", onclick: async () => { await q(sb.from("cc_comments").delete().eq("id", x.id)); load(); } }, icon("trash")))))
        : h("div.faint", { style: { fontSize: "13px" } }, "Noch keine Kommentare. Mitveranstalter mit Freigabe können hier mitschreiben."),
        ta, h("div.row", { style: { justifyContent: "flex-end" } }, h("button.btn.primary.sm", { onclick: async () => { const b = ta.value.trim(); if (!b) return; try { await q(sb.from("cc_comments").insert({ event_id: id, author: "Admin", body: b })); ta.value = ""; load(); } catch (e) { toastErr(e); } } }, icon("send"), "Senden")));
    }
    load().catch((e) => box.replaceChildren(h("div.faint", e.message)));
    return h("section.card", h("div.card-head", h("h3.row", icon("users"), "Team-Kommentare")), box);
  }
  function edit() {
    formModal("Event bearbeiten", [
      { name: "name", label: "Eventname", required: true, value: ev.name, max: 120 },
      { name: "event_date", label: "Datum & Uhrzeit", type: "datetime-local", value: ev.event_date ? toLocal(ev.event_date) : "", half: true },
      { name: "location", label: "Location", value: ev.location, half: true, max: 160 },
      { name: "budget", label: "Budget (€)", type: "number", step: "0.01", min: 0, value: ev.budget ?? "", half: true },
      { name: "expected_guests", label: "Erwartete Gäste", type: "number", min: 0, value: ev.expected_guests ?? "", half: true },
      { name: "ticket_price", label: "Ticketpreis (€)", type: "number", step: "0.01", min: 0, value: ev.metadata?.ticket_price ?? "", half: true },
      { name: "door_price", label: "Preis Abendkasse (€)", type: "number", step: "0.01", min: 0, value: ev.metadata?.door_price ?? "", half: true },
      { name: "status", label: "Status", type: "select", value: ev.status, options: Object.entries(EVENT_STATUS).map(([k, v]) => [k, v[0]]), half: true },
      { name: "project_id", label: "Projekt", type: "select", value: ev.project_id || "", half: true, options: [["", "– keins –"], ...projects.map((p) => [p.id, p.name])] },
      { name: "description", label: "Beschreibung", type: "textarea", value: ev.description },
    ], async (v) => {
      await q(sb.from("cc_events").update({ name: v.name, location: v.location, status: v.status, description: v.description, project_id: v.project_id || null,
        event_date: v.event_date ? new Date(v.event_date).toISOString() : null, budget: v.budget === "" ? null : Number(v.budget),
        expected_guests: v.expected_guests === "" ? null : parseInt(v.expected_guests, 10),
        metadata: { ...(ev.metadata || {}), ticket_price: v.ticket_price === "" ? null : Number(v.ticket_price), door_price: v.door_price === "" ? null : Number(v.door_price) } }).eq("id", id));
      toast("Gespeichert"); dispatchEvent(new Event("hashchange"));
    });
  }
  async function del() {
    if (!(await confirmDialog("Event löschen?", `„${ev.name}“ mit allen Aufgaben, Kosten und Gästen wird dauerhaft gelöscht.`, { ok: "Endgültig löschen" }))) return;
    try { await q(sb.from("cc_events").delete().eq("id", id)); await sb.from("cc_activities").insert({ kind: "event_deleted", description: `Event gelöscht: ${ev.name}`, status: "warning" }); toast("Event gelöscht"); location.hash = "#/events"; }
    catch (e) { toastErr(e); }
  }
  // Echte Ticketverkäufe – Eventfrog live (Abruf alle 10 Min. + Knopf), Verlauf, Kategorien, Check-in
  function ticketCard() {
    if (!ev.metadata?.tickets && !ev.metadata?.eventfrog_id) return null;
    const box = h("div", { style: { marginBottom: "16px" } });
    let snaps = null, timer = null;
    const big = (v, extra) => h("div", { style: { fontSize: "24px", fontWeight: 650 } }, v, extra);
    const k = (t) => h("div.k.faint", { style: { fontSize: "12px" } }, t);
    async function refresh(pull = false) {
      if (pull) {
        try { await api("sync/eventfrog"); toast("Eventfrog abgerufen"); } catch (e) { toastErr(e); }
      }
      const [row, sn] = await Promise.all([q(sb.from("cc_events").select("metadata").eq("id", id).single()), q(sb.from("cc_ticket_snapshots").select("ts,sold,revenue,checked_in").eq("event_id", id).order("ts").limit(2000))]);
      ev.metadata = row.metadata; snaps = sn; draw2();
    }
    function draw2() {
      const t = ev.metadata?.tickets || {}, ef = ev.metadata?.eventfrog || {};
      const cap = t.capacity || ev.expected_guests;
      const eventDay = ev.event_date && Math.abs(new Date(ev.event_date) - Date.now()) < 20 * 3600_000;
      const daily = t.daily || [];
      const chart = daily.length
        ? barChart(daily.slice(-30).map((d) => new Date(d.d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })), [{ name: "Tickets", values: daily.slice(-30).map((d) => d.n), color: PALETTE[0] }], { height: 170, emptyText: "Noch keine Verkäufe" })
        : (snaps?.length > 1 ? lineChart([{ name: "Verkauft", values: snaps.map((x) => ({ x: new Date(x.ts).getTime(), y: x.sold })), color: PALETTE[0] }], { height: 170, xFmt: (v) => new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) })
          : h("div.faint", { style: { fontSize: "13px", padding: "18px 0" } }, t.sold ? "Der Verkaufsverlauf füllt sich ab jetzt mit jedem Abruf (alle 10 Minuten)." : "Noch keine Tickets verkauft – sobald der Verkauf startet, erscheint hier der Verlauf."));
      box.replaceChildren(h("section.card",
        h("div.card-head", h("h3.row", icon("ticket"), "Ticketverkauf", t.source === "eventfrog" ? h("span.badge.b-ok", { style: { marginLeft: "6px" } }, "Eventfrog live") : null),
          h("div.row", { style: { gap: "6px" } }, h("span.sub", `Stand ${fmtAgo(t.as_of || t.updated_at)}`),
            ef.url ? h("a.btn.sm", { href: ef.url, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Eventfrog") : null,
            h("button.btn.sm", { onclick: async (e) => { e.currentTarget.disabled = true; await refresh(true); } }, icon("refresh"), "Jetzt abrufen"))),
        h("div.card-body",
          h("div.grid.g-4", { style: { gap: "12px" } },
            h("div", k("Verkauft"), big(fmtNum(t.sold ?? 0), cap ? h("small.faint", ` / ${fmtNum(cap)}`) : null), cap ? meter(((t.sold ?? 0) / cap) * 100, [101, 101]) : null),
            h("div", k("Ticket-Umsatz"), big(fmtEUR(t.revenue ?? 0))),
            h("div", k("Bestellungen"), big(t.orders ? fmtNum(t.orders) : "–"), t.cancelled ? h("div.faint", { style: { fontSize: "12px" } }, `${t.cancelled} storniert`) : null),
            h("div", k(eventDay ? "Eingecheckt – live" : "Eingecheckt"), big(fmtNum(t.checked_in || 0), t.sold ? h("small.faint", ` / ${fmtNum(t.sold)}`) : null), t.sold ? meter(((t.checked_in || 0) / t.sold) * 100, [101, 101]) : null)),
          h("div.grid.g-2", { style: { marginTop: "14px", alignItems: "start" } },
            h("div", h("h4.sub-h", daily.length ? "Verkäufe pro Tag" : "Verlauf"), chart),
            h("div", h("h4.sub-h", "Kategorien"), t.tiers?.length ? h("div.list", t.tiers.map((x) => h("div.list-item",
              h("div.li-main", h("div.li-title", x.name), h("div.li-sub", [x.price !== null && x.price !== undefined ? `${fmtEUR(x.price)} pro Ticket` : null, x.capacity ? `${x.sold}/${x.capacity} verkauft` : null].filter(Boolean).join(" · ")),
                x.capacity ? meter((x.sold / x.capacity) * 100, [80, 100]) : null),
              h("span.nowrap", `${fmtNum(x.sold)} × · ${fmtEUR(x.revenue)}`)))) : h("div.faint", { style: { fontSize: "13px" } }, "Keine Kategorien"))))));
    }
    refresh().catch(() => draw2());
    // Am Event-Tag jede Minute neu laden (Check-ins), sonst alle 2 Min. aus der Datenbank
    timer = setInterval(() => { if (!box.isConnected) return clearInterval(timer); if (document.visibilityState === "visible") refresh().catch(() => {}); },
      ev.event_date && Math.abs(new Date(ev.event_date) - Date.now()) < 20 * 3600_000 ? 60_000 : 120_000);
    return box;
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
