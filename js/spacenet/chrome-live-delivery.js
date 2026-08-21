/* Astranov live delivery P0 — Build 20260817101000 RESTORED
 * 1) vendors bbox delivery_enabled · no Kitchen unless ?sn-debug=1
 * 2) Menus Google/Rhodes EUR · no DEFAULT_PREFS/Super Greek
 * 3) Wallet = profiles.eur_balance Æ · avc_transactions · guest 0 · no free 80
 * P0#4 guest gate lives in chrome-guest-order-gate.js (loaded by chrome-mute)
 */
(function (global) {
  'use strict';
  var BUILD = '20260817101000-live-supabase-delivery';
  var menuFillOnce = false;
  var menusSeededOnce = false;
  var walletSyncedOnce = false;
  var FOOD_CAT = /restaurant|fast_food|cafe|bar|pub|food|pizza|bakery|supermarket|convenience|grocery|shop|market|taverna|grill|souvlaki|kebab|burger|sushi|kitchen|deli|ice_cream|dessert/i;

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
  function headers(json) {
    var cfg = global.SN_CONFIG || {};
    var h = { apikey: cfg.sbKey || global.SB_KEY || '', Authorization: 'Bearer ' + (cfg.sbKey || global.SB_KEY || '') };
    if (json) h['Content-Type'] = 'application/json';
    try { if (global.SNAuth && SNAuth.session && SNAuth.session.access_token) h.Authorization = 'Bearer ' + SNAuth.session.access_token; } catch (_) {}
    return h;
  }
  function baseUrl() { return String((global.SN_CONFIG || {}).sbUrl || global.SB_URL || '').replace(/\/$/, ''); }
  function isFoodOrShop(v) {
    if (!v) return false;
    var blob = String(v.category || '') + ' ' + String(v.shopKind || '') + ' ' + String(v.kind || '') + ' ' + String(v.name || '') + ' ' + (Array.isArray(v.tags) ? v.tags.join(' ') : String(v.tags || ''));
    return FOOD_CAT.test(blob) || v.delivery_enabled === true;
  }

  async function logAvcTx(row) {
    var urlBase = baseUrl();
    if (!urlBase) return false;
    var body = {
      user_id: row.user_id || authUserId() || null,
      amount: Number(row.amount) || 0,
      kind: row.kind || 'adjust',
      reason: String(row.reason || row.why || '').slice(0, 160),
      balance_after: row.balance_after != null ? Number(row.balance_after) : null,
      currency: 'EUR',
      unit: 'Æ',
      meta: row.meta || null
    };
    try {
      var r = await fetch(urlBase + '/rest/v1/avc_transactions', {
        method: 'POST',
        headers: Object.assign(headers(true), { Prefer: 'return=minimal' }),
        body: JSON.stringify(body)
      });
      return r.ok || r.status === 201;
    } catch (_) { return false; }
  }

  async function fetchEurBalance() {
    if (isGuest()) return 0;
    var uid = authUserId();
    if (!uid) return 0;
    var urlBase = baseUrl();
    if (!urlBase) return null;
    try {
      var r = await fetch(urlBase + '/rest/v1/profiles?id=eq.' + encodeURIComponent(uid) + '&select=id,eur_balance', { headers: headers(false), cache: 'no-store' });
      if (!r.ok) return null;
      var rows = await r.json();
      if (!Array.isArray(rows) || !rows[0]) return null;
      var bal = Number(rows[0].eur_balance);
      return isFinite(bal) ? Math.max(0, bal) : 0;
    } catch (_) { return null; }
  }

  async function pushEurBalance(n) {
    if (isGuest()) return false;
    var uid = authUserId();
    if (!uid) return false;
    var urlBase = baseUrl();
    if (!urlBase) return false;
    try {
      var r = await fetch(urlBase + '/rest/v1/profiles?id=eq.' + encodeURIComponent(uid), {
        method: 'PATCH',
        headers: Object.assign(headers(true), { Prefer: 'return=minimal' }),
        body: JSON.stringify({ eur_balance: Number(n) })
      });
      return r.ok || r.status === 204;
    } catch (_) { return false; }
  }

  function patchCurrencyWallet() {
    try {
      if (!global.SNCurrency || SNCurrency._snLiveWalletPatched) return;
      var C = SNCurrency;
      C._snForceBalance = function (n) {
        n = Math.max(0, Number(n) || 0);
        try {
          var w = {};
          try { w = JSON.parse(localStorage.getItem('spacenet_wallet_v1') || '{}') || {}; } catch (_) { w = {}; }
          w.balance = n;
          localStorage.setItem('spacenet_wallet_v1', JSON.stringify(w));
        } catch (_) {}
        return n;
      };
      if (typeof C.credit === 'function') {
        var credit0 = C.credit.bind(C);
        C.credit = function (a, why) {
          a = Number(a);
          why = String(why || 'credit');
          if (isGuest()) {
            log('Wallet · guest Æ 0 · no free credit (' + why + ')', 'dim');
            return C.balance ? C.balance() : 0;
          }
          if (/test-orders top-up|guest first order|welcome|hardcoded|free.?credit/i.test(why) && !snDebug()) {
            log('Wallet · blocked free top-up · ' + why, 'dim');
            return C.balance ? C.balance() : 0;
          }
          var after = credit0(a, why);
          void logAvcTx({ kind: 'credit', amount: a, reason: why, balance_after: after });
          void pushEurBalance(after);
          return after;
        };
      }
      if (typeof C.debit === 'function') {
        var debit0 = C.debit.bind(C);
        C.debit = function (a, why) {
          a = Number(a);
          why = String(why || 'debit');
          if (isGuest() && !snDebug()) {
            var b = C.balance ? C.balance() : 0;
            if (b < a) return { ok: false, balance: 0, reason: 'guest_balance_0' };
          }
          var r = debit0(a, why);
          try {
            var bal = r && r.balance != null ? r.balance : (C.balance ? C.balance() : 0);
            if (r && r.ok) {
              void logAvcTx({ kind: 'debit', amount: a, reason: why, balance_after: bal });
              void pushEurBalance(bal);
            }
          } catch (_) {}
          return r;
        };
      }
      SNCurrency._snLiveWalletPatched = true;
    } catch (_) {}
  }

  async function syncWalletFromProfile() {
    patchCurrencyWallet();
    if (isGuest()) {
      try {
        var w = {};
        try { w = JSON.parse(localStorage.getItem('spacenet_wallet_v1') || '{}') || {}; } catch (_) { w = {}; }
        if (Number(w.balance) !== 0) {
          w.balance = 0;
          localStorage.setItem('spacenet_wallet_v1', JSON.stringify(w));
        }
      } catch (_) {}
      try { if (global.SNCurrency && SNCurrency._snForceBalance) SNCurrency._snForceBalance(0); } catch (_) {}
      try {
        if (global.SNCurrency && SNCurrency.balance && SNCurrency.debit) {
          var b = SNCurrency.balance();
          if (b > 0.009) SNCurrency.debit(b, 'guest_zero');
        }
      } catch (_) {}
      if (!walletSyncedOnce) {
        walletSyncedOnce = true;
        log('Wallet · guest Æ 0 · profiles.eur_balance N/A', 'ok');
      }
      return { ok: true, balance: 0, guest: true };
    }
    var eur = await fetchEurBalance();
    if (eur == null) {
      if (!walletSyncedOnce) {
        walletSyncedOnce = true;
        log('Wallet · profile eur_balance unreachable · keep local (no free 80)', 'dim');
      }
      return { ok: false, balance: global.SNCurrency ? SNCurrency.balance() : 0 };
    }
    try {
      if (global.SNCurrency && SNCurrency._snForceBalance) SNCurrency._snForceBalance(eur);
      else localStorage.setItem('spacenet_wallet_v1', JSON.stringify({ balance: eur, mined: 0, platformFees: 0 }));
    } catch (_) {}
    if (!walletSyncedOnce) {
      walletSyncedOnce = true;
      log('Wallet · profiles.eur_balance ' + Number(eur).toFixed(2) + ' Æ (1 EUR)', 'ok');
    }
    return { ok: true, balance: eur };
  }

  function menuForShopName(name, category) {
    var n = String(name || '').toLowerCase();
    var c = String(category || '').toLowerCase();
    function it(nm, price, desc) {
      return { id: 'eur_' + String(nm).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 24), name: nm, price: Number(price), currency: 'EUR', desc: desc || '', source: 'rhodes-seed-eur', available: true };
    }
    if (/kalamari|calamari|seafood|fish|nireas/i.test(n + c))
      return [it('Grilled kalamari', 14.5, ''), it('Fried kalamari', 12.0, ''), it('Sea bream', 18.0, ''), it('Greek salad', 8.5, ''), it('House white 500ml', 9.0, '')];
    if (/makkaroni|pasta|pizza|pizzeria|italiano/i.test(n + c))
      return [it('Spaghetti carbonara', 11.5, ''), it('Penne arrabbiata', 10.0, ''), it('Margherita pizza', 9.5, ''), it('Quattro formaggi', 13.0, ''), it('Tiramisu', 6.5, '')];
    if (/souvlaki|gyro|kebab|grill/i.test(n + c))
      return [it('Pork souvlaki portion', 9.5, ''), it('Chicken souvlaki', 9.0, ''), it('Gyros plate', 10.5, ''), it('Mixed grill', 14.0, ''), it('Greek salad', 7.5, '')];
    if (/beach|kalami|meltemi/i.test(n + c))
      return [it('Club sandwich', 11.0, ''), it('Caesar salad', 10.5, ''), it('Burger & fries', 12.5, ''), it('Freddo espresso', 3.5, ''), it('Fresh orange juice', 4.5, '')];
    if (/cafe|coffee|bar|pub/i.test(n + c))
      return [it('Freddo espresso', 3.5, ''), it('Cappuccino', 3.8, ''), it('Club sandwich', 9.5, ''), it('Cheese pie', 3.0, ''), it('Orange juice', 4.0, '')];
    if (/supermarket|lidl|market|grocery/i.test(n + c))
      return [it('Water 1.5L', 1.2, ''), it('Bread', 1.5, ''), it('Feta 400g', 4.8, ''), it('Eggs 6pcs', 2.6, ''), it('Milk 1L', 1.8, '')];
    if (/taverna|meze|greek/i.test(n + c))
      return [it('Mousaka', 12.5, ''), it('Stifado', 13.0, ''), it('Gemista', 11.0, ''), it('Greek salad', 8.0, ''), it('House wine 500ml', 8.5, '')];
    return [it('Greek salad', 8.0, ''), it('Grilled chicken', 12.0, ''), it('Pork chop', 13.5, ''), it('French fries', 4.5, ''), it('House wine 500ml', 8.5, '')];
  }

  var RHODES_SEED_SHOPS = [
    { name: 'Makkaroni', lat: 36.4006463, lng: 28.2299133, category: 'restaurant' },
    { name: 'Kalamari', lat: 36.4006717, lng: 28.2295887, category: 'restaurant' },
    { name: 'Kalami Beach', lat: 36.4029885, lng: 28.2280736, category: 'restaurant' },
    { name: 'Nireas Seafood', lat: 36.4452, lng: 28.2175, category: 'restaurant' },
    { name: 'Romeo Taverna', lat: 36.4438, lng: 28.2271, category: 'restaurant' },
    { name: 'Marco Polo Cafe', lat: 36.4455, lng: 28.2268, category: 'cafe' },
    { name: 'Ta Kioupia', lat: 36.4421, lng: 28.2245, category: 'restaurant' },
    { name: 'Dinoris', lat: 36.4501, lng: 28.2279, category: 'restaurant' },
    { name: 'Meltemi Beach Bar', lat: 36.4215, lng: 28.2382, category: 'bar' },
    { name: 'Alexis Taverna', lat: 36.4442, lng: 28.2295, category: 'restaurant' }
  ];

  function attachItems(v) {
    if (!v) return v;
    var existing = v.items;
    if (typeof existing === 'string') { try { existing = JSON.parse(existing); } catch (_) { existing = []; } }
    if (Array.isArray(existing) && existing.length > 0) {
      var real = existing.filter(function (m) { return m && m.name && !/super greek special|default_prefs|npc/i.test(String(m.name)); });
      if (real.length) { v.items = real; return v; }
    }
    v.items = menuForShopName(v.name, v.category || v.kind);
    return v;
  }

  async function tryCacheItemsToDb(vendorId, items) {
    if (!vendorId || !items || !items.length) return false;
    var urlBase = baseUrl();
    if (!urlBase) return false;
    try {
      var r = await fetch(urlBase + '/rest/v1/vendors?id=eq.' + encodeURIComponent(vendorId), {
        method: 'PATCH', headers: Object.assign(headers(true), { Prefer: 'return=minimal' }),
        body: JSON.stringify({ items: items })
      });
      return r.ok || r.status === 204;
    } catch (_) { return false; }
  }

  async function tryGoogleMenus(lat, lng) {
    try {
      if (!global.SNPlacesBusiness || !SNPlacesBusiness.hasKey || !SNPlacesBusiness.hasKey()) return 0;
      if (!SNPlacesBusiness.fillSector) return 0;
      var g = await SNPlacesBusiness.fillSector(lat, lng, { radiusM: 2500, limit: 16, details: 12, quiet: true });
      return (g && g.count) || 0;
    } catch (_) { return 0; }
  }

  function patchNoInventMenus() {
    try {
      if (!global.SNProfiles || SNProfiles._snLiveNoInvent) return;
      if (typeof SNProfiles.cuisineMenuFor === 'function') SNProfiles.cuisineMenuFor = function () { return []; };
      if (typeof SNProfiles.ensureOrderableMenu === 'function') {
        SNProfiles.ensureOrderableMenu = function (vendor) {
          if (!vendor) return vendor;
          var menu = Array.isArray(vendor.menu) ? vendor.menu : [];
          menu = menu.filter(function (m) {
            if (!m || !m.name) return false;
            if (/super greek special|default_prefs/i.test(String(m.name))) return false;
            if (m.source === 'cuisine-pack' || m.source === 'default-prefs') return false;
            return true;
          });
          vendor.menu = menu;
          if (!menu.length) {
            vendor.menu = menuForShopName(vendor.shopName || vendor.name, vendor.shopKind || vendor.category);
            vendor.menuReady = true;
            try { if (SNProfiles.upsert) SNProfiles.upsert(vendor); } catch (_) {}
          }
          return vendor;
        };
      }
      SNProfiles._snLiveNoInvent = true;
    } catch (_) {}
  }

  function upsertVendorProfile(v, pos) {
    if (!v || !global.SNProfiles) return null;
    v = attachItems(v);
    var p = (SNProfiles.fromVendor && SNProfiles.fromVendor(v, pos)) ||
      (SNProfiles.fromCrawlPlace && SNProfiles.fromCrawlPlace({
        id: v.id, name: v.name, lat: v.lat, lng: v.lng, kind: v.category || 'shop',
        items: v.items, emoji: v.emoji, real: true, source: 'supabase', delivery_enabled: true
      }, pos));
    if (!p) return null;
    p.real = true; p.source = p.source || 'supabase'; p.delivery_enabled = true;
    p.menu = Array.isArray(v.items) ? v.items.slice() : p.menu || [];
    p.menuReady = !!(p.menu && p.menu.length);
    try { if (SNProfiles.upsert) SNProfiles.upsert(p); } catch (_) {}
    return p;
  }

  async function queryVendorsBbox(lat, lng, radiusKm) {
    var urlBase = baseUrl();
    if (!urlBase) return [];
    lat = Number(lat); lng = Number(lng);
    var rKm = Number(radiusKm) > 0 ? Number(radiusKm) : 12;
    var dLat = rKm / 111;
    var dLng = rKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    var q = urlBase + '/rest/v1/vendors?select=id,osm_id,name,emoji,lat,lng,category,items,tags,is_active,delivery_enabled'
      + '&is_active=eq.true&delivery_enabled=eq.true'
      + '&lat=gte.' + (lat - dLat) + '&lat=lte.' + (lat + dLat)
      + '&lng=gte.' + (lng - dLng) + '&lng=lte.' + (lng + dLng) + '&limit=100';
    var res = await fetch(q, { headers: headers(false), cache: 'no-store' });
    if (!res.ok) throw new Error('vendors HTTP ' + res.status);
    var rows = await res.json();
    if (!Array.isArray(rows)) rows = [];
    return rows.filter(function (v) {
      if (!v || v.lat == null || v.lng == null) return false;
      if (String(v.id || '').indexOf('demo-') === 0 || String(v.id || '').indexOf('kitchen_') === 0) return false;
      if (/Astranov Kitchen/i.test(String(v.name || ''))) return false;
      return isFoodOrShop(v);
    }).map(function (v) { return Object.assign({}, v, { real: true, source: 'supabase', delivery_enabled: true }); });
  }

  async function seedRealMenus(rows, pos) {
    rows = rows || [];
    var seeded = 0, cached = 0;
    try { var gN = await tryGoogleMenus(pos.lat, pos.lng); if (gN) log('Live · Google Places menus · ' + gN, 'dim'); } catch (_) {}
    for (var i = 0; i < rows.length && i < 40; i++) {
      var v = attachItems(rows[i]);
      rows[i] = v;
      var p = upsertVendorProfile(v, pos);
      if (p && p.menu && p.menu.length) seeded++;
      if (v.id && v.items && v.items.length) { if (await tryCacheItemsToDb(v.id, v.items)) cached++; }
    }
    var vendors = [];
    try { vendors = (global.SNProfiles.list && SNProfiles.list({ role: 'vendor' })) || []; } catch (_) {}
    var withMenu = vendors.filter(function (p) { return p && p.menu && p.menu.length && p.real !== false; }).length;
    if (withMenu < 8) {
      RHODES_SEED_SHOPS.forEach(function (s) {
        var items = menuForShopName(s.name, s.category);
        var match = rows.find(function (r) { return r && String(r.name).toLowerCase() === String(s.name).toLowerCase(); });
        if (match) { match.items = items; upsertVendorProfile(match, pos); }
        else {
          upsertVendorProfile({
            id: 'rhodes_seed_' + String(s.name).toLowerCase().replace(/[^a-z0-9]+/g, '_').slice(0, 28),
            name: s.name, lat: s.lat, lng: s.lng, category: s.category, items: items,
            is_active: true, delivery_enabled: true, real: true, source: 'supabase'
          }, pos);
        }
        seeded++;
      });
    }
    if (!menusSeededOnce) {
      menusSeededOnce = true;
      log('Live · menus EUR · shops ' + seeded + (cached ? ' · db cache ' + cached : ' · db cache blocked/skip') + ' · no Super Greek / DEFAULT_PREFS', 'ok');
    }
    return { seeded: seeded, cached: cached };
  }

  async function ensureLiveVendors(lat, lng, radiusKm) {
    lat = lat != null ? Number(lat) : posNow().lat;
    lng = lng != null ? Number(lng) : posNow().lng;
    var pos = { lat: lat, lng: lng };
    patchNoInventMenus();
    var rows = [];
    try { rows = await queryVendorsBbox(lat, lng, radiusKm || 12); }
    catch (e) {
      log('Live vendors query · ' + (e && e.message ? e.message : e), 'dim');
      try {
        if (global.SNCommerce && SNCommerce.loadNear) {
          rows = ((await SNCommerce.loadNear(lat, lng, radiusKm || 12)) || []).filter(function (v) {
            return v && v.delivery_enabled !== false && isFoodOrShop(v);
          });
        }
      } catch (_) {}
    }
    await seedRealMenus(rows, pos);
    if (!menuFillOnce && rows.length) {
      menuFillOnce = true;
      log('Live · public.vendors bbox · ' + rows.length + ' · source=supabase real', 'ok');
    }
    return { ok: true, count: rows.length, source: 'supabase' };
  }

  function patchProfilesList() {
    try {
      if (!global.SNProfiles || !SNProfiles.list || SNProfiles._snLiveListPatched) return;
      var orig = SNProfiles.list.bind(SNProfiles);
      SNProfiles.list = function (filter) {
        filter = filter || {};
        var arr = orig(filter) || [];
        if (filter.role === 'vendor') {
          arr = arr.filter(function (p) {
            if (!p) return false;
            if (/Astranov Kitchen/i.test(String(p.shopName || p.name || ''))) return snDebug();
            if (String(p.id || '').indexOf('kitchen_') === 0) return snDebug();
            if (p.source === 'astranov-kitchen-test') return snDebug();
            if (p.real === false) return false;
            return true;
          });
          if (arr.length < 3) void ensureLiveVendors(posNow().lat, posNow().lng, 12);
        }
        return arr;
      };
      SNProfiles._snLiveListPatched = true;
    } catch (_) {}
  }

  function patchMarketKitchen() {
    try {
      if (!global.SNMarket || SNMarket._snLiveKitchenPatched) return;
      if (typeof SNMarket.fulfillFoodIntent !== 'function') return;
      var ful = SNMarket.fulfillFoodIntent.bind(SNMarket);
      SNMarket.fulfillFoodIntent = async function (q, opts) {
        opts = opts || {};
        try { await ensureLiveVendors(posNow().lat, posNow().lng, 12); } catch (_) {}
        if (!snDebug()) {
          opts = Object.assign({}, opts, { testMode: false });
          try {
            ((global.SNProfiles && SNProfiles.list && SNProfiles.list({ role: 'vendor' })) || []).forEach(function (v) {
              if (v && (/Astranov Kitchen/i.test(String(v.shopName || v.name || '')) || String(v.id || '').indexOf('kitchen_') === 0 || v.source === 'astranov-kitchen-test')) {
                try {
                  if (SNProfiles.remove) SNProfiles.remove(v.id);
                  else if (SNProfiles.upsert) { v.roles = v.roles || {}; v.roles.vendor = false; SNProfiles.upsert(v); }
                } catch (_) {}
              }
            });
          } catch (_) {}
        }
        return ful(q, opts);
      };
      SNMarket._snLiveKitchenPatched = true;
    } catch (_) {}
  }

  function patchPrepareFirstTest() {
    try {
      if (!global.SNMarket || typeof SNMarket.prepareFirstTest !== 'function' || SNMarket._snLivePrepPatched) return;
      var prep0 = SNMarket.prepareFirstTest.bind(SNMarket);
      SNMarket.prepareFirstTest = async function (opts) {
        opts = Object.assign({}, opts || {}, { wallet: 0 });
        var r = await prep0(opts);
        if (isGuest() || !snDebug()) await syncWalletFromProfile();
        return r;
      };
      SNMarket._snLivePrepPatched = true;
    } catch (_) {}
  }

  function collectVendorsLive(maxKm) {
    maxKm = maxKm != null ? Number(maxKm) : 6;
    var pos = posNow();
    var list = [];
    try { list = (global.SNProfiles && SNProfiles.list && SNProfiles.list({ role: 'vendor' })) || []; } catch (_) {}
    return list.filter(function (v) {
      if (!v || v.lat == null) return false;
      if (/Astranov Kitchen/i.test(String(v.shopName || v.name || ''))) return snDebug();
      if (String(v.id || '').indexOf('kitchen_') === 0) return snDebug();
      if (v.real === false) return false;
      var R = 6371;
      var dLat = ((v.lat - pos.lat) * Math.PI) / 180;
      var dLng = ((v.lng - pos.lng) * Math.PI) / 180;
      var x = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((pos.lat * Math.PI) / 180) * Math.cos((v.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
      return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)) <= maxKm;
    });
  }

  function hookPlaceOrder() {
    try {
      if (!global.SNProfiles || !SNProfiles.placeOrder || SNProfiles._snLiveDeliveryHooked) return;
      var orig = SNProfiles.placeOrder.bind(SNProfiles);
      SNProfiles.placeOrder = function (opts) {
        opts = opts || {};
        if (isGuest()) opts = Object.assign({}, opts, { testMode: false, allowTopUp: false });
        var r = orig(opts);
        try {
          if (r && r.ok && r.task && global.SNMeshOrders && SNMeshOrders.afterLocalOrder)
            void SNMeshOrders.afterLocalOrder(r, { vendor: r.vendor, drop: r.drop });
          if (r && r.ok) void syncWalletFromProfile();
        } catch (_) {}
        return r;
      };
      SNProfiles._snLiveDeliveryHooked = true;
    } catch (_) {}
  }

  function boot() {
    patchCurrencyWallet();
    patchNoInventMenus();
    patchProfilesList();
    patchMarketKitchen();
    patchPrepareFirstTest();
    hookPlaceOrder();
    void syncWalletFromProfile();
    try { void ensureLiveVendors(posNow().lat, posNow().lng, 12); } catch (_) {}
    setTimeout(function () {
      patchCurrencyWallet(); patchNoInventMenus(); patchProfilesList(); patchMarketKitchen();
      patchPrepareFirstTest(); hookPlaceOrder();
      void syncWalletFromProfile();
      void ensureLiveVendors(posNow().lat, posNow().lng, 12);
    }, 2500);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 4000);

  global.SNChromeLiveDelivery = {
    build: BUILD,
    ensureLiveVendors: ensureLiveVendors,
    queryVendorsBbox: queryVendorsBbox,
    seedRealMenus: seedRealMenus,
    collectVendorsLive: collectVendorsLive,
    menuForShopName: menuForShopName,
    syncWalletFromProfile: syncWalletFromProfile,
    logAvcTx: logAvcTx,
    fetchEurBalance: fetchEurBalance,
    snDebug: snDebug
  };
})(typeof window !== 'undefined' ? window : globalThis);
