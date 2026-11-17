// Website-Baukasten (eigene Seite, ohne Anmeldung nutzbar): Formular → Live-Vorschau → index.html herunterladen.
// Optional: KI-Texte und „Mit KI ändern“ (Gast-Zugang reicht), Online stellen mit festem Nexus-Link (Google-Konto), später bearbeiten – Link bleibt gleich.
import { sb, q } from "./lib/api.js";
import { h, icon, toast, toastErr, errMsg, modal, copyText, siteThumb } from "./lib/ui.js";
import { aiGen } from "./lib/aigen.js";
import { buildPro, STYLES, ANIMS, HOSTS, DEFAULTS, legalMissing } from "./lib/progen.js";
import { slugify } from "./lib/sitegen.js";

const root = document.getElementById("root");
const KEY = "cc:bau:draft";
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || null; } catch { return null; } };
let S = window.structuredClone({ ...DEFAULTS, ...(load() || {}) });
S.legal = { ...DEFAULTS.legal, ...(S.legal || {}) }; S.sections = { ...DEFAULTS.sections, ...(S.sections || {}) };
let site = null;           // { id, slug } wenn online
const params = new URLSearchParams(location.search);
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch { /* voll */ } };

const KINDS = {
  "Event / Party": { servicesTitle: "Line-up", eventsTitle: "Termine", cta1: "Tickets", sections: { events: true, gallery: true } },
  "DJ / Musiker": { servicesTitle: "Sound & Sets", eventsTitle: "Gigs", cta1: "Booking anfragen", sections: { events: true, reviews: true } },
  "Verein / Gruppe": { servicesTitle: "Was wir machen", eventsTitle: "Termine", cta1: "Mitmachen", sections: { events: true, faq: true } },
  "Dienstleister / Firma": { servicesTitle: "Leistungen & Preise", eventsTitle: "Aktuelles", cta1: "Angebot anfragen", sections: { reviews: true, events: false } },
  "Café / Restaurant": { servicesTitle: "Speisekarte", eventsTitle: "Öffnungszeiten & Events", cta1: "Tisch reservieren", sections: { gallery: true, reviews: true } },
  "Portfolio / Kreativ": { servicesTitle: "Projekte", eventsTitle: "Ausstellungen", cta1: "Kontakt", sections: { gallery: true, events: false } },
  "Schulprojekt": { servicesTitle: "Inhalte", eventsTitle: "Zeitplan", cta1: "Mehr erfahren", sections: { faq: true, reviews: false } },
};

// ---------- Formular-Bausteine
const inp = (key, label, opt = {}) => {
  const get = () => key.split(".").reduce((o, k) => o?.[k], S) ?? "";
  const set = (v) => { const ks = key.split("."); let o = S; ks.slice(0, -1).forEach((k) => { o = o[k]; }); o[ks.at(-1)] = v; save(); refresh(); };
  const el = opt.area ? h("textarea.input", { rows: opt.rows || 4, maxlength: 6000, placeholder: opt.ph || "", oninput: (e) => set(e.target.value) }, get())
    : h("input.input", { type: opt.type || "text", value: get(), placeholder: opt.ph || "", maxlength: 300, oninput: (e) => set(e.target.value) });
  el.setAttribute("aria-label", label); el.dataset.key = key;
  return h("div.field", h("label", label), el, opt.hint ? h("div.hint", opt.hint) : null);
};
const toggle = (k, label) => h("label.check", h("input", { type: "checkbox", checked: !!S.sections[k], onchange: (e) => { S.sections[k] = e.target.checked; save(); refresh(); } }), label);
const group = (title, open, ...kids) => h("details.card.bau-group", { open }, h("summary", h("b", title)), h("div.stack", { style: { gap: "10px", padding: "4px 2px 8px" } }, ...kids));

// ---------- Vorschau
const frame = h("iframe.bau-frame", { title: "Vorschau", sandbox: "allow-same-origin" });
let device = "desk", timer = 0;
function refresh() { clearTimeout(timer); timer = setTimeout(() => { frame.srcdoc = buildPro(S); warn(); }, 220); }
const warnBox = h("div");
function warn() {
  const miss = legalMissing(S);
  warnBox.replaceChildren(miss.length ? h("div.banner", icon("info"), h("div", `Impressum unvollständig: ${miss.join(", ")} fehlt. Ohne vollständiges Impressum solltest du die Seite nicht öffentlich stellen, wenn sie geschäftsmäßig ist (§ 5 DDG).`)) : null);
}

// ---------- KI
async function ensureLogin() {
  const { data } = await sb.auth.getSession();
  if (data.session) return true;
  try { const r = await sb.auth.signInAnonymously(); if (r.error) throw r.error; toast("Gast-Zugang für die KI aktiv (10 Anfragen/Tag)"); return true; }
  catch { toast("Für KI bitte im JOPML Nexus anmelden (oder Gast-Modus).", "info"); return false; }
}
async function aiTexts(btn) {
  if (!S.name && !S.about) return toast("Gib zuerst einen Namen und ein paar Stichworte unter „Über uns“ ein.", "info");
  if (!(await ensureLogin())) return;
  btn.disabled = true; const old = btn.innerHTML; btn.textContent = "KI schreibt …";
  try {
    const r = await aiGen({ task: "website-pro", json: true, maxTokens: 3000, instructions: `Schreibe Texte für eine professionelle One-Page-Website (Art: ${S.kind}). Deutsch, lebendig, konkret, kurz. Nichts erfinden (keine Preise, Daten, Namen, Bewertungen) – nutze Stichworte; fehlt etwas, schreibe allgemein.
Antworte NUR mit JSON: {"tagline":"max 90 Zeichen","about":"2 kurze Absätze","services":"3-6 Zeilen im Format Titel | Beschreibung","faq":"4-6 Zeilen im Format Frage | Antwort","cta1":"Button-Text"}`,
      input: JSON.stringify({ name: S.name, kind: S.kind, tagline: S.tagline, about: S.about, services: S.services, events: S.events }) });
    const j = r.json || {};
    for (const k of ["tagline", "about", "services", "faq", "cta1"]) if (typeof j[k] === "string" && j[k].trim()) S[k] = j[k].slice(0, 5000);
    save(); draw(); toast("Texte eingesetzt – bitte prüfen");
  } catch (e) { toastErr(e); btn.disabled = false; btn.innerHTML = old; }
}
async function aiChange() {
  const ta = h("textarea.input", { rows: 3, maxlength: 800, "aria-label": "Änderung", placeholder: "z. B. „Füge eine FAQ zur Garderobe hinzu“, „Mach den Text kürzer und lockerer“, „Neuer Termin 14.2. Club XY“, „Farbe Blau“" });
  const m = modal("Mit KI ändern", h("div.stack", h("p.muted", { style: { margin: 0 } }, "Sag einfach, was anders sein soll. Ist die Seite online, bleibt der Link gleich – du musst danach nur „Online aktualisieren“ drücken."), ta,
    h("div.row", { style: { justifyContent: "flex-end" } }, h("button.btn.primary", { onclick: async (e) => {
      if (ta.value.trim().length < 3) return;
      if (!(await ensureLogin())) return;
      const b = e.currentTarget; b.disabled = true; b.textContent = "KI ändert …";
      try {
        const keys = ["name", "tagline", "kind", "style", "anim", "accent", "cta1", "cta1url", "cta2", "cta2url", "about", "servicesTitle", "services", "eventsTitle", "events", "gallery", "reviewsTitle", "reviews", "faq", "email", "phone", "whatsapp", "address", "social", "sections"];
        const cur = Object.fromEntries(keys.map((k) => [k, S[k]]));
        const r = await aiGen({ task: "website-aendern", json: true, maxTokens: 4000, instructions: `Ändere die Website-Daten genau nach dem Wunsch. Gib NUR die geänderten Felder als JSON zurück (gleiche Feldnamen). Listenfelder bleiben im Zeilenformat mit „ | “. Erlaubte style-Werte: ${Object.keys(STYLES).join(", ")}; anim: ${Object.keys(ANIMS).join(", ")}; accent als #rrggbb. Erfinde keine Bewertungen, Preise oder Fakten – nutze Platzhalter in [eckigen Klammern].`,
          input: `AKTUELL: ${JSON.stringify(cur)}\n\nWUNSCH: ${ta.value.trim()}` });
        const j = r.json || {}; let n = 0;
        for (const k of keys) if (j[k] !== undefined && k !== "reviews") { if (k === "sections" && typeof j.sections === "object") S.sections = { ...S.sections, ...j.sections }; else if (typeof j[k] === "string") S[k] = j[k].slice(0, 6000); n++; }
        if (j.reviews !== undefined) toast("Bewertungen ändert die KI nicht – nur echte Stimmen eintragen.", "info");
        save(); draw(); m.close(); toast(n ? `${n} Bereich(e) geändert${site ? " – „Online aktualisieren“ nicht vergessen" : ""}` : "Nichts geändert");
      } catch (er) { toastErr(er); b.disabled = false; b.textContent = "Ändern"; }
    } }, icon("sparkles"), "Ändern"))));
  ta.focus();
}

// KI baut die ganze Seite aus einer Beschreibung
async function aiAll(ta, btn) {
  const txt = ta.value.trim();
  if (txt.length < 10) return toast("Beschreib kurz, was für eine Seite du willst.", "info");
  if (!(await ensureLogin())) return;
  btn.disabled = true; btn.textContent = "KI baut deine Seite …";
  try {
    const r = await aiGen({ task: "website-komplett", json: true, maxTokens: 4500, instructions: `Baue aus der Beschreibung eine komplette One-Page-Website. Deutsch, professionell, lebendig. Nutze alle Angaben (Namen, DJs, Musikrichtung, Daten, Links). Erfinde KEINE Fakten, Preise, Termine oder Bewertungen – fehlt etwas, lass das Feld leer oder schreibe allgemein; Links nur, wenn sie in der Beschreibung stehen.
Antworte NUR mit JSON: {"name":"","tagline":"max 90 Zeichen","kind":"${Object.keys(KINDS).join("|")}","style":"${Object.keys(STYLES).join("|")}","anim":"sanft|dynamisch","accent":"#rrggbb oder leer","cta1":"","cta1url":"https://… oder #contact","cta2":"","cta2url":"","about":"2 Absätze","servicesTitle":"","services":"Zeilen: Titel | Beschreibung | Preis(optional)","eventsTitle":"","events":"Zeilen: Datum | Titel | Ort | Link | Button","mediaTitle":"","media":"Zeilen: Name | https-Link (Spotify, Instagram, TikTok, YouTube …)","faq":"Zeilen: Frage | Antwort","email":"","whatsapp":"","address":"","sections":{"about":true,"services":true,"events":true,"media":true,"gallery":false,"reviews":false,"faq":true,"contact":true}}`, input: txt.slice(0, 4000) });
    const j = r.json || {};
    for (const k of ["name", "tagline", "accent", "cta1", "cta1url", "cta2", "cta2url", "about", "servicesTitle", "services", "eventsTitle", "events", "mediaTitle", "media", "faq", "email", "whatsapp", "address"]) if (typeof j[k] === "string" && j[k].trim()) S[k] = j[k].slice(0, 6000);
    if (KINDS[j.kind]) S.kind = j.kind; if (STYLES[j.style]) S.style = j.style; if (ANIMS[j.anim]) S.anim = j.anim;
    if (j.sections && typeof j.sections === "object") S.sections = { ...S.sections, ...j.sections };
    save(); draw(); toast("Fertig! Rechts siehst du deine Seite – ändern kannst du alles im Formular oder mit „Mit KI ändern“.");
  } catch (e) { toastErr(e); btn.disabled = false; btn.textContent = "Seite bauen lassen"; }
}
// Aus einem Event übernehmen (Steckbrief-Formular) – nur mit Konto
async function fromEvent() {
  const { data } = await sb.auth.getSession();
  if (!data.session) return toast("Bitte im JOPML Nexus anmelden, um Events zu übernehmen.", "info");
  let admin = false; try { const r = await sb.rpc("cc_is_admin"); admin = r.data === true; } catch { /* */ }
  const evs = await q(sb.from(admin ? "cc_events" : "nx_events").select(admin ? "id,name,event_date,location,description,metadata" : "id,name,event_date,location,description,calc,ticket_price").order("event_date", { ascending: false }).limit(30)).catch(() => []);
  if (!evs.length) return toast("Keine Events gefunden.", "info");
  const m = modal("Aus Event übernehmen", h("div.list", evs.map((e) => h("button.list-item", { type: "button", style: { width: "100%", textAlign: "left" }, onclick: () => {
    const d = (admin ? e.metadata?.details : e.calc?.details) || {};
    const date = e.event_date ? new Date(e.event_date).toLocaleDateString("de-DE") : "";
    S.name = e.name; S.kind = "Event / Party";
    S.tagline = [d.genre, d.age, e.location?.split(",").slice(-1)[0]?.trim()].filter(Boolean).join(" · ").slice(0, 90) || S.tagline;
    S.about = String(e.description || "").replace(/[*#_]/g, "").slice(0, 1500) || S.about;
    if (d.lineup) { S.servicesTitle = "Line-up"; S.services = String(d.lineup).split("\n").filter(Boolean).map((x) => `${x.trim()} | ${d.genre || ""}`).join("\n"); }
    S.events = `${date}${d.start ? ` ${d.start}` : ""} | ${e.name} | ${d.venue || e.location || ""} | ${d.tickets || ""} | Tickets`;
    if (d.tickets) { S.cta1 = "Tickets"; S.cta1url = d.tickets; }
    S.media = [["Spotify", d.spotify], ["Instagram", d.instagram], ["TikTok", d.tiktok], ["WhatsApp-Gruppe", d.whatsapp]].filter((x) => x[1]).map((x) => `${x[0]} | ${x[1]}`).join("\n") || S.media;
    const faq = [d.age && ["Ab wie viel Jahren?", `${d.age}${d.u18 ? `, unter 18 bis ${d.u18} Uhr` : ""} – Ausweis mitbringen.`], d.entry && ["Wann ist Einlass?", `Ab ${d.entry} Uhr.`], d.wardrobe && ["Gibt es eine Garderobe?", `Ja, ${d.wardrobe} € pro Teil.`], d.payment && ["Kann ich mit Karte zahlen?", d.payment], d.address && ["Wo ist der Eingang?", d.address]].filter(Boolean);
    if (faq.length) S.faq = faq.map((x) => x.join(" | ")).join("\n");
    S.address = d.address || e.location || S.address;
    S.sections = { ...S.sections, events: true, media: !!S.media, faq: !!S.faq, services: !!S.services };
    save(); m.close(); draw(); toast("Event übernommen – prüfen und Impressum ausfüllen");
  } }, h("div.li-main", h("div.li-title", e.name), h("div.li-sub", [e.event_date ? new Date(e.event_date).toLocaleDateString("de-DE") : "", e.location].filter(Boolean).join(" · ")))))));
}
// Alle Designs mit deinem Inhalt als Mini-Vorschau
function designGallery() {
  const demo = S.name ? S : { ...S, name: "Deine Seite", tagline: "So sieht dein Inhalt in diesem Design aus", about: "Hier steht später dein Text.", services: "Angebot 1 | Kurze Beschreibung\nAngebot 2 | Kurze Beschreibung\nAngebot 3 | Kurze Beschreibung", cta1: "Los geht's", cta1url: "#contact" };
  const m = modal("Designs ansehen", h("div.bau-gallery", Object.entries(STYLES).map(([k, t]) => {
    return h("button.bau-thumb", { type: "button", class: S.style === k ? "on" : "", onclick: () => { S.style = k; S.accent = ""; save(); m.close(); draw(); } }, siteThumb(buildPro({ ...demo, style: k, accent: "", anim: "aus" }), "bau-thumb-frame"), h("b", t.name));
  })), { wide: true });
}

// ---------- Herunterladen / Online / Teilen
function download() {
  const miss = legalMissing(S);
  if (miss.length && !window.confirm(`Im Impressum fehlt noch: ${miss.join(", ")}. Trotzdem herunterladen?`)) return;
  const a = h("a", { href: URL.createObjectURL(new Blob([buildPro(S)], { type: "text/html" })), download: "index.html" });
  document.body.append(a); a.click(); a.remove(); toast("index.html geladen – jetzt bei einem Anbieter hochladen (siehe „Veröffentlichen“)");
}
function exportDraft() { const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify(S, null, 1)], { type: "application/json" })), download: `${slugify(S.name || "website")}.baukasten.json` }); document.body.append(a); a.click(); a.remove(); }
function importDraft() {
  const f = h("input", { type: "file", accept: ".json", onchange: async () => { try { const j = JSON.parse(await f.files[0].text()); S = { ...DEFAULTS, ...j, legal: { ...DEFAULTS.legal, ...(j.legal || {}) }, sections: { ...DEFAULTS.sections, ...(j.sections || {}) } }; save(); draw(); toast("Entwurf geladen"); } catch { toast("Datei nicht lesbar", "err"); } } });
  f.click();
}
async function publish() {
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  if (!u || u.is_anonymous) return modal("Online stellen", h("div.stack", h("p", "Für einen festen Link brauchst du ein kostenloses JOPML-Nexus-Konto (Anmeldung mit Google). Alternativ: Seite herunterladen und bei Netlify Drop hochladen – siehe „Veröffentlichen“."), h("a.btn.primary", { href: "./#/studio/web" }, "Anmelden")));
  const miss = legalMissing(S);
  if (miss.length) return toast(`Bitte erst das Impressum vervollständigen: ${miss.join(", ")}`, "info");
  try {
    const slug = site?.slug || `${slugify(S.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const row = { slug, title: (S.name || "Website").slice(0, 120), template: "custom", data: { pro: S }, html: buildPro({ ...S, host: "nexus" }, { hosted: true }), published: true };
    if (site?.id) await q(sb.from("nx_sites").update(row).eq("id", site.id));
    else site = { ...(await q(sb.from("nx_sites").insert(row).select("id,slug").single())) };
    const link = new URL(`w.html?s=${site.slug}`, location.href).href;
    try { history.replaceState(null, "", `?id=${site.id}`); } catch { /* */ }
    draw();
    modal("Online!", h("div.stack", h("p", "Deine Seite ist erreichbar unter:"), h("div.row", { style: { gap: "8px" } }, h("input.input", { value: link, readonly: true, "aria-label": "Link" }), h("button.btn", { onclick: () => copyText(link) }, icon("copy"))),
      h("p.muted", "Änderungen später einfach hier machen (oder „Mit KI ändern“) und „Online aktualisieren“ drücken – der Link bleibt gleich."), h("a.btn.primary", { href: link, target: "_blank", rel: "noopener" }, "Seite öffnen")));
  } catch (e) { toastErr(e); }
}
function hostingGuide() {
  const P = [
    ["Netlify Free", "0 €", "300 Credits/Monat (reicht für kleine Seiten), eigene Domain + SSL möglich. Ohne Git: „Netlify Drop“ – index.html einfach hineinziehen.", "https://app.netlify.com/drop"],
    ["Netlify Personal", "ca. 9 $/Monat", "Mehr Credits für viel Besucherverkehr.", "https://www.netlify.com/pricing/"],
    ["Cloudflare Pages", "0 €", "Kostenlos, schnell; Upload per Dashboard.", "https://pages.cloudflare.com/"],
    ["GitHub Pages", "0 €", "Kostenlos für private/Projekt-Seiten, braucht GitHub-Konto.", "https://pages.github.com/"],
    ["Nexus-Link", "0 €", "Ein Klick hier („Online stellen“), fester Link, jederzeit änderbar. Ohne eigene Domain.", null],
  ];
  const D = [["INWX", "ca. 0,50 €/Monat (≈ 6 €/Jahr)"], ["Hostinger", "ca. 1 € im 1. Jahr, danach ca. 12 €/Jahr"], ["IONOS", "ca. 1 € im 1. Jahr, danach ca. 15,60 €/Jahr"]];
  let host = 0, dom = false;
  const sum = h("div.evw-sums");
  const calc = () => { const c = [0, 108, 0, 0, 0][host] + (dom ? 12 : 0); sum.replaceChildren(h("span", "Dein Budget ca. ", h("b", `${c} € pro Jahr`)), h("span.faint", dom ? "(inkl. .de-Domain ca. 6–16 €/Jahr)" : "(ohne eigene Domain)")); };
  modal("Veröffentlichen – Anbieter & Kosten", h("div.stack",
    h("p.muted", { style: { margin: 0 } }, "Preise: Stand November 2026, laut Anbieterseiten und Vergleichsportalen – bitte vor dem Buchen beim Anbieter prüfen."),
    h("div.list", P.map(([n, p, d, u], i) => h("label.list-item", { style: { alignItems: "flex-start" } }, h("input", { type: "radio", name: "host", checked: i === host, onchange: () => { host = i; calc(); } }),
      h("div.li-main", h("div.li-title", n, " · ", h("b", p)), h("div.li-sub", { style: { whiteSpace: "normal" } }, d)), u ? h("a.btn.sm.ghost", { href: u, target: "_blank", rel: "noopener" }, "Öffnen") : null))),
    h("label.check", h("input", { type: "checkbox", onchange: (e) => { dom = e.target.checked; calc(); } }), "Eigene Domain (z. B. deinname.de)"), sum,
    h("details", h("summary", h("b", ".de-Domain – Beispielpreise")), h("ul", D.map(([n, p]) => h("li", `${n}: ${p}`))), h("p.faint", "Achte auf den Preis ab dem 2. Jahr. Danach im Hosting-Anbieter unter „Domain“ verbinden.")),
    h("details", { open: true }, h("summary", h("b", "So geht's mit Netlify Drop (5 Minuten)")), h("ol",
      h("li", "Oben „Herunterladen“ → du bekommst index.html."), h("li", "app.netlify.com/drop öffnen, kostenlos anmelden."), h("li", "index.html in das Feld ziehen – fertig, du bekommst sofort einen Link."),
      h("li", "Optional: unter „Domain management“ deine eigene Domain verbinden."), h("li", "In den Baukasten-Einstellungen „Hosting“ auf Netlify lassen – dann passt die Datenschutzerklärung."))),
    h("p.faint", "Wichtig: Impressum und Datenschutzerklärung sind Vorlagen – keine Rechtsberatung. Bei geschäftlichen Seiten im Zweifel prüfen lassen.")));
  calc();
}

// ---------- Seite zeichnen
function draw() {
  const kindSel = h("select.input", { "aria-label": "Art der Seite", onchange: (e) => { S.kind = e.target.value; const k = KINDS[S.kind]; if (k) { S.servicesTitle = k.servicesTitle; S.eventsTitle = k.eventsTitle; if (!S.cta1) S.cta1 = k.cta1; S.sections = { ...S.sections, ...k.sections }; } save(); draw(); } }, Object.keys(KINDS).map((k) => h("option", { selected: S.kind === k }, k)));
  const styleChips = h("div.row.wrap", { style: { gap: "6px" } }, Object.entries(STYLES).map(([k, t]) => h("button.chip", { type: "button", class: S.style === k ? "on" : "", onclick: () => { S.style = k; S.accent = ""; save(); draw(); } },
    h("span", { style: { display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: `linear-gradient(135deg,${t.a},${t.b})`, marginRight: "6px" } }), t.name)));
  const animChips = h("div.row.wrap", { style: { gap: "6px" } }, Object.entries(ANIMS).map(([k, t]) => h("button.chip", { type: "button", class: S.anim === k ? "on" : "", onclick: () => { S.anim = k; save(); draw(); } }, t)));
  const hostSel = h("select.input", { "aria-label": "Hosting", onchange: (e) => { S.host = e.target.value; save(); refresh(); } }, Object.entries(HOSTS).map(([k, v]) => h("option", { value: k, selected: S.host === k }, v.name)));
  const form = h("div.stack.bau-form",
    h("section.card.bau-ai", h("div.card-body.stack", { style: { gap: "8px" } }, h("b.row", { style: { gap: "6px" } }, icon("sparkles"), "Sag der KI, was du willst"),
      (() => { const ta = h("textarea.input", { rows: 3, maxlength: 4000, "aria-label": "Beschreibung für die KI", placeholder: "z. B. „Seite für meine Techno-Party Raveanation am 9.1. in Berlin, DJ SHEVNØ1, Industrial & Hardgroove, 16+, Tickets: https://eventfrog.de/RAVENATION, Instagram: https://instagram.com/raveanation – dunkel mit Neon und Animationen“" });
        const b = h("button.btn.primary", { onclick: () => aiAll(ta, b) }, icon("sparkles"), "Seite bauen lassen");
        return h("div.stack", { style: { gap: "8px" } }, ta, h("div.row.wrap", { style: { gap: "8px" } }, b, h("button.btn", { onclick: designGallery }, icon("eye"), "Designs ansehen"), h("button.btn", { onclick: fromEvent }, icon("calendar"), "Aus meinem Event"))); })())),
    group("1 · Grundlagen", true, h("div.field", h("label", "Art der Seite"), kindSel), inp("name", "Name / Titel"), inp("tagline", "Slogan (eine Zeile)"),
      h("div.grid.g-2", inp("cta1", "Haupt-Button Text"), inp("cta1url", "Haupt-Button Link", { ph: "https://… oder #contact" })), h("div.grid.g-2", inp("cta2", "Zweiter Button"), inp("cta2url", "Zweiter Button Link"))),
    group("2 · Design & Animation", true, styleChips, h("div.field", h("label", "Eigene Akzentfarbe"), h("input", { type: "color", value: S.accent || STYLES[S.style].a, "aria-label": "Akzentfarbe", oninput: (e) => { S.accent = e.target.value; save(); refresh(); } })), animChips),
    group("3 · Inhalte", true,
      h("div.row.wrap", { style: { gap: "10px" } }, toggle("about", "Über uns"), toggle("services", S.servicesTitle), toggle("events", S.eventsTitle), toggle("media", "Musik & Social"), toggle("gallery", "Galerie"), toggle("reviews", "Bewertungen"), toggle("faq", "FAQ"), toggle("contact", "Kontakt")),
      inp("about", "Über uns", { area: true, ph: "Stichworte reichen – die KI kann daraus Text machen" }),
      inp("servicesTitle", "Überschrift Angebot"), inp("services", "Angebot / Line-up / Leistungen", { area: true, ph: "Eine Zeile pro Eintrag: Titel | Beschreibung | Preis (optional)" }),
      inp("eventsTitle", "Überschrift Termine"), inp("events", "Termine", { area: true, ph: "Datum | Titel | Ort | Ticket-Link (https://…) | Button-Text" }),
      inp("mediaTitle", "Überschrift Musik & Social"), inp("media", "Musik & Social (Spotify, Instagram, TikTok, YouTube …)", { area: true, rows: 3, ph: "Spotify | https://open.spotify.com/…\nInstagram | https://instagram.com/…", hint: "Wird als schöne Karten angezeigt. Mit „Player einbetten“ spielen Spotify/YouTube/SoundCloud direkt auf der Seite (nur in der heruntergeladenen Version; Hinweis kommt automatisch in die Datenschutzerklärung)." }),
      h("label.check", h("input", { type: "checkbox", checked: !!S.embed, onchange: (e) => { S.embed = e.target.checked; save(); refresh(); } }), "Player einbetten (Spotify, YouTube, SoundCloud)"),
      inp("gallery", "Galerie (Bild-Links)", { area: true, rows: 3, ph: "https://…/bild.jpg | Bildunterschrift", hint: "Nur Bilder, an denen du die Rechte hast und auf denen erkennbare Personen eingewilligt haben (§ 22 KunstUrhG)." }),
      inp("reviewsTitle", "Überschrift Bewertungen"), inp("reviews", "Bewertungen (nur echte!)", { area: true, rows: 3, ph: "Name | Sterne 1–5 | Text", hint: "Nur echte Stimmen mit Erlaubnis der Person eintragen – erfundene Bewertungen sind unzulässig." }),
      inp("faq", "Häufige Fragen", { area: true, ph: "Frage | Antwort" })),
    group("4 · Kontakt & Social", false, h("div.grid.g-2", inp("email", "E-Mail", { type: "email" }), inp("phone", "Telefon")), h("div.grid.g-2", inp("whatsapp", "WhatsApp-Nummer", { ph: "49170…" }), inp("address", "Adresse (Karte)")),
      inp("social", "Social Media", { area: true, rows: 3, ph: "Instagram | https://instagram.com/…" })),
    group("5 · Impressum & Datenschutz", false, h("p.faint", { style: { margin: 0, fontSize: "13px" } }, "Pflicht für geschäftsmäßige Seiten (§ 5 DDG). Wird automatisch als „Impressum“ und „Datenschutz“ unten verlinkt. Vorlage – keine Rechtsberatung."),
      inp("legal.name", "Name / Firma"), inp("legal.street", "Straße und Hausnummer"), inp("legal.city", "PLZ und Ort"), h("div.grid.g-2", inp("legal.email", "E-Mail"), inp("legal.phone", "Telefon (optional)")),
      inp("legal.responsible", "Verantwortlich für den Inhalt (falls anders)"), h("div.grid.g-2", inp("legal.vat", "USt-IdNr. (falls vorhanden)"), inp("legal.register", "Register (falls vorhanden)")),
      h("div.field", h("label", "Wo wird die Seite gehostet? (für die Datenschutzerklärung)"), hostSel)),
  );
  const bar = h("div.bau-bar",
    h("button.btn", { onclick: (e) => aiTexts(e.currentTarget) }, icon("sparkles"), "KI-Texte"), h("button.btn", { onclick: aiChange }, icon("sparkles"), "Mit KI ändern"),
    h("button.btn.primary", { onclick: download }, icon("download"), "Herunterladen"), h("button.btn", { onclick: hostingGuide }, icon("globe"), "Veröffentlichen"),
    h("button.btn", { onclick: publish }, icon("upload"), site ? "Online aktualisieren" : "Online stellen"),
    h("button.btn.ghost", { onclick: () => modal("Mehr", h("div.stack", h("button.btn", { onclick: exportDraft }, icon("download"), "Entwurf speichern (.json)"), h("button.btn", { onclick: importDraft }, icon("upload"), "Entwurf öffnen (.json)"),
      h("button.btn", { onclick: () => copyText(new URL("bau.html", location.href).href) }, icon("copy"), "Link zum Baukasten kopieren"),
      h("button.btn.ghost", { onclick: () => { if (window.confirm("Alles leeren und neu anfangen?")) { S = window.structuredClone(DEFAULTS); site = null; save(); history.replaceState(null, "", "bau.html"); draw(); } } }, icon("trash"), "Neu anfangen"))) }, "Mehr"));
  const dev = h("div.row", { style: { gap: "6px" } }, [["desk", "Computer"], ["phone", "Handy"]].map(([k, t]) => h("button.chip", { type: "button", class: device === k ? "on" : "", onclick: () => { device = k; draw(); } }, t)));
  frame.className = `bau-frame ${device}`;
  root.replaceChildren(h("div.bau",
    h("header.bau-head", h("a", { href: "./", style: { color: "inherit", textDecoration: "none" } }, h("b", "JOPML Nexus")), h("span.faint", " · Website-Baukasten"), h("span.spacer"), dev),
    h("div.bau-main", h("div.bau-left", h("h1", { style: { margin: "0 0 4px", fontSize: "24px" } }, "Deine Website in 5 Minuten"),
      h("p.muted", { style: { margin: "0 0 12px" } }, "Formular ausfüllen, Design wählen, rechts siehst du sofort das Ergebnis. Mit Impressum & Datenschutz. Kostenlos herunterladen oder online stellen."),
      warnBox, form), h("div.bau-right", bar, frame))));
  refresh();
}

(async () => {
  const id = params.get("id");
  if (id && /^[0-9a-f-]{36}$/.test(id)) {
    try { const r = await q(sb.from("nx_sites").select("id,slug,data").eq("id", id).single()); if (r?.data?.pro) { S = { ...DEFAULTS, ...r.data.pro, legal: { ...DEFAULTS.legal, ...(r.data.pro.legal || {}) }, sections: { ...DEFAULTS.sections, ...(r.data.pro.sections || {}) } }; site = { id: r.id, slug: r.slug }; save(); } }
    catch (e) { toast(`Seite konnte nicht geladen werden: ${errMsg(e)}`, "err"); }
  }
  draw();
})();
