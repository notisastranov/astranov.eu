/** Pure globe project / hit inverse matching app.js (SIDEREAL spin frozen for tests). */
var SIDEREAL_OMEGA = 7.292115e-5;

function makeCam(yaw, pitch, dist) {
  return { yaw: yaw, pitch: pitch, dist: dist == null ? 1.85 : dist };
}

function makeView(w, h, dist) {
  var top = 16, bot = h - 16;
  var cx = w / 2, cy = (top + bot) / 2;
  var base = Math.max(120, Math.min((bot - top) * 0.46, w * 0.46));
  var zoom = 1.85 / Math.max(0.55, dist || 1.85);
  var scale = base * zoom;
  return { w: w, h: h, cx: cx, cy: cy, scale: scale, top: top, bot: bot };
}

function project(lat, lng, c, view, spin) {
  var λ = (lng * Math.PI) / 180 - c.yaw - spin;
  var φ = (lat * Math.PI) / 180;
  var x = Math.cos(φ) * Math.sin(λ);
  var y = Math.sin(φ);
  var z = Math.cos(φ) * Math.cos(λ);
  var cy = y * Math.cos(c.pitch) - z * Math.sin(c.pitch);
  var cz = y * Math.sin(c.pitch) + z * Math.cos(c.pitch);
  if (cz < 0.04) return null;
  return { x: view.cx + x * view.scale, y: view.cy - cy * view.scale, z: cz, s: view.scale };
}

function globeHitRaw(sx, sy, c, view, spin) {
  var scale = view.scale;
  if (!scale || scale < 8) return null;
  var nx = (sx - view.cx) / scale, ny = (view.cy - sy) / scale, r2 = nx * nx + ny * ny;
  if (r2 > 0.999) return null;
  var nz = Math.sqrt(Math.max(0, 1 - r2));
  var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
  var y = ny * cp + nz * sp, z = -ny * sp + nz * cp, x = nx;
  var lat = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI;
  var lam = Math.atan2(x, z);
  var lng = ((lam + c.yaw + spin) * 180) / Math.PI;
  while (lng > 180) lng -= 360;
  while (lng < -180) lng += 360;
  return { lat: lat, lng: lng };
}

function lookAtYawPitch(p, spin) {
  return {
    yaw: (p.lng * Math.PI) / 180 - spin,
    pitch: Math.max(-1.15, Math.min(1.15, (p.lat * Math.PI) / 180))
  };
}

function roundTrip(lat, lng, spin, dist, w, h, pixelOffset) {
  pixelOffset = pixelOffset || { x: 0, y: 0 };
  var face = lookAtYawPitch({ lat: lat, lng: lng }, spin);
  var cam = makeCam(face.yaw, face.pitch, dist);
  var view = makeView(w, h, dist);
  var p = project(lat, lng, cam, view, spin);
  if (!p) return { ok: false, reason: "project-null" };
  var sx = p.x + pixelOffset.x, sy = p.y + pixelOffset.y;
  var hit = globeHitRaw(sx, sy, cam, view, spin);
  if (!hit) return { ok: false, reason: "hit-null", sx: sx, sy: sy, scale: view.scale };
  var dlat = Math.abs(hit.lat - lat);
  var dlng = Math.abs(((hit.lng - lng + 540) % 360) - 180);
  return { ok: dlat < 0.35 && dlng < 0.35, dlat: dlat, dlng: dlng, hit: hit, want: { lat: lat, lng: lng }, sx: sx, sy: sy, scale: view.scale, dist: dist };
}

module.exports = { project, globeHitRaw, lookAtYawPitch, makeCam, makeView, roundTrip, SIDEREAL_OMEGA };
