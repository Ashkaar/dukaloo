// Dukaloo service worker: keeps the till working without a connection.
//
// - Page loads: network first; else the copy from the last online visit
//   (components/offline-sync.tsx warms every screen the login can open);
//   else /offline.html. Next.js falls back to a full page load when a
//   client-side navigation fails offline, so that load lands here too.
// - App files (/_next/static/…): cache first. Their names change with every
//   deploy, so a cached file is never stale.
// - Data reads (GET /api/…): network first, else the last copy, so the
//   till's products, prices and stock still load.
// - Writes (POST…) are never cached: the screens put them in an outbox
//   (lib/outbox.ts) and send them when the connection is back.
// - Signing out tells the worker to forget saved pages and data, so the
//   next person on a shared till can't see them.
//
// Bump VERSION to drop everything cached by an older worker.

const VERSION = "dukaloo-v3";
const OFFLINE_PAGE = "/offline.html";
const PAGES = `${VERSION}-pages`;
const ASSETS = `${VERSION}-assets`;
const DATA = `${VERSION}-data`;
// Product photos: each version has its own address, so once kept it is good.
const PHOTOS = `${VERSION}-photos`;
const MAX_PHOTOS = 1500;
const MAX_ASSETS = 500;
const MAX_DATA = 200;

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(PAGES);
      await cache.add(OFFLINE_PAGE).catch(() => {});
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((n) => !n.startsWith(VERSION)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })(),
  );
});

async function trim(cache, max) {
  const keys = await cache.keys();
  if (keys.length > max) await Promise.all(keys.slice(0, keys.length - max).map((k) => cache.delete(k)));
}

// Only real pages for a signed-in user are worth keeping (not a redirect to
// the sign-in page, not an error).
const keepable = (response) => response.ok && !response.redirected && (response.headers.get("content-type") || "").includes("text/html");

async function page(request) {
  const url = new URL(request.url);
  const key = url.origin + url.pathname;
  const cache = await caches.open(PAGES);
  try {
    const response = await fetch(request);
    if (keepable(response)) await cache.put(key, response.clone());
    return response;
  } catch {
    return (await cache.match(key)) || (await cache.match(OFFLINE_PAGE)) || Response.error();
  }
}

async function asset(request) {
  const cache = await caches.open(ASSETS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(cache, MAX_ASSETS);
  }
  return response;
}

async function photo(request) {
  const cache = await caches.open(PHOTOS);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    await cache.put(request, response.clone());
    trim(cache, MAX_PHOTOS);
  }
  return response;
}

async function data(request) {
  const cache = await caches.open(DATA);
  try {
    const response = await fetch(request);
    if (response.ok) {
      await cache.put(request, response.clone());
      trim(cache, MAX_DATA);
    }
    return response;
  } catch (err) {
    const hit = await cache.match(request);
    if (hit) return hit;
    throw err;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/_next/static/") || /\.(png|svg|ico|woff2?)$/.test(url.pathname)) {
    event.respondWith(asset(request));
    return;
  }
  if (/\/api\/products\/\d+\/image$/.test(url.pathname)) {
    event.respondWith(photo(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(page(request));
    return;
  }
  // Data reads; never sign-in, backups or Next.js's own page payloads.
  if (/\/api\//.test(url.pathname) && !/\/api\/(auth|backup|unlock|owner-password)/.test(url.pathname) && !request.headers.get("RSC")) {
    event.respondWith(data(request));
  }
});

self.addEventListener("message", (event) => {
  const msg = event.data || {};
  if (msg.type === "warm" && Array.isArray(msg.urls)) {
    // Fetch each screen now, while online, so it opens offline later.
    event.waitUntil(
      (async () => {
        const cache = await caches.open(PAGES);
        for (const href of msg.urls.slice(0, 30)) {
          try {
            const url = new URL(href, self.location.origin);
            if (url.origin !== self.location.origin) continue;
            const response = await fetch(url, { credentials: "same-origin", headers: { Accept: "text/html" } });
            if (!keepable(response)) continue;
            const html = await response.clone().text();
            await cache.put(url.origin + url.pathname, response);
            // And the app files that screen needs, so it works offline even
            // if it was never opened before.
            const files = [...new Set(html.match(/\/_next\/static\/[^"'\s)]+/g) || [])];
            const assets = await caches.open(ASSETS);
            for (const file of files) {
              if (!(await assets.match(file))) await asset(new Request(file)).catch(() => {});
            }
          } catch {
            // Offline or failed: try again on the next visit.
          }
        }
      })(),
    );
  }
  if (msg.type === "forget") {
    event.waitUntil(Promise.all([caches.delete(PAGES), caches.delete(DATA)]).then(() => caches.open(PAGES).then((c) => c.add(OFFLINE_PAGE).catch(() => {}))));
  }
});
