// ATPL Viva: offline service worker
// Network-first for the app page (so you always get the latest build when
// online), falling back to the cached copy whenever the network is
// unavailable. Everything the app needs (HTML/CSS/JS/data) lives in one
// file, so caching that one file is enough for full offline use.

const CACHE_VERSION = 'dd5aac89b3';
const CACHE_NAME = 'atplviva-' + CACHE_VERSION;

// Cache the page itself under both its real URL and the scope root, so a
// reload works whether it was opened as ".../index.html" or just ".../".
const APP_URL = self.registration.scope; // e.g. https://user.github.io/repo/
const PRECACHE_URLS = [
  APP_URL,
  APP_URL + 'index.html',
  APP_URL + 'data.js',
  APP_URL + 'ref.js',
  APP_URL + 'nosleep.mp4',
  APP_URL + 'manifest.json',
  APP_URL + 'icon-192.png',
  APP_URL + 'icon-512.png',
  APP_URL + 'apple-touch-icon.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map((url) =>
          fetch(url, { cache: 'no-cache' })
            .then((res) => (res.ok ? cache.put(url, res) : null))
            .catch(() => null)
        )
      )
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Only handle same-origin requests (this app has no external assets, but
  // stay safe if it's ever extended).
  if (new URL(req.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        // Stash a fresh copy for next time we're offline.
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          // Navigating (e.g. reloading the page) while offline and this
          // exact URL was never cached: fall back to the cached app shell.
          if (req.mode === 'navigate') {
            return caches.match(APP_URL + 'index.html').then(
              (fallback) => fallback || caches.match(APP_URL)
            );
          }
          return undefined;
        })
      )
  );
});
