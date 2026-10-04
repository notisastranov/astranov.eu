def rep(p, old, new, n=1):
    s = open(p, encoding='utf-8').read()
    assert s.count(old) == n, (p, old[:80], s.count(old))
    open(p, 'w', encoding='utf-8').write(s.replace(old, new))
A = 'js/spacenet/app.js'

# ---- (e) one honest POST path: never an empty Authorization header; a guest / tokenless / refused save says so
rep(A, r'''  function persistListing(row) {
    if (!row) return;
    row.id = row.id || (String(row.kind || "x")[0] + Date.now().toString(36));
    function stash(list) {
      localStorage.setItem("sn:mine", JSON.stringify(list.slice(0, 40)));
    }''', r'''  var localOnlyAt = 0;
  function localOnlyNote() {
    if (Date.now() - localOnlyAt < 800) return;
    localOnlyAt = Date.now();
    setTimeout(function () {
      var note = "Saved on this device only, sign in to publish.";
      var el = $("line");
      var cur = el ? String(el.textContent || "").trim() : "";
      if (cur.indexOf(note) >= 0) return;
      say(cur && cur.length < 90 ? cur + " · " + note : note);
    }, 0);
  }
  function postSpace(row) {
    var t = authToken();
    if (!t) { localOnlyNote(); return; }
    fetch("/api/space", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ row: row })
    }).then(function (r) { if (r && r.status === 401) localOnlyNote(); }).catch(function () {});
  }
  function sameOwnerName(a, role, owner, key) {
    return !!(a && (a.role || "") === role && (a.owner || "") === owner && String(a.name || "").trim().toLowerCase() === key);
  }
  function dedupePeople(list) {
    var seen = {}, ids = {};
    return (list || []).filter(function (p) {
      if (!p) return false;
      if (p.id) { if (ids[p.id]) return false; ids[p.id] = 1; }
      if (!p.owner || !p.name || (p.role !== "driver" && p.role !== "client")) return true;
      var k = p.role + "|" + p.owner + "|" + String(p.name).trim().toLowerCase();
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    });
  }
  function dedupeMine() {
    try {
      var mine = JSON.parse(localStorage.getItem("sn:mine") || "[]") || [];
      var seen = {};
      var kept = mine.filter(function (r) {
        if (!r) return false;
        if ((r.kind !== "driver" && r.kind !== "drop") || !r.owner || !r.name) return true;
        var k = r.kind + "|" + r.owner + "|" + String(r.name).trim().toLowerCase();
        if (seen[k]) return false;
        seen[k] = 1;
        return true;
      });
      if (kept.length !== mine.length) localStorage.setItem("sn:mine", JSON.stringify(kept));
    } catch (e) {}
  }
  function dropMineDups(kind, owner, key, keepId) {
    try {
      var mine = JSON.parse(localStorage.getItem("sn:mine") || "[]") || [];
      var kept = mine.filter(function (r) { return !(r && r.kind === kind && r.id !== keepId && (r.owner || "") === owner && String(r.name || "").trim().toLowerCase() === key); });
      if (kept.length !== mine.length) localStorage.setItem("sn:mine", JSON.stringify(kept));
    } catch (e) {}
  }
  function persistListing(row) {
    if (!row) return;
    row.id = row.id || (String(row.kind || "x")[0] + Date.now().toString(36));
    function stash(list) {
      var own = list.filter(function (r) { return r && (r.kind === "shop" || r.place); });
      var rest = list.filter(function (r) { return r && !(r.kind === "shop" || r.place); });
      localStorage.setItem("sn:mine", JSON.stringify(own.concat(rest).slice(0, 40)));
    }''')
rep(A, r'''    if (!signed()) return;
    if (!row.customerPeer) row.customerPeer = me();
    var pub = {};
    Object.keys(row).forEach(function (k) { if (k !== "photo") pub[k] = row[k]; });
    var t = authToken();
    fetch("/api/space", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: t ? "Bearer " + t : "" },
      body: JSON.stringify({ row: pub })
    }).catch(function () {});
  }''', r'''    if (!signed()) { localOnlyNote(); return; }
    if (!row.customerPeer) row.customerPeer = me();
    var pub = {};
    Object.keys(row).forEach(function (k) { if (k !== "photo") pub[k] = row[k]; });
    postSpace(pub);
  }''')
rep(A, r'''  function publishRow(row) {
    if (!row || !row.id) return;
    var t = authToken();
    if (!t) return;
    fetch("/api/space", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + t },
      body: JSON.stringify({ row: row })
    }).catch(function () {});
  }''', r'''  function publishRow(row) {
    if (!row || !row.id) return;
    postSpace(row);
  }''')
rep(A, r'''    var t = authToken();
    fetch("/api/space", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: t ? "Bearer " + t : "" },
      body: JSON.stringify({ row: { id: job.id, kind: "job", lat: drop.lat, lng: drop.lng, name: vendor.name, avc: q.total } })
    }).catch(function () {});''', r'''    postSpace({ id: job.id, kind: "job", lat: drop.lat, lng: drop.lng, name: vendor.name, avc: q.total });''')

# ---- (a) driver / client re-list: same owner + kind + name reuses the id, other local copies go
rep(A, r'''        function val(id) { var el = $(id); return el ? String(el.value || "").trim() : ""; }
        var drv = {
          id: "r" + Date.now().toString(36),''', r'''        function val(id) { var el = $(id); return el ? String(el.value || "").trim() : ""; }
        var drvOwner = me(), drvKey = drvName.toLowerCase();
        var drvPrev = people.filter(function (p) { return sameOwnerName(p, "driver", drvOwner, drvKey) && p.id !== "pin"; })[0];
        if (!drvPrev) try {
          drvPrev = (JSON.parse(localStorage.getItem("sn:mine") || "[]") || []).filter(function (r) { return r && r.kind === "driver" && (r.owner || "") === drvOwner && String(r.name || "").trim().toLowerCase() === drvKey; })[0];
        } catch (e) {}
        var drv = {
          id: (drvPrev && drvPrev.id) || "r" + Date.now().toString(36),''')
rep(A, r'''        persistListing(drv);
        people = people.filter(function (p) { return !p || p.id !== drv.id; });''', r'''        persistListing(drv);
        dropMineDups("driver", drvOwner, drvKey, drv.id);
        people = people.filter(function (p) { return !p || (p.id !== drv.id && !sameOwnerName(p, "driver", drvOwner, drvKey)); });''')
rep(A, r'''        var did = "d" + Date.now().toString(36);''', r'''        var dOwner = me(), dKey = String(dname || "home").trim().toLowerCase();
        var dPrev = people.filter(function (p) { return sameOwnerName(p, "client", dOwner, dKey); })[0];
        if (!dPrev) try {
          dPrev = (JSON.parse(localStorage.getItem("sn:mine") || "[]") || []).filter(function (r) { return r && r.kind === "drop" && (r.owner || "") === dOwner && String(r.name || "").trim().toLowerCase() === dKey; })[0];
        } catch (e) {}
        var did = (dPrev && dPrev.id) || "d" + Date.now().toString(36);''')
rep(A, r'''        people = people.filter(function (p) { return !p || p.id !== did; });''', r'''        dropMineDups("drop", dOwner, dKey, did);
        people = people.filter(function (p) { return !p || (p.id !== did && !sameOwnerName(p, "client", dOwner, dKey)); });''')
# sn:people (and own driver/drop rows in sn:mine) dedupe on load
rep(A, r'''    try { people = JSON.parse(localStorage.getItem("sn:people") || "[]") || []; } catch (e2) { people = []; }''', r'''    try { people = JSON.parse(localStorage.getItem("sn:people") || "[]") || []; } catch (e2) { people = []; }
    var peopleN = people.length;
    people = dedupePeople(people);
    if (people.length !== peopleN) savePeople();
    dedupeMine();
    paintJobsChip();''')

# ---- (b) JOBS stays reachable: a small JOBS chip under the LIVE line whenever an order is open
rep(A, r'''    el.textContent = "LIVE · " + place + " · " + drivers + " driver" + (drivers === 1 ? "" : "s") + " · " + orders + " order" + (orders === 1 ? "" : "s");
  }''', r'''    el.textContent = "LIVE · " + place + " · " + drivers + " driver" + (drivers === 1 ? "" : "s") + " · " + orders + " order" + (orders === 1 ? "" : "s");
    paintJobsChip();
  }
  function paintJobsChip() {
    var open = 0;
    jobs.forEach(function (j) { if (j && !j.received && seesJob(j)) open++; });
    var chip = $("sn-jobs-chip");
    if (!open) { if (chip) chip.hidden = true; return; }
    if (!chip) {
      chip = document.createElement("button");
      chip.type = "button";
      chip.id = "sn-jobs-chip";
      chip.style.cssText = "position:fixed;top:68px;left:8px;z-index:91;height:26px;padding:0 12px;border-radius:999px;border:1px solid rgba(77,240,255,.7);background:rgba(4,14,28,.94);color:#4df0ff;font:800 11px/24px system-ui;letter-spacing:.08em;pointer-events:auto;cursor:pointer";
      chip.addEventListener("click", function (e) { e.preventDefault(); e.stopPropagation(); openJobs(); });
      document.body.appendChild(chip);
    }
    chip.textContent = "JOBS · " + open;
    chip.hidden = false;
  }''')

# ---- (d) honest offer split: items (real menu rows × picked qty) + delivery (fee formula unchanged) = total
rep(A, r'''  function throwOffer(job) {
    var id = "offer-" + (job && job.id ? job.id : Date.now().toString(36));
    var fee = job && (job.fee != null ? job.fee : job.total);''', r'''  function offerItems(v, picked) {
    var menu = (v && v.menu) || [];
    var lines = [];
    (picked || []).forEach(function (l) {
      if (!l) return;
      var row = null;
      menu.forEach(function (m) { if (!row && m && String(m.name || "") === String(l.name || "")) row = m; });
      lines.push({ name: l.name || "item", n: Number(l.n) || 1, price: l.price != null && l.price !== "" ? l.price : (row ? row.price : "") });
    });
    var stocked = menu.filter(function (m) { return m && m.qty !== 0 && String(m.qty) !== "0"; });
    if (!lines.length && stocked.length === 1) lines.push({ name: stocked[0].name || "item", n: 1, price: stocked[0].price });
    if (!lines.length) return { lines: [], food: null, why: stocked.length > 1 ? "not picked" : "unpriced" };
    var sum = 0, priced = true;
    lines.forEach(function (l) { var c = moneyOf(l.price); if (!(c > 0)) priced = false; sum += c * l.n; });
    return priced ? { lines: lines, food: Math.round(sum * 100) / 100 } : { lines: lines, food: null, why: "unpriced" };
  }
  function offerSplit(job) {
    if (!job || job.fee == null || job.fee === "") return null;
    var fee = Number(job.fee);
    if (job.delivery == null && job.food == null && !job.lines) return null;
    var food = job.food != null && job.food !== "" ? Number(job.food) : null;
    var del = job.delivery != null ? Number(job.delivery) : (food != null ? Math.round((fee - food) * 100) / 100 : fee);
    var r2 = function (n) { return String(Math.round(n * 100) / 100); };
    if (food == null) return { total: del, text: "Items " + (job.why === "not picked" ? "not picked" : "unpriced") + " · Delivery " + r2(del) + " · Total " + r2(del) + " AV€ + items" };
    return { total: Math.round((food + del) * 100) / 100, text: "Items " + r2(food) + " · Delivery " + r2(del) + " · Total " + r2(food + del) + " AV€" };
  }
  function throwOffer(job) {
    var id = "offer-" + (job && job.id ? job.id : Date.now().toString(36));
    var fee = job && (job.fee != null ? job.fee : job.total);
    var split = offerSplit(job);
    if (split) fee = split.total;''')
rep(A, r'''      '<div class="sn-leg">' + esc(km) + "</div>" +
      whoLine("CLIENT", d.name || "Client", dWhere);
    upsertTab(''', r'''      '<div class="sn-leg">' + esc(km) + "</div>" +
      whoLine("CLIENT", d.name || "Client", dWhere) +
      (split ? '<div class="sn-leg sn-split">' + esc(split.text) + "</div>" : "");
    upsertTab(''')
# JOBS list shows the same split
rep(A, r'''flags + " · " + j.fee + " AV€ · " + (j.km || 0).toFixed(1) + " km · "''', r'''flags + " · " + (offerSplit(j) ? offerSplit(j).text : j.fee + " AV€") + " · " + (j.km || 0).toFixed(1) + " km · "''')
# run-offer: carry the items; job.fee (settlement) stays the delivery quote as before
rep(A, r'''        var quote = quoteDelivery(vendor, drop, quoteOpts);
        var job = {
          id: "j" + Date.now().toString(36),
          vendor: vendor,
          drop: drop,
          km: quote.km,
          fee: quote.total,
          ready: true,''', r'''        var quote = quoteDelivery(vendor, drop, quoteOpts);
        var items = offerItems(vendor, basket.filter(function (line) { return line && String(line.id) === String(vendor.id); }));
        var job = {
          id: "j" + Date.now().toString(36),
          vendor: vendor,
          drop: drop,
          km: quote.km,
          fee: quote.total,
          delivery: quote.total,
          lines: items.lines,
          food: items.food,
          why: items.why || "",
          ready: true,''')
rep(A, r'''        throwOffer({
          id: job.id,
          name: vendor.name,
          fee: quote.total,
          km: quote.km,
          vendor: vendor,''', r'''        throwOffer({
          id: job.id,
          name: vendor.name,
          fee: quote.total,
          delivery: quote.total,
          lines: items.lines,
          food: items.food,
          why: items.why || "",
          km: quote.km,
          vendor: vendor,''')

# ---- (c) run-offer after a reload: own server shops count, never someone else's
rep(A, r'''          if (s.src && s.src !== "listed") return;
          var km = shopFrom ? haversineKm(shopFrom, s) : 0;''', r'''          if (s.src && s.src !== "listed" && !(s.src === "live" && ownShop(s))) return;
          var km = shopFrom ? haversineKm(shopFrom, s) : 0;''')
rep(A, r'''      if (act === "run-offer") {''', r'''      function ownShop(s) {
        if (!signed() || !s) return false;
        var m = String(me() || "").toLowerCase();
        if (!m || m.indexOf("@") < 0) return false;
        return [s.owner, s.customerPeer, s.peer].some(function (x) { return String(x || "").toLowerCase() === m; });
      }
      if (act === "run-offer") {''')
rep(A, r'''        if (have) { have.owner = have.owner || s.customerPeer || ""; return; }
        shops.unshift({ id: s.id, name: s.name || "vendor", lat: +s.lat, lng: +s.lng, phone: s.phone || "", src: "live", status: s.status || "live", owner: s.customerPeer || "" });''', r'''        if (have) { have.owner = have.owner || s.customerPeer || ""; have.peer = have.peer || s.peer || ""; return; }
        shops.unshift({ id: s.id, name: s.name || "vendor", lat: +s.lat, lng: +s.lng, phone: s.phone || "", src: "live", status: s.status || "live", owner: s.customerPeer || "", peer: s.peer || "" });''')
print('ok16')
