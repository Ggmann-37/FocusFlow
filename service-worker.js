const CACHE_NAME = 'focusflow-v1';
const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.json',
  '/assets/logo-focusflow.svg'
];

// Install event: precache resources
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache).catch(err => {
        console.log('Cache addAll error:', err);
        // Fallback: cache what we can
        return Promise.resolve();
      });
    })
  );
  self.skipWaiting();
});

// Activate event: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      );
    })
  );
  self.clients.claim();
});

// Fetch event: cache first, fallback to network
self.addEventListener('fetch', event => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') {
    return;
  }

  // Skip external CDNs and Supabase (let them go to network first)
  const url = new URL(event.request.url);
  if (
    url.hostname.includes('cdn.tailwindcss.com') ||
    url.hostname.includes('challenges.cloudflare.com') ||
    url.hostname.includes('supabase') ||
    url.hostname.includes('jsondiff.com')
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(response => {
      // Return cached response if exists
      if (response) {
        return response;
      }

      // Otherwise fetch from network
      return fetch(event.request).then(response => {
        // Don't cache if response is not ok
        if (!response || response.status !== 200) {
          return response;
        }

        // Clone response for caching
        const responseToCache = response.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return response;
      }).catch(() => {
        // Fallback: return offline page or cached response
        return caches.match('/index.html');
      });
    })
  );
});
