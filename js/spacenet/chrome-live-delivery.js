/* Astranov live delivery — Build 20260822060000-star
 * Guest pizza hunts public.vendors / real shops on the globe.
 * No Google wall that eats the globe. Pay path uses ⭐ (1⭐=1€).
 * No Astranov Kitchen unless ?sn-debug=1.
 */
(function (G) {
  'use strict';
  if (G.__snLiveDelivery0822) return;
  G.__snLiveDelivery0822 = 1;
  var BUILD = '20260822060000-star';

  function log(m, c) {
    try {
      if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 220), c || 'ok', true);
    } catch (_) {}
  }
  function snDebug() {
    try {
      return /[?&]sn-debug=1/.test(location.search || '');
    } catch (_) {
      return false;
    }
  }
  function isGuest() {
    try {
      if (G.SNAuth && typeof SNAuth.isLoggedIn === 'function') return !SNAuth.isLoggedIn();
      if (G.SNAuth && SNAuth.user) return false;
    } catch (_) {}
    return true;
  }

  /** Prefer public.vendors / real shops on globe */
  function huntPublicVendors(q) {
    q = String(q || 'pizza').trim();
    try {
      if (G.SNMarket && typeof SNMarket.fillShops === 'function') {
        void SNMarket.fillShops({ query: q, source: 'public.vendors' });
        log('Hunting ' + q + ' · public vendors on globe', 'ok');
        return true;
      }
    } catch (_) {}
    try {
      if (G.SNVendorCrawl && SNVendorCrawl.crawl) {
        void SNVendorCrawl.crawl(q);
        log('Crawl ' + q + ' on field', 'ok');
        return true;
      }
    } catch (_) {}
    try {
      if (G.SNCli && SNCli.run) {
        void SNCli.run('shops ' + q);
        return true;
      }
    } catch (_) {}
    return false;
  }

  function filterFakeKitchen(list) {
    if (!Array.isArray(list)) return list || [];
    if (snDebug()) return list;
    return list.filter(function (v) {
      if (!v) return false;
      var name = String(v.shopName || v.name || '');
      var id = String(v.id || '');
      if (/Astranov Kitchen/i.test(name)) return false;
      if (id.indexOf('kitchen_') === 0) return false;
      if (v.source === 'astranov-kitchen-test') return false;
      return true;
    });
  }

  function patchVendors() {
    try {
      if (G.SNMarket && SNMarket.listVendors && !SNMarket.__snLiveFilter) {
        var lv = SNMarket.listVendors.bind(SNMarket);
        SNMarket.listVendors = function () {
          return filterFakeKitchen(lv.apply(SNMarket, arguments));
        };
        SNMarket.__snLiveFilter = 1;
      }
    } catch (_) {}
  }

  function patchPizza() {
    if (!G.SNCli || SNCli.__snLivePizza) return;
    SNCli.__snLivePizza = 1;
    var prev = SNCli.run.bind(SNCli);
    SNCli.run = function (raw) {
      var s = String(raw || '').trim();
      var low = s.toLowerCase();
      if (/^(pizza|shops|hungry|order\s+pizza)\b/.test(low) || /\bpizza\b/.test(low) && low.length < 40) {
        // Guest may hunt shops without paywall — Google only at pay (order-gate)
        huntPublicVendors(/pizza|pitogyra|gyro/.test(low) ? 'pizza' : s);
        if (isGuest()) {
          log('Shops on globe · pay with ⭐ after sign-in', 'ok');
        }
        // still allow prev for full order flow when signed in
        if (isGuest() && /^(pizza|shops|hungry)\b/.test(low)) {
          return Promise.resolve(true);
        }
      }
      return prev(raw);
    };
  }

  function boot() {
    patchVendors();
    patchPizza();
  }
  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 1200);
  setTimeout(boot, 4000);
  G.SNChromeLiveDelivery = { build: BUILD, huntPublicVendors: huntPublicVendors };
})(typeof window !== 'undefined' ? window : globalThis);
