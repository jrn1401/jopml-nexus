// Einladungsseite (ohne Konto): Einladung ansehen → zum Home-Bildschirm → Benachrichtigungen erlauben
import { rpc } from "./lib/api.js";
import { h, clear, toast, toastErr, errMsg } from "./lib/ui.js";
import { browserSubscribe, currentSub, isIOS, isStandalone, supported } from "./lib/webpush.js";

const root = document.getElementById("root");
const TOPIC = { tickets: "Ticketverkäufe", sites: "Website-Ausfälle", hosting: "Hosting & Deploys", tasks: "Aufgaben & Erinnerungen" };
let code = "";
try { code = (new URLSearchParams(location.search).get("c") || localStorage.getItem("nxi:code") || "").toUpperCase(); } catch { /* privat */ }
const hero = h("div.m-login-hero", { style: { height: "34dvh", backgroundImage: "radial-gradient(circle at 78% 22%, rgba(139,140,255,.85), transparent 55%), radial-gradient(circle at 10% 90%, rgba(70,211,238,.55), transparent 60%), url(icons/cube.svg)", backgroundSize: "cover, cover, 120px", backgroundRepeat: "no-repeat", backgroundPosition: "center, center, 80% 40%", backgroundColor: "#0b0c1a" } });

async function draw() {
  let info = null, err = null;
  if (code) { try { info = await rpc("cc_invite_info", { p_code: code }); } catch (e) { err = errMsg(e); } }
  const sub = await currentSub().catch(() => null);
  const box = h("div.m-login-card");
  if (!info) {
    const inp = h("input.input", { placeholder: "Einladungscode", "aria-label": "Einladungscode", autocapitalize: "characters", value: code, style: { fontSize: "18px", letterSpacing: ".12em", textTransform: "uppercase" } });
    box.append(h("h1", "Einladung"), h("p", code ? "Diese Einladung ist ungültig oder wurde zurückgezogen." : "Gib den Code aus deiner Einladung ein."), err ? h("div.banner.bad", err) : null, inp,
      h("button.btn.primary.m-wide", { onclick: () => { code = inp.value.trim().toUpperCase(); try { localStorage.setItem("nxi:code", code); } catch { /* privat */ } draw(); } }, "Weiter"));
    return clear(root, h("div.m-login", hero, box));
  }
  box.append(h("h1", { style: { fontSize: "30px" } }, info.label), h("p", `${info.from || "Jemand"} lädt dich ein, Benachrichtigungen zu bekommen:`),
    h("div.m-card", { style: { margin: 0 } }, ...(info.topics || []).map((t) => h("div.m-li", h("span", "•"), h("span", TOPIC[t] || t)))));
  if (sub) {
    box.append(h("div.banner.ok", "Aktiv – du bekommst die Nachrichten auf diesem Gerät."),
      h("button.btn.m-wide", { onclick: async () => { try { await rpc("cc_invite_unsubscribe", { p_endpoint: sub.endpoint }); await sub.unsubscribe(); toast("Abgemeldet"); draw(); } catch (e) { toastErr(e); } } }, "Keine Nachrichten mehr"));
  } else if (!supported() && isIOS() && !isStandalone()) {
    box.append(h("ol", { style: { lineHeight: 1.7, paddingLeft: "20px", margin: 0 } },
      h("li", "Unten in Safari auf „Teilen“ tippen (Viereck mit Pfeil)."), h("li", "„Zum Home-Bildschirm“ → „Hinzufügen“."),
      h("li", "Das neue „Nexus“-Symbol öffnen und „Benachrichtigungen erlauben“ tippen.")),
      h("p.m-row-s", `Kein Konto nötig. Falls nach dem Öffnen nach einem Code gefragt wird: ${code}`));
  } else if (!supported()) {
    box.append(h("div.banner.bad", "Dieser Browser kann keine Benachrichtigungen. Am iPhone bitte Safari benutzen, sonst Chrome."));
  } else {
    box.append(h("button.btn.primary.m-wide", { style: { padding: "14px" }, onclick: async (e) => {
      const b = e.currentTarget; b.disabled = true;
      try { const s = await browserSubscribe(); await rpc("cc_invite_subscribe", { p_code: code, p_endpoint: s.endpoint, p_p256dh: s.p256dh, p_auth: s.auth, p_device: s.device }); toast("Fertig – gleich kommt eine Test-Nachricht"); draw(); }
      catch (er) { toastErr(er); b.disabled = false; } } }, "Benachrichtigungen erlauben"), h("p.m-row-s", "Kein Konto nötig. Du kannst dich hier jederzeit wieder abmelden."));
  }
  clear(root, h("div.m-login", hero, box));
}
if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
draw();

// App sichtbar → Zähler am App-Symbol und alte Mitteilungen löschen
function clearBadge() {
  try { navigator.clearAppBadge?.(); } catch { /* egal */ }
  navigator.serviceWorker?.ready.then((r) => r.active?.postMessage("clear-badge")).catch(() => {});
}
clearBadge();
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") clearBadge(); });
