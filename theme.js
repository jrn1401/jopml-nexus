// Theme vor dem ersten Zeichnen setzen (kein Aufblitzen). Als Datei statt inline wegen Content-Security-Policy.
try {
  var t = JSON.parse(localStorage.getItem("cc:theme") || '"dark"');
  document.documentElement.dataset.theme = t === "system" ? (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark") : t;
} catch (e) { /* Standard: dunkel */ }
