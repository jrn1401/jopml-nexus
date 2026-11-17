// Recht & Formulare: KI-Rechtsfragen auf Basis aktueller Gesetzestexte, Event/Text prüfen lassen, Gesetze nachlesen, Formulare ausfüllen.
// Keine Rechtsberatung – die KI zitiert die mitgegebenen Normen mit Link und sagt, wann man Fachleute fragen sollte.
import { sb, q } from "../lib/api.js";
import { h, icon, toast, toastErr, errMsg, md, copyText } from "../lib/ui.js";
import { aiGen } from "../lib/aigen.js";
import { LAWS, LAWS_FETCHED, findLaws } from "../lib/laws.js";
import { FORMS } from "../lib/forms.js";

const TABS = [["frage", "Frag die KI", "sparkles"], ["pruefen", "Prüfen lassen", "check"], ["formulare", "Formulare", "edit"], ["gesetze", "Gesetzestexte", "book"]];
const DISCLAIMER = "Allgemeine Information auf Basis der angezeigten Gesetzestexte – keine Rechtsberatung. Bei Unsicherheit: Ordnungsamt, Jugendamt, IHK oder eine Anwältin/ein Anwalt.";

async function askLaw(question, extra = "") {
  const laws = findLaws(`${question} ${extra.slice(0, 2000)}`, 7);
  const r = await aiGen({ task: "recht", maxTokens: 3000, instructions: `Du hilfst bei Rechtsfragen rund um Events, Websites und kleine Projekte in Deutschland. Antworte auf Deutsch in Markdown:
**Kurz gesagt** (1–3 Sätze), **Was das Gesetz sagt** (mit Zitat der Norm in der Form „§ 5 Abs. 1 JuSchG“ und Link aus den Daten), **Was du konkret tun solltest** (Liste), **Achtung / unklar** (wenn etwas von Bundesland, Einzelfall oder Behörde abhängt).
Stütze dich NUR auf die mitgegebenen GESETZESTEXTE. Wenn sie die Frage nicht abdecken, sag das ehrlich und nenne, wo man nachfragt (Ordnungsamt, Jugendamt, IHK, Finanzamt, Anwalt). Erfinde keine Paragraphen, Urteile oder Zahlen. Keine verbindliche Rechtsberatung.`,
    input: `GESETZESTEXTE (Stand laut Quelle):\n${laws.map((l) => `### ${l.z} – ${l.t} (Stand ${l.stand}, ${l.url})\n${l.text}`).join("\n\n")}\n\n${extra ? `ZU PRÜFEN:\n${extra.slice(0, 9000)}\n\n` : ""}FRAGE: ${question}` });
  return { text: r.text, laws };
}
const answerView = (r) => h("div.stack", { style: { gap: "10px" } }, h("div.md", md(r.text)),
  h("div.faint", { style: { fontSize: "12.5px" } }, "Verwendete Gesetzestexte: ", ...r.laws.flatMap((l, i) => [i ? " · " : "", h("a", { href: l.url, target: "_blank", rel: "noopener" }, l.z)])),
  h("div.banner", icon("info"), h("div", DISCLAIMER)));

function frage() {
  const out = h("div");
  const ta = h("textarea.input", { rows: 3, maxlength: 1500, "aria-label": "Rechtsfrage", placeholder: "z. B. „Dürfen 16-Jährige bis 1 Uhr auf meiner Party bleiben?“, „Brauche ich ein Impressum auf Instagram?“, „Darf ich Fotos von Gästen posten?“" });
  const go = async () => {
    if (ta.value.trim().length < 6) return toast("Bitte eine Frage eingeben.", "info");
    out.replaceChildren(h("div.faint", h("span.spinner"), " Die KI liest die passenden Gesetze …"));
    try { out.replaceChildren(answerView(await askLaw(ta.value.trim()))); } catch (e) { out.replaceChildren(h("div.banner.bad", errMsg(e))); }
  };
  const ex = ["Muttizettel – muss ich den annehmen?", "Darf ich an 16-Jährige Bier verkaufen?", "Brauche ich für meine Party-Website ein Impressum?", "Brauche ich einen Cookie-Banner?", "Muss ich ein Gewerbe anmelden, wenn ich regelmäßig Partys mache?", "Darf ich Fotos von Gästen auf Instagram posten?"];
  return h("div.stack", h("section.card", h("div.card-body.stack", ta, h("div.row.wrap", { style: { gap: "6px" } }, ex.map((e) => h("button.chip", { type: "button", onclick: () => { ta.value = e; go(); } }, e))),
    h("div.row", h("button.btn.primary", { onclick: go }, icon("sparkles"), "Fragen")))), out);
}

function pruefen(ctx) {
  const out = h("div");
  const ta = h("textarea.input", { rows: 7, maxlength: 9000, "aria-label": "Text zum Prüfen", placeholder: "Text einfügen: Event-Beschreibung, Website-Text, Impressum, Hausordnung, Social-Post, Vertragsentwurf …" });
  const sel = h("select.input", { "aria-label": "Event übernehmen", onchange: async (e) => {
    const id = e.target.value; if (!id) return;
    try {
      const T = ctx.admin ? ["cc_events", "cc_event_items"] : ["nx_events", "nx_event_items"];
      const [ev, items] = await Promise.all([q(sb.from(T[0]).select("*").eq("id", id).single()), q(sb.from(T[1]).select("kind,title,note,amount").eq("event_id", id).limit(200))]);
      ta.value = [`EVENT: ${ev.name}`, `Datum: ${ev.event_date ? new Date(ev.event_date).toLocaleString("de-DE") : "?"}`, `Ort: ${ev.location || "?"}`, `Gäste/Plätze: ${ev.expected_guests ?? ev.capacity ?? "?"}`, `Beschreibung: ${ev.description || ""}`,
        "Einträge:", ...items.map((i) => `- [${i.kind}] ${i.title}${i.note ? ` (${i.note.slice(0, 120)})` : ""}`)].join("\n").slice(0, 9000);
    } catch (er) { toastErr(er); }
  } }, h("option", { value: "" }, "– oder ein Event übernehmen –"));
  q(sb.from(ctx.admin ? "cc_events" : "nx_events").select("id,name").order("event_date", { ascending: false }).limit(30)).then((l) => l.forEach((x) => sel.append(h("option", { value: x.id }, x.name)))).catch(() => {});
  const go = async () => {
    if (ta.value.trim().length < 20) return toast("Bitte Text einfügen oder ein Event wählen.", "info");
    out.replaceChildren(h("div.faint", h("span.spinner"), " Die KI prüft …"));
    try { out.replaceChildren(answerView(await askLaw("Prüfe den Text bzw. das Event auf rechtliche Probleme und fehlende Pflichtangaben (Jugendschutz, Alkohol, Impressum, Datenschutz, Fotos, Gewerbe/Steuer). Nenne jedes Problem mit Norm und konkreter Lösung.", ta.value))); }
    catch (e) { out.replaceChildren(h("div.banner.bad", errMsg(e))); }
  };
  return h("div.stack", h("section.card", h("div.card-body.stack", sel, ta, h("div.row", h("button.btn.primary", { onclick: go }, icon("check"), "Rechtlich prüfen")))), out);
}

function formulare() {
  const box = h("div");
  const open = (f) => {
    const key = `cc:form:${f.id}`;
    let vals = {}; try { vals = JSON.parse(localStorage.getItem(key)) || {}; } catch { /* */ }
    const save = () => { try { localStorage.setItem(key, JSON.stringify(vals)); } catch { /* */ } };
    const fields = f.fields.map(([k, label, type = "text", opts]) => {
      const el = type === "area" ? h("textarea.input", { rows: 3, maxlength: 2000, oninput: (e) => { vals[k] = e.target.value; save(); } }, vals[k] || "")
        : type === "select" ? h("select.input", { onchange: (e) => { vals[k] = e.target.value; save(); } }, opts.map((o) => h("option", { selected: vals[k] === o }, o)))
          : type === "check" ? h("input", { type: "checkbox", checked: !!vals[k], onchange: (e) => { vals[k] = e.target.checked; save(); } })
            : h("input.input", { type, value: vals[k] || "", maxlength: 200, oninput: (e) => { vals[k] = e.target.value; save(); } });
      el.setAttribute("aria-label", label);
      return type === "check" ? h("label.check", el, label) : h("div.field", h("label", label), el);
    });
    const outHtml = (blank) => f.render(blank ? {} : vals);
    const prev = h("iframe.form-prev", { title: "Vorschau", sandbox: "" });
    const upd = () => { prev.srcdoc = outHtml(false); };
    setTimeout(upd, 0);
    const dl = (blank) => { const a = h("a", { href: URL.createObjectURL(new Blob([outHtml(blank)], { type: "text/html" })), download: `${f.id}${blank ? "-leer" : ""}.html` }); document.body.append(a); a.click(); a.remove(); };
    const print = (blank) => { const w = window.open("", "_blank"); if (!w) return toast("Pop-up blockiert – bitte „Herunterladen“ nutzen.", "info"); w.document.write(outHtml(blank)); w.document.close(); w.focus(); setTimeout(() => w.print(), 300); };
    box.replaceChildren(h("section.card", h("div.card-head", h("h3", f.title), h("button.btn.ghost.sm", { onclick: () => box.replaceChildren(list) }, "← Alle Formulare")),
      h("div.card-body.stack", h("p.muted", { style: { margin: 0 } }, f.desc),
        h("div.form-split", h("div.stack", { style: { gap: "8px" }, oninput: () => setTimeout(upd, 0), onchange: () => setTimeout(upd, 0) }, fields), h("div", h("div.faint", { style: { fontSize: "12px", marginBottom: "4px" } }, "Vorschau – so wird es gedruckt"), prev)),
        h("div.row.wrap", { style: { gap: "8px" } }, h("button.btn.primary", { onclick: () => print(false) }, icon("download"), "Ausgefüllt drucken / PDF"), h("button.btn", { onclick: () => dl(false) }, "Herunterladen"),
          f.copy ? h("button.btn", { onclick: () => copyText(f.copy(vals)) }, icon("copy"), "Text kopieren") : null, h("button.btn.ghost", { onclick: () => print(true) }, "Leer drucken")),
        h("div.faint", { style: { fontSize: "12.5px" } }, "Eingaben bleiben nur auf diesem Gerät. Vorlage – keine Rechtsberatung."))));
  };
  const list = h("div.grid.g-2", FORMS.map((f) => h("button.evw-opt", { type: "button", onclick: () => open(f) }, h("span.studio-ic", icon(f.icon || "edit")), h("span", h("b", f.title), h("small", f.desc)))));
  box.append(list);
  return box;
}

function gesetze() {
  const listBox = h("div.list");
  const draw = (term = "") => listBox.replaceChildren(...LAWS.filter((l) => !term || `${l.z} ${l.t} ${l.tags} ${l.text}`.toLowerCase().includes(term.toLowerCase())).map((l) =>
    h("details.list-item", { style: { display: "block" } }, h("summary", h("b", l.z), " – ", l.t, h("span.faint", { style: { fontSize: "12px", marginLeft: "8px" } }, `Stand ${l.stand}`)),
      h("p", { style: { whiteSpace: "pre-wrap", fontSize: "14px", lineHeight: 1.55 } }, l.text), h("a", { href: l.url, target: "_blank", rel: "noopener" }, "Vollständiger Text ↗"))));
  draw();
  return h("div.stack", h("p.faint", { style: { margin: 0, fontSize: "13px" } }, `Amtlicher Wortlaut (gekürzt auf die relevanten Absätze), abgerufen am ${LAWS_FETCHED}. Die KI nutzt diese Texte als Grundlage.`),
    h("input.input", { placeholder: "Suchen: Alkohol, Impressum, Fotos …", "aria-label": "Gesetze durchsuchen", oninput: (e) => draw(e.target.value) }), listBox);
}

export async function rechtPage(sub = "", ctx = {}) {
  const tab = TABS.some((t) => t[0] === sub) ? sub : "frage";
  const body = { frage, pruefen, formulare, gesetze }[tab](ctx);
  const base = ctx.admin === undefined || ctx.adminRoute ? "#/recht" : "#/recht";
  return h("div",
    h("div.page-head", h("div", h("h1", "Recht & Formulare"), h("p.sub", "Rechtsfragen mit KI auf Basis aktueller Gesetzestexte, Events prüfen lassen, Formulare wie den Muttizettel direkt ausfüllen."))),
    h("div.row.wrap", { style: { gap: "6px", marginBottom: "14px" } }, TABS.map(([k, t, ic]) => h("a.chip", { href: `${base}/${k}`, class: k === tab ? "on" : "" }, icon(ic), t))),
    body);
}

export default async function ({ args }) {
  let admin = true;
  try { const { data } = await sb.rpc("cc_is_admin"); admin = data === true; } catch { /* */ }
  return rechtPage(args?.[0] || "", { admin, adminRoute: true });
}
