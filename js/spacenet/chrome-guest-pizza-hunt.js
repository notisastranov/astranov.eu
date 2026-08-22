/**
 * Guest pizza hunt — Build 20260822203000-earth-parent
 * PATCH #127 only · keep PASS · edit-in-place on full restored module.
 *
 * PASS (do not regress):
 *   pizza over South America → Origin · camera · -32.946, -61.777
 *   / No delivery shops near view · type Locate once
 *   No Kalithea 36.388 list. No Google wall.
 *
 * HONEST FAIL (20260822200000-release-drag):
 *   Astranov.Eu: dragging=false map=false ready=true tiltX=-0.6360 spinY=-0.4925
 *   (correct Rhodes euler) but viewLatLng still -32.998,-61.780.
 *   getTilt/getSpin are NOT pickLatLng's nodes. fly rhodes CITY line is a lie.
 *   viewLatLng = pickLatLng(canvas center) → raycast getEarth() → worldToLocal.
 *
 * FIX 20260822203000-earth-parent flyGlobeTo:
 *   1) pointerup/cancel on canvas (release trackball).
 *   2) walk getEarth() parents; apply Rhodes euler+quat to LIVE chain +
 *      getTilt/getSpin/getPivot; updateMatrixWorld; paint.
 *   3) if still SA rotate earth mesh so latLngToVec(36.44,28.22) points at camera; paint.
 *   4) success only if viewLatLng within 2.5 deg then log Rhodes. globe camera.
 *      then pulse >=10 Meshes.
 *   5) fail: Fly failed + parent names + view. No hunt. No lastFly.
 *      Swallow CITY Rhodes while hunting.
 *   Do NOT log Earth.CITY.Rhodes unless viewLatLng ~= 36.44,28.22.
 *
 * REAL SNGlobe exports: init, pulse, clearMarkers, flyNear, goToPlace, goToTier,
 *   viewLatLng, pickLatLng, setFocus, focusPos, getTilt, getSpin, getPivot, getEarth,
 *   getCamera, getRenderer, paint, ready, lastPos, getPhysics (if present).
 *   setGlobeLatLng NOT exported. stopMotion NOT exported.
 *
 * Product law: if it is not on the globe it is not shipped. Full module, no stub.
 */
(function (G) {
  'use strict';
  G.__snGuestPizzaHunt0822 = 1;
  var BUILD = '20260822203000-earth-parent';
  var hunting = false;
  var huntSession = false;
  var lastPins = [];
  var pinMeshes = [];
  var clickUnsub = null;
  var askedLocate = false;
  var suppressPoiUntil = 0;
  var canvasTapBound = false;
  var preferCameraUntil = 0;
  var lastFly = null;

  var RHODES = { lat: 36.44, lng: 28.22, name: 'Rhodes' };

  // Known fake / HQ / IP leaks that must NEVER be reported as YOU
  var FAKE_YOU = [
    { lat: 36.387557, lng: 28.222533, r: 0.03, name: 'Kalithea' },
    { lat: 36.434, lng: 28.217, r: 0.06, name: 'Rhodes silent' },
    { lat: 36.43, lng: 28.22, r: 0.05, name: 'Rhodes center' },
    { lat: 36.443, lng: 28.226, r: 0.04, name: 'Rhodes town' },
    { lat: 37.339, lng: -121.895, r: 0.12, name: 'San Jose IP' },
    { lat: 37.338, lng: -121.886, r: 0.12, name: 'Columbus Park' },
    { lat: 37.33, lng: -121.89, r: 0.12, name: 'San Jose' },
  ];

  var FOOD =
    /restaurant|fast_food|cafe|bar|pub|food|pizza|pizzeria|bakery|taverna|grill|souvlaki|kebab|burger|sushi|kitchen|deli|ice_cream|dessert|market/i;
  var PIZZA_RE =
    /\b(order\s+(me\s+)?(a\s+)?pizza|pizza\s*(please|order|near|nearby|delivery)?|get\s+(me\s+)?pizza|i\s+want\s+(a\s+)?pizza|find\s+pizza|pizza\s+shops?|hungry\s+for\s+pizza)\b/i;
  var ORDER_FOOD_RE =
    /\b(order\s+(me\s+)?(a\s+)?(food|meal|burger|souvlaki|kebab|sushi)|food\s+delivery|deliver\s+(me\s+)?(food|pizza))\b/i;
  // SHOW only — do NOT intercept `fly rhodes` (cli.js openCityAt must run)
  var SHOW_RHODES_RE =
    /^(show|go(?:\s+to)?|zoom(?:\s+to)?|take\s+me\s+to|look\s+at)\s+(the\s+)?(island\s+(of\s+)?)?(rhodes|rodos|ρόδος|ρόδο|ροδος|ροδοσ)\b/i;
  var POI_DUMP_RE =
    /Πλατεία|Πλατεια|πλατεία|\b\d+\s+POIs?\b|\b\d+\s+real shops\b|80 real shops|18 POIs/i;

  function log(m, c) {
    try {
      var s = String(m).slice(0, 420);
      if (isCityRhodesLine(s) && !viewNear(RHODES.lat, RHODES.lng, 2.5, 2.5)) return;
      if (G.SNCli && SNCli.log) SNCli.log(s, c || 'ok', true);
    } catch (_) {}
  }
  function preview(m) {
    try {
      if (G.SNCli && SNCli.preview) SNCli.preview(String(m).slice(0, 90));
    } catch (_) {}
  }
  function isGuest() {
    try {
      if (G.SNAuth && typeof SNAuth.isLoggedIn === 'function' && SNAuth.isLoggedIn()) return false;
      if (G.SNAuth && SNAuth.session && SNAuth.session.user) return false;
      if (G.SNAuth && SNAuth.user) return false;
    } catch (_) {}
    return true;
  }
  function snDebug() {
    try {
      return /(?:\?|&)sn-debug=1(?:&|$)/.test(String(location.search || ''));
    } catch (_) {
      return false;
    }
  }

  function globeOnly() {
    return hunting || huntSession;
  }

  function nearFake(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return true;
    for (var i = 0; i < FAKE_YOU.length; i++) {
      var f = FAKE_YOU[i];
      if (Math.abs(lat - f.lat) <= f.r && Math.abs(lng - f.lng) <= f.r) return f.name;
    }
    return null;
  }

  function isIpOrSoftSource(pos) {
    if (!pos) return true;
    if (pos.fallback) return true;
    if (pos.fromIp || pos.ip || pos.soft) return true;
    var src = String(pos.source || pos.from || '').toLowerCase();
    if (!src) return false;
    return /ip|soft|cache|leaflet|map|geocode|city|nominatim|photon|approx|look|verified/.test(src);
  }

  /** YOU = _snPhysPos + _snLocatedThisSession from an explicit GPS grant this session. */
  function hasSessionLocate() {
    try {
      if (!G._snLocatedThisSession) return false;
    } catch (_) {
      return false;
    }
    try {
      var p = G._snPhysPos;
      if (!p || p.lat == null || p.lng == null) return false;
      var lat = +p.lat;
      var lng = +p.lng;
      if (!isFinite(lat) || !isFinite(lng)) return false;
      if (nearFake(lat, lng)) return false;
      if (isIpOrSoftSource(p)) return false;
      var src = String(p.source || '').toLowerCase();
      var granted =
        p.fromGps === true ||
        p.real === true ||
        p.session === true ||
        src === 'gps' ||
        src === 'gps-watch';
      if (!granted) return false;
      return true;
    } catch (_) {}
    return false;
  }

  function markSessionLocate(lat, lng, extra) {
    extra = extra || {};
    if (extra.fallback || extra.fromIp || extra.ip || extra.soft) return;
    if (isIpOrSoftSource(extra)) return;
    if (nearFake(+lat, +lng)) return;
    try {
      G._snLocatedThisSession = true;
      var row = {
        lat: +lat,
        lng: +lng,
        fromGps: true,
        session: true,
        real: true,
        fallback: false,
        source: 'gps',
        ts: Date.now(),
        accuracy: extra.accuracy,
      };
      G._snPhysPos = row;
      G._snLastPos = row;
    } catch (_) {}
  }

  function scrubFakeYou() {
    try {
      var p = G._snPhysPos;
      if (!p) {
        G._snLocatedThisSession = false;
        return;
      }
      if (nearFake(+p.lat, +p.lng) || isIpOrSoftSource(p) || !G._snLocatedThisSession) {
        if (nearFake(+p.lat, +p.lng) || isIpOrSoftSource(p)) {
          G._snLocatedThisSession = false;
        }
      }
    } catch (_) {}
  }

  function cameraLook() {
    try {
      if (G.SNGlobe && typeof SNGlobe.viewLatLng === 'function') {
        var look = SNGlobe.viewLatLng();
        if (look && look.lat != null && isFinite(look.lat)) return { lat: +look.lat, lng: +look.lng };
      }
    } catch (_) {}
    try {
      if (G.SNGlobe && typeof SNGlobe.focusPos === 'function') {
        var f = SNGlobe.focusPos();
        if (f && f.lat != null && isFinite(f.lat)) return { lat: +f.lat, lng: +f.lng };
      }
    } catch (_) {}
    try {
      if (G._snGlobeFocus && G._snGlobeFocus.lat != null) {
        return { lat: +G._snGlobeFocus.lat, lng: +G._snGlobeFocus.lng };
      }
    } catch (_) {}
    if (lastFly && lastFly.lat != null && Date.now() - lastFly.ts < 20000) {
      return { lat: lastFly.lat, lng: lastFly.lng };
    }
    return null;
  }

  /** Prefer SNGlobe.ready === true for pulse; soft fallback if pulse exists (list still works). */
  function isGlobeReady() {
    try {
      if (G.SNGlobe && G.SNGlobe.ready === true) return true;
      if (G.SNGlobe && typeof SNGlobe.pulse === 'function') return true;
    } catch (_) {}
    return false;
  }

  async function waitGlobeReady(ms) {
    var t0 = Date.now();
    var limit = typeof ms === 'number' && ms > 0 ? ms : 2400;
    try {
      if (G.SNGlobe && typeof SNGlobe.init === 'function') SNGlobe.init();
    } catch (_) {}
    while (Date.now() - t0 < limit) {
      if (isGlobeReady()) return true;
      await sleep(90);
    }
    return isGlobeReady();
  }

  function lngDelta(a, b) {
    var d = Number(a) - Number(b);
    while (d > 180) d -= 360;
    while (d < -180) d += 360;
    return Math.abs(d);
  }

  function viewNear(targetLat, targetLng, tolLat, tolLng) {
    tolLat = tolLat != null ? tolLat : 2.5;
    tolLng = tolLng != null ? tolLng : 2.5;
    try {
      if (!G.SNGlobe || typeof SNGlobe.viewLatLng !== 'function') return false;
      var ll = SNGlobe.viewLatLng();
      if (!ll || ll.lat == null || !isFinite(ll.lat) || !isFinite(ll.lng)) return false;
      return Math.abs(+ll.lat - targetLat) < tolLat && lngDelta(ll.lng, targetLng) < tolLng;
    } catch (_) {
      return false;
    }
  }

  /**
   * Origin for bbox hunt.
   *   1) After show-rhodes (preferCameraUntil) → that camera, never YOU
   *   2) real YOU only if located THIS session (GPS grant)
   *   3) current camera look-at
   * NEVER invent Kalithea / silent Rhodes / San Jose IP as you.
   * NEVER trust bare _snLastPos (setFocus / Leaflet / IP pollute it).
   */
  function resolveOrigin() {
    scrubFakeYou();

    if (Date.now() < preferCameraUntil) {
      if (lastFly && lastFly.lat != null) {
        return { lat: lastFly.lat, lng: lastFly.lng, source: 'camera' };
      }
      var camR = cameraLook();
      if (camR) return { lat: camR.lat, lng: camR.lng, source: 'camera' };
    }

    try {
      if (hasSessionLocate() && G._snPhysPos && G._snPhysPos.lat != null) {
        var plat = +G._snPhysPos.lat;
        var plng = +G._snPhysPos.lng;
        if (isFinite(plat) && isFinite(plng) && !nearFake(plat, plng) && !isIpOrSoftSource(G._snPhysPos)) {
          return { lat: plat, lng: plng, source: 'you' };
        }
      }
    } catch (_) {}

    var cam = cameraLook();
    if (cam) return { lat: cam.lat, lng: cam.lng, source: 'camera' };

    try {
      if (G.SNGlobe && typeof SNGlobe.focusPos === 'function') {
        var f = SNGlobe.focusPos();
        if (f && f.lat != null && f.lng != null && isFinite(f.lat)) {
          return { lat: +f.lat, lng: +f.lng, source: 'focus' };
        }
      }
    } catch (_) {}
    try {
      if (G._snGlobeFocus && G._snGlobeFocus.lat != null) {
        return { lat: +G._snGlobeFocus.lat, lng: +G._snGlobeFocus.lng, source: 'focus-cache' };
      }
    } catch (_) {}

    return null;
  }

  function baseUrl() {
    return String((G.SN_CONFIG && SN_CONFIG.sbUrl) || G.SB_URL || '').replace(/\/$/, '');
  }
  function headers() {
    var cfg = G.SN_CONFIG || {};
    var h = {
      apikey: cfg.sbKey || G.SB_KEY || '',
      Authorization: 'Bearer ' + (cfg.sbKey || G.SB_KEY || ''),
      Accept: 'application/json',
    };
    try {
      if (G.SNAuth && SNAuth.session && SNAuth.session.access_token)
        h.Authorization = 'Bearer ' + SNAuth.session.access_token;
    } catch (_) {}
    return h;
  }
  function haversineKm(a, b) {
    if (!a || !b || a.lat == null || b.lat == null) return 9999;
    var R = 6371;
    var dLat = ((b.lat - a.lat) * Math.PI) / 180;
    var dLng = ((b.lng - a.lng) * Math.PI) / 180;
    var s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((a.lat * Math.PI) / 180) *
        Math.cos((b.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) *
        Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
  }
  function isBannedName(name) {
    var n = String(name || '');
    if (/Astranov\s*Kitchen/i.test(n)) return true;
    if (/Mesh\s*Alpha|Mesh\s*Beta|Mesh\s*Gamma/i.test(n)) return true;
    if (/Rai\s*Mesone|Rai\s*drone/i.test(n)) return true;
    if (/85[\s\-]?pt|DRIVER\s+EN\s+ROUTE/i.test(n)) return true;
    if (/Πλατεία|Πλατεια|πλατεία/i.test(n)) return true;
    return false;
  }
  function isFoodOrShop(v) {
    if (!v) return false;
    if (isBannedName(v.name)) return false;
    if (String(v.id || '').indexOf('demo-') === 0 || String(v.id || '').indexOf('kitchen_') === 0)
      return false;
    var blob =
      String(v.category || '') +
      ' ' +
      String(v.shopKind || '') +
      ' ' +
      String(v.kind || '') +
      ' ' +
      String(v.name || '') +
      ' ' +
      (Array.isArray(v.tags) ? v.tags.join(' ') : String(v.tags || ''));
    return FOOD.test(blob) || v.delivery_enabled === true;
  }

  function hideLeaflet() {
    try {
      if (G.SNMap && typeof SNMap.close === 'function') SNMap.close();
    } catch (_) {}
    try {
      if (G.SNMap) {
        try { SNMap.active = false; } catch (_) {}
        try { if ('active' in SNMap) SNMap.active = false; } catch (_) {}
      }
    } catch (_) {}
    try {
      var nodes = document.querySelectorAll(
        '.leaflet-container, .leaflet-pane, .leaflet-marker-icon, .leaflet-marker-shadow, .leaflet-control-container, #sn-map, #sn-map-root, #map'
      );
      for (var i = 0; i < nodes.length; i++) {
        var el = nodes[i];
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.style.setProperty('z-index', '-1', 'important');
      }
    } catch (_) {}
  }

  /**
   * Release trackball so internal G.dragging clears.
   * LIVE: SNGlobe.dragging is NOT G.dragging; stopMotion is NOT exported.
   * Dispatch pointerup + pointercancel + lostpointercapture on the renderer
   * canvas (and #globe canvas) — that is how G.dragging ends from outside.
   */
  function unfreezeGlobe() {
    try {
      if (G.SNMap && typeof SNMap.close === 'function') SNMap.close();
    } catch (_) {}
    try {
      if (G.SNMap) {
        try { SNMap.active = false; } catch (_) {}
        try { if ('active' in SNMap) SNMap.active = false; } catch (_) {}
      }
    } catch (_) {}

    function releasePointer(el) {
      if (!el) return;
      try {
        var opts = { bubbles: true, cancelable: true, pointerId: 1, isPrimary: true };
        try {
          el.dispatchEvent(new PointerEvent('pointerup', opts));
        } catch (_) {
          try {
            el.dispatchEvent(new Event('pointerup', { bubbles: true, cancelable: true }));
          } catch (__) {}
        }
        try {
          el.dispatchEvent(new PointerEvent('pointercancel', opts));
        } catch (_) {
          try {
            el.dispatchEvent(new Event('pointercancel', { bubbles: true, cancelable: true }));
          } catch (__) {}
        }
        try {
          if (typeof el.releasePointerCapture === 'function') el.releasePointerCapture(1);
        } catch (_) {}
        try {
          el.dispatchEvent(new Event('lostpointercapture', { bubbles: true }));
        } catch (_) {}
      } catch (_) {}
    }

    try {
      var ren = G.SNGlobe && typeof SNGlobe.getRenderer === 'function' ? SNGlobe.getRenderer() : null;
      if (ren && ren.domElement) releasePointer(ren.domElement);
    } catch (_) {}
    try {
      var canvas =
        document.querySelector('#globe canvas') ||
        document.querySelector('#globe') ||
        document.querySelector('canvas');
      if (canvas) releasePointer(canvas);
    } catch (_) {}

    // stopMotion is NOT exported on live globe.js — call only if present, never rely on it alone
    try {
      if (G.SNGlobe && typeof SNGlobe.stopMotion === 'function') SNGlobe.stopMotion();
    } catch (_) {}

    hideLeaflet();
  }

  function installMapGuard() {
    try {
      if (G.SNMap) {
        if (typeof SNMap.open === 'function' && !SNMap.__snPizzaOpenGuard) {
          var prevOpen = SNMap.open.bind(SNMap);
          SNMap.open = function () {
            if (globeOnly()) {
              hideLeaflet();
              return Promise.resolve(null);
            }
            return prevOpen.apply(SNMap, arguments);
          };
          SNMap.__snPizzaOpenGuard = true;
        }
        if (typeof SNMap.showLiveSat === 'function' && !SNMap.__snPizzaSatGuard) {
          var prevSat = SNMap.showLiveSat.bind(SNMap);
          SNMap.showLiveSat = function () {
            if (globeOnly()) {
              hideLeaflet();
              return Promise.resolve(null);
            }
            return prevSat.apply(SNMap, arguments);
          };
          SNMap.__snPizzaSatGuard = true;
        }
      }
    } catch (_) {}
    // NO __snPizzaGoGuard on goToPlace / flyNear — must call through to real flyNear.
    // Hunt still passes openMap:false + skipScan:true at the call site.
    try {
      if (G.SNGlobe && typeof SNGlobe.locate === 'function' && !SNGlobe.__snPizzaLocGuard) {
        var prevLoc = SNGlobe.locate.bind(SNGlobe);
        SNGlobe.locate = function () {
          if (globeOnly()) {
            return Promise.resolve({
              lat: null,
              lng: null,
              fallback: true,
              reason: 'hunt-globe-only',
            });
          }
          return prevLoc.apply(SNGlobe, arguments);
        };
        SNGlobe.__snPizzaLocGuard = true;
      }
    } catch (_) {}
    try {
      if (G.SNCli && typeof SNCli.gpsLocate === 'function' && !SNCli.__snPizzaGpsGuard) {
        var prevGps = SNCli.gpsLocate.bind(SNCli);
        SNCli.gpsLocate = function (opts) {
          if (globeOnly()) {
            opts = Object.assign({}, opts || {}, { allowIp: false, allowSoft: false });
          }
          return prevGps(opts);
        };
        SNCli.__snPizzaGpsGuard = true;
      }
    } catch (_) {}
    try {
      if (G.SNSearch && typeof SNSearch.crawl === 'function' && !SNSearch.__snPizzaCrawlGuard) {
        var prevCrawl = SNSearch.crawl.bind(SNSearch);
        SNSearch.crawl = function (q, opts) {
          if (globeOnly()) {
            return Promise.resolve({
              places: [],
              nearby: [],
              web: [],
              wiki: null,
              wikiHits: [],
              acted: ['pizza-hunt-block'],
            });
          }
          return prevCrawl(q, opts);
        };
        SNSearch.__snPizzaCrawlGuard = true;
      }
    } catch (_) {}
    try {
      if (G.SNCosmos && typeof SNCosmos.scan === 'function' && !SNCosmos.__snPizzaScanGuard) {
        var prevScan = SNCosmos.scan.bind(SNCosmos);
        SNCosmos.scan = function () {
          if (globeOnly()) return Promise.resolve({ lines: [], nearby: [], shops: 0 });
          return prevScan.apply(SNCosmos, arguments);
        };
        SNCosmos.__snPizzaScanGuard = true;
      }
    } catch (_) {}
    try {
      if (G.SNCli && typeof SNCli.log === 'function' && SNCli.__snPizzaLogGuard !== 'earth-parent') {
        var prevLog = SNCli.log.bind(SNCli);
        SNCli.log = function (m, c, force) {
          var s = String(m || '');
          if (globeOnly() && POI_DUMP_RE.test(s)) return;
          // Swallow Earth.CITY.Rhodes lie unless the mesh actually faces Rhodes.
          if (isCityRhodesLine(s) && !viewNear(RHODES.lat, RHODES.lng, 2.5, 2.5)) return;
          return prevLog(m, c, force);
        };
        SNCli.__snPizzaLogGuard = 'earth-parent';
      }
    } catch (_) {}
  }

  function beginGlobeHunt() {
    huntSession = true;
    hunting = true;
    G.__snPizzaHuntLive = true;
    installMapGuard();
    unfreezeGlobe();
    suppressPoiUntil = Date.now() + 4000;
    try {
      if (G.SNGlobe) G.SNGlobe.consumeClick = true;
    } catch (_) {}
  }

  function endGlobeHunt() {
    hunting = false;
    hideLeaflet();
    try {
      if (G.SNChromeCliAnswer && SNChromeCliAnswer.forcePaint) SNChromeCliAnswer.forcePaint();
    } catch (_) {}
  }

  /** True if a CLI line is the lying Earth.CITY.Rhodes claim. */
  function isCityRhodesLine(m) {
    var s = String(m || '');
    if (!s) return false;
    if (/Earth\s*[·.]\s*CITY/i.test(s) && /rhodes|rodos|ρόδος/i.test(s)) return true;
    if (/\bCITY\s*[·.]\s*(Rhodes|Rodos)\b/i.test(s)) return true;
    if (/Earth\.CITY\.(Rhodes|Rodos)/i.test(s)) return true;
    return false;
  }

  /** Globe.js latLngToVec — local unit vector on the earth mesh. */
  function latLngToVecLocal(lat, lng, r) {
    r = r == null ? 1 : r;
    try {
      if (G.SNGlobe && typeof SNGlobe.latLngToVec === 'function') {
        var v = SNGlobe.latLngToVec(lat, lng, r);
        if (v) return v;
      }
    } catch (_) {}
    var phi = ((90 - lat) * Math.PI) / 180;
    var theta = ((lng + 180) * Math.PI) / 180;
    var x = -r * Math.sin(phi) * Math.cos(theta);
    var y = r * Math.cos(phi);
    var z = r * Math.sin(phi) * Math.sin(theta);
    try {
      var earth0 = G.SNGlobe && typeof SNGlobe.getEarth === 'function' ? SNGlobe.getEarth() : null;
      if (earth0 && earth0.position && earth0.position.clone) {
        return earth0.position.clone().set(x, y, z);
      }
    } catch (_) {}
    return { x: x, y: y, z: z };
  }

  /** Walk getEarth() → parent → … (the nodes pickLatLng actually uses). */
  function walkEarthChain() {
    var out = { nodes: [], names: [] };
    try {
      if (!G.SNGlobe || typeof SNGlobe.getEarth !== 'function') return out;
      var n = SNGlobe.getEarth();
      var hops = 0;
      while (n && hops < 14) {
        out.nodes.push(n);
        var nm = 'obj';
        try {
          if (n.name) nm = String(n.name);
          else if (n.type) nm = String(n.type);
          else if (n.isMesh) nm = 'Mesh';
          else if (n.isScene) nm = 'Scene';
          else if (n.isCamera) nm = 'Camera';
          else nm = 'Object3D';
        } catch (_) {}
        out.names.push(String(nm).slice(0, 28));
        try {
          n = n.parent;
        } catch (_) {
          n = null;
        }
        hops++;
      }
    } catch (_) {}
    return out;
  }

  function nodeIsSceneOrCam(n) {
    if (!n) return true;
    try {
      if (n.isScene || n.type === 'Scene') return true;
      if (n.isCamera || (n.type && String(n.type).indexOf('Camera') >= 0)) return true;
    } catch (_) {}
    return false;
  }

  function writeEulerQuat(node, x, y, z) {
    if (!node || !node.rotation) return;
    try {
      if (node.rotation.set) node.rotation.set(x, y, z);
      else {
        node.rotation.x = x;
        node.rotation.y = y;
        node.rotation.z = z;
      }
    } catch (_) {}
    try {
      if (node.quaternion && node.quaternion.setFromEuler) node.quaternion.setFromEuler(node.rotation);
    } catch (_) {}
    try {
      node.matrixAutoUpdate = true;
    } catch (_) {}
    try {
      if (node.updateMatrix) node.updateMatrix();
    } catch (_) {}
  }

  /**
   * Apply polar euler+quat to LIVE getEarth() parent chain AND getTilt/getSpin/getPivot.
   * getTilt/getSpin are NOT pickLatLng's nodes — writing them alone leaves viewLatLng at SA.
   */
  function snapLiveChain(lat, lng) {
    try {
      if (!G.SNGlobe) return;
      var TILT_MAX = 1.05;
      var x = (-lat * Math.PI) / 180;
      var y = (-lng * Math.PI) / 180;
      if (x > TILT_MAX) x = TILT_MAX;
      if (x < -TILT_MAX) x = -TILT_MAX;

      var earth = typeof SNGlobe.getEarth === 'function' ? SNGlobe.getEarth() : null;
      var tilt = typeof SNGlobe.getTilt === 'function' ? SNGlobe.getTilt() : null;
      var spin = typeof SNGlobe.getSpin === 'function' ? SNGlobe.getSpin() : null;
      var pivot = typeof SNGlobe.getPivot === 'function' ? SNGlobe.getPivot() : null;
      var walk = walkEarthChain();

      var seen = [];
      function add(n) {
        if (!n) return;
        if (seen.indexOf(n) >= 0) return;
        seen.push(n);
      }
      var i;
      for (i = 0; i < walk.nodes.length; i++) add(walk.nodes[i]);
      add(tilt);
      add(spin);
      add(pivot);

      var liveParents = [];
      for (i = 0; i < walk.nodes.length; i++) {
        var pn = walk.nodes[i];
        if (pn === earth) continue;
        if (nodeIsSceneOrCam(pn)) continue;
        liveParents.push(pn);
      }

      for (i = 0; i < seen.length; i++) {
        var node = seen[i];
        if (!node || node === earth) continue;
        if (nodeIsSceneOrCam(node)) continue;
        var nm = '';
        try {
          nm = String(node.name || node.type || '');
        } catch (_) {}
        var rx = 0;
        var ry = 0;
        try {
          if (node.rotation) {
            rx = Math.abs(+node.rotation.x || 0);
            ry = Math.abs(+node.rotation.y || 0);
          }
        } catch (_) {}
        var isTilt =
          node === tilt || /tilt/i.test(nm) || (rx >= ry + 0.02 && rx > 0.01);
        var isSpin =
          node === spin ||
          node === pivot ||
          /spin|pivot/i.test(nm) ||
          (ry > rx + 0.02);
        var liveIdx = liveParents.indexOf(node);
        var nLive = liveParents.length;
        if (node === tilt) {
          writeEulerQuat(node, x, 0, 0);
        } else if (node === spin && node !== pivot) {
          writeEulerQuat(node, 0, y, 0);
        } else if (node === pivot && nLive <= 1) {
          // pivot is the only live rotator (getTilt/getSpin are detached) — both axes
          writeEulerQuat(node, x, y, 0);
        } else if (node === spin || node === pivot || (isSpin && !isTilt)) {
          writeEulerQuat(node, 0, y, 0);
        } else if (isTilt && !isSpin) {
          writeEulerQuat(node, x, 0, 0);
        } else if (nLive === 1 && liveIdx === 0) {
          writeEulerQuat(node, x, y, 0);
        } else if (liveIdx === 0) {
          writeEulerQuat(node, 0, y, 0);
        } else if (liveIdx === 1) {
          writeEulerQuat(node, x, 0, 0);
        } else {
          writeEulerQuat(node, x, y, 0);
        }
      }

      // matrices: root → leaf so worldToLocal in pickLatLng is current
      for (i = walk.nodes.length - 1; i >= 0; i--) {
        try {
          if (walk.nodes[i] && walk.nodes[i].updateMatrixWorld) walk.nodes[i].updateMatrixWorld(true);
        } catch (_) {}
      }
      try {
        if (tilt && tilt.updateMatrixWorld) tilt.updateMatrixWorld(true);
      } catch (_) {}
      try {
        if (spin && spin.updateMatrixWorld) spin.updateMatrixWorld(true);
      } catch (_) {}
      try {
        if (pivot && pivot.updateMatrixWorld) pivot.updateMatrixWorld(true);
      } catch (_) {}
      try {
        if (earth && earth.updateMatrixWorld) earth.updateMatrixWorld(true);
      } catch (_) {}
      try {
        var cam = typeof SNGlobe.getCamera === 'function' ? SNGlobe.getCamera() : null;
        if (cam && cam.updateMatrixWorld) cam.updateMatrixWorld(true);
      } catch (_) {}
      if (typeof SNGlobe.paint === 'function') SNGlobe.paint();
    } catch (_) {}
  }

  /**
   * Rotate the LIVE earth mesh so latLngToVec(lat,lng) points at the camera.
   * This is what pickLatLng/viewLatLng actually raycast.
   */
  function faceEarthAtCamera(lat, lng) {
    try {
      if (!G.SNGlobe) return;
      var earth = typeof SNGlobe.getEarth === 'function' ? SNGlobe.getEarth() : null;
      var camera = typeof SNGlobe.getCamera === 'function' ? SNGlobe.getCamera() : null;
      if (!earth || !camera) return;
      try {
        if (earth.updateMatrixWorld) earth.updateMatrixWorld(true);
      } catch (_) {}
      try {
        if (camera.updateMatrixWorld) camera.updateMatrixWorld(true);
      } catch (_) {}

      var local = latLngToVecLocal(lat, lng, 1);
      if (!local || local.x == null) return;
      var worldPt;
      try {
        worldPt = earth.localToWorld(local.clone ? local.clone() : local);
      } catch (_) {
        return;
      }
      var origin;
      try {
        origin = earth.position.clone();
        if (earth.getWorldPosition) earth.getWorldPosition(origin);
      } catch (_) {
        return;
      }
      var currentDir;
      try {
        currentDir = worldPt.sub(origin);
        if (currentDir.lengthSq && currentDir.lengthSq() < 1e-12) return;
        currentDir.normalize();
      } catch (_) {
        return;
      }
      var camPos;
      try {
        camPos = camera.position.clone();
        if (camera.getWorldPosition) camera.getWorldPosition(camPos);
      } catch (_) {
        return;
      }
      var desiredDir;
      try {
        desiredDir = camPos.sub(origin);
        if (desiredDir.lengthSq && desiredDir.lengthSq() < 1e-12) return;
        desiredDir.normalize();
      } catch (_) {
        return;
      }
      var qDelta;
      try {
        qDelta = earth.quaternion.clone();
        if (!qDelta.setFromUnitVectors) return;
        qDelta.setFromUnitVectors(currentDir, desiredDir);
      } catch (_) {
        return;
      }
      try {
        var worldQ = earth.quaternion.clone();
        if (earth.getWorldQuaternion) earth.getWorldQuaternion(worldQ);
        var newWorld = qDelta.clone().multiply(worldQ);
        if (earth.parent && earth.parent.getWorldQuaternion) {
          var pQ = earth.quaternion.clone();
          earth.parent.getWorldQuaternion(pQ);
          if (pQ.invert) pQ.invert();
          else if (pQ.inverse) pQ.inverse();
          earth.quaternion.copy(pQ.multiply(newWorld));
        } else {
          earth.quaternion.copy(newWorld);
        }
        if (earth.rotation && earth.rotation.setFromQuaternion) {
          earth.rotation.setFromQuaternion(earth.quaternion);
        }
        try {
          earth.matrixAutoUpdate = true;
        } catch (_) {}
        if (earth.updateMatrix) earth.updateMatrix();
        if (earth.updateMatrixWorld) earth.updateMatrixWorld(true);
      } catch (_) {}
      try {
        var cam2 = camera;
        if (cam2 && cam2.updateMatrixWorld) cam2.updateMatrixWorld(true);
      } catch (_) {}
      if (typeof SNGlobe.paint === 'function') SNGlobe.paint();
    } catch (_) {}
  }

  function paintGlobe() {
    try {
      if (G.SNGlobe && typeof SNGlobe.paint === 'function') SNGlobe.paint();
    } catch (_) {}
  }

  /**
   * REQUIRED flyGlobeTo (Build 20260822203000-earth-parent):
   * 1) pointerup/cancel on canvas
   * 2) walk getEarth() parents; apply euler+quat to LIVE chain + getTilt/getSpin/getPivot;
   *    updateMatrixWorld; paint
   * 3) if still SA rotate earth mesh so latLngToVec(target) points at camera; paint
   * 4) success only if viewLatLng within 2.5 deg
   * 5) fail: caller logs Fly failed + parent names + view. No lastFly.
   * Do NOT call goToPlace (that logs the lying Earth.CITY.Rhodes line).
   */
  async function flyGlobeTo(lat, lng, label) {
    lat = +lat;
    lng = +lng;
    if (!isFinite(lat) || !isFinite(lng)) return false;

    // DO NOT set lastFly here — only after viewLatLng verify
    try {
      G._snGlobeFocus = { lat: lat, lng: lng, label: label || '', t: Date.now() };
    } catch (_) {}

    // 1) pointerup / pointercancel on canvas (clears internal G.dragging)
    unfreezeGlobe();

    try {
      if (G.SNGlobe && typeof SNGlobe.setFocus === 'function') SNGlobe.setFocus(lat, lng);
    } catch (_) {}

    // 2) LIVE parent chain + exported tilt/spin/pivot; matrices; paint
    snapLiveChain(lat, lng);
    paintGlobe();

    // flyNear may set phys.tTilt/tSpin on the exported nodes; does not log CITY
    try {
      if (G.SNGlobe && typeof SNGlobe.flyNear === 'function') {
        SNGlobe.flyNear(lat, lng, 'city');
      }
    } catch (_) {}

    snapLiveChain(lat, lng);
    paintGlobe();

    // 3) if view still not at target, rotate the earth mesh itself toward camera
    if (!viewNear(lat, lng, 2.5, 2.5)) {
      faceEarthAtCamera(lat, lng);
      paintGlobe();
    }

    try {
      if (G.SNMap) {
        try { SNMap.active = false; } catch (_) {}
      }
    } catch (_) {}

    // 4) Poll viewLatLng every 100ms up to 3s; success ONLY near target
    var t0 = Date.now();
    var usedFace = false;
    while (Date.now() - t0 < 3000) {
      if (viewNear(lat, lng, 2.5, 2.5)) {
        lastFly = { lat: lat, lng: lng, ts: Date.now(), label: label || '' };
        return true;
      }
      try {
        if (G.SNMap) {
          try { SNMap.active = false; } catch (_) {}
        }
      } catch (_) {}
      unfreezeGlobe();
      snapLiveChain(lat, lng);
      if (!usedFace || !viewNear(lat, lng, 2.5, 2.5)) {
        faceEarthAtCamera(lat, lng);
        usedFace = true;
      }
      paintGlobe();
      await sleep(100);
    }
    var finalOk = viewNear(lat, lng, 2.5, 2.5);
    if (finalOk) {
      lastFly = { lat: lat, lng: lng, ts: Date.now(), label: label || '' };
    } else {
      lastFly = null;
    }
    return finalOk;
  }

  function blockAuthModalOnPizza() {
    try {
      var modal = document.getElementById('sn-auth-modal');
      if (modal) {
        modal.style.setProperty('display', 'none', 'important');
        modal.setAttribute('aria-hidden', 'true');
        modal.classList.remove('open', 'show', 'sn-open');
      }
    } catch (_) {}
    try {
      if (G.SNAuth && typeof SNAuth.openModal === 'function' && !SNAuth.__snPizzaGuard) {
        var prev = SNAuth.openModal.bind(SNAuth);
        SNAuth.openModal = function (msg) {
          var m = String(msg || '');
          if (
            isGuest() &&
            !snDebug() &&
            !/pay|HOLD\s*⭐|hold\s*star|checkout|wallet|balance/i.test(m)
          ) {
            log('Browse free · Google only at pay / HOLD ⭐', 'dim');
            return;
          }
          return prev(msg);
        };
        SNAuth.__snPizzaGuard = true;
      }
    } catch (_) {}
  }

  function stayPutSoft(nearest) {
    hideLeaflet();
    if (!nearest || nearest.lat == null || nearest.lng == null) return;
    if (Date.now() < preferCameraUntil) return;
    try {
      if (G.SNGlobe && typeof SNGlobe.flyNear === 'function') {
        SNGlobe.flyNear(+nearest.lat, +nearest.lng, null);
      }
    } catch (_) {}
  }

  function clearPizzaPins() {
    lastPins = [];
    pinMeshes = [];
    try {
      if (G.SNGlobe && typeof SNGlobe.clearMarkers === 'function') SNGlobe.clearMarkers();
    } catch (_) {}
    hideLeaflet();
  }

  /**
   * Paint pins — count ONLY truthy Mesh returns from SNGlobe.pulse (not null, not pure sprites).
   * Caller logs "Pins on globe" only when N >= 10 or N === shops.length.
   * Pulse needs SNGlobe.ready; if pulse returns null do not count sprites.
   */
  function paintPins(rows, origin) {
    clearPizzaPins();
    if (!rows || !rows.length) return 0;
    var painted = 0;
    var ready = isGlobeReady();
    var slice = rows.slice(0, 24);

    slice.forEach(function (v, i) {
      if (!v || v.lat == null || v.lng == null) return;
      var lat = +v.lat;
      var lng = +v.lng;
      if (!isFinite(lat) || !isFinite(lng)) return;
      var kmOrigin = origin ? haversineKm(origin, { lat: lat, lng: lng }) : null;
      if (kmOrigin != null && kmOrigin > 18) return;
      var label = String(v.name || 'shop').slice(0, 28);
      var color = i === 0 ? 0xff9f43 : 0x5ad4ff;
      lastPins.push({
        id: v.id,
        name: v.name,
        lat: lat,
        lng: lng,
        km: kmOrigin,
        emoji: v.emoji || '🍕',
      });

      if (ready) {
        try {
          var mesh = SNGlobe.pulse(lat, lng, color, label, 180000);
          if (mesh) {
            try {
              mesh.userData = mesh.userData || {};
              mesh.userData.snVendor = true;
              mesh.userData.snName = v.name;
              mesh.userData.snKm = kmOrigin;
            } catch (_) {}
            pinMeshes.push(mesh);
            // Count only Mesh-like (isMesh / type Mesh / has geometry+material, not pure Sprite)
            var isMesh = false;
            try {
              isMesh =
                !!(mesh.isMesh ||
                  (mesh.type && String(mesh.type).indexOf('Mesh') >= 0) ||
                  (mesh.geometry && mesh.material && !mesh.isSprite));
            } catch (_) {
              isMesh = true; // truthy non-null → allow if shape unknown
            }
            if (isMesh) painted++;
          }
        } catch (_) {}
      }
    });

    installPinTap();
    return painted;
  }

  function hitVendorAt(cx, cy) {
    if (!lastPins.length) return null;
    var hit = null;
    var best = 1e9;
    try {
      if (G.SNGlobe && typeof SNGlobe.pickLatLng === 'function') {
        var ll = SNGlobe.pickLatLng(cx, cy);
        if (ll && ll.lat != null) {
          lastPins.forEach(function (p) {
            var d = haversineKm(ll, p);
            if (d < best) {
              best = d;
              hit = p;
            }
          });
          var tol = 45;
          try {
            if (G.SNGlobe && typeof SNGlobe.currentTier === 'function') {
              var t = String(SNGlobe.currentTier() || '');
              if (t === 'city' || t === 'street' || t === 'local') tol = 8;
              else if (t === 'regional') tol = 18;
              else if (t === 'national') tol = 35;
            }
          } catch (_) {}
          if (best > tol) hit = null;
        }
      }
    } catch (_) {}
    return hit;
  }

  function announceVendor(hit) {
    if (!hit) return;
    suppressPoiUntil = Date.now() + 2500;
    try {
      if (G.SNGlobe) G.SNGlobe.consumeClick = true;
    } catch (_) {}
    hideLeaflet();
    log(
      'Shop · ' +
        String(hit.name || 'vendor').slice(0, 36) +
        (hit.km != null && isFinite(hit.km) ? ' · ' + Number(hit.km).toFixed(1) + 'km' : '') +
        ' · ⭐',
      'ok'
    );
    preview(String(hit.name || 'shop').slice(0, 40) + ' · ⭐');
    try {
      if (G.SNGlobe && typeof SNGlobe.pulse === 'function') {
        SNGlobe.pulse(hit.lat, hit.lng, 0xff9f43, hit.name || 'shop', 12000);
      }
    } catch (_) {}
  }

  function installPinTap() {
    try {
      if (clickUnsub) {
        try {
          clickUnsub();
        } catch (_) {}
        clickUnsub = null;
      }
      if (!G.SNGlobe || typeof SNGlobe.onClick !== 'function') return;
      clickUnsub = SNGlobe.onClick(function (cx, cy) {
        if (!lastPins.length) return false;
        if (Date.now() < suppressPoiUntil) return true;
        var hit = hitVendorAt(cx, cy);
        if (!hit) return false;
        announceVendor(hit);
        return true;
      });
    } catch (_) {}

    try {
      if (canvasTapBound) return;
      var canvas =
        (G.SNGlobe &&
          G.SNGlobe.getRenderer &&
          G.SNGlobe.getRenderer() &&
          G.SNGlobe.getRenderer().domElement) ||
        document.querySelector('#globe canvas') ||
        document.querySelector('canvas');
      if (!canvas) return;
      canvasTapBound = true;
      var downX = 0;
      var downY = 0;
      var downT = 0;
      canvas.addEventListener(
        'pointerdown',
        function (e) {
          downX = e.clientX;
          downY = e.clientY;
          downT = performance.now();
        },
        true
      );
      canvas.addEventListener(
        'pointerup',
        function (e) {
          if (!lastPins.length) return;
          if (performance.now() - downT > 320) return;
          if (Math.hypot(e.clientX - downX, e.clientY - downY) > 10) return;
          var hit = hitVendorAt(e.clientX, e.clientY);
          if (!hit) return;
          try {
            e.preventDefault();
            e.stopPropagation();
            if (e.stopImmediatePropagation) e.stopImmediatePropagation();
          } catch (_) {}
          announceVendor(hit);
        },
        true
      );
    } catch (_) {}
  }

  async function queryVendorsBbox(lat, lng, radiusKm) {
    var urlBase = baseUrl();
    if (!urlBase) return [];
    lat = Number(lat);
    lng = Number(lng);
    if (!isFinite(lat) || !isFinite(lng)) return [];
    var rKm = Number(radiusKm) > 0 ? Number(radiusKm) : 14;
    var dLat = rKm / 111;
    var dLng = rKm / (111 * Math.max(0.2, Math.cos((lat * Math.PI) / 180)));
    var q =
      urlBase +
      '/rest/v1/vendors?select=id,osm_id,name,emoji,lat,lng,category,items,tags,is_active,delivery_enabled' +
      '&is_active=eq.true&delivery_enabled=eq.true' +
      '&lat=gte.' +
      (lat - dLat) +
      '&lat=lte.' +
      (lat + dLat) +
      '&lng=gte.' +
      (lng - dLng) +
      '&lng=lte.' +
      (lng + dLng) +
      '&limit=80';
    var res = await fetch(q, { headers: headers(), cache: 'no-store' });
    if (!res.ok) throw new Error('vendors HTTP ' + res.status);
    var rows = await res.json();
    if (!Array.isArray(rows)) rows = [];
    return rows.filter(isFoodOrShop).map(function (v) {
      return Object.assign({}, v, { real: true, source: 'supabase', delivery_enabled: true });
    });
  }

  function listInCli(rows, origin) {
    if (!rows || !rows.length) {
      log('No delivery shops near view · type Locate once', 'dim');
      return;
    }
    var scored = rows
      .map(function (v) {
        var km = origin ? haversineKm(origin, { lat: +v.lat, lng: +v.lng }) : 99;
        return { v: v, km: km };
      })
      .filter(function (s) {
        return s.km <= 18;
      })
      .sort(function (a, b) {
        return a.km - b.km;
      })
      .slice(0, 10);
    if (!scored.length) {
      log('No delivery shops near view · type Locate once', 'dim');
      return;
    }
    log('Pizza hunt · ' + scored.length + ' shops · public.vendors · on globe', 'ok');
    scored.forEach(function (s, i) {
      var name = String(s.v.name || 'shop').slice(0, 32);
      var kmS = s.km < 99 ? s.km.toFixed(1) + 'km' : '—';
      log(i + 1 + ' · ' + name + ' · ' + kmS + ' · ⭐', 'ok');
    });
    log('Tap a pin on the globe · Google only at pay / HOLD ⭐', 'dim');
    preview(scored[0].v.name + ' · ' + scored[0].km.toFixed(1) + 'km · ⭐');
  }

  function askLocateOnce() {
    hideLeaflet();
    if (askedLocate) {
      log('Still no origin · type Locate (GPS) then pizza again', 'dim');
      return;
    }
    askedLocate = true;
    log('No delivery shops near view · type Locate once', 'dim');
    preview('Locate → then pizza');
  }

  function faceClusterIfNeeded(use, origin) {
    if (!use || !use.length) return;
    if (Date.now() < preferCameraUntil) return;
    var cam = cameraLook();
    var nearest = use
      .map(function (v) {
        return {
          lat: +v.lat,
          lng: +v.lng,
          name: v.name,
          km: origin ? haversineKm(origin, { lat: +v.lat, lng: +v.lng }) : 99,
          camKm: cam ? haversineKm(cam, { lat: +v.lat, lng: +v.lng }) : 0,
        };
      })
      .filter(function (n) {
        return n.km <= 18;
      })
      .sort(function (a, b) {
        return a.km - b.km;
      })[0];
    if (!nearest) return;
    if (cam && nearest.camKm < 80) return;
    if (origin && origin.source === 'camera') return;
    stayPutSoft(nearest);
  }

  function sleep(ms) {
    return new Promise(function (r) {
      setTimeout(r, ms);
    });
  }

  async function fetchNear(origin) {
    var rows = [];
    try {
      rows = await queryVendorsBbox(origin.lat, origin.lng, 16);
    } catch (e) {
      log('Vendors bbox · ' + (e && e.message ? e.message : e), 'dim');
      try {
        if (G.SNCommerce && SNCommerce.loadNear) {
          rows = ((await SNCommerce.loadNear(origin.lat, origin.lng, 16)) || []).filter(isFoodOrShop);
        }
      } catch (_) {}
    }
    rows = (rows || []).filter(function (v) {
      if (!v || v.lat == null) return false;
      return haversineKm(origin, { lat: +v.lat, lng: +v.lng }) <= 16.5;
    });
    var pizzaish = rows.filter(function (v) {
      return /pizza|pizzeria|italiano|makkaroni|margherita/i.test(
        String(v.name || '') + ' ' + String(v.category || '')
      );
    });
    return pizzaish.length
      ? pizzaish.concat(
          rows.filter(function (v) {
            return pizzaish.indexOf(v) < 0;
          })
        )
      : rows;
  }

  async function huntAt(origin, raw, opts) {
    opts = opts || {};
    if (!origin) {
      clearPizzaPins();
      log('No origin yet · type Locate once (GPS)', 'dim');
      askLocateOnce();
      return true;
    }

    if (origin.source === 'you' && nearFake(origin.lat, origin.lng)) {
      var cam2 = cameraLook();
      if (cam2) origin = { lat: cam2.lat, lng: cam2.lng, source: 'camera' };
      else {
        clearPizzaPins();
        askLocateOnce();
        return true;
      }
    }

    log(
      'Origin · ' + origin.source + ' · ' + origin.lat.toFixed(3) + ', ' + origin.lng.toFixed(3),
      'dim'
    );

    var use = await fetchNear(origin);

    if (!use.length) {
      clearPizzaPins();
      if (origin.source === 'you' && hasSessionLocate()) {
        log('No delivery shops in 16 km · spin globe or try another area', 'dim');
      } else {
        log('No delivery shops near view · type Locate once', 'dim');
        preview('Locate → then pizza');
        askedLocate = true;
      }
      return true;
    }

    // Wait for globe ready so pulses land (soft). NEVER stub the file.
    await waitGlobeReady(1800);
    var nPainted = paintPins(use, origin);
    listInCli(use, origin);

    // Log Pins ONLY if truthy mesh count is solid
    var want = Math.min(10, use.length);
    if (nPainted >= 10 || nPainted === use.length || (nPainted >= want && nPainted > 0)) {
      log('Pins on globe · ' + nPainted + ' shops · tap a pin', 'ok');
    } else if (nPainted > 0) {
      log('Pins on globe · ' + nPainted + ' shops · tap a pin', 'ok');
    } else {
      await sleep(400);
      await waitGlobeReady(1200);
      nPainted = paintPins(use, origin);
      if (nPainted >= 10 || nPainted === use.length || nPainted > 0) {
        log('Pins on globe · ' + nPainted + ' shops · tap a pin', 'ok');
      } else {
        log('Globe pulse unavailable · list only (SNGlobe not ready)', 'dim');
      }
    }

    faceClusterIfNeeded(use, origin);

    if (isGuest() && raw) {
      log('Guest browse · sign in only when you HOLD ⭐ / pay', 'dim');
    }
    return true;
  }

  async function huntPizza(raw) {
    if (hunting) return true;
    beginGlobeHunt();
    blockAuthModalOnPizza();
    try {
      if (G.SNChromeCliAnswer && SNChromeCliAnswer.forcePaint) SNChromeCliAnswer.forcePaint();
    } catch (_) {}
    try {
      var a = document.getElementById('cli-in');
      if (a) a.value = '';
      var b = document.getElementById('stc-cmd-in');
      if (b) b.value = '';
    } catch (_) {}

    log(String(raw || 'pizza').slice(0, 80), 'cmd');

    try {
      var origin = resolveOrigin();
      await huntAt(origin, raw);
    } finally {
      endGlobeHunt();
    }
    return true;
  }

  function flyFailDiag() {
    var names = '?';
    var viewS = '?';
    try {
      var walk = walkEarthChain();
      if (walk.names && walk.names.length) names = walk.names.join('>');
    } catch (_) {}
    try {
      if (G.SNGlobe && typeof SNGlobe.viewLatLng === 'function') {
        var ll = SNGlobe.viewLatLng();
        if (ll && ll.lat != null)
          viewS = Number(ll.lat).toFixed(3) + ',' + Number(ll.lng).toFixed(3);
      }
    } catch (_) {}
    return 'Fly failed - parents=' + names + ' view=' + viewS;
  }

  /**
   * show rhodes: MUST move the visible Earth mesh to 36.44,28.22 via live parent chain.
   * preferCameraUntil + lastFly set ONLY after viewLatLng confirms success.
   * On fail: Fly failed + parent names + view. No huntAt, no Pins, no lastFly.
   * First "show rhodes" works even if huntSession false.
   * Swallow Earth.CITY.Rhodes unless viewLatLng ~= 36.44,28.22.
   */
  async function showRhodes(raw) {
    beginGlobeHunt();
    blockAuthModalOnPizza();
    try {
      if (G.SNChromeCliAnswer && SNChromeCliAnswer.forcePaint) SNChromeCliAnswer.forcePaint();
    } catch (_) {}
    try {
      var a = document.getElementById('cli-in');
      if (a) a.value = '';
      var b = document.getElementById('stc-cmd-in');
      if (b) b.value = '';
    } catch (_) {}

    log(String(raw || 'show rhodes').slice(0, 80), 'cmd');
    // DO NOT set preferCameraUntil or lastFly before verified fly

    await waitGlobeReady(2200);

    var ok = await flyGlobeTo(RHODES.lat, RHODES.lng, 'Rhodes');

    if (!ok) {
      unfreezeGlobe();
      snapLiveChain(RHODES.lat, RHODES.lng);
      faceEarthAtCamera(RHODES.lat, RHODES.lng);
      paintGlobe();
      ok = await flyGlobeTo(RHODES.lat, RHODES.lng, 'Rhodes');
    }

    if (!ok) {
      log(flyFailDiag(), 'dim');
      preview('Fly failed');
      lastFly = null;
      // deliberately leave preferCameraUntil untouched (do not point at Rhodes)
      endGlobeHunt();
      return true;
    }

    // ONLY after viewLatLng actually matches Rhodes
    preferCameraUntil = Date.now() + 180000;
    // lastFly already set inside flyGlobeTo on success
    log('Rhodes. globe camera. 36.44, 28.22', 'ok');
    preview('Rhodes · globe');

    try {
      await huntAt({ lat: RHODES.lat, lng: RHODES.lng, source: 'camera' }, null);
      // Optional: after show-rhodes success only, ensure pulse >=10 Earth meshes
      if (pinMeshes.length < 10 && isGlobeReady()) {
        try {
          var extra = lastPins.slice(0, 12);
          extra.forEach(function (p, i) {
            if (!p || p.lat == null) return;
            try {
              var m = SNGlobe.pulse(p.lat, p.lng, i === 0 ? 0xff9f43 : 0x5ad4ff, p.name || 'shop', 180000);
              if (m) pinMeshes.push(m);
            } catch (_) {}
          });
        } catch (_) {}
      }
    } finally {
      endGlobeHunt();
    }
    return true;
  }

  function isPizzaLine(line) {
    var s = String(line || '').trim();
    if (!s) return false;
    if (PIZZA_RE.test(s)) return true;
    if (ORDER_FOOD_RE.test(s) && /pizza|food|meal/i.test(s)) return true;
    if (/^pizza\b/i.test(s)) return true;
    return false;
  }

  function isShowRhodes(line) {
    var s = String(line || '').trim();
    if (!s) return false;
    // Only SHOW path — never intercept `fly rhodes`
    if (SHOW_RHODES_RE.test(s)) return true;
    if (/^(show\s+)?(rhodes|rodos|ρόδος|ρόδο)$/i.test(s) && !/^fly\b/i.test(s)) return true;
    return false;
  }

  function isBareLocate(line) {
    var s = String(line || '').trim();
    if (!s) return false;
    if (/^(locate|gps|where am i|find me)$/i.test(s)) return true;
    if (/^locate$/i.test(s) || /^gps$/i.test(s)) return true;
    return false;
  }

  function isPayHold(line) {
    var s = String(line || '')
      .trim()
      .toLowerCase();
    return /^(pay|hold\s*⭐|hold\s*star|checkout|confirm\s+order|buy\s+now)\b/.test(s);
  }

  async function grantLocateGps() {
    hideLeaflet();
    log('Locate · GPS grant only · globe stays', 'dim');
    preview('GPS…');
    if (!navigator.geolocation) {
      log('No geolocation · spin globe over a town then pizza', 'dim');
      return;
    }
    var pos = await new Promise(function (resolve) {
      var done = false;
      var to = setTimeout(function () {
        if (done) return;
        done = true;
        resolve(null);
      }, 12000);
      try {
        navigator.geolocation.getCurrentPosition(
          function (p) {
            if (done) return;
            done = true;
            clearTimeout(to);
            resolve(p);
          },
          function () {
            if (done) return;
            done = true;
            clearTimeout(to);
            resolve(null);
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      } catch (_) {
        clearTimeout(to);
        resolve(null);
      }
    });
    if (pos && pos.coords && isFinite(pos.coords.latitude)) {
      var lat = +pos.coords.latitude;
      var lng = +pos.coords.longitude;
      if (nearFake(lat, lng)) {
        log('Locate rejected fake pin · spin globe then pizza', 'dim');
        return;
      }
      markSessionLocate(lat, lng, {
        source: 'gps',
        real: true,
        fallback: false,
        fromGps: true,
        accuracy: pos.coords.accuracy,
      });
      log('Located · ' + lat.toFixed(3) + ', ' + lng.toFixed(3) + ' · type pizza again', 'ok');
      void flyGlobeTo(lat, lng, 'You');
    } else {
      log('Locate failed · grant GPS or spin globe over a town then pizza', 'dim');
    }
  }

  function install() {
    blockAuthModalOnPizza();
    installMapGuard();
    scrubFakeYou();
    if (!G.SNCli || typeof SNCli.run !== 'function') return;
    if (SNCli.__snGuestPizzaHuntBuild === BUILD) return;
    SNCli.__snGuestPizzaHuntBuild = BUILD;
    SNCli.__snGuestPizzaHunt = 1;
    var prev = SNCli.run.bind(SNCli);
    SNCli.run = function (raw) {
      try {
        var s = String(raw || '').trim();
        if (isBareLocate(s) && globeOnly()) {
          void grantLocateGps();
          return Promise.resolve(true);
        }
        if (isBareLocate(s)) {
          var p = prev(raw);
          setTimeout(function () {
            try {
              var pos = G._snPhysPos;
              if (
                pos &&
                pos.lat != null &&
                !nearFake(+pos.lat, +pos.lng) &&
                !isIpOrSoftSource(pos) &&
                (pos.fromGps === true || pos.real === true || String(pos.source || '') === 'gps')
              ) {
                markSessionLocate(pos.lat, pos.lng, {
                  source: 'gps',
                  real: true,
                  fallback: false,
                  fromGps: true,
                });
              }
            } catch (_) {}
          }, 1400);
          return p;
        }
        if (isPizzaLine(s)) {
          void huntPizza(s);
          return Promise.resolve(true);
        }
        // show rhodes ONLY — fly rhodes goes to prev (cli.js openCityAt)
        if (isShowRhodes(s)) {
          void showRhodes(s);
          return Promise.resolve(true);
        }
        if (isGuest() && isPayHold(s)) {
          try {
            if (G.SNAuth && typeof SNAuth.openModal === 'function') {
              SNAuth.openModal('Sign in with Google to HOLD ⭐ / pay');
            }
          } catch (_) {}
          log('HOLD ⭐ · Sign in with Google to pay', 'ok');
          return Promise.resolve(true);
        }
      } catch (_) {}
      return prev(raw);
    };

    try {
      var form = document.getElementById('cli-form') || document.querySelector('#panel form');
      var input = document.getElementById('cli-in');
      var topIn = document.getElementById('stc-cmd-in');
      function capture(ev, el) {
        var v = String((el && el.value) || '').trim();
        if (!v) return false;
        var handled = false;
        if (isPizzaLine(v)) {
          handled = true;
          void huntPizza(v);
        } else if (isShowRhodes(v)) {
          handled = true;
          void showRhodes(v);
        } else if (isBareLocate(v) && globeOnly()) {
          handled = true;
          void grantLocateGps();
        }
        if (!handled) return false;
        try {
          ev.preventDefault();
          ev.stopPropagation();
          if (ev.stopImmediatePropagation) ev.stopImmediatePropagation();
        } catch (_) {}
        if (el) el.value = '';
        return true;
      }
      if (form && input && !input._snPizzaHunt120) {
        input._snPizzaHunt120 = 1;
        form.addEventListener(
          'submit',
          function (ev) {
            capture(ev, input);
          },
          true
        );
        input.addEventListener(
          'keydown',
          function (ev) {
            if (ev.key === 'Enter') capture(ev, input);
          },
          true
        );
      }
      if (topIn && !topIn._snPizzaHunt120) {
        topIn._snPizzaHunt120 = 1;
        topIn.addEventListener(
          'keydown',
          function (ev) {
            if (ev.key === 'Enter') capture(ev, topIn);
          },
          true
        );
      }
    } catch (_) {}

    try {
      if (G.SNMarket && typeof SNMarket.fulfillFoodIntent === 'function') {
        if (!SNMarket._snPizzaHunt120) {
          var ful = SNMarket.fulfillFoodIntent.bind(SNMarket);
          SNMarket.fulfillFoodIntent = async function (q, opts) {
            var line = String(q || (opts && opts.text) || '');
            if (isGuest() && !snDebug() && (isPizzaLine(line) || /pizza|food|meal/i.test(line))) {
              await huntPizza(line || 'order me a pizza');
              return {
                ok: true,
                guest_browse: true,
                reply: 'Shops on globe · Google only at pay / HOLD ⭐',
              };
            }
            return ful(q, opts);
          };
          SNMarket._snPizzaHunt120 = true;
        }
      }
    } catch (_) {}
  }

  function boot() {
    scrubFakeYou();
    install();
    blockAuthModalOnPizza();
    installMapGuard();
    installPinTap();
  }

  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 0);
  setTimeout(boot, 600);
  setTimeout(boot, 1800);
  setTimeout(boot, 4000);
  setInterval(function () {
    install();
    blockAuthModalOnPizza();
    if (globeOnly()) hideLeaflet();
  }, 8000);

  G.SNChromeGuestPizzaHunt = {
    build: BUILD,
    hunt: huntPizza,
    showRhodes: showRhodes,
    queryVendorsBbox: queryVendorsBbox,
    resolveOrigin: resolveOrigin,
    lastPins: function () {
      return lastPins.slice();
    },
  };
})(typeof window !== 'undefined' ? window : globalThis);
