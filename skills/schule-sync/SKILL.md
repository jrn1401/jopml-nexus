---
name: schule-sync
description: "Überträgt einen Schulordner bzw. ein Schul-Projekt als Lernatlas (Thema mit Kapiteln, Regeln, Aufgaben mit Lösung, Unterrichtsfotos, Links) in JOPML Nexus › Schule, nach Fach sortiert. Nutzen bei „Schule syncen“, „Thema ins Nexus“, „Lernatlas“."
---

# schule-sync – Schulordner → Lernatlas im JOPML Nexus

Ziel: Aus dem Material eines Schul-Projekts (Arbeitsblätter, Tafelfotos, Hefteinträge, Notizen, Klausurhinweise) entsteht **ein Lernatlas pro Thema** auf der Nexus-Seite **Schule** (https://jrn1401.github.io/jopml-nexus/#/schule). Jedes Fach ist dort ein Projekt, jedes Thema ein Modul. Gleiches Thema erneut übertragen = aktualisieren; der Lernstand („sitzt / unsicher / prüfen“), den der Nutzer auf der Seite setzt, bleibt erhalten.

Grundregeln:
- **Nichts erfinden.** Inhalte kommen aus dem Material. Was du selbst ergänzt (Erklärung, Beispiel, Aufgabe), muss fachlich korrekt und auf dem Niveau des Kurses sein. Rechne jede Lösung nach.
- Keine Namen von Mitschülern, keine Noten anderer, keine Passwörter.
- Sprache: Deutsch, kurze klare Sätze, für jemanden, der bei null anfängt.

## 0. Voraussetzung

Ein Supabase-Werkzeug zum Ausführen von SQL (meist `execute_sql`, per ToolSearch „supabase execute_sql“). Projekt-ID: `qeomooxbfpwvcprvmows`. Fehlt es: dem Nutzer sagen, er soll in Claude unter Einstellungen › Connectors Supabase verbinden – oder das fertige JSON als Datei ausgeben, damit er es in einem Chat mit Verbindung übertragen kann.

## 1. Abgleichen (Pflicht, zuerst)

`select public.cc_school_context();`
Liefert vorhandene Fächer, je Fach die Themen mit `module_id` und den Kapitel-IDs, plus ältere Schulprojekte.
- Gibt es das Fach schon, **genau diesen Fachnamen** verwenden (z. B. „Mathematik“, nicht „Mathe“).
- Gibt es das Thema schon, **genau diesen Themennamen** und **dieselben Kapitel-IDs** verwenden – sonst geht der Lernstand verloren.
- Fachnamen ausschreiben: Mathematik, Deutsch, Englisch, Französisch, Spanisch, Biologie, Chemie, Physik, Informatik, Geschichte, Politische Bildung, Geografie, Psychologie, Sporttheorie, Kunst, Musik, LER, Wirtschaftswissenschaften.

## 2. Material sammeln

- claude.ai-Projekt: `project_info`, dann jedes Dokument mit `project_read` lesen (Bilder ansehen: `original: true`). Ordner auf dem Rechner: auflisten und lesen (Geräte-Werkzeuge), keine Zugangsdaten öffnen.
- Für jedes Foto/Blatt notieren: **exakter Dateiname** (mit Endung, so wie er im Ordner heißt), was darauf ist, zu welchem Kapitel es gehört.
- Klausurtermin, Klausuraufbau (z. B. Teil A ohne / Teil B mit Hilfsmitteln), Lehrbuchseiten.
- Mehrere Themen im Ordner → mehrere Lernatlanten (je ein Aufruf).

## 3. Lernatlas bauen (JSON)

```json
{
  "fach": "Mathematik", "kurs": "Grundkurs", "klasse": "11", "halbjahr": "Q1", "land": "Brandenburg",
  "thema": "Funktionsuntersuchung",
  "lead": "1–2 Sätze: wofür der Atlas ist und wie man ihn durchgeht.",
  "exam": {"title": "Die Klausur hat zwei Teile", "parts": [
    {"teil": "A", "label": "Teil A · ohne Hilfsmittel", "text": "Kein Taschenrechner. Kurze Aufgaben: …"},
    {"teil": "B", "label": "Teil B · mit Hilfsmitteln", "text": "Taschenrechner und Formelsammlung. …"}]},
  "timeline": [{"date": "2026-12-10", "title": "Klausur", "note": "Kapitel 1–10", "done": false}],
  "chapters": [
    {"id": "extrema", "title": "Monotonie und Extrempunkte", "nav": "Monotonie und Extrempunkte",
     "group": "Teil A · ohne Hilfsmittel", "teil": "A", "done": true,
     "lead": "Ein Satz, worum es geht.",
     "kurz": ["2–4 Merksätze für „Kurz gesagt“"],
     "html": "… Kapitelinhalt, siehe unten …",
     "links": [{"title": "Extremwerte berechnen", "url": "https://studyflix.de/…"}],
     "photos": [{"file": "tafel-extrema.jpg", "caption": "Tafel: Extrema", "sub": "Lb. S. 114"}, {"file": "ab-blatt2.jpg", "caption": "Arbeitsblatt 2", "doc": true}]}
  ],
  "sources": [{"title": "Rahmenlehrplan …", "url": "https://…"}]
}
```

Felder:
- `id`: kurz, a–z/0–9/-, **stabil** (bei Updates gleich lassen). `nav`: kurzer Titel fürs Register (optional). `group`: Überschrift im Register (z. B. Teil A / Teil B / „Üben und Material“). `teil`: `A`, `B`, `A+B` oder weglassen. `done`: im Unterricht schon behandelt (false = „kommt noch“).
- `photos.file` = **exakter Dateiname aus dem Ordner** – darüber ordnet die Seite die hochgeladenen Fotos zu. `doc: true` für Hochformat-Blätter.
- `links`: nur echte, erreichbare Erklärseiten (studyflix, serlo, mathebibel, Lehrer-Schmidt-Video, Bildungsserver). Vorher prüfen, wenn Websuche verfügbar ist.
- Ein Kapitel „Klausurtraining“ mit gemischten Aufgaben am Ende ist sinnvoll. Ein Kapitel „Alle Materialien“ baut die Seite selbst.

### Kapitel-HTML (nur diese Bausteine; alles andere wird entfernt)

Erlaubt: `p h3 h4 ul ol li b i sub sup small span div table thead tbody tr th td details summary a figure figcaption code blockquote mark br hr`. Keine Bilder, Skripte, Styles, Formulare – Fotos gehören in `photos`.

| Baustein | HTML |
|---|---|
| Zwischenüberschrift | `<h3>Symmetrie</h3>` |
| Merke (roter Heftrand) | `<div class="rule"><span class="rt">Merke</span><ul><li>…</li></ul></div>` |
| Achtung / typischer Fehler | `<p class="note"><b>Achtung:</b> …</p>` |
| Formel im Text | `<span class="m">f(<i>x</i>) = <i>x</i>³ − 3<i>x</i></span>` (Variablen kursiv, echte Zeichen − · ² ³ ≤ ≥ → √ π) |
| Bruch | `<span class="frac"><span>Zähler</span><span>Nenner</span></span>` |
| Formel-Kasten | `<div class="formula">x = −p/2 ± √((p/2)² − q)</div>` |
| Rechenweg | `<ol class="steps"><li><div>Schritt 1</div></li>…</ol>` |
| Tabelle | `<div class="tbl"><table><thead><tr><th>…</th></tr></thead><tbody><tr><td>…</td></tr></tbody></table></div>` |
| Aufgabe mit Lösung | `<div class="ex"><div class="ex-h"><b>Aufgabe 1</b><span class="chip hmf">ohne TR</span></div><p>Aufgabe …</p><details class="sol"><summary>Lösung anzeigen</summary><div class="sol-body"><ol><li>…</li></ol><p class="ans">Ergebnis</p></div></details></div>` |
| mit Taschenrechner | `<span class="chip gtr">mit TR</span>` |
| Graph | `<figure class="plotbox"><div data-plot='{"x":[-3,3],"y":[-4,4],"xs":1,"ys":1,"fns":[{"f":"x^3-3x","l":"f(x) = x³ − 3x"},{"f":"3x^2-3","c":"f1","dash":1,"l":"f′(x)"}],"pts":[[-1,2,"HP(−1 | 2)"],[1,-2,"TP(1 | −2)"]],"vl":[0]}'></div><figcaption>Bildunterschrift</figcaption></figure>` |
| Funktionslabor (Schieber für ax³+bx²+cx+d) | `<div data-lab="kubisch"></div>` |
| Link auf anderes Kapitel | `<a href="#nullstellen">Nullstellen</a>` |

Graph-Angaben: `f` als Rechenausdruck in x (`x^2`, `2x`, `3x(x-2)`, `exp(-x)`, `sqrt(x)`, `sin(x)`, `ln(x)`, `pi`, `e`), Farbe `c`: `f` blau (Standard), `f1` orange, `f2` grün, `aux` lila, `red`; `dash:1` gestrichelt, `w` Linienbreite, `from`/`to` Definitionsbereich; `pts` = `[x, y, "Beschriftung", "farbe"]`; `vl` = senkrechte Hilfslinien; `polys` = `[{"pts":[[x,y],…],"c":"f1"}]` für Flächen; `h` Höhe (Standard 360). Achsen-Schritte `xs`/`ys`. Punkte vorher ausrechnen und prüfen.

Aufbau eines Kapitels (wie die Vorlage „Lernatlas Funktionsuntersuchung“): Merke-Kästen mit den Regeln → Rechenweg an einem Beispiel aus dem Unterricht → ggf. Graph oder Tabelle → typische Fehler (`note`) → „Aufgaben“ (3–5, mit ohne/mit TR, jede mit vollständiger Lösung) → Links → Fotos. In Nicht-Mathe-Fächern genauso: Merke = Kernbegriffe/Definitionen, Tabellen für Vergleiche, Zeitleisten als Tabelle, Aufgaben = Klausurfragen mit Musterantwort (Operatoren beachten: nennen, erläutern, beurteilen).

## 4. Übertragen

```sql
select public.cc_school_upsert($j${ … das JSON … }$j$::jsonb);
```
- `$j$…$j$` verhindert Probleme mit Anführungszeichen. Steht `$j$` im Text, ein anderes Kennzeichen nehmen (`$x9$`).
- Sehr großes Thema (über ~400 KB): erst ohne `html` der späteren Kapitel übertragen, dann noch einmal vollständig – oder das Thema sinnvoll teilen.
- Ergebnis: `module_id`, `url`, `created` und `fotos_fehlen` (Dateinamen, die auf der Seite noch nicht hochgeladen sind).

## 5. Fotos

Bilder können aus Claude nicht direkt in den Speicher. Darum im Abschluss sagen:
„Öffne <url> → oben **Fotos hochladen** → diese Dateien aus deinem Ordner wählen: …“ (Liste aus `fotos_fehlen`, gekürzt, wenn sehr lang). Die Seite verkleinert die Bilder und ordnet sie über den Dateinamen den Kapiteln zu.

## 6. Abschluss (kurz)

- Fach › Thema, Anzahl Kapitel und Aufgaben, neu oder aktualisiert.
- Link: `url` aus dem Ergebnis; Übersicht: https://jrn1401.github.io/jopml-nexus/#/schule
- Fehlende Fotos (siehe 5) und was mangels Material fehlt (z. B. „Kapitel e-Funktion: noch kein Unterrichtsmaterial“ → `done: false`).
