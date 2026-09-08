/* SpaceNet 4205 — stop /boot wipe loop, show ⏻, kill earth resize storm. */
(function () {
  if (window.__SN_CALM_4205) return;
  window.__SN_CALM_4205 = true;
  try {
    if (/^\/boot(\/|$)/.test(location.pathname)) {
      location.replace("/?v=4205&t=" + Date.now());
      return;
    }
  } catch (e) {}
  var s = document.createElement("style");
  s.id = "sn-calm-4205";
  s.textContent =
    "#sn-power{display:inline-flex!important;align-items:center;justify-content:center;position:fixed!important;top:calc(max(8px,env(safe-area-inset-top)) + 80px)!important;right:max(8px,env(safe-area-inset-right))!important;z-index:60!important;width:36px!important;height:36px!important;min-width:36px;padding:0;border-radius:999px;border:1.5px solid rgba(77,240,255,.9);background:rgba(4,16,28,.94);color:#4df0ff;font-size:22px;line-height:1;visibility:visible!important;opacity:1!important}";
  (document.head || document.documentElement).appendChild(s);
  function power() {
    var el = document.getElementById("sn-power");
    if (!el) return;
    if (!String(el.textContent || "").trim()) el.textContent = "\u23FB";
    el.style.display = "inline-flex";
  }
  power();
  setInterval(power, 800);
})();
