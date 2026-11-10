import { sb, q, rpc, api } from "../lib/api.js";
import { h, icon, stat, fmtNum, fmtCompact, fmtUSD, fmtAgo, empty, naNote, toast, toastErr } from "../lib/ui.js";
import { barChart, donut, lineChart, PALETTE } from "../lib/charts.js";

const PROVIDER_NAMES = { anthropic: "Anthropic Claude", gemini: "Google Gemini", groq: "Groq", openai: "OpenAI" };
const pn = (p) => PROVIDER_NAMES[p] || p;

export default async function aiView({ query }) {
  let days = Number(query.get("days")) || 30;
  const wrap = h("div");
  const [projects, integ] = await Promise.all([
    q(sb.from("cc_projects").select("id,name")),
    q(sb.from("cc_integrations").select("*").eq("kind", "anthropic").is("project_id", null)),
  ]);
  const pname = Object.fromEntries(projects.map((p) => [p.id, p.name]));
  const anth = integ[0];

  async function render() {
    wrap.replaceChildren(h("div.skel", { style: { height: "300px" } }));
    const rows = (await rpc("cc_ai_series", { p_days: days })).map((r) => ({ ...r, total_tokens: Number(r.total_tokens) || 0, requests: Number(r.requests) || 0 }));
    const dayList = [...Array(days)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - (days - 1 - i)); return d.toLocaleDateString("sv-SE"); });
    const providers = [...new Set(rows.map((r) => r.provider))];
    const sum = (arr, k) => arr.reduce((a, r) => a + (Number(r[k]) || 0), 0);
    const total = sum(rows, "total_tokens"), req = sum(rows, "requests");
    const withSplit = rows.filter((r) => r.input_tokens !== null);
    const costRows = rows.filter((r) => r.cost_usd !== null);
    const today = dayList.at(-1);
    const weekAgo = dayList.slice(-7);
    const tokToday = sum(rows.filter((r) => r.day === today), "total_tokens");
    const tokWeek = sum(rows.filter((r) => weekAgo.includes(r.day)), "total_tokens");

    const byDay = providers.map((p, i) => ({ name: pn(p), color: PALETTE[i % PALETTE.length],
      values: dayList.map((d) => sum(rows.filter((r) => r.day === d && r.provider === p), "total_tokens")) }));
    const byModel = Object.entries(rows.reduce((m, r) => (m[`${r.model}`] = (m[r.model] || 0) + r.total_tokens, m), {})).sort((a, b) => b[1] - a[1]);
    const byProject = Object.entries(rows.reduce((m, r) => { const k = r.project_id || "_"; (m[k] ??= { t: 0, r: 0, i: 0, o: 0 }); m[k].t += r.total_tokens; m[k].r += r.requests; m[k].i += Number(r.input_tokens) || 0; m[k].o += Number(r.output_tokens) || 0; return m; }, {}))
      .sort((a, b) => b[1].t - a[1].t);
    const bySource = Object.entries(rows.reduce((m, r) => (m[r.source] = (m[r.source] || 0) + r.total_tokens, m), {}));
    // Trend: kumuliert
    let acc = 0; const cumulative = dayList.map((d) => ({ x: new Date(d), y: (acc += sum(rows.filter((r) => r.day === d), "total_tokens")) }));
    const labels = dayList.map((d) => days <= 31 ? `${d.slice(8, 10)}.${d.slice(5, 7)}` : `${d.slice(8, 10)}.${d.slice(5, 7)}`);

    const card = (t, sub, el, cls = "") => h("section.card", { class: cls }, h("div.card-head", h("h3", t), sub ? h("span.sub", sub) : null), h("div.card-body", el));
    wrap.replaceChildren(
      h("div.grid.g-4", { style: { marginBottom: "16px" } },
        stat("Tokens gesamt", fmtCompact(total), { ic: "sparkles", sub: `${days} Tage · ${fmtNum(req)} Anfragen` }),
        stat("Heute", fmtCompact(tokToday), { ic: "clock", sub: `Letzte 7 Tage: ${fmtCompact(tokWeek)}` }),
        stat("Input / Output", withSplit.length ? `${fmtCompact(sum(withSplit, "input_tokens"))} / ${fmtCompact(sum(withSplit, "output_tokens"))}` : "", { ic: "activity",
          na: withSplit.length ? null : "Nicht aufgeschlüsselt", sub: "Nur Quellen mit Aufschlüsselung (JOPML meldet Summen)" }),
        costRows.length ? stat("Kosten", fmtUSD(sum(costRows, "cost_usd")), { ic: "wallet", sub: `aus ${costRows.length} Datensätzen mit echten Kosten` })
          : stat("Kosten", "", { ic: "wallet", na: "Keine Abrechnungsdaten", sub: "Es werden keine Kosten geschätzt" })),
      rows.length ? h("div.grid.dash",
        card("Tokenverbrauch pro Tag", "nach Anbieter", barChart(labels, byDay, { height: 230, yFmt: fmtCompact }), "w-8"),
        card("Modellvergleich", null, donut(byModel.slice(0, 6).map(([n, v]) => ({ name: n, value: v })), { fmt: fmtCompact, center: fmtCompact(total) }), "w-4"),
        card("Verbrauchstrend", "kumuliert", lineChart([{ name: "Tokens", values: cumulative }], { height: 200, yFmt: fmtCompact, xFmt: (v) => new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), tipX: (v) => new Date(v).toLocaleDateString("de-DE") }), "w-6"),
        card("Projektvergleich", null, h("div.table-wrap", h("table.table.responsive",
          h("thead", h("tr", h("th", "Projekt"), h("th.num", "Tokens"), h("th.num", "Input"), h("th.num", "Output"), h("th.num", "Anfragen"))),
          h("tbody", byProject.map(([pid, v]) => h("tr", h("td", { "data-l": "Projekt" }, pid === "_" ? h("span.faint", "ohne Projekt") : pname[pid] || "?"),
            h("td.num", { "data-l": "Tokens" }, fmtNum(v.t)), h("td.num", { "data-l": "Input" }, v.i ? fmtNum(v.i) : "–"), h("td.num", { "data-l": "Output" }, v.o ? fmtNum(v.o) : "–"), h("td.num", { "data-l": "Anfragen" }, fmtNum(v.r))))))), "w-6"),
        card("Nach Quelle", null, donut(bySource.map(([n, v]) => ({ name: SOURCE[n] || n, value: v })), { fmt: fmtCompact, size: 120 }), "w-6"),
        card("Anbieter & Datenquellen", null, providerStatus(rows), "w-6"))
        : h("div.card", empty("sparkles", "Keine KI-Nutzung im Zeitraum", "Verbrauch erscheint, sobald JOPML-Nutzer die KI verwenden, du hier den Assistenten nutzt, eine App über die API meldet oder Claude verbunden ist.")),
    );
    if (!rows.length) wrap.append(h("div.card.card-pad", { style: { marginTop: "16px" } }, providerStatus(rows)));
  }
  const SOURCE = { jopml: "JOPML-Launcher", "control-center": "Control Center", "anthropic-admin-api": "Anthropic Admin-API", api: "Eigene Apps (API)" };

  function providerStatus(rows) {
    const seen = new Set(rows.map((r) => r.provider));
    const line = (name, state, cls, text) => h("div.list-item", h("div.li-main", h("div.li-title", name), h("div.li-sub", { style: { whiteSpace: "normal" } }, text)), h("span.badge", { class: cls }, state));
    return h("div.list",
      line("Anthropic Claude", anth?.status === "connected" ? "Verbunden" : anth?.status === "error" ? "Fehler" : "Nicht verbunden", anth?.status === "connected" ? "b-ok" : anth?.status === "error" ? "b-bad" : "b-idle",
        anth?.status === "connected" ? `Echter API-Verbrauch über die Anthropic Admin-API · zuletzt ${fmtAgo(anth.last_sync)}. Chats in claude.ai (Pro/Max) stellt Anthropic nicht über eine API bereit.`
          : "Benötigt einen Admin-API-Schlüssel (sk-ant-admin…) als Supabase-Secret ANTHROPIC_ADMIN_KEY. claude.ai-Abonnements (Pro/Max) liefern keine abrufbaren Tokenwerte – es wird nichts geschätzt."),
      line("Google Gemini", seen.has("gemini") ? "Daten vorhanden" : "Keine Daten", seen.has("gemini") ? "b-ok" : "b-idle", "Aus JOPML (jopml_ai_log) und dem Assistenten/Datei-Analysen dieses Control Centers."),
      line("Groq", seen.has("groq") ? "Daten vorhanden" : "Keine Daten", seen.has("groq") ? "b-ok" : "b-idle", "Ausweich-Anbieter von JOPML."),
      line("OpenAI & eigene KI-Server", seen.has("openai") ? "Daten vorhanden" : "Über API meldbar", seen.has("openai") ? "b-ok" : "b-idle", "Eigene Anwendungen melden Verbrauch per POST /cc-api/ai/usage mit einem API-Schlüssel (Scope „ai“)."));
  }

  const seg = h("div.seg", [[7, "7 Tage"], [30, "30 Tage"], [90, "90 Tage"]].map(([d, t]) => h("button", { class: d === days ? "on" : "", onclick: (e) => {
    days = d; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.target)); render().catch(toastErr); } }, t)));
  const syncBtn = h("button.btn", { onclick: async () => {
    syncBtn.disabled = true;
    try { const r = await api("sync/anthropic", { days: 31 }); if (r.configured === false) toast("Claude ist noch nicht verbunden – siehe Hinweis unter „Anbieter“.", "info", 6000); else { toast(`${r.records} Tageswerte von Claude übernommen`); render(); } }
    catch (e) { toastErr(e); } finally { syncBtn.disabled = false; }
  } }, icon("refresh"), "Claude synchronisieren");
  await render();
  return h("div",
    h("div.page-head", h("div", h("h1", "KI & Tokens"), h("p", "Nur gemessene Werte – nichts wird geschätzt.")), h("div.actions", seg, syncBtn)),
    wrap);
}
