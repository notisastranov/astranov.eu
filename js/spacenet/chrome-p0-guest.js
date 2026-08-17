/**
 * P0 guest + cold-present — 20260817090000
 * 1 PRESENT globe 2 no 2025 3 GPS coach 4-5 guest LOGIN 6 Live now 7 no __reload 8 call gate 9 poly empty
 */
(function (G) {
  'use strict';
  if (G.__snP0Guest) return;
  G.__snP0Guest = 1;
  var RH = { lat: 36.4341, lng: 28.2176 };
  var AT = { lat: 37.9838, lng: 23.7275 };
  var gpsOk = false;
  try { gpsOk = localStorage.getItem('sn:gps-user-ok') === '1'; } catch (_) {}

  function log(m, c) {
    try { if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 180), c || 'ok', true); } catch (_) {}
  }
  function signed() {
    try { return !!(G.SNAuth && SNAuth.user); } catch (_) { return false; }
  }
  function owner() {
    try { return !!(G.SNAuth && SNAuth.isOwner && SNAuth.isOwner()); } catch (_) { return false; }
  }
  function fake(p) {
    return p && p.lat != null && Math.abs(+p.lat - RH.lat) < 0.02 && Math.abs(+p.lng - RH.lng) < 0.02;
  }
  function allowGps() {
    gpsOk = true;
    try { localStorage.setItem('sn:gps-user-ok', '1'); } catch (_) {}
  }
  function coach() {
    log('Why location: so pins and delivery are where you are — not a demo city.', 'ok');
    log('Tap Locate when ready · deny = stay on live globe.', 'dim');
  }

  if (navigator.geolocation && !navigator.geolocation.__snP0) {
    var geo = navigator.geolocation;
    var og = geo.getCurrentPosition.bind(geo);
    var ow = geo.watchPosition.bind(geo);
    geo.getCurrentPosition = function (ok, err, o) {
      if (!gpsOk) {
        coach();
        if (typeof err === 'function') try { err({ code: 1, message: 'Locate first' }); } catch (_) {}
        return;
      }
      return og(function (pos) {
        try {
          if (pos && pos.coords) {
            G._snPhysPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, source: 'gps' };
            G._snLastPos = G._snPhysPos;
          }
        } catch (_) {}
        if (ok) ok(pos);
      }, function (e) {
        log('GPS denied · stay on live globe', 'dim');
        try { if (G.SNGlobe && SNGlobe.goToTier) SNGlobe.goToTier('global'); } catch (_) {}
        if (err) err(e);
      }, o);
    };
    geo.watchPosition = function (ok, err, o) {
      if (!gpsOk) {
        coach();
        if (typeof err === 'function') try { err({ code: 1, message: 'Locate first' }); } catch (_) {}
        return 0;
      }
      return ow(ok, err, o);
    };
    geo.__snP0 = 1;
  }

  function scrubBoot() {
    try {
      var box = document.getElementById('sn-os-facts');
      if (!box) return;
      box.querySelectorAll('.sn-boot-sec').forEach(function (sec) {
        var t = (sec.textContent || '').toLowerCase();
        if (/links|packet|donate/.test(t)) {
          sec.style.display = 'none';
          var n = sec.nextElementSibling;
          while (n && !n.classList.contains('sn-boot-sec')) {
            if (/wifi|cell|bluetooth|radio|mesh|fallback|usb|meshtastic|donate|mining/i.test(n.textContent || ''))
              n.style.display = 'none';
            n = n.nextElementSibling;
          }
        }
      });
      var sub = document.getElementById('sn-os-sub');
      if (sub) sub.textContent = 'PRESENT · live globe';
      var actions = document.getElementById('sn-os-actions');
      if (actions && !document.getElementById('sn-boot-diag-link')) {
        var a = document.createElement('button');
        a.type = 'button';
        a.id = 'sn-boot-diag-link';
        a.className = 'sn-cli-glow alt';
        a.textContent = 'diagnostics';
        a.onclick = function () {
          try {
            if (G.SNOsBoot && SNOsBoot.diagnostics) SNOsBoot.diagnostics();
            else if (G.SNCli) void SNCli.run('diagnostics');
          } catch (_) {}
        };
        actions.appendChild(a);
      }
    } catch (_) {}
  }

  function present() {
    try {
      var y = document.getElementById('tl-year');
      var yr = new Date().getFullYear();
      if (yr < 2026) yr = 2026;
      if (y && (+y.value < 2026 || +y.value === 2025)) y.value = String(yr);
      var st = document.getElementById('tl-status');
      if (st) st.textContent = 'PRESENT · live';
    } catch (_) {}
  }

  function bindLive() {
    var btn = document.getElementById('stc-data-present');
    if (!btn || btn.__snP0) return;
    btn.__snP0 = 1;
    btn.addEventListener('click', function () {
      present();
      try { if (G.SNMap && SNMap.active && SNMap.close) SNMap.close(); } catch (_) {}
      try { document.body.classList.remove('city-map-on'); } catch (_) {}
      try { if (G.SNGlobe && SNGlobe.goToTier) SNGlobe.goToTier('global'); } catch (_) {}
      log('PRESENT · live globe', 'ok');
    }, true);
  }

  function patchAuth() {
    if (!G.SNAuth || SNAuth.__snP0) return;
    SNAuth.__snP0 = 1;
    var o = SNAuth.openModal;
    SNAuth.openModal = function (err) {
      var m = o ? o.call(SNAuth, err) : null;
      try {
        var debug = owner() || /[?&]sn-debug=1(?:&|$)/.test(location.search || '');
        var card = document.getElementById('sn-auth-card');
        if (!card) return m;
        var warn = document.getElementById('sn-auth-warn');
        if (warn) warn.style.display = debug ? '' : 'none';
        card.querySelectorAll('.sn-auth-actions, #sn-auth-setup-btn, #sn-auth-copy-btn, #sn-auth-cid').forEach(function (el) {
          if (el) el.style.display = debug ? '' : 'none';
        });
        var copy = card.querySelector('.sn-auth-copy');
        if (copy && !debug) copy.textContent = 'Sign in to order and save your AE';
        if (!document.getElementById('sn-auth-legal') && !debug) {
          var p = document.createElement('p');
          p.id = 'sn-auth-legal';
          p.style.cssText = 'margin-top:12px;font-size:11px';
          p.innerHTML = '<a class="sn-auth-link" href="/privacy.html" target="_blank" rel="noopener" style="display:inline;padding:4px 8px;margin-right:8px">Privacy</a><a class="sn-auth-link" href="/terms.html" target="_blank" rel="noopener" style="display:inline;padding:4px 8px">Terms</a>';
          card.appendChild(p);
        }
        if (!debug) SNAuth.setupLines = function () { return []; };
      } catch (_) {}
      return m || document.getElementById('sn-auth-gsi');
    };
  }

  function patchRtc() {
    if (!G.SNWebRTC || SNWebRTC.__snP0) return;
    SNWebRTC.__snP0 = 1;
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
        return os.call(SNWebRTC, order, opts);
      };
    }
  }

  function patchPoly() {
    try {
      if (G.SNOfferStack && SNOfferStack.demoDelivery && !SNOfferStack.__snP0) {
        var d = SNOfferStack.demoDelivery.bind(SNOfferStack);
        SNOfferStack.demoDelivery = function (opts) {
          if (!signed() && !owner()) {
            log('Sign in and locate to draw a delivery area.', 'dim');
            return Promise.resolve({ ok: false });
          }
          return d(opts || {});
        };
        SNOfferStack.__snP0 = 1;
      }
    } catch (_) {}
  }

  function patchCli() {
    if (!G.SNCli || typeof SNCli.run !== 'function' || SNCli.__snP0) return;
    SNCli.__snP0 = 1;
    var prev = SNCli.run.bind(SNCli);
    SNCli.run = function (raw) {
      var s = String(raw || '').trim();
      var low = s.toLowerCase();
      if (/^(call|phone)\b/.test(low) || low === 'call') {
        if (!signed()) {
          log('Sign in to call', 'err');
          try { if (G.SNAuth && SNAuth.openModal) SNAuth.openModal('Sign in to call'); } catch (_) {}
          return Promise.resolve(true);
        }
      }
      if (low === 'locate' || low === 'location' || low === 'gps' || low === 'where am i') {
        allowGps();
        coach();
      }
      if (low === 'poly' || low === 'polygon' || low === 'delivery area' || low === 'area') {
        if (!signed() || fake(G._snLastPos) || !G._snPhysPos) {
          log('Sign in and locate to draw a delivery area.', 'dim');
          return Promise.resolve(true);
        }
      }
      return prev(raw);
    };
  }

  function clearFake() {
    try {
      if (fake(G._snLastPos)) G._snLastPos = null;
      if (fake(G._snPhysPos)) G._snPhysPos = null;
      var last = JSON.parse(localStorage.getItem('sn:last-good-gps') || 'null');
      if (fake(last)) localStorage.removeItem('sn:last-good-gps');
    } catch (_) {}
  }

  function tick() {
    scrubBoot();
    present();
    bindLive();
    patchAuth();
    patchRtc();
    patchPoly();
    patchCli();
  }

  function init() {
    clearFake();
    present();
    tick();
    setInterval(tick, 2000);
    document.addEventListener('sn:os-ready', function () {
      clearFake();
      present();
      try { if (G.SNGlobe && SNGlobe.goToTier) SNGlobe.goToTier('global'); } catch (_) {}
      log('SpaceNet · PRESENT · live globe', 'ok');
    });
  }

  G.SNP0Guest = { allowGps: allowGps, forcePresent: present };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
