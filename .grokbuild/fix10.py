def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:70], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'
# once the user moves the view by hand, a late boot fix (IP or GPS) never pulls the city back to YOU
rep(A, r'''  var vendor = null;''', r'''  var vendor = null;
  var viewMoved = false;''')
rep(A, r'''        if (mid && isFinite(mid.lat) && isFinite(mid.lng)) aim = { lat: mid.lat, lng: mid.lng };''',
       r'''        if (mid && isFinite(mid.lat) && isFinite(mid.lng)) { aim = { lat: mid.lat, lng: mid.lng }; viewMoved = true; }''')
rep(A, r'''    if (dist <= 0.52 && aim && isFinite(aim.lat)) {''', r'''    if (dist <= 0.52 && aim && isFinite(aim.lat)) {
      viewMoved = true;''')
rep(A, r'''      map.on("moveend", queueViewPull);''', r'''      map.on("moveend", queueViewPull);
      map.on("dragstart", function () { viewMoved = true; });''')
rep(A, r'''    locate(function (pt) { land(pt, false, placeSeq > 0); }, true);''',
       r'''    locate(function (pt) { land(pt, false, placeSeq > 0 || viewMoved); }, true);''')
print('ok10')
