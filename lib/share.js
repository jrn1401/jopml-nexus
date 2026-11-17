// Teilen – für Admin und alle Konten.
// 1) WAS: fertige Vorlagen (z. B. „Tickets & Einnahmen“) oder eigene Bereiche – auf Wunsch von der KI zusammengestellt.
// 2) WIE: Link (ohne Konto) oder bestimmte Google-Konten.
// Freigaben lassen sich später ändern (Bereiche, Nachricht, Ablauf, „nur noch für …“), ohne dass sich der Link ändert,
// und zeigen, wie oft und von wem sie geöffnet wurden.
import { sb, q, rpc, nx } from "./api.js";
import { h, icon, modal, toast, toastErr, copyText, fmtDate, fmtAgo, confirmDialog, errMsg } from "./ui.js";

export const KIND_LABEL = { event: "Event", project: "Projekt", file: "Datei", nx_project: "Projekt", site: "Website", tickets: "Ticket-Live", nx_event: "Event" };
export const PERM = { view: "Nur ansehen", tasks: "Ansehen + Aufgaben abhaken", edit: "Mitarbeiten (Aufgaben, Schichten, Gäste anlegen)", door: "Abendkasse" };
export const linkUrl = (token) => `${location.origin}${location.pathname}#/s/${token}`;

const SECTIONS = {
  event: [["tickets", "Ticketzahlen"], ["revenue", "Ticket-Einnahmen"], ["finance", "Budget: Einnahmen, Kosten, Ergebnis"], ["costs", "Kostenliste"], ["income", "Einnahmenliste"],
    ["tasks", "Aufgaben"], ["schedule", "Ablauf"], ["shifts", "Schichten"], ["location", "Location"], ["tech", "Technik"], ["guests", "Gästeliste"], ["description", "Beschreibung"], ["calc", "Kalkulation & Ticket-Prognose"], ["details", "Steckbrief (Zeiten, Line-up, Notfall, Links, Regeln)"]],
  project: [["description", "Beschreibung"], ["files", "Dateien"], ["links", "Links"], ["notes", "Notizen"], ["web", "Website-Zahlen"]],
};
const FIN = ["revenue", "finance", "costs", "income", "calc"];
const secKind = (kind) => (["event", "nx_event"].includes(kind) ? "event" : kind === "project" ? "project" : null);
export const sectionNames = (kind, sec) => (sec?.length ? sec.map((k) => (SECTIONS[secKind(kind)] || []).find(([x]) => x === k)?.[1] || k).join(", ") : null);

// Teilbare Bereiche eines Elements – bei Projekten inklusive jeder einzelnen Kachel (Kennzahlen, Diagramme, Listen …)
const WTITLE = { markdown: "Text", stats: "Kennzahlen", chart: "Diagramm", progress: "Fortschritt", table: "Tabelle", timeline: "Termine", links: "Links", checklist: "Checkliste" };
const STATIC_W = Object.keys(WTITLE);
const wLabel = (w, i) => `${w.title || WTITLE[w.type] || "Kachel"}${w.title ? "" : ` ${i + 1}`}`;
async function loadParts(kind, itemId) {
  const base = SECTIONS[secKind(kind)] ? [...SECTIONS[secKind(kind)]] : [];
  let info = "";
  try {
    if (kind === "project") {
      const mods = await q(sb.from("cc_modules").select("name,config,position,created_at,module_type,enabled").eq("project_id", itemId).eq("module_type", "dashboard").eq("enabled", true).order("position").order("created_at"));
      mods.forEach((m, mi) => (m.config?.widgets || []).forEach((w, wi) => { if (STATIC_W.includes(w.type)) base.push([`m${mi}w${wi}`, `${m.name}: ${wLabel(w, wi)}`, w]); }));
    } else if (kind === "nx_project") {
      const p = await q(sb.from("nx_projects").select("name,description,kind,metadata").eq("id", itemId).maybeSingle());
      info = p ? `${p.name} (${p.kind}): ${p.description || ""}` : "";
      (p?.metadata?.widgets || []).forEach((w, wi) => { if (STATIC_W.includes(w.type)) base.push([`w${wi}`, wLabel(w, wi), w]); });
      if (base.length) base.unshift(["description", "Beschreibung"]);
    }
  } catch { /* ohne Kacheln weiter */ }
  return { list: base, info };
}
// Kurzbeschreibung einer Kachel für die KI (ohne lange Inhalte)
const brief = (w) => !w ? "" : w.type === "stats" ? (w.items || []).map((x) => x.label).join(", ") : w.type === "chart" ? (w.series || []).map((x) => x.name).join(", ") || w.title || ""
  : w.type === "table" ? (w.columns || []).join(", ") : w.type === "checklist" ? `${(w.items || []).length} Punkte` : w.type === "timeline" ? `${(w.items || []).length} Termine` : String(w.content || "").slice(0, 80);

export async function revokeShare(id) {
  await q(sb.from("cc_shares").update({ revoked_at: new Date().toISOString() }).eq("id", id));
}

function presetsFor(kind, opts) {
  if (kind === "event" || kind === "nx_event") return [
    { t: "Tickets live", ic: "ticket", d: "Nur verkaufte Tickets, Fortschritt und Verlauf. Aktualisiert sich von selbst.", s: ["tickets"] },
    { t: "Alles zeigen", ic: "eye", d: "Wirklich alles zum Ansehen: Tickets, Kalkulation mit Prognose und Szenarien, Kosten, Einnahmen, Aufgaben, Ablauf, Gäste, Steckbrief.", s: SECTIONS.event.map(([k]) => k) },
    { t: "Tickets & Einnahmen", ic: "wallet", d: "Ticketzahlen plus Ticket-Einnahmen, Kosten und Ergebnis – z. B. für Mitveranstalter.", s: ["tickets", "revenue", "finance", "calc"] },
    { t: "Helfer-Ansicht", ic: "users", d: "Aufgaben, Ablauf, Schichten und Location – ohne Geld.", s: ["tasks", "schedule", "shifts", "location"] },
    { t: "Eigene Auswahl", ic: "settings", d: "Selbst wählen oder die KI zusammenstellen lassen.", custom: true },
    ...(kind === "event" ? [{ t: "Komplette Planung", ic: "calendar", d: "Alles, mit Rechten zum Mitarbeiten (Aufgaben abhaken, Schichten, Gäste).", s: null, perm: true },
      { t: "Abendkasse", ic: "wallet", d: "Einlass zählen und kassieren am Eventtag – als Link fürs Handy.", s: null, door: true }] : []),
  ];
  if (kind === "nx_project" && opts.tickets) return [
    { t: "Tickets live", ic: "ticket", d: "Nur Ticketzahlen, aktualisiert sich von selbst.", k: "tickets", fin: false },
    { t: "Tickets & Umsatz", ic: "wallet", d: "Ticketzahlen und Umsatz.", k: "tickets", fin: true },
    { t: "Projekt", ic: "folder", d: "Name, Beschreibung, Link und Ticketzahlen.", k: "nx_project" }];
  if (kind === "project") return [
    { t: "Ganzes Projekt", ic: "folder", d: "Beschreibung, Dateien, Links, Notizen, Events und Website-Zahlen.", s: null },
    { t: "Eigene Auswahl", ic: "settings", d: "Nur bestimmte Bereiche – selbst wählen oder per KI.", custom: true }];
  const one = { file: ["file", "Datei", "Nur diese eine Datei zum Herunterladen."], site: ["globe", "Website-Live", "Besucher, Erreichbarkeit und Aufrufe der letzten 7 Tage."],
    nx_project: ["folder", "Projekt", "Projektname, Beschreibung und Link."] }[kind];
  return [{ t: one[1], ic: one[0], d: one[2], s: null }];
}

// Bereiche als antippbare Chips + „KI wählt aus“
function sectionPicker(kind, initial, onChange, parts) {
  const list = parts || SECTIONS[secKind(kind)];
  if (!list?.length) return null;
  const sel = new Set(initial || []);
  const chips = h("div.row.wrap", { style: { gap: "6px" } });
  const draw = () => chips.replaceChildren(...list.map(([k, t]) => h("button.chip", { type: "button", class: sel.has(k) ? "on" : "", "aria-pressed": String(sel.has(k)),
    onclick: () => { sel.has(k) ? sel.delete(k) : sel.add(k); draw(); onChange([...sel]); } }, sel.has(k) ? "✓ " : "", t)));
  const aiIn = h("input.input", { placeholder: "z. B. „Für meinen DJ: Ablauf und Ticketzahlen, kein Geld“", "aria-label": "Für wen und was? (KI)", maxlength: 300 });
  const aiBtn = h("button.btn", { type: "button" }, icon("bot"), "KI wählt aus");
  const aiOut = h("div.faint", { style: { fontSize: "12.5px" }, "aria-live": "polite" });
  aiBtn.onclick = async () => {
    const want = aiIn.value.trim(); if (!want) return toast("Kurz beschreiben, wer es bekommt und was die Person sehen soll", "err");
    aiBtn.disabled = true; aiOut.textContent = "Die KI stellt zusammen …";
    try {
      const r = await nx("ai", { history: [], question: `Ich teile ${secKind(kind) === "event" ? "ein Event" : "ein Projekt"}. Wunsch: „${want}“.
Verfügbare Bereiche (Schlüssel: Bedeutung): ${list.map(([k, t, w]) => `${k}: ${t}${w ? ` [${brief(w)}]` : ""}`).join("; ")}.
Wähle nur, was zum Wunsch passt; Geld (revenue, finance, costs, income) nur, wenn ausdrücklich gewünscht oder klar sinnvoll. Gästeliste nur, wenn gewünscht.
Antworte NUR mit JSON: {"sections":["…"],"label":"kurzer Name der Freigabe","note":"1 Satz an den Empfänger oder leer","why":"1 kurzer Satz"}` });
      const m = String(r.answer || "").match(/\{[\s\S]*\}/);
      const a = m ? JSON.parse(m[0]) : null;
      const keys = (a?.sections || []).filter((k) => list.some(([x]) => x === k));
      if (!keys.length) throw new Error("Die KI hat nichts Passendes gefunden – bitte anders beschreiben.");
      sel.clear(); keys.forEach((k) => sel.add(k)); draw(); onChange([...sel], a);
      aiOut.textContent = a.why ? `KI: ${a.why}` : "";
    } catch (e) { aiOut.textContent = ""; toastErr(e); } finally { aiBtn.disabled = false; }
  };
  draw();
  return h("div.stack", { style: { gap: "8px" } }, chips, h("div.row", { style: { gap: "6px" } }, aiIn, aiBtn), aiOut);
}

// Aufrufe einer Freigabe
async function statsDialog(s) {
  let st; try { st = await rpc("cc_share_stats", { p_share: s.id }); } catch (e) { return toastErr(e); }
  const max = Math.max(1, ...st.days.map((d) => d.n));
  modal(`Aufrufe: ${s.label || "Freigabe"}`, h("div.stack",
    h("div.grid.g-2", h("div.card.card-pad", h("div.faint", "Aufrufe gesamt"), h("div", { style: { fontSize: "28px", fontWeight: 700 } }, String(st.total || 0))),
      h("div.card.card-pad", h("div.faint", "Zuletzt geöffnet"), h("div", { style: { fontSize: "16px", fontWeight: 600, marginTop: "6px" } }, st.last ? fmtAgo(st.last) : "noch nie"))),
    st.days.length ? h("div", h("div.faint", { style: { marginBottom: "6px" } }, "Letzte 30 Tage"),
      h("div.row", { style: { alignItems: "flex-end", gap: "4px", height: "90px" }, role: "img", "aria-label": st.days.map((d) => `${d.d}: ${d.n}`).join(", ") },
        st.days.map((d) => h("div", { title: `${new Date(d.d).toLocaleDateString("de-DE")}: ${d.n}`, style: { flex: 1, height: `${Math.max(4, (d.n / max) * 86)}px`, background: "var(--primary)", borderRadius: "4px 4px 1px 1px" } })))) : null,
    h("div", h("div.faint", { style: { marginBottom: "6px" } }, "Wer hat geöffnet?"),
      st.people.length ? h("div.list", st.people.map((p) => h("div.list-item", h("div.li-main", h("div.li-title", p.email), h("div.li-sub", `${p.n}× · zuletzt ${fmtAgo(p.last)}`))))) : null,
      h("div.li-sub", st.anonymous ? `${st.anonymous}× ohne Anmeldung geöffnet (anonym)` : st.people.length ? "" : "Noch keine Aufrufe seit Beginn der Zählung."))));
}

// Bestehende Freigabe ändern – der Link bleibt gleich
function editDialog(s, kind, done, parts) {
  let sections = s.sections || null;
  const label = h("input.input", { value: s.label || "", maxlength: 80, "aria-label": "Name der Freigabe" });
  const note = h("textarea.input", { rows: 2, maxlength: 1500, "aria-label": "Nachricht an die Empfänger", placeholder: "Optional: kurze Nachricht, die oben angezeigt wird" }, s.note || "");
  const expiry = h("select.input", { "aria-label": "Gültigkeit" }, [["keep", s.expires_at ? `Bis ${fmtDate(s.expires_at)} (unverändert)` : "Läuft nicht ab (unverändert)"], ["none", "Läuft nicht ab"], ["1", "Noch 1 Tag"], ["7", "Noch 7 Tage"], ["30", "Noch 30 Tage"]].map(([v, t]) => h("option", { value: v }, t)));
  const restricted = !!s.allowed_emails?.length;
  const mode = h("select.input", { "aria-label": "Wer darf öffnen?" }, [["all", "Jeder mit dem Link"], ["some", "Nur bestimmte Personen (Google-Anmeldung)"]].map(([v, t]) => h("option", { value: v, selected: (v === "some") === restricted }, t)));
  const emails = h("textarea.input", { rows: 2, "aria-label": "E-Mail-Adressen", placeholder: "E-Mails, durch Komma oder Zeile getrennt" }, (s.allowed_emails || []).join(", "));
  const emailBox = h("div.field", h("label", "Nur diese Personen"), emails, h("div.hint", "Andere sehen „Nur für bestimmte Personen“ und müssen sich mit einer dieser Google-Adressen anmelden."));
  const syncMode = () => { emailBox.hidden = mode.value !== "some"; };
  mode.onchange = syncMode; syncMode();
  const picker = s.permission !== "door" ? sectionPicker(kind, sections, (sec, ai) => { sections = sec; if (ai?.label && !label.value) label.value = ai.label.slice(0, 80); if (ai?.note && !note.value) note.value = ai.note.slice(0, 1500); }, parts) : null;
  const save = async (btn) => {
    const list = emails.value.split(/[\s,;]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (mode.value === "some" && !list.length) return toast("Mindestens eine E-Mail eintragen", "err");
    if (list.some((x) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x))) return toast("Bitte nur gültige E-Mail-Adressen", "err");
    const row = { label: label.value.trim() || null, note: note.value.trim() || null };
    if (picker) { row.sections = sections?.length ? sections : null; if (sections?.length) { row.show_finance = sections.some((k) => FIN.includes(k)); row.show_guests = sections.includes("guests"); } }
    if (s.share_type === "link") row.allowed_emails = mode.value === "some" ? list : null;
    if (expiry.value === "none") row.expires_at = null;
    else if (expiry.value !== "keep") row.expires_at = new Date(Date.now() + Number(expiry.value) * 864e5).toISOString();
    btn.disabled = true;
    try { await q(sb.from("cc_shares").update(row).eq("id", s.id)); toast("Gespeichert – der Link bleibt gleich"); m.close(); done(); } catch (e) { toastErr(e); btn.disabled = false; }
  };
  const m = modal("Freigabe ändern", h("div.stack",
    h("div.field", h("label", "Name"), label),
    picker ? h("div.field", h("label", "Was ist sichtbar?"), picker, h("div.hint", "Keine Auswahl = alles wie bisher.")) : null,
    h("div.field", h("label", "Nachricht"), note),
    s.share_type === "link" ? h("div.field", h("label", "Wer darf öffnen?"), mode) : null,
    s.share_type === "link" ? emailBox : null,
    h("div.field", h("label", "Gültig"), expiry),
    h("div.row", { style: { justifyContent: "flex-end", gap: "8px" } }, h("button.btn.ghost", { onclick: () => m.close() }, "Abbrechen"),
      h("button.btn.primary", { onclick: (e) => save(e.currentTarget) }, icon("check"), "Speichern"))), { wide: true });
}

// kind: event | project | file | site | nx_project | nx_event ; opts: { admin, tickets }
export async function openShareDialog(kind, itemId, title, opts = {}) {
  const admin = opts.admin === true || ["event", "project", "file"].includes(kind);
  const { list: parts, info } = await loadParts(kind, itemId);
  const partNames = (sec) => (sec?.length ? sec.map((k) => parts.find(([x]) => x === k)?.[1] || sectionNames(kind, [k])).join(", ") : null);
  const presets = presetsFor(kind, opts);
  if (kind === "nx_project" && parts.length) {
    if (!opts.tickets) presets.splice(0, presets.length, { t: "Ganzes Projekt", ic: "folder", d: "Alles, was im Projekt zu sehen ist.", s: null });
    presets.push({ t: "Eigene Auswahl", ic: "settings", d: "Nur bestimmte Kacheln und Bereiche – selbst wählen oder per KI.", custom: true });
  }
  let preset = presets[0], custom = [];
  let contacts = admin ? await q(sb.from("cc_contacts").select("*").order("name")).catch(() => []) : [];
  const selected = new Set();
  const people = h("div.share-people");
  const mailIn = h("input.input", { type: "email", placeholder: "E-Mail-Adresse (Google-Konto)", maxlength: 200, "aria-label": "E-Mail-Adresse" });
  const perm = h("select.input", { "aria-label": "Berechtigung" }, ["view", "tasks", "edit"].map((k) => h("option", { value: k }, PERM[k])));
  const permRow = h("div.field", h("label", "Was dürfen andere?"), perm);
  const note = h("textarea.input", { rows: 2, maxlength: 1500, "aria-label": "Nachricht", placeholder: "Optional: Nachricht an die Empfänger" });
  const expiry = h("select.input", { "aria-label": "Gültigkeit" }, [["", "Läuft nicht ab"], ["1", "1 Tag"], ["7", "7 Tage"], ["30", "30 Tage"], ["90", "90 Tage"]].map(([v, t]) => h("option", { value: v }, t)));
  const existing = h("div.list");
  const options = h("div.share-choices", { role: "radiogroup", "aria-label": "Was teilen?" });
  const customBox = h("div");
  const target = () => preset.k || kind;
  const sectionsNow = () => (preset.custom ? (custom.length ? custom : null) : preset.s || null);

  const drawPresets = () => {
    options.replaceChildren(...presets.map((p) => h("button.share-choice", { type: "button", role: "radio", "aria-checked": String(p === preset), class: p === preset ? "on" : "",
      onclick: () => { preset = p; drawPresets(); drawExisting(); } }, h("div.li-icon", icon(p.ic)), h("div.li-main", h("div.li-title", p.t), h("div.li-sub", p.d)))));
    permRow.hidden = !(admin && preset.perm);
    customBox.replaceChildren(preset.custom ? sectionPicker(kind, custom, (sec, ai) => { custom = sec; if (ai?.note && !note.value) note.value = ai.note; }, parts) : "");
  };
  const drawPeople = () => people.replaceChildren(...contacts.map((c) => h("label.share-person",
    h("input", { type: "checkbox", checked: selected.has(c.email.toLowerCase()), onchange: (e) => { e.target.checked ? selected.add(c.email.toLowerCase()) : selected.delete(c.email.toLowerCase()); } }),
    h("span.avatar.sm", (c.name || c.email || "?")[0].toUpperCase()), h("div", h("div.li-title", c.name || c.email), c.name ? h("div.li-sub", c.email) : null))));
  const addPerson = () => {
    const email = mailIn.value.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("Bitte eine gültige E-Mail eingeben", "err");
    if (!contacts.some((x) => x.email.toLowerCase() === email)) contacts = [...contacts, { email, name: "" }];
    selected.add(email); mailIn.value = ""; drawPeople();
  };
  async function drawExisting() {
    const rows = await q(sb.from("cc_shares").select("*").eq("item_kind", target()).eq("item_id", itemId).is("revoked_at", null).order("created_at", { ascending: false })).catch(() => []);
    existing.replaceChildren(...(rows.length ? rows.map((s) => h("div.list-item.share-row",
      h("div.li-icon", icon(s.share_type === "link" ? (s.allowed_emails?.length ? "lock" : "link") : "users")),
      h("div.li-main", h("div.li-title", s.share_type === "link" ? (s.label || "Link") : s.email),
        h("div.li-sub", [partNames(s.sections) || (s.item_kind === "tickets" ? (s.show_finance ? "Tickets & Umsatz" : "Tickets live") : PERM[s.permission]),
          s.allowed_emails?.length ? `nur für ${s.allowed_emails.length} Person(en)` : null, s.expires_at ? `bis ${fmtDate(s.expires_at)}` : null,
          `${s.open_count || 0}× geöffnet`].filter(Boolean).join(" · "))),
      h("div.row", { style: { gap: "4px" } },
        s.share_type === "link" ? h("button.btn.sm", { onclick: () => copyText(linkUrl(s.token)), title: "Link kopieren" }, icon("copy"), "Kopieren") : null,
        h("button.icon-btn", { title: "Aufrufe", "aria-label": "Aufrufe ansehen", onclick: () => statsDialog(s) }, icon("activity")),
        h("button.icon-btn", { title: "Ändern", "aria-label": "Freigabe ändern", onclick: () => editDialog(s, target(), drawExisting, target() === kind ? parts : null) }, icon("edit")),
        h("button.icon-btn", { title: "Freigabe beenden", "aria-label": "Freigabe beenden", onclick: async () => {
          if (!(await confirmDialog("Freigabe beenden?", "Danach hat niemand mehr über diese Freigabe Zugriff.", { ok: "Beenden" }))) return;
          try { await revokeShare(s.id); toast("Freigabe beendet"); drawExisting(); } catch (e) { toastErr(e); }
        } }, icon("x"))))) : [h("div.faint", { style: { fontSize: "13px" } }, "Hiervon gibt es noch keine Freigabe.")]));
  }
  const base = () => {
    const sec = sectionsNow();
    return { item_kind: target(), item_id: itemId, sections: sec, note: note.value.trim() || null,
      permission: preset.door ? "door" : admin && preset.perm ? perm.value : "view",
      show_finance: preset.k === "tickets" ? !!preset.fin : sec ? sec.some((k) => FIN.includes(k)) : !!preset.perm,
      show_guests: sec ? sec.includes("guests") : !!preset.perm,
      expires_at: expiry.value ? new Date(Date.now() + Number(expiry.value) * 86400_000).toISOString() : null };
  };
  const log = (txt) => { if (admin) sb.from("cc_activities").insert({ kind: "share", description: txt }).then(() => {}, () => {}); };
  const shareWithPeople = async () => {
    if (preset.door) return toast("Die Abendkasse wird als Link geteilt", "info");
    if (preset.custom && !custom.length) return toast("Bitte Bereiche wählen oder die KI fragen", "err");
    if (mailIn.value.trim()) addPerson();
    if (!selected.size) return toast("Mindestens eine E-Mail eingeben oder auswählen", "err");
    try {
      const have = new Set((await q(sb.from("cc_shares").select("email").eq("item_kind", target()).eq("item_id", itemId).eq("share_type", "email").is("revoked_at", null))).map((r) => r.email));
      const rows = [...selected].filter((em) => !have.has(em)).map((email) => ({ ...base(), share_type: "email", email, label: preset.t }));
      if (rows.length) await q(sb.from("cc_shares").insert(rows));
      log(`${preset.t} „${title}“ geteilt mit ${selected.size} Person(en)`);
      toast(rows.length ? `Mit ${rows.length} Person(en) geteilt – sie melden sich mit Google an und sehen es sofort` : "War schon geteilt"); selected.clear(); drawPeople(); drawExisting();
    } catch (e) { toastErr(e); }
  };
  const createLink = async () => {
    if (preset.custom && !custom.length) return toast("Bitte Bereiche wählen oder die KI fragen", "err");
    try {
      const r = await q(sb.from("cc_shares").insert({ ...base(), share_type: "link", label: preset.door ? "Abendkasse" : preset.t }).select("token").single());
      copyText(linkUrl(r.token));
      log(`Link „${preset.t}“ für „${title}“ erstellt`);
      toast("Link erstellt und kopiert – später jederzeit änderbar, der Link bleibt gleich"); drawExisting();
    } catch (e) { toastErr(e); }
  };

  // KI analysiert das Projekt und schlägt sinnvolle Freigaben vor (z. B. „Für Kunden: nur Umsatz-Kennzahlen“)
  const aiBtn = h("button.btn.sm", { type: "button" }, icon("sparkles"), "KI-Vorschläge");
  const aiOut = h("div.faint", { style: { fontSize: "12.5px" }, "aria-live": "polite" });
  aiBtn.onclick = async () => {
    const list = parts.length ? parts : SECTIONS[secKind(kind)] || [];
    if (!list.length) return toast("Hier gibt es nur eine Möglichkeit zu teilen.", "info");
    aiBtn.disabled = true; aiOut.textContent = "Die KI schaut sich das Projekt an …";
    try {
      const r = await nx("ai", { history: [], question: `Ich will „${title}“ teilen. ${info ? `Infos: ${info.slice(0, 400)}. ` : ""}Art: ${KIND_LABEL[kind]}.
Teilbare Bereiche (Schlüssel: Name [Inhalt]): ${list.map(([k, t, w]) => `${k}: ${t}${w ? ` [${brief(w)}]` : ""}`).join("; ")}.
Schlage 2 bis 3 sinnvolle, unterschiedliche Freigaben für typische Empfänger vor (z. B. Team, Kunde, Lehrer, Partner, Öffentlichkeit). Vertrauliches (Geld, Gäste, Namen) nur, wo es für den Empfänger nötig ist.
Antworte NUR mit JSON: {"suggestions":[{"title":"Für …","why":"1 kurzer Satz","sections":["…"]}]}` });
      const m = String(r.answer || "").match(/\{[\s\S]*\}/);
      const sug = (m ? JSON.parse(m[0]).suggestions : []).map((x) => ({ ...x, sections: (x.sections || []).filter((k) => list.some(([y]) => y === k)) })).filter((x) => x.sections.length).slice(0, 3);
      if (!sug.length) throw new Error("Keine sinnvollen Vorschläge gefunden.");
      presets.splice(0, 0, ...sug.map((x) => ({ t: String(x.title).slice(0, 60), ic: "sparkles", d: `${x.why || ""} · ${partNames(x.sections)}`.replace(/^ · /, ""), s: x.sections, ai: true })));
      preset = presets[0]; drawPresets(); drawExisting(); aiOut.textContent = "Vorschläge oben eingefügt – antippen zum Auswählen.";
    } catch (e) { aiOut.textContent = ""; toastErr(e); } finally { aiBtn.disabled = false; }
  };

  drawPresets(); drawPeople(); drawExisting().catch((e) => existing.replaceChildren(h("div.faint", errMsg(e))));
  modal(`„${title}“ teilen`, h("div.stack",
    presets.length > 1 || parts.length ? h("div.field", h("div.row.between", h("label", "1. Was möchtest du teilen?"), aiBtn), aiOut, options, customBox) : h("div.na-note", icon(presets[0].ic), h("div", h("strong", presets[0].t), " – ", presets[0].d)),
    h("div.field", h("label", presets.length > 1 ? "2. Wie teilen?" : "Wie teilen?"),
      h("div.share-ways",
        h("div.card.card-pad", h("strong", "Per Link"), h("p.faint", { style: { margin: "4px 0 10px", fontSize: "13px" } }, "Jeder mit dem Link – später auf bestimmte Personen beschränkbar."),
          h("button.btn.primary", { onclick: createLink }, icon("link"), "Link erstellen & kopieren")),
        h("div.card.card-pad", h("strong", "Mit Personen"), h("p.faint", { style: { margin: "4px 0 10px", fontSize: "13px" } }, "Nur diese Google-Konten sehen es nach der Anmeldung."),
          people, h("div.row", { style: { gap: "6px", marginTop: "6px" } }, mailIn, h("button.btn", { onclick: addPerson, title: "Hinzufügen", "aria-label": "Person hinzufügen" }, icon("plus"))),
          h("button.btn", { style: { marginTop: "8px" }, onclick: shareWithPeople }, icon("users"), "Mit Personen teilen")))),
    h("details", h("summary.faint", { style: { cursor: "pointer" } }, "Optionen: Nachricht, Ablauf, Rechte"),
      h("div.stack", { style: { marginTop: "10px" } }, h("div.field", h("label", "Nachricht"), note), h("div.two", permRow, h("div.field", h("label", "Gültig"), expiry)))),
    h("div.field", h("label", "Bereits geteilt – ändern, Aufrufe ansehen, beenden"), existing)), { wide: true });
}
