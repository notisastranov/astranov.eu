/**
 * P0 RESEARCH + CALL wire — 20260817093000
 * Research submit: answer in CLI within timeout; orbit pin if place; else stay on globe
 * Non-place questions never hang / never teleport
 * Load space-links + webrtc-space after globe/webrtc
 * Guest call: sign in → great-circle → WebRTC (no room-code first)
 * Kill EventSource('/__reload')
 * Guest login: scrub Cloud Console runbook unless owner/sn-debug
 */
(function (G) {
  'use strict';
  if (G.__snResearchCall) return;
  G.__snResearchCall = 1;
  var BUILD = '20260817093000-research-call';

  function log(m, c) {
    try {
      if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 220), c || 'ok', true);
    } catch (_) {}
  }

  function signed() {
    try { return !!(G.SNAuth && SNAuth.user); } catch (_) { return false; }
  }

  function owner() {
    try { return !!(G.SNAuth && SNAuth.isOwner && SNAuth.isOwner()); } catch (_) { return false; }
  }

  function killReload() {
    try {
      if (G.__snEsReload) {
        try { G.__snEsReload.close(); } catch (_) {}
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
    try { if (G.SNMap && SNMap.active && SNMap.close) SNMap.close(); } catch (_) {}
    try { if (G.SNGlobe && SNGlobe.goToTier) SNGlobe.goToTier('global'); } catch (_) {}
  }

  function isNonPlace(q) {
    var s = String(q || '').trim();
    var low = s.toLowerCase();
    if (!s) return false;
    if (/\?$/.test(s)) return true;
    if (/^(what|why|how|who|when|explain|tell me|is |are |can |do |does |should |would |define )\b/.test(low)) return true;
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
      setTimeout(function () { finish(null, 'timeout'); }, 9000);
      try {
        var mind = G.SNAstranovMind || G.SNFreeMind;
        if (mind && typeof mind.answer === 'function') {
          var quick = mind.answer(line, { mode: 'chat' });
          if (quick && quick.text) { finish(String(quick.text), 'mind'); return; }
        }
      } catch (_) {}
      try {
        if (G.SNAi && typeof SNAi.ask === 'function') {
          Promise.resolve(SNAi.ask(line))
            .then(function (r) { finish(r ? String(r) : null, 'ai'); })
            .catch(function () { finish(null, 'ai-err'); });
          return;
        }
      } catch (_) {}
      try {
        if (G.SNSubscription && typeof SNSubscription.askPowerful === 'function') {
          Promise.resolve(SNSubscription.askPowerful(line, { mode: 'chat', timeoutMs: 8000 }))
            .then(function (pow) {
              if (pow && pow.ok && pow.text) finish(String(pow.text), 'sub');
              else finish(null, 'sub-miss');
            })
            .catch(function () { finish(null, 'sub-err'); });
          return;
        }
      } catch (_) {}
      var low = String(line || '').toLowerCase();
      if (/astranov|spacenet/.test(low)) {
        finish(
          'Astranov is the mind. SpaceNet is the net — delivery and presence on the live globe (Earth, orbit, field). Name a place, a thing, or an order.',
          'local'
        );
        return;
      }
      finish('Still thinking · try again, or name a place / order.', 'empty');
    });
  }

  function paintResearchPin(line) {
    try {
      if (!G.SNSpaceLinks || !SNSpaceLinks.addResearch) return;
      var m = String(line || '').match(/\b(in|at|near|about)\s+([A-Za-z\u00c0-\u024f][A-Za-z\u00c0-\u024f\s\-']{1,40})\b/);
      if (!m) return;
      var placeQ = m[2].trim();
      if (/^(the|a|an|this|that|it|what|who)\b/i.test(placeQ)) return;
      void SNSpaceLinks.resolvePlace(placeQ).then(function (p) {
        if (p && p.lat != null) SNSpaceLinks.addResearch(p, { label: p.label || placeQ });
      });
    } catch (_) {}
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
        try { if (G.SNCli.beginTurn) SNCli.beginTurn(); } catch (_) {}
        return answerFast(s).then(function (r) {
          stayGlobe();
          if (r && r.text) {
            String(r.text).split('\n').forEach(function (ln) {
              if (ln.trim()) log(ln, 'ok');
            });
            try { if (SNCli.preview) SNCli.preview(String(r.text).slice(0, 80)); } catch (_) {}
            paintResearchPin(s);
          } else {
            log('No reply yet · stay on the globe · try a shorter question.', 'dim');
          }
          try { if (G.SNCli.endTurn) SNCli.endTurn(); } catch (_) {}
          clearInputs();
          return true;
        });
      }

      return prev(raw);
    };
  }

  function loadScript(src) {
    return new Promise(function (resolve) {
      fetch(src, { cache: 'no-store' })
        .then(function (r) {
          if (!r.ok) throw new Error('http');
          return r.text();
        })
        .then(function (code) {
          var s = document.createElement('script');
          s.text = code;
          document.head.appendChild(s);
          resolve(true);
        })
        .catch(function () {
          var s = document.createElement('script');
          s.async = true;
          s.src = src;
          s.onload = function () { resolve(true); };
          s.onerror = function () { resolve(false); };
          document.head.appendChild(s);
        });
    });
  }

  function wireSpaceLinks() {
    if (G.__snSpaceWired) return Promise.resolve();
    G.__snSpaceWired = 1;
    var b = '';
    try { b = (document.querySelector('meta[name="astranov-build"]') || {}).content || ''; } catch (_) {}
    var q = b ? '?v=' + encodeURIComponent(b) : '';
    return loadScript('/js/spacenet/space-links.js' + q)
      .then(function () { return loadScript('/js/spacenet/webrtc-space.js' + q); })
      .then(function () {
        try { if (G.SNSpaceLinks && SNSpaceLinks.init) SNSpaceLinks.init(); } catch (_) {}
        try { if (G.SNWebRTCSpace && SNWebRTCSpace.init) SNWebRTCSpace.init(); } catch (_) {}
        log('Space links · call = great-circle on globe', 'dim');
      });
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

    try {
      var btn = document.getElementById('sn-rib-call');
      if (btn && !btn.__snSpace) {
        btn.__snSpace = 1;
        btn.addEventListener('click', function (ev) {
          if (!signed()) {
            ev.preventDefault();
            ev.stopPropagation();
            log('Sign in to call', 'err');
            try { if (G.SNAuth && SNAuth.openModal) SNAuth.openModal('Sign in to call'); } catch (_) {}
            return false;
          }
          try { if (G.SNCli && SNCli.run) void SNCli.run('call athens'); } catch (_) {}
        }, true);
      }
    } catch (_) {}
  }

  function scrubAuthRunbook() {
    try {
      if (!G.SNAuth || SNAuth.__snScrub) return;
      SNAuth.__snScrub = 1;
      var debug = owner() || (function () {
        try { return /[?&]sn-debug=1(?:&|$)/.test(location.search || ''); } catch (_) { return false; }
      })();
      if (typeof SNAuth.setupLines === 'function' && !debug) {
        SNAuth.setupLines = function () { return []; };
      }
      var orig = SNAuth.openModal;
      if (typeof orig === 'function') {
        SNAuth.openModal = function (err) {
          var m = orig.call(SNAuth, err);
          try {
            if (debug) return m;
            var warn = document.getElementById('sn-auth-warn');
            if (warn) warn.style.display = 'none';
            document.querySelectorAll('.sn-auth-actions, #sn-auth-setup-btn, #sn-auth-copy-btn, #sn-auth-cid').forEach(function (el) {
              if (el) el.style.display = 'none';
            });
            var copy = document.querySelector('#sn-auth-card .sn-auth-copy');
            if (copy) copy.textContent = 'Sign in to order and save your AE';
          } catch (_) {}
          return m;
        };
      }
    } catch (_) {}
  }

  function tick() {
    killReload();
    patchCliResearch();
    patchCallGuest();
    scrubAuthRunbook();
  }

  function init() {
    killReload();
    tick();
    setInterval(tick, 2000);
    document.addEventListener('sn:os-ready', function () {
      wireSpaceLinks().then(function () {
        patchCallGuest();
        patchCliResearch();
      });
    });
    setTimeout(function () {
      wireSpaceLinks();
      patchCliResearch();
      patchCallGuest();
    }, 2500);
  }

  G.SNResearchCall = { build: BUILD, answerFast: answerFast, wireSpaceLinks: wireSpaceLinks };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
