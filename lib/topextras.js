// Knöpfe oben rechts für alle: „Launcher“ (JOPML Makro Launcher – Download/Version, immer aktuell)
// und „Handy-App“ (Nexus Mobil mit Push). Leicht: Infos werden erst beim Antippen geladen.
import { h, icon, modal, copyText } from "./ui.js";
import { launcherCard } from "../views/public.js";

const phone = () => { const el = document.createElementNS("http://www.w3.org/2000/svg", "svg"); el.setAttribute("viewBox", "0 0 24 24"); el.setAttribute("fill", "none"); el.setAttribute("stroke", "currentColor"); el.setAttribute("stroke-width", "1.8"); el.setAttribute("stroke-linecap", "round"); el.setAttribute("aria-hidden", "true");
  el.innerHTML = '<rect x="6" y="2.5" width="12" height="19" rx="2.5"/><path d="M10.5 18.5h3"/>'; return el; };
const MOBILE_URL = () => `${location.origin}${location.pathname.replace(/[^/]*$/, "")}m.html`;
const isPhone = () => matchMedia("(max-width: 760px)").matches || /iphone|android/i.test(navigator.userAgent);

export function launcherButton() {
  return h("button.top-pill", { title: "JOPML Makro Launcher", "aria-label": "JOPML Makro Launcher herunterladen", onclick: () => {
    modal("JOPML Makro Launcher", h("div.stack",
      h("p", { style: { margin: 0 } }, "Noch nicht installiert? Hier die aktuelle Version laden. Schon installiert? Dann einfach über das Startmenü öffnen – er hält sich selbst aktuell."),
      launcherCard({ compact: true })));
  } }, icon("download"), h("span", "Launcher"));
}

export function appButton() {
  return h("button.top-pill", { title: "Handy-App mit Benachrichtigungen", "aria-label": "Handy-App öffnen", onclick: () => {
    if (isPhone()) { location.href = MOBILE_URL(); return; }
    modal("Nexus aufs Handy", h("div.stack",
      h("p", { style: { margin: 0 } }, "Die Handy-App zeigt das Wichtigste auf einen Blick – mit Benachrichtigungen, geteilten Links und KI-Chat. Kein App-Store nötig."),
      h("ol", { style: { lineHeight: 1.7, margin: 0, paddingLeft: "20px" } },
        h("li", "Diesen Link auf dem Handy öffnen (iPhone: in Safari):"),
        h("li", "„Teilen“ → „Zum Home-Bildschirm“ → „Hinzufügen“."),
        h("li", "Nexus vom Home-Bildschirm öffnen, anmelden, unter Einstellungen „Benachrichtigungen aktivieren“.")),
      h("div.row", { style: { gap: "8px" } }, h("input.input.mono", { readOnly: true, value: MOBILE_URL(), "aria-label": "Link zur Handy-App", onclick: (e) => e.target.select() }),
        h("button.btn", { onclick: () => copyText(MOBILE_URL()) }, "Kopieren")),
      h("a.btn.primary", { href: MOBILE_URL(), target: "_blank", rel: "noopener" }, "Hier im Browser ansehen")));
  } }, phone(), h("span", "Handy-App"));
}
