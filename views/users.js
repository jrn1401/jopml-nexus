// #/users – Benutzer & Rollen: alle Konten sehen, Admins ernennen (nur Eigentümer), sperren,
// Funktionen für normale Konten an/aus, Ankündigung an alle, Speicher- und Gratis-Limits.
import { rpc, local } from "../lib/api.js";
import { h, icon, toast, toastErr, fmtAgo, fmtDate, fmtBytes, fmtNum, empty, confirmDialog, meter, stat, debounce } from "../lib/ui.js";

export const FEATURES = [
  ["tasks", "Aufgaben", "Eigene To-do-Liste"],
  ["websites", "Websites", "Besucher und Erreichbarkeit eigener Websites"],
  ["connections", "Verbindungen", "Netlify, GitHub, Vercel, Supabase, Eventfrog verbinden"],
  ["ai", "KI-Assistent", "Fragen an die KI über eigene Daten"],
  ["shares", "Geteilt", "Freigaben empfangen und eigene Projekte teilen"],
  ["help", "Hilfe", "Kurzanleitung mit Suche"],
];
const missing = (e) => /cc_users_list|cc_usage_limits|cc_public_config|function .* does not exist|PGRST202/i.test(String(e?.message || e));
const PENDING = () => h("div.banner.warn", { style: { marginBottom: "14px" } }, icon("info"),
  h("div", h("strong", "Wartet auf Freigabe: "), "Die Datenbank-Änderung „cc_19 Rollen“ ist vorbereitet, aber noch nicht bestätigt. Schreib im Chat „bestätigen“ – dann ist diese Seite voll aktiv."));

export default async function usersView() {
  const [who, users, limits, cfg] = await Promise.all([
    rpc("cc_whoami"), rpc("cc_users_list").catch((e) => (missing(e) ? null : Promise.reject(e))),
    rpc("cc_usage_limits").catch(() => null), rpc("cc_public_config").catch(() => null)]);
  const owner = !!who?.owner;
  const root = h("div",
    h("div.page-head", h("div", h("h1", "Benutzer & Rollen"), h("p", "Wer die Website nutzt, wer Admin ist und was normale Konten dürfen."))));
  if (!users) root.append(PENDING());

  // ---- Kennzahlen + Limits ----
  if (users || limits) {
    const list = users || [];
    root.append(h("div.grid.g-4", { style: { marginBottom: "16px" } },
      stat("Konten", fmtNum(list.length), { ic: "users", sub: `${list.filter((u) => u.anonymous).length} Gäste` }),
      stat("Aktiv 7 Tage", fmtNum(list.filter((u) => u.last_sign_in && Date.now() - new Date(u.last_sign_in) < 7 * 864e5).length), { ic: "activity" }),
      stat("Admins", fmtNum(list.filter((u) => u.role !== "user").length), { ic: "lock" }),
      stat("Gesperrt", fmtNum(list.filter((u) => u.blocked).length), { ic: "alert" })));
  }
  if (limits) {
    const dbp = (limits.db_bytes / limits.db_limit) * 100, stp = (limits.storage_bytes / limits.storage_limit) * 100;
    root.append(h("section.card", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3", "Speicher & Gratis-Limits")),
      h("div.card-body", h("div.stack", { style: { gap: "12px" } },
        stp > 80 || dbp > 80 ? h("div.banner.bad", icon("alert"), h("div", `Achtung: ${stp > 80 ? "Dateispeicher" : "Datenbank"} ist zu über 80 % voll. Alte Dateien in „Dateien“ löschen oder auf Supabase Pro wechseln.`)) : null,
        h("div", h("div.row.between", h("span", "Datenbank"), h("span.muted", `${fmtBytes(limits.db_bytes)} von ${fmtBytes(limits.db_limit)}`)), meter(dbp)),
        h("div", h("div.row.between", h("span", "Dateispeicher"), h("span.muted", `${fmtBytes(limits.storage_bytes)} von ${fmtBytes(limits.storage_limit)}`)), meter(stp)),
        h("div.faint", { style: { fontSize: "12.5px" } }, "Grenzen des kostenlosen Supabase-Tarifs. Größte Tabellen: ", (limits.top_tables || []).slice(0, 4).map((t) => `${t.t} ${fmtBytes(t.bytes)}`).join(" · "))))));
  }

  // ---- Benutzerliste ----
  if (users) {
    let term = "", only = "all";
    const box = h("div.list", { role: "list" });
    const draw = () => {
      const vis = users.filter((u) => (only === "all" || (only === "admin" ? u.role !== "user" : only === "guest" ? u.anonymous : u.blocked))
        && (!term || `${u.email || ""} ${u.name || ""}`.toLowerCase().includes(term)));
      box.replaceChildren(...(vis.length ? vis.map(row) : [empty("users", "Keine Konten gefunden")]));
    };
    const act = async (fn, ok) => { try { await fn(); toast(ok); location.reload(); } catch (e) { toastErr(e); } };
    function row(u) {
      const label = u.anonymous ? "Gast" : u.email || "ohne E-Mail";
      const roleBadge = u.role === "owner" ? h("span.badge.b-acc", "Eigentümer") : u.role === "admin" ? h("span.badge.b-pri", "Admin") : u.anonymous ? h("span.badge.b-idle", "Gast") : h("span.badge.b-idle", "Nutzer");
      const btns = [];
      if (owner && u.role === "user" && !u.anonymous && !u.blocked) btns.push(h("button.btn.sm", { onclick: async () => {
        if (await confirmDialog("Zum Admin machen?", `${label} sieht und bearbeitet danach alles im Control Center – Projekte, Events, Server, JOPML, Einstellungen. Nur du kannst Admins ernennen oder entfernen.`, { ok: "Admin machen", danger: false }))
          act(() => rpc("cc_role_set", { p_user: u.id, p_role: "admin" }), "Ist jetzt Admin");
      } }, icon("lock"), "Admin machen"));
      if (owner && u.role === "admin") btns.push(h("button.btn.sm", { onclick: async () => {
        if (await confirmDialog("Admin-Rechte entfernen?", `${label} wird wieder ein normales Konto.`, { ok: "Entfernen" })) act(() => rpc("cc_role_set", { p_user: u.id, p_role: "user" }), "Admin-Rechte entfernt");
      } }, "Admin entfernen"));
      if (u.role !== "owner" && (owner || u.role === "user")) btns.push(h("button.btn.sm.ghost", { onclick: async () => {
        if (await confirmDialog(u.blocked ? "Sperre aufheben?" : "Konto sperren?", u.blocked ? `${label} kann sich wieder anmelden.` : `${label} wird sofort abgemeldet und kann sich nicht mehr anmelden. Daten bleiben erhalten.`, { ok: u.blocked ? "Entsperren" : "Sperren", danger: !u.blocked }))
          act(() => rpc("cc_user_block", { p_user: u.id, p_block: !u.blocked }), u.blocked ? "Entsperrt" : "Gesperrt");
      } }, u.blocked ? "Entsperren" : "Sperren"));
      return h("div.list-item", { role: "listitem" },
        h("div.avatar", { "aria-hidden": "true" }, (u.name || u.email || "G")[0].toUpperCase()),
        h("div.li-main", h("div.li-title", u.name ? `${u.name}` : label, u.blocked ? h("span.badge.b-bad", { style: { marginLeft: "8px" } }, "gesperrt") : null),
          h("div.li-sub", [u.name ? label : null, `seit ${fmtDate(u.created_at)}`, u.last_sign_in ? `zuletzt ${fmtAgo(u.last_sign_in)}` : "nie angemeldet",
            `${u.projects} Projekte · ${u.connections} Verbindungen · ${u.tasks} Aufgaben`].filter(Boolean).join(" · "))),
        roleBadge, h("div.row", { style: { gap: "6px" } }, btns));
    }
    const seg = h("div.seg", [["all", "Alle"], ["admin", "Admins"], ["guest", "Gäste"], ["blocked", "Gesperrt"]].map(([k, t]) => h("button", { class: k === only ? "on" : "", onclick: (e) => {
      only = k; seg.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b === e.currentTarget)); draw(); } }, t)));
    draw();
    root.append(h("section.card", { style: { marginBottom: "16px" } }, h("div.card-head", h("h3", "Konten")),
      h("div.card-body",
        !owner ? h("p.faint", { style: { marginTop: 0 } }, "Admins ernennen oder entfernen kann nur der Eigentümer.") : null,
        h("div.row.wrap", { style: { justifyContent: "space-between", gap: "10px", marginBottom: "8px" } }, seg,
          h("input.input", { type: "search", placeholder: "E-Mail oder Name …", "aria-label": "Konten durchsuchen", style: { maxWidth: "240px" }, oninput: debounce((e) => { term = e.target.value.toLowerCase(); draw(); }, 120) })),
        box)));
  }

  // ---- Funktionen für normale Konten ----
  const feats = { ...Object.fromEntries(FEATURES.map(([k]) => [k, true])), ...(cfg?.features || {}) };
  const save = async (key, value) => { try { await rpc("cc_public_config_set", { p_key: key, p_value: value }); toast("Gespeichert"); } catch (e) { toastErr(missing(e) ? new Error("Erst nach Freigabe von cc_19 möglich.") : e); } };
  root.append(h("div.grid.g-2",
    h("section.card", h("div.card-head", h("h3", "Funktionen für normale Konten")), h("div.card-body", h("div.list", FEATURES.map(([k, t, sub]) =>
      h("div.list-item", h("div.li-main", h("div.li-title", t), h("div.li-sub", sub)),
        h("label.switch", { "aria-label": t }, h("input", { type: "checkbox", checked: feats[k] !== false, onchange: (e) => { feats[k] = e.target.checked; save("features", feats); } }), h("span"))))),
      h("p.faint", { style: { fontSize: "12.5px", marginBottom: 0 } }, "Ausgeschaltete Bereiche verschwinden aus „Mein Bereich“ aller Nicht-Admins. Admins sehen immer alles."))),
    announceCard(cfg?.announcement, save)));

  // ---- Vorschau ----
  root.append(h("section.card", { style: { marginTop: "16px" } }, h("div.card-body.row.wrap", { style: { gap: "12px", justifyContent: "space-between" } },
    h("div", h("strong", "So sieht es ein normales Konto"), h("div.faint", "Öffnet „Mein Bereich“ mit deinen eigenen (privaten) Daten. Zurück über den Knopf oben.")),
    h("button.btn", { onclick: () => { local.set("asuser", true); location.hash = "#/"; location.reload(); } }, icon("eye"), "Als Nutzer ansehen"))));
  return root;
}

function announceCard(cur, save) {
  const text = h("textarea.input", { rows: 3, maxlength: 400, "aria-label": "Ankündigungstext", placeholder: "z. B. Heute Abend Wartung von 22–23 Uhr" }, cur?.text || "");
  const level = h("select.input", { "aria-label": "Art" }, [["info", "Hinweis"], ["warn", "Warnung"], ["ok", "Gute Nachricht"]].map(([v, t]) => h("option", { value: v, selected: cur?.level === v }, t)));
  const days = h("select.input", { "aria-label": "Dauer" }, [["1", "1 Tag"], ["3", "3 Tage"], ["7", "1 Woche"], ["30", "30 Tage"]].map(([v, t]) => h("option", { value: v, selected: v === "3" }, t)));
  return h("section.card", h("div.card-head", h("h3", "Ankündigung an alle")), h("div.card-body.stack", { style: { gap: "10px" } },
    h("p.faint", { style: { margin: 0 } }, "Erscheint oben in „Mein Bereich“ bei allen Konten."), text, h("div.two", level, days),
    h("div.row", { style: { gap: "8px", justifyContent: "flex-end" } },
      cur ? h("button.btn.ghost", { onclick: () => save("announcement", {}) }, "Entfernen") : null,
      h("button.btn.primary", { onclick: () => {
        if (!text.value.trim()) return toast("Bitte Text eingeben", "err");
        save("announcement", { text: text.value.trim(), level: level.value, until: new Date(Date.now() + Number(days.value) * 864e5).toISOString(), at: new Date().toISOString() });
      } }, icon("bell"), "Veröffentlichen"))));
}
