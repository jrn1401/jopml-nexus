// JOPML-Modul: nutzt die vorhandenen, admin-geschützten JOPML-Funktionen (jopml_admin_*) – keine Doppelimplementierung.
import { sb, q, rpc } from "../lib/api.js";
import { h, icon, stat, fmtNum, fmtBytes, fmtAgo, fmtCompact, naNote, empty, toast, toastErr, badge, PROJECT_STATUS } from "../lib/ui.js";
import { barChart, donut, PALETTE } from "../lib/charts.js";
import { timeline, fileRow, lazy } from "../lib/modules.js";
import { uploadDialog, openAssistant } from "../lib/actions.js";
import { releaseChecklist } from "../lib/nextup.js";
import { maintenanceBanner, controlCard, aiCheckCard, budgetCard, onlineCard, ticketsCard, reportsCard, errorGroupsCard } from "./jopml-admin.js";

export default async function jopmlView() {
  const project = await q(sb.from("cc_projects").select("*").eq("slug", "jopml").maybeSingle());
  const safe = (p) => p.then((d) => d, (e) => ({ __err: e.message }));
  const [ov, prog, ai, prov, linked, cfg] = await Promise.all([
    safe(rpc("jopml_admin_overview")), safe(rpc("jopml_admin_program_overview")), safe(rpc("jopml_admin_ai_stats", { p_days: 14 })),
    safe(rpc("jopml_admin_ai_provider_overview")), q(sb.from("cc_projects").select("id,name,status,category").or("category.eq.jopml,tags.cs.{jopml}")),
    safe(rpc("jopml_app_config_get")),
  ]);
  const ok = !ov.__err;
  const days = [...Array(14)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (13 - i)); return d.toLocaleDateString("sv-SE"); });
  const providers = ai.__err ? [] : [...new Set(ai.map((r) => r.provider))];
  const card = (t, el, cls = "w-6", extra) => h("section.card", { class: cls }, h("div.card-head", h("h3", t), extra || null), h("div.card-body", el));

  const syncBtn = h("button.btn", { onclick: async () => {
    syncBtn.disabled = true;
    try {
      if (project) await sb.from("cc_integrations").upsert({ project_id: project.id, kind: "supabase", status: "connected", last_sync: new Date().toISOString(), last_error: null }, { onConflict: "project_id,kind" });
      await sb.from("cc_activities").insert({ project_id: project?.id ?? null, kind: "sync", description: "JOPML-Daten synchronisiert" });
      toast("JOPML synchronisiert"); dispatchEvent(new Event("hashchange"));
    } catch (e) { toastErr(e); } finally { syncBtn.disabled = false; }
  } }, icon("refresh"), "Synchronisieren");

  return h("div",
    h("div.page-head", h("div", h("h1", "JOPML"), h("p", "Jaron's OP Makro – Launcher, Community und KI-Hilfe · Supabase-Projekt „jopml“")),
      h("div.actions", project ? h("a.btn.ghost", { href: `#/projects/${project.id}` }, icon("folder"), "Projektseite") : null,
        h("button.btn", { onclick: () => openAssistant(project?.id ?? null) }, icon("bot"), "Fragen"), syncBtn)),
    h("div", { style: { marginBottom: "16px" } }, releaseChecklist()),
    !ok ? naNote(`JOPML-Admin-Daten nicht verfügbar: ${ov.__err}`, "alert") : h("div.stack",
      h("div.grid.g-4",
        stat("Registrierte Nutzer", fmtNum(ov.registered), { ic: "users", sub: `+${fmtNum(ov.new_7d)} in 7 Tagen` }),
        stat("Online", fmtNum(ov.online_now), { ic: "wifi", sub: `${fmtNum(ov.online_24h)} in den letzten 24 h` }),
        stat("Fehler 24 h", fmtNum(ov.errors_24h), { ic: "alert", sub: `${fmtNum(ov.errors_total)} insgesamt` }),
        stat("KI heute", fmtNum(prog.ai_today?.answered), { ic: "sparkles", sub: `${fmtCompact(prog.ai_today?.tokens)} Tokens · ${fmtNum(prog.ai_today?.fallbacks)} Ausweich-Aufrufe` })),
      cfg.__err ? null : maintenanceBanner(cfg),
      h("div.grid.dash",
        cfg.__err ? card("Server-Steuerung", naNote(cfg.__err, "alert"), "w-4") : controlCard(cfg),
        aiCheckCard(), budgetCard(),
        onlineCard(),
        card("Status jetzt", h("dl.kv",
          h("dt", "Wartung"), h("dd", cfg.maintenance ? h("span.badge.b-warn", "aktiv") : h("span.badge.b-ok", "aus")),
          h("dt", "KI-Chat"), h("dd", cfg.ai_enabled === false ? h("span.badge.b-bad", "aus") : h("span.badge.b-ok", "an")),
          h("dt", "Letzte Aktivität"), h("dd", ov.last_seen ? fmtAgo(ov.last_seen) : "–"),
          h("dt", "Neue Nutzer 7 T"), h("dd", fmtNum(ov.new_7d))), "w-4"),
        ticketsCard(), reportsCard(), errorGroupsCard(),
        card("KI-Funktionen · 14 Tage", ai.__err ? naNote(ai.__err) : barChart(days.map((d) => `${d.slice(8)}.${d.slice(5, 7)}`),
          providers.map((p, i) => ({ name: p, color: PALETTE[i], values: days.map((d) => ai.filter((r) => r.day === d && r.provider === p).reduce((a, r) => a + Number(r.tokens), 0)) })),
          { height: 200, yFmt: fmtCompact, emptyText: "Keine KI-Nutzung in JOPML." }), "w-8"),
        card("Anbieter & Budgets", prov.__err ? naNote(prov.__err) : h("div.list", prov.map((p) => h("div.list-item",
          h("div.li-main", h("div.li-title", p.provider + (p.effective === p.provider ? " · aktiv" : "")), h("div.li-sub", `${fmtNum(p.hits)} Anfragen · ${fmtCompact(p.tokens)} Tokens heute`)),
          h("span.faint.nowrap", { style: { fontSize: "12px" } }, p.tokens_budget ? `Budget ${fmtCompact(p.tokens_budget)}` : "ohne Budget"))).concat(
          prov[0] ? [h("div.faint", { style: { fontSize: "12px", paddingTop: "8px" } }, `Standard: ${prov[0].default_provider} · Auto-Wechsel ${prov[0].auto_switch ? `ab ${prov[0].switch_pct} %` : "aus"}`)] : [])), "w-4"),
        card("Datenbankstatus", h("dl.kv",
          h("dt", "Größe"), h("dd", fmtBytes(ov.db_bytes)), h("dt", "Verbindungen"), h("dd", `${ov.connections} / ${ov.max_connections}`),
          h("dt", "Cache-Trefferquote"), h("dd", ov.cache_hit !== null ? `${String(ov.cache_hit).replace(".", ",")} %` : "–"),
          h("dt", "PostgreSQL"), h("dd", ov.pg_version), h("dt", "Läuft seit"), h("dd", fmtAgo(ov.started_at)),
          h("dt", "Chat-Nachrichten"), h("dd", fmtNum(ov.messages)), h("dt", "Makros"), h("dd", fmtNum(ov.macros))), "w-4"),
        card("Versionen (aktive Clients, 7 Tage)", ov.versions?.length ? donut(ov.versions.map((v) => ({ name: v.v, value: v.n })), { fmt: fmtNum, size: 120 }) : h("div.faint", "Keine Daten"), "w-4"),
        card("Systeme & Seiten", h("div.stack", { style: { gap: "12px" } },
          prog.systems?.length ? h("div.row.wrap", { style: { gap: "6px" } }, prog.systems.map((s) => h("span.tag", `${s.os}: ${s.n}`))) : h("div.faint", "Keine Systemdaten"),
          prog.pages?.length ? h("div.list", prog.pages.slice(0, 5).map((p) => h("div.list-item", h("div.li-main.mono", p.page), h("span.muted", fmtNum(p.n))))) : null), "w-4"),
        card("Fehlercodes (3 Tage)", prog.error_codes?.length ? h("div.list", prog.error_codes.map((e) => h("div.list-item",
          h("div.li-main", h("div.li-title.mono", e.code || "ohne Code"), h("div.li-sub", e.msg)), h("span.nowrap.faint", { style: { fontSize: "12px" } }, `${fmtNum(e.hits)}× · ${fmtAgo(e.last)}`))))
          : empty("check", "Keine Fehler", "In den letzten 3 Tagen wurden keine Fehler gemeldet."), "w-6",
          h("span.sub", `${fmtNum(prog.tickets_open)} offene Tickets · ${fmtNum(prog.reports_open)} offene Meldungen`)),
        card("Admin-Protokoll", prog.audit?.length ? h("div.timeline", prog.audit.map((a) => h("div.tl-item", h("div.tl-dot.info", icon("key")),
          h("div.tl-text", h("div.t", a.action), a.detail ? h("div.s", a.detail) : null), h("div.tl-time", fmtAgo(a.at))))) : h("div.faint", "Keine Einträge."), "w-6"),
        card("Dateien", project ? lazy(async () => {
          const f = await q(sb.from("cc_files").select("id,file_name,rel_path,file_size,uploaded_at,storage_path,version").eq("project_id", project.id).eq("is_current", true).order("uploaded_at", { ascending: false }).limit(12));
          return h("div.stack", { style: { gap: "10px" } },
            f.length ? h("div.list", f.map((x) => fileRow(x, true))) : h("div.faint", "Noch keine Dateien."),
            h("div.faint", { style: { fontSize: "12px" } }, "Ablage im privaten Speicher des JOPML-Projekts. KI-Analyse je Datei auf der Projektseite (Tab „Dateien“)."));
        }) : naNote("JOPML-Projekt fehlt."), "w-6",
          project ? h("button.btn.sm", { onclick: () => uploadDialog({ projectId: project.id, onDone: () => dispatchEvent(new Event("hashchange")) }) }, icon("upload"), "Hochladen") : null),
        card("Verknüpfte Projekte", linked.length ? h("div.list", linked.map((p) => h("a.list-item", { href: `#/projects/${p.id}` }, h("div.li-icon", icon("folder")),
          h("div.li-main", h("div.li-title", p.name)), badge(PROJECT_STATUS, p.status)))) : h("div.faint", "Projekte mit Kategorie „JOPML“ oder Tag „jopml“ erscheinen hier."), "w-6"),
        card("Aktivitäten", project ? lazy(async () => {
          const a = await q(sb.from("cc_activities").select("*").eq("project_id", project.id).order("created_at", { ascending: false }).limit(10));
          return a.length ? timeline(a) : h("div.faint", "Keine Einträge.");
        }) : null, "w-12"))));
}
