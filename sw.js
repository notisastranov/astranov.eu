/* SpaceNet SW 4227 — network-first. DO inject earth. Never /boot. */
var CACHE = "sn-shell-4227";
var VER = "4227";
var EARTH = "/js/spacenet/earth-4204.js?v=4227";
var LAND = "/js/spacenet/assets/land-rings.json?v=4227";
var SHELL = ["/", "/index.html", "/js/spacenet/app.js?v=4227", "/js/spacenet/auth.js?v=4227", EARTH, LAND, "/js/vendor/leaflet.js?v=4127", "/js/vendor/leaflet.css?v=4127", "/icon-192.png", "/manifest.webmanifest"];
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
        if (c.navigate && /\/boot(\/|\?|$)/.test(c.url || "")) {
          try { c.navigate("/?v=" + VER + "&t=" + Date.now()); } catch (err) {}
        }
      });
    })
  );
});
function isTile(url) {
  return /tile\.openstreetmap\.org|tile\.openstreetmap\.de|openstreetmap\.fr\/hot/.test(url);
}
function injectEarth(html) {
  try {
    if (/earth-4204\.js/.test(html)) return html;
    if (/\/js\/spacenet\/auth\.js/.test(html)) {
      return html.replace(
        /(<script src="\/js\/spacenet\/auth\.js[^"]*"><\/script>)/,
        "$1\n<script src=\"" + EARTH + "\"></script>"
      );
    }
    if (/\/js\/spacenet\/app\.js/.test(html)) {
      return html.replace(
        /(<script src="\/js\/spacenet\/app\.js[^"]*"><\/script>)/,
        "$1\n<script src=\"" + EARTH + "\"></script>"
      );
    }
  } catch (e) {}
  return html;
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
  var htmlDoc = path === "/" || path === "/index.html";
  e.respondWith(fetch(req, { cache: "no-store" }).then(function (res) {
    if (!res || !res.ok) return res;
    if (htmlDoc) {
      return res.text().then(function (txt) {
        var out = injectEarth(txt);
        var headers = new Headers(res.headers);
        headers.set("Cache-Control", "no-store, no-cache, must-revalidate");
        headers.set("X-Astranov-Build", VER);
        var resp = new Response(out, { status: res.status, statusText: res.statusText, headers: headers });
        caches.open(CACHE).then(function (c) { c.put(req, resp.clone()); }).catch(function () {});
        return resp;
      });
    }
    if (/\/js\/spacenet\//.test(path) || path === "/sw.js" || path.indexOf("/js/spacenet/assets/") === 0) {
      var copy = res.clone();
      caches.open(CACHE).then(function (c) { c.put(req, copy); }).catch(function () {});
    }
    return res;
  }).catch(function () {
    return caches.match(req).then(function (hit) {
      if (hit) {
        if (htmlDoc) {
          return hit.text().then(function (txt) {
            return new Response(injectEarth(txt), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
          });
        }
        return hit;
      }
      return caches.match("/").then(function (root) {
        if (!root) return new Response("offline node", { status: 503, headers: { "Content-Type": "text/plain" } });
        return root.text().then(function (txt) {
          return new Response(injectEarth(txt), { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
        });
      });
    });
  }));
});
