/* Astranov mute · Build 20260811223000
 * Kill alert beeps, oscillator spam, auto speechSynthesis noise.
 * SpeechRecognition on Android often triggers keyboard/system beeps — we soft-gate restarts.
 */
(function (global) {
  'use strict';
  var BUILD = '20260811223000-mute';
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
                return; // swallow beep
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

  /** Soft-gate aggressive handsfree restarts that beep on Android */
  function softGateHandsfree() {
    try {
      if (!global.SNCli || SNCli.__snBeepGate) return;
      SNCli.__snBeepGate = true;
      // Prefer text when silver is active unless user forced voice
      var desc = Object.getOwnPropertyDescriptor(SNCli, 'toggleHandsfree');
      // wrap if function exists
      if (typeof SNCli.toggleHandsfree === 'function') {
        var prev = SNCli.toggleHandsfree.bind(SNCli);
        SNCli.toggleHandsfree = function () {
          global.__SN_MUTE_BEEPS = true;
          return prev();
        };
      }
    } catch (_) {}
  }

  function boot() {
    patchAudio();
    silenceSpeech();
    patchFieldAlerts();
    softGateHandsfree();
  }

  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
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

  /* load P1 guest first-run */
  (function () {
    if (global.__snP1Load) return;
    global.__snP1Load = 1;
    var src = '/js/spacenet/chrome-p1-first-run.js';
    try {
      var b = (document.querySelector('meta[name="astranov-build"]') || {}).content || '';
      if (b) src += '?v=' + encodeURIComponent(b);
    } catch (_) {}
    fetch(src, { cache: 'no-store' })
      .then(function (r) { return r.ok ? r.text() : Promise.reject(); })
      .then(function (code) {
        var s = document.createElement('script');
        s.text = code;
        document.head.appendChild(s);
      })
      .catch(function () {
        var s = document.createElement('script');
        s.async = true;
        s.src = src;
        document.head.appendChild(s);
      });
  })();

  global.SNChromeMute = { build: BUILD, silence: silenceSpeech };
})(typeof window !== 'undefined' ? window : globalThis);
