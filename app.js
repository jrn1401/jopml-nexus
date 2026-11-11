// JOPML Nexus – App-Shell: Anmeldung, Navigation, Router, Suche, Benachrichtigungen, Schnellaktionen.
import { sb, rpc, projects, local } from "./lib/api.js";
import { h, icon, clear, toast, toastErr, fmtAgo, modal, debounce, errMsg } from "./lib/ui.js";
import { newProject, newModule, connectServer, newEvent, uploadDialog, openAssistant, syncHelp } from "./lib/actions.js";
import { CONFIG } from "./config.js";

const root = document.getElementById("root");
const ROUTES = [
  [/^\/?$/, "dashboard"], [/^\/projects$/, "projects"], [/^\/projects\/([\w-]+)$/, "project"],
  [/^\/servers$/, "servers"], [/^\/servers\/([\w-]+)$/, "server"], [/^\/ai$/, "ai"],
  [/^\/events$/, "events"], [/^\/events\/([\w-]+)$/, "event"], [/^\/jopml$/, "jopml"],
  [/^\/files$/, "files"], [/^\/activity$/, "activity"], [/^\/settings$/, "settings"], [/^\/system$/, "system"], [/^\/shares$/, "shares"], [/^\/web(?:\/([0-9a-f-]{36}))?$/, "web"],
  [/^\/(impressum|datenschutz|nutzung)$/, "legal"], [/^\/connections$/, "connections"], [/^\/hosting$/, "hosting"],
];
const NAV_GROUPS = [
  ["Übersicht", [["#/", "dashboard", "Dashboard"]]],
  ["Planung", [["#/events", "calendar", "Events"], ["#/projects", "folder", "Projekte"], ["#/files", "file", "Dateien"], ["#/shares", "users", "Teilen & Gäste"]]],
  ["Betrieb", [["#/web", "globe", "Websites"], ["#/jopml", "layers", "JOPML"], ["#/servers", "server", "Server"], ["#/hosting", "rocket", "Hosting"], ["#/ai", "sparkles", "KI & Tokens"], ["#/connections", "link", "Verbindungen"]]],
  ["Verlauf", [["#/activity", "activity", "Aktivitäten"], ["#/system", "check", "Systemprüfung"]]],
];
const NAV = NAV_GROUPS.flatMap(([, items]) => items);
const MOBILE = [["#/", "dashboard", "Start"], ["#/events", "calendar", "Events"], ["#/web", "globe", "Websites"], ["#/jopml", "layers", "JOPML"], ["#/servers", "server", "Server"]];

let user = null, shell = null, unread = 0, lastNotifId = null;

// ---------------- Start & Anmeldung ----------------
async function boot() {
  if ("serviceWorker" in navigator && location.protocol === "https:") {
    navigator.serviceWorker.register("sw.js").then((reg) => {
      const t0 = Date.now();
      // Kurz nach dem Öffnen gefundene Updates sofort übernehmen, später nur anbieten (nichts Getipptes verlieren)
      const ask = (w) => w && navigator.serviceWorker.controller && (Date.now() - t0 < 20_000 ? w.postMessage("skipWaiting") : showUpdate(w));
      if (reg.waiting) ask(reg.waiting);
      reg.addEventListener("updatefound", () => { const w = reg.installing; w?.addEventListener("statechange", () => w.state === "installed" && ask(w)); });
      reg.update().catch(() => {});
      setInterval(() => reg.update().catch(() => {}), 10 * 60_000);
      document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
    }).catch(() => {});
    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
  }
  const params = new URLSearchParams(location.search);
  const hashParams = new URLSearchParams(location.hash.startsWith("#error") ? location.hash.slice(1) : "");
  const oauthErr = params.get("error_description") || hashParams.get("error_description");
  if (hashParams.get("error")) history.replaceState(null, "", location.pathname + location.search);
  // Gäste-Link: funktioniert ohne Anmeldung
  const link = location.hash.match(/^#\/s\/([0-9a-f]{32})$/);
  if (link) { const { renderLink } = await import("./views/guest.js"); return renderLink(root, link[1]); }
  // Öffentliche Statusseite einer Website (#/status/<key>)
  const stat = location.hash.match(/^#\/status\/([0-9a-f]{18})$/);
  if (stat) { const { renderStatus } = await import("./views/status.js"); return renderStatus(root, stat[1]); }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) {
    // Rechtsseiten sind ohne Anmeldung erreichbar
    const showPublic = async () => {
      const leg = location.hash.match(/^#\/(impressum|datenschutz|nutzung)$/);
      if (!leg) return renderLogin(oauthErr);
      const { legalPage } = await import("./views/legal.js");
      clear(root, h("div.guest-wrap", h("header.guest-top", h("a.brand", { href: "#/" }, h("div.brand-mark", icon("logo")), h("div.brand-text", CONFIG.appName, h("small", "Rechtliches")))), h("main.content", await legalPage(leg[1]))));
    };
    window.addEventListener("hashchange", showPublic);
    return showPublic();
  }
  let who;
  try { who = await rpc("cc_whoami"); } catch (e) { return renderLogin(errMsg(e)); }
  if (!who?.admin) {
    if (location.search) history.replaceState(null, "", location.pathname + location.hash);
    if (!who?.email && !who?.anonymous) { await sb.auth.signOut(); return renderLogin("Dieses Konto hat keine bestätigte E-Mail-Adresse."); }
    sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.reload(); });
    const { renderWorkspace } = await import("./views/workspace.js");
    await renderWorkspace(root, who);
    const { finishUpgrade } = await import("./lib/upgrade.js");
    return finishUpgrade(who, oauthErr);
  }
  if (location.search) history.replaceState(null, "", location.pathname + location.hash);
  user = session.user;
  renderShell();
  sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") location.reload(); });
}

function renderLogin(error) {
  const go = async () => {
    btn.disabled = true;
    const { error: e } = await sb.auth.signInWithOAuth({ provider: "google",
      options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } } });
    if (e) { btn.disabled = false; toast(e.message, "err"); }
  };
  const linkIn = h("input.input", { placeholder: "Gäste-Link oder Code einfügen", "aria-label": "Gäste-Link", autocomplete: "off" });
  const btn = h("button.gbtn", { onclick: go },
    svgGoogle(), "Mit Google anmelden");
  // Gast-Konto: sofort ausprobieren ohne Google (anonyme Anmeldung, wird nach 7 Tagen gelöscht)
  const guestBtn = h("button.btn", { style: { width: "100%", justifyContent: "center", height: "44px", marginTop: "8px" }, onclick: async () => {
    guestBtn.disabled = true;
    const { error: e } = await sb.auth.signInAnonymously();
    if (e) { guestBtn.disabled = false; return toast(/disabled|not enabled/i.test(e.message) ? "Gast-Zugang ist noch nicht freigeschaltet – bitte mit Google anmelden." : e.message, "err", 7000); }
    location.reload();
  } }, icon("users"), "Als Gast ausprobieren");
  clear(root, h("div.login", h("div.card.login-card",
    h("div.brand-mark", icon("logo")),
    h("h1", CONFIG.appName), h("p", "Dein zentrales Control Center für Projekte, Server und KI."),
    btn, guestBtn,
    h("div.login-sub", "Jeder kann sich mit Google anmelden und bekommt einen eigenen, privaten Bereich: API-Schlüssel einfügen – Websites, Repos, Events und KI werden automatisch verknüpft. Als Gast kannst du alles 7 Tage lang ohne Konto ausprobieren."),
    h("form.login-link", { onsubmit: (e) => { e.preventDefault(); const m = linkIn.value.match(/([0-9a-f]{32})/); if (!m) return toast("Kein gültiger Gäste-Link", "err"); location.hash = `#/s/${m[1]}`; location.reload(); } },
      linkIn, h("button.btn", { type: "submit" }, "Öffnen")),
    error ? h("div.login-err", error) : null,
    h("div.login-foot", icon("lock"), "Jeder sieht nur seine eigenen Daten · Schlüssel verschlüsselt gespeichert"),
    h("div.footer-links", h("a", { href: "#/impressum" }, "Impressum"), h("a", { href: "#/datenschutz" }, "Datenschutz"), h("a", { href: "#/nutzung" }, "Nutzungsbedingungen")))));
}
function svgGoogle() {
  const s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  s.setAttribute("viewBox", "0 0 48 48"); s.setAttribute("aria-hidden", "true");
  s.innerHTML = '<path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/>';
  return s;
}

function showUpdate(worker) {
  if (document.querySelector(".update-bar")) return;
  document.body.append(h("div.update-bar", icon("refresh"), h("span", "Neue Version verfügbar"),
    h("button.btn.sm.primary", { onclick: () => worker.postMessage("skipWaiting") }, "Neu laden"),
    h("button.icon-btn", { "aria-label": "Später", onclick: (e) => e.currentTarget.parentElement.remove() }, icon("x"))));
}

// ---------------- Shell ----------------
function renderShell() {
  const nav = h("nav.nav", { "aria-label": "Hauptnavigation" });
  const pinned = h("nav.nav", { "aria-label": "Angeheftete Projekte" });
  const bellBadge = h("span.badge-dot.hidden");
  const statusPill = h("a.status-pill", { title: "Systemstatus – zur Systemprüfung", href: "#/system" }, h("span.badge.b-idle.plain", { style: { padding: 0, height: "8px", width: "8px" } }), h("span.label", "Prüfe …"));
  const app = h("div.app", { class: local.get("collapsed", false) ? "collapsed" : "" });
  const meta = user.user_metadata || {};
  const avatar = meta.avatar_url ? h("img.avatar", { src: meta.avatar_url, alt: "", referrerpolicy: "no-referrer" }) : h("div.avatar", (meta.full_name || user.email || "?")[0].toUpperCase());

  const sidebar = h("aside.sidebar",
    h("a.brand", { href: "#/" }, h("div.brand-mark", icon("logo")), h("div.brand-text", CONFIG.appName, h("small", "Control Center"))),
    nav, h("div.nav-label", "Angeheftet"), pinned,
    h("div.sidebar-foot.nav",
      h("a", { href: "#/settings", dataset: { route: "settings" } }, icon("settings"), h("span.label", "Einstellungen")),
      h("a.collapse-toggle", { href: "#", onclick: (e) => { e.preventDefault(); app.classList.toggle("collapsed"); local.set("collapsed", app.classList.contains("collapsed")); } },
        icon("sidebar"), h("span.label", "Einklappen"))));

  const topbar = h("header.topbar",
    h("button.icon-btn.menu-toggle", { "aria-label": "Menü", onclick: () => app.classList.toggle("nav-open") }, icon("menu")),
    h("div.search", { role: "button", tabindex: 0, onclick: openSearch, onkeydown: (e) => e.key === "Enter" && openSearch() }, icon("search"), h("span", "Suchen …"), h("span.kbd", navigator.platform.includes("Mac") ? "⌘K" : "Strg K")),
    h("div.spacer"), statusPill,
    h("button.icon-btn", { "aria-label": "Schnellaktionen", title: "Schnellaktionen", onclick: openQuick }, icon("zap")),
    h("button.icon-btn", { "aria-label": "KI-Assistent", title: "KI-Assistent", onclick: () => openAssistant() }, icon("bot")),
    h("button.icon-btn", { "aria-label": "Benachrichtigungen", title: "Benachrichtigungen", onclick: openNotifications }, icon("bell"), bellBadge),
    h("button.icon-btn", { "aria-label": "Profil", onclick: openProfile, style: { padding: 0 } }, avatar));

  const content = h("main.content", { id: "content", tabindex: -1 });
  const offline = h("div.banner.bad.offline-bar.hidden", icon("wifi"), h("div", "Keine Internetverbindung – angezeigte Daten können veraltet sein."));
  const bottom = h("nav.bottom-nav", { "aria-label": "Schnellnavigation" },
    MOBILE.map(([href, ic, label]) => h("a", { href, dataset: { route: href.slice(2) || "dashboard" } }, icon(ic), h("span", label))),
    h("a", { href: "#", onclick: (e) => { e.preventDefault(); app.classList.toggle("nav-open"); } }, icon("menu"), h("span", "Mehr")));
  app.append(sidebar, h("div.main", topbar, offline, content), bottom);
  const net = () => offline.classList.toggle("hidden", navigator.onLine);
  window.addEventListener("online", () => { net(); poll(); }); window.addEventListener("offline", net); net();
  app.addEventListener("click", (e) => { if (e.target === app || e.target.closest(".nav a")) app.classList.remove("nav-open"); });
  clear(root, app);
  shell = { app, nav, pinned, content, bellBadge, statusPill };

  for (const [group, items] of NAV_GROUPS) {
    nav.append(h("div.nav-label", group), ...items.map(([href, ic, label]) => h("a", { href, dataset: { route: href.slice(2) || "dashboard" } }, icon(ic), h("span.label", label), h("span.nav-badge.hidden"))));
  }
  refreshPinned();
  window.addEventListener("cc:nav-refresh", refreshPinned);
  window.addEventListener("hashchange", route);
  let gPending = 0;
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); openSearch(); return; }
    if (e.metaKey || e.ctrlKey || e.altKey || /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable || document.querySelector(".overlay")) return;
    const k = e.key.toLowerCase();
    if (Date.now() - gPending < 1200) {
      const to = { d: "#/", p: "#/projects", s: "#/servers", e: "#/events", j: "#/jopml", k: "#/ai", f: "#/files", a: "#/activity" }[k];
      gPending = 0; if (to) { e.preventDefault(); location.hash = to; } return;
    }
    if (k === "g") gPending = Date.now();
    else if (k === "/") { e.preventDefault(); openSearch(); }
    else if (k === "a") { e.preventDefault(); openAssistant(); }
    else if (k === "n") { e.preventDefault(); openQuick(); }
    else if (e.key === "?") location.hash = "#/system";
  });
  route();
  poll();
  setInterval(() => {
    if (document.visibilityState !== "visible") return;
    poll();
    // Live-Seiten still aktualisieren, solange nichts geöffnet ist
    const cur = location.hash.replace(/^#\/?/, "");
    if (["", "servers", "jopml"].includes(cur) && !document.querySelector(".overlay, .drawer") && !document.activeElement?.closest?.("input,textarea,select")) route(true);
  }, CONFIG.pollSeconds * 1000);
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && poll());
}

async function refreshPinned() {
  try {
    const list = (await projects(true)).filter((p) => p.pinned);
    const colors = { active: "var(--ok)", development: "var(--primary)", paused: "var(--warn)", error: "var(--bad)" };
    shell.pinned.replaceChildren(...(list.length ? list.map((p) => h("a", { href: `#/projects/${p.id}`, dataset: { route: `projects/${p.id}` }, title: p.name },
      h("span.dot", { style: { background: colors[p.status] || "var(--idle)" } }), h("span.label.ellipsis", p.name)))
      : [h("div.faint.label", { style: { fontSize: "12px", padding: "4px 10px" } }, "Projekte über ihre Einstellungen anheften")]));
    markActive();
  } catch { /* nicht kritisch */ }
}

function markActive() {
  const cur = location.hash.replace(/^#\/?/, "").split("?")[0];
  shell.app.querySelectorAll(".nav a[data-route], .bottom-nav a[data-route]").forEach((a) => {
    const r = a.dataset.route;
    a.classList.toggle("active", r === "dashboard" ? cur === "" : cur === r || (cur.startsWith(r + "/") && !shell.pinned.querySelector(`[data-route="${cur}"]`)));
  });
}

// ---------------- Router (Views werden erst bei Bedarf geladen) ----------------
let routeSeq = 0;
async function route(silent = false) {
  if (silent instanceof Event) silent = false;
  const seq = ++routeSeq;
  const [path, query] = location.hash.replace(/^#/, "").split("?");
  let view = null, args = [];
  for (const [re, name] of ROUTES) { const m = path.match(re); if (m) { view = name; args = m.slice(1); break; } }
  markActive();
  if (!silent) document.querySelectorAll(".overlay, .drawer").forEach((x) => x.remove());
  const c = shell.content;
  if (!view) { clear(c, h("div.empty", icon("alert"), h("div.t", "Seite nicht gefunden"), h("a.btn", { href: "#/" }, "Zum Dashboard"))); return; }
  const y = window.scrollY;
  if (!silent) c.replaceChildren(h("div", { style: { padding: "60px 0", display: "grid", placeItems: "center" } }, h("div.spinner")));
  try {
    const mod = await import(`./views/${view}.js`);
    if (seq !== routeSeq) return;
    const node = await mod.default({ args, query: new URLSearchParams(query || ""), user });
    if (seq !== routeSeq) return;
    c.replaceChildren(node);
    const t = c.querySelector("h1")?.textContent;
    document.title = t ? `${t} · ${CONFIG.appName}` : CONFIG.appName;
    if (silent) window.scrollTo(0, y); else { c.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  } catch (e) {
    if (seq !== routeSeq || silent) return;
    console.error(e);
    clear(c, h("div.empty", icon("alert"), h("div.t", "Konnte nicht geladen werden"), h("div.s", errMsg(e)), h("button.btn", { onclick: route }, icon("refresh"), "Erneut versuchen")));
  }
}

// ---------------- Systemstatus & Benachrichtigungen ----------------
async function poll() {
  try {
    const [{ count }, { data: latest }, { data: servers }] = await Promise.all([
      sb.from("cc_notifications").select("id", { count: "exact", head: true }).eq("read", false),
      sb.from("cc_notifications").select("id,title,body,level").order("id", { ascending: false }).limit(1),
      sb.from("cc_servers").select("status,last_heartbeat,kind"),
    ]);
    unread = count || 0;
    shell.bellBadge.textContent = unread > 9 ? "9+" : unread;
    shell.bellBadge.classList.toggle("hidden", !unread);
    const n = latest?.[0];
    if (n && lastNotifId !== null && n.id > lastNotifId) {
      toast(n.title, n.level === "error" ? "err" : "info");
      if (local.get("browserNotif", false) && "Notification" in window && Notification.permission === "granted" && document.visibilityState !== "visible")
        new Notification(n.title, { body: n.body || "", icon: "icons/icon-192.png" });
    }
    if (n) lastNotifId = n.id; else lastNotifId ??= 0;
    const stale = (s) => s.last_heartbeat && Date.now() - new Date(s.last_heartbeat) > 3 * 60_000;
    const total = (servers || []).length;
    const bad = (servers || []).filter((s) => s.status === "offline" || s.status === "error" || ((s.status === "online" || s.status === "warning") && stale(s))).length;
    const warn = (servers || []).filter((s) => s.status === "warning").length;
    const nb = shell.nav.querySelector('[data-route="servers"] .nav-badge');
    if (nb) { nb.textContent = bad + warn; nb.classList.toggle("hidden", !(bad + warn)); }
    const [cls, txt] = !total ? ["b-ok", "Supabase verbunden"] : bad ? ["b-bad", `${bad} Server gestört`] : warn ? ["b-warn", `${warn} Server mit Warnung`] : ["b-ok", "Alle Systeme laufen"];
    shell.statusPill.firstChild.className = `badge plain ${cls}`;
    shell.statusPill.firstChild.style.background = `var(--${cls === "b-ok" ? "ok" : cls === "b-bad" ? "bad" : "warn"})`;
    shell.statusPill.lastChild.textContent = txt;
  } catch {
    shell.statusPill.lastChild.textContent = "Keine Verbindung";
    shell.statusPill.firstChild.style.background = "var(--bad)";
  }
}

async function openNotifications() {
  document.querySelector(".drawer.notifs")?.remove();
  const body = h("div.drawer-body", h("div.skel", { style: { height: "80px", marginTop: "12px" } }));
  const dr = h("aside.drawer.notifs", { role: "dialog", "aria-label": "Benachrichtigungen" },
    h("div.modal-head", h("h3", "Benachrichtigungen"), h("div.row",
      h("button.btn.sm.ghost", { onclick: async () => { await sb.from("cc_notifications").update({ read: true }).eq("read", false); poll(); load(); } }, "Alle gelesen"),
      h("button.icon-btn", { onclick: () => dr.remove(), "aria-label": "Schließen" }, icon("x")))), body);
  document.body.append(dr);
  async function load() {
    const { data, error } = await sb.from("cc_notifications").select("*").order("created_at", { ascending: false }).limit(60);
    if (error) return body.replaceChildren(h("div.empty", h("div.s", errMsg(error))));
    if (!data.length) return body.replaceChildren(h("div.empty", icon("bell"), h("div.t", "Keine Benachrichtigungen"), h("div.s", "Hier erscheinen z. B. Server-Ausfälle, Synchronisierungen und KI-Grenzen.")));
    const col = { error: "var(--bad)", warning: "var(--warn)", success: "var(--ok)", info: "var(--accent)" };
    body.replaceChildren(...data.map((n) => h("div.notif", { class: n.read ? "" : "unread", style: { cursor: n.link ? "pointer" : "default" },
      onclick: async () => { if (!n.read) { await sb.from("cc_notifications").update({ read: true }).eq("id", n.id); poll(); } if (n.link?.startsWith("#/")) { location.hash = n.link; dr.remove(); } } },
      h("span", { style: { width: "8px", height: "8px", borderRadius: "50%", background: col[n.level], marginTop: "7px", flex: "none" } }),
      h("div", { style: { minWidth: 0 } }, h("div.n-title", n.title), n.body ? h("div.n-body", n.body) : null, h("div.n-time", fmtAgo(n.created_at))))));
  }
  load();
}

function openQuick() {
  const items = [
    ["folder", "Neues Projekt erstellen", () => newProject()], ["layers", "Neues Modul hinzufügen", () => newModule()],
    ["upload", "Datei hochladen", () => uploadDialog()], ["server", "Server verbinden", () => connectServer()],
    ["calendar", "Event erstellen", () => newEvent()], ["refresh", "Projekt synchronisieren", () => syncHelp()],
    ["bot", "KI-Assistent öffnen", () => openAssistant()],
  ];
  const m = modal("Schnellaktionen", h("div.list", items.map(([ic, t, fn]) =>
    h("button.list-item", { style: { background: "none", border: 0, borderTop: "1px solid var(--line)", textAlign: "left", cursor: "pointer", width: "100%" }, onclick: () => { m.close(); fn(); } },
      h("div.li-icon", icon(ic)), h("div.li-main", h("div.li-title", t)), icon("chevronR", "faint")))));
}

function openProfile() {
  const meta = user.user_metadata || {};
  const theme = local.get("theme", "dark");
  const setTheme = (t) => { local.set("theme", t); document.documentElement.dataset.theme = t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t; m.close(); };
  const m = modal("Profil", h("div.stack",
    h("div.row", { style: { gap: "14px" } }, meta.avatar_url ? h("img.avatar", { src: meta.avatar_url, alt: "", referrerpolicy: "no-referrer", style: { width: "48px", height: "48px" } }) : null,
      h("div", h("div", { style: { fontWeight: 600 } }, meta.full_name || "Admin"), h("div.muted", user.email), h("span.badge.b-pri", { style: { marginTop: "6px" } }, "Administrator"))),
    h("div.field", h("label", "Darstellung"), h("div.seg", [["dark", "Dunkel"], ["light", "Hell"], ["system", "System"]].map(([k, t]) => h("button", { class: theme === k ? "on" : "", onclick: () => setTheme(k) }, t)))),
    h("div.row", h("a.btn", { href: "#/settings", onclick: () => m.close() }, icon("settings"), "Einstellungen"),
      h("button.btn.danger", { onclick: async () => { await sb.auth.signOut(); location.reload(); } }, icon("logout"), "Abmelden"))));
}

// ---------------- Globale Suche (⌘K) ----------------
function openSearch() {
  if (document.querySelector(".palette")) return;
  const KIND = { project: ["folder", "Projekte"], module: ["layers", "Module"], server: ["server", "Server"], file: ["file", "Dateien"], event: ["calendar", "Events"], event_item: ["check", "Event-Einträge"], activity: ["activity", "Aktivitäten"], page: ["chevronR", "Seiten"] };
  const pages = [...NAV.map(([href, , t]) => ({ kind: "page", title: t, route: href })), { kind: "page", title: "Einstellungen", route: "#/settings" }];
  const acts = [["Teilen & Gäste", () => { location.hash = "#/shares"; }], ["Neues Event", () => newEvent()], ["Neues Projekt", () => newProject()], ["KI-Assistent", () => openAssistant()], ["Server verbinden", () => connectServer()], ["Datei hochladen", () => uploadDialog()]]
    .map(([t, run]) => ({ kind: "page", title: `Aktion: ${t}`, run }));
  const inp = h("input.input", { placeholder: "Projekte, Server, Dateien, Events … durchsuchen", "aria-label": "Suche", autocomplete: "off" });
  const res = h("div.results");
  let items = [], sel = 0;
  const ov = h("div.overlay", { onmousedown: (e) => e.target === ov && ov.remove() }, h("div.modal.palette", { role: "dialog", "aria-label": "Suche" }, inp, res));
  const draw = () => {
    res.replaceChildren();
    if (!items.length) { res.append(h("div.empty", { style: { padding: "22px" } }, h("div.s", inp.value.trim().length < 2 ? "Mindestens 2 Zeichen eingeben" : "Keine Treffer"))); return; }
    let lastKind = null;
    items.forEach((it, i) => {
      if (it.kind !== lastKind) { res.append(h("div.group", KIND[it.kind]?.[1] || it.kind)); lastKind = it.kind; }
      res.append(h("div.res", { class: i === sel ? "on" : "", onclick: () => pick(i), onmousemove: () => { if (sel !== i) { sel = i; draw(); } } },
        h("div.li-icon", { style: { width: "30px", height: "30px" } }, icon(KIND[it.kind]?.[0] || "box")),
        h("div.li-main", h("div.li-title", it.title), it.subtitle ? h("div.li-sub", it.subtitle) : null)));
    });
    res.querySelector(".res.on")?.scrollIntoView({ block: "nearest" });
  };
  const pick = (i) => { const it = items[i]; if (!it) return; ov.remove(); if (it.run) it.run(); else location.hash = it.route; };
  const search = debounce(async () => {
    const qtxt = inp.value.trim();
    const pg = [...pages, ...acts].filter((p) => p.title.toLowerCase().includes(qtxt.toLowerCase()));
    if (qtxt.length < 2) { items = qtxt ? pg : pages; sel = 0; draw(); return; }
    try { items = [...pg, ...(await rpc("cc_search", { q: qtxt }))]; } catch (e) { items = pg; toastErr(e); }
    sel = 0; draw();
  }, 180);
  inp.addEventListener("input", search);
  inp.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(items.length - 1, sel + 1); draw(); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); }
    else if (e.key === "Enter") { e.preventDefault(); pick(sel); }
    else if (e.key === "Escape") ov.remove();
  });
  document.body.append(ov); items = pages; draw(); inp.focus();
}

boot().catch((e) => { console.error(e); renderLogin(errMsg(e)); });
