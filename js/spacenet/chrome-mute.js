/* Astranov mute · Build 20260822060000-mute-loaders
 * Kill alert beeps, oscillator spam, auto speechSynthesis noise.
 * SpeechRecognition on Android often triggers keyboard/system beeps — we soft-gate restarts.
 * Loads: chrome-p1-first-run · chrome-research-call · chrome-guest-order-gate · chrome-live-delivery
 * Keep HUD/CALL/Grok-mind injectors intact.
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

  function loadModule(path, flag) {
    if (global[flag]) return;
    global[flag] = 1;
    var src = path;
    try {
      var b = (document.querySelector('meta[name="astranov-build"]') || {}).content || '';
      if (b) src += (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(b);
    } catch (_) {}
    fetch(src, { cache: 'no-store' })
      .then(function (r) {
        return r.ok ? r.text() : Promise.reject();
      })
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

  /* P1 guest first-run */
  loadModule('/js/spacenet/chrome-p1-first-run.js', '__snP1Load');
  /* P0 research + call wire (space-links + webrtc-space loaded by research-call) */
  loadModule('/js/spacenet/chrome-research-call.js', '__snRCLoad');
  /* P0 guest order gate */
  loadModule('/js/spacenet/chrome-guest-order-gate.js', '__snGOGLoad');
  /* live delivery · real public.vendors + orders */
  loadModule('/js/spacenet/chrome-live-delivery.js', '__snLDLoad');

  global.SNChromeMute = { build: BUILD, silence: silenceSpeech };
})(typeof window !== 'undefined' ? window : globalThis);
