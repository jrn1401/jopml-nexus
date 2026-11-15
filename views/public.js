// Öffentliche Seiten (ohne Anmeldung): #/skills – Claude-Skills für alle, #/download – JOPML Launcher.
import { h, icon, clear, copyText, toast, md } from "../lib/ui.js";
import { CONFIG } from "../config.js";

const VERSION_URL = `${CONFIG.supabaseUrl}/storage/v1/object/public/releases/version.json`;

// Liest die aktuelle Launcher-Version direkt aus dem Update-Kanal des Launchers (immer synchron)
export async function launcherInfo() {
  const r = await fetch(VERSION_URL, { cache: "no-store" });
  if (!r.ok) throw new Error("Download-Infos nicht erreichbar");
  const v = await r.json();
  const find = (o, re) => { for (const x of Object.values(o || {})) { if (x && typeof x === "object") { if (re.test(x.url || "")) return x; const d = find(x, re); if (d) return d; } } return null; };
  return { version: v.version, notes: v.notes || "", win: find(v, /\.exe(\?|$)/i), mac: find(v, /\.dmg(\?|$)/i) };
}

export function launcherCard({ compact = false } = {}) {
  const body = h("div.card-body", h("div.faint", "Lädt …"));
  launcherInfo().then((l) => body.replaceChildren(
    h("p", { style: { margin: "0 0 12px" } }, "Der JOPML Launcher (Jaron's OP Makro) für Windows – immer die aktuelle Version, direkt aus dem offiziellen Update-Kanal."),
    h("div.row.wrap", { style: { gap: "8px" } },
      l.win ? h("a.btn.primary", { href: l.win.url, rel: "noopener", download: "" }, icon("download"), `Windows ${l.win.version || l.version}`) : null,
      l.mac ? h("a.btn", { href: l.mac.url, rel: "noopener", download: "" }, icon("download"), `Mac ${l.mac.version || ""}`.trim()) : null),
    compact ? null : h("div.faint", { style: { fontSize: "12px", marginTop: "10px", wordBreak: "break-all" } }, l.win?.sha256 ? `SHA-256 (Windows): ${l.win.sha256}` : ""),
    l.notes && !compact ? h("div", { style: { marginTop: "10px" } }, md(l.notes)) : null,
    h("div.faint", { style: { fontSize: "12px", marginTop: "8px" } }, "Bereits installiert? Der Launcher aktualisiert sich selbst – hier nichts weiter nötig.")))
    .catch((e) => body.replaceChildren(h("div.faint", e.message)));
  return h("section.card", h("div.card-head", h("h3.row", icon("download"), "JOPML Launcher herunterladen")), body);
}

const PROMPT = `Erstelle mir aus diesem Chat (und den Projekt-Dokumenten, falls vorhanden) einen Steckbrief für JOPML Nexus.
Nur echte Angaben, nichts erfinden, keine Passwörter oder API-Schlüssel.
Gib genau einen JSON-Codeblock aus:
{"nexus": {"name": "…", "slug": "kurz-und-stabil", "kind": "shop|school|business|personal|website|app|server|api|finance|event|other",
 "description": "2–3 Sätze",
 "widgets": [ Kacheln, z. B.
   {"type":"stats","title":"Kennzahlen","items":[{"label":"…","value":0,"unit":"€"}]},
   {"type":"chart","title":"…","chart":"bar|line|donut","labels":["…"],"series":[{"name":"…","values":[0]}]},
   {"type":"progress","title":"…","items":[{"label":"…","value":0,"max":10}]},
   {"type":"timeline","items":[{"date":"YYYY-MM-DD","title":"…","done":false}]},
   {"type":"checklist","title":"…","items":[{"text":"…","done":false}]},
   {"type":"table","title":"…","columns":["…"],"rows":[["…"]]},
   {"type":"markdown","title":"…","content":"- …"} ],
 "tasks": [{"title":"…","due":"YYYY-MM-DDTHH:MM","priority":1}],
 "event": {"name":"…","date":"…","location":"…","capacity":0,"ticket_price":0,"items":[{"kind":"task|schedule|cost|income|guest|shift","title":"…","amount":0}]}
}}
Leere Teile weglassen. Jede Kachel mit klarem Titel.`;

const SKILLS = [
  ["nexus-sync", "Alles übertragen", "Projekte, Kennzahlen, Diagramme, Aufgaben und Events aus jedem Chat – mit Aufgaben- und Event-Abgleich. Empfohlen."],
  ["nexus-board", "Nur Übersicht", "Schlanke Variante: nur Projekt-Übersicht mit Kacheln (Kennzahlen, Diagramme, Listen)."],
];

function frame(root, title, body) {
  clear(root, h("div.guest-wrap",
    h("header.guest-top", h("a.brand", { href: "#/", onclick: (e) => { e.preventDefault(); location.hash = "#/"; location.reload(); } }, h("div.brand-mark", icon("logo")), h("div.brand-text", CONFIG.appName, h("small", title))), h("div.spacer"),
      h("a.btn.sm", { href: "#/", onclick: (e) => { e.preventDefault(); location.hash = "#/"; location.reload(); } }, "Zur App")),
    h("main.content", { id: "content" }, body)));
  document.title = `${title} · ${CONFIG.appName}`;
}

export function renderDownload(root) {
  frame(root, "Download", h("div", { style: { maxWidth: "720px", margin: "0 auto" } },
    h("div.page-head", h("div", h("h1", "JOPML Launcher"), h("p", "Herunterladen, installieren, fertig – Updates kommen danach automatisch."))),
    launcherCard()));
}

export async function renderSkills(root) {
  const cards = await Promise.all(SKILLS.map(async ([name, t, d]) => {
    const text = await fetch(`skills/${name}/SKILL.md`, { cache: "no-cache" }).then((r) => r.text()).catch(() => "");
    return h("section.card", h("div.card-head", h("h3.row", icon("sparkles"), name, h("span.faint", { style: { fontWeight: 400, marginLeft: "8px" } }, t))),
      h("div.card-body.stack", { style: { gap: "10px" } }, h("p", { style: { margin: 0 } }, d),
        h("div.row.wrap", { style: { gap: "8px" } },
          h("a.btn.primary", { href: `skills/${name}.zip`, download: `${name}.zip` }, icon("download"), "ZIP herunterladen"),
          h("button.btn", { onclick: () => { copyText(text); toast("SKILL.md kopiert"); } }, icon("copy"), "Text kopieren")),
        h("details", h("summary.faint", { style: { cursor: "pointer" } }, "Inhalt ansehen"), h("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "12px", maxHeight: "320px", overflow: "auto" } }, text))));
  }));
  frame(root, "Claude-Skills", h("div", { style: { maxWidth: "860px", margin: "0 auto" } },
    h("div.page-head", h("div", h("h1", "Claude-Skills für Nexus"), h("p", "Damit macht Claude aus jedem Chat eine übersichtliche Nexus-Seite – Zahlen, Diagramme, Aufgaben, Events. Für jedes Konto, kostenlos."))),
    h("section.card", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3", "So funktioniert es")), h("div.card-body", h("ol", { style: { margin: 0, paddingLeft: "20px", lineHeight: 1.7 } },
      h("li", "Skill einmal in Claude hinzufügen (Anleitung unten)."),
      h("li", "In irgendeinem Chat sagen: „Übertrag das ins Nexus“. Claude erstellt einen Steckbrief (JSON-Block)."),
      h("li", "In Nexus auf der Übersicht „Aus Claude oder Text einfügen“ → einfügen → Vorschau → Speichern."),
      h("li", "Fertig: Kacheln, Aufgaben und ggf. das Event sind da. Teilen mit „KI-Vorschläge“ – nur das, was passt.")))),
    h("div.grid.g-2", { style: { alignItems: "start", marginBottom: "16px" } }, cards),
    h("section.card", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3", "Skill in Claude hinzufügen")), h("div.card-body", h("ol", { style: { margin: 0, paddingLeft: "20px", lineHeight: 1.7 } },
      h("li", "ZIP oben herunterladen (nicht entpacken)."),
      h("li", "In Claude: Einstellungen → Funktionen (Settings → Capabilities) → „Code-Ausführung und Dateierstellung“ einschalten."),
      h("li", "Dann „Anpassen → Skills“ (Customize → Skills) → „+“ → „Skill erstellen“ → „Skill hochladen“ und die ZIP wählen."),
      h("li", "Skill einschalten – Claude nutzt ihn ab jetzt automatisch, wenn du etwas ins Nexus übertragen willst.")),
      h("p.faint", { style: { fontSize: "12.5px", margin: "10px 0 0" } }, "Die Menünamen können sich bei Claude ändern. Ohne Skill geht es auch – mit dem Prompt unten."))),
    h("section.card", h("div.card-head", h("h3", "Ohne Skill: Prompt zum Kopieren"), h("button.btn.sm", { onclick: () => { copyText(PROMPT); toast("Prompt kopiert – in Claude einfügen"); } }, icon("copy"), "Kopieren")),
      h("div.card-body", h("pre", { style: { whiteSpace: "pre-wrap", overflowWrap: "anywhere", fontSize: "12.5px", margin: 0 } }, PROMPT))),
    h("div", { style: { marginTop: "16px" } }, launcherCard({ compact: true }))));
}


// Link, der eine öffentliche Seite mit Neuladen öffnet (die App wechselt dafür in den öffentlichen Modus)
export const publicLink = (hash, label, cls = "a") => h(cls, { href: hash, onclick: (e) => { e.preventDefault(); location.hash = hash; location.reload(); } }, label);
