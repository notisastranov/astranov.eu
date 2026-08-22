/**
 * Guest order gate (rewritten) — Build 20260822083000
 * Browse pizza/food is FREE for guests. Zero public.orders until pay.
 * MUST NOT open #sn-auth-modal on pizza / order me a pizza.
 * Google GIS only when guest explicitly PAY / HOLD ⭐.
 * No Locate required to hunt. No Earth.CITY.Rhodes auto street.
 */
(function (G) {
  'use strict';
  if (G.__snGuestOrderGateRewritten) return;
  G.__snGuestOrderGateRewritten = 1;
  var BUILD = '20260822083000-guest-order-gate-rewrite';

  function log(m, c) {
    try {
      if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 320), c || 'dim', true);
    } catch (_) {}
  }
  function isGuest() {
    try {
      if (G.SNAuth && typeof SNAuth.isLoggedIn === 'function' && SNAuth.isLoggedIn()) return false;
      if (G.SNAuth && SNAuth.session && SNAuth.session.user) return false;
      if (G.SNAuth && SNAuth.user) return false;
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
  function isPizzaOrFoodBrowse(line) {
    var s = String(line || '').trim();
    if (!s) return false;
    if (/\b(order\s+(me\s+)?(a\s+)?pizza|pizza\s*(please|order|near|nearby|delivery)?|get\s+(me\s+)?pizza|i\s+want\s+(a\s+)?pizza|find\s+pizza|pizza\s+shops?)\b/i.test(s)) return true;
    if (/\b(order\s+(me\s+)?(a\s+)?(food|meal|burger|souvlaki|kebab|sushi)|food\s+delivery|deliver\s+(me\s+)?(food|pizza))\b/i.test(s)) return true;
    if (/^pizza\b/i.test(s)) return true;
    return false;
  }
  function isPayHold(line) {
    var s = String(line || '').trim().toLowerCase();
    return /^(pay|hold\s*\u2b50|hold\s*star|checkout|confirm\s+order|buy\s+now)\b/.test(s);
  }

  /** Hard block auth modal for guest browse. Only allow on explicit pay. */
  function blockAuthOnBrowse() {
    try {
      var modal = document.getElementById('sn-auth-modal');
      if (modal && isGuest() && !snDebug()) {
        modal.style.setProperty('display', 'none', 'important');
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('open', 'show', 'sn-open');
      }
    } catch (_) {}
    try {
      if (G.SNAuth && typeof SNAuth.openModal === 'function' && !SNAuth.__snGateBrowseGuard) {
        var prev = SNAuth.openModal.bind(SNAuth);
        SNAuth.openModal = function (msg) {
          var m = String(msg || '');
          if (
            isGuest() &&
            !snDebug() &&
            !/pay|HOLD\s*\u2b50|hold\s*star|checkout|wallet|balance|to\s+call/i.test(m)
          ) {
            log('Browse free · Google only at pay / HOLD \u2b50', 'dim');
            return;
          }
          return prev(msg);
        };
        SNAuth.__snGateBrowseGuard = true;
      }
    } catch (_) {}
    try {
      if (G.SNAuth && typeof SNAuth.open === 'function' && !SNAuth.__snGateOpenGuard) {
        var po = SNAuth.open.bind(SNAuth);
        SNAuth.open = function (msg) {
          var m = String(msg || '');
          if (
            isGuest() &&
            !snDebug() &&
            !/pay|HOLD\s*\u2b50|hold\s*star|checkout|wallet|balance|to\s+call/i.test(m)
          ) {
            return;
          }
          return po(msg);
        };
        SNAuth.__snGateOpenGuard = true;
      }
    } catch (_) {}
  }

  function denyWriteOnly() {
    return {
      ok: false,
      error: 'guest_cannot_order',
      reply: 'Browse free on the globe · Google only when you HOLD \u2b50 / pay',
      guest_browse: true,
    };
  }

  function patch() {
    blockAuthOnBrowse();
    try {
      if (G.SNProfiles && SNProfiles.placeOrder && !SNProfiles._snGuestOrderGateR) {
        var po = SNProfiles.placeOrder.bind(SNProfiles);
        SNProfiles.placeOrder = function (opts) {
          if (isGuest() && !snDebug()) return denyWriteOnly();
          return po(opts);
        };
        SNProfiles._snGuestOrderGateR = true;
      }
    } catch (_) {}
    try {
      if (G.SNMarket && SNMarket.fulfillFoodIntent && !SNMarket._snGuestOrderGateR) {
        var ful = SNMarket.fulfillFoodIntent.bind(SNMarket);
        SNMarket.fulfillFoodIntent = async function (q, opts) {
          var line = String(q || (opts && opts.text) || '');
          if (isGuest() && !snDebug()) {
            if (isPizzaOrFoodBrowse(line) || /pizza|food|meal/i.test(line)) {
              try {
                if (G.SNChromeGuestPizzaHunt && typeof SNChromeGuestPizzaHunt.hunt === 'function') {
                  await SNChromeGuestPizzaHunt.hunt(line || 'order me a pizza');
                  return { ok: true, guest_browse: true, reply: 'Shops on globe · Google only at pay / HOLD \u2b50' };
                }
              } catch (_) {}
              return { ok: true, guest_browse: true, reply: 'Browse free · Google only at pay' };
            }
            return denyWriteOnly();
          }
          return ful(q, opts);
        };
        SNMarket._snGuestOrderGateR = true;
      }
    } catch (_) {}
    try {
      var el = document.getElementById('sn-guest-cta');
      if (el && isGuest()) el.remove();
    } catch (_) {}
  }

  function boot() {
    patch();
    blockAuthOnBrowse();
  }

  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 0);
  setTimeout(boot, 800);
  setTimeout(boot, 2500);
  setInterval(function () {
    patch();
    blockAuthOnBrowse();
  }, 5000);

  G.SNChromeGuestOrderGate = { build: BUILD, deny: denyWriteOnly, blockAuthOnBrowse: blockAuthOnBrowse };
})(typeof window !== 'undefined' ? window : globalThis);
