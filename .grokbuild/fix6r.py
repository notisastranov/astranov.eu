def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:60], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))

# ---- api/space.js: menu as JSON, not text
rep('api/space.js', 'menu:body->>menu,', 'menu:body->menu,')

# ---- api/ai.js: Rhodes means the town on Rhodes, not Rhodes in France
rep('api/ai.js',
r'''  if (/^(athens|athina|αθήνα|αθηνα)$/i.test(t)) t = 'Αθήνα, Ελλάδα';
  var ctl = new AbortController();''',
r'''  if (/^(athens|athina|αθήνα|αθηνα)$/i.test(t)) t = 'Αθήνα, Ελλάδα';
  var town = /^(rhodes|rodos|ρόδος|ροδος)(\s*,?\s*(greece|hellas|ελλάδα|ελλαδα))?$/i.test(t);
  if (town) t = 'Ρόδος';
  var ctl = new AbortController();''')
rep('api/ai.js',
r'''    var r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=' + encodeURIComponent(t), {''',
r'''    var r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=' + (town ? '5&countrycodes=gr&featuretype=city' : '1') + '&q=' + encodeURIComponent(t), {''')
rep('api/ai.js',
r'''    var g = Array.isArray(rows) && rows[0];
    if (!g || !isFinite(+g.lat) || !isFinite(+g.lon)) return null;''',
r'''    var g = Array.isArray(rows) && (rows.filter(function (x) { return x && /^(city|town|village)$/.test(String(x.addresstype || x.type || '')); })[0] || rows[0]);
    if (!g || !isFinite(+g.lat) || !isFinite(+g.lon)) return null;''')

A = 'js/spacenet/app.js'
# ---- asPlace: menu array or string, real phone, street; optional src
rep(A,
r'''  function asPlace(row) {
    if (!row) return null;''',
r'''  function realPhone(v) {
    var t = String(v || "").trim(), d = t.replace(/\D/g, "");
    if (d.length < 6 || /(\d)\1{5,}/.test(d)) return "";
    return t;
  }
  function menuLine(l) {
    var t = String(l || "").trim();
    if (!t) return null;
    var p = t.split(/\s*\|\s*|\s+[—–]\s+/).map(function (x) { return x.trim(); });
    if (p.length > 1) return { name: p[0], price: p[1] || "", qty: p[2] || "", when: p[3] || "" };
    var m = t.match(/^(.*?)[\s:·–-]+€?\s*(\d+(?:[.,]\d{1,2})?)\s*€?$/);
    return m && m[1] ? { name: m[1].trim(), price: m[2] } : { name: t };
  }
  function menuList(m) {
    if (Array.isArray(m)) return m.map(function (x) { return typeof x === "string" ? menuLine(x) : x; }).filter(function (x) { return x && typeof x === "object"; });
    if (m && typeof m === "object") return Array.isArray(m.items) ? menuList(m.items) : [];
    var s = String(m || "").trim();
    if (!s) return [];
    if (/^[\[{]/.test(s)) {
      try { var j = JSON.parse(s); if (Array.isArray(j) || (j && typeof j === "object")) return menuList(j); } catch (e) {}
    }
    return s.split(/\r?\n/).map(menuLine).filter(Boolean);
  }
  function asPlace(row, src) {
    if (!row) return null;''')
rep(A,
r'''      phone: row.phone || tags.phone || tags["contact:phone"] || "",
      menu: row.menu || [],
      photo: row.photo || "",
      src: row.src || "osm"
    };''',
r'''      phone: realPhone(row.phone || tags.phone || tags["contact:phone"] || ""),
      address: String(row.street || row.address || "").slice(0, 120),
      menu: menuList(row.menu),
      photo: row.photo || "",
      src: src || row.src || "osm"
    };''')
# ---- openVendor: one menu shape, no placeholder phone
rep(A,
r'''  function openVendor(s) {
    vendor = s;''',
r'''  function openVendor(s) {
    s.menu = menuList(s.menu);
    s.phone = realPhone(s.phone);
    vendor = s;''')
# ---- showFound pill: no placeholder phone
rep(A,
r'''(s.kind || "shop") + (s.phone ? " · " + s.phone : "") + (from ?''',
r'''(s.kind || "shop") + (realPhone(s.phone) ? " · " + realPhone(s.phone) : "") + (from ?''')
# ---- Rhodes geocodes to the town, not Rhodes in France or the island middle
rep(A,
r'''  function geocodePlace(place) {
    var url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&addressdetails=0&q=" + encodeURIComponent(placeQuery(place));
    return fetchJson(url, { headers: { Accept: "application/json" } }, 8000).then(function (rows) {
      var r = Array.isArray(rows) && rows[0];''',
r'''  function placeTown(place) {
    return /^(rhodes|rodos|ρόδος|ροδος)(\s*,?\s*(greece|hellas|ελλάδα|ελλαδα))?$/i.test(String(place || "").trim());
  }
  function geocodePlace(place) {
    var town = placeTown(place);
    var url = "https://nominatim.openstreetmap.org/search?format=json&limit=" + (town ? "5&countrycodes=gr&featuretype=city" : "1") + "&addressdetails=0&q=" + encodeURIComponent(town ? "Ρόδος" : placeQuery(place));
    return fetchJson(url, { headers: { Accept: "application/json" } }, 8000).then(function (rows) {
      var r = Array.isArray(rows) && (town ? (rows.filter(function (x) { return x && /^(city|town|village)$/.test(String(x.addresstype || x.type || "")); })[0] || rows[0]) : rows[0]);''')
# ---- seatPlace also pulls the real SpaceNet listings around the place
rep(A,
r'''    placeMark.bindTooltip(String(geo.name || "place"), { direction: "top", permanent: true });
  }''',
r'''    placeMark.bindTooltip(String(geo.name || "place"), { direction: "top", permanent: true });
  }
  var placePull = null;
  function pullPlaceListings(geo, seq) {
    var url = "/api/space?lat=" + Number(geo.lat).toFixed(2) + "&lng=" + Number(geo.lng).toFixed(2);
    placePull = fetchJson(url, { cache: "no-store" }, 12000).then(function (j) {
      if (seq !== placeSeq) return [];
      var rows = ((j && j.shops) || []).map(function (r) { return asPlace(r, "listed"); }).filter(Boolean);
      if (!rows.length) return [];
      var ids = {};
      rows.forEach(function (p) { ids[p.id] = 1; });
      shops = uniqPlaces(rows.concat(shops.filter(function (s) { return s && !ids[s.id]; })), geo);
      paintShopsOnMap();
      return rows;
    }).catch(function () { return []; });
    return placePull;
  }
  function listedFits(s, item) {
    var w = String(item || "").toLowerCase().split(/\s+/).filter(function (x) { return x.length > 2; });
    if (!w.length || !s) return false;
    var hay = [s.name, s.kind].concat((s.menu || []).map(function (m) { return m && m.name; })).join(" ").toLowerCase();
    return w.some(function (x) { return hay.indexOf(x.replace(/s$/, "")) >= 0; });
  }''')
# city act with a server place: seat it, then the listings
rep(A,
r'''      if (ask && act === "city" && j.places && j.places.length && isFinite(+j.places[0].lat) && isFinite(+j.places[0].lng) && !ask.item) {
        placeSeq++;
        seatPlace({ lat: +j.places[0].lat, lng: +j.places[0].lng, name: ask.place });
        say(j.say || j.text || ask.place + " on the map.");
        return;
      }''',
r'''      if (ask && act === "city" && j.places && j.places.length && isFinite(+j.places[0].lat) && isFinite(+j.places[0].lng) && !ask.item && !placeTown(ask.place)) {
        var citySeq = ++placeSeq, cityGeo = { lat: +j.places[0].lat, lng: +j.places[0].lng, name: ask.place }, cityLine = j.say || j.text || ask.place + " on the map.";
        seatPlace(cityGeo);
        say(cityLine);
        pullPlaceListings(cityGeo, citySeq).then(function (rows) {
          if (citySeq === placeSeq && rows.length) say(cityLine + " " + rows.length + " listed shop" + (rows.length === 1 ? "" : "s") + " on the map. Tap one.");
        });
        return;
      }''')
# huntPlace: listings with the place, listed rows that fit the ask go first
rep(A,
r'''      seatPlace(geo);
      if (!item) { if (fired) say(place + " on the map. Name a shop or a service to pin it here."); return; }
      say("Finding " + item + " in " + place + "…");
      var job = placeShops(item, place, geo), shown = 0;
      function put(found) {
        if (seq !== placeSeq || found.length <= shown) return;
        shown = found.length;
        var listed = shops.filter(function (s) { return s && s.src === "listed"; });
        shops = listed.concat(found);
        showFound(geo);
        fitPins(geo);
      }
      job.first.then(put);
      return job.all.then(function (found) {
        put(found);
        if (seq === placeSeq && !shown) say("No real " + item + " pin in " + place + " on OpenStreetMap yet.");
      });''',
r'''      seatPlace(geo);
      var pull = pullPlaceListings(geo, seq);
      if (!item) {
        if (fired) say(place + " on the map. Name a shop or a service to pin it here.");
        return pull.then(function (rows) {
          if (seq === placeSeq && rows.length) say(place + " on the map. " + rows.length + " listed shop" + (rows.length === 1 ? "" : "s") + " here. Tap one, or name a shop or a service.");
        });
      }
      say("Finding " + item + " in " + place + "…");
      var job = placeShops(item, place, geo), shown = 0;
      function fits() { return shops.filter(function (s) { return s && s.src === "listed" && listedFits(s, item); }); }
      function put(found) {
        if (seq !== placeSeq || found.length <= shown) return;
        shown = found.length;
        var listed = shops.filter(function (s) { return s && s.src === "listed"; });
        var good = listed.filter(function (s) { return listedFits(s, item); });
        shops = good.concat(listed.filter(function (s) { return !listedFits(s, item); }), found);
        showFound(geo);
        fitPins(geo);
      }
      job.first.then(put);
      return Promise.all([job.all, pull]).then(function (packs) {
        put(packs[0]);
        if (seq !== placeSeq) return;
        if (shown) { if (packs[1].length) { shown = 0; put(packs[0]); } return; }
        var good = fits();
        if (good.length) {
          shops = good.concat(shops.filter(function (s) { return good.indexOf(s) < 0; }));
          showFound(geo);
          say(good.length + " listed " + item + " pin" + (good.length === 1 ? "" : "s") + " in " + place + ". Tap one to order.");
          return;
        }
        var n = packs[1].length;
        say("No real " + item + " pin in " + place + " on OpenStreetMap yet." + (n ? " " + n + " listed shop" + (n === 1 ? "" : "s") + " on the map." : ""));
      });''')
print('ok')
rep(A,
r'''      shops.forEach(function (s) { if (isFinite(s.lat) && isFinite(s.lng)) b.extend([s.lat, s.lng]); });
      var z = Math.max(13''',
r'''      shops.forEach(function (s) { if (isFinite(s.lat) && isFinite(s.lng) && haversineKm(geo, s) <= 20) b.extend([s.lat, s.lng]); });
      var z = Math.max(13''')
print('ok2')
