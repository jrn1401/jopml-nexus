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
  const { error } = await sb.auth.linkIdentity({ provider: "google", options: { redirectTo: back(), queryParams: { prompt: "select_account" } } });
  if (error) {
    if (/manual linking/i.test(error.message)) return toast("Verknüpfen ist in Supabase noch nicht freigeschaltet („Allow manual linking“).", "err", 7000);
    toast(error.message, "err");
  }
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
            await sb.auth.signOut();
            await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: back(), queryParams: { prompt: "select_account" } } });
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
