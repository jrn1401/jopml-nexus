// UI-Hilfen: DOM-Builder (XSS-sicher, nur textContent), Icons, Formatierung, Toasts, Modals.

const P = {
  dashboard: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5H9l2 2.5h7.5A2.5 2.5 0 0 1 21 10v7.5a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  server: '<rect x="3" y="4" width="18" height="7" rx="2"/><rect x="3" y="13" width="18" height="7" rx="2"/><path d="M7 7.5h.01M7 16.5h.01"/>',
  sparkles: '<path d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M16 3v4M8 3v4M3 10h18"/>',
  layers: '<path d="M12 3 2 8l10 5 10-5z"/><path d="m2 13 10 5 10-5"/>',
  file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/>',
  activity: '<path d="M22 12h-4l-3 8L9 4l-3 8H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  bell: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  zap: '<path d="M13 2 3 14h9l-1 8 10-12h-9z"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  chevronR: '<path d="m9 18 6-6-6-6"/>', chevronL: '<path d="m15 18-6-6 6-6"/>', chevronD: '<path d="m6 9 6 6 6-6"/>',
  sidebar: '<rect x="3" y="3" width="18" height="18" rx="2.5"/><path d="M9 3v18"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
  trash: '<path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  edit: '<path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  refresh: '<path d="M21 12a9 9 0 0 1-15.5 6.2L3 16M3 12A9 9 0 0 1 18.5 5.8L21 8M21 3v5h-5M3 21v-5h5"/>',
  check: '<path d="M20 6 9 17l-5-5"/>', alert: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>', link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  cpu: '<rect x="5" y="5" width="14" height="14" rx="2"/><rect x="9" y="9" width="6" height="6"/><path d="M9 2v3M15 2v3M9 19v3M15 19v3M2 9h3M2 15h3M19 9h3M19 15h3"/>',
  disk: '<path d="M22 12H2M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.8 4H7.2a2 2 0 0 0-1.7 1.1zM6 16h.01M10 16h.01"/>',
  game: '<path d="M6 11h4M8 9v4M15 12h.01M18 10h.01"/><rect x="2" y="6" width="20" height="12" rx="6"/>',
  code: '<path d="m16 18 6-6-6-6M8 6l-6 6 6 6"/>', mail: '<rect x="2" y="4" width="20" height="16" rx="2.5"/><path d="m22 7-10 6L2 7"/>',
  bot: '<rect x="4" y="8" width="16" height="12" rx="3"/><path d="M12 8V4M8 4h8M9 13h.01M15 13h.01M2 14v2M22 14v2"/>',
  external: '<path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><path d="M21 11h-5a2 2 0 0 0 0 4h5z"/>',
  ticket: '<path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M13 6v2M13 11v2M13 16v2"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  key: '<circle cx="7.5" cy="15.5" r="4.5"/><path d="m10.7 12.3 9.8-9.8M17 6l3 3M14 9l2 2"/>', copy: '<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>', grip: '<circle cx="9" cy="6" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="18" r="1"/>',
  lock: '<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="2"/>', rocket: '<path d="M5 15c-1.5 1.3-2 5-2 5s3.7-.5 5-2c.7-.8.7-2.1-.1-2.9a2.1 2.1 0 0 0-2.9-.1z"/><path d="M12 15l-3-3a22 22 0 0 1 2-4A12.9 12.9 0 0 1 22 2c0 2.7-.8 7.5-6 11a22.4 22.4 0 0 1-4 2z"/><path d="M9 12H4s.6-3 2-4c1.6-1.1 5 0 5 0M12 15v5s3-.6 4-2c1.1-1.6 0-5 0-5"/>',
  terminal: '<path d="m4 17 6-6-6-6M12 19h8"/>', eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M9.9 4.2A9.6 9.6 0 0 1 12 4c6.5 0 10 7 10 7a17 17 0 0 1-2.2 3.2M6.6 6.6A17 17 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 5.4-1.6M2 2l20 20M14.1 14.1a3 3 0 0 1-4.2-4.2"/>',
  book: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  heart: '<path d="M19 14c1.5-1.5 3-3.2 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.8 0-3 .5-4.5 2-1.5-1.5-2.7-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4 3 5.5l7 7z"/>',
  thumbUp: '<path d="M7 10v11"/><path d="M15 5.9 14 10h5.8a2 2 0 0 1 2 2.4l-1.4 7A2 2 0 0 1 18.4 21H7V10l4-8a3 3 0 0 1 4 3.9z"/>',
  thumbDown: '<path d="M17 14V3"/><path d="M9 18.1 10 14H4.2a2 2 0 0 1-2-2.4l1.4-7A2 2 0 0 1 5.6 3H17v11l-4 8a3 3 0 0 1-4-3.9z"/>',
  send: '<path d="m22 2-7 20-4-9-9-4z"/><path d="M22 2 11 13"/>', box: '<path d="M21 8 12 3 3 8v8l9 5 9-5z"/><path d="m3 8 9 5 9-5M12 13v8"/>',
  wifi: '<path d="M5 12.6a10 10 0 0 1 14 0M8.5 16.1a5 5 0 0 1 7 0M2 8.8a15 15 0 0 1 20 0M12 20h.01"/>', more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  note: '<path d="M4 4h16v12l-4 4H4z"/><path d="M16 20v-4h4M8 9h8M8 13h5"/>', chart: '<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-7"/>',
  logo: '<path d="M4 7.5 12 3l8 4.5v9L12 21l-8-4.5z" fill="none"/><path d="m4 7.5 8 4.5 8-4.5M12 12v9"/>',
};
export function icon(name, cls = "") {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("fill", "none"); s.setAttribute("stroke", "currentColor");
  s.setAttribute("stroke-width", "1.8"); s.setAttribute("stroke-linecap", "round"); s.setAttribute("stroke-linejoin", "round");
  s.setAttribute("aria-hidden", "true"); s.setAttribute("width", "16"); s.setAttribute("height", "16"); if (cls) s.setAttribute("class", cls);
  s.innerHTML = P[name] || P.box;   // nur feste, eigene Pfade – nie Nutzerdaten
  return s;
}

// h("div.card.pad", { onclick, style, ... }, ...children) – Kinder: Node | string | number | Array | null
export function h(sel, props, ...kids) {
  if (props instanceof Node || typeof props === "string" || Array.isArray(props) || typeof props === "number") { kids.unshift(props); props = null; }
  const [tag, ...cls] = sel.split(".");
  const el = document.createElement(tag || "div");
  if (cls.length) el.className = cls.join(" ");
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === "class") el.className = (el.className ? el.className + " " : "") + v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : String(v));
  }
  append(el, kids);
  return el;
}
function append(el, kids) {
  for (const c of kids.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
}
export const clear = (el, ...kids) => { el.replaceChildren(); append(el, kids); return el; };

// ---------- Formatierung ----------
const nf = new Intl.NumberFormat("de-DE");
export const fmtNum = (n) => (n === null || n === undefined || isNaN(n) ? "–" : nf.format(Math.round(n)));
export function fmtCompact(n) {
  if (n === null || n === undefined || isNaN(n)) return "–";
  const a = Math.abs(n);
  if (a >= 1e9) return (n / 1e9).toFixed(1).replace(".", ",") + " Mrd.";
  if (a >= 1e6) return (n / 1e6).toFixed(1).replace(".", ",") + " Mio.";
  if (a >= 1e4) return (n / 1e3).toFixed(1).replace(".", ",") + " Tsd.";
  return nf.format(Math.round(n));
}
export function fmtBytes(b) {
  if (b === null || b === undefined || isNaN(b)) return "–";
  const u = ["B", "KB", "MB", "GB", "TB"]; let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(b < 10 && i > 0 ? 1 : 0).replace(".", ",")} ${u[i]}`;
}
export const fmtPct = (n) => (n === null || n === undefined || isNaN(n) ? "–" : `${Number(n).toFixed(n < 10 ? 1 : 0).replace(".", ",")} %`);
export const fmtEUR = (n) => (n === null || n === undefined || isNaN(n) ? "–" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(n));
export const fmtUSD = (n) => (n === null || n === undefined || isNaN(n) ? "–" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "USD", maximumFractionDigits: 4 }).format(n));
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric" }) : "–");
export const fmtDateTime = (d) => (d ? new Date(d).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "–");
export function fmtAgo(d) {
  if (!d) return "nie";
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 0) { const f = -s; if (f < 3600) return `in ${Math.ceil(f / 60)} Min.`; if (f < 86400) return `in ${Math.round(f / 3600)} Std.`; return `in ${Math.round(f / 86400)} Tagen`; }
  if (s < 45) return "gerade eben"; if (s < 3600) return `vor ${Math.round(s / 60)} Min.`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} Std.`; if (s < 86400 * 30) return `vor ${Math.round(s / 86400)} Tagen`;
  return fmtDate(d);
}
export function fmtDuration(sec) {
  if (sec === null || sec === undefined) return "–";
  const d = Math.floor(sec / 86400), hh = Math.floor((sec % 86400) / 3600), m = Math.floor((sec % 3600) / 60);
  return d ? `${d} T ${hh} Std.` : hh ? `${hh} Std. ${m} Min.` : `${m} Min.`;
}

// ---------- Status & Kategorien ----------
export const PROJECT_STATUS = { active: ["Aktiv", "b-ok"], development: ["In Entwicklung", "b-pri"], paused: ["Pausiert", "b-warn"], archived: ["Archiviert", "b-idle"], error: ["Fehler", "b-bad"], disconnected: ["Nicht verbunden", "b-idle"] };
export const SERVER_STATUS = { online: ["Online", "b-ok"], offline: ["Offline", "b-bad"], warning: ["Warnung", "b-warn"], error: ["Fehler", "b-bad"], disconnected: ["Nicht verbunden", "b-idle"] };
export const EVENT_STATUS = { idea: ["Idee", "b-idle"], planning: ["In Planung", "b-pri"], confirmed: ["Bestätigt", "b-ok"], done: ["Abgeschlossen", "b-acc"], cancelled: ["Abgesagt", "b-bad"] };
export const CATEGORIES = {
  claude: ["Claude", "sparkles", "var(--primary)"], software: ["Software", "box", "var(--accent)"], code: ["Code", "code", "var(--chart-3)"],
  server: ["Server", "server", "var(--chart-4)"], roblox: ["Roblox", "game", "var(--chart-5)"], event: ["Event", "calendar", "var(--chart-4)"],
  ai: ["KI", "bot", "var(--primary)"], jopml: ["JOPML", "layers", "var(--accent)"], email: ["E-Mail", "mail", "var(--chart-6)"], website: ["Website", "globe", "var(--chart-3)"],
  school: ["Schule & Lernen", "book", "var(--chart-2)"], personal: ["Privat", "heart", "var(--chart-5)"], business: ["Business", "chart", "var(--chart-1)"], other: ["Sonstiges", "folder", "var(--chart-6)"],
};
export function badge(map, key) { const [t, c] = map[key] || [key || "–", "b-idle"]; return h("span.badge", { class: c }, t); }
export function catIcon(cat, size = 38) {
  const [, ic, col] = CATEGORIES[cat] || CATEGORIES.other;
  return h("div.cat-icon", { style: { background: `color-mix(in srgb, ${col} 15%, transparent)`, color: col, width: size + "px", height: size + "px" } }, icon(ic));
}

// ---------- Rückmeldungen ----------
let toastBox;
export function toast(msg, kind = "ok", ms = 3800) {
  toastBox ??= document.body.appendChild(h("div.toasts", { role: "status", "aria-live": "polite" }));
  const t = h("div.toast", { class: kind }, icon(kind === "err" ? "alert" : kind === "info" ? "info" : "check"), h("span", msg));
  toastBox.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
export const toastErr = (e) => toast(errMsg(e), "err", 6000);
export function errMsg(e) {
  const m = e?.message || String(e);
  if (/forbidden|not allowed|permission denied|row-level security/i.test(m)) return "Keine Berechtigung für diese Aktion.";
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return "Keine Verbindung – bitte Internet prüfen.";
  return m.replace(/^Error:\s*/, "");
}

export function modal(title, body, { foot, wide, onClose } = {}) {
  const close = () => { ov.remove(); document.removeEventListener("keydown", esc); onClose?.(); };
  const esc = (e) => { if (e.key === "Escape") close(); };
  const ov = h("div.overlay", { onmousedown: (e) => { if (e.target === ov) close(); } },
    h("div.modal", { class: wide ? "wide" : "", role: "dialog", "aria-modal": "true", "aria-label": title },
      h("div.modal-head", h("h3", title), h("button.icon-btn", { onclick: close, "aria-label": "Schließen" }, icon("x"))),
      h("div.modal-body", body), foot ? h("div.modal-foot", foot) : null));
  document.addEventListener("keydown", esc);
  document.body.appendChild(ov);
  setTimeout(() => ov.querySelector("input:not([type=checkbox]):not([type=hidden]),textarea,select")?.focus(), 30);
  return { close, el: ov };
}
export function confirmDialog(title, text, { danger = true, ok = "Bestätigen" } = {}) {
  return new Promise((res) => {
    let done = false;
    const m = modal(title, h("p.muted", { style: { margin: 0 } }, text), {
      onClose: () => { if (!done) res(false); },
      foot: [h("button.btn.ghost", { onclick: () => m.close() }, "Abbrechen"),
        h("button.btn", { class: danger ? "danger" : "primary", onclick: () => { done = true; m.close(); res(true); } }, ok)],
    });
  });
}

// Formular aus Felddefinitionen: [{name,label,type,options,value,required,hint,full}]
export function formModal(title, fields, onSubmit, { submit = "Speichern", wide } = {}) {
  const inputs = {};
  const mk = (f) => {
    let inp;
    if (f.type === "select") inp = h("select.input", { name: f.name }, f.options.map(([v, t]) => h("option", { value: v, selected: String(f.value ?? "") === String(v) }, t)));
    else if (f.type === "textarea") inp = h("textarea.input", { name: f.name, rows: f.rows || 4, maxlength: f.max || 4000 }, f.value ?? "");
    else if (f.type === "checkbox") inp = h("input", { type: "checkbox", name: f.name, checked: !!f.value });
    else inp = h("input.input", { name: f.name, type: f.type || "text", value: f.value ?? "", required: !!f.required, placeholder: f.placeholder || "", maxlength: f.max || 200, step: f.step, min: f.min });
    inputs[f.name] = inp;
    if (f.type === "checkbox") return h("label.check", inp, f.label);
    return h("div.field", { style: f.full ? { gridColumn: "1 / -1" } : null }, h("label", f.label + (f.required ? " *" : "")), inp, f.hint ? h("div.hint", f.hint) : null);
  };
  const rows = []; let pair = [];
  for (const f of fields) {
    if (f.half) { pair.push(mk(f)); if (pair.length === 2) { rows.push(h("div.two", pair)); pair = []; } }
    else { if (pair.length) { rows.push(h("div.two", pair)); pair = []; } rows.push(mk(f)); }
  }
  if (pair.length) rows.push(h("div.two", pair));
  const err = h("div.login-err.hidden");
  const btn = h("button.btn.primary", { type: "submit" }, submit);
  const form = h("form.form", { onsubmit: async (e) => {
    e.preventDefault();
    const vals = {};
    for (const [k, el] of Object.entries(inputs)) vals[k] = el.type === "checkbox" ? el.checked : el.value.trim();
    btn.disabled = true; err.classList.add("hidden");
    try { await onSubmit(vals); m.close(); }
    catch (ex) { err.textContent = errMsg(ex); err.classList.remove("hidden"); }
    finally { btn.disabled = false; }
  } }, rows, err, h("div.row", { style: { justifyContent: "flex-end", marginTop: "4px" } }, h("button.btn.ghost", { type: "button", onclick: () => m.close() }, "Abbrechen"), btn));
  const m = modal(title, form, { wide });
  return m;
}

export function empty(ic, title, sub, action) {
  return h("div.empty", icon(ic), h("div.t", title), sub ? h("div.s", sub) : null, action || null);
}
export function naNote(text, ic = "info") { return h("div.na-note", icon(ic), h("div", text)); }
export function skeleton(hgt = 120) { return h("div.skel", { style: { height: hgt + "px" } }); }
export function meter(pct, thresholds = [70, 90]) {
  const v = Math.max(0, Math.min(100, Number(pct) || 0));
  return h("div.meter", { class: pct === null || pct === undefined ? "" : v >= thresholds[1] ? "bad" : v >= thresholds[0] ? "warn" : "ok" }, h("i", { style: { width: v + "%" } }));
}
export function stat(label, value, { ic, sub, unit, na } = {}) {
  return h("div.card.stat", { class: na ? "na" : "" }, h("div.k", ic ? icon(ic) : null, label),
    h("div.v", na ? na : value, !na && unit ? h("small", unit) : null), sub ? h("div.d", sub) : null);
}

// Minimales, sicheres Markdown (escaped, nur Überschriften/Listen/Code/Fett)
export function md(text) {
  const root = h("div.md"); let ul = null;
  for (const raw of String(text || "").split("\n")) {
    const line = raw.trimEnd();
    if (/^\s*[-*]\s+/.test(line)) { ul ??= root.appendChild(h("ul")); ul.appendChild(inline(h("li"), line.replace(/^\s*[-*]\s+/, ""))); continue; }
    ul = null;
    if (!line.trim()) continue;
    if (/^#{1,4}\s/.test(line)) root.appendChild(inline(h("h4"), line.replace(/^#+\s/, "")));
    else root.appendChild(inline(h("p"), line));
  }
  return root;
}
function inline(el, s) {
  for (const part of s.split(/(`[^`]+`|\*\*[^*]+\*\*)/g)) {
    if (!part) continue;
    if (part.startsWith("`")) el.appendChild(h("code", part.slice(1, -1)));
    else if (part.startsWith("**")) el.appendChild(h("strong", part.slice(2, -2)));
    else el.appendChild(document.createTextNode(part));
  }
  return el;
}

export function copyText(t) { navigator.clipboard?.writeText(t).then(() => toast("Kopiert"), () => toast("Kopieren nicht möglich", "err")); }
export const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
