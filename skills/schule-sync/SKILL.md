---
name: schule-sync
description: "Baut aus einem Schulordner bzw. Schul-Projekt eine Lernseite als Claude-Artefakt und trägt den Link mit Thema, Fach und Halbjahr in JOPML Nexus › Schule ein. Nutzen bei „Schule syncen“, „Thema ins Nexus“."
---

# schule-sync – Schulordner → Lernseite (Artefakt) → Link im JOPML Nexus

Ziel: Für jedes Thema gibt es **eine Lernseite als Claude-Artefakt**. Der Link dazu steht im Nexus auf der Seite **Schule** (https://jrn1401.github.io/jopml-nexus/#/schule), mit Thema, Fach, Halbjahr (und optional Klasse, Klausurdatum, Kurzbeschreibung). Dort lässt sich nach Fach, Halbjahr, Thema und Klausur sortieren und filtern. Gleiches Fach + Thema erneut übertragen = der Link wird aktualisiert, nicht doppelt angelegt.

Grundregeln:
- **Nichts erfinden.** Inhalte kommen aus dem Material. Was du ergänzt (Erklärung, Beispiel, Aufgabe), muss fachlich korrekt und auf dem Niveau des Kurses sein. Jede Lösung nachrechnen.
- Keine Namen von Mitschülern, keine Noten anderer, keine Passwörter.
- Deutsch, kurze klare Sätze, für jemanden, der bei null anfängt.

## 0. Voraussetzung

Supabase-Werkzeug zum Ausführen von SQL (meist `execute_sql`, per ToolSearch „supabase execute_sql“). Projekt-ID: `qeomooxbfpwvcprvmows`. Fehlt es: Lernseite trotzdem bauen und veröffentlichen, dann dem Nutzer Thema, Fach, Halbjahr und Link nennen – er trägt sie auf der Seite Schule mit **„Link hinzufügen“** ein.

## 1. Abgleichen (zuerst)

`select public.cc_school_context();` → vorhandene Fächer und Einträge (Fach, Thema, Halbjahr, Link).
- Fach schon vorhanden → **genau diesen Fachnamen** verwenden (z. B. „Mathematik“, nicht „Mathe“). Fachnamen ausschreiben: Mathematik, Deutsch, Englisch, Französisch, Spanisch, Biologie, Chemie, Physik, Informatik, Geschichte, Politische Bildung, Geografie, Psychologie, Sporttheorie, Kunst, Musik, LER, Wirtschaftswissenschaften.
- Thema schon vorhanden → **gleichen Themennamen** verwenden; gibt es schon ein Artefakt dazu, dieses aktualisieren statt ein neues zu bauen.

## 2. Material sammeln

- claude.ai-Projekt: `project_info`, dann jedes Dokument mit `project_read` lesen (Bilder ansehen: `original: true`). Ordner auf dem Rechner: auflisten und lesen, keine Zugangsdaten öffnen.
- Notieren: Thema, Fach, **Halbjahr** (Schreibweise wie in der Schule, z. B. `11/1`, `11/2`, `Q1`), Klasse, Klausurtermin, Klausuraufbau, Lehrbuchseiten, welche Fotos/Blätter zu welchem Kapitel gehören.
- Mehrere Themen im Ordner → je Thema eine Lernseite und ein Eintrag.

## 3. Lernseite als Artefakt bauen

Aufbau wie die Vorlage „Lernatlas Funktionsuntersuchung“ (https://claude.ai/artifact/W72QDhb9AhCqfWSfq5H7uz):
- Kopfzeile mit Titel und „Fach Kurs · Klasse · Halbjahr“, links ein Register mit allen Kapiteln, auf dem Handy eine Kapitel-Auswahl.
- Startseite: kurze Einleitung, Klausuraufbau (z. B. Teil A ohne / Teil B mit Hilfsmitteln), Tabelle „Lernweg und Materialien“ (# · Thema · Teil · Fotos · Internet).
- Je Kapitel: „Kurz gesagt“ (2–4 Merksätze), Merke-Kästen, Rechenweg an einem Beispiel aus dem Unterricht, Tabellen/Graphen, typische Fehler, **Aufgaben mit aufklappbarer Lösung** (ohne/mit Taschenrechner), „Erklärung im Internet“ (nur echte, geprüfte Links), „Aus dem Unterricht“ (Fotos zum Vergrößern), Zurück/Weiter.
- Letzte Seite „Alle Materialien und Quellen“.
- In Nicht-Mathe-Fächern genauso: Merke = Kernbegriffe, Tabellen für Vergleiche und Zeitleisten, Aufgaben = Klausurfragen mit Musterantwort (Operatoren beachten).
- Fotos aus dem Ordner direkt ins Artefakt aufnehmen (als Dateien des Artefakts), damit die Seite vollständig ist.

Veröffentlichen mit dem Artefakt-Werkzeug und den **Link** (`https://claude.ai/artifact/…` bzw. der vom Werkzeug genannte Link) übernehmen. Der Nutzer muss das Artefakt ggf. selbst teilen/veröffentlichen, damit der Link auch auf anderen Geräten aufgeht – darauf im Abschluss hinweisen.

## 4. Link im Nexus eintragen

```sql
select public.cc_school_link_upsert($j${"fach":"Mathematik","thema":"Funktionsuntersuchung","halbjahr":"11/1","klasse":"11","url":"https://claude.ai/artifact/…","beschreibung":"14 Kapitel mit Aufgaben und Lösungen, Klausur Teil A/B","klausur":"2026-12-10"}$j$::jsonb);
```
- Pflicht: `fach`, `thema`, `url` (nur claude.ai bzw. claude.site). Optional: `halbjahr`, `klasse`, `beschreibung` (1 Satz, max. 600 Zeichen), `klausur` (Datum `JJJJ-MM-TT`, nur wenn bekannt).
- Gleiches Fach + Thema → Link und Angaben werden aktualisiert (leere Felder überschreiben nichts).
- Ergebnis: `created` (neu oder aktualisiert) und `seite`.

## 5. Abschluss (kurz)

- Fach › Thema · Halbjahr, neu oder aktualisiert.
- Link zur Lernseite und zur Übersicht: https://jrn1401.github.io/jopml-nexus/#/schule
- Was mangels Material fehlt (z. B. „Kapitel e-Funktion: noch kein Unterrichtsmaterial“).
