/* SpaceNet 4249 stamp orchestrator — concat chunks, apply tip. */
(function () {
  "use strict";
  if (window.__SN_STAMP_LOADING) return;
  window.__SN_STAMP_LOADING = 1;
  var parts = ["0", "1", "2"];
  var i = 0, buf = "";
  function fail(m) {
    try { var el = document.getElementById("line"); if (el) el.textContent = m; } catch (e) {}
    console.error(m);
  }
  function finish() {
    try {
      var s = document.createElement("script");
      s.textContent = buf;
      document.head.appendChild(s);
      var tip = window.__SN_TIP_4249;
      if (tip && window.__SN_APPLY_4249) window.__SN_APPLY_4249(tip);
      else fail("4249 stamp apply missing.");
    } catch (err) {
      fail("4249 stamp eval failed.");
      console.error(err);
    }
  }
  function next() {
    if (i >= parts.length) { finish(); return; }
    var u = "/js/spacenet/stamp-4249-" + parts[i++] + ".js?v=4249";
    fetch(u, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("stamp chunk " + r.status);
      return r.text();
    }).then(function (t) { buf += t; next(); }).catch(function (e) {
      fail("4249 stamp load failed. Nuclear / hard refresh.");
      console.error(e);
    });
  }
  next();
})();
