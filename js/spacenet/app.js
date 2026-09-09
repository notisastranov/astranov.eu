/* SpaceNet 4234 — soft kernel. Earth + auth + guest + money-owner + talk + land + pizza-lock + fill. No XHR. */
(function () {
  "use strict";
  if (window.__SN_4234) return;
  window.__SN_4234 = true;
  var VER = "4234";
  // Chrome Android: script-src only, no sync fetch of parts.
  // Globe from earth-4204 / earth-guest-4228. Money from money-owner-4234. Talk from talk-4232. Land from land-4232. Pizza from pizza-lock-4229. Fill from fill-4234.
  try {
    var line = document.getElementById("line");
    if (line && !line.textContent) line.textContent = "Earth online · " + VER;
  } catch (e) {}
})();
