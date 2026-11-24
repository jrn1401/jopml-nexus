import { projectCopilot } from "../lib/aiassist.js";
import { sb, q, rpc, invalidateProjects, downloadFile, removeFile, api } from "../lib/api.js";
import { h, icon, badge, catIcon, empty, naNote, md, fmtAgo, fmtDate, fmtDateTime, fmtBytes, fmtNum, CATEGORIES, PROJECT_STATUS, SERVER_STATUS,
  formModal, confirmDialog, toast, toastErr, modal, errMsg, meter, fmtPct } from "../lib/ui.js";
import { MODULE_TYPES, timeline, lazy, masonryGrid, moduleSpan } from "../lib/modules.js";
import { newModule, uploadDialog, syncHelp, openAssistant } from "../lib/actions.js";
import { openShareDialog } from "../lib/share.js";
import { webCockpit, siteFor } from "../lib/web.js";
import { viewToggle } from "../lib/viewmode.js";

// Ein Projekt fasst alles zusammen: verknüpfte Events (Tickets, Abendkasse), Website, Launcher-Steuerung
function linkedEvents(projectId) {
  const box = h("div");
  sb.from("cc_events").select("id,name,event_date,status,location,metadata").eq("project_id", projectId).neq("status", "cancelled").order("event_date").then(({ data }) => {
    if (!data?.length) return;
    box.replaceChildren(...data.map((e) => {
      const t = e.metadata?.tickets || {}, cap = Number(t.capacity) || null, sold = Number(t.sold) || 0;
      const days = e.event_date ? Math.ceil((new Date(e.event_date) - Date.now()) / 864e5) : null;
      return h("section.card.card-pad.linked-event",
        h("div.row.between.wrap", { style: { gap: "10px" } },
          h("div.row", { style: { gap: "12px", minWidth: 0 } }, h("div.li-icon", icon("calendar")),
            h("div", { style: { minWidth: 0 } }, h("div.li-title", e.name),
              h("div.li-sub", [e.event_date ? fmtDateTime(e.event_date) : "ohne Datum", days !== null && days >= 0 ? `noch ${days} Tage` : null, e.location].filter(Boolean).join(" · ")))),
          h("div.row.wrap", { style: { gap: "6px" } }, h("a.btn.sm", { href: `#/events/${e.id}` }, icon("calendar"), "Event"), h("a.btn.sm", { href: `#/door/${e.id}` }, icon("ticket"), "Abendkasse"))),
        cap ? h("div", { style: { marginTop: "12px" } }, h("div.row.between", { style: { fontSize: "13px", marginBottom: "4px" } },
          h("span", h("strong", `${fmtNum(sold)} / ${fmtNum(cap)} Tickets`), t.revenue ? ` · ${Number(t.revenue).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}` : ""),
          h("span.faint", e.metadata?.eventfrog_id ? "Eventfrog live" : "")), meter((sold / cap) * 100, [101, 101])) : null);
    }));
  });
  return box;
}

export default async function projectView({ args: [id], query }) {
  const project = await q(sb.from("cc_projects").select("*").eq("id", id).maybeSingle());
  if (!project) return empty("folder", "Projekt nicht gefunden", "Es wurde vielleicht gelöscht.", h("a.btn", { href: "#/projects" }, "Zu den Projekten"));
  const modules = await q(sb.from("cc_modules").select("*").eq("project_id", id).order("position").order("created_at"));
  const ctx = { project };

  const tabs = [["overview", "Übersicht"], ...(project.category === "jopml" ? [["launcher", "Launcher-Steuerung"]] : []), ["files", "Dateien"], ["activity", "Aktivität"], ["ai", "KI-Nutzung"], ["servers", "Server"], ["settings", "Einstellungen"]];
  let tab = query.get("tab") || "overview";
  const body = h("div");
  const tabBar = h("div.tabs", { role: "tablist" }, tabs.map(([k, t]) => h("button", { role: "tab", class: tab === k ? "on" : "", "aria-selected": tab === k, onclick: () => show(k) }, t)));
  function show(k) {
    tab = k;
    tabBar.querySelectorAll("button").forEach((b, i) => { b.classList.toggle("on", tabs[i][0] === k); b.setAttribute("aria-selected", tabs[i][0] === k); });
    history.replaceState(null, "", `#/projects/${id}${k === "overview" ? "" : "?tab=" + k}`);
    body.replaceChildren(({ overview, launcher: launcherTab, files: filesTab, activity: activityTab, ai: aiTab, servers: serversTab, settings: settingsTab })[k]());
  }
  // JOPML: die Launcher-Steuerung (Nutzer, Fehler, Tickets, Releases) gehört direkt zum Projekt
  function launcherTab() {
    return lazy(async () => { const v = (await import("./jopml.js")).default; const el = await v({ args: [], query: new URLSearchParams(), embedded: true }); el.querySelector?.(".page-head")?.remove(); return el; });
  }

  // --- Übersicht: alle Module des Projekts
  // Websites (z. B. Netlify): Live-Cockpit direkt auf der Projektseite statt nur einem Link
  const isWeb = /^https?:\/\//.test(project.metadata?.url ?? "") && (project.category === "website" || project.metadata?.provider === "netlify");
  let webEl = null;
  const webSlot = () => {
    if (!isWeb) return null;
    if (!webEl) {
      webEl = h("div", h("div.skel", { style: { height: "140px" } }));
      siteFor("cc", project.id).then((site) => webCockpit(site, { onShare: () => openShareDialog("site", site.id, site.name) }))
        .then((el) => webEl.replaceChildren(el)).catch((e) => webEl.replaceChildren(naNote(`Website-Daten: ${errMsg(e)}`, "alert")));
    }
    return webEl;
  };
  function overview() {
    const enabled = modules.filter((m) => m.enabled && !(isWeb && ["metrics", "links"].includes(m.module_type) && ["Website", "Links"].includes(m.name)));
    let cop = null;
    try { cop = projectCopilot({ name: project.name, projectId: id, facts: `Projekt: ${project.name} [${project.category}, ${project.status}] Tags: ${(project.tags || []).join(", ")}\nBeschreibung: ${String(project.description || "").slice(0, 2500)}\nModule: ${modules.map((m) => `${m.name} (${m.module_type})`).join(", ")}`,
      addTasks: async (list) => { await q(sb.from("cc_tasks").insert(list.map((x) => ({ title: x.title.slice(0, 200), note: x.note || "", due: x.due, project_id: id })))); },
      exportData: async () => { const [tk, mods] = await Promise.all([q(sb.from("cc_tasks").select("title,due,done,note").eq("project_id", id).limit(500)).catch(() => []), import("../lib/syncproject.js")]);
        return { rows: tk.map((t) => ({ kind: "task", title: t.title, done: t.done, at: t.due, note: t.note })), html: `<h2>Module</h2>${modules.map((m) => `<h3>${String(m.name).replace(/</g, "&lt;")}</h3><pre style="white-space:pre-wrap;font-family:inherit">${mods.widgetText({ type: "markdown", content: "" }) || ""}${(Array.isArray(m.config?.widgets) ? m.config.widgets.map(mods.widgetText).join("\n\n") : JSON.stringify(m.config || {}, null, 1)).replace(/</g, "&lt;")}</pre>`).join("")}` }; } }); } catch { cop = null; }
    return h("div.stack", enabled.length ? h("div.row", { style: { justifyContent: "flex-end" } }, viewToggle()) : null, cop, linkedEvents(id),
      project.category === "jopml" ? h("a.card.card-pad.row.clickable", { href: `#/projects/${id}?tab=launcher`, style: { gap: "12px", textDecoration: "none", color: "inherit" } },
        h("div.li-icon", icon("layers")), h("div", { style: { flex: 1, minWidth: 0 } }, h("div.li-title", "Launcher-Steuerung"), h("div.li-sub", "Nutzer, Fehlercodes, Support-Tickets, KI-Verbrauch und Release-Checkliste")), icon("chevronR", "faint")) : null,
      webSlot(),
      enabled.length >= 4 ? moduleJump(enabled) : null,
      enabled.length ? moduleBoard(enabled) : isWeb ? null : empty("layers", "Noch keine Module", "Module sind die Bausteine dieser Projektseite – z. B. Dateien, Roblox-Spiel, Server oder Notizen.",
        h("button.btn.primary", { onclick: () => newModule(id) }, icon("plus"), "Modul hinzufügen")),
      modules.length > enabled.length ? h("div.faint", { style: { fontSize: "12.5px" } }, `${modules.length - enabled.length} ausgeblendete(s) Modul(e) – unter „Einstellungen“ einblendbar.`) : null);
  }
  // Module als Masonry: kleine Module nebeneinander, was darunter liegt rutscht hoch
  function moduleBoard(list) {
    const spans = list.map(moduleSpan);
    // das Raster füllt Lücken neben kurzen Modulen mit späteren halben Modulen auf („grid-auto-flow: dense“);
    // bei ungerader Anzahl hätte das letzte halbe keinen Partner → ganze Breite
    if (spans.filter((x) => x === 6).length % 2) spans[spans.lastIndexOf(6)] = 12;
    return masonryGrid("mod-board", list.map((m, i) => h("div.mb", { class: `mb-${spans[i]}` }, moduleCard(m))));
  }
  // Sprungleiste: bei vielen Modulen direkt hinspringen, alle ein-/ausklappen
  function moduleJump(list) {
    const setAll = (closed) => { list.forEach((m) => { try { localStorage.setItem(`cc:modc:${m.id}`, closed ? "1" : "0"); } catch { /* privat */ } document.getElementById(`mod-${m.id}`)?.classList.toggle("mod-closed", closed); }); };
    return h("nav.mod-jump", { "aria-label": "Module" },
      h("span.mod-jump-l", `${list.length} Module`),
      h("div.mod-jump-chips", list.map((m) => h("button.chip", { type: "button", onclick: () => { const el = document.getElementById(`mod-${m.id}`); if (!el) return; el.classList.remove("mod-closed"); try { localStorage.setItem(`cc:modc:${m.id}`, "0"); } catch { /* */ } el.scrollIntoView({ behavior: "smooth", block: "start" }); } }, m.name))),
      h("div.mod-jump-act", h("button.btn.sm.ghost", { type: "button", onclick: () => setAll(true) }, "Alle zu"), h("button.btn.sm.ghost", { type: "button", onclick: () => setAll(false) }, "Alle auf")));
  }
  function moduleCard(m) {
    const T = MODULE_TYPES[m.module_type] || { label: m.module_type, icon: "box", render: () => naNote("Unbekannter Modultyp.") };
    let closed = false; try { closed = localStorage.getItem(`cc:modc:${m.id}`) === "1"; } catch { /* */ }
    const toggle = (e) => { const card = e.currentTarget.closest(".mod-card"); const c = card.classList.toggle("mod-closed"); try { localStorage.setItem(`cc:modc:${m.id}`, c ? "1" : "0"); } catch { /* */ } };
    return h("section.card.mod-card", { id: `mod-${m.id}`, class: closed ? "mod-closed" : "" },
      h("div.card-head", h("button.row.mod-toggle", { type: "button", title: "Ein-/ausklappen", "aria-label": `${m.name} ein- oder ausklappen`, onclick: toggle },
        h("span.mod-chev", icon("chevronR")), h("div.li-icon", { style: { width: "30px", height: "30px" } }, icon(T.icon)), h("h3", m.name), h("span.tag", T.label)),
        h("div.row", { style: { gap: "2px" } },
          h("button.icon-btn", { title: "Mit KI ändern", "aria-label": `${m.name} mit KI ändern`, onclick: () => aiEditModule(m) }, icon("sparkles")),
          h("button.icon-btn", { title: "Als Website teilen", "aria-label": `${m.name} als Website teilen`, onclick: async () => { const x = await import("../lib/modshare.js"); x.shareWidgetsDialog({ key: `mod:${m.id}`, title: m.name, subtitle: project.name, widgets: x.moduleWidgets(m) }); } }, icon("globe")),
          h("button.icon-btn", { title: "Konfiguration bearbeiten", "aria-label": "Bearbeiten", onclick: () => editModule(m) }, icon("edit")),
          h("button.icon-btn", { title: "Entfernen", "aria-label": "Entfernen", onclick: () => deleteModule(m) }, icon("trash")))),
      h("div.card-body", T.render(m, ctx)));
  }
  function aiEditModule(m) {
    const ta = h("textarea.input", { rows: 3, maxlength: 1500, "aria-label": "Was soll sich ändern?", placeholder: "z. B. „Füge Aufgabe Security buchen hinzu“, „Setze Getränke einkaufen auf erledigt“, „Neue Zeile in der Tabelle: Garderobe 2 €“, „Mach eine Checkliste für den Aufbau“" });
    const out = h("div");
    const m2 = modal(`Mit KI ändern: ${m.name}`, h("div.stack", h("p.muted", { style: { margin: 0 } }, "Sag einfach, was rein oder raus soll – die KI ändert das Modul. Geteilte Links zeigen danach automatisch den neuen Stand."), ta, out,
      h("div.row", { style: { justifyContent: "flex-end" } }, h("button.btn.primary", { onclick: async (e) => {
        if (ta.value.trim().length < 3) return;
        const b = e.currentTarget; b.disabled = true; out.replaceChildren(h("div.faint", h("span.spinner"), " KI ändert …"));
        try {
          const { aiGen } = await import("../lib/aigen.js");
          const r = await aiGen({ task: "modul-aendern", json: true, maxTokens: 5000, instructions: 'Ändere die Modul-Konfiguration genau nach dem Wunsch. Behalte alles andere unverändert (gleiche Struktur, gleiche Kachel-Typen: markdown, checklist, timeline, table, stats, links, chart). Nichts erfinden. Antworte NUR mit JSON: {"config":{…komplette neue Konfiguration…},"summary":"was geändert wurde (1 Satz)"}',
            input: `MODUL: ${m.name} (${m.module_type})\nKONFIGURATION: ${JSON.stringify(m.config).slice(0, 16000)}\n\nWUNSCH: ${ta.value.trim()}` });
          const cfg = r.json?.config;
          if (!cfg || typeof cfg !== "object") throw new Error("Die KI hat keine gültige Konfiguration geliefert – bitte genauer formulieren.");
          await q(sb.from("cc_modules").update({ config: cfg, version: m.version + 1 }).eq("id", m.id));
          const x = await import("../lib/modshare.js"); x.refreshShare(`mod:${m.id}`, { title: m.name, subtitle: project.name, widgets: x.moduleWidgets({ ...m, config: cfg }) }).catch(() => {});
          m2.close(); toast(r.json?.summary || "Modul geändert"); dispatchEvent(new Event("hashchange"));
        } catch (er) { out.replaceChildren(h("div.banner.bad", errMsg(er))); b.disabled = false; }
      } }, icon("sparkles"), "Ändern"))), { wide: true });
    ta.focus();
  }
  function editModule(m) {
    formModal(`Modul „${m.name}“`, [
      { name: "name", label: "Name", value: m.name, required: true, max: 80 },
      { name: "config", label: "Konfiguration (JSON)", type: "textarea", rows: 10, ai: false, value: JSON.stringify(m.config, null, 2), max: 100000, hint: "Wird vom Modultyp ausgewertet. Keine Geheimnisse eintragen." },
      { name: "enabled", label: "Auf der Projektseite anzeigen", type: "checkbox", value: m.enabled },
    ], async (v) => {
      let config; try { config = JSON.parse(v.config || "{}"); } catch { throw new Error("Konfiguration ist kein gültiges JSON."); }
      await q(sb.from("cc_modules").update({ name: v.name, config, enabled: v.enabled, version: m.version + 1 }).eq("id", m.id));
      import("../lib/modshare.js").then((x) => x.refreshShare(`mod:${m.id}`, { title: v.name, subtitle: project.name, widgets: x.moduleWidgets({ ...m, config }) })).catch(() => {});
      toast("Modul gespeichert"); dispatchEvent(new Event("hashchange"));
    }, { wide: true });
  }
  async function deleteModule(m) {
    if (!(await confirmDialog("Modul entfernen?", `„${m.name}“ wird aus dem Projekt entfernt. Dateien des Projekts bleiben erhalten.`, { ok: "Entfernen" }))) return;
    await q(sb.from("cc_modules").delete().eq("id", m.id));
    toast("Modul entfernt"); dispatchEvent(new Event("hashchange"));
  }

  // --- Dateien mit Versionen
  function filesTab() {
    return lazy(async () => {
      const all = await q(sb.from("cc_files").select("*").eq("project_id", id).order("rel_path").order("version", { ascending: false }).limit(5000));
      const cur = all.filter((f) => f.is_current);
      const versions = all.reduce((m, f) => ((m[f.rel_path] ??= []).push(f), m), {});
      const total = cur.reduce((a, f) => a + f.file_size, 0);
      return h("div.stack",
        h("div.row.between.wrap", h("div.muted", `${cur.length} Dateien · ${fmtBytes(total)}`),
          h("div.actions", h("button.btn", { onclick: () => syncHelp(project.slug) }, icon("refresh"), "Synchronisieren"),
            h("button.btn.primary", { onclick: () => uploadDialog({ projectId: id, onDone: () => show("files") }) }, icon("upload"), "Hochladen"))),
        cur.length ? h("div.card", h("div.table-wrap", h("table.table.responsive",
          h("thead", h("tr", h("th", "Pfad"), h("th", "Kategorie"), h("th.num", "Größe"), h("th", "Version"), h("th", "Hochgeladen"), h("th", ""))),
          h("tbody", cur.map((f) => h("tr",
            h("td", { "data-l": "Pfad" }, h("div.mono.ellipsis", { style: { maxWidth: "380px" }, title: f.rel_path }, f.rel_path), f.ai_summary ? h("div.faint", { style: { fontSize: "12px", maxWidth: "420px" } }, f.ai_summary.slice(0, 140) + (f.ai_summary.length > 140 ? " …" : "")) : null),
            h("td", { "data-l": "Kategorie" }, h("span.tag", f.category)), h("td.num", { "data-l": "Größe" }, fmtBytes(f.file_size)),
            h("td", { "data-l": "Version" }, versions[f.rel_path].length > 1 ? h("button.btn.sm.ghost", { onclick: () => showVersions(versions[f.rel_path]) }, `v${f.version}`, icon("chevronD")) : `v${f.version}`),
            h("td", { "data-l": "Hochgeladen" }, fmtAgo(f.uploaded_at)),
            h("td", { "data-l": "" }, h("div.row", { style: { gap: "2px", justifyContent: "flex-end" } },
              h("button.icon-btn", { title: "KI-Zusammenfassung", "aria-label": "KI-Zusammenfassung", onclick: () => analyze(f) }, icon("sparkles")),
              h("button.icon-btn", { title: "Herunterladen", "aria-label": "Herunterladen", onclick: () => downloadFile(f).catch(toastErr) }, icon("download")),
              h("button.icon-btn", { title: "Teilen", "aria-label": "Datei teilen", onclick: () => openShareDialog("file", f.id, f.file_name) }, icon("users")),
              h("button.icon-btn", { title: "Löschen", "aria-label": "Löschen", onclick: () => delFile(f) }, icon("trash"))))))))))
          : empty("file", "Keine Dateien", "Dateien hochladen oder das Projekt per Claude-Skill synchronisieren."));
    });
  }
  function showVersions(list) {
    modal(`Versionen · ${list[0].rel_path}`, h("div.list", list.map((f) => h("div.list-item",
      h("div.li-icon", h("strong", { style: { fontSize: "12px" } }, `v${f.version}`)),
      h("div.li-main", h("div.li-title.mono", f.file_hash.slice(0, 16) + "…"), h("div.li-sub", `${fmtBytes(f.file_size)} · ${fmtDateTime(f.uploaded_at)} · ${f.source}${f.is_current ? " · aktuell" : ""}`)),
      h("button.icon-btn", { "aria-label": "Herunterladen", onclick: () => downloadFile(f).catch(toastErr) }, icon("download"))))));
  }
  async function analyze(f) {
    const box = h("div", h("div.row", h("div.spinner"), h("span.muted", "Gemini analysiert die Datei …")));
    const tasks = [["summarize", "Zusammenfassen"], ["extract", "Infos extrahieren"], ["categorize", "Kategorisieren"]];
    const run = async (task) => {
      box.replaceChildren(h("div.row", h("div.spinner"), h("span.muted", "Gemini arbeitet …")));
      try { const r = await api("ai/analyze", { file_id: f.id, task }); box.replaceChildren(md(r.result)); }
      catch (e) { box.replaceChildren(naNote(errMsg(e), "alert")); }
    };
    modal(`KI · ${f.file_name}`, h("div.stack", h("div.seg", tasks.map(([k, t]) => h("button", { onclick: (e) => { e.target.parentNode.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); run(k); } }, t))), box), { wide: true });
    run("summarize");
    setTimeout(() => document.querySelector(".seg button")?.classList.add("on"));
  }
  async function delFile(f) {
    if (!(await confirmDialog("Datei löschen?", `„${f.rel_path}“ wird mit allen Versionen dauerhaft gelöscht. Das lässt sich nicht rückgängig machen.`, { ok: "Endgültig löschen" }))) return;
    try { await removeFile(id, f.rel_path); toast("Datei gelöscht"); show("files"); } catch (e) { toastErr(e); }
  }

  function activityTab() {
    return lazy(async () => {
      const a = await q(sb.from("cc_activities").select("*").eq("project_id", id).order("created_at", { ascending: false }).limit(100));
      return h("div.card.card-pad", a.length ? timeline(a) : empty("activity", "Noch keine Aktivitäten"));
    });
  }
  function aiTab() { return h("div.card.card-pad", MODULE_TYPES.ai.render({ config: {} }, ctx)); }
  function serversTab() {
    return lazy(async () => {
      const s = await q(sb.from("cc_servers").select("*").eq("project_id", id));
      if (!s.length) return empty("server", "Keine Server zugeordnet", "Ordne beim Verbinden eines Servers dieses Projekt zu oder ändere die Zuordnung auf der Serverseite.");
      return h("div.grid.g-2", s.map((x) => h("a.card.card-pad", { href: `#/servers/${x.id}` }, h("div.row.between", h("strong", x.name), badge(SERVER_STATUS, x.status)),
        h("div.stack", { style: { gap: "8px", marginTop: "12px" } }, [["CPU", x.cpu_usage], ["RAM", x.memory_usage], ["Speicher", x.disk_usage]].map(([k, v]) =>
          h("div", h("div.row.between", { style: { fontSize: "12.5px" } }, h("span.muted", k), h("span", fmtPct(v))), meter(v)))))));
    });
  }

  function settingsTab() {
    const f = (label, el) => h("div.field", h("label", label), el);
    const name = h("input.input", { value: project.name, maxlength: 120 });
    const cat = h("select.input", Object.entries(CATEGORIES).map(([k, v]) => h("option", { value: k, selected: project.category === k }, v[0])));
    const status = h("select.input", Object.entries(PROJECT_STATUS).map(([k, v]) => h("option", { value: k, selected: project.status === k }, v[0])));
    const type = h("input.input", { value: project.project_type, maxlength: 40 });
    const desc = h("textarea.input", { rows: 5, maxlength: 4000 }, project.description);
    const tags = h("input.input", { value: (project.tags || []).join(", "), maxlength: 300 });
    const pinned = h("input", { type: "checkbox", checked: project.pinned });
    const save = h("button.btn.primary", { onclick: async () => {
      save.disabled = true;
      try {
        await q(sb.from("cc_projects").update({ name: name.value.trim(), category: cat.value, status: status.value, project_type: type.value.trim() || "generic",
          description: desc.value.trim(), tags: tags.value.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20), pinned: pinned.checked }).eq("id", id));
        invalidateProjects(); dispatchEvent(new Event("cc:nav-refresh")); toast("Gespeichert"); dispatchEvent(new Event("hashchange"));
      } catch (e) { toastErr(e); } finally { save.disabled = false; }
    } }, "Speichern");
    return h("div.stack",
      h("div.card.card-pad", h("div.form",
        h("div.two", f("Name", name), f("Projektart", type)), h("div.two", f("Kategorie", cat), f("Status", status)),
        f("Beschreibung", desc), f("Tags (Komma-getrennt)", tags), h("label.check", pinned, "In der Seitenleiste anheften"),
        h("div.row", { style: { justifyContent: "flex-end" } }, save))),
      h("div.card.card-pad", h("h3", { style: { margin: "0 0 10px", fontSize: "14px" } }, "Module"),
        modules.length ? h("div.list", modules.map((m) => h("div.list-item", h("div.li-icon", icon(MODULE_TYPES[m.module_type]?.icon || "box")),
          h("div.li-main", h("div.li-title", m.name), h("div.li-sub", `${MODULE_TYPES[m.module_type]?.label || m.module_type} · v${m.version} · ${fmtDate(m.updated_at)}`)),
          h("label.switch", { title: "Anzeigen" }, h("input", { type: "checkbox", checked: m.enabled, onchange: async (e) => { try { await q(sb.from("cc_modules").update({ enabled: e.target.checked }).eq("id", m.id)); m.enabled = e.target.checked; } catch (er) { toastErr(er); } } }), h("span")))))
          : h("div.faint", "Keine Module."), h("button.btn", { style: { marginTop: "12px" }, onclick: () => newModule(id) }, icon("plus"), "Modul hinzufügen")),
      h("div.card.card-pad", h("div.kv", h("dt", "Slug"), h("dd.mono", project.slug), h("dt", "ID"), h("dd.mono", project.id), h("dt", "Erstellt"), h("dd", fmtDateTime(project.created_at)),
        h("dt", "Aktualisiert"), h("dd", fmtDateTime(project.updated_at)))),
      h("div.card.card-pad", h("div.row.between.wrap", { style: { gap: "10px" } },
        h("div", h("strong", "Aufräumen"), h("div.faint", { style: { fontSize: "13px" } }, "Vereint doppelte Link-Module, doppelte Notizen und doppelte Tabellen, Checklisten oder Kennzahlen in den Übersichten. Nichts geht verloren.")),
        h("button.btn", { onclick: async (e) => { const ct = e.currentTarget;
          ct.disabled = true;
          try {
            const pre = await rpc("cc_tidy_project", { p_project: id, p_apply: false });
            if (!pre.modules && !pre.widgets) { toast("Alles schon aufgeräumt"); ct.disabled = false; return; }
            if (!(await confirmDialog("Aufräumen?", pre.changes.map((c) => `• ${c.action}: „${c.from}“ → „${c.into}“`).join("\n"), { ok: "Aufräumen", danger: false }))) { ct.disabled = false; return; }
            const r = await rpc("cc_tidy_project", { p_project: id, p_apply: true });
            toast(`Aufgeräumt: ${r.modules} Modul(e), ${r.widgets} Kachel(n)`); dispatchEvent(new Event("hashchange"));
          } catch (er) { toastErr(er); ct.disabled = false; }
        } }, icon("sparkles"), "Jetzt aufräumen"))),
      project.metadata?.merged_from?.length ? h("div.card.card-pad", h("strong", "Zusammengeführt aus"), h("div.list", { style: { marginTop: "6px" } }, project.metadata.merged_from.map((x) => h("div.list-item",
        h("div.li-main", h("div.li-title", x.name || x.slug), h("div.li-sub", `${x.slug}${x.at ? ` · ${fmtDate(x.at)}` : ""}${x.auto ? " · automatisch" : ""}`)))))) : null,
      h("div.card.card-pad", { style: { borderColor: "color-mix(in srgb, var(--bad) 30%, var(--line))" } },
        h("div.row.between.wrap", h("div", h("strong", "Projekt löschen"), h("div.faint", { style: { fontSize: "13px" } }, "Löscht Projekt, Module, Dateieinträge und nicht mehr genutzte Dateiinhalte dauerhaft.")),
          h("button.btn.danger", { onclick: delProject }, icon("trash"), "Löschen"))));
  }
  async function delProject() {
    if (!(await confirmDialog("Projekt endgültig löschen?", `„${project.name}“ mit allen Modulen und Dateien wird unwiderruflich gelöscht.`, { ok: "Endgültig löschen" }))) return;
    try {
      const paths = [...new Set((await q(sb.from("cc_files").select("rel_path").eq("project_id", id).limit(50000))).map((f) => f.rel_path))];
      for (const p of paths) await removeFile(id, p);
      await q(sb.from("cc_projects").delete().eq("id", id));
      await sb.from("cc_activities").insert({ kind: "project_deleted", description: `Projekt gelöscht: ${project.name}`, status: "warning" });
      invalidateProjects(); dispatchEvent(new Event("cc:nav-refresh")); toast("Projekt gelöscht"); location.hash = "#/projects";
    } catch (e) { toastErr(e); }
  }

  show(tabs.some(([k]) => k === tab) ? tab : "overview");
  return h("div",
    h("div.crumb", h("a", { href: "#/projects" }, "Projekte"), icon("chevronR", ""), h("span", project.name)),
    h("div.page-head",
      h("div.row", { style: { gap: "14px", alignItems: "flex-start" } }, catIcon(project.category, 46),
        h("div", { style: { minWidth: 0 } }, h("h1", project.name),
          h("div.row.wrap", { style: { marginTop: "8px", gap: "8px" } }, badge(PROJECT_STATUS, project.status), h("span.tag", CATEGORIES[project.category]?.[0] || project.category),
            h("span.faint", { style: { fontSize: "12.5px" } }, `aktualisiert ${fmtAgo(project.updated_at)}`)))),
      h("div.actions",
        h("button.btn", { onclick: () => openShareDialog("project", id, project.name) }, icon("users"), "Teilen"),
        h("button.btn", { onclick: () => openAssistant(null, "", { type: "project", id, name: project.name }), title: `KI, die dieses Projekt kennt` }, icon("bot"), "KI fragen"),
        h("button.btn", { onclick: () => uploadDialog({ projectId: id, onDone: () => show("files") }) }, icon("upload"), "Hochladen"),
        h("button.btn.primary", { onclick: () => newModule(id) }, icon("plus"), "Modul"))),
    tabBar, body);
}
