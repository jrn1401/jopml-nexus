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
      await webCockpit(site, { onShare: () => openShareDialog("site", site.id, site.name) }));
  }
  return h("div",
    h("div.page-head", h("div", h("h1", "Websites"), h("p", "Live-Besucher, Erreichbarkeit und Netlify-Daten aller Websites"))),
    await webList((r) => r.source === "cc" ? `#/projects/${r.source_id}` : `#/web/${r.id}`));
}
