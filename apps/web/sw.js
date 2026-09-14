const CACHE_NAME = 'weather-shell-v48';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/assets/app.css',
  '/assets/app.js',
  '/assets/analytics.js',
  '/assets/charts.js',
  '/assets/components.js',
  '/assets/forecast-view.js',
  '/assets/i18n.js',
  '/assets/generated/i18n.js',
  '/assets/location-state.js',
  '/assets/route-state.js',
  '/assets/temperature-scale.js',
  '/assets/weather-demo.js',
  '/assets/dinpanel-logo-dark.png',
  '/assets/dinpanel-logo-light.png',
  '/assets/dinpanel-logo-square.png',
  '/assets/dinpanel-workbench.webp',
  '/assets/favicon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith(fetch(event.request).then(response => {
    const copy = response.clone();
    if (response.ok && new URL(event.request.url).origin === self.location.origin) {
      caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
    }
    return response;
  }).catch(() => caches.match(event.request).then(response => response || caches.match('/index.html'))));
});
