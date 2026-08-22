/* Astranov mute · Build 20260822083000
 * Kill beeps + load chain from #126 force-paint baseline:
 *   - chrome-cli-answer (twin CLI + cli-log paint + answers)  ← #126 keep
 *   - chrome-p1-first-run
 *   - chrome-research-call
 *   - chrome-guest-order-gate (rewritten: no auth on pizza)
 *   - chrome-live-delivery (rewritten guest path)
 *   - chrome-guest-pizza-hunt (LAST — vendors on globe · Google only at pay)
 * Does NOT load guest-pass oneCli hide. Currency ⭐. Twin CLIs locked by force-paint.
 */
(function (global) {
  'use strict';
  var BUILD = '20260822083000-mute-pizza-globe';
  global.__SN_MUTE_ALERTS = true;
  global.__SN_MUTE_BEEPS = true;

  function silenceSpeech() {
    try {
      if (global.speechSynthesis) global.speechSynthesis.cancel();
    } catch (_) {}
  }

  function patchAudio() {
    try {
      var AC = global.AudioContext || global.webkitAudioContext;
      if (AC && !AC.__snMuted) {
        AC.__snMuted = true;
        var orig = AC.prototype.createOscillator;
        if (orig) {
          AC.prototype.createOscillator = function () {
            var osc = orig.apply(this, arguments);
            var start = osc.start.bind(osc);
            osc.start = function () {
              if (global.__SN_MUTE_BEEPS) {
                try {
                  osc.frequency.value = 0;
                } catch (_) {}
                return;
              }
              return start.apply(osc, arguments);
            };
            return osc;
          };
        }
      }
    } catch (_) {}
  }

  function patchFieldAlerts() {
    try {
      if (global.SNField) {
        global.SNField.playAlertTone = function () {};
        global.SNField.showDeviceAlert = function () {};
      }
    } catch (_) {}
  }

  function softGateHandsfree() {
    try {
      if (!global.SNCli || SNCli.__snBeepGate) return;
      SNCli.__snBeepGate = true;
      if (typeof SNCli.toggleHandsfree === 'function') {
        var prev = SNCli.toggleHandsfree.bind(SNCli);
        SNCli.toggleHandsfree = function () {
          global.__SN_MUTE_BEEPS = true;
          return prev();
        };
      }
    } catch (_) {}
  }

  function loadScript(src, mark) {
    try {
      if (document.querySelector('script[' + mark + ']')) return;
      var s = document.createElement('script');
      s.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + BUILD;
      s.async = false;
      s.setAttribute(mark, '1');
      (document.head || document.documentElement).appendChild(s);
    } catch (_) {}
  }

  function loadChain() {
    loadScript('/js/spacenet/chrome-cli-answer.js', 'data-sn-cli-answer');
    loadScript('/js/spacenet/chrome-p1-first-run.js', 'data-sn-p1');
    loadScript('/js/spacenet/chrome-research-call.js', 'data-sn-research-call');
    loadScript('/js/spacenet/chrome-guest-order-gate.js', 'data-sn-guest-order-gate');
    loadScript('/js/spacenet/chrome-live-delivery.js', 'data-sn-live-delivery');
    loadScript('/js/spacenet/chrome-guest-pizza-hunt.js', 'data-sn-guest-pizza');
  }

  function boot() {
    patchAudio();
    silenceSpeech();
    patchFieldAlerts();
    softGateHandsfree();
    loadChain();
  }

  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(loadChain, 0);
  setTimeout(loadChain, 500);
  setTimeout(loadChain, 800);
  setTimeout(loadChain, 2500);
  setInterval(function () {
    patchAudio();
    patchFieldAlerts();
    softGateHandsfree();
    if (
      global.__SN_MUTE_ALERTS &&
      !(global.SNCli && (SNCli.handsfreeOn || SNCli.hfTtsActive))
    )
      silenceSpeech();
  }, 4000);

  global.SNChromeMute = { build: BUILD, silence: silenceSpeech, loadChain: loadChain };
})(typeof window !== 'undefined' ? window : globalThis);
