/**
 * Service Worker Gym Log Standalone: Offline-First with Pre-Cache & Auto-Claim
 */
const CACHE_NAME = 'gym-log-standalone-v22';
const PRECACHE_ASSETS = [
  './',
  './index.html',
  './db.js?v=22',
  './backup.js?v=22',
  './default-exercises.json?v=2',
  './manifest.json',
  './icon-192.svg',
  './icon-512.svg',
  './tung.png?v=12'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    fetch(req)
      .then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const resClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(req, { ignoreSearch: true }))
  );
});
