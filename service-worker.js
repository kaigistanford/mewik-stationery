// ============================================================
//  MEWIK STATIONERY — Service Worker
//  Caches core app shell for offline access
// ============================================================

const CACHE_NAME = 'mewik-v1.0.0';

const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './login.html',
  './signup.html',
  './dashboard.html',
  './admin.html',
  './services.html',
  './css/style.css',
  './js/app.js',
  './js/auth.js',
  './js/dashboard.js',
  './js/admin.js',
  './js/notifications.js',
  './manifest.json',
  './icons/favicon.svg',
  // Google Fonts (cached on first load)
  'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500;600&family=DM+Mono:wght@400;500&display=swap',
];

// ── Install ────────────────────────────────────────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE.map(url => new Request(url, { cache: 'reload' })));
    }).catch(err => {
      console.warn('[SW] Cache failed for some assets:', err);
    })
  );
  self.skipWaiting();
});

// ── Activate ───────────────────────────────────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch Strategy: Cache First, Network Fallback ──────────────
self.addEventListener('fetch', event => {
  // Skip non-GET and cross-origin API calls
  if (event.request.method !== 'GET') return;
  if (event.request.url.startsWith('chrome-extension://')) return;

  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;

      return fetch(event.request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for HTML pages
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('./index.html');
        }
      });
    })
  );
});
