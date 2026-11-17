// Projekt-Übersicht für alle Konten (#/p/<id>): Kacheln (Kennzahlen, Diagramme, Listen …), Teilen mit KI-Vorschlägen,
// KI-Zusammenfassung – und Import aus Claude (Skill „nexus-board“) oder beliebigem Text, den die KI in Kacheln umwandelt.
import { sb, q, nx, local } from "../lib/api.js";
import { h, icon, toast, toastErr, fmtAgo, fmtEUR, empty, modal, errMsg, confirmDialog, md } from "../lib/ui.js";
import { staticWidgets } from "../lib/modules.js";
import { openShareDialog } from "../lib/share.js";
import { projectCopilot } from "../lib/aiassist.js";

const KIND_OK = ["website", "repo", "event", "ai", "database", "app", "other", "school", "shop", "business", "personal", "server", "api", "finance"];
const W_OK = ["markdown", "stats", "chart", "progress", "table", "timeline", "links", "checklist"];
const slugify = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || `projekt-${Date.now()}`;

// Eingefügten Steckbrief prüfen und auf sichere Kacheln begrenzen
function normalize(o) {
  const p = o?.nexus || o;
  if (!p || typeof p !== "object" || !p.name) return null;
  const widgets = (Array.isArray(p.widgets) ? p.widgets : []).filter((w) => W_OK.includes(w?.type)).slice(0, 40)
    .map((w) => (w.type === "links" ? { ...w, items: (w.items || []).filter((l) => /^https?:\/\//.test(l.url || "")) } : w));
  const tasks = (Array.isArray(p.tasks) ? p.tasks : []).slice(0, 100).map((t) => (typeof t === "string" ? { title: t } : t)).filter((t) => t?.title)
    .map((t) => ({ title: String(t.title).slice(0, 300), due: t.due && !Number.isNaN(Date.parse(t.due)) ? new Date(t.due).toISOString() : null, priority: [0, 1, 2].includes(t.priority) ? t.priority : 1, done: !!t.done }));
  const KINDS = ["task", "cost", "income", "guest", "schedule", "shift"];
  const ev = p.event && p.event.name ? { name: String(p.event.name).slice(0, 160), event_date: p.event.date && !Number.isNaN(Date.parse(p.event.date)) ? new Date(p.event.date).toISOString() : null,
    location: String(p.event.location || "").slice(0, 300), capacity: Number.isFinite(+p.event.capacity) && +p.event.capacity > 0 ? Math.round(+p.event.capacity) : null,
    ticket_price: Number.isFinite(+p.event.ticket_price) && +p.event.ticket_price > 0 ? +p.event.ticket_price : null, description: String(p.event.description || "").slice(0, 8000),
    items: (Array.isArray(p.event.items) ? p.event.items : []).slice(0, 300).filter((i) => i?.title && KINDS.includes(i.kind || "task")).map((i) => ({ kind: i.kind || "task", title: String(i.title).slice(0, 200),
      note: String(i.note || "").slice(0, 2000), at: i.at && !Number.isNaN(Date.parse(i.at)) ? new Date(i.at).toISOString() : null, amount: Number.isFinite(+i.amount) && i.amount !== null && i.amount !== "" ? +i.amount : null, done: !!i.done })) } : null;
  return { name: String(p.name).slice(0, 120), slug: slugify(p.slug || p.name), kind: KIND_OK.includes(p.kind) ? p.kind : "other",
    description: String(p.description || "").slice(0, 4000), url: /^https?:\/\//.test(p.url || "") ? String(p.url).slice(0, 500) : null, widgets, tasks, event: ev };
}
const findJson = (text) => { const m = String(text).match(/\{[\s\S]*\}/); if (!m) return null; try { return JSON.parse(m[0]); } catch { return null; } };

async function textToBoard(text) {
  const r = await nx("ai", { history: [], question: `Mach aus diesem Inhalt eine übersichtliche Projekt-Übersicht. Nur echte Angaben übernehmen, nichts erfinden.
Antworte NUR mit JSON: {"name":"…","kind":"school|shop|business|personal|website|app|server|api|finance|event|other","description":"2–3 Sätze","widgets":[…]}
Kacheln (nur passende, wichtigste zuerst, höchstens 10):
{"type":"stats","title":"…","items":[{"label":"…","value":12,"unit":"€"}]}
{"type":"chart","title":"…","chart":"bar|line|donut","labels":["…"],"series":[{"name":"…","values":[1,2]}]}
{"type":"progress","title":"…","items":[{"label":"…","value":3,"max":10}]}
{"type":"timeline","items":[{"date":"YYYY-MM-DD","title":"…","done":false}]}
{"type":"checklist","title":"…","items":[{"text":"…","done":false}]}
{"type":"table","title":"…","columns":["…"],"rows":[["…"]]}
{"type":"markdown","title":"…","content":"- …"}
{"type":"links","items":[{"title":"…","url":"https://…"}]}
Inhalt:
${String(text).slice(0, 12000)}` });
  return findJson(r.answer);
}

// Aufgaben und Event aus dem Steckbrief übernehmen – Gleiches wird aktualisiert statt doppelt angelegt
async function saveExtras(b) {
  const out = { tasks: 0, items: 0, event: null };
  if (b.tasks?.length) {
    const have = new Set((await q(sb.from("nx_tasks").select("title").limit(1000))).map((t) => t.title.toLowerCase()));
    const rows = b.tasks.filter((t) => !have.has(t.title.toLowerCase()));
    if (rows.length) { await q(sb.from("nx_tasks").insert(rows)); out.tasks = rows.length; }
  }
  if (b.event) {
    const { items, ...ev } = b.event;
    const all = await q(sb.from("nx_events").select("id,name,event_date,status").neq("status", "cancelled"));
    const day = (d) => (d ? new Date(d).toISOString().slice(0, 10) : null);
    const found = all.find((e) => e.name.toLowerCase() === ev.name.toLowerCase()) || (ev.event_date ? all.find((e) => day(e.event_date) === day(ev.event_date)) : null);
    const patch = Object.fromEntries(Object.entries(ev).filter(([, v]) => v !== null && v !== ""));
    const e = found ? await q(sb.from("nx_events").update(patch).eq("id", found.id).select("id").single()) : await q(sb.from("nx_events").insert(ev).select("id").single());
    out.event = e.id;
    if (items.length) {
      const cur = await q(sb.from("nx_event_items").select("id,kind,title").eq("event_id", e.id));
      for (const it of items) {
        const n = (x) => x.toLowerCase().replace(/[^a-z0-9äöüß ]/g, " ").replace(/\s+/g, " ").trim();
        const hit = cur.find((c) => c.kind === it.kind && n(c.title) === n(it.title))
          || cur.find((c) => c.kind === it.kind && Math.min(n(c.title).length, n(it.title).length) >= 4 && (n(c.title).includes(n(it.title)) || n(it.title).includes(n(c.title))));
        if (hit) await q(sb.from("nx_event_items").update(Object.fromEntries(Object.entries(it).filter(([, v]) => v !== null && v !== ""))).eq("id", hit.id));
        else { await q(sb.from("nx_event_items").insert({ ...it, event_id: e.id })); out.items++; }
      }
    }
  }
  return out;
}

async function saveBoard(b) {
  const mine = await q(sb.from("nx_projects").select("id,metadata").eq("source_key", `claude:${b.slug}`).maybeSingle()).catch(() => null);
  const row = { name: b.name, kind: b.kind, description: b.description, url: b.url, provider: "claude", metadata: { ...(mine?.metadata || {}), slug: b.slug, widgets: b.widgets, source: "claude", imported_at: new Date().toISOString() } };
  if (mine) { await q(sb.from("nx_projects").update(row).eq("id", mine.id)); return { id: mine.id, updated: true }; }
  const n = await q(sb.from("nx_projects").insert({ ...row, source_key: `claude:${b.slug}` }).select("id").single());
  return { id: n.id, updated: false };
}

// „Aus Claude einfügen“: JSON aus dem Skill – oder irgendein Text, die KI macht Kacheln daraus
export function importDialog() {
  const ta = h("textarea.input", { rows: 9, "aria-label": "Inhalt einfügen", placeholder: "Füge hier ein, was Claude mit dem Skill „nexus-board“ ausgegeben hat – oder einfach Notizen, eine Tabelle, Zahlen aus einem Chat …" });
  const preview = h("div");
  const go = h("button.btn.primary", {}, icon("sparkles"), "Vorschau");
  const save = h("button.btn.primary", { hidden: true }, icon("check"), "Speichern");
  let board = null;
  go.onclick = async () => {
    const text = ta.value.trim(); if (!text) return toast("Erst etwas einfügen", "err");
    go.disabled = true; preview.replaceChildren(h("div.faint", "Wird gelesen …"));
    try {
      board = normalize(findJson(text));
      if (!board) { preview.replaceChildren(h("div.faint", "Kein Steckbrief erkannt – die KI macht daraus eine Übersicht …")); board = normalize(await textToBoard(text)); }
      if (!board) throw new Error("Daraus konnte keine Übersicht gemacht werden.");
      preview.replaceChildren(h("div.card.card-pad", h("strong", board.name), h("div.faint", { style: { margin: "4px 0 10px" } }, [`${board.widgets.length} Kacheln`, board.tasks.length ? `${board.tasks.length} Aufgaben` : null, board.event ? `Event „${board.event.name}“ mit ${board.event.items.length} Einträgen` : null, board.description.slice(0, 160)].filter(Boolean).join(" · ")), staticWidgets(board.widgets) || h("div.faint", "Keine Kacheln – nur Name und Beschreibung.")));
      save.hidden = false;
    } catch (e) { preview.replaceChildren(h("div.banner.bad", errMsg(e))); } finally { go.disabled = false; }
  };
  save.onclick = async () => {
    save.disabled = true;
    try {
      const r = await saveBoard(board); const x = await saveExtras(board);
      toast([r.updated ? "Projekt aktualisiert" : "Projekt angelegt", x.tasks ? `${x.tasks} Aufgaben` : null, x.event ? `Event (${x.items} neue Einträge)` : null].filter(Boolean).join(" · "));
      m.close(); location.hash = x.event && !board.widgets.length ? `#/events/${x.event}` : `#/p/${r.id}`;
    }
    catch (e) { toastErr(e); save.disabled = false; }
  };
  const m = modal("Aus Claude oder Text einfügen", h("div.stack",
    h("div.na-note", icon("info"), h("div", "Mit dem Skill ", h("strong", "„nexus-board“"), " erstellt Claude in jedem Chat einen Steckbrief (Zahlen, Diagramme, Listen). Hier einfügen – gleiches Projekt wird aktualisiert statt doppelt angelegt. Normaler Text geht auch: die KI baut daraus Kacheln.")),
    ta, h("div.row", { style: { justifyContent: "flex-end", gap: "8px" } }, go, save), preview), { wide: true });
}

// KI fasst ein Projekt zusammen
async function aiSummary(p) {
  const box = h("div.faint", "Die KI liest das Projekt …");
  modal(`KI: ${p.name}`, box, { wide: true });
  const facts = JSON.stringify({ name: p.name, art: p.kind, beschreibung: p.description, status: p.status, tickets: p.metadata?.tickets, kacheln: p.metadata?.widgets }).slice(0, 12000);
  try {
    const r = await nx("ai", { history: [], question: `Fasse dieses Projekt für mich zusammen. Markdown, Deutsch, kurz: „Stand“ (2–3 Sätze), „Auffällig“ (Zahlen, Trends, Risiken), „Nächste Schritte“ (3 Punkte). Nur aus diesen Daten:\n${facts}` });
    box.className = ""; box.replaceChildren(md(r.answer || "Keine Antwort."));
  } catch (e) { box.replaceChildren(h("div.banner.bad", errMsg(e))); }
}

export async function projectPage(id, { ask } = {}) {
  const p = await q(sb.from("nx_projects").select("*").eq("id", id).maybeSingle());
  if (!p) return h("section.card", empty("folder", "Projekt nicht gefunden", "Vielleicht wurde es gelöscht.", h("a.btn", { href: "#/" }, "Zur Übersicht")));
  const t = p.metadata?.tickets, widgets = p.metadata?.widgets || [];
  local.set("ws:last-project", id);
  return h("div",
    h("div.crumb", h("a", { href: "#/" }, "Übersicht"), icon("chevronR"), h("span", p.name)),
    h("div.page-head", h("div", h("h1", p.name), h("p", [p.kind, p.provider === "claude" ? "aus Claude" : p.provider, `aktualisiert ${fmtAgo(p.updated_at)}`].filter(Boolean).join(" · "))),
      h("div.actions",
        h("button.btn.primary", { onclick: () => openShareDialog("nx_project", p.id, p.name, { tickets: !!t }) }, icon("users"), "Teilen"),
        h("button.btn", { onclick: () => aiSummary(p) }, icon("sparkles"), "KI-Zusammenfassung"),
        h("button.btn", { onclick: () => import("./studio.js").then((m) => m.openStudio("bogen", `np:${p.id}`)) }, icon("check"), "Rechts-Check & Plan"),
        h("button.btn", { onclick: () => import("./studio.js").then((m) => m.openStudio("marketing", `np:${p.id}`)) }, icon("zap"), "Marketing"),
        ask ? h("button.btn", { onclick: () => ask(`Zu meinem Projekt „${p.name}“: `) }, icon("bot"), "KI fragen") : null,
        p.url ? h("a.btn.ghost", { href: p.url, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Öffnen") : null,
        ["claude", "manual"].includes(p.provider) ? h("button.btn.ghost", { "aria-label": "Projekt löschen", onclick: async () => {
          if (!(await confirmDialog("Projekt löschen?", `„${p.name}“ und seine Freigaben werden gelöscht.`, { ok: "Löschen" }))) return;
          try { await q(sb.from("cc_shares").delete().in("item_kind", ["nx_project", "tickets"]).eq("item_id", p.id)).catch(() => {}); await q(sb.from("nx_projects").delete().eq("id", p.id)); toast("Gelöscht"); location.hash = "#/"; } catch (e) { toastErr(e); }
        } }, icon("trash")) : null)),
    p.description ? h("section.card.card-pad", { style: { marginBottom: "16px" } }, md(p.description)) : null,
    projectCopilot({ name: p.name, facts: `Projekt: ${p.name} [${p.kind}, ${p.status}]${p.url ? ` ${p.url}` : ""}\nBeschreibung: ${String(p.description || "").slice(0, 3000)}\nKacheln: ${JSON.stringify(widgets).slice(0, 5000)}${p.metadata?.profile ? `\nProjekt-Check: ${(p.metadata.profile.check || []).map((c) => c.title).join("; ")}` : ""}${t ? `\nTickets: ${t.sold ?? 0}, Umsatz ${t.revenue ?? "?"} €` : ""}`,
      addTasks: async (list) => { await q(sb.from("nx_tasks").insert(list.map((x) => ({ title: `${p.name}: ${x.title}`.slice(0, 300), note: x.note || "", due: x.due })))); } }),
    p.metadata?.profile ? h("section.card", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3", "Projekt-Check"), h("span.faint", { style: { fontSize: "12px" } }, `geprüft ${fmtAgo(p.metadata.profile.checked_at)}`)),
      h("div.card-body", h("div.row.wrap", { style: { gap: "6px" } }, (p.metadata.profile.check || []).slice(0, 12).map((c) => h("span.badge", { class: c.level === "muss" ? "b-bad" : c.level === "wichtig" ? "b-warn" : "b-idle" }, c.title))),
        h("button.btn.sm", { style: { marginTop: "10px" }, onclick: () => import("./studio.js").then((m) => m.openStudio("bogen", `np:${p.id}`)) }, "Erneut prüfen / anpassen"))) : null,
    p.metadata?.ai_summary ? h("section.card", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3", "KI-Zusammenfassung"), h("span.faint", { style: { fontSize: "12px" } }, fmtAgo(p.metadata.ai_summary.at))), h("div.card-body", md(p.metadata.ai_summary.text))) : null,
    t ? h("div.grid.g-3", { style: { marginBottom: "16px" } }, h("div.card.stat", h("div.k", icon("ticket"), "Tickets"), h("div.v", String(t.sold ?? 0))),
      t.revenue !== undefined ? h("div.card.stat", h("div.k", icon("wallet"), "Umsatz"), h("div.v", fmtEUR(t.revenue))) : null) : null,
    widgets.length ? staticWidgets(widgets) : h("section.card", empty("dashboard", "Noch keine Kacheln", "Frag Claude mit dem Skill „nexus-board“ nach einem Steckbrief zu diesem Thema und füge ihn hier ein – oder füge Notizen/Zahlen ein, die KI macht Kacheln daraus.",
      h("button.btn.primary", { onclick: () => importDialog() }, icon("sparkles"), "Inhalt einfügen"))));
}
