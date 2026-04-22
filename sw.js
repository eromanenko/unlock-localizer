/**
 * sw.js — Service Worker (Vanilla JS, Cache First strategy)
 *
 * Caches:
 *  - App shell (HTML, CSS, JS, manifest)
 *  - Game data JSONs (assets/GameData/**)
 *  - UI images: covers, icons (NOT _fond.jpg backgrounds)
 *
 * Excludes:
 *  - assets/Skins/*_fond.jpg  (too large; loads over network)
 */

const VERSION = 0.5

const CACHE_NAME = `unlock-helper-v${VERSION}`;

const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './js/i18n.js',
  './js/catalog.js',
  './js/game.js',
  './js/modal.js',
  './js/version.js',
  './manifest.webmanifest',
  './assets/GameData/Unlock.json',
  './assets/GameData/descriptions.json',
  // Global UI locales
  './assets/GameData/Locale/English/locale.json',
  './assets/GameData/Locale/French/locale.json',
  './assets/GameData/Locale/Ukrainian/locale.json',
  './assets/GameData/Locale/Russian/locale.json',
];

/* ── Install: precache shell ───────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

/* ── Activate: clean old caches ────────────────────────────── */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys
        .filter(k => k !== CACHE_NAME)
        .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: Cache First, with exclusion for backgrounds ─────── */
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Never cache fond backgrounds
  if (url.includes('_fond.jpg')) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first strategy for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache successful GET requests
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }
        const cloned = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        return response;
      }).catch(() => {
        // Offline fallback for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return new Response('', { status: 503 });
      });
    })
  );
});
