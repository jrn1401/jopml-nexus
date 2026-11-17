// Anmeldung mit Googles eigenem Knopf (Google Identity Services).
// Vorteil: Google zeigt beim Anmelden unsere Website/App statt der Supabase-Adresse an.
// Ablauf: Google liefert ein ID-Token → Supabase prüft es (signInWithIdToken, mit Nonce gegen Wiederverwendung).
// Klappt das Laden nicht (z. B. Blocker), bleibt der bisherige Weg über Supabase als Rückfall.
import { sb } from "./api.js";
import { CONFIG } from "../config.js";
import { toast, h, modal } from "./ui.js";

let loading = null;
const load = () => loading || (loading = new Promise((res, rej) => {
  if (window.google?.accounts?.id) return res();
  const s = document.createElement("script");
  s.src = "https://accounts.google.com/gsi/client"; s.async = true; s.onload = () => res(); s.onerror = () => { loading = null; rej(new Error("Google-Anmeldung konnte nicht geladen werden")); };
  document.head.append(s);
}));
const sha256hex = async (t) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new globalThis.TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, "0")).join("");

// Rendert Googles Knopf in `host`. onDone wird nach erfolgreicher Anmeldung aufgerufen.
export async function googleButton(host, { onDone, onFail } = {}) {
  if (!CONFIG.googleClientId) throw new Error("no_client");
  await load();
  const raw = crypto.randomUUID() + crypto.randomUUID();
  const nonce = await sha256hex(raw);
  window.google.accounts.id.initialize({
    client_id: CONFIG.googleClientId, nonce, ux_mode: "popup", itp_support: true, use_fedcm_for_button: true,
    callback: async ({ credential }) => {
      const { error } = await sb.auth.signInWithIdToken({ provider: "google", token: credential, nonce: raw });
      if (error) { toast(error.message, "err", 7000); onFail?.(error); return; }
      onDone?.();
    },
  });
  const dark = document.documentElement.dataset.theme !== "light";
  window.google.accounts.id.renderButton(host, { type: "standard", theme: dark ? "filled_black" : "outline", size: "large", shape: "pill", text: "signin_with", locale: "de", width: Math.min(320, host.clientWidth || 300) });
}

// Bisheriger Weg über Supabase (Weiterleitung) – als Rückfall
export async function googleRedirect() {
  const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname, queryParams: { prompt: "select_account" } } });
  if (error) toast(error.message, "err");
}

// Anmelde-Fenster mit Googles Knopf (zeigt unsere Seite statt der Supabase-Adresse). Rückfall: Weiterleitung.
export function googleDialog({ title = "Mit Google anmelden", text = "", onDone } = {}) {
  const box = h("div.gsi-box", { style: { minHeight: "48px", display: "flex", justifyContent: "center" } });
  const alt = h("button.btn.ghost.sm", { style: { marginTop: "6px" }, onclick: () => { m.close(); googleRedirect(); } }, "Klappt nicht? Anderer Anmeldeweg");
  const m = modal(title, h("div.stack", { style: { gap: "12px", alignItems: "center", textAlign: "center" } },
    text ? h("p", { style: { margin: 0 } }, text) : null, box,
    h("p.faint", { style: { margin: 0, fontSize: "12px" } }, "Du meldest dich direkt bei Google an. Nexus bekommt nur Name, E-Mail und Profilbild – nie dein Passwort."), alt));
  googleButton(box, { onDone: () => { m.close(); onDone?.(); } }).catch(() => { box.replaceChildren(h("button.btn.primary", { onclick: () => { m.close(); googleRedirect(); } }, "Mit Google anmelden")); });
  return m;
}
