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
// Live-Kalkulation: echte Verkäufe je Kategorie (Eventfrog) + Rest zum aktuellen Preis.
// Aktueller Preis = höherer Wert aus „Preis jetzt“ und Preis des zuletzt verkauften Tickets › sonst Preisstufe nach Datum › Startpreis.
const normName = (x) => String(x || "").toLowerCase().replace(/\(.*?\)/g, "").replace(/[^a-z0-9äöüß]+/g, " ").trim();
export function withLive(calc, tickets) {
  const tiers = Array.isArray(tickets?.tiers) ? tickets.tiers : [];
  if (!calc || !calc.live || !tiers.length) return calc;
  return { ...calc, _live: tiers, _liveAt: tickets.as_of || tickets.updated_at || null };
}
function liveTier(t, i, tiers) {
  const n = normName(t.name);
  return tiers.find((x) => x.name === t.name) || tiers.find((x) => normName(x.name) === n) || tiers.find((x) => n && (normName(x.name).startsWith(n) || n.startsWith(normName(x.name)))) || null;
}
// der höhere Wert aus „Preis jetzt“ (von Hand) und letztem echten Verkaufspreis – so veraltet ein eingetragener Preis nicht, wenn Eventfrog weiter erhöht
export const nowPrice = (t, tier) => Math.max(num(t.priceNow), num(tier?.last_price)) || currentPrice(t);
export function compute(c0, mode = "avg") {
  const c = { ...emptyCalc(), ...(c0 || {}) };
  // Stufen: min = vorsichtig (wenig Gäste, Anfangspreise, weniger Bar/Garderobe) · avg = erwartet · max = optimistisch
  const lvl = mode === "min" ? "min" : mode === "max" ? "max" : "avg";
  const pMode = mode === "min" ? "start" : mode === "max" ? "end" : mode;
  const fac = lvl === "min" ? 0.75 : lvl === "max" ? 1.25 : 1;
  const Gexp = Math.max(0, num(c.guests));
  const capAll = (c.tickets || []).reduce((s, t) => s + num(t.qty), 0) + num(c.door?.qty);
  let G = lvl === "min" ? (num(c.guestsMin) || Math.round(Gexp * 0.7)) : lvl === "max" ? (num(c.guestsMax) || Math.round(Gexp * 1.2)) : Gexp;
  if (lvl === "max" && capAll) G = Math.min(G, Math.max(capAll, Gexp));
  const live = Array.isArray(c._live) && c._live.length ? c._live : null;
  const liveSold = live ? (c.tickets || []).reduce((s, t, i) => s + num(liveTier(t, i, live)?.sold), 0) : 0;
  G = Math.max(0, G, liveSold);   // nie weniger Gäste als schon Tickets verkauft
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
  // Tickets: Kategorien werden der Reihe nach verkauft (erst Early, dann Regular …) – höchstens so viele, wie Gäste im Vorverkauf erwartet sind
  const tixAll = (c.tickets || []).filter((t) => num(t.qty));
  const avail = tixAll.reduce((s, t) => s + num(t.qty), 0);
  const presale = Math.min(avail, Math.max(0, G - num(c.door?.qty)));
  let left = presale;
  let cats;
  if (live) {
    // verkauft ist fest; der Rest bis zur erwarteten Gästezahl wird der Reihe nach zum aktuellen Preis (min) bis Endpreis (max) verkauft
    left = Math.max(0, presale - liveSold);
    cats = tixAll.map((t, i) => {
      const tier = liveTier(t, i, live); const sold = num(tier?.sold), soldRev = num(tier?.revenue);
      const rem = Math.min(left, Math.max(0, num(t.qty) - sold)); left -= rem;
      const pNow = nowPrice(t, tier), pEnd = Math.max(pNow, num(t.priceEnd) || num(t.price));
      const p = pMode === "start" ? pNow : pMode === "end" ? pEnd : (pNow + pEnd) / 2;
      const used = sold + rem, rev = soldRev + rem * p;
      return { name: t.name || "Ticket", qty: num(t.qty), used, rev, avg: used ? rev / used : 0, t, live: true, sold, soldRev, rem, pNow, pRem: p, lastAt: tier?.last_at || null };
    });
  } else cats = tixAll.map((t) => { const used = Math.min(left, num(t.qty)); left -= used; const rev = catRevenue({ ...t, qty: used }, pMode); return { name: t.name || "Ticket", qty: num(t.qty), used, rev, avg: used ? rev / used : 0, t }; });
  const tix = cats.filter((x) => x.used);
  const tixQty = live ? Math.max(presale, liveSold) : presale;
  const fee = c.feeBuyer ? 0 : num(c.feePct) / 100;
  const tixGross = cats.reduce((s, x) => s + x.rev, 0);
  const tixRev = tixGross * (1 - fee);
  const paid = Math.max(0, tixQty - num(c.free));
  const avgPrice = tixQty ? tixRev / tixQty : 0;
  const doorRev = num(c.door?.qty) * num(c.door?.price);
  const barRev = (c.bar || []).reduce((s, b) => s + num(b.sell) * num(b.per) * fac * G, 0);
  const barBuy = (c.bar || []).reduce((s, b) => s + num(b.buy) * num(b.per) * fac * G, 0);
  const wRate = Math.min(100, num(c.wardrobe?.rate) * fac);
  const wItems = c.wardrobe?.mode === "person" ? 1 : (num(c.wardrobe?.items) || 1);
  const ward = num(c.wardrobe?.price) * G * wRate / 100 * wItems;
  const perGuestExtra = G ? (barRev - barBuy + ward) / G : 0;
  const costs = fixed + buffer + barBuy;
  const income = tixRev * (paid / (tixQty || 1)) + doorRev + barRev + ward;
  const totalFixed = fixed + buffer;
  const beAll = avgPrice + perGuestExtra > 0 ? Math.ceil(totalFixed / (avgPrice + perGuestExtra)) : null;
  const beTickets = avgPrice > 0 ? Math.ceil(totalFixed / avgPrice) : null;
  const scen = [0.5, 0.75, 1].map((p) => { const g = Math.round(G * p); return [p, g, r2(g * avgPrice + g * perGuestExtra - totalFixed)]; });
  const hasRange = mode === "avg" && (tix.length || G);
  const priceScen = hasRange ? [["Minimum", "min"], ["Durchschnitt", "avg"], ["Maximum", "max"]].map(([l, m]) => { const X = m === "avg" ? null : compute(c0, m); return [l, X ? X.result : null, X ? X.beAll : null, X ? X.tixRev : null, X ? X.G : G, X ? X.income : null, X ? X.costs : null]; }) : null;
  return { live: !!live, liveSold, priceScen, G, Gexp, lvl, fac, wRate, wItems, lines, cats, avail, presale, tixGross: r2(tixGross), fee, mode, fixed: r2(fixed), buffer: r2(buffer), locGross: r2(locGross), tixQty, paid, tixRev: r2(tixRev), avgPrice: r2(avgPrice), doorRev: r2(doorRev), barRev: r2(barRev), barBuy: r2(barBuy), ward: r2(ward),
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
// Live-Übersicht je Kategorie: verkauft, echt eingenommen, Rest, Preis jetzt
function liveBox(R, at) {
  const rows = R.cats.filter((x) => x.live);
  const restRev = rows.reduce((s, x) => s + x.rem * x.pRem, 0), soldRev = rows.reduce((s, x) => s + x.soldRev, 0);
  return h("div.lcalc-box",
    h("div.row.between", h("b", "Live-Kalkulation"), h("span.faint", { style: { fontSize: "12px" } }, at ? `Stand ${new Date(at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "")),
    h("div.table-wrap", h("table.table.live-t",
      h("thead", h("tr", h("th", "Kategorie"), h("th.num", "Verkauft"), h("th.num", "Eingenommen"), h("th.num", "Noch zu verkaufen"), h("th.num", "Preis jetzt"))),
      h("tbody", rows.map((x) => h("tr", h("td", x.name), h("td.num", `${x.sold} / ${x.qty}`), h("td.num", fmtEUR(x.soldRev)),
        h("td.num", x.sold >= x.qty ? h("span.badge.b-ok", "ausverkauft") : `${Math.max(0, x.qty - x.sold)}${x.rem < x.qty - x.sold ? ` (davon ${x.rem} erwartet)` : ""}`),
        h("td.num", x.sold >= x.qty ? "–" : fmtEUR(x.pNow))))))),
    h("div.faint", { style: { fontSize: "12.5px" } }, `Echt eingenommen ${fmtEUR(soldRev)} + erwarteter Rest ${fmtEUR(restRev)} = Tickets ${fmtEUR(R.tixGross)} (Durchschnitt aus Preis jetzt und Endpreis). Steigt der Preis, rechnet sich alles beim nächsten Verkauf automatisch neu.`));
}
export function calcCard({ name, calc, tickets, eventDate, capacity, snaps = [], onSave, note = "", onSync = null, details = null, onSaveAll = null, readOnly = false }) {
  const body = h("div.stack", { style: { gap: "14px" } });
  const draw = () => {
    const CL = withLive(calc, tickets);
    const R = CL && (CL.tickets || CL.location) ? compute(CL) : null;
    const canLive = Array.isArray(tickets?.tiers) && tickets.tiers.length && calc?.tickets?.length;
    const saveCalc = async (c) => { if (onSave) await onSave(c); else if (onSaveAll) await onSaveAll({ calc: c, details: details || {} }); calc = c; draw(); };
    const A = analyze({ tickets, eventDate, capacity: capacity || R?.tixQty, breakEven: R?.beAll ?? R?.beTickets, snaps });
    const hasT = tickets && tickets.sold !== undefined;
    const ok = (A.forecast ?? 0) >= (R?.beAll ?? Infinity);
    body.replaceChildren(
      note ? h("div.banner", icon("info"), h("div", note)) : null,
      canLive && !readOnly ? h("label.live-sw", { title: "Rechnet mit den echten Verkäufen je Kategorie und dem aktuellen Preis statt mit dem geplanten Preisverlauf" },
        h("input", { type: "checkbox", checked: !!calc.live, onchange: async (e) => { const on = e.target.checked; e.target.disabled = true; try { await saveCalc({ ...calc, live: on || undefined }); toast(on ? "Live-Kalkulation an – rechnet mit echten Verkäufen und aktuellem Preis" : "Live-Kalkulation aus – rechnet wieder mit dem Plan"); } catch (er) { toastErr(er); e.target.checked = !on; e.target.disabled = false; } } }),
        h("span.live-sw-ui", { "aria-hidden": "true" }), h("span", h("b", "Live neu kalkulieren"), h("small.faint", calc.live ? " – verkaufte Tickets + Rest zum aktuellen Preis, aktualisiert sich bei jedem Verkauf" : " – mit echten Verkäufen und aktuellem Preis statt Plan"))) : null,
      R?.live ? liveBox(R, CL._liveAt) : null,
      calc?.derived ? h("div.banner", icon("info"), h("div", "Geschätzt aus deinen Event-Daten (Gäste/Kapazität, Ticketpreis, Kosten-Einträge). Für genaue Zahlen – Bar, Garderobe, Preisstufen – das Event-Formular ausfüllen.")) : null,
      R ? h("div.ckpis",
        kpi("Kosten gesamt", fmtEUR(R.costs), `fix ${fmtEUR(R.totalFixed)}${R.barBuy ? ` + Bar-Einkauf ${fmtEUR(R.barBuy)}` : ""}`),
        kpi(R.live ? "Einnahmen (live)" : "Einnahmen (Plan)", fmtEUR(R.income), `Tickets ${fmtEUR(R.tixRev)} · Bar ${fmtEUR(R.barRev)} · Garderobe ${fmtEUR(R.ward)}`),
        h("button.ckpi.ckpi-btn", { type: "button", class: R.result >= 0 ? "good" : "bad", title: "Wo kommt das Ergebnis her?", onclick: () => breakdownModal(CL, name) }, h("small", R.live ? "Ergebnis (live) – antippen" : "Ergebnis (Plan) – antippen"), h("b", fmtEUR(R.result)), h("span", R.result < 0 ? "Wo kommt das Minus her? →" : `${R.G} Gäste · Aufschlüsselung →`)),
        kpi("Break-even", R.beAll ? `${R.beAll} Gäste` : "–", R.beTickets ? `nur Tickets: ${R.beTickets} · Ø Ticket ${fmtEUR(R.avgPrice)}` : "Ticketpreis fehlt")) : h("div.faint", "Noch keine Kalkulation – „Kalkulation bearbeiten“ öffnet das Formular mit allen Kosten, Tickets, Bar und Garderobe."),
      R?.priceScen ? h("div.row.wrap", { style: { gap: "8px" } }, ...R.priceScen.map(([l, v, be, tr, g]) => { const val = v ?? R.result, b = be ?? R.beAll, t = tr ?? R.tixRev; return h("button.badge.rng-b", { type: "button", class: val >= 0 ? "b-ok" : "b-bad", title: "Rechenweg für dieses Szenario", onclick: () => explainModal(CL, name, l === "Minimum" ? "min" : l === "Maximum" ? "max" : "avg") }, `${l} (${g} Gäste): Tickets ${fmtEUR(t)} · Ergebnis ${fmtEUR(val)} · Break-even ${b ?? "–"}`); })) : null,
      calc?.tickets?.some((t) => (t.phases || []).length) ? h("div.row.wrap", { style: { gap: "6px" } }, ...calc.tickets.filter((t) => t.name).map((t) => h("span.badge.b-pri", `${t.name}: jetzt ${fmtEUR(currentPrice(t))}`))) : null,
      R && !R.priceScen ? h("div.row.wrap", { style: { gap: "8px" } }, ...R.scen.map(([p, g, v]) => h("span.badge", { class: v >= 0 ? "b-ok" : "b-bad" }, `${Math.round(p * 100)} % (${g} Gäste): ${fmtEUR(v)}`))) : null,
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
      R && readOnly ? h("div.row", h("button.btn.sm", { onclick: () => explainModal(CL, name) }, icon("info"), "Rechenweg ansehen")) : null,
      readOnly ? null : h("div.row.wrap", { style: { gap: "8px" } },
        R ? h("button.btn.sm", { onclick: () => explainModal(CL, name), title: "Jede Zahl Schritt für Schritt mit Formel" }, icon("info"), "Rechenweg") : null,
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
  const c = JSON.parse(JSON.stringify(calc)); delete c.derived;
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
  let sumHook = null;
  const ch = () => { sumHook?.(); onChange?.(c); };
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
    const fl = (label, el) => h("div.field.tk-f", h("label", label), el);
    const qtyIn = inp(t, "qty", "Wie viele gibt es?", "number"); qtyIn.addEventListener("input", updSum);
    return h("div.calc-ticket", h("div.calc-line.calc-line5.tk-line", fl("Kategorie", inp(t, "name", "z. B. Early Bird")), fl("Wie viele gibt es?", qtyIn), fl("Startpreis €", inp(t, "price", "Startpreis €", "number")), fl("Endpreis € (falls er steigt)", inp(t, "priceEnd", "Endpreis €", "number")),
      h("button.icon-btn", { type: "button", "aria-label": "Kategorie entfernen", onclick: () => { c.tickets.splice(i, 1); ticketEd.redraw(); ch(); } }, icon("x"))),
      h("div.tk-now", fl("Preis jetzt € (für Live-Kalkulation, leer = automatisch)", inp(t, "priceNow", "automatisch", "number"))),
      h("div.faint", { style: { fontSize: "11.5px" } }, "Gerechnet wird mit dem Durchschnitt aus Start- und Endpreis; Anfangs- und Endpreis-Szenario werden extra gezeigt. Mit „Live neu kalkulieren“ zählen stattdessen die echten Verkäufe, und nur der Rest wird zum Preis von jetzt gerechnet."),
      phBox, t.phases.length ? null : h("button.btn.sm.ghost", { type: "button", onclick: () => { t.phases.push({ until: "", price: "", qty: "" }); drawPh(); ch(); } }, icon("plus"), "Genauer: Preisstufen mit Datum"));
  }), h("button.btn.sm", { type: "button", onclick: () => { c.tickets.push({ name: "", qty: "", price: "", priceEnd: "", phases: [] }); ticketEd.redraw(); ch(); } }, icon("plus"), "Ticket-Kategorie hinzufügen"), sumLine);
  function updSum() {
    const tot = (c.tickets || []).reduce((a, t) => a + num(t.qty), 0), G = num(c.guests), d = num(c.door?.qty);
    sumLine.replaceChildren(h("b", `Tickets gesamt: ${tot}`), ` · erwartete Gäste: ${G}${d ? ` (davon ${d} Abendkasse)` : ""}`,
      tot > G - d && G ? h("div.faint", `→ gerechnet wird mit ${Math.max(0, G - d)} verkauften Tickets, in der Reihenfolge oben (erst die erste Kategorie).`) : tot < G - d ? h("div", { style: { color: "var(--warn, #e0a23a)" } }, `→ ${G - d - tot} Gäste haben kein Ticket – mehr Tickets eintragen oder Abendkasse erhöhen.`) : null);
  }
  const sumLine = h("div.tk-sum");
  ticketEd.redraw(); updSum(); sumHook = updSum;
  const barEd = h("div.stack.bar-ed", { style: { gap: "8px" } });
  barEd.redraw = () => barEd.replaceChildren(...c.bar.map((b, i) => {
    const f = (k, l, type, ph) => { const el = h("input.input", { type: type || "text", min: 0, step: "any", inputmode: type === "number" ? "decimal" : null, value: b[k] ?? "", placeholder: ph || "", oninput: (e) => { b[k] = type === "number" ? (e.target.value === "" ? "" : +e.target.value) : e.target.value; mg.textContent = margin(); ch(); } }); el.setAttribute("aria-label", `${l}${b.name ? ` (${b.name})` : ""}`); return h("div.field.tk-f", h("label", l), el); };
    const margin = () => (num(b.sell) ? `Gewinn ${fmtEUR(num(b.sell) - num(b.buy))} pro Stück · ≈ ${Math.round(num(b.per) * num(c.guests))} Stück bei ${num(c.guests)} Gästen` : "");
    const mg = h("div.faint.bar-mg", margin());
    return h("div.bar-row", h("div.bar-grid", f("name", "Getränk", "text", "z. B. Cola 0,33 l"), f("sell", "Verkauf € / Stück", "number"), f("buy", "Einkauf € / Stück", "number"), f("per", "Stück pro Gast", "number", "z. B. 0,5"),
      h("button.icon-btn", { type: "button", "aria-label": "Getränk entfernen", onclick: () => { c.bar.splice(i, 1); barEd.redraw(); ch(); } }, icon("x"))), mg);
  }), h("button.btn.sm.ghost", { type: "button", onclick: () => { c.bar.push({ name: "", sell: "", buy: "", per: "" }); barEd.redraw(); ch(); } }, icon("plus"), "Getränk hinzufügen"));
  barEd.redraw();
  c.wardrobe ||= { price: 2, rate: 60 };
  const wSub = h("div.faint", { style: { fontSize: "12px" } });
  const wUpd = () => { const R = compute(c); wSub.textContent = R.ward ? `≈ ${fmtEUR(R.ward)} Garderoben-Einnahmen bei ${R.G} Gästen` : ""; };
  const wardBox = h("div.stack", { style: { gap: "8px" } });
  const wDraw = () => wardBox.replaceChildren(
    h("div.row.wrap", { style: { gap: "6px" } }, h("span.faint", { style: { fontSize: "12.5px" } }, "Garderobe kostet:"), ...[["teil", "pro Teil (Jacke, Tasche …)"], ["person", "pro Person (pauschal)"]].map(([k, l]) => h("button.chip", { type: "button", class: (c.wardrobe.mode || "teil") === k ? "on" : "", onclick: () => { c.wardrobe.mode = k; wDraw(); ch(); } }, l))),
    h("div.calc-grid4", n(c.wardrobe, "price", c.wardrobe.mode === "person" ? "€ pro Person" : "€ pro Teil"), n(c.wardrobe, "rate", "% der Gäste nutzen sie"), c.wardrobe.mode === "person" ? null : n(c.wardrobe, "items", "Teile pro Person (Ø)", { ph: "z. B. 1,3" }), n(c, "change", "Wechselgeld € (kommt zurück)")), wSub);
  wDraw(); wUpd();
  const chOld = sumHook; sumHook = () => { chOld?.(); wUpd(); };
  const DRINKS = [["Wasser 0,5 l", 2.5, 0.4, 0.6], ["Cola / Softdrink", 3.5, 0.75, 0.6], ["Bier", 4, 1.0, 0.8], ["Mate / Energy", 4, 1.1, 0.4], ["Longdrink (ab 18)", 7, 1.8, 0.5]];
  return h("div.stack.calc-form", { style: { gap: "12px" } },
    h("details.evw-group", { open: true }, h("summary", h("b", "Gäste & Location")), h("div.stack", { style: { gap: "8px", paddingBottom: "8px" } },
      h("div.calc-grid4", n(c, "guests", "Erwartete Gäste"), n(c.location, "net", "Location netto €"), (() => { const el = h("select.input", { "aria-label": "MwSt", onchange: (e) => { c.location.vat = +e.target.value; ch(); } }, [0, 7, 19].map((v) => h("option", { value: v, selected: +c.location.vat === v }, `${v} %`))); return h("div.field", h("label", "MwSt"), el); })(), n(c, "buffer", "Puffer %", { ph: "z. B. 5" })),
      h("div.calc-grid4", n(c, "guestsMin", "Gäste min. (vorsichtig)", { ph: `leer = ${Math.round(num(c.guests) * 0.7)}` }), n(c, "guestsMax", "Gäste max. (optimistisch)", { ph: `leer = ${Math.round(num(c.guests) * 1.2)}` })),
      h("div.faint", { style: { fontSize: "11.5px" } }, "Damit rechnet Nexus überall Minimum, Durchschnitt und Maximum."),
      t(c.location, "note", "Was ist im Location-Preis enthalten? (Notiz)"))),
    h("details.evw-group", { open: true }, h("summary", h("b", "Alle möglichen Kosten"), h("span.faint", " – je Posten: nicht nötig / im Location-Preis / Kosten")), h("div.stack", { style: { gap: "6px", paddingBottom: "8px" } }, ...COSTS.map(costRow),
      h("div.faint", { style: { fontSize: "12.5px" } }, "Weitere Kosten:"), listEditor((c.extra ||= []), [["name", "Posten"], ["amount", "€", "number"]], { name: "", amount: "" }))),
    h("details.evw-group", { open: true }, h("summary", h("b", "Tickets")), h("div.stack", { style: { gap: "8px", paddingBottom: "8px" } },
      ticketEd,
      opts.tiers?.length ? h("button.btn.sm", { type: "button", onclick: () => { const old = c.tickets || []; c.tickets = opts.tiers.filter((x) => num(x.capacity) || num(x.sold)).map((x) => { const o = old.find((y) => y.name === x.name); return o ? { ...o, qty: num(x.capacity) || num(x.sold) } : { name: x.name, qty: num(x.capacity) || num(x.sold), price: num(x.price) || (num(x.sold) ? r2(num(x.revenue) / num(x.sold)) : 0), phases: [] }; }); ticketEd.redraw(); ch(); toast("Kategorien aus Eventfrog übernommen – Preis = bisheriger Ø-Preis; Preisstufen bitte ergänzen"); } }, icon("refresh"), "Aus Eventfrog übernehmen") : null,
      h("div.calc-grid4", n(c, "free", "Freikarten"), n(c.door, "qty", "Abendkasse Anzahl"), n(c.door, "price", "Abendkasse Preis €"), n(c, "feePct", "Ticket-Gebühr % (wenn du zahlst)")),
      h("label.check", h("input", { type: "checkbox", checked: c.feeBuyer !== false, onchange: (e) => { c.feeBuyer = e.target.checked; ch(); } }), "Gebühr zahlen die Käufer"))),
    h("details.evw-group", { open: true }, h("summary", h("b", "Bar & Garderobe")), h("div.stack", { style: { gap: "8px", paddingBottom: "8px" } },
      h("div.faint", { style: { fontSize: "12.5px" } }, "Pro Getränk: Verkaufspreis, Einkaufspreis und wie viele Stück ein Gast im Schnitt kauft (0,5 = jeder Zweite eins)."),
      barEd,
      c.bar.length ? null : h("button.btn.sm", { type: "button", onclick: (e) => { DRINKS.forEach(([name, sell, buy, per]) => c.bar.push({ name, sell, buy, per })); barEd.redraw(); e.currentTarget.remove(); ch(); } }, icon("plus"), "Typische Getränke einsetzen (Schätzpreise)"),
      h("b", { style: { fontSize: "13.5px", marginTop: "6px" } }, "Garderobe"), wardBox)));
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
    h("button.btn.sm", { onclick: () => explainModal(c, name) }, icon("info"), "Ganzen Rechenweg ansehen"),
    h("div.faint", { style: { fontSize: "12.5px" } }, `Break-even: ${R.beAll ?? "–"} Gäste · ${R.G} Gäste geplant · Ø Ticket ${fmtEUR(R.avgPrice)} · Bar + Garderobe pro Gast ${fmtEUR(R.perGuestExtra)}`)), { wide: true });
}

// ---------------------------------------------------------------- EIN Formular für alles (Steckbrief + Kalkulation + eigene Felder)
export function eventSheet({ name, calc, details = {}, tiers = [], onSave }) {
  const c = JSON.parse(JSON.stringify(calc || emptyCalc())); delete c.derived;
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
    h("div.sheet-top", res, h("div.sheet-nav", ...nav.map(([t, id]) => h("button.chip", { type: "button", onclick: () => { const el = body.querySelector(`#${id}`); if (el) { el.open = true; el.scrollIntoView({ behavior: "smooth", block: "start" }); } } }, t)), h("button.chip", { type: "button", onclick: () => explainModal(c, name) }, "Rechenweg"))),
    Object.assign(group("1 · Grunddaten & Programm", true, dg.Allgemein, dg.Programm, calcGroups[0]), { id: "s-g" }),
    Object.assign(group("2 · Tickets", true, calcGroups[2]), { id: "s-t" }),
    Object.assign(group("3 · Location & alle Kosten", true, calcGroups[1]), { id: "s-k" }),
    Object.assign(group("4 · Bar, Getränke & Garderobe", true, calcGroups[3], h("div.grid.g-2", (DETAILS.find(([t]) => t === "Preise vor Ort")?.[1] || []).filter(([k]) => !["wardrobe", "drinks"].includes(k)).map(fld))), { id: "s-b" }),
    Object.assign(group("5 · Sicherheit & Notfall", false, dg["Sicherheit & Notfall"]), { id: "s-n" }),
    Object.assign(group("6 · Links", false, dg.Links), { id: "s-l" }),
    Object.assign(group("7 · Regeln & Infos", false, dg["Regeln & Infos"]), { id: "s-r" }),
    Object.assign(group("8 · Eigene Felder", false, h("p.faint", { style: { margin: 0, fontSize: "12.5px" } }, "Alles, was sonst noch wichtig ist – z. B. Parkplätze, Aufbauzeit, Schlüssel, Lieferant."), customBox), { id: "s-e" }),
    h("div.row", { style: { justifyContent: "flex-end", position: "sticky", bottom: "0", background: "var(--surface)", padding: "10px 0" } },
      h("button.btn.ghost", { onclick: () => { navigator.clipboard?.writeText(detailsMessage(name, d)).then(() => toast("Als Nachricht kopiert – in WhatsApp einfügen"), () => toast("Kopieren nicht möglich", "err")); } }, icon("copy"), "Als WhatsApp-Text"),
      h("button.btn.primary", { onclick: async (e) => { e.currentTarget.disabled = true; try { d.custom = d.custom.filter((x) => x.label || x.value); await onSave({ calc: c, details: d }); m.close(); toast("Gespeichert – alles neu berechnet"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("check"), "Alles speichern")));
  // Unter-Überschriften der Kalkulation ausblenden (stehen schon in den Gruppen)
  calcGroups.forEach((g) => { g.open = true; g.classList.add("sheet-inner"); });
  const m = modal(`Event-Formular: ${name}`.slice(0, 80), body, { wide: true });
  m.el.querySelector(".modal")?.classList.add("evw-modal");
  drawRes();
}

// ---------------------------------------------------------------- Kurzer Überblick oben auf der Event-Seite
export const OV_TILES = [["now", "Ergebnis jetzt"], ["forecast", "Voraussichtlich"], ["tickets", "Tickets verkauft"], ["tasks", "Aufgaben"], ["guests", "Gäste"], ["costs", "Kosten"], ["days", "Tage bis zum Event"], ["perguest", "Pro Gast (Ø)"], ["be", "Break-even"]];
export const OV_HINT = "So sehen den Überblick auch alle, mit denen du das Event teilst. Sie können ihn für sich selbst umstellen; dein Stand bleibt ihr Standard.";
export const OV_DEFAULT = OV_TILES.map(([k]) => k).filter((k) => !['perguest', 'be'].includes(k));
const ovClean = (t) => { const ok = new Set(OV_DEFAULT); const l = Array.isArray(t) ? t.filter((k) => ok.has(k)) : null; return l && l.length ? [...new Set(l)] : null; };

// tiles: gespeicherte Reihenfolge/Auswahl · onConfig(tiles|null) speichert · finance: Zahlen aus einer Freigabe (ohne Kalkulation)
export function overviewStrip({ name, calc, tickets = {}, eventDate, capacity, snaps = [], tasks = [], guests = [], spent = null, budget = null, onTasks = null, tiles = null, onConfig = null, configHint = "", finance = null, hasDefault = false }) {
  const t = tickets || {};
  const R = calc ? compute(withLive(calc, t)) : null;
  const A = analyze({ tickets: t, eventDate, capacity, breakEven: R?.beAll, snaps });
  const cap = A.cap || num(calc?.guests) || null;
  const avg = R?.avgPrice || num(t.revenue) / Math.max(1, A.sold) || 0;
  const money = !!(R || finance || spent !== null);
  const costs = R ? R.costs : finance ? num(finance.costs) : num(spent);
  const extra = R ? R.perGuestExtra : 0;
  const revNow = t.revenue != null ? num(t.revenue) : finance?.ticket_revenue != null ? num(finance.ticket_revenue) : A.sold * avg;
  const nowRes = finance?.result != null && !R ? num(finance.result) : A.sold || t.revenue ? revNow - costs : null;
  const fc = A.forecast !== null ? Math.min(cap || Infinity, A.forecast) : null;
  const fcRes = fc !== null && (R || avg) ? fc * (avg + extra) - costs : R ? R.result : null;
  const done = tasks.filter((x) => x.done).length, late = tasks.filter((x) => !x.done && x.at && new Date(x.at) < Date.now()).length;
  const checked = num(t.checked_in), conf = guests.filter((g) => g.done).length;
  const tone = (v) => (v === null ? "" : v >= 0 ? "good" : "bad");
  const tile = (label, value, sub, cls = "", onclick = null) => h(onclick ? "button.ov-tile" : "div.ov-tile", { class: cls, type: onclick ? "button" : undefined, onclick }, h("small", label), h("b", value), sub ? h("span", sub) : null);
  const bd = calc ? () => breakdownModal(calc, name) : null;
  const pct = cap ? Math.round((A.sold / cap) * 100) : null;
  const make = {
    now: () => (money ? tile("Ergebnis jetzt", nowRes === null ? "–" : fmtEUR(nowRes), nowRes === null ? "noch keine Verkäufe" : nowRes < 0 && bd ? "antippen: woher?" : "Stand jetzt", tone(nowRes), bd) : null),
    forecast: () => (money && (R || fc !== null) ? tile("Voraussichtlich", fcRes === null ? "–" : fmtEUR(fcRes), R?.priceScen ? `Min ${fmtEUR(R.priceScen[0][1]).replace(/,\d\d\s/, " ")} · Max ${fmtEUR(R.priceScen[2][1]).replace(/,\d\d\s/, " ")}` : fc !== null ? `bei ca. ${fc} Tickets (Tempo)` : "laut Planung", tone(fcRes), bd) : null),
    tickets: () => (t.sold != null || cap ? tile("Tickets verkauft", cap ? `${A.sold} / ${cap}` : String(A.sold), [pct !== null ? `${pct} %` : null, R?.beAll ? `Break-even ${R.beAll}` : null].filter(Boolean).join(" · ") || null, R?.beAll && A.sold >= R.beAll ? "good" : "") : null),
    tasks: () => (tasks.length || onConfig ? tile("Aufgaben", `${done} / ${tasks.length}`, late ? `${late} überfällig` : tasks.length && done === tasks.length ? "alles erledigt" : `${tasks.length - done} offen`, late ? "bad" : "", onTasks) : null),
    guests: () => (guests.length || checked ? tile("Gäste", checked ? `${checked} drin` : `${conf} / ${guests.length}`, checked ? "eingecheckt" : "Gästeliste bestätigt") : null),
    costs: () => (money ? tile("Kosten", fmtEUR(costs), budget && !R ? `Budget ${fmtEUR(budget)}` : R ? `Einnahmen geplant ${fmtEUR(R.income)}` : null, budget && !R && costs > budget ? "bad" : "", bd) : null),
    perguest: () => (R ? tile("Pro Gast (Ø)", fmtEUR(R.G ? R.income / R.G : 0), `Kosten ${fmtEUR(R.G ? R.costs / R.G : 0)} pro Gast`, tone(R.result), bd) : null),
    be: () => (R?.beAll ? tile("Break-even", `${R.beAll} Gäste`, A.sold >= R.beAll ? "erreicht ✓" : `noch ${Math.max(0, R.beAll - A.sold)} Tickets`, A.sold >= R.beAll ? "good" : "", bd) : null),
    days: () => (eventDate ? tile("Noch", A.daysLeft === 0 ? "heute" : `${A.daysLeft} Tage`, A.rate ? `${A.rate.toFixed(1).replace(".", ",")} Tickets/Tag` : null) : null),
  };
  const order = ovClean(tiles) || OV_DEFAULT;
  const gear = onConfig ? h("button.ov-tile.ov-gear", { type: "button", title: "Überblick anpassen", "aria-label": "Überblick anpassen", onclick: () => ovConfigDialog(order, onConfig, configHint, hasDefault) }, icon("settings")) : null;
  return h("div.ov-strip", ...order.map((k) => make[k]?.()).filter(Boolean), gear);
}

function ovConfigDialog(current, onConfig, hint, hasDefault) {
  let list = [...current, ...OV_DEFAULT.filter((k) => !current.includes(k))].map((k) => ({ k, on: current.includes(k) }));
  const box = h("div.list");
  const draw = () => box.replaceChildren(...list.map((x, i) => h("div.list-item",
    h("input", { type: "checkbox", checked: x.on, "aria-label": `${OV_TILES.find((t) => t[0] === x.k)[1]} anzeigen`, style: { width: "18px", height: "18px", accentColor: "var(--primary)" }, onchange: (e) => { x.on = e.target.checked; } }),
    h("div.li-main", h("div.li-title", OV_TILES.find((t) => t[0] === x.k)[1])),
    h("button.icon-btn", { type: "button", "aria-label": "Nach oben", disabled: i === 0, onclick: () => { [list[i - 1], list[i]] = [list[i], list[i - 1]]; draw(); } }, icon("chevronU")),
    h("button.icon-btn", { type: "button", "aria-label": "Nach unten", disabled: i === list.length - 1, onclick: () => { [list[i + 1], list[i]] = [list[i], list[i + 1]]; draw(); } }, icon("chevronD")))));
  draw();
  const m = modal("Überblick anpassen", h("div.stack", { style: { gap: "10px" } }, hint ? h("p.faint", { style: { margin: 0, fontSize: "13px" } }, hint) : null, box), {
    foot: [
      h("button.btn.ghost", { onclick: async () => { await onConfig(null); m.close(); toast(hasDefault ? "Zurück auf die Ansicht des Veranstalters" : "Standard wiederhergestellt"); } }, icon("refresh"), hasDefault ? "Wie vom Veranstalter" : "Standard"),
      h("button.btn.primary", { onclick: async () => { const sel = list.filter((x) => x.on).map((x) => x.k); if (!sel.length) return toast("Mindestens eine Kachel auswählen", "err"); try { await onConfig(sel); m.close(); toast("Überblick gespeichert"); } catch (er) { toastErr(er); } } }, icon("check"), "Speichern")] });
}

// Steckbrief zum Lesen (z. B. in Freigaben)
export function detailsView(d = {}) {
  const val = (v) => (/^https:\/\/\S+$/.test(String(v).trim()) ? h("a", { href: String(v).trim(), target: "_blank", rel: "noopener noreferrer", style: { color: "var(--primary)" } }, String(v).trim().replace(/^https:\/\//, "").slice(0, 60)) : h("span", { style: { whiteSpace: "pre-wrap" } }, String(v)));
  const groups = DETAILS.map(([t, fs]) => [t, fs.filter(([k]) => d[k] !== undefined && d[k] !== "")]).filter(([, fs]) => fs.length);
  const custom = (d.custom || []).filter((x) => x.label && x.value);
  if (!groups.length && !custom.length) return null;
  const row = (l, v) => h("div.dv-row", h("small", l), val(v));
  return h("div.stack", { style: { gap: "12px" } },
    ...groups.map(([t, fs]) => h("div", h("b", { style: { fontSize: "13.5px" } }, t), h("div.dv-grid", fs.map(([k, l]) => row(l.replace(/ \(.*\)$/, ""), d[k]))))),
    custom.length ? h("div", h("b", { style: { fontSize: "13.5px" } }, "Weiteres"), h("div.dv-grid", custom.map((x) => row(x.label, x.value)))) : null);
}

// ---------------------------------------------------------------- Rechenweg: jede Zahl Schritt für Schritt nachvollziehen
export function explainModal(c0, name = "", mode = "avg") {
  const c = { ...emptyCalc(), ...(c0 || {}) };
  const R = compute(c0, mode);
  const e = (v) => fmtEUR(v);
  const n2 = (v) => String(Math.round(v * 100) / 100).replace(".", ",");
  const step = (title, formula, value, tone) => h("div.rw-step", h("div.rw-main", h("b", title), formula ? h("div.rw-f", formula) : null), value !== undefined ? h("div.rw-v", { style: tone ? { color: tone } : null }, value) : null);
  const sec = (t, ...kids) => h("section.rw-sec", h("h4", t), ...kids.filter(Boolean));
  const modeTxt = { avg: "Durchschnitt – erwartete Gäste, Ø aus Anfangs- und Endpreis", start: "alle zum Anfangspreis", end: "alle zum Endpreis",
    min: "Minimum – vorsichtig: weniger Gäste, Anfangspreise, Bar & Garderobe × 0,75", max: "Maximum – optimistisch: mehr Gäste, Endpreise, Bar & Garderobe × 1,25" }[mode];
  const pm = mode === "min" ? "start" : mode === "max" ? "end" : mode;
  const priceTxt = (x) => { const t = x.t; if (num(t.priceEnd) > 0 && !(t.phases || []).length) return pm === "avg" ? `(${e(num(t.price))} + ${e(num(t.priceEnd))}) ÷ 2 = ${e(x.avg)}` : e(x.avg); return (t.phases || []).length ? `Preisstufen → Ø ${e(x.avg)}` : e(num(t.price)); };
  const doorQ = num(c.door?.qty);
  const bar = (c.bar || []).filter((b) => num(b.per) && (num(b.sell) || num(b.buy)));
  const staff = COSTS.filter(([id, , k]) => k === "staff" && c.costs?.[id]?.st === "cost");
  const inLoc = COSTS.filter(([id]) => c.costs?.[id]?.st === "loc").map(([, l]) => l);
  const warn = [];
  if (R.avail && R.avail < R.G - doorQ) warn.push(`Es gibt nur ${R.avail} Tickets, aber ${R.G - doorQ} Gäste im Vorverkauf – gerechnet wird mit ${R.avail} Tickets.`);
  if (mode === "avg" && R.avail > R.G - doorQ) warn.push(`Es gibt ${R.avail} Tickets, erwartet sind aber nur ${R.G} Gäste – gerechnet wird mit ${R.presale} verkauften Tickets (in der Reihenfolge der Kategorien). Mehr Gäste? Oben „Erwartete Gäste“ erhöhen.`);
  if (num(c.free) > R.presale) warn.push("Mehr Freikarten als Tickets – bitte prüfen.");
  if ((c.costs?.getraenke?.st === "cost") && bar.length) warn.push("Getränke-Einkauf steht bei den Kosten UND die Bar ist ausgefüllt – der Einkauf wird dann doppelt gezählt.");
  const body = h("div.stack", { style: { gap: "14px" } },
    h("div.row.wrap", { style: { gap: "6px" } }, ...[["min", "Minimum"], ["avg", "Durchschnitt"], ["max", "Maximum"], ["start", "Anfangspreise"], ["end", "Endpreise"]].map(([m, l]) => h("button.chip", { class: m === mode ? "on" : "", onclick: () => { md2.close(); explainModal(c0, name, m); } }, l))),
    h("p.faint", { style: { margin: 0, fontSize: "13px" } }, `So rechnet Nexus – jede Zeile mit Formel. Szenario: ${modeTxt}.`),
    warn.length ? h("div.sync-err", h("b", "Auffällig: "), h("ul", { style: { margin: "4px 0 0", paddingLeft: "18px" } }, warn.map((w) => h("li", w)))) : null,
    sec("1 · Gäste",
      R.lvl !== "avg" ? step(R.lvl === "min" ? "Gäste im Minimum" : "Gäste im Maximum", R.lvl === "min" ? (num(c.guestsMin) ? "von dir eingetragen" : `70 % von ${R.Gexp} erwarteten (eigener Wert: Feld „Gäste min.“)`) : (num(c.guestsMax) ? "von dir eingetragen, höchstens so viele wie Tickets + Abendkasse" : `120 % von ${R.Gexp} erwarteten, höchstens Tickets + Abendkasse`), String(R.G)) : step("Erwartete Gäste", null, String(R.G)),
      doorQ ? step("davon Abendkasse", null, String(doorQ)) : null,
      step("Vorverkauf", `min(Tickets verfügbar ${R.avail}, Gäste ${R.G}${doorQ ? ` − Abendkasse ${doorQ}` : ""})`, String(R.presale))),
    sec("2 · Ticket-Einnahmen",
      R.live ? h("div.faint", { style: { fontSize: "12.5px" } }, "Live: verkaufte Tickets zählen mit ihrem echten Umsatz, nur der Rest wird zum aktuellen Preis (Minimum) bis Endpreis (Maximum) gerechnet.") : null,
      ...R.cats.map((x) => x.live
        ? step(x.name, `${x.sold} verkauft (echt ${e(x.soldRev)})${x.rem ? ` + ${x.rem} noch zu verkaufen × ${e(x.pRem)}${x.pRem !== x.pNow ? ` (jetzt ${e(x.pNow)})` : " (aktueller Preis)"}` : x.sold >= x.qty ? " – ausverkauft" : ""}`, e(x.rev))
        : step(x.name, `${x.used} von ${x.qty} verkauft × ${priceTxt(x)}`, e(x.rev))),
      R.fee ? step("Ticket-Gebühr (zahlst du)", `${e(R.tixGross)} × ${n2(R.fee * 100)} %`, `− ${e(R.tixGross - R.tixRev)}`) : null,
      num(c.free) ? step("Freikarten", `${num(c.free)} von ${R.presale} Gästen zahlen nicht → ${e(R.tixRev)} × ${R.paid} ÷ ${R.presale}`, `− ${e(R.tixRev - R.tixRev * R.paid / (R.presale || 1))}`) : null,
      step("Ticket-Einnahmen", `Ø pro Ticket ${e(R.avgPrice)}`, e(R.tixRev * (R.paid / (R.presale || 1))))),
    doorQ || bar.length || R.ward ? sec("3 · Abendkasse, Bar & Garderobe",
      doorQ ? step("Abendkasse", `${doorQ} × ${e(num(c.door?.price))}`, e(R.doorRev)) : null,
      ...bar.map((b) => step(b.name || "Getränk", `${R.G} Gäste × ${n2(num(b.per) * R.fac)} pro Gast${R.fac !== 1 ? ` (${n2(num(b.per))} × ${n2(R.fac)})` : ""} = ${n2(R.G * num(b.per) * R.fac)} Stück × Verkauf ${e(num(b.sell))} (Einkauf ${e(num(b.buy))})`, e(R.G * num(b.per) * R.fac * num(b.sell)))),
      bar.length ? step("Bar-Einkauf (Kosten)", "Summe Stück × Einkaufspreis", `− ${e(R.barBuy)}`, "var(--bad)") : null,
      R.ward ? step("Garderobe", c.wardrobe?.mode === "person" ? `${R.G} Gäste × ${n2(R.wRate)} % nutzen sie × ${e(num(c.wardrobe?.price))} pro Person` : `${R.G} Gäste × ${n2(R.wRate)} % nutzen sie × ${n2(R.wItems)} Teile pro Person × ${e(num(c.wardrobe?.price))} pro Teil`, e(R.ward)) : null) : null,
    sec("4 · Kosten",
      R.locGross ? step("Location", `${e(num(c.location?.net))} netto + ${n2(num(c.location?.vat))} % MwSt`, e(R.locGross)) : null,
      inLoc.length ? h("div.rw-f", { style: { padding: "0 0 6px" } }, `Im Location-Preis enthalten (0 € extra): ${inLoc.join(", ")}`) : null,
      ...staff.map(([id, l]) => { const x = c.costs[id]; return step(l, `${num(x.persons)} Pers. × ${n2(num(x.hours))} h × ${e(num(x.rate))}${num(x.amount) ? ` + ${e(num(x.amount))}` : ""}`, e(num(x.persons) * num(x.hours) * num(x.rate) + num(x.amount))); }),
      ...R.lines.filter(([l]) => l !== "Location (brutto)" && !staff.some(([, sl]) => sl === l)).map(([l, v]) => step(l, null, e(v))),
      R.buffer ? step("Puffer", `${e(R.fixed)} × ${n2(num(c.buffer))} %`, e(R.buffer)) : null,
      R.barBuy ? step("Bar-Einkauf", null, e(R.barBuy)) : null,
      step("Kosten gesamt", `Fixkosten ${e(R.totalFixed)}${R.barBuy ? ` + Bar-Einkauf ${e(R.barBuy)}` : ""}`, e(R.costs))),
    sec("5 · Ergebnis",
      step("Einnahmen gesamt", "Tickets + Abendkasse + Bar + Garderobe", e(R.income)),
      step("− Kosten gesamt", null, e(R.costs)),
      step("= Ergebnis", null, e(R.result), R.result >= 0 ? "var(--ok)" : "var(--bad)")),
    sec("6 · Break-even",
      step("Pro Gast bleibt", `Ø Ticket ${e(R.avgPrice)} + (Bar-Verkauf − Bar-Einkauf + Garderobe) ÷ Gäste ${e(R.perGuestExtra)}`, e(R.avgPrice + R.perGuestExtra)),
      step("Break-even", `Fixkosten ${e(R.totalFixed)} ÷ ${e(R.avgPrice + R.perGuestExtra)} pro Gast, aufgerundet`, R.beAll ? `${R.beAll} Gäste` : "–")),
    h("div.faint", { style: { fontSize: "12px" } }, "Minimum/Maximum: Gäste-Zahlen kannst du im Formular unter „Gäste min./max.“ selbst festlegen."));
  const csv = () => { const rowsx = [["Bereich", "Posten", "Formel", "Betrag"]]; body.querySelectorAll(".rw-sec").forEach((sec2) => { const t = sec2.querySelector("h4")?.textContent || ""; sec2.querySelectorAll(".rw-step").forEach((st) => rowsx.push([t, st.querySelector("b")?.textContent || "", st.querySelector(".rw-f")?.textContent || "", st.querySelector(".rw-v")?.textContent || ""])); });
    const esc2 = (v) => (/[";\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v); const blob = new Blob(["\ufeff" + rowsx.map((r) => r.map(esc2).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `Rechenweg_${String(name || "Event").replace(/[^\wäöüÄÖÜß-]+/g, "_")}_${mode}.csv` }); document.body.append(a); a.click(); a.remove(); };
  const md2 = modal(`Rechenweg${name ? ` – ${name}` : ""}`, body, { wide: true, foot: [h("button.btn.ghost", { onclick: csv }, icon("download"), "Als CSV (Excel)"), h("button.btn.ghost", { onclick: () => { document.body.classList.add("print-modal"); window.print(); setTimeout(() => document.body.classList.remove("print-modal"), 500); } }, icon("file"), "Drucken / PDF")] });
  return md2;
}

// Noch keine Kalkulation? Aus den Event-Daten schätzen, damit Min/Ø/Max und Break-even trotzdem sichtbar sind
export function deriveCalc({ guests, price, tiers = [], costs = [], incomes = [] }) {
  const G = num(guests) || tiers.reduce((a, t) => a + num(t.capacity), 0) || 100;
  const tk = tiers.filter((t) => num(t.capacity) || num(t.sold)).map((t) => ({ name: t.name, qty: num(t.capacity) || num(t.sold), price: num(t.price) || (num(t.sold) ? r2(num(t.revenue) / num(t.sold)) : num(price)), phases: [] }));
  return { ...emptyCalc({ guests: G }), guests: G, tickets: tk.length ? tk : [{ name: "Ticket", qty: G, price: num(price), phases: [] }], wardrobe: { price: 0, rate: 0 },
    extra: [...costs.filter((c) => num(c.amount)).map((c) => ({ name: String(c.name).slice(0, 80), amount: num(c.amount) })), ...incomes.filter((c) => num(c.amount)).map((c) => ({ name: `− ${String(c.name).slice(0, 76)}`, amount: -num(c.amount) }))], derived: true };
}

// Steckbrief als WhatsApp-/Text-Nachricht (für Team oder Gäste)
export function detailsMessage(name, d = {}, when = "") {
  const L = (e, v) => (String(v || "").trim() ? `${e} ${String(v).trim()}` : null);
  return [`*${name}*${when ? ` – ${when}` : ""}`, L("📍", [d.venue, d.address].filter(Boolean).join(", ")), L("🕙", [d.entry && `Einlass ${d.entry}`, d.start && `Start ${d.start}`, d.end && `Ende ${d.end}`].filter(Boolean).join(" · ")),
    L("🔞", d.age), L("🎧", d.lineup && String(d.lineup).replace(/\n+/g, ", ")), L("🎟", d.tickets), L("💳", d.payment), L("📜", d.rules && String(d.rules).replace(/\n+/g, " · ")), L("🆘", d.emergency), L("ℹ️", d.info)].filter(Boolean).join("\n");
}
