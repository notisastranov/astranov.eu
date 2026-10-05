#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""4330: geocode, Enter, TESTER filter, seatPlace overrides GPS, Power mute,
wheel aim under cursor, land always pulls /api/space + OSM (4s), hunt never hangs."""
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


# --- landPlaceAsk via /api/find ---
must_replace(
    """  function landPlaceAsk(ask) {
    if (!ask) return false;
    var seq = ++placeSeq;
    if (ask.geo) {
      seatPlace(ask.geo);
      say((ask.place || "Place") + " on the map.");
      return true;
    }
    say("Finding " + ask.place + "…");
    var url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=" + encodeURIComponent(ask.place);
    fetchJson(url, { headers: { Accept: "application/json" } }).then(function (rows) {
      if (seq !== placeSeq) return;
      var r = Array.isArray(rows) && rows[0];
      if (r && isFinite(+r.lat) && isFinite(+r.lon)) {
        seatPlace({ lat: +r.lat, lng: +r.lon, name: ask.place });
        say(ask.place + " on the map.");
      } else say("No map pin for " + ask.place + " yet. Try city and country, or lat,lng.");
    });
    return true;
  }""",
    """  function landPlaceAsk(ask) {
    if (!ask) return false;
    var seq = ++placeSeq;
    if (ask.geo) {
      seatPlace(ask.geo);
      say((ask.place || "Place") + " on the map.");
      return true;
    }
    say("Finding " + ask.place + "…");
    var url = "/api/find?q=" + encodeURIComponent(ask.place);
    fetchJson(url, { cache: "no-store", headers: { Accept: "application/json" } }).then(function (j) {
      if (seq !== placeSeq) return;
      var rows = (j && j.places) || [];
      var r = rows[0];
      if (r && isFinite(+r.lat) && isFinite(+r.lng)) {
        seatPlace({ lat: +r.lat, lng: +r.lng, name: r.name || ask.place, raw: r.raw || "" });
        say((r.name || ask.place) + " on the map.");
      } else {
        var msg = (j && j.meta && j.meta.message) || ("No map pin for " + ask.place + ". Try city and country, or lat,lng.");
        say(msg);
      }
    });
    return true;
  }""",
    "landPlaceAsk-/api/find",
)

# --- seatPlace: named place always overrides GPS/IP seat ---
must_replace(
    """  function seatPlace(geo) {
    if (!geo || !isFinite(+geo.lat) || !isFinite(+geo.lng)) return;
    intro = false;
    lastSeat = { lat: +geo.lat, lng: +geo.lng, name: geo.name || geo.label || "place" };
    aim = { lat: lastSeat.lat, lng: lastSeat.lng };
    try { closeSky(); } catch (e) {}
    try { flyTo(aim, 1.05); } catch (e) {}
    openCity(aim);
    if (map) {
      try { map.setView([aim.lat, aim.lng], 15); map.invalidateSize(); } catch (e) {}
    }
    pullListings();
  }""",
    """  function seatPlace(geo) {
    if (!geo || !isFinite(+geo.lat) || !isFinite(+geo.lng)) return;
    intro = false;
    seated = true;
    adminPin = true;
    lastSeat = { lat: +geo.lat, lng: +geo.lng, name: geo.name || geo.label || "place" };
    here = { lat: lastSeat.lat, lng: lastSeat.lng };
    window.__SN_HERE = here;
    aim = { lat: lastSeat.lat, lng: lastSeat.lng };
    listingTried = false;
    try { closeSky(); } catch (e) {}
    try { lookAt(aim, 1.05); } catch (e) { try { flyTo(aim, 1.05); } catch (e2) {} }
    openCity(aim);
    if (map) {
      try { map.setView([aim.lat, aim.lng], 15); map.invalidateSize(); } catch (e) {}
    }
    pullListings();
  }""",
    "seatPlace-override-GPS",
)

# --- hunt: no IP; timeouts; include /api/space ---
must_replace(
    """  function hunt(q) {
    q = String(q || "").trim();
    if (!q) return;
    materialize(true);
    say("Finding " + q + "…");
    var go = function () {
      Promise.all([
        huntRace(huntApi(q), 9000),
        huntRace(huntNominatim(q), 9000),
        huntRace(huntOverpass(q), 3500)
      ]).then(function (packs) {
        var listed = shops.filter(function (s) { return s && s.src === "listed"; });
        shops = uniqPlaces(listed.concat(packs[0] || [], packs[1] || [], packs[2] || []));
        showFound();
      });
    };
    if (!here) locate(function (pt) { land(pt, false); go(); });
    else go();
  }""",
    """  function hunt(q) {
    q = String(q || "").trim();
    if (!q) return;
    materialize(true);
    say("Finding " + q + "…");
    var named = /^(go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+/i.test(q)
      ? q.replace(/^(go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+/i, "")
      : q.replace(/^(find|hunt|show)\\s+/i, "").trim();
    var looksPlace = !!(named && !/pizza|pizzeria|shop|vendor|restaurant|cafe|food|near|pharmacy|hotel|market/i.test(named));
    var go = function () {
      var spaceP = Promise.resolve([]);
      if (here) {
        spaceP = fetchJson("/api/space?lat=" + Number(here.lat).toFixed(2) + "&lng=" + Number(here.lng).toFixed(2), { cache: "no-store" }).then(function (j) {
          return ((j && (j.shops || j.rows)) || []).map(function (r) {
            var p = asPlace(r);
            if (p) p.src = p.src || "listed";
            return p;
          }).filter(Boolean);
        }).catch(function () { return []; });
      }
      Promise.all([
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
      });
    };
    if (!here && looksPlace) {
      fetchJson("/api/find?q=" + encodeURIComponent(named), { cache: "no-store" }).then(function (j) {
        var r = ((j && j.places) || [])[0];
        if (r && isFinite(+r.lat) && isFinite(+r.lng)) {
          seatPlace({ lat: +r.lat, lng: +r.lng, name: r.name || named, raw: r.raw || "" });
          say((r.name || named) + " on the map.");
          go();
        } else {
          say((j && j.meta && j.meta.message) || ("No map pin for " + named + ". Try city and country."));
        }
      });
      return;
    }
    if (!here) {
      say("Allow location or name a city. I will not guess from your IP.");
      return;
    }
    go();
  }""",
    "hunt-space+timeouts",
)

must_replace(
    """  function showFound() {
    if (!shops.length) { say("No real pin for that hunt. Try another name near GPS."); return; }""",
    """  function showFound() {
    shops = (shops || []).filter(function (s) { return seesShop(s); });
    if (!shops.length) { say("No real pin for that hunt. Name a city and country, or tap GPS — I will not hunt around your IP."); return; }""",
    "showFound-filter",
)

# --- pullListings: always space + OSM 4s; never one-shot listingTried forever ---
must_replace(
    """  function pullListings() {
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
        } else if (here && !cityOn) say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · tap GPS for the city");
      });
    }
  }""",
    """  function pullListings() {
    if (!here) return;
    var url = "/api/space?lat=" + Number(here.lat).toFixed(2) + "&lng=" + Number(here.lng).toFixed(2);
    fetchJson(url, { cache: "no-store" }).then(function (j) {
      var rows = (j && (j.shops || j.rows || [])) || [];
      rows.forEach(function (r) {
        var p = asPlace(r);
        if (p) { p.src = p.src || "listed"; shops.push(p); }
      });
      shops = uniqPlaces(shops).filter(function (s) { return seesShop(s) || isAdmin(); });
      if (!isAdmin()) shops = shops.filter(function (s) { return seesShop(s); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
      var n = shops.filter(function (s) { return seesShop(s); }).length;
      if (n) say((lastSeat && lastSeat.name ? lastSeat.name + " · " : "") + n + " real place" + (n === 1 ? "" : "s") + " on the field.");
      else say((lastSeat && lastSeat.name ? lastSeat.name + " · " : "") + "No public vendors here yet.");
    }).catch(function () {});
    huntRace(huntNearby(), 4000).then(function (rows) {
      shops = uniqPlaces(shops.concat(rows || []));
      if (!isAdmin()) shops = shops.filter(function (s) { return seesShop(s); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
    });
    listingTried = true;
  }""",
    "pullListings-always-space+OSM4s",
)

# --- huntNearby / huntOverpass: 4s abort ---
must_replace(
    """  function huntNearby() {
    if (!here) return Promise.resolve([]);
    var data = '[out:json][timeout:12];(nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pharmacy)$"](around:2500,' + here.lat + "," + here.lng + ');nwr["shop"](around:2500,' + here.lat + "," + here.lng + '););out center 24;';
    return fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: data }).then(function (r) { return r.json(); }).then(function (j) {
      return uniqPlaces(((j && j.elements) || []).map(function (el) { el.src = "overpass"; return asPlace(el); }).filter(Boolean));
    }).catch(function () { return []; });
  }""",
    """  function huntNearby() {
    if (!here) return Promise.resolve([]);
    var data = '[out:json][timeout:4];(nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pharmacy)$"](around:2500,' + here.lat + "," + here.lng + ');nwr["shop"](around:2500,' + here.lat + "," + here.lng + '););out center 24;';
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 4000) : null;
    return fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: data, signal: ctrl && ctrl.signal }).then(function (r) { return r.json(); }).then(function (j) {
      return uniqPlaces(((j && j.elements) || []).map(function (el) { el.src = "overpass"; return asPlace(el); }).filter(Boolean));
    }).catch(function () { return []; }).finally(function () { if (t) clearTimeout(t); });
  }""",
    "huntNearby-4s",
)

# --- TESTER filter ---
must_replace(
    """  function seesShop(s) {
    if (!s || s.status === "denied") return false;
    if (s.status === "pending" && !isAdmin()) return false;
    if (isAdmin()) return true;
    if (wall(me(), s.owner || "") || wall(me(), s.id)) return false;
    return true;
  }
  function seesDriver(p) {
    if (!p) return false;
    if (isAdmin()) return true;
    var id = me();
    if (wall(id, p.owner || "") || wall(id, p.id)) return false;
    if ((p.owner || "") === id) return true;
    return jobs.some(function (j) {
      if (!j || j.received) return false;
      var mine = j.client === id || j.vendorOwner === id;
      return mine && (j.driverId === p.id || j.driver === p.name);
    });
  }
  function seesJob(j) {
    if (!j) return false;
    if (isAdmin()) return true;
    var id = me();
    return j.client === id || j.vendorOwner === id || j.driverOwner === id;
  }""",
    """  function isTestFixture(row) {
    if (!row) return false;
    if (row.kind === "tester" || row.id === "tester-live" || row.src === "tester") return true;
    var blob = String(row.name || "") + " " + String(row.title || "") + " " + String(row.note || "") + " " + String(row.id || "") + " " + String(row.owner || "");
    if (/\\bTESTER\\b/i.test(blob)) return true;
    if (/test\\s*vendor/i.test(blob)) return true;
    if (/\\bV?4297\\b/i.test(blob)) return true;
    if (/tester\\s*client/i.test(blob)) return true;
    return false;
  }
  function seesShop(s) {
    if (!s || s.status === "denied") return false;
    if (s.status === "pending" && !isAdmin()) return false;
    if (isAdmin()) return true;
    if (isTestFixture(s)) return false;
    if (wall(me(), s.owner || "") || wall(me(), s.id)) return false;
    return true;
  }
  function seesDriver(p) {
    if (!p) return false;
    if (isAdmin()) return true;
    if (isTestFixture(p)) return false;
    var id = me();
    if (wall(id, p.owner || "") || wall(id, p.id)) return false;
    if ((p.owner || "") === id) return true;
    return jobs.some(function (j) {
      if (!j || j.received) return false;
      var mine = j.client === id || j.vendorOwner === id;
      return mine && (j.driverId === p.id || j.driver === p.name);
    });
  }
  function seesJob(j) {
    if (!j) return false;
    if (isAdmin()) return true;
    if (isTestFixture(j) || isTestFixture(j.vendor) || isTestFixture(j.drop)) return false;
    var id = me();
    return j.client === id || j.vendorOwner === id || j.driverOwner === id;
  }""",
    "sees*-tester",
)

must_replace(
    """  function paintTester(items) {
    var it = null;
    (items || []).forEach(function (x) { if (x && (x.kind === "tester" || x.id === "tester-live")) it = x; });
    var el = $("sn-tester");
    if (!el) {
      el = document.createElement("div");
      el.id = "sn-tester";
      document.body.appendChild(el);
    }
    if (!it) { el.textContent = "TESTER · no check yet"; el.classList.add("stale"); return; }""",
    """  function paintTester(items) {
    var el = $("sn-tester");
    if (!isAdmin()) {
      if (el) { el.style.display = "none"; el.textContent = ""; }
      if (testerMark && map) { try { map.removeLayer(testerMark); } catch (e) {} testerMark = null; }
      return;
    }
    var it = null;
    (items || []).forEach(function (x) { if (x && (x.kind === "tester" || x.id === "tester-live")) it = x; });
    if (!el) {
      el = document.createElement("div");
      el.id = "sn-tester";
      document.body.appendChild(el);
    }
    el.style.display = "";
    if (!it) { el.textContent = "TESTER · no check yet"; el.classList.add("stale"); return; }""",
    "paintTester-admin",
)

must_replace(
    """    var place = here && near ? near + " vendor" + (near === 1 ? "" : "s") + " here" : vendors + " vendor" + (vendors === 1 ? "" : "s");
    el.textContent = "LIVE · " + place + " · " + drivers + " driver" + (drivers === 1 ? "" : "s") + " · " + orders + " order" + (orders === 1 ? "" : "s");
  }""",
    """    if (!vendors && !drivers && !orders) {
      el.textContent = "LIVE · no public vendors · no drivers · no orders";
      return;
    }
    var place = here && near ? near + " vendor" + (near === 1 ? "" : "s") + " here" : vendors + " vendor" + (vendors === 1 ? "" : "s");
    el.textContent = "LIVE · " + place + " · " + drivers + " driver" + (drivers === 1 ? "" : "s") + " · " + orders + " order" + (orders === 1 ? "" : "s");
  }""",
    "paintPulse-empty",
)

# --- Power on: never auto-open OFFER/JOBS ---
must_replace(
    """        if (on) {
          say("Offers live. Jobs and nearby work can pop.");
          materialize(true);
          var jobsMuted = false;
          try { jobsMuted = sessionStorage.getItem("sn:jobs-muted") === "1"; } catch (e) {}
          if (jobs.length) {
            jobs.slice(0, 6).forEach(function (j) { throwOffer(j); });
            /* muted X / closed JOBS stay closed across Power cycle */
            if (!jobsMuted) {
              /* do not auto-open JOBS — user opens when they want */
            }
            closeJobs();
          } else {
            var liveId = "offer-live";
            try {
              if (sessionStorage.getItem("sn:offer-x:" + liveId)) { /* stay quiet */ }
              else throwOffer({ id: "live", name: "OFFERS", note: "Offers are live. Hunt a pin or wait for work." });
            } catch (e) {
              throwOffer({ id: "live", name: "OFFERS", note: "Offers are live. Hunt a pin or wait for work." });
            }
          }
        } else {""",
    """        if (on) {
          say("Offers live. Open JOBS when you want — nothing pops by itself.");
          materialize(true);
          try { sessionStorage.setItem("sn:jobs-muted", sessionStorage.getItem("sn:jobs-muted") || "1"); } catch (e) {}
          closeJobs();
          try { closeSheet(); } catch (e) {}
          /* never throwOffer / openJobs / open OFFER sheet on Power-on */
        } else {""",
    "power-on-no-auto-offer",
)

# --- globeHit lon sign + aimAt keep-under-cursor ---
must_replace(
    """  function globeHit(sx, sy, c) {
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
  }""",
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
    "globeHit-lon-selfcheck",
)

must_replace(
    """  function aimAt(sx, sy) {
    var hit = globeHit(sx, sy, cam);
    if (hit && isFinite(hit.lat) && isFinite(hit.lng)) aim = { lat: hit.lat, lng: hit.lng };
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
      try { map.flyTo(map.getCenter(), nz, { duration: 0.28 }); } catch (e) { try { map.setZoom(nz); } catch (e2) {} }
      return;
    }
    if (dir < 0 && sx != null) aimAt(sx, sy);
    wheelAt = Date.now();
    zoomToDist(cam.dist * (dir < 0 ? 0.72 : 1.18), sx, sy);
  }""",
    """  function aimAt(sx, sy) {
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
    "aimAt-keep-under-cursor",
)

# --- Enter submit ---
must_replace(
    """    var f = $("f"), inp = $("in"), go = $("go");
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
    if (inp) inp.addEventListener("input", function () { materialize(needFilter()); });""",
    """    var f = $("f"), inp = $("in"), go = $("go");
    if (f && !f.__sn) {
      f.__sn = true;
      if (!f.querySelector('button[type="submit"]')) {
        var hid = document.createElement("button");
        hid.type = "submit";
        hid.hidden = true;
        hid.setAttribute("aria-hidden", "true");
        hid.tabIndex = -1;
        f.appendChild(hid);
      }
      function submitTalk(e) {
        if (e) e.preventDefault();
        var v = inp && inp.value;
        if (inp) inp.value = "";
        if (typeof paintGo === "function") paintGo();
        talk(v, false);
        materialize(needFilter());
      }
      f.addEventListener("submit", submitTalk);
      if (inp && !inp.__snEnter) {
        inp.__snEnter = true;
        inp.addEventListener("keydown", function (e) {
          if (e.key !== "Enter" && e.keyCode !== 13) return;
          if (e.isComposing || e.keyCode === 229) return;
          e.preventDefault();
          submitTalk(e);
        });
      }
    }
    if (inp) inp.addEventListener("input", function () { materialize(needFilter()); });""",
    "enter-submit",
)


# --- activeSeat: landed place > map center > GPS/IP ---
must_replace(
    """  function seatPlace(geo) {
    if (!geo || !isFinite(+geo.lat) || !isFinite(+geo.lng)) return;
    intro = false;
    seated = true;
    adminPin = true;
    lastSeat = { lat: +geo.lat, lng: +geo.lng, name: geo.name || geo.label || "place" };
    here = { lat: lastSeat.lat, lng: lastSeat.lng };
    window.__SN_HERE = here;
    aim = { lat: lastSeat.lat, lng: lastSeat.lng };
    listingTried = false;
    try { closeSky(); } catch (e) {}
    try { lookAt(aim, 1.05); } catch (e) { try { flyTo(aim, 1.05); } catch (e2) {} }
    openCity(aim);
    if (map) {
      try { map.setView([aim.lat, aim.lng], 15); map.invalidateSize(); } catch (e) {}
    }
    pullListings();
  }""",
    """  function activeSeat() {
    if (lastSeat && isFinite(+lastSeat.lat) && isFinite(+lastSeat.lng)) {
      return { lat: +lastSeat.lat, lng: +lastSeat.lng, name: lastSeat.name || "place", how: "land" };
    }
    if (aim && isFinite(+aim.lat) && isFinite(+aim.lng) && adminPin) {
      return { lat: +aim.lat, lng: +aim.lng, name: (aim.name || "map"), how: "land" };
    }
    try {
      if (map && cityOn) {
        var c = map.getCenter();
        if (c && isFinite(+c.lat) && isFinite(+c.lng)) {
          return { lat: +c.lat, lng: +c.lng, name: "map", how: "pan" };
        }
      }
    } catch (e) {}
    if (here && isFinite(+here.lat) && isFinite(+here.lng)) {
      return { lat: +here.lat, lng: +here.lng, name: (here.name || ""), how: "here" };
    }
    if (hereLive && isFinite(+hereLive.lat) && isFinite(+hereLive.lng)) {
      return { lat: +hereLive.lat, lng: +hereLive.lng, name: "", how: "gps" };
    }
    return null;
  }
  function seatPlace(geo) {
    if (!geo || !isFinite(+geo.lat) || !isFinite(+geo.lng)) return;
    intro = false;
    seated = true;
    adminPin = true;
    lastSeat = { lat: +geo.lat, lng: +geo.lng, name: geo.name || geo.label || "place" };
    here = { lat: lastSeat.lat, lng: lastSeat.lng, name: lastSeat.name };
    window.__SN_HERE = here;
    aim = { lat: lastSeat.lat, lng: lastSeat.lng, name: lastSeat.name };
    listingTried = false;
    try { closeSky(); } catch (e) {}
    try { lookAt(aim, 1.05); } catch (e) { try { flyTo(aim, 1.05); } catch (e2) {} }
    openCity(aim);
    if (map) {
      try { map.setView([aim.lat, aim.lng], 15); map.invalidateSize(); } catch (e) {}
    }
    pullListings();
  }""",
    "activeSeat+seatPlace",
)

# pullListings must use activeSeat coords (already sets here in seatPlace; rewire URL + copy)
must_replace(
    """  function pullListings() {
    if (!here) return;
    var url = "/api/space?lat=" + Number(here.lat).toFixed(2) + "&lng=" + Number(here.lng).toFixed(2);
    fetchJson(url, { cache: "no-store" }).then(function (j) {
      var rows = (j && (j.shops || j.rows || [])) || [];
      rows.forEach(function (r) {
        var p = asPlace(r);
        if (p) { p.src = p.src || "listed"; shops.push(p); }
      });
      shops = uniqPlaces(shops).filter(function (s) { return seesShop(s) || isAdmin(); });
      if (!isAdmin()) shops = shops.filter(function (s) { return seesShop(s); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
      var n = shops.filter(function (s) { return seesShop(s); }).length;
      if (n) say((lastSeat && lastSeat.name ? lastSeat.name + " · " : "") + n + " real place" + (n === 1 ? "" : "s") + " on the field.");
      else say((lastSeat && lastSeat.name ? lastSeat.name + " · " : "") + "No public vendors here yet.");
    }).catch(function () {});
    huntRace(huntNearby(), 4000).then(function (rows) {
      shops = uniqPlaces(shops.concat(rows || []));
      if (!isAdmin()) shops = shops.filter(function (s) { return seesShop(s); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
    });
    listingTried = true;
  }""",
    """  function pullListings() {
    var seat = activeSeat();
    if (!seat) return;
    here = { lat: seat.lat, lng: seat.lng, name: seat.name || (here && here.name) || "" };
    window.__SN_HERE = here;
    var url = "/api/space?lat=" + Number(seat.lat).toFixed(3) + "&lng=" + Number(seat.lng).toFixed(3);
    fetchJson(url, { cache: "no-store" }).then(function (j) {
      var rows = (j && (j.shops || j.rows || [])) || [];
      rows.forEach(function (r) {
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
    });
    listingTried = true;
  }""",
    "pullListings-activeSeat",
)

# huntApi + huntNearby + huntOverpass center on activeSeat
must_replace(
    """  function huntNearby() {
    if (!here) return Promise.resolve([]);
    var data = '[out:json][timeout:4];(nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pharmacy)$"](around:2500,' + here.lat + "," + here.lng + ');nwr["shop"](around:2500,' + here.lat + "," + here.lng + '););out center 24;';
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 4000) : null;
    return fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: data, signal: ctrl && ctrl.signal }).then(function (r) { return r.json(); }).then(function (j) {
      return uniqPlaces(((j && j.elements) || []).map(function (el) { el.src = "overpass"; return asPlace(el); }).filter(Boolean));
    }).catch(function () { return []; }).finally(function () { if (t) clearTimeout(t); });
  }""",
    """  function huntNearby() {
    var seat = activeSeat() || here;
    if (!seat || !isFinite(+seat.lat)) return Promise.resolve([]);
    var data = '[out:json][timeout:4];(nwr["amenity"~"^(restaurant|cafe|fast_food|bar|pharmacy)$"](around:2500,' + seat.lat + "," + seat.lng + ');nwr["shop"](around:2500,' + seat.lat + "," + seat.lng + '););out center 24;';
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 4000) : null;
    return fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: data, signal: ctrl && ctrl.signal }).then(function (r) { return r.json(); }).then(function (j) {
      return uniqPlaces(((j && j.elements) || []).map(function (el) { el.src = "overpass"; return asPlace(el); }).filter(Boolean));
    }).catch(function () { return []; }).finally(function () { if (t) clearTimeout(t); });
  }""",
    "huntNearby-activeSeat",
)

must_replace(
    """  function huntApi(q) {
    if (!here) return Promise.resolve([]);
    var url = "/api/find?q=" + encodeURIComponent(q) + "&lat=" + here.lat.toFixed(4) + "&lng=" + here.lng.toFixed(4);
    return fetchJson(url).then(function (j) {
      return ((j && j.places) || []).map(function (p) { p.src = "find"; return asPlace(p); }).filter(Boolean);
    });
  }""",
    """  function huntApi(q) {
    var seat = activeSeat() || here;
    if (!seat || !isFinite(+seat.lat)) return Promise.resolve([]);
    var url = "/api/find?q=" + encodeURIComponent(q) + "&lat=" + Number(seat.lat).toFixed(4) + "&lng=" + Number(seat.lng).toFixed(4);
    return fetchJson(url).then(function (j) {
      return ((j && j.places) || []).map(function (p) { p.src = "find"; return asPlace(p); }).filter(Boolean);
    });
  }""",
    "huntApi-activeSeat",
)

# huntOverpass uses here — patch to activeSeat
OLD_HO = None
# find in current tip via patched app pattern
must_replace(
    """  function huntOverpass(q) {
    if (!here) return Promise.resolve([]);
    var safe = String(q || "").replace(/[^a-zA-Z0-9α-ωΑ-ΩάέήίόύώΆ-Ώ ]/g, " ").trim();
    if (!safe) return Promise.resolve([]);
    var data = '[out:json][timeout:12];(nwr["name"~"' + safe + '",i](around:4000,' + here.lat + "," + here.lng + '););out center 12;';
    return fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: data }).then(function (r) { return r.json(); }).then(function (j) {
      return ((j && j.elements) || []).map(function (el) { el.src = "overpass"; return asPlace(el); }).filter(Boolean);
    }).catch(function () { return []; });
  }""",
    """  function huntOverpass(q) {
    var seat = activeSeat() || here;
    if (!seat || !isFinite(+seat.lat)) return Promise.resolve([]);
    var safe = String(q || "").replace(/[^a-zA-Z0-9α-ωΑ-ΩάέήίόύώΆ-Ώ ]/g, " ").trim();
    if (!safe) return Promise.resolve([]);
    var data = '[out:json][timeout:4];(nwr["name"~"' + safe + '",i](around:4000,' + seat.lat + "," + seat.lng + '););out center 12;';
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 4000) : null;
    return fetch("https://overpass-api.de/api/interpreter", { method: "POST", body: data, signal: ctrl && ctrl.signal }).then(function (r) { return r.json(); }).then(function (j) {
      return ((j && j.elements) || []).map(function (el) { el.src = "overpass"; return asPlace(el); }).filter(Boolean);
    }).catch(function () { return []; }).finally(function () { if (t) clearTimeout(t); });
  }""",
    "huntOverpass-activeSeat",
)

# hunt() spaceP uses here — switch to activeSeat
must_replace(
    """      var spaceP = Promise.resolve([]);
      if (here) {
        spaceP = fetchJson("/api/space?lat=" + Number(here.lat).toFixed(2) + "&lng=" + Number(here.lng).toFixed(2), { cache: "no-store" }).then(function (j) {
          return ((j && (j.shops || j.rows)) || []).map(function (r) {
            var p = asPlace(r);
            if (p) p.src = p.src || "listed";
            return p;
          }).filter(Boolean);
        }).catch(function () { return []; });
      }""",
    """      var spaceP = Promise.resolve([]);
      var seat0 = activeSeat() || here;
      if (seat0 && isFinite(+seat0.lat)) {
        spaceP = fetchJson("/api/space?lat=" + Number(seat0.lat).toFixed(3) + "&lng=" + Number(seat0.lng).toFixed(3), { cache: "no-store" }).then(function (j) {
          return ((j && (j.shops || j.rows)) || []).map(function (r) {
            var p = asPlace(r);
            if (p) p.src = p.src || "listed";
            return p;
          }).filter(Boolean);
        }).catch(function () { return []; });
      }""",
    "hunt-spaceP-activeSeat",
)

# openCity: bind moveend to update seat + refresh listings; GPS never overwrites land
must_replace(
    """      map.on("zoomend", function () {
        try {
          if (map && map.getZoom() <= 12.5) {
            closeCity();
            zoomToDist(1.25);
          }
        } catch (e) {}
      });
      var lastTap = 0;
      map.on("click", function () {
        var t = Date.now();
        if (t - lastTap < 320) closeCity();
        lastTap = t;
      });""",
    """      map.on("zoomend", function () {
        try {
          if (map && map.getZoom() <= 12.5) {
            closeCity();
            zoomToDist(1.25);
          }
        } catch (e) {}
      });
      map.on("moveend", function () {
        try {
          if (!map || !cityOn) return;
          var c = map.getCenter();
          if (!c || !isFinite(+c.lat)) return;
          /* pan updates the active seat; do not clear a named landing name unless far */
          var prev = lastSeat;
          if (prev && isFinite(+prev.lat) && haversineKm(prev, { lat: +c.lat, lng: +c.lng }) < 2.5) {
            lastSeat = { lat: +c.lat, lng: +c.lng, name: prev.name || "place" };
          } else {
            lastSeat = { lat: +c.lat, lng: +c.lng, name: (prev && prev.name) || "map" };
          }
          adminPin = true;
          here = { lat: lastSeat.lat, lng: lastSeat.lng, name: lastSeat.name };
          window.__SN_HERE = here;
          aim = { lat: lastSeat.lat, lng: lastSeat.lng, name: lastSeat.name };
          pullListings();
        } catch (e) {}
      });
      var lastTap = 0;
      map.on("click", function () {
        var t = Date.now();
        if (t - lastTap < 320) closeCity();
        lastTap = t;
      });""",
    "map-moveend-seat",
)

# showFound hunt copy — no "near GPS"
must_replace(
    """    if (!shops.length) { say("No real pin for that hunt. Name a city and country, or tap GPS — I will not hunt around your IP."); return; }""",
    """    if (!shops.length) {
      var seatMsg = activeSeat();
      var where = (seatMsg && seatMsg.name) ? seatMsg.name : (seatMsg ? (seatMsg.lat.toFixed(2) + "," + seatMsg.lng.toFixed(2)) : "this seat");
      say("No real pin for that hunt around " + where + ". Try another name, or land a city first.");
      return;
    }""",
    "showFound-seat-copy",
)

# resolveDrop / fee: prefer activeSeat over IP — patch resolveDrop if it uses hereLive first

if "findOpenTwin" not in s:
    raise SystemExit("findOpenTwin missing")
if "resolveDrop" not in s:
    raise SystemExit("resolveDrop missing")
if 'var VER = "4329"' in s:
    s = s.replace('var VER = "4329"', 'var VER = "4330"', 1)
    print("ok VER→4330")
elif 'var VER = "4328"' in s:
    s = s.replace('var VER = "4328"', 'var VER = "4330"', 1)
    print("ok VER→4330")


# --- fghi-4330 ---
if "var findWanted = false" not in s:
    if "function showFound() {" not in s:
        raise SystemExit("showFound missing")
    s = s.replace(
        "function showFound() {",
        "var findWanted = false;\n  function showFound() {\n    if (!findWanted) {\n      try { paintShopsOnMap(); } catch (e) {}\n      return;\n    }\n    findWanted = false;",
        1,
    )
    print("ok showFound-guard")
if "findWanted = true" not in s:
    old = "function hunt(q) {\n    q = String(q || \"\").trim();\n    if (!q) return;"
    if old not in s:
        raise SystemExit("hunt start missing for findWanted")
    s = s.replace(old, old + "\n    findWanted = true;", 1)
    print("ok hunt-findWanted")
if "showHunt()" in s:
    s = s.replace(
        "if (shops.length) { openCity(shops[0]); paintShopsOnMap(); showHunt(); return; }",
        "if (shops.length) { openCity(shops[0]); paintShopsOnMap(); return; }",
        1,
    )
    print("ok drop-showHunt")

banned = "List a vendor and the menu"
if banned in s:
    s = s.replace(
        '<button type="button" class="sheet-go primary" data-act="form-vendor">List a vendor and the menu</button>',
        '<button type="button" class="sheet-go primary" data-act="form-vendor">VENDOR</button>',
    )
    s = s.replace(
        '<button type="button" class="sheet-go" data-act="form-drop">List a delivery address</button>',
        '<button type="button" class="sheet-go" data-act="form-drop">CLIENT</button>',
    )
    s = s.replace(
        '<button type="button" class="sheet-go" data-act="form-driver">List a driver base</button>',
        '<button type="button" class="sheet-go" data-act="form-driver">DRIVER</button>',
    )
    if 'data-act="form-vendor">List a vendor' in s or 'data-act="form-drop">List a delivery' in s or 'data-act="form-driver">List a driver' in s:
        raise SystemExit("banned hold rows remain")
    print("ok hold-menu-ban")

if "function findOwnRoleTwin" not in s:
    mark = "  function checkoutVendor()"
    if mark not in s:
        raise SystemExit("checkoutVendor missing")
    twin_fn = (
        "  function findOwnRoleTwin(kind) {\n"
        "    var who = me();\n"
        "    if (!who) return null;\n"
        "    var want = String(kind || \"\");\n"
        "    var i, r;\n"
        "    try {\n"
        "      var mine = JSON.parse(localStorage.getItem(\"sn:mine\") || \"[]\") || [];\n"
        "      for (i = 0; i < mine.length; i++) {\n"
        "        r = mine[i];\n"
        "        if (!r || String(r.owner || r.customerPeer || \"\") !== String(who)) continue;\n"
        "        if (want === \"shop\" && (r.kind === \"shop\" || r.kind === \"vendor\" || r.place === \"shop\")) return r;\n"
        "        if (want === \"drop\" && (r.kind === \"drop\" || r.kind === \"client\")) return r;\n"
        "        if (want === \"driver\" && r.kind === \"driver\") return r;\n"
        "      }\n"
        "    } catch (e) {}\n"
        "    if (want === \"shop\") {\n"
        "      for (i = 0; i < shops.length; i++) {\n"
        "        r = shops[i];\n"
        "        if (r && String(r.owner || \"\") === String(who) && (r.src === \"listed\" || r.src === \"live\")) return r;\n"
        "      }\n"
        "    }\n"
        "    if (want === \"drop\" || want === \"driver\") {\n"
        "      for (i = 0; i < people.length; i++) {\n"
        "        r = people[i];\n"
        "        if (!r || String(r.owner || \"\") !== String(who)) continue;\n"
        "        if (want === \"drop\" && r.role === \"client\") return r;\n"
        "        if (want === \"driver\" && r.role === \"driver\") return r;\n"
        "      }\n"
        "    }\n"
        "    return null;\n"
        "  }\n\n"
    )
    s = s.replace(mark, twin_fn + mark, 1)
    print("ok findOwnRoleTwin")

if 'findOwnRoleTwin("shop")' not in s:
    s = s.replace(
        'var id = "p" + Date.now().toString(36);\n        var status = isAdmin() ? "live" : "pending";',
        'var twin = findOwnRoleTwin("shop");\n        var id = (twin && twin.id) || ("p" + Date.now().toString(36));\n        var status = isAdmin() ? "live" : "pending";',
        1,
    )
    print("ok save-place-twin")
if 'findOwnRoleTwin("drop")' not in s:
    s = s.replace(
        'var did = "d" + Date.now().toString(36);',
        'var twinDrop = findOwnRoleTwin("drop");\n        var did = (twinDrop && twinDrop.id) || ("d" + Date.now().toString(36));',
        1,
    )
    print("ok save-drop-twin")
if 'findOwnRoleTwin("driver")' not in s:
    s = s.replace(
        'id: "r" + Date.now().toString(36),\n          kind: "driver",',
        'id: (function () { var t = findOwnRoleTwin("driver"); return (t && t.id) || ("r" + Date.now().toString(36)); })(),\n          kind: "driver",',
        1,
    )
    print("ok save-driver-twin")

old_pl = (
    "    if (!signed()) return;\n"
    "    if (!row.customerPeer) row.customerPeer = me();\n"
    "    var pub = {};\n"
    "    Object.keys(row).forEach(function (k) { if (k !== \"photo\") pub[k] = row[k]; });\n"
    "    var t = authToken();\n"
    "    fetch(\"/api/space\", {\n"
    "      method: \"POST\",\n"
    "      headers: { \"Content-Type\": \"application/json\", Authorization: t ? \"Bearer \" + t : \"\" },\n"
    "      body: JSON.stringify({ row: pub })\n"
    "    }).catch(function () {});\n"
    "  }"
)
new_pl = (
    "    if (!signed()) {\n"
    "      say(\"Sign in to save.\");\n"
    "      return;\n"
    "    }\n"
    "    if (!row.customerPeer) row.customerPeer = me();\n"
    "    var pub = {};\n"
    "    Object.keys(row).forEach(function (k) { if (k !== \"photo\") pub[k] = row[k]; });\n"
    "    var t = authToken();\n"
    "    fetch(\"/api/space\", {\n"
    "      method: \"POST\",\n"
    "      headers: { \"Content-Type\": \"application/json\", Authorization: t ? \"Bearer \" + t : \"\" },\n"
    "      body: JSON.stringify({ row: pub })\n"
    "    }).then(function (res) {\n"
    "      if (res && res.status === 401) {\n"
    "        say(\"Sign in to save.\");\n"
    "        try {\n"
    "          var mine = JSON.parse(localStorage.getItem(\"sn:mine\") || \"[]\") || [];\n"
    "          mine = mine.filter(function (r) { return !r || r.id !== row.id; });\n"
    "          localStorage.setItem(\"sn:mine\", JSON.stringify(mine));\n"
    "        } catch (e) {}\n"
    "        shops = shops.filter(function (sx) { return !sx || sx.id !== row.id; });\n"
    "        people = people.filter(function (p) { return !p || p.id !== row.id; });\n"
    "        try { paintShopsOnMap(); } catch (e2) {}\n"
    "      }\n"
    "    }).catch(function () {});\n"
    "  }"
)
if old_pl in s:
    s = s.replace(old_pl, new_pl, 1)
    print("ok persistListing-401")
elif "Sign in to save." in s:
    print("skip persistListing-401")
else:
    raise SystemExit("persistListing block missing")

if "people.filter(function (p) { return !p || p.id !== drv.id; })" in s:
    s = s.replace(
        "people = people.filter(function (p) { return !p || p.id !== drv.id; });",
        "people = people.filter(function (p) { return !p || (p.id !== drv.id && !(String(p.owner || \"\") === String(me()) && p.role === \"driver\")); });",
        1,
    )
    print("ok driver-dedupe-owner")

old_to = (
    "  function throwOffer(job) {\n"
    "    var id = \"offer-\" + (job && job.id ? job.id : Date.now().toString(36));\n"
    "    try { if (sessionStorage.getItem(\"sn:offer-x:\" + id)) return; } catch (e) {}"
)
new_to = (
    "  function throwOffer(job) {\n"
    "    if (job && (job.received || job.cancelled || job.wasted || job.vendorGone)) return;\n"
    "    var id = \"offer-\" + (job && job.id ? job.id : Date.now().toString(36));\n"
    "    try { if (sessionStorage.getItem(\"sn:offer-x:\" + id)) return; } catch (e) {}"
)
if old_to in s:
    s = s.replace(old_to, new_to, 1)
    print("ok throwOffer-closed")
elif "job.received || job.cancelled || job.wasted || job.vendorGone" in s:
    print("skip throwOffer-closed")
else:
    raise SystemExit("throwOffer missing")

old_od = "  function openDriverOffer(job, drivers) {\n    var v = job.vendor || {};"
new_od = "  function openDriverOffer(job, drivers) {\n    if (!job || job.received || job.cancelled || job.wasted) return;\n    var v = job.vendor || {};"
if old_od in s:
    s = s.replace(old_od, new_od, 1)
    print("ok openDriverOffer-closed")

if "function openRouteTile(key) {" in s and "job.received || job.cancelled || job.wasted)) job = null" not in s:
    s = s.replace(
        "function openRouteTile(key) {\n    var job = jobForRoad(key);",
        "function openRouteTile(key) {\n    var job = jobForRoad(key);\n    if (job && (job.received || job.cancelled || job.wasted)) job = null;",
        1,
    )
    print("ok openRouteTile-closed")

app_path.write_text(s, encoding="utf-8")
print("wrote", app_path, "bytes", len(s))
