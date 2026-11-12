// Gastansicht: zeigt nur freigegebene Inhalte (über cc_guest_* / cc_link_open – nie direkte Tabellenzugriffe).
import { sb, rpc } from "../lib/api.js";
import { h, icon, clear, badge, EVENT_STATUS, fmtDateTime, fmtEUR, fmtBytes, fmtAgo, md, toast, toastErr, empty, errMsg, formModal } from "../lib/ui.js";
import { LOC_STATUS } from "./event.js";
import { CONFIG } from "../config.js";
import { webSharedBlock } from "../lib/web.js";

const SEC = { task: ["Aufgaben", "check"], schedule: ["Ablauf", "clock"], location: ["Location", "pin"], tech: ["Technik", "zap"], guest: ["Gästeliste", "users"], cost: ["Kosten", "wallet"], income: ["Einnahmen", "chart"] };

async function fileUrl(ctx, fileId) {
  const headers = { "Content-Type": "application/json", apikey: CONFIG.supabaseKey };
  const body = { file_id: fileId };
  if (ctx.token) body.token = ctx.token;
  else { const { data: { session } } = await sb.auth.getSession(); headers.Authorization = `Bearer ${session?.access_token}`; body.share_id = ctx.shareId; }
  const r = await fetch(`${CONFIG.supabaseUrl}/functions/v1/cc-api/share/file`, { method: "POST", headers, body: JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error || `Download nicht möglich (HTTP ${r.status})`);
  return d.url;
}

// Team-Bereich einer Event-Freigabe: Schichtplan, Kommentare und (mit Recht „Mitarbeiten“) neue Einträge
function teamBlock(ctx, reload) {
  const box = h("div", { style: { marginTop: "16px" } });
  const call = (action = null) => rpc("cc_share_team", { p_share: ctx.shareId || null, p_token: ctx.token || null, p_action: action });
  const toLocal = (iso) => { const d = new Date(iso); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  async function draw(action) {
    let t;
    try { t = await call(action); } catch (e) { if (action) toastErr(e); return; }
    const edit = t.permission === "edit";
    const add = (kind, label, it) => () => formModal(it ? "Bearbeiten" : label, [
      { name: "title", label: kind === "guest" ? "Name" : kind === "shift" ? "Aufgabe der Schicht" : "Titel", required: true, max: 200, value: it?.title, placeholder: kind === "shift" ? "z. B. Garderobe" : "" },
      ...(kind === "guest" ? [] : [{ name: "at", label: kind === "shift" ? "Beginn" : "Fällig am", type: "datetime-local", half: true, value: it?.at ? toLocal(it.at) : "" }]),
      ...(kind === "shift" ? [{ name: "ends_at", label: "Ende", type: "datetime-local", half: true, value: it?.ends_at ? toLocal(it.ends_at) : "" }] : []),
      ...(kind === "guest" ? [] : [{ name: "assignee", label: "Wer?", max: 120, value: it?.assignee }]),
      { name: "note", label: "Notiz", max: 2000, value: it?.note },
    ], async (v) => { await draw({ kind: "item", item: { id: it?.id, kind, title: v.title, note: v.note, assignee: v.assignee || null, at: v.at ? new Date(v.at).toISOString() : null, ends_at: v.ends_at ? new Date(v.ends_at).toISOString() : null } }); toast("Gespeichert"); if (kind !== "shift") reload?.(); });
    const ta = h("textarea.input", { rows: 2, maxlength: 2000, placeholder: "Nachricht an das Team …", "aria-label": "Kommentar" });
    const time = (d) => new Date(d).toLocaleString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    box.replaceChildren(h("div.grid.g-2", { style: { alignItems: "start" } },
      t.shifts.length || edit ? h("section.card", h("div.card-head", h("h3.row", icon("clock"), "Schichtplan"), edit ? h("button.btn.sm.ghost", { onclick: add("shift", "Neue Schicht") }, icon("plus"), "Schicht") : null),
        h("div.card-body", t.shifts.length ? h("div.list", t.shifts.map((s) => h("div.list-item", h("div.li-main", h("div.li-title", s.title, s.assignee ? ` – ${s.assignee}` : ""),
          h("div.li-sub", [s.at ? time(s.at) : "Zeit offen", s.ends_at ? `bis ${new Date(s.ends_at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" })}` : null, s.note].filter(Boolean).join(" · "))),
          !s.assignee ? h("span.badge.b-warn", "frei") : null, edit ? h("button.icon-btn", { "aria-label": "Bearbeiten", onclick: add("shift", "", s) }, icon("edit")) : null)))
          : h("div.faint", { style: { fontSize: "13px" } }, "Noch keine Schichten."))) : null,
      h("section.card", h("div.card-head", h("h3.row", icon("users"), "Team-Kommentare"), edit ? h("div.row", { style: { gap: "6px" } }, h("button.btn.sm.ghost", { onclick: add("task", "Neue Aufgabe") }, icon("plus"), "Aufgabe"), h("button.btn.sm.ghost", { onclick: add("guest", "Gast hinzufügen") }, icon("plus"), "Gast")) : null),
        h("div.card-body.stack", t.comments.length ? h("div.list", t.comments.map((c) => h("div.list-item", h("div.li-main", h("div.li-sub", `${c.author} · ${fmtAgo(c.at)}`), h("div", { style: { whiteSpace: "pre-wrap", fontSize: "14px" } }, c.body)))))
          : h("div.faint", { style: { fontSize: "13px" } }, "Noch keine Kommentare."),
          ta, h("div.row", { style: { justifyContent: "flex-end" } }, h("button.btn.primary", { onclick: async () => { const b = ta.value.trim(); if (!b) return; await draw({ kind: "comment", body: b }); } }, icon("send"), "Senden"))))));
  }
  draw();
  return box;
}

// Inhalt einer Freigabe darstellen. ctx: { token } für Links oder { shareId } für angemeldete Gäste
export function renderShared(p, ctx, reload) {
  const canTick = ["tasks", "edit"].includes(p.share?.permission) && p.type === "event";
  const fileList = (files) => files.length ? h("div.list", files.map((f) => h("div.list-item",
    h("div.li-icon", icon("file")), h("div.li-main", h("div.li-title", f.name), h("div.li-sub", `${f.path} · ${fmtBytes(f.size)}`)),
    h("button.btn.sm", { onclick: async (e) => { e.currentTarget.disabled = true; try { window.open(await fileUrl(ctx, f.id), "_blank", "noopener"); } catch (er) { toastErr(er); } finally { e.currentTarget.disabled = false; } } }, icon("download"), "Laden"))))
    : h("div.faint", "Keine Dateien.");
  if (p.type === "event") {
    const ev = p.event, items = p.items || [];
    const sec = (kind) => {
      const list = items.filter((i) => i.kind === kind);
      if (!list.length) return null;
      return h("section.card", h("div.card-head", h("h3.row", icon(SEC[kind][1]), SEC[kind][0], kind === "task" ? h("span.faint", { style: { fontWeight: 400 } }, `${list.filter((i) => i.done).length}/${list.length}`) : null)),
        h("div.card-body", h("div.list", list.map((it) => h("div.list-item",
          (kind === "task" || kind === "tech") ? h("input", { type: "checkbox", checked: it.done, disabled: !canTick, "aria-label": "Erledigt", style: { width: "18px", height: "18px", accentColor: "var(--primary)" },
            onchange: async (e) => { try { await rpc("cc_share_set_done", { p_share: ctx.shareId || null, p_token: ctx.token || null, p_item: it.id, p_done: e.target.checked }); toast(e.target.checked ? "Erledigt" : "Wieder offen"); it.done = e.target.checked; reload?.(); } catch (er) { e.target.checked = !e.target.checked; toastErr(er); } } }) : null,
          kind === "schedule" ? h("span.mono", { style: { minWidth: "48px", color: "var(--primary)" } }, it.at ? new Date(it.at).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : "–") : null,
          h("div.li-main", h("div.li-title", { style: it.done && kind === "task" ? { textDecoration: "line-through", color: "var(--text-3)" } : null }, it.title),
            it.note || (it.at && kind === "task") ? h("div.li-sub", [it.at && kind === "task" ? `bis ${fmtDateTime(it.at)}` : null, it.note].filter(Boolean).join(" · ")) : null,
            it.url ? h("a.li-sub", { href: it.url, target: "_blank", rel: "noopener noreferrer", style: { color: "var(--primary)" } }, it.url.replace(/^https?:\/\//, "").slice(0, 50)) : null),
          kind === "location" && it.status ? badge(LOC_STATUS, it.status) : null,
          it.amount !== null && it.amount !== undefined ? h("span.nowrap", fmtEUR(it.amount)) : null)))));
    };
    const ms = ev.date ? new Date(ev.date) - Date.now() : null;
    return h("div",
      h("div.page-head", h("div", h("h1", ev.name), h("div.row.wrap", { style: { gap: "8px", marginTop: "8px" } }, badge(EVENT_STATUS, ev.status),
        h("span.faint", { style: { fontSize: "13px" } }, [ev.date ? fmtDateTime(ev.date) : "ohne Datum", ev.location].filter(Boolean).join(" · "))))),
      ms !== null && ms > 0 ? h("div.countdown", { style: { maxWidth: "360px" } }, h("div", h("strong", Math.floor(ms / 86400_000)), h("span", "Tage")), h("div", h("strong", Math.floor((ms % 86400_000) / 3600_000)), h("span", "Std."))) : null,
      ev.description ? h("section.card.card-pad", { style: { marginBottom: "16px" } }, md(ev.description)) : null,
      canTick ? h("div.na-note", { style: { marginBottom: "16px" } }, icon("check"), h("div", p.share.permission === "edit" ? "Du arbeitest mit: Aufgaben abhaken und neue Aufgaben, Schichten und Gäste anlegen." : "Du darfst Aufgaben abhaken.")) : null,
      h("div.grid.g-2", ["task", "schedule", "location", "tech", "guest", "cost", "income"].map(sec)),
      teamBlock(ctx, reload));
  }
  if (p.type === "project" || p.type === "site") {
    const pr = p.project, t = p.tickets;
    return h("div",
      h("div.page-head", h("div", h("h1", pr.name), h("p", [p.from ? `geteilt von ${p.from}` : null, ...(pr.tags || [])].filter(Boolean).join(" · ")))),
      webSharedBlock(p.web),
      t ? h("div.grid.g-3", { style: { marginBottom: "16px" } }, h("div.card.stat", h("div.k", icon("ticket"), "Tickets verkauft"), h("div.v", String(t.sold ?? 0))),
        h("div.card.stat", h("div.k", icon("wallet"), "Umsatz"), h("div.v", fmtEUR(t.revenue))), h("div.card.stat", h("div.k", icon("clock"), "Stand"), h("div.v", { style: { fontSize: "16px" } }, fmtAgo(t.as_of)))) : null,
      pr.description ? h("section.card.card-pad", { style: { marginBottom: "16px" } }, md(pr.description)) : null,
      h("div.grid.g-2",
        p.files?.length ? h("section.card", h("div.card-head", h("h3", "Dateien")), h("div.card-body", fileList(p.files || []))) : null,
        p.events?.length ? h("section.card", h("div.card-head", h("h3", "Events")), h("div.card-body", h("div.list", p.events.map((e) => h("div.list-item", h("div.li-icon", icon("calendar")),
          h("div.li-main", h("div.li-title", e.name), h("div.li-sub", [e.date ? fmtDateTime(e.date) : null, e.location].filter(Boolean).join(" · "))), badge(EVENT_STATUS, e.status)))))) : null,
        p.links?.length ? h("section.card", h("div.card-head", h("h3", "Links")), h("div.card-body", h("div.list", p.links.filter((l) => /^https?:\/\//.test(l.url || "")).map((l) =>
          h("a.list-item", { href: l.url, target: "_blank", rel: "noopener noreferrer" }, h("div.li-icon", icon("link")), h("div.li-main", h("div.li-title", l.title || l.url))))))) : null,
        ...(p.notes || []).map((n) => h("section.card", h("div.card-head", h("h3", n.title)), h("div.card-body", h("div", { style: { whiteSpace: "pre-wrap", fontSize: "13.5px" } }, n.text))))));
  }
  return h("div", h("div.page-head", h("div", h("h1", p.file.name), h("p", `${p.file.path} · ${fmtBytes(p.file.size)}`))),
    p.file.summary ? h("section.card.card-pad", { style: { marginBottom: "16px" } }, md(p.file.summary)) : null,
    h("section.card.card-pad", fileList(p.files || [])));
}

function frame(right, body) {
  return h("div.guest-wrap",
    h("header.guest-top", h("div.brand", h("div.brand-mark", icon("logo")), h("div.brand-text", CONFIG.appName, h("small", "Geteilt mit dir"))), h("div.spacer"), right),
    h("main.content", body));
}

// Öffentlicher Gäste-Link (#/s/<token>), funktioniert ohne Anmeldung
export async function renderLink(root, token) {
  const draw = async () => {
    try {
      const p = await rpc("cc_link_open", { p_token: token });
      if (!p) throw new Error("not_shared");
      if (p.share?.permission === "door") { const { doorPanel } = await import("./door.js"); clear(root, frame(null, doorPanel({ token }))); document.title = `Abendkasse · ${CONFIG.appName}`; return; }
      clear(root, frame(null, renderShared(p, { token }, draw)));
      document.title = `${p.event?.name || p.project?.name || p.file?.name} · ${CONFIG.appName}`;
    } catch (e) {
      clear(root, frame(null, empty("lock", "Link ungültig oder abgelaufen", /not_shared/.test(errMsg(e)) ? "Bitte die Person, die dir den Link geschickt hat, um einen neuen Link." : errMsg(e))));
    }
  };
  await draw();
}

// Angemeldeter Gast (Google-Konto ohne Admin-Rechte)
export async function renderGuest(root, who) {
  const out = h("button.btn.sm.ghost", { onclick: async () => { await sb.auth.signOut(); location.hash = ""; location.reload(); } }, icon("logout"), "Abmelden");
  const body = h("div");
  const show = async () => {
    const m = location.hash.match(/^#\/g\/([0-9a-f-]{36})$/);
    clear(root, frame(h("div.row", h("span.faint.hide-sm", { style: { fontSize: "12.5px" } }, who.email || ""), out), body));
    body.replaceChildren(h("div.spinner"));
    try {
      if (m) {
        const p = await rpc("cc_guest_open", { p_share: m[1] });
        body.replaceChildren(h("div.crumb", h("a", { href: "#/" }, "Mit dir geteilt"), icon("chevronR"), h("span", p.event?.name || p.project?.name || p.file?.name)),
          renderShared(p, { shareId: m[1] }, null));
        return;
      }
      const list = await rpc("cc_guest_list");
      const KI = { event: "calendar", project: "folder", file: "file" };
      body.replaceChildren(h("div.page-head", h("div", h("h1", "Mit dir geteilt"), h("p", `Angemeldet als ${who.email}`))),
        list.length ? h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" } }, list.map((s) =>
          h("a.card.card-pad", { href: `#/g/${s.id}`, style: { display: "flex", gap: "12px", alignItems: "center" } }, h("div.li-icon", icon(KI[s.kind])),
            h("div.li-main", h("div.li-title", s.title || "Gelöscht"), h("div.li-sub", [s.date ? fmtDateTime(s.date) : null, s.permission === "tasks" ? "Aufgaben abhaken erlaubt" : "nur ansehen", `geteilt ${fmtAgo(s.created_at)}`].filter(Boolean).join(" · "))))))
          : h("div.card", empty("lock", "Noch nichts geteilt", `Für ${who.email} wurde noch nichts freigegeben. Sobald etwas mit dir geteilt wird, erscheint es hier.`)));
    } catch (e) { body.replaceChildren(empty("alert", "Nicht verfügbar", /not_shared/.test(errMsg(e)) ? "Diese Freigabe gibt es nicht mehr." : errMsg(e), h("a.btn", { href: "#/" }, "Zur Übersicht"))); }
  };
  window.addEventListener("hashchange", show);
  await show();
}
