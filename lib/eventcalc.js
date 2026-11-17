// Event-Kalkulation & Ticket-Analyse: volles Formular (Location, alle möglichen Kosten, Tickets, Bar, Garderobe),
// alles wird sofort neu berechnet (Break-even, Gewinn, Szenarien). Ticket-Tempo, Prognose bis zum Event, Wochentage/Uhrzeiten.
import { h, icon, toast, toastErr, errMsg, md, fmtEUR, modal } from "./ui.js";
import { aiGen } from "./aigen.js";

// Kosten-Katalog: staff = Personen × Stunden × €/h · loc = kann im Location-Preis enthalten sein
export const COSTS = [
  ["security", "Security", "staff", true, "Faustregel: ab 100 Gästen mind. 2, je weitere 100 Gäste +1"],
  ["einlass", "Einlass / Kasse", "staff", true, ""], ["bar", "Bar-Personal", "staff", true, ""], ["garderobe", "Garderoben-Personal", "staff", true, ""],
  ["dj", "DJ / Künstler-Gagen", "fixed", false, ""], ["ton", "Ton / PA", "fixed", true, ""], ["licht", "Licht / DMX / Nebel", "fixed", true, ""],
  ["gema", "GEMA", "fixed", false, "Musik öffentlich → GEMA anmelden; Kosten je nach Raumgröße/Eintritt"], ["versicherung", "Veranstalter-Haftpflicht", "fixed", true, ""],
  ["getraenke", "Getränke-Einkauf (wenn nicht über Bar unten)", "fixed", false, "Leer lassen, wenn du die Bar unten einträgst"], ["deko", "Deko / Bühne", "fixed", false, ""],
  ["werbung", "Werbung / Ads", "fixed", false, ""], ["druck", "Druck (Flyer, Bänder, Plakate)", "fixed", false, ""], ["reinigung", "Reinigung / Müll", "fixed", true, ""],
  ["sani", "Sanitätsdienst", "fixed", true, "Bei größeren Events oft Auflage"], ["genehmigung", "Genehmigung / Gestattung", "fixed", false, ""], ["toiletten", "Toiletten / Mobil-WC", "fixed", true, ""],
  ["strom", "Strom / Aggregat", "fixed", true, ""], ["transport", "Transport / Miete Material", "fixed", false, ""], ["sonstiges", "Sonstiges / Puffer", "fixed", false, "Empfehlung: 5–10 % Puffer"],
];
export const emptyCalc = (a = {}) => ({
  guests: Number(a.guests) || Number(a.capacity) || 100,
  location: { net: 0, vat: 19, note: "" },
  costs: {}, tickets: [{ name: "Ticket", qty: Number(a.capacity || a.guests) || 100, price: Number(a.ticket_price) || 0 }], free: 0, feeBuyer: true, feePct: 0,
  door: { qty: 0, price: 0 }, bar: [], wardrobe: { price: 2, rate: 60 }, change: 0, buffer: 0,
});
const num = (v) => (Number.isFinite(+v) ? +v : 0);
const r2 = (x) => Math.round(x * 100) / 100;

// Ticket-Kategorie mit Preisstufen: phases [{until:"YYYY-MM-DD", price, qty?}] – danach gilt „price“ (Endpreis)
export function catRevenue(t, mode = "avg") {
  const ph = (t.phases || []).filter((p) => num(p.price) > 0 && (p.until || p.qty));
  if (num(t.priceEnd) > 0 && !ph.length) { const a = num(t.price), b = num(t.priceEnd); return num(t.qty) * (mode === "start" ? a : mode === "end" ? b : (a + b) / 2); }
  if (mode === "start" && ph.length) return num(t.qty) * num(ph[0].price);
  if (mode === "end") return num(t.qty) * num(t.price || ph.at(-1)?.price);
  if (!ph.length) return num(t.qty) * num(t.price);
  let left = num(t.qty), rev = 0;
  const withQty = ph.filter((p) => num(p.qty) > 0);
  if (withQty.length) { for (const p of withQty) { const q = Math.min(left, num(p.qty)); rev += q * num(p.price); left -= q; } return rev + left * num(t.price || ph.at(-1).price); }
  const prices = [...ph.map((p) => num(p.price)), num(t.price) || ph.at(-1).price];
  return num(t.qty) * prices.reduce((a, b) => a + b, 0) / prices.length;
}
export function currentPrice(t, today = new Date().toISOString().slice(0, 10)) {
  const p = (t.phases || []).filter((x) => x.until && num(x.price) > 0).sort((a, b) => a.until.localeCompare(b.until)).find((x) => x.until >= today);
  return p ? num(p.price) : num(t.price);
}
export function compute(c0, mode = "avg") {
  const c = { ...emptyCalc(), ...(c0 || {}) };
  const G = Math.max(0, num(c.guests));
  const locGross = num(c.location?.net) * (1 + num(c.location?.vat) / 100);
  const lines = [];
  if (locGross) lines.push(["Location (brutto)", locGross]);
  for (const [id, label, kind] of COSTS) {
    const x = c.costs?.[id]; if (!x || x.st !== "cost") continue;
    const v = kind === "staff" ? num(x.persons) * num(x.hours) * num(x.rate) + num(x.amount) : num(x.amount);
    if (v) lines.push([label, v]);
  }
  for (const x of c.extra || []) if (num(x.amount)) lines.push([x.name || "Extra", num(x.amount)]);
  const fixed = lines.reduce((s, l) => s + l[1], 0);
  const buffer = fixed * num(c.buffer) / 100;
  const tix = (c.tickets || []).filter((t) => num(t.qty));
  const tixQty = tix.reduce((s, t) => s + num(t.qty), 0);
  const fee = c.feeBuyer ? 0 : num(c.feePct) / 100;
  const tixRev = tix.reduce((s, t) => s + catRevenue(t, mode), 0) * (1 - fee);
  const paid = Math.max(0, tixQty - num(c.free));
  const avgPrice = tixQty ? tixRev / tixQty : 0;
  const doorRev = num(c.door?.qty) * num(c.door?.price);
  const barRev = (c.bar || []).reduce((s, b) => s + num(b.sell) * num(b.per) * G, 0);
  const barBuy = (c.bar || []).reduce((s, b) => s + num(b.buy) * num(b.per) * G, 0);
  const ward = num(c.wardrobe?.price) * G * num(c.wardrobe?.rate) / 100;
  const perGuestExtra = G ? (barRev - barBuy + ward) / G : 0;
  const costs = fixed + buffer + barBuy;
  const income = tixRev * (paid / (tixQty || 1)) + doorRev + barRev + ward;
  const totalFixed = fixed + buffer;
  const beAll = avgPrice + perGuestExtra > 0 ? Math.ceil(totalFixed / (avgPrice + perGuestExtra)) : null;
  const beTickets = avgPrice > 0 ? Math.ceil(totalFixed / avgPrice) : null;
  const scen = [0.5, 0.75, 1].map((p) => { const g = Math.round(G * p); return [p, g, r2(g * avgPrice + g * perGuestExtra - totalFixed)]; });
  const hasRange = mode === "avg" && tix.some((t) => num(t.priceEnd) > 0 || (t.phases || []).length);
  const priceScen = hasRange ? [["Anfangspreise", "start"], ["Durchschnitt", "avg"], ["Endpreise", "end"]].map(([l, m]) => { const X = m === "avg" ? null : compute(c0, m); return [l, X ? X.result : null, X ? X.beAll : null, X ? X.tixRev : null]; }) : null;
  return { priceScen, G, lines, fixed: r2(fixed), buffer: r2(buffer), locGross: r2(locGross), tixQty, paid, tixRev: r2(tixRev), avgPrice: r2(avgPrice), doorRev: r2(doorRev), barRev: r2(barRev), barBuy: r2(barBuy), ward: r2(ward),
    perGuestExtra: r2(perGuestExtra), costs: r2(costs), income: r2(income), result: r2(income - costs), beAll, beTickets, scen, totalFixed: r2(totalFixed) };
}

// ---------------------------------------------------------------- Ticket-Analyse
// tickets: { sold, revenue, capacity, tiers, daily:[{d,n}] } · snaps: [{at, sold}] (optional, für Uhrzeiten)
export function analyze({ tickets = {}, eventDate, capacity, breakEven, snaps = [] }) {
  const sold = num(tickets.sold), cap = num(capacity || tickets.capacity);
  let daily = Array.isArray(tickets.daily) ? tickets.daily.filter((x) => /^\d{4}-\d{2}-\d{2}$/.test(x.d)) : [];
  if (!daily.length && snaps.length > 1) { const m = new Map(); for (let i = 1; i < snaps.length; i++) { const dd = new Date(snaps[i].at).toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" }); m.set(dd, (m.get(dd) || 0) + Math.max(0, snaps[i].sold - snaps[i - 1].sold)); } daily = [...m].map(([d, n]) => ({ d, n })); }
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Berlin" });
  const first = daily[0]?.d;
  const daysSince = first ? Math.max(1, Math.round((Date.parse(today) - Date.parse(first)) / 864e5) + 1) : null;
  const avgDay = daysSince ? sold / daysSince : null;
  const last7 = daily.filter((x) => Date.parse(x.d) > Date.parse(today) - 7 * 864e5).reduce((s, x) => s + x.n, 0);
  const rate7 = daily.length ? last7 / Math.min(7, daysSince || 7) : null;
  const daysLeft = eventDate ? Math.max(0, Math.ceil((new Date(eventDate) - Date.now()) / 864e5)) : null;
  const rate = rate7 ?? avgDay;
  const forecast = rate !== null && daysLeft !== null ? Math.round(sold + rate * daysLeft) : null;
  const needSell = cap && daysLeft ? Math.max(0, cap - sold) / Math.max(1, daysLeft) : null;
  const needBE = breakEven && daysLeft ? Math.max(0, breakEven - sold) / Math.max(1, daysLeft) : null;
  const soldOutIn = rate > 0 && cap ? Math.ceil(Math.max(0, cap - sold) / rate) : null;
  const wd = [0, 0, 0, 0, 0, 0, 0]; for (const x of daily) wd[(new Date(`${x.d}T12:00:00`).getDay() + 6) % 7] += x.n;
  const hours = Array(24).fill(0); let hasHours = false;
  for (let i = 1; i < snaps.length; i++) { const dlt = snaps[i].sold - snaps[i - 1].sold; if (dlt > 0) { hasHours = true; hours[+new Date(snaps[i].at).toLocaleString("de-DE", { hour: "2-digit", hour12: false, timeZone: "Europe/Berlin" })] += dlt; } }
  const best = daily.reduce((b, x) => (x.n > (b?.n || 0) ? x : b), null);
  return { sold, cap, daily, daysSince, avgDay, rate7, rate, daysLeft, forecast, needSell, needBE, soldOutIn, wd, hours, hasHours, best, revenue: num(tickets.revenue) };
}

const bars = (vals, labels, unit = "") => { const mx = Math.max(1, ...vals); return h("div.cbars", vals.map((v, i) => h("div.cbar", { title: `${labels[i]}: ${v}${unit}` }, h("i", { style: { height: `${Math.round(v / mx * 100)}%` } }), h("span", labels[i])))); };
const kpi = (label, val, sub, tone) => h("div.ckpi", { class: tone || "" }, h("small", label), h("b", val), sub ? h("span", sub) : null);
const f1 = (x) => (x === null || x === undefined ? "–" : x.toLocaleString("de-DE", { maximumFractionDigits: 1 }));

// ---------------------------------------------------------------- Karte auf der Event-Seite
export function calcCard({ name, calc, tickets, eventDate, capacity, snaps = [], onSave, note = "", onSync = null, details = null, onSaveAll = null }) {
  const body = h("div.stack", { style: { gap: "14px" } });
  const draw = () => {
    const R = calc && (calc.tickets || calc.location) ? compute(calc) : null;
    const A = analyze({ tickets, eventDate, capacity: capacity || R?.tixQty, breakEven: R?.beAll ?? R?.beTickets, snaps });
    const hasT = tickets && tickets.sold !== undefined;
    const ok = (A.forecast ?? 0) >= (R?.beAll ?? Infinity);
    body.replaceChildren(
      note ? h("div.banner", icon("info"), h("div", note)) : null,
      R ? h("div.ckpis",
        kpi("Kosten gesamt", fmtEUR(R.costs), `fix ${fmtEUR(R.totalFixed)}${R.barBuy ? ` + Bar-Einkauf ${fmtEUR(R.barBuy)}` : ""}`),
        kpi("Einnahmen (Plan)", fmtEUR(R.income), `Tickets ${fmtEUR(R.tixRev)} · Bar ${fmtEUR(R.barRev)} · Garderobe ${fmtEUR(R.ward)}`),
        h("button.ckpi.ckpi-btn", { type: "button", class: R.result >= 0 ? "good" : "bad", title: "Wo kommt das Ergebnis her?", onclick: () => breakdownModal(calc, name) }, h("small", "Ergebnis (Plan) – antippen"), h("b", fmtEUR(R.result)), h("span", R.result < 0 ? "Wo kommt das Minus her? →" : `${R.G} Gäste · Aufschlüsselung →`)),
        kpi("Break-even", R.beAll ? `${R.beAll} Gäste` : "–", R.beTickets ? `nur Tickets: ${R.beTickets} · Ø Ticket ${fmtEUR(R.avgPrice)}` : "Ticketpreis fehlt")) : h("div.faint", "Noch keine Kalkulation – „Kalkulation bearbeiten“ öffnet das Formular mit allen Kosten, Tickets, Bar und Garderobe."),
      R?.priceScen ? h("div.row.wrap", { style: { gap: "8px" } }, ...R.priceScen.map(([l, v, be, tr]) => { const val = v ?? R.result, b = be ?? R.beAll, t = tr ?? R.tixRev; return h("span.badge", { class: val >= 0 ? "b-ok" : "b-bad" }, `${l}: Tickets ${fmtEUR(t)} · Ergebnis ${fmtEUR(val)} · Break-even ${b ?? "–"}`); })) : null,
      calc?.tickets?.some((t) => (t.phases || []).length) ? h("div.row.wrap", { style: { gap: "6px" } }, ...calc.tickets.filter((t) => t.name).map((t) => h("span.badge.b-pri", `${t.name}: jetzt ${fmtEUR(currentPrice(t))}`))) : null,
      R ? h("div.row.wrap", { style: { gap: "8px" } }, ...R.scen.map(([p, g, v]) => h("span.badge", { class: v >= 0 ? "b-ok" : "b-bad" }, `${Math.round(p * 100)} % (${g} Gäste): ${fmtEUR(v)}`))) : null,
      hasT ? h("div.stack", { style: { gap: "10px" } }, h("b", "Ticketverkauf"),
        h("div.ckpis",
          kpi("Verkauft", `${A.sold}${A.cap ? ` / ${A.cap}` : ""}`, A.revenue ? `Umsatz ${fmtEUR(A.revenue)}` : ""),
          kpi("Tempo", A.rate !== null ? `${f1(A.rate)} / Tag` : "–", A.avgDay !== null ? `Ø seit Start ${f1(A.avgDay)} / Tag · letzte 7 Tage ${f1(A.rate7)}` : "Verlauf sammelt sich noch"),
          kpi("Prognose bis Event", A.forecast !== null ? `${Math.min(A.forecast, A.cap || A.forecast)} Tickets` : "–", A.daysLeft !== null ? `noch ${A.daysLeft} Tage${A.soldOutIn !== null && A.soldOutIn <= (A.daysLeft ?? 0) ? ` · ausverkauft in ca. ${A.soldOutIn} Tagen` : ""}` : "", R?.beAll ? (ok ? "good" : "bad") : ""),
          kpi("Nötig pro Tag", A.needBE !== null ? `${f1(A.needBE)} für Break-even` : A.needSell !== null ? `${f1(A.needSell)} zum Ausverkaufen` : "–", A.needSell !== null && A.needBE !== null ? `${f1(A.needSell)} zum Ausverkaufen` : "")),
        R?.beAll && A.forecast !== null ? h("div.na-note", icon(ok ? "check" : "alert"), h("div", ok ? `Mit dem aktuellen Tempo schaffst du den Break-even (${R.beAll} Gäste) bis zum Event.` : `Mit dem aktuellen Tempo fehlen bis zum Event ca. ${Math.max(0, R.beAll - A.forecast)} Tickets bis zum Break-even – Werbung verstärken, Preisstufe oder Kosten anpassen.`)) : null,
        A.daily.length ? h("div", h("div.faint", { style: { fontSize: "12px" } }, `Verkäufe pro Tag${A.best ? ` · bester Tag ${new Date(A.best.d).toLocaleDateString("de-DE")} (${A.best.n})` : ""}`), bars(A.daily.slice(-30).map((x) => x.n), A.daily.slice(-30).map((x) => x.d.slice(8, 10) + "." + x.d.slice(5, 7)))) : null,
        A.daily.length ? h("div.grid.g-2", h("div", h("div.faint", { style: { fontSize: "12px" } }, "Nach Wochentag"), bars(A.wd, ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"])),
          h("div", h("div.faint", { style: { fontSize: "12px" } }, "Nach Uhrzeit"), A.hasHours ? bars(A.hours, A.hours.map((_, i) => String(i))) : h("p.faint", { style: { fontSize: "12.5px" } }, "Wird ab der Freischaltung des Ticket-Verlaufs gesammelt."))) : null,
        Array.isArray(tickets.tiers) && tickets.tiers.length ? h("div.row.wrap", { style: { gap: "6px" } }, tickets.tiers.map((t) => h("span.badge.b-idle", `${t.name}: ${t.sold}${t.capacity ? `/${t.capacity}` : ""}`))) : null) : null,
      h("div.row.wrap", { style: { gap: "8px" } },
        onSaveAll ? h("button.btn.primary.sm", { onclick: () => eventSheet({ name, tiers: tickets?.tiers || [], calc: calc || emptyCalc({ capacity }), details: details || {}, onSave: async (x) => { await onSaveAll(x); calc = x.calc; details = x.details; draw(); } }) }, icon("edit"), "Event-Formular (alles)")
          : h("button.btn.primary.sm", { onclick: () => calcModal({ name, tiers: tickets?.tiers || [], calc: calc || emptyCalc({ capacity }), onSave: async (c) => { await onSave(c); calc = c; draw(); } }) }, icon("edit"), "Kalkulation bearbeiten"),
        onSync ? h("button.btn.sm", { onclick: onSync, title: "Event und Kalkulation mit den Daten aus dem Projekt aktualisieren" }, icon("refresh"), "Mit Projekt aktualisieren") : null,
        h("button.btn.sm", { onclick: (e) => summarize(e.currentTarget) }, icon("sparkles"), "KI fasst zusammen")),
      out);
  };
  const out = h("div");
  const summarize = async (b) => {
    b.disabled = true; out.replaceChildren(h("div.faint", h("span.spinner"), " KI rechnet nach …"));
    try {
      const R = calc ? compute(calc) : null, A = analyze({ tickets, eventDate, capacity: capacity || R?.tixQty, breakEven: R?.beAll });
      const r = await aiGen({ task: "kalkulation", maxTokens: 2000, instructions: "Fasse die Event-Kalkulation und den Ticketverkauf kurz zusammen (Markdown): **Lage** (2 Sätze), **Zahlen** (Kosten, Einnahmen, Ergebnis, Break-even, Prognose), **Risiken**, **3 konkrete Hebel** (z. B. Preis, Kosten, Werbung, Bar). Rechne nur mit den gegebenen Zahlen, nichts erfinden.",
        input: JSON.stringify({ event: name, kalkulation: R && { ...R, lines: R.lines }, eingaben: calc, tickets: { ...A, daily: A.daily.slice(-30) } }).slice(0, 15000) });
      out.replaceChildren(h("div.md", md(r.text)));
    } catch (e) { out.replaceChildren(h("div.banner.bad", errMsg(e))); }
    b.disabled = false;
  };
  draw();
  return h("section.card", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3.row", { style: { gap: "6px" } }, icon("wallet"), "Kalkulation & Ticket-Analyse")), h("div.card-body", body));
}

// ---------------------------------------------------------------- Formular (Modal + im Event-Assistenten)
export function calcModal({ name, calc, onSave, tiers = [] }) {
  const c = JSON.parse(JSON.stringify(calc));
  const res = h("div.calc-res");
  const save = h("button.btn.primary", { onclick: async (e) => {
    e.currentTarget.disabled = true; try { await onSave(c); m.close(); toast("Kalkulation gespeichert – alles neu berechnet"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("check"), "Speichern");
  const m = modal(`Kalkulation: ${name}`.slice(0, 80), h("div.stack", { style: { gap: "12px" } }, calcForm(c, () => drawRes(), { tiers }), h("div.row", { style: { justifyContent: "flex-end" } }, save)), { wide: true });
  { const mb = m.el.querySelector(".modal-body"); if (mb) mb.before(res); else m.el.prepend(res); }
  const drawRes = () => { const R = compute(c); const cell = (l, v, tone) => h("div", h("small", l), h("b", { style: tone ? { color: tone } : null }, v));
    res.replaceChildren(cell("Kosten", fmtEUR(R.costs)), cell("Einnahmen", fmtEUR(R.income)), cell("Ergebnis", fmtEUR(R.result), R.result >= 0 ? "var(--ok)" : "var(--bad)"),
      cell("Break-even", R.beAll ? `${R.beAll} Gäste` : "–"), cell("nur Tickets", R.beTickets ? `${R.beTickets}` : "–"), cell("Ø Ticket", fmtEUR(R.avgPrice)), cell("Bar+Gard./Gast", fmtEUR(R.perGuestExtra)),
      ...(R.priceScen || []).map(([l, v, be]) => cell(l, `${fmtEUR(v ?? R.result)} · BE ${be ?? R.beAll ?? "–"}`, (v ?? R.result) >= 0 ? "var(--ok)" : "var(--bad)")),
      ...R.scen.map(([p, g, v]) => cell(`${Math.round(p * 100)} % (${g})`, fmtEUR(v), v >= 0 ? "var(--ok)" : "var(--bad)"))); };
  drawRes();
}

export function calcForm(c, onChange, opts = {}) {
  const ch = () => onChange?.(c);
  const n = (obj, key, label, opt = {}) => { const el = h("input.input", { type: "number", min: 0, step: opt.step || "any", value: obj[key] ?? "", placeholder: opt.ph || "", oninput: (e) => { obj[key] = e.target.value === "" ? "" : +e.target.value; ch(); } }); el.setAttribute("aria-label", label); return h("div.field", h("label", label), el); };
  const t = (obj, key, label) => { const el = h("input.input", { value: obj[key] ?? "", oninput: (e) => { obj[key] = e.target.value; ch(); } }); el.setAttribute("aria-label", label); return h("div.field", h("label", label), el); };
  c.location ||= { net: 0, vat: 19 }; c.costs ||= {}; c.tickets ||= []; c.bar ||= []; c.wardrobe ||= { price: 2, rate: 60 }; c.door ||= { qty: 0, price: 0 };
  const costRow = ([id, label, kind, locable, hint]) => {
    const x = (c.costs[id] ||= { st: "no" });
    const detail = h("div.calc-detail");
    const drawD = () => detail.replaceChildren(x.st !== "cost" ? null : kind === "staff"
      ? h("div.calc-grid4", n(x, "persons", "Personen"), n(x, "hours", "Stunden"), n(x, "rate", "€ / Std."), n(x, "amount", "+ Pauschale €"))
      : h("div.calc-grid4", n(x, "amount", "Betrag €")), hint && x.st === "cost" ? h("div.hint", hint) : null);
    const seg = h("div.calc-seg", [["no", "nicht nötig"], ...(locable ? [["loc", "im Location-Preis"]] : []), ["cost", "Kosten"]].map(([v, l]) => h("button.chip", { type: "button", class: x.st === v ? "on" : "", onclick: (e) => { x.st = v; e.currentTarget.parentElement.querySelectorAll(".chip").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); drawD(); ch(); } }, l)));
    drawD();
    return h("div.calc-row", h("div.calc-row-h", h("b", label), seg), detail);
  };
  const listEditor = (arr, cols, empty) => {
    const box = h("div.stack", { style: { gap: "6px" } });
    const draw = () => box.replaceChildren(...arr.map((row, i) => h("div.calc-line", ...cols.map(([k, l, type]) => { const el = h("input.input", { type: type || "text", min: 0, step: "any", value: row[k] ?? "", placeholder: l, oninput: (e) => { row[k] = type === "number" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value; ch(); } }); el.setAttribute("aria-label", l); return el; }),
      h("button.icon-btn", { type: "button", "aria-label": "Entfernen", onclick: () => { arr.splice(i, 1); draw(); ch(); } }, icon("x")))),
      h("button.btn.sm.ghost", { type: "button", onclick: () => { arr.push({ ...empty }); draw(); ch(); } }, icon("plus"), "Zeile hinzufügen"));
    draw(); box.redraw = draw; return box;
  };
  // Tickets: Kategorie, Anzahl, Endpreis + Preisstufen (bis Datum → Preis, optional Kontingent)
  const ticketEd = h("div.stack", { style: { gap: "8px" } });
  ticketEd.redraw = () => ticketEd.replaceChildren(...c.tickets.map((t, i) => {
    t.phases ||= [];
    const inp = (obj, k, l, type) => { const el = h("input.input", { type: type || "text", min: 0, step: "any", value: obj[k] ?? "", placeholder: l, oninput: (e) => { obj[k] = type === "number" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value; ch(); } }); el.setAttribute("aria-label", l); return el; };
    const phBox = h("div.stack", { style: { gap: "4px" } });
    const drawPh = () => phBox.replaceChildren(...t.phases.map((p, j) => h("div.calc-phase", h("span.faint", "bis"), inp(p, "until", "Datum", "date"), inp(p, "price", "Preis €", "number"), inp(p, "qty", "Kontingent (optional)", "number"),
      h("button.icon-btn", { type: "button", "aria-label": "Preisstufe entfernen", onclick: () => { t.phases.splice(j, 1); drawPh(); ch(); } }, icon("x")))));
    drawPh();
    return h("div.calc-ticket", h("div.calc-line.calc-line5", inp(t, "name", "Kategorie"), inp(t, "qty", "Anzahl", "number"), inp(t, "price", "Startpreis €", "number"), inp(t, "priceEnd", "Endpreis € (falls er steigt)", "number"),
      h("button.icon-btn", { type: "button", "aria-label": "Kategorie entfernen", onclick: () => { c.tickets.splice(i, 1); ticketEd.redraw(); ch(); } }, icon("x"))),
      h("div.faint", { style: { fontSize: "11.5px" } }, "Gerechnet wird mit dem Durchschnitt aus Start- und Endpreis; Anfangs- und Endpreis-Szenario werden extra gezeigt."),
      phBox, t.phases.length ? null : h("button.btn.sm.ghost", { type: "button", onclick: () => { t.phases.push({ until: "", price: "", qty: "" }); drawPh(); ch(); } }, icon("plus"), "Genauer: Preisstufen mit Datum"));
  }), h("button.btn.sm", { type: "button", onclick: () => { c.tickets.push({ name: "", qty: "", price: "", priceEnd: "", phases: [] }); ticketEd.redraw(); ch(); } }, icon("plus"), "Ticket-Kategorie hinzufügen"));
  ticketEd.redraw();
  const barEd = listEditor(c.bar, [["name", "Getränk"], ["sell", "Verkauf €", "number"], ["buy", "Einkauf €", "number"], ["per", "pro Gast", "number"]], { name: "", sell: "", buy: "", per: "" });
  const DRINKS = [["Wasser 0,5 l", 2.5, 0.4, 0.6], ["Cola / Softdrink", 3.5, 0.75, 0.6], ["Bier", 4, 1.0, 0.8], ["Mate / Energy", 4, 1.1, 0.4], ["Longdrink (ab 18)", 7, 1.8, 0.5]];
  return h("div.stack.calc-form", { style: { gap: "12px" } },
    h("details.evw-group", { open: true }, h("summary", h("b", "Gäste & Location")), h("div.stack", { style: { gap: "8px", paddingBottom: "8px" } },
      h("div.calc-grid4", n(c, "guests", "Erwartete Gäste"), n(c.location, "net", "Location netto €"), (() => { const el = h("select.input", { "aria-label": "MwSt", onchange: (e) => { c.location.vat = +e.target.value; ch(); } }, [0, 7, 19].map((v) => h("option", { value: v, selected: +c.location.vat === v }, `${v} %`))); return h("div.field", h("label", "MwSt"), el); })(), n(c, "buffer", "Puffer %", { ph: "z. B. 5" })),
      t(c.location, "note", "Was ist im Location-Preis enthalten? (Notiz)"))),
    h("details.evw-group", { open: true }, h("summary", h("b", "Alle möglichen Kosten"), h("span.faint", " – je Posten: nicht nötig / im Location-Preis / Kosten")), h("div.stack", { style: { gap: "6px", paddingBottom: "8px" } }, ...COSTS.map(costRow),
      h("div.faint", { style: { fontSize: "12.5px" } }, "Weitere Kosten:"), listEditor((c.extra ||= []), [["name", "Posten"], ["amount", "€", "number"]], { name: "", amount: "" }))),
    h("details.evw-group", { open: true }, h("summary", h("b", "Tickets")), h("div.stack", { style: { gap: "8px", paddingBottom: "8px" } },
      ticketEd,
      opts.tiers?.length ? h("button.btn.sm", { type: "button", onclick: () => { c.tickets = opts.tiers.filter((x) => num(x.capacity) || num(x.sold)).map((x) => ({ name: x.name, qty: num(x.capacity) || num(x.sold), price: num(x.sold) ? r2(num(x.revenue) / num(x.sold)) : num(x.price), phases: [] })); ticketEd.redraw(); ch(); toast("Kategorien aus Eventfrog übernommen – Preis = bisheriger Ø-Preis; Preisstufen bitte ergänzen"); } }, icon("refresh"), "Aus Eventfrog übernehmen") : null,
      h("div.calc-grid4", n(c, "free", "Freikarten"), n(c.door, "qty", "Abendkasse Anzahl"), n(c.door, "price", "Abendkasse Preis €"), n(c, "feePct", "Ticket-Gebühr % (wenn du zahlst)")),
      h("label.check", h("input", { type: "checkbox", checked: c.feeBuyer !== false, onchange: (e) => { c.feeBuyer = e.target.checked; ch(); } }), "Gebühr zahlen die Käufer"))),
    h("details.evw-group", { open: true }, h("summary", h("b", "Bar & Garderobe")), h("div.stack", { style: { gap: "8px", paddingBottom: "8px" } },
      h("div.faint", { style: { fontSize: "12.5px" } }, "Getränke: Verkaufspreis, Einkaufspreis und wie viele pro Gast (z. B. 0,5 = jeder zweite)."),
      h("div.calc-line.faint", { style: { fontSize: "11.5px" } }, h("span", "Getränk"), h("span", "Verkauf €"), h("span", "Einkauf €"), h("span", "pro Gast"), h("span")),
      barEd,
      c.bar.length ? null : h("button.btn.sm", { type: "button", onclick: (e) => { DRINKS.forEach(([name, sell, buy, per]) => c.bar.push({ name, sell, buy, per })); barEd.redraw(); e.currentTarget.remove(); ch(); } }, icon("plus"), "Typische Getränke einsetzen (Schätzpreise)"),
      h("div.calc-grid4", n(c.wardrobe, "price", "Garderobe € / Teil"), n(c.wardrobe, "rate", "% der Gäste nutzen sie"), n(c, "change", "Wechselgeld € (kommt zurück)")))));
}

// Neue Kalkulation (z. B. aus dem Projekt) mit der alten zusammenführen: leere/0-Werte überschreiben nie vorhandene Angaben
export function mergeCalc(oldC, newC) {
  if (!oldC) return newC;
  const empty = (v) => v === null || v === undefined || v === "" || v === 0 || (Array.isArray(v) && !v.length) || (typeof v === "object" && !Array.isArray(v) && !Object.values(v).some((x) => !empty(x)));
  const m = (a, b) => {
    if (Array.isArray(b)) return empty(b) ? a : b;
    if (b && typeof b === "object") { const out = { ...(a || {}) }; for (const k of Object.keys(b)) out[k] = m(a?.[k], b[k]); return out; }
    return empty(b) ? a : b;
  };
  return m(oldC, newC);
}

// ---------------------------------------------------------------- Event-Steckbrief (Formular statt Beschreibungstext)
export const DETAILS = [
  ["Allgemein", [["venue", "Location (Name)"], ["address", "Adresse / Eingang"], ["start", "Beginn (Uhrzeit)", "time"], ["end", "Ende (Uhrzeit)", "time"], ["entry", "Einlass ab (Uhrzeit)", "time"], ["age", "Mindestalter", "select", ["", "ohne", "16+", "18+"]], ["u18", "Unter 18 bis (Uhrzeit)", "time"]]],
  ["Programm", [["lineup", "Line-up / DJs / Acts (eine Zeile pro Act)", "area"], ["genre", "Musikrichtung / Stil"], ["motto", "Motto / Dresscode"]]],
  ["Preise vor Ort", [["wardrobe", "Garderobe (€ pro Teil)", "number"], ["drinks", "Getränke & Preise (eine Zeile: Getränk | Preis)", "area"], ["payment", "Zahlung vor Ort", "select", ["", "nur bar", "bar + Karte", "nur Karte"]]]],
  ["Sicherheit & Notfall", [["security", "Security (Firma / Anzahl Personen)"], ["sani", "Sanitäter / Erste Hilfe"], ["firstaid", "Ersthelfer im Team (Namen)"], ["emergency", "Notfallkontakt (Name + Telefon)"], ["exits", "Notausgänge / Sammelplatz"], ["awareness", "Awareness-Team / Ansprechperson"]]],
  ["Links", [["tickets", "Ticket-Link", "url"], ["website", "Website", "url"], ["instagram", "Instagram", "url"], ["tiktok", "TikTok", "url"], ["whatsapp", "WhatsApp-Gruppe", "url"], ["spotify", "Spotify / Playlist", "url"]]],
  ["Regeln & Infos", [["rules", "Hausordnung / Regeln (eine pro Zeile)", "area"], ["info", "Weitere Infos für Gäste", "area"]]],
];
export const detailsText = (d = {}) => [...DETAILS.flatMap(([, fs]) => fs).filter(([k]) => d[k] !== undefined && d[k] !== "").map(([k, l]) => `${l.replace(/ \(.*\)$/, "")}: ${d[k]}`), ...(d.custom || []).filter((x) => x.label).map((x) => `${x.label}: ${x.value}`)].join("\n");
export function detailsModal({ name, details = {}, onSave }) {
  const d = { ...details };
  const fld = ([k, l, type, opts]) => {
    const el = type === "area" ? h("textarea.input", { rows: 3, maxlength: 3000, oninput: (e) => { d[k] = e.target.value; } }, d[k] || "")
      : type === "select" ? h("select.input", { onchange: (e) => { d[k] = e.target.value; } }, opts.map((o) => h("option", { value: o, selected: d[k] === o }, o || "– wählen –")))
        : h("input.input", { type: type === "url" ? "url" : type || "text", value: d[k] ?? "", placeholder: type === "url" ? "https://…" : "", step: "any", oninput: (e) => { d[k] = e.target.value; } });
    el.setAttribute("aria-label", l);
    return h("div.field", { style: type === "area" ? { gridColumn: "1 / -1" } : null }, h("label", l), el);
  };
  const m = modal(`Steckbrief: ${name}`.slice(0, 80), h("div.stack", { style: { gap: "10px" } },
    h("p.muted", { style: { margin: 0 } }, "Alle Infos zum Event als Formular – die KI nutzt sie für Nachrichten, Website, Plakate und Zusammenfassungen. Nichts mehr in einen langen Text schreiben."),
    ...DETAILS.map(([t, fs]) => h("details.evw-group", { open: true }, h("summary", h("b", t)), h("div.grid.g-2", { style: { paddingBottom: "8px" } }, fs.map(fld)))),
    h("div.row", { style: { justifyContent: "flex-end" } }, h("button.btn.primary", { onclick: async (e) => { e.currentTarget.disabled = true; try { await onSave(d); m.close(); toast("Steckbrief gespeichert"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("check"), "Speichern"))), { wide: true });
}

// ---------------------------------------------------------------- Wo kommt das Minus her? (Aufschlüsselung + Lösungen)
export function breakdownModal(c, name = "") {
  const R = compute(c);
  const costs = [...R.lines.map(([l, v]) => [l, v]), ...(R.buffer ? [["Puffer", R.buffer]] : []), ...(R.barBuy ? [["Getränke-Einkauf (Bar)", R.barBuy]] : [])].sort((a, b) => b[1] - a[1]);
  const inc = [["Tickets", R.tixRev * (R.paid / (R.tixQty || 1))], ["Abendkasse", R.doorRev], ["Bar-Umsatz", R.barRev], ["Garderobe", R.ward]].filter((x) => x[1] > 0);
  const tot = Math.max(R.costs, R.income, 1);
  const row = (l, v, color) => h("div.bd-row", h("span", l), h("i", { style: { width: `${Math.max(2, v / tot * 100)}%`, background: color } }), h("b", fmtEUR(v)));
  const gap = -R.result;
  const fixes = gap > 0 ? [
    R.paid ? `Ticketpreis um ca. ${fmtEUR(Math.ceil(gap / R.paid * 100) / 100)} erhöhen (bei ${R.paid} verkauften Tickets)` : null,
    R.avgPrice + R.perGuestExtra > 0 ? `oder ca. ${Math.ceil(gap / (R.avgPrice + R.perGuestExtra))} Gäste mehr (je Gast ${fmtEUR(R.avgPrice + R.perGuestExtra)} Einnahmen)` : null,
    costs[0] ? `oder den größten Posten „${costs[0][0]}“ (${fmtEUR(costs[0][1])}) um ${fmtEUR(Math.min(gap, costs[0][1]))} senken` : null,
    !R.ward ? "Garderobe ist noch nicht eingetragen – z. B. 2 € pro Teil bringt bei 70 % der Gäste zusätzlich Geld" : null,
    !R.barRev ? "Bar ist noch nicht eingetragen – Getränkeverkauf ist oft der größte Gewinn" : null].filter(Boolean) : [];
  modal(`Wo kommt das ${gap > 0 ? "Minus" : "Plus"} her?${name ? ` – ${name}` : ""}`.slice(0, 80), h("div.stack", { style: { gap: "12px" } },
    h("div.na-note", icon(gap > 0 ? "alert" : "check"), h("div", gap > 0 ? `Dir fehlen ${fmtEUR(gap)}. Einnahmen ${fmtEUR(R.income)} – Kosten ${fmtEUR(R.costs)}.` : `Plus von ${fmtEUR(-gap)}. Einnahmen ${fmtEUR(R.income)} – Kosten ${fmtEUR(R.costs)}.`)),
    h("b", "Kosten (größte zuerst)"), ...costs.map(([l, v]) => row(l, v, "var(--bad)")),
    h("b", "Einnahmen"), ...(inc.length ? inc.map(([l, v]) => row(l, v, "var(--ok)")) : [h("div.faint", "Noch keine Einnahmen eingetragen.")]),
    fixes.length ? h("div", h("b", "So kommst du ins Plus"), h("ul", fixes.map((f) => h("li", f)))) : null,
    h("div.faint", { style: { fontSize: "12.5px" } }, `Break-even: ${R.beAll ?? "–"} Gäste · ${R.G} Gäste geplant · Ø Ticket ${fmtEUR(R.avgPrice)} · Bar + Garderobe pro Gast ${fmtEUR(R.perGuestExtra)}`)), { wide: true });
}

// ---------------------------------------------------------------- EIN Formular für alles (Steckbrief + Kalkulation + eigene Felder)
export function eventSheet({ name, calc, details = {}, tiers = [], onSave }) {
  const c = JSON.parse(JSON.stringify(calc || emptyCalc()));
  const d = { ...details, custom: [...(details.custom || [])] };
  const res = h("button.calc-res", { type: "button", title: "Klicken: Wo kommt das Ergebnis her?", onclick: () => breakdownModal(c, name) });
  const drawRes = () => { const R = compute(c); const cell = (l, v, tone) => h("div", h("small", l), h("b", { style: tone ? { color: tone } : null }, v));
    res.replaceChildren(cell("Kosten", fmtEUR(R.costs)), cell("Einnahmen", fmtEUR(R.income)), cell(R.result < 0 ? "Ergebnis – tippen: woher?" : "Ergebnis", fmtEUR(R.result), R.result >= 0 ? "var(--ok)" : "var(--bad)"), cell("Break-even", R.beAll ? `${R.beAll} Gäste` : "–"),
      ...(R.priceScen || []).filter((x) => x[1] !== null).map(([l, v]) => cell(l, fmtEUR(v), v >= 0 ? "var(--ok)" : "var(--bad)"))); };
  const fld = ([k, l, type, opts]) => {
    const el = type === "area" ? h("textarea.input", { rows: 2, maxlength: 3000, oninput: (e) => { d[k] = e.target.value; } }, d[k] || "")
      : type === "select" ? h("select.input", { onchange: (e) => { d[k] = e.target.value; } }, opts.map((o) => h("option", { value: o, selected: d[k] === o }, o || "– wählen –")))
        : h("input.input", { type: type === "url" ? "url" : type || "text", value: d[k] ?? "", placeholder: type === "url" ? "https://…" : "", step: "any", oninput: (e) => { d[k] = e.target.value; } });
    el.setAttribute("aria-label", l);
    return h("div.field", { style: type === "area" ? { gridColumn: "1 / -1" } : null }, h("label", l), el);
  };
  const group = (title, open, ...kids) => h("details.evw-group.sheet-group", { open }, h("summary", h("b", title)), h("div.stack", { style: { gap: "8px", paddingBottom: "10px" } }, ...kids));
  const customBox = h("div.stack", { style: { gap: "6px" } });
  const drawCustom = () => customBox.replaceChildren(...d.custom.map((x, i) => h("div.calc-line", { style: { gridTemplateColumns: "minmax(0,1fr) minmax(0,2fr) auto" } },
    (() => { const e = h("input.input", { value: x.label || "", placeholder: "Feld (z. B. Parkplätze)", oninput: (ev) => { x.label = ev.target.value; } }); e.setAttribute("aria-label", "Feldname"); return e; })(),
    (() => { const e = h("input.input", { value: x.value || "", placeholder: "Inhalt", oninput: (ev) => { x.value = ev.target.value; } }); e.setAttribute("aria-label", "Inhalt"); return e; })(),
    h("button.icon-btn", { type: "button", "aria-label": "Feld entfernen", onclick: () => { d.custom.splice(i, 1); drawCustom(); } }, icon("x")))),
    h("button.btn.sm", { type: "button", onclick: () => { d.custom.push({ label: "", value: "" }); drawCustom(); } }, icon("plus"), "Eigenes Feld hinzufügen"));
  drawCustom();
  const cf = calcForm(c, () => drawRes(), { tiers });
  const calcGroups = [...cf.querySelectorAll(":scope > details")];
  const dg = Object.fromEntries(DETAILS.map(([t, fs]) => [t, h("div.grid.g-2", fs.map(fld))]));
  const nav = [["Grunddaten", "s-g"], ["Tickets", "s-t"], ["Kosten", "s-k"], ["Bar & Garderobe", "s-b"], ["Notfall", "s-n"], ["Links", "s-l"], ["Regeln", "s-r"], ["Eigene Felder", "s-e"]];
  const body = h("div.stack", { style: { gap: "10px" } },
    h("div.sheet-top", res, h("div.sheet-nav", nav.map(([t, id]) => h("button.chip", { type: "button", onclick: () => { const el = body.querySelector(`#${id}`); if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); } } }, t)))),
    Object.assign(group("1 · Grunddaten & Programm", true, dg.Allgemein, dg.Programm, calcGroups[0]), { id: "s-g" }),
    Object.assign(group("2 · Tickets", true, calcGroups[2]), { id: "s-t" }),
    Object.assign(group("3 · Location & alle Kosten", true, calcGroups[1]), { id: "s-k" }),
    Object.assign(group("4 · Bar, Getränke & Garderobe", true, calcGroups[3], dg["Preise vor Ort"]), { id: "s-b" }),
    Object.assign(group("5 · Sicherheit & Notfall", false, dg["Sicherheit & Notfall"]), { id: "s-n" }),
    Object.assign(group("6 · Links", false, dg.Links), { id: "s-l" }),
    Object.assign(group("7 · Regeln & Infos", false, dg["Regeln & Infos"]), { id: "s-r" }),
    Object.assign(group("8 · Eigene Felder", false, h("p.faint", { style: { margin: 0, fontSize: "12.5px" } }, "Alles, was sonst noch wichtig ist – z. B. Parkplätze, Aufbauzeit, Schlüssel, Lieferant."), customBox), { id: "s-e" }),
    h("div.row", { style: { justifyContent: "flex-end", position: "sticky", bottom: "0", background: "var(--surface)", padding: "10px 0" } },
      h("button.btn.primary", { onclick: async (e) => { e.currentTarget.disabled = true; try { d.custom = d.custom.filter((x) => x.label || x.value); await onSave({ calc: c, details: d }); m.close(); toast("Gespeichert – alles neu berechnet"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("check"), "Alles speichern")));
  // Unter-Überschriften der Kalkulation ausblenden (stehen schon in den Gruppen)
  calcGroups.forEach((g) => { g.open = true; g.classList.add("sheet-inner"); });
  const m = modal(`Event-Formular: ${name}`.slice(0, 80), body, { wide: true });
  m.el.querySelector(".modal")?.classList.add("evw-modal");
  drawRes();
}
