import { sb, q, rpc } from "../lib/api.js";
import { h, icon, badge, SERVER_STATUS, meter, fmtPct, fmtAgo, fmtDuration, fmtBytes, empty } from "../lib/ui.js";
import { connectServer } from "../lib/actions.js";

export default async function serversView() {
  await rpc("cc_refresh_servers").catch(() => {});
  const [servers, projects] = await Promise.all([
    q(sb.from("cc_servers").select("*").order("name")),
    q(sb.from("cc_projects").select("id,name")),
  ]);
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const online = servers.filter((s) => s.status === "online" || s.status === "warning").length;
  return h("div",
    h("div.page-head", h("div", h("h1", "Server"), h("p", servers.length ? `${online} von ${servers.length} online · Offline-Erkennung nach 3 Minuten ohne Heartbeat` : "Noch keine Server verbunden")),
      h("div.actions", h("button.btn.primary", { onclick: connectServer }, icon("plus"), "Server verbinden"))),
    servers.length ? h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" } }, servers.map((s) => {
      const live = s.status === "online" || s.status === "warning";
      return h("a.card.card-pad", { href: `#/servers/${s.id}`, style: { display: "flex", flexDirection: "column", gap: "14px" } },
        h("div.row.between", h("div.row", { style: { minWidth: 0 } }, h("div.li-icon", icon("server")),
          h("div", { style: { minWidth: 0 } }, h("div.li-title", s.name), h("div.li-sub", s.hostname || "Hostname folgt mit dem ersten Heartbeat"))), badge(SERVER_STATUS, s.status)),
        live || s.cpu_usage !== null ? h("div.stack", { style: { gap: "9px" } }, [["CPU", s.cpu_usage, s.cpu_cores ? `${s.cpu_cores} Kerne` : ""], ["RAM", s.memory_usage, s.memory_total ? fmtBytes(s.memory_total) : ""], ["Speicher", s.disk_usage, s.disk_total ? fmtBytes(s.disk_total) : ""]]
          .map(([k, v, extra]) => h("div", h("div.row.between", { style: { fontSize: "12.5px" } }, h("span.muted", k, extra ? h("span.faint", ` · ${extra}`) : null), h("span", live ? fmtPct(v) : "–")), meter(live ? v : 0))))
          : h("div.na-note", icon("info"), h("div", "Noch keine Daten – Agent installieren, dann erscheinen hier Live-Werte.")),
        h("div.row.between", { style: { fontSize: "12px", color: "var(--text-3)", marginTop: "auto" } },
          h("span", s.last_heartbeat ? `Heartbeat ${fmtAgo(s.last_heartbeat)}` : "Kein Heartbeat"),
          h("span", live && s.uptime_seconds ? `Uptime ${fmtDuration(s.uptime_seconds)}` : s.project_id ? pname[s.project_id] || "" : "")));
    })) : h("div.card", empty("server", "Keine Server verbunden", "„Server verbinden“ legt den Server an und erzeugt einen Agent-Schlüssel. Der Agent (Python) sendet alle 30 s CPU, RAM, Speicher, Netzwerk und Dienste.",
      h("button.btn.primary", { onclick: connectServer }, icon("plus"), "Server verbinden"))));
}
