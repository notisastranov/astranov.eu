/* SpaceNet SW 4244 — tree lock. Network-first shell. Never inject. Never /boot. Never overlays. */
var CACHE = "sn-shell-4244";
var VER = "4244";
var SHELL = ["/", "/index.html", "/js/spacenet/app.js?v=4244", "/js/spacenet/auth.js?v=4244", "/js/vendor/leaflet.js?v=4127", "/js/vendor/leaflet.css?v=4127", "/icon-192.png", "/manifest.webmanifest"];
function allowedScript(path) {
  return path === "/js/spacenet/app.js" || path === "/js/spacenet/auth.js" || path === "/js/vendor/leaflet.js";
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
      return Promise.all(keys.map(function (k) { if (k !== CACHE && k.indexOf("sn-tiles") !== 0) return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }).then(function () {
      return self.clients.matchAll({ type: "window" });
    }).then(function (clients) {
      clients.forEach(function (c) {
        if (c.navigate) {
          try { c.navigate("/?v=" + VER + "&t=" + Date.now()); } catch (err) {}
        }
      });
    })
  );
});
function isTile(url) {
  return /tile\.openstreetmap\.org|tile\.openstreetmap\.de|openstreetmap\.fr\/hot/.test(url);
}
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;
  var url = req.url, path = "";
  try { path = new URL(url).pathname; } catch (err) { return; }
  if (/^\/boot(\/|$)/.test(path)) {
    e.respondWith(Response.redirect("/?v=" + VER + "&t=" + Date.now(), 302));
    return;
  }
  if (isOverlay(path) || /earth-4204|earth-guest|money-\d|pay-\d|fill-\d|talk-\d|land-\d|pizza-lock|auth-\d/.test(path)) {
    e.respondWith(new Response("/* TREE LOCK 4244: overlay blocked */", {
      status: 200,
      headers: { "Content-Type": "text/javascript; charset=utf-8", "Cache-Control": "no-store", "X-Astranov-Tree": "blocked" }
    }));
    return;
  }
  if (isTile(url)) {
    e.respondWith(caches.open("sn-tiles-1").then(function (cache) {
      return cache.match(req).then(function (hit) {
        if (hit) return hit;
        return fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        });
      });
    }));
    return;
  }
  e.respondWith(fetch(req, { cache: "no-store" }).then(function (res) {
    if (res && res.ok && (path === "/" || path === "/index.html" || allowedScript(path) || path === "/sw.js")) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      return hit || caches.match("/") || new Response("offline node", { status: 503, headers: { "Content-Type": "text/plain" } });
    });
  }));
});
