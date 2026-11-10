// Eigener Bereich für jeden angemeldeten Nutzer: verknüpfte Projekte (Websites, Repos, Events, KI …),
// Verbinden-Assistent, KI-Assistent über die eigenen Daten, Geteiltes, Design und Datenschutz.
// Alles läuft über RLS (owner_id = auth.uid()) bzw. die Edge Function nx-api – keine fremden Daten sichtbar.
import { sb, q, rpc, nx, local } from "../lib/api.js";
import { h, icon, clear, toast, toastErr, fmtAgo, fmtDateTime, fmtEUR, md, empty, errMsg, confirmDialog, formModal, copyText, debounce, stat } from "../lib/ui.js";
import { connectDialog, connectionsList, PROVIDERS } from "../lib/connect.js";
import { designPanel } from "../lib/design.js";
import { legalLinks, legalPage, LEGAL_PAGES } from "./legal.js";
import { renderShared } from "./guest.js";
import { CONFIG } from "../config.js";

const KINDS = { all: ["Alle", "dashboard"], website: ["Websites", "globe"], repo: ["Repositories", "code"], event: ["Events", "calendar"], ai: ["KI", "sparkles"], database: ["Datenbanken", "server"], app: ["Apps", "box"], other: ["Sonstiges", "folder"] };
const STATUS = { active: ["Aktiv", "b-ok"], error: ["Fehler", "b-bad"], building: ["Wird gebaut", "b-pri"], paused: ["Pausiert", "b-warn"], archived: ["Archiviert", "b-idle"] };
const PNAME = Object.fromEntries(PROVIDERS.map((p) => [p[0], p[1]]));

export async function renderWorkspace(root, who) {
  const meta = (await sb.auth.getUser()).data.user?.user_metadata || {};
  const first = (meta.full_name || meta.name || who.email || "").split(/[\s@]/)[0];
  const avatar = meta.avatar_url ? h("img.avatar", { src: meta.avatar_url, alt: "", referrerpolicy: "no-referrer" }) : h("div.avatar", (first || "?")[0].toUpperCase());
  const body = h("main.content", { id: "content", tabindex: -1 });
  const top = h("header.guest-top",
    h("a.brand", { href: "#/" }, h("div.brand-mark", icon("logo")), h("div.brand-text", CONFIG.appName, h("small", "Mein Bereich"))),
    h("nav.ws-nav", [["#/", "Übersicht"], ["#/verbindungen", "Verbindungen"], ["#/geteilt", "Geteilt"], ["#/einstellungen", "Einstellungen"]].map(([href, t]) => h("a", { href, dataset: { r: href } }, t))),
    h("div.spacer"),
    h("button.icon-btn", { title: "KI-Assistent", "aria-label": "KI-Assistent", onclick: () => aiDrawer() }, icon("bot")),
    h("button.icon-btn", { title: "Verbinden", "aria-label": "Dienst verbinden", onclick: () => connectDialog(show) }, icon("plus")),
    h("button.icon-btn", { title: who.email, "aria-label": "Profil", style: { padding: 0 }, onclick: () => (location.hash = "#/einstellungen") }, avatar));
  clear(root, h("div.guest-wrap", top, body));

  let seq = 0;
  async function show() {
    const hash = location.hash || "#/";
    const s = ++seq;
    top.querySelectorAll(".ws-nav a").forEach((a) => a.classList.toggle("on", a.dataset.r === hash || (a.dataset.r === "#/geteilt" && hash.startsWith("#/g/"))));
    body.replaceChildren(h("div.skel", { style: { height: "160px" } }));
    try {
      let node;
      const g = hash.match(/^#\/g\/([0-9a-f-]{36})$/);
      const leg = hash.match(/^#\/(impressum|datenschutz|nutzung)$/);
      if (leg) node = await legalPage(leg[1]);
      else if (g) { const p = await rpc("cc_guest_open", { p_share: g[1] }); node = h("div", h("div.crumb", h("a", { href: "#/geteilt" }, "Mit dir geteilt"), icon("chevronR"), h("span", p.event?.name || p.project?.name || p.file?.name)), renderShared(p, { shareId: g[1] }, null)); }
      else if (hash === "#/verbindungen") node = await connectionsPage();
      else if (hash === "#/geteilt") node = await sharedPage();
      else if (hash === "#/einstellungen") node = settingsPage();
      else node = await overview();
      if (s !== seq) return;
      body.replaceChildren(node, leg ? null : legalLinks());
      document.title = `${leg ? LEGAL_PAGES[leg[1]] : "Mein Bereich"} · ${CONFIG.appName}`;
    } catch (e) {
      if (s === seq) body.replaceChildren(empty("alert", "Konnte nicht geladen werden", /not_shared/.test(errMsg(e)) ? "Diese Freigabe gibt es nicht mehr." : errMsg(e), h("button.btn", { onclick: show }, icon("refresh"), "Erneut versuchen")));
    }
  }

  // ---------- Übersicht ----------
  async function overview() {
    const [projects, conns, shared, usage] = await Promise.all([
      q(sb.from("nx_projects").select("*").order("pinned", { ascending: false }).order("updated_at", { ascending: false }).limit(500)),
      q(sb.from("cc_connections").select("id,provider,status,last_sync")),
      rpc("cc_guest_list").catch(() => []),
      nx("usage").catch(() => null)]);
    let kind = local.get("ws:kind", "all"), term = "";
    const grid = h("div.grid.ws-grid");
    const counts = projects.reduce((a, p) => ((a[p.kind] = (a[p.kind] || 0) + 1), a), {});
    const tabs = h("div.kind-tabs", Object.entries(KINDS).filter(([k]) => k === "all" || counts[k]).map(([k, [t, ic]]) =>
      h("button.chip", { class: k === kind ? "on" : "", onclick: (e) => { kind = k; local.set("ws:kind", k); tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); draw(); } }, icon(ic), t, h("span.faint", ` ${k === "all" ? projects.length : counts[k]}`))));
    const search = h("input.input", { type: "search", placeholder: "Projekte durchsuchen …", "aria-label": "Projekte durchsuchen", style: { maxWidth: "280px" }, oninput: debounce((e) => { term = e.target.value.toLowerCase(); draw(); }, 150) });
    function draw() {
      const list = projects.filter((p) => (kind === "all" || p.kind === kind) && (!term || `${p.name} ${p.description} ${p.url ?? ""} ${p.provider}`.toLowerCase().includes(term)));
      grid.replaceChildren(...(list.length ? list.map(card) : [h("div.card", { style: { gridColumn: "1 / -1" } }, projects.length ? empty("search", "Nichts gefunden", "Anderen Filter oder Suchbegriff probieren.")
        : empty("link", "Noch keine Projekte", "Verbinde Netlify, GitHub, Vercel, Supabase oder Eventfrog – deine Websites, Repos und Events erscheinen dann automatisch hier. Oder lege ein Projekt von Hand an.",
          h("div.row", { style: { justifyContent: "center", gap: "8px" } }, h("button.btn.primary", { onclick: () => connectDialog(show) }, icon("link"), "Dienst verbinden"), h("button.btn", { onclick: () => editProject() }, icon("plus"), "Von Hand"))))]));
    }
    const card = (p) => {
      const t = p.metadata?.tickets;
      return h("article.card.ws-card",
        h("div.row", { style: { gap: "10px", alignItems: "flex-start" } },
          h("div.li-icon", icon(KINDS[p.kind]?.[1] || "folder")),
          h("div.li-main", h("div.li-title", p.name), h("div.li-sub", [PNAME[p.provider] || (p.provider === "manual" ? "Von Hand" : p.provider), `aktualisiert ${fmtAgo(p.updated_at)}`].join(" · "))),
          h("button.icon-btn.sm", { title: p.pinned ? "Lösen" : "Anheften", "aria-label": p.pinned ? "Lösen" : "Anheften", class: p.pinned ? "on" : "", onclick: async () => { try { await q(sb.from("nx_projects").update({ pinned: !p.pinned }).eq("id", p.id)); show(); } catch (e) { toastErr(e); } } }, icon("pin"))),
        p.description ? h("p.ws-desc", p.description.slice(0, 220)) : null,
        t ? h("div.row.wrap.faint", { style: { gap: "12px", fontSize: "12.5px" } }, h("span", `${t.sold ?? 0} Tickets`), t.revenue !== undefined ? h("span", fmtEUR(t.revenue)) : null, p.metadata?.date ? h("span", fmtDateTime(p.metadata.date)) : null) : null,
        h("div.row", { style: { gap: "6px", marginTop: "auto" } },
          h("span.badge", { class: STATUS[p.status]?.[1] || "b-idle" }, STATUS[p.status]?.[0] || p.status),
          h("div.spacer"),
          p.url ? h("a.btn.sm", { href: p.url, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Öffnen") : null,
          h("button.btn.sm.ghost", { "aria-label": "KI fragen", title: "KI zu diesem Projekt fragen", onclick: () => aiDrawer(`Wie steht es um „${p.name}“ und was sollte ich als Nächstes tun?`) }, icon("sparkles")),
          h("button.btn.sm.ghost", { "aria-label": "Bearbeiten", title: "Bearbeiten", onclick: () => editProject(p) }, icon("edit"))));
    };
    draw();
    const err = conns.filter((c) => c.status === "error").length;
    const hour = new Date().getHours();
    return h("div",
      h("section.hero",
        h("div", h("h1", `${hour < 11 ? "Guten Morgen" : hour < 18 ? "Hallo" : "Guten Abend"}${first ? `, ${first}` : ""}`),
          h("p", conns.length ? `${projects.length} Projekte aus ${conns.length} Verbindung${conns.length === 1 ? "" : "en"} · stündlich aktualisiert` : "Füge einen API-Schlüssel ein – dein Bereich füllt sich automatisch.")),
        h("div.row.wrap", { style: { gap: "8px" } }, h("button.btn.primary", { onclick: () => connectDialog(show) }, icon("link"), "Verbinden"), h("button.btn", { onclick: () => aiDrawer() }, icon("bot"), "KI fragen"))),
      h("div.grid.g-4", { style: { marginBottom: "18px" } },
        statBox("Projekte", projects.length, "folder"), statBox("Verbindungen", conns.length, "link", err ? `${err} mit Fehler` : null),
        statBox("Mit dir geteilt", shared.length, "users"), statBox("KI-Fragen heute", usage ? `${usage.requests_today}${usage.limit ? ` / ${usage.limit}` : ""}` : "–", "sparkles", usage?.limit ? "eigener KI-Schlüssel = ohne Limit" : null)),
      err ? h("div.banner.bad", { style: { marginBottom: "14px" } }, icon("alert"), h("div", `${err} Verbindung${err === 1 ? "" : "en"} mit Fehler – `, h("a", { href: "#/verbindungen" }, "ansehen"))) : null,
      h("div.row.wrap", { style: { justifyContent: "space-between", gap: "10px", marginBottom: "4px" } }, tabs, h("div.row", { style: { gap: "8px" } }, search, h("button.btn", { onclick: () => editProject() }, icon("plus"), "Projekt"))),
      grid);
  }
  const statBox = (label, v, ic, sub) => stat(label, String(v), { ic, sub });

  function editProject(p = null) {
    const m = formModal(p ? "Projekt bearbeiten" : "Projekt anlegen", [
      { name: "name", label: "Name", value: p?.name, required: true, max: 120 },
      { name: "kind", label: "Art", type: "select", half: true, value: p?.kind || "website", options: Object.entries(KINDS).filter(([k]) => k !== "all").map(([k, [t]]) => [k, t]) },
      { name: "status", label: "Status", type: "select", half: true, value: p?.status || "active", options: Object.entries(STATUS).map(([k, [t]]) => [k, t]) },
      { name: "url", label: "Link (https://…)", value: p?.url, max: 500, placeholder: "https://" },
      { name: "description", label: "Beschreibung / Notizen", type: "textarea", value: p?.description, max: 4000 },
    ], async (v) => {
      if (v.url && !/^https?:\/\/[^\s]+$/i.test(v.url)) throw new Error("Link muss mit https:// beginnen.");
      const row = { name: v.name, kind: v.kind, status: v.status, url: v.url || null, description: v.description, updated_at: new Date().toISOString() };
      if (p) await q(sb.from("nx_projects").update(row).eq("id", p.id));
      else await q(sb.from("nx_projects").insert({ ...row, provider: "manual" }));
      toast("Gespeichert"); show();
    }, { submit: p ? "Speichern" : "Anlegen" });
    if (p) m.el.querySelector(".form .row").prepend(h("button.btn.danger", { type: "button", style: { marginRight: "auto" }, onclick: async () => {
      if (!(await confirmDialog("Projekt löschen?", p.connection_id ? "Es kommt beim nächsten Abruf der Verbindung wieder. Trenne die Verbindung, um es dauerhaft zu entfernen." : `„${p.name}“ wird gelöscht.`, { ok: "Löschen" }))) return;
      try { await q(sb.from("nx_projects").delete().eq("id", p.id)); m.close(); toast("Gelöscht"); show(); } catch (e) { toastErr(e); }
    } }, "Löschen"));
  }

  // ---------- Verbindungen ----------
  async function connectionsPage() {
    return h("div",
      h("div.page-head", h("div", h("h1", "Verbindungen"), h("p", "API-Schlüssel einfügen – Dienst wird erkannt, geprüft und stündlich abgerufen.")),
        h("div.row", { style: { gap: "8px" } }, h("button.btn", { onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await nx("sync"); const bad = r.results.filter((x) => x.error).length; toast(bad ? `${bad} Fehler beim Abruf` : `${r.results.length} Verbindung(en) aktualisiert`, bad ? "err" : "ok"); show(); } catch (er) { toastErr(er); } } }, icon("refresh"), "Alle abrufen"),
          h("button.btn.primary", { onclick: () => connectDialog(show) }, icon("plus"), "Verbinden"))),
      h("div.card", h("div.card-body", await connectionsList(show))),
      h("div.card.card-pad", { style: { marginTop: "16px" } }, h("h3", { style: { margin: "0 0 10px", fontSize: "14px" } }, "Unterstützte Dienste"),
        h("div.prov-grid", PROVIDERS.map(([, n, what, url, fmt]) => h("a.prov", { href: url, target: "_blank", rel: "noopener noreferrer" }, h("strong", n), h("span", what), h("small", fmt))))),
      h("div.na-note", { style: { marginTop: "16px" } }, icon("lock"), h("div", "Nur Lesezugriff nötig: Erstelle Schlüssel mit möglichst wenigen Rechten (z. B. GitHub „fine-grained“, nur Lesen). Schlüssel werden verschlüsselt gespeichert und sind für niemanden – auch nicht für dich – wieder sichtbar.")));
  }

  // ---------- Geteilt ----------
  async function sharedPage() {
    const list = await rpc("cc_guest_list");
    const KI = { event: "calendar", project: "folder", file: "file" };
    return h("div", h("div.page-head", h("div", h("h1", "Mit dir geteilt"), h("p", `Freigaben für ${who.email}`))),
      list.length ? h("div.grid.ws-grid", list.map((s) => h("a.card.card-pad", { href: `#/g/${s.id}`, style: { display: "flex", gap: "12px", alignItems: "center" } }, h("div.li-icon", icon(KI[s.kind])),
        h("div.li-main", h("div.li-title", s.title || "Gelöscht"), h("div.li-sub", [s.date ? fmtDateTime(s.date) : null, s.permission === "tasks" ? "Aufgaben abhaken erlaubt" : "nur ansehen", `geteilt ${fmtAgo(s.created_at)}`].filter(Boolean).join(" · "))))))
        : h("div.card", empty("users", "Noch nichts geteilt", "Wenn jemand ein Event, Projekt oder eine Datei mit deiner E-Mail teilt, erscheint es hier.")));
  }

  // ---------- Einstellungen ----------
  function settingsPage() {
    const exportData = async () => {
      try {
        const [p, c] = await Promise.all([q(sb.from("nx_projects").select("*")), q(sb.from("cc_connections").select("provider,label,account,hint,status,last_sync,created_at"))]);
        const a = h("a", { href: URL.createObjectURL(new Blob([JSON.stringify({ exported_at: new Date().toISOString(), account: who.email, projects: p, connections: c }, null, 2)], { type: "application/json" })), download: "jopml-nexus-meine-daten.json" });
        document.body.append(a); a.click(); a.remove(); toast("Export erstellt");
      } catch (e) { toastErr(e); }
    };
    return h("div",
      h("div.page-head", h("div", h("h1", "Einstellungen"), h("p", `Angemeldet als ${who.email}`))),
      h("div.grid.g-2",
        h("section.card", h("div.card-head", h("h3", "Design")), h("div.card-body", designPanel())),
        h("section.card", h("div.card-head", h("h3", "Konto & Daten")), h("div.card-body", h("div.list",
          h("div.list-item", h("div.li-main", h("div.li-title", "Meine Daten exportieren"), h("div.li-sub", "Projekte und Verbindungen als JSON (ohne Schlüssel)")), h("button.btn.sm", { onclick: exportData }, icon("download"), "Export")),
          h("div.list-item", h("div.li-main", h("div.li-title", "Abmelden")), h("button.btn.sm", { onclick: async () => { await sb.auth.signOut(); location.hash = ""; location.reload(); } }, icon("logout"), "Abmelden")),
          h("div.list-item", h("div.li-main", h("div.li-title", "Alle meine Daten löschen"), h("div.li-sub", "Entfernt sofort alle Projekte, Verbindungen und gespeicherten Schlüssel. Geteilte Inhalte anderer bleiben bei ihnen.")),
            h("button.btn.sm.danger", { onclick: async () => {
              if (!(await confirmDialog("Wirklich alles löschen?", "Alle deine Projekte, Verbindungen und Schlüssel werden endgültig gelöscht. Das lässt sich nicht rückgängig machen.", { ok: "Endgültig löschen" }))) return;
              try { await rpc("nx_delete_my_data"); local.set("ws:chat", []); toast("Alle Daten gelöscht"); location.hash = "#/"; show(); } catch (e) { toastErr(e); } } }, "Löschen")))))));
  }

  // ---------- KI-Assistent ----------
  function aiDrawer(prefill = "") {
    document.querySelector(".drawer.assistant")?.remove();
    let history = local.get("ws:chat", []);
    const log = h("div.chat");
    const info = h("p.faint", { style: { fontSize: "12.5px", margin: "0 0 10px" } }, "Kennt deine Projekte und Verbindungen. Der Verlauf bleibt nur in diesem Browser.");
    const inp = h("textarea.input", { rows: 2, placeholder: "Frage stellen … (Enter = senden)", maxlength: 3000, style: { minHeight: "58px" } });
    const SUG = ["Welche meiner Websites haben Probleme?", "Fasse meine Projekte kurz zusammen", "Was sollte ich diese Woche erledigen?", "Wie verbinde ich GitHub?"];
    const chips = h("div.chips");
    const body = h("div.drawer-body", info, log, chips);
    const bubble = (m) => { const b = h("div.bubble", { class: m.role === "user" ? "me" : "ai" }, m.role === "user" ? m.text : md(m.text));
      if (m.role === "assistant" && !m.error) b.append(h("div.bubble-meta", m.model ? h("span", m.model) : null, h("button.icon-btn.sm", { title: "Kopieren", "aria-label": "Antwort kopieren", onclick: () => copyText(m.text) }, icon("copy"))));
      if (m.error) b.style.color = "var(--bad)"; return b; };
    const redraw = () => { log.replaceChildren(...history.map(bubble)); chips.replaceChildren(...(history.length ? [] : SUG.map((t) => h("button.chip", { onclick: () => { inp.value = t; send(); } }, t)))); body.scrollTop = body.scrollHeight; };
    const send = async () => {
      const qtxt = inp.value.trim(); if (!qtxt || sendBtn.disabled) return;
      inp.value = ""; sendBtn.disabled = true;
      const prior = history.filter((m) => !m.error).slice(-10).map(({ role, text }) => ({ role, text }));
      history.push({ role: "user", text: qtxt }); redraw();
      const wait = h("div.bubble.ai", h("div.row", h("div.spinner", { style: { width: "16px", height: "16px" } }), h("span.faint", "denkt nach …")));
      log.append(wait); body.scrollTop = body.scrollHeight;
      try {
        const r = await nx("ai", { question: qtxt, history: prior });
        history.push({ role: "assistant", text: r.answer, model: `${r.provider} · ${r.model}${r.own_key ? " · eigener Schlüssel" : ""}` });
        if (r.remaining !== null && r.remaining !== undefined) info.textContent = `Noch ${r.remaining} kostenlose Fragen heute. Mit eigenem KI-Schlüssel (Groq, Gemini, OpenAI) ohne Limit.`;
      } catch (e) { history.push({ role: "assistant", text: errMsg(e), error: true }); }
      history = history.slice(-40); local.set("ws:chat", history); sendBtn.disabled = false; redraw(); inp.focus();
    };
    inp.addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } });
    const sendBtn = h("button.btn.primary", { onclick: send, "aria-label": "Senden", style: { height: "58px" } }, icon("send"));
    const dr = h("aside.drawer.assistant", { role: "dialog", "aria-label": "KI-Assistent" },
      h("div.modal-head", h("h3.row", icon("bot"), "KI-Assistent"), h("div.row",
        h("button.icon-btn", { title: "Neues Gespräch", "aria-label": "Verlauf leeren", onclick: () => { history = []; local.set("ws:chat", []); redraw(); } }, icon("refresh")),
        h("button.icon-btn", { onclick: () => dr.remove(), "aria-label": "Schließen" }, icon("x")))),
      body, h("div", { style: { padding: "12px 20px calc(16px + env(safe-area-inset-bottom))", borderTop: "1px solid var(--line)", display: "flex", gap: "8px", alignItems: "flex-end" } }, inp, sendBtn));
    document.body.append(dr); redraw(); inp.value = prefill; inp.focus();
    const esc = (e) => { if (e.key === "Escape" && !document.querySelector(".overlay")) { dr.remove(); document.removeEventListener("keydown", esc); } };
    document.addEventListener("keydown", esc);
  }

  window.addEventListener("hashchange", show);
  document.addEventListener("keydown", (e) => {
    if (/^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.metaKey || e.ctrlKey || e.altKey || document.querySelector(".overlay, .drawer")) return;
    if (e.key === "a") { e.preventDefault(); aiDrawer(); } else if (e.key === "v") { e.preventDefault(); connectDialog(show); }
  });
  await show();
}
