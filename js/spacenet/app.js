/* SpaceNet 4233 — soft kernel. Earth + auth + guest + talk + land + pizza-lock + fill. No XHR. */
(function () {
  "use strict";
  if (window.__SN_4233) return;
  window.__SN_4233 = true;
  var VER = "4233";
  // Chrome Android: script-src only, no sync fetch of parts.
  // Globe from earth-4204 / earth-guest-4228. Talk from talk-4232. Land from land-4232. Pizza from pizza-lock-4229. Fill from fill-4233.
  try {
    var line = document.getElementById("line");
    if (line && !line.textContent) line.textContent = "Earth online · " + VER;
  } catch (e) {}
})();
