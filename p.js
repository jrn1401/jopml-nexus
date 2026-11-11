/* JOPML Nexus – Besucherzähler (cookiefrei, ohne localStorage, respektiert „Do Not Track“). Einbau: <script defer src=".../p.js" data-k="SITE_KEY"></script> */
(function () {
  var s = document.currentScript, k = s && s.getAttribute("data-k");
  if (!k || !/^[0-9a-f]{18}$/.test(k) || navigator.webdriver || navigator.doNotTrack === "1" || window.doNotTrack === "1") return;
  if (/^(localhost|127\.|\[::1\])/.test(location.hostname)) return;
  var E = "https://qeomooxbfpwvcprvmows.supabase.co/functions/v1/nx-pulse/collect", h = null, t0 = Date.now(), last = location.pathname;
  function send(o, cb) {
    o.k = k;
    try {
      fetch(E, { method: "POST", body: JSON.stringify(o), keepalive: true, credentials: "omit", headers: { "Content-Type": "text/plain" } })
        .then(function (r) { return r.ok && cb ? r.json().then(cb) : null; }).catch(function () {});
    } catch (e) { /* ignorieren */ }
  }
  function tz() { try { return Intl.DateTimeFormat().resolvedOptions().timeZone; } catch (e) { return ""; } }
  function pv() {
    t0 = Date.now(); h = null;
    send({ e: "pv", p: location.pathname, r: document.referrer, l: navigator.language, tz: tz() }, function (d) { h = d && d.h; });
  }
  function ping() { if (h) send({ e: "ping", h: h, p: location.pathname, s: Math.round((Date.now() - t0) / 1000) }); }
  pv();
  setInterval(function () { if (document.visibilityState === "visible") ping(); }, 25000);
  document.addEventListener("visibilitychange", function () { if (document.visibilityState === "hidden") ping(); });
  function nav() { if (location.pathname !== last) { ping(); last = location.pathname; pv(); } }
  var push = history.pushState;
  history.pushState = function () { push.apply(this, arguments); nav(); };
  window.addEventListener("popstate", nav);
})();
