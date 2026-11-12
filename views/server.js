import { sb, q, rpc } from "../lib/api.js";
import { h, icon, badge, SERVER_STATUS, meter, fmtPct, fmtAgo, fmtDuration, fmtBytes, fmtDateTime, empty, naNote, confirmDialog, toast, toastErr, formModal } from "../lib/ui.js";
import { lineChart } from "../lib/charts.js";
import { showAgentInstall } from "../lib/actions.js";
import { METRICS, sampleNow } from "./servers.js";
import { hostingPanel } from "../lib/hosting.js";
import { deviceLive, fileBrowser } from "../lib/devfiles.js";

const RANGES = [["1h", "1 Std."], ["24h", "24 Std."], ["7d", "7 Tage"], ["30d", "30 Tage"]];

export default async function serverView({ args: [id] }) {
  await rpc("cc_refresh_servers").catch(() => {});
  const s = await q(sb.from("cc_servers").select("*").eq("id", id).maybeSingle());
  if (!s) return empty("server", "Server nicht gefunden", null, h("a.btn", { href: "#/servers" }, "Zur Übersicht"));
  const projects = await q(sb.from("cc_projects").select("id,name").order("name"));
  const live = s.status === "online" || s.status === "warning";
  const cloud = s.kind === "cloud";
  let range = "24h";
  const charts = h("div.grid.g-2");
  const seg = h("div.seg", RANGES.map(([k, t]) => h("button", { class: k === range ? "on" : "", onclick: (e) => { range = k; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); draw(); } }, t)));

  async function draw() {
    charts.replaceChildren(h("div.skel.span-2", { style: { height: "240px" } }));
    try {
      const rows = await rpc("cc_server_series", { p_server: id, p_range: range });
      const pts = (k) => rows.map((r) => ({ x: new Date(r.t), y: r[k] }));
      const xFmt = range === "1h" || range === "24h" ? undefined : (v) => new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" });
      // Netzwerk: Zähler → Rate (Bytes/s) aus Differenzen
      const net = (k) => rows.map((r, i) => { if (!i) return null; const dt = (new Date(r.t) - new Date(rows[i - 1].t)) / 1000; const d = r[k] - rows[i - 1][k];
        return dt > 0 && d >= 0 ? { x: new Date(r.t), y: d / dt } : null; }).filter(Boolean);
      const box = (t, el) => h("section.card", h("div.card-head", h("h3", t)), h("div.card-body", el));
      if (cloud) {
        const raw = (k) => rows.map((r) => ({ x: new Date(r.t), y: r[k] }));
        charts.replaceChildren(
          box("Verbindungsauslastung", lineChart([{ name: "Verbindungen", values: pts("cpu") }], { yMax: 100, yFmt: (v) => `${Math.round(v)} %`, xFmt })),
          box("JOPML-Nutzer online", lineChart([{ name: "Online", values: raw("net_out"), color: "var(--chart-3)" }], { yFmt: (v) => String(Math.round(v)), xFmt })),
          box("Datenbankgröße (von 500 MB)", lineChart([{ name: "Belegt", values: pts("disk"), color: "var(--chart-4)" }], { yFmt: (v) => `${v.toFixed(1).replace(".", ",")} %`, xFmt })),
          box("Cache-Fehlquote", lineChart([{ name: "Fehlquote", values: pts("mem"), color: "var(--chart-2)" }], { yFmt: (v) => `${v.toFixed(2).replace(".", ",")} %`, xFmt })));
        return;
      }
      charts.replaceChildren(
        box("CPU", lineChart([{ name: "CPU", values: pts("cpu") }], { yMax: 100, yFmt: (v) => `${Math.round(v)} %`, xFmt })),
        box("Arbeitsspeicher", lineChart([{ name: "RAM", values: pts("mem"), color: "var(--chart-2)" }], { yMax: 100, yFmt: (v) => `${Math.round(v)} %`, xFmt })),
        box("Speicherplatz", lineChart([{ name: "Belegt", values: pts("disk"), color: "var(--chart-4)" }], { yMax: 100, yFmt: (v) => `${Math.round(v)} %`, xFmt })),
        box("Netzwerk", lineChart([{ name: "Eingehend", values: net("net_in"), color: "var(--chart-3)" }, { name: "Ausgehend", values: net("net_out"), color: "var(--chart-5)" }],
          { yFmt: (v) => fmtBytes(v) + "/s", xFmt, area: false })));
    } catch (e) { charts.replaceChildren(naNote(e.message, "alert")); }
  }
  draw();

  const metric = (label, v, extra, ic, th) => h("div.card.stat", h("div.k", icon(ic), label), h("div.v", live ? fmtPct(v) : "–"), meter(live ? v : 0, th), extra ? h("div.d", extra) : null);
  const M = METRICS[cloud ? "cloud" : "agent"];
  const services = Array.isArray(s.services) ? s.services : [];
  return h("div",
    h("div.crumb", h("a", { href: "#/servers" }, "Server"), icon("chevronR", ""), h("span", s.name)),
    h("div.page-head", h("div", h("h1", s.name), h("div.row.wrap", { style: { gap: "8px", marginTop: "8px" } }, badge(SERVER_STATUS, s.status),
      h("span.faint", { style: { fontSize: "12.5px" } }, s.last_heartbeat ? `Letzter Heartbeat ${fmtAgo(s.last_heartbeat)}` : "Noch kein Heartbeat empfangen"))),
      h("div.actions",
        h("button.btn", { onclick: edit }, icon("edit"), "Bearbeiten"),
        cloud ? h("button.btn", { onclick: (e) => sampleNow(e.currentTarget) }, icon("refresh"), "Jetzt messen") : h("button.btn", { onclick: newKey }, icon("key"), "Neuer Agent-Schlüssel"),
        cloud ? null : h("button.btn.danger", { onclick: del }, icon("trash"), "Entfernen"))),
    cloud ? h("div", { style: { marginBottom: "16px" } }, naNote("Cloud-Server: Die Datenbank misst sich selbst alle 5 Minuten (pg_cron) – auch wenn die Website geschlossen ist. CPU/RAM der Supabase-Maschine sind über die API nicht abrufbar; gezeigt werden Verbindungsauslastung, Cache-Fehlquote, Datenbankgröße und JOPML-Nutzer.")) : null,
    s.status === "disconnected" ? h("div", { style: { marginBottom: "16px" } }, naNote("Dieser Server hat noch keine Daten gesendet. Installiere den Agenten mit dem Schlüssel, der beim Anlegen angezeigt wurde – oder erzeuge einen neuen.")) : null,
    h("div.grid.g-4", { style: { marginBottom: "16px" } },
      ...M.map(([k, label, extra, th], i) => metric(label, s[k], extra(s) || null, ["cpu", "layers", "disk"][i], th)),
      h("div.card.stat", h("div.k", icon("clock"), "Uptime"), h("div.v", { style: { fontSize: "20px" } }, live ? fmtDuration(s.uptime_seconds) : "–"), h("div.d", s.os || "Betriebssystem unbekannt"))),
    cloud ? null : h("div.stack", { style: { marginBottom: "16px", gap: "16px" } }, deviceLive(s), fileBrowser(s), hostingPanel(s)),
    h("div.row.between.wrap", { style: { marginBottom: "12px" } }, h("h3", { style: { margin: 0, fontSize: "15px" } }, "Verlauf"), seg),
    charts,
    h("div.grid.g-2", { style: { marginTop: "16px" } },
      cloud ? h("section.card", h("div.card-head", h("h3", "Datenbank")), h("div.card-body", h("dl.kv",
        h("dt", "Verbindungen"), h("dd", `${s.metadata?.connections ?? "–"} / ${s.metadata?.max_connections ?? "–"}`),
        h("dt", "Cache-Trefferquote"), h("dd", s.metadata?.cache_hit != null ? `${String(s.metadata.cache_hit).replace(".", ",")} %` : "–"),
        h("dt", "Größe"), h("dd", s.metadata?.db_bytes ? fmtBytes(s.metadata.db_bytes) : "–"),
        h("dt", "Region"), h("dd", s.metadata?.region || "–"),
        h("dt", "JOPML online / 24 h"), h("dd", `${s.metadata?.jopml_online ?? "–"} / ${s.metadata?.jopml_online_24h ?? "–"}`)))) :
      h("section.card", h("div.card-head", h("h3", "Dienste"), h("span.sub", "vom Agenten gemeldet")), h("div.card-body",
        services.length ? h("div.list", services.map((x) => h("div.list-item", h("div.li-main", h("div.li-title.mono", x.name)),
          h("span.badge", { class: /^(running|active|up)$/i.test(x.status) ? "b-ok" : /fail|dead|stop|exited/i.test(x.status) ? "b-bad" : "b-idle" }, x.status || "?"))))
          : h("div.faint", "Keine Dienste gemeldet. In der Agent-Konfiguration CC_SERVICES setzen (z. B. nginx,postgresql)."))),
      h("section.card", h("div.card-head", h("h3", "Details")), h("div.card-body", h("dl.kv",
        h("dt", "Hostname"), h("dd", s.hostname || "–"), h("dt", "Betriebssystem"), h("dd", s.os || "–"),
        h("dt", "Projekt"), h("dd", projects.find((p) => p.id === s.project_id)?.name || "–"),
        h("dt", "Registriert"), h("dd", fmtDateTime(s.created_at)), h("dt", "Server-ID"), h("dd.mono", s.id))))));

  function edit() {
    formModal("Server bearbeiten", [
      { name: "name", label: "Name", value: s.name, required: true, max: 80 },
      { name: "project_id", label: "Projekt", type: "select", value: s.project_id || "", options: [["", "– keins –"], ...projects.map((p) => [p.id, p.name])] },
    ], async (v) => { await q(sb.from("cc_servers").update({ name: v.name, project_id: v.project_id || null }).eq("id", id)); toast("Gespeichert"); dispatchEvent(new Event("hashchange")); });
  }
  async function newKey() {
    if (!(await confirmDialog("Neuen Agent-Schlüssel erzeugen?", "Bestehende Schlüssel dieses Servers werden widerrufen. Der Agent muss danach mit dem neuen Schlüssel neu gestartet werden.", { ok: "Erzeugen", danger: false }))) return;
    try {
      const keys = await rpc("cc_list_api_keys");
      for (const k of keys.filter((k) => k.server_id === id && !k.revoked_at)) await rpc("cc_revoke_api_key", { p_id: k.id });
      const tok = await rpc("cc_create_api_key", { p_name: `Agent: ${s.name}`.slice(0, 60), p_scopes: ["agent"], p_server: id });
      showAgentInstall(id, tok, s.name);
    } catch (e) { toastErr(e); }
  }
  async function del() {
    if (!(await confirmDialog("Server entfernen?", `„${s.name}“ wird mit allen Messwerten und Agent-Schlüsseln dauerhaft gelöscht.`, { ok: "Endgültig entfernen" }))) return;
    try { await q(sb.from("cc_servers").delete().eq("id", id)); await sb.from("cc_activities").insert({ kind: "server_removed", description: `Server entfernt: ${s.name}`, status: "warning" }); toast("Server entfernt"); location.hash = "#/servers"; }
    catch (e) { toastErr(e); }
  }
}
