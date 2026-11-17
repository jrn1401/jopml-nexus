// Zusatzfunktionen für alle Konten (nicht nur Admin): eigene Aufgaben, Erste-Schritte-Liste, kurzes Handbuch.
// Daten liegen in nx_tasks (RLS: owner_id = auth.uid()), höchstens 500 Aufgaben pro Konto.
import { sb, q, local, nx } from "../lib/api.js";
import { h, icon, toast, toastErr, fmtDateTime, empty, formModal, confirmDialog, debounce, errMsg } from "../lib/ui.js";
import { parseQuickTask, breakDownDialog } from "../lib/aiassist.js";

const PRIO = [["2", "Wichtig"], ["1", "Normal"], ["0", "Irgendwann"]];

// ---------- Aufgaben ----------
export async function tasksPage() {
  let rows = await q(sb.from("nx_tasks").select("*").order("done").order("due", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(500));
  let filter = local.get("ws:tf", "open"), term = "";
  const list = h("div.list", { role: "list", "aria-live": "polite" });
  const counter = h("span.faint");
  const tabs = h("div.seg", { role: "tablist", "aria-label": "Filter" }, [["open", "Offen"], ["today", "Heute & überfällig"], ["done", "Erledigt"], ["all", "Alle"]].map(([k, t]) =>
    h("button", { role: "tab", "aria-selected": String(k === filter), class: k === filter ? "on" : "", onclick: (e) => {
      filter = k; local.set("ws:tf", k);
      tabs.querySelectorAll("button").forEach((b) => { b.classList.toggle("on", b === e.currentTarget); b.setAttribute("aria-selected", String(b === e.currentTarget)); });
      draw();
    } }, t)));
  const quick = h("input.input", { placeholder: "Neue Aufgabe – versteht „morgen 18 Uhr …“, „Fr …“, „14.2. …“, „!“ = wichtig", "aria-label": "Neue Aufgabe", maxlength: 300,
    onkeydown: async (e) => { if (e.key !== "Enter" || !e.target.value.trim()) return; const p = parseQuickTask(e.target.value.trim()); e.target.value = ""; await save({ title: p.title, due: p.due, priority: p.priority }); if (p.due) toast(`Fällig ${fmtDateTime(p.due)}`); } });
  const search = h("input.input", { type: "search", placeholder: "Suchen …", "aria-label": "Aufgaben durchsuchen", style: { maxWidth: "220px" }, oninput: debounce((e) => { term = e.target.value.toLowerCase(); draw(); }, 120) });

  async function reload() { rows = await q(sb.from("nx_tasks").select("*").order("done").order("due", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(500)); draw(); }
  async function save(v, id) {
    try {
      if (id) await q(sb.from("nx_tasks").update(v).eq("id", id));
      else { await q(sb.from("nx_tasks").insert(v)); local.set("ws:did-task", true); }
      await reload();
    } catch (e) { toastErr(e); }
  }
  function edit(t) {
    const local16 = (d) => (d ? new Date(new Date(d).getTime() - new Date(d).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "");
    const m = formModal(t ? "Aufgabe bearbeiten" : "Neue Aufgabe", [
      { name: "title", label: "Was ist zu tun?", value: t?.title, required: true, max: 300 },
      { name: "due", label: "Fällig am", type: "datetime-local", half: true, value: local16(t?.due) },
      { name: "priority", label: "Wichtigkeit", type: "select", half: true, value: String(t?.priority ?? 1), options: PRIO },
      { name: "note", label: "Notiz", type: "textarea", value: t?.note, max: 4000 },
    ], async (v) => {
      const row = { title: v.title, note: v.note, priority: Number(v.priority), due: v.due ? new Date(v.due).toISOString() : null };
      if (t) await q(sb.from("nx_tasks").update(row).eq("id", t.id)); else { await q(sb.from("nx_tasks").insert(row)); local.set("ws:did-task", true); }
      toast("Gespeichert"); await reload();
    }, { submit: t ? "Speichern" : "Anlegen" });
    if (t) m.el.querySelector(".form .row").prepend(h("button.btn.danger", { type: "button", style: { marginRight: "auto" }, onclick: async () => {
      if (!(await confirmDialog("Aufgabe löschen?", `„${t.title}“ wird entfernt.`, { ok: "Löschen" }))) return;
      try { await q(sb.from("nx_tasks").delete().eq("id", t.id)); m.close(); toast("Gelöscht"); await reload(); } catch (e) { toastErr(e); }
    } }, icon("trash"), "Löschen"));
  }
  function draw() {
    const now = Date.now(), endToday = new Date(); endToday.setHours(23, 59, 59, 999);
    const vis = rows.filter((t) => (filter === "all" || (filter === "done" ? t.done : !t.done) && (filter !== "today" || (t.due && new Date(t.due) <= endToday)))
      && (!term || `${t.title} ${t.note}`.toLowerCase().includes(term)));
    const open = rows.filter((t) => !t.done).length, over = rows.filter((t) => !t.done && t.due && new Date(t.due) < now).length;
    counter.textContent = `${open} offen${over ? ` · ${over} überfällig` : ""} · ${rows.length}/500`;
    list.replaceChildren(...(vis.length ? vis.map((t) => {
      const late = !t.done && t.due && new Date(t.due) < now;
      const cb = h("input", { type: "checkbox", checked: t.done, "aria-label": `${t.title} ${t.done ? "wieder öffnen" : "erledigt"}`, onchange: (e) => { t.done = e.target.checked; draw(); save({ done: t.done }, t.id); } });
      return h("div.list-item.task-row", { role: "listitem", class: t.done ? "done" : "" },
        h("label.check", { style: { margin: 0 } }, cb),
        h("span.prio", { class: `p${t.priority}`, title: PRIO.find(([k]) => k === String(t.priority))?.[1] }),
        h("div.li-main", h("div.li-title", t.title),
          h("div.li-sub", [t.due ? (late ? "Überfällig · " : "Fällig ") + fmtDateTime(t.due) : null, t.note ? t.note.slice(0, 80) : null].filter(Boolean).join(" · ") || "Keine Frist")),
        late ? h("span.badge.b-bad", "überfällig") : null,
        !t.done ? h("button.btn.sm.ghost", { "aria-label": `„${t.title}“ in Schritte zerlegen`, title: "KI: in Schritte zerlegen", onclick: () => breakDownDialog(t, async (steps) => {
          await q(sb.from("nx_tasks").insert(steps.map((x, i) => ({ title: `${t.title.slice(0, 100)} › ${x}`.slice(0, 300), due: t.due, priority: t.priority, note: `Schritt ${i + 1}` })))); rows = await q(sb.from("nx_tasks").select("*").order("done").order("due", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }).limit(500)); draw(); }) }, icon("sparkles")) : null,
        h("button.btn.sm.ghost", { "aria-label": `„${t.title}“ bearbeiten`, title: "Bearbeiten", onclick: () => edit(t) }, icon("edit")));
    }) : [empty("check", filter === "done" ? "Noch nichts erledigt" : "Alles erledigt", rows.length ? "In diesem Filter gibt es nichts." : "Tippe oben eine Aufgabe ein und drücke Enter – fertig.")]));
  }
  draw();
  return h("div",
    h("div.page-head", h("div", h("h1", "Aufgaben"), h("p", "Deine persönliche To-do-Liste – nur du siehst sie."), counter),
      h("div.actions", h("button.btn", { onclick: () => aiPrioritize(rows.filter((t) => !t.done)) }, icon("bot"), "KI: Was zuerst?"), h("button.btn.primary", { onclick: () => edit() }, icon("plus"), "Neue Aufgabe"))),
    h("section.card", h("div.card-body",
      quick,
      h("div.row.wrap", { style: { justifyContent: "space-between", gap: "10px", margin: "12px 0 6px" } }, tabs, search),
      list)));
}

// Kleine Karte für die Übersicht: nächste offene Aufgaben
export async function tasksCard() {
  const rows = await q(sb.from("nx_tasks").select("id,title,due,done").eq("done", false).order("due", { ascending: true, nullsFirst: false }).limit(4)).catch(() => []);
  return h("section.card", h("div.card-head", h("h3", "Als Nächstes"), h("a.btn.sm.ghost", { href: "#/aufgaben" }, "Alle")),
    h("div.card-body", rows.length ? h("div.list", rows.map((t) => h("a.list-item", { href: "#/aufgaben" }, icon("check", "faint"),
      h("div.li-main", h("div.li-title", t.title), h("div.li-sub", t.due ? `${new Date(t.due) < Date.now() ? "Überfällig · " : ""}${fmtDateTime(t.due)}` : "Keine Frist")))))
      : h("p.faint", { style: { margin: 0 } }, "Keine offenen Aufgaben. ", h("a", { href: "#/aufgaben" }, "Aufgabe anlegen"))));
}

// ---------- Erste Schritte ----------
export function firstSteps({ projects, conns, guest, shared }) {
  if (local.get("ws:steps-hidden", false)) return null;
  const steps = [
    [!guest, guest ? "Konto mit Google sichern" : "Mit Google angemeldet", "Damit bleiben deine Daten dauerhaft erhalten.", null],
    [conns > 0, "Einen Dienst verbinden", "Netlify, GitHub, Vercel, Supabase oder Eventfrog – Projekte erscheinen automatisch.", guest ? null : "#/verbindungen"],
    [projects > 0, "Erstes Projekt", "Am einfachsten mit dem Projekt-Assistenten: ein paar Fragen, fertig – inkl. Aufgaben und Rechts-Check.", "#/studio/bogen"],
    [local.get("ws:did-studio", false), "Etwas fürs Projekt erstellen", "Website, QR-Code, Visitenkarte oder Shirt im KI-Studio.", "#/studio"],
    [local.get("ws:did-event", false), "Ein Event planen", "Unter „Events“ – oder einfach die KI planen lassen.", "#/events"],
    [local.get("ws:did-task", false), "Eine Aufgabe notieren", "Unter „Aufgaben“: tippen, Enter, fertig.", "#/aufgaben"],
    [local.get("ws:did-ai", false), "Die KI etwas fragen", "Der Roboter oben rechts kennt deine Projekte.", null],
    [local.get("ws:did-design", false) || shared > 0, "Ansicht anpassen", "Hell/Dunkel, Schriftgröße, hoher Kontrast unter Einstellungen.", "#/einstellungen"],
  ];
  const done = steps.filter((s) => s[0]).length;
  if (done === steps.length) return null;
  return h("section.card.steps-list", { style: { marginBottom: "16px" } },
    h("div.card-head", h("h3", `Erste Schritte · ${done} von ${steps.length}`),
      h("button.btn.sm.ghost", { onclick: (e) => { local.set("ws:steps-hidden", true); e.currentTarget.closest("section").remove(); } }, "Ausblenden")),
    h("div.card-body", h("div.meter", { role: "progressbar", "aria-valuemin": 0, "aria-valuemax": steps.length, "aria-valuenow": done, "aria-label": "Fortschritt" }, h("i", { style: { width: `${(done / steps.length) * 100}%` } })),
      h("div.list", { style: { marginTop: "10px" } }, steps.map(([ok, t, sub, href]) => h(href && !ok ? "a.list-item" : "div.list-item", { href: href && !ok ? href : undefined, class: ok ? "ok" : "" },
        icon(ok ? "check" : "chevronR", ok ? "" : "faint"), h("div.li-main", h("div.li-title", t), h("div.li-sub", sub)), ok ? h("span.sr-only", "erledigt") : null)))));
}

// ---------- Hilfe ----------
const HELP = [
  ["Event mit KI anlegen", "calendar", "Events › „Neues Event“: Fragebogen mit KI (4 kurze Schritte mit Vorlagen), Importieren (Nachricht, E-Mail, Tabelle oder Kalender-Datei) oder in einem Satz beschreiben. Rechts siehst du sofort Break-even, Personal-Faustregeln und den Rechts-Check. Dann baut die KI den kompletten Plan: Aufgaben mit Fristen, Ablauf, Kosten, Einnahmen, Schichten und Werbeplan – du wählst aus, was übernommen wird."],
  ["KI-Copilot", "sparkles", "Auf jeder Event- und Projektseite: zeigt, was gerade wichtig ist, ergänzt Fehlendes, plant Ablauf und Schichten, schätzt Kosten, schreibt Nachrichten für WhatsApp, E-Mail oder Instagram und beantwortet Fragen zum Event. Unter Textfeldern hilft die KI beim Schreiben, Verbessern und Korrigieren."],
  ["Aufgaben schneller", "check", "Die Eingabe versteht Datum und Wichtigkeit: „morgen 18 Uhr Getränke kaufen !“. Das ✨ an einer Aufgabe zerlegt sie in kleine Schritte, „KI: Was zuerst?“ sortiert nach Dringlichkeit."],
  ["KI-Studio: Projekt planen mit Rechts-Check", "check", "KI-Studio › Projekt-Assistent: Art wählen (Event, Website, Shop, Schule …), ein paar Fragen beantworten (Alter der Gäste, dein Alter, Ort, Alkohol, Musik …). Du bekommst Pflichten mit Gesetzes-Link (z. B. Jugendschutz, GEMA, Impressum), Aufgaben zum Abhaken und auf Wunsch eine KI-Analyse. Klappt auch für bestehende Projekte – einfach oben auswählen. Orientierung, keine Rechtsberatung."],
  ["Website bauen", "external", "KI-Studio › Website-Baukasten: Event-Seite, Link-Seite, Benachrichtigungs-Seite oder Projekt-Steckbrief. Felder ausfüllen (oder „Texte mit KI schreiben“), Farben wählen, veröffentlichen – du bekommst einen Link und QR-Code. Seiten sind schnell, ohne Cookies und ohne Tracking. Als HTML herunterladen geht auch."],
  ["QR-Codes, Visitenkarten, Shirts", "zap", "KI-Studio › Marketing & Druck: Link eingeben → QR-Code (PNG/SVG), Visitenkarten-Druckbogen (10 Stück auf A4), T-Shirt-Druckdatei mit Slogan (KI schlägt Slogans vor) und QR, Social-Posts und ein Marketingplan."],
  ["KI-Modell wählen & was die KI weiß", "sparkles", "KI-Studio › KI-Einstellungen: Modell (Auto, Gemini, Llama, GPT-OSS …), Antwort-Stil (kurz, ausführlich, einfache Sprache) und die Liste, was sich die KI über dich gemerkt hat – jederzeit einzeln löschbar. Im Chat oben kannst du das Modell auch schnell wechseln."],
  ["Einfach-Modus", "eye", "KI-Studio › KI-Einstellungen › Einfach-Modus: größere Schrift und Knöpfe, weniger Details. Gilt für dieses Gerät."],
  ["Push aufs Handy & Leute einladen", "bell", "Oben rechts „Handy-App“: Nexus Mobil zum Home-Bildschirm hinzufügen, Benachrichtigungen aktivieren und Themen wählen. Unter Einstellungen › Leute einladen bekommt dein Team Nachrichten ohne Konto."],
  ["Übersicht", "dashboard", "Alle deine Projekte auf einen Blick. Oben die Zahlen, darunter Karten. Mit den Reitern filterst du nach Art (Websites, Repos, Events …), das Suchfeld findet alles nach Namen."],
  ["Dienst verbinden", "link", "Plus oben rechts → Dienst auswählen → API-Schlüssel einfügen. Der Schlüssel wird verschlüsselt gespeichert und nie wieder angezeigt. Danach wird stündlich aktualisiert."],
  ["Events planen", "calendar", "Unter „Events“ legst du Partys oder Treffen an: Aufgaben, Ablauf, Kosten, Einnahmen, Gäste, Schichten und Tickets. „Mit KI planen“: einen Satz beschreiben – die KI legt Aufgaben, Ablauf und Kosten an. Das Budget rechnet den Break-even automatisch."],
  ["Teilen", "users", "Teilen-Knopf → zuerst wählen, WAS du teilst (z. B. nur die Ticket-Live-Anzeige), dann WIE: als Link (ohne Konto) oder mit bestimmten Google-Konten. Ticket-Live aktualisiert sich bei den anderen von selbst. Freigaben kannst du jederzeit beenden."],
  ["Aufgaben", "check", "Deine eigene To-do-Liste. Tippen und Enter speichert sofort. Mit Frist und Wichtigkeit (rot = wichtig). Filter: Offen, Heute & überfällig, Erledigt."],
  ["Websites", "globe", "Live-Besucher, Erreichbarkeit und Netlify-Daten deiner verbundenen Websites. Ein grüner Punkt heißt: gerade ist jemand auf der Seite."],
  ["Geteilt", "users", "Was andere mit dir geteilt haben (Events, Projekte, Dateien). Du kannst auch eigene Projekte über das Personen-Symbol auf einer Karte teilen."],
  ["KI-Assistent", "bot", "Roboter oben rechts. Frag in normalen Worten, z. B. „Welche Website hat Fehler?“. Die KI kennt nur deine eigenen Daten. Unter Einstellungen → KI-Wissen siehst und löschst du, was sie sich gemerkt hat."],
  ["Barrierefreiheit", "eye", "Einstellungen → Design: Schriftgröße bis 120 %, hoher Kontrast, Links unterstreichen, weniger Bewegung. Alles ist mit der Tastatur bedienbar: Tab springt weiter, „Zum Inhalt springen“ erscheint beim ersten Tab."],
  ["Daten & Datenschutz", "lock", "Einstellungen → Konto & Daten: alles als Datei exportieren oder vollständig löschen. Niemand sonst sieht deine Projekte, Aufgaben oder Schlüssel."],
  ["Claude-Skills", "bot", "Mit den Skills „nexus-sync“ oder „nexus-board“ macht Claude aus jedem Chat einen Steckbrief, den du hier unter „Aus Claude oder Text einfügen“ einfügst. Anleitung, Download und ein fertiger Prompt: Übersicht → Schnellzugriff → „Claude-Skills für Nexus“ (oder #/skills)."],
  ["Wenn etwas hakt", "alert", "Seite neu laden (die App aktualisiert sich selbst). Steht eine Verbindung auf „Fehler“, ist meist der Schlüssel abgelaufen – unter Verbindungen neu einfügen. Sonst die KI fragen."],
];
export function helpPage(ask) {
  const box = h("div.list");
  const draw = (t = "") => box.replaceChildren(...HELP.filter(([a, , b]) => !t || `${a} ${b}`.toLowerCase().includes(t)).map(([title, ic, text]) =>
    h("details.list-item", { style: { display: "block" } }, h("summary.row", { style: { gap: "10px", cursor: "pointer" } }, icon(ic), h("strong", title)), h("p", { style: { margin: "8px 0 0" } }, text))));
  draw();
  return h("div",
    h("div.page-head", h("div", h("h1", "Hilfe"), h("p", "Kurz erklärt – zum Aufklappen antippen."))),
    h("section.card", h("div.card-body",
      h("input.input", { type: "search", placeholder: "Wonach suchst du?", "aria-label": "Hilfe durchsuchen", style: { marginBottom: "10px" }, oninput: debounce((e) => draw(e.target.value.toLowerCase()), 120) }),
      box,
      h("div.row.wrap", { style: { marginTop: "14px", gap: "8px" } }, h("button.btn.ghost", { onclick: () => { local.set("ws:interests", null); local.set("ws:interests-asked", false); location.hash = "#/"; location.reload(); } }, icon("settings"), "Bereiche anpassen"), h("button.btn", { onclick: () => ask("Wie funktioniert mein Bereich? Erkläre mir kurz die wichtigsten Funktionen.") }, icon("bot"), "KI fragen")))));
}

// ---------- Wofür nutzt du Nexus? (passt Menü und Übersicht an) ----------
const INTERESTS = [["events", "calendar", "Events & Partys", "Planen, Tickets, Budget, Helfer"], ["tasks", "check", "Aufgaben & Lernen", "To-dos, Schule, Termine"], ["web", "globe", "Websites & Code", "Netlify, GitHub, Vercel, Besucher"]];
export function interestsCard({ force = false } = {}) {
  if (!force && (local.get("ws:interests", null) || local.get("ws:interests-asked", false))) return null;
  const pick = new Set(local.get("ws:interests", null) || []);
  const save = (list) => { local.set("ws:interests", list); local.set("ws:interests-asked", true); location.reload(); };
  return h("section.card", { style: { marginBottom: "16px" } },
    h("div.card-head", h("h3", "Wofür willst du Nexus nutzen?")),
    h("div.card-body.stack", { style: { gap: "10px" } },
      h("p.faint", { style: { margin: 0 } }, "Wähle aus – dann zeigt das Menü nur, was du brauchst. Ändern geht jederzeit unter Hilfe."),
      h("div.share-choices", INTERESTS.map(([k, ic, t, d]) => {
        const b = h("button.share-choice", { type: "button", role: "checkbox", "aria-checked": String(pick.has(k)), class: pick.has(k) ? "on" : "", onclick: () => {
          pick.has(k) ? pick.delete(k) : pick.add(k); b.classList.toggle("on", pick.has(k)); b.setAttribute("aria-checked", String(pick.has(k)));
        } }, h("div.li-icon", icon(ic)), h("div.li-main", h("div.li-title", t), h("div.li-sub", d)));
        return b;
      })),
      h("div.row", { style: { gap: "8px", justifyContent: "flex-end" } },
        h("button.btn.ghost", { onclick: () => { local.set("ws:interests", null); local.set("ws:interests-asked", true); location.reload(); } }, "Alles zeigen"),
        h("button.btn.primary", { onclick: () => (pick.size ? save([...pick]) : toast("Mindestens eins auswählen – oder „Alles zeigen“", "err")) }, "Übernehmen"))));
}

// ---------- KI-Befehlszeile: „Sag einfach, was du willst“ ----------
// Die KI (Groq/Gemini über nx-api) wählt eine Aktion: Aufgabe anlegen, Event planen, Bereich öffnen oder antworten.
export function aiCommand({ ask, planEvent }) {
  const input = h("input.input", { placeholder: "z. B. „Erinnere mich Freitag ans Flyer drucken“ oder „Plane eine Party für 80 Leute“", "aria-label": "Was möchtest du tun?", maxlength: 400 });
  const btn = h("button.btn.primary", { type: "submit" }, icon("bot"), "Los");
  const out = h("div.faint", { style: { fontSize: "13px", minHeight: "0" }, "aria-live": "polite" });
  const run = async (text) => {
    btn.disabled = true; out.textContent = "Die KI überlegt …";
    try {
      const today = new Date().toISOString().slice(0, 16);
      const r = await nx("ai", { history: [], question: `Jetzt ist ${today} (Europe/Berlin). Nutzerwunsch: „${text}“
Wähle GENAU EINE Aktion und antworte NUR mit JSON:
{"action":"task","title":"…","due":"YYYY-MM-DDTHH:MM oder null"} – etwas merken/erledigen/erinnern
{"action":"event","text":"…"} – Veranstaltung/Party/Treffen planen
{"action":"go","page":"events|aufgaben|websites|verbindungen|geteilt|hilfe|einstellungen"} – Bereich öffnen
{"action":"answer"} – Frage, Erklärung oder alles andere` });
      const m = String(r.answer || "").match(/\{[\s\S]*?\}/);
      const a = m ? JSON.parse(m[0]) : { action: "answer" };
      if (a.action === "task" && a.title) {
        await q(sb.from("nx_tasks").insert({ title: String(a.title).slice(0, 300), due: a.due && a.due !== "null" ? new Date(a.due).toISOString() : null }));
        local.set("ws:did-task", true);
        out.replaceChildren("✓ Aufgabe angelegt: ", h("strong", a.title), a.due && a.due !== "null" ? ` (fällig ${new Date(a.due).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })})` : "", " · ", h("a", { href: "#/aufgaben" }, "ansehen"));
      } else if (a.action === "event") {
        out.textContent = "Die KI plant dein Event …";
        const id = await planEvent(a.text || text);
        location.hash = `#/events/${id}`;
      } else if (a.action === "go" && /^(events|aufgaben|websites|verbindungen|geteilt|hilfe|einstellungen)$/.test(a.page)) {
        location.hash = `#/${a.page}`;
      } else { out.textContent = ""; ask(text); }
      input.value = "";
    } catch (e) { out.textContent = ""; toastErr(e); }
    finally { btn.disabled = false; }
  };
  return h("section.card.ai-cmd", { style: { marginBottom: "16px" } }, h("div.card-body",
    h("form.row", { style: { gap: "8px" }, onsubmit: (e) => { e.preventDefault(); if (input.value.trim()) run(input.value.trim()); } }, input, btn),
    h("div.row.wrap", { style: { gap: "6px", marginTop: "8px" } }, ["Was steht diese Woche an?", "Plane einen Geburtstag für 20 Leute", "Morgen 18 Uhr Training"].map((t) =>
      h("button.chip", { type: "button", onclick: () => { input.value = t; run(t); } }, t))),
    out));
}

// KI sortiert offene Aufgaben nach Dringlichkeit und Wirkung
async function aiPrioritize(open) {
  if (!open.length) return toast("Keine offenen Aufgaben – alles erledigt!");
  const { modal } = await import("../lib/ui.js");
  const box = h("div.faint", "Die KI sortiert …");
  modal("Was zuerst?", box, { wide: true });
  const list = open.slice(0, 60).map((t, i) => `${i + 1}. ${t.title}${t.due ? ` (fällig ${new Date(t.due).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })})` : ""}${t.priority === 2 ? " [wichtig]" : ""}`).join("\n");
  try {
    const r = await nx("ai", { history: [], question: `Jetzt: ${new Date().toLocaleString("de-DE")}. Hier sind meine offenen Aufgaben:\n${list}\nSag mir in Markdown: 1) die 3 Aufgaben, mit denen ich jetzt anfangen sollte (je 1 kurzer Grund), 2) was warten kann, 3) was ich zusammenfassen oder streichen könnte. Kurz und konkret, Deutsch.` });
    box.className = ""; box.replaceChildren(h("div", { style: { whiteSpace: "pre-wrap", lineHeight: 1.55 } }, r.answer || "Keine Antwort."));
  } catch (e) { box.replaceChildren(h("div.banner.bad", errMsg(e))); }
}
