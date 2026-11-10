// Rechtsseiten (öffentlich, auch ohne Anmeldung): Impressum, Datenschutz, Nutzungsbedingungen.
// Vorlagen – die Angaben (Name, Anschrift, E-Mail) trägt der Betreiber in Einstellungen › Rechtliches ein. Fehlende Angaben sind markiert.
import { rpc } from "../lib/api.js";
import { h, icon } from "../lib/ui.js";
import { CONFIG } from "../config.js";

export const LEGAL_PAGES = { impressum: "Impressum", datenschutz: "Datenschutzerklärung", nutzung: "Nutzungsbedingungen" };

export async function legalPage(kind) {
  let L = {};
  try { L = (await rpc("cc_legal")) || {}; } catch { /* ohne Angaben */ }
  const v = (k, label) => L[k] ? String(L[k]) : h("span.gap", `[${label} fehlt]`);
  const lines = (k, label) => L[k] ? String(L[k]).split("\n").map((x, i) => [i ? h("br") : null, x]).flat() : [h("span.gap", `[${label} fehlt]`)];
  const sec = (t, ...c) => [h("h2", t), ...c];
  const date = L.updated ? new Date(L.updated).toLocaleDateString("de-DE") : null;
  let body;
  if (kind === "impressum") body = [
    h("p", "Angaben gemäß § 5 DDG"),
    h("p", v("name", "Name/Firma"), h("br"), ...lines("address", "Anschrift")),
    ...sec("Kontakt", h("p", "E-Mail: ", v("email", "E-Mail"), L.phone ? [h("br"), "Telefon: ", L.phone] : null)),
    ...sec("Verantwortlich für den Inhalt (§ 18 Abs. 2 MStV)", h("p", v("responsible", "Verantwortliche Person"), h("br"), ...lines("address", "Anschrift"))),
    ...sec("Haftung für Inhalte und Links", h("p", "Die Inhalte dieser Anwendung wurden mit Sorgfalt erstellt. Für Inhalte externer Links, die Nutzer selbst verknüpfen, sind ausschließlich deren Betreiber verantwortlich.")),
  ];
  else if (kind === "datenschutz") body = [
    ...sec("1. Verantwortlicher", h("p", v("name", "Name/Firma"), h("br"), ...lines("address", "Anschrift"), h("br"), "E-Mail: ", v("email", "E-Mail"))),
    ...sec("2. Welche Daten verarbeitet werden",
      h("ul",
        h("li", h("strong", "Anmeldung: "), "Google-Konto (E-Mail, Name, Profilbild) über Supabase Auth – nur zur Anmeldung und Zuordnung deiner Daten."),
        h("li", h("strong", "Deine Inhalte: "), "Projekte, Events, Notizen und Dateien, die du anlegst oder importierst."),
        h("li", h("strong", "Verbindungen: "), "API-Schlüssel, die du freiwillig einfügst – verschlüsselt gespeichert (Supabase Vault), nur serverseitig zum Abruf deiner eigenen Daten verwendet, beim Trennen gelöscht."),
        h("li", h("strong", "KI-Assistent: "), "Deine Frage und eine Zusammenfassung deiner Projekte werden zur Beantwortung an den KI-Anbieter (Google Gemini bzw. Groq; bei eigenem Schlüssel an deinen Anbieter) gesendet. Gespeichert wird nur die Anzahl der Fragen pro Tag."),
        h("li", h("strong", "Technisch: "), "Server-Protokolle des Hosters (IP-Adresse, Zeitpunkt) zur Sicherheit; keine Werbe- oder Tracking-Cookies. Einstellungen wie Farbe/Theme liegen nur in deinem Browser."))),
    ...sec("3. Rechtsgrundlagen", h("p", "Art. 6 Abs. 1 lit. b DSGVO (Bereitstellung der von dir genutzten Funktionen) und lit. f (Sicherheit des Betriebs). Das Einfügen von API-Schlüsseln und die Nutzung der KI sind freiwillig.")),
    ...sec("4. Empfänger / Auftragsverarbeiter", h("p", "Supabase (Datenbank, Anmeldung, Speicher; Region eu-central-1), GitHub Pages (Auslieferung der Website), Google (Anmeldung, Gemini-KI), Groq (KI). Bei verbundenen Diensten (z. B. Netlify, GitHub, Eventfrog) werden nur Daten von dort abgerufen.")),
    ...sec("5. Speicherdauer", h("p", "Solange dein Konto besteht bzw. bis du die Daten löschst. Unter „Einstellungen › Meine Daten löschen“ entfernst du alle Projekte, Verbindungen und Schlüssel sofort.")),
    ...sec("6. Deine Rechte", h("p", "Auskunft, Berichtigung, Löschung, Einschränkung, Datenübertragbarkeit und Widerspruch (Art. 15–21 DSGVO) sowie Beschwerde bei einer Datenschutz-Aufsichtsbehörde. Kontakt: ", v("email", "E-Mail"), ".")),
  ];
  else body = [
    ...sec("1. Leistung", h("p", `${CONFIG.appName} ist ein persönliches Control Center zum Verwalten eigener Projekte, Verbindungen und Events. Die Nutzung ist kostenlos und ohne Anspruch auf Verfügbarkeit.`)),
    ...sec("2. Pflichten", h("p", "Verbinde nur Konten und Schlüssel, die dir gehören oder für die du berechtigt bist. Keine rechtswidrigen Inhalte, keine Versuche, auf fremde Daten zuzugreifen oder den Dienst zu stören.")),
    ...sec("3. KI-Antworten", h("p", "Antworten des KI-Assistenten können Fehler enthalten und sind keine Rechts-, Steuer- oder Finanzberatung. Prüfe wichtige Angaben selbst.")),
    ...sec("4. Teilen", h("p", "Wer Inhalte teilt, entscheidet selbst, wer sie sieht, und kann Freigaben jederzeit beenden.")),
    ...sec("5. Kündigung", h("p", "Du kannst deine Daten jederzeit löschen. Bei Missbrauch kann der Zugang gesperrt werden.")),
  ];
  return h("div.legal",
    h("div.crumb", h("a", { href: "#/" }, "Zurück"), icon("chevronR"), h("span", LEGAL_PAGES[kind])),
    h("h1", LEGAL_PAGES[kind]), ...body,
    date ? h("p.faint", { style: { marginTop: "30px", fontSize: "12.5px" } }, `Stand: ${date}`) : null,
    legalLinks());
}

export const legalLinks = () => h("div.footer-links", Object.entries(LEGAL_PAGES).map(([k, t]) => h("a", { href: `#/${k}` }, t)));

export default ({ args }) => legalPage(args[0]);
