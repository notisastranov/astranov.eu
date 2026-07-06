// === CITY MAP — satellite + streets when zoomed to city level ===
const CityMap = {
  ENTER_Z: 1.42,
  EXIT_Z: 1.52,
  active: false,
  map: null,
  _ready: false,
  _center: { lat: 36.44, lng: 28.22 },
  _layers: {},
  _onMap: new Set(),
  _markers: {},
  _route: null,
  _driverTimer: null,
  _syncTimer: null,
  _demoDrivers: [],
  _demoPhase: 0,
  _forceOpen: false,
  _initAttempts: 0,

  async _loadLeaflet() {
    if (window.L) return true;
    const sources = [
      { css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' },
      { css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js' },
    ];
    for (const src of sources) {
      const ok = await this._injectLeaflet(src.css, src.js);
      if (ok) return true;
    }
    return false;
  },

  _injectLeaflet(cssUrl, jsUrl) {
    return new Promise(resolve => {
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        link.crossOrigin = '';
        document.head.appendChild(link);
      }
      const script = document.createElement('script');
      script.src = jsUrl;
      script.crossOrigin = '';
      script.onload = () => resolve(!!window.L);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  },

  async ensureReady() {
    if (this._ready && this.map) return true;
    if (!window.L) await this._loadLeaflet();
    if (!this._ready && this._initAttempts < 4) {
      this._initAttempts++;
      this.init();
    }
    return !!(this._ready && this.map);
  },

  init() {
    if (!window.L) {
      console.warn('[CityMap] Leaflet not loaded');
      return;
    }
    if (this._ready && this.map) return;
    let el = document.getElementById('city-map');
    if (!el) {
      el = document.createElement('div');
      el.id = 'city-map';
      document.body.appendChild(el);
    }
    this.map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
    });
    this._buildLayers();
    AstranovTheme?.registerMap?.(this);
    this.map.setView([this._center.lat, this._center.lng], 14);
    this.map.on('zoomend moveend', () => {
      if (!this.active) return;
      const c = this.map.getCenter();
      this._center = { lat: c.lat, lng: c.lng };
    });
    window.addEventListener('resize', () => {
      if (this.active) this._invalidate();
    });
    this._bindZoomBridge(el);
    this._ready = true;
    const driverMs = SlumberManager?.tickMs?.('cityDriver') || 4500;
    this._driverTimer = setInterval(() => this._tickDrivers(), driverMs);
    this._syncTimer = setInterval(() => { if (this.active) this._syncMarkers(); }, 2000);
  },

  _invalidate() {
    if (!this.map) return;
    try {
      this.map.invalidateSize({ animate: false });
    } catch (_) {}
  },

  _tileLayer(url, opts) {
    const layer = L.tileLayer(url, opts);
    layer.on('tileerror', () => {
      if (layer._fallbackApplied) return;
      layer._fallbackApplied = true;
      const fb = this._layers?.satFallback;
      if (fb && this.map && this.active) {
        try {
          this.map.removeLayer(layer);
          this._onMap.delete(layer);
          fb.addTo(this.map);
          this._onMap.add(fb);
          this._invalidate();
        } catch (_) {}
      }
    });
    return layer;
  },

  _buildLayers() {
    const maxZ = SlumberManager?.quality?.cityMaxZoom || 20;
    const sat = this._tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: maxZ, attribution: 'Esri' }
    );
    const satFallback = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OSM fallback' }
    );
    const streets = L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, opacity: 0.42, attribution: '© OSM' }
    );
    const darkStreets = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, attribution: '© CARTO © OSM' }
    );
    const brightStreets = L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, attribution: '© CARTO © OSM' }
    );
    this._layers = { sat, satFallback, streets, darkStreets, brightStreets };
    this._applyBaseLayers();
  },

  _mapTheme() {
    return AstranovTheme?.effectiveMode?.() || AstranovTheme?.systemMode?.() || AstranovTheme?.mode || 'dark';
  },

  _applyBaseLayers() {
    if (!this.map) return;
    this._onMap.forEach(l => { try { this.map.removeLayer(l); } catch (_) {} });
    this._onMap.clear();
    const mode = this._mapTheme();
    const el = document.getElementById('city-map');
    if (el) el.dataset.theme = mode;
    const add = l => { l.addTo(this.map); this._onMap.add(l); };
    if (mode === 'bright') {
      add(this._layers.sat);
      this._layers.brightStreets.setOpacity(0.58);
      add(this._layers.brightStreets);
    } else {
      add(this._layers.sat);
      this._layers.darkStreets.setOpacity(0.72);
      add(this._layers.darkStreets);
    }
    if (this.active) this._invalidate();
  },

  onThemeChange() {
    this._applyBaseLayers();
  },

  camZToZoom(camZ) {
    if (camZ <= 1.12) return 17;
    if (camZ <= 1.32) return 15;
    const z = Math.max(1.02, Math.min(1.48, camZ));
    const t = (1.48 - z) / (1.48 - 1.02);
    return Math.round(11 + t * 4);
  },

  _bindZoomBridge(el) {
    if (!el || el._cityZoomBridge) return;
    el._cityZoomBridge = true;
    let pinchDist = 0;

    el.addEventListener('wheel', e => {
      if (!this.active) return;
      e.preventDefault();
      e.stopPropagation();
      const dy = e.deltaMode === 1 ? e.deltaY * 1.2 : e.deltaY;
      if (ZoomTiers) ZoomTiers.onWheel(dy);
      else if (typeof zoomBy === 'function') zoomBy(e.deltaY * (e.deltaMode === 1 ? 0.035 : 0.00022));
    }, { passive: false });

    el.addEventListener('touchstart', e => {
      if (!this.active || e.touches.length !== 2) return;
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      if (!this.active || e.touches.length !== 2 || !pinchDist) return;
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = (pinchDist - d) * 0.35;
      pinchDist = d;
      if (ZoomTiers) ZoomTiers.onPinch(delta);
      else if (typeof zoomBy === 'function') zoomBy(delta * 0.004);
    }, { passive: false });

    el.addEventListener('touchend', () => { pinchDist = 0; });
  },

  globeCenterLatLng() {
    globePivot.updateMatrixWorld(true);
    const v = new THREE.Vector3(0, 0, 1);
    const inv = new THREE.Matrix4().copy(globePivot.matrixWorld).invert();
    v.applyMatrix4(inv);
    const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v.y / r))) * 180 / Math.PI;
    let lng = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180;
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    return { lat, lng };
  },

  flyTo(lat, lng, zoom) {
    this._center = { lat, lng };
    if (this.map) this.map.setView([lat, lng], zoom || 15, { animate: true });
  },

  /** Force-open city map at coordinates — bypasses camera threshold race conditions */
  async openAt(lat, lng, opts) {
    opts = opts || {};
    const ready = await this.ensureReady();
    if (!ready || !this.map) {
      GlobeDeck?.setMapStatus('City map failed to load — tap ASTRANOV to reset');
      AciCli?.print('city map init failed — reload or hard-reset (tap logo)', 'err');
      return false;
    }
    const c = lat != null && lng != null
      ? { lat, lng }
      : (window._lastPos || this._center);
    if (!c?.lat) return false;

    this._center = c;
    window._lastPos = { lat: c.lat, lng: c.lng };
    userLocated = true;

    const camZ = opts.camZ ?? CityLife?.CITY_ZOOM ?? GlobeControl?.cityEntryZ?.() ?? 1.34;
    if (typeof camera !== 'undefined' && camera) {
      camera.position.z = camZ;
      camera.lookAt(0, 0, 0);
    }
    CosmicZoom?.update?.(camZ, { tier: 'city', label: 'CITY', cosmic: 'earth' });
    ZoomTiers?.goTo?.('city', false);
    cityLevel = true;

    this._forceOpen = true;
    const lz = opts.zoom ?? this.camZToZoom(camZ);
    if (!this.active) this._enter(camZ);
    else {
      this.map.setView([c.lat, c.lng], lz, { animate: false });
      this._invalidate();
      this._syncMarkers();
      this._syncRoute();
    }
    if (this.map.getZoom() !== lz) this.map.setZoom(lz, { animate: false });
    this.map.panTo([c.lat, c.lng], { animate: false });
    setTimeout(() => { this._forceOpen = false; }, 4000);
    setTimeout(() => this._invalidate(), 80);
    setTimeout(() => this._invalidate(), 400);
    return true;
  },

  async enter(lat, lng, opts) {
    if (CityLife?.dropIn) return CityLife.dropIn(lat, lng, opts || {});
    const c = lat != null && lng != null ? { lat, lng } : (window._lastPos || this.globeCenterLatLng());
    if (!c?.lat) return { error: 'no location' };
    const z = GlobeControl?.cityEntryZ?.() ?? this.ENTER_Z - 0.06;
    const p = latLngToPos(c.lat, c.lng, 1.04);
    if (typeof flyToPoint === 'function') {
      flyToPoint(new THREE.Vector3(p.x, p.y, p.z), z);
      if (typeof waitForGlobeFly === 'function') await waitForGlobeFly();
    }
    this.onCamera(z, 'earth');
    return { lat: c.lat, lng: c.lng };
  },

  onCamera(camZ, level) {
    if (!this._ready) return;
    const earth = window._cityDropLock || this._forceOpen
      || (level || CosmicZoom?.level || 'earth') === 'earth';
    const driving = !!DrivingView?.active;
    const shouldEnter = earth && (camZ <= this.ENTER_Z || driving || this._forceOpen || window._cityDropLock);
    const shouldExit = !this._forceOpen && !window._cityDropLock
      && (!earth || (camZ > this.EXIT_Z && !driving));

    if (shouldEnter && !this.active) this._enter(camZ);
    else if (shouldExit && this.active) this._exit();
    else if (this.active) this._syncView(camZ);
  },

  _enter(camZ) {
    if (!this.map) return;
    SlumberManager?.wake?.('city_hd', 'city map');
    this.active = true;
    cityLevel = true;
    this._applyBaseLayers();
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.add('active');
    if (globe) globe.classList.add('city-map-active');
    document.body.classList.add('city-map-active');
    const c = window._lastPos || this.globeCenterLatLng();
    this._center = c;
    this.map.setView([c.lat, c.lng], this.camZToZoom(camZ), { animate: false });
    this._invalidate();
    setTimeout(() => this._invalidate(), 120);
    setTimeout(() => this._invalidate(), 500);
    this._syncMarkers();
    this._syncRoute();
    this._seedDemoDrivers(c);
    CityLife?._updateChip?.(
      (CityLife?.nearbyVendors?.(c.lat, c.lng) || []).length,
      Object.keys(this._markers).filter(k => k.startsWith('drv_')).length
    );
  },

  _exit() {
    this.active = false;
    cityLevel = false;
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.remove('active');
    if (globe) globe.classList.remove('city-map-active');
    document.body.classList.remove('city-map-active');
    EarthRealism?._hudTimer && (EarthRealism._hudTimer = 0);
    const chip = document.getElementById('city-life-chip');
    if (chip) chip.classList.remove('open');
    CliRibbon?.clearGlobeHint?.();
  },

  _syncView(camZ) {
    const c = DrivingView?.active && window._lastPos
      ? window._lastPos
      : (window._lastPos || this.globeCenterLatLng());
    this._center = c;
    const lz = this.camZToZoom(camZ);
    if (this.map.getZoom() !== lz) this.map.setZoom(lz, { animate: false });
    const cur = this.map.getCenter();
    if (Math.abs(cur.lat - c.lat) > 0.0004 || Math.abs(cur.lng - c.lng) > 0.0004) {
      this.map.panTo([c.lat, c.lng], { animate: false });
    }
  },

  _icon(emoji, color) {
    return L.divIcon({
      className: 'city-map-pin',
      html: '<span style="background:' + color + ';border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.45)">' + emoji + '</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  },

  _setMarker(id, lat, lng, opts) {
    opts = opts || {};
    if (lat == null || lng == null) return;
    const prev = this._markers[id];
    if (prev) {
      prev.setLatLng([lat, lng]);
      return prev;
    }
    const m = L.marker([lat, lng], {
      icon: this._icon(opts.emoji || '◎', opts.color || 'rgba(0,140,220,0.9)'),
      title: opts.title || id,
    });
    if (opts.onClick) m.on('click', opts.onClick);
    m.addTo(this.map);
    this._markers[id] = m;
    return m;
  },

  _syncMarkers() {
    if (!this.active || !this.map) return;
    const me = window._lastPos;
    if (me) {
      this._setMarker('me', me.lat, me.lng, {
        emoji: '📍', color: 'rgba(26,111,212,0.92)', title: me?.name || 'You',
        onClick: () => GlobeEntity?.entities?.get('me') && GlobeEntity.activate(GlobeEntity.entities.get('me')),
      });
    }
    (window.others || []).forEach((u, i) => {
      this._setMarker('friend_' + (u.id || i), u.lat, u.lng, {
        emoji: u.emoji || '👤', color: 'rgba(61,158,255,0.88)', title: u.name,
      });
    });
    (window.Commerce?.vendors || []).forEach((v, i) => {
      if (v.lat == null) return;
      this._setMarker('shop_' + (v.id || i), v.lat, v.lng, {
        emoji: '🏪', color: 'rgba(26,111,212,0.88)', title: v.name || 'Shop',
        onClick: () => window.Commerce?.openVendor?.(v),
      });
    });
  },

  _driverLatLng(d, u, i) {
    const lat = d.field_lat ?? d.lat ?? d.latitude;
    const lng = d.field_lng ?? d.lng ?? d.longitude;
    if (lat != null && lng != null) return { lat: +lat, lng: +lng };
    return { lat: u.lat + (Math.sin(i * 1.7) * 0.006), lng: u.lng + (Math.cos(i * 1.3) * 0.006) };
  },

  _seedDemoDrivers(u) {
    if (this._demoDrivers.length) return;
    this._demoDrivers = [
      { id: 'demo1', display_name: 'Nikos · delivery', field_lat: u.lat + 0.004, field_lng: u.lng - 0.003 },
      { id: 'demo2', display_name: 'Elena · courier', field_lat: u.lat - 0.003, field_lng: u.lng + 0.005 },
      { id: 'demo3', display_name: 'Alex · ride', field_lat: u.lat + 0.002, field_lng: u.lng + 0.004 },
    ];
  },

  _animateDemoDrivers() {
    this._demoPhase += 0.0012;
    const u = window._lastPos || this._center;
    this._demoDrivers.forEach((d, i) => {
      d.field_lat = u.lat + Math.sin(this._demoPhase + i * 2.1) * 0.008;
      d.field_lng = u.lng + Math.cos(this._demoPhase + i * 1.6) * 0.008;
    });
  },

  async _tickDrivers() {
    if (!this.active) return;
    const u = window._lastPos || this._center;
    let drivers = window.Commerce?.fetchNearbyDrivers
      ? await window.Commerce.fetchNearbyDrivers(u.lat, u.lng)
      : [];
    if (!drivers.length) {
      this._seedDemoDrivers(u);
      this._animateDemoDrivers();
      drivers = this._demoDrivers;
    }
    window.Commerce?.showDriversOnGlobe?.(drivers);
    const seen = new Set();
    drivers.forEach((d, i) => {
      const p = this._driverLatLng(d, u, i);
      const id = 'drv_' + (d.id || i);
      seen.add(id);
      this._setMarker(id, p.lat, p.lng, {
        emoji: '🚗', color: 'rgba(80,180,255,0.92)', title: d.display_name || 'Driver',
      });
    });
    Object.keys(this._markers).forEach(k => {
      if (k.startsWith('drv_') && !seen.has(k)) {
        this.map.removeLayer(this._markers[k]);
        delete this._markers[k];
      }
    });
  },

  setRoute(coords) {
    this._routeCoords = coords || [];
    this._syncRoute();
  },

  _syncRoute() {
    if (!this.map) return;
    if (this._route) {
      this.map.removeLayer(this._route);
      this._route = null;
    }
    const coords = this._routeCoords || DrivingView?.routeCoords || [];
    if (!coords.length || !this.active) return;
    const latlngs = coords.map(c => [c.lat, c.lng]);
    this._route = L.polyline(latlngs, {
      color: (AstranovTheme?.effectiveMode?.() || AstranovTheme?.mode) === 'bright' ? '#0066cc' : '#44ccff',
      weight: 5,
      opacity: 0.88,
    }).addTo(this.map);
  },
};
window.CityMap = CityMap;