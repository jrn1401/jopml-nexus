// Teilen – für Admin und alle Konten. Zuerst „Was teilen?“ (z. B. nur die Ticket-Live-Anzeige),
// dann „Wie teilen?“ (Link ohne Konto oder Personen per Google-E-Mail).
import { sb, q } from "./api.js";
import { h, icon, modal, toast, toastErr, copyText, fmtDate, confirmDialog, errMsg } from "./ui.js";

export const KIND_LABEL = { event: "Event", project: "Projekt", file: "Datei", nx_project: "Projekt", site: "Website", tickets: "Ticket-Live", nx_event: "Event" };
export const PERM = { view: "Nur ansehen", tasks: "Ansehen + Aufgaben abhaken", edit: "Mitarbeiten (Aufgaben, Schichten, Gäste anlegen)", door: "Abendkasse" };
export const linkUrl = (token) => `${location.origin}${location.pathname}#/s/${token}`;

export async function revokeShare(id) {
  await q(sb.from("cc_shares").update({ revoked_at: new Date().toISOString() }).eq("id", id));
}

// Welche Inhalte sich zu einem Element teilen lassen
function choicesFor(kind, opts) {
  const T = { k: "tickets", ic: "ticket", t: "Ticket-Live-Anzeige", d: "Nur verkaufte Tickets, Fortschritt und Verlauf – aktualisiert sich von selbst. Ideal für Team, DJs, Location." };
  if (kind === "event") return [T,
    { k: "event", ic: "calendar", t: "Event-Planung", d: "Aufgaben, Ablauf, Location, Technik. Optional mit Kosten und Gästeliste.", perm: true },
    { k: "event", ic: "wallet", t: "Abendkasse", d: "Einlass zählen und kassieren am Eventtag – als Link fürs Handy.", door: true }];
  if (kind === "nx_event") return [T, { k: "nx_event", ic: "calendar", t: "Event-Planung", d: "Aufgaben, Ablauf und Zeitplan. Optional mit Kosten und Gästeliste." }];
  if (kind === "nx_project" && opts.tickets) return [T, { k: "nx_project", ic: "folder", t: "Projekt", d: "Projektname, Beschreibung, Link und Ticketzahlen." }];
  const one = { project: ["folder", "Projekt", "Beschreibung, Dateien, Links, Notizen und Events des Projekts."], file: ["file", "Datei", "Nur diese eine Datei zum Herunterladen."],
    site: ["globe", "Website-Live", "Besucher, Erreichbarkeit und Aufrufe der letzten 7 Tage."], nx_project: ["folder", "Projekt", "Projektname, Beschreibung und Link."] }[kind];
  return [{ k: kind, ic: one[0], t: one[1], d: one[2] }];
}

// kind: event | project | file | site | nx_project | nx_event ; opts: { admin, tickets }
export async function openShareDialog(kind, itemId, title, opts = {}) {
  const admin = opts.admin === true || ["event", "project", "file"].includes(kind);
  const choices = choicesFor(kind, opts);
  let choice = choices[0];
  let contacts = admin ? await q(sb.from("cc_contacts").select("*").order("name")).catch(() => []) : [];
  const selected = new Set();
  const people = h("div.share-people");
  const mailIn = h("input.input", { type: "email", placeholder: "E-Mail-Adresse (Google-Konto)", maxlength: 200, "aria-label": "E-Mail-Adresse" });
  const nameIn = h("input.input", { placeholder: "Name (optional)", maxlength: 80, "aria-label": "Name" });
  const perm = h("select.input", { "aria-label": "Berechtigung" }, ["view", "tasks", "edit"].map((k) => h("option", { value: k }, PERM[k])));
  const fin = h("input", { type: "checkbox" }), guests = h("input", { type: "checkbox" });
  const finLabel = h("span", "Kosten & Einnahmen zeigen");
  const guestLabel = h("label.check", guests, "Gästeliste zeigen");
  const expiry = h("select.input", { "aria-label": "Gültigkeit" }, [["", "Läuft nicht ab"], ["1", "1 Tag"], ["7", "7 Tage"], ["30", "30 Tage"], ["90", "90 Tage"]].map(([v, t]) => h("option", { value: v }, t)));
  const existing = h("div.list");
  const options = h("div.share-choices", { role: "radiogroup", "aria-label": "Was teilen?" });
  const permRow = h("div.field", h("label", "Was dürfen andere?"), perm);
  const extras = h("div.row.wrap", { style: { gap: "16px" } }, h("label.check", fin, finLabel), guestLabel);

  const target = () => (choice.k === "tickets" ? "tickets" : kind);
  const evLike = () => ["event", "nx_event"].includes(choice.k) && !choice.door;
  const drawChoices = () => {
    options.replaceChildren(...choices.map((c) => h("button.share-choice", { type: "button", role: "radio", "aria-checked": String(c === choice), class: c === choice ? "on" : "",
      onclick: () => { choice = c; drawChoices(); drawExisting(); } }, h("div.li-icon", icon(c.ic)), h("div.li-main", h("div.li-title", c.t), h("div.li-sub", c.d)))));
    permRow.hidden = !(admin && choice.perm);
    extras.hidden = !(evLike() || choice.k === "tickets" || choice.k === "nx_project");
    guestLabel.hidden = !evLike();
    finLabel.textContent = evLike() ? "Kosten & Einnahmen zeigen" : "Umsatz zeigen";
  };
  const drawPeople = () => people.replaceChildren(...contacts.map((c) => h("label.share-person",
    h("input", { type: "checkbox", checked: selected.has(c.email.toLowerCase()), onchange: (e) => { e.target.checked ? selected.add(c.email.toLowerCase()) : selected.delete(c.email.toLowerCase()); } }),
    h("span.avatar.sm", (c.name || c.email || "?")[0].toUpperCase()), h("div", h("div.li-title", c.name || c.email), c.name ? h("div.li-sub", c.email) : null))));
  const addPerson = async () => {
    const email = mailIn.value.trim().toLowerCase(), name = nameIn.value.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("Bitte eine gültige E-Mail eingeben", "err");
    if (!contacts.some((x) => x.email.toLowerCase() === email)) {
      let c = { email, name };
      if (admin && name) { try { c = await q(sb.from("cc_contacts").insert({ name, email }).select("*").single()); } catch { /* Kontakt ist optional */ } }
      contacts = [...contacts, c];
    }
    selected.add(email); mailIn.value = ""; nameIn.value = ""; drawPeople();
  };
  async function drawExisting() {
    const rows = await q(sb.from("cc_shares").select("*").eq("item_kind", target()).eq("item_id", itemId).is("revoked_at", null).order("created_at", { ascending: false })).catch(() => []);
    const nm = (em) => contacts.find((c) => c.email?.toLowerCase() === em)?.name;
    existing.replaceChildren(...(rows.length ? rows.map((s) => h("div.list-item",
      h("div.li-icon", icon(s.share_type === "link" ? "link" : "users")),
      h("div.li-main", h("div.li-title", s.share_type === "link" ? (s.label || "Link") : `${nm(s.email) || s.email}`),
        h("div.li-sub", [s.item_kind === "tickets" ? "Ticket-Live" : PERM[s.permission], s.show_finance ? "mit Umsatz/Finanzen" : null, s.show_guests ? "mit Gästeliste" : null,
          s.expires_at ? `bis ${fmtDate(s.expires_at)}` : null, s.open_count ? `${s.open_count}× geöffnet` : "noch nicht geöffnet"].filter(Boolean).join(" · "))),
      s.share_type === "link" ? h("button.btn.sm", { onclick: () => copyText(linkUrl(s.token)) }, icon("copy"), "Kopieren") : null,
      h("button.icon-btn", { title: "Freigabe beenden", "aria-label": "Freigabe beenden", onclick: async () => {
        if (!(await confirmDialog("Freigabe beenden?", "Danach hat niemand mehr über diese Freigabe Zugriff.", { ok: "Beenden" }))) return;
        try { await revokeShare(s.id); toast("Freigabe beendet"); drawExisting(); } catch (e) { toastErr(e); }
      } }, icon("x")))) : [h("div.faint", { style: { fontSize: "13px" } }, "Hiervon gibt es noch keine Freigabe.")]));
  }
  const base = () => ({ item_kind: target(), item_id: itemId,
    permission: choice.door ? "door" : admin && choice.perm ? perm.value : "view",
    show_finance: fin.checked && !extras.hidden, show_guests: guests.checked && !guestLabel.hidden,
    expires_at: expiry.value ? new Date(Date.now() + Number(expiry.value) * 86400_000).toISOString() : null });
  const log = (txt) => { if (admin) sb.from("cc_activities").insert({ kind: "share", description: txt }).then(() => {}, () => {}); };
  const shareWithPeople = async () => {
    if (choice.door) return toast("Die Abendkasse wird als Link geteilt – „Link erstellen“ antippen", "info");
    if (mailIn.value.trim()) await addPerson();
    if (!selected.size) return toast("Mindestens eine E-Mail eingeben oder auswählen", "err");
    try {
      const have = new Set((await q(sb.from("cc_shares").select("email").eq("item_kind", target()).eq("item_id", itemId).eq("share_type", "email").is("revoked_at", null))).map((r) => r.email));
      const rows = [...selected].filter((em) => !have.has(em)).map((email) => ({ ...base(), share_type: "email", email }));
      if (rows.length) await q(sb.from("cc_shares").insert(rows));
      log(`${choice.t} „${title}“ geteilt mit ${selected.size} Person(en)`);
      toast(rows.length ? `Mit ${rows.length} Person(en) geteilt – sie melden sich mit Google an und sehen es sofort` : "War schon geteilt"); selected.clear(); drawPeople(); drawExisting();
    } catch (e) { toastErr(e); }
  };
  const createLink = async () => {
    try {
      const r = await q(sb.from("cc_shares").insert({ ...base(), share_type: "link", label: choice.door ? "Abendkasse" : choice.t }).select("token").single());
      copyText(linkUrl(r.token));
      log(`Link „${choice.t}“ für „${title}“ erstellt`);
      toast("Link erstellt und kopiert – einfach weiterschicken"); drawExisting();
    } catch (e) { toastErr(e); }
  };

  drawChoices(); drawPeople(); drawExisting().catch((e) => existing.replaceChildren(h("div.faint", errMsg(e))));
  modal(`„${title}“ teilen`, h("div.stack",
    choices.length > 1 ? h("div.field", h("label", "1. Was möchtest du teilen?"), options) : h("div.na-note", icon(choices[0].ic), h("div", h("strong", choices[0].t), " – ", choices[0].d)),
    h("div.field", h("label", choices.length > 1 ? "2. Wie teilen?" : "Wie teilen?"),
      h("div.share-ways",
        h("div.card.card-pad", h("strong", "Per Link"), h("p.faint", { style: { margin: "4px 0 10px", fontSize: "13px" } }, "Jeder mit dem Link kann es öffnen – ohne Konto."),
          h("button.btn.primary", { onclick: createLink }, icon("link"), "Link erstellen & kopieren")),
        h("div.card.card-pad", h("strong", "Mit Personen"), h("p.faint", { style: { margin: "4px 0 10px", fontSize: "13px" } }, "Nur diese Google-Konten sehen es nach der Anmeldung."),
          people, h("div.row", { style: { gap: "6px", marginTop: "6px" } }, mailIn, admin ? nameIn : null, h("button.btn", { onclick: addPerson, title: "Hinzufügen", "aria-label": "Person hinzufügen" }, icon("plus"))),
          h("button.btn", { style: { marginTop: "8px" }, onclick: shareWithPeople }, icon("users"), "Mit Personen teilen")))),
    h("details", h("summary.faint", { style: { cursor: "pointer" } }, "Optionen: Rechte, Ablauf, Finanzen"),
      h("div.stack", { style: { marginTop: "10px" } }, h("div.two", permRow, h("div.field", h("label", "Gültig"), expiry)), extras)),
    h("div.field", h("label", "Bereits geteilt"), existing)), { wide: true });
}
