// === CITY LIFE — locate → fly → city satellite map · shops · drivers ===
const CityLife = {
  get CITY_ZOOM() {
    return GlobeControl?.cityEntryZ?.() ?? 1.34;
  },
  NEARBY_KM: 12,
  _friendTimer: null,
  _lastDrop: null,

  init() {
    this._startFriendMotion();
    const locateBtn = document.getElementById('aci-locate');
    if (locateBtn && !locateBtn._cityLifeBound) {
      locateBtn._cityLifeBound = true;
      locateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        locateMe?.();
      }, { capture: true });
    }
  },

  userPos() {
    // Real position only — callers that need a map must locate first (no silent Rhodes)
    if (window._lastPos?.lat != null && window._lastPos?.lng != null) return window._lastPos;
    return null;
  },

  ensureEarthView() {
    if (CosmicZoom) CosmicZoom.level = 'earth';
    ZoomTiers?.goTo?.('national', false);
    CosmicZoom?.update?.(GlobeControl?.Z?.national || 1.82, { tier: 'national', label: 'NATIONAL', cosmic: 'earth' });
    cityLevel = false;
  },

  async flyToCity(lat, lng, label) {
    this.ensureEarthView();
    const z = this.CITY_ZOOM;
    const p = latLngToPos(lat, lng, 1.04);
    if (typeof flyToPoint === 'function') {
      flyToPoint(new THREE.Vector3(p.x, p.y, p.z), z, {
        dur: GlobeControl?.flyDuration?.(camera?.position?.z, z),
      });
      if (typeof waitForGlobeFly === 'function') await waitForGlobeFly();
    }
    GlobeControl?.engageFollow?.('locate');
    GlobeControl?.noteAutoFly?.();
    MapDepict?.pulse?.(lat, lng, 0x3d9eff, label || 'Your city', 14000);
  },

  nearbyVendors(lat, lng) {
    const list = window.Commerce?.vendors || [];
    if (!list.length || !window.Commerce?.haversineKm) return list;
    return list.filter(v => v.lat != null && window.Commerce.haversineKm(lat, lng, v.lat, v.lng) <= this.NEARBY_KM);
  },

  async dropIn(lat, lng, opts) {
    opts = opts || {};
    const pos = lat != null && lng != null ? { lat, lng } : this.userPos();
    if (!pos?.lat || pos.lng == null) {
      return { error: 'no_location', message: 'no location — allow GPS or tap 🎯 Locate' };
    }

    window._cityDropLock = true;
    window._lastPos = { lat: pos.lat, lng: pos.lng };
    userLocated = true;
    this._lastDrop = { lat: pos.lat, lng: pos.lng, t: Date.now() };

    try {
      const nationalZ = GlobeControl?.Z?.national || 1.82;
      GlobeDeck?.setMapStatus('National view…');
      ZoomTiers?.goTo?.('national', true);
      CosmicZoom?.update?.(nationalZ, { tier: 'national', label: 'NATIONAL', cosmic: 'earth' });
      const gp = latLngToPos(pos.lat, pos.lng, 1.04);
      if (typeof flyToPoint === 'function') {
        flyToPoint(new THREE.Vector3(gp.x, gp.y, gp.z), nationalZ, { dur: 1500 });
        if (typeof waitForGlobeFly === 'function') await waitForGlobeFly();
      } else if (typeof camera !== 'undefined' && camera) {
        camera.position.z = nationalZ;
      }
      CityMap?.onCamera?.(nationalZ, 'earth');
      CliRibbon?.setNotice?.('National · your region', 'ready');
      if (!opts.immediate) {
        GlobeDeck?.setPreview?.('National view · opening your city…');
        await new Promise(r => setTimeout(r, 450));
      }
      ZoomTiers?.goTo?.('city', true);
      GlobeDeck?.setMapStatus('Opening city map…');
      const opened = await CityMap?.openAt?.(pos.lat, pos.lng, { camZ: this.CITY_ZOOM });
      if (!opened) {
        CityMap?.onCamera?.(this.CITY_ZOOM, 'earth');
        if (!CityMap?.active) CityMap?._enter?.(this.CITY_ZOOM);
      }
      GlobeDeck?.setMapStatus('City map open · syncing globe…');
      await this.flyToCity(pos.lat, pos.lng, opts.label || 'Your city');

      if (window.Commerce?.loadVendors) {
        await Promise.race([
          window.Commerce.loadVendors(),
          new Promise(resolve => setTimeout(() => resolve(null), 8000)),
        ]);
      }
    const nearby = this.nearbyVendors(pos.lat, pos.lng);
    if (nearby.length) {
      window.Commerce.vendors = nearby.concat((window.Commerce.vendors || []).filter(v => !nearby.includes(v))).slice(0, 40);
    }
    window.Commerce?.showOnGlobe?.();
    GlobeEntity?.syncVendors?.(window.Commerce.vendors);

    const drivers = window.Commerce?.fetchNearbyDrivers
      ? await Promise.race([
        window.Commerce.fetchNearbyDrivers(pos.lat, pos.lng),
        new Promise(resolve => setTimeout(() => resolve([]), 6000)),
      ])
      : [];
    window.Commerce?.showDriversOnGlobe?.(drivers);
    this._pulseFriends();
    this._showLocalNews(pos.lat, pos.lng);
    this._updateChip(nearby.length, drivers.length);

      CityMap?.onCamera?.(this.CITY_ZOOM, 'earth');
      const msg = nearby.length + ' shops · ' + drivers.length + ' drivers · ' + (window.others?.length || 0) + ' friends nearby';
      GlobeDeck?.setMapStatus('🏙 City map · ' + pos.lat.toFixed(2) + ', ' + pos.lng.toFixed(2));
      GlobeDeck?.setPreview('🏙 ' + msg);
      AciCli?.print('◎ City view · ' + msg, 'ok');
      ACIControl?.reply('City map open — ' + msg + ' · tap a shop or type: order pitogyra');
      FieldBrain?.pulse?.('city', msg, { role: 'client', props: { lat: pos.lat, lng: pos.lng, shops: nearby.length } });

      if (opts.openShops && nearby.length) {
        GlobeDeck?.expand?.(SuperCli?.title || 'Astranov Command Line');
        await window.Commerce?.showPicker?.();
      }
      return { vendors: nearby, drivers, lat: pos.lat, lng: pos.lng, mapActive: !!CityMap?.active };
    } catch (e) {
      AciCli?.print('city drop error: ' + (e.message || e), 'err');
      await CityMap?.openAt?.(pos.lat, pos.lng, { camZ: this.CITY_ZOOM });
      return { error: e.message || 'city drop failed', lat: pos.lat, lng: pos.lng, mapActive: !!CityMap?.active };
    } finally {
      window._cityDropLock = false;
    }
  },

  _pulseFriends() {
    (window.others || []).forEach(u => {
      MapDepict?.pulse?.(u.lat, u.lng, 0xffaa33, (u.emoji || '') + ' ' + u.name, 15000);
    });
  },

  _showLocalNews(lat, lng) {
    NewsFeed?.fetch?.();
    const item = (NewsFeed?.items || [])[0] || 'News near you';
    MapDepict?.action?.('news', { lat, lng, detail: item.slice(0, 55), worldLat: lat, worldLng: lng });
    if (!GlobeDeck?.thinking) GlobeDeck?.setPreview('📰 ' + item.slice(0, 72));
  },

  _updateChip(shops, drivers) {
    const el = document.getElementById('city-life-chip');
    if (!el) return;
    el.classList.add('open');
    el.innerHTML = '<b>City</b> · ' + shops + ' shops · ' + drivers + ' drivers · friends live';
  },

  _startFriendMotion() {
    if (this._friendTimer) return;
    this._friendTimer = setInterval(() => this._tickFriends(), 3500);
  },

  _tickFriends() {
    if (Auth?.user || AstranovPresence?.rtChannel) return;
    if (!(window.others || []).length) return;
    const friends = window.others || [];
    friends.forEach((u) => {
      u.lat += (Math.random() - 0.5) * 0.0012;
      u.lng += (Math.random() - 0.5) * 0.0012;
    });
    window.others = friends;
    GlobeEntity?.syncFriends?.(friends);
    if (CityMap?.active) CityMap._syncMarkers?.();
  },

  async locateAndDropIn() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) { reject(new Error('no geolocation')); return; }
      GlobeDeck?.setMapStatus('Locating…');
      navigator.geolocation.getCurrentPosition(
        async pos => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          placeMe(lat, lng, { quiet: true, markerOnly: true });
          resolve(await this.dropIn(lat, lng, { label: 'Your city' }));
        },
        err => reject(err),
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      );
    });
  },

  SCENARIOS: {
    wake: async () => {
      AciCli?.print('scenario · wake — news on globe', 'cmd');
      NewsFeed?.flash?.();
      const u = CityLife.userPos();
      if (!u) return locateMe?.();
      await CityLife.dropIn(u.lat, u.lng, { label: 'Morning' });
    },
    news: async () => {
      NewsFeed?.flash?.();
      const u = CityLife.userPos();
      if (!u) return AciCli?.print('locate first for local news', 'dim');
      CityLife._showLocalNews(u.lat, u.lng);
    },
    youtube: async (q) => {
      await GlobeVideo?.find?.(q || 'interesting places earth documentary');
    },
    locate: async () => {
      await CityLife.locateAndDropIn();
    },
    city: async () => {
      const u = CityLife.userPos();
      if (!u) return locateMe?.();
      await CityLife.dropIn(u.lat, u.lng, { openShops: true });
    },
    friends: async () => {
      CityLife._pulseFriends();
      AciCli?.print((window.others || []).map(u => u.name + ' · ' + u.lat.toFixed(3)).join(' · '), 'ok');
    },
    drivers: async () => {
      const u = CityLife.userPos();
      if (!u) return AciCli?.print('locate first to see drivers', 'dim');
      const d = await window.Commerce?.fetchNearbyDrivers?.(u.lat, u.lng);
      window.Commerce?.showDriversOnGlobe?.(d);
      AciCli?.print(d.length ? d.map(x => (x.display_name || 'Driver')).join(' · ') : 'no active drivers — order to summon', 'ok');
    },
    shops: async () => {
      const u = CityLife.userPos();
      if (!u) return locateMe?.();
      await CityLife.dropIn(u.lat, u.lng, { openShops: true });
    },
    groceries: async () => { await window.Commerce?.smartOrder?.('pitogyra mpironia tsigareta'); },
    order: async (rest) => { await window.Commerce?.smartOrder?.(rest || 'pitogyra beer'); },
    reviews: async (rest) => {
      const q = rest || 'best restaurant near me';
      AciCli?.print('brain · reviews · ' + q, 'dim');
      const r = await ACI?.think?.('Summarize Google-style reviews for: ' + q + '. Short bullet list, best pick.');
      ACIControl?.reply(r || 'No reviews');
    },
    task: async (rest) => {
      await AciCoders?.handleMessage?.(rest || 'find best grocery offer near me and assign driver');
    },
    assign: async (rest) => {
      if (rest) await FieldBrain?.claimDelivery?.(rest);
      else AciCli?.print('usage: scenario assign <order_id>', 'err');
    },
    explore: async () => {
      const u = CityLife.userPos();
      MapDepict?.action?.('explore', { lat: u.lat, lng: u.lng, detail: 'things to do' });
      ACIControl?.reply('Drag globe · tap shops · type order or youtube');
    },
    stars: async () => {
      ZoomTiers?.goTo?.('global', true);
      CelestialNav?.printReport?.();
    },
    nav: async () => {
      ZoomTiers?.goTo?.('global', true);
      CelestialNav?.printReport?.();
    },
    list: async () => {
      const names = Object.keys(CityLife.SCENARIOS).filter(k => k !== 'list').join(' · ');
      AciCli?.print('scenarios: ' + names, 'ok');
    },
  },

  async run(name, rest) {
    const key = (name || 'list').toLowerCase();
    const fn = this.SCENARIOS[key];
    if (!fn) {
      AciCli?.print('unknown scenario — try: scenario list', 'err');
      return { error: 'unknown' };
    }
    try {
      await fn(rest);
      return { ok: true, scenario: key };
    } catch (e) {
      AciCli?.print('scenario error: ' + (e.message || e), 'err');
      return { error: e.message };
    }
  },

  listScenarios() {
    return Object.keys(this.SCENARIOS).filter(k => k !== 'list');
  },
};
window.CityLife = CityLife;