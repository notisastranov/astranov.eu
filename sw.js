/* SpaceNet SW 4212 — network-first shell. Never cache a stub. */
var CACHE = "sn-shell-4212";
var TILES = "sn-tiles-1";
var VER = "4212";
function isTile(url) {
  return /tile\.openstreetmap\.org|openstreetmap\.fr\/hot|tiles\.maps\.eox\.at|server\.arcgisonline\.com/.test(url);
}
function isAsset(url) {
  return /\/js\/|\.js(\?|$)|\/css\/|\.css(\?|$)|leaflet|icon-192|icon-512|apple-touch-icon|manifest/.test(url);
}
function isStub(html) {
  if (!html) return true;
  if (html.length < 4000) return true;
  if (/PLACEHOLDER|sn-index\/c|index\.part|boot failed/i.test(html)) return true;
  if (html.indexOf('id="g"') === -1) return true;
  if (html.indexOf('id="plus"') === -1) return true;
  if (html.indexOf('id="go"') === -1) return true;
  if (html.indexOf('id="in"') === -1) return true;
  if (html.indexOf('id="island"') === -1) return true;
  return false;
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
  inject('leaflet.js?v=4127"></script>', "/js/spacenet/voice.js?v=4164");
  inject('leaflet.js?v=4127"></script>', "/js/spacenet/leave-flat.js?v=4164");
  inject('spacenet/app.js?v=4160"></script>', "/js/spacenet/auth.js?v=4164");
  inject('spacenet/app.js?v=4160"></script>', "/js/spacenet/order-menu.js?v=4164");
  inject('spacenet/app.js?v=4160"></script>', "/js/spacenet/plus-job.js?v=4164");
  inject('spacenet/app.js?v=4160"></script>', "/js/spacenet/jobs-stack.js?v=4164");
  inject('spacenet/app.js?v=4160"></script>', "/js/spacenet/plus-mic.js?v=4164");
  inject('spacenet/app.js?v=4160"></script>', "/js/spacenet/install.js?v=4164");
  inject('list-4161.js?v=4163"></script>', "/js/spacenet/calm-4164.js?v=4164");
  inject('calm-4164.js?v=4164"></script>', "/js/spacenet/jobs-4192.js?v=4192");
  inject('jobs-4192.js?v=4192"></script>', "/js/spacenet/radar-4166.js?v=4192");
  inject('radar-4166.js?v=4192"></script>', "/js/spacenet/post-4169.js?v=4169");
  inject('post-4169.js?v=4169"></script>', "/js/spacenet/post-4170.js?v=4170");
  inject('post-4170.js?v=4170"></script>', "/js/spacenet/post-4171.js?v=4171");
  inject('post-4171.js?v=4171"></script>', "/js/spacenet/post-4173.js?v=4173");
  inject('land-4162.js?v=4163"></script>', "/js/spacenet/calm-4164.js?v=4164");
  inject('post-4173.js?v=4173"></script>', "/js/spacenet/ui-lock.js?v=4175");
  inject('ui-lock.js?v=4175"></script>', "/js/spacenet/job-chain-4176.js?v=4176");
  inject('job-chain-4176.js?v=4176"></script>', "/js/spacenet/search-4177.js?v=4177");
  inject('search-4177.js?v=4177"></script>', "/js/spacenet/vendor-card-4178.js?v=4178");
  inject('vendor-card-4178.js?v=4178"></script>', "/js/spacenet/vendor-ask-4179.js?v=4179");
  inject('vendor-ask-4179.js?v=4179"></script>', "/js/spacenet/plus-upload-4180.js?v=4180");
  inject('plus-upload-4180.js?v=4180"></script>', "/js/spacenet/jobs-real-4181.js?v=4181");
  inject('jobs-real-4181.js?v=4181"></script>', "/js/spacenet/money-own-4183.js?v=4183");
  inject('money-own-4183.js?v=4183"></script>', "/js/spacenet/jobs-pin-4184.js?v=4184");
  inject('jobs-pin-4184.js?v=4184"></script>', "/js/spacenet/brand-wipe-4185.js?v=4185");
  inject('brand-wipe-4185.js?v=4185"></script>', "/js/spacenet/talk-4186.js?v=4186");
  inject('talk-4186.js?v=4186"></script>', "/js/spacenet/route-4187.js?v=4187");
  inject('route-4187.js?v=4187"></script>', "/js/spacenet/route-4190.js?v=4190");
  inject('route-4190.js?v=4190"></script>', "/js/spacenet/ver-4191.js?v=4191");
  inject('ver-4191.js?v=4191"></script>', "/js/spacenet/chrome-4193.js?v=4193");
  inject('chrome-4193.js?v=4193"></script>', "/js/spacenet/jobs-label-4195.js?v=4195");
  inject('jobs-label-4195.js?v=4195"></script>', "/js/spacenet/power-glyph-4196.js?v=4196");
  inject('power-glyph-4196.js?v=4196"></script>', "/js/spacenet/pin-4197.js?v=4197");
  inject('pin-4197.js?v=4197"></script>', "/js/spacenet/pin-4202.js?v=4202");
  inject('pin-4197.js?v=4197"></script>', "/js/spacenet/verify-4198.js?v=4198");
  inject('verify-4198.js?v=4198"></script>', "/js/spacenet/talk-4199.js?v=4199");
  inject('talk-4199.js?v=4199"></script>', "/js/spacenet/scout-4200.js?v=4200");
  inject('pin-4202.js?v=4202"></script>', "/js/spacenet/brand-throw-4203.js?v=4203");
  inject('spacenet/app.js?v=4204"></script>', "/js/spacenet/earth-4204.js?v=4212");
  inject('spacenet/app.js?v=4160"></script>', "/js/spacenet/earth-4204.js?v=4212");
  inject('money-keep-4210.js?v=4210"></script>', "/js/spacenet/land-4162.js?v=4212");
  inject('verify-sn-4208.js?v=4208"></script>', "/js/spacenet/land-4162.js?v=4212");
  inject('land-4162.js?v=4212"></script>', "/js/spacenet/list-4161.js?v=4212");
  inject('list-4161.js?v=4212"></script>', "/js/spacenet/fill-4199.js?v=4212");
  inject('fill-4199.js?v=4212"></script>', "/js/spacenet/pin-4202.js?v=4212");
  inject('pin-4202.js?v=4212"></script>', "/js/spacenet/pizza-lock-4211.js?v=4211");
  inject('pizza-lock-4211.js?v=4211"></script>', "/js/spacenet/pizza-kill-4212.js?v=4212");
  inject('money-keep-4210.js?v=4210"></script>', "/js/spacenet/pizza-kill-4212.js?v=4212");
  inject('spacenet/app.js?v=4204"></script>', "/js/spacenet/land-4162.js?v=4212");
  return html;
}
self.addEventListener("install", function(e) {
  e.waitUntil(caches.open(CACHE).then(function(c) {
    return c.addAll(["/manifest.webmanifest", "/icon-192.png", "/icon-512.png", "/apple-touch-icon.png"]);
  }).then(function() { return self.skipWaiting(); }));
});
self.addEventListener("activate", function(e) {
  e.waitUntil(caches.keys().then(function(ks) {
    return Promise.all(ks.filter(function(k) { return k !== CACHE && k !== TILES; }).map(function(k) { return caches.delete(k); }));
  }).then(function() { return self.clients.claim(); }).then(function() {
    return self.clients.matchAll({ type: "window" }).then(function(cs) {
      cs.forEach(function(c) {
        try { c.postMessage({ type: "SN_RELOAD", v: VER }); } catch (err) {}
        if (c.navigate) {
          try { c.navigate("/boot?v=" + VER + "&t=" + Date.now() + "&wipe=1"); } catch (err) {}
        }
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
        if (isStub(t)) {
          return fetch("/boot.html?lock=1", { cache: "no-store" }).then(function(r) {
            if (!r || !r.ok) return new Response(t, { status: res.status, headers: res.headers });
            return r.text().then(function(full) {
              if (isStub(full)) return new Response(t, { status: res.status, headers: res.headers });
              var h = new Headers(r.headers); h.set("Cache-Control", "no-store");
              return new Response(withShell(full), { status: 200, headers: h });
            });
          });
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
  if (isAsset(u)) {
    e.respondWith(fetch(e.request).then(function(res) {
      if (res && res.ok) caches.open(CACHE).then(function(cache) { cache.put(e.request, res.clone()); });
      return res;
    }).catch(function() { return caches.match(e.request); }));
  }
});
