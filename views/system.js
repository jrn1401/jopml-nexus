// Systemprüfung: testet alle Bausteine live (Anmeldung, Datenbank, Rechte, API, KI, Messung, Speicher, App) und bietet ein Backup.
import { sb, rpc, api } from "../lib/api.js";
import { h, icon, fmtAgo, fmtDateTime, fmtBytes, toast, toastErr, naNote } from "../lib/ui.js";
import { download } from "../lib/actions.js";
import { CONFIG } from "../config.js";

const TESTS = [
  ["Anmeldung & Admin-Rechte", async () => { const w = await rpc("cc_whoami"); if (!w?.admin) throw new Error("kein Admin"); return w.email; }],
  ["Datenbank (Lesen)", async () => { const t = performance.now(); const { error } = await sb.from("cc_projects").select("id", { head: true, count: "exact" }); if (error) throw error; return `${Math.round(performance.now() - t)} ms`; }],
  ["Übersicht (cc_overview)", async () => { const o = await rpc("cc_overview"); return `${o.projects_total} Projekte · ${o.servers_total} Server`; }],
  ["Suche", async () => { const r = await rpc("cc_search", { q: "jopml" }); return `${r.length} Treffer für „jopml“`; }],
  ["Cloud-Messung (pg_cron)", async () => {
    const { data, error } = await sb.from("cc_servers").select("last_heartbeat,status").eq("kind", "cloud").maybeSingle();
    if (error) throw error; if (!data) throw new Error("Cloud-Server fehlt");
    const age = Date.now() - new Date(data.last_heartbeat);
    if (age > 15 * 60_000) throw new Error(`letzte Messung ${fmtAgo(data.last_heartbeat)}`);
    return `letzte Messung ${fmtAgo(data.last_heartbeat)}`;
  }],
  ["Edge-API (cc-api)", async () => { const r = await api("ping"); return `ok · DB ${r.db_ms} ms · Gemini ${r.providers.gemini ? "✓" : "✗"} · Groq ${r.providers.groq ? "✓" : "✗"}`; }],
  ["KI antwortet", async () => { const r = await api("ping", { ai: true }); if (!r.ai?.ok) throw new Error(r.ai?.error || "keine Antwort"); return `${r.ai.provider} · ${r.ai.model} · ${r.ai.ms} ms`; }],
  ["JOPML-Admin-Funktionen", async () => { const c = await rpc("jopml_app_config_get"); return `Konfiguration gelesen (${Object.keys(c).length} Schlüssel)`; }],
  ["Dateispeicher", async () => { const { error } = await sb.storage.from("cc-files").list("blobs", { limit: 1 }); if (error) throw error; return "privater Bucket erreichbar"; }],
  ["Offline-Modus (Service Worker)", async () => {
    if (!("serviceWorker" in navigator)) throw new Error("vom Browser nicht unterstützt");
    const reg = await navigator.serviceWorker.getRegistration(); if (!reg) throw new Error("nicht registriert (nur über https)");
    return reg.active ? "aktiv" : "wird installiert";
  }],
];

export default async function systemView() {
  const list = h("div.list");
  const sum = h("div.health-head.idle", h("span.dot.lg"), h("strong", "Noch nicht geprüft"));
  const runBtn = h("button.btn.primary", { onclick: run }, icon("zap"), "Alles prüfen");
  async function run() {
    runBtn.disabled = true;
    const rows = TESTS.map(([name]) => {
      const st = h("span.badge.b-idle", "läuft …"), sub = h("div.li-sub", "");
      return { name, el: h("div.list-item", h("div.li-main", h("div.li-title", name), sub), st), st, sub };
    });
    list.replaceChildren(...rows.map((r) => r.el));
    let bad = 0;
    await Promise.all(TESTS.map(async ([, fn], i) => {
      const r = rows[i];
      try { r.sub.textContent = String(await fn()); r.st.className = "badge b-ok"; r.st.textContent = "OK"; }
      catch (e) { bad++; r.sub.textContent = e?.message || String(e); r.st.className = "badge b-bad"; r.st.textContent = "Fehler"; }
    }));
    sum.className = `health-head ${bad ? "bad" : "ok"}`;
    sum.lastChild.textContent = bad ? `${bad} von ${TESTS.length} Prüfungen fehlgeschlagen` : `Alle ${TESTS.length} Prüfungen bestanden · ${fmtDateTime(new Date())}`;
    runBtn.disabled = false;
  }
  const backupBtn = h("button.btn", { onclick: async () => {
    backupBtn.disabled = true;
    try { const d = await rpc("cc_export"); download(`jopml-nexus-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(d, null, 2), "application/json"); toast("Backup heruntergeladen"); }
    catch (e) { toastErr(e); } finally { backupBtn.disabled = false; }
  } }, icon("download"), "Backup (JSON)");
  const storage = navigator.storage?.estimate ? await navigator.storage.estimate().catch(() => null) : null;
  setTimeout(run, 50);
  return h("div",
    h("div.page-head", h("div", h("h1", "Systemprüfung"), h("p", "Testet live alle Bausteine der Website und der Server-Anbindung.")),
      h("div.actions", backupBtn, runBtn)),
    h("div.grid.g-2",
      h("section.card", h("div.card-head", h("h3", "Ergebnis")), h("div.card-body", h("div.stack", sum, list))),
      h("div.stack",
        h("section.card", h("div.card-head", h("h3", "App")), h("div.card-body", h("dl.kv",
          h("dt", "Version"), h("dd", CONFIG.version || "–"), h("dt", "Adresse"), h("dd.mono", location.origin + location.pathname),
          h("dt", "Verbindung"), h("dd", navigator.onLine ? "online" : "offline"),
          h("dt", "Installiert"), h("dd", matchMedia("(display-mode: standalone)").matches ? "ja (App)" : "nein – im Browser"),
          h("dt", "Lokaler Speicher"), h("dd", storage ? `${fmtBytes(storage.usage)} genutzt` : "–")))),
        h("section.card", h("div.card-head", h("h3", "Tastenkürzel")), h("div.card-body", h("dl.kv",
          ...[["Strg/⌘ K", "Suche"], ["/", "Suche"], ["g d", "Dashboard"], ["g p", "Projekte"], ["g s", "Server"], ["g e", "Events"], ["g j", "JOPML"], ["g k", "KI & Tokens"], ["a", "KI-Assistent"], ["n", "Schnellaktionen"], ["?", "Diese Seite"]]
            .flatMap(([k, t]) => [h("dt", h("span.kbd", k)), h("dd", t)])))),
        naNote("Backup enthält Projekte, Module, Datei-Einträge, Server, Events, Einstellungen und Aktivitäten – keine Schlüssel. Dateien selbst bleiben im privaten Speicher."))));
}
