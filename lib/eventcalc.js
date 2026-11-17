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

export function compute(c0) {
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
  const tixRev = tix.reduce((s, t) => s + num(t.qty) * num(t.price), 0) * (1 - fee);
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
  return { G, lines, fixed: r2(fixed), buffer: r2(buffer), locGross: r2(locGross), tixQty, paid, tixRev: r2(tixRev), avgPrice: r2(avgPrice), doorRev: r2(doorRev), barRev: r2(barRev), barBuy: r2(barBuy), ward: r2(ward),
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
export function calcCard({ name, calc, tickets, eventDate, capacity, snaps = [], onSave, note = "" }) {
  const body = h("div.stack", { style: { gap: "14px" } });
  const draw = () => {
    const R = calc ? compute(calc) : null;
    const A = analyze({ tickets, eventDate, capacity: capacity || R?.tixQty, breakEven: R?.beAll ?? R?.beTickets, snaps });
    const hasT = tickets && tickets.sold !== undefined;
    const ok = (A.forecast ?? 0) >= (R?.beAll ?? Infinity);
    body.replaceChildren(
      note ? h("div.banner", icon("info"), h("div", note)) : null,
      R ? h("div.ckpis",
        kpi("Kosten gesamt", fmtEUR(R.costs), `fix ${fmtEUR(R.totalFixed)}${R.barBuy ? ` + Bar-Einkauf ${fmtEUR(R.barBuy)}` : ""}`),
        kpi("Einnahmen (Plan)", fmtEUR(R.income), `Tickets ${fmtEUR(R.tixRev)} · Bar ${fmtEUR(R.barRev)} · Garderobe ${fmtEUR(R.ward)}`),
        kpi("Ergebnis (Plan)", fmtEUR(R.result), `${R.G} Gäste`, R.result >= 0 ? "good" : "bad"),
        kpi("Break-even", R.beAll ? `${R.beAll} Gäste` : "–", R.beTickets ? `nur Tickets: ${R.beTickets} · Ø Ticket ${fmtEUR(R.avgPrice)}` : "Ticketpreis fehlt")) : h("div.faint", "Noch keine Kalkulation – „Kalkulation bearbeiten“ öffnet das Formular mit allen Kosten, Tickets, Bar und Garderobe."),
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
        h("button.btn.primary.sm", { onclick: () => calcModal({ name, calc: calc || emptyCalc({ capacity }), onSave: async (c) => { await onSave(c); calc = c; draw(); } }) }, icon("edit"), "Kalkulation bearbeiten"),
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
export function calcModal({ name, calc, onSave }) {
  const c = JSON.parse(JSON.stringify(calc));
  const res = h("div.calc-res");
  const save = h("button.btn.primary", { onclick: async (e) => {
    e.currentTarget.disabled = true; try { await onSave(c); m.close(); toast("Kalkulation gespeichert – alles neu berechnet"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("check"), "Speichern");
  const m = modal(`Kalkulation: ${name}`.slice(0, 80), h("div.stack", { style: { gap: "12px" } }, calcForm(c, () => drawRes()), h("div.row", { style: { justifyContent: "flex-end" } }, save)), { wide: true });
  { const mb = m.el.querySelector(".modal-body"); if (mb) mb.before(res); else m.el.prepend(res); }
  const drawRes = () => { const R = compute(c); const cell = (l, v, tone) => h("div", h("small", l), h("b", { style: tone ? { color: tone } : null }, v));
    res.replaceChildren(cell("Kosten", fmtEUR(R.costs)), cell("Einnahmen", fmtEUR(R.income)), cell("Ergebnis", fmtEUR(R.result), R.result >= 0 ? "var(--ok)" : "var(--bad)"),
      cell("Break-even", R.beAll ? `${R.beAll} Gäste` : "–"), cell("nur Tickets", R.beTickets ? `${R.beTickets}` : "–"), cell("Ø Ticket", fmtEUR(R.avgPrice)), cell("Bar+Gard./Gast", fmtEUR(R.perGuestExtra)),
      ...R.scen.map(([p, g, v]) => cell(`${Math.round(p * 100)} % (${g})`, fmtEUR(v), v >= 0 ? "var(--ok)" : "var(--bad)"))); };
  drawRes();
}

export function calcForm(c, onChange) {
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
  const barEd = listEditor(c.bar, [["name", "Getränk"], ["sell", "Verkauf €", "number"], ["buy", "Einkauf €", "number"], ["per", "pro Gast", "number"]], { name: "", sell: "", buy: "", per: "" });
  const DRINKS = [["Wasser 0,5 l", 2.5, 0.4, 0.6], ["Cola / Softdrink", 3.5, 0.75, 0.6], ["Bier", 4, 1.0, 0.8], ["Mate / Energy", 4, 1.1, 0.4], ["Longdrink (ab 18)", 7, 1.8, 0.5]];
  return h("div.stack.calc-form", { style: { gap: "12px" } },
    h("details.evw-group", { open: true }, h("summary", h("b", "Gäste & Location")), h("div.stack", { style: { gap: "8px", paddingBottom: "8px" } },
      h("div.calc-grid4", n(c, "guests", "Erwartete Gäste"), n(c.location, "net", "Location netto €"), (() => { const el = h("select.input", { "aria-label": "MwSt", onchange: (e) => { c.location.vat = +e.target.value; ch(); } }, [0, 7, 19].map((v) => h("option", { value: v, selected: +c.location.vat === v }, `${v} %`))); return h("div.field", h("label", "MwSt"), el); })(), n(c, "buffer", "Puffer %", { ph: "z. B. 5" })),
      t(c.location, "note", "Was ist im Location-Preis enthalten? (Notiz)"))),
    h("details.evw-group", { open: true }, h("summary", h("b", "Alle möglichen Kosten"), h("span.faint", " – je Posten: nicht nötig / im Location-Preis / Kosten")), h("div.stack", { style: { gap: "6px", paddingBottom: "8px" } }, ...COSTS.map(costRow),
      h("div.faint", { style: { fontSize: "12.5px" } }, "Weitere Kosten:"), listEditor((c.extra ||= []), [["name", "Posten"], ["amount", "€", "number"]], { name: "", amount: "" }))),
    h("details.evw-group", { open: true }, h("summary", h("b", "Tickets")), h("div.stack", { style: { gap: "8px", paddingBottom: "8px" } },
      listEditor(c.tickets, [["name", "Kategorie"], ["qty", "Anzahl", "number"], ["price", "Preis €", "number"]], { name: "", qty: "", price: "" }),
      h("div.calc-grid4", n(c, "free", "Freikarten"), n(c.door, "qty", "Abendkasse Anzahl"), n(c.door, "price", "Abendkasse Preis €"), n(c, "feePct", "Ticket-Gebühr % (wenn du zahlst)")),
      h("label.check", h("input", { type: "checkbox", checked: c.feeBuyer !== false, onchange: (e) => { c.feeBuyer = e.target.checked; ch(); } }), "Gebühr zahlen die Käufer"))),
    h("details.evw-group", { open: true }, h("summary", h("b", "Bar & Garderobe")), h("div.stack", { style: { gap: "8px", paddingBottom: "8px" } },
      h("div.faint", { style: { fontSize: "12.5px" } }, "Getränke: Verkaufspreis, Einkaufspreis und wie viele pro Gast (z. B. 0,5 = jeder zweite)."),
      barEd,
      c.bar.length ? null : h("button.btn.sm", { type: "button", onclick: (e) => { DRINKS.forEach(([name, sell, buy, per]) => c.bar.push({ name, sell, buy, per })); barEd.redraw(); e.currentTarget.remove(); ch(); } }, icon("plus"), "Typische Getränke einsetzen (Schätzpreise)"),
      h("div.calc-grid4", n(c.wardrobe, "price", "Garderobe € / Teil"), n(c.wardrobe, "rate", "% der Gäste nutzen sie"), n(c, "change", "Wechselgeld € (kommt zurück)")))));
}
