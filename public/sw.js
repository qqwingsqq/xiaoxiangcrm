// Service Worker for 小象智能 CRM PWA
const CACHE_NAME = 'xz-crm-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(self.clients.claim()));

// Network-first strategy (always fresh data for CRM)
self.addEventListener('fetch', event => {
  if (event.request.url.includes('/api/')) return; // Skip caching API calls
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
