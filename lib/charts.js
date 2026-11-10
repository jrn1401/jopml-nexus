// Leichte SVG-Charts ohne Abhängigkeiten (Linie/Fläche, Balken, Donut, Sparkline) mit Tooltip.
import { h } from "./ui.js";

const NS = "http://www.w3.org/2000/svg";
const s = (tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v); return e; };
export const PALETTE = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)", "var(--chart-6)"];

let tip;
function showTip(ev, lines) {
  tip ??= document.body.appendChild(h("div.chart-tip"));
  tip.replaceChildren(...lines.map((l, i) => h("div", { style: i === 0 ? { color: "var(--text-3)", marginBottom: "3px" } : null }, l)));
  tip.style.display = "block";
  const x = Math.min(ev.clientX + 14, innerWidth - tip.offsetWidth - 8);
  tip.style.left = x + "px"; tip.style.top = Math.max(8, ev.clientY - tip.offsetHeight - 12) + "px";
}
const hideTip = () => tip && (tip.style.display = "none");

// Zeichnet mit der echten Containerbreite neu (keine verzerrte Schrift)
function responsive(build) {
  const wrap = h("div", { style: { width: "100%", minWidth: 0 } });
  let last = 0;
  const ro = new ResizeObserver(() => {
    const w = Math.round(wrap.clientWidth);
    if (w > 0 && Math.abs(w - last) > 4) { last = w; wrap.replaceChildren(build(Math.max(260, w))); }
  });
  ro.observe(wrap);
  return wrap;
}

function niceMax(v) {
  if (v <= 0) return 1;
  const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * e;
}

/**
 * Linien-/Flächenchart.
 * series: [{ name, color, values: [{x: Date|number, y: number|null}] }]
 * opts: { height, yMax, yFmt, xFmt, area }
 */
export function lineChart(series, opts = {}) {
  const any = series.some((se) => se.values.some((p) => p.y !== null && p.y !== undefined));
  if (!any) return h("div.empty", { style: { padding: "40px 0" } }, h("div.s", opts.emptyText || "Noch keine Messwerte im Zeitraum."));
  return responsive((W) => buildLine(series, opts, W));
}
function buildLine(series, opts, W) {
  const H = opts.height || 220, L = 44, R = 10, T = 10, B = 24;
  const all = series.flatMap((se) => se.values.filter((p) => p.y !== null && p.y !== undefined));
  const wrap = h("div");
  if (!all.length) { wrap.appendChild(h("div.empty", { style: { padding: "40px 0" } }, h("div.s", opts.emptyText || "Noch keine Messwerte im Zeitraum."))); return wrap; }
  const xs = all.map((p) => +p.x), x0 = Math.min(...xs), x1 = Math.max(...xs) || x0 + 1;
  const yMax = opts.yMax ?? niceMax(Math.max(...all.map((p) => p.y)) * 1.08);
  const X = (x) => L + ((+x - x0) / (x1 - x0 || 1)) * (W - L - R);
  const Y = (y) => T + (1 - y / yMax) * (H - T - B);
  const yFmt = opts.yFmt || ((v) => String(Math.round(v)));
  const xFmt = opts.xFmt || ((v) => new Date(v).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }));
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", width: "100%", height: H, role: "img", "aria-label": opts.label || "Diagramm" });
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i, y = Y(v);
    svg.append(s("line", { x1: L, x2: W - R, y1: y, y2: y, class: "grid-line", "vector-effect": "non-scaling-stroke" }));
    const t = s("text", { x: L - 8, y: y + 4, "text-anchor": "end" }); t.textContent = yFmt(v); svg.append(t);
  }
  const ticks = W < 420 ? 3 : 5;
  for (let i = 0; i <= ticks; i++) {
    const xv = x0 + ((x1 - x0) / ticks) * i;
    const t = s("text", { x: X(xv), y: H - 6, "text-anchor": i === 0 ? "start" : i === ticks ? "end" : "middle" }); t.textContent = xFmt(xv); svg.append(t);
  }
  series.forEach((se, si) => {
    const col = se.color || PALETTE[si % PALETTE.length];
    const pts = se.values.filter((p) => p.y !== null && p.y !== undefined);
    if (!pts.length) return;
    const d = pts.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.y).toFixed(1)}`).join("");
    if (opts.area !== false && series.length <= 2) {
      const gid = "g" + Math.random().toString(36).slice(2);
      const grad = s("linearGradient", { id: gid, x1: 0, x2: 0, y1: 0, y2: 1 });
      grad.append(s("stop", { offset: "0%", "stop-color": col, "stop-opacity": .22 }), s("stop", { offset: "100%", "stop-color": col, "stop-opacity": 0 }));
      const defs = s("defs"); defs.append(grad); svg.append(defs);
      svg.append(s("path", { d: `${d}L${X(pts.at(-1).x)},${Y(0)}L${X(pts[0].x)},${Y(0)}Z`, fill: `url(#${gid})` }));
    }
    svg.append(s("path", { d, fill: "none", stroke: col, "stroke-width": 1.8, "stroke-linejoin": "round", "vector-effect": "non-scaling-stroke" }));
  });
  // Hover-Linie
  const hover = s("line", { y1: T, y2: H - B, stroke: "var(--line-2)", "vector-effect": "non-scaling-stroke", visibility: "hidden" });
  svg.append(hover);
  const allX = [...new Set(series.flatMap((se) => se.values.map((p) => +p.x)))].sort((a, b) => a - b);
  svg.addEventListener("pointermove", (ev) => {
    const r = svg.getBoundingClientRect(), px = ((ev.clientX - r.left) / r.width) * W;
    let best = allX[0], bd = Infinity;
    for (const xv of allX) { const dd = Math.abs(X(xv) - px); if (dd < bd) { bd = dd; best = xv; } }
    hover.setAttribute("x1", X(best)); hover.setAttribute("x2", X(best)); hover.setAttribute("visibility", "visible");
    const lines = [opts.tipX ? opts.tipX(best) : new Date(best).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })];
    series.forEach((se) => { const p = se.values.find((q) => +q.x === best); if (p && p.y !== null) lines.push(`${se.name}: ${(opts.tipFmt || yFmt)(p.y)}`); });
    showTip(ev, lines);
  });
  svg.addEventListener("pointerleave", () => { hover.setAttribute("visibility", "hidden"); hideTip(); });
  wrap.append(svg);
  if (series.length > 1) wrap.append(legend(series.map((se, i) => [se.name, se.color || PALETTE[i % PALETTE.length]])));
  return wrap;
}

/** Balken (optional gestapelt). labels: string[], series: [{name,color,values:number[]}] */
export function barChart(labels, series, opts = {}) {
  const tot = labels.map((_, i) => series.reduce((a, se) => a + (se.values[i] || 0), 0));
  if (!tot.some((v) => v > 0)) return h("div.empty", { style: { padding: "40px 0" } }, h("div.s", opts.emptyText || "Keine Daten im Zeitraum."));
  return responsive((W) => buildBar(labels, series, opts, W));
}
function buildBar(labels, series, opts, W) {
  const H = opts.height || 220, L = 48, R = 8, T = 10, B = 26;
  const totals = labels.map((_, i) => series.reduce((a, se) => a + (se.values[i] || 0), 0));
  const wrap = h("div");
  if (!totals.some((v) => v > 0)) { wrap.appendChild(h("div.empty", { style: { padding: "40px 0" } }, h("div.s", opts.emptyText || "Keine Daten im Zeitraum."))); return wrap; }
  const yMax = niceMax(Math.max(...totals) * 1.05), yFmt = opts.yFmt || ((v) => String(Math.round(v)));
  const Y = (v) => T + (1 - v / yMax) * (H - T - B);
  const bw = (W - L - R) / labels.length, gap = Math.min(10, bw * .3);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", width: "100%", height: H, role: "img", "aria-label": opts.label || "Balkendiagramm" });
  for (let i = 0; i <= 4; i++) {
    const v = (yMax / 4) * i;
    svg.append(s("line", { x1: L, x2: W - R, y1: Y(v), y2: Y(v), class: "grid-line", "vector-effect": "non-scaling-stroke" }));
    const t = s("text", { x: L - 8, y: Y(v) + 4, "text-anchor": "end" }); t.textContent = yFmt(v); svg.append(t);
  }
  const every = Math.ceil(labels.length / Math.max(3, Math.floor(W / 64)));
  labels.forEach((lab, i) => {
    let acc = 0; const x = L + i * bw + gap / 2;
    series.forEach((se, si) => {
      const v = se.values[i] || 0; if (!v) return;
      const y1 = Y(acc + v), y0 = Y(acc); acc += v;
      const rect = s("rect", { x, y: y1, width: Math.max(1, bw - gap), height: Math.max(0.5, y0 - y1), rx: 3, fill: se.color || PALETTE[si % PALETTE.length] });
      svg.append(rect);
    });
    const hit = s("rect", { x: L + i * bw, y: T, width: bw, height: H - T - B, fill: "transparent" });
    hit.addEventListener("pointermove", (ev) => showTip(ev, [lab, ...series.map((se) => `${se.name}: ${yFmt(se.values[i] || 0)}`).filter((_, k) => series[k].values[i]), series.length > 1 ? `Summe: ${yFmt(totals[i])}` : null].filter(Boolean)));
    hit.addEventListener("pointerleave", hideTip);
    svg.append(hit);
    if (i % every === 0) { const t = s("text", { x: x + (bw - gap) / 2, y: H - 7, "text-anchor": "middle" }); t.textContent = lab; svg.append(t); }
  });
  wrap.append(svg);
  if (series.length > 1) wrap.append(legend(series.map((se, i) => [se.name, se.color || PALETTE[i % PALETTE.length]])));
  return wrap;
}

/** Donut: items [{name, value, color}] */
export function donut(items, { size = 150, center, fmt = (v) => String(v) } = {}) {
  const total = items.reduce((a, b) => a + b.value, 0);
  const wrap = h("div.row", { style: { gap: "18px", flexWrap: "wrap" } });
  if (!total) { wrap.append(h("div.faint", "Keine Daten")); return wrap; }
  const r = 52, c = 2 * Math.PI * r;
  const svg = s("svg", { viewBox: "0 0 140 140", width: size, height: size, role: "img", "aria-label": "Anteile" });
  svg.append(s("circle", { cx: 70, cy: 70, r, fill: "none", stroke: "var(--surface-3)", "stroke-width": 14 }));
  let off = 0;
  items.forEach((it, i) => {
    const len = (it.value / total) * c;
    const arc = s("circle", { cx: 70, cy: 70, r, fill: "none", stroke: it.color || PALETTE[i % PALETTE.length], "stroke-width": 14,
      "stroke-dasharray": `${Math.max(0, len - 1.5)} ${c}`, "stroke-dashoffset": -off, transform: "rotate(-90 70 70)", "stroke-linecap": "butt" });
    arc.addEventListener("pointermove", (ev) => showTip(ev, [it.name, `${fmt(it.value)} (${Math.round((it.value / total) * 100)} %)`]));
    arc.addEventListener("pointerleave", hideTip);
    svg.append(arc); off += len;
  });
  if (center) { const t = s("text", { x: 70, y: 76, "text-anchor": "middle", style: "font-size:17px;font-weight:650;fill:var(--text)" }); t.textContent = center; svg.append(t); }
  wrap.append(svg, h("div", { style: { display: "flex", flexDirection: "column", gap: "7px", minWidth: "140px", flex: 1 } },
    items.map((it, i) => h("div.row.between", { style: { fontSize: "13px" } },
      h("span.ellipsis", h("i", { style: { display: "inline-block", width: "9px", height: "9px", borderRadius: "3px", marginRight: "8px", background: it.color || PALETTE[i % PALETTE.length] } }), it.name),
      h("span.muted.nowrap", fmt(it.value))))));
  return wrap;
}

export function sparkline(values, { width = 120, height = 34, color = "var(--primary)" } = {}) {
  const v = values.map((x) => x || 0);
  const svg = s("svg", { viewBox: `0 0 ${width} ${height}`, width: "100%", height, preserveAspectRatio: "none", class: "chart" });
  if (v.length < 2 || !v.some((x) => x > 0)) return svg;
  const mx = Math.max(...v) || 1;
  const pts = v.map((y, i) => `${(i / (v.length - 1)) * width},${height - 3 - (y / mx) * (height - 6)}`);
  svg.append(s("polyline", { points: pts.join(" "), fill: "none", stroke: color, "stroke-width": 1.8, "vector-effect": "non-scaling-stroke", "stroke-linejoin": "round" }));
  return svg;
}

export function legend(items) {
  return h("div.legend", { style: { marginTop: "10px" } }, items.map(([n, c]) => h("span", h("i", { style: { background: c } }), n)));
}
