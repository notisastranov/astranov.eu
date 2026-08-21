/* Astranov P0 live market 5-10 — Build 20260817110000
 * 5) public.orders write 6) no Rai/defaultMeshDrivers 7) globe seals 8) debug-only demos
 * 9) market name·km·Æ 10) seeking_driver pool near pin
 */
(function (global) {
  'use strict';
  var BUILD = '20260817110000-p0-live-market';
  var sealsLayer = [];
  var seekingLayer = [];

  function log(m, c) { try { if (global.SNCli && SNCli.log) SNCli.log(m, c || 'dim'); } catch (_) {} }
  function snDebug() { try { return /(?:\?|&)sn-debug=1(?:&|$)/.test(String(location.search || '')); } catch (_) { return false; } }
  function isGuest() {
    try {
      if (global.SNAuth && typeof SNAuth.isLoggedIn === 'function' && SNAuth.isLoggedIn()) return false;
      if (global.SNAuth && SNAuth.session && SNAuth.session.user) return false;
      if (global.SNAuth && SNAuth.user) return false;
    } catch (_) {}
    return true;
  }
  function authUserId() {
    try {
      if (global.SNAuth && SNAuth.session && SNAuth.session.user && SNAuth.session.user.id) return SNAuth.session.user.id;
      if (global.SNAuth && SNAuth.user && SNAuth.user.id) return SNAuth.user.id;
    } catch (_) {}
    return null;
  }
  function posNow() {
    return global._snLastPos || (global.SNTasks && SNTasks.pos) || (global.SNGlobe && SNGlobe.focusPos && SNGlobe.focusPos()) || { lat: 36.4341, lng: 28.2176 };
  }
  function baseUrl() { return String((global.SN_CONFIG || {}).sbUrl || global.SB_URL || '').replace(/\/$/, ''); }
  function headers(json) {
    var cfg = global.SN_CONFIG || {};
    var h = { apikey: cfg.sbKey || global.SB_KEY || '', Authorization: 'Bearer ' + (cfg.sbKey || global.SB_KEY || '') };
    if (json) h['Content-Type'] = 'application/json';
    try { if (global.SNAuth && SNAuth.session && SNAuth.session.access_token) h.Authorization = 'Bearer ' + SNAuth.session.access_token; } catch (_) {}
    return h;
  }
  function uuidish(s) { return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(s || '')); }
  function stripVendorId(id) {
    if (!id) return null;
    var s = String(id);
    if (s.indexOf('v_') === 0) s = s.slice(2);
    if (uuidish(s)) return s;
    var m = s.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i);
    return m ? m[0] : null;
  }
  function haversineKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return 999;
    var R = 6371;
    var dLat = ((b.lat - a.lat) * Math.PI) / 180;
    var dLng = ((b.lng - a.lng) * Math.PI) / 180;
    var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function patchDebugOnly() {
    try {
      if (global.SNMarket && !SNMarket._snP0DebugGate) {
        ['prepareFirstTest', 'runTestOrder'].forEach(function (fn) {
          if (typeof SNMarket[fn] !== 'function') return;
          var orig = SNMarket[fn].bind(SNMarket);
          SNMarket[fn] = function () {
            if (!snDebug()) {
              log('Blocked · ' + fn + ' needs ?sn-debug=1', 'dim');
              return Promise.resolve({ ok: false, error: 'debug_only', reply: 'Test tools only with ?sn-debug=1' });
            }
            return orig.apply(SNMarket, arguments);
          };
        });
        if (typeof SNMarket.goLiveStatus === 'function') {
          var gls = SNMarket.goLiveStatus.bind(SNMarket);
          SNMarket.goLiveStatus = function () {
            var r = gls() || {};
            r.test_mode = false;
            r.live = true;
            if (!snDebug()) { try { localStorage.removeItem('sn:test-mode-v1'); } catch (_) {} }
            return r;
          };
        }
        SNMarket._snP0DebugGate = true;
      }
    } catch (_) {}
    try {
      if (global.SNCli && SNCli.handle && !SNCli._snP0DemoGate) {
        var h0 = SNCli.handle.bind(SNCli);
        SNCli.handle = function (line) {
          var low = String(line || '').trim().toLowerCase();
          if (!snDebug() && /^(offers?\s+test|throw offers|demo delivery|demo polygon|test harness|run.?test|test.?order)/i.test(low)) {
            log('Blocked · demo/test CLI needs ?sn-debug=1', 'dim');
            return { ok: false, reply: 'Demo tools only with ?sn-debug=1' };
          }
          return h0(line);
        };
        SNCli._snP0DemoGate = true;
      }
    } catch (_) {}
    try {
      if (global.SNCurrency && SNCurrency.credit && !SNCurrency._snP0CreditGate) {
        var c0 = SNCurrency.credit.bind(SNCurrency);
        SNCurrency.credit = function (a, why) {
          why = String(why || '');
          if (!snDebug() && /test-orders top-up|guest first|welcome|free.?credit|hardcoded|demo/i.test(why)) {
            log('Blocked free credit · ' + why, 'dim');
            return SNCurrency.balance ? SNCurrency.balance() : 0;
          }
          return c0(a, why);
        };
        SNCurrency._snP0CreditGate = true;
      }
    } catch (_) {}
    try { if (!snDebug()) localStorage.removeItem('sn:test-mode-v1'); } catch (_) {}
  }

  function purgeFakeDrivers() {
    try {
      if (!global.SNProfiles || !SNProfiles.list) return;
      (SNProfiles.list({ role: 'driver' }) || []).forEach(function (d) {
        if (!d) return;
        var blob = String(d.id || '') + String(d.name || '') + String(d.source || '');
        if (/defaultMesh|Rai\s*Drone|rai_drone|npc.?driver|fake.?driver|demo.?driver/i.test(blob)) {
          try {
            if (SNProfiles.remove) SNProfiles.remove(d.id);
            else if (SNProfiles.upsert) { d.roles = d.roles || {}; d.roles.driver = false; d.driverOnline = false; SNProfiles.upsert(d); }
          } catch (_) {}
        }
      });
    } catch (_) {}
    try {
      if (global.defaultMeshDrivers) global.defaultMeshDrivers = [];
      if (global.SNChannel && SNChannel.defaultMeshDrivers) SNChannel.defaultMeshDrivers = [];
      if (global.SNMarket && SNMarket.defaultMeshDrivers) SNMarket.defaultMeshDrivers = [];
    } catch (_) {}
  }

  function calcFromRules(orderResult, vendor, drop) {
    var total = Number(orderResult && orderResult.total) || 0;
    var items = (orderResult && orderResult.items) || [];
    var goods = items.reduce(function (s, it) { return s + (Number(it.price) || 0) * (Number(it.qty) || 1); }, 0);
    if (!goods) goods = total;
    var quote = null;
    try {
      if (global.SNDeliveryRules && SNDeliveryRules.quote) {
        quote = SNDeliveryRules.quote({ vendor: vendor, drop: drop, items: items, goods: goods, total: total });
      }
    } catch (_) {}
    var platform = (quote && (quote.platform_fee || quote.platformFee || quote.vault)) != null
      ? Number(quote.platform_fee || quote.platformFee || quote.vault)
      : orderResult.platformFee != null ? Number(orderResult.platformFee) : Math.round(total * 0.03 * 100) / 100;
    var driver = (quote && (quote.driver_fee || quote.driverCut || quote.driver_s)) != null
      ? Number(quote.driver_fee || quote.driverCut || quote.driver_s)
      : orderResult.driverCut != null ? Number(orderResult.driverCut) : Math.round(total * 0.15 * 100) / 100;
    var vendorCut = (quote && (quote.vendor_s || quote.vendorCut)) != null
      ? Number(quote.vendor_s || quote.vendorCut)
      : orderResult.vendorCut != null ? Number(orderResult.vendorCut) : Math.round((total - platform - driver) * 100) / 100;
    return {
      currency: 'EUR', total: total, subtotal: goods, delivery_fee: driver, platform_fee: platform,
      driver_s: driver, vendor_s: vendorCut, total_avc: total, goods_eur: goods, spacenet: true, rules: !!quote
    };
  }

  async function writePublicOrder(orderResult, meta) {
    meta = meta || {};
    if (!orderResult || !orderResult.ok) return { ok: false, error: 'no_order' };
    if (isGuest() && !snDebug()) return { ok: false, error: 'guest_cannot_order' };
    var vendor = orderResult.vendor || meta.vendor || null;
    var drop = orderResult.drop || meta.drop || null;
    var items = orderResult.items || [];
    var task = orderResult.task;
    if (!drop || drop.lat == null || drop.lng == null) {
      log('Order blocked · missing delivery lat/lng', 'dim');
      return { ok: false, error: 'null_address' };
    }
    var address = drop.address || drop.label || drop.name || (Number(drop.lat).toFixed(5) + ',' + Number(drop.lng).toFixed(5));
    var vendorId = stripVendorId((vendor && (vendor.dbId || vendor.uuid || vendor.id)) || orderResult.vendorId || meta.vendorId);
    var calc = calcFromRules(orderResult, vendor, drop);
    var body = {
      vendor_id: vendorId,
      customer_id: authUserId(),
      items: items.map(function (i) { return { name: i.name || i.title || 'Item', qty: Number(i.qty) || 1, price: Number(i.price) || 0 }; }),
      calc: calc,
      status: 'seeking_driver',
      delivery_lat: Number(drop.lat),
      delivery_lng: Number(drop.lng),
      delivery_address: String(address).slice(0, 240),
      notes: 'SpaceNet · Æ ' + calc.total + ' · vault ' + calc.platform_fee + ' · driver ' + calc.driver_s + (task && task.id ? ' · task ' + task.id : ''),
      driver_id: null
    };
    if (!vendorId) delete body.vendor_id;
    var urlBase = baseUrl();
    if (!urlBase) return { ok: false, error: 'no_sb' };
    try {
      var r = await fetch(urlBase + '/rest/v1/orders', {
        method: 'POST',
        headers: Object.assign(headers(true), { Prefer: 'return=representation' }),
        body: JSON.stringify(body)
      });
      var j = await r.json().catch(function () { return null; });
      if (!r.ok) {
        log('public.orders · ' + r.status + ' · ' + (j && (j.message || j.error || j.hint) || 'fail'), 'dim');
        return { ok: false, status: r.status, body: j };
      }
      var row = Array.isArray(j) ? j[0] : j;
      if (task && row && row.id) {
        task.networkId = row.id;
        task.networkShort = row.short_id;
        task.networkStatus = row.status || 'seeking_driver';
      }
      log('public.orders · ' + (row && (row.short_id || row.id) || 'ok') + ' · seeking_driver', 'ok');
      void paintSeeking(vendor, drop, row);
      return { ok: true, order: row };
    } catch (e) {
      log('public.orders · ' + (e && e.message ? e.message : e), 'dim');
      return { ok: false, error: String(e && e.message ? e.message : e) };
    }
  }

  async function onClaim(task, driver) {
    if (!task) return;
    purgeFakeDrivers();
    if (driver && /Rai\s*Drone|defaultMesh/i.test(String(driver.name || '') + String(driver.id || ''))) {
      log('Claim blocked · no Rai Drone / defaultMeshDrivers', 'dim');
      return { ok: false, error: 'fake_driver' };
    }
    var oid = task.networkId;
    if (!oid && uuidish(task.id)) oid = task.id;
    if (!oid) {
      paintSeeking({ lat: task.lat, lng: task.lng, name: task.vendorName }, { lat: task.drop_lat, lng: task.drop_lng }, { status: 'seeking_driver' });
      return { ok: false, error: 'no_network_id' };
    }
    var driverId = driver && (driver.userId || driver.profileId || driver.id);
    if (driverId && String(driverId).indexOf('me') === 0) driverId = authUserId() || driverId;
    var urlBase = baseUrl();
    if (!urlBase) return { ok: false };
    try {
      await fetch(urlBase + '/rest/v1/orders?id=eq.' + encodeURIComponent(oid), {
        method: 'PATCH',
        headers: Object.assign(headers(true), { Prefer: 'return=minimal' }),
        body: JSON.stringify({
          driver_id: uuidish(driverId) ? driverId : null,
          driver_name: driver && driver.name ? String(driver.name).slice(0, 80) : null,
          status: 'assigned'
        })
      });
    } catch (_) {}
    try {
      await fetch(urlBase + '/rest/v1/deliveries', {
        method: 'POST',
        headers: Object.assign(headers(true), { Prefer: 'return=minimal' }),
        body: JSON.stringify({
          requester_id: authUserId() || task.clientId || null,
          runner_id: uuidish(driverId) ? driverId : null,
          pickup_lat: task.lat != null ? Number(task.lat) : null,
          pickup_lng: task.lng != null ? Number(task.lng) : null,
          dropoff_lat: task.drop_lat != null ? Number(task.drop_lat) : null,
          dropoff_lng: task.drop_lng != null ? Number(task.drop_lng) : null,
          pickup_address: task.vendorName || null,
          dropoff_address: task.dropAddress || null,
          description: 'Order ' + (task.networkShort || oid),
          reward_avc: task.driver_s || task.pay || null,
          status: 'accepted'
        })
      });
    } catch (_) {}
    log('Claim · driver set · deliveries row · order ' + String(oid).slice(0, 8), 'ok');
    return { ok: true };
  }

  function clearLayers(arr) {
    (arr || []).forEach(function (Lyr) { try { if (Lyr && Lyr.remove) Lyr.remove(); } catch (_) {} });
    arr.length = 0;
  }
  function sealPoints(a, b) {
    return [0.25, 0.5, 0.75].map(function (t) {
      return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t, t: t };
    });
  }

  async function paintSeeking(vendor, drop, orderRow) {
    if (!vendor || vendor.lat == null || !drop || drop.lat == null) return;
    var v = { lat: Number(vendor.lat), lng: Number(vendor.lng), name: vendor.name || 'Shop' };
    var d = { lat: Number(drop.lat), lng: Number(drop.lng) };
    var dim = !(orderRow && orderRow.driver_id);
    try {
      if (global.SNGlobe && SNGlobe.pulse) {
        SNGlobe.pulse(v.lat, v.lng, 0x44ffaa, v.name, 12000);
        SNGlobe.pulse(d.lat, d.lng, 0x7ec8ff, 'Drop', 12000);
      }
    } catch (_) {}
    try {
      if (global.SNMap && SNMap.active && global.L) {
        var map = await SNMap.ensure();
        if (map) {
          clearLayers(seekingLayer);
          clearLayers(sealsLayer);
          var pts = [[v.lat, v.lng], [d.lat, d.lng]];
          try {
            if (global.SNField && SNField.routePoints) {
              var rp = await SNField.routePoints(v, d);
              if (rp && rp.length >= 2) pts = rp.map(function (p) { return [p.lat, p.lng]; });
            }
          } catch (_) {}
          var poly = L.polyline(pts, {
            color: dim ? '#5a7a9a' : '#00dca0',
            weight: dim ? 3 : 5,
            opacity: dim ? 0.55 : 0.9,
            dashArray: dim ? '8 10' : null
          }).addTo(map);
          poly.bindPopup(dim ? 'SEEKING DRIVER' : 'DRIVER EN ROUTE');
          seekingLayer.push(poly);
          sealPoints(v, d).forEach(function (s, i) {
            var mk = L.circleMarker([s.lat, s.lng], {
              radius: 7, color: '#9ad4ff', fillColor: '#1a6fd4', fillOpacity: 0.95, weight: 2
            }).addTo(map).bindPopup('Seal ' + (i + 1) + '/3');
            sealsLayer.push(mk);
          });
          try { map.fitBounds(poly.getBounds(), { padding: [48, 48], maxZoom: 15 }); } catch (_) {}
          log('Globe · vendor+drop · seeking arc · 3 seals' + (dim ? ' · dim' : ''), 'ok');
        }
      }
    } catch (_) {}
  }

  function patchCallSpaceLinks() {
    try {
      if (global.SNWebRTC && !SNWebRTC._snP0SpaceLinks) {
        if (global.SNSpaceLinks && typeof SNSpaceLinks.startCall === 'function') {
          SNWebRTC.startCall = function () {
            try { return SNSpaceLinks.startCall.apply(SNSpaceLinks, arguments); } catch (_) {}
          };
        }
        SNWebRTC._snP0SpaceLinks = true;
      }
      var style = document.getElementById('sn-p0-no-video-modal');
      if (!style) {
        style = document.createElement('style');
        style.id = 'sn-p0-no-video-modal';
        style.textContent = '.sn-video-call-modal,.video-call-modal,[data-sn-video-call-modal]{display:none!important}';
        (document.head || document.documentElement).appendChild(style);
      }
    } catch (_) {}
  }

  function formatMarketLine(v, pos) {
    var km = haversineKm(pos, v);
    var price = null;
    try { if (v.menu && v.menu[0] && v.menu[0].price != null) price = Number(v.menu[0].price); } catch (_) {}
    var line = (v.shopName || v.name || 'Shop') + ' · ' + km.toFixed(1) + ' km';
    if (price != null && isFinite(price)) line += ' · ' + price.toFixed(2) + ' Æ';
    return line;
  }

  function listMarketPins(maxKm) {
    maxKm = maxKm != null ? maxKm : 8;
    var pos = posNow();
    var list = [];
    try {
      list = (global.SNChromeLiveDelivery && SNChromeLiveDelivery.collectVendorsLive && SNChromeLiveDelivery.collectVendorsLive(maxKm))
        || (global.SNProfiles && SNProfiles.list && SNProfiles.list({ role: 'vendor' })) || [];
    } catch (_) {}
    return list.filter(function (v) { return v && v.lat != null && haversineKm(pos, v) <= maxKm; })
      .map(function (v) { return { id: v.id, name: v.shopName || v.name, lat: v.lat, lng: v.lng, km: haversineKm(pos, v), line: formatMarketLine(v, pos) }; })
      .sort(function (a, b) { return a.km - b.km; });
  }

  function patchMarketUi() {
    try {
      if (!global.SNMarket || SNMarket._snP0MarketUi) return;
      SNMarket.listMarketPins = listMarketPins;
      SNMarket._snP0MarketUi = true;
    } catch (_) {}
  }

  async function pullSeekingPool(opts) {
    opts = opts || {};
    var pos = opts.pos || posNow();
    var maxKm = opts.maxKm != null ? opts.maxKm : 30;
    var urlBase = baseUrl();
    if (!urlBase) return { ok: false, rows: [] };
    try {
      var q = urlBase + '/rest/v1/orders?select=id,short_id,status,vendor_id,vendor_name,items,calc,delivery_lat,delivery_lng,delivery_address,driver_id,created_at'
        + '&status=eq.seeking_driver&delivery_lat=not.is.null&delivery_lng=not.is.null&limit=40';
      var r = await fetch(q, { headers: headers(false), cache: 'no-store' });
      if (!r.ok) return { ok: false, rows: [] };
      var rows = await r.json();
      if (!Array.isArray(rows)) rows = [];
      rows = rows.filter(function (o) {
        return o && o.delivery_lat != null && o.delivery_lng != null
          && haversineKm(pos, { lat: o.delivery_lat, lng: o.delivery_lng }) <= maxKm;
      });
      rows.forEach(function (o) {
        try {
          if (global.SNOfferStack && SNOfferStack.pushTask) {
            SNOfferStack.pushTask({
              id: 'net_' + o.id, networkId: o.id, kind: 'delivery', status: 'seeking_driver',
              lat: o.delivery_lat, lng: o.delivery_lng, drop_lat: o.delivery_lat, drop_lng: o.delivery_lng,
              vendorName: o.vendor_name || 'Shop', source: 'spacenet-mesh'
            }, { quiet: true });
          }
        } catch (_) {}
      });
      if (rows.length) log('Pool · seeking_driver · ' + rows.length + ' near pin', 'ok');
      return { ok: true, rows: rows };
    } catch (_) { return { ok: false, rows: [] }; }
  }

  function hookPlaceOrder() {
    try {
      if (!global.SNProfiles || !SNProfiles.placeOrder || SNProfiles._snP0OrdersHook) return;
      var orig = SNProfiles.placeOrder.bind(SNProfiles);
      SNProfiles.placeOrder = function (opts) {
        if (isGuest() && !snDebug()) {
          try { if (global.SNChromeGuestOrderGate && SNChromeGuestOrderGate.deny) return SNChromeGuestOrderGate.deny('placeOrder'); } catch (_) {}
          return { ok: false, error: 'guest_cannot_order', reply: 'Sign in with Google to order. First Locate your place.' };
        }
        var r = orig(opts);
        try {
          if (r && r.ok) {
            void writePublicOrder(r, { vendor: r.vendor, drop: r.drop });
            if (global.SNMeshOrders && SNMeshOrders.afterLocalOrder) void SNMeshOrders.afterLocalOrder(r, { vendor: r.vendor, drop: r.drop });
          }
        } catch (_) {}
        return r;
      };
      SNProfiles._snP0OrdersHook = true;
    } catch (_) {}
  }

  function hookClaim() {
    try {
      if (!global.SNTasks || !SNTasks.claim || SNTasks._snP0ClaimHook) return;
      var c0 = SNTasks.claim.bind(SNTasks);
      SNTasks.claim = function (taskId, driver) {
        if (driver && /Rai\s*Drone|defaultMesh/i.test(String(driver.name || '') + String(driver.id || ''))) {
          log('No Rai Drone · use real online driver profile', 'dim');
          return { ok: false, error: 'fake_driver' };
        }
        var r = c0.apply(SNTasks, arguments);
        try { if (r && r.ok && r.task) void onClaim(r.task, driver || r.driver); } catch (_) {}
        return r;
      };
      SNTasks._snP0ClaimHook = true;
    } catch (_) {}
  }

  function boot() {
    patchDebugOnly();
    purgeFakeDrivers();
    patchCallSpaceLinks();
    patchMarketUi();
    hookPlaceOrder();
    hookClaim();
    void pullSeekingPool({ maxKm: 40 });
    setTimeout(function () {
      patchDebugOnly(); purgeFakeDrivers(); patchCallSpaceLinks(); patchMarketUi();
      hookPlaceOrder(); hookClaim(); void pullSeekingPool({ maxKm: 40 });
    }, 2500);
    setInterval(function () {
      purgeFakeDrivers();
      if (!snDebug()) { try { localStorage.removeItem('sn:test-mode-v1'); } catch (_) {} }
      void pullSeekingPool({ maxKm: 40 });
    }, 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 3500);

  global.SNChromeP0LiveMarket = {
    build: BUILD,
    writePublicOrder: writePublicOrder,
    pullSeekingPool: pullSeekingPool,
    listMarketPins: listMarketPins,
    paintSeeking: paintSeeking,
    snDebug: snDebug
  };
})(typeof window !== 'undefined' ? window : globalThis);
