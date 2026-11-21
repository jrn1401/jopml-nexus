// Nexus Mobil – eigene, schlanke Handy-App: Übersicht, Mitteilungen, geteilte Links, KI-Chat, Einstellungen.
// Alles Wichtige mit einem Aufruf (cc_mobile_home), einstellbar (Titelbild, Farbe, Kacheln), Web-Push direkt aufs Handy.
import { sb, rpc, nx, q, aiModel } from "./lib/api.js";
import { h, clear, toast, toastErr, errMsg, md, fmtEUR, fmtNum, fmtAgo, copyText, confirmDialog, modal } from "./lib/ui.js";
import { qrSvg } from "./lib/qr.js";
import { installErrorLog } from "./lib/errlog.js";
installErrorLog("mobile", (p) => rpc("nx_log_error", { p }));
import { micButton, speak, canSpeak } from "./lib/voice.js";
import { broadcastDialog } from "./lib/broadcast.js";
import { enablePush, disablePush, currentSub, isIOS, isStandalone, supported as pushSupported } from "./lib/webpush.js";

const root = document.getElementById("root");
const BASE = location.origin + location.pathname.replace(/m\.html$/, "");
const store = {
  get: (k, d) => { try { const v = localStorage.getItem("nxm:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set: (k, v) => { try { localStorage.setItem("nxm:" + k, JSON.stringify(v)); } catch { toast("Speichern auf dem Gerät nicht möglich", "err"); } },
};

// ---------- kleine Symbole (eigene, damit die Leiste ruhig aussieht) ----------
const SVG = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  bell: "M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0",
  share: "M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M16 6l-4-4-4 4M12 2v13",
  chat: "M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z",
  gear: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z",
  ticket: "M3 9a3 3 0 0 0 0 6v3a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-3a3 3 0 0 0 0-6V6a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1zM13 5v2M13 17v2M13 11v2",
  check: "M20 6 9 17l-5-5",
  globe: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18",
  send: "M22 2 11 13M22 2l-7 20-4-9-9-4z",
  copy: "M9 9h11v11H9zM5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1",
  spark: "M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 17l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7z",
  folder: "M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z",
  ext: "M14 3h7v7M21 3l-9 9M19 14v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 1 1 8 0v4",
};
const ic = (n, s = 22) => { const el = document.createElementNS("http://www.w3.org/2000/svg", "svg"); el.setAttribute("viewBox", "0 0 24 24"); el.setAttribute("width", s); el.setAttribute("height", s);
  el.setAttribute("fill", "none"); el.setAttribute("stroke", "currentColor"); el.setAttribute("stroke-width", "1.8"); el.setAttribute("stroke-linecap", "round"); el.setAttribute("stroke-linejoin", "round"); el.setAttribute("aria-hidden", "true");
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path"); p.setAttribute("d", SVG[n] || SVG.spark); el.append(p); return el; };

// ---------- Titelbilder (selbst gezeichnet, als SVG) ----------
const ART = {
  nexus: { name: "Nexus", a: "#8b8cff", b: "#46d3ee", c: "#0b0c1a" },
  aurora: { name: "Aurora", a: "#3ccf8e", b: "#46d3ee", c: "#06141a" },
  sunset: { name: "Sunset", a: "#ff7a59", b: "#e879b5", c: "#1a0a14" },
  rave: { name: "Rave", a: "#c13cff", b: "#ff3c8e", c: "#0d0414" },
  ocean: { name: "Ozean", a: "#2f7bff", b: "#46d3ee", c: "#040b1a" },
  mono: { name: "Mono", a: "#d7dbe3", b: "#7b8190", c: "#0a0b0e" },
};
function artSvg(key) {
  const t = ART[key] || ART.nexus;
  const cube = (x, y, s, o) => `<g transform="translate(${x} ${y})" opacity="${o}" fill="none" stroke="${t.b}" stroke-width="1.4">
    <path d="M0 ${-s} L${s * 0.87} ${-s / 2} L${s * 0.87} ${s / 2} L0 ${s} L${-s * 0.87} ${s / 2} L${-s * 0.87} ${-s / 2} Z"/><path d="M0 ${-s} V0 M0 0 L${s * 0.87} ${s / 2} M0 0 L${-s * 0.87} ${s / 2}" stroke-opacity=".6"/></g>`;
  const lines = Array.from({ length: 14 }, (_, i) => `<path d="M${-40 + i * 34} 260 L${200 + i * 12} 120" stroke="${t.a}" stroke-opacity="${0.05 + (i % 3) * 0.03}"/>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 260" preserveAspectRatio="xMidYMid slice">
  <defs><radialGradient id="g1" cx="78%" cy="18%" r="70%"><stop offset="0" stop-color="${t.a}" stop-opacity=".85"/><stop offset="1" stop-color="${t.a}" stop-opacity="0"/></radialGradient>
  <radialGradient id="g2" cx="10%" cy="90%" r="65%"><stop offset="0" stop-color="${t.b}" stop-opacity=".6"/><stop offset="1" stop-color="${t.b}" stop-opacity="0"/></radialGradient>
  <linearGradient id="fade" x1="0" y1="0" x2="0" y2="1"><stop offset=".45" stop-color="${t.c}" stop-opacity="0"/><stop offset="1" stop-color="${t.c}" stop-opacity=".95"/></linearGradient></defs>
  <rect width="400" height="260" fill="${t.c}"/><rect width="400" height="260" fill="url(#g1)"/><rect width="400" height="260" fill="url(#g2)"/><g>${lines}</g>
  ${cube(300, 92, 46, 0.9)}${cube(352, 160, 20, 0.5)}${cube(250, 168, 14, 0.4)}
  <rect width="400" height="260" fill="url(#fade)"/></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const accentOf = () => (ART[store.get("art", "nexus")] || ART.nexus).a;
function applyLook() {
  const r = document.documentElement;
  const theme = store.get("theme", "dark");
  r.dataset.theme = theme === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : theme;
  r.style.setProperty("--m-accent", store.get("art", "nexus") === "photo" ? store.get("photoAccent", "#8b8cff") : accentOf());
}
const heroImage = () => (store.get("art", "nexus") === "photo" && store.get("photo", "") ? store.get("photo", "") : artSvg(store.get("art", "nexus")));

// ---------- Anmeldung ----------
async function renderLogin(msg) {
  applyLook();
  const gbox = h("div.m-gsi");
  clear(root, h("div.m-login",
    h("div.m-login-hero", { style: { backgroundImage: `url("${heroImage()}")` } }),
    h("div.m-login-card",
      h("h1", "Nexus"), h("p", "Deine wichtigsten Zahlen, Mitteilungen, geteilten Links und die KI – kompakt fürs Handy."),
      msg ? h("div.banner.bad", msg) : null, gbox,
      h("a.m-link", { href: "./" }, "Zur Vollversion"))));
  try { const { googleButton } = await import("./lib/gsi.js"); await googleButton(gbox, { onDone: () => start() }); }
  catch { gbox.replaceChildren(h("button.btn.primary.m-wide", { onclick: () => import("./lib/gsi.js").then((m) => m.googleRedirect()) }, "Mit Google anmelden")); }
}

// ---------- App ----------
let data = null, tab = store.get("tab", "home");
const TABS = [["home", "home", "Start"], ["bell", "bell", "Mitteilungen"], ["share", "share", "Geteilt"], ["chat", "chat", "KI"], ["gear", "gear", "Einstellungen"]];
const main = h("main.m-main");
const bar = h("nav.m-tabbar", { "aria-label": "Bereiche" });

function drawBar() {
  bar.replaceChildren(...TABS.map(([k, i, label]) => h("button.m-tab", { class: tab === k ? "on" : "", "aria-label": label, "aria-current": tab === k ? "page" : null,
    onclick: () => { tab = k; store.set("tab", k); drawBar(); draw(); } }, ic(i), h("span", label),
    k === "bell" && data?.unread ? h("b.m-dot", data.unread > 99 ? "99+" : String(data.unread)) : null)));
}
async function load() { data = await rpc("cc_mobile_home"); }
async function draw() {
  main.scrollTop = 0;
  const v = { home: homeView, bell: bellView, share: shareView, chat: chatView, gear: gearView }[tab] || homeView;
  try { clear(main, await v()); } catch (e) { clear(main, h("div.m-pad", h("div.banner.bad", errMsg(e)))); }
}

function hero(sub) {
  const hr = new Date().getHours();
  const hi = hr < 5 ? "Gute Nacht" : hr < 11 ? "Guten Morgen" : hr < 18 ? "Hallo" : "Guten Abend";
  return h("header.m-hero", { style: { backgroundImage: `url("${heroImage()}")` } },
    h("div.m-hero-in", h("div.m-hero-hi", `${hi}${data?.name ? `, ${data.name}` : ""}`), sub ? h("div.m-hero-sub", sub) : null));
}
const tile = (label, value, sub, onclick) => h(onclick ? "button.m-tile" : "div.m-tile", { onclick }, h("div.m-tile-l", label), h("div.m-tile-v", value), sub ? h("div.m-tile-s", sub) : null);
const daysTo = (d) => Math.ceil((new Date(d) - Date.now()) / 864e5);

// Überblick des nächsten Events – dieselbe Leiste wie in der Vollversion (Ergebnis, Prognose, Aufgaben, Gäste …)
function eventOverview(next, tilesOverride = null) {
  const box = h("section.m-card.m-ov", h("div.m-card-h", ic("ticket", 18), h("span", next.name)), h("div.m-row-s", "Lädt Überblick …"));
  (async () => {
    try {
      const { overviewStrip, breakdownModal, compute } = await import("./lib/eventcalc.js");
      let ev = await q(sb.from("cc_events").select("id,name,event_date,expected_guests,budget,metadata").eq("id", next.id).maybeSingle()), admin = true, items = [];
      if (ev) items = await q(sb.from("cc_event_items").select("kind,done,at,amount,actual,status").eq("event_id", ev.id));
      else { admin = false; ev = await q(sb.from("nx_events").select("id,name,event_date,capacity,budget,tickets,calc").eq("id", next.id).maybeSingle()); if (ev) items = await q(sb.from("nx_event_items").select("kind,done,at,amount").eq("event_id", ev.id)); }
      if (!ev) { box.remove(); return; }
      const meta = ev.metadata || {}, calc = admin ? meta.calc : ev.calc && (ev.calc.guests !== undefined || ev.calc.tickets) ? ev.calc : null;
      const tickets = admin ? meta.tickets || {} : ev.tickets || {};
      const tasks = items.filter((i) => i.kind === "task" || i.kind === "tech"), guests = items.filter((i) => i.kind === "guest");
      const spent = items.filter((i) => i.kind === "cost").reduce((a, i) => a + (Number(i.actual ?? i.amount) || 0), 0);
      const R = calc ? compute(calc) : null;
      const url = `./#/events/${ev.id}`;
      box.replaceChildren(h("div.m-card-h", ic("ticket", 18), h("span", ev.name)),
        overviewStrip({ name: ev.name, calc, tickets, eventDate: ev.event_date, capacity: tickets.capacity || ev.expected_guests || ev.capacity, tasks, guests, spent, budget: ev.budget,
          tiles: tilesOverride || (admin ? meta.overview : ev.calc?.overview), onTasks: () => document.getElementById("m-tasks")?.scrollIntoView({ behavior: "smooth" }) }),
        R && R.result < 0 ? h("button.btn.sm.m-wide", { onclick: () => breakdownModal(calc, ev.name) }, "Wo kommt das Minus her?") : null,
        h("div.m-ov-btns", h("a.btn.sm.primary", { href: url }, "Ganzes Event öffnen"), h("a.btn.sm", { href: url, onclick: () => { try { sessionStorage.setItem("cc:open-form", ev.id); } catch { /* */ } } }, "Event-Formular")));
    } catch (e) { box.lastChild.textContent = errMsg(e); }
  })();
  return box;
}

// ---------- Startseite anpassen: welche Bereiche, Events (mit welchen Zahlen) und Projekte ----------
const SECTIONS = [["kpis", "Kennzahlen oben"], ["events", "Events & Tickets"], ["projects", "Projekte"], ["tasks", "Aufgaben"], ["sites", "Websites"], ["shares", "Geteilte Links"], ["studio", "KI-Studio-Knöpfe"]];
function homeCfg() {
  const old = store.get("tiles", null);
  const c = store.get("mhome", null) || { sections: { kpis: true, events: true, projects: true, tasks: true, sites: old?.sites !== false, shares: old?.shares !== false, studio: true }, events: null, projects: [], evTiles: {} };
  if (old && old.events === false) c.sections.events = false;
  if (old && old.tasks === false) c.sections.tasks = false;
  c.sections ||= {}; c.evTiles ||= {}; c.projects ||= [];
  return c;
}
const on = (c, k) => c.sections[k] !== false;
// Auswahl-Listen: Admin sieht das Control Center, alle anderen ihren eigenen Bereich
async function pickLists() {
  if (data?.admin) {
    const [evs, prs] = await Promise.all([
      q(sb.from("cc_events").select("id,name,event_date,status").neq("status", "cancelled").order("event_date", { ascending: true, nullsFirst: false }).limit(60)).catch(() => []),
      q(sb.from("cc_projects").select("id,name,category,status,updated_at").order("updated_at", { ascending: false }).limit(150)).catch(() => [])]);
    return { evs, prs };
  }
  const [evs, prs] = await Promise.all([
    q(sb.from("nx_events").select("id,name,event_date,status").neq("status", "cancelled").order("event_date", { ascending: true, nullsFirst: false }).limit(60)).catch(() => []),
    q(sb.from("nx_projects").select("id,name,kind,status,updated_at").order("updated_at", { ascending: false }).limit(150)).catch(() => [])]);
  return { evs, prs };
}
function projectCard(id) {
  const box = h("section.m-card", h("div.m-row-s", "Lädt Projekt …"));
  (async () => {
    try {
      let p, url, open = null;
      if (data?.admin) {
        p = await q(sb.from("cc_projects").select("id,name,category,status,description,updated_at").eq("id", id).maybeSingle());
        if (p) open = (await q(sb.from("cc_tasks").select("id").eq("project_id", id).eq("done", false).limit(200)).catch(() => [])).length;
        url = `./#/projects/${id}`;
      } else {
        p = await q(sb.from("nx_projects").select("id,name,kind,status,description,updated_at,url").eq("id", id).maybeSingle());
        url = `./#/p/${id}`;
      }
      if (!p) { box.remove(); return; }
      box.replaceChildren(h("div.m-card-h", ic("folder", 18), h("span", p.name)),
        h("div.m-row-s", [p.status === "active" ? "aktiv" : p.status, p.category || p.kind, `aktualisiert ${fmtAgo(p.updated_at)}`].filter(Boolean).join(" · ")),
        p.description ? h("div.m-proj-d", String(p.description).replace(/[#*_`>]/g, "").slice(0, 220)) : null,
        open !== null ? h("div.m-row-s", open ? `${open} offene Aufgabe(n)` : "Keine offenen Aufgaben") : null,
        h("div.m-ov-btns", h("a.btn.sm.primary", { href: url }, "Projekt öffnen"), p.url ? h("a.btn.sm", { href: p.url, target: "_blank", rel: "noopener" }, "Link") : null));
    } catch (e) { box.lastChild.textContent = errMsg(e); }
  })();
  return box;
}
async function customizeHome() {
  const c = homeCfg();
  const { evs, prs } = await pickLists();
  const { OV_TILES, OV_DEFAULT } = await import("./lib/eventcalc.js");
  const body = h("div.m-cust");
  const evSel = new Set(c.events || (evs[0] ? [evs[0].id] : []));
  const prSel = new Set(c.projects);
  let pq = "";
  const draw2 = () => {
    const prList = prs.filter((p) => !pq || p.name.toLowerCase().includes(pq)).slice(0, 40);
    body.replaceChildren(
      h("div.m-cust-h", "Bereiche"),
      ...SECTIONS.filter(([k]) => k !== "sites" || data?.admin).map(([k, l]) => h("label.m-switch", h("span", l), h("input", { type: "checkbox", checked: on(c, k), onchange: (e) => { c.sections[k] = e.target.checked; } }))),
      h("div.m-cust-h", "Events"),
      h("label.m-switch", h("span", "Automatisch das nächste Event"), h("input", { type: "checkbox", checked: c.events === null, onchange: (e) => { c.events = e.target.checked ? null : [...evSel]; draw2(); } })),
      c.events === null ? h("div.m-row-s", "Es wird immer das nächste anstehende Event gezeigt. Haken weg, um selbst auszuwählen.") : null,
      ...(c.events === null ? [] : evs.map((ev) => {
        const sel = evSel.has(ev.id);
        const tiles = c.evTiles[ev.id] || OV_DEFAULT;
        return h("div.m-cust-ev", { class: sel ? "on" : "" },
          h("label.m-switch", h("span", h("b", ev.name), h("small.m-row-s", ev.event_date ? ` · ${new Date(ev.event_date).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "2-digit" })}` : "")),
            h("input", { type: "checkbox", checked: sel, onchange: (e) => { e.target.checked ? evSel.add(ev.id) : evSel.delete(ev.id); c.events = [...evSel]; draw2(); } })),
          sel ? h("div.m-cust-tiles", h("div.m-row-s", "Welche Zahlen und Prognosen?"),
            h("div.m-chips", OV_TILES.map(([k, l]) => h("button.m-chip", { type: "button", class: tiles.includes(k) ? "on" : "", onclick: () => {
              const cur = new Set(c.evTiles[ev.id] || OV_DEFAULT); cur.has(k) ? cur.delete(k) : cur.add(k);
              c.evTiles[ev.id] = OV_TILES.map(([x]) => x).filter((x) => cur.has(x)); draw2(); } }, l)))) : null);
      })),
      !evs.length ? h("div.m-row-s", "Noch keine Events.") : null,
      h("div.m-cust-h", "Projekte"),
      prs.length > 8 ? h("input.input.m-cust-q", { type: "search", placeholder: "Projekt suchen …", value: pq, "aria-label": "Projekt suchen", oninput: (e) => { pq = e.target.value.toLowerCase(); const pos = e.target.selectionStart; draw2(); const f = body.querySelector(".m-cust-q"); f?.focus(); f?.setSelectionRange(pos, pos); } }) : null,
      ...prList.map((p) => h("label.m-switch", h("span", p.name, h("small.m-row-s", ` · ${p.category || p.kind || ""}`)),
        h("input", { type: "checkbox", checked: prSel.has(p.id), onchange: (e) => { e.target.checked ? prSel.add(p.id) : prSel.delete(p.id); c.projects = [...prSel]; } }))),
      !prs.length ? h("div.m-row-s", "Noch keine Projekte.") : null);
  };
  draw2();
  const m = modal("Startseite anpassen", body, { foot: [
    h("button.btn.ghost", { onclick: () => { store.set("mhome", null); store.set("tiles", null); m.close(); draw(); toast("Zurückgesetzt"); } }, "Standard"),
    h("button.btn.primary", { onclick: () => { if (c.events !== null) c.events = [...evSel]; c.projects = [...prSel]; store.set("mhome", c); m.close(); draw(); toast("Startseite gespeichert"); } }, "Speichern")] });
}

async function homeView() {
  await load(); drawBar();
  const cfg = homeCfg();
  const show = { events: on(cfg, "events"), tasks: on(cfg, "tasks"), sites: on(cfg, "sites"), shares: on(cfg, "shares") };
  const ev = data.events || [];
  const next = ev[0];
  const sub = next ? (next.date ? `${next.name} · in ${daysTo(next.date)} Tagen` : next.name) : "Alles ruhig.";
  const hr = hero(sub);
  hr.append(h("button.m-hero-cust", { type: "button", "aria-label": "Startseite anpassen", title: "Startseite anpassen", onclick: () => customizeHome().catch(toastErr) }, ic("gear", 18), h("span", "Anpassen")));
  const parts = [hr];
  const kpis = h("div.m-kpis");
  if (show.events && next && next.sold !== null && next.sold !== undefined) {
    kpis.append(tile("Tickets", `${fmtNum(next.sold)}${next.capacity ? ` / ${fmtNum(next.capacity)}` : ""}`, next.today ? `+${next.today} heute` : next.tickets_at ? `Stand ${fmtAgo(next.tickets_at)}` : null));
    if (next.revenue !== null && next.revenue !== undefined) kpis.append(tile("Einnahmen", fmtEUR(next.revenue), "Ticketverkauf"));
  }
  if (show.tasks) kpis.append(tile("Offen", fmtNum(next?.open_tasks ?? (data.tasks || []).length), "Aufgaben", () => document.getElementById("m-tasks")?.scrollIntoView({ behavior: "smooth" })));
  if (show.sites && data.sites?.total) kpis.append(tile("Websites", data.sites.down ? `${data.sites.down} down` : "alle online", `${data.sites.total} überwacht`));
  if (kpis.childElementCount && on(cfg, "kpis")) parts.push(kpis);
  if (show.events) {
    const ids = cfg.events === null ? (next?.id ? [next.id] : []) : cfg.events;
    for (const id of ids) parts.push(eventOverview({ id, name: (ev.find((x) => x.id === id) || {}).name || "Event" }, cfg.evTiles[id] || null));
  }
  if (on(cfg, "projects") && cfg.projects.length) parts.push(h("div.m-sec-h", "Meine Projekte"), ...cfg.projects.map(projectCard));
  if (on(cfg, "projects") && !cfg.projects.length && !store.get("mhome-hint", false)) parts.push(h("section.m-card.m-hint", h("div.m-row-s", "Tipp: Unter „Startseite anpassen“ wählst du Projekte und Events aus, die hier erscheinen – und welche Zahlen du pro Event sehen willst."),
    h("button.btn.sm.ghost.m-mt", { onclick: (e) => { store.set("mhome-hint", true); e.currentTarget.closest(".m-hint").remove(); } }, "Verstanden")));
  if (show.events && cfg.events === null && next?.capacity && next.sold !== null && next.sold !== undefined) {
    const pct = Math.min(100, Math.round((next.sold / next.capacity) * 100));
    parts.push(h("section.m-card", h("div.m-card-h", ic("ticket", 18), h("span", next.name)),
      h("div.m-bar", h("i", { style: { width: `${pct}%` } })), h("div.m-row-s", `${pct} % verkauft${next.location ? ` · ${next.location.split(",")[0]}` : ""}`)));
  }
  if (show.events && ev.length > 1) parts.push(h("section.m-card", h("div.m-card-h", h("span", "Weitere Events")),
    ...ev.slice(1).map((e) => h("div.m-li", h("div", h("b", e.name), h("div.m-row-s", e.date ? new Date(e.date).toLocaleDateString("de-DE", { day: "2-digit", month: "short", year: "numeric" }) : "ohne Datum"))))));
  if (show.tasks) {
    const list = h("div");
    const fill = () => list.replaceChildren(...(data.tasks || []).map((t) => h("div.m-li.m-task",
      h("button.m-chk", { "aria-label": `Erledigt: ${t.title}`, onclick: async (e) => { const b = e.currentTarget; b.disabled = true; try { await rpc("cc_mobile_task_done", { p_kind: t.kind, p_id: t.id }); data.tasks = data.tasks.filter((x) => x.id !== t.id); fill(); toast("Erledigt"); } catch (er) { toastErr(er); b.disabled = false; } } }, ic("check", 16)),
      h("div", h("div.m-task-t", t.title), h("div.m-row-s", [t.where, t.due ? (new Date(t.due) < new Date() ? "überfällig" : `fällig ${new Date(t.due).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit" })}`) : null].filter(Boolean).join(" · "))))));
    fill();
    parts.push(h("section.m-card", { id: "m-tasks" }, h("div.m-card-h", ic("check", 18), h("span", "Als Nächstes")), (data.tasks || []).length ? list : h("div.m-row-s", "Nichts offen – stark.")));
  }
  if (show.shares && (data.shares || []).length) parts.push(h("section.m-card", h("div.m-card-h", ic("share", 18), h("span", "Geteilt")),
    h("div.m-row-s", `${data.shares.length} Link(s) · zusammen ${fmtNum(data.shares.reduce((a, s) => a + (s.opens || 0), 0))}× geöffnet`),
    h("button.btn.sm.m-mt", { onclick: () => { tab = "share"; store.set("tab", tab); drawBar(); draw(); } }, "Ansehen")));
  parts.push(h("button.m-ask", { onclick: () => { tab = "chat"; store.set("tab", tab); drawBar(); draw(); } }, ic("spark", 18), "KI fragen: „Was ist heute wichtig?“"));
  if (on(cfg, "studio")) parts.push(h("section.m-card", h("div.m-card-h", ic("spark", 18), h("span", "KI-Studio")),
    h("div.m-tools", [["#/neues-event", "Event mit KI"], ["#/studio/bogen", "Projekt planen"], ["#/studio/web", "Website bauen"], ["#/studio/marketing", "QR & Werbung"], ["#/studio/summary", "Zusammenfassen"]].map(([k, t]) => h("a.m-toolbtn", { href: `./${k}` }, t)))));
  return h("div", ...parts);
}

async function bellView() {
  const tbl = data?.admin ? "cc_notifications" : "nx_notifications";
  const rows = await q(sb.from(tbl).select("*").order("created_at", { ascending: false }).limit(50));
  const lv = { error: "bad", warning: "warn", success: "ok" };
  return h("div.m-pad",
    h("div.m-head", h("h1", "Mitteilungen"), rows.some((n) => !n.read) ? h("button.btn.sm", { onclick: async () => { await sb.from(tbl).update({ read: true }).eq("read", false); data.unread = 0; drawBar(); draw(); } }, "Alle gelesen") : null),
    rows.length ? h("div.m-list", rows.map((n) => h("div.m-note", { class: n.read ? "" : "new" }, h("i.m-lv", { class: lv[n.level] || "" }),
      h("div", h("div.m-task-t", n.title), n.body ? h("div.m-row-s", n.body) : null, h("div.m-row-s", fmtAgo(n.created_at))))))
      : h("div.m-empty", "Keine Mitteilungen."));
}

async function shareView() {
  if (!data) await load();
  const s = data.shares || [];
  return h("div.m-pad",
    h("div.m-head", h("h1", "Geteilt")),
    h("p.m-row-s", "Deine aktiven Links. Bearbeiten (Bereiche, Personen) geht in der Vollversion – der Link bleibt dabei gleich."),
    s.length ? h("div.m-list", s.map((x) => h("div.m-card.m-share",
      h("div", h("b", x.label), h("div.m-row-s", `${fmtNum(x.opens || 0)}× geöffnet${x.last ? ` · zuletzt ${fmtAgo(x.last)}` : ""}${x.restricted ? " · nur bestimmte Personen" : ""}`)),
      h("div.m-share-b",
        h("button.btn.sm", { "aria-label": "Link kopieren", onclick: () => copyText(`${BASE}#/s/${x.token}`) }, ic("copy", 16)),
        h("button.btn.sm", { "aria-label": "QR-Code zeigen", onclick: () => showQr(x.label, `${BASE}#/s/${x.token}`) }, "QR"),
        navigator.share ? h("button.btn.sm", { "aria-label": "Teilen", onclick: () => navigator.share({ title: x.label, url: `${BASE}#/s/${x.token}` }).catch(() => {}) }, ic("share", 16)) : null,
        h("a.btn.sm", { href: `${BASE}#/s/${x.token}`, "aria-label": "Öffnen" }, ic("ext", 16))))))
      : h("div.m-empty", "Noch nichts geteilt."),
    h("a.btn.m-wide.m-mt", { href: "./#/shares" }, "Neuen Link in der Vollversion erstellen"));
}

function chatView() {
  let hist = store.get("chat", []);
  const log = h("div.m-chat-log", { "aria-live": "polite" });
  const inp = h("textarea.m-chat-in", { rows: 1, placeholder: "Frag die KI …", "aria-label": "Nachricht an die KI", maxlength: 2000,
    oninput: (e) => { e.target.style.height = "auto"; e.target.style.height = Math.min(120, e.target.scrollHeight) + "px"; },
    onkeydown: (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } } });
  const SUG = ["Was ist heute wichtig?", "Wie laufen die Tickets?", "Was ist überfällig?", "Schreib mir eine Insta-Caption für das Event"];
  const bubble = (m) => h("div.m-msg", { class: m.role }, m.role === "assistant" ? [md(m.text), canSpeak() ? h("button.m-speak", { "aria-label": "Vorlesen", onclick: () => speak(m.text) }, "🔊") : null] : m.text);
  const drawLog = () => {
    log.replaceChildren(...(hist.length ? hist.map(bubble) : [h("div.m-chat-hi", ic("spark", 28), h("p", "Die KI kennt deine Projekte, Events und Aufgaben."),
      h("div.m-chips", SUG.map((t) => h("button.chip", { onclick: () => { inp.value = t; send(); } }, t))))]));
    log.scrollTop = log.scrollHeight;
  };
  async function send() {
    const question = inp.value.trim(); if (!question) return;
    inp.value = ""; inp.style.height = "auto";
    const prior = hist.slice(-8).map(({ role, text }) => ({ role, text }));
    hist.push({ role: "user", text: question }); drawLog();
    const wait = h("div.m-msg.assistant.wait", h("span.spinner"), " denkt nach …"); log.append(wait); log.scrollTop = log.scrollHeight;
    try { const r = await nx("ai", { question, history: prior }); hist.push({ role: "assistant", text: String(r.answer || "Keine Antwort.") }); }
    catch (e) { hist.push({ role: "assistant", text: `Fehler: ${errMsg(e)}` }); }
    hist = hist.slice(-30); store.set("chat", hist); drawLog();
  }
  drawLog();
  return h("div.m-chat",
    h("div.m-head.m-pad-x", h("h1", "KI"), h("div", { style: { display: "flex", gap: "6px" } },
      h("select.input", { "aria-label": "KI-Modell", style: { height: "34px", width: "auto", fontSize: "13px", padding: "0 8px" }, onchange: (e) => { try { localStorage.setItem("cc:ai:model", JSON.stringify(e.target.value)); } catch { /* privat */ } } },
        [["auto", "Auto"], ["gemini:gemini-flash-lite-latest", "Gemini Lite"], ["gemini:gemini-flash-latest", "Gemini Flash"], ["groq:llama-3.3-70b-versatile", "Llama 70B"], ["groq:openai/gpt-oss-120b", "GPT-OSS"]].map(([v, t]) => h("option", { value: v, selected: aiModel() === v }, t))),
      hist.length ? h("button.btn.sm", { onclick: () => { hist = []; store.set("chat", hist); drawLog(); } }, "Neu") : null)),
    log, h("div.m-chat-bar", inp, micButton(h, inp, "m-mic"), h("button.m-send", { "aria-label": "Senden", onclick: send }, ic("send", 18))));
}

async function gearView() {
  const sub = await currentSub().catch(() => null);
  const mine = sub ? (await q(sb.from("cc_push_subs").select("id,topics").eq("endpoint", sub.endpoint)).catch(() => []))[0] : null;
  const artBtn = (k) => h("button.m-art", { class: store.get("art", "nexus") === k ? "on" : "", "aria-label": `Titelbild ${ART[k].name}`,
    style: { backgroundImage: `url("${artSvg(k)}")` }, onclick: () => { store.set("art", k); applyLook(); draw(); } }, h("span", ART[k].name));
  const photoIn = h("input", { type: "file", accept: "image/*", hidden: true, onchange: async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try { const { url, accent } = await shrink(f); store.set("photo", url); store.set("photoAccent", accent); store.set("art", "photo"); applyLook(); draw(); toast("Eigenes Titelbild gesetzt"); }
    catch (er) { toastErr(er); }
  } });
  const pushNote = !pushSupported() ? (isIOS() && !isStandalone() ? "Zuerst in Safari „Teilen → Zum Home-Bildschirm“, dann Nexus vom Home-Bildschirm öffnen." : "Dieser Browser kann keine Push-Nachrichten.") : null;
  return h("div.m-pad",
    h("div.m-head", h("h1", "Einstellungen")),
    h("section.m-card", h("div.m-card-h", h("span", "Titelbild")),
      h("div.m-arts", ...Object.keys(ART).map(artBtn),
        h("button.m-art.m-art-own", { class: store.get("art", "") === "photo" ? "on" : "", style: store.get("photo", "") ? { backgroundImage: `url("${store.get("photo", "")}")` } : {}, onclick: () => photoIn.click() }, h("span", "Eigenes Foto"))), photoIn,
      h("div.m-row-s.m-mt", "Die Farbe der App passt sich dem Bild an. Eigene Fotos bleiben nur auf diesem Gerät.")),
    h("section.m-card", h("div.m-card-h", h("span", "Darstellung")),
      h("div.m-seg", [["dark", "Dunkel"], ["light", "Hell"], ["system", "System"]].map(([k, l]) => h("button", { class: store.get("theme", "dark") === k ? "on" : "", onclick: () => { store.set("theme", k); applyLook(); draw(); } }, l)))),
    h("section.m-card", h("div.m-card-h", h("span", "Startseite")), h("div.m-row-s", "Bereiche, Events (mit welchen Zahlen und Prognosen) und Projekte auswählen."),
      h("button.btn.primary.m-wide.m-mt", { onclick: () => customizeHome().catch(toastErr) }, "Startseite anpassen")),
    h("section.m-card", h("div.m-card-h", ic("bell", 18), h("span", "Benachrichtigungen")),
      pushNote ? h("div.m-row-s", pushNote) : sub
        ? h("div.m-rowbtn", h("span.m-ok", "Auf diesem Handy aktiv"),
          h("button.btn.sm", { onclick: (e) => pushTest(e.currentTarget, sub) }, "Test"),
          h("button.btn.sm.ghost", { onclick: async () => { await disablePush(); draw(); } }, "Aus"))
        : h("button.btn.primary.m-wide", { onclick: async (e) => { const b = e.currentTarget; b.disabled = true; try { await enablePush(); toast("Benachrichtigungen aktiv"); draw(); } catch (er) { toastErr(er); b.disabled = false; } } }, "Benachrichtigungen aktivieren")),
    sub && mine ? topicsCard(sub, mine) : null,
    sub ? h("section.m-card", h("div.m-card-h", h("span", "Kommt nichts oder zu spät an?")),
      h("div.m-row-s", "Drück „Test“: Die App misst, wie schnell der Server die Nachricht an dein Handy übergibt. Kommt sie trotzdem nicht oder spät:"),
      h("div.m-row-s.m-mt", isIOS() ? "iPhone: Einstellungen → Mitteilungen → Nexus → „Mitteilungen erlauben“ an, Zustellung „Sofort“ (nicht „Geplante Zusammenfassung“), Sperrbildschirm + Banner an. Fokus/„Nicht stören“ hält Mitteilungen zurück. Stromsparmodus kann verzögern." : "Android: In den App-Infos des Browsers Benachrichtigungen erlauben und Akku-Optimierung für den Browser ausschalten.")) : null,
    await invitesCard(),
    h("section.m-card", h("a.m-li.m-link-row", { href: "./" }, h("span", "Vollversion öffnen"), ic("ext", 16)),
      h("button.m-li.m-link-row", { onclick: async () => { if (await confirmDialog("Abmelden?", "Du wirst nur auf diesem Gerät abgemeldet.", { ok: "Abmelden", danger: false })) { await sb.auth.signOut({ scope: "local" }); renderLogin(); } } }, h("span", "Abmelden"), ic("lock", 16))),
    h("div.m-row-s.m-center", "Nexus Mobil"));
}

// ---------- Was soll auf dieses Handy kommen? ----------
// Test mit Messung: Server-Übergabe an Apple/Google wird über „last_ok“ des Geräts sichtbar
async function pushTest(b, sub) {
  b.disabled = true;
  const t0 = Date.now();
  try {
    const before = (await q(sb.from("cc_push_subs").select("last_ok").eq("endpoint", sub.endpoint)).catch(() => []))[0]?.last_ok || null;
    await rpc("nx_push_test");
    toast("Test gesendet – warte auf Zustellung …");
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      const now = (await q(sb.from("cc_push_subs").select("last_ok").eq("endpoint", sub.endpoint)).catch(() => []))[0]?.last_ok || null;
      if (now && now !== before) { toast(`Server hat nach ${Math.max(1, Math.round((Date.now() - t0) / 1000))} s an dein Handy übergeben. Kommt nichts, liegt es an den Handy-Einstellungen.`, "ok", 7000); b.disabled = false; return; }
    }
    toast("Der Server konnte nicht zustellen. Schalte Benachrichtigungen aus und wieder ein.", "err", 7000);
  } catch (er) { toastErr(er); }
  b.disabled = false;
}
const TOPICS = [["tickets", "Ticketverkäufe"], ["sites", "Website-Ausfälle"], ["hosting", "Hosting & Deploys"], ["tasks", "Fällige Aufgaben"], ["digest", "Überblick (Admin täglich, sonst wöchentlich)"], ["security", "Anmeldungen & Sicherheit"], ["other", "Sonstiges (neue Module, Sync …)"]];
function topicsCard(sub, mine) {
  const list = data?.admin ? TOPICS : TOPICS.filter(([k]) => ["tickets", "sites", "tasks", "digest", "other"].includes(k));
  const set = new Set(mine.topics || []);
  const save = async () => { try { await rpc("cc_push_topics_set", { p_endpoint: sub.endpoint, p_topics: [...set] }); toast("Gespeichert"); } catch (e) { toastErr(e); } };
  return h("section.m-card", h("div.m-card-h", h("span", "Benachrichtigen bei")),
    ...list.map(([k, l]) => h("label.m-switch", h("span", l), h("input", { type: "checkbox", checked: set.has(k), onchange: (e) => { e.target.checked ? set.add(k) : set.delete(k); save(); } }))));
}

// ---------- Leute einladen (ohne Konto) ----------
const INV_TOPICS = [["tickets", "Ticketverkäufe"], ["sites", "Website-Ausfälle"], ["hosting", "Hosting & Deploys"], ["tasks", "Fällige Aufgaben"]];
const inviteUrl = (c) => `${BASE}i.html?c=${c}`;
async function invitesCard() {
  const invTopics = data?.admin ? INV_TOPICS : INV_TOPICS.filter(([k]) => ["tickets", "sites", "tasks"].includes(k));
  const [inv, subs] = await Promise.all([q(sb.from("cc_push_invites").select("*").is("revoked_at", null).order("created_at", { ascending: false })).catch(() => []),
    q(sb.from("cc_push_subs").select("id,invite_id,device,created_at").not("invite_id", "is", null)).catch(() => [])]);
  const shareIt = (i) => navigator.share ? navigator.share({ title: i.label, text: `Hol dir die Benachrichtigungen „${i.label}“ aufs Handy (kein Konto nötig):`, url: inviteUrl(i.code) }).catch(() => {}) : copyText(inviteUrl(i.code));
  const create = () => {
    const pick = new Set([invTopics[0][0]]);
    const label = h("input.input", { placeholder: "z. B. Team Website", maxlength: 80, "aria-label": "Name der Einladung", value: data?.admin && data?.events?.[0] ? `Tickets ${data.events[0].name}` : "" });
    const form = h("div.m-card", { style: { margin: "10px 0 0" } }, label,
      ...invTopics.map(([k, l]) => h("label.m-switch", h("span", l), h("input", { type: "checkbox", checked: pick.has(k), onchange: (e) => (e.target.checked ? pick.add(k) : pick.delete(k)) }))),
      h("p.m-row-s", "Eingeladene sehen nur Titel und Kurztext dieser Nachrichten – keine Käuferdaten, kein Zugang zum Nexus."),
      h("button.btn.primary.m-wide", { onclick: async (e) => {
        const b = e.currentTarget; if (!label.value.trim() || !pick.size) return toast("Name und mindestens ein Thema wählen", "err");
        b.disabled = true;
        try { const r = await q(sb.from("cc_push_invites").insert({ label: label.value.trim(), topics: [...pick] }).select().single()); await shareIt(r); draw(); }
        catch (er) { toastErr(er); b.disabled = false; } } }, "Einladung erstellen & teilen"));
    card.append(form); btn.remove();
  };
  const btn = h("button.btn.m-wide.m-mt", { onclick: create }, "+ Neue Einladung");
  const card = h("section.m-card", h("div.m-card-h", ic("share", 18), h("span", "Leute einladen")),
    h("p.m-row-s", { style: { marginTop: 0 } }, "Link schicken – die Person öffnet ihn, legt ihn auf den Home-Bildschirm und bekommt die gewählten Nachrichten. Kein Konto nötig."),
    ...inv.map((i) => { const n = subs.filter((s) => s.invite_id === i.id).length; return h("div.m-li",
      h("div", { style: { flex: 1 } }, h("b", i.label), h("div.m-row-s", `${(i.topics || []).map((t) => (INV_TOPICS.find((x) => x[0] === t) || [t, t])[1]).join(", ")} · ${n} Gerät(e) · Code ${i.code}`)),
      h("button.btn.sm", { "aria-label": "Nachricht an alle senden", onclick: () => broadcastDialog(i.id, i.label) }, ic("send", 16)),
      h("button.btn.sm", { "aria-label": "Teilen", onclick: () => shareIt(i) }, ic("share", 16)),
      h("button.btn.sm.ghost", { "aria-label": "Zurückziehen", onclick: async () => { if (await confirmDialog("Einladung zurückziehen?", `${n} Gerät(e) bekommen dann keine Nachrichten mehr. Der Link funktioniert nicht mehr.`, { ok: "Zurückziehen" })) { await q(sb.from("cc_push_invites").update({ revoked_at: new Date().toISOString() }).eq("id", i.id)); draw(); } } }, "✕")); }),
    btn);
  return card;
}

// QR-Code groß anzeigen (z. B. am Einlass zum Abscannen)
function showQr(title, url) {
  const box = h("div", { style: { display: "grid", placeItems: "center", gap: "12px" } });
  box.innerHTML = qrSvg(url, { size: 280 });
  box.append(h("div.m-row-s", { style: { wordBreak: "break-all", textAlign: "center" } }, url));
  modal(title, box);
}

// Foto verkleinern (max. 900 px) und eine passende Akzentfarbe daraus ableiten
function shrink(file) {
  return new Promise((ok, bad) => {
    if (file.size > 15 * 1024 * 1024) return bad(new Error("Bild ist zu groß (max. 15 MB)."));
    const img = new window.Image(); const u = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, 900 / img.width); const c = document.createElement("canvas"); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      const x = c.getContext("2d"); x.drawImage(img, 0, 0, c.width, c.height);
      const d = x.getImageData(0, 0, c.width, c.height).data; let r = 0, g = 0, b = 0, n = 0;
      for (let i = 0; i < d.length; i += 4 * 97) { const mx = Math.max(d[i], d[i + 1], d[i + 2]), mn = Math.min(d[i], d[i + 1], d[i + 2]); if (mx - mn > 40 && mx > 80) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n++; } }
      const hex = (v) => Math.round(v).toString(16).padStart(2, "0");
      URL.revokeObjectURL(u);
      ok({ url: c.toDataURL("image/jpeg", 0.8), accent: n ? `#${hex(r / n)}${hex(g / n)}${hex(b / n)}` : "#8b8cff" });
    };
    img.onerror = () => bad(new Error("Bild konnte nicht gelesen werden."));
    img.src = u;
  });
}

async function start() {
  applyLook();
  const { data: { session } } = await sb.auth.getSession();
  if (!session) return renderLogin();
  try { await load(); } catch (e) { return renderLogin(errMsg(e)); }
  clear(root, h("div.m-app", main, bar));
  drawBar(); draw();
  // Beim Zurückkehren in die App aktualisieren
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && tab === "home") draw(); });
}

if ("serviceWorker" in navigator) {
  // Neue Versionen sofort übernehmen (die Handy-App hat keine langen Formulare)
  navigator.serviceWorker.register("sw.js").then((reg) => {
    const go = (w) => w && navigator.serviceWorker.controller && w.postMessage("skipWaiting");
    if (reg.waiting) go(reg.waiting);
    reg.addEventListener("updatefound", () => { const w = reg.installing; w?.addEventListener("statechange", () => w.state === "installed" && go(w)); });
    reg.update().catch(() => {});
    document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") reg.update().catch(() => {}); });
  }).catch(() => {});
  let reloaded = false;
  // Push kam an → offene App sofort aktualisieren (Mitteilungen, Startseite)
  navigator.serviceWorker.addEventListener("message", (e) => { if (e.data?.type === "nx-push" && document.visibilityState === "visible") { drawBar(); if (["home", "bell"].includes(tab)) draw(); } });
  navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloaded) { reloaded = true; location.reload(); } });
}
sb.auth.onAuthStateChange((ev) => { if (ev === "SIGNED_OUT") renderLogin(); });
start();
