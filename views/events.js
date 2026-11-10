import { sb, q } from "../lib/api.js";
import { h, icon, badge, EVENT_STATUS, fmtDateTime, fmtEUR, fmtNum, fmtAgo, empty } from "../lib/ui.js";
import { newEvent } from "../lib/actions.js";

export default async function eventsView() {
  const [events, items] = await Promise.all([
    q(sb.from("cc_events").select("*").order("event_date", { ascending: true, nullsFirst: false })),
    q(sb.from("cc_event_items").select("event_id,kind,done,amount")),
  ]);
  const agg = items.reduce((m, i) => { const a = (m[i.event_id] ??= { tasks: 0, done: 0, cost: 0 });
    if (i.kind === "task" || i.kind === "tech") { a.tasks++; if (i.done) a.done++; } if (i.kind === "cost") a.cost += Number(i.amount) || 0; return m; }, {});
  const now = Date.now();
  const upcoming = events.filter((e) => !e.event_date || new Date(e.event_date) >= now - 86400_000).filter((e) => e.status !== "done" && e.status !== "cancelled");
  const past = events.filter((e) => !upcoming.includes(e));

  const evCard = (e) => {
    const a = agg[e.id] || { tasks: 0, done: 0, cost: 0 };
    const d = e.event_date ? new Date(e.event_date) : null;
    return h("a.card.pcard", { href: `#/events/${e.id}` },
      h("div.top",
        h("div.cat-icon", { style: { flexDirection: "column", background: "var(--primary-soft)", color: "var(--primary)", lineHeight: 1.05, width: "46px", height: "46px" } },
          d ? [h("strong", { style: { fontSize: "17px" } }, d.getDate()), h("span", { style: { fontSize: "11px" } }, d.toLocaleDateString("de-DE", { month: "short" }))] : icon("calendar")),
        h("div", { style: { minWidth: 0, flex: 1 } }, h("h4.ellipsis", e.name), h("div.faint.ellipsis", { style: { fontSize: "12.5px" } }, [d ? fmtDateTime(d) : "ohne Datum", e.location].filter(Boolean).join(" · "))),
        badge(EVENT_STATUS, e.status)),
      e.description ? h("p", e.description) : null,
      h("div.meta",
        a.tasks ? h("span", `${a.done}/${a.tasks} Aufgaben`) : null,
        e.budget !== null ? h("span", `Budget ${fmtEUR(e.budget)}`) : null,
        a.cost ? h("span", { style: { color: e.budget !== null && a.cost > e.budget ? "var(--bad)" : "" } }, `Kosten ${fmtEUR(a.cost)}`) : null,
        e.expected_guests !== null ? h("span", `${fmtNum(e.expected_guests)} Gäste`) : null,
        h("span", { style: { marginLeft: "auto" } }, d && d > now ? fmtAgo(d) : "")));
  };
  const grid = (list) => h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" } }, list.map(evCard));
  return h("div",
    h("div.page-head", h("div", h("h1", "Events"), h("p", `${upcoming.length} anstehend · ${past.length} vergangen oder abgeschlossen`)),
      h("div.actions", h("button.btn.primary", { onclick: () => newEvent() }, icon("plus"), "Event erstellen"))),
    events.length ? h("div.stack",
      upcoming.length ? grid(upcoming) : h("div.card", empty("calendar", "Keine anstehenden Events")),
      past.length ? [h("h3", { style: { margin: "12px 0 0", fontSize: "14px", color: "var(--text-2)" } }, "Vergangen & abgeschlossen"), grid(past)] : null)
      : h("div.card", empty("calendar", "Noch keine Events", "Plane Techno-Events, Partys oder Veranstaltungen mit Aufgaben, Technik, Budget, Zeitplan und Gästeliste.",
        h("button.btn.primary", { onclick: () => newEvent() }, icon("plus"), "Event erstellen"))));
}
