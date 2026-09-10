/* SpaceNet 4249 — bootstrap: goNamed + city-find hunt (no Rhodes partners off-island). */
(function () {
  "use strict";
  if (window.__SN_4249) return;
  var TIP = "https://raw.githubusercontent.com/notisastranov/astranov.eu/49c666464541ef4352e5322931fbbe2663ea3c71/js/spacenet/app.js";
  var FAIL = "4249 OS patch failed. Nuclear / hard refresh.";
  fetch(TIP, { cache: "no-store" }).then(function (r) { if (!r.ok) throw new Error("tip " + r.status); return r.text(); }).then(function (tip) {
    var code = tip;
    if (code.indexOf("function talk(") < 0) throw new Error("tip missing");
    /* inject goNamed + city find from external stamp */
    var stamp = document.createElement("script");
    stamp.src = "/js/spacenet/stamp-4249.js?v=4249";
    stamp.onload = function () { if (window.__SN_APPLY_4249) window.__SN_APPLY_4249(code); };
    stamp.onerror = function () { var el = document.getElementById("line"); if (el) el.textContent = FAIL; };
    document.head.appendChild(stamp);
  }).catch(function (e) { var el = document.getElementById("line"); if (el) el.textContent = FAIL; console.error(e); });
})();
