// Schule: alle Fächer mit ihren Lernatlanten (vom Skill „schule-sync“ aus dem Schulordner übertragen)
//   #/schule        Übersicht nach Fach
//   #/schule/<id>   ein Thema als Lernatlas (Aufbau wie die Vorlage), Kapitel über ?k=<kapitel>
import { sb, q, local } from "../lib/api.js";
import { h, icon, toast, toastErr, fmtAgo, empty, stat, modal, formModal, confirmDialog, copyText } from "../lib/ui.js";
import { renderAtlas, shrinkImage, STAND } from "../lib/lernatlas.js";

const BUCKET = "cc-files";

export default async function schuleView({ args, query }) {
  return args?.[0] ? atlasPage(args[0], query) : linksPage();
}

// ---------- Übersicht: Claude-Artefakt-Links je Thema, sortier- und filterbar ----------
const SORTS = [["neu", "Zuletzt aktualisiert"], ["fach", "Fach"], ["halbjahr", "Halbjahr"], ["thema", "Thema A–Z"], ["klausur", "Nächste Klausur"]];
// „11/1“, „11.2“, „Q1“, „12/2“ → sortierbare Zahl (Klasse·10 + Halbjahr)
const hjKey = (x) => { const t = String(x || "").toUpperCase(); const q = t.match(/^Q\s*(\d)/); if (q) return 110 + Number(q[1]); const m = t.match(/(\d{1,2})\D*(\d)?/); return m ? Number(m[1]) * 10 + Number(m[2] || 0) : 9999; };
const daysTo = (d) => Math.ceil((new Date(d + "T12:00:00") - Date.now()) / 86400_000);

async function linksPage() {
  let rows = await q(sb.from("cc_school_links").select("*").order("updated_at", { ascending: false }));
  const pref = local.get("sch:view", { sort: "neu", fach: "", hj: "", group: true });
  let term = "";
  const list = h("div");
  const filters = h("div.sch-filters");
  const searchIn = h("input.input", { type: "search", placeholder: "Thema suchen …", "aria-label": "Thema suchen", value: "", oninput: (e) => { term = e.target.value.trim().toLowerCase(); draw(); } });
  const save = () => local.set("sch:view", pref);

  function sorted(arr) {
    const a = [...arr];
    const by = { neu: (x, y) => new Date(y.updated_at) - new Date(x.updated_at),
      fach: (x, y) => x.fach.localeCompare(y.fach, "de") || hjKey(x.halbjahr) - hjKey(y.halbjahr) || x.thema.localeCompare(y.thema, "de"),
      halbjahr: (x, y) => hjKey(x.halbjahr) - hjKey(y.halbjahr) || x.fach.localeCompare(y.fach, "de") || x.thema.localeCompare(y.thema, "de"),
      thema: (x, y) => x.thema.localeCompare(y.thema, "de"),
      klausur: (x, y) => (x.klausur ? new Date(x.klausur) : Infinity) - (y.klausur ? new Date(y.klausur) : Infinity) };
    return a.sort(by[pref.sort] || by.neu);
  }
  const row = (r) => {
    const d = r.klausur ? daysTo(r.klausur) : null;
    return h("div.list-item.sch-link",
      h("div.li-icon", icon("book")),
      h("div.li-main",
        h("a.li-title", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, r.thema),
        h("div.row.wrap", { style: { gap: "6px", marginTop: "4px" } },
          pref.group ? null : h("span.badge", r.fach), r.halbjahr ? h("span.badge.b-pri", `Halbjahr ${r.halbjahr}`) : null, r.klasse ? h("span.tag", `Klasse ${r.klasse}`) : null,
          d !== null ? h("span.badge", { class: d < 0 ? "" : d <= 7 ? "b-bad" : d <= 21 ? "b-warn" : "b-ok" }, d < 0 ? `Klausur war am ${new Date(r.klausur).toLocaleDateString("de-DE")}` : d === 0 ? "Klausur heute" : `Klausur in ${d} Tagen`) : null),
        r.beschreibung ? h("div.li-sub", { style: { whiteSpace: "normal" } }, r.beschreibung) : null,
        h("div.li-sub", `aktualisiert ${fmtAgo(r.updated_at)}`)),
      h("div.row", { style: { gap: "4px" } },
        h("a.btn.sm.primary", { href: r.url, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Öffnen"),
        h("button.icon-btn", { title: "Link kopieren", "aria-label": `Link zu ${r.thema} kopieren`, onclick: () => copyText(r.url) }, icon("copy")),
        h("button.icon-btn", { title: "Bearbeiten", "aria-label": `${r.thema} bearbeiten`, onclick: () => edit(r) }, icon("edit")),
        h("button.icon-btn", { title: "Entfernen", "aria-label": `${r.thema} entfernen`, onclick: async () => {
          if (!(await confirmDialog("Eintrag entfernen?", `„${r.thema}“ verschwindet aus der Liste. Das Claude-Artefakt selbst bleibt erhalten.`, { ok: "Entfernen" }))) return;
          try { await q(sb.from("cc_school_links").delete().eq("id", r.id)); rows = rows.filter((x) => x.id !== r.id); draw(); toast("Entfernt"); } catch (e) { toastErr(e); } } }, icon("trash"))));
  };
  function draw() {
    const faecher = [...new Set(rows.map((r) => r.fach))].sort((a, b) => a.localeCompare(b, "de"));
    const hjs = [...new Set(rows.map((r) => r.halbjahr).filter(Boolean))].sort((a, b) => hjKey(a) - hjKey(b));
    if (pref.fach && !faecher.includes(pref.fach)) pref.fach = "";
    if (pref.hj && !hjs.includes(pref.hj)) pref.hj = "";
    const chip = (on, label, fn) => h("button.chip", { type: "button", class: on ? "on" : "", "aria-pressed": String(on), onclick: fn }, label);
    filters.replaceChildren(
      h("div.sch-frow", searchIn,
        h("label.sch-sel", h("span.faint", "Sortieren"), h("select.input.sm", { "aria-label": "Sortieren nach", onchange: (e) => { pref.sort = e.target.value; save(); draw(); } }, SORTS.map(([v, t]) => h("option", { value: v, selected: pref.sort === v }, t)))),
        hjs.length ? h("label.sch-sel", h("span.faint", "Halbjahr"), h("select.input.sm", { "aria-label": "Halbjahr filtern", onchange: (e) => { pref.hj = e.target.value; save(); draw(); } }, h("option", { value: "" }, "Alle"), hjs.map((x) => h("option", { value: x, selected: pref.hj === x }, x)))) : null,
        h("label.check", { style: { margin: 0 } }, h("input", { type: "checkbox", checked: pref.group, onchange: (e) => { pref.group = e.target.checked; save(); draw(); } }), "Nach Fach gruppieren")),
      faecher.length > 1 ? h("div.row.wrap", { style: { gap: "6px" } }, chip(!pref.fach, `Alle Fächer (${rows.length})`, () => { pref.fach = ""; save(); draw(); }),
        ...faecher.map((f) => chip(pref.fach === f, `${f} (${rows.filter((r) => r.fach === f).length})`, () => { pref.fach = pref.fach === f ? "" : f; save(); draw(); }))) : null);
    const vis = sorted(rows.filter((r) => (!pref.fach || r.fach === pref.fach) && (!pref.hj || r.halbjahr === pref.hj) && (!term || `${r.thema} ${r.fach} ${r.beschreibung || ""}`.toLowerCase().includes(term))));
    if (!rows.length) { list.replaceChildren(h("section.card.card-pad", empty("book", "Noch keine Themen", "Öffne in Claude deinen Schulordner und sag „Schule syncen“ – der Skill veröffentlicht die Lernseite als Artefakt und trägt den Link hier ein."), h("div", { style: { textAlign: "center" } }, h("button.btn.primary", { onclick: howTo }, "Anleitung")))); return; }
    if (!vis.length) { list.replaceChildren(h("section.card.card-pad", empty("search", "Nichts gefunden", "Filter oder Suche ändern."))); return; }
    if (pref.group) {
      const groups = new Map();
      for (const r of vis) { if (!groups.has(r.fach)) groups.set(r.fach, []); groups.get(r.fach).push(r); }
      const order = [...groups.keys()].sort((a, b) => a.localeCompare(b, "de"));
      list.replaceChildren(h("div.sch-grid", order.map((f) => h("section.card", h("div.card-head", h("h3.row", { style: { gap: "8px" } }, icon("book"), f), h("span.faint", `${groups.get(f).length} ${groups.get(f).length === 1 ? "Thema" : "Themen"}`)),
        h("div.card-body", h("div.list", groups.get(f).map(row)))))));
    } else list.replaceChildren(h("section.card", h("div.card-body", h("div.list", vis.map(row)))));
  }
  function edit(r) {
    formModal(r ? "Eintrag bearbeiten" : "Link hinzufügen", [
      { name: "thema", label: "Thema", value: r?.thema, required: true, max: 200, full: true },
      { name: "fach", label: "Fach", value: r?.fach, required: true, max: 80, half: true, placeholder: "z. B. Mathematik" },
      { name: "halbjahr", label: "Halbjahr", value: r?.halbjahr, max: 20, half: true, placeholder: "z. B. 11/1 oder Q1" },
      { name: "klasse", label: "Klasse", value: r?.klasse, max: 20, half: true, placeholder: "z. B. 11" },
      { name: "klausur", label: "Klausur am (optional)", type: "date", value: r?.klausur || "", half: true },
      { name: "url", label: "Link zum Claude-Artefakt", value: r?.url, required: true, max: 500, full: true, placeholder: "https://claude.ai/…", hint: "Nur Links zu claude.ai bzw. claude.site." },
      { name: "beschreibung", label: "Kurzbeschreibung (optional)", type: "textarea", rows: 2, value: r?.beschreibung, max: 600, ai: false }],
    async (v) => {
      if (!/^https:\/\/([a-z0-9-]+\.)*(claude\.ai|claude\.site)\//i.test(v.url)) throw new Error("Bitte einen Link zu claude.ai oder claude.site eintragen.");
      const row = { thema: v.thema, fach: v.fach, halbjahr: v.halbjahr || null, klasse: v.klasse || null, klausur: v.klausur || null, url: v.url, beschreibung: v.beschreibung || null, updated_at: new Date().toISOString() };
      if (r) { const [u] = await q(sb.from("cc_school_links").update(row).eq("id", r.id).select()); Object.assign(r, u || row); }
      else { const [n] = await q(sb.from("cc_school_links").insert(row).select()); rows.unshift(n); }
      toast("Gespeichert"); draw();
    });
  }
  draw();
  const faecherN = new Set(rows.map((r) => r.fach)).size;
  const next = rows.filter((r) => r.klausur && daysTo(r.klausur) >= 0).sort((a, b) => new Date(a.klausur) - new Date(b.klausur))[0];
  return h("div",
    h("div.page-head", h("div", h("h1", "Schule"), h("p.page-sub", "Deine Lernseiten aus Claude – nach Fach und Halbjahr sortiert.")),
      h("div.actions", h("button.btn", { onclick: howTo }, icon("info"), "So kommt ein Thema hierher"), h("button.btn.primary", { onclick: () => edit(null) }, icon("plus"), "Link hinzufügen"))),
    h("div.grid.g-3", { style: { marginBottom: "16px" } },
      stat("Fächer", String(faecherN), { ic: "book" }), stat("Themen", String(rows.length), { ic: "layers" }),
      next ? stat("Nächste Klausur", `${daysTo(next.klausur)} Tage`, { ic: "calendar", sub: `${next.fach}: ${next.thema}` }) : stat("Nächste Klausur", "", { ic: "calendar", na: "keine eingetragen" })),
    filters, list);
}

function howTo() {
  modal("So kommt ein Thema in „Schule“", h("div.stack", { style: { gap: "12px" } },
    h("ol", { style: { margin: 0, paddingLeft: "20px", lineHeight: 1.6 } },
      h("li", "Skill „schule-sync“ in Claude hinzufügen (Download unten, dann in Claude unter Einstellungen › Fähigkeiten hochladen)."),
      h("li", "In Claude dein Schul-Projekt öffnen und die Supabase-Verbindung aktivieren."),
      h("li", "Schreiben: „Schule syncen“. Claude baut die Lernseite als Artefakt, veröffentlicht sie und trägt Thema, Fach, Halbjahr und Link hier ein. Gleiches Fach + Thema noch mal = Link wird aktualisiert."),
      h("li", "Fehlt ein Link, trägst du ihn mit „Link hinzufügen“ selbst ein.")),
    h("p.faint", { style: { margin: 0, fontSize: "12.5px" } }, "Damit der Link für dich überall aufgeht, muss das Artefakt in Claude veröffentlicht bzw. geteilt sein."),
    h("a.btn.primary", { href: "skills/schule-sync.zip", download: "schule-sync.zip", style: { justifySelf: "start" } }, icon("download"), "Skill herunterladen")));
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
    toolbar: h("div.la-tools", input, h("button.btn.sm", { type: "button", onclick: () => import("../lib/actions.js").then((m) => m.openAssistant(null, "", { type: "atlas", id, name: `${cfg.fach || ""} › ${cfg.thema || mod.name}` })) }, icon("bot"), "KI-Nachhilfe"), upBtn, h("a.btn.sm.ghost", { href: `#/projects/${mod.project_id}` }, "Projekt")),
  });
  return h("div",
    h("div.row", { style: { gap: "8px", margin: "0 0 12px", flexWrap: "wrap" } },
      h("a.btn.sm.ghost", { href: "#/schule" }, icon("chevronL"), "Schule"),
      h("span.faint", { style: { fontSize: "13px" } }, `${cfg.fach || ""} · zuletzt übertragen ${fmtAgo(cfg.synced_at || mod.updated_at)}`),
      missing.length ? h("button.badge.b-warn", { type: "button", style: { cursor: "pointer", border: 0 }, title: missing.join(", "), onclick: () => input.click() }, `${missing.length} Fotos fehlen – hochladen`) : null),
    h("h1.sr-only", cfg.thema || mod.name),
    atlas);
}

