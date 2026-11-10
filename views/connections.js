// Admin: eigene Verbindungen (gleicher Assistent wie im Nutzerbereich) + anonyme Statistik der Nutzerbereiche.
import { rpc, nx } from "../lib/api.js";
import { h, icon, toast, toastErr, naNote } from "../lib/ui.js";
import { connectDialog, connectionsList, PROVIDERS } from "../lib/connect.js";

export default async function connectionsView() {
  const wrap = h("div");
  const draw = async () => {
    const [list, st] = await Promise.all([connectionsList(draw), rpc("cc_workspace_stats").catch(() => null)]);
    const kv = (k, v) => h("div.list-item", h("div.li-main", h("div.li-title", k)), h("strong", String(v)));
    wrap.replaceChildren(
      h("div.page-head", h("div", h("h1", "Verbindungen"), h("p", "API-Schlüssel einfügen – Dienst wird erkannt, geprüft, verschlüsselt gespeichert und stündlich abgerufen.")),
        h("div.row", { style: { gap: "8px" } },
          h("button.btn", { onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await nx("sync"); const bad = r.results.filter((x) => x.error).length; toast(bad ? `${bad} Fehler` : `${r.results.length} aktualisiert`, bad ? "err" : "ok"); draw(); } catch (er) { toastErr(er); } } }, icon("refresh"), "Alle abrufen"),
          h("button.btn.primary", { onclick: () => connectDialog(draw) }, icon("plus"), "Verbinden"))),
      h("div.grid.g-2",
        h("section.card", h("div.card-head", h("h3", "Meine Verbindungen")), h("div.card-body", list,
          naNote("Websites, Repos und Datenbanken aus deinen Verbindungen erscheinen zusätzlich unter „Projekte“."))),
        h("section.card", h("div.card-head", h("h3", "Nutzerbereiche (anonym)")), h("div.card-body", st ? h("div.list",
          kv("Nutzer mit eigenen Daten", st.users_with_data), kv("Projekte in Nutzerbereichen", st.projects),
          kv("Verbindungen gesamt", Object.values(st.connections || {}).reduce((a, b) => a + b, 0)),
          ...Object.entries(st.connections || {}).map(([k, n]) => kv(`· ${PROVIDERS.find((p) => p[0] === k)?.[1] ?? k}`, n)),
          kv("KI-Fragen heute", st.ai_today)) : naNote("Statistik nicht verfügbar.")))));
  };
  await draw();
  return wrap;
}
