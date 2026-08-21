/* Astranov mute · Build 20260817110000
 * Loads: live-delivery · guest-order-gate · p0-live-market (P0 5–10)
 */
(function (global) {
  'use strict';
  var BUILD = '20260817110000-mute-p0-market';
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
  function inject(src, attr) {
    try {
      if (document.querySelector('script[' + attr + ']')) return;
      var s = document.createElement('script');
      s.src = src + '?v=' + BUILD;
      s.async = true;
      s.setAttribute(attr, '1');
      s.onerror = function () {
        try { console.warn('[chrome-mute] miss ' + src); } catch (_) {}
      };
      (document.head || document.documentElement).appendChild(s);
    } catch (_) {}
  }
  function loadLiveDelivery() {
    if (global.SNChromeLiveDelivery) return;
    inject('/js/spacenet/chrome-live-delivery.js', 'data-sn-live-delivery');
  }
  function loadGuestGate() {
    if (global.SNChromeGuestOrderGate) return;
    inject('/js/spacenet/chrome-guest-order-gate.js', 'data-sn-guest-order-gate');
  }
  function loadP0Market() {
    if (global.SNChromeP0LiveMarket) return;
    inject('/js/spacenet/chrome-p0-live-market.js', 'data-sn-p0-live-market');
  }
  function boot() {
    patchAudio();
    silenceSpeech();
    patchFieldAlerts();
    softGateHandsfree();
    loadLiveDelivery();
    loadGuestGate();
    loadP0Market();
  }
  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setInterval(function () {
    patchAudio();
    patchFieldAlerts();
    softGateHandsfree();
    if (global.__SN_MUTE_ALERTS && !(global.SNCli && (SNCli.handsfreeOn || SNCli.hfTtsActive))) silenceSpeech();
  }, 4000);
  setTimeout(loadLiveDelivery, 1200);
  setTimeout(loadGuestGate, 1400);
  setTimeout(loadP0Market, 1600);
  setTimeout(loadLiveDelivery, 4000);
  setTimeout(loadGuestGate, 4200);
  setTimeout(loadP0Market, 4400);

  global.SNChromeMute = {
    build: BUILD,
    silence: silenceSpeech,
    loadLiveDelivery: loadLiveDelivery,
    loadGuestGate: loadGuestGate,
    loadP0Market: loadP0Market
  };
})(typeof window !== 'undefined' ? window : globalThis);
