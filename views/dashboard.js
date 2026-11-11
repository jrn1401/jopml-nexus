import { sb, q, rpc, getSetting } from "../lib/api.js";
import { h, icon, stat, fmtNum, fmtCompact, fmtBytes, fmtPct, fmtAgo, fmtDateTime, badge, SERVER_STATUS, meter, empty, naNote } from "../lib/ui.js";
import { barChart } from "../lib/charts.js";
import { timeline } from "../lib/modules.js";
import { newProject, newModule, uploadDialog, connectServer, newEvent, syncHelp, openAssistant } from "../lib/actions.js";
import { maintenanceBanner } from "./jopml-admin.js";
import { syncCenter } from "../lib/sync.js";
import { viewToggle, charts } from "../lib/viewmode.js";
import { donut, lineChart, PALETTE } from "../lib/charts.js";

export const WIDGETS = {
  health: "Systemzustand", next: "Nächstes Event", tasks: "Offene Aufgaben", stats: "Kennzahlen", servers: "Serverstatus", ai: "KI-Nutzung", activity: "Letzte Aktivitäten",
  jopml: "JOPML", events: "Nächste Events", quick: "Schnellaktionen", web: "Websites live", sync: "Sync-Zentrale",
};

export default async function dashboard({ user }) {
  const [o, layout, servers, events, web] = await Promise.all([
    rpc("cc_overview"),
    getSetting("dashboard", { order: Object.keys(WIDGETS), hidden: [] }),
    q(sb.from("cc_servers").select("id,name,hostname,status,kind,cpu_usage,memory_usage,disk_usage,last_heartbeat,metadata").order("kind").order("name").limit(8)),
    q(sb.from("cc_events").select("id,name,event_date,location,status").gte("event_date", new Date().toISOString()).not("status", "in", "(done,cancelled)").order("event_date").limit(4)),
    rpc("cc_web_overview").catch(() => []),
  ]);
  const hour = new Date().getHours();
  const hello = hour < 5 ? "Gute Nacht" : hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend";
  const name = (user.user_metadata?.full_name || "").split(" ")[0];

  const cfg = o.jopml?.config || {};
  const checks = [
    ["Datenbank", "ok", "verbunden"],
    ["Cloud-Server", !o.cloud ? "idle" : o.cloud.status === "online" ? "ok" : "warn", o.cloud?.last ? `gemessen ${fmtAgo(o.cloud.last)}` : "keine Messung"],
    ["Eigene Server", !o.servers_total || o.servers_total === (o.cloud ? 1 : 0) ? "idle" : o.servers_problem ? "bad" : "ok", o.servers_problem ? `${o.servers_problem} mit Problem` : `${o.servers_online}/${o.servers_total} online`],
    ["JOPML-Launcher", cfg.maintenance ? "warn" : "ok", cfg.maintenance ? "Wartungsmodus aktiv" : `${fmtNum(o.jopml.online_now)} online · ${fmtNum(o.jopml.online_24h)} heute`],
    ["JOPML-KI", cfg.ai_enabled === false ? "warn" : "ok", cfg.ai_enabled === false ? "abgeschaltet" : o.ai_last_use ? `zuletzt ${fmtAgo(o.ai_last_use)}` : "bereit"],
    ["Fehler 24 h", o.jopml.errors_24h > 20 ? "bad" : o.jopml.errors_24h ? "warn" : "ok", `${fmtNum(o.jopml.errors_24h)} · ${fmtNum(o.jopml.tickets_open)} Tickets offen`],
  ];
  const worst = checks.some((c) => c[1] === "bad") ? "bad" : checks.some((c) => c[1] === "warn") ? "warn" : "ok";
  const ne = o.next_event;
  const W = {
    sync: () => card("Sync-Zentrale", "#/settings?tab=integrations", syncCenter(), "w-12"),
    web: () => card("Websites live", "#/web", web.length ? h("div.list", web.slice(0, 6).map((r) => h("a.list-item", { href: r.source === "cc" ? `#/projects/${r.source_id}` : `#/web/${r.id}` },
        h("span.dot", { class: r.up === true ? "ok" : r.up === false ? "bad" : "idle" }),
        h("div.li-main", h("div.li-title", r.name), h("div.li-sub", r.installed ? `heute ${fmtNum(r.today_uv)} Besucher · ${fmtNum(r.today_pv)} Aufrufe${r.ms ? ` · ${r.ms} ms` : ""}` : `Besucherzähler nicht eingebaut${r.ms ? ` · ${r.ms} ms` : ""}`)),
        h("span.row", { style: { gap: "7px" } }, h("span.live-dot", { class: r.live ? "on" : "" }), h("strong", fmtNum(r.live))))))
      : empty("globe", "Noch keine Websites", "Netlify-Websites erscheinen hier automatisch."), "w-5"),
    health: () => card("Systemzustand", "#/system", h("div.stack", { style: { gap: "10px" } },
      h("div.health-head", { class: worst }, h("span.dot.lg"), h("strong", worst === "ok" ? "Alles in Ordnung" : worst === "warn" ? "Kleinere Hinweise" : "Handlungsbedarf")),
      h("div.health-grid", checks.map(([k, st, t]) => h("div.health-item", h("span.dot", { class: st }), h("div", h("div.li-title", k), h("div.li-sub", t)))))), "w-7"),
    next: () => card("Nächstes Event", ne ? `#/events/${ne.id}` : "#/events", ne ? (() => {
      const ms = new Date(ne.date) - Date.now(), d = Math.floor(ms / 86400_000), hh = Math.floor((ms % 86400_000) / 3600_000);
      const pct = ne.tasks_total ? Math.round((ne.tasks_done / ne.tasks_total) * 100) : null;
      return h("a", { href: `#/events/${ne.id}`, style: { display: "block", color: "inherit", textDecoration: "none" } },
        h("div.li-title", { style: { fontSize: "16px" } }, ne.name), h("div.li-sub", [fmtDateTime(ne.date), ne.location].filter(Boolean).join(" · ")),
        h("div.countdown", h("div", h("strong", fmtNum(Math.max(0, d))), h("span", "Tage")), h("div", h("strong", fmtNum(Math.max(0, hh))), h("span", "Std."))),
        pct !== null ? h("div", h("div.row.between", { style: { fontSize: "12.5px" } }, h("span.muted", "Aufgaben erledigt"), h("span", `${ne.tasks_done}/${ne.tasks_total}`)), meter(pct, [101, 101])) : h("div.faint", "Noch keine Aufgaben angelegt."));
    })() : empty("calendar", "Kein anstehendes Event", null, h("button.btn.sm", { onclick: () => newEvent() }, icon("plus"), "Event erstellen")), "w-5"),
    tasks: () => card("Offene Aufgaben", "#/events", o.open_tasks?.length ? h("div.list", o.open_tasks.map((t) => h("a.list-item", { href: `#/events/${t.event_id}` },
      h("div.li-icon", icon(t.kind === "tech" ? "zap" : "check")),
      h("div.li-main", h("div.li-title", t.title), h("div.li-sub", [t.event, t.due ? `fällig ${fmtDateTime(t.due)}` : null].filter(Boolean).join(" · "))),
      t.due && new Date(t.due) < Date.now() ? h("span.badge.b-bad", "überfällig") : null)))
      : empty("check", "Keine offenen Aufgaben", "Aufgaben aus Events erscheinen hier."), "w-12"),
    stats: () => charts() ? chartsRow() : h("div.grid.g-4.w-12",
      stat("Projekte", fmtNum(o.projects_total), { ic: "folder", sub: `${fmtNum(o.projects_active)} aktiv · ${fmtNum(o.modules_active)} Module` }),
      o.servers_total ? stat("Server online", `${o.servers_online}`, { ic: "server", unit: `/ ${o.servers_total}`, sub: o.servers_load?.cpu !== null && o.servers_load?.cpu !== undefined ? `Ø CPU ${fmtPct(o.servers_load.cpu)} · RAM ${fmtPct(o.servers_load.mem)}` : "Keine Live-Werte" })
        : stat("Server", "", { ic: "server", na: "Nicht verbunden", sub: "Server über „Server verbinden“ anlegen" }),
      stat("Tokens heute", fmtCompact(o.ai_tokens_today), { ic: "sparkles", sub: `${fmtNum(o.ai_requests_today)} Anfragen · gemessene Quellen` }),
      stat("Dateien", fmtNum(o.files_count), { ic: "file", sub: `${fmtBytes(o.files_bytes)} belegt (dedupliziert)` })),
    servers: () => card("Serverstatus", "#/servers", servers.length
      ? h("div.list", servers.map((s) => h("a.list-item", { href: `#/servers/${s.id}` },
          h("div.li-icon", icon(s.kind === "cloud" ? "globe" : "server")),
          h("div.li-main", h("div.li-title", s.name), h("div.li-sub", s.kind === "cloud" ? `Cloud · ${s.metadata?.connections ?? "?"} Verbindungen · gemessen ${fmtAgo(s.last_heartbeat)}` : s.last_heartbeat ? `Heartbeat ${fmtAgo(s.last_heartbeat)}` : "Noch kein Heartbeat")),
          s.status === "online" || s.status === "warning" ? h("div", { style: { width: "120px" }, class: "hide-sm" },
            h("div.row.between", { style: { fontSize: "11.5px" } }, h("span.faint", s.kind === "cloud" ? "Last" : "CPU"), h("span", fmtPct(s.cpu_usage))), meter(s.cpu_usage)) : null,
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

  const order = [...new Set(["sync", ...Object.keys(W).filter((k) => !(layout.order || []).includes(k)), ...(layout.order || []).filter((k) => W[k])])];
  const hidden = new Set(layout.hidden || []);
  return h("div",
    maintenanceBanner(cfg),
    h("div.page-head", h("div", h("h1", `${hello}${name ? ", " + name : ""}`), h("p", `${fmtNum(o.projects_total)} Projekte · ${o.servers_online}/${o.servers_total} Server online${o.events_upcoming ? ` · ${o.events_upcoming} Event(s) geplant` : ""} · ${fmtNum(o.notifications_unread)} ungelesene Hinweise`)),
      h("div.actions", viewToggle(), h("a.btn.ghost", { href: "#/settings?tab=dashboard" }, icon("dashboard"), "Anpassen"), h("button.btn.primary", { onclick: () => newProject() }, icon("plus"), "Neues Projekt"))),
    h("div.grid.dash", order.filter((k) => !hidden.has(k)).map((k) => W[k]())));
}

// Diagramm-Ansicht der Kennzahlen: Projekte nach Status/Kategorie, Ticketverkauf je Event, Website-Besucher 7 Tage
function chartsRow() {
  const box = h("div.grid.g-3.w-12", h("div.skel", { style: { height: "220px" } }));
  (async () => {
    const [pr, ev, sites] = await Promise.all([
      q(sb.from("cc_projects").select("status,category")),
      q(sb.from("cc_events").select("id,name,event_date,status,expected_guests,metadata").not("status", "in", "(done,cancelled)").order("event_date").limit(6)),
      rpc("cc_web_overview").catch(() => [])]);
    const count = (arr, k) => Object.entries(arr.reduce((m, x) => ((m[x[k]] = (m[x[k]] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1]);
    const ST = { active: "Aktiv", development: "In Entwicklung", paused: "Pausiert", archived: "Archiviert", error: "Fehler", disconnected: "Getrennt" };
    const web = await Promise.all(sites.slice(0, 3).map((s) => rpc("cc_web_stats", { p_site: s.id, p_days: 7 }).then((st) => ({ s, st })).catch(() => null)));
    const tix = ev.filter((e) => e.metadata?.tickets);
    box.replaceChildren(
      h("section.card", h("div.card-head", h("h3", "Projekte nach Status")), h("div.card-body", donut(count(pr, "status").map(([k, n], i) => ({ name: ST[k] || k, value: n, color: PALETTE[i % 6] })), { size: 120 }))),
      h("section.card", h("div.card-head", h("h3", "Ticketverkauf")), h("div.card-body", tix.length ? h("div.stack", { style: { gap: "12px" } }, tix.map((e) => {
        const t = e.metadata.tickets, cap = t.capacity || e.expected_guests;
        return h("a", { href: `#/events/${e.id}`, style: { color: "inherit", textDecoration: "none" } }, h("div.row.between", { style: { fontSize: "13px" } }, h("span", e.name), h("strong", `${fmtNum(t.sold)}${cap ? ` / ${fmtNum(cap)}` : ""}`)),
          cap ? meter((t.sold / cap) * 100, [101, 101]) : null, h("div.faint", { style: { fontSize: "11.5px", marginTop: "3px" } }, `${(t.revenue ?? 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })} · Stand ${fmtAgo(t.as_of)}`));
      })) : h("div.faint", "Noch keine Ticketdaten."))),
      h("section.card", h("div.card-head", h("h3", "Website-Besucher · 7 Tage")), h("div.card-body", web.filter(Boolean).length
        ? lineChart(web.filter(Boolean).map(({ s, st }, i) => ({ name: s.name, color: PALETTE[i % 6], values: (st.series || []).map((p) => ({ x: new Date(p.t).getTime(), y: p.uv })) })),
          { height: 170, xFmt: (v) => new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), emptyText: "Noch keine Besucher – Besucherzähler unter „Websites“ einbauen." })
        : h("div.faint", "Noch keine Websites."))));
  })().catch(() => box.replaceChildren(h("div.faint", "Diagramme nicht verfügbar.")));
  return box;
}

function card(title, link, body, w = "w-6") {
  return h("section.card", { class: w },
    h("div.card-head", h("h3", title), link ? h("a.btn.sm.ghost", { href: link }, "Alle", icon("chevronR")) : null),
    h("div.card-body", body));
}
