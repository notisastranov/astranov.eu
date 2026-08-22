/**
 * P0 CLI answer + stay on globe — Build 20260822060000
 * "what is astranov" answers in CLI. Camera stays on globe.
 * Paid mind /api/ai allow_paid:true, else local Astranov/SpaceNet fallback.
 * No fly list, no teleport, no owner_note / USAGE SHIP / ASTRANOV LAW.
 * Twin CLIs locked. Currency ⭐ Astra coins (1⭐=1€).
 */
(function (G) {
  'use strict';
  if (G.__snCliAnswer0822) return;
  G.__snCliAnswer0822 = 1;
  var BUILD = '20260822060000-cli-answer-globe';

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
  function stayGlobe() {
    try {
      if (G.SNMap && SNMap.active && typeof SNMap.close === 'function') SNMap.close();
    } catch (_) {}
    try {
      if (G.SNGlobe) {
        if (typeof SNGlobe.goToTier === 'function') SNGlobe.goToTier('global');
        else if (typeof SNGlobe.setTier === 'function') SNGlobe.setTier('global');
      }
    } catch (_) {}
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
  async function answerInCli(line) {
    stayGlobe();
    clearInputs();
    log(line, 'cmd');
    preview('…');
    var text = null;
    try {
      text = await paidMind(line);
    } catch (_) {}
    if (!text) text = localMind(line);
    if (!text) text = ASTRANOV_BLURB;
    if (/owner_note|USAGE SHIP|ASTRANOV LAW/i.test(text)) text = ASTRANOV_BLURB;
    stayGlobe();
    String(text)
      .split(/\n+/)
      .forEach(function (part) {
        var p = String(part || '').trim();
        if (p) log(p, 'ok');
      });
    preview(String(text).slice(0, 80));
    return text;
  }
  function handleLine(raw) {
    var s = String(raw || '').trim();
    if (!s) return false;
    if (!isResearchish(s) && !isIdentity(s)) return false;
    if (isIdentity(s) || isResearchish(s)) {
      void answerInCli(s);
      return true;
    }
    return false;
  }
  function install() {
    if (!G.SNCli || typeof SNCli.run !== 'function') return;
    if (SNCli.__snCliAnswer) return;
    SNCli.__snCliAnswer = 1;
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
      if (form && input && !input._snCliAnswer) {
        input._snCliAnswer = 1;
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
      if (topIn && !topIn._snCliAnswer) {
        topIn._snCliAnswer = 1;
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
    install();
  }
  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 400);
  setTimeout(boot, 1500);
  setTimeout(boot, 4000);
  setInterval(install, 8000);
  G.SNChromeCliAnswer = { build: BUILD, answer: answerInCli, stayGlobe: stayGlobe };
})(typeof window !== 'undefined' ? window : globalThis);
