const CACHE_VERSION = 'polly-v1';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const RUNTIME_CACHE = `${CACHE_VERSION}-runtime`;
const OFFLINE_URL = '/offline.html';

const APP_SHELL = [
  OFFLINE_URL,
  '/favicon.ico',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(APP_SHELL_CACHE)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => !key.startsWith(CACHE_VERSION))
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  // Never cache API, websocket, or user uploads. The web manifest is
  // intentionally skipped too: it's branding-driven and re-rendered server-side
  // on every admin change, so we let the HTTP `Cache-Control: max-age=300`
  // header own its freshness rather than holding it in the SW cache.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/ws') ||
    url.pathname === '/site.webmanifest' ||
    url.pathname.startsWith('/uploads/')
  ) {
    return;
  }

  // Navigation requests: network-first with cached app-shell fallback, then
  // the static offline page as a last resort. This lets the installed PWA
  // boot from the last-good HTML shell when the network is unreachable
  // (e.g. on a flaky train connection) instead of going straight to the
  // offline placeholder.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(RUNTIME_CACHE).then((cache) => cache.put('/', copy));
          }
          return response;
        })
        .catch(async () => {
          const shell = await caches.match('/');
          return shell || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Static assets: stale-while-revalidate.
  if (
    url.pathname.startsWith('/assets/') ||
    /\.(?:js|css|png|jpg|jpeg|svg|ico|woff2?)$/i.test(url.pathname)
  ) {
    event.respondWith(
      caches.open(RUNTIME_CACHE).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached || network;
      })
    );
  }
});
