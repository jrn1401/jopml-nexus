// Module / Projekt-Kacheln als schöne Website teilen: fester Link (w.html?s=…), Vorschau, Design wählen,
// „Für Öffentlichkeit anpassen“ mit KI, jederzeit aktualisieren – der Link bleibt gleich.
import { sb, q } from "./api.js";
import { h, icon, toast, toastErr, errMsg, modal, copyText, confirmDialog } from "./ui.js";
import { buildModulePage, STYLES } from "./progen.js";
import { slugify } from "./sitegen.js";
import { aiGen } from "./aigen.js";

const BASE = new URL("./", location.href).href;
export function moduleWidgets(m) {
  const c = m.config || {};
  if (Array.isArray(c.widgets)) return c.widgets;
  if (Array.isArray(c.items) && c.items.some((i) => i.url)) return [{ type: "links", title: m.name, items: c.items }];
  if (c.text || c.content) return [{ type: "markdown", title: "", content: c.text || c.content }];
  return [{ type: "markdown", content: Object.entries(c).filter(([, v]) => typeof v === "string" || typeof v === "number").map(([k, v]) => `- **${k}:** ${v}`).join("\n") }];
}
const find = async (key) => { try { const r = await q(sb.from("nx_sites").select("id,slug,published,data").contains("data", { share_key: key }).limit(1)); return r[0] || null; } catch { return null; } };

export async function refreshShare(key, { title, subtitle, widgets }) {
  const s = await find(key); if (!s?.published) return false;
  const style = s.data?.style || "nacht", pub = s.data?.public_widgets ? s.data.public_widgets : widgets;
  await q(sb.from("nx_sites").update({ html: buildModulePage({ title: s.data?.title || title, subtitle, widgets: pub, style }) }).eq("id", s.id));
  return true;
}

export async function shareWidgetsDialog({ key, title, subtitle = "", widgets }) {
  let site = await find(key);
  let style = site?.data?.style || "nacht", pubWidgets = site?.data?.public_widgets || null, pageTitle = site?.data?.title || title;
  const frame = h("iframe.form-prev", { title: "Vorschau", sandbox: "", style: { height: "420px" } });
  const html = () => buildModulePage({ title: pageTitle, subtitle, widgets: pubWidgets || widgets, style });
  const refresh = () => { frame.srcdoc = html(); };
  const link = () => (site ? `${BASE}w.html?s=${site.slug}` : "");
  const status = h("div");
  const drawStatus = () => status.replaceChildren(site?.published
    ? h("div.stack", { style: { gap: "8px" } }, h("div.row", { style: { gap: "8px" } }, h("input.input", { value: link(), readonly: true, "aria-label": "Link" }), h("button.btn", { onclick: () => copyText(link()) }, icon("copy")), h("a.btn", { href: link(), target: "_blank", rel: "noopener" }, icon("external"))),
      h("div.faint", { style: { fontSize: "12.5px" } }, "Online. Änderungen am Modul → „Aktualisieren“ (passiert beim Bearbeiten automatisch). Der Link bleibt gleich."))
    : h("div.faint", { style: { fontSize: "13px" } }, "Noch nicht geteilt. „Link erstellen“ macht daraus eine öffentliche Seite – nur wer den Link hat, sieht sie."));
  const publish = async (b) => {
    b.disabled = true;
    try {
      const row = { title: pageTitle.slice(0, 120), template: "custom", html: html(), published: true, data: { share_key: key, style, title: pageTitle, public_widgets: pubWidgets && JSON.stringify(pubWidgets).length < 15000 ? pubWidgets : null } };
      if (site) { await q(sb.from("nx_sites").update(row).eq("id", site.id)); site.published = true; }
      else { const slug = `${slugify(pageTitle).slice(0, 28)}-${Math.random().toString(36).slice(2, 6)}`; site = (await q(sb.from("nx_sites").insert({ ...row, slug }).select("id,slug,published,data").single())) || { slug }; }
      site.published = true; drawStatus(); toast("Link ist aktuell");
    } catch (e) { toastErr(e); }
    b.disabled = false;
  };
  const aiPublic = async (b) => {
    b.disabled = true; b.textContent = "KI passt an …";
    try {
      const r = await aiGen({ task: "modul-oeffentlich", json: true, maxTokens: 4000, instructions: 'Mache aus den Kacheln eine Version für die Öffentlichkeit (Gäste, Freunde, Partner): verständlich, freundlich, schön gegliedert. Entferne interne Infos (Kosten, Gewinn, Kalkulation, Kontaktdaten Dritter, interne Notizen, Passwörter). Behalte nützliche Infos (Datum, Ort, Ablauf, Regeln, Links). Gleiche Kachel-Typen verwenden (markdown, checklist, timeline, table, stats, links). Antworte NUR mit JSON: {"title":"…","widgets":[…]}',
        input: JSON.stringify({ title, widgets }).slice(0, 18000) });
      if (Array.isArray(r.json?.widgets) && r.json.widgets.length) { pubWidgets = r.json.widgets.slice(0, 20); if (r.json.title) pageTitle = String(r.json.title).slice(0, 120); refresh(); toast("Öffentliche Version erstellt – prüfen und „Link erstellen/Aktualisieren“"); }
      else toast("Die KI hat nichts geliefert.", "info");
    } catch (e) { toastErr(e); }
    b.disabled = false; b.replaceChildren(icon("sparkles"), "Für Öffentlichkeit anpassen (KI)");
  };
  const styles = h("div.row.wrap", { style: { gap: "6px" } }, Object.entries(STYLES).map(([k, t]) => h("button.chip", { type: "button", class: style === k ? "on" : "", onclick: (e) => { style = k; e.currentTarget.parentElement.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === e.currentTarget)); refresh(); } },
    h("span", { style: { display: "inline-block", width: "11px", height: "11px", borderRadius: "50%", background: `linear-gradient(135deg,${t.a},${t.b})`, marginRight: "6px" } }), t.name)));
  modal(`Als Website teilen: ${title}`.slice(0, 80), h("div.stack",
    h("p.muted", { style: { margin: 0 } }, "Macht aus diesem Modul eine eigene, schöne Seite mit Link – zum Weiterschicken per WhatsApp, Instagram-Bio oder E-Mail."),
    styles, frame, status,
    h("div.row.wrap", { style: { gap: "8px" } },
      h("button.btn.primary", { onclick: (e) => publish(e.currentTarget) }, icon("upload"), site ? "Aktualisieren" : "Link erstellen"),
      h("button.btn", { onclick: (e) => aiPublic(e.currentTarget) }, icon("sparkles"), "Für Öffentlichkeit anpassen (KI)"),
      pubWidgets ? h("button.btn.ghost", { onclick: () => { pubWidgets = null; pageTitle = title; refresh(); } }, "Original-Inhalt") : null,
      site?.published ? h("button.btn.ghost", { onclick: async () => { if (!(await confirmDialog("Nicht mehr teilen?", "Der Link funktioniert danach nicht mehr.", { ok: "Beenden" }))) return; try { await q(sb.from("nx_sites").update({ published: false }).eq("id", site.id)); site.published = false; drawStatus(); } catch (er) { toast(errMsg(er), "err"); } } }, "Nicht mehr teilen") : null)), { wide: true });
  refresh(); drawStatus();
}
