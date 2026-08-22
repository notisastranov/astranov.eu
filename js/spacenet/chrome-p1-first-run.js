/**
 * P1 Depict SpaceNet in space — guest first-run
 * Build: 20260822083000-p1-first-run
 * Twin CLIs stay locked by chrome-cli-answer force-paint (overrides oneCli).
 */
(function (G) {
  'use strict';
  if (G.__snP1First) return;
  G.__snP1First = 1;
  var BUILD = '20260822083000-p1-first-run';
  var SUCCESS_KEY = 'sn:first-success-v1';
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
        '#tl-freeze, #stc-data-pool, #stc-data-cloud,' +
        '#sn-helper-root, #sn-helper-canvas, .sn-helper-sprite,' +
        '[data-fact="blue"], [data-fact="ports"], [data-fact="mesh"] {' +
        'display:none!important;visibility:hidden!important;pointer-events:none!important}';
    } catch (_) {}
  }
  function revealAdvanced() {
    try {
      var css = document.getElementById('sn-p1-hide');
      if (css) css.textContent = '';
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
  function boot() {
    hideAdvanced();
    tickClock();
    setInterval(function () {
      hideAdvanced();
      tickClock();
    }, 2500);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
  G.SNChromeP1FirstRun = { build: BUILD, markSuccess: markSuccess };
})(typeof window !== 'undefined' ? window : globalThis);
