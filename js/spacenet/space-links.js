/**
 * SNSpaceLinks — every live feature is a thing on the globe / orbit / field.
 * OWNER LAW 2026-08-17:
 *   If it is not on the globe/orbit/field, it is unfinished.
 *   Street/satellite is a zoom-in, not home.
 *   Call  = glowing great-circle + two lit pins (glow while live, dim on hangup)
 *   Research = orbit pin + optional arc
 *   Order   = route arc
 *   Marina / vendor = field pin
 * No VIDEO CALL room-code modal as primary UI.
 * Build: 20260817120000-space-links
 */
(function (global) {
  'use strict';
  var BUILD = '20260817120000-space-links';
  var links = Object.create(null);
  var nextId = 1;

  function log(m, c) {
    try {
      if (global.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 220), c || 'ok', true);
    } catch (_) {}
  }

  function mePos() {
    try {
      var p =
        (global.SNProfiles && SNProfiles.me && SNProfiles.me()) ||
        global._snLastPos ||
        global._snPhysPos ||
        (global.SNGlobe && SNGlobe.focusPos && SNGlobe.focusPos());
      if (p && p.lat != null && p.lng != null) return { lat: Number(p.lat), lng: Number(p.lng) };
    } catch (_) {}
    return { lat: 36.434, lng: 28.217, soft: true };
  }

  function ensureGlobe() {
    return global.SNGlobe && SNGlobe.ready && typeof THREE !== 'undefined';
  }

  function drawArc(a, b, opts) {
    opts = opts || {};
    if (!a || !b || a.lat == null || b.lat == null) return null;
    if (!ensureGlobe()) return null;
    try {
      var segs = SNGlobe.drawTourLine(
        [
          { lat: a.lat, lng: a.lng },
          { lat: b.lat, lng: b.lng },
        ],
        {
          append: true,
          color: opts.color != null ? opts.color : 0x4cc9ff,
          opacity: opts.live === false ? 0.28 : 0.92,
          alt: opts.alt != null ? opts.alt : 1.032,
          pickColor: opts.colorA != null ? opts.colorA : 0x44ffaa,
          dropColor: opts.colorB != null ? opts.colorB : 0x3d9eff,
          pickLabel: opts.labelA || '',
          dropLabel: opts.labelB || '',
        }
      );
      return segs;
    } catch (e) {
      console.warn('[SNSpaceLinks] arc', e);
      return null;
    }
  }

  function pin(lat, lng, color, label, ms) {
    if (!ensureGlobe() || lat == null || lng == null) return null;
    try {
      return SNGlobe.pulse(lat, lng, color != null ? color : 0x3d9eff, label || '', ms || 60000);
    } catch (_) {
      return null;
    }
  }

  function addCall(peer, opts) {
    opts = opts || {};
    var a = opts.from || mePos();
    var b = peer;
    if (!b || b.lat == null) {
      log('Call needs peer lat/lng or place · spatial link skipped', 'dim');
      return null;
    }
    var id = opts.id || 'call-' + nextId++;
    remove(id);
    var color = opts.color != null ? opts.color : 0x7ec8ff;
    var line = drawArc(a, b, {
      color: color,
      live: true,
      colorA: 0x44ffaa,
      colorB: 0xffd080,
      labelA: opts.labelA || 'YOU',
      labelB: opts.labelB || opts.label || 'PEER',
      alt: 1.04,
    });
    var pA = pin(a.lat, a.lng, 0x44ffaa, opts.labelA || 'YOU', 120000);
    var pB = pin(b.lat, b.lng, 0xffd080, opts.labelB || opts.label || 'PEER', 120000);
    links[id] = {
      type: 'call',
      live: true,
      a: a,
      b: b,
      line: line,
      pinA: pA,
      pinB: pB,
      color: color,
      label: opts.label || 'Call',
      born: Date.now(),
    };
    try {
      if (SNGlobe.frameRoute) SNGlobe.frameRoute([a, b], { tier: opts.tier || 'national' });
    } catch (_) {}
    log(
      'CALL on globe · ' +
        (opts.label || 'peer') +
        ' · ' +
        a.lat.toFixed(2) +
        ',' +
        a.lng.toFixed(2) +
        ' → ' +
        b.lat.toFixed(2) +
        ',' +
        b.lng.toFixed(2),
      'ok'
    );
    try {
      if (global.SNCli && SNCli.preview) SNCli.preview('📞 ' + (opts.label || 'Call') + ' · on globe');
    } catch (_) {}
    return id;
  }

  function setLive(id, live) {
    var L = links[id];
    if (!L) return false;
    L.live = !!live;
    try {
      if (L.line && Array.isArray(L.line)) {
        L.line.forEach(function (seg) {
          if (seg && seg.material) {
            seg.material.opacity = live ? 0.92 : 0.22;
            seg.material.color.setHex(live ? L.color || 0x7ec8ff : 0x4a6080);
          }
        });
      }
    } catch (_) {}
    if (!live) log((L.label || L.type) + ' · dimmed on hangup', 'dim');
    return true;
  }

  function remove(id) {
    var L = links[id];
    if (!L) return;
    try {
      if (L.line && Array.isArray(L.line) && global.SNGlobe && SNGlobe.getPivot) {
        var pivot = SNGlobe.getPivot();
        L.line.forEach(function (seg) {
          try {
            if (pivot) pivot.remove(seg);
            if (seg.geometry) seg.geometry.dispose();
            if (seg.material) seg.material.dispose();
          } catch (_) {}
        });
      }
    } catch (_) {}
    delete links[id];
  }

  function addResearch(place, opts) {
    opts = opts || {};
    if (!place || place.lat == null) return null;
    var id = opts.id || 'research-' + nextId++;
    remove(id);
    var color = opts.color != null ? opts.color : 0xb48cff;
    var p = pin(place.lat, place.lng, color, opts.label || 'RESEARCH', opts.ms || 90000);
    var line = null;
    if (opts.arcFromMe !== false) {
      var me = mePos();
      line = drawArc(me, place, { color: color, live: true, alt: 1.05, labelB: opts.label || 'RESEARCH' });
    }
    links[id] = {
      type: 'research',
      live: true,
      a: mePos(),
      b: place,
      line: line,
      pinB: p,
      color: color,
      label: opts.label || 'Research',
      born: Date.now(),
    };
    try {
      if (SNGlobe.flyNear) SNGlobe.flyNear(place.lat, place.lng, opts.tier || 'national');
    } catch (_) {}
    log('RESEARCH pin · ' + (opts.label || place.lat.toFixed(2) + ',' + place.lng.toFixed(2)), 'ok');
    return id;
  }

  function addOrderRoute(from, to, opts) {
    opts = opts || {};
    if (!from || !to || from.lat == null || to.lat == null) return null;
    var id = opts.id || 'order-' + nextId++;
    remove(id);
    var color = opts.color != null ? opts.color : 0x00e090;
    var line = drawArc(from, to, {
      color: color,
      live: true,
      colorA: 0x44ff88,
      colorB: 0x3d9eff,
      labelA: opts.labelA || 'PICK',
      labelB: opts.labelB || 'DROP',
      alt: 1.028,
    });
    links[id] = {
      type: 'order',
      live: true,
      a: from,
      b: to,
      line: line,
      color: color,
      label: opts.label || 'Order',
      born: Date.now(),
    };
    try {
      if (SNGlobe.frameRoute) SNGlobe.frameRoute([from, to], { tier: opts.tier || 'regional' });
    } catch (_) {}
    return id;
  }

  function addFieldPin(place, opts) {
    opts = opts || {};
    if (!place || place.lat == null) return null;
    var id = opts.id || 'field-' + nextId++;
    remove(id);
    var color = opts.color != null ? opts.color : 0x3dd68c;
    var p = pin(place.lat, place.lng, color, opts.label || 'FIELD', opts.ms || 120000);
    links[id] = {
      type: 'field',
      live: true,
      b: place,
      pinB: p,
      color: color,
      label: opts.label || 'Field',
      born: Date.now(),
    };
    return id;
  }

  function list() {
    return Object.keys(links).map(function (id) {
      var L = links[id];
      return { id: id, type: L.type, live: L.live, label: L.label, a: L.a, b: L.b };
    });
  }

  function clear(type) {
    Object.keys(links).forEach(function (id) {
      if (!type || links[id].type === type) remove(id);
    });
  }

  function resolvePlace(q) {
    return new Promise(function (resolve) {
      q = String(q || '').trim();
      if (!q) return resolve(null);
      try {
        if (global.SNSearch && typeof SNSearch.geocode === 'function') {
          SNSearch.geocode(q)
            .then(function (r) {
              if (r && r.lat != null) resolve({ lat: r.lat, lng: r.lng, label: r.name || q });
              else resolve(null);
            })
            .catch(function () {
              resolve(null);
            });
          return;
        }
      } catch (_) {}
      var seeds = {
        athens: { lat: 37.98, lng: 23.73, label: 'Athens' },
        rhodes: { lat: 36.43, lng: 28.22, label: 'Rhodes' },
        mandraki: { lat: 36.451, lng: 28.224, label: 'Mandraki' },
        tokyo: { lat: 35.68, lng: 139.69, label: 'Tokyo' },
        paris: { lat: 48.86, lng: 2.35, label: 'Paris' },
        london: { lat: 51.51, lng: -0.13, label: 'London' },
        'new york': { lat: 40.71, lng: -74.01, label: 'New York' },
      };
      var key = q.toLowerCase();
      if (seeds[key]) return resolve(seeds[key]);
      resolve(null);
    });
  }

  function handleLine(raw) {
    var s = String(raw || '').trim();
    var low = s.toLowerCase();
    if (/^links?\s*(list|show)?$/.test(low)) {
      var rows = list();
      log('Space links · ' + rows.length, 'ok');
      rows.forEach(function (r) {
        log((r.live ? '●' : '○') + ' ' + r.type + ' · ' + (r.label || r.id), r.live ? 'ok' : 'dim');
      });
      return true;
    }
    if (/^links?\s+clear/.test(low)) {
      clear();
      log('Space links cleared', 'dim');
      return true;
    }
    var m = s.match(/^(?:call|phone)\s+(.+)$/i);
    if (m) {
      var placeQ = m[1].replace(/\b(to|in|at)\s+/i, '').trim();
      void resolvePlace(placeQ).then(function (p) {
        if (!p) {
          log('No coords for ' + placeQ + ' · try a known city', 'err');
          return;
        }
        var id = addCall(p, { label: p.label || placeQ, labelB: p.label || placeQ });
        try {
          if (global.SNWebRTC && SNWebRTC.startCall) {
            void SNWebRTC.startCall(null, {
              force: true,
              instant: true,
              label: p.label || placeQ,
              room: 'geo-' + String(p.lat.toFixed(2) + '-' + p.lng.toFixed(2)).replace(/\./g, ''),
              spaceLinkId: id,
              peerLat: p.lat,
              peerLng: p.lng,
            });
          }
        } catch (_) {}
      });
      return true;
    }
    return false;
  }

  function installCli() {
    try {
      if (!global.SNCli || typeof SNCli.run !== 'function') return;
      if (SNCli._snSpaceLinksHook) return;
      SNCli._snSpaceLinksHook = true;
      var prev = SNCli.run.bind(SNCli);
      SNCli.run = function (raw) {
        try {
          if (handleLine(raw)) return Promise.resolve(true);
        } catch (_) {}
        return prev(raw);
      };
    } catch (_) {}
  }

  function init() {
    installCli();
    setTimeout(installCli, 1200);
  }

  global.SNSpaceLinks = {
    build: BUILD,
    init: init,
    addCall: addCall,
    addResearch: addResearch,
    addOrderRoute: addOrderRoute,
    addFieldPin: addFieldPin,
    setLive: setLive,
    remove: remove,
    clear: clear,
    list: list,
    resolvePlace: resolvePlace,
    mePos: mePos,
    handleLine: handleLine,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setTimeout(init, 200);
    });
  } else {
    setTimeout(init, 200);
  }
})(typeof window !== 'undefined' ? window : globalThis);
