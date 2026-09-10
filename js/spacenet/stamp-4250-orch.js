/* SpaceNet 4250 stamp orchestrator - concat chunks, apply tip. */
(function () {
  "use strict";
  if (window.__SN_STAMP_LOADING) return;
  window.__SN_STAMP_LOADING = 1;
  var parts = ["0a", "0b", "1"];
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
      var tip = window.__SN_TIP_4250;
      if (tip && window.__SN_APPLY_4250) window.__SN_APPLY_4250(tip);
      else fail("4250 stamp apply missing.");
    } catch (err) {
      fail("4250 stamp eval failed.");
      console.error(err);
    }
  }
  function next() {
    if (i >= parts.length) { finish(); return; }
    var u = "/js/spacenet/stamp-4250-" + parts[i++] + ".js?v=4250";
    fetch(u, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("stamp chunk " + r.status);
      return r.text();
    }).then(function (t) { buf += t; next(); }).catch(function (e) {
      fail("4250 stamp load failed. Nuclear / hard refresh.");
      console.error(e);
    });
  }
  next();
})();
