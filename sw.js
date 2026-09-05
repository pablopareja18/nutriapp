// sw.js — app shell cache-first, versionado. Sube CACHE_VERSION al cambiar cualquier archivo.
const CACHE_VERSION = 'nutriapp-v1';
const SHELL = [
  './', './index.html', './styles.css', './manifest.webmanifest',
  './js/app.js', './js/calc.js', './js/store.js', './js/charts.js', './js/ui.js',
  './js/ui-hoy.js', './js/ui-perfil.js', './js/ui-recetas.js', './js/ui-suplementos.js', './js/ui-ajustes.js',
  './js/recetas-api.js', './js/suplementos-data.js',
  './icons/icon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // La API de Anthropic y cualquier origen externo van siempre a la red (nunca se cachean).
  if (url.origin !== self.location.origin || e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).then((res) => {
      if (res.ok) caches.open(CACHE_VERSION).then((c) => c.put(e.request, res.clone()));
      return res;
    }).catch(() => (e.request.mode === 'navigate' ? caches.match('./index.html') : undefined))),
  );
});
