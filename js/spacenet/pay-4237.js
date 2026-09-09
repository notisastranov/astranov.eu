/* SpaceNet 4237 — real PayPal RELOAD EUR→AV€ 1:1; NOW/PAY debit; scrub 3M. No fake capture. No document.write. */
(function (g) {
  "use strict";
  if (g.__SN_PAY_4237) return;
  g.__SN_PAY_4237 = true;
  var OWNER = /notisastranov@gmail\.com$|@astranov\.eu$/i;
  var DUMMY = 3000000;
  var PENDING_KEY = "sn:paypal:orderId";
  var AMOUNT_KEY = "sn:paypal:amount";
  var DEFAULT_EUR = 10;
  var capturing = false;

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
  function accessToken() {
    try {
      return String(localStorage.getItem("sn:access") || "");
    } catch (e) {
      return "";
    }
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
  function credit(eur) {
    scrubDummy();
    var add = Math.round(Number(eur) * 100) / 100;
    if (!(add > 0)) return bal();
    var before = bal();
    var next = Math.round((before + add) * 100) / 100;
    setBal(next);
    return next;
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
  function clearPending() {
    try {
      sessionStorage.removeItem(PENDING_KEY);
      sessionStorage.removeItem(AMOUNT_KEY);
    } catch (e) {}
  }
  function savePending(orderId, amount) {
    try {
      sessionStorage.setItem(PENDING_KEY, String(orderId));
      sessionStorage.setItem(AMOUNT_KEY, String(amount));
    } catch (e) {}
  }
  function pendingOrder() {
    try {
      return String(sessionStorage.getItem(PENDING_KEY) || "").trim();
    } catch (e) {
      return "";
    }
  }
  function cleanPaypalUrl() {
    try {
      var u = new URL(location.href);
      if (!u.searchParams.has("paypal") && !u.searchParams.has("token") && !u.searchParams.has("PayerID")) return;
      u.searchParams.delete("paypal");
      u.searchParams.delete("token");
      u.searchParams.delete("PayerID");
      var q = u.searchParams.toString();
      history.replaceState({}, "", u.pathname + (q ? "?" + q : "") + u.hash);
    } catch (e) {}
  }
  function debit(fee, why) {
    scrubDummy();
    var before = bal();
    if (!(before > 0)) {
      say("wallet not funded — RELOAD");
      paintChip(0);
      return false;
    }
    if (before < fee) {
      say("Insufficient AV€ — need " + fee.toFixed(2) + ", have " + before.toFixed(2) + ".");
      paintChip(before);
      return false;
    }
    var next = Math.round((before - fee) * 100) / 100;
    setBal(next);
    paintChip(next);
    say((why || "Paid") + " · AV€ " + before.toFixed(2) + " → " + next.toFixed(2));
    return true;
  }
  function jsonHeaders() {
    var h = { "Content-Type": "application/json", Accept: "application/json" };
    var t = accessToken();
    if (t) h.Authorization = "Bearer " + t;
    return h;
  }
  function doCapture(orderId) {
    if (capturing) return Promise.resolve(false);
    if (!signed()) {
      say("Sign-in required — guests cannot pay.");
      clearPending();
      cleanPaypalUrl();
      return Promise.resolve(false);
    }
    orderId = String(orderId || "").trim();
    if (!/^[a-z0-9-]{8,64}$/i.test(orderId)) {
      say("PayPal return missing order — try RELOAD again.");
      clearPending();
      cleanPaypalUrl();
      return Promise.resolve(false);
    }
    capturing = true;
    say("Capturing PayPal order…");
    return fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: jsonHeaders(),
      body: JSON.stringify({ orderId: orderId, token: orderId })
    })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j || {} };
        });
      })
      .then(function (pack) {
        capturing = false;
        var j = pack.j;
        if (!pack.ok || !j.ok || !j.paid) {
          say((j && (j.error || j.message)) || "PayPal capture failed — no credit.");
          clearPending();
          cleanPaypalUrl();
          return false;
        }
        var eur = Math.round(Number(j.eur != null ? j.eur : j.avc != null ? j.avc : 0) * 100) / 100;
        if (!(eur > 0)) {
          say("Capture returned no EUR — no credit.");
          clearPending();
          cleanPaypalUrl();
          return false;
        }
        var before = bal();
        var next = credit(eur);
        paintChip(next);
        clearPending();
        cleanPaypalUrl();
        say("RELOAD credited +" + eur.toFixed(2) + " AV€ · " + before.toFixed(2) + " → " + next.toFixed(2));
        return true;
      })
      .catch(function (err) {
        capturing = false;
        say("PayPal capture error — " + String((err && err.message) || err || "network"));
        cleanPaypalUrl();
        return false;
      });
  }
  function startReload() {
    if (!signed()) {
      say("Sign-in required — RELOAD after login.");
      return;
    }
    scrubDummy();
    say("Checking PayPal…");
    fetch("/api/paypal/config", { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" })
      .then(function (r) {
        return r.json().then(function (j) {
          return { ok: r.ok, j: j || {} };
        });
      })
      .then(function (pack) {
        var cfg = pack.j;
        if (!pack.ok || !cfg.configured) {
          say("PayPal not configured on server.");
          return;
        }
        say("Creating PayPal order · " + DEFAULT_EUR.toFixed(2) + " EUR…");
        return fetch("/api/paypal/create-order", {
          method: "POST",
          headers: jsonHeaders(),
          body: JSON.stringify({
            amount: DEFAULT_EUR,
            eur: DEFAULT_EUR,
            origin: location.origin,
            reference: email() || "AVC deposit"
          })
        }).then(function (r) {
          return r.json().then(function (j) {
            return { ok: r.ok, j: j || {} };
          });
        });
      })
      .then(function (pack) {
        if (!pack) return;
        var j = pack.j;
        if (!pack.ok || !j.ok || !j.orderId) {
          say((j && (j.error || j.message)) || "PayPal create-order failed.");
          return;
        }
        var approve = j.approve || j.url;
        if (!approve) {
          say("PayPal approve URL missing.");
          return;
        }
        savePending(j.orderId, j.amount != null ? j.amount : DEFAULT_EUR);
        say("Opening PayPal…");
        g.location.href = approve;
      })
      .catch(function (err) {
        say("PayPal error — " + String((err && err.message) || err || "network"));
      });
  }
  function handleReturn() {
    var u;
    try {
      u = new URL(location.href);
    } catch (e) {
      return;
    }
    var flag = String(u.searchParams.get("paypal") || "").toLowerCase();
    var token = String(u.searchParams.get("token") || "").trim();
    if (flag === "cancel") {
      clearPending();
      cleanPaypalUrl();
      say("PayPal cancelled — no credit.");
      return;
    }
    var orderId = token || pendingOrder();
    if (flag === "success" || token) {
      if (!orderId) {
        say("PayPal return missing order — try RELOAD again.");
        cleanPaypalUrl();
        return;
      }
      doCapture(orderId);
    }
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
        startReload();
        return;
      }
      debit(1.0, pay ? "PAY" : "NOW");
    },
    true
  );
  function bootReturn() {
    try {
      handleReturn();
    } catch (e) {}
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootReturn);
  else bootReturn();
})(typeof window !== "undefined" ? window : this);
