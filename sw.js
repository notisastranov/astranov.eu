/* SpaceNet SW 4218 — network-first shell. Never inject scripts. Never send clients to /boot. */
var CACHE = "sn-shell-4218";
var VER = "4218";

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) { return caches.delete(k); }));
    }).then(function () {
      return self.clients.claim();
    }).then(function () {
      return self.clients.matchAll({ type: "window" });
    }).then(function (clients) {
      clients.forEach(function (c) {
        var u = c.url || "";
        if (c.navigate && /\/boot(\/|\?|$)/.test(u)) {
          try { c.navigate("/?v=" + VER + "&t=" + Date.now()); } catch (err) {}
        }
      });
    })
  );
});

function isTile(url) {
  return /tile\.openstreetmap\.org|openstreetmap\.fr\/hot|basemaps\.cartocdn\.com|tiles\.maps\.eox\.at|server\.arcgisonline\.com/.test(url);
}

self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = req.url;
  var path = "";
  try { path = new URL(url).pathname; } catch (err) { return; }

  if (/^\/boot(\/|$)/.test(path)) {
    e.respondWith(Response.redirect("/?v=" + VER + "&t=" + Date.now(), 302));
    return;
  }

  if (isTile(url)) {
    e.respondWith(
      caches.open("sn-tiles-1").then(function (cache) {
        return cache.match(req).then(function (hit) {
          if (hit) return hit;
          return fetch(req).then(function (res) {
            if (res && res.ok) cache.put(req, res.clone());
            return res;
          });
        });
      })
    );
    return;
  }

  e.respondWith(
    fetch(req, { cache: "no-store" }).then(function (res) {
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || new Response("offline", { status: 503, headers: { "Content-Type": "text/plain" } });
      });
    })
  );
});
