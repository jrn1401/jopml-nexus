// Sync-Zentrale: alle Quellen auf einen Blick (Netlify, Eventfrog, Websites, Verbindungen) + „Alles jetzt abrufen“.
// Gleiche Daten wie der Claude-Skill „nexus-sync“ (cc_sync_report) – Website und Claude zeigen denselben Stand.
import { rpc } from "./api.js";
import { h, icon, fmtAgo, fmtNum, fmtEUR, fmtDateTime, toast, toastErr } from "./ui.js";

const SRC = { netlify: ["Netlify", "globe"], eventfrog: ["Eventfrog", "ticket"], websites: ["Websites", "activity"], verbindungen: ["Verbindungen", "link"] };
const BY = { claude: "Claude", website: "Website", auto: "Automatik" };

export function syncCenter() {
  const box = h("div.sync-center", h("div.skel", { style: { height: "120px" } }));
  let polling = null;
  async function draw() {
    let r;
    try { r = await rpc("cc_sync_report"); } catch (e) { box.replaceChildren(h("div.faint", e.message)); return; }
    const integ = Object.fromEntries((r.integrations || []).map((i) => [i.kind, i]));
    const run = r.last_run;
    const st = Object.fromEntries((run?.sources || []).map((s) => [s.source, s]));
    const running = (run?.sources || []).some((s) => s.state === "läuft") && Date.now() - Date.parse(run.started_at) < 180_000;
    const dot = (s) => h("span.dot", { class: s === "ok" ? "ok" : s === "fehler" ? "bad" : s === "läuft" ? "warn" : "idle" });
    const ev = r.events?.find((e) => e.eventfrog) || r.events?.[0];
    const sites = r.websites || [];
    const live = sites.reduce((a, s) => a + (s.live || 0), 0);
    const tiles = [
      ["netlify", `${r.netlify.length} Website(s)`, r.netlify.some((n) => n.deploy === "error") ? "Deploy-Fehler" : r.netlify[0] ? `letzter Deploy ${fmtAgo(r.netlify[0].last_deploy)}` : "–", integ.netlify?.last_sync],
      ["eventfrog", ev ? `${fmtNum(ev.sold ?? 0)}${ev.capacity ? ` / ${fmtNum(ev.capacity)}` : ""} Tickets` : "kein Event", ev ? `${ev.name} · ${fmtEUR(ev.revenue ?? 0)}${ev.sold_24h ? ` · +${ev.sold_24h} in 24 Std.` : ""}` : "–", integ.eventfrog?.last_sync],
      ["websites", `${live} live · ${sites.filter((s) => s.up === true).length}/${sites.length} erreichbar`, sites[0] ? sites.map((s) => `${s.name} ${s.ms ?? "–"} ms${s.tracker ? ` · heute ${s.today_visitors} Besucher` : ""}`).join(" · ") : "–", sites[0]?.checked_at],
      ["verbindungen", `${r.connections.length} verbunden`, r.connections.filter((c) => c.status === "error").length ? `${r.connections.filter((c) => c.status === "error").length} mit Fehler` : r.connections.length ? r.connections.map((c) => c.provider).join(", ") : "über „Verbinden“ oder den KI-Chat hinzufügen", r.connections.map((c) => c.last_sync).filter(Boolean).sort().pop()],
    ];
    box.replaceChildren(
      h("div.row.wrap", { style: { justifyContent: "space-between", gap: "10px", marginBottom: "12px" } },
        h("div.faint", { style: { fontSize: "12.5px" } }, run ? `Letzter Abruf: ${fmtDateTime(run.started_at)} durch ${BY[run.by] ?? run.by}${running ? " – läuft noch …" : ""}` : "Noch kein manueller Abruf",
          " · automatisch: Eventfrog alle 10 Min., Websites alle 5 Min., Netlify stündlich"),
        h("button.btn.sm.primary", { disabled: running, onclick: async (e) => {
          e.currentTarget.disabled = true;
          try { await rpc("cc_sync_now", { p_by: "website" }); toast("Abruf gestartet – Ergebnis in wenigen Sekunden"); startPoll(); } catch (er) { toastErr(er); e.currentTarget.disabled = false; }
        } }, icon("refresh"), running ? "Läuft …" : "Alles jetzt abrufen")),
      h("div.sync-grid", tiles.map(([k, main, sub, at]) => h("div.sync-tile",
        h("div.row", { style: { gap: "8px" } }, dot(st[k]?.state ?? (integ[k]?.status === "error" ? "fehler" : at ? "ok" : "idle")), icon(SRC[k][1]), h("strong", SRC[k][0]),
          h("span.faint", { style: { marginLeft: "auto", fontSize: "11.5px" } }, at ? fmtAgo(at) : "")),
        h("div.sync-main", main), h("div.sync-sub", sub),
        st[k]?.state === "fehler" || integ[k]?.last_error ? h("div.sync-err", st[k]?.error || integ[k]?.last_error || `HTTP ${st[k]?.status}`) : null))),
      r.recent?.length ? h("details.sync-log", h("summary", "Verlauf der letzten Abrufe"), h("div.list", r.recent.map((a) => h("div.list-item",
        h("span.dot", { class: a.status === "ok" ? "ok" : a.status === "warning" ? "warn" : "bad" }), h("div.li-main", h("div.li-title", a.description), h("div.li-sub", fmtDateTime(a.created_at))))))) : null);
    if (!running && polling) { clearInterval(polling); polling = null; }
  }
  function startPoll() { if (polling) clearInterval(polling); polling = setInterval(() => { if (!box.isConnected) { clearInterval(polling); polling = null; return; } draw(); }, 4000); setTimeout(draw, 1500); }
  draw().then(() => { if (box.querySelector(".btn[disabled]")) startPoll(); });
  return box;
}
