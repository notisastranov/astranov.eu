/* SpaceNet SW 4407 — one entity. Tree lock. */
var CACHE = "sn-shell-4407";
var VER = "4407";
var SHELL = ["/", "/index.html", "/js/spacenet/app.js?v=4407", "/js/spacenet/auth.js?v=4407", "/js/vendor/leaflet.js?v=4407", "/js/vendor/leaflet.css?v=4407", "/icon-192.png", "/manifest.webmanifest"];
function allowedScript(path) {
  if (path === "/js/spacenet/app.js" || path === "/js/spacenet/auth.js" || path === "/js/vendor/leaflet.js") return true;
  return false;
}
function isOverlay(path) {
  if (!/^\/js\/spacenet\//.test(path)) return false;
  if (!/\.m?js$/i.test(path)) return false; /* 4377: only scripts are overlays; robots/*.jpg and other assets pass */
  if (allowedScript(path)) return false;
  return true;
}
self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) {
    return c.addAll(SHELL.map(function (u) { return new Request(u, { cache: "reload" }); })).catch(function () {});
  }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }).then(function () {
      return self.clients.matchAll({ type: "window" }).then(function (clients) {
        /* never navigate a running page (mid-run &t= reload): tell it the version, the page decides */
        clients.forEach(function (c) {
          try { c.postMessage({ type: "sn-sw", ver: VER }); } catch (err) {}
        });
      });
    })
  );
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (isOverlay(url.pathname)) {
    e.respondWith(new Response("/* TREE LOCK 4407: overlay blocked */", { headers: { "Content-Type": "application/javascript" }, status: 200 }));
    return;
  }
  if (e.request.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html") {
    /* 4393: offline fallback only from this worker's own shell (same build), never another cache */
    e.respondWith(fetch(e.request, { cache: "no-store" }).catch(function () { return caches.open(CACHE).then(function (c) { return c.match("/index.html"); }); }));
    return;
  }
  /* 4393: a page newer than this worker (its ?v= above VER) is never answered from cache: network only, so the worker can
     never hand a page an older build */
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
