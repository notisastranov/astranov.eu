def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:80], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'

# ---- honest location label: only a real GPS fix is called GPS
rep(A, r'''  function land(pt, open, keepView) {
    if (!keepView) intro = false;
    if (pt.how === "gps") {
      hereLive = { lat: pt.lat, lng: pt.lng };
      if (!adminPin) here = hereLive;
    } else if (pt.how === "admin") {
      adminPin = true;
      here = { lat: pt.lat, lng: pt.lng };
    } else if (!adminPin) {
      here = { lat: pt.lat, lng: pt.lng };
    }''', r'''  var hereHow = "";
  var userSpoke = false;
  var lastCat = "";
  function hereLabel() {
    if (!here) return "Location unknown";
    if (hereHow === "gps") return "GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    if (hereHow === "admin") return "Admin pin " + here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    if (hereHow === "saved") return "Saved location " + here.lat.toFixed(4) + "," + here.lng.toFixed(4);
    return "Approx. location (IP) " + here.lat.toFixed(2) + "," + here.lng.toFixed(2);
  }
  function land(pt, open, keepView, hush) {
    if (!keepView) intro = false;
    if (pt.how === "gps") {
      hereLive = { lat: pt.lat, lng: pt.lng };
      if (!adminPin) { here = hereLive; hereHow = "gps"; }
    } else if (pt.how === "admin") {
      adminPin = true;
      here = { lat: pt.lat, lng: pt.lng };
      hereHow = "admin";
    } else if (!adminPin) {
      here = { lat: pt.lat, lng: pt.lng };
      hereHow = pt.how === "saved" ? "saved" : "net";
    }''')
rep(A, r'''    var tag = pt.how === "net" ? "Network" : pt.how === "admin" ? "Admin pin" : pt.how === "saved" ? "Last fix" : "GPS";
    say(tag + " " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + (pt.name ? " · " + pt.name : "") + " · city");''', r'''    if (!hush) say(hereLabel() + (pt.name ? " · " + pt.name : "") + " · city");''')
# boot: a late location fix never overwrites what the user already asked
rep(A, r'''    locate(function (pt) { land(pt, false, placeSeq > 0 || viewMoved); }, true);''', r'''    locate(function (pt) { land(pt, false, placeSeq > 0 || viewMoved, userSpoke); }, true);''')
rep(A, r'''          if (!placeSeq && !viewMoved) say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · " + shops.length + " places around you. Talk a hunt or tap a pin.");
        } else if (here && !cityOn && !viewMoved) say("GPS " + here.lat.toFixed(4) + "," + here.lng.toFixed(4) + " · tap GPS for the city");''', r'''          if (!placeSeq && !viewMoved && !userSpoke) say(hereLabel() + " · " + shops.length + " places around you. Talk a hunt or tap a pin.");
        } else if (here && !cityOn && !viewMoved && !userSpoke) say(hereLabel() + " · tap GPS for the city");''')
rep(A, r'''    if (!view.length) { say("No real pin for that hunt. Try another name near GPS."); return; }''', r'''    if (!view.length) { say("No real pin for that hunt. Try another name near you."); return; }''')

# ---- bare near-me: around YOU, repeat the last category, never the last city
rep(A, r'''  function honestDating() {''', r'''  function bareNear(q) { return NEAR_YOU.test(String(q || "")) && !nearYouItem(q) && !datingAsk(q); }
  function nearYouBare() {
    huntSeq++;
    if (lastCat) { hunt(lastCat, true); return; }
    var seq = ++placeSeq;
    closeFind();
    materialize(true);
    var go = function () {
      if (seq !== placeSeq || !here) return;
      aim = { lat: here.lat, lng: here.lng };
      openCity(aim);
      try { if (map) map.setView([here.lat, here.lng], 15); } catch (e) {}
      say(hereLabel() + " · finding places around you…");
      huntNearby().then(function (rows) {
        if (seq !== placeSeq) return;
        var near = uniqPlaces((rows || []).concat(shops.filter(function (s) { return s && s.src === "listed"; }))).filter(nearOf(here, 5));
        if (!near.length) { say(hereLabel() + " · no real place found around you yet. Name a shop or a service."); return; }
        shops = uniqPlaces(near.concat(shops.filter(function (s) { return near.indexOf(s) < 0; })));
        showFound(null, near);
        say(hereLabel() + " · " + near.length + " real place" + (near.length === 1 ? "" : "s") + " around you. Tap one.");
      });
    };
    if (!here) locate(function (pt) { land(pt, false, true); go(); }); else go();
  }
  function honestDating() {''')
rep(A, r'''    if (!q) return;
    if (datingAsk(q)) { honestDating(); return; }
    var nearItem = nearYouItem(q);
    if (nearItem) { q = nearItem; nearYou = true; }
    var named = nearYou ? null : namedPlaceAsk(q, "");
    if (named) { named.raw = q; huntPlace(named); return; }
    closeFind();
    materialize(true);
    say("Finding " + q + "…");''', r'''    if (!q) return;
    if (datingAsk(q)) { honestDating(); return; }
    if (bareNear(q)) { nearYouBare(); return; }
    var nearItem = nearYouItem(q);
    if (nearItem) { q = nearItem; nearYou = true; }
    var named = nearYou ? null : namedPlaceAsk(q, "");
    if (named) { named.raw = q; huntPlace(named); return; }
    lastCat = cleanItem(q) || q;
    closeFind();
    materialize(true);
    say("Finding " + q + (nearYou ? " near YOU" : "") + "…");''')
rep(A, r'''        shops = next;
        showFound();
      });
    };
    if (!here) locate(function (pt) { land(pt, false); go(); });''', r'''        shops = next;
        showFound();
        if (nearYou && here) say(q.charAt(0).toUpperCase() + q.slice(1) + " near YOU (" + hereLabel() + "): " + foundView.length + " real pin" + (foundView.length === 1 ? "" : "s") + ". Tap one to order.");
      });
    };
    if (!here) locate(function (pt) { land(pt, false, true); go(); });''')
rep(A, r'''    var place = ask.place, item = ask.item;
    var fired = false;''', r'''    var place = ask.place, item = ask.item;
    if (item) lastCat = item;
    var fired = false;''')
rep(A, r'''      var ask = (act === "city" || act === "hunt" || act === "shop") ? (namedPlaceAsk(j.q, act) || namedPlaceAsk(q, act)) : null;''', r'''      if (bareNear(q)) { nearYouBare(); return; }
      var ask = (act === "city" || act === "hunt" || act === "shop") ? (namedPlaceAsk(j.q, act) || namedPlaceAsk(q, act)) : null;
      if (ask && ask.item) lastCat = ask.item;''')

# ---- talk: the user spoke (boot lines stay quiet), bare near-me never goes to Grok
rep(A, r'''    lastVoice = !!fromVoice;
    if (supportOn) { sendSupport(q, fromVoice); return; }
    if (datingAsk(q)) { honestDating(); return; }
    var nearItem = nearYouItem(q);
    if (nearItem) { hunt(nearItem, true); return; }''', r'''    lastVoice = !!fromVoice;
    userSpoke = true;
    if (supportOn) { sendSupport(q, fromVoice); return; }
    if (datingAsk(q)) { honestDating(); return; }
    if (bareNear(q)) { nearYouBare(); return; }
    var nearItem = nearYouItem(q);
    if (nearItem) { hunt(nearItem, true); return; }''')
print('ok14')
rep(A, r'''        mctx.fillText(here ? "GPS LOCK" : "GPS WAIT", 280, 18);''', r'''        mctx.fillText(!here ? "GPS WAIT" : hereHow === "gps" ? "GPS LOCK" : hereHow === "net" ? "IP APPROX" : "PIN", 280, 18);''')
print('ok14b')

# ---- reuse the boot "places around you" job for a bare near-me at the same YOU point
rep(A, r'''    if (!listingTried) {
      listingTried = true;
      huntNearby().then(function (rows) {''', r'''    if (!listingTried) {
      listingTried = true;
      nearbyAt = { lat: here.lat, lng: here.lng };
      nearbyJob = huntNearby();
      nearbyJob.then(function (rows) {''')
rep(A, r'''  function bareNear(q) {''', r'''  var nearbyJob = null, nearbyAt = null;
  function bareNear(q) {''')
rep(A, r'''      huntNearby().then(function (rows) {
        if (seq !== placeSeq) return;
        var near = uniqPlaces(''', r'''      var job = (nearbyJob && nearbyAt && haversineKm(nearbyAt, here) < 1) ? nearbyJob : huntNearby();
      job.then(function (rows) {
        if (seq !== placeSeq) return;
        var near = uniqPlaces(''')
# ---- a near-YOU hunt with nothing found still moves to YOU and says so (never stays on the last city)
rep(A, r'''        if (!next.length && shops.length) { paintShopsOnMap(); say("No real pin for " + q + ". Nothing new is shown; the " + shops.length + " already on the map stay."); return; }
        shops = next;''', r'''        if (nearYou && !next.length && here) {
          shops = shops.filter(nearOf(here, 80));
          aim = { lat: here.lat, lng: here.lng };
          openCity(aim);
          try { if (map) map.setView([here.lat, here.lng], 15); } catch (e) {}
          paintShopsOnMap();
          say("No real " + q + " pin near YOU (" + hereLabel() + ") yet. Try another name, or name a place.");
          return;
        }
        if (!next.length && shops.length) { paintShopsOnMap(); say("No real pin for " + q + ". Nothing new is shown; the " + shops.length + " already on the map stay."); return; }
        shops = next;''')
# ---- a greeting is talk: never a hunt, whatever act comes back
rep(A, r'''        var act = String(j.act || "talk").toLowerCase();
        if (act === "open")''', r'''        var act = String(j.act || "talk").toLowerCase();
        if (GREETING.test(q)) return;
        if (act === "open")''')
rep(A, r'''  function grokTalk(q) {''', r'''  var GREETING = /^\s*(hello|hi|hey|hiya|yo|sup|howdy|good\s+(morning|afternoon|evening|night)|thanks|thank\s+you|thx|ok|okay|bye|γεια(\s+σου|\s+σας)?|γειά(\s+σου|\s+σας)?|καλημέρα|καλησπέρα|καληνύχτα|ευχαριστώ)\s*[!.?]*\s*$/i;
  function grokTalk(q) {''')
print('ok14c')
