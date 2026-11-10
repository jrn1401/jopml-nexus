# JOPML Nexus

Privates Control Center für JOPML und alle weiteren Projekte. Diese Seite enthält nur die Oberfläche –
alle Daten liegen geschützt in Supabase (Row Level Security). Zugriff ausschließlich mit dem hinterlegten Admin-Konto.
Es sind keine geheimen Schlüssel in diesem Repository; der Supabase-anon-Schlüssel in `config.js` ist bewusst öffentlich.

## Version 3.0 (11.11.2026) – offen für alle Google-Konten

- **Eigener Bereich für jeden:** Wer sich mit Google anmeldet (kein Admin), bekommt eine private Übersicht (`nx_projects`, RLS `owner_id = auth.uid()`): Projekte mit Filtern (Websites, Repos, Events, KI, Datenbanken), Suche, Anheften, manuelles Anlegen, „Mit dir geteilt“, Einstellungen, Datenexport und „Alle meine Daten löschen“.
- **Verbinden-Assistent:** API-Schlüssel (oder einen Text, in dem er steht) einfügen. Der Dienst wird erkannt und geprüft (Netlify, GitHub, Vercel, Supabase, Eventfrog, Groq, Gemini, OpenAI, Anthropic), verschlüsselt im **Supabase Vault** gespeichert und sofort importiert. Danach wird er stündlich abgerufen. Schlüssel sind danach für niemanden mehr lesbar; beim Trennen werden sie gelöscht. Maximal 25 Verbindungen pro Konto.
- **KI-Assistent für alle** (Edge Function `nx-api/ai`): kennt nur die eigenen Projekte und Verbindungen. Auf dem Plattform-Schlüssel gilt ein Limit von 30 Fragen pro Tag; mit eigenem Groq-, Gemini- oder OpenAI-Schlüssel gibt es kein Limit.
- **Stündlicher Auto-Abruf:** `pg_cron` `cc_sync_hourly` (Minute 17) ruft Netlify, Eventfrog und alle Nutzer-Verbindungen ab. Dafür gibt es einen eigenen API-Schlüssel mit Scope `sync`, der im Vault liegt.
- **Rechtsseiten** `#/impressum`, `#/datenschutz` und `#/nutzung` sind öffentlich. Es sind Vorlagen; Name, Anschrift und E-Mail trägt der Admin unter *Einstellungen › Rechtliches* ein. Fehlende Angaben sind orange markiert.
- **Design:** Hell/Dunkel/System, 7 Akzentfarben, kompakte Dichte, 4 Schriftgrößen, „Weniger Bewegung“ (pro Gerät).
- **Admin:** neue Seite „Verbindungen“ mit anonymer Statistik der Nutzerbereiche; in den Einstellungen die Tabs Design, Verbindungen und Rechtliches; Eventfrog „Jetzt abrufen“.
- Admin-Verbindungen werden zusätzlich als Projekte ins Control Center gespiegelt.
