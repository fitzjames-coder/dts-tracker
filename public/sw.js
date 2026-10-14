/* DTS Tracker service worker — offline support that still lets new deploys
 * reach installed phones.
 *
 * - Navigations and /index.html: network-first (so a new deploy wins),
 *   falling back to the cached shell when offline.
 * - /assets/* (Vite's content-hashed files): cache-first, filled on first use.
 * - Other same-origin requests (manifest, icons): network-first, cache fallback.
 * - /sw.js is never cached.
 *
 * The app itself makes no network calls; this worker only serves and fills
 * the cache. */

const CACHE = 'dts-shell-v2';
const SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting())
      .catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

function putInCache(req, res) {
  if (res && res.status === 200 && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then((cache) => cache.put(req, copy));
  }
}

// Network-first: try the network, cache a fresh copy, fall back to cache.
async function networkFirst(req, fallbackPath) {
  try {
    const res = await fetch(req);
    putInCache(req, res);
    return res;
  } catch {
    const cached = await caches.match(req);
    if (cached) return cached;
    if (fallbackPath) {
      const fb = await caches.match(fallbackPath);
      if (fb) return fb;
    }
    return Response.error();
  }
}

// Cache-first: serve from cache, otherwise fetch and fill the cache.
async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  putInCache(req, res);
  return res;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Never cache the service worker itself.
  if (url.pathname === '/sw.js') return;

  // Navigations and the app shell: network-first, offline shell fallback.
  if (req.mode === 'navigate' || url.pathname === '/index.html') {
    event.respondWith(networkFirst(req, '/index.html'));
    return;
  }

  // Hashed build assets: cache-first (content hash makes them immutable).
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirst(req));
    return;
  }

  // Everything else same-origin (manifest, icons, …): network-first.
  event.respondWith(networkFirst(req));
});
