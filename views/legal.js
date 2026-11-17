// Rechtsseiten (öffentlich, auch ohne Anmeldung): Impressum, Datenschutz, AGB, Inhalte & Melden, KI, Cookies, Barrierefreiheit, Melden-Formular.
// Texte in lib/legaltexts.js; Angaben (Name, Anschrift, E-Mail) trägt der Betreiber in Einstellungen › Rechtliches ein – Fehlendes ist markiert.
import { rpc } from "../lib/api.js";
import { h, icon, toast } from "../lib/ui.js";
import { CONFIG } from "../config.js";
import { TEXTS, LEGAL_ORDER, LEGAL_TITLES } from "../lib/legaltexts.js";

export const LEGAL_PAGES = { ...LEGAL_TITLES, melden: "Inhalte melden", nutzung: "Nutzungsbedingungen" };
const ALIAS = { nutzung: "agb" };
const STAND = "17. November 2026";

let cache = null;
async function legalData() { if (cache) return cache; try { cache = (await rpc("cc_legal")) || {}; } catch { cache = {}; } return cache; }

function fill(text, L) {
  const map = { name: L.name, address: L.address, address_inline: L.address ? String(L.address).replace(/\n/g, ", ") : "", email: L.email, phone_line: L.phone ? `Telefon: ${L.phone}` : "",
    responsible: L.responsible || L.name, app: CONFIG.appName, url: location.origin + location.pathname };
  const labels = { name: "Name/Firma", address: "Anschrift", address_inline: "Anschrift", email: "E-Mail", responsible: "Verantwortliche Person" };
  const parts = String(text).split(/(\{\{\w+\}\})/);
  const out = parts.map((p) => { const m = p.match(/^\{\{(\w+)\}\}$/); if (!m) return p; const v = map[m[1]];
    if (v) return m[1] === "address" ? String(v).split("\n").flatMap((x, i) => (i ? [h("br"), x] : [x])) : String(v);
    return m[1] === "phone_line" ? "" : h("span.gap", `[${labels[m[1]] || m[1]} fehlt]`); }).flat();
  return out.every((x) => x === "") ? null : out;
}
const para = (item, L) => (typeof item === "string" ? (() => { const f = fill(item, L); return f ? h("p", f) : null; })() : item.ul ? h("ul", item.ul.map((li) => h("li", fill(li, L)))) : null);

function reportPage(L) {
  const f = (name, label, el) => { el.setAttribute("aria-label", label); el.name = name; return h("div.field", h("label", label), el); };
  const url = h("input.input", { placeholder: "https://… (Link zum Inhalt)", maxlength: 500 });
  const why = h("textarea.input", { rows: 5, maxlength: 4000, placeholder: "Warum ist der Inhalt rechtswidrig? Welche Vorschrift oder welches Recht wird verletzt?" });
  const who = h("input.input", { placeholder: "Dein Name", maxlength: 120 });
  const mail = h("input.input", { type: "email", placeholder: "deine@email.de", maxlength: 200 });
  const kind = h("select.input", ["Urheberrecht / Bildrechte", "Persönlichkeitsrecht / private Daten", "Beleidigung, Bedrohung, Hassrede", "Betrug / Phishing / Fake-Tickets", "Jugendschutz", "Darstellung sexuellen Missbrauchs von Kindern", "Sonstiges"].map((x) => h("option", x)));
  const ok = h("input", { type: "checkbox", style: { width: "18px", height: "18px" } });
  const send = () => {
    if (!url.value.trim() || why.value.trim().length < 20) return toast("Bitte Link und eine Begründung (mind. 20 Zeichen) angeben.", "err");
    const csam = /Kindern/.test(kind.value);
    if (!csam && (!who.value.trim() || !/@/.test(mail.value))) return toast("Bitte Name und E-Mail angeben (Art. 16 Abs. 2 DSA).", "err");
    if (!ok.checked) return toast("Bitte die Richtigkeit der Angaben bestätigen.", "err");
    if (!L.email) return toast("Es ist noch keine Kontakt-E-Mail hinterlegt – bitte über das Impressum melden.", "err");
    const body = `MELDUNG NACH ART. 16 DSA\n\nArt: ${kind.value}\nFundstelle: ${url.value.trim()}\n\nBegründung:\n${why.value.trim()}\n\nName: ${who.value.trim() || "–"}\nE-Mail: ${mail.value.trim() || "–"}\n\nIch erkläre in gutem Glauben, dass die Angaben richtig und vollständig sind.\nGesendet über ${location.origin + location.pathname}#/melden am ${new Date().toLocaleString("de-DE")}`;
    location.href = `mailto:${encodeURIComponent(L.email)}?subject=${encodeURIComponent(`Meldung: ${kind.value}`)}&body=${encodeURIComponent(body)}`;
    toast("Dein E-Mail-Programm öffnet sich – bitte dort absenden.");
  };
  return [h("p", "Hier meldest du Inhalte, die du für rechtswidrig hältst – z. B. auf geteilten Links oder veröffentlichten Seiten. Wir bestätigen den Eingang, prüfen sorgfältig und informieren dich über das Ergebnis (Art. 16 DSA)."),
    h("div.stack", { style: { gap: "10px", maxWidth: "640px" } }, f("kind", "Worum geht es?", kind), f("url", "Link oder Fundstelle", url), f("why", "Begründung", why),
      h("div.grid.g-2", f("who", "Dein Name", who), f("mail", "Deine E-Mail", mail)),
      h("label.check", ok, "Ich erkläre in gutem Glauben, dass meine Angaben richtig und vollständig sind."),
      h("div.row", h("button.btn.primary", { onclick: send }, icon("send"), "Meldung senden")),
      h("p.faint", { style: { fontSize: "12.5px" } }, "Die Meldung wird als E-Mail an die Kontaktstelle aus dem Impressum vorbereitet. Bei Meldungen zu Darstellungen sexuellen Missbrauchs von Kindern sind Name und E-Mail freiwillig; wende dich in akuten Fällen auch direkt an die Polizei oder an jugendschutz.net."))];
}

export async function legalPage(kind0) {
  const kind = ALIAS[kind0] || kind0;
  const L = await legalData();
  const T = TEXTS[kind];
  const title = T ? T.title : LEGAL_PAGES[kind] || "Rechtliches";
  const toc = T && T.sections.length > 5 ? h("nav.legal-toc", h("b", "Inhalt"), h("ol", T.sections.map(([t], i) => h("li", h("a", { href: `#/${kind0}`, onclick: (e) => { e.preventDefault(); document.getElementById(`lg-${i}`)?.scrollIntoView({ behavior: "smooth" }); } }, t))))) : null;
  const body = T ? [T.intro ? h("p.lead", fill(T.intro, L)) : null, toc, ...T.sections.flatMap(([t, items], i) => [h("h2", { id: `lg-${i}` }, t), ...items.map((x) => para(x, L))])]
    : kind === "melden" ? reportPage(L) : [h("p", "Seite nicht gefunden.")];
  document.title = `${title} · ${CONFIG.appName}`;
  return h("div.legal",
    h("div.crumb", h("a", { href: "#/" }, "Zurück"), icon("chevronR"), h("span", title)),
    h("div.row.between.legal-print", { style: { flexWrap: "wrap", gap: "8px" } }, h("h1", { style: { margin: 0 } }, title), h("button.btn.sm.ghost", { onclick: () => window.print() }, icon("file"), "Drucken / als PDF")),
    ...body,
    kind === "impressum" || kind === "datenschutz" ? h("div.banner", { style: { marginTop: "18px" } }, icon("info"), h("div", "Du brauchst Impressum und Datenschutzerklärung für deine eigene Website? Der ", h("a", { href: "bau.html" }, "Website-Baukasten"), " erzeugt beides passend zu deiner Seite.")) : null,
    h("p.faint", { style: { marginTop: "30px", fontSize: "12.5px" } }, `Stand: ${STAND}${L.updated ? ` · Angaben aktualisiert am ${new Date(L.updated).toLocaleDateString("de-DE")}` : ""}. Diese Texte sind sorgfältig erstellte Muster und ersetzen keine anwaltliche Beratung im Einzelfall.`),
    legalLinks());
}

export const legalLinks = () => h("div.footer-links", [...LEGAL_ORDER, "melden"].map((k) => h("a", { href: `#/${k}` }, LEGAL_PAGES[k])));

export default ({ args }) => legalPage(args[0]);
