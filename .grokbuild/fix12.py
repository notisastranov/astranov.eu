def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:80], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'
S = 'api/space.js'

# ---- api/space: optional radius r (5..150 km, default 80) so a globe landing can find the nearest listed cluster
rep(S, r'''    if (String(q.lat) !== wantLat || String(q.lng) !== wantLng || q.peer != null) {
      setCache(res, CDN_GET);
      res.setHeader("Location", "/api/space?lat=" + wantLat + "&lng=" + wantLng);''', r'''    const R = Math.max(5, Math.min(150, Math.round(Number(q.r) || 80)));
    if (String(q.lat) !== wantLat || String(q.lng) !== wantLng || q.peer != null || (q.r != null && String(q.r) !== String(R))) {
      setCache(res, CDN_GET);
      res.setHeader("Location", "/api/space?lat=" + wantLat + "&lng=" + wantLng + (R !== 80 ? "&r=" + R : ""));''')
rep(S, r'''    const memKey = wantLat + "," + wantLng;''', r'''    const memKey = wantLat + "," + wantLng + "," + R;''')
rep(S, r'''      if (km > 80) return;''', r'''      if (km > R) return;''')

# ---- globe wheel / pinch zooms toward the point under the cursor or fingers, not the stale centre
rep(A, r'''      var nz = Math.max(13, Math.min(19, z + (dir < 0 ? 0.7 : -0.7)));
      try { map.flyTo(map.getCenter(), nz, { duration: 0.28 }); } catch (e) { try { map.setZoom(nz); } catch (e2) {} }
      return;
    }
    zoomToDist(cam.dist * (dir < 0 ? 0.88 : 1.14), sx, sy);''', r'''      var nz = Math.max(13, Math.min(19, z + (dir < 0 ? 0.7 : -0.7)));
      try { map.flyTo(map.getCenter(), nz, { duration: 0.28 }); } catch (e) { try { map.setZoom(nz); } catch (e2) {} }
      return;
    }
    if (dir < 0 && sx != null && Date.now() - wheelAt > 500) aimAt(sx, sy);
    wheelAt = Date.now();
    zoomToDist(cam.dist * (dir < 0 ? 0.88 : 1.14), sx, sy);''')
rep(A, r'''  function stepTier(dir, sx, sy) { zoomSmooth(dir, sx, sy); }''', r'''  var wheelAt = 0;
  function aimAt(sx, sy) {
    // a new wheel or pinch gesture zooms toward the globe point under the cursor / between the fingers
    var hit = globeHit(sx, sy, cam);
    if (hit && isFinite(hit.lat) && isFinite(hit.lng)) { aim = { lat: hit.lat, lng: hit.lng }; viewMoved = true; }
  }
  function stepTier(dir, sx, sy) { zoomSmooth(dir, sx, sy); }''')
rep(A, r'''        pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        drag = null;''', r'''        pinch = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (!cityOn) aimAt((pts[0].x + pts[1].x) / 2, (pts[0].y + pts[1].y) / 2);
        drag = null;''')

# ---- a globe landing never ends blank: valid centre, tiles, ease up to 150 km to the nearest listed cluster, else stay with tiles + honest hint
rep(A, r'''    if (map && cityOn) {
      try { var c = map.getCenter(); pt = { lat: c.lat, lng: c.lng }; } catch (e) { return; }
    } else if (!cityOn) {''', r'''    if (map && cityOn) {
      try { var c = map.getCenter(); pt = { lat: c.lat, lng: c.lng }; } catch (e) { pt = null; }
      if (!pt || !isFinite(pt.lat) || !isFinite(pt.lng)) {
        var safe = (aim && isFinite(aim.lat) && isFinite(aim.lng)) ? aim : here;
        if (!safe || !isFinite(safe.lat)) return;
        try { map.invalidateSize(); map.setView([safe.lat, safe.lng], 14, { animate: false }); } catch (e) {}
        pt = { lat: safe.lat, lng: safe.lng };
      }
    } else if (!cityOn) {''')
rep(A, r'''    fetchJson("/api/space?lat=" + pt.lat.toFixed(2) + "&lng=" + pt.lng.toFixed(2), { cache: "no-store" }, 12000).then(function (j) {
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
    });''', r'''    if (snap && map) setTimeout(function () { try { if (map && cityOn) map.invalidateSize(); } catch (e) {} }, 350);
    fetchJson("/api/space?lat=" + pt.lat.toFixed(2) + "&lng=" + pt.lng.toFixed(2) + (snap ? "&r=150" : ""), { cache: "no-store" }, 12000).then(function (j) {
      if (mine !== viewBusy) return;
      if (!j || !j.ok) { viewAt = null; return; }
      viewListed = ((j.shops || []).map(function (r) { return asPlace(r, "listed"); })).filter(function (p) { return p && !junkPlace(p); });
      paintShopsOnMap();
      try { paintPulse(); } catch (e) {}
      if (!map || !cityOn) return;
      var b = null;
      try { b = map.getBounds(); } catch (e) {}
      var inView = b ? viewListed.filter(function (s) { return b.contains([s.lat, s.lng]); }) : [];
      var at = pt.lat.toFixed(2) + "," + pt.lng.toFixed(2);
      if (snap && !inView.length) {
        var close = viewListed.filter(nearOf(pt, 150)).sort(function (a, b) { return haversineKm(pt, a) - haversineKm(pt, b); });
        if (close.length) {
          // the globe is coarse (1 px is ~10-15 km): ease to the nearest listed cluster, zoom 13..15 (z12.5 drops back to the globe)
          // prefer a real cluster over a lone pin when it is at most 15 km farther than the nearest one
          var d0 = haversineKm(pt, close[0]), best = close[0], bestN = 0;
          close.forEach(function (c) {
            if (haversineKm(pt, c) > d0 + 15) return;
            var n = close.filter(nearOf(c, 6)).length;
            if (n > bestN) { best = c; bestN = n; }
          });
          var group = close.filter(nearOf(best, 6)), shown = group.length, far = haversineKm(pt, best);
          var towns = {}, town = "";
          group.forEach(function (g) { var t = String(g.address || "").split(",").pop().trim(); if (t && !/\d/.test(t)) towns[t] = (towns[t] || 0) + 1; });
          Object.keys(towns).forEach(function (t) { if (!town || towns[t] > towns[town]) town = t; });
          town = town || best.name || "the nearest listed shop";
          try {
            var fb = L.latLngBounds(group.map(function (s) { return [s.lat, s.lng]; })).pad(0.2);
            var z = Math.max(13, Math.min(15, map.getBoundsZoom(fb)));
            map.setView(fb.getCenter(), z, { animate: false });
            var nb = map.getBounds();
            shown = viewListed.filter(function (s) { return nb.contains([s.lat, s.lng]); }).length;
          } catch (e) {}
          say("Nothing listed where you landed (" + at + "). Moved " + Math.round(far) + " km to " + town + ": " + shown + " listed shop" + (shown === 1 ? "" : "s") + " in view, e.g. " + best.name + ". Tap one.");
          return;
        }
        // nothing within 150 km: stay, but wide enough that coast and roads show, never a blank deep zoom
        try { if (map.getZoom() > 13) map.setView([pt.lat, pt.lng], 13, { animate: false }); } catch (e) {}
        say("No listed shop within 150 km of " + at + ". Pan, zoom out, or name a place.");
        return;
      }
      if ((hand || snap) && !foundView.length) {
        say(inView.length ? inView.length + " listed shop" + (inView.length === 1 ? "" : "s") + " in this view. Tap one, or name a shop or a service." : "No listed shop in this view (" + at + "). Pan, zoom out, or name a place.");
      }
    });''')
print('ok12')
