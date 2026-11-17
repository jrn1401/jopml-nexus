// Rechtstexte für JOPML Nexus (Stand: November 2026). Platzhalter in {{…}} werden aus Einstellungen › Rechtliches befüllt.
// Grundlagen u. a.: DSGVO, BDSG, TDDDG, DDG, MStV, BGB (§§ 305 ff., 312 ff.), Verordnung (EU) 2022/2065 (DSA),
// Verordnung (EU) 2024/1689 (KI-Verordnung, Art. 50 seit 2. August 2026), BFSG, JuSchG/JMStV, UrhG, KUG.
// Die OS-Plattform der EU wurde zum 20. Juli 2025 abgeschaltet (VO (EU) 2024/3228) – daher kein OS-Link mehr.
// Hinweis: Mustertexte ersetzen keine anwaltliche Prüfung im Einzelfall.

export const LEGAL_ORDER = ["impressum", "datenschutz", "agb", "inhalte", "ki", "cookies", "barrierefreiheit", "veranstalter", "sicherheit"];

export const TEXTS = {
  impressum: {
    title: "Impressum",
    intro: "Anbieterkennzeichnung nach § 5 Digitale-Dienste-Gesetz (DDG) und § 18 Medienstaatsvertrag (MStV) sowie zentrale Kontaktstelle nach Art. 11 und 12 der Verordnung (EU) 2022/2065 (Digital Services Act).",
    sections: [
      ["Anbieter", ["{{name}}", "{{address}}"]],
      ["Kontakt", ["E-Mail: {{email}}", "{{phone_line}}", "Wir antworten in der Regel innerhalb von 48 Stunden. Die Kontaktaufnahme per E-Mail ist kostenlos und ermöglicht eine schnelle, unmittelbare Kommunikation."]],
      ["Verantwortlich für journalistisch-redaktionelle Inhalte (§ 18 Abs. 2 MStV)", ["{{responsible}}", "{{address}}"]],
      ["Zentrale Kontaktstelle nach dem Digital Services Act", [
        "Für Behörden der Mitgliedstaaten, die Europäische Kommission und das Europäische Gremium für digitale Dienste (Art. 11 DSA) sowie für Nutzerinnen und Nutzer (Art. 12 DSA) ist die zentrale Kontaktstelle erreichbar unter: {{email}}.",
        "Die Kommunikation ist auf Deutsch und Englisch möglich. Nutzerinnen und Nutzer können auf Wunsch mit einem Menschen kommunizieren; die Kontaktaufnahme läuft nicht ausschließlich über automatisierte Werkzeuge.",
        "Rechtswidrige Inhalte kannst du jederzeit über die Seite „Inhalte melden“ (Menü unten: Inhalte & Melden) oder per E-Mail melden. Einzelheiten stehen in den Regeln für Inhalte und im Melde- und Abhilfeverfahren.",
      ]],
      ["Verbraucherstreitbeilegung", [
        "Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.",
        "Die frühere Plattform der EU-Kommission zur Online-Streitbeilegung (OS-Plattform) wurde zum 20. Juli 2025 eingestellt; ein Hinweis darauf entfällt deshalb. Beschwerden kannst du direkt an {{email}} richten.",
      ]],
      ["Haftung für eigene Inhalte", [
        "Wir erstellen die Inhalte dieser Anwendung mit Sorgfalt. Für Richtigkeit, Vollständigkeit und Aktualität – insbesondere bei Rechtshinweisen, Vorlagen, Musterformularen, Kalkulationen und KI-Antworten – übernehmen wir keine Gewähr. Diese ersetzen keine individuelle Beratung durch Anwältinnen und Anwälte, Steuerberatung oder Behörden.",
      ]],
      ["Haftung für Inhalte von Nutzerinnen und Nutzern (Hosting)", [
        "Projekte, Events, Notizen, Dateien, veröffentlichte Seiten und geteilte Links werden von den jeweiligen Nutzerinnen und Nutzern erstellt. Als Hostingdiensteanbieter im Sinne von Art. 6 DSA sind wir für diese Inhalte nicht verantwortlich, solange wir keine tatsächliche Kenntnis von einer rechtswidrigen Tätigkeit oder einem rechtswidrigen Inhalt haben. Sobald wir davon Kenntnis erlangen, handeln wir zügig und entfernen den Inhalt oder sperren den Zugang.",
      ]],
      ["Haftung für Links", [
        "Diese Anwendung enthält Links zu externen Websites Dritter (z. B. Ticketshops, Hoster, Social Media), auf deren Inhalte wir keinen Einfluss haben. Für diese fremden Inhalte ist stets der jeweilige Anbieter verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar. Bei Bekanntwerden von Rechtsverletzungen entfernen wir derartige Links umgehend.",
      ]],
      ["Urheberrecht", [
        "Die durch uns erstellten Inhalte, Texte, Gestaltung und Programmcode unterliegen dem deutschen Urheberrecht. Vervielfältigung, Bearbeitung und Verbreitung außerhalb der Grenzen des Urheberrechts bedürfen der Zustimmung. Inhalte, die du selbst erstellst, bleiben deine; Vorlagen aus dem Website-Baukasten und Musterformulare darfst du für eigene Zwecke frei verwenden und anpassen.",
      ]],
    ],
  },

  datenschutz: {
    title: "Datenschutzerklärung",
    intro: "Hier erfährst du, welche personenbezogenen Daten {{app}} verarbeitet, wozu, auf welcher Rechtsgrundlage, an wen sie gehen, wie lange sie gespeichert werden und welche Rechte du hast (Art. 12–14 DSGVO). Wir verarbeiten so wenige Daten wie möglich: keine Werbung, kein Tracking, keine Analyse-Cookies.",
    sections: [
      ["1. Verantwortlicher", ["Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:", "{{name}}", "{{address}}", "E-Mail: {{email}}", "Einen Datenschutzbeauftragten müssen wir nach Art. 37 DSGVO und § 38 BDSG nicht benennen. Für alle Fragen zum Datenschutz erreichst du uns unter der genannten E-Mail-Adresse."]],
      ["2. Überblick", [{ ul: [
        "Anmeldung mit Google oder als Gast (anonymes Konto).",
        "Speicherung deiner Inhalte: Projekte, Module, Aufgaben, Events, Kalkulationen, Belege, Dateien, Notizen, Freigaben.",
        "Verbindungen zu Diensten, die du selbst einrichtest (API-Schlüssel, verschlüsselt im Vault).",
        "KI-Funktionen (Texte, Kalkulation, Dokumentenanalyse) über Google Gemini oder Groq bzw. deinen eigenen KI-Anbieter.",
        "Technisch notwendige Speicherung im Browser (Anmeldung, Einstellungen) – keine Tracking-Cookies.",
        "Optionale Push-Benachrichtigungen, Kalender-Abos, geteilte Links und veröffentlichte Seiten.",
      ] }]],
      ["3. Bereitstellung der Website und Server-Logfiles", [
        "Die Anwendung wird als statische Website über GitHub Pages (GitHub, Inc., 88 Colin P. Kelly Jr. Street, San Francisco, CA 94107, USA) ausgeliefert. Beim Aufruf verarbeitet GitHub technisch notwendige Verbindungsdaten wie IP-Adresse, Datum und Uhrzeit, angefragte Datei, Referrer, Browser und Betriebssystem, um die Seite auszuliefern und Angriffe abzuwehren.",
        "Die Programmbibliothek für die Datenbankverbindung wird über das Content-Delivery-Netzwerk jsDelivr (betrieben u. a. über Cloudflare, Inc. und Fastly, Inc., USA) geladen; dabei wird deine IP-Adresse an den CDN-Anbieter übertragen.",
        "Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO. Unser berechtigtes Interesse liegt in einer sicheren, schnellen und stabilen Auslieferung. Für Übermittlungen in die USA stützen sich die Anbieter auf das EU-US Data Privacy Framework (Angemessenheitsbeschluss der EU-Kommission vom 10. Juli 2023) bzw. auf Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO). Wir selbst werten diese Logfiles nicht aus.",
      ]],
      ["4. Anmeldung und Benutzerkonto", [
        { ul: [
          "Mit Google: Du meldest dich über Googles eigenen Anmeldeknopf (Google Identity Services) an. Google übermittelt uns ein signiertes Anmelde-Token mit deiner Google-Kontokennung, E-Mail-Adresse, deinem Namen und – falls vorhanden – deinem Profilbild. Dein Google-Passwort erhalten wir nie. Anbieter: Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland.",
          "Als Gast: Ohne Google wird ein anonymes Konto angelegt. Es enthält keine E-Mail-Adresse und wird mitsamt Inhalten nach 7 Tagen automatisch gelöscht, wenn du es nicht mit Google sicherst.",
          "Konten, Sitzungen und Rollen verwaltet Supabase Auth (Supabase, Inc., 970 Toa Payoh North #07-04, Singapur 318992; Datenhaltung im Rechenzentrum Frankfurt am Main, AWS-Region eu-central-1).",
        ] },
        "Zweck ist die Bereitstellung deines persönlichen, geschützten Bereichs. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO (Nutzungsvertrag). Zur Sicherheit protokollieren wir Anmeldungen (Zeitpunkt, Browser/Gerät, gekürzter User-Agent) im Admin-Bereich; Rechtsgrundlage Art. 6 Abs. 1 lit. f DSGVO, Löschung nach 90 Tagen.",
      ]],
      ["5. Deine Inhalte", [
        "Alles, was du anlegst oder importierst – Projekte, Module, Aufgaben, Events mit Kalkulation, Steckbrief, Gästelisten, Schichten, Kosten, Belege, Dateien, Notizen, Website-Entwürfe – speichern wir in der Datenbank bzw. im Dateispeicher von Supabase (Frankfurt). Durch Zeilen-Sicherheitsregeln (Row Level Security) sieht jede Person nur ihre eigenen Daten und das, was ihr ausdrücklich freigegeben wurde.",
        "Gästelisten, Schichtpläne oder Belege können personenbezogene Daten Dritter enthalten. Für diese Daten bist du gegenüber den Betroffenen selbst verantwortlich (Art. 4 Nr. 7 DSGVO); wir verarbeiten sie in deinem Auftrag nur zur Bereitstellung der Funktionen. Bitte trage nur Daten ein, die du verarbeiten darfst, und keine besonderen Kategorien (z. B. Gesundheitsdaten) ohne Rechtsgrundlage.",
        "Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Speicherdauer: bis du die Inhalte bzw. dein Konto löschst.",
      ]],
      ["6. Verbindungen zu anderen Diensten (API-Schlüssel)", [
        "Freiwillig kannst du Zugangsschlüssel zu Diensten wie Netlify, GitHub, Vercel, Supabase, Eventfrog, Google Gemini, Groq, OpenAI oder Anthropic hinterlegen. Die Schlüssel werden ausschließlich verschlüsselt im Supabase Vault gespeichert, nie an den Browser zurückgegeben und nur serverseitig genutzt, um deine eigenen Daten bei dem jeweiligen Dienst abzurufen (z. B. Websites, Deploys, Ticketverkäufe).",
        "Dabei werden Anfragen in deinem Namen an den jeweiligen Anbieter gesendet; es gelten zusätzlich dessen Datenschutzbestimmungen. Ticketdaten von Eventfrog werden nur als Summen (Anzahl, Umsatz, Kategorien, Check-ins) übernommen – keine Namen oder E-Mail-Adressen von Käuferinnen und Käufern.",
        "Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Beim Trennen einer Verbindung löschen wir den Schlüssel sofort.",
      ]],
      ["7. KI-Funktionen", [
        "Wenn du KI-Funktionen nutzt (Assistent, Texte schreiben, Event-Plan, Kalkulation aus Projekten, Dokumente analysieren, Rechts-Check), senden wir deine Eingabe und – nur wenn für die Aufgabe nötig – Auszüge deiner Projekt- bzw. Eventdaten an einen KI-Anbieter. Standardmäßig sind das Google Gemini (Google Ireland Limited) und Groq, Inc. (USA). Hast du einen eigenen KI-Schlüssel verbunden, geht die Anfrage an diesen Anbieter (z. B. OpenAI, Anthropic, Google).",
        "Hochgeladene Belege (PDF oder Foto) werden zur Analyse an Google Gemini übermittelt und dort nicht dauerhaft gespeichert; wir speichern nur das Ergebnis (z. B. Betrag, Fälligkeit, Zusammenfassung) und – bei Admin-Events mit verknüpftem Projekt – die Datei selbst.",
        "Wir speichern pro Tag nur die Anzahl deiner KI-Anfragen und Tokens (Tageslimit). Optional merkt sich der Assistent kurze Fakten, die du selbst angibst („KI-Gedächtnis“); diese kannst du in den KI-Einstellungen einsehen und löschen oder die Funktion abschalten. Allgemeines, anonymisiertes Lösungswissen (ohne Namen, E-Mails, Schlüssel oder Beträge) kann zur Verbesserung künftiger Antworten gespeichert werden.",
        "Bitte gib keine sensiblen Daten (Gesundheit, Ausweis-, Konto- oder Kreditkartennummern, Passwörter) in KI-Felder ein. API-Schlüssel in KI-Texten werden automatisch erkannt und nicht an die KI geschickt.",
        "Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (gewünschte Funktion). Für Übermittlungen in die USA gelten das EU-US Data Privacy Framework bzw. Standardvertragsklauseln.",
      ]],
      ["8. Teilen, Gäste-Links und veröffentlichte Seiten", [
        "Wenn du Inhalte teilst, entscheidest du, wer sie sieht: bestimmte Google-Konten (per E-Mail-Adresse) oder alle mit einem geheimen Link. Wir zählen Aufrufe von Freigaben (Zeitpunkt, Anzahl) und zeigen dir diese Statistik. Bei Freigaben an E-Mail-Adressen speichern wir diese Adressen, damit sich die Personen anmelden können.",
        "Veröffentlichte Seiten aus dem Website-Baukasten werden unter einer festen Adresse ausgeliefert. Aus Sicherheitsgründen entfernen wir Skripte und eingebettete Fremdinhalte und zeigen die Seite in einer abgeschotteten Umgebung (Sandbox) an. Für Inhalte und Rechtstexte veröffentlichter Seiten ist die Person verantwortlich, die sie veröffentlicht.",
        "Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO; für die Aufrufstatistik Art. 6 Abs. 1 lit. f DSGVO (Missbrauchserkennung, Transparenz für die teilende Person).",
      ]],
      ["9. Benachrichtigungen, Push und Kalender", [
        "Push-Benachrichtigungen erhältst du nur, wenn du sie in deinem Browser bzw. in der Handy-App ausdrücklich erlaubst. Dafür speichern wir die vom Browser erzeugte Push-Adresse (Endpunkt und Schlüssel). Die Zustellung läuft über den Push-Dienst deines Browserherstellers (z. B. Google Firebase Cloud Messaging, Mozilla, Apple). Rechtsgrundlage ist deine Einwilligung (Art. 6 Abs. 1 lit. a DSGVO, § 25 Abs. 1 TDDDG); du kannst sie jederzeit in den Einstellungen oder im Browser widerrufen.",
        "Kalender-Abos enthalten einen geheimen Link. Wer den Link kennt, kann die darin enthaltenen Termine sehen; du kannst ihn jederzeit neu erzeugen.",
      ]],
      ["10. Geräte, Server und Hosting über den Nexus-Agent", [
        "Wenn du freiwillig einen Raspberry Pi, PC oder Server mit dem Nexus-Agent verbindest, übermittelt dieser technische Messwerte (z. B. Auslastung, Temperatur, Speicher, laufende Programme) und – nur wenn du es auf dem Gerät freischaltest – Dateilisten und angeforderte Dateien. Öffentliche Links für gehostete Anwendungen können über Cloudflare-Tunnel (Cloudflare, Inc., USA) bereitgestellt werden. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO.",
      ]],
      ["11. Speicherung im Browser (keine Cookies zu Werbezwecken)", [
        "Wir setzen keine Werbe-, Analyse- oder Tracking-Cookies. Im lokalen Speicher deines Browsers (localStorage, sessionStorage, IndexedDB/Cache des Service Workers) legen wir nur ab, was für die von dir gewünschten Funktionen unbedingt erforderlich ist: Anmeldesitzung, Design-Einstellungen, zuletzt geöffnete Ansichten, Entwürfe, Offline-Kopie der App. Rechtsgrundlage ist § 25 Abs. 2 Nr. 2 TDDDG (unbedingt erforderlich) und Art. 6 Abs. 1 lit. b DSGVO. Details: siehe Seite „Cookies & Speicher“.",
      ]],
      ["12. Kontakt per E-Mail und Meldungen", [
        "Wenn du uns schreibst oder einen Inhalt meldest, verarbeiten wir deine Angaben (E-Mail-Adresse, Name, Inhalt der Nachricht, ggf. gemeldete Inhalte) zur Bearbeitung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b, c (Pflichten nach Art. 16, 17 DSA) bzw. f DSGVO. Wir löschen die Daten, wenn die Anfrage erledigt ist und keine Aufbewahrungspflichten entgegenstehen, spätestens nach drei Jahren.",
      ]],
      ["13. Empfänger und Auftragsverarbeiter", [{ ul: [
        "Supabase, Inc. – Datenbank, Anmeldung, Dateispeicher, Server-Funktionen (Rechenzentrum Frankfurt am Main). Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.",
        "GitHub, Inc. – Auslieferung der Website (GitHub Pages).",
        "jsDelivr (Cloudflare, Inc. / Fastly, Inc.) – Auslieferung von Programmbibliotheken.",
        "Google Ireland Limited – Google-Anmeldung, Gemini-KI, ggf. Push-Zustellung.",
        "Groq, Inc. – KI-Antworten (nur Eingaben, keine Kontodaten).",
        "Von dir verbundene Dienste (z. B. Netlify, GitHub, Vercel, Eventfrog, OpenAI, Anthropic) – nur, wenn du sie selbst verbindest.",
        "Personen, denen du Inhalte freigibst – nur im von dir gewählten Umfang.",
        "Behörden – nur, wenn wir gesetzlich dazu verpflichtet sind.",
      ] }]],
      ["14. Übermittlung in Drittländer", [
        "Einige Anbieter haben ihren Sitz in den USA oder verarbeiten Daten dort. Übermittlungen erfolgen auf Grundlage des Angemessenheitsbeschlusses zum EU-US Data Privacy Framework (für zertifizierte Unternehmen) oder auf Grundlage von EU-Standardvertragsklauseln (Art. 46 Abs. 2 lit. c DSGVO). Auf Anfrage stellen wir dir eine Kopie der Garantien zur Verfügung, soweit möglich.",
      ]],
      ["15. Speicherdauer", [{ ul: [
        "Konto und Inhalte: bis zur Löschung durch dich (Einstellungen › „Alle meine Daten löschen“) oder bis zur Löschung des Kontos.",
        "Gast-Konten: automatisch nach 7 Tagen, sofern nicht mit Google gesichert.",
        "API-Schlüssel: bis du die Verbindung trennst.",
        "KI-Nutzungszähler: 90 Tage. KI-Gedächtnis: bis du es löschst.",
        "Anmeldeprotokolle und Sicherheitsereignisse: 90 Tage.",
        "Ticket-Verlauf (Momentaufnahmen der Verkaufszahlen): 400 Tage.",
        "Nächtliche Sicherungen: bis zu 30 Tage.",
        "Meldungen und Korrespondenz: bis zur Erledigung, längstens drei Jahre (Verjährungsfristen).",
      ] }]],
      ["16. Deine Rechte", [
        "Du hast jederzeit das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) – in Einstellungen › „Daten exportieren“ kannst du deine Daten als Datei herunterladen – sowie Widerspruch gegen Verarbeitungen auf Grundlage von Art. 6 Abs. 1 lit. f DSGVO (Art. 21). Erteilte Einwilligungen kannst du jederzeit mit Wirkung für die Zukunft widerrufen (Art. 7 Abs. 3).",
        "Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO), insbesondere in dem Bundesland bzw. Mitgliedstaat deines Aufenthaltsorts, deines Arbeitsplatzes oder des Orts des mutmaßlichen Verstoßes.",
        "Eine Pflicht zur Bereitstellung deiner Daten besteht nicht. Ohne Anmeldedaten können wir dir aber keinen persönlichen Bereich anbieten.",
      ]],
      ["17. Automatisierte Entscheidungen", [
        "Wir treffen keine ausschließlich automatisierten Entscheidungen mit rechtlicher oder ähnlich erheblicher Wirkung (Art. 22 DSGVO). KI-Vorschläge (z. B. Kalkulationswerte aus Belegen) übernehmen wir nur nach deiner Bestätigung.",
      ]],
      ["18. Sicherheit", [
        "Übertragungen sind TLS-verschlüsselt. Schlüssel liegen verschlüsselt im Vault, Datenbankzugriffe sind durch Zeilen-Sicherheitsregeln abgesichert, veröffentlichte Seiten laufen ohne Skripte in einer Sandbox, Dateien mit Zugangsdaten werden beim Hochladen abgelehnt. Absolute Sicherheit kann im Internet niemand garantieren; melde Sicherheitslücken bitte an {{email}}.",
      ]],
      ["19. Kinder und Jugendliche", [
        "Die Nutzung ist ab 16 Jahren gedacht. Jüngere dürfen den Dienst nur mit Zustimmung ihrer Erziehungsberechtigten nutzen. Wir verarbeiten wissentlich keine Daten von Kindern unter 16 Jahren auf Grundlage einer Einwilligung (Art. 8 DSGVO).",
      ]],
      ["20. Änderungen", [
        "Wir passen diese Datenschutzerklärung an, wenn sich Funktionen oder Rechtslage ändern. Es gilt die jeweils hier veröffentlichte Fassung.",
      ]],
    ],
  },

  agb: {
    title: "Allgemeine Nutzungsbedingungen (AGB)",
    intro: "Diese Bedingungen regeln die Nutzung von {{app}}. Sie enthalten zugleich die nach Art. 14 der Verordnung (EU) 2022/2065 (Digital Services Act) erforderlichen Angaben zu Beschränkungen und zur Moderation von Inhalten. Bitte lies sie sorgfältig – mit der Anmeldung erklärst du dich mit ihnen einverstanden.",
    sections: [
      ["§ 1 Anbieter und Geltungsbereich", [
        "(1) Anbieter des Dienstes ist {{name}}, {{address_inline}} („wir“).",
        "(2) Diese Bedingungen gelten für alle Nutzerinnen und Nutzer („du“) der Web-App, der Handy-App „Nexus Mobil“, des Website-Baukastens, geteilter Links, veröffentlichter Seiten, des Nexus-Agents und der Claude-Skills.",
        "(3) Abweichende Bedingungen von Nutzerinnen und Nutzern gelten nicht, auch wenn wir ihnen nicht ausdrücklich widersprechen.",
      ]],
      ["§ 2 Leistungsbeschreibung", [
        "(1) {{app}} ist ein Kontrollzentrum zum Planen, Verwalten und Teilen eigener Projekte: Events (Kalkulation, Tickets, Aufgaben, Ablauf, Gäste, Schichten, Abrechnung, Belege), Projekte mit Modulen, Aufgaben und Kalender, Websites und Website-Baukasten, Verbindungen zu Diensten über API-Schlüssel, Geräte-Verwaltung, Rechtsvorlagen und Formulare sowie KI-Funktionen.",
        "(2) Die Grundnutzung ist kostenlos. Ein Anspruch auf bestimmte Funktionen, eine bestimmte Verfügbarkeit oder Speicherplatz besteht nicht. Wir bemühen uns um einen störungsfreien Betrieb, können Wartungen, Störungen bei Dritt-Anbietern (z. B. Supabase, Google, GitHub) und höhere Gewalt aber nicht ausschließen.",
        "(3) Wir dürfen den Dienst weiterentwickeln, Funktionen ändern, ergänzen oder einstellen, soweit dies für dich zumutbar ist. Über wesentliche Einschränkungen informieren wir rechtzeitig in der App.",
        "(4) Für KI-Funktionen gelten Tageslimits (derzeit 30 Anfragen pro Tag mit dem Plattform-Zugang, 10 für Gäste). Mit einem eigenen KI-Schlüssel entfällt das Limit; dann gelten zusätzlich die Bedingungen deines KI-Anbieters.",
      ]],
      ["§ 3 Registrierung, Gastzugang und Konto", [
        "(1) Die Anmeldung erfolgt mit einem Google-Konto oder als Gast. Ein Gast-Konto wird nach 7 Tagen gelöscht, wenn du es nicht mit Google sicherst.",
        "(2) Die Nutzung ist ab 16 Jahren gestattet. Minderjährige unter 16 Jahren benötigen die Zustimmung ihrer Erziehungsberechtigten. Mit der Nutzung bestätigst du, dass diese Voraussetzungen vorliegen.",
        "(3) Du hältst deine Zugangsdaten geheim und informierst uns unverzüglich, wenn du einen Missbrauch vermutest. Für Handlungen über dein Konto bist du verantwortlich, soweit du sie zu vertreten hast.",
        "(4) Ein Nutzungsvertrag kommt mit der ersten Anmeldung zustande. Es besteht kein Anspruch auf Abschluss.",
      ]],
      ["§ 4 Deine Pflichten", [
        "(1) Du nutzt den Dienst nur im Rahmen der geltenden Gesetze und dieser Bedingungen.",
        "(2) Du verbindest nur Konten und API-Schlüssel, die dir gehören oder für die du berechtigt bist, und hältst die Nutzungsbedingungen der verbundenen Anbieter ein.",
        "(3) Du trägst personenbezogene Daten Dritter (z. B. Gästelisten, Helferinnen und Helfer, Belege) nur ein, wenn du dazu berechtigt bist, und erfüllst die Pflichten aus der DSGVO gegenüber diesen Personen selbst.",
        "(4) Untersagt sind insbesondere: rechtswidrige, beleidigende, verleumderische, volksverhetzende, gewaltverherrlichende, pornografische oder jugendgefährdende Inhalte; Verletzung von Urheber-, Marken-, Persönlichkeits- und Bildrechten; Spam, Phishing, Schadsoftware, Täuschung; Versuche, auf fremde Daten zuzugreifen, Sicherheitsmaßnahmen zu umgehen, den Dienst zu überlasten oder automatisiert in unüblichem Umfang abzufragen; das Hosten von Diensten über den Nexus-Agent, die Dritte schädigen.",
        "(5) Veröffentlichst du Seiten über den Website-Baukasten oder teilst du Inhalte öffentlich, bist du für Inhalt, Impressum und Datenschutzerklärung dieser Seiten selbst verantwortlich. Die Vorlagen sind Hilfen, keine Rechtsberatung.",
      ]],
      ["§ 5 Inhalte und Nutzungsrechte", [
        "(1) Alle Inhalte, die du erstellst oder hochlädst, bleiben deine. Du räumst uns nur die einfachen, nicht übertragbaren Rechte ein, die zum Betrieb nötig sind (Speichern, Vervielfältigen für Sicherungen, technische Anpassung zur Anzeige, öffentliche Zugänglichmachung, soweit du Inhalte teilst oder veröffentlichst). Die Rechte enden mit der Löschung, ausgenommen Sicherungskopien bis zu deren Ablauf.",
        "(2) Du versicherst, dass du über die nötigen Rechte an deinen Inhalten verfügst, insbesondere an Bildern, Musik, Logos und an Fotos erkennbarer Personen (§§ 22, 23 KUG).",
        "(3) Vorlagen, Mustertexte und Formulare (z. B. Muttizettel, Impressum, Hausordnung) darfst du für eigene Zwecke kostenlos nutzen und anpassen.",
      ]],
      ["§ 6 Moderation von Inhalten (Art. 14 DSA)", [
        "(1) Wir prüfen Inhalte nicht vorab. Wir werden tätig, wenn uns rechtswidrige Inhalte oder Verstöße gegen diese Bedingungen gemeldet werden oder wir anderweitig davon erfahren.",
        "(2) Mögliche Maßnahmen sind: Entfernung oder Sperrung einzelner Inhalte, Beendigung von Freigaben und Gäste-Links, Depublizierung veröffentlichter Seiten, vorübergehende Einschränkung von Funktionen (z. B. KI, Teilen, Hosting), vorübergehende oder dauerhafte Sperrung des Kontos.",
        "(3) Wir entscheiden sorgfältig, objektiv und verhältnismäßig unter Berücksichtigung der Grundrechte aller Beteiligten, insbesondere der Meinungs- und Informationsfreiheit. Automatisierte Werkzeuge nutzen wir nur unterstützend (z. B. Erkennung von API-Schlüsseln, Entfernen von Skripten aus veröffentlichten Seiten, Spam-Begrenzung); Entscheidungen über Sperrungen trifft ein Mensch.",
        "(4) Bei Beschränkungen erhältst du eine klare und spezifische Begründung (Art. 17 DSA) mit Angaben zu Art und Umfang der Maßnahme, den Tatsachen, ob automatisierte Mittel eingesetzt wurden, der Rechtsgrundlage bzw. der verletzten Regel und deinen Möglichkeiten, dich dagegen zu wehren.",
        "(5) Gegen Entscheidungen kannst du innerhalb von sechs Monaten per E-Mail an {{email}} Widerspruch einlegen. Wir prüfen ihn zeitnah, nicht ausschließlich automatisiert, und teilen dir das Ergebnis mit. Der Rechtsweg zu den Gerichten bleibt unberührt.",
        "(6) Wer offensichtlich rechtswidrige Inhalte häufig bereitstellt oder offensichtlich unbegründete Meldungen häufig einreicht, kann nach vorheriger Warnung für einen angemessenen Zeitraum gesperrt werden.",
        "(7) Ergeben sich Hinweise auf eine Straftat, die eine Gefahr für das Leben oder die Sicherheit einer Person darstellt, informieren wir unverzüglich die Strafverfolgungsbehörden (Art. 18 DSA).",
      ]],
      ["§ 7 Melde- und Abhilfeverfahren (Art. 16 DSA)", [
        "(1) Jede Person kann Inhalte melden, die sie für rechtswidrig hält – über die Seite „Inhalte melden“ oder per E-Mail an {{email}}.",
        "(2) Eine Meldung sollte enthalten: eine hinreichend begründete Erklärung, warum der Inhalt rechtswidrig ist; die genaue Fundstelle (Link oder Beschreibung); Name und E-Mail-Adresse der meldenden Person (außer bei bestimmten Straftaten gegen Kinder); eine Erklärung, dass die Angaben nach bestem Wissen richtig und vollständig sind.",
        "(3) Wir bestätigen den Eingang, bearbeiten die Meldung zeitnah, sorgfältig, frei von Willkür und objektiv und teilen dir die Entscheidung mit Hinweis auf Rechtsbehelfe mit.",
      ]],
      ["§ 8 KI-Funktionen", [
        "(1) KI-Antworten, -Texte, -Kalkulationen und -Auswertungen werden automatisch erzeugt und können falsch, unvollständig oder veraltet sein. Sie sind keine Rechts-, Steuer-, Finanz- oder Sicherheitsberatung. Prüfe Ergebnisse, bevor du dich darauf verlässt, insbesondere Beträge, Fristen und Rechtshinweise.",
        "(2) Ergebnisse aus Belegen werden erst nach deiner Bestätigung übernommen. Du bleibst für die Richtigkeit deiner Kalkulation und deiner Veröffentlichungen verantwortlich.",
        "(3) Wenn du KI-erzeugte Texte, Bilder oder Inhalte veröffentlichst, beachte die Kennzeichnungspflichten aus Art. 50 der KI-Verordnung (EU) 2024/1689, insbesondere bei Deepfakes und bei Texten zu Angelegenheiten von öffentlichem Interesse.",
      ]],
      ["§ 9 Teilen, Links und Veröffentlichung", [
        "(1) Geteilte Links und veröffentlichte Seiten sind für alle zugänglich, die den Link kennen. Teile keine vertraulichen Daten über offene Links; nutze dafür Freigaben an bestimmte Google-Konten.",
        "(2) Du kannst Freigaben und Veröffentlichungen jederzeit beenden. Kopien, die Dritte bereits angefertigt haben, können wir nicht zurückholen.",
      ]],
      ["§ 10 Verfügbarkeit, Datensicherung", [
        "(1) Wir erstellen regelmäßige Sicherungen, schulden aber keine Wiederherstellung einzelner Daten. Sichere wichtige Inhalte zusätzlich selbst (Export als Datei, CSV, Kalender, Download).",
        "(2) Für Ausfälle verbundener Dienste (z. B. Eventfrog, Netlify, Google) sind wir nicht verantwortlich.",
      ]],
      ["§ 11 Haftung", [
        "(1) Wir haften unbeschränkt bei Vorsatz und grober Fahrlässigkeit, bei Verletzung von Leben, Körper oder Gesundheit, nach dem Produkthaftungsgesetz und soweit wir eine Garantie übernommen haben.",
        "(2) Bei leicht fahrlässiger Verletzung einer wesentlichen Vertragspflicht (Kardinalpflicht – eine Pflicht, deren Erfüllung die ordnungsgemäße Durchführung des Vertrags überhaupt erst ermöglicht und auf deren Einhaltung du regelmäßig vertrauen darfst) ist die Haftung auf den vertragstypischen, vorhersehbaren Schaden begrenzt.",
        "(3) Im Übrigen ist die Haftung für leichte Fahrlässigkeit ausgeschlossen. Da die Leistung unentgeltlich erbracht wird, haften wir zudem nur im Rahmen von §§ 521, 599 BGB entsprechend, soweit gesetzlich zulässig.",
        "(4) Die vorstehenden Beschränkungen gelten auch zugunsten unserer Erfüllungs- und Verrichtungsgehilfen.",
      ]],
      ["§ 12 Freistellung", [
        "Verletzt du schuldhaft Rechte Dritter oder gesetzliche Vorschriften durch deine Inhalte, stellst du uns von daraus folgenden Ansprüchen Dritter einschließlich angemessener Kosten der Rechtsverteidigung frei.",
      ]],
      ["§ 13 Laufzeit und Kündigung", [
        "(1) Der Nutzungsvertrag läuft auf unbestimmte Zeit. Du kannst ihn jederzeit ohne Frist beenden, indem du unter Einstellungen „Alle meine Daten löschen“ wählst oder uns schreibst.",
        "(2) Wir können den Vertrag mit einer Frist von vier Wochen ordentlich kündigen. Das Recht zur außerordentlichen Kündigung aus wichtigem Grund (z. B. schwere oder wiederholte Verstöße gegen § 4) bleibt unberührt.",
        "(3) Vor einer Beendigung durch uns kannst du deine Daten exportieren, sofern dem keine rechtlichen Gründe entgegenstehen.",
      ]],
      ["§ 14 Änderungen dieser Bedingungen", [
        "Wir können diese Bedingungen mit Wirkung für die Zukunft ändern, wenn ein triftiger Grund besteht (z. B. neue Funktionen, Gesetzesänderungen, Rechtsprechung). Über Änderungen informieren wir mindestens vier Wochen vorher in der App. Widersprichst du nicht innerhalb dieser Frist und nutzt du den Dienst weiter, gelten die geänderten Bedingungen; auf diese Folge weisen wir in der Mitteilung gesondert hin. Bei Widerspruch können beide Seiten den Vertrag beenden.",
      ]],
      ["§ 15 Schlussbestimmungen", [
        "(1) Es gilt das Recht der Bundesrepublik Deutschland unter Ausschluss des UN-Kaufrechts. Bei Verbraucherinnen und Verbrauchern gilt diese Rechtswahl nur, soweit dadurch der Schutz zwingender Bestimmungen des Staates ihres gewöhnlichen Aufenthalts nicht entzogen wird.",
        "(2) Sind einzelne Bestimmungen unwirksam, bleibt der Vertrag im Übrigen wirksam; an die Stelle der unwirksamen Bestimmung tritt die gesetzliche Regelung (§ 306 BGB).",
        "(3) Verbraucherschlichtung: siehe Impressum.",
      ]],
    ],
  },

  inhalte: {
    title: "Regeln für Inhalte & Melden",
    intro: "{{app}} ist für Planung, Zusammenarbeit und Veröffentlichung gedacht. Damit das für alle sicher bleibt, gelten diese Regeln für alles, was gespeichert, geteilt oder veröffentlicht wird. Hier steht auch, wie du rechtswidrige Inhalte meldest und was danach passiert (Art. 14–18 DSA).",
    sections: [
      ["Nicht erlaubt", [{ ul: [
        "Strafbare Inhalte, z. B. Volksverhetzung, Bedrohung, Beleidigung, Verleumdung, Verwendung verfassungswidriger Kennzeichen, Gewaltdarstellungen, Darstellungen sexuellen Missbrauchs.",
        "Jugendgefährdende oder pornografische Inhalte, besonders bei Angeboten, die sich an Jugendliche richten (z. B. Events ab 16).",
        "Verletzungen von Urheber-, Marken-, Persönlichkeits- und Bildrechten – z. B. fremde Fotos, Logos, Musik ohne Erlaubnis, Fotos von Personen ohne deren Einwilligung.",
        "Veröffentlichung privater Daten anderer (Adressen, Telefonnummern, Gästelisten) ohne Erlaubnis.",
        "Betrug, Phishing, gefälschte Ticketseiten, Fake-Bewertungen, irreführende Werbung.",
        "Schadsoftware, Angriffe, Umgehung von Sicherheitsmaßnahmen, Missbrauch des Hostings über den Nexus-Agent.",
        "Werbung für illegale Produkte, Glücksspiel ohne Erlaubnis, Verkauf von Alkohol oder Tabak an Minderjährige.",
      ] }]],
      ["Events mit Jugendlichen", [
        "Wer Events für unter 18-Jährige plant, beachtet das Jugendschutzgesetz (u. a. § 4 Aufenthalt in Gaststätten, § 5 Tanzveranstaltungen, § 9 Alkohol, § 10 Rauchen). Die Vorlage „Erziehungsbeauftragung (Muttizettel)“ und der Rechts-Check helfen dabei, ersetzen aber keine Prüfung im Einzelfall. Ausrichtende sind für Einlasskontrollen, Ausschank und Aufsicht selbst verantwortlich.",
      ]],
      ["So meldest du einen Inhalt", [
        "Nutze die Seite „Inhalte melden“ (Link unten) oder schreibe an {{email}}. Bitte gib an:",
        { ul: [
          "den genauen Link oder Ort des Inhalts (z. B. Adresse des geteilten Links oder der veröffentlichten Seite),",
          "warum du ihn für rechtswidrig hältst (möglichst mit der verletzten Vorschrift oder deinem verletzten Recht),",
          "deinen Namen und deine E-Mail-Adresse (bei Meldungen zu Darstellungen sexuellen Missbrauchs von Kindern nicht nötig),",
          "die Erklärung, dass deine Angaben nach bestem Wissen richtig und vollständig sind.",
        ] },
        "Wir bestätigen den Eingang, prüfen die Meldung und teilen dir unsere Entscheidung samt Begründung und möglicher Rechtsbehelfe mit. Wer Inhalte bereitgestellt hat, die wir beschränken, erhält ebenfalls eine Begründung.",
      ]],
      ["Was wir tun", [
        "Je nach Schwere entfernen oder sperren wir einzelne Inhalte, beenden Freigaben, depublizieren Seiten, schränken Funktionen ein oder sperren Konten. Bei Gefahr für Leib oder Leben informieren wir die Behörden. Missbräuchliche Meldungen können ebenfalls zu Einschränkungen führen.",
      ]],
      ["Widerspruch", [
        "Bist du mit einer Entscheidung nicht einverstanden, kannst du innerhalb von sechs Monaten per E-Mail widersprechen. Ein Mensch prüft den Fall erneut. Du kannst dich außerdem an eine zertifizierte außergerichtliche Streitbeilegungsstelle nach Art. 21 DSA wenden oder Gerichte anrufen. Zuständige Aufsichtsbehörde in Deutschland ist die Bundesnetzagentur als Koordinator für digitale Dienste.",
      ]],
      ["Transparenz", [
        "Wir sind ein Kleinstanbieter; die erweiterten Transparenzberichtspflichten für Online-Plattformen gelten für uns nach Art. 15 Abs. 2 und Art. 19 DSA nur eingeschränkt. Auf Anfrage geben wir Auskunft über Anzahl und Art bearbeiteter Meldungen.",
      ]],
    ],
  },

  ki: {
    title: "Hinweise zur KI",
    intro: "{{app}} nutzt Künstliche Intelligenz an vielen Stellen. Hier steht transparent, wo KI arbeitet, welche Anbieter dahinterstehen und worauf du achten solltest (Art. 50 KI-Verordnung (EU) 2024/1689).",
    sections: [
      ["Wo KI eingesetzt wird", [{ ul: [
        "KI-Assistent und KI-Copilot: Fragen beantworten, Pläne, Aufgaben, Nachrichten und Texte vorschlagen. Du interagierst dabei mit einem KI-System – nicht mit einem Menschen.",
        "Event-Assistent und Kalkulation: Pläne, Kosten, Szenarien, Abgleich mit Projekten.",
        "Belege & Verträge: Auslesen von Beträgen, Fristen und Warnungen aus hochgeladenen Dokumenten.",
        "Website-Baukasten, Marketing, Zusammenfassungen, Rechts-Check und Recht & Formulare: Texte und Hinweise.",
      ] }]],
      ["Anbieter", [
        "Standardmäßig Google Gemini (Google Ireland Limited) und Groq, Inc.; mit eigenem Schlüssel dein gewählter Anbieter (z. B. OpenAI, Anthropic). Welche Daten dabei übertragen werden, steht in der Datenschutzerklärung (Abschnitt 7).",
      ]],
      ["Grenzen", [
        "KI kann Fehler machen, Fakten erfinden oder veraltete Rechtsstände wiedergeben. Rechtliche Hinweise in der App beruhen auf hinterlegten Gesetzestexten mit Stand-Datum; prüfe sie dennoch im Einzelfall. KI-Ergebnisse werden nur nach deiner Bestätigung übernommen.",
      ]],
      ["Kennzeichnung deiner Veröffentlichungen", [
        "Veröffentlichst du mit KI erzeugte Inhalte, gilt für dich ggf. Art. 50 Abs. 4 KI-Verordnung: Deepfakes (realistisch wirkende, künstlich erzeugte Bilder, Videos oder Tonaufnahmen) und KI-Texte zur Information der Öffentlichkeit über Angelegenheiten von öffentlichem Interesse müssen offengelegt werden, sofern sie nicht menschlich überprüft und redaktionell verantwortet sind. Wir empfehlen einen kurzen Hinweis wie „Text mit KI-Unterstützung erstellt“.",
      ]],
    ],
  },

  cookies: {
    title: "Cookies & Speicher im Browser",
    intro: "Wir verwenden keine Werbe-, Tracking- oder Analyse-Cookies und brauchen deshalb kein Cookie-Banner. Gespeichert wird nur, was für die von dir aufgerufenen Funktionen unbedingt nötig ist (§ 25 Abs. 2 Nr. 2 TDDDG).",
    sections: [
      ["Was im Browser gespeichert wird", [{ ul: [
        "Anmeldesitzung (localStorage „cc-auth“): hält dich angemeldet, bis du dich abmeldest.",
        "Darstellung: Hell/Dunkel, Akzentfarbe, Schriftgröße, eingeklappte Menüs, zuletzt gewählte Ansichten.",
        "Entwürfe: z. B. Website-Baukasten, Event-Assistent, Kalkulation (nur auf diesem Gerät, bis du sie löschst).",
        "Überblick-Einstellungen geteilter Events (nur auf deinem Gerät).",
        "Offline-Kopie der App (Service Worker Cache) für schnelles Laden und Updates.",
        "Push-Abonnement, wenn du Benachrichtigungen erlaubst.",
      ] }]],
      ["Externe Inhalte", [
        "Beim Anmelden lädt Googles Anmeldeknopf Inhalte von accounts.google.com. Google kann dabei eigene Cookies setzen; es gelten die Datenschutzbestimmungen von Google. In heruntergeladenen Seiten aus dem Website-Baukasten werden Player von Spotify, YouTube oder SoundCloud nur eingebettet, wenn du das ausdrücklich einschaltest.",
      ]],
      ["Löschen", [
        "Du kannst den Speicher jederzeit in den Einstellungen deines Browsers löschen („Website-Daten löschen“). Danach musst du dich neu anmelden; Entwürfe, die nur lokal lagen, gehen dabei verloren.",
      ]],
    ],
  },

  barrierefreiheit: {
    title: "Erklärung zur Barrierefreiheit",
    intro: "Wir möchten, dass alle {{app}} nutzen können, und orientieren uns an den Web Content Accessibility Guidelines (WCAG) 2.1 Stufe AA bzw. der EN 301 549.",
    sections: [
      ["Was wir umsetzen", [{ ul: [
        "Bedienung per Tastatur, sichtbarer Fokus, Beschriftungen für Bildschirmleser (aria-label) bei Knöpfen und Eingabefeldern.",
        "Hell- und Dunkelmodus, einstellbare Schriftgröße, ausreichende Kontraste in den Standardfarben.",
        "Respektiert „Bewegung reduzieren“ des Betriebssystems; Animationen werden dann abgeschaltet.",
        "Anpassung an Handy, Tablet und Computer ohne seitliches Scrollen.",
        "Einfacher-Modus und KI-Stil „einfache Sprache“ für Erklärungen.",
      ] }]],
      ["Bekannte Einschränkungen", [{ ul: [
        "Diagramme sind teils nur grafisch dargestellt; die Zahlen stehen jedoch zusätzlich als Text daneben oder lassen sich als CSV herunterladen.",
        "Inhalte, die Nutzerinnen und Nutzer selbst erstellen oder veröffentlichen (z. B. Bilder ohne Alternativtext), können wir nicht vollständig prüfen.",
        "Googles Anmeldeknopf wird von Google bereitgestellt.",
      ] }]],
      ["Feedback", [
        "Ist dir eine Barriere aufgefallen? Schreib uns an {{email}}. Wir antworten in der Regel innerhalb von zwei Wochen und versuchen, das Problem zu beheben oder dir die Inhalte auf anderem Weg zugänglich zu machen.",
        "Das Barrierefreiheitsstärkungsgesetz (BFSG) verpflichtet seit 28. Juni 2025 bestimmte Dienstleistungen im elektronischen Geschäftsverkehr gegenüber Verbrauchern; Kleinstunternehmen sind von den Dienstleistungs-Pflichten ausgenommen (§ 3 Abs. 3 BFSG). Wir setzen Barrierefreiheit trotzdem freiwillig so weit wie möglich um.",
      ]],
    ],
  },
  veranstalter: {
    title: "Rechtsleitfaden für Veranstalter",
    intro: "Viele nutzen {{app}}, um Partys, Konzerte, Schul- und Vereinsevents zu planen. Dieser Leitfaden fasst die wichtigsten Rechtsfragen verständlich zusammen – mit den Fundstellen, damit du selbst nachlesen kannst. Er ist eine Orientierung, keine Rechtsberatung; Landesrecht, Auflagen der Gemeinde und der Mietvertrag der Location gehen vor.",
    sections: [
      ["1. Jugendschutz (JuSchG)", [
        "Öffentliche Tanzveranstaltungen: Kinder und Jugendliche unter 16 Jahren dürfen ohne personensorgeberechtigte oder erziehungsbeauftragte Person nicht anwesend sein; Jugendliche ab 16 Jahren ohne Begleitung höchstens bis 24 Uhr (§ 5 Abs. 1 JuSchG). Ausnahmen gelten für anerkannte Träger der Jugendhilfe sowie für künstlerische Betätigung oder Brauchtumspflege (§ 5 Abs. 2 JuSchG); die Behörde kann weitere Ausnahmen genehmigen (§ 5 Abs. 3 JuSchG).",
        "Erziehungsbeauftragung („Muttizettel“): Eine volljährige Person kann aufgrund einer Vereinbarung mit den Sorgeberechtigten Erziehungsaufgaben übernehmen (§ 1 Abs. 1 Nr. 4 JuSchG). Veranstalter müssen in Zweifelsfällen die Berechtigung prüfen (§ 2 Abs. 1 JuSchG) und das Lebensalter überprüfen (§ 2 Abs. 2 JuSchG). Die Vorlage unter Recht & Formulare enthält alle nötigen Angaben. Eine Person sollte nicht unrealistisch viele Jugendliche beaufsichtigen.",
        "Alkohol: Branntweinhaltige Getränke (auch Mischgetränke) dürfen an Kinder und Jugendliche nicht abgegeben werden; andere alkoholische Getränke wie Bier, Wein und Sekt erst ab 16 Jahren (§ 9 JuSchG). Rauchen und E-Zigaretten sind unter 18 untersagt (§ 10 JuSchG). Plane Ausschank, Bänder/Stempel nach Alter und Kontrollen ein.",
        "Aushang: Die für die Veranstaltung geltenden Vorschriften des Jugendschutzgesetzes sind deutlich sichtbar und gut lesbar bekannt zu machen (§ 3 Abs. 1 JuSchG).",
      ]],
      ["2. Tickets, Preise und Widerruf", [
        "Bei Tickets für Freizeitveranstaltungen mit festem Termin besteht kein gesetzliches Widerrufsrecht (§ 312g Abs. 2 Nr. 9 BGB). Informiere trotzdem klar über Erstattungen bei Absage, Verlegung oder Krankheit.",
        "Gegenüber Verbrauchern sind Gesamtpreise inklusive aller Pflichtgebühren anzugeben (Preisangabenverordnung). Weise Vorverkaufs-, System- oder Servicegebühren transparent aus.",
        "Fällt das Event aus, sind bezahlte Eintrittsgelder grundsätzlich zu erstatten. Halte für diesen Fall Kontakt- und Zahlungsdaten bereit (über deinen Ticketanbieter).",
        "Gutscheine, Gewinnspiele und Freikarten: Teilnahmebedingungen schriftlich festhalten; bei Gewinnspielen mit Minderjährigen besondere Vorsicht.",
      ]],
      ["3. Location, Sicherheit und Genehmigungen", [
        "Größere Veranstaltungen unterliegen den Versammlungsstättenverordnungen der Länder (in der Regel ab 200 Besucherinnen und Besuchern in Räumen). Dort stehen Vorgaben zu Rettungswegen, Notausgängen, Brandschutz, Ordnungsdienst und Sanitätsdienst. Kläre mit der Location, welche Pflichten sie übernimmt – trage das im Event-Formular unter „Sicherheit & Notfall“ ein.",
        "Für Veranstaltungen im Freien, Musik über Nachtzeiten, Straßennutzung oder Ausschank ohne Gaststättenerlaubnis können Genehmigungen der Gemeinde nötig sein (z. B. Gestattung nach § 12 Gaststättengesetz bzw. Landesrecht, Sondernutzungserlaubnis, Ausnahme vom Lärmschutz).",
        "Security: Gewerbliche Bewachung braucht eine Erlaubnis nach § 34a Gewerbeordnung. Faustregel aus der Praxis: mindestens zwei Ordner ab 100 Gästen, je weitere 100 Gäste eine Person – Auflagen der Behörde haben Vorrang.",
        "Versicherung: Eine Veranstalter-Haftpflichtversicherung deckt Personen- und Sachschäden ab; viele Locations verlangen sie im Mietvertrag.",
        "Notfallplan: Notfallkontakt, Sammelplatz, Erste-Hilfe-Material, Sanitätsdienst, Awareness-Ansprechperson und Erreichbarkeit der Location-Leitung festlegen. Das Event-Formular hat dafür eigene Felder.",
      ]],
      ["4. Musik und GEMA", [
        "Öffentliche Wiedergabe geschützter Musik ist bei der GEMA anzumelden – in der Regel vor der Veranstaltung. Die Kosten richten sich u. a. nach Raumgröße und Eintrittspreis. Auch DJ-Sets sind lizenzpflichtig; ggf. sind zusätzlich Vervielfältigungsrechte (z. B. für Kopien auf Laptops) zu klären. Plane den Betrag in der Kalkulation unter „GEMA“ ein.",
        "Livestreams und Mitschnitte brauchen gesonderte Rechte – sowohl für die Musik als auch für die Aufnahme der Künstlerinnen und Künstler.",
      ]],
      ["5. Fotos, Videos und Social Media", [
        "Bildnisse dürfen grundsätzlich nur mit Einwilligung verbreitet werden (§ 22 KUG); Ausnahmen gelten u. a. für Bilder von Versammlungen und ähnlichen Vorgängen, an denen die Personen teilgenommen haben (§ 23 Abs. 1 Nr. 3 KUG), nicht aber für Nahaufnahmen Einzelner. Bei Minderjährigen braucht es zusätzlich die Zustimmung der Eltern.",
        "Weise am Eingang und auf der Ticketseite darauf hin, dass fotografiert wird, wer verantwortlich ist und wie man widersprechen kann. Die Vorlage „Foto-Einwilligung“ unter Recht & Formulare hilft dabei.",
        "Verwende für Flyer, Websites und Posts nur Bilder, Logos und Schriften, an denen du die Rechte hast.",
      ]],
      ["6. Impressum, Datenschutz und Werbung", [
        "Event-Websites, Ticketseiten und geschäftsmäßige Social-Media-Profile brauchen ein Impressum (§ 5 DDG) und eine Datenschutzerklärung (Art. 13 DSGVO). Der Website-Baukasten erzeugt beides; prüfe die Angaben.",
        "Gästelisten, Helferlisten und Anmeldungen enthalten personenbezogene Daten: nur erheben, was nötig ist, sicher speichern und nach dem Event löschen. Geteilte Links nur an Personen geben, die die Daten brauchen.",
        "Werbe-Nachrichten per E-Mail oder Messenger nur mit Einwilligung der Empfänger (§ 7 UWG). Influencer- und Sponsoren-Posts als Werbung kennzeichnen.",
      ]],
      ["7. Geld, Steuern und Abrechnung", [
        "Einnahmen aus Events können einkommen- bzw. umsatzsteuerpflichtig sein; bei Vereinen und Schulen gelten Sonderregeln (z. B. Gemeinnützigkeit, Freigrenzen). Bewahre Belege auf – die Belege-Funktion hilft beim Sammeln, ersetzt aber keine Buchhaltung.",
        "Kleinunternehmerregelung (§ 19 UStG): Unterhalb der Umsatzgrenzen kann auf die Umsatzsteuer verzichtet werden; prüfe das vorab mit dem Finanzamt oder einer Steuerberatung.",
        "Barkasse: Einnahmen und Ausgaben am Abend dokumentieren (Abendkasse in Nexus), Wechselgeld festhalten, Kasse zu zweit zählen.",
      ]],
      ["8. Verträge mit Location, DJs und Dienstleistern", [
        "Halte Leistungen, Preise, Zahlungsfristen, Stornobedingungen, Haftung, Versicherung, Auf- und Abbauzeiten sowie Ansprechpersonen schriftlich fest. Lade Verträge unter „Belege & Verträge“ hoch – die KI markiert Fristen und Stornoklauseln und legt Aufgaben an.",
        "Minderjährige können Verträge mit finanziellen Pflichten grundsätzlich nur mit Zustimmung der gesetzlichen Vertreter wirksam schließen (§§ 107, 108 BGB). Lass Verträge in diesem Fall von einer volljährigen Person unterschreiben.",
      ]],
    ],
  },

  sicherheit: {
    title: "Sicherheit & Meldung von Schwachstellen",
    intro: "Sicherheit hat bei {{app}} Vorrang: Schlüssel liegen verschlüsselt, jede Person sieht nur ihre eigenen Daten und veröffentlichte Seiten laufen abgeschottet. Hier steht, wie wir schützen und wie du uns Sicherheitslücken meldest.",
    sections: [
      ["Wie wir deine Daten schützen", [{ ul: [
        "Verschlüsselte Übertragung (HTTPS/TLS) für alle Verbindungen.",
        "Zeilen-Sicherheitsregeln (Row Level Security) in der Datenbank: Zugriff nur auf eigene oder ausdrücklich freigegebene Daten.",
        "API-Schlüssel ausschließlich im Supabase Vault, nie im Browser sichtbar, beim Trennen gelöscht.",
        "Content-Security-Policy, keine eingebetteten Fremdskripte in der App, veröffentlichte Seiten ohne Skripte in einer Sandbox.",
        "Erkennung von Zugangsdaten in Texten und Dateien (z. B. .env, Schlüsseldateien) – sie werden nicht hochgeladen bzw. nicht an die KI gesendet.",
        "Rate-Limits für KI und Schnittstellen, Anmeldeprotokoll für Administratoren, nächtliche Sicherungen.",
        "Geräte-Agent: Dateizugriff und Befehle sind auf dem Gerät standardmäßig aus und müssen dort bewusst freigeschaltet werden.",
      ] }]],
      ["Was du selbst tun kannst", [{ ul: [
        "Schütze dein Google-Konto mit Zwei-Faktor-Anmeldung.",
        "Verbinde nur API-Schlüssel mit Leserechten, wo möglich (z. B. GitHub „Fine-grained“ nur lesen).",
        "Teile vertrauliche Inhalte nur an bestimmte Personen, nicht über offene Links; beende alte Freigaben.",
        "Melde dich auf fremden Geräten ab.",
      ] }]],
      ["Schwachstelle gefunden? (Responsible Disclosure)", [
        "Bitte melde vermutete Sicherheitslücken vertraulich an {{email}} mit einer kurzen Beschreibung, den Schritten zum Nachvollziehen und deiner Kontaktmöglichkeit. Wir bestätigen den Eingang in der Regel innerhalb von 72 Stunden und halten dich über die Behebung auf dem Laufenden.",
        "Bitte greife dabei nicht auf fremde Daten zu, verändere oder lösche keine Daten, führe keine Last- oder Social-Engineering-Tests durch und veröffentliche Details erst nach der Behebung. Wer sich daran hält, muss von uns keine rechtlichen Schritte befürchten; wir nennen dich auf Wunsch gern als Finder.",
      ]],
    ],
  },
};

export const LEGAL_TITLES = Object.fromEntries(LEGAL_ORDER.map((k) => [k, TEXTS[k].title]));
