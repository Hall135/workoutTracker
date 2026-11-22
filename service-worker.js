const CACHE_PREFIX = 'workout-tracker-cache-';
const CACHE_NAME = CACHE_PREFIX + 'v6';
const FILES_TO_CACHE = [
  './index.html',
  './historyTab.html',
  './graphsTab.html',
  './developerTab.html',
  './manifest.json',
  './assets/fitness_center.png',
  './assets/font/materialIconsFont.woff2',
  './libs/chartjs/chart.js',
  './js/storage.js',
  './js/dataTransfer.js',
  './js/app.js',
  './css/styles.css'
];

// Install service worker and cache app files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(FILES_TO_CACHE);
    })
  );
  self.skipWaiting();
});

// Remove only this app's older caches before claiming clients.
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(async cacheNames => {
      const oldCaches = cacheNames.filter(name =>
        name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME
      );
      await Promise.all(oldCaches.map(name => caches.delete(name)));
      await self.clients.claim();
    })
  );
});

// Serve cached files when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});