// Service Worker: cached nur die App-Hülle (statische Dateien). Daten (Supabase) werden nie gecacht.
const VERSION = "cc-v42";
const SHELL = [
  "./", "index.html", "styles.css", "theme.js", "app.js", "config.js", "manifest.webmanifest",
  "lib/api.js", "lib/ui.js", "lib/charts.js", "lib/modules.js", "lib/actions.js",
  "views/dashboard.js", "views/projects.js", "views/project.js", "views/servers.js", "views/server.js", "views/ai.js",
  "views/events.js", "views/event.js", "views/jopml.js", "views/jopml-admin.js", "views/files.js", "views/activity.js", "views/settings.js", "views/system.js", "views/guest.js", "views/shares.js", "lib/share.js", "lib/eventfrog.js",
  "lib/connect.js", "lib/gsi.js", "m.html", "mobile.js", "mobile.css", "manifest-m.webmanifest", "lib/webpush.js", "lib/aidedupe.js", "lib/design.js", "views/workspace.js", "views/wsextra.js", "views/wsevents.js", "views/wsproject.js", "views/public.js", "views/users.js", "icons/cube.svg", "views/legal.js", "views/connections.js",
  "lib/web.js", "views/web.js", "views/status.js", "lib/assistant.js", "lib/upgrade.js", "lib/sync.js", "lib/viewmode.js", "lib/hosting.js", "views/hosting.js", "lib/devfiles.js", "lib/nextup.js", "views/tasks.js", "views/door.js", "views/links.js", "views/security.js", "views/help.js",
  "icons/icon.svg", "icons/icon-192.png", "icons/apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  // Neue Version wartet, bis der Nutzer „Neu laden“ tippt (kein Neuladen mitten in der Arbeit)
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: "reload" })))));
});
self.addEventListener("message", (e) => { if (e.data === "skipWaiting") self.skipWaiting(); });
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  // Supabase/APIs immer live; nur eigene Dateien und die supabase-js-Bibliothek cachen
  if (url.origin === location.origin) {
    // Netzwerk zuerst (immer aktuell), Cache als Offline-Rückfall
    // „no-cache“: Browser fragt immer nach, ob es eine neuere Version gibt (sonst bis zu 10 Min. alte Dateien)
    e.respondWith(fetch(e.request, { cache: "no-cache" }).then((r) => {
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

// ---------- Web-Push (Benachrichtigungen direkt vom Nexus, ohne ntfy) ----------
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch { d = { title: "JOPML Nexus", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "JOPML Nexus", {
    body: d.body || "", icon: "icons/icon-192.png", badge: "icons/icon-192.png", tag: d.tag, data: { url: d.url || "./" },
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "./";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if ("focus" in c) { c.navigate?.(url); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
