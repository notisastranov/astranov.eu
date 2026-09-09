/* SpaceNet 4228 — guest AV€ 0.00 + land-rings Earth + Earth online */
(function (global) {
  "use strict";
  if (global.__SN_4228_GUEST) return;
  global.__SN_4228_GUEST = true;
  var LAND = null;
  var CONT = {"NORTH AMERICA":1,"SOUTH AMERICA":1,"AFRICA":1,"EUROPE":1,"ASIA":1,"OCEANIA":1,"N AMERICA":1,"S AMERICA":1,"AUSTRALIA":1};
  var GUEST_TXT = "AV€ 0.00";
  function signed() {
    try { var u = JSON.parse(localStorage.getItem("sn:user") || "null"); return !!(u && u.email); } catch (e) { return false; }
  }
  function isOwner() {
    try {
      var u = JSON.parse(localStorage.getItem("sn:user") || "null");
      var e = String((u && u.email) || "");
      return !!(e && (/notisastranov@gmail\.com$/i.test(e) || /@astranov\.eu$/i.test(e)));
    } catch (e) { return false; }
  }
  function guestWallet() { return !signed() || !isOwner(); }
  function forceGuestMoney(btn) {
    if (!btn || !guestWallet()) return;
    btn.classList.add("on"); btn.style.display = "flex";
    if (btn.textContent !== GUEST_TXT) btn.textContent = GUEST_TXT;
  }
  function scrubMoney() {
    try {
      var btn = document.getElementById("sn-money"); if (!btn || !guestWallet()) return;
      var t = String(btn.textContent || "");
      if (/3[\s,]?000[\s,]?000/.test(t) || /TREASURY|pool/i.test(t) || t !== GUEST_TXT) forceGuestMoney(btn);
    } catch (e) {}
  }
  function paintGuestMoney() {
    try { var btn = document.getElementById("sn-money"); if (btn && guestWallet()) forceGuestMoney(btn); } catch (e) {}
  }
  function patchAvcGet() {
    try {
      if (!global.SN || typeof global.SN.avcGet !== "function" || global.SN.__avcGet4228) return;
      var _ag = global.SN.avcGet.bind(global.SN);
      global.SN.avcGet = function () {
        if (guestWallet()) {
          try { var n = Number(localStorage.getItem("sn:avc")); return isFinite(n) ? n : 0; } catch (e) { return 0; }
        }
        return _ag();
      };
      global.SN.__avcGet4228 = true;
    } catch (e) {}
  }
  function patchPaintMoney() {
    try {
      if (!global.SN || typeof global.SN.paintMoney !== "function" || global.SN.__paintMoney4228) return;
      var _pm = global.SN.paintMoney.bind(global.SN);
      global.SN.paintMoney = function () { if (guestWallet()) { paintGuestMoney(); return; } return _pm(); };
      global.SN.__paintMoney4228 = true;
    } catch (e) {}
  }
  function patchSay() {
    try {
      if (!global.SN || typeof global.SN.say !== "function" || global.SN.__say4228) return;
      var _say = global.SN.say.bind(global.SN);
      global.SN.say = function (msg) {
        var m = String(msg || "");
        if (guestWallet() && /Grid globe|Pulling replica/i.test(m)) m = "Earth online.";
        return _say(m);
      };
      global.SN.__say4228 = true;
      var line = document.getElementById("line");
      if (line && guestWallet() && /Grid globe|Pulling replica/i.test(line.textContent || "")) line.textContent = "Earth online.";
    } catch (e) {}
  }
  function ensureCam() {
    try {
      if (global.__SN_CAM && global.__SN_CAM.getYaw) return;
      var sn = global.SN && global.SN.cam; if (!sn) return;
      global.__SN_CAM = { getYaw: function () { return +sn.yaw || 0.49; }, getPitch: function () { return +sn.pitch || 0.63; }, getDist: function () { return +sn.dist || 1.85; }, needTick: function () {} };
    } catch (e) {}
  }
  function cam() {
    ensureCam();
    var c = global.__SN_CAM;
    if (c && c.getYaw) return c;
    var sn = global.SN && global.SN.cam;
    if (sn) return { getYaw: function () { return +sn.yaw || 0.49; }, getPitch: function () { return +sn.pitch || 0.63; }, getDist: function () { return +sn.dist || 1.85; } };
    return { getYaw: function () { return 0.49; }, getPitch: function () { return 0.63; }, getDist: function () { return 1.85; } };
  }
  function sph(latDeg, lngDeg, cx, cy, R, yaw, pitch) {
    var la = latDeg * Math.PI / 180, ln = lngDeg * Math.PI / 180 - yaw;
    var x = Math.cos(la) * Math.sin(ln), y = Math.sin(la), z = Math.cos(la) * Math.cos(ln);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    if (z2 <= 0.02) return null;
    return { x: cx + R * x, y: cy - R * y2, z: z2 };
  }
  function paintEarth(ctx, w, h) {
    if (!LAND || !LAND.length) return;
    var c = cam(), yaw = +c.getYaw(), pitch = +c.getPitch(), dist = +c.getDist();
    if (!isFinite(yaw)) yaw = 0.49; if (!isFinite(pitch)) pitch = 0.63; if (!isFinite(dist) || dist < 0.5) dist = 1.85;
    var cx = w * 0.5, cy = h * 0.5, R = Math.min(w, h) * 0.46 / dist; if (!(R > 8)) return;
    ctx.save();
    try {
      var g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
      g.addColorStop(0, "#1a6aa8"); g.addColorStop(0.55, "#0b3d6e"); g.addColorStop(1, "#041628");
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
      for (var i = 0; i < LAND.length; i++) {
        var poly = LAND[i], first = true; ctx.beginPath();
        for (var j = 0; j < poly.length; j++) {
          var q = sph(poly[j][0], poly[j][1], cx, cy, R, yaw, pitch);
          if (!q) { first = true; continue; }
          if (first) { ctx.moveTo(q.x, q.y); first = false; } else ctx.lineTo(q.x, q.y);
        }
        ctx.closePath(); ctx.fillStyle = "rgba(52,140,72,0.92)"; ctx.fill();
        ctx.strokeStyle = "rgba(120,220,140,0.45)"; ctx.lineWidth = 1; ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(126,233,255,0.35)"; ctx.lineWidth = Math.max(1.2, global.devicePixelRatio || 1); ctx.stroke();
    } catch (e) {}
    ctx.restore();
  }
  function isCyan(style) { var s = String(style || ""); return s.indexOf("77,240,255") >= 0 || s.indexOf("126,233,255") >= 0; }
  function isOcean(style) { var s = String(style || "").toLowerCase(); return s === "#041018" || s.indexOf("4,16,24") >= 0 || s.indexOf("4, 16, 24") >= 0; }
  function cssSize(canvas) {
    var cw = canvas.clientWidth || 0, ch = canvas.clientHeight || 0;
    if (cw > 0 && ch > 0) return { w: cw, h: ch };
    var dpr = Math.min(2, global.devicePixelRatio || 1) || 1;
    return { w: (canvas.width || 1) / dpr, h: (canvas.height || 1) / dpr };
  }
  function afterAppDraw(ctx) {
    try {
      if (!ctx || !ctx.canvas || ctx.canvas.id !== "g" || !LAND) return;
      var sz = cssSize(ctx.canvas);
      global.requestAnimationFrame(function () { try { paintEarth(ctx, sz.w, sz.h); } catch (e) {} });
    } catch (e) {}
  }
  function wrapContext(ctx) {
    if (!ctx || ctx.__snEarth4228) return ctx;
    ctx.__snEarth4228 = true;
    var _clear = ctx.clearRect.bind(ctx);
    ctx.clearRect = function (x, y, w, h) { var r = _clear(x, y, w, h); afterAppDraw(ctx); return r; };
    var _fillRect = ctx.fillRect.bind(ctx);
    ctx.fillRect = function (x, y, w, h) { var r = _fillRect(x, y, w, h); afterAppDraw(ctx); return r; };
    var _drawImage = ctx.drawImage.bind(ctx);
    ctx.drawImage = function () { var r = _drawImage.apply(ctx, arguments); afterAppDraw(ctx); return r; };
    var _fill = ctx.fill.bind(ctx);
    ctx.fill = function () {
      try {
        if (ctx.canvas && ctx.canvas.id === "g") {
          if (isOcean(ctx.fillStyle)) { var sz = cssSize(ctx.canvas); paintEarth(ctx, sz.w, sz.h); return; }
          if (isCyan(ctx.fillStyle)) return;
        }
      } catch (e) {}
      return _fill();
    };
    var _stroke = ctx.stroke.bind(ctx);
    ctx.stroke = function () {
      try { if (ctx.canvas && ctx.canvas.id === "g" && isCyan(ctx.strokeStyle)) return; } catch (e) {}
      return _stroke();
    };
    var _fillText = ctx.fillText.bind(ctx);
    ctx.fillText = function (text, x, y, maxW) {
      try { if (ctx.canvas && ctx.canvas.id === "g" && CONT[String(text || "").trim().toUpperCase()]) return; } catch (e) {}
      return maxW != null ? _fillText(text, x, y, maxW) : _fillText(text, x, y);
    };
    return ctx;
  }
  function patchCanvas() {
    var cv = document.getElementById("g");
    if (!cv || cv.__snEarthPatch4228) return;
    cv.__snEarthPatch4228 = true;
    var _get = cv.getContext.bind(cv);
    cv.getContext = function (type, opts) { var c = _get(type, opts); if (type === "2d" && c) wrapContext(c); return c; };
    try { var existing = _get("2d"); if (existing) wrapContext(existing); } catch (e) {}
  }
  function loadRings() {
    fetch("/js/spacenet/assets/land-rings.json?v=4228", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rings) {
        if (rings && rings.length) {
          LAND = rings; global.__SN_LAND_RINGS_4228 = true;
          try { var cv = document.getElementById("g"); if (cv) { var ctx = cv.getContext("2d"), sz = cssSize(cv); if (ctx) paintEarth(ctx, sz.w, sz.h); } } catch (e) {}
        }
      }).catch(function () {});
  }
  function observeMoney() {
    try {
      if (global.__SN_MO_4228) return;
      var btn = document.getElementById("sn-money"); if (!btn) return;
      var mo = new MutationObserver(function () { scrubMoney(); });
      mo.observe(btn, { characterData: true, childList: true, subtree: true, attributes: true });
      global.__SN_MO_4228 = mo;
    } catch (e) {}
  }
  function boot() {
    patchCanvas(); loadRings(); ensureCam(); patchAvcGet(); patchPaintMoney(); patchSay();
    paintGuestMoney(); observeMoney(); scrubMoney();
    try { if (guestWallet() && global.SN && global.SN.say) global.SN.say("Earth online."); } catch (e) {}
    setTimeout(patchSay, 0); setTimeout(patchSay, 200); setTimeout(paintGuestMoney, 0); setTimeout(scrubMoney, 50);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  setInterval(function () {
    ensureCam(); patchAvcGet(); patchPaintMoney(); patchSay(); paintGuestMoney(); scrubMoney(); observeMoney(); patchCanvas();
  }, 500);
})(typeof window !== "undefined" ? window : this);
