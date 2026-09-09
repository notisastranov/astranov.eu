/* SpaceNet 4235 — soft kernel. Earth + auth + guest + money + talk + land + pizza + pay + fill. No XHR. */
(function () {
  "use strict";
  if (window.__SN_4235) return;
  window.__SN_4235 = true;
  var VER = "4235";
  try {
    var line = document.getElementById("line");
    if (line && !line.textContent) line.textContent = "Earth online · " + VER;
  } catch (e) {}
})();
