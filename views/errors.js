// #/errors – Fehlerzentrale (nur Admin): alle Fehler aus Website, Handy-App, KI-Schnittstelle und Launcher gruppiert.
// Pro Fehler: Details, „Für Claude kopieren“ (fertiger Text mit allem, was zum Beheben nötig ist), „In Claude öffnen“,
// „Mit KI analysieren“ (Ursache + Lösung), erledigt / ignorieren. Erledigte Fehler öffnen sich wieder, wenn sie erneut auftreten.
import { sb, q, rpc } from "../lib/api.js";
import { h, icon, fmtAgo, fmtDateTime, toast, toastErr, copyText, md, empty } from "../lib/ui.js";
import { aiGen } from "../lib/aigen.js";

const SRC = { web: ["Website", "globe"], mobile: ["Handy-App", "wifi"], api: ["KI-Schnittstelle", "sparkles"], host: ["Geräte", "server"], launcher: ["Launcher", "layers"] };
const ST = { open: ["offen", "b-bad"], done: ["erledigt", "b-ok"], ignored: ["ignoriert", "b-idle"] };
const fmtN = (n) => Number(n || 0).toLocaleString("de-DE");

function claudeText(e) {
  return [`Fehler in JOPML Nexus – bitte Ursache finden und beheben.`,
    `Quelle: ${SRC[e.source]?.[0] || e.source}${e.route ? ` · Stelle: ${e.route}` : ""}`,
    `Meldung: ${e.message}`,
    `Häufigkeit: ${fmtN(e.hits)}× · ${e.users ?? "?"} Nutzer · zuerst ${fmtDateTime(e.first_seen)} · zuletzt ${fmtDateTime(e.last_seen)}`,
    e.app_version || e.ctx?.ua ? `Version: ${e.app_version || "?"}${e.ctx?.ua ? ` · Gerät: ${e.ctx.ua}` : ""}${e.ctx?.screen ? ` · Bildschirm ${e.ctx.screen}` : ""}${e.ctx?.status ? ` · HTTP ${e.ctx.status}` : ""}` : null,
    e.stack ? `Stack:\n${String(e.stack).slice(0, 2500)}` : null,
    e.analysis ? `Bisherige KI-Analyse:\n${String(e.analysis).slice(0, 1500)}` : null,
    `Code: GitHub jrn1401/jopml-nexus (Website, Handy-App m.html/mobile.js), Supabase-Projekt qeomooxbfpwvcprvmows (Edge-Funktionen nx-api, cc-api, nx-host).`].filter(Boolean).join("\n");
}

export default async function errorsView() {
  const root = h("div.stack");
  const filter = { st: "open", src: "all", qx: "" };
  let rows = [];

  async function load() {
    const [mine, launcher] = await Promise.all([
      q(sb.from("nx_errors").select("*").order("last_seen", { ascending: false }).limit(400)).catch(() => []),
      rpc("jopml_admin_error_groups", { p_limit: 50 }).catch(() => [])]);
    rows = [
      ...mine.map((e) => ({ ...e, id: e.fingerprint, users: (e.users || []).length, stack: e.sample_stack, ctx: e.sample_context || {} })),
      ...launcher.map((g) => ({ id: `l:${g.fingerprint}`, source: "launcher", route: g.code || g.kind, message: g.message, stack: g.sample_trace, hits: g.hits, users: g.users_seen,
        first_seen: g.first_seen, last_seen: g.last_seen, status: "open", analysis: g.analysis, ctx: { context: g.sample_context }, readonly: true }))];
    draw();
  }

  const setStatus = async (e, status) => {
    try { await q(sb.from("nx_errors").update({ status }).eq("fingerprint", e.fingerprint)); e.status = status; draw(); toast(status === "done" ? "Als erledigt markiert – kommt der Fehler wieder, öffnet er sich neu" : status === "ignored" ? "Wird ignoriert" : "Wieder offen"); }
    catch (er) { toastErr(er); }
  };
  const analyze = async (e, btn, out) => {
    btn.disabled = true; out.replaceChildren(h("div.faint", h("span.spinner"), " KI analysiert …"));
    try {
      const r = await aiGen({ task: "fehleranalyse", maxTokens: 1800,
        instructions: "Du analysierst einen Fehler der Web-App JOPML Nexus (Vanilla-JS-Frontend auf GitHub Pages, Supabase mit Edge-Funktionen in Deno). Antworte auf Deutsch in Markdown mit genau diesen Abschnitten: **Was passiert** (1–2 Sätze, verständlich), **Wahrscheinliche Ursache**, **So beheben** (konkrete Schritte, bei Code: welche Datei/Funktion und was ändern), **Dringlichkeit** (niedrig/mittel/hoch mit Begründung). Erfinde keine Dateien – wenn unklar, sag es.",
        input: claudeText(e) });
      e.analysis = r.text;
      if (!e.readonly) await q(sb.from("nx_errors").update({ analysis: r.text.slice(0, 8000), analyzed_at: new Date().toISOString() }).eq("fingerprint", e.fingerprint)).catch(() => {});
      out.replaceChildren(h("div.md", md(r.text)));
    } catch (er) { out.replaceChildren(); toastErr(er); }
    btn.disabled = false;
  };

  function item(e) {
    const [srcL, srcI] = SRC[e.source] || [e.source, "alert"];
    const det = h("div.err-det");
    const aiOut = h("div.err-ai", e.analysis ? h("div.md", md(e.analysis)) : null);
    let open = false;
    const toggle = () => {
      open = !open;
      if (!open) return det.replaceChildren();
      const aiBtn = h("button.btn.sm", { onclick: (ev) => analyze(e, ev.currentTarget, aiOut) }, icon("sparkles"), e.analysis ? "Neu analysieren" : "Mit KI analysieren");
      det.replaceChildren(
        h("div.err-meta", h("span", `${fmtN(e.hits)}× aufgetreten`), h("span", `${e.users ?? "?"} Nutzer`), h("span", `zuerst ${fmtDateTime(e.first_seen)}`), h("span", `zuletzt ${fmtDateTime(e.last_seen)}`),
          e.app_version ? h("span", `Version ${e.app_version}`) : null, e.ctx?.status ? h("span", `HTTP ${e.ctx.status}`) : null, e.ctx?.screen ? h("span", `Bildschirm ${e.ctx.screen}`) : null),
        e.route ? h("div.mono.err-route", e.route) : null,
        e.stack ? h("pre.mono.code-box.err-stack", String(e.stack).slice(0, 4000)) : null,
        h("div.row.wrap.err-act",
          h("button.btn.sm.primary", { onclick: () => { copyText(claudeText(e)); toast("Kopiert – einfach in den Chat mit Claude einfügen"); } }, icon("copy"), "Für Claude kopieren"),
          h("a.btn.sm", { href: `https://claude.ai/new?q=${encodeURIComponent(claudeText(e).slice(0, 1800))}`, target: "_blank", rel: "noopener" }, icon("external"), "In Claude öffnen"),
          aiBtn,
          e.readonly ? null : e.status === "open"
            ? [h("button.btn.sm.ghost", { onclick: () => setStatus(e, "done") }, icon("check"), "Erledigt"), h("button.btn.sm.ghost", { onclick: () => setStatus(e, "ignored") }, "Ignorieren")]
            : h("button.btn.sm.ghost", { onclick: () => setStatus(e, "open") }, "Wieder öffnen")),
        aiOut);
    };
    return h("section.card.err-item", { class: e.status === "open" ? "is-open" : "" },
      h("button.err-head", { type: "button", onclick: toggle, "aria-label": "Details ein- oder ausklappen" },
        h("span.err-ic", icon(srcI)),
        h("span.err-main", h("span.err-msg", e.message), h("span.err-sub", `${srcL}${e.route ? ` · ${String(e.route).slice(0, 60)}` : ""} · zuletzt ${fmtAgo(e.last_seen)}`)),
        h("span.err-right", h("span.badge", { class: ST[e.status]?.[1] || "b-idle" }, ST[e.status]?.[0] || e.status), h("b.err-hits", `${fmtN(e.hits)}×`), e.analysis ? h("span.badge.b-acc", "KI") : null)),
      det);
  }

  // Kopf und Filter bleiben stehen (Suchfeld behält den Fokus), nur Zahlen und Liste werden neu gezeichnet
  const kpis = h("div.grid.g-3.err-kpis"), listBox = h("div"), chipBox = h("div.err-filter");
  const head = h("div.page-head", h("div", h("h1", "Fehlerzentrale"), h("p.muted", "Alle Fehler aus Website, Handy-App, KI-Schnittstelle und Launcher – gleiche Fehler zusammengefasst. Tokens, Schlüssel und E-Mails werden vor dem Speichern entfernt.")),
    h("div.row", { style: { gap: "8px" } },
      h("button.btn", { onclick: () => { const open = rows.filter((e) => e.status === "open"); if (!open.length) return toast("Keine offenen Fehler"); copyText(open.slice(0, 15).map(claudeText).join("\n\n---\n\n")); toast("Offene Fehler kopiert – in den Chat mit Claude einfügen"); } }, icon("copy"), "Alle offenen kopieren"),
      h("button.btn", { onclick: load }, icon("refresh"), "Aktualisieren")));
  const search = h("input.input", { type: "search", placeholder: "Fehler suchen …", "aria-label": "Fehler suchen", oninput: (ev) => { filter.qx = ev.target.value; clearTimeout(draw.t); draw.t = setTimeout(draw, 150); } });
  const chips = (key, opts) => h("div.row.wrap", { style: { gap: "6px" } }, opts.map(([v, t]) => h("button.chip", { class: filter[key] === v ? "on" : "", onclick: () => { filter[key] = v; drawChips(); draw(); } }, t)));
  const drawChips = () => chipBox.replaceChildren(chips("st", [["open", "Offen"], ["done", "Erledigt"], ["ignored", "Ignoriert"], ["all", "Alle"]]),
    chips("src", [["all", "Alle Quellen"], ...Object.entries(SRC).map(([k, [t]]) => [k, t])]), search);
  drawChips();
  root.append(head, kpis, chipBox, listBox);

  function draw() {
    const qx = filter.qx.toLowerCase();
    const list = rows.filter((e) => (filter.st === "all" || e.status === filter.st) && (filter.src === "all" || e.source === filter.src) && (!qx || `${e.message} ${e.route}`.toLowerCase().includes(qx)));
    const openN = rows.filter((e) => e.status === "open").length, today = rows.filter((e) => Date.now() - Date.parse(e.last_seen) < 864e5).length;
    kpis.replaceChildren(h("div.card.card-pad", h("small.faint", "Offen"), h("b.err-big", String(openN))), h("div.card.card-pad", h("small.faint", "In den letzten 24 Std."), h("b.err-big", String(today))),
      h("div.card.card-pad", h("small.faint", "Gesamt gruppiert"), h("b.err-big", String(rows.length))));
    listBox.replaceChildren(list.length ? h("div.stack.err-list", list.map(item)) : empty("check", filter.st === "open" ? "Keine offenen Fehler" : "Nichts gefunden", "Neue Fehler erscheinen hier automatisch, sobald sie bei jemandem auftreten."));
  }

  await load();
  return root;
}
