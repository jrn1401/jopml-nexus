// Druckvorlagen ohne Server: Erziehungsbeauftragung („Muttizettel“), Event-Plakat/Flyer mit QR-Code.
import { qrSvg } from "./qr.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const doc = (title, css, body) => `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${body}</body></html>`;

// Erziehungsbeauftragung nach § 1 Abs. 1 Nr. 4 JuSchG (Begleitperson ab 18 für Jugendliche nach 24 Uhr)
export function parentalForm({ event = "", date = "", place = "", organizer = "" } = {}) {
  const line = (label) => `<div class="f"><span>${esc(label)}</span><i></i></div>`;
  return doc("Erziehungsbeauftragung", `@page{size:A4;margin:16mm}body{font-family:Arial,sans-serif;color:#111;font-size:12.5pt;line-height:1.5}h1{font-size:19pt;margin:0 0 4px}.s{color:#555;font-size:10pt}.f{display:flex;gap:10px;align-items:flex-end;margin:12px 0}.f span{white-space:nowrap}.f i{flex:1;border-bottom:1px solid #333;height:18px}h2{font-size:13pt;margin:20px 0 4px}.box{border:1px solid #999;border-radius:6px;padding:10px 12px;margin:10px 0;font-size:10.5pt}`,
    `<h1>Erziehungsbeauftragung</h1><div class="s">nach § 1 Abs. 1 Nr. 4 Jugendschutzgesetz (JuSchG) – für den Besuch einer Veranstaltung</div>
<h2>Veranstaltung</h2>${event ? `<p>${esc(event)}${date ? `, am ${esc(date)}` : ""}${place ? `, ${esc(place)}` : ""}${organizer ? ` – Veranstalter: ${esc(organizer)}` : ""}</p>` : line("Name, Datum, Ort")}
<h2>Jugendliche Person</h2>${line("Vor- und Nachname")}${line("Geburtsdatum")}${line("Anschrift")}
<h2>Erziehungsbeauftragte Person (mindestens 18 Jahre)</h2>${line("Vor- und Nachname")}${line("Geburtsdatum")}${line("Telefon")}
<div class="box">Die erziehungsbeauftragte Person übernimmt für die Dauer der Veranstaltung die Aufsicht. Sie bleibt während der gesamten Zeit vor Ort, achtet auf die Einhaltung des Jugendschutzes (u. a. kein Alkohol/Tabak entgegen §§ 9, 10 JuSchG) und verlässt die Veranstaltung gemeinsam mit der jugendlichen Person.</div>
<h2>Personensorgeberechtigte Person (Mutter / Vater / Vormund)</h2>${line("Vor- und Nachname")}${line("Telefon (am Abend erreichbar)")}
<p>Ich beauftrage die oben genannte Person für die Dauer dieser Veranstaltung mit der Wahrnehmung von Erziehungsaufgaben für mein Kind.</p>
${line("Ort, Datum")}${line("Unterschrift personensorgeberechtigte Person")}${line("Unterschrift erziehungsbeauftragte Person")}
<div class="box">Am Einlass bitte vorzeigen: dieses Formular, Ausweis der jugendlichen Person, Ausweis der erziehungsbeauftragten Person und eine Kopie des Ausweises der unterschreibenden Person. Der Veranstalter kann die Beauftragung ablehnen, wenn Zweifel bestehen. Vorlage aus JOPML Nexus – keine Rechtsberatung.</div>`);
}

// Plakat/Flyer (A3, A4 oder A5 hoch) mit QR-Code
export function posterHtml({ title = "", sub = "", date = "", place = "", info = "", url = "", theme = { a: "#c13cff", b: "#ff3c8e", bg: "#0d0414", fg: "#ffffff" }, size = "A4" } = {}) {
  const q = /^https?:\/\//.test(url) ? qrSvg(url, { size: 260 }) : "";
  return doc(title || "Plakat", `@page{size:${size};margin:0}html,body{margin:0;height:100%}body{font-family:Arial,Helvetica,sans-serif;background:${theme.bg};color:${theme.fg};-webkit-print-color-adjust:exact;print-color-adjust:exact}
.p{position:relative;height:100vh;min-height:100%;box-sizing:border-box;padding:9% 8%;display:flex;flex-direction:column;overflow:hidden;background:radial-gradient(circle at 85% 12%,${theme.a}dd,transparent 50%),radial-gradient(circle at 5% 95%,${theme.b}bb,transparent 55%),${theme.bg}}
h1{font-size:13vmin;line-height:.95;margin:0 0 3vmin;letter-spacing:-.03em;text-transform:uppercase}.sub{font-size:4.2vmin;opacity:.9;margin:0 0 6vmin}.m{font-size:4.6vmin;font-weight:700;margin:1.2vmin 0}.i{font-size:3.2vmin;opacity:.9;margin-top:4vmin;white-space:pre-line}
.qr{margin-top:auto;display:flex;gap:4vmin;align-items:center}.qr svg{width:24vmin;height:24vmin;background:#fff;border-radius:2vmin;padding:1vmin}.qr span{font-size:3.4vmin;font-weight:700}`,
    `<div class="p"><h1>${esc(title)}</h1>${sub ? `<p class="sub">${esc(sub)}</p>` : ""}${date ? `<div class="m">${esc(date)}</div>` : ""}${place ? `<div class="m">${esc(place)}</div>` : ""}${info ? `<div class="i">${esc(info)}</div>` : ""}
${q ? `<div class="qr">${q}<span>Tickets &amp; Infos:<br>QR-Code scannen</span></div>` : ""}</div>`);
}
