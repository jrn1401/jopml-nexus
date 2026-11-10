import { sb, q, rpc, getSetting } from "../lib/api.js";
import { h, icon, stat, fmtNum, fmtCompact, fmtBytes, fmtPct, fmtAgo, fmtDateTime, badge, SERVER_STATUS, meter, empty, naNote } from "../lib/ui.js";
import { barChart } from "../lib/charts.js";
import { timeline } from "../lib/modules.js";
import { newProject, newModule, uploadDialog, connectServer, newEvent, syncHelp, openAssistant } from "../lib/actions.js";

export const WIDGETS = {
  stats: "Kennzahlen", servers: "Serverstatus", ai: "KI-Nutzung", activity: "Letzte Aktivitäten",
  jopml: "JOPML", events: "Nächste Events", quick: "Schnellaktionen",
};

export default async function dashboard({ user }) {
  const [o, layout, servers, events] = await Promise.all([
    rpc("cc_overview"),
    getSetting("dashboard", { order: Object.keys(WIDGETS), hidden: [] }),
    q(sb.from("cc_servers").select("id,name,hostname,status,cpu_usage,memory_usage,disk_usage,last_heartbeat").order("name").limit(8)),
    q(sb.from("cc_events").select("id,name,event_date,location,status").gte("event_date", new Date().toISOString()).not("status", "in", "(done,cancelled)").order("event_date").limit(4)),
  ]);
  const hour = new Date().getHours();
  const hello = hour < 5 ? "Gute Nacht" : hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
  const name = (user.user_metadata?.full_name || "").split(" ")[0];

  const W = {
    stats: () => h("div.grid.g-4.w-12",
      stat("Projekte", fmtNum(o.projects_total), { ic: "folder", sub: `${fmtNum(o.projects_active)} aktiv · ${fmtNum(o.modules_active)} Module` }),
      o.servers_total ? stat("Server online", `${o.servers_online}`, { ic: "server", unit: `/ ${o.servers_total}`, sub: o.servers_load?.cpu !== null && o.servers_load?.cpu !== undefined ? `Ø CPU ${fmtPct(o.servers_load.cpu)} · RAM ${fmtPct(o.servers_load.mem)}` : "Keine Live-Werte" })
        : stat("Server", "", { ic: "server", na: "Nicht verbunden", sub: "Server über „Server verbinden“ anlegen" }),
      stat("Tokens heute", fmtCompact(o.ai_tokens_today), { ic: "sparkles", sub: `${fmtNum(o.ai_requests_today)} Anfragen · gemessene Quellen` }),
      stat("Dateien", fmtNum(o.files_count), { ic: "file", sub: `${fmtBytes(o.files_bytes)} belegt (dedupliziert)` })),
    servers: () => card("Serverstatus", "#/servers", servers.length
      ? h("div.list", servers.map((s) => h("a.list-item", { href: `#/servers/${s.id}` },
          h("div.li-icon", icon("server")),
          h("div.li-main", h("div.li-title", s.name), h("div.li-sub", s.last_heartbeat ? `Heartbeat ${fmtAgo(s.last_heartbeat)}` : "Noch kein Heartbeat")),
          s.status === "online" || s.status === "warning" ? h("div", { style: { width: "120px" }, class: "hide-sm" },
            h("div.row.between", { style: { fontSize: "11.5px" } }, h("span.faint", "CPU"), h("span", fmtPct(s.cpu_usage))), meter(s.cpu_usage)) : null,
          badge(SERVER_STATUS, s.status))))
      : empty("server", "Keine Server verbunden", "Registriere einen Server – der Agent sendet dann CPU, RAM, Speicher und Netzwerk.", h("button.btn.sm", { onclick: connectServer }, icon("plus"), "Server verbinden")), "w-7"),
    ai: () => card("KI-Nutzung · 7 Tage", "#/ai", h("div.stack", { style: { gap: "8px" } },
      h("div.row.between", h("span.muted", "Heute"), h("strong", `${fmtNum(o.ai_tokens_today)} Tokens`)),
      barChart(o.ai_tokens_7d.map((d) => new Date(d.d).toLocaleDateString("de-DE", { weekday: "short" })), [{ name: "Tokens", values: o.ai_tokens_7d.map((d) => Number(d.t)) }],
        { height: 150, yFmt: fmtCompact, emptyText: "Noch keine gemessene KI-Nutzung." }),
      h("div.faint", { style: { fontSize: "12px" } }, "Quellen: JOPML (Gemini/Groq) und gemeldete Aufrufe. Claude erscheint nach Verbindung der Anthropic Admin-API.")), "w-5"),
    activity: () => card("Letzte Aktivitäten", "#/activity", o.activities.length ? timeline(o.activities, { showProject: true }) : empty("activity", "Noch nichts passiert", "Aktivitäten entstehen automatisch."), "w-7"),
    jopml: () => card("JOPML", "#/jopml", h("div.stack", { style: { gap: "12px" } },
      h("div.grid", { style: { gridTemplateColumns: "1fr 1fr", gap: "10px" } },
        [["Nutzer", fmtNum(o.jopml.users)], ["Jetzt online", fmtNum(o.jopml.online_now)], ["Aktiv 24 h", fmtNum(o.jopml.online_24h)], ["Fehler 24 h", fmtNum(o.jopml.errors_24h)]]
          .map(([k, v]) => h("div", { style: { padding: "10px 12px", background: "var(--surface-2)", borderRadius: "10px" } }, h("div.faint", { style: { fontSize: "12px" } }, k), h("div", { style: { fontSize: "18px", fontWeight: 620 } }, v)))),
      h("div.row.between", { style: { fontSize: "13px" } }, h("span.muted", "Aktuelle Version"), h("span.badge.b-acc.plain", o.jopml.version || "–")),
      h("div.row.between", { style: { fontSize: "13px" } }, h("span.muted", "Offene Tickets"), h("span", fmtNum(o.jopml.tickets_open)))), "w-5"),
    events: () => card("Nächste Events", "#/events", events.length
      ? h("div.list", events.map((e) => h("a.list-item", { href: `#/events/${e.id}` },
          h("div.li-icon", { style: { flexDirection: "column", gap: 0, lineHeight: 1.05, fontSize: "11px", width: "40px", height: "40px" } },
            h("strong", { style: { fontSize: "15px", color: "var(--text)" } }, new Date(e.event_date).getDate()), new Date(e.event_date).toLocaleDateString("de-DE", { month: "short" })),
          h("div.li-main", h("div.li-title", e.name), h("div.li-sub", `${fmtDateTime(e.event_date)}${e.location ? " · " + e.location : ""}`)))))
      : empty("calendar", "Keine anstehenden Events", null, h("button.btn.sm", { onclick: () => newEvent() }, icon("plus"), "Event erstellen")), "w-6"),
    quick: () => card("Schnellaktionen", null, h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: "8px" } },
      [["folder", "Neues Projekt", () => newProject()], ["layers", "Modul hinzufügen", () => newModule()], ["upload", "Datei hochladen", () => uploadDialog()],
       ["server", "Server verbinden", connectServer], ["calendar", "Event erstellen", () => newEvent()], ["refresh", "Synchronisieren", () => syncHelp()], ["bot", "KI-Assistent", () => openAssistant()]]
        .map(([ic, t, fn]) => h("button.btn", { onclick: fn, style: { justifyContent: "flex-start", height: "44px" } }, icon(ic), t))), "w-6"),
  };

  const order = [...(layout.order || []).filter((k) => W[k]), ...Object.keys(W).filter((k) => !(layout.order || []).includes(k))];
  const hidden = new Set(layout.hidden || []);
  return h("div",
    h("div.page-head", h("div", h("h1", `${hello}${name ? ", " + name : ""}`), h("p", `${fmtNum(o.projects_total)} Projekte · ${o.servers_total ? `${o.servers_online}/${o.servers_total} Server online` : "keine Server verbunden"} · ${fmtNum(o.notifications_unread)} ungelesene Hinweise`)),
      h("div.actions", h("a.btn.ghost", { href: "#/settings?tab=dashboard" }, icon("dashboard"), "Anpassen"), h("button.btn.primary", { onclick: () => newProject() }, icon("plus"), "Neues Projekt"))),
    h("div.grid.dash", order.filter((k) => !hidden.has(k)).map((k) => W[k]())));
}

function card(title, link, body, w = "w-6") {
  return h("section.card", { class: w },
    h("div.card-head", h("h3", title), link ? h("a.btn.sm.ghost", { href: link }, "Alle", icon("chevronR")) : null),
    h("div.card-body", body));
}
