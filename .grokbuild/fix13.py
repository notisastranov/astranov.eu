def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:80], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'

# ---- Greek variants first for the big Greek cities
rep(A, r'''    if (/^(athens|athina|αθήνα|αθηνα)$/i.test(t)) return "Αθήνα, Ελλάδα";
    return t;''', r'''    if (/^(athens|athina|αθήνα|αθηνα)$/i.test(t)) return "Αθήνα, Ελλάδα";
    var g = GR_CITY[normName(t)];
    if (g) return g.q;
    return t;''')

# ---- huntPlace takes a pre-resolved geo (bare place word) and always says what landed
rep(A, r'''    return geocodePlace(place).then(function (geo) {''', r'''    return (ask.geo ? Promise.resolve(ask.geo) : geocodePlace(place)).then(function (geo) {''')
rep(A, r'''          if (seq === placeSeq && rows.length) say(place + " on the map. " + rows.length + " listed shop" + (rows.length === 1 ? "" : "s") + " here. Tap one, or name a shop or a service.");''', r'''          if (seq !== placeSeq) return;
          if (rows.length) say(place + " on the map. " + rows.length + " listed shop" + (rows.length === 1 ? "" : "s") + " here. Tap one, or name a shop or a service.");
          else say(place + " on the map. No listed shop here yet. Name a shop or a service to find real pins.");''')

# ---- bare place word: one or two words, no verb, no category -> named-place path before Grok
rep(A, r'''  function placeQuery(place) {''', r'''  function normName(t) {
    var s = String(t || "").toLowerCase();
    try { s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, ""); } catch (e) {}
    return s.replace(/\u03c2/g, "\u03c3").replace(/[^a-z0-9\u03b1-\u03c9 '-]+/g, " ").replace(/\s+/g, " ").trim();
  }
  // real city-centre coordinates, used only to sanity-check the geocode of these named cities
  var GR_CITY = (function () {
    var m = {}, list = [
      [["athens", "athina", "athena", "αθηνα"], "Αθήνα, Ελλάδα", "Athens, Greece", 37.9838, 23.7275],
      [["rhodes", "rodos", "ροδος"], "Ρόδος, Ελλάδα", "Rhodes, Greece", 36.4349, 28.2176],
      [["thessaloniki", "salonica", "saloniki", "θεσσαλονικη"], "Θεσσαλονίκη, Ελλάδα", "Thessaloniki, Greece", 40.6401, 22.9444],
      [["heraklion", "iraklio", "iraklion", "ηρακλειο"], "Ηράκλειο, Ελλάδα", "Heraklion, Greece", 35.3387, 25.1442],
      [["patras", "patra", "πατρα"], "Πάτρα, Ελλάδα", "Patras, Greece", 38.2466, 21.7346]
    ];
    list.forEach(function (c) { c[0].forEach(function (k) { m[normName(k)] = { q: c[1], label: c[2], lat: c[3], lng: c[4] }; }); });
    return m;
  })();
  var NOT_PLACE = {};
  ("i im me my mine you your u we us our it its this that is are am was be do does did can could will would should what whats why how who when where which " +
   "hi hello hey yo sup hiya thanks thank thx ok okay yes no nope yeah yep please pls help find show hunt search get go take order buy call open close hide " +
   "login logout signin sign pay send want need like love tell give make book near nearby around here there dating date pizza food eat coffee cafe shop shops " +
   "store market supermarket pharmacy plumber electrician driver drivers delivery deliver taxi ride restaurant bar bakery burger sushi gyros souvlaki grocery " +
   "groceries job jobs work wallet menu test tester support weather time news joke music globe map city zoom back home update version " +
   "γεια καλημερα καλησπερα ευχαριστω ναι οχι θελω βρες δειξε πιτσα φαγητο καφε σουπερ μαρκετ φαρμακειο υδραυλικος ταξι").split(" ").forEach(function (w) { NOT_PLACE[normName(w)] = 1; });
  var COUNTRY_TAIL = /^(greece|hellas|ελλαδα)$/;
  function barePlaceWord(q) {
    var s = String(q || "").replace(/[?!.,;:]+$/, "").trim();
    if (!s || s.length > 32 || /\d/.test(s)) return null;
    var w = normName(s).split(" ").filter(Boolean);
    if (!w.length || w.length > 2) return null;
    if (w.some(function (x) { return NOT_PLACE[x] || x.length < 2; })) return null;
    return s;
  }
  function nomPlace(s, gr) {
    var url = "https://nominatim.openstreetmap.org/search?format=json&limit=5&namedetails=1&addressdetails=0" + (gr ? "&countrycodes=gr" : "") + "&q=" + encodeURIComponent(s);
    var want = normName(s);
    return fetchJson(url, { headers: { Accept: "application/json" } }, 6000).then(function (rows) {
      var hit = (Array.isArray(rows) ? rows : []).filter(function (r) {
        var cls = String(r.class || ""), t = String(r.addresstype || "");
        if (cls !== "place" && cls !== "boundary") return false;
        if (!(gr ? /^(city|town|village|island|municipality)$/ : /^(city|town|island|country|state|region|province|municipality)$/).test(t)) return false;
        if (!gr && !(+r.importance >= 0.45)) return false;
        var nd = r.namedetails || {};
        var names = [r.name].concat(Object.keys(nd).map(function (k) { return nd[k]; }));
        return names.some(function (n) { return String(n || "").split(";").some(function (x) { return normName(x) === want; }); });
      })[0];
      if (!hit || !isFinite(+hit.lat) || !isFinite(+hit.lon)) return null;
      var nd2 = hit.namedetails || {}, country = gr ? "Greece" : String(hit.display_name || "").split(",").pop().trim();
      var nm = nd2["name:en"] || s;
      return { lat: +hit.lat, lng: +hit.lon, name: nm + (country && normName(country) !== normName(nm) ? ", " + country : "") };
    }).catch(function () { return null; });
  }
  function placeGeo(s) {
    // Greek variants first: the big Greek cities by their Greek name, then Greece-only places, then confident world places
    var w = normName(s).split(" ");
    var key = w.length === 2 && COUNTRY_TAIL.test(w[1]) ? w[0] : w.join(" ");
    var c = GR_CITY[key];
    if (c) {
      return geocodePlace(key).then(function (geo) {
        var ok = geo && isFinite(geo.lat) && haversineKm(geo, c) <= 40 ? geo : { lat: c.lat, lng: c.lng };
        return { lat: ok.lat, lng: ok.lng, name: c.label };
      }, function () { return { lat: c.lat, lng: c.lng, name: c.label }; });
    }
    if (shops.some(function (p) { return p && normName(p.name) === normName(s); })) return Promise.resolve(null);
    var greek = w.length === 2 && COUNTRY_TAIL.test(w[1]);
    var one = greek ? s.split(/\s+/)[0] : s;
    return nomPlace(one, true).then(function (g) { return g || (greek ? null : nomPlace(one, false)); });
  }
  var bareSeq = 0;
  function placeQuery(place) {''')

# ---- talk: bare place word first, Grok only when the geocode has nothing confident
rep(A, r'''    if (runLine(q)) return;
    var hits = searchRoster(q);
    say("Grok…");''', r'''    if (runLine(q)) return;
    var bs = ++bareSeq, bare = barePlaceWord(q);
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
  }
  function grokTalk(q) {
    var hits = searchRoster(q);
    say("Grok…");''')
print('ok13')
