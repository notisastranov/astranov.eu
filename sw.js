/* SpaceNet SW 4421 — one entity. Tree lock. */
var CACHE = "sn-shell-4421";
var VER = "4421";
var SHELL = ["/", "/index.html", "/js/spacenet/app.js?v=4421", "/js/spacenet/auth.js?v=4421", "/js/vendor/leaflet.js?v=4421", "/js/vendor/leaflet.css?v=4421", "/icon-192.png", "/manifest.webmanifest"];
function allowedScript(path) {
  return /\/js\/(spacenet\/(app|auth)|vendor\/leaflet)\.js/.test(path);
}
self.addEventListener("install", function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});
self.addEventListener("fetch", function (e) {
  var u = new URL(e.request.url);
  if (e.request.method !== "GET") return;
  if (u.origin !== self.location.origin) return;
  if (/\/api\//.test(u.pathname)) return;
  e.respondWith(fetch(e.request).then(function (r) {
    if (r && r.ok && (u.pathname === "/" || u.pathname === "/index.html" || allowedScript(u.pathname) || /\.css$/.test(u.pathname))) {
      var copy = r.clone();
      caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
    }
    return r;
  }).catch(function () { return caches.match(e.request); }));
});
