/* SpaceNet 4233 — MASTER: guest wallet absent; hide #sn-money (never AV€ 0.00) */
(function (global) {
  "use strict";
  if (global.__SN_MONEY_HIDE_4233) return;
  global.__SN_MONEY_HIDE_4233 = true;
  function guestWallet() {
    try {
      var u = JSON.parse(localStorage.getItem("sn:user") || "null");
      if (!u || !u.email) return true;
      var e = String(u.email || "");
      return !(/notisastranov@gmail\.com$/i.test(e) || /@astranov\.eu$/i.test(e));
    } catch (e) { return true; }
  }
  function hide() {
    try {
      var btn = document.getElementById("sn-money");
      if (!btn || !guestWallet()) return;
      btn.classList.remove("on");
      btn.style.display = "none";
      btn.setAttribute("hidden", "");
      btn.setAttribute("aria-hidden", "true");
      if (/AV€\s*0\.00|0\.00/.test(String(btn.textContent || ""))) btn.textContent = "AV€";
    } catch (e) {}
  }
  hide();
  setInterval(hide, 300);
  document.addEventListener("DOMContentLoaded", hide);
  try {
    if (global.MutationObserver) {
      var mo = new MutationObserver(hide);
      var boot = function () {
        var btn = document.getElementById("sn-money");
        if (btn) mo.observe(btn, { characterData: true, childList: true, subtree: true, attributes: true });
      };
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
    }
  } catch (e) {}
})(typeof window !== "undefined" ? window : this);
