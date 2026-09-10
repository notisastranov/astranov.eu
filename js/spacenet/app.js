/* SpaceNet 4250 - thin bootstrap: tip + stamp (fetch, no src - index blocks overlay src). */
(function () {
  "use strict";
  if (window.__SN_4250) return;
  var TIP = "https://raw.githubusercontent.com/notisastranov/astranov.eu/49c666464541ef4352e5322931fbbe2663ea3c71/js/spacenet/app.js";
  var FAIL = "4250 OS patch failed. Nuclear / hard refresh.";
  function fail(e) {
    var el = document.getElementById("line");
    if (el) el.textContent = FAIL;
    console.error(e);
  }
  fetch(TIP, { cache: "no-store" }).then(function (r) {
    if (!r.ok) throw new Error("tip " + r.status);
    return r.text();
  }).then(function (tip) {
    if (tip.indexOf("function talk(") < 0) throw new Error("tip missing");
    window.__SN_TIP_4250 = tip;
    return fetch("/js/spacenet/stamp-4250.js?v=4250", { cache: "no-store" });
  }).then(function (r) {
    if (!r.ok) throw new Error("stamp " + r.status);
    return r.text();
  }).then(function (code) {
    var s = document.createElement("script");
    s.textContent = code;
    document.head.appendChild(s);
    if (window.__SN_TIP_4250 && window.__SN_APPLY_4250) window.__SN_APPLY_4250(window.__SN_TIP_4250);
    else throw new Error("4250 apply missing");
  }).catch(fail);
})();
