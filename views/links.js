// #/links – Marketing: Tracking-Links. Jeder Kanal (Instagram, TikTok, Flyer-QR …) bekommt einen eigenen Kurzlink,
// die Klicks werden ohne Cookies und ohne IP gezählt. So siehst du, welcher Kanal wirklich Besucher bringt.
import { sb, q, rpc } from "../lib/api.js";
import { h, icon, clear, fmtNum, fmtAgo, empty, formModal, confirmDialog, toast, toastErr, copyText, modal } from "../lib/ui.js";
import { barChart, donut, PALETTE } from "../lib/charts.js";
import { CONFIG } from "../config.js";

const CHANNELS = ["instagram", "tiktok", "whatsapp", "flyer", "story", "bio", "freunde", "website", "sonstiges"];
export const shortUrl = (slug) => `${CONFIG.supabaseUrl}/functions/v1/nx-hub/l/${slug}`;

export default async function linksView() {
  const root = h("div");
  const events = await q(sb.from("cc_events").select("id,name,metadata").neq("status", "cancelled").order("event_date"));
  async function load() {
    const s = await rpc("cc_links_stats", { p_days: 30 });
    const total = s.links.reduce((a, l) => a + l.clicks, 0), recent = s.links.reduce((a, l) => a + l.recent, 0);
    const best = s.channels.filter((c) => c.clicks > 0)[0];
    clear(root, 
      h("div.page-head", h("div", h("h1", "Marketing-Links"), h("p", `${s.links.length} Link(s) · ${fmtNum(total)} Klicks insgesamt · ${fmtNum(recent)} in 30 Tagen${best ? ` · stärkster Kanal: ${best.channel}` : ""}`)),
        h("div.actions", h("button.btn.primary", { onclick: () => edit() }, icon("plus"), "Neuer Link"))),
      s.links.length ? [
        h("div.grid.g-2", { style: { marginBottom: "16px", alignItems: "start" } },
          h("section.card", h("div.card-head", h("h3", "Klicks pro Tag"), h("span.sub", "letzte 30 Tage")), h("div.card-body",
            barChart(s.daily.map((d) => new Date(d.d).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })), [{ name: "Klicks", values: s.daily.map((d) => d.n), color: PALETTE[0] }], { height: 190, emptyText: "Noch keine Klicks" }))),
          h("section.card", h("div.card-head", h("h3", "Welcher Kanal bringt Besucher?"), h("span.sub", "letzte 30 Tage")), h("div.card-body",
            s.channels.some((c) => c.clicks) ? donut(s.channels.filter((c) => c.clicks).map((c) => ({ name: c.channel, value: c.clicks })), { center: fmtNum(recent) }) : h("div.faint", { style: { fontSize: "13px" } }, "Sobald jemand einen Link anklickt, erscheint hier die Verteilung.")))),
        h("section.card", h("div.card-head", h("h3", "Alle Links")), h("div.card-body", h("div.list", s.links.map((l) => h("div.list-item",
          h("div.li-icon", icon("link")),
          h("div.li-main", h("div.li-title", l.label || l.slug, " ", h("span.tag", l.channel)),
            h("div.li-sub.mono", { style: { wordBreak: "break-all" } }, shortUrl(l.slug)),
            h("div.li-sub", `→ ${l.target.replace(/^https?:\/\//, "").slice(0, 70)}${l.last_click ? ` · letzter Klick ${fmtAgo(l.last_click)}` : ""}`)),
          h("div", { style: { textAlign: "right", minWidth: "70px" } }, h("div", { style: { fontSize: "20px", fontWeight: 650 } }, fmtNum(l.clicks)), h("div.faint", { style: { fontSize: "11.5px" } }, `Klicks · ${l.recent} in 30 T.`)),
          h("button.icon-btn", { title: "Link kopieren", "aria-label": "Kopieren", onclick: () => copyText(shortUrl(l.slug)) }, icon("copy")),
          h("button.icon-btn", { title: "QR-Code für Flyer", "aria-label": "QR-Code", onclick: () => qr(l) }, icon("eye")),
          h("button.icon-btn", { "aria-label": "Bearbeiten", onclick: () => edit(l) }, icon("edit")),
          h("button.icon-btn", { "aria-label": "Löschen", onclick: async () => { if (await confirmDialog("Link löschen?", `„${l.label || l.slug}“ funktioniert danach nicht mehr – auch nicht auf schon gedruckten Flyern.`, { ok: "Löschen" })) { await q(sb.from("cc_links").delete().eq("id", l.id)); load(); } } }, icon("trash"))))))),
      ] : h("div.card", empty("link", "Noch keine Links", "Lege für jeden Kanal einen eigenen Link zu deiner Ticket- oder Event-Seite an – z. B. einen für die Instagram-Bio, einen für TikTok und einen als QR-Code auf dem Flyer. Dann siehst du, was wirklich funktioniert.",
        h("button.btn.primary", { onclick: () => edit() }, icon("plus"), "Ersten Link anlegen"))),
      h("p.faint", { style: { fontSize: "12.5px", marginTop: "14px" } }, "Gezählt werden nur Klicks (Zeit, Gerätetyp, verweisende Seite) – keine IP-Adressen, keine Cookies. Vorschau-Abrufe von WhatsApp, Instagram & Co. werden nicht mitgezählt. Ob aus einem Klick ein Ticketkauf wird, kann Eventfrog nicht zurückmelden."));
  }
  function edit(l) {
    const ef = events.find((e) => e.metadata?.eventfrog?.url);
    formModal(l ? "Link bearbeiten" : "Neuer Tracking-Link", [
      { name: "label", label: "Bezeichnung", required: true, max: 120, value: l?.label, placeholder: "z. B. Instagram-Bio" },
      { name: "target", label: "Ziel (wohin der Link führt)", required: true, max: 1000, value: l?.target || ef?.metadata?.eventfrog?.url || "https://raveanation.netlify.app/", placeholder: "https://…" },
      { name: "channel", label: "Kanal", type: "select", value: l?.channel || "instagram", half: true, options: CHANNELS.map((c) => [c, c[0].toUpperCase() + c.slice(1)]) },
      { name: "slug", label: "Kurzname im Link", required: true, max: 40, value: l?.slug || "", half: true, placeholder: "rave-insta", hint: "Kleinbuchstaben, Zahlen, Bindestrich" },
      { name: "event_id", label: "Event (optional)", type: "select", value: l?.event_id || "", options: [["", "– keins –"], ...events.map((e) => [e.id, e.name])] },
    ], async (v) => {
      const slug = v.slug.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
      if (!/^[a-z0-9-]{3,40}$/.test(slug)) throw new Error("Kurzname: 3–40 Zeichen, nur Kleinbuchstaben, Zahlen und Bindestrich.");
      if (!/^https?:\/\//i.test(v.target)) throw new Error("Das Ziel muss mit https:// beginnen.");
      const row = { label: v.label, target: v.target, channel: v.channel, slug, event_id: v.event_id || null };
      const { error } = l ? await sb.from("cc_links").update(row).eq("id", l.id) : await sb.from("cc_links").insert(row);
      if (error) throw new Error(/duplicate|unique/i.test(error.message) ? "Diesen Kurznamen gibt es schon." : error.message);
      toast("Gespeichert"); load();
    }, { submit: l ? "Speichern" : "Anlegen" });
  }
  // QR-Code ohne fremde Dienste: wird im Browser erzeugt
  async function qr(l) {
    const box = h("div", { style: { display: "grid", placeItems: "center", padding: "10px", background: "#fff", borderRadius: "12px" } }, h("div.spinner"));
    modal(`QR-Code: ${l.label || l.slug}`, h("div.stack", box, h("p.faint", { style: { fontSize: "12.5px", margin: 0, wordBreak: "break-all" } }, shortUrl(l.slug))), {
      foot: [h("button.btn.primary", { onclick: () => { const c = box.querySelector("canvas"); if (!c) return; const a = document.createElement("a"); a.download = `qr-${l.slug}.png`; a.href = c.toDataURL("image/png"); a.click(); } }, icon("download"), "Als Bild speichern")] });
    try {
      const QR = (await import("https://cdn.jsdelivr.net/npm/qrcode@1.5.4/+esm")).default;
      const canvas = document.createElement("canvas");
      await QR.toCanvas(canvas, shortUrl(l.slug), { width: 320, margin: 2, errorCorrectionLevel: "M" });
      clear(box, canvas);
    } catch (e) { clear(box, h("div", { style: { color: "#000" } }, "QR-Code konnte nicht erzeugt werden.")); toastErr(e); }
  }
  await load();
  return root;
}
