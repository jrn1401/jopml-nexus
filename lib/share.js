// Teilen: Personen (per E-Mail, Anmeldung mit Google) oder Gäste-Link (ohne Konto) – nur Admin.
import { sb, q } from "./api.js";
import { h, icon, modal, toast, toastErr, copyText, fmtAgo, fmtDate, confirmDialog, errMsg } from "./ui.js";

export const KIND_LABEL = { event: "Event", project: "Projekt", file: "Datei" };
export const PERM = { view: "Nur ansehen", tasks: "Ansehen + Aufgaben abhaken" };
export const linkUrl = (token) => `${location.origin}${location.pathname}#/s/${token}`;

export async function revokeShare(id) {
  await q(sb.from("cc_shares").update({ revoked_at: new Date().toISOString() }).eq("id", id));
}

export async function openShareDialog(kind, itemId, title) {
  let contacts = await q(sb.from("cc_contacts").select("*").order("name"));
  const selected = new Set();
  const list = h("div.share-people");
  const newName = h("input.input", { placeholder: "Name", maxlength: 80 });
  const newMail = h("input.input", { type: "email", placeholder: "E-Mail (Google-Konto)", maxlength: 200 });
  const perm = h("select.input", Object.entries(PERM).map(([k, t]) => h("option", { value: k }, t)));
  if (kind !== "event") perm.disabled = true;
  const fin = h("input", { type: "checkbox" }), guests = h("input", { type: "checkbox" });
  const expiry = h("select.input", [["", "Läuft nicht ab"], ["1", "1 Tag"], ["7", "7 Tage"], ["30", "30 Tage"], ["90", "90 Tage"]].map(([v, t]) => h("option", { value: v }, t)));
  const existing = h("div.list");

  const drawPeople = () => list.replaceChildren(...(contacts.length ? contacts.map((c) => h("label.share-person",
    h("input", { type: "checkbox", checked: selected.has(c.email.toLowerCase()), onchange: (e) => { e.target.checked ? selected.add(c.email.toLowerCase()) : selected.delete(c.email.toLowerCase()); } }),
    h("span.avatar.sm", (c.name || "?")[0].toUpperCase()), h("div", h("div.li-title", c.name), h("div.li-sub", c.email))))
    : [h("div.faint", { style: { fontSize: "13px" } }, "Noch keine Kontakte – unten jemanden hinzufügen.")]));
  const addContact = async () => {
    const name = newName.value.trim(), email = newMail.value.trim().toLowerCase();
    if (!name || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return toast("Name und gültige E-Mail eingeben", "err");
    try {
      const c = contacts.find((x) => x.email.toLowerCase() === email) || await q(sb.from("cc_contacts").insert({ name, email }).select("*").single());
      if (!contacts.includes(c)) contacts = [...contacts, c].sort((a, b) => a.name.localeCompare(b.name));
      selected.add(email); newName.value = ""; newMail.value = ""; drawPeople();
    } catch (e) { toastErr(e); }
  };
  async function drawExisting() {
    const rows = await q(sb.from("cc_shares").select("*").eq("item_kind", kind).eq("item_id", itemId).is("revoked_at", null).order("created_at", { ascending: false }));
    const name = (em) => contacts.find((c) => c.email.toLowerCase() === em)?.name;
    existing.replaceChildren(...(rows.length ? rows.map((s) => h("div.list-item",
      h("div.li-icon", icon(s.share_type === "link" ? "link" : "users")),
      h("div.li-main", h("div.li-title", s.share_type === "link" ? (s.label || "Gäste-Link") : `${name(s.email) || s.email}`),
        h("div.li-sub", [PERM[s.permission], s.show_finance ? "mit Finanzen" : null, s.show_guests ? "mit Gästeliste" : null,
          s.expires_at ? `bis ${fmtDate(s.expires_at)}` : null, s.open_count ? `${s.open_count}× geöffnet` : "noch nicht geöffnet"].filter(Boolean).join(" · "))),
      s.share_type === "link" ? h("button.btn.sm", { onclick: () => copyText(linkUrl(s.token)) }, icon("copy"), "Link") : null,
      h("button.icon-btn", { title: "Freigabe beenden", "aria-label": "Freigabe beenden", onclick: async () => {
        if (!(await confirmDialog("Freigabe beenden?", "Die Person bzw. der Link hat danach keinen Zugriff mehr.", { ok: "Beenden" }))) return;
        try { await revokeShare(s.id); toast("Freigabe beendet"); drawExisting(); } catch (e) { toastErr(e); }
      } }, icon("x")))) : [h("div.faint", { style: { fontSize: "13px" } }, "Noch nicht geteilt.")]));
  }
  const base = () => ({ item_kind: kind, item_id: itemId, permission: kind === "event" ? perm.value : "view", show_finance: fin.checked, show_guests: guests.checked,
    expires_at: expiry.value ? new Date(Date.now() + Number(expiry.value) * 86400_000).toISOString() : null });
  const shareWithPeople = async () => {
    if (!selected.size) return toast("Mindestens eine Person auswählen", "err");
    try {
      const existingRows = await q(sb.from("cc_shares").select("email").eq("item_kind", kind).eq("item_id", itemId).eq("share_type", "email").is("revoked_at", null));
      const have = new Set(existingRows.map((r) => r.email));
      const rows = [...selected].filter((em) => !have.has(em)).map((email) => ({ ...base(), share_type: "email", email }));
      if (rows.length) await q(sb.from("cc_shares").insert(rows));
      await sb.from("cc_activities").insert({ kind: "share", description: `${KIND_LABEL[kind]} „${title}“ geteilt mit ${selected.size} Person(en)` });
      toast(rows.length ? `Mit ${rows.length} Person(en) geteilt` : "War schon geteilt"); selected.clear(); drawPeople(); drawExisting();
    } catch (e) { toastErr(e); }
  };
  const createLink = async () => {
    try {
      const r = await q(sb.from("cc_shares").insert({ ...base(), share_type: "link", label: "Gäste-Link" }).select("token").single());
      copyText(linkUrl(r.token));
      await sb.from("cc_activities").insert({ kind: "share", description: `Gäste-Link für ${KIND_LABEL[kind]} „${title}“ erstellt` });
      toast("Gäste-Link erstellt und kopiert"); drawExisting();
    } catch (e) { toastErr(e); }
  };

  drawPeople(); drawExisting().catch((e) => existing.replaceChildren(h("div.faint", errMsg(e))));
  modal(`„${title}“ teilen`, h("div.stack",
    h("div.field", h("label", "Personen auswählen"), list,
      h("div.row", { style: { gap: "6px", marginTop: "8px" } }, newName, newMail, h("button.btn", { onclick: addContact, title: "Kontakt hinzufügen" }, icon("plus")))),
    h("div.two", h("div.field", h("label", "Berechtigung"), perm), h("div.field", h("label", "Gültig"), expiry)),
    kind === "event" ? h("div.row.wrap", { style: { gap: "16px" } }, h("label.check", fin, "Kosten & Einnahmen zeigen"), h("label.check", guests, "Gästeliste zeigen")) : null,
    h("div.row.wrap", { style: { gap: "8px" } },
      h("button.btn.primary", { onclick: shareWithPeople }, icon("users"), "Mit Auswahl teilen"),
      h("button.btn", { onclick: createLink }, icon("link"), "Gäste-Link erstellen")),
    h("div.na-note", icon("lock"), h("div", "Personen melden sich auf dieser Seite mit dem Google-Konto ihrer E-Mail an („Mit Google anmelden“) und sehen nur das Geteilte. Gäste-Links funktionieren ohne Konto für jeden, der den Link hat. Ohne Häkchen bleiben Kosten, Einnahmen und Gästeliste verborgen.")),
    h("div.field", h("label", "Aktuell geteilt mit"), existing)), { wide: true });
}
