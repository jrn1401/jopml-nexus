// KI-Studio – für alle Konten: Projekt-Assistent (Bogen + Rechts-Check + KI), Website-Baukasten,
// Marketing & Druck (QR, Visitenkarten, Merch, Posts), Zusammenfassungen, KI-Einstellungen.
// Sparsam: Regeln, QR-Codes, Designs und Seiten entstehen im Browser; die KI wird nur auf Knopfdruck gefragt.
import { sb, q, nx, aiModel } from "../lib/api.js";
import { h, icon, clear, toast, toastErr, errMsg, md, copyText, fmtDate, fmtAgo, empty, confirmDialog } from "../lib/ui.js";
import { aiGen } from "../lib/aigen.js";
import { TYPES, questionsFor, checkRules, marketingIdeas } from "../lib/rules.js";
import { TEMPLATES, THEMES, buildSite, slugify } from "../lib/sitegen.js";
import { qrSvg, qrPng } from "../lib/qr.js";

const BASE = `${location.origin}${location.pathname.replace(/[^/]*$/, "")}`;
const LS = { get: (k, d) => { try { const v = localStorage.getItem("cc:" + k); return v === null ? d : JSON.parse(v); } catch { return d; } }, set: (k, v) => { try { localStorage.setItem("cc:" + k, JSON.stringify(v)); } catch { /* voll/privat */ } } };
const missing = (e) => /does not exist|relation .* does not exist|schema cache|Could not find the (table|function)/i.test(errMsg(e));
const download = (name, content, type = "text/html") => { const a = h("a", { href: typeof content === "string" && content.startsWith("data:") ? content : URL.createObjectURL(new Blob([content], { type })), download: name }); document.body.append(a); a.click(); a.remove(); };
const field = (label, input, hint) => {
  if (input?.matches?.("input,select,textarea") && !input.getAttribute("aria-label")) input.setAttribute("aria-label", label);
  return h("div.field", h("label", label), input, hint ? h("div.hint", hint) : null);
};
const KIND_TO_TYPE = { event: "event", website: "website", shop: "shop", school: "school", business: "business", app: "software", repo: "software", personal: "other" };
const TYPE_TO_KIND = { event: "event", website: "website", shop: "shop", school: "school", business: "business", software: "app", other: "other" };

const TOOLS = [
  ["bogen", "Projekt-Assistent", "Bogen ausfüllen → Projekt wird angelegt oder dein bestehendes Projekt geprüft: Rechtliches nach Alter & Ort, Aufgaben, KI-Tipps.", "check"],
  ["web", "Website-Baukasten", "Event-Seite, Link-Seite oder Benachrichtigungs-Seite – fertig in 2 Minuten, mit QR-Code.", "external"],
  ["marketing", "Marketing & Druck", "QR-Codes, Visitenkarten mit Link, T-Shirt-/Merch-Designs, Social-Posts und ein KI-Marketingplan.", "zap"],
  ["summary", "Zusammenfassungen", "Die KI fasst ein Projekt oder alles zusammen – zum Teilen oder als Notiz.", "book"],
  ["ki", "KI-Einstellungen", "Modell wählen, Antwort-Stil, was die KI über dich gelernt hat, Einfach-Modus.", "sparkles"],
];

export async function studioPage(sub, ctx = {}) {
  const nav = h("div.tabs", { role: "tablist" }, h("button", { class: !sub ? "on" : "", onclick: () => (location.hash = "#/studio") }, "Übersicht"),
    ...TOOLS.map(([k, t]) => h("button", { class: sub === k ? "on" : "", onclick: () => (location.hash = `#/studio/${k}`) }, t)));
  const head = h("div.page-head", h("div", h("h1", sub ? TOOLS.find((x) => x[0] === sub)?.[1] || "KI-Studio" : "KI-Studio"),
    h("p", "Ideen umsetzen mit KI – für Events, Websites, Schule, Business und alles andere.")));
  let body;
  try {
    if (sub === "bogen") body = await bogen(ctx);
    else if (sub === "web") body = await webBuilder(ctx);
    else if (sub === "marketing") body = await marketing(ctx);
    else if (sub === "summary") body = await summaries(ctx);
    else if (sub === "ki") body = await kiSettings(ctx);
    else body = hub();
  } catch (e) { body = h("div.banner.bad", errMsg(e)); }
  return h("div.studio", head, nav, body);
}

function hub() {
  return h("div.grid.g-3", TOOLS.map(([k, t, d, ic]) => h("a.card.studio-tile", { href: `#/studio/${k}` },
    h("div.card-body", h("div.studio-ic", icon(ic)), h("h3", t), h("p.faint", d)))));
}

// ---------- gemeinsame Datenquelle: eigene Projekte & Events ----------
async function targets(ctx) {
  const [np, ne, ce] = await Promise.all([
    q(sb.from("nx_projects").select("id,name,kind,url,description,metadata").order("updated_at", { ascending: false }).limit(80)).catch(() => []),
    q(sb.from("nx_events").select("id,name,event_date,location,capacity,description,nx_project_id").neq("status", "cancelled").limit(50)).catch(() => []),
    ctx.admin ? q(sb.from("cc_events").select("id,name,event_date,location,expected_guests,description,metadata").neq("status", "cancelled").limit(30)).catch(() => []) : []]);
  return [
    ...ce.map((e) => ({ key: `ce:${e.id}`, label: `${e.name} (Event, Control Center)`, type: "event", row: e, src: "ce" })),
    ...ne.map((e) => ({ key: `ne:${e.id}`, label: `${e.name} (Event)`, type: "event", row: e, src: "ne" })),
    ...np.map((p) => ({ key: `np:${p.id}`, label: `${p.name} (${p.kind})`, type: p.metadata?.profile?.type || KIND_TO_TYPE[p.kind] || "other", row: p, src: "np" }))];
}
const describe = (t) => {
  if (!t) return "";
  const r = t.row;
  return [`Name: ${r.name}`, r.event_date && `Datum: ${fmtDate(r.event_date)}`, r.location && `Ort: ${r.location}`, (r.capacity || r.expected_guests) && `Gäste: ${r.capacity || r.expected_guests}`,
    r.url && `URL: ${r.url}`, r.description && `Beschreibung: ${String(r.description).slice(0, 1500)}`].filter(Boolean).join("\n");
};
function targetSelect(list, value, onchange, { allowNew = false, label = "Projekt" } = {}) {
  return field(label, h("select.input", { "aria-label": label, onchange: (e) => onchange(e.target.value) },
    allowNew ? h("option", { value: "", selected: !value }, "➕ Neues Projekt") : h("option", { value: "", selected: !value }, "– ohne Projekt –"),
    list.map((t) => h("option", { value: t.key, selected: value === t.key }, t.label))));
}

// =====================================================================
// 1) Projekt-Assistent
// =====================================================================
async function bogen(ctx) {
  const list = await targets(ctx);
  const st = { target: "", type: "event", answers: {} };
  const box = h("div.stack");
  const pickTarget = (key) => {
    st.target = key;
    const t = list.find((x) => x.key === key);
    const saved = t?.row?.metadata?.profile || LS.get(`bogen:${key || "neu"}`, null);
    st.type = saved?.type || t?.type || st.type;
    st.answers = { ...(saved?.answers || {}) };
    if (t && !st.answers.name) st.answers.name = t.row.name;
    if (t?.row?.event_date && !st.answers.deadline) st.answers.deadline = String(t.row.event_date).slice(0, 10);
    if ((t?.row?.capacity || t?.row?.expected_guests) && !st.answers.guests) st.answers.guests = t.row.capacity || t.row.expected_guests;
    if (t?.row?.description && !st.answers.goal) st.answers.goal = String(t.row.description).slice(0, 400);
    draw();
  };
  function draw() {
    const qs = questionsFor(st.type);
    const inputs = qs.map(([k, label, kind, opts, hint]) => {
      const v = st.answers[k];
      const set = (val) => { st.answers[k] = val; LS.set(`bogen:${st.target || "neu"}`, { type: st.type, answers: st.answers }); };
      let inp;
      if (kind === "select") inp = h("select.input", { onchange: (e) => set(e.target.value) }, h("option", { value: "" }, "– bitte wählen –"), opts.map((o) => h("option", { value: o, selected: v === o }, o)));
      else if (kind === "multi") inp = h("div.row.wrap", opts.map((o) => h("button.chip", { type: "button", class: (v || []).includes(o) ? "on" : "", onclick: (e) => { const cur = new Set(st.answers[k] || []); cur.has(o) ? cur.delete(o) : cur.add(o); set([...cur]); e.currentTarget.classList.toggle("on"); } }, o)));
      else if (kind === "textarea") inp = h("textarea.input", { rows: 3, maxlength: 1200, oninput: (e) => set(e.target.value) }, v || "");
      else inp = h("input.input", { type: kind === "number" ? "number" : kind === "date" ? "date" : "text", min: kind === "number" ? 0 : undefined, value: v ?? "", maxlength: 160, oninput: (e) => set(e.target.value) });
      inp.setAttribute?.("aria-label", label);
      return field(label, inp, hint);
    });
    clear(box,
      h("section.card", h("div.card-body.stack",
        targetSelect(list, st.target, pickTarget, { allowNew: true, label: "Für welches Projekt?" }),
        h("div", h("div.faint", { style: { fontSize: "13px", marginBottom: "6px" } }, "Art des Projekts"),
          h("div.row.wrap", TYPES.map(([k, t, ic]) => h("button.chip", { type: "button", class: st.type === k ? "on" : "", onclick: () => { st.type = k; draw(); } }, icon(ic), t)))))),
      h("section.card", h("div.card-head", h("h3", "Fragen")), h("div.card-body.form", h("div.grid.g-2", inputs))),
      h("div.row.wrap", { style: { gap: "8px" } },
        h("button.btn.primary", { onclick: () => result() }, icon("check"), "Auswerten"),
        h("span.faint", { style: { fontSize: "12.5px" } }, "Antworten werden automatisch auf diesem Gerät gemerkt.")),
      resBox);
  }
  const resBox = h("div.stack");
  function result() {
    const items = checkRules(st.type, st.answers);
    const pick = new Set(items.filter((i) => i.task && i.level !== "tipp").map((i) => i.id));
    const aiBox = h("div");
    const lv = { muss: ["Pflicht", "b-bad"], wichtig: ["Wichtig", "b-warn"], tipp: ["Tipp", "b-idle"] };
    const extra = [];
    clear(resBox,
      h("section.card", h("div.card-head", h("h3", `Check: ${items.length} Punkte`), h("span.faint", { style: { fontSize: "12px" } }, "Orientierung, keine Rechtsberatung")),
        h("div.card-body", items.length ? h("div.list", items.map((i) => h("div.list-item", { style: { alignItems: "flex-start" } },
          i.task ? h("input", { type: "checkbox", checked: pick.has(i.id), "aria-label": `Als Aufgabe übernehmen: ${i.task}`, onchange: (e) => (e.target.checked ? pick.add(i.id) : pick.delete(i.id)) }) : h("span", { style: { width: "16px" } }),
          h("div.li-main", h("div.li-title", h("span.badge", { class: lv[i.level][1], style: { marginRight: "6px" } }, lv[i.level][0]), i.title),
            h("div.li-sub", { style: { whiteSpace: "normal" } }, `${i.area}: ${i.why}`, i.ref ? [" ", h("a", { href: i.ref[1], target: "_blank", rel: "noopener" }, i.ref[0])] : null),
            i.task ? h("div.li-sub", { style: { color: "var(--primary)" } }, `Aufgabe: ${i.task}`) : null)))) : h("div.faint", "Keine besonderen Pflichten gefunden – die KI-Analyse kann noch Tipps geben."))),
      h("section.card", h("div.card-head", h("h3", "KI-Analyse"), h("button.btn.sm", { onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; aiBox.replaceChildren(h("div.faint", h("span.spinner"), " Die KI analysiert dein Projekt …"));
        try {
          const t = list.find((x) => x.key === st.target);
          const r = await aiGen({ task: "projekt-bogen", json: true, withContext: false,
            instructions: `Analysiere ein Projekt anhand eines Fragebogens und vorhandener Projektdaten. Gib konkrete, umsetzbare Schritte für genau diese Situation (Alter, Ort, Größe, Budget). Keine Paragraphen erfinden – nur nennen, wenn sicher. Antworte NUR als JSON:
{"summary":"2-3 Sätze Einschätzung","tasks":[{"title":"konkrete Aufgabe (max 100 Zeichen)","why":"kurz warum","weeks_before":3}],"risks":["…"],"marketing":["konkrete Idee"],"budget":"kurze Budget-Einschätzung oder leer"}
Höchstens 8 tasks, 4 risks, 5 marketing.`,
            input: `Art: ${st.type}\nAntworten: ${JSON.stringify(st.answers)}\n${describe(t)}\nBereits gefundene Pflichten: ${items.map((i) => i.title).join("; ")}` });
          const j = r.json || {};
          (j.tasks || []).slice(0, 8).forEach((t2, n) => { const id = `ai${n}`; extra.push({ id, task: String(t2.title || "").slice(0, 200), why: t2.why, weeks: Number(t2.weeks_before) || null }); pick.add(id); });
          aiBox.replaceChildren(h("div.stack",
            j.summary ? h("p", { style: { margin: 0 } }, j.summary) : md(r.text),
            extra.length ? h("div.list", extra.map((x) => h("label.list-item", h("input", { type: "checkbox", checked: true, onchange: (ev) => (ev.target.checked ? pick.add(x.id) : pick.delete(x.id)) }),
              h("div.li-main", h("div.li-title", x.task), x.why ? h("div.li-sub", { style: { whiteSpace: "normal" } }, x.why + (x.weeks ? ` · ${x.weeks} Wochen vorher` : "")) : null)))) : null,
            (j.risks || []).length ? h("div", h("b", "Risiken: "), j.risks.join(" · ")) : null,
            (j.marketing || []).length ? h("div", h("b", "Marketing: "), j.marketing.join(" · ")) : null,
            j.budget ? h("div", h("b", "Budget: "), j.budget) : null,
            h("div.faint", { style: { fontSize: "12px" } }, `Modell: ${r.model || "–"}`)));
        } catch (er) { aiBox.replaceChildren(h("div.banner.bad", errMsg(er))); }
        b.disabled = false;
      } }, icon("sparkles"), "Mit KI analysieren")), h("div.card-body", aiBox)),
      h("div.row.wrap", { style: { gap: "8px" } }, h("button.btn.primary", { onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true;
        try {
          const chosen = [...items.filter((i) => i.task && pick.has(i.id)).map((i) => ({ title: i.task, note: `${i.why}${i.ref ? ` (${i.ref[0]})` : ""}`, weeks: null })),
            ...extra.filter((x) => pick.has(x.id) && x.task).map((x) => ({ title: x.task, note: x.why || "", weeks: x.weeks }))];
          const res = await applyBogen(ctx, list, st, items, chosen);
          toast(res.msg); if (res.go) location.hash = res.go; else location.reload();
        } catch (er) { toastErr(er); b.disabled = false; }
      } }, icon("check"), st.target ? "Aufgaben ins Projekt übernehmen" : "Projekt anlegen"),
      h("a.btn", { href: "#/studio/marketing" }, "Weiter zu Marketing")));
    resBox.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  pickTarget("");
  return box;
}

async function applyBogen(ctx, list, st, items, tasks) {
  const t = list.find((x) => x.key === st.target);
  const a = st.answers;
  const profile = { type: st.type, answers: a, checked_at: new Date().toISOString(), check: items.map((i) => ({ level: i.level, title: i.title, ref: i.ref?.[0] || null })) };
  const due = (weeks) => (a.deadline && weeks ? new Date(new Date(a.deadline).getTime() - weeks * 7 * 864e5).toISOString() : null);
  const dedupe = (existing) => tasks.filter((x) => !existing.some((e) => e.title.toLowerCase() === x.title.toLowerCase()));
  if (!t) {
    const name = (a.name || "").trim() || "Neues Projekt";
    const p = await q(sb.from("nx_projects").insert({ name: name.slice(0, 120), kind: TYPE_TO_KIND[st.type] || "other", description: String(a.goal || "").slice(0, 4000), provider: "manual", metadata: { profile } }).select().single());
    if (st.type === "event") {
      const ev = await q(sb.from("nx_events").insert({ name: name.slice(0, 160), event_date: a.deadline || null, capacity: Number(a.guests) || null, budget: Number(a.budget) || null, status: "planning", nx_project_id: p.id, description: String(a.goal || "").slice(0, 8000) }).select().single());
      if (tasks.length) await q(sb.from("nx_event_items").insert(tasks.map((x) => ({ event_id: ev.id, kind: "task", title: x.title.slice(0, 200), note: x.note.slice(0, 1000), at: due(x.weeks) }))));
      return { msg: `Projekt + Event angelegt, ${tasks.length} Aufgaben`, go: `#/events/${ev.id}` };
    }
    if (tasks.length) await q(sb.from("nx_tasks").insert(tasks.map((x) => ({ title: `${name}: ${x.title}`.slice(0, 300), note: x.note.slice(0, 4000), due: due(x.weeks) }))));
    return { msg: `Projekt angelegt, ${tasks.length} Aufgaben`, go: `#/p/${p.id}` };
  }
  if (t.src === "ce") {
    const ex = await q(sb.from("cc_event_items").select("title").eq("event_id", t.row.id).eq("kind", "task"));
    const add = dedupe(ex);
    if (add.length) await q(sb.from("cc_event_items").insert(add.map((x) => ({ event_id: t.row.id, kind: "task", title: x.title.slice(0, 200), note: x.note.slice(0, 1000), at: due(x.weeks) }))));
    await q(sb.from("cc_events").update({ metadata: { ...(t.row.metadata || {}), profile } }).eq("id", t.row.id));
    return { msg: `${add.length} Aufgaben ergänzt`, go: `#/events/${t.row.id}` };
  }
  if (t.src === "ne") {
    const ex = await q(sb.from("nx_event_items").select("title").eq("event_id", t.row.id).eq("kind", "task"));
    const add = dedupe(ex);
    if (add.length) await q(sb.from("nx_event_items").insert(add.map((x) => ({ event_id: t.row.id, kind: "task", title: x.title.slice(0, 200), note: x.note.slice(0, 1000), at: due(x.weeks) }))));
    if (t.row.nx_project_id) { const p = list.find((x) => x.key === `np:${t.row.nx_project_id}`); if (p) await q(sb.from("nx_projects").update({ metadata: { ...(p.row.metadata || {}), profile } }).eq("id", p.row.id)); }
    LS.set(`bogen:${t.key}`, { type: st.type, answers: a });
    return { msg: `${add.length} Aufgaben ergänzt`, go: `#/events/${t.row.id}` };
  }
  const ex = await q(sb.from("nx_tasks").select("title"));
  const named = tasks.map((x) => ({ ...x, title: `${t.row.name}: ${x.title}`.slice(0, 300) }));
  const add = named.filter((x) => !ex.some((e) => e.title.toLowerCase() === x.title.toLowerCase()));
  if (add.length) await q(sb.from("nx_tasks").insert(add.map((x) => ({ title: x.title, note: x.note.slice(0, 4000), due: due(x.weeks) }))));
  await q(sb.from("nx_projects").update({ metadata: { ...(t.row.metadata || {}), profile } }).eq("id", t.row.id));
  return { msg: `${add.length} Aufgaben ergänzt`, go: `#/p/${t.row.id}` };
}

// =====================================================================
// 2) Website-Baukasten
// =====================================================================
async function webBuilder(ctx) {
  let sites = [], tableOk = true;
  try { sites = await q(sb.from("nx_sites").select("id,slug,title,template,published,views,updated_at,data").order("updated_at", { ascending: false })); }
  catch (e) { if (missing(e)) tableOk = false; else throw e; }
  const list = await targets(ctx);
  const wrap = h("div.stack");
  const listView = () => clear(wrap,
    tableOk ? null : h("div.banner.warn", "Veröffentlichen ist ab der nächsten Freischaltung aktiv. Bis dahin kannst du Seiten bauen, ansehen und als HTML herunterladen (z. B. für Netlify)."),
    h("div.grid.g-2", Object.entries(TEMPLATES).map(([k, t]) => h("button.card.studio-tile", { onclick: () => editor({ template: k, data: {}, theme: k === "event" ? "rave" : "nacht" }) },
      h("div.card-body", h("h3", t.name), h("p.faint", t.desc))))),
    sites.length ? h("section.card", h("div.card-head", h("h3", "Meine Seiten")), h("div.list", sites.map((s) => h("div.list-item",
      h("div.li-main", h("div.li-title", s.title), h("div.li-sub", `${TEMPLATES[s.template]?.name || s.template} · ${s.published ? `online · ${s.views} Aufrufe` : "Entwurf"} · ${fmtAgo(s.updated_at)}`)),
      s.published ? h("a.btn.sm", { href: `${BASE}w.html?s=${s.slug}`, target: "_blank", rel: "noopener" }, icon("external")) : null,
      h("button.btn.sm", { onclick: () => editor({ id: s.id, slug: s.slug, template: s.template, data: s.data?.fields || {}, theme: s.data?.theme || "nacht", invite: s.data?.invite_code, published: s.published }) }, icon("edit"), "Bearbeiten"))))) : null);

  function editor(s) {
    const tpl = TEMPLATES[s.template];
    const vals = { ...s.data };
    let theme = s.theme, slug = s.slug || "", invite = s.invite || null;
    const frame = h("iframe.site-prev", { title: "Vorschau", sandbox: "", referrerpolicy: "no-referrer" });
    const url = () => `${BASE}w.html?s=${slug || slugify(vals.title)}`;
    const notifyUrl = () => (invite ? `${BASE}i.html?c=${invite}` : "");
    const html = () => buildSite(s.template, vals, theme, { url: tableOk ? url() : "", invite, notifyUrl: notifyUrl() });
    const refresh = () => { frame.srcdoc = html(); };
    const inputs = tpl.fields.map(([k, label, kind]) => field(label, kind === "textarea"
      ? h("textarea.input", { rows: 4, maxlength: 3000, oninput: (e) => { vals[k] = e.target.value; refresh(); } }, vals[k] || "")
      : h("input.input", { type: kind || "text", value: vals[k] || "", maxlength: 300, oninput: (e) => { vals[k] = e.target.value; refresh(); } })));
    const fillFrom = (key) => {
      const t = list.find((x) => x.key === key); if (!t) return;
      const r = t.row;
      vals.title = vals.title || r.name;
      if (s.template === "event") { vals.date = vals.date || (r.event_date ? String(r.event_date).slice(0, 16) : ""); vals.place = vals.place || r.location || ""; vals.ticket = vals.ticket || r.metadata?.ticket_link || ""; }
      if (s.template === "project") vals.links = vals.links || (r.url ? `Website | ${r.url}` : "");
      vals.text = vals.text || String(r.description || "").slice(0, 800);
      editor({ ...s, data: vals, theme, slug, invite });
    };
    const aiBtn = h("button.btn", { onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try {
        const keys = tpl.fields.map((f) => f[0]).filter((k) => !["date", "ticket", "links"].includes(k));
        const r = await aiGen({ task: "website", json: true, instructions: `Schreibe Texte für eine ${tpl.name}. Lebendig, kurz, auf Deutsch, passend zur Zielgruppe. Keine erfundenen Fakten (Datum, Preise, Namen) – nutze nur Gegebenes. Antworte NUR als JSON mit diesen Feldern: ${keys.join(", ")}. Mehrzeilige Felder mit \\n trennen.`,
          input: JSON.stringify(vals) });
        for (const k of keys) if (r.json?.[k] && typeof r.json[k] === "string") vals[k] = r.json[k].slice(0, 3000);
        editor({ ...s, data: vals, theme, slug, invite }); toast("Texte eingesetzt – prüfen und anpassen");
      } catch (er) { toastErr(er); b.disabled = false; }
    } }, icon("sparkles"), "Texte mit KI schreiben");
    const save = async (publish) => {
      if (!vals.title) throw new Error("Bitte einen Titel eingeben.");
      if ((s.template === "notify" || vals.alarm) && !invite) {
        const r = await q(sb.from("cc_push_invites").insert({ label: vals.title.slice(0, 80), topics: [ctx.admin && s.template === "event" ? "tickets" : "tasks"] }).select().single());
        invite = r.code;
      }
      slug = slug || slugify(vals.title) + "-" + Math.random().toString(36).slice(2, 6);
      const row = { slug, title: vals.title.slice(0, 120), template: s.template, data: { fields: vals, theme, invite_code: invite }, html: html(), published: publish };
      if (s.id) await q(sb.from("nx_sites").update(row).eq("id", s.id));
      else s.id = (await q(sb.from("nx_sites").insert(row).select("id").single())).id;
      s.published = publish;
    };
    clear(wrap,
      h("button.btn.ghost.sm", { onclick: () => location.reload() }, "← Zurück"),
      h("div.studio-split",
        h("section.card", h("div.card-head", h("h3", tpl.name)), h("div.card-body.form.stack",
          targetSelect(list, "", fillFrom, { label: "Daten aus Projekt übernehmen" }),
          ...inputs,
          s.template === "event" ? h("label.check", h("input", { type: "checkbox", checked: !!vals.alarm || !!invite, onchange: (e) => { vals.alarm = e.target.checked; } }), "„Ticket-Alarm aufs Handy“-Knopf (Besucher bekommen deine Ticket-Nachrichten ohne Konto)") : null,
          field("Farben", h("div.row.wrap", Object.entries(THEMES).map(([k, t]) => h("button.chip", { type: "button", class: theme === k ? "on" : "", onclick: (e) => { theme = k; e.currentTarget.parentNode.querySelectorAll(".chip").forEach((c) => c.classList.remove("on")); e.currentTarget.classList.add("on"); refresh(); } },
            h("span", { style: { display: "inline-block", width: "12px", height: "12px", borderRadius: "50%", background: `linear-gradient(135deg,${t.a},${t.b})`, marginRight: "6px" } }), t.name)))),
          h("div.row.wrap", { style: { gap: "8px" } }, aiBtn,
            h("button.btn", { onclick: () => download(`${slugify(vals.title)}.html`, html()) }, icon("download"), "HTML herunterladen")),
          tableOk ? h("div.row.wrap", { style: { gap: "8px" } },
            h("button.btn.primary", { onclick: async (e) => { const b = e.currentTarget; b.disabled = true; try { await save(true); toast("Online!"); copyText(url()); editor({ ...s, data: vals, theme, slug, invite }); } catch (er) { toastErr(er); b.disabled = false; } } }, icon("external"), s.published ? "Aktualisieren" : "Veröffentlichen"),
            h("button.btn", { onclick: async () => { try { await save(false); toast("Als Entwurf gespeichert"); } catch (er) { toastErr(er); } } }, "Entwurf speichern"),
            s.id ? h("button.btn.ghost", { onclick: async () => { if (await confirmDialog("Seite löschen?", "Die Seite ist danach nicht mehr erreichbar.", { ok: "Löschen" })) { await q(sb.from("nx_sites").delete().eq("id", s.id)); location.reload(); } } }, icon("trash")) : null) : null,
          s.published ? h("div.na-note", icon("external"), h("div", "Online unter ", h("a", { href: url(), target: "_blank", rel: "noopener" }, url()), " · ", h("a", { href: "#/studio/marketing", onclick: () => LS.set("mk:url", url()) }, "QR/Visitenkarte dafür"))) : null)),
        h("section.card.site-prev-card", h("div.card-head", h("h3", "Vorschau")), frame)));
    refresh();
  }
  listView();
  return wrap;
}

// =====================================================================
// 3) Marketing & Druck
// =====================================================================
async function marketing(ctx) {
  const list = await targets(ctx);
  const st = { target: "", url: LS.get("mk:url", ""), name: "", type: "event", tool: "qr" };
  const out = h("div.stack");
  const urlIn = h("input.input", { type: "url", placeholder: "https://… (Website, Tickets, Link-Seite)", value: st.url, "aria-label": "Link", oninput: (e) => { st.url = e.target.value.trim(); LS.set("mk:url", st.url); } });
  const pick = (key) => {
    st.target = key; const t = list.find((x) => x.key === key);
    if (t) { st.name = t.row.name; st.type = t.type; if (!st.url && (t.row.url || t.row.metadata?.ticket_link)) { st.url = t.row.url || t.row.metadata.ticket_link; urlIn.value = st.url; } }
    tools();
  };
  const toolsBox = h("div.row.wrap", { style: { gap: "8px" } });
  const tools = () => clear(toolsBox, ...[["qr", "QR-Code"], ["card", "Visitenkarten"], ["shirt", "T-Shirt / Merch"], ["social", "Social-Posts"], ["plan", "KI-Marketingplan"]].map(([k, t]) =>
    h("button.chip", { class: st.tool === k ? "on" : "", onclick: () => { st.tool = k; tools(); run(); } }, t)));
  const need = () => { if (!/^https?:\/\/\S+$/.test(st.url)) { toast("Bitte zuerst einen Link eingeben (https://…)", "err"); return false; } return true; };

  function run() {
    if (st.tool === "qr") {
      let color = "#000000";
      const prev = h("div.qr-prev");
      const draw = () => { prev.innerHTML = /^https?:\/\//.test(st.url) ? qrSvg(st.url, { size: 220, dark: color }) : ""; };
      clear(out, h("section.card", h("div.card-body.studio-split",
        h("div.stack", h("p.faint", { style: { margin: 0 } }, "Scannbar mit jeder Handy-Kamera. Schwarz auf Weiß ist am zuverlässigsten."),
          field("Farbe", h("input", { type: "color", value: color, oninput: (e) => { color = e.target.value; draw(); } })),
          h("div.row.wrap", { style: { gap: "8px" } },
            h("button.btn.primary", { onclick: () => need() && download("qr-code.png", qrPng(st.url, { dark: color })) }, icon("download"), "PNG (Druck)"),
            h("button.btn", { onclick: () => need() && download("qr-code.svg", qrSvg(st.url, { size: 1024, dark: color }), "image/svg+xml") }, icon("download"), "SVG (beliebig groß)"))),
        prev)));
      urlIn.oninput = (e) => { st.url = e.target.value.trim(); LS.set("mk:url", st.url); draw(); };
      draw();
    } else if (st.tool === "card") cardTool();
    else if (st.tool === "shirt") shirtTool();
    else if (st.tool === "social") socialTool();
    else planTool();
  }

  function cardTool() {
    const v = LS.get("mk:card", { name: st.name || "", line: "", contact: "", theme: "nacht" });
    const prev = h("div.vcard-prev");
    const svg = () => { const th = THEMES[v.theme] || THEMES.nacht; return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 850 550" width="850" height="550"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${th.a}"/><stop offset="1" stop-color="${th.b}"/></linearGradient></defs><rect width="850" height="550" rx="0" fill="${th.bg}"/><rect x="0" y="0" width="14" height="550" fill="url(#g)"/><text x="60" y="190" font-family="Inter,Arial,sans-serif" font-size="64" font-weight="800" fill="${th.fg}">${esc(v.name || "Dein Name")}</text><text x="60" y="250" font-family="Inter,Arial,sans-serif" font-size="30" fill="${th.mute}">${esc(v.line || "Was du machst")}</text><text x="60" y="440" font-family="Inter,Arial,sans-serif" font-size="26" fill="${th.fg}">${esc(v.contact || "")}</text><text x="60" y="480" font-family="Inter,Arial,sans-serif" font-size="22" fill="${th.a}">${esc(String(st.url).replace(/^https?:\/\//, "").slice(0, 44))}</text>${/^https?:\/\//.test(st.url) ? `<g transform="translate(560 170)">${qrSvg(st.url, { size: 230 }).replace("<svg ", "<svg width=\"230\" height=\"230\" ")}</g>` : ""}</svg>`; };
    const draw = () => { LS.set("mk:card", v); prev.innerHTML = svg(); };
    const inp = (k, label) => field(label, h("input.input", { value: v[k] || "", maxlength: 60, oninput: (e) => { v[k] = e.target.value; draw(); } }));
    const sheet = () => { const one = svg(); return `<!doctype html><html><head><meta charset="utf-8"><title>Visitenkarten</title><style>@page{size:A4;margin:10mm}body{margin:0}.g{display:grid;grid-template-columns:85mm 85mm;gap:4mm;justify-content:center}.c{width:85mm;height:55mm;outline:0.1mm dashed #bbb}.c svg{width:100%;height:100%}</style></head><body><div class="g">${Array(10).fill(`<div class="c">${one}</div>`).join("")}</div></body></html>`; };
    clear(out, h("section.card", h("div.card-body.studio-split",
      h("div.stack", inp("name", "Name / Projekt"), inp("line", "Zeile darunter (z. B. Eventveranstalter)"), inp("contact", "Kontakt (z. B. @instagram oder E-Mail)"),
        field("Stil", h("div.row.wrap", Object.entries(THEMES).map(([k, t]) => h("button.chip", { class: v.theme === k ? "on" : "", onclick: () => { v.theme = k; cardTool(); } }, t.name)))),
        h("div.row.wrap", { style: { gap: "8px" } },
          h("button.btn.primary", { onclick: () => need() && download("visitenkarten-a4.html", sheet()) }, icon("download"), "Druckbogen (10 Stück, A4)"),
          h("button.btn", { onclick: () => need() && download("visitenkarte.svg", svg(), "image/svg+xml") }, icon("download"), "Einzeln (SVG)")),
        h("div.faint", { style: { fontSize: "12.5px" } }, "Druckbogen öffnen und mit Strg+P (iPhone: Teilen → Drucken) drucken – 85 × 55 mm, Schnittlinien gestrichelt. Oder die SVG an eine Online-Druckerei schicken.")),
      prev)));
    draw();
  }

  function shirtTool() {
    const v = LS.get("mk:shirt", { top: st.name || "", bottom: "", style: "bold", color: "#111111", qr: true, theme: "rave" });
    const prev = h("div.shirt-prev");
    const design = () => {
      const th = THEMES[v.theme] || THEMES.rave;
      const qr = v.qr && /^https?:\/\//.test(st.url) ? `<g transform="translate(1050 2350)">${qrSvg(st.url, { size: 450, light: "#ffffff" }).replace("<svg ", "<svg width=\"450\" height=\"450\" ")}</g>` : "";
      const big = esc(v.top || "DEIN TEXT");
      const fs = Math.max(140, Math.min(380, Math.floor(2600 / Math.max(4, (v.top || "DEIN TEXT").length))));
      const deco = v.style === "bold" ? `<rect x="300" y="700" width="1950" height="40" fill="${th.a}"/><rect x="300" y="1500" width="1950" height="40" fill="${th.b}"/>`
        : v.style === "retro" ? `<circle cx="1275" cy="1100" r="620" fill="none" stroke="${th.a}" stroke-width="36"/><circle cx="1275" cy="1100" r="540" fill="none" stroke="${th.b}" stroke-width="18"/>` : "";
      return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 2550 3000" width="2550" height="3000">${deco}<text x="1275" y="${1120 + fs / 3}" text-anchor="middle" font-family="Impact,Arial Black,Arial,sans-serif" font-size="${fs}" font-weight="900" letter-spacing="8" fill="url(#sg)">${big}</text><defs><linearGradient id="sg" x1="0" x2="1"><stop offset="0" stop-color="${th.a}"/><stop offset="1" stop-color="${th.b}"/></linearGradient></defs><text x="1275" y="1900" text-anchor="middle" font-family="Arial,sans-serif" font-size="120" fill="${v.color === "#ffffff" ? "#111" : "#fff"}" letter-spacing="10">${esc(v.bottom || "")}</text>${qr}</svg>`;
    };
    const mock = () => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 640"><path d="M180 40 L240 20 Q300 60 360 20 L420 40 L560 120 L510 230 L450 200 L450 620 L150 620 L150 200 L90 230 L40 120 Z" fill="${v.color}" stroke="#0003" stroke-width="3"/><g transform="translate(195 150) scale(0.0824)">${design().replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "")}</g></svg>`;
    const draw = () => { LS.set("mk:shirt", v); prev.innerHTML = mock(); };
    const sugg = h("div.row.wrap", { style: { gap: "6px" } });
    clear(out, h("section.card", h("div.card-body.studio-split",
      h("div.stack",
        field("Großer Text", h("input.input", { value: v.top, maxlength: 24, oninput: (e) => { v.top = e.target.value; draw(); } })),
        field("Kleiner Text", h("input.input", { value: v.bottom, maxlength: 40, oninput: (e) => { v.bottom = e.target.value; draw(); } })),
        h("button.btn", { onclick: async (e) => {
          const b = e.currentTarget; b.disabled = true;
          try {
            const r = await aiGen({ task: "merch", json: true, instructions: "Erfinde kurze, starke Slogans für ein T-Shirt/Merch zu diesem Projekt (Deutsch oder Englisch, max. 22 Zeichen für den großen Text, max. 36 für den kleinen). Antworte NUR als JSON: {\"ideas\":[{\"top\":\"…\",\"bottom\":\"…\"}]} mit 6 Ideen.", input: `${st.name || "Projekt"} (${st.type}) ${describe(list.find((x) => x.key === st.target))}` });
            clear(sugg, (r.json?.ideas || []).slice(0, 6).map((i) => h("button.chip", { onclick: () => { v.top = String(i.top || "").slice(0, 24); v.bottom = String(i.bottom || "").slice(0, 40); shirtTool(); } }, `${i.top}${i.bottom ? ` · ${i.bottom}` : ""}`)));
          } catch (er) { toastErr(er); }
          b.disabled = false;
        } }, icon("sparkles"), "Slogans mit KI"), sugg,
        field("Stil", h("div.row.wrap", [["bold", "Balken"], ["retro", "Retro-Kreis"], ["clean", "Schlicht"]].map(([k, t]) => h("button.chip", { class: v.style === k ? "on" : "", onclick: () => { v.style = k; shirtTool(); } }, t)))),
        field("Farben", h("div.row.wrap", Object.entries(THEMES).map(([k, t]) => h("button.chip", { class: v.theme === k ? "on" : "", onclick: () => { v.theme = k; shirtTool(); } }, t.name)))),
        field("Shirt-Farbe", h("div.row.wrap", ["#111111", "#ffffff", "#1e2a5a", "#5a1e3a", "#2e4a2e"].map((c) => h("button.chip", { class: v.color === c ? "on" : "", style: { background: c, width: "34px", height: "28px" }, "aria-label": `Shirt ${c}`, onclick: () => { v.color = c; shirtTool(); } })))),
        h("label.check", h("input", { type: "checkbox", checked: v.qr, onchange: (e) => { v.qr = e.target.checked; draw(); } }), "QR-Code zum Link auf das Shirt"),
        h("div.row.wrap", { style: { gap: "8px" } },
          h("button.btn.primary", { onclick: () => download("shirt-druckdatei.svg", design(), "image/svg+xml") }, icon("download"), "Druckdatei (SVG, 30 × 35 cm)"),
          h("button.btn", { onclick: () => download("shirt-vorschau.svg", mock(), "image/svg+xml") }, icon("download"), "Vorschau")),
        h("div.faint", { style: { fontSize: "12.5px" } }, "Die SVG kannst du bei Shirt-Druckereien (Siebdruck/DTF) hochladen. Schriften werden dort ersetzt, wenn sie fehlen – im Zweifel als PDF exportieren.")),
      prev)));
    draw();
  }

  function socialTool() {
    const res = h("div.stack");
    const goal = h("input.input", { placeholder: "z. B. Ticketverkauf ankurbeln, Launch ankündigen", maxlength: 200, "aria-label": "Ziel" });
    clear(out, h("section.card", h("div.card-body.stack",
      field("Ziel der Posts", goal),
      h("button.btn.primary", { onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; res.replaceChildren(h("div.faint", h("span.spinner"), " schreibt …"));
        try {
          const r = await aiGen({ task: "social", json: true, withContext: true, instructions: "Schreibe Social-Media-Texte für dieses Projekt. Antworte NUR als JSON: {\"posts\":[{\"channel\":\"Instagram|TikTok|WhatsApp-Status|Story|LinkedIn\",\"text\":\"…\",\"hashtags\":\"#…\"}]} – 5 Posts, verschiedene Kanäle, mit Call-to-Action und dem Link, wenn vorhanden. Keine erfundenen Fakten.",
            input: `Projekt: ${st.name || "–"} (${st.type})\nZiel: ${goal.value || "Aufmerksamkeit"}\nLink: ${st.url || "–"}\n${describe(list.find((x) => x.key === st.target))}` });
          const posts = r.json?.posts || [];
          res.replaceChildren(...(posts.length ? posts.map((p) => h("div.card", h("div.card-body.stack", h("b", p.channel || "Post"), h("div", { style: { whiteSpace: "pre-wrap" } }, p.text), p.hashtags ? h("div.faint", p.hashtags) : null,
            h("button.btn.sm", { onclick: () => copyText(`${p.text}\n\n${p.hashtags || ""}`.trim()) }, "Kopieren")))) : [md(r.text)]));
        } catch (er) { res.replaceChildren(h("div.banner.bad", errMsg(er))); }
        b.disabled = false;
      } }, icon("sparkles"), "Posts schreiben"), res)));
  }

  function planTool() {
    const res = h("div.stack");
    const base = marketingIdeas(st.type);
    clear(out, h("section.card", h("div.card-body.stack",
      h("div.list", base.map(([k, t, d]) => h("div.list-item", h("div.li-main", h("div.li-title", t), h("div.li-sub", d)),
        ["qr", "card", "shirt", "social"].includes(k) ? h("button.btn.sm", { onclick: () => { st.tool = k; tools(); run(); } }, "Öffnen")
          : k === "links" || k === "notify" ? h("a.btn.sm", { href: "#/studio/web" }, "Seite bauen") : null))),
      h("button.btn.primary", { onclick: async (e) => {
        const b = e.currentTarget; b.disabled = true; res.replaceChildren(h("div.faint", h("span.spinner"), " plant …"));
        try {
          const r = await aiGen({ task: "marketing-plan", withContext: true, instructions: "Erstelle einen kompakten Marketingplan (Markdown): 1) Zielgruppe, 2) 5 konkrete Maßnahmen mit Zeitpunkt und Kosten-Schätzung (günstig zuerst), 3) Merch/Druck-Ideen (z. B. Visitenkarten mit QR, Shirts, Sticker), 4) Kooperationen, 5) Was messen. Realistisch, ohne erfundene Zahlen.",
            input: `Projekt: ${st.name || "–"} (${st.type})\nLink: ${st.url || "–"}\n${describe(list.find((x) => x.key === st.target))}` });
          res.replaceChildren(md(r.text), h("button.btn.sm", { onclick: () => copyText(r.text) }, "Kopieren"));
        } catch (er) { res.replaceChildren(h("div.banner.bad", errMsg(er))); }
        b.disabled = false;
      } }, icon("sparkles"), "KI-Marketingplan erstellen"), res)));
  }

  tools(); run();
  return h("div.stack",
    h("section.card", h("div.card-body.grid.g-2", targetSelect(list, st.target, pick), field("Link (für QR-Codes & Texte)", urlIn))),
    toolsBox, out);
}
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

// =====================================================================
// 4) Zusammenfassungen
// =====================================================================
async function summaries(ctx) {
  const list = await targets(ctx);
  let key = "all";
  const res = h("div.stack");
  const show = (s) => res.replaceChildren(h("section.card", h("div.card-body.stack", md(s.text), h("div.faint", { style: { fontSize: "12px" } }, `Erstellt ${fmtAgo(s.at)} · ${s.model || ""}`),
    h("div.row.wrap", { style: { gap: "8px" } }, h("button.btn.sm", { onclick: () => copyText(s.text) }, "Kopieren"),
      key.startsWith("np:") ? h("button.btn.sm", { onclick: async () => { const t = list.find((x) => x.key === key); try { await q(sb.from("nx_projects").update({ metadata: { ...(t.row.metadata || {}), ai_summary: { text: s.text.slice(0, 6000), at: s.at } } }).eq("id", t.row.id)); toast("Am Projekt gespeichert"); } catch (e) { toastErr(e); } } }, "Am Projekt speichern") : null))));
  const gen = async (force) => {
    const cached = LS.get(`sum:${key}`, null);
    if (!force && cached && Date.now() - Date.parse(cached.at) < 6 * 3600e3) return show(cached);
    res.replaceChildren(h("div.faint", h("span.spinner"), " fasst zusammen …"));
    try {
      let input;
      if (key === "all") {
        const [tasks, evs] = await Promise.all([q(sb.from("nx_tasks").select("title,due,done").eq("done", false).limit(40)).catch(() => []), q(sb.from("nx_events").select("name,event_date,status").neq("status", "cancelled").limit(20)).catch(() => [])]);
        input = `Alle Projekte (siehe Kontext).\nOffene Aufgaben: ${tasks.map((t) => `${t.title}${t.due ? ` (fällig ${fmtDate(t.due)})` : ""}`).join("; ") || "keine"}\nEvents: ${evs.map((e) => `${e.name} ${e.event_date ? fmtDate(e.event_date) : ""}`).join("; ") || "keine"}`;
      } else {
        const t = list.find((x) => x.key === key);
        let items = [];
        if (t?.src === "ne") items = await q(sb.from("nx_event_items").select("kind,title,done,amount").eq("event_id", t.row.id).limit(120)).catch(() => []);
        if (t?.src === "ce") items = await q(sb.from("cc_event_items").select("kind,title,done,amount").eq("event_id", t.row.id).limit(150)).catch(() => []);
        input = `${describe(t)}\n${t?.row?.metadata?.profile ? `Bogen: ${JSON.stringify(t.row.metadata.profile.answers)}` : ""}\n${items.length ? `Einträge: ${items.map((i) => `[${i.kind}${i.done ? " ✓" : ""}] ${i.title}${i.amount ? ` ${i.amount} €` : ""}`).join("; ")}` : ""}`;
      }
      const r = await aiGen({ task: "zusammenfassung", withContext: key === "all", projectId: key.startsWith("ce:") ? null : undefined,
        instructions: "Fasse zusammen (Markdown, Deutsch): **Stand in 2 Sätzen**, dann ### Erledigt, ### Offen & als Nächstes (max. 5, priorisiert), ### Risiken, ### Zahlen (nur vorhandene). Kurz, konkret, keine erfundenen Fakten.",
        input: input.slice(0, 18000) });
      const s = { text: r.text, at: new Date().toISOString(), model: r.model };
      LS.set(`sum:${key}`, s); show(s);
    } catch (e) { res.replaceChildren(h("div.banner.bad", errMsg(e))); }
  };
  return h("div.stack",
    h("section.card", h("div.card-body.stack",
      field("Was zusammenfassen?", h("select.input", { onchange: (e) => { key = e.target.value; res.replaceChildren(); } }, h("option", { value: "all" }, "Alles (Wochenüberblick)"), list.map((t) => h("option", { value: t.key }, t.label)))),
      h("div.row.wrap", { style: { gap: "8px" } }, h("button.btn.primary", { onclick: () => gen(false) }, icon("sparkles"), "Zusammenfassen"), h("button.btn", { onclick: () => gen(true) }, icon("refresh"), "Neu erstellen")),
      h("div.faint", { style: { fontSize: "12.5px" } }, "Zusammenfassungen werden 6 Stunden auf diesem Gerät gemerkt – das spart KI-Anfragen."))),
    res);
}

// =====================================================================
// 5) KI-Einstellungen
// =====================================================================
const FALLBACK_MODELS = [{ id: "auto", label: "Automatisch", note: "das schnellste verfügbare Modell", available: true }];
async function kiSettings(ctx) {
  let models = FALLBACK_MODELS, prefsOk = true, prefs = { tone: LS.get("ai:tone", "normal"), learn: LS.get("ai:learn", true) };
  try { const r = await nx("models"); models = r.models; prefs = { ...prefs, ...(r.current || {}) }; } catch { /* Route kommt mit der Freischaltung */ }
  let facts = [];
  try { facts = await q(sb.from("nx_ai_facts").select("*").order("created_at", { ascending: false })); } catch (e) { if (missing(e)) prefsOk = false; }
  const cur = aiModel();
  const uid = (await sb.auth.getSession()).data.session?.user?.id;
  const savePrefs = async (patch) => {
    Object.assign(prefs, patch);
    if (patch.tone) LS.set("ai:tone", patch.tone); if ("learn" in patch) LS.set("ai:learn", patch.learn);
    if (!prefsOk) return toast("Auf diesem Gerät gespeichert");
    try { await q(sb.from("nx_ai_prefs").upsert({ owner_id: uid, model: aiModel(), tone: prefs.tone, learn: prefs.learn, updated_at: new Date().toISOString() })); toast("Gespeichert"); } catch (e) { toastErr(e); }
  };
  const factIn = h("input.input", { placeholder: "z. B. Ich plane Partys für 16–18-Jährige in Berlin", maxlength: 300, "aria-label": "Neuer Fakt" });
  const simple = document.documentElement.classList.contains("simple");
  return h("div.grid.g-2",
    h("section.card", h("div.card-head", h("h3", "KI-Modell")), h("div.card-body.list", models.map((m) => h("label.list-item", { style: { opacity: m.available === false ? 0.5 : 1 } },
      h("input", { type: "radio", name: "aimodel", checked: cur === m.id, disabled: m.available === false, onchange: () => { LS.set("ai:model", m.id); savePrefs({}); } }),
      h("div.li-main", h("div.li-title", m.label, m.own ? h("span.badge.b-ok", { style: { marginLeft: "6px" } }, "eigener Schlüssel") : null), h("div.li-sub", m.note || "")))),
      models.length === 1 ? h("div.faint", { style: { fontSize: "12.5px", padding: "8px 0" } }, "Weitere Modelle (Gemini Flash/Pro, Llama, GPT-OSS, OpenAI) erscheinen nach der nächsten Freischaltung.") : null)),
    h("section.card", h("div.card-head", h("h3", "Antwort-Stil")), h("div.card-body.stack",
      h("div.seg", [["normal", "Normal"], ["kurz", "Kurz"], ["ausfuehrlich", "Ausführlich"], ["einfach", "Einfache Sprache"]].map(([k, t]) => h("button", { class: prefs.tone === k ? "on" : "", onclick: (e) => { e.currentTarget.parentNode.querySelectorAll("button").forEach((x) => x.classList.remove("on")); e.currentTarget.classList.add("on"); savePrefs({ tone: k }); } }, t))),
      h("label.check", h("input", { type: "checkbox", checked: prefs.learn !== false, onchange: (e) => savePrefs({ learn: e.target.checked }) }), "KI darf sich Dinge merken, die ich ihr erzähle (Vorlieben, Projekte)"),
      h("label.check", h("input", { type: "checkbox", checked: simple, onchange: (e) => { document.documentElement.classList.toggle("simple", e.target.checked); LS.set("simple", e.target.checked); } }), "Einfach-Modus (größere Schrift, weniger Details, klare Schritte)"))),
    h("section.card", { style: { gridColumn: "1 / -1" } }, h("div.card-head", h("h3", "Was die KI über dich weiß"), h("span.faint", { style: { fontSize: "12px" } }, `${facts.length} / 80`)),
      h("div.card-body.stack",
        prefsOk ? null : h("div.banner.warn", "Das persönliche KI-Gedächtnis wird mit der nächsten Freischaltung aktiv."),
        prefsOk ? h("form.row", { style: { gap: "8px" }, onsubmit: async (e) => { e.preventDefault(); const t = factIn.value.trim(); if (t.length < 3) return; try { await q(sb.from("nx_ai_facts").insert({ owner_id: uid, fact: t, source: "user" })); location.reload(); } catch (er) { toastErr(er); } } }, factIn, h("button.btn", { type: "submit" }, "Merken")) : null,
        facts.length ? h("div.list", facts.map((f) => h("div.list-item", h("div.li-main", h("div.li-title", { style: { whiteSpace: "normal" } }, f.fact), h("div.li-sub", `${f.source === "chat" ? "aus dem Chat gelernt" : f.source === "bogen" ? "aus dem Projekt-Bogen" : "von dir"} · ${fmtAgo(f.created_at)}`)),
          h("button.btn.sm.ghost", { "aria-label": "Vergessen", onclick: async (e) => { await q(sb.from("nx_ai_facts").delete().eq("id", f.id)); e.currentTarget.closest(".list-item").remove(); } }, icon("trash"))))) : prefsOk ? empty("sparkles", "Noch nichts gelernt", "Erzähl der KI im Chat von deinen Projekten – sie merkt sich Wichtiges automatisch.") : null)));
}

export default async function ({ args, user } = {}) {
  return studioPage(args?.[0] || "", { admin: true, uid: user?.id });
}
