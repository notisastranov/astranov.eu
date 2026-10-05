# -*- coding: utf-8 -*-
"""4328: land without Overpass; street zoom; GPS closes sky; APPLY left / X right; sheet <=42vh."""
from pathlib import Path
import re, sys

ROOT = Path(".")
app_path = ROOT / "js/spacenet/app.js"
s = app_path.read_text(encoding="utf-8")
assert 'var VER = "4327"' in s or 'var VER = "4328"' in s, "unexpected VER"

def must_replace(old, new, label, once=True):
    global s
    if old not in s:
        if "function goToPlaceAsk" in s and label == "goinject":
            print("skip", label, "(already)")
            return
        if new[:48] in s:
            print("skip", label, "(already applied)")
            return
        raise SystemExit("missing block: " + label)
    s = s.replace(old, new, 1 if once else 0)
    print("ok", label)

must_replace(
"""    if (dist <= 0.52 && aim && isFinite(aim.lat)) {
      openCity(aim);""",
"""    if (dist <= 0.78 && aim && isFinite(aim.lat)) {
      openCity(aim);""",
"zoom-thresh")

must_replace(
"""    zoomToDist(cam.dist * (dir < 0 ? 0.88 : 1.14), sx, sy);""",
"""    zoomToDist(cam.dist * (dir < 0 ? 0.72 : 1.22), sx, sy);""",
"zoom-smooth")

must_replace(
"""    { id: "city", dist: 0.72, name: "City" }""",
"""    { id: "city", dist: 0.5, name: "City" }""",
"tiers-city")

must_replace(
"""      if (!d || d.moved) return;
      vel.yaw = 0; vel.pitch = 0;
      var pUp = pos(e);
      if (!globeHit(pUp.x, pUp.y, cam)) {
        var con = pickConstellation(pUp.x, pUp.y);
        if (con) openSky(con);
      }
    }""",
"""      if (!d || d.moved) return;
      vel.yaw = 0; vel.pitch = 0;
      var pUp = pos(e);
      var hitTap = globeHit(pUp.x, pUp.y, cam);
      if (hitTap && isFinite(hitTap.lat)) {
        var nowT = Date.now();
        if (window.__snGlobeTap && nowT - window.__snGlobeTap < 340) {
          window.__snGlobeTap = 0;
          aim = { lat: hitTap.lat, lng: hitTap.lng };
          try { closeSky(); } catch (e) {}
          openCity(aim);
          say("Street");
          return;
        }
        window.__snGlobeTap = nowT;
      } else if (!hitTap) {
        var con = pickConstellation(pUp.x, pUp.y);
        if (con) openSky(con);
      }
    }""",
"dbltap-street")

must_replace(
"""  function land(pt, open) {
    seated = true;
    intro = false;""",
"""  function land(pt, open) {
    try { closeSky(); } catch (e) {}
    seated = true;
    intro = false;""",
"land-closeskys")

must_replace(
"""      adminPin = false;
      locate(function (pt) { land(pt, false); });""",
"""      adminPin = false;
      try { closeSky(); } catch (e) {}
      locate(function (pt) { land(pt, false); });""",
"gps-closeskys")

must_replace(
"""  function hunt(q) {
    q = String(q || "").trim();
    if (!q) return;
    materialize(true);
    say("Finding " + q + "…");
    var go = function () {
      Promise.all([huntApi(q), huntNominatim(q), huntOverpass(q)]).then(function (packs) {
        var listed = shops.filter(function (s) { return s && s.src === "listed"; });
        shops = uniqPlaces(listed.concat(packs[0], packs[1], packs[2]));
        showFound();
      });
    };
    if (!here) locate(function (pt) { land(pt, false); go(); });
    else go();
  }""",
"""  function huntRace(p, ms) {
    return Promise.race([
      p.catch(function () { return []; }),
      new Promise(function (resolve) { setTimeout(function () { resolve([]); }, ms); })
    ]);
  }
  function hunt(q) {
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
"hunt-timeout")

go_block = """
  var placeSeq = 0;
  var lastSeat = null;
  var GR_CITY = {
    athens: { label: "Athens, Greece", lat: 37.9838, lng: 23.7275 },
    athina: { label: "Athens, Greece", lat: 37.9838, lng: 23.7275 },
    rhodes: { label: "Rhodes, Greece", lat: 36.4349, lng: 28.2176 },
    rodos: { label: "Rhodes, Greece", lat: 36.4349, lng: 28.2176 },
    "orland park": { label: "Orland Park, Illinois", lat: 41.6303, lng: -87.8539 },
    orlandpark: { label: "Orland Park, Illinois", lat: 41.6303, lng: -87.8539 },
    wheaton: { label: "Wheaton, Illinois", lat: 41.8661, lng: -88.1070 }
  };
  function normPlaceKey(t) {
    var s = String(t || "").toLowerCase();
    try { s = s.normalize("NFD").replace(/[\\u0300-\\u036f]/g, ""); } catch (e) {}
    return s.replace(/[^a-z0-9]+/g, " ").replace(/\\s+/g, " ").trim();
  }
  function goToPlaceAsk(q) {
    var s = String(q || "").trim();
    var m = s.match(/^(?:go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+(.+)$/i);
    var dest = m ? m[1].trim() : s;
    var co = dest.match(/(-?\\d{1,3}(?:\\.\\d+)?)\\s*[,;\\s]\\s*(-?\\d{1,3}(?:\\.\\d+)?)/);
    var placeBit = dest.replace(/(-?\\d{1,3}(?:\\.\\d+)?)\\s*[,;\\s]\\s*(-?\\d{1,3}(?:\\.\\d+)?)/, " ").replace(/\\s+/g, " ").trim();
    if (co) {
      var lat = +co[1], lng = +co[2];
      if (!isFinite(lat) || !isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
      var nm = placeBit || (lat.toFixed(3) + "," + lng.toFixed(3));
      var key = normPlaceKey((placeBit || "").split(/\\s+/)[0] || "");
      var g = GR_CITY[key] || GR_CITY[normPlaceKey(placeBit)];
      if (g && haversineKm({ lat: lat, lng: lng }, g) < 80) return { place: g.label, geo: { lat: g.lat, lng: g.lng, name: g.label } };
      return { place: nm, geo: { lat: lat, lng: lng, name: nm } };
    }
    if (!m && !GR_CITY[normPlaceKey(dest)] && !GR_CITY[normPlaceKey(dest.replace(/\\s+/g, ""))]) return null;
    var g2 = GR_CITY[normPlaceKey(dest)] || GR_CITY[normPlaceKey(dest.replace(/\\s+/g, ""))] || GR_CITY[normPlaceKey(dest.split(/\\s+/)[0])];
    if (g2) return { place: g2.label, geo: { lat: g2.lat, lng: g2.lng, name: g2.label } };
    if (m && placeBit) return { place: placeBit, geo: null };
    return null;
  }
  function seatPlace(geo) {
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
  }
  function landPlaceAsk(ask) {
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
  }

"""

if "function goToPlaceAsk" not in s:
    must_replace("  function runLine(q) {", go_block + "  function runLine(q) {", "goinject")
else:
    print("skip goinject (already)")

must_replace(
"""  function talk(raw, fromVoice) {
    var q = String(raw || "").trim();
    if (!q) return;
    lastVoice = !!fromVoice;
    if (supportOn) { sendSupport(q, fromVoice); return; }
    if (runLine(q)) return;
    var hits = searchRoster(q);
    say("Grok…");""",
"""  function talk(raw, fromVoice) {
    var q = String(raw || "").trim();
    if (!q) return;
    lastVoice = !!fromVoice;
    if (supportOn) { sendSupport(q, fromVoice); return; }
    if (runLine(q)) return;
    var goAsk = goToPlaceAsk(q);
    if (goAsk && landPlaceAsk(goAsk)) return;
    var bare = goToPlaceAsk("go to " + q);
    if (bare && bare.geo && landPlaceAsk(bare)) return;
    var hits = searchRoster(q);
    say("Grok…");""",
"talk-land")

old_bar = """card.innerHTML = '<div class="sheet-bar"><button type="button" class="sheet-x" data-act="sheet-x" aria-label="Close">✕</button><div class="sheet-mid"></div><button type="button" class="sheet-apply" data-act="sheet-apply" aria-label="Apply">✓</button></div><div id="sn-sheet-body"></div>';"""
new_bar = """card.innerHTML = '<div class="sheet-bar"><button type="button" class="sheet-apply" data-act="sheet-apply" aria-label="Apply">✓</button><div class="sheet-mid"></div><button type="button" class="sheet-x" data-act="sheet-x" aria-label="Close">✕</button></div><div id="sn-sheet-body"></div>';"""
if old_bar in s:
    s = s.replace(old_bar, new_bar)
    print("ok sheet-bar-swap")
elif new_bar in s:
    print("skip sheet-bar")
else:
    raise SystemExit("sheet bar missing")

s = s.replace("max-height:46vh!important", "max-height:42vh!important")
s = s.replace("max-height:44vh!important", "max-height:42vh!important")
print("ok sheet-height-42vh")


# --- wheel: aim under cursor on zoom-in; don't dump street→solar ---
must_replace(
"""  function zoomSmooth(dir, sx, sy) {
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
    zoomToDist(cam.dist * (dir < 0 ? 0.72 : 1.22), sx, sy);
  }""",
"""  var wheelAt = 0;
  function aimAt(sx, sy) {
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
"wheel-aim")

# Clamp solar dump: from field/street max ~global; allow solar only if already deep space
must_replace(
"""    dist = Math.max(0.5, Math.min(6.4, dist));
    if (!aim && here && isFinite(here.lat)) aim = { lat: here.lat, lng: here.lng };
    if (cityOn) return;
    if (dist <= 0.78 && aim && isFinite(aim.lat)) {""",
"""    var maxD = cam.dist > 2.5 ? 6.4 : 2.15;
    dist = Math.max(0.5, Math.min(maxD, dist));
    if (!aim && here && isFinite(here.lat)) aim = { lat: here.lat, lng: here.lng };
    if (cityOn) return;
    if (dist <= 0.78 && aim && isFinite(aim.lat)) {""",
"zoom-clamp")

# Pinch zoom should also aim between fingers — in pointermove pinch path
must_replace(
"""        intro = false;
        var nd = cam.dist / Math.max(0.92, Math.min(1.08, grew));
        zoomToDist(nd);
        return;""",
"""        intro = false;
        var midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
        if (grew > 1) aimAt(midX, midY);
        var nd = cam.dist / Math.max(0.92, Math.min(1.08, grew));
        zoomToDist(nd);
        return;""",
"pinch-aim")

# --- hello/greetings → Grok only, never roster/hunt ---
must_replace(
"""  function talk(raw, fromVoice) {
    var q = String(raw || "").trim();
    if (!q) return;
    lastVoice = !!fromVoice;
    if (supportOn) { sendSupport(q, fromVoice); return; }
    if (runLine(q)) return;
    var goAsk = goToPlaceAsk(q);
    if (goAsk && landPlaceAsk(goAsk)) return;
    var bare = goToPlaceAsk("go to " + q);
    if (bare && bare.geo && landPlaceAsk(bare)) return;
    var hits = searchRoster(q);
    say("Grok…");
    askGrok(q, function (err, j) {
      if (!err && j && (j.say || j.text)) {
        var text = j.say || j.text;
        say(text);
        speakIfVoice(text);
        var act = String(j.act || "talk").toLowerCase();
        if (act === "open") openBest(searchRoster(j.q || q).length ? searchRoster(j.q || q) : hits);
        else applyAct(j, q);
        return;
      }
      if (showRoster(hits)) return;
      if (/find|hunt|show|where|pizza|shop|food|near|driver/.test(q.toLowerCase())) { hunt(q); return; }
      say("Nothing in the shops, the drivers, or the clients around you.");
    });
  }""",
"""  var GREETING = /^\\s*(hello|hi|hey|hiya|yo|sup|howdy|good\\s+(morning|afternoon|evening|night)|thanks|thank\\s+you|thx|ok|okay|bye|γεια(\\s+σου|\\s+σας)?|γειά(\\s+σου|\\s+σας)?|καλημέρα|καλησπέρα|καληνύχτα|ευχαριστώ)\\s*[!.?]*\\s*$/i;
  function talk(raw, fromVoice) {
    var q = String(raw || "").trim();
    if (!q) return;
    lastVoice = !!fromVoice;
    if (supportOn) { sendSupport(q, fromVoice); return; }
    if (runLine(q)) return;
    if (GREETING.test(q)) {
      say("Grok…");
      askGrok(q, function (err, j) {
        var text = (!err && j && (j.say || j.text)) ? (j.say || j.text) : "Hello. Talk a place, a shop, or hold the map to list.";
        say(text);
        speakIfVoice(text);
      });
      return;
    }
    var goAsk = goToPlaceAsk(q);
    if (goAsk && landPlaceAsk(goAsk)) return;
    var bare = goToPlaceAsk("go to " + q);
    if (bare && bare.geo && landPlaceAsk(bare)) return;
    var hits = searchRoster(q);
    say("Grok…");
    askGrok(q, function (err, j) {
      if (!err && j && (j.say || j.text)) {
        var text = j.say || j.text;
        say(text);
        speakIfVoice(text);
        var act = String(j.act || "talk").toLowerCase();
        if (GREETING.test(q)) return;
        if (act === "open") openBest(searchRoster(j.q || q).length ? searchRoster(j.q || q) : hits);
        else applyAct(j, q);
        return;
      }
      if (showRoster(hits)) return;
      if (/find|hunt|show|where|pizza|shop|food|near|driver/.test(q.toLowerCase())) { hunt(q); return; }
      say("Nothing in the shops, the drivers, or the clients around you.");
    });
  }""",
"greeting-grok")


if 'var VER = "4327"' in s:
    s = s.replace('var VER = "4327"', 'var VER = "4328"', 1)
    print("ok VER 4328")
elif 'var VER = "4328"' in s:
    print("skip VER")
else:
    raise SystemExit("VER missing")

if "goToPlaceAsk: goToPlaceAsk" not in s and "openCity: openCity" in s:
    s = s.replace("openCity: openCity,", "openCity: openCity, goToPlaceAsk: goToPlaceAsk, seatPlace: seatPlace,", 1)
    print("ok SN export")

app_path.write_text(s, encoding="utf-8")
print("wrote", app_path, "bytes", len(s))
