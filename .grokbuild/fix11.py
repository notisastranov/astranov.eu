def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:80], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'
I = 'api/ai.js'

# ---- shared helpers: distance gate, dating ask, explicit near-YOU ask
rep(A, r'''  function seesShop(s) {
    if (!s || s.status === "denied" || junkPlace(s)) return false;''', r'''  function nearOf(c, km) {
    return function (s) { return !!(s && c && isFinite(+s.lat) && isFinite(+s.lng) && isFinite(+c.lat) && haversineKm({ lat: +c.lat, lng: +c.lng }, { lat: +s.lat, lng: +s.lng }) <= km); };
  }
  var DATING = /\bdating\b|\bdate\s+(app|site|someone)\b|\btinder\b|\bbumble\b|\bhinge\s+app\b|\bhook\s*-?\s*ups?\b|\b(girl|boy)friend\b|\bmeet\s+(a\s+)?(women|men|girls|guys|someone|singles?)\b|\bsingles\s+(near|in|around)\b|γνωριμ/i;
  function datingAsk(q) { return DATING.test(String(q || "")); }
  var NEAR_YOU = /\(?\s*\b(?:near|around|close\s+to)\s+(?:me|you|here|gps|my\s+location)\b\s*\)?|\bnearby\b|κοντά\s+μου/i;
  function nearYouItem(q) {
    var s = String(q || "");
    if (!NEAR_YOU.test(s)) return null;
    var t = s.replace(new RegExp(NEAR_YOU.source, "ig"), " ").replace(/[()?!.]+/g, " ").replace(/\s+/g, " ").trim();
    var item = cleanItem(t);
    return item && !/^(what'?s|what|anything|something|stuff|places?|things?|shops?)$/i.test(item) ? item : null;
  }
  function honestDating() {
    huntSeq++;
    placeSeq++;
    closeFind();
    say("Dating is empty on SpaceNet: nobody has listed a dating profile yet. No people and no venues are guessed.");
  }
  function seesShop(s) {
    if (!s || s.status === "denied" || junkPlace(s)) return false;''')
# drivers list: never show test / zero-phone rows
rep(A, r'''  function seesDriver(p) {
    if (!p) return false;''', r'''  function seesDriver(p) {
    if (!p || junkPlace(p)) return false;''')
rep(A, r'''      if (p && p.role === "driver" && p.free !== false && isFinite(+p.lat)) drivers.push(p);''',
       r'''      if (p && p.role === "driver" && p.free !== false && isFinite(+p.lat) && !junkPlace(p)) drivers.push(p);''')

# ---- 1. listed rows never leak into another city: an 80 km gate around the landed place (the same radius /api/space uses)
rep(A, r'''      var rows = ((j && j.shops) || []).map(function (r) { return asPlace(r, "listed"); }).filter(Boolean);
      if (!rows.length) return [];
      var ids = {};
      rows.forEach(function (p) { ids[p.id] = 1; });
      shops = uniqPlaces(rows.concat(shops.filter(function (s) { return s && !ids[s.id]; })), geo);''',
       r'''      var rows = ((j && j.shops) || []).map(function (r) { return asPlace(r, "listed"); }).filter(function (p) { return p && nearOf(geo, 80)(p); });
      shops = shops.filter(function (s) { return s && (s.src !== "listed" || nearOf(geo, 80)(s)); });
      if (!rows.length) { paintShopsOnMap(); return []; }
      var ids = {};
      rows.forEach(function (p) { ids[p.id] = 1; });
      shops = uniqPlaces(rows.concat(shops.filter(function (s) { return s && !ids[s.id]; })), geo);''')
rep(A, r'''      function fits() { return shops.filter(function (s) { return s && s.src === "listed" && listedFits(s, item); }); }
      function put(found) {
        if (seq !== placeSeq || found.length <= shown) return;
        shown = found.length;
        var listed = shops.filter(function (s) { return s && s.src === "listed"; });''',
       r'''      var nearGeo = nearOf(geo, 80);
      function fits() { return shops.filter(function (s) { return s && s.src === "listed" && nearGeo(s) && listedFits(s, item); }); }
      function put(found) {
        if (seq !== placeSeq || found.length <= shown) return;
        shown = found.length;
        var listed = shops.filter(function (s) { return s && s.src === "listed" && nearGeo(s); });''')
rep(A, r'''          shops = shops.filter(function (s) { return s && s.src === "listed"; }).concat(pins);''',
       r'''          shops = shops.filter(function (s) { return s && s.src === "listed" && nearOf(pins[0], 80)(s); }).concat(pins);''')
rep(A, r'''        var listed = shops.filter(function (s) { return s && s.src === "listed"; });
        var next = uniqPlaces(listed.concat(packs[0], packs[1], packs[2]));''',
       r'''        var listed = shops.filter(function (s) { return s && s.src === "listed" && nearOf(here, 80)(s); });
        var next = uniqPlaces(listed.concat(packs[0], packs[1], packs[2]));''')

# ---- 2 + 3. dating is honest-empty and an explicit near-YOU ask uses the YOU point, before Grok or any carried place
rep(A, r'''    if (supportOn) { sendSupport(q, fromVoice); return; }
    if (runLine(q)) return;''', r'''    if (supportOn) { sendSupport(q, fromVoice); return; }
    if (datingAsk(q)) { honestDating(); return; }
    var nearItem = nearYouItem(q);
    if (nearItem) { hunt(nearItem, true); return; }
    if (runLine(q)) return;''')
rep(A, r'''  function hunt(q, nearYou) {
    q = String(q || "").trim();
    if (!q) return;''', r'''  function hunt(q, nearYou) {
    q = String(q || "").trim();
    if (!q) return;
    if (datingAsk(q)) { honestDating(); return; }
    var nearItem = nearYouItem(q);
    if (nearItem) { q = nearItem; nearYou = true; }''')
rep(A, r'''    if (act === "hunt" || act === "city" || act === "shop" || act === "now" || act === "pick") {
      var ask =''', r'''    if (act === "hunt" || act === "city" || act === "shop" || act === "now" || act === "pick") {
      if (datingAsk(q)) { honestDating(); return; }
      if (nearYouItem(q)) { hunt(nearYouItem(q), true); return; }
      var ask =''')
rep(I, r'''  body.message = message;
  body.allow_paid = true;''', r'''  if (/\bdating\b|\bdate\s+(app|site|someone)\b|\btinder\b|\bbumble\b|\bhinge\s+app\b|\bhook\s*-?\s*ups?\b|\b(girl|boy)friend\b|\bmeet\s+(a\s+)?(women|men|girls|guys|someone|singles?)\b|\bsingles\s+(near|in|around)\b|γνωριμ/i.test(message)) {
    // Dating is honest-empty: no listed dating profiles exist, so never a venue hunt and never a guessed person.
    const honest = 'Dating is empty on SpaceNet: nobody has listed a dating profile yet. No people and no venues are guessed.';
    res.status(200).json({ ok: true, text: honest, say: honest, act: 'talk', q: '', places: [], via: 'spacenet-honest' });
    return;
  }
  body.message = message;
  body.allow_paid = true;''')

# ---- 5. any new hunt / place / city ask closes an open vendor, driver or client sheet too
rep(A, r'''    if (sh && sh.classList.contains("on") && mid && /^FIND\b/.test(String(mid.textContent || ""))) closeSheet();''',
       r'''    if (sh && sh.classList.contains("on") && ((mid && /^FIND\b/.test(String(mid.textContent || ""))) || (sh.classList.contains("tile") && /^(vendor|driver|client)$/.test(sh.getAttribute("data-kind") || "")))) closeSheet();''')

# ---- 4. view paint on every camera settle, globe and map; first settle always pulls; a globe landing never strands the user
rep(A, r'''    if (!aim && here && isFinite(here.lat)) aim = { lat: here.lat, lng: here.lng };
    if (cityOn) return;
    if (dist <= 0.52 && aim && isFinite(aim.lat)) {
      viewMoved = true;
      openCity(aim);
      if (map) {
        try {
          map.setView([aim.lat, aim.lng], 14, { animate: false });
          map.flyTo([aim.lat, aim.lng], 16, { duration: 0.55 });
        } catch (e) {}
      }''', r'''    if (!aim && here && isFinite(here.lat)) aim = { lat: here.lat, lng: here.lng };
    if (cityOn) return;
    handView = true;
    queueViewPull();
    if (dist <= 0.52 && aim && isFinite(aim.lat)) {
      viewMoved = true;
      snapNext = true;
      openCity(aim);
      if (map) {
        try {
          map.setView([aim.lat, aim.lng], 14, { animate: false });
          map.flyTo([aim.lat, aim.lng], 16, { duration: 0.55 });
          // the wheel notches still spinning after the switch must not dive the map to z19
          map.scrollWheelZoom.disable();
          setTimeout(function () { try { if (map) map.scrollWheelZoom.enable(); } catch (e) {} }, 900);
        } catch (e) {}
      }''')
rep(A, r'''        if (mid && isFinite(mid.lat) && isFinite(mid.lng)) { aim = { lat: mid.lat, lng: mid.lng }; viewMoved = true; }''',
       r'''        if (mid && isFinite(mid.lat) && isFinite(mid.lng)) { aim = { lat: mid.lat, lng: mid.lng }; viewMoved = true; handView = true; queueViewPull(); }''')
rep(A, r'''      map.on("dragstart", function () { viewMoved = true; });''',
       r'''      map.on("dragstart", function () { viewMoved = true; handView = true; });
      el.addEventListener("wheel", function () { viewMoved = true; handView = true; }, { passive: true });''')
rep(A, r'''    paintShopsOnMap();
    setTimeout(function () { if (map) map.invalidateSize(); }, 80);
    queueViewPull();
  }
  var viewListed = [], viewAt = null, viewTimer = 0, viewBusy = 0;
  function queueViewPull() {
    clearTimeout(viewTimer);
    viewTimer = setTimeout(viewPull, 800);
  }
  function viewPull() {
    if (!map || !cityOn) return;
    var c;
    try { c = map.getCenter(); } catch (e) { return; }
    if (!c || !isFinite(c.lat) || !isFinite(c.lng)) return;
    var pt = { lat: c.lat, lng: c.lng };
    if (viewAt && haversineKm(viewAt, pt) < 5) return;
    viewAt = pt;
    var mine = ++viewBusy;
    fetchJson("/api/space?lat=" + pt.lat.toFixed(2) + "&lng=" + pt.lng.toFixed(2), { cache: "no-store" }, 12000).then(function (j) {
      if (mine !== viewBusy) return;
      if (!j || !j.ok) { viewAt = null; return; }
      viewListed = ((j.shops || []).map(function (r) { return asPlace(r, "listed"); })).filter(function (p) { return p && !junkPlace(p); });
      paintShopsOnMap();
    });
  }''', r'''    paintShopsOnMap();
    setTimeout(function () { if (map) map.invalidateSize(); }, 80);
    if (!wasOn) viewAt = null;
    queueViewPull();
  }
  var viewListed = [], viewAt = null, viewTimer = 0, viewBusy = 0, viewT = 0, handView = false, snapNext = false;
  function queueViewPull() {
    clearTimeout(viewTimer);
    viewTimer = setTimeout(viewPull, 800);
  }
  function viewPull() {
    // Every camera settle, globe or map: listed shops for what the user is looking at, from /api/space only (no Overpass).
    var pt = null;
    if (map && cityOn) {
      try { var c = map.getCenter(); pt = { lat: c.lat, lng: c.lng }; } catch (e) { return; }
    } else if (!cityOn) {
      pt = (view && globeHit(view.cx, view.cy, cam)) || aim;
    }
    if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) return;
    var hand = handView, snap = snapNext && cityOn;
    if (!hand && !snap && viewAt && haversineKm(viewAt, pt) < 2 && Date.now() - viewT < 60000) return;
    handView = false;
    if (snap) snapNext = false;
    viewAt = { lat: pt.lat, lng: pt.lng };
    viewT = Date.now();
    var mine = ++viewBusy;
    fetchJson("/api/space?lat=" + pt.lat.toFixed(2) + "&lng=" + pt.lng.toFixed(2), { cache: "no-store" }, 12000).then(function (j) {
      if (mine !== viewBusy) return;
      if (!j || !j.ok) { viewAt = null; return; }
      viewListed = ((j.shops || []).map(function (r) { return asPlace(r, "listed"); })).filter(function (p) { return p && !junkPlace(p); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
      if (!map || !cityOn) return;
      var b = null;
      try { b = map.getBounds(); } catch (e) {}
      var inView = b ? viewListed.filter(function (s) { return b.contains([s.lat, s.lng]); }) : [];
      if (snap && !inView.length) {
        var close = viewListed.filter(nearOf(pt, 40)).sort(function (a, b) { return haversineKm(pt, a) - haversineKm(pt, b); });
        if (close.length) {
          // the globe is coarse (1 px is ~15 km): move to the nearest listed cluster, never below z13 (z12.5 drops back to the globe)
          var group = close.filter(nearOf(close[0], 6)), shown = group.length;
          try {
            var fb = L.latLngBounds(group.map(function (s) { return [s.lat, s.lng]; })).pad(0.2);
            var z = Math.max(13.5, Math.min(15, map.getBoundsZoom(fb)));
            map.setView(fb.getCenter(), z, { animate: false });
            var nb = map.getBounds();
            shown = viewListed.filter(function (s) { return nb.contains([s.lat, s.lng]); }).length;
          } catch (e) {}
          say(close.length + " listed shop" + (close.length === 1 ? "" : "s") + " near where you landed; the map moved to them (" + shown + " in view). Tap one.");
          return;
        }
      }
      if ((hand || snap) && !foundView.length) {
        say(inView.length ? inView.length + " listed shop" + (inView.length === 1 ? "" : "s") + " in this view. Tap one, or name a shop or a service." : "No listed shop in this view. Pan, zoom out, or name a place.");
      }
    });
  }''')
rep(A, r'''    var el = $("city");
    if (!el || typeof L === "undefined" || !pt) return;
    cityOn = true;''', r'''    var el = $("city");
    if (!el || typeof L === "undefined" || !pt) return;
    var wasOn = cityOn;
    cityOn = true;''')
# globe wheel settles pull too (zoomToDist covers wheel + pinch); the LIVE ribbon counts the view's listed shops
rep(A, r'''    var vendors = 0, near = 0, drivers = 0, orders = 0;
    shops.forEach(function (s) {''', r'''    var vendors = 0, near = 0, drivers = 0, orders = 0, counted = {};
    shops.forEach(function (s) { if (s) counted[s.id || (s.name + s.lat)] = 1; });
    shops.concat((viewListed || []).filter(function (s) { return s && !counted[s.id || (s.name + s.lat)]; })).forEach(function (s) {''')
# a late boot fix after a hand move never rewrites the line
rep(A, r'''          if (!placeSeq) say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · " + shops.length + " places around you. Talk a hunt or tap a pin.");
        } else if (here && !cityOn) say(''', r'''          if (!placeSeq && !viewMoved) say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · " + shops.length + " places around you. Talk a hunt or tap a pin.");
        } else if (here && !cityOn && !viewMoved) say(''')
print('ok11')
