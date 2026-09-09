/* SpaceNet 4234 — signed-in NOW/PAY/RELOAD local ledger. Guest blocked. No fake PayPal. */
(function (global) {
  "use strict";
  if (global.__SN_PAY_4234) return;
  global.__SN_PAY_4234 = true;
  function unsigned() {
    try { var u = JSON.parse(localStorage.getItem("sn:user") || "null"); return !(u && u.email); }
    catch (e) { return true; }
  }
  function email() {
    try { var u = JSON.parse(localStorage.getItem("sn:user") || "null"); return String((u && u.email) || "").trim(); }
    catch (e) { return ""; }
  }
  function isOwner() {
    var e = email();
    return !!(e && (/notisastranov@gmail\.com$/i.test(e) || /@astranov\.eu$/i.test(e)));
  }
  function readNum(k) {
    try { var n = Number(localStorage.getItem(k)); return isFinite(n) ? n : NaN; } catch (e) { return NaN; }
  }
  function writeNum(k, n) {
    try { localStorage.setItem(k, String(Math.round(Number(n) * 100) / 100)); } catch (e) {}
  }
  function walletBal() {
    if (unsigned()) return 0;
    if (isOwner()) {
      var pool = readNum("sn:pool");
      if (isFinite(pool)) return Math.max(0, pool);
      var avc = readNum("sn:avc");
      return isFinite(avc) ? Math.max(0, avc) : 0;
    }
    var keyed = readNum("sn:avc:" + email().toLowerCase());
    if (isFinite(keyed)) return Math.max(0, keyed);
    var a = readNum("sn:avc");
    return isFinite(a) ? Math.max(0, a) : 0;
  }
  function walletSet(n) {
    n = Math.max(0, Math.round(Number(n) * 100) / 100);
    if (isOwner()) { writeNum("sn:pool", n); return; }
    writeNum("sn:avc", n);
    try { writeNum("sn:avc:" + email().toLowerCase(), n); } catch (e) {}
  }
  function say(msg) {
    try { var line = document.getElementById("line"); if (line) line.textContent = msg; } catch (e) {}
    try { if (global.SN && SN.talk) SN.talk(msg); else if (global.SN && SN.say) SN.say(msg); } catch (e) {}
  }
  function debit(fee, reason) {
    var bal = walletBal();
    if (bal < fee) { say("Insufficient AV€ — need " + fee.toFixed(2) + ", have " + bal.toFixed(2) + "."); return false; }
    var next = Math.round((bal - fee) * 100) / 100;
    walletSet(next);
    try { if (global.SN && typeof SN.paintMoney === "function") SN.paintMoney(); } catch (e) {}
    say((reason || "Paid") + " · −" + fee.toFixed(2) + " AV€ · bal " + next.toFixed(2));
    return true;
  }
  function tryReload() {
    if (global.__SN_PAYPAL_RELOAD || (global.SN && typeof SN.paypalReload === "function") || (global.SNWallet && typeof SNWallet.reload === "function")) {
      try {
        if (global.SN && typeof SN.paypalReload === "function") return void SN.paypalReload();
        if (global.SNWallet && typeof SNWallet.reload === "function") return void SNWallet.reload(10);
        if (typeof global.__SN_PAYPAL_RELOAD === "function") return void global.__SN_PAYPAL_RELOAD(10);
      } catch (e) {}
    }
    say("RELOAD needs PayPal client wiring — no fake capture.");
  }
  document.addEventListener("click", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var pay = t.closest('#sn-paypath-4233 [data-act="pay"], #sn-paypath-4234 [data-act="pay"], #sn-sheet [data-act="pay"]');
    var now = t.closest('#sn-paypath-4233 [data-act="now"], #sn-paypath-4234 [data-act="now"], #sn-sheet [data-act="now"]');
    var reload = t.closest('#sn-paypath-4233 [data-act="reload"], #sn-paypath-4234 [data-act="reload"], #sn-sheet [data-act="reload"]');
    if (!pay && !now && !reload) return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    if (unsigned()) {
      if (pay) say("Sign-in required — guests cannot pay.");
      else if (now) say("Sign-in required — no guest delivery.");
      else say("Sign-in required — RELOAD after login.");
      return;
    }
    if (reload) return void tryReload();
    debit(1.0, pay ? "PAY" : "NOW");
  }, true);
})(typeof window !== "undefined" ? window : this);
