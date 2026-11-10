/* SpaceNet SW 4438 — one entity. Tree lock. */
var CACHE = "sn-shell-4438";
var VER = "4438";
/* 4438: do not include /index.html in the fetch list — Vercel 308s it to /. */
var SHELL = ["/", "/js/spacenet/app.js?v=4438", "/js/spacenet/auth.js?v=4438", "/js/vendor/leaflet.js?v=4438", "/js/vendor/leaflet.css?v=4438", "/icon-192.png", "/manifest.webmanifest"];
function allowedScript(path) {
  if (path === "/js/spacenet/app.js" || path === "/js/spacenet/auth.js" || path === "/js/vendor/leaflet.js") return true;
  return false;
}
function isOverlay(path) {
  if (!/^\/js\/spacenet\//.test(path)) return false;
  if (!/\.m?js$/i.test(path)) return false;
  if (allowedScript(path)) return false;
  return true;
}
function neverCache(url) {
  if (url.pathname === "/sw.js") return true;
  if (url.pathname === "/api/version" || url.pathname.indexOf("/api/version/") === 0) return true;
  if (url.pathname === "/VERSION") return true;
  return false;
}
function isHtmlShell(url, request) {
  if (request && request.mode === "navigate") return true;
  if (url.pathname === "/" || url.pathname === "/index.html") return true;
  if (/\.html$/i.test(url.pathname)) return true;
  return false;
}
function isVersionedAsset(url) {
  return /[?&]v=\d{4,}/.test(url.search);
}
function fillCache() {
  return caches.open(CACHE).then(function (c) {
    return Promise.all(SHELL.map(function (u) {
      return fetch(u, { cache: "reload", credentials: "same-origin", redirect: "follow" }).then(function (res) {
        if (!res || !res.ok) return 0;
        return c.put(u, res).then(function () { return 1; });
      }).catch(function () { return 0; });
    })).then(function (ns) {
      var n = 0;
      for (var i = 0; i < ns.length; i++) n += ns[i];
      return c.match("/").then(function (res) {
        if (!res) return n;
        return c.put("/index.html", res.clone()).then(function () { return n + 1; });
      }).catch(function () { return n; });
    });
  });
}
self.addEventListener("install", function (e) {
  e.waitUntil(fillCache().then(function () { return self.skipWaiting(); }));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return fillCache(); }).then(function (n) {
      return self.clients.claim().then(function () { return n; });
    }).then(function (n) {
      return self.clients.matchAll({ type: "window" }).then(function (clients) {
        clients.forEach(function (c) {
          try { c.postMessage({ type: "sn-sw", ver: VER, cache: CACHE, entries: n }); } catch (err) {}
        });
      });
    })
  );
});
self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  var url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  /* 4438: sw.js, /api/version, /VERSION — never cached */
  if (neverCache(url)) {
    e.respondWith(fetch(e.request, { cache: "no-store" }));
    return;
  }
  if (isOverlay(url.pathname)) {
    e.respondWith(new Response("/* TREE LOCK 4438: overlay blocked */", { headers: { "Content-Type": "application/javascript" }, status: 200 }));
    return;
  }
  /* 4438: navigations + HTML shell are network-first; cache only when offline.
     Fetch a fresh URL (not the navigation Request) so a failed navigate-mode
     fetch cannot silently fall back to a stale sn-shell. */
  if (isHtmlShell(url, e.request)) {
    var href = (url.pathname === "/index.html") ? (url.origin + "/") : url.href;
    e.respondWith(
      fetch(href, { cache: "no-store", credentials: "same-origin", redirect: "follow" }).then(function (res) {
        if (res && res.ok) return res;
        return Promise.reject(new Error("net"));
      }).catch(function () {
        return caches.open(CACHE).then(function (c) {
          return c.match("/").then(function (r) { return r || c.match("/index.html"); });
        });
      })
    );
    return;
  }
  /* versioned ?v= assets: cache-first (URL changes with the build) */
  if (isVersionedAsset(url)) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(e.request).then(function (hit) {
        if (hit) return hit;
        return fetch(e.request).then(function (res) {
          if (res && res.ok) c.put(e.request, res.clone());
          return res;
        });
      });
    }));
    return;
  }
  e.respondWith(fetch(e.request).then(function (res) {
    return res;
  }).catch(function () {
    return caches.open(CACHE).then(function (c) { return c.match(e.request); });
  }));
});
