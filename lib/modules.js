// Modul-Registrierung: jeder Modultyp liefert einen Renderer. Neue Typen hier eintragen –
// sie erscheinen automatisch auf Projektseiten, im „Modul hinzufügen“-Dialog und in der Suche.
import { sb, q, api, rpc, downloadFile } from "./api.js";
import { h, icon, md, empty, naNote, fmtAgo, fmtBytes, fmtNum, fmtCompact, fmtDate, fmtDateTime, badge, EVENT_STATUS, SERVER_STATUS, meter, fmtPct, errMsg, toastErr, toast, skeleton } from "./ui.js";
import { donut, lineChart, barChart } from "./charts.js";

const lines = (s) => String(s || "").split("\n").map((x) => x.trim()).filter(Boolean);

export const MODULE_TYPES = {
  dashboard: { label: "Dashboard", icon: "dashboard", render: renderDashboard, parseConfig: () => ({ widgets: [{ type: "summary" }, { type: "files" }, { type: "activity" }] }) },
  files: { label: "Dateien", icon: "file", render: renderFiles },
  code: { label: "Code-Browser", icon: "code", render: renderCode },
  roblox: { label: "Roblox-Spiel", icon: "game", render: renderRoblox,
    parseConfig: (s) => { const t = String(s || "").trim(); const id = (t.match(/games\/(\d+)/) || [])[1] || (t.match(/\d+/) || [])[0];
      if (!id) throw new Error("Bitte Place-ID, Universe-ID oder Spiel-Link angeben."); return /universe/i.test(t) ? { universe_id: id } : { place_id: id }; } },
  server: { label: "Server", icon: "server", render: renderServer, parseConfig: (s) => ({ server_name: String(s || "").trim() }) },
  events: { label: "Events", icon: "calendar", render: renderEvents },
  ai: { label: "KI-Nutzung", icon: "sparkles", render: renderAI },
  links: { label: "Links", icon: "link", render: renderLinks, parseConfig: (s) => ({ items: lines(s).filter((u) => /^https?:\/\//i.test(u)).map((url) => ({ url, title: url.replace(/^https?:\/\//, "").replace(/\/$/, "") })) }) },
  notes: { label: "Notizen", icon: "note", render: renderNotes, parseConfig: (s) => ({ text: String(s || "") }) },
  metrics: { label: "Kennzahlen", icon: "chart", render: renderMetrics,
    parseConfig: (s) => ({ items: lines(s).map((l) => { const [label, ...v] = l.split(":"); return { label: label.trim(), value: v.join(":").trim() }; }).filter((x) => x.label && x.value) }) },
};

// ---------------- Dashboard-Modul mit Widgets ----------------
const WIDGETS = {
  summary: (cfg, ctx) => h("div.stack", { style: { gap: "10px" } },
    ctx.project.description ? md(ctx.project.description) : h("div.faint", "Noch keine Beschreibung."),
    ctx.project.tags?.length ? h("div.row.wrap", { style: { gap: "6px" } }, ctx.project.tags.map((t) => h("span.tag", t))) : null),
  markdown: (cfg) => md(cfg.content || ""),
  files: (cfg, ctx) => lazy(async () => {
    const f = await q(sb.from("cc_files").select("id,file_name,rel_path,file_size,uploaded_at,storage_path,version").eq("project_id", ctx.project.id).eq("is_current", true).order("uploaded_at", { ascending: false }).limit(cfg.limit || 5));
    if (!f.length) return h("div.faint", "Noch keine Dateien.");
    return h("div.list", f.map((x) => fileRow(x)));
  }),
  activity: (cfg, ctx) => lazy(async () => {
    const a = await q(sb.from("cc_activities").select("id,kind,description,status,created_at").eq("project_id", ctx.project.id).order("created_at", { ascending: false }).limit(cfg.limit || 6));
    return a.length ? timeline(a) : h("div.faint", "Noch keine Aktivitäten.");
  }),
  stats: (cfg) => h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "10px" } },
    (cfg.items || []).map((it) => h("div", { style: { padding: "12px 14px", background: "var(--surface-2)", borderRadius: "10px" } },
      h("div.faint", { style: { fontSize: "12px" } }, it.label), h("div", { style: { fontSize: "18px", fontWeight: 620 } }, String(it.value))))),
  languages: (cfg) => donut((cfg.items || []).slice(0, 6).map((x) => ({ name: x.name, value: x.bytes ?? x.value ?? 0 })), { fmt: fmtBytes, size: 120 }),
  links: (cfg) => linkList(cfg.items),
  checklist: (cfg) => h("div.list", (cfg.items || []).map((it) => h("div.list-item", icon(it.done ? "check" : "clock", ""), h("div.li-main", { style: { textDecoration: it.done ? "line-through" : "", color: it.done ? "var(--text-3)" : "" } }, it.text)))),
  jopml: () => lazy(async () => {
    const o = await rpc("cc_overview");
    const j = o.jopml;
    return h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" } },
      [["Registriert", fmtNum(j.users)], ["Jetzt online", fmtNum(j.online_now)], ["Aktiv 24 h", fmtNum(j.online_24h)], ["Fehler 24 h", fmtNum(j.errors_24h)], ["Offene Tickets", fmtNum(j.tickets_open)], ["Version", j.version || "–"]]
        .map(([k, v]) => h("div", { style: { padding: "12px 14px", background: "var(--surface-2)", borderRadius: "10px" } }, h("div.faint", { style: { fontSize: "12px" } }, k), h("div", { style: { fontSize: "18px", fontWeight: 620 } }, v))),
      h("a.btn.sm", { href: "#/jopml", style: { gridColumn: "1/-1", justifySelf: "start" } }, "JOPML öffnen", icon("chevronR")));
  }),
};
const WIDGET_TITLES = { summary: "Übersicht", files: "Neueste Dateien", activity: "Aktivität", stats: "Kennzahlen", languages: "Sprachen", links: "Links", checklist: "Aufgaben", markdown: "", jopml: "JOPML-System" };

function renderDashboard(mod, ctx) {
  const ws = Array.isArray(mod.config?.widgets) && mod.config.widgets.length ? mod.config.widgets : [{ type: "summary" }];
  return h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 320px), 1fr))" } },
    ws.map((w) => {
      const fn = WIDGETS[w.type];
      if (!fn) return null;
      const title = w.title ?? WIDGET_TITLES[w.type];
      return h("div", { style: { minWidth: 0 } }, title ? h("div.faint", { style: { fontSize: "12px", textTransform: "uppercase", letterSpacing: ".07em", marginBottom: "8px" } }, title) : null, fn(w, ctx));
    }));
}

// ---------------- Weitere Modultypen ----------------
function renderFiles(mod, ctx) {
  return lazy(async () => {
    const f = await q(sb.from("cc_files").select("id,file_name,rel_path,file_size,uploaded_at,storage_path,version").eq("project_id", ctx.project.id).eq("is_current", true)
      .order("rel_path").limit(200));
    return f.length ? h("div.list", f.map((x) => fileRow(x, true))) : empty("file", "Keine Dateien", "Lade Dateien über „Datei hochladen“ hoch oder synchronisiere das Projekt mit dem Claude-Skill.");
  });
}

function renderCode(mod, ctx) {
  return lazy(async () => {
    const f = await q(sb.from("cc_files").select("id,file_name,rel_path,file_size,storage_path,mime_type").eq("project_id", ctx.project.id).eq("is_current", true).eq("category", "code").order("rel_path").limit(1000));
    if (!f.length) return h("div.faint", "Keine Code-Dateien in diesem Projekt.");
    const view = h("pre.mono", { style: { margin: 0, padding: "14px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "10px", overflow: "auto", maxHeight: "520px", fontSize: "12.5px", lineHeight: 1.55, whiteSpace: "pre" } }, "Datei auswählen …");
    const sel = h("select.input", { onchange: async () => {
      const x = f.find((y) => y.id === sel.value); if (!x) return;
      if (x.file_size > 300_000) { view.textContent = "Datei zu groß für die Vorschau (max. 300 KB) – bitte herunterladen."; return; }
      view.textContent = "Lädt …";
      try {
        const { data, error } = await sb.storage.from("cc-files").download(x.storage_path);
        if (error) throw error;
        view.textContent = await data.text();
      } catch (e) { view.textContent = errMsg(e); }
    } }, h("option", { value: "" }, `${f.length} Dateien – auswählen`), f.map((x) => h("option", { value: x.id }, x.rel_path)));
    return h("div.stack", { style: { gap: "10px" } }, sel, view);
  });
}

function renderRoblox(mod) {
  const box = h("div", skeleton(140));
  const load = async () => {
    try {
      const r = await api("roblox", { module_id: mod.id });
      const g = r.game;
      const placeUrl = `https://www.roblox.com/games/${encodeURIComponent(g.root_place_id)}`;
      box.replaceChildren(h("div.stack", { style: { gap: "14px" } },
        h("div.row.between.wrap", h("div", h("div", { style: { fontSize: "16px", fontWeight: 620 } }, g.name), h("div.faint", { style: { fontSize: "12.5px" } }, `Zuletzt aktualisiert ${fmtAgo(g.updated)} · ${g.genre || "ohne Genre"}`)),
          h("a.btn.sm", { href: placeUrl, target: "_blank", rel: "noopener" }, icon("external"), "Auf Roblox")),
        h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" } },
          [["Spieler jetzt", fmtNum(g.playing)], ["Besuche", fmtCompact(g.visits)], ["Favoriten", fmtCompact(g.favorites)], ["Max. pro Server", fmtNum(g.max_players)]]
            .map(([k, v]) => h("div", { style: { padding: "12px 14px", background: "var(--surface-2)", borderRadius: "10px" } }, h("div.faint", { style: { fontSize: "12px" } }, k), h("div", { style: { fontSize: "18px", fontWeight: 620 } }, v)))),
        r.history.length > 1 ? lineChart([{ name: "Spieler", values: r.history.map((p) => ({ x: new Date(p.ts), y: p.playing })) }], { height: 160, xFmt: (v) => new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) })
          : h("div.faint", { style: { fontSize: "12.5px" } }, "Verlauf entsteht aus echten Abrufen (höchstens alle 5 Minuten ein Messpunkt, wenn diese Seite geöffnet wird)."),
        h("div.faint", { style: { fontSize: "12px" } }, "Quelle: offizielle öffentliche Roblox-API (games.roblox.com).")));
    } catch (e) { box.replaceChildren(naNote(`Roblox-Daten nicht verfügbar: ${errMsg(e)}`, "alert")); }
  };
  load();
  return box;
}

function renderServer(mod) {
  return lazy(async () => {
    let qy = sb.from("cc_servers").select("id,name,status,cpu_usage,memory_usage,disk_usage,last_heartbeat");
    qy = mod.config?.server_id ? qy.eq("id", mod.config.server_id) : qy.eq("name", mod.config?.server_name || "");
    const s = (await q(qy.limit(1)))[0];
    if (!s) return naNote(`Kein Server „${mod.config?.server_name || "?"}“ registriert. Unter „Server“ → „Server verbinden“ anlegen.`);
    return h("a", { href: `#/servers/${s.id}`, style: { display: "block" } },
      h("div.row.between", h("strong", s.name), badge(SERVER_STATUS, s.status)),
      h("div.stack", { style: { gap: "8px", marginTop: "12px" } }, [["CPU", s.cpu_usage], ["RAM", s.memory_usage], ["Speicher", s.disk_usage]].map(([k, v]) =>
        h("div", h("div.row.between", { style: { fontSize: "12.5px" } }, h("span.muted", k), h("span", fmtPct(v))), meter(v)))),
      h("div.faint", { style: { fontSize: "12px", marginTop: "10px" } }, `Letzter Heartbeat: ${fmtAgo(s.last_heartbeat)}`));
  });
}

function renderEvents(mod, ctx) {
  return lazy(async () => {
    const ev = await q(sb.from("cc_events").select("id,name,event_date,location,status").eq("project_id", ctx.project.id).order("event_date", { ascending: true, nullsFirst: false }).limit(20));
    if (!ev.length) return h("div.faint", "Keine Events mit diesem Projekt verknüpft.");
    return h("div.list", ev.map((e) => h("a.list-item", { href: `#/events/${e.id}` }, h("div.li-icon", icon("calendar")),
      h("div.li-main", h("div.li-title", e.name), h("div.li-sub", `${e.event_date ? fmtDateTime(e.event_date) : "ohne Datum"}${e.location ? " · " + e.location : ""}`)), badge(EVENT_STATUS, e.status))));
  });
}

function renderAI(mod, ctx) {
  return lazy(async () => {
    // Alle gemessenen Quellen: Control Center, gemeldete Apps und – beim JOPML-Projekt – die JOPML-KI-Statistik
    const rows = (await rpc("cc_ai_series", { p_days: 90 })).filter((r) => r.project_id === ctx.project.id)
      .map((r) => ({ ...r, total_tokens: Number(r.total_tokens) || 0, requests: Number(r.requests) || 0 }));
    if (!rows.length) return naNote("Noch keine gemessene KI-Nutzung für dieses Projekt. Sie erscheint automatisch, sobald du hier den KI-Assistenten oder die Datei-Analyse nutzt oder eine App Verbrauch an das Control Center meldet. Es wird nichts geschätzt.");
    const days = [...Array(30)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (29 - i)); return d.toLocaleDateString("sv-SE"); });
    const by = Object.fromEntries(days.map((d) => [d, 0]));
    rows.forEach((r) => { if (r.day in by) by[r.day] += r.total_tokens; });
    const total = rows.reduce((a, r) => a + r.total_tokens, 0), req = rows.reduce((a, r) => a + r.requests, 0);
    const models = Object.entries(rows.reduce((m, r) => (m[`${r.provider} · ${r.model}`] = (m[`${r.provider} · ${r.model}`] || 0) + r.total_tokens, m), {})).sort((a, b) => b[1] - a[1]);
    const last = rows.map((r) => r.day).sort().at(-1);
    const SRC = { jopml: "JOPML-Launcher", "control-center": "Control Center", api: "Eigene Apps", "anthropic-admin-api": "Claude (Admin-API)" };
    return h("div.stack", { style: { gap: "12px" } },
      h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: "10px" } },
        [["Tokens (90 Tage)", fmtNum(total)], ["Anfragen", fmtNum(req)], ["Zuletzt genutzt", last ? new Date(last).toLocaleDateString("de-DE") : "–"]]
          .map(([k, v]) => h("div", { style: { padding: "12px 14px", background: "var(--surface-2)", borderRadius: "10px" } }, h("div.faint", { style: { fontSize: "12px" } }, k), h("div", { style: { fontSize: "18px", fontWeight: 620 } }, v)))),
      barChart(days.map((d) => d.slice(8, 10) + "." + d.slice(5, 7)), [{ name: "Tokens", values: days.map((d) => by[d]) }], { height: 150, yFmt: fmtCompact, emptyText: "In den letzten 30 Tagen keine Nutzung – ältere Werte siehe oben." }),
      h("div.list", models.map(([m, t]) => h("div.list-item", h("div.li-main", h("div.li-title", m)), h("span.muted", `${fmtCompact(t)} Tokens`)))),
      h("div.faint", { style: { fontSize: "12px" } }, "Quellen: " + [...new Set(rows.map((r) => SRC[r.source] || r.source))].join(", ") + ". Nur gemessene Werte."));
  });
}

function renderLinks(mod) { return (mod.config?.items || []).length ? linkList(mod.config.items) : h("div.faint", "Keine Links hinterlegt."); }
function renderMetrics(mod) { return WIDGETS.stats(mod.config || {}); }

function renderNotes(mod) {
  const ta = h("textarea.input", { rows: 6, maxlength: 20000 }, mod.config?.text || "");
  const st = h("span.faint", { style: { fontSize: "12px" } });
  let t;
  ta.addEventListener("input", () => {
    st.textContent = "Ungespeichert …"; clearTimeout(t);
    t = setTimeout(async () => {
      const { error } = await sb.from("cc_modules").update({ config: { ...mod.config, text: ta.value } }).eq("id", mod.id);
      st.textContent = error ? "Speichern fehlgeschlagen" : "Gespeichert";
    }, 700);
  });
  return h("div.stack", { style: { gap: "6px" } }, ta, st);
}

// ---------------- Hilfen ----------------
export function lazy(fn) {
  const box = h("div", skeleton(80));
  fn().then((n) => box.replaceChildren(n)).catch((e) => box.replaceChildren(naNote(errMsg(e), "alert")));
  return box;
}
function linkList(items = []) {
  return h("div.list", items.map((it) => {
    const safe = /^https?:\/\//i.test(it.url) ? it.url : null;
    return h(safe ? "a.list-item" : "div.list-item", safe ? { href: safe, target: "_blank", rel: "noopener noreferrer" } : null,
      h("div.li-icon", icon("link")), h("div.li-main", h("div.li-title", it.title || it.url), h("div.li-sub", it.url)), safe ? icon("external", "faint") : null);
  }));
}
export function fileRow(x, showPath = false) {
  return h("div.list-item", h("div.li-icon", icon("file")),
    h("div.li-main", h("div.li-title", showPath ? x.rel_path : x.file_name), h("div.li-sub", `${fmtBytes(x.file_size)} · v${x.version} · ${fmtAgo(x.uploaded_at)}`)),
    h("button.icon-btn", { "aria-label": "Herunterladen", onclick: () => downloadFile(x).catch(toastErr) }, icon("download")));
}
const KIND_ICON = { project_created: "folder", project_updated: "refresh", project_status: "activity", module_created: "layers", file_upload: "upload", sync: "refresh",
  server_added: "server", server_online: "wifi", server_offline: "alert", event_created: "calendar", event_updated: "calendar", api_key_created: "key", ai: "sparkles" };
export function timeline(items, { showProject = false } = {}) {
  return h("div.timeline", items.map((a) => h("div.tl-item",
    h("div.tl-dot", { class: a.status }, icon(KIND_ICON[a.kind] || "activity")),
    h("div.tl-text", h("div.t", a.description), showProject && a.project ? h("div.s", a.project) : null),
    h("div.tl-time", { title: fmtDateTime(a.created_at) }, fmtAgo(a.created_at)))));
}
