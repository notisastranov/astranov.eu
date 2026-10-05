#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""4331: wheel screen↔latlng; shop union; GPS≠sky; fee; APPLY/X."""
from pathlib import Path

app_path = Path("js/spacenet/app.js")
if not app_path.exists():
    raise SystemExit("missing js/spacenet/app.js")
s = app_path.read_text(encoding="utf-8")


def must_replace(old, new, tag):
    global s
    if old not in s:
        if new.strip() and new in s:
            print("skip", tag, "(already)")
            return
        raise SystemExit("missing block: " + tag)
    s = s.replace(old, new, 1)
    print("ok", tag)


# --- 1) globeHit: drop lon-flip heuristic; freeze spin once ---
must_replace(
    """  function globeHit(sx, sy, c) {
    var scale = view.scale;
    if (!scale || scale < 8) return null;
    var nx = (sx - view.cx) / scale, ny = (view.cy - sy) / scale, r2 = nx * nx + ny * ny;
    if (r2 > 0.999) return null;
    var nz = Math.sqrt(Math.max(0, 1 - r2));
    var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    var y = ny * cp + nz * sp, z = -ny * sp + nz * cp, x = nx;
    var lat = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI;
    /* λ = atan2(x,z); lng = λ + yaw + spin — must match vecOf/project (x=cosφ·sinλ, z=cosφ·cosλ) */
    var lam = Math.atan2(x, z);
    var lng = ((lam + c.yaw + earthSpin()) * 180) / Math.PI;
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    var hit = { lat: lat, lng: lng };
    /* self-check: if reproject drifts, try lon-flipped (guards sign bugs) */
    try {
      var p = project(hit.lat, hit.lng, c);
      var err = p ? Math.hypot(p.x - sx, p.y - sy) : 1e9;
      if (err > 6) {
        var flip = { lat: hit.lat, lng: -hit.lng };
        var p2 = project(flip.lat, flip.lng, c);
        var err2 = p2 ? Math.hypot(p2.x - sx, p2.y - sy) : 1e9;
        if (err2 + 1 < err) hit = flip;
      }
    } catch (e) {}
    return hit;
  }""",
    """  function globeHit(sx, sy, c, spinAt) {
    var scale = view && view.scale;
    if (!scale || scale < 8) return null;
    var spin = (spinAt != null && isFinite(spinAt)) ? spinAt : earthSpin();
    var nx = (sx - view.cx) / scale, ny = (view.cy - sy) / scale, r2 = nx * nx + ny * ny;
    if (r2 > 0.999) return null;
    var nz = Math.sqrt(Math.max(0, 1 - r2));
    var cp = Math.cos(c.pitch), sp = Math.sin(c.pitch);
    var y = ny * cp + nz * sp, z = -ny * sp + nz * cp, x = nx;
    var lat = (Math.asin(Math.max(-1, Math.min(1, y))) * 180) / Math.PI;
    /* λ = atan2(x,z); lng = λ + yaw + spin — matches project (x=cosφ·sinλ, z=cosφ·cosλ) */
    var lam = Math.atan2(x, z);
    var lng = ((lam + c.yaw + spin) * 180) / Math.PI;
    while (lng > 180) lng -= 360;
    while (lng < -180) lng += 360;
    if (!isFinite(lat) || !isFinite(lng)) return null;
    return { lat: lat, lng: lng };
  }
  function screenToLatLng(sx, sy, c, spinAt) {
    if (!view || sx == null || sy == null) return null;
    return globeHit(sx, sy, c || cam, spinAt);
  }""",
    "globeHit+screenToLatLng",
)

# lookAt: wrapYaw + frozen spin
must_replace(
    """  function lookAt(p, dist) {
    cam.yaw = (p.lng * Math.PI) / 180 - earthSpin();
    cam.pitch = Math.max(-1.15, Math.min(1.15, (p.lat * Math.PI) / 180));
    cam.dist = dist == null ? 1.16 : dist;
    vel.yaw = 0; vel.pitch = 0; fly = null;
  }""",
    """  function lookAt(p, dist, spinAt) {
    if (!p || !isFinite(+p.lat) || !isFinite(+p.lng)) return;
    var spin = (spinAt != null && isFinite(spinAt)) ? spinAt : earthSpin();
    var want = (p.lng * Math.PI) / 180 - spin;
    cam.yaw = wrapYaw(cam.yaw, want);
    cam.pitch = Math.max(-1.15, Math.min(1.15, (p.lat * Math.PI) / 180));
    cam.dist = dist == null ? 1.16 : dist;
    vel.yaw = 0; vel.pitch = 0; fly = null;
  }""",
    "lookAt-wrap",
)

# aimAt / zoomSmooth / zoomToDist — cursor-stable street handoff
must_replace(
    """  function zoomToDist(dist) {
    intro = false;
    var maxD = cam.dist > 2.5 ? 6.4 : 2.15;
    dist = Math.max(0.5, Math.min(maxD, dist));
    if (!aim && here && isFinite(here.lat)) aim = { lat: here.lat, lng: here.lng };
    if (cityOn) return;
    if (dist <= 0.78 && aim && isFinite(aim.lat)) {
      openCity(aim);
      if (map) {
        try {
          map.setView([aim.lat, aim.lng], 14, { animate: false });
          map.flyTo([aim.lat, aim.lng], 16, { duration: 0.55 });
        } catch (e) {}
      }
      say("City");
      return;
    }
    var f = aim && isFinite(aim.lat) ? face(aim) : { yaw: cam.yaw, pitch: cam.pitch };
    fly = {
      t0: performance.now(),
      ms: 280,
      start: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist },
      goal: { yaw: f.yaw, pitch: f.pitch, dist: dist }
    };
    tierI = dist > 3.2 ? 0 : dist > 1.4 ? 1 : 2;
  }
  var wheelAt = 0;
  function aimAt(sx, sy) {
    var hit = (sx != null && sy != null) ? globeHit(sx, sy, cam) : null;
    if (hit && isFinite(hit.lat) && isFinite(hit.lng)) {
      aim = { lat: hit.lat, lng: hit.lng };
      seated = true;
      return aim;
    }
    return null;
  }
  function zoomSmooth(dir, sx, sy) {
    if (cityOn && map) {
      var z = map.getZoom() || 16;
      if (dir > 0 && z <= 13.2) {
        closeCity();
        zoomToDist(1.25);
        say("Back to the globe");
        return;
      }
      var nz = Math.max(13, Math.min(19, z + (dir < 0 ? 0.7 : -0.7)));
      try {
        if (sx != null && map.mouseEventToLatLng && false) { /* reserved */ }
        if (sx != null && typeof L !== "undefined" && map.containerPointToLatLng) {
          var ll = map.containerPointToLatLng(L.point(sx, sy));
          map.setView(ll, nz, { animate: false });
        } else {
          map.flyTo(map.getCenter(), nz, { duration: 0.28 });
        }
      } catch (e) { try { map.setZoom(nz); } catch (e2) {} }
      return;
    }
    if (dir < 0 && sx != null) {
      var under = aimAt(sx, sy);
      if (under) {
        try { lookAt(under, cam.dist); } catch (e) {}
      }
    }
    wheelAt = Date.now();
    seated = true;
    zoomToDist(cam.dist * (dir < 0 ? 0.72 : 1.18), sx, sy);
  }""",
    """  function zoomToDist(dist) {
    intro = false;
    var maxD = cam.dist > 2.5 ? 6.4 : 2.15;
    dist = Math.max(0.5, Math.min(maxD, dist));
    if (!aim && here && isFinite(here.lat)) aim = { lat: here.lat, lng: here.lng };
    if (cityOn) return;
    if (dist <= 0.78 && aim && isFinite(+aim.lat) && isFinite(+aim.lng)) {
      /* refuse polar/Alaska garbage from a bad inverse */
      if (Math.abs(+aim.lat) > 80) {
        say("Wheel aim missed the globe. Drag to face the place, then wheel in.");
        return;
      }
      var street = { lat: +aim.lat, lng: +aim.lng, name: aim.name || "" };
      openCity(street);
      if (map) {
        try {
          map.setView([street.lat, street.lng], 16, { animate: false });
          map.invalidateSize();
        } catch (e) {}
      }
      say("Street · " + street.lat.toFixed(3) + "," + street.lng.toFixed(3));
      return;
    }
    var f = aim && isFinite(aim.lat) ? face(aim) : { yaw: cam.yaw, pitch: cam.pitch };
    fly = {
      t0: performance.now(),
      ms: 280,
      start: { yaw: cam.yaw, pitch: cam.pitch, dist: cam.dist },
      goal: { yaw: f.yaw, pitch: f.pitch, dist: dist }
    };
    tierI = dist > 3.2 ? 0 : dist > 1.4 ? 1 : 2;
  }
  var wheelAt = 0;
  function aimAt(sx, sy, spinAt) {
    var spin = (spinAt != null && isFinite(spinAt)) ? spinAt : earthSpin();
    var hit = (sx != null && sy != null) ? screenToLatLng(sx, sy, cam, spin) : null;
    if (!hit && view) hit = screenToLatLng(view.cx, view.cy, cam, spin);
    if (hit && isFinite(hit.lat) && isFinite(hit.lng)) {
      aim = { lat: hit.lat, lng: hit.lng };
      seated = true;
      return aim;
    }
    return null;
  }
  function zoomSmooth(dir, sx, sy) {
    if (cityOn && map) {
      var z = map.getZoom() || 16;
      if (dir > 0 && z <= 12.6) {
        closeCity();
        zoomToDist(1.25);
        say("Back to the globe");
        return;
      }
      var nz = Math.max(13, Math.min(19, z + (dir < 0 ? 0.7 : -0.7)));
      try {
        if (sx != null && typeof L !== "undefined" && map.containerPointToLatLng) {
          var ll = map.containerPointToLatLng(L.point(sx, sy));
          map.setView(ll, nz, { animate: false });
        } else {
          map.setZoom(nz);
        }
      } catch (e) { try { map.setZoom(nz); } catch (e2) {} }
      return;
    }
    var spin = earthSpin();
    if (dir < 0) {
      var under = aimAt(sx, sy, spin);
      if (under) {
        try { lookAt(under, cam.dist, spin); } catch (e) {}
      }
    }
    wheelAt = Date.now();
    seated = true;
    zoomToDist(cam.dist * (dir < 0 ? 0.72 : 1.18), sx, sy);
  }""",
    "wheel-street-handoff",
)

# Don't open sky from a tap that is really chrome (GPS corner)
must_replace(
    """      } else if (!hitTap) {
        var con = pickConstellation(pUp.x, pUp.y);
        if (con) openSky(con);
      }""",
    """      } else if (!hitTap) {
        var gpsEl = $("gps");
        var nearGps = false;
        try {
          if (gpsEl) {
            var gr = gpsEl.getBoundingClientRect();
            var cr = canvas.getBoundingClientRect();
            var gx = pUp.x + cr.left, gy = pUp.y + cr.top;
            nearGps = gx >= gr.left - 8 && gx <= gr.right + 8 && gy >= gr.top - 8 && gy <= gr.bottom + 8;
          }
        } catch (e2) {}
        if (!nearGps) {
          var con = pickConstellation(pUp.x, pUp.y);
          if (con) openSky(con);
        }
      }""",
    "no-sky-near-gps",
)

# --- 2) uniqPlaces: union by id/coords, never 8-cap replace ---
must_replace(
    """  function uniqPlaces(list) {
    var listed = [], out = [], seen = {};
    list.forEach(function (p) {
      if (!p || !isFinite(p.lat) || !isFinite(p.lng) || !p.name) return;
      var mine = p.src === "listed";
      if (!mine && here && haversineKm(here, p) > 40) return;
      var k = p.name.toLowerCase() + ":" + p.lat.toFixed(4) + "," + p.lng.toFixed(4);
      if (seen[k]) {
        if (mine) {
          for (var i = 0; i < listed.length; i++) {
            if ((listed[i].name || "").toLowerCase() + ":" + listed[i].lat.toFixed(4) + "," + listed[i].lng.toFixed(4) === k) listed[i] = p;
          }
        }
        return;
      }
      seen[k] = 1;
      if (mine) listed.push(p);
      else out.push(p);
    });
    return listed.concat(out.slice(0, 8)).concat(vendor && vendor.id && !listed.concat(out).some(function (p) { return p && p.id === vendor.id; }) ? [vendor] : []);
  }""",
    """  function uniqPlaces(list) {
    var out = [], seen = {};
    function keyOf(p) {
      if (p.id) return "id:" + String(p.id);
      return "g:" + String(p.name || "").toLowerCase() + ":" + Number(p.lat).toFixed(4) + "," + Number(p.lng).toFixed(4);
    }
    function rank(src) {
      if (src === "listed" || src === "live") return 4;
      if (src === "find") return 3;
      if (src === "overpass" || src === "nominatim") return 2;
      return 1;
    }
    (list || []).forEach(function (p) {
      if (!p || !isFinite(+p.lat) || !isFinite(+p.lng) || !p.name) return;
      var k = keyOf(p);
      var i = seen[k];
      if (i != null) {
        if (rank(p.src) >= rank(out[i].src)) out[i] = p;
        return;
      }
      seen[k] = out.length;
      out.push(p);
    });
    return out;
  }""",
    "uniqPlaces-union",
)

# Force listed src on /api/space ingest
must_replace(
    """      rows.forEach(function (r) {
        var p = asPlace(r);
        if (p) { p.src = p.src || "listed"; shops.push(p); }
      });
      shops = uniqPlaces(shops);
      if (!isAdmin()) shops = shops.filter(function (s) { return seesShop(s); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
      var n = shops.filter(function (s) { return seesShop(s); }).length;
      var where = (seat.name && seat.how === "land") ? seat.name : (seat.lat.toFixed(3) + "," + seat.lng.toFixed(3));
      if (n) say(where + " · " + n + " real place" + (n === 1 ? "" : "s") + " on the field.");
      else say(where + " · no public vendors here yet.");
    }).catch(function () {});
    huntRace(huntNearby(), 4000).then(function (rows) {
      shops = uniqPlaces(shops.concat(rows || []));
      if (!isAdmin()) shops = shops.filter(function (s) { return seesShop(s); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
    });""",
    """      rows.forEach(function (r) {
        var p = asPlace(r);
        if (p) { p.src = "listed"; shops.push(p); }
      });
      shops = uniqPlaces(shops);
      if (!isAdmin()) shops = shops.filter(function (s) { return seesShop(s); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
      var n = shops.filter(function (s) { return seesShop(s); }).length;
      var where = (seat.name && seat.how === "land") ? seat.name : (seat.lat.toFixed(3) + "," + seat.lng.toFixed(3));
      if (n) say(where + " · " + n + " real place" + (n === 1 ? "" : "s") + " on the field.");
      else say(where + " · no public vendors here yet.");
    }).catch(function () {});
    huntRace(huntNearby(), 4000).then(function (rows) {
      /* union Overpass into listings — never replace the /api/space set */
      shops = uniqPlaces(shops.concat(rows || []));
      if (!isAdmin()) shops = shops.filter(function (s) { return seesShop(s); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
    });""",
    "pullListings-listed+union",
)

# hunt: keep union; name-filter for FIND sheet
must_replace(
    """      Promise.all([
        huntRace(spaceP, 4000),
        huntRace(huntApi(q), 4000),
        huntRace(huntNominatim(q), 4000),
        huntRace(huntOverpass(q), 4000)
      ]).then(function (packs) {
        var listed = shops.filter(function (s) { return s && (s.src === "listed" || s.src === "live"); });
        shops = uniqPlaces(listed.concat(packs[0] || [], packs[1] || [], packs[2] || [], packs[3] || []));
        showFound();
      }).catch(function () {
        say("Hunt timed out. Try again, or name the city.");
        showFound();
      });""",
    """      window.__snLastHunt = named || q;
      Promise.all([
        huntRace(spaceP, 4000),
        huntRace(huntApi(q), 4000),
        huntRace(huntNominatim(q), 4000),
        huntRace(huntOverpass(q), 4000)
      ]).then(function (packs) {
        packs[0] = (packs[0] || []).map(function (p) { if (p) p.src = "listed"; return p; });
        shops = uniqPlaces(shops.concat(packs[0] || [], packs[1] || [], packs[2] || [], packs[3] || []));
        showFound();
      }).catch(function () {
        say("Hunt timed out. Try again, or name the city.");
        showFound();
      });""",
    "hunt-union",
)

must_replace(
    """  function showFound() {
    if (!findWanted) {
      try { paintShopsOnMap(); } catch (e) {}
      return;
    }
    findWanted = false;
    shops = (shops || []).filter(function (s) { return seesShop(s); });
    if (!shops.length) {
      var seatMsg = activeSeat();
      var where = (seatMsg && seatMsg.name) ? seatMsg.name : (seatMsg ? (seatMsg.lat.toFixed(2) + "," + seatMsg.lng.toFixed(2)) : "this seat");
      say("No real pin for that hunt around " + where + ". Try another name, or land a city first.");
      return;
    }
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
  }""",
    """  function showFound() {
    if (!findWanted) {
      try { paintShopsOnMap(); } catch (e) {}
      return;
    }
    findWanted = false;
    var all = (shops || []).filter(function (s) { return seesShop(s); });
    var needle = String(window.__snLastHunt || "").toLowerCase().trim();
    var shown = all;
    if (needle.length >= 3) {
      var matched = all.filter(function (s) { return s && s.name && String(s.name).toLowerCase().indexOf(needle) >= 0; });
      if (matched.length) shown = matched;
    }
    shops = uniqPlaces(all);
    if (!shown.length) {
      var seatMsg = activeSeat();
      var where = (seatMsg && seatMsg.name) ? seatMsg.name : (seatMsg ? (seatMsg.lat.toFixed(2) + "," + seatMsg.lng.toFixed(2)) : "this seat");
      say("No real pin for that hunt around " + where + ". Try another name, or land a city first.");
      paintShopsOnMap();
      return;
    }
    var seat = here || shown[0];
    if (seat) openCity(seat);
    paintShopsOnMap();
    var html = shown.map(function (s, i) {
      var ch = (s.name.match(/[A-Za-zΑ-Ωα-ω]/) || ["·"])[0].toUpperCase();
      return '<button type="button" class="pill" data-act="vendor" data-i="' + i + '"><span class="ph">' + ch + "</span><div><b></b><span></span></div></button>";
    }).join("");
    openSheet("FIND · " + shown.length, html);
    var body = $("sn-sheet-body");
    if (body) {
      var pills = body.querySelectorAll(".pill");
      shown.forEach(function (s, i) {
        if (!pills[i]) return;
        pills[i].querySelector("b").textContent = s.name;
        pills[i].querySelector("span").textContent = (s.kind || "shop") + (s.phone ? " · " + s.phone : "") + (here ? " · " + haversineKm(here, s).toFixed(1) + " km" : "");
        pills[i].setAttribute("data-id", s.id || "");
      });
    }
    window.__snFindShown = shown;
    say(shown.length + " real pin" + (shown.length === 1 ? "" : "s") + ". Tap one to order.");
  }""",
    "showFound-name-filter",
)

# --- 3) GPS harden + sky X ---
must_replace(
    """  function bindGps() {
    var btn = $("gps");
    if (!btn || btn.__snGpsLock) return;
    btn.__snGpsLock = true;
    btn.addEventListener("click", function (ev) {
      ev.preventDefault(); ev.stopPropagation();
      adminPin = false;
      try { closeSky(); } catch (e) {}
      locate(function (pt) { land(pt, false); });
    }, true);
  }""",
    """  function bindGps() {
    var btn = $("gps");
    if (!btn || btn.__snGpsLock) return;
    btn.__snGpsLock = true;
    btn.style.setProperty("z-index", "280", "important");
    btn.style.setProperty("pointer-events", "auto", "important");
    function goGps(ev) {
      if (ev) { ev.preventDefault(); ev.stopPropagation(); if (ev.stopImmediatePropagation) ev.stopImmediatePropagation(); }
      adminPin = false;
      try { closeSky(); } catch (e) {}
      say("Locating…");
      locate(function (pt) {
        if (!pt || !isFinite(+pt.lat)) {
          say("Location failed. Allow GPS, or I will try the network.");
          return;
        }
        land(pt, false);
      }, false);
    }
    btn.addEventListener("click", goGps, true);
    btn.addEventListener("pointerup", goGps, true);
  }""",
    "bindGps-harden",
)

# sky close X + z-index
must_replace(
    """    if (x && !x.__sn) {
      x.__sn = true;
      x.addEventListener("click", function (e) { e.preventDefault(); closeSky(); });
    }""",
    """    if (x && !x.__sn) {
      x.__sn = true;
      x.style.setProperty("z-index", "320", "important");
      x.style.setProperty("pointer-events", "auto", "important");
      x.style.minWidth = "48px";
      x.style.minHeight = "48px";
      x.style.fontSize = "22px";
      function killSky(e) { if (e) { e.preventDefault(); e.stopPropagation(); } closeSky(); }
      x.addEventListener("click", killSky, true);
      x.addEventListener("pointerup", killSky, true);
    }
    var read = $("sn-sky-read");
    if (read) {
      read.style.setProperty("z-index", "310", "important");
      read.style.setProperty("pointer-events", "auto", "important");
      read.style.bottom = "calc(var(--dock, 72px) + 56px)";
      read.style.top = "auto";
      read.style.left = "50%";
      read.style.transform = "translateX(-50%)";
    }
    var sky = $("sn-sky");
    if (sky) sky.style.setProperty("z-index", "250", "important");""",
    "sky-x-hit",
)

# Fix injected gps z-index 46 → 280
must_replace(
    '"#gps{position:fixed!important;right:max(8px,env(safe-area-inset-right))!important;left:auto!important;top:auto!important;bottom:calc(var(--dock) + 16px)!important;z-index:46!important}"',
    '"#gps{position:fixed!important;right:max(8px,env(safe-area-inset-right))!important;left:auto!important;top:auto!important;bottom:calc(var(--dock) + 16px)!important;z-index:280!important;pointer-events:auto!important}"',
    "gps-z-index",
)

# --- 4) vendor sheet fee ---
must_replace(
    """    var html = '<div class="sn-prof">' + tilePhoto(s.photo, "🏪") + "<div><b>" + esc(s.name || "Vendor") + "</b>" + tileContact(s.phone, where) + "</div></div>" +
      (orders ? '<p class="note">CHARGED</p>' + orders : "") +
      '<p class="note">MENU</p>' + menu;
    openTile({ kind: "vendor", title: s.name || "VENDOR", html: html });""",
    """    var dest = resolveDrop(s);
    var feeHtml;
    if (dest && isFinite(+dest.lat)) {
      var qq = quoteDelivery(s, dest, {});
      feeHtml = '<p class="note">Delivery · <b>' + esc(qq.fee) + ' AV€</b> · ' + qq.km.toFixed(1) + ' km to ' + esc(dest.name || "your seat") + '</p>';
    } else {
      feeHtml = '<p class="note">Delivery · set a drop address</p>';
    }
    var html = '<div class="sn-prof">' + tilePhoto(s.photo, "🏪") + "<div><b>" + esc(s.name || "Vendor") + "</b>" + tileContact(s.phone, where) + "</div></div>" +
      feeHtml +
      (orders ? '<p class="note">CHARGED</p>' + orders : "") +
      '<p class="note">MENU</p>' + menu;
    openTile({ kind: "vendor", title: s.name || "VENDOR", html: html });""",
    "vendor-fee",
)

# --- 5) APPLY / X ---
must_replace(
    """      "#sn-sheet .sheet-apply,#sn-sheet .sheet-x{flex:none!important;display:flex!important;align-items:center!important;justify-content:center!important;width:48px!important;height:48px!important;margin:0!important;padding:0!important;border:0!important;border-radius:0!important;background:transparent!important;font:800 26px/1 system-ui!important;box-shadow:none!important}",
      "#sn-sheet .sheet-apply{color:#7dff9a!important}",""",
    """      "#sn-sheet .sheet-apply,#sn-sheet .sheet-x{flex:none!important;display:flex!important;align-items:center!important;justify-content:center!important;min-width:56px!important;height:48px!important;margin:0!important;padding:0 8px!important;border:0!important;border-radius:0!important;background:transparent!important;box-shadow:none!important;pointer-events:auto!important;z-index:6!important}",
      "#sn-sheet .sheet-apply{color:#7dff9a!important;font:800 11px/1 system-ui!important;letter-spacing:.1em!important;width:auto!important;min-width:64px!important}",
      "#sn-sheet .sheet-x{color:#ff8a8a!important;font:800 22px/1 system-ui!important;width:56px!important;min-width:56px!important}",""",
    "apply-x-css",
)

must_replace(
    """    card.innerHTML = '<div class="sheet-bar"><button type="button" class="sheet-apply" data-act="sheet-apply" aria-label="Apply">✓</button><div class="sheet-mid"></div><button type="button" class="sheet-x" data-act="sheet-x" aria-label="Close">✕</button></div><div id="sn-sheet-body"></div>';""",
    """    card.innerHTML = '<div class="sheet-bar"><button type="button" class="sheet-apply" data-act="sheet-apply" aria-label="Apply">APPLY</button><div class="sheet-mid"></div><button type="button" class="sheet-x" data-act="sheet-x" aria-label="Close">X</button></div><div id="sn-sheet-body"></div>';""",
    "apply-x-html",
)

must_replace(
    """      '<div class="sheet-bar"><button type="button" class="sheet-apply" data-act="support-send" aria-label="Apply">✓</button><b class="sheet-ttl">BUILD</b><button type="button" class="sheet-x" data-act="support-close" aria-label="Close">✕</button></div>' +""",
    """      '<div class="sheet-bar"><button type="button" class="sheet-apply" data-act="support-send" aria-label="Apply">APPLY</button><b class="sheet-ttl">BUILD</b><button type="button" class="sheet-x" data-act="support-close" aria-label="Close">X</button></div>' +""",
    "support-apply-x",
)

# tasks bar in index is separate; patch if present in app templates
if 'aria-label="Apply">✓</button><b class="sheet-ttl">JOBS</b>' in s:
    s = s.replace(
        'aria-label="Apply">✓</button><b class="sheet-ttl">JOBS</b><button type="button" class="sheet-x" data-act="hide" aria-label="Close">✕</button>',
        'aria-label="Apply">APPLY</button><b class="sheet-ttl">JOBS</b><button type="button" class="sheet-x" data-act="hide" aria-label="Close">X</button>',
        1,
    )
    print("ok jobs-apply-x")


# FIND pill → correct shop from shown list
must_replace(
    'if (act === "vendor" && isFinite(i) && shops[i]) openVendor(shops[i]);',
    'if (act === "vendor" && isFinite(i)) { var pack = window.__snFindShown || shops; if (pack[i]) openVendor(pack[i]); }',
    "find-pill-shown",
)

# VER bump placeholder (stamp also sets it)
if 'var VER = "4330"' in s:
    s = s.replace('var VER = "4330"', 'var VER = "4331"', 1)
    print("ok VER→4331")
elif 'var VER = "4329"' in s:
    s = s.replace('var VER = "4329"', 'var VER = "4331"', 1)
    print("ok VER→4331")

app_path.write_text(s, encoding="utf-8")
print("wrote", app_path, "bytes", len(s))
