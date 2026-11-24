// Notenrechner (Handy-App): Bundesland, Stufe, Fächer, Noten je Halbjahr → Schnitt je Fach und Halbjahr,
// Oberstufe zusätzlich Defizite und Abitur-Hochrechnung nach der KMK-Formel (Block I = P : S · 40, Block II = Prüfungen · 4,
// Note = 17/3 − Punkte/180, auf eine Nachkommastelle abgeschnitten). Gespeichert im eigenen Konto (nx_gradebook, nur für dich).
import { sb, q } from "./api.js";
import { h, toast, toastErr, modal, confirmDialog } from "./ui.js";

export const LAENDER = [["BW", "Baden-Württemberg"], ["BY", "Bayern"], ["BE", "Berlin"], ["BB", "Brandenburg"], ["HB", "Bremen"], ["HH", "Hamburg"], ["HE", "Hessen"],
  ["MV", "Mecklenburg-Vorpommern"], ["NI", "Niedersachsen"], ["NW", "Nordrhein-Westfalen"], ["RP", "Rheinland-Pfalz"], ["SL", "Saarland"], ["SN", "Sachsen"],
  ["ST", "Sachsen-Anhalt"], ["SH", "Schleswig-Holstein"], ["TH", "Thüringen"]];
// Vorschläge je Land (änderbar): Benennung der Halbjahre, Leistungskurse doppelt (z. B. NRW: „LK doppelt, GK einfach“)
const LAND_DEF = { BY: { hj: ["12/1", "12/2", "13/1", "13/2"] }, NW: { lkDoppelt: true }, BW: { hj: ["J1/1", "J1/2", "J2/1", "J2/2"] } };
const HJ_PRESETS = [["Q1–Q4", ["Q1", "Q2", "Q3", "Q4"]], ["11/1–12/2", ["11/1", "11/2", "12/1", "12/2"]], ["12/1–13/2", ["12/1", "12/2", "13/1", "13/2"]], ["J1/J2", ["J1/1", "J1/2", "J2/1", "J2/2"]]];
const FAECHER = ["Deutsch", "Mathematik", "Englisch", "Französisch", "Spanisch", "Latein", "Russisch", "Biologie", "Chemie", "Physik", "Informatik", "Geschichte", "Politische Bildung",
  "Geografie", "Wirtschaft", "Psychologie", "Philosophie", "Religion", "Ethik", "LER", "Kunst", "Musik", "Darstellendes Spiel", "Sport", "Sporttheorie", "Seminarkurs"];
export const ARTEN = [["klausur", "Klausur"], ["test", "Test"], ["muendlich", "Mündlich"], ["sonst", "Sonstiges"]];
const SEK1 = [["1+", 0.7], ["1", 1], ["1-", 1.3], ["2+", 1.7], ["2", 2], ["2-", 2.3], ["3+", 2.7], ["3", 3], ["3-", 3.3], ["4+", 3.7], ["4", 4], ["4-", 4.3], ["5+", 4.7], ["5", 5], ["5-", 5.3], ["6", 6]];
const uid = () => Math.random().toString(36).slice(2, 10);
const fmt = (n, d = 1) => (n === null || n === undefined || Number.isNaN(n) ? "–" : n.toFixed(d).replace(".", ","));
// Punkte ↔ Note (Oberstufe): 15–13 = 1, 12–10 = 2 … 0 = 6
export const punkteZuNote = (p) => (p === null ? null : p >= 1 ? Math.round(((17 - p) / 3) * 10) / 10 : 6);

// ---------- Rechnen ----------
export function fachSchnitt(book, fachId, hj) {
  const f = book.faecher.find((x) => x.id === fachId);
  const z = book.zeugnis?.[`${fachId}|${hj}`];
  if (z !== undefined && z !== null && z !== "") return { wert: Number(z), zeugnis: true };
  const ns = book.noten.filter((n) => n.fach === fachId && n.hj === hj);
  if (!ns.length) return { wert: null };
  const avg = (a) => (a.length ? a.reduce((s, n) => s + Number(n.wert), 0) / a.length : null);
  const k = avg(ns.filter((n) => n.art === "klausur")), s = avg(ns.filter((n) => n.art !== "klausur"));
  const w = Math.max(0, Math.min(100, Number(f?.klausurAnteil ?? (book.stufe === "sek1" ? 50 : 50)))) / 100;
  const wert = k !== null && s !== null ? k * w + s * (1 - w) : k ?? s;
  return { wert, k, s, w, n: ns.length };
}
const kursPunkte = (book, x) => (book.stufe === "sek1" ? x : Math.round(x));   // Halbjahresleistung in der Oberstufe = ganze Punkte
export function hjSchnitt(book, hj) {
  let sum = 0, cnt = 0;
  for (const f of book.faecher) {
    const r = fachSchnitt(book, f.id, hj); if (r.wert === null) continue;
    const g = book.stufe !== "sek1" && book.lkDoppelt && f.lk ? 2 : 1;
    sum += kursPunkte(book, r.wert) * g; cnt += g;
  }
  return cnt ? sum / cnt : null;
}
export function abitur(book) {
  if (book.stufe === "sek1") return null;
  const kurse = [];
  for (const f of book.faecher) for (const hj of book.halbjahre) { const r = fachSchnitt(book, f.id, hj); if (r.wert !== null) kurse.push({ f, hj, p: Math.round(r.wert), g: book.lkDoppelt && f.lk ? 2 : 1 }); }
  if (!kurse.length) return { kurse: 0 };
  const defizite = kurse.filter((k) => k.p < 5).length, nullen = kurse.filter((k) => k.p === 0).length;
  let use = kurse;
  const n = Number(book.einbringen) || 0;
  if (n > 0 && kurse.length > n) {   // Pflicht = Leistungskurse und Prüfungsfächer, Rest die besten
    const must = kurse.filter((k) => k.f.lk || k.f.pruefung), rest = kurse.filter((k) => !(k.f.lk || k.f.pruefung)).sort((a, b) => b.p - a.p);
    use = [...must, ...rest].slice(0, Math.max(n, must.length));
  }
  const P = use.reduce((s, k) => s + k.p * k.g, 0), S = use.reduce((s, k) => s + k.g, 0);
  const geplant = book.halbjahre.length * book.faecher.length;
  const b1 = Math.min(600, Math.round((P / S) * 40));
  // Block II: 5 Prüfungsfächer × 4; fehlt ein Ergebnis, wird der Schnitt des Fachs (sonst Gesamtschnitt) angenommen
  const pf = book.faecher.filter((f) => f.pruefung).sort((a, b) => a.pruefung - b.pruefung).slice(0, 5);
  const avgAll = P / S;
  const pruef = [];
  for (let i = 0; i < 5; i++) {
    const f = pf[i];
    const real = f ? book.pruefungen?.[f.id] : undefined;
    if (real !== undefined && real !== null && real !== "") { pruef.push({ f, p: Number(real), echt: true }); continue; }
    const fk = f ? kurse.filter((k) => k.f.id === f.id) : [];
    pruef.push({ f, p: fk.length ? fk.reduce((s, k) => s + k.p, 0) / fk.length : avgAll, echt: false });
  }
  const b2 = Math.round(pruef.reduce((s, x) => s + x.p * 4, 0));
  const ges = b1 + b2;
  const note = ges >= 823 ? 1.0 : Math.min(4.0, Math.floor((17 / 3 - ges / 180) * 10 + 1e-9) / 10);
  return { kurse: kurse.length, eingebracht: use.length, geplant, defizite, nullen, b1, b2, ges, note, bestanden: b1 >= 200 && b2 >= 100, pruef, schnitt: avgAll };
}
// Welche Note brauche ich in der nächsten Klausur, um im Fach den Zielschnitt zu erreichen?
export function brauche(book, fachId, hj, ziel, art = "klausur") {
  const f = book.faecher.find((x) => x.id === fachId);
  const ns = book.noten.filter((n) => n.fach === fachId && n.hj === hj);
  const K = ns.filter((n) => n.art === "klausur").map((n) => +n.wert), S = ns.filter((n) => n.art !== "klausur").map((n) => +n.wert);
  const w = Number(f?.klausurAnteil ?? 50) / 100;
  const avg = (a) => a.reduce((s, x) => s + x, 0) / a.length;
  const list = art === "klausur" ? K : S, other = art === "klausur" ? S : K, wl = art === "klausur" ? w : 1 - w;
  // Ziel = wl·(sum+x)/(n+1) + (1−wl)·avg(other)   (ohne Noten der anderen Art zählt nur diese)
  const o = other.length ? avg(other) : null;
  const need = o === null || wl >= 1 ? ziel * (list.length + 1) - list.reduce((s, x) => s + x, 0)
    : ((ziel - (1 - wl) * o) / wl) * (list.length + 1) - list.reduce((s, x) => s + x, 0);
  return need;
}

// ---------- Speichern ----------
let book = null, saveT = null, owner = null;
const LS = "nx:grades";
function blank() { return { v: 1, land: "BB", stufe: "oberstufe", halbjahre: ["Q1", "Q2", "Q3", "Q4"], aktiv: "Q1", lkDoppelt: false, einbringen: 0, faecher: [], noten: [], zeugnis: {}, pruefungen: {} }; }
async function loadBook() {
  if (book) return book;
  const { data: { session } } = await sb.auth.getSession();
  owner = session?.user?.id;
  try {
    const rows = await q(sb.from("nx_gradebook").select("data").limit(1));
    book = rows[0]?.data && rows[0].data.faecher ? rows[0].data : null;
  } catch { book = null; }
  if (!book) { try { book = JSON.parse(localStorage.getItem(LS) || "null"); } catch { book = null; } }
  book = { ...blank(), ...(book || {}) };
  return book;
}
function persist(immediate = false) {
  try { localStorage.setItem(LS, JSON.stringify(book)); } catch { /* privat */ }
  clearTimeout(saveT);
  const run = async () => { try { await q(sb.from("nx_gradebook").upsert({ owner_id: owner, data: book, updated_at: new Date().toISOString() }, { onConflict: "owner_id" })); } catch (e) { toastErr(e); } };
  if (immediate) return run();
  saveT = setTimeout(run, 600);
}

// ---------- Oberfläche ----------
export async function gradesView(rerender) {
  await loadBook();
  if (!book.faecher.length) return setupView(rerender);
  const ober = book.stufe !== "sek1";
  if (!book.halbjahre.includes(book.aktiv)) book.aktiv = book.halbjahre[0];
  const hj = book.aktiv;
  const s = hjSchnitt(book, hj);
  const abi = abitur(book);
  const tl = (label, value, sub, cls = "") => h("div.g-tile", { class: cls }, h("div.g-tile-l", label), h("div.g-tile-v", value), sub ? h("div.g-tile-s", sub) : null);
  const card = (f) => {
    const r = fachSchnitt(book, f.id, hj);
    const ns = book.noten.filter((n) => n.fach === f.id && n.hj === hj).sort((a, b) => String(a.datum || "").localeCompare(String(b.datum || "")));
    const bad = r.wert !== null && (ober ? Math.round(r.wert) < 5 : r.wert > 4.49);
    return h("section.g-fach", { class: bad ? "bad" : "" },
      h("button.g-fach-h", { type: "button", onclick: () => fachSheet(f, rerender), "aria-label": `${f.name}: Details` },
        h("div.g-fach-n", h("b", f.name), f.lk ? h("span.g-badge", ober ? "LK" : "Haupt") : null, f.pruefung ? h("span.g-badge.p", `P${f.pruefung}`) : null),
        h("div.g-fach-s", r.wert === null ? h("span.g-mute", "noch keine Note") : [h("b", ober ? fmt(r.wert) : fmt(r.wert, 2)), h("span", ober ? ` P. · Note ${fmt(punkteZuNote(Math.round(r.wert)))}` : ""), r.zeugnis ? h("span.g-badge", "Zeugnis") : null])),
      h("div.g-pills", ...ns.map((n) => h("button.g-pill", { type: "button", class: n.art, title: `${ARTEN.find((a) => a[0] === n.art)?.[1]}${n.datum ? ` · ${new Date(n.datum).toLocaleDateString("de-DE")}` : ""}${n.notiz ? ` · ${n.notiz}` : ""}`, onclick: () => noteSheet(f, n, rerender) },
        h("small", (ARTEN.find((a) => a[0] === n.art)?.[1] || "")[0]), ober ? String(n.wert) : (SEK1.find((x) => x[1] === Number(n.wert))?.[0] ?? String(n.wert)))),
        h("button.g-add", { type: "button", "aria-label": `Note in ${f.name} eintragen`, onclick: () => noteSheet(f, null, rerender) }, "+ Note")));
  };
  // Verlauf über alle Halbjahre
  const verlauf = book.halbjahre.map((x) => [x, hjSchnitt(book, x)]);
  const max = ober ? 15 : 6;
  const chart = h("div.g-chart", verlauf.map(([x, v]) => h("button.g-col", { type: "button", class: x === hj ? "on" : "", onclick: () => { book.aktiv = x; persist(); rerender(); }, "aria-label": `${x}: ${v === null ? "keine Noten" : fmt(v)}` },
    h("span.g-colv", v === null ? "–" : fmt(v)), h("i", { style: { height: `${v === null ? 4 : Math.max(6, (ober ? v : 7 - v) / (ober ? max : 6) * 100)}%` } }), h("span.g-coll", x))));
  return h("div.m-pad.g",
    h("div.m-head", h("h1", "Noten"), h("button.btn.sm", { onclick: () => settingsSheet(rerender) }, "Einstellungen")),
    h("div.g-hj", book.halbjahre.map((x) => h("button.chip", { type: "button", class: x === hj ? "on" : "", "aria-pressed": String(x === hj), onclick: () => { book.aktiv = x; persist(); rerender(); } }, x))),
    h("div.g-tiles",
      tl(`Schnitt ${hj}`, s === null ? "–" : ober ? `${fmt(s)} P.` : fmt(s, 2), s === null ? "noch keine Noten" : ober ? `≈ Note ${fmt(punkteZuNote(s))}` : "Durchschnittsnote"),
      ober && abi?.kurse ? tl("Abi-Hochrechnung", fmt(abi.note), `${abi.ges} / 900 Punkte`, abi.bestanden ? "" : "warn") : tl("Fächer", String(book.faecher.length), LAENDER.find((l) => l[0] === book.land)?.[1]),
      ober && abi?.kurse ? tl("Defizite (< 5 P.)", String(abi.defizite), abi.nullen ? `${abi.nullen}× 0 Punkte!` : `${abi.kurse} Kurse bewertet`, abi.defizite > 7 || abi.nullen ? "warn" : "") : null),
    h("div.g-list", book.faecher.map(card)),
    h("section.m-card", h("div.m-card-h", h("span", "Verlauf")), chart),
    ober && abi?.kurse ? abiCard(abi, rerender) : null,
    h("section.m-card", h("div.m-card-h", h("span", "Alle Halbjahre")), tableAll()),
    h("p.m-row-s.m-mt", ober ? "Hochrechnung nach der KMK-Formel; Pflichtkurse, Defizit-Grenzen und Einbringung regelt jedes Land etwas anders – die Schule entscheidet verbindlich." : "Schnitt = Klausuren und sonstige Noten nach deinem Anteil je Fach."));
  function unitFmt(v) { return v === null ? "–" : ober ? String(Math.round(v)) : fmt(v); }
  function tableAll() {
    return h("div.g-tbl", h("table", h("thead", h("tr", h("th", "Fach"), ...book.halbjahre.map((x) => h("th", x)), h("th", "Ø"))),
      h("tbody", ...book.faecher.map((f) => {
        const vals = book.halbjahre.map((x) => fachSchnitt(book, f.id, x).wert);
        const got = vals.filter((v) => v !== null);
        return h("tr", h("td", f.name, f.lk ? h("small", ober ? " LK" : "") : null), ...vals.map((v) => h("td", { class: v !== null && (ober ? Math.round(v) < 5 : v > 4.49) ? "bad" : "" }, unitFmt(v))),
          h("td", h("b", got.length ? (ober ? fmt(got.map(Math.round).reduce((a, b) => a + b, 0) / got.length) : fmt(got.reduce((a, b) => a + b, 0) / got.length, 2)) : "–")));
      }),
      h("tr.g-sum", h("td", "Schnitt"), ...book.halbjahre.map((x) => h("td", h("b", (() => { const v = hjSchnitt(book, x); return v === null ? "–" : ober ? fmt(v) : fmt(v, 2); })()))), h("td")))));
  }
}

function abiCard(abi, rerender) {
  const box = h("section.m-card.g-abi",
    h("div.m-card-h", h("span", "Abitur-Hochrechnung")),
    h("div.g-abi-row", h("div", h("small", "Block I (Halbjahre)"), h("b", `${abi.b1} / 600`)), h("div", h("small", "Block II (Prüfungen)"), h("b", `${abi.b2} / 300`)), h("div", h("small", "Gesamt"), h("b", `${abi.ges} / 900`))),
    h("div.g-abi-note", "Abiturnote ", h("b", fmt(abi.note)), abi.bestanden ? null : h("span.g-badge.warn", "unter Mindestpunkten")),
    h("div.m-row-s", `${abi.eingebracht} von ${abi.kurse} bewerteten Kursen eingebracht (geplant ${abi.geplant}). Ø ${fmt(abi.schnitt)} P.`),
    h("div.m-row-s.m-mt", "Prüfungen (leer = geschätzt aus dem Fach-Schnitt):"),
    h("div.g-pruef", abi.pruef.map((x, i) => h("label", h("span", x.f ? `P${i + 1} ${x.f.name}` : `P${i + 1} (kein Fach markiert)`),
      h("input.input.sm", { type: "number", min: 0, max: 15, step: 1, inputmode: "numeric", placeholder: fmt(x.p), value: x.f && x.echt ? String(x.p) : "", disabled: !x.f, "aria-label": `Prüfungsergebnis P${i + 1}`,
        onchange: (e) => { const v = e.target.value; book.pruefungen ||= {}; if (v === "") delete book.pruefungen[x.f.id]; else book.pruefungen[x.f.id] = Math.max(0, Math.min(15, Math.round(+v))); persist(); rerender(); } })))));
  return box;
}

// Note eintragen / ändern
function noteSheet(f, n, rerender) {
  const ober = book.stufe !== "sek1";
  let wert = n ? Number(n.wert) : null, art = n?.art || "klausur";
  const grid = h("div.g-grid");
  const artRow = h("div.g-arten");
  const datum = h("input.input", { type: "date", value: n?.datum || new Date().toISOString().slice(0, 10), "aria-label": "Datum" });
  const notiz = h("input.input", { placeholder: "Notiz (optional), z. B. Thema der Klausur", maxlength: 120, value: n?.notiz || "", "aria-label": "Notiz" });
  const draw = () => {
    grid.replaceChildren(...(ober ? Array.from({ length: 16 }, (_, i) => 15 - i).map((p) => [String(p), p]) : SEK1).map(([t, v]) =>
      h("button.g-val", { type: "button", class: `${wert === v ? "on" : ""} ${ober ? (v < 5 ? "bad" : v >= 13 ? "top" : "") : (v > 4.49 ? "bad" : v < 1.5 ? "top" : "")}`, "aria-pressed": String(wert === v), onclick: () => { wert = v; draw(); } }, t)));
    artRow.replaceChildren(...ARTEN.map(([k, t]) => h("button.chip", { type: "button", class: art === k ? "on" : "", "aria-pressed": String(art === k), onclick: () => { art = k; draw(); } }, t)));
  };
  draw();
  const m = modal(`${f.name} · ${book.aktiv}`, h("div.stack", { style: { gap: "12px" } },
    h("div.m-row-s", ober ? "Punkte (0–15)" : "Note"), grid, h("div.m-row-s", "Art"), artRow, datum, notiz), { foot: [
    n ? h("button.btn.ghost", { onclick: async () => { book.noten = book.noten.filter((x) => x.id !== n.id); persist(); m.close(); rerender(); toast("Note gelöscht"); } }, "Löschen") : null,
    h("button.btn.primary", { onclick: () => {
      if (wert === null) return toast("Bitte eine Note wählen", "err");
      const row = { id: n?.id || uid(), fach: f.id, hj: book.aktiv, wert, art, datum: datum.value || null, notiz: notiz.value.trim() || null };
      book.noten = n ? book.noten.map((x) => (x.id === n.id ? row : x)) : [...book.noten, row];
      persist(); m.close(); rerender(); toast("Gespeichert");
    } }, "Speichern")] });
}

// Fach: Gewichtung, Zeugnisnote, „Was brauche ich?“, LK/Prüfungsfach
function fachSheet(f, rerender) {
  const ober = book.stufe !== "sek1";
  const hj = book.aktiv;
  const r = fachSchnitt(book, f.id, hj);
  const anteil = h("input.input.sm", { type: "number", min: 0, max: 100, step: 5, value: f.klausurAnteil ?? 50, "aria-label": "Anteil Klausuren in Prozent" });
  const zeug = h("input.input.sm", { type: "number", min: ober ? 0 : 1, max: ober ? 15 : 6, step: ober ? 1 : 0.1, value: book.zeugnis?.[`${f.id}|${hj}`] ?? "", placeholder: "leer = berechnet", "aria-label": "Zeugnisnote" });
  const ziel = h("input.input.sm", { type: "number", min: ober ? 0 : 1, max: ober ? 15 : 6, step: ober ? 1 : 0.1, value: ober ? 10 : 2, "aria-label": "Zielschnitt" });
  const out = h("div.g-need");
  const calc = () => {
    const z = Number(ziel.value);
    const nk = brauche(book, f.id, hj, z, "klausur");
    const lim = ober ? [0, 15] : [1, 6];
    const txt = (v) => (ober ? v > 15.0001 ? "nicht mehr erreichbar" : v <= 0 ? "schon sicher" : `mindestens ${Math.ceil(v - 1e-9)} P.` : v < 0.99 ? "nicht mehr erreichbar" : v >= 6 ? "schon sicher" : `höchstens ${fmt(Math.floor(v * 10) / 10)}`);
    out.replaceChildren(h("div", "Nächste Klausur: ", h("b", txt(nk))), h("div", "Nächste mündliche Note: ", h("b", txt(brauche(book, f.id, hj, z, "muendlich")))));
    void lim;
  };
  ziel.addEventListener("input", calc); calc();
  const lk = h("input", { type: "checkbox", checked: !!f.lk });
  const pr = h("select.input.sm", { "aria-label": "Prüfungsfach" }, h("option", { value: "" }, "kein Prüfungsfach"), [1, 2, 3, 4, 5].map((i) => h("option", { value: i, selected: f.pruefung === i }, `P${i}`)));
  const m = modal(`${f.name}`, h("div.stack", { style: { gap: "12px" } },
    h("div.g-tiles", h("div.g-tile", h("div.g-tile-l", `Schnitt ${hj}`), h("div.g-tile-v", r.wert === null ? "–" : ober ? `${fmt(r.wert)} P.` : fmt(r.wert, 2)),
      h("div.g-tile-s", r.k !== undefined && r.k !== null ? `Klausuren ${fmt(r.k)} · Sonstige ${fmt(r.s)}` : r.zeugnis ? "Zeugnisnote" : ""))),
    h("label.g-field", h("span", "Anteil Klausuren (%)"), anteil),
    h("label.g-field", h("span", `Zeugnisnote ${hj} (überschreibt die Rechnung)`), zeug),
    h("div.m-card-h", h("span", "Was brauche ich?")),
    h("label.g-field", h("span", ober ? "Ziel im Fach (Punkte)" : "Ziel im Fach (Note)"), ziel), out,
    ober ? h("label.check", lk, " Leistungskurs / erhöhtes Niveau") : h("label.check", lk, " Hauptfach"),
    ober ? h("label.g-field", h("span", "Abiturprüfung"), pr) : null), { foot: [
    h("button.btn.ghost", { onclick: async () => {
      if (!(await confirmDialog(`${f.name} entfernen?`, "Alle Noten dieses Fachs werden gelöscht.", { ok: "Entfernen" }))) return;
      book.faecher = book.faecher.filter((x) => x.id !== f.id); book.noten = book.noten.filter((x) => x.fach !== f.id); persist(); m.close(); rerender(); } }, "Fach entfernen"),
    h("button.btn.primary", { onclick: () => {
      f.klausurAnteil = Math.max(0, Math.min(100, Number(anteil.value) || 0)); f.lk = lk.checked; f.pruefung = pr && pr.value ? Number(pr.value) : null;
      if (f.pruefung) book.faecher.forEach((x) => { if (x !== f && x.pruefung === f.pruefung) x.pruefung = null; });
      book.zeugnis ||= {}; const k = `${f.id}|${hj}`;
      if (zeug.value === "") delete book.zeugnis[k]; else book.zeugnis[k] = Number(zeug.value);
      persist(); m.close(); rerender(); toast("Gespeichert");
    } }, "Speichern")] });
}

// Ersteinrichtung und Einstellungen teilen sich das Formular
function setupForm(cur, onDone, first) {
  let land = cur.land, stufe = cur.stufe, hj = [...cur.halbjahre], lkD = !!cur.lkDoppelt, einbr = cur.einbringen || 0;
  const chosen = new Map(cur.faecher.map((f) => [f.name, f]));
  const box = h("div.stack", { style: { gap: "14px" } });
  const custom = h("input.input", { placeholder: "Eigenes Fach hinzufügen …", maxlength: 40, onkeydown: (e) => { if (e.key === "Enter") { e.preventDefault(); addCustom(); } } });
  const addCustom = () => { const n = custom.value.trim(); if (n && !chosen.has(n)) chosen.set(n, { id: uid(), name: n, klausurAnteil: 50 }); custom.value = ""; draw(); };
  const draw = () => box.replaceChildren(
    h("label.g-field", h("span", "Bundesland"), h("select.input", { onchange: (e) => { land = e.target.value; const d = LAND_DEF[land] || {}; if (first && d.hj && stufe !== "sek1") hj = [...d.hj]; lkD = !!d.lkDoppelt; draw(); } },
      LAENDER.map(([k, t]) => h("option", { value: k, selected: land === k }, t)))),
    h("div", h("div.m-row-s", "Stufe"), h("div.g-arten",
      h("button.chip", { type: "button", class: stufe !== "sek1" ? "on" : "", onclick: () => { stufe = "oberstufe"; if (hj[0]?.startsWith("Klasse")) hj = [...(LAND_DEF[land]?.hj || ["Q1", "Q2", "Q3", "Q4"])]; draw(); } }, "Oberstufe (Punkte 0–15)"),
      h("button.chip", { type: "button", class: stufe === "sek1" ? "on" : "", onclick: () => { stufe = "sek1"; hj = ["Klasse 10 · 1. HJ", "Klasse 10 · 2. HJ"]; draw(); } }, "Sek I (Noten 1–6)"))),
    h("div", h("div.m-row-s", "Halbjahre"), stufe === "sek1" ? null : h("div.g-arten", HJ_PRESETS.map(([t, list]) => h("button.chip", { type: "button", class: JSON.stringify(list) === JSON.stringify(hj) ? "on" : "", onclick: () => { hj = [...list]; draw(); } }, t))),
      h("input.input.m-mt", { value: hj.join(", "), "aria-label": "Halbjahre, mit Komma getrennt", onchange: (e) => { hj = e.target.value.split(",").map((x) => x.trim()).filter(Boolean).slice(0, 12); draw(); } }),
      h("div.m-row-s", "Mit Komma trennen, z. B. „Klasse 9 · 1. HJ, Klasse 9 · 2. HJ“.")),
    h("div", h("div.m-row-s", `Fächer (${chosen.size})`), h("div.g-arten", [...new Set([...FAECHER, ...chosen.keys()])].map((n) => h("button.chip", { type: "button", class: chosen.has(n) ? "on" : "", "aria-pressed": String(chosen.has(n)),
      onclick: () => { if (chosen.has(n)) chosen.delete(n); else chosen.set(n, { id: uid(), name: n, klausurAnteil: 50 }); draw(); } }, n))), h("div.m-mt", custom)),
    stufe !== "sek1" ? h("label.check", h("input", { type: "checkbox", checked: lkD, onchange: (e) => { lkD = e.target.checked; } }), " Leistungskurse in Block I doppelt werten (z. B. NRW)") : null,
    stufe !== "sek1" ? h("label.g-field", h("span", "Kurse einbringen (0 = alle bewerteten)"), h("input.input.sm", { type: "number", min: 0, max: 60, value: einbr, onchange: (e) => { einbr = Math.max(0, Math.min(60, Number(e.target.value) || 0)); } })) : null);
  draw();
  return { box, collect: () => ({ land, stufe, halbjahre: hj.length ? hj : ["1. HJ"], lkDoppelt: lkD, einbringen: einbr, faecher: [...chosen.values()] }) };
}

function setupView(rerender) {
  const f = setupForm(book, null, true);
  return h("div.m-pad.g",
    h("div.m-head", h("h1", "Notenrechner")),
    h("p.m-row-s", "Wähle Bundesland, Stufe und deine Fächer. Danach trägst du je Halbjahr deine Noten ein – Schnitt, Defizite und Abitur-Hochrechnung rechnet die App. Nur du siehst deine Noten."),
    h("section.m-card", f.box),
    h("button.btn.primary.m-wide.m-mt", { onclick: () => {
      const v = f.collect();
      if (!v.faecher.length) return toast("Bitte mindestens ein Fach wählen", "err");
      Object.assign(book, v, { aktiv: v.halbjahre[0] }); persist(true); rerender(); toast("Los geht's – tippe bei einem Fach auf „+ Note“");
    } }, "Speichern und loslegen"));
}

function settingsSheet(rerender) {
  const f = setupForm(book, null, false);
  const m = modal("Notenrechner einstellen", f.box, { foot: [
    h("button.btn.ghost", { onclick: async () => { if (!(await confirmDialog("Alles zurücksetzen?", "Alle Fächer und Noten werden gelöscht.", { ok: "Zurücksetzen" }))) return; book = blank(); persist(true); m.close(); rerender(); } }, "Zurücksetzen"),
    h("button.btn.primary", { onclick: async () => {
      const v = f.collect();
      const ids = new Set(v.faecher.map((x) => x.id));
      const old = book.halbjahre;
      // Halbjahre nur umbenannt (gleiche Anzahl) → Noten wandern mit; sonst gehen Noten weggefallener Halbjahre verloren (mit Rückfrage)
      const ren = old.length === v.halbjahre.length ? Object.fromEntries(old.map((x, i) => [x, v.halbjahre[i]])) : null;
      const moved = book.noten.map((n) => (ren && ren[n.hj] ? { ...n, hj: ren[n.hj] } : n));
      const lost = moved.filter((n) => !ids.has(n.fach) || !v.halbjahre.includes(n.hj));
      if (lost.length && !(await confirmDialog(`${lost.length} Noten löschen?`, "Sie gehören zu Fächern oder Halbjahren, die du entfernt hast.", { ok: "Löschen" }))) return;
      book.noten = moved.filter((n) => ids.has(n.fach) && v.halbjahre.includes(n.hj));
      if (ren) { const z = {}; for (const [k, val] of Object.entries(book.zeugnis || {})) { const [fid, h0] = k.split("|"); z[`${fid}|${ren[h0] ?? h0}`] = val; } book.zeugnis = z; }
      Object.assign(book, v); if (!book.halbjahre.includes(book.aktiv)) book.aktiv = book.halbjahre[0];
      persist(); m.close(); rerender(); toast("Gespeichert");
    } }, "Speichern")] });
}
