/* Guest live pass 2026-08-22 — Build 20260822060000
 * PASS kept: globe from space, no radio/USAGE SHIP, no fake kitchen, no 85-pt POLY
 * FIX: CLI mind answers stay on globe · one CLI · hide UNIT/Lagos · soft pizza/CALL CTA
 */
(function (G) {
  'use strict';
  if (G.__snGuestPass0822) return;
  G.__snGuestPass0822 = 1;
  var BUILD = '20260822060000-guest-pass';

  function log(m, c) {
    try { if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 240), c || 'ok', true); } catch (_) {}
  }
  function signed() {
    try {
      if (G.SNAuth && typeof SNAuth.isLoggedIn === 'function' && SNAuth.isLoggedIn()) return true;
      if (G.SNAuth && SNAuth.session && SNAuth.session.user) return true;
      if (G.SNAuth && SNAuth.user) return true;
    } catch (_) {}
    return false;
  }
  function isGuest() { return !signed(); }
  function stayGlobe() {
    try { if (G.SNMap && SNMap.active && SNMap.close) SNMap.close(); } catch (_) {}
    try { if (G.SNGlobe && SNGlobe.goToTier) SNGlobe.goToTier('global'); } catch (_) {}
  }
  function clearInputs() {
    try {
      var a = document.getElementById('cli-in'); if (a) a.value = '';
      var b = document.getElementById('stc-cmd-in'); if (b) b.value = '';
    } catch (_) {}
  }

  var ASTRANOV_BLURB =
    'Astranov is the mind of astranov.eu — Real-Earth OS / SpaceNet. ' +
    'Globe, map, S (Æ), order, call, research. Not a chatbot brand. ' +
    'You talk to Astranov Mind here; SpaceNet is the grid under it.';

  function mindAnswer(line) {
    var low = String(line || '').trim().toLowerCase();
    try {
      var mind = G.SNAstranovMind || G.SNFreeMind;
      if (mind && typeof mind.answer === 'function') {
        var r = mind.answer(line, { mode: 'chat' });
        if (r && r.text) return String(r.text);
      }
    } catch (_) {}
    if (/what\s+is\s+astranov|who\s+is\s+astranov|astranov\s*\?|τι\s+ειναι\s+astranov|τι\s+είναι\s+astranov/i.test(low))
      return ASTRANOV_BLURB;
    if (/who\s+are\s+you|what\s+are\s+you|your\s+name|ποιος\s+εισαι|τι\s+εισαι/i.test(low))
      return "I'm Astranov Mind on astranov.eu — globe, map, order, call. Ask in plain language.";
    if (/what\s+is\s+spacenet|spacenet\s*\?/i.test(low))
      return 'SpaceNet is the internal grid name. The product face is Astranov on astranov.eu.';
    return null;
  }

  function isResearchish(s) {
    var low = String(s || '').trim().toLowerCase();
    if (!low) return false;
    if (/\?$/.test(low)) return true;
    if (/^(what|why|how|who|when|explain|tell me|define|is |are )\b/.test(low)) return true;
    if (/what\s+is\b/.test(low)) return true;
    return false;
  }

  function answerInCli(line) {
    stayGlobe();
    clearInputs();
    log(line, 'cmd');
    var text = mindAnswer(line);
    if (!text) {
      try {
        if (G.SNAi && typeof SNAi.ask === 'function') {
          Promise.resolve(SNAi.ask(line, { mode: 'chat' })).then(function (r) {
            stayGlobe();
            var out = r ? String(r) : null;
            if (!out) out = mindAnswer(line) || ASTRANOV_BLURB;
            String(out).split('\n').forEach(function (ln) { if (ln.trim()) log(ln, 'ok'); });
            try { if (G.SNCli && SNCli.preview) SNCli.preview(String(out).slice(0, 80)); } catch (_) {}
          }).catch(function () {
            stayGlobe();
            log(mindAnswer(line) || ASTRANOV_BLURB, 'ok');
          });
          return true;
        }
      } catch (_) {}
      text = ASTRANOV_BLURB;
    }
    String(text).split('\n').forEach(function (ln) { if (ln.trim()) log(ln, 'ok'); });
    try { if (G.SNCli && SNCli.preview) SNCli.preview(String(text).slice(0, 80)); } catch (_) {}
    return true;
  }

  function patchCliMind() {
    try {
      if (!G.SNCli || G.SNCli.__snGuestPassMind) return;
      G.SNCli.__snGuestPassMind = 1;
      ['run', 'handle', 'submit', 'exec'].forEach(function (fn) {
        if (typeof G.SNCli[fn] !== 'function') return;
        var prev = G.SNCli[fn].bind(G.SNCli);
        G.SNCli[fn] = function (raw) {
          var s = String(raw || '').trim();
          if (!s) return prev(raw);
          if (isResearchish(s) || /astranov|spacenet|who are you|what are you/i.test(s)) {
            try {
              answerInCli(s);
              return { ok: true, via: 'guest-pass-mind' };
            } catch (e) {
              log(ASTRANOV_BLURB, 'ok');
              return { ok: true };
            }
          }
          return prev(raw);
        };
      });
    } catch (_) {}
  }

  function oneCli() {
    try {
      var style = document.getElementById('sn-guest-pass-one-cli');
      if (!style) {
        style = document.createElement('style');
        style.id = 'sn-guest-pass-one-cli';
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent =
        'body.sn-guest #stc-cmd, body.sn-guest #stc-cmd-in, body.sn-guest #stc-compact .stc-cmd,' +
        'body.sn-guest .stc-cmd-row{display:none!important;height:0!important;overflow:hidden!important}' +
        'body.sn-guest #panel, body.sn-guest #cli-form, body.sn-guest #cli-in{display:flex!important;visibility:visible!important}' +
        'body:not(.sn-guest) #stc-cmd-in{opacity:0.001;pointer-events:none;position:absolute;width:1px;height:1px;}' +
        'body:not(.sn-guest) #cli-in{display:block!important}';
    } catch (_) {}
    try { document.body.classList.toggle('sn-guest', isGuest()); } catch (_) {}
  }

  function hideGuestChrome() {
    try {
      var style = document.getElementById('sn-guest-pass-hide');
      if (!style) {
        style = document.createElement('style');
        style.id = 'sn-guest-pass-hide';
        (document.head || document.documentElement).appendChild(style);
      }
      style.textContent =
        'body.sn-guest #sn-unit, body.sn-guest .sn-unit, body.sn-guest [data-sn-unit],' +
        'body.sn-guest #silver-wings, body.sn-guest .silver-wings, body.sn-guest [data-silver-wings],' +
        'body.sn-guest #sn-locked, body.sn-guest .sn-locked, body.sn-guest [data-sn-locked],' +
        'body.sn-guest #sn-scan, body.sn-guest .sn-scan-badge, body.sn-guest [data-sn-scan],' +
        'body.sn-guest .unit-locked, body.sn-guest .unit-scan,' +
        'body.sn-guest #lagos-footer, body.sn-guest .lagos-footer, body.sn-guest [data-lagos],' +
        'body.sn-guest footer.lagos, body.sn-guest .sn-lagos-footer,' +
        'body.sn-guest #sn-helper-fx, body.sn-guest #sn-silver-vector, body.sn-guest #sn-silver-rive,' +
        'body.sn-guest .sn-helper-hud, body.sn-guest #sn-silver-hud' +
        '{display:none!important;visibility:hidden!important;pointer-events:none!important}' +
        'body.sn-guest .sn-radio, body.sn-guest [data-usage-ship], body.sn-guest .usage-ship{display:none!important}';
    } catch (_) {}
    try {
      if (G.SNCli && SNCli.log && !SNCli.__snGuestPassScrub) {
        var L0 = SNCli.log.bind(SNCli);
        SNCli.log = function (m, c, force) {
          var s = String(m || '');
          if (isGuest() && /SILVER WINGS|UNIT\b|LOCKED|SCAN\b|Lagos|USAGE SHIP|SPACEX BOT/i.test(s)) return;
          return L0(m, c, force);
        };
        SNCli.__snGuestPassScrub = 1;
      }
    } catch (_) {}
  }

  function showGlobeCta(kind) {
    try {
      var id = 'sn-guest-globe-cta';
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('div');
        el.id = id;
        el.style.cssText =
          'position:fixed;left:50%;bottom:96px;transform:translateX(-50%);z-index:11000;' +
          'display:flex;gap:8px;align-items:center;padding:10px 14px;border-radius:14px;' +
          'background:rgba(8,14,28,.9);border:1px solid rgba(100,180,255,.5);' +
          'box-shadow:0 8px 28px rgba(0,0,0,.45);font:600 13px system-ui;color:#e8f4ff;max-width:min(440px,94vw)';
        el.innerHTML =
          '<span data-msg>Guest</span>' +
          '<button type="button" data-a="locate" style="cursor:pointer;border:0;border-radius:10px;padding:8px 12px;font:700 12px system-ui;background:#1a6fd4;color:#fff">Locate</button>' +
          '<button type="button" data-a="google" style="cursor:pointer;border:0;border-radius:10px;padding:8px 12px;font:700 12px system-ui;background:#fff;color:#111">Google</button>' +
          '<button type="button" data-a="x" style="cursor:pointer;border:0;background:transparent;color:#9ab;font-size:16px">×</button>';
        document.body.appendChild(el);
        el.addEventListener('click', function (ev) {
          var a = ev.target && ev.target.getAttribute && ev.target.getAttribute('data-a');
          if (a === 'locate') {
            try {
              if (G.SNMap && SNMap.locate) void SNMap.locate();
              else if (navigator.geolocation) {
                navigator.geolocation.getCurrentPosition(function (pos) {
                  G._snLastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                  log('Locate · ok', 'ok');
                });
              }
            } catch (_) {}
          } else if (a === 'google') {
            try {
              if (G.SNAuth && SNAuth.openModal) SNAuth.openModal('Sign in with Google');
              else { var b = document.getElementById('btn-login'); if (b) b.click(); }
            } catch (_) {}
          } else if (a === 'x') { try { el.remove(); } catch (_) {} }
        });
      }
      var msg = el.querySelector('[data-msg]');
      if (msg) {
        msg.textContent =
          kind === 'call' ? 'Sign in · then CALL on Athens-line' :
          kind === 'poly' ? 'Locate · then delivery on the map' :
          'Locate · Google · then order';
      }
      el.style.display = 'flex';
      stayGlobe();
      try {
        if (G.SNGlobe && SNGlobe.pulse) {
          var p = G._snLastPos || { lat: 36.43, lng: 28.22 };
          SNGlobe.pulse(p.lat, p.lng, 0x7ec8ff, 'Locate · Google', 8000);
        }
      } catch (_) {}
      log(kind === 'call' ? 'Guest CALL · sign in · then Athens-line' : 'Guest · Locate + Google on the globe · no modal wall', 'ok');
    } catch (_) {}
  }

  function isOrderIntent(s) { return /\b(pizza|order|souvlaki|delivery|food|πιτσα|παραγγειλ)\b/i.test(s); }
  function isCallIntent(s) {
    return /^(call|video\s*call|phone|webrtc)\b/i.test(String(s || '').trim()) || /\bcall\s+me\b/i.test(s);
  }
  function isPolyIntent(s) { return /\b(poly|polygon|route\s*demo|85-?pt)\b/i.test(s); }

  function patchSoftWalls() {
    try {
      if (G.SNCli && !G.SNCli.__snGuestPassSoft) {
        G.SNCli.__snGuestPassSoft = 1;
        var prev = typeof G.SNCli.run === 'function' ? G.SNCli.run.bind(G.SNCli) :
          (typeof G.SNCli.handle === 'function' ? G.SNCli.handle.bind(G.SNCli) : null);
        if (prev) {
          var wrap = function (raw) {
            var s = String(raw || '').trim();
            if (!s) return prev(raw);
            if (isGuest()) {
              if (isOrderIntent(s)) { showGlobeCta('pizza'); return { ok: false, error: 'guest_order_cta' }; }
              if (isCallIntent(s)) { showGlobeCta('call'); return { ok: false, error: 'guest_call_signin' }; }
              if (isPolyIntent(s)) { showGlobeCta('poly'); return { ok: false, error: 'guest_poly' }; }
            }
            return prev(raw);
          };
          if (typeof G.SNCli.run === 'function') G.SNCli.run = wrap;
          if (typeof G.SNCli.handle === 'function') G.SNCli.handle = wrap;
        }
      }
    } catch (_) {}
    try {
      if (G.SNWebRTC && !G.SNWebRTC.__snGuestPassCall) {
        G.SNWebRTC.__snGuestPassCall = 1;
        var oc = G.SNWebRTC.canCall;
        G.SNWebRTC.canCall = function (order, opts) {
          opts = opts || {};
          if (!signed() && !opts.force) { showGlobeCta('call'); return { ok: false, reason: 'Sign in to call', needAuth: true }; }
          return oc ? oc.call(G.SNWebRTC, order, opts) : { ok: true };
        };
        if (typeof G.SNWebRTC.startCall === 'function') {
          var os = G.SNWebRTC.startCall.bind(G.SNWebRTC);
          G.SNWebRTC.startCall = function (order, opts) {
            opts = opts || {};
            if (!signed() && !opts.force) { showGlobeCta('call'); return { ok: false, needAuth: true }; }
            try {
              if (G.SNSpaceLinks && typeof SNSpaceLinks.startCall === 'function')
                return SNSpaceLinks.startCall.apply(SNSpaceLinks, arguments);
            } catch (_) {}
            return os(order, opts);
          };
        }
      }
    } catch (_) {}
    try {
      var st = document.getElementById('sn-guest-pass-no-modal');
      if (!st) {
        st = document.createElement('style');
        st.id = 'sn-guest-pass-no-modal';
        st.textContent = '.sn-video-call-modal,.video-call-modal,[data-sn-video-call-modal],#sn-auth-runbook{display:none!important}';
        (document.head || document.documentElement).appendChild(st);
      }
    } catch (_) {}
  }

  function scrubKitchen() {
    try {
      if (G.SNProfiles && G.SNProfiles.list) {
        (G.SNProfiles.list({ role: 'vendor' }) || []).forEach(function (v) {
          if (v && /Astranov Kitchen|kitchen_/i.test(String(v.name || '') + String(v.id || ''))) {
            try { if (G.SNProfiles.remove) G.SNProfiles.remove(v.id); } catch (_) {}
          }
        });
      }
    } catch (_) {}
  }

  function tick() {
    try { document.body.classList.toggle('sn-guest', isGuest()); } catch (_) {}
    oneCli();
    hideGuestChrome();
    patchCliMind();
    patchSoftWalls();
    scrubKitchen();
    if (!isGuest()) {
      try { var el = document.getElementById('sn-guest-globe-cta'); if (el) el.remove(); } catch (_) {}
    }
  }

  function init() {
    tick();
    setInterval(tick, 2500);
    setTimeout(tick, 800);
    setTimeout(tick, 3000);
  }

  G.SNGuestPass0822 = { build: BUILD, answerInCli: answerInCli, showGlobeCta: showGlobeCta, oneCli: oneCli };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
