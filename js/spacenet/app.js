/* SpaceNet 4231 — soft kernel. Earth + auth + guest + talk + land + pizza-lock + fill. No XHR. */
(function () {
  "use strict";
  if (window.__SN_4231) return;
  window.__SN_4231 = true;
  var VER = "4231";
  // Chrome Android: script-src only, no sync fetch of parts.
  // Globe from earth-4204 / earth-guest-4228. Talk from talk-4231. Land from land-4231. Pizza from pizza-lock-4229.
  try {
    var line = document.getElementById("line");
    if (line && !line.textContent) line.textContent = "Earth online · " + VER;
  } catch (e) {}
})();
