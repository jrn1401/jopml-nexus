// Öffentliche Statusseite einer Website (#/status/<key>) – nur Erreichbarkeit, keine Besucherdaten. Aktualisiert sich jede Minute.
import { rpc } from "../lib/api.js";
import { h, icon, clear, fmtAgo, fmtDateTime, empty } from "../lib/ui.js";
import { CONFIG } from "../config.js";

export async function renderStatus(root, key) {
  const body = h("main.content", { style: { maxWidth: "760px", margin: "0 auto" } });
  clear(root, h("div.guest-wrap", h("header.guest-top", h("div.brand", h("div.brand-mark", icon("logo")), h("div.brand-text", CONFIG.appName, h("small", "Statusseite")))), body));
  const draw = async () => {
    try {
      const s = await rpc("cc_status_public", { p_key: key });
      const u = s.uptime || {}, last = u.last;
      document.title = `Status: ${s.name}`;
      body.replaceChildren(
        h("div.status-hero", { class: last?.ok === false ? "bad" : "ok" },
          h("span.live-dot", { class: last?.ok === false ? "down" : "on" }),
          h("div", h("h1", s.name), h("p", last ? (last.ok ? "Alle Systeme erreichbar" : `Gerade nicht erreichbar${last.error ? ` (${last.error})` : ""}`) : "Noch keine Prüfung"))),
        h("div.grid.g-3", { style: { margin: "16px 0" } },
          h("div.card.stat", h("div.k", "Uptime 24 Std."), h("div.v", u.pct24 == null ? "–" : `${String(u.pct24).replace(".", ",")} %`)),
          h("div.card.stat", h("div.k", "Uptime 30 Tage"), h("div.v", u.pct30 == null ? "–" : `${String(u.pct30).replace(".", ",")} %`)),
          h("div.card.stat", h("div.k", "Ø Antwortzeit"), h("div.v", u.avg_ms ? `${u.avg_ms} ms` : "–"))),
        h("section.card", h("div.card-head", h("h3", "Letzte 48 Stunden")), h("div.card-body",
          h("div.upbars", (u.bars || []).map((b) => h("i", { class: b.ok + b.bad === 0 ? "none" : b.bad === 0 ? "ok" : b.ok === 0 ? "bad" : "part", title: new Date(b.t).toLocaleString("de-DE") }))),
          h("div.row", { style: { justifyContent: "space-between", fontSize: "12px", marginTop: "6px" } }, h("span.faint", "vor 48 Std."), h("span.faint", "jetzt")))),
        u.incidents?.length ? h("section.card", { style: { marginTop: "16px" } }, h("div.card-head", h("h3", "Letzte Störungen")),
          h("div.card-body", h("div.list", u.incidents.map((x) => h("div.list-item", h("span.dot.bad"), h("div.li-main", h("div.li-title", x.error || `HTTP ${x.status}`), h("div.li-sub", fmtDateTime(x.ts)))))))) : null,
        h("p.faint", { style: { fontSize: "12px", textAlign: "center", marginTop: "18px" } }, `Geprüft alle 5 Minuten${last ? ` · letzte Prüfung ${fmtAgo(last.ts)}` : ""} · `, h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.url?.replace(/^https?:\/\//, ""))));
    } catch {
      body.replaceChildren(empty("lock", "Statusseite nicht verfügbar", "Diese Statusseite gibt es nicht oder sie wurde ausgeschaltet."));
    }
  };
  await draw();
  setInterval(() => document.visibilityState === "visible" && draw(), 60_000);
}
