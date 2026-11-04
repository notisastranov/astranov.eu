/* SpaceNet 4421 — map, search, one menu, one drawer. No leftover chrome. */
(function () {
  "use strict";
  var RHODES = { lat: 36.434, lng: 28.217 };
  var ADMIN = { "notisastranov@gmail.com": 1, "info@astranov.eu": 1, "notiscs@gmail.com": 1 };
  var map, shops = [], markers = [], routeLine = null, youMarker = null, dropMarker = null, drvMarker = null;
  var here = null, placeSelf = false, hold = null, holdFired = false, viewI = 0;
  var cartShop = null, cart = {};
  var liveStream = null;

  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"]/g, function (c) {
      if (c === "&") return "&" + "amp;";
      if (c === "<") return "&" + "lt;";
      if (c === ">") return "&" + "gt;";
      return "&" + "quot;";
    });
  }
  function read(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function write(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function json(k, d) { try { return JSON.parse(read(k, "")) || d; } catch (e) { return d; } }
  function say(t) {
    var el = $("toast");
    if (!el) return;
    el.textContent = t;
    el.classList.add("on");
    clearTimeout(say._t);
    say._t = setTimeout(function () { el.classList.remove("on"); }, 4200);
  }
  function money(n) { return (Math.round((+n || 0) * 100) / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  function me() {
    try { var u = window.SNAuth && SNAuth.user && SNAuth.user(); return u || null; } catch (e) { return null; }
  }
  function myName() {
    var p = profile();
    if (p.name) return p.name;
    var u = me();
    if (u && u.name) return u.name;
    if (u && u.email) return u.email.split("@")[0];
    return "Guest";
  }
  function isAdmin() {
    var u = me();
    return !!(u && ADMIN[String(u.email || "").toLowerCase()]);
  }
  function profile() { return json("sn:profile", { name: "", phone: "" }); }
  function roles() {
    var r = json("sn:roles", null);
    if (!r || typeof r !== "object") r = { client: false, vendor: false, driver: false };
    return r;
  }
  function powerOn() { return read("sn:power", "1") !== "0"; }
  function setPower(on) { write("sn:power", on ? "1" : "0"); paintPower(); }
  function places() { return json("sn:places", { vendor: null, client: null, driver: null }); }
  function savePlaces(p) { write("sn:places", JSON.stringify(p)); }
  function jobs() { return json("sn:jobs", []).filter(function (j) { return j && !j.agent && !j.self && j.vendor && j.client; }); }
  function saveJobs(list) { write("sn:jobs", JSON.stringify(list)); }
  function openJob() {
    var list = jobs();
    for (var i = 0; i < list.length; i++) if (!list[i].settled && !list[i].fault) return list[i];
    return null;
  }
  function books() {
    var b = json("sn:books", null);
    if (!b || typeof b !== "object") b = { pool: 0, me: null, rows: [] };
    if (!b.rows) b.rows = [];
    if (b.me == null) b.me = isAdmin() ? 3000000 : 0;
    return b;
  }
  function saveBooks(b) { write("sn:books", JSON.stringify(b)); paintMoney(); }
  function avc() { return books().me || 0; }
  function bookRow(b, id, name, role) {
    var row = null;
    b.rows.forEach(function (r) { if (r && r.id === id) row = r; });
    if (!row) { row = { id: id, name: name, role: role, avc: 0 }; b.rows.push(row); }
    return row;
  }
  function ledger(kind, row) {
    var book = json("sn:ledger", []);
    book.push({ kind: kind, t: Date.now(), row: row });
    if (book.length > 200) book = book.slice(-200);
    write("sn:ledger", JSON.stringify(book));
    try {
      var bc = new BroadcastChannel("astranov-mesh");
      bc.postMessage({ kind: kind, t: Date.now(), row: row });
      bc.close();
    } catch (e) {}
  }
  function haversine(a, b) {
    if (!a || !b) return 0;
    var R = 6371, p1 = a.lat * Math.PI / 180, p2 = b.lat * Math.PI / 180;
    var d1 = (b.lat - a.lat) * Math.PI / 180, d2 = (b.lng - a.lng) * Math.PI / 180;
    var x = Math.sin(d1 / 2) * Math.sin(d1 / 2) + Math.cos(p1) * Math.cos(p2) * Math.sin(d2 / 2) * Math.sin(d2 / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }
  function isNight() { var h = new Date().getHours(); return h >= 21 || h < 9; }
  function quote(from, to, food) {
    var km = haversine(from, to);
    var base = 3;
    var perKm = Math.round(km * 100) / 100;
    var extras = isNight() ? 3 : 0;
    var fee = Math.round((base + perKm + extras) * 100) / 100;
    var cut = Math.round(fee * 0.03 * 100) / 100;
    var total = Math.round(((+food || 0) + fee + cut) * 100) / 100;
    var lines = [
      "Food · " + money(food),
      "Base · 3",
      km.toFixed(2) + " km × 1 · " + money(perKm),
      (extras ? "Night · 3" : "Extras · 0"),
      "3% · " + money(cut),
      "= " + money(total) + " AV€"
    ];
    return { km: km, base: base, perKm: perKm, extras: extras, fee: fee, cut: cut, food: +food || 0, total: total, text: lines.join("\n") };
  }
  function geocode(q) {
    q = String(q || "").trim();
    if (q.length < 2) return Promise.resolve(null);
    return fetch("https://photon.komoot.io/api/?limit=1&q=" + encodeURIComponent(q))
      .then(function (r) { return r.json(); })
      .then(function (j) {
        var f = j && j.features && j.features[0];
        if (!f || !f.geometry) return null;
        var c = f.geometry.coordinates || [];
        var p = f.properties || {};
        if (!isFinite(+c[1]) || !isFinite(+c[0])) return null;
        var bits = [p.housenumber, p.street, p.city || p.town || p.village, p.country].filter(Boolean);
        return { lat: +c[1], lng: +c[0], name: p.name || q, raw: bits.join(", ") || p.name || q };
      })
      .catch(function () {
        return fetch("/api/find?op=nominatim&limit=1&q=" + encodeURIComponent(q))
          .then(function (r) { return r.json(); })
          .then(function (rows) {
            var x = rows && rows[0];
            if (!x || !isFinite(+x.lat) || !isFinite(+x.lon)) return null;
            return { lat: +x.lat, lng: +x.lon, name: x.display_name || q, raw: x.display_name || q };
          })
          .catch(function () { return null; });
      });
  }
  function needReady() {
    var u = me();
    if (!u || !u.email) { say("Sign in first."); if (window.SNAuth && SNAuth.open) SNAuth.open(); return false; }
    var p = profile();
    if (!String(p.name || "").trim() || !String(p.phone || "").trim()) { openProfile(); return false; }
    var r = roles();
    if (!r.client && !r.vendor && !r.driver) { say("Pick a role. Client, vendor, or driver."); if (window.SNAuth) SNAuth.open(); return false; }
    if (!powerOn()) { say("Power is off. Turn it on to order."); return false; }
    return true;
  }
  function paintPower() {
    var b = $("sn-power");
    if (!b) return;
    var on = powerOn();
    b.className = on ? "on" : "off";
    b.textContent = on ? "POWER ON" : "POWER OFF";
  }
  function paintMoney() {
    var b = $("sn-money");
    if (b) b.textContent = "MONEY · " + Math.round(avc()).toLocaleString("en-GB");
  }
  function paintGps() {
    var b = $("gps");
    if (b) b.classList.toggle("armed", !!placeSelf);
  }
  function icon(cls, letter) {
    return L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 18], html: '<div class="pin ' + cls + '">' + esc(letter) + "</div>" });
  }
  function clearMarkers() {
    markers.forEach(function (m) { map.removeLayer(m); });
    markers = [];
    if (youMarker) { map.removeLayer(youMarker); youMarker = null; }
    if (dropMarker) { map.removeLayer(dropMarker); dropMarker = null; }
    if (drvMarker) { map.removeLayer(drvMarker); drvMarker = null; }
    if (routeLine) { map.removeLayer(routeLine); routeLine = null; }
  }
  function draw() {
    if (!map) return;
    clearMarkers();
    shops.forEach(function (s) {
      if (!isFinite(+s.lat) || !isFinite(+s.lng)) return;
      var m = L.marker([+s.lat, +s.lng], { icon: icon("", (s.name || "S").slice(0, 1).toUpperCase()) }).addTo(map);
      m.on("click", function (ev) { L.DomEvent.stopPropagation(ev); openVendor(s); });
      markers.push(m);
    });
    var p = places();
    if (p.vendor && isFinite(+p.vendor.lat)) {
      markers.push(L.marker([+p.vendor.lat, +p.vendor.lng], { icon: icon("", "V") }).addTo(map));
    }
    if (here) youMarker = L.marker([here.lat, here.lng], { icon: icon("me", "YOU") }).addTo(map);
    var job = openJob();
    var client = (job && job.client) || (p.client && p.client.listed ? p.client : null);
    var driver = (job && job.driver) || (p.driver && p.driver.listed ? p.driver : null);
    if (client && isFinite(+client.lat)) dropMarker = L.marker([+client.lat, +client.lng], { icon: icon("drop", "C") }).addTo(map);
    if (driver && isFinite(+driver.lat)) drvMarker = L.marker([+driver.lat, +driver.lng], { icon: icon("drv", "D") }).addTo(map);
    var from = job && job.vendor;
    if (from && client && isFinite(+from.lat) && isFinite(+client.lat)) {
      routeLine = L.polyline([[+from.lat, +from.lng], [+client.lat, +client.lng]], {
        color: "#1a3cff", weight: 6, opacity: 0.95, lineCap: "round"
      }).addTo(map);
    }
  }
  function setDrawer(px) {
    px = Math.max(48, Math.min(Math.round(window.innerHeight * 0.72), px));
    document.documentElement.style.setProperty("--drawer-h", px + "px");
  }
  function openDrawer(title, html) {
    $("handle").textContent = title;
    $("sheet").innerHTML = html;
    setDrawer(Math.max(window.innerHeight * 0.46, 280));
    bindSheet();
  }
  function bindSheet() {
    var sheet = $("sheet");
    if (sheet.__bound) return;
    sheet.__bound = true;
    sheet.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "add") addDish(b.getAttribute("data-shop"), b.getAttribute("data-i"));
      else if (act === "order") checkout();
      else if (act === "save-profile") saveProfile();
      else if (act === "list-vendor") listVendor();
      else if (act === "list-client") listClient();
      else if (act === "list-driver") listDriver();
      else if (act === "send-support") sendSupport();
      else if (act === "verify") verify(b.getAttribute("data-id"), b.getAttribute("data-step"));
      else if (act === "problem") problem(b.getAttribute("data-id"));
      else if (act === "msg") message(b.getAttribute("data-who"));
      else if (act === "send-msg") sendMsg(b.getAttribute("data-who"));
      else if (act === "call") callWho(b.getAttribute("data-phone"));
      else if (act === "video") videoWho();
      else if (act === "hang") hang();
      else if (act === "offer") showJob(b.getAttribute("data-id"));
    });
  }
  function talkBar(who, phone) {
    return '<div class="row">' +
      '<button type="button" class="go" data-act="msg" data-who="' + esc(who) + '">MESSAGE</button>' +
      '<button type="button" class="go" data-act="call" data-phone="' + esc(phone || "") + '">CALL</button>' +
      '<button type="button" class="go" data-act="video">VIDEO</button></div>';
  }
  function openProfile() {
    var p = profile();
    openDrawer("PROFILE",
      '<p class="note">Name and phone. Then pick a role and leave power on.</p>' +
      '<input class="field" id="pf-name" placeholder="Name" value="' + esc(p.name || "") + '"/>' +
      '<input class="field" id="pf-phone" placeholder="Phone" value="' + esc(p.phone || "") + '"/>' +
      '<button type="button" class="go primary" data-act="save-profile">SAVE</button>');
  }
  function saveProfile() {
    var name = ($("pf-name") || {}).value || "";
    var phone = ($("pf-phone") || {}).value || "";
    name = String(name).trim();
    phone = String(phone).replace(/[^\d+ ]/g, "").trim();
    if (!name || !phone) { say("Name and phone."); return; }
    write("sn:profile", JSON.stringify({ name: name, phone: phone }));
    if (window.SNAuth && SNAuth.savePhone) SNAuth.savePhone(phone);
    say("Profile saved.");
    showOffers();
  }
  function openSupport() {
    var log = json("sn:desk", []);
    var lines = log.slice(-12).map(function (m) { return esc(m.who) + ": " + esc(m.text); }).join("\n");
    openDrawer(myName() + " · SUPPORT",
      (lines ? '<p class="break">' + lines + "</p>" : '<p class="note">This session is in your name. Administrators can track it.</p>') +
      '<textarea class="field" id="sup-text" placeholder="What happened"></textarea>' +
      '<button type="button" class="go primary" data-act="send-support">SEND</button>');
    $("menu").hidden = true;
  }
  function sendSupport() {
    var text = String(($("sup-text") || {}).value || "").trim();
    if (!text) { say("Write what you need."); return; }
    var log = json("sn:desk", []);
    log.push({ who: myName(), text: text, t: Date.now() });
    write("sn:desk", JSON.stringify(log));
    ledger("support", { name: myName(), email: (me() && me().email) || "", text: text });
    var headers = { "Content-Type": "application/json" };
    try { var t = window.SNAuth && SNAuth.token && SNAuth.token(); if (t) headers.Authorization = "Bearer " + t; } catch (e) {}
    fetch("/api/support/open", { method: "POST", headers: headers, body: JSON.stringify({ name: myName(), matter: text }) }).catch(function () {});
    say("Support has " + myName() + ".");
    openSupport();
  }
  function showOffers() {
    if (!powerOn()) {
      openDrawer("OFFERS", '<p class="note">Power is off. Offers stay closed.</p>');
      return;
    }
    var list = jobs().filter(function (j) { return !j.settled; });
    var html = list.length ? list.map(function (j) {
      return '<button type="button" class="go" data-act="offer" data-id="' + esc(j.id) + '">' +
        esc(j.vendor.name) + " → " + esc(j.client.name || "client") + " · " + money(j.total) + " AV€</button>";
    }).join("") : '<p class="note">No offer yet. Hold the map for 3 seconds. List a vendor, a client, and a driver.</p>';
    openDrawer("OFFERS", html);
  }
  function showMoney() {
    var b = books();
    var rows = b.rows.slice(-8).map(function (r) {
      return esc((r.role || "").toUpperCase()) + " · " + esc(r.name) + " · " + money(r.avc);
    }).join("\n");
    openDrawer("MONEY",
      '<p class="price">' + money(b.me) + ' <small>AV€</small></p>' +
      '<p class="note">Mutual pool ' + money(b.pool) + " AV€." + (isAdmin() ? " Admin wallet." : "") + "</p>" +
      (rows ? '<p class="break">' + rows + "</p>" : ""));
    $("menu").hidden = true;
  }
  function shopById(id) {
    for (var i = 0; i < shops.length; i++) if (shops[i].id === id) return shops[i];
    return null;
  }
  function cartCount(id, i) { return (cartShop === id && cart[i]) || 0; }
  function cartFood(s) {
    var n = 0;
    if (!s || cartShop !== s.id) return 0;
    (s.menu || []).forEach(function (d, i) { n += (+d.price || 0) * (cart[i] || 0); });
    return Math.round(n * 100) / 100;
  }
  function priceBlock(s) {
    var p = places();
    var food = cartFood(s);
    if (!(p.client && p.client.listed) || !(p.driver && p.driver.listed)) {
      return '<p class="note">List a client address and a driver before the price. GPS is not the drop.</p>';
    }
    var q = quote(s || p.vendor, p.client, food);
    return '<p class="price">' + money(q.total) + ' <small>AV€</small></p><p class="break">' + esc(q.text) + "</p>";
  }
  function openVendor(s) {
    cartShop = s.id;
    var rows = (s.menu || []).map(function (d, i) {
      var n = cartCount(s.id, i);
      return '<div class="row"><b>' + esc(d.name) + '</b><span>' + money(d.price) + '</span>' +
        '<button type="button" class="plus" data-act="add" data-shop="' + esc(s.id) + '" data-i="' + i + '">' + (n ? n : "+") + "</button></div>";
    }).join("");
    openDrawer(s.name || "VENDOR",
      '<p class="note">' + esc(s.address_public || s.address || "") + "</p>" +
      talkBar("vendor:" + s.id, s.phone) +
      rows +
      '<div id="price-box">' + priceBlock(s) + "</div>" +
      '<button type="button" class="go primary" data-act="order">ORDER · PAY AV€</button>');
  }
  function addDish(id, i) {
    var s = shopById(id);
    if (!s) return;
    if (cartShop !== id) { cartShop = id; cart = {}; }
    cart[i] = (cart[i] || 0) + 1;
    openVendor(s);
  }
  function checkout() {
    if (!needReady()) return;
    var s = shopById(cartShop);
    var p = places();
    if (!s) { say("Open a vendor first."); return; }
    var food = cartFood(s);
    if (food <= 0) { say("Add a dish."); return; }
    if (!(p.client && p.client.listed && isFinite(+p.client.lat))) { say("List a client. Hold the map, then the address."); return; }
    if (!(p.driver && p.driver.listed)) { say("List a driver. Hold the map."); return; }
    var from = (p.vendor && isFinite(+p.vendor.lat)) ? p.vendor : s;
    var q = quote(from, p.client, food);
    var b = books();
    if (b.me < q.total) { say("Not enough AV€. You have " + money(b.me) + "."); return; }
    b.me = Math.round((b.me - q.total) * 100) / 100;
    var clientRow = bookRow(b, "client:" + myName(), myName(), "client");
    clientRow.avc = Math.round(((clientRow.avc || 0) - q.total) * 100) / 100;
    saveBooks(b);
    var items = [];
    (s.menu || []).forEach(function (d, i) { if (cart[i]) items.push({ name: d.name, price: +d.price, n: cart[i] }); });
    var job = {
      id: "j" + Date.now().toString(36),
      t: Date.now(),
      vendor: { id: s.id, name: s.name, lat: +from.lat, lng: +from.lng, phone: s.phone || "" },
      client: { name: p.client.name, address: p.client.address, lat: +p.client.lat, lng: +p.client.lng, listed: true },
      driver: { name: p.driver.name, lat: +p.driver.lat, lng: +p.driver.lng, listed: true, phone: p.driver.phone || "" },
      items: items,
      food: q.food, km: q.km, fee: q.fee, cut: q.cut, total: q.total, why: q.text,
      pay: "AV€ " + money(q.total) + " held",
      paid: true,
      stepVendor: false, stepDriverShop: false, stepClient: false, stepDriverDrop: false,
      pickup: false, got: false, delivered: false, settled: false
    };
    var list = jobs();
    list.unshift(job);
    saveJobs(list);
    ledger("hold", { id: job.id, total: q.total, who: myName() });
    cart = {};
    say(job.pay);
    draw();
    showJob(job.id);
  }
  function showJob(id) {
    var job = null;
    jobs().forEach(function (j) { if (j.id === id) job = j; });
    if (!job) { showOffers(); return; }
    var steps = [
      ["stepVendor", "VENDOR AT THE SHOP"],
      ["stepDriverShop", "DRIVER AT THE SHOP"],
      ["stepDriverDrop", "DRIVER AT THE DOOR"],
      ["stepClient", "CLIENT AT THE DOOR"]
    ].map(function (s) {
      return '<button type="button" class="go ' + (job[s[0]] ? "ok" : "") + '" data-act="verify" data-id="' + esc(job.id) + '" data-step="' + s[0] + '">' +
        (job[s[0]] ? "✓ " : "") + s[1] + "</button>";
    }).join("");
    openDrawer("OFFER",
      "<h3>" + esc(job.vendor.name) + "</h3>" +
      '<p class="note">' + esc(job.client.address || job.client.name || "") + " · " + esc(job.driver.name) + "</p>" +
      talkBar("job:" + job.id, job.client.phone || job.driver.phone || "") +
      '<p class="price">' + money(job.total) + ' <small>AV€</small></p>' +
      '<p class="break">' + esc(job.why) + "</p>" +
      '<p class="note">' + esc(job.pay) + (job.settled ? " · settled" : "") + (job.fault ? " · fault " + esc(job.fault) : "") + "</p>" +
      steps +
      '<button type="button" class="go bad" data-act="problem" data-id="' + esc(job.id) + '">PROBLEM</button>');
  }
  function patchJob(id, fn) {
    var list = jobs();
    var job = null;
    list.forEach(function (j) { if (j.id === id) job = j; });
    if (!job) return null;
    fn(job);
    saveJobs(list);
    return job;
  }
  function verify(id, step) {
    var job = patchJob(id, function (j) {
      if (j.settled || j.fault) return;
      j[step] = true;
      if (j.stepVendor && j.stepDriverShop) { j.pickup = true; j.got = true; }
      if (j.got && j.stepClient && j.stepDriverDrop) {
        j.delivered = true;
        j.received = true;
        settle(j);
      }
    });
    if (job) showJob(job.id);
    draw();
  }
  function settle(job) {
    if (job.settled) return;
    job.settled = true;
    var b = books();
    b.pool = Math.round(((b.pool || 0) + job.cut) * 100) / 100;
    var v = bookRow(b, "vendor:" + (job.vendor.id || job.vendor.name), job.vendor.name, "vendor");
    v.avc = Math.round(((v.avc || 0) + job.food) * 100) / 100;
    var d = bookRow(b, "driver:" + job.driver.name, job.driver.name, "driver");
    d.avc = Math.round(((d.avc || 0) + job.fee) * 100) / 100;
    saveBooks(b);
    ledger("settle", { id: job.id, food: job.food, fee: job.fee, cut: job.cut });
    say("Food to the vendor. Delivery fee to the driver.");
  }
  function refund(job) {
    if (job.refunded) return;
    job.refunded = true;
    var b = books();
    b.me = Math.round(((b.me || 0) + job.total) * 100) / 100;
    saveBooks(b);
    ledger("refund", { id: job.id, total: job.total });
  }
  function problem(id) {
    var note = window.prompt("Whose fault? vendor, driver, or client. What happened?");
    if (note == null) return;
    var job = patchJob(id, function (j) {
      if (j.fault) return;
      var s = String(note).toLowerCase();
      var blame = /vendor|shop/.test(s) ? "vendor" : /client/.test(s) ? "client" : /driver/.test(s) ? "driver" : (!j.pickup ? "vendor" : (j.delivered && !j.stepClient ? "client" : "driver"));
      j.fault = blame;
      j.faultNote = note;
      j.settled = true;
      if (blame !== "client") refund(j);
      var b = books();
      var row = bookRow(b, blame + ":" + (blame === "vendor" ? j.vendor.name : blame === "driver" ? j.driver.name : (j.client.name || "client")), blame, blame);
      row.avc = Math.round(((row.avc || 0) - j.total) * 100) / 100;
      saveBooks(b);
      ledger("problem", { id: j.id, blame: blame, note: note });
      say(blame === "client" ? "Client at fault. The hold stays." : (blame + " at fault. Client refunded."));
    });
    if (job) showJob(job.id);
  }
  function message(who) {
    var thread = json("sn:chat:" + who, []);
    var lines = thread.slice(-20).map(function (m) { return esc(m.who) + ": " + esc(m.text); }).join("\n");
    openDrawer("MESSAGE",
      (lines ? '<p class="break">' + lines + "</p>" : '<p class="note">No messages yet.</p>') +
      '<input class="field" id="msg-text" placeholder="Message"/>' +
      '<button type="button" class="go primary" data-act="send-msg" data-who="' + esc(who) + '">SEND</button>');
  }
  function sendMsg(who) {
    var text = String(($("msg-text") || {}).value || "").trim();
    if (!text) return;
    var thread = json("sn:chat:" + who, []);
    thread.push({ who: myName(), text: text, t: Date.now() });
    write("sn:chat:" + who, JSON.stringify(thread));
    message(who);
  }
  function callWho(phone) {
    if (phone) { location.href = "tel:" + phone; return; }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say("This device has no call."); return; }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      hang();
      liveStream = s;
      say("Call is live on this device. Hang up from the drawer.");
      openDrawer("CALL", '<p class="note">Microphone is on. There is no phone number on that person.</p><button type="button" class="go bad" data-act="hang">HANG UP</button>');
    }).catch(function () { say("Microphone was refused."); });
  }
  function videoWho() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say("This device has no camera."); return; }
    navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(function (s) {
      hang();
      liveStream = s;
      openDrawer("VIDEO", '<video id="vid" autoplay playsinline muted style="width:100%;border-radius:12px;background:#000"></video><button type="button" class="go bad" data-act="hang">HANG UP</button>');
      var v = $("vid");
      if (v) v.srcObject = s;
    }).catch(function () { say("Camera was refused."); });
  }
  function hang() {
    if (!liveStream) return;
    liveStream.getTracks().forEach(function (t) { t.stop(); });
    liveStream = null;
  }
  var listAt = null;
  function openList(ll) {
    if (!needReady()) return;
    listAt = { lat: ll.lat, lng: ll.lng };
    openDrawer("LIST",
      '<p class="note">Hold point. Listing does not use GPS as the delivery address.</p>' +
      '<button type="button" class="go" data-act="list-vendor">VENDOR</button>' +
      '<button type="button" class="go" data-act="list-client">CLIENT</button>' +
      '<button type="button" class="go" data-act="list-driver">DRIVER</button>');
  }
  function nearestShop(ll) {
    var best = null, bestD = 0.08;
    shops.forEach(function (s) {
      var d = haversine(ll, s);
      if (d < bestD) { best = s; bestD = d; }
    });
    return best;
  }
  function listVendor() {
    if (!listAt) return;
    var near = nearestShop(listAt);
    var name = near ? near.name : window.prompt("Vendor name at this point");
    if (!name) return;
    var p = places();
    p.vendor = near ? { id: near.id, name: near.name, lat: +near.lat, lng: +near.lng, listed: true } : { name: name, lat: listAt.lat, lng: listAt.lng, listed: true };
    savePlaces(p);
    say("Vendor listed. " + p.vendor.name);
    draw();
    if (near) openVendor(near);
  }
  function listClient() {
    if (!listAt) return;
    var address = window.prompt("Client address");
    if (!address) return;
    say("Checking that address…");
    geocode(address).then(function (hit) {
      if (!hit) { say("That address did not resolve. The pin was not moved."); return; }
      var p = places();
      p.client = { name: hit.name, address: hit.raw || address, lat: hit.lat, lng: hit.lng, listed: true };
      savePlaces(p);
      map.setView([hit.lat, hit.lng], 16);
      say("Client listed. Pin snapped to the address.");
      draw();
      showOffers();
    });
  }
  function listDriver() {
    if (!listAt) return;
    var name = window.prompt("Driver name");
    if (!name) return;
    var p = places();
    p.driver = { name: String(name).trim(), lat: listAt.lat, lng: listAt.lng, listed: true };
    savePlaces(p);
    say("Driver listed. " + p.driver.name);
    draw();
  }
  function searchTo(q) {
    q = String(q || "").trim();
    if (!q) return;
    var hitShop = null;
    shops.forEach(function (s) { if (!hitShop && s.name && s.name.toLowerCase().indexOf(q.toLowerCase()) >= 0) hitShop = s; });
    if (hitShop) { map.setView([+hitShop.lat, +hitShop.lng], 17); openVendor(hitShop); return; }
    say("Searching…");
    geocode(q).then(function (hit) {
      if (!hit) { say("No place for that."); return; }
      map.setView([hit.lat, hit.lng], 16);
      say(hit.raw || hit.name);
    });
  }
  function bootMap() {
    map = L.map("map", { zoomControl: true, attributionControl: false }).setView([RHODES.lat, RHODES.lng], 14);
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19 }).addTo(map);
    map.on("click", function (e) {
      if (holdFired) { holdFired = false; return; }
      if (placeSelf) {
        here = { lat: e.latlng.lat, lng: e.latlng.lng };
        placeSelf = false;
        paintGps();
        draw();
        say("You are on the map. This is not a delivery address.");
        return;
      }
      var current = openJob();
      if (!current) return;
      var next = { lat: e.latlng.lat, lng: e.latlng.lng };
      var q = quote(current.vendor, next, current.food);
      var delta = Math.round((q.total - current.total) * 100) / 100;
      var b = books();
      if (delta > 0 && b.me < delta) { say("Not enough AV€ to move the drop."); return; }
      b.me = Math.round((b.me - delta) * 100) / 100;
      saveBooks(b);
      var job = patchJob(current.id, function (j) {
        j.client.lat = next.lat;
        j.client.lng = next.lng;
        j.km = q.km; j.fee = q.fee; j.cut = q.cut; j.total = q.total; j.why = q.text;
        j.pay = "AV€ " + money(q.total) + " held";
      });
      draw();
      if (job) { say("Drop moved. " + money(job.total) + " AV€."); showJob(job.id); }
    });
    var box = map.getContainer();
    box.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest(".leaflet-control, .pin")) return;
      var start = { x: e.clientX, y: e.clientY };
      holdFired = false;
      hold = start;
      start.timer = setTimeout(function () {
        hold = null;
        holdFired = true;
        var ll = map.mouseEventToLatLng(e);
        openList(ll);
      }, 3000);
    });
    box.addEventListener("pointermove", function (e) {
      if (!hold) return;
      if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 16) { clearTimeout(hold.timer); hold = null; }
    });
    function endHold() { if (!hold) return; clearTimeout(hold.timer); hold = null; }
    box.addEventListener("pointerup", endHold);
    box.addEventListener("pointercancel", endHold);
  }
  function bootDrawer() {
    var handle = $("handle");
    var drag = null;
    handle.addEventListener("pointerdown", function (e) {
      drag = { y: e.clientY, h: $("drawer").offsetHeight, moved: false };
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dy = drag.y - e.clientY;
      if (Math.abs(dy) > 4) drag.moved = true;
      setDrawer(drag.h + dy);
    });
    handle.addEventListener("pointerup", function () {
      if (!drag) return;
      if (!drag.moved) setDrawer($("drawer").offsetHeight > 80 ? 48 : Math.round(window.innerHeight * 0.5));
      if ($("drawer").offsetHeight > 80 && $("handle").textContent === "OFFERS" && !$("sheet").innerHTML) showOffers();
      drag = null;
    });
    $("handle").addEventListener("click", function () {});
  }
  function bootChrome() {
    $("sn-burger").addEventListener("click", function () {
      var m = $("menu");
      m.hidden = !m.hidden;
      $("sn-burger").setAttribute("aria-expanded", m.hidden ? "false" : "true");
    });
    $("sn-power").addEventListener("click", function () { setPower(!powerOn()); });
    $("sn-money").addEventListener("click", showMoney);
    $("sn-support").addEventListener("click", openSupport);
    $("sn-support-menu").addEventListener("click", openSupport);
    $("gps").addEventListener("click", function () {
      placeSelf = true;
      paintGps();
      say("GPS armed. Tap the map to place yourself. It will not take the next tap as an order.");
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          map.setView([pos.coords.latitude, pos.coords.longitude], 16);
        }, function () {}, { enableHighAccuracy: true, timeout: 8000 });
      }
    });
    $("sn-view").addEventListener("click", function () {
      viewI = (viewI + 1) % 3;
      var z = [16, 13, 10][viewI];
      var c = here || RHODES;
      map.setView([c.lat, c.lng], z);
      say(["Street", "City", "Island"][viewI]);
    });
    $("sn-compass").addEventListener("click", function () {
      var c = here || (openJob() && openJob().client) || RHODES;
      map.setView([c.lat, c.lng], map.getZoom(), { animate: true });
      say("North is up.");
    });
    $("search").addEventListener("submit", function (e) { e.preventDefault(); searchTo($("q").value); });
    $("mic").addEventListener("click", function () {
      var Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!Rec) { say("This browser has no speech search."); return; }
      var rec = new Rec();
      rec.lang = "el-GR";
      rec.onresult = function (ev) {
        var t = ev.results[0][0].transcript;
        $("q").value = t;
        searchTo(t);
      };
      rec.start();
      say("Listening…");
    });
    $("logo").addEventListener("click", function () { map.setView([RHODES.lat, RHODES.lng], 13); });
  }
  function loadShops() {
    fetch("/datanet/menus.json?v=4421").then(function (r) { return r.json(); }).then(function (j) {
      shops = ((j && j.shops) || []).filter(function (s) { return s && isFinite(+s.lat) && isFinite(+s.lng) && s.src !== "fake"; });
      draw();
    }).catch(function () { say("Menus did not load."); });
  }
  window.SN = {
    say: say,
    paintMoney: paintMoney,
    avcGet: avc,
    walletLabel: function () { return money(avc()) + " AV€"; },
    setRoleOn: function (role, on) {
      var r = roles();
      r[role] = !!on;
      write("sn:roles", JSON.stringify(r));
    }
  };
  window.__SN_4421 = true;
  paintPower();
  paintMoney();
  bootMap();
  bootDrawer();
  bootChrome();
  loadShops();
  draw();
  if (navigator.serviceWorker) navigator.serviceWorker.register("/sw.js").catch(function () {});
})();
