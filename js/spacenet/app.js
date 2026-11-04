/* SpaceNet 4421 — map, search, one menu, one drawer. GPS tiers + stockpile fixes. */
(function () {
  "use strict";
  var RHODES = { lat: 36.434, lng: 28.217 };
  var ATHENS = { lat: 37.9755, lng: 23.7348 };
  var ADMIN = { "notisastranov@gmail.com": 1, "info@astranov.eu": 1, "notiscs@gmail.com": 1 };
  var HOLD_MS = 1500;
  var DRIVE_KMH = 3;
  var map, shops = [], markers = [], huntMarkers = [], routeLine = null, youMarker = null, dropMarker = null, drvMarker = null, searchPin = null;
  var here = null, placeSelf = false, hold = null, holdFired = false, viewI = 0;
  var cartShop = null, cart = {};
  var liveStream = null;
  var bankBal = 0, bankSeen = false, bankAsked = false, bankRetry = 0, bankFail = false;
  var gpsWatchId = 0;
  var gpsSpeed = { kmh: 0, smooth: 0, belowAt: 0, driving: false, last: null, lastT: 0 };
  var gpsSeq = 0;
  var sheetKind = "";

  var CATEGORY = {
    supermarket: { label: "supermarket", tags: ['["shop"="supermarket"]', '["shop"="convenience"]'], find: "supermarket" },
    supermarketS: { label: "supermarket", tags: ['["shop"="supermarket"]'], find: "supermarket" },
    grocery: { label: "grocery", tags: ['["shop"="supermarket"]', '["shop"="convenience"]', '["shop"="greengrocer"]'], find: "supermarket" },
    plumber: { label: "plumber", tags: ['["craft"="plumber"]', '["office"="plumber"]'], find: "plumber" },
    pharmacy: { label: "pharmacy", tags: ['["amenity"="pharmacy"]', '["healthcare"="pharmacy"]'], find: "pharmacy" },
    bakery: { label: "bakery", tags: ['["shop"="bakery"]'], find: "bakery" },
    cafe: { label: "cafe", tags: ['["amenity"="cafe"]'], find: "cafe" },
    coffee: { label: "cafe", tags: ['["amenity"="cafe"]'], find: "cafe" },
    pizza: { label: "pizza", tags: ['["cuisine"="pizza"]', '["amenity"="restaurant"]["cuisine"~"pizza"]'], find: "pizza" },
    restaurant: { label: "restaurant", tags: ['["amenity"="restaurant"]'], find: "restaurant" },
    butcher: { label: "butcher", tags: ['["shop"="butcher"]'], find: "butcher" },
    hardware: { label: "hardware", tags: ['["shop"="hardware"]', '["shop"="doityourself"]'], find: "hardware" }
  };

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
  function signed() { var u = me(); return !!(u && u.email); }
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

  /* 4421: TESTER / V4297 fixtures — filter in UI only, never delete DB rows */
  function isTestFixture(x) {
    if (!x || typeof x !== "object") return false;
    var blob = [x.name, x.id, x.label, x.phone, x.address, x.role, x.src].map(function (v) { return String(v || ""); }).join(" ");
    if (/\bTESTER\b/i.test(blob)) return true;
    if (/V4297|Test\s*(Client|Driver|Vendor)/i.test(blob)) return true;
    if (String(x.phone || "").replace(/\D/g, "") === "0000000000") return true;
    if (x.src === "tester" || x.agent || x.self === "tester") return true;
    return false;
  }

  function jobs() {
    return json("sn:jobs", []).filter(function (j) {
      if (!j || j.agent || j.self) return false;
      if (!j.vendor || !j.client) return false;
      if (isTestFixture(j) || isTestFixture(j.vendor) || isTestFixture(j.client) || isTestFixture(j.driver || {})) return false;
      return true;
    });
  }
  function saveJobs(list) { write("sn:jobs", JSON.stringify(list)); }
  function openJob() {
    var list = jobs();
    for (var i = 0; i < list.length; i++) if (!list[i].settled && !list[i].fault) return list[i];
    return null;
  }

  /* 4421: sn:books.me was seeded with isAdmin()?3000000:0 — NOT a real ledger.
     Wallet display uses sn_my_balance JWT only. books() keeps pool/rows for settle math, never paints 3M. */
  function books() {
    var b = json("sn:books", null);
    if (!b || typeof b !== "object") b = { pool: 0, me: 0, rows: [] };
    if (!b.rows) b.rows = [];
    /* scrub legacy admin 3M seed from localStorage so it cannot resurface */
    if (b.me === 3000000 || b.me === "3000000") b.me = 0;
    b.rows = (b.rows || []).filter(function (r) { return r && !isTestFixture(r); });
    return b;
  }
  function saveBooks(b) {
    if (b && (b.me === 3000000 || b.me === "3000000")) b.me = 0;
    write("sn:books", JSON.stringify(b));
    paintMoney();
  }
  function avc() {
    if (!signed()) return 0;
    if (bankSeen) return bankBal;
    return 0;
  }
  function walletLabel() {
    if (!signed()) return "0.00 ⭐ · guest";
    if (bankSeen) return money(bankBal) + " ⭐";
    if (bankFail || (bankAsked && window.__snBalStatus && window.__snBalStatus !== 200)) return "⭐ unavailable";
    if (bankAsked) return "⭐ …";
    return "⭐ …";
  }
  function pullBank() {
    if (!signed()) { paintMoney(); return; }
    bankAsked = true;
    var tok = "";
    try { tok = (window.SNAuth && SNAuth.token && SNAuth.token()) || localStorage.getItem("sn:access") || ""; } catch (e) {}
    if (!tok) { bankFail = true; paintMoney(); return; }
    fetch("/api/public-config", { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (cfg) {
      if (!cfg || !cfg.anon || !cfg.sb) { bankFail = true; paintMoney(); return null; }
      if (window.__snBalRpc === false) { bankFail = true; paintMoney(); return null; }
      function ask(t2) {
        return fetch(cfg.sb + "/rest/v1/rpc/sn_my_balance", {
          method: "POST",
          headers: { apikey: cfg.anon, Authorization: "Bearer " + t2, Accept: "application/json", "Content-Type": "application/json" },
          body: "{}"
        });
      }
      return ask(tok).then(function (r) {
        if (r.status === 401 && bankRetry < 1 && window.SNAuth && SNAuth.refresh) {
          bankRetry++;
          return SNAuth.refresh().then(function () { tok = SNAuth.token() || tok; return ask(tok); });
        }
        return r;
      }).then(function (r) {
        window.__snBalStatus = r.status;
        if (r.status === 404) { window.__snBalRpc = false; bankFail = true; paintMoney(); return; }
        if (!r.ok) { bankFail = true; paintMoney(); return; }
        return r.json().then(function (rows) {
          if (rows && !Array.isArray(rows)) rows = [rows];
          var row = rows && rows[0];
          if (!row) { bankFail = true; paintMoney(); return; }
          var db = Number(row.avc_balance);
          if (!isFinite(db)) db = Number(row.balance);
          if (!isFinite(db) || db < 0) { bankFail = true; paintMoney(); return; }
          bankSeen = true; bankFail = false; bankBal = db;
          try { localStorage.setItem("sn:avc", String(db)); } catch (eM) {}
          paintMoney();
        });
      });
    }).catch(function () {
      bankFail = true;
      paintMoney();
      if (bankRetry < 1) { bankRetry++; setTimeout(pullBank, 2500); }
    });
  }
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
  function bearingDeg(a, b) {
    var φ1 = a.lat * Math.PI / 180, φ2 = b.lat * Math.PI / 180;
    var Δλ = (b.lng - a.lng) * Math.PI / 180;
    var y = Math.sin(Δλ) * Math.cos(φ2);
    var x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
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
      "= " + money(total) + " ⭐"
    ];
    return { km: km, base: base, perKm: perKm, extras: extras, fee: fee, cut: cut, food: +food || 0, total: total, text: lines.join("\n") };
  }

  function mapCenter() {
    if (!map) return ATHENS;
    var c = map.getCenter();
    return { lat: c.lat, lng: c.lng };
  }
  function viewCityHint() {
    var c = mapCenter();
    if (c.lat > 35.5 && c.lat < 42 && c.lng > 19 && c.lng < 30) {
      if (haversine(c, RHODES) < 40) return "Rhodes";
      if (haversine(c, ATHENS) < 40) return "Athens";
      return "Greece";
    }
    return "";
  }

  function detectCategory(q) {
    var t = String(q || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
    if (!t) return null;
    if (/^(super\s*markets?|supermarkets?|grocery|groceries)$/.test(t) || /\bsupermarket\b/.test(t)) return CATEGORY.supermarket;
    if (/^(plumber|plumbers|υδραυλικος|υδραυλικός)$/.test(t) || /\bplumber\b/.test(t)) return CATEGORY.plumber;
    if (/^(pharmac(y|ies)|φαρμακειο)$/.test(t)) return CATEGORY.pharmacy;
    if (/^(baker(y|ies)|φουρνος)$/.test(t)) return CATEGORY.bakery;
    if (/^(cafe|coffee|καφε)$/.test(t)) return CATEGORY.cafe;
    if (/^(pizza|pizzeria)$/.test(t)) return CATEGORY.pizza;
    if (/^(restaurant|restaurants)$/.test(t)) return CATEGORY.restaurant;
    if (/^(butcher|butchers)$/.test(t)) return CATEGORY.butcher;
    if (/^(hardware|diy)$/.test(t)) return CATEGORY.hardware;
    return null;
  }

  function geocode(q, opts) {
    opts = opts || {};
    q = String(q || "").trim();
    if (q.length < 2) return Promise.resolve(null);
    var center = opts.center || mapCenter();
    var preferGR = /greece|hellas|athens|athina|rhodes|rodos|crete|syntagma|συνταγμα|αθην/i.test(q) || !!viewCityHint();
    var url = "/api/find?limit=8&q=" + encodeURIComponent(q);
    if (isFinite(center.lat) && isFinite(center.lng)) url += "&lat=" + center.lat.toFixed(5) + "&lng=" + center.lng.toFixed(5);
    if (preferGR && !/greece|hellas/i.test(q)) url += "&city=" + encodeURIComponent(viewCityHint() || "Greece");
    return fetch(url, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      var places = (j && j.places) || [];
      if (!places.length && Array.isArray(j)) places = j;
      var hit = places[0];
      if (!hit && j && j.lat) hit = j;
      if (!hit) {
        return fetch("/api/find?op=nominatim&limit=5&q=" + encodeURIComponent(preferGR ? q + " Greece" : q), { cache: "no-store" })
          .then(function (r) { return r.json(); })
          .then(function (rows) {
            var x = rows && rows[0];
            if (!x || !isFinite(+x.lat)) return null;
            return { lat: +x.lat, lng: +(x.lon || x.lng), name: x.name || x.display_name || q, raw: x.display_name || q, type: x.type || "", cls: x.class || x.cls || "", places: rows };
          });
      }
      return {
        lat: +hit.lat, lng: +(hit.lng || hit.lon), name: hit.name || q, raw: hit.raw || hit.display_name || hit.name || q,
        type: hit.type || "", cls: hit.cls || "", places: places
      };
    }).catch(function () { return null; });
  }

  function overpassCategory(cat, center, radiusM) {
    var tags = (cat.tags || []).map(function (t) {
      return "node" + t + "(around:" + radiusM + "," + center.lat.toFixed(5) + "," + center.lng.toFixed(5) + ");" +
        "way" + t + "(around:" + radiusM + "," + center.lat.toFixed(5) + "," + center.lng.toFixed(5) + ");";
    }).join("");
    var data = "[out:json][timeout:18];(" + tags + ");out center tags 40;";
    if (data.length > 700) data = "[out:json][timeout:15];(node" + cat.tags[0] + "(around:" + radiusM + "," + center.lat.toFixed(5) + "," + center.lng.toFixed(5) + "););out center tags 30;";
    function once(mirror) {
      return fetch("/api/find", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ op: "overpass", mirror: mirror, data: data }),
        cache: "no-store"
      }).then(function (r) { return r.json(); }).then(function (j) {
        if (j && j.ok && Array.isArray(j.elements) && j.elements.length) return j.elements;
        return null;
      }).catch(function () { return null; });
    }
    return once(0).then(function (els) {
      if (els) return els;
      return once(1).then(function (els2) { return els2 || []; });
    }).then(function (els) {
      return (els || []).map(function (e) {
        var c = e.center || e, n = e.tags || {};
        var name = n.name || n.brand || n.operator || "";
        if (!name || /^(plumber|supermarket|shop|store)$/i.test(name)) {
          if (n.brand && !/^(plumber|supermarket)$/i.test(n.brand)) name = n.brand;
          else return null;
        }
        var lat = Number(c.lat), lng = Number(c.lon || c.lng);
        if (!isFinite(lat) || !isFinite(lng)) return null;
        return {
          id: "ov-" + (e.type || "n") + "-" + e.id,
          name: name,
          lat: lat,
          lng: lng,
          phone: n.phone || n["contact:phone"] || "",
          address: [n["addr:street"], n["addr:housenumber"], n["addr:city"]].filter(Boolean).join(" "),
          kind: n.craft || n.shop || n.amenity || cat.label,
          src: "overpass",
          menu: []
        };
      }).filter(Boolean);
    });
  }

  function huntCategory(cat, q) {
    var center = mapCenter();
    var city = viewCityHint();
    if (!city && center.lat > 34 && center.lat < 42 && center.lng > 19 && center.lng < 30) city = "Greece";
    if (!city) city = "Athens";
    /* never bare-geocode the category word (lands in Spain/Germany) */
    var findQ = cat.find + " " + city;
    var url = "/api/find?q=" + encodeURIComponent(findQ) + "&lat=" + center.lat.toFixed(5) + "&lng=" + center.lng.toFixed(5) + "&city=" + encodeURIComponent(city) + "&near=1&radius=12";
    return fetch(url, { cache: "no-store" }).then(function (r) { return r.json(); }).then(function (j) {
      var places = (j && j.places) || [];
      var rows = places.map(function (p) {
        return {
          id: "hunt-" + (p.osm || (p.lat + "," + p.lng)),
          name: p.name,
          lat: +p.lat,
          lng: +p.lng,
          phone: p.phone || "",
          address: p.address || p.raw || "",
          kind: p.kind || cat.label,
          src: p.src || "find",
          menu: []
        };
      }).filter(function (s) {
        if (!s.name || !isFinite(s.lat) || isTestFixture(s)) return false;
        /* belt: never keep pins outside the view city radius (blocks Spain/Germany Photon leaks) */
        return haversine(center, s) < 80;
      });
      if (rows.length) return rows;
      return overpassCategory(cat, center, 12000).then(function (ov) {
        if (ov && ov.length) return ov;
        return [];
      });
    }).catch(function () {
      return overpassCategory(cat, center, 12000).then(function (ov) { return ov || []; });
    });
  }

  function needReady(opts) {
    opts = opts || {};
    var u = me();
    if (!u || !u.email) { say("Sign in first."); if (window.SNAuth && SNAuth.open) SNAuth.open(); return false; }
    var p = profile();
    if (!String(p.name || "").trim() || !String(p.phone || "").trim()) {
      /* 4421: never auto-open PROFILE — honest toast; profile only via explicit menu */
      say("Add your name and phone from ☰ · YOU first.");
      return false;
    }
    var r = roles();
    if (!r.client && !r.vendor && !r.driver) { say("Pick a role in ☰ · YOU. Client, vendor, or driver."); return false; }
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
    if (b) b.textContent = walletLabel();
    var chip = $("sn-wallet-chip");
    if (chip) chip.textContent = walletLabel();
  }
  function paintGps() {
    var b = $("gps");
    if (b) b.classList.toggle("armed", !!placeSelf);
  }
  function paintStamp() {
    var el = $("sn-ribbon");
    if (el) el.textContent = "SpaceNet V4421";
    var m = $("sn-stamp-menu");
    if (m) m.textContent = "SpaceNet V4421";
  }
  function icon(cls, letter) {
    return L.divIcon({ className: "", iconSize: [36, 36], iconAnchor: [18, 18], html: '<div class="pin ' + cls + '">' + esc(letter) + "</div>" });
  }
  function clearHuntPins() {
    huntMarkers.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
    huntMarkers = [];
  }
  function clearMarkers() {
    markers.forEach(function (m) { try { map.removeLayer(m); } catch (e) {} });
    markers = [];
    if (youMarker) { try { map.removeLayer(youMarker); } catch (e) {} youMarker = null; }
    if (dropMarker) { try { map.removeLayer(dropMarker); } catch (e) {} dropMarker = null; }
    if (drvMarker) { try { map.removeLayer(drvMarker); } catch (e) {} drvMarker = null; }
    if (routeLine) { try { map.removeLayer(routeLine); } catch (e) {} routeLine = null; }
  }
  function draw() {
    if (!map) return;
    clearMarkers();
    shops.forEach(function (s) {
      if (!isFinite(+s.lat) || !isFinite(+s.lng)) return;
      if (isTestFixture(s)) return;
      var m = L.marker([+s.lat, +s.lng], { icon: icon("", (s.name || "S").slice(0, 1).toUpperCase()) }).addTo(map);
      m.on("click", function (ev) {
        L.DomEvent.stopPropagation(ev);
        if (holdFired) { holdFired = false; return; } /* hold menu wins over pin */
        openVendor(s);
      });
      markers.push(m);
    });
    var p = places();
    if (p.vendor && isFinite(+p.vendor.lat) && !isTestFixture(p.vendor)) {
      markers.push(L.marker([+p.vendor.lat, +p.vendor.lng], { icon: icon("", "V") }).addTo(map));
    }
    if (here) youMarker = L.marker([here.lat, here.lng], { icon: icon("me", "YOU") }).addTo(map);
    var job = openJob();
    var client = (job && job.client) || (p.client && p.client.listed && !isTestFixture(p.client) ? p.client : null);
    var driver = (job && job.driver) || (p.driver && p.driver.listed && !isTestFixture(p.driver) ? p.driver : null);
    if (client && isFinite(+client.lat)) dropMarker = L.marker([+client.lat, +client.lng], { icon: icon("drop", "C") }).addTo(map);
    if (driver && isFinite(+driver.lat)) drvMarker = L.marker([+driver.lat, +driver.lng], { icon: icon("drv", "D") }).addTo(map);
    var from = job && job.vendor;
    if (from && client && isFinite(+from.lat) && isFinite(+client.lat)) {
      routeLine = L.polyline([[+from.lat, +from.lng], [+client.lat, +client.lng]], {
        color: "#1a3cff", weight: 4, opacity: 0.95, lineCap: "round"
      }).addTo(map);
    }
  }
  function setDrawer(px) {
    px = Math.max(48, Math.min(Math.round(window.innerHeight * 0.42), px));
    document.documentElement.style.setProperty("--drawer-h", px + "px");
  }
  function closeSheet() {
    sheetKind = "";
    $("handle").innerHTML = 'OFFERS <span class="sn-x" data-act="close-sheet" title="Close">✕</span>';
    $("sheet").innerHTML = "";
    setDrawer(48);
    hang();
  }
  function openDrawer(title, html, kind) {
    sheetKind = kind || title || "";
    $("handle").innerHTML = esc(title) + ' <span class="sn-x" data-act="close-sheet" title="Close">✕</span>';
    $("sheet").innerHTML = html;
    setDrawer(Math.min(window.innerHeight * 0.42, Math.max(220, window.innerHeight * 0.38)));
    bindSheet();
    try { $("menu").hidden = true; $("sn-burger").setAttribute("aria-expanded", "false"); } catch (e) {}
  }
  function bindSheet() {
    var sheet = $("sheet");
    if (!sheet) return;
    if (sheet.__bound) return;
    sheet.__bound = true;
    sheet.addEventListener("click", function (e) {
      var b = e.target.closest("[data-act]");
      if (!b) return;
      var act = b.getAttribute("data-act");
      if (act === "close-sheet") { closeSheet(); return; }
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
      else if (act === "open-profile") openProfile(true);
    });
    var handle = $("handle");
    if (handle && !handle.__xBound) {
      handle.__xBound = true;
      handle.addEventListener("click", function (e) {
        if (e.target && e.target.closest && e.target.closest("[data-act=close-sheet]")) {
          e.preventDefault();
          e.stopPropagation();
          closeSheet();
        }
      });
    }
  }
  function talkBar(who, phone) {
    return '<div class="row">' +
      '<button type="button" class="go" data-act="msg" data-who="' + esc(who) + '">MESSAGE</button>' +
      '<button type="button" class="go" data-act="call" data-phone="' + esc(phone || "") + '">CALL</button>' +
      '<button type="button" class="go" data-act="video">VIDEO</button></div>';
  }
  function openProfile(explicit) {
    if (!explicit) return; /* 4421: never auto-open */
    var p = profile();
    openDrawer("PROFILE",
      '<p class="note">Name and phone. Then pick a role in ☰ · YOU and leave power on.</p>' +
      '<input class="field" id="pf-name" placeholder="Name" value="' + esc(p.name || "") + '"/>' +
      '<input class="field" id="pf-phone" placeholder="Phone" value="' + esc(p.phone || "") + '"/>' +
      '<button type="button" class="go primary" data-act="save-profile">SAVE</button>', "PROFILE");
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
    try { $("menu").hidden = true; } catch (e) {}
    var log = json("sn:desk", []);
    var lines = log.slice(-12).map(function (m) { return esc(m.who) + ": " + esc(m.text); }).join("\n");
    openDrawer(myName() + " · SUPPORT",
      (lines ? '<p class="break">' + lines + "</p>" : '<p class="note">This session is in your name. Administrators can track it.</p>') +
      '<textarea class="field" id="sup-text" placeholder="What happened"></textarea>' +
      '<button type="button" class="go primary" data-act="send-support">SEND</button>', "SUPPORT");
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
      openDrawer("OFFERS", '<p class="note">Power is off. Offers stay closed.</p>', "OFFERS");
      return;
    }
    var list = jobs().filter(function (j) { return !j.settled; });
    var html = list.length ? list.map(function (j) {
      return '<button type="button" class="go" data-act="offer" data-id="' + esc(j.id) + '">' +
        esc(j.vendor.name) + " → " + esc(j.client.name || "client") + " · " + money(j.total) + " ⭐</button>";
    }).join("") : '<p class="note">No offer yet. Hold the map 1.5s. List a vendor, a client, and a driver.</p>';
    openDrawer("OFFERS", html, "OFFERS");
  }
  function showMoney() {
    try { $("menu").hidden = true; } catch (e) {}
    var label = walletLabel();
    var note = !signed()
      ? "Guest wallet stays at 0. Sign in for the real ⭐ ledger."
      : (bankSeen
        ? "Personal ⭐ from sn_my_balance (your JWT)."
        : (bankFail ? "Ledger RPC unavailable. Honest unavailable — no invented figure." : "Asking the ledger…"));
    openDrawer("MONEY",
      '<p class="price">' + esc(label.replace(" · guest", "")) + "</p>" +
      '<p class="note">' + esc(note) + "</p>" +
      '<p class="note">SpaceNet V4421</p>', "MONEY");
  }
  function shopById(id) {
    for (var i = 0; i < shops.length; i++) if (shops[i].id === id) return shops[i];
    for (var j = 0; j < huntMarkers.length; j++) { /* no */ }
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
    if (!(p.client && p.client.listed && !isTestFixture(p.client)) || !(p.driver && p.driver.listed && !isTestFixture(p.driver))) {
      return '<p class="note">List a client address and a driver before the price. GPS is not the drop. Hold the map 1.5s.</p>';
    }
    var q = quote(s || p.vendor, p.client, food);
    return '<p class="price">' + money(q.total) + ' <small>⭐</small></p><p class="break">' + esc(q.text) + "</p>";
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
      '<button type="button" class="go primary" data-act="order">ORDER · HOLD ⭐</button>', "VENDOR");
  }
  function addDish(id, i) {
    var s = shopById(id);
    if (!s) {
      /* hunt pin shop may only live in shops after merge */
      shops.forEach(function (x) { if (x.id === id) s = x; });
    }
    if (!s) return;
    if (cartShop !== id) { cartShop = id; cart = {}; }
    cart[i] = (cart[i] || 0) + 1;
    openVendor(s);
  }
  function checkout() {
    if (!needReady()) return;
    var s = shopById(cartShop);
    if (!s) shops.forEach(function (x) { if (x.id === cartShop) s = x; });
    var p = places();
    if (!s) { say("Open a vendor first."); return; }
    var food = cartFood(s);
    if (food <= 0) { say("Add a dish."); return; }
    if (!(p.client && p.client.listed && isFinite(+p.client.lat) && !isTestFixture(p.client))) {
      say("List a client. Hold the map 1.5s, then CLIENT.");
      openList(mapCenter());
      return;
    }
    if (!(p.driver && p.driver.listed && !isTestFixture(p.driver))) {
      say("List a driver. Hold the map 1.5s, then DRIVER.");
      openList(mapCenter());
      return;
    }
    var from = (p.vendor && isFinite(+p.vendor.lat)) ? p.vendor : s;
    var q = quote(from, p.client, food);
    if (signed() && bankSeen && bankBal < q.total) { say("Not enough ⭐. You have " + money(bankBal) + "."); return; }
    if (signed() && bankSeen) {
      bankBal = Math.round((bankBal - q.total) * 100) / 100;
      paintMoney();
    }
    var b = books();
    var clientRow = bookRow(b, "client:" + myName(), myName(), "client");
    clientRow.avc = Math.round(((clientRow.avc || 0) - q.total) * 100) / 100;
    saveBooks(b);
    var items = [];
    (s.menu || []).forEach(function (d, i) { if (cart[i]) items.push({ name: d.name, price: +d.price, n: cart[i] }); });
    var job = {
      id: "j" + Date.now().toString(36),
      t: Date.now(),
      vendor: { id: s.id, name: s.name, lat: +from.lat, lng: +from.lng, phone: s.phone || "" },
      client: { name: p.client.name, address: p.client.address, lat: +p.client.lat, lng: +p.client.lng, listed: true, phone: p.client.phone || profile().phone || "" },
      driver: { name: p.driver.name, lat: +p.driver.lat, lng: +p.driver.lng, listed: true, phone: p.driver.phone || "" },
      items: items,
      food: q.food, km: q.km, fee: q.fee, cut: q.cut, total: q.total, why: q.text,
      pay: "⭐ " + money(q.total) + " HOLD",
      paid: true,
      hold: true,
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
    openDrawer(job.hold && !job.settled ? "HOLD" : "OFFER",
      "<h3>" + esc(job.vendor.name) + "</h3>" +
      '<p class="note">' + esc(job.client.address || job.client.name || "") + " · " + esc(job.driver.name) + "</p>" +
      talkBar("job:" + job.id, job.client.phone || job.driver.phone || "") +
      '<p class="price">' + money(job.total) + ' <small>⭐</small></p>' +
      '<p class="break">' + esc(job.why) + "</p>" +
      '<p class="note">' + esc(job.pay) + (job.settled ? " · settled" : " · on HOLD") + (job.fault ? " · fault " + esc(job.fault) : "") + "</p>" +
      steps +
      '<button type="button" class="go bad" data-act="problem" data-id="' + esc(job.id) + '">PROBLEM</button>', "HOLD");
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
    job.hold = false;
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
    if (signed() && bankSeen) { bankBal = Math.round((bankBal + job.total) * 100) / 100; paintMoney(); }
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
      j.hold = false;
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
      '<button type="button" class="go primary" data-act="send-msg" data-who="' + esc(who) + '">SEND</button>', "MESSAGE");
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
    phone = String(phone || "").trim();
    if (phone) {
      try { location.href = "tel:" + phone; say("Calling " + phone + "…"); return; }
      catch (e) { say("Could not open the dialer."); return; }
    }
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      say("CALL unavailable on this device — no phone number and no microphone.");
      openDrawer("CALL", '<p class="note">CALL is unavailable. There is no phone number on that person, and this device has no call path.</p><button type="button" class="go bad" data-act="hang">CLOSE</button>', "CALL");
      return;
    }
    navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
      hang();
      liveStream = s;
      say("Call is live on this device. Hang up from the drawer.");
      openDrawer("CALL", '<p class="note">Microphone is on. There is no phone number on that person.</p><button type="button" class="go bad" data-act="hang">HANG UP</button>', "CALL");
    }).catch(function () {
      say("CALL unavailable — microphone was refused and no phone number is listed.");
      openDrawer("CALL", '<p class="note">CALL unavailable. Microphone was refused, and there is no phone number on that person.</p><button type="button" class="go bad" data-act="close-sheet">CLOSE</button>', "CALL");
    });
  }
  function videoWho() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { say("VIDEO unavailable on this device."); return; }
    navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(function (s) {
      hang();
      liveStream = s;
      openDrawer("VIDEO", '<video id="vid" autoplay playsinline muted style="width:100%;border-radius:12px;background:#000"></video><button type="button" class="go bad" data-act="hang">HANG UP</button>', "VIDEO");
      var v = $("vid");
      if (v) v.srcObject = s;
    }).catch(function () { say("VIDEO unavailable — camera was refused."); });
  }
  function hang() {
    if (!liveStream) return;
    liveStream.getTracks().forEach(function (t) { t.stop(); });
    liveStream = null;
  }
  var listAt = null;
  function openList(ll) {
    /* 4421: hold always opens the menu (land + sea) at HOLD_MS; readiness checked on list actions */
    listAt = { lat: ll.lat, lng: ll.lng };
    try { $("menu").hidden = true; $("sn-burger").setAttribute("aria-expanded", "false"); } catch (e) {}
    openDrawer("LIST",
      '<p class="note">Hold point · land or sea. Listing does not use GPS as the delivery address.</p>' +
      '<button type="button" class="go" data-act="list-vendor">VENDOR</button>' +
      '<button type="button" class="go" data-act="list-client">CLIENT</button>' +
      '<button type="button" class="go" data-act="list-driver">DRIVER</button>', "LIST");
  }
  function nearestShop(ll) {
    var best = null, bestD = 0.08;
    shops.forEach(function (s) {
      if (isTestFixture(s)) return;
      var d = haversine(ll, s);
      if (d < bestD) { best = s; bestD = d; }
    });
    return best;
  }
  function listVendor() {
    if (!needReady()) return;
    if (!listAt) return;
    var near = nearestShop(listAt);
    var name = near ? near.name : window.prompt("Vendor name at this point");
    if (!name) return;
    if (isTestFixture({ name: name })) { say("Test fixtures stay off the live field."); return; }
    var p = places();
    p.vendor = near ? { id: near.id, name: near.name, lat: +near.lat, lng: +near.lng, listed: true } : { name: name, lat: listAt.lat, lng: listAt.lng, listed: true };
    savePlaces(p);
    say("Vendor listed. " + p.vendor.name);
    draw();
    if (near) openVendor(near);
  }
  function listClient() {
    if (!needReady()) return;
    if (!listAt) return;
    var address = window.prompt("Client address");
    if (!address) return;
    if (isTestFixture({ name: address, address: address })) { say("Test fixtures stay off the live field."); return; }
    say("Checking that address…");
    geocode(address).then(function (hit) {
      if (!hit) { say("That address did not resolve. The pin was not moved."); return; }
      var p = places();
      p.client = { name: hit.name, address: hit.raw || address, lat: hit.lat, lng: hit.lng, listed: true, phone: profile().phone || "" };
      savePlaces(p);
      map.setView([hit.lat, hit.lng], 17);
      dropSearchPin(hit);
      say("Client listed. Pin snapped to the address.");
      draw();
      showOffers();
    });
  }
  function listDriver() {
    if (!needReady()) return;
    if (!listAt) return;
    var name = window.prompt("Driver name");
    if (!name) return;
    if (isTestFixture({ name: name })) { say("Test fixtures stay off the live field."); return; }
    var p = places();
    p.driver = { name: String(name).trim(), lat: listAt.lat, lng: listAt.lng, listed: true };
    savePlaces(p);
    say("Driver listed. " + p.driver.name);
    draw();
  }

  function dropSearchPin(hit) {
    if (!map || !hit || !isFinite(+hit.lat)) return;
    if (searchPin) { try { map.removeLayer(searchPin); } catch (e) {} searchPin = null; }
    searchPin = L.marker([+hit.lat, +hit.lng], { icon: icon("search", "📍") }).addTo(map);
    try { searchPin.bindTooltip(hit.name || hit.raw || "Search", { permanent: false, direction: "top" }); } catch (e2) {}
  }
  function paintHuntPins(rows) {
    clearHuntPins();
    var bounds = [];
    rows.forEach(function (s) {
      if (!isFinite(+s.lat) || isTestFixture(s)) return;
      if (!shops.some(function (x) { return x.id === s.id; })) shops.push(s);
      var m = L.marker([+s.lat, +s.lng], { icon: icon("hunt", (s.name || "?").slice(0, 1).toUpperCase()) }).addTo(map);
      m.on("click", function (ev) {
        L.DomEvent.stopPropagation(ev);
        if (holdFired) { holdFired = false; return; } /* hold menu wins over pin */
        openVendor(s);
      });
      huntMarkers.push(m);
      bounds.push([+s.lat, +s.lng]);
    });
    draw();
    if (bounds.length === 1) map.setView(bounds[0], 16);
    else if (bounds.length > 1) try { map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 }); } catch (e) {}
  }

  function streetZoomFor(hit) {
    var t = String(hit.type || ""), c = String(hit.cls || "");
    if (/square|neighbourhood|neighborhood|suburb|pedestrian|yes|station|tram_stop/.test(t) || /railway|highway|place/.test(c) && /square|suburb|neighbourhood/.test(t)) return 18;
    if (/house|building|address|residential/.test(t)) return 18;
    if (/city|town|municipality|administrative/.test(t)) return 13;
    if (/village|hamlet/.test(t)) return 15;
    return 17;
  }

  function searchTo(q) {
    q = String(q || "").trim();
    if (!q) return;
    var cat = detectCategory(q);
    if (cat) {
      say("Hunting " + cat.label + " near this view…");
      huntCategory(cat, q).then(function (rows) {
        if (!rows || !rows.length) {
          say("No real " + cat.label + " pins near this view. Pan the map or name a city.");
          clearHuntPins();
          return;
        }
        paintHuntPins(rows);
        say(rows.length + " " + cat.label + " pin" + (rows.length === 1 ? "" : "s") + " on the map.");
      });
      return;
    }
    var hitShop = null;
    shops.forEach(function (s) { if (!hitShop && s.name && s.name.toLowerCase().indexOf(q.toLowerCase()) >= 0 && !isTestFixture(s)) hitShop = s; });
    if (hitShop) { map.setView([+hitShop.lat, +hitShop.lng], 17); dropSearchPin(hitShop); openVendor(hitShop); return; }
    say("Searching…");
    geocode(q).then(function (hit) {
      if (!hit) { say("No place for that."); return; }
      /* Syntagma / squares / streets land at neighbourhood zoom, not city */
      var z = streetZoomFor(hit);
      if (/syntagma|συνταγμα|σύνταγμα/i.test(q) || /syntagma|σύνταγμα/i.test(hit.name || "") || /square/i.test(hit.type || "")) z = 18;
      map.setView([hit.lat, hit.lng], z);
      dropSearchPin(hit);
      say(hit.raw || hit.name);
    });
  }

  /* —— GPS: globe → national → city; >3 km/h street driving —— */
  function stopGpsWatch() {
    try { if (gpsWatchId) navigator.geolocation.clearWatch(gpsWatchId); } catch (e) {}
    gpsWatchId = 0;
  }
  function enterDriveView(pt) {
    if (!map || !pt) return;
    gpsSpeed.driving = true;
    try {
      var z = map.getZoom();
      if (z < 17) map.setView([+pt.lat, +pt.lng], 17, { animate: true });
      else map.panTo([+pt.lat, +pt.lng], { animate: true });
    } catch (e) {}
    say("Driving · " + Math.round(gpsSpeed.smooth) + " km/h · street follow");
  }
  function enterDroneView(pt) {
    if (!gpsSpeed.driving) return;
    gpsSpeed.driving = false;
    if (map && pt) try { map.setView([+pt.lat, +pt.lng], Math.min(16, Math.max(14, map.getZoom())), { animate: true }); } catch (e) {}
    say("Drone view · under 3 km/h");
  }
  function onGpsWatchFix(pos) {
    if (!pos || !pos.coords) return;
    var c = pos.coords;
    var pt = { lat: +c.latitude, lng: +c.longitude };
    if (!isFinite(pt.lat) || !isFinite(pt.lng)) return;
    var now = Date.now();
    var kmh = null;
    if (c.speed != null && isFinite(+c.speed) && +c.speed >= 0) kmh = +c.speed * 3.6;
    else if (gpsSpeed.last && gpsSpeed.lastT) {
      var dt = (now - gpsSpeed.lastT) / 1000;
      if (dt > 0.4 && dt < 12) kmh = (haversine(gpsSpeed.last, pt) / dt) * 3600;
    }
    if (kmh == null || !isFinite(kmh)) kmh = gpsSpeed.smooth || 0;
    gpsSpeed.smooth = gpsSpeed.smooth ? (gpsSpeed.smooth * 0.65 + kmh * 0.35) : kmh;
    gpsSpeed.kmh = kmh;
    gpsSpeed.last = { lat: pt.lat, lng: pt.lng };
    gpsSpeed.lastT = now;
    here = { lat: pt.lat, lng: pt.lng, name: "GPS" };
    if (youMarker) try { youMarker.setLatLng([pt.lat, pt.lng]); } catch (e) {}
    else draw();
    if (kmh > DRIVE_KMH) {
      gpsSpeed.belowAt = 0;
      if (gpsSpeed.smooth > DRIVE_KMH) {
        if (!gpsSpeed.driving) enterDriveView(pt);
        else if (map) try { map.panTo([pt.lat, pt.lng], { animate: true }); } catch (e2) {}
      }
    } else {
      if (!gpsSpeed.belowAt) gpsSpeed.belowAt = now;
      if (gpsSpeed.driving && now - gpsSpeed.belowAt >= 20000) enterDroneView(pt);
    }
  }
  function startGpsWatch() {
    if (!navigator.geolocation || gpsWatchId) return;
    try {
      gpsWatchId = navigator.geolocation.watchPosition(onGpsWatchFix, function () {}, { enableHighAccuracy: true, maximumAge: 1000, timeout: 12000 });
    } catch (e) { gpsWatchId = 0; }
  }
  function gpsTierFly(pt) {
    if (!map || !pt || !isFinite(+pt.lat)) return;
    var seq = ++gpsSeq;
    here = { lat: +pt.lat, lng: +pt.lng, name: "GPS" };
    placeSelf = false;
    paintGps();
    draw();
    /* one tier at a time: global → national → city */
    var tiers = [
      { z: 3, ms: 700, say: "Global" },
      { z: 7, ms: 700, say: "National" },
      { z: 15, ms: 0, say: "City" }
    ];
    function step(i) {
      if (seq !== gpsSeq) return;
      var t = tiers[i];
      if (!t) { startGpsWatch(); return; }
      map.setView([pt.lat, pt.lng], t.z, { animate: true });
      say("GPS · " + t.say);
      if (t.ms) setTimeout(function () { step(i + 1); }, t.ms);
      else step(i + 1);
    }
    step(0);
  }
  function goGps() {
    placeSelf = true;
    paintGps();
    say("GPS · locating…");
    if (!navigator.geolocation) {
      say("Location unavailable on this device. Tap the map to place yourself — never guessed from your IP.");
      return;
    }
    navigator.geolocation.getCurrentPosition(function (pos) {
      var pt = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
      if (pt.acc != null && isFinite(+pt.acc) && +pt.acc > 5000) {
        say("Only a rough network position (± " + Math.round(+pt.acc / 1000) + " km). Not used as you; allow precise location, or name a place.");
        placeSelf = false;
        paintGps();
        return;
      }
      gpsTierFly(pt);
    }, function (err) {
      placeSelf = false;
      paintGps();
      var msg = "Location was refused.";
      if (err && err.code === 1) msg = "Location permission denied. Tap the map to place yourself — never guessed from your IP.";
      else if (err && err.code === 2) msg = "Location unavailable. Tap the map to place yourself.";
      else if (err && err.code === 3) msg = "Location timed out. Tap the map to place yourself.";
      say(msg);
    }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 });
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
      if (signed() && bankSeen && delta > 0 && bankBal < delta) { say("Not enough ⭐ to move the drop."); return; }
      if (signed() && bankSeen) { bankBal = Math.round((bankBal - delta) * 100) / 100; paintMoney(); }
      var job = patchJob(current.id, function (j) {
        j.client.lat = next.lat;
        j.client.lng = next.lng;
        j.km = q.km; j.fee = q.fee; j.cut = q.cut; j.total = q.total; j.why = q.text;
        j.pay = "⭐ " + money(q.total) + " HOLD";
      });
      draw();
      if (job) { say("Drop moved. " + money(job.total) + " ⭐."); showJob(job.id); }
    });
    var box = map.getContainer();
    box.addEventListener("pointerdown", function (e) {
      if (e.target.closest && e.target.closest(".leaflet-control, .pin, button, input, a")) return;
      var start = { x: e.clientX, y: e.clientY };
      holdFired = false;
      hold = start;
      start.timer = setTimeout(function () {
        hold = null;
        holdFired = true;
        try {
          var ll = map.mouseEventToLatLng(e);
          /* land and sea alike — open LIST; close ☰ */
          try { $("menu").hidden = true; $("sn-burger").setAttribute("aria-expanded", "false"); } catch (eM) {}
          openList(ll);
        } catch (err) {
          openList(mapCenter());
        }
      }, HOLD_MS);
    }, { passive: true });
    box.addEventListener("pointermove", function (e) {
      if (!hold) return;
      if (Math.hypot(e.clientX - hold.x, e.clientY - hold.y) > 16) { clearTimeout(hold.timer); hold = null; }
    }, { passive: true });
    function endHold() { if (!hold) return; clearTimeout(hold.timer); hold = null; }
    box.addEventListener("pointerup", endHold);
    box.addEventListener("pointercancel", endHold);
    box.addEventListener("pointerleave", endHold);
  }
  function bootDrawer() {
    var handle = $("handle");
    var drag = null;
    handle.addEventListener("pointerdown", function (e) {
      if (e.target && e.target.closest && e.target.closest("[data-act=close-sheet]")) return;
      drag = { y: e.clientY, h: $("drawer").offsetHeight, moved: false };
      try { handle.setPointerCapture(e.pointerId); } catch (err) {}
    });
    handle.addEventListener("pointermove", function (e) {
      if (!drag) return;
      var dy = drag.y - e.clientY;
      if (Math.abs(dy) > 4) drag.moved = true;
      setDrawer(drag.h + dy);
    });
    handle.addEventListener("pointerup", function () {
      if (!drag) return;
      if (!drag.moved) setDrawer($("drawer").offsetHeight > 80 ? 48 : Math.round(window.innerHeight * 0.38));
      if ($("drawer").offsetHeight > 80 && /OFFERS/.test($("handle").textContent || "") && !$("sheet").innerHTML) showOffers();
      drag = null;
    });
  }
  function bootChrome() {
    function bind(id, fn) {
      var el = $(id);
      if (!el || el.__sn4421) return;
      el.__sn4421 = true;
      el.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        try { fn(e); } catch (err) { say("That control failed."); console.error(err); }
      });
    }
    bind("sn-burger", function () {
      var m = $("menu");
      m.hidden = !m.hidden;
      $("sn-burger").setAttribute("aria-expanded", m.hidden ? "false" : "true");
    });
    bind("sn-power", function () { setPower(!powerOn()); });
    bind("sn-money", showMoney);
    bind("sn-support", openSupport);
    bind("sn-support-menu", openSupport);
    bind("sn-profile-menu", function () { openProfile(true); });
    bind("gps", goGps);
    bind("sn-view", function () {
      viewI = (viewI + 1) % 3;
      var z = [16, 13, 10][viewI];
      var c = here || mapCenter();
      map.setView([c.lat, c.lng], z);
      say(["Street", "City", "Island"][viewI]);
    });
    bind("sn-compass", function () {
      var c = here || (openJob() && openJob().client) || RHODES;
      map.setView([c.lat, c.lng], map.getZoom(), { animate: true });
      say("North is up.");
    });
    var form = $("search");
    if (form && !form.__sn4421) {
      form.__sn4421 = true;
      form.addEventListener("submit", function (e) { e.preventDefault(); searchTo($("q").value); });
    }
    bind("mic", function () {
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
    bind("logo", function () { map.setView([RHODES.lat, RHODES.lng], 13); });
    /* Esc closes any sheet; never leave PROFILE stuck */
    if (!window.__snEsc4421) {
      window.__snEsc4421 = true;
      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" || e.keyCode === 27) {
          if ($("menu") && !$("menu").hidden) {
            $("menu").hidden = true;
            $("sn-burger").setAttribute("aria-expanded", "false");
          }
          if (sheetKind || ($("sheet") && $("sheet").innerHTML)) closeSheet();
          var meSheet = $("sn-me-sheet");
          if (meSheet) meSheet.classList.remove("on");
        }
      });
    }
    /* backup bind for sn-me if auth missed it */
    var meBtn = $("sn-me");
    if (meBtn && !meBtn.__sn4421me) {
      meBtn.__sn4421me = true;
      meBtn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (window.SNAuth && SNAuth.open) SNAuth.open();
        else say("Sign-in is not ready yet.");
      });
    }
  }
  function loadShops() {
    fetch("/datanet/menus.json?v=4421").then(function (r) { return r.json(); }).then(function (j) {
      shops = ((j && j.shops) || []).filter(function (s) {
        return s && isFinite(+s.lat) && isFinite(+s.lng) && s.src !== "fake" && !isTestFixture(s);
      });
      draw();
    }).catch(function () { say("Menus did not load."); });
  }
  function scrubLegacyWallet() {
    try {
      var b = JSON.parse(localStorage.getItem("sn:books") || "null");
      if (b && (b.me === 3000000 || b.me === "3000000")) {
        b.me = 0;
        localStorage.setItem("sn:books", JSON.stringify(b));
      }
    } catch (e) {}
  }

  window.SN = {
    say: say,
    paintMoney: paintMoney,
    avcGet: avc,
    walletLabel: walletLabel,
    map: function () { return map; },
    openList: openList,
    setRoleOn: function (role, on) {
      var r = roles();
      r[role] = !!on;
      write("sn:roles", JSON.stringify(r));
    },
    gpsSpeed: function () { return { kmh: gpsSpeed.smooth, driving: gpsSpeed.driving, watching: !!gpsWatchId }; },
    __holdMs: HOLD_MS,
    __build: "4421"
  };
  window.__SN_4421 = true;
  scrubLegacyWallet();
  paintStamp();
  paintPower();
  paintMoney();
  bootMap();
  bootDrawer();
  bootChrome();
  bindSheet();
  closeSheet(); /* start collapsed, no auto PROFILE */
  loadShops();
  draw();
  if (signed()) pullBank();
  setTimeout(function () { if (signed()) pullBank(); }, 800);
  if (navigator.serviceWorker) navigator.serviceWorker.register("/sw.js").then(function (rg) { try { rg.update().catch(function () {}); } catch (e) {} }).catch(function () {});
})();
