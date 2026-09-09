/* SpaceNet 4235 — signed-in NOW/PAY debit. Guest blocked. No document.write. No fake PayPal. */
(function (g) {
  "use strict";
  if (g.__SN_PAY_4235) return;
  g.__SN_PAY_4235 = true;
  var OWNER = /notisastranov@gmail\.com$|@astranov\.eu$/i;
  function email() {
    try {
      var u = JSON.parse(localStorage.getItem("sn:user") || "null");
      return String((u && u.email) || "").trim();
    } catch (e) {
      return "";
    }
  }
  function signed() {
    return !!email();
  }
  function owner() {
    var e = email();
    return !!(e && OWNER.test(e));
  }
  function readNum(k) {
    try {
      var n = Number(localStorage.getItem(k));
      return isFinite(n) ? n : NaN;
    } catch (e) {
      return NaN;
    }
  }
  function writeNum(k, n) {
    try {
      localStorage.setItem(k, String(Math.round(Number(n) * 100) / 100));
    } catch (e) {}
  }
  function bal() {
    if (!signed()) return 0;
    if (owner()) {
      var p = readNum("sn:pool");
      if (isFinite(p)) return Math.max(0, p);
      var a = readNum("sn:avc");
      return isFinite(a) ? Math.max(0, a) : 0;
    }
    var a2 = readNum("sn:avc");
    return isFinite(a2) ? Math.max(0, a2) : 0;
  }
  function setBal(n) {
    n = Math.max(0, Math.round(Number(n) * 100) / 100);
    if (owner()) writeNum("sn:pool", n);
    else writeNum("sn:avc", n);
  }
  function say(m) {
    try {
      var line = document.getElementById("line");
      if (line) line.textContent = m;
    } catch (e) {}
  }
  function paint() {
    try {
      if (g.SN && typeof SN.paintMoney === "function") SN.paintMoney();
    } catch (e) {}
  }
  function debit(fee, why) {
    var b = bal();
    if (b < fee) {
      say("Insufficient AV€ — need " + fee.toFixed(2) + ", have " + b.toFixed(2) + ".");
      return false;
    }
    var next = Math.round((b - fee) * 100) / 100;
    setBal(next);
    paint();
    say((why || "Paid") + " · −" + fee.toFixed(2) + " AV€ · bal " + next.toFixed(2));
    return true;
  }
  document.addEventListener(
    "click",
    function (ev) {
      var t = ev.target;
      if (!t || !t.closest) return;
      var pay = t.closest('#sn-sheet [data-act="pay"], [data-act="pay"]');
      var now = t.closest('#sn-sheet [data-act="now"], [data-act="now"]');
      var reload = t.closest('#sn-sheet [data-act="reload"], [data-act="reload"]');
      if (!pay && !now && !reload) return;
      if (!t.closest("#sn-sheet") && !t.closest("[id^=sn-paypath]")) return;
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (!signed()) {
        say(pay || now ? "Sign-in required — guests cannot pay." : "Sign-in required — RELOAD after login.");
        return;
      }
      if (reload) {
        say("RELOAD needs PayPal client wiring — no fake capture.");
        return;
      }
      debit(1.0, pay ? "PAY" : "NOW");
    },
    true
  );
})(typeof window !== "undefined" ? window : this);
