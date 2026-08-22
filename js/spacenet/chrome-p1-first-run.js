/**
 * P1 Depict SpaceNet in space — guest first-run
 * Build: 20260822060000-guest-first-run-star-twin
 * Twin CLIs LOCKED (top HUD + bottom). Currency ⭐ Astra coins 1⭐=1€.
 * Coach Locate → ask/order. Non-place stays on globe.
 */
(function (G) {
  'use strict';
  if (G.__snP1First) return;
  G.__snP1First = 1;
  var BUILD = '20260822060000-guest-first-run-star-twin';
  var SUCCESS_KEY = 'sn:first-success-v1';
  var COACH_KEY = 'sn:coach-step-v1';

  function log(m, c) {
    try {
      if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 200), c || 'ok', true);
    } catch (_) {}
  }
  function signed() {
    try {
      return !!(G.SNAuth && SNAuth.user);
    } catch (_) {
      return false;
    }
  }
  function owner() {
    try {
      return !!(G.SNAuth && SNAuth.isOwner && SNAuth.isOwner());
    } catch (_) {
      return false;
    }
  }
  function hasSuccess() {
    try {
      return localStorage.getItem(SUCCESS_KEY) === '1';
    } catch (_) {
      return false;
    }
  }
  function markSuccess() {
    try {
      localStorage.setItem(SUCCESS_KEY, '1');
    } catch (_) {}
  }
  function stayGlobe() {
    try {
      if (G.SNMap && SNMap.active && SNMap.close) SNMap.close();
    } catch (_) {}
  }
  function currencyStar() {
    try {
      if (G.SNCurrency) {
        if (SNCurrency.SYM) SNCurrency.SYM = '⭐';
        if (SNCurrency.GLYPH) SNCurrency.GLYPH = '⭐';
        if (typeof SNCurrency.format === 'function' && !SNCurrency.__p1Star) {
          SNCurrency.__p1Star = 1;
          var fmt = SNCurrency.format.bind(SNCurrency);
          SNCurrency.format = function () {
            return String(fmt.apply(SNCurrency, arguments))
              .replace(/\bAC\b/g, '⭐')
              .replace(/Æ/g, '⭐')
              .replace(/€\s*\/\s*Æ/g, '⭐');
          };
        }
      }
      document.querySelectorAll('#fbh-s, #stc-money-bal, #stc-money-rate').forEach(function (el) {
        if (el && el.textContent)
          el.textContent = el.textContent.replace(/\bAC\b/g, '⭐').replace(/Æ/g, '⭐');
      });
    } catch (_) {}
  }
  /* twin CLIs LOCKED — never hide #stc-cmd or #cli-in */
  function ensureTwinCli() {
    try {
      var stc = document.getElementById('stc-cmd');
      if (stc) {
        stc.style.removeProperty('display');
        stc.removeAttribute('hidden');
        stc.setAttribute('aria-hidden', 'false');
      }
      var topIn = document.getElementById('stc-cmd-in');
      if (topIn) topIn.disabled = false;
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
        '/* guest first-run: advanced stowed until first success — twin CLIs stay */' +
        '#sn-unit, .sn-unit, #tl-freeze, #stc-data-pool, #stc-data-tour,' +
        '#stc-money-vault, body.spacexai #sn-topchrome-drag::after' +
        '{opacity:0.35;pointer-events:none}';
    } catch (_) {}
  }
  function runCoach(step) {
    try {
      localStorage.setItem(COACH_KEY, String(step || 1));
    } catch (_) {}
    if (step === 1) log('Coach · 1/3 Locate — pin yourself on the globe.', 'ok');
    else if (step === 2) log('Coach · 2/3 Hunt shops on the globe · Google only at pay (⭐).', 'ok');
    else if (step === 3) log('Coach · 3/3 Ask or order — twin CLI ready.', 'ok');
  }
  function patchNonPlace() {
    if (!G.SNCli || SNCli.__snP1NonPlace) return;
    SNCli.__snP1NonPlace = 1;
    var prev = SNCli.run.bind(SNCli);
    SNCli.run = function (raw) {
      var s = String(raw || '').trim();
      var low = s.toLowerCase();
      if (/^(what|who|why|how|explain)\b/.test(low) || /\?$/.test(s)) {
        stayGlobe();
      }
      if (/^locate\b/.test(low)) {
        markSuccess();
        runCoach(2);
      }
      if (/^(pizza|order|shops)\b/.test(low)) {
        markSuccess();
        runCoach(3);
      }
      return prev(raw);
    };
  }
  function init() {
    currencyStar();
    ensureTwinCli();
    hideAdvanced();
    patchNonPlace();
    if (!hasSuccess() && !signed()) runCoach(1);
    log('SpaceNet · guest first-run · twin CLI · ⭐', 'ok');
  }
  init();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  setTimeout(currencyStar, 1500);
  setTimeout(ensureTwinCli, 800);
  setInterval(function () {
    currencyStar();
    ensureTwinCli();
  }, 8000);
  G.SNChromeP1FirstRun = { build: BUILD, markSuccess: markSuccess, runCoach: runCoach };
})(typeof window !== 'undefined' ? window : globalThis);
