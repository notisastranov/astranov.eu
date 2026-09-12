/* SpaceNet 4254 guardian — soft kernel, enter in 12s, SOS silent for guests. */
(function () {
  "use strict";
  var guest = true;
  try {
    guest = !(window.localStorage && (localStorage.getItem("sn:uid") || localStorage.getItem("sn:session")));
  } catch (e) { guest = true; }
  setTimeout(function () {
    if (window.__SN_4252 || window.__SN_4253 || window.__SN_4254) return;
    if (guest) return;
    if (typeof window.SNReboot === "function") window.SNReboot();
  }, 12000);
})();
