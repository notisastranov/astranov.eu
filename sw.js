/* SpaceNet SW 4284 — one entity. Tree lock. */
var CACHE = "sn-shell-4284";
var VER = "4284";
var SHELL = ["/", "/index.html", "/js/spacenet/app.js?v=4284", "/js/spacenet/auth.js?v=4284", "/js/vendor/leaflet.js?v=4127", "/js/vendor/leaflet.css?v=4127", "/icon-192.png", "/manifest.webmanifest"];
function allowedScript(path) {
  if (path === "/js/spacenet/app.js" || path === "/js/spacenet/auth.js" || path === "/js/vendor/leaflet.js") return true;
  return false;
}
function isOverlay(path) {
  if (!/^\/js\/spacenet\//.test(path)) return false;
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
        clients.forEach(function (c) {
          try { c.navigate("/?v=" + VER + "&t=" + Date.now()); } catch (err) {}
        });
      });
    })
  );
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (isOverlay(url.pathname)) {
    e.respondWith(new Response("/* TREE LOCK 4284: overlay blocked */", { headers: { "Content-Type": "application/javascript" }, status: 200 }));
    return;
  }
  if (e.request.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html") {
    e.respondWith(fetch(e.request, { cache: "no-store" }).catch(function () { return caches.match("/index.html"); }));
    return;
  }
  e.respondWith(fetch(e.request).then(function (res) {
    if (res && res.ok && e.request.method === "GET") {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); }).catch(function () {});
    }
    return res;
  }).catch(function () { return caches.match(e.request); }));
});
