// Website-Cockpit: Live-Besucher (eigener cookiefreier Zähler), Statistik, Erreichbarkeit und Netlify-Livedaten
// (Deploys, Speicher, Bandbreite, Build-Minuten, Formulare). Wird im Admin-Projekt, unter „Websites“ und im Nutzerbereich genutzt.
import { sb, q, rpc, api } from "./api.js";
import { h, icon, toast, toastErr, errMsg, fmtNum, fmtBytes, fmtAgo, fmtDateTime, fmtDuration, meter, confirmDialog, copyText, naNote, modal, empty } from "./ui.js";
import { lineChart, donut, PALETTE } from "./charts.js";

const pulse = (route, body) => api(route, body, "nx-pulse");
const RANGES = [[1, "24 Std."], [7, "7 Tage"], [30, "30 Tage"], [90, "90 Tage"]];
const DEPLOY = { ready: ["Online", "ok"], error: ["Fehler", "bad"], building: ["Baut", "warn"], enqueued: ["Wartet", "warn"], processing: ["Verarbeitet", "warn"], new: ["Neu", "idle"], uploading: ["Lädt hoch", "warn"], prepared: ["Vorbereitet", "idle"] };

const delta = (now, prev) => {
  if (!prev) return now ? h("span.delta.up", "neu") : null;
  const d = Math.round(((now - prev) / prev) * 100);
  return h("span.delta", { class: d > 0 ? "up" : d < 0 ? "down" : "" }, `${d > 0 ? "+" : ""}${d} %`);
};
const kpi = (label, value, sub, ic) => h("div.card.stat", h("div.k", icon(ic), label), h("div.v", value), sub ? h("div.d", sub) : null);
const rankList = (rows, { total, fmt = (r) => r.k, nfmt = fmtNum, empty: e = "Noch keine Daten", max = 8 } = {}) => {
  if (!rows?.length) return h("div.faint", { style: { fontSize: "13px", padding: "6px 0" } }, e);
  const top = Math.max(...rows.map((r) => r.n), 1);
  return h("div.rank", rows.slice(0, max).map((r) => h("div.rank-row", h("i", { style: { width: `${(r.n / top) * 100}%` } }),
    h("span.rank-k", fmt(r)), h("span.rank-n", nfmt(r.n), total ? h("small", ` ${Math.round((r.n / total) * 100)} %`) : null))));
};
const regionName = (tz) => { const [a, b] = String(tz).split("/"); const m = { Europe: "Europa", America: "Amerika", Asia: "Asien", Africa: "Afrika", Australia: "Australien", Pacific: "Pazifik", Atlantic: "Atlantik" }; return b ? `${b.replace(/_/g, " ")} (${m[a] ?? a})` : tz; };
const LANG = { de: "Deutsch", en: "Englisch", fr: "Französisch", it: "Italienisch", es: "Spanisch", tr: "Türkisch", pl: "Polnisch", nl: "Niederländisch", ru: "Russisch", pt: "Portugiesisch", ar: "Arabisch", uk: "Ukrainisch" };

// Uptime-Balken (48 Std., je Stunde)
function uptimeBars(bars) {
  return h("div.upbars", (bars || []).map((b) => {
    const st = b.ok + b.bad === 0 ? "none" : b.bad === 0 ? "ok" : b.ok === 0 ? "bad" : "part";
    return h("i", { class: st, title: `${new Date(b.t).toLocaleString("de-DE", { weekday: "short", hour: "2-digit", minute: "2-digit" })}: ${st === "none" ? "keine Prüfung" : `${b.ok} ok, ${b.bad} Fehler${b.ms ? ` · Ø ${b.ms} ms` : ""}`}` });
  }));
}

export async function webCockpit(site, { onShare, compact = false } = {}) {
  let days = 7, stats = null, nl = null, timer = null;
  const root = h("div.web-cockpit");
  const liveBox = h("div.live-box"), kpis = h("div.grid.g-4"), chart = h("div"), grid = h("div.grid.g-3"), upBox = h("div"), nlBox = h("div"), trackBox = h("div");
  const rangeSeg = h("div.seg", RANGES.map(([d, t]) => h("button", { class: d === days ? "on" : "", onclick: (e) => { days = d; rangeSeg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); load(); } }, t)));

  async function load(quiet = false) {
    try { stats = await rpc("cc_web_stats", { p_site: site.id, p_days: days }); } catch (e) { if (!quiet) toastErr(e); return; }
    drawLive(); if (!quiet) drawStats();
    else { drawKpis(); }
  }
  const hasData = () => stats && (stats.pv > 0 || stats.prev_pv > 0 || stats.live > 0 || stats.today?.pv > 0);
  const installed = () => !!(site.snippet_id || nl?.tracker?.installed || hasData());

  function drawLive() {
    const up = stats?.uptime?.last;
    liveBox.replaceChildren(
      h("div.live-main", h("span.live-dot", { class: stats?.live ? "on" : "" }), h("div",
        h("div.live-n", fmtNum(stats?.live ?? 0)), h("div.live-l", stats?.live === 1 ? "Besucher gerade online" : "Besucher gerade online"))),
      h("div.live-pages", stats?.live_pages?.length ? stats.live_pages.map((p) => h("span.tag", `${p.k} · ${p.n}`)) : h("span.faint", installed() ? "Gerade niemand auf der Seite" : "Besucherzähler noch nicht eingebaut")),
      h("div.live-up", up ? [h("span.badge", { class: up.ok ? "b-ok" : "b-bad" }, up.ok ? "Erreichbar" : "Nicht erreichbar"),
        h("span.faint", ` ${up.ms ?? "–"} ms · geprüft ${fmtAgo(up.ts)}`)] : h("span.faint", "Erreichbarkeit: erste Prüfung in < 5 Min.")));
  }
  function drawKpis() {
    if (!stats) return;
    const per = RANGES.find((r) => r[0] === days)[1];
    kpis.replaceChildren(
      kpi(`Besucher · ${per}`, h("span", fmtNum(stats.uv), delta(stats.uv, stats.prev_uv)), `heute ${fmtNum(stats.today?.uv)}`, "users"),
      kpi(`Seitenaufrufe · ${per}`, h("span", fmtNum(stats.pv), delta(stats.pv, stats.prev_pv)), `heute ${fmtNum(stats.today?.pv)}`, "eye"),
      kpi("Ø Verweildauer", stats.uv ? fmtDuration(stats.avg_duration) : "–", "pro Besucher", "clock"),
      kpi("Absprungrate", stats.bounce === null ? "–" : `${stats.bounce} %`, "nur 1 Seite, < 15 s", "logout"));
  }
  function drawStats() {
    drawKpis();
    const pts = (k) => (stats.series || []).map((p) => ({ x: new Date(p.t).getTime(), y: p[k] }));
    chart.replaceChildren(h("section.card", h("div.card-head", h("h3", "Besucherverlauf"), rangeSeg),
      h("div.card-body", lineChart([{ name: "Besucher", values: pts("uv"), color: PALETTE[0] }, { name: "Seitenaufrufe", values: pts("pv"), color: PALETTE[1] }],
        { height: 220, emptyText: installed() ? "Noch keine Besuche im Zeitraum." : "Sobald der Besucherzähler eingebaut ist, erscheinen hier echte Besucher.",
          xFmt: (v) => days === 1 ? new Date(v).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }) : new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) }))));
    const tot = stats.uv || 1;
    grid.replaceChildren(
      h("section.card", h("div.card-head", h("h3", "Beliebteste Seiten")), h("div.card-body", rankList(stats.pages, { fmt: (r) => r.k }))),
      h("section.card", h("div.card-head", h("h3", "Herkunft")), h("div.card-body", rankList(stats.refs, { total: tot, empty: "Nur direkte Aufrufe (ohne verweisende Seite)" }))),
      h("section.card", h("div.card-head", h("h3", "Geräte")), h("div.card-body", stats.devices?.length ? donut(stats.devices.map((d, i) => ({ name: d.k, value: d.n, color: PALETTE[i % 6] })), { size: 120, center: fmtNum(stats.uv) }) : h("div.faint", "Noch keine Daten"))),
      h("section.card", h("div.card-head", h("h3", "Browser & Systeme")), h("div.card-body", rankList(stats.browsers, { total: tot }), h("div", { style: { height: "10px" } }), rankList(stats.os, { total: tot }))),
      h("section.card", h("div.card-head", h("h3", "Regionen")), h("div.card-body", rankList(stats.regions, { total: tot, fmt: (r) => regionName(r.k), empty: "Noch keine Daten (aus der Zeitzone des Browsers)" }))),
      h("section.card", h("div.card-head", h("h3", "Sprachen")), h("div.card-body", rankList(stats.langs, { total: tot, fmt: (r) => LANG[r.k] ?? r.k.toUpperCase() }))));
    const u = stats.uptime || {};
    upBox.replaceChildren(h("section.card", h("div.card-head", h("h3", "Erreichbarkeit"), h("span.faint", { style: { fontSize: "12.5px" } }, "alle 5 Min. geprüft · 48 Std.")),
      h("div.card-body",
        h("div.row.wrap", { style: { gap: "22px", marginBottom: "12px" } },
          h("div", h("div.k.faint", "24 Std."), h("strong.big", u.pct24 === null || u.pct24 === undefined ? "–" : `${String(u.pct24).replace(".", ",")} %`)),
          h("div", h("div.k.faint", "30 Tage"), h("strong.big", u.pct30 === null || u.pct30 === undefined ? "–" : `${String(u.pct30).replace(".", ",")} %`)),
          h("div", h("div.k.faint", "Ø Antwortzeit"), h("strong.big", u.avg_ms ? `${u.avg_ms} ms` : "–")),
          h("div", h("div.k.faint", "Prüfungen"), h("strong.big", fmtNum(u.checks)))),
        uptimeBars(u.bars),
        u.incidents?.length ? h("div.list", { style: { marginTop: "12px" } }, u.incidents.map((x) => h("div.list-item", h("span.dot.bad"), h("div.li-main", h("div.li-title", x.error || `HTTP ${x.status}`), h("div.li-sub", fmtDateTime(x.ts)))))) : null)));
  }

  // ---- Netlify live
  async function loadNetlify(fresh = false) {
    if (!site.netlify_id) { nlBox.replaceChildren(); drawTracker(); return; }
    if (!nl) nlBox.replaceChildren(h("section.card", h("div.card-body", h("div.row", h("div.spinner"), h("span.faint", "Netlify-Daten werden live abgerufen …")))));
    try { nl = await pulse("netlify", { site_id: site.id, fresh }); } catch (e) { nlBox.replaceChildren(h("section.card", h("div.card-body", naNote(`Netlify: ${errMsg(e)}`, "alert")))); drawTracker(); return; }
    drawNetlify(); drawTracker();
  }
  function drawNetlify() {
    if (!nl?.available) { nlBox.replaceChildren(h("section.card", h("div.card-body", naNote(nl?.reason || "Netlify-Daten nicht verfügbar.")))); return; }
    const last = nl.deploys?.[0];
    const st = DEPLOY[last?.state] || [last?.state || "–", "idle"];
    const bw = nl.bandwidth, bm = nl.build_minutes, sto = nl.storage;
    const types = Object.entries(sto?.by_type || {}).sort((a, b) => b[1].bytes - a[1].bytes);
    nlBox.replaceChildren(h("section.card",
      h("div.card-head", h("h3.row", icon("globe"), "Netlify – live"), h("div.row", { style: { gap: "6px" } },
        h("span.faint", { style: { fontSize: "12px" } }, `abgerufen ${fmtAgo(nl.fetched_at)}`),
        h("button.icon-btn", { title: "Neu abrufen", "aria-label": "Netlify neu abrufen", onclick: () => loadNetlify(true) }, icon("refresh")),
        nl.git ? h("button.btn.sm", { onclick: redeploy }, icon("upload"), "Neu deployen") : null,
        nl.admin_url ? h("a.btn.sm", { href: nl.admin_url, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Netlify") : null)),
      h("div.card-body",
        h("div.grid.g-4", { style: { marginBottom: "14px" } },
          kpi("Deploy-Status", h("span.row", { style: { gap: "8px" } }, h("span.dot", { class: st[1] }), st[0]), last ? `${fmtAgo(last.published_at || last.created_at)}${last.deploy_time ? ` · ${last.deploy_time} s` : ""}` : null, "upload"),
          kpi("Speicher (Deploy)", fmtBytes(sto?.bytes), `${fmtNum(sto?.files)} Dateien`, "server"),
          kpi("Bandbreite (Konto)", bw?.used !== null && bw?.used !== undefined ? fmtBytes(bw.used) : "–", bw?.included ? h("div", meter((bw.used / bw.included) * 100), h("small.faint", `von ${fmtBytes(bw.included)} · bis ${fmtDateTime(bw.to).slice(0, 10)}`)) : "Zeitraum des Kontos", "activity"),
          kpi("Build-Minuten", bm?.used !== null && bm?.used !== undefined ? fmtNum(bm.used) : "–", bm?.included ? h("div", meter((bm.used / bm.included) * 100), h("small.faint", `von ${fmtNum(bm.included)} im Zeitraum`)) : (nl.git ? null : "nur bei Git-Builds"), "cpu")),
        h("div.grid.g-2",
          h("div", h("h4.sub-h", "Deploys"), h("div.list", (nl.deploys || []).slice(0, 8).map((d) => {
            const s2 = DEPLOY[d.state] || [d.state, "idle"];
            return h("div.list-item", h("span.dot", { class: s2[1] }), h("div.li-main", h("div.li-title", d.title || (d.manual ? "Manueller Upload" : d.branch ? `Branch ${d.branch}` : "Deploy")),
              h("div.li-sub", [s2[0], fmtDateTime(d.created_at), d.deploy_time ? `${d.deploy_time} s` : null, d.context && d.context !== "production" ? d.context : null, d.error].filter(Boolean).join(" · "))),
              d.url ? h("a.icon-btn", { href: d.url, target: "_blank", rel: "noopener noreferrer", title: "Diesen Deploy ansehen", "aria-label": "Deploy ansehen" }, icon("external")) : null);
          }))),
          h("div",
            h("h4.sub-h", "Speicher nach Dateityp"),
            types.length ? rankList(types.map(([k, v]) => ({ k: `${k} (${v.n} Dateien)`, n: v.bytes })), { fmt: (r) => r.k, nfmt: fmtBytes }) : h("div.faint", "Keine Dateien"),
            h("h4.sub-h", { style: { marginTop: "14px" } }, "Größte Dateien"),
            h("div.list", (sto?.largest || []).map((f) => h("div.list-item", h("div.li-main", h("div.li-title", { style: { fontFamily: "var(--mono, monospace)", fontSize: "12.5px" } }, f.path)), h("span.faint", fmtBytes(f.bytes))))),
            h("h4.sub-h", { style: { marginTop: "14px" } }, "Domain & Sicherheit"),
            h("div.list",
              h("div.list-item", h("div.li-main", h("div.li-title", nl.custom_domain || new URL(nl.url).hostname), h("div.li-sub", [...(nl.aliases || [])].join(", ") || "keine weiteren Domains")), h("span.badge", { class: nl.ssl ? "b-ok" : "b-warn" }, nl.ssl ? "HTTPS" : "kein SSL")),
              nl.repo ? h("div.list-item", h("div.li-main", h("div.li-title", "Repository"), h("div.li-sub", `${nl.repo}${nl.branch ? ` · ${nl.branch}` : ""}`))) : h("div.list-item", h("div.li-main", h("div.li-title", "Bereitstellung"), h("div.li-sub", "Manuelle Uploads (kein Git)")))),
            nl.forms?.length ? [h("h4.sub-h", { style: { marginTop: "14px" } }, "Formulare"), h("div.list", nl.forms.map((f) => h("div.list-item", h("div.li-main", h("div.li-title", f.name)), h("strong", `${fmtNum(f.submissions)} Einsendungen`))))] : null)),
        nl.netlify_analytics ? h("div", { style: { marginTop: "14px" } }, h("h4.sub-h", "Netlify Analytics – Seitenaufrufe 30 Tage"),
          lineChart([{ name: "Seitenaufrufe", values: nl.netlify_analytics.pageviews.map((p) => ({ x: p.t, y: p.n })), color: PALETTE[2] }], { height: 160, xFmt: (v) => new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }) })) : null)));
  }
  async function redeploy() {
    if (!(await confirmDialog("Neu deployen?", "Netlify baut die Website aus dem Repository neu und veröffentlicht sie danach.", { ok: "Neu deployen", danger: false }))) return;
    try { await pulse("redeploy", { site_id: site.id }); toast("Build gestartet – Status erscheint gleich unter „Deploys“"); setTimeout(() => loadNetlify(true), 6000); } catch (e) { toastErr(e); }
  }

  // ---- Besucherzähler / Statusseite
  function drawTracker() {
    const inst = installed();
    const statusUrl = `${location.origin}${location.pathname}#/status/${site.site_key}`;
    const pubSw = h("input", { type: "checkbox", checked: !!site.public_status, onchange: async (e) => {
      try { await q(sb.from("cc_web_sites").update({ public_status: e.target.checked }).eq("id", site.id)); site.public_status = e.target.checked; toast(e.target.checked ? "Statusseite ist öffentlich" : "Statusseite ausgeschaltet"); drawTracker(); } catch (er) { toastErr(er); e.target.checked = !e.target.checked; }
    } });
    trackBox.replaceChildren(h("section.card", h("div.card-head", h("h3.row", icon("activity"), "Besucherzähler & Statusseite")),
      h("div.card-body", h("div.list",
        h("div.list-item", h("span.dot", { class: inst ? "ok" : "idle" }), h("div.li-main", h("div.li-title", inst ? "Besucherzähler aktiv" : "Besucherzähler nicht eingebaut"),
          h("div.li-sub", inst ? "Cookiefrei, ohne IP-Speicherung, respektiert „Do Not Track“. Live-Besucher werden alle 25 s aktualisiert." : site.netlify_id ? "Mit einem Klick per Netlify-Snippet einbauen – wirkt sofort, ohne Neu-Deploy." : "Code einmal vor </body> in die Website einfügen.")),
          site.netlify_id
            ? (site.snippet_id || nl?.tracker?.installed ? h("button.btn.sm", { onclick: () => install("remove") }, "Entfernen") : h("button.btn.sm.primary", { onclick: () => install("install") }, icon("plus"), "Einbauen"))
            : h("button.btn.sm", { onclick: showCode }, icon("code"), "Code")),
        h("div.list-item", h("span.dot", { class: site.public_status ? "ok" : "idle" }), h("div.li-main", h("div.li-title", "Öffentliche Statusseite"),
          h("div.li-sub", site.public_status ? "Zeigt nur Erreichbarkeit – keine Besucherzahlen." : "Aus – nur du siehst die Erreichbarkeit.")),
          site.public_status ? h("button.btn.sm", { onclick: () => copyText(statusUrl) }, icon("copy"), "Link") : null, h("label.switch", pubSw, h("span"))),
        onShare ? h("div.list-item", h("span.dot.idle"), h("div.li-main", h("div.li-title", "Live-Statistik teilen"), h("div.li-sub", "Mit Personen (Google-Konto) oder per Gäste-Link – Besucher & Erreichbarkeit, nur ansehen.")),
          h("button.btn.sm", { onclick: onShare }, icon("users"), "Teilen")) : null))));
  }
  async function install(action) {
    const text = action === "remove" ? "Der Besucherzähler wird aus deiner Netlify-Website entfernt. Bisherige Statistik bleibt erhalten."
      : `Auf ${site.url} wird ein kleines Skript (p.js, ca. 2 KB) über Netlify-Snippet-Injection eingefügt. Es setzt keine Cookies, speichert keine IP-Adressen und zählt nur Seitenaufrufe, Verweildauer, Gerät, Browser, Sprache und Zeitzone. Tipp: einen Satz dazu in die Datenschutzerklärung deiner Website aufnehmen.`;
    if (!(await confirmDialog(action === "remove" ? "Besucherzähler entfernen?" : "Besucherzähler einbauen?", text, { ok: action === "remove" ? "Entfernen" : "Einbauen", danger: action === "remove" }))) return;
    try {
      const r = await pulse("install", { site_id: site.id, action });
      if (r.manual) return showCode();
      site.snippet_id = action === "remove" ? null : "1"; if (nl?.tracker) nl.tracker.installed = action !== "remove";
      toast(action === "remove" ? "Besucherzähler entfernt" : "Eingebaut – öffne deine Website, du erscheinst sofort als Live-Besucher");
      drawTracker(); drawLive();
    } catch (e) { toastErr(e); }
  }
  async function showCode() {
    const code = `<script defer src="${location.origin}${location.pathname.replace(/[^/]*$/, "")}p.js" data-k="${site.site_key}"></script>`;
    modal("Besucherzähler-Code", h("div.stack", h("p.faint", { style: { margin: 0 } }, "Diese eine Zeile vor </body> in jede Seite deiner Website einfügen (bzw. ins Layout-Template). Gezählt wird nur auf: ", (site.hosts || []).join(", ") || "der Domain der Website", "."),
      h("pre.code", code), h("button.btn.primary", { onclick: () => copyText(code) }, icon("copy"), "Kopieren")));
  }

  root.append(
    h("div.web-head", liveBox, h("div.row", { style: { gap: "8px" } }, site.url ? h("a.btn", { href: site.url, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Website öffnen") : null)),
    kpis, chart, grid, upBox, nlBox, trackBox);
  for (const el of [kpis, chart, grid, upBox]) el.style.marginTop = "16px";
  nlBox.style.marginTop = trackBox.style.marginTop = "16px";
  await load(); loadNetlify();
  // Live-Aktualisierung alle 10 s, solange die Ansicht offen und sichtbar ist
  let away = 0;
  timer = setInterval(() => {
    if (!root.isConnected) { if (++away > 30) clearInterval(timer); return; }   // Tab gewechselt: kurz warten, sonst beenden
    away = 0; if (document.visibilityState === "visible") load(true);
  }, 10_000);
  if (compact) root.classList.add("compact");
  return root;
}

// Liste aller eigenen Websites mit Live-Zahlen
export async function webList(linkFor) {
  const rows = await rpc("cc_web_overview");
  if (!rows.length) return empty("globe", "Noch keine Websites", "Websites aus Netlify (oder Website-Projekte mit Link) erscheinen hier automatisch – spätestens nach 5 Minuten.");
  const totalLive = rows.reduce((a, r) => a + (r.live || 0), 0);
  return h("div.stack",
    h("div.grid.g-3",
      kpi("Gerade online", h("span.row", { style: { gap: "10px" } }, h("span.live-dot", { class: totalLive ? "on" : "" }), fmtNum(totalLive)), "auf allen Websites", "users"),
      kpi("Besucher heute", fmtNum(rows.reduce((a, r) => a + (r.today_uv || 0), 0)), `${fmtNum(rows.reduce((a, r) => a + (r.today_pv || 0), 0))} Seitenaufrufe`, "eye"),
      kpi("Erreichbar", `${rows.filter((r) => r.up === true).length} / ${rows.length}`, rows.some((r) => r.up === false) ? `${rows.filter((r) => r.up === false).length} nicht erreichbar` : "alle Websites", "activity")),
    h("div.list.card", rows.map((r) => h("a.list-item", { href: linkFor(r), style: { textDecoration: "none", color: "inherit" } },
      h("span.dot", { class: r.up === true ? "ok" : r.up === false ? "bad" : "idle" }),
      h("div.li-main", h("div.li-title", r.name), h("div.li-sub", [r.url?.replace(/^https?:\/\//, ""), r.ms ? `${r.ms} ms` : null, r.installed ? `heute ${fmtNum(r.today_uv)} Besucher · ${fmtNum(r.today_pv)} Aufrufe` : "Besucherzähler nicht eingebaut"].filter(Boolean).join(" · "))),
      h("span.row", { style: { gap: "8px" } }, h("span.live-dot", { class: r.live ? "on" : "" }), h("strong", fmtNum(r.live)), h("span.faint", "live")),
      icon("chevronR")))));
}

export async function siteFor(source, id) { return rpc("cc_web_site_for", { p_source: source, p_source_id: id }); }

// Geteilte Website-Statistik (aus der Freigabe, nur lesen – keine weiteren Abfragen)
export function webSharedBlock(w) {
  if (!w) return null;
  const u = w.uptime || {};
  const pts = (k) => (w.series || []).map((p) => ({ x: new Date(p.t).getTime(), y: p[k] }));
  return h("div.stack", { style: { marginBottom: "16px" } },
    h("div.web-head", h("div.live-box",
      h("div.live-main", h("span.live-dot", { class: w.live ? "on" : "" }), h("div", h("div.live-n", fmtNum(w.live ?? 0)), h("div.live-l", "Besucher gerade online"))),
      h("div.live-up", u.last ? [h("span.badge", { class: u.last.ok ? "b-ok" : "b-bad" }, u.last.ok ? "Erreichbar" : "Nicht erreichbar"), h("span.faint", ` ${u.last.ms ?? "–"} ms · Uptime 24 Std. ${u.pct24 ?? "–"} %`)] : null))),
    h("div.grid.g-4",
      kpi("Besucher · 7 Tage", fmtNum(w.uv), `heute ${fmtNum(w.today?.uv)}`, "users"), kpi("Seitenaufrufe · 7 Tage", fmtNum(w.pv), `heute ${fmtNum(w.today?.pv)}`, "eye"),
      kpi("Ø Verweildauer", w.uv ? fmtDuration(w.avg_duration) : "–", null, "clock"), kpi("Uptime 30 Tage", u.pct30 === null || u.pct30 === undefined ? "–" : `${u.pct30} %`, u.avg_ms ? `Ø ${u.avg_ms} ms` : null, "activity")),
    h("section.card", h("div.card-head", h("h3", "Besucher – 7 Tage")), h("div.card-body", lineChart([{ name: "Besucher", values: pts("uv"), color: PALETTE[0] }, { name: "Seitenaufrufe", values: pts("pv"), color: PALETTE[1] }],
      { height: 190, xFmt: (v) => new Date(v).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" }), emptyText: "Noch keine Besuche erfasst." }))),
    h("div.grid.g-2",
      h("section.card", h("div.card-head", h("h3", "Beliebteste Seiten")), h("div.card-body", rankList(w.pages))),
      h("section.card", h("div.card-head", h("h3", "Erreichbarkeit – 48 Std.")), h("div.card-body", uptimeBars(u.bars)))));
}
