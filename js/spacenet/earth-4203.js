/* __SN_EARTH_4203 — real geographic Earth on canvas #g at guest boot first paint
 * Overlay: uses window.__SN_CAM from app.js (yaw/pitch/dist + needTick).
 * Texture: Blue Marble via jsDelivr three-globe; filled-land fallback if texture fails.
 */
(function (global) {
  "use strict";
  if (global.__SN_EARTH_4203) return;
  global.__SN_EARTH_4203 = true;

  var TEX_URLS = [
    "/js/spacenet/assets/earth-blue-marble.jpg",
    "https://cdn.jsdelivr.net/npm/three-globe@2.31.1/example/img/earth-blue-marble.jpg",
    "https://unpkg.com/three-globe@2.31.1/example/img/earth-blue-marble.jpg"
  ];

  var LAND = [
    [[37,-9],[36,0],[37,10],[32,22],[31,33],[22,37],[12,43],[0,42],[-5,39],[-15,40],[-25,35],[-34,25],[-34,18],[-28,15],[-22,14],[-17,12],[-5,9],[5,0],[10,-15],[15,-17],[22,-17],[28,-13],[33,-8],[37,-9]],
    [[71,25],[70,30],[65,40],[60,30],[55,40],[50,35],[45,30],[40,28],[36,28],[36,15],[38,10],[43,5],[48,-5],[52,-10],[58,-8],[62,-5],[66,10],[71,25]],
    [[59,-7],[58,-2],[55,0],[51,1],[50,-5],[52,-6],[56,-6],[59,-7]],
    [[75,60],[72,80],[70,100],[65,140],[60,160],[55,160],[50,145],[45,140],[40,130],[35,140],[30,130],[25,120],[20,110],[15,100],[10,100],[5,105],[0,105],[-5,110],[-8,115],[-5,120],[0,125],[5,120],[10,125],[15,145],[22,145],[30,130],[35,125],[40,120],[45,130],[50,140],[55,135],[60,120],[65,100],[70,80],[75,60]],
    [[55,40],[50,45],[45,50],[40,45],[35,45],[30,48],[25,55],[20,55],[15,50],[20,45],[25,40],[30,35],[35,35],[40,40],[45,40],[50,40],[55,40]],
    [[35,70],[32,75],[28,78],[25,85],[22,88],[20,85],[15,80],[10,78],[8,77],[15,74],[20,72],[25,70],[30,68],[35,70]],
    [[-12,130],[-15,145],[-20,150],[-28,153],[-35,150],[-38,145],[-35,135],[-32,125],[-25,115],[-20,115],[-15,122],[-12,130]],
    [[-35,173],[-40,175],[-45,170],[-42,168],[-35,173]],
    [[70,-90],[65,-50],[55,-60],[50,-55],[45,-65],[40,-70],[35,-75],[30,-82],[25,-80],[20,-90],[15,-95],[18,-100],[25,-110],[30,-115],[35,-120],[40,-125],[50,-130],[55,-130],[60,-140],[65,-165],[70,-150],[72,-120],[70,-90]],
    [[50,-125],[45,-124],[40,-124],[35,-120],[32,-117],[30,-115],[25,-112],[22,-110],[22,-105],[28,-105],[32,-110],[38,-122],[45,-124],[50,-125]],
    [[82,-40],[75,-20],[70,-22],[65,-40],[70,-55],[78,-60],[82,-40]],
    [[12,-72],[10,-62],[5,-55],[0,-50],[-5,-35],[-10,-35],[-20,-40],[-30,-50],[-40,-60],[-50,-70],[-55,-70],[-52,-68],[-45,-65],[-35,-72],[-25,-75],[-15,-75],[-5,-80],[0,-80],[5,-78],[10,-75],[12,-72]],
    [[-70,-180],[-70,-90],[-70,0],[-70,90],[-70,180],[-80,180],[-80,-180],[-70,-180]]
  ];

  var CONT_NAMES = {"NORTH AMERICA":1,"SOUTH AMERICA":1,"AFRICA":1,"EUROPE":1,"ASIA":1,"OCEANIA":1};
  var texReady = false, texCanvas = null, texCtx = null, texW = 0, texH = 0;

  function cam() { return global.__SN_CAM || null; }

  function sph(latDeg, lngDeg, cx, cy, R, yaw, pitch) {
    var la = latDeg * Math.PI / 180, ln = lngDeg * Math.PI / 180 - yaw;
    var x = Math.cos(la) * Math.sin(ln), y = Math.sin(la), z = Math.cos(la) * Math.cos(ln);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    if (z2 <= 0.02) return null;
    return { x: cx + R * x, y: cy - R * y2, z: z2 };
  }

  function sampleRGB(lng, lat) {
    if (!texCtx || !texW) return null;
    var u = ((lng + 180) / 360) * texW, v = ((90 - lat) / 180) * texH;
    u = ((u % texW) + texW) % texW;
    v = Math.max(0, Math.min(texH - 1, v));
    var d = texCtx.getImageData(u | 0, v | 0, 1, 1).data;
    return { r: d[0], g: d[1], b: d[2] };
  }

  function drawOceanBall(ctx, cx, cy, R) {
    var g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, "#1a6aa8");
    g.addColorStop(0.55, "#0b3d6e");
    g.addColorStop(1, "#041628");
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  function drawLandFallback(ctx, cx, cy, R, yaw, pitch) {
    var i, j, poly, q, first;
    for (i = 0; i < LAND.length; i++) {
      poly = LAND[i];
      ctx.beginPath();
      first = true;
      for (j = 0; j < poly.length; j++) {
        q = sph(poly[j][0], poly[j][1], cx, cy, R, yaw, pitch);
        if (!q) { first = true; continue; }
        if (first) { ctx.moveTo(q.x, q.y); first = false; }
        else ctx.lineTo(q.x, q.y);
      }
      ctx.closePath();
      ctx.fillStyle = "rgba(52,140,72,0.92)";
      ctx.fill();
      ctx.strokeStyle = "rgba(120,220,140,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  function drawTexturedSphere(ctx, cx, cy, R, yaw, pitch) {
    drawOceanBall(ctx, cx, cy, R);
    if (!texReady || !texCtx) {
      drawLandFallback(ctx, cx, cy, R, yaw, pitch);
    } else {
      var step = R < 120 ? 10 : (R < 220 ? 7 : 5);
      var lat, lng, a, b, c, d, mid, avgZ;
      for (lat = -90; lat < 90; lat += step) {
        for (lng = -180; lng < 180; lng += step) {
          a = sph(lat, lng, cx, cy, R, yaw, pitch);
          b = sph(lat, lng + step, cx, cy, R, yaw, pitch);
          c = sph(lat + step, lng + step, cx, cy, R, yaw, pitch);
          d = sph(lat + step, lng, cx, cy, R, yaw, pitch);
          if (!a || !b || !c || !d) continue;
          avgZ = (a.z + b.z + c.z + d.z) * 0.25;
          if (avgZ < 0.05) continue;
          mid = sampleRGB(lng + step * 0.5, lat + step * 0.5);
          if (!mid) continue;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.lineTo(c.x, c.y);
          ctx.lineTo(d.x, d.y);
          ctx.closePath();
          ctx.fillStyle = "rgb(" + mid.r + "," + mid.g + "," + mid.b + ")";
          ctx.fill();
        }
      }
    }
    var limb = ctx.createRadialGradient(cx, cy, R * 0.82, cx, cy, R);
    limb.addColorStop(0, "rgba(2,8,18,0)");
    limb.addColorStop(1, "rgba(2,20,40,0.35)");
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = limb;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(126,233,255,0.4)";
    ctx.lineWidth = Math.max(1.2, (global.devicePixelRatio || 1));
    ctx.stroke();
  }

  function paintEarth(ctx, w, h) {
    var c = cam();
    var yaw = c && c.getYaw ? +c.getYaw() : 0.49;
    var pitch = c && c.getPitch ? +c.getPitch() : 0.63;
    var dist = c && c.getDist ? +c.getDist() : 1.85;
    if (!isFinite(yaw)) yaw = 0.49;
    if (!isFinite(pitch)) pitch = 0.63;
    if (!isFinite(dist) || dist < 0.5) dist = 1.85;
    var cx = w * 0.5, cy = h * 0.46, R = Math.min(w, h) * 0.42 / dist;
    if (!(R > 8)) return;
    ctx.save();
    try { drawTexturedSphere(ctx, cx, cy, R, yaw, pitch); }
    catch (e) { try { drawLandFallback(ctx, cx, cy, R, yaw, pitch); } catch (_) {} }
    ctx.restore();
  }

  function isGridStroke(style) {
    var s = String(style || "");
    return s.indexOf("77,240,255") >= 0 || s.indexOf("77, 240, 255") >= 0;
  }

  function isContinentLabel(t) {
    return !!CONT_NAMES[String(t || "").trim().toUpperCase()];
  }

  function wrapContext(ctx) {
    if (!ctx || ctx.__snEarth4203) return ctx;
    ctx.__snEarth4203 = true;

    var _fillRect = ctx.fillRect.bind(ctx);
    ctx.fillRect = function (x, y, w, h) {
      _fillRect(x, y, w, h);
      try {
        var canvas = ctx.canvas;
        if (!canvas || canvas.id !== "g") return;
        if (x === 0 && y === 0 && w >= canvas.width - 1 && h >= canvas.height - 1) {
          paintEarth(ctx, canvas.width, canvas.height);
        }
      } catch (e) {}
    };

    var _stroke = ctx.stroke.bind(ctx);
    ctx.stroke = function () {
      try {
        if (ctx.canvas && ctx.canvas.id === "g" && isGridStroke(ctx.strokeStyle)) return;
      } catch (e) {}
      return _stroke();
    };

    var _fillText = ctx.fillText.bind(ctx);
    ctx.fillText = function (text, x, y, maxW) {
      try {
        if (ctx.canvas && ctx.canvas.id === "g" && isContinentLabel(text)) {
          var prev = ctx.globalAlpha;
          ctx.globalAlpha = Math.min(prev, 0.18);
          var r = maxW != null ? _fillText(text, x, y, maxW) : _fillText(text, x, y);
          ctx.globalAlpha = prev;
          return r;
        }
      } catch (e) {}
      return maxW != null ? _fillText(text, x, y, maxW) : _fillText(text, x, y);
    };

    var _strokeText = ctx.strokeText.bind(ctx);
    ctx.strokeText = function (text, x, y, maxW) {
      try {
        if (ctx.canvas && ctx.canvas.id === "g" && isContinentLabel(text)) return;
      } catch (e) {}
      return maxW != null ? _strokeText(text, x, y, maxW) : _strokeText(text, x, y);
    };

    return ctx;
  }

  function patchCanvas(cv) {
    if (!cv || cv.__snEarthPatch4203) return;
    cv.__snEarthPatch4203 = true;
    var _get = cv.getContext.bind(cv);
    cv.getContext = function (type, opts) {
      var c = _get(type, opts);
      if (type === "2d" && c) wrapContext(c);
      return c;
    };
    try {
      var existing = _get("2d");
      if (existing) wrapContext(existing);
    } catch (e) {}
  }

  function hideCityBoot() {
    try {
      var city = document.getElementById("city");
      if (!city) return;
      city.classList.remove("on");
      city.style.display = "none";
      city.style.pointerEvents = "none";
    } catch (e) {}
  }

  function loadTexture(i) {
    i = i || 0;
    if (i >= TEX_URLS.length) { bump(); return; }
    var img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = function () {
      try {
        texCanvas = document.createElement("canvas");
        texW = texCanvas.width = img.naturalWidth || img.width;
        texH = texCanvas.height = img.naturalHeight || img.height;
        texCtx = texCanvas.getContext("2d", { willReadFrequently: true });
        texCtx.drawImage(img, 0, 0);
        texReady = true;
      } catch (e) {
        texReady = false;
        texCtx = null;
      }
      bump();
    };
    img.onerror = function () { loadTexture(i + 1); };
    img.src = TEX_URLS[i];
  }

  function bump() {
    try {
      var c = cam();
      if (c && c.needTick) c.needTick();
      else if (global.SN && SN.repaint) SN.repaint();
    } catch (e) {}
  }

  function viewLatLng(lat, lng, z) {
    var c = cam();
    if (!c || !c.set) return null;
    lat = +lat; lng = +lng;
    if (!isFinite(lat) || !isFinite(lng)) return null;
    var dist = c.getDist ? c.getDist() : 1.85;
    if (z != null && isFinite(+z)) dist = Math.max(0.85, Math.min(3.2, 5.6 / (+z || 5.6)));
    c.set({
      yaw: lng * Math.PI / 180,
      pitch: Math.max(-1.15, Math.min(1.15, lat * Math.PI / 180)),
      dist: dist
    });
    return { lat: lat, lng: lng, dist: dist };
  }

  function pickLatLng(clientX, clientY) {
    var cv = document.getElementById("g");
    var c = cam();
    if (!cv || !c) return null;
    var yaw = +c.getYaw(), pitch = +c.getPitch(), dist = +c.getDist();
    var w = cv.width, h = cv.height;
    var cx = w * 0.5, cy = h * 0.46, R = Math.min(w, h) * 0.42 / dist;
    var rect = cv.getBoundingClientRect();
    var px = (clientX - rect.left) * (w / Math.max(1, rect.width));
    var py = (clientY - rect.top) * (h / Math.max(1, rect.height));
    var x = (px - cx) / R, y2 = (cy - py) / R, rr = x * x + y2 * y2;
    if (rr > 1) return null;
    var z2 = Math.sqrt(Math.max(0, 1 - rr));
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var y = y2 * cp + z2 * sp;
    var z = -y2 * sp + z2 * cp;
    var lat = Math.asin(Math.max(-1, Math.min(1, y))) * 180 / Math.PI;
    var lng = Math.atan2(x, z) * 180 / Math.PI + yaw * 180 / Math.PI;
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    return { lat: lat, lng: lng };
  }

  global.SNGlobe = {
    ready: true,
    build: 4203,
    viewLatLng: viewLatLng,
    pickLatLng: pickLatLng,
    textureReady: function () { return !!texReady; }
  };

  function boot() {
    hideCityBoot();
    var cv = document.getElementById("g");
    if (cv) patchCanvas(cv);
    loadTexture(0);
    var n = 0;
    (function waitCam() {
      if (cam()) { bump(); return; }
      if (++n < 40) setTimeout(waitCam, 50);
    })();
    try {
      var city = document.getElementById("city");
      if (city) {
        new MutationObserver(function () {
          if (city.classList.contains("on")) {
            city.style.display = "";
            city.style.pointerEvents = "auto";
          }
        }).observe(city, { attributes: true, attributeFilter: ["class"] });
      }
    } catch (e) {}
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})(typeof window !== "undefined" ? window : this);
