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
      code = code.replace("openCity: openCity", "openCity: openCity,\n    goNamed: goNamed,\n    huntNamed: huntNamed", 1);
    } else if (code.indexOf("huntNamed: huntNamed") < 0) {
      code = code.replace("goNamed: goNamed", "goNamed: goNamed,\n    huntNamed: huntNamed", 1);
    }

    /* replace huntNamed with city-scoped /api/find */
    var hs = code.indexOf("  function huntNamed(q, grokPlaces) {");
    var he = code.indexOf("  function showHunt(q, pins) {");
    if (hs < 0 || he < 0 || he <= hs) throw new Error("huntNamed block missing");
    var newHunt =
      "  function landCity() {\n" +
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
      "  function isRhodesCity(city) {\n" +
      "    return /^(rhodes|rodos|ρόδος)$/i.test(String(city || \"\").trim());\n" +
      "  }\n" +
      "  function isRhodesBbox(lat, lng) {\n" +
      "    return lng >= 27.5 && lng <= 28.5 && lat >= 35.7 && lat <= 36.6;\n" +
      "  }\n" +
      "  function isPartnerPin(p) {\n" +
      "    return /pizzarium|augoustinos|avgoustinos|tsambikos|calisto/i.test(String((p && p.name) || \"\") + \" \" + String((p && p.raw) || \"\"));\n" +
      "  }\n" +
      "  function huntNamed(q, grokPlaces) {\n" +
      "    var city = landCity();\n" +
      "    var cityRhodes = isRhodesCity(city);\n" +
      "    var pins = [];\n" +
      "    /* 4250: when landed in a non-Rhodes city, IGNORE grokPlaces (AI returns Rhodes partners like Pizzarium). */\n" +
      "    if (!city || cityRhodes) {\n" +
      "      (grokPlaces || []).forEach(function (p) {\n" +
      "        var lat = Number(p.lat), lng = Number(p.lng);\n" +
      "        if (isFinite(lat) && isFinite(lng)) pins.push({ name: p.name || q, lat: lat, lng: lng, raw: p.raw || \"\", phone: p.phone || \"\", menu: p.menu });\n" +
      "      });\n" +
      "    }\n" +
      "    var findUrl = \"/api/find?q=\" + encodeURIComponent(q) + (city ? (\"&city=\" + encodeURIComponent(city)) : \"\");\n" +
      "    if (here && isFinite(here.lat) && isFinite(here.lng)) findUrl += \"&lat=\" + encodeURIComponent(here.lat) + \"&lng=\" + encodeURIComponent(here.lng);\n" +
      "    function keepPin(p) {\n" +
      "      if (!p || !isFinite(+p.lat) || !isFinite(+p.lng)) return false;\n" +
      "      if (city && !cityRhodes) {\n" +
      "        if (isPartnerPin(p)) return false;\n" +
      "        if (isRhodesBbox(+p.lat, +p.lng)) return false;\n" +
      "      }\n" +
      "      return true;\n" +
      "    }\n" +
      "    function photonFallback() {\n" +
      "      var url = \"https://photon.komoot.io/api/?limit=8&q=\" + encodeURIComponent(city ? (q + \" \" + city) : q);\n" +
      "      if (here && isFinite(here.lat) && isFinite(here.lng)) url += \"&lat=\" + here.lat + \"&lon=\" + here.lng;\n" +
      "      return fetch(url).then(function (r) { return r.json(); }).then(function (j) {\n" +
      "        var feats = (j && j.features) || [];\n" +
      "        var ph = [];\n" +
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
      "          var pin = { name: name, lat: c[1], lng: c[0], raw: [props.street, props.city, props.country].filter(Boolean).join(\", \") };\n" +
      "          if (keepPin(pin)) ph.push(pin);\n" +
      "        });\n" +
      "        showHunt(q, ph.length ? ph : pins.filter(keepPin));\n" +
      "      }).catch(function () { showHunt(q, pins.filter(keepPin)); });\n" +
      "    }\n" +
      "    say(city ? (\"Hunting \" + q + \" in \" + city + \"...\") : (\"Hunting \" + q + \"...\"));\n" +
      "    fetch(findUrl, { cache: \"no-store\" })\n" +
      "      .then(function (r) { return r.ok ? r.json() : null; })\n" +
      "      .then(function (j) {\n" +
      "        var places = (j && j.places) || [];\n" +
      "        var fromFind = [];\n" +
      "        places.forEach(function (p) {\n" +
      "          var lat = Number(p.lat), lng = Number(p.lng);\n" +
      "          if (isFinite(lat) && isFinite(lng)) fromFind.push({ name: p.name || q, lat: lat, lng: lng, raw: p.raw || \"\", phone: p.phone || \"\", menu: p.menu });\n" +
      "        });\n" +
      "        fromFind = fromFind.filter(keepPin);\n" +
      "        /* Prefer /api/find city results FIRST so showHunt first pin is a real local shop. */\n" +
      "        if (fromFind.length) { showHunt(q, fromFind); return; }\n" +
      "        var kept = pins.filter(keepPin);\n" +
      "        if (kept.length) showHunt(q, kept);\n" +
      "        else photonFallback();\n" +
      "      })\n" +
      "      .catch(function () {\n" +
      "        var kept = pins.filter(keepPin);\n" +
      "        if (kept.length) showHunt(q, kept);\n" +
      "        else photonFallback();\n" +
      "      });\n" +
      "  }\n";

    code = code.slice(0, hs) + newHunt + code.slice(he);
