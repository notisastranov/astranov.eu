/**
 * P0 RESEARCH + CALL wire — Build 20260822083000-research-call
 * Research stays on globe. Guest CALL may keep Sign-in then Athens-line ARC.
 * Pizza must not reuse the CALL wall.
 */
(function (G) {
  'use strict';
  if (G.__snResearchCall) return;
  G.__snResearchCall = 1;
  var BUILD = '20260822083000-research-call';
  function log(m, c) {
    try {
      if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 220), c || 'ok', true);
    } catch (_) {}
  }
  function signed() {
    try { return !!(G.SNAuth && SNAuth.user); } catch (_) { return false; }
  }
  function killReload() {
    try {
      var Orig = G.EventSource;
      if (Orig && !Orig.__snP0) {
        G.EventSource = function (url) {
          if (String(url || '').indexOf('__reload') >= 0) {
            return { close: function () {}, addEventListener: function () {}, removeEventListener: function () {}, onmessage: null, onerror: null, readyState: 2 };
          }
          return new Orig(url);
        };
        G.EventSource.prototype = Orig.prototype;
        G.EventSource.__snP0 = 1;
      }
    } catch (_) {}
  }
  function stayGlobe() {
    try { if (G.SNMap && SNMap.active && SNMap.close) SNMap.close(); } catch (_) {}
  }
  function patchCallGuest() {
    try {
      if (!G.SNWebRTC || SNWebRTC.__snCallGuest) return;
      SNWebRTC.__snCallGuest = 1;
      var oc = SNWebRTC.canCall;
      SNWebRTC.canCall = function (order, opts) {
        opts = opts || {};
        if (!signed() && !opts.force) return { ok: false, reason: 'Sign in to call', needAuth: true };
        return oc ? oc.call(SNWebRTC, order, opts) : { ok: true, reason: 'ok' };
      };
      var os = SNWebRTC.startCall;
      if (os) {
        SNWebRTC.startCall = function (order, opts) {
          opts = opts || {};
          var g = SNWebRTC.canCall(order, opts);
          if (!g.ok) {
            log(g.reason || 'Sign in to call', 'err');
            try { if (g.needAuth && G.SNAuth && SNAuth.openModal) SNAuth.openModal('Sign in to call'); } catch (_) {}
            return Promise.resolve({ ok: false, error: g.reason, needAuth: true });
          }
          if (!opts.peerLat && G.SNSpaceLinks) {
            opts.peerLat = opts.peerLat || 37.9838;
            opts.peerLng = opts.peerLng || 23.7275;
            opts.label = opts.label || 'Athens';
          }
          return os.call(SNWebRTC, order, opts);
        };
      }
    } catch (_) {}
  }
  function tick() {
    killReload();
    patchCallGuest();
  }
  function init() {
    killReload();
    tick();
    setInterval(tick, 2000);
  }
  G.SNResearchCall = { build: BUILD };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
