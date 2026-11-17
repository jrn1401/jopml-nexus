// „Bereit für den Abend?“ – prüft ein Event auf typische Lücken (Sicherheit, Recht, Geld, Team) und zeigt, was noch fehlt.
import { h, icon } from "./ui.js";
import { compute } from "./eventcalc.js";

const num = (v) => (Number.isFinite(+v) ? +v : 0);

export function readinessChecks({ calc, details = {}, items = [], tickets = {}, eventDate, docs = null }) {
  const opts_docs = docs;
  const c = calc || {};
  const st = (k) => c.costs?.[k]?.st;
  const R = calc ? compute(calc) : null;
  const days = eventDate ? Math.ceil((new Date(eventDate) - Date.now()) / 86400000) : null;
  const tasks = items.filter((i) => i.kind === "task");
  const late = tasks.filter((t) => !t.done && t.at && new Date(t.at) < Date.now()).length;
  const age = String(details.age || "");
  const G = num(c.guests);
  const music = /dj|musik|techno|party|konzert|band|rave/i.test(`${details.genre || ""} ${details.lineup || ""} ${details.motto || ""}`) || st("dj") === "cost";
  const has = (k) => String(details[k] || "").trim().length > 1;
  const out = [];
  const add = (id, group, ok, title, hint, warn = false) => out.push({ id, group, ok: !!ok, title, hint, warn: !ok && warn });
  add("loc", "Grundlagen", num(c.location?.net) || items.some((i) => i.kind === "location" && i.status === "gebucht") || has("venue"), "Location fest", "Location im Event-Formular oder unter Locations als „Gebucht“ eintragen.", true);
  add("date", "Grundlagen", !!eventDate, "Datum steht", "Datum über „Bearbeiten“ eintragen.", true);
  add("times", "Grundlagen", has("start"), "Einlass- und Startzeit", "Im Event-Formular unter Grunddaten.");
  add("tickets", "Geld", (c.tickets || []).some((t) => num(t.qty)) || num(tickets.capacity), "Tickets eingerichtet", "Ticket-Kategorien mit Anzahl und Preis eintragen.", true);
  add("be", "Geld", R ? R.result >= 0 : false, "Plan im Plus", R ? `Ergebnis laut Plan ${Math.round(R.result)} € – tippe auf das Ergebnis, um zu sehen, woher das Minus kommt.` : "Kalkulation ausfüllen.", true);
  add("change", "Geld", num(c.change) || !num(c.door?.qty), "Wechselgeld eingeplant", "Bei Abendkasse oder Bar Wechselgeld im Formular eintragen.");
  add("gema", "Recht", !music || st("gema") === "cost" || st("gema") === "loc", "GEMA geklärt", "Bei öffentlicher Musik: GEMA anmelden und Kosten eintragen (oder „in Location enthalten“).", music);
  add("ins", "Recht", st("versicherung") === "cost" || st("versicherung") === "loc", "Veranstalter-Haftpflicht", "Versicherung eintragen – viele Locations verlangen sie.");
  add("youth", "Recht", !/16|14|12/.test(age) || has("rules"), "Jugendschutz-Regeln", "Bei Gästen unter 18: Regeln (Ausweis, Muttizettel, 24 Uhr) im Steckbrief eintragen und aushängen.", /16|14|12/.test(age));
  add("mutti", "Recht", !/16/.test(age) || /mutti|erziehungs/i.test(`${details.rules || ""} ${details.info || ""}`), "Muttizettel-Hinweis", "Unter 18 nach 24 Uhr nur mit Erziehungsbeauftragung – Vorlage unter Recht & Formulare.", /16/.test(age));
  add("sec", "Sicherheit", st("security") === "cost" || st("security") === "loc" || has("security") || G < 100, "Security / Ordner", "Ab ca. 100 Gästen Ordner einplanen (Faustregel: 2 + 1 je weitere 100).", G >= 100);
  add("sani", "Sicherheit", st("sani") === "cost" || st("sani") === "loc" || has("sani") || has("firstaid"), "Erste Hilfe / Sanitäter", "Ersthelfer oder Sanitätsdienst und Verbandskasten festlegen.");
  add("emerg", "Sicherheit", has("emergency"), "Notfallkontakt & Notfallplan", "Notfallnummer, Ansprechperson und Sammelplatz im Steckbrief eintragen.", true);
  add("exits", "Sicherheit", has("exits") || G < 200, "Notausgänge bekannt", "Notausgänge und Fluchtwege mit der Location klären.");
  add("aware", "Sicherheit", has("awareness") || G < 50, "Awareness-Ansprechperson", "Eine erkennbare Person für Belästigung/Notfälle benennen.");
  add("team", "Team", items.some((i) => i.kind === "shift") || G < 60, "Schichten verteilt", "Kasse, Bar, Garderobe, Einlass in Schichten eintragen.");
  add("late", "Team", late === 0, late ? `${late} überfällige Aufgabe(n)` : "Keine überfälligen Aufgaben", "Überfällige Aufgaben erledigen oder neu terminieren.", late > 0);
  const openInv = (c.docs || opts_docs || []).filter((d) => d.type === "rechnung" && d.paid !== true && d.gross);
  if (openInv.length) add("inv", "Geld", false, `${openInv.length} offene Rechnung(en)`, `Zusammen ${Math.round(openInv.reduce((a, d) => a + d.gross, 0))} € – unter „Belege & Verträge“ als bezahlt markieren.`, openInv.some((d) => d.due && new Date(d.due) < Date.now()));
  add("promo", "Werbung", has("tickets") || has("website") || has("instagram") || items.some((i) => i.kind === "post"), "Werbung & Links", "Ticket-Link, Website oder Instagram eintragen bzw. Posting-Plan anlegen.");
  if (days !== null && days <= 7 && days >= 0) add("final", "Team", tasks.length && tasks.every((t) => t.done), "Endspurt-Liste abgehakt", "KI-Copilot › Endspurt-Liste erzeugen und abhaken.");
  return out;
}

export function readinessCard(opts, { onFix } = {}) {
  const list = readinessChecks(opts);
  const ok = list.filter((x) => x.ok).length, pct = Math.round((ok / Math.max(1, list.length)) * 100);
  const open = list.filter((x) => !x.ok).sort((a, b) => b.warn - a.warn);
  let showAll = false;
  const card = h("section.card.ready-card", { id: "sec-ready" });
  const draw = () => card.replaceChildren(
    h("div.card-head", h("h3.row", icon("check"), "Bereit für den Abend?"), h("span.ready-pct", { class: pct >= 85 ? "good" : pct >= 60 ? "mid" : "bad", style: { "--p": `${pct}%` } }, `${pct} %`)),
    h("div.card-body.stack", { style: { gap: "8px" } },
      open.length ? null : h("div.banner.ok", icon("check"), h("div", "Alles Wichtige ist geklärt. Viel Spaß beim Event!")),
      ...(showAll ? list : open.slice(0, 6)).map((x) => h("div.ready-row", { class: x.ok ? "ok" : x.warn ? "warn" : "" },
        h("span.ready-dot", x.ok ? "✓" : x.warn ? "!" : "•"), h("div", h("b", x.title), x.ok ? null : h("div.faint", { style: { fontSize: "12.5px" } }, x.hint)), h("span.badge.b-idle", x.group))),
      h("div.row", { style: { gap: "8px" } }, onFix ? h("button.btn.sm.primary", { onclick: onFix }, icon("edit"), "Im Event-Formular ergänzen") : null,
        list.length > 6 || open.length !== list.length ? h("button.btn.sm.ghost", { onclick: () => { showAll = !showAll; draw(); } }, showAll ? "Nur offene" : `Alle ${list.length} Punkte`) : null)));
  draw();
  return card;
}
