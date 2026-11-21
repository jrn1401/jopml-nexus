// Fehlerzentrale – Meldeseite: Fehler aus Website und Handy-App gesammelt an den Admin melden.
// Ohne Abhängigkeiten (ui.js nutzt es), die Sendefunktion wird beim Start gesetzt. Pro Sitzung höchstens 25 Meldungen,
// gleiche Meldung nur einmal; Netz-, Rechte- und Limit-Hinweise sind keine Fehler und werden nicht gemeldet.
let sink = null, source = "web", sent = 0;
const seen = new Set();
const VERSION = () => { try { return document.documentElement.dataset.ver || null; } catch { return null; } };
const QUIET = /(Failed to fetch|NetworkError|Load failed|Keine Verbindung|Keine Berechtigung|Tageslimit|Gast-Limit|Bitte anmelden|Nicht angemeldet|abgebrochen|AbortError|ResizeObserver loop|Script error\.?$)/i;

export function reportError(e, extra = {}) {
  try {
    if (!sink || sent >= 25) return;
    const message = String(e?.message || e || "").replace(/^Error:\s*/, "").slice(0, 600);
    if (message.length < 3 || QUIET.test(message)) return;
    const key = message.slice(0, 160);
    if (seen.has(key)) return;
    seen.add(key); sent++;
    sink({ source, message, stack: String(e?.stack || "").slice(0, 3000), route: (location.hash || location.pathname).slice(0, 200),
      ua: navigator.userAgent.slice(0, 200), screen: `${window.innerWidth}x${window.innerHeight}`, version: VERSION(), kind: extra.kind || "error", status: extra.status ? String(extra.status) : undefined })
      ?.catch?.(() => {});
  } catch { /* Melden darf nie selbst einen Fehler werfen */ }
}

// Einmal beim Start aufrufen: src = "web" | "mobile", send = (p) => rpc("nx_log_error", { p })
export function installErrorLog(src, send) {
  source = src; sink = send;
  window.addEventListener("error", (ev) => { if (ev?.error || ev?.message) reportError(ev.error || ev.message, { kind: "js" }); });
  window.addEventListener("unhandledrejection", (ev) => reportError(ev?.reason, { kind: "promise" }));
}
