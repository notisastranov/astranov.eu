/**
 * P0 Paint twin CLIs + visible log + no orbit yank — Build 20260822071500
 * LOCKED: BOTH HUD (#stc-cmd / #stc-cmd-in) AND bottom (#cli-in / #cli-form) painted.
 * offsetParent set, width/height > 0. Delete oneCli / sn-quiet / display:none / 0x0.
 * SNCli.log visible: open #panel / #cli-log when answering.
 * stayPut: close street overlay only — NEVER goToTier / zoom-to-space.
 * ⭐ currency. No USAGE SHIP.
 */
(function (G) {
  'use strict';
  if (G.__snCliAnswer0822c) return;
  G.__snCliAnswer0822c = 1;
  var BUILD = '20260822071500-paint-twin-log';

  var ASTRANOV_BLURB =
    'Astranov is the mind of astranov.eu — Real-Earth OS / SpaceNet. ' +
    'Globe, map, ⭐ Astra coins (1⭐=1€), order, call, research. Not a chatbot brand. ' +
    'You talk to Astranov Mind here; SpaceNet is the grid under it.';

  function log(m, c) {
    try {
      if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 420), c || 'ok', true);
    } catch (_) {}
  }
  function preview(m) {
    try {
      if (G.SNCli && SNCli.preview) SNCli.preview(String(m).slice(0, 90));
    } catch (_) {}
  }
  function clearInputs() {
    try {
      var a = document.getElementById('cli-in');
      if (a) a.value = '';
      var b = document.getElementById('stc-cmd-in');
      if (b) b.value = '';
    } catch (_) {}
  }

  /** Non-place: camera literally does not move. Close street overlay OK; orbital yank NOT. */
  function stayPut() {
    try {
      if (G.SNMap && SNMap.active && typeof SNMap.close === 'function') SNMap.close();
    } catch (_) {}
    // NEVER: SNGlobe.goToTier / setTier / fly / zoom-to-space / global tier force
  }

  function isIdentity(line) {
    var low = String(line || '').trim().toLowerCase();
    if (!low) return false;
    if (/what\s+is\s+astranov|who\s+is\s+astranov|astranov\s*\?|τι\s+εί?ναι\s+astranov|τι\s+ειναι\s+astranov/i.test(low))
      return true;
    if (/who\s+are\s+you|what\s+are\s+you|your\s+name|ποιος\s+εί?σαι|τι\s+εί?σαι/i.test(low)) return true;
    if (/what\s+is\s+spacenet|spacenet\s*\?/i.test(low)) return true;
    return false;
  }
  function isResearchish(line) {
    var s = String(line || '').trim();
    var low = s.toLowerCase();
    if (!s || s.length < 2) return false;
    if (isIdentity(s)) return true;
    if (/\?$/.test(s)) return true;
    if (/^(what|why|how|who|when|explain|tell me|define|is |are )\b/.test(low)) return true;
    if (/^what\s+is\b/.test(low)) return true;
    return false;
  }
  function localMind(line) {
    try {
      var mind = G.SNAstranovMind || G.SNFreeMind;
      if (mind && typeof mind.answer === 'function') {
        var r = mind.answer(line, { mode: 'chat' });
        if (r && r.text) {
          var t = String(r.text);
          if (/owner_note|USAGE SHIP|ASTRANOV LAW/i.test(t)) t = ASTRANOV_BLURB;
          return t;
        }
      }
    } catch (_) {}
    var low = String(line || '').toLowerCase();
    if (/what\s+is\s+astranov|who\s+is\s+astranov|astranov\s*\?/i.test(low)) return ASTRANOV_BLURB;
    if (/who\s+are\s+you|what\s+are\s+you|your\s+name/i.test(low))
      return "I'm Astranov Mind on astranov.eu — globe, map, ⭐, order, call. Ask in plain language.";
    if (/what\s+is\s+spacenet|spacenet\s*\?/i.test(low))
      return 'SpaceNet is the internal grid name. The product face is Astranov on astranov.eu.';
    return null;
  }
  function paidApiUrl() {
    try {
      if (G.SN_CONFIG && SN_CONFIG.aiUrl) return String(SN_CONFIG.aiUrl);
      if (G.SN_CONFIG && SN_CONFIG.sbUrl)
        return String(SN_CONFIG.sbUrl).replace(/\/$/, '') + '/functions/v1/ai-router';
    } catch (_) {}
    return '/api/ai';
  }
  function authHeaders() {
    var h = { 'Content-Type': 'application/json', Accept: 'application/json' };
    try {
      var key = (G.SN_CONFIG && SN_CONFIG.sbKey) || G.SB_KEY || '';
      if (key) {
        h.apikey = key;
        h.Authorization = 'Bearer ' + key;
      }
      if (G.SNAuth && SNAuth.session && SNAuth.session.access_token) {
        h.Authorization = 'Bearer ' + SNAuth.session.access_token;
      }
    } catch (_) {}
    return h;
  }
  async function paidMind(line) {
    try {
      if (G.SNAi && typeof SNAi.ask === 'function') {
        var r = await SNAi.ask(line, { mode: 'chat', allow_paid: true, stayGlobe: true });
        if (r) return String(r);
      }
    } catch (_) {}
    try {
      if (G.SNSubscription && typeof SNSubscription.askPowerful === 'function') {
        var pow = await SNSubscription.askPowerful(line, { mode: 'chat', timeoutMs: 8000, allow_paid: true });
        if (pow && pow.ok && pow.text) return String(pow.text);
      }
    } catch (_) {}
    try {
      var url = paidApiUrl();
      var res = await fetch(url, {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          text: line,
          message: line,
          allow_paid: true,
          preferred_provider: 'astranov',
          level: 'personal',
          source: 'cli-answer',
          build: BUILD,
          stay_globe: true,
        }),
        mode: 'cors',
      });
      if (res.ok) {
        var j = await res.json();
        if (j && (j.text || j.reply || j.message || j.answer))
          return String(j.text || j.reply || j.message || j.answer);
      }
    } catch (_) {}
    return null;
  }

  /** Force element painted: display, visibility, size, not zeroed by sn-quiet/oneCli. */
  function forcePaint(el, opts) {
    if (!el) return;
    opts = opts || {};
    try {
      el.removeAttribute('hidden');
      el.removeAttribute('aria-hidden');
      el.classList.remove('sn-quiet', 'sn-hidden', 'hidden', 'collapsed', 'cli-collapsed');
      el.style.setProperty('display', opts.display || 'flex', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.removeProperty('position');
      if (opts.minH) el.style.setProperty('min-height', opts.minH, 'important');
      if (opts.minW) el.style.setProperty('min-width', opts.minW, 'important');
      if (opts.h) el.style.setProperty('height', opts.h, 'important');
      if (opts.w) el.style.setProperty('width', opts.w, 'important');
      el.style.removeProperty('max-height');
      el.style.removeProperty('overflow');
      if (el.style.height === '0px' || el.style.height === '0') el.style.removeProperty('height');
      if (el.style.width === '0px' || el.style.width === '0') el.style.removeProperty('width');
    } catch (_) {}
  }

  /** Open/show CLI panel + log so SNCli.log is guest-visible. */
  function showCliPanel() {
    try {
      var panel = document.getElementById('panel');
      if (panel) {
        forcePaint(panel, { display: 'flex', minH: '48px' });
        panel.classList.remove('collapsed', 'cli-collapsed', 'sn-quiet');
        panel.classList.add('open', 'expanded');
        try {
          if (G.SNCli && typeof SNCli.expand === 'function') SNCli.expand();
          if (G.SNCli && typeof SNCli.open === 'function') SNCli.open();
          if (G.SNCli && typeof SNCli.show === 'function') SNCli.show();
        } catch (_) {}
      }
      var logEl =
        document.getElementById('cli-log') ||
        document.getElementById('sn-cli-log') ||
        document.querySelector('#panel .cli-log') ||
        document.querySelector('#panel [data-cli-log]') ||
        document.querySelector('.sn-cli-log');
      if (logEl) {
        forcePaint(logEl, { display: 'block', minH: '32px' });
        try {
          logEl.scrollTop = logEl.scrollHeight;
        } catch (_) {}
      }
      // drag handle / shell that may collapse the panel
      var drag = document.getElementById('cli-drag');
      if (drag) {
        drag.classList.remove('collapsed');
      }
      document.body.classList.remove('cli-collapsed', 'sn-quiet-cli');
      document.body.classList.add('sn-cli-open');
    } catch (_) {}
  }

  /** Twin CLIs must be painted: offsetParent set, width/height > 0. */
  function ensureTwinCli() {
    try {
      // Kill oneCli / quiet styles that zero HUD CLI
      ['sn-guest-pass-one-cli', 'sn-one-cli', 'sn-quiet-cli', 'sn-p1-hide-cli'].forEach(function (id) {
        var s = document.getElementById(id);
        if (s) s.remove();
      });
      // Inject override that beats display:none from any prior guest-pass
      var ov = document.getElementById('sn-paint-twin-cli');
      if (!ov) {
        ov = document.createElement('style');
        ov.id = 'sn-paint-twin-cli';
        (document.head || document.documentElement).appendChild(ov);
      }
      ov.textContent =
        '#stc-cmd,#stc-cmd-in,#stc-compact .stc-cmd,.stc-cmd-row,' +
        '#cli-form,#cli-in,#panel,#cli-log,.sn-cli-log' +
        '{display:flex!important;visibility:visible!important;opacity:1!important;' +
        'pointer-events:auto!important;height:auto!important;min-height:28px!important;' +
        'width:auto!important;min-width:48px!important;overflow:visible!important}' +
        '#stc-cmd-in,#cli-in{display:block!important;min-height:28px!important;' +
        'min-width:120px!important;opacity:1!important;position:relative!important}' +
        '#cli-log,.sn-cli-log{display:block!important;min-height:32px!important}' +
        'body.sn-guest #stc-cmd,body.sn-guest #stc-cmd-in{display:flex!important;' +
        'visibility:visible!important;height:auto!important;opacity:1!important}';

      var stc = document.getElementById('stc-cmd');
      forcePaint(stc, { display: 'flex', minH: '28px', minW: '48px' });

      var topIn = document.getElementById('stc-cmd-in');
      if (topIn) {
        forcePaint(topIn, { display: 'block', minH: '28px', minW: '120px' });
        topIn.disabled = false;
        topIn.readOnly = false;
        topIn.tabIndex = 0;
      }

      var form = document.getElementById('cli-form');
      forcePaint(form, { display: 'flex', minH: '36px' });

      var bottom = document.getElementById('cli-in');
      if (bottom) {
        forcePaint(bottom, { display: 'block', minH: '28px', minW: '120px' });
        bottom.disabled = false;
        bottom.readOnly = false;
        bottom.tabIndex = 0;
      }

      var panel = document.getElementById('panel');
      forcePaint(panel, { display: 'flex', minH: '48px' });

      // If still 0x0 after force, set explicit inline size as last resort
      [stc, topIn, form, bottom, panel].forEach(function (el) {
        if (!el) return;
        try {
          var r = el.getBoundingClientRect();
          if (r.width < 8 || r.height < 8) {
            el.style.setProperty('min-width', '120px', 'important');
            el.style.setProperty('min-height', '28px', 'important');
            if (el === panel) el.style.setProperty('min-height', '64px', 'important');
          }
        } catch (_) {}
      });
    } catch (_) {}
  }

  /** Immediate answer: paint panel, log blurb sync, optional paid. */
  function answerInCli(line) {
    stayPut();
    ensureTwinCli();
    showCliPanel();
    clearInputs();
    log(line, 'cmd');

    var syncText = localMind(line) || ASTRANOV_BLURB;
    if (/owner_note|USAGE SHIP|ASTRANOV LAW/i.test(syncText)) syncText = ASTRANOV_BLURB;
    String(syncText)
      .split(/\n+/)
      .forEach(function (part) {
        var p = String(part || '').trim();
        if (p) log(p, 'ok');
      });
    preview(String(syncText).slice(0, 80));
    showCliPanel();

    void (async function () {
      try {
        var paid = await paidMind(line);
        if (paid && String(paid).trim() && !/owner_note|USAGE SHIP|ASTRANOV LAW/i.test(paid)) {
          stayPut();
          var paidS = String(paid).trim();
          if (paidS !== syncText && paidS.indexOf(syncText.slice(0, 40)) < 0) {
            String(paidS)
              .split(/\n+/)
              .forEach(function (part) {
                var p = String(part || '').trim();
                if (p) log(p, 'ok');
              });
            preview(paidS.slice(0, 80));
            showCliPanel();
          }
        }
      } catch (_) {}
    })();

    return syncText;
  }

  function handleLine(raw) {
    var s = String(raw || '').trim();
    if (!s) return false;
    if (!isResearchish(s) && !isIdentity(s)) return false;
    void answerInCli(s);
    return true;
  }

  function install() {
    ensureTwinCli();
    if (!G.SNCli || typeof SNCli.run !== 'function') return;
    if (SNCli.__snCliAnswerC) return;
    SNCli.__snCliAnswerC = 1;
    var prev = SNCli.run.bind(SNCli);
    SNCli.run = function (raw) {
      try {
        if (handleLine(raw)) return Promise.resolve(true);
      } catch (_) {}
      return prev(raw);
    };
    try {
      var form = document.getElementById('cli-form') || document.querySelector('#panel form');
      var input = document.getElementById('cli-in');
      var topIn = document.getElementById('stc-cmd-in');
      function capture(ev, el) {
        var v = String((el && el.value) || '').trim();
        if (!v || (!isIdentity(v) && !isResearchish(v))) return false;
        try {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        } catch (_) {}
        if (el) el.value = '';
        void answerInCli(v);
        return true;
      }
      if (form && input && !input._snCliAnswerC) {
        input._snCliAnswerC = 1;
        form.addEventListener(
          'submit',
          function (ev) {
            capture(ev, input);
          },
          true
        );
        input.addEventListener(
          'keydown',
          function (ev) {
            if (ev.key === 'Enter') capture(ev, input);
          },
          true
        );
      }
      if (topIn && !topIn._snCliAnswerC) {
        topIn._snCliAnswerC = 1;
        topIn.addEventListener(
          'keydown',
          function (ev) {
            if (ev.key === 'Enter') capture(ev, topIn);
          },
          true
        );
      }
    } catch (_) {}
  }

  function boot() {
    ensureTwinCli();
    showCliPanel();
    install();
  }
  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 400);
  setTimeout(boot, 1500);
  setTimeout(boot, 4000);
  setInterval(function () {
    ensureTwinCli();
    install();
  }, 6000);

  G.SNChromeCliAnswer = {
    build: BUILD,
    answer: answerInCli,
    stayPut: stayPut,
    ensureTwinCli: ensureTwinCli,
    showCliPanel: showCliPanel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
