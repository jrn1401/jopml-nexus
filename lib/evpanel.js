// Event-Prognose als Karte für Übersichten (Admin-Dashboard + eigener Bereich):
// dieselbe Kachel-Leiste wie im Event (Ergebnis, Prognose, Tickets, Break-even …), Zahnrad = Kacheln wählen.
// Die Auswahl wird beim Event gespeichert und gilt damit überall (Event-Seite, Übersicht, Handy).
import { sb, q } from "./api.js";
import { h, icon, fmtDateTime, errMsg } from "./ui.js";

async function load(id, admin) {
  if (admin) {
    const ev = await q(sb.from("cc_events").select("id,name,event_date,expected_guests,budget,metadata").eq("id", id).maybeSingle());
    if (!ev) return null;
    const [items, snaps] = await Promise.all([
      q(sb.from("cc_event_items").select("kind,done,at,amount,actual,status").eq("event_id", id)).catch(() => []),
      q(sb.from("nx_ticket_snaps").select("at,sold").eq("ref_id", id).order("at").limit(3000)).catch(() => [])]);
    const meta = ev.metadata || {};
    return { ev, items, snaps, calc: meta.calc || null, tickets: meta.tickets || {}, tiles: meta.overview, capacity: meta.tickets?.capacity || ev.expected_guests,
      save: async (tiles) => { const m = { ...(ev.metadata || {}) }; if (tiles) m.overview = tiles; else delete m.overview; await q(sb.from("cc_events").update({ metadata: m }).eq("id", id)); ev.metadata = m; } };
  }
  const ev = await q(sb.from("nx_events").select("id,name,event_date,capacity,budget,tickets,calc,nx_project_id").eq("id", id).maybeSingle());
  if (!ev) return null;
  const [items, proj] = await Promise.all([
    q(sb.from("nx_event_items").select("kind,done,at,amount").eq("event_id", id)).catch(() => []),
    ev.nx_project_id ? q(sb.from("nx_projects").select("id,metadata").eq("id", ev.nx_project_id).maybeSingle()).catch(() => null) : null]);
  const snaps = proj ? await q(sb.from("nx_ticket_snaps").select("at,sold").eq("ref_id", proj.id).order("at").limit(3000)).catch(() => []) : [];
  const tickets = proj?.metadata?.tickets ? { ...proj.metadata.tickets, live: true } : { ...(ev.tickets || {}) };
  const calc = ev.calc && (ev.calc.guests !== undefined || ev.calc.tickets) ? ev.calc : null;
  return { ev, items, snaps, calc, tickets, tiles: ev.calc?.overview, capacity: tickets.capacity || ev.capacity,
    save: async (tiles) => { const c = { ...(ev.calc || {}), overview: tiles || undefined }; await q(sb.from("nx_events").update({ calc: c }).eq("id", id)); ev.calc = c; } };
}

// id: Event-ID · admin: Control-Center-Event (cc_events) oder eigenes (nx_events) · href: Link zum Event
export function eventPanel(id, { admin = false, href = null, name = "" } = {}) {
  const body = h("div.card-body", h("div.skel", { style: { height: "86px" } }));
  const head = h("div.card-head", h("h3.row", { style: { gap: "8px" } }, icon("ticket"), name || "Event"));
  const box = h("section.card.ev-panel", head, body);
  const draw = async () => {
    try {
      const { overviewStrip, OV_HINT } = await import("./eventcalc.js");
      const d = await load(id, admin);
      if (!d) { box.remove(); return; }
      const { ev, items } = d;
      const tasks = items.filter((i) => i.kind === "task" || i.kind === "tech"), guests = items.filter((i) => i.kind === "guest");
      const spent = items.filter((i) => i.kind === "cost").reduce((a, i) => a + (Number(i.actual ?? i.amount) || 0), 0);
      const link = href || (admin ? `#/events/${ev.id}` : `#/events/${ev.id}`);
      head.replaceChildren(h("h3.row", { style: { gap: "8px" } }, icon("ticket"), h("a", { href: link, style: { color: "inherit" } }, ev.name)),
        h("span.faint", { style: { fontSize: "12.5px" } }, ev.event_date ? fmtDateTime(ev.event_date) : ""));
      body.replaceChildren(overviewStrip({ name: ev.name, calc: d.calc, tickets: d.tickets, eventDate: ev.event_date, capacity: d.capacity, snaps: d.snaps, tasks, guests, spent, budget: ev.budget,
        tiles: d.tiles, configHint: OV_HINT, onConfig: async (tiles) => { await d.save(tiles); draw(); }, onTasks: () => { location.hash = link; } }));
    } catch (e) { body.replaceChildren(h("div.faint", errMsg(e))); }
  };
  draw();
  return box;
}

// Welche Events zeigen? cfg.events = null → automatisch die nächsten n, sonst die gewählten IDs (in dieser Reihenfolge)
export function pickEvents(all, cfg, n = 1) {
  const up = all.filter((e) => !e.event_date || new Date(e.event_date) > Date.now() - 86400_000);
  if (Array.isArray(cfg)) return cfg.map((id) => all.find((e) => e.id === id)).filter(Boolean);
  return up.slice(0, n);
}
