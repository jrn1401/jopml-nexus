// Web-Push: dieses Gerät für Benachrichtigungen vom Nexus anmelden (iPhone: nur aus der Home-Bildschirm-App)
import { sb, q } from "./api.js";
import { CONFIG } from "../config.js";

const b64ToBytes = (s) => { const p = "=".repeat((4 - (s.length % 4)) % 4); const raw = window.atob((s + p).replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(raw, (c) => c.charCodeAt(0)); };
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
export const supported = () => "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

export async function currentSub() {
  if (!supported()) return null;
  const reg = await navigator.serviceWorker.getRegistration();
  return reg ? reg.pushManager.getSubscription() : null;
}
function deviceName() {
  const ua = navigator.userAgent;
  return /iphone/i.test(ua) ? "iPhone" : /ipad/i.test(ua) ? "iPad" : /android/i.test(ua) ? "Android" : /mac/i.test(ua) ? "Mac" : /windows/i.test(ua) ? "Windows-PC" : "Gerät";
}
export async function enablePush() {
  if (!supported()) throw new Error(isIOS() && !isStandalone() ? "Auf dem iPhone geht Push nur aus der Home-Bildschirm-App: in Safari „Teilen → Zum Home-Bildschirm“, dann von dort öffnen." : "Dieser Browser unterstützt keine Push-Nachrichten.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Benachrichtigungen wurden nicht erlaubt. In den Einstellungen des Geräts für „Nexus“ erlauben.");
  const reg = await navigator.serviceWorker.ready;
  const r = await fetch(`${CONFIG.supabaseUrl}/functions/v1/nx-push/key`);
  const { key } = await r.json();
  if (!key) throw new Error("Push-Schlüssel nicht verfügbar.");
  let sub = await reg.pushManager.getSubscription();
  if (sub) await sub.unsubscribe();
  sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(key) });
  const j = sub.toJSON();
  await q(sb.from("cc_push_subs").delete().eq("endpoint", j.endpoint));
  await q(sb.from("cc_push_subs").insert({ endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, device: deviceName() }));
  return sub;
}
export async function disablePush() {
  const sub = await currentSub();
  if (sub) { await q(sb.from("cc_push_subs").delete().eq("endpoint", sub.endpoint)); await sub.unsubscribe(); }
}
