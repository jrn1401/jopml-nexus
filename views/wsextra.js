// Zusatzfunktionen für alle Konten (nicht nur Admin): eigene Aufgaben, Erste-Schritte-Liste, kurzes Handbuch.
// Daten liegen in nx_tasks (RLS: owner_id = auth.uid()), höchstens 500 Aufgaben pro Konto.
import { sb, q, local } from "../lib/api.js";
import { h, icon, toast, toastErr, fmtDateTime, empty, formModal, confirmDialog, debounce } from "../lib/ui.js";

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
  const quick = h("input.input", { placeholder: "Neue Aufgabe – Enter zum Speichern", "aria-label": "Neue Aufgabe", maxlength: 300,
    onkeydown: async (e) => { if (e.key !== "Enter" || !e.target.value.trim()) return; const title = e.target.value.trim(); e.target.value = ""; await save({ title }); } });
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
        h("button.btn.sm.ghost", { "aria-label": `„${t.title}“ bearbeiten`, title: "Bearbeiten", onclick: () => edit(t) }, icon("edit")));
    }) : [empty("check", filter === "done" ? "Noch nichts erledigt" : "Alles erledigt", rows.length ? "In diesem Filter gibt es nichts." : "Tippe oben eine Aufgabe ein und drücke Enter – fertig.")]));
  }
  draw();
  return h("div",
    h("div.page-head", h("div", h("h1", "Aufgaben"), h("p", "Deine persönliche To-do-Liste – nur du siehst sie."), counter),
      h("button.btn.primary", { onclick: () => edit() }, icon("plus"), "Neue Aufgabe")),
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
    [projects > 0, "Erstes Projekt", "Wird beim Verbinden automatisch angelegt – oder von Hand über „Projekt anlegen“.", null],
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
      h("div.row", { style: { marginTop: "14px", gap: "8px" } }, h("button.btn", { onclick: () => ask("Wie funktioniert mein Bereich? Erkläre mir kurz die wichtigsten Funktionen.") }, icon("bot"), "KI fragen")))));
}
