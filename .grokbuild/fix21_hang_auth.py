#!/usr/bin/env python3
"""4324 remine carries: Talk/FIND hard timeouts, honest-empty, auth PKCE fallback."""
import re

def must(c, m):
    if not c: raise SystemExit("FAIL: " + m)

A = "js/spacenet/app.js"
s = open(A, encoding="utf-8").read()

# ---- lastSeat on seatPlace ----
if "var lastSeat" not in s:
    s = s.replace("var placeMark = null;", "var placeMark = null;\n  var lastSeat = null;", 1)
    must("var lastSeat" in s, "lastSeat decl")
old_seat = """  function seatPlace(geo) {
    intro = false;
    aim = { lat: geo.lat, lng: geo.lng };"""
new_seat = """  function seatPlace(geo) {
    intro = false;
    lastSeat = geo && isFinite(+geo.lat) && isFinite(+geo.lng)
      ? { lat: +geo.lat, lng: +geo.lng, name: geo.name || geo.label || "place" }
      : lastSeat;
    aim = { lat: geo.lat, lng: geo.lng };"""
if "lastSeat = geo" not in s:
    must(old_seat in s, "seatPlace head")
    s = s.replace(old_seat, new_seat, 1)
    print("ok lastSeat")
else:
    print("lastSeat already")

# ---- askGrok hard timeout (12s) ----
old_ag = """  function askGrok(q, cb) {
    var vendors = shops.slice(0, 8).map(function (s) { return s.name; });
    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: q,
        history: hist,
        world: worldText(),
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
      var text = j && (j.say || j.text);
      if (!text) { cb((j && j.error) || "quiet"); return; }
      hist.push({ role: "user", content: q });
      hist.push({ role: "assistant", content: text });
      if (hist.length > 16) hist = hist.slice(-16);
      cb(null, j);
    }).catch(function () { cb("dark"); });
  }"""
new_ag = """  function askGrok(q, cb) {
    var vendors = shops.slice(0, 8).map(function (s) { return s.name; });
    var done = false;
    function once(err, j) { if (done) return; done = true; cb(err, j); }
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var kill = setTimeout(function () { try { if (ctl) ctl.abort(); } catch (e) {} once("timeout"); }, 12000);
    fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: ctl ? ctl.signal : undefined,
      body: JSON.stringify({
        message: q,
        history: hist,
        world: worldText(),
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
      clearTimeout(kill);
      var text = j && (j.say || j.text);
      if (!text) { once((j && j.error) || "quiet"); return; }
      hist.push({ role: "user", content: q });
      hist.push({ role: "assistant", content: text });
      if (hist.length > 16) hist = hist.slice(-16);
      once(null, j);
    }).catch(function () { clearTimeout(kill); once("dark"); });
  }"""
if "once(\"timeout\")" not in s:
    must(old_ag in s, "askGrok block")
    s = s.replace(old_ag, new_ag, 1)
    print("ok askGrok timeout")
else:
    print("askGrok timeout already")

# ---- locate always settles ----
old_loc_end = """    if (!navigator.geolocation) { coarse(); return; }
    if (!quiet) say("Locating…");
    var watchId = 0;
    try {
      watchId = navigator.geolocation.watchPosition(gps, function () {}, { enableHighAccuracy: false, maximumAge: 300000, timeout: 20000 });
    } catch (e) {}
    navigator.geolocation.getCurrentPosition(gps, function () {
      navigator.geolocation.getCurrentPosition(gps, function (err) {
        if (gotGps) return;
        if (!quiet && err && err.code === 1) say("Location is blocked. Allow it for this site, then tap GPS.");
        coarse();
      }, { enableHighAccuracy: false, timeout: 20000, maximumAge: 300000 });
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 });
    setTimeout(function () { if (!gotGps) coarse(); }, 14000);
  }"""

# Replace locate function more carefully - inject settled wrapper at start
if "function locate(then, quiet)" in s and "locateSettled" not in s:
    s = s.replace(
        "function locate(then, quiet) {\n    var gotGps = false, coarseRan = false;\n    function gps(pos) {",
        "function locate(then, quiet) {\n    var gotGps = false, coarseRan = false, locateSettled = false;\n"
        "    function finish(pt) {\n"
        "      if (locateSettled) return;\n"
        "      locateSettled = true;\n"
        "      try { if (typeof then === \"function\") then(pt || null); } catch (e) {}\n"
        "    }\n"
        "    function gps(pos) {",
        1,
    )
    # gps success → finish
    s = s.replace(
        "then({ lat: pos.coords.latitude, lng: pos.coords.longitude, how: \"gps\" });",
        "finish({ lat: pos.coords.latitude, lng: pos.coords.longitude, how: \"gps\" });",
        1,
    )
    s = s.replace(
        "then({ lat: +saved.lat, lng: +saved.lng, how: \"saved\" });",
        "finish({ lat: +saved.lat, lng: +saved.lng, how: \"saved\" });",
        1,
    )
    s = s.replace(
        "then({ lat: lat, lng: lng, how: \"net\", name: (j && j.city) || \"\" });",
        "finish({ lat: lat, lng: lng, how: \"net\", name: (j && j.city) || \"\" });",
        1,
    )
    # coarse fail paths must finish
    s = s.replace(
        """        if (!isFinite(lat) || !isFinite(lng)) {
          if (!quiet) say("GPS did not answer. Allow location, then tap GPS.");
          return;
        }""",
        """        if (!isFinite(lat) || !isFinite(lng)) {
          if (!quiet) say("GPS did not answer. Allow location, then tap GPS.");
          finish(null);
          return;
        }""",
        1,
    )
    s = s.replace(
        """      }).catch(function () {
        if (!gotGps && !quiet) say("GPS did not answer. Allow location, then tap GPS.");
      });""",
        """      }).catch(function () {
        if (!gotGps && !quiet) say("GPS did not answer. Allow location, then tap GPS.");
        finish(null);
      });""",
        1,
    )
    # hard absolute deadline
    s = s.replace(
        "setTimeout(function () { if (!gotGps) coarse(); }, 14000);\n  }",
        "setTimeout(function () { if (!gotGps) coarse(); }, 8000);\n"
        "    setTimeout(function () { if (!locateSettled) { if (!quiet) say(\"Location timed out. Tap GPS, or name a city.\"); finish(null); } }, 16000);\n  }",
        1,
    )
    print("ok locate settle")
else:
    print("locate settle skip/already")

# ---- hunt: hard deadline + null here handling + honest empty ----
old_hunt = """  function hunt(q, nearYou) {
    q = String(q || "").trim();
    if (!q) return;
    if (datingAsk(q)) { honestDating(); return; }
    if (bareNear(q)) { nearYouBare(); return; }
    var nearItem = nearYouItem(q);
    if (nearItem) { q = nearItem; nearYou = true; }
    var named = nearYou ? null : namedPlaceAsk(q, "");
    if (named) { named.raw = q; huntPlace(named); return; }
    lastCat = cleanItem(q) || q;
    closeFind();
    materialize(true);
    say("Finding " + q + (nearYou ? " near YOU" : "") + "…");
    var hs = ++huntSeq, ps = placeSeq;
    var go = function () {
      Promise.all([huntApi(q), huntNominatim(q), huntOverpass(q)]).then(function (packs) {
        if (hs !== huntSeq || ps !== placeSeq) return;
        var listed = shops.filter(function (s) { return s && s.src === "listed" && nearOf(here, 80)(s); });
        var next = uniqPlaces(listed.concat(packs[0], packs[1], packs[2]));
        if (nearYou && !next.length && here) {
          shops = shops.filter(nearOf(here, 80));
          aim = { lat: here.lat, lng: here.lng };
          openCity(aim);
          try { if (map) map.setView([here.lat, here.lng], 15); } catch (e) {}
          paintShopsOnMap();
          say("No real " + q + " pin near YOU (" + hereLabel() + ") yet. Try another name, or name a place.");
          return;
        }
        if (!next.length && shops.length) { paintShopsOnMap(); say("No real pin for " + q + ". Nothing new is shown; the " + shops.length + " already on the map stay."); return; }
        shops = next;
        showFound();
        if (nearYou && here) say(q.charAt(0).toUpperCase() + q.slice(1) + " near YOU (" + hereLabel() + "): " + foundView.length + " real pin" + (foundView.length === 1 ? "" : "s") + ". Tap one to order.");
      });
    };
    if (!here) locate(function (pt) { land(pt, false, true); go(); });
    else go();
  }"""

new_hunt = """  function hunt(q, nearYou) {
    q = String(q || "").trim();
    if (!q) return;
    if (datingAsk(q)) { honestDating(); return; }
    if (bareNear(q)) { nearYouBare(); return; }
    var nearItem = nearYouItem(q);
    if (nearItem) { q = nearItem; nearYou = true; }
    var named = nearYou ? null : namedPlaceAsk(q, "");
    if (named) { named.raw = q; huntPlace(named); return; }
    lastCat = cleanItem(q) || q;
    closeFind();
    materialize(true);
    say("Finding " + q + (nearYou ? " near YOU" : "") + "…");
    var hs = ++huntSeq, ps = placeSeq, huntDone = false;
    function huntFinish(msg) {
      if (huntDone || hs !== huntSeq) return;
      huntDone = true;
      if (msg) say(msg);
    }
    var hard = setTimeout(function () {
      huntFinish("Search timed out" + (nearYou ? " near YOU" : "") + ". " + (here ? hereLabel() + ". " : "No location yet. ") + "Tap GPS, name a city, or try again.");
    }, 18000);
    var go = function () {
      if (!here) {
        clearTimeout(hard);
        huntFinish(nearYou
          ? "Near YOU needs a location. Allow GPS, tap GPS, or name a city like Athens Greece."
          : "No location yet. Tap GPS, or name a city like Athens Greece.");
        return;
      }
      if (nearYou) {
        aim = { lat: here.lat, lng: here.lng };
        openCity(aim);
        try { if (map) map.setView([here.lat, here.lng], 15); } catch (e) {}
      }
      Promise.all([huntApi(q), huntNominatim(q), huntOverpass(q)]).then(function (packs) {
        clearTimeout(hard);
        if (hs !== huntSeq || ps !== placeSeq || huntDone) return;
        huntDone = true;
        var listed = shops.filter(function (s) { return s && s.src === "listed" && nearOf(here, 80)(s); });
        var next = uniqPlaces(listed.concat(packs[0], packs[1], packs[2]));
        if (!next.length) {
          if (nearYou) {
            shops = shops.filter(nearOf(here, 80));
            aim = { lat: here.lat, lng: here.lng };
            openCity(aim);
            try { if (map) map.setView([here.lat, here.lng], 15); } catch (e) {}
          }
          paintShopsOnMap();
          say("No real " + q + " pin" + (nearYou ? " near YOU (" + hereLabel() + ")" : "") + " yet. Try another name, or name a place.");
          return;
        }
        shops = next;
        showFound();
        if (nearYou && here) say(q.charAt(0).toUpperCase() + q.slice(1) + " near YOU (" + hereLabel() + "): " + foundView.length + " real pin" + (foundView.length === 1 ? "" : "s") + ". Tap one to order.");
      }).catch(function () {
        clearTimeout(hard);
        huntFinish("Search failed for " + q + ". Try again, or name a city.");
      });
    };
    if (!here) {
      locate(function (pt) {
        if (hs !== huntSeq) return;
        if (!pt || !isFinite(+pt.lat) || !isFinite(+pt.lng)) {
          clearTimeout(hard);
          huntFinish(nearYou
            ? "Near YOU needs GPS or an approx IP location. Allow location, tap GPS, or name a city."
            : "No location yet. Tap GPS, or name a city like Athens Greece.");
          return;
        }
        land(pt, false, true, true);
        if (pt.how === "net" || pt.how === "saved") {
          say((pt.how === "net" ? "Approx. IP location" : "Saved location") + " · hunting " + q + "…");
        }
        go();
      }, true);
    } else go();
  }"""

if "huntDone" not in s:
    must(old_hunt in s, "hunt block")
    s = s.replace(old_hunt, new_hunt, 1)
    print("ok hunt deadline")
else:
    print("hunt deadline already")

# ---- huntPlace hard timeout ----
if "placeHard" not in s and "function huntPlace(ask)" in s:
    s = s.replace(
        """    say("Finding " + item + " in " + place + "…");
      var job = placeShops(item, place, geo), shown = 0;""",
        """    say("Finding " + item + " in " + place + "…");
      var job = placeShops(item, place, geo), shown = 0;
      var placeHard = setTimeout(function () {
        if (seq !== placeSeq || shown) return;
        say("No real " + item + " pin in " + place + " yet (timed out). Try another name, or tap FIND.");
      }, 18000);""",
        1,
    )
    s = s.replace(
        """      return Promise.all([job.all, pull]).then(function (packs) {
        put(packs[0]);
        if (seq !== placeSeq) return;
        if (shown) { if (packs[1].length) { shown = 0; put(packs[0]); } return; }""",
        """      return Promise.all([job.all, pull]).then(function (packs) {
        clearTimeout(placeHard);
        put(packs[0]);
        if (seq !== placeSeq) return;
        if (shown) { if (packs[1].length) { shown = 0; put(packs[0]); } return; }""",
        1,
    )
    print("ok huntPlace deadline")
else:
    print("huntPlace deadline skip")

# ---- talk: bare category after lastSeat → huntPlace (not Grok hang) ----
old_talk_tail = """    var bs = ++bareSeq, bare = barePlaceWord(q);
    if (bare) {
      say("Finding " + bare + "…");
      placeGeo(bare).then(function (geo) {
        if (bs !== bareSeq) return;
        if (geo) { huntPlace({ item: "", place: geo.name, geo: geo, raw: q }); return; }
        grokTalk(q);
      }, function () { if (bs === bareSeq) grokTalk(q); });
      return;
    }
    grokTalk(q);
  }"""
new_talk_tail = """    var seatedCat = cleanItem(q);
    if (seatedCat && lastSeat && isFinite(+lastSeat.lat) && NOT_PLACE[normName(seatedCat)] && !namedPlaceAsk(q, "")) {
      huntPlace({ item: seatedCat, place: lastSeat.name || "here", geo: lastSeat, raw: q });
      return;
    }
    var bs = ++bareSeq, bare = barePlaceWord(q);
    if (bare) {
      say("Finding " + bare + "…");
      var bareHard = setTimeout(function () {
        if (bs !== bareSeq) return;
        say("No map pin for " + bare + " yet. Try the city and country, like Athens Greece.");
      }, 15000);
      placeGeo(bare).then(function (geo) {
        clearTimeout(bareHard);
        if (bs !== bareSeq) return;
        if (geo) { huntPlace({ item: "", place: geo.name, geo: geo, raw: q }); return; }
        grokTalk(q);
      }, function () { clearTimeout(bareHard); if (bs === bareSeq) grokTalk(q); });
      return;
    }
    grokTalk(q);
  }"""
if "seatedCat" not in s:
    must(old_talk_tail in s, "talk bare tail")
    s = s.replace(old_talk_tail, new_talk_tail, 1)
    print("ok seated category hunt")
else:
    print("seated category already")

# ---- openFind honest empty ----
old_of = """  function openFind() {
    materialize(true);
    var inp = $("in");
    if (inp) { inp.focus(); say("Name a place or a shop. Ordinary language."); }
  }"""
new_of = """  function openFind() {
    materialize(true);
    var inp = $("in");
    if (inp) inp.focus();
    var visible = (shops || []).filter(function (s) { return s && seesShop(s); });
    if (!visible.length) {
      say("FIND is empty here: no real pins on the map yet. Name a place (Athens Greece) or a shop, or tap GPS for near YOU.");
      return;
    }
    showFound(null, visible);
  }"""
if "FIND is empty here" not in s:
    must(old_of in s, "openFind")
    s = s.replace(old_of, new_of, 1)
    print("ok openFind empty")
else:
    print("openFind already")

# ---- nearYouBare: settle locate null ----
old_nyb = """    if (!here) locate(function (pt) { land(pt, false, true); go(); }); else go();
  }
  function honestDating() {"""
new_nyb = """    if (!here) {
      locate(function (pt) {
        if (seq !== placeSeq) return;
        if (!pt || !isFinite(+pt.lat)) {
          say("Near YOU needs GPS or an approx IP location. Allow location, tap GPS, or name a city.");
          return;
        }
        land(pt, false, true, true);
        go();
      }, true);
    } else go();
  }
  function honestDating() {"""
if "Near YOU needs GPS or an approx IP location" not in s.split("function honestDating")[0]:
    if old_nyb in s:
        s = s.replace(old_nyb, new_nyb, 1)
        print("ok nearYouBare locate")
    else:
        print("WARN nearYouBare")
else:
    print("nearYouBare already")

open(A, "w", encoding="utf-8").write(s)
print("ok app hang fixes")

# ---- auth.js: keep location.origin; fix !pkce fallback (authorization_code unsupported here) ----
B = "js/spacenet/auth.js"
a = open(B, encoding="utf-8").read()
must("location.origin" in a, "auth already uses location.origin")
must("astranov.eu" not in a.lower() or "astranov.eu" not in re.findall(r'https?://[^\"\']+', a.lower()), "no hardcoded host in auth URLs")

old_ex = """    if (code) {
      var ver = read("sn:pkce", "");
      var body = ver
        ? { grant_type: "pkce", auth_code: code, code_verifier: ver }
        : { grant_type: "authorization_code", code: code, redirect_uri: location.origin + "/?auth=google" };
      return fetch(SB + "/auth/v1/token?grant_type=" + encodeURIComponent(body.grant_type), {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          write("sn:pkce", "");
          if (j && j.access_token) return takeUser(j.access_token);
          talk((j && (j.error_description || j.msg || j.error)) || "Google code was not exchanged.");
          return false;
        })
        .then(function (ok) { clean(); return ok; })
        .catch(function () { clean(); talk("Google sign-in did not finish."); return false; });
    }"""

new_ex = """    if (code) {
      var ver = read("sn:pkce", "");
      // This project's GoTrue accepts grant_type=pkce (with auth_code + code_verifier).
      // grant_type=authorization_code returns 400 unsupported_grant_type (seen in auth logs).
      if (!ver) {
        talk("Sign-in code arrived without the local key. Start LOGIN again on this same site (preview stays on the preview URL).");
        clean();
        return Promise.resolve(false);
      }
      var body = { grant_type: "pkce", auth_code: code, code_verifier: ver };
      return fetch(SB + "/auth/v1/token?grant_type=" + encodeURIComponent(body.grant_type), {
        method: "POST",
        headers: { apikey: ANON, "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          write("sn:pkce", "");
          if (j && j.access_token) return takeUser(j.access_token);
          talk((j && (j.error_description || j.msg || j.error)) || "Google code was not exchanged.");
          return false;
        })
        .then(function (ok) { clean(); return ok; })
        .catch(function () { clean(); talk("Google sign-in did not finish."); return false; });
    }"""

if "without the local key" not in a:
    must(old_ex in a, "auth exchange block")
    a = a.replace(old_ex, new_ex, 1)
    print("ok auth pkce-only exchange")
else:
    print("auth exchange already")

# Ensure google()/x() use location.origin (already true) — add comment via no-op check
if "var dest = location.origin + \"/?auth=google\"" not in a:
    raise SystemExit("FAIL: google redirect not location.origin")
print("ok auth redirect_to = location.origin")

open(B, "w", encoding="utf-8").write(a)
print("fix21 done")
