// Theme und Design-Optionen vor dem ersten Zeichnen setzen (kein Aufblitzen). Als Datei statt inline wegen Content-Security-Policy.
try {
  var g = function (k, d) { var v = localStorage.getItem("cc:" + k); return v === null ? d : JSON.parse(v); };
  var t = g("theme", "dark"), r = document.documentElement;
  r.dataset.theme = t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
  var a = g("accent", ""); if (a) r.dataset.accent = a;
  var d = g("density", ""); if (d) r.dataset.density = d;
  var f = g("fontscale", ""); if (f) r.style.fontSize = f + "%";
  if (g("reducemotion", false)) r.dataset.motion = "reduce";
} catch (e) { /* Standard: dunkel */ }
