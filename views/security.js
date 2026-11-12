// #/security – Sicherheit & Benachrichtigungen: Push aufs Handy, Sicherungen, Login-Protokoll, Alter der Schlüssel
import { sb, q, rpc } from "../lib/api.js";
import { h, icon, clear, fmtAgo, fmtDateTime, fmtBytes, toast, toastErr, copyText, confirmDialog, naNote } from "../lib/ui.js";
import { download } from "../lib/actions.js";

const age = (d) => Math.floor((Date.now() - new Date(d)) / 864e5);
const ageBadge = (d) => { const a = age(d); return h("span.badge", { class: a > 90 ? "b-bad" : a > 60 ? "b-warn" : "b-ok" }, a > 90 ? `${a} Tage – erneuern` : `${a} Tage alt`); };

export default async function securityView() {
  const root = h("div");
  async function load() {
    const [push, backups, logins, keys, conns, shares] = await Promise.all([
      rpc("cc_push_setup", { p_action: "get" }),
      q(sb.from("cc_backups").select("id,created_at,kind,bytes,counts").order("created_at", { ascending: false })),
      q(sb.from("cc_login_log").select("*").order("ts", { ascending: false }).limit(30)),
      rpc("cc_list_api_keys").catch(() => []),
      q(sb.from("cc_connections").select("id,provider,account,created_at,status")).catch(() => []),
      q(sb.from("cc_shares").select("id,label,email,share_type,permission,expires_at,created_at").is("revoked_at", null)).catch(() => []),
    ]);
    const act = (a, extra = {}) => async (e) => { e.currentTarget.disabled = true; try { await rpc("cc_push_setup", { p_action: a, ...extra }); if (a === "test") toast("Test gesendet – kommt in wenigen Sekunden an"); load(); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } };
    const topic = push.topic, on = push.enabled === true;
    const activeKeys = (keys || []).filter((k) => !k.revoked_at);
    const oldKeys = activeKeys.filter((k) => age(k.created_at) > 90).length + conns.filter((c) => age(c.created_at) > 90).length;
    const openLinks = shares.filter((s) => s.share_type === "link" && !s.expires_at);
    const lastBackup = backups[0];
    const check = (ok, text, sub) => h("div.list-item", h("span.dot", { class: ok ? "ok" : "warn" }), h("div.li-main", h("div.li-title", text), sub ? h("div.li-sub", sub) : null));

    clear(root, 
      h("div.page-head", h("div", h("h1", "Sicherheit & Push"), h("p", "Benachrichtigungen aufs Handy, Datensicherung, Anmeldungen und Schlüssel im Blick."))),
      h("div.grid.g-2", { style: { alignItems: "start" } },
        h("section.card", h("div.card-head", h("h3.row", icon("bell"), "Push aufs Handy"), h("span.badge", { class: on ? "b-ok" : "b-idle" }, on ? "Aktiv" : "Aus")),
          h("div.card-body.stack",
            h("p", { style: { margin: 0, fontSize: "13.5px" } }, "Ticketverkäufe, Website-Ausfälle, Hosting-Fehler, fällige Aufgaben und die Tagesübersicht (morgens) kommen als Push-Nachricht – auch wenn das Nexus geschlossen ist."),
            on ? [
              h("ol", { style: { fontSize: "13.5px", lineHeight: 1.65, margin: 0, paddingLeft: "20px" } },
                h("li", "Kostenlose App „ntfy“ installieren (App Store / Google Play)."),
                h("li", "In der App auf „+“ tippen und dieses Thema abonnieren:"),
                h("li", "Unten „Test senden“ – die Nachricht muss auf dem Handy erscheinen.")),
              h("div.row", { style: { gap: "8px" } }, h("input.input.mono", { readOnly: true, value: topic, onclick: (e) => e.target.select() }), h("button.btn", { onclick: () => copyText(topic) }, icon("copy"), "Kopieren")),
              h("div.row.wrap", h("a.btn", { href: `https://ntfy.sh/${topic}`, target: "_blank", rel: "noopener noreferrer" }, icon("external"), "Im Browser abonnieren"),
                h("button.btn.primary", { onclick: act("test") }, icon("send"), "Test senden"),
                h("button.btn.ghost", { onclick: act("disable") }, "Ausschalten")),
              h("label.check", h("input", { type: "checkbox", checked: push.only_important === true, onchange: (e) => rpc("cc_push_setup", { p_action: "get", p_only_important: e.target.checked }).then(() => toast("Gespeichert"), toastErr) }),
                "Nur Wichtiges senden (Fehler, Warnungen, Tickets, Erinnerungen, Tagesübersicht)"),
              h("div.row.wrap", h("button.btn.sm.ghost", { onclick: async (e) => { if (await confirmDialog("Neues Thema erzeugen?", "Das alte Thema bekommt dann keine Nachrichten mehr – du musst das neue in der App abonnieren.", { ok: "Neu erzeugen" })) act("reset")(e); } }, icon("refresh"), "Thema erneuern")),
              naNote("Das Thema ist wie ein Passwort: Wer es kennt, kann deine Nachrichten mitlesen. Die Nachrichten laufen über den Dienst ntfy.sh und enthalten nur Titel und Kurztext (z. B. „3 neue Tickets“), keine Käuferdaten.", "lock"),
            ] : h("button.btn.primary", { onclick: act("enable") }, icon("bell"), "Push einschalten"))),

        h("section.card", h("div.card-head", h("h3.row", icon("lock"), "Sicherheits-Check")),
          h("div.card-body", h("div.list",
            check(lastBackup && age(lastBackup.created_at) < 2, lastBackup ? `Letzte Sicherung ${fmtAgo(lastBackup.created_at)}` : "Noch keine Sicherung", "Automatisch jede Nacht, die letzten 10 bleiben erhalten."),
            check(!oldKeys, oldKeys ? `${oldKeys} Schlüssel älter als 90 Tage` : "Alle Schlüssel jünger als 90 Tage", "Schlüssel regelmäßig erneuern – besonders, wenn sie einmal in einem Chat standen."),
            check(!openLinks.length, openLinks.length ? `${openLinks.length} Gäste-Link(s) ohne Ablaufdatum` : "Keine Gäste-Links ohne Ablaufdatum", "Unter „Teilen & Team“ ein Ablaufdatum setzen oder Links widerrufen."),
            check(on, on ? "Push ist aktiv" : "Push ist aus", "Bei Ausfällen und neuen Anmeldungen sofort informiert werden.")))),

        h("section.card", h("div.card-head", h("h3.row", icon("download"), "Datensicherung"),
            h("button.btn.sm.primary", { onclick: async (e) => { e.currentTarget.disabled = true; try { await rpc("cc_backup_now"); toast("Sicherung erstellt"); load(); } catch (er) { toastErr(er); e.currentTarget.disabled = false; } } }, icon("plus"), "Jetzt sichern")),
          h("div.card-body", backups.length ? h("div.list", backups.map((b) => h("div.list-item",
            h("div.li-main", h("div.li-title", fmtDateTime(b.created_at), " ", h("span.tag", b.kind === "auto" ? "automatisch" : "manuell")),
              h("div.li-sub", `${fmtBytes(b.bytes)} · ${b.counts?.cc_projects ?? 0} Projekte · ${b.counts?.cc_events ?? 0} Events · ${b.counts?.cc_event_items ?? 0} Event-Einträge · ${b.counts?.cc_tasks ?? 0} Aufgaben`)),
            h("button.btn.sm", { onclick: async (e) => { e.currentTarget.disabled = true; try { const r = await q(sb.from("cc_backups").select("data").eq("id", b.id).single()); download(`nexus-sicherung-${new Date(b.created_at).toLocaleDateString("sv-SE")}.json`, JSON.stringify(r.data, null, 1), "application/json"); } catch (er) { toastErr(er); } e.currentTarget.disabled = false; } }, icon("download"), "Herunterladen"))))
            : h("div.faint", { style: { fontSize: "13px" } }, "Noch keine Sicherung – die erste entsteht heute Nacht oder sofort mit „Jetzt sichern“."),
            h("p.faint", { style: { fontSize: "12.5px", margin: "10px 0 0" } }, "Gesichert werden Projekte, Module, Events, Aufgaben, Links, Freigaben und Einstellungen. Hochgeladene Dateien und geheime Schlüssel sind nicht enthalten. Die Datei enthält Freigabe-Links – sicher aufbewahren."))),

        h("section.card", h("div.card-head", h("h3.row", icon("key"), "Schlüssel & Verbindungen")),
          h("div.card-body", activeKeys.length || conns.length ? h("div.list",
            activeKeys.map((k) => h("div.list-item", h("div.li-icon", icon("key")), h("div.li-main", h("div.li-title", k.name), h("div.li-sub", `Nexus-Schlüssel · zuletzt benutzt ${k.last_used_at ? fmtAgo(k.last_used_at) : "nie"}`)), ageBadge(k.created_at))),
            conns.map((c) => h("div.list-item", h("div.li-icon", icon("link")), h("div.li-main", h("div.li-title", c.provider), h("div.li-sub", c.account || "Verbindung")), ageBadge(c.created_at))))
            : h("div.faint", { style: { fontSize: "13px" } }, "Keine Schlüssel vorhanden."),
            h("div.row.wrap", { style: { marginTop: "10px" } }, h("a.btn.sm", { href: "#/settings" }, "Nexus-Schlüssel verwalten"), h("a.btn.sm", { href: "#/connections" }, "Verbindungen verwalten")))),

        h("section.card", { style: { gridColumn: "1 / -1" } }, h("div.card-head", h("h3.row", icon("users"), "Anmeldungen"), h("span.sub", "letzte 30 · wird 180 Tage aufbewahrt")),
          h("div.card-body", logins.length ? h("div.list", logins.map((l) => h("div.list-item",
            h("span.dot", { class: l.admin ? "ok" : "idle" }),
            h("div.li-main", h("div.li-title", l.device || "Unbekanntes Gerät", " ", l.admin ? h("span.tag", "Admin") : h("span.tag", "Nutzer")),
              h("div.li-sub", [l.email, l.ip ? `IP ${l.ip}` : null].filter(Boolean).join(" · "))),
            h("span.faint.nowrap", { style: { fontSize: "12.5px" } }, fmtDateTime(l.ts)))))
            : h("div.faint", { style: { fontSize: "13px" } }, "Noch keine Anmeldungen protokolliert – ab jetzt wird jede Anmeldung festgehalten. Bei einem neuen Gerät bekommst du eine Warnung.")))));
  }
  await load();
  return root;
}
