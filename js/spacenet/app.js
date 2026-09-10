/* SpaceNet 4248 — bootstrap: patch tip OS with goNamed + city-scoped hunt. */
(function () {
  "use strict";
  if (window.__SN_4248) return;
  var TIP = "https://raw.githubusercontent.com/notisastranov/astranov.eu/49c666464541ef4352e5322931fbbe2663ea3c71/js/spacenet/app.js";
  var GONAMED = "  function goNamed(q) {\n    q = String(q || \"\").trim();\n    if (!q) { say(\"Name a place.\"); return; }\n    var m = q.match(/^(?:land(?:\\s+(?:in|at|on))?|go(?:\\s+to)?|fly(?:\\s+to)?)\\s+(.+)$/i);\n    if (m) q = String(m[1] || \"\").replace(/[.!?]+$/g, \"\").trim();\n    if (!q) { say(\"Name a place.\"); return; }\n    var NBO = { lat: -1.286389, lng: 36.817223, name: \"Nairobi\" };\n    function pinOf(p, fallback) {\n      if (!p || !isFinite(+p.lat) || !isFinite(+p.lng)) return null;\n      var name = String(p.name || p.place || p.city || fallback || \"\").split(\",\")[0].trim();\n      if (!name) name = String(fallback || \"here\").trim() || \"here\";\n      return { lat: +p.lat, lng: +p.lng, name: name };\n    }\n    function landNamed(pt) {\n      if (!pt) { say(\"No place found for \" + q + \".\"); return; }\n      here = { lat: pt.lat, lng: pt.lng };\n      hereName = pt.name || q;\n      try {\n        localStorage.setItem(\"sn:place\", JSON.stringify({ lat: pt.lat, lng: pt.lng, name: hereName }));\n      } catch (e) {}\n      flyTo(pt, 1.12);\n      setTimeout(function () { openCity(pt); }, 920);\n      say(\"On the ground in \" + hereName + \".\");\n      paintMarks();\n    }\n    function nominatim(query) {\n      var url = \"https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&q=\" + encodeURIComponent(query);\n      return fetch(url, { headers: { Accept: \"application/json\" }, cache: \"no-store\" })\n        .then(function (r) { return r.ok ? r.json() : []; })\n        .then(function (list) {\n          if (!Array.isArray(list) || !list.length) return null;\n          function rank(t) {\n            var n = String((t && t.type) || \"\");\n            var e = String((t && t.addresstype) || \"\");\n            if (n === \"city\" || e === \"city\") return 0;\n            if (n === \"town\" || e === \"town\") return 1;\n            if (n === \"municipality\" || e === \"municipality\") return 2;\n            if (/administrative|suburb|village|county|state/i.test(n + \" \" + e)) return 3;\n            return 9;\n          }\n          var good = list.filter(function (t) { return rank(t) < 9; });\n          var best = (good.length ? good : list).slice().sort(function (a, b) { return rank(a) - rank(b); })[0];\n          if (!best) return null;\n          return pinOf({ lat: best.lat, lng: best.lon, name: best.name || String(best.display_name || \"\").split(\",\")[0] }, query);\n        })\n        .catch(function () { return null; });\n    }\n    function fromFind(query) {\n      return fetch(\"/api/find?q=\" + encodeURIComponent(query), { cache: \"no-store\" })\n        .then(function (r) { return r.ok ? r.json() : null; })\n        .then(function (j) {\n          var places = (j && j.places) || [];\n          var want = String(query || \"\").toLowerCase().trim();\n          var exact = null, soft = null;\n          for (var i = 0; i < places.length; i++) {\n            var p = places[i];\n            var pin = pinOf(p, query);\n            if (!pin) continue;\n            var nm = String(pin.name || \"\").toLowerCase().trim();\n            if (nm === want) { exact = pin; break; }\n            if (!soft && nm.indexOf(want) >= 0) soft = pin;\n          }\n          return exact || soft || (places[0] ? pinOf(places[0], query) : null);\n        })\n        .catch(function () { return null; });\n    }\n    say(\"Landing \" + q + \"\\u2026\");\n    if (/^\\s*nairobi\\b/i.test(q) || /\\bnairobi\\b/i.test(q)) {\n      landNamed(NBO);\n      return;\n    }\n    fromFind(q).then(function (p) {\n      return p || nominatim(q);\n    }).then(function (p) {\n      if (p) landNamed(p);\n      else if (/\\bnairobi\\b/i.test(q)) landNamed(NBO);\n      else say(\"No place found for \" + q + \".\");\n    }).catch(function () {\n      if (/\\bnairobi\\b/i.test(q)) landNamed(NBO);\n      else say(\"Land node offline.\");\n    });\n  }";
  function fail(m) {
    try { var el = document.getElementById("line"); if (el) el.textContent = m; } catch (e) {}
    console.error(m);
  }
  function apply(code) {
    if (!code || code.indexOf("function talk(") < 0) throw new Error("tip app missing");
    if (code.indexOf("function goNamed") >= 0) {
      /* already patched upstream */
    } else {
      var mark = "\n  function talk(";
      var i = code.indexOf(mark);
      if (i < 0) throw new Error("talk() not found");
      code = code.slice(0, i + 1) + GONAMED + "\n" + code.slice(i + 1);
    }
    var oldCity = "if (act === \"city\" || act === \"map\" || act === \"national\") {\n        if (here) openCity(here); else gps();\n      }";
    var newCity = "if (act === \"city\" || act === \"map\" || act === \"national\") {\n        if (here) openCity(here);\n        else goNamed((j && (j.place || j.q || j.city)) || msg);\n        return;\n      }";
    if (code.indexOf(oldCity) >= 0) code = code.replace(oldCity, newCity);
    else if (code.indexOf("else goNamed") < 0) throw new Error("city branch not patched");

    if (code.indexOf("goNamed: goNamed") < 0) {
      if (code.indexOf("openCity: openCity") < 0) throw new Error("SN export missing");
      code = code.replace("openCity: openCity", "openCity: openCity,\n    goNamed: goNamed", 1);
    }

    /* replace huntNamed with city-scoped /api/find */
    var hs = code.indexOf("  function huntNamed(q, grokPlaces) {");
    var he = code.indexOf("  function showHunt(q, pins) {");
    if (hs < 0 || he < 0 || he <= hs) throw new Error("huntNamed block missing");
    var newHunt = "  function landCity() {\n" +
      "    var city = \"\";\n" +
      "    if (hereName) city = String(hereName).split(\",\")[0].trim();\n" +
      "    if (!city) {\n" +
      "      try {\n" +
      "        var pl = JSON.parse(localStorage.getItem(\"sn:place\") || \"null\");\n" +
      "        if (pl && pl.name) city = String(pl.name).split(\",\")[0].trim();\n" +
      "      } catch (e) {}\n" +
      "    }\n" +
      "    return city;\n" +
      "  }\n" +
      "  function huntNamed(q, grokPlaces) {\n" +
      "    var pins = [];\n" +
      "    (grokPlaces || []).forEach(function (p) {\n" +
      "      var lat = Number(p.lat), lng = Number(p.lng);\n" +
      "      if (isFinite(lat) && isFinite(lng)) pins.push({ name: p.name || q, lat: lat, lng: lng, raw: p.raw || \"\", phone: p.phone || \"\", menu: p.menu });\n" +
      "    });\n" +
      "    var city = landCity();\n" +
      "    var findUrl = \"/api/find?q=\" + encodeURIComponent(q) + (city ? (\"&city=\" + encodeURIComponent(city)) : \"\");\n" +
      "    if (here && isFinite(here.lat) && isFinite(here.lng)) findUrl += \"&lat=\" + encodeURIComponent(here.lat) + \"&lng=\" + encodeURIComponent(here.lng);\n" +
      "    function photonFallback() {\n" +
      "      var url = \"https://photon.komoot.io/api/?limit=8&q=\" + encodeURIComponent(city ? (q + \" \" + city) : q);\n" +
      "      if (here && isFinite(here.lat) && isFinite(here.lng)) url += \"&lat=\" + here.lat + \"&lon=\" + here.lng;\n" +
      "      return fetch(url).then(function (r) { return r.json(); }).then(function (j) {\n" +
      "        var feats = (j && j.features) || [];\n" +
      "        feats.forEach(function (f) {\n" +
      "          var c = f.geometry && f.geometry.coordinates;\n" +
      "          if (!c) return;\n" +
      "          var props = f.properties || {};\n" +
      "          var name = props.name || q;\n" +
      "          if (city) {\n" +
      "            var where = String(props.city || props.state || props.country || \"\").toLowerCase();\n" +
      "            var want = city.toLowerCase();\n" +
      "            if (where && where.indexOf(want) < 0) {\n" +
      "              if (here) {\n" +
      "                if (Math.abs(c[1] - here.lat) > 0.35 || Math.abs(c[0] - here.lng) > 0.35) return;\n" +
      "              } else return;\n" +
      "            }\n" +
      "          }\n" +
      "          pins.push({ name: name, lat: c[1], lng: c[0], raw: [props.street, props.city, props.country].filter(Boolean).join(\", \") });\n" +
      "        });\n" +
      "        showHunt(q, pins);\n" +
      "      }).catch(function () { showHunt(q, pins); });\n" +
      "    }\n" +
      "    say(city ? (\"Hunting \" + q + \" in \" + city + \"…\") : (\"Hunting \" + q + \"…\"));\n" +
      "    fetch(findUrl, { cache: \"no-store\" })\n" +
      "      .then(function (r) { return r.ok ? r.json() : null; })\n" +
      "      .then(function (j) {\n" +
      "        var places = (j && j.places) || [];\n" +
      "        places.forEach(function (p) {\n" +
      "          var lat = Number(p.lat), lng = Number(p.lng);\n" +
      "          if (isFinite(lat) && isFinite(lng)) pins.push({ name: p.name || q, lat: lat, lng: lng, raw: p.raw || \"\", phone: p.phone || \"\", menu: p.menu });\n" +
      "        });\n" +
      "        if (pins.length) showHunt(q, pins);\n" +
      "        else photonFallback();\n" +
      "      })\n" +
      "      .catch(function () { photonFallback(); });\n" +
      "  }\n";
    code = code.slice(0, hs) + newHunt + code.slice(he);

    var oldGuest = ": '<button type=\"button\" class=\"act\" data-act=\"need-login\">LOGIN TO ORDER</button>');";
    var newGuest = ": ('<button type=\"button\" class=\"act\" data-act=\"now\">NOW</button>' +\n           '<button type=\"button\" class=\"act\" data-act=\"pay\">PAY</button>' +\n           '<button type=\"button\" class=\"act\" data-act=\"reload\">RELOAD</button>' +\n           '<p>Guest cannot pay. Login to order.</p>'));";
    if (code.indexOf(oldGuest) >= 0) code = code.replace(oldGuest, newGuest);

    var oldNeed = "    if (act === \"need-login\") { needLogin(); return; }";
    var newNeed = "    if (act === \"now\" || act === \"pay\") { say(\"Guest cannot pay. Sign in to order.\"); needLogin(); return; }\n    if (act === \"need-login\") { needLogin(); return; }";
    if (code.indexOf(oldNeed) >= 0) code = code.replace(oldNeed, newNeed);

    code = code.split("4246").join("4248");
    code = code.replace("/* SpaceNet 4248 — one OS. Sphere globe. Tree lock. Origin diet. */",
                        "/* SpaceNet 4248 — goNamed + city-scoped hunt. Origin diet. */");
    if (code.indexOf("window.__SN_4248") < 0) throw new Error("stamp failed");
    if (code.indexOf("function goNamed") < 0) throw new Error("goNamed missing after patch");
    if (code.indexOf("else gps()") >= 0 && code.indexOf("else goNamed") < 0) throw new Error("city still gps");
    if (code.indexOf("/api/find?q=") < 0) throw new Error("city find missing");
    return code;
  }
  fetch(TIP, { cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("tip fetch " + r.status); return r.text(); })
    .then(function (tip) {
      var code = apply(tip);
      var s = document.createElement("script");
      s.textContent = code;
      document.head.appendChild(s);
    })
    .catch(function (err) {
      fail("4248 OS patch failed. Nuclear / hard refresh.");
      console.error(err);
    });
})();
