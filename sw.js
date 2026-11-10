/* SpaceNet SW 4435 — one entity. Tree lock. */
var CACHE = "sn-shell-4435";
var VER = "4435";
/* 4435: do not include /index.html — Vercel 308s it to /, and cache.addAll aborts the whole shell. */
var SHELL = ["/", "/js/spacenet/app.js?v=4435", "/js/spacenet/auth.js?v=4435", "/js/vendor/leaflet.js?v=4435", "/js/vendor/leaflet.css?v=4435", "/icon-192.png", "/manifest.webmanifest"];
function allowedScript(path) {
  if (path === "/js/spacenet/app.js" || path === "/js/spacenet/auth.js" || path === "/js/vendor/leaflet.js") return true;
  return false;
}
function isOverlay(path) {
  if (!/^\/js\/spacenet\//.test(path)) return false;
  if (!/\.m?js$/i.test(path)) return false;
  if (allowedScript(path)) return false;
  return true;
}
function fillCache() {
  return caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(u, { cache: "reload", credentials: "same-origin", redirect: "follow" }).then(function (res) {
        if (!res || !res.ok) return 0;
        return c.put(u, res).then(function () { return 1; });
      }).catch(function () { return 0; });
    })).then(function (ns) {
      var n = 0;
      for (var i = 0; i < ns.length; i++) n += ns[i];
      /* offline fallback looks up /index.html — store the / body under that key, never a 308 */
      return c.match("/").then(function (res) {
        if (!res) return n;
        return c.put("/index.html", res.clone()).then(function () { return n + 1; });
      }).catch(function () { return n; });
    });
  });
}
self.addEventListener("install", function (e) {
  e.waitUntil(fillCache().then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      /* 4435: delete old shells only — never the current cache */
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return fillCache(); }).then(function (n) {
      return self.clients.claim().then(function () { return n; });
    }).then(function (n) {
      return self.clients.matchAll({ type: "window" }).then(function (clients) {
        clients.forEach(function (c) {
          try { c.postMessage({ type: "sn-sw", ver: VER, cache: CACHE, entries: n }); } catch (err) {}
        });
      });
    })
  );
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname === "/sw.js") { e.respondWith(fetch(e.request, { cache: "reload" })); return; }
  if (isOverlay(url.pathname)) {
    e.respondWith(new Response("/* TREE LOCK 4435: overlay blocked */", { headers: { "Content-Type": "application/javascript" }, status: 200 }));
    return;
  }
  if (e.request.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html") {
    e.respondWith(fetch(e.request, { cache: "no-store" }).catch(function () { return caches.open(CACHE).then(function (c) { return c.match("/").then(function (r) { return r || c.match("/index.html"); }); }); }));
    return;
  }
  var pv = /[?&]v=(\d{4,})/.exec(url.search);
  if (pv && Number(pv[1]) > Number(VER)) { e.respondWith(fetch(e.request, { cache: "no-store" })); return; }
  e.respondWith(fetch(e.request).then(function (res) {
    if (res && res.ok && e.request.method === "GET") {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
    }
    return res;
  }).catch(function () { return caches.open(CACHE).then(function (c) { return c.match(e.request); }); }));
});
