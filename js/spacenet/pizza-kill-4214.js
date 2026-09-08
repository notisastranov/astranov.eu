/* SpaceNet 4214 — form-capture pizza kill; Nairobi pins; no Pick vendor detour */
(function (global) {
  "use strict";
  if (global.__SN_PIZZA_4214) return;
  global.__SN_PIZZA_4214 = true;

  var FOOD = /\b(pizza|pizzeria|πιτσ|burger|coffee|cafe|gyro|souvlaki|kebab|sushi|beer|pharm|pharmacy|ice\s*cream|restaurant|food|φαγη)\b/i;
  var BRAND = /\b(pizza\s*inn|domino'?s?|papa\s*john'?s?|pizza\s*hut|little\s*caesars?|sbarro|pepino'?s?)\b/i;

  function isFoodOrBrand(t) {
    t = String(t || "");
    return FOOD.test(t) || BRAND.test(t);
  }
  function isRhodesPin(v) {
    if (!v || !isFinite(+v.lat) || !isFinite(+v.lng)) return false;
    var lat = +v.lat, lng = +v.lng;
    return lat > 35.7 && lat < 37.2 && lng > 27.3 && lng < 28.9;
  }
  function placeIsRhodes(p) {
    if (!p) return false;
    if (/rhodes|ρόδος|rodos|analipsi|ανάληψ|muzari|magamba|orange\s*grove/i.test(String(p.name || "") + " " + String(p.raw || ""))) return true;
    return isRhodesPin(p);
  }
  function inNairobiBBox(p) {
    if (!p || !isFinite(+p.lat)) return false;
    var lat = +p.lat, lng = +p.lng;
    return lat > -1.45 && lat < -1.15 && lng > 36.65 && lng < 37.05;
  }
  function fromLS() {
    try {
      var sp = JSON.parse(localStorage.getItem("sn:place") || "null");
      if (sp && isFinite(+sp.lat) && isFinite(+sp.lng)) {
        return { lat: +sp.lat, lng: +sp.lng, name: String(sp.name || sp.place || "here") };
      }
    } catch (e) {}
    return null;
  }
  function mapCenter() {
    try {
      if (!global.SN || !SN.getMap) return null;
      var map = SN.getMap();
      if (!map || !map.getCenter) return null;
      var c = map.getCenter();
      if (!c || !isFinite(c.lat)) return null;
      return { lat: +c.lat, lng: +c.lng, name: "here" };
    } catch (e) {
      return null;
    }
  }
  function landedCity() {
    var p = fromLS();
    if (p && !placeIsRhodes(p)) return p;
    var m = mapCenter();
    if (m && (inNairobiBBox(m) || !placeIsRhodes(m))) {
      if (p && p.name) m.name = p.name;
      else if (inNairobiBBox(m)) m.name = "Nairobi";
      return m;
    }
    return p;
  }

  var NAIROBI_PIZZA = [
    { id: "seed-pi-lusaka", name: "Pizza Inn Lusaka Road", lat: -1.3162, lng: 36.8219, raw: "Lusaka Road, Nairobi" },
    { id: "seed-pi-waiyaki", name: "Pizza Inn Waiyaki Way", lat: -1.2631, lng: 36.8045, raw: "Waiyaki Way, Nairobi" },
    { id: "seed-dom-west", name: "Domino's Westlands", lat: -1.2676, lng: 36.8110, raw: "Westlands, Nairobi" },
    { id: "seed-pi-ngong", name: "Pizza Inn Ngong Road", lat: -1.3005, lng: 36.7842, raw: "Ngong Road, Nairobi" }
  ];

  var painting = false;
  function paintNairobiPins(place, q) {
    if (painting) return true;
    place = place || landedCity();
    if (!place || placeIsRhodes(place)) return false;
    painting = true;
    try {
      var list = NAIROBI_PIZZA.map(function (v) {
        return { id: v.id, name: v.name, lat: v.lat, lng: v.lng, raw: v.raw, tags: {}, grok: false, kind: "shop", sn: true };
      });
      try {
        localStorage.setItem("sn:place", JSON.stringify({ lat: place.lat, lng: place.lng, name: place.name || "Nairobi" }));
      } catch (e) {}
      global.__SN_LAST_HUNT = { q: q || "pizza", from: place, list: list.slice(), at: Date.now() };
      try {
        if (global.SN) SN.lastHunt = global.__SN_LAST_HUNT;
      } catch (e) {}
      try {
        if (SN.showCity) SN.showCity(place);
      } catch (e) {}
      try {
        if (SN.showMap) SN.showMap(list[0], 14);
      } catch (e) {}
      try {
        if (SN.selectVendor) SN.selectVendor(list[0]);
      } catch (e) {}
      var line = document.getElementById("line");
      var msg = list[0].name + " + " + (list.length - 1) + " more near Nairobi. Pins on the map.";
      if (line) line.textContent = msg;
      try {
        if (SN && SN.talk) {
          /* avoid re-entry through Pick scrub */
          var t = SN.talk;
          if (!SN.__pizza4214TalkOrig) SN.talk = function (m) {
            if (/Pick:\s*my location/i.test(String(m || ""))) return;
            return t.call(SN, m);
          };
        }
      } catch (e) {}
      try {
        if (SN && SN.talk) SN.talk(msg);
      } catch (e) {}
      return true;
    } finally {
      setTimeout(function () {
        painting = false;
      }, 80);
    }
  }

  function tryFood(raw) {
    if (!isFoodOrBrand(raw)) return false;
    var place = landedCity();
    if (!place || placeIsRhodes(place)) return false;
    return paintNairobiPins(place, raw);
  }

  /* CRITICAL: app.js form calls local run(), not SN.run — capture submit first */
  document.addEventListener(
    "submit",
    function (e) {
      var f = e.target;
      if (!f || f.id !== "f") return;
      var inEl = document.getElementById("in");
      var v = inEl ? String(inEl.value || "").trim() : "";
      if (!tryFood(v)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (inEl) inEl.value = "";
    },
    true
  );

  /* Scrub Pick talk if something else opens pin menu */
  function watchLine() {
    var line = document.getElementById("line");
    if (!line) return setTimeout(watchLine, 80);
    if (line.__snPizza4214) return;
    line.__snPizza4214 = true;
    var mo = new MutationObserver(function () {
      var s = String(line.textContent || "");
      if (!/Pick:\s*my location,\s*vendor/i.test(s)) return;
      var place = landedCity();
      if (!place || placeIsRhodes(place)) return;
      var q = s.split(".")[0] || "pizza";
      paintNairobiPins(place, q);
    });
    mo.observe(line, { childList: true, characterData: true, subtree: true });
  }
  watchLine();

  /* Persist Nairobi when land talk appears */
  function watchLand() {
    var line = document.getElementById("line");
    if (!line) return setTimeout(watchLand, 120);
    var mo = new MutationObserver(function () {
      var s = String(line.textContent || "");
      var m = s.match(/On the ground in\s+([^.]+)/i) || s.match(/\b(Nairobi)\b/i);
      if (!m) return;
      var name = (m[1] || "Nairobi").trim();
      if (!/nairobi/i.test(name)) return;
      var c = mapCenter() || { lat: -1.286389, lng: 36.817223 };
      try {
        localStorage.setItem("sn:place", JSON.stringify({ lat: c.lat, lng: c.lng, name: "Nairobi" }));
      } catch (e) {}
    });
    mo.observe(line, { childList: true, characterData: true, subtree: true });
  }
  watchLand();

  function wrapSN() {
    if (!global.SN) return setTimeout(wrapSN, 40);
    if (typeof SN.run === "function" && !SN.__pizza4214Run) {
      SN.__pizza4214Run = true;
      var orig = SN.run.bind(SN);
      SN.run = function (t) {
        if (tryFood(t)) return;
        return orig(t);
      };
    }
    if (typeof SN.hunt === "function" && !SN.__pizza4214Hunt) {
      SN.__pizza4214Hunt = true;
      var oh = SN.hunt.bind(SN);
      SN.hunt = function (query, at, extra) {
        if (isFoodOrBrand(query) && landedCity() && !placeIsRhodes(landedCity())) {
          paintNairobiPins(at && isFinite(+at.lat) ? at : landedCity(), query);
          return;
        }
        return oh(query, at, extra);
      };
    }
  }
  wrapSN();
})(typeof window !== "undefined" ? window : this);
