// Skunk Life service worker — makes the installed app open and show recent
// data without a connection (airplane mode). Live score writes still need a
// connection to sync; only photo uploads are queued offline (see uploadQueue).
//
// This cache is a coarse, best-effort secondary layer, not the app's real
// offline mechanism for page data — that's lib/offlineCache.ts (localStorage,
// caching the already-parsed trips/games result). This cache is keyed by the
// exact request URL, so it quietly orphans itself every time a page's
// select() column list changes, and it has no concept of who's signed in
// (see the email guard below) — lib/offlineCache.ts has neither problem.
// Keep both: this one is what makes a cold, never-opened-before load work
// offline too, which localStorage alone can't do.

const CACHE = "skunklife-v2";
const APP_SHELL = ["/", "/archive", "/manifest.json", "/icon-192.png", "/icon-512.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(APP_SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function staleWhileRevalidate(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  const network = fetch(req)
    .then((res) => {
      if (res && res.ok) cache.put(req, res.clone());
      return res;
    })
    .catch(() => null);
  return cached || (await network) || new Response(null, { status: 504 });
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match("/")) || new Response(null, { status: 504 });
  }
}

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(req);
  if (cached) return cached;
  try {
    const res = await fetch(req);
    if (res && res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return new Response(null, { status: 504 });
  }
}

// Push notifications for online games ("it's your turn") — see lib/push.ts
// (server side, sends these) and lib/pushClient.ts (subscribes this device).
self.addEventListener("push", (event) => {
  let payload = { title: "Skunk Life", body: "", url: "/" };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    if (event.data) payload.body = event.data.text();
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      data: { url: payload.url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never interfere with writes/uploads

  const url = new URL(req.url);

  // Supabase REST reads (trips/games) — serve cached copy instantly, refresh in
  // the background so the app has data offline. Storage/auth/realtime pass through.
  if (url.hostname.endsWith("supabase.co")) {
    if (url.pathname.startsWith("/rest/")) {
      // Guardrail: this cache is keyed by URL only, with no idea who's
      // signed in — never persist a response that could carry the `email`
      // column (the only field in this app that's authenticated-only), or a
      // stale entry could get served back to a different session later.
      // Whoever adds the next authenticated-only field should extend this.
      const hasEmail =
        url.searchParams.get("select")?.includes("email") || url.searchParams.has("email");
      if (hasEmail) return; // passthrough — always hits the network directly
      event.respondWith(staleWhileRevalidate(req));
    }
    return;
  }

  if (url.origin === self.location.origin) {
    if (req.mode === "navigate") {
      event.respondWith(networkFirst(req));
    } else {
      event.respondWith(cacheFirst(req)); // hashed _next assets, icons, etc.
    }
  }
});
