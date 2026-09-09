/* SpaceNet 4229 — soft kernel. Earth + auth + guest + pizza-lock own surface. No XHR. */
(function () {
  "use strict";
  if (window.__SN_4229) return;
  window.__SN_4229 = true;
  var VER = "4229";
  // Chrome Android: script-src only, no sync fetch of parts.
  // Globe from earth-4204 / earth-guest-4228. Pizza from pizza-lock-4229.
  try {
    var line = document.getElementById("line");
    if (line && !line.textContent) line.textContent = "Earth online · " + VER;
  } catch (e) {}
})();
