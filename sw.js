/* Astranov service worker — never serve stale app HTML/core */
const CACHE = 'astranov-v29';
const SHELL = ['/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppHtml(url) {
  return url.pathname === '/' || url.pathname === '/index.html';
}

function isCoreJs(url) {
  return url.pathname === '/astranov-app.js' || url.pathname === '/astranov-gl.js' || url.pathname === '/astranov-core.js';
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (isAppHtml(url) || isCoreJs(url)) {
    e.respondWith(fetch(e.request));
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => cached || fetch(e.request).then(res => {
      if (res.ok && url.pathname.endsWith('.html')) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => cached))
  );
});