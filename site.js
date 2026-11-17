// Öffentliche Seiten aus dem Website-Baukasten anzeigen: w.html?s=<adresse>
// Die Seite läuft in einer Sandbox ohne Skripte; Links öffnen im neuen Tab.
import { rpc } from "./lib/api.js";

const root = document.getElementById("root");
const slug = (new URLSearchParams(location.search).get("s") || "").toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 41);
const fail = (t) => { root.className = "msg"; root.innerHTML = ""; const d = document.createElement("div"); d.innerHTML = `<p></p><p><a href="./">Zu JOPML Nexus</a></p>`; d.firstChild.textContent = t; root.append(d); };

(async () => {
  if (!slug) return fail("Keine Seite angegeben.");
  let s = null;
  try { s = await rpc("nx_site_public", { p_slug: slug }); } catch { return fail("Diese Seite ist gerade nicht erreichbar."); }
  if (!s?.html) return fail("Diese Seite gibt es nicht (mehr) oder sie ist nicht veröffentlicht.");
  document.title = s.title || "Seite";
  const f = document.createElement("iframe");
  f.setAttribute("sandbox", "allow-popups allow-popups-to-escape-sandbox allow-top-navigation-by-user-activation");
  f.setAttribute("referrerpolicy", "no-referrer");
  f.title = s.title || "Seite";
  f.srcdoc = s.html;
  root.className = ""; root.style.height = "100%"; root.replaceChildren(f);
})();
