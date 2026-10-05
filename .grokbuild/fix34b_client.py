#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""4332b: hunt fallback; NEWS off hunt; X-in-place land; guest wallet 0."""
from pathlib import Path
import re

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

# --- showFound: category keep + strip NEWS noise from needle ---
must_replace(
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
    }""",
    """  function showFound() {
    if (!findWanted) {
      try { paintShopsOnMap(); } catch (e) {}
      return;
    }
    findWanted = false;
    var all = (shops || []).filter(function (s) { return seesShop(s); });
    var needle = String(window.__snLastHunt || "").toLowerCase().trim();
    try {
      var noise = (cardsNow() || []).filter(function (row) {
        return row && (row.k === "NEWS" || row.k === "CALENDAR" || row.k === "WARN" || row.k === "WARNING");
      }).map(function (row) { return String(row.t || ""); }).join(" ").toLowerCase();
      if (noise && needle) {
        noise.split(/[^a-z0-9\\u0370-\\u03ff]+/).filter(function (w) { return w.length > 3; }).forEach(function (w) {
          if (needle.indexOf(w) >= 0 && String(window.__snHuntRaw || "").toLowerCase().indexOf(w) < 0) {
            needle = needle.split(w).join(" ").replace(/\\s+/g, " ").trim();
          }
        });
      }
    } catch (eN) {}
    var shown = all;
    if (needle.length >= 2) {
      var matched = all.filter(function (s) {
        if (!s) return false;
        var blob = [s.name, s.kind, s.address, s.src].join(" ").toLowerCase();
        if (needle.split(/\\s+/).every(function (w) { return !w || blob.indexOf(w) >= 0; })) return true;
        if (s.name && String(s.name).toLowerCase().indexOf(needle) >= 0) return true;
        return false;
      });
      if (matched.length) shown = matched;
      else if (/supermarket|grocery|pizza|cafe|coffee|pharmacy|hotel|restaurant|food|shop|market|bar/i.test(needle)) shown = all;
    }
    shops = uniqPlaces(all);
    if (!shown.length) {
      var seatMsg = activeSeat();
      var where = (seatMsg && seatMsg.name) ? seatMsg.name : (seatMsg ? (seatMsg.lat.toFixed(2) + "," + seatMsg.lng.toFixed(2)) : "this seat");
      say("No real pin for that hunt around " + where + ". Try another name, or land a city first.");
      paintShopsOnMap();
      return;
    }""",
    "showFound-category+noise"
)

must_replace(
    """  function hunt(q) {
    q = String(q || "").trim();
    if (!q) return;
    findWanted = true;
    materialize(true);
    say("Finding " + q + "…");
    var named = /^(go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+/i.test(q)
      ? q.replace(/^(go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+/i, "")
      : q.replace(/^(find|hunt|show)\\s+/i, "").trim();
    var looksPlace = !!(named && !/pizza|pizzeria|shop|vendor|restaurant|cafe|food|near|pharmacy|hotel|market/i.test(named));
    var go = function () {
      var spaceP = Promise.resolve([]);
      var seat0 = activeSeat() || here;
      if (seat0 && isFinite(+seat0.lat)) {
        spaceP = fetchJson("/api/space?lat=" + Number(seat0.lat).toFixed(3) + "&lng=" + Number(seat0.lng).toFixed(3), { cache: "no-store" }).then(function (j) {
          return ((j && (j.shops || j.rows)) || []).map(function (r) {
            var p = asPlace(r);
            if (p) p.src = p.src || "listed";
            return p;
          }).filter(Boolean);
        }).catch(function () { return []; });
      }
      window.__snLastHunt = named || q;
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
      });
    };""",
    """  function hunt(q) {
    q = String(q || "").trim();
    if (!q) return;
    window.__snHuntRaw = q;
    findWanted = true;
    materialize(true);
    say("Finding " + q + "…");
    var named = /^(go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+/i.test(q)
      ? q.replace(/^(go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+/i, "")
      : q.replace(/^(find|hunt|show)\\s+/i, "").trim();
    var looksPlace = !!(named && !/pizza|pizzeria|shop|vendor|restaurant|cafe|food|near|pharmacy|hotel|market|supermarket|grocery/i.test(named));
    var go = function () {
      var spaceP = Promise.resolve([]);
      var seat0 = activeSeat() || here;
      if (seat0 && isFinite(+seat0.lat)) {
        spaceP = fetchJson("/api/space?lat=" + Number(seat0.lat).toFixed(3) + "&lng=" + Number(seat0.lng).toFixed(3), { cache: "no-store" }).then(function (j) {
          return ((j && (j.shops || j.rows)) || []).map(function (r) {
            var p = asPlace(r);
            if (p) p.src = p.src || "listed";
            return p;
          }).filter(Boolean);
        }).catch(function () { return []; });
      }
      window.__snLastHunt = named || q;
      Promise.all([
        spaceP.catch(function () { return []; }),
        huntRace(huntApi(named || q), 5000),
        huntRace(huntNominatim(named || q), 4000),
        huntRace(huntOverpass(named || q), 4000)
      ]).then(function (packs) {
        packs[0] = (packs[0] || []).map(function (p) { if (p) p.src = "listed"; return p; });
        shops = uniqPlaces(shops.concat(packs[0] || [], packs[1] || [], packs[2] || [], packs[3] || []));
        showFound();
      }).catch(function () {
        say("Hunt timed out. Try again, or name the city.");
        showFound();
      });
    };""",
    "hunt-overpass-fallback"
)

must_replace(
    """    if (act === "hunt" || act === "city" || act === "shop" || act === "now" || act === "pick") {
      if (j.places && j.places.length) {
        shops = uniqPlaces(j.places.map(function (p) {
          return { name: p.name, lat: Number(p.lat), lng: Number(p.lng), phone: p.phone || "", raw: p.raw || "", src: "grok" };
        }).filter(function (p) { return isFinite(p.lat) && isFinite(p.lng); }));
        if (shops.length) { openCity(shops[0]); paintShopsOnMap(); return; }
      }
      hunt(j.q || q);
      return;
    }""",
    """    if (act === "hunt" || act === "city" || act === "shop" || act === "now" || act === "pick") {
      if (j.places && j.places.length) {
        shops = uniqPlaces(j.places.map(function (p) {
          return { name: p.name, lat: Number(p.lat), lng: Number(p.lng), phone: p.phone || "", raw: p.raw || "", src: "grok" };
        }).filter(function (p) { return isFinite(p.lat) && isFinite(p.lng); }));
        if (shops.length) { openCity(shops[0]); paintShopsOnMap(); return; }
      }
      var userQ = String(q || "").replace(/^(find|hunt|show)\\s+/i, "").trim();
      hunt(userQ || String(q || "").trim());
      return;
    }""",
    "applyAct-raw-hunt"
)

must_replace(
    """  function askGrok(q, cb) {
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
  }""",
    """  function askGrok(q, cb, ms) {
    var vendors = shops.slice(0, 8).map(function (s) { return s.name; });
    var done = false;
    var timer = null;
    var msCap = (isFinite(+ms) && +ms > 0) ? +ms : 0;
    function finish(err, j) {
      if (done) return;
      done = true;
      if (timer) clearTimeout(timer);
      cb(err, j);
    }
    if (msCap) timer = setTimeout(function () { finish("slow"); }, msCap);
    var ctrl = (typeof AbortController !== "undefined") ? new AbortController() : null;
    if (ctrl && msCap) setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, msCap);
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
      }),
      signal: ctrl && ctrl.signal
    }).then(function (r) { return r.json(); }).then(function (j) {
      var text = j && (j.say || j.text);
      if (!text) { finish((j && j.error) || "quiet"); return; }
      hist.push({ role: "user", content: q });
      hist.push({ role: "assistant", content: text });
      if (hist.length > 16) hist = hist.slice(-16);
      finish(null, j);
    }).catch(function () { finish("dark"); });
  }
  function parseInPlace(q) {
    var s = String(q || "").trim();
    var m = s.match(/^(.+?)\\s+\\bin\\b\\s+(.+)$/i);
    if (!m) return null;
    var what = m[1].replace(/^(find|hunt|show|go\\s+to|take\\s+me\\s+to|fly\\s+to|open)\\s+/i, "").trim();
    var where = m[2].trim();
    if (!what || !where || what.length < 2 || where.length < 2) return null;
    if (/^(stock|total|mind|fact|case|time|english|general|love|trouble)$/i.test(where)) return null;
    return { what: what, where: where };
  }""",
    "askGrok-timeout+parseInPlace"
)

must_replace(
    """  function talk(raw, fromVoice) {
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
    """  function talk(raw, fromVoice) {
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
      }, 8000);
      return;
    }
    var inP = parseInPlace(q);
    if (inP) {
      say("Landing " + inP.where + "…");
      var ask = goToPlaceAsk("go to " + inP.where) || { place: inP.where, geo: null };
      function afterLand() { hunt(inP.what); }
      if (ask.geo) {
        seatPlace(ask.geo);
        say((ask.place || inP.where) + " on the map.");
        afterLand();
      } else {
        var seqIn = ++placeSeq;
        fetchJson("/api/find?q=" + encodeURIComponent(inP.where), { cache: "no-store" }).then(function (j) {
          if (seqIn !== placeSeq) return;
          var r = ((j && j.places) || [])[0];
          if (r && isFinite(+r.lat) && isFinite(+r.lng)) {
            seatPlace({ lat: +r.lat, lng: +r.lng, name: r.name || inP.where, raw: r.raw || "" });
            say((r.name || inP.where) + " on the map.");
            afterLand();
          } else {
            say((j && j.meta && j.meta.message) || ("No map pin for " + inP.where + "."));
            hunt(inP.what);
          }
        });
      }
      askGrok(q, function (err, j) {
        if (err || !j) return;
        var text = j.say || j.text;
        if (text) { say(text); speakIfVoice(text); }
      }, 8000);
      return;
    }
    var goAsk = goToPlaceAsk(q);
    if (goAsk && landPlaceAsk(goAsk)) return;
    var bare = goToPlaceAsk("go to " + q);
    if (bare && bare.geo && landPlaceAsk(bare)) return;
    if (/^(find|hunt|show)\\b/i.test(q) || /\\b(pizza|supermarket|grocery|pharmacy|cafe|coffee|restaurant|food)\\b/i.test(q)) {
      var hq = q.replace(/^(find|hunt|show)\\s+/i, "").trim();
      hunt(hq || q);
      askGrok(q, function (err, j) {
        if (err || !j) return;
        var text = j.say || j.text;
        if (text) say(text);
      }, 8000);
      return;
    }
    var hits = searchRoster(q);
    say("Grok…");
    askGrok(q, function (err, j) {
      if (!err && j && (j.say || j.text)) {
        var text = j.say || j.text;
        say(text);
        speakIfVoice(text);
        var act = String(j.act || "talk").toLowerCase();
        if (GREETING.test(q)) return;
        if (act === "open") openBest(searchRoster(q).length ? searchRoster(q) : hits);
        else applyAct(j, q);
        return;
      }
      if (showRoster(hits)) return;
      if (/find|hunt|show|where|pizza|shop|food|near|driver|supermarket/.test(q.toLowerCase())) { hunt(q); return; }
      say("Nothing in the shops, the drivers, or the clients around you.");
    }, 8000);
  }""",
    "talk-inplace+hunt-first"
)

must_replace(
    """    var money = $("sn-money");
    if (money && !money.__sn) {
      money.__sn = true; money.hidden = false;
      money.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (!signed()) {
          openSheet("AV€", '<p class="note">Your coins after LOGIN. Pool is owner only.</p><button type="button" class="sheet-go primary" data-act="needlogin">LOGIN</button>');
          return;
        }
        var html = '<p class="note">' + Math.round(avcGet()).toLocaleString("en-GB") + " AV€ on this account.</p>";""",
    """    var money = $("sn-money");
    if (money && !money.__sn) {
      money.__sn = true; money.hidden = false;
      money.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (!signed()) {
          openSheet("AV€", '<p class="note">0 AV€ · guest. No fake money. LOGIN to keep a balance.</p><button type="button" class="sheet-go primary" data-act="needlogin">LOGIN</button>');
          return;
        }
        var html = '<p class="note">' + Math.round(avcGet()).toLocaleString("en-GB") + " AV€ on this account.</p>";""",
    "wallet-guest-zero"
)

must_replace(
    """    if (!signed()) {
      if (tgt) tgt.textContent = "AV€";
      return;
    }""",
    """    if (!signed()) {
      if (tgt) tgt.textContent = "0 AV€";
      return;
    }""",
    "paintMoney-guest-zero"
)

# Keep VER at 4332 if already set by fix34; else set it
if 'var VER = "4332"' not in s:
    s2, n = re.subn(r'var VER = "[0-9]+"', 'var VER = "4332"', s, count=1)
    if not n:
        raise SystemExit("VER missing")
    s = s2
    print("ok VER→4332")
else:
    print("ok VER already 4332")

app_path.write_text(s, encoding="utf-8")
print("wrote", app_path, "bytes", len(s))
