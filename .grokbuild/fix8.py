def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:70], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'
# ---- api/space.js: test or placeholder rows never leave the server
rep('api/space.js',
r'''function fromRow(row) {''',
r'''function junkRow(b) {
  var d = String((b && b.phone) || "").replace(/\D/g, "");
  return /\btest\s*(vendor|driver|client)\b/i.test(String((b && b.name) || "")) || (d.length >= 6 && /^0+$/.test(d));
}

function fromRow(row) {''')
rep('api/space.js',
r'''      const body = fromRow(row);
      if (!body) return;''',
r'''      const body = fromRow(row);
      if (!body || junkRow(body)) return;''')
# ---- client: one junk test, used by seesShop (paint, pulse, roster, world) and uniqPlaces (every hunt)
rep(A,
r'''  function seesShop(s) {
    if (!s || s.status === "denied") return false;''',
r'''  function junkPlace(s) {
    if (!s) return true;
    var d = String(s.phone || "").replace(/\D/g, "");
    return /\btest\s*(vendor|driver|client)\b/i.test(String(s.name || "")) || (d.length >= 6 && /^0+$/.test(d));
  }
  function seesShop(s) {
    if (!s || s.status === "denied" || junkPlace(s)) return false;''')
rep(A,
r'''      if (!p || !isFinite(p.lat) || !isFinite(p.lng) || !p.name) return;''',
r'''      if (!p || !isFinite(p.lat) || !isFinite(p.lng) || !p.name || junkPlace(p)) return;''')
# ---- no shop is ever injected into a hunt result: the tapped vendor stays painted, not listed as found
rep(A,
r'''    return listed.concat(out.slice(0, 8)).concat(vendor && vendor.id && !listed.concat(out).some(function (p) { return p && p.id === vendor.id; }) ? [vendor] : []);''',
r'''    return listed.concat(out.slice(0, 8));''')
rep(A,
r'''    shopMarks = [];
    shops.forEach(function (s) {
      if (!isFinite(s.lat) || !isFinite(s.lng)) return;''',
r'''    shopMarks = [];
    var have = {};
    shops.forEach(function (s) { if (s) have[s.id || (s.name + s.lat)] = 1; });
    var extra = (viewListed || []).concat(vendor ? [vendor] : []).filter(function (s) {
      var k = s && (s.id || (s.name + s.lat));
      if (!s || have[k]) return false;
      have[k] = 1;
      return true;
    });
    shops.concat(extra).forEach(function (s) {
      if (!s || !isFinite(s.lat) || !isFinite(s.lng)) return;''')
# ---- the city view paints real listings from /api/space on every settle; no Overpass needed
rep(A,
r'''      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, minZoom: 12 }).addTo(map);''',
r'''      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, minZoom: 12 }).addTo(map);
      map.on("moveend", queueViewPull);''')
rep(A,
r'''    paintShopsOnMap();
    setTimeout(function () { if (map) map.invalidateSize(); }, 80);
  }''',
r'''    paintShopsOnMap();
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
  }''')
# ---- a late hunt never resurfaces a stale FIND sheet over a newer ask
rep(A,
r'''    materialize(true);
    say("Finding " + q + "…");
    var go = function () {
      Promise.all([huntApi(q), huntNominatim(q), huntOverpass(q)]).then(function (packs) {
        var listed = shops.filter(function (s) { return s && s.src === "listed"; });
        var next = uniqPlaces(listed.concat(packs[0], packs[1], packs[2]));
        if (!next.length && shops.length) { paintShopsOnMap(); say("No new pin for " + q + ". Kept the " + shops.length + " already on the map."); return; }''',
r'''    materialize(true);
    say("Finding " + q + "…");
    var hs = ++huntSeq, ps = placeSeq;
    var go = function () {
      Promise.all([huntApi(q), huntNominatim(q), huntOverpass(q)]).then(function (packs) {
        if (hs !== huntSeq || ps !== placeSeq) return;
        var listed = shops.filter(function (s) { return s && s.src === "listed"; });
        var next = uniqPlaces(listed.concat(packs[0], packs[1], packs[2]));
        if (!next.length && shops.length) { paintShopsOnMap(); say("No real pin for " + q + ". Nothing new is shown; the " + shops.length + " already on the map stay."); return; }''')
rep(A,
r'''  var placeMark = null;
  var placeSeq = 0;''',
r'''  var placeMark = null;
  var placeSeq = 0;
  var huntSeq = 0;''')
# named place hunts also retire an older near-YOU hunt
rep(A,
r'''  function huntPlace(ask) {
    var seq = ++placeSeq;''',
r'''  function huntPlace(ask) {
    var seq = ++placeSeq;
    huntSeq++;''')
print('ok8')
