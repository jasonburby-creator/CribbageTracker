// Skunk Life service worker — makes the installed app open and show recent
// data without a connection (airplane mode). Live score writes still need a
// connection to sync; only photo uploads are queued offline (see uploadQueue).

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

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return; // never interfere with writes/uploads

  const url = new URL(req.url);

  // Supabase REST reads (trips/games) — serve cached copy instantly, refresh in
  // the background so the app has data offline. Storage/auth/realtime pass through.
  if (url.hostname.endsWith("supabase.co")) {
    if (url.pathname.startsWith("/rest/")) {
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
