/* Astranov mute · Build 20260822060000
 * Kill alert beeps, oscillator spam, auto speechSynthesis noise.
 * SpeechRecognition on Android often triggers keyboard/system beeps — we soft-gate restarts.
 * LOADS: chrome-cli-answer (P0 what-is-astranov stay-globe) +
 *        chrome-p1-first-run + chrome-research-call +
 *        chrome-guest-order-gate + chrome-live-delivery
 * Twin CLIs locked. Currency ⭐.
 */
(function (global) {
  'use strict';
  var BUILD = '20260822060000-mute-loaders';
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
      var attr = mark.replace(/^data-/, '').replace(/[\[\]]/g, '');
      s.setAttribute('data-' + attr, '1');
      document.head.appendChild(s);
    } catch (_) {}
  }

  function loadChain() {
    loadScript('/js/spacenet/chrome-cli-answer.js', 'data-sn-cli-answer');
    loadScript('/js/spacenet/chrome-p1-first-run.js', 'data-sn-p1-first');
    loadScript('/js/spacenet/chrome-research-call.js', 'data-sn-research-call');
    loadScript('/js/spacenet/chrome-guest-order-gate.js', 'data-sn-guest-order');
    loadScript('/js/spacenet/chrome-live-delivery.js', 'data-sn-live-delivery');
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
