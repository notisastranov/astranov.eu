/**
 * P1 Depict SpaceNet in space — guest first-run
 * Build: 20260817092000-guest-first-run
 *
 * - Hide UNIT/FLIGHT/vault/PERFORMANCE/HOLD/Meshtastic until first success
 * - One CLI (kill dual top stc-cmd)
 * - Coach: Locate → Google → ask or order
 * - help: Name a place, a thing, or an order
 * - No drum cam for guests
 * - Non-place CLI stays on globe (no village teleports)
 * - Guest ADD: sign in; pin after locate
 * - Clock: real 2026 date, text node only
 * - One currency AE
 * - Mandraki marina remains a harbor object on the globe
 */
(function (G) {
  'use strict';
  if (G.__snP1First) return;
  G.__snP1First = 1;
  var BUILD = '20260817092000-guest-first-run';
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

  function markSuccess(why) {
    try {
      localStorage.setItem(SUCCESS_KEY, '1');
    } catch (_) {}
    revealAdvanced();
    log('First win · ' + (why || 'ready'), 'ok');
  }

  function coachStep() {
    try {
      return Number(localStorage.getItem(COACH_KEY) || '0') || 0;
    } catch (_) {
      return 0;
    }
  }

  function setCoach(n) {
    try {
      localStorage.setItem(COACH_KEY, String(n));
    } catch (_) {}
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
        '#stc-g-perf, #stc-g-money .sm-cell:nth-child(3), #stc-money-vault,' +
        '#tl-freeze, #stc-data-pool, #stc-data-tour,' +
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
      function setText(el, val) {
        if (!el) return;
        if (el.firstChild && el.firstChild.nodeType === 3) el.firstChild.nodeValue = val;
        else {
          while (el.firstChild) el.removeChild(el.firstChild);
          el.appendChild(document.createTextNode(val));
        }
      }
      setText(te, t);
      setText(de, d);
    } catch (_) {}
  }

  function oneCurrency() {
    try {
      if (G.SNCurrency) {
        if (SNCurrency.SYM) SNCurrency.SYM = 'AE';
        if (SNCurrency.GLYPH) SNCurrency.GLYPH = 'AE';
      }
      document.querySelectorAll('#fbh-s, #stc-money-bal, #stc-money-rate, #stc-money-vault, #stc-money-mined').forEach(function (el) {
        if (el && el.textContent) {
          el.textContent = el.textContent.replace(/\bAC\b/g, 'AE').replace(/\s*€\s*\/\s*AE/g, ' AE');
        }
      });
    } catch (_) {}
  }

  function runCoach() {
    if (hasSuccess() || owner()) return;
    var step = coachStep();
    if (step === 0) {
      log('Coach · 1/3 Locate — share where you are (or stay on the globe).', 'ok');
      setCoach(1);
    } else if (step === 1 && signed()) {
      log('Coach · 2/3 Signed in · Name a place, a thing, or an order.', 'ok');
      setCoach(2);
    } else if (step === 1 && !signed()) {
      log('Coach · 2/3 Google — Sign in to order and save your AE.', 'ok');
    } else if (step >= 2) {
      log('Coach · 3/3 Ask or order — stay on the globe.', 'ok');
    }
  }

  function placeLike(q) {
    q = String(q || '').trim().toLowerCase();
    if (!q) return false;
    if (/^(help|\?|hi|hello|hey|thanks|thank you|ok|yes|no|status|boot|diag)/.test(q)) return false;
    if (/^(what|why|how|who|when|explain|tell me|is |are |can |do |does )/.test(q)) return false;
    if (/\?$/.test(q) && !/^(where|find|go|fly|show|map)\b/.test(q)) return false;
    if (/^(call|phone|login|sign|poly|polygon|order|pizza|help)/.test(q)) return false;
    if (/^(go|fly|show|map|near|locate)\s+/.test(q)) return true;
    if (/^[a-z\u00c0-\u024f\s\-']{2,40}$/i.test(q) && q.split(/\s+/).length <= 4) {
      if (/^(the|a|an|and|or|but|if|then|else|this|that|it|my|your)\b/.test(q)) return false;
      return true;
    }
    return false;
  }

  function isNonPlaceQuestion(q) {
    q = String(q || '').trim();
    var low = q.toLowerCase();
    if (/\?$/.test(q)) return true;
    if (/^(what|why|how|who|when|explain|tell me|is |are |can |do |does |should |would )/.test(low)) return true;
    if (/^(help|status|boot|diag|network|battery|device)\b/.test(low)) return true;
    return false;
  }

  function patchCli() {
    if (!G.SNCli || typeof SNCli.run !== 'function' || SNCli.__snP1) return;
    SNCli.__snP1 = 1;

    if (typeof SNCli.help === 'function') {
      SNCli.help = function () {
        log('Name a place, a thing, or an order.', 'ok');
        log('> tokyo', 'cmd');
        log('> pizza', 'cmd');
        log('> locate', 'cmd');
        try { if (SNCli.preview) SNCli.preview('place · thing · order'); } catch (_) {}
      };
    }

    var prev = SNCli.run.bind(SNCli);
    SNCli.run = function (raw) {
      var s = String(raw || '').trim();
      var low = s.toLowerCase();

      if (low === 'help' || low === '?' || low === 'commands') {
        log('Name a place, a thing, or an order.', 'ok');
        log('> tokyo · pizza · locate', 'cmd');
        if (!hasSuccess()) runCoach();
        return Promise.resolve(true);
      }

      if (!signed() && !owner() && /drum\s*cam|sticky\s*fingers/i.test(s)) {
        log('Sign in to play media on the globe.', 'dim');
        try { if (G.SNAuth && SNAuth.openModal) SNAuth.openModal('Sign in for media'); } catch (_) {}
        return Promise.resolve(true);
      }

      if (/^(add|pin)\b/i.test(low) || low === 'add') {
        if (!signed()) {
          log('Sign in to add a place.', 'err');
          try { if (G.SNAuth && SNAuth.openModal) SNAuth.openModal('Sign in to add a place'); } catch (_) {}
          return Promise.resolve(true);
        }
        var pos = G._snPhysPos || (G.SNCli && SNCli._lastGps);
        if (!pos || pos.lat == null) {
          log('Locate first — then ADD pins where you are.', 'dim');
          return Promise.resolve(true);
        }
        try {
          if (G.SNGlobe && SNGlobe.pulse) {
            SNGlobe.pulse(pos.lat, pos.lng, 0x3dd68c, 'PIN', 120000);
            markSuccess('pin');
            log('Pinned · ' + pos.lat.toFixed(4) + ',' + pos.lng.toFixed(4), 'ok');
            return Promise.resolve(true);
          }
        } catch (_) {}
      }

      if (low === 'locate' || low === 'location' || low === 'gps') {
        try { if (G.SNP0Guest && SNP0Guest.allowGps) SNP0Guest.allowGps('locate'); } catch (_) {}
        setCoach(Math.max(coachStep(), 1));
      }

      if (isNonPlaceQuestion(s) && !placeLike(s)) {
        try { if (G.SNGlobe && SNGlobe.goToTier) SNGlobe.goToTier('global'); } catch (_) {}
        return prev(raw).then(function (r) {
          try { if (G.SNGlobe && SNGlobe.goToTier) SNGlobe.goToTier('global'); } catch (_) {}
          return r;
        });
      }

      return prev(raw).then(function (r) {
        if (signed() && coachStep() >= 1) markSuccess('signed-action');
        return r;
      });
    };
  }

  function ensureMandrakiHarbor() {
    try {
      if (!G.SNGlobe || !G.SNGlobe.pulse) return;
      if (G.__snMandrakiHarbor) return;
      G.__snMandrakiHarbor = 1;
      setTimeout(function () {
        try {
          if (G.SNGlobe && SNGlobe.pulse) SNGlobe.pulse(36.451, 28.224, 0x3d9eff, 'Mandraki', 0);
        } catch (_) {}
      }, 4000);
    } catch (_) {}
  }

  function tick() {
    oneCli();
    if (!hasSuccess()) hideAdvanced();
    else revealAdvanced();
    tickClock();
    oneCurrency();
    patchCli();
  }

  function init() {
    fixViewport();
    oneCli();
    hideAdvanced();
    tickClock();
    oneCurrency();
    patchCli();
    ensureMandrakiHarbor();
    setInterval(tick, 1500);
    setInterval(tickClock, 15000);
    document.addEventListener('sn:os-ready', function () {
      oneCli();
      hideAdvanced();
      tickClock();
      setTimeout(runCoach, 600);
      ensureMandrakiHarbor();
      log('SpaceNet · guest first-run · one CLI', 'ok');
    });
    if (signed()) setCoach(Math.max(coachStep(), 2));
  }

  G.SNP1FirstRun = { build: BUILD, markSuccess: markSuccess, hasSuccess: hasSuccess, runCoach: runCoach };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
