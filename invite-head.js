// Einladung: Code merken und ein Manifest einbinden, dessen Startadresse den Code enthält
// (auf dem iPhone hat die Home-Bildschirm-App einen eigenen Speicher – so kommt der Code mit).
(function () {
  var c = (new URLSearchParams(location.search).get("c") || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
  try { if (c) localStorage.setItem("nxi:code", c); else c = localStorage.getItem("nxi:code") || ""; } catch (e) { /* privat */ }
  var l = document.createElement("link");
  l.rel = "manifest";
  l.href = "https://qeomooxbfpwvcprvmows.supabase.co/functions/v1/nx-push/manifest?c=" + encodeURIComponent(c);
  document.head.appendChild(l);
})();
