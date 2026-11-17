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
export function eventCopilot({ ev, rows, kinds, insert, tickets = {}, onSync = null, info = "", addTask = null }) {
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
        days !== null && days < 0 ? h("button.chip", { onclick: () => ask("Schreibe einen Nachbericht: Zahlen (Tickets, Kosten, Einnahmen, Ergebnis), was gut lief, was offen blieb, 3 Learnings fürs nächste Mal. Markdown.") }, icon("book"), "Nachbericht")
          : h("button.chip", { onclick: () => suggest("Was muss in den letzten 7 Tagen vor dem Event und am Tag selbst erledigt werden? Nur noch fehlende Aufgaben (kind task, w 0 oder 1).", "macht die Endspurt-Liste") }, icon("check"), "Endspurt-Liste"),
        h("button.chip", { onclick: () => messageKit({ type: "event", name: ev.name, eventDate: ev.event_date, addTask, facts: `${facts()}${info ? `\n\nBESCHREIBUNG & LINKS:\n${info}` : ""}` }) }, icon("send"), "Nachrichten-Paket"),
        h("button.chip", { onclick: () => messageDialog(`${facts()}${info ? `\n${info.slice(0, 3000)}` : ""}`, { title: `Nachricht zu „${ev.name}“` }) }, icon("send"), "Einzelne Nachricht"),
        h("button.chip", { onclick: () => pasteListDialog(kinds, insert) }, icon("note"), "Liste einfügen"),
        onSync ? h("button.chip", { onclick: onSync }, icon("refresh"), "Mit Projekt abgleichen") : null),
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

// ---------------------------------------------------------------- Nachricht schreiben (WhatsApp, E-Mail, Instagram …)
const AUD = [["helfer", "Helfer / Team"], ["gaeste", "Gäste / Fans"], ["location", "Location / Vermieter"], ["sponsor", "Sponsor / Partner"], ["dj", "DJ / Künstler"], ["eltern", "Eltern"], ["behoerde", "Amt / Behörde"]];
const CH = [["whatsapp", "WhatsApp"], ["email", "E-Mail"], ["instagram", "Instagram-Post"], ["story", "Story / TikTok"]];
export async function messageDialog(facts, { title = "Nachricht schreiben" } = {}) {
  const { modal, copyText } = await import("./ui.js");
  const st = { aud: "helfer", ch: "whatsapp", goal: "" };
  const out = h("div");
  const seg = (list, key) => h("div.row.wrap", { style: { gap: "6px" } }, list.map(([k, t]) => h("button.chip", { type: "button", class: st[key] === k ? "on" : "", onclick: (e) => { st[key] = k; e.currentTarget.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === e.currentTarget)); } }, t)));
  const goal = h("input.input", { placeholder: "Worum geht's? z. B. „Schichten für Samstag verteilen“, „Ticketstart ankündigen“, „Angebot anfragen“", "aria-label": "Anliegen", maxlength: 300 });
  const go = h("button.btn.primary", { onclick: async () => {
    go.disabled = true; out.replaceChildren(spin("Die KI schreibt …"));
    try {
      const r = await aiGen({ task: "nachricht", json: true, instructions: `Schreibe eine ${CH.find((c) => c[0] === st.ch)[1]}-Nachricht an: ${AUD.find((a) => a[0] === st.aud)[1]}. Anliegen: ${goal.value.trim() || "passend zum aktuellen Stand"}.
Ton passend zum Kanal (WhatsApp locker und kurz, E-Mail höflich mit Betreff, Instagram mit Emojis und Hashtags). Nur Fakten aus den Daten verwenden, Platzhalter in [eckigen Klammern] für Unbekanntes.
Antworte NUR mit JSON: {"variants":[{"label":"…","subject":"nur bei E-Mail","text":"…"}]} – genau 2 Varianten (z. B. kurz / ausführlich).`, input: facts });
      out.replaceChildren(h("div.stack", ...(r.json?.variants || [{ label: "Text", text: r.text }]).slice(0, 3).map((v) => h("section.card", h("div.card-head", h("h3", v.label || "Variante"), h("button.btn.sm", { onclick: () => copyText(`${v.subject ? `Betreff: ${v.subject}\n\n` : ""}${v.text}`) }, icon("copy"), "Kopieren"),
        st.ch === "whatsapp" ? h("a.btn.sm.ghost", { href: `https://wa.me/?text=${encodeURIComponent(v.text || "")}`, target: "_blank", rel: "noopener" }, "In WhatsApp") : st.ch === "email" ? h("a.btn.sm.ghost", { href: `mailto:?subject=${encodeURIComponent(v.subject || "")}&body=${encodeURIComponent(v.text || "")}` }, "Im Mailprogramm") : null),
        h("div.card-body", v.subject ? h("div", h("b", "Betreff: "), v.subject) : null, h("div", { style: { whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.5 } }, v.text))))));
    } catch (e) { out.replaceChildren(h("div.banner.bad", errMsg(e))); }
    go.disabled = false;
  } }, icon("sparkles"), "Schreiben");
  modal(title, h("div.stack", h("div.faint", { style: { fontSize: "12.5px" } }, "An wen?"), seg(AUD, "aud"), h("div.faint", { style: { fontSize: "12.5px" } }, "Wo?"), seg(CH, "ch"), goal, h("div.row", go), out), { wide: true });
}

// ---------------------------------------------------------------- Liste einfügen (ohne KI): Namen/Aufgaben zeilenweise
export async function pasteListDialog(kinds, insert) {
  const { modal } = await import("./ui.js");
  const NAMES = { guest: "Gäste", task: "Aufgaben", cost: "Kosten (Titel; Betrag)", schedule: "Ablauf (HH:MM Titel)", shift: "Schichten" };
  let kind = kinds.includes("guest") ? "guest" : kinds[0];
  const ta = h("textarea.input", { rows: 8, maxlength: 20000, placeholder: "Eine Zeile pro Eintrag – z. B. aus WhatsApp, Excel oder Notizen kopiert", "aria-label": "Liste" });
  const m = modal("Liste einfügen", h("div.stack",
    h("div.row.wrap", { style: { gap: "6px" } }, kinds.filter((k) => NAMES[k]).map((k) => h("button.chip", { type: "button", class: k === kind ? "on" : "", onclick: (e) => { kind = k; e.currentTarget.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === e.currentTarget)); } }, NAMES[k]))),
    ta, h("div.faint", { style: { fontSize: "12.5px" } }, "Aufzählungszeichen, Nummern und doppelte Zeilen werden automatisch entfernt. Bei Kosten wird eine Zahl am Ende als Betrag erkannt."),
    h("div.row", { style: { justifyContent: "flex-end" } }, h("button.btn.primary", { onclick: async (e) => {
      const seen = new Set();
      const rows = ta.value.split(/\r?\n|;(?=\s*\D)/).map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)])\s*/, "").replace(/\t+/g, " ").trim()).filter((l) => l.length > 1 && !seen.has(l.toLowerCase()) && seen.add(l.toLowerCase())).slice(0, 300).map((l) => {
        if (kind === "cost") { const mm = /^(.*?)[\s;:,–-]+(\d+(?:[.,]\d{1,2})?)\s*(?:€|eur|euro)?$/i.exec(l); return { kind, title: (mm ? mm[1] : l).slice(0, 200), amount: mm ? Number(mm[2].replace(",", ".")) : null }; }
        return { kind, title: l.slice(0, 200) };
      });
      if (!rows.length) return toast("Keine Einträge erkannt.", "info");
      e.currentTarget.disabled = true;
      try { await insert(rows); m.close(); toast(`${rows.length} Einträge übernommen`); } catch (er) { toastErr(er); e.currentTarget.disabled = false; }
    } }, icon("check"), "Übernehmen"))));
}

// ---------------------------------------------------------------- Projekt-Copilot
export function projectCopilot({ name, facts, projectId = null, addTasks }) {
  const school = isSchool(`${name} ${facts.slice(0, 1500)}`);
  const out = h("div");
  const run = async (label, instr, json) => {
    out.replaceChildren(spin(`Die KI ${label} …`));
    try {
      const r = await aiGen({ task: "projekt-copilot", json, withContext: true, projectId, instructions: instr, input: facts });
      if (!json) { out.replaceChildren(h("div.md", md(r.text)), h("div.row", { style: { gap: "6px", marginTop: "8px" } }, h("button.btn.sm.ghost", { onclick: () => navigator.clipboard?.writeText(r.text).then(() => toast("Kopiert")) }, icon("copy"), "Kopieren"))); return; }
      const list = (r.json?.tasks || []).map((t) => ({ on: true, title: String(t.t || t.title || t).slice(0, 180), why: t.why || "", days: Number(t.days) || null })).filter((t) => t.title).slice(0, 10);
      out.replaceChildren(h("div.stack", { style: { gap: "8px" } }, r.json?.note ? h("div", { style: { fontSize: "13.5px" } }, r.json.note) : null,
        h("div.list", list.map((t) => h("label.list-item", { style: { alignItems: "flex-start" } }, h("input", { type: "checkbox", checked: true, onchange: (e) => { t.on = e.target.checked; } }), h("div.li-main", h("div.li-title", t.title), h("div.li-sub", { style: { whiteSpace: "normal" } }, [t.days ? `in ${t.days} Tagen` : null, t.why].filter(Boolean).join(" · ")))))),
        addTasks ? h("button.btn.primary.sm", { style: { alignSelf: "flex-start" }, onclick: async (e) => { e.currentTarget.disabled = true; const sel = list.filter((t) => t.on);
          try { await addTasks(sel.map((t) => ({ title: t.title, note: t.why, due: t.days ? new Date(Date.now() + t.days * 864e5).toISOString() : null }))); toast(`${sel.length} Aufgaben angelegt`); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("check"), "Als Aufgaben anlegen") : null));
    } catch (e) { out.replaceChildren(h("div.banner.bad", errMsg(e))); }
  };
  return h("section.card.copilot", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3.row", icon("sparkles"), "KI-Copilot"), h("span.faint", { style: { fontSize: "12px" } }, name)),
    h("div.card-body.stack", { style: { gap: "10px" } },
      h("div.row.wrap", { style: { gap: "6px" } },
        h("button.chip", { onclick: () => run("plant die nächsten Schritte", 'Schlage die nächsten konkreten Schritte für dieses Projekt vor (max. 8), sortiert nach Wichtigkeit. Antworte NUR mit JSON: {"note":"1 Satz Lage","tasks":[{"t":"…","days":3,"why":"kurz"}]} – days = in wie vielen Tagen erledigt sein sollte.', true) }, icon("check"), "Nächste Schritte"),
        h("button.chip", { onclick: () => run("prüft Risiken", "Nenne Risiken, Lücken und offene Fragen dieses Projekts (Markdown, max. 6 Punkte, je 1 Satz + was tun). Nichts erfinden.", false) }, icon("info"), "Risiken & Lücken"),
        h("button.chip", { onclick: () => run("schreibt ein Status-Update", "Schreibe ein kurzes Status-Update für Team oder Partner (Markdown): Stand, Erreicht, Als Nächstes, Wo Hilfe nötig ist. Max. 120 Wörter.", false) }, icon("send"), "Status-Update"),
        h("button.chip", { onclick: () => run("sammelt Ideen", "Gib 6 kreative, umsetzbare Ideen, wie dieses Projekt besser, bekannter oder erfolgreicher wird (Markdown-Liste, je 1-2 Sätze).", false) }, icon("zap"), "Ideen"),
        h("button.chip", { onclick: () => messageKit({ type: school ? "school" : "project", name, facts, addTask: addTasks ? (t) => addTasks([t]) : null }) }, icon("send"), school ? "Nachrichten an Lehrkraft" : "Nachrichten-Paket"),
        h("button.chip", { onclick: () => messageDialog(facts) }, icon("send"), "Einzelne Nachricht")),
      out));
}

// ---------------------------------------------------------------- Nachrichten-Paket: fertige, passende Nachrichten für die ganze Kommunikation
// Event: Ankündigung, Line-up/Musik, Ticketstart, Erinnerungen, Infos zum Abend, Danke …  Schulprojekt: Nachrichten an Lehrkraft und Gruppe.
const SCHOOL = /(schul|lehrer|lehrkraft|referat|facharbeit|klasse\b|abitur|\babi\b|hausaufgabe|präsentation|praesentation|seminar|unterricht|projektwoche|gfs|klausur|\bnote\b)/i;
export const isSchool = (t) => SCHOOL.test(String(t || ""));
const KIT = {
  event: { title: "Nachrichten fürs Event", aud: "Community, Gäste, Fans", items: [
    ["announce", "Ankündigung", "Save the Date: Was, wann, wo, für wen – neugierig machen", 6],
    ["lineup", "Line-up & Musik", "DJs/Acts und Musikrichtung vorstellen, Stimmung beschreiben", 5],
    ["tickets", "Ticketstart / Preise", "Tickets jetzt erhältlich, Preise/Staffel, Link", 5],
    ["lastcall", "Letzte Tickets", "Verknappung: Kontingent fast weg / Preis steigt", 1],
    ["week", "Erinnerung 1 Woche vorher", "Countdown, das Wichtigste nochmal, Vorfreude", 1],
    ["info", "Infos zum Abend", "Einlass, Adresse/Eingang, Ausweis, Altersregeln, Garderobe, Bar, Hausordnung", 0],
    ["today", "Heute ist es so weit", "Start-Nachricht am Eventtag, kurz und hyped", 0],
    ["thanks", "Danke & Rückblick", "Danke an Gäste, Fotos/Feedback, Ausblick aufs nächste Mal", -1],
  ] },
  school: { title: "Nachrichten fürs Schulprojekt", aud: "Lehrkraft und Gruppe", items: [
    ["topic", "Thema & Anforderungen klären", "An die Lehrkraft: Thema vorstellen, offene Fragen zu Anforderungen, Umfang, Bewertung", 0],
    ["meeting", "Termin für Besprechung", "An die Lehrkraft: höflich um kurze Besprechung bitten", 0],
    ["status", "Zwischenstand", "An die Lehrkraft: Stand, was fertig ist, was als Nächstes kommt, Fragen", 0],
    ["extend", "Bitte um Fristverlängerung", "An die Lehrkraft: Grund, neues Datum vorschlagen, respektvoll", 0],
    ["submit", "Abgabe", "An die Lehrkraft: Abgabe der Arbeit, kurze Zusammenfassung, Hinweis auf Anhang", 0],
    ["group", "Aufgaben in der Gruppe verteilen", "An Mitschüler: Wer macht was bis wann", 0],
    ["thanks", "Danke & Feedback erbitten", "An die Lehrkraft: Danke, um Rückmeldung bitten", 0],
  ] },
  project: { title: "Nachrichten fürs Projekt", aud: "Team, Partner, Community", items: [
    ["launch", "Ankündigung / Launch", "Projekt vorstellen, Nutzen, Link", 0],
    ["update", "Status-Update", "Fortschritt für Team/Partner", 0],
    ["ask", "Bitte um Hilfe / Feedback", "Konkrete Frage an Community oder Partner", 0],
    ["partner", "Anfrage an Partner/Sponsor", "Kurz, professionell, Mehrwert für den Partner", 0],
    ["thanks", "Danke", "Danke an Unterstützer", 0],
  ] },
};
export async function messageKit({ type = "event", name = "", facts = "", eventDate = null, addTask = null }) {
  const { modal, copyText } = await import("./ui.js");
  const kit = KIT[type] || KIT.project;
  const key = `kit:${type}:${name}`.slice(0, 120);
  const st = { ch: "whatsapp", tone: type === "school" ? "höflich" : "locker", extra: LS.get(`${key}:extra`, ""), teacher: LS.get(`${key}:teacher`, ""), sel: new Set(kit.items.map((x) => x[0])) };
  const out = h("div.stack");
  const cached = LS.get(key, null);
  const chips = (list, k) => h("div.row.wrap", { style: { gap: "6px" } }, list.map(([v, t]) => h("button.chip", { type: "button", class: st[k] === v ? "on" : "", onclick: (e) => { st[k] = v; e.currentTarget.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === e.currentTarget)); } }, t)));
  const pick = h("div.row.wrap", { style: { gap: "6px" } }, kit.items.map(([k, t]) => h("button.chip.on", { type: "button", onclick: (e) => { st.sel.has(k) ? st.sel.delete(k) : st.sel.add(k); e.currentTarget.classList.toggle("on"); } }, t)));
  const extra = h("textarea.input", { rows: 3, maxlength: 2500, "aria-label": type === "school" ? "Anforderungen der Lehrkraft" : "Zusätzliche Infos", placeholder: type === "school" ? "Anforderungen der Lehrkraft einfügen: Umfang, Abgabedatum, Format, Bewertungskriterien, Thema …" : "Optional: was unbedingt rein soll – z. B. DJ-Namen, Musikrichtung, Dresscode, Rabattcode, Links …", oninput: (e) => { st.extra = e.target.value; LS.set(`${key}:extra`, st.extra); } }, st.extra);
  const teacher = type === "school" ? h("input.input", { "aria-label": "Lehrkraft (Anrede und Name)", placeholder: "Lehrkraft, z. B. „Frau Müller“", maxlength: 80, value: st.teacher, oninput: (e) => { st.teacher = e.target.value; LS.set(`${key}:teacher`, st.teacher); } }) : null;
  const sendDate = (off) => { if (!eventDate || off === undefined || off === null || type !== "event") return null; const d = new Date(eventDate); if (off > 1) d.setDate(d.getDate() - off * 7); else if (off === 1) d.setDate(d.getDate() - 7); else if (off === -1) d.setDate(d.getDate() + 1); else d.setHours(12, 0, 0, 0); return d < new Date() && off !== 0 ? null : d.toISOString(); };

  function render(list, at) {
    out.replaceChildren(h("div.faint", { style: { fontSize: "12px" } }, `Erstellt ${new Date(at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })} · ${list.length} Nachrichten · auf diesem Gerät gespeichert`),
      ...list.map((v) => {
        const meta = kit.items.find((x) => x[0] === v.id);
        const when = meta ? sendDate(meta[3]) : null;
        const full = `${v.subject ? `Betreff: ${v.subject}\n\n` : ""}${v.text}`;
        return h("section.card", h("div.card-head", h("h3", { style: { fontSize: "14.5px" } }, v.label || meta?.[1] || "Nachricht"), when ? h("span.badge.b-idle", `senden ${new Date(when).toLocaleDateString("de-DE")}`) : null),
          h("div.card-body.stack", { style: { gap: "8px" } }, v.subject ? h("div", h("b", "Betreff: "), v.subject) : null,
            h("div", { style: { whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.5 } }, v.text),
            h("div.row.wrap", { style: { gap: "6px" } }, h("button.btn.sm", { onclick: () => copyText(full) }, icon("copy"), "Kopieren"),
              h("a.btn.sm.ghost", { href: `https://wa.me/?text=${encodeURIComponent(v.text || "")}`, target: "_blank", rel: "noopener" }, "WhatsApp"),
              h("a.btn.sm.ghost", { href: `mailto:?subject=${encodeURIComponent(v.subject || name)}&body=${encodeURIComponent(v.text || "")}` }, "E-Mail"),
              navigator.share ? h("button.btn.sm.ghost", { onclick: () => navigator.share({ text: full }).catch(() => {}) }, "Teilen") : null,
              addTask ? h("button.btn.sm.ghost", { title: "Als Aufgabe mit Termin anlegen", onclick: async (e) => { e.currentTarget.disabled = true; try { await addTask({ title: `Nachricht senden: ${v.label || meta?.[1]}`.slice(0, 200), note: full.slice(0, 1900), due: when }); toast("Erinnerung angelegt"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("clock"), "Erinnern") : null)));
      }));
  }
  async function run() {
    const want = kit.items.filter((x) => st.sel.has(x[0]));
    if (!want.length) return toast("Bitte mindestens eine Nachricht wählen.", "info");
    go.disabled = true; out.replaceChildren(spin(`Die KI schreibt ${want.length} Nachrichten …`));
    try {
      const chName = { whatsapp: "WhatsApp (Community-Gruppe/Broadcast)", email: "E-Mail", instagram: "Instagram-Post/Caption", story: "Story/Status (sehr kurz)" }[st.ch];
      const r = await aiGen({ task: "nachrichten-paket", json: true, maxTokens: 5000, withContext: false,
        instructions: `Schreibe fertige Nachrichten für „${name}“. Kanal: ${chName}. Ton: ${st.tone}. Empfänger: ${kit.aud}.${type === "school" ? ` Lehrkraft: ${st.teacher || "[Name der Lehrkraft]"} – korrekte, respektvolle Anrede (Sie-Form), klarer Betreff, Grußformel mit [Dein Name], [Klasse].` : ""}
Nutze ALLE passenden Fakten aus den Daten (bei Events z. B. DJs/Acts, Musikrichtung, Datum, Uhrzeit, Ort/Eingang, Alter/Ausweis, Preise, Ticket-Link, Social-Links, Regeln). Nichts erfinden – Unbekanntes als [Platzhalter]. ${st.ch === "whatsapp" ? "WhatsApp: kurze Absätze, *fett* für Wichtiges, passende Emojis sparsam." : st.ch === "email" ? "E-Mail: mit Betreff." : st.ch === "instagram" ? "Instagram: Hook in der ersten Zeile, Emojis, 5-10 Hashtags am Ende." : "Story: max. 2 Zeilen."}
Nachrichten (id: Zweck):
${want.map(([k, t, d]) => `- ${k}: ${t} – ${d}`).join("\n")}
Antworte NUR mit JSON: {"messages":[{"id":"…","label":"…","subject":"nur bei E-Mail/Schule","text":"…"}]}`,
        input: `${facts}${st.extra ? `\n\nZUSÄTZLICH VOM NUTZER:\n${st.extra}` : ""}`.slice(0, 18000) });
      const list = (r.json?.messages || []).filter((m) => m && m.text).map((m) => ({ id: String(m.id || ""), label: String(m.label || "").slice(0, 80), subject: m.subject ? String(m.subject).slice(0, 160) : "", text: String(m.text).slice(0, 4000) }));
      if (!list.length) throw new Error("Die KI hat keine Nachrichten geliefert – bitte nochmal versuchen.");
      LS.set(key, { at: Date.now(), list }); render(list, Date.now());
    } catch (e) { out.replaceChildren(h("div.banner.bad", errMsg(e))); }
    go.disabled = false;
  }
  const go = h("button.btn.primary", { onclick: run }, icon("sparkles"), cached ? "Neu schreiben" : "Nachrichten schreiben");
  modal(kit.title, h("div.stack",
    h("p.muted", { style: { margin: 0 } }, type === "school" ? "Die KI schreibt passende Nachrichten an deine Lehrkraft und deine Gruppe – zugeschnitten auf dein Projekt und die Anforderungen." : `Die KI schreibt alle Nachrichten für ${type === "event" ? "dein Event" : "dein Projekt"} – mit allen Infos (z. B. DJs, Musikrichtung, Zeiten, Ort, Tickets). Kopieren, in WhatsApp öffnen oder als Erinnerung zum richtigen Zeitpunkt anlegen.`),
    h("div.faint", { style: { fontSize: "12.5px" } }, "Welche Nachrichten?"), pick,
    h("div.faint", { style: { fontSize: "12.5px" } }, "Kanal"), chips([["whatsapp", "WhatsApp"], ["email", "E-Mail"], ["instagram", "Instagram"], ["story", "Story/Status"]], "ch"),
    h("div.faint", { style: { fontSize: "12.5px" } }, "Ton"), chips(type === "school" ? [["höflich", "Höflich"], ["sehr förmlich", "Sehr förmlich"], ["freundlich-locker (nur für Mitschüler)", "Locker"]] : [["locker", "Locker"], ["hyped, mit Energie", "Hyped"], ["seriös", "Seriös"], ["kurz und knapp", "Kurz"]], "tone"),
    teacher, extra, h("div.row", go), out), { wide: true });
  if (cached?.list?.length) render(cached.list, cached.at);
}
