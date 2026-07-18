/* Astranov service worker — network-first app shell + /js phases (never stale monolith) */
const CACHE = 'astranov-v20260718070612';
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

function isLive(url) {
  const p = url.pathname;
  // Always hit network for app code — multi-file + phase bundles change often
  if (p === '/' || p === '/index.html') return true;
  if (p.startsWith('/js/')) return true;
  if (p.startsWith('/astranov-') && p.endsWith('.js')) return true;
  if (p === '/build.json' || p === '/sw.js') return true;
  return false;
}

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin) return;

  if (isLive(url)) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached => {
      const net = fetch(e.request).then(res => {
        if (res.ok && (url.pathname.endsWith('.svg') || url.pathname.endsWith('.webmanifest'))) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || net;
    })
  );
});
