// KI direkt in der Seite (ohne KI-Studio): Text-Helfer an jedem Textfeld, Event-Copilot, Tagesbriefing, Aufgaben zerlegen.
// Sparsam: Sofort-Hinweise rechnen im Browser; die KI wird nur auf Knopfdruck gefragt, Briefings werden pro Tag zwischengespeichert.
import { h, icon, toast, toastErr, errMsg, md, fmtEUR, fmtDateTime } from "./ui.js";
import { aiGen } from "./aigen.js";

const LS = { get: (k, d) => { try { const v = localStorage.getItem("cc:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("cc:" + k, JSON.stringify(v)); } catch { /* voll */ } } };
const spin = (t) => h("div.faint", { style: { fontSize: "13px" } }, h("span.spinner"), ` ${t}`);

// ---------------------------------------------------------------- Text-Helfer unter Textfeldern
const TEXT_OPS = [
  ["write", "Schreiben", "Schreibe einen passenden, konkreten Text für dieses Feld. Nutze vorhandene Stichworte."],
  ["better", "Verbessern", "Verbessere den Text: klarer, freundlicher, gut lesbar. Inhalt beibehalten."],
  ["short", "Kürzer", "Kürze den Text auf das Wichtigste (höchstens die Hälfte)."],
  ["fix", "Korrigieren", "Korrigiere nur Rechtschreibung, Grammatik und Zeichensetzung. Sonst nichts ändern."],
];
export function attachTextAI(ta, { label = "", context = "" } = {}) {
  if (!ta || ta.dataset.ai) return;
  ta.dataset.ai = "1";
  let undo = null;
  const back = h("button.chip", { type: "button", hidden: true, onclick: () => { if (undo !== null) { ta.value = undo; undo = null; back.hidden = true; ta.dispatchEvent(new Event("input")); } } }, "Rückgängig");
  const bar = h("div.ai-textbar", icon("sparkles"), ...TEXT_OPS.map(([k, t, instr]) => h("button.chip", { type: "button", onclick: async (e) => {
    const b = e.currentTarget, cur = ta.value.trim();
    if (k !== "write" && !cur) return toast("Erst etwas schreiben – oder „Schreiben“ wählen.", "info");
    b.disabled = true; const old = b.textContent; b.textContent = "…";
    try {
      const form = ta.closest("form");
      const around = form ? [...form.querySelectorAll("input.input,select.input")].map((x) => `${x.getAttribute("aria-label") || x.name}: ${x.value}`).filter((x) => !/: $/.test(x)).join("; ") : "";
      const r = await aiGen({ task: `text-${k}`, instructions: `${instr} Feld: „${label}“. Antworte NUR mit dem fertigen Text, ohne Anführungszeichen oder Erklärung. Deutsch, Ton passend.`,
        input: `${context ? `Kontext: ${context}\n` : ""}${around ? `Andere Angaben: ${around}\n` : ""}Aktueller Text: ${cur || "(leer)"}` });
      undo = ta.value; back.hidden = false;
      ta.value = String(r.text || "").replace(/^["„]|["“]$/g, "").trim().slice(0, Number(ta.maxLength) > 0 ? ta.maxLength : 8000);
      ta.dispatchEvent(new Event("input"));
    } catch (er) { toastErr(er); }
    b.disabled = false; b.textContent = old;
  } }, t)), back);
  ta.after(bar);
}

// ---------------------------------------------------------------- Event-Copilot (Karte auf der Event-Seite)
// ev: { name, event_date, location, capacity, ticket_price, budget }, rows: Einträge, kinds: erlaubte Arten, insert(rows) → Promise
export function eventCopilot({ ev, rows, kinds, insert, tickets = {} }) {
  const by = (k) => rows.filter((r) => r.kind === k);
  const sum = (k) => by(k).reduce((a, r) => a + (+(r.actual ?? r.amount) || 0), 0);
  const days = ev.event_date ? Math.ceil((new Date(ev.event_date) - Date.now()) / 864e5) : null;
  const open = by("task").filter((r) => !r.done);
  const overdue = open.filter((r) => r.at && new Date(r.at) < new Date());
  const cost = sum("cost") + sum("tech"), inc = sum("income");
  const tix = tickets.revenue ?? ((tickets.sold || 0) * (+ev.ticket_price || 0));
  const now = [];
  if (!ev.event_date) now.push(["warn", "Datum fehlt – ohne Datum keine Fristen und Erinnerungen."]);
  if (!ev.location) now.push(["warn", "Ort fehlt."]);
  if (overdue.length) now.push(["bad", `${overdue.length} Aufgabe${overdue.length === 1 ? "" : "n"} überfällig: ${overdue.slice(0, 2).map((r) => r.title).join(", ")}${overdue.length > 2 ? " …" : ""}`]);
  if (days !== null && days >= 0 && days <= 14 && open.length) now.push(["warn", `Noch ${days} Tage, ${open.length} offene Aufgaben.`]);
  if (ev.budget && cost > ev.budget) now.push(["bad", `Kosten ${fmtEUR(cost)} über Budget ${fmtEUR(ev.budget)}.`]);
  if (ev.ticket_price && cost > inc) { const need = Math.ceil((cost - inc) / ev.ticket_price); now.push([(tickets.sold || 0) >= need ? "ok" : "info", `Break-even bei ${need} Tickets${tickets.sold !== undefined ? ` – verkauft: ${tickets.sold || 0}` : ""}.`]); }
  if (!by("schedule").length && kinds.includes("schedule")) now.push(["info", "Noch kein Ablauf für den Tag."]);
  if (!by("shift").length && kinds.includes("shift") && (ev.capacity || 0) >= 50) now.push(["info", "Noch kein Schichtplan."]);
  if (!by("cost").length) now.push(["info", "Noch keine Kosten eingetragen."]);
  if (!now.length) now.push(["ok", "Alles im grünen Bereich – nichts Dringendes."]);
  const col = { ok: "var(--ok)", warn: "var(--warn)", bad: "var(--bad)", info: "var(--primary)" };
  const out = h("div");
  const facts = () => [`Event: ${ev.name}; Datum: ${ev.event_date ? fmtDateTime(ev.event_date) : "offen"} (${days ?? "?"} Tage); Ort: ${ev.location || "offen"}; Plätze: ${ev.capacity ?? "?"}; Ticketpreis: ${ev.ticket_price ?? "?"} €; Budget: ${ev.budget ?? "?"} €`,
    `Tickets: ${tickets.sold ?? "?"} verkauft, Ticket-Umsatz ${tix} €; Kosten ${cost} €; sonstige Einnahmen ${inc} €`,
    ...kinds.map((k) => `${k}: ${by(k).map((r) => `${r.done ? "[x] " : ""}${r.title}${r.amount ? ` (${r.amount} €)` : ""}`).join("; ").slice(0, 1500) || "leer"}`)].join("\n");

  async function suggest(focus, label) {
    out.replaceChildren(spin(`Die KI ${label} …`));
    try {
      const r = await aiGen({ task: "event-copilot", json: true, input: facts(), instructions: `Du bist Co-Pilot für die Eventplanung. ${focus}
Nur Einträge, die noch FEHLEN (nichts doppeln). Erlaubte kinds: ${kinds.join(", ")}. Realistische Beträge (€, Schätzung) bei cost/income. Zeit "HH:MM" bei schedule/shift, w = Wochen vor dem Event bei task.
Antworte NUR mit JSON: {"note":"1-2 Sätze","items":[{"kind":"task","t":"…","w":2,"time":"","to":"","eur":0,"why":"kurz"}]} (max. 12 items)` });
      const list = (r.json?.items || []).filter((x) => kinds.includes(x.kind) && x.t).slice(0, 12);
      if (!list.length) { out.replaceChildren(h("div.faint", r.json?.note || "Die KI hat nichts Fehlendes gefunden.")); return; }
      const day = ev.event_date ? new Date(ev.event_date) : null;
      const at = (x) => {
        if (day && x.kind === "task" && Number.isFinite(+x.w)) return new Date(day.getTime() - Math.max(0, +x.w) * 7 * 864e5).toISOString();
        if (day && /^\d{1,2}:\d{2}/.test(x.time || "")) { const d = new Date(day); const [H, M] = x.time.split(":").map(Number); d.setHours(H, M, 0, 0); if (H < 8 && day.getHours() > 12) d.setDate(d.getDate() + 1); return d.toISOString(); }
        return null;
      };
      const ends = (x) => { if (!day || !/^\d{1,2}:\d{2}/.test(x.to || "")) return null; const d = new Date(day); const [H, M] = x.to.split(":").map(Number); d.setHours(H, M, 0, 0); if (H < 8 && day.getHours() > 12) d.setDate(d.getDate() + 1); return d.toISOString(); };
      const pick = list.map((x) => ({ on: true, row: { kind: x.kind, title: `${x.kind === "schedule" && x.time ? `${x.time} ` : ""}${x.t}`.slice(0, 200), note: String(x.why || "").slice(0, 1000), at: at(x), ends_at: x.kind === "shift" ? ends(x) : null, amount: ["cost", "income", "tech"].includes(x.kind) && +x.eur > 0 ? +x.eur : null } }));
      const NAMES = { task: "Aufgabe", schedule: "Ablauf", cost: "Kosten", income: "Einnahme", shift: "Schicht", tech: "Technik", post: "Post", guest: "Gast", location: "Location" };
      out.replaceChildren(h("div.stack", { style: { gap: "8px" } },
        r.json?.note ? h("div", { style: { fontSize: "13.5px" } }, r.json.note) : null,
        h("div.list", pick.map((p) => h("label.list-item", { style: { alignItems: "flex-start" } }, h("input", { type: "checkbox", checked: true, onchange: (e) => { p.on = e.target.checked; } }),
          h("div.li-main", h("div.li-title", h("span.badge.b-idle", { style: { marginRight: "6px" } }, NAMES[p.row.kind] || p.row.kind), p.row.title), p.row.note || p.row.amount ? h("div.li-sub", { style: { whiteSpace: "normal" } }, [p.row.amount ? fmtEUR(p.row.amount) : null, p.row.note].filter(Boolean).join(" · ")) : null)))),
        h("div.row", { style: { gap: "8px" } }, h("button.btn.primary.sm", { onclick: async (e) => { e.currentTarget.disabled = true; const sel = pick.filter((p) => p.on).map((p) => p.row);
          try { if (sel.length) await insert(sel); toast(`${sel.length} Einträge übernommen`); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("check"), "Übernehmen"),
          h("button.btn.ghost.sm", { onclick: () => out.replaceChildren() }, "Verwerfen"))));
    } catch (e) { out.replaceChildren(h("div.banner.bad", errMsg(e))); }
  }
  async function ask(qq) {
    out.replaceChildren(spin("Die KI denkt nach …"));
    try { const r = await aiGen({ task: "event-frage", instructions: "Beantworte die Frage zu diesem Event kurz und konkret (Markdown, max. 8 Sätze oder eine Liste). Nur auf Basis der Daten, nichts erfinden, keine Paragraphen erfinden.", input: `${facts()}\n\nFRAGE: ${qq}` });
      out.replaceChildren(h("div.md", md(r.text)), h("div.faint", { style: { fontSize: "11.5px", marginTop: "6px" } }, `KI: ${r.model || ""}`)); } catch (e) { out.replaceChildren(h("div.banner.bad", errMsg(e))); }
  }
  const qin = h("input.input", { placeholder: "Frag zu diesem Event … z. B. „Reicht das Budget?“", "aria-label": "Frage zum Event", maxlength: 400 });
  return h("section.card.copilot", h("div.card-head", h("h3.row", icon("sparkles"), "KI-Copilot"), h("span.faint", { style: { fontSize: "12px" } }, "hilft direkt hier")),
    h("div.card-body.stack", { style: { gap: "10px" } },
      h("div.stack", { style: { gap: "4px" } }, ...now.slice(0, 5).map(([k, t]) => h("div.evw-fact", { style: { borderLeftColor: col[k] } }, t))),
      h("div.row.wrap", { style: { gap: "6px" } },
        h("button.chip", { onclick: () => suggest("Ergänze, was für dieses Event noch fehlt: Aufgaben, Kosten, Ablauf, Schichten.", "sucht Lücken") }, icon("plus"), "Fehlendes ergänzen"),
        kinds.includes("schedule") ? h("button.chip", { onclick: () => suggest("Erstelle den Ablauf am Eventtag (Aufbau bis Abbau) und passende Schichten (Einlass, Bar, Security …) für die Gästezahl.", "plant den Tag") }, icon("clock"), "Ablauf & Schichten") : null,
        h("button.chip", { onclick: () => suggest("Schätze fehlende Kostenposten und realistische Einnahmen (Tickets, Bar, Sponsoren) für dieses Event.", "rechnet") }, icon("wallet"), "Kosten & Einnahmen"),
        h("button.chip", { onclick: () => suggest(`Plane die Werbung: ${kinds.includes("post") ? "5-7 Posts (kind post, Kanal im why)" : "5 Aufgaben zum Posten (kind task, Kanal im Titel)"} mit Zeitpunkt in Wochen vor dem Event.`, "plant Werbung") }, icon("send"), "Werbeplan"),
        h("button.chip", { onclick: () => suggest("Was muss in den letzten 7 Tagen vor dem Event und am Tag selbst erledigt werden? Nur noch fehlende Aufgaben (kind task, w 0 oder 1).", "macht die Endspurt-Liste") }, icon("check"), "Endspurt-Liste")),
      h("form.row", { style: { gap: "6px" }, onsubmit: (e) => { e.preventDefault(); if (qin.value.trim()) ask(qin.value.trim()); } }, qin, h("button.btn.sm", { type: "submit", "aria-label": "Fragen" }, icon("send"))),
      out));
}

// ---------------------------------------------------------------- Tagesbriefing (einmal pro Tag, zwischengespeichert)
export function dailyBriefing({ key = "brief", projectHint = "", onOpen } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const cached = LS.get(`ai:${key}`, null);
  const box = h("div");
  const show = (txt, at) => box.replaceChildren(h("div.md", md(txt)), h("div.faint", { style: { fontSize: "11.5px", marginTop: "6px" } }, `Stand ${new Date(at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })} · einmal pro Tag erstellt`));
  const run = async () => {
    box.replaceChildren(spin("Die KI liest deine Projekte, Events und Aufgaben …"));
    try {
      const r = await aiGen({ task: "briefing", withContext: true, instructions: `Erstelle ein kurzes Tagesbriefing (Markdown) für heute, ${new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long" })}:
**Heute wichtig** (max. 3 Punkte, konkret mit Name), **Diese Woche** (max. 3), **Tipp** (1 Satz). Nur aus dem Kontext, nichts erfinden. Wenn nichts ansteht, sag das kurz und schlage einen sinnvollen nächsten Schritt vor.${projectHint ? ` Hinweis: ${projectHint}` : ""}`, input: "Briefing für heute" });
      LS.set(`ai:${key}`, { d: today, t: r.text, at: Date.now() }); show(r.text, Date.now());
    } catch (e) { box.replaceChildren(h("div.banner.bad", errMsg(e))); }
  };
  if (cached?.d === today) show(cached.t, cached.at);
  else box.replaceChildren(h("p.faint", { style: { margin: 0, fontSize: "13px" } }, "Die KI fasst zusammen, was heute und diese Woche wichtig ist – aus deinen Projekten, Events und Aufgaben."), h("button.btn.sm", { style: { marginTop: "8px" }, onclick: run }, icon("sparkles"), "Briefing erstellen"));
  return h("section.card", h("div.card-head", h("h3.row", icon("sparkles"), "KI-Briefing"), h("div.row", { style: { gap: "4px" } },
    cached?.d === today ? h("button.icon-btn", { title: "Neu erstellen", "aria-label": "Briefing neu erstellen", onclick: run }, icon("refresh")) : null,
    onOpen ? h("button.icon-btn", { title: "Im KI-Chat weiterfragen", "aria-label": "Im KI-Chat weiterfragen", onclick: onOpen }, icon("bot")) : null)), h("div.card-body", box));
}

// ---------------------------------------------------------------- Aufgabe in Schritte zerlegen
export async function breakDown(title, note = "") {
  const r = await aiGen({ task: "aufgabe-zerlegen", json: true, instructions: "Zerlege die Aufgabe in 3-7 konkrete, kleine Schritte in sinnvoller Reihenfolge (je max. 90 Zeichen). Antworte NUR mit JSON: {\"steps\":[\"…\"]}", input: `Aufgabe: ${title}${note ? `\nNotiz: ${note}` : ""}` });
  return (r.json?.steps || []).map((s) => String(s).trim()).filter(Boolean).slice(0, 7);
}

// ---------------------------------------------------------------- Aufgaben priorisieren
export async function prioritize(tasks) {
  const r = await aiGen({ task: "aufgaben-prio", withContext: true, instructions: `Ordne die offenen Aufgaben nach Dringlichkeit und Wirkung. Antworte in Markdown: **Zuerst** (max. 3 mit kurzem Warum), **Danach** (max. 5), **Kann warten**. Heute ist ${new Date().toLocaleDateString("de-DE")}.`,
    input: tasks.slice(0, 60).map((t) => `- ${t.title}${t.due ? ` (fällig ${new Date(t.due).toLocaleDateString("de-DE")})` : ""}${t.context ? ` [${t.context}]` : ""}`).join("\n") || "keine" });
  return r.text;
}

// ---------------------------------------------------------------- Schnell-Eingabe versteht Datum & Wichtigkeit (ohne KI, im Browser)
// „morgen 18 Uhr Getränke kaufen !“, „Fr Flyer drucken“, „14.2. GEMA anmelden wichtig“
const WD = { so: 0, mo: 1, di: 2, mi: 3, do: 4, fr: 5, sa: 6 };
export function parseQuickTask(text) {
  let t = ` ${text} `, due = null, priority = 1, hour = null;
  const take = (re, fn) => { const m = re.exec(t); if (m) { fn(m); t = t.replace(m[0], " "); } };
  take(/\s(!{1,3}|wichtig|dringend)\s/i, () => { priority = 2; });
  take(/\s(?:um\s)?(\d{1,2})(?::(\d{2}))?\s?uhr\s/i, (m) => { hour = [+m[1], +(m[2] || 0)]; });
  take(/\s(?:um\s)?(\d{1,2}):(\d{2})\s/, (m) => { hour = [+m[1], +m[2]]; });
  const now = new Date(); let day = null;
  take(/\s(heute)\s/i, () => { day = new Date(now); });
  take(/\s(übermorgen|uebermorgen)\s/i, () => { day = new Date(now); day.setDate(day.getDate() + 2); });
  take(/\s(morgen)\s/i, () => { day = new Date(now); day.setDate(day.getDate() + 1); });
  take(/\s(?:am\s)?(\d{1,2})\.(\d{1,2})\.(\d{2,4})?\s/, (m) => { const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : now.getFullYear(); day = new Date(y, +m[2] - 1, +m[1]); if (!m[3] && day < new Date(now.toDateString())) day.setFullYear(y + 1); });
  take(/\s(?:am\s|bis\s)?(mo|di|mi|do|fr|sa|so)[a-z]*\.?\s/i, (m) => { const w = WD[m[1].toLowerCase()]; day = new Date(now); const add = ((w - now.getDay()) + 7) % 7 || 7; day.setDate(day.getDate() + add); });
  take(/\s(nächste woche|naechste woche)\s/i, () => { day = new Date(now); day.setDate(day.getDate() + 7); });
  if (day || hour) { const d = day || new Date(now); d.setHours(hour ? hour[0] : 18, hour ? hour[1] : 0, 0, 0); if (!day && d < now) d.setDate(d.getDate() + 1); due = d.toISOString(); }
  const title = t.replace(/\s+/g, " ").trim();
  return { title: title || text.trim(), due, priority };
}

// Dialog: Schritte vorschlagen und als Unteraufgaben anlegen
export async function breakDownDialog(task, add) {
  const { modal } = await import("./ui.js");
  const box = h("div", spin("Die KI zerlegt die Aufgabe …"));
  const m = modal(`In Schritte zerlegen: ${task.title}`.slice(0, 80), box);
  try {
    const steps = await breakDown(task.title, task.note || "");
    if (!steps.length) { box.replaceChildren(h("div.faint", "Keine Schritte gefunden.")); return; }
    const on = steps.map(() => true);
    box.replaceChildren(h("div.stack", h("div.list", steps.map((s, i) => h("label.list-item", h("input", { type: "checkbox", checked: true, onchange: (e) => { on[i] = e.target.checked; } }), h("div.li-main", h("div.li-title", `${i + 1}. ${s}`))))),
      h("div.row", { style: { justifyContent: "flex-end", gap: "8px" } }, h("button.btn.ghost", { onclick: () => m.close() }, "Abbrechen"),
        h("button.btn.primary", { onclick: async (e) => { e.currentTarget.disabled = true; try { await add(steps.filter((_, i) => on[i])); m.close(); toast("Schritte angelegt"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("check"), "Als Aufgaben anlegen"))));
  } catch (e) { box.replaceChildren(h("div.banner.bad", errMsg(e))); }
}
