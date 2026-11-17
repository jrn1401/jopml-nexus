// Eigene Push-Nachricht an alle, die über eine Einladung / Benachrichtigungs-Seite abonniert haben
import { rpc } from "./api.js";
import { h, modal, toast, toastErr, errMsg } from "./ui.js";

export function broadcastDialog(inviteId, label) {
  const t = h("input.input", { maxlength: 120, placeholder: "z. B. Ticketverkauf startet jetzt!", "aria-label": "Titel" });
  const b = h("textarea.input", { rows: 3, maxlength: 500, placeholder: "Kurzer Text (optional)", "aria-label": "Text" });
  const m = modal(`Nachricht an „${label}“`, h("div.stack", t, b,
    h("p.faint", { style: { margin: 0, fontSize: "12.5px" } }, "Geht als Push an alle Geräte dieser Einladung. Höchstens 20 Nachrichten pro Tag."),
    h("button.btn.primary", { onclick: async (e) => {
      const btn = e.currentTarget; if (!t.value.trim()) return toast("Bitte einen Titel eingeben", "err");
      btn.disabled = true;
      try { const r = await rpc("cc_invite_broadcast", { p_invite: inviteId, p_title: t.value.trim(), p_body: b.value.trim() || null }); toast(r?.devices ? `An ${r.devices} Gerät(e) gesendet` : "Noch niemand angemeldet – gespeichert, aber nicht gesendet"); m.close(); }
      catch (er) { /function|does not exist|schema cache/i.test(errMsg(er)) ? toast("Diese Funktion wird mit der nächsten Freischaltung aktiv.", "err", 6000) : toastErr(er); btn.disabled = false; }
    } }, "Senden")));
  t.focus();
}
