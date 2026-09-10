/* SpaceNet 4249 — thin bootstrap: tip + stamp orchestrator. */
(function () {
  "use strict";
  if (window.__SN_4249) return;
  var TIP = "https://raw.githubusercontent.com/notisastranov/astranov.eu/49c666464541ef4352e5322931fbbe2663ea3c71/js/spacenet/app.js";
  var FAIL = "4249 OS patch failed. Nuclear / hard refresh.";
  fetch(TIP, { cache: "no-store" }).then(function (r) {
    if (!r.ok) throw new Error("tip " + r.status);
    return r.text();
  }).then(function (tip) {
    if (tip.indexOf("function talk(") < 0) throw new Error("tip missing");
    window.__SN_TIP_4249 = tip;
    var stamp = document.createElement("script");
    stamp.src = "/js/spacenet/stamp-4249-orch.js?v=4249";
    stamp.onerror = function () {
      var el = document.getElementById("line");
      if (el) el.textContent = FAIL;
    };
    document.head.appendChild(stamp);
  }).catch(function (e) {
    var el = document.getElementById("line");
    if (el) el.textContent = FAIL;
    console.error(e);
  });
})();
