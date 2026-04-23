/**
 * sw.js — Service Worker (Vanilla JS, Cache First strategy)
 *
 * Caches:
 *  - App shell (HTML, CSS, JS, manifest, branding)
 *  - Game data JSONs (from CDN)
 *
 * Excludes:
 *  - ALL images (covers, icons, backgrounds)
 */

const VERSION = 0.8;
const CACHE_NAME = `unlock-helper-v${VERSION}`;
const CDN_BASE = 'https://raw.githubusercontent.com/gamepage-web/unssets/main/';

const PRECACHE = [
  './',
  './index.html',
  './css/style.css',
  './js/config.js',
  './js/app.js',
  './js/i18n.js',
  './js/catalog.js',
  './js/game.js',
  './js/modal.js',
  './js/version.js',
  './manifest.webmanifest',
  './branding/logo.svg',
  // Data from CDN
  `${CDN_BASE}GameData/Unlock.json`,
  `${CDN_BASE}GameData/descriptions.json`,
  `${CDN_BASE}GameData/Locale/English/locale.json`,
  `${CDN_BASE}GameData/Locale/French/locale.json`,
  `${CDN_BASE}GameData/Locale/Ukrainian/locale.json`,
  `${CDN_BASE}GameData/Locale/Russian/locale.json`,
];

/* ── Install: precache shell & data ────────────────────────── */
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

/* ── Fetch: Cache First for Shell/JSON, Network for Images ──── */
self.addEventListener('fetch', event => {
  const url = event.request.url;
  const isImage = /\.(png|jpg|jpeg|svg|webp)$/i.test(url) && !url.includes('branding/');

  // Never cache images (except app branding)
  if (isImage) {
    event.respondWith(fetch(event.request).catch(() => new Response('', { status: 503 })));
    return;
  }

  // Cache-first strategy for everything else (Shell, JS, JSON)
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        // Only cache successful GET requests
        if (!response || response.status !== 200 || event.request.method !== 'GET') {
          return response;
        }

        // Only cache if it's our origin or the CDN
        const isCdn = url.startsWith(CDN_BASE);
        const isLocal = url.startsWith(self.location.origin);

        if (isLocal || isCdn) {
          const cloned = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, cloned));
        }

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
