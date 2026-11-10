import { sb, q, projects as loadProjects } from "../lib/api.js";
import { h, icon, empty, fmtNum, toastErr } from "../lib/ui.js";
import { timeline } from "../lib/modules.js";

const PAGE = 60;
const KINDS = [["project_created", "Projekt erstellt"], ["project_updated", "Projekt aktualisiert"], ["project_status", "Statusänderung"], ["module_created", "Modul erstellt"],
  ["file_upload", "Datei hochgeladen"], ["sync", "Synchronisierung"], ["server_added", "Server registriert"], ["server_online", "Server online"], ["server_offline", "Server offline"],
  ["event_created", "Event erstellt"], ["event_updated", "Event aktualisiert"], ["api_key_created", "API-Schlüssel"]];

export default async function activityView() {
  const projects = await loadProjects();
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const st = { kind: "", status: "", project: "", page: 0 };
  const list = h("div"), info = h("span.muted");
  async function load() {
    list.replaceChildren(h("div.skel", { style: { height: "300px" } }));
    let qy = sb.from("cc_activities").select("*", { count: "exact" });
    if (st.kind) qy = qy.eq("kind", st.kind);
    if (st.status) qy = qy.eq("status", st.status);
    if (st.project) qy = qy.eq("project_id", st.project);
    const { data, count } = await q(qy.order("created_at", { ascending: false }).range(st.page * PAGE, st.page * PAGE + PAGE - 1));
    info.textContent = `${fmtNum(count)} Einträge`;
    if (!data.length) return list.replaceChildren(h("div.card", empty("activity", "Keine Aktivitäten", "Mit diesen Filtern gibt es keine Einträge.")));
    // nach Tagen gruppieren
    const groups = data.reduce((m, a) => { const d = new Date(a.created_at).toLocaleDateString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }); (m[d] ??= []).push({ ...a, project: pname[a.project_id] }); return m; }, {});
    const pages = Math.ceil(count / PAGE);
    list.replaceChildren(h("div.stack", Object.entries(groups).map(([d, items]) => h("section.card", h("div.card-head", h("h3", d), h("span.sub", `${items.length}`)), h("div.card-body", timeline(items, { showProject: true }))))),
      pages > 1 ? h("div.row", { style: { justifyContent: "center", marginTop: "14px" } },
        h("button.btn.sm", { disabled: st.page === 0, onclick: () => { st.page--; load(); } }, icon("chevronL"), "Neuere"),
        h("span.muted", { style: { fontSize: "13px" } }, `Seite ${st.page + 1} von ${pages}`),
        h("button.btn.sm", { disabled: st.page >= pages - 1, onclick: () => { st.page++; load(); } }, "Ältere", icon("chevronR"))) : null);
  }
  const sel = (key, opts, label) => h("select.input", { style: { width: "auto" }, "aria-label": label, onchange: (e) => { st[key] = e.target.value; st.page = 0; load().catch(toastErr); } },
    h("option", { value: "" }, label), opts.map(([v, t]) => h("option", { value: v }, t)));
  load().catch(toastErr);
  return h("div",
    h("div.page-head", h("div", h("h1", "Aktivitäten"), h("p", "Systemprotokoll aller Projekte, Server und Integrationen. Enthält niemals Passwörter oder Schlüssel."))),
    h("div.row.wrap", { style: { marginBottom: "16px", gap: "8px" } },
      sel("kind", KINDS, "Alle Typen"), sel("status", [["ok", "OK"], ["info", "Info"], ["warning", "Warnung"], ["error", "Fehler"]], "Alle Status"),
      sel("project", projects.map((p) => [p.id, p.name]), "Alle Projekte"), h("span", { style: { marginLeft: "auto" } }, info)),
    list);
}
