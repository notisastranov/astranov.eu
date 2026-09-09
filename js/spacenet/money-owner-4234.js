/* SpaceNet 4234 — signed-in wallet HUD truth (AV€ + ⭐). Load AFTER money-hide-4233. */
(function (global) {
  "use strict";
  if (global.__SN_MONEY_OWNER_4234) return;
  global.__SN_MONEY_OWNER_4234 = true;

  var OWNER_RE = /notisastranov@gmail\.com$|@astranov\.eu$/i;
  var PAINTING = false;

  function read(k, d) {
    try {
      var v = localStorage.getItem(k);
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  }

  function write(k, v) {
    try {
      localStorage.setItem(k, String(v));
    } catch (e) {}
  }

  function num(k) {
    var n = Number(read(k, ""));
    return isFinite(n) ? n : NaN;
  }

  function user() {
    try {
      return JSON.parse(read("sn:user", "null") || "null");
    } catch (e) {
      return null;
    }
  }

  function email() {
    var u = user();
    return String((u && u.email) || "").trim();
  }

  function signedIn() {
    return !!email();
  }

  function isOwner() {
    var e = email();
    return !!(e && OWNER_RE.test(e));
  }

  /* Honest balance: never invent 3M TREASURY; never wipe existing pool to 0. */
  function balance() {
    if (!signedIn()) return 0;
    if (isOwner()) {
      var pool = num("sn:pool");
      if (isFinite(pool)) return Math.max(0, pool);
      var avc = num("sn:avc");
      if (isFinite(avc)) return Math.max(0, avc);
      var pb = num("sn:pool-bak");
      if (isFinite(pb) && pb > 0) return pb;
      var ab = num("sn:avc-bak");
      if (isFinite(ab) && ab > 0) return ab;
      /* missing → 0.00 until real value exists; do not write 0 over absent key */
      return 0;
    }
    var keyed = num("sn:avc:" + email().toLowerCase());
    if (isFinite(keyed)) return Math.max(0, keyed);
    var a = num("sn:avc");
    if (isFinite(a)) return Math.max(0, a);
    if (read("sn:avc", null) == null) write("sn:avc", "0.00");
    return 0;
  }

  function stars() {
    var s = num("sn:stars");
    if (isFinite(s)) return Math.max(0, Math.floor(s));
    if (isOwner()) {
      var os = num("sn:stars:owner");
      if (isFinite(os)) return Math.max(0, Math.floor(os));
    }
    return 0;
  }

  function fmtAve(n) {
    n = Math.max(0, Number(n) || 0);
    if (n >= 1000) return "AV€ " + Math.round(n).toLocaleString("en-US");
    return "AV€ " + n.toFixed(2);
  }

  function hideBtn(btn) {
    btn.classList.remove("on");
    btn.style.setProperty("display", "none", "important");
    btn.setAttribute("hidden", "");
    btn.setAttribute("aria-hidden", "true");
  }

  function showBtn(btn) {
    btn.removeAttribute("hidden");
    btn.removeAttribute("aria-hidden");
    btn.classList.add("on");
    btn.style.removeProperty("display");
    btn.style.setProperty("display", "inline-flex", "important");
    btn.style.visibility = "visible";
    btn.style.opacity = "1";
  }

  function paintIslandWallet(bal, st) {
    try {
      /* Do not clobber sn-local/sn-utc clock slots. Only fill empty sn-wx with ⭐ truth. */
      var wx = document.getElementById("sn-wx");
      if (wx && (!String(wx.textContent || "").trim() || wx.getAttribute("data-sn-4234-stars") === "1")) {
        wx.setAttribute("data-sn-4234-stars", "1");
        wx.textContent = st + "⭐";
      }
      var island = document.getElementById("island");
      if (island) island.setAttribute("data-sn-avc", String(bal));
    } catch (e) {}
  }

  function paintMoney() {
    if (PAINTING) return;
    PAINTING = true;
    try {
      var btn = document.getElementById("sn-money");
      if (!btn) return;
      if (!signedIn()) {
        hideBtn(btn);
        if (/AV€\s*0\.00|0\.00/.test(String(btn.textContent || ""))) btn.textContent = "AV€";
        return;
      }
      showBtn(btn);
      var bal = balance();
      var st = stars();
      var label = fmtAve(bal) + " · " + st + "⭐";
      if (String(btn.textContent || "") !== label) btn.textContent = label;
      btn.setAttribute("title", isOwner() ? "Owner pool (sn:pool)" : "Your AV€ (sn:avc)");
      paintIslandWallet(bal, st);
      try {
        if (global.SN) {
          global.SN.paintMoney = paintMoney;
          global.SN.avcGet = function () {
            return balance();
          };
        }
      } catch (e) {}
    } catch (e) {
    } finally {
      PAINTING = false;
    }
  }

  function bootObserver() {
    try {
      if (global.__SN_MO_MONEY_4234) return;
      var btn = document.getElementById("sn-money");
      if (!btn) return;
      var mo = new MutationObserver(function () {
        if (PAINTING) return;
        paintMoney();
      });
      mo.observe(btn, { characterData: true, childList: true, subtree: true, attributes: true });
      global.__SN_MO_MONEY_4234 = mo;
    } catch (e) {}
  }

  function onStorage(ev) {
    try {
      if (!ev || !ev.key) return;
      if (/^sn:(user|pool|avc|stars)/.test(ev.key) || ev.key.indexOf("sn:avc:") === 0) paintMoney();
    } catch (e) {}
  }

  paintMoney();
  bootObserver();
  setInterval(function () {
    paintMoney();
    bootObserver();
  }, 250);
  document.addEventListener("DOMContentLoaded", function () {
    paintMoney();
    bootObserver();
  });
  try {
    global.addEventListener("storage", onStorage);
  } catch (e) {}
  try {
    global.addEventListener("sn:user", paintMoney);
    global.addEventListener("sn:auth", paintMoney);
  } catch (e) {}

  global.SN = global.SN || {};
  global.SN.paintMoney = paintMoney;
  global.SN.avcGet = function () {
    return balance();
  };
})(typeof window !== "undefined" ? window : this);
