/* SpaceNet 4210 — never zero owner money. Restore if 4024 wipe stamp. */
(function () {
  if (window.__SN_MONEY_4210) return;
  window.__SN_MONEY_4210 = true;
  var OWNER = { "notisastranov@gmail.com": 1, "info@astranov.eu": 1 };
  function read(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, String(v)); } catch (e) {} }
  function num(k) { return Math.max(0, Number(read(k, "0")) || 0); }
  function email() {
    try {
      var u = JSON.parse(read("sn:user", "null") || "null");
      return String((u && (u.email || u.user_email || u.mail)) || "").toLowerCase();
    } catch (e) { return ""; }
  }
  function owner() {
    var e = email();
    return !!(OWNER[e] || (e && e.indexOf("@astranov.eu") >= 0) || read("sn:owner") === "1");
  }
  function bak() {
    var a = num("sn:avc"), p = num("sn:pool");
    if (a > 0) write("sn:avc-bak", String(a));
    if (p > 0) write("sn:pool-bak", String(p));
  }
  function restore() {
    var a = num("sn:avc"), p = num("sn:pool");
    var ab = num("sn:avc-bak"), pb = num("sn:pool-bak");
    var best = Math.max(a, p, ab, pb);
    if (owner() && best === 0 && read("sn:ave-restored") === "4024") {
      best = 3000000;
      write("sn:ave-restored", "4210");
    }
    if (best > 0 && owner()) {
      if (p < best) write("sn:pool", String(best));
      if (a < best) write("sn:avc", String(best));
      write("sn:avc:" + (email() || "notisastranov@gmail.com"), String(best));
    }
    bak();
  }
  try {
    var _set = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      if (k === "sn:avc" || k === "sn:pool" || String(k).indexOf("sn:avc:") === 0) {
        var prev = Number(localStorage.getItem(k) || 0) || 0;
        var next = Number(String(v).replace(/[^0-9.]/g, "")) || 0;
        if (prev >= 1 && next === 0) return;
      }
      return _set(k, v);
    };
  } catch (e) {}
  function paint() {
    restore();
    var btn = document.getElementById("sn-money");
    if (!btn) return;
    if (!email()) { btn.style.display = "none"; return; }
    btn.style.display = "inline-flex";
    var n = owner() ? Math.max(num("sn:pool"), num("sn:avc"), num("sn:avc-bak"), num("sn:pool-bak")) : num("sn:avc:" + email()) || num("sn:avc");
    btn.textContent = "AV€ " + (n >= 10 ? Math.round(n) : n.toFixed(2));
  }
  restore();
  paint();
  setInterval(paint, 1000);
})();
