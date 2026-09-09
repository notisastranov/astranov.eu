/* SpaceNet SW 4237 — network-first. skipWaiting + clients.claim. */
var CACHE = "sn-shell-4237";
var TILES = "sn-tiles-1";
var VER = "4237";
function isTile(url) {
  return /tile\.openstreetmap\.org|tile\.openstreetmap\.de|openstreetmap\.fr\/hot/.test(url);
}
self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE && k.indexOf("sn-tiles") !== 0) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var path = "";
  try { path = new URL(req.url).pathname; } catch (err) { return; }
  if (/^\/boot(\/|$)/.test(path)) {
    e.respondWith(Response.redirect("/?v=" + VER + "&t=" + Date.now(), 302));
    return;
  }
  if (isTile(req.url)) {
    e.respondWith(
      caches.open(TILES).then(function (c) {
        return c.match(req).then(function (hit) {
          return hit || fetch(req).then(function (r) {
            if (r && r.ok) c.put(req, r.clone());
            return r;
          });
        });
      })
    );
    return;
  }
  e.respondWith(
    fetch(req, { cache: "no-store" }).then(function (r) {
      return r;
    }).catch(function () {
      return caches.match(req).then(function (h) {
        return h || new Response("offline node", { status: 503 });
      });
    })
  );
});
