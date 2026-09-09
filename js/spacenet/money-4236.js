/* SpaceNet 4236 — kill fake TREASURY 3M. Guest absent; signed-in paints AV€ X.XX · N⭐. */
(function (g) {
  "use strict";
  if (g.__SN_MONEY_4236) return;
  g.__SN_MONEY_4236 = true;
  var OWNER = /notisastranov@gmail\.com$|@astranov\.eu$/i;
  var DUMMY = 3000000;
  var busy = false;

  function get(k, d) {
    try {
      var v = localStorage.getItem(k);
      return v == null ? d : v;
    } catch (e) {
      return d;
    }
  }
  function num(k) {
    var n = Number(get(k, ""));
    return isFinite(n) ? n : NaN;
  }
  function isDummy(n) {
    return isFinite(n) && Math.abs(n - DUMMY) < 0.001;
  }
  function scrubKey(k) {
    try {
      var raw = localStorage.getItem(k);
      if (raw == null) return false;
      var n = Number(raw);
      if (!isDummy(n)) return false;
      try {
        localStorage.removeItem(k);
      } catch (e1) {
        try {
          localStorage.setItem(k, "0.00");
        } catch (e2) {}
      }
      return true;
    } catch (e) {
      return false;
    }
  }
  function scrubDummy() {
    var hit = false;
    hit = scrubKey("sn:pool") || hit;
    hit = scrubKey("sn:avc") || hit;
    try {
      var e = email();
      if (e) hit = scrubKey("sn:avc:" + e.toLowerCase()) || hit;
    } catch (err) {}
    /* never re-seed TREASURY / 3M */
    return hit;
  }
  function user() {
    try {
      return JSON.parse(get("sn:user", "null") || "null");
    } catch (e) {
      return null;
    }
  }
  function email() {
    var u = user();
    return String((u && u.email) || "").trim();
  }
  function signed() {
    return !!email();
  }
  function owner() {
    var e = email();
    return !!(e && OWNER.test(e));
  }
  function bal() {
    scrubDummy();
    if (!signed()) return 0;
    if (owner()) {
      var p = num("sn:pool");
      if (isDummy(p)) {
        scrubKey("sn:pool");
        p = NaN;
      }
      if (isFinite(p)) return Math.max(0, p);
      var a = num("sn:avc");
      if (isDummy(a)) {
        scrubKey("sn:avc");
        a = NaN;
      }
      if (isFinite(a)) return Math.max(0, a);
      return 0;
    }
    var k = num("sn:avc:" + email().toLowerCase());
    if (isDummy(k)) {
      scrubKey("sn:avc:" + email().toLowerCase());
      k = NaN;
    }
    if (isFinite(k)) return Math.max(0, k);
    var x = num("sn:avc");
    if (isDummy(x)) {
      scrubKey("sn:avc");
      x = NaN;
    }
    return isFinite(x) ? Math.max(0, x) : 0;
  }
  function stars() {
    var s = num("sn:stars");
    if (isFinite(s)) return Math.max(0, Math.floor(s));
    return 0;
  }
  function label() {
    return "AV€ " + bal().toFixed(2) + " · " + stars() + "⭐";
  }
  function paint(force) {
    if (busy && !force) return;
    busy = true;
    try {
      scrubDummy();
      var btn = document.getElementById("sn-money");
      if (!btn) return;
      if (!signed()) {
        btn.classList.remove("on");
        btn.style.setProperty("display", "none", "important");
        btn.setAttribute("hidden", "");
        btn.textContent = "AV€";
        return;
      }
      btn.removeAttribute("hidden");
      btn.classList.add("on");
      btn.style.setProperty("display", "inline-flex", "important");
      btn.style.visibility = "visible";
      btn.style.opacity = "1";
      var t = label();
      btn.textContent = t;
      btn.title = owner() ? "Owner pool" : "Your AV€";
      try {
        g.SN = g.SN || {};
        g.SN.paintMoney = paintNow;
        g.SN.avcGet = bal;
        g.SN.scrubDummy3M = scrubDummy;
      } catch (e) {}
    } finally {
      busy = false;
    }
  }
  function paintNow() {
    paint(true);
  }
  /* boot scrub: sn:pool exactly 3M → delete/0, never re-seed TREASURY */
  scrubDummy();
  g.SN = g.SN || {};
  g.SN.paintMoney = paintNow;
  g.SN.avcGet = bal;
  g.SN.scrubDummy3M = scrubDummy;
  paintNow();
  setInterval(paintNow, 200);
  document.addEventListener("DOMContentLoaded", paintNow);
  try {
    g.addEventListener("storage", paintNow);
    g.addEventListener("sn:user", paintNow);
    g.addEventListener("sn:auth", paintNow);
    g.addEventListener("sn:avc", paintNow);
  } catch (e) {}
})(typeof window !== "undefined" ? window : this);
