// #/help – Handbuch: jede Funktion kurz und einfach erklärt, mit Suche und direkten Links
import { h, icon } from "../lib/ui.js";
import { openAssistant } from "../lib/actions.js";

// [Titel, Link, Symbol, Kurz, Schritte[]]
const BOOK = [
  ["Erste Schritte", [
    ["Dashboard", "#/", "dashboard", "Die Startseite zeigt alles Wichtige auf einen Blick.",
      ["Oben steht „Als Nächstes wichtig“: überfällige Aufgaben, Fehler und das nächste Event.", "Mit dem Umschalter „Zahlen / Diagramme“ wählst du die Darstellung.", "Die Sync-Zentrale holt mit „Alles jetzt abrufen“ sofort frische Daten."]],
    ["Suche und Tastenkürzel", null, "search", "Mit Strg K (oder dem Suchfeld oben) findest du Projekte, Aufgaben, Dateien, Events, Links und Seiten.",
      ["„/“ öffnet die Suche, „n“ die Schnellaktionen, „a“ den KI-Assistenten.", "„g“ und danach „e“ springt zu Events, „g“ „p“ zu Projekten, „g“ „s“ zu Servern."]],
    ["KI-Assistent", null, "bot", "Der Roboter oben rechts beantwortet Fragen, sucht bei unbekannten Problemen im Internet und merkt sich Lösungen.",
      ["Frage einfach in normalen Worten, z. B. „Warum ist meine Website offline?“.", "Mit Daumen hoch/runter lernt er, was geholfen hat.", "Schlüssel, die du in den Chat einfügst, werden erkannt, verbunden und nie im Verlauf gespeichert."]],
  ]],
  ["Planung", [
    ["Aufgaben", "#/tasks", "check", "Alle Aufgaben aus allen Projekten und Events an einem Ort.",
      ["„Neue Aufgabe“ legt eine eigene Aufgabe mit Frist an.", "Aufgaben aus Events und Checklisten aus Projekten erscheinen automatisch – Abhaken wirkt überall.", "24 Stunden vor der Frist kommt eine Erinnerung.", "„Kalender-Abo“ bringt alle Termine in den Kalender deines Handys."]],
    ["Events", "#/events", "calendar", "Ein Event bündelt Aufgaben, Zeitplan, Kosten, Einnahmen, Gäste, Schichten und Tickets.",
      ["Kosten: „Geplant“ ist der Plan, „Tatsächlich“ der echte Betrag; „bezahlt“ abhaken, wenn überwiesen.", "Die Karte „Abrechnung“ zeigt Plan gegen Ist und ab wie vielen Tickets die Kosten gedeckt sind.", "„Schichtplan“ teilt Helfer ein, „Posting-Plan“ plant Beiträge mit Erinnerung.", "Eventfrog-Tickets werden automatisch alle 10 Minuten abgerufen."]],
    ["Abendkasse", null, "ticket", "Am Abend selbst: Barverkauf zählen, Wechselgeld rechnen, Gäste abhaken, Auslastung sehen.",
      ["Im Event auf „Abendkasse“ tippen.", "„+1 Ticket“ bucht einen Barverkauf, „Wechselgeld“ rechnet das Rückgeld aus.", "Die Anzeige „Jetzt drin“ warnt, bevor die erlaubte Personenzahl erreicht ist.", "Für Helfer: im Event „Teilen“ › Link mit Recht „Abendkasse“ – läuft auf deren Handy ohne Konto."]],
    ["Teilen & Team", "#/shares", "users", "Gib Events, Projekte oder Dateien per Link oder E-Mail frei.",
      ["„Nur ansehen“, „Aufgaben abhaken“, „Mitarbeiten“ (Aufgaben, Schichten, Gäste anlegen) oder „Abendkasse“.", "Mitveranstalter können Kommentare schreiben – du bekommst eine Benachrichtigung.", "Freigaben lassen sich jederzeit widerrufen oder mit Ablaufdatum versehen."]],
    ["Projekte und Dateien", "#/projects", "folder", "Jedes Projekt hat Module (Übersicht, Notizen, Links, Dateien).",
      ["Aus jedem Claude-Chat kannst du mit „ins Nexus“ ein Projekt mit Diagrammen anlegen lassen.", "Doppelte Projekte erkennt die Sync-Zentrale und führt sie auf Knopfdruck zusammen."]],
  ]],
  ["Betrieb", [
    ["Websites", "#/web", "globe", "Besucher live, Erreichbarkeit und Netlify-Daten deiner Websites.",
      ["Der Besucherzähler arbeitet ohne Cookies.", "Fällt eine Website aus, bekommst du sofort eine Nachricht."]],
    ["Marketing-Links", "#/links", "link", "Für jeden Kanal ein eigener Kurzlink – so siehst du, was Besucher bringt.",
      ["„Neuer Link“: Ziel (z. B. Ticketseite), Kanal und Kurzname wählen.", "Den Link in die Instagram-Bio, in TikTok oder als QR-Code auf den Flyer setzen.", "Die Seite zeigt Klicks pro Tag und pro Kanal."]],
    ["Geräte & Hosting", "#/hosting", "server", "Eigene Geräte (PC, Raspberry Pi, Server) verbinden, Daten sehen, Dateien abrufen und Websites oder Apps darauf betreiben.",
      ["„Gerät verbinden“ zeigt fertige Befehle für Windows und Linux/Raspberry Pi.", "Danach siehst du Auslastung, Temperatur, Laufwerke und Prozesse live.", "„Dateien“ auf der Geräteseite: Ordner durchsehen, Dateien herunterladen oder aufs Gerät legen.", "„App hosten“: Vorlage wählen (Website-Ordner, Minecraft, Node …) – Start/Stopp/Log von überall.", "Sicherheit: Dateizugriff und eigene Befehle müssen auf dem Gerät selbst erlaubt werden; versteckte Dateien und Schlüssel sind immer gesperrt."]],
    ["JOPML", "#/jopml", "layers", "Nutzer, Fehler, Tickets und KI-Verbrauch deines Launchers.",
      ["Die „Release-Checkliste“ führt dich Schritt für Schritt durch ein Update."]],
  ]],
  ["Sicherheit", [
    ["Push aufs Handy", "#/security", "bell", "Wichtige Meldungen als Push-Nachricht – auch wenn das Nexus zu ist.",
      ["Unter „Sicherheit & Push“ einschalten.", "Kostenlose App „ntfy“ installieren und das angezeigte Thema abonnieren.", "„Test senden“ prüft, ob es ankommt.", "Jeden Morgen kommt eine Tagesübersicht."]],
    ["Sicherung", "#/security", "download", "Jede Nacht wird automatisch gesichert; die letzten 10 Sicherungen kannst du herunterladen.",
      ["„Jetzt sichern“ erstellt sofort eine Sicherung.", "Die Datei sicher aufbewahren – sie enthält deine Freigabe-Links."]],
    ["Anmeldungen und Schlüssel", "#/security", "key", "Jede Anmeldung wird protokolliert; bei einem neuen Gerät kommt eine Warnung.",
      ["Schlüssel, die älter als 90 Tage sind, werden markiert.", "Schlüssel, die einmal in einem Chat standen, bitte erneuern."]],
  ]],
];

export default async function helpView() {
  const inp = h("input.input", { placeholder: "Im Handbuch suchen … (z. B. Wechselgeld, Raspberry Pi, Kalender)", "aria-label": "Handbuch durchsuchen", style: { maxWidth: "520px" } });
  const body = h("div.stack", { style: { gap: "18px" } });
  function draw() {
    const s = inp.value.trim().toLowerCase();
    const groups = BOOK.map(([g, items]) => [g, items.filter(([t, , , short, steps]) => !s || [t, short, ...steps].join(" ").toLowerCase().includes(s))]).filter(([, i]) => i.length);
    body.replaceChildren(...(groups.length ? groups.map(([g, items]) => h("section", h("h3", { style: { margin: "0 0 10px", fontSize: "13px", letterSpacing: ".06em", textTransform: "uppercase", color: "var(--text-3)" } }, g),
      h("div.grid.g-2", { style: { alignItems: "start" } }, items.map(([t, href, ic, short, steps]) => h("details.card.help-card", { open: !!s },
        h("summary", h("div.li-icon", icon(ic)), h("div", h("div.li-title", t), h("div.li-sub", short))),
        h("ol", steps.map((x) => h("li", x))),
        href ? h("a.btn.sm", { href }, "Öffnen", icon("chevronR")) : null)))))
      : [h("div.card.card-pad", h("p", { style: { margin: "0 0 10px" } }, "Dazu steht nichts im Handbuch."), h("button.btn.primary", { onclick: () => openAssistant() }, icon("bot"), "Den KI-Assistenten fragen"))]));
  }
  inp.addEventListener("input", draw);
  draw();
  return h("div", h("div.page-head", h("div", h("h1", "Handbuch"), h("p", "Jede Funktion kurz erklärt. Antippen zum Aufklappen.")),
    h("div.actions", h("button.btn", { onclick: () => openAssistant() }, icon("bot"), "KI fragen"))), h("div", { style: { marginBottom: "16px" } }, inp), body);
}
