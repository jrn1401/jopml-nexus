// Lernatlas: ein Thema als Arbeitsheft – Register links, rechts immer ein Kapitel (Aufbau wie die Vorlage
// „Lernatlas Funktionsuntersuchung“). Inhalte kommen vom Skill „schule-sync“ als JSON; Kapiteltext ist
// eingeschränktes HTML, das hier gegen eine feste Liste erlaubter Tags/Klassen gereinigt wird.
import { h } from "./ui.js";

// ---------- HTML reinigen ----------
const TAGS = new Set(["P", "BR", "B", "STRONG", "I", "EM", "U", "SUB", "SUP", "SMALL", "SPAN", "DIV", "UL", "OL", "LI", "H2", "H3", "H4", "TABLE", "THEAD", "TBODY", "TR", "TH", "TD",
  "DETAILS", "SUMMARY", "A", "FIGURE", "FIGCAPTION", "CODE", "HR", "BLOCKQUOTE", "MARK"]);
const CLASSES = new Set(["m", "frac", "ans", "formula", "rule", "rt", "note", "kurz", "steps", "tbl", "ex", "ex-h", "sol", "sol-body", "chip", "hmf", "gtr", "ok", "todo", "plain",
  "plotbox", "legend", "dash", "muted", "lead", "c-f", "c-d1", "c-d2", "c-aux", "web", "src", "timeline", "plan", "findings", "fd", "lvl", "err", "hint", "good", "parts", "part", "a", "b",
  "lv", "warn", "chk", "off", "pt", "chips", "headrow", "eyebrow", "facts", "big", "center"]);
const DROP = new Set(["SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META", "TEMPLATE", "SVG", "MATH", "FORM", "INPUT", "BUTTON", "TEXTAREA", "SELECT", "IMG", "VIDEO", "AUDIO"]);

function cleanNode(src, out, ctx) {
  for (const n of [...src.childNodes]) {
    if (n.nodeType === 3) { out.append(document.createTextNode(n.textContent)); continue; }
    if (n.nodeType !== 1) continue;
    const tag = n.tagName.toUpperCase();
    if (DROP.has(tag)) continue;
    if (!TAGS.has(tag)) { cleanNode(n, out, ctx); continue; }   // unbekannte Hülle weg, Inhalt behalten
    const el = document.createElement(tag);
    const cls = (n.getAttribute("class") || "").split(/\s+/).filter((c) => CLASSES.has(c));
    if (cls.length) el.className = cls.join(" ");
    if (tag === "A") {
      const href = (n.getAttribute("href") || "").trim();
      if (/^#[\w-]{1,60}$/.test(href)) { el.setAttribute("href", ctx.chapterHref(href.slice(1))); el.dataset.k = href.slice(1); }
      else if (/^https?:\/\//i.test(href)) { el.setAttribute("href", href); el.target = "_blank"; el.rel = "noopener noreferrer"; }
    }
    if ((tag === "TD" || tag === "TH")) for (const a of ["colspan", "rowspan"]) { const v = n.getAttribute(a); if (/^\d{1,2}$/.test(v || "")) el.setAttribute(a, v); }
    if (tag === "DIV" && n.hasAttribute("data-plot")) { const v = n.getAttribute("data-plot"); if (v && v.length < 8000) el.dataset.plot = v; }
    if (tag === "DIV" && /^(kubisch|cubic)$/.test(n.getAttribute("data-lab") || "")) el.dataset.lab = "kubisch";
    if (tag === "DETAILS" && n.hasAttribute("open")) el.open = true;
    cleanNode(n, el, ctx);
    out.append(el);
  }
}
export function safeHTML(html, ctx = { chapterHref: (k) => `#${k}` }) {
  const frag = document.createDocumentFragment();
  if (!html) return frag;
  const doc = new window.DOMParser().parseFromString(`<body>${String(html)}</body>`, "text/html");
  cleanNode(doc.body, frag, ctx);
  frag.querySelectorAll("[data-plot]").forEach(renderPlot);
  frag.querySelectorAll("[data-lab]").forEach(renderLab);
  return frag;
}
const inline = (s, ctx) => { const sp = document.createElement("span"); sp.append(safeHTML(s, ctx)); return sp; };

// ---------- Formeln für Graphen: kleiner, sicherer Rechenausdruck-Parser (kein eval) ----------
const SUP = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };
const FN = { sin: Math.sin, cos: Math.cos, tan: Math.tan, exp: Math.exp, ln: Math.log, log: Math.log10, sqrt: Math.sqrt, wurzel: Math.sqrt, abs: Math.abs };
export function compileExpr(src) {
  let s = String(src).toLowerCase().replace(/[−–]/g, "-").replace(/[·×]/g, "*").replace(/÷/g, "/").replace(/π/g, "pi").replace(/,/g, ".").replace(/\s+/g, "");
  s = s.replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+/g, (m) => "^(" + [...m].map((c) => SUP[c]).join("") + ")");
  let i = 0;
  const peek = () => s[i];
  const fail = () => { throw new Error(`Formel nicht lesbar: ${src}`); };
  function primary() {
    const c = peek();
    if (c === "(") { i++; const e = expr(); if (s[i++] !== ")") fail(); return e; }
    const num = s.slice(i).match(/^\d+(\.\d+)?|^\.\d+/);
    if (num) { i += num[0].length; const v = Number(num[0]); return () => v; }
    const id = s.slice(i).match(/^[a-z]+/);
    if (id) {
      const w = id[0];
      if (FN[w] && s[i + w.length] === "(") { i += w.length; const f = FN[w]; const a = primary(); return (x) => f(a(x)); }
      if (w === "x") { i++; return (x) => x; }
      if (w === "e") { i++; return () => Math.E; }
      if (w === "pi") { i += 2; return () => Math.PI; }
      if (w.startsWith("x")) { i++; return (x) => x; }   // „xx“ → x·x über implizite Multiplikation
      if (w.startsWith("e")) { i++; return () => Math.E; }
      fail();
    }
    fail();
  }
  function power() {
    const b = primary();
    if (peek() === "^") { i++; const e = unary(); return (x) => Math.pow(b(x), e(x)); }
    return b;
  }
  function unary() { if (peek() === "-") { i++; const a = unary(); return (x) => -a(x); } if (peek() === "+") { i++; return unary(); } return power(); }
  function term() {
    let a = unary();
    for (;;) {
      const c = peek();
      if (c === "*" || c === "/") { i++; const b = unary(); const l = a; a = c === "*" ? (x) => l(x) * b(x) : (x) => l(x) / b(x); }
      else if (c && /[\d.a-z(]/.test(c)) { const b = power(); const l = a; a = (x) => l(x) * b(x); }   // implizit: 2x, x(x-1), 3sin(x)
      else return a;
    }
  }
  function expr() {
    let a = term();
    while (peek() === "+" || peek() === "-") { const c = s[i++]; const b = term(); const l = a; a = c === "+" ? (x) => l(x) + b(x) : (x) => l(x) - b(x); }
    return a;
  }
  const f = expr();
  if (i !== s.length) fail();
  return f;
}

// ---------- Funktionsgraphen (wie in der Vorlage) ----------
const COLORS = { f: "#1b4fd8", f1: "#e0621f", f2: "#1d8445", aux: "#7a4fd6", ink: "#162033", red: "#d23c33" };
const col = (c) => COLORS[String(c || "f").replace(/^--/, "")] || COLORS.f;
const niceStep = (r) => { for (const s of [0.25, 0.5, 1, 2, 5, 10, 20, 25, 50, 100]) if (r / s <= 12) return s; return 200; };
const fmt = (v) => (Math.round(v * 100) / 100).toString().replace(".", ",").replace("-", "−");
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
let clipN = 0;
function renderPlot(div) {
  let cfg;
  try { cfg = JSON.parse(div.dataset.plot); } catch { div.replaceChildren(h("p.muted", "Graph: Angaben fehlerhaft.")); return; }
  try {
    const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
    const [x0, x1] = [num(cfg.x?.[0], -5), num(cfg.x?.[1], 5)], [y0, y1] = [num(cfg.y?.[0], -5), num(cfg.y?.[1], 5)];
    if (!(x1 > x0 && y1 > y0)) throw new Error("Bereich");
    const W = 640, H = Math.min(700, Math.max(160, num(cfg.h, 360))), L = 36, R = 14, T = 14, B = 28;
    const sx = (x) => L + (x - x0) / (x1 - x0) * (W - L - R), sy = (y) => T + (y1 - y) / (y1 - y0) * (H - T - B);
    const id = "lacl" + (++clipN);
    const xs = num(cfg.xs, 0) > 0 ? num(cfg.xs) : niceStep(x1 - x0), ys = num(cfg.ys, 0) > 0 ? num(cfg.ys) : niceStep(y1 - y0);
    let g = "";
    for (let k = Math.ceil(x0 / xs) * xs; k <= x1 + 1e-9; k += xs) g += `<line x1="${sx(k)}" x2="${sx(k)}" y1="${T}" y2="${H - B}" stroke="#edf0f4"/>`;
    for (let k = Math.ceil(y0 / ys) * ys; k <= y1 + 1e-9; k += ys) g += `<line y1="${sy(k)}" y2="${sy(k)}" x1="${L}" x2="${W - R}" stroke="#edf0f4"/>`;
    const ax = (y0 <= 0 && y1 >= 0) ? sy(0) : H - B, ay = (x0 <= 0 && x1 >= 0) ? sx(0) : L;
    g += `<line x1="${L}" x2="${W - R}" y1="${ax}" y2="${ax}" stroke="#8a93a3" stroke-width="1.2"/><line y1="${T}" y2="${H - B}" x1="${ay}" x2="${ay}" stroke="#8a93a3" stroke-width="1.2"/>`;
    let lab = "";
    for (let k = Math.ceil(x0 / xs) * xs; k <= x1 + 1e-9; k += xs) { if (Math.abs(k) < 1e-9) continue; lab += `<text x="${sx(k)}" y="${Math.min(ax + 15, H - B + 15)}" text-anchor="middle">${fmt(k)}</text>`; }
    for (let k = Math.ceil(y0 / ys) * ys; k <= y1 + 1e-9; k += ys) { if (Math.abs(k) < 1e-9) continue; lab += `<text x="${Math.max(ay - 5, L - 4)}" y="${sy(k) + 4}" text-anchor="end">${fmt(k)}</text>`; }
    lab += `<text x="${W - R - 2}" y="${ax - 6}" text-anchor="end" font-style="italic">x</text><text x="${ay + 6}" y="${T + 11}" font-style="italic">y</text>`;
    let curves = ""; const span = y1 - y0;
    for (const fn of (cfg.fns || []).slice(0, 8)) {
      const f = compileExpr(fn.f);
      const a = num(fn.from, x0), b = num(fn.to, x1), N = 600; let d = "", pen = false, py = null;
      for (let i = 0; i <= N; i++) {
        const x = a + (b - a) * i / N; const y = f(x);
        if (!Number.isFinite(y) || (py !== null && Math.abs(y - py) > 3 * span)) { pen = false; py = null; continue; }
        const yc = Math.max(y0 - span, Math.min(y1 + span, y));
        d += (pen ? "L" : "M") + sx(x).toFixed(1) + " " + sy(yc).toFixed(1); pen = true; py = y;
      }
      curves += `<path d="${d}" fill="none" stroke="${col(fn.c)}" stroke-width="${num(fn.w, 2.6)}" ${fn.dash ? 'stroke-dasharray="7 5"' : ""} stroke-linecap="round" stroke-linejoin="round"/>`;
    }
    for (const p of (cfg.polys || []).slice(0, 10)) curves += `<polygon points="${(p.pts || []).map((q) => sx(num(q[0], 0)) + "," + sy(num(q[1], 0))).join(" ")}" fill="${col(p.c)}" fill-opacity=".14" stroke="${col(p.c)}" stroke-width="1.5"/>`;
    for (const v of (cfg.vl || []).slice(0, 10)) curves += `<line x1="${sx(num(v, 0))}" x2="${sx(num(v, 0))}" y1="${T}" y2="${H - B}" stroke="#8a93a3" stroke-dasharray="4 4"/>`;
    let pts = "";
    for (const p of (cfg.pts || []).slice(0, 30)) {
      const X = sx(num(p[0], 0)), Y = sy(num(p[1], 0)); const right = X > W - 120; const top = Y < T + 22;
      pts += `<circle cx="${X}" cy="${Y}" r="4.5" fill="#fff" stroke="${col(p[3] || "ink")}" stroke-width="2"/>`;
      if (p[2]) pts += `<text x="${X + (right ? -9 : 9)}" y="${Y + (top ? 17 : -9)}" text-anchor="${right ? "end" : "start"}">${esc(p[2])}</text>`;
    }
    const svg = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(cfg.alt || "Funktionsgraph")}" font-size="13" fill="#5a6476"><defs><clipPath id="${id}"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></clipPath></defs>${g}<g clip-path="url(#${id})">${curves}</g>${lab}${pts}</svg>`;
    div.innerHTML = svg;   // nur selbst erzeugtes SVG, Beschriftungen escaped
    const leg = Array.isArray(cfg.legend) && cfg.legend.length ? cfg.legend.map((l) => ({ t: l.t, c: l.c, dash: l.dash })) : (cfg.fns || []).filter((f) => f.l).map((f) => ({ t: f.l, c: f.c, dash: f.dash }));
    if (leg.length) div.append(h("div.legend", leg.slice(0, 8).map((l) => h("span", { style: { color: col(l.c) } }, h("i", { class: l.dash ? "dash" : "" }), h("span.m", { style: { color: "var(--la-ink)" } }, String(l.t || ""))))));
  } catch (e) { div.replaceChildren(h("p.muted", `Graph: ${e.message}`)); }
}

// ---------- Funktionslabor: f(x) = ax³ + bx² + cx + d mit Schiebern, Ableitungen, Extrem- und Wendepunkte ----------
function renderLab(div) {
  const v = { a: 1, b: -3, c: 0, d: 2 };
  const show = { f: true, d1: true, d2: false };
  const num = (x) => { const r = Math.round(x * 100) / 100; return (r < 0 ? "−" : "") + Math.abs(r).toString().replace(".", ","); };
  const poly = (cs, vars) => { let s = ""; cs.forEach((c, i) => { if (Math.abs(c) < 1e-9) return; const a = Math.abs(c); const co = a === 1 && vars[i] ? "" : a.toString().replace(".", ","); s += (s ? (c < 0 ? " − " : " + ") : (c < 0 ? "−" : "")) + co + vars[i]; }); return s || "0"; };
  const plotBox = h("div"), out = h("div.chips");
  const draw = () => {
    const { a, b, c, d } = v;
    const fns = [];
    if (show.f) fns.push({ f: `${a}x^3+(${b})x^2+(${c})x+(${d})`, l: "f(x) = " + poly([a, b, c, d], ["x³", "x²", "x", ""]) });
    if (show.d1) fns.push({ f: `${3 * a}x^2+(${2 * b})x+(${c})`, c: "f1", l: "f′(x) = " + poly([3 * a, 2 * b, c], ["x²", "x", ""]) });
    if (show.d2) fns.push({ f: `${6 * a}x+(${2 * b})`, c: "f2", l: "f″(x) = " + poly([6 * a, 2 * b], ["x", ""]) });
    const f = (x) => a * x ** 3 + b * x * x + c * x + d, f2 = (x) => 6 * a * x + 2 * b;
    const pts = [], info = []; let e = [];
    if (Math.abs(a) > 1e-9) { const D = 4 * b * b - 12 * a * c; if (D > 1e-9) e = [(-2 * b - Math.sqrt(D)) / (6 * a), (-2 * b + Math.sqrt(D)) / (6 * a)]; else if (Math.abs(D) <= 1e-9) info.push("Sattelpunkt bei x = " + num(-b / (3 * a))); }
    else if (Math.abs(b) > 1e-9) e = [-c / (2 * b)];
    e.forEach((x) => { const k = f2(x); if (Math.abs(k) < 1e-9) return; const n = k < 0 ? "HP" : "TP"; pts.push([x, f(x), n]); info.push(`${n}(${num(x)} | ${num(f(x))})`); });
    if (Math.abs(a) > 1e-9) { const w = -b / (3 * a); pts.push([w, f(w), "W", "aux"]); info.push(`W(${num(w)} | ${num(f(w))})`); }
    plotBox.dataset.plot = JSON.stringify({ x: [-5, 5], y: [-8, 8], xs: 1, ys: 2, h: 340, fns, pts: show.f ? pts : [], alt: "Funktionslabor" });
    renderPlot(plotBox);
    out.replaceChildren(...(info.length ? info : ["keine Extrem- oder Wendepunkte"]).map((s) => h("span.pt", s)));
  };
  const slider = (k, label) => { const val = h("span", num(v[k])); return h("label", h("span", { style: { color: "var(--la-muted)", fontFamily: "inherit" } }, `${label} = `), val,
    h("input", { type: "range", min: -4, max: 4, step: 0.25, value: v[k], oninput: (e) => { v[k] = Number(e.target.value); val.textContent = num(v[k]); draw(); } })); };
  const tog = (k, label, cls) => h("label", h("input", { type: "checkbox", checked: show[k], onchange: (e) => { show[k] = e.target.checked; draw(); } }), h("span", { class: cls }, label));
  div.className = "lab";
  div.replaceChildren(h("div.lab-ctrl", slider("a", "a"), slider("b", "b"), slider("c", "c"), slider("d", "d")),
    h("div.lab-tog", tog("f", "f", "c-f"), tog("d1", "f′", "c-d1"), tog("d2", "f″", "c-d2")), plotBox, out);
  draw();
}

// ---------- Lernatlas zeichnen ----------
const TEIL = { A: "Teil A", B: "Teil B", "A+B": "Teil A + B" };
export const STAND = { ok: ["ok", "sitzt"], warn: ["warn", "unsicher"], chk: ["chk", "prüfen"], off: ["off", "noch nicht im Unterricht"] };
const LOGO = () => { const s = document.createElementNS("http://www.w3.org/2000/svg", "svg"); s.setAttribute("viewBox", "0 0 24 24"); s.setAttribute("width", "18"); s.setAttribute("height", "18"); s.innerHTML = '<path d="M5 4h10a4 4 0 0 1 4 4v12H9a4 4 0 0 1-4-4z" fill="none" stroke="#fff" stroke-width="2"/><path d="M9 8h6M9 12h6" stroke="#fff" stroke-width="2" stroke-linecap="round"/>'; return s; };

/**
 * cfg: Modul-Konfiguration · opts: { photoUrl(file) → URL|null, admin, onProgress(id, stand), onUpload(), startChapter, onChapter(id) }
 */
export function renderAtlas(cfg, opts = {}) {
  const chapters = (Array.isArray(cfg.chapters) ? cfg.chapters : []).filter((c) => c && c.title).map((c, i) => ({ ...c, nav: c.nav || c.title, id: String(c.id || `k${i + 1}`).replace(/[^\w-]/g, "").slice(0, 60) || `k${i + 1}`, nr: c.nr ?? i + 1 }));
  const progress = { ...(cfg.progress || {}) };
  const byId = Object.fromEntries(chapters.map((c) => [c.id, c]));
  let cur = byId[opts.startChapter] ? opts.startChapter : opts.startChapter === "material" ? "material" : "start";
  const ctx = { chapterHref: (k) => (opts.hrefFor ? opts.hrefFor(k) : `#${k}`) };
  const sub = [cfg.kurs ? `${cfg.fach} ${cfg.kurs}` : cfg.fach, cfg.klasse ? `Klasse ${cfg.klasse}` : null, cfg.halbjahr, cfg.land].filter(Boolean).join(" · ");
  const photos = (c) => (Array.isArray(c.photos) ? c.photos : []).filter((p) => p && p.file);
  const links = (c) => (Array.isArray(c.links) ? c.links : []).filter((l) => l && /^https?:\/\//i.test(l.url || ""));
  const standOf = (c) => progress[c.id] || c.stand || (c.done === false ? "off" : null);

  const side = h("nav.la-sidenav", { "aria-label": "Kapitel" });
  const sel = h("select.la-sel", { id: `la-sel-${clipN}`, "aria-label": "Kapitel wählen", onchange: (e) => go(e.target.value, true) });
  const main = h("main.la-main");
  const root = h("div.la",
    h("header.la-top", h("a.la-brand", { href: ctx.chapterHref("start"), onclick: (e) => { e.preventDefault(); go("start", true); } }, h("span.la-logo", LOGO()), h("b", `Lernatlas ${cfg.thema || ""}`), sub ? h("span", sub) : null),
      h("div.la-spacer"), opts.toolbar || null,
      h("div.la-mobnav", h("label.eyebrow", { for: sel.id }, "Kapitel wählen"), sel)),
    h("div.la-layout", h("aside.la-side", side), main));

  // Register
  const groups = [];
  const gmap = {};
  const items = [{ id: "start", title: "Überblick", group: "Start" }, ...chapters.map((c) => ({ ...c, title: c.nav, group: c.group || (c.teil === "B" ? "Teil B · mit Hilfsmitteln" : c.teil === "A" ? "Teil A · ohne Hilfsmittel" : "Kapitel") })), { id: "material", title: "Alle Materialien und Quellen", group: "Üben und Material", nr: chapters.length + 1 }];
  for (const it of items) { if (!gmap[it.group]) { gmap[it.group] = []; groups.push(it.group); } gmap[it.group].push(it); }
  const drawNav = () => {
    side.replaceChildren(...groups.map((g) => h("div.navgroup", h("h4", g), ...gmap[g].map((it) => {
      const st = byId[it.id] ? standOf(byId[it.id]) : null;
      return h("a", { href: ctx.chapterHref(it.id), "aria-current": it.id === cur ? "page" : null, onclick: (e) => { e.preventDefault(); go(it.id, true); } },
        h("span.nr", it.nr && it.id !== "start" ? String(it.nr) : ""), h("span", it.title), h("span.dot", { class: st || "", title: st ? STAND[st]?.[1] : "" }));
    }))), h("div.navnote", h("span.dot"), "Punkt = dein Stand (sitzt, unsicher, prüfen)"));
    sel.replaceChildren(...items.map((it) => h("option", { value: it.id, selected: it.id === cur }, `${it.nr && it.id !== "start" ? it.nr + ". " : ""}${it.title}`)));
  };

  const thumbs = (list) => h("div.thumbs", list.map((p) => {
    const url = opts.photoUrl?.(p.file);
    return h("button.thumb", { type: "button", class: p.doc ? "doc" : "", onclick: () => url ? lightbox(url, p.caption || p.file) : opts.onUpload?.() },
      h("span.ph", url ? h("img", { src: url, alt: p.caption || p.file, loading: "lazy" }) : h("span.ph-miss", opts.admin ? "Foto fehlt – antippen zum Hochladen" : "Foto fehlt")),
      h("span.c", p.caption || p.file, p.sub ? h("small", p.sub) : null));
  }));

  function startView() {
    const rows = chapters.map((c) => {
      const st = standOf(c); const n = new Set(photos(c).map((p) => p.file)).size, w = links(c).length;
      return h("tr", { class: c.done === false ? "todo" : "" }, h("td.nr", String(c.nr)),
        h("td", h("a", { href: ctx.chapterHref(c.id), onclick: (e) => { e.preventDefault(); go(c.id, true); } }, c.nav), c.done === false ? h("small", " (kommt noch)") : null),
        h("td.ic", TEIL[c.teil] || ""), h("td.ic", n ? `${n} ${n > 1 ? "Fotos" : "Foto"}` : "–"), h("td.ic", w ? `${w} ${w > 1 ? "Links" : "Link"}` : "–"),
        h("td.ic", st ? h("span.lv", { class: st }, STAND[st]?.[1] || st) : "–"));
    });
    const parts = Array.isArray(cfg.exam?.parts) ? cfg.exam.parts : [];
    return h("section.topic.start",
      h("p.eyebrow", [cfg.fach, cfg.kurs, cfg.klasse ? `Klasse ${cfg.klasse}${cfg.halbjahr ? ` (${cfg.halbjahr})` : ""}` : cfg.halbjahr, cfg.land].filter(Boolean).join(" · ")),
      h("h1", cfg.thema || "Lernatlas"),
      cfg.lead ? h("p.lead", inline(cfg.lead, ctx)) : null,
      parts.length ? [h("h2", cfg.exam.title || "Die Klausur"), h("div.parts", parts.map((p) => h("div.part", { class: /b/i.test(p.teil || "") ? "b" : "a" },
        h("span.chip", { class: /b/i.test(p.teil || "") ? "gtr" : "hmf" }, p.label || TEIL[p.teil] || "Teil"), p.text ? h("p", inline(p.text, ctx)) : null)))] : null,
      cfg.start_html ? h("div", safeHTML(cfg.start_html, ctx)) : null,
      h("h2", "Lernweg und Materialien"),
      h("div.tbl", h("table.overview", h("thead", h("tr", ["#", "Thema", "Teil", "Fotos", "Internet", "Stand"].map((t) => h("th", t)))), h("tbody", rows))),
      h("p.legendline", Object.entries(STAND).map(([k, [c, t]]) => h("span.lv", { class: c }, t)), h("span.muted", " · Stand legst du in jedem Kapitel fest.")),
      h("p.muted", "Alles auf einer Seite: ", h("a", { href: ctx.chapterHref("material"), onclick: (e) => { e.preventDefault(); go("material", true); } }, "Alle Materialien"), "."),
      cfg.timeline?.length ? [h("h2", "Termine"), h("ul.timeline", cfg.timeline.map((t) => h("li", { class: t.done ? "" : "todo" }, h("b", t.title || ""), t.date ? h("small", ` · ${new Date(t.date).toLocaleDateString("de-DE")}`) : null, t.note ? h("div", h("small", t.note)) : null)))] : null);
  }

  function chapterView(c) {
    const i = chapters.indexOf(c), prev = i > 0 ? { id: chapters[i - 1].id, title: chapters[i - 1].nav } : { id: "start", title: "Überblick" }, next = chapters[i + 1] ? { id: chapters[i + 1].id, title: chapters[i + 1].nav } : { id: "material", title: "Alle Materialien und Quellen" };
    const st = standOf(c);
    const head = h("div.headrow",
      h("span.chip", { class: c.done === false ? "todo" : "ok" }, c.done === false ? "kommt noch" : "im Unterricht behandelt"),
      String(c.teil || "").includes("A") ? h("span.chip.hmf", "Teil A: ohne Hilfsmittel") : null,
      String(c.teil || "").includes("B") ? h("span.chip.gtr", "Teil B: mit Hilfsmitteln") : null);
    const standSel = h("div.la-stand", h("span.muted", "Mein Stand:"), ...Object.entries(STAND).map(([k, [cl, t]]) => h("button.lv", { type: "button", class: `${cl}${st === k ? " on" : ""}`, "aria-pressed": String(st === k),
      onclick: async () => { const nv = st === k ? null : k; if (nv) progress[c.id] = nv; else delete progress[c.id]; try { await opts.onProgress?.(c.id, nv, progress); } catch { /* Anzeige bleibt */ } go(c.id, false); } }, t)));
    const ph = photos(c), ln = links(c);
    return h("section.topic",
      h("p.eyebrow", `Kapitel ${c.nr}${c.teil ? " · " + (TEIL[c.teil] || c.teil) : ""}`),
      h("h1", c.title),
      c.lead ? h("p.lead", inline(c.lead, ctx)) : null,
      head, standSel,
      Array.isArray(c.kurz) && c.kurz.length ? h("div.kurz", h("b", "Kurz gesagt"), h("ul", c.kurz.map((k) => h("li", inline(k, ctx))))) : null,
      h("div.la-body", safeHTML(c.html, ctx)),
      ln.length ? h("div.web", h("h2", "Erklärung im Internet"), h("ul", ln.map((l) => h("li", h("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, l.title || l.url), l.note ? h("small.muted", ` – ${l.note}`) : null)))) : null,
      ph.length ? h("div.mat", h("h2", "Aus dem Unterricht"), h("p", "Antippen zum Vergrößern."), thumbs(ph)) : null,
      h("nav.pager", h("a", { href: ctx.chapterHref(prev.id), onclick: (e) => { e.preventDefault(); go(prev.id, true); } }, h("small", "zurück"), prev.title),
        h("a", { href: ctx.chapterHref(next.id), style: { textAlign: "right" }, onclick: (e) => { e.preventDefault(); go(next.id, true); } }, h("small", "weiter"), next.title)));
  }

  function materialView() {
    const blocks = [];
    for (const c of chapters) {
      const seen = new Set(); const ph = photos(c).filter((p) => !seen.has(p.file) && seen.add(p.file)); const ln = links(c);
      if (!ph.length && !ln.length) continue;
      blocks.push(h("h3", `${c.nr}. ${c.nav}`));
      if (ph.length) blocks.push(thumbs(ph));
      if (ln.length) blocks.push(h("ul.src", ln.map((l) => h("li", h("a", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, l.title || l.url)))));
    }
    const src = Array.isArray(cfg.sources) ? cfg.sources.filter((s) => /^https?:\/\//i.test(s.url || "")) : [];
    return h("section.topic",
      h("p.eyebrow", `Kapitel ${chapters.length + 1} · Üben und Material`), h("h1", "Alle Materialien und Quellen"),
      h("p.lead", "Alle Fotos aus dem Unterricht und alle Links nach Kapiteln."),
      blocks.length ? blocks : h("p.muted", "Noch keine Fotos oder Links."),
      src.length ? [h("h2", "Quellen"), h("ul.src", src.map((s) => h("li", h("a", { href: s.url, target: "_blank", rel: "noopener noreferrer" }, s.title || s.url))))] : null,
      h("nav.pager", h("a", { href: ctx.chapterHref(chapters.at(-1)?.id || "start"), onclick: (e) => { e.preventDefault(); go(chapters.at(-1)?.id || "start", true); } }, h("small", "zurück"), chapters.at(-1)?.nav || "Überblick"), h("span")));
  }

  function go(id, scroll) {
    cur = byId[id] || id === "material" ? id : "start";
    main.replaceChildren(cur === "start" ? startView() : cur === "material" ? materialView() : chapterView(byId[cur]));
    main.querySelectorAll("a[data-k]").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); go(a.dataset.k, true); }));
    drawNav();
    opts.onChapter?.(cur);
    if (scroll) root.scrollIntoView({ block: "start" });
  }
  go(cur, false);
  root.goTo = go;
  return root;
}

export function lightbox(url, caption) {
  let big = false;
  const img = h("img", { src: url, alt: caption || "" });
  const stage = h("div.lb-stage", { onclick: () => { big = !big; stage.classList.toggle("big", big); } }, img);
  const close = () => { box.remove(); document.removeEventListener("keydown", key); };
  const key = (e) => { if (e.key === "Escape") close(); };
  const box = h("div.la-lightbox", { role: "dialog", "aria-modal": "true", "aria-label": caption || "Foto" },
    h("div.lb-bar", h("span", caption || ""), h("button", { type: "button", onclick: () => { big = !big; stage.classList.toggle("big", big); } }, "Zoom"), h("a", { href: url, target: "_blank", rel: "noopener", class: "lb-btn" }, "Original"), h("button", { type: "button", onclick: close }, "Schließen")),
    stage);
  document.addEventListener("keydown", key);
  document.body.append(box);
}

// Bilder vor dem Hochladen verkleinern (Handyfotos sind oft 4–8 MB)
export async function shrinkImage(file, max = 2200) {
  if (!/^image\/(jpeg|png|webp|heic|heif)$/i.test(file.type) || file.size < 600_000) return file;
  try {
    const bmp = await window.createImageBitmap(file);
    const k = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement("canvas"); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
    const blob = await new Promise((r) => c.toBlob(r, "image/jpeg", 0.86));
    return blob && blob.size < file.size ? new window.File([blob], file.name, { type: "image/jpeg" }) : file;
  } catch { return file; }
}
