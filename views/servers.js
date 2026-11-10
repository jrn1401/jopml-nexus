import { sb, q, rpc } from "../lib/api.js";
import { h, icon, badge, SERVER_STATUS, meter, fmtPct, fmtAgo, fmtDuration, fmtBytes, fmtNum, empty, toast, toastErr } from "../lib/ui.js";
import { connectServer } from "../lib/actions.js";

// Kennzahlen je Server-Art: Cloud (Supabase, serverseitig gemessen) oder Agent (eigener Rechner)
export const METRICS = {
  cloud: [["cpu_usage", "Verbindungen", (s) => `${fmtNum(s.metadata?.connections)} / ${fmtNum(s.metadata?.max_connections)}`, [70, 90]],
          ["memory_usage", "Cache-Fehlquote", (s) => s.metadata?.cache_hit != null ? `Trefferquote ${String(s.metadata.cache_hit).replace(".", ",")} %` : "", [5, 15]],
          ["disk_usage", "Datenbank", (s) => s.metadata?.db_bytes ? `${fmtBytes(s.metadata.db_bytes)} von 500 MB` : "", [70, 90]]],
  agent: [["cpu_usage", "CPU", (s) => s.cpu_cores ? `${s.cpu_cores} Kerne` : "", [70, 90]],
          ["memory_usage", "RAM", (s) => s.memory_total ? fmtBytes(s.memory_total) : "", [70, 90]],
          ["disk_usage", "Speicher", (s) => s.disk_total ? fmtBytes(s.disk_total) : "", [80, 92]]],
};

export async function sampleNow(btn) {
  if (btn) btn.disabled = true;
  try { await rpc("cc_sample_now"); toast("Neu gemessen"); dispatchEvent(new Event("hashchange")); }
  catch (e) { toastErr(e); } finally { if (btn) btn.disabled = false; }
}

export default async function serversView() {
  await rpc("cc_refresh_servers").catch(() => {});
  const [servers, projects] = await Promise.all([
    q(sb.from("cc_servers").select("*").order("kind").order("name")),
    q(sb.from("cc_projects").select("id,name")),
  ]);
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const online = servers.filter((s) => s.status === "online").length;
  const problems = servers.filter((s) => ["offline", "error", "warning"].includes(s.status));
  const agents = servers.filter((s) => s.kind !== "cloud");
  const measureBtn = h("button.btn", { onclick: () => sampleNow(measureBtn) }, icon("refresh"), "Jetzt messen");

  const serverCard = (s) => {
    const live = s.status === "online" || s.status === "warning";
    const cloud = s.kind === "cloud";
    return h("a.card.card-pad", { href: `#/servers/${s.id}`, class: problems.includes(s) ? "card-alert" : "", style: { display: "flex", flexDirection: "column", gap: "14px" } },
      h("div.row.between", h("div.row", { style: { minWidth: 0 } }, h("div.li-icon", icon(cloud ? "globe" : "server")),
        h("div", { style: { minWidth: 0 } }, h("div.li-title", s.name), h("div.li-sub", cloud ? "Cloud · alle 5 Min. automatisch gemessen" : s.hostname || "Hostname folgt mit dem ersten Heartbeat"))), badge(SERVER_STATUS, s.status)),
      live || s.cpu_usage !== null ? h("div.stack", { style: { gap: "9px" } }, METRICS[cloud ? "cloud" : "agent"].map(([k, label, extra, th]) =>
        h("div", h("div.row.between", { style: { fontSize: "12.5px" } }, h("span.muted", label, extra(s) ? h("span.faint", ` · ${extra(s)}`) : null), h("span", live ? fmtPct(s[k]) : "–")), meter(live ? s[k] : 0, th))))
        : h("div.na-note", icon("info"), h("div", "Noch keine Daten – Agent installieren, dann erscheinen hier Live-Werte.")),
      cloud && s.metadata ? h("div.row.wrap", { style: { gap: "6px" } }, h("span.tag", `${fmtNum(s.metadata.jopml_online)} JOPML-Nutzer online`), h("span.tag", `${fmtNum(s.metadata.jopml_online_24h)} in 24 h`)) : null,
      h("div.row.between", { style: { fontSize: "12px", color: "var(--text-3)", marginTop: "auto" } },
        h("span", s.last_heartbeat ? `${cloud ? "Gemessen" : "Heartbeat"} ${fmtAgo(s.last_heartbeat)}` : "Kein Heartbeat"),
        h("span", live && s.uptime_seconds ? `Uptime ${fmtDuration(s.uptime_seconds)}` : s.project_id ? pname[s.project_id] || "" : "")));
  };

  return h("div",
    h("div.page-head", h("div", h("h1", "Server"), h("p", `${online} von ${servers.length} online${problems.length ? ` · ${problems.length} mit Problem` : ""} · Agent-Server gelten nach 3 Min. ohne Heartbeat als offline`)),
      h("div.actions", measureBtn, h("button.btn.primary", { onclick: connectServer }, icon("plus"), "Server verbinden"))),
    problems.length ? h("div.banner.bad", icon("alert"), h("div", h("strong", "Achtung: "), problems.map((s) => `${s.name} (${SERVER_STATUS[s.status]?.[0] || s.status})`).join(", "))) : null,
    h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 320px), 1fr))" } }, servers.map(serverCard),
      agents.length ? null : h("div.card.card-pad", { style: { display: "flex", flexDirection: "column", gap: "10px", justifyContent: "center" } },
        h("div.row", h("div.li-icon", icon("server")), h("div.li-title", "Eigenen Rechner/Server überwachen")),
        h("div.faint", { style: { fontSize: "13px" } }, "„Server verbinden“ erzeugt einen Schlüssel und zeigt einen Befehl für Windows (PowerShell) oder Linux. Der Agent sendet alle 30 s CPU, RAM, Speicher und Netzwerk."),
        h("button.btn", { onclick: connectServer, style: { alignSelf: "flex-start" } }, icon("plus"), "Server verbinden"))),
    servers.length ? null : h("div.card", empty("server", "Keine Server", null, h("button.btn.primary", { onclick: connectServer }, icon("plus"), "Server verbinden"))));
}
