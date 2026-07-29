// Service Worker for NIPDA BPMS PWA Installability
const CACHE_NAME = 'nipda-bpms-v1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
  // Pass network requests through normally
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});