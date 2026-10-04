def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:70], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'
# a place-only ask (Athina, Rhodes) always lands through the client place path, never a pin dressed as a shop
rep(A,
r'''      if (ask && act === "city" && !ask.item && placeTown(ask.place)) { ask.raw = j.q || q; huntPlace(ask); return; }''',
r'''      if (ask && !ask.item && (placeTown(ask.place) || act !== "city")) { ask.raw = j.q || q; huntPlace(ask); return; }''')
rep(A,
r'''        var citySeq = ++placeSeq, cityGeo = { lat: +j.places[0].lat, lng: +j.places[0].lng, name: ask.place }, cityLine = j.say || j.text || ask.place + " on the map.";''',
r'''        var citySeq = ++placeSeq, cityGeo = { lat: +j.places[0].lat, lng: +j.places[0].lng, name: ask.place }, cityLine = j.say || j.text || ask.place + " on the map.";
        huntSeq++;
        closeFind();''')
# an old FIND sheet never stays up over a newer ask
rep(A,
r'''  var foundView = [];''',
r'''  var foundView = [];
  function closeFind() {
    var sh = $("sn-sheet"), mid = sh && sh.querySelector(".sheet-mid");
    if (sh && sh.classList.contains("on") && mid && /^FIND\b/.test(String(mid.textContent || ""))) closeSheet();
    foundView = [];
  }''')
rep(A,
r'''    if (named) { named.raw = q; huntPlace(named); return; }''',
r'''    if (named) { named.raw = q; huntPlace(named); return; }
    closeFind();''')
rep(A,
r'''  function huntPlace(ask) {
    var seq = ++placeSeq;
    huntSeq++;''',
r'''  function huntPlace(ask) {
    var seq = ++placeSeq;
    huntSeq++;
    closeFind();''')
print('ok9')
