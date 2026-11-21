// #/tasks – alle Aufgaben aus allen Projekten und Events an einem Ort, mit Fristen, Monatskalender und Kalender-Abo
import { sb, q, rpc, projects, local } from "../lib/api.js";
import { h, icon, clear, fmtDateTime, empty, formModal, confirmDialog, toast, toastErr, copyText, modal } from "../lib/ui.js";
import { CONFIG } from "../config.js";
import { parseQuickTask, breakDownDialog, prioritize } from "../lib/aiassist.js";
import { md } from "../lib/ui.js";
import { setTaskDoing } from "../lib/notetask.js";

const PRIO = { 0: ["Niedrig", "b-idle"], 1: ["Normal", "b-pri"], 2: ["Wichtig", "b-bad"] };
const toLocal = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
const dayKey = (d) => new Date(d).toLocaleDateString("sv-SE");

export default async function tasksView() {
  const root = h("div");
  let all = [], filter = local.get("taskFilter", "open"), view = local.get("taskView", "list"), month = new Date();
  const projs = await projects();
  // aus einer Mitteilung gekommen (#/tasks?t=<id>) → Aufgabe hervorheben
  const focusId = new URLSearchParams(location.hash.split("?")[1] || "").get("t");
  if (focusId) filter = "all";

  async function load() { all = await rpc("cc_tasks_all"); draw(); }
  function edit(t) {
    formModal(t ? "Aufgabe bearbeiten" : "Neue Aufgabe", [
      { name: "title", label: "Was ist zu tun?", required: true, max: 200, value: t?.title },
      { name: "due", label: "Fällig am", type: "datetime-local", value: t?.due ? toLocal(t.due) : "", half: true },
      { name: "priority", label: "Wichtigkeit", type: "select", value: String(t?.priority ?? 1), half: true, options: Object.entries(PRIO).map(([k, v]) => [k, v[0]]) },
      { name: "project_id", label: "Projekt", type: "select", value: t?.project_id || "", half: true, options: [["", "– keins –"], ...projs.map((p) => [p.id, p.name])] },
      { name: "assignee", label: "Zuständig", value: t?.assignee, half: true, max: 120, placeholder: "Name" },
      { name: "note", label: "Notiz", type: "textarea", rows: 2, value: t?.note, max: 2000 },
    ], async (v) => {
      const row = { title: v.title, note: v.note || "", due: v.due ? new Date(v.due).toISOString() : null, priority: Number(v.priority), project_id: v.project_id || null, assignee: v.assignee || null, reminded_at: null };
      if (t) await q(sb.from("cc_tasks").update(row).eq("id", t.id)); else await q(sb.from("cc_tasks").insert(row));
      toast("Gespeichert"); load();
    }, { submit: t ? "Speichern" : "Anlegen" });
  }
  async function toggle(t, done) {
    try { await rpc("cc_task_set", { p_src: t.src, p_id: t.id, p_done: done, p_widx: t.widx ?? null, p_idx: t.idx ?? null }); t.done = done; draw(); } catch (e) { toastErr(e); }
  }
  async function abo() {
    let token;
    try { token = await rpc("cc_ics_token", { p_reset: false }); } catch (e) { return toastErr(e); }
    const url = () => `${CONFIG.supabaseUrl}/functions/v1/nx-hub/ics/${token}.ics`;
    const inp = h("input.input.mono", { readOnly: true, "aria-label": "Kalender-Adresse", value: url(), onclick: (e) => e.target.select() });
    modal("Kalender-Abo fürs Handy", h("div.stack",
      h("p", { style: { margin: 0 } }, "Mit diesem Link erscheinen alle Events, Aufgaben mit Frist, Schichten und Posting-Termine automatisch in deinem Kalender. Er aktualisiert sich etwa stündlich von selbst."),
      inp,
      h("div.row.wrap", h("button.btn.primary", { onclick: () => copyText(url()) }, icon("copy"), "Link kopieren"),
        h("a.btn", { href: url().replace(/^https:/, "webcal:") }, icon("calendar"), "Im Kalender öffnen"),
        h("button.btn.ghost", { onclick: async () => { if (!(await confirmDialog("Neuen Link erzeugen?", "Der alte Link funktioniert danach nicht mehr – alle Kalender müssen den neuen Link abonnieren.", { ok: "Neu erzeugen" }))) return; token = await rpc("cc_ics_token", { p_reset: true }); inp.value = url(); toast("Neuer Link erzeugt"); } }, icon("refresh"), "Link erneuern")),
      h("ol.faint", { style: { fontSize: "13px", margin: 0, paddingLeft: "18px", lineHeight: 1.6 } },
        h("li", "iPhone: Einstellungen › Kalender › Accounts › Account hinzufügen › Andere › Kalenderabo hinzufügen › Link einfügen."),
        h("li", "Google Kalender (am PC): Weitere Kalender › Per URL › Link einfügen."),
        h("li", "Wer den Link kennt, kann die Termine lesen – nicht weitergeben."))), { wide: true });
  }

  function row(t) {
    const over = !t.done && t.due && new Date(t.due) < Date.now();
    return h("div.list-item", { "data-task": t.id, class: focusId === t.id ? "flash" : "" },
      h("input", { type: "checkbox", checked: t.done, "aria-label": "Erledigt", style: { width: "18px", height: "18px", accentColor: "var(--primary)", flex: "none" }, onchange: (e) => toggle(t, e.target.checked) }),
      h("div.li-main", h("div.li-title", { style: t.done ? { textDecoration: "line-through", color: "var(--text-3)" } : null }, t.title),
        h("div.li-sub", [t.context, t.due ? `fällig ${fmtDateTime(t.due)}` : null, t.assignee ? `zuständig: ${t.assignee}` : null, t.note].filter(Boolean).join(" · "))),
      t.status === "doing" && !t.done ? h("span.badge.b-pri", "in Bearbeitung") : null,
      over ? h("span.badge.b-bad", "überfällig") : null,
      !t.done && (t.src === "task" || t.src === "event") ? h("button.icon-btn", { title: t.status === "doing" ? "Nicht mehr in Bearbeitung" : "In Bearbeitung setzen", "aria-label": t.status === "doing" ? "Nicht mehr in Bearbeitung" : "In Bearbeitung setzen", "aria-pressed": String(t.status === "doing"),
        onclick: async () => { try { await setTaskDoing(t, t.status !== "doing"); draw(); } catch (e) { toastErr(e); } } }, icon(t.status === "doing" ? "stop" : "play")) : null,
      t.src === "task" && t.priority !== 1 ? h("span.badge", { class: PRIO[t.priority][1] }, PRIO[t.priority][0]) : null,
      !t.done ? h("button.icon-btn", { title: "KI: in Schritte zerlegen", "aria-label": `„${t.title}“ in Schritte zerlegen`, onclick: () => breakDownDialog(t, async (steps) => {
        await q(sb.from("cc_tasks").insert(steps.map((x, i) => ({ title: `${t.title.slice(0, 80)} › ${x}`.slice(0, 200), project_id: t.project_id || null, due: t.due || null, priority: t.priority ?? 1, note: `Schritt ${i + 1}` })))); load(); }) }, icon("sparkles")) : null,
      t.src === "task" ? h("button.icon-btn", { "aria-label": "Bearbeiten", onclick: () => edit(t) }, icon("edit")) : t.route ? h("a.icon-btn", { href: t.route, title: "Zum Ursprung", "aria-label": "Öffnen" }, icon("external")) : null,
      t.src === "task" ? h("button.icon-btn", { "aria-label": "Löschen", onclick: async () => { if (await confirmDialog("Aufgabe löschen?", `„${t.title}“ wird entfernt.`, { ok: "Löschen" })) { await q(sb.from("cc_tasks").delete().eq("id", t.id)); load(); } } }, icon("trash")) : null);
  }

  function calendar(list) {
    const y = month.getFullYear(), m = month.getMonth();
    const first = new Date(y, m, 1), start = new Date(y, m, 1 - ((first.getDay() + 6) % 7));
    const byDay = {};
    for (const t of list) if (t.due) (byDay[dayKey(t.due)] ||= []).push(t);
    const cells = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const items = byDay[dayKey(d)] || [];
      cells.push(h("div.cal-cell", { class: [d.getMonth() !== m ? "out" : "", dayKey(d) === dayKey(new Date()) ? "today" : ""].join(" ") },
        h("div.cal-day", d.getDate()),
        items.slice(0, 3).map((t) => h("div.cal-item", { class: t.done ? "done" : new Date(t.due) < Date.now() ? "over" : "", title: `${t.title} – ${t.context || ""}` }, t.title)),
        items.length > 3 ? h("div.cal-more", `+${items.length - 3} weitere`) : null));
    }
    const nav = (n) => () => { month = new Date(y, m + n, 1); draw(); };
    return h("section.card", h("div.card-head", h("h3", month.toLocaleDateString("de-DE", { month: "long", year: "numeric" })),
      h("div.row", { style: { gap: "6px" } }, h("button.btn.sm", { onclick: nav(-1), "aria-label": "Vorheriger Monat" }, "‹"), h("button.btn.sm", { onclick: () => { month = new Date(); draw(); } }, "Heute"), h("button.btn.sm", { onclick: nav(1), "aria-label": "Nächster Monat" }, "›"))),
      h("div.card-body", h("div.cal-grid", ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => h("div.cal-head", d)), cells)));
  }

  function draw() {
    const open = all.filter((t) => !t.done), over = open.filter((t) => t.due && new Date(t.due) < Date.now());
    const week = open.filter((t) => t.due && new Date(t.due) >= Date.now() && new Date(t.due) < Date.now() + 7 * 864e5);
    const list = filter === "open" ? open : filter === "over" ? over : filter === "week" ? week : filter === "done" ? all.filter((t) => t.done) : all;
    const groups = {};
    for (const t of list) (groups[t.context || "Ohne Projekt"] ||= []).push(t);
    const seg = (cur, set, opts) => h("div.seg", opts.map(([k, t]) => h("button", { class: cur === k ? "on" : "", onclick: () => set(k) }, t)));
    clear(root, 
      h("div.page-head", h("div", h("h1", "Aufgaben"), h("p", `${open.length} offen · ${over.length} überfällig · ${week.length} in den nächsten 7 Tagen · ${all.length - open.length} erledigt`)),
        h("div.actions", h("button.btn.primary", { onclick: () => edit() }, icon("plus"), "Neue Aufgabe"), h("button.btn", { onclick: async (e) => { const b = e.currentTarget; b.disabled = true; try { const txt = await prioritize(open.map((t) => ({ title: t.title, due: t.due, context: t.context }))); modal("KI: Was zuerst?", h("div.md", md(txt)), { wide: true }); } catch (er) { toastErr(er); } b.disabled = false; } }, icon("sparkles"), "KI: Was zuerst?"), h("button.btn", { onclick: abo }, icon("calendar"), "Kalender-Abo"))),
      h("div.row.wrap.between", { style: { marginBottom: "14px", gap: "10px" } },
        seg(filter, (k) => { filter = k; local.set("taskFilter", k); draw(); }, [["open", `Offen (${open.length})`], ["over", `Überfällig (${over.length})`], ["week", "Diese Woche"], ["done", "Erledigt"], ["all", "Alle"]]),
        seg(view, (k) => { view = k; local.set("taskView", k); draw(); }, [["list", "Liste"], ["cal", "Kalender"]])),
      h("form.row", { style: { gap: "8px", marginBottom: "14px" }, onsubmit: async (e) => {
        e.preventDefault(); const inp = e.target.querySelector("input"), t = inp.value.trim(); if (!t) return;
        const p = parseQuickTask(t);
        try { await q(sb.from("cc_tasks").insert({ title: p.title.slice(0, 200), due: p.due, priority: p.priority })); inp.value = ""; toast(p.due ? `Aufgabe angelegt – fällig ${fmtDateTime(p.due)}` : "Aufgabe angelegt"); load(); } catch (er) { toastErr(er); } } },
        h("input.input", { placeholder: "Schnell notieren – versteht z. B. „morgen 18 Uhr Getränke kaufen !“ oder „Fr Flyer drucken“", "aria-label": "Neue Aufgabe", maxlength: 200 }), h("button.btn", { type: "submit" }, icon("plus"), "Hinzufügen")),
      view === "cal" ? calendar(all)
        : list.length ? h("div.stack", { style: { gap: "14px" } }, Object.entries(groups).map(([g, items]) => h("section.card",
          h("div.card-head", h("h3", g), h("span.sub", `${items.filter((t) => !t.done).length} offen`)), h("div.card-body", h("div.list", items.map(row))))))
          : h("div.card", empty("check", filter === "open" ? "Alles erledigt" : "Keine Aufgaben in dieser Ansicht", "Hier erscheinen eigene Aufgaben, Aufgaben aus Events und die Checklisten aus deinen Projekt-Übersichten.",
            h("button.btn.primary", { onclick: () => edit() }, icon("plus"), "Neue Aufgabe"))));
  }
  await load();
  if (focusId) setTimeout(() => root.querySelector(`[data-task="${focusId}"]`)?.scrollIntoView({ block: "center", behavior: "smooth" }), 150);
  return root;
}
