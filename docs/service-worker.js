// Minimal offline shell cache. Caches app files; never caches API calls.
const CACHE = 'readyreads-v1';
const ASSETS = [
  './', './index.html', './styles.css', './manifest.webmanifest', './icon.svg',
  './js/app.js', './js/goodreads.js', './js/overdrive.js',
  './js/sort.js', './js/store.js', './js/render.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  const url = new URL(request.url);
  // Only handle our own same-origin GETs; let fonts/OverDrive/proxy hit the network.
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(request).then(hit => hit || fetch(request).then(resp => {
      const copy = resp.clone();
      caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
      return resp;
    }).catch(() => caches.match('./index.html')))
  );
});
