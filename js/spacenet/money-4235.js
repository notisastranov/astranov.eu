/* SpaceNet 4235 — single #sn-money writer. Guest absent; signed-in paints AV€ X.XX · N⭐. */
(function (g) {
  "use strict";
  if (g.__SN_MONEY_4235) return;
  g.__SN_MONEY_4235 = true;
  var OWNER = /notisastranov@gmail\.com$|@astranov\.eu$/i;
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
    if (!signed()) return 0;
    if (owner()) {
      var p = num("sn:pool");
      if (isFinite(p)) return Math.max(0, p);
      var a = num("sn:avc");
      if (isFinite(a)) return Math.max(0, a);
      return 0;
    }
    var k = num("sn:avc:" + email().toLowerCase());
    if (isFinite(k)) return Math.max(0, k);
    var x = num("sn:avc");
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
  function paint() {
    if (busy) return;
    busy = true;
    try {
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
      if (btn.textContent !== t) btn.textContent = t;
      btn.title = owner() ? "Owner pool" : "Your AV€";
      try {
        g.SN = g.SN || {};
        g.SN.paintMoney = paint;
        g.SN.avcGet = bal;
      } catch (e) {}
    } finally {
      busy = false;
    }
  }
  g.SN = g.SN || {};
  g.SN.paintMoney = paint;
  g.SN.avcGet = bal;
  paint();
  setInterval(paint, 200);
  document.addEventListener("DOMContentLoaded", paint);
  try {
    g.addEventListener("storage", paint);
    g.addEventListener("sn:user", paint);
    g.addEventListener("sn:auth", paint);
  } catch (e) {}
})(typeof window !== "undefined" ? window : this);
