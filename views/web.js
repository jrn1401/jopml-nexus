// Admin: „Websites“ – alle Websites mit Live-Besuchern, Detailseite = Website-Cockpit
import { h, icon, empty } from "../lib/ui.js";
import { webList, webCockpit } from "../lib/web.js";
import { sb, q } from "../lib/api.js";
import { openShareDialog } from "../lib/share.js";

export default async function webView({ args: [id] }) {
  if (id) {
    const site = await q(sb.from("cc_web_sites").select("*").eq("id", id).maybeSingle());
    if (!site) return empty("globe", "Website nicht gefunden", "", h("a.btn", { href: "#/web" }, "Zu den Websites"));
    return h("div",
      h("div.crumb", h("a", { href: "#/web" }, "Websites"), icon("chevronR"), h("span", site.name)),
      h("div.page-head", h("div", h("h1", site.name), h("p", site.url?.replace(/^https?:\/\//, "")))),
      /^https:\/\//.test(site.url || "") ? sitePreview(site.url) : null,
      await webCockpit(site, { onShare: () => openShareDialog("site", site.id, site.name) }));
  }
  return h("div",
    h("div.page-head", h("div", h("h1", "Websites"), h("p", "Live-Besucher, Erreichbarkeit und Netlify-Daten aller Websites"))),
    await webList((r) => r.source === "cc" ? `#/projects/${r.source_id}` : `#/web/${r.id}`));
}

// Live-Vorschau der echten Website (Computer/Handy), sandboxed
function sitePreview(url) {
  const f = h("iframe", { src: url, title: "Website-Vorschau", sandbox: "allow-scripts", loading: "lazy", referrerpolicy: "no-referrer", style: { width: "100%", height: "520px", border: "1px solid var(--line)", borderRadius: "12px", background: "#fff", display: "block", margin: "0 auto" } });
  const set = (w) => { f.style.width = w; };
  return h("section.card", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3", "Vorschau"), h("div.row", { style: { gap: "6px" } },
    h("button.chip", { type: "button", onclick: () => set("100%") }, "Computer"), h("button.chip", { type: "button", onclick: () => set("390px") }, "Handy"),
    h("a.btn.sm", { href: url, target: "_blank", rel: "noopener" }, icon("external"), "Öffnen"))),
    h("div.card-body", f, h("div.faint", { style: { fontSize: "12px", marginTop: "6px" } }, "Bleibt die Fläche leer, erlaubt die Website keine Einbettung – dann „Öffnen“.")));
}
