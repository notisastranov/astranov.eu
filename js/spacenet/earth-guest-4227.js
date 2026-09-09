/* SpaceNet 4227 — guest AV€ + Earth online (loads after app.js / earth-4204) */
(function (global) {
  "use strict";
  if (global.__SN_4227_GUEST) return;
  global.__SN_4227_GUEST = true;

  function signed() {
    try {
      var u = JSON.parse(localStorage.getItem("sn:user") || "null");
      return !!(u && u.email);
    } catch (e) { return false; }
  }

  function paintGuestMoney() {
    try {
      var btn = document.getElementById("sn-money");
      if (!btn) return;
      if (!signed()) {
        btn.classList.add("on");
        btn.style.display = "flex";
        btn.textContent = "AV€ 0.00";
      }
    } catch (e) {}
  }

  function patchPaintMoney() {
    try {
      if (!global.SN || typeof global.SN.paintMoney !== "function" || global.SN.__paintMoney4227) return;
      var _pm = global.SN.paintMoney.bind(global.SN);
      global.SN.paintMoney = function () {
        if (!signed()) { paintGuestMoney(); return; }
        return _pm();
      };
      global.SN.__paintMoney4227 = true;
    } catch (e) {}
  }

  function patchSay() {
    try {
      if (!global.SN || typeof global.SN.say !== "function" || global.SN.__say4227) return;
      var _say = global.SN.say.bind(global.SN);
      global.SN.say = function (msg) {
        var m = String(msg || "");
        if (/Grid globe/i.test(m)) m = "Earth online.";
        return _say(m);
      };
      global.SN.__say4227 = true;
      var line = document.getElementById("line");
      if (line && /Grid globe/i.test(line.textContent || "")) line.textContent = "Earth online.";
    } catch (e) {}
  }

  function ensureCam() {
    try {
      if (global.__SN_CAM && global.__SN_CAM.getYaw) return;
      var sn = global.SN && global.SN.cam;
      if (!sn) return;
      global.__SN_CAM = {
        getYaw: function () { return +sn.yaw || 0.49; },
        getPitch: function () { return +sn.pitch || 0.63; },
        getDist: function () { return +sn.dist || 1.85; },
        needTick: function () {}
      };
    } catch (e) {}
  }

  function boot() {
    ensureCam();
    patchPaintMoney();
    patchSay();
    paintGuestMoney();
    try { if (global.SN && global.SN.say) global.SN.say("Earth online."); } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
  setInterval(function () { ensureCam(); patchPaintMoney(); patchSay(); paintGuestMoney(); }, 1000);
})(typeof window !== "undefined" ? window : this);
