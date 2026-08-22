/**
 * P0 RESEARCH + CALL wire — 20260822060000
 * - Research submit: answer in CLI within timeout; orbit pin if place; else stay on globe
 * - Non-place questions never hang / never teleport
 * - Guest call: sign in → great-circle ARC two pins (dims on hangup) — not room-code sheet
 * - Kill EventSource('/__reload')
 */
(function (G) {
  'use strict';
  if (G.__snResearchCall) return;
  G.__snResearchCall = 1;
  var BUILD = '20260822060000-research-call';

  function log(m, c) {
    try {
      if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 220), c || 'ok', true);
    } catch (_) {}
  }

  function signed() {
    try {
      return !!(G.SNAuth && SNAuth.user);
    } catch (_) {
      return false;
    }
  }

  function killReload() {
    try {
      if (G.__snEsReload) {
        try {
          G.__snEsReload.close();
        } catch (_) {}
        G.__snEsReload = null;
      }
      var Orig = G.EventSource;
      if (Orig && !Orig.__snP0) {
        G.EventSource = function (url) {
          if (String(url || '').indexOf('__reload') >= 0) {
            return {
              close: function () {},
              addEventListener: function () {},
              removeEventListener: function () {},
              onmessage: null,
              onerror: null,
              readyState: 2,
            };
          }
          return new Orig(url);
        };
        G.EventSource.prototype = Orig.prototype;
        G.EventSource.__snP0 = 1;
      }
    } catch (_) {}
  }

  function stayGlobe() {
    try {
      if (G.SNMap && SNMap.active && SNMap.close) SNMap.close();
    } catch (_) {}
    try {
      if (G.SNGlobe && SNGlobe.goToTier) SNGlobe.goToTier('global');
    } catch (_) {}
  }

  function isNonPlace(q) {
    var s = String(q || '').trim();
    var low = s.toLowerCase();
    if (!s) return false;
    if (/\?$/.test(s)) return true;
    if (/^(what|why|how|who|when|explain|tell me|is |are |can |do |does |should |would |define )\b/.test(low))
      return true;
    if (/^what\s+is\b/.test(low)) return true;
    if (/^(help|status|boot|diag|network|battery|device)\b/.test(low)) return true;
    return false;
  }

  function clearInputs() {
    try {
      var a = document.getElementById('cli-in');
      var b = document.getElementById('stc-cmd-in');
      if (a) a.value = '';
      if (b) b.value = '';
    } catch (_) {}
  }

  function answerFast(line) {
    return new Promise(function (resolve) {
      var done = false;
      function finish(text, via) {
        if (done) return;
        done = true;
        resolve({ text: text || null, via: via || '' });
      }
      setTimeout(function () {
        finish(null, 'timeout');
      }, 9000);
      try {
        var mind = G.SNAstranovMind || G.SNFreeMind;
        if (mind && typeof mind.answer === 'function') {
          var quick = mind.answer(line, { mode: 'chat' });
          if (quick && quick.text) {
            finish(String(quick.text), 'mind');
            return;
          }
        }
      } catch (_) {}
      try {
        if (G.SNAi && typeof SNAi.ask === 'function') {
          Promise.resolve(SNAi.ask(line, { allow_paid: true, mode: 'chat' }))
            .then(function (r) {
              finish(r ? String(r) : null, 'ai');
            })
            .catch(function () {
              finish(null, 'ai-err');
            });
          return;
        }
      } catch (_) {}
      try {
        if (G.SNSubscription && typeof SNSubscription.askPowerful === 'function') {
          Promise.resolve(SNSubscription.askPowerful(line, { mode: 'chat', timeoutMs: 8000, allow_paid: true }))
            .then(function (pow) {
              if (pow && pow.ok && pow.text) finish(String(pow.text), 'sub');
              else finish(null, 'sub-miss');
            })
            .catch(function () {
              finish(null, 'sub-err');
            });
          return;
        }
      } catch (_) {}
      var low = String(line || '').toLowerCase();
      if (/astranov|spacenet/.test(low)) {
        finish(
          'Astranov is the mind of astranov.eu — Real-Earth OS / SpaceNet. Globe, map, ⭐ Astra coins, order, call, research.',
          'local'
        );
        return;
      }
      finish('Still thinking · try again, or name a place / order.', 'empty');
    });
  }

  function patchCliResearch() {
    if (!G.SNCli || typeof SNCli.run !== 'function' || SNCli.__snResearchFix) return;
    SNCli.__snResearchFix = 1;
    var prev = SNCli.run.bind(SNCli);
    SNCli.run = function (raw) {
      var s = String(raw || '').trim();
      if (!s) return prev(raw);

      if (isNonPlace(s)) {
        clearInputs();
        stayGlobe();
        log(s, 'cmd');
        try {
          if (G.SNCli.beginTurn) SNCli.beginTurn();
        } catch (_) {}
        return answerFast(s).then(function (r) {
          stayGlobe();
          if (r && r.text) {
            String(r.text)
              .split(/\n+/)
              .forEach(function (part) {
                var p = String(part || '').trim();
                if (p) log(p, 'ok');
              });
          } else {
            log('No answer yet · try again.', 'dim');
          }
          try {
            if (G.SNCli.endTurn) SNCli.endTurn();
          } catch (_) {}
          return true;
        });
      }
      return prev(raw);
    };
  }

  function patchCall() {
    try {
      if (!G.SNCli || SNCli.__snCallArc) return;
      SNCli.__snCallArc = 1;
      var prev = SNCli.run.bind(SNCli);
      SNCli.run = function (raw) {
        var s = String(raw || '').trim();
        var low = s.toLowerCase();
        if (/^(call|video|webrtc)\b/.test(low) || low === 'call') {
          if (!signed()) {
            log('Sign in to call — then glowing great-circle ARC between two pins.', 'ok');
            try {
              if (G.SNAuth && SNAuth.signInWithGoogle) SNAuth.signInWithGoogle();
            } catch (_) {}
            return Promise.resolve(true);
          }
          try {
            if (G.SNSpaceLinks && SNSpaceLinks.startCallArc) {
              SNSpaceLinks.startCallArc();
              log('Call ARC live · hangup dims the line.', 'ok');
              return Promise.resolve(true);
            }
            if (G.SNWebRTCSpace && SNWebRTCSpace.start) {
              SNWebRTCSpace.start();
              log('Call path open · ARC on globe.', 'ok');
              return Promise.resolve(true);
            }
          } catch (_) {}
        }
        if (/^(hang\s*up|hangup|end call)\b/.test(low)) {
          try {
            if (G.SNSpaceLinks && SNSpaceLinks.hangup) SNSpaceLinks.hangup();
            if (G.SNWebRTCSpace && SNWebRTCSpace.hangup) SNWebRTCSpace.hangup();
            log('Call ended · ARC dimmed.', 'dim');
          } catch (_) {}
          return Promise.resolve(true);
        }
        return prev(raw);
      };
    } catch (_) {}
  }

  function boot() {
    killReload();
    patchCliResearch();
    patchCall();
  }
  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 600);
  setTimeout(boot, 2000);
  setInterval(function () {
    patchCliResearch();
    patchCall();
  }, 10000);
  G.SNChromeResearchCall = { build: BUILD, stayGlobe: stayGlobe, answerFast: answerFast };
})(typeof window !== 'undefined' ? window : globalThis);
