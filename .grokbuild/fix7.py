def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:60], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'
# showFound: optional sheet list; pills keep their own snapshot so a late reorder never opens the wrong shop
rep(A,
r'''  function showFound(named) {
    if (!shops.length) { say("No real pin for that hunt. Try another name near GPS."); return; }
    var seat = named || here || shops[0];
    if (seat) openCity(seat);
    paintShopsOnMap();
    var html = shops.map(function (s, i) {''',
r'''  var foundView = [];
  function showFound(named, list) {
    var view = list && list.length ? list : shops;
    if (!view.length) { say("No real pin for that hunt. Try another name near GPS."); return; }
    foundView = view.slice();
    var seat = named || here || view[0];
    if (seat) openCity(seat);
    paintShopsOnMap();
    var html = view.map(function (s, i) {''')
rep(A,
r'''    openSheet("FIND · " + shops.length, html);
    var body = $("sn-sheet-body");
    if (body) {
      var pills = body.querySelectorAll(".pill");
      shops.forEach(function (s, i) {''',
r'''    openSheet("FIND · " + view.length, html);
    var body = $("sn-sheet-body");
    if (body) {
      var pills = body.querySelectorAll(".pill");
      view.forEach(function (s, i) {''')
rep(A,
r'''    say(shops.length + " real pin" + (shops.length === 1 ? "" : "s") + (named && named.name ? " in " + named.name : "") + ". Tap one to order.");''',
r'''    say(view.length + " real pin" + (view.length === 1 ? "" : "s") + (named && named.name ? " in " + named.name : "") + ". Tap one to order.");''')
rep(A,
r'''      if (act === "vendor" && isFinite(i) && shops[i]) openVendor(shops[i]);''',
r'''      if (act === "vendor" && isFinite(i) && (foundView[i] || shops[i])) openVendor(foundView[i] || shops[i]);''')
# huntPlace: the FIND sheet lists the hunt (fitting listed rows + found pins); other listed rows stay painted only
rep(A,
r'''        shops = good.concat(listed.filter(function (s) { return !listedFits(s, item); }), found);
        showFound(geo);
        fitPins(geo);''',
r'''        shops = good.concat(listed.filter(function (s) { return !listedFits(s, item); }), found);
        showFound(geo, good.concat(found));
        fitPins(geo);''')
rep(A,
r'''          shops = good.concat(shops.filter(function (s) { return good.indexOf(s) < 0; }));
          showFound(geo);''',
r'''          shops = good.concat(shops.filter(function (s) { return good.indexOf(s) < 0; }));
          showFound(geo, good);''')
# a city act for Rhodes always takes the client path (town geocode + listings), never a server pin as a shop
rep(A,
r'''      if (ask && act === "city" && j.places && j.places.length && isFinite(+j.places[0].lat) && isFinite(+j.places[0].lng) && !ask.item && !placeTown(ask.place)) {''',
r'''      if (ask && act === "city" && !ask.item && placeTown(ask.place)) { ask.raw = j.q || q; huntPlace(ask); return; }
      if (ask && act === "city" && j.places && j.places.length && isFinite(+j.places[0].lat) && isFinite(+j.places[0].lng) && !ask.item && !placeTown(ask.place)) {''')
# Grok pins for a far named ask: also paint the place listings, fitting ones join the sheet
rep(A,
r'''          showFound(far ? { lat: pins[0].lat, lng: pins[0].lng, name: ask.place } : undefined);
          return;''',
r'''          var farSeat = far ? { lat: pins[0].lat, lng: pins[0].lng, name: ask.place } : undefined, farSeq = placeSeq;
          showFound(farSeat);
          if (far) pullPlaceListings(farSeat, farSeq).then(function (rows) {
            if (farSeq !== placeSeq || !rows.length) return;
            var good = shops.filter(function (s) { return s && s.src === "listed" && ask.item && listedFits(s, ask.item); });
            showFound(farSeat, good.concat(shops.filter(function (s) { return pins.indexOf(s) >= 0 && good.indexOf(s) < 0; })));
          });
          return;''')
print('ok7')
