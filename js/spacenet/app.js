/* SpaceNet 4228 — soft kernel. Earth + auth + guest scripts own surface. No XHR. */
(function () {
  "use strict";
  if (window.__SN_4228) return;
  window.__SN_4228 = true;
  var VER = "4228";
  // Chrome Android: script-src only, no sync fetch of parts.
  // Globe from earth-4204 / earth-guest-4228. Login from auth.js.
  try {
    var line = document.getElementById("line");
    if (line && !line.textContent) line.textContent = "Earth online · " + VER;
  } catch (e) {}
})();
