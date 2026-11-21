/* SpaceNet 4444 — land.pack external; drop root failure junk. */
(function () {
  "use strict";
  var VER = "4444";
  var INTRO_MS = 13000;
  var LAND = [];
  function unpackLand(pack) {
    var parts = String(pack || "").split(";");
    var out = [];
    for (var i = 0; i < parts.length; i++) {
      if (!parts[i]) continue;
      var bits = parts[i].split(" ");
      var ring = [];
      for (var j = 0; j < bits.length; j++) {
        var p = bits[j].split(",");
        if (p.length < 2) continue;
        ring.push([+p[0], +p[1]]);
      }
      if (ring.length >= 3) out.push(ring);
    }
    LAND = out;
  }
  function loadLand() {
    fetch("/js/spacenet/land.pack?v=" + VER, { cache: "force-cache" })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(unpackLand)
      .catch(function () {});
  }
  var LABELS = [
    { name: "AFRICA", lat: 7, lng: 20 },
    { name: "EUROPE", lat: 50, lng: 15 },
    { name: "ASIA", lat: 45, lng: 90 },
    { name: "AUSTRALIA", lat: -25, lng: 134 },
    { name: "N AMERICA", lat: 45, lng: -100 },
    { name: "S AMERICA", lat: -15, lng: -60 }
  ];
  var SITES = [
    { lat: 36.44, lng: 28.23, c: "#c8f4ff", n: "RHODES" },
    { lat: 37.98, lng: 23.73, c: "#b8ead8", n: "ATHENS" },
    { lat: 51.50, lng: -0.12, c: "#d0e8ff", n: "LONDON" },
    { lat: 40.71, lng: -74.01, c: "#ffe0a8", n: "NEW YORK" },
    { lat: 35.68, lng: 139.69, c: "#ffd0e8", n: "TOKYO" },
    { lat: -1.29, lng: 36.82, c: "#ffc89a", n: "NAIROBI" },
    { lat: 1.35, lng: 103.82, c: "#c8e8ff", n: "SINGAPORE" },
    { lat: -33.87, lng: 151.21, c: "#c8f0d0", n: "SYDNEY" },
    { lat: 55.75, lng: 37.62, c: "#ddd0ff", n: "MOSCOW" },
    { lat: -23.55, lng: -46.63, c: "#ffd0b0", n: "SAO PAULO" }
  ];
  var NEWS = [
    "SPACENET · EARTH LIVE",
    "RADAR · PLANETARY SWEEP",
    "MESH · WAITING FOR A NODE",
    "ISS · NIGHT PASS",
    "AEGEAN · CORRIDOR QUIET",
    "SURFACE · VECTOR SCAN",
    "AV€ · WORK-MINTED ONLY"
  ];

  var cam = { yaw: 0.49, pitch: 0.35, dist: 1.85 };
  var vel = { yaw: 0, pitch: 0 };
  var fly = null;
  var here = null;
  var intro = true;
  var introT0 = 0;
  var newsI = -1;
  var stars = [];
  var shops = [];
  var map = null;
  var youMark = null;
  var canvas, ctx;
  var lastT = 0;
  var drag = null;
  var pointers = new Map();
  var pinch = null;
  var holdT = 0;
  var cityOn = false;
  var skyOn = false;
  var skyHits = [];
  var skyAsked = false;
  var listingTried = false;
  var vendor = null;
  var drop = null;
  var jobs = [];
  var shopMarks = [];
  var routeLayer = null;
  var driverMark = null;
  var plotMark = null;
  var actorMarks = [];
  var peerThread = null;
  var gpsWatchId = 0;
  var verifyState = { vendor: false, client: false, driver: false };
  var cart = { items: {}, comment: "" };
  var FEE_PCT = 0.03;
  var offerCdTimer = null;
  var offerCdLeft = 0;
  var offerActiveId = null;
  var pendingOffer = null;
  var powerCdTimer = null;
  var quoteOpts = { rain: false, floor: false, tip: 0 };
  var STAGES = ["ACCEPT", "PICKUP HANDOFF", "IN TRANSIT", "DELIVERED", "RECEIVED"];
  var view = { cx: 0, cy: 0, scale: 120, w: 1, h: 1 };
  var SIDEREAL_DAY_S = 86164.0905;
  var SIDEREAL_OMEGA = (Math.PI * 2) / SIDEREAL_DAY_S;
  var listPt = null;
  var listAlt = "street";
  var FAMOUS_VENDORS = [
    { name: "Pizzarium Analipsi", lat: 36.4251, lng: 28.2111, kind: "vendor", phone: "+302241601878", address: "Athinas Tarsouli 1, Analipsi, Rhodes", famous: true, menu: [{ name: "Margherita", price: "12", note: "Wood oven", hours: "12:00–23:00", stock: "in" }, { name: "Diavola", price: "14", note: "Spicy", hours: "12:00–23:00", stock: "in" }] },
    { name: "Marmarades Olive Grove", lat: 36.38752, lng: 28.2225, kind: "vendor", famous: true },
    { name: "Lindos Bay Market", lat: 36.0917, lng: 28.0856, kind: "vendor", famous: true },
    { name: "Rhodes Old Town Bakery", lat: 36.4432, lng: 28.2275, kind: "vendor", famous: true },
    { name: "Ialysos Pharmacy", lat: 36.4135, lng: 28.1558, kind: "vendor", famous: true }
  ];
  function loadActors() {
    try {
      var rows = JSON.parse(localStorage.getItem("sn:actors") || "[]") || [];
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }
  function saveActors(rows) {
    try { localStorage.setItem("sn:actors", JSON.stringify((rows || []).slice(0, 120))); } catch (e) {}
  }
  function loadVerify() {
    try {
      var v = JSON.parse(localStorage.getItem("sn:verify") || "null");
      if (v && typeof v === "object") verifyState = Object.assign({ vendor: false, client: false, driver: false }, v);
    } catch (e) {}
  }
  function saveVerify() {
    try { localStorage.setItem("sn:verify", JSON.stringify(verifyState)); } catch (e) {}
  }
  function needLogin(why) {
    say((why || "LOGIN first.") + "");
    if (window.SNAuth && SNAuth.google) SNAuth.google();
    else if (window.SNAuth && SNAuth.open) SNAuth.open();
  }
  function isProductBug(text) {
    var t = String(text || "").toLowerCase();
    if (!t) return false;
    if (/peer|message (him|her|them|driver|vendor|client)|dispute with|refund (me|from)|pay the driver|order (late|wrong)|where is my|talk to (the )?(driver|vendor|client)/.test(t)) return false;
    return /bug|broken|crash|error|glitch|freeze|won't|wont|can't|cant|login|power|offer|drawer|map|globe|button|ui|screen|reload|cache|wallet|av€|paypal|stamp|cursor|fix|product/.test(t);
  }
  function daysSinceJ2000() { return Date.now() / 86400000 + 2440587.5 - 2451545.0; }
  function earthSpin() { return (Date.now() / 1000) * SIDEREAL_OMEGA; }
  function solarLngDeg() {
    var s = ((Date.now() / 1000) % 86400) / 86400;
    return 180 - s * 360;
  }
  var TIERS = [
    { id: "galaxy", dist: 9.2, name: "Galaxy" },
    { id: "solar", dist: 5.4, name: "Solar system" },
    { id: "global", dist: 1.85, name: "Globe" },
    { id: "national", dist: 0.72, name: "National" },
    { id: "city", dist: 0.72, name: "City" }
  ];
  var tierI = 2;
  var tierLock = 0;
  var aim = null;
  var gpsSeq = 0;
  var freeLook = false; /* user spun the globe — do not snap/face-hold aim */
  var cityEnterAcc = 0; /* slow continuous zoom into city */
  var txns = []; /* completed exchanges (≥5y retention mirrored to Supabase) */
  var activeExchange = []; /* command turns for the current open task */
  function altitudeFromDist(d) {
    if (cityOn) return "street";
    if (d < 1.15) return "national";
    if (d < 3) return "globe";
    if (d < 7) return "solar";
    return "galaxy";
  }

  function $(id) { return document.getElementById(id); }
  var sayHold = 0;
  function say(s) {
    /* Status text is silent on chrome — Notis forbids floating instruction banners. */
    var msg = String(s == null ? "" : s);
    ["line", "toast"].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      el.textContent = msg;
      el.classList.remove("on");
      el.hidden = true;
    });
    sayHold = Date.now();
    try { if (typeof paintDrawerContent === "function") paintDrawerContent(); } catch (e) {}
  }
  function ownerMail() {
    try {
      var u = window.SNAuth && SNAuth.user && SNAuth.user();
      return !!(u && String(u.email || "").toLowerCase() === "notisastranov@gmail.com");
    } catch (e) { return false; }
  }
  function avcGet() {
    try {
      var n = Number(localStorage.getItem("sn:avc"));
      return isFinite(n) && n >= 0 ? n : 0;
    } catch (e) { return 0; }
  }
  function avcSet(n) {
    n = Math.max(0, Math.round(Number(n) || 0));
    try { localStorage.setItem("sn:avc", String(n)); } catch (e) {}
    paintMoney();
    return n;
  }
  function grantSignupCredit() {
    try {
      var u = window.SNAuth && SNAuth.user && SNAuth.user();
      if (!u || !u.email) return false;
      var key = "sn:credit:" + String(u.email).toLowerCase();
      if (localStorage.getItem(key) === "1") return false;
      localStorage.setItem(key, "1");
      avcSet(avcGet() + 300);
      say("Welcome · 300 AV€ testing credit.");
      return true;
    } catch (e) { return false; }
  }
  function topUp(rail, eur) {
    if (!signed()) { needLogin("LOGIN to top up AV€."); return; }
    eur = Math.round(Number(eur) * 100) / 100;
    if (!isFinite(eur) || eur < 1) { say("Type how many euro."); return; }
    rail = String(rail || "paypal").toLowerCase();
    say("Opening " + rail + " for " + eur + " € → AV€…");
    var path = rail === "stripe" ? "/api/stripe/create-checkout" : rail === "revolut" ? "/api/revolut/create-order" : "/api/paypal/create-order";
    fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: eur, origin: location.origin, reference: "deposit", currency: "AV€", rail: rail })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var url = (j && (j.approve || j.url || j.checkout));
      if (!url) { say((j && (j.error || j.message)) || (rail + " not configured — set env secrets.")); return; }
      try { localStorage.setItem("sn:pay-deposit", String(eur)); localStorage.setItem("sn:pay-rail", rail); } catch (e) {}
      location.href = url;
    }).catch(function () { say(rail + " dark. Check env secrets."); });
  }
  function poolGet() {
    try {
      var n = Number(localStorage.getItem("sn:pool"));
      return isFinite(n) ? n : 0;
    } catch (e) { return 0; }
  }
  function paintMoney() {
    var btn = $("sn-money");
    if (!btn) return;
    btn.hidden = false;
    btn.style.display = "inline-flex";
    btn.classList.add("on");
    var tgt = btn.querySelector(".tgt") || btn;
    var lbl = btn.querySelector(".lbl");
    if (lbl) lbl.style.display = "none";
    var n = Math.round(avcGet());
    tgt.textContent = n.toLocaleString("en-GB") + " AV€";
    btn.setAttribute("aria-label", "Wallet · " + n + " AV€");
  }
  function signed() {
    try {
      if (window.SNAuth && SNAuth.user) {
        var u = SNAuth.user();
        return !!(u && u.email);
      }
    } catch (e) {}
    return false;
  }
  function visRect(el) {
    if (!el) return null;
    var cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || Number(cs.opacity) === 0) return null;
    var r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;
    return { left: r.left, top: r.top, right: r.right, bottom: r.bottom, width: r.width, height: r.height };
  }
  function boxesHit(a, b, pad) {
    pad = pad == null ? 8 : pad;
    return a.left < b.right + pad && a.right > b.left - pad && a.top < b.bottom + pad && a.bottom > b.top - pad;
  }
  function fitView() {
    var w = window.innerWidth, h = window.innerHeight;
    if (canvas) {
      canvas.style.position = "fixed";
      canvas.style.left = "0";
      canvas.style.top = "0";
      canvas.style.right = "0";
      canvas.style.bottom = "0";
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      canvas.style.display = "block";
    }
    var top = 16, bot = h - 16;
    var isl = visRect($("island"));
    var panel = visRect($("panel"));
    if (isl) top = Math.max(top, isl.bottom + 12);
    if (panel) bot = Math.min(bot, panel.top - 12);
    if (bot - top < 120) { top = 16; bot = h - 16; }
    var cx = w / 2;
    var cy = (top + bot) / 2;
    var base = Math.max(120, Math.min((bot - top) * 0.46, w * 0.46));
    var zoom = 1.85 / Math.max(0.55, cam.dist || 1.85);
    var scale = base * zoom;
    view = { w: w, h: h, cx: cx, cy: cy, scale: scale, top: top, bot: bot };
  }
  function project(lat, lng, c) {
    var λ = (lng * Math.PI) / 180 - c.yaw - earthSpin();
    var φ = (lat * Math.PI) / 180;
    var x = Math.cos(φ) * Math.sin(λ);
    var y = Math.sin(φ);
    var z = Math.cos(φ) * Math.cos(λ);
    var cy = y * Math.cos(c.pitch) - z * Math.sin(c.pitch);
    var cz = y * Math.sin(c.pitch) + z * Math.cos(c.pitch);
    if (cz < 0.04) return null;
    return { x: view.cx + x * view.scale, y: view.cy - cy * view.scale, z: cz, s: view.scale };
  }
  function globeHit(sx, sy, c) {
    var scale = view.scale;
    var nx = (sx - view.cx) / scale, ny = (view.cy - sy) / scale, r2 = nx * nx + ny * ny;
    if (r2 > 1) return null;
    var nz = Math.sqrt(Math.max(0, 1 - r2));
    var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    var y = ny * cp + nz * sp, z = -ny * sp + nz * cp, x = nx;
    var lat = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI;
    var lng = ((Math.atan2(x, z) + c.yaw + earthSpin()) * 180) / Math.PI;
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    return { lat: lat, lng: lng };
  }
  function wrapYaw(from, to) {
    var d = to - from;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return from + d;
  }
  function lookAt(p, dist) {
    cam.yaw = (p.lng * Math.PI) / 180 - earthSpin();
    cam.pitch = Math.max(-1.15, Math.min(1.15, (p.lat * Math.PI) / 180));
    cam.dist = dist == null ? 1.16 : dist;
    vel.yaw = 0; vel.pitch = 0; fly = null;
  }
  function flyTo(p, dist) {
    var goalYaw = wrapYaw(cam.yaw, (p.lng * Math.PI) / 180 - earthSpin());
    fly = {
      t0: performance.now(),
      ms: 1100,
      start: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist },
      goal: {
        yaw: goalYaw,
        pitch: Math.max(-1.15, Math.min(1.15, (p.lat * Math.PI) / 180)),
        dist: dist == null ? 1.12 : dist
      }
    };
    vel.yaw = 0; vel.pitch = 0;
  }
  function seedStars() {
    stars = [];
    for (var i = 0; i < 240; i++) stars.push({ x: Math.random(), y: Math.random(), a: 0.12 + Math.random() * 0.7, s: Math.random() < 0.12 ? 2 : 1.2 });
  }
  function vecOf(lat, lng, c) {
    var lam = (lng * Math.PI) / 180 - c.yaw - earthSpin();
    var phi = (lat * Math.PI) / 180;
    var x = Math.cos(phi) * Math.sin(lam);
    var y = Math.sin(phi);
    var z = Math.cos(phi) * Math.cos(lam);
    var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    return { x: x, y: y * cp - z * sp, z: y * sp + z * cp };
  }
  function scrOf(v) {
    return { x: view.cx + v.x * view.scale, y: view.cy - v.y * view.scale, z: v.z };
  }
  function limbArc(ctx, a, b) {
    var a0 = Math.atan2(a.y - view.cy, a.x - view.cx);
    var a1 = Math.atan2(b.y - view.cy, b.x - view.cx);
    var d = a1 - a0;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    if (Math.abs(d) < 0.01) return;
    ctx.arc(view.cx, view.cy, view.scale * 0.998, a0, a1, d < 0);
  }
  function drawLand(ctx, ring, c) {
    var n = ring.length, step = Math.max(1, (n / 4) | 0), seen = false, i;
    for (i = 0; i < n; i += step) {
      if (vecOf(ring[i][0], ring[i][1], c).z > 0.02) { seen = true; break; }
    }
    if (!seen) return;
    var LIMB = 0.045;
    ctx.beginPath();
    var pen = false, limb = null;
    for (i = 0; i < n; i++) {
      var a = ring[i], b = ring[(i + 1) % n];
      var dl = b[1] - a[1];
      if (dl > 180) dl -= 360;
      if (dl < -180) dl += 360;
      if (Math.abs(dl) > 40) { pen = false; limb = null; continue; }
      var va = vecOf(a[0], a[1], c), vb = vecOf(b[0], b[1], c);
      var fa = va.z >= LIMB, fb = vb.z >= LIMB;
      if (!fa && !fb) { pen = false; continue; }
      var sa = scrOf(va), sb = scrOf(vb), sm;
      if (fa !== fb) {
        var t = (LIMB - va.z) / (vb.z - va.z);
        sm = scrOf({ x: va.x + (vb.x - va.x) * t, y: va.y + (vb.y - va.y) * t, z: LIMB });
      }
      if (fa && fb) {
        if (!pen) ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sb.x, sb.y);
        pen = true;
      } else if (fa && !fb) {
        if (!pen) ctx.moveTo(sa.x, sa.y);
        ctx.lineTo(sm.x, sm.y);
        limb = sm;
        pen = false;
      } else {
        if (limb) limbArc(ctx, limb, sm);
        else ctx.moveTo(sm.x, sm.y);
        ctx.lineTo(sb.x, sb.y);
        limb = null;
        pen = true;
      }
    }
    ctx.fill();
    ctx.stroke();
  }
  function drawGlobe(now) {
    if (!canvas || !ctx) return;
    fitView();
    var dpr = Math.min(2.5, window.devicePixelRatio || 1);
    var w = view.w, h = view.h;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var i, p, lat, lng, first;
    for (i = 0; i < stars.length; i++) {
      ctx.fillStyle = "rgba(210,245,255," + stars[i].a + ")";
      ctx.fillRect(stars[i].x * w, stars[i].y * h, stars[i].s || 1.2, stars[i].s || 1.2);
    }
    if (cam.dist > 3) { drawOrrery(now); return; }
    var cx = view.cx, cy = view.cy, r = view.scale;
    var glow = ctx.createRadialGradient(cx, cy, r * 0.82, cx, cy, r * 1.12);
    glow.addColorStop(0, "rgba(80,180,220,0)");
    glow.addColorStop(0.7, "rgba(60,160,210,0.05)");
    glow.addColorStop(1, "rgba(90,200,230,0.28)");
    ctx.beginPath(); ctx.arc(cx, cy, r * 1.1, 0, Math.PI * 2);
    ctx.fillStyle = glow; ctx.fill();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    var ocean = ctx.createRadialGradient(cx - r * 0.28, cy - r * 0.32, r * 0.1, cx, cy, r);
    ocean.addColorStop(0, "#1a5c78");
    ocean.addColorStop(0.45, "#0c3348");
    ocean.addColorStop(1, "#07141c");
    ctx.fillStyle = ocean; ctx.fill();
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.strokeStyle = "rgba(150,205,220,0.16)"; ctx.lineWidth = 0.5;
    for (lat = -75; lat <= 75; lat += 15) {
      ctx.beginPath(); first = true;
      for (lng = -180; lng <= 180; lng += 3) {
        p = project(lat, lng, cam);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (lng = -180; lng < 180; lng += 15) {
      ctx.beginPath(); first = true;
      for (lat = -80; lat <= 80; lat += 4) {
        p = project(lat, lng, cam);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    var spec = ctx.createRadialGradient(cx - r * 0.34, cy - r * 0.38, r * 0.02, cx - r * 0.1, cy - r * 0.16, r * 0.62);
    spec.addColorStop(0, "rgba(230,248,255,0.20)");
    spec.addColorStop(1, "rgba(230,248,255,0)");
    ctx.fillStyle = spec;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    ctx.lineJoin = "round";
    ctx.fillStyle = "rgba(16, 36, 54, 0.96)";
    ctx.strokeStyle = "rgba(86, 128, 156, 0.42)";
    ctx.lineWidth = 0.7;
    for (i = 0; i < LAND.length; i++) drawLand(ctx, LAND[i], cam);
    var night = ctx.createLinearGradient(cx - r, cy, cx + r * 0.35, cy);
    night.addColorStop(0, "rgba(2,6,12,0.16)");
    night.addColorStop(0.55, "rgba(2,6,12,0.08)");
    night.addColorStop(1, "rgba(2,6,12,0)");
    ctx.fillStyle = night;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    var sweepLng = solarLngDeg() + (earthSpin() * 180) / Math.PI;
    ctx.beginPath(); first = true;
    for (lat = -80; lat <= 80; lat += 3) {
      p = project(lat, sweepLng, cam);
      if (!p) { first = true; continue; }
      if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
    }
    ctx.strokeStyle = "rgba(120, 230, 255, 0.85)"; ctx.lineWidth = 1.6; ctx.stroke();
    for (i = 1; i <= 5; i++) {
      ctx.beginPath(); first = true;
      for (lat = -80; lat <= 80; lat += 4) {
        p = project(lat, sweepLng - i * 4, cam);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.strokeStyle = "rgba(120, 230, 255," + (0.18 - i * 0.028) + ")";
      ctx.lineWidth = 6 - i; ctx.stroke();
    }
    for (i = 0; i < SITES.length; i++) {
      p = project(SITES[i].lat, SITES[i].lng, cam);
      if (!p) continue;
      var pulse = 0.4 + 0.6 * Math.abs(Math.sin(now / 480 + i));
      ctx.beginPath(); ctx.arc(p.x, p.y, 2.2 + pulse, 0, Math.PI * 2);
      ctx.fillStyle = SITES[i].c; ctx.globalAlpha = 0.45 + 0.5 * pulse; ctx.fill(); ctx.globalAlpha = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, 7 + pulse * 4, 0, Math.PI * 2);
      ctx.strokeStyle = SITES[i].c; ctx.globalAlpha = 0.28; ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (here) {
      p = project(here.lat, here.lng, cam);
      if (p) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fillStyle = "#e8fbff"; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(232,251,255,0.8)"; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }
    ctx.restore();
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(140, 210, 230, 0.35)"; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = "rgba(150, 180, 196, 0.35)";
    ctx.font = "600 10px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (i = 0; i < LABELS.length; i++) {
      p = project(LABELS[i].lat, LABELS[i].lng, cam);
      if (!p || p.z < 0.28) continue;
      ctx.fillText(LABELS[i].name, p.x, p.y);
    }
    /* 4443: constellation applet removed in 4442 lean — call was orphaned */
  }
  var PLANETS = [
    { n: "MERCURY", p: 87.969, L: 252.25, au: 0.387, inc: 7.0, col: "#c8bba8", sz: 2.4 },
    { n: "VENUS", p: 224.701, L: 181.98, au: 0.723, inc: 3.4, col: "#e6d2a0", sz: 3.4 },
    { n: "EARTH", p: 365.256, L: 100.46, au: 1, inc: 0, col: "#9fd4ea", sz: 3.6 },
    { n: "MARS", p: 686.980, L: 355.45, au: 1.524, inc: 1.85, col: "#c56a48", sz: 3 },
    { n: "JUPITER", p: 4332.59, L: 34.40, au: 5.204, inc: 1.3, col: "#d8b48a", sz: 6.2 },
    { n: "SATURN", p: 10759.22, L: 49.94, au: 9.537, inc: 2.49, col: "#ead7a4", sz: 5.4 },
    { n: "URANUS", p: 30688.5, L: 313.23, au: 19.19, inc: 0.77, col: "#b7e4ea", sz: 4.2 },
    { n: "NEPTUNE", p: 60182, L: 304.88, au: 30.07, inc: 1.77, col: "#7088e8", sz: 4 }
  ];
  function meanLong(L, period) {
    var deg = (L + (360 * daysSinceJ2000()) / period) % 360;
    if (deg < 0) deg += 360;
    return deg * Math.PI / 180;
  }
  function orbitXY(cx, cy, ang, rad, inc) {
    var ci = Math.cos((inc || 0) * Math.PI / 180);
    return { x: cx + Math.cos(ang) * rad, y: cy - Math.sin(ang) * rad * ci };
  }
  function drawOrrery(now) {
    var cx = view.cx, cy = view.cy;
    var span = Math.min(view.w, view.h) * 0.34;
    var maxR = Math.sqrt(30.07);
    function radOf(au) { return span * Math.sqrt(au) / maxR; }
    ctx.strokeStyle = "rgba(140, 180, 200, 0.18)";
    ctx.lineWidth = 1;
    for (var i = 0; i < PLANETS.length; i++) {
      var rad = radOf(PLANETS[i].au);
      ctx.beginPath();
      ctx.ellipse(cx, cy, rad, rad * Math.cos(PLANETS[i].inc * Math.PI / 180), 0, 0, Math.PI * 2);
      ctx.stroke();
    }
    var sunAng = meanLong(0, 25.05);
    var sunR = Math.max(14, span * 0.055);
    var g = ctx.createRadialGradient(cx, cy, sunR * 0.2, cx, cy, sunR * 2.6);
    g.addColorStop(0, "rgba(255, 236, 200, 0.95)");
    g.addColorStop(0.45, "rgba(255, 170, 60, 0.35)");
    g.addColorStop(1, "rgba(255, 120, 40, 0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(cx, cy, sunR * 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-sunAng);
    ctx.strokeStyle = "rgba(180, 90, 20, 0.35)";
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(0, 0, sunR * 0.92, sunR * 0.28, 0.4, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(0, 0, sunR * 0.7, sunR * 0.16, -0.6, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = "rgba(255, 220, 170, 0.7)";
    ctx.font = "600 10px system-ui,sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("SUN", cx, cy + sunR * 2.9);
    var earthPos = null;
    for (i = 0; i < PLANETS.length; i++) {
      var b = PLANETS[i];
      var ang = meanLong(b.L, b.p);
      var q = orbitXY(cx, cy, ang, radOf(b.au), b.inc);
      if (b.n === "EARTH") { earthPos = q; continue; }
      ctx.beginPath(); ctx.arc(q.x, q.y, b.sz, 0, Math.PI * 2);
      ctx.fillStyle = b.col; ctx.fill();
      if (b.n === "SATURN") {
        ctx.strokeStyle = "rgba(234, 215, 164, 0.7)";
        ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(q.x, q.y, b.sz * 2.1, b.sz * 0.7, -0.5, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.fillStyle = "rgba(180, 200, 210, 0.45)";
      ctx.font = "600 8px system-ui,sans-serif";
      ctx.fillText(b.n, q.x, q.y + b.sz + 9);
    }
    if (!earthPos) return;
    var mAng = meanLong(218.32, 27.321661);
    var moon = orbitXY(earthPos.x, earthPos.y, mAng, 18, 5.14);
    ctx.strokeStyle = "rgba(180, 190, 200, 0.25)";
    ctx.beginPath(); ctx.ellipse(earthPos.x, earthPos.y, 18, 18 * Math.cos(5.14 * Math.PI / 180), 0, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(moon.x, moon.y, 2.2, 0, Math.PI * 2);
    ctx.fillStyle = "#d8dde4"; ctx.fill();
    ctx.fillStyle = "rgba(200, 206, 214, 0.55)";
    ctx.font = "600 8px system-ui,sans-serif";
    ctx.fillText("MOON", moon.x, moon.y + 11);
    var keep = { cx: view.cx, cy: view.cy, scale: view.scale };
    view.cx = earthPos.x; view.cy = earthPos.y; view.scale = 12;
    ctx.save();
    ctx.beginPath(); ctx.arc(earthPos.x, earthPos.y, 12, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = "#0c3348";
    ctx.fillRect(earthPos.x - 12, earthPos.y - 12, 24, 24);
    ctx.fillStyle = "rgba(16, 36, 54, 0.96)";
    ctx.strokeStyle = "rgba(86, 128, 156, 0.55)";
    ctx.lineWidth = 0.4;
    for (i = 0; i < LAND.length; i++) drawLand(ctx, LAND[i], cam);
    ctx.restore();
    ctx.beginPath(); ctx.arc(earthPos.x, earthPos.y, 12, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(140, 200, 220, 0.45)"; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.fillStyle = "rgba(160, 210, 230, 0.55)";
    ctx.font = "600 8px system-ui,sans-serif";
    ctx.fillText("EARTH", earthPos.x, earthPos.y + 22);
    view.cx = keep.cx; view.cy = keep.cy; view.scale = keep.scale;
  }
  function drawSolar(now, cx, cy, r) { drawOrrery(now); }
  function stepCam(now, dt) {
    if (fly) {
      var k = Math.min(1, (now - fly.t0) / fly.ms);
      var e = 1 - Math.pow(1 - k, 3);
      cam.yaw = fly.start.yaw + (fly.goal.yaw - fly.start.yaw) * e;
      cam.pitch = fly.start.pitch + (fly.goal.pitch - fly.start.pitch) * e;
      cam.dist = fly.start.dist + (fly.goal.dist - fly.start.dist) * e;
      if (k >= 1) {
        var done = fly;
        fly = null;
        if (done && done.openCity && done.pt && !cityOn) {
          try { openCity(done.pt); } catch (eFly) {}
        }
      }
      return;
    }
    if (intro) {
      if (cam.dist < 1.7 || cam.dist > 2.05) cam.dist = 1.85;
      return;
    }
    /* Face-hold only when navigating to a pin — never after free drag/spin. */
    if (!drag && !freeLook && tierI >= 3 && aim && !cityOn) {
      var held2 = face(aim);
      cam.yaw = held2.yaw;
      cam.pitch = held2.pitch;
      vel.yaw = 0; vel.pitch = 0;
      return;
    }
    if (!drag && (Math.abs(vel.yaw) > 0.00004 || Math.abs(vel.pitch) > 0.00004)) {
      cam.yaw += vel.yaw;
      cam.pitch = Math.max(-1.15, Math.min(1.15, cam.pitch + vel.pitch));
      /* Trackball-style momentum: slow ease, not a snap. */
      var damp = Math.pow(0.94, Math.max(0.5, (dt || 0.016) / 0.016));
      vel.yaw *= damp; vel.pitch *= damp;
      if (Math.abs(vel.yaw) < 0.00004) vel.yaw = 0;
      if (Math.abs(vel.pitch) < 0.00004) vel.pitch = 0;
    } else if (!drag) { vel.yaw = 0; vel.pitch = 0; }
  }
  function tickNews() {
    return;
  }
  function loop(now) {
    var dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    if (!introT0) introT0 = now;
    if (intro && now - introT0 >= INTRO_MS) endIntro();
    stepCam(now, dt);
    tickNews(now);
    if (!cityOn) drawGlobe(now);
    if (skyOn) drawSky(now);
    paintMonitor(now);
    maybeLayout();
    requestAnimationFrame(loop);
  }
  function nowMs() { return Date.now(); }
  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  function tierFromDist(d) {
    if (d >= 8.2) return 0;
    if (d >= 3.6) return 1;
    if (d >= 1.15) return 2;
    return 3;
  }
  function nudgeZoom(dir, sx, sy) {
    /* dir>0 zoom out · dir<0 zoom in. Continuous + slow — not one-tier-per-notch. */
    intro = false;
    fly = null;
    gpsSeq++;
    if (cityOn) {
      if (dir > 0) {
        cityEnterAcc = Math.max(0, cityEnterAcc - 1);
        if (map) {
          try {
            var z = map.getZoom() || 16;
            if (z <= 12.5) {
              closeCity();
              settleTier(3, aim);
              freeLook = true;
            } else {
              map.setZoom(Math.max(12, z - 0.35), { animate: false });
            }
          } catch (e) {}
        }
      } else if (map) {
        try { map.setZoom(Math.min(19, (map.getZoom() || 16) + 0.35), { animate: false }); } catch (e) {}
      }
      return;
    }
    var pt = pointUnder(sx, sy);
    if (pt) aim = pt;
    var factor = dir > 0 ? 1.065 : (1 / 1.065);
    var next = Math.max(0.62, Math.min(9.6, (cam.dist || 1.85) * factor));
    cam.dist = next;
    tierI = tierFromDist(next);
    if (dir < 0 && tierI >= 3 && aim) {
      cityEnterAcc += 1;
      if (cityEnterAcc >= 6) {
        cityEnterAcc = 0;
        openCity(aim);
        say("City · " + aim.lat.toFixed(2) + "," + aim.lng.toFixed(2));
        paintViewBtn();
      }
    } else if (dir > 0) {
      cityEnterAcc = Math.max(0, cityEnterAcc - 2);
    }
    paintViewBtn();
  }
  function bindGlobe() {
    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      var p = pos(e);
      var hit = globeHit(p.x, p.y, cam);
      if (hit) listAt(hit);
    });
    canvas.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      canvas.setPointerCapture(e.pointerId);
      var p = pos(e);
      pointers.set(e.pointerId, { x: p.x, y: p.y });
      vel.yaw = 0; vel.pitch = 0;
      if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        drag = null;
        if (holdT) { clearTimeout(holdT); holdT = 0; }
        return;
      }
      drag = { x: p.x, y: p.y, yaw: cam.yaw, pitch: cam.pitch, moved: false, lastX: p.x, lastY: p.y, lastT: nowMs() };
      holdT = setTimeout(function () {
        if (!drag || drag.moved) return;
        var hit = globeHit(p.x, p.y, cam);
        if (hit) listAt(hit);
        drag = null;
      }, 1000);
    });
    canvas.addEventListener("pointermove", function (e) {
      var p = pos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: p.x, y: p.y });
      if (pointers.size === 2 && pinch) {
        var pts = Array.from(pointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        var grew = d / pinch;
        pinch = d;
        intro = false;
        var mx = (pts[0].x + pts[1].x) / 2, my = (pts[0].y + pts[1].y) / 2;
        /* Slow pinch: small continuous nudges, not tier jumps. */
        if (grew > 1.035) nudgeZoom(-1, mx, my);
        else if (grew < 0.965) nudgeZoom(1, mx, my);
        return;
      }
      if (!drag) return;
      var dx = p.x - drag.x, dy = p.y - drag.y;
      if (Math.hypot(dx, dy) > 6) {
        drag.moved = true; intro = false; gpsSeq++; freeLook = true;
        if (holdT) { clearTimeout(holdT); holdT = 0; }
      }
      if (!drag.moved) return;
      var t = nowMs();
      var dt = Math.max(8, t - drag.lastT);
      vel.yaw = (-(p.x - drag.lastX) * 0.0042) * (16 / dt);
      vel.pitch = ((p.y - drag.lastY) * 0.0034) * (16 / dt);
      drag.lastX = p.x; drag.lastY = p.y; drag.lastT = t;
      cam.yaw = drag.yaw - dx * 0.0042;
      cam.pitch = Math.max(-1.15, Math.min(1.15, drag.pitch + dy * 0.0034));
    });
    function up(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (holdT) { clearTimeout(holdT); holdT = 0; }
      var d = drag; drag = null;
      if (!d) return;
      if (d.moved) {
        /* Keep vel for inertia — do not zero. */
        return;
      }
      vel.yaw = 0; vel.pitch = 0;
      var pUp = pos(e);
      /* Lean stamp: constellation/sky applet removed — tap empty space is a no-op. */
    }
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    var wheelAcc = 0, wheelRaf = 0, wheelXY = null;
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      intro = false;
      var p = pos(e);
      wheelXY = p;
      var dyIn = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      wheelAcc += dyIn;
      if (wheelRaf) return;
      wheelRaf = requestAnimationFrame(function () {
        wheelRaf = 0;
        var dy = wheelAcc; wheelAcc = 0;
        var pt = wheelXY;
        if (!dy || !pt) return;
        /* Require a meaningful notch; one event ≈ one slow nudge. */
        var steps = Math.min(2, Math.max(1, Math.round(Math.abs(dy) / 180)));
        var dir = dy > 0 ? 1 : -1;
        for (var i = 0; i < steps; i++) nudgeZoom(dir, pt.x, pt.y);
      });
    }, { passive: false });
  }
  function pointUnder(sx, sy) {
    var hit = (sx != null) ? globeHit(sx, sy, cam) : null;
    if (!hit && view) hit = globeHit(view.cx, view.cy, cam);
    if (!hit) return aim;
    return { lat: hit.lat, lng: hit.lng };
  }
  function face(pt) {
    if (!pt) return { yaw: cam.yaw, pitch: cam.pitch };
    return {
      yaw: wrapYaw(cam.yaw, (pt.lng * Math.PI) / 180 - earthSpin()),
      pitch: Math.max(-1.15, Math.min(1.15, (pt.lat * Math.PI) / 180))
    };
  }
  function stepTier(dir, sx, sy) {
    if (Date.now() < tierLock) return;
    tierLock = Date.now() + 480;
    gpsSeq++;
    var pt = pointUnder(sx, sy);
    if (pt) aim = pt;
    /* dir>0 = zoom out · dir<0 = zoom in. Outward: globe → solar → galaxy. */
    if (cityOn) {
      if (dir > 0) {
        closeCity();
        settleTier(3, aim); /* national */
      } else if (map) {
        try { map.setZoom(Math.min(19, (map.getZoom() || 16) + 1)); } catch (e) {}
      }
      return;
    }
    var next = tierI + (dir > 0 ? -1 : 1);
    if (next < 0) next = 0;
    if (next > 4) next = 4;
    if (next === tierI) return;
    if (!aim && TIERS[next] && (TIERS[next].id === "national" || TIERS[next].id === "city" || TIERS[next].id === "global")) {
      say("Zoom on the earth."); return;
    }
    if (TIERS[next].id === "city") {
      if (TIERS[tierI].id !== "national") return;
      openCity(aim);
      say("City · " + aim.lat.toFixed(2) + "," + aim.lng.toFixed(2));
      paintViewBtn();
      return;
    }
    settleTier(next, aim);
    paintViewBtn();
  }
  function settleTier(i, pt) {
    tierI = i;
    var f = face(pt || aim);
    fly = {
      t0: performance.now(),
      ms: 640,
      start: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist },
      goal: { yaw: f.yaw, pitch: f.pitch, dist: TIERS[i].dist }
    };
    var where = (pt || aim);
    say(TIERS[i].name + (where ? " · " + where.lat.toFixed(2) + "," + where.lng.toFixed(2) : ""));
  }
  function pinHere(pt) {
    here = { lat: pt.lat, lng: pt.lng };
    window.__SN_HERE = here;
    try { localStorage.setItem("sn:here", JSON.stringify(here)); } catch (e) {}
    if (vendor) { setDrop(pt); return; }
    say("Pinned " + pt.lat.toFixed(4) + "," + pt.lng.toFixed(4) + " · tap GPS to recalibrate");
  }
  function locate(then) {
    if (!navigator.geolocation) {
      say("GPS denied. Long tap the globe to pin YOU. Tap GPS again to retry.");
      return;
    }
    var seq = ++gpsSeq;
    say("Locating… tap GPS again to recalibrate.");
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        if (seq !== gpsSeq) return;
        then({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      function () {
        navigator.geolocation.getCurrentPosition(
          function (p) {
            if (seq !== gpsSeq) return;
            then({ lat: p.coords.latitude, lng: p.coords.longitude });
          },
          function () { if (seq === gpsSeq) say("GPS denied. Long tap the globe to pin YOU. Tap GPS again to retry."); },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }
  function land(pt, open) {
    intro = false;
    freeLook = false;
    here = { lat: pt.lat, lng: pt.lng };
    aim = { lat: pt.lat, lng: pt.lng };
    window.__SN_HERE = here;
    try { localStorage.setItem("sn:here", JSON.stringify(here)); } catch (e) {}
    tierI = 3;
    flyTo(here, TIERS[3].dist);
    /* Street use starts from GPS: open city map after the fly lands. */
    var wantCity = open !== false; /* GPS / street-start: always land on map */
    fly.openCity = wantCity;
    fly.pt = here;
    tierI = 4;
    say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · tap to recalibrate");
    pullListings();
    syncRadarHud();
    if (wantCity) {
      try { openCity(here); } catch (e2) {}
      if (map) {
        try { map.setView([here.lat, here.lng], Math.max(15, map.getZoom() || 17)); } catch (e) {}
        paintCityRadar();
      }
    }
  }
  function endIntro() {
    if (!intro) return;
    intro = false;
  }
  function bindGps() {
    var btn = $("gps");
    if (!btn || btn.__snGpsLock) return;
    btn.__snGpsLock = true;
    btn.addEventListener("click", function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      locate(function (pt) { land(pt, true); }); /* true = fly + open street map */
    }, true);
  }
  function openCity(pt) {
    if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return;
    aim = { lat: pt.lat, lng: pt.lng };
    tierI = 4;
    var el = $("city");
    if (!el || typeof L === "undefined" || !pt) return;
    cityOn = true;
    el.classList.add("on");
    if (!map) {
      map = L.map(el, { zoomControl: false, attributionControl: false, minZoom: 12, maxZoom: 19, scrollWheelZoom: true }).setView([pt.lat, pt.lng], 16);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, minZoom: 12 }).addTo(map);
      map.on("zoomend", function () {
        try {
          if (map && map.getZoom() <= 12) {
            closeCity();
            settleTier(2, aim);
          }
        } catch (e) {}
      });
      var lastTap = 0;
      map.on("click", function () {
        var t = Date.now();
        if (t - lastTap < 320) closeCity();
        lastTap = t;
      });
      var hold = 0, holdPt = null;
      el.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        if (!map) return;
        var ll = map.mouseEventToLatLng(e);
        if (ll) listAt({ lat: ll.lat, lng: ll.lng });
      });
      el.addEventListener("pointerdown", function (e) {
        if (e.button) return;
        holdPt = e;
        hold = setTimeout(function () {
          if (!map || !holdPt) return;
          var ll = map.mouseEventToLatLng(holdPt);
          if (ll) listAt({ lat: ll.lat, lng: ll.lng });
        }, 1000);
      });
      function cancelHold() { if (hold) { clearTimeout(hold); hold = 0; } }
      el.addEventListener("pointerup", cancelHold);
      el.addEventListener("pointercancel", cancelHold);
      el.addEventListener("pointermove", function (e) {
        if (holdPt && Math.hypot(e.clientX - holdPt.clientX, e.clientY - holdPt.clientY) > 12) cancelHold();
      });
    } else {
      try { map.setMinZoom(12); } catch (e) {}
      map.setView([pt.lat, pt.lng], Math.max(14, map.getZoom() || 16));
    }
    if (youMark) try { map.removeLayer(youMark); } catch (e) {}
    youMark = null;
    if (here && isFinite(here.lat)) {
      youMark = L.circleMarker([here.lat, here.lng], { radius: 8, color: "#4df0ff", fillColor: "#4df0ff", fillOpacity: 0.9, weight: 2 }).addTo(map);
    }
    paintShopsOnMap();
    paintActorsOnMap();
    paintCityRadar();
    paintViewBtn();
    setTimeout(function () { if (map) map.invalidateSize(); paintCityRadar(); }, 80);
  }
  function closeCity() {
    clearCityRadar();
    var el = $("city");
    if (el) el.classList.remove("on");
    cityOn = false;
    paintViewBtn();
    if (tierI > 2) tierI = 2;
    if (aim) {
      var f = face(aim);
      cam.yaw = f.yaw;
      cam.pitch = f.pitch;
    }
    cam.dist = TIERS[3].dist;
  }
  function plotIdFor(pt) {
    return "p" + Number(pt.lat).toFixed(5) + "_" + Number(pt.lng).toFixed(5);
  }
  function architectZoom() {
    var z = 16;
    try { if (map && cityOn && typeof map.getZoom === "function") z = map.getZoom(); } catch (e) {}
    if (!isFinite(z)) z = 16;
    return Math.max(12, Math.min(19, Math.round(z)));
  }
  function architectUrl(pt) {
    var lat = Number(pt.lat), lon = Number(pt.lng);
    var z = architectZoom();
    var plot = plotIdFor(pt);
    var q = "from=spacenet"
      + "&lat=" + lat.toFixed(6)
      + "&lon=" + lon.toFixed(6)
      + "&zoom=" + z
      + "&plot=" + encodeURIComponent(plot);
    return "https://architect.astranov.eu/?" + q;
  }
  function markPlot(pt) {
    if (!map || typeof L === "undefined" || !pt) return;
    if (plotMark) try { map.removeLayer(plotMark); } catch (e) {}
    plotMark = L.circleMarker([pt.lat, pt.lng], {
      radius: 10, color: "#4df0ff", fillColor: "#1a3cff", fillOpacity: 0.85, weight: 2
    }).bindTooltip("PLOT", { direction: "top" }).addTo(map);
  }
  function openArchitectAt(pt) {
    if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return;
    var url = architectUrl(pt);
    say("Opening Architect…");
    try { location.assign(url); } catch (e) { location.href = url; }
  }
  function listAt(pt) {
    if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return;
    listPt = { lat: pt.lat, lng: pt.lng };
    listAlt = altitudeFromDist(cam.dist);
    if (!signed()) {
      needLogin("LOGIN to insert on the map.");
      return;
    }
    if (cityOn) markPlot(listPt);
    else if (!cityOn && typeof openCity === "function") {
      openCity(listPt);
      setTimeout(function () { markPlot(listPt); }, 120);
    }
    var coords = Number(pt.lat).toFixed(5) + ", " + Number(pt.lng).toFixed(5);
    openSheet("INSERT",
      '<p class="note">Plot ' + coords + '. Insert a role, then verify. Architect stays a separate app.</p>' +
      '<button type="button" class="sheet-go primary" data-act="insert-actor" data-role="vendor">INSERT VENDOR</button>' +
      '<button type="button" class="sheet-go" data-act="insert-actor" data-role="delivery_services">INSERT DELIVERY SERVICES</button>' +
      '<button type="button" class="sheet-go" data-act="insert-actor" data-role="driver">INSERT DELIVERY DRIVER</button>' +
      '<button type="button" class="sheet-go" data-act="insert-actor" data-role="client">INSERT CLIENT</button>' +
      '<button type="button" class="sheet-go" data-act="open-architect">OPEN ARCHITECT</button>' +
      '<button type="button" class="sheet-go" data-act="close">CANCEL</button>');
    say(coords);
  }
  function isVendorRole(role) {
    return role === "vendor" || role === "delivery_services";
  }
  function insertActor(role) {
    if (!signed()) { needLogin("LOGIN to insert."); return; }
    if (!listPt) { say("Hold a map spot first."); return; }
    role = role === "driver" || role === "client" || role === "vendor" || role === "delivery_services" ? role : "vendor";
    var nameEl = null;
    var label = role === "delivery_services" ? "DELIVERY SERVICES" : role.toUpperCase();
    var ph = role === "delivery_services"
      ? "Courier / platform city office name"
      : (role === "vendor" ? "Shop / Google Business name" : role === "driver" ? "Driver name" : "Client / house name");
    openSheet("NAME · " + label,
      '<p class="note">' + (role === "delivery_services"
        ? "Same UX as restaurant vendors — sells delivery, not products. DoorDash/DH list as this type."
        : ("Name this " + role + " at " + listPt.lat.toFixed(5) + ", " + listPt.lng.toFixed(5))) + "</p>" +
      '<input id="sn-actor-name" class="field" placeholder="' + ph + '" />' +
      (isVendorRole(role) ? '<input id="sn-actor-gbp" class="field" placeholder="Google Business Profile URL or place id" />' : "") +
      '<button type="button" class="sheet-go primary" data-act="save-actor" data-role="' + role + '">SAVE · VERIFY</button>' +
      '<button type="button" class="sheet-go" data-act="close">CANCEL</button>');
    nameEl = $("sn-actor-name");
    if (nameEl) nameEl.focus();
  }
  function saveActor(role) {
    if (!signed() || !listPt) return;
    role = role === "driver" || role === "client" || role === "vendor" || role === "delivery_services" ? role : "vendor";
    var nm = $("sn-actor-name");
    var name = nm ? String(nm.value || "").trim() : "";
    if (!name) { say("Name required."); return; }
    var gbp = $("sn-actor-gbp");
    var gbpVal = gbp ? String(gbp.value || "").trim() : "";
    var actor = {
      id: (role === "delivery_services" ? "ds" : role[0]) + Date.now().toString(36),
      role: role,
      kind: role,
      vendor_type: isVendorRole(role) ? role : undefined,
      name: name.slice(0, 80),
      lat: listPt.lat,
      lng: listPt.lng,
      gbp: gbpVal,
      owner: true,
      t: Date.now()
    };
    var ok = verifyActor(actor);
    if (!ok.ok) {
      openSheet("VERIFY · " + (role === "delivery_services" ? "DELIVERY SERVICES" : role.toUpperCase()),
        '<p class="note">' + ok.msg + "</p>" +
        (isVendorRole(role) ? '<input id="sn-actor-gbp" class="field" placeholder="Google Business Profile URL" value="' + String(gbpVal).replace(/"/g, "") + '" />' : "") +
        '<button type="button" class="sheet-go primary" data-act="retry-verify" data-role="' + role + '" data-name="' + name.replace(/"/g, "") + '">RETRY VERIFY</button>' +
        '<button type="button" class="sheet-go" data-act="close">CANCEL</button>');
      return;
    }
    actor.verified = true;
    var rows = loadActors();
    rows.unshift(actor);
    saveActors(rows);
    if (isVendorRole(role)) {
      shops.unshift({
        id: actor.id,
        name: actor.name,
        lat: actor.lat,
        lng: actor.lng,
        kind: role,
        phone: "",
        src: "listed",
        gbp: actor.gbp,
        role: role,
        vendor_type: role,
        menu: role === "delivery_services"
          ? [{ name: "City delivery", price: "3", note: "Overflow / zone rate", hours: "24/7", stock: "in" }]
          : undefined
      });
      shops = uniqPlaces(shops.concat(FAMOUS_VENDORS));
    }
    persistListing({ id: actor.id, kind: role, name: actor.name, lat: actor.lat, lng: actor.lng, gbp: actor.gbp, vendor_type: actor.vendor_type });
    paintActorsOnMap();
    paintShopsOnMap();
    closeSheet();
    say((role === "delivery_services" ? "DELIVERY SERVICES" : role.toUpperCase()) + " verified · tap pin to start a transaction.");
    startTransaction(actor);
  }
  function verifyActor(actor) {
    loadVerify();
    if (!actor) return { ok: false, msg: "Missing actor." };
    if (actor.role === "vendor" || actor.role === "delivery_services") {
      var gbp = String(actor.gbp || "").trim();
      if (!gbp || !/(google\.|g\.page|maps\.app|business\.site|goo\.gl|g\.co|maps\.|place_id:|cid=)/i.test(gbp) && gbp.length < 8) {
        return { ok: false, msg: (actor.role === "delivery_services" ? "Delivery services" : "Vendors") + " verify via Google Business Profile. Paste the GBP / Maps link." };
      }
      verifyState.vendor = true; saveVerify();
      return { ok: true };
    }
    if (actor.role === "client") {
      if (!here || haversineKm(here, actor) > 0.35) {
        return { ok: false, msg: "House / client verify needs your GPS at the plot. Tap GPS, then retry." };
      }
      verifyState.client = true; saveVerify();
      return { ok: true };
    }
    if (actor.role === "driver") {
      ensureDriverGps();
      if (!here) return { ok: false, msg: "Drivers verify by keeping GPS open. Tap GPS and leave it on." };
      verifyState.driver = true; saveVerify();
      return { ok: true };
    }
    return { ok: false, msg: "Unknown role." };
  }
  function ensureDriverGps() {
    if (gpsWatchId || !navigator.geolocation) return;
    try {
      gpsWatchId = navigator.geolocation.watchPosition(function (pos) {
        if (!pos || !pos.coords) return;
        here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        window.__SN_HERE = here;
        if (youMark && map) try { youMark.setLatLng([here.lat, here.lng]); } catch (e) {}
      }, function () {}, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
    } catch (e) {}
  }
  function startTransaction(actor) {
    if (!actor) return;
    if (!signed()) { needLogin("LOGIN to start a transaction."); return; }
    vendor = null; drop = null;
    if (actor.role === "vendor" || actor.role === "delivery_services" || actor.kind === "vendor" || actor.kind === "shop" || actor.kind === "delivery_services") {
      var ds = actor.role === "delivery_services" || actor.kind === "delivery_services" || actor.vendor_type === "delivery_services";
      vendor = {
        name: actor.name,
        lat: actor.lat,
        lng: actor.lng,
        kind: ds ? "delivery_services" : "vendor",
        vendor_type: ds ? "delivery_services" : "vendor",
        phone: actor.phone || "",
        menu: actor.menu || (ds
          ? [{ name: "City delivery", price: "3", note: "Capacity / zone", hours: "24/7", stock: "in" }]
          : [{ name: "Order", price: "12", note: "Walkthrough" }]),
        gbp: actor.gbp
      };
      openVendor(vendor);
      say(ds ? "Transaction · delivery services (same UX as food). Set drop, then SEND." : "Transaction · vendor. Set drop (TO MY GPS), then SEND.");
      return;
    }
    if (actor.role === "client" || actor.kind === "client" || actor.kind === "drop") {
      drop = { lat: actor.lat, lng: actor.lng, name: actor.name };
      if (!vendor && shops[0]) vendor = shops[0];
      if (!vendor) {
        vendor = FAMOUS_VENDORS[0];
      }
      showQuote();
      say("Transaction · client drop set. Confirm quote to walk the flow.");
      return;
    }
    if (actor.role === "driver" || actor.kind === "driver") {
      ensureDriverGps();
      openSheet("DRIVER · TX",
        '<p class="note">' + String(actor.name).replace(/[<>]/g, "") + " · GPS must stay open for verify.</p>" +
        '<button type="button" class="sheet-go primary" data-act="drv-walk">WALK DELIVERY FLOW</button>' +
        '<button type="button" class="sheet-go" data-act="peer-msg" data-id="' + actor.id + '">MESSAGE</button>');
      say("Transaction · driver. Walk a delivery or message.");
    }
  }
  function openPeerMessage(actor) {
    if (!actor) return;
    if (!signed()) { needLogin("LOGIN to message."); return; }
    peerThread = actor;
    openSheet("MESSAGE · " + String(actor.name || "peer").slice(0, 24).toUpperCase(),
      '<p class="note">Peer channel — for user-to-user issues. Product bugs go to AI Support (Cursor).</p>' +
      '<textarea id="sn-peer-msg" class="field" placeholder="Message ' + String(actor.name || "peer").replace(/"/g, "") + '"></textarea>' +
      '<button type="button" class="sheet-go primary" data-act="peer-send" data-id="' + actor.id + '">SEND PEER MSG</button>' +
      '<button type="button" class="sheet-go" data-act="close">HIDE</button>');
    var ta = $("sn-peer-msg");
    if (ta) ta.focus();
  }
  function sendPeerMessage(id) {
    var actor = loadActors().filter(function (a) { return String(a.id) === String(id); })[0] || peerThread;
    var ta = $("sn-peer-msg");
    var msg = ta ? String(ta.value || "").trim() : "";
    if (!msg) { say("Type a peer message."); return; }
    if (!actor) { say("No peer selected. Tap a pin on the map."); return; }
    try {
      var box = JSON.parse(localStorage.getItem("sn:peer-msg") || "[]") || [];
      box.unshift({ id: "m" + Date.now().toString(36), to: actor.id, toName: actor.name, role: actor.role, text: msg.slice(0, 1000), t: Date.now() });
      localStorage.setItem("sn:peer-msg", JSON.stringify(box.slice(0, 200)));
    } catch (e) {}
    closeSheet();
    say("Peer message to " + actor.name + " saved on-device.");
  }
  function paintActorsOnMap() {
    if (!map || typeof L === "undefined") return;
    actorMarks.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
    actorMarks = [];
    var rows = loadActors().concat(FAMOUS_VENDORS.map(function (f) {
      return { id: "fam-" + f.name, role: "vendor", kind: "vendor", name: f.name, lat: f.lat, lng: f.lng, famous: true, verified: true };
    }));
    rows.forEach(function (a) {
      if (!a || !isFinite(a.lat) || !isFinite(a.lng)) return;
      var color = a.role === "driver" ? "#1a3cff" : a.role === "client" ? "#0b6b45" : a.role === "delivery_services" ? "#0ea5e9" : "#ff8a3d";
      var mark = L.circleMarker([a.lat, a.lng], { radius: 9, color: color, fillColor: color, fillOpacity: 0.9, weight: 2 });
      var tipRole = a.role === "delivery_services" ? "DELIVERY SERVICES" : String(a.role || "vendor").toUpperCase();
      mark.bindTooltip(tipRole + " · " + (a.name || ""), { direction: "top" });
      mark.on("click", function (e) {
        if (e && e.originalEvent) L.DomEvent.stop(e.originalEvent);
        openActorSheet(a);
      });
      mark.addTo(map);
      actorMarks.push(mark);
    });
  }
  function openActorSheet(a) {
    if (!a) return;
    openSheet(String(a.name || "ACTOR").toUpperCase(),
      '<p class="note">' + String(a.role || a.kind || "actor").toUpperCase() + (a.verified || a.famous ? " · verified" : "") + (a.famous ? " · famous" : "") + " · same map peer talk</p>" +
      '<button type="button" class="sheet-go primary" data-act="start-tx" data-id="' + a.id + '">START TRANSACTION</button>' +
      '<button type="button" class="sheet-go" data-act="peer-msg" data-id="' + a.id + '">MESSAGE PEER</button>' +
      '<button type="button" class="sheet-go" data-act="close">HIDE</button>');
  }
  function findActor(id) {
    var rows = loadActors().concat(FAMOUS_VENDORS.map(function (f) {
      return { id: "fam-" + f.name, role: "vendor", kind: "vendor", name: f.name, lat: f.lat, lng: f.lng, famous: true, verified: true, phone: f.phone, menu: [{ name: "Order", price: "12", note: "Famous" }] };
    }));
    return rows.filter(function (a) { return String(a.id) === String(id); })[0] || null;
  }
  function viewMode() {
    if (cityOn) return "city";
    if (tierI >= 3) return "national";
    return "globe";
  }
  function goCityFromGlobe() {
    /* Three-step VIEW inward: globe → national → city (cycle back to globe) */
    var pt = aim || here || listPt || { lat: 36.434, lng: 28.217 };
    if (!aim && here) aim = here;
    if (!aim) aim = pt;
    var mode = viewMode();
    if (mode === "globe") {
      if (cityOn) closeCity();
      settleTier(3, aim);
      say("National · " + Number(aim.lat).toFixed(2) + "," + Number(aim.lng).toFixed(2));
    } else if (mode === "national") {
      openCity(aim || pt);
      paintActorsOnMap();
      say("City · " + Number((aim || pt).lat).toFixed(2) + "," + Number((aim || pt).lng).toFixed(2));
    } else {
      closeCity();
      settleTier(2, aim);
      say("Globe");
    }
    paintViewBtn();
  }
  function paintViewBtn() {
    var btn = $("sn-view");
    if (!btn) return;
    var mode = viewMode();
    var label = mode === "globe" ? "NATIONAL" : mode === "national" ? "CITY" : "GLOBE";
    btn.textContent = label;
    btn.setAttribute("aria-label", "View · next " + label.toLowerCase() + " (globe → national → city)");
    btn.title = "globe → national → city";
  }

  function persistListing(row) {
    if (!row) return;
    row.id = row.id || (String(row.kind || "x")[0] + Date.now().toString(36));
    try {
      var mine = JSON.parse(localStorage.getItem("sn:mine") || "[]") || [];
      mine.unshift(row);
      localStorage.setItem("sn:mine", JSON.stringify(mine.slice(0, 80)));
    } catch (e) {}
    if (!signed()) {
      say("LOGIN to publish. Saved on this device.");
      if (window.SNAuth && SNAuth.google) SNAuth.google();
      return;
    }
    var t = authToken();
    fetch("/api/space", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: t ? "Bearer " + t : "" },
      body: JSON.stringify({ row: row })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) say("Listed.");
      else if (j && (j.need === "login" || j.error === "login")) say("LOGIN to publish.");
      else say("Listed on this device.");
    }).catch(function () { say("Listed on this device."); });
  }
  function hardReset() {
    say("Force update…");
    try { sessionStorage.clear(); } catch (e) {}
    var go = function () { location.href = "/?v=" + VER + "&t=" + Date.now(); };
    var wipeCaches = function () {
      if (!window.caches || !caches.keys) return Promise.resolve();
      return caches.keys().then(function (keys) {
        return Promise.all(keys.map(function (k) { return caches.delete(k); }));
      }).catch(function () {});
    };
    var wipeSW = function () {
      if (!navigator.serviceWorker || !navigator.serviceWorker.getRegistrations) return Promise.resolve();
      return navigator.serviceWorker.getRegistrations().then(function (rs) {
        return Promise.all(rs.map(function (r) { return r.unregister(); }));
      }).catch(function () {});
    };
    Promise.resolve().then(wipeCaches).then(wipeSW).then(go).catch(go);
  }
  function openCompany() {
    openSheet("ASTRANOV",
      '<p class="note">Astranov Cybernetics Architecture. Founded 12/04/2026. SpaceNet is the live surface.</p>' +
      '<a class="sheet-go primary" href="https://astranov.eu">astranov.eu</a>');
  }
  function openFleet() {
    var dpr = window.devicePixelRatio || 1;
    var mem = "";
    try {
      var m = performance.memory;
      if (m && m.jsHeapSizeLimit) mem = " · heap " + Math.round((m.usedJSHeapSize / m.jsHeapSizeLimit) * 100) + "%";
    } catch (e) {}
    openSheet("MONITOR",
      '<canvas id="sn-spark-lg" width="320" height="96" style="width:100%;height:96px;display:block;margin:8px 0"></canvas>' +
      '<p class="note">' + (navigator.platform || "device") + " · " + (navigator.hardwareConcurrency || "?") + " cores" + mem + "</p>");
    var src = $("sn-spark"), dst = $("sn-spark-lg");
    if (src && dst) {
      var dctx = dst.getContext("2d");
      if (dctx) dctx.drawImage(src, 0, 0, dst.width, dst.height);
    }
  }
  var supportOn = false;
  var supportTicket = "";
  var dockTabs = [];
  var dockFocus = "";
  function paintDockTabs() {
    var rail = $("sn-tabs");
    if (!rail) return;
    rail.innerHTML = "";
    dockTabs.forEach(function (t) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "tab " + t.kind + (dockFocus === t.id && !t.min ? " on" : "");
      b.setAttribute("data-tab", t.id);
      b.appendChild(document.createTextNode(t.title));
      var fill = document.createElement("button");
      fill.type = "button";
      fill.className = "fill";
      fill.setAttribute("data-fill", t.id);
      fill.textContent = t.min ? "+" : "–";
      b.appendChild(fill);
      rail.appendChild(b);
    });
    var sh = $("sn-sheet");
    if (sh) {
      var focused = dockTabs.filter(function (t) { return t.id === dockFocus; })[0];
      var show = !!(focused && !focused.min && focused.kind !== "support" && focused.html);
      sh.classList.toggle("on", show);
      sh.classList.toggle("min", !!(focused && focused.min));
    }
  }
  function upsertTab(tab) {
    var i = -1;
    dockTabs.forEach(function (t, n) { if (t.id === tab.id) i = n; });
    if (i >= 0) dockTabs[i] = Object.assign(dockTabs[i], tab);
    else dockTabs.push(tab);
    dockFocus = tab.id;
    tab.min = false;
    paintDockTabs();
  }
  function minTab(id) {
    dockTabs.forEach(function (t) {
      if (t.id === id) t.min = !t.min;
    });
    var cur = dockTabs.filter(function (t) { return t.id === id; })[0];
    if (cur && !cur.min) dockFocus = id;
    paintDockTabs();
    if (id === "support" && cur && cur.min) document.body.classList.remove("sn-support");
    if (id === "support" && cur && !cur.min) document.body.classList.add("sn-support");
  }
  function focusTab(id) {
    var t = dockTabs.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    t.min = false;
    dockFocus = id;
    paintDockTabs();
    if (t.kind === "support") {
      document.body.classList.add("sn-support");
      supportOn = true;
      var inp = $("in");
      if (inp) { inp.placeholder = "Support · type or tap MIC"; inp.focus(); }
    } else {
      if (t.html) openSheet(t.title, t.html);
    }
  }
  function playOfferBeep() {
    try {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      var ctx = playOfferBeep._ctx || (playOfferBeep._ctx = new AC());
      if (ctx.state === "suspended") ctx.resume().catch(function () {});
      var now = ctx.currentTime;
      function tone(f, t0, dur, type) {
        var o = ctx.createOscillator();
        var g = ctx.createGain();
        o.type = type || "sine";
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.22, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(ctx.destination);
        o.start(t0); o.stop(t0 + dur + 0.02);
      }
      tone(880, now, 0.18, "triangle");
      tone(1320, now + 0.16, 0.22, "sine");
      tone(1760, now + 0.34, 0.28, "triangle");
    } catch (e) {}
  }
  function setCd(n, on) {
    var el = $("sn-cd"), num = el && el.querySelector(".n");
    if (!el || !num) return;
    if (!on) {
      el.classList.remove("on");
      el.setAttribute("aria-hidden", "true");
      return;
    }
    num.textContent = String(n);
    el.classList.add("on");
    el.setAttribute("aria-hidden", "false");
  }
  function clearOfferCountdown() {
    if (offerCdTimer) { clearInterval(offerCdTimer); offerCdTimer = null; }
    offerCdLeft = 0;
    setCd(0, false);
  }
  function startOfferCountdown(seconds, onZero) {
    clearOfferCountdown();
    offerCdLeft = Math.max(1, seconds | 0);
    setCd(offerCdLeft, true);
    playOfferBeep();
    offerCdTimer = setInterval(function () {
      offerCdLeft -= 1;
      if (offerCdLeft > 0) {
        setCd(offerCdLeft, true);
        if (offerCdLeft === 3 || offerCdLeft === 1) playOfferBeep();
        return;
      }
      clearOfferCountdown();
      if (typeof onZero === "function") onZero();
    }, 1000);
  }
  function ensureHopConfirms(job) {
    if (!job) return job;
    if (!job.confirms || typeof job.confirms !== "object") job.confirms = {};
    if (!job.confirms.pickup) {
      job.confirms.pickup = {
        vendor: !!(job.confirms.vendor),
        driver: !!(job.confirms.driver && job.stage >= 2)
      };
    }
    if (!job.confirms.deliver) {
      job.confirms.deliver = {
        driver: !!(job.confirms.driver && job.stage >= 3),
        client: !!(job.confirms.client)
      };
    }
    syncOrderStatus(job);
    return job;
  }
  /* Partner-friendly REST/JSON statuses (DoorDash/DH-familiar). No partner adapters here. */
  function syncOrderStatus(job) {
    if (!job) return;
    if (job.cancelled || job.status === "cancelled") { job.status = "cancelled"; return; }
    var p = job.confirms && job.confirms.pickup;
    var d = job.confirms && job.confirms.deliver;
    var vendorOk = !!(job.route && job.route.vendorConfirmed) || !!(p && p.vendor) || !!(job.confirms && job.confirms.vendor);
    var pickOk = !!(p && p.vendor && p.driver);
    var delOk = !!(d && d.driver && d.client);
    if (delOk || (job.stage || 0) >= 4) job.status = "delivered";
    else if (pickOk || (job.stage || 0) >= 2) job.status = "in_transit";
    else if (job.driverId || (job.driver && job.driver.id)) job.status = "assigned";
    else if (vendorOk) job.status = "confirmed";
    else if (job.paid || job.paidUpfront) job.status = "pending";
    else job.status = job.status || "pending";
  }
  function asPartnerOrder(job) {
    if (!job) return null;
    ensureHopConfirms(job);
    return {
      id: job.id,
      status: job.status || "pending",
      currency: job.currency || "AV€",
      delivery_fee: Number(job.driverPay != null ? job.driverPay : job.fee) || 0,
      order_total: Number(job.orderTotal != null ? job.orderTotal : 0) || 0,
      paid_upfront: !!job.paidUpfront,
      prep_min: job.prepMin != null ? job.prepMin : VENDOR_PREP_MIN,
      vendor: job.vendor ? { id: job.vendor.id || null, name: job.vendor.name, lat: job.vendor.lat, lng: job.vendor.lng } : null,
      dropoff: job.drop ? { lat: job.drop.lat, lng: job.drop.lng, name: job.drop.name || null } : null,
      driver: job.driver ? { id: job.driverId || job.driver.id || null, name: job.driver.name || null } : null,
      quote: job.quote || null,
      created_at: job.t || null,
      prompt: job.prompt || null,
      delay_fee: Number(job.delayFee) || 0,
      floor_surcharge: !!(job.quote && job.quote.floor),
      keep_pay: !!job.keepPay,
      messages: (job.thread || []).slice(0, 20)
    };
  }
  function ensureJobThread(job) {
    if (!job) return [];
    if (!Array.isArray(job.thread)) job.thread = [];
    return job.thread;
  }
  function postOrderMsg(job, fromRole, text, kind) {
    if (!job) return;
    var thr = ensureJobThread(job);
    thr.unshift({
      id: "om" + Date.now().toString(36),
      from: fromRole || "system",
      text: String(text || "").slice(0, 500),
      kind: kind || "chat",
      t: Date.now()
    });
    job.thread = thr.slice(0, 80);
    try {
      var box = JSON.parse(localStorage.getItem("sn:peer-msg") || "[]") || [];
      box.unshift({ id: "m" + Date.now().toString(36), jobId: job.id, from: fromRole, text: String(text || "").slice(0, 500), t: Date.now(), order: true });
      localStorage.setItem("sn:peer-msg", JSON.stringify(box.slice(0, 200)));
    } catch (e) {}
    saveJobs();
  }
  function threadHtml(job) {
    var thr = ensureJobThread(job);
    if (!thr.length) return '<p class="note">No order talk yet · one map for vendor / client / driver.</p>';
    return '<div class="order-thread">' + thr.slice(0, 6).map(function (m) {
      return '<p class="note"><b>' + String(m.from || "?").toUpperCase() + '</b> · ' + String(m.text || "").replace(/[<>]/g, "") + "</p>";
    }).join("") + "</div>";
  }
  function openOrderTalk(jobId, seed) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) { say("Order not found."); return; }
    if (!signed()) { needLogin("LOGIN to talk on this order."); return; }
    ensureHopConfirms(job);
    applyDelayFees(job);
    var prompt = job.prompt || null;
    var delayN = Number(job.delayFee) || 0;
    var html = '<p class="note">Same map · arrive → ready/wait → Yes/No → pickup → at client → pickup or cancel. Delay +1 AV€/min. Cancel: money stays driver+vendor.</p>' +
      (delayN ? '<p class="note">Delay fee: <b>' + delayN + ' AV€</b> (client).</p>' : "") +
      (job.cancelled ? '<p class="note"><b>CANCELLED</b> · pay kept by driver+vendor.</p>' : "") +
      threadHtml(job) +
      (prompt === "vendor-ready"
        ? '<p class="note"><b>ARRIVED</b> · vendor ready?</p>' +
          '<button type="button" class="sheet-go primary" data-act="order-ready" data-id="' + job.id + '">READY</button>' +
          '<button type="button" class="sheet-go" data-act="order-wait-2" data-id="' + job.id + '">NEED 2 MORE MINUTES</button>'
        : "") +
      (prompt === "wait-yesno"
        ? '<p class="note"><b>WAIT 2 MIN?</b> Yes = delay clock (+1 AV€/min). No = cancel (keep pay).</p>' +
          '<button type="button" class="sheet-go primary" data-act="order-wait-yes" data-id="' + job.id + '">YES · WAIT</button>' +
          '<button type="button" class="sheet-go" data-act="order-wait-no" data-id="' + job.id + '">NO</button>'
        : "") +
      (prompt === "pickup"
        ? '<p class="note"><b>PICKUP</b></p>' +
          '<button type="button" class="sheet-go primary" data-act="order-pickup" data-id="' + job.id + '">PICKUP · CONFIRM</button>'
        : "") +
      (prompt === "client-receive"
        ? '<p class="note"><b>AT CLIENT</b> · pickup or cancel (cancel: money stays driver+vendor).</p>' +
          '<button type="button" class="sheet-go primary" data-act="order-client-ok" data-id="' + job.id + '">CLIENT PICKUP · CONFIRM</button>' +
          '<button type="button" class="sheet-go" data-act="order-wait-2" data-id="' + job.id + '">NEED 2 MORE MINUTES</button>' +
          '<button type="button" class="sheet-go" data-act="order-cancel" data-id="' + job.id + '">CANCEL · KEEP PAY</button>'
        : "") +
      (!job.cancelled
        ? '<button type="button" class="sheet-go" data-act="order-arrived" data-id="' + job.id + '">DRIVER · I ARRIVED</button>' +
          '<button type="button" class="sheet-go" data-act="order-at-drop" data-id="' + job.id + '">DRIVER · AT CLIENT</button>'
        : "") +
      '<textarea id="sn-order-msg" class="field" placeholder="Peer reply on this order">' + String(seed || "").replace(/[<>]/g, "") + "</textarea>" +
      '<button type="button" class="sheet-go primary" data-act="order-send" data-id="' + job.id + '">SEND ON ORDER</button>' +
      '<button type="button" class="sheet-go" data-act="close">HIDE</button>';
    openSheet("ORDER TALK · " + String((job.vendor && job.vendor.name) || job.id).slice(0, 18).toUpperCase(), html);
  }
  function applyDelayFees(job) {
    if (!job || !job.waitUntil || job.cancelled || job.status === "delivered") return 0;
    var now = Date.now();
    if (now < job.waitUntil) return Number(job.delayFee) || 0;
    var mins = Math.max(1, Math.ceil((now - (job.waitStarted || job.waitUntil)) / 60000));
    var already = Number(job.delayAppliedMins) || 0;
    var add = Math.max(0, mins - already);
    if (add <= 0) return Number(job.delayFee) || 0;
    job.delayAppliedMins = mins;
    job.delayFee = (Number(job.delayFee) || 0) + add;
    job.fee = (Number(job.fee) || 0) + add;
    job.driverPay = (Number(job.driverPay != null ? job.driverPay : job.fee - add) || 0) + add;
    if (avcGet() >= add) avcSet(avcGet() - add);
    else job.delayOwed = (Number(job.delayOwed) || 0) + add;
    postOrderMsg(job, "system", "+" + add + " AV€ delay (" + mins + " min lost).", "delay");
    return job.delayFee;
  }
  function startWaitClock(job, mins) {
    mins = mins || 2;
    job.waitStarted = Date.now();
    job.waitUntil = Date.now() + mins * 60000;
    job.waitMins = mins;
  }
  function driverArrived(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    if (!signed()) { needLogin("LOGIN first."); return; }
    if (job.cancelled) { say("Order cancelled."); return; }
    postOrderMsg(job, "driver", "I arrived at vendor.", "arrived");
    job.prompt = "vendor-ready";
    job.confirms.pickup = job.confirms.pickup || { vendor: false, driver: false };
    job.confirms.pickup.driver = true;
    job.confirms.driver = true;
    syncOrderStatus(job);
    saveJobs();
    openOrderTalk(job.id);
    say("Arrived · vendor: ready or wait?");
  }
  function driverAtDrop(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    if (!signed()) { needLogin("LOGIN first."); return; }
    if (job.cancelled) { say("Order cancelled."); return; }
    ensureHopConfirms(job);
    if (!(job.confirms.pickup.vendor && job.confirms.pickup.driver)) {
      say("Finish pickup first.");
      return;
    }
    applyDelayFees(job);
    postOrderMsg(job, "driver", "I am at the client.", "at_client");
    job.prompt = "client-receive";
    job.confirms.deliver = job.confirms.deliver || { driver: false, client: false };
    job.confirms.deliver.driver = true;
    syncOrderStatus(job);
    saveJobs();
    openOrderTalk(job.id);
    say("At client · pickup or cancel (pay stays).");
  }
  function vendorReady(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    postOrderMsg(job, "vendor", "Ready.", "ready");
    job.prompt = "pickup";
    saveJobs();
    openOrderTalk(job.id);
    say("Ready · confirm pickup.");
  }
  function orderWait2(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    var who = job.prompt === "client-receive" ? "client" : "vendor";
    postOrderMsg(job, who, "Need 2 more minutes.", "wait");
    job.waitFrom = who;
    job.prompt = "wait-yesno";
    saveJobs();
    openOrderTalk(job.id);
    say("Wait asked · Yes / No?");
  }
  function orderWaitYes(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    postOrderMsg(job, "peer", "Yes · wait 2 min (+1 AV€/min if late).", "wait_yes");
    startWaitClock(job, 2);
    job.prompt = job.waitFrom === "client" ? "client-receive" : "vendor-ready";
    saveJobs();
    openOrderTalk(job.id);
    say("Wait Yes · +1 AV€/min after clock.");
  }
  function orderWaitNo(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    postOrderMsg(job, "peer", "No · will not wait.", "wait_no");
    orderCancelKeepPay(job.id, "Wait refused");
  }
  function orderPickup(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    applyDelayFees(job);
    postOrderMsg(job, "vendor", "Pickup confirmed.", "pickup");
    job.prompt = null;
    confirmHop(job.id, "pickup", "vendor");
    if (!(job.confirms.pickup && job.confirms.pickup.driver)) confirmHop(job.id, "pickup", "driver");
    postOrderMsg(job, "system", "Pickup done · drive to client.", "pickup_done");
    saveJobs();
    openOrderTalk(job.id);
    say("Pickup · next: at client.");
  }
  function clientReceived(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    applyDelayFees(job);
    postOrderMsg(job, "client", "Client pickup · confirmed.", "received");
    job.prompt = null;
    confirmHop(job.id, "deliver", "client");
    if (!(job.confirms.deliver && job.confirms.deliver.driver)) confirmHop(job.id, "deliver", "driver");
    openOrderTalk(job.id);
  }
  function orderCancelKeepPay(jobId, reason) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    applyDelayFees(job);
    job.cancelled = true;
    job.status = "cancelled";
    job.prompt = null;
    job.keepPay = true;
    job.cancelReason = reason || "cancelled";
    postOrderMsg(job, "system", "Cancelled · " + (reason || "") + " · money stays with driver + vendor (no refund).", "cancel");
    saveJobs();
    openOrderTalk(job.id);
    say("Cancelled · pay kept by driver+vendor.");
  }
  function sendOrderMsg(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    var ta = $("sn-order-msg");
    var msg = ta ? String(ta.value || "").trim() : "";
    if (!job || !msg) { say("Type a message on this order."); return; }
    applyDelayFees(job);
    postOrderMsg(job, "peer", msg, "chat");
    openOrderTalk(job.id);
    say("Order message sent.");
  }

  function hopHtml(job) {
    ensureHopConfirms(job);
    var p = job.confirms.pickup, d = job.confirms.deliver;
    var pickDone = !!(p.vendor && p.driver);
    var delDone = !!(d.driver && d.client);
    return '<div class="hop' + (pickDone ? " done" : "") + '"><b>1 · VENDOR HANDOFF</b><div class="pair">' +
      '<button type="button" class="' + (p.vendor ? "on" : "") + '" data-act="hop" data-hop="pickup" data-who="vendor" data-id="' + job.id + '">VENDOR</button>' +
      '<button type="button" class="' + (p.driver ? "on" : "") + '" data-act="hop" data-hop="pickup" data-who="driver" data-id="' + job.id + '">DRIVER</button>' +
      '</div><p class="note">Confirm + message · e.g. driver “I arrived” → vendor ready?</p></div>' +
      '<div class="hop' + (delDone ? " done" : "") + '"><b>2 · CUSTOMER RECEIVE</b><div class="pair">' +
      '<button type="button" class="' + (d.driver ? "on" : "") + '" data-act="hop" data-hop="deliver" data-who="driver" data-id="' + job.id + '"' + (pickDone ? "" : " disabled") + '>DRIVER</button>' +
      '<button type="button" class="' + (d.client ? "on" : "") + '" data-act="hop" data-hop="deliver" data-who="client" data-id="' + job.id + '"' + (pickDone ? "" : " disabled") + '>CUSTOMER</button>' +
      '</div><p class="note">Confirm + peer talk on this order.</p></div>' +
      threadHtml(job) +
      '<button type="button" class="sheet-go primary" data-act="order-arrived" data-id="' + job.id + '">DRIVER · I ARRIVED</button>' +
      '<button type="button" class="sheet-go" data-act="order-at-drop" data-id="' + job.id + '">AT CLIENT</button>' +
      '<button type="button" class="sheet-go" data-act="order-talk" data-id="' + job.id + '">ORDER TALK</button>' +
      '<button type="button" class="sheet-go" data-act="order-cancel" data-id="' + job.id + '">CANCEL · KEEP PAY</button>';
  }
  function clearDriverMark() {
    if (driverMark && map) try { map.removeLayer(driverMark); } catch (e) {}
    driverMark = null;
  }
  function placeDriverOnRoute(from, to) {
    clearDriverMark();
    if (!map || typeof L === "undefined" || !from || !to) return;
    var mid = { lat: (Number(from.lat) + Number(to.lat)) / 2, lng: (Number(from.lng) + Number(to.lng)) / 2 };
    driverMark = L.circleMarker([mid.lat, mid.lng], {
      radius: 9, color: "#4df0ff", fillColor: "#1a3cff", fillOpacity: 0.95, weight: 2
    }).bindTooltip("DRIVER", { permanent: false, direction: "top" }).addTo(map);
  }
  function drawAcceptedRoute(job) {
    var from = job && (job.vendor || job.from);
    var to = job && (job.drop || job.to);
    if (!from || !to || !isFinite(Number(from.lat)) || !isFinite(Number(to.lat))) return;
    if (!cityOn && typeof openCity === "function") openCity(here || from);
    drawRoute(from, to);
    placeDriverOnRoute(from, to);
  }
  function paintActiveOfferCard(job, mode) {
    ensureHopConfirms(job);
    var id = "offer-" + job.id;
    var feeN = Number(job.fee != null ? job.fee : job.total);
    var priceHtml = isFinite(feeN)
      ? '<div class="price">' + Math.round(feeN).toLocaleString("en-GB") + " <small>AV€</small></div>"
      : '<div class="price">— <small>AV€</small></div>';
    var title = String((job.vendor && job.vendor.name) || job.shop || job.name || "OFFER").replace(/[<>]/g, "");
    var note = String(job.note || job.item || "Vendor → client with driver. Dual-confirm each hop.").replace(/[<>]/g, "");
    var body;
    if (mode === "pending") {
      body = '<div class="offer-actions">' +
        '<button type="button" class="decline" data-act="decline" data-id="' + job.id + '">DECLINE</button>' +
        '<button type="button" class="accept" data-act="accept" data-id="' + job.id + '">ACCEPT</button></div>';
    } else {
      body = hopHtml(job);
    }
    var html = '<div class="offer-card" data-offer="' + id + '">' + priceHtml +
      "<h3>" + title.toUpperCase() + "</h3>" +
      '<p class="note">' + note + (isFinite(Number(job.km)) ? " · " + Number(job.km).toFixed(1) + " km" : "") + "</p>" +
      body + "</div>";
    upsertTab({ id: id, kind: "offer", title: title.slice(0, 16).toUpperCase(), html: html, min: false, jobId: job.id, mode: mode });
    paintDrawerContent();
    openOfferDrawer();
  }
  function synthOfferPoints(job) {
    var base = here || { lat: 37.9838, lng: 23.7275 };
    if (!job.vendor || !isFinite(Number(job.vendor.lat))) {
      job.vendor = Object.assign({ name: (job.vendor && job.vendor.name) || job.name || "VENDOR", lat: base.lat + 0.012, lng: base.lng - 0.01 }, job.vendor || {});
    }
    if (!job.drop || !isFinite(Number(job.drop.lat))) {
      job.drop = Object.assign({ name: "CLIENT", lat: base.lat - 0.01, lng: base.lng + 0.014 }, job.drop || {});
    }
    if (!isFinite(Number(job.km))) {
      try { job.km = haversineKm(job.vendor, job.drop); } catch (e) { job.km = 2.4; }
    }
    if (!isFinite(Number(job.fee))) job.fee = job.fee || 18;
    return job;
  }
  function declineOffer(jobId) {
    clearOfferCountdown();
    offerActiveId = null;
    pendingOffer = null;
    dockTabs = dockTabs.filter(function (t) { return !(t.kind === "offer" && String(t.jobId) === String(jobId)); });
    paintDrawerContent();
    setDrawerHeight(collapsedDrawerH());
    clearDriverMark();
    say("Declined.");
  }
  function acceptOffer(jobId) {
    clearOfferCountdown();
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job && pendingOffer && String(pendingOffer.id) === String(jobId || pendingOffer.id)) job = pendingOffer;
    if (!job) {
      job = synthOfferPoints({
        id: jobId || ("j" + Date.now().toString(36)),
        name: "OFFER",
        fee: 18,
        stage: 0,
        confirms: { pickup: { vendor: false, driver: false }, deliver: { driver: false, client: false } },
        paid: false,
        t: Date.now(),
        note: "Accepted · dual-confirm hops live."
      });
    } else {
      synthOfferPoints(job);
      ensureHopConfirms(job);
    }
    if (!jobs.filter(function (j) { return String(j.id) === String(job.id); }).length) jobs.unshift(job);
    pendingOffer = null;
    job.stage = Math.max(job.stage || 0, 0);
    job.accepted = true;
    job.note = "Accepted · dual-confirm hops live.";
    saveJobs();
    offerActiveId = job.id;
    /* If this was a routed vendor offer, vendor confirm unlocks delivery */
    if (job.route && job.route.needsVendorConfirm && !job.route.vendorConfirmed) {
      vendorConfirmOrder(job.id);
      return;
    }
    paintActiveOfferCard(job, "active");
    drawAcceptedRoute(job);
    say("Accepted · vendor↔driver then driver↔customer.");
  }
  function confirmHop(jobId, hop, who) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job) return;
    ensureHopConfirms(job);
    if (hop !== "pickup" && hop !== "deliver") return;
    if (!job.confirms[hop]) return;
    if (hop === "deliver" && !(job.confirms.pickup.vendor && job.confirms.pickup.driver)) {
      say("Finish vendor handoff first.");
      return;
    }
    job.confirms[hop][who] = true;
    /* mirror legacy flat flags for older UI */
    if (hop === "pickup" && who === "vendor") job.confirms.vendor = true;
    if (hop === "pickup" && who === "driver") job.confirms.driver = true;
    if (hop === "deliver" && who === "driver") job.confirms.driver = true;
    if (hop === "deliver" && who === "client") job.confirms.client = true;
    /* Every order step = confirmed action + messaging */
    postOrderMsg(job, who, hop === "pickup"
      ? (who === "driver" ? "Confirmed at vendor." : "Confirmed handoff ready.")
      : (who === "driver" ? "Confirmed delivered." : "Confirmed received."),
      "confirm");
    if (job.confirms.pickup.vendor && job.confirms.pickup.driver) job.stage = Math.max(job.stage, 2);
    if (job.confirms.deliver.driver && job.confirms.deliver.client) {
      job.stage = Math.max(job.stage, 4);
      say("Chain verified · " + ((job.vendor && job.vendor.name) || "job") + " delivered.");
      archiveTransaction(job, activeExchange);
    } else if (job.confirms.pickup.vendor && job.confirms.pickup.driver) {
      say("Pickup verified · en route to customer.");
      drawAcceptedRoute(job);
      paintDrawerContent();
    } else {
      say((who.toUpperCase()) + " confirmed · need both sides of this hop.");
      paintDrawerContent();
    }
    saveJobs();
    paintActiveOfferCard(job, "active");
    openJobs();
  }
  function throwOffer(job) {
    job = job || {};
    var rawId = job.id ? String(job.id) : ("live" + Date.now().toString(36));
    job = synthOfferPoints(Object.assign({}, job, { id: rawId }));
    ensureHopConfirms(job);
    if (!jobs.filter(function (j) { return String(j.id) === String(job.id); }).length) {
      /* pending offer card only — Accept materializes permanently */
    }
    offerActiveId = job.id;
    pendingOffer = job;
    paintActiveOfferCard(job, "pending");
    var from = job.vendor || job.from;
    var to = job.drop || job.to;
    if (from && to && isFinite(Number(from.lat)) && isFinite(Number(to.lat))) {
      if (!cityOn && typeof openCity === "function") openCity(here || from);
      drawRoute(from, to);
    } else {
      fitOfferRoute();
    }
    startOfferCountdown(13, function () { declineOffer(job.id); });
  }
  function openOfferDrawer() {
    setDrawerHeight(offerDrawerH());
  }
  function offerDrawerH() {
    return Math.max(collapsedDrawerH(), Math.min(maxDrawerH(), Math.round(window.innerHeight * (2 / 3))));
  }
  function collapsedDrawerH() { return 70; }

  function setSupport(on) {
    supportOn = !!on;
    var btn = $("sn-support");
    if (btn) btn.classList.toggle("on", supportOn);
    var desk = $("sn-support-sheet");
    if (!desk) return;
    if (!supportOn) {
      desk.classList.remove("on");
      desk.innerHTML = "";
      layoutChrome();
      say("AI support closed.");
      return;
    }
    intro = false;
    desk.innerHTML =
      '<div class="sheet-bar"><b class="sheet-ttl">AI SUPPORT · CURSOR</b><button type="button" class="sheet-x" data-act="support-close">HIDE</button></div>' +
      '<p class="note">Product / bugs only — routes to Cursor (official programmer). Peer issues (orders, disputes, “where is my driver”) → tap a pin on the map and MESSAGE. No human support.</p>' +
      '<textarea id="sn-support-matter" placeholder="Describe the product bug / what broke"></textarea>' +
      '<button type="button" class="sheet-go" data-act="support-mic">MIC</button>' +
      '<button type="button" class="sheet-go primary" data-act="support-send">SEND TO CURSOR AI</button>' +
      '<button type="button" class="sheet-go" data-act="support-peer-hint">PEER ISSUE? USE MAP MSG</button>';
    desk.classList.add("on");
    layoutChrome();
    var ta = $("sn-support-matter");
    if (ta) ta.focus();
    say("AI support · product bugs only.");
  }
  function openSupport() {
    if (supportOn) { setSupport(false); return; }
    setSupport(true);
  }
  function listenSupport() {
    if (!(window.SpeechRecognition || window.webkitSpeechRecognition)) { say("Type in the support menu."); return; }
    var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    var rec = new Rec();
    rec.lang = "en-GB";
    rec.interimResults = false;
    rec.continuous = false;
    rec.onresult = function (ev) {
      var t = ev.results[0][0].transcript;
      var ta = $("sn-support-matter");
      if (ta) ta.value = t;
      sendSupport(t, true);
    };
    try { rec.start(); say("Support listening…"); } catch (e) { say("Mic busy."); }
  }
  function sendSupport(matter, fromVoice) {
    matter = String(matter || "").trim();
    if (!matter) { say("Describe the product bug."); return; }
    lastVoice = !!fromVoice;
    if (!isProductBug(matter)) {
      setSupport(false);
      openSheet("PEER CHANNEL",
        '<p class="note">That sounds like a peer / order issue — not a product bug. Tap a vendor, driver, or client pin on the map and use MESSAGE. AI Support (Cursor) is for fixable product bugs only.</p>' +
        '<button type="button" class="sheet-go primary" data-act="close">GOT IT</button>');
      say("Peer issue · use map messaging.");
      return;
    }
    var t = authToken();
    var who = "";
    try {
      var u = window.SNAuth && SNAuth.user && SNAuth.user();
      who = (u && (u.name || u.email)) || "";
    } catch (e) {}
    say("Cursor AI…");
    fetch("/api/support/open", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: t ? "Bearer " + t : "" },
      body: JSON.stringify({ matter: matter, name: who || "guest", ticket: supportTicket, channel: "cursor", kind: "product-bug" })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ticket) supportTicket = j.ticket;
      var text = (j && j.say) || ("Bug ticket " + (supportTicket || "parked") + " → Cursor AI programmer.");
      say(text);
      speakIfVoice(text);
      try {
        var prompt = "SpaceNet product bug on astranov.eu stamp:\n" + matter + (supportTicket ? ("\nTicket: " + supportTicket) : "");
        var url = "https://cursor.com/agents?prompt=" + encodeURIComponent(prompt.slice(0, 1500));
        window.open(url, "_blank", "noopener");
      } catch (e2) {}
    }).catch(function () {
      try {
        window.open("https://cursor.com/agents?prompt=" + encodeURIComponent("SpaceNet bug: " + matter.slice(0, 1200)), "_blank", "noopener");
      } catch (e3) {}
      say("Opened Cursor AI with your bug note.");
    });
  }
  function haversineKm(a, b) {
    var R = 6371;
    var p1 = (a.lat * Math.PI) / 180, p2 = (b.lat * Math.PI) / 180;
    var d1 = ((b.lat - a.lat) * Math.PI) / 180, d2 = ((b.lng - a.lng) * Math.PI) / 180;
    var x = Math.sin(d1 / 2) * Math.sin(d1 / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(d2 / 2) * Math.sin(d2 / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function isNight() {
    var h = new Date().getHours();
    return h >= 22 || h < 7; /* night surcharge window 22:00–07:00 */
  }
  function quoteDelivery(from, to, opts) {
    opts = opts || {};
    var d = haversineKm(from, to);
    var parts = Math.max(0, Math.ceil(d || 0));
    /* Base: 1 AV€ per km or part-km · 3 AV€ minimum */
    var base = Math.max(3, parts);
    var night = (opts.night === true || (opts.night !== false && isNight())) ? 1 : 0;
    var extraKm = Math.max(0, Math.floor((d - 3) / 3)); /* +1 per each 3 km beyond 3 */
    var weather = (opts.rain || opts.weather) ? 1 : 0;
    /* +1 room service: basement / penthouse / any non-ground (not street/ground) */
    var floor = (opts.floor || opts.nonground || opts.room) ? 1 : 0;
    /* Surcharges included in the delivery price the client pays */
    var fee = base + night + extraKm + weather + floor;
    /* All delivery money → driver (no platform cut on delivery) */
    return {
      km: d,
      base: base,
      night: night,
      extraKm: extraKm,
      weather: weather,
      floor: floor,
      fee: fee,
      driver: fee,
      cut: 0,
      total: fee,
      payUpfront: true
    };
  }
  function loadJobs() {
    try { jobs = JSON.parse(localStorage.getItem("sn:jobs") || "[]") || []; } catch (e) { jobs = []; }
    if (!Array.isArray(jobs)) jobs = [];
    jobs.forEach(function (j) { ensureHopConfirms(j); });
  }
  function saveJobs() { try { jobs.forEach(syncOrderStatus); localStorage.setItem("sn:jobs", JSON.stringify(jobs)); } catch (e) {} }
  function authToken() {
    try { return (window.SNAuth && SNAuth.token && SNAuth.token()) || localStorage.getItem("sn:access") || ""; } catch (e) { return ""; }
  }
  function uniqPlaces(list) {
    var out = [], seen = {};
    list.forEach(function (p) {
      if (!p || !isFinite(p.lat) || !isFinite(p.lng) || !p.name) return;
      if (here && haversineKm(here, p) > 40) return;
      var k = p.name.toLowerCase() + ":" + p.lat.toFixed(4) + "," + p.lng.toFixed(4);
      if (seen[k]) return;
      seen[k] = 1;
      out.push(p);
    });
    return out.slice(0, 8);
  }
  function asPlace(row) {
    if (!row) return null;
    var lat = Number(row.lat != null ? row.lat : (row.center && row.center.lat));
    var lng = Number(row.lng != null ? row.lng : row.lon != null ? row.lon : (row.center && row.center.lon));
    var tags = row.tags || {};
    var name = row.name || tags.name || row.display_name || "";
    if (name && name.indexOf(",") >= 0) name = name.split(",")[0];
    if (!name || !isFinite(lat) || !isFinite(lng)) return null;
    return {
      id: String(row.id || row.osm_id || (name + lat + lng)),
      name: String(name).slice(0, 80),
      lat: lat,
      lng: lng,
      kind: row.kind || tags.amenity || tags.shop || "shop",
      phone: row.phone || tags.phone || tags["contact:phone"] || "",
      src: row.src || "osm"
    };
  }
  function liftChrome() {
    var h = 0;
    ["sn-sheet", "sn-tasks"].forEach(function (id) {
      var el = $(id);
      if (!el || !el.classList.contains("on") || el.classList.contains("min")) return;
      var card = el.querySelector(".card");
      var r = visRect(card);
      if (r) h = Math.max(h, r.height);
    });
    document.documentElement.style.setProperty("--sheet-h", h + "px");
    layoutChrome();
    if (map && typeof map.invalidateSize === "function") {
      try { map.invalidateSize(); } catch (e) {}
    }
    if (routeLayer && map) fitOfferRoute();
  }
  function fitOfferRoute() {
    if (!map || typeof L === "undefined") return;
    var topEl = visRect($("top"));
    var drawer = visRect($("drawer"));
    var radar = visRect($("sn-radar"));
    var top = 56, bot = 80, side = 20;
    if (topEl) top = Math.max(top, Math.round(topEl.bottom + 10));
    if (radar) top = Math.max(top, Math.round(radar.bottom + 8));
    if (drawer) bot = Math.max(bot, Math.round(window.innerHeight - drawer.top + 12));
    else bot = Math.max(bot, Math.round(drawerH || 70) + 16);
    var pts = [];
    try {
      if (routeLayer && routeLayer.getLatLngs) {
        var ll = routeLayer.getLatLngs();
        (Array.isArray(ll[0]) ? ll : [ll]).forEach(function (ring) {
          (ring || []).forEach(function (p) { if (p && isFinite(p.lat)) pts.push([p.lat, p.lng]); });
        });
      }
    } catch (e) {}
    if (here && isFinite(here.lat) && isFinite(here.lng)) pts.push([here.lat, here.lng]);
    if (vendor && isFinite(vendor.lat)) pts.push([vendor.lat, vendor.lng]);
    if (drop && isFinite(drop.lat)) pts.push([drop.lat, drop.lng]);
    try {
      if (driverMark && driverMark.getLatLng) {
        var dl = driverMark.getLatLng();
        if (dl && isFinite(dl.lat)) pts.push([dl.lat, dl.lng]);
      }
    } catch (e3) {}
    if (pts.length < 1) return;
    try {
      var bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, {
        paddingTopLeft: [side, top],
        paddingBottomRight: [side, bot],
        maxZoom: 16,
        animate: true
      });
      if (typeof map.invalidateSize === "function") map.invalidateSize({ animate: false });
    } catch (e2) {}
  }
  function openSheet(title, html) {
    var sh = $("sn-sheet"), card = $("sn-sheet-card");
    if (!sh || !card) return;
    card.innerHTML = '<div class="sheet-bar"><b class="sheet-ttl"></b><button type="button" class="sheet-x" data-act="close">HIDE</button></div><div id="sn-sheet-body"></div>';
    card.querySelector(".sheet-ttl").textContent = title;
    card.querySelector("#sn-sheet-body").innerHTML = html;
    sh.classList.add("on");
    materialize(true);
    liftChrome();
  }
  function closeSheet() { var sh = $("sn-sheet"); if (sh) sh.classList.remove("on"); materialize(needFilter()); liftChrome(); paintDrawerContent(); }
  function paintShopsOnMap() {
    if (!map || typeof L === "undefined") return;
    shopMarks.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
    shopMarks = [];
    var list = uniqPlaces((shops || []).concat(FAMOUS_VENDORS));
    list.forEach(function (s) {
      if (!isFinite(s.lat) || !isFinite(s.lng)) return;
      var mark = L.circleMarker([s.lat, s.lng], { radius: 8, color: s.famous ? "#ff8a3d" : "#7ee9ff", fillColor: "#0a2030", fillOpacity: 0.95, weight: 2 });
      mark.bindTooltip(s.name || "shop", { direction: "top" });
      mark.on("click", function (e) {
        if (e && e.originalEvent) L.DomEvent.stop(e.originalEvent);
        openActorSheet({ id: s.id || ("shop-" + s.name), role: "vendor", kind: "vendor", name: s.name, lat: s.lat, lng: s.lng, phone: s.phone, menu: s.menu, famous: !!s.famous, verified: true });
      });
      mark.addTo(map);
      shopMarks.push(mark);
    });
    paintActorsOnMap();
  }
  function showFound() {
    if (!shops.length) { say("No real pin for that hunt. Try another name near GPS."); return; }
    var seat = here || shops[0];
    if (seat) openCity(seat);
    paintShopsOnMap();
    var html = shops.map(function (s, i) {
      var ch = (s.name.match(/[A-Za-zΑ-Ωα-ω]/) || ["·"])[0].toUpperCase();
      return '<button type="button" class="pill" data-act="vendor" data-i="' + i + '"><span class="ph">' + ch + "</span><div><b></b><span></span></div></button>";
    }).join("");
    openSheet("FIND · " + shops.length, html);
    var body = $("sn-sheet-body");
    if (body) {
      var pills = body.querySelectorAll(".pill");
      shops.forEach(function (s, i) {
        if (!pills[i]) return;
        pills[i].querySelector("b").textContent = s.name;
        pills[i].querySelector("span").textContent = (s.kind || "shop") + (s.phone ? " · " + s.phone : "") + (here ? " · " + haversineKm(here, s).toFixed(1) + " km" : "");
      });
    }
    say(shops.length + " real pin" + (shops.length === 1 ? "" : "s") + ". Tap one to order.");
  }
  function fetchJson(url, opts) {
    return fetch(url, opts || {}).then(function (r) { return r.json().catch(function () { return null; }); }).catch(function () { return null; });
  }
  function huntApi(q) {
    if (!here) return Promise.resolve([]);
    var url = "/api/find?q=" + encodeURIComponent(q) + "&lat=" + here.lat.toFixed(4) + "&lng=" + here.lng.toFixed(4);
    return fetchJson(url).then(function (j) {
      return ((j && j.places) || []).map(function (p) { p.src = "find"; return asPlace(p); }).filter(Boolean);
    });
  }
  function suggestLocal(q) {
    q = String(q || "").trim().toLowerCase();
    var pool = FAMOUS_VENDORS.concat(loadActors()).concat(shops || []);
    if (!q) return pool.slice(0, 8);
    return pool.filter(function (s) {
      return s && String(s.name || "").toLowerCase().indexOf(q) >= 0;
    }).slice(0, 8);
  }
  function paintSearchSuggest(q) {
    var box = $("sn-suggest");
    if (!box) return;
    var rows = suggestLocal(q);
    if (!rows.length) { box.innerHTML = ""; box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = rows.map(function (s, i) {
      return '<button type="button" class="sug" data-act="suggest" data-i="' + i + '" data-name="' + String(s.name).replace(/"/g, "") + '">' +
        String(s.name).replace(/[<>]/g, "") + (s.famous ? " · famous" : "") + "</button>";
    }).join("");
    box.__rows = rows;
  }
  function hunt(q) {
    q = String(q || "").trim();
    if (!q) {
      shops = uniqPlaces(FAMOUS_VENDORS.concat(shops || []));
      if (shops.length) { if (!cityOn) openCity(shops[0]); paintShopsOnMap(); showFound(); }
      return;
    }
    materialize(true);
    say("Finding " + q + "…");
    var local = suggestLocal(q).map(function (s) {
      return { name: s.name, lat: s.lat, lng: s.lng, kind: s.kind || s.role || "shop", phone: s.phone || "", src: s.famous ? "famous" : "local", famous: !!s.famous };
    });
    var go = function () {
      /* Lean: one server path (/api/find). No browser Nominatim/Overpass (CORS + triple work). */
      huntApi(q).then(function (rows) {
        shops = uniqPlaces(local.concat(rows || [], FAMOUS_VENDORS));
        showFound();
      });
    };
    if (!here) locate(function (pt) { land(pt, false); go(); });
    else go();
  }
  function pullListings() {
    if (!here) return;
    var url = "/api/space?lat=" + Number(here.lat).toFixed(2) + "&lng=" + Number(here.lng).toFixed(2);
    fetchJson(url, { cache: "no-store" }).then(function (j) {
      var rows = (j && (j.shops || j.rows || [])) || [];
      rows.forEach(function (r) {
        var p = asPlace(r);
        if (p) shops.push(p);
      });
      shops = uniqPlaces(shops);
      if (shops.length) paintShopsOnMap();
    });
    if (!listingTried) {
      listingTried = true;
      /* Lean: nearby pins come from /api/space + famous locals; hunt uses /api/find only. */
      if (shops.length) {
        paintShopsOnMap();
        say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · " + shops.length + " places around you.");
      } else if (here) say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · talk a shop name to hunt");
    }
  }
  function vendorMenu(s) {
    var base = (s && s.menu && s.menu.length) ? s.menu : [
      { name: "House special", price: "12", note: "Photo · fresh", hours: "11:00–22:00", stock: "in", photo: "" },
      { name: "Daily tray", price: "8", note: "Limited", hours: "12:00–20:00", stock: "in", photo: "" },
      { name: "Drink", price: "3", note: "Cold", hours: "all day", stock: "in", photo: "" }
    ];
    return base.map(function (m, i) {
      return {
        i: i,
        name: m.name || ("Item " + (i + 1)),
        price: Number(m.price) || 0,
        note: m.note || m.desc || "",
        hours: m.hours || m.availability || "Today",
        stock: m.stock || "in",
        photo: m.photo || m.image || ""
      };
    });
  }
  function cartQty(i) { return Math.max(0, Number((cart.items && cart.items[i]) || 0) | 0); }
  function cartSubtotal() {
    if (!vendor) return 0;
    var menu = vendorMenu(vendor), sum = 0;
    menu.forEach(function (m) { sum += cartQty(m.i) * m.price; });
    return Math.round(sum * 100) / 100;
  }
  function cartFee(sub) { return Math.round((Number(sub) || 0) * FEE_PCT * 100) / 100; }
  function cartTotal() {
    var sub = cartSubtotal();
    return Math.round((sub + cartFee(sub)) * 100) / 100;
  }
  function openVendor(s) {
    vendor = s;
    cart = { items: {}, comment: cart && cart.comment || "" };
    if (map && isFinite(s.lat)) map.setView([s.lat, s.lng], 17);
    renderVendorShop();
    var ds = s && (s.vendor_type === "delivery_services" || s.kind === "delivery_services");
    say(s.name + (ds ? " · delivery services · same UX as food · AV€ · 3% fee." : " · profile + menu. Order in AV€ · 3% fee."));
  }
  function renderVendorShop() {
    if (!vendor) return;
    var s = vendor;
    var ds = s.vendor_type === "delivery_services" || s.kind === "delivery_services";
    var km = here ? haversineKm(here, s).toFixed(1) : "—";
    var addr = s.address || s.raw || (Number(s.lat).toFixed(4) + ", " + Number(s.lng).toFixed(4));
    var phone = s.phone ? String(s.phone) : "";
    var pic = s.photo || s.image || "";
    var actorId = s.id || ("shop-" + s.name);
    var menu = vendorMenu(s);
    var rows = menu.map(function (m) {
      var q = cartQty(m.i);
      return '<div class="menu-row" data-i="' + m.i + '">' +
        (m.photo ? '<img class="menu-pic" src="' + String(m.photo).replace(/"/g, "") + '" alt=""/>' : '<div class="menu-pic ph">' + (ds ? "🚚" : "🍽") + "</div>") +
        '<div class="menu-body"><b>' + String(m.name).replace(/[<>]/g, "") + "</b>" +
        '<span class="menu-meta">' + m.price + " AV€ · " + String(m.hours).replace(/[<>]/g, "") + " · " + (m.stock === "in" ? "available" : "low") + "</span>" +
        (m.note ? '<span class="menu-desc">' + String(m.note).replace(/[<>]/g, "") + "</span>" : "") +
        '<div class="qty"><button type="button" data-act="qty-minus" data-i="' + m.i + '">−</button>' +
        '<em>' + q + "</em>" +
        '<button type="button" data-act="qty-plus" data-i="' + m.i + '">+</button></div></div></div>';
    }).join("");
    var sub = cartSubtotal(), fee = cartFee(sub), tot = cartTotal();
    var html =
      '<div class="vendor-banner">' +
        (pic ? '<img class="vendor-pic" src="' + String(pic).replace(/"/g, "") + '" alt=""/>' : '<div class="vendor-pic ph">' + (ds ? "🚚" : "🏪") + "</div>") +
        '<div class="vendor-who"><b>' + String(s.name || "VENDOR").replace(/[<>]/g, "") + "</b>" +
        '<span>' + String(addr).replace(/[<>]/g, "") + "</span>" +
        (phone ? '<span>' + String(phone).replace(/[<>]/g, "") + "</span>" : "") +
        '<span>' + (ds ? "delivery_services" : (s.kind || "vendor")) + " · " + km + " km</span></div>" +
        '<div class="vendor-comms">' +
          '<button type="button" class="sheet-go" data-act="peer-msg" data-id="' + actorId + '">MESSAGE</button>' +
          '<button type="button" class="sheet-go" data-act="peer-video" data-id="' + actorId + '">VIDEO</button>' +
          (phone ? '<a class="sheet-go" href="tel:' + phone.replace(/[^\d+]/g, "") + '">CALL</a>' : "") +
        "</div></div>" +
      '<b class="menu-ttl">' + (ds ? "DELIVERY SKUS" : "MENU") + "</b>" + rows +
      '<div class="checkout">' +
        '<p class="note">Subtotal ' + sub + " AV€ · fee 3% " + fee + " AV€ · <b>" + tot + " AV€</b> (only fee)</p>" +
        '<button type="button" class="sheet-go primary" data-act="open-order"' + (sub > 0 ? "" : " disabled") + ">CHECKOUT AV€</button>" +
        '<button type="button" class="sheet-go" data-act="gpsdrop">DELIVER TO GPS</button>' +
        '<button type="button" class="sheet-go" data-act="close">HIDE</button></div>';
    openSheet(String(s.name || "VENDOR").toUpperCase(), html);
  }
  function openOrderScreen() {
    if (!vendor) return;
    var menu = vendorMenu(vendor);
    var lines = menu.filter(function (m) { return cartQty(m.i) > 0; });
    if (!lines.length) { say("Add items with +."); return; }
    var rows = lines.map(function (m) {
      return '<div class="menu-row"><div class="menu-body"><b>' + String(m.name).replace(/[<>]/g, "") + "</b>" +
        '<span class="menu-meta">' + m.price + " AV€ each</span>" +
        '<div class="qty"><button type="button" data-act="qty-minus" data-i="' + m.i + '" data-order="1">−</button>' +
        '<em>' + cartQty(m.i) + "</em>" +
        '<button type="button" data-act="qty-plus" data-i="' + m.i + '" data-order="1">+</button></div></div></div>';
    }).join("");
    var sub = cartSubtotal(), fee = cartFee(sub), tot = cartTotal();
    openSheet("ORDER · AV€",
      '<p class="note">Edit items / qty. Comments optional. Checkout in Astranov AV€. Fee 3% forever — only fee.</p>' +
      rows +
      '<textarea id="sn-order-comment" class="field" placeholder="Order comments">' + String(cart.comment || "").replace(/</g, "") + "</textarea>" +
      '<div class="checkout"><p class="note">Subtotal ' + sub + " · 3% " + fee + " · <b>total " + tot + " AV€</b></p>" +
      '<button type="button" class="sheet-go primary" data-act="pay-avc">PAY ' + tot + " AV€</button>" +
      '<button type="button" class="sheet-go" data-act="back-vendor">EDIT MENU</button></div>');
  }

  function offersArmed() {
    try { return localStorage.getItem("sn:offers") === "1"; } catch (e) { return false; }
  }
  function liveReceivers(role) {
    var rows = loadActors().filter(function (a) {
      return a && a.role === role && a.verified;
    });
    /* Famous vendors always eligible as demo receivers when power is on for this device */
    if (role === "vendor") {
      FAMOUS_VENDORS.forEach(function (f) {
        rows.push({ id: "fam-" + f.name, role: "vendor", name: f.name, lat: f.lat, lng: f.lng, verified: true, famous: true });
      });
    }
    return rows;
  }
  function routeOrderToLive(job) {
    if (!job) return;
    job.route = job.route || { vendors: [], drivers: [], vendorConfirmed: false };
    var vendors = liveReceivers("vendor");
    var drivers = liveReceivers("driver");
    /* Prefer search-hit shops near drop/vendor */
    var near = (shops || []).slice(0, 12);
    near.forEach(function (s) {
      if (!s) return;
      vendors.push({ id: s.id || ("shop-" + s.name), role: "vendor", name: s.name, lat: s.lat, lng: s.lng, verified: true });
    });
    /* Dedupe by name+approx coords */
    function dedupe(list) {
      var seen = {}, out = [];
      list.forEach(function (a) {
        if (!a || !a.name) return;
        var k = String(a.name).toLowerCase() + ":" + (isFinite(a.lat) ? a.lat.toFixed(3) : "");
        if (seen[k]) return; seen[k] = 1; out.push(a);
      });
      return out.slice(0, 8);
    }
    job.route.vendors = dedupe(vendors);
    job.route.drivers = dedupe(drivers);
    job.route.needsVendorConfirm = true;
    job.stage = Math.max(job.stage || 0, 0);
    saveJobs();
    if (offersArmed()) {
      job.route.vendors.slice(0, 4).forEach(function (v) {
        throwOffer({
          id: job.id + "-v-" + v.id,
          name: v.name,
          fee: job.fee,
          vendor: v,
          drop: job.drop,
          km: job.km,
          note: "Incoming client order · confirm to start delivery",
          jobId: job.id,
          role: "vendor"
        });
      });
      if (job.route.drivers.length) {
        /* Drivers see offer only after vendor confirm — staged later */
      }
      say("Routed to " + job.route.vendors.length + " live vendor(s)" + (offersArmed() ? " · power ON" : "") + ".");
    } else {
      say("Order parked. Vendors/drivers with POWER ON receive live offers.");
    }
    return job;
  }
  var DRIVER_DAY_GOAL = 300; /* AV€/day target per driver */
  var VENDOR_PREP_MIN = 30; /* default prep window — allows farther under-cap drivers */

  function dayStartMs() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }
  function driverKey(d) {
    if (!d) return "";
    return String(d.id || ("n:" + (d.name || "").toLowerCase()));
  }
  function driverIncomeToday(d) {
    var key = driverKey(d);
    if (!key) return 0;
    var t0 = dayStartMs();
    var sum = isFinite(Number(d.incomeToday)) ? Number(d.incomeToday) : 0;
    jobs.forEach(function (j) {
      if (!j || (j.t || 0) < t0) return;
      var dk = j.driverId || driverKey(j.driver);
      if (String(dk) !== key) return;
      sum += Number(j.driverPay != null ? j.driverPay : j.fee) || 0;
    });
    return sum;
  }
  /* Closest, or who needs work most (lowest income today). Cap ≥300 → others when prep allows. */
  function pickDeliveryDrivers(job, pool) {
    var origin = (job && job.vendor) || (job && job.drop) || here;
    var prep = Number(job && job.prepMin != null ? job.prepMin : VENDOR_PREP_MIN);
    var allowFar = prep >= VENDOR_PREP_MIN; /* half-hour prep → can skip capped closest */
    var rows = (pool || []).map(function (d) {
      return {
        id: d.id,
        name: d.name,
        lat: d.lat,
        lng: d.lng,
        role: "driver",
        verified: d.verified,
        km: origin && isFinite(d.lat) && isFinite(d.lng) ? haversineKm(origin, d) : 999,
        earn: driverIncomeToday(d)
      };
    });
    var open = rows.filter(function (d) { return d.earn < DRIVER_DAY_GOAL; });
    var use = (allowFar && open.length) ? open : (open.length ? open : rows);
    use.sort(function (a, b) {
      /* neediest first, then closest */
      if (a.earn !== b.earn) return a.earn - b.earn;
      return a.km - b.km;
    });
    if (!allowFar) {
      /* tight schedule: closest among under-cap (or all) */
      use.sort(function (a, b) {
        if (a.km !== b.km) return a.km - b.km;
        return a.earn - b.earn;
      });
    }
    return use.slice(0, 3);
  }
  function vendorConfirmOrder(jobId) {
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId) || String(j.id) === String(String(jobId).split("-v-")[0]); })[0];
    if (!job) {
      var base = String(jobId || "").split("-v-")[0];
      job = jobs.filter(function (j) { return String(j.id) === base; })[0];
    }
    if (!job) { say("Order not found."); return; }
    ensureHopConfirms(job);
    job.route = job.route || {};
    job.route.vendorConfirmed = true;
    job.confirms.vendor = true;
    job.confirms.pickup = job.confirms.pickup || { vendor: false, driver: false };
    job.confirms.pickup.vendor = true;
    job.stage = Math.max(job.stage || 0, 1);
    if (job.prepMin == null) job.prepMin = VENDOR_PREP_MIN;
    var picks = pickDeliveryDrivers(job, job.route.drivers || liveReceivers("driver"));
    job.route.driverPicks = picks;
    if (picks[0]) {
      job.driver = { id: picks[0].id, name: picks[0].name, lat: picks[0].lat, lng: picks[0].lng };
      job.driverId = driverKey(picks[0]);
      job.route.pickReason = picks[0].earn < DRIVER_DAY_GOAL
        ? ("need " + Math.round(DRIVER_DAY_GOAL - picks[0].earn) + " to " + DRIVER_DAY_GOAL + " · " + picks[0].km.toFixed(1) + " km")
        : ("all near day-cap · closest " + picks[0].km.toFixed(1) + " km");
    }
    saveJobs();
    if (offersArmed() && picks.length) {
      picks.forEach(function (d) {
        throwOffer({
          id: job.id + "-d-" + d.id,
          name: "DELIVER · " + ((job.vendor && job.vendor.name) || "order"),
          fee: job.driverPay != null ? job.driverPay : job.fee,
          vendor: job.vendor,
          drop: job.drop,
          km: job.km,
          note: "Vendor confirmed · " + (job.driverPay != null ? job.driverPay : job.fee) + " AV€ → you · " + (d.earn < DRIVER_DAY_GOAL ? "needs work (" + Math.round(d.earn) + "/" + DRIVER_DAY_GOAL + ")" : "backup") + " · " + d.km.toFixed(1) + " km",
          jobId: job.id,
          role: "driver",
          driverId: driverKey(d)
        });
      });
    }
    paintActiveOfferCard(job, "active");
    drawAcceptedRoute(job);
    openJobs();
    say("Vendor confirmed · routed to " + (picks[0] ? picks[0].name : "drivers") + (job.route.pickReason ? " (" + job.route.pickReason + ")" : "") + ".");
  }

  function payCartAvc() {
    if (!signed()) { needLogin("LOGIN to pay in AV€."); return; }
    var ta = $("sn-order-comment");
    if (ta) cart.comment = String(ta.value || "").trim().slice(0, 500);
    var tot = cartTotal();
    if (tot <= 0) { say("Cart empty."); return; }
    if (!drop) drop = here || { lat: vendor.lat + 0.01, lng: vendor.lng + 0.01 };
    var q = quoteDelivery(vendor, drop, quoteOpts);
    var due = tot + q.total; /* cart + delivery (surcharges in) · delivery paid upfront */
    if (avcGet() < due) {
      openSheet("TOP UP AV€",
        '<p class="note">Need ' + due + " AV€ (order " + tot + " + delivery " + q.total + " upfront). You have " + Math.round(avcGet()) + " AV€.</p>" +
        '<input id="sn-add-eur" inputmode="decimal" placeholder="Euro to top up" value="20" />' +
        '<button type="button" class="sheet-go primary" data-act="topup" data-rail="paypal">PAYPAL</button>' +
        '<button type="button" class="sheet-go" data-act="topup" data-rail="stripe">STRIPE</button>' +
        '<button type="button" class="sheet-go" data-act="topup" data-rail="revolut">REVOLUT</button>');
      return;
    }
    avcSet(avcGet() - due);
    var job = {
      id: "j" + Date.now().toString(36),
      vendor: vendor,
      drop: drop,
      km: q.km,
      fee: q.total,
      driverPay: q.driver,
      orderTotal: tot,
      cut: cartFee(cartSubtotal()),
      quote: { base: q.base, night: q.night, extraKm: q.extraKm, weather: q.weather, floor: q.floor },
      prepMin: VENDOR_PREP_MIN,
      currency: "AV€",
      items: Object.keys(cart.items).map(function (k) { return { i: Number(k), qty: cart.items[k] }; }),
      comment: cart.comment || "",
      stage: 0,
      confirms: { vendor: false, driver: false, client: false, pickup: { vendor: false, driver: false }, deliver: { driver: false, client: false } },
      paid: true,
      paidUpfront: true,
      status: "pending",
      t: Date.now()
    };
    jobs.unshift(job);
    saveJobs();
    routeOrderToLive(job);
    cart = { items: {}, comment: "" };
    closeSheet();
    openJobs();
    say("Paid " + due + " AV€ (delivery " + q.total + " upfront → driver). Vendor must confirm.");
  }
  function setDrop(pt) {
    drop = { lat: pt.lat, lng: pt.lng };
    if (!vendor) { say("Hunt a shop first."); return; }
    showQuote();
  }
  function showQuote() {
    if (!vendor || !drop) return;
    var q = quoteDelivery(vendor, drop, quoteOpts);
    var bits = [q.km.toFixed(2) + " km", "base " + q.base];
    if (q.night) bits.push("night +1");
    if (q.extraKm) bits.push("extra-km +" + q.extraKm);
    if (q.weather) bits.push("weather +1");
    if (q.floor) bits.push("non-ground +1");
    bits.push("all → driver · pay upfront");
    var html =
      '<p class="note"></p>' +
      '<button type="button" class="sheet-go" data-act="weather">' + (quoteOpts.rain ? "BAD WEATHER +1 ON" : "BAD WEATHER +1") + "</button>" +
      '<button type="button" class="sheet-go" data-act="floor">' + (quoteOpts.floor ? "NON-GROUND / ROOM +1 ON" : "NON-GROUND / ROOM +1") + "</button>" +
      (signed()
        ? '<button type="button" class="sheet-go primary" data-act="send">PAY DELIVERY · ' + q.total + " AV€</button>"
        : '<button type="button" class="sheet-go primary" data-act="needlogin">LOGIN TO PAY · ' + q.total + " AV€</button>");
    openSheet("QUOTE", html);
    var note = $("sn-sheet-body") && $("sn-sheet-body").querySelector(".note");
    if (note) note.textContent = bits.join(" · ") + " · client pays " + q.total + " AV€ now.";
    drawRoute(vendor, drop);
    say("Delivery " + q.total + " AV€ · pay upfront · " + vendor.name);
  }
  function drawRoute(from, to) {
    if (!map || typeof L === "undefined") return;
    if (routeLayer) try { map.removeLayer(routeLayer); } catch (e) {}
    var url = "https://router.project-osrm.org/route/v1/driving/" + from.lng + "," + from.lat + ";" + to.lng + "," + to.lat + "?overview=full&geometries=geojson";
    fetchJson(url).then(function (j) {
      var geo = j && j.routes && j.routes[0] && j.routes[0].geometry;
      var latlngs;
      if (geo && geo.coordinates) latlngs = geo.coordinates.map(function (c) { return [c[1], c[0]]; });
      else latlngs = [[from.lat, from.lng], [to.lat, to.lng]];
      routeLayer = L.polyline(latlngs, { color: "#4df0ff", weight: 4, opacity: 0.85 }).addTo(map);
      fitOfferRoute();
    });
  }
  function sendJob() {
    if (!vendor || !drop) return;
    if (!signed()) return;
    var q = quoteDelivery(vendor, drop, quoteOpts);
    /* Delivery charge paid by client upfront at order time, before delivery */
    if (avcGet() < q.total) {
      openSheet("TOP UP AV€",
        '<p class="note">Delivery ' + q.total + " AV€ due upfront. You have " + Math.round(avcGet()) + " AV€.</p>" +
        '<input id="sn-add-eur" inputmode="decimal" placeholder="Euro to top up" value="20" />' +
        '<button type="button" class="sheet-go primary" data-act="topup" data-rail="paypal">PAYPAL</button>' +
        '<button type="button" class="sheet-go" data-act="topup" data-rail="stripe">STRIPE</button>' +
        '<button type="button" class="sheet-go" data-act="topup" data-rail="revolut">REVOLUT</button>');
      return;
    }
    avcSet(avcGet() - q.total);
    var job = {
      id: "j" + Date.now().toString(36),
      vendor: vendor,
      drop: drop,
      km: q.km,
      fee: q.total,
      driverPay: q.driver,
      quote: { base: q.base, night: q.night, extraKm: q.extraKm, weather: q.weather, floor: q.floor },
      prepMin: VENDOR_PREP_MIN,
      stage: 0,
      confirms: { vendor: false, driver: false, client: false, pickup: { vendor: false, driver: false }, deliver: { driver: false, client: false } },
      paid: true,
      paidUpfront: true,
      status: "pending",
      t: Date.now()
    };
    jobs.unshift(job);
    saveJobs();
    routeOrderToLive(job);
    closeSheet();
    openJobs();
    say("Delivery " + q.total + " AV€ paid upfront · all to driver · vendor must confirm.");
    var t = authToken();
    fetch("/api/space", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: t ? "Bearer " + t : "" },
      body: JSON.stringify({ row: { id: job.id, kind: "job", lat: drop.lat, lng: drop.lng, name: vendor.name, avc: q.total } })
    }).catch(function () {});
  }
  function payJob(id) {
    var job = jobs.filter(function (j) { return j.id === id; })[0];
    if (!job) return;
    say("Opening PayPal for " + job.fee + " EUR…");
    fetch("/api/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: job.fee, origin: location.origin, reference: job.id })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var url = (j && (j.approve || j.url)) || (j.links && j.links.filter(function (l) { return l.rel === "approve"; })[0] && j.links.filter(function (l) { return l.rel === "approve"; })[0].href);
      if (!url) { say((j && (j.error || j.message)) || "PayPal did not return approve."); return; }
      try { localStorage.setItem("sn:pay-job", job.id); } catch (e) {}
      location.href = url;
    }).catch(function () { say("PayPal dark. Job still pending confirm."); });
  }
  function confirmJob(id, who) {
    var job = jobs.filter(function (j) { return j.id === id; })[0];
    if (!job) return;
    ensureHopConfirms(job);
    if (who === "vendor") return confirmHop(id, "pickup", "vendor");
    if (who === "driver") {
      if (!(job.confirms.pickup.vendor && job.confirms.pickup.driver)) return confirmHop(id, "pickup", "driver");
      return confirmHop(id, "deliver", "driver");
    }
    if (who === "client") return confirmHop(id, "deliver", "client");
  }
  function advanceStage(id) {
    var job = jobs.filter(function (j) { return j.id === id; })[0];
    if (!job) return;
    ensureHopConfirms(job);
    var ok = job.confirms.pickup.vendor && job.confirms.pickup.driver && job.confirms.deliver.driver && job.confirms.deliver.client;
    if (!ok) {
      say("Both hops need dual confirm first.");
      return;
    }
    job.stage = Math.min(STAGES.length - 1, job.stage + 1);
    saveJobs();
    openJobs();
    say(STAGES[job.stage] + " · " + ((job.vendor && job.vendor.name) || "job"));
  }
  function materialize(need) {
    var row = $("sn-filters");
    if (!row) return;
    if (need) row.classList.add("mat");
    else row.classList.remove("mat");
    layoutChrome();
  }
  function needFilter() {
    var inp = $("in") || $("q");
    if (inp && inp.value.trim()) return true;
    var tasks = $("sn-tasks"), sheet = $("sn-sheet");
    if (tasks && tasks.classList.contains("on")) return true;
    if (sheet && sheet.classList.contains("on")) return true;
    return false;
  }
  function openJobs() {
    materialize(true);
    var sh = $("sn-tasks"); if (!sh) return;
    var card = sh.querySelector(".card");
    var list = $("sn-tasks-list");
    if (card) {
      var bar = card.querySelector(".sheet-bar");
      if (!bar) {
        bar = document.createElement("div");
        bar.className = "sheet-bar";
        bar.innerHTML = '<b class="sheet-ttl">JOBS</b><button type="button" class="sheet-x" data-act="hide">HIDE</button>';
        if (list && list.parentNode === card) card.insertBefore(bar, list);
        else card.insertBefore(bar, card.firstChild);
      }
    }
    if (list) {
      if (!jobs.length) list.innerHTML = '<p class="note">One map for vendors, clients, drivers — peer talk. No separate apps. Hunt a pin, then SEND.</p>';
      else list.innerHTML = jobs.map(function (j) {
        ensureHopConfirms(j);
        var ok = j.confirms.pickup.vendor && j.confirms.pickup.driver && j.confirms.deliver.driver && j.confirms.deliver.client;
        var stages = STAGES.map(function (s, i) { return "<b class=\"" + (i <= j.stage && ok ? "on" : "") + "\">" + s + "</b>"; }).join("");
        return '<div class="pill" style="display:block">' +
          "<b>" + String(j.vendor && j.vendor.name || "job").replace(/</g, "") + "</b>" +
          "<span>" + (ok ? "VERIFIED" : "PENDING") + " · " + j.fee + " AV€ · " + (j.km || 0).toFixed(1) + " km</span>" +
          '<div class="stage">' + stages + "</div>" +
          (j.route && j.route.needsVendorConfirm && !j.route.vendorConfirmed
            ? '<button type="button" class="sheet-go primary" data-act="vendor-confirm-order" data-id="' + j.id + '">VENDOR RECEIVE · CONFIRM</button>'
            : "") +
          hopHtml(j) +
          (ok ? '<button type="button" class="sheet-go" data-act="next" data-id="' + j.id + '">NEXT STAGE</button>' : "") +
          (ok && !j.paid ? '<button type="button" class="sheet-go primary" data-act="pay" data-id="' + j.id + '">PAYPAL ' + j.fee + " €</button>" : "") +
          "</div>";
      }).join("");
    }
    sh.classList.add("on");
    paintDrawerContent();
  }
  function closeJobs() { var sh = $("sn-tasks"); if (sh) sh.classList.remove("on"); materialize(needFilter()); paintDrawerContent(); }
  function openFind() {
    materialize(true);
    var inp = $("in") || $("q");
    if (inp) { inp.focus(); say("Name a place or a shop. Ordinary language."); }
  }
  function openNode() {
    materialize(true);
    say(signed() ? "NODE · replica idle. Go live from Power after Terms." : "NODE · login required to go live.");
  }
  function openPower() { /* power is hold-to-toggle offers. no menu. */ }
  function closePower() { var sh = $("sn-power-sheet"); if (sh) sh.classList.remove("on"); }
  var lastVoice = false;
  var hist = [];
  function speakIfVoice(s) {
    if (!lastVoice) return;
    lastVoice = false;
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(s || "").slice(0, 280));
      u.lang = "en-GB";
      speechSynthesis.speak(u);
    } catch (e) {}
  }
  function applyAct(j, q) {
    var act = String((j && j.act) || "talk").toLowerCase();
    if (j && j.evolve && typeof j.evolve === "object" && window.SN && SN.evolve) SN.evolve(j.evolve);
    if (act === "locate" && $("gps")) { $("gps").click(); return; }
    if (act === "jobs") { openJobs(); return; }
    if (act === "reload") { openDeposit(); return; }
    if (act === "hunt" || act === "city" || act === "shop" || act === "now" || act === "pick") {
      if (j.places && j.places.length) {
        shops = uniqPlaces(j.places.map(function (p) {
          return { name: p.name, lat: Number(p.lat), lng: Number(p.lng), phone: p.phone || "", raw: p.raw || "", src: "grok" };
        }).filter(function (p) { return isFinite(p.lat) && isFinite(p.lng); }));
        if (shops.length) { openCity(shops[0]); paintShopsOnMap(); showHunt(); return; }
      }
      hunt(j.q || q);
      return;
    }
    if (act === "menu" && vendor) {
      vendor.menu = (j.items || []).map(function (it) { return { name: it.name, price: it.price, note: it.sample ? "sample" : "" }; });
      openVendor(vendor);
    }
  }
  function talk(raw, fromVoice) {
    var q = String(raw || "").trim();
    if (!q) return;
    lastVoice = !!fromVoice;
    hist.push({ role: "user", content: q });
    activeExchange.push({ role: "user", content: q });
    if (hist.length > 24) hist = hist.slice(-24);
    if (activeExchange.length > 24) activeExchange = activeExchange.slice(-24);
    paintDrawerContent();
    if (drawerH < Math.round(window.innerHeight * 0.36)) setDrawerHeight(Math.round(window.innerHeight * 0.42));
    say("…");
    var vendors = shops.slice(0, 8).map(function (s) { return s.name; });
    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: q,
        history: hist,
        here: {
          lat: here && here.lat,
          lng: here && here.lng,
          place: here && here.name,
          level: cityOn ? "street" : "globe",
          avc: avcGet(),
          shop: vendor && vendor.name,
          vendors: vendors
        }
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var text = (j && (j.say || j.text)) || "Grok is quiet.";
      hist.push({ role: "assistant", content: text });
      activeExchange.push({ role: "assistant", content: text });
      paintDrawerContent();
      say(text);
      speakIfVoice(text);
      applyAct(j, q);
    }).catch(function () {
      var fallback = "Grok dark. Named hunt on this phone.";
      hist.push({ role: "assistant", content: fallback });
      activeExchange.push({ role: "assistant", content: fallback });
      paintDrawerContent();
      say(fallback);
      hunt(q);
    });
  }
  function clockLine(d, utc) {
    var opt = { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false };
    if (utc) opt.timeZone = "UTC";
    try { return d.toLocaleString("en-GB", opt) + (utc ? " UTC" : ""); } catch (e) { return d.toISOString(); }
  }
  function paintIsland() {
    var d = new Date();
    var loc = $("sn-local"), utc = $("sn-utc");
    if (loc) loc.textContent = clockLine(d, false);
    if (utc) utc.textContent = clockLine(d, true);
    var node = $("sn-node");
    if (node) node.textContent = "";
    layoutChrome();
  }
  var sparkBuf = [];
  var sparkLast = 0;
  function paintMonitor(now) {
    var el = $("sn-spark");
    if (el) {
      var sctx = el.getContext("2d");
      var W = el.width || 120, H = el.height || 28;
      if (sctx) {
        if (!sparkLast || now - sparkLast >= 180) {
          sparkLast = now;
          var heap = 0;
          try {
            var mem = performance.memory;
            if (mem && mem.jsHeapSizeLimit) heap = mem.usedJSHeapSize / mem.jsHeapSizeLimit;
          } catch (e) {}
          var earth = 0.32 + 0.08 * Math.sin(earthSpin());
          var load = Math.min(1, earth + heap * 0.45 + (cityOn ? 0.08 : 0));
          var tone = load > 0.72 ? "bad" : load > 0.48 ? "warn" : "ok";
          sparkBuf.push({ v: load, tone: tone });
          if (sparkBuf.length > W) sparkBuf.shift();
        }
        sctx.clearRect(0, 0, W, H);
        if (sparkBuf.length) {
          var last = sparkBuf[sparkBuf.length - 1];
          var col = last.tone === "bad" ? "#ff5a7a" : last.tone === "warn" ? "#ffd080" : "#4df0ff";
          sctx.beginPath();
          for (var i = 0; i < sparkBuf.length; i++) {
            var x = i * (W / Math.max(1, W - 1));
            if (sparkBuf.length > 1) x = (i / (sparkBuf.length - 1)) * (W - 1);
            var y = H - 2 - sparkBuf[i].v * (H - 4);
            if (i) sctx.lineTo(x, y); else sctx.moveTo(x, y);
          }
          sctx.lineTo(W - 1, H);
          sctx.lineTo(0, H);
          sctx.closePath();
          sctx.fillStyle = last.tone === "bad" ? "rgba(255,90,122,0.28)" : last.tone === "warn" ? "rgba(255,208,128,0.28)" : "rgba(77,240,255,0.28)";
          sctx.fill();
          sctx.beginPath();
          for (i = 0; i < sparkBuf.length; i++) {
            x = sparkBuf.length > 1 ? (i / (sparkBuf.length - 1)) * (W - 1) : 0;
            y = H - 2 - sparkBuf[i].v * (H - 4);
            if (i) sctx.lineTo(x, y); else sctx.moveTo(x, y);
          }
          sctx.strokeStyle = col;
          sctx.lineWidth = 1.4;
          sctx.stroke();
        }
      }
    }
    var wx = $("sn-wx");
    if (wx && !wx.__snWx) {
      wx.__snWx = true;
      wx.textContent = isNight() ? "NIGHT" : "DAY";
    }
    if (wx && here && !wx.__snMet) {
      wx.__snMet = true;
      fetch("https://api.open-meteo.com/v1/forecast?latitude=" + here.lat + "&longitude=" + here.lng + "&current=temperature_2m")
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && j.current && isFinite(j.current.temperature_2m)) wx.textContent = Math.round(j.current.temperature_2m) + "°";
        }).catch(function () {});
    }
  }
  function layoutChrome() {
    var W = window.innerWidth, H = window.innerHeight, pad = 10;
    /* Push chrome apart: measure blockers, never stack. */
    var me = $("sn-me"), gps = $("gps");
    var lift = Math.max(70, Number(String(getComputedStyle(document.documentElement).getPropertyValue("--drawer-h")).replace("px", "")) || drawerH || 70);
    document.documentElement.style.setProperty("--drawer-h", lift + "px");
    if (me) {
      me.style.setProperty("left", "var(--safe-l)", "important");
      me.style.setProperty("right", "auto", "important");
      me.style.setProperty("top", "auto", "important");
      me.style.setProperty("bottom", "calc(var(--safe-b) + var(--drawer-h) + var(--gap, 8px))", "important");
    }
    if (gps) {
      gps.style.setProperty("right", "var(--safe-r)", "important");
      gps.style.setProperty("left", "auto", "important");
      gps.style.setProperty("top", "auto", "important");
      gps.style.setProperty("bottom", "calc(var(--safe-b) + var(--drawer-h) + var(--gap, 8px))", "important");
    }
    var radar = $("sn-radar"), money = $("sn-money"), topEl = $("top"), drawer = $("drawer");
    var powerBtn = $("sn-power"), supportBtn = $("sn-support"), burgerBtn = $("sn-burger");
    var rowGap = 8;
    if (powerBtn && burgerBtn) {
      var brr = burgerBtn.getBoundingClientRect();
      if (brr && brr.bottom) {
        powerBtn.style.setProperty("left", Math.round(brr.left) + "px", "important");
        powerBtn.style.setProperty("right", "auto", "important");
        powerBtn.style.setProperty("top", Math.round(brr.bottom + rowGap) + "px", "important");
        powerBtn.style.setProperty("bottom", "auto", "important");
      }
    }
    if (supportBtn && money) {
      var mrr = money.getBoundingClientRect();
      if (mrr && mrr.bottom) {
        supportBtn.style.setProperty("right", Math.round(window.innerWidth - mrr.right) + "px", "important");
        supportBtn.style.setProperty("left", "auto", "important");
        supportBtn.style.setProperty("top", Math.round(mrr.bottom + rowGap) + "px", "important");
        supportBtn.style.setProperty("bottom", "auto", "important");
      }
    }
    if (radar) {
      var gap = 16;
      var top = 56;
      if (topEl) {
        var tr = topEl.getBoundingClientRect();
        if (tr && tr.bottom) top = Math.round(tr.bottom + gap);
      }
      if (money) {
        var mr = money.getBoundingClientRect();
        if (mr && mr.bottom) top = Math.max(top, Math.round(mr.bottom + gap));
      }
      if (supportBtn) {
        var sr = supportBtn.getBoundingClientRect();
        if (sr && sr.bottom) top = Math.max(top, Math.round(sr.bottom + gap));
      }
      if (powerBtn) {
        var pr = powerBtn.getBoundingClientRect();
        if (pr && pr.bottom) top = Math.max(top, Math.round(pr.bottom + gap));
      }
      var rh = Math.max(40, radar.offsetHeight || 52);
      if (drawer) {
        var dr = drawer.getBoundingClientRect();
        if (dr && dr.top) {
          var maxTop = Math.round(dr.top - rh - gap);
          if (isFinite(maxTop)) top = Math.min(top, Math.max(gap, maxTop));
        }
      }
      radar.style.setProperty("top", top + "px", "important");
      radar.style.setProperty("right", "var(--safe-r)", "important");
      radar.style.setProperty("left", "auto", "important");
      radar.style.setProperty("bottom", "auto", "important");
    }
    var desk = $("sn-support-sheet");
    var sup = $("sn-support");
    if (desk && desk.classList.contains("on")) {
      var dw = Math.min(360, W - 16);
      var dx = Math.max(pad, Math.round((W - dw) / 2));
      var dy = Math.max(pad + 64, Math.round(H * 0.18));
      if (sup) {
        var br = sup.getBoundingClientRect();
        if (br && br.width) {
          dx = Math.min(W - dw - pad, Math.max(pad, br.right - dw));
          dy = Math.min(H - 120, Math.max(pad + 48, br.bottom + 8));
        }
      }
      desk.style.left = dx + "px";
      desk.style.top = dy + "px";
      desk.style.right = "auto";
      desk.style.bottom = "auto";
    }
    var skyBtn = $("sn-sky-btn");
    if (skyBtn) {
      var bw = Math.max(48, skyBtn.offsetWidth || 48);
      var bh = Math.max(64, skyBtn.offsetHeight || 64);
      var gpsR = visRect(gps);
      var x = W - bw - pad;
      var y = gpsR ? gpsR.top - bh - 10 : H - bh - pad - lift;
      y = Math.max(pad + 100, Math.min(y, H - bh - pad));
      skyBtn.style.setProperty("top", Math.round(y) + "px", "important");
      skyBtn.style.setProperty("left", Math.round(x) + "px", "important");
      skyBtn.style.setProperty("right", "auto", "important");
      skyBtn.style.setProperty("bottom", "auto", "important");
    }
    syncRadarHud();
  }
  var layoutKey = "";
  function maybeLayout() {
    var key = (intro ? "1" : "0") + ":" + window.innerWidth + "x" + window.innerHeight;
    if (key === layoutKey) return;
    layoutKey = key;
    layoutChrome();
  }
  var drawerH = 70;
  var drawerDrag = null;
  var cityRadarLayers = [];
  function maxDrawerH() { return Math.floor(window.innerHeight * (2 / 3)); }
  function setDrawerHeight(h) {
    var d = $("drawer");
    if (!d) return;
    var minH = collapsedDrawerH();
    var maxH = maxDrawerH();
    drawerH = Math.max(minH, Math.min(maxH, Math.round(h)));
    d.style.height = drawerH + "px";
    document.documentElement.style.setProperty("--drawer-h", drawerH + "px");
    d.classList.toggle("open", drawerH > minH + 8);
    layoutChrome();
    if (map && typeof map.invalidateSize === "function") {
      try { map.invalidateSize({ animate: false }); } catch (e) {}
    }
    if (routeLayer) fitOfferRoute();
  }
  function escHtml(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function loadTxns() {
    try { txns = JSON.parse(localStorage.getItem("sn:txns") || "[]") || []; } catch (e) { txns = []; }
    if (!Array.isArray(txns)) txns = [];
  }
  function saveTxnsLocal() {
    try { localStorage.setItem("sn:txns", JSON.stringify((txns || []).slice(0, 400))); } catch (e) {}
  }
  function pullTxnsRemote() {
    if (!window.SNAuth || !SNAuth.token || !SNAuth.token()) return;
    fetch("/api/transactions", {
      headers: { Authorization: "Bearer " + SNAuth.token(), Accept: "application/json" }
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok || !Array.isArray(j.items)) return;
      var byId = {};
      txns.forEach(function (t) { if (t && t.client_id) byId[t.client_id] = t; });
      j.items.forEach(function (row) {
        var id = row.client_id || row.id;
        if (!id) return;
        byId[id] = {
          client_id: id,
          kind: row.kind,
          status: row.status,
          summary: row.summary,
          amount_avc: row.amount_avc,
          exchange: row.exchange || [],
          created_at: row.created_at,
          completed_at: row.completed_at,
          retain_until: row.retain_until
        };
      });
      txns = Object.keys(byId).map(function (k) { return byId[k]; });
      txns.sort(function (a, b) { return String(b.completed_at || b.created_at || "").localeCompare(String(a.completed_at || a.created_at || "")); });
      saveTxnsLocal();
      paintDrawerContent();
    }).catch(function () {});
  }
  function persistTxnRemote(row) {
    if (!window.SNAuth || !SNAuth.token || !SNAuth.token()) return;
    fetch("/api/transactions", {
      method: "POST",
      headers: {
        Authorization: "Bearer " + SNAuth.token(),
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify(row)
    }).catch(function () {});
  }
  function archiveTransaction(job, exchange) {
    loadTxns();
    var fee = Number((job && (job.fee != null ? job.fee : job.driverPay)) || 0) || 0;
    var name = String((job && job.vendor && job.vendor.name) || (job && job.name) || "TASK").replace(/[<>]/g, "");
    var row = {
      client_id: "tx-" + String((job && job.id) || Date.now()),
      kind: "delivery",
      status: "completed",
      summary: name + " · " + Math.round(fee) + " AV€",
      amount_avc: fee,
      payload: {
        jobId: job && job.id,
        stage: job && job.stage,
        km: job && job.km,
        vendor: job && job.vendor && job.vendor.name,
        drop: job && (job.drop || job.to)
      },
      exchange: (exchange || activeExchange || []).slice(-24),
      created_at: (job && job.created_at) || new Date().toISOString(),
      completed_at: new Date().toISOString()
    };
    txns = [row].concat(txns.filter(function (t) { return t.client_id !== row.client_id; }));
    saveTxnsLocal();
    persistTxnRemote(row);
    activeExchange = [];
    /* Close current-task chrome; history remains. */
    dockTabs = dockTabs.filter(function (t) { return !(t.kind === "offer" && String(t.jobId) === String(job && job.id)); });
    offerActiveId = null;
    pendingOffer = null;
    paintDockTabs();
    paintDrawerContent();
    setDrawerHeight(collapsedDrawerH());
  }
  function currentTaskHtml() {
    var offers = dockTabs.filter(function (t) { return t.kind === "offer" && !t.min; });
    if (offers.length) return offers.map(function (t) { return t.html || ""; }).join("");
    var active = jobs.filter(function (j) { return j && j.stage < 4; }).slice(0, 1);
    if (!active.length) return '';
    return active.map(function (j) {
      var fee = isFinite(Number(j.fee)) ? Math.round(Number(j.fee)).toLocaleString("en-GB") : "—";
      var name = escHtml((j.vendor && j.vendor.name) || j.name || "JOB");
      var note = (isFinite(Number(j.km)) ? Number(j.km).toFixed(1) + " km · " : "") + (STAGES[j.stage] || "PENDING");
      return '<div class="offer-card lean-task"><div class="price">' + fee + ' <small>AV€</small></div><h3>' + name + '</h3><p class="note">' + escHtml(note) + "</p></div>";
    }).join("");
  }
  function exchangeHtml() {
    var rows = (hist || []).slice(-12);
    if (!rows.length) return '';
    return '<div class="sn-exch"><h3>COMMAND</h3>' + rows.map(function (m) {
      var role = m.role === "user" ? "YOU" : "NET";
      return '<div class="sn-exch-row ' + (m.role === "user" ? "u" : "a") + '"><b>' + role + "</b><span>" + escHtml(m.content) + "</span></div>";
    }).join("") + "</div>";
  }
  function txnsHtml() {
    loadTxns();
    if (!txns.length) return '<p class="note">No stored transactions yet.</p>';
    return '<div class="sn-txns"><h3>TRANSACTIONS</h3>' + txns.slice(0, 40).map(function (t) {
      var when = "";
      try { when = new Date(t.completed_at || t.created_at).toLocaleString("en-GB"); } catch (e) {}
      var retain = t.retain_until ? (" · keep→" + String(t.retain_until).slice(0, 10)) : " · keep≥5y";
      return '<div class="sn-txn"><b>' + escHtml(t.summary || t.client_id || "tx") + "</b><span>" + escHtml(when + retain) + "</span></div>";
    }).join("") + "</div>";
  }
  function paintDrawerContent() {
    var sheet = $("sheet");
    if (!sheet) return;
    var task = currentTaskHtml();
    var body = "";
    if (task) body += '<div class="sn-now">' + task + "</div>";
    body += exchangeHtml();
    body += txnsHtml();
    sheet.innerHTML = body || '<p class="note">Talk above · GPS lands you · drag this sheet from any edge.</p>';
  }
  function snapDrawer() {
    var minH = collapsedDrawerH();
    var maxH = maxDrawerH();
    var mid = minH + (maxH - minH) * 0.5;
    setDrawerHeight(drawerH >= mid ? maxH : minH);
  }
  function bindDrawer() {
    var d = $("drawer"), handle = $("handle"), sheet = $("sheet");
    if (!d || d.__snDrawer) return;
    d.__snDrawer = true;
    setDrawerHeight(collapsedDrawerH());
    loadTxns();
    paintDrawerContent();
    pullTxnsRemote();
    function eventY(e) {
      if (e.clientY != null) return e.clientY;
      if (e.touches && e.touches[0]) return e.touches[0].clientY;
      if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].clientY;
      return null;
    }
    function eventX(e) {
      if (e.clientX != null) return e.clientX;
      if (e.touches && e.touches[0]) return e.touches[0].clientX;
      if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].clientX;
      return null;
    }
    function zoneFor(e) {
      var r = d.getBoundingClientRect();
      var x = eventX(e);
      if (x == null) return "edge";
      var rel = (x - r.left) / Math.max(1, r.width);
      if (rel <= 0.22 || rel >= 0.78) return "edge"; /* left or right → always sheet drag */
      return "mid";
    }
    function canScrollSheet() {
      if (!sheet) return false;
      return sheet.scrollHeight > sheet.clientHeight + 4;
    }
    function atScrollExtreme(dy) {
      /* dy>0 means finger moved down → content scrolls up intent for sheet-drag retract */
      if (!sheet) return true;
      if (dy > 0) return sheet.scrollTop <= 0; /* dragging sheet down/retract only at top */
      return sheet.scrollTop + sheet.clientHeight >= sheet.scrollHeight - 1;
    }
    function onDown(e) {
      if (e.button && e.button !== 0) return;
      var y = eventY(e);
      if (y == null) return;
      var zone = zoneFor(e);
      /* Mid only: leave search/mic/buttons alone. L/R ~22% always sheet-drag (even over #q). */
      if (zone === "mid" && e.target && e.target.closest && e.target.closest("#q,#mic,input,textarea,button.sheet-go,.offer-actions,.accept,.decline,a")) return;
      var open = drawerH > collapsedDrawerH() + 8;
      var mode = "sheet";
      if (zone === "mid" && open && canScrollSheet()) {
        mode = "maybe"; /* decide on move: scroll vs sheet */
      }
      drawerDrag = { y: y, h: drawerH, moved: false, mode: mode, zone: zone, pid: e.pointerId };
      if (mode === "sheet") {
        e.preventDefault();
        try { if (e.pointerId != null) d.setPointerCapture(e.pointerId); } catch (err) {}
      }
    }
    function onMove(e) {
      if (!drawerDrag) return;
      if (drawerDrag.pid != null && e.pointerId != null && e.pointerId !== drawerDrag.pid) return;
      var y = eventY(e);
      if (y == null) return;
      var dy = drawerDrag.y - y; /* up = expand */
      if (Math.abs(dy) < 3 && !drawerDrag.moved) return;
      if (drawerDrag.mode === "maybe") {
        if (Math.abs(dy) < 6) return;
        /* Mid zone: prefer content scroll when overflowing; sheet-drag at extremes or clear vertical sheet intent from edge-like pull. */
        if (canScrollSheet() && !atScrollExtreme(dy > 0 ? 1 : -1)) {
          drawerDrag.mode = "scroll";
          return; /* let #sheet pan-y */
        }
        drawerDrag.mode = "sheet";
        try { if (drawerDrag.pid != null) d.setPointerCapture(drawerDrag.pid); } catch (err) {}
      }
      if (drawerDrag.mode === "scroll") return;
      e.preventDefault();
      drawerDrag.moved = true;
      setDrawerHeight(drawerDrag.h + dy);
    }
    function onUp(e) {
      if (!drawerDrag) return;
      if (drawerDrag.pid != null && e.pointerId != null && e.pointerId !== drawerDrag.pid) return;
      if (drawerDrag.mode === "sheet") {
        if (!drawerDrag.moved) {
          var mid = collapsedDrawerH() + (maxDrawerH() - collapsedDrawerH()) * 0.5;
          setDrawerHeight(drawerH > mid ? collapsedDrawerH() : maxDrawerH());
        } else {
          snapDrawer();
        }
      }
      drawerDrag = null;
    }
    d.addEventListener("pointerdown", onDown, { passive: false });
    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp, { passive: false });
    window.addEventListener("pointercancel", onUp, { passive: false });
    /* Handle remains a dedicated expand target. */
    if (handle && !handle.__snDrawer) {
      handle.__snDrawer = true;
      handle.addEventListener("pointerdown", function (e) {
        e.preventDefault();
        var y = eventY(e);
        drawerDrag = { y: y, h: drawerH, moved: false, mode: "sheet", zone: "edge", pid: e.pointerId };
        try { if (e.pointerId != null) handle.setPointerCapture(e.pointerId); } catch (err) {}
      }, { passive: false });
    }
  }
  function bindBurger() {
    var btn = $("sn-burger"), menu = $("menu");
    if (!btn || !menu || btn.__snBurger) return;
    btn.__snBurger = true;
    function setOpen(on) {
      if (on) menu.removeAttribute("hidden");
      else menu.setAttribute("hidden", "");
      btn.setAttribute("aria-expanded", on ? "true" : "false");
    }
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      setOpen(menu.hasAttribute("hidden"));
    });
    document.addEventListener("click", function (e) {
      if (menu.hasAttribute("hidden")) return;
      if (e.target === btn || btn.contains(e.target) || menu.contains(e.target)) return;
      setOpen(false);
    });
    var supportMenu = $("sn-support-menu");
    if (supportMenu && !supportMenu.__sn) {
      supportMenu.__sn = true;
      supportMenu.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        setOpen(false);
        openSupport();
      });
    }
    var viewBtn = $("sn-view");
    if (viewBtn && !viewBtn.__sn) {
      viewBtn.__sn = true;
      paintViewBtn();
      viewBtn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        setOpen(false);
        goCityFromGlobe();
      });
    }
  }
  function bindLogo() {
    var logo = $("logo");
    if (!logo || logo.__sn) return;
    logo.__sn = true;
    logo.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      hardReset();
    });
  }
  function bindSearchMic() {
    var form = $("search"), inp = $("q"), mic = $("mic");
    if (form && !form.__sn) {
      form.__sn = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = inp && inp.value;
        if (inp) inp.value = "";
        talk(v, false);
        materialize(needFilter());
      });
    }
    if (inp && !inp.__snMat) {
      inp.__snMat = true;
      inp.setAttribute("list", "sn-famous-list");
      inp.addEventListener("input", function () {
        materialize(needFilter());
        paintSearchSuggest(inp.value);
      });
      inp.addEventListener("focus", function () { paintSearchSuggest(inp.value || ""); });
      inp.addEventListener("blur", function () { setTimeout(function () { var box = $("sn-suggest"); if (box) box.hidden = true; }, 180); });
    }
    if (mic && !mic.__sn) {
      mic.__sn = true;
      mic.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (inp && String(inp.value || "").trim()) {
          var v = inp.value; inp.value = ""; talk(v, false); return;
        }
        if (window.SpeechRecognition || window.webkitSpeechRecognition) {
          var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
          var rec = new Rec();
          rec.lang = "en-GB";
          rec.interimResults = false;
          rec.continuous = false;
          rec.onresult = function (ev) {
            var t = ev.results[0][0].transcript;
            if (inp) inp.value = t;
            talk(t, true);
          };
          rec.onerror = function () { say("Mic closed."); };
          try { rec.start(); say("Listening…"); } catch (err) { say("Mic busy. Tap again."); }
        } else say("Type, then search. This browser has no speech engine.");
      });
    }
  }
  function syncRadarHud() {
    var hud = $("sn-radar");
    var blips = $("sn-radar-blips");
    if (!hud) return;
    var pts = [];
    if (here) pts.push({ lat: here.lat, lng: here.lng, you: true });
    (shops || []).slice(0, 12).forEach(function (s) {
      if (s && isFinite(s.lat) && isFinite(s.lng)) pts.push({ lat: s.lat, lng: s.lng });
    });
    (jobs || []).slice(0, 8).forEach(function (j) {
      var v = j && j.vendor;
      if (v && isFinite(v.lat) && isFinite(v.lng)) pts.push({ lat: v.lat, lng: v.lng, hot: true });
      else if (j && isFinite(j.lat) && isFinite(j.lng)) pts.push({ lat: j.lat, lng: j.lng, hot: true });
    });
    var hot = pts.some(function (p) { return p.hot; });
    hud.classList.toggle("hot", hot);
    if (!blips) return;
    if (!here || pts.length < 2) {
      blips.innerHTML = '<i style="left:50%;top:50%"></i>';
      return;
    }
    var R = 800;
    function km(a, b) {
      var dLat = ((b.lat - a.lat) * Math.PI) / 180, dLng = ((b.lng - a.lng) * Math.PI) / 180;
      var s1 = Math.sin(dLat / 2), s2 = Math.sin(dLng / 2);
      var h = s1 * s1 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * s2 * s2;
      return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
    }
    var html = "";
    pts.forEach(function (p) {
      if (p.you) { html += '<i style="left:50%;top:50%;background:#fff;box-shadow:0 0 8px #fff"></i>'; return; }
      var d = km(here, p);
      if (d > R / 1000) return;
      var ang = Math.atan2(p.lng - here.lng, p.lat - here.lat);
      var rad = Math.min(0.42, d / (R / 1000) * 0.42);
      var x = 50 + Math.sin(ang) * rad * 100;
      var y = 50 - Math.cos(ang) * rad * 100;
      html += '<i style="left:' + x.toFixed(1) + "%;top:" + y.toFixed(1) + '%"></i>';
    });
    blips.innerHTML = html || '<i style="left:50%;top:50%"></i>';
  }
  function clearCityRadar() {
    if (!map) { cityRadarLayers = []; return; }
    cityRadarLayers.forEach(function (l) { try { map.removeLayer(l); } catch (e) {} });
    cityRadarLayers = [];
  }
  function paintCityRadar() {
    var el = $("city");
    if (!el || !el.classList.contains("on") || !map || typeof L === "undefined" || !here) {
      clearCityRadar();
      return;
    }
    clearCityRadar();
    var RADAR_M = 800;
    var ring = L.circle([here.lat, here.lng], {
      radius: RADAR_M, color: "#4df0ff", weight: 1, fillColor: "#4df0ff", fillOpacity: 0.08, opacity: 0.45, interactive: false
    }).addTo(map);
    cityRadarLayers.push(ring);
    var px = 72;
    try {
      px = Math.max(64, Math.round(map.latLngToLayerPoint([here.lat, here.lng]).distanceTo(map.latLngToLayerPoint([here.lat + RADAR_M / 111320, here.lng])) * 2));
    } catch (e) {}
    var mark = L.marker([here.lat, here.lng], {
      interactive: false, keyboard: false, zIndexOffset: -400,
      icon: L.divIcon({
        className: "sn-radar-wrap",
        html: '<div class="sn-radar" style="width:' + px + "px;height:" + px + 'px"></div>',
        iconSize: [px, px],
        iconAnchor: [px / 2, px / 2]
      })
    }).addTo(map);
    cityRadarLayers.push(mark);
    syncRadarHud();
  }

  function bindChrome() {
    bindGps();
    bindLogo();
    bindBurger();
    bindSearchMic();
    bindDrawer();
    syncRadarHud();
    var power = $("sn-power");
    if (power && !power.__sn) {
      power.__sn = true; power.hidden = false;
      var holdP = 0, holdFrom = 0, holdArmed = false;
      function offersOn() {
        try { return localStorage.getItem("sn:offers") === "1"; } catch (e) { return false; }
      }
      function paintPowerState(on) {
        power.classList.toggle("on", !!on);
        power.classList.toggle("off", !on);
        power.setAttribute("aria-pressed", on ? "true" : "false");
        power.setAttribute("aria-label", on ? "Power on" : "Power off");
        power.title = on ? "Hold 3s to disarm offer receive" : "Hold 3s to arm offer receive";
        power.textContent = "\u23FB";
      }
      function setOffers(on) {
        try { localStorage.setItem("sn:offers", on ? "1" : "0"); } catch (e) {}
        paintPowerState(on);
        clearOfferCountdown();
        if (powerCdTimer) { clearInterval(powerCdTimer); powerCdTimer = null; }
        setCd(0, false);
        if (on) {
          say("Offer receive ON.");
          materialize(true);
          if (jobs.length) {
            throwOffer(jobs[0]);
          } else {
            throwOffer({ id: "live", name: "LIVE OFFER", fee: 24, note: "Offers armed · Decline left · Accept right." });
          }
        } else {
          say("Offer receive OFF.");
          offerActiveId = null;
          dockTabs = dockTabs.filter(function (t) { return t.kind !== "offer"; });
          paintDockTabs();
          paintDrawerContent();
          closeJobs();
          closeSheet();
          clearDriverMark();
          materialize(false);
          setDrawerHeight(collapsedDrawerH());
        }
      }
      paintPowerState(offersOn());
      power.addEventListener("pointerdown", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (holdP) clearInterval(holdP);
        if (powerCdTimer) { clearInterval(powerCdTimer); powerCdTimer = null; }
        holdFrom = Date.now();
        holdArmed = false;
        var n = 3;
        setCd(n, true);
        holdP = setInterval(function () {
          n -= 1;
          if (n > 0) { setCd(n, true); return; }
          clearInterval(holdP); holdP = 0;
          holdArmed = true;
          setCd(0, false);
          setOffers(!offersOn());
        }, 1000);
      });
      function cancelHold() {
        if (!holdP) return;
        clearInterval(holdP); holdP = 0;
        if (offerCdTimer && offerCdLeft > 0) setCd(offerCdLeft, true);
        else setCd(0, false);
        /* single click / short hold = no-op */
      }
      power.addEventListener("pointerup", cancelHold);
      power.addEventListener("pointercancel", cancelHold);
      power.addEventListener("pointerleave", cancelHold);
      power.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); });
    }
    var money = $("sn-money");
    if (money && !money.__sn) {
      money.__sn = true; money.hidden = false;
      money.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (!signed()) {
          openSheet("AV€", '<p class="note">Your coins after LOGIN. Pool is owner only.</p><button type="button" class="sheet-go primary" data-act="needlogin">LOGIN</button>');
          return;
        }
        var html = '<p class="note">' + Math.round(avcGet()).toLocaleString("en-GB") + " AV€ on this account. All txs in AV€. Fee 3% forever — only fee. New signups get 300 AV€ test credit.</p>";
        if (ownerMail()) html += '<p class="note">Pool ' + Math.round(poolGet()).toLocaleString("en-GB") + " AV€ · owner only.</p>";
        html += '<input id="sn-add-eur" inputmode="decimal" placeholder="Euro to top up → AV€" />' +
          '<button type="button" class="sheet-go primary" data-act="topup" data-rail="paypal">TOP UP · PAYPAL</button>' +
          '<button type="button" class="sheet-go" data-act="topup" data-rail="stripe">TOP UP · STRIPE</button>' +
          '<button type="button" class="sheet-go" data-act="topup" data-rail="revolut">TOP UP · REVOLUT</button>' +
          '<button type="button" class="sheet-go" data-act="withdraw">WITHDRAW</button>';
        openSheet("AV€", html);
      });
    }
    paintMoney();
    var plus = $("plus"), file = $("sn-file");
    if (plus && file && !plus.__sn) {
      plus.__sn = true;
      plus.addEventListener("click", function (e) { e.preventDefault(); file.click(); });
      file.addEventListener("change", function () {
        var f = file.files && file.files[0];
        if (f) say("Got " + f.name + " · Grok reads after LOGIN.");
      });
    }
    layoutChrome();
    window.addEventListener("resize", layoutChrome);
    if (window.visualViewport) visualViewport.addEventListener("resize", layoutChrome);
    var aBtn = $("sn-brand-a"), sBtn = $("sn-brand-s"), spark = $("sn-spark");
    if (aBtn && !aBtn.__sn) {
      aBtn.__sn = true;
      aBtn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openCompany(); });
    }
    if (sBtn && !sBtn.__sn) {
      sBtn.__sn = true;
      sBtn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); hardReset(); });
    }
    if (spark && !spark.__sn) {
      spark.__sn = true;
      spark.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openFleet(); });
    }
    var support = $("sn-support");
    if (support && !support.__sn) {
      support.__sn = true;
      support.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openSupport(); });
    }
    var tabsRail = $("sn-tabs");
    if (tabsRail && !tabsRail.__sn) {
      tabsRail.__sn = true;
      tabsRail.addEventListener("click", function (e) {
        var fill = e.target.closest("[data-fill]");
        if (fill) { e.preventDefault(); e.stopPropagation(); minTab(fill.getAttribute("data-fill")); return; }
        var tab = e.target.closest("[data-tab]");
        if (tab) { e.preventDefault(); focusTab(tab.getAttribute("data-tab")); }
      });
    }
    var f = $("f"), inp = $("in"), go = $("go");
    if (f && !f.__sn) {
      f.__sn = true;
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var v = inp && inp.value;
        if (inp) inp.value = "";
        if (typeof paintGo === "function") paintGo();
        talk(v, false);
        materialize(needFilter());
      });
    }
    if (inp) inp.addEventListener("input", function () { materialize(needFilter()); });
    function paintGo() {
      if (!go) return;
      var has = inp && String(inp.value || "").trim();
      go.textContent = has ? "GO" : "MIC";
      go.setAttribute("aria-label", has ? "Send" : "Talk");
    }
    paintGo();
    if (inp && !inp.__snGoPaint) {
      inp.__snGoPaint = true;
      inp.addEventListener("input", paintGo);
    }
    if (go && !go.__sn) {
      go.__sn = true;
      go.addEventListener("click", function (e) {
        e.preventDefault();
        if (inp && String(inp.value || "").trim()) {
          var v = inp.value; inp.value = ""; paintGo(); talk(v, false); return;
        }
        if (window.SpeechRecognition || window.webkitSpeechRecognition) {
          var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
          var rec = new Rec();
          rec.lang = "en-GB";
          rec.interimResults = false;
          rec.continuous = false;
          rec.onresult = function (ev) {
            var t = ev.results[0][0].transcript;
            if (inp) inp.value = t;
            paintGo();
            talk(t, true);
          };
          rec.onerror = function () { say("Mic closed."); };
          try { rec.start(); say("Listening…"); } catch (err) { say("Mic busy. Tap again."); }
        } else say("Type, then GO. This browser has no speech engine.");
      });
    }
    var jobsBtn = $("sn-tasks-btn"), findBtn = $("sn-find-btn"), nodeBtn = $("sn-node-btn");
    if (jobsBtn) jobsBtn.addEventListener("click", openJobs);
    if (findBtn) findBtn.addEventListener("click", openFind);
    if (nodeBtn) nodeBtn.addEventListener("click", openNode);
    if (!window.__snEscSheets) {
      window.__snEscSheets = true;
      window.addEventListener("keydown", function (e) {
        var key = e.key || e.code;
        if (key !== "Escape" && key !== "Esc" && e.keyCode !== 27) return;
        var tasks = $("sn-tasks"), sheet = $("sn-sheet"), me = $("sn-me-sheet");
        if (tasks && tasks.classList.contains("on")) { e.preventDefault(); closeJobs(); return; }
        if (sheet && sheet.classList.contains("on")) { e.preventDefault(); closeSheet(); return; }
        if (me && me.classList.contains("on")) { e.preventDefault(); me.classList.remove("on"); return; }
      }, true);
    }
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[data-act]") : e.target;
      var act = t && t.getAttribute && t.getAttribute("data-act");
      if (!act) return;
      var id = t.getAttribute("data-id");
      var i = Number(t.getAttribute("data-i"));
      if (act === "hide") { closeJobs(); setDrawerHeight(collapsedDrawerH()); paintDrawerContent(); }
      if (act === "open-architect") { openArchitectAt(listPt); }
      if (act === "vendor-confirm-order") { vendorConfirmOrder(id); }
      if (act === "order-talk") { openOrderTalk(id); }
      if (act === "order-arrived") { driverArrived(id); }
      if (act === "order-at-drop") { driverAtDrop(id); }
      if (act === "order-ready") { vendorReady(id); }
      if (act === "order-wait-2") { orderWait2(id); }
      if (act === "order-wait-yes") { orderWaitYes(id); }
      if (act === "order-wait-no") { orderWaitNo(id); }
      if (act === "order-pickup") { orderPickup(id); }
      if (act === "order-client-ok") { clientReceived(id); }
      if (act === "order-cancel") { orderCancelKeepPay(id, "Client/peer cancel"); }
      if (act === "order-send") { sendOrderMsg(id); }
      if (act === "insert-actor") { insertActor(t.getAttribute("data-role")); }
      if (act === "save-actor") { saveActor(t.getAttribute("data-role")); }
      if (act === "retry-verify") {
        var rn = t.getAttribute("data-role");
        var nm2 = t.getAttribute("data-name") || "";
        var gbp2 = $("sn-actor-gbp");
        if ($("sn-actor-name")) {} else {
          /* recreate name field value via attribute */
        }
        openSheet("NAME · " + (rn === "delivery_services" ? "DELIVERY SERVICES" : String(rn || "").toUpperCase()),
          '<input id="sn-actor-name" class="field" value="' + String(nm2).replace(/"/g, "") + '" />' +
          (rn === "vendor" || rn === "delivery_services" ? '<input id="sn-actor-gbp" class="field" placeholder="Google Business Profile URL" value="' + String(gbp2 && gbp2.value || "").replace(/"/g, "") + '" />' : "") +
          '<button type="button" class="sheet-go primary" data-act="save-actor" data-role="' + rn + '">SAVE · VERIFY</button>');
      }
      if (act === "start-tx") { startTransaction(findActor(id)); }
      if (act === "peer-msg") { openPeerMessage(findActor(id) || peerThread); }
      if (act === "peer-send") { sendPeerMessage(id); }
      if (act === "drv-walk") {
        if (!vendor) vendor = FAMOUS_VENDORS[0];
        if (here) setDrop(here);
        else locate(function (pt) { land(pt, false); setDrop(pt); });
      }
      if (act === "suggest") {
        var box = $("sn-suggest");
        var rows = box && box.__rows;
        var si = Number(t.getAttribute("data-i"));
        if (rows && rows[si]) {
          var sug = rows[si];
          if ($("q")) $("q").value = sug.name;
          if (box) box.hidden = true;
          hunt(sug.name);
        }
      }
      if (act === "support-peer-hint") {
        setSupport(false);
        openSheet("PEER MESSAGING",
          '<p class="note">Tap a vendor, delivery driver, or client pin on the map → MESSAGE. That is the only channel for peer / order issues. AI Support is Cursor for product bugs only.</p>' +
          '<button type="button" class="sheet-go primary" data-act="close">GOT IT</button>');
      }
      if (act === "decline") { declineOffer(id || offerActiveId); }
      if (act === "accept") { acceptOffer(id || offerActiveId); }
      if (act === "hop") {
        var hop = t.getAttribute("data-hop");
        var who = t.getAttribute("data-who");
        confirmHop(id, hop, who);
      }
      if (act === "close") { closePower(); closeSheet(); closeJobs(); }
      if (act === "reload") location.reload();
      if (act === "terms") location.href = "/terms.html";
      if (act === "apply-vendor" || act === "apply-driver") say("Apply after LOGIN. Notis activates.");
      if (act === "withdraw") say("Withdraw after a real job. PayPal on origin.");
      if (act === "vendor" && isFinite(i) && shops[i]) openVendor(shops[i]);
      if (act === "gpsdrop") {
        if (here) setDrop(here);
        else locate(function (pt) { land(pt, false); setDrop(pt); });
      }
      if (act === "pindrop") { closeSheet(); say("Long tap the map to pin the drop."); }
      if (act === "weather") { quoteOpts.rain = !quoteOpts.rain; showQuote(); }
      if (act === "floor") { quoteOpts.floor = !quoteOpts.floor; showQuote(); }
      if (act === "send") sendJob();
      if (act === "needlogin") { if (window.SNAuth && SNAuth.google) SNAuth.google(); else say("LOGIN to order."); }
      if (act === "add-eur") {
        var eurEl2 = $("sn-add-eur");
        var n2 = Number(String(eurEl2 && eurEl2.value || "").replace(",", ".").trim());
        topUp("paypal", n2);
      }
      if (act === "assign-drv") {
        if (!signed()) { say("LOGIN to assign a driver."); return; }
        if (!vendor) { say("Open a shop first."); return; }
        openSheet("DRIVER",
          '<p class="note">Notis is the live approved driver. Others after papers + contract.</p>' +
          '<button type="button" class="sheet-go primary" data-act="drv-notis">ASSIGN NOTIS</button>');
      }
      if (act === "drv-notis") {
        say("Assigned to drv-notis · " + ((vendor && vendor.name) || "shop") + ". Set drop, then send.");
      }
      if (act === "add-item" || act === "qty-plus") {
        var ix = Number(t.getAttribute("data-i"));
        if (!isFinite(ix)) return;
        cart.items[ix] = cartQty(ix) + 1;
        if (t.getAttribute("data-order")) openOrderScreen(); else renderVendorShop();
      }
      if (act === "qty-minus") {
        var iy = Number(t.getAttribute("data-i"));
        if (!isFinite(iy)) return;
        cart.items[iy] = Math.max(0, cartQty(iy) - 1);
        if (t.getAttribute("data-order")) openOrderScreen(); else renderVendorShop();
      }
      if (act === "open-order") openOrderScreen();
      if (act === "back-vendor") renderVendorShop();
      if (act === "pay-avc") payCartAvc();
      if (act === "topup") {
        var eurEl = $("sn-add-eur");
        var n = Number(String(eurEl && eurEl.value || "20").replace(",", ".").trim());
        topUp(t.getAttribute("data-rail") || "paypal", n);
      }
      if (act === "peer-video") {
        var vid = findActor(id) || peerThread || vendor;
        if (!vid) { say("No peer."); return; }
        openSheet("VIDEO · " + String(vid.name || "peer").slice(0, 20).toUpperCase(),
          '<p class="note">Peer video call (WebRTC lean stub). Real media uses browser permissions. Messaging stays the support channel for peer issues.</p>' +
          '<button type="button" class="sheet-go primary" data-act="peer-video-start" data-id="' + (vid.id || id || "") + '">START VIDEO</button>' +
          '<button type="button" class="sheet-go" data-act="peer-msg" data-id="' + (vid.id || id || "") + '">MESSAGE INSTEAD</button>');
      }
      if (act === "peer-video-start") {
        say("Video call requested · peer notified on-device.");
        try {
          var box = JSON.parse(localStorage.getItem("sn:peer-msg") || "[]") || [];
          box.unshift({ id: "v" + Date.now().toString(36), to: id, text: "[VIDEO CALL]", kind: "video", t: Date.now() });
          localStorage.setItem("sn:peer-msg", JSON.stringify(box.slice(0, 200)));
        } catch (e) {}
      }
      if (act === "list-kinds") {
        openSheet("PLACE",
          '<button type="button" class="sheet-go" data-act="kind" data-k="shop">Shop</button>' +
          '<button type="button" class="sheet-go" data-act="kind" data-k="villa">Villa</button>' +
          '<button type="button" class="sheet-go" data-act="kind" data-k="hotel">Hotel</button>' +
          '<button type="button" class="sheet-go" data-act="kind" data-k="car">Rent a car</button>');
      }
      if (act === "kind") {
        var k = t.getAttribute("data-k") || "shop";
        openSheet(k.toUpperCase(),
          '<input id="sn-place-name" placeholder="Shop name" />' +
          '<input id="sn-place-phone" placeholder="Phone (optional)" />' +
          '<textarea id="sn-place-menu" placeholder="One product per line: Name | price | note"></textarea>' +
          '<button type="button" class="sheet-go" data-act="pick-photo">PHOTO</button>' +
          '<button type="button" class="sheet-go primary" data-act="save-place" data-k="' + k + '">LIST</button>');
      }
      if (act === "pick-photo") {
        var file = $("sn-file");
        if (file) file.click();
      }
      if (act === "save-place") {
        var kn = t.getAttribute("data-k") || "shop";
        var nmEl = $("sn-place-name");
        var phEl = $("sn-place-phone");
        var muEl = $("sn-place-menu");
        var nm = nmEl ? String(nmEl.value || "").trim() : "";
        var phone = phEl ? String(phEl.value || "").trim() : "";
        var rawMenu = muEl ? String(muEl.value || "") : "";
        var menu = rawMenu.split(/\n+/).map(function (line) {
          var p = line.split("|").map(function (x) { return x.trim(); });
          if (!p[0]) return null;
          return { name: p[0], price: p[1] || "", note: p[2] || "" };
        }).filter(Boolean);
        if (!nm) { say("Name the place."); return; }
        if (!listPt) { say("Hold the street first."); return; }
        persistListing({ id: "p" + Date.now().toString(36), kind: "shop", place: kn, name: nm, phone: phone, menu: menu, lat: listPt.lat, lng: listPt.lng });
        shops.unshift({ name: nm, lat: listPt.lat, lng: listPt.lng, kind: kn, phone: phone, menu: menu, src: "listed" });
        shops = uniqPlaces(shops);
        paintShopsOnMap();
        closeSheet();
        say(nm + " listed · " + menu.length + " product" + (menu.length === 1 ? "" : "s") + ".");
      }
      if (act === "list-drop") {
        if (!listPt) { say("Hold the street first."); return; }
        persistListing({ id: "d" + Date.now().toString(36), kind: "drop", name: "drop", lat: listPt.lat, lng: listPt.lng });
        drop = { lat: listPt.lat, lng: listPt.lng };
        closeSheet();
        say("Delivery location listed.");
      }
      if (act === "list-base") {
        if (!listPt) { say("Hold the street first."); return; }
        persistListing({ id: "b" + Date.now().toString(36), kind: "driver", name: "base", lat: listPt.lat, lng: listPt.lng });
        closeSheet();
        say("Driver base listed.");
      }
      if (act === "list-post") {
        var titleEl = $("sn-post-name");
        var title = titleEl ? String(titleEl.value || "").trim() : "";
        if (!title) { say("Name the post."); return; }
        if (!listPt) { say("Hold first."); return; }
        persistListing({ id: "g" + Date.now().toString(36), kind: "post", name: title, lat: listPt.lat, lng: listPt.lng, place: listAlt });
        closeSheet();
      }
      if (act === "support-send") { var ta = $("sn-support-matter"); sendSupport(ta && ta.value, false); }
      if (act === "support-mic") listenSupport();
      if (act === "support-close") setSupport(false);
      if (act === "cv") confirmJob(id, "vendor");
      if (act === "cd") confirmJob(id, "driver");
      if (act === "cc") confirmJob(id, "client");
      if (act === "next") advanceStage(id);
      if (act === "pay") payJob(id);
    });
    paintIsland();
    setInterval(paintIsland, 1000);
  }
  function openDeposit() {
    var money = $("sn-money");
    if (money) money.click();
  }
  function addFunds(eur) { topUp("paypal", eur); }
  function evolve(patch) {
    if (!patch || typeof patch !== "object") return;
    var keys = ["huntCap", "voice", "tip", "vip", "floor"];
    keys.forEach(function (k) {
      if (patch[k] == null) return;
      try { localStorage.setItem("sn:rule:" + k, String(patch[k])); } catch (e) {}
    });
    say("Rules updated.");
  }
  /* Sky applet removed from lean stamp chrome (no #sn-sky* nodes). Stubs keep call sites safe. */
  var SKY = [];
  function closeSky() { skyOn = false; }
  function openSky() { skyOn = false; }
  function drawSky() {}
  function bindSky() {}

  function boot() {
    loadLand();
    canvas = $("g");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    seedStars();
    cam.yaw = (20 * Math.PI) / 180 - earthSpin();
    cam.pitch = 0.22;
    cam.dist = 1.85;
    bindGlobe();
    loadVerify();
    shops = uniqPlaces((shops || []).concat(FAMOUS_VENDORS));
    bindChrome();
    loadTxns();
    pullTxnsRemote();
    paintMoney();
    setInterval(paintMoney, 4000);
    paintViewBtn();
    if (signed()) grantSignupCredit();
    bindSky();
    loadJobs();
    var pay = new URLSearchParams(location.search).get("paypal");
    if (pay === "success") {
      var jid = "";
      try { jid = localStorage.getItem("sn:pay-job") || ""; } catch (e) {}
      var tokenQs = new URLSearchParams(location.search).get("token");
      fetch("/api/paypal/capture-order", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: tokenQs, orderID: tokenQs }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j && (j.ok || j.status === "COMPLETED" || j.capture)) {
            jobs.forEach(function (job) { if (job.id === jid) job.paid = true; });
            saveJobs();
            var dep = 0;
            try { dep = Number(localStorage.getItem("sn:pay-deposit") || 0); localStorage.removeItem("sn:pay-deposit"); } catch (e) {}
            if (dep > 0 && signed()) {
              avcSet(avcGet() + dep);
              say("PayPal " + dep + " € on your account · " + avcGet() + " AV€.");
            } else say("PayPal captured. Transaction verified.");
          } else say((j && (j.error || j.message)) || "PayPal capture did not finish.");
        }).catch(function () { say("PayPal capture dark."); });
      history.replaceState({}, "", location.pathname);
    }
    if (navigator.serviceWorker) {
      try { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {}); } catch (e) {}
    }
    window.__SN_4444 = true;
    window.SN = {
      talk: talk, say: say, cam: cam,
      getMap: function () { return map; },
      openCity: openCity, closeCity: closeCity, listAt: listAt,
      goNamed: hunt, huntNamed: hunt, hunt: hunt,
      user: function () { return window.SNAuth && SNAuth.user ? SNAuth.user() : null; },
      paintMoney: paintMoney, evolve: evolve, addFunds: addFunds, avcGet: avcGet,
      visibleShops: function () { return shops; },
      jobs: function () { return jobs; },
      quoteDelivery: quoteDelivery,
      asPartnerOrder: asPartnerOrder,
      syncOrderStatus: syncOrderStatus,
      paintPower: function () { var p = $("sn-power"); if (p) p.hidden = false; },
      projectTest: function (lat, lng) { return project(lat, lng, cam); },
      throwOffer: throwOffer, fitOfferRoute: fitOfferRoute, openOfferDrawer: openOfferDrawer,
      txns: function () { return txns.slice(); },
      archiveTransaction: archiveTransaction,
      paintDrawerContent: paintDrawerContent,
      nudgeZoom: nudgeZoom,
      drawRoute: drawRoute, architectUrl: architectUrl, openArchitectAt: openArchitectAt,
      goCityFromGlobe: goCityFromGlobe, startTransaction: startTransaction, openPeerMessage: openPeerMessage
    };
    Object.defineProperty(window, "__SN_INTRO", { get: function () { return intro; } });
    requestAnimationFrame(loop);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
