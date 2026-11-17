// Belege & Verträge zum Event: hochladen (PDF, Foto, Text) → KI liest alles aus → Vorschläge prüfen → in die Kalkulation übernehmen → neu gerechnet.
import { h, icon, toast, toastErr, errMsg, fmtEUR, modal } from "./ui.js";
import { nx } from "./api.js";
import { parseJson } from "./aigen.js";
import { COSTS, DETAILS, compute } from "./eventcalc.js";

const TYPES = { rechnung: ["Rechnung", "b-bad"], vertrag: ["Vertrag", "b-pri"], angebot: ["Angebot", "b-warn"], ticketliste: ["Ticketliste", "b-ok"], quittung: ["Quittung", "b-idle"], sonstiges: ["Dokument", "b-idle"] };
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(+v) ? null : +v);
const DKEYS = DETAILS.flatMap(([, fs]) => fs.map(([k, l]) => [k, l])).filter(([k]) => k);
const MAX = 6 * 1024 * 1024;

const PROMPT = `Du liest ein Dokument zu einem Event (Rechnung, Vertrag, Angebot, Quittung, Ticket-Export o. Ä.) und überträgst NUR, was wirklich drinsteht – nichts erfinden, nichts schätzen.
Antworte NUR mit JSON:
{"type":"rechnung|vertrag|angebot|ticketliste|quittung|sonstiges","title":"kurzer Titel","partner":"Firma/Person oder leer","date":"YYYY-MM-DD oder null","due":"Zahlungs-/Fristdatum YYYY-MM-DD oder null",
"net":Zahl|null,"vat_pct":Zahl|null,"gross":Zahl|null,"paid":true|false|null,"summary":"2–3 Sätze: was ist das, was muss man wissen",
"costs":[{"key":"<Kostenart>","label":"Bezeichnung","amount":Bruttobetrag in €,"status":"cost|loc"}],
"location":{"net":Zahl,"vat":Zahl}|null,
"tickets":[{"name":"Kategorie","qty":Anzahl verfügbar,"price":Startpreis,"priceEnd":Endpreis|null,"sold":verkauft|null}],
"guests":Zahl|null,"bar":[{"name":"Getränk","sell":Verkaufspreis|null,"buy":Einkaufspreis|null}],"wardrobe_price":Zahl|null,
"details":{"<feld>":"Wert"},"tasks":[{"title":"was ist zu tun","due":"YYYY-MM-DD oder null"}],"warnings":["Fristen, Strafen, Stornobedingungen, Haftung, Auffälligkeiten"]}
Regeln:
- Kostenarten (key): ${COSTS.map(([k, l]) => `${k}=${l}`).join(", ")}, "extra" für alles andere. NICHT für die Location-Miete – die gehört in "location" (netto + MwSt-Satz).
- status "loc" nur, wenn das Dokument sagt, dass der Posten im Location-Preis enthalten ist (Betrag dann 0).
- Beträge als Zahlen ohne €-Zeichen, Dezimalpunkt. Wenn nur netto da steht: amount = netto × (1 + MwSt).
- details-Felder (nur wenn im Dokument): ${DKEYS.map(([k, l]) => `${k}=${l}`).join("; ")}.
- tasks: Zahlungen mit Fälligkeit, Fristen, Unterschriften, Anmeldungen – mit Datum, wenn genannt.
- Leere Listen statt erfundener Werte.`;

// Datei → { mime, data(base64) } oder { text }; Fotos werden verkleinert
async function readFile(f) {
  const name = f.name || "Datei";
  if (/^text\/|\.(csv|txt|md|ics)$/i.test(f.type || name)) return { text: (await f.text()).slice(0, 20000) };
  if (/^image\//.test(f.type)) {
    try {
      const bmp = await window.createImageBitmap(f);
      const sc = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
      const cv = document.createElement("canvas"); cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
      cv.getContext("2d").drawImage(bmp, 0, 0, cv.width, cv.height);
      const url = cv.toDataURL("image/jpeg", 0.85);
      return { mime: "image/jpeg", data: url.split(",")[1] };
    } catch { /* unten als Original */ }
  }
  if (f.size > MAX) throw new Error(`„${name}“ ist zu groß (max. 6 MB). Tipp: als Foto oder kleinere PDF hochladen.`);
  if (!/^(application\/pdf|image\/(png|jpeg|webp|heic|heif))$/.test(f.type)) throw new Error(`„${name}“: Nur PDF, Fotos oder Text-Dateien werden gelesen.`);
  const buf = new Uint8Array(await f.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return { mime: f.type, data: window.btoa(bin) };
}

export async function analyzeDoc({ file, text, eventName, calc }) {
  const R = calc ? compute(calc) : null;
  const ctx = `Event: ${eventName || "–"}${R ? ` · aktuell ${R.G} Gäste, Kosten ${R.costs} €, Tickets: ${(calc.tickets || []).map((t) => `${t.name} ${t.qty}× ${t.price}${t.priceEnd ? `→${t.priceEnd}` : ""}`).join(", ")}` : ""}`;
  const payload = file ? await readFile(file) : { text: String(text || "").slice(0, 20000) };
  const input = payload.text ? `${ctx}\n\nDOKUMENT (Text):\n${payload.text}` : `${ctx}\n\nDas Dokument ist angehängt (${file?.name || "Datei"}).`;
  const r = await nx("gen", { task: "beleg", instructions: PROMPT, input, json: true, max_tokens: 3500, ...(payload.data ? { file: { mime: payload.mime, data: payload.data } } : {}) });
  const j = r.json || parseJson(r.text);
  if (!j || typeof j !== "object") throw new Error("Die KI konnte das Dokument nicht lesen. Versuch ein schärferes Foto oder füge den Text ein.");
  return j;
}

// Vorschläge aus einer Analyse → Liste von Änderungen [{id, label, from, to, apply(c, d)}]
export function proposals(a, calc, details = {}) {
  const c = calc || {};
  const out = [];
  const costLabel = (k) => COSTS.find(([x]) => x === k)?.[1];
  if (a.location && num(a.location.net)) {
    const vat = num(a.location.vat) ?? 19;
    out.push({ id: "loc", label: "Location-Miete", from: c.location?.net ? `${fmtEUR(c.location.net)} netto` : "–", to: `${fmtEUR(num(a.location.net))} netto + ${vat} % MwSt`,
      apply: (x) => { x.location = { ...(x.location || {}), net: num(a.location.net), vat }; } });
  }
  for (const k of a.costs || []) {
    const amount = num(k.amount);
    if (k.key && costLabel(k.key)) {
      const old = c.costs?.[k.key];
      const st = k.status === "loc" ? "loc" : "cost";
      if (st === "cost" && !amount) continue;
      out.push({ id: `c:${k.key}:${k.label}`, label: costLabel(k.key) + (k.label && k.label !== costLabel(k.key) ? ` (${k.label})` : ""),
        from: !old || old.st === "no" ? "nicht eingetragen" : old.st === "loc" ? "im Location-Preis" : fmtEUR((+old.amount || 0) + (+old.persons || 0) * (+old.hours || 0) * (+old.rate || 0)),
        to: st === "loc" ? "im Location-Preis enthalten" : fmtEUR(amount),
        apply: (x) => { x.costs ||= {}; x.costs[k.key] = st === "loc" ? { ...(x.costs[k.key] || {}), st: "loc" } : { st: "cost", amount }; } });
    } else if (amount) {
      const name = String(k.label || "Sonstiges").slice(0, 80);
      const old = (c.extra || []).find((e) => e.name === name);
      out.push({ id: `e:${name}`, label: `Weitere Kosten: ${name}`, from: old ? fmtEUR(old.amount) : "neu", to: fmtEUR(amount),
        apply: (x) => { x.extra ||= []; const o = x.extra.find((e) => e.name === name); if (o) o.amount = amount; else x.extra.push({ name, amount }); } });
    }
  }
  for (const t of a.tickets || []) {
    if (!t.name || !(num(t.qty) || num(t.price))) continue;
    const old = (c.tickets || []).find((o) => String(o.name).toLowerCase().trim() === String(t.name).toLowerCase().trim());
    const desc = (o) => (o ? `${o.qty ?? "?"}× ${fmtEUR(+o.price || 0)}${+o.priceEnd ? ` → ${fmtEUR(+o.priceEnd)}` : ""}` : "neu");
    const nt = { name: t.name, qty: num(t.qty) ?? old?.qty ?? "", price: num(t.price) ?? old?.price ?? "", priceEnd: num(t.priceEnd) ?? old?.priceEnd ?? "" };
    out.push({ id: `t:${t.name}`, label: `Ticket: ${t.name}`, from: desc(old), to: desc(nt),
      apply: (x) => { x.tickets ||= []; const o = x.tickets.find((y) => String(y.name).toLowerCase().trim() === String(t.name).toLowerCase().trim()); if (o) Object.assign(o, { qty: nt.qty, price: nt.price, priceEnd: nt.priceEnd }); else x.tickets.push({ ...nt, phases: [] }); } });
  }
  if (num(a.guests)) out.push({ id: "g", label: "Erwartete Gäste / Kapazität", from: String(c.guests ?? "–"), to: String(num(a.guests)), apply: (x) => { x.guests = num(a.guests); } });
  for (const b of a.bar || []) {
    if (!b.name || !(num(b.sell) || num(b.buy))) continue;
    out.push({ id: `b:${b.name}`, label: `Getränk: ${b.name}`, from: (c.bar || []).find((y) => y.name === b.name) ? "vorhanden" : "neu", to: [num(b.sell) ? `Verkauf ${fmtEUR(num(b.sell))}` : null, num(b.buy) ? `Einkauf ${fmtEUR(num(b.buy))}` : null].filter(Boolean).join(" · "),
      apply: (x) => { x.bar ||= []; const o = x.bar.find((y) => y.name === b.name); if (o) { if (num(b.sell)) o.sell = num(b.sell); if (num(b.buy)) o.buy = num(b.buy); } else x.bar.push({ name: b.name, sell: num(b.sell) ?? "", buy: num(b.buy) ?? "", per: 0.5 }); } });
  }
  if (num(a.wardrobe_price)) out.push({ id: "w", label: "Garderobe pro Teil", from: c.wardrobe?.price ? fmtEUR(c.wardrobe.price) : "–", to: fmtEUR(num(a.wardrobe_price)), apply: (x) => { x.wardrobe = { rate: 60, ...(x.wardrobe || {}), price: num(a.wardrobe_price) }; } });
  for (const [k, v] of Object.entries(a.details || {})) {
    const f = DKEYS.find(([x]) => x === k); if (!f || v === null || v === "" || typeof v === "object") continue;
    if (String(details[k] || "") === String(v)) continue;
    out.push({ id: `d:${k}`, label: `Steckbrief: ${f[1].replace(/ \(.*\)$/, "")}`, from: details[k] ? String(details[k]).slice(0, 40) : "leer", to: String(v).slice(0, 60), details: true, apply: (_x, d) => { d[k] = String(v).slice(0, 3000); } });
  }
  for (const t of a.tasks || []) if (t.title) out.push({ id: `a:${t.title}`, label: "Aufgabe", from: "", to: `${t.title}${t.due ? ` (bis ${new Date(t.due).toLocaleDateString("de-DE")})` : ""}`, task: { title: String(t.title).slice(0, 200), due: t.due || null } });
  return out;
}

// Ergebnis-Dialog: Vorschläge anhaken → übernehmen → vorher/nachher
function reviewDialog({ a, fileName, calc, details, onApply }) {
  const props = proposals(a, calc, details);
  const on = new Set(props.map((p) => p.id));
  const before = calc ? compute(calc) : null;
  const preview = h("div.dc-prev");
  const sim = () => { const c = JSON.parse(JSON.stringify(calc || {})); const d = { ...details }; props.filter((p) => on.has(p.id) && p.apply).forEach((p) => p.apply(c, d)); return { c, d }; };
  const drawPrev = () => {
    const { c } = sim(); if (!c.tickets && !c.location) return preview.replaceChildren();
    const R = compute(c);
    const cell = (l, a0, b0, fmt = fmtEUR) => h("div", h("small", l), h("b", fmt(b0)), before ? h("span", a0 === b0 ? "unverändert" : `vorher ${fmt(a0)}`) : null);
    preview.replaceChildren(cell("Kosten", before?.costs, R.costs), cell("Einnahmen", before?.income, R.income), cell("Ergebnis", before?.result, R.result), cell("Break-even", before?.beAll, R.beAll, (v) => (v ? `${v} Gäste` : "–")));
  };
  const T = TYPES[a.type] || TYPES.sonstiges;
  const m = modal(`KI hat gelesen: ${fileName}`.slice(0, 80), h("div.stack", { style: { gap: "12px" } },
    h("div.row.wrap", { style: { gap: "6px" } }, h("span.badge", { class: T[1] }, T[0]), a.partner ? h("span.badge.b-idle", a.partner) : null, a.date ? h("span.badge.b-idle", new Date(a.date).toLocaleDateString("de-DE")) : null,
      num(a.gross) ? h("span.badge.b-pri", `${fmtEUR(num(a.gross))} brutto`) : null, a.due ? h("span.badge.b-warn", `fällig ${new Date(a.due).toLocaleDateString("de-DE")}`) : null, a.paid === true ? h("span.badge.b-ok", "bezahlt") : null),
    a.summary ? h("p", { style: { margin: 0, fontSize: "14px" } }, a.summary) : null,
    (a.warnings || []).length ? h("div.sync-err", h("b", "Achtung: "), h("ul", { style: { margin: "4px 0 0", paddingLeft: "18px" } }, a.warnings.slice(0, 8).map((w) => h("li", String(w))))) : null,
    props.length ? h("div", h("b", { style: { fontSize: "14px" } }, "Das kann ich eintragen – Haken weg, was nicht passt:"),
      h("div.list", { style: { marginTop: "6px" } }, props.map((p) => h("label.list-item.dc-prop", h("input", { type: "checkbox", checked: true, style: { width: "18px", height: "18px", accentColor: "var(--primary)" }, onchange: (e) => { if (e.target.checked) on.add(p.id); else on.delete(p.id); drawPrev(); } }),
        h("div.li-main", h("div.li-title", p.label), h("div.li-sub", p.from ? `${p.from} → ${p.to}` : p.to)))))) : h("div.faint", "Nichts gefunden, was sich in die Kalkulation eintragen lässt – das Dokument wird trotzdem bei den Belegen gespeichert."),
    preview,
    h("p.faint", { style: { margin: 0, fontSize: "12px" } }, "Die KI kann sich verlesen – prüf die Beträge kurz mit dem Original.")), { wide: true,
    foot: [h("button.btn.ghost", { onclick: async () => { await onApply({ calc: null, details: null, tasks: [], doc: docOf(a, fileName, false) }); m.close(); } }, "Nur als Beleg speichern"),
      h("button.btn.primary", { onclick: async (e) => { e.currentTarget.disabled = true; try { const { c, d } = sim(); const tasks = props.filter((p) => on.has(p.id) && p.task).map((p) => p.task);
        await onApply({ calc: props.some((p) => on.has(p.id) && p.apply && !p.details) ? c : null, details: props.some((p) => on.has(p.id) && p.details) ? d : null, tasks, doc: docOf(a, fileName, true) }); m.close(); toast("Eingetragen – alles neu berechnet"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("check"), "Übernehmen & neu rechnen")] });
  drawPrev();
}
const docOf = (a, name, applied) => ({ id: `d${Date.now().toString(36)}`, name: String(name).slice(0, 120), type: TYPES[a.type] ? a.type : "sonstiges", partner: a.partner || "", date: a.date || null, due: a.due || null,
  gross: num(a.gross), paid: a.paid ?? null, summary: String(a.summary || "").slice(0, 600), warnings: (a.warnings || []).slice(0, 8).map((w) => String(w).slice(0, 300)), applied, at: new Date().toISOString() });

// Karte auf der Event-Seite. save({calc, details, docs, tasks}) speichert und lädt neu.
export function docsCard({ name, calc, details = {}, docs = [], save, storeFile = null, readOnly = false }) {
  let list = [...docs];
  const card = h("section.card", { id: "sec-docs", style: { marginBottom: "16px" } });
  const busy = h("div.stack", { style: { gap: "6px" } });
  const fileIn = h("input", { type: "file", multiple: true, hidden: true, accept: "application/pdf,image/*,.txt,.csv,.md", onchange: () => { run([...fileIn.files]); fileIn.value = ""; } });
  async function run(files) {
    for (const f of files) {
      const row = h("div.dc-busy", h("span.spin"), `KI liest „${f.name}“ …`); busy.append(row);
      try {
        const a = await analyzeDoc({ file: f, eventName: name, calc });
        row.remove();
        let path = null; if (storeFile) { try { path = await storeFile(f); } catch { path = null; } }
        reviewDialog({ a, fileName: f.name, calc, details, onApply: async ({ calc: nc, details: nd, tasks, doc }) => {
          if (path) doc.path = path;
          list = [doc, ...list].slice(0, 60);
          await save({ calc: nc, details: nd, docs: list, tasks });
        } });
      } catch (e) { row.replaceChildren(icon("alert"), ` ${f.name}: ${errMsg(e)}`); row.classList.add("bad"); }
    }
  }
  const pasteText = () => {
    const ta = h("textarea.input", { rows: 10, placeholder: "Text aus Rechnung, Vertrag oder E-Mail hier einfügen …", "aria-label": "Text des Dokuments" });
    const m = modal("Text analysieren", h("div.stack", ta), { foot: [h("button.btn.primary", { onclick: async (e) => { if (!ta.value.trim()) return; e.currentTarget.disabled = true;
      try { const a = await analyzeDoc({ text: ta.value, eventName: name, calc }); m.close(); reviewDialog({ a, fileName: "Eingefügter Text", calc, details, onApply: async ({ calc: nc, details: nd, tasks, doc }) => { list = [doc, ...list].slice(0, 60); await save({ calc: nc, details: nd, docs: list, tasks }); } }); }
      catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("sparkles"), "Analysieren")] });
  };
  const draw = () => {
    const sum = (t) => list.filter((d) => d.type === t && d.gross).reduce((s, d) => s + d.gross, 0);
    const open = list.filter((d) => d.type === "rechnung" && d.paid !== true && d.gross);
    card.replaceChildren(
      h("div.card-head", h("h3.row", icon("file"), "Belege & Verträge", list.length ? h("span.faint", { style: { fontWeight: 400 } }, String(list.length)) : null),
        readOnly ? null : h("div.row", { style: { gap: "6px" } }, h("button.btn.sm.ghost", { onclick: pasteText }, icon("edit"), "Text"), h("button.btn.sm.primary", { onclick: () => fileIn.click() }, icon("upload"), "Hochladen"))),
      h("div.card-body.stack", { style: { gap: "10px" } },
        readOnly ? null : h("div.drop.dc-drop", { tabindex: 0, role: "button", onclick: () => fileIn.click(), onkeydown: (e) => (e.key === "Enter" || e.key === " ") && fileIn.click(),
          ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add("over"); }, ondragleave: (e) => e.currentTarget.classList.remove("over"),
          ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove("over"); run([...e.dataTransfer.files]); } },
          icon("sparkles"), h("div", h("strong", "Rechnung, Vertrag, Angebot oder Ticketliste hochladen"), h("div.faint", { style: { fontSize: "12.5px" } }, "PDF oder Foto – die KI liest Beträge, Tickets, Fristen und trägt sie nach deinem OK in die Kalkulation ein."))),
        busy,
        list.length ? h("div.row.wrap", { style: { gap: "6px" } }, sum("rechnung") ? h("span.badge.b-bad", `Rechnungen ${fmtEUR(sum("rechnung"))}`) : null, open.length ? h("span.badge.b-warn", `${open.length} offen · ${fmtEUR(open.reduce((s, d) => s + d.gross, 0))}`) : null,
          sum("vertrag") ? h("span.badge.b-pri", `Verträge ${fmtEUR(sum("vertrag"))}`) : null, sum("angebot") ? h("span.badge.b-warn", `Angebote ${fmtEUR(sum("angebot"))}`) : null) : null,
        list.length ? h("div.list", list.map((d) => { const T = TYPES[d.type] || TYPES.sonstiges; return h("div.list-item",
          h("div.li-icon", icon("file")),
          h("div.li-main", { style: { cursor: "pointer" }, onclick: () => modal(d.name, h("div.stack", { style: { gap: "8px" } }, h("div.row.wrap", { style: { gap: "6px" } }, h("span.badge", { class: T[1] }, T[0]), d.partner ? h("span.badge.b-idle", d.partner) : null, d.gross ? h("span.badge.b-pri", fmtEUR(d.gross)) : null, d.due ? h("span.badge.b-warn", `fällig ${new Date(d.due).toLocaleDateString("de-DE")}`) : null),
            d.summary ? h("p", { style: { margin: 0 } }, d.summary) : null, d.warnings?.length ? h("div.sync-err", h("ul", { style: { margin: 0, paddingLeft: "18px" } }, d.warnings.map((w) => h("li", w)))) : null,
            h("div.faint", { style: { fontSize: "12px" } }, `${d.applied ? "In die Kalkulation übernommen" : "Nur als Beleg gespeichert"} · ${new Date(d.at).toLocaleString("de-DE")}${d.path ? " · Datei im Projekt gespeichert" : ""}`))) },
            h("div.li-title", d.name), h("div.li-sub", [T[0], d.partner, d.date ? new Date(d.date).toLocaleDateString("de-DE") : null, d.due && d.paid !== true ? `fällig ${new Date(d.due).toLocaleDateString("de-DE")}` : null].filter(Boolean).join(" · "))),
          d.gross ? h("span.nowrap", fmtEUR(d.gross)) : null,
          d.type === "rechnung" && !readOnly ? h("button.btn.sm", { class: d.paid ? "" : "ghost", title: "Bezahlt?", onclick: async () => { d.paid = !d.paid; await save({ docs: list }); draw(); } }, d.paid ? "bezahlt ✓" : "offen") : null,
          readOnly ? null : h("button.icon-btn", { "aria-label": `${d.name} entfernen`, onclick: async () => { list = list.filter((x) => x !== d); await save({ docs: list }); draw(); } }, icon("x"))); })) : null,
        fileIn));
  };
  draw();
  return card;
}
