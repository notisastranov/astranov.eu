/* Astranov P0#4 guest order gate — Build 20260822060000
 * Google only at pay. Guest pizza may hunt public.vendors / real shops on the globe.
 * No Google wall that eats the globe on boot.
 */
(function (global) {
  'use strict';
  var BUILD = '20260822060000';
  var shown = false;
  function isGuest() {
    try {
      if (global.SNAuth && typeof SNAuth.isLoggedIn === 'function') return !SNAuth.isLoggedIn();
      if (global.SNAuth && SNAuth.session && SNAuth.session.user) return false;
      if (global.SNAuth && SNAuth.user) return false;
    } catch (_) {}
    return true;
  }
  function snDebug() {
    try {
      return /[?&]sn-debug=1/.test(location.search || '');
    } catch (_) {
      return false;
    }
  }
  function locate() {
    try {
      if (global.SNCli && SNCli.run) void SNCli.run('locate');
    } catch (_) {}
  }
  function openGoogle() {
    try {
      if (global.SNAuth && SNAuth.signInWithGoogle) return SNAuth.signInWithGoogle();
      if (global.SNAuth && SNAuth.login) return SNAuth.login('google');
    } catch (_) {}
  }
  function showCta() {
    try {
      if (document.getElementById('sn-guest-cta')) return;
      var el = document.createElement('div');
      el.id = 'sn-guest-cta';
      el.style.cssText =
        'position:fixed;left:50%;bottom:88px;transform:translateX(-50%);z-index:9998;' +
        'display:flex;gap:8px;align-items:center;padding:10px 12px;border-radius:14px;' +
        'background:rgba(8,14,28,.92);border:1px solid rgba(80,140,255,.35);box-shadow:0 8px 28px rgba(0,0,0,.35);' +
        'max-width:min(92vw,420px);font:600 12px/1.3 system-ui,sans-serif;color:#e8f0ff';
      el.innerHTML =
        '<span style="flex:1">Sign in to pay · hunt shops free</span>' +
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
    } catch (_) {}
  }
  function deny(why) {
    showCta();
    return {
      ok: false,
      error: 'guest_cannot_order',
      reply: 'Sign in with Google to pay. Shops stay on the globe — locate first.',
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
    /* Google only at pay — no wall that eats the globe on boot */
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
