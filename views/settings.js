import { sb, q, rpc, getSetting, setSetting, local, api } from "../lib/api.js";
import { h, icon, toast, toastErr, confirmDialog, modal, copyText, fmtAgo, fmtDate, empty, naNote, badge } from "../lib/ui.js";
import { MODULE_TYPES } from "../lib/modules.js";
import { WIDGETS } from "./dashboard.js";
import { CONFIG } from "../config.js";
import { designPanel } from "../lib/design.js";
import { connectDialog, connectionsList } from "../lib/connect.js";

const TABS = [["general", "Allgemein"], ["design", "Design"], ["connections", "Verbindungen"], ["dashboard", "Dashboard"], ["notifications", "Benachrichtigungen"], ["integrations", "Integrationen"], ["keys", "API-Schlüssel"], ["modules", "Projektmodule"], ["legal", "Rechtliches"]];
const SCOPES = [["projects", "Projekte anlegen/aktualisieren"], ["files", "Dateien hochladen"], ["ai", "KI-Nutzung melden"], ["activity", "Aktivitäten melden"]];

export default async function settingsView({ query }) {
  let tab = query.get("tab") || "general";
  const body = h("div");
  const bar = h("div.tabs", TABS.map(([k, t]) => h("button", { class: k === tab ? "on" : "", onclick: () => show(k) }, t)));
  function show(k) {
    tab = k; bar.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", TABS[i][0] === k));
    history.replaceState(null, "", `#/settings${k === "general" ? "" : "?tab=" + k}`);
    body.replaceChildren(h("div.skel", { style: { height: "200px" } }));
    ({ general, design, connections, legal, dashboard, notifications, integrations, keys, modules })[k]().then((n) => body.replaceChildren(n)).catch((e) => body.replaceChildren(naNote(e.message, "alert")));
  }
  const row = (title, sub, ctl) => h("div.list-item", h("div.li-main", h("div.li-title", title), sub ? h("div.li-sub", { style: { whiteSpace: "normal" } }, sub) : null), ctl);
  const sw = (checked, on) => h("label.switch", h("input", { type: "checkbox", checked, onchange: (e) => on(e.target.checked) }), h("span"));

  async function general() {
    return h("div.card.card-pad", h("div.list",
      row("Darstellung", "Theme, Akzentfarbe, Dichte und Schriftgröße", h("button.btn.sm", { onclick: () => show("design") }, "Design")),
      row("Sprache", "Die Oberfläche ist auf Deutsch. Weitere Sprachen lassen sich über die Texte in den Ansichten ergänzen.", h("span.tag", "Deutsch")),
      row("Seitenleiste eingeklappt starten", null, sw(local.get("collapsed", false), (v) => { local.set("collapsed", v); document.querySelector(".app")?.classList.toggle("collapsed", v); })),
      row("Als App installieren", "Chrome/Edge: Installieren-Symbol in der Adressleiste. Safari (iPhone/iPad): Teilen → „Zum Home-Bildschirm“. macOS Safari: Ablage → „Zum Dock hinzufügen“.", icon("download", "faint"))));
  }

  async function dashboard() {
    const cfg = await getSetting("dashboard", { order: Object.keys(WIDGETS), hidden: [] });
    let order = [...(cfg.order || []).filter((k) => WIDGETS[k]), ...Object.keys(WIDGETS).filter((k) => !(cfg.order || []).includes(k))];
    const hidden = new Set(cfg.hidden || []);
    const listEl = h("div.list");
    const save = async () => { try { await setSetting("dashboard", { order, hidden: [...hidden] }); toast("Dashboard gespeichert"); } catch (e) { toastErr(e); } };
    const move = (i, d) => { const j = i + d; if (j < 0 || j >= order.length) return; [order[i], order[j]] = [order[j], order[i]]; draw(); save(); };
    let dragFrom = null;
    function draw() {
      listEl.replaceChildren(...order.map((k, i) => h("div.list-item", { draggable: true,
        ondragstart: () => { dragFrom = i; }, ondragover: (e) => { e.preventDefault(); e.currentTarget.classList.add("drag-over"); }, ondragleave: (e) => e.currentTarget.classList.remove("drag-over"),
        ondrop: (e) => { e.preventDefault(); e.currentTarget.classList.remove("drag-over"); if (dragFrom === null || dragFrom === i) return; const [it] = order.splice(dragFrom, 1); order.splice(i, 0, it); dragFrom = null; draw(); save(); } },
        h("span.widget-handle", icon("grip")), h("div.li-main", h("div.li-title", WIDGETS[k])),
        h("button.icon-btn", { "aria-label": "Nach oben", disabled: i === 0, onclick: () => move(i, -1) }, icon("chevronL", "")),
        h("button.icon-btn", { "aria-label": "Nach unten", disabled: i === order.length - 1, onclick: () => move(i, 1) }, icon("chevronR", "")),
        sw(!hidden.has(k), (v) => { v ? hidden.delete(k) : hidden.add(k); save(); }))));
      listEl.querySelectorAll(".icon-btn svg").forEach((s, n) => (s.style.transform = "rotate(90deg)"));
    }
    draw();
    return h("div.card.card-pad", h("p.muted", { style: { marginTop: 0 } }, "Ziehen oder mit den Pfeilen sortieren, Schalter blendet Widgets aus. Wird sofort gespeichert und gilt auf allen Geräten."), listEl);
  }

  async function notifications() {
    const cfg = await getSetting("notifications", {});
    const save = async (patch) => { Object.assign(cfg, patch); try { await setSetting("notifications", cfg); toast("Gespeichert"); } catch (e) { toastErr(e); } };
    const items = [["server", "Server offline / wieder online"], ["sync", "Projekt synchronisiert"], ["upload", "Upload abgeschlossen (Skill)"], ["integration", "Fehler bei Integrationen"], ["module", "Neues Modul erstellt"], ["ai", "KI-Tagesgrenze erreicht"]];
    const limit = h("input.input", { type: "number", min: 0, step: 10000, value: cfg.ai_daily_tokens ?? 500000, style: { width: "150px" }, onchange: (e) => save({ ai_daily_tokens: Math.max(0, parseInt(e.target.value, 10) || 0) }) });
    const perm = "Notification" in window ? Notification.permission : "unsupported";
    return h("div.stack",
      h("div.card.card-pad", h("div.list", items.map(([k, t]) => row(t, null, sw(cfg[k] !== false, (v) => save({ [k]: v })))),
        row("KI-Tagesgrenze (Tokens)", "Benachrichtigung, sobald der gemessene Tagesverbrauch diese Grenze erreicht. 0 = aus.", limit))),
      h("div.card.card-pad", h("div.list", row("Browser-Benachrichtigungen", perm === "unsupported" ? "Dieser Browser unterstützt keine Benachrichtigungen." : perm === "denied" ? "Im Browser blockiert – in den Website-Einstellungen erlauben." : "Zeigt neue Hinweise auch, wenn der Tab im Hintergrund ist (solange die App geöffnet ist).",
        perm === "unsupported" || perm === "denied" ? h("span.tag", perm === "denied" ? "blockiert" : "nicht verfügbar") : sw(local.get("browserNotif", false) && perm === "granted", async (v) => {
          if (v && Notification.permission !== "granted") { const r = await Notification.requestPermission(); if (r !== "granted") { toast("Nicht erlaubt", "err"); show("notifications"); return; } }
          local.set("browserNotif", v); toast(v ? "Browser-Benachrichtigungen an" : "Aus");
        })))));
  }

  async function design() {
    return h("div.card.card-pad", designPanel(), h("p.faint", { style: { fontSize: "12.5px", marginBottom: 0 } }, "Wird pro Gerät gespeichert."));
  }

  async function connections() {
    const st = await rpc("cc_workspace_stats").catch(() => null);
    const list = await connectionsList(() => show("connections"));
    return h("div.stack",
      h("div.card", h("div.card-head", h("h3", "Meine Verbindungen"), h("button.btn.sm.primary", { onclick: () => connectDialog(() => show("connections")) }, icon("plus"), "Verbinden")), h("div.card-body", list),
        h("div.card-body", naNote("Verbundene Websites, Repos und Datenbanken erscheinen zusätzlich als Projekte im Control Center. Schlüssel liegen verschlüsselt im Vault."))),
      st ? h("div.card", h("div.card-head", h("h3", "Nutzerbereiche (anonym)")), h("div.card-body", h("div.list",
        row("Nutzer mit eigenen Daten", null, h("strong", String(st.users_with_data))),
        row("Projekte in Nutzerbereichen", null, h("strong", String(st.projects))),
        row("Verbindungen", Object.entries(st.connections || {}).map(([k, n]) => `${k}: ${n}`).join(" · ") || "keine", null),
        row("KI-Fragen heute", null, h("strong", String(st.ai_today)))))) : null);
  }

  async function legal() {
    const L = (await getSetting("legal", {})) || {};
    const F = [["name", "Name / Firma", "input"], ["address", "Anschrift (Straße, PLZ Ort, Land)", "textarea"], ["email", "E-Mail", "input"], ["phone", "Telefon (optional)", "input"], ["responsible", "Verantwortlich für den Inhalt", "input"]];
    const els = Object.fromEntries(F.map(([k, , t]) => [k, h(t === "textarea" ? "textarea.input" : "input.input", { rows: 3, value: L[k] || "", maxlength: 400 })]));
    for (const [k] of F) if (L[k]) els[k].value = L[k];
    return h("div.card.card-pad", h("div.stack",
      naNote("Diese Angaben füllen die Vorlagen für Impressum und Datenschutzerklärung. Sie sind öffentlich sichtbar. Die Texte sind Vorlagen – bitte vor Veröffentlichung prüfen (keine Rechtsberatung)."),
      ...F.map(([k, label]) => h("label.field", h("span", label), els[k])),
      h("div.row.wrap", { style: { gap: "8px" } },
        h("button.btn.primary", { onclick: async () => {
          const v = Object.fromEntries(F.map(([k]) => [k, els[k].value.trim().slice(0, 400)])); v.updated = new Date().toISOString();
          if (v.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email)) return toast("E-Mail ungültig", "err");
          try { await setSetting("legal", v); toast("Gespeichert"); } catch (e) { toastErr(e); } } }, icon("check"), "Speichern"),
        h("a.btn", { href: "#/impressum", target: "_blank" }, "Impressum ansehen"), h("a.btn", { href: "#/datenschutz", target: "_blank" }, "Datenschutz ansehen"), h("a.btn", { href: "#/nutzung", target: "_blank" }, "Nutzungsbedingungen"))));
  }

  async function integrations() {
    const [integ, keys, servers] = await Promise.all([q(sb.from("cc_integrations").select("*")), rpc("cc_list_api_keys"), q(sb.from("cc_servers").select("id,status"))]);
    const anth = integ.find((i) => i.kind === "anthropic" && !i.project_id);
    const net = integ.find((i) => i.kind === "netlify" && !i.project_id);
    const st0 = await api("sync/status").catch(() => null);
    const st = (cls, t) => h("span.badge", { class: cls }, t);
    const t0 = performance.now(); let latency = null;
    try { await sb.from("cc_settings").select("key").limit(1); latency = Math.round(performance.now() - t0); } catch { /* */ }
    return h("div.card.card-pad", h("div.list",
      row("Supabase", `Projekt „jopml“ (${CONFIG.supabaseUrl.replace("https://", "")}) · Antwortzeit ${latency ?? "?"} ms · RLS aktiv auf allen Control-Center-Tabellen`, st(latency !== null ? "b-ok" : "b-bad", latency !== null ? "Verbunden" : "Fehler")),
      row("JOPML", "Admin-Funktionen (Übersicht, KI-Statistik, Tickets) werden direkt genutzt.", h("a.btn.sm", { href: "#/jopml" }, "Öffnen")),
      row("Google-Anmeldung", "Supabase Auth mit Google OAuth – Zugang nur für das hinterlegte Admin-Konto (serverseitig geprüft).", st("b-ok", "Aktiv")),
      row("Server-Agenten", `${servers.length} Server registriert, ${servers.filter((s) => s.status === "online" || s.status === "warning").length} online`, h("a.btn.sm", { href: "#/servers" }, "Verwalten")),
      row("Anthropic Claude (Admin-API)", anth?.status === "connected" ? `Zuletzt synchronisiert ${fmtAgo(anth.last_sync)}` : anth?.last_error ? `Fehler: ${anth.last_error}` : "Supabase-Secret ANTHROPIC_ADMIN_KEY setzen, dann „Claude synchronisieren“ unter KI & Tokens.",
        st(anth?.status === "connected" ? "b-ok" : anth?.status === "error" ? "b-bad" : "b-idle", anth?.status === "connected" ? "Verbunden" : anth?.status === "error" ? "Fehler" : "Nicht verbunden")),
      row("Google Gemini (KI-Assistent & Datei-Analyse)", "Nutzt den bereits für JOPML gesetzten Schlüssel GEMINI_API_KEY in der Edge Function.", h("button.btn.sm", { onclick: async (e) => {
        e.target.disabled = true; try { await api("ai/ask", { question: "Antworte nur mit: OK" }); toast("Gemini antwortet"); } catch (er) { toastErr(er); } finally { e.target.disabled = false; } } }, "Testen")),
      row("Netlify (Websites)", !st0?.netlify ? "Supabase-Secret NETLIFY_TOKEN setzen (Netlify › User settings › Applications › Personal access tokens). Danach erscheinen alle Websites als Projekte."
          : net?.last_sync ? `${net.config?.sites ?? "?"} Website(s) · zuletzt ${fmtAgo(net.last_sync)}${net.last_error ? ` · ${net.last_error}` : ""}` : "Token gesetzt – noch nicht synchronisiert.",
        h("div.row", st(net?.status === "error" ? "b-bad" : st0?.netlify ? "b-ok" : "b-idle", net?.status === "error" ? "Fehler" : st0?.netlify ? "Verbunden" : "Nicht verbunden"),
          st0?.netlify ? h("button.btn.sm", { onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await api("sync/netlify"); toast(`${r.sites} Website(s) abgerufen${r.changed ? `, ${r.changed} geändert` : ""}`); show("integrations"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("refresh"), "Jetzt") : null)),
      row("Eventfrog (Tickets)", st0?.eventfrog_api ? "Organizer-API verbunden – Tickets werden stündlich automatisch abgerufen." : "Supabase-Secret EVENTFROG_API_KEY setzen – oder auf der Event-Seite „Eventfrog-Import“ mit Export-Datei.",
        h("div.row", st(st0?.eventfrog_api ? "b-ok" : "b-idle", st0?.eventfrog_api ? "Verbunden" : "Datei-Import"),
          st0?.eventfrog_api ? h("button.btn.sm", { onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await api("sync/eventfrog"); toast(`${r.events?.length ?? 0} Event(s) abgerufen`); show("integrations"); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("refresh"), "Jetzt") : null)),
      row("Stündlicher Auto-Abruf", "Netlify, Eventfrog und alle Verbindungen werden jede Stunde (Minute 17) serverseitig aktualisiert.", st("b-ok", "Aktiv")),
      row("Roblox", "Öffentliche Spieldaten über die offizielle Roblox-API – pro Spiel ein Modul vom Typ „Roblox-Spiel“ anlegen.", st("b-ok", "Bereit")),
      row("Claude-Skill & eigene Apps", `${keys.filter((k) => !k.revoked_at && !k.server_id).length} aktive API-Schlüssel`, h("button.btn.sm", { onclick: () => show("keys") }, "Schlüssel"))));
  }

  async function keys() {
    const list = await rpc("cc_list_api_keys");
    const create = () => {
      const name = h("input.input", { placeholder: "z. B. Claude-Skill auf meinem PC", maxlength: 60 });
      const checks = SCOPES.map(([k, t]) => h("label.check", h("input", { type: "checkbox", value: k, checked: true }), t));
      const m = modal("API-Schlüssel erstellen", h("div.form", h("div.field", h("label", "Name"), name), h("div.field", h("label", "Berechtigungen"), checks)), { foot: [
        h("button.btn.ghost", { onclick: () => m.close() }, "Abbrechen"),
        h("button.btn.primary", { onclick: async () => {
          const scopes = checks.map((c) => c.firstChild).filter((c) => c.checked).map((c) => c.value);
          if (!name.value.trim() || !scopes.length) return toast("Name und mindestens eine Berechtigung angeben", "err");
          try { const tok = await rpc("cc_create_api_key", { p_name: name.value.trim(), p_scopes: scopes, p_server: null }); m.close(); showToken(tok); } catch (e) { toastErr(e); }
        } }, "Erstellen")] });
    };
    const showToken = (tok) => modal("Neuer API-Schlüssel", h("div.stack",
      naNote("Nur jetzt sichtbar – gespeichert wird lediglich ein SHA-256-Hash. Sicher ablegen (z. B. als Umgebungsvariable CC_API_KEY), nie in Git einchecken.", "key"),
      h("div.row", h("input.input.mono", { value: tok, readonly: true, onfocus: (e) => e.target.select() }), h("button.btn", { onclick: () => copyText(tok) }, icon("copy"), "Kopieren")),
      h("div.field", h("label", "API-Adresse"), h("div.row", h("input.input.mono", { value: `${CONFIG.supabaseUrl}/functions/v1/cc-api`, readonly: true }), h("button.btn", { onclick: () => copyText(`${CONFIG.supabaseUrl}/functions/v1/cc-api`) }, icon("copy"))))),
      { onClose: () => show("keys") });
    return h("div.card", h("div.card-head", h("h3", "API-Schlüssel"), h("button.btn.sm.primary", { onclick: create }, icon("plus"), "Neuer Schlüssel")),
      h("div.card-body", h("p.muted", { style: { marginTop: 0, fontSize: "13px" } }, "Für den Claude-Skill „jopml-project-integrator“, Serveragenten und eigene Apps. Jeder Schlüssel hat nur die gewählten Berechtigungen und ist auf 240 Anfragen pro Minute begrenzt."),
        list.length ? h("div.list", list.map((k) => h("div.list-item", h("div.li-icon", icon(k.server_id ? "server" : "key")),
          h("div.li-main", h("div.li-title", k.name, " ", h("span.mono.faint", { style: { fontSize: "12px" } }, k.prefix + "…")),
            h("div.li-sub", `${k.scopes.join(", ")} · erstellt ${fmtDate(k.created_at)} · zuletzt genutzt ${fmtAgo(k.last_used_at)}`)),
          k.revoked_at ? h("span.badge.b-idle", "Widerrufen") : h("button.btn.sm.danger", { onclick: async () => {
            if (!(await confirmDialog("Schlüssel widerrufen?", `„${k.name}“ funktioniert danach sofort nicht mehr.`, { ok: "Widerrufen" }))) return;
            try { await rpc("cc_revoke_api_key", { p_id: k.id }); toast("Widerrufen"); show("keys"); } catch (e) { toastErr(e); } } }, "Widerrufen"))))
          : empty("key", "Noch keine Schlüssel", "Lege einen Schlüssel für den Claude-Skill an.")));
  }

  async function modules() {
    const [mods, projects] = await Promise.all([q(sb.from("cc_modules").select("id,name,module_type,enabled,version,project_id,updated_at").order("updated_at", { ascending: false })), q(sb.from("cc_projects").select("id,name"))]);
    const pn = Object.fromEntries(projects.map((p) => [p.id, p.name]));
    return h("div.stack",
      h("div.card.card-pad", h("h3", { style: { margin: "0 0 6px", fontSize: "14px" } }, "Verfügbare Modultypen"),
        h("div.row.wrap", { style: { gap: "6px" } }, Object.entries(MODULE_TYPES).map(([k, t]) => h("span.tag", { title: k }, t.label))),
        h("p.faint", { style: { fontSize: "12.5px", marginBottom: 0 } }, "Neue Typen werden in web/lib/modules.js registriert und erscheinen danach automatisch in allen Dialogen.")),
      h("div.card", h("div.card-head", h("h3", `Alle Module (${mods.length})`)), h("div.card-body", mods.length ? h("div.list", mods.map((m) => h("div.list-item",
        h("div.li-icon", icon(MODULE_TYPES[m.module_type]?.icon || "box")),
        h("div.li-main", h("a.li-title", { href: `#/projects/${m.project_id}`, style: { display: "block" } }, m.name), h("div.li-sub", `${pn[m.project_id] || "?"} · ${MODULE_TYPES[m.module_type]?.label || m.module_type} · v${m.version}`)),
        sw(m.enabled, async (v) => { try { await q(sb.from("cc_modules").update({ enabled: v }).eq("id", m.id)); toast(v ? "Eingeblendet" : "Ausgeblendet"); } catch (e) { toastErr(e); } }))))
        : h("div.faint", "Keine Module."))));
  }

  show(TABS.some(([k]) => k === tab) ? tab : "general");
  return h("div", h("div.page-head", h("div", h("h1", "Einstellungen"), h("p", "Darstellung, Dashboard, Benachrichtigungen, Integrationen und Zugänge"))), bar, body);
}
