// Gastkonto sichern: Google-Konto verknüpfen (Daten bleiben im selben Konto) – oder, wenn das Google-Konto schon
// einen Bereich hat, dort anmelden und die Gast-Daten per Einmal-Token übernehmen.
import { sb, rpc } from "./api.js";
import { h, icon, modal, toast, errMsg } from "./ui.js";

const KEY = "nx:transfer";
const store = { get: () => { try { return sessionStorage.getItem(KEY); } catch { return null; } },
  set: (v) => { try { sessionStorage.setItem(KEY, v); } catch { /* privat */ } }, del: () => { try { sessionStorage.removeItem(KEY); } catch { /* */ } } };
const back = () => location.origin + location.pathname;

export async function secureGuest() {
  try { store.set(await rpc("nx_guest_transfer_start")); } catch (e) { return toast(errMsg(e), "err"); }
  // Googles eigener Knopf: Anmeldung zeigt JOPML Nexus statt der Supabase-Adresse. Die Gast-Daten wandern per Einmal-Token mit.
  const { googleDialog } = await import("./gsi.js");
  googleDialog({ title: "Konto mit Google sichern", text: "Melde dich mit Google an – deine Gast-Projekte, Events und dein KI-Wissen werden automatisch übernommen.", onDone: () => location.reload() });
  void back;
}

// Nach der Rückkehr von Google: Übernahme abschließen bzw. bei „schon vergeben“ anbieten, dort anzumelden
export async function finishUpgrade(who, oauthErr) {
  const token = store.get();
  if (!token) return;
  if (who?.anonymous) {
    if (oauthErr && /already|exist|linked/i.test(oauthErr)) {
      const m = modal("Google-Konto hat schon einen Bereich", h("div.stack",
        h("p", { style: { margin: 0 } }, "Dieses Google-Konto wird bereits bei JOPML Nexus genutzt. Melde dich damit an – deine Gast-Projekte und dein KI-Wissen werden automatisch dorthin übernommen."),
        h("div.row", { style: { gap: "8px" } },
          h("button.btn.primary", { onclick: async () => {
            await sb.auth.signOut({ scope: "local" });
            const { googleDialog } = await import("./gsi.js"); m.close(); googleDialog({ onDone: () => location.reload() });
          } }, icon("users"), "Anmelden & übernehmen"),
          h("button.btn", { onclick: () => { store.del(); m.close(); } }, "Abbrechen"))));
    }
    return;
  }
  try {
    const r = await rpc("nx_guest_claim", { p_token: token });
    toast(r.linked ? "Konto gesichert – deine Daten bleiben dauerhaft erhalten" : `Gast-Daten übernommen: ${r.projects} Projekt(e), ${r.memory} KI-Wissen`, "ok", 6000);
  } catch (e) { if (!/invalid_token/.test(errMsg(e))) toast(errMsg(e), "err"); }
  store.del();
}
