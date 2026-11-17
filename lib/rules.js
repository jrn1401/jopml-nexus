// Projekt-Bogen: Fragen je Projektart + Regel-Check (Rechtliches, Organisation, Marketing).
// Läuft komplett im Browser – kostet keinen Server. Normen geprüft am Wortlaut (Stand Nov. 2026, zitierfest.de).
// Hinweis für Nutzer: Orientierung, keine Rechtsberatung.

const Z = (law, p) => `https://zitierfest.de/gesetze/${law}/${p}`;

export const TYPES = [
  ["event", "Event / Party", "calendar"], ["website", "Website", "external"], ["shop", "Online-Shop / Verkauf", "wallet"],
  ["school", "Schule / Lernen", "book"], ["business", "Selbstständig / Business", "zap"], ["software", "App / Software", "code"], ["other", "Etwas anderes", "folder"],
];

export const STATES = ["Baden-Württemberg", "Bayern", "Berlin", "Brandenburg", "Bremen", "Hamburg", "Hessen", "Mecklenburg-Vorpommern", "Niedersachsen", "Nordrhein-Westfalen", "Rheinland-Pfalz", "Saarland", "Sachsen", "Sachsen-Anhalt", "Schleswig-Holstein", "Thüringen", "nicht in Deutschland"];

// Fragen: [key, Frage, Art, Optionen?, Hilfe?, nur bei Typen?]
export const QUESTIONS = [
  ["name", "Wie heißt dein Projekt?", "text", null, "Kurz und wiedererkennbar."],
  ["goal", "Was willst du erreichen?", "textarea", null, "1–3 Sätze. Die KI nutzt das für Vorschläge."],
  ["deadline", "Bis wann / an welchem Tag?", "date"],
  ["state", "Bundesland", "select", STATES, "Manche Regeln sind Ländersache."],
  ["own_age", "Wie alt bist du (Veranstalter / Betreiber)?", "select", ["unter 16", "16–17", "18 oder älter"], "Wichtig für Verträge und Haftung.", ["event", "shop", "business", "website"]],
  // Event
  ["guests", "Wie viele Gäste erwartest du?", "number", null, null, ["event"]],
  ["ages", "Wie alt sind die Gäste?", "multi", ["unter 16", "16–17", "18+"], null, ["event"]],
  ["end", "Bis wann geht das Event?", "select", ["vor 22 Uhr", "bis 24 Uhr", "nach Mitternacht"], null, ["event"]],
  ["venue", "Wo findet es statt?", "select", ["Club / Bar / Gaststätte", "Saal / Halle / Eventlocation", "Draußen / Open Air", "Privat (Wohnung, Garten)", "Schule / Jugendclub"], null, ["event"]],
  ["public", "Ist es öffentlich (Tickets / jeder darf kommen)?", "select", ["ja", "nein, nur geladene Gäste"], null, ["event"]],
  ["alcohol", "Wird Alkohol verkauft oder ausgegeben?", "select", ["nein", "nur Bier / Wein / Sekt", "auch Spirituosen / Longdrinks"], null, ["event"]],
  ["music", "Welche Musik?", "select", ["DJ / Musik vom Band", "Live-Band", "keine"], null, ["event"]],
  ["tickets", "Wie kommen die Gäste rein?", "select", ["kostenlos", "Abendkasse", "Online-Tickets", "Online + Abendkasse"], null, ["event"]],
  ["photos", "Werden Fotos/Videos gemacht und gepostet?", "select", ["ja", "nein"], null, ["event", "school"]],
  // Website / Shop
  ["purpose", "Privat, Verein oder geschäftlich?", "select", ["privat / Hobby", "Verein / Projekt", "geschäftlich / mit Einnahmen"], null, ["website", "shop", "business", "event"]],
  ["forms", "Gibt es Kontaktformular, Anmeldung oder Newsletter?", "select", ["nein", "ja"], null, ["website", "shop", "event"]],
  ["tracking", "Nutzt du Analyse-Tools, eingebettete Videos/Karten oder Werbung?", "select", ["nein", "ja", "weiß nicht"], null, ["website", "shop"]],
  ["sells", "Verkaufst du an Privatpersonen online?", "select", ["nein", "ja, Waren", "ja, digitale Produkte / Dienstleistungen"], null, ["shop", "business", "website"]],
  // Business
  ["revenue", "Wie viel Umsatz erwartest du im Jahr?", "select", ["unter 25.000 €", "25.000–100.000 €", "über 100.000 €"], null, ["business", "shop"]],
  ["repeat", "Machst du das regelmäßig / dauerhaft mit Gewinnabsicht?", "select", ["nein, einmalig", "ja"], null, ["event", "business", "shop"]],
  // Schule
  ["subject", "Fach / Thema", "text", null, null, ["school"]],
  ["team", "Allein oder im Team?", "select", ["allein", "Team"], null, ["school", "software", "event"]],
  // Budget
  ["budget", "Budget (ca. in €)", "number", null, "Leer lassen, wenn egal.", ["event", "website", "shop", "business", "software", "other"]],
];
export const questionsFor = (type) => QUESTIONS.filter((q) => !q[5] || q[5].includes(type));

const has = (a, k, v) => Array.isArray(a[k]) ? a[k].includes(v) : a[k] === v;
const minor = (a) => a.own_age === "unter 16" || a.own_age === "16–17";
const geschaeftlich = (a) => a.purpose === "geschäftlich / mit Einnahmen" || (a.sells && a.sells !== "nein") || a.type === "shop" || a.type === "business";

// Regeln → { id, level: "muss"|"wichtig"|"tipp", area, title, why, ref?, task? }
const RULES = [
  // ---------- Jugendschutz (Events) ----------
  { when: (a) => a.type === "event" && has(a, "ages", "unter 16") && a.public === "ja", level: "muss", area: "Jugendschutz",
    title: "Unter 16: nur mit Eltern oder erziehungsbeauftragter Person", why: "Bei öffentlichen Tanzveranstaltungen dürfen unter 16-Jährige ohne Begleitung nicht anwesend sein (Ausnahmen nur bei anerkannten Jugendhilfe-Trägern, Kunst/Brauchtum oder mit Genehmigung).",
    ref: ["§ 5 JuSchG", Z("juschg", "5")], task: "Einlass-Regel für unter 16 festlegen (nur mit Begleitung) und am Einlass kontrollieren" },
  { when: (a) => a.type === "event" && has(a, "ages", "16–17") && a.end === "nach Mitternacht" && a.public === "ja", level: "muss", area: "Jugendschutz",
    title: "16–17-Jährige ohne Begleitung nur bis 24 Uhr", why: "Danach nur mit personensorgeberechtigter oder erziehungsbeauftragter Person („Muttizettel“ + Begleitperson vor Ort).",
    ref: ["§ 5 Abs. 1 JuSchG", Z("juschg", "5")], task: "Um 24 Uhr: alle unter 18 ohne Begleitung verlassen das Event – Ablauf + Durchsage planen" },
  { when: (a) => a.type === "event" && (has(a, "ages", "16–17") || has(a, "ages", "unter 16")), level: "wichtig", area: "Jugendschutz",
    title: "Ausweiskontrolle und Altersbänder", why: "Nur so lässt sich Alter, Ausschank und Uhrzeit-Regel am Abend sicher umsetzen (z. B. Farben: unter 16 / 16–17 / 18+).",
    task: "Ausweiskontrolle am Einlass + farbige Altersbänder besorgen" },
  { when: (a) => a.type === "event" && a.alcohol !== "nein" && a.alcohol && (has(a, "ages", "unter 16") || has(a, "ages", "16–17")), level: "muss", area: "Jugendschutz",
    title: "Alkohol nach Alter: Bier/Wein/Sekt ab 16, alles andere ab 18", why: "Spirituosen und Mischgetränke daraus (auch Longdrinks) dürfen an Minderjährige nicht abgegeben werden; Bier/Wein/Sekt nicht an unter 16 (Ausnahme: 14–15 in Begleitung der Eltern).",
    ref: ["§ 9 JuSchG", Z("juschg", "9")], task: "Bar-Team einweisen: Ausschank nur nach Band-Farbe, Aushang § 9 JuSchG an der Bar" },
  { when: (a) => a.type === "event" && (has(a, "ages", "unter 16") || has(a, "ages", "16–17")), level: "muss", area: "Jugendschutz",
    title: "Kein Rauchen / Vapen für Minderjährige", why: "Tabak, nikotinhaltige Produkte und E-Zigaretten dürfen an Kinder und Jugendliche nicht abgegeben und ihr Konsum nicht gestattet werden.",
    ref: ["§ 10 JuSchG", Z("juschg", "10")] },
  { when: (a) => a.type === "event" && a.venue === "Club / Bar / Gaststätte" && (has(a, "ages", "unter 16") || has(a, "ages", "16–17")), level: "wichtig", area: "Jugendschutz",
    title: "Gaststätte/Club mit Minderjährigen: Regeln mit der Location klären", why: "Unter 16 nur in Begleitung (außer Essen/Trinken 5–23 Uhr); ab 16 ohne Begleitung nicht zwischen 24 und 5 Uhr. Betriebe, die als Nachtclub/Nachtbar geführt werden, dürfen Minderjährige gar nicht einlassen – mit der Location klären, dass dein Abend als Tanzveranstaltung läuft.",
    ref: ["§ 4 JuSchG", Z("juschg", "4")], task: "Mit Location schriftlich klären: Jugendschutz-Regeln, Einlass, Uhrzeiten" },
  // ---------- Veranstalter minderjährig ----------
  { when: (a) => minor(a) && ["event", "shop", "business"].includes(a.type), level: "muss", area: "Verträge",
    title: "Du bist minderjährig: Verträge brauchen die Einwilligung deiner Eltern", why: "Verträge, die dich verpflichten (Location, Technik, DJ, Getränke), sind ohne Einwilligung schwebend unwirksam – außer du zahlst sie vollständig mit Taschengeld. Praktisch: Eltern unterschreiben mit oder ein Volljähriger tritt als Veranstalter auf.",
    ref: ["§§ 107, 110 BGB", Z("bgb", "107")], task: "Einwilligung der Eltern schriftlich / volljährigen Vertragspartner festlegen" },
  // ---------- Events: Organisation & Behörden ----------
  { when: (a) => a.type === "event" && a.alcohol && a.alcohol !== "nein" && ["Draußen / Open Air", "Saal / Halle / Eventlocation", "Schule / Jugendclub"].includes(a.venue), level: "wichtig", area: "Behörden",
    title: "Alkoholverkauf: Erlaubnis klären (vorübergehende Gestattung)", why: "Ohne Gaststätten-Erlaubnis der Location kann der Ausschank aus besonderem Anlass beim Ordnungs-/Gewerbeamt vorübergehend gestattet werden. Einige Bundesländer haben eigene Gaststättengesetze.",
    ref: ["§ 12 GastG", Z("gastg", "12")], task: "Beim Ordnungsamt fragen: Gestattung für Ausschank nötig? (oder Location hat Konzession)" },
  { when: (a) => a.type === "event" && Number(a.guests) > 200, level: "muss", area: "Sicherheit",
    title: "Über 200 Gäste: Versammlungsstätten-Regeln", why: "Ab mehr als 200 Besuchern gelten die Versammlungsstättenverordnungen der Länder (Rettungswege, Ordnungsdienst, Brandschutz). Mit der Location klären, für wie viele Personen sie zugelassen ist.",
    ref: ["z. B. § 1 VStättVO BW", Z("vstaettvo-bw", "1")], task: "Zugelassene Personenzahl der Location + Sicherheits-/Rettungskonzept klären" },
  { when: (a) => a.type === "event" && Number(a.guests) > 100, level: "wichtig", area: "Sicherheit",
    title: "Security, Sanitäter und Notfallplan", why: "Bei größeren Partys sind Ordner am Einlass, ein Sanitätsdienst und ein kurzer Notfallplan (Notausgänge, wer ruft 112) Standard – oft verlangt die Location das.",
    task: "Security + Sanitätsdienst anfragen, Notfallplan (1 Seite) schreiben" },
  { when: (a) => a.type === "event" && a.music && a.music !== "keine" && a.public === "ja", level: "muss", area: "Musik",
    title: "GEMA anmelden (vor dem Event)", why: "Öffentliche Musikwiedergabe ist meldepflichtig; nach dem Event anmelden wird teurer. Tarif hängt von Raumgröße und Eintritt ab.",
    task: "GEMA-Anmeldung online vor dem Event" },
  { when: (a) => a.type === "event" && a.venue === "Draußen / Open Air", level: "wichtig", area: "Behörden",
    title: "Open Air: Ordnungsamt, Lärm und Fläche", why: "Für Veranstaltungen im Freien braucht es meist eine Genehmigung/Sondernutzung, Lärmschutz-Absprachen und Toiletten/Müllkonzept.",
    task: "Ordnungsamt: Genehmigung für Open Air + Lärmschutz anfragen" },
  { when: (a) => a.type === "event" && a.venue === "Privat (Wohnung, Garten)" && Number(a.guests) > 30, level: "tipp", area: "Nachbarn",
    title: "Nachbarn vorher informieren", why: "Ab 22 Uhr gilt Nachtruhe; ein Zettel im Treppenhaus verhindert viel Ärger." },
  { when: (a) => a.type === "event" && a.photos === "ja", level: "wichtig", area: "Fotos",
    title: "Fotos nur mit Einwilligung posten", why: "Bildnisse dürfen grundsätzlich nur mit Einwilligung verbreitet werden; bei Minderjährigen zusätzlich die Eltern. Hinweis am Einlass + „Keine Fotos“-Bänder helfen.",
    ref: ["§ 22 KunstUrhG", Z("kunsturhg", "22")], task: "Foto-Hinweis am Einlass + Option „keine Fotos“" },
  { when: (a) => a.type === "event", level: "tipp", area: "Absicherung",
    title: "Veranstalter-Haftpflicht prüfen", why: "Kurzzeit-Veranstalterhaftpflicht kostet oft nur wenig und deckt Schäden an Location und Gästen.", task: "Veranstalterhaftpflicht vergleichen / abschließen" },
  { when: (a) => a.type === "event" && a.tickets && a.tickets !== "kostenlos", level: "tipp", area: "Geld",
    title: "Wechselgeld, Kasse und Einnahmen dokumentieren", why: "Abendkasse mit Wechselgeld und Kassenliste; Online-Tickets regelmäßig abgleichen (Nexus macht das mit Eventfrog automatisch).", task: "Kassenliste + Wechselgeld planen" },
  // ---------- Gewerbe / Steuern ----------
  { when: (a) => a.repeat === "ja" && ["event", "business", "shop"].includes(a.type), level: "muss", area: "Gewerbe",
    title: "Regelmäßig mit Gewinnabsicht = Gewerbe anmelden", why: "Wer ein stehendes Gewerbe beginnt, muss es gleichzeitig bei der Gemeinde anzeigen (Gewerbeanmeldung). Minderjährige brauchen dafür die Genehmigung des Familiengerichts.",
    ref: ["§ 14 GewO", Z("gewo", "14")], task: "Gewerbe beim Gewerbeamt anmelden" },
  { when: (a) => ["business", "shop"].includes(a.type) || (a.repeat === "ja" && a.type === "event"), level: "wichtig", area: "Steuern",
    title: "Kleinunternehmer-Regel prüfen", why: "Keine Umsatzsteuer, wenn der Umsatz im Vorjahr höchstens 25.000 € betrug und im laufenden Jahr 100.000 € nicht überschreitet. Einkommen musst du trotzdem versteuern.",
    ref: ["§ 19 UStG", Z("ustg", "19")] },
  { when: (a) => a.revenue === "über 100.000 €", level: "muss", area: "Steuern",
    title: "Über 100.000 € Umsatz: Umsatzsteuer fällt an", why: "Die Kleinunternehmer-Grenze ist überschritten – Rechnungen mit Umsatzsteuer, Voranmeldungen.", ref: ["§ 19 UStG", Z("ustg", "19")], task: "Steuerberatung zu Umsatzsteuer einholen" },
  // ---------- Website / Shop ----------
  { when: (a) => ["website", "shop", "business"].includes(a.type) && geschaeftlich(a), level: "muss", area: "Website",
    title: "Impressum (Anbieterkennzeichnung)", why: "Geschäftsmäßige Websites brauchen leicht erreichbar Name, Anschrift, E-Mail und ggf. Register- und Steuernummern.",
    ref: ["§ 5 DDG", Z("ddg", "5")], task: "Impressum erstellen (Vorlage: KI-Studio › Website-Baukasten › Impressum-Seite) und im Footer verlinken" },
  { when: (a) => ["website", "shop", "business", "event"].includes(a.type) && (a.forms === "ja" || a.tracking === "ja" || a.type === "shop"), level: "muss", area: "Datenschutz",
    title: "Datenschutzerklärung", why: "Wer personenbezogene Daten erhebt (Formulare, Bestellungen, Newsletter, Tracking), muss bei der Erhebung u. a. über Zweck, Rechtsgrundlage und Speicherdauer informieren.",
    ref: ["Art. 13 DSGVO", Z("dsgvo", "art-13")], task: "Datenschutzerklärung erstellen (Formulare, Tools, Hosting nennen)" },
  { when: (a) => ["website", "shop"].includes(a.type) && (a.tracking === "ja" || a.tracking === "weiß nicht"), level: "muss", area: "Datenschutz",
    title: "Cookie-/Tracking-Einwilligung", why: "Was nicht unbedingt nötig ist (Analyse, Werbung, eingebettete Videos/Karten), darf erst nach Einwilligung Daten auf dem Gerät speichern oder auslesen.",
    ref: ["§ 25 TDDDG", Z("tdddg", "25")], task: "Einwilligungs-Banner einbauen oder auf cookiefreie Tools umsteigen (z. B. Nexus-Besucherzähler)" },
  { when: (a) => a.sells && a.sells !== "nein", level: "muss", area: "Online-Verkauf",
    title: "Widerrufsrecht und Widerrufsbelehrung", why: "Verbraucher haben bei Fernabsatzverträgen ein Widerrufsrecht; darüber muss vor dem Kauf belehrt werden.",
    ref: ["§ 312g BGB", Z("bgb", "312g")], task: "Widerrufsbelehrung + Muster-Widerrufsformular einbinden" },
  { when: (a) => a.sells && a.sells !== "nein", level: "muss", area: "Online-Verkauf",
    title: "Bestell-Button „zahlungspflichtig bestellen“", why: "Der Bestellknopf muss eindeutig auf die Zahlungspflicht hinweisen – sonst kommt kein wirksamer Vertrag zustande.",
    ref: ["§ 312j Abs. 3 BGB", Z("bgb", "312j")], task: "Bestell-Button beschriften: „zahlungspflichtig bestellen“" },
  { when: (a) => ["website", "shop"].includes(a.type), level: "tipp", area: "Technik",
    title: "Erreichbarkeit & Besucher im Nexus überwachen", why: "Unter „Websites“ prüft Nexus alle 5 Minuten die Erreichbarkeit und zählt Besucher cookiefrei – ohne Banner." },
  // ---------- Schule ----------
  { when: (a) => a.type === "school", level: "tipp", area: "Planung",
    title: "Rückwärts planen", why: "Abgabetermin → Zwischenziele (Recherche, Gliederung, Entwurf, Korrektur). Nexus erinnert dich per Push an fällige Schritte.", task: "Zwischenziele mit Datum anlegen" },
  { when: (a) => a.type === "school" && a.photos === "ja", level: "wichtig", area: "Fotos",
    title: "Fotos von Mitschülern nur mit Einwilligung", why: "Auch im Schulprojekt gilt: Bildnisse nur mit Einwilligung veröffentlichen (bei Minderjährigen auch die Eltern).", ref: ["§ 22 KunstUrhG", Z("kunsturhg", "22")] },
  // ---------- Allgemein ----------
  { when: (a) => a.deadline && (new Date(a.deadline) - Date.now()) / 864e5 < 21 && (new Date(a.deadline) - Date.now()) > 0, level: "wichtig", area: "Zeit",
    title: "Weniger als 3 Wochen Zeit", why: "Genehmigungen (Ordnungsamt, GEMA, Gestattung) brauchen Vorlauf – diese Punkte zuerst erledigen." },
  { when: (a) => a.team === "Team", level: "tipp", area: "Team",
    title: "Aufgaben verteilen und Team einladen", why: "Teile das Projekt (Helfer-Ansicht) und lade das Team zu Push-Benachrichtigungen ein – ganz ohne Konto." },
];

export function checkRules(type, answers) {
  const a = { ...answers, type };
  const order = { muss: 0, wichtig: 1, tipp: 2 };
  return RULES.filter((r) => { try { return r.when(a); } catch { return false; } })
    .map((r, i) => ({ id: `r${i}-${r.title.slice(0, 20)}`, level: r.level, area: r.area, title: r.title, why: r.why, ref: r.ref || null, task: r.task || null }))
    .sort((x, y) => order[x.level] - order[y.level]);
}

// Marketing-Ideen je Projektart (Grundlage; die KI ergänzt passend zum Projekt)
export function marketingIdeas(type) {
  const base = [["qr", "QR-Code", "Für Plakate, Flyer, Tische – führt direkt zu deinem Link."], ["card", "Visitenkarten mit Link", "Druckfertig mit QR-Code, 10 pro A4-Seite."]];
  const by = {
    event: [["shirt", "Crew-/Merch-Shirts", "Design mit Eventname + QR – für Team oder als Verkauf."], ["flyer", "Flyer & Story-Posts", "KI schreibt Texte für Instagram/TikTok und den Flyer."], ["notify", "Ticket-Alarm-Seite", "Fans holen sich Push-Nachrichten für Ticketstart & Updates."]],
    website: [["social", "Social-Posts zum Launch", "Ankündigung in 3 Varianten."], ["links", "Link-Seite", "Alle Links auf einer Seite (Link-in-Bio)."]],
    shop: [["social", "Produkt-Posts", "Texte + Hashtags für neue Produkte."], ["shirt", "Merch-Design", "Logo/Slogan-Druck mit Shop-QR."]],
    business: [["links", "Link-Seite", "Visitenkarte im Netz."], ["social", "LinkedIn-/Instagram-Texte", "Vorstellungs-Post in deinem Ton."]],
    school: [["social", "Präsentations-Folie mit QR", "QR zur Projektseite auf der letzten Folie."]],
  };
  return [...base, ...(by[type] || by.website)];
}
