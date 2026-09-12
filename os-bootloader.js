/* SpaceNet 4254 — script-src boot so Chrome Android fires. No fetch+inject of kernel shards. */
(function () {
  "use strict";
  var VER = "4254";
  window.__SN_BOOT = VER;
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = src;
      s.async = false;
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error(src)); };
      document.head.appendChild(s);
    });
  }
  function inflateAndRun() {
    return Promise.resolve().then(function () {
      var b64 = window.__SN4252_GZ || "";
      if (!b64) throw new Error("gz missing");
      var b = Uint8Array.from(atob(b64), function (c) { return c.charCodeAt(0); });
      return new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream("gzip"))).text();
    }).then(function (code) {
      if (code.indexOf("function talk(") < 0) throw new Error("inflate fail");
      (0, eval)(code);
      window.__SN_4252 = true;
      window.__SN_4253 = true;
      window.__SN_4254 = true;
    });
  }
  function afterEarth(fn) {
    var n = 0;
    var t = setInterval(function () {
      n++;
      var g = document.getElementById("g");
      var earth = !!(g && (g.querySelector("canvas") || g.querySelector(".leaflet-container") || (g.children && g.children.length)));
      if (earth || window.__SN_EARTH || n > 80) {
        clearInterval(t);
        if (earth) window.__SN_EARTH = true;
        fn();
      }
    }, 150);
  }
  function registerSW() {
    try {
      if (navigator.serviceWorker) navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {});
    } catch (e) {}
  }
  var going = false;
  function go() {
    if (going) return;
    going = true;
    location.replace("/?v=" + VER + "&t=" + Date.now());
  }
  window.SNReboot = function (e) {
    if (e) {
      if (e.target && e.target.closest && e.target.closest("#sn-money")) return;
      e.preventDefault();
    }
    var line = document.getElementById("line");
    if (line) line.textContent = "loading " + VER;
    var tasks = [];
    try {
      if (window.caches) tasks.push(caches.keys().then(function (ks) { return Promise.all(ks.map(function (k) { return caches.delete(k); })); }));
    } catch (err) {}
    try {
      if (navigator.serviceWorker) tasks.push(navigator.serviceWorker.getRegistrations().then(function (rs) { return Promise.all(rs.map(function (r) { return r.unregister(); })); }));
    } catch (err) {}
    Promise.all(tasks).then(go).catch(go);
    setTimeout(go, 1600);
  };

  var chain = Promise.resolve();
  for (var i = 0; i < 8; i++) {
    (function (n) {
      chain = chain.then(function () { return loadScript("/js/spacenet/gz8-" + n + ".js?v=" + VER); });
    })(i);
  }
  chain.then(inflateAndRun).then(function () {
    afterEarth(registerSW);
  }).catch(function (e) {
    console.error(e);
  });
})();
