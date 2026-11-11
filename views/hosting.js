// #/hosting – alle eigenen Geräte und die darauf gehosteten Apps auf einen Blick
import { sb, q } from "../lib/api.js";
import { h, icon, badge, SERVER_STATUS, fmtAgo, empty } from "../lib/ui.js";
import { connectServer } from "../lib/actions.js";
import { hostingPanel, APP_STATE } from "../lib/hosting.js";

export default async function hostingView() {
  const [all, apps] = await Promise.all([
    q(sb.from("cc_servers").select("*").neq("kind", "cloud").order("name")),
    q(sb.from("cc_host_apps").select("id,server_id,state,public_url,desired")),
  ]);
  const servers = all.filter((s) => s.kind !== "cloud");
  const running = apps.filter((a) => a.state === "running").length;
  const publicN = apps.filter((a) => a.public_url).length;
  const problems = apps.filter((a) => a.state === "error" || a.state === "unsupported").length;
  const head = h("div.page-head", h("div", h("h1", "Hosting"),
    h("p", `${servers.length} Gerät(e) · ${apps.length} App(s) · ${running} laufen · ${publicN} öffentlich erreichbar${problems ? ` · ${problems} mit Problem` : ""}`)),
    h("div.actions", h("button.btn.primary", { onclick: connectServer }, icon("plus"), "Gerät verbinden")));

  if (!servers.length) {
    return h("div", head, h("div.card", empty("server", "Noch kein Gerät verbunden",
      "Verbinde einen PC, Laptop, Raspberry Pi oder Server. Darauf läuft dann der Nexus-Agent – und du kannst von hier aus Websites und Apps darauf starten, stoppen und öffentlich erreichbar machen.",
      h("button.btn.primary", { onclick: connectServer }, icon("plus"), "Gerät verbinden"))),
      howItWorks());
  }
  return h("div", head,
    h("div.grid.g-4", { style: { marginBottom: "16px" } },
      stat("Geräte online", `${servers.filter((s) => s.status === "online" || s.status === "warning").length} / ${servers.length}`, "server"),
      stat("Apps laufen", `${running} / ${apps.length}`, "play"),
      stat("Öffentliche Links", String(publicN), "globe"),
      stat("Probleme", String(problems), "alert")),
    h("div.stack", { style: { gap: "16px" } }, servers.map((s) => h("div",
      h("div.row.wrap", { style: { gap: "10px", margin: "0 0 8px" } }, h("a.li-title", { href: `#/servers/${s.id}` }, s.name), badge(SERVER_STATUS, s.status),
        h("span.faint", { style: { fontSize: "12.5px" } }, [s.os, s.last_heartbeat ? `Heartbeat ${fmtAgo(s.last_heartbeat)}` : "noch nie verbunden"].filter(Boolean).join(" · ")),
        h("span.faint", { style: { fontSize: "12.5px" } }, Object.entries(countBy(apps.filter((a) => a.server_id === s.id))).map(([k, n]) => `${n} ${APP_STATE[k]?.[0] || k}`).join(" · "))),
      hostingPanel(s)))),
    howItWorks());

  function stat(label, v, ic) { return h("div.card.stat", h("div.k", icon(ic), label), h("div.v", v)); }
}

const countBy = (arr) => arr.reduce((o, a) => ((o[a.state] = (o[a.state] || 0) + 1), o), {});

function howItWorks() {
  return h("details.card.card-pad", { style: { marginTop: "16px" } }, h("summary", h("strong", "So funktioniert Hosting")),
    h("ol", { style: { fontSize: "13.5px", lineHeight: 1.6, margin: "10px 0 0", paddingLeft: "20px" } },
      h("li", "„Gerät verbinden“ erzeugt einen Schlüssel und fertige Befehle für Windows oder Linux. Der Agent (Python) läuft dann auf dem Gerät."),
      h("li", "Auf der Geräteseite „App hosten“: Ordner, Projektdateien aus dem Nexus, Git-Repo, eigener Startbefehl oder Docker."),
      h("li", "Der Agent holt sich alle 5 Sekunden den Soll-Zustand, startet/stoppt die App und meldet Zustand, Adressen und Log zurück."),
      h("li", "„Öffentlicher Link“ nutzt einen Cloudflare-Tunnel (cloudflared auf dem Gerät): keine Router-Freigabe nötig, der Link ändert sich bei jedem Neustart."),
      h("li", "Sicherheit: Eigene Befehle und Docker laufen nur, wenn sie auf dem Gerät selbst mit CC_ALLOW_COMMANDS=1 erlaubt sind. Statische Seiten liefern nie versteckte Dateien oder Schlüssel aus.")));
}

