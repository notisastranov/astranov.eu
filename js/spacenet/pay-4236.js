/* SpaceNet 4236 — signed-in NOW/PAY debit; scrub fake 3M; paint chip immediately. No document.write. */
(function (g) {
  "use strict";
  if (g.__SN_PAY_4236) return;
  g.__SN_PAY_4236 = true;
  var OWNER = /notisastranov@gmail\.com$|@astranov\.eu$/i;
  var DUMMY = 3000000;

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
    try {
      if (g.SN && typeof SN.scrubDummy3M === "function") SN.scrubDummy3M();
    } catch (e2) {}
    return hit;
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
    scrubDummy();
    if (!signed()) return 0;
    if (owner()) {
      var p = readNum("sn:pool");
      if (isDummy(p)) {
        scrubKey("sn:pool");
        p = NaN;
      }
      if (isFinite(p)) return Math.max(0, p);
      var a = readNum("sn:avc");
      if (isDummy(a)) {
        scrubKey("sn:avc");
        a = NaN;
      }
      return isFinite(a) ? Math.max(0, a) : 0;
    }
    var a2 = readNum("sn:avc");
    if (isDummy(a2)) {
      scrubKey("sn:avc");
      a2 = NaN;
    }
    return isFinite(a2) ? Math.max(0, a2) : 0;
  }
  function setBal(n) {
    n = Math.max(0, Math.round(Number(n) * 100) / 100);
    if (owner()) writeNum("sn:pool", n);
    else writeNum("sn:avc", n);
  }
  function stars() {
    try {
      var s = Number(localStorage.getItem("sn:stars"));
      return isFinite(s) ? Math.max(0, Math.floor(s)) : 0;
    } catch (e) {
      return 0;
    }
  }
  function moneyLabel(n) {
    return "AV€ " + Number(n).toFixed(2) + " · " + stars() + "⭐";
  }
  function say(m) {
    try {
      var line = document.getElementById("line");
      if (line) line.textContent = m;
    } catch (e) {}
  }
  function paintChip(n) {
    var label = moneyLabel(n);
    try {
      if (g.SN && typeof SN.paintMoney === "function") SN.paintMoney();
    } catch (e) {}
    try {
      var btn = document.getElementById("sn-money");
      if (btn && signed()) {
        btn.removeAttribute("hidden");
        btn.classList.add("on");
        btn.style.setProperty("display", "inline-flex", "important");
        btn.textContent = label;
      }
    } catch (e2) {}
    try {
      g.dispatchEvent(new Event("sn:avc"));
    } catch (e3) {}
    try {
      g.dispatchEvent(
        new StorageEvent("storage", {
          key: owner() ? "sn:pool" : "sn:avc",
          newValue: String(n),
          storageArea: localStorage
        })
      );
    } catch (e4) {}
  }
  function debit(fee, why) {
    scrubDummy();
    var b = bal();
    /* dummy 3M already scrubbed → start from 0; refuse if unfunded */
    if (!(b > 0)) {
      say("wallet not funded — RELOAD");
      paintChip(0);
      return false;
    }
    if (b < fee) {
      say("Insufficient AV€ — need " + fee.toFixed(2) + ", have " + b.toFixed(2) + ".");
      paintChip(b);
      return false;
    }
    var next = Math.round((b - fee) * 100) / 100;
    setBal(next);
    paintChip(next);
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
