const CACHE_NAME = 'verralux-erp-v1';
const ASSETS = [
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/db.js',
  './js/utils.js',
  './js/ui.js',
  './js/dashboard.js',
  './js/inventory.js',
  './js/purchases.js',
  './js/sales.js',
  './js/expenses.js',
  './js/payments.js',
  './js/assets.js',
  './js/reports.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(res => {
      const resClone = res.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, resClone));
      return res;
    }).catch(() => cached))
  );
});
