const CACHE_NAME = 'workout-tracker-cache-v3';
const FILES_TO_CACHE = [
  './index.html',
  './historyTab.html',
  './graphsTab.html',
  './developerTab.html',
  './manifest.json',
  './assets/fitness_center.png',
  './assets/font/materialIconsFont.woff2',
  './libs/chartjs/chart.js',
  './app.js',
  './styles.css'
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

// Activate service worker and clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Serve cached files when offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
