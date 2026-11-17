// Website-Baukasten: erzeugt fertige, schnelle Einzelseiten (HTML + CSS, keine Skripte, keine Cookies).
// Vorlagen: Event, Link-Seite, Benachrichtigungs-Seite (Push ohne Konto), Projekt-Steckbrief.
import { qrSvg } from "./qr.js";

export const TEMPLATES = {
  event: { name: "Event-Seite", desc: "Datum, Ort, Line-up, Ticket-Knopf und QR-Code.", fields: [["title", "Name des Events"], ["subtitle", "Untertitel / Motto"], ["date", "Datum & Uhrzeit", "datetime-local"], ["place", "Ort / Adresse"], ["ticket", "Ticket-Link (https://…)"], ["lineup", "Line-up / Programm (eine Zeile pro Punkt)", "textarea"], ["text", "Beschreibung", "textarea"], ["age", "Einlass / Alter (z. B. ab 16, Ausweis Pflicht)"]] },
  links: { name: "Link-Seite", desc: "Alle deine Links auf einer Seite – ideal für Instagram/TikTok.", fields: [["title", "Name"], ["subtitle", "Kurzbeschreibung"], ["links", "Links (pro Zeile: Titel | https://…)", "textarea"]] },
  notify: { name: "Benachrichtigungs-Seite", desc: "Besucher holen sich Push-Nachrichten aufs Handy – ohne App, ohne Konto.", fields: [["title", "Überschrift (z. B. Ticket-Alarm)"], ["subtitle", "Was bekommen die Leute?"], ["text", "Mehr Infos (optional)", "textarea"]] },
  legal: { name: "Impressum-Seite", desc: "Anbieterkennzeichnung nach § 5 DDG – zum Verlinken im Footer deiner Seiten.", fields: [["title", "Überschrift", "text"], ["name", "Name / Firma (bei Firmen mit Rechtsform)"], ["address", "Anschrift (Straße, PLZ Ort)", "textarea"], ["email", "E-Mail"], ["phone", "Telefon (optional)"], ["rep", "Vertretungsberechtigt (bei Firmen/Vereinen, optional)"], ["register", "Register + Nummer (optional, z. B. Amtsgericht Berlin, HRB …)"], ["vat", "USt-IdNr. / W-IdNr. (falls vorhanden)"]] },
  project: { name: "Projekt-Steckbrief", desc: "Projekt vorstellen: Ziel, Highlights, Status, Links.", fields: [["title", "Projektname"], ["subtitle", "Ein Satz, worum es geht"], ["highlights", "Highlights (eine Zeile pro Punkt)", "textarea"], ["status", "Stand / Fortschritt"], ["links", "Links (pro Zeile: Titel | https://…)", "textarea"], ["text", "Beschreibung", "textarea"]] },
};

export const THEMES = {
  nacht: { name: "Nacht", bg: "#0b0c14", fg: "#eef0ff", mute: "#a3a8c3", card: "#151728", a: "#8b8cff", b: "#46d3ee" },
  rave: { name: "Rave", bg: "#0d0414", fg: "#fff0fb", mute: "#cfa3c9", card: "#1c0b26", a: "#c13cff", b: "#ff3c8e" },
  sunset: { name: "Sunset", bg: "#1a0a14", fg: "#fff3ee", mute: "#e0b3a7", card: "#2a1220", a: "#ff7a59", b: "#e879b5" },
  hell: { name: "Hell", bg: "#f7f7fb", fg: "#14151c", mute: "#5d6175", card: "#ffffff", a: "#5b5bf0", b: "#0fa3b1" },
  natur: { name: "Natur", bg: "#0c1410", fg: "#eefbf3", mute: "#a6c4b2", card: "#14231b", a: "#3ccf8e", b: "#c7e86b" },
};

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const safeUrl = (u) => (/^https:\/\/[^\s"'<>]+$/i.test(String(u || "").trim()) ? String(u).trim() : "");
const lines = (t) => String(t || "").split("\n").map((x) => x.trim()).filter(Boolean);
const linkList = (t) => lines(t).map((l) => { const [a, b] = l.includes("|") ? l.split("|") : [l, l]; return { t: a.trim(), u: safeUrl(b) }; }).filter((x) => x.u);
const para = (t) => lines(t).map((p) => `<p>${esc(p)}</p>`).join("");
const fmtDate = (d) => { try { return d ? new Date(d).toLocaleString("de-DE", { weekday: "long", day: "2-digit", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" }) + " Uhr" : ""; } catch { return ""; } };

function shell(th, title, desc, body) {
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}"><style>
*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,sans-serif;background:${th.bg};color:${th.fg};line-height:1.55}
.hero{position:relative;padding:64px 22px 48px;overflow:hidden;background:radial-gradient(circle at 85% 10%,${th.a}cc,transparent 55%),radial-gradient(circle at 0% 100%,${th.b}99,transparent 60%),${th.bg}}
.wrap{max-width:720px;margin:0 auto;position:relative}h1{font-size:clamp(34px,8vw,58px);line-height:1.05;margin:0 0 12px;letter-spacing:-.03em}
.sub{font-size:19px;color:${th.fg};opacity:.88;margin:0}.meta{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.pill{background:${th.card}cc;border:1px solid ${th.a}55;padding:8px 14px;border-radius:99px;font-size:14.5px}
main{max-width:720px;margin:0 auto;padding:26px 22px 60px}.card{background:${th.card};border:1px solid ${th.a}33;border-radius:20px;padding:20px;margin:0 0 16px}
.card h2{font-size:15px;text-transform:uppercase;letter-spacing:.08em;color:${th.mute};margin:0 0 10px}p{margin:0 0 10px}
.btn{display:block;text-align:center;text-decoration:none;font-weight:700;font-size:17px;padding:16px 20px;border-radius:16px;background:linear-gradient(90deg,${th.a},${th.b});color:#0b0b10;margin:10px 0}
.btn.ghost{background:transparent;color:${th.fg};border:1.5px solid ${th.a}88}ul{margin:0;padding-left:20px}li{margin:4px 0}
.qr{display:flex;gap:16px;align-items:center}.qr svg{width:120px;height:120px;border-radius:12px;flex:none}.small{font-size:13px;color:${th.mute}}
footer{text-align:center;font-size:12.5px;color:${th.mute};padding:0 20px 40px}footer a{color:${th.mute}}ol{padding-left:20px;margin:0}
</style></head><body>${body}<footer>Erstellt mit JOPML Nexus · keine Cookies, kein Tracking</footer></body></html>`;
}

// d = Feldwerte, th = Thema-Schlüssel, extra = { url (öffentliche Adresse der Seite), invite (Code) }
export function buildSite(template, d, themeKey = "nacht", extra = {}) {
  const th = THEMES[themeKey] || THEMES.nacht;
  const title = d.title || TEMPLATES[template]?.name || "Seite";
  const hero = (pills = "") => `<header class="hero"><div class="wrap"><h1>${esc(title)}</h1>${d.subtitle ? `<p class="sub">${esc(d.subtitle)}</p>` : ""}${pills ? `<div class="meta">${pills}</div>` : ""}</div></header>`;
  const qr = (url, label) => url ? `<div class="card qr">${qrSvg(url, { size: 120, dark: "#000", light: "#fff" })}<div><b>${esc(label)}</b><div class="small">${esc(url)}</div></div></div>` : "";
  if (template === "event") {
    const ticket = safeUrl(d.ticket);
    const pills = [d.date && `<span class="pill">📅 ${esc(fmtDate(d.date))}</span>`, d.place && `<span class="pill">📍 ${esc(d.place)}</span>`, d.age && `<span class="pill">🪪 ${esc(d.age)}</span>`].filter(Boolean).join("");
    return shell(th, title, d.subtitle || "", hero(pills) + `<main>${ticket ? `<a class="btn" href="${esc(ticket)}" target="_blank" rel="noopener">🎟️ Tickets sichern</a>` : ""}
${extra.invite ? `<a class="btn ghost" href="${esc(extra.notifyUrl)}" target="_top">🔔 Ticket-Alarm aufs Handy</a>` : ""}
${d.text ? `<section class="card"><h2>Infos</h2>${para(d.text)}</section>` : ""}
${lines(d.lineup).length ? `<section class="card"><h2>Line-up & Ablauf</h2><ul>${lines(d.lineup).map((l) => `<li>${esc(l)}</li>`).join("")}</ul></section>` : ""}
${d.place ? `<section class="card"><h2>Anfahrt</h2><p>${esc(d.place)}</p><a class="btn ghost" href="https://www.google.com/maps/search/?api=1&amp;query=${encodeURIComponent(d.place)}" target="_blank" rel="noopener">In Karten öffnen</a></section>` : ""}
${qr(ticket || extra.url, ticket ? "Tickets per QR-Code" : "Diese Seite teilen")}</main>`);
  }
  if (template === "links") {
    const ls = linkList(d.links);
    return shell(th, title, d.subtitle || "", hero() + `<main>${ls.map((l) => `<a class="btn ${ls.indexOf(l) ? "ghost" : ""}" href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)}</a>`).join("")}${qr(extra.url, "Diese Seite teilen")}</main>`);
  }
  if (template === "notify") {
    return shell(th, title, d.subtitle || "", hero() + `<main>
${extra.invite ? `<a class="btn" href="${esc(extra.notifyUrl)}" target="_top">🔔 Benachrichtigungen aktivieren</a>` : `<section class="card"><p>Benachrichtigungen sind noch nicht eingerichtet.</p></section>`}
<section class="card"><h2>So geht's</h2><ol><li>Auf den Knopf tippen.</li><li>iPhone: in Safari „Teilen“ → „Zum Home-Bildschirm“, dann von dort öffnen.</li><li>„Benachrichtigungen erlauben“ – fertig. Kein Konto, keine App.</li></ol></section>
${d.text ? `<section class="card"><h2>Infos</h2>${para(d.text)}</section>` : ""}
${qr(extra.notifyUrl, "QR scannen, um Benachrichtigungen zu bekommen")}
<p class="small">Abmelden geht jederzeit auf derselben Seite. Es wird nur ein technischer Push-Schlüssel deines Geräts gespeichert.</p></main>`);
  }
  if (template === "legal") {
    const row = (k, v) => (v ? `<p><b>${esc(k)}:</b> ${esc(v)}</p>` : "");
    return shell(th, title || "Impressum", "Impressum", `<header class="hero"><div class="wrap"><h1>${esc(d.title || "Impressum")}</h1></div></header><main>
<section class="card"><h2>Angaben gemäß § 5 DDG</h2><p>${esc(d.name || "")}</p>${lines(d.address).map((l) => `<p style="margin:0">${esc(l)}</p>`).join("")}</section>
<section class="card"><h2>Kontakt</h2>${row("E-Mail", d.email)}${row("Telefon", d.phone)}</section>
${d.rep || d.register || d.vat ? `<section class="card"><h2>Weitere Angaben</h2>${row("Vertretungsberechtigt", d.rep)}${row("Registereintrag", d.register)}${row("Umsatzsteuer-/Wirtschafts-ID", d.vat)}</section>` : ""}
<p class="small">Vorlage aus JOPML Nexus – bitte Angaben prüfen; je nach Tätigkeit können weitere Pflichtangaben nötig sein (z. B. Aufsichtsbehörde, Kammer).</p></main>`);
  }
  // project
  const ls = linkList(d.links);
  return shell(th, title, d.subtitle || "", hero(d.status ? `<span class="pill">📈 ${esc(d.status)}</span>` : "") + `<main>
${d.text ? `<section class="card"><h2>Worum es geht</h2>${para(d.text)}</section>` : ""}
${lines(d.highlights).length ? `<section class="card"><h2>Highlights</h2><ul>${lines(d.highlights).map((l) => `<li>${esc(l)}</li>`).join("")}</ul></section>` : ""}
${ls.map((l, i) => `<a class="btn ${i ? "ghost" : ""}" href="${esc(l.u)}" target="_blank" rel="noopener">${esc(l.t)}</a>`).join("")}${qr(extra.url, "Diese Seite teilen")}</main>`);
}

export const slugify = (s) => String(s || "").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/ß/g, "ss").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 36) || "seite";
