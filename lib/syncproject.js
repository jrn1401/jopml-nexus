// Event mit einem Projekt abgleichen: Die KI liest das Projekt (Beschreibung + alle Kacheln/Module) und das Event,
// schlägt vor, was am Event geändert, entfernt oder ergänzt werden soll (Projekt = aktueller Stand) – Vorschau zum Abhaken, dann übernehmen.
// Vorher wird der alte Stand gesichert (Admin: im Event, Konten: auf diesem Gerät) und lässt sich wiederherstellen.
import { sb, q } from "./api.js";
import { h, icon, toast, toastErr, errMsg, modal, fmtEUR, confirmDialog } from "./ui.js";
import { aiGen } from "./aigen.js";

const LS = { get: (k) => { try { return JSON.parse(localStorage.getItem("cc:" + k)); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem("cc:" + k, JSON.stringify(v)); } catch { /* voll */ } } };

// Kacheln/Module in lesbaren Text verwandeln (spart KI-Zeichen)
export function widgetText(w) {
  if (!w || typeof w !== "object") return "";
  const t = w.title ? `## ${w.title}\n` : "";
  switch (w.type) {
    case "markdown": case "note": return t + String(w.content || w.text || "");
    case "checklist": case "timeline": return t + (w.items || []).map((i) => `- [${i.done ? "x" : " "}] ${i.date ? `${i.date} ` : ""}${i.text || i.title || ""}`).join("\n");
    case "table": return t + [(w.columns || []).join(" | "), ...(w.rows || []).map((r) => (Array.isArray(r) ? r : Object.values(r)).join(" | "))].join("\n");
    case "stats": return t + (w.items || []).map((i) => `- ${i.label}: ${i.value}${i.unit ? ` ${i.unit}` : ""}`).join("\n");
    case "links": return t + (w.items || []).map((i) => `- ${i.title}`).join("\n");
    case "chart": return t + (w.series || []).map((s) => `${s.name}: ${(w.labels || []).map((l, i) => `${l} ${s.values?.[i]}`).join(", ")}`).join("\n");
    default: return t + JSON.stringify(w).replace(/[{}"[\]]/g, " ").replace(/\s+/g, " ").slice(0, 800);
  }
}
const moduleText = (m) => {
  const c = m.config || {};
  const body = Array.isArray(c.widgets) ? c.widgets.map(widgetText).join("\n\n") : c.text || c.content || (Array.isArray(c.items) ? c.items.map((i) => `- ${i.title || i.text || ""}`).join("\n") : JSON.stringify(c).slice(0, 1500));
  return `# Modul: ${m.name}\n${body}`;
};

async function loadProject(admin, id) {
  if (admin) {
    const [p, mods] = await Promise.all([q(sb.from("cc_projects").select("id,name,description,metadata,updated_at").eq("id", id).single()), q(sb.from("cc_modules").select("name,module_type,config,position").eq("project_id", id).order("position"))]);
    return { name: p.name, text: [`PROJEKT: ${p.name} (Stand ${new Date(p.updated_at).toLocaleDateString("de-DE")})`, p.description || "", ...mods.filter((m) => !/^alte |veraltet|archiv/i.test(m.name)).map(moduleText)].join("\n\n") };
  }
  const p = await q(sb.from("nx_projects").select("id,name,description,metadata,updated_at").eq("id", id).single());
  const w = p.metadata?.widgets || [];
  const tk = p.metadata?.tickets;
  return { name: p.name, text: [`PROJEKT: ${p.name} (Stand ${new Date(p.updated_at).toLocaleDateString("de-DE")})`, p.description || "", ...w.map(widgetText),
    tk ? `Tickets live: ${tk.sold} verkauft, Umsatz ${tk.revenue} €${(tk.tiers || []).length ? ` (${tk.tiers.map((x) => `${x.name}: ${x.sold}`).join(", ")})` : ""}` : "", p.metadata?.begin ? `Beginn ${p.metadata.begin}, Ende ${p.metadata.end || "?"}` : ""].filter(Boolean).join("\n\n") };
}

// Hauptdialog. admin: cc_events/cc_event_items, sonst nx_events/nx_event_items
export async function projectSyncDialog({ admin, ev, items, projects, onDone }) {
  const T = admin ? { ev: "cc_events", it: "cc_event_items", proj: "project_id" } : { ev: "nx_events", it: "nx_event_items", proj: "nx_project_id" };
  const KINDS = admin ? ["task", "schedule", "cost", "income", "shift", "tech", "post", "guest", "location"] : ["task", "schedule", "cost", "income", "shift", "guest"];
  const backupKey = `sync-backup:${ev.id}`;
  const backup = admin ? ev.metadata?.backup_before_project_sync : LS.get(backupKey);
  const body = h("div.stack");
  const m = modal("Mit Projekt abgleichen (KI)", body, { wide: true });
  // verknüpftes Projekt – sonst das mit dem ähnlichsten Namen vorschlagen
  const words = (t) => new Set(String(t || "").toLowerCase().match(/[a-zäöüß0-9]{4,}/g) || []);
  const ew = words(ev.name);
  let pid = ev[T.proj] || ((projects || []).map((p) => [p.id, [...words(p.name)].filter((w) => ew.has(w)).length]).sort((a, b) => b[1] - a[1]).find((x) => x[1] > 0) || [""])[0];
  const sel = h("select.input", { "aria-label": "Projekt", onchange: (e) => { pid = e.target.value; } }, h("option", { value: "" }, "– Projekt wählen –"), (projects || []).map((p) => h("option", { value: p.id, selected: p.id === pid }, p.name)));
  const out = h("div.stack");
  const go = h("button.btn.primary", { onclick: () => run() }, icon("sparkles"), "Abgleichen");
  body.append(
    h("p.muted", { style: { margin: 0 } }, "Die KI liest das Projekt (Beschreibung und alle Kacheln) und vergleicht es mit dem Event. Das Projekt gilt als aktueller Stand: Veraltetes wird zum Entfernen vorgeschlagen, Abweichendes zum Ändern, Fehlendes zum Ergänzen. Du entscheidest pro Punkt."),
    h("div.row.wrap", { style: { gap: "8px" } }, h("div", { style: { flex: "1 1 260px" } }, sel), go),
    backup?.items ? h("div.faint", { style: { fontSize: "12.5px" } }, `Sicherung vom ${new Date(backup.at).toLocaleString("de-DE")} vorhanden (${backup.items.length} Einträge). `,
      h("button.btn.sm.ghost", { onclick: () => restore(backup) }, icon("refresh"), "Wiederherstellen")) : null,
    out);

  async function run() {
    if (!pid) return toast("Bitte ein Projekt wählen.", "info");
    go.disabled = true; out.replaceChildren(h("div.faint", h("span.spinner"), " Die KI liest Projekt und Event und vergleicht … (10–20 Sek.)"));
    try {
      const proj = await loadProject(admin, pid);
      const list = items.map((x, i) => `#${i + 1} [${x.kind}${x.done ? "|erledigt" : ""}] ${x.title}${x.amount != null ? ` (${x.amount} €)` : ""}${x.at ? ` @${new Date(x.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` : ""}`).join("\n");
      const evText = `EVENT: ${ev.name}\nDatum: ${ev.event_date ? new Date(ev.event_date).toLocaleString("de-DE") : "offen"}\nOrt: ${ev.location || "offen"}\nBudget: ${ev.budget ?? "?"} €\nGäste/Plätze: ${ev.expected_guests ?? ev.capacity ?? "?"}\nBeschreibung: ${String(ev.description || "").slice(0, 1200)}\n\nEINTRÄGE:\n${list}`;
      const r = await aiGen({ task: "projekt-abgleich", json: true, maxTokens: 4000, input: `${proj.text.slice(0, 11000)}\n\n==========\n\n${evText.slice(0, 8500)}`,
        instructions: `Gleiche das EVENT mit dem PROJEKT ab. Das PROJEKT ist der aktuelle, richtige Stand. Ziel: Das Event soll danach genau dem Projekt entsprechen.
- remove: Einträge, die laut Projekt veraltet, verworfen, gestrichen oder doppelt sind (z. B. abgesagte Location, gestrichene Getränke, alte Uhrzeiten). Erledigte Aufgaben, die noch stimmen, NICHT entfernen.
- update: Einträge, deren Titel, Betrag, Zeit oder Erledigt-Status laut Projekt anders ist. Nur geänderte Felder angeben. time als "TT.MM.JJJJ HH:MM".
- add: Was im Projekt steht, aber im Event fehlt (Aufgaben, Kosten mit Betrag, Einnahmen, Ablaufpunkte mit Zeit, Regeln als Aufgaben). Erlaubte kinds: ${KINDS.join(", ")}.
- event: nur Felder, die laut Projekt anders sind (name, location, budget, guests, date als "TT.MM.JJJJ HH:MM").
Nichts erfinden. Kurze Titel (max. 140 Zeichen). Gib bei jedem Punkt ein kurzes "why" an.
Antworte NUR mit JSON: {"note":"2 Sätze: was abweicht","event":{},"remove":[{"n":1,"why":""}],"update":[{"n":2,"title":"","amount":0,"done":false,"time":"","why":""}],"add":[{"kind":"task","t":"","eur":0,"time":"","why":""}]}` });
      show(proj, r.json || {});
    } catch (e) { out.replaceChildren(h("div.banner.bad", errMsg(e))); }
    go.disabled = false;
  }

  const parseTime = (s) => { const mm = /(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s || ""); return mm ? new Date(+mm[3], +mm[2] - 1, +mm[1], +(mm[4] || 12), +(mm[5] || 0)).toISOString() : null; };

  function show(proj, j) {
    const at = (n) => items[(Number(n) || 0) - 1];
    const rem = (j.remove || []).filter((x) => at(x.n)).slice(0, 40).map((x) => ({ on: true, item: at(x.n), why: x.why }));
    const upd = (j.update || []).filter((x) => at(x.n)).slice(0, 30).map((x) => {
      const it = at(x.n), patch = {};
      if (x.title && x.title !== it.title) patch.title = String(x.title).slice(0, 200);
      if (x.amount !== undefined && x.amount !== null && x.amount !== "" && +x.amount !== +it.amount) patch.amount = +x.amount || null;
      if (typeof x.done === "boolean" && x.done !== !!it.done) patch.done = x.done;
      const tt = parseTime(x.time); if (tt) patch.at = tt;
      return { on: true, item: it, patch, why: x.why };
    }).filter((x) => Object.keys(x.patch).length && !rem.some((r) => r.item === x.item));
    const add = (j.add || []).filter((x) => KINDS.includes(x.kind) && x.t).slice(0, 25).map((x) => ({ on: true, row: { kind: x.kind, title: String(x.t).slice(0, 200), note: `Aus Projekt „${proj.name}“${x.why ? `: ${x.why}` : ""}`.slice(0, 1000), amount: +x.eur > 0 ? +x.eur : null, at: parseTime(x.time) } }));
    const e = j.event || {}, evPatch = {};
    if (e.name && e.name !== ev.name) evPatch.name = String(e.name).slice(0, 160);
    if (e.location && e.location !== ev.location) evPatch.location = String(e.location).slice(0, 300);
    if (+e.budget > 0 && +e.budget !== +ev.budget) evPatch.budget = +e.budget;
    if (+e.guests > 0) evPatch[admin ? "expected_guests" : "capacity"] = +e.guests;
    const d = parseTime(e.date); if (d && (!ev.event_date || Math.abs(new Date(d) - new Date(ev.event_date)) > 6e4)) evPatch.event_date = d;
    let evOn = Object.keys(evPatch).length > 0;
    const FL = { name: "Name", location: "Ort", budget: "Budget", expected_guests: "Gäste", capacity: "Plätze", event_date: "Datum" };
    const fmtV = (k, v) => k === "event_date" ? new Date(v).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : k === "budget" ? fmtEUR(v) : v;
    const row = (o, main, sub) => h("label.list-item", { style: { alignItems: "flex-start" } }, h("input", { type: "checkbox", checked: true, onchange: (ev2) => { o.on = ev2.target.checked; } }), h("div.li-main", h("div.li-title", { style: { whiteSpace: "normal" } }, main), sub ? h("div.li-sub", { style: { whiteSpace: "normal" } }, sub) : null));
    const sec = (title, n, kids) => n ? h("details.evw-group", { open: true }, h("summary", h("b", title), h("span.faint", ` ${n}`)), h("div.list", kids)) : null;
    const total = rem.length + upd.length + add.length + (evOn ? 1 : 0);
    if (!total) { out.replaceChildren(h("div.na-note", icon("check"), h("div", j.note || "Event und Projekt stimmen überein – nichts zu ändern."))); return; }
    const apply = h("button.btn.primary", { onclick: async () => {
      apply.disabled = true;
      try {
        // Sicherung
        const snap = { at: new Date().toISOString(), event: { name: ev.name, location: ev.location, event_date: ev.event_date, budget: ev.budget }, items: items.map((x) => { const c = { ...x }; delete c.event_id; return c; }) };
        if (admin) await q(sb.from("cc_events").update({ metadata: { ...(ev.metadata || {}), backup_before_project_sync: snap, synced_from_project: { at: snap.at, project_id: pid } } }).eq("id", ev.id));
        else LS.set(backupKey, snap);
        const delIds = rem.filter((x) => x.on).map((x) => x.item.id);
        if (delIds.length) await q(sb.from(T.it).delete().in("id", delIds));
        for (const u of upd.filter((x) => x.on)) await q(sb.from(T.it).update(u.patch).eq("id", u.item.id));
        const ins = add.filter((x) => x.on).map((x) => ({ ...x.row, event_id: ev.id }));
        if (ins.length) await q(sb.from(T.it).insert(ins));
        const patch = evOn ? { ...evPatch } : {};
        if (!ev[T.proj]) patch[T.proj] = pid;
        if (Object.keys(patch).length) await q(sb.from(T.ev).update(patch).eq("id", ev.id));
        m.close(); toast(`Abgeglichen: ${delIds.length} entfernt, ${upd.filter((x) => x.on).length} geändert, ${ins.length} ergänzt`); onDone?.();
      } catch (er) { toastErr(er); apply.disabled = false; }
    } }, icon("check"), "Übernehmen");
    out.replaceChildren(
      j.note ? h("div.na-note", icon("sparkles"), h("div", j.note)) : null,
      evOn ? h("details.evw-group", { open: true }, h("summary", h("b", "Event-Daten")), h("label.list-item", h("input", { type: "checkbox", checked: true, onchange: (x) => { evOn = x.target.checked; } }),
        h("div.li-main", Object.entries(evPatch).map(([k, v]) => h("div", { style: { fontSize: "13.5px" } }, h("b", `${FL[k]}: `), h("s.faint", String(fmtV(k, ev[k]) ?? "–")), " → ", String(fmtV(k, v))))))) : null,
      sec("Entfernen (veraltet/doppelt)", rem.length, rem.map((x) => row(x, h("span", { style: { textDecoration: "line-through" } }, x.item.title), x.why))),
      sec("Ändern", upd.length, upd.map((x) => row(x, x.patch.title || x.item.title, [x.patch.amount !== undefined ? `Betrag ${fmtEUR(x.item.amount || 0)} → ${fmtEUR(x.patch.amount || 0)}` : null, x.patch.done !== undefined ? (x.patch.done ? "→ erledigt" : "→ offen") : null, x.patch.at ? `Zeit → ${new Date(x.patch.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" })}` : null, x.patch.title ? `vorher: ${x.item.title}` : null, x.why].filter(Boolean).join(" · ")))),
      sec("Ergänzen", add.length, add.map((x) => row(x, x.row.title, [x.row.kind, x.row.amount ? fmtEUR(x.row.amount) : null, x.row.at ? new Date(x.row.at).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" }) : null].filter(Boolean).join(" · ")))),
      h("div.row", { style: { justifyContent: "space-between", gap: "8px" } }, h("span.faint", { style: { fontSize: "12.5px" } }, "Vorher wird automatisch gesichert."), apply));
  }

  async function restore(b) {
    if (!(await confirmDialog("Sicherung wiederherstellen?", `Stand vom ${new Date(b.at).toLocaleString("de-DE")}: Alle jetzigen Einträge dieses Events werden durch die Sicherung ersetzt.`, { danger: true, ok: "Wiederherstellen" }))) return;
    try {
      await q(sb.from(T.it).delete().eq("event_id", ev.id));
      const rows = b.items.map((x) => { const c = { ...x, event_id: ev.id }; delete c.created_at; return c; });
      for (let i = 0; i < rows.length; i += 100) await q(sb.from(T.it).insert(rows.slice(i, i + 100)));
      const ep = {}; for (const k of ["name", "location", "event_date", "budget"]) if (b.event?.[k] !== undefined) ep[k] = b.event[k];
      if (Object.keys(ep).length) await q(sb.from(T.ev).update(ep).eq("id", ev.id));
      m.close(); toast("Sicherung wiederhergestellt"); onDone?.();
    } catch (e) { toastErr(e); }
  }
}
