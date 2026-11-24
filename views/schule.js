// Schule: alle Fächer mit ihren Lernatlanten (vom Skill „schule-sync“ aus dem Schulordner übertragen)
//   #/schule        Übersicht nach Fach
//   #/schule/<id>   ein Thema als Lernatlas (Aufbau wie die Vorlage), Kapitel über ?k=<kapitel>
import { sb, q } from "../lib/api.js";
import { h, icon, toast, toastErr, fmtAgo, empty, stat, modal } from "../lib/ui.js";
import { renderAtlas, shrinkImage, STAND } from "../lib/lernatlas.js";

const BUCKET = "cc-files";
const fachOf = (name) => (String(name || "").split(/\s*[:–—]\s*|\s+-\s+/)[0].trim().split(/\s+/)[0] || "Sonstiges").replace(/[^\p{L}\d-]/gu, "") || "Sonstiges";

export default async function schuleView({ args, query }) {
  return args?.[0] ? atlasPage(args[0], query) : overview();
}

async function overview() {
  const [projects, mods, media] = await Promise.all([
    q(sb.from("cc_projects").select("id,slug,name,description,status,metadata,updated_at").eq("category", "school").neq("status", "archived").order("name")),
    q(sb.from("cc_modules").select("id,project_id,name,config,updated_at,position").eq("module_type", "lernatlas").order("position")),
    q(sb.from("cc_school_media").select("module_id,file_name")).catch(() => [])]);
  const mediaBy = {};
  media.forEach((m) => { (mediaBy[m.module_id] ||= new Set()).add(m.file_name.toLowerCase()); });
  const byFach = new Map();
  const slot = (f) => { const k = f.toLowerCase(); if (!byFach.has(k)) byFach.set(k, { name: f, atlases: [], other: [], projectId: null }); return byFach.get(k); };
  for (const p of projects) {
    if (p.metadata?.school_kind === "fach") { const s = slot(p.metadata.fach || p.name); s.projectId = p.id; s.name = p.metadata.fach || p.name; }
    else slot(fachOf(p.name)).other.push(p);
  }
  for (const m of mods) {
    const p = projects.find((x) => x.id === m.project_id);
    if (!p) continue;
    slot(p.metadata?.fach || m.config?.fach || p.name).atlases.push(m);
  }
  const faecher = [...byFach.values()].sort((a, b) => b.atlases.length - a.atlases.length || a.name.localeCompare(b.name, "de"));
  const totalCh = mods.reduce((a, m) => a + (m.config?.chapters?.length || 0), 0);

  const atlasRow = (m) => {
    const c = m.config || {}; const ch = c.chapters || []; const pr = c.progress || {};
    const files = new Set(ch.flatMap((x) => (x.photos || []).map((p) => String(p.file || "").toLowerCase())).filter(Boolean));
    const have = [...files].filter((f) => mediaBy[m.id]?.has(f)).length;
    const counts = Object.keys(STAND).map((k) => [k, ch.filter((x) => (pr[x.id] || x.stand) === k).length]);
    const ok = counts.find(([k]) => k === "ok")[1];
    return h("a.list-item.sch-row", { href: `#/schule/${m.id}` },
      h("div.li-icon", icon("book")),
      h("div.li-main", h("div.li-title", c.thema || m.name),
        h("div.li-sub", [`${ch.length} Kapitel`, files.size ? `Fotos ${have}/${files.size}` : null, c.klasse ? `Klasse ${c.klasse}` : null, `aktualisiert ${fmtAgo(c.synced_at || m.updated_at)}`].filter(Boolean).join(" · ")),
        ch.length ? h("div.sch-bar", { title: counts.map(([k, n]) => `${STAND[k][1]}: ${n}`).join(" · "), "aria-label": `${ok} von ${ch.length} Kapiteln sitzen` },
          ...counts.filter(([, n]) => n).map(([k, n]) => h("i", { class: k, style: { flex: n } })), ch.length - counts.reduce((a, [, n]) => a + n, 0) > 0 ? h("i", { style: { flex: ch.length - counts.reduce((a, [, n]) => a + n, 0) } }) : null) : null),
      files.size && have < files.size ? h("span.badge.b-warn", `${files.size - have} Fotos fehlen`) : null,
      icon("chevronR"));
  };

  return h("div",
    h("div.page-head", h("div", h("h1", "Schule"), h("p.page-sub", "Jedes Fach mit seinen Themen als Lernatlas – Regeln, Beispiele, Aufgaben mit Lösung, Fotos aus dem Unterricht.")),
      h("div.actions", h("button.btn", { onclick: howTo }, icon("info"), "So kommt ein Thema hierher"))),
    h("div.grid.g-3", { style: { marginBottom: "18px" } },
      stat("Fächer", String(faecher.filter((f) => f.atlases.length || f.other.length).length), { ic: "book" }), stat("Lernatlanten", String(mods.length), { ic: "layers" }), stat("Kapitel", String(totalCh), { ic: "check" })),
    faecher.length ? h("div.sch-grid", faecher.map((f) => h("section.card",
      h("div.card-head", h("h3.row", { style: { gap: "8px" } }, icon("book"), f.name), f.projectId ? h("a.btn.sm.ghost", { href: `#/projects/${f.projectId}` }, "Projekt") : null),
      h("div.card-body",
        f.atlases.length ? h("div.list", f.atlases.map(atlasRow)) : h("p.faint", { style: { margin: "0 0 8px" } }, "Noch kein Lernatlas – mit dem Skill „schule-sync“ übertragen."),
        f.other.length ? h("div", { style: { marginTop: "10px" } }, h("div.faint", { style: { fontSize: "12px", textTransform: "uppercase", letterSpacing: ".06em", margin: "0 0 6px" } }, "Weitere Lernseiten"),
          h("div.list", f.other.map((p) => h("a.list-item", { href: `#/projects/${p.id}` }, h("div.li-icon", icon("folder")), h("div.li-main", h("div.li-title", p.name), h("div.li-sub", `Projekt · ${fmtAgo(p.updated_at)}`)), icon("chevronR"))))) : null)))) :
      h("section.card.card-pad", empty("book", "Noch keine Fächer", "Öffne in Claude deinen Schulordner und sag „Schule syncen“ – der Skill legt das Fach und das Thema hier an."), h("div", { style: { textAlign: "center" } }, h("button.btn.primary", { onclick: howTo }, "Anleitung"))));
}

function howTo() {
  modal("So kommt ein Thema in „Schule“", h("div.stack", { style: { gap: "12px" } },
    h("ol", { style: { margin: 0, paddingLeft: "20px", lineHeight: 1.6 } },
      h("li", "Skill „schule-sync“ in Claude hinzufügen (Download unten, dann in Claude unter Einstellungen › Fähigkeiten hochladen)."),
      h("li", "In Claude dein Schul-Projekt öffnen (mit Arbeitsblättern, Tafelfotos, Notizen) und die Supabase-Verbindung aktivieren."),
      h("li", "Schreiben: „Schule syncen“ oder „Thema Funktionsuntersuchung ins Nexus“. Claude baut daraus den Lernatlas und legt ihn unter dem richtigen Fach an. Gleiches Thema noch mal = wird aktualisiert, dein Lernstand bleibt."),
      h("li", "Fotos: Im Lernatlas oben „Fotos hochladen“ antippen und die Bilder aus dem Ordner wählen. Sie werden über den Dateinamen den Kapiteln zugeordnet.")),
    h("a.btn.primary", { href: "skills/schule-sync.zip", download: "schule-sync.zip", style: { justifySelf: "start" } }, icon("download"), "Skill herunterladen"),
    h("p.faint", { style: { margin: 0, fontSize: "12.5px" } }, "Ohne Supabase-Verbindung in Claude geht es nicht automatisch – dann zeigt der Skill den Befehl, den du mir hier geben kannst.")));
}

// ---------- ein Thema ----------
async function atlasPage(id, query) {
  const mod = await q(sb.from("cc_modules").select("id,project_id,name,config,updated_at").eq("id", id).maybeSingle());
  if (!mod || !mod.config) return h("div", empty("book", "Lernatlas nicht gefunden", "Vielleicht wurde er gelöscht."), h("div", { style: { textAlign: "center" } }, h("a.btn", { href: "#/schule" }, "Zur Übersicht")));
  const media = await q(sb.from("cc_school_media").select("file_name,storage_path").eq("module_id", id)).catch(() => []);
  const urls = new Map();
  if (media.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(media.map((m) => m.storage_path), 3600);
    (data || []).forEach((d, i) => { if (d?.signedUrl) urls.set(media[i].file_name.toLowerCase(), d.signedUrl); });
  }
  const cfg = mod.config;
  const refs = [...new Set((cfg.chapters || []).flatMap((c) => (c.photos || []).map((p) => String(p.file || ""))).filter(Boolean))];
  const missing = refs.filter((f) => !urls.has(f.toLowerCase()));
  const input = h("input", { type: "file", accept: "image/*", multiple: true, hidden: true, onchange: (e) => upload([...e.target.files]) });
  const upBtn = h("button.btn.sm", { type: "button", onclick: () => input.click() }, icon("upload"), "Fotos hochladen");

  async function upload(files) {
    if (!files.length) return;
    const want = new Set(refs.map((f) => f.toLowerCase()));
    const list = files.filter((f) => /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic)$/i.test(f.name));
    const unknown = list.filter((f) => want.size && !want.has(f.name.toLowerCase()));
    upBtn.disabled = true;
    let done = 0;
    try {
      for (const f of list) {
        upBtn.lastChild.textContent = `Lade ${++done}/${list.length} …`;
        const small = await shrinkImage(f);
        const safe = f.name.replace(/[^\w.\- ]+/g, "_").slice(-180);
        const path = `school/${id}/${safe}`;
        const { error } = await sb.storage.from(BUCKET).upload(path, small, { upsert: true, contentType: small.type || "image/jpeg", cacheControl: "3600" });
        if (error) throw error;
        await q(sb.from("cc_school_media").upsert({ module_id: id, file_name: f.name, storage_path: path, mime: small.type, bytes: small.size }, { onConflict: "module_id,file_name" }));
      }
      toast(`${list.length} Foto(s) hochgeladen${unknown.length ? ` · ${unknown.length} gehören zu keinem Kapitel (Name passt nicht)` : ""}`, unknown.length ? "warn" : "ok", 6000);
      window.dispatchEvent(new window.HashChangeEvent("hashchange"));
    } catch (e) { toastErr(e); upBtn.disabled = false; upBtn.lastChild.textContent = "Fotos hochladen"; }
  }

  const atlas = renderAtlas(cfg, {
    admin: true,
    startChapter: query?.get("k") || "start",
    hrefFor: (k) => `#/schule/${id}?k=${encodeURIComponent(k)}`,
    photoUrl: (file) => urls.get(String(file).toLowerCase()) || null,
    onUpload: () => input.click(),
    onChapter: (k) => { const want = k === "start" ? `#/schule/${id}` : `#/schule/${id}?k=${encodeURIComponent(k)}`; if (location.hash !== want) history.replaceState(null, "", want); },
    onProgress: async (chId, stand) => {
      try {
        const fresh = await q(sb.from("cc_modules").select("config").eq("id", id).single());
        const pr = { ...(fresh.config?.progress || {}) };
        if (stand) pr[chId] = stand; else delete pr[chId];
        await q(sb.from("cc_modules").update({ config: { ...fresh.config, progress: pr } }).eq("id", id));
        toast(stand ? `Stand: ${STAND[stand][1]}` : "Stand entfernt");
      } catch (e) { toastErr(e); throw e; }
    },
    toolbar: h("div.la-tools", input, upBtn, h("a.btn.sm.ghost", { href: `#/projects/${mod.project_id}` }, "Projekt")),
  });
  return h("div",
    h("div.row", { style: { gap: "8px", margin: "0 0 12px", flexWrap: "wrap" } },
      h("a.btn.sm.ghost", { href: "#/schule" }, icon("chevronL"), "Schule"),
      h("span.faint", { style: { fontSize: "13px" } }, `${cfg.fach || ""} · zuletzt übertragen ${fmtAgo(cfg.synced_at || mod.updated_at)}`),
      missing.length ? h("button.badge.b-warn", { type: "button", style: { cursor: "pointer", border: 0 }, title: missing.join(", "), onclick: () => input.click() }, `${missing.length} Fotos fehlen – hochladen`) : null),
    h("h1.sr-only", cfg.thema || mod.name),
    atlas);
}

