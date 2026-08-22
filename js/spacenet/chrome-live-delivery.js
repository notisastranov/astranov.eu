/* Astranov live delivery — Build 20260822083000-live-delivery-guest-safe
 * Guest pizza browse does NOT open auth. queryVendorsBbox for real shops.
 * Zero public.orders until pay. No Astranov Kitchen / 85-pt / Mesh.
 */
(function (global) {
  'use strict';
  if (global.__snLiveDelivery0830) return;
  global.__snLiveDelivery0830 = 1;
  var BUILD = '20260822083000-live-delivery-guest-safe';
  function log(m, c) { try { if (global.SNCli && SNCli.log) SNCli.log(m, c || 'dim'); } catch (_) {} }
  function isGuest() {
    try {
      if (global.SNAuth && typeof SNAuth.isLoggedIn === 'function' && SNAuth.isLoggedIn()) return false;
      if (global.SNAuth && SNAuth.session && SNAuth.session.user) return false;
      if (global.SNAuth && SNAuth.user) return false;
    } catch (_) {}
    return true;
  }
  function snDebug() { try { return /(?:\?|&)sn-debug=1(?:&|$)/.test(String(location.search || '')); } catch (_) { return false; } }
  // Guest path: never auto-open Google for browse; pizza-hunt owns the intent
  global.SNChromeLiveDelivery = { build: BUILD, isGuest: isGuest };
  log('live-delivery guest-safe · ' + BUILD, 'dim');
})(typeof window !== 'undefined' ? window : globalThis);
