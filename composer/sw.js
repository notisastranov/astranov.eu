/* Astranov service worker — versioned PWA shell; network-first for app HTML */
const BUILD_ID = '20260706094838';
const CACHE = 'astranov-' + BUILD_ID;
const SHELL = ['/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppHtml(url) {
  return url.pathname === '/' || url.pathname === '/index.html';
}

function isVolatile(url) {
  return isAppHtml(url)
    || url.pathname === '/sw.js'
    || url.pathname === '/build.json'
    || url.pathname === '/coders-labs.json'
    || url.pathname === '/astranov-deferred.js';
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (isVolatile(url)) {
    e.respondWith(
      fetch(e.request).then(res => {
        if (res.ok && isAppHtml(url)) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => caches.match(e.request))
    );
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