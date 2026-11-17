// Events für alle Konten (nx_events / nx_event_items, nur eigene Daten per RLS).
// Planen, Aufgaben, Ablauf, Kosten & Einnahmen, Gäste, Schichten, Tickets (von Hand oder live über Eventfrog-Verbindung),
// teilen (Ticket-Live oder Planung) und mit der KI planen lassen.
import { sb, q, nx, local } from "../lib/api.js";
import { h, icon, toast, toastErr, fmtDateTime, fmtEUR, empty, formModal, confirmDialog, errMsg, modal } from "../lib/ui.js";
import { openShareDialog } from "../lib/share.js";
import { aiCleanup } from "../lib/aidedupe.js";
import { eventWizard } from "../lib/eventwizard.js";
import { eventCopilot } from "../lib/aiassist.js";
import { projectSyncDialog } from "../lib/syncproject.js";
import { calcCard, compute, detailsText, eventSheet, emptyCalc } from "../lib/eventcalc.js";

const STATUS = { idea: "Idee", planning: "In Planung", confirmed: "Fest", done: "Vorbei", cancelled: "Abgesagt" };
const SECTIONS = [
  ["task", "Aufgaben", "check", "Was muss erledigt werden?"],
  ["schedule", "Ablauf", "clock", "Zeitplan am Eventtag"],
  ["cost", "Kosten", "wallet", "Ausgaben (DJ, Location, Deko …)"],
  ["income", "Einnahmen", "wallet", "Außer Tickets: Sponsoren, Bar …"],
  ["guest", "Gästeliste", "users", "Namen auf der Liste"],
  ["shift", "Schichten", "clock", "Wer hilft wann?"],
];
const toLocal = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
const iso = (v) => (v ? new Date(v).toISOString() : null);
const ticketsOf = (ev, proj) => (proj?.metadata?.tickets ? { ...proj.metadata.tickets, live: true } : { ...(ev.tickets || {}), live: false });

export function eventForm(ev, onSaved) {
  formModal(ev ? "Event bearbeiten" : "Neues Event", [
    { name: "name", label: "Name", value: ev?.name, required: true, max: 160, placeholder: "z. B. Sommerparty 2027" },
    { name: "event_date", label: "Datum & Uhrzeit", type: "datetime-local", half: true, value: toLocal(ev?.event_date) },
    { name: "status", label: "Stand", type: "select", half: true, value: ev?.status || "planning", options: Object.entries(STATUS) },
    { name: "location", label: "Ort", value: ev?.location, max: 300 },
    { name: "capacity", label: "Plätze / Tickets", type: "number", half: true, value: ev?.capacity ?? "" },
    { name: "ticket_price", label: "Ticketpreis (€)", type: "number", half: true, value: ev?.ticket_price ?? "" },
    { name: "description", label: "Beschreibung", type: "textarea", value: ev?.description, max: 8000 },
  ], async (v) => {
    const row = { name: v.name, event_date: iso(v.event_date), status: v.status, location: v.location || "", description: v.description || "",
      capacity: v.capacity === "" ? null : Number(v.capacity), ticket_price: v.ticket_price === "" ? null : Number(v.ticket_price) };
    const saved = ev ? await q(sb.from("nx_events").update(row).eq("id", ev.id).select("*").single()) : await q(sb.from("nx_events").insert(row).select("*").single());
    local.set("ws:did-event", true); toast("Gespeichert"); onSaved?.(saved);
  }, { submit: ev ? "Speichern" : "Anlegen" });
}

// KI erstellt einen Plan als JSON – wir legen daraus Event + Einträge an
export async function aiPlan(eventId, text) {
  const question = `Plane ein Event: ${text}
Antworte NUR mit JSON ohne Erklärung, genau in dieser Form:
{"name":"…","location":"…","capacity":0,"ticket_price":0,"tasks":["…"],"schedule":[{"time":"18:00","title":"…"}],"costs":[{"title":"…","amount":0}]}
Maximal 15 Aufgaben, 10 Ablaufpunkte, 10 Kostenpunkte mit realistischen Beträgen in Euro. Deutsch.`;
  const r = await nx("ai", { question, history: [] });
  const m = String(r.answer || "").match(/\{[\s\S]*\}/);
  if (!m) throw new Error("Die KI hat keinen Plan geliefert – bitte etwas genauer beschreiben.");
  let plan; try { plan = JSON.parse(m[0]); } catch { throw new Error("Der KI-Plan war unvollständig – bitte nochmal versuchen."); }
  let ev = eventId ? { id: eventId } : null;
  if (!ev) ev = await q(sb.from("nx_events").insert({ name: String(plan.name || text).slice(0, 160), location: String(plan.location || "").slice(0, 300),
    capacity: Number.isFinite(+plan.capacity) && +plan.capacity > 0 ? Math.round(+plan.capacity) : null,
    ticket_price: Number.isFinite(+plan.ticket_price) && +plan.ticket_price > 0 ? +plan.ticket_price : null, description: `Mit KI geplant: ${text}`.slice(0, 8000) }).select("*").single());
  const rows = [
    ...(plan.tasks || []).slice(0, 15).map((t) => ({ kind: "task", title: String(t?.title || t).slice(0, 200) })),
    ...(plan.schedule || []).slice(0, 10).map((s) => ({ kind: "schedule", title: `${s.time ? `${s.time} ` : ""}${s.title || ""}`.trim().slice(0, 200) })),
    ...(plan.costs || []).slice(0, 10).map((c) => ({ kind: "cost", title: String(c.title || "Kosten").slice(0, 200), amount: Number.isFinite(+c.amount) ? +c.amount : null })),
  ].filter((x) => x.title).map((x) => ({ ...x, event_id: ev.id }));
  if (rows.length) await q(sb.from("nx_event_items").insert(rows));
  local.set("ws:did-event", true);
  return { id: ev.id, n: rows.length };
}

function aiDialog(eventId, done) {
  formModal(eventId ? "KI-Vorschläge ergänzen" : "Event mit KI planen", [
    { name: "text", label: "Beschreib dein Event in einem Satz", type: "textarea", required: true, max: 600,
      placeholder: "z. B. Techno-Party für 150 Leute in Berlin, 16+, Januar, Budget 1500 €" },
  ], async (v) => {
    toast("Die KI plant … das dauert ein paar Sekunden", "info");
    const r = await aiPlan(eventId, v.text);
    toast(`${r.n} Einträge angelegt – alles lässt sich bearbeiten`); done(r.id);
  }, { submit: "Planen lassen" });
}

export async function eventsPage() {
  const [evs, items] = await Promise.all([
    q(sb.from("nx_events").select("*").order("event_date", { ascending: true, nullsFirst: false })),
    q(sb.from("nx_event_items").select("event_id,kind,done")),
  ]);
  const open = (id) => { location.hash = `#/events/${id}`; };
  const wizard = () => eventWizard({ admin: false, quick: () => eventForm(null, (e) => open(e.id)) });
  const card = (e) => {
    const its = items.filter((i) => i.event_id === e.id && i.kind === "task"), done = its.filter((i) => i.done).length;
    const days = e.event_date ? Math.ceil((new Date(e.event_date) - Date.now()) / 864e5) : null;
    return h("a.card.card-pad.ev-card", { href: `#/events/${e.id}` },
      h("div.row.between", h("strong", e.name), h("span.badge.b-idle", STATUS[e.status] || e.status)),
      h("div.li-sub", [e.event_date ? fmtDateTime(e.event_date) : "Datum offen", e.location].filter(Boolean).join(" · ")),
      h("div.row.wrap", { style: { gap: "14px", marginTop: "10px", fontSize: "13px" } },
        days !== null && days >= 0 ? h("span", h("strong", String(days)), " Tage") : null,
        its.length ? h("span", h("strong", `${done}/${its.length}`), " Aufgaben") : null,
        e.tickets?.sold ? h("span", h("strong", String(e.tickets.sold)), " Tickets") : null));
  };
  return h("div",
    h("div.page-head", h("div", h("h1", "Events"), h("p", "Plane Partys, Treffen und Veranstaltungen – mit Aufgaben, Ablauf, Budget und Tickets.")),
      h("div.actions", h("button.btn", { onclick: () => aiDialog(null, open) }, icon("bot"), "In einem Satz"),
        h("button.btn.primary", { onclick: () => wizard() }, icon("plus"), "Neues Event"))),
    evs.length ? h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" } }, evs.map(card))
      : h("section.card", empty("calendar", "Noch kein Event", "Lege eins an – oder beschreib es der KI in einem Satz, sie erstellt Aufgaben, Ablauf und Kosten.",
        h("div.row", { style: { gap: "8px", justifyContent: "center" } }, h("button.btn.primary", { onclick: () => wizard() }, icon("sparkles"), "Event mit KI-Bogen anlegen"),
          h("button.btn", { onclick: () => wizard() }, icon("upload"), "Importieren")))));
}

export async function eventPage(id) {
  let ev = await q(sb.from("nx_events").select("*").eq("id", id).maybeSingle());
  if (!ev) return h("section.card", empty("calendar", "Event nicht gefunden", "Vielleicht wurde es gelöscht.", h("a.btn", { href: "#/events" }, "Zu den Events")));
  const [items, projs] = await Promise.all([
    q(sb.from("nx_event_items").select("*").eq("event_id", id).order("at", { ascending: true, nullsFirst: false }).order("created_at")),
    q(sb.from("nx_projects").select("id,name,metadata,url")).catch(() => []),
  ]);
  let rows = items;
  const tixProjects = projs.filter((p) => p.metadata?.tickets);
  const linked = projs.find((p) => p.id === ev.nx_project_id);
  let snaps = []; if (linked) { try { snaps = await q(sb.from("nx_ticket_snaps").select("at,sold").eq("ref_id", linked.id).order("at").limit(3000)); } catch { snaps = []; } }
  const calcKey = `cc:calc:${id}`;
  const saveAllU = async ({ calc, details }) => { const c = { ...calc, details }; const R = compute(c); try { await q(sb.from("nx_events").update({ calc: c, budget: R.costs, capacity: Number(c.guests) || ev.capacity }).eq("id", id)); ev.calc = c; } catch { localStorage.setItem(calcKey, JSON.stringify(c)); } location.reload(); };
  let localCalc = null; try { localCalc = JSON.parse(localStorage.getItem(calcKey)); } catch { /* */ }
  const root = h("div");
  const reload = async () => { rows = await q(sb.from("nx_event_items").select("*").eq("event_id", id).order("at", { ascending: true, nullsFirst: false }).order("created_at")); draw(); };

  const itemForm = (kind, it) => {
    const money = kind === "cost" || kind === "income";
    formModal(it ? "Bearbeiten" : `Neu: ${SECTIONS.find((s) => s[0] === kind)[1]}`, [
      { name: "title", label: kind === "guest" ? "Name" : "Titel", value: it?.title, required: true, max: 200 },
      ...(money ? [{ name: "amount", label: "Betrag (€)", type: "number", half: true, value: it?.amount ?? "" }] : []),
      ...(kind !== "guest" ? [{ name: "at", label: kind === "task" ? "Fällig am" : "Beginn", type: "datetime-local", half: true, value: toLocal(it?.at) }] : []),
      ...(kind === "shift" ? [{ name: "ends_at", label: "Ende", type: "datetime-local", half: true, value: toLocal(it?.ends_at) }] : []),
      ...(["task", "shift"].includes(kind) ? [{ name: "assignee", label: "Wer?", half: true, value: it?.assignee, max: 120 }] : []),
      { name: "note", label: "Notiz", value: it?.note, max: 2000 },
    ], async (v) => {
      const row = { kind, title: v.title, note: v.note || "", at: iso(v.at), ends_at: iso(v.ends_at), amount: money && v.amount !== "" ? Number(v.amount) : null, assignee: v.assignee || null };
      if (it) await q(sb.from("nx_event_items").update(row).eq("id", it.id)); else await q(sb.from("nx_event_items").insert({ ...row, event_id: id }));
      await reload();
    }, { submit: it ? "Speichern" : "Hinzufügen" });
  };
  const section = ([kind, title, ic, hint]) => {
    const list = rows.filter((r) => r.kind === kind);
    const sum = list.reduce((a, r) => a + (+r.amount || 0), 0);
    return h("section.card", h("div.card-head", h("h3.row", icon(ic), title,
      kind === "task" && list.length ? h("span.faint", { style: { fontWeight: 400 } }, ` ${list.filter((r) => r.done).length}/${list.length}`) : null,
      (kind === "cost" || kind === "income") && list.length ? h("span.faint", { style: { fontWeight: 400 } }, ` ${fmtEUR(sum)}`) : null),
      h("button.btn.sm.ghost", { onclick: () => itemForm(kind), "aria-label": `${title}: hinzufügen` }, icon("plus"), "Neu")),
      h("div.card-body", list.length ? h("div.list", list.map((r) => h("div.list-item",
        kind === "task" ? h("input", { type: "checkbox", checked: r.done, "aria-label": `${r.title} erledigt`, style: { width: "18px", height: "18px", accentColor: "var(--primary)" },
          onchange: async (e) => { try { await q(sb.from("nx_event_items").update({ done: e.target.checked }).eq("id", r.id)); r.done = e.target.checked; draw(); } catch (er) { toastErr(er); } } }) : null,
        h("div.li-main", h("div.li-title", { style: r.done ? { textDecoration: "line-through", color: "var(--text-3)" } : null }, r.title),
          h("div.li-sub", [r.at ? fmtDateTime(r.at) : null, r.ends_at ? `bis ${new Date(r.ends_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : null, r.assignee, r.note].filter(Boolean).join(" · "))),
        r.amount !== null && r.amount !== undefined ? h("span.nowrap", fmtEUR(r.amount)) : null,
        h("button.icon-btn", { "aria-label": `${r.title} bearbeiten`, onclick: () => itemForm(kind, r) }, icon("edit")),
        h("button.icon-btn", { "aria-label": `${r.title} löschen`, onclick: async () => { try { await q(sb.from("nx_event_items").delete().eq("id", r.id)); await reload(); } catch (er) { toastErr(er); } } }, icon("x")))))
        : h("p.faint", { style: { margin: 0, fontSize: "13px" } }, hint)));
  };
  const ticketsCard = () => {
    const t = ticketsOf(ev, linked), cap = t.capacity || ev.capacity || 0, sold = t.sold || 0;
    const editManual = () => formModal("Tickets eintragen", [
      { name: "sold", label: "Verkauft", type: "number", half: true, value: ev.tickets?.sold ?? 0 },
      { name: "revenue", label: "Umsatz (€)", type: "number", half: true, value: ev.tickets?.revenue ?? "" },
      ...(tixProjects.length ? [{ name: "proj", label: "…oder live aus Eventfrog übernehmen", type: "select", value: ev.nx_project_id || "", options: [["", "Nicht verknüpft (von Hand)"], ...tixProjects.map((p) => [p.id, p.name])] }] : []),
    ], async (v) => {
      const today = new Date().toISOString().slice(0, 10), daily = [...(ev.tickets?.daily || []).filter((d) => d.d !== today)];
      const prev = ev.tickets?.sold || 0; if (+v.sold > prev) daily.push({ d: today, n: (+v.sold - prev) + ((ev.tickets?.daily || []).find((d) => d.d === today)?.n || 0) });
      ev = await q(sb.from("nx_events").update({ tickets: { ...(ev.tickets || {}), sold: +v.sold || 0, revenue: v.revenue === "" ? null : +v.revenue, capacity: ev.capacity, daily: daily.slice(-60), as_of: new Date().toISOString() },
        nx_project_id: v.proj || null }).eq("id", id).select("*").single());
      location.reload();
    }, { submit: "Speichern" });
    return h("section.card", h("div.card-head", h("h3.row", icon("ticket"), "Tickets", t.live ? h("span.badge.b-ok", { style: { marginLeft: "8px" } }, "live") : null),
      h("div.row", { style: { gap: "6px" } }, h("button.btn.sm.ghost", { onclick: editManual }, icon("edit"), t.live ? "Quelle" : "Eintragen"),
        h("button.btn.sm", { onclick: () => openShareDialog("nx_event", id, ev.name, { admin: false }) }, icon("users"), "Live teilen"))),
      h("div.card-body", h("div.row.between", h("strong", { style: { fontSize: "28px" } }, String(sold)), h("span.muted", cap ? `von ${cap}` : "verkauft")),
        cap ? h("div.tix-bar", { style: { margin: "8px 0 0", maxWidth: "none" } }, h("i", { style: { width: `${Math.min(100, (sold / cap) * 100)}%` } })) : null,
        h("div.li-sub", { style: { marginTop: "8px" } }, t.live ? `Live aus „${linked.name}“ · Stand ${t.as_of ? fmtDateTime(t.as_of) : "unbekannt"}` : "Von Hand eingetragen. Mit einer Eventfrog-Verbindung geht es automatisch.")));
  };
  const money = () => {
    const cost = rows.filter((r) => r.kind === "cost").reduce((a, r) => a + (+r.amount || 0), 0);
    const inc = rows.filter((r) => r.kind === "income").reduce((a, r) => a + (+r.amount || 0), 0);
    const t = ticketsOf(ev, linked), tix = t.revenue ?? ((t.sold || 0) * (+ev.ticket_price || 0));
    const result = inc + tix - cost, need = ev.ticket_price ? Math.max(0, Math.ceil((cost - inc) / ev.ticket_price)) : null;
    return h("section.card", h("div.card-head", h("h3.row", icon("wallet"), "Budget auf einen Blick")), h("div.card-body.stack", { style: { gap: "6px", fontSize: "14px" } },
      h("div.row.between", h("span", "Kosten"), h("strong", fmtEUR(cost))),
      h("div.row.between", h("span", "Ticket-Einnahmen"), h("strong", fmtEUR(tix))),
      h("div.row.between", h("span", "Weitere Einnahmen"), h("strong", fmtEUR(inc))),
      h("div.row.between", { style: { borderTop: "1px solid var(--border)", paddingTop: "6px" } }, h("span", "Ergebnis"), h("strong", { style: { color: result >= 0 ? "var(--ok)" : "var(--bad)" } }, fmtEUR(result))),
      need !== null ? h("div.li-sub", `Break-even ab ${need} verkauften Tickets${(t.sold || 0) >= need ? " – erreicht ✓" : ` – noch ${need - (t.sold || 0)} fehlen`}.`) : h("div.li-sub", "Ticketpreis eintragen, dann rechne ich den Break-even aus.")));
  };
  function draw() {
    const days = ev.event_date ? Math.ceil((new Date(ev.event_date) - Date.now()) / 864e5) : null;
    root.replaceChildren(
      h("div.crumb", h("a", { href: "#/events" }, "Events"), icon("chevronR"), h("span", ev.name)),
      h("div.page-head", h("div", h("h1", ev.name), h("p", [STATUS[ev.status], ev.event_date ? fmtDateTime(ev.event_date) : "Datum offen", ev.location, days !== null && days >= 0 ? `noch ${days} Tage` : null].filter(Boolean).join(" · "))),
        h("div.actions",
          h("button.btn.primary", { onclick: () => openShareDialog("nx_event", id, ev.name, { admin: false }) }, icon("users"), "Teilen"),
          h("button.btn", { onclick: () => aiDialog(id, () => reload()) }, icon("bot"), "KI-Ideen"),
          h("button.btn.primary", { title: "Ein Formular für alles", onclick: () => eventSheet({ name: ev.name, tiers: ticketsOf(ev, linked).tiers || [], calc: ev.calc || localCalc || emptyCalc({ capacity: ev.capacity, ticket_price: ev.ticket_price }), details: (ev.calc || localCalc)?.details || {}, onSave: saveAllU }) }, icon("edit"), "Event-Formular"),
          h("button.btn", { onclick: () => aiCheck(ev, rows, ticketsOf(ev, linked)) }, icon("sparkles"), "KI-Check"),
          h("button.btn", { onclick: () => import("./studio.js").then((m) => m.openStudio("bogen", `ne:${ev.id}`)) }, icon("check"), "Rechts-Check"),
          h("button.btn", { onclick: () => import("./studio.js").then((m) => m.openStudio("web", `ne:${ev.id}`)) }, icon("external"), "Event-Website"),
          h("button.btn", { onclick: () => aiCleanup({ items: rows, table: "nx_event_items", context: ev.name, onDone: reload }) }, icon("sparkles"), "KI-Aufräumen"),
          h("button.btn.ghost", { onclick: () => eventForm(ev, (e) => { ev = e; draw(); }) }, icon("edit"), "Bearbeiten"),
          h("button.btn.ghost", { "aria-label": "Event löschen", onclick: async () => {
            if (!(await confirmDialog("Event löschen?", `„${ev.name}“ mit allen Einträgen und Freigaben wird gelöscht.`, { ok: "Löschen" }))) return;
            try { await q(sb.from("cc_shares").delete().in("item_kind", ["nx_event", "tickets"]).eq("item_id", id)).catch(() => {}); await q(sb.from("nx_events").delete().eq("id", id)); toast("Gelöscht"); location.hash = "#/events"; } catch (e) { toastErr(e); }
          } }, icon("trash")))),
      ev.description ? h("section.card.card-pad", { style: { marginBottom: "16px", whiteSpace: "pre-wrap" } }, ev.description) : null,
      h("div", { style: { marginBottom: "16px" } }, eventCopilot({ ev, rows, tickets: ticketsOf(ev, linked), kinds: ["task", "schedule", "cost", "income", "shift", "guest"],
        insert: async (list) => { await q(sb.from("nx_event_items").insert(list.map((x) => ({ ...x, event_id: id })))); await reload(); },
        onSync: () => projectSyncDialog({ admin: false, ev, items: rows, projects: projs, onDone: () => location.reload() }),
        info: [detailsText(ev.calc?.details || {}), String(ev.description || "").slice(0, 5000), linked?.url ? `Link: ${linked.url}` : "", ev.ticket_price ? `Ticketpreis: ${ev.ticket_price} €` : ""].filter(Boolean).join("\n"),
        addTask: async (t) => { await q(sb.from("nx_event_items").insert({ event_id: id, kind: "task", title: t.title, note: t.note, at: t.due })); await reload(); } })),
      calcCard({ name: ev.name, calc: ev.calc || localCalc, tickets: ticketsOf(ev, linked), eventDate: ev.event_date, capacity: ev.capacity, snaps, details: (ev.calc || localCalc)?.details || {}, onSaveAll: saveAllU,
        onSync: () => projectSyncDialog({ admin: false, ev, items: rows, projects: projs, onDone: () => location.reload() }),
        note: ev.calc === undefined && localCalc ? "Kalkulation ist nur auf diesem Gerät gespeichert (Server-Speicher wird mit der nächsten Freischaltung aktiv)." : "",
        onSave: async (c) => { const R = compute(c); try { await q(sb.from("nx_events").update({ calc: c, budget: R.costs, capacity: Number(c.guests) || ev.capacity }).eq("id", id)); ev.calc = c; }
          catch { localStorage.setItem(calcKey, JSON.stringify(c)); await q(sb.from("nx_events").update({ budget: R.costs }).eq("id", id)).catch(() => {}); } } }),
      h("div.grid.g-2", { style: { marginBottom: "16px", alignItems: "start" } }, ticketsCard(), money()),
      h("div.grid.g-2", { style: { alignItems: "start" } }, SECTIONS.map(section)));
  }
  try { draw(); } catch (e) { root.replaceChildren(h("div.banner.bad", errMsg(e))); }
  return root;
}

// KI prüft das Event: Was fehlt, Risiken, Budget, nächste Schritte
async function aiCheck(ev, rows, t) {
  const box = h("div", h("div.row", { style: { gap: "8px" } }, h("div.spinner", { style: { width: "16px", height: "16px" } }), h("span.faint", "Die KI prüft dein Event …")));
  modal("KI-Check", box, { wide: true });
  const by = (k) => rows.filter((r) => r.kind === k);
  const sum = (k) => by(k).reduce((a, r) => a + (+r.amount || 0), 0);
  const facts = [`Event: ${ev.name}; Datum: ${ev.event_date || "offen"}; Ort: ${ev.location || "offen"}; Plätze: ${ev.capacity ?? "?"}; Ticketpreis: ${ev.ticket_price ?? "?"} €; Stand: ${ev.status}`,
    `Tickets verkauft: ${t.sold || 0}${t.revenue ? `, Umsatz ${t.revenue} €` : ""}`, `Kosten gesamt: ${sum("cost")} €; weitere Einnahmen: ${sum("income")} €`,
    `Offene Aufgaben: ${by("task").filter((r) => !r.done).map((r) => r.title).join("; ") || "keine"}`, `Erledigt: ${by("task").filter((r) => r.done).length}`,
    `Ablauf: ${by("schedule").map((r) => r.title).join("; ") || "leer"}`, `Schichten: ${by("shift").length}; Gäste auf Liste: ${by("guest").length}`].join("\n");
  try {
    const r = await nx("ai", { history: [], question: `Prüfe dieses Event wie ein erfahrener Veranstalter. Antworte auf Deutsch, kurz, in Markdown mit den Abschnitten „Was gut ist“, „Was fehlt“, „Geld“ (Break-even, Risiken) und „Nächste 3 Schritte“. Nur auf Basis dieser Daten, nichts erfinden:\n${facts}` });
    box.replaceChildren(h("div.md", { style: { whiteSpace: "pre-wrap", lineHeight: 1.55 } }, r.answer || "Keine Antwort."), h("div.faint", { style: { fontSize: "12px", marginTop: "10px" } }, `KI: ${r.provider || ""} ${r.model || ""}`.trim()));
  } catch (e) { box.replaceChildren(h("div.banner.bad", errMsg(e))); }
}
