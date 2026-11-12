// Hosting auf eigenen Geräten: Apps (statische Seiten, Projektdateien, Git, Befehle, Docker) anlegen, starten, stoppen.
// Der Nexus-Agent auf dem Gerät gleicht alle paar Sekunden mit nx-host ab und meldet Zustand, Adressen und Log zurück.
import { sb, q, rpc, projects } from "./api.js";
import { h, icon, fmtAgo, modal, formModal, confirmDialog, toast, toastErr, copyText, naNote } from "./ui.js";

export const KINDS = {
  static: ["Ordner auf dem Gerät", "folder", "Eine fertige Website (HTML/CSS/JS) aus einem Ordner ausliefern."],
  nexus: ["Projektdateien aus dem Nexus", "layers", "Die im Nexus hochgeladenen Dateien eines Projekts auf das Gerät laden und ausliefern."],
  git: ["Git-Repository", "code", "Ein Repo klonen und als statische Seite ausliefern – oder mit Startbefehl als App betreiben."],
  command: ["Eigener Startbefehl", "terminal", "Beliebige App starten (Node, Python, Minecraft …). Muss auf dem Gerät freigeschaltet sein."],
  docker: ["Docker-Container", "server", "Ein Docker-Image starten. Muss auf dem Gerät freigeschaltet sein."],
};
export const APP_STATE = {
  pending: ["Wird übertragen …", "b-warn"], starting: ["Startet …", "b-warn"], running: ["Läuft", "b-ok"],
  stopped: ["Gestoppt", "b-idle"], error: ["Fehler", "b-bad"], unsupported: ["Nicht freigeschaltet", "b-bad"],
};
// 1-Klick-Vorlagen: füllen das Formular vor. Befehle/Docker brauchen die Freigabe auf dem Gerät.
export const TEMPLATES = [
  ["Website aus Ordner", "folder", "Fertige HTML-Seite aus einem Ordner", { kind: "static", name: "Meine Website", port: 8080, bind: "lan" }],
  ["Raveanation-Website", "globe", "Projektdateien aus dem Nexus ausliefern", { kind: "nexus", name: "Raveanation-Website", port: 8080, bind: "lan", public: true }],
  ["Website aus GitHub", "code", "Repo klonen, automatisch aktuell halten", { kind: "git", name: "GitHub-Seite", port: 8081, config: { auto_update: 15 } }],
  ["Minecraft-Server", "game", "Java-Server per Docker (Port 25565)", { kind: "docker", name: "Minecraft", port: 25565, bind: "lan", config: { image: "itzg/minecraft-server", container_port: 25565, env: "EULA=TRUE" } }],
  ["Node-App", "terminal", "npm start im App-Ordner", { kind: "command", name: "Node-App", port: 3000, config: { cmd: "npm start" } }],
  ["Python-App", "terminal", "python app.py im App-Ordner", { kind: "command", name: "Python-App", port: 5000, config: { cmd: "python3 app.py" } }],
  ["Datei-Ablage (Nginx)", "server", "Statischer Webserver per Docker", { kind: "docker", name: "Nginx", port: 8088, config: { image: "nginx:alpine", container_port: 80 } }],
  ["Uptime Kuma", "activity", "Eigene Überwachungs-Oberfläche per Docker", { kind: "docker", name: "Uptime Kuma", port: 3001, bind: "lan", config: { image: "louislam/uptime-kuma:1", container_port: 3001 } }],
];
const live = (s) => s && (s.status === "online" || s.status === "warning");

// ------------------------------------------------------------------ Dialoge
export async function appDialog(server, app = null, onDone = () => {}) {
  if (!app) {
    const m = modal("Was soll auf dem Gerät laufen?", h("div.stack", h("h4.sub-h", { style: { margin: 0 } }, "Vorlagen – 1 Klick"),
      h("div.host-kinds", TEMPLATES.map(([t, ic, d, preset]) => h("button.host-kind", { type: "button", onclick: () => { m.close(); appForm(server, preset, onDone); } },
        h("div.li-icon", icon(ic)), h("div", h("div.li-title", t), h("div.li-sub", d))))),
      h("h4.sub-h", { style: { margin: "6px 0 0" } }, "Selbst einrichten"), h("div.host-kinds", Object.entries(KINDS).map(([k, [t, ic, d]]) => {
      const blocked = (k === "command" || k === "docker") && server.metadata?.hosting && !server.metadata.hosting.commands;
      return h("button.host-kind", { type: "button", onclick: () => { m.close(); appForm(server, { kind: k }, onDone); } },
        h("div.li-icon", icon(ic)), h("div", h("div.li-title", t), h("div.li-sub", d),
          blocked ? h("div.li-sub", { style: { color: "var(--warn)" } }, "Auf diesem Gerät noch nicht freigeschaltet (CC_ALLOW_COMMANDS=1)") : null));
    }))), { wide: true });
    return;
  }
  appForm(server, app, onDone);
}

async function appForm(server, app, onDone) {
  const kind = app.kind, c = app.config || {}, edit = !!app.id;
  const list = kind === "nexus" ? await projects() : [];
  const used = (await q(sb.from("cc_host_apps").select("port").eq("server_id", server.id))).map((x) => x.port);
  let port = app.port || 8080; while (!edit && used.includes(port)) port++;
  const f = [{ name: "name", label: "Name", required: true, max: 60, value: app.name || "", placeholder: "z. B. Raveanation-Website" }];
  if (kind === "static") f.push({ name: "path", label: "Ordner auf dem Gerät", required: true, max: 400, value: c.path || "", placeholder: server.os?.startsWith("Windows") ? "C:\\Users\\…\\website" : "/home/…/website", hint: "Muss index.html enthalten. Versteckte Dateien (.env, .git) und Schlüssel werden nie ausgeliefert." });
  if (kind === "nexus") f.push({ name: "project_id", label: "Projekt", type: "select", value: app.project_id || "", options: list.map((p) => [p.id, p.name]) },
    { name: "root", label: "Unterordner (optional)", max: 200, value: c.root || "", placeholder: "z. B. dist oder website", hint: "Nur Dateien aus diesem Ordner des Projekts. Bei Änderungen „Neu starten“ – geänderte Dateien werden nachgeladen." });
  if (kind === "git") f.push({ name: "repo", label: "Repository (https)", required: true, max: 300, value: c.repo || "", placeholder: "https://github.com/jrn1401/…" },
    { name: "branch", label: "Branch (optional)", max: 100, value: c.branch || "", half: true }, { name: "subdir", label: "Ordner mit der Website (optional)", max: 200, value: c.subdir || "", half: true, placeholder: "z. B. dist" },
    { name: "install", label: "Installationsbefehl (optional)", max: 300, value: c.install || "", placeholder: "npm ci", half: true }, { name: "cmd", label: "Startbefehl (optional)", max: 300, value: c.cmd || "", placeholder: "npm start", half: true,
      hint: "Leer = statische Seite. Mit Befehl muss die App auf $PORT hören; nur wenn auf dem Gerät freigeschaltet." },
    { name: "auto_update", label: "Automatisch aktualisieren (alle … Minuten, leer = aus)", type: "number", min: 5, value: c.auto_update ?? "", hint: "Prüft regelmäßig, ob es im Repo etwas Neues gibt, und startet dann neu." });
  if (kind === "command") f.push({ name: "cmd", label: "Startbefehl", required: true, max: 400, value: c.cmd || "", placeholder: "node server.js", hint: "Die App bekommt PORT und HOST als Umgebungsvariablen." },
    { name: "cwd", label: "Arbeitsordner", max: 400, value: c.cwd || "", placeholder: "/home/…/meine-app" });
  if (kind === "docker") f.push({ name: "image", label: "Image", required: true, max: 200, value: c.image || "", placeholder: "nginx:alpine", half: true },
    { name: "container_port", label: "Port im Container", type: "number", value: c.container_port || 80, min: 1, half: true });
  f.push({ name: "port", label: "Port auf dem Gerät", type: "number", value: port, min: 1024, required: true, half: true },
    { name: "bind", label: "Erreichbar", type: "select", value: app.bind || "local", half: true, options: [["local", "Nur auf dem Gerät"], ["lan", "Im ganzen WLAN/Netzwerk"]] },
    { name: "public", label: "Öffentlicher Link fürs Internet (Cloudflare, ohne Router-Einstellungen)", type: "checkbox", value: !!app.public },
    { name: "public_host", label: "Feste Adresse (optional)", max: 120, value: c.public_host || "", placeholder: "party.meine-domain.de", hint: "Nur mit eigenem Cloudflare-Tunnel auf dem Gerät (CC_TUNNEL_TOKEN). Leer = kostenloser Link, der sich bei jedem Neustart ändert." },
    ...(kind === "nexus" || kind === "docker" ? [] : [{ name: "backup", label: "Täglich als ZIP auf dem Gerät sichern (die letzten 5 bleiben)", type: "checkbox", value: !!c.backup }]),
    { name: "autostart", label: "Nach Neustart des Geräts automatisch starten", type: "checkbox", value: app.autostart ?? true });

  formModal(edit ? `„${app.name}“ bearbeiten` : `Neue App: ${KINDS[kind][0]}`, f, async (v) => {
    const pn = parseInt(v.port, 10);
    if (!(pn >= 1024 && pn <= 65535)) throw new Error("Port muss zwischen 1024 und 65535 liegen.");
    const config = {};
    for (const k of ["path", "root", "repo", "branch", "subdir", "install", "cmd", "cwd", "image", "public_host"]) if (v[k]) config[k] = v[k];
    if (v.auto_update) config.auto_update = Math.max(5, parseInt(v.auto_update, 10) || 0);
    if (v.backup) config.backup = true;
    if (c.env) config.env = c.env;
    if (config.public_host && !/^[a-z0-9.-]{4,120}$/i.test(config.public_host)) throw new Error("Feste Adresse: nur der Name, z. B. party.meine-domain.de (ohne https://).");
    if (kind === "docker") config.container_port = parseInt(v.container_port, 10) || 80;
    if (kind === "git" && config.repo && !/^https:\/\/[\w.-]+\/[\w./~-]+$/.test(config.repo)) throw new Error("Bitte eine https-Adresse des Repos angeben.");
    const row = { name: v.name, kind, config, port: pn, bind: v.bind, public: v.public, autostart: v.autostart, project_id: kind === "nexus" ? v.project_id || null : app.project_id ?? server.project_id ?? null };
    const { error } = edit ? await sb.from("cc_host_apps").update(row).eq("id", app.id) : await sb.from("cc_host_apps").insert({ ...row, server_id: server.id });
    if (error) throw new Error(/cc_host_apps_server_id_port/.test(error.message) ? `Port ${pn} ist auf diesem Gerät schon vergeben.` : /server_id_name/.test(error.message) ? "Eine App mit diesem Namen gibt es auf dem Gerät schon." : error.message);
    toast(edit ? "Gespeichert – das Gerät übernimmt die Änderung in wenigen Sekunden" : "Angelegt – das Gerät startet die App in wenigen Sekunden");
    onDone();
  }, { submit: edit ? "Speichern" : "Hosten", wide: true });
}

function logDialog(app) {
  const pre = h("pre.mono.host-log", app.log || "Noch keine Ausgaben.");
  const m = modal(`Log: ${app.name}`, pre, { wide: true, foot: [h("button.btn", { onclick: () => copyText(app.log || "") }, icon("copy"), "Kopieren")] });
  const t = setInterval(async () => {
    if (!pre.isConnected) return clearInterval(t);
    const { data } = await sb.from("cc_host_apps").select("log").eq("id", app.id).maybeSingle();
    if (data) { pre.textContent = data.log || "Noch keine Ausgaben."; pre.scrollTop = pre.scrollHeight; }
  }, 4000);
  setTimeout(() => { pre.scrollTop = pre.scrollHeight; });
  return m;
}

// ------------------------------------------------------------------ Darstellung
function appRow(app, server, redraw) {
  const st = app.state === "running" && !live(server) ? ["Gerät offline", "b-bad"] : APP_STATE[app.state] || [app.state, "b-idle"];
  const act = (a) => async (e) => { e.currentTarget.disabled = true; try { await rpc("cc_host_action", { p_app: app.id, p_action: a }); toast(a === "stop" ? "Wird gestoppt …" : "Wird gestartet …"); redraw(); } catch (er) { toastErr(er); } };
  const link = (u, t) => u ? h("a.host-url", { href: u, target: "_blank", rel: "noopener" }, icon("external"), t) : null;
  const running = app.desired === "running";
  return h("div.host-app",
    h("div.row", { style: { gap: "10px", minWidth: 0 } }, h("div.li-icon", icon(KINDS[app.kind]?.[1] || "server")),
      h("div", { style: { minWidth: 0, flex: 1 } },
        h("div.row.wrap", { style: { gap: "8px" } }, h("strong", app.name), h("span.badge", { class: st[1] }, st[0]), h("span.faint", { style: { fontSize: "12px" } }, `${KINDS[app.kind]?.[0] || app.kind} · Port ${app.port}`)),
        h("div.row.wrap", { style: { gap: "10px", marginTop: "4px" } },
          link(app.public_url, app.public_url?.replace(/^https:\/\//, "")), link(app.lan_url, `Netzwerk ${app.lan_url?.replace(/^http:\/\//, "")}`),
          app.local_url ? h("span.faint.mono", { style: { fontSize: "12px" } }, app.local_url) : null,
          app.public && !app.public_url && app.state === "running" ? h("span.faint", { style: { fontSize: "12px" } }, "öffentlicher Link wird eingerichtet …") : null,
          app.last_report ? h("span.faint", { style: { fontSize: "11.5px" } }, `Meldung ${fmtAgo(app.last_report)}`) : h("span.faint", { style: { fontSize: "11.5px" } }, "Gerät hat die App noch nicht gemeldet")),
        app.error ? h("div.sync-err", app.error) : null)),
    h("div.row.wrap.host-actions",
      running ? h("button.btn.sm", { onclick: act("stop") }, icon("stop"), "Stoppen") : h("button.btn.sm.primary", { onclick: act("start") }, icon("play"), "Starten"),
      h("button.btn.sm", { onclick: act("restart"), title: "Neu starten (lädt geänderte Dateien/Git-Stand nach)" }, icon("refresh")),
      h("button.btn.sm", { onclick: () => logDialog(app), title: "Log" }, icon("terminal")),
      h("button.btn.sm", { onclick: () => appDialog(server, app, redraw), title: "Bearbeiten" }, icon("edit")),
      h("button.btn.sm.ghost", { title: "Entfernen", onclick: async () => {
        if (!(await confirmDialog("App entfernen?", `„${app.name}“ wird auf dem Gerät gestoppt und aus dem Nexus entfernt. Dateien auf dem Gerät bleiben erhalten.`, { ok: "Entfernen" }))) return;
        try { await q(sb.from("cc_host_apps").delete().eq("id", app.id)); toast("Entfernt"); redraw(); } catch (er) { toastErr(er); }
      } }, icon("trash"))));
}

export function capsLine(server) {
  const c = server.metadata?.hosting;
  if (!c) return null;
  const yes = (b, t) => h("span.tag", { class: b ? "" : "faint" }, `${b ? "✓" : "✗"} ${t}`);
  return h("div.row.wrap", { style: { gap: "6px" } }, h("span.tag", `Agent ${c.version || "?"}`), yes(true, "Statische Seiten"), yes(c.commands, "Befehle"), yes(c.docker, "Docker"), yes(c.git, "Git"), yes(c.cloudflared, "Öffentliche Links"),
    c.lan_ip ? h("span.tag", `Netzwerk ${c.lan_ip}`) : null);
}

// Panel für die Geräteseite (#/servers/<id>)
export function hostingPanel(server) {
  const body = h("div.card-body", h("div.skel", { style: { height: "80px" } }));
  const card = h("section.card.host-panel", h("div.card-head", h("h3", "Hosting"), h("span.sub", "Apps auf diesem Gerät betreiben"),
    h("button.btn.sm.primary", { style: { marginLeft: "auto" }, onclick: () => appDialog(server, null, draw) }, icon("plus"), "App hosten")), body);
  async function draw() {
    let apps;
    try { apps = await q(sb.from("cc_host_apps").select("*").eq("server_id", server.id).order("created_at")); } catch (e) { body.replaceChildren(naNote(e.message, "alert")); return; }
    const fresh = await q(sb.from("cc_servers").select("status,metadata,last_heartbeat").eq("id", server.id).maybeSingle()).catch(() => null);
    if (fresh) Object.assign(server, fresh);
    const active = !!server.metadata?.hosting && server.metadata.hosting.hosting !== false && Date.now() - Date.parse(server.metadata.hosting_seen || 0) < 10 * 60_000;
    body.replaceChildren(
      !active ? h("div.na-note", icon("info"), h("div", h("strong", "Hosting auf diesem Gerät noch nicht aktiv. "),
        "Agent ab Version 2.0 mit CC_HOSTING=1 starten – die fertigen Befehle zeigt „Neuer Agent-Schlüssel“ auf der ", h("a", { href: `#/servers/${server.id}` }, "Geräteseite"), ". Apps kannst du schon anlegen; sie starten, sobald das Gerät sich meldet.")) : capsLine(server),
      apps.length ? h("div.host-list", apps.map((a) => appRow(a, server, draw))) : h("div.faint", { style: { fontSize: "13px", marginTop: "10px" } }, "Noch keine Apps. Mit „App hosten“ eine Website-Ordner, Projektdateien, ein Git-Repo oder eine eigene App starten."));
  }
  draw();
  const t = setInterval(() => { if (!card.isConnected) return clearInterval(t); draw(); }, 5000);
  return card;
}
