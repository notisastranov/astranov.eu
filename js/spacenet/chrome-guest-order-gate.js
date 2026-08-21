/* Astranov P0#4 guest order gate — Build 20260817102200
 * Guest cannot order. One CTA: Locate + Google.
 */
(function (global) {
  'use strict';
  var BUILD = '20260817102200-guest-order-gate';
  var shown = false;

  function log(m, c) {
    try {
      if (global.SNCli && SNCli.log) SNCli.log(m, c || 'dim');
    } catch (_) {}
  }
  function isGuest() {
    try {
      if (global.SNAuth && typeof SNAuth.isLoggedIn === 'function' && SNAuth.isLoggedIn()) return false;
      if (global.SNAuth && SNAuth.session && SNAuth.session.user) return false;
      if (global.SNAuth && SNAuth.user) return false;
    } catch (_) {}
    return true;
  }
  function snDebug() {
    try {
      return /(?:\?|&)sn-debug=1(?:&|$)/.test(String(location.search || ''));
    } catch (_) {
      return false;
    }
  }
  function openGoogle() {
    try {
      if (global.SNAuth && typeof SNAuth.openModal === 'function') {
        SNAuth.openModal('Sign in with Google to order');
        return;
      }
    } catch (_) {}
    try {
      var b = document.getElementById('btn-login');
      if (b) b.click();
    } catch (_) {}
    log('Sign in with Google to order', 'ok');
  }
  function locate() {
    try {
      if (global.SNMap && SNMap.locate) {
        void SNMap.locate();
        return;
      }
    } catch (_) {}
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(function (pos) {
          global._snLastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          log('Locate · ok', 'ok');
        });
      }
    } catch (_) {}
  }
  function showCta() {
    log('Guest · cannot order · Locate · then Google', 'ok');
    try {
      var id = 'sn-guest-cta';
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.style.cssText =
          'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:12000;display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:14px;background:rgba(8,14,28,.88);border:1px solid rgba(100,180,255,.45);box-shadow:0 8px 28px rgba(0,0,0,.45);font:600 13px system-ui;color:#e8f4ff;max-width:min(420px,92vw)';
        el.innerHTML =
          '<span>Guest</span>' +
          '<button type="button" data-a="locate" style="cursor:pointer;border:0;border-radius:10px;padding:8px 12px;font:700 12px system-ui;background:#1a6fd4;color:#fff">Locate</button>' +
          '<button type="button" data-a="google" style="cursor:pointer;border:0;border-radius:10px;padding:8px 12px;font:700 12px system-ui;background:#fff;color:#111">Google</button>' +
          '<button type="button" data-a="x" style="cursor:pointer;border:0;background:transparent;color:#9ab;font-size:16px">×</button>';
        document.body.appendChild(el);
        el.addEventListener('click', function (ev) {
          var a = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-a');
          if (a === 'locate') locate();
          else if (a === 'google') openGoogle();
          else if (a === 'x') {
            try {
              el.remove();
            } catch (_) {}
          }
        });
      }
    } catch (_) {}
  }
  function deny(why) {
    showCta();
    return {
      ok: false,
      error: 'guest_cannot_order',
      reply: 'Sign in with Google to order. First Locate your place.',
    };
  }
  function patch() {
    try {
      if (global.SNProfiles && SNProfiles.placeOrder && !SNProfiles._snGuestOrderGate) {
        var po = SNProfiles.placeOrder.bind(SNProfiles);
        SNProfiles.placeOrder = function (opts) {
          if (isGuest() && !snDebug()) return deny('placeOrder');
          return po(opts);
        };
        SNProfiles._snGuestOrderGate = true;
      }
    } catch (_) {}
    try {
      if (global.SNMarket && SNMarket.fulfillFoodIntent && !SNMarket._snGuestOrderGate) {
        var ful = SNMarket.fulfillFoodIntent.bind(SNMarket);
        SNMarket.fulfillFoodIntent = async function (q, opts) {
          if (isGuest() && !snDebug()) return deny('food');
          return ful(q, opts);
        };
        SNMarket._snGuestOrderGate = true;
      }
    } catch (_) {}
  }
  function boot() {
    patch();
    if (isGuest() && !shown) {
      shown = true;
      setTimeout(function () {
        if (isGuest()) showCta();
      }, 1600);
    }
    if (!isGuest()) {
      try {
        var el = document.getElementById('sn-guest-cta');
        if (el) el.remove();
      } catch (_) {}
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  setTimeout(boot, 3000);
  global.SNChromeGuestOrderGate = { build: BUILD, showCta: showCta, deny: deny };
})(typeof window !== 'undefined' ? window : globalThis);
