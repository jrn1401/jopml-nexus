// Event-Assistent: beim Erstellen eines Events wählen – Fragebogen mit KI, Import (Text/Datei/Kalender), in einem Satz, oder schnell von Hand.
// Der Bogen fragt genau nach (Ort, Zeiten, Alter, Ausschank, Programm, Geld), prüft sofort Regeln (im Browser, ohne KI-Anfrage)
// und lässt die KI daraus einen vollständigen Plan bauen: Aufgaben mit Fristen, Ablauf, Kosten, Einnahmen, Schichten, Technik, Posts.
// Funktioniert für den Admin (cc_events/cc_event_items) und alle Konten (nx_events/nx_event_items).
import { sb, q } from "./api.js";
import { h, icon, toast, toastErr, errMsg, modal, fmtEUR } from "./ui.js";
import { aiGen } from "./aigen.js";
import { checkRules, STATES } from "./rules.js";
import { parentalForm } from "./printables.js";

const LS = { get: (k, d) => { try { const v = localStorage.getItem("cc:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("cc:" + k, JSON.stringify(v)); } catch { /* voll */ } } };

const KINDS = ["Party / Club-Night", "Konzert / Live-Musik", "Geburtstag / Privatfeier", "Abi- / Schulparty", "Vereins- / Stadtfest", "Firmen- / Teamevent", "Hochzeit", "Workshop / Meetup", "Festival / Open Air", "Sonstiges"];
const VENUES = ["Club / Bar / Gaststätte", "Saal / Halle / Eventlocation", "Draußen / Open Air", "Privat (Wohnung, Garten)", "Schule / Jugendclub"];
const O = {
  kind: KINDS, state: STATES, venue: VENUES, venue_status: ["gebucht", "angefragt", "suche noch"],
  ages: ["unter 16", "16–17", "18+"], public: ["ja", "nein, nur geladene Gäste"], tickets: ["kostenlos", "Abendkasse", "Online-Tickets", "Online + Abendkasse"],
  own_age: ["unter 16", "16–17", "18 oder älter"], music: ["DJ / Musik vom Band", "Live-Band", "keine"],
  alcohol: ["nein", "nur Bier / Wein / Sekt", "auch Spirituosen / Longdrinks"], food: ["kein Essen", "Snacks", "Buffet / Catering", "Foodtruck / Verkauf"],
  tech: ["Location hat Ton & Licht", "teilweise vorhanden", "alles muss gemietet werden"], photos: ["ja", "nein"],
  money: ["Gewinn machen", "kostendeckend", "Geld egal / privat"], sponsors: ["ja", "vielleicht", "nein"], repeat: ["nein, einmalig", "ja"],
};
// Schritte: [Titel, Icon, Felder [key, Frage, Art, Hilfe?]]
const STEPS = [
  ["Das Event", "calendar", [["name", "Name des Events", "text", "Kurz und wiedererkennbar."], ["kind", "Art", "select"], ["date", "Datum", "date"], ["start", "Beginn", "time"], ["end", "Ende", "time", "Nach Mitternacht? Einfach z. B. 03:00 eintragen."],
    ["city", "Stadt / Ort", "text"], ["state", "Bundesland", "select", "Gaststätten- und Versammlungsrecht ist teils Ländersache."], ["venue", "Art der Location", "select"], ["venue_name", "Name der Location", "text", "Leer lassen, wenn noch offen."], ["venue_status", "Location", "select"]]],
  ["Gäste & Einlass", "users", [["guests", "Erwartete Gäste", "number"], ["capacity", "Max. Plätze der Location", "number", "Steht im Mietvertrag / bei der Location."], ["ages", "Alter der Gäste", "multi"], ["public", "Öffentlich?", "select"],
    ["tickets", "Einlass / Tickets", "select"], ["ticket_price", "Ticketpreis (€)", "number", "Leer lassen – die KI schlägt einen vor."], ["own_age", "Dein Alter (Veranstalter)", "select"], ["team", "Helfer im Team", "number"]]],
  ["Programm & Versorgung", "zap", [["music", "Musik", "select"], ["acts", "Wie viele DJs / Acts?", "number"], ["alcohol", "Alkohol", "select"], ["food", "Essen", "select"], ["tech", "Ton & Licht", "select"],
    ["motto", "Motto / Stil", "text", "z. B. Techno, 2000er, Neon, Weiß …"], ["photos", "Fotos/Videos posten?", "select"]]],
  ["Geld & Ziel", "wallet", [["budget", "Budget gesamt (€)", "number"], ["money", "Finanzielles Ziel", "select"], ["sponsors", "Sponsoren / Partner?", "select"], ["repeat", "Regelmäßig mit Gewinnabsicht?", "select"],
    ["goal", "Was soll das Event besonders machen?", "textarea", "Stimmung, Zielgruppe, Ziel – je genauer, desto besser der Plan."], ["extra", "Was ist schon erledigt / was ist besonders?", "textarea", "z. B. „DJ gebucht, Flyer fertig, Nachbarn empfindlich“."]]],
];
const ALL = STEPS.flatMap((s) => s[2]);
const REQ = ["name", "date", "city", "guests", "ages"];

const hm = (t) => { const m = /^(\d{1,2}):(\d{2})/.exec(t || ""); return m ? +m[1] * 60 + +m[2] : null; };
function toRules(a) {
  const s = hm(a.start), e = hm(a.end);
  const end = e === null ? undefined : (s !== null && e <= s) || e < 6 * 60 ? "nach Mitternacht" : e > 22 * 60 ? "bis 24 Uhr" : "vor 22 Uhr";
  return { name: a.name, deadline: a.date, state: a.state, own_age: a.own_age, guests: a.guests, ages: a.ages, end, venue: a.venue, public: a.public, alcohol: a.alcohol, music: a.music, tickets: a.tickets, photos: a.photos,
    purpose: a.money === "Gewinn machen" || a.repeat === "ja" ? "geschäftlich / mit Einnahmen" : a.kind === "Vereins- / Stadtfest" ? "Verein / Projekt" : "privat / Hobby",
    forms: /Online/.test(a.tickets || "") ? "ja" : "nein", repeat: a.repeat, team: Number(a.team) > 0 ? "Team" : "allein", budget: a.budget };
}
const startISO = (a, t = a.start) => (a.date ? new Date(`${a.date}T${t || "20:00"}`).toISOString() : null);

// Sofort-Hinweise (Faustregeln, Rechnen, Regel-Check) – kosten keine KI-Anfrage
function quickFacts(a) {
  const out = [];
  const g = Number(a.guests) || 0, bud = Number(a.budget) || 0, price = Number(a.ticket_price) || 0, cap = Number(a.capacity) || 0;
  if (a.date) {
    const d = Math.ceil((new Date(a.date) - Date.now()) / 864e5);
    if (d < 0) out.push(["bad", "Das Datum liegt in der Vergangenheit."]);
    else out.push([d < 21 ? "warn" : "ok", `Noch ${d} Tage${d < 21 ? " – knapp: Genehmigungen, GEMA und Location zuerst." : d < 42 ? " – gut machbar, Werbung bald starten." : " – genug Vorlauf."}`]);
  }
  if (cap && g > cap) out.push(["bad", `${g} Gäste, aber nur ${cap} Plätze – Location zu klein oder Gästezahl begrenzen.`]);
  if (bud && g) {
    const be = bud / g, be70 = bud / (g * 0.7);
    out.push(["info", `Break-even: ${be.toLocaleString("de-DE", { maximumFractionDigits: 2 })} € pro Gast bei voller Auslastung, ${be70.toLocaleString("de-DE", { maximumFractionDigits: 2 })} € bei 70 %.`]);
    if (price && a.tickets !== "kostenlos") { const need = Math.ceil(bud / price); out.push([need > g ? "warn" : "ok", `Mit ${price} € Ticketpreis brauchst du ${need} verkaufte Tickets${need > g ? ` – mehr als erwartete Gäste. Bar/Sponsoren einplanen oder Preis anpassen.` : ` (${Math.round((need / g) * 100)} % der Gäste).`}`]); }
  }
  if (g >= 50 && a.public === "ja") out.push(["info", `Faustregel Personal: ca. ${Math.max(2, Math.ceil(g / 100))} Security, ${Math.max(1, Math.ceil(g / 150))} am Einlass${a.alcohol && a.alcohol !== "nein" ? `, ${Math.max(1, Math.ceil(g / 60))} an der Bar` : ""}.`]);
  if (Number(a.team) && g && Number(a.team) < Math.ceil(g / 40)) out.push(["warn", `${a.team} Helfer für ${g} Gäste ist wenig – rechne mit ca. ${Math.ceil(g / 40)}.`]);
  const rules = checkRules("event", toRules(a));
  return { out, rules };
}

// ---------------------------------------------------------------- Einstieg: Auswahl
export function eventWizard({ admin = false, prefill = {}, quick, projectId = null } = {}) {
  const draft = LS.get("evw:draft", null);
  const m = modal("Neues Event", h("div"), { wide: true });
  const body = m.el.querySelector(".modal-body");
  const opt = (ic, t, d, fn, rec) => h("button.evw-opt", { type: "button", onclick: fn }, h("span.studio-ic", icon(ic)), h("span", h("b", t, rec ? h("span.badge.b-pri", { style: { marginLeft: "8px" } }, "empfohlen") : null), h("small", d)));
  const start = (a = {}, items = null, note = "") => bogen(m, body, { admin, projectId, a: { kind: "Party / Club-Night", ...prefill, ...a }, imported: items, note });
  body.replaceChildren(h("div.stack",
    h("p.muted", { style: { margin: 0 } }, "Wie möchtest du anfangen? Bei jedem Weg hilft die KI mit – am Ende hast du Aufgaben mit Fristen, Ablauf, Kosten, Schichten und einen Rechts-Check."),
    h("div.evw-opts",
      opt("check", "Fragebogen mit KI", "Kurze, genaue Fragen in 4 Schritten. Hinweise erscheinen sofort, die KI baut daraus den kompletten Plan.", () => start(), true),
      opt("upload", "Importieren", "Text, WhatsApp-Nachricht, E-Mail, Tabelle oder Kalender-Datei (.ics) – die KI liest alles aus und füllt den Bogen.", () => importer(m, body, start)),
      opt("bot", "In einem Satz beschreiben", "„Techno-Party für 150 Leute in Berlin am 14.2., 16+, Budget 1500 €“ – die KI füllt den Bogen vor.", () => sentence(m, body, start)),
      opt("edit", "Schnell von Hand", "Nur Name, Datum und Ort – Details später.", () => { m.close(); quick?.(); })),
    draft?.a?.name ? h("button.btn.ghost", { onclick: () => start(draft.a, draft.items, "Entwurf wiederhergestellt.") }, icon("refresh"), `Entwurf „${draft.a.name}“ fortsetzen`) : null));
}

// ---------------------------------------------------------------- KI-Auslesen (Import und Satz)
const SCHEMA = `{"answers":{${ALL.filter(([k]) => k !== "extra").map(([k, , kind]) => `"${k}":${kind === "number" ? "0" : kind === "multi" ? "[]" : '""'}`).join(",")}},
 "items":{"tasks":[{"t":"…","done":false}],"schedule":[{"time":"HH:MM","t":"…"}],"costs":[{"t":"…","eur":0}],"income":[{"t":"…","eur":0}],"guests":["Name"],"shifts":[{"role":"…","from":"HH:MM","to":"HH:MM","who":""}]},
 "missing":["wichtige offene Frage"]}`;
const ALLOWED = Object.entries(O).map(([k, v]) => `${k}: ${v.map((x) => `"${x}"`).join(" | ")}`).join("\n");
async function extract(text) {
  const r = await aiGen({ task: "event-import", json: true, input: text.slice(0, 18000),
    instructions: `Lies aus dem Text alle Angaben zu EINEM Event heraus und gib sie strukturiert zurück. Nur was im Text steht oder eindeutig folgt – nichts erfinden, Unbekanntes leer lassen (""/0/[]).
Datum als YYYY-MM-DD (Jahr ${new Date().getFullYear()} oder später, falls fehlend), Zeiten als HH:MM. Bei Auswahlfeldern NUR exakt diese Werte verwenden:
${ALLOWED}
"done" = true, wenn der Text sagt, dass es erledigt ist. Antworte NUR mit JSON genau in dieser Form:
${SCHEMA}` });
  const j = r.json || {};
  const a = {};
  for (const [k, , kind] of ALL) {
    const v = j.answers?.[k];
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length) || v === 0) continue;
    if (O[k] && kind !== "multi" && !O[k].includes(v)) continue;
    if (kind === "multi") { const ok = (Array.isArray(v) ? v : [v]).filter((x) => O[k].includes(x)); if (ok.length) a[k] = ok; continue; }
    if (kind === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(v)) continue;
    if (kind === "time" && !/^\d{1,2}:\d{2}$/.test(v)) continue;
    a[k] = kind === "number" ? (Number(v) > 0 ? Number(v) : undefined) : String(v).slice(0, kind === "textarea" ? 1200 : 160);
    if (a[k] === undefined) delete a[k];
  }
  const it = j.items || {};
  const items = [
    ...(it.tasks || []).map((x) => ({ kind: "task", title: x.t || x.title || x, done: !!x.done })),
    ...(it.schedule || []).map((x) => ({ kind: "schedule", title: x.t || x.title, time: x.time })),
    ...(it.costs || []).map((x) => ({ kind: "cost", title: x.t || x.title, amount: Number(x.eur ?? x.amount) || null })),
    ...(it.income || []).map((x) => ({ kind: "income", title: x.t || x.title, amount: Number(x.eur ?? x.amount) || null })),
    ...(it.guests || []).map((x) => ({ kind: "guest", title: x.name || x })),
    ...(it.shifts || []).map((x) => ({ kind: "shift", title: x.role || x.t, time: x.from, end: x.to, assignee: x.who || null })),
  ].filter((x) => typeof x.title === "string" && x.title.trim()).map((x) => ({ ...x, title: x.title.trim().slice(0, 200), src: "import", on: true }));
  return { a, items, missing: (j.missing || []).slice(0, 6), model: r.model };
}
// Kalender-Datei (.ics) ohne KI auslesen
function parseIcs(t) {
  const un = t.replace(/\r?\n[ \t]/g, "");
  const get = (k) => (new RegExp(`^${k}[^:\\n]*:(.*)$`, "m").exec(un) || [])[1]?.trim().replace(/\\n/g, "\n").replace(/\\,/g, ",");
  const dt = (v) => { const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(v || ""); return m ? { date: `${m[1]}-${m[2]}-${m[3]}`, time: m[4] ? `${m[4]}:${m[5]}` : "" } : null; };
  const s = dt(get("DTSTART")), e = dt(get("DTEND"));
  const a = {};
  if (get("SUMMARY")) a.name = get("SUMMARY").slice(0, 160);
  if (s) { a.date = s.date; if (s.time) a.start = s.time; }
  if (e?.time) a.end = e.time;
  if (get("LOCATION")) a.venue_name = get("LOCATION").slice(0, 160);
  if (get("DESCRIPTION")) a.goal = get("DESCRIPTION").slice(0, 1200);
  return a;
}

function importer(m, body, start) {
  const ta = h("textarea.input", { rows: 9, maxlength: 18000, placeholder: "Hier einfügen: Nachricht, E-Mail, Notizen, Tabelle (auch aus Excel), Eventfrog-Beschreibung …", "aria-label": "Text zum Importieren" });
  const info = h("div.faint", { style: { fontSize: "12.5px" } }, "Dateien bleiben in deinem Browser – nur der Text geht an die KI.");
  let ics = null;
  const file = h("input", { type: "file", accept: ".txt,.md,.csv,.tsv,.ics,.json,.eml,.html,.htm", hidden: true, onchange: async () => {
    const f = file.files[0]; if (!f) return;
    if (f.size > 2e6) return toast("Datei zu groß (max. 2 MB).", "err");
    let t = await f.text();
    if (/\.html?$/i.test(f.name)) t = new window.DOMParser().parseFromString(t, "text/html").body.textContent || "";
    if (/\.ics$/i.test(f.name) || /BEGIN:VEVENT/.test(t)) { ics = parseIcs(t); info.textContent = `Kalender-Termin erkannt: ${ics.name || "ohne Titel"}${ics.date ? `, ${new Date(ics.date).toLocaleDateString("de-DE")}` : ""}.`; }
    ta.value = t.slice(0, 18000); info.textContent = (info.textContent.startsWith("Kalender") ? info.textContent + " " : "") + `„${f.name}“ geladen (${Math.round(t.length / 1000)} k Zeichen).`;
  } });
  const go = h("button.btn.primary", { onclick: async () => {
    const t = ta.value.trim();
    if (!t && !ics) return toast("Bitte Text einfügen oder eine Datei wählen.", "info");
    go.disabled = true; go.replaceChildren(h("span.spinner"), " KI liest aus …");
    try {
      const r = t.length > 15 ? await extract(t) : { a: {}, items: [], missing: [] };
      const a = { ...(ics || {}), ...r.a };
      start(a, r.items, `Aus dem Import übernommen: ${Object.keys(a).length} Angaben, ${r.items.length} Einträge.${r.missing.length ? ` Offen: ${r.missing.join(" · ")}` : ""} Bitte kurz prüfen.`);
    } catch (e) {
      if (ics) start(ics, null, `Kalender-Termin übernommen (KI nicht erreichbar: ${errMsg(e)}).`);
      else { toastErr(e); go.disabled = false; go.replaceChildren(icon("sparkles"), "Mit KI auslesen"); }
    }
  } }, icon("sparkles"), "Mit KI auslesen");
  body.replaceChildren(h("div.stack",
    h("button.btn.ghost.sm", { style: { alignSelf: "flex-start" }, onclick: () => { m.close(); eventWizard(); } }, icon("chevronL"), "Zurück"),
    h("h3", { style: { margin: 0 } }, "Event importieren"),
    ta, h("div.row.wrap", { style: { gap: "8px" } }, h("button.btn", { onclick: () => file.click() }, icon("upload"), "Datei wählen"), file, go), info));
}

function sentence(m, body, start) {
  const ta = h("textarea.input", { rows: 3, maxlength: 800, placeholder: "z. B. Techno-Party für 150 Leute im Club XY in Stuttgart am 14.2. von 22 bis 4 Uhr, 16+, Tickets online 12 €, Budget 1500 €", "aria-label": "Event beschreiben" });
  const go = h("button.btn.primary", { onclick: async () => {
    if (ta.value.trim().length < 8) return toast("Bitte etwas genauer beschreiben.", "info");
    go.disabled = true; go.replaceChildren(h("span.spinner"), " KI versteht …");
    try { const r = await extract(ta.value.trim()); start({ goal: ta.value.trim().slice(0, 1200), ...r.a }, r.items, `Die KI hat ${Object.keys(r.a).length} Angaben erkannt – fehlende Felder sind markiert.`); }
    catch (e) { toastErr(e); go.disabled = false; go.replaceChildren(icon("sparkles"), "Weiter"); }
  } }, icon("sparkles"), "Weiter");
  body.replaceChildren(h("div.stack",
    h("button.btn.ghost.sm", { style: { alignSelf: "flex-start" }, onclick: () => { m.close(); eventWizard(); } }, icon("chevronL"), "Zurück"),
    h("h3", { style: { margin: 0 } }, "Beschreib dein Event"), ta, h("div.row", go)));
  ta.focus();
}

// ---------------------------------------------------------------- Bogen (4 Schritte + live Hinweise)
function bogen(m, body, ctx) {
  const st = { step: 0, a: { ...ctx.a }, items: ctx.imported || [] };
  const save = () => LS.set("evw:draft", { a: st.a, items: st.items });
  const hints = h("aside.evw-hints");
  const form = h("div.evw-form");
  const bar = h("div.evw-steps");
  const askBox = h("div");

  function input(k, kind) {
    const v = st.a[k];
    const set = (val) => { if (val === "" || val === null) delete st.a[k]; else st.a[k] = val; save(); drawHints(); };
    let el;
    if (kind === "select") el = h("select.input", { onchange: (e) => set(e.target.value) }, h("option", { value: "" }, "– wählen –"), O[k].map((o) => h("option", { value: o, selected: v === o }, o)));
    else if (kind === "multi") el = h("div.row.wrap", O[k].map((o) => h("button.chip", { type: "button", class: (v || []).includes(o) ? "on" : "", onclick: (e) => { const c = new Set(st.a[k] || []); c.has(o) ? c.delete(o) : c.add(o); set(c.size ? [...c] : ""); e.currentTarget.classList.toggle("on"); } }, o)));
    else if (kind === "textarea") el = h("textarea.input", { rows: 3, maxlength: 1200, oninput: (e) => set(e.target.value) }, v || "");
    else el = h("input.input", { type: kind, value: v ?? "", min: kind === "number" ? 0 : undefined, maxlength: 160, oninput: (e) => set(kind === "number" ? (e.target.value === "" ? "" : Number(e.target.value)) : e.target.value) });
    return el;
  }
  function drawForm() {
    const [title, , fields] = STEPS[st.step];
    bar.replaceChildren(...STEPS.map(([t, ic], i) => h("button.evw-step", { type: "button", class: i === st.step ? "on" : i < st.step ? "done" : "", onclick: () => { st.step = i; drawForm(); } }, icon(ic), h("span", t))),
      h("button.evw-step", { type: "button", class: st.step === 4 ? "on" : "", onclick: () => plan() }, icon("sparkles"), h("span", "KI-Plan")));
    form.replaceChildren(
      ctx.note && st.step === 0 ? h("div.na-note", icon("info"), h("div", ctx.note)) : null,
      h("h3", { style: { margin: "0 0 4px" } }, title),
      h("div.grid.g-2", fields.map(([k, label, kind, hint]) => {
        const miss = REQ.includes(k) && (st.a[k] === undefined || st.a[k] === "");
        const el = input(k, kind); el.setAttribute?.("aria-label", label);
        return h("div.field", { class: miss ? "evw-miss" : "", style: kind === "textarea" || kind === "multi" ? { gridColumn: "1 / -1" } : null }, h("label", label + (REQ.includes(k) ? " *" : "")), el, hint ? h("div.hint", hint) : null);
      })),
      h("div.row", { style: { gap: "8px", marginTop: "10px", justifyContent: "space-between" } },
        st.step ? h("button.btn.ghost", { onclick: () => { st.step--; drawForm(); } }, icon("chevronL"), "Zurück") : h("span"),
        st.step < 3 ? h("button.btn.primary", { onclick: () => { st.step++; drawForm(); } }, "Weiter", icon("chevronR"))
          : h("button.btn.primary", { onclick: () => plan() }, icon("sparkles"), "KI-Plan erstellen")));
  }
  function drawHints() {
    const { out, rules } = quickFacts(st.a);
    const lv = { muss: ["Pflicht", "b-bad"], wichtig: ["Wichtig", "b-warn"], tipp: ["Tipp", "b-idle"] };
    const col = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", info: "var(--primary)" };
    const minors = (st.a.ages || []).some((x) => x !== "18+");
    hints.replaceChildren(
      h("div.row.between", h("b.row", { style: { gap: "6px" } }, icon("sparkles"), "KI-Hinweise"), h("span.faint", { style: { fontSize: "11.5px" } }, "live")),
      out.length || rules.length ? null : h("p.faint", { style: { fontSize: "13px" } }, "Füll die Fragen aus – hier erscheinen sofort Berechnungen, Faustregeln und was rechtlich wichtig ist."),
      ...out.map(([k, t]) => h("div.evw-fact", { style: { borderLeftColor: col[k] } }, t)),
      rules.length ? h("div", { style: { marginTop: "6px" } }, h("div.faint", { style: { fontSize: "12px", marginBottom: "4px" } }, `Rechts-Check: ${rules.filter((r) => r.level === "muss").length} Pflichten, ${rules.filter((r) => r.level === "wichtig").length} wichtige Punkte`),
        ...rules.slice(0, 7).map((r) => h("div.evw-rule", h("span.badge", { class: lv[r.level][1] }, lv[r.level][0]), " ", r.title, r.ref ? [" ", h("a", { href: r.ref[1], target: "_blank", rel: "noopener" }, r.ref[0])] : null))) : null,
      minors ? h("button.btn.sm", { style: { marginTop: "8px" }, onclick: () => { const blob = new Blob([parentalForm({ event: st.a.name || "", date: st.a.date ? new Date(st.a.date).toLocaleDateString("de-DE") : "", place: [st.a.venue_name, st.a.city].filter(Boolean).join(", ") })], { type: "text/html" });
        const a = h("a", { href: URL.createObjectURL(blob), download: "erziehungsbeauftragung.html" }); document.body.append(a); a.click(); a.remove(); } }, icon("download"), "Muttizettel-Vorlage") : null,
      st.items.length ? h("div.faint", { style: { fontSize: "12px", marginTop: "8px" } }, `${st.items.length} Einträge aus dem Import werden übernommen.`) : null,
      h("div.evw-ask", h("div.faint", { style: { fontSize: "12px" } }, "Frag die KI zu deinem Event"),
        h("form.row", { style: { gap: "6px" }, onsubmit: async (e) => {
          e.preventDefault(); const inp = e.currentTarget.querySelector("input"); const qq = inp.value.trim(); if (!qq) return;
          askBox.replaceChildren(h("div.faint", h("span.spinner"), " …"));
          try { const r = await aiGen({ task: "event-frage", instructions: "Beantworte die Frage zur Eventplanung kurz (max. 6 Sätze), konkret für dieses Event. Keine Paragraphen erfinden.", input: `Event: ${JSON.stringify(st.a)}\nFrage: ${qq}` });
            askBox.replaceChildren(h("div.evw-answer", r.text)); inp.value = ""; } catch (er) { askBox.replaceChildren(h("div.banner.bad", errMsg(er))); }
        } }, h("input.input", { placeholder: "z. B. Wie viel Security brauche ich?", "aria-label": "Frage an die KI", maxlength: 300 }), h("button.btn.sm", { type: "submit", "aria-label": "Fragen" }, icon("send"))), askBox));
  }

  // ---------- Schritt 5: KI-Plan
  async function plan() {
    const miss = REQ.filter((k) => st.a[k] === undefined || st.a[k] === "");
    if (miss.length) { st.step = STEPS.findIndex((s) => s[2].some(([k]) => k === miss[0])); drawForm(); return toast(`Bitte noch ausfüllen: ${miss.map((k) => ALL.find((f) => f[0] === k)[1]).join(", ")}`, "info"); }
    st.step = 4;
    bar.querySelectorAll(".evw-step").forEach((b, i) => b.classList.toggle("on", i === 4));
    form.replaceChildren(h("div.stack", h("h3", { style: { margin: 0 } }, "Die KI erstellt deinen Plan …"),
      h("div.faint", h("span.spinner"), " Aufgaben mit Fristen, Ablauf, Kosten, Einnahmen, Schichten, Technik und Werbeplan – passend zu Ort, Alter und Größe. Das dauert 10–20 Sekunden.")));
    const { rules, out } = quickFacts(st.a);
    const facts = `EVENT-ANGABEN: ${JSON.stringify(st.a)}\nBERECHNET: ${out.map((x) => x[1]).join(" | ")}\nRECHTS-CHECK (bereits als Aufgaben enthalten, nicht wiederholen): ${rules.map((r) => `${r.level}: ${r.title}`).join("; ")}\nSCHON VORHANDEN: ${st.items.map((i) => `${i.kind}: ${i.title}`).join("; ").slice(0, 2500)}`;
    const base = "Du bist erfahrener Eventplaner in Deutschland. Plane GENAU dieses Event (Art, Ort, Bundesland, Gästezahl, Alter, Uhrzeit, Budget). Konkret und realistisch, deutsche Marktpreise 2026 als Schätzung. Nichts erfinden, was den Angaben widerspricht. Keine Paragraphen nennen. Kurze Titel (max. 90 Zeichen). Antworte NUR mit JSON.";
    const pA = aiGen({ task: "event-plan", json: true, input: facts, instructions: `${base}
{"summary":"3 Sätze Einschätzung: Machbarkeit, größtes Risiko, wichtigster Hebel","description":"Beschreibung für Gäste (2-3 Sätze, einladend)","tasks":[{"t":"Aufgabe","w":6,"who":"Rolle","why":"kurz"}],"risks":["…"],"tips":["…"]}
tasks: 12-18 Stück, chronologisch, w = Wochen vor dem Event (0 = am Tag). Alles abdecken: Location/Vertrag, Genehmigungen, Personal, Technik, Getränke/Essen, Werbung, Tickets, Einlass, Aufbau, Abbau, Abrechnung. risks max 4, tips max 4.` });
    const pB = aiGen({ task: "event-plan", json: true, input: facts, instructions: `${base}
{"schedule":[{"time":"HH:MM","t":"…"}],"costs":[{"t":"…","eur":0,"note":"Schätzung kurz"}],"income":[{"t":"…","eur":0}],"shifts":[{"role":"…","from":"HH:MM","to":"HH:MM","n":1}],"tech":[{"t":"…","eur":0}],"posts":[{"w":4,"ch":"Instagram","t":"Inhalt"}],"ticket_price":0}
schedule: Aufbau bis Abbau, 8-12 Punkte. costs: 6-12 realistische Posten passend zur Gästezahl, Summe möglichst im Budget. income: Tickets (Anzahl × Preis), Bar etc. shifts: Einlass, Bar, Security, Garderobe … mit Anzahl Personen. tech: nur wenn Ton/Licht nicht vorhanden. posts: 5-7 Werbe-Posts. ticket_price: Vorschlag in € (0 bei kostenlos).` });
    const [rA, rB] = await Promise.allSettled([pA, pB]);
    const A = rA.status === "fulfilled" ? rA.value.json || {} : {}, B = rB.status === "fulfilled" ? rB.value.json || {} : {};
    const failed = [rA, rB].filter((x) => x.status === "rejected").map((x) => errMsg(x.reason));
    const day = st.a.date ? new Date(`${st.a.date}T${st.a.start || "20:00"}`) : null;
    const atWeeks = (w) => (day && Number.isFinite(+w) ? new Date(day.getTime() - Math.max(0, +w) * 7 * 864e5).toISOString() : null);
    const atTime = (t) => { if (!day || !/^\d{1,2}:\d{2}/.test(t || "")) return null; const d = new Date(`${st.a.date}T${t.padStart(5, "0")}`); if (hm(t) < 8 * 60 && hm(st.a.start || "20:00") > 12 * 60) d.setDate(d.getDate() + 1); return d.toISOString(); };
    const L = [];
    rules.filter((r) => r.task && r.level !== "tipp").forEach((r) => L.push({ kind: "task", title: r.task, note: `${r.why}${r.ref ? ` (${r.ref[0]})` : ""}`, at: atWeeks(r.level === "muss" ? 4 : 3), src: r.level === "muss" ? "Pflicht" : "Wichtig", on: true }));
    (A.tasks || []).slice(0, 20).forEach((x) => L.push({ kind: "task", title: x.t, note: [x.why, x.who && `Zuständig: ${x.who}`].filter(Boolean).join(" · "), at: atWeeks(x.w), src: "KI", on: true }));
    (B.schedule || []).slice(0, 14).forEach((x) => L.push({ kind: "schedule", title: `${x.time ? `${x.time} ` : ""}${x.t}`, at: atTime(x.time), src: "KI", on: true }));
    (B.costs || []).slice(0, 14).forEach((x) => L.push({ kind: "cost", title: x.t, amount: Number(x.eur) || null, note: x.note ? `Schätzung: ${x.note}` : "Schätzung der KI", src: "KI", on: true }));
    (B.income || []).slice(0, 8).forEach((x) => L.push({ kind: "income", title: x.t, amount: Number(x.eur) || null, note: "Erwartung der KI", src: "KI", on: true }));
    (B.shifts || []).slice(0, 12).forEach((x) => L.push({ kind: "shift", title: `${x.role}${x.n > 1 ? ` (${x.n} Pers.)` : ""}`, at: atTime(x.from), ends_at: atTime(x.to), src: "KI", on: true }));
    (B.tech || []).slice(0, 10).forEach((x) => L.push({ kind: "tech", title: x.t, amount: Number(x.eur) || null, src: "KI", on: true }));
    (B.posts || []).slice(0, 8).forEach((x) => L.push({ kind: "post", title: x.t, note: x.ch || "", contact: x.ch || null, at: atWeeks(x.w), src: "KI", on: true }));
    const imp = st.items.map((x) => ({ ...x, at: x.at || atTime(x.time), ends_at: x.ends_at || atTime(x.end) }));
    const seen = new Set();
    const all = [...imp, ...L].filter((x) => x.title && String(x.title).trim()).filter((x) => { const k = `${x.kind}|${String(x.title).toLowerCase().slice(0, 50)}`; if (seen.has(k)) return false; seen.add(k); return true; })
      .map((x) => ({ ...x, title: String(x.title).slice(0, 200), note: String(x.note || "").slice(0, 1000) }));
    review(all, A, B, failed);
  }

  function review(all, A, B, failed) {
    const NAMES = { task: "Aufgaben", schedule: "Ablauf", cost: "Kosten", income: "Einnahmen", shift: "Schichten", tech: "Technik", post: "Werbeplan", guest: "Gäste" };
    const sums = h("div.evw-sums");
    const calc = () => {
      const c = all.filter((x) => x.on && (x.kind === "cost" || x.kind === "tech")).reduce((s, x) => s + (+x.amount || 0), 0);
      const i = all.filter((x) => x.on && x.kind === "income").reduce((s, x) => s + (+x.amount || 0), 0);
      const n = all.filter((x) => x.on).length;
      sums.replaceChildren(h("span", "Kosten ", h("b", fmtEUR(c))), h("span", "Einnahmen ", h("b", fmtEUR(i))), h("span", "Ergebnis ", h("b", { style: { color: i - c >= 0 ? "var(--ok)" : "var(--bad)" } }, fmtEUR(i - c))),
        st.a.budget ? h("span", "Budget ", h("b", { style: { color: c > +st.a.budget ? "var(--bad)" : "inherit" } }, fmtEUR(+st.a.budget))) : null, h("span.spacer"), h("span", `${n} Einträge`));
      createBtn.textContent = `Event anlegen (${n})`;
    };
    const createBtn = h("button.btn.primary", { onclick: async () => {
      createBtn.disabled = true;
      try { const id = await createEvent(ctx, st.a, all.filter((x) => x.on), { A, B }); LS.set("evw:draft", null); m.close(); toast("Event mit Plan angelegt – alles lässt sich bearbeiten"); location.hash = `#/events/${id}`; }
      catch (e) { toastErr(e); createBtn.disabled = false; }
    } });
    const groups = Object.keys(NAMES).filter((k) => all.some((x) => x.kind === k)).filter((k) => ctx.admin || !["tech", "post"].includes(k) || true);
    form.replaceChildren(h("div.stack",
      h("h3", { style: { margin: 0 } }, "Dein Plan – prüfen und anlegen"),
      failed.length ? h("div.banner", icon("info"), h("div", `Ein Teil der KI-Antwort fehlt (${failed[0]}). Pflicht-Aufgaben aus dem Rechts-Check und dein Import sind trotzdem drin.`)) : null,
      A.summary ? h("div.na-note", icon("sparkles"), h("div", A.summary)) : null,
      (A.risks || []).length ? h("div", { style: { fontSize: "13.5px" } }, h("b", "Risiken: "), A.risks.join(" · ")) : null,
      (A.tips || []).length ? h("div", { style: { fontSize: "13.5px" } }, h("b", "Tipps: "), A.tips.join(" · ")) : null,
      B.ticket_price > 0 && !st.a.ticket_price ? h("div", { style: { fontSize: "13.5px" } }, h("b", "Ticketpreis-Vorschlag: "), fmtEUR(B.ticket_price), " ", h("button.btn.sm.ghost", { onclick: (e) => { st.a.ticket_price = B.ticket_price; e.currentTarget.replaceWith(h("span.badge.b-ok", "übernommen")); } }, "übernehmen")) : null,
      sums,
      ...groups.map((k) => { const list = all.filter((x) => x.kind === k);
        return h("details.evw-group", { open: ["task", "cost", "schedule"].includes(k) }, h("summary", h("b", NAMES[k]), h("span.faint", ` ${list.length}`),
          h("button.btn.sm.ghost", { type: "button", style: { marginLeft: "auto" }, onclick: (e) => { e.preventDefault(); const on = !list.every((x) => x.on); list.forEach((x) => { x.on = on; }); e.currentTarget.closest("details").querySelectorAll("input[type=checkbox]").forEach((c) => { c.checked = on; }); calc(); } }, "alle an/aus")),
        h("div.list", list.map((x) => h("label.list-item", { style: { alignItems: "flex-start" } },
          h("input", { type: "checkbox", checked: x.on, onchange: (e) => { x.on = e.target.checked; calc(); } }),
          h("div.li-main", h("div.li-title", x.src && x.src !== "KI" ? h("span.badge", { class: x.src === "Pflicht" ? "b-bad" : x.src === "Wichtig" ? "b-warn" : "b-pri", style: { marginRight: "6px" } }, x.src === "import" ? "Import" : x.src) : null, x.title),
            h("div.li-sub", { style: { whiteSpace: "normal" } }, [x.at ? new Date(x.at).toLocaleString("de-DE", { dateStyle: k === "schedule" || k === "shift" ? undefined : "short", timeStyle: k === "task" || k === "post" ? undefined : "short" }) : null, x.note].filter(Boolean).join(" · "))),
          ["cost", "income", "tech"].includes(k) ? h("input.input.evw-eur", { type: "number", min: 0, step: "1", value: x.amount ?? "", "aria-label": `Betrag ${x.title}`, onclick: (e) => e.preventDefault(), oninput: (e) => { x.amount = e.target.value === "" ? null : Number(e.target.value); calc(); } }) : null)))); }),
      h("div.row.wrap", { style: { gap: "8px", justifyContent: "space-between" } },
        h("div.row", { style: { gap: "8px" } }, h("button.btn.ghost", { onclick: () => { st.step = 3; drawForm(); } }, icon("chevronL"), "Bogen ändern"), h("button.btn", { onclick: () => plan() }, icon("refresh"), "Neu planen")),
        createBtn)));
    calc();
  }

  body.replaceChildren(h("div.evw", bar, h("div.evw-main", form, hints)));
  m.el.querySelector(".modal").classList.add("evw-modal");
  drawForm(); drawHints();
}

// ---------------------------------------------------------------- Anlegen
async function createEvent(ctx, a, items, { A }) {
  const when = startISO(a);
  const loc = [a.venue_name, a.city].filter(Boolean).join(", ");
  const rules = checkRules("event", toRules(a));
  const profile = { type: "event", answers: toRules(a), wizard: a, checked_at: new Date().toISOString(), check: rules.map((r) => ({ level: r.level, title: r.title, ref: r.ref?.[0] || null })), summary: A?.summary || null };
  const desc = [A?.description, a.goal].filter(Boolean).join("\n\n").slice(0, 8000);
  const row = (x) => ({ kind: x.kind, title: x.title, note: x.note || "", at: x.at || null, ends_at: x.ends_at || null, amount: x.amount ?? null, done: !!x.done, assignee: x.assignee || null });
  if (ctx.admin) {
    const ev = await q(sb.from("cc_events").insert({ name: a.name.slice(0, 120), event_date: when, location: loc.slice(0, 160), budget: Number(a.budget) || null, expected_guests: Number(a.guests) || null,
      status: "planning", description: desc, project_id: ctx.projectId || null, metadata: { profile, ticket_price: Number(a.ticket_price) || null, capacity: Number(a.capacity) || null } }).select("id").single());
    const rows = items.map((x) => ({ ...row(x), event_id: ev.id, ...(x.kind === "post" && x.contact ? { contact: String(x.contact).slice(0, 200) } : {}) }));
    for (let i = 0; i < rows.length; i += 100) await q(sb.from("cc_event_items").insert(rows.slice(i, i + 100)));
    return ev.id;
  }
  // Konten: Projekt (für Profil/Rechts-Check) + Event; Technik/Posts werden Aufgaben
  const p = await q(sb.from("nx_projects").insert({ name: a.name.slice(0, 120), kind: "event", description: desc.slice(0, 4000), provider: "manual", metadata: { profile, date: when } }).select("id").single()).catch(() => null);
  const ev = await q(sb.from("nx_events").insert({ name: a.name.slice(0, 160), event_date: when, location: loc.slice(0, 300), status: "planning", description: desc,
    capacity: Number(a.capacity) || Number(a.guests) || null, ticket_price: Number(a.ticket_price) || null, budget: Number(a.budget) || null, nx_project_id: p?.id || null }).select("id").single());
  const rows = items.map((x) => x.kind === "tech" ? { ...x, kind: "cost", title: `Technik: ${x.title}`.slice(0, 200) } : x.kind === "post" ? { ...x, kind: "task", title: `Posten (${x.contact || "Social"}): ${x.title}`.slice(0, 200) } : x)
    .map((x) => ({ ...row(x), event_id: ev.id }));
  for (let i = 0; i < rows.length; i += 100) await q(sb.from("nx_event_items").insert(rows.slice(i, i + 100)));
  try { localStorage.setItem("cc:ws:did-event", "true"); } catch { /* */ }
  return ev.id;
}
