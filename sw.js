const CACHE_VERSION = 'focusflow-v2';
const APP_SHELL = [
  '/FocusFlow/',
  '/FocusFlow/index.html',
  '/FocusFlow/app.js',
  '/FocusFlow/styles.css',
  '/FocusFlow/manifest.json',
  '/FocusFlow/assets/logo-focusflow.svg',
  '/FocusFlow/assets/icon-192.svg',
  '/FocusFlow/assets/icon-512.svg',
  '/FocusFlow/assets/maskable-icon-192.svg',
  '/FocusFlow/assets/maskable-icon-512.svg',
  '/FocusFlow/assets/apple-touch-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const requestUrl = new URL(request.url);
  const isNavigation = request.mode === 'navigate';
  const isSameOriginAsset = requestUrl.origin === self.location.origin && requestUrl.pathname.startsWith('/FocusFlow/');

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put('/FocusFlow/', copy));
          return response;
        })
        .catch(() => caches.match('/FocusFlow/index.html').then((cached) => cached || caches.match('/FocusFlow/')))
    );
    return;
  }

  if (isSameOriginAsset) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
        }
        return response;
      }))
    );
  }
});
