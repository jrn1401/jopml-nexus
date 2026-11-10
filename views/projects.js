import { sb, q, local } from "../lib/api.js";
import { h, icon, badge, catIcon, empty, fmtAgo, fmtDate, CATEGORIES, PROJECT_STATUS } from "../lib/ui.js";
import { newProject } from "../lib/actions.js";

export default async function projectsView({ query }) {
  const [rows, mods, files, servers] = await Promise.all([
    q(sb.from("cc_projects").select("*").order("updated_at", { ascending: false })),
    q(sb.from("cc_modules").select("project_id")),
    q(sb.from("cc_files").select("project_id").eq("is_current", true).limit(50000)),
    q(sb.from("cc_servers").select("id,name,project_id")),
  ]);
  const count = (arr) => arr.reduce((m, r) => (m[r.project_id] = (m[r.project_id] || 0) + 1, m), {});
  const nMods = count(mods), nFiles = count(files);
  const srvBy = servers.reduce((m, s) => (s.project_id && (m[s.project_id] ??= []).push(s.name), m), {});
  const allTags = [...new Set(rows.flatMap((r) => r.tags || []))].sort();

  const st = { q: query.get("q") || "", cat: query.get("cat") || "", status: "", tag: "", server: "", sort: local.get("projSort", "updated"), view: local.get("projView", "grid") };
  const list = h("div");
  const sel = (key, opts, label) => h("select.input", { "aria-label": label, style: { width: "auto", minWidth: "140px" }, onchange: (e) => { st[key] = e.target.value; draw(); } },
    h("option", { value: "" }, label), opts.map(([v, t]) => h("option", { value: v, selected: st[key] === v }, t)));

  function filtered() {
    const s = st.q.toLowerCase();
    let r = rows.filter((p) => (!s || p.name.toLowerCase().includes(s) || p.description.toLowerCase().includes(s) || (p.tags || []).some((t) => t.toLowerCase().includes(s)))
      && (!st.cat || p.category === st.cat) && (!st.status || p.status === st.status) && (!st.tag || (p.tags || []).includes(st.tag))
      && (!st.server || (st.server === "with" ? srvBy[p.id] : !srvBy[p.id])));
    const by = { updated: (a, b) => b.updated_at.localeCompare(a.updated_at), created: (a, b) => b.created_at.localeCompare(a.created_at), name: (a, b) => a.name.localeCompare(b.name, "de"), status: (a, b) => a.status.localeCompare(b.status) };
    return r.sort(by[st.sort]);
  }
  function draw() {
    const r = filtered();
    if (!rows.length) return list.replaceChildren(empty("folder", "Noch keine Projekte", "Lege ein Projekt an oder lass Claude eins über den Skill „jopml-project-integrator“ integrieren.", h("button.btn.primary", { onclick: () => newProject() }, icon("plus"), "Neues Projekt")));
    if (!r.length) return list.replaceChildren(empty("search", "Keine Treffer", "Filter anpassen oder zurücksetzen."));
    if (st.view === "grid") {
      list.replaceChildren(h("div.grid", { style: { gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))" } }, r.map((p) =>
        h("a.card.pcard", { href: `#/projects/${p.id}` },
          h("div.top", catIcon(p.category), h("div", { style: { minWidth: 0, flex: 1 } }, h("h4.ellipsis", p.name), h("div.faint", { style: { fontSize: "12px" } }, CATEGORIES[p.category]?.[0] || p.category)), badge(PROJECT_STATUS, p.status)),
          h("p", p.description || "Keine Beschreibung"),
          (p.tags || []).length ? h("div.row.wrap", { style: { gap: "5px" } }, p.tags.slice(0, 4).map((t) => h("span.tag", t))) : null,
          h("div.meta", h("span.row", { style: { gap: "4px" } }, icon("layers", ""), `${nMods[p.id] || 0} Module`), h("span", `${nFiles[p.id] || 0} Dateien`),
            srvBy[p.id] ? h("span", `${srvBy[p.id].length} Server`) : null, h("span", { style: { marginLeft: "auto" } }, fmtAgo(p.updated_at)))))));
    } else {
      list.replaceChildren(h("div.card", h("div.table-wrap", h("table.table.responsive",
        h("thead", h("tr", ["Projekt", "Kategorie", "Status", "Module", "Dateien", "Server", "Erstellt", "Aktualisiert"].map((t, i) => h("th", { class: i >= 3 && i <= 5 ? "num" : "" }, t)))),
        h("tbody", r.map((p) => h("tr.click", { onclick: () => (location.hash = `#/projects/${p.id}`) },
          h("td", { "data-l": "Projekt" }, h("div.row", catIcon(p.category, 28), h("strong.ellipsis", p.name))),
          h("td", { "data-l": "Kategorie" }, CATEGORIES[p.category]?.[0] || p.category), h("td", { "data-l": "Status" }, badge(PROJECT_STATUS, p.status)),
          h("td.num", { "data-l": "Module" }, nMods[p.id] || 0), h("td.num", { "data-l": "Dateien" }, nFiles[p.id] || 0), h("td.num", { "data-l": "Server" }, srvBy[p.id]?.length || 0),
          h("td", { "data-l": "Erstellt" }, fmtDate(p.created_at)), h("td", { "data-l": "Aktualisiert" }, fmtAgo(p.updated_at)))))))));
    }
  }
  const viewSeg = h("div.seg", [["grid", "Karten"], ["table", "Tabelle"]].map(([k, t]) => h("button", { class: st.view === k ? "on" : "", onclick: (e) => {
    st.view = k; local.set("projView", k); viewSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); draw(); } }, t)));
  draw();
  return h("div",
    h("div.page-head", h("div", h("h1", "Projekte"), h("p", `${rows.length} Projekte in allen Kategorien`)),
      h("div.actions", h("button.btn.primary", { onclick: () => newProject() }, icon("plus"), "Neues Projekt"))),
    h("div.row.wrap", { style: { marginBottom: "16px", gap: "8px" } },
      h("div.search", { style: { maxWidth: "280px", cursor: "auto" } }, icon("search"), h("input", { value: st.q, placeholder: "Filtern …", style: { border: 0, background: "none", outline: "none", flex: 1, minWidth: 0 }, oninput: (e) => { st.q = e.target.value; draw(); } })),
      sel("cat", Object.entries(CATEGORIES).map(([k, v]) => [k, v[0]]), "Alle Kategorien"),
      sel("status", Object.entries(PROJECT_STATUS).map(([k, v]) => [k, v[0]]), "Alle Status"),
      allTags.length ? sel("tag", allTags.map((t) => [t, t]), "Alle Tags") : null,
      sel("server", [["with", "Mit Server"], ["without", "Ohne Server"]], "Server: alle"),
      h("select.input", { "aria-label": "Sortierung", style: { width: "auto" }, onchange: (e) => { st.sort = e.target.value; local.set("projSort", st.sort); draw(); } },
        [["updated", "Zuletzt aktualisiert"], ["created", "Neueste zuerst"], ["name", "Name A–Z"], ["status", "Status"]].map(([v, t]) => h("option", { value: v, selected: st.sort === v }, t))),
      h("div", { style: { marginLeft: "auto" } }, viewSeg)),
    list);
}
