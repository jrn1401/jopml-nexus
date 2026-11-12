// Gemeinsame Aktionen (Schnellaktionen, Dashboard, Seiten): Projekt, Modul, Server, Event, Upload, Assistent.
import { openAiDrawer } from "./assistant.js";
import { sb, q, rpc, api, projects, invalidateProjects, uploadFile, MAX_UPLOAD, isSecretFile, local } from "./api.js";
import { h, icon, modal, formModal, toast, toastErr, copyText, CATEGORIES, PROJECT_STATUS, EVENT_STATUS, meter, fmtBytes, errMsg, md } from "./ui.js";
import { MODULE_TYPES } from "./modules.js";
import { CONFIG } from "../config.js";

const go = (hash) => { location.hash = hash; };
const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "projekt";

export function newProject(prefill = {}) {
  formModal("Neues Projekt", [
    { name: "name", label: "Name", required: true, value: prefill.name, max: 120 },
    { name: "category", label: "Kategorie", type: "select", half: true, value: prefill.category || "software", options: Object.entries(CATEGORIES).map(([k, v]) => [k, v[0]]) },
    { name: "status", label: "Status", type: "select", half: true, value: "active", options: Object.entries(PROJECT_STATUS).map(([k, v]) => [k, v[0]]) },
    { name: "description", label: "Beschreibung", type: "textarea", max: 4000 },
    { name: "tags", label: "Tags", hint: "Durch Komma getrennt", max: 300 },
    { name: "pinned", label: "In der Seitenleiste anheften", type: "checkbox" },
  ], async (v) => {
    const r = await rpc("cc_project_upsert", { p: {
      slug: await uniqueSlug(slugify(v.name)), name: v.name, category: v.category, status: v.status, description: v.description,
      tags: v.tags ? v.tags.split(",").map((t) => t.trim()).filter(Boolean).slice(0, 20) : [], pinned: v.pinned,
      modules: [{ name: "Übersicht", module_type: "dashboard", config: { widgets: [{ type: "summary" }, { type: "files" }, { type: "activity" }] } }],
    } });
    invalidateProjects(); toast("Projekt erstellt"); window.dispatchEvent(new Event("cc:nav-refresh"));
    go(`#/projects/${r.project_id}`);
  }, { submit: "Projekt erstellen" });
}
async function uniqueSlug(base) {
  const list = await projects(true);
  let s = base, i = 2;
  while (list.some((p) => p.slug === s)) s = `${base}-${i++}`;
  return s;
}

export async function newModule(projectId) {
  const list = await projects();
  if (!list.length) return toast("Lege zuerst ein Projekt an.", "info");
  const typeOpts = Object.entries(MODULE_TYPES).filter(([, d]) => d.creatable !== false).map(([k, d]) => [k, d.label]);
  formModal("Modul hinzufügen", [
    { name: "project", label: "Projekt", type: "select", value: projectId, options: list.map((p) => [p.id, p.name]) },
    { name: "module_type", label: "Modultyp", type: "select", options: typeOpts, half: true },
    { name: "name", label: "Name", required: true, max: 80, half: true },
    { name: "config", label: "Konfiguration (optional)", type: "textarea", rows: 3,
      hint: "Roblox: universe_id oder place_id · Links: eine URL pro Zeile · Server: Servername · Notizen: Text", full: true, max: 4000 },
  ], async (v) => {
    const config = MODULE_TYPES[v.module_type].parseConfig?.(v.config) ?? {};
    const { error } = await sb.from("cc_modules").insert({ project_id: v.project, module_type: v.module_type, name: v.name, config });
    if (error) throw new Error(error.code === "23505" ? "Ein Modul mit diesem Namen gibt es in dem Projekt schon." : error.message);
    toast("Modul hinzugefügt");
    if (location.hash === `#/projects/${v.project}`) window.dispatchEvent(new Event("hashchange")); else go(`#/projects/${v.project}`);
  }, { submit: "Hinzufügen" });
}

export async function connectServer() {
  const list = await projects();
  formModal("Server verbinden", [
    { name: "name", label: "Servername", required: true, max: 80, placeholder: "z. B. jopml-prod" },
    { name: "project", label: "Projekt zuordnen (optional)", type: "select", options: [["", "– keins –"], ...list.map((p) => [p.id, p.name])] },
  ], async (v) => {
    const r = await rpc("cc_register_server", { p_name: v.name, p_project: v.project || null });
    showAgentInstall(r.server_id, r.token, v.name);
  }, { submit: "Server anlegen" });
}
export function showAgentInstall(serverId, token, name) {
  const url = `${CONFIG.supabaseUrl}/functions/v1/cc-api`;
  const site = location.origin + location.pathname.replace(/[^/]*$/, "");
  const linuxDl = `curl -fsSLO ${site}agent/cc_agent.py && curl -fsSLO "${site}agent/cc-agent-host@.service"`;
  const linux = `sudo mkdir -p /opt/cc-agent && sudo cp cc_agent.py /opt/cc-agent/\nsudo tee /etc/cc-agent.env >/dev/null <<'EOF'\nCC_API_URL=${url}\nCC_AGENT_KEY=${token}\nCC_HOSTING=1\nCC_FILES=1\n# CC_FILES_WRITE=1      # Dateien von der Website aufs Gerät legen\n# CC_ALLOW_COMMANDS=1   # nur wenn eigene Befehle/Docker erlaubt sein sollen\nEOF\nsudo chmod 600 /etc/cc-agent.env\nsudo cp "cc-agent-host@.service" /etc/systemd/system/ && sudo systemctl daemon-reload\nsudo systemctl enable --now "cc-agent-host@$USER"`;
  const win = `# PowerShell (als normaler Nutzer). Voraussetzung: Python 3 (python.org)\nmkdir $HOME\\cc-agent -Force | Out-Null; cd $HOME\\cc-agent\nInvoke-WebRequest ${site}agent/cc_agent.py -OutFile cc_agent.py\npython -m pip install --user psutil\n$env:CC_API_URL="${url}"; $env:CC_AGENT_KEY="${token}"; $env:CC_HOSTING="1"; $env:CC_FILES="1"\npython cc_agent.py`;
  const winAuto = `# Optional: bei jeder Anmeldung automatisch im Hintergrund starten\nsetx CC_API_URL "${url}"; setx CC_AGENT_KEY "${token}"; setx CC_HOSTING "1"; setx CC_FILES "1"\nschtasks /Create /SC ONLOGON /TN "JOPML Nexus Agent" /TR "pythonw.exe $HOME\\cc-agent\\cc_agent.py" /F`;
  const extras = `# Öffentliche Links ohne Router-Freigabe: cloudflared installieren\n#   Windows:  winget install --id Cloudflare.cloudflared\n#   Linux:    https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/\n# Eigene Startbefehle und Docker erlauben (nur auf eigenen Geräten):\n#   Windows:  setx CC_ALLOW_COMMANDS "1"   ·   Linux: CC_ALLOW_COMMANDS=1 in /etc/cc-agent.env\n# Dateien von der Website aufs Gerät legen:  CC_FILES_WRITE=1   ·   nur bestimmte Ordner zeigen:  CC_FILE_ROOTS=/home/pi/daten\n# Fester Link statt wechselndem (eigener Cloudflare-Tunnel):  CC_TUNNEL_TOKEN=<Token aus dem Cloudflare-Konto>\n# Danach den Agenten neu starten.`;
  const block = (t, txt) => h("div.field", h("div.row.between", h("label", t), h("button.btn.sm.ghost", { onclick: () => copyText(txt) }, icon("copy"), "Kopieren")),
    h("pre.mono", { style: { margin: 0, padding: "12px", background: "var(--bg-2)", border: "1px solid var(--line)", borderRadius: "10px", overflowX: "auto", fontSize: "12px", whiteSpace: "pre" } }, txt));
  modal(`Agent für „${name}“ installieren`, h("div.stack",
    h("div.na-note", icon("key"), h("div", "Dieser Schlüssel wird nur jetzt angezeigt und ist nur in der Datenbank als Hash gespeichert. Er darf ausschließlich Messwerte und Hosting-Zustand für dieses eine Gerät senden.")),
    block("Agent-Schlüssel", token),
    block("Windows (PowerShell)", win), block("Windows: Autostart (optional)", winAuto), block("Linux: Dateien laden", linuxDl), block("Linux (systemd, mit Hosting)", linux),
    block("Optional: öffentliche Links und eigene Befehle", extras),
    h("p.faint", { style: { margin: 0, fontSize: "12.5px" } }, "Benötigt Python 3.8+ (psutil empfohlen). Sobald der erste Heartbeat ankommt, wechselt der Status auf „Online“. Auf der Geräteseite legst du unter „Hosting“ Apps an.")),
    { wide: true, foot: [h("button.btn.primary", { onclick: () => { document.querySelector(".overlay")?.remove(); go(`#/servers/${serverId}`); } }, "Zum Gerät")] });
}

export function newEvent(prefill = {}) {
  projects().then((list) => formModal("Neues Event", [
    { name: "name", label: "Eventname", required: true, max: 120, value: prefill.name },
    { name: "event_date", label: "Datum & Uhrzeit", type: "datetime-local", half: true },
    { name: "location", label: "Location", half: true, max: 160 },
    { name: "budget", label: "Budget (€)", type: "number", step: "0.01", min: 0, half: true },
    { name: "expected_guests", label: "Erwartete Gäste", type: "number", min: 0, half: true },
    { name: "status", label: "Status", type: "select", value: "planning", options: Object.entries(EVENT_STATUS).map(([k, v]) => [k, v[0]]), half: true },
    { name: "project_id", label: "Projekt", type: "select", half: true, options: [["", "– keins –"], ...list.map((p) => [p.id, p.name])] },
    { name: "description", label: "Beschreibung", type: "textarea" },
  ], async (v) => {
    const row = { name: v.name, location: v.location, status: v.status, description: v.description,
      event_date: v.event_date ? new Date(v.event_date).toISOString() : null, budget: v.budget === "" ? null : Number(v.budget),
      expected_guests: v.expected_guests === "" ? null : parseInt(v.expected_guests, 10), project_id: v.project_id || null };
    const d = await q(sb.from("cc_events").insert(row).select("id").single());
    toast("Event erstellt"); go(`#/events/${d.id}`);
  }, { submit: "Event erstellen" }));
}

// Upload-Dialog mit Drag & Drop, Fortschritt und Projektzuordnung
export async function uploadDialog({ projectId, moduleId = null, onDone } = {}) {
  const list = await projects();
  if (!list.length) return toast("Lege zuerst ein Projekt an.", "info");
  const sel = h("select.input", list.map((p) => h("option", { value: p.id, selected: p.id === projectId }, p.name)));
  const prefix = h("input.input", { placeholder: "Unterordner (optional), z. B. docs", maxlength: 200 });
  const rows = h("div");
  const fileIn = h("input", { type: "file", multiple: true, hidden: true, onchange: () => run([...fileIn.files]) });
  const drop = h("div.drop", { tabindex: 0, role: "button", onclick: () => fileIn.click(), onkeydown: (e) => (e.key === "Enter" || e.key === " ") && fileIn.click(),
    ondragover: (e) => { e.preventDefault(); drop.classList.add("over"); }, ondragleave: () => drop.classList.remove("over"),
    ondrop: (e) => { e.preventDefault(); drop.classList.remove("over"); run([...e.dataTransfer.files]); } },
    icon("upload"), h("div", h("strong", "Dateien hierher ziehen"), " oder tippen zum Auswählen"), h("div.faint", { style: { fontSize: "12px", marginTop: "4px" } }, `max. ${fmtBytes(MAX_UPLOAD)} pro Datei · identische Inhalte werden nur einmal gespeichert`));
  let busy = false, ok = 0;
  async function run(files) {
    if (busy || !files.length) return; busy = true;
    const pre = prefix.value.trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "").replace(/\.\.+/g, "");
    for (const f of files) {
      const bar = meter(0), st = h("span.faint", { style: { fontSize: "12px" } }, "Wartet …");
      rows.append(h("div.up-row", h("span.ellipsis", f.name), st, bar));
      if (isSecretFile(f.name)) { st.textContent = "Abgelehnt: Zugangsdaten"; st.style.color = "var(--bad)"; continue; }
      try {
        const r = await uploadFile(f, { projectId: sel.value, moduleId, relPath: pre ? `${pre}/${f.name}` : f.name,
          onProgress: (p, t) => { bar.firstChild.style.width = Math.round(p * 100) + "%"; st.textContent = t; } });
        st.textContent = r.state === "unchanged" ? "Unverändert" : r.state === "changed" ? `Neue Version v${r.version}` : "Hochgeladen";
        bar.className = "meter ok"; ok++;
      } catch (e) { st.textContent = errMsg(e); st.style.color = "var(--bad)"; bar.className = "meter bad"; }
    }
    busy = false;
    if (ok) {
      const p = list.find((x) => x.id === sel.value);
      await sb.from("cc_activities").insert({ project_id: sel.value, kind: "file_upload", description: `${files.length} Datei(en) hochgeladen in ${p?.name ?? "Projekt"}` });
      onDone?.();
    }
  }
  modal("Dateien hochladen", h("div.stack", h("div.form", h("div.two", h("div.field", h("label", "Projekt"), sel), h("div.field", h("label", "Ordner"), prefix))), drop, fileIn, rows), { wide: true });
}

// KI-Assistent (lernt, recherchiert im Web, verbindet Schlüssel) – gemeinsame Oberfläche in lib/assistant.js
export function openAssistant(projectId = null) {
  openAiDrawer({ projectId, admin: true, storeKey: `chat:${projectId || "all"}` });
}

// Datei im Browser erzeugen und herunterladen (CSV, ICS, JSON)
export function download(name, content, type = "text/plain") {
  const url = URL.createObjectURL(new Blob([content], { type: `${type};charset=utf-8` }));
  const a = h("a", { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function syncHelp(slug) {
  modal("Projekt synchronisieren", h("div.stack",
    h("p", { style: { margin: 0 } }, "Projektdateien werden über den Claude-Skill „jopml-project-integrator“ abgeglichen. Er lädt nur geänderte Dateien hoch (SHA-256) und fragt vor jedem Löschen nach."),
    h("div.field", h("label", "In Claude sagen:"), h("pre.mono", { style: { margin: 0, padding: "12px", background: "var(--bg-2)", borderRadius: "10px", border: "1px solid var(--line)", whiteSpace: "pre-wrap" } },
      slug ? `Synchronisiere das Projekt „${slug}“ mit meinem JOPML Control Center.` : "Integriere dieses Projekt in mein JOPML Control Center.")),
    h("p.faint", { style: { margin: 0, fontSize: "12.5px" } }, "Oder per Kommandozeile: python scripts/integrate.py <Ordner> --slug <slug>")));
}
