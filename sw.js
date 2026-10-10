/* SpaceNet SW 4340. Network first. Old shells are deleted so a stuck phone reloads. */
var VER = "4340";
function allowedScript(path) {
  return path === "/js/spacenet/app.js" || path === "/js/spacenet/auth.js" || path === "/js/vendor/leaflet.js";
}
function isOverlay(path) {
  if (!/^\/js\/spacenet\//.test(path)) return false;
  return !allowedScript(path);
}
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }).then(function () {
    return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (list) {
      list.forEach(function (c) {
        var next = "/?v=" + VER + "&t=" + Date.now();
        try { if (c.navigate) c.navigate(next); } catch (err) {}
      });
    });
  }));
});
self.addEventListener("fetch", function (e) {
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;
  if (isOverlay(url.pathname)) {
    e.respondWith(new Response("/* overlay blocked */", { status: 200, headers: { "Content-Type": "application/javascript" } }));
    return;
  }
  var fresh = e.request.mode === "navigate" || url.pathname === "/" || url.pathname === "/index.html" || url.pathname === "/sw.js" || url.pathname.indexOf("/api/") === 0 || url.pathname.indexOf("/js/spacenet/") === 0;
  if (fresh) {
    e.respondWith(fetch(new Request(e.request, { cache: "no-store" })));
    return;
  }
  e.respondWith(fetch(e.request).catch(function () { return caches.match(e.request); }));
});
