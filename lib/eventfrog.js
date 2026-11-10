// Eventfrog-Export (Excel/CSV) direkt im Browser auswerten – Käuferdaten verlassen das Gerät nie, gesendet werden nur Summen.
import { api } from "./api.js";
import { h, icon, modal, toast, toastErr, fmtEUR, fmtNum } from "./ui.js";

const COLS = {
  category: ["ticketkategorie", "ticket category", "ticketart", "ticket type", "kategorie", "category", "ticket", "preisstufe", "price category"],
  price: ["ticketpreis", "ticket price", "preis", "price", "betrag", "amount", "total"],
  qty: ["anzahl", "quantity", "menge", "qty"],
  status: ["status", "bestellstatus", "order status"],
  order: ["bestellnummer", "order number", "order id", "bestell-id", "bestellung", "order"],
  checkin: ["eingecheckt", "checked in", "check-in", "checkin", "eingelöst", "redeemed", "entwertet"],
};
const XLSX_URL = "https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js";

function loadXlsx() {
  if (window.XLSX) return Promise.resolve(window.XLSX);
  return new Promise((res, rej) => {
    const s = document.createElement("script"); s.src = XLSX_URL; s.async = true;
    s.onload = () => (window.XLSX ? res(window.XLSX) : rej(new Error("Excel-Leser nicht verfügbar")));
    s.onerror = () => rej(new Error("Excel-Leser konnte nicht geladen werden – Datei als CSV speichern."));
    document.head.append(s);
  });
}

async function readRows(file) {
  if (/\.xlsx?$|\.xlsm$/i.test(file.name)) {
    const X = await loadXlsx();
    const wb = X.read(await file.arrayBuffer(), { type: "array" });
    return X.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
  }
  const text = (await file.text()).replace(/^﻿/, "");
  const first = text.split(/\r?\n/)[0] || "";
  const sep = [";", "\t", ","].sort((a, b) => first.split(b).length - first.split(a).length)[0];
  const rows = []; let row = [], cell = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; }
    else if (c === '"') q = true;
    else if (c === sep) { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cell); rows.push(row); row = []; cell = ""; }
    else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

const num = (v) => {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  if (s.includes(",") && s.includes(".")) s = s.lastIndexOf(",") > s.lastIndexOf(".") ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  else s = s.replace(",", ".");
  return Number(s) || 0;
};

export function analyze(rows) {
  const hi = rows.slice(0, 15).findIndex((r) => r.filter((c) => String(c).trim()).length >= 3);
  if (hi < 0) throw new Error("Keine Kopfzeile gefunden.");
  const header = rows[hi].map((c) => String(c).trim());
  const low = header.map((x) => x.toLowerCase());
  const find = (k) => { for (const n of COLS[k]) { const i = low.indexOf(n); if (i >= 0) return i; } for (const n of COLS[k]) { const i = low.findIndex((x) => x.includes(n)); if (i >= 0) return i; } return -1; };
  const ix = Object.fromEntries(Object.keys(COLS).map((k) => [k, find(k)]));
  if (ix.category < 0) throw new Error(`Spalte „Ticketkategorie“ nicht gefunden. Vorhanden: ${header.join(", ")}`);
  const isTotal = ix.price >= 0 && /total|gesamt|summe|betrag|amount/.test(low[ix.price]);
  const tiers = new Map(); const orders = new Set(); let cancelled = 0, checked = 0;
  for (const r of rows.slice(hi + 1)) {
    if (!r.some((c) => String(c).trim())) continue;
    const g = (k) => (ix[k] >= 0 ? r[ix[k]] : "");
    if (/storn|cancel|refund|erstatt|abgelehnt|declined/i.test(String(g("status")))) { cancelled++; continue; }
    const name = String(g("category")).trim() || "Ticket";
    const qn = ix.qty >= 0 ? Math.max(1, Math.round(num(g("qty")))) : 1;
    const price = num(g("price"));
    const [rowTotal, unit] = isTotal ? [price, price / qn] : [price * qn, price];
    const t = tiers.get(name) || { name, sold: 0, revenue: 0, price: null };
    t.sold += qn; t.revenue += rowTotal; if (unit) t.price = Math.round(unit * 100) / 100;
    tiers.set(name, t);
    if (ix.order >= 0 && String(g("order")).trim()) orders.add(String(g("order")).trim());
    const cv = String(g("checkin")).trim().toLowerCase();
    if (cv && !["0", "nein", "no", "false", "-", "none"].includes(cv)) checked += qn;
  }
  const list = [...tiers.values()].map((t) => ({ ...t, revenue: Math.round(t.revenue * 100) / 100 })).sort((a, b) => (a.price || 0) - (b.price || 0));
  return { tiers: list, orders: orders.size || null, cancelled, checked_in: checked, columns: Object.fromEntries(Object.entries(ix).filter(([, i]) => i >= 0).map(([k, i]) => [k, header[i]])) };
}

// Dialog: Datei wählen → Vorschau → an Nexus senden
export function importDialog(ev, onDone) {
  const input = h("input", { type: "file", accept: ".xlsx,.xls,.csv", style: { display: "none" } });
  const out = h("div.stack");
  let result = null, file = null;
  const send = h("button.btn.primary", { disabled: true, onclick: async () => {
    send.disabled = true;
    try {
      const r = await api("events/tickets", { event_id: ev.id, source: "eventfrog", tiers: result.tiers, orders: result.orders, cancelled: result.cancelled,
        checked_in: result.checked_in, capacity: ev.metadata?.capacity || ev.expected_guests || undefined, as_of: new Date(file.lastModified).toISOString() });
      toast(`${r.sold} Tickets übernommen (${r.new_since_last >= 0 ? "+" : ""}${r.new_since_last})`); m.close(); onDone?.();
    } catch (e) { toastErr(e); send.disabled = false; }
  } }, icon("upload"), "Übernehmen");
  input.addEventListener("change", async () => {
    file = input.files[0]; if (!file) return;
    out.replaceChildren(h("div.spinner"));
    try {
      result = analyze(await readRows(file));
      const sold = result.tiers.reduce((a, t) => a + t.sold, 0), rev = result.tiers.reduce((a, t) => a + t.revenue, 0);
      out.replaceChildren(
        h("div.faint", { style: { fontSize: "12.5px" } }, `${file.name} · erkannte Spalten: ${Object.entries(result.columns).map(([k, v]) => `${k} = „${v}“`).join(", ")}`),
        h("div.list", result.tiers.map((t) => h("div.list-item", h("div.li-main", h("div.li-title", t.name), h("div.li-sub", t.price !== null ? `${fmtEUR(t.price)} pro Ticket` : "")), h("span.nowrap", `${fmtNum(t.sold)} × · ${fmtEUR(t.revenue)}`)))),
        h("div.row.between", h("strong", `${fmtNum(sold)} Tickets · ${fmtEUR(rev)}`), h("span.faint", `${result.cancelled} storniert · ${result.checked_in} eingecheckt`)));
      send.disabled = !sold;
    } catch (e) { out.replaceChildren(h("div.login-err", e.message)); send.disabled = true; }
  });
  const m = modal(`Eventfrog-Export – ${ev.name}`, h("div.stack",
    h("div.na-note", icon("lock"), h("div", "Eventfrog › Event › Verkauf › Bestellungen, Stornierungen › „Käuferdaten exportieren“. Die Datei wird nur hier im Browser gelesen – gesendet werden ausschließlich Summen je Ticketkategorie, keine Namen oder E-Mails.")),
    h("button.btn", { onclick: () => input.click() }, icon("file"), "Export-Datei wählen (.xlsx oder .csv)"), input, out),
    { foot: [h("button.btn.ghost", { onclick: () => m.close() }, "Abbrechen"), send] });
}
