/* SpaceNet 4230 — soft kernel. Earth + auth + guest + land + pizza-lock own surface. No XHR. */
(function () {
  "use strict";
  if (window.__SN_4230) return;
  window.__SN_4230 = true;
  var VER = "4230";
  // Chrome Android: script-src only, no sync fetch of parts.
  // Globe from earth-4204 / earth-guest-4228. Land from land-4230. Pizza from pizza-lock-4229.
  try {
    var line = document.getElementById("line");
    if (line && !line.textContent) line.textContent = "Earth online · " + VER;
  } catch (e) {}
})();
