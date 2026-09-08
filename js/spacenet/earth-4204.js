/* __SN_EARTH_4204 — real geographic Earth on canvas #g at guest boot first paint */
(function (global) {
  "use strict";
  if (global.__SN_EARTH_4204) return;
  global.__SN_EARTH_4204 = true;

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

  var CONT = {"NORTH AMERICA":1,"SOUTH AMERICA":1,"AFRICA":1,"EUROPE":1,"ASIA":1,"OCEANIA":1};

  function cam() { return global.__SN_CAM || null; }

  function sph(latDeg, lngDeg, cx, cy, R, yaw, pitch) {
    var la = latDeg * Math.PI / 180, ln = lngDeg * Math.PI / 180 - yaw;
    var x = Math.cos(la) * Math.sin(ln), y = Math.sin(la), z = Math.cos(la) * Math.cos(ln);
    var cp = Math.cos(pitch), sp = Math.sin(pitch);
    var y2 = y * cp - z * sp, z2 = y * sp + z * cp;
    if (z2 <= 0.02) return null;
    return { x: cx + R * x, y: cy - R * y2, z: z2 };
  }

  function drawOcean(ctx, cx, cy, R) {
    var g = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.4, R * 0.1, cx, cy, R);
    g.addColorStop(0, "#1a6aa8");
    g.addColorStop(0.55, "#0b3d6e");
    g.addColorStop(1, "#041628");
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  }

  function drawLand(ctx, cx, cy, R, yaw, pitch) {
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
      ctx.strokeStyle = "rgba(120,220,140,0.45)";
      ctx.lineWidth = 1;
      ctx.stroke();
    }
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
    try {
      drawOcean(ctx, cx, cy, R);
      drawLand(ctx, cx, cy, R, yaw, pitch);
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(126,233,255,0.4)";
      ctx.lineWidth = Math.max(1.2, global.devicePixelRatio || 1);
      ctx.stroke();
    } catch (e) {}
    ctx.restore();
  }

  function isGridStroke(style) {
    var s = String(style || "");
    return s.indexOf("77,240,255") >= 0 || s.indexOf("126,233,255") >= 0;
  }

  function wrapContext(ctx) {
    if (!ctx || ctx.__snEarth4204) return ctx;
    ctx.__snEarth4204 = true;
    var _fillRect = ctx.fillRect.bind(ctx);
    ctx.fillRect = function (x, y, w, h) {
      _fillRect(x, y, w, h);
      try {
        var canvas = ctx.canvas;
        if (canvas && canvas.id === "g" && x === 0 && y === 0 && w >= canvas.width - 1 && h >= canvas.height - 1) {
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
        if (ctx.canvas && ctx.canvas.id === "g" && CONT[String(text || "").trim().toUpperCase()]) {
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
        if (ctx.canvas && ctx.canvas.id === "g" && CONT[String(text || "").trim().toUpperCase()]) return;
      } catch (e) {}
      return maxW != null ? _strokeText(text, x, y, maxW) : _strokeText(text, x, y);
    };
    return ctx;
  }

  function patchCanvas(cv) {
    if (!cv || cv.__snEarthPatch4204) return;
    cv.__snEarthPatch4204 = true;
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

  function forceGlobeRedraw() {
    try {
      var c = cam();
      if (c && c.needTick) c.needTick();
    } catch (e) {}
    try { global.dispatchEvent(new Event("resize")); } catch (e) {}
    try {
      var cv = document.getElementById("g");
      if (cv && cv.getContext) {
        var ctx = cv.getContext("2d");
        if (ctx) paintEarth(ctx, cv.width, cv.height);
      }
    } catch (e) {}
  }

  function loadCoastRings() {
    fetch("/js/spacenet/assets/land-rings.json?v=4204", { cache: "no-store" })
      .then(function (r) { return r.ok ? r.json() : null; })
      .then(function (rings) {
        if (rings && rings.length) {
          LAND = rings;
          forceGlobeRedraw();
        }
      })
      .catch(function () {});
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

  global.SNGlobe = { ready: true, build: 4204 };

  function boot() {
    hideCityBoot();
    var cv = document.getElementById("g");
    if (cv) patchCanvas(cv);
    loadCoastRings();
    forceGlobeRedraw();
    setTimeout(forceGlobeRedraw, 0);
    setTimeout(forceGlobeRedraw, 50);
    setTimeout(forceGlobeRedraw, 200);
    setTimeout(forceGlobeRedraw, 600);
    setTimeout(forceGlobeRedraw, 1200);
    var n = 0;
    (function waitCam() {
      if (cam() && cam().needTick) { cam().needTick(); return; }
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
