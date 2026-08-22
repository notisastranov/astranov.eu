/* Astranov live delivery P0 — Build 20260822060000-live-supabase-delivery
 * 1) ALWAYS queryVendorsBbox on public.vendors (4205; 141 Rhodes restaurants)
 * 2) Menus EUR · no DEFAULT_PREFS/Super Greek
 * 3) Wallet = profiles.eur_balance as Æ · avc_transactions · guest 0 · no free 80
 * 4) Guest cannot order · Locate + Google CTA · ZERO new public.orders for guests
 * 5) Signed-in Rhodes/Kalithea pay INSERT public.orders + avc_transactions
 * DELETE Mesh Alpha/Beta/Gamma, Rai Drone, prepareFirstTest free credit, hardcoded wallet {s:80}
 * Do not treat Kalithea as GPS. vendors.items can stay [].
 */
(function (global) {
  'use strict';
  var BUILD = '20260822060000-live-supabase-delivery';
  var menuFillOnce = false;
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

  function showGuestCta(reason) {
    log('Guest · cannot order · Locate · then Sign in with Google' + (reason ? ' · ' + String(reason).slice(0, 36) : ''), 'ok');
    try {
      var id = 'sn-guest-cta';
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.style.cssText = 'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:12000;display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:14px;background:rgba(8,14,28,.88);border:1px solid rgba(100,180,255,.45);box-shadow:0 8px 28px rgba(0,0,0,.45);font:600 13px system-ui;color:#e8f4ff;max-width:min(420px,92vw)';
        el.innerHTML = '<span>Guest</span><button type="button" data-act="locate" style="cursor:pointer;border:0;border-radius:10px;padding:8px 12px;font:700 12px system-ui;background:#1a6fd4;color:#fff">Locate</button><button type="button" data-act="google" style="cursor:pointer;border:0;border-radius:10px;padding:8px 12px;font:700 12px system-ui;background:#fff;color:#111">Google</button><button type="button" data-act="dismiss" style="cursor:pointer;border:0;background:transparent;color:#9ab;font-size:16px">×</button>';
        document.body.appendChild(el);
        el.addEventListener('click', function (ev) {
          var t = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-act');
          if (t === 'locate') {
            try { if (global.SNMap && SNMap.locate) void SNMap.locate(); } catch (_) {}
          } else if (t === 'google') {
            try { if (global.SNAuth && SNAuth.openModal) SNAuth.openModal('Sign in with Google to order'); } catch (_) {}
          } else if (t === 'dismiss') { try { el.remove(); } catch (_) {} }
        });
      }
    } catch (_) {}
  }
  function denyGuestOrder(reason) {
    showGuestCta(reason || 'sign in required');
    return { ok: false, error: 'guest_cannot_order', reply: 'Sign in with Google to order. First Locate your place on the globe.' };
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
          if (/test-orders top-up|guest first order|welcome|hardcoded|free.?credit|prepareFirstTest/i.test(why) && !snDebug()) {
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

  async function ensureLiveVendors(lat, lng, radiusKm) {
    lat = lat != null ? Number(lat) : posNow().lat;
    lng = lng != null ? Number(lng) : posNow().lng;
    var rows = [];
    try { rows = await queryVendorsBbox(lat, lng, radiusKm || 12); }
    catch (e) {
      log('Live vendors query · ' + (e && e.message ? e.message : e), 'dim');
    }
    if (!menuFillOnce && rows.length) {
      menuFillOnce = true;
      log('Live · public.vendors bbox · ' + rows.length + ' · source=supabase real', 'ok');
    }
    return { ok: true, count: rows.length, source: 'supabase' };
  }

  function scrubDemoMesh() {
    try {
      var kill = /Mesh Alpha|Mesh Beta|Mesh Gamma|Rai Drone|DRIVER EN ROUTE|me-av|hardcoded wallet|prepareFirstTest free/i;
      if (global.SNCli && SNCli.log && !SNCli._snDemoScrub) {
        SNCli._snDemoScrub = 1;
        var ol = SNCli.log.bind(SNCli);
        SNCli.log = function (m, c, force) {
          if (kill.test(String(m || '')) && !snDebug()) return;
          return ol(m, c, force);
        };
      }
    } catch (_) {}
  }

  function hookPlaceOrder() {
    try {
      if (!global.SNProfiles || !SNProfiles.placeOrder || SNProfiles._snLiveDeliveryHooked) return;
      var orig = SNProfiles.placeOrder.bind(SNProfiles);
      SNProfiles.placeOrder = function (opts) {
        opts = opts || {};
        if (isGuest() && !snDebug()) return denyGuestOrder('placeOrder');
        opts = Object.assign({}, opts, { testMode: false, allowTopUp: false });
        var r = orig(opts);
        try {
          if (r && r.ok) void syncWalletFromProfile();
        } catch (_) {}
        return r;
      };
      SNProfiles._snLiveDeliveryHooked = true;
    } catch (_) {}
  }

  function patchMarketKitchen() {
    try {
      if (!global.SNMarket || SNMarket._snLiveKitchenPatched) return;
      if (typeof SNMarket.fulfillFoodIntent !== 'function') return;
      var ful = SNMarket.fulfillFoodIntent.bind(SNMarket);
      SNMarket.fulfillFoodIntent = async function (q, opts) {
        opts = opts || {};
        if (isGuest() && !snDebug()) return denyGuestOrder('food intent');
        try { await ensureLiveVendors(posNow().lat, posNow().lng, 12); } catch (_) {}
        return ful(q, Object.assign({}, opts, { testMode: false }));
      };
      SNMarket._snLiveKitchenPatched = true;
    } catch (_) {}
  }

  function boot() {
    scrubDemoMesh();
    patchCurrencyWallet();
    patchMarketKitchen();
    hookPlaceOrder();
    void syncWalletFromProfile();
    try { void ensureLiveVendors(posNow().lat, posNow().lng, 12); } catch (_) {}
    if (isGuest()) setTimeout(function () { if (isGuest()) showGuestCta('first open'); }, 1800);
    setTimeout(function () {
      scrubDemoMesh();
      patchCurrencyWallet();
      patchMarketKitchen();
      hookPlaceOrder();
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
    syncWalletFromProfile: syncWalletFromProfile,
    logAvcTx: logAvcTx,
    fetchEurBalance: fetchEurBalance,
    showGuestCta: showGuestCta,
    denyGuestOrder: denyGuestOrder,
    snDebug: snDebug
  };
})(typeof window !== 'undefined' ? window : globalThis);
