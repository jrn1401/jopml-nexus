// Service Worker: cached nur die App-Hülle (statische Dateien). Daten (Supabase) werden nie gecacht.
const VERSION = "cc-202611100103";
const SHELL = [
  "./", "index.html", "styles.css", "theme.js", "app.js", "config.js", "manifest.webmanifest",
  "lib/api.js", "lib/ui.js", "lib/charts.js", "lib/modules.js", "lib/actions.js",
  "views/dashboard.js", "views/projects.js", "views/project.js", "views/servers.js", "views/server.js", "views/ai.js",
  "views/events.js", "views/event.js", "views/jopml.js", "views/files.js", "views/activity.js", "views/settings.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Supabase/APIs immer live; nur eigene Dateien und die supabase-js-Bibliothek cachen
  if (url.origin === location.origin) {
    // Netzwerk zuerst (immer aktuell), Cache als Offline-Rückfall
    e.respondWith(fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return r;
    }).catch(() => caches.match(e.request).then((m) => m || caches.match("index.html"))));
  } else if (url.hostname === "cdn.jsdelivr.net") {
    e.respondWith(caches.match(e.request).then((m) => m || fetch(e.request).then((r) => {
      if (r.ok) { const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); }
      return r;
    })));
  }
});
