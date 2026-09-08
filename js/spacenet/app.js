<<<<<<< HEAD
@file:///workspace/live-4219/app.js
=======
/* SpaceNet 4220 — one OS. Globe, city, Grok, jobs, money. No overlays. */
(function () {
  "use strict";
  if (window.__SN_4220) return;
  window.__SN_4220 = true;
  var VER = "4220";
  var OWNER_MAIL = /notisastranov@gmail\.com$|@astranov\.eu$/i;
  var TREASURY = 3000000;

  var LAND = [
    [[37,-6],[37,11],[32,25],[31,34],[22,37],[12,51],[0,42],[-5,39],[-15,40],[-25,35],[-34,25],[-34,18],[-28,16],[-22,14],[-17,11],[5,9],[4,-8],[12,-16],[16,-16],[21,-17],[28,-13],[36,-6],[37,-6]],
    [[36,-9],[43,-9],[51,-10],[58,-6],[71,25],[70,30],[60,30],[54,20],[45,29],[41,29],[40,19],[38,15],[36,15],[36,-5],[36,-9]],
    [[12,44],[26,56],[36,44],[42,44],[55,60],[70,70],[72,140],[62,160],[50,140],[35,140],[22,120],[8,105],[1,104],[8,77],[25,68],[12,44]],
    [[-11,142],[-12,136],[-16,123],[-22,114],[-35,115],[-35,138],[-38,148],[-28,153],[-11,142]],
    [[72,-95],[70,-168],[60,-165],[48,-125],[32,-117],[23,-110],[15,-95],[25,-80],[45,-65],[60,-65],[72,-85],[72,-95]],
    [[12,-72],[10,-62],[5,-52],[-5,-35],[-23,-42],[-34,-53],[-52,-68],[-18,-70],[-5,-80],[8,-78],[12,-72]],
    [[83,-32],[72,-56],[60,-44],[70,-22],[83,-32]]
  ];
  var LABELS = [
    {name:"AFRICA",lat:7,lng:20},{name:"EUROPE",lat:50,lng:15},{name:"ASIA",lat:45,lng:90},
    {name:"AUSTRALIA",lat:-25,lng:134},{name:"N AMERICA",lat:45,lng:-100},{name:"S AMERICA",lat:-15,lng:-60}
  ];

  var canvas = document.getElementById("g");
  var cityEl = document.getElementById("city");
  var lineEl = document.getElementById("line");
  var form = document.getElementById("f");
  var input = document.getElementById("in");
  var plusBtn = document.getElementById("plus");
  var goBtn = document.getElementById("go");
  var gpsBtn = document.getElementById("gps");
  var jobsBtn = document.getElementById("sn-tasks-btn");
  var jobsPane = document.getElementById("sn-tasks");
  var jobsList = document.getElementById("sn-tasks-list");
  var moneyBtn = document.getElementById("sn-money");
  var powerBtn = document.getElementById("sn-power");
  var sheet = document.getElementById("sn-sheet");
  var sheetCard = document.getElementById("sn-sheet-card");
  var fileInp = document.getElementById("sn-file");

  var cam = { yaw: 0.49, pitch: 0.63, dist: 1.85 };
  var vel = { yaw: 0, pitch: 0 };
  var drag = null;
  var pointers = new Map();
  var pinch = null;
  var holdT = 0;
  var fly = null;
  var here = null;
  var hereName = "";
  var from = null;
  var to = null;
  var level = "globe";
  var map = null;
  var marks = [];
  var jobs = [];
  var listings = [];
  var huntPins = [];
  var history = [];
  var listening = false;
  var rec = null;
  var opts = { night: isNight(), rain: false, vip: false, floor: false, special: false, kg: 0 };

  function $(id) { return document.getElementById(id); }
  function say(t) { if (lineEl) lineEl.textContent = String(t || ""); }
  function user() {
    try { return JSON.parse(localStorage.getItem("sn:user") || "null"); } catch (e) { return null; }
  }
  function isOwner() {
    var u = user();
    return !!(u && u.email && OWNER_MAIL.test(u.email));
  }
  function signed() { var u = user(); return !!(u && u.email); }
  function readNum(k, d) { var n = Number(localStorage.getItem(k)); return isFinite(n) ? n : d; }
  function writeNum(k, n) { try { localStorage.setItem(k, String(n)); } catch (e) {} }
  function avcGet() {
    if (isOwner()) {
      var n = readNum("sn:pool", TREASURY);
      if (n < 1) n = TREASURY;
      writeNum("sn:pool", n);
      return n;
    }
    return readNum("sn:avc", 0);
  }
  function avcSet(n) {
    n = Math.round(n * 100) / 100;
    if (isOwner()) writeNum("sn:pool", Math.max(n, TREASURY * 0.000001) || TREASURY);
    else writeNum("sn:avc", Math.max(0, n));
    paintMoney();
  }
  function fmtAve(n) { return "AV€ " + Number(n || 0).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function paintMoney() {
    if (!moneyBtn) return;
    if (!signed()) { moneyBtn.classList.remove("on"); moneyBtn.style.display = "none"; return; }
    moneyBtn.classList.add("on");
    moneyBtn.style.display = "flex";
    moneyBtn.textContent = fmtAve(avcGet());
  }
  function haversine(a, b) {
    var R = 6371, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    var d1 = (b.lat - a.lat) * Math.PI / 180, d2 = (b.lng - a.lng) * Math.PI / 180;
    var x = Math.sin(d1 / 2) * Math.sin(d1 / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(d2 / 2) * Math.sin(d2 / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function isNight(d) { d = d || new Date(); var h = d.getHours(); return h >= 21 || h < 9; }
  function quoteOf(a, b, o) {
    o = o || opts;
    var d = haversine(a, b);
    var mass = Number(o.kg || 0) || 0;
    var trips = mass > 13.3 ? Math.ceil(mass / 13.3) : 1;
    var road = d * (trips === 1 ? 1 : 2 * trips - 1);
    var fee = 3;
    if (road > 3) fee += Math.ceil(road - 3);
    if (o.night || isNight()) fee += 3;
    if (o.rain) fee += 3;
    if (o.vip) fee += 3;
    if (o.floor) fee += 3;
    if (o.special) fee += 3;
    if (mass > 13 && mass <= 13.3) fee += 3;
    var cut = Math.round(fee * 0.03 * 100) / 100;
    return { km: road, rawKm: d, trips: trips, fee: fee, cut: cut, held: Math.round((fee - cut) * 100) / 100 };
  }
  function project(lat, lng, c, w, h) {
    var λ = (lng * Math.PI) / 180 - c.yaw, φ = (lat * Math.PI) / 180;
    var x = Math.cos(φ) * Math.sin(λ), y = Math.sin(φ), z = Math.cos(φ) * Math.cos(λ);
    var cy = y * Math.cos(c.pitch) - z * Math.sin(c.pitch);
    var cz = y * Math.sin(c.pitch) + z * Math.cos(c.pitch);
    if (cz < 0.04) return null;
    var scale = (Math.min(w, h) * 0.46) / c.dist;
    return { x: w / 2 + x * scale, y: h / 2 - cy * scale, z: cz };
  }
  function globeHit(sx, sy, c, w, h) {
    var scale = (Math.min(w, h) * 0.46) / c.dist;
    var nx = (sx - w / 2) / scale, ny = (h / 2 - sy) / scale, r2 = nx * nx + ny * ny;
    if (r2 > 1) return null;
    var nz = Math.sqrt(Math.max(0, 1 - r2));
    var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    var y = ny * cp + nz * sp, z = -ny * sp + nz * cp, x = nx;
    var lat = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI;
    var lng = ((Math.atan2(x, z) + c.yaw) * 180) / Math.PI;
    while (lng > 180) lng -= 360; while (lng < -180) lng += 360;
    return { lat: lat, lng: lng };
  }
  function facing() {
    var lat = (cam.pitch * 180) / Math.PI, lng = (cam.yaw * 180) / Math.PI;
    while (lng > 180) lng -= 360; while (lng < -180) lng += 360;
    return { lat: lat, lng: lng };
  }
  function lookAt(p, dist) {
    cam.yaw = (p.lng * Math.PI) / 180;
    cam.pitch = Math.max(-1.15, Math.min(1.15, (p.lat * Math.PI) / 180));
    cam.dist = dist == null ? 1.16 : dist;
    vel.yaw = 0; vel.pitch = 0;
  }
  function flyTo(p, dist) {
    var start = { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist };
    var goal = { yaw: (p.lng * Math.PI) / 180, pitch: Math.max(-1.15, Math.min(1.15, (p.lat * Math.PI) / 180)), dist: dist == null ? 1.12 : dist };
    var dy = goal.yaw - start.yaw;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    fly = { t0: performance.now(), ms: 900, start: start, goal: { yaw: start.yaw + dy, pitch: goal.pitch, dist: goal.dist } };
    vel.yaw = 0; vel.pitch = 0;
  }

  function drawGlobe() {
    if (!canvas) return;
    var ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (fly) {
      var t = Math.min(1, (performance.now() - fly.t0) / fly.ms);
      var e = 1 - Math.pow(1 - t, 3);
      cam.yaw = fly.start.yaw + (fly.goal.yaw - fly.start.yaw) * e;
      cam.pitch = fly.start.pitch + (fly.goal.pitch - fly.start.pitch) * e;
      cam.dist = fly.start.dist + (fly.goal.dist - fly.start.dist) * e;
      if (t >= 1) fly = null;
    } else if (!drag && (Math.abs(vel.yaw) > 0.00012 || Math.abs(vel.pitch) > 0.00012)) {
      cam.yaw += vel.yaw; cam.pitch = Math.max(-1.15, Math.min(1.15, cam.pitch + vel.pitch));
      vel.yaw *= 0.88; vel.pitch *= 0.88;
    } else if (!drag) { vel.yaw = 0; vel.pitch = 0; }
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    var w = canvas.clientWidth, h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr); canvas.height = Math.floor(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    var scale = (Math.min(w, h) * 0.46) / cam.dist;
    ctx.beginPath(); ctx.arc(w / 2, h / 2, scale, 0, Math.PI * 2);
    ctx.fillStyle = "#041018"; ctx.fill();
    ctx.strokeStyle = "rgba(77,240,255,0.28)"; ctx.lineWidth = 1; ctx.stroke();
    ctx.strokeStyle = "rgba(77,240,255,0.12)"; ctx.lineWidth = 0.7;
    var lat, lng, p, first, ring, i, lab;
    for (lat = -60; lat <= 60; lat += 30) {
      ctx.beginPath(); first = true;
      for (lng = -180; lng <= 180; lng += 6) {
        p = project(lat, lng, cam, w, h);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    for (lng = -180; lng < 180; lng += 30) {
      ctx.beginPath(); first = true;
      for (lat = -80; lat <= 80; lat += 4) {
        p = project(lat, lng, cam, w, h);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = "rgba(126,233,255,0.55)"; ctx.lineWidth = 1.1;
    for (i = 0; i < LAND.length; i++) {
      ring = LAND[i]; ctx.beginPath(); first = true;
      for (var k = 0; k < ring.length; k++) {
        p = project(ring[k][0], ring[k][1], cam, w, h);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(126,233,255,0.72)";
    ctx.font = "600 11px system-ui"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    for (i = 0; i < LABELS.length; i++) {
      lab = LABELS[i]; p = project(lab.lat, lab.lng, cam, w, h);
      if (!p || p.z < 0.22) continue;
      ctx.fillText(lab.name, p.x, p.y);
    }
    if (from && to) {
      ctx.beginPath(); ctx.strokeStyle = "rgba(77,240,255,0.7)"; ctx.lineWidth = 1.4; first = true;
      for (i = 0; i <= 24; i++) {
        var tt = i / 24;
        var la = from.lat + (to.lat - from.lat) * tt;
        var dl = to.lng - from.lng; if (dl > 180) dl -= 360; if (dl < -180) dl += 360;
        p = project(la, from.lng + dl * tt, cam, w, h);
        if (!p) { first = true; continue; }
        if (first) { ctx.moveTo(p.x, p.y); first = false; } else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
    }
    function plot(pt, col, r) {
      if (!pt) return;
      p = project(pt.lat, pt.lng, cam, w, h); if (!p) return;
      ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, Math.PI * 2); ctx.fillStyle = col; ctx.fill();
    }
    plot(here, "#4df0ff", 6); plot(from, "#f0c14b", 5); plot(to, "#7ee9ff", 5);
    requestAnimationFrame(drawGlobe);
  }

  function pos(e) {
    var r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top, w: r.width, h: r.height };
  }
  function onDown(e) {
    if (e.button || level !== "globe") return;
    canvas.setPointerCapture(e.pointerId);
    var p = pos(e);
    pointers.set(e.pointerId, { x: p.x, y: p.y });
    vel.yaw = 0; vel.pitch = 0;
    if (pointers.size === 2) {
      var arr = Array.from(pointers.values());
      pinch = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      drag = null; if (holdT) { clearTimeout(holdT); holdT = 0; }
      return;
    }
    drag = { x: p.x, y: p.y, yaw: cam.yaw, pitch: cam.pitch, moved: false, lastX: p.x, lastY: p.y, lastT: Date.now() };
    holdT = setTimeout(function () {
      if (!drag || drag.moved) return;
      var hit = globeHit(p.x, p.y, cam, p.w, p.h);
      if (hit) placePoint(hit);
      drag = null;
    }, 420);
  }
  function onMove(e) {
    if (level !== "globe") return;
    var p = pos(e);
    if (pointers.has(e.pointerId)) pointers.set(e.pointerId, { x: p.x, y: p.y });
    if (pointers.size === 2 && pinch) {
      var arr = Array.from(pointers.values());
      var d = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      var ratio = pinch / d; pinch = d;
      cam.dist = Math.max(1.05, Math.min(2.4, cam.dist * ratio));
      if (cam.dist <= 1.08) openCity(facing());
      return;
    }
    if (!drag) return;
    var dx = p.x - drag.x, dy = p.y - drag.y;
    if (Math.hypot(dx, dy) > 8) { drag.moved = true; if (holdT) { clearTimeout(holdT); holdT = 0; } }
    if (!drag.moved) return;
    var now = Date.now(), dt = Math.max(8, now - drag.lastT);
    vel.yaw = (-(p.x - drag.lastX) * 0.005) * (16 / dt);
    vel.pitch = ((p.y - drag.lastY) * 0.004) * (16 / dt);
    drag.lastX = p.x; drag.lastY = p.y; drag.lastT = now;
    cam.yaw = drag.yaw - dx * 0.005;
    cam.pitch = Math.max(-1.15, Math.min(1.15, drag.pitch + dy * 0.004));
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (holdT) { clearTimeout(holdT); holdT = 0; }
    var d = drag; drag = null;
    if (level !== "globe") return;
    if (!d || d.moved) return;
    vel.yaw = 0; vel.pitch = 0;
    var p = pos(e);
    var hit = globeHit(p.x, p.y, cam, p.w, p.h);
    if (hit) placePoint(hit);
  }
  function onWheel(e) {
    e.preventDefault();
    cam.dist = Math.max(1.05, Math.min(2.4, cam.dist + e.deltaY * 0.002));
    if (cam.dist <= 1.08) openCity(facing());
  }

  function openCity(p) {
    if (!window.L || !cityEl) { say("City map not ready."); return; }
    level = "city";
    cityEl.classList.add("on");
    if (!map) {
      map = L.map(cityEl, { zoomControl: false, attributionControl: false });
      L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19 }).addTo(map);
      map.on("click", function (ev) { placePoint({ lat: ev.latlng.lat, lng: ev.latlng.lng }); });
      map.on("zoomend", function () {
        if (map.getZoom() <= 4) closeCity();
      });
    }
    map.setView([p.lat, p.lng], 15);
    setTimeout(function () { map.invalidateSize(); }, 60);
    paintMarks();
  }
  function closeCity() {
    level = "globe";
    cityEl.classList.remove("on");
    cam.dist = 1.2;
  }
  function paintMarks() {
    if (!map) return;
    marks.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
    marks = [];
    function add(pt, col, label) {
      if (!pt) return;
      var m = L.circleMarker([pt.lat, pt.lng], { radius: 8, color: col, fillColor: col, fillOpacity: 0.9, weight: 2 });
      if (label) m.bindTooltip(label, { permanent: false });
      m.addTo(map); marks.push(m);
    }
    add(here, "#4df0ff", hereName || "YOU");
    add(from, "#f0c14b", "FROM");
    add(to, "#7ee9ff", "TO");
    huntPins.forEach(function (h) { add(h, "#ffd85a", h.name || "PIN"); });
    listings.forEach(function (row) {
      if (row && isFinite(row.lat)) add(row, row.kind === "driver" ? "#4df0ff" : "#ff8ad4", row.name || row.kind);
    });
  }

  function placePoint(pt) {
    if (!from) {
      from = pt; to = null;
      say("FROM set. Tap the drop.");
      paintMarks();
      return;
    }
    if (!to) {
      to = pt;
      openQuote();
      paintMarks();
      return;
    }
    from = pt; to = null;
    say("FROM reset. Tap the drop.");
    paintMarks();
  }

  function openQuote() {
    if (!from || !to) return;
    var q = quoteOf(from, to, opts);
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">DELIVERY</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p>" + q.rawKm.toFixed(1) + " km · " + fmtAve(q.fee) + " · SpaceNet 3% " + fmtAve(q.cut) + "</p>" +
      '<label><input type="checkbox" data-opt="night"' + (opts.night ? " checked" : "") + "> Night +3</label>" +
      '<label><input type="checkbox" data-opt="rain"' + (opts.rain ? " checked" : "") + "> Rain +3</label>" +
      '<label><input type="checkbox" data-opt="floor"' + (opts.floor ? " checked" : "") + "> Floor / room +3</label>" +
      '<label><input type="checkbox" data-opt="vip"' + (opts.vip ? " checked" : "") + "> VIP +3</label>" +
      '<label>Kg <input type="number" data-opt="kg" value="' + (opts.kg || 0) + '" min="0" step="0.1"></label>' +
      '<button type="button" class="go throw" data-act="throw">THROW</button>' +
      '<button type="button" class="go" data-act="clear">CLEAR</button>';
    sheet.classList.add("on");
    say("Quote " + fmtAve(q.fee) + ". THROW posts it.");
  }
  function openPower() {
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">OFFERINGS</b><button type="button" class="x" data-act="close">✕</button></div>' +
      (signed() ? "<p>" + fmtAve(avcGet()) + "</p>" : "<p>Sign in to hold AV€.</p>") +
      '<button type="button" class="act" data-act="reload">RELOAD EUR → AV€</button>' +
      '<button type="button" class="act" data-act="withdraw">WITHDRAW 3%</button>' +
      '<button type="button" class="act" data-act="hour">OTHER JOB 33 AV€/h</button>' +
      '<button type="button" class="act" data-act="role">APPLY ROLE</button>' +
      '<button type="button" class="act" data-act="terms">TERMS</button>';
    sheet.classList.add("on");
  }
  function openHour() {
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">OTHER JOB</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p>33 AV€ per hour. Not delivery.</p>" +
      '<label>Hours <input id="sn-hours" type="number" min="1" value="1"></label>' +
      '<label>What <input id="sn-hour-q" type="text" placeholder="Describe the work"></label>' +
      '<button type="button" class="go throw" data-act="throw-hour">POST</button>';
    sheet.classList.add("on");
  }
  function openRole() {
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">ROLES</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p>Apply after Terms. Notis activates. Vendor · driver · agent · ambassador.</p>" +
      '<button type="button" class="act" data-act="apply" data-role="vendor">VENDOR</button>' +
      '<button type="button" class="act" data-act="apply" data-role="driver">DRIVER</button>' +
      '<button type="button" class="act" data-act="apply" data-role="agent">AGENT</button>' +
      '<button type="button" class="act" data-act="apply" data-role="ambassador">AMBASSADOR</button>' +
      '<button type="button" class="act" data-act="terms">READ TERMS</button>';
    sheet.classList.add("on");
  }
  function openReload() {
    if (!signed()) { say("Sign in first."); if (window.SNAuth && SNAuth.open) SNAuth.open(); return; }
    sheetCard.innerHTML =
      '<div class="bar"><b class="ttl">RELOAD</b><button type="button" class="x" data-act="close">✕</button></div>' +
      "<p>PayPal EUR → AV€. SpaceNet 3%.</p>" +
      '<label>Amount <input id="sn-reload" type="number" min="5" value="20"></label>' +
      '<button type="button" class="go throw" data-act="paypal">PAYPAL</button>';
    sheet.classList.add("on");
  }
  function closeSheet() { sheet.classList.remove("on"); }

  function throwJob() {
    if (!from || !to) return;
    if (!signed()) { say("Sign in to throw."); closeSheet(); if (window.SNAuth && SNAuth.open) SNAuth.open(); return; }
    var q = quoteOf(from, to, opts);
    var bal = avcGet();
    if (!isOwner() && bal < q.fee) { say("Need " + fmtAve(q.fee) + ". Reload first."); openReload(); return; }
    if (!isOwner()) avcSet(bal - q.fee);
    var job = {
      id: "job-" + Date.now().toString(36),
      kind: "job",
      status: "posted",
      from: from, to: to,
      km: q.rawKm, fee: q.fee, cut: q.cut,
      t: Date.now(),
      peer: (user() && user().email) || ""
    };
    jobs.unshift(job);
    try { localStorage.setItem("sn:jobs", JSON.stringify(jobs.slice(0, 40))); } catch (e) {}
    fetch("/api/space", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ row: { id: job.id, kind: "job", lat: to.lat, lng: to.lng, name: "Delivery", status: "posted", avc: q.fee, ride: q.rawKm } }) }).catch(function () {});
    closeSheet();
    say("Thrown. " + fmtAve(q.fee) + " locked. " + q.rawKm.toFixed(1) + " km.");
    from = null; to = null; paintMarks(); paintJobs();
  }
  function throwHour() {
    if (!signed()) { say("Sign in to post."); if (window.SNAuth && SNAuth.open) SNAuth.open(); return; }
    var hrs = Math.max(1, Number(($("sn-hours") && $("sn-hours").value) || 1));
    var what = ($("sn-hour-q") && $("sn-hour-q").value) || "Hourly work";
    var fee = hrs * 33;
    var cut = Math.round(fee * 0.03 * 100) / 100;
    var bal = avcGet();
    if (!isOwner() && bal < fee) { say("Need " + fmtAve(fee) + "."); openReload(); return; }
    if (!isOwner()) avcSet(bal - fee);
    var pt = here || facing();
    var job = { id: "hour-" + Date.now().toString(36), kind: "job", status: "posted", hours: hrs, fee: fee, cut: cut, name: what, from: pt, to: pt, t: Date.now() };
    jobs.unshift(job);
    try { localStorage.setItem("sn:jobs", JSON.stringify(jobs.slice(0, 40))); } catch (e) {}
    closeSheet();
    say("Posted " + hrs + "h · " + fmtAve(fee) + " · " + what);
    paintJobs();
  }
  function paintJobs() {
    if (!jobsList) return;
    if (!jobs.length) {
      jobsList.innerHTML = '<div class="job"><b>Queue empty</b><span>Tap FROM then TO on the globe, or post an hourly job from ⏻.</span></div>';
      return;
    }
    jobsList.innerHTML = jobs.map(function (j) {
      return '<div class="job"><b>' + String(j.name || (j.hours ? "HOURLY" : "DELIVERY")).replace(/[<>]/g, "") + "</b><span>" +
        (j.status || "posted") + " · " + fmtAve(j.fee || 0) +
        (j.km ? (" · " + Number(j.km).toFixed(1) + " km") : "") +
        (j.hours ? (" · " + j.hours + "h") : "") +
        "</span></div>";
    }).join("");
  }
  function loadJobs() {
    try { jobs = JSON.parse(localStorage.getItem("sn:jobs") || "[]") || []; } catch (e) { jobs = []; }
    fetch("/api/space").then(function (r) { return r.json(); }).then(function (j) {
      if (!j || !j.ok) return;
      listings = [].concat(j.shops || [], j.drivers || [], j.posts || []);
      (j.jobs || []).forEach(function (row) {
        if (!jobs.some(function (x) { return x.id === row.id; })) jobs.push(row);
      });
      paintJobs(); paintMarks();
    }).catch(function () {});
    paintJobs();
  }

  function applyRole(role) {
    if (!signed()) { say("Sign in, read terms, then apply."); if (window.SNAuth && SNAuth.open) SNAuth.open(); return; }
    var list = [];
    try { list = JSON.parse(localStorage.getItem("sn:roles") || "[]") || []; } catch (e) {}
    if (!list.some(function (r) { return r.role === role; })) list.push({ role: role, status: "pending" });
    try { localStorage.setItem("sn:roles", JSON.stringify(list)); } catch (e) {}
    say(role.toUpperCase() + " applied. Notis activates after Terms.");
    closeSheet();
  }

  function paypalStart() {
    var amt = Math.max(10, Number(($("sn-reload") && $("sn-reload").value) || 20));
    var headers = { "Content-Type": "application/json" };
    var tok = "";
    try { tok = (window.SNAuth && SNAuth.token && SNAuth.token()) || localStorage.getItem("sn:access") || ""; } catch (e) {}
    if (tok) headers.Authorization = "Bearer " + tok;
    say("Opening PayPal…");
    fetch("/api/paypal/create-order", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ amount: amt, origin: location.origin })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var href = (j && (j.approve || j.url)) || "";
        if (href) { location.href = href; return; }
        say((j && (j.message || j.error)) || "PayPal did not start.");
      })
      .catch(function () { say("PayPal did not answer."); });
  }
  function paypalReturn() {
    var q = new URLSearchParams(location.search);
    if (q.get("paypal") === "cancel") {
      say("Reload cancelled.");
      history.replaceState({}, "", "/");
      return;
    }
    var orderId = q.get("token") || q.get("orderId") || "";
    if (q.get("paypal") !== "success" && !orderId) return;
    if (!orderId) return;
    var headers = { "Content-Type": "application/json" };
    var tok = "";
    try { tok = (window.SNAuth && SNAuth.token && SNAuth.token()) || localStorage.getItem("sn:access") || ""; } catch (e) {}
    if (tok) headers.Authorization = "Bearer " + tok;
    say("Verifying PayPal…");
    fetch("/api/paypal/capture-order", {
      method: "POST",
      headers: headers,
      body: JSON.stringify({ orderId: orderId })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        history.replaceState({}, "", "/");
        if (!j || !j.ok) {
          say((j && (j.message || j.error)) || "PayPal did not capture.");
          return;
        }
        var eur = Number(j.eur || j.credited || j.avc || 0);
        if (eur > 0) avcSet(avcGet() + eur);
        say("AV€ " + eur.toFixed(2) + " in. 1:1 with euro.");
      })
      .catch(function () {
        history.replaceState({}, "", "/");
        say("PayPal did not finish.");
      });
  }

  function gps() {
    say("Finding you…");
    function land(pt, name) {
      here = pt; hereName = name || "YOU";
      flyTo(pt, 1.12);
      setTimeout(function () { openCity(pt); }, 920);
      say(name || (pt.lat.toFixed(3) + "," + pt.lng.toFixed(3)));
      reverse(pt);
      paintMarks();
    }
    if (!navigator.geolocation) { say("No GPS. Tap the globe to set YOU."); return; }
    navigator.geolocation.getCurrentPosition(
      function (pos) { land({ lat: pos.coords.latitude, lng: pos.coords.longitude }); },
      function () {
        navigator.geolocation.getCurrentPosition(
          function (pos) { land({ lat: pos.coords.latitude, lng: pos.coords.longitude }, "coarse"); },
          function () { say("GPS denied. Tap the globe to set FROM."); },
          { enableHighAccuracy: false, timeout: 8000 }
        );
      },
      { enableHighAccuracy: true, timeout: 9000, maximumAge: 14220 }
    );
  }
  function reverse(pt) {
    fetch("https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=" + pt.lat + "&lon=" + pt.lng, { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var n = (j && (j.name || (j.address && (j.address.suburb || j.address.city || j.address.town)))) || "";
        if (n) { hereName = n; say(n); paintMarks(); }
      }).catch(function () {});
  }

  function talk(text, extra) {
    extra = extra || "";
    var msg = String(text || "").trim();
    if (!msg) return;
    if (/^(hi|hello|hey|γεια)$/i.test(msg)) { say("Here. Tap GPS, or talk in ordinary language."); return; }
    say("Grok…");
    history.push({ role: "user", content: msg });
    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: msg + (extra ? "\n" + extra : ""),
        history: history.slice(-12),
        here: { lat: here && here.lat, lng: here && here.lng, place: hereName, level: level, avc: signed() ? avcGet() : 0 }
      })
    }).then(function (r) { return r.json(); }).then(function (j) {
      var spoken = (j && (j.say || j.text)) || "Grok did not answer.";
      history.push({ role: "assistant", content: spoken });
      say(spoken);
      var act = (j && j.act) || "talk";
      var places = (j && j.places) || [];
      if (act === "locate") { gps(); return; }
      if (act === "globe") { closeCity(); return; }
      if (act === "reload") { openReload(); return; }
      if (act === "city" || act === "map" || act === "national") {
        if (here) openCity(here); else gps();
      }
      if (act === "hunt" || places.length) {
        huntNamed(msg, places);
      } else if (act === "talk") {
        /* nothing else */
      } else if (msg.length > 2 && !/^(thanks|ok|okay|yes|no)$/i.test(msg)) {
        huntNamed(msg, []);
      }
    }).catch(function () { say("Grok is not reachable."); });
  }

  function huntNamed(q, grokPlaces) {
    var pins = [];
    (grokPlaces || []).forEach(function (p) {
      var lat = Number(p.lat), lng = Number(p.lng);
      if (isFinite(lat) && isFinite(lng)) pins.push({ name: p.name || q, lat: lat, lng: lng, raw: p.raw || "", phone: p.phone || "" });
    });
    var url = "https://photon.komoot.io/api/?limit=8&q=" + encodeURIComponent(q);
    fetch(url).then(function (r) { return r.json(); }).then(function (j) {
      var feats = (j && j.features) || [];
      feats.forEach(function (f) {
        var c = f.geometry && f.geometry.coordinates;
        if (!c) return;
        var props = f.properties || {};
        var name = props.name || q;
        if (q.length >= 5 && name.toLowerCase().indexOf(String(q).toLowerCase().slice(0, 4)) < 0 && !new RegExp(q.replace(/[^\w\u0370-\u03ff ]+/g, ""), "i").test(name + " " + (props.city || ""))) {
          /* brand must contain the query — keep if grok already pinned */
          return;
        }
        pins.push({ name: name, lat: c[1], lng: c[0], raw: [props.street, props.city, props.country].filter(Boolean).join(", ") });
      });
      showHunt(q, pins);
    }).catch(function () { showHunt(q, pins); });
  }
  function showHunt(q, pins) {
    var seen = {};
    huntPins = [];
    pins.forEach(function (p) {
      var k = p.name + "|" + p.lat.toFixed(4) + "|" + p.lng.toFixed(4);
      if (seen[k]) return; seen[k] = 1;
      huntPins.push(p);
    });
    huntPins = huntPins.slice(0, 8);
    if (!huntPins.length) { say("No real pin for " + q + "."); return; }
    var first = huntPins[0];
    flyTo(first, 1.1);
    setTimeout(function () { openCity(first); }, 920);
    say(first.name + (huntPins.length > 1 ? (" · " + huntPins.length + " pins") : ""));
    paintMarks();
  }

  function upload(file) {
    if (!file) return;
    say("Sending " + file.name + " to Grok…");
    var extra = "They uploaded " + file.name + " (" + file.type + ", " + file.size + " bytes). Help with this job. Do not invent a shop.";
    if (/^image\//.test(file.type) && file.size < 900000) {
      var fr = new FileReader();
      fr.onload = function () { talk("See this upload: " + file.name, extra + "\n[image attached as data URL length " + String(fr.result || "").length + "]"); };
      fr.readAsDataURL(file);
      return;
    }
    talk("See this upload: " + file.name, extra);
  }

  function mic() {
    var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { say("Mic is not on this browser. Type."); return; }
    if (listening && rec) { try { rec.stop(); } catch (e) {} listening = false; goBtn.style.boxShadow = ""; return; }
    rec = new SR();
    rec.lang = /[α-ωά-ώ]/i.test((input && input.value) || "") ? "el-GR" : "en-GB";
    rec.interimResults = false;
    rec.onstart = function () { listening = true; goBtn.style.boxShadow = "0 0 16px #4df0ff"; say("Listening…"); };
    rec.onend = function () { listening = false; goBtn.style.boxShadow = ""; };
    rec.onerror = function () { listening = false; goBtn.style.boxShadow = ""; say("Mic closed."); };
    rec.onresult = function (e) {
      var t = (e.results[0] && e.results[0][0] && e.results[0][0].transcript) || "";
      if (t) { if (input) input.value = t; talk(t); }
    };
    rec.start();
  }

  sheet.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    var act = b && b.getAttribute("data-act");
    if (e.target.matches && e.target.matches("[data-opt]")) {
      var k = e.target.getAttribute("data-opt");
      if (e.target.type === "checkbox") opts[k] = e.target.checked;
      else opts[k] = Number(e.target.value) || 0;
      if (from && to) openQuote();
      return;
    }
    if (act === "close") { closeSheet(); return; }
    if (act === "throw") { throwJob(); return; }
    if (act === "clear") { from = null; to = null; closeSheet(); paintMarks(); say("Cleared."); return; }
    if (act === "reload") { openReload(); return; }
    if (act === "withdraw") { say("Withdraw 3% after PayPal is keyed. Balance stays on this device."); return; }
    if (act === "hour") { openHour(); return; }
    if (act === "throw-hour") { throwHour(); return; }
    if (act === "role") { openRole(); return; }
    if (act === "apply") { applyRole(b.getAttribute("data-role") || "vendor"); return; }
    if (act === "terms") { location.href = "/terms"; return; }
    if (act === "paypal") { paypalStart(); return; }
  });
  jobsPane.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act]");
    if (b && b.getAttribute("data-act") === "hide") jobsPane.classList.remove("on");
  });
  jobsBtn.addEventListener("click", function () { jobsPane.classList.toggle("on"); paintJobs(); });
  if (powerBtn) powerBtn.addEventListener("click", openPower);
  gpsBtn.addEventListener("click", gps);
  plusBtn.addEventListener("click", function () { fileInp.click(); });
  fileInp.addEventListener("change", function () { if (fileInp.files && fileInp.files[0]) upload(fileInp.files[0]); fileInp.value = ""; });
  goBtn.addEventListener("click", mic);
  form.addEventListener("submit", function (e) { e.preventDefault(); var t = input.value; input.value = ""; talk(t); });
  moneyBtn.addEventListener("click", function () { if (signed()) openReload(); });

  canvas.addEventListener("pointerdown", onDown);
  canvas.addEventListener("pointermove", onMove);
  canvas.addEventListener("pointerup", onUp);
  canvas.addEventListener("pointercancel", onUp);
  canvas.addEventListener("wheel", onWheel, { passive: false });

  window.SN = {
    talk: talk, say: say, user: user, avcGet: avcGet, paintMoney: paintMoney,
    getMap: function () { return map; }
  };

  paintMoney();
  loadJobs();
  paypalReturn();
  say("Grid globe. Tap GPS to land. Talk in ordinary language.");
  requestAnimationFrame(drawGlobe);
  setInterval(paintMoney, 4000);
})();
>>>>>>> 3af1162 (4220 LOGIN is Google — exchange the OAuth code, no dummy session)
