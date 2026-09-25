/* SpaceNet 4274 — money under island. Support line not eaten by ticker. */
(function () {
  "use strict";
  var VER = "4274";
  var INTRO_MS = 13000;
  var LAND = [
    [[37, -6], [37, 11], [32, 25], [31, 34], [22, 37], [12, 51], [0, 42], [-5, 39], [-15, 40], [-25, 35], [-34, 25], [-34, 18], [-28, 16], [-22, 14], [-17, 11], [5, 9], [4, -8], [12, -16], [16, -16], [21, -17], [28, -13], [36, -6], [37, -6]],
    [[36, -9], [43, -9], [51, -10], [58, -6], [71, 25], [70, 30], [60, 30], [54, 20], [45, 29], [41, 29], [40, 19], [38, 15], [36, 15], [36, -5], [36, -9]],
    [[12, 44], [26, 56], [36, 44], [42, 44], [55, 60], [70, 70], [72, 140], [62, 160], [50, 140], [35, 140], [22, 120], [8, 105], [1, 104], [8, 77], [25, 68], [12, 44]],
    [[-11, 142], [-12, 136], [-16, 123], [-22, 114], [-35, 115], [-35, 138], [-38, 148], [-28, 153], [-11, 142]],
    [[72, -95], [70, -168], [60, -165], [48, -125], [32, -117], [23, -110], [15, -95], [25, -80], [45, -65], [60, -65], [72, -85], [72, -95]],
    [[12, -72], [10, -62], [5, -52], [-5, -35], [-23, -42], [-34, -53], [-52, -68], [-18, -70], [-5, -80], [8, -78], [12, -72]],
    [[83, -32], [72, -56], [60, -44], [70, -22], [83, -32]]
  ];
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
  var listingTried = false;
  var vendor = null;
  var drop = null;
  var jobs = [];
  var shopMarks = [];
  var routeLayer = null;
  var quoteOpts = { vip: false, floor: false, tip: 0 };
  var STAGES = ["ACCEPT", "VENDOR HANDED OFF", "DRIVER GOT IT", "DRIVER DELIVERED", "I RECEIVED"];
  var view = { cx: 0, cy: 0, scale: 120, w: 1, h: 1 };
  var SIDEREAL_DAY_S = 86164.0905;
  var SIDEREAL_OMEGA = (Math.PI * 2) / SIDEREAL_DAY_S;
  var listPt = null;
  var listAlt = "street";
  function earthSpin() { return (Date.now() / 1000) * SIDEREAL_OMEGA; }
  function solarLngDeg() {
    var s = ((Date.now() / 1000) % 86400) / 86400;
    return 180 - s * 360;
  }
  function altitudeFromDist(d) {
    if (cityOn && map) {
      try { if (map.getZoom() >= 15) return "street"; } catch (e) {}
    }
    if (d <= 1.12) return "street";
    if (d <= 1.55) return "island";
    if (d <= 1.95) return "national";
    return "space";
  }

  function $(id) { return document.getElementById(id); }
  var sayHold = 0;
  function say(s) { var el = $("line"); if (el) el.textContent = s; sayHold = Date.now(); }
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
    var tgt = btn.querySelector(".tgt");
    var lbl = btn.querySelector(".lbl");
    if (lbl) lbl.textContent = "AV€";
    if (!signed()) {
      if (tgt) tgt.textContent = "AV€";
      return;
    }
    var n = Math.round(avcGet());
    if (tgt) tgt.textContent = n.toLocaleString("en-GB") + " AV€";
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
    var scale = Math.max(140, Math.min((bot - top) * 0.48, w * 0.48));
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
  function drawPath(ctx, ring, c) {
    var first = true;
    for (var i = 0; i < ring.length; i++) {
      var p = project(ring[i][0], ring[i][1], c);
      if (!p) { first = true; continue; }
      if (first) { ctx.moveTo(p.x, p.y); first = false; }
      else ctx.lineTo(p.x, p.y);
    }
  }
  function drawGlobe(now) {
    if (!canvas || !ctx) return;
    fitView();
    var dpr = Math.min(2, window.devicePixelRatio || 1);
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
    ctx.strokeStyle = "rgba(120,190,210,0.12)"; ctx.lineWidth = 0.6;
    for (lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath(); first = true;
      for (lng = -180; lng <= 180; lng += 6) {
        p = project(lat, lng, cam);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (lng = -180; lng < 180; lng += 30) {
      ctx.beginPath(); first = true;
      for (lat = -80; lat <= 80; lat += 4) {
        p = project(lat, lng, cam);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(62, 118, 84, 0.78)";
    ctx.strokeStyle = "rgba(170, 210, 175, 0.45)";
    ctx.lineWidth = 1;
    for (i = 0; i < LAND.length; i++) {
      ctx.beginPath(); drawPath(ctx, LAND[i], cam); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    var night = ctx.createLinearGradient(cx - r, cy, cx + r * 0.35, cy);
    night.addColorStop(0, "rgba(2,6,12,0.55)");
    night.addColorStop(0.55, "rgba(2,6,12,0.08)");
    night.addColorStop(1, "rgba(2,6,12,0)");
    ctx.fillStyle = night;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    var sweepLng = solarLngDeg();
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
    ctx.fillStyle = "rgba(210, 230, 215, 0.7)";
    ctx.font = "600 11px system-ui,sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (i = 0; i < LABELS.length; i++) {
      p = project(LABELS[i].lat, LABELS[i].lng, cam);
      if (!p || p.z < 0.28) continue;
      ctx.fillText(LABELS[i].name, p.x, p.y);
    }
  }
  function stepCam(now, dt) {
    if (fly) {
      var k = Math.min(1, (now - fly.t0) / fly.ms);
      var e = 1 - Math.pow(1 - k, 3);
      cam.yaw = fly.start.yaw + (fly.goal.yaw - fly.start.yaw) * e;
      cam.pitch = fly.start.pitch + (fly.goal.pitch - fly.start.pitch) * e;
      cam.dist = fly.start.dist + (fly.goal.dist - fly.start.dist) * e;
      if (k >= 1) fly = null;
      return;
    }
    if (intro) {
      if (cam.dist < 1.7 || cam.dist > 2.05) cam.dist = 1.85;
      return;
    }
    if (!drag && (Math.abs(vel.yaw) > 0.00012 || Math.abs(vel.pitch) > 0.00012)) {
      cam.yaw += vel.yaw;
      cam.pitch = Math.max(-1.15, Math.min(1.15, cam.pitch + vel.pitch));
      vel.yaw *= 0.88; vel.pitch *= 0.88;
    } else if (!drag) { vel.yaw = 0; vel.pitch = 0; }
  }
  function tickNews(now) {
    if (!intro || supportOn || (Date.now() - sayHold < 12000)) return;
    var i = Math.floor(now / 1850) % NEWS.length;
    if (i !== newsI) { newsI = i; say(NEWS[i] + " · then we zoom to you"); }
  }
  function loop(now) {
    var dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    if (!introT0) introT0 = now;
    if (intro && now - introT0 >= INTRO_MS) endIntro();
    stepCam(now, dt);
    tickNews(now);
    if (!cityOn) drawGlobe(now);
    paintMonitor(now);
    maybeLayout();
    requestAnimationFrame(loop);
  }
  function nowMs() { return Date.now(); }
  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
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
        var ratio = pinch / d;
        pinch = d;
        cam.dist = Math.max(1.05, Math.min(2.4, cam.dist * ratio));
        gateStreet();
        return;
      }
      if (!drag) return;
      var dx = p.x - drag.x, dy = p.y - drag.y;
      if (Math.hypot(dx, dy) > 8) {
        drag.moved = true; intro = false;
        if (holdT) { clearTimeout(holdT); holdT = 0; }
      }
      if (!drag.moved) return;
      var t = nowMs();
      var dt = Math.max(8, t - drag.lastT);
      vel.yaw = (-(p.x - drag.lastX) * 0.005) * (16 / dt);
      vel.pitch = ((p.y - drag.lastY) * 0.004) * (16 / dt);
      drag.lastX = p.x; drag.lastY = p.y; drag.lastT = t;
      cam.yaw = drag.yaw - dx * 0.005;
      cam.pitch = Math.max(-1.15, Math.min(1.15, drag.pitch + dy * 0.004));
    });
    function up(e) {
      pointers.delete(e.pointerId);
      if (pointers.size < 2) pinch = null;
      if (holdT) { clearTimeout(holdT); holdT = 0; }
      var d = drag; drag = null;
      if (!d || d.moved) return;
      vel.yaw = 0; vel.pitch = 0;
    }
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault(); intro = false;
      cam.dist = Math.max(1.05, Math.min(2.4, cam.dist + e.deltaY * 0.002));
      gateStreet();
    }, { passive: false });
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
    say("Locating… tap GPS again to recalibrate.");
    navigator.geolocation.getCurrentPosition(
      function (pos) { then({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      function () {
        navigator.geolocation.getCurrentPosition(
          function (p) { then({ lat: p.coords.latitude, lng: p.coords.longitude }); },
          function () { say("GPS denied. Long tap the globe to pin YOU. Tap GPS again to retry."); },
          { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
    );
  }
  function land(pt, open) {
    intro = false;
    here = { lat: pt.lat, lng: pt.lng };
    window.__SN_HERE = here;
    try { localStorage.setItem("sn:here", JSON.stringify(here)); } catch (e) {}
    flyTo(here, 1.12);
    say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · tap to recalibrate");
    pullListings();
    if (map && cityOn) { try { map.setView([here.lat, here.lng], Math.max(15, map.getZoom() || 17)); } catch (e) {} }
  }
  function endIntro() {
    if (!intro) return;
    intro = false;
    say("Zooming to you…");
    locate(function (pt) { land(pt, false); });
  }
  function bindGps() {
    var btn = $("gps");
    if (!btn || btn.__snGpsLock) return;
    btn.__snGpsLock = true;
    btn.addEventListener("click", function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      locate(function (pt) { land(pt, false); });
    }, true);
  }
  function gateStreet() {
    var seat = here || (SITES[0] && { lat: SITES[0].lat, lng: SITES[0].lng });
    if (cam.dist <= 1.06 && seat) openCity(seat);
    else if (cam.dist > 1.14 && cityOn) closeCity();
  }
  function openCity(pt) {
    var el = $("city");
    if (!el || typeof L === "undefined" || !pt) return;
    cityOn = true;
    el.classList.add("on");
    if (!map) {
      map = L.map(el, { zoomControl: false, attributionControl: false, minZoom: 15, maxZoom: 19 }).setView([pt.lat, pt.lng], 17);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, minZoom: 15 }).addTo(map);
      map.on("zoomend", function () {
        try {
          if (map && map.getZoom() < 15) closeCity();
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
      try { map.setMinZoom(15); } catch (e) {}
      map.setView([pt.lat, pt.lng], Math.max(15, map.getZoom() || 17));
    }
    if (youMark) try { map.removeLayer(youMark); } catch (e) {}
    youMark = L.circleMarker([pt.lat, pt.lng], { radius: 8, color: "#4df0ff", fillColor: "#4df0ff", fillOpacity: 0.9, weight: 2 }).addTo(map);
    paintShopsOnMap();
    setTimeout(function () { if (map) map.invalidateSize(); }, 80);
  }
  function closeCity() {
    var el = $("city");
    if (el) el.classList.remove("on");
    cityOn = false;
    if (cam.dist < 1.16) cam.dist = 1.16;
  }
  function listAt(pt) {
    if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return;
    listPt = { lat: pt.lat, lng: pt.lng };
    listAlt = altitudeFromDist(cam.dist);
    if (vendor) { setDrop(pt); return; }
    if (listAlt === "street") {
      openSheet("LIST",
        '<button type="button" class="sheet-go primary" data-act="list-kinds">List a vendor</button>' +
        '<button type="button" class="sheet-go" data-act="list-drop">List my delivery location</button>' +
        '<button type="button" class="sheet-go" data-act="list-base">List my delivery driver’s base</button>');
      say(pt.lat.toFixed(4) + "," + pt.lng.toFixed(4));
      return;
    }
    openSheet("POST",
      '<input id="sn-post-name" placeholder="Title" />' +
      '<button type="button" class="sheet-go primary" data-act="list-post">Post</button>');
    say(pt.lat.toFixed(4) + "," + pt.lng.toFixed(4));
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
    say("Resetting…");
    try { localStorage.clear(); sessionStorage.clear(); } catch (e) {}
    var go = function () { location.href = "/?v=4269&t=" + Date.now(); };
    if (navigator.serviceWorker) {
      navigator.serviceWorker.getRegistrations().then(function (rs) {
        return Promise.all(rs.map(function (r) { return r.unregister(); }));
      }).then(go).catch(go);
    } else go();
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
  function throwOffer(job) {
    var id = "offer-" + (job && job.id ? job.id : Date.now().toString(36));
    var title = (job && (job.shop || job.name || "OFFER")) || "OFFER";
    var html = '<p class="note">' + String((job && (job.note || job.item)) || "Work is up.").replace(/[<>]/g, "") + "</p>" +
      '<button type="button" class="sheet-go primary" data-act="hide">KEEP</button>';
    upsertTab({ id: id, kind: "offer", title: String(title).slice(0, 16).toUpperCase(), html: html, min: false });
    openSheet(title, html);
  }

  function setSupport(on) {
    supportOn = !!on;
    document.body.classList.toggle("sn-support", supportOn);
    var btn = $("sn-support");
    if (btn) btn.classList.toggle("on", supportOn);
    var inp = $("in");
    if (inp) inp.placeholder = supportOn ? "Support · type or tap MIC" : "Talk to Astranov SpaceNet";
    if (supportOn) {
      intro = false;
      upsertTab({ id: "support", kind: "support", title: "SUPPORT", html: "", min: false });
      say("SUPPORT desk. Type or tap MIC. This line does not open the workshop.");
      if (inp) inp.focus();
    } else {
      dockTabs.forEach(function (t) { if (t.id === "support") t.min = true; });
      paintDockTabs();
      say("Desk minimized.");
    }
  }
  function openSupport() {
    if (supportOn) { setSupport(false); return; }
    setSupport(true);
  }
  function sendSupport(matter, fromVoice) {
    matter = String(matter || "").trim();
    if (!matter) { say("Say what you need."); return; }
    var t = authToken();
    var who = "";
    try {
      var u = window.SNAuth && SNAuth.user && SNAuth.user();
      who = (u && (u.name || u.email)) || "";
    } catch (e) {}
    lastVoice = !!fromVoice;
    say("Desk…");
    fetch("/api/support/open", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: t ? "Bearer " + t : "" },
      body: JSON.stringify({ matter: matter, name: who || "guest", ticket: supportTicket })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (j && j.ok) {
        if (j.ticket) supportTicket = j.ticket;
        var text = j.say || ("Ticket " + (j.ticket || "") + " is with the desk.");
        say(text);
        speakIfVoice(text);
        return;
      }
      var fallback = "Got it on this phone. Ticket parked. The desk will take it.";
      say((j && j.error) || fallback);
      speakIfVoice(fallback);
    }).catch(function () {
      var fallback = "Line dark. Your note is on this phone until the desk is back.";
      say(fallback);
      speakIfVoice(fallback);
    });
  }
  function haversineKm(a, b) {
    var R = 6371;
    var p1 = (a.lat * Math.PI) / 180, p2 = (b.lat * Math.PI) / 180;
    var d1 = ((b.lat - a.lat) * Math.PI) / 180, d2 = ((b.lng - a.lng) * Math.PI) / 180;
    var x = Math.sin(d1 / 2) * Math.sin(d1 / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(d2 / 2) * Math.sin(d2 / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function isNight() { var h = new Date().getHours(); return h >= 21 || h < 9; }
  function quoteDelivery(from, to, opts) {
    opts = opts || {};
    var d = haversineKm(from, to);
    var fee = 3;
    if (d > 3) fee += Math.ceil(d - 3);
    if (opts.night || isNight()) fee += 3;
    if (opts.rain) fee += 3;
    if (opts.vip) fee += 3;
    if (opts.floor) fee += 3;
    var cut = Math.round(fee * 0.03 * 100) / 100;
    return { km: d, fee: fee, cut: cut, total: Math.round((fee + cut) * 100) / 100 };
  }
  function loadJobs() {
    try { jobs = JSON.parse(localStorage.getItem("sn:jobs") || "[]") || []; } catch (e) { jobs = []; }
  }
  function saveJobs() { try { localStorage.setItem("sn:jobs", JSON.stringify(jobs)); } catch (e) {} }
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
  function openSheet(title, html) {
    var sh = $("sn-sheet"), card = $("sn-sheet-card");
    if (!sh || !card) return;
    card.innerHTML = '<div class="sheet-bar"><b class="sheet-ttl"></b><button type="button" class="sheet-x" data-act="close">HIDE</button></div><div id="sn-sheet-body"></div>';
    card.querySelector(".sheet-ttl").textContent = title;
    card.querySelector("#sn-sheet-body").innerHTML = html;
    sh.classList.add("on");
    materialize(true);
  }
  function closeSheet() { var sh = $("sn-sheet"); if (sh) sh.classList.remove("on"); materialize(needFilter()); }
  function paintShopsOnMap() {
    if (!map || typeof L === "undefined") return;
    shopMarks.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
    shopMarks = [];
    shops.forEach(function (s) {
      if (!isFinite(s.lat) || !isFinite(s.lng)) return;
      var mark = L.circleMarker([s.lat, s.lng], { radius: 8, color: "#7ee9ff", fillColor: "#0a2030", fillOpacity: 0.95, weight: 2 });
      mark.bindTooltip(s.name || "shop", { direction: "top" });
      mark.on("click", function (e) { if (e && e.originalEvent) L.DomEvent.stop(e.originalEvent); openVendor(s); });
      mark.addTo(map);
      shopMarks.push(mark);
    });
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
  function huntNominatim(q) {
    var url = "https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=0&q=" + encodeURIComponent(q);
    if (here) {
      var w = (here.lng - 0.08).toFixed(4), e = (here.lng + 0.08).toFixed(4);
      var s = (here.lat - 0.08).toFixed(4), n = (here.lat + 0.08).toFixed(4);
      url += "&viewbox=" + w + "," + n + "," + e + "," + s + "&bounded=1";
    }
    return fetchJson(url, { headers: { Accept: "application/json" } }).then(function (rows) {
      return Array.isArray(rows) ? rows.map(function (r) { r.src = "nominatim"; return asPlace(r); }).filter(Boolean) : [];
    });
  }
  function huntOverpass(q) {
    if (!here) return Promise.resolve([]);
    var safe = String(q || "").replace(/[^a-zA-Z0-9α-ωΑ-ΩάέήίόύώΆ-Ώ ]/g, " ").trim();
    if (!safe) return Promise.resolve([]);
    var data = '[out:json][timeout:12];(nwr["name"~"' + safe + '",i](around:4000,' + here.lat + "," + here.lng + '););out center 12;';
    return fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: data }).then(function (r) { return r.json(); }).then(function (j) {
      return ((j && j.elements) || []).map(function (el) { el.src = "overpass"; return asPlace(el); }).filter(Boolean);
    }).catch(function () { return []; });
  }
  function huntNearby() {
    if (!here) return Promise.resolve([]);
    var data = '[out:json][timeout:12];(nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pharmacy)$"](around:2500,' + here.lat + "," + here.lng + ');nwr["shop"](around:2500,' + here.lat + "," + here.lng + '););out center 24;';
    return fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: data }).then(function (r) { return r.json(); }).then(function (j) {
      return uniqPlaces(((j && j.elements) || []).map(function (el) { el.src = "overpass"; return asPlace(el); }).filter(Boolean));
    }).catch(function () { return []; });
  }
  function huntApi(q) {
    if (!here) return Promise.resolve([]);
    var url = "/api/find?q=" + encodeURIComponent(q) + "&lat=" + here.lat.toFixed(4) + "&lng=" + here.lng.toFixed(4);
    return fetchJson(url).then(function (j) {
      return ((j && j.places) || []).map(function (p) { p.src = "find"; return asPlace(p); }).filter(Boolean);
    });
  }
  function hunt(q) {
    q = String(q || "").trim();
    if (!q) return;
    materialize(true);
    say("Finding " + q + "…");
    var go = function () {
      Promise.all([huntApi(q), huntNominatim(q), huntOverpass(q)]).then(function (packs) {
        shops = uniqPlaces(packs[0].concat(packs[1], packs[2]));
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
      huntNearby().then(function (rows) {
        shops = uniqPlaces(shops.concat(rows));
        if (shops.length) {
          paintShopsOnMap();
          say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · " + shops.length + " places around you. Talk a hunt or tap a pin.");
        } else if (here) say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · talk a shop name to hunt");
      });
    }
  }
  function openVendor(s) {
    vendor = s;
    if (map) map.setView([s.lat, s.lng], 17);
    var km = here ? haversineKm(here, s).toFixed(1) : "—";
    var items = (s.menu || []).map(function (m, i) {
      return '<button type="button" class="pill" data-act="add-item" data-i="' + i + '"><span class="ph">+</span><div><b></b><span></span></div></button>';
    }).join("");
    var html =
      "<p class=\"note\"></p>" +
      items +
      (s.phone ? '<a class="sheet-go" href="tel:' + String(s.phone).replace(/[^\d+]/g, "") + '">CALL</a>' : "") +
      '<button type="button" class="sheet-go primary" data-act="gpsdrop">TO MY GPS</button>' +
      '<button type="button" class="sheet-go" data-act="pindrop">PIN ON MAP</button>' +
      (signed() ? '<button type="button" class="sheet-go" data-act="assign-drv">ASSIGN DRIVER</button>' : '<button type="button" class="sheet-go primary" data-act="needlogin">LOGIN TO ORDER</button>');
    openSheet(s.name, html);
    var card = $("sn-sheet-card");
    if (card) {
      var pills = card.querySelectorAll("[data-act=add-item]");
      (s.menu || []).forEach(function (m, i) {
        if (!pills[i]) return;
        var b = pills[i].querySelector("b");
        var sp = pills[i].querySelector("span");
        if (b) b.textContent = m.name || "item";
        if (sp) sp.textContent = (m.price ? m.price + " AV€" : "") + (m.note ? " · " + m.note : "");
      });
    }
    var note = $("sn-sheet-body") && $("sn-sheet-body").querySelector(".note");
    if (note) note.textContent = (s.kind || "shop") + " · " + km + " km · real OSM pin. No dummy.";
    say(s.name + " · TO MY GPS or pin the drop.");
  }
  function setDrop(pt) {
    drop = { lat: pt.lat, lng: pt.lng };
    if (!vendor) { say("Hunt a shop first."); return; }
    showQuote();
  }
  function showQuote() {
    if (!vendor || !drop) return;
    var q = quoteDelivery(vendor, drop, quoteOpts);
    var html =
      '<p class="note"></p>' +
      '<button type="button" class="sheet-go" data-act="vip">' + (quoteOpts.vip ? "VIP +3 ON" : "VIP +3") + "</button>" +
      '<button type="button" class="sheet-go" data-act="floor">' + (quoteOpts.floor ? "FLOOR +3 ON" : "ROOM / FLOOR +3") + "</button>" +
      (signed()
        ? '<button type="button" class="sheet-go primary" data-act="send">SEND · ' + q.total + " AV€</button>"
        : '<button type="button" class="sheet-go primary" data-act="needlogin">LOGIN TO ORDER · ' + q.total + " AV€</button>");
    openSheet("QUOTE", html);
    var note = $("sn-sheet-body") && $("sn-sheet-body").querySelector(".note");
    if (note) note.textContent = q.km.toFixed(2) + " km · " + q.fee + " AV€ delivery · 3% " + q.cut + " · night/rain judged. Tip later.";
    drawRoute(vendor, drop);
    say("Quote " + q.total + " AV€ · " + vendor.name);
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
      try { map.fitBounds(routeLayer.getBounds(), { padding: [40, 40] }); } catch (e) {}
    });
  }
  function sendJob() {
    if (!vendor || !drop) return;
    if (!signed()) return;
    var q = quoteDelivery(vendor, drop, quoteOpts);
    var job = {
      id: "j" + Date.now().toString(36),
      vendor: vendor,
      drop: drop,
      km: q.km,
      fee: q.total,
      stage: 0,
      confirms: { vendor: false, driver: false, client: false },
      paid: false,
      t: Date.now()
    };
    jobs.unshift(job);
    saveJobs();
    closeSheet();
    openJobs();
    say("Pending · vendor + driver + client must confirm. Then it is a job.");
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
    if (!signed()) { say("LOGIN to confirm."); return; }
    job.confirms[who] = true;
    if (job.confirms.vendor && job.confirms.driver && job.confirms.client) {
      job.stage = Math.min(STAGES.length - 1, Math.max(job.stage, 1));
      say("Verified · " + job.vendor.name + " · " + job.fee + " AV€. Pay to mint.");
    } else {
      say((who.toUpperCase()) + " confirmed. Need vendor + driver + client.");
    }
    saveJobs();
    openJobs();
  }
  function advanceStage(id) {
    var job = jobs.filter(function (j) { return j.id === id; })[0];
    if (!job) return;
    if (!(job.confirms.vendor && job.confirms.driver && job.confirms.client)) {
      say("Not a job until all three confirm.");
      return;
    }
    job.stage = Math.min(STAGES.length - 1, job.stage + 1);
    saveJobs();
    openJobs();
    say(STAGES[job.stage] + " · " + job.vendor.name);
  }
  function materialize(need) {
    var row = $("sn-filters");
    if (!row) return;
    if (need) row.classList.add("mat");
    else row.classList.remove("mat");
    layoutChrome();
  }
  function needFilter() {
    var inp = $("in");
    if (inp && inp.value.trim()) return true;
    var tasks = $("sn-tasks"), sheet = $("sn-sheet");
    if (tasks && tasks.classList.contains("on")) return true;
    if (sheet && sheet.classList.contains("on")) return true;
    return false;
  }
  function openJobs() {
    materialize(true);
    var sh = $("sn-tasks"); if (!sh) return;
    var list = $("sn-tasks-list");
    if (list) {
      if (!jobs.length) list.innerHTML = '<p class="note">No posted jobs. Hunt a real pin, TO MY GPS, then SEND.</p>';
      else list.innerHTML = jobs.map(function (j) {
        var ok = j.confirms.vendor && j.confirms.driver && j.confirms.client;
        var stages = STAGES.map(function (s, i) { return "<b class=\"" + (i <= j.stage && ok ? "on" : "") + "\">" + s + "</b>"; }).join("");
        return '<div class="pill" style="display:block">' +
          "<b>" + String(j.vendor && j.vendor.name || "job").replace(/</g, "") + "</b>" +
          "<span>" + (ok ? "VERIFIED" : "PENDING") + " · " + j.fee + " AV€ · " + (j.km || 0).toFixed(1) + " km</span>" +
          '<div class="stage">' + stages + "</div>" +
          '<button type="button" class="sheet-go" data-act="cv" data-id="' + j.id + '">VENDOR CONFIRM</button>' +
          '<button type="button" class="sheet-go" data-act="cd" data-id="' + j.id + '">DRIVER CONFIRM</button>' +
          '<button type="button" class="sheet-go" data-act="cc" data-id="' + j.id + '">CLIENT CONFIRM</button>' +
          (ok ? '<button type="button" class="sheet-go" data-act="next" data-id="' + j.id + '">NEXT STAGE</button>' : "") +
          (ok && !j.paid ? '<button type="button" class="sheet-go primary" data-act="pay" data-id="' + j.id + '">PAYPAL ' + j.fee + " €</button>" : "") +
          "</div>";
      }).join("");
    }
    sh.classList.add("on");
  }
  function closeJobs() { var sh = $("sn-tasks"); if (sh) sh.classList.remove("on"); materialize(needFilter()); }
  function openFind() {
    materialize(true);
    var inp = $("in");
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
    if (act === "reload" || act === "pay") { addFunds(10); return; }
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
    if (supportOn) { sendSupport(q, fromVoice); return; }
    lastVoice = !!fromVoice;
    say("Grok…");
    hist.push({ role: "user", content: q });
    if (hist.length > 16) hist = hist.slice(-16);
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
          avc: signed() ? avcGet() : 0,
          shop: vendor && vendor.name,
          vendors: vendors
        }
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var text = (j && (j.say || j.text)) || "Grok is quiet.";
      hist.push({ role: "assistant", content: text });
      say(text);
      speakIfVoice(text);
      applyAct(j, q);
    }).catch(function () {
      say("Grok dark. Named hunt on this phone.");
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
    var blockers = ["island", "panel"].map(function (id) { return visRect($(id)); }).filter(Boolean);
    function place(el, corner) {
      if (!el) return;
      var w = Math.max(40, el.offsetWidth || 48);
      var hgt = Math.max(40, el.offsetHeight || 48);
      var x = corner.indexOf("l") >= 0 ? pad : W - w - pad;
      var y = corner.indexOf("t") >= 0 ? pad : H - hgt - pad;
      var n = 0;
      while (n++ < 16) {
        var box = { left: x, top: y, right: x + w, bottom: y + hgt };
        var hit = null;
        for (var i = 0; i < blockers.length; i++) {
          if (boxesHit(box, blockers[i], 8)) { hit = blockers[i]; break; }
        }
        if (!hit) break;
        if (corner.indexOf("t") >= 0) y = Math.max(y + 6, hit.bottom + 8);
        else y = Math.min(y - 6, hit.top - hgt - 8);
        y = Math.max(pad, Math.min(H - hgt - pad, y));
        x = Math.max(pad, Math.min(W - w - pad, x));
      }
      el.style.setProperty("top", Math.round(y) + "px", "important");
      el.style.setProperty("left", Math.round(x) + "px", "important");
      el.style.setProperty("right", "auto", "important");
      el.style.setProperty("bottom", "auto", "important");
    }
    place($("sn-me"), "bl");
    place($("gps"), "br");
    var money = $("sn-money");
    var isle = visRect($("island"));
    if (money && isle) {
      money.style.setProperty("top", Math.round(isle.bottom + 8) + "px", "important");
      money.style.setProperty("right", "10px", "important");
      money.style.setProperty("left", "auto", "important");
      money.style.setProperty("bottom", "auto", "important");
    }
  }
  var layoutKey = "";
  function maybeLayout() {
    var key = (intro ? "1" : "0") + ":" + window.innerWidth + "x" + window.innerHeight;
    if (key === layoutKey) return;
    layoutKey = key;
    layoutChrome();
  }
  function bindChrome() {
    bindGps();
    var power = $("sn-power");
    if (power && !power.__sn) {
      power.__sn = true; power.hidden = false;
      var holdP = 0, holdFrom = 0;
      function offersOn() {
        try { return localStorage.getItem("sn:offers") === "1"; } catch (e) { return false; }
      }
      function setOffers(on) {
        try { localStorage.setItem("sn:offers", on ? "1" : "0"); } catch (e) {}
        power.classList.toggle("on", !!on);
        power.classList.toggle("idle", !on);
        if (on) {
          say("Offers live. Jobs and nearby work can pop.");
          materialize(true);
          if (jobs.length) {
            jobs.slice(0, 6).forEach(function (j) { throwOffer(j); });
            openJobs();
            var tasks = $("sn-tasks");
            if (tasks) tasks.classList.remove("min");
          } else {
            throwOffer({ id: "live", name: "OFFERS", note: "Offers are live. Hunt a pin or wait for work." });
          }
        } else {
          say("Offers off. No pop-ups.");
          dockTabs = dockTabs.filter(function (t) { return t.kind !== "offer"; });
          paintDockTabs();
          closeJobs();
          closeSheet();
          materialize(false);
        }
      }
      power.classList.toggle("on", offersOn());
      power.classList.toggle("idle", !offersOn());
      power.addEventListener("pointerdown", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (holdP) clearInterval(holdP);
        holdFrom = Date.now();
        var n = 3;
        say("Power " + n);
        holdP = setInterval(function () {
          n -= 1;
          if (n > 0) { say("Power " + n); return; }
          clearInterval(holdP); holdP = 0;
          setOffers(!offersOn());
        }, 1000);
      });
      function cancelHold() {
        if (!holdP) return;
        clearInterval(holdP); holdP = 0;
        if (Date.now() - holdFrom < 2800) say("Hold 3 seconds.");
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
        var html = '<p class="note">' + Math.round(avcGet()).toLocaleString("en-GB") + " AV€ on this account.</p>";
        if (ownerMail()) html += '<p class="note">Pool ' + Math.round(poolGet()).toLocaleString("en-GB") + " AV€ · owner only.</p>";
        html += '<button type="button" class="sheet-go primary" data-act="add-10">ADD 10 € PAYPAL</button>' +
          '<button type="button" class="sheet-go" data-act="add-50">ADD 50 € PAYPAL</button>' +
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
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest ? e.target.closest("[data-act]") : e.target;
      var act = t && t.getAttribute && t.getAttribute("data-act");
      if (!act) return;
      var id = t.getAttribute("data-id");
      var i = Number(t.getAttribute("data-i"));
      if (act === "hide") closeJobs();
      if (act === "close") { closePower(); closeSheet(); }
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
      if (act === "vip") { quoteOpts.vip = !quoteOpts.vip; showQuote(); }
      if (act === "floor") { quoteOpts.floor = !quoteOpts.floor; showQuote(); }
      if (act === "send") sendJob();
      if (act === "needlogin") { if (window.SNAuth && SNAuth.google) SNAuth.google(); else say("LOGIN to order."); }
      if (act === "add-10") addFunds(10);
      if (act === "add-50") addFunds(50);
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
      if (act === "add-item") {
        var ix = Number(t.getAttribute("data-i"));
        var item = vendor && vendor.menu && vendor.menu[ix];
        if (!item) { say("No product."); return; }
        say((item.name || "item") + " in the order. Set drop, then send.");
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
      if (act === "cv") confirmJob(id, "vendor");
      if (act === "cd") confirmJob(id, "driver");
      if (act === "cc") confirmJob(id, "client");
      if (act === "next") advanceStage(id);
      if (act === "pay") payJob(id);
    });
    paintIsland();
    setInterval(paintIsland, 1000);
    say("Earth scan · 13s · then we zoom to you.");
  }
  function addFunds(eur) {
    if (!signed()) {
      say("LOGIN to put money on the account.");
      if (window.SNAuth && SNAuth.google) SNAuth.google();
      return;
    }
    eur = Number(eur) || 10;
    say("Opening PayPal for " + eur + " €…");
    fetch("/api/paypal/create-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: eur, origin: location.origin, reference: "deposit" })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var url = (j && (j.approve || j.url));
      if (!url) { say((j && (j.error || j.message)) || "PayPal did not return approve."); return; }
      try { localStorage.setItem("sn:pay-deposit", String(eur)); } catch (e) {}
      location.href = url;
    }).catch(function () { say("PayPal dark."); });
  }
  function evolve(patch) {
    if (!patch || typeof patch !== "object") return;
    var keys = ["huntCap", "voice", "tip", "vip", "floor"];
    keys.forEach(function (k) {
      if (patch[k] == null) return;
      try { localStorage.setItem("sn:rule:" + k, String(patch[k])); } catch (e) {}
    });
    say("Rules updated.");
  }
  function boot() {
    canvas = $("g");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    seedStars();
    cam.yaw = (20 * Math.PI) / 180 - earthSpin();
    cam.pitch = 0.22;
    cam.dist = 1.85;
    bindGlobe();
    bindChrome();
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
    window.__SN_4274 = true;
    window.SN = {
      talk: talk, say: say, cam: cam,
      getMap: function () { return map; },
      openCity: openCity, closeCity: closeCity, listAt: listAt, goNamed: hunt, huntNamed: hunt,
      user: function () { return window.SNAuth && SNAuth.user ? SNAuth.user() : null; },
      paintMoney: paintMoney, evolve: evolve, addFunds: addFunds,
      visibleShops: function () { return shops; },
      jobs: function () { return jobs; },
      hunt: hunt,
      quoteDelivery: quoteDelivery,
      paintMoney: paintMoney, avcGet: avcGet,
      paintPower: function () { var p = $("sn-power"); if (p) p.hidden = false; },
      projectTest: function (lat, lng) { return project(lat, lng, cam); }
    };
    Object.defineProperty(window, "__SN_INTRO", { get: function () { return intro; } });
    requestAnimationFrame(loop);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
