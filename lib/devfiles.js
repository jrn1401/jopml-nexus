// Geräte-Cloud: Live-Daten (Temperatur, Laufwerke, Prozesse) und Dateien eines verbundenen Geräts auf der Website.
// Die Website stellt eine Anfrage in die Datenbank, der Agent auf dem Gerät holt sie ab und antwortet (meist in 2–5 Sekunden).
import { sb, q, MAX_UPLOAD, isSecretFile } from "./api.js";
import { h, icon, clear, fmtBytes, fmtAgo, fmtDuration, meter, toast, toastErr, naNote, formModal } from "./ui.js";

async function ask(server, kind, path, args = {}) {
  const row = await q(sb.from("cc_device_requests").insert({ server_id: server.id, kind, path, args }).select("id").single());
  for (let i = 0; i < 90; i++) {
    await new Promise((r) => setTimeout(r, i < 10 ? 700 : 1500));
    const r = await q(sb.from("cc_device_requests").select("status,result,error").eq("id", row.id).single());
    if (r.status === "done") return r.result;
    if (r.status === "error") throw new Error(r.error || "Das Gerät meldet einen Fehler.");
  }
  throw new Error("Das Gerät hat nicht geantwortet. Läuft der Agent und ist das Gerät online?");
}

export function deviceLive(server) {
  const d = server.metadata?.device;
  if (!d) return null;
  const fresh = Date.now() - Date.parse(server.metadata.device_seen || 0) < 3 * 60_000;
  const kv = (k, v) => v === undefined || v === null || v === "" ? null : h("div.dkv", h("span", k), h("b", v));
  return h("section.card", h("div.card-head", h("h3.row", icon("cpu"), "Gerät live"), h("span.sub", fresh ? `Stand ${fmtAgo(server.metadata.device_seen)}` : "Gerät meldet sich gerade nicht")),
    h("div.card-body", h("div.grid.g-2", { style: { alignItems: "start", gap: "18px" } },
      h("div.stack", { style: { gap: "6px" } },
        kv("Modell", d.model), kv("Name im Netzwerk", d.hostname), kv("Adresse im Netzwerk", d.ip),
        d.temp !== undefined ? h("div.dkv", h("span", "Temperatur"), h("b", { style: { color: d.temp >= 80 ? "var(--bad)" : d.temp >= 70 ? "var(--warn)" : "" } }, `${String(d.temp).replace(".", ",")} °C`)) : null,
        kv("Auslastung (1/5/15 Min.)", d.load ? d.load.map((x) => String(x).replace(".", ",")).join(" · ") : null),
        kv("Läuft seit", d.boot ? fmtDuration(Date.now() / 1000 - d.boot) : null),
        kv("Daten gesendet / empfangen", d.net ? `${fmtBytes(d.net.sent)} / ${fmtBytes(d.net.recv)}` : null),
        kv("Akku", d.battery ? `${d.battery.percent} %${d.battery.plugged ? " (am Strom)" : ""}` : null),
        kv("Prozesse", d.proc_count), kv("Agent", d.version)),
      h("div.stack", { style: { gap: "12px" } },
        d.disks?.length ? h("div", h("h4.sub-h", "Laufwerke"), d.disks.map((x) => h("div", { style: { marginBottom: "8px" } },
          h("div.row.between", { style: { fontSize: "12.5px" } }, h("span.mono", x.mount), h("span.faint", `${fmtBytes(x.used)} von ${fmtBytes(x.total)}`)), meter((x.used / x.total) * 100, [80, 92])))) : null,
        d.procs?.length ? h("div", h("h4.sub-h", "Aktivste Programme"), h("div.list", d.procs.map((p) => h("div.list-item", { style: { padding: "6px 0" } },
          h("div.li-main", h("div.li-title", { style: { fontSize: "13px" } }, p.name)), h("span.faint.nowrap", { style: { fontSize: "12px" } }, `${String(p.cpu).replace(".", ",")} % CPU · ${fmtBytes(p.mem)}`))))) : null))));
}

export function fileBrowser(server) {
  const d = server.metadata?.device;
  const body = h("div.card-body");
  const card = h("section.card", h("div.card-head", h("h3.row", icon("folder"), "Dateien auf dem Gerät"), h("span.sub", d?.files ? (d.write ? "Lesen und Schreiben erlaubt" : "Nur Lesen erlaubt") : "")), body);
  if (!d?.files) {
    body.append(naNote(h("span", h("strong", "Dateizugriff ist auf diesem Gerät noch nicht eingeschaltet. "),
      "Auf dem Gerät CC_FILES=1 setzen (und CC_FILES_WRITE=1, wenn du auch Dateien hinlegen willst), dann den Agenten neu starten. Die fertigen Befehle stehen unter „Neuer Agent-Schlüssel“. Versteckte Dateien und Schlüsseldateien bleiben immer gesperrt."), "lock"));
    return card;
  }
  let cur = null, busy = false;
  const fileInp = h("input", { type: "file", multiple: true, style: { display: "none" }, onchange: async (e) => { const fs = [...e.target.files]; e.target.value = ""; for (const f of fs) await put(f); open(cur.path); } });

  async function open(path) {
    if (busy) return;
    busy = true;
    clear(body, h("div.row", { style: { gap: "10px", padding: "18px 0" } }, h("div.spinner"), h("span.faint", "Frage das Gerät …")));
    try { cur = await ask(server, "list", path); draw(); }
    catch (e) { clear(body, naNote(e.message, "alert"), h("div.row", { style: { marginTop: "10px" } }, h("button.btn.sm", { onclick: () => { busy = false; open(cur?.path ?? ""); } }, icon("refresh"), "Erneut versuchen"), cur ? h("button.btn.sm.ghost", { onclick: () => { busy = false; draw(); } }, "Zurück") : null)); }
    finally { busy = false; }
  }
  async function get(f, btn) {
    if (f.size > MAX_UPLOAD) return toast("Datei ist größer als 50 MB – bitte direkt am Gerät kopieren.", "err");
    btn.disabled = true;
    try {
      toast("Hole Datei vom Gerät …", "info");
      const r = await ask(server, "get", f.path);
      const { data, error } = await sb.storage.from("cc-files").createSignedUrl(r.storage_path, 120, { download: r.name });
      if (error) throw new Error(error.message);
      const a = document.createElement("a"); a.href = data.signedUrl; a.rel = "noopener"; document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => sb.storage.from("cc-files").remove([r.storage_path]), 90_000);   // Zwischenkopie wieder löschen
    } catch (e) { toastErr(e); }
    btn.disabled = false;
  }
  async function put(file) {
    if (file.size > MAX_UPLOAD) return toast(`${file.name}: größer als 50 MB`, "err");
    if (isSecretFile(file.name) || file.name.startsWith(".")) return toast(`${file.name}: sieht nach Zugangsdaten aus und wird nicht übertragen`, "err");
    const sp = `device/${server.id}/${crypto.randomUUID()}/${file.name.replace(/[^\w.\- ()äöüÄÖÜß]/g, "_").slice(0, 120)}`;
    try {
      toast(`Übertrage ${file.name} …`, "info");
      const up = await sb.storage.from("cc-files").upload(sp, file, { upsert: false, contentType: file.type || "application/octet-stream" });
      if (up.error) throw new Error(up.error.message);
      const r = await ask(server, "put", cur.path, { storage_path: sp, name: file.name });
      toast(`Auf dem Gerät gespeichert: ${r.name}`);
    } catch (e) { toastErr(e); sb.storage.from("cc-files").remove([sp]); }
  }
  function draw() {
    const crumbs = [];
    if (!cur.roots) {
      crumbs.push(h("button.btn.sm.ghost", { onclick: () => open("") }, icon("server"), "Freigegebene Ordner"));
      if (cur.parent !== null && cur.parent !== undefined) crumbs.push(h("button.btn.sm.ghost", { onclick: () => open(cur.parent) }, "‹ Eine Ebene hoch"));
    }
    const dirs = cur.entries.filter((e) => e.dir).length;
    clear(body, fileInp,
      h("div.row.wrap.between", { style: { gap: "8px", marginBottom: "10px" } },
        h("div.row.wrap", { style: { gap: "6px", minWidth: 0 } }, crumbs, h("span.mono.faint", { style: { fontSize: "12.5px", wordBreak: "break-all" } }, cur.path || "")),
        h("div.row", { style: { gap: "6px" } },
          cur.writable ? h("button.btn.sm", { onclick: () => fileInp.click() }, icon("upload"), "Datei hinlegen") : null,
          cur.writable ? h("button.btn.sm", { onclick: () => formModal("Neuer Ordner", [{ name: "n", label: "Name", required: true, max: 80 }], async (v) => { if (/[\\/:*?"<>|]|^\./.test(v.n)) throw new Error("Dieser Name ist nicht erlaubt."); await ask(server, "mkdir", `${cur.path}/${v.n}`); open(cur.path); }, { submit: "Anlegen" }) }, icon("plus"), "Ordner") : null,
          h("button.btn.sm", { onclick: () => open(cur.path), title: "Neu laden", "aria-label": "Neu laden" }, icon("refresh")))),
      cur.entries.length ? h("div.list.file-list", cur.entries.map((e) => h("div.list-item", { class: e.dir ? "clickable" : "", onclick: e.dir ? () => open(e.path) : null },
        h("div.li-icon", icon(e.dir ? "folder" : "file")),
        h("div.li-main", h("div.li-title", e.name), h("div.li-sub", [e.dir ? "Ordner" : fmtBytes(e.size), e.mtime ? `geändert ${fmtAgo(e.mtime * 1000)}` : null].filter(Boolean).join(" · "))),
        e.dir ? icon("chevronR", "faint") : h("button.btn.sm", { onclick: (ev) => { ev.stopPropagation(); get(e, ev.currentTarget); } }, icon("download"), "Laden"))))
        : h("div.faint", { style: { fontSize: "13px", padding: "10px 0" } }, "Dieser Ordner ist leer."),
      h("div.faint", { style: { fontSize: "12px", marginTop: "10px" } }, [cur.roots ? null : `${dirs} Ordner · ${cur.entries.length - dirs} Dateien`, cur.more ? "nur die ersten 1.000 Einträge" : null, cur.free ? `${fmtBytes(cur.free)} frei` : null, "Dateien bis 50 MB"].filter(Boolean).join(" · ")));
  }
  body.append(h("button.btn.primary", { onclick: () => open("") }, icon("folder"), "Dateien anzeigen"),
    h("span.faint", { style: { fontSize: "12.5px", marginLeft: "10px" } }, "Fragt das Gerät live ab – es muss online sein."));
  return card;
}
