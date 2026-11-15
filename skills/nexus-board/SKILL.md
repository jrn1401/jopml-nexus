---
name: "nexus-board"
description: "Erstellt aus dem aktuellen Chat oder Projekt einen Nexus-Steckbrief (Kennzahlen, Diagramme, Listen) zum Einfügen in JOPML Nexus – für jedes Konto, ohne Admin-Zugang."
---

# nexus-board – Steckbrief für JOPML Nexus

Nexus (https://jrn1401.github.io/jopml-nexus/) zeigt Projekte als übersichtliche Kacheln und lässt sie gezielt teilen. Dieser Skill macht aus dem, was im Chat oder im Claude-Projekt steht, einen **Steckbrief**, den die Person in Nexus unter **„Aus Claude oder Text einfügen“** einfügt. Er funktioniert für jedes Thema: Online-Shop, Schulprojekt, Server, API-Nutzung, Finanzen, Hobby, Verein …

## Vorgehen

1. **Inhalt sammeln.** Den bisherigen Chat auswerten; in einem Claude-Projekt zusätzlich die Projekt-Dokumente lesen. Nur echte Angaben übernehmen (Zahlen, Termine, Aufgaben, Entscheidungen, Links). Nichts erfinden oder schätzen. Keine Passwörter, API-Schlüssel, Kontonummern oder Gesundheitsdaten.
2. **Kacheln wählen** – nur solche, für die es echte Daten gibt, das Wichtigste zuerst, höchstens 12:
   - `{"type":"stats","title":"Kennzahlen","items":[{"label":"Umsatz Monat","value":4280,"unit":"€"}]}` – die 2–6 wichtigsten Werte
   - `{"type":"chart","title":"…","chart":"bar","labels":["Aug","Sep"],"series":[{"name":"Umsatz","values":[2100,2900]}],"unit":"€"}` – `bar` zum Vergleichen, `line` für Verläufe über Zeit, `donut` für Anteile
   - `{"type":"progress","title":"…","items":[{"label":"Kapitel gelernt","value":7,"max":12}]}`
   - `{"type":"timeline","items":[{"date":"2026-11-20","title":"Abgabe","done":false}]}`
   - `{"type":"checklist","title":"Aufgaben","items":[{"text":"…","done":false}]}`
   - `{"type":"table","title":"…","columns":["…"],"rows":[["…"]]}`
   - `{"type":"markdown","title":"Wichtigste Punkte","content":"- …"}`
   - `{"type":"links","items":[{"title":"…","url":"https://…"}]}` – nur echte Links
   Jede Kachel bekommt einen klaren `title` – beim Teilen kann man in Nexus einzelne Kacheln auswählen (z. B. nur „Kennzahlen“ für Kunden, nur „Aufgaben“ fürs Team).
3. **Steckbrief ausgeben** – genau ein JSON-Codeblock in dieser Form:
   ```json
   {"nexus": {"name": "Sneaker-Shop", "slug": "sneaker-shop", "kind": "shop", "description": "2–3 Sätze Zusammenfassung", "url": "https://… (optional)", "widgets": [ … ]}}
   ```
   - `kind`: `shop` · `school` · `business` · `personal` · `website` · `app` · `server` · `api` · `finance` · `event` · `other`
   - `slug`: kurz, stabil, aus dem Thema (a-z, 0-9, Bindestrich). Gleicher `slug` = Nexus aktualisiert das vorhandene Projekt statt ein zweites anzulegen. Bei einem Update denselben `slug` wie beim ersten Mal verwenden.
4. **Anleitung dazu (kurz):** „Kopiere den Block → Nexus öffnen → Übersicht → ‚Aus Claude oder Text einfügen‘ → einfügen → Vorschau → Speichern. Danach kannst du mit ‚Teilen‘ → ‚KI-Vorschläge‘ genau die passenden Kacheln teilen.“ Sagen, welche Kacheln erstellt und was mangels Daten weggelassen wurde.

## Hinweise

- Server- und API-Übersichten: Kennzahlen wie Auslastung, Kosten, Anfragen, Fehler als `stats`/`chart`; Schlüssel selbst niemals – die verbindet man in Nexus unter „Verbindungen“, dort werden sie verschlüsselt gespeichert.
- Ohne echte Zahlen keine Diagramme erzwingen; dann `markdown`, `checklist` und `timeline` verwenden.
- Gibt es im Chat schon einen früheren Steckbrief, diesen aktualisieren (gleicher `slug`) statt neu zu beginnen.