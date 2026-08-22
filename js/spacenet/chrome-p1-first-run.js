/**
 * P1 Depict SpaceNet in space — guest first-run
 * Build: 20260822060000-guest-first-run
 *
 * - Hide UNIT/FLIGHT/vault/PERFORMANCE/HOLD/Meshtastic until first success
 * - One CLI (kill dual top stc-cmd)
 * - Coach: Locate → Google → ask or order
 * - help: Name a place, a thing, or an order
 * - No drum cam for guests
 * - Non-place CLI stays on globe (no village teleports)
 * - Guest ADD: sign in; pin after locate
 * - Clock: real 2026 date, text node only
 * - One currency Æ
 * - Mandraki marina remains a harbor object on the globe
 */
(function (G) {
  'use strict';
  if (G.__snP1First) return;
  G.__snP1First = 1;
  var BUILD = '20260822060000-guest-first-run';
  var SUCCESS_KEY = 'sn:first-success-v1';
  var COACH_KEY = 'sn:coach-step-v1';

  function log(m, c) {
    try { if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 200), c || 'ok', true); } catch (_) {}
  }
  function signed() {
    try { return !!(G.SNAuth && SNAuth.user); } catch (_) { return false; }
  }
  function owner() {
    try { return !!(G.SNAuth && SNAuth.isOwner && SNAuth.isOwner()); } catch (_) { return false; }
  }
  function hasSuccess() {
    try { return localStorage.getItem(SUCCESS_KEY) === '1'; } catch (_) { return false; }
  }
  function markSuccess(why) {
    try { localStorage.setItem(SUCCESS_KEY, '1'); } catch (_) {}
    revealAdvanced();
    log('First win · ' + (why || 'ready'), 'ok');
  }
  function coachStep() {
    try { return Number(localStorage.getItem(COACH_KEY) || '0') || 0; } catch (_) { return 0; }
  }
  function setCoach(n) {
    try { localStorage.setItem(COACH_KEY, String(n)); } catch (_) {}
  }

  function oneCli() {
    try {
      var stc = document.getElementById('stc-cmd');
      if (stc) {
        stc.style.setProperty('display', 'none', 'important');
        stc.setAttribute('hidden', '');
        stc.setAttribute('aria-hidden', 'true');
      }
      var topIn = document.getElementById('stc-cmd-in');
      if (topIn) topIn.disabled = true;
      var form = document.getElementById('cli-form');
      if (form) {
        form.style.setProperty('display', 'flex', 'important');
        form.removeAttribute('hidden');
      }
    } catch (_) {}
  }

  function hideAdvanced() {
    if (hasSuccess() || owner()) return;
    try {
      var css = document.getElementById('sn-p1-hide');
      if (!css) {
        css = document.createElement('style');
        css.id = 'sn-p1-hide';
        document.head.appendChild(css);
      }
      css.textContent =
        '/* guest first-run: advanced stowed until first success */' +
        '#stc-g-perf, #stc-g-money .sm-cell:nth-child(3), #stc-money-vault,' +
        '#tl-freeze, #stc-data-pool, #stc-data-cloud, body.spacexai #sn-topchrome-drag::after,' +
        '#sn-helper-root, #sn-helper-canvas, .sn-helper-sprite,' +
        '[data-fact="blue"], [data-fact="ports"], [data-fact="mesh"], [data-fact="smoke"], [data-fact="mine"] {' +
        'display:none!important;visibility:hidden!important;pointer-events:none!important}' +
        '#sn-topchrome-drag::after { content: "GADGETS" !important; }' +
        'body.spacexai #sn-topchrome-drag::after { content: "GADGETS" !important; }';
    } catch (_) {}
  }

  function revealAdvanced() {
    try {
      var css = document.getElementById('sn-p1-hide');
      if (css) css.textContent = '';
    } catch (_) {}
  }

  function fixViewport() {
    try {
      var m = document.querySelector('meta[name="viewport"]');
      if (m) m.setAttribute('content', 'width=device-width, initial-scale=1, viewport-fit=cover');
    } catch (_) {}
  }

  function tickClock() {
    try {
      var now = new Date();
      var y = now.getFullYear();
      if (y < 2026) y = 2026;
      var te = document.getElementById('fnm-time');
      var de = document.getElementById('fnm-date');
      var t = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
      var d = y + '-' + String(now.getMonth() + 1).padStart(2, '0') + '-' + String(now.getDate()).padStart(2, '0');
      if (te) te.textContent = t;
      if (de) de.textContent = d;
    } catch (_) {}
  }

  function coachLine() {
    var step = coachStep();
    if (hasSuccess()) return '';
    if (step < 1) return 'Locate your place on the globe';
    if (step < 2) return 'Sign in with Google to order and save Æ';
    return 'Name a place, a thing, or an order';
  }

  function applyCoach() {
    try {
      var inEl = document.getElementById('cli-in');
      if (inEl && !signed() && !hasSuccess()) {
        var tip = coachLine();
        if (tip) inEl.setAttribute('placeholder', tip);
      }
    } catch (_) {}
  }

  function patchHelp() {
    try {
      if (!G.SNCli || SNCli.__snP1Help) return;
      SNCli.__snP1Help = 1;
      var prev = SNCli.run && SNCli.run.bind(SNCli);
      if (!prev) return;
      SNCli.run = function (raw) {
        var s = String(raw || '').trim().toLowerCase();
        if (s === 'help' || s === '?') {
          log('Name a place, a thing, or an order', 'ok');
          log('Locate · Google · then order pizza or ask what is astranov', 'dim');
          return true;
        }
        return prev(raw);
      };
    } catch (_) {}
  }

  function boot() {
    oneCli();
    hideAdvanced();
    fixViewport();
    tickClock();
    applyCoach();
    patchHelp();
    setInterval(function () {
      oneCli();
      hideAdvanced();
      tickClock();
      applyCoach();
    }, 2500);
    log('P1 guest first-run · ' + BUILD, 'dim');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();

  G.SNChromeP1FirstRun = { build: BUILD, markSuccess: markSuccess, coachStep: coachStep };
})(typeof window !== 'undefined' ? window : globalThis);
