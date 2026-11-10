// Teilen & Gäste: Kontakte verwalten, alle Freigaben im Überblick, schnell etwas teilen.
import { sb, q } from "../lib/api.js";
import { h, icon, fmtAgo, fmtDate, toast, toastErr, confirmDialog, formModal, copyText, empty } from "../lib/ui.js";
import { openShareDialog, revokeShare, linkUrl, KIND_LABEL, PERM } from "../lib/share.js";

export default async function sharesView() {
  const [contacts, shares, events, projects] = await Promise.all([
    q(sb.from("cc_contacts").select("*").order("name")),
    q(sb.from("cc_shares").select("*").is("revoked_at", null).order("created_at", { ascending: false })),
    q(sb.from("cc_events").select("id,name,event_date,status").neq("status", "cancelled").order("event_date")),
    q(sb.from("cc_projects").select("id,name").order("name")),
  ]);
  const fileIds = shares.filter((s) => s.item_kind === "file").map((s) => s.item_id);
  const files = fileIds.length ? await q(sb.from("cc_files").select("id,file_name").in("id", fileIds)) : [];
  const title = (s) => (s.item_kind === "event" ? events : s.item_kind === "project" ? projects : files.map((f) => ({ id: f.id, name: f.file_name }))).find((x) => x.id === s.item_id)?.name || "(gelöscht/abgesagt)";
  const cname = (em) => contacts.find((c) => c.email.toLowerCase() === em)?.name;
  const active = shares.filter((s) => !s.expires_at || new Date(s.expires_at) > Date.now());
  const reload = () => dispatchEvent(new Event("hashchange"));

  const editContact = (c) => formModal(c ? "Kontakt bearbeiten" : "Neuer Kontakt", [
    { name: "name", label: "Name", required: true, value: c?.name, max: 80 },
    { name: "email", label: "E-Mail (Google-Konto)", type: "email", required: true, value: c?.email, max: 200, hint: "Mit dieser Adresse meldet sich die Person als Gast an." },
    { name: "note", label: "Notiz (z. B. Rolle)", value: c?.note, max: 300, placeholder: "z. B. Bar, Garderobe, Einlass" },
  ], async (v) => {
    const row = { name: v.name, email: v.email.toLowerCase(), note: v.note };
    if (c) await q(sb.from("cc_contacts").update(row).eq("id", c.id)); else await q(sb.from("cc_contacts").insert(row));
    toast("Gespeichert"); reload();
  });

  return h("div",
    h("div.page-head", h("div", h("h1", "Teilen & Gäste"), h("p", `${contacts.length} Kontakte · ${active.length} aktive Freigaben`)),
      h("div.actions", h("button.btn", { onclick: () => editContact() }, icon("plus"), "Kontakt"))),
    h("div.grid.g-2",
      h("section.card", h("div.card-head", h("h3", "Schnell teilen")), h("div.card-body", h("div.list",
        events.map((e) => h("div.list-item", h("div.li-icon", icon("calendar")), h("div.li-main", h("div.li-title", e.name), h("div.li-sub", e.event_date ? fmtDate(e.event_date) : "Event")),
          h("button.btn.sm", { onclick: () => openShareDialog("event", e.id, e.name) }, icon("users"), "Teilen"))),
        projects.map((p) => h("div.list-item", h("div.li-icon", icon("folder")), h("div.li-main", h("div.li-title", p.name), h("div.li-sub", "Projekt")),
          h("button.btn.sm", { onclick: () => openShareDialog("project", p.id, p.name) }, icon("users"), "Teilen")))),
        h("div.faint", { style: { fontSize: "12px", marginTop: "10px" } }, "Einzelne Dateien teilst du über das Teilen-Symbol in der Dateiliste."))),
      h("section.card", h("div.card-head", h("h3", "Kontakte")), h("div.card-body", contacts.length ? h("div.list", contacts.map((c) => h("div.list-item",
          h("span.avatar.sm", c.name[0].toUpperCase()), h("div.li-main", h("div.li-title", c.name), h("div.li-sub", [c.email, c.note].filter(Boolean).join(" · "))),
          h("span.faint.nowrap", { style: { fontSize: "12px" } }, `${active.filter((s) => s.email === c.email.toLowerCase()).length} geteilt`),
          h("button.icon-btn", { "aria-label": "Bearbeiten", onclick: () => editContact(c) }, icon("edit")),
          h("button.icon-btn", { "aria-label": "Löschen", onclick: async () => {
            if (!(await confirmDialog("Kontakt löschen?", `${c.name} wird aus den Kontakten entfernt. Bestehende Freigaben für ${c.email} bleiben, bis du sie beendest.`, { ok: "Löschen" }))) return;
            try { await q(sb.from("cc_contacts").delete().eq("id", c.id)); toast("Kontakt gelöscht"); reload(); } catch (e) { toastErr(e); }
          } }, icon("trash")))))
        : empty("users", "Noch keine Kontakte", "Lege Helfer, Mitveranstalter oder Freunde mit ihrer Google-E-Mail an.", h("button.btn.sm", { onclick: () => editContact() }, icon("plus"), "Kontakt anlegen")))),
      h("section.card.span-2", h("div.card-head", h("h3", "Aktive Freigaben")), h("div.card-body", active.length ? h("div.list", active.map((s) => h("div.list-item",
          h("div.li-icon", icon(s.share_type === "link" ? "link" : "users")),
          h("div.li-main", h("div.li-title", `${KIND_LABEL[s.item_kind]}: ${title(s)}`),
            h("div.li-sub", [s.share_type === "link" ? "Gäste-Link (ohne Konto)" : `${cname(s.email) || ""} ${s.email}`.trim(), PERM[s.permission],
              s.show_finance ? "mit Finanzen" : null, s.expires_at ? `bis ${fmtDate(s.expires_at)}` : null,
              s.last_opened_at ? `zuletzt geöffnet ${fmtAgo(s.last_opened_at)}` : "noch nicht geöffnet"].filter(Boolean).join(" · "))),
          s.share_type === "link" ? h("button.btn.sm", { onclick: () => copyText(linkUrl(s.token)) }, icon("copy"), "Link") : null,
          h("button.btn.sm.ghost", { onclick: async () => {
            if (!(await confirmDialog("Freigabe beenden?", "Danach ist kein Zugriff mehr möglich.", { ok: "Beenden" }))) return;
            try { await revokeShare(s.id); toast("Freigabe beendet"); reload(); } catch (e) { toastErr(e); }
          } }, "Beenden"))))
        : empty("lock", "Nichts geteilt", "Alles ist privat. Über „Teilen“ gibst du einzelne Events, Projekte oder Dateien frei.")))));
}
