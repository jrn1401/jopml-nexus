// Notenrechner (Handy-App): Bundesland, Stufe, Fächer, Noten je Halbjahr → Schnitt je Fach und Halbjahr,
// Oberstufe zusätzlich Defizite und Abitur-Hochrechnung nach der KMK-Formel (Block I = P : S · 40, Block II = Prüfungen · 4,
// Note = 17/3 − Punkte/180, auf eine Nachkommastelle abgeschnitten). Gespeichert im eigenen Konto (nx_gradebook, nur für dich).
import { sb, q, rpc } from "./api.js";
import { h, toast, toastErr, modal, confirmDialog } from "./ui.js";

export const LAENDER = [["BW", "Baden-Württemberg"], ["BY", "Bayern"], ["BE", "Berlin"], ["BB", "Brandenburg"], ["HB", "Bremen"], ["HH", "Hamburg"], ["HE", "Hessen"],
  ["MV", "Mecklenburg-Vorpommern"], ["NI", "Niedersachsen"], ["NW", "Nordrhein-Westfalen"], ["RP", "Rheinland-Pfalz"], ["SL", "Saarland"], ["SN", "Sachsen"],
  ["ST", "Sachsen-Anhalt"], ["SH", "Schleswig-Holstein"], ["TH", "Thüringen"]];
// Vorschläge je Land (änderbar): Benennung der Halbjahre, Leistungskurse doppelt (z. B. NRW: „LK doppelt, GK einfach“)
const LAND_DEF = { BB: { hj: ["11/1", "11/2", "12/1", "12/2"], lkDoppelt: true }, BY: { hj: ["12/1", "12/2", "13/1", "13/2"] }, NW: { lkDoppelt: true }, BW: { hj: ["J1/1", "J1/2", "J2/1", "J2/2"] } };
const HJ_PRESETS = [["Q1–Q4", ["Q1", "Q2", "Q3", "Q4"]], ["11/1–12/2", ["11/1", "11/2", "12/1", "12/2"]], ["12/1–13/2", ["12/1", "12/2", "13/1", "13/2"]], ["J1/J2", ["J1/1", "J1/2", "J2/1", "J2/2"]]];
const FAECHER = ["Deutsch", "Mathematik", "Englisch", "Französisch", "Spanisch", "Latein", "Russisch", "Biologie", "Chemie", "Physik", "Informatik", "Geschichte", "Politische Bildung",
  "Geografie", "Wirtschaft", "Psychologie", "Philosophie", "Religion", "Ethik", "LER", "Kunst", "Musik", "Darstellendes Spiel", "Sport", "Sporttheorie", "Seminarkurs", "Recht"];
// [Schlüssel, Name, Kürzel]; ALN und MLF gibt es nur in Brandenburg (GOSTV)
export const ARTEN = [["klausur", "Klausur", "K"], ["aln", "Anderer Leistungsnachweis", "A"], ["mlf", "MLF (mündl. Leistungsfeststellung)", "MLF"], ["test", "Test", "T"], ["muendlich", "Mündlich", "Mü"], ["sonst", "Sonstiges", "S"]];
const artName = (k) => ARTEN.find((a) => a[0] === k)?.[1] || "";
// ---------- Brandenburg (GOSTV, Infoabend Jg. 11 vom 02.09.2026) ----------
export const isBB = (b) => b.land === "BB" && b.stufe !== "sek1";
const FS = ["Englisch", "Französisch", "Spanisch", "Latein", "Russisch"], NW = ["Biologie", "Chemie", "Physik"], KMD = ["Kunst", "Musik", "Darstellendes Spiel"];
const FELD = { I: ["Deutsch", ...FS, ...KMD], II: ["Geografie", "Erdkunde", "Geschichte", "Politische Bildung", "Psychologie", "Recht"], III: ["Mathematik", ...NW, "Informatik", "Technik"] };
const KEINE_KLAUSUR = ["Seminarkurs", "Recht"];          // SK und online Recht: laut GOSTV/Schule keine Klausur; alle anderen Kurse sind wählbar
const NICHT_MUENDLICH = ["Seminarkurs", "Darstellendes Spiel", "Recht", "Sport"];
const feldVon = (name) => Object.keys(FELD).find((k) => FELD[k].includes(name)) || null;
const istFS = (f) => FS.includes(f.name);
// Schreibt das Fach in diesem Halbjahr eine Klausur? LK immer; Jg. 11 nach deiner Klausurwahl (Deutsch/Mathe Pflicht); Jg. 12 im 3. und 4. Prüfungsfach.
export function hatKlausur(book, f, hj) {
  if (!isBB(book)) return true;
  if (KEINE_KLAUSUR.includes(f.name)) return false;
  if (f.kl && typeof f.kl[hj] === "boolean") return f.kl[hj];
  if (f.lk) return true;
  if (String(hj).startsWith("11")) return !!f.klausur11 || f.name === "Mathematik";   // Mathe fest, Rest frei wählbar
  return f.pruefung === 3 || f.pruefung === 4;
}
// So zählt's – Text je Fach und Halbjahr
export function gewichtText(book, f, hj) {
  if (!isBB(book)) return `Klausuren ${f.klausurAnteil ?? 50} % · Sonstiges ${100 - (f.klausurAnteil ?? 50)} %`;
  const k = hatKlausur(book, f, hj), m = istFS(f) && String(hj).startsWith("12/1");
  const teile = [k ? "Klausur ⅓" : null, m ? "MLF ⅓" : null].filter(Boolean);
  const rest = 3 - teile.length;
  return `${teile.length ? `${teile.join(" · ")} · ` : ""}Sonstige ${rest === 3 ? "100 %" : rest === 2 ? "⅔" : "⅓"}${f.lk ? " · im Abi ×2" : ""}`;
}
// Meine Kurse (Vicco-von-Bülow-Gymnasium Stahnsdorf, Abi 2028)
const MEIN_PLAN = { lk: ["Geografie", "Englisch"], gk: ["Mathematik", "Deutsch", "Biologie", "Psychologie", "Geschichte", "Kunst", "Sport", "Seminarkurs"] };
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
  if (isBB(book)) {   // Klausur, ALN und MLF zählen je ein Drittel, den Rest bestimmt die Sonstige Leistung
    const k = avg(ns.filter((n) => n.art === "klausur")), a = avg(ns.filter((n) => n.art === "aln")), m = avg(ns.filter((n) => n.art === "mlf"));
    const s = avg(ns.filter((n) => !["klausur", "aln", "mlf"].includes(n.art)));
    const parts = [k, a, m].filter((x) => x !== null);
    const wert = s === null ? parts.reduce((x, y) => x + y, 0) / parts.length : parts.reduce((x, y) => x + y / 3, 0) + s * (1 - parts.length / 3);
    return { wert, k, a, m, s, w: parts.length / 3, n: ns.length };
  }
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
  if (isBB(book)) return abiturBB(book);
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
// Welche Note brauche ich als Nächstes (Art wählbar), damit das Fach den Zielschnitt erreicht? Probiert alle Werte durch.
// Warnungen: Unterkurse, Defizit-Grenzen, 0 Punkte, Mindestpunkte, Wiederholung, Versetzung (Sek I)
export function warnungen(book) {
  const out = [], ober = book.stufe !== "sek1";
  const hjs = book.halbjahre;
  if (!ober) {
    for (const hj of hjs) {
      const sch = book.faecher.map((f) => [f, fachSchnitt(book, f.id, hj).wert]).filter(([, v]) => v !== null);
      const f5 = sch.filter(([, v]) => v >= 4.5 && v < 5.5), f6 = sch.filter(([, v]) => v >= 5.5), knapp = sch.filter(([, v]) => v >= 4.0 && v < 4.5);
      if (f6.length || f5.length >= 2) out.push({ lvl: "bad", t: `${hj}: Versetzung gefährdet – ${[...f6, ...f5].map(([f, v]) => `${f.name} ${fmt(v, 1)}`).join(", ")}. Ausgleich oder Nachprüfung mit der Schule klären.` });
      else if (f5.length) out.push({ lvl: "warn", t: `${hj}: Eine 5 in ${f5[0][0].name} (${fmt(f5[0][1], 1)}) – eine weitere 5 gefährdet die Versetzung.` });
      knapp.forEach(([f, v]) => out.push({ lvl: "warn", t: `${hj}: ${f.name} steht auf ${fmt(v, 1)} – knapp vor der 5.` }));
    }
    return out;
  }
  // Unterkurse (< 5 P.) und knappe Kurse je Halbjahr
  for (const hj of hjs) for (const f of book.faecher) {
    const v = fachSchnitt(book, f.id, hj).wert; if (v === null) continue;
    const p = Math.round(v);
    if (p === 0) out.push({ lvl: "bad", t: `${f.name} ${hj}: 0 Punkte – ein eingebrachter Kurs mit 0 Punkten verhindert das Abitur.` });
    else if (p < 5) out.push({ lvl: "bad", t: `${f.name} ${hj}: Unterkurs (${p} P.)${f.lk ? " im Leistungskurs – zählt auf jeden Fall" : ""}.` });
    else if (p === 5) out.push({ lvl: "warn", t: `${f.name} ${hj}: nur 5 P. – ein Punkt weniger ist ein Unterkurs.` });
  }
  const abi = abitur(book);
  if (!abi?.kurse) return out;
  if (abi.bb) {
    const lkAll = [], gkAll = [];
    for (const f of book.faecher) for (const hj of hjs) { const v = fachSchnitt(book, f.id, hj).wert; if (v !== null && Math.round(v) < 5) (f.lk ? lkAll : gkAll).push(f); }
    if (abi.lkDef > 3) out.push({ lvl: "bad", t: `Zu viele LK-Unterkurse (${abi.lkDef}, erlaubt 3) – Abi-Zulassung gefährdet.` });
    else if (abi.lkDef === 3) out.push({ lvl: "warn", t: "3 LK-Unterkurse – kein weiterer Leistungskurs unter 5 P. erlaubt." });
    if (abi.gkDef > 4) out.push({ lvl: "bad", t: `Zu viele GK-Unterkurse in den eingebrachten Kursen (${abi.gkDef}, erlaubt 4) – Abi-Zulassung gefährdet.` });
    else if (abi.gkDef >= 3) out.push({ lvl: "warn", t: `${abi.gkDef} GK-Unterkurse eingebracht – höchstens 4 erlaubt.` });
    if (abi.b1 < 200) out.push({ lvl: "bad", t: `Block I hochgerechnet nur ${abi.b1} von mindestens 200 Punkten.` });
    if (!abi.okII) out.push({ lvl: "warn", t: "Prüfungen hochgerechnet unter den Mindestwerten (100 Punkte, 3 Prüfungen ≥ 5 P.)." });
    const elf = hjs.filter((x) => String(x).startsWith("11"));
    const nur11 = abi.lkDef > 3 || abi.gkDef > 4 || abi.nullen;
    if (nur11 && elf.length && elf.every((x) => book.faecher.some((f) => fachSchnitt(book, f.id, x).wert !== null)))
      out.push({ lvl: "bad", t: "Wiederholung droht: Sind die Zulassungsbedingungen am Ende von 11/2 nicht mehr erfüllbar (Defizite, 0 P.), musst du Jg. 11 wiederholen. Sprich mit der Oberstufenkoordination." });
    if (lkAll.length + gkAll.length > abi.lkDef + abi.gkDef) out.push({ lvl: "info", t: `${lkAll.length + gkAll.length - abi.lkDef - abi.gkDef} Unterkurs(e) werden bisher nicht eingebracht – Pflichtkurse lassen sich aber nicht streichen.` });
  } else if (abi.defizite > 7 || abi.nullen) out.push({ lvl: "warn", t: `${abi.defizite} Unterkurse${abi.nullen ? `, ${abi.nullen}× 0 P.` : ""} – Zulassung mit der Schule prüfen.` });
  return out;
}
// Was wäre, wenn …? Rechnet gedachte Noten (Liste {art, wert}) ein und liefert Fach-, Halbjahres- und Abi-Wert
export function szenario(book, fachId, hj, extra) {
  const b = { ...book, zeugnis: Object.fromEntries(Object.entries(book.zeugnis || {}).filter(([k]) => k !== `${fachId}|${hj}`)),
    noten: [...book.noten, ...extra.map((e, i) => ({ id: `_was${i}`, fach: fachId, hj, wert: Number(e.wert), art: e.art }))] };
  return { fach: fachSchnitt(b, fachId, hj).wert, hj: hjSchnitt(b, hj), abi: abitur(b) };
}
// Kleinster Wert x (Oberstufe) bzw. schlechteste Note (Sek I), den jede gesuchte Note (arten[]) mindestens braucht, damit das Ziel erreicht wird.
// ziel.typ = fach | hj | abi; ganze Punkte beim Fach = Kursnote (gerundet), Kommazahl = exakter Schnitt
export function brauchtFuer(book, fachId, hj, annahmen, arten, ziel) {
  const ober = book.stufe !== "sek1";
  const werte = ober ? Array.from({ length: 16 }, (_, i) => i) : SEK1.map((x) => x[1]).sort((a, b) => b - a);
  const ganz = Number.isInteger(ziel.v);
  const ok = (x) => { const r = szenario(book, fachId, hj, [...annahmen, ...arten.map((art) => ({ art, wert: x }))]);
    if (ziel.typ === "fach") return r.fach !== null && (ober ? (ganz ? Math.round(r.fach) >= ziel.v : r.fach >= ziel.v - 1e-9) : r.fach <= ziel.v + 1e-9);
    if (ziel.typ === "hj") return r.hj !== null && (ober ? r.hj >= ziel.v - 1e-9 : r.hj <= ziel.v + 1e-9);
    return r.abi?.note !== undefined && r.abi.note <= ziel.v + 1e-9; };
  for (const x of werte) if (ok(x)) return { x, sicher: x === werte[0] };
  return { x: null };
}
export function brauche(book, fachId, hj, ziel, art = "klausur") {
  const ober = book.stufe !== "sek1";
  const test = (x) => fachSchnitt({ ...book, zeugnis: {}, noten: [...book.noten, { id: "_", fach: fachId, hj, wert: x, art }] }, fachId, hj).wert;
  if (ober) { for (let x = 0; x <= 15; x++) if (Math.round(test(x)) >= ziel) return x; return 16; }
  const ok = SEK1.map((v) => v[1]).filter((x) => test(x) <= ziel + 1e-9);
  return ok.length ? Math.max(...ok) : 0;
}

// Brandenburg: alle 8 LK-Kurse doppelt + 28 GK-Kurse (Pflicht: Prüfungsfach 3/4 komplett, je 4× Deutsch, Mathe, Fremdsprache, Naturwissenschaft, 2× Kunst/Musik/DS),
// Block I = Punkte × 40 : 44; Block II = 4 Prüfungen × 5 (mit Besonderer Lernleistung 5 × 4). Mindestens: LK ≤ 3 und GK ≤ 4 Kurse unter 5 P., keine 0, Block I ≥ 200, Block II ≥ 100 und 3 Prüfungen ≥ 5.
function abiturBB(book) {
  const kurse = [];
  for (const f of book.faecher) for (const hj of book.halbjahre) { const r = fachSchnitt(book, f.id, hj); if (r.wert !== null) kurse.push({ f, hj, p: Math.round(r.wert), g: f.lk ? 2 : 1 }); }
  const hinweise = pruefHinweise(book);
  if (!kurse.length) return { kurse: 0, hinweise };
  const lk = kurse.filter((k) => k.f.lk).slice(0, 8), gkAll = kurse.filter((k) => !k.f.lk);
  const pick = new Set(), lkNamen = book.faecher.filter((f) => f.lk).map((f) => f.name);
  const best = (list) => [...list].sort((a, b) => b.p - a.p);
  const takeFach = (f, n = 4) => best(gkAll.filter((k) => k.f.id === f.id)).slice(0, n).forEach((k) => pick.add(k));
  const gkF = (names) => book.faecher.filter((f) => !f.lk && names.includes(f.name));
  const sumF = (f) => gkAll.filter((k) => k.f.id === f.id).reduce((s, k) => s + k.p, 0);
  book.faecher.filter((f) => !f.lk && (f.pruefung === 3 || f.pruefung === 4)).forEach((f) => takeFach(f));
  for (const n of ["Deutsch", "Mathematik"]) if (!lkNamen.includes(n)) gkF([n]).forEach((f) => takeFach(f));
  if (!lkNamen.some((n) => FS.includes(n))) { const f = gkF(FS).sort((a, b) => sumF(b) - sumF(a))[0]; if (f) takeFach(f); }
  if (!lkNamen.some((n) => NW.includes(n))) { const f = gkF(NW).sort((a, b) => sumF(b) - sumF(a))[0]; if (f) takeFach(f); }
  if (!lkNamen.some((n) => KMD.includes(n))) best(gkAll.filter((k) => KMD.includes(k.f.name))).slice(0, 2).forEach((k) => pick.add(k));
  const pflicht = pick.size;
  for (const k of best(gkAll)) { if (pick.size >= 28) break; pick.add(k); }
  const gk = [...pick].slice(0, 28), use = [...lk, ...gk];
  const P = use.reduce((s, k) => s + k.p * k.g, 0), S = use.reduce((s, k) => s + k.g, 0);
  const b1 = Math.min(600, Math.round((P * 40) / S));   // vollständig: P × 40 : 44
  const lkDef = lk.filter((k) => k.p < 5).length, gkDef = gk.filter((k) => k.p < 5).length, nullen = use.filter((k) => k.p === 0).length;
  const avgAll = P / S, nP = book.bll ? 5 : 4, fak = book.bll ? 4 : 5;
  const pruef = [];
  for (let i = 1; i <= nP; i++) {
    if (i === 5) { const v = book.pruefungen?.bll; pruef.push({ f: { id: "bll", name: "Besondere Lernleistung" }, p: v !== undefined && v !== "" ? Number(v) : avgAll, echt: v !== undefined && v !== "" }); continue; }
    const f = book.faecher.find((x) => x.pruefung === i) || (i <= 2 ? book.faecher.filter((x) => x.lk && !x.pruefung)[i - 1 - book.faecher.filter((x) => x.lk && x.pruefung && x.pruefung < i).length] : undefined);
    const real = f ? book.pruefungen?.[f.id] : undefined;
    if (real !== undefined && real !== null && real !== "") { pruef.push({ f, p: Number(real), echt: true }); continue; }
    const fk = f ? kurse.filter((k) => k.f.id === f.id) : [];
    pruef.push({ f, p: fk.length ? fk.reduce((s, k) => s + k.p, 0) / fk.length : avgAll, echt: false });
  }
  const b2 = Math.round(pruef.reduce((s, x) => s + Math.round(x.p) * fak, 0));
  const ges = b1 + b2;
  const note = ges >= 823 ? 1.0 : Math.min(4.0, Math.floor((17 / 3 - ges / 180) * 10 + 1e-9) / 10);
  const okI = lkDef <= 3 && gkDef <= 4 && nullen === 0 && b1 >= 200;
  const okII = b2 >= 100 && pruef.filter((x) => Math.round(x.p) >= 5).length >= 3 && !pruef.some((x) => Math.round(x.p) === 0);
  return { bb: true, kurse: kurse.length, eingebracht: use.length, geplant: 36, lkN: lk.length, gkN: gk.length, pflicht, lkDef, gkDef, defizite: lkDef + gkDef, nullen,
    b1, b2, ges, note, bestanden: okI && okII, okI, okII, pruef, fak, schnitt: avgAll, hinweise };
}
// Prüft die Wahl der Abiturprüfungsfächer und schlägt passende P3/P4-Kombinationen vor
function pruefHinweise(book) {
  const out = [], lks = book.faecher.filter((f) => f.lk);
  if (lks.length !== 2) out.push(`Markiere genau 2 Leistungskurse (gerade ${lks.length}).`);
  const p = (i) => book.faecher.find((f) => f.pruefung === i);
  const gewaehlt = [1, 2, 3, 4].map(p);
  gewaehlt.slice(0, 2).forEach((f, i) => { if (f && !f.lk) out.push(`P${i + 1} muss ein Leistungskurs sein (${f.name} ist GK).`); });
  if (gewaehlt[2]?.lk) out.push("P3 (schriftlich) muss ein Grundkurs sein.");
  if (gewaehlt[3] && (gewaehlt[3].lk || NICHT_MUENDLICH.includes(gewaehlt[3].name))) out.push(`${gewaehlt[3].name} geht nicht als mündliches Prüfungsfach (P4).`);
  const pruefe = (list) => { const n = list.map((f) => f.name); return ["I", "II", "III"].every((k) => n.some((x) => feldVon(x) === k)) && n.filter((x) => x === "Deutsch" || x === "Mathematik" || FS.includes(x)).length >= 2; };
  if (gewaehlt.every(Boolean)) { if (!pruefe(gewaehlt)) out.push("Die 4 Prüfungsfächer müssen alle 3 Aufgabenfelder abdecken und 2 von Deutsch, Mathematik, Fremdsprache enthalten."); return out; }
  if (lks.length === 2) {
    const gks = book.faecher.filter((f) => !f.lk && !NICHT_MUENDLICH.includes(f.name));
    const paare = [];
    for (const a of gks) for (const b of gks) if (a !== b && pruefe([...lks, a, b]) && (!gewaehlt[2] || gewaehlt[2] === a) && (!gewaehlt[3] || gewaehlt[3] === b)) paare.push(`${a.name} (P3) + ${b.name} (P4)`);
    out.push(paare.length ? `Mögliche Wahl ab Jg. 12: ${paare.slice(0, 6).join(" · ")}${paare.length > 6 ? ` … (${paare.length} Möglichkeiten)` : ""}` : "Mit diesen Kursen ist keine gültige P3/P4-Kombination möglich.");
  }
  return out;
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
const saveEl = h("span.g-save", "✓ gespeichert");
function persist(immediate = false) {
  saveEl.textContent = "speichert …";
  try { localStorage.setItem(LS, JSON.stringify(book)); } catch { /* privat */ }
  clearTimeout(saveT);
  const run = async () => { try { await q(sb.from("nx_gradebook").upsert({ owner_id: owner, data: book, updated_at: new Date().toISOString() }, { onConflict: "owner_id" })); saveEl.textContent = "✓ gespeichert"; } catch (e) { saveEl.textContent = "nur auf dem Handy gespeichert"; toastErr(e); } };
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
      ober ? h("div.g-w", gewichtText(book, f, hj)) : null,
      h("div.g-pills", ...ns.map((n) => h("button.g-pill", { type: "button", class: n.art, title: `${artName(n.art)}${n.datum ? ` · ${new Date(n.datum).toLocaleDateString("de-DE")}` : ""}${n.notiz ? ` · ${n.notiz}` : ""}`, onclick: () => noteSheet(f, n, rerender) },
        h("small", ARTEN.find((a) => a[0] === n.art)?.[2] || ""), ober ? String(n.wert) : (SEK1.find((x) => x[1] === Number(n.wert))?.[0] ?? String(n.wert)))),
        h("button.g-add", { type: "button", "aria-label": `Note in ${f.name} eintragen`, onclick: () => noteSheet(f, null, rerender) }, "+ Note")));
  };
  // Verlauf über alle Halbjahre
  const verlauf = book.halbjahre.map((x) => [x, hjSchnitt(book, x)]);
  const max = ober ? 15 : 6;
  const chart = h("div.g-chart", verlauf.map(([x, v]) => h("button.g-col", { type: "button", class: x === hj ? "on" : "", onclick: () => { book.aktiv = x; persist(); rerender(); }, "aria-label": `${x}: ${v === null ? "keine Noten" : fmt(v)}` },
    h("span.g-colv", v === null ? "–" : fmt(v)), h("i", { style: { height: `${v === null ? 4 : Math.max(6, (ober ? v : 7 - v) / (ober ? max : 6) * 100)}%` } }), h("span.g-coll", x))));
  return h("div.m-pad.g",
    h("div.m-head", h("h1", "Noten"), saveEl, h("button.btn.sm", { onclick: () => settingsSheet(rerender) }, "Einstellungen")),
    h("div.g-hj", book.halbjahre.map((x) => h("button.chip", { type: "button", class: x === hj ? "on" : "", "aria-pressed": String(x === hj), onclick: () => { book.aktiv = x; persist(); rerender(); } }, x))),
    h("div.g-tiles",
      tl(`Schnitt ${hj}`, s === null ? "–" : ober ? `${fmt(s)} P.` : fmt(s, 2), s === null ? "noch keine Noten" : ober ? `≈ Note ${fmt(punkteZuNote(s))}` : "Durchschnittsnote"),
      ober && abi?.kurse ? tl("Abi-Hochrechnung", fmt(abi.note), `${abi.ges} / 900 Punkte`, abi.bestanden ? "" : "warn") : tl("Fächer", String(book.faecher.length), LAENDER.find((l) => l[0] === book.land)?.[1]),
      ober && abi?.kurse ? (abi.bb ? tl("Defizite (< 5 P.)", `${abi.lkDef} · ${abi.gkDef}`, abi.nullen ? `${abi.nullen}× 0 Punkte!` : "LK max. 3 · GK max. 4", abi.lkDef > 3 || abi.gkDef > 4 || abi.nullen ? "warn" : "")
        : tl("Defizite (< 5 P.)", String(abi.defizite), abi.nullen ? `${abi.nullen}× 0 Punkte!` : `${abi.kurse} Kurse bewertet`, abi.defizite > 7 || abi.nullen ? "warn" : "")) : null),
    warnCard(),
    wasWaereCard(hj, rerender),
    isBB(book) ? klausurPlan(hj, rerender) : null,
    h("div.g-list", book.faecher.map(card)),
    h("section.m-card", h("div.m-card-h", h("span", "Verlauf")), chart),
    ober && (abi?.kurse || abi?.hinweise?.length) ? abiCard(abi, rerender) : null,
    zeugnisCard(hj, rerender),
    h("section.m-card", h("div.m-card-h", h("span", "Alle Halbjahre")), tableAll()),
    isBB(book) ? regelCard() : null,
    h("p.m-row-s.m-mt", isBB(book) ? "Brandenburg (GOSTV): Klausur, Anderer Leistungsnachweis und MLF zählen je ⅓ der Kursnote, sonst die Sonstige Leistung. Block I = 8 LK-Kurse doppelt + 28 GK-Kurse, Punkte × 40 : 44. Verbindlich entscheidet die Schule."
      : ober ? "Hochrechnung nach der KMK-Formel; Pflichtkurse, Defizit-Grenzen und Einbringung regelt jedes Land etwas anders – die Schule entscheidet verbindlich." : "Schnitt = Klausuren und sonstige Noten nach deinem Anteil je Fach."));
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

function warnCard() {
  const w = warnungen(book);
  const ico = { bad: "⛔", warn: "⚠️", info: "ℹ️" };
  if (!w.length) return book.noten.length ? h("section.m-card.g-ok", h("b", "✓ Keine Warnungen"), h("div.m-row-s", book.stufe === "sek1" ? "Keine 5 oder 6 in Sicht." : "Kein Unterkurs, keine Defizit-Grenze in Gefahr.")) : null;
  const order = { bad: 0, warn: 1, info: 2 };
  return h("section.m-card.g-warn", h("div.m-card-h", h("span", `Warnungen (${w.filter((x) => x.lvl !== "info").length})`)),
    h("ul.g-wl", [...w].sort((a, b) => order[a.lvl] - order[b.lvl]).slice(0, 12).map((x) => h("li", { class: x.lvl }, h("span", ico[x.lvl]), h("span", x.t)))));
}
// Was wäre, wenn …? Mehrere angenommene Noten („Klausur 0, mündlich 8“) und gesuchte Noten („nächster Test und mündlich“) → was brauche ich?
const ww = { fach: null, annahmen: null, gesucht: ["test"], ziel: "fach", zv: null, zt: "" };
const parseNum = (t) => { const v = parseFloat(String(t).replace(",", ".")); return Number.isNaN(v) ? null : v; };
function wasWaereCard(hj, rerender) {
  const ober = book.stufe !== "sek1";
  if (!book.faecher.find((f) => f.id === ww.fach)) { ww.fach = book.faecher[0]?.id; ww.annahmen = null; }
  const f = book.faecher.find((x) => x.id === ww.fach); if (!f) return null;
  const arten = ARTEN.filter(([k]) => (isBB(book) ? (k !== "klausur" || hatKlausur(book, f, hj)) && (k !== "mlf" || (istFS(f) && String(hj).startsWith("12"))) && (k !== "aln" || !String(hj).startsWith("12/2")) : !["aln", "mlf"].includes(k)));
  const erlaubt = (k) => arten.some((a) => a[0] === k);
  if (ww.annahmen === null) ww.annahmen = [{ art: erlaubt("klausur") ? "klausur" : "muendlich", wert: ober ? 10 : 2 }];
  ww.annahmen = ww.annahmen.filter((a) => erlaubt(a.art));
  ww.gesucht = ww.gesucht.filter(erlaubt); if (!ww.gesucht.length) ww.gesucht = [erlaubt("test") ? "test" : arten[0][0]];
  const abiNow = abitur(book);
  if (ww.zv === null || ww._typ !== ww.ziel) { ww._typ = ww.ziel; ww.zv = ww.ziel === "abi" ? (abiNow?.note ? Math.max(1, Math.round((abiNow.note - 0.1) * 10) / 10) : 2.0) : ober ? 10 : 2; ww.zt = fmt(ww.zv, Number.isInteger(ww.zv) ? 0 : 1); }
  const kurz = (k) => (k === "aln" ? "ALN" : k === "mlf" ? "MLF" : artName(k));
  const res = h("div.g-need"), need = h("div.g-need.m-mt");
  const pf = (v, exact) => (v === null || v === undefined ? "–" : ober ? (exact ? `${fmt(v)} P.` : `${Math.round(v)} P.`) : fmt(v, 2));
  const draw = () => {
    const now = { fach: fachSchnitt(book, f.id, hj).wert, hj: hjSchnitt(book, hj) };
    const r = ww.annahmen.length ? szenario(book, f.id, hj, ww.annahmen) : { ...now, abi: abiNow };
    res.replaceChildren(
      h("div", `${f.name} ${hj}: `, h("b", pf(r.fach)), ober && r.fach !== null ? ` (genau ${fmt(r.fach)})` : "", ` · bisher ${pf(now.fach)}`),
      h("div", `Halbjahr ${hj}: `, h("b", pf(r.hj, true)), ` · bisher ${pf(now.hj, true)}`),
      ober && r.abi?.note !== undefined ? h("div", "Abi-Note: ", h("b", fmt(r.abi.note)), ` · bisher ${fmt(abiNow?.note)}`, r.abi.bestanden ? "" : " ⚠️ unter Mindest") : null,
      ober && r.fach !== null && Math.round(r.fach) < 5 ? h("div.g-warnt", "⚠️ Das wäre ein Unterkurs.") : null);
    if (ww.zv === null) { need.replaceChildren(h("div", "Ziel als Zahl eingeben, z. B. 10 oder 9,5.")); return; }
    const z = brauchtFuer(book, f.id, hj, ww.annahmen, ww.gesucht, { typ: ww.ziel, v: ww.zv });
    const was = ww.gesucht.map(kurz).join(" und ");
    const je = ww.gesucht.length > 1 ? " jeweils" : "";
    need.replaceChildren(z.x === null ? h("div", h("b", "Nicht erreichbar"), ` – auch mit 15 Punkten in ${was} reicht es nicht. Nimm mehr gesuchte Noten dazu oder senke das Ziel.`)
      : z.sicher ? h("div", h("b", "Schon sicher"), ` – egal, was in ${was} kommt.`)
      : h("div", `Du brauchst in ${was}${je} `, h("b", ober ? `mindestens ${z.x} P. (Note ${fmt(punkteZuNote(z.x))})` : `mindestens eine ${SEK1.find((x) => x[1] === z.x)?.[0] ?? fmt(z.x)}`), "."));
  };
  const valOpts = ober ? Array.from({ length: 16 }, (_, i) => 15 - i).map((p) => [String(p), p]) : SEK1;
  const rows = ww.annahmen.map((a, i) => h("div.g-annahme",
    h("select.input.sm", { "aria-label": "Art", onchange: (e) => { a.art = e.target.value; draw(); } }, arten.map(([k]) => h("option", { value: k, selected: a.art === k }, kurz(k)))),
    h("select.input.sm", { "aria-label": "Note", onchange: (e) => { a.wert = Number(e.target.value); draw(); } }, valOpts.map(([t, v]) => h("option", { value: v, selected: Number(a.wert) === v }, ober ? `${t} P.` : t))),
    h("button.btn.sm.ghost", { type: "button", "aria-label": "Annahme entfernen", onclick: () => { ww.annahmen.splice(i, 1); rerender(); } }, "✕")));
  const zIn = h("input.input.sm", { type: "text", inputmode: "decimal", value: ww.zt, placeholder: ww.ziel === "abi" ? "z. B. 1,8" : ober ? "z. B. 9,5" : "z. B. 2,3", "aria-label": "Ziel",
    oninput: (e) => { ww.zt = e.target.value; const v = parseNum(e.target.value); ww.zv = v === null ? null : ww.ziel === "abi" ? Math.max(1, Math.min(4, v)) : ober ? Math.max(0, Math.min(15, v)) : Math.max(1, Math.min(6, v)); draw(); } });
  draw();
  return h("section.m-card.g-ww",
    h("div.m-card-h", h("span", "Was wäre, wenn …?")),
    h("label.g-field", h("span", "Fach"), h("select.input.sm", { onchange: (e) => { ww.fach = e.target.value; ww.annahmen = null; rerender(); } }, book.faecher.map((x) => h("option", { value: x.id, selected: x.id === f.id }, x.name)))),
    h("div.m-row-s", "1 · Angenommene Noten (z. B. „Klausur 0 P., mündlich 8 P.“):"),
    rows.length ? h("div.g-annahmen", rows) : h("div.m-row-s", "Keine – es zählen nur deine echten Noten."),
    h("button.btn.sm.m-mt", { type: "button", onclick: () => { ww.annahmen.push({ art: erlaubt("muendlich") ? "muendlich" : arten[0][0], wert: ober ? 10 : 2 }); rerender(); } }, "+ Note annehmen"),
    h("div.m-mt", res),
    h("div.m-row-s.m-mt", "2 · Ziel:"),
    h("div.g-arten", [["fach", "Fachnote"], ["hj", "Halbjahresschnitt"], ...(ober ? [["abi", "Abi-Note"]] : [])].map(([k, t]) => h("button.chip", { type: "button", class: ww.ziel === k ? "on" : "", onclick: () => { ww.ziel = k; rerender(); } }, t))),
    h("label.g-field", h("span", ww.ziel === "abi" ? "Abi-Note" : ober ? (ww.ziel === "hj" ? "Schnitt in Punkten (Komma erlaubt)" : "Punkte im Fach (Komma erlaubt, z. B. 9,5)") : "Note (z. B. 2,3)"), zIn),
    h("div.m-row-s", "3 · Welche Noten kommen noch? (mehrere möglich)"),
    h("div.g-arten", arten.map(([k]) => { const on = ww.gesucht.includes(k); return h("button.chip", { type: "button", class: on ? "on" : "", "aria-pressed": String(on),
      onclick: () => { ww.gesucht = on ? ww.gesucht.filter((x) => x !== k) : [...ww.gesucht, k]; rerender(); } }, kurz(k)); })),
    need);
}
function abiCard(abi, rerender) {
  const bb = !!abi.bb, maxI = 600, maxII = bb ? 300 : 300;
  const set = (key, v) => { book.pruefungen ||= {}; if (v === "") delete book.pruefungen[key]; else book.pruefungen[key] = Math.max(0, Math.min(15, Math.round(+v))); persist(); rerender(); };
  const label = (x, i) => (x.f ? `P${i + 1} ${x.f.name}${bb ? (i < 2 ? " · schriftl. LK" : i === 2 ? " · schriftl." : i === 3 ? " · mündl." : "") : ""}` : `P${i + 1} (kein Fach markiert)`);
  return h("section.m-card.g-abi",
    h("div.m-card-h", h("span", bb ? "Abitur-Hochrechnung · Brandenburg" : "Abitur-Hochrechnung")),
    abi.kurse ? [
      h("div.g-abi-row", h("div", h("small", "Block I (Kurse)"), h("b", `${abi.b1} / ${maxI}`)), h("div", h("small", `Block II (${abi.pruef.length} Prüf. ×${abi.fak || 4})`), h("b", `${abi.b2} / ${maxII}`)), h("div", h("small", "Gesamt"), h("b", `${abi.ges} / 900`))),
      h("div.g-abi-note", "Abiturnote ", h("b", fmt(abi.note)), abi.bestanden ? null : h("span.g-badge.warn", bb ? (abi.okI ? "Block II unter Mindest" : "Block I unter Mindest") : "unter Mindestpunkten")),
      h("div.m-row-s", bb ? `Eingebracht: LK ${abi.lkN}/8 (doppelt) · GK ${abi.gkN}/28, davon ${abi.pflicht} Pflichtkurse · Ø ${fmt(abi.schnitt)} P.` : `${abi.eingebracht} von ${abi.kurse} bewerteten Kursen eingebracht (geplant ${abi.geplant}). Ø ${fmt(abi.schnitt)} P.`),
      bb ? h("div.m-row-s", `Mindestens: Block I ≥ 200 (${abi.b1}), LK < 5 P. höchstens 3× (${abi.lkDef}), GK höchstens 4× (${abi.gkDef}), keine 0 · Block II ≥ 100, 3 Prüfungen ≥ 5 P.`) : null,
      h("div.m-row-s.m-mt", "Prüfungen (leer = geschätzt aus dem Fach-Schnitt):"),
      h("div.g-pruef", abi.pruef.map((x, i) => h("label", h("span", label(x, i)),
        h("input.input.sm", { type: "number", min: 0, max: 15, step: 1, inputmode: "numeric", placeholder: fmt(x.p), value: x.f && x.echt ? String(x.p) : "", disabled: !x.f, "aria-label": `Prüfungsergebnis P${i + 1}`,
          onchange: (e) => set(x.f.id, e.target.value) })))),
      bb ? h("label.check.m-mt", h("input", { type: "checkbox", checked: !!book.bll, onchange: (e) => { book.bll = e.target.checked; persist(); rerender(); } }), " Besondere Lernleistung als 5. Prüfung (dann 5 × 4)") : null] : null,
    abi.hinweise?.length ? h("div.g-need.m-mt", abi.hinweise.map((t) => h("div", t))) : null);
}
// Klausurfächer je Halbjahr: Jg. 11 = beide LK + 5 GK (Pflicht Deutsch, Mathe, Fremdsprache, 1 Naturwiss., 1 Gesellschaftswiss.); Jg. 12 = LK + 3. und 4. Prüfungsfach
function klausurPlan(hj, rerender) {
  const elf = String(hj).startsWith("11");
  const gks = book.faecher.filter((f) => !f.lk && !KEINE_KLAUSUR.includes(f.name));
  const ohne = book.faecher.filter((f) => !f.lk && KEINE_KLAUSUR.includes(f.name));
  const lkN = book.faecher.filter((f) => f.lk).map((f) => f.name);
  const pflicht = elf ? ["Mathematik"].filter((n) => !lkN.includes(n)) : [];
  const gew = gks.filter((f) => hatKlausur(book, f, hj)), names = [...lkN, ...gew.map((f) => f.name)];
  const fehl = [];
  if (elf) {
    if (!names.some((n) => FS.includes(n))) fehl.push("Fremdsprache");
    if (!names.some((n) => NW.includes(n))) fehl.push("Naturwissenschaft");
    if (!names.some((n) => FELD.II.includes(n))) fehl.push("Gesellschaftswissenschaft");
  }
  const soll = elf ? 5 : 2;
  const msg = gew.length !== soll ? `Wähle ${soll} Grundkurse (gerade ${gew.length}).` : fehl.length ? `Es fehlt: ${fehl.join(", ")}.` : `Passt – ${lkN.length + gew.length} Klausuren in ${hj}.`;
  const toggle = (f) => { f.kl ||= {}; const neu = !hatKlausur(book, f, hj); if (elf) { for (const x of book.halbjahre) if (String(x).startsWith("11")) f.kl[x] = neu; } else f.kl[hj] = neu; persist(); rerender(); };
  return h("section.m-card",
    h("div.m-card-h", h("span", `Klausurfächer ${hj}`)),
    h("div.m-row-s", elf ? `In beiden LK (${lkN.join(", ") || "–"}, je 135 Min.) und in 5 weiteren Grundkursen je eine Klausur (90 Min.). Mathe ist fest, die anderen 4 wählst du frei aus allen Grundkursen. Gilt für 11/1 und 11/2.`
      : `LK ${lkN.join(", ") || "–"} + dein 3. und 4. Prüfungsfach (Prüfungsfach im Fach antippen festlegen).${hj.startsWith("12/1") ? " Klausuren in P1–P3 unter Abiturbedingungen." : ""}`),
    h("div.g-arten.m-mt", gks.map((f) => { const on = hatKlausur(book, f, hj), fix = pflicht.includes(f.name);
      return h("button.chip", { type: "button", class: on ? "on" : "", "aria-pressed": String(on), disabled: fix, onclick: () => toggle(f) }, f.name, fix ? " · Pflicht" : f.pruefung ? ` · P${f.pruefung}` : ""); }),
      ...ohne.map((f) => h("button.chip", { type: "button", disabled: true, title: "Keine Klausur möglich" }, `${f.name} · keine Klausur`))),
    h("div.m-row-s.m-mt", { class: gew.length === soll && !fehl.length ? "" : "g-warnt" }, msg),
    h("div.m-row-s", "Ohne Klausur zählt im Fach nur die Sonstige Leistung. Im Seminarkurs gibt es laut GOSTV keine Klausur."));
}
// Zeugnis eines Halbjahrs: berechnete Kursnote, eigene Zeugnisnote eintragen, Halbjahresschnitt
function zeugnisCard(hj, rerender) {
  const ober = book.stufe !== "sek1";
  const rows = book.faecher.map((f) => {
    const r = fachSchnitt(book, f.id, hj), key = `${f.id}|${hj}`;
    const calc = (() => { const ns = book.zeugnis?.[key]; if (ns === undefined) return r.wert; const b = { ...book, zeugnis: {} }; return fachSchnitt(b, f.id, hj).wert; })();
    const inp = h("input.input.sm.g-zin", { type: "number", min: ober ? 0 : 1, max: ober ? 15 : 6, step: ober ? 1 : 0.1, inputmode: "numeric", value: book.zeugnis?.[key] ?? "", placeholder: calc === null ? "–" : ober ? String(Math.round(calc)) : fmt(calc), "aria-label": `Zeugnisnote ${f.name} ${hj}`,
      onchange: (e) => { book.zeugnis ||= {}; const v = e.target.value; if (v === "") delete book.zeugnis[key]; else book.zeugnis[key] = ober ? Math.max(0, Math.min(15, Math.round(+v))) : Math.max(1, Math.min(6, +v)); persist(); rerender(); } });
    const p = r.wert === null ? null : ober ? Math.round(r.wert) : r.wert;
    return h("tr", h("td", f.name, f.lk ? h("small", " LK ×2") : null), h("td", calc === null ? "–" : ober ? String(Math.round(calc)) : fmt(calc, 2)), h("td", inp),
      h("td", { class: p !== null && (ober ? p < 5 : p > 4.49) ? "bad" : "" }, p === null ? "–" : ober ? `${p} P. · ${fmt(punkteZuNote(p))}` : fmt(p, 2)));
  });
  const s = hjSchnitt(book, hj);
  return h("section.m-card",
    h("div.m-card-h", h("span", `Zeugnis ${hj}`)),
    h("div.m-row-s", "„Berechnet“ kommt aus deinen Noten. Trag die echte Zeugnisnote ein, sobald du sie hast – dann zählt die."),
    h("div.g-tbl", h("table", h("thead", h("tr", h("th", "Fach"), h("th", "Berechnet"), h("th", "Zeugnis"), h("th", "Zählt"))), h("tbody", ...rows,
      h("tr.g-sum", h("td", "Halbjahr"), h("td"), h("td"), h("td", h("b", s === null ? "–" : ober ? `${fmt(s)} P. · ${fmt(punkteZuNote(s))}` : fmt(s, 2))))))),
    ober && book.lkDoppelt ? h("div.m-row-s", "Halbjahresschnitt mit Leistungskursen doppelt.") : null);
}
// So zählt's (Brandenburg)
function regelCard() {
  return h("details.m-card.g-regel", h("summary", h("b", "So zählt’s in Brandenburg")),
    h("ul",
      h("li", "Kursnote je Halbjahr: Klausur ⅓, Sonstige Leistung (mündlich, Tests, Hausaufgaben …) ⅔."),
      h("li", "Mit Anderem Leistungsnachweis oder MLF (Englisch, 12/1): Klausur ⅓ · ALN/MLF ⅓ · Sonstige ⅓."),
      h("li", "Ohne Klausur (Seminarkurs oder Grundkurs, den du nicht als Klausurfach gewählt hast): nur Sonstige Leistung."),
      h("li", "Kursnote = ganze Punkte (0–15). Note ≈ (17 − Punkte) : 3."),
      h("li", "Abi Block I: alle 8 LK-Kurse doppelt + 28 GK-Kurse (Pflicht: 4× Deutsch, Mathe, Bio · 2× Kunst · P3/P4 komplett), Punkte × 40 : 44 → max. 600."),
      h("li", "Abi Block II: 4 Prüfungen × 5 → max. 300. Abinote nach Tabelle (823+ = 1,0; 300 = 4,0)."),
      h("li", "Bestehen: Block I ≥ 200, LK höchstens 3× und GK höchstens 4× unter 5 P., keine 0; Block II ≥ 100, 3 Prüfungen ≥ 5 P.")),
    h("div.m-row-s", "Quelle: GOSTV Brandenburg §§ 11, 12, 30; Infoabend Jg. 11 (02.09.2026)."));
}

// Note eintragen / ändern
function noteSheet(f, n, rerender) {
  const ober = book.stufe !== "sek1";
  let wert = n ? Number(n.wert) : null, art = n?.art || (isBB(book) && KEINE_KLAUSUR.includes(f.name) ? "muendlich" : "klausur");
  const grid = h("div.g-grid");
  const artRow = h("div.g-arten");
  const datum = h("input.input", { type: "date", value: n?.datum || new Date().toISOString().slice(0, 10), "aria-label": "Datum" });
  const notiz = h("input.input", { placeholder: "Notiz (optional), z. B. Thema der Klausur", maxlength: 120, value: n?.notiz || "", "aria-label": "Notiz" });
  const draw = () => {
    grid.replaceChildren(...(ober ? Array.from({ length: 16 }, (_, i) => 15 - i).map((p) => [String(p), p]) : SEK1).map(([t, v]) =>
      h("button.g-val", { type: "button", class: `${wert === v ? "on" : ""} ${ober ? (v < 5 ? "bad" : v >= 13 ? "top" : "") : (v > 4.49 ? "bad" : v < 1.5 ? "top" : "")}`, "aria-pressed": String(wert === v), onclick: () => { wert = v; draw(); } }, t)));
    const bb = isBB(book), kk = KEINE_KLAUSUR.includes(f.name);
    const arten = ARTEN.filter(([k]) => (bb ? (k !== "klausur" || (!kk && hatKlausur(book, f, book.aktiv))) && (k !== "aln" || !book.aktiv.startsWith("12/2")) && (k !== "mlf" || (istFS(f) && book.aktiv.startsWith("12"))) : !["aln", "mlf"].includes(k)));
    if (!arten.some((a) => a[0] === art)) art = arten.find((a) => a[0] === "muendlich") ? "muendlich" : arten[0][0];
    artRow.replaceChildren(...arten.map(([k, t]) => h("button.chip", { type: "button", class: art === k ? "on" : "", "aria-pressed": String(art === k), onclick: () => { art = k; draw(); } }, t)));
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
    out.replaceChildren(h("div", "Nächste Klausur: ", h("b", txt(nk))), h("div", isBB(book) ? "Nächste sonstige Note: " : "Nächste mündliche Note: ", h("b", txt(brauche(book, f.id, hj, z, "muendlich")))));
    if (isBB(book) && KEINE_KLAUSUR.includes(f.name)) out.firstChild.remove();
    void lim;
  };
  ziel.addEventListener("input", calc); calc();
  const lk = h("input", { type: "checkbox", checked: !!f.lk });
  const pr = h("select.input.sm", { "aria-label": "Prüfungsfach" }, h("option", { value: "" }, "kein Prüfungsfach"),
    (isBB(book) ? [[1, "P1 schriftlich (LK)"], [2, "P2 schriftlich (LK)"], [3, "P3 schriftlich (GK)"], [4, "P4 mündlich (GK)"]] : [1, 2, 3, 4, 5].map((i) => [i, `P${i}`])).map(([i, t]) => h("option", { value: i, selected: f.pruefung === i }, t)));
  const m = modal(`${f.name}`, h("div.stack", { style: { gap: "12px" } },
    h("div.g-tiles", h("div.g-tile", h("div.g-tile-l", `Schnitt ${hj}`), h("div.g-tile-v", r.wert === null ? "–" : ober ? `${fmt(r.wert)} P.` : fmt(r.wert, 2)),
      h("div.g-tile-s", r.zeugnis ? "Zeugnisnote" : [["Klausur", r.k], ["ALN", r.a], ["MLF", r.m], ["Sonstige", r.s]].filter(([, v]) => v !== undefined && v !== null).map(([t, v]) => `${t} ${fmt(v)}`).join(" · ")))),
    isBB(book) ? h("div.m-row-s", KEINE_KLAUSUR.includes(f.name) ? "Kein Klausurfach – die Sonstige Leistung bestimmt die Kursnote." : `So zählt ${hj}: ${gewichtText(book, f, hj)}. Mit Anderem Leistungsnachweis zusätzlich ⅓.`)
      : h("label.g-field", h("span", "Anteil Klausuren (%)"), anteil),
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
    stufe !== "sek1" && chosen.size ? h("div", h("div.m-row-s", `Leistungskurse (${[...chosen.values()].filter((f) => f.lk).length})`), h("div.g-arten", [...chosen.values()].map((f) => h("button.chip", { type: "button", class: f.lk ? "on" : "", "aria-pressed": String(!!f.lk),
      onclick: () => { f.lk = !f.lk; draw(); } }, f.name)))) : null,
    stufe !== "sek1" && land === "BB" ? h("div.g-need", h("b", "Brandenburg (GOSTV)"), h("div", "Halbjahre 11/1–12/2 · LK doppelt · Block I = 8 LK + 28 GK-Kurse, × 40 : 44 · Block II = 4 Prüfungen × 5 · Klausur, ALN und MLF je ⅓ der Kursnote.")) : null,
    stufe !== "sek1" && land !== "BB" ? h("label.check", h("input", { type: "checkbox", checked: lkD, onchange: (e) => { lkD = e.target.checked; } }), " Leistungskurse in Block I doppelt werten (z. B. NRW)") : null,
    stufe !== "sek1" && land !== "BB" ? h("label.g-field", h("span", "Kurse einbringen (0 = alle bewerteten)"), h("input.input.sm", { type: "number", min: 0, max: 60, value: einbr, onchange: (e) => { einbr = Math.max(0, Math.min(60, Number(e.target.value) || 0)); } })) : null);
  draw();
  const setPlan = (plan) => {   // Kursplan übernehmen (bestehende Fächer behalten ihre Noten)
    land = "BB"; stufe = "oberstufe"; hj = [...LAND_DEF.BB.hj]; lkD = true;
    const keep = new Map(chosen); chosen.clear();
    for (const n of [...plan.lk, ...plan.gk]) chosen.set(n, { ...(keep.get(n) || { id: uid(), name: n, klausurAnteil: 50 }), lk: plan.lk.includes(n), pruefung: plan.lk.includes(n) ? plan.lk.indexOf(n) + 1 : (keep.get(n)?.pruefung > 2 ? keep.get(n).pruefung : null), klausur11: keep.get(n)?.klausur11 });
    draw();
  };
  return { box, setPlan, collect: () => ({ land, stufe, halbjahre: hj.length ? hj : ["1. HJ"], lkDoppelt: land === "BB" && stufe !== "sek1" ? true : lkD, einbringen: einbr, faecher: [...chosen.values()] }) };
}

// Mein Kursplan (nur im eigenen Admin-Konto sichtbar)
let admin = null;
function planBtn(form) {
  const slot = h("div");
  const show = () => { if (admin) slot.replaceChildren(h("button.btn.m-wide", { type: "button", onclick: () => { form.setPlan(MEIN_PLAN); toast("Kursplan übernommen – noch speichern"); } },
    "Meinen Kursplan übernehmen (LK Geo + Englisch)")); };
  if (admin === null) rpc("cc_is_admin").then((v) => { admin = !!v; show(); }).catch(() => { admin = false; }); else show();
  return slot;
}
function setupView(rerender) {
  const f = setupForm(book, null, true);
  return h("div.m-pad.g",
    h("div.m-head", h("h1", "Notenrechner")),
    h("p.m-row-s", "Wähle Bundesland, Stufe und deine Fächer. Danach trägst du je Halbjahr deine Noten ein – Schnitt, Defizite und Abitur-Hochrechnung rechnet die App. Nur du siehst deine Noten."),
    planBtn(f),
    h("section.m-card", f.box),
    h("button.btn.primary.m-wide.m-mt", { onclick: () => {
      const v = f.collect();
      if (!v.faecher.length) return toast("Bitte mindestens ein Fach wählen", "err");
      Object.assign(book, v, { aktiv: v.halbjahre[0] }); persist(true); rerender(); toast("Los geht's – tippe bei einem Fach auf „+ Note“");
    } }, "Speichern und loslegen"));
}

function settingsSheet(rerender) {
  const f = setupForm(book, null, false);
  const m = modal("Notenrechner einstellen", h("div.stack", { style: { gap: "12px" } }, planBtn(f), f.box), { foot: [
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
