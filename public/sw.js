/**
 * Columbina Standalone PWA Service Worker
 * Standalone Android PWA installation compliance, shell lifecycle,
 * and pure live-network pass-through for Gemini, Firebase, TTS, and APIs.
 */

const CACHE_NAME = 'columbina-shell-v2';
const PRECACHE_ASSETS = [
  '/',
  '/manifest.webmanifest',
  '/manifest.json',
  '/icon.svg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
];

// Immediate installation & skip waiting to take effect immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(PRECACHE_ASSETS).catch((err) => {
          console.warn('[Columbina SW] Shell pre-cache non-blocking notice:', err);
        });
      })
  );
});

// Activate immediately and claim all open clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      self.clients.claim(),
      caches.keys().then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          })
        );
      }),
    ])
  );
});

// Live network handler: NEVER intercept or cache APIs, Gemini streaming, Firebase, or TTS
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1. All non-GET methods (POST, PUT, DELETE) bypass service worker
  if (req.method !== 'GET') {
    return;
  }

  // 2. All backend API calls (/api/*, Gemini, TTS, Firebase, WebSockets, model proxy) bypass service worker
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('googleapis.com') ||
    url.hostname.includes('firebaseio.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('google') ||
    url.pathname.endsWith('.vrm')
  ) {
    // Pure live-network pass-through
    return;
  }

  // 3. Page navigation: Always attempt live network first to ensure live website functionality
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => {
        return caches.match('/') || caches.match('/index.html');
      })
    );
    return;
  }

  // 4. Static assets: Network-first with cache fallback
  event.respondWith(
    fetch(req)
      .then((response) => {
        // Only cache valid basic same-origin 200 responses
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(req, responseToCache).catch(() => {});
          });
        }
        return response;
      })
      .catch(() => {
        return caches.match(req);
      })
  );
});
