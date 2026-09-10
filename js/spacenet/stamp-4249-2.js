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
      "    say(city ? (\"Hunting \" + q + \" in \" + city + \"…\") : (\"Hunting \" + q + \"…\"));\n" +
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

    var oldGuest = ": '<button type=\"button\" class=\"act\" data-act=\"need-login\">LOGIN TO ORDER</button>');";
    var newGuest = ": ('<button type=\"button\" class=\"act\" data-act=\"now\">NOW</button>' +\n           '<button type=\"button\" class=\"act\" data-act=\"pay\">PAY</button>' +\n           '<button type=\"button\" class=\"act\" data-act=\"reload\">RELOAD</button>' +\n           '<p>Guest cannot pay. Login to order.</p>'));";
    if (code.indexOf(oldGuest) >= 0) code = code.replace(oldGuest, newGuest);

    var oldNeed = "    if (act === \"need-login\") { needLogin(); return; }";
    var newNeed = "    if (act === \"now\" || act === \"pay\") { say(\"Guest cannot pay. Sign in to order.\"); needLogin(); return; }\n    if (act === \"need-login\") { needLogin(); return; }";
    if (code.indexOf(oldNeed) >= 0) code = code.replace(oldNeed, newNeed);

    code = code.split("4246").join("4249");
    code = code.replace("/* SpaceNet 4249 — one OS. Sphere globe. Tree lock. Origin diet. */",
                        "/* SpaceNet 4249 — goNamed + city-find hunt (no Pizzarium off-island). */");
    if (code.indexOf("window.__SN_4249") < 0) throw new Error("stamp failed");
    if (code.indexOf("IGNORE grokPlaces") < 0) throw new Error("4249 ignore-grok missing");
    if (code.indexOf("function goNamed") < 0) throw new Error("goNamed missing after patch");
    if (code.indexOf("else gps()") >= 0 && code.indexOf("else goNamed") < 0) throw new Error("city still gps");
    if (code.indexOf("/api/find?q=") < 0) throw new Error("city find missing");
    return code;
  }
  window.__SN_APPLY_4249 = function (tip) {
    try {
      var code = apply(tip);
      var s = document.createElement("script");
      s.textContent = code;
      document.head.appendChild(s);
      window.__SN_4249 = true;
    } catch (err) {
      fail("4249 OS patch failed. Nuclear / hard refresh.");
      console.error(err);
    }
  };
})();
