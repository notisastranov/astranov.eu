def rep(p, old, new, n=1):
    s = open(p, encoding="utf-8").read()
    assert s.count(old) == n, (p, old[:90], s.count(old))
    open(p, "w", encoding="utf-8").write(s.replace(old, new))
A = "js/spacenet/app.js"

# pullLive skips closed stages + junk names
rep(A, r'''        var stage = row.status || ride.stage || "";
        if (!isAdmin() && row.customerPeer !== me() && row.peer !== me()) return;
        var existing = null;
        jobs.forEach(function (job) { if (job && job.id === row.id) existing = job; });
        if (!existing) {
          jobs.push({
            id: row.id, live: true,
            vendor: { name: String(row.name || "order").split(" → ")[0], lat: +ride.vlat || +row.lat, lng: +ride.vlng || +row.lng, owner: row.peer || "" },
            drop: { lat: +ride.dlat || +row.lat, lng: +ride.dlng || +row.lng, name: "client" },
            fee: row.avc || 0,
            driver: ride.driver || row.flag || "",
            client: row.customerPeer || "",
            vendorOwner: row.peer || "",
            ready: stage !== "order" && stage !== "",
            pickup: stage === "pickup" || stage === "on-bike" || stage === "delivered" || stage === "received",
            got: stage === "on-bike" || stage === "delivered" || stage === "received",
            delivered: stage === "delivered" || stage === "received",
            received: stage === "received",
            t: ride.t || Date.now()
          });
        } else if (existing.live) {
          existing.got = stage === "on-bike" || stage === "delivered" || stage === "received";
          existing.delivered = stage === "delivered" || stage === "received";
          existing.received = stage === "received";
          if (liveLines[row.id]) { try { map.removeLayer(liveLines[row.id]); } catch (e) {} delete liveLines[row.id]; }
        }''', r'''        var stage = String(row.status || ride.stage || "").toLowerCase();
        if (!isAdmin() && row.customerPeer !== me() && row.peer !== me()) return;
        if (junkPlace({ name: row.name, phone: row.phone }) || /v4297/i.test(String(row.name || ""))) return;
        var existing = null;
        jobs.forEach(function (job) { if (job && job.id === row.id) existing = job; });
        var closed = stage === "received" || stage === "released" || stage === "done" || stage === "cancelled" || stage === "delivered";
        if (!existing) {
          if (closed) return;
          jobs.push({
            id: row.id, live: true, status: stage,
            vendor: { name: String(row.name || "order").split(" → ")[0], lat: +ride.vlat || +row.lat, lng: +ride.vlng || +row.lng, owner: row.peer || "" },
            drop: { lat: +ride.dlat || +row.lat, lng: +ride.dlng || +row.lng, name: "client" },
            fee: row.avc || 0,
            driver: ride.driver || row.flag || "",
            client: row.customerPeer || "",
            vendorOwner: row.peer || "",
            ready: stage !== "order" && stage !== "",
            pickup: stage === "pickup" || stage === "on-bike" || stage === "delivered" || stage === "received",
            got: stage === "on-bike" || stage === "delivered" || stage === "received",
            delivered: stage === "delivered" || stage === "received",
            received: stage === "received",
            t: ride.t || Date.now()
          });
        } else if (existing.live) {
          existing.status = stage;
          existing.got = stage === "on-bike" || stage === "delivered" || stage === "received";
          existing.delivered = stage === "delivered" || stage === "received";
          existing.received = closed || stage === "received";
          if (liveLines[row.id]) { try { map.removeLayer(liveLines[row.id]); } catch (e) {} delete liveLines[row.id]; }
        }''')

# ---- (e) LIVE order count: only real open orders; label live vs this device; never count TESTER
rep(A, r'''    people.forEach(function (p) { if (p && p.role === "driver" && seesDriver(p)) drivers++; });
    if (driverPin && isFinite(+driverPin.lat) && !people.some(function (p) { return p && p.role === "driver" && haversineKm(p, driverPin) < 0.05; })) drivers++;
    jobs.forEach(function (j) { if (j && !j.received && seesJob(j)) orders++; });
    var place = here && near ? near + " vendor" + (near === 1 ? "" : "s") + " here" : vendors + " vendor" + (vendors === 1 ? "" : "s");
    el.textContent = "LIVE · " + place + " · " + drivers + " driver" + (drivers === 1 ? "" : "s") + " · " + orders + " order" + (orders === 1 ? "" : "s");
    paintJobsChip();
  }
  function paintJobsChip() {
    var open = 0;
    jobs.forEach(function (j) { if (j && !j.received && seesJob(j)) open++; });''', r'''    people.forEach(function (p) { if (p && p.role === "driver" && seesDriver(p) && !junkPlace(p)) drivers++; });
    if (driverPin && isFinite(+driverPin.lat) && !junkPlace(driverPin) && !people.some(function (p) { return p && p.role === "driver" && haversineKm(p, driverPin) < 0.05; })) drivers++;
    var liveN = 0, localN = 0;
    jobs.forEach(function (j) {
      if (!j || jobClosed(j) || !seesJob(j) || isTestJob(j)) return;
      if (j.live) liveN++; else localN++;
      orders++;
    });
    var place = here && near ? near + " vendor" + (near === 1 ? "" : "s") + " here" : vendors + " vendor" + (vendors === 1 ? "" : "s");
    var orderBit = !orders ? "0 open orders" : (liveN && localN ? liveN + " live · " + localN + " on this device" : liveN ? liveN + " live order" + (liveN === 1 ? "" : "s") : localN + " on this device");
    el.textContent = "LIVE · " + place + " · " + drivers + " driver" + (drivers === 1 ? "" : "s") + " · " + orderBit;
    paintJobsChip();
  }
  function paintJobsChip() {
    var open = 0;
    jobs.forEach(function (j) { if (j && !jobClosed(j) && seesJob(j)) open++; });''')

rep(A, r'''      (j.shops || []).forEach(function (s) {
        if (!s || !s.id || !isFinite(+s.lat)) return;
        var have = null;
        shops.forEach(function (x) { if (x && x.id === s.id) have = x; });
        if (have) { have.owner = have.owner || s.customerPeer || ""; have.peer = have.peer || s.peer || ""; return; }
        shops.unshift({ id: s.id, name: s.name || "vendor", lat: +s.lat, lng: +s.lng, phone: s.phone || "", src: "live", status: s.status || "live", owner: s.customerPeer || "", peer: s.peer || "" });
      });
      (j.drivers || []).forEach(function (d) {
        if (!d || !d.id || !isFinite(+d.lat)) return;''', r'''      (j.shops || []).forEach(function (s) {
        if (!s || !s.id || !isFinite(+s.lat) || junkPlace(s)) return;
        var have = null;
        shops.forEach(function (x) { if (x && x.id === s.id) have = x; });
        if (have) { have.owner = have.owner || s.customerPeer || ""; have.peer = have.peer || s.peer || ""; return; }
        shops.unshift({ id: s.id, name: s.name || "vendor", lat: +s.lat, lng: +s.lng, phone: s.phone || "", src: "live", status: s.status || "live", owner: s.customerPeer || "", peer: s.peer || "" });
      });
      (j.drivers || []).forEach(function (d) {
        if (!d || !d.id || !isFinite(+d.lat) || junkPlace(d)) return;''')

rep(A, r'''  function cardsNow() {
    var rows = BRIEF.slice();
    var n = 0;
    jobs.forEach(function (j) { if (j && !j.received && seesJob(j)) n++; });
    if (n) rows.unshift({ k: "NOTICE", t: n + " open order" + (n === 1 ? "" : "s") });
    return rows;
  }''', r'''  function cardsNow() {
    var rows = BRIEF.slice();
    var liveN = 0, localN = 0;
    jobs.forEach(function (j) {
      if (!j || jobClosed(j) || !seesJob(j) || isTestJob(j)) return;
      if (j.live) liveN++; else localN++;
    });
    var n = liveN + localN;
    if (n) {
      var t = liveN && localN ? liveN + " live · " + localN + " on this device" : liveN ? liveN + " live open order" + (liveN === 1 ? "" : "s") : localN + " open on this device";
      rows.unshift({ k: "NOTICE", t: t });
    }
    return rows;
  }''')
rep(A, r'''  function paintTester(items) {
    var it = null;
    (items || []).forEach(function (x) { if (x && (x.kind === "tester" || x.id === "tester-live")) it = x; });
    var el = $("sn-tester");
    if (!el) {
      el = document.createElement("div");
      el.id = "sn-tester";
      document.body.appendChild(el);
    }
    if (!it) { el.textContent = "TESTER · no check yet"; el.classList.add("stale"); return; }
    var mins = Math.max(0, Math.round((Date.now() - Number(it.t || 0)) / 60000));
    el.classList.toggle("stale", mins > 20);
    el.textContent = "TESTER · " + (mins < 1 ? "now" : mins + "m") + " · " + (it.note || it.title || "checking");
    var bits = String(it.ref || "").split(",");
    var lat = Number(bits[0]), lng = Number(bits[1]);
    if (!map || typeof L === "undefined" || !isFinite(lat) || !isFinite(lng)) return;
    var ll = [lat, lng];
    if (!testerMark) {
      testerMark = L.circleMarker(ll, { radius: 6, color: "#d6ff4a", fillColor: "#d6ff4a", fillOpacity: 0.95, weight: 2 }).addTo(map);
      testerMark.bindTooltip("TESTER", { permanent: true, direction: "right", className: "sn-tester-tip" });
    } else testerMark.setLatLng(ll);
  }''', r'''  function paintTester(items) {
    var el = $("sn-tester");
    if (!isAdmin()) {
      if (el) { el.hidden = true; el.textContent = ""; }
      if (testerMark && map) { try { map.removeLayer(testerMark); } catch (e) {} testerMark = null; }
      return;
    }
    var it = null;
    (items || []).forEach(function (x) { if (x && (x.kind === "tester" || x.id === "tester-live")) it = x; });
    if (!el) {
      el = document.createElement("div");
      el.id = "sn-tester";
      document.body.appendChild(el);
    }
    el.hidden = false;
    if (!it) { el.textContent = "TESTER · no check yet"; el.classList.add("stale"); return; }
    var mins = Math.max(0, Math.round((Date.now() - Number(it.t || 0)) / 60000));
    el.classList.toggle("stale", mins > 20);
    el.textContent = "TESTER · " + (mins < 1 ? "now" : mins + "m") + " · " + (it.note || it.title || "checking");
    var bits = String(it.ref || "").split(",");
    var lat = Number(bits[0]), lng = Number(bits[1]);
    if (!map || typeof L === "undefined" || !isFinite(lat) || !isFinite(lng)) return;
    var ll = [lat, lng];
    if (!testerMark) {
      testerMark = L.circleMarker(ll, { radius: 6, color: "#d6ff4a", fillColor: "#d6ff4a", fillOpacity: 0.95, weight: 2 }).addTo(map);
      testerMark.bindTooltip("TESTER", { permanent: true, direction: "right", className: "sn-tester-tip" });
    } else testerMark.setLatLng(ll);
  }''')
print("ok18d")
