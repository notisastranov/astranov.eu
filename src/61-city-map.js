// === CITY MAP (Leaflet national/city level) ===
const CityMap = {
  map: null,
  _ready: false,
  _markers: {},
  _center: null,
  _routeLine: null,
  active: false,
  ENTER_Z: 1.58,
  EXIT_Z: 1.72,

  init() {
    const el = document.getElementById('city-map');
    if (!el) return;
    // ensure dark bg to prevent white flash on enter
    el.style.background = 'var(--an-bg)';
    this.map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.42,
      attribution: '© OSM'
    }).addTo(this.map);
    this._ready = true;
    el.addEventListener('wheel', e => {
      if (!this.active) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const curZ = this.map.getZoom();
      this.map.setZoom(Math.max(3, Math.min(19, curZ + dir * 0.8)), { animate: true });
    }, { passive: false });
    this._bindMapGestures();
    this.map.on('moveend zoomend', () => {
      if (this.active) this._syncMarkers();
    });
  },

  _bindMapGestures() {
    const el = document.getElementById('city-map');
    if (!el || !this.map) return;
    let lastDist = 0;
    el.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!this.active || e.touches.length !== 2 || !lastDist) return;
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = d - lastDist;
      lastDist = d;
      const cur = this.map.getZoom();
      const nz = Math.max(3, Math.min(19, cur + (delta > 0 ? 0.03 : -0.03)));
      if (Math.abs(nz - cur) > 0.01) this.map.setZoom(nz, { animate: false });
      e.preventDefault();
    }, { passive: false });
  },

  camZToZoom(camZ) {
    if (camZ > 1.7) return 12;
    if (camZ > 1.4) return 14;
    if (camZ > 1.2) return 16;
    return 18;
  },

  globeCenterLatLng() {
    return window._lastPos || { lat: 36.22, lng: 28.12 };
  },

  flyTo(lat, lng, zoom) {
    this._center = { lat, lng };
    if (this.map) this.map.setView([lat, lng], zoom || 15, { animate: true });
  },

  onCamera(camZ, level) {
    if (!this._ready) return;
    if (window._globeFly) {
      // During fly, skip enter/exit to avoid mid-animation toggle causing white/blank/teleport/shake
      if (this.active) this._syncView(camZ); // still sync if somehow active, but usually not
      return;
    }
    const earth = (level || CosmicZoom?.level || 'earth') === 'earth';
    const driving = !!DrivingView?.active;
    const shouldEnter = earth && (camZ <= this.ENTER_Z || driving);
    const shouldExit = !earth || (camZ > this.EXIT_Z && !driving);

    if (shouldEnter && !this.active) this._enter(camZ);
    else if (shouldExit && this.active) this._exit();
    else if (this.active) this._syncView(camZ);
  },

  _enter(camZ) {
    this.active = true;
    cityLevel = true;
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.add('active');
    if (globe) globe.classList.add('city-map-active');
    // prevent white flash: force dark bg before map view
    if (el) el.style.background = 'var(--an-bg)';
    const mapContainer = this.map && this.map.getContainer ? this.map.getContainer() : null;
    if (mapContainer) mapContainer.style.background = 'var(--an-bg)';
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
    const chip = document.getElementById('city-life-chip');
    if (chip) {
      chip.classList.add('open');
      chip.innerHTML = '<b>City map</b> · scroll/pinch <b>out</b> for globe';
    }
    MapDepict?.setHud?.('City map', 'pinch/scroll out → globe');
    GlobeDeck?.setPreview?.('City map · scroll/pinch out to return to globe');
  },

  _exit() {
    this.active = false;
    cityLevel = false;
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.remove('active');
    if (globe) globe.classList.remove('city-map-active');
    EarthRealism?._hudTimer && (EarthRealism._hudTimer = 0);
  },

  _syncView(camZ) {
    if (window._globeFly) return; // no sync jitter/teleport during active fly
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
      this._setMarker('me', me.lat, me.lng, { emoji: '●', color: 'rgba(0,255,140,0.95)', title: 'You', onClick: () => GlobeEntity?.entities?.get('me') && GlobeEntity.activate(GlobeEntity.entities.get('me')) });
    }
  },

  _syncRoute() { /* ... */ },

  _seedDemoDrivers(c) { /* ... */ },

  _invalidate() {
    if (this.map) this.map.invalidateSize();
  }
};
window.CityMap = CityMap;