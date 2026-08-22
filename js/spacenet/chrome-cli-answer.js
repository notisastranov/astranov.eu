/**
 * P0 Force-paint twin CLIs + cli-log — Build 20260822071000
 * LOCKED: BOTH HUD (#stc-cmd / #stc-cmd-in) + bottom (#cli-in / #panel / #cli-log).
 * Last-wins style + inline !important so getBoundingClientRect width AND height > 0.
 * Runs AFTER chrome-fix / p1 / sn-quiet (t0, 500ms, after each what-is-astranov).
 * Mind writes #cli-log; show panel when answering. No goToTier. Currency ⭐.
 * Do not merge #125 as-is — this supersedes its weak ensureTwinCli.
 */
(function (G) {
  'use strict';
  if (G.__snCliAnswer0822c) return;
  G.__snCliAnswer0822c = 1;
  var BUILD = '20260822071000-force-paint-twin-cli';

  var ASTRANOV_BLURB =
    'Astranov is the mind of astranov.eu — Real-Earth OS / SpaceNet. ' +
    'Globe, map, ⭐ Astra coins (1⭐=1€), order, call, research. Not a chatbot brand. ' +
    'You talk to Astranov Mind here; SpaceNet is the grid under it.';

  var FORCE_CSS =
    '/* sn-force-paint ' +
    BUILD +
    ' last-wins */\n' +
    '#stc-cmd, #stc-cmd-in, #cli-form, #cli-in, #cli-log, #panel,\n' +
    '#panel.sn-open, #panel.open, body #panel, body #cli-log, body #stc-cmd {\n' +
    '  display: block !important;\n' +
    '  visibility: visible !important;\n' +
    '  opacity: 1 !important;\n' +
    '  pointer-events: auto !important;\n' +
    '  position: relative !important;\n' +
    '  clip: auto !important;\n' +
    '  clip-path: none !important;\n' +
    '  transform: none !important;\n' +
    '  max-height: none !important;\n' +
    '  overflow: visible !important;\n' +
    '}\n' +
    '#stc-cmd {\n' +
    '  display: flex !important;\n' +
    '  min-height: 36px !important;\n' +
    '  height: auto !important;\n' +
    '  width: auto !important;\n' +
    '  max-width: 100% !important;\n' +
    '}\n' +
    '#stc-cmd-in {\n' +
    '  display: block !important;\n' +
    '  min-height: 28px !important;\n' +
    '  height: 32px !important;\n' +
    '  min-width: 120px !important;\n' +
    '  width: 100% !important;\n' +
    '  opacity: 1 !important;\n' +
    '  pointer-events: auto !important;\n' +
    '  position: relative !important;\n' +
    '  z-index: 5 !important;\n' +
    '}\n' +
    '#cli-form {\n' +
    '  display: flex !important;\n' +
    '  min-height: 36px !important;\n' +
    '  height: auto !important;\n' +
    '  width: 100% !important;\n' +
    '  align-items: center !important;\n' +
    '}\n' +
    '#cli-in {\n' +
    '  display: block !important;\n' +
    '  min-height: 28px !important;\n' +
    '  height: 32px !important;\n' +
    '  min-width: 120px !important;\n' +
    '  width: 100% !important;\n' +
    '  opacity: 1 !important;\n' +
    '  pointer-events: auto !important;\n' +
    '}\n' +
    '#cli-log {\n' +
    '  display: block !important;\n' +
    '  visibility: visible !important;\n' +
    '  opacity: 1 !important;\n' +
    '  min-height: 48px !important;\n' +
    '  height: auto !important;\n' +
    '  max-height: 40vh !important;\n' +
    '  overflow-y: auto !important;\n' +
    '  width: 100% !important;\n' +
    '  pointer-events: auto !important;\n' +
    '}\n' +
    '#panel {\n' +
    '  display: flex !important;\n' +
    '  flex-direction: column !important;\n' +
    '  visibility: visible !important;\n' +
    '  opacity: 1 !important;\n' +
    '  min-height: 72px !important;\n' +
    '  height: auto !important;\n' +
    '  max-height: none !important;\n' +
    '  width: auto !important;\n' +
    '  pointer-events: auto !important;\n' +
    '  z-index: 40 !important;\n' +
    '}\n' +
    '/* kill oneCli / quiet / guest-pass hide rules */\n' +
    '#sn-guest-pass-one-cli, style#sn-guest-pass-one-cli { display: none !important; }\n';

  function injectForceStyle() {
    try {
      var id = 'sn-force-paint-twin-cli';
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('style');
        el.id = id;
        el.setAttribute('data-sn-build', BUILD);
        (document.head || document.documentElement).appendChild(el);
      }
      el.textContent = FORCE_CSS;
      try {
        (document.head || document.documentElement).appendChild(el);
      } catch (_) {}
    } catch (_) {}
  }

  function forceEl(el, display, minH, minW) {
    if (!el) return;
    try {
      el.removeAttribute('hidden');
      el.setAttribute('aria-hidden', 'false');
      el.style.setProperty('display', display || 'block', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.setProperty('clip', 'auto', 'important');
      el.style.setProperty('clip-path', 'none', 'important');
      el.style.setProperty('transform', 'none', 'important');
      el.style.setProperty('max-height', 'none', 'important');
      if (minH) {
        el.style.setProperty('min-height', minH, 'important');
        el.style.setProperty('height', 'auto', 'important');
      }
      if (minW) {
        el.style.setProperty('min-width', minW, 'important');
        el.style.setProperty('width', '100%', 'important');
      }
      try {
        var r = el.getBoundingClientRect();
        if (!r || r.width < 2 || r.height < 2) {
          el.style.setProperty('min-height', minH || '32px', 'important');
          el.style.setProperty('height', minH || '36px', 'important');
          el.style.setProperty('min-width', minW || '120px', 'important');
          if (display === 'flex') el.style.setProperty('display', 'flex', 'important');
          else el.style.setProperty('display', 'block', 'important');
        }
      } catch (_) {}
    } catch (_) {}
  }

  function forcePaint() {
    try {
      ['sn-guest-pass-one-cli', 'sn-one-cli', 'sn-quiet-cli', 'sn-p1-one-cli'].forEach(function (id) {
        var s = document.getElementById(id);
        if (s) {
          try {
            s.remove();
          } catch (_) {}
        }
      });
      injectForceStyle();

      var stc = document.getElementById('stc-cmd');
      forceEl(stc, 'flex', '36px', '160px');
      if (stc) {
        stc.style.setProperty('overflow', 'visible', 'important');
        stc.style.setProperty('position', 'relative', 'important');
      }

      var topIn = document.getElementById('stc-cmd-in');
      forceEl(topIn, 'block', '28px', '120px');
      if (topIn) {
        topIn.disabled = false;
        topIn.style.setProperty('position', 'relative', 'important');
        topIn.style.setProperty('z-index', '5', 'important');
        topIn.style.setProperty('height', '32px', 'important');
      }

      var form = document.getElementById('cli-form');
      forceEl(form, 'flex', '36px', '160px');
      if (form) form.style.setProperty('align-items', 'center', 'important');

      var bottom = document.getElementById('cli-in');
      forceEl(bottom, 'block', '28px', '120px');
      if (bottom) {
        bottom.disabled = false;
        bottom.style.setProperty('height', '32px', 'important');
      }

      var logEl = document.getElementById('cli-log');
      forceEl(logEl, 'block', '48px', '160px');
      if (logEl) {
        logEl.style.setProperty('max-height', '40vh', 'important');
        logEl.style.setProperty('overflow-y', 'auto', 'important');
        logEl.style.setProperty('overflow-x', 'hidden', 'important');
      }

      var panel = document.getElementById('panel');
      forceEl(panel, 'flex', '72px', '200px');
      if (panel) {
        panel.classList.add('sn-open', 'open');
        panel.style.setProperty('flex-direction', 'column', 'important');
        panel.style.setProperty('z-index', '40', 'important');
        panel.style.setProperty('bottom', panel.style.bottom || '0', 'important');
      }
    } catch (_) {}
  }

  function ensureTwinCli() {
    forcePaint();
  }

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
  function stayPut() {
    try {
      if (G.SNMap && SNMap.active && typeof SNMap.close === 'function') SNMap.close();
    } catch (_) {}
  }
  function isIdentity(line) {
    var low = String(line || '')
      .trim()
      .toLowerCase();
    if (!low) return false;
    if (
      /what\s+is\s+astranov|who\s+is\s+astranov|astranov\s*\?|τι\s+εί?ναι\s+astranov|τι\s+ειναι\s+astranov/i.test(
        low
      )
    )
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
        var pow = await SNSubscription.askPowerful(line, {
          mode: 'chat',
          timeoutMs: 8000,
          allow_paid: true,
        });
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

  function answerInCli(line) {
    stayPut();
    forcePaint();
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
    forcePaint();

    void (async function () {
      try {
        var paid = await paidMind(line);
        if (paid && String(paid).trim() && !/owner_note|USAGE SHIP|ASTRANOV LAW/i.test(paid)) {
          stayPut();
          forcePaint();
          var paidS = String(paid).trim();
          if (paidS !== syncText && paidS.indexOf(syncText.slice(0, 40)) < 0) {
            String(paidS)
              .split(/\n+/)
              .forEach(function (part) {
                var p = String(part || '').trim();
                if (p) log(p, 'ok');
              });
            preview(paidS.slice(0, 80));
            forcePaint();
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
    forcePaint();
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
    forcePaint();
    install();
  }

  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 0);
  setTimeout(boot, 500);
  setTimeout(boot, 1500);
  setTimeout(boot, 4000);
  setInterval(function () {
    forcePaint();
    install();
  }, 6000);

  G.SNChromeCliAnswer = {
    build: BUILD,
    answer: answerInCli,
    stayPut: stayPut,
    ensureTwinCli: ensureTwinCli,
    forcePaint: forcePaint,
  };
})(typeof window !== 'undefined' ? window : globalThis);
