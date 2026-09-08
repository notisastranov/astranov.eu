/* SpaceNet SW 4219 — network-first. Never send clients to /boot. DO inject earth + pizza-kill. */
var CACHE = "sn-shell-4219";
var TILES = "sn-tiles-1";
var VER = "4219";
function isTile(url) {
  return /tile\.openstreetmap\.org|openstreetmap\.fr\/hot|basemaps\.cartocdn\.com|tiles\.maps\.eox\.at|server\.arcgisonline\.com/.test(url);
}
function withShell(html) {
  if (!html || html.indexOf("leaflet.js") === -1) return html;
  function inject(afterNeedle, src) {
    if (html.indexOf(src.split("/").pop().split("?")[0]) !== -1) return;
    var tag = '<script src="' + src + '"><\/script>';
    if (html.indexOf(afterNeedle) !== -1) {
      html = html.replace(afterNeedle, afterNeedle + "\n" + tag);
    }
  }
  inject('spacenet/app.js?v=4219"></script>', "/js/spacenet/hang-kill-4213.js?v=4213");
  inject('hang-kill-4213.js?v=4213"></script>', "/js/spacenet/earth-4204.js?v=4219");
  inject('spacenet/app.js?v=4219"></script>', "/js/spacenet/earth-4204.js?v=4219");
  inject('auth.js?v=4219"></script>', "/js/spacenet/land-4162.js?v=4219");
  inject('land-4162.js?v=4219"></script>', "/js/spacenet/list-4161.js?v=4219");
  inject('list-4161.js?v=4219"></script>', "/js/spacenet/fill-4199.js?v=4219");
  inject('fill-4199.js?v=4219"></script>', "/js/spacenet/pin-4202.js?v=4219");
  inject('pin-4202.js?v=4219"></script>', "/js/spacenet/pizza-lock-4211.js?v=4211");
  inject('pizza-lock-4211.js?v=4211"></script>', "/js/spacenet/money-keep-4210.js?v=4210");
  inject('money-keep-4210.js?v=4210"></script>', "/js/spacenet/pizza-kill-4214.js?v=4219");
  inject('earth-4204.js?v=4219"></script>', "/js/spacenet/pizza-kill-4214.js?v=4219");
  return html;
}
self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function() { return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) { return k !== CACHE && k !== TILES; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }).then(function() {
    return self.clients.matchAll({ type: "window" }).then(function(cs) {
      cs.forEach(function(c) {
        try {
          var u = c.url || "";
          if (c.navigate && /\/boot(\/|\?|$)/.test(u)) c.navigate("/?v=" + VER + "&t=" + Date.now());
        } catch (err) {}
      });
    });
  }));
});
self.addEventListener("message", function(e) {
  if (e.data === "SKIP_WAITING" && self.skipWaiting) self.skipWaiting();
});
self.addEventListener("fetch", function(e) {
  var u = e.request.url;
  if (e.request.method !== "GET") return;
  if (isTile(u)) {
    e.respondWith(caches.open(TILES).then(function(c) {
      return c.match(e.request).then(function(r) {
        if (r) return r;
        return fetch(e.request).then(function(res) {
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        }).catch(function() { return r || new Response("", { status: 504 }); });
      });
    }));
    return;
  }
  if (u.indexOf(self.location.origin) !== 0) return;
  if (e.request.mode === "navigate" || (e.request.headers.get("accept") || "").indexOf("text/html") !== -1) {
    e.respondWith(fetch(e.request, { cache: "no-store" }).then(function(res) {
      if (!res || !res.ok) return res;
      var ct = res.headers.get("content-type") || "";
      if (ct.indexOf("text/html") === -1) return res;
      return res.text().then(function(t) {
        var path = "";
        try { path = new URL(e.request.url).pathname; } catch (err) {}
        if (/^\/boot(\/|$)/.test(path)) {
          var hop = "<!DOCTYPE html><meta charset=utf-8><script>location.replace('/?v=" + VER + "&t='+Date.now())<\/script>";
          return new Response(hop, { status: 200, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
        }
        t = withShell(t);
        var h = new Headers(res.headers);
        h.set("Cache-Control", "no-store");
        return new Response(t, { status: res.status, statusText: res.statusText, headers: h });
      });
    }).catch(function() {
      return new Response("SpaceNet offline — open astranov.eu when you have signal.", { status: 503, headers: { "Content-Type": "text/plain" } });
    }));
    return;
  }
  if (/\/js\/|\.js(\?|$)/.test(u)) {
    e.respondWith(fetch(e.request).then(function(res) {
      if (res && res.ok) caches.open(CACHE).then(function(cache) { cache.put(e.request, res.clone()); });
      return res;
    }).catch(function() { return caches.match(e.request); }));
  }
});
