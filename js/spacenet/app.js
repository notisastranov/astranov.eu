/*
 * SpaceNet 4480
 *
 * Astranov Script is the project's name for this stack:
 * - JavaScript for the SpaceNet browser app and Node.js API handlers.
 * - TypeScript for React apps and Supabase Edge Functions.
 * - SQL and PL/pgSQL for PostgreSQL schemas, access rules, and transactions.
 * - HTML and CSS for page structure and styling.
 *
 * Each file uses the standard syntax and tooling for its language.
 */
(function () {
  "use strict";
  var VER = "4480";
  var INTRO_MS = 13000;
  var LAND = [], BORDERS = [];
  function unpackLines(pack) {
    return pack.trim().split(";").map(function (line) {
      return line.split(" ").map(function (point) { return point.split(",").map(Number); });
    });
  }
  function loadBorders() {
    fetch("/js/spacenet/assets/borders.pack?v=" + VER, { cache: "force-cache" })
      .then(function (r) { if (r.ok) return r.text(); })
      .then(function (pack) { if (pack) BORDERS = unpackLines(pack); })
      .catch(function () {});
  }
  function drawBorders() {
    var yaw = cam.yaw + earthSpin(), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    ctx.beginPath();
    BORDERS.forEach(function (line) {
      var pen = false;
      line.forEach(function (point) {
        var vector = vecOf(point[0], point[1], yaw, cp, sp);
        if (vector.z < 0.04) { pen = false; return; }
        var p = scrOf(vector);
        if (pen) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
        pen = true;
      });
    });
    ctx.strokeStyle = "rgba(126,233,255,.78)";
    ctx.lineWidth = 1.15;
    ctx.stroke();
  }
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
  var globalGlobeDistance = 2.10;
  var cam = { yaw: 0.49, pitch: 0.35, dist: globalGlobeDistance };
  var vel = { yaw: 0, pitch: 0 };
  var fly = null;
  var here = null;
  var intro = true;
  var introT0 = 0;
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
  var quoteOpts = { rain: false, floor: false, tip: 0 };
  var STAGES = ["ACCEPT", "PICKUP HANDOFF", "IN TRANSIT", "DELIVERED", "RECEIVED"];
  var view = { cx: 0, cy: 0, scale: 120, w: 1, h: 1 };
  var SIDEREAL_DAY_S = 86164.0905;
  var earthOpenTime = performance.now();
  var earthStartPhase = ((Date.now() / 1000) % SIDEREAL_DAY_S) * 2 * Math.PI / SIDEREAL_DAY_S;
  // Keep the starting meridian aligned to sidereal time, then animate at viewing speed.
  var globeDaySeconds = matchMedia("(prefers-reduced-motion: reduce)").matches ? SIDEREAL_DAY_S : 300;
  var listPt = null;
  var listAlt = "street";
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
  function earthSpin() {
    return (earthStartPhase + (performance.now() - earthOpenTime) / 1000 * 2 * Math.PI / globeDaySeconds) % (2 * Math.PI);
  }
  var TIERS = [
    { id: "galaxy", dist: 9.2, name: "Galaxy" },
    { id: "solar", dist: 5.4, name: "Solar system" },
    { id: "global", dist: globalGlobeDistance, name: "Globe" },
    { id: "national", dist: 0.72, name: "National" },
    { id: "city", dist: 0.72, name: "City" }
  ];
  var tierI = 2;
  var tierLock = 0;
  var aim = null;
  var gpsSeq = 0;
  var wheelAt = -Infinity, wheelDirection = 0, wheelAmount = 0, wheelStepped = false;
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
    n = Math.max(0, Math.round((Number(n) || 0) * 100) / 100);
    try { localStorage.setItem("sn:avc", String(n)); } catch (e) {}
    paintMoney();
    return n;
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
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken() },
      body: JSON.stringify({ amount: eur, origin: location.origin, reference: "deposit", currency: "AV€", rail: rail, wallet_topup: rail === "paypal" })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var url = (j && (j.approve || j.url || j.checkout));
      if (!url) { openSheet("Wallet top-up", '<p class="note">Top-up could not start.</p>'); return; }
      if (rail === "paypal" && j.orderId) {
        try { localStorage.setItem("sn:wallet-order", JSON.stringify({ id: j.orderId, account: checkoutAccount() })); } catch (e) {}
      }
      location.href = url;
    }).catch(function () { openSheet("Wallet top-up", '<p class="note">Top-up service unavailable.</p>'); });
  }
  var paypalReturnPending = false;
  async function finishPayPalReturn() {
    var params = new URLSearchParams(location.search);
    if (paypalReturnPending || params.get("paypal") !== "success" || !params.get("token")) return;
    paypalReturnPending = true;
    var oid = params.get("token"), isWallet = params.get("wallet") === "1";
    try {
      var response = await fetch("/api/paypal/capture-order", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + authToken() },
        body: JSON.stringify({ token: oid, wallet_topup: isWallet })
      });
      var result = await response.json();
      if (!response.ok || !result.ok) {
        openSheet("PayPal confirmation", '<p class="note">' + (response.status === 403 ? "Sign in with the account that started this top-up." :
          "Confirmation is pending. Reload to retry this payment.") + '</p>');
        return;
      }
      if (result.wallet) {
        try {
          var pending = JSON.parse(localStorage.getItem("sn:wallet-order") || "null");
          var seenKey = "sn:wallet-seen:" + result.captureId;
          if (pending && pending.id === oid && pending.account === checkoutAccount() && !localStorage.getItem(seenKey)) {
            localStorage.setItem(seenKey, "1");
            avcSet(avcGet() + Number(result.avc));
          }
          if (pending && pending.id === oid) localStorage.removeItem("sn:wallet-order");
        } catch (e) {}
        testCheckoutRequest();
        pullTxnsRemote();
        openSheet("Wallet top-up confirmed", '<p class="note">' + escHtml(result.eur) + ' EUR received.' +
          (result.wallet.bonus_cents ? ' First-deposit bonus: ' + escHtml(testCoinText(result.wallet.bonus_cents)) + ' in test credits.' : '') + '</p>');
      } else {
        var jid = localStorage.getItem("sn:pay-job") || "";
        jobs.forEach(function (job) { if (job.id === jid) job.paid = true; });
        saveJobs();
        localStorage.removeItem("sn:pay-job");
        say("PayPal transaction verified.");
      }
      var clean = new URL(location.href);
      ["paypal", "wallet", "token", "PayerID"].forEach(function (key) { clean.searchParams.delete(key); });
      history.replaceState({}, "", clean.href);
    } catch (e) {
      openSheet("PayPal confirmation", '<p class="note">Confirmation is pending. Reload to retry this payment.</p>');
    } finally { paypalReturnPending = false; }
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
    var n = avcGet();
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
    if (bot - top < 80) { top = 16; bot = h - 16; }
    var cx = w / 2;
    var cy = (top + bot) / 2;
    var base = Math.max(tierI === 2 ? 48 : 120, Math.min((bot - top) * 0.46, w * 0.46));
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
  function vecOf(lat, lng, yaw, cp, sp) {
    var lam = (lng * Math.PI) / 180 - yaw;
    var phi = (lat * Math.PI) / 180;
    var x = Math.cos(phi) * Math.sin(lam);
    var y = Math.sin(phi);
    var z = Math.cos(phi) * Math.cos(lam);
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
    var yaw = c.yaw + earthSpin(), cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    var n = ring.length, step = Math.max(1, (n / 4) | 0), seen = false, i;
    for (i = 0; i < n; i += step) {
      if (vecOf(ring[i][0], ring[i][1], yaw, cp, sp).z > 0.02) { seen = true; break; }
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
      var va = vecOf(a[0], a[1], yaw, cp, sp), vb = vecOf(b[0], b[1], yaw, cp, sp);
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
  var globeRadar = { longitude: null, lastFrame: 0, target: null, until: 0, seen: new Map() };
  var radarHoldMs = 3000;
  var radarSpeed = 18; // Degrees per second.

  function radarTurn(value) {
    // Both meridians of the sweep plane share a 180-degree phase.
    return ((value % 180) + 180) % 180;
  }
  function radarTargets() {
    var targets = [];
    newsItems.forEach(function (clip) {
      var location = clip.location;
      if (location.kind === "story" || clip.breaking) {
        targets.push({ lat: location.lat, lng: location.lng, label: "News · " + location.name, clip: clip });
      }
    });
    if (tierI === 2) return targets;
    nearbyPosts.forEach(function (post) {
      if (post && (post.note || post.text || post.title) && Number.isFinite(post.lat) && Number.isFinite(post.lng)) {
        targets.push({ lat: post.lat, lng: post.lng, label: "Post · " + (post.name || post.title || "Map update") });
      }
    });
    [pendingOffer, testOrder].concat(jobs.slice(0, 12)).forEach(function (job) {
      var vendor = job && job.vendor;
      if (vendor && !job.cancelled && (job.stage || 0) < 4 && Number.isFinite(vendor.lat) && Number.isFinite(vendor.lng)) {
        targets.push({ lat: vendor.lat, lng: vendor.lng, label: "Delivery · " + (vendor.name || "Active order") });
      }
    });
    return targets;
  }
  function showRadarDetection(target) {
    $("sn-radar").classList.toggle("locked", !!target);
    $("sn-radar-status").textContent = target ? "Radar detected " + target.label : "";
  }
  function stepGlobeRadar(now) {
    var radar = globeRadar;
    if (radar.longitude === null) {
      radar.longitude = radarTurn((cam.yaw + earthSpin()) * 180 / Math.PI - 40);
    }
    var dt = radar.lastFrame ? Math.min(50, now - radar.lastFrame) : 0;
    radar.lastFrame = now;
    if (radar.target) {
      if (now < radar.until) return;
      radar.target = null;
      showRadarDetection(null);
    }
    var travel = radarSpeed * dt / 1000;
    var closest = travel;
    var found = null, key;
    radarTargets().forEach(function (target) {
      var crossing = radarTurn(target.lng - radar.longitude);
      if (crossing > closest) return;
      var place = target.lat.toFixed(1) + "," + target.lng.toFixed(1);
      if (now < (radar.seen.get(place) || 0)) return;
      var point = project(target.lat, target.lng, cam);
      if (!point || point.z < .18 || point.x < 12 || point.x > view.w - 12 || point.y < 12 || point.y > view.h - 12) return;
      closest = crossing;
      found = target;
      key = place;
    });
    if (!found) {
      radar.longitude = radarTurn(radar.longitude + travel);
      return;
    }
    radar.seen.forEach(function (expiry, place) { if (expiry <= now) radar.seen.delete(place); });
    radar.seen.set(key, now + 60000);
    radar.target = found;
    radar.longitude = radarTurn(found.lng);
    radar.until = now + radarHoldMs;
    showRadarDetection(found);
    if (found.clip) found.country = eventCountry(found);
  }
  function traceRadarMeridian(longitude, color, width) {
    ctx.beginPath();
    for (var side = 0; side < 2; side++) {
      var pen = false;
      for (var lat = -90; lat <= 90; lat += 2) {
        var p = project(lat, longitude + side * 180, cam);
        if (!p) { pen = false; continue; }
        if (pen) ctx.lineTo(p.x, p.y);
        else ctx.moveTo(p.x, p.y);
        pen = true;
      }
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }
  function drawGlobeRadar(now) {
    stepGlobeRadar(now);
    var radar = globeRadar;
    ctx.save();
    if (radar.target) {
      ctx.shadowColor = "#7dff9a";
      ctx.shadowBlur = 13;
      traceRadarMeridian(radar.longitude, "rgba(143,255,183,.96)", 2.4);
    } else {
      for (var trail = 3; trail > 0; trail--) {
        traceRadarMeridian(radar.longitude - trail * 3, "rgba(120,230,255," + (.15 - trail * .035) + ")", 3);
      }
      traceRadarMeridian(radar.longitude, "rgba(120,230,255,.87)", 1.6);
    }
    ctx.restore();
  }
  function drawGlobeEventPoints() {
    ctx.save();
    ctx.fillStyle = "#91f5ff";
    ctx.shadowColor = "#4df0ff";
    ctx.shadowBlur = 10;
    var seen = new Set();
    newsItems.forEach(function (clip) {
      var loc = clip.location;
      if (loc.kind !== "story") return;
      var key = loc.lat + "," + loc.lng;
      if (seen.has(key)) return;
      seen.add(key);
      var point = project(loc.lat, loc.lng, cam);
      if (!point) return;
      ctx.beginPath();
      ctx.arc(point.x, point.y, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.restore();
  }
  function drawRadarTarget(now) {
    var target = globeRadar.target;
    if (!target) return;
    drawEventOutline(target, now);
    var point = project(target.lat, target.lng, cam);
    if (!point) return;
    ctx.save();
    ctx.shadowColor = "#7dff9a";
    ctx.shadowBlur = 12;
    ctx.strokeStyle = "#aaffc1";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = "#d6ffe1";
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.font = "700 11px system-ui,sans-serif";
    ctx.textAlign = "center";
    var label = target.label.slice(0, 37);
    var x = Math.max(85, Math.min(view.w - 85, point.x));
    ctx.strokeStyle = "#041320";
    ctx.lineWidth = 3;
    ctx.strokeText(label, x, point.y - 18);
    ctx.fillText(label, x, point.y - 18);
    ctx.restore();
  }
  function pauseGlobeRadar(now) {
    globeRadar.lastFrame = 0;
    if (globeRadar.target && now >= globeRadar.until) {
      globeRadar.target = null;
      showRadarDetection(null);
    }
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
    if (cam.dist > 3) { pauseGlobeRadar(now); drawOrrery(now); return; }
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
    if (tierI === 3) drawBorders();
    var night = ctx.createLinearGradient(cx - r, cy, cx + r * 0.35, cy);
    night.addColorStop(0, "rgba(2,6,12,0.16)");
    night.addColorStop(0.55, "rgba(2,6,12,0.08)");
    night.addColorStop(1, "rgba(2,6,12,0)");
    ctx.fillStyle = night;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    drawGlobeRadar(now);
    if (tierI === 2) drawGlobeEventPoints();
    if (here) {
      p = project(here.lat, here.lng, cam);
      if (p) {
        ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fillStyle = "#e8fbff"; ctx.fill();
        ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(232,251,255,0.8)"; ctx.lineWidth = 1.2; ctx.stroke();
      }
    }
    drawRadarTarget(now);
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
      cam.dist = globalGlobeDistance;
      return;
    }
    if (!drag && (Math.abs(vel.yaw) > 0.00004 || Math.abs(vel.pitch) > 0.00004)) {
      var damp = Math.pow(0.94, dt / 0.016);
      var travel = (1 - damp) / (1 - 0.94);
      cam.yaw += vel.yaw * travel;
      cam.pitch = Math.max(-1.15, Math.min(1.15, cam.pitch + vel.pitch * travel));
      vel.yaw *= damp; vel.pitch *= damp;
      if (Math.abs(vel.yaw) < 0.00004) vel.yaw = 0;
      if (Math.abs(vel.pitch) < 0.00004) vel.pitch = 0;
    } else if (!drag) { vel.yaw = 0; vel.pitch = 0; }
  }
  var newsRegions = [];
  var newsCountry = null;
  var newsRegionCheck = 0;
  var newsRefresh = 0;
  var newsGeneration = 0;
  var newsItems = [];
  var newsSelection = null;
  var newsPlayer = null;
  var newsPlayerReady = false;
  var newsScriptPending = false;
  var newsScriptRetry = 0;
  var newsFrame = 0;

  var eventOutlines = [];
  var reduceRadarMotion = matchMedia("(prefers-reduced-motion: reduce)");
  function insideCountryRing(point, ring) {
    var inside = false;
    for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      var a = ring[i], b = ring[j];
      if ((a[1] > point.lat) !== (b[1] > point.lat) &&
          point.lng < (b[0] - a[0]) * (point.lat - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    return inside;
  }
  function countryAt(point) {
    if (!point) return "";
    var region = newsRegions.find(function (region) {
      return region[1].some(function (ring) { return insideCountryRing(point, ring); });
    });
    var country = !region && eventCountry(point);
    return region ? region[0] : country ? country[0] === "Romania" ? "RO" : country[0] : "";
  }
  function eventCountry(point) {
    return eventOutlines.find(function (country) {
      return country[1].some(function (polygon) {
        var box = polygon[0], rings = polygon[1];
        return point.lng >= box[0] && point.lat >= box[1] && point.lng <= box[2] && point.lat <= box[3] &&
          insideCountryRing(point, rings[0]) &&
          !rings.slice(1).some(function (ring) { return insideCountryRing(point, ring); });
      });
    });
  }
  function drawEventOutline(target, now) {
    if (!target.country) return;
    var pulse = reduceRadarMotion.matches ? 1 : .6 + .4 * Math.sin((now - globeRadar.until + radarHoldMs) * .009);
    ctx.save();
    ctx.shadowColor = "#7dff9a";
    ctx.shadowBlur = 5 + pulse * 10;
    ctx.strokeStyle = "#9effb8";
    ctx.globalAlpha = Math.max(.35, pulse);
    ctx.lineWidth = 1.5 + pulse * 1.3;
    var yaw = cam.yaw + earthSpin(), cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
    ctx.beginPath();
    target.country[1].forEach(function (polygon) {
      polygon[1].forEach(function (ring) {
        var pen = false;
        ring.forEach(function (lonLat) {
          var vector = vecOf(lonLat[1], lonLat[0], yaw, cp, sp);
          if (vector.z < .04) { pen = false; return; }
          var p = scrOf(vector);
          if (pen) ctx.lineTo(p.x, p.y);
          else ctx.moveTo(p.x, p.y);
          pen = true;
        });
      });
    });
    ctx.stroke();
    ctx.restore();
  }
  var tappedNewsAudio = false;
  function applyNewsAudio() {
    if (!newsPlayerReady || !newsPlayer) return;
    var volume = tappedNewsAudio ? Math.max(0, Math.min(100, sound.news)) / 100 : soundLevel("news");
    newsPlayer.setVolume(Math.round(volume * 100));
    if (volume) newsPlayer.unMute();
    else newsPlayer.mute();
  }
  function prepareNewsPlayer() {
    if (newsPlayer || !newsSelection) return;
    if (!window.YT || !YT.Player) {
      if (newsScriptPending || performance.now() < newsScriptRetry) return;
      newsScriptPending = true;
      window.onYouTubeIframeAPIReady = prepareNewsPlayer;
      var script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.onerror = function () {
        newsScriptPending = false;
        newsScriptRetry = performance.now() + 30000;
        script.remove();
        $("sn-news-status").textContent = "Preview unavailable.";
      };
      document.head.appendChild(script);
      return;
    }
    var frame = ++newsFrame;
    var clip = newsSelection;
    var target = document.createElement("div");
    $("sn-news-preview").replaceChildren(target);
    newsPlayer = new YT.Player(target, {
      host: "https://www.youtube-nocookie.com",
      videoId: clip.playlist ? undefined : clip.id,
      playerVars: { playsinline: 1, autoplay: 0, rel: 0, origin: location.origin },
      events: {
        onReady: function (event) {
          if (frame !== newsFrame) return;
          newsPlayerReady = true;
          if (!$("drawer").classList.contains("open")) { event.target.cueVideoById(clip.id); return; }
          applyNewsAudio();
          if (clip.playlist) event.target.loadPlaylist({ list: clip.id, listType: "playlist" });
          else event.target.loadVideoById(clip.id);
        },
        onAutoplayBlocked: function () {
          if (frame === newsFrame) $("sn-news-status").textContent = "Tap play in the video to start the preview.";
        },
        onError: function () {
          if (frame === newsFrame) $("sn-news-status").textContent = "This video cannot be played here.";
        }
      }
    });
  }
  var newsReturnHeight;
  function openNews(clip) {
    if (!newsSelection) newsReturnHeight = drawerH;
    stopNews();
    tappedNewsAudio = true;
    newsSelection = clip;
    clip.button.setAttribute("aria-expanded", "true");
    $("sn-news-title").textContent = clip.source + " · " + clip.title;
    $("sn-news-status").textContent = "";
    $("drawer").classList.add("playing-news");
    $("sn-news-player").hidden = false;
    setDrawerHeight(Math.max(drawerH, Math.round(innerHeight / 3)));
    prepareNewsPlayer();
  }
  function stopNews() {
    if (newsSelection) newsSelection.button.setAttribute("aria-expanded", "false");
    newsSelection = null;
    $("drawer").classList.remove("playing-news");
    $("sn-news-player").hidden = true;
    if (newsPlayer) {
      newsFrame++;
      newsPlayer.destroy();
      newsPlayer = null;
      newsPlayerReady = false;
    }
    $("sn-news-preview").replaceChildren();
  }
  function buildNewsTile(clip) {
    var pin = document.createElement("div");
    pin.className = "news-pin";
    pin.hidden = true;
    var line = document.createElement("span");
    line.className = "news-line";
    line.setAttribute("aria-hidden", "true");
    var button = document.createElement("button");
    button.type = "button";
    button.className = "news-tile";
    var place = (clip.location.kind === "publisher" ? "Publisher: " : "") + clip.location.name;
    button.title = clip.title + " · " + clip.source + " · " + place;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-controls", "sn-news-player");
    button.setAttribute("aria-expanded", "false");
    if (!clip.playlist) {
      var image = document.createElement("img");
      image.src = "https://i.ytimg.com/vi/" + clip.id + "/default.jpg";
      image.alt = "";
      button.append(image);
    }
    var label = document.createElement("span");
    label.textContent = clip.breaking ? "Breaking · " + clip.title : clip.location.kind === "publisher" ? clip.source : clip.location.name;
    button.append(label);
    button.addEventListener("click", function () {
      openNews(clip);
    });
    pin.append(line, button);
    return Object.assign(clip, { pin: pin, line: line, button: button, box: null });
  }
  function validNewsClip(clip) {
    var location = clip && clip.location;
    return location && Number.isFinite(location.lat) && Math.abs(location.lat) <= 90 &&
      Number.isFinite(location.lng) && Math.abs(location.lng) <= 180 &&
      (clip.playlist ? /^UU[\w-]{22}$/ : /^[\w-]{11}$/).test(clip.id);
  }
  function loadNews(country, global, center) {
    var generation = ++newsGeneration;
    var params = new URLSearchParams(global ? { events: "1" } : { country: country });
    if (center) { params.set("lat", center.lat.toFixed(2)); params.set("lng", center.lng.toFixed(2)); }
    fetchJson("/api/news?" + params)
      .then(function (feed) {
        if (generation !== newsGeneration) return;
        var clips = Array.isArray(feed && feed.items) ? feed.items.filter(validNewsClip) : [];
        if (global) clips = clips.filter(clip => clip.location.kind === "story" || clip.topic && clip.topic !== "events");
        var liked = newsLikes();
        clips.sort((a,b)=>newsRank(b, liked) - newsRank(a, liked) || Number(!!b.breaking)-Number(!!a.breaking));
        if (!clips.length || feed.fallback) newsRefresh = performance.now() + 30000;
        var previous = new Map(newsItems.map(function (clip) { return [clip.id, clip]; }));
        var next = clips.map(function (clip) {
          return previous.get(clip.id) || buildNewsTile(clip);
        });

        var pins = $("sn-news-pins");
        previous.forEach(function (clip) { if (!next.includes(clip)) clip.pin.remove(); });
        next.forEach(function (clip) { if (!clip.pin.isConnected) pins.append(clip.pin); });
        newsItems = next;
      });
  }
  function clampNews(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }
  var movingPreview;
  function previewTile(clip) {
    if (movingPreview && movingPreview.parentNode === clip?.button) return;
    if (movingPreview) movingPreview.remove();
    movingPreview = null;
    if (!clip || clip.playlist || document.hidden) return;
    var frame = document.createElement("iframe");
    frame.className = "moving-preview";
    frame.tabIndex = -1;
    frame.setAttribute("aria-hidden","true");
    frame.allow = "autoplay; encrypted-media";
    frame.src = "https://www.youtube-nocookie.com/embed/" + clip.id + "?autoplay=1&mute=1&playsinline=1&controls=0";
    clip.button.append(frame);
    movingPreview = frame;
  }
  function layoutNewsTiles() {
    var occupied = [];
    var tileW = 82, tileH = 36, floor = view.h - drawerH - tileH - 8;
    var global = tierI === 2;
    var candidates = global
      ? [[-41, -53], [21, -25], [-103, -25], [24, -65], [-106, -65]]
      : [[20, -26], [-102, -26], [20, 14], [-102, 14], [20, -65], [-102, -65]];
    var focus = newsSelection || (globeRadar.target && globeRadar.target.clip);
    var tiles = focus && newsItems.includes(focus) ? [focus].concat(newsItems.filter(function (clip) { return clip !== focus; })) : newsItems;
    tiles.forEach(function (clip) {
      var anchor = clip.location;
      var point = cityOn && map ? map.latLngToContainerPoint([anchor.lat, anchor.lng]) : project(anchor.lat, anchor.lng, cam);
      clip.box = null;
      if (cityOn && point && floor >= 92) {
        point = { x: clampNews(point.x, 16, view.w - 16), y: clampNews(point.y, 88, view.h - drawerH - 16) };
      }
      if (global && anchor.kind !== "story" && !clip.topic) point = null;
      if (point && point.x >= 0 && point.x <= view.w && point.y >= 0 && point.y <= view.h - drawerH && floor >= 92 && occupied.length < (global ? 4 : 6)) {
        for (var i = 0; i < candidates.length; i++) {
          var x = clampNews(point.x + candidates[i][0], 8, view.w - tileW - 8);
          var y = clampNews(point.y + candidates[i][1], 54, floor);
          if (y < 50 || y > floor) continue;
          if (point.x >= x - 4 && point.x <= x + tileW + 4 && point.y >= y - 4 && point.y <= y + tileH + 4) continue;
          var box = { x: x, y: y, w: tileW, h: tileH };
          if (occupied.some(function (b) {
            return x < b.x + b.w + 5 && x + tileW + 5 > b.x && y < b.y + b.h + 5 && y + tileH + 5 > b.y;
          })) continue;
          clip.box = box;
          clip.pin.classList.toggle("radar-hit", !!globeRadar.target && globeRadar.target.clip === clip);
          occupied.push(box);
          var dx = clampNews(point.x, x, x + tileW) - point.x;
          var dy = clampNews(point.y, y, y + tileH) - point.y;
          clip.button.style.transform = "translate3d(" + x + "px," + y + "px,0)";
          clip.line.style.width = Math.hypot(dx, dy) + "px";
          clip.line.style.transform = "translate3d(" + point.x + "px," + point.y + "px,0) rotate(" + Math.atan2(dy, dx) + "rad)";
          break;
        }
      }
      clip.pin.hidden = !clip.box;
    });
    previewTile(tiles.find(clip => clip.box));

  }
  function tickNews(now) {
    var deck = $("sn-news");
    var show = (cityOn || tierI === 2 || tierI === 3) && !document.hidden;
    deck.hidden = !show;
    if (!show || !newsItems.length) previewTile(null);
    if (!show) {
      return;
    }
    if (now >= newsRegionCheck) {
      newsRegionCheck = now + 900;
      var global = tierI === 2;
      var center = cityOn && map ? map.getCenter() : null;
      var country = global ? "" : countryAt(center || pointUnder());
      var mode = global ? "global" : center ? "city:" + center.lat.toFixed(1) + "," + center.lng.toFixed(1) : "national:" + country;
      if (mode !== newsCountry || now >= newsRefresh) {
        if (mode !== newsCountry && newsCountry !== null) {
          newsItems = [];
          $("sn-news-pins").replaceChildren();
        }
        newsCountry = mode;
        deck.classList.toggle("news-global", global);
        newsRefresh = now + (global ? 90000 : 180000);
        loadNews(country, global, center);
      }
    }
    if (newsItems.length) layoutNewsTiles();
  }
  function bindNews() {
    setInterval(function () { if (!document.hidden && drawerNews) refreshNewsDesk(drawerNews); }, 60000);
    $("sn-news-close").addEventListener("click", function () {
      var tile = newsSelection && newsSelection.button;
      stopNews();
      setDrawerHeight(newsReturnHeight || collapsedDrawerH());
      if (tile?.isConnected) tile.focus({preventScroll:true});
    });
    fetchJson("/js/spacenet/assets/country-outlines.json?v=" + VER).then(function (rows) {
      if (!Array.isArray(rows)) return;
      eventOutlines = rows;
      if (globeRadar.target && globeRadar.target.clip) globeRadar.target.country = eventCountry(globeRadar.target);
    });
    fetchJson("/js/spacenet/assets/news-regions.json?v=" + VER).then(function (regions) {
      if (Array.isArray(regions)) newsRegions = regions;
    });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopNews();
    });
  }
  function loop(now) {
    resourceFrames++;
    var dt = Math.min(0.05, lastT ? (now - lastT) / 1000 : 0.016);
    lastT = now;
    if (!introT0) introT0 = now;
    if (intro && now - introT0 >= INTRO_MS) endIntro();
    stepCam(now, dt);
    if (!cityOn) drawGlobe(now);
    else pauseGlobeRadar(now);
    tickNews(now);
    if (skyOn) drawSky(now);
    maybeLayout();
    requestAnimationFrame(loop);
  }
  function nowMs() { return Date.now(); }
  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  function bindGlobe() {
    var pinchStepped = false;
    canvas.addEventListener("contextmenu", function (e) {
      e.preventDefault();
      if (e.button !== 2 || e.pointerType === "touch") return;
      var p = pos(e);
      var hit = globeHit(p.x, p.y, cam);
      if (hit) listAt(hit);
    });
    canvas.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      canvas.setPointerCapture(e.pointerId);
      gpsSeq++;
      var p = pos(e);
      pointers.set(e.pointerId, { x: p.x, y: p.y });
      vel.yaw = 0; vel.pitch = 0;
      if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        pinchStepped = false;
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
      }, 500);
    });
    canvas.addEventListener("pointermove", function (e) {
      var p = pos(e);
      if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: p.x, y: p.y });
      if (pointers.size === 2 && pinch) {
        var pts = Array.from(pointers.values());
        var d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        var ratio = d / pinch;
        if (!pinchStepped && (ratio > 1.12 || ratio < 1 / 1.12)) {
          pinchStepped = stepTier(ratio > 1 ? -1 : 1, (pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        }
        return;
      }
      if (!drag) return;
      var dx = p.x - drag.x, dy = p.y - drag.y;
      if (Math.hypot(dx, dy) > 6) {
        if (!drag.moved && fly) {
          fly = null;
          cam.dist = TIERS[tierI].dist;
          drag.yaw = cam.yaw;
          drag.pitch = cam.pitch;
        }
        drag.moved = true; intro = false;
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
      if (!d.moved || e.type === "pointercancel" || nowMs() - d.lastT > 100) {
        vel.yaw = 0; vel.pitch = 0;
      }
    }
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", up);
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      if (!e.deltaY) return;
      var now = performance.now();
      var dir = Math.sign(e.deltaY);
      if (now - wheelAt > 180 || dir !== wheelDirection) {
        wheelAmount = 0;
        wheelStepped = false;
      }
      wheelAt = now;
      wheelDirection = dir;
      if (wheelStepped) return;
      var unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? canvas.clientHeight : 1;
      wheelAmount += Math.abs(e.deltaY) * unit;
      if (wheelAmount < 18) return;
      var p = pos(e);
      wheelStepped = stepTier(dir, p.x, p.y);
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
    if (Date.now() < tierLock) return false;
    if (cityOn) {
      if (dir > 0) closeCity();
      else if (map) map.zoomIn();
      return true;
    }
    var next = Math.max(0, Math.min(4, tierI + (dir > 0 ? -1 : 1)));
    if (next === tierI) return false;
    intro = false;
    gpsSeq++;
    aim = pointUnder(sx, sy) || aim || here;
    if (!aim) return false;
    if (next === 4) {
      openCity(aim);
    } else {
      settleTier(next, aim);
      paintViewBtn();
    }
    return true;
  }
  function settleTier(i, pt) {
    tierI = i;
    tierLock = Date.now() + (i === 3 ? 750 : 360);

    vel.yaw = 0; vel.pitch = 0;
    var f = face(pt || aim);
    fly = {
      t0: performance.now(),
      ms: 360,
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
    paintViewBtn();
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
  var websiteProfiles = new Map(), enrichmentRunning = false;
  async function enrichVisibleShops() {
    if (enrichmentRunning) return;
    enrichmentRunning=true;
    try {
      while (cityOn && map) {
        var batch=shops.filter(shop=>shop.discovered && shop.website && map.getBounds().contains([shop.lat,shop.lng]) && !websiteProfiles.has(shop.id)).slice(0,2);
        if (!batch.length) break;
        await Promise.all(batch.map(async function(shop){
          websiteProfiles.set(shop.id,{});
          var data=await fetchJson("/api/vendor-menu?vendor="+encodeURIComponent(shop.id));
          if (!data?.registered) return;
          var profile={};
          if (data.items?.some(item=>!item.sample)) profile.menu=data.items;
          for (var key of ["logo","cover","messaging","phone"]) if(data[key]) profile[key]=data[key];
          websiteProfiles.set(shop.id,profile);
          var current=shops.find(row=>row.id===shop.id);
          if(current) Object.assign(current,profile);
          var marker=shopMarks.find(mark=>mark.options.vendorId===shop.id);
          if(current && marker && profile.logo) marker.setIcon(L.divIcon({className:"actor-pin",html:vendorLogo(current),iconSize:[32,32],iconAnchor:[16,16]}));
        }));
      }
    } finally {enrichmentRunning=false;}
  }
  var discoveredArea = "", discoveryUntil = 0;
  function discoverNearby(pt) {
    var area = pt.lat.toFixed(2) + "," + pt.lng.toFixed(2);
    if (area === discoveredArea && Date.now() < discoveryUntil) return;
    discoveredArea = area;
    discoveryUntil = Date.now() + 300000;
    var url = "/api/nearby-vendors?lat=" + pt.lat.toFixed(2) + "&lng=" + pt.lng.toFixed(2);
    var key = "sn:nearby:" + area;
    function display(rows) {
      if (area !== discoveredArea || !rows.length) return;
      shops = rows.map(row => Object.assign({},row,websiteProfiles.get(row.id),{discovered:true})).concat(shops.filter(row => !row.discovered && !rows.some(saved => saved.id === row.id)));
      if (cityOn) paintShopsOnMap();
      enrichVisibleShops();
      var listing = new URLSearchParams(location.search).get("listing");
      var selected = listing && shops.find(shop=>shop.id===listing);
      if (selected && !drawerProfile) openVendor(selected);
    }
    var cached;
    try { cached = JSON.parse(localStorage.getItem(key)); } catch {}
    if (cached?.vendors) display(cached.vendors);
    fetchJson(url + "&saved=1").then(async function(data) {
      if (area !== discoveredArea) return;
      if (data?.vendors?.length) display(data.vendors);
      if (data?.vendors?.length && (!cached || cached.checked > Date.now()-86400000)) {
        try { localStorage.setItem(key,JSON.stringify({vendors:data.vendors,checked:cached?.checked || Date.now()})); } catch {}
        return;
      }
      var fresh = await fetchJson(url);
      if (!fresh?.vendors?.length) { if (area === discoveredArea) discoveryUntil = Date.now()+30000; return; }
      var rows = Array.from(new Map([...(data?.vendors || []),...fresh.vendors].map(row => [row.id,row])).values());
      try { localStorage.setItem(key,JSON.stringify({vendors:rows,checked:Date.now()})); } catch {}
      display(rows);
    });
  }
  var streetLayer;
  function mapBrightness() {
    var value=Number(localStorage.getItem("sn:map-brightness") || 100);
    return Number.isFinite(value)?Math.max(35,Math.min(120,value)):100;
  }
  function applyMapTone(el) {
    if(!el)return;
    el.classList.toggle("dark-basemap",localStorage.getItem("sn:dark-map")==="1");
    el.style.setProperty("--map-brightness",mapBrightness()+"%");
  }
  function setStreetLayer() {
    if (!map) return;
    applyMapTone($("city"));
    if (streetLayer) return;
    streetLayer = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19, minZoom: 12,
      attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
    }).addTo(map);
  }
  function openCity(pt) {
    if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return;
    aim = { lat: pt.lat, lng: pt.lng };
    var el = $("city");
    if (!el || typeof L === "undefined") return;
    tierI = 4;
    cityOn = true;
    $("sn-news").hidden = true;
    stopNews();
    intro = false;
    fly = null;
    el.classList.add("on");
    if (!map) {
      map = L.map(el, { zoomControl: false, attributionControl: true, minZoom: 12, maxZoom: 19, scrollWheelZoom: true }).setView([pt.lat, pt.lng], 16);
      setStreetLayer();
      el.addEventListener("touchstart",e=>{if(e.touches.length>=2) routeFreeZoom=true;},{passive:true});
      map.on("click", function (e) {
        if (pickingDestination) nameDestination(e.latlng);
      });
      map.on("moveend", function () { if (cityOn) discoverNearby(map.getCenter()); });
      map.on("zoomend", function () {
        if (cityOn && !fittingRoute && map.getZoom() <= map.getMinZoom()) closeCity();
      });
      el.addEventListener("wheel", function (e) {
        if (!e.deltaY) return;
        wheelAt = performance.now();
        wheelDirection = Math.sign(e.deltaY);
        wheelStepped = true;
      }, { passive: true, capture: true });
      var hold = 0, holdPt = null;
      el.addEventListener("contextmenu", function (e) {
        e.preventDefault();
        if (!map || pickingDestination || e.button !== 2 || e.pointerType === "touch") return;
        var ll = map.mouseEventToLatLng(e);
        if (ll) listAt({ lat: ll.lat, lng: ll.lng });
      });
      el.addEventListener("pointerdown", function (e) {
        if (pickingDestination || e.button || !e.isPrimary || e.target.closest(".leaflet-interactive")) {
          cancelHold();
          return;
        }
        cancelHold();
        holdPt = e;
        hold = setTimeout(function () {
          if (!map || !holdPt) return;
          var ll = map.mouseEventToLatLng(holdPt);
          if (ll) listAt({ lat: ll.lat, lng: ll.lng });
        }, 500);
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
      youMark.on("click", function (e) {
        if (pickingDestination) nameDestination(e.latlng);
        else if(trackingAccount===checkoutAccount() && trackedOrders.some(o=>["paid","accepted"].includes(o.state))) openTrackedOrder(trackedOrders.find(o=>["paid","accepted"].includes(o.state)).id);
        else if (!openOwnProfile() && window.SNAuth) SNAuth.open();
      });
    }
    paintShopsOnMap();
    paintActorsOnMap();
    discoverNearby(pt);
    paintCityRadar();
    paintViewBtn();
    setTimeout(function () { if (map) map.invalidateSize(); paintCityRadar(); }, 80);
  }
  function closeCity() {
    if (!cityOn) return;
    if (pickingDestination) { endDestinationPick(); resumeCheckout(); }
    var center = map.getCenter();
    aim = { lat: center.lat, lng: center.lng };
    clearCityRadar();
    $("city").classList.remove("on");
    cityOn = false;
    var f = face(aim);
    cam.yaw = f.yaw;
    cam.pitch = f.pitch;
    cam.dist = TIERS[3].dist;
    tierI = 3;
    tierLock = Date.now() + 450;

    paintViewBtn();
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
  var drawerPlacement = "";
  var drawerBeforePlacement = null;
  function showDrawerPlacement(title, content) {
    if (newsSelection) stopNews();
    drawerAI = false;
    drawerHome = false;
    drawerNews = "";
    $("logo").setAttribute("aria-expanded", "false");
    if (!drawerPlacement) drawerBeforePlacement = { height: drawerH, scroll: $("sheet").scrollTop };
    drawerPlacement = '<section class="drawer-profile drawer-placement">' +
      '<header><h2>' + escHtml(title) + '</h2><button class="sheet-x" type="button" data-act="placement-close" aria-label="Close map actions">×</button></header>' +
      content + '</section>';
    if ($("sn-sheet").classList.contains("on")) closeSheet();
    else paintDrawerContent();
    $("sheet").scrollTop = 0;
    setDrawerHeight(Math.max(offerDrawerH(), drawerH));
  }
  function clearDrawerPlacement() {
    drawerPlacement = "";
    drawerBeforePlacement = null;
    if (map && plotMark) {
      map.removeLayer(plotMark);
      plotMark = null;
    }
  }
  function dismissDrawerPlacement() {
    var previous = drawerBeforePlacement;
    clearDrawerPlacement();
    paintDrawerContent();
    setDrawerHeight(previous ? previous.height : collapsedDrawerH());
    $("sheet").scrollTop = previous ? previous.scroll : 0;
  }
  function listAt(pt) {
    if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return;
    listPt = { lat: pt.lat, lng: pt.lng };
    listAlt = altitudeFromDist(cam.dist);
    if (!cityOn) openCity(pt);
    showDrawerPlacement("Place a pin", Object.keys(testRoles).map(function(role) {
      return '<button type="button" class="sheet-go" data-act="insert-actor" data-role="'+role+'">'+actorIcons[role]+' List '+testRoles[role].toLowerCase()+'</button>';
    }).join(" "));
  }
  var testRoles = { vendor: "Vendor", driver: "Driver", client: "Client", delivery_services: "Delivery service", post: "News" };
  var actorIcons = { vendor: "🏪", delivery_services: "📦", driver: "🚚", client: "🏠", post: "📰" };
  var testOrder = null;
  var deliverySelection = new Set();
  var testOrderQueue = [];
  function placeTestPin(role, current) {
    if (!Object.hasOwn(testRoles, role)) role = "vendor";
    var pins = loadTestPins();
    var pin = current && pins.find(row => row.id === current.id);
    if (!pin) {
      if (!listPt) return;
      pin = { id: "test-" + crypto.randomUUID(), lat:listPt.lat, lng:listPt.lng, test:true, quick:true };
      pins.unshift(pin);
    }
    if (!pin.name || pin.name === testRoles[pin.role]) pin.name = testRoles[role];
    pin.role = role;
    pin.accountId = checkoutAccount() || undefined;
    if (isVendorRole(role) && !pin.menu) pin.menu = role === "vendor" ? starterProducts.map(item => ({...item})) : [{name:"City delivery",price:3}];
    if (!updateTestPins(pins,true)) return;
    localStorage.setItem("sn:pin-role",role);
    openActorSheet(pin);
  }
  function publishQuickVendor() {
    if (!vendor?.quick || !signed()) return;
    persistListing({id:vendor.id,kind:"shop",name:vendor.name,lat:vendor.lat,lng:vendor.lng,
      how:"admin-put",shop:{quickCheckout:true,menu:vendor.menu || []}});
  }
  function loadTestPins() {
    try { return JSON.parse(localStorage.getItem("sn:quick-pins") || "[]"); }
    catch { return []; }
  }
  function updateTestPins(pins, keepSheet) {
    try {
      localStorage.setItem("sn:quick-pins", JSON.stringify(pins));
    } catch (e) {
      if (drawerPlacement) showDrawerPlacement("Test pins", '<p class="note">This browser could not save the pins.</p>');
      else openSheet("Test pins", '<p class="note">This browser could not save the pins.</p>');
      return;
    }
    if (map && plotMark) {
      map.removeLayer(plotMark);
      plotMark = null;
    }
    paintActorsOnMap();
    if (!keepSheet) closeSheet();
    return true;
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
    showDrawerPlacement("NAME · " + label,
      '<p class="note">' + (role === "delivery_services"
        ? "Same UX as restaurant vendors — sells delivery, not products. DoorDash/DH list as this type."
        : ("Name this " + role + " at " + listPt.lat.toFixed(5) + ", " + listPt.lng.toFixed(5))) + "</p>" +
      '<input id="sn-actor-name" class="field" placeholder="' + ph + '" />' +
      (isVendorRole(role) ? '<input id="sn-actor-gbp" class="field" placeholder="Google Business Profile URL or place id" />' : "") +
      '<button type="button" class="sheet-go primary" data-act="save-actor" data-role="' + role + '">SAVE · VERIFY</button>' +
      '<button type="button" class="sheet-go" data-act="placement-close">CANCEL</button>');
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
      accountId: checkoutAccount(),
      owner: true,
      t: Date.now()
    };
    var ok = verifyActor(actor);
    if (!ok.ok) {
      showDrawerPlacement("VERIFY · " + (role === "delivery_services" ? "DELIVERY SERVICES" : role.toUpperCase()),
        '<p class="note">' + ok.msg + "</p>" +
        (isVendorRole(role) ? '<input id="sn-actor-gbp" class="field" placeholder="Google Business Profile URL" value="' + String(gbpVal).replace(/"/g, "") + '" />' : "") +
        '<button type="button" class="sheet-go primary" data-act="retry-verify" data-role="' + role + '" data-name="' + name.replace(/"/g, "") + '">RETRY VERIFY</button>' +
        '<button type="button" class="sheet-go" data-act="placement-close">CANCEL</button>');
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
      shops = uniqPlaces(shops);
    }
    persistListing({ id: actor.id, kind: role, name: actor.name, lat: actor.lat, lng: actor.lng, gbp: actor.gbp, vendor_type: actor.vendor_type });
    paintActorsOnMap();
    paintShopsOnMap();
    clearDrawerPlacement();
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
  var dispatchFix;
  function ensureDriverGps() {
    if (gpsWatchId || !navigator.geolocation) return;
    try {
      gpsWatchId = navigator.geolocation.watchPosition(function (pos) {
        if (!pos || !pos.coords) return;
        here = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        window.__SN_HERE = here;
        var firstFix=!dispatchFix;
        dispatchFix = {lat:here.lat,lng:here.lng};
        if(firstFix && driverAvailable()) refreshDispatch();
        if (youMark && map) try { youMark.setLatLng([here.lat, here.lng]); } catch (e) {}
      }, function () { dispatchFix=null; }, { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 });
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
        return;
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
  var testVendorBrands = [
    { logo: "pizzeria", photo: "pizza" }, { logo: "cafe", photo: "coffee" }, { logo: "taproom", photo: "beer" }
  ];
  function vendorBrand(row) {
    var name = row.name || "Vendor";
    var hash = Array.from(row.id || name).reduce(function (n, ch) { return (n * 31 + ch.codePointAt(0)) >>> 0; }, 0);
    var seed = row.brandIndex == null ? hash : row.brandIndex;
    var preset = testVendorBrands[seed % testVendorBrands.length];
    if (row.test) return {
      logo: row.logo || "/js/spacenet/assets/vendors/" + preset.logo + ".webp",
      photo: "/js/spacenet/assets/products/" + preset.photo + ".webp",
      phone: row.phone == null ? "+1 202-555-01" + String(seed % 100).padStart(2, "0") : row.phone
    };
    var logo = row.logo || row.photo || row.image || "";
    return { logo: /^https:\/\//i.test(logo) ? logo : "", phone: row.phone || "", hash: hash };
  }
  function vendorLogo(row) {
    var brand = vendorBrand(row);
    if (brand.logo && /^(https:\/\/|\/js\/spacenet\/assets\/|data:image\/jpeg;base64,)/.test(brand.logo)) {
      return '<img class="vendor-logo" src="' + escHtml(brand.logo) + '" alt="">';
    }
    var initials = (row.name || "Vendor").trim().split(/\s+/).slice(0, 2).map(function (word) { return Array.from(word)[0] || ""; }).join("");
    return '<span class="vendor-logo vendor-initials" style="--vendor-hue:' + (brand.hash % 360) + '">' + escHtml(initials.toUpperCase()) + '</span>';
  }
  function vendorContact(row) {
    var phone = vendorBrand(row).phone;
    return '<p class="profile-contact">' +
      (phone ? '<a href="tel:' + escHtml(phone.replace(/[^+\d]/g, "")) + '">' + escHtml(phone) + '</a>' : 'Phone unavailable') +
      (row.email && /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(row.email) ? ' · <a href="mailto:'+escHtml(row.email)+'">'+escHtml(row.email)+'</a>' : '') +
      (row.messaging && /^https:\/\/(wa\.me|api\.whatsapp\.com|m\.me|t\.me)\//i.test(row.messaging) ? ' · <a target="_blank" rel="noopener" href="'+escHtml(row.messaging)+'">Website messaging</a>' : '') +
      (row.streetAddress ? ' · '+escHtml(row.streetAddress) : '') + (row.hours ? ' · '+escHtml(row.hours) : '') +
      (row.website && /^https?:\/\//i.test(row.website) ? ' · <a href="'+escHtml(row.website)+'" target="_blank" rel="noopener">Website</a>' : '') +
      (row.test && row.phone == null ? ' <small>Test number</small>' : '') + '</p>';
  }
  function editTestVendorProfile() {
    var current = drawerProfile && drawerProfile.actor;
    if (!current || !current.test) return;
    var isVendor = current.role === "vendor";
    openSheet(isVendor ? "Vendor profile" : "Edit profile", '<form id="test-vendor-profile" class="test-form">' +
      '<label>' + (isVendor ? 'Vendor name' : 'Name') + '<input class="field" required maxlength="80" name="name" value="' + escHtml(current.name) + '"></label>' +
      (isVendor ? '<label>Contact number<input class="field" type="tel" maxlength="35" name="phone" value="' + escHtml(vendorBrand(current).phone) + '"></label>' : '') +
      '<label>' + (isVendor ? 'Logo' : 'Profile picture') + '<input class="field" type="file" accept="image/*" name="logo"></label>' +
      '<label>Cover photo<input class="field" type="file" accept="image/*" name="cover"></label>' +
      '<p class="note" role="alert"></p><button class="sheet-go primary">Save profile</button> ' +
      '<button type="button" class="sheet-go" data-act="close">Back</button></form>');
    $("test-vendor-profile").addEventListener("submit", async function (e) {
      e.preventDefault();
      var form = e.currentTarget;
      var data = new FormData(form);
      var button = form.querySelector("button");
      var name = data.get("name").trim(), phone = String(data.get("phone") || "").trim();
      if (!name || (phone && !/^\+?[0-9 ()-]{7,35}$/.test(phone))) {
        form.querySelector('[role="alert"]').textContent = "Enter a vendor name and a valid contact number.";
        return;
      }
      button.disabled = true;
      try {
        var photos = await Promise.all([menuPhoto(data.get("logo")), menuPhoto(data.get("cover"))]);
        if (!form.isConnected) return;
        var pins = loadTestPins(), pin = pins.find(function (row) { return row.id === current.id; });
        if (!pin) return;
        pin.name = name;
        if (isVendor && phone !== vendorBrand(current).phone) pin.phone = phone;
        if (photos[0]) pin[isVendor ? "logo" : "profile"] = photos[0];
        if (photos[1]) pin.cover = photos[1];
        if (updateTestPins(pins, true)) {
          if (isVendor && vendor && profileId(vendor) === profileId(pin)) { vendor = pin; renderVendorShop(); }
          else openActorSheet(pin);
        }
      } catch (error) {
        form.querySelector('[role="alert"]').textContent = error.message;
      } finally {
        button.disabled = false;
      }
    });
  }
  function paintActorsOnMap() {
    if (!map || typeof L === "undefined") return;
    actorMarks.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
    actorMarks = [];
    var rows = loadActors().filter(function (actor) {
      return !isVendorRole(actor.role) || !shopMarks.some(function (mark) { return mark.options.vendorId === actor.id; });
    });
    rows.concat(loadTestPins(), savedDeliveryLocations()).forEach(function (a) {
      if (a && a.role === "client" && a.accountId && a.accountId !== checkoutAccount()) return;
      if (!a || !isFinite(a.lat) || !isFinite(a.lng)) return;
      var icon = isVendorRole(a.role) ? vendorLogo(a) : '<span aria-hidden="true">' + (actorIcons[a.role] || actorIcons.vendor) + '</span>';
      var title = (testRoles[a.role] || "Delivery service") + " · " + a.name;
      var mark = L.marker([a.lat, a.lng], {
        title: title, alt: title,
        icon: L.divIcon({
          className: "actor-pin" + (a.test ? " test-pin" : ""),
          html: icon,
          iconSize: [32, 32], iconAnchor: [16, 16]
        })
      });
      mark.bindTooltip(function () {
        var label = document.createElement("span");
        label.textContent = title;
        return label;
      }, { direction: "top" });
      mark.on("click", function (e) {
        if (pickingDestination) { nameDestination(e.latlng); return; }
        if (e && e.originalEvent) L.DomEvent.stop(e.originalEvent);
        openActorSheet(a);
      });
      mark.addTo(map);
      mark.options.notificationKey=a.accountId || a.id;
      actorMarks.push(mark);
      paintNoticePin(mark);
    });
  }
  var drawerProfile = null;
  var nearbyPosts = [];
  var postsArea = "", postsFreshUntil = 0, postsRequest = 0;
  function profileId(actor) {
    return String(actor.id || (actor.name + ":" + actor.lat + "," + actor.lng));
  }
  function profileRole(actor) {
    if (actor.role === "post") return "News";
    if (actor.role === "delivery_services" || actor.kind === "delivery_services") return "Delivery service";
    if (actor.role === "driver" || actor.kind === "driver") return "Driver";
    if (actor.role === "client" || actor.kind === "drop" || actor.savedDelivery) return "Client";
    return "Vendor";
  }
  function profileImage(value) {
    return typeof value === "string" && /^(https:\/\/|\/js\/spacenet\/assets\/|data:image\/jpeg;base64,)/i.test(value) ? value : "";
  }
  function profileRows(key, actor) {
    try {
      var rows = JSON.parse(localStorage.getItem(key) || "[]");
      return Array.isArray(rows) ? rows.filter(function (row) { return row && row.profile === profileId(actor); }) : [];
    } catch (e) { return []; }
  }
  function profileUpdates(actor) {
    var remote = nearbyPosts.filter(function (post) {
      return String(post.peer || "") === profileId(actor) || (actor.peer && post.peer === actor.peer);
    });
    var posts = (Array.isArray(actor.posts) ? actor.posts : []).concat(remote, profileRows("sn:profile-posts", actor));
    return posts.filter(function (post) { return post && (post.text || post.note || post.title); })
      .sort(function (a, b) { return new Date(b.t || 0) - new Date(a.t || 0); }).slice(0, 12);
  }
  var profileOrderState = null;
  function loadProfileOrders(actor, history, offset) {
    var token = authToken();
    if (!token || (!actor.self && !profileIsVendor(actor))) return;
    var state = { id: profileId(actor), token: token, pending: true, history: history, offset: offset || 0 };
    profileOrderState = state;
    paintDrawerContent();
    var params = new URLSearchParams({ offset: state.offset });
    if (!actor.self) params.set("vendor", state.id);
    fetchJson("/api/profile-orders?" + params, { headers: { Authorization: "Bearer " + token } }).then(function (data) {
      if (profileOrderState !== state || token !== authToken()) return;
      state.pending = false;
      state.data = data && Array.isArray(data.items) ? data : null;
      paintDrawerContent();
    });
  }
  function profileOrdersFor(actor) {
    var state = profileOrderState;
    return state && state.id === profileId(actor) && state.token === authToken() ? state : null;
  }
  function orderHistoryMarkup(actor, state) {
    var data = state.data;
    return '<article class="drawer-profile"><section class="profile-section">' +
      '<button type="button" class="sheet-go" data-act="profile-main" aria-label="Back to profile">← Back</button>' +
      '<h2>' + escHtml(actor.name) + ' · Order history</h2>' +
      (state.pending ? '<p class="note">Loading orders…</p>' : !data ? '<p class="note">Order history unavailable.</p>'
        : data.items.map(function (row) {
          return '<div class="profile-entry"><b>' + escHtml(row.vendor_name || "Order") +
            '</b><p>' + escHtml(row.status) + (row.test ? ' · Test' : '') + '</p><time>' +
            escHtml(transactionDate(row.created_at)) + '</time></div>';
        }).join("") || '<p class="note">No orders yet.</p>') +
      (state.offset ? '<button type="button" class="sheet-go" data-act="profile-page" data-i="' + Math.max(0, state.offset - 30) + '">Previous</button>' : '') +
      (data && data.count > state.offset + 30 ? '<button type="button" class="sheet-go" data-act="profile-page" data-i="' + (state.offset + 30) + '">Next</button>' : '') +
      '</section></article>';
  }
  function openOwnProfile() {
    var person = checkoutAccount() && SNAuth.user();
    if (!person) {
      showDrawerProfile({id:"guest",self:true,role:"client",name:"Your account"},
        '<button type="button" class="sheet-go primary" data-act="google-login">Sign in with Google</button>');
      return true;
    }
    var addresses = deliveryLocations().filter(function (pin) { return pin.savedDelivery || pin.accountId === checkoutAccount(); });
    var prefs = routePreferences();
    var providerSettings = (person.roles || []).some(role => ["owner","super_admin","admin"].includes(role))
      ? '<h3>Free AI providers</h3><select id="sn-provider"><option value="groq">Groq</option><option value="gemini">Gemini</option><option value="openrouter">OpenRouter Free</option></select>' +
        '<input class="field" id="sn-provider-key" type="password" autocomplete="off" placeholder="Provider API key">' +
        '<button class="sheet-go" data-act="save-provider">Save provider key</button><p id="sn-provider-status" role="status"></p>' : "";
    var menu = trackingMarkup() + userRoleMarkup() + (vendor && cartSubtotal() ? '<button class="sheet-go" data-act="checkout-return">Return to checkout</button> <button class="sheet-go" data-act="checkout-new-client">Add delivery address</button>' : '') + providerSettings + '<p>Google account · ' + (person.googleLinked ? 'Linked' : 'Unconfirmed') + '</p><p>Phone · ' +
      (person.phoneConfirmed ? 'Verified' : 'Unconfirmed') + '</p>' +
      '<label>Phone with country code<input id="sn-phone-number" type="tel" class="field" value="' + escHtml(person.phone || "") + '"></label>' +
      '<label>WhatsApp verification code<input id="sn-phone-code" inputmode="numeric" class="field"></label>' +
      '<button class="sheet-go" data-act="verify-phone">Send or confirm WhatsApp code</button><p id="sn-phone-result" role="status"></p>' + '<h3>Route preferences</h3>' + Object.keys(routeOptions).map(function (key) {
      return '<button class="sheet-go" data-act="route-pref" data-id="' + key + '" aria-pressed="' + !!prefs[key] + '">' +
        routeOptions[key] + ' · ' + (prefs[key] ? 'On' : 'Off') + '</button>';
    }).join("") + '<button class="sheet-go" data-act="profile-transactions">Transactions</button><h3>Delivery addresses</h3><p class="note">' + escHtml(person.address || "") + '</p>' +
      addresses.map(function (pin) {
        return '<p><button type="button" class="sheet-go" data-act="profile-address" data-id="' +
          escHtml(pin.id) + '">' + escHtml(pin.name) + ' · Show on map</button></p>';
      }).join("") +
      '<button type="button" class="sheet-go" data-act="home-account">Manage account</button>';
    showDrawerProfile({ id: person.id, self: true, role: "client", name: person.name || "Your profile",
      photo: person.photo, cover: person.cover, phone: person.phone }, menu);
    return true;
  }
  function profileMessages(actor) {
    var account = checkoutAccount();
    return account ? loadAccountRows("profile-messages", account).filter(function (row) { return row.profile === profileId(actor); }).slice(0, 10) : [];
  }
  function profileIsVendor(actor) {
    var role = profileRole(actor);
    return role === "Vendor" || role === "Delivery service";
  }
  var ownerProfileInfo=null;
  function isRoleOwner() {return window.SNAuth?.user()?.creator===true;}
  function ownerRolePanel(actor) {
    if(actor.self || !isRoleOwner()) return "";
    var info=ownerProfileInfo;
    if(!info || info.actor!==profileId(actor) || info.viewer!==checkoutAccount()) return "";
    if(!info.data?.linked) return '<p class="note">'+(info.data?.ok?"No linked user account.":"Account information unavailable.")+'</p>';
    var data=info.data;
    return '<section class="profile-section"><h3>User account</h3><p>'+[data.name,data.email,data.phone,data.id].filter(Boolean).map(escHtml).join(' · ')+'</p><div class="home-roles">'+Object.keys(homeRoleLabels).map(role=>
      '<button class="sheet-go" data-act="owner-role" data-role="'+role+'" aria-pressed="'+!!data.switches[role]+'">'+homeRoleLabels[role]+' · '+(data.switches[role]?'On':'Off')+'</button>').join('')+'</div></section>';
  }
  async function fetchOwnerProfile(actor,role,enabled) {
    var viewer=checkoutAccount(), key=profileId(actor);
    if(!viewer || !isRoleOwner() || actor.self) return;
    var target=actor.discovered ? {vendor:key} : {account:actor.accountId || actor.id};
    var data=await listingAction({...target,kind:role?"owner-role-set":"owner-role-get",role,enabled});
    if(viewer!==checkoutAccount() || !isRoleOwner() || drawerProfile?.actor!==actor) return;
    ownerProfileInfo={viewer,actor:key,data};paintDrawerContent();
  }
  function profileMarkup(profile) {
    var actor = profile.actor, role = profileRole(actor);
    var isVendor = profileIsVendor(actor);
    var avatar = profileImage((isVendor && actor.logo) || actor.profile || actor.avatar || actor.avatar_url || actor.photo);
    var cover = profileImage(actor.cover || (actor.test && isVendor ? vendorBrand(actor).photo : ""));
    var state = profileOrdersFor(actor);
    if (state && state.history) return orderHistoryMarkup(actor, state);
    var posts = profileUpdates(actor);
    var stats = state && state.data;
    return '<article class="drawer-profile">' +
      '<div class="profile-cover" data-role="' + escHtml(role) + '">' +
        (cover ? '<img src="' + escHtml(cover) + '" alt="">' : '') +
        '<button type="button" class="sheet-x" data-act="profile-close" aria-label="Close profile">×</button>' +
      '<div class="profile-identity"><div class="profile-avatar">' +
        (avatar ? '<img src="' + escHtml(avatar) + '" alt="">' : isVendor ? vendorLogo(actor) :
          '<span aria-hidden="true">' + (actorIcons[actor.role] || "🏠") + '</span>') +
      '</div><div><h2>' + escHtml(actor.name || role) + '</h2><p class="note">' + escHtml(role) +
      (actor.test ? ' · Test profile' : actor.verified ? ' · Verified' : '') + '</p>' +
      (isVendor ? vendorContact(actor) : actor.self && actor.phone ? '<p class="note">' + escHtml(actor.phone) + '</p>' : '') + '</div></div></div>' +
      ownerRolePanel(actor) +
      (actor.quick ? '<nav aria-label="Pin type">' + Object.keys(testRoles).map(function (key) {
        return '<button class="sheet-go" data-act="quick-role" data-role="' + key + '" aria-pressed="' + (actor.role === key) + '">' + actorIcons[key] + ' ' + testRoles[key] + '</button>';
      }).join("") + '</nav>' : '') +
      (stats ? '<section class="profile-section"><p class="note">Orders today · <b>' + stats.today + '</b></p>' +
        (actor.self ? '<button type="button" class="sheet-go" data-act="profile-orders">Order history</button>' : '') + '</section>' : '') +
      (actor.self ? '<section class="profile-section">' + profile.menu + '</section></article>' : '') +
      (actor.self ? '' :
       '<nav class="profile-arrows"><button data-act="scroll-profile" data-id="vendor-menu" aria-label="Up to menu">↑ Menu</button>' +
        (stats ? '<button data-act="scroll-profile" data-id="vendor-pending">↓ Orders</button>' : '') +
        '<button data-act="scroll-profile" data-id="profile-messaging">↓ Messages</button></nav><section class="profile-section" id="vendor-menu"><h3>Menu</h3>' +
        (stats && actor.discovered ? '<button class="sheet-go" data-act="review-listing">Review listing submissions</button>' : '') +
        ((stats?.can_manage_menu || actor.canEdit && actor.editorAccount===checkoutAccount()) ? '<button type="button" class="sheet-go" data-act="import-test-menu">Import menu</button>' : '') +
        profile.menu + '</section>' + (stats ? pendingMarkup(actor) : '') +
      '<section class="profile-section"><h3>Posts</h3>' +
      posts.map(function (post) {
        return '<div class="profile-entry"><p>' + escHtml(post.text || post.note || post.title) + '</p>' +
          (post.t && Number.isFinite(new Date(post.t).getTime()) ? '<time>' + escHtml(transactionDate(post.t)) + '</time>' : '') + '</div>';
      }).join("") +
      (posts.length ? '' : '<p class="note">No posts yet.</p>') +
      (actor.test ? '<form data-profile-action="post"><label class="profile-label">New test post<textarea class="field" name="text" maxlength="500" required></textarea></label>' +
        '<button type="submit" class="sheet-go">Post</button><p class="note" role="status"></p></form>' : '') + '</section>' +
      '<section class="profile-section" id="profile-messaging"><h3>Messaging</h3>' +
      (stats?.can_manage_menu ? '<button class="sheet-go" data-act="order-inbox">Order messages</button>' : '') +
      ((noticeAccount===checkoutAccount() && privateNotices?.peer===profileId(actor) && privateNotices.thread?.length ?
        privateNotices.thread.map(m=>({text:(m.outgoing?"You · ":"Received · ")+m.body,created_at:m.created_at})) : profileMessages(actor)).map(function (entry) {
        return '<div class="profile-entry"><p>' + escHtml(entry.text) + '</p><time>' +
          escHtml(transactionDate(entry.created_at)) + '</time></div>';
      }).join("") || '<p class="note">No messages yet.</p>') +
      (checkoutAccount()
        ? '<form data-profile-action="message"><label>To<select class="field" name="team"><option value="">This profile</option><option value="ambassador">Ambassadors</option><option value="admin">Administrators</option><option value="owner">Owners</option></select></label><label class="profile-label">Message<textarea class="field" name="text" maxlength="1000" required></textarea></label>' +
          '<button type="submit" class="sheet-go primary">Send message</button><p class="note" role="status"></p></form>'
        : '<button type="button" class="sheet-go" data-act="profile-sign-in">Sign in to message</button>') + '</section></article>');
  }
  function showDrawerProfile(actor, menu) {
    if (newsSelection) stopNews();
    drawerAI = false;
    drawerHome = false;
    drawerNews = "";
    $("logo").setAttribute("aria-expanded", "false");
    var changed = !drawerProfile || profileId(actor) !== profileId(drawerProfile.actor);
    clearDrawerPlacement();
    drawerProfile = { actor: actor, menu: menu };
    if (changed || ownerProfileInfo?.actor!==profileId(actor)) fetchOwnerProfile(actor);
    if ($("sn-sheet").classList.contains("on")) closeSheet();
    else paintDrawerContent();
    var orders = profileOrdersFor(actor);
    if (changed || orders && orders.history) {
      profileOrderState = null;
      $("sheet").scrollTop = 0;
      loadProfileOrders(actor, false, 0);
      if (checkoutAccount()) vendorInbox(undefined,true);
    }
    if (changed || drawerH <= collapsedDrawerH()) setDrawerHeight(offerDrawerH());
    loadProfilePosts(actor);
  }
  function loadProfilePosts(actor) {
    if (actor.test || actor.savedDelivery || !Number.isFinite(actor.lat) || !Number.isFinite(actor.lng)) return;
    var area = actor.lat.toFixed(2) + "," + actor.lng.toFixed(2);
    if (postsArea === area && Date.now() < postsFreshUntil) return;
    if (postsArea !== area) nearbyPosts = [];
    postsArea = area;
    postsFreshUntil = Date.now() + 60000;
    var request = ++postsRequest;
    fetchJson("/api/space?lat=" + actor.lat.toFixed(2) + "&lng=" + actor.lng.toFixed(2)).then(function (data) {
      if (request !== postsRequest) return;
      nearbyPosts = data && Array.isArray(data.posts) ? data.posts : [];
      if (!data || data.ok === false) postsFreshUntil = 0;
      paintDrawerContent();
    });
  }
  async function submitProfileEntry(event) {
    var form = event.target;
    if (!form.matches("[data-profile-action]") || !drawerProfile) return;
    event.preventDefault();
    var text = form.elements.text.value.trim();
    if (!text) return;
    var actor = drawerProfile.actor;
    var entry = { profile: profileId(actor), text: text, created_at: new Date().toISOString() };
    var saved;
    if (form.dataset.profileAction === "post" && actor.test) {
      entry.t = Date.now();
      try {
        var posts = JSON.parse(localStorage.getItem("sn:profile-posts") || "[]");
        localStorage.setItem("sn:profile-posts", JSON.stringify([entry].concat(posts).slice(0, 200)));
        saved = true;
      } catch (e) { saved = false; }
    } else if (form.dataset.profileAction === "message" && checkoutAccount()) {
      var account = checkoutAccount();
      var button=form.querySelector("button");
      if(button.disabled) return;
      button.disabled=true;
      var team=form.elements.team.value;
      var result=await listingAction({kind:"message",team:team||null,vendor:!team && profileIsVendor(actor)?profileId(actor):null,recipient:actor.accountId || actor.id,text:text});
      button.disabled=false;
      if(account!==checkoutAccount()) return;
      if(!result?.ok){form.querySelector('[role="status"]').textContent="Could not deliver. The recipient must have a linked account.";return;}
      saved = writeAccountRows("profile-messages", account, [entry].concat(loadAccountRows("profile-messages", account)).slice(0, 200));
    }
    if (saved) { form.reset(); paintDrawerContent(); }
    else form.querySelector('[role="status"]').textContent = "This entry could not be saved.";
  }
  function openActorSheet(a) {
    if (!a) return;
    var role = profileRole(a);
    if (role === "Vendor" || role === "Delivery service") { openVendor(a); return; }
    var id = escHtml(a.id);
    var menu = role === "News" ? '<input class="field" id="quick-headline" aria-label="Headline" placeholder="Headline" maxlength="80"><button class="sheet-go" data-act="quick-publish">Publish news</button>' : role === "Client"
      ? '<button type="button" class="sheet-go primary" data-act="test-client" data-id="' + id + '">Deliver here</button>'
      : a.test
        ? (testOrder && !testOrder.accepted && testOrder.drivers.some(function (d) { return d.id === a.id; })
          ? '<button type="button" class="sheet-go primary" data-act="test-driver" data-id="' + id + '">Show test offer</button>'
          : '<p class="note">No offer for this driver.</p>')
        : '<button type="button" class="sheet-go primary" data-act="start-tx" data-id="' + id + '">Start delivery</button>';
    if (a.quick && a.role==="driver" && checkoutAccount() && (!a.accountId || a.accountId===checkoutAccount())) menu = '<button class="sheet-go" data-act="driver-pin" data-id="'+id+'">Use this driver pin for offers</button>' + menu;
    showDrawerProfile(a, menu + (a.test ? '<button type="button" class="sheet-go" data-act="edit-test-vendor">Edit profile</button>' + removeTestPinButton(a) : ""));
  }
  function findActor(id) {
    var rows = loadActors();
    return rows.filter(function (a) { return String(a.id) === String(id); })[0] || null;
  }
  function goCityFromGlobe() {
    stepTier(cityOn ? 1 : -1);
  }
  function paintViewBtn() {
    syncAmbient();
    var inBtn = $("sn-view"), outBtn = $("sn-view-out");
    var level = $("sn-level");
    if (level) {
      level.hidden = tierI !== 3 || !!pendingOffer;
      level.textContent = "National";
    }
    if (inBtn) inBtn.textContent = "Zoom in · " + (cityOn ? "Streets" : TIERS[tierI + 1].name);
    if (outBtn) {
      outBtn.disabled = tierI === 0;
      outBtn.textContent = tierI > 0 ? "Zoom out · " + TIERS[tierI - 1].name : "Zoom out";
    }
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
  async function clearSpaceNetCache() {
    if (!window.caches || !caches.keys) return 0;
    var keys = (await caches.keys()).filter(function (key) { return /^sn-shell-/.test(key); });
    await Promise.all(keys.map(function (key) { return caches.delete(key); }));
    return keys.length;
  }
  async function hardReset() {
    homeStatus = "Updating SpaceNet…";
    if (drawerHome) paintDrawerContent();
    try { await clearSpaceNetCache(); } catch (e) {}
    try {
      if (navigator.serviceWorker) {
        var regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.filter(function (reg) {
          return [reg.active, reg.waiting, reg.installing].some(function (worker) {
            return worker && new URL(worker.scriptURL).pathname === "/sw.js";
          });
        }).map(function (reg) { return reg.unregister(); }));
      }
    } catch (e) {}
    var updated = new URL(location.href);
    updated.searchParams.set("v", homeVersion || VER);
    updated.searchParams.set("t", Date.now());
    location.replace(updated.href);
  }
  function openCompany() {
    openSheet("ASTRANOV",
      '<p class="note">Astranov Cybernetics Architecture. Founded 12/04/2026. SpaceNet is the live surface.</p>' +
      '<a class="sheet-go primary" href="https://astranov.eu">astranov.eu</a>');
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
  var sound = { enabled: false, news: 65, offers: 65, ambient: 15, helper: 65 };
  var audioContext, ambientGain, ambientFilter, ambientBand = "";
  try { Object.assign(sound, JSON.parse(localStorage.getItem("sn:sound")) || {}); } catch (e) {}
  function soundLevel(track) {
    return sound.enabled ? Math.max(0, Math.min(100, Number(sound[track]) || 0)) / 100 : 0;
  }
  function syncAmbient() {
    if (!audioContext || !ambientGain) return;
    var band = cityOn ? "city" : tierI === 3 ? "national" : "space";
    if (ambientBand !== band) {
      ambientBand = band;
      ambientFilter.frequency.setTargetAtTime({ space: 105, national: 240, city: 520 }[band], audioContext.currentTime, .4);
    }
    ambientGain.gain.setTargetAtTime(document.hidden ? 0 : soundLevel("ambient") * .28, audioContext.currentTime, .16);
  }
  function unlockAudio() {
    var Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return null;
    if (!audioContext) {
      audioContext = new Audio();
      var buffer = audioContext.createBuffer(1, audioContext.sampleRate * 3, audioContext.sampleRate);
      var data = buffer.getChannelData(0);
      var smooth = 0;
      for (var i = 0; i < data.length; i++) {
        smooth = smooth * .985 + (Math.random() * 2 - 1) * .015;
        data[i] = smooth * 3;
      }
      var noise = audioContext.createBufferSource();
      noise.buffer = buffer;
      noise.loop = true;
      ambientFilter = audioContext.createBiquadFilter();
      ambientFilter.type = "lowpass";
      ambientGain = audioContext.createGain();
      ambientGain.gain.value = 0;
      noise.connect(ambientFilter).connect(ambientGain).connect(audioContext.destination);
      noise.start();
    }
    if (audioContext.state === "suspended") audioContext.resume().catch(function () {});
    syncAmbient();
    return audioContext;
  }
  function bindSound() {
    var button = $("sn-sound"), dialog = $("sn-sound-dialog");
    var controls = dialog.querySelectorAll("input");
    function paint() {
      button.classList.toggle("on", sound.enabled);
      button.setAttribute("aria-label", "Sound settings · " + (sound.enabled ? "on" : "off"));
      controls.forEach(function (input) {
        if (input.name === "enabled") input.checked = sound.enabled;
        else input.value = sound[input.name];
      });
    }
    paint();
    button.addEventListener("click", function () { dialog.showModal(); });
    dialog.addEventListener("input", function (event) {
      var control = event.target;
      if (control.name === "enabled") sound.enabled = control.checked;
      else if (Object.hasOwn(sound, control.name)) sound[control.name] = Number(control.value);
      try { localStorage.setItem("sn:sound", JSON.stringify(sound)); } catch (e) {}
      if (sound.enabled) unlockAudio();
      if (!soundLevel("helper") && window.speechSynthesis) speechSynthesis.cancel();
      tappedNewsAudio = false;
      applyNewsAudio();
      if (soundLevel("news") && newsPlayerReady && !cityOn) newsPlayer.playVideo();
      syncAmbient();
      paint();
    });
    document.addEventListener("visibilitychange", syncAmbient);
    if (sound.enabled) document.addEventListener("pointerdown", unlockAudio, { once: true });
  }
  function playOfferBeep() {
    var volume = soundLevel("offers");
    if (!volume) return;
    var audio = unlockAudio();
    if (!audio) return;
    [880, 1320, 1760].forEach(function (frequency, i) {
      var start = audio.currentTime + i * .16;
      var oscillator = audio.createOscillator();
      var gain = audio.createGain();
      oscillator.type = "triangle";
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(.0001, start);
      gain.gain.exponentialRampToValueAtTime(Math.max(.0001, .17 * volume), start + .02);
      gain.gain.exponentialRampToValueAtTime(.0001, start + .23);
      oscillator.connect(gain).connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + .24);
    });
  }
  function paintOfferHud() {
    var amount = $("sn-offer-pay");
    var countdown = $("sn-offer-time");
    if (amount) {
      amount.hidden = !pendingOffer;
      if (pendingOffer) amount.textContent = Number(pendingOffer.fee).toLocaleString("en-GB") + " AV€";
    }
    if (countdown) countdown.textContent = offerCdLeft > 0 ? offerCdLeft + " s to accept" : "";
    paintViewBtn();
  }
  function clearOfferCountdown() {
    clearInterval(offerCdTimer);
    offerCdTimer = null;
    offerCdLeft = 0;
  }
  function startOfferCountdown(seconds, onZero) {
    clearOfferCountdown();
    var deadline = Date.now() + seconds * 1000;
    offerCdLeft = seconds;
    paintOfferHud();
    playOfferBeep();
    offerCdTimer = setInterval(function () {
      var remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      if (remaining === offerCdLeft) return;
      offerCdLeft = remaining;
      if (remaining === 3 || remaining === 1) playOfferBeep();
      paintOfferHud();
      if (remaining === 0) {
        clearOfferCountdown();
        onZero();
      }
    }, 200);
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
  function placeDriverOnRoute(position) {
    clearDriverMark();
    if (!map || !position || ![position.lat,position.lng].every(Number.isFinite)) return;
    driverMark = L.circleMarker([position.lat, position.lng], {
      radius: 9, color: "#4df0ff", fillColor: "#1a3cff", fillOpacity: 0.95, weight: 2
    }).bindTooltip("DRIVER", { permanent: false, direction: "top" }).addTo(map);
  }
  function drawAcceptedRoute(job) {
    routeFreeZoom=false;
    var from = job && (job.vendor || job.from);
    var to = job && (job.drop || job.to);
    if (!from || !to || !isFinite(Number(from.lat)) || !isFinite(Number(to.lat))) return;
    if (!cityOn && typeof openCity === "function") openCity(here || from);
    drawRoute(from, to, job.driver);
    placeDriverOnRoute(job.driver);
  }
  function paintActiveOfferCard(job, mode) {
    ensureHopConfirms(job);
    var id = "offer-" + job.id;
    var feeN = Number(job.fee != null ? job.fee : job.total);
    var priceHtml = isFinite(feeN)
      ? '<div class="price">' + feeN.toLocaleString("en-GB") + " <small>AV€</small></div>"
      : '<div class="price">— <small>AV€</small></div>';
    var title = String((job.vendor && job.vendor.name) || job.shop || job.name || "OFFER");
    var note = escHtml(job.note || job.item || "Vendor → client with driver. Dual-confirm each hop.");
    var body;
    if (mode === "pending") {
      body = '<p id="sn-offer-time" class="note" role="timer"></p><div class="offer-actions">' +
        '<button type="button" class="decline" data-act="decline" data-id="' + job.id + '">DECLINE</button>' +
        '<button type="button" class="accept" data-act="accept" data-id="' + job.id + '">ACCEPT</button></div>';
    } else if (job.shared) {
      body = mode==="paid" && job.tracking && !job.collected ? '<button class="sheet-go" data-act="dispatch-collect" data-id="'+escHtml(job.id)+'">Picked up from vendor</button>' : mode === "paid" ? '<button class="sheet-go" data-act="dispatch-complete" data-id="'+escHtml(job.id)+'">Confirm delivery completed</button>' : '<p>Awaiting checkout confirmation.</p>';
    } else if (job.test) {
      body = '<button type="button" class="sheet-go primary" data-act="test-stage" data-id="' + escHtml(job.id) + '">' +
        testDeliveryStages[job.stage] + '</button>';
    } else {
      body = hopHtml(job);
    }
    var html = '<div class="offer-card" data-offer="' + escHtml(id) + '">' +
      priceHtml +
      "<h3>" + escHtml(title.toUpperCase()) + "</h3>" +
      '<p class="note">' + note + (isFinite(Number(job.km)) ? " · " + Number(job.km).toFixed(1) + " km" : "") + "</p>" +
      body + "</div>";
    upsertTab({ id: id, kind: "offer", title: title.slice(0, 16).toUpperCase(), html: html, min: false, jobId: job.id, mode: mode });
    paintDrawerContent();
    paintOfferHud();
    openOfferDrawer();
  }
  function closeOffer(jobId) {
    clearOfferCountdown();
    offerActiveId = null;
    pendingOffer = null;
    dockTabs = dockTabs.filter(function (t) { return !(t.kind === "offer" && String(t.jobId) === String(jobId)); });
    paintDrawerContent();
    paintOfferHud();
    clearDriverMark();
    clearRoute();
    setDrawerHeight(collapsedDrawerH());
  }
  function declineOffer(jobId) {
    if (!pendingOffer || String(pendingOffer.id) !== String(jobId)) return;
    if (pendingOffer.shared) { dispatchRequest("decline",{id:jobId}).then(data=>{if(data.ok) displayDispatch(data);}); return; }
    var queued = pendingOffer;
    closeOffer(jobId);
    if (queued.test) {
      var next = queued.drivers.indexOf(queued.driver) + 1;
      if (offersArmed() && queued.drivers[next]) showTestOffer(testOrder, queued.drivers[next]);
      else advanceTestOrder();
    }
  }
  function acceptOffer(jobId) {
    if (!pendingOffer || String(pendingOffer.id) !== String(jobId)) return;
    if (pendingOffer.shared) { dispatchRequest("accept",{id:jobId}).then(data=>{if(data.ok) displayDispatch(data);}); return; }
    clearOfferCountdown();
    if (pendingOffer.test) {
      pendingOffer = null;
      testOrder.accepted = true;
      paintActiveOfferCard(testOrder, "active");
      drawAcceptedRoute(testOrder);
      return;
    }
    var received = pendingOffer;
    var job = jobs.filter(function (j) { return String(j.id) === String(jobId); })[0];
    if (!job && received.jobId) job = jobs.find(function (row) { return row.id === received.jobId; });
    if (!job) job = received;
    ensureHopConfirms(job);
    if (!jobs.filter(function (j) { return String(j.id) === String(job.id); }).length) jobs.unshift(job);
    pendingOffer = null;
    dockTabs = dockTabs.filter(function (tab) { return tab.id !== "offer-" + received.id; });
    if (received.role === "driver" && received.driver) {
      job.driver = received.driver;
      job.driverId = received.driver.id;
    }
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
    if (!job || !job.vendor || !job.drop || job.fee == null || !Number.isFinite(Number(job.fee))) return;
    if (![job.vendor.lat, job.vendor.lng, job.drop.lat, job.drop.lng].every(Number.isFinite)) return;
    if ((testOrder && testOrder.accepted) || (pendingOffer && pendingOffer.test)) return;
    if (pendingOffer) closeOffer(pendingOffer.id);
    job = Object.assign({}, job, { id: String(job.id || crypto.randomUUID()) });
    ensureHopConfirms(job);
    offerActiveId = job.id;
    drawerHome = false;
    drawerNews = "";
    $("logo").setAttribute("aria-expanded", "false");
    pendingOffer = job;
    closeJobs();
    closeSheet();
    if (!cityOn) openCity(job.vendor);
    paintActiveOfferCard(job, "pending");
    $("sheet").scrollTop = 0;
    drawRoute(job.vendor, job.drop, job.driver);
    if (!job.shared) startOfferCountdown(13, function () { declineOffer(job.id); });
  }
  function openOfferDrawer() {
    if (newsSelection) stopNews();
    setDrawerHeight(Math.round(window.innerHeight / 3));
  }
  function offerDrawerH() {
    return Math.max(collapsedDrawerH(), Math.min(maxDrawerH(), Math.round(window.innerHeight * (2 / 3))));
  }
  function collapsedDrawerH() { return 64; }

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
      speakIfVoice(text, fromVoice);
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
      id: String(row.vendor_id || row.id || row.osm_id || (name + lat + lng)),
      name: String(name).slice(0, 80),
      lat: lat,
      lng: lng,
      kind: row.kind || tags.amenity || tags.shop || "shop",
      phone: row.phone || tags.phone || tags["contact:phone"] || "",
      logo: row.logo || row.photo || row.image || "",
      cover: row.cover, profile: row.profile, peer: row.peer, posts: row.posts,
      quickCheckout:row.shop?.quickCheckout === true, accountId:row.shop?.contactAccount,
      menu: Array.isArray(row.shop?.menu) ? row.shop.menu : Array.isArray(row.menu) ? row.menu : undefined,
      src: row.src || "osm"
    };
  }
  function liftChrome() {
    var h = 0;
    ["sn-tasks"].forEach(function (id) {
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
  var fittingRoute = false;
  var routeFreeZoom=false;
  function fitOfferRoute() {
    if(routeFreeZoom)return;
    if (!map || typeof L === "undefined") return;
    var topEl = visRect($("top"));
    var drawer = visRect($("drawer"));
    var radar = visRect($("sn-radar"));
    var top = 56, bot = 80, side = 20;
    if (topEl) top = Math.max(top, Math.round(topEl.bottom + 10));
    if (radar) top = Math.max(top, Math.round(radar.bottom + 8));
    var offerPay = visRect($("sn-offer-pay"));
    if (offerPay) top = Math.max(top, Math.round(offerPay.bottom + 8));
    if (drawer) bot = Math.max(bot, Math.round(window.innerHeight - drawer.top + 12));
    else bot = Math.max(bot, Math.round(drawerH || 70) + 16);
    if (top + bot >= window.innerHeight - 24) return;
    var pts = [];
    try {
      if (routeLayer && routeLayer.getLatLngs) {
        var ll = routeLayer.getLatLngs();
        (Array.isArray(ll[0]) ? ll : [ll]).forEach(function (ring) {
          (ring || []).forEach(function (p) { if (p && isFinite(p.lat)) pts.push([p.lat, p.lng]); });
        });
      }
    } catch (e) {}
    if (!pts.length && here && isFinite(here.lat) && isFinite(here.lng)) pts.push([here.lat, here.lng]);
    if (!routeLayer && vendor && isFinite(vendor.lat)) pts.push([vendor.lat, vendor.lng]);
    if (!routeLayer && drop && isFinite(drop.lat)) pts.push([drop.lat, drop.lng]);
    try {
      if (driverMark && driverMark.getLatLng) {
        var dl = driverMark.getLatLng();
        if (dl && isFinite(dl.lat)) pts.push([dl.lat, dl.lng]);
      }
    } catch (e3) {}
    if (pts.length < 1) return;
    try {
      fittingRoute = true;
      var bounds = L.latLngBounds(pts);
      map.fitBounds(bounds, {
        paddingTopLeft: [side, top],
        paddingBottomRight: [side, bot],
        maxZoom: 16,
        animate: false
      });
      if (typeof map.invalidateSize === "function") map.invalidateSize({ animate: false });
    } finally {
      fittingRoute = false;
    }
  }
  function openSheet(title, html) {
    var sh = $("sn-sheet"), card = $("sn-sheet-card");
    if (!sh || !card) return;
    card.innerHTML = '<div class="sheet-bar"><b class="sheet-ttl"></b><button type="button" class="sheet-x" data-act="close">HIDE</button></div><div id="sn-sheet-body"></div>';
    card.querySelector(".sheet-ttl").textContent = title;
    card.querySelector("#sn-sheet-body").innerHTML = html;
    sh.classList.add("on");
    sh.scrollTop = 0;
    setDrawerHeight(Math.max(drawerH,offerDrawerH()));
    materialize(true);
    liftChrome();
  }
  function closeSheet() { var sh = $("sn-sheet"); if (sh) sh.classList.remove("on"); materialize(needFilter()); liftChrome(); paintDrawerContent(); }
  function paintShopsOnMap() {
    if (!map || typeof L === "undefined") return;
    shopMarks.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
    shopMarks = [];
    var list = (shops || []).filter(s => s.discovered).concat(uniqPlaces((shops || []).filter(s => !s.discovered)));
    list.forEach(function (s) {
      if (!isFinite(s.lat) || !isFinite(s.lng)) return;
      var mark = L.marker([s.lat, s.lng], {
        vendorId: s.id, title: s.name || "Vendor",
        icon: L.divIcon({ className: "actor-pin", html: s.logo ? vendorLogo(s) : escHtml(s.emoji || "🛰️"), iconSize: [32, 32], iconAnchor: [16, 16] })
      });
      mark.bindTooltip(function () {
        var name = document.createElement("span");
        name.textContent = s.name || "Vendor";
        return name;
      }, { direction: "top" });
      mark.on("click", function (e) {
        if (pickingDestination) { nameDestination(e.latlng); return; }
        if (e && e.originalEvent) L.DomEvent.stop(e.originalEvent);
        openVendor(s);
      });
      mark.addTo(map);
      mark.options.notificationKey=s.id;
      shopMarks.push(mark);
      paintNoticePin(mark);
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
    var pool = loadActors().concat(shops || []);
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
      shops = uniqPlaces(shops || []);
      if (shops.length) { if (!cityOn) openCity(shops[0]); paintShopsOnMap(); showFound(); }
      return;
    }
    materialize(true);
    say("Finding " + q + "…");
    var local = suggestLocal(q);
    var go = function () {
      /* Lean: one server path (/api/find). No browser Nominatim/Overpass (CORS + triple work). */
      huntApi(q).then(function (rows) {
        shops = uniqPlaces(local.concat(rows || []));
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
        if (p && !loadTestPins().some(pin => pin.id === p.id)) shops.push(p);
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
    var base = s && Array.isArray(s.menu) ? s.menu : [];
    return base.map(function (m, i) {
      return {
        i: i,
        sample:!!m.sample, weight_g:m.weight_g, temperature_c:m.temperature_c, expires:m.produced_at && m.lifetime_minutes ? Date.parse(m.produced_at)+60000*m.lifetime_minutes : null, source: m.source, name: m.name || ("Item " + (i + 1)),
        price: Number(m.price) || 0,
        note: m.note || m.desc || "",
        hours: m.hours || m.availability || "Today",
        stock: m.stock || "in",
        photo: m.photo || m.image || "",
        from: m.from, until: m.until, days: m.days, category: m.category,
        limited: Number.isInteger(m.quantity),
        quantity: Number.isInteger(m.quantity) && m.quantity >= 0 ? m.quantity : 99
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
  function orderCharge(subtotal, delivery) {
    var basis = subtotal + delivery;
    return Math.round((basis + cartFee(basis)) * 100) / 100;
  }
  function openVendor(s) {
    if (!vendor || profileId(s) !== profileId(vendor)) cart = { items: {}, comment: "" };
    vendor = s;
    if (s.test || s.quickCheckout) { renderVendorShop(); return; }
    if (map && isFinite(s.lat)) map.setView([s.lat, s.lng], 17);
    renderVendorShop();
    if (s.discovered || !s.registered && !s.menu?.length) fetchJson("/api/vendor-menu?vendor=" + encodeURIComponent(profileId(s)),{headers:authToken()?{Authorization:"Bearer "+authToken()}:{}}).then(function (data) {
      if (!data || !data.registered || vendor !== s || !drawerProfile || drawerProfile.actor !== s) return;
      if (Object.keys(cart.items).length && JSON.stringify(s.menu) !== JSON.stringify(data.items)) {
        cart.items = {};
        say("The vendor menu has loaded. Add items from the updated menu.");
      }
      s.logo=data.logo || s.logo; s.cover=data.cover || s.cover; s.messaging=data.messaging || s.messaging;
      s.menuStored=data.stored;
      s.canEdit = data.canEdit;
      s.editorAccount = checkoutAccount();
      s.email = data.email || s.email;
      s.phone = data.phone || s.phone;
      s.website = data.website || s.website;
      s.streetAddress = [data.address?.street,data.address?.housenumber,data.address?.city].filter(Boolean).join(" ");
      s.hours = data.hours;
      s.registered = true;
      s.menu = data.items;
      renderVendorShop();
    });
    var ds = s && (s.vendor_type === "delivery_services" || s.kind === "delivery_services");
    say(s.name + (ds ? " · delivery services · same UX as food · AV€ · 3% fee." : " · profile + menu. Order in AV€ · 3% fee."));
  }
  function removeTestPinButton(pin) {
    return '<button type="button" class="sheet-go" data-act="remove-test-pin" data-id="' + escHtml(pin.id) + '">Remove pin</button>';
  }
  function itemAvailable(item) {
    if (!item || item.stock === "out" || item.quantity === 0 || item.price <= 0 || item.expires && Date.now()>=item.expires) return false;
    if (item.days && !item.days.includes(new Date().getDay())) return false;
    if (!item.from || !item.until || item.from === item.until) return true;
    var now = new Date();
    var clock = String(now.getHours()).padStart(2, "0") + ":" + String(now.getMinutes()).padStart(2, "0");
    return item.from < item.until
      ? clock >= item.from && clock < item.until
      : clock >= item.from || clock < item.until;
  }
  async function menuPhoto(file) {
    if (!file || !file.size) return "";
    if (!file.type.startsWith("image/") || file.size > 12 * 1024 * 1024) throw new Error("Choose an image under 12 MB.");
    var image;
    try {
      image = await createImageBitmap(file);
      var scale = Math.min(1, 400 / Math.max(image.width, image.height));
      var preview = document.createElement("canvas");
      preview.width = Math.max(1, Math.round(image.width * scale));
      preview.height = Math.max(1, Math.round(image.height * scale));
      preview.getContext("2d").drawImage(image, 0, 0, preview.width, preview.height);
      return preview.toDataURL("image/jpeg", 0.78);
    } catch (e) {
      throw new Error("This photo could not be opened. Try a JPEG or PNG.");
    } finally {
      if (image) image.close();
    }
  }
  var starterProducts = [
    { name: "Margherita pizza", note: "Tomato, mozzarella and basil.", price: 12, photo: "/js/spacenet/assets/products/pizza.webp" },
    { name: "Espresso", note: "Freshly brewed espresso.", price: 3, photo: "/js/spacenet/assets/products/coffee.webp" },
    { name: "Amber beer", note: "Chilled amber beer, 330 ml.", price: 5, photo: "/js/spacenet/assets/products/beer.webp" }
  ];
  function productGallery() {
    var recent = loadTestPins().flatMap(function (pin) { return (pin.menu || []).slice().reverse(); });
    recent.sort(function (a, b) { return (b.savedAt || 0) - (a.savedAt || 0); });
    var byName = new Map();
    recent.forEach(function (item) {
      var key = item.name.trim().toLowerCase();
      if (!byName.has(key)) byName.set(key, item);
    });
    var starters = starterProducts.map(function (item) {
      var key = item.name.toLowerCase();
      var reusable = byName.get(key);
      byName.delete(key);
      return reusable || item;
    });
    return starters.concat(Array.from(byName.values())).slice(0, 15);
  }
  function renderGallery(items) {
    return '<div class="product-gallery" aria-label="Product gallery">' + items.map(function (item, i) {
      var photo = item.photo ? '<img src="' + escHtml(item.photo) + '" alt="" loading="lazy">' : '';
      return '<button type="button" data-product="' + i + '">' + photo + '<span>' + escHtml(item.name) + '</span></button>';
    }).join("") + '</div>';
  }
  var menuColumns = ["photo", "description", "category", "price", "quantity", "available_from", "available_until", "days", "name","weight_g","temperature_c","produced_at","lifetime_minutes"];
  var menuDays = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  function downloadMenuTemplate() {
    var csv = menuColumns.join(",") + "\r\n" +
      ",Tomato and mozzarella,Pizza,12.00,20,11:00,22:00,Mon Tue Wed Thu Fri Sat Sun,Margherita pizza,350,60," + new Date().toISOString() + ",60\r\n";
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    var download = document.createElement("a");
    download.href = url;
    download.download = "spacenet-menu-template.csv";
    download.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function readMenuCsv(csv) {
    var rows = [], row = [], value = "", quoted = false, closed = false;
    csv = csv.replace(/^\uFEFF/, "");
    for (var i = 0; i <= csv.length; i++) {
      var c = csv[i];
      if (quoted) {
        if (c !== '"') value += c || "";
        else if (csv[i + 1] === '"') { value += '"'; i++; }
        else { quoted = false; closed = true; }
      } else if (c === "," || c === "\n" || c === "\r" || c === undefined) {
        row.push(value.trim());
        value = "";
        closed = false;
        if (c !== ",") {
          if (row.some(Boolean)) rows.push(row);
          row = [];
          if (c === "\r" && csv[i + 1] === "\n") i++;
        }
      } else if (c === '"' && !value && !closed) quoted = true;
      else if (closed || c === '"') throw new Error("Check quoted cells in the CSV.");
      else value += c;
    }
    if (quoted) throw new Error("An item has an unclosed quote.");
    var header = rows.shift();
    var columns = header?.length === 9 ? menuColumns.slice(0,9) : menuColumns;
    if (!header || header.map(function (cell) { return cell.toLowerCase(); }).join(",") !== columns.join(",")) {
      throw new Error("Use the column names and order in the sample CSV.");
    }
    if (!rows.length || rows.length > 200) throw new Error("Upload between 1 and 200 items.");
    return rows.map(function (cells, i) {
      var [photo, note, category, price, quantity, from, until, days, name, weight, temperature, produced, lifetime] = cells;
      var weekdays = days ? Array.from(new Set(days.toLowerCase().split(/[\s;,]+/).filter(Boolean).map(function (day) { return menuDays.indexOf(day); }))) : null;
      var clock = /^(?:[01]\d|2[0-3]):[0-5]\d$/;
      if (cells.length !== columns.length || weight && (!Number.isFinite(Number(weight)) || Number(weight)<=0) ||
          temperature && !Number.isFinite(Number(temperature)) || !!produced !== !!lifetime ||
          produced && (!/(Z|[+-]\d\d:\d\d)$/i.test(produced) || !Number.isFinite(Date.parse(produced)) || !/^\d+$/.test(lifetime) || Number(lifetime)<1 || Number(lifetime)>5256000) || !name || name.length > 80 || note.length > 300 || category.length > 60 ||
          photo && (photo.length > 2048 || !/^https:\/\/[^\s]+$/i.test(photo)) ||
          !/^\d{1,4}(?:\.\d{1,2})?$/.test(price) || Number(price) <= 0 ||
          !/^\d{1,5}$/.test(quantity) || !!from !== !!until || from && (!clock.test(from) || !clock.test(until)) ||
          weekdays && (!weekdays.length || weekdays.includes(-1))) {
        throw new Error("Check item " + (i + 1) + " for missing or invalid values.");
      }
      return { name: name, photo: photo, note: note, category: category, price: Number(price),
        weight_g:weight?Number(weight):null, temperature_c:temperature?Number(temperature):null, produced_at:produced || null,lifetime_minutes:lifetime?Number(lifetime):null, quantity: Number(quantity), days: weekdays, from: from, until: until, savedAt: Date.now(),
        hours: from && from !== until ? from + "–" + until : "All day" };
    });
  }
  function importTestMenu() {
    if (!vendor) return;
    var shop = vendor;
    var state = profileOrdersFor(shop);
    if (!shop.test && !(state?.data?.can_manage_menu || shop.canEdit && shop.editorAccount===checkoutAccount())) return;
    var vendorId = vendor.id;
    openSheet("Import menu", '<form id="sn-import-menu" class="test-form">' +
      '<p class="note">Use HTTPS photo links and save your spreadsheet as comma-separated CSV. Imported rows are added to your menu.</p>' +
      '<button type="button" class="sheet-go" data-act="menu-template">Download sample spreadsheet</button>' +
      '<label>Menu spreadsheet<input class="field" type="file" name="menuFile" accept=".csv,text/csv" required></label>' +
      '<p class="note" role="alert"></p><button class="sheet-go primary">Upload menu</button></form>');
    $("sn-import-menu").addEventListener("submit", async function (e) {
      e.preventDefault();
      var form = e.currentTarget, file = form.elements.menuFile.files[0];
      var alert = form.querySelector('[role="alert"]');
      var submit = form.querySelector('button:not([type])');
      if (submit.disabled) return;
      submit.disabled = true;
      try {
        if (!file || file.size > 512000) throw new Error("Choose a CSV file under 500 KB.");
        var items = readMenuCsv(await file.text());
        if (!form.isConnected || !$("sn-sheet").classList.contains("on") || !vendor || vendor.id !== vendorId) return;
        if (!shop.test) {
          var token = authToken();
          var result = await fetchJson("/api/vendor-menu?vendor=" + encodeURIComponent(vendorId), {
            method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
            body: JSON.stringify({ items: items })
          });
          if (!result || !Array.isArray(result.items)) throw new Error("The vendor menu could not be saved.");
          if (vendor === shop && token === authToken() && $("sn-import-menu") === form) {
            shop.registered = true;
            shop.menu = result.items;
            renderVendorShop();
          }
          return;
        }
        var pins = loadTestPins();
        var pin = pins.find(function (row) { return row.id === vendorId; });
        if (!pin) throw new Error("This vendor pin was removed.");
        pin.menu = (pin.menu || []).concat(items);
        if (!updateTestPins(pins, true)) throw new Error("Could not save the menu on this device.");
        vendor = pin;
        renderVendorShop();
      } catch (error) { alert.textContent = error.message; }
      finally { submit.disabled = false; }
    });
  }
  function editTestMenu() {
    if (!vendor || !vendor.test) return;
    var vendorId = vendor.id, gallery = productGallery(), galleryPhoto = "";
    openSheet("List an item",
      '<form id="test-item-form" class="test-form">' +
      '<button type="button" class="sheet-go" data-act="import-test-menu">Upload spreadsheet</button>' +
      '<button type="button" class="sheet-go" data-act="menu-template">Download sample spreadsheet</button>' +
      renderGallery(gallery) +
      '<p class="note" id="sn-product-selected" aria-live="polite"></p>' +
      '<label>Name<input class="field" name="name" maxlength="80" required></label>' +
      '<label>Photo<input class="field" name="photo" type="file" accept="image/*"></label>' +
      '<label>Description<textarea class="field" name="note" maxlength="300"></textarea></label>' +
      '<label>Price (AV€)<input class="field" name="price" type="number" min="0.01" max="99999" step="0.01" required></label>' +
      '<label><input name="stock" type="checkbox" checked> Available</label>' +
      '<div class="test-times"><label>Available from<input class="field" type="time" name="from"></label>' +
      '<label>Available until<input class="field" type="time" name="until"></label></div>' +
      '<p class="note">Times use this device’s clock. Leave both blank for all day.</p>' +
      '<p role="alert" class="note"></p><button class="sheet-go primary">Save item</button>' +
      '<button type="button" class="sheet-go" data-act="test-menu">Back</button></form>');
    var form = $("test-item-form");
    form.addEventListener("click", function (e) {
      var card = e.target.closest("[data-product]");
      if (!card) return;
      var item = gallery[Number(card.dataset.product)];
      form.elements.name.value = item.name;
      form.elements.note.value = item.note || "";
      form.elements.price.value = item.price || "";
      form.elements.from.value = item.from || "";
      form.elements.until.value = item.until || "";
      form.elements.stock.checked = item.stock !== "out";
      form.elements.photo.value = "";
      galleryPhoto = item.photo || "";
      form.requestSubmit();
    });
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      var data = new FormData(form);
      var alert = form.querySelector('[role="alert"]');
      var submit = form.querySelector('button:not([type])');
      var from = data.get("from"), until = data.get("until");
      var name = data.get("name").trim();
      if (!name) { alert.textContent = "Enter an item name."; return; }
      if (!!from !== !!until) { alert.textContent = "Enter both availability times."; return; }
      submit.disabled = true;
      try {
        var photo = (await menuPhoto(data.get("photo"))) || galleryPhoto;
        if (!form.isConnected || !$("sn-sheet").classList.contains("on") || !vendor || vendor.id !== vendorId) return;
        var pins = loadTestPins();
        var pin = pins.find(function (row) { return row.id === vendorId; });
        if (!pin) throw new Error("This vendor pin was removed.");
        pin.menu = (pin.menu || []).concat({
          name: name, photo: photo, note: data.get("note").trim(), price: Number(data.get("price")),
          stock: data.has("stock") ? "in" : "out", from: from, until: until, savedAt: Date.now(),
          hours: from && from !== until ? from + "–" + until : "All day"
        });
        if (updateTestPins(pins, true)) {
          vendor = pin;
          publishQuickVendor();
          renderVendorShop();
        }
      } catch (error) {
        alert.textContent = error.message;
      } finally {
        submit.disabled = false;
      }
    });
  }
  var testCredit = null;
  var testCreditToken = "";
  var testSubmitting = false;
  var directCheckoutAccount="";
  async function testCheckoutRequest(body,retried) {
    var token = authToken(), account=checkoutAccount();
    if (!token) return { error: "auth_required" };
    try {
      if(account && directCheckoutAccount===account && window.SNAuth?.checkoutRpc) {
        var direct=await SNAuth.checkoutRpc(body).catch(()=>null);
        if(direct && account!==checkoutAccount()) return {error:"auth_changed"};
        if(direct && direct.error!=="auth_required") {
          if(Number.isInteger(direct.balance_cents)){testCredit=direct.balance_cents;testCreditToken=token;paintTestCredit();}
          return direct;
        }
        directCheckoutAccount="";
      }
      var response = await fetch("/api/test-checkout", {
        method: body ? "POST" : "GET",
        headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
        signal:AbortSignal.timeout(12000),
        body: body ? JSON.stringify(body) : undefined
      });
      var result = await response.json().catch(()=>({error:"test_checkout_unavailable"}));
      if(response.status>=500 && window.SNAuth?.checkoutRpc && (!body || ["create","poll","presence"].includes(body.action))) {
        var recovered=await SNAuth.checkoutRpc(body).catch(()=>null);
        if(recovered){result=recovered;if(!result.error && account===checkoutAccount()) directCheckoutAccount=account;}
      }
      if ((response.status===401 || result.error==="auth_required") && !retried && account && window.SNAuth?.session) {
        if (token===authToken()) await SNAuth.session();
        if (account===checkoutAccount() && token!==authToken()) return testCheckoutRequest(body,true);
      }
      if (account !== checkoutAccount()) return {error:"auth_changed"};
      if (Number.isInteger(result.balance_cents)) {
        testCredit = result.balance_cents;
        testCreditToken = token;
        paintTestCredit();
      }
      return result;
    } catch (e) {
      return { error: "test_checkout_unavailable" };
    }
  }
  function testCoinText(cents) {
    return (cents / 100).toLocaleString(undefined, { maximumFractionDigits: 2 }) + " AV€";
  }
  function paintTestCredit() {
    var label = $("sn-test-credit");
    if (label) label.textContent = testCreditToken === authToken() && testCredit != null
      ? "Test credit: " + testCoinText(testCredit) : "Test credit unavailable";
  }
  function testOrderKey(payload) {
    var json = JSON.stringify(payload), token = authToken();
    var key = "sn:test-submit";
    var user = window.SNAuth && SNAuth.user && SNAuth.user();
    var account = user && (user.id || user.email);
    try {
      var previous = JSON.parse(sessionStorage.getItem(key) || "null");
      if (account && previous && previous.account === account && previous.json === json) return previous.id;
    } catch (e) {}
    var id = crypto.randomUUID();
    if (token && account) {
      try { sessionStorage.setItem(key, JSON.stringify({ account: account, json: json, id: id })); } catch (e) {}
    }
    return id;
  }
  var pickingDestination = false;
  var destinationDrawerHeight = 0;
  function checkoutAccount() {
    var account = window.SNAuth && SNAuth.user && SNAuth.user();
    return signed() && authToken() && account ? String(account.id || account.email) : "";
  }
  function resumeCheckout() {
    if (!vendor) return;
    if (usesTestCheckout(vendor)) openTestCheckout();
    else openOrderScreen();
  }
  function requireCheckoutSignIn() {
    if (checkoutAccount()) return true;
    openSheet("Sign in to order", '<p class="note">Sign in to choose a delivery location and pay.</p>' +
      '<button type="button" class="sheet-go primary" data-act="checkout-sign-in">Sign in</button>');
    return false;
  }
  function startCheckoutSignIn() {
    try {
      sessionStorage.removeItem("sn:history-after-auth");
      sessionStorage.setItem("sn:checkout-after-auth", JSON.stringify({ vendor: vendor, cart: cart }));
    } catch (e) {}
    if (window.SNAuth && SNAuth.open) SNAuth.open();
  }
  function restoreCheckoutAfterAuth() {
    if (!checkoutAccount()) return;
    var draft, historyPending;
    try {
      historyPending = sessionStorage.getItem("sn:history-after-auth") === "1";
      sessionStorage.removeItem("sn:history-after-auth");
      draft = JSON.parse(sessionStorage.getItem("sn:checkout-after-auth") || "null");
      sessionStorage.removeItem("sn:checkout-after-auth");
    } catch (e) {}
    if (historyPending) {
      var historyAuth = $("sn-me-sheet");
      if (historyAuth) historyAuth.classList.remove("on");
      openTransactionHistory();
      return;
    }
    if (!draft || !draft.vendor || !draft.cart) return;
    vendor = draft.vendor.test ? loadTestPins().find(function (pin) { return pin.id === draft.vendor.id; }) : draft.vendor;
    if (!vendor) { closeSheet(); return; }
    cart = draft.cart;
    var authSheet = $("sn-me-sheet");
    if (authSheet) authSheet.classList.remove("on");
    resumeCheckout();
  }
  function deliveryStorageKey() { return "sn:client-locations:" + checkoutAccount(); }
  function savedDeliveryLocations() {
    if (!checkoutAccount()) return [];
    try {
      var saved = JSON.parse(localStorage.getItem(deliveryStorageKey()) || "[]");
      return Array.isArray(saved) ? saved : [];
    } catch (e) { return []; }
  }
  function deliveryLocations() {
    var account = checkoutAccount();
    var known = loadActors().concat(loadTestPins()).filter(function (pin) {
      return pin.role === "client" && (pin.accountId === account || pin.test && !pin.accountId);
    });
    return Array.from(new Map(savedDeliveryLocations().concat(known).map(function (pin) { return [pin.id, pin]; })).values());
  }
  var checkoutStops = [];
  function deliveryPicker() {
    return '<fieldset id="sn-checkout-client"><legend>Where should we deliver?</legend><label id="account-address-label" for="checkout-address">Account or selected address</label><select class="field" id="checkout-address" aria-label="Delivery address"></select><button type="button" class="sheet-go" data-act="checkout-new-client">Place a delivery pin on the map</button><button type="button" class="sheet-go" data-act="checkout-gps">Use my current GPS location</button><button type="button" class="sheet-go" id="save-delivery-pin" hidden>Save this location to my addresses</button></fieldset>';
  }
  function selectedDeliveries() { return checkoutStops.slice(); }
  var pickedCheckoutAddress=null;
  function mountDeliveryPicker(clients,update) {
    var options=clients.slice(), select=$("checkout-address");
    if(pickedCheckoutAddress && pickedCheckoutAddress.account===checkoutAccount()) options.unshift(pickedCheckoutAddress);
    options=Array.from(new Map(options.map(pin=>[pin.id,pin])).values());
    var pin=options.find(p=>deliverySelection.has(p.id)) || options[0];
    options.forEach(p=>select.add(new Option(p.name,p.id)));
    select.hidden=!options.length;
    $("account-address-label").hidden=!options.length;
    select.onchange=function(){
      checkoutStops=options.filter(p=>p.id===select.value);
      deliverySelection=new Set(checkoutStops.map(p=>p.id));
      var chosen=checkoutStops[0],save=$("save-delivery-pin");
      save.hidden=!chosen || chosen.id!==pickedCheckoutAddress?.id || clients.some(p=>p.id===chosen.id);
      save.onclick=function(){
        var saved=Object.assign({},chosen,{savedDelivery:true,role:"client",accountId:checkoutAccount()});
        try {localStorage.setItem(deliveryStorageKey(),JSON.stringify([saved,...savedDeliveryLocations().filter(p=>p.id!==saved.id)].slice(0,120)));save.hidden=true;}
        catch {orderGuidance("This browser could not save the address.");}
      };
      markDelivery(chosen);
      update();
    };
    if(pin) select.value=pin.id;
    select.onchange();

  }
  var deliveryMarker;
  function markDelivery(pin) {
    if(deliveryMarker) {deliveryMarker.remove();deliveryMarker=null;}
    if(!map || !pin) return;
    requestAnimationFrame(()=>{if(cityOn && deliveryMarker) map.panInside([pin.lat,pin.lng],{paddingTopLeft:[20,85],paddingBottomRight:[20,Math.min(drawerH+35,window.innerHeight-140)],animate:false});});
    deliveryMarker=L.marker([pin.lat,pin.lng],{interactive:false,keyboard:false,zIndexOffset:1100,
      icon:L.divIcon({className:"delivery-destination",html:"📍",iconSize:[30,30],iconAnchor:[15,30]})})
      .addTo(map).bindTooltip("Deliver here",{permanent:true,direction:"top",offset:[0,-27]});
  }
  function deliveryTotal(entries) {
    var subtotal = cartSubtotal();
    return entries.reduce(function (sum, entry) {
      return sum + Math.round(orderCharge(subtotal, entry.quote.total) * 100);
    }, 0);
  }
  function checkoutDeliveries(clients, options) {
    return selectedDeliveries(clients).map(function (pin) { return { pin: pin, quote: quoteDelivery(vendor, pin, options) }; });
  }
  function advanceTestOrder() {
    testOrder = testOrderQueue.shift() || null;
    if (testOrder && offersArmed()) showTestOffer(testOrder, testOrder.drivers[0]);
  }
  function beginDestinationPick() {
    if (!vendor || !requireCheckoutSignIn()) return;
    var note = $("sn-order-comment");
    if (note) cart.comment = note.value;
    selectedDeliveries(deliveryLocations());
    if (!cityOn) openCity(vendor);
    map.closePopup();
    pickingDestination = true;
    destinationDrawerHeight = drawerH;
    setDrawerHeight(collapsedDrawerH());
    $("sn-location-pick").hidden = false;
    $("city").classList.add("picking-destination");
  }
  function endDestinationPick() {
    if (pickingDestination && destinationDrawerHeight) setDrawerHeight(destinationDrawerHeight);
    destinationDrawerHeight = 0;
    pickingDestination = false;
    $("sn-location-pick").hidden = true;
    $("city").classList.remove("picking-destination");
  }
  function nameDestination(pt,label) {
    endDestinationPick();
    var account = checkoutAccount();
    if (!account) { requireCheckoutSignIn(); return; }
    pickedCheckoutAddress={id:crypto.randomUUID(),name:label || "Selected map location",lat:pt.lat,lng:pt.lng,account:account};
    deliverySelection=new Set([pickedCheckoutAddress.id]);
    if(!cityOn) openCity(pt);
    map.setView([pt.lat,pt.lng],map.getZoom());
    resumeCheckout();
  }
  function usesTestCheckout(shop) {
    return !!shop && (shop.test || shop.quickCheckout || shop.discovered && !shop.claimed && !shop.verified);
  }
  function openTestCheckout() {
    if (!usesTestCheckout(vendor) || !cartSubtotal()) return;
    if (!requireCheckoutSignIn()) return;
    var shop = vendor;
    var clients = deliveryLocations();

    openSheet("Checkout", '<form id="test-order-form" class="test-form">' +
      deliveryPicker(clients) + '<p class="note" id="sn-test-total"></p>' +
      '<p class="note" id="sn-test-credit">Loading test credit…</p>' +
      '<button class="sheet-go primary place-order" disabled>Place order</button><p role="alert" class="note"></p><button type="button" class="sheet-go" id="demo-driver-offer">Preview driver offer on this device</button></form>');
    var form = $("test-order-form");
    function showTotal() {
      var destinations = checkoutDeliveries(clients, {});
      form.querySelector('button:not([type])').disabled = !destinations.length;
      $("sn-test-total").textContent = destinations.length
        ? destinations.length + (destinations.length === 1 ? ' delivery' : ' deliveries') + ' · total including 3% fee: ' + testCoinText(deliveryTotal(destinations)) : "";
    }
    form.querySelector("#demo-driver-offer").onclick=function(){
      var destination=checkoutDeliveries(clients,{})[0];
      var alert=form.querySelector('[role="alert"]');
      if(!destination){alert.textContent="Choose a delivery location first.";return;}
      if(testSubmitting || pendingOffer || offerActiveId){alert.textContent="Finish the current request first.";return;}
      var driver=Object.assign({name:"Driver preview"},driverPosition() || {});
      testOrder={id:"preview-"+crypto.randomUUID(),test:true,stage:0,drivers:[driver],vendor:shop,drop:destination.pin,
        fee:destination.quote.driver,item:"On-device demo · no payment or dispatch",accepted:false};
      clearDrawerPlacement();
      showTestOffer(testOrder,driver);
    };
    mountDeliveryPicker(clients,showTotal);
    testCheckoutRequest().then(paintTestCredit);
    form.addEventListener("submit", async function (e) {
      e.preventDefault();
      if (vendor !== shop || !requireCheckoutSignIn()) return;
      var alert = form.querySelector('[role="alert"]');
      var button = form.querySelector('button:not([type])');
      var lines = vendorMenu(shop).filter(function (item) { return cartQty(item.i) > 0; });
      if (testSubmitting || button.disabled) {
        orderGuidance("Your order is already being submitted.");
        alert.textContent = "Your order is already being submitted.";
        return;
      }
      if (!lines.length || lines.some(function (item) { return !itemAvailable(item); })) {
        orderGuidance("Check item availability in your cart.");
        alert.textContent = "Check the availability of the items in your cart.";
        return;
      }
      var destinations = checkoutDeliveries(clients, {});
      if (!destinations.length) return;
      if (lines.some(function (item) { return cartQty(item.i) * destinations.length > item.quantity && item.limited; })) {
        orderGuidance("Reduce the item quantity or choose fewer delivery stops.");
        alert.textContent = "There is insufficient stock for all selected addresses.";
        return;
      }
      var items = lines.map(function (item) {
        return { name: item.name, qty: cartQty(item.i), unit_cents: Math.round(item.price * 100) };
      });
      var payloads = destinations.map(function (entry) {
        return {
          vendor: { id: shop.id, name: shop.name, lat: shop.lat, lng: shop.lng },
          drop: { id: entry.pin.id, name: entry.pin.name, lat: entry.pin.lat, lng: entry.pin.lng },
          items: items,
          delivery_cents: Math.round(entry.quote.driver * 100)
        };
      });
      var key = testOrderKey(payloads);
      var orders = payloads.map(function (payload, i) {
        return { order_id: i ? key.slice(0, -1) + ((parseInt(key.slice(-1), 16) + i) % 16).toString(16) : key, payload: payload };
      });
      button.disabled = true;
      $("sn-checkout-client").disabled = true;
      testSubmitting = true;
      alert.textContent = "Sending your delivery request…";
      var result = await dispatchRequest("create",{orders:orders,driver_position:driverAvailable()?driverPosition():null});
      button.disabled = false;
      form.querySelector("fieldset").disabled = false;
      testSubmitting = false;
      if (!result.ok) {
        alert.textContent = result.error === "insufficient_test_credit" ? "Not enough test credit for this order." :
          result.error === "auth_required" || result.error === "auth_changed" ? "Your session could not authorize this order. Your cart is saved here." :
          result.error === "dispatch_schema_missing" ? "Live dispatch is unavailable. Your cart is saved. You can preview the driver offer below." :
          result.error === "checkout_config_missing" ? "The server has no checkout database connection. Your cart is saved." :
          "The order service did not confirm this order. Your cart is saved for retry.";
        return;
      }
      try { sessionStorage.removeItem("sn:test-submit"); } catch (err) {}
      if (form.isConnected && vendor === shop) cart.items = {};
      closeSheet();
      if (!result.assignment) {
        var pending = (result.checkout || []).filter(row=>orders.some(order=>order.order_id===row.id));
        orderGuidance(pending.some(row=>row.state==="offered") ? "Order sent. A nearby driver has 13 seconds to respond." : pending.some(row=>row.state==="waiting") ? waitingGuidance() : "Order submitted. Checking driver availability.");
        var controls = pending.map(row => row.state==="waiting" ? '<button class="sheet-go" data-act="dispatch-pickup" data-id="'+escHtml(row.id)+'">Choose vendor pickup · '+escHtml(row.vendor.name)+'</button>' : '').join(" ");
        var admin = SNAuth.user()?.roles?.some(role=>["admin","super_admin","owner"].includes(role));
        showDrawerPlacement("Delivery requested", '<p>'+(pending.some(row=>row.state==="offered") ? 'A nearby driver has received the offer.' : 'Looking for an available driver.')+'</p>'+controls+
          (controls && !SNAuth.activeRoles().driver ? '<button class="sheet-go" data-act="enable-delivery">Enable my delivery driver role</button>' : '') +
          (admin && controls ? '<button class="sheet-go" data-act="checkout-driver">Add driver at my location</button>' : '') +
          '<button class="sheet-go" data-act="checkout-another-vendor">Choose another vendor on the map for a new order</button>');
      }
      await displayDispatch(result);

    });
  }
  var testDeliveryStages = ["Confirm pickup", "Confirm delivery", "Client received"];
  function showTestOffer(order, driver) {
    closeSheet();
    order.driver = driver;
    order.note = order.item + " · " + driver.name + " → " + order.drop.name;
    throwOffer(order);
  }
  function menuQuantity(item, available) {
    var qty = cartQty(item.i);
    return '<div class="profile-item-qty">' +
      '<button type="button" class="sheet-go" aria-label="Remove one ' + escHtml(item.name) + '" data-act="qty-minus" data-i="' + item.i + '"' + (qty ? "" : " disabled") + '>−</button>' +
      '<span aria-label="Quantity">' + qty + '</span>' +
      '<button type="button" class="sheet-go" aria-label="Add ' + escHtml(item.name) + ' to cart" data-act="qty-plus" data-i="' + item.i + '"' + (available && qty < Math.min(99, item.quantity) ? "" : " disabled") + '>+</button></div>';
  }
  function renderVendorShop() {
    if (!vendor) return;
    var controls = vendor.test ? '<div class="vendor-menu-controls">' +
      '<button type="button" class="sheet-go" data-act="edit-test-menu">List an item</button>' +
      '<button type="button" class="sheet-go" data-act="edit-test-vendor">Edit vendor</button>' +
      '<button type="button" class="sheet-go" data-act="import-test-menu">Import menu</button>' +
      removeTestPinButton(vendor) + '</div>' : '';
    if (vendor.discovered) controls += '<button class="sheet-go" data-act="invite-listing">✉️ Invite vendor</button> ' +
      '<button class="sheet-go" data-act="claim-listing">Request ownership review</button> ' +
      '<button class="sheet-go" data-act="suggest-item">Suggest menu item</button>';
    if (vendor.canEdit && vendor.editorAccount===checkoutAccount()) controls += '<button class="sheet-go" data-act="editor-add-item">Add menu item</button>';
    var rows = vendorMenu(vendor).map(function (item) {
      var photo = profileImage(item.photo);
      var available = itemAvailable(item);
      var details = [item.price + " AV€", item.hours, item.category, item.weight_g && item.weight_g+" g", item.temperature_c!=null ? item.temperature_c+" °C" : "", item.expires ? (item.expires<=Date.now()?"Spoiled":"Deliver by "+new Date(item.expires).toLocaleString()) : "",
        item.limited ? item.quantity + " in stock" : "", available ? "" : "Unavailable"].filter(Boolean);
      return '<article class="test-item profile-menu-item">' +
        (photo ? '<img width="58" height="58" src="' + escHtml(photo) + '" alt="" loading="lazy">' : '') +
        '<div class="profile-item-copy"><b>' + escHtml(item.name) + '</b><p class="note">' + escHtml(details.join(" · ")) + '</p>' +
        (item.note ? '<p class="note">' + escHtml(item.note) + '</p>' : '') +
        (item.source && /^https:\/\//.test(item.source) ? '<a href="' + escHtml(item.source) + '" target="_blank" rel="noopener">Published menu</a>' : '') +
        (vendor.canEdit && vendor.editorAccount===checkoutAccount() && vendor.menuStored && !item.sample ? '<button class="sheet-go" data-act="editor-edit-item" data-i="'+item.i+'">Edit</button>' : '') +
        '</div>' + menuQuantity(item, available) + '</article>';
    }).join("");
    showDrawerProfile(vendor, controls + (rows || '<p class="note">No menu items yet.</p>'));
  }
  function openOrderScreen() {
    if (!vendor) return;
    var menu = vendorMenu(vendor);
    var lines = menu.filter(function (m) { return cartQty(m.i) > 0; });
    if (!lines.length) { say("Add items with +."); return; }
    if (!requireCheckoutSignIn()) return;
    var clients = deliveryLocations();
    var rows = lines.map(function (m) {
      return '<div class="menu-row"><div class="menu-body"><b>' + String(m.name).replace(/[<>]/g, "") + "</b>" +
        '<span class="menu-meta">' + m.price + " AV€ each</span>" +
        '<div class="qty"><button type="button" data-act="qty-minus" data-i="' + m.i + '" data-order="1">−</button>' +
        '<em>' + cartQty(m.i) + "</em>" +
        '<button type="button" data-act="qty-plus" data-i="' + m.i + '" data-order="1">+</button></div></div></div>';
    }).join("");
    openSheet("Checkout", deliveryPicker() + rows +
      '<textarea id="sn-order-comment" class="field" placeholder="Order comments">' + escHtml(cart.comment || "") + '</textarea>' +
      '<div class="checkout test-form">' +
      '<p class="note" id="sn-cart-total"></p>' +
      '<button type="button" id="sn-pay-cart" class="sheet-go primary place-order" data-act="pay-avc" disabled>Place order</button>' +
      '</div>');
    function update() {
      var destinations = checkoutDeliveries(clients, quoteOpts);
      $("sn-pay-cart").disabled = !destinations.length;
      $("sn-cart-total").textContent = destinations.length
        ? destinations.length + (destinations.length === 1 ? ' delivery' : ' deliveries') + ' · total including 3% fee: ' + testCoinText(deliveryTotal(destinations))
        : "Cart " + cartSubtotal() + " AV€";
    }
    mountDeliveryPicker(clients,update);
  }

  var dispatchBusy = false, dispatchPickup = "", dispatchView = "", dispatchAccount = "";
  function dispatchRequest(action, details) {
    return testCheckoutRequest({action:action, details:details || {}});
  }
  var selectedDriverPin = null;
  function driverPosition() {
    return selectedDriverPin && selectedDriverPin.accountId === checkoutAccount() ? selectedDriverPin : dispatchFix;
  }
  function driverLocationControls() {
    return '<p>Receive offers at your current location or a driver pin.</p><button class="sheet-go" data-act="driver-current">Use current GPS location</button> ' +
      loadTestPins().filter(pin=>pin.role==="driver" && (!pin.accountId || pin.accountId===checkoutAccount())).map(pin=>
        '<button class="sheet-go" data-act="driver-pin" data-id="'+escHtml(pin.id)+'">Use '+escHtml(pin.name)+' pin</button>').join(" ");
  }
  function driverAvailable() {
    return !!(offersArmed() && checkoutAccount() && window.SNAuth?.activeRoles().driver);
  }
  var nextDispatchPoll=0, dispatchDelay=0;
  async function refreshDispatch() {
    if (holdAccount !== checkoutAccount()) clearHoldRoutes();
    if (!checkoutAccount()) { $("sn-pending-orders").hidden=true; return; }
    if (dispatchBusy || Date.now()<nextDispatchPoll) return;
    dispatchBusy = true;
    try {
      if (driverAvailable() && !driverPosition()) ensureDriverGps();
      var account = checkoutAccount();
      if (dispatchAccount !== account) { dispatchPickup = ""; dispatchView = ""; dispatchAccount = account; }
      var position = driverPosition();
      var active = driverAvailable() && !!position;
      var data = await dispatchRequest("presence",{active:active,lat:(position || here)?.lat,lng:(position || here)?.lng});
      dispatchDelay=data.ok?0:Math.min(30000,Math.max(4000,dispatchDelay*2));
      nextDispatchPoll=Date.now()+dispatchDelay;
      if (data.ok && account === checkoutAccount()) await displayDispatch(data);
    } finally { dispatchBusy = false; }
  }
  var trackedOrders=[], trackingAccount="";
  function trackingText(row) {
    var states={waiting:"Waiting for a driver",offered:"Offer sent to a driver",accepted:"Driver accepted",paid:"Driver assigned · checkout confirmed",done:"Delivery completed",pickup:"Pickup available",collected_order:"Vendor pickup confirmed",payment_failed:"Payment failed"};
    var text=states[row.state] || row.state;
    if(row.state==="paid") {
      var minutes=Math.ceil(VENDOR_PREP_MIN-(Date.now()-Date.parse(row.created))/60000);
      text=row.picked_up_at?"Driver on the way":minutes>0?"Awaiting pickup · estimated preparation "+minutes+" min":"Awaiting pickup";
    }
    if(row.driver && row.drop) text+=" · Driver "+Math.round(haversineKm(row.driver,row.drop)*1000)+" m from delivery";
    return text;
  }
  function trackingMarkup(vendorId) {
    if(trackingAccount!==checkoutAccount()) return "";
    return trackedOrders.filter(row=>!vendorId || row.vendor.id===vendorId).map(row=>
      '<button class="sheet-go tracking-order" data-act="track-order" data-id="'+escHtml(row.id)+'">'+escHtml(row.vendor.name)+' · '+escHtml(trackingText(row))+'</button>').join("");
  }
  function openTrackedOrder(id) {
    if(trackingAccount!==checkoutAccount()) return;
    var row=trackedOrders.find(order=>order.id===id);
    if(!row) return;
    showDrawerPlacement(row.vendor.name,'<p role="status" id="tracking-details">'+escHtml(trackingText(row))+'</p>');
    $("tracking-details").dataset.id=id;
    drawAcceptedRoute(row);
  }
  async function displayDispatch(data) {
    if(Array.isArray(data.tracking)) {
      trackedOrders=data.tracking;
      trackingAccount=checkoutAccount();
      var detail=$("tracking-details"), row=detail && trackedOrders.find(o=>o.id===detail.dataset.id);
      if(row) {detail.textContent=trackingText(row);placeDriverOnRoute(row.driver);}
      if(drawerProfile && !offerActiveId && !drawerPlacement && !drawerAI && !drawerHome && !drawerNews) paintDrawerCart(drawerProfile);
      for(var order of trackedOrders) {
        if(!order.mine || order.state!=="paid" || !order.picked_up_at || !order.driver) continue;
        var km=haversineKm(order.driver,order.drop), threshold=[1,2,3].find(n=>km<=n);
        if(!threshold) continue;
        var noticeKey="sn:delivery-distance:"+trackingAccount+":"+order.id;
        if(Number(sessionStorage.getItem(noticeKey) || 4)>threshold) {
          sessionStorage.setItem(noticeKey,String(threshold));
          orderGuidance("Your driver is within "+threshold+" km of your delivery location.");
        }
      }
    }
    var ordersButton = $("sn-pending-orders");
    ordersButton.hidden = !data.pending_count;
    ordersButton.textContent = "Orders · " + (data.pending_count || 0);
    var assignment = data.assignment;
    var waiting = (data.checkout || []).find(row => row.state === "accepted");
    if (waiting) {
      var settled = await dispatchRequest("settle",{id:waiting.id});
      if (settled.error) { orderGuidance(settled.error==="insufficient_test_credit"?"Payment failed. Check your test credit before placing another order.":"Could not confirm payment. Check your connection and order status."); return; }
      orderGuidance("Delivery accepted. Your order is confirmed.");
      assignment = settled.assignment;
    }
    if (assignment) {
      var tracked=trackedOrders.find(row=>row.id===assignment.id);
      var key = assignment.id + assignment.state + (tracked?.picked_up_at || "");
      orderGuidance("");
      if (dispatchView === key) {
        if(assignment.state==="paid" && driverMark && driverPosition()) driverMark.setLatLng(driverPosition());
        return;
      }
      var payload = assignment.payload;
      var job = {id:assignment.id,shared:true,tracking:!!tracked,collected:!!tracked?.picked_up_at,vendor:payload.vendor,drop:payload.drop,
        fee:payload.delivery_cents/100,driver:driverPosition(),item:payload.items.map(row=>row.qty+" × "+row.name).join(", ")};
      if (assignment.state === "offered") {
        if (!driverAvailable()) return;
        clearDrawerPlacement();
        throwOffer(job);
        startOfferCountdown(Math.max(1,Math.ceil((Date.parse(assignment.deadline)-Date.now())/1000)),refreshDispatch);
      } else {
        clearOfferCountdown(); pendingOffer=null; offerActiveId=job.id;
        paintActiveOfferCard(job,assignment.state);
        drawAcceptedRoute(job);
      }
      dispatchView=key;
      return;
    }
    if (dispatchView && offerActiveId) closeOffer(offerActiveId);
    dispatchView="";
    var pickup=(data.checkout || []).find(row=>row.state==="pickup");
    if (pickup && pickup.id !== dispatchPickup) {
      dispatchPickup=pickup.id;
      orderGuidance("No driver accepted. Confirm pickup from the vendor in the drawer.");
      showDrawerPlacement("Pickup checkout",'<p>No available driver. Delivery was canceled.</p><p>'+escHtml(pickup.vendor.name)+' · '+escHtml(pickup.items.map(row=>row.qty+' × '+row.name).join(", "))+'</p><button class="sheet-go" data-act="dispatch-pickup" data-id="'+escHtml(pickup.id)+'">Confirm pickup from vendor</button>');
    }
  }
  var powerOn=false;
  function offersArmed() { return powerOn; }
  function orderGuidance(message) {
    $("sn-order-status").textContent=message;
    $("sn-order-guidance").hidden=!message;
  }
  function waitingGuidance() {
    var steps=[];
    if (!window.SNAuth?.activeRoles().driver) steps.push("enable Delivery driver in your user menu");
    if (!driverPosition()) steps.push("choose your driver pin or allow GPS");
    if (!offersArmed()) steps.push("hold Power for three seconds");
    return "No driver is available yet. " + (steps.length ? "To receive this order yourself, "+steps.join(", ")+". " : "")+"You can also choose pickup in the drawer.";
  }
  function liveReceivers(role) {
    var rows = loadActors().filter(function (a) {
      return a && a.role === role && a.verified;
    });
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
      job.route.vendors.slice(0, 1).forEach(function (v) {
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
      picks.slice(0, 1).forEach(function (d) {
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
          driver: d,
          driverId: driverKey(d)
        });
      });
    }
    if (!pendingOffer) {
      paintActiveOfferCard(job, "active");
      drawAcceptedRoute(job);
      openJobs();
    }
    say("Vendor confirmed · routed to " + (picks[0] ? picks[0].name : "drivers") + (job.route.pickReason ? " (" + job.route.pickReason + ")" : "") + ".");
  }

  var inboxBusy=false, displayedNotice="", privateNotices=null, noticeAccount="";
  function paintNoticePin(mark) {
    var el=mark.getElement(), key=mark.options.notificationKey;
    if(!el) return;
    var count=noticeAccount===checkoutAccount()? privateNotices?.counts?.[key] || 0 : 0;
    var badge=el.querySelector(".notice-count");
    if(!count){badge?.remove();return;}
    if(!badge){badge=document.createElement("span");badge.className="notice-count";el.append(badge);}
    badge.textContent=count;
    badge.setAttribute("aria-label",count+" pending notifications");
  }
  function pendingMarkup(actor) {
    if(noticeAccount!==checkoutAccount() || privateNotices?.vendor!==profileId(actor)) return "";
    return '<section id="vendor-pending" class="profile-section"><h3>Pending orders</h3>'+ (privateNotices.pending.map(function(order) {
      return '<article><time>'+escHtml(transactionDate(order.created_at))+'</time> '+escHtml(order.items.map(i=>(i.qty || 1)+" × "+(i.name || "Item")).join(", "))+
        (order.channel==="listing_request" ? ' <button class="sheet-go" data-act="order-accept" data-id="'+escHtml(order.id)+'">Accept</button> <button class="sheet-go" data-act="order-decline" data-id="'+escHtml(order.id)+'">Decline</button>' : '')+'</article>';
    }).join("") || '<p class="note">No pending orders.</p>')+'</section>';
  }
  async function vendorInbox(vendorId, quiet) {
    var account=checkoutAccount();
    if(!account || inboxBusy || document.hidden) return;
    inboxBusy=true;
    try {
      var peer=drawerProfile?.actor && profileId(drawerProfile.actor);
      var scope=vendorId || (drawerProfile && profileIsVendor(drawerProfile.actor) ? profileId(drawerProfile.actor) : null);
      var [result,notices]=await Promise.all([listingAction({kind:"inbox",vendor:vendorId}),listingAction({kind:"notifications",vendor:scope,peer:drawerProfile?.actor?.accountId || drawerProfile?.actor?.id})]);
      if(account!==checkoutAccount() || !Array.isArray(result?.items) || !notices?.ok) return;
      refreshChatCount();
      notices.peer=peer;
      notices.vendor=scope;
      notices.messages.forEach(m=>{notices.counts[m.sender]=(notices.counts[m.sender]||0)+1;});
      privateNotices=notices;
      noticeAccount=account;
      shopMarks.concat(actorMarks).forEach(paintNoticePin);
      if(!document.activeElement?.closest("form")) paintDrawerContent();
      var signature=account+":"+result.items.concat(notices.messages).map(row=>row.id).join(",");
      if(!vendorId && (quiet || signature===displayedNotice || !(result.items.length+notices.messages.length) ||
        pendingOffer || $("sn-sheet").classList.contains("on") || document.activeElement?.matches("input,textarea,select") ||
        drawerPlacement && !$("notification-list"))) return;
      displayedNotice=signature;
      var rows=result.items.map(function(order){
        var expired=order.delivery_deadline && Date.parse(order.delivery_deadline)<=Date.now();
        return '<article><b>'+escHtml(order.name)+'</b><p>'+escHtml(transactionDate(order.created_at))+' · '+escHtml(order.items.map(i=>i.qty+" × "+i.name+(i.sample?" (sample)":"")).join(", "))+'</p>'+
          (expired?"<p>Delivery deadline passed</p>":"")+
          (!order.vendor_seen_at?'<button class="sheet-go" data-act="order-seen" data-id="'+escHtml(order.id)+'">Mark read</button>':'')+'</article>';
      }).join("");
      if(!vendorId) rows+=notices.messages.map(m=>'<article><b>'+escHtml(m.name)+'</b><p>'+escHtml(m.body)+'</p><button class="sheet-go" data-act="message-read" data-id="'+escHtml(m.id)+'">Mark read</button> <button class="sheet-go" data-act="reply-message" data-id="'+escHtml(m.sender)+'">Reply</button></article>').join("");
      showDrawerPlacement(vendorId?"Vendor messages":"Notifications · "+(result.items.length+notices.messages.length),'<div id="notification-list">'+(rows||"<p>No orders yet.</p>")+'</div>');
      setDrawerHeight(Math.round(innerHeight/3));
    } finally {inboxBusy=false;}
  }
  function listingAction(data) {
    return fetchJson("/api/listing-action",{method:"POST",headers:{Authorization:"Bearer "+authToken(),"Content-Type":"application/json"},body:JSON.stringify(data)});
  }
  async function payCartAvc() {
    if (!requireCheckoutSignIn()) return;
    if (!$("sn-checkout-client")) return;
    var destinations = checkoutDeliveries(deliveryLocations(), quoteOpts);
    if (!destinations.length) return;
    var ta = $("sn-order-comment");
    if (ta) cart.comment = String(ta.value || "").trim().slice(0, 500);
    var tot = cartSubtotal();
    if (tot <= 0) { say("Cart empty."); return; }
    if (vendorMenu(vendor).some(function (item) {
      var qty = cartQty(item.i);
      return qty && (!itemAvailable(item) || item.limited && qty * destinations.length > item.quantity);
    })) { say("Check item availability for the selected addresses."); return; }
    if (vendor.discovered) {
      var button = $("sn-pay-cart");
      if (!button || button.disabled) return;
      button.disabled = true;
      $("sn-checkout-client").disabled=true;
      var request = {kind:"order",vendor_ref:vendor.id,items:vendorMenu(vendor).filter(m=>cartQty(m.i)).map(m=>({name:m.name,qty:cartQty(m.i),sample:m.sample})),
        drops:destinations.map(entry=>({name:entry.pin.name,lat:entry.pin.lat,lng:entry.pin.lng}))};
      request.request_id = testOrderKey(request);
      var result = await listingAction(request);
      if (!result?.ok) { orderGuidance("Vendor order could not be confirmed. Check your connection and retry."); button.disabled=false; $("sn-checkout-client").disabled=false; $("sn-cart-total").textContent="Order request unavailable. Retry to confirm."; return; }
      cart.items={};
      sessionStorage.removeItem("sn:test-submit");
      openSheet("Order requested",'<p>Awaiting vendor confirmation. No payment collected.</p>');
      return;
    }
    var due = deliveryTotal(destinations) / 100;
    if (avcGet() < due) {
      openSheet("TOP UP AV€",
        '<p class="note">Need ' + due + " AV€ for the selected deliveries. You have " + Math.round(avcGet()) + " AV€.</p>" +
        '<input id="sn-add-eur" inputmode="decimal" placeholder="Euro to top up" value="20" />' +
        '<button type="button" class="sheet-go primary" data-act="topup" data-rail="paypal">PAYPAL</button>' +
        '<button type="button" class="sheet-go" data-act="topup" data-rail="stripe">STRIPE</button>' +
        '<button type="button" class="sheet-go" data-act="topup" data-rail="revolut">REVOLUT</button>');
      return;
    }
    avcSet(avcGet() - due);
    var placed = destinations.map(function (entry) {
      var q = entry.quote;
      var job = {
        id: "j" + crypto.randomUUID(),
        vendor: vendor,
        drop: entry.pin,
        km: q.km,
        fee: q.total,
        driverPay: q.driver,
        orderTotal: tot,
        cut: cartFee(tot + q.total),
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
      recordOrderPayment(job, orderCharge(tot, q.total), job.cut);
      return job;
    });
    saveJobs();
    placed.forEach(routeOrderToLive);
    cart = { items: {}, comment: "" };
    closeSheet();
    openJobs();
    say("Paid " + due + " AV€ for " + placed.length + " delivery order(s). Vendor must confirm.");
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
        ? '<button type="button" class="sheet-go primary" data-act="send">PAY DELIVERY · ' + orderCharge(0, q.total) + " AV€</button>"
        : '<button type="button" class="sheet-go primary" data-act="needlogin">LOGIN TO PAY · ' + q.total + " AV€</button>");
    openSheet("QUOTE", html);
    var note = $("sn-sheet-body") && $("sn-sheet-body").querySelector(".note");
    if (note) note.textContent = bits.join(" · ") + " · client pays " + q.total + " AV€ now.";
    drawRoute(vendor, drop);
    say("Delivery " + q.total + " AV€ · pay upfront · " + vendor.name);
  }
  var routeRevision = 0;
  function clearRoute() {
    routeRevision++;
    if (routeLayer && map) {
      map.removeLayer(routeLayer);
      fittingRoute = true;
      try { map.setMinZoom(12); } finally { fittingRoute = false; }
    }
    routeLayer = null;
  }
  var routeOptions = { signals: "Avoid traffic lights", highways: "Avoid highways", major: "Avoid major streets" };
  function routePreferences() {
    try { return JSON.parse(localStorage.getItem("sn:routes:" + checkoutAccount()) || "{}") || {}; }
    catch { return {}; }
  }
  async function preferredRoute(routes, prefs) {
    if (routes.length < 2 || !Object.keys(routeOptions).some(key => prefs[key])) return routes[0];
    var paths = routes.map(route => new Set(route.legs.flatMap(leg => leg.annotation?.nodes || [])));
    var ids = Array.from(new Set(paths.flatMap(path => Array.from(path))));
    if (!ids.length || ids.length > 12000) return routes[0];
    var filters = [];
    if (prefs.signals) filters.push('node.n[highway=traffic_signals];');
    if (prefs.highways) filters.push('way(bn.n)[highway~"^(motorway|trunk)(_link)?$"];');
    if (prefs.major) filters.push('way(bn.n)[highway~"^(primary|secondary)(_link)?$"];');
    var query = '[out:json][timeout:6];node(id:' + ids.join(",") + ')->.n;(' + filters.join("") + ');out body;';
    var data = await fetchJson("https://overpass-api.de/api/interpreter", { method: "POST",
      body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(8000) });
    if (!data || !Array.isArray(data.elements)) return routes[0];
    var penalties = new Set(data.elements.flatMap(el => el.nodes || [el.id]));
    var scores = paths.map(path => Array.from(path).filter(id => penalties.has(id)).length);
    return routes[scores.indexOf(Math.min(...scores))];
  }
  function drawRoute(from, to, driver) {
    if (!map || typeof L === "undefined") return;
    clearRoute();
    map.setMinZoom(2);
    var revision = routeRevision;
    var stops = driver && [driver.lat,driver.lng].every(Number.isFinite) ? [driver, from, to] : [from, to];
    routeLayer = L.polyline(stops.map(function (p) { return [p.lat, p.lng]; }), {
      className: "sn-route-line", color: "#79dfff", weight: 4, opacity: 0.95, dashArray: "6 5"
    }).addTo(map);
    fitOfferRoute();
    var coords = stops.map(function (p) { return p.lng + "," + p.lat; }).join(";");
    var url = "https://router.project-osrm.org/route/v1/driving/" + coords + "?overview=full&geometries=geojson";
    var prefs = routePreferences();
    if (Object.keys(routeOptions).some(key => prefs[key])) url += "&alternatives=true&annotations=nodes";
    fetchJson(url).then(async function (j) {
      if (revision !== routeRevision) return;
      var best = j && j.routes && j.routes.length && await preferredRoute(j.routes, prefs);
      if (revision !== routeRevision) return;
      var geo = best && best.geometry;
      if (geo && geo.coordinates && geo.coordinates.length > 1) {
        routeLayer.setLatLngs(geo.coordinates.map(function (c) { return [c[1], c[0]]; }));
        routeLayer.setStyle({ dashArray: null });
        fitOfferRoute();
      }
    });
  }
  function sendJob() {
    if (!vendor || !drop) return;
    if (!signed()) return;
    var q = quoteDelivery(vendor, drop, quoteOpts);
    var due = orderCharge(0, q.total);
    if (avcGet() < due) {
      openSheet("TOP UP AV€",
        '<p class="note">Delivery and 3% fee ' + due + " AV€ due upfront. You have " + Math.round(avcGet()) + " AV€.</p>" +
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
    recordOrderPayment(job, due, cartFee(q.total));
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
  var hist = [];
  function speakIfVoice(s, fromVoice) {
    if (!fromVoice) return;
    var volume = soundLevel("helper");
    if (!volume) return;
    try {
      if (!window.speechSynthesis) return;
      speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(String(s || "").slice(0, 280));
      u.lang = /[\u0370-\u03ff]/.test(s) ? "el-GR" : "en-GB";
      u.volume = volume;
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
      renderVendorShop(); return;
    }

  }
  var drawerAI = false;
  var aiStatus = "";
  var aiPending = false;
  function showAI(status) {
    if (newsSelection) stopNews();
    drawerAI = true;
    drawerHome = false;
    drawerNews = "";
    clearDrawerPlacement();
    $("logo").setAttribute("aria-expanded", "false");
    if ($("sn-sheet").classList.contains("on")) closeSheet();
    setDrawerHeight(Math.max(drawerH, Math.round(window.innerHeight * 0.42)));
    updateAIStatus(status);
  }
  function updateAIStatus(status) {
    aiStatus = status;
    paintDrawerContent();
    var live = $("sn-ai-live");
    if (live) live.textContent = status;
    var sheet = $("sheet");
    if (drawerAI && sheet) sheet.scrollTop = sheet.scrollHeight;
  }
  function talk(raw, fromVoice) {
    var q = String(raw || "").trim();
    if (!q) return;
    if (aiPending) { showAI("Wait for SpaceNet AI to finish answering."); return; }
    aiPending = true;
    var conversation = hist.slice(-16);
    hist.push({ role: "user", content: q });
    activeExchange.push({ role: "user", content: q });
    if (hist.length > 24) hist = hist.slice(-24);
    if (activeExchange.length > 24) activeExchange = activeExchange.slice(-24);
    showAI("SpaceNet AI is thinking…");
    var vendors = shops.slice(0, 8).map(function (s) { return s.name; });
    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: q,
        free_only: true,
        history: conversation,
        here: {
          lat: here && here.lat,
          lng: here && here.lng,
          place: here && here.name,
          level: cityOn ? "street" : tierI === 3 ? "national" : "globe",
          shop: vendor && vendor.name,
          vendors: vendors
        }
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j || j.ok === false || !(j.say || j.text)) throw new Error("AI unavailable");
      var text = j.say || j.text;
      hist.push({ role: "assistant", content: text });
      activeExchange.push({ role: "assistant", content: text });
      updateAIStatus("");
      if (drawerAI) {
        $("sn-ai-live").textContent = text;
        speakIfVoice(text, fromVoice);
        applyAct(j, q);
      }
    }).catch(function () {
      var fallback = "SpaceNet AI is unavailable right now.";
      hist.push({ role: "assistant", content: fallback });
      activeExchange.push({ role: "assistant", content: fallback });
      updateAIStatus(fallback);
      if (drawerAI && !fromVoice) hunt(q);
    }).finally(function () { aiPending = false; });
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
  var resourceFrames = 0;
  function bindMonitor() {
    var button = $("sn-resources"), dialog = $("sn-resource-dialog");
    if (!button || !dialog) return;
    var battery = null, blockedMs = 0, observer = null;
    var probeAt = 0, responseMs = null, probeFailed = false, probing = false;
    if (navigator.getBattery) {
      Promise.resolve().then(function () { return navigator.getBattery(); })
        .then(function (value) { battery = value; }).catch(function () {});
    }
    if (window.PerformanceObserver && (PerformanceObserver.supportedEntryTypes || []).includes("longtask")) {
      try {
        observer = new PerformanceObserver(function (list) {
          list.getEntries().forEach(function (entry) { blockedMs += entry.duration; });
        });
        observer.observe({ type: "longtask" });
      } catch (e) { observer = null; }
    }
    var metrics = [
      {name:"Battery",color:"#70e5ff"}, {name:"RAM",color:"#57aaff"},
      {name:"CPU",color:"#4897e0"}, {name:"Network",color:"#a5eaff"},
      {name:"Temperature",color:"#888fff"}
    ];
    var metricAlerts=[], fileHandle=null, readingFile=false, hardware=null;
    var connect=$("sn-connect-monitor"), source=$("sn-monitor-source");
    connect.disabled=!window.showOpenFilePicker;
    if(connect.disabled) source.textContent="Live file access requires a desktop browser with a file picker such as Chrome or Edge.";
    connect.onclick=async function(){
      if(fileHandle){fileHandle=null;hardware=null;history=[];connect.textContent="Connect readings file";source.textContent="Browser readings";sample();return;}
      try {
        var handles=await window.showOpenFilePicker({types:[{description:"Astranov resource readings",accept:{"application/json":[".json"]}}]});
        fileHandle=handles[0];history=[];connect.textContent="Disconnect hardware readings";await readHardware();sample();
      } catch(error){if(error.name!=="AbortError")source.textContent="Could not open the readings file.";}
    };
    async function readHardware(){
      var handle=fileHandle;
      if(!handle || readingFile || document.hidden)return;
      readingFile=true;
      try {
        var file=await handle.getFile();
        if(file.size>8192) throw Error();
        var data=JSON.parse(await file.text());
        if(data.format!=="astranov-resources-v1" || !Number.isFinite(data.timestamp) || Math.abs(Date.now()-data.timestamp*1000)>10000) throw Error();
        if(handle===fileHandle){hardware=data;source.textContent="Live readings from this computer";}
      } catch {
        if(handle===fileHandle){hardware=null;source.textContent="Hardware readings stopped. Check the helper and reconnect its file.";}
      } finally {readingFile=false;}
    }
    async function probeNetwork() {
      if (probing || !navigator.onLine || document.hidden) return;
      probing = true;
      probeAt = performance.now();
      var controller = new AbortController();
      var timeout = setTimeout(function () { controller.abort(); }, 4500);
      try {
        var response = await fetch("/api/version?probe=" + Date.now(), { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Version endpoint unavailable");
        await response.json();
        responseMs = Math.round(performance.now() - probeAt);
        probeFailed = false;
      } catch (e) {
        responseMs = null;
        probeFailed = true;
      } finally {
        clearTimeout(timeout);
        probing = false;
      }
    }
    var history = [], values = [], alerts = [], lastSample = performance.now();
    function draw(canvas, overview) {
      var w = overview ? canvas.clientWidth : canvas.width;
      var h = overview ? canvas.clientHeight : canvas.height;
      var scale = overview ? window.devicePixelRatio || 1 : 1;
      if (overview) {
        if (canvas.width !== Math.round(w * scale)) canvas.width = Math.round(w * scale);
        if (canvas.height !== Math.round(h * scale)) canvas.height = Math.round(h * scale);
      }
      var graph = canvas.getContext("2d");
      graph.setTransform(scale, 0, 0, scale, 0, 0);
      graph.clearRect(0, 0, w, h);
      if (!overview) {
        graph.strokeStyle = "rgba(126,233,255,.2)";
        graph.lineWidth = 1;
        for (var line = 1; line <= 3; line++) {
          graph.beginPath(); graph.moveTo(0, h * line / 4); graph.lineTo(w, h * line / 4); graph.stroke();
        }
      }
      metrics.forEach(function(metric,i){
        graph.lineWidth=overview?1.5:2;
        var previous=null;
        history.forEach(function(sample,j){
          var value=sample.lines[i];
          if(!Number.isFinite(value)){previous=null;return;}
          var x=2+(w-4)*j/Math.max(1,history.length-1);
          var y=h-3-(h-6)*Math.min(1,Math.max(0,value));
          graph.strokeStyle=sample.high[i]?"#ff526e":metric.color;
          graph.beginPath();graph.moveTo(previous?.x ?? x-1,previous?.y ?? y);graph.lineTo(x,y);graph.stroke();
          previous={x,y};
        });
      });
    }
    function renderDetails() {
      draw($("sn-resource-chart"), false);
      $("sn-resource-readings").innerHTML = metrics.map(function (metric, i) {
        var lastAlert=history.slice().reverse().find(point=>point.high[i]);
        return '<dt><i style="background:' + (metricAlerts[i]?"#ff526e":metric.color) + '"></i>' + metric.name + '</dt><dd>' +
          escHtml(values[i] || "Unavailable") + (metricAlerts[i]?' · Alert':'') + (lastAlert && !metricAlerts[i]?' · Recent alert: '+escHtml(lastAlert.values[i]):'') + '</dd>';
      }).join("");
    }
    function sample() {
      var now = performance.now(), elapsed = now - lastSample;
      lastSample = now;
      var heap = performance.memory;
      var ram = heap && heap.jsHeapSizeLimit > 0 ? heap.usedJSHeapSize / heap.jsHeapSizeLimit : null;
      var cpu = observer && elapsed > 0 ? Math.min(1, blockedMs / elapsed) : null;
      var frames = elapsed >= 500 ? Math.round(resourceFrames * 1000 / elapsed) : null;
      var connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
      var downlink = connection && Number.isFinite(connection.downlink) ? connection.downlink : null;
      var level = battery && Number.isFinite(battery.level) ? battery.level : null;
      var offline = !navigator.onLine;
      var memory = [];
      var performanceReadings = [];
      var network = [];
      blockedMs = 0;
      resourceFrames = 0;
      if (document.hidden) return;
      if (!fileHandle && now - probeAt >= 15000) probeNetwork();
      if (Number.isFinite(navigator.deviceMemory)) memory.push("Approx. " + navigator.deviceMemory + " GB device RAM");
      if (ram != null) memory.push(Math.round(ram * 100) + "% of JS heap limit");
      if (Number.isFinite(navigator.hardwareConcurrency)) performanceReadings.push(navigator.hardwareConcurrency + " logical cores visible");
      if (frames != null) performanceReadings.push(frames + " app FPS");
      if (cpu != null) performanceReadings.push(Math.round(cpu * 100) + "% page long-task time");
      if (downlink != null) network.push(downlink + " Mbps estimate");
      if (responseMs != null) network.push(responseMs + " ms SpaceNet response");
      else if (probeFailed) network.push("SpaceNet response unavailable");
      values = [
        level == null ? "Unavailable in this browser" : Math.round(level * 100) + "%" + (battery.charging ? " · charging" : ""),
        memory.join(" · ") || "Unavailable in this browser",
        performanceReadings.join(" · ") || "Unavailable in this browser",
        offline ? "Offline" : network.join(" · ") || "Online",
        "Unavailable in this browser"
      ];
      alerts = [];
      if (level != null && level <= .15 && !battery.charging) alerts.push("Low battery");
      if (ram != null && ram >= .9) alerts.push("JS heap near limit");
      if (cpu != null && cpu >= .8) alerts.push("Main thread busy");
      if (offline) alerts.push("Network offline");
      var appPressure = cpu != null ? cpu : frames == null ? null : Math.max(0, 1 - frames / 60);
      var networkPressure = offline ? 1 : responseMs == null ? null : Math.min(1, responseMs / 1000);
      var lines=[level,ram,appPressure,networkPressure,null];
      metricAlerts=[level!=null && level<=.15 && !battery.charging,ram>=.9,cpu>=.8,offline || probeFailed || responseMs>=1000,false];
      if(fileHandle) {
        var d=hardware || {};
        function pct(n){return Number.isFinite(n)?n/100:null;}
        lines=[pct(d.battery),pct(d.ram),pct(d.cpu),pct(d.network_percent),Number.isFinite(d.temperature)?d.temperature/100:null];
        values=[d.battery,d.ram,d.cpu].map(n=>Number.isFinite(n)?n.toFixed(1)+"%":"Sensor unavailable");
        values.push(Number.isFinite(d.mbps)?d.mbps.toFixed(2)+" Mbps"+(Number.isFinite(d.network_percent)?" · "+d.network_percent.toFixed(1)+"% link load":" · link capacity unavailable"):"Interface unavailable");
        values.push(Number.isFinite(d.temperature)?d.temperature.toFixed(1)+" °C":"Temperature sensor unavailable");
        metricAlerts=[lines[0]!=null && lines[0]<=.15 && d.charging===false,lines[1]>=.9,lines[2]>=.8,lines[3]>=.9,Number.isFinite(d.temperature) && d.temperature>=(d.temperature_limit || 85)];
      }
      alerts=metrics.filter((m,i)=>metricAlerts[i]).map(m=>m.name);
      history.push({lines:lines,high:metricAlerts.slice(),values:values.slice()});
      if (history.length > 60) history.shift();
      var label = "Device resources" + (alerts.length ? " · " + alerts.join(", ") : "");
      button.classList.toggle("alert", alerts.length > 0);
      button.title = label;
      button.setAttribute("aria-label", label);
      draw($("sn-spark"), true);
      if (dialog.open) renderDetails();
    }
    button.addEventListener("click", function () {
      renderDetails();
      dialog.showModal();
      probeNetwork();
    });
    sample();
    setInterval(async function(){await readHardware();sample();}, 1000);
    window.addEventListener("online", sample);
    window.addEventListener("offline", sample);
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
    var money = $("sn-money");
    var powerBtn = $("sn-power"), soundBtn = $("sn-sound"), supportBtn = $("sn-support"), burgerBtn = $("sn-burger");
    var rowGap = 8;
    if (powerBtn && burgerBtn) {
      var brr = burgerBtn.getBoundingClientRect();
      if (brr && brr.bottom) {
        powerBtn.style.setProperty("left", Math.round(brr.left) + "px", "important");
        powerBtn.style.setProperty("right", "auto", "important");
        powerBtn.style.setProperty("top", Math.round(brr.bottom + rowGap) + "px", "important");
        powerBtn.style.setProperty("bottom", "auto", "important");
        if (soundBtn) {
          soundBtn.style.left = Math.round(brr.left) + "px";
          soundBtn.style.top = Math.round(brr.bottom + 2 * rowGap + powerBtn.offsetHeight) + "px";
        }
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
    var upperControls = Math.max(powerBtn ? powerBtn.getBoundingClientRect().bottom : 0,
      supportBtn ? supportBtn.getBoundingClientRect().bottom : 0);
    document.body.classList.toggle("drawer-covers-map-controls", H - lift < upperControls + 56);
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
  var drawerH = collapsedDrawerH();
  var drawerDrag = null;
  var cancelDrawerCoast;
  var cityRadarLayers = [];
  function maxDrawerH() { return Math.max(collapsedDrawerH(), window.innerHeight - 64); }
  function setDrawerHeight(h, dragging) {
    var d = $("drawer");
    if (!d) return;
    if (!dragging && cancelDrawerCoast) cancelDrawerCoast();
    var minH = collapsedDrawerH();
    var maxH = maxDrawerH();
    drawerH = Math.max(minH, Math.min(maxH, Math.round(h)));
    d.style.height = drawerH + "px";
    document.documentElement.style.setProperty("--drawer-h", drawerH + "px");
    var open = drawerH > minH + 8;
    if (!open && newsSelection && newsPlayerReady) newsPlayer.pauseVideo();
    d.classList.toggle("open", open);
    $("handle").setAttribute("aria-expanded", String(open));
    $("handle").setAttribute("aria-label", open ? "Collapse sheet" : "Expand sheet");
    layoutChrome();
    if (dragging) return;
    if (map && typeof map.invalidateSize === "function") {
      try { map.invalidateSize({ animate: false }); } catch (e) {}
    }
    if (routeLayer) fitOfferRoute();
  }
  function escHtml(t) {
    return String(t == null ? "" : t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }
  function transactionKey(purpose, account) { return "sn:" + purpose + ":" + account; }
  function loadAccountRows(purpose, account) {
    try {
      var rows = JSON.parse(localStorage.getItem(transactionKey(purpose, account)) || "[]");
      return Array.isArray(rows) ? rows : [];
    } catch (e) { return []; }
  }
  function writeAccountRows(purpose, account, rows) {
    try { localStorage.setItem(transactionKey(purpose, account), JSON.stringify(rows)); return true; }
    catch (e) { return false; }
  }
  function loadTxns() {
    var account = checkoutAccount();
    txns = account ? loadAccountRows("txns", account) : [];
  }
  function pullTxnsRemote() {
    var account = checkoutAccount(), token = authToken();
    if (!account) return;
    fetch("/api/transactions", {
      headers: { Authorization: "Bearer " + token, Accept: "application/json" }
    }).then(function (r) { return r.json(); }).then(function (j) {
      if (account !== checkoutAccount() || !j || !j.ok || !Array.isArray(j.items)) return;
      var united = new Map(loadAccountRows("txns", account).map(function (row) { return [row.client_id, row]; }));
      j.items.forEach(function (row) { united.set(row.client_id || row.id, row); });
      var sorted = Array.from(united.values()).sort(function (a, b) {
        return String(b.completed_at || b.created_at || "").localeCompare(String(a.completed_at || a.created_at || ""));
      });
      writeAccountRows("txns", account, sorted.slice(0, 400));
      paintDrawerContent();
    }).catch(function () {});
  }
  var txnsFlushing = new Set();
  async function flushTransactions() {
    var account = checkoutAccount(), token = authToken();
    if (!account || txnsFlushing.has(account)) return;
    txnsFlushing.add(account);
    try {
      while (account === checkoutAccount() && token === authToken()) {
        var pending = loadAccountRows("txn-outbox", account);
        if (!pending.length) break;
        var current = pending[0];
        var response = await fetch("/api/transactions", {
          method: "POST",
          headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
          body: JSON.stringify(current)
        });
        var result = await response.json();
        if (!response.ok || !result.ok) break;
        var remaining = loadAccountRows("txn-outbox", account).filter(function (row) {
          return row.client_id !== current.client_id || JSON.stringify(row) !== JSON.stringify(current);
        });
        if (!writeAccountRows("txn-outbox", account, remaining)) break;
      }
    } catch (err) {
      // The next online event, sign-in, or transaction retries the saved rows.
    } finally { txnsFlushing.delete(account); }
  }
  function recordTransaction(row) {
    var account = checkoutAccount();
    if (!account) return;
    var queued = loadAccountRows("txn-outbox", account);
    var local = loadAccountRows("txns", account);
    if (!writeAccountRows("txn-outbox", account, [row].concat(queued.filter(function (entry) { return entry.client_id !== row.client_id; })))) {
      say("Transaction history could not be saved on this device.");
      return;
    }
    writeAccountRows("txns", account, [row].concat(local.filter(function (entry) { return entry.client_id !== row.client_id; })).slice(0, 400));
    flushTransactions();
  }
  function recordOrderPayment(job, amount, platformFee) {
    recordTransaction({
      client_id: "pay-" + job.id, kind: "order_payment", status: "paid",
      summary: (job.vendor && job.vendor.name) || "Order",
      amount_avc: amount, created_at: new Date(job.t).toISOString(),
      payload: { order_id: job.id, platform_fee: platformFee, delivery_fee: job.fee,
        vendor_id: job.vendor && profileId(job.vendor), client_location_id: job.drop && job.drop.id }
    });
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
        vendor_id: job && job.vendor && profileId(job.vendor),
        driver_id: job && (job.driverId || (job.driver && job.driver.id)),
        client_location_id: job && job.drop && job.drop.id,
        drop: job && (job.drop || job.to)
      },
      exchange: (exchange || activeExchange || []).slice(-24),
      created_at: (job && job.created_at) || new Date().toISOString(),
      completed_at: new Date().toISOString()
    };
    recordTransaction(row);
    activeExchange = [];
    /* Close current-task chrome; history remains. */
    dockTabs = dockTabs.filter(function (t) { return !(t.kind === "offer" && String(t.jobId) === String(job && job.id)); });
    offerActiveId = null;
    pendingOffer = null;
    paintOfferHud();
    paintDockTabs();
    paintDrawerContent();
    setDrawerHeight(collapsedDrawerH());
  }
  function transactionDate(value) {
    return value ? new Date(value).toLocaleString(undefined, { timeZone: "Europe/Athens" }) : "";
  }
  function transactionType(kind) {
    if (kind === "invoice") return "Invoice";
    if (kind === "test_order") return "Test order";
    if (kind === "order_payment") return "Order payment";
    if (kind === "delivery") return "Delivery";
    return String(kind || "").replace(/^wallet:/, "Wallet · ").replace(/[_-]/g, " ");
  }
  async function historyPage(filters, offset, limit) {
    var token = authToken();
    var params = new URLSearchParams(Object.assign({ history: "1", offset: offset, limit: limit }, filters));
    var response = await fetch("/api/transactions?" + params, {
      headers: { Authorization: "Bearer " + token }, cache: "no-store"
    });
    var data = await response.json();
    if (token !== authToken() || !response.ok || !data.ok) throw new Error("History could not be loaded.");
    return data;
  }
  function saveTransactionFile(name, content, type) {
    var url = URL.createObjectURL(new Blob([content], { type: type + ";charset=utf-8" }));
    var download = document.createElement("a");
    download.href = url;
    download.download = name;
    download.click();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  function downloadInvoice(row) {
    var doc = row.document;
    if (!doc || row.kind !== "invoice") return;
    var items = Array.isArray(doc.items) ? doc.items : [];
    var contents = '<!doctype html><html lang="en"><meta charset="utf-8"><title>' + escHtml(doc.id) +
      '</title><style>body{font:15px system-ui;margin:40px}td,th{padding:6px;text-align:left}table{border-collapse:collapse}tr{border-bottom:1px solid #bbb}</style>' +
      '<h1>Invoice ' + escHtml(doc.id) + '</h1><p>' + escHtml(transactionDate(row.event_at)) + ' · Athens time</p>' +
      '<p>Vendor ' + escHtml(doc.vendor) + ' · Order ' + escHtml(doc.order_id) + '</p>' +
      '<p>Record mark ' + escHtml(doc.mark || "Unavailable") +
      (doc.mydata_mark && !/^LOCAL-/i.test(doc.mydata_mark) ? ' · myDATA ' + escHtml(doc.mydata_mark) : '') + '</p>' +
      '<table><thead><tr><th>Item</th><th>Quantity</th><th>Unit price</th></tr></thead><tbody>' +
      items.map(function (item) {
        return '<tr><td>' + escHtml(item.name || item.title || "") + '</td><td>' + escHtml(item.qty || item.quantity || "") +
          '</td><td>' + escHtml(item.price != null ? item.price : item.unit_price) + '</td></tr>';
      }).join("") + '</tbody></table>' +
      '<p>Subtotal ' + escHtml(doc.subtotal) + ' · Delivery ' + escHtml(doc.delivery_fee) + ' · Platform fee ' + escHtml(doc.platform_fee) +
      '</p><p><b>Total ' + escHtml(doc.total) + ' ' + escHtml(row.currency) + '</b></p></html>';
    saveTransactionFile(String(doc.id).replace(/[^\w.-]/g, "_") + ".html", contents, "text/html");
  }
  function csvCell(value) {
    var text = String(value == null ? "" : value);
    if (typeof value === "string" && /^\s*[=+\-@]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  async function exportHistory(filters) {
    var lines = ["Date (UTC),Type,Status,Description,Amount,Currency,Source,Role,Record ID,Account ID,Invoice ID,Platform fee,Retain until"];
    var offset = 0, page;
    do {
      page = await historyPage(filters, offset, 250);
      page.items.forEach(function (row) {
        lines.push([row.event_at, row.kind, row.status, row.summary, Number(row.amount), row.currency, row.source,
          row.access_role, row.id, row.account_id, row.document && row.document.id,
          row.document && row.document.platform_fee != null ? Number(row.document.platform_fee) : "", row.retain_until].map(csvCell).join(","));
      });
      offset += page.items.length;
    } while (page.items.length && offset < page.count);
    saveTransactionFile("spacenet-transactions.csv", "\ufeff" + lines.join("\r\n"), "text/csv");
  }
  var holdRoutes = [], holdAccount = "";
  function clearHoldRoutes() {
    holdRoutes.forEach(line => line.remove());
    holdRoutes = [];
  }
  async function openOrderHolds(id) {
    var account = checkoutAccount();
    var data = await dispatchRequest("order_hold",{});
    if (account !== checkoutAccount()) return;
    clearHoldRoutes();
    holdAccount = account;
    var rows = data.orders;
    if (!Array.isArray(rows)) { showDrawerPlacement("Order payments","<p>Could not load order payments. Sign in and retry.</p>"); return; }
    rows.forEach(row => {
      if (!map || !["held","review","disputed"].includes(row.state) ||
          ![row.origin,row.destination].every(pt=>Array.isArray(pt) && pt.length===2 && pt.every(Number.isFinite))) return;
      holdRoutes.push(L.polyline([row.origin,row.destination],{color:"#42cfff",weight:5,dashArray:"6 4"}).addTo(map)
        .on("click",()=>openOrderHolds(row.id)));
    });
    var row = rows.find(r=>r.id===id);
    if (!row) {
      showDrawerPlacement("Order payments", rows.map(r=>'<button class="sheet-go" data-act="hold-open" data-id="'+escHtml(r.id)+'">'+escHtml(r.name)+' · '+escHtml(r.state)+' · '+escHtml(r.total)+' AVC</button>').join(" ") || "<p>No prepaid orders.</p>");
      return;
    }
    var log = await dispatchRequest("order_hold",{id:id});
    if (account !== checkoutAccount()) return;
    var editable = ["held","review","disputed"].includes(row.state);
    var actions = editable ? row.roles.map(role=>{
      var options = row.state==="review" && role!=="admin" ? [] : [
        ["delivered",role==="vendor"?"I dispatched the goods":role==="driver"?"I delivered the order":role==="buyer"?"I received the order":"Release payment"],
        ["refund","Refund client "+row.total+" AVC"],
        ["driver_damage","Driver pays vendor "+row.goods+" AVC · refund client "+row.total+" AVC"],
        ["review","Request administrator review"]];
      options.push(["note","Add explanation"]);
      return '<fieldset><legend>'+escHtml(role)+'</legend>'+options.map(([decision,label])=>'<button class="sheet-go" data-act="hold-vote" data-role="'+role+'" data-decision="'+decision+'" data-id="'+escHtml(id)+'">'+escHtml(label)+'</button>').join(" ")+'</fieldset>';
    }).join("") : "";
    showDrawerPlacement(row.name, '<p>'+escHtml(row.state)+' · Goods '+escHtml(row.goods)+' AVC · Delivery '+escHtml(row.delivery)+' AVC · Total '+escHtml(row.total)+' AVC</p>'+
      (log.history || []).map(e=>'<p>'+escHtml(e.role)+' · '+escHtml(e.decision)+' '+escHtml(e.note)+'</p>').join("")+
      (editable?'<label>Explanation<textarea class="field" maxlength="1500" id="hold-explanation"></textarea></label>':'')+actions+
      '<button class="sheet-go" data-act="hold-open">All order payments</button>');
  }
  function openTransactionHistory() {
    if (!checkoutAccount()) {
      openSheet("Transactions", '<p class="note">Sign in to view your account history and invoices.</p>' +
        '<button type="button" class="sheet-go primary" data-act="history-sign-in">Sign in</button>');
      return;
    }
    openSheet("Transactions", '<form id="sn-history" class="test-form">' +
      '<button type="button" class="sheet-go" data-act="hold-open">Order payments and disputes</button><div class="test-times"><label>From (Athens time)<input type="date" class="field" name="from"></label>' +
      '<label>Through (Athens time)<input type="date" class="field" name="to"></label></div>' +
      '<div class="test-times"><label>Type<select class="field" name="kind"><option value="">All types</option></select></label>' +
      '<label>Order<select class="field" name="sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label></div>' +
      '<label id="sn-history-scope" hidden>Accounts<select class="field" name="scope"><option value="own">My account</option><option value="all">All accounts</option></select></label>' +
      '<button class="sheet-go primary">Apply filters</button> <button type="button" class="sheet-go" id="sn-history-export" disabled>Export CSV</button>' +
      '<p id="sn-history-status" class="note" role="status"></p>' +
      '<div id="sn-history-totals"></div><div id="sn-history-rows"></div>' +
      '<button type="button" class="sheet-go" id="sn-history-more" hidden>Show more</button></form>');
    flushTransactions();
    var form = $("sn-history"), status = $("sn-history-status"), totals = $("sn-history-totals"), rows = $("sn-history-rows");
    var more = $("sn-history-more"), exportButton = $("sn-history-export");
    var filters, offset = 0, generation = 0;
    async function load(reset) {
      var request = ++generation;
      if (reset) { rows.replaceChildren(); totals.replaceChildren(); filters = Object.fromEntries(new FormData(form)); offset = 0; }
      more.hidden = true;
      exportButton.disabled = true;
      status.textContent = "Loading transactions…";
      try {
        var page = await historyPage(filters, offset, 50);
        if (!form.isConnected || request !== generation) return;
        var types = form.elements.kind;
        types.replaceChildren(new Option("All types", ""));
        page.types.forEach(function (kind) { types.append(new Option(transactionType(kind), kind)); });
        types.value = filters.kind;
        $("sn-history-scope").hidden = !page.admin;
        if (reset) totals.innerHTML = page.totals.map(function (line) {
          return '<p class="note">' + escHtml(transactionType(line.kind)) + ' · ' + line.count + ' · ' +
            escHtml(line.total) + ' ' + escHtml(line.currency) +
            (line.source === "client_recorded" ? ' · client-recorded' : '') + '</p>';
        }).join("");
        page.items.forEach(function (row) {
          var entry = document.createElement("article");
          entry.className = "sn-txn";
          entry.innerHTML = '<b>' + escHtml(transactionType(row.kind)) + ' · ' + escHtml(row.summary) + '</b>' +
            '<span>' + escHtml(transactionDate(row.event_at)) + ' · ' + escHtml(row.status) + ' · ' +
            escHtml(row.amount) + ' ' + escHtml(row.currency) + (row.kind === "invoice" ? ' · ' + escHtml(row.access_role) : '') + '</span>' +
            (row.source === "client_recorded" ? '<span>Client-recorded</span>' : '') +
            (row.account_id ? '<span>Account ' + escHtml(row.account_id) + '</span>' : '');
          if (row.kind === "invoice" && row.document) {
            var button = document.createElement("button");
            button.type = "button";
            button.className = "sheet-go";
            button.textContent = "Download invoice";
            button.addEventListener("click", function () { downloadInvoice(row); });
            entry.append(button);
          }
          rows.append(entry);
        });
        offset += page.items.length;
        status.textContent = page.count ? offset + " of " + page.count + " records" : "No transactions match.";
        more.hidden = offset >= page.count;
        exportButton.disabled = !page.count;
      } catch (err) {
        if (request === generation) status.textContent = "Transaction history is unavailable.";
      }
    }
    form.addEventListener("submit", function (e) { e.preventDefault(); load(true); });
    more.addEventListener("click", function () { load(false); });
    exportButton.addEventListener("click", async function () {
      exportButton.disabled = true;
      status.textContent = "Preparing CSV…";
      try { await exportHistory(filters); status.textContent = "CSV downloaded."; }
      catch (err) { status.textContent = "CSV export failed."; }
      finally { exportButton.disabled = false; }
    });
    load(true);
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
    return '<div class="sn-exch">' + rows.map(function (m) {
      var role = m.role === "user" ? "YOU" : "AI";
      return '<div class="sn-exch-row ' + (m.role === "user" ? "u" : "a") + '"><b>' + role + "</b><span>" + escHtml(m.content) + "</span></div>";
    }).join("") + "</div>";
  }
  function txnsHtml() {
    loadTxns();
    if (!txns.length) return '<p class="note">No stored transactions yet.</p>';
    return '<div class="sn-txns"><h3>TRANSACTIONS</h3>' + txns.slice(0, 40).map(function (t) {
      var when = "";
      try { when = new Date(t.completed_at || t.created_at).toLocaleString("en-GB"); } catch (e) {}
      var retain = t.retain_until ? (" · keep→" + String(t.retain_until).slice(0, 10)) : " · keep≥6y";
      return '<div class="sn-txn"><b>' + escHtml(t.summary || t.client_id || "tx") + "</b><span>" + escHtml(when + retain) + "</span></div>";
    }).join("") + "</div>";
  }
  function paintDrawerCart(profile) {
    var footer = $("sn-drawer-cart");
    var active = !!(profile && vendor && profileIsVendor(profile.actor) && profileId(profile.actor) === profileId(vendor));
    var state = profile && profileOrdersFor(profile.actor);
    footer.hidden = !profile;
    if (footer.hidden) return;
    var subtotal = cartSubtotal();
    var items = Object.values(cart.items).reduce(function (count, qty) { return count + qty; }, 0);
    var html = (active && !state?.history ? '<div class="drawer-cart-line"><span>Cart · ' + items + (items === 1 ? ' item' : ' items') +
      ' · <b>' + subtotal + ' AV€</b></span>' +
      '<button type="button" class="sheet-go primary" data-act="' + (usesTestCheckout(profile.actor) ? "test-checkout" : "open-order") + '"' +
      (subtotal > 0 ? '' : ' disabled') + '>Place order</button>'+trackingMarkup(profileId(vendor))+'</div>' : '') +
      '<nav class="drawer-cart-links" aria-label="Profile sections">' +
      (state && state.data ? '<button type="button" class="sheet-go" data-act="profile-orders">History</button>' : '<span></span>') +
      '<button type="button" class="sheet-go chat-button" data-unread="'+ (chatCount.account===checkoutAccount() && chatCount.key===profileId(profile.actor) && chatCount.value>0) +'" data-act="profile-chat">Messaging <b>'+ (chatCount.key===profileId(profile.actor) && chatCount.account===checkoutAccount()?chatCount.value:0) +'</b></button></nav>';
    if (footer.__snBody !== html) {
      footer.__snBody = html;
      footer.innerHTML = html;
    }
  }
  var chatCount={};
  function chatTarget(actor) {
    return actor.discovered || (profileIsVendor(actor) && !actor.accountId && !actor.peer) ? {vendor:profileId(actor)} : {peer:actor.accountId || actor.peer || actor.id};
  }
  async function refreshChatCount() {
    var actor=drawerProfile?.actor, account=checkoutAccount();
    if (!actor || !account) return;
    var data=await listingAction({...chatTarget(actor),kind:actor.self?"chat-list":"chat-count"});
    if (actor!==drawerProfile?.actor || account!==checkoutAccount() || !data?.ok) return;
    chatCount={key:profileId(actor),account:account,value:data.threads ? data.threads.reduce((n,row)=>n+Number(row.unread),0) : data.unread || 0};
    if (!$("sn-drawer-cart").hidden) paintDrawerCart(drawerProfile);
  }
  function openProfileChat(target,title) {
    if (!checkoutAccount()) {openOwnProfile();return;}
    openSheet(title || "Messaging",'<button hidden id="chat-older" class="sheet-go">Earlier messages</button><div id="chat-log" role="log"></div><form id="chat-compose"><textarea class="field" required maxlength="1000" aria-label="Message"></textarea><button class="sheet-go" disabled>Send</button><p role="status"></p></form>');
    var form=$("chat-compose"), log=$("chat-log"), older=$("chat-older"), account=checkoutAccount();
    var entries=new Map(), exhausted=false, busy=false;
    async function load(kind,previous) {
      if(busy || !form.isConnected || account!==checkoutAccount()) return;
      busy=true;
      var first=log.firstElementChild;
      var data=await listingAction({...target,kind,text:kind==="chat-send"?form.querySelector("textarea").value:undefined,
        before_time:previous && first ? first.dataset.time:undefined,before_id:previous && first ? first.dataset.id:undefined});
      busy=false;
      if (!form.isConnected || account!==checkoutAccount()) return;
      var status=form.querySelector('[role="status"]');
      if (!data?.ok || !data.linked) {status.textContent=data?.ok?"This profile has no linked messaging account yet.":"Conversation unavailable. Try again.";return;}
      form.querySelector("button").disabled=false;
      if(kind==="chat-send") form.reset();
      var rows=data.rows || [];
      if ((previous || !entries.size) && rows.length<50) exhausted=true;
      rows.forEach(row=>entries.set(row.id,row));
      var sorted=Array.from(entries.values()).sort((a,b)=>a.created_at.localeCompare(b.created_at)||a.id.localeCompare(b.id));
      log.innerHTML=sorted.map(row=>'<p data-time="'+escHtml(row.created_at)+'" data-id="'+escHtml(row.id)+'"><b>'+(row.outgoing?'You':'Received')+'</b> '+escHtml(row.body)+' <small>'+escHtml(transactionDate(row.created_at))+'</small></p>').join("");
      older.hidden=exhausted || !entries.size;
      status.textContent=entries.size?"":"No messages yet.";
      refreshChatCount();
    }
    older.onclick=()=>load("chat-open",true);
    form.onsubmit=e=>{e.preventDefault();load("chat-send");};
    load("chat-open");
    var timer=setInterval(()=>{if (!form.isConnected || !$("sn-sheet").classList.contains("on") || account!==checkoutAccount()) clearInterval(timer);else if(!document.hidden) load("chat-open");},5000);
  }
  function jumpToProfileSection(id) {
    if (id !== "profile-messaging") return;
    var target = $(id);
    if (!target) return;
    var sheet = $("sheet");
    if (drawerH <= collapsedDrawerH() + 8) setDrawerHeight(offerDrawerH());
    sheet.scrollTop += target.getBoundingClientRect().top - sheet.getBoundingClientRect().top;
  }
  function paintDrawerContent() {
    var sheet = $("sheet");
    if (!sheet) return;
    var task = currentTaskHtml();
    var body = "";
    var profile = drawerAI || drawerNews || drawerHome || drawerPlacement || offerActiveId ? null : drawerProfile;
    paintDrawerCart(profile);
    if (drawerAI && !offerActiveId) body = '<article class="drawer-profile"><header class="home-title"><h2>SpaceNet AI</h2>' +
      '<button type="button" class="sheet-x" data-act="ai-close" aria-label="Close SpaceNet AI">×</button></header>' +
      (aiStatus ? '<p class="sn-ai-status">' + escHtml(aiStatus) + '</p>' : '') + exchangeHtml() + '</article>';
    else if (drawerNews) body = newsDeskMarkup();
    else if (drawerHome) body = homeMarkup();
    else if (drawerPlacement) body = drawerPlacement;
    else if (profile) body = profileMarkup(profile);
    else {
      if (task) body += '<div class="sn-now">' + task + "</div>";
      body += exchangeHtml();
      body += txnsHtml();
    }
    var profileKey = profile ? profileId(profile.actor) + ":" + checkoutAccount() : "";
    if (sheet.__snBody !== body || sheet.__snProfileKey !== profileKey) {
      var entry = sheet.__snProfileKey === profileKey && sheet.querySelector("form:focus-within[data-profile-action]");
      sheet.__snProfileKey = profileKey;
      var typed = entry && entry.elements.text.value;
      var qtyButton = sheet.contains(document.activeElement) && document.activeElement.closest("[data-i][data-act^=qty-]");
      var focusedQuantity = qtyButton && { index: qtyButton.dataset.i, action: qtyButton.dataset.act };
      var action = entry && entry.dataset.profileAction;
      sheet.__snBody = body;
      sheet.innerHTML = body;
      var replacement = action && sheet.querySelector('[data-profile-action="' + action + '"] textarea');
      if (replacement) { replacement.value = typed; replacement.focus({ preventScroll: true }); }
      if (focusedQuantity) {
        var nextButton = sheet.querySelector('[data-i="' + focusedQuantity.index + '"][data-act="' + focusedQuantity.action + '"]');
        if (nextButton && !nextButton.disabled) nextButton.focus({ preventScroll: true });
      }
    }
  }
  function bindPower() {
    var power = $("sn-power");
    if (!power || power.__sn) return;
    power.__sn = true;
    $("sn-guidance-close").onclick=()=>orderGuidance("");
    var indicator = $("sn-power-count");
    var pointer = null, keyboard = null, timer = 0, started = 0;
    function paint() {
      var on = offersArmed();
      power.classList.toggle("on", on);
      power.classList.toggle("off", !on);
      power.setAttribute("aria-pressed", String(on));
      power.title = "Hold 3 seconds to " + (on ? "turn offers off" : "turn offers on");
    }
    function cancel() {
      clearInterval(timer);
      timer = 0;
      pointer = null;
      keyboard = null;
      indicator.textContent = "";
      power.classList.remove("holding");
    }
    function tick() {
      var remaining = 3000 - (performance.now() - started);
      if (remaining > 0) {
        var count = String(Math.ceil(remaining / 1000));
        if (indicator.textContent !== count) indicator.textContent = count;
        return;
      }
      cancel();
      var on = !offersArmed();
      powerOn=on;
      paint();
      refreshDispatch();
      if (on && testOrder && !testOrder.accepted && !pendingOffer) showTestOffer(testOrder, testOrder.drivers[0]);
      if (!on && pendingOffer) closeOffer(pendingOffer.id);
    }
    function begin() {
      started = performance.now();
      power.classList.add("holding");
      indicator.textContent = "3";
      timer = setInterval(tick, 40);
    }
    paint();
    power.addEventListener("pointerdown", function (e) {
      if (timer || !e.isPrimary || e.button !== 0) return;
      pointer = e.pointerId;
      power.setPointerCapture(pointer);
      begin();
    });
    power.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pointer) return;
      var box = power.getBoundingClientRect();
      if (e.clientX < box.left || e.clientX > box.right || e.clientY < box.top || e.clientY > box.bottom) cancel();
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (type) {
      power.addEventListener(type, function (e) { if (e.pointerId === pointer) cancel(); });
    });
    power.addEventListener("contextmenu", function (e) { e.preventDefault(); });
    power.addEventListener("keydown", function (e) {
      if (e.key !== " " && e.key !== "Enter") return;
      e.preventDefault();
      if (timer || e.repeat) return;
      keyboard = e.key;
      begin();
    });
    power.addEventListener("keyup", function (e) {
      if (e.key === keyboard) cancel();
    });
    power.addEventListener("blur", cancel);
    window.addEventListener("blur", cancel);
    document.addEventListener("visibilitychange", function () { if (document.hidden) cancel(); });
  }
  function bindDrawer() {
    var d = $("drawer"), handle = $("handle");
    if (!d || !handle || d.__snDrawer) return;
    d.__snDrawer = true;
    setDrawerHeight(collapsedDrawerH());
    loadTxns();
    paintDrawerContent();
    pullTxnsRemote();
    flushTransactions();
    function toggleDrawer() {
      setDrawerHeight(d.classList.contains("open") ? collapsedDrawerH() : maxDrawerH());
    }
    handle.addEventListener("click", function (e) {
      if (e.detail === 0 || e.pointerType === "touch") toggleDrawer();
    });
    handle.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "touch" || e.button !== 0 || !e.isPrimary) return;
      drawerDrag = { y: e.clientY, h: drawerH, pid: e.pointerId, moved: false };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", function (e) {
      if (!drawerDrag || e.pointerId !== drawerDrag.pid) return;
      var dy = drawerDrag.y - e.clientY;
      if (Math.abs(dy) < 6 && !drawerDrag.moved) return;
      drawerDrag.moved = true;
      setDrawerHeight(drawerDrag.h + dy, true);
    });
    function endDrag(e) {
      if (!drawerDrag || e.pointerId !== drawerDrag.pid) return;
      var drag = drawerDrag;
      drawerDrag = null;
      if (e.type === "pointercancel") setDrawerHeight(drag.h);
      else if (!drag.moved) toggleDrawer();
      else setDrawerHeight(e.clientY < drag.y ? maxDrawerH() : collapsedDrawerH());
    }
    handle.addEventListener("pointerup", endDrag);
    handle.addEventListener("pointercancel", endDrag);
    var sheet = $("sheet");
    $("sn-news-touch").addEventListener("click", function () {
      if (!newsPlayerReady) return;
      if (newsPlayer.getPlayerState() === 1) newsPlayer.pauseVideo();
      else newsPlayer.playVideo();
    });
    bindNewsFeedback(sheet);
    sheet.addEventListener("submit", submitProfileEntry);
    var touch = null, coastFrame = 0;
    cancelDrawerCoast = function () {
      if (coastFrame) cancelAnimationFrame(coastFrame);
      coastFrame = 0;
    };
    function moveBy(dy, inSheet) {
      var scroll = $("sn-sheet").classList.contains("on") ? $("sn-sheet") : sheet;
      var before = scroll.scrollTop, height = drawerH;
      if (inSheet && dy < 0 && drawerH === maxDrawerH()) {
        scroll.scrollTop += dy;
        dy -= scroll.scrollTop - before;
      }
      if (Math.abs(dy) >= 1) setDrawerHeight(drawerH + dy, true);
      if (inSheet && dy > 0) scroll.scrollTop += Math.max(0, dy - (drawerH - height));
      return { moved: drawerH !== height || scroll.scrollTop !== before, resized: drawerH !== height };
    }
    var mouseDrag=null, suppressClick=false;
    d.addEventListener("pointerdown",function(e){
      if(e.pointerType!=="mouse" || e.button!==0 || handle.contains(e.target)) return;
      suppressClick=false;
      mouseDrag={x:e.clientX,y:e.clientY,last:e.clientY,moved:false,id:e.pointerId};
    },true);
    window.addEventListener("pointermove",function(e){
      if(!mouseDrag || e.pointerId!==mouseDrag.id) return;
      var travel=Math.abs(e.clientY-mouseDrag.y);
      if(!mouseDrag.moved && (travel<8 || travel<Math.abs(e.clientX-mouseDrag.x))) return;
      mouseDrag.moved=true;e.preventDefault();
      setDrawerHeight(drawerH+mouseDrag.last-e.clientY,true);mouseDrag.last=e.clientY;
    },true);
    window.addEventListener("pointerup",function(e){
      if(!mouseDrag || mouseDrag.id!==e.pointerId)return;
      suppressClick=mouseDrag.moved;mouseDrag=null;
      if(suppressClick)setDrawerHeight(drawerH);
    },true);
    d.addEventListener("click",function(e){if(suppressClick){suppressClick=false;e.preventDefault();e.stopImmediatePropagation();}},true);
    function coast(state) {
      var velocity = state.velocity;
      var last = performance.now();
      function frame(now) {
        var dt = Math.min(32, now - last);
        last = now;
        var movement = moveBy(velocity * dt, state.inSheet);
        state.resized = state.resized || movement.resized;
        velocity *= Math.exp(-dt / 165);
        if (movement.moved && Math.abs(velocity) >= .075) coastFrame = requestAnimationFrame(frame);
        else {
          coastFrame = 0;
          if (state.resized) setDrawerHeight(drawerH);
        }
      }
      coastFrame = requestAnimationFrame(frame);
    }
    d.addEventListener("touchstart", function (e) {
      if (coastFrame) setDrawerHeight(drawerH);
      if (e.touches.length !== 1) { touch = null; return; }
      var p = e.touches[0];
      touch = {
        x: p.clientX, y: p.clientY, lastY: p.clientY, lastTime: performance.now(),
        inSheet: sheet.contains(e.target) || $("sn-sheet").contains(e.target), moved: false, resized: false, velocity: 0
      };
    }, { passive: true,capture:true });
    d.addEventListener("touchmove", function (e) {
      if (!touch || e.touches.length !== 1) return;
      var p = e.touches[0];
      if (!touch.moved) {
        var travel = Math.abs(p.clientY - touch.y);
        if (travel < 7) return;
        if (Math.abs(p.clientX - touch.x) > travel) { touch = null; return; }
        touch.moved = true;
      }
      e.preventDefault();
      e.stopPropagation();
      var now = performance.now(), dy = touch.lastY - p.clientY;
      var elapsed = Math.max(8, now - touch.lastTime);
      var instant = Math.max(-2.4, Math.min(2.4, dy / elapsed));
      touch.velocity = .25 * touch.velocity + .75 * instant;
      touch.lastY = p.clientY;
      touch.lastTime = now;
      var fastRetract = dy < 0 && touch.velocity < -.65;
      var movement = moveBy(dy, touch.inSheet && !fastRetract);
      touch.resized = touch.resized || movement.resized;
    }, { passive: false,capture:true });
    function finishTouch(e) {
      var state = touch;
      touch = null;
      if (!state) return;
      if (e.type === "touchend" && state.moved && performance.now() - state.lastTime < 90 &&
          Math.abs(state.velocity) >= .16 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        coast(state);
      } else if (state.resized) setDrawerHeight(drawerH);
    }
    d.addEventListener("touchend", finishTouch,true);
    d.addEventListener("touchcancel", finishTouch,true);
    window.addEventListener("resize", function () {
      if (pendingOffer || offerActiveId) setDrawerHeight(Math.round(window.innerHeight / 3));
      else setDrawerHeight(drawerH);
    });
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
    $("sn-transactions-menu").addEventListener("click", function () {
      setOpen(false);
      openTransactionHistory();
    });
    $("sn-pending-orders").onclick = function () {
      var active = window.SNAuth?.activeRoles().driver;
      showDrawerPlacement("Pending delivery orders", '<p>' + (active ? 'Delivery driver role is on.' : 'Enable your delivery driver role to receive nearby orders.') + '</p>' +
        (active ? '' : '<button class="sheet-go" data-act="enable-delivery">Enable delivery driver</button>') + driverLocationControls() +
        (offersArmed() ? '' : '<p>Hold the power button for three seconds to receive offers.</p>'));
    };
    $("sn-list-vendor").onclick = function () {
      setOpen(false);
      var pt = cityOn && map ? map.getCenter() : here || aim;
      if (!pt) { locate(function(fix){land(fix);listPt=fix;placeTestPin("vendor");publishQuickVendor();}); return; }
      listPt=pt;
      if (!cityOn) openCity(pt);
      placeTestPin("vendor"); publishQuickVendor();
    };
    $("sn-news-menu").addEventListener("click", function () {
      setOpen(false);
      openNewsDesk("events");
    });
    var viewBtn = $("sn-view");
    var outBtn = $("sn-view-out");
    if (outBtn) outBtn.addEventListener("click", function () { setOpen(false); stepTier(1); });
    if (viewBtn && !viewBtn.__sn) {
      viewBtn.__sn = true;
      paintViewBtn();
      viewBtn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        setOpen(false);
        stepTier(-1);
      });
    }
  }
  var drawerNews = "";
  var newsDeskCache = Object.create(null);
  var newsDeskLoading = Object.create(null);
  var newsDeskTabs = { events: "News", investments: "Investments", culture: "Arts & Culture", spacenet: "SpaceNet" };
  var quoteGroups = ["Space", "AI and chips", "Technology", "Defense", "Automotive", "Shipping"];
  function newsLikes() {
    try { return JSON.parse(localStorage.getItem("sn:news-likes:" + (checkoutAccount() || "guest"))) || {}; }
    catch { return {}; }
  }
  function newsRank(item, prefs) {
    return Number(prefs[item.topic || "events"] || 0) +
      2 * Number(prefs["source:" + item.source] || 0);
  }
  function bindNewsFeedback(sheet) {
    var held, timer, x, y, suppress;
    function cancel() { clearTimeout(timer); held = null; }
    function show(target) {
      var old = sheet.querySelector(".news-feedback");
      if (old) old.remove();
      var item = newsDeskCache[drawerNews]?.data?.items?.find(row => row.id === target.dataset.id);
      var source = target.dataset.act === "news-video" && item?.source;
      var key = source ? "source:" + source : target.dataset.id;
      var panel = document.createElement("div");
      panel.className = "news-feedback";
      var label = document.createElement("small");
      label.textContent = source || newsDeskTabs[key];
      panel.append(label);
      ["More like this", "Less like this"].forEach(function (text, index) {
        var button = document.createElement("button");
        button.type = "button";
        button.className = "sheet-go";
        button.textContent = text;
        var value = index ? -1 : 1;
        button.setAttribute("aria-pressed", String(Number(newsLikes()[key]) === value));
        button.onclick = function () {
          var prefs = newsLikes();
          prefs[key] = value;
          localStorage.setItem("sn:news-likes:" + (checkoutAccount() || "guest"), JSON.stringify(prefs));
          newsRefresh = 0;
          paintDrawerContent();
        };
        panel.append(button);
      });
      target.after(panel);
    }
    var selector = '[data-act="news-video"],[data-act="news-desk"]';
    sheet.addEventListener("pointerdown", function (e) {
      cancel();
      suppress = null;
      held = e.target.closest(selector);
      if (!held || !e.isPrimary || e.button !== 0) return;
      x = e.clientX; y = e.clientY;
      timer = setTimeout(function () {
        if (held.isConnected) { suppress = held; show(held); }
      }, 500);
    });
    sheet.addEventListener("pointermove", function (e) {
      if (held && Math.hypot(e.clientX - x, e.clientY - y) > 8) cancel();
    });
    window.addEventListener("pointerup", cancel);
    window.addEventListener("pointercancel", cancel);
    sheet.addEventListener("contextmenu", function (e) {
      var target = e.target.closest(selector);
      if (target) { e.preventDefault(); cancel(); suppress = target; show(target); }
    });
    sheet.addEventListener("keydown", function (e) {
      var target = e.target.closest(selector);
      if (target && e.shiftKey && e.key === "Enter") {
        e.preventDefault(); show(target);
        target.nextElementSibling.querySelector("button").focus();
      }
    });
    sheet.addEventListener("click", function (e) {
      if (suppress && suppress.contains(e.target)) {
        suppress = null; e.preventDefault(); e.stopImmediatePropagation();
      }
    }, true);
  }
  function newsClipCards(items) {
    return items.filter(function (item) { return item && /^[\w-]{11}$/.test(item.id); }).map(function (item) {
      var where = item.location && item.location.kind === "story" ? " · " + escHtml(item.location.name) : "";
      return '<button type="button" class="news-desk-clip" data-act="news-video" data-id="' + item.id + '" aria-controls="sn-news-player" aria-expanded="false">' +
        '<img loading="lazy" alt="" src="https://i.ytimg.com/vi/' + item.id + '/default.jpg">' +
        '<span><b>' + escHtml(item.title) + '</b><small>' + escHtml(item.source) + where + '</small></span></button>';
    }).join("");
  }
  function marketRows(items) {
    return quoteGroups.map(function (group) {
      var rows = items.filter(function (item) { return item.group === group; });
      if (!rows.length) return "";
      return '<section class="profile-section"><h3>' + group + '</h3>' + rows.map(function (item) {
        var quote = item.quote;
        var price = quote && Number.isFinite(quote.price) && Number.isFinite(quote.timestamp);
        var label = price ? quote.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 }) + " " + escHtml(quote.currency)
          : item.symbol ? "Quote unavailable" : "Public listing unverified";
        return '<div class="market-row"><div><b>' + escHtml(item.name) + '</b>' +
          (item.symbol ? '<small>' + escHtml(item.symbol) + '</small>' : '') + '</div>' +
          '<div><b>' + label + '</b>' + (price ? '<small>' + (quote.stale ? 'Last available · ' : '') +
            escHtml(new Date(quote.timestamp).toLocaleString()) + '</small>' : '') + '</div></div>';
      }).join("") + '</section>';
    }).join("");
  }
  function newsDeskMarkup() {
    var cached = newsDeskCache[drawerNews];
    var items = cached && cached.data && Array.isArray(cached.data.items) ? cached.data.items : [];
    var fallback = '<p class="note">' + (newsDeskLoading[drawerNews] ? "Loading…" :
      drawerNews === "investments" ? "Market quotes are temporarily unavailable." : "No recent videos available.") + '</p>';
    var liked = newsLikes();
    items = items.slice().sort((a,b) => newsRank(b, liked) - newsRank(a, liked));
    var body;
    if (drawerNews === "investments") {
      body = '<p class="note">Exchange quotes via Yahoo Finance. Prices may be delayed.</p>' + (marketRows(items) || fallback);
    } else if (drawerNews === "culture") {
      body = '<article class="fanes-feature"><img src="/js/spacenet/assets/fanes-illustration.webp" alt="">' +
        '<div><h3>Fanes, Village of Colors</h3><p class="note">Rhodes, Greece · Village art and heritage · Illustration</p>' +
        '<a class="sheet-go" href="https://www.openstreetmap.org/search?query=Fanes%2C%20Rhodes%2C%20Greece" target="_blank" rel="noopener noreferrer">Find Fanes on the map</a></div></article>' +
        '<section class="profile-section"><h3>Artists, film &amp; celebrities</h3>' + (newsClipCards(items) || fallback) + '</section>';
    } else if (drawerNews === "spacenet") {
      var links = cached && cached.data && Array.isArray(cached.data.socials) ? cached.data.socials : [];
      body = '<section class="profile-section"><h3>Latest from Notis Astranov</h3>' +
        (newsClipCards(items) || fallback) +
        '<a class="sheet-go" href="https://www.youtube.com/@notisastranov" target="_blank" rel="noopener noreferrer">Notis Astranov on YouTube</a>' +
        links.filter(function (link) { return link && /^https:\/\//.test(link.url); }).map(function (link) {
          return '<a class="sheet-go" target="_blank" rel="noopener noreferrer" href="' + escHtml(link.url) + '">' + escHtml(link.label) + '</a>';
        }).join(" ") + '</section>';
    } else {
      body = '<section class="profile-section"><h3>Current events</h3>' + (newsClipCards(items) || fallback) + '</section>';
    }
    return '<article class="drawer-profile"><header class="home-title"><h2>News</h2>' +
      '<button type="button" class="sheet-x" data-act="news-desk-close" aria-label="Close news">×</button></header>' +
      '<nav class="news-desk-tabs" aria-label="News sections">' + Object.keys(newsDeskTabs).sort((a,b) => Number(liked[b] || 0) - Number(liked[a] || 0)).map(function (key) {
        return '<button type="button" class="sheet-go" data-act="news-desk" data-id="' + key + '" aria-pressed="' +
          (drawerNews === key) + '">' + newsDeskTabs[key] + '</button>';
      }).join("") + '</nav><p class="note">Hold a story or section to see more or less like it.</p>'  + body + '</article>';
  }
  function openNewsDesk(section) {
    if (newsSelection) stopNews();
    drawerAI = false;
    if (!Object.hasOwn(newsDeskTabs, section)) section = "events";
    var opening = !drawerNews;
    drawerHome = false;
    $("logo").setAttribute("aria-expanded", "false");
    clearDrawerPlacement();
    drawerNews = section;
    if ($("sn-sheet").classList.contains("on")) closeSheet();
    paintDrawerContent();
    $("sheet").scrollTop = 0;
    if (opening || drawerH <= collapsedDrawerH() + 8) setDrawerHeight(offerDrawerH());
    refreshNewsDesk(section);
  }
  function refreshNewsDesk(section) {
    var previous = newsDeskCache[section];
    if (newsDeskLoading[section] || (previous && previous.until > Date.now())) return;
    newsDeskLoading[section] = true;
    paintDrawerContent();
    var endpoint = section === "investments" ? "/api/market-news"
      : section === "culture" || section === "spacenet" ? "/api/news?section=" + section : "/api/news?events=1";
    fetchJson(endpoint, { cache: "no-store" }).then(function (data) {
      newsDeskCache[section] = { data: data, until: Date.now() + (data && data.items && data.items.length ? 60000 : 15000) };
      newsDeskLoading[section] = false;
      if (drawerNews === section) paintDrawerContent();
    });
  }
  var drawerHome = false;
  var homeVersion = "";
  var homeStatus = "";
  var homeLoading = false;
  var homeRoleLabels = {
    client: "User", support:"Support", vendor: "Vendor", driver: "Delivery driver",
    ambassador: "Ambassador", partner: "Partner", owner: "Owner", admin: "Admin"
  };
  function userRoleMarkup() {
    var account = SNAuth.user(), assigned = account.roles || [];
    var active = SNAuth.activeRoles();
    var roleList = ["client", "vendor", "driver", "support", "ambassador", "partner", "admin", "owner"];
    return '<p class="note">Account roles · ' + escHtml(assigned.join(", ") || "Client") + '</p>' +
      (account ? '<section class="profile-section"><h3>Role availability</h3><div class="home-roles">' + roleList.map(function (role) {
        var allowed = Object.hasOwn(active,role);
        return '<button type="button" class="sheet-go" data-act="home-role" data-role="' + role + '" aria-pressed="' + !!active[role] + '"' +
          (allowed ? '' : ' disabled') + '><span>' + homeRoleLabels[role] + '</span><small>' +
          (allowed ? active[role] ? 'On' : 'Off' : 'Unassigned') + '</small></button>';
      }).join("") + '</div></section>' : '');
  }
  var installEvent;
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installEvent = event;
  });
  function homeMarkup() {
    return '<article class="drawer-profile home-panel"><header class="home-title">' +
      '<h2>SpaceNet Home</h2><button type="button" class="sheet-x" data-act="home-close" aria-label="Close Home">×</button></header>' +
      '<section class="profile-section"><h3>City map layers</h3><button class="sheet-go" aria-pressed="' + (localStorage.getItem("sn:dark-map")!=="1") + '" data-act="map-light">☀️ Bright</button> <button class="sheet-go" aria-pressed="' + (localStorage.getItem("sn:dark-map")==="1") + '" data-act="map-dark">🌌 Dark</button><label>Map brightness <output id="brightness-value">'+mapBrightness()+'%</output><input type="range" id="map-brightness" min="35" max="120" value="'+mapBrightness()+'"></label></section>' +
      '<section class="profile-section"><h3>Installation</h3><button class="sheet-go" data-act="install-app">Install on computer or phone</button> ' +
      '<a class="sheet-go" href="/" target="_blank" rel="noopener">Open web version</a></section>' +
      '<section class="profile-section"><h3>Version</h3>' +
      '<div class="home-build"><span>Loaded <b>' + escHtml(VER) + '</b></span>' +
      '<span>Latest <b>' + escHtml(homeVersion || (homeLoading ? 'Checking…' : 'Unavailable')) + '</b></span></div>' +
      '<button type="button" class="sheet-go primary" data-act="home-update">Force update</button>' +
      '<button type="button" class="sheet-go" data-act="home-clear-cache">Clear cache</button>' +
      '<p class="note" role="status">' + escHtml(homeStatus) + '</p></section>'  + '</article>';
  }
  async function checkHomeVersion() {
    if (homeLoading) return;
    homeLoading = true;
    paintDrawerContent();
    var data = await fetchJson("/api/version?home=" + Date.now(), { cache: "no-store" });
    homeVersion = data && /^\d{4,}$/.test(data.latest) ? String(data.latest) : "";
    homeLoading = false;
    if (drawerHome) paintDrawerContent();
  }
  function openHomeDrawer() {
    if (newsSelection) stopNews();
    drawerAI = false;
    drawerNews = "";
    clearDrawerPlacement();
    if ($("sn-sheet").classList.contains("on")) closeSheet();
    drawerHome = !drawerHome;
    $("logo").setAttribute("aria-expanded", String(drawerHome));
    paintDrawerContent();
    $("sheet").scrollTop = 0;
    setDrawerHeight(drawerHome ? Math.max(offerDrawerH(), drawerH) : collapsedDrawerH());
    if (drawerHome) checkHomeVersion();
  }
  function bindLogo() {
    var logo = $("logo");
    if (!logo || logo.__sn) return;
    logo.__sn = true;
    logo.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      openHomeDrawer();
    });
  }
  function bindSearchMic() {
    var form = $("search"), inp = $("q"), mic = $("mic");
    if (form && !form.__sn) {
      form.__sn = true;
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        if (aiPending) { showAI("Wait for SpaceNet AI to finish answering."); return; }
        var v = inp && inp.value;
        if (inp) inp.value = "";
        var command=String(v || "").trim();
        switch(command.toLowerCase().replace(/^\//,"")) {
          case "": break;
          case "help": case "commands":
            showDrawerPlacement("Crawler and system commands","<p>Scan nearby · Menu · Orders · News · Home</p><p>Enter a vendor name or product to search.</p>");break;
          case "scan": case "scan nearby": case "nearby":
            discoveryUntil=0;
            if(cityOn && map) discoverNearby(map.getCenter());
            else locate(function(pt){openCity(pt);});
            break;
          case "menu": if(vendor) openVendor(vendor); else showDrawerPlacement("Menu","<p>Select a vendor on the map.</p>");break;
          case "orders": openJobs();break;
          case "news": openNewsDesk("events");break;
          case "home": openHomeDrawer();break;
          default: hunt(command);
        }
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
    if (!mic || !inp || mic.__sn) return;
    mic.__sn = true;
    var recognition = null;
    var voiceAI = false, dictating = false;
    $("dictate").addEventListener("click", function () { dictating = true; mic.click(); dictating = false; });

    var errors = {
      "not-allowed": "Microphone access was denied. Allow access or type your question.",
      "audio-capture": "No microphone was detected. You can type your question.",
      "no-speech": "No speech detected. Tap AI Talk to try again.",
      network: "Transcription is unavailable. You can type your question."
    };
    function finish(rec) {
      if (recognition !== rec) return false;
      recognition = null;
      mic.setAttribute("aria-pressed", "false");
      mic.textContent = "AI Talk";
      return true;
    }
    function cancelListening() {
      if (!recognition) return;
      var rec = recognition;
      finish(rec);
      rec.abort();
    }
    form.addEventListener("submit", cancelListening, true);
    mic.addEventListener("sn-cancel-listening", cancelListening);
    mic.addEventListener("click", function (event) {
      if (!recognition) voiceAI = !dictating;
      if (recognition) {
        var current = recognition;
        updateAIStatus("Finishing transcription…");
        try { current.stop(); }
        catch (error) { if (finish(current)) updateAIStatus("Tap AI Talk to try again."); }
        return;
      }
      if (aiPending) { showAI("Wait for SpaceNet AI to finish answering."); return; }
      var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) { showAI("This browser does not support voice transcription. Type your question."); return; }
      var rec = new Rec();
      recognition = rec;
      var previous = inp.value;
      rec.lang = /^el(?:-|$)/i.test(navigator.language || "") ? "el-GR" : "en-GB";
      rec.interimResults = true;
      rec.continuous = false;
      mic.setAttribute("aria-pressed", "true");
      mic.textContent = "Stop";
      if (voiceAI) showAI("Listening…");
      else $("sn-ai-live").textContent = "Listening…";
      rec.onresult = function (event) {
        if (recognition !== rec) return;
        var result = event.results[event.resultIndex];
        var transcript = result && result[0] && result[0].transcript.trim();
        if (!transcript) return;
        inp.value = transcript;
        if (result.isFinal && finish(rec)) {
          if (voiceAI) talk(transcript, true);
          else { updateAIStatus(""); inp.focus(); }
        }
      };
      rec.onerror = function (event) {
        if (finish(rec)) {
          if (!inp.value) inp.value = previous;
          updateAIStatus(errors[event.error] || "Transcription stopped. Tap AI Talk to retry.");
        }
      };
      rec.onend = function () {
        if (finish(rec)) updateAIStatus("Tap AI Talk to try again or type your question.");
      };
      try { rec.start(); }
      catch (error) {
        finish(rec);
        updateAIStatus("The microphone could not start. You can type your question.");
      }
    });
  }
  var radarExpanded=false, radarHeading=null, radarRows=[], gamePoints=[], gameRoom=null;
  function radarOrigin() { return here || (cityOn && map ? map.getCenter() : view && globeHit(view.cx,view.cy,cam)); }
  function radarBearing(a,b) {
    var rad=Math.PI/180, delta=(b.lng-a.lng)*rad;
    return (360+Math.atan2(Math.sin(delta)*Math.cos(b.lat*rad),
      Math.cos(a.lat*rad)*Math.sin(b.lat*rad)-Math.sin(a.lat*rad)*Math.cos(b.lat*rad)*Math.cos(delta))/rad)%360;
  }
  function syncRadarHud() {
    var origin=radarOrigin(), blips=$("sn-radar-blips");
    if (!blips || !origin || !newsItems) return;
    var pts=newsItems.filter(clip=>clip.box).map(clip=>({...clip.location,name:clip.title}));
    if(cityOn && map) {
      shopMarks.concat(actorMarks).forEach(mark=>{
        var pt=mark.getLatLng();
        if(map.getBounds().contains(pt)) pts.push({lat:pt.lat,lng:pt.lng,name:mark.options.title || "Map pin"});
      });
    } else if(view) {
      radarTargets().filter(p=>!p.clip && project(p.lat,p.lng,cam)).forEach(p=>pts.push({...p,name:p.label}));
    }
    gamePoints.forEach(p=>pts.push({...p,name:p.team+" · "+p.label+" ("+p.kind+")"}));
    radarRows=pts.map(p=>({...p,km:haversineKm(origin,p),angle:radarBearing(origin,p)-(radarHeading || 0)})).sort((a,b)=>a.km-b.km);
    var range=Math.max(0.1,...radarRows.map(p=>p.km));
    blips.innerHTML=radarRows.map(p=>{
      var r=44*Math.sqrt(p.km/range), angle=p.angle*Math.PI/180;
      return '<i title="'+escHtml(p.name)+'" style="left:'+(50+r*Math.sin(angle))+'%;top:'+(50-r*Math.cos(angle))+'%"></i>';
    }).join("");
    var options=$("radar-targets");
    if(options) options.innerHTML=radarRows.map(p=>'<button class="sheet-go" data-act="radar-route" data-lat="'+p.lat+'" data-lng="'+p.lng+'">'+escHtml(p.name)+' · '+p.km.toFixed(1)+' km · '+Math.round((p.angle+360)%360)+'°</button>').join(" ") || "No map results here.";
    if($("radar-heading")) $("radar-heading").textContent=radarHeading===null?"North up":"Facing "+Math.round(radarHeading)+"° · forward up";
  }
  function compassReading(e) {
    var value=Number.isFinite(e.webkitCompassHeading)?e.webkitCompassHeading:
      (e.absolute && Number.isFinite(e.alpha)?360-e.alpha:null);
    if(value!==null) radarHeading=(value+(screen.orientation?.angle || 0)+360)%360;
  }
  async function toggleRadar() {
    radarExpanded=!radarExpanded;
    $("sn-radar").setAttribute("aria-expanded",String(radarExpanded));
    if(!radarExpanded) {
      window.removeEventListener("deviceorientationabsolute",compassReading);
      window.removeEventListener("deviceorientation",compassReading);
      radarHeading=null;
      if($("radar-panel")) dismissDrawerPlacement();
      return;
    }
    showDrawerPlacement("Radar",'<div id="radar-panel"><p id="radar-heading">North up</p><button class="sheet-go" data-act="radar-game">Play hide-and-seek</button><div id="radar-game"></div><h3>Map results</h3><div id="radar-targets"></div></div>');
    setDrawerHeight(Math.round(innerHeight/3));
    if(routeLayer) fitOfferRoute();
    syncRadarHud();
    try {
      if(window.DeviceOrientationEvent?.requestPermission && await DeviceOrientationEvent.requestPermission()!=="granted") return;
      if(radarExpanded) {
        window.addEventListener("deviceorientationabsolute",compassReading);
        window.addEventListener("deviceorientation",compassReading);
      }
    } catch {}
  }
  async function gameRequest(kind,marker) {
    var form=$("radar-game-form"), status=$("radar-game-status");
    if(!form || !checkoutAccount()) {if(status) status.textContent="Sign in to join a game."; return;}
    var fields=form.elements, pt=marker==="drone" && cityOn && map ? map.getCenter() : here;
    if(kind!=="radar-leave" && !pt) {status.textContent="Use GPS to set your location first.";return;}
    if(kind!=="radar-leave" && !form.reportValidity()) return;
    var params={room:fields.room.value,team:fields.team.value,label:fields.label.value,nearby:fields.nearby.checked,discoverable:fields.discoverable.checked};
    var account=checkoutAccount(), data=await listingAction({...params,kind,marker,lat:pt?.lat,lng:pt?.lng});
    if(account!==checkoutAccount() || !form.isConnected) return;
    if(!data?.ok){status.textContent="Game service unavailable.";return;}
    gameRoom=kind==="radar-leave"?null:{...params,account};
    gamePoints=data.points || [];
    status.textContent=kind==="radar-leave"?"Left game.":gamePoints.length+" shared game pins.";
    syncRadarHud();
  }
  async function refreshGamePins() {
    var room=gameRoom;
    if(!radarExpanded || document.hidden || !room || !here || room.account!==checkoutAccount()) return;
    var data=await listingAction({...room,kind:"radar-list",lat:here.lat,lng:here.lng});
    if(gameRoom===room && room.account===checkoutAccount()) {gamePoints=data?.points || [];syncRadarHud();}
  }
  function showRadarGame() {
    var el=$("radar-game");if(!el)return;
    el.innerHTML='<form id="radar-game-form"><label>Game code (share with friends)<input class="field" name="room" minlength="8" maxlength="80" required></label><label>Team<input class="field" name="team" required maxlength="40"></label><label>Player or drone name<input class="field" name="label" required maxlength="60"></label><label><input type="checkbox" name="discoverable"> Let nearby teams see this pin for 15 minutes</label><label><input type="checkbox" name="nearby"> Show nearby public game pins</label><button type="button" class="sheet-go" data-act="game-player">Share my GPS pin</button><button type="button" class="sheet-go" data-act="game-drone">Share my drone pin at city map center</button><button type="button" class="sheet-go" data-act="game-list">Find teams</button><button type="button" class="sheet-go" data-act="game-leave">Leave game</button><p id="radar-game-status" role="status"></p></form>';
    var f=$("radar-game-form"); f.onsubmit=e=>e.preventDefault();
    if(gameRoom?.account===checkoutAccount()) for(var key of ["room","team","label","nearby","discoverable"]) {
      if(typeof gameRoom[key]==="boolean") f.elements[key].checked=gameRoom[key];else f.elements[key].value=gameRoom[key];
    }
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
    document.addEventListener("input",function(e){
      if(e.target.id!=="map-brightness")return;
      localStorage.setItem("sn:map-brightness",e.target.value);
      $("brightness-value").textContent=e.target.value+"%";
      applyMapTone($("city"));
    });
    bindGps();
    bindLogo();
    bindBurger();
    bindSearchMic();
    bindDrawer();
    bindMonitor();
    bindSound();
    bindNews();
    syncRadarHud();
    bindPower();
    var money = $("sn-money");
    if (money && !money.__sn) {
      money.__sn = true; money.hidden = false;
      money.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (!signed()) {
          openSheet("AV€", '<p class="note">Your coins after LOGIN. Pool is owner only.</p><button type="button" class="sheet-go primary" data-act="needlogin">LOGIN</button>');
          return;
        }
        var html = '<p class="note">' + avcGet().toLocaleString("en-GB") +
          ' AV€ in wallet</p>';
        if (ownerMail()) html += '<p class="note">Pool ' + Math.round(poolGet()).toLocaleString("en-GB") + " AV€ · owner only.</p>";
        html += '<input id="sn-add-eur" inputmode="decimal" placeholder="Euro to top up → AV€" />' +
          '<button type="button" class="sheet-go primary" data-act="topup" data-rail="paypal">TOP UP · PAYPAL</button>' +
          '<button type="button" class="sheet-go" data-act="topup" data-rail="stripe">TOP UP · STRIPE</button>' +
          '<button type="button" class="sheet-go" data-act="topup" data-rail="revolut">TOP UP · REVOLUT</button>' +
          '<button type="button" class="sheet-go" data-act="withdraw">WITHDRAW</button>';
        openSheet("AV€", html);
        testCheckoutRequest().then(paintTestCredit);
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
    var aBtn = $("sn-brand-a"), sBtn = $("sn-brand-s");
    if (aBtn && !aBtn.__sn) {
      aBtn.__sn = true;
      aBtn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openCompany(); });
    }
    if (sBtn && !sBtn.__sn) {
      sBtn.__sn = true;
      sBtn.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); hardReset(); });
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
      if(act==="radar-game") showRadarGame();
      if(act==="radar-route") {
        var dest={lat:Number(t.dataset.lat),lng:Number(t.dataset.lng)};
        if(!here) locate(pt=>{land(pt);drawRoute(pt,dest);});
        else {if(!cityOn) openCity(here);drawRoute(here,dest);}
      }
      if(act==="game-player") gameRequest("radar-share","player");
      if(act==="game-drone") {if(cityOn) gameRequest("radar-share","drone");else $("radar-game-status").textContent="Open the city map and center it on your drone first.";}
      if(act==="game-list") gameRequest("radar-list");
      if(act==="game-leave") gameRequest("radar-leave");
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
      if (act === "ai-close") {
        drawerAI = false;
        $("mic").dispatchEvent(new Event("sn-cancel-listening"));
        paintDrawerContent();
        $("mic").focus({ preventScroll: true });
      }
      if (act === "news-video") {
        var clip = newsDeskCache[drawerNews]?.data?.items?.find(item => item.id === id);
        if (clip) openNews(Object.assign({},clip,{button:t}));
      }
      if (act === "news-desk") openNewsDesk(id);
      if (act === "news-desk-close") {
        drawerNews = "";
        paintDrawerContent();
        setDrawerHeight(collapsedDrawerH());
      }
      if (act === "home-close") openHomeDrawer();
      if (act === "dispatch-pickup" || act === "dispatch-complete" || act === "dispatch-collect") {
        t.disabled=true;
        dispatchRequest(act.slice("dispatch-".length),{id:id}).then(function(result){
          if (!result.ok) {t.disabled=false;say(result.error || "Please retry.");return;}
          if(act==="dispatch-pickup") {dismissDrawerPlacement();say("Pickup order confirmed.");}
          displayDispatch(result);
        });
      }
      if (act === "track-order") openTrackedOrder(id);
      if (act === "hold-open") openOrderHolds(id);
      if (act === "hold-vote") {
        t.disabled=true;
        dispatchRequest("order_hold",{id:id,role:t.dataset.role,decision:t.dataset.decision,note:$("hold-explanation")?.value || ""}).then(function(result){
        if(result.ok) openOrderHolds(id);
        else {t.disabled=false;orderGuidance("Decision could not be recorded. Reopen the order and check its status.");}
        });
      }
      if (act === "home-account" && window.SNAuth && SNAuth.open) SNAuth.open();
      if (act === "owner-role" && drawerProfile && isRoleOwner()) {
        t.disabled=true;
        fetchOwnerProfile(drawerProfile.actor,t.dataset.role,t.getAttribute("aria-pressed")!=="true");
      }
      if (act === "home-role" && window.SNAuth && SNAuth.toggleRole) {
        SNAuth.toggleRole(t.getAttribute("data-role"));
        refreshDispatch();
        openOwnProfile();
      }
      if (act === "route-pref" && checkoutAccount() && Object.hasOwn(routeOptions,id)) {
        var prefs = routePreferences();
        prefs[id] = !prefs[id];
        localStorage.setItem("sn:routes:" + checkoutAccount(), JSON.stringify(prefs));
        openOwnProfile();
      }
      if (act === "save-provider") {
        var input = $("sn-provider-key"), result = $("sn-provider-status");
        var credential = input.value.trim();
        input.value = "";
        fetchJson("/api/ai-settings", { method:"POST", headers:{ Authorization:"Bearer " + authToken(),"Content-Type":"application/json" },
          body:JSON.stringify({provider:$("sn-provider").value,key:credential}) }).then(function (reply) {
          result.textContent = reply && reply.ok ? "Provider key saved." : "Could not save provider key.";
        });
      }
      if (act === "google-login" && window.SNAuth) SNAuth.google();
      if (act === "verify-phone") {
        var phone = $("sn-phone-number").value.trim(), code = $("sn-phone-code").value.trim();
        var status = $("sn-phone-result");
        SNAuth.verifyPhone(phone, code).then(function (message) { status.textContent = message; });
      }
      if (act === "scroll-profile") $(id)?.scrollIntoView({block:"start"});
      if (act === "order-accept" || act === "order-decline") {
        listingAction({kind:"order-status",id:id,status:act==="order-accept"?"accepted":"declined"}).then(function(reply){
          if(reply?.ok) vendorInbox(undefined,true); else t.textContent="Refresh orders";
        });
      }
      if (act === "message-read") listingAction({kind:"message-read",id:id}).then(function(reply){if(reply?.ok){dismissDrawerPlacement();vendorInbox();}});
      if (act === "reply-message") openProfileChat({peer:id},"Conversation");
      if (act === "profile-chat" && drawerProfile) {
        if (!drawerProfile.actor.self) openProfileChat(chatTarget(drawerProfile.actor),"Chat · "+drawerProfile.actor.name);
        else if(checkoutAccount()) {
          openSheet("Conversations",'<div id="chat-inbox" role="status">Loading…</div>');
          var box=$("chat-inbox"), account=checkoutAccount();
          listingAction({kind:"chat-list"}).then(function(data){
            if(!box.isConnected || account!==checkoutAccount()) return;
            box.innerHTML=data?.ok ? data.threads.map(row=>'<button class="sheet-go" data-act="reply-message" data-id="'+escHtml(row.peer)+'">'+escHtml(row.name)+' · '+Number(row.unread)+' unread</button>').join(" ") || "No conversations yet." : "Conversations unavailable.";
          });
        } else if(window.SNAuth?.open) SNAuth.open();
      }
      if (act === "order-inbox" && vendor) vendorInbox(vendor.id);
      if (act === "order-seen") {
        listingAction({kind:"inbox",seen:id}).then(function(reply){if(reply?.ok) dismissDrawerPlacement();});
      }
      if (act === "review-listing" && vendor) {
        var ref = vendor.id;
        listingAction({kind:"review",vendor_ref:ref}).then(function(result) {
          if (vendor?.id !== ref) return;
          openSheet("Listing submissions", !result?.ok ? "Review unavailable." : result.requests.map(function(row) {
            return '<p>' + escHtml(row.kind + " · " + row.note) + '</p><button class="sheet-go" data-act="approve-listing" data-id="' +
              escHtml(row.id) + '">Approve after verification</button>';
          }).join("") || "No pending submissions.");
        });
      }
      if (act === "approve-listing" && vendor) {
        listingAction({kind:"approve",id:id,vendor_ref:vendor.id}).then(function(result) {
          openSheet("Listing review",result?.ok ? "Approved." : "Approval unavailable.");
        });
      }
      if ((act === "editor-add-item" || act === "editor-edit-item") && vendor) {
        var selectedShop=vendor;
        var previous=act==="editor-edit-item"?vendor.menu[i]:null;
        $("editor-item")?.remove();
        var anchor=t.closest(".profile-menu-item") || t.closest(".vendor-menu-controls") || t;
        anchor.insertAdjacentHTML("afterend",'<form id="editor-item" class="test-form"><label>Name<input class="field" name="product" required maxlength="80"></label><label>Price in euros<input class="field" name="price" type="number" min=".01" max="9999.99" step=".01" required></label><label>Stock<input class="field" name="stock" type="number" min="0" max="99999" value="1" required></label><button class="sheet-go">Save item</button><p role="status"></p></form>');
        $("editor-item").scrollIntoView({block:"nearest"});
        if(previous){var fields=$("editor-item").elements;fields.product.value=previous.name;fields.price.value=previous.price;fields.stock.value=previous.quantity ?? 99;}
        $("editor-item").onsubmit=async function(e) {
          e.preventDefault();
          var form=e.currentTarget, submit=form.querySelector("button");
          if (submit.disabled) return;
          submit.disabled=true;
          var item=Object.assign({note:"",category:"",photo:""},previous,{name:form.elements.product.value,price:Number(form.elements.price.value),quantity:Number(form.elements.stock.value)});
          var response=await fetchJson("/api/vendor-menu?vendor="+encodeURIComponent(selectedShop.id),{method:"POST",headers:{Authorization:"Bearer "+authToken(),"Content-Type":"application/json"},body:JSON.stringify({items:[item],index:previous?i:null,previous:previous})});
          if(response?.items && vendor===selectedShop){vendor.menu=response.items;vendor.menuStored=true;cart.items={};form.remove();renderVendorShop();}
          else {submit.disabled=false;form.querySelector("p").textContent="Could not save item.";}
        };
      }
      if (act === "invite-listing" && vendor) {
        var invite = location.origin + "/?listing=" + encodeURIComponent(vendor.id) + "&lat=" + vendor.lat + "&lng=" + vendor.lng;
        var message = "Review the SpaceNet listing for " + vendor.name + " and request ownership: " + invite;
        if (navigator.share) navigator.share({text:message}).catch(function(){});
        else location.href = "mailto:?subject=SpaceNet%20vendor%20invitation&body=" + encodeURIComponent(message);
      }
      if ((act === "claim-listing" || act === "suggest-item") && vendor && requireCheckoutSignIn()) {
        var shop = vendor;
        var claim = act === "claim-listing";
        openSheet(claim ? "Ownership review" : "Suggest menu item", '<form id="listing-request"><label>' +
          (claim ? "Business contact and evidence of ownership" : "Item name") +
          '<textarea class="field" required maxlength="1200"></textarea></label>' +
          (claim ? '' : '<label>Price in euros<input name="price" class="field" type="number" required min=".01" step=".01"></label><label>Menu source<input name="source" class="field" type="url"></label>') + '<button class="sheet-go">Submit for review</button><p role="status"></p></form>');
        $("listing-request").onsubmit = async function(e) {
          e.preventDefault();
          var form=e.currentTarget;
          var result=await listingAction({kind:claim?"claim":"menu",vendor_ref:shop.id,note:claim ? form.querySelector("textarea").value : JSON.stringify({name:form.querySelector("textarea").value,price:Number(form.elements.price.value),source:form.elements.source.value})});
          form.querySelector("p").textContent=result?.ok?"Submitted for review.":"Submission unavailable.";
        };
      }
      if (act === "map-dark" || act === "map-light") { localStorage.setItem("sn:dark-map",act==="map-dark"?"1":"0"); setStreetLayer(); paintDrawerContent(); }
      if (act === "install-app") {
        if (installEvent) { installEvent.prompt(); installEvent = null; }
        else { homeStatus = "Use your browser menu to install SpaceNet or add it to your home screen."; paintDrawerContent(); }
      }
      if (act === "home-update") hardReset();
      if (act === "home-clear-cache") {
        homeStatus = "Clearing SpaceNet cache…";
        paintDrawerContent();
        clearSpaceNetCache().then(function () {
          homeStatus = "SpaceNet cache cleared.";
        }).catch(function () {
          homeStatus = "SpaceNet cache could not be cleared.";
        }).then(paintDrawerContent);
      }
      if (act === "placement-close") dismissDrawerPlacement();
      if (drawerProfile && (act === "profile-orders" || act === "profile-page" || act === "profile-main")) {
        loadProfileOrders(drawerProfile.actor, act !== "profile-main", i);
        $("sheet").scrollTop = 0;
      }
      if (act === "checkout-driver" && SNAuth.user()?.roles?.some(role=>["admin","owner","super_admin"].includes(role))) {
        locate(function(point) {
          listPt=point; placeTestPin("driver"); dispatchFix=point;
          if (!SNAuth.activeRoles().driver) SNAuth.toggleRole("driver");
          showDrawerPlacement("Delivery driver",'<p>'+ (offersArmed() ? "Checking for nearby orders." : "Hold power for three seconds to receive the order.")+'</p>');
          refreshDispatch();
        });
      }
      if (act === "checkout-profile") openOwnProfile();
      if (act === "checkout-return") resumeCheckout();
      if (act === "profile-address") {
        var address = deliveryLocations().find(function (pin) { return pin.id === id; });
        if (address && vendor && cartSubtotal()) { deliverySelection.add(address.id); resumeCheckout(); }
        else if (address) { openCity(address); setDrawerHeight(collapsedDrawerH()); }
      }
      if (act === "profile-jump") jumpToProfileSection(id);
      if (act === "profile-close") {
        drawerProfile = null;
        paintDrawerContent();
        $("sheet").scrollTop = 0;
        setDrawerHeight(collapsedDrawerH());
      }
      if (act === "profile-transactions") openTransactionHistory();
      if (act === "profile-sign-in" && window.SNAuth && SNAuth.open) SNAuth.open();
      if (act === "edit-test-menu") editTestMenu();
      if (act === "edit-test-vendor") editTestVendorProfile();
      if (act === "test-menu") renderVendorShop();
      if (act === "import-test-menu") importTestMenu();
      if (act === "menu-template") downloadMenuTemplate();
      if (act === "test-checkout") openTestCheckout();
      if (act === "history-sign-in") {
        try {
          sessionStorage.removeItem("sn:checkout-after-auth");
          sessionStorage.setItem("sn:history-after-auth", "1");
        } catch (err) {}
        if (window.SNAuth && SNAuth.open) SNAuth.open();
      }
      if (act === "checkout-sign-in") startCheckoutSignIn();
      if (act === "checkout-another-vendor") {
        dismissDrawerPlacement();
        if (!cityOn && vendor) openCity(vendor);
        setDrawerHeight(collapsedDrawerH());
        orderGuidance("Tap another vendor on the map to start a new order.");
      }
      if (act === "checkout-gps") {
        var owner=checkoutAccount(), field=t.closest("fieldset");
        if(!navigator.geolocation){orderGuidance("GPS unavailable. Place a delivery pin on the map.");return;}
        t.disabled=true;
        navigator.geolocation.getCurrentPosition(pos=>{
          if(!field.isConnected || field.disabled || checkoutAccount()!==owner) return;
          var pt={lat:pos.coords.latitude,lng:pos.coords.longitude};
          if(driverAvailable()) dispatchFix=pt;
          nameDestination(pt,"Current GPS location");
        },()=>{t.disabled=false;orderGuidance("Location unavailable. Allow location access or place a pin.");},
        {enableHighAccuracy:true,timeout:10000,maximumAge:5000});
      }
      if (act === "checkout-new-client") beginDestinationPick();
      if (act === "checkout-cancel-client") { endDestinationPick(); resumeCheckout(); }
      if (act === "test-client") {
        deliverySelection = new Set([id]);
        if (vendor && cartSubtotal() > 0) resumeCheckout();
        else openSheet("Delivery address selected", '<p class="note">Tap a test vendor to add items.</p>');
      }
      if (act === "test-driver" && testOrder && !testOrder.accepted && !pendingOffer) {
        var driver = testOrder.drivers.find(function (row) { return row.id === id; });
        if (driver && offersArmed()) showTestOffer(testOrder, driver);
        else if (driver) openSheet("Offers are off", '<p class="note">Turn on power to receive the test offer.</p>');
      }
      if (act === "test-stage" && testOrder && testOrder.id === id && testOrder.accepted) {
        testOrder.stage++;
        if (testOrder.stage === testDeliveryStages.length) {
          closeOffer(testOrder.id);
          advanceTestOrder();
        } else paintActiveOfferCard(testOrder, "active");
      }
      if (act === "test-pin") { placeTestPin(t.getAttribute("data-role")); }
      if (act === "remove-test-pin") {
        if (drawerProfile && profileId(drawerProfile.actor) === id) {
          drawerProfile = null;
          setDrawerHeight(collapsedDrawerH());
        }
        updateTestPins(loadTestPins().filter(function (pin) { return pin.id !== id; }));
      }
      if (act === "quick-role" && drawerProfile?.actor.quick) placeTestPin(t.dataset.role, drawerProfile.actor);
      if (act === "quick-publish" && drawerProfile?.actor.role === "post") {
        var post = drawerProfile.actor, headline = $("quick-headline").value.trim();
        if (!headline) { $("quick-headline").focus(); return; }
        if (!signed()) { needLogin("Sign in to publish news."); return; }
        persistListing({id:post.id,kind:"post",name:headline,lat:post.lat,lng:post.lng});
      }
      if ((act === "driver-current" || act === "driver-pin") && checkoutAccount()) {
        var account = checkoutAccount();
        function usePosition(point, gps) {
          if (checkoutAccount() !== account || !point) return;
          selectedDriverPin = gps ? null : {lat:point.lat,lng:point.lng,accountId:account};
          if (gps) { dispatchFix=point; ensureDriverGps(); }
          if (!SNAuth.activeRoles().driver) SNAuth.toggleRole("driver");
          showDrawerPlacement("Delivery driver", '<p>'+ (offersArmed() ? "Ready for nearby orders." : "Hold the power button for three seconds to receive nearby orders.")+'</p>');
          refreshDispatch();
        }
        if (act === "driver-current") locate(point=>usePosition(point,true));
        else usePosition(loadTestPins().find(pin=>pin.id===id && pin.role==="driver" && (!pin.accountId || pin.accountId===account)),false);
      }
      if (act === "enable-delivery" && checkoutAccount()) {
        if (!SNAuth.activeRoles().driver) SNAuth.toggleRole("driver");
        ensureDriverGps();
        $("sn-pending-orders").click();
        refreshDispatch();
      }
      if (act === "insert-actor") { placeTestPin(t.dataset.role); if(t.dataset.role==="vendor") publishQuickVendor(); }
      if (act === "save-actor") { saveActor(t.getAttribute("data-role")); }
      if (act === "retry-verify") {
        var rn = t.getAttribute("data-role");
        var nm2 = t.getAttribute("data-name") || "";
        var gbp2 = $("sn-actor-gbp");
        if ($("sn-actor-name")) {} else {
          /* recreate name field value via attribute */
        }
        showDrawerPlacement("NAME · " + (rn === "delivery_services" ? "DELIVERY SERVICES" : String(rn || "").toUpperCase()),
          '<input id="sn-actor-name" class="field" value="' + String(nm2).replace(/"/g, "") + '" />' +
          (rn === "vendor" || rn === "delivery_services" ? '<input id="sn-actor-gbp" class="field" placeholder="Google Business Profile URL" value="' + String(gbp2 && gbp2.value || "").replace(/"/g, "") + '" />' : "") +
          '<button type="button" class="sheet-go primary" data-act="save-actor" data-role="' + rn + '">SAVE · VERIFY</button>');
      }
      if (act === "start-tx") { startTransaction(findActor(id)); }
      if (act === "peer-msg") { openPeerMessage(findActor(id) || peerThread); }
      if (act === "peer-send") { sendPeerMessage(id); }
      if (act === "drv-walk") {
        if (!vendor) return;
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
      if (act === "add-item" || act === "qty-plus" || act === "qty-minus") {
        var item = vendor && vendorMenu(vendor)[i];
        if (!item || (act !== "qty-minus" && !itemAvailable(item))) return;
        var orderComment = $("sn-order-comment");
        if (orderComment) cart.comment = orderComment.value;
        var qty = Math.max(0, Math.min(99, item.quantity, cartQty(i) + (act === "qty-minus" ? -1 : 1)));
        if (qty) cart.items[i] = qty;
        else delete cart.items[i];
        if (t.hasAttribute("data-order") && cartSubtotal()) openOrderScreen();
        else renderVendorShop();
      }
      if (act === "open-order") resumeCheckout();
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
    $("sn-radar").onclick=toggleRadar;
    setInterval(function(){if(!document.hidden){if(gameRoom && gameRoom.account!==checkoutAccount()){gameRoom=null;gamePoints=[];}syncRadarHud();}},1000);
    setInterval(refreshGamePins,10000);
    setInterval(refreshDispatch,2000);
    loadLand();
    loadBorders();
    canvas = $("g");
    if (!canvas) return;
    ctx = canvas.getContext("2d");
    seedStars();
    cam.yaw = (20 * Math.PI) / 180 - earthSpin();
    cam.pitch = 0.22;
    cam.dist = globalGlobeDistance;
    bindGlobe();
    loadVerify();
    shops = uniqPlaces(shops || []);
    bindChrome();
    loadTxns();
    pullTxnsRemote();
    paintMoney();
    setInterval(paintMoney, 4000);
    paintViewBtn();
    if (signed()) testCheckoutRequest();
    bindSky();
    loadJobs();
    finishPayPalReturn();
    if (navigator.serviceWorker) {
      try { navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(function () {}); } catch (e) {}
    }
    window.__SN_4480 = true;
    window.SN = {
      talk: talk, say: say, cam: cam,
      getMap: function () { return map; },
      openOwnProfile: openOwnProfile, openCity: openCity, closeCity: closeCity, listAt: listAt,
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
      nudgeZoom: stepTier,
      drawRoute: drawRoute, architectUrl: architectUrl, openArchitectAt: openArchitectAt,
      goCityFromGlobe: goCityFromGlobe, startTransaction: startTransaction, openPeerMessage: openPeerMessage
    };
    window.addEventListener("spacenet:signed-in", function () {
      if (drawerProfile?.actor.self) openOwnProfile();
      else if (drawerProfile) {loadProfileOrders(drawerProfile.actor, false, 0);fetchOwnerProfile(drawerProfile.actor);}
      if (cityOn) paintActorsOnMap();
      paintDrawerContent();
      restoreCheckoutAfterAuth();
      finishPayPalReturn();
      pullTxnsRemote();
      flushTransactions();
    });
    setInterval(function(){vendorInbox();},15000);
    window.addEventListener("online", flushTransactions);
    window.addEventListener("spacenet:signed-out", function () {
      privateNotices=null;noticeAccount="";displayedNotice="";if($("notification-list")) dismissDrawerPlacement();
      shopMarks.concat(actorMarks).forEach(paintNoticePin);
      profileOrderState = null;
      deliverySelection.clear();
      pickedCheckoutAddress=null;markDelivery(null);
      if (drawerProfile && (drawerProfile.actor.self || drawerProfile.actor.savedDelivery)) drawerProfile = null;
      if ($("sn-history") || $("sn-checkout-client") || $("sn-client-location-form")) closeSheet();
      paintDrawerContent();
      if (cityOn) paintActorsOnMap();
      if (pickingDestination) { endDestinationPick(); resumeCheckout(); }
    });
    window.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && pickingDestination) { endDestinationPick(); resumeCheckout(); }
    });
    restoreCheckoutAfterAuth();
    var link = new URLSearchParams(location.search);
    if (link.get("listing") && link.has("lat") && link.has("lng")) {
      var lat=Number(link.get("lat")), lng=Number(link.get("lng"));
      if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat)<=90 && Math.abs(lng)<=180) openCity({lat,lng});
    }
    Object.defineProperty(window, "__SN_INTRO", { get: function () { return intro; } });
    requestAnimationFrame(loop);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
