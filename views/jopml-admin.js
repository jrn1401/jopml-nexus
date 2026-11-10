// JOPML-Serversteuerung im Control Center: Schalter, Ansage, Mindestversion, Tickets, Meldungen, Fehlergruppen, Budget, Online-Verlauf.
// Alles über die vorhandenen admin-geschützten Funktionen (jopml_admin_*); Änderungen landen im JOPML-Admin-Protokoll.
import { rpc, api } from "../lib/api.js";
import { h, icon, fmtNum, fmtCompact, fmtAgo, fmtDateTime, toast, toastErr, confirmDialog, formModal, meter, naNote, empty, md } from "../lib/ui.js";
import { lineChart } from "../lib/charts.js";
import { lazy } from "../lib/modules.js";

const card = (t, el, cls = "w-6", extra) => h("section.card", { class: cls }, h("div.card-head", h("h3", t), extra || null), h("div.card-body", el));
const reload = () => dispatchEvent(new Event("hashchange"));

export async function setConfig(key, value) {
  await rpc("jopml_admin_config_set", { p: { key, value } });
}

// Banner, wenn der Wartungsmodus aktiv ist (wird auch auf dem Dashboard gezeigt)
export function maintenanceBanner(cfg, { onOff } = {}) {
  if (!cfg?.maintenance) return null;
  return h("div.banner.warn", icon("alert"),
    h("div", h("strong", "JOPML-Wartungsmodus ist aktiv. "), "Der Launcher zeigt Nutzern eine Wartungsmeldung."),
    h("button.btn.sm", { onclick: async () => {
      if (!(await confirmDialog("Wartungsmodus beenden?", "Der Launcher ist danach wieder normal nutzbar.", { danger: false, ok: "Beenden" }))) return;
      try { await setConfig("maintenance", false); toast("Wartungsmodus beendet"); (onOff || reload)(); } catch (e) { toastErr(e); }
    } }, "Beenden"));
}

export function controlCard(cfg) {
  const sw = (key, label, sub, danger) => {
    const inp = h("input", { type: "checkbox", checked: cfg[key] === true, "aria-label": label, onchange: async (e) => {
      const want = e.target.checked;
      if (danger && want && !(await confirmDialog(`${label} einschalten?`, sub, { ok: "Einschalten" }))) { e.target.checked = !want; return; }
      e.target.disabled = true;
      try { await setConfig(key, want); cfg[key] = want; toast(`${label}: ${want ? "an" : "aus"}`); if (key === "maintenance") reload(); }
      catch (er) { e.target.checked = !want; toastErr(er); } finally { e.target.disabled = false; }
    } });
    return h("label.switch-row", h("div", h("div.li-title", label), h("div.li-sub", sub)), h("span.switch", inp, h("i")));
  };
  return card("Server-Steuerung (Launcher)", h("div.stack", { style: { gap: "4px" } },
    sw("ai_enabled", "KI-Chat aktiv", "Schaltet den KI-Chat im Launcher für alle Nutzer an/aus."),
    sw("ai_web", "KI-Websuche erlaubt", "Erlaubt Live-Suche (Gemini Google-Suche / Groq compound)."),
    sw("maintenance", "Wartungsmodus", "Nutzer sehen eine Wartungsmeldung – nur für Updates oder Störungen.", true),
    h("dl.kv", { style: { marginTop: "10px" } },
      h("dt", "Ansage"), h("dd", cfg.announcement ? String(cfg.announcement) : h("span.faint", "keine")),
      h("dt", "Mindestversion"), h("dd", cfg.min_version ? String(cfg.min_version) : h("span.faint", "keine"))),
    h("div.row.wrap", { style: { marginTop: "8px" } },
      h("button.btn.sm", { onclick: () => formModal("Ansage im Launcher", [
        { name: "a", label: "Text (leer = keine Ansage)", type: "textarea", rows: 3, value: cfg.announcement || "", max: 400 }],
        async (v) => { await setConfig("announcement", v.a); toast("Ansage gespeichert"); reload(); }) }, icon("note"), "Ansage"),
      h("button.btn.sm", { onclick: () => formModal("Mindestversion", [
        { name: "v", label: "Version (z. B. 1.13.2, leer = keine)", value: cfg.min_version || "", max: 11, hint: "Ältere Launcher werden zum Update aufgefordert." }],
        async (v) => { if (v.v && !/^\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v.v)) throw new Error("Format: 1.2.3"); await setConfig("min_version", v.v); toast("Mindestversion gespeichert"); reload(); }) }, icon("box"), "Mindestversion"))), "w-4");
}

export function aiCheckCard() {
  const out = h("div.stack", { style: { gap: "8px" } }, h("div.faint", { style: { fontSize: "13px" } }, "Prüft live, ob Gemini und Groq antworten (verbraucht wenige Tokens)."));
  const btn = h("button.btn.sm", { onclick: async () => {
    btn.disabled = true; out.replaceChildren(h("div.skel", { style: { height: "60px" } }));
    try {
      const r = await api("ping", { ai: "all" });
      const rows = (r.probes || []).map((p) => h("div.list-item", h("span.dot", { style: { background: p.ok ? "var(--ok)" : "var(--bad)" } }),
        h("div.li-main", h("div.li-title.mono", p.name), h("div.li-sub", p.ok ? `antwortet · ${p.ms} ms` : p.error || "Fehler")), h("span.badge", { class: p.ok ? "b-ok" : "b-bad" }, p.ok ? "OK" : "Fehler")));
      out.replaceChildren(
        h("div.row.wrap", { style: { gap: "6px" } }, ["gemini", "groq"].map((k) => h("span.badge", { class: r.providers?.[k] ? "b-ok" : "b-idle" }, `${k}-Schlüssel ${r.providers?.[k] ? "vorhanden" : "fehlt"}`))),
        rows.length ? h("div.list", rows) : naNote(r.ai?.ok ? `KI antwortet (${r.ai.provider} · ${r.ai.model}, ${r.ai.ms} ms)` : `KI antwortet nicht: ${r.ai?.error || "unbekannt"}`, r.ai?.ok ? "check" : "alert"),
        h("div.faint", { style: { fontSize: "12px" } }, `Datenbank ${r.db_ms} ms · geprüft ${fmtDateTime(r.time)}`));
    } catch (e) { out.replaceChildren(naNote(e.message, "alert")); } finally { btn.disabled = false; }
  } }, icon("zap"), "KI jetzt prüfen");
  return card("KI-Prüfung", out, "w-4", btn);
}

export function budgetCard() {
  return card("KI-Tagesbudget (alle Nutzer)", lazy(async () => {
    const [b] = await rpc("jopml_admin_ai_budget");
    if (!b) return h("div.faint", "Keine Budgetdaten.");
    const row = (label, used, max, fmt) => h("div", { style: { marginBottom: "12px" } },
      h("div.row.between", { style: { fontSize: "13px" } }, h("span.muted", label), h("span", `${fmt(used)} / ${max > 0 ? fmt(max) : "∞"}`)),
      meter(max > 0 ? (used / max) * 100 : 0, [75, 90]));
    return h("div", row("Anfragen heute", b.requests_today, b.requests_budget, fmtNum), row("Tokens heute", b.tokens_today, b.tokens_budget, fmtCompact),
      h("div.faint", { style: { fontSize: "12px" } }, "Zurückgesetzt um Mitternacht (UTC). Budget änderst du im Launcher unter Admin › KI."));
  }), "w-4");
}

export function onlineCard() {
  let days = 1;
  const box = h("div");
  const seg = h("div.seg", [[1, "24 h"], [7, "7 T"], [30, "30 T"]].map(([d, t]) => h("button", { class: d === days ? "on" : "", onclick: (e) => { days = d; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); draw(); } }, t)));
  async function draw() {
    box.replaceChildren(h("div.skel", { style: { height: "180px" } }));
    try {
      const rows = await rpc("cc_metric_series", { p_metric: "jopml_online", p_days: days });
      box.replaceChildren(rows.length < 2 ? h("div.faint", { style: { padding: "30px 0", textAlign: "center" } }, "Verlauf entsteht gerade – alle 5 Minuten kommt ein Messpunkt dazu.")
        : lineChart([{ name: "Online", values: rows.map((r) => ({ x: new Date(r.t), y: r.v })) }], { height: 180, yFmt: (v) => fmtNum(v),
          xFmt: days > 1 ? (v) => new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) : undefined }));
    } catch (e) { box.replaceChildren(naNote(e.message, "alert")); }
  }
  draw();
  return card("Nutzer online (Verlauf)", box, "w-8", seg);
}

const TSTAT = { new: ["Neu", "b-warn"], in_progress: ["In Arbeit", "b-pri"], fixed: ["Behoben", "b-ok"] };
export function ticketsCard() {
  let filter = "open";
  const box = h("div");
  const seg = h("div.seg", [["open", "Offen"], ["all", "Alle"]].map(([k, t]) => h("button", { class: k === filter ? "on" : "", onclick: (e) => { filter = k; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); draw(); } }, t)));
  let list = null, stats = null;
  async function draw(force) {
    if (!list || force) { box.replaceChildren(h("div.skel", { style: { height: "120px" } })); [list, [stats]] = await Promise.all([rpc("jopml_admin_tickets"), rpc("jopml_admin_ticket_stats")]).catch((e) => { box.replaceChildren(naNote(e.message, "alert")); return [null, []]; }); if (!list) return; }
    const rows = list.filter((t) => filter === "all" || t.status !== "fixed");
    box.replaceChildren(
      stats ? h("div.row.wrap", { style: { gap: "6px", marginBottom: "10px" } }, h("span.tag", `${fmtNum(stats.open_count)} offen`), h("span.tag", `${fmtNum(stats.fixed_count)} behoben`),
        stats.median_hours !== null ? h("span.tag", `Median bis Fix ${String(stats.median_hours).replace(".", ",")} h`) : null,
        stats.oldest_open_hours !== null ? h("span.tag", `ältestes offen ${fmtNum(stats.oldest_open_hours)} h`) : null) : null,
      rows.length ? h("div.list", rows.slice(0, 40).map((t) => h("div.list-item",
        h("div.li-main", h("div.li-title", t.title || t.code || `Ticket #${t.id}`), h("div.li-sub", [t.code, `${fmtNum(t.reports)} Meldung(en)`, `aktualisiert ${fmtAgo(t.updated_at)}`, t.note].filter(Boolean).join(" · "))),
        h("select.input.sm", { "aria-label": "Status", style: { width: "auto", height: "30px" }, onchange: async (e) => {
          const st = e.target.value;
          try { await rpc("jopml_admin_ticket_set", { p_id: t.id, p_status: st, p_note: null }); t.status = st; toast(st === "fixed" ? "Ticket behoben – betroffene Nutzer werden informiert" : "Status geändert"); draw(); }
          catch (er) { toastErr(er); e.target.value = t.status; }
        } }, Object.entries(TSTAT).map(([k, [lbl]]) => h("option", { value: k, selected: k === t.status }, lbl))))))
        : empty("check", filter === "open" ? "Keine offenen Tickets" : "Keine Tickets", "Tickets entstehen automatisch aus Fehlermeldungen im Launcher."));
  }
  draw();
  return card("Tickets", box, "w-6", seg);
}

export function reportsCard() {
  return card("Nutzer-Meldungen", lazy(async () => {
    const list = await rpc("jopml_admin_user_reports", { p_limit: 30 });
    if (!list.length) return empty("mail", "Keine Meldungen", "Meldungen aus dem Launcher (Hilfe › Problem melden) erscheinen hier.");
    return h("div.list", list.map((r) => h("div.list-item", { style: { alignItems: "flex-start" } },
      h("span.dot", { style: { background: r.reply ? "var(--ok)" : "var(--warn)", marginTop: "7px" } }),
      h("div.li-main", h("div.li-title", `${r.category || "Meldung"}${r.code ? " · " + r.code : ""}`),
        h("div.li-sub", { style: { whiteSpace: "normal" } }, String(r.message || "").slice(0, 300)),
        h("div.li-sub", [r.version && `v${r.version}`, r.os, fmtAgo(r.created_at)].filter(Boolean).join(" · ")),
        r.reply ? h("div.li-sub", { style: { color: "var(--ok)", whiteSpace: "normal" } }, `Antwort: ${r.reply}`) : null),
      r.reply ? null : h("button.btn.sm", { onclick: () => formModal("Antwort an Nutzer", [
        { name: "t", label: "Antwort (erscheint im Launcher)", type: "textarea", rows: 4, required: true, max: 1000 }],
        async (v) => { if (v.t.length < 2) throw new Error("Bitte eine Antwort eingeben."); await rpc("jopml_admin_report_reply", { p_report: r.id, p_text: v.t }); toast("Antwort gesendet"); reload(); }) }, icon("send"), "Antworten"))));
  }), "w-6");
}

export function errorGroupsCard() {
  return card("Fehlergruppen", lazy(async () => {
    const list = await rpc("jopml_admin_error_groups", { p_limit: 15 });
    if (!list.length) return empty("check", "Keine Fehlergruppen", "Gleiche Fehler aus dem Launcher werden automatisch gruppiert.");
    return h("div.list", list.map((g) => {
      const row = h("div.list-item", { style: { alignItems: "flex-start", cursor: g.analysis || g.sample_trace ? "pointer" : "default" } },
        h("div.li-main", h("div.li-title.mono", g.code || g.kind || "Fehler"), h("div.li-sub", { style: { whiteSpace: "normal" } }, String(g.message || "").slice(0, 200)),
          h("div.li-sub", `${fmtNum(g.hits)}× · ${fmtNum(g.users_seen)} Nutzer · zuletzt ${fmtAgo(g.last_seen)}`)),
        g.analysis ? h("span.badge.b-acc", "KI-Analyse") : null);
      if (g.analysis || g.sample_trace) row.addEventListener("click", () => {
        const det = row.nextElementSibling?.classList.contains("eg-detail") ? row.nextElementSibling : null;
        if (det) return det.remove();
        row.after(h("div.eg-detail", g.analysis ? md(g.analysis) : null, g.sample_trace ? h("pre.mono.code-box", String(g.sample_trace).slice(0, 3000)) : null));
      });
      return row;
    }));
  }), "w-12");
}
