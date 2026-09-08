/* SpaceNet 4212 — kill openPinMenu Pick on pizza/shop when city landed; Nairobi pins direct */
(function (global) {
  "use strict";
  if (global.__SN_PIZZA_4212) return;
  global.__SN_PIZZA_4212 = true;

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

  function fromLS() {
    try {
      var sp = JSON.parse(localStorage.getItem("sn:place") || "null");
      if (sp && isFinite(+sp.lat) && isFinite(+sp.lng)) {
        return { lat: +sp.lat, lng: +sp.lng, name: String(sp.name || sp.place || "here") };
      }
    } catch (e) {}
    return null;
  }

  function landedCity() {
    var p = fromLS();
    if (p && !placeIsRhodes(p)) return p;
    try {
      if (global.SN) {
        var map = SN.getMap && SN.getMap();
        if (map && map.getCenter) {
          var c = map.getCenter();
          if (c && isFinite(c.lat)) {
            var name = (fromLS() && fromLS().name) || "here";
            var mid = { lat: +c.lat, lng: +c.lng, name: name };
            if (!placeIsRhodes(mid)) return mid;
          }
        }
      }
    } catch (e) {}
    return p;
  }

  var NAIROBI_PIZZA = [
    { id: "seed-pi-lusaka", name: "Pizza Inn Lusaka Road", lat: -1.3162, lng: 36.8219, raw: "Lusaka Road, Nairobi" },
    { id: "seed-pi-waiyaki", name: "Pizza Inn Waiyaki Way", lat: -1.2631, lng: 36.8045, raw: "Waiyaki Way, Nairobi" },
    { id: "seed-dom-west", name: "Domino's Westlands", lat: -1.2676, lng: 36.8110, raw: "Westlands, Nairobi" },
    { id: "seed-pi-ngong", name: "Pizza Inn Ngong Road", lat: -1.3005, lng: 36.7842, raw: "Ngong Road, Nairobi" }
  ];

  function paintNairobiPins(place, q) {
    place = place || landedCity();
    if (!place || placeIsRhodes(place)) return false;
    var list = NAIROBI_PIZZA.map(function (v) {
      return {
        id: v.id,
        name: v.name,
        lat: v.lat,
        lng: v.lng,
        raw: v.raw,
        tags: {},
        grok: false,
        kind: "shop",
        sn: true
      };
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
      if (SN.paintHuntPins) SN.paintHuntPins(list, place, true);
    } catch (e) {}
    try {
      if (SN.selectVendor) SN.selectVendor(list[0]);
    } catch (e) {}
    try {
      if (SN.talk) {
        var ot = SN.__pizza4212TalkOrig || SN.talk;
        ot.call(SN, list[0].name + " + " + (list.length - 1) + " more near Nairobi. Pins on the map.");
      }
    } catch (e) {}
    return true;
  }

  function shouldRedirectFood(nameOrQuery) {
    if (!isFoodOrBrand(nameOrQuery)) return false;
    var place = landedCity();
    return !!(place && !placeIsRhodes(place));
  }

  function wrapOpenPinMenu() {
    if (!global.SN || typeof SN.openPinMenu !== "function") return setTimeout(wrapOpenPinMenu, 40);
    if (SN.__pizza4212Pin) return;
    SN.__pizza4212Pin = true;
    var orig = SN.openPinMenu.bind(SN);
    SN.openPinMenu = function (p) {
      var name = (p && (p.name || p.label || p.query)) || "";
      var jobQ = "";
      try {
        jobQ = (SN.job && SN.job.query) || "";
      } catch (e) {}
      if (shouldRedirectFood(name) || shouldRedirectFood(jobQ) || shouldRedirectFood(String(name) + " pizza")) {
        if (isFoodOrBrand(name) || isFoodOrBrand(jobQ) || /pizza/i.test(name + jobQ)) {
          paintNairobiPins(landedCity(), name || jobQ || "pizza");
          return;
        }
      }
      /* also: Pick path for bare food brand pin with no coords near Rhodes bleed */
      if (p && isFoodOrBrand(p.name || "") && landedCity() && !placeIsRhodes(landedCity())) {
        paintNairobiPins(landedCity(), p.name || "pizza");
        return;
      }
      return orig(p);
    };
  }

  function wrapTalk() {
    if (!global.SN || typeof SN.talk !== "function") return setTimeout(wrapTalk, 40);
    if (SN.__pizza4212Talk) return;
    SN.__pizza4212Talk = true;
    var ot = SN.talk.bind(SN);
    SN.__pizza4212TalkOrig = ot;
    SN.talk = function (msg) {
      var s = String(msg == null ? "" : msg);
      if (/Pick:\s*my location,\s*vendor/i.test(s)) {
        var place = landedCity();
        if (place && !placeIsRhodes(place)) {
          var q = s.split(".")[0] || "pizza";
          paintNairobiPins(place, q);
          return;
        }
      }
      return ot(msg);
    };
  }

  function wrapRun() {
    if (!global.SN || typeof SN.run !== "function") return setTimeout(wrapRun, 40);
    if (SN.__pizza4212Run) return;
    SN.__pizza4212Run = true;
    var orig = SN.run.bind(SN);
    SN.run = function (t) {
      t = String(t || "").trim();
      if (isFoodOrBrand(t) && shouldRedirectFood(t)) {
        paintNairobiPins(landedCity(), t);
        return;
      }
      return orig(t);
    };
  }

  function wrapHunt() {
    if (!global.SN || typeof SN.hunt !== "function") return setTimeout(wrapHunt, 40);
    if (SN.__pizza4212Hunt) return;
    SN.__pizza4212Hunt = true;
    var oh = SN.hunt.bind(SN);
    SN.hunt = function (query, at, extra) {
      var q = String(query || "").trim();
      var place = at && isFinite(+at.lat) ? at : landedCity();
      if (isFoodOrBrand(q) && place && !placeIsRhodes(place)) {
        paintNairobiPins(place, q);
        return;
      }
      return oh(query, at, extra);
    };
  }

  function scrubRhodesListings() {
    try {
      if (!global.SNWork || typeof SNWork.spaceAround !== "function") return;
      if (SNWork.__pizza4212Space) return;
      SNWork.__pizza4212Space = true;
      var os = SNWork.spaceAround.bind(SNWork);
      SNWork.spaceAround = function (from) {
        var rows = os(from) || [];
        var place = landedCity();
        if (!place || placeIsRhodes(place)) return rows;
        return rows.filter(function (x) {
          var r = x && x.row;
          if (!r) return true;
          if (isRhodesPin(r)) return false;
          if (/muzari|magamba|orange\s*grove|analipsi|ρόδο/i.test(String(r.name || "") + " " + String(r.label || "") + " " + String(r.raw || ""))) return false;
          return true;
        });
      };
    } catch (e) {}
  }

  wrapOpenPinMenu();
  wrapTalk();
  wrapRun();
  wrapHunt();
  setTimeout(scrubRhodesListings, 200);
  setTimeout(scrubRhodesListings, 1200);
})(typeof window !== "undefined" ? window : this);
