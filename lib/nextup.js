// „Als Nächstes wichtig“ (Dashboard) und die JOPML-Release-Checkliste
import { rpc, getSetting, setSetting } from "./api.js";
import { h, icon, clear, toast, toastErr, confirmDialog, formModal } from "./ui.js";

// Zeigt, was jetzt Aufmerksamkeit braucht: überfällige Aufgaben, Fehler, nächstes Event, fehlende Sicherung …
export function nextUp() {
  const box = h("section.card.nextup", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3.row", icon("zap"), "Als Nächstes wichtig"), h("a.btn.sm.ghost", { href: "#/tasks" }, "Alle Aufgaben", icon("chevronR"))),
    h("div.card-body", h("div.skel", { style: { height: "60px" } })));
  rpc("cc_next_up").then((list) => {
    const body = box.querySelector(".card-body");
    if (!list.length) return clear(body, h("div.row", { style: { gap: "10px" } }, h("span.dot.ok"), h("span", "Alles im grünen Bereich – nichts Dringendes.")));
    const more = list.length - 6;
    const row = (x) => h("a.list-item.clickable", { href: x.route || "#/" }, h("span.dot", { class: x.level === "error" ? "bad" : x.level === "warning" ? "warn" : "ok" }),
      h("div.li-main", h("div.li-title", x.title), x.sub ? h("div.li-sub", x.sub) : null), icon("chevronR", "faint"));
    const rest = h("div.list.hidden", list.slice(6).map(row));
    clear(body, h("div.list", list.slice(0, 6).map(row)), rest,
      more > 0 ? h("button.btn.sm.ghost", { style: { marginTop: "8px" }, onclick: (e) => { rest.classList.remove("hidden"); e.currentTarget.remove(); } }, `${more} weitere anzeigen`) : null);
  }).catch((e) => clear(box.querySelector(".card-body"), h("div.faint", { style: { fontSize: "13px" } }, e.message)));
  return box;
}

const DEFAULT_STEPS = ["Neueste Arena beilegen", "release_notes/UPDATE_<Version>.md schreiben", "Ablaufplan und neue Ideen ergänzen", "Rechtstext aktualisieren (LEGAL_VERSION)", "Übersetzungen prüfen",
  "Version in core/version.py und RELEASE_NOTES.txt erhöhen", "Handbuch-Changelog ergänzen", "Automatische Tests ausführen", "Build erstellen und auf einem sauberen PC testen", "Auf GitHub veröffentlichen", "Über Admin > Publish an Nutzer verteilen"];

export function releaseChecklist() {
  const body = h("div.card-body", h("div.skel", { style: { height: "80px" } }));
  let st = null;
  const save = async () => { try { await setSetting("jopml_release", st); } catch (e) { toastErr(e); } };
  function draw() {
    const done = st.steps.filter((x) => x.done).length;
    clear(body, 
      h("div.row.between.wrap", { style: { marginBottom: "8px", gap: "8px" } }, h("span", h("strong", st.version ? `Version ${st.version}` : "Nächste Version"), h("span.faint", ` · ${done} von ${st.steps.length} erledigt`)),
        h("div.row", { style: { gap: "6px" } },
          h("button.btn.sm.ghost", { onclick: () => formModal("Schritt hinzufügen", [{ name: "t", label: "Schritt", required: true, max: 160 }], async (v) => { st.steps.push({ text: v.t, done: false }); await save(); draw(); }, { submit: "Hinzufügen" }) }, icon("plus"), "Schritt"),
          h("button.btn.sm", { onclick: () => formModal("Neue Version beginnen", [{ name: "v", label: "Versionsnummer", required: true, max: 20, placeholder: "1.14.0" }], async (v) => {
            if (done && done < st.steps.length && !(await confirmDialog("Trotzdem neu beginnen?", "Bei der aktuellen Version sind noch Schritte offen.", { ok: "Neu beginnen", danger: false }))) return;
            st = { version: v.v, steps: st.steps.map((x) => ({ text: x.text, done: false })), started: new Date().toISOString() }; await save(); draw(); toast("Checkliste zurückgesetzt");
          }, { submit: "Beginnen" }) }, icon("refresh"), "Neue Version"))),
      h("div.meter.ok", { style: { marginBottom: "10px" } }, h("i", { style: { width: `${(done / st.steps.length) * 100}%` } })),
      h("div.list", st.steps.map((x, i) => h("label.list-item", { style: { cursor: "pointer" } },
        h("input", { type: "checkbox", checked: x.done, style: { width: "18px", height: "18px", accentColor: "var(--primary)", flex: "none" }, onchange: async (e) => { x.done = e.target.checked; await save(); draw(); } }),
        h("div.li-main", h("div.li-title", { style: x.done ? { textDecoration: "line-through", color: "var(--text-3)" } : null }, `${i + 1}. ${x.text}`)),
        h("button.icon-btn", { "aria-label": "Schritt entfernen", onclick: async (e) => { e.preventDefault(); st.steps.splice(i, 1); await save(); draw(); } }, icon("x"))))));
  }
  getSetting("jopml_release", null).then((v) => { st = v?.steps?.length ? v : { version: "", steps: DEFAULT_STEPS.map((t) => ({ text: t, done: false })) }; draw(); })
    .catch((e) => clear(body, h("div.faint", e.message)));
  return h("section.card", h("div.card-head", h("h3.row", icon("check"), "Release-Checkliste"), h("span.sub", "Schritt für Schritt durchs Update")), body);
}
