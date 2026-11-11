// Ansicht „Zahlen“ oder „Diagramme“ – gilt für Dashboard, Projekt-Module und Nutzerbereich (pro Gerät gespeichert)
import { local } from "./api.js";
import { h, icon } from "./ui.js";

export const viewMode = () => (local.get("viewmode", "charts") === "numbers" ? "numbers" : "charts");
export const charts = () => viewMode() === "charts";

export function viewToggle() {
  const cur = viewMode();
  return h("div.seg", { role: "group", "aria-label": "Ansicht" }, [["numbers", "Zahlen", "note"], ["charts", "Diagramme", "chart"]].map(([v, t, ic]) =>
    h("button", { class: v === cur ? "on" : "", title: `Ansicht: ${t}`, onclick: () => { if (v === viewMode()) return; local.set("viewmode", v); dispatchEvent(new Event("hashchange")); dispatchEvent(new Event("viewmode")); } },
      icon(ic), h("span.hide-sm", ` ${t}`))));
}
