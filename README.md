# JOPML Nexus

**Kostenloses Kontrollzentrum für Events, Projekte, Websites und KI – auf Deutsch, ohne Tracking, Daten in Frankfurt.**

[![Live](https://img.shields.io/badge/App-öffnen-8b5cf6)](https://jrn1401.github.io/jopml-nexus/)
[![Funktionen](https://img.shields.io/badge/Alle_Funktionen-ansehen-ec4899)](https://jrn1401.github.io/jopml-nexus/start.html)
[![Website-Baukasten](https://img.shields.io/badge/Website--Baukasten-starten-22c55e)](https://jrn1401.github.io/jopml-nexus/bau.html)
[![Handy-App](https://img.shields.io/badge/Handy--App-Nexus_Mobil-0ea5e9)](https://jrn1401.github.io/jopml-nexus/m.html)

> Partys und Veranstaltungen durchrechnen (Break-even, Minimum/Durchschnitt/Maximum), Tickets live verfolgen,
> Rechnungen per KI auslesen, Aufgaben im Team verteilen, Websites mit Impressum bauen – und alles per Link teilen.

---

## Schnellstart

1. **[App öffnen](https://jrn1401.github.io/jopml-nexus/)** und mit Google anmelden – oder ohne Konto als Gast ausprobieren (7 Tage).
2. **Event anlegen**: Fragebogen beantworten, Text/WhatsApp einfügen oder der KI einen Satz sagen.
3. **Event-Formular** ausfüllen: Tickets, Location, Kosten, Bar, Garderobe, Sicherheit. Oben siehst du live Ergebnis und Break-even.
4. **Teilen**: „Teilen“ › „Alles zeigen“ – der Link bleibt gleich, der Inhalt aktualisiert sich.

## Was du machen kannst

| Modul | Was es kann |
|---|---|
| **Events** (Fokus) | Ein Formular für alles; Kalkulation mit **Rechenweg**; Min/Ø/Max; „Wo kommt das Minus her?“; Tickets live (Eventfrog) mit Tempo und Prognose; **Belege & Verträge per KI**; Abrechnung Plan → Ist; Aufgaben, Ablauf, Schichten, Locations, Technik, Posting-Plan, Gäste; Abendkasse; CSV, Kalender, Duplizieren |
| **Projekte & Module** | Checklisten, Tabellen, Kennzahlen, Zeitleisten, Links; Module als eigene Website teilen; „Mit KI ändern“; Import aus Claude |
| **Aufgaben & Kalender** | Eingabe in Alltagssprache („morgen 18 Uhr … !“), Erinnerungen, Kalender-Abo, KI-Priorisierung |
| **Website-Baukasten** | Showroom mit Beispielseiten, 10 Designs, Animationen, Preise/Tickets, Team, Öffnungszeiten, Video, Karte, Kontaktformular, SEO/Google-Vorschau, automatisches Impressum & Datenschutz; herunterladen oder online stellen |
| **Websites** | Live-Besucher (cookiefrei), Erreichbarkeit, Netlify-Deploys, Statusseite, Kurzlinks mit QR |
| **KI-Studio** | Projekt-Assistent mit Rechts-Check, Marketing (Plakate, Posts, Visitenkarten), Zusammenfassungen, eigene KI-Schlüssel |
| **Recht & Formulare** | Fragen mit aktuellen Gesetzestexten, Muttizettel, Foto-Einwilligung, Hausordnung, Impressum-Generator |
| **Teilen** | Links ohne Konto, Freigaben an Google-Konten, Rechte pro Bereich, eigener Überblick für Empfänger |
| **Verbindungen & Geräte** | Netlify, GitHub, Vercel, Supabase, Eventfrog, Gemini, Groq, OpenAI, Anthropic; Raspberry Pi/PC mit Werten, Dateien, Hosting |
| **Handy-App** | Nexus Mobil mit Push, Überblick des nächsten Events, Zugang für Helfer |

## Aufbau des Repositorys

```
index.html        App (Anmeldung, Admin-Bereich, Nutzer-Bereich)      → app.js
start.html        Öffentliche Startseite mit allen Funktionen (SEO)
bau.html          Website-Baukasten                                   → builder.js
m.html            Handy-App „Nexus Mobil“                             → mobile.js, mobile.css
w.html / i.html   Veröffentlichte Seiten / Einladungen (Sandbox)       → site.js, invite.js
views/            Seiten der App (event.js, wsevents.js, project.js, legal.js, …)
lib/              Bausteine: ui.js, api.js, eventcalc.js (Kalkulation), eventdocs.js (Belege),
                  progen.js + showroom.js (Websites), legaltexts.js (Rechtstexte), aigen.js (KI) …
skills/           Claude-Skills (nexus-sync, nexus-board) zum Übertragen aus Claude
agent/            Nexus-Agent für Raspberry Pi/PC (Werte, Dateien, Hosting)
tools/            Hilfsskripte
sw.js             Service Worker (Offline, Updates)
```

Backend: Supabase (Postgres mit Row Level Security, Auth, Vault, Storage, Edge Functions `nx-api`, `cc-api`, `nx-push` u. a.), Rechenzentrum Frankfurt.
Die Website ist statisch (GitHub Pages), ohne Build-Schritt: reines HTML/CSS und ES-Module.

## Datenschutz & Sicherheit

- Jede Person sieht nur ihre eigenen Daten (RLS). API-Schlüssel liegen ausschließlich verschlüsselt im Supabase Vault.
- Keine Werbung, kein Tracking, keine Analyse-Cookies. Veröffentlichte Seiten laufen ohne Skripte in einer Sandbox.
- Im Repository sind **keine geheimen Schlüssel**; der Supabase-anon-Schlüssel in `config.js` ist bewusst öffentlich.
- Rechtstexte: [Impressum](https://jrn1401.github.io/jopml-nexus/#/impressum) · [Datenschutz](https://jrn1401.github.io/jopml-nexus/#/datenschutz) · [AGB](https://jrn1401.github.io/jopml-nexus/#/agb) · [Inhalte melden](https://jrn1401.github.io/jopml-nexus/#/melden) · [Sicherheit](https://jrn1401.github.io/jopml-nexus/#/sicherheit)
- Sicherheitslücken bitte vertraulich melden – siehe [SECURITY.md](SECURITY.md).

## Entwickeln

```bash
python3 -m http.server 8000   # im Repository-Ordner, dann http://localhost:8000
npx eslint -c eslint.config.mjs app.js lib views mobile.js builder.js
```

Änderungen: siehe [CHANGELOG.md](CHANGELOG.md).
