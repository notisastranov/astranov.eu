/* Astranov mute · Build 20260822060000
 * Kill beeps + load guest-pass-20260822 (live guest CLI/mind/CTA fixes).
 */
(function (global) {
  'use strict';
  var BUILD = '20260822060000-mute-guest-pass';
  global.__SN_MUTE_ALERTS = true;
  global.__SN_MUTE_BEEPS = true;

  function silenceSpeech() {
    try { if (global.speechSynthesis) global.speechSynthesis.cancel(); } catch (_) {}
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
                try { osc.frequency.value = 0; } catch (_) {}
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

  function loadGuestPass() {
    try {
      if (global.SNGuestPass0822) return;
      if (document.querySelector('script[data-sn-guest-pass-0822]')) return;
      var s = document.createElement('script');
      s.src = '/js/spacenet/chrome-guest-pass-20260822.js?v=' + BUILD;
      s.async = true;
      s.setAttribute('data-sn-guest-pass-0822', '1');
      s.onerror = function () {
        try { console.warn('[chrome-mute] guest-pass miss'); } catch (_) {}
      };
      (document.head || document.documentElement).appendChild(s);
    } catch (_) {}
  }

  function boot() {
    patchAudio();
    silenceSpeech();
    patchFieldAlerts();
    softGateHandsfree();
    loadGuestPass();
  }

  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setInterval(function () {
    patchAudio();
    patchFieldAlerts();
    softGateHandsfree();
    if (global.__SN_MUTE_ALERTS && !(global.SNCli && (SNCli.handsfreeOn || SNCli.hfTtsActive))) silenceSpeech();
  }, 4000);
  setTimeout(loadGuestPass, 1200);
  setTimeout(loadGuestPass, 4000);

  global.SNChromeMute = { build: BUILD, silence: silenceSpeech, loadGuestPass: loadGuestPass };
})(typeof window !== 'undefined' ? window : globalThis);
