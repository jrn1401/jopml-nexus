import { sb, q, projects as loadProjects, downloadFile, removeFile } from "../lib/api.js";
import { h, icon, fmtBytes, fmtAgo, fmtNum, empty, confirmDialog, toast, toastErr, debounce } from "../lib/ui.js";
import { uploadDialog } from "../lib/actions.js";

const PAGE = 50;
const CATS = ["code", "doku", "konfiguration", "daten", "design", "medien", "paket", "sonstiges", "other"];

export default async function filesView({ query }) {
  const projects = await loadProjects(true);
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const st = { q: query.get("q") || "", project: query.get("project") || "", cat: "", source: "", page: 0 };
  const list = h("div"), info = h("span.muted");

  async function load() {
    list.replaceChildren(h("div.skel", { style: { height: "240px" } }));
    let qy = sb.from("cc_files").select("*", { count: "exact" }).eq("is_current", true);
    if (st.q) qy = qy.ilike("rel_path", `%${st.q.replace(/[%_\\]/g, (c) => "\\" + c)}%`);
    if (st.project) qy = qy.eq("project_id", st.project);
    if (st.cat) qy = qy.eq("category", st.cat);
    if (st.source) qy = qy.eq("source", st.source);
    const { data, count } = await q(qy.order("uploaded_at", { ascending: false }).range(st.page * PAGE, st.page * PAGE + PAGE - 1));
    info.textContent = `${fmtNum(count)} Dateien`;
    if (!data.length) return list.replaceChildren(h("div.card", empty("file", st.q || st.project || st.cat ? "Keine Treffer" : "Noch keine Dateien",
      "Dateien hochladen oder Projekte über den Claude-Skill synchronisieren.", h("button.btn.primary", { onclick: up }, icon("upload"), "Hochladen"))));
    const pages = Math.ceil(count / PAGE);
    list.replaceChildren(h("div.card", h("div.table-wrap", h("table.table.responsive",
      h("thead", h("tr", h("th", "Datei"), h("th", "Projekt"), h("th", "Kategorie"), h("th.num", "Größe"), h("th", "Version"), h("th", "Quelle"), h("th", "Hochgeladen"), h("th", ""))),
      h("tbody", data.map((f) => h("tr",
        h("td", { "data-l": "Datei" }, h("div", { style: { fontWeight: 540 } }, f.file_name), h("div.faint.mono.ellipsis", { style: { fontSize: "11.5px", maxWidth: "340px" } }, f.rel_path)),
        h("td", { "data-l": "Projekt" }, h("a", { href: `#/projects/${f.project_id}?tab=files`, style: { color: "var(--primary)" } }, pname[f.project_id] || "?")),
        h("td", { "data-l": "Kategorie" }, h("span.tag", f.category)), h("td.num", { "data-l": "Größe" }, fmtBytes(f.file_size)),
        h("td", { "data-l": "Version" }, `v${f.version}`), h("td", { "data-l": "Quelle" }, f.source), h("td", { "data-l": "Hochgeladen" }, fmtAgo(f.uploaded_at)),
        h("td", { "data-l": "" }, h("div.row", { style: { gap: "2px", justifyContent: "flex-end" } },
          h("button.icon-btn", { "aria-label": "Herunterladen", onclick: () => downloadFile(f).catch(toastErr) }, icon("download")),
          h("button.icon-btn", { "aria-label": "Löschen", onclick: async () => {
            if (!(await confirmDialog("Datei löschen?", `„${f.rel_path}“ wird mit allen Versionen dauerhaft gelöscht.`, { ok: "Endgültig löschen" }))) return;
            try { await removeFile(f.project_id, f.rel_path); toast("Gelöscht"); load(); } catch (e) { toastErr(e); } } }, icon("trash")))))))))),
      pages > 1 ? h("div.row", { style: { justifyContent: "center", marginTop: "14px" } },
        h("button.btn.sm", { disabled: st.page === 0, onclick: () => { st.page--; load(); } }, icon("chevronL"), "Zurück"),
        h("span.muted", { style: { fontSize: "13px" } }, `Seite ${st.page + 1} von ${pages}`),
        h("button.btn.sm", { disabled: st.page >= pages - 1, onclick: () => { st.page++; load(); } }, "Weiter", icon("chevronR"))) : null);
  }
  const up = () => uploadDialog({ projectId: st.project || undefined, onDone: load });
  const reload = () => { st.page = 0; load().catch(toastErr); };
  const sel = (key, opts, label) => h("select.input", { style: { width: "auto" }, "aria-label": label, onchange: (e) => { st[key] = e.target.value; reload(); } },
    h("option", { value: "" }, label), opts.map(([v, t]) => h("option", { value: v, selected: st[key] === v }, t)));
  const totals = await q(sb.from("cc_files").select("file_hash,file_size").limit(100000));
  const uniq = new Map(totals.map((f) => [f.file_hash, f.file_size]));
  const stored = [...uniq.values()].reduce((a, b) => a + b, 0), logical = totals.reduce((a, f) => a + f.file_size, 0);
  load().catch(toastErr);
  return h("div",
    h("div.page-head", h("div", h("h1", "Dateien"), h("p", `${fmtBytes(stored)} belegt${logical > stored ? ` · ${fmtBytes(logical - stored)} durch Deduplizierung gespart` : ""} · privater Speicher, nur für dich`)),
      h("div.actions", h("button.btn.primary", { onclick: up }, icon("upload"), "Hochladen"))),
    h("div.row.wrap", { style: { marginBottom: "16px", gap: "8px" } },
      h("div.search", { style: { maxWidth: "320px", cursor: "auto" } }, icon("search"), h("input", { value: st.q, placeholder: "Dateiname oder Pfad …", style: { border: 0, background: "none", outline: "none", flex: 1, minWidth: 0 },
        oninput: debounce((e) => { st.q = e.target.value.trim(); reload(); }, 250) })),
      sel("project", projects.map((p) => [p.id, p.name]), "Alle Projekte"), sel("cat", CATS.map((c) => [c, c]), "Alle Kategorien"),
      sel("source", [["ui", "Upload"], ["skill", "Claude-Skill"], ["jopml", "JOPML"]], "Alle Quellen"), h("span", { style: { marginLeft: "auto" } }, info)),
    list);
}
