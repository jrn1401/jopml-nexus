---
name: nexus-sync
description: Überträgt Inhalte aus Chats und Claude-Projekten (Projekte, Zahlen, Termine, Aufgaben, Events) ins JOPML Nexus – erstellt einen Steckbrief zum Einfügen, für jedes Konto.
---

# nexus-sync – alles aus Claude ins JOPML Nexus

JOPML Nexus (https://jrn1401.github.io/jopml-nexus/) ist ein KI-Kontrollzentrum: Projekte, Server, Websites, Events und Aufgaben übersichtlich sehen und gezielt teilen. Dieser Skill sammelt, was im Chat oder im Claude-Projekt steht, und erstellt daraus einen **Steckbrief**. Die Person fügt ihn in Nexus unter **„Aus Claude oder Text einfügen“** ein. Gleicher `slug` = das vorhandene Projekt wird aktualisiert, Aufgaben und Event-Einträge werden ergänzt statt doppelt angelegt.

## Wann verwenden
Immer, wenn jemand etwas „ins Nexus“ übertragen, „synchronisieren“ oder „als Übersicht speichern“ will – egal welches Thema (Shop, Schule, Server, API-Nutzung, Finanzen, Event, Hobby).

## Vorgehen
1. **Inhalt sammeln.** Den Chat auswerten; in einem Claude-Projekt auch die Projekt-Dokumente lesen. Nur echte Angaben (Zahlen, Termine, Aufgaben, Beträge, Entscheidungen, Links). Nichts erfinden oder schätzen. **Niemals** Passwörter, API-Schlüssel, Tokens, Kontonummern oder Gesundheitsdaten übernehmen.
2. **Kacheln** für die Übersicht wählen (nur mit echten Daten, Wichtigstes zuerst, max. 12, jede mit klarem `title`):
   - `{"type":"stats","title":"Kennzahlen","items":[{"label":"Umsatz Monat","value":4280,"unit":"€"}]}`
   - `{"type":"chart","title":"…","chart":"bar|line|donut","labels":["…"],"series":[{"name":"…","values":[1,2]}],"unit":"€"}`
   - `{"type":"progress","title":"…","items":[{"label":"…","value":3,"max":10}]}`
   - `{"type":"timeline","items":[{"date":"2026-11-20","title":"…","done":false}]}`
   - `{"type":"checklist","title":"…","items":[{"text":"…","done":false}]}`
   - `{"type":"table","title":"…","columns":["…"],"rows":[["…"]]}`
   - `{"type":"markdown","title":"…","content":"- …"}`
   - `{"type":"links","items":[{"title":"…","url":"https://…"}]}`
3. **Aufgaben** (optional): echte To-dos als `tasks` – `{"title":"…","due":"2026-11-20T18:00","priority":2}` (`priority` 2 = wichtig, 1 = normal, 0 = irgendwann).
4. **Event** (optional, bei Partys, Konzerten, Treffen …): als `event` – Nexus findet ein vorhandenes Event mit gleichem Namen und ergänzt es:
   `{"name":"…","date":"2027-01-09T19:00","location":"…","capacity":200,"ticket_price":12,"items":[{"kind":"task|schedule|cost|income|guest|shift","title":"…","amount":300,"at":"…","note":"…"}]}`
5. **Ausgeben** – genau ein JSON-Codeblock:
   ```json
   {"nexus": {"name": "…", "slug": "kurz-und-stabil", "kind": "shop|school|business|personal|website|app|server|api|finance|event|other", "description": "2–3 Sätze", "url": "https://… (optional)", "widgets": [ … ], "tasks": [ … ], "event": { … }}}
   ```
   Leere Teile weglassen. Bei späteren Updates denselben `slug` verwenden.
6. **Kurze Anleitung dazu:** „Block kopieren → Nexus öffnen → Übersicht → ‚Aus Claude oder Text einfügen‘ → einfügen → Vorschau → Speichern. Teilen geht danach über ‚Teilen‘ → ‚KI-Vorschläge‘.“ Sagen, was übertragen und was mangels Daten weggelassen wurde.

## Hinweise
- Server/API-Übersichten: Auslastung, Kosten, Anfragen, Fehler als `stats`/`chart`. Schlüssel nie in den Steckbrief – die verbindet man in Nexus unter „Verbindungen“ (dort verschlüsselt gespeichert).
- Ohne echte Zahlen keine Diagramme erzwingen; dann `markdown`, `checklist`, `timeline`.
