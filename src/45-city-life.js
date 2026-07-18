// === CITY LIFE — locate → fly → city satellite map · shops · drivers ===
// Must work in app phase WITHOUT deferred (placeMe/locateMe live in deferred).
var CityLife = {
  get CITY_ZOOM() {
    return GlobeControl?.cityEntryZ?.() ?? 1.34;
  },
  NEARBY_KM: 12,
  _friendTimer: null,
  _lastDrop: null,
  _locating: false,

  init() {
    this._startFriendMotion();
    const locateBtn = document.getElementById('aci-locate');
    if (locateBtn && !locateBtn._cityLifeBound) {
      locateBtn._cityLifeBound = true;
      locateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Never call bare locateMe — undeclared in app phase → ReferenceError (dead app)
        void CityLife.safeLocate();
      }, { capture: true });
    }
    // Expose early so features boot / ribbon can call without deferred
    if (typeof window.locateMe !== 'function') {
      window.locateMe = function locateMeEarly() { return CityLife.safeLocate(); };
    }
  },

  markLocated(lat, lng) {
    window._lastPos = { lat, lng };
    try { userLocated = true; } catch (_) {}
    window.userLocated = true;
  },

  /** Lightweight marker without deferred placeMe */
  markMeOnGlobe(lat, lng) {
    this.markLocated(lat, lng);
    try {
      if (typeof placeMe === 'function') {
        placeMe(lat, lng, { quiet: true, markerOnly: true });
        return;
      }
      if (typeof window.placeMe === 'function') {
        window.placeMe(lat, lng, { quiet: true, markerOnly: true });
        return;
      }
    } catch (_) { /* fall through */ }
    try {
      if (typeof latLngToPos !== 'function' || typeof THREE === 'undefined') return;
      if (window._meMarker && window._meMarker.parent) window._meMarker.parent.remove(window._meMarker);
      const pos = latLngToPos(lat, lng, 1.03);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x3d9eff })
      );
      m.position.set(pos.x, pos.y, pos.z);
      m.userData = { type: 'me', name: 'You' };
      if (typeof globePivot !== 'undefined' && globePivot) globePivot.add(m);
      window._meMarker = m;
      MapDepict?.pulse?.(lat, lng, 0x3d9eff, 'You', 6000);
      GlobeEntity?.syncMe?.(lat, lng, 'You');
    } catch (_) {}
  },

  async safeLocate() {
    if (this._locating) {
      CliRibbon?.setNotice?.('Already locating…', 'info');
      return { error: 'busy' };
    }
    this._locating = true;
    const overall = new Promise((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error('locate timeout'), { code: 3 })), 16000);
    });
    try {
      GlobeDeck?.expand?.(window.PublicCopy?.deckTitle?.() || 'Astranov');
      GlobeDeck?.setMapStatus?.('Locating your city…');
      CliRibbon?.setNotice?.('Locating…', 'thinking');
      ACIControl?.reply?.('Locating — need GPS for your city');
      const r = await Promise.race([this.locateAndDropIn(), overall]);
      if (r?.error) {
        const msg = r.message || r.error;
        CliRibbon?.setNotice?.(String(msg).slice(0, 100), 'err');
        ACIControl?.reply?.(msg);
        return r;
      }
      CliRibbon?.setNotice?.('Located · city map', 'ready');
      return r;
    } catch (err) {
      const denied = err?.code === 1 || /denied/i.test(String(err?.message || err));
      const timed = err?.code === 3 || /timeout/i.test(String(err?.message || err));
      const msg = denied
        ? 'Location denied — enable GPS for this site, then tap 🎯 again'
        : timed
          ? 'Location timed out — try again with GPS on'
          : 'Location failed — check GPS / permissions, then tap 🎯 again';
      GlobeDeck?.setMapStatus?.(msg);
      CliRibbon?.setNotice?.(msg.slice(0, 100), 'err');
      ACIControl?.reply?.(msg);
      return { error: msg };
    } finally {
      this._locating = false;
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
    try { this.ensureEarthView(); } catch (_) {}
    const z = this.CITY_ZOOM;
    try {
      if (typeof latLngToPos === 'function' && typeof flyToPoint === 'function' && typeof THREE !== 'undefined') {
        const p = latLngToPos(lat, lng, 1.04);
        flyToPoint(new THREE.Vector3(p.x, p.y, p.z), z, {
          dur: GlobeControl?.flyDuration?.(camera?.position?.z, z) || 1200,
        });
        if (typeof waitForGlobeFly === 'function') {
          await Promise.race([
            waitForGlobeFly(3000),
            new Promise((r) => setTimeout(r, 3200)),
          ]);
        }
      }
    } catch (_) {}
    try { GlobeControl?.engageFollow?.('locate'); } catch (_) {}
    try { GlobeControl?.noteAutoFly?.(); } catch (_) {}
    try { MapDepict?.pulse?.(lat, lng, 0x3d9eff, label || 'Your city', 14000); } catch (_) {}
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
    this.markLocated(pos.lat, pos.lng);
    this._lastDrop = { lat: pos.lat, lng: pos.lng, t: Date.now() };
    try { CityPick?.hide?.(); } catch (_) {}

    try {
      // 1) National space first (fast — capped wait)
      const nationalZ = GlobeControl?.Z?.national || 1.82;
      GlobeDeck?.setMapStatus?.('National view…');
      try { ZoomTiers?.goTo?.('national', true); } catch (_) {}
      try {
        CosmicZoom?.update?.(nationalZ, { tier: 'national', label: 'NATIONAL', cosmic: 'earth' });
      } catch (_) {}
      try {
        if (typeof latLngToPos === 'function' && typeof flyToPoint === 'function' && typeof THREE !== 'undefined') {
          const gp = latLngToPos(pos.lat, pos.lng, 1.04);
          flyToPoint(new THREE.Vector3(gp.x, gp.y, gp.z), nationalZ, { dur: 1100 });
          if (typeof waitForGlobeFly === 'function') {
            await Promise.race([
              waitForGlobeFly(3500),
              new Promise((r) => setTimeout(r, 3600)),
            ]);
          }
        } else if (typeof camera !== 'undefined' && camera) {
          camera.position.z = nationalZ;
        }
      } catch (_) {}
      try { CityMap?.onCamera?.(nationalZ, 'earth'); } catch (_) {}
      CliRibbon?.setNotice?.('National · your region', 'ready');

      // 2) City map immediately — never block on shops/news for UI
      try { ZoomTiers?.goTo?.('city', true); } catch (_) {}
      GlobeDeck?.setMapStatus?.('Opening city map…');
      let opened = false;
      try {
        opened = !!(await CityMap?.openAt?.(pos.lat, pos.lng, { camZ: this.CITY_ZOOM }));
      } catch (e) {
        console.warn('[CityLife] openAt', e);
      }
      if (!opened) {
        try {
          CityMap?.init?.();
          CityMap?.onCamera?.(this.CITY_ZOOM, 'earth');
          if (!CityMap?.active) CityMap?._enter?.(this.CITY_ZOOM);
        } catch (_) {}
      }

      // 3) Soft city fly (do not hang if fly stuck)
      try {
        await Promise.race([
          this.flyToCity(pos.lat, pos.lng, opts.label || 'Your city'),
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      } catch (_) {}

      // 4) Background enrichment — never gate city UI on this
      let nearby = [];
      let drivers = [];
      try {
        if (window.Commerce?.loadVendors) {
          await Promise.race([
            window.Commerce.loadVendors(),
            new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
          ]);
        }
        nearby = this.nearbyVendors(pos.lat, pos.lng);
        if (nearby.length && window.Commerce) {
          window.Commerce.vendors = nearby
            .concat((window.Commerce.vendors || []).filter((v) => !nearby.includes(v)))
            .slice(0, 40);
        }
        window.Commerce?.showOnGlobe?.();
        GlobeEntity?.syncVendors?.(window.Commerce?.vendors);
        drivers = window.Commerce?.fetchNearbyDrivers
          ? await Promise.race([
            window.Commerce.fetchNearbyDrivers(pos.lat, pos.lng),
            new Promise((resolve) => setTimeout(() => resolve([]), 2500)),
          ])
          : [];
        window.Commerce?.showDriversOnGlobe?.(drivers);
      } catch (_) {}

      try {
        this._pulseFriends();
        this._showLocalNews(pos.lat, pos.lng);
        this._updateChip(nearby.length, drivers.length);
        CityMap?.onCamera?.(this.CITY_ZOOM, 'earth');
      } catch (_) {}

      const msg = nearby.length + ' shops · ' + drivers.length + ' drivers · '
        + (window.others?.length || 0) + ' friends nearby';
      GlobeDeck?.setMapStatus?.('🏙 City map · ' + pos.lat.toFixed(2) + ', ' + pos.lng.toFixed(2));
      GlobeDeck?.setPreview?.('🏙 ' + msg);
      AciCli?.print?.('◎ City view · ' + msg, 'ok');
      ACIControl?.reply?.('City map open — ' + msg + ' · tap a shop or type: order pitogyra');
      FieldBrain?.pulse?.('city', msg, { role: 'client', props: { lat: pos.lat, lng: pos.lng, shops: nearby.length } });

      if (opts.openShops && nearby.length) {
        try {
          GlobeDeck?.expand?.(window.SuperCli?.title || 'Astranov');
          await window.Commerce?.showPicker?.();
        } catch (_) {}
      }
      return {
        vendors: nearby,
        drivers,
        lat: pos.lat,
        lng: pos.lng,
        mapActive: !!(typeof CityMap !== 'undefined' && CityMap?.active),
      };
    } catch (e) {
      console.error('[CityLife] dropIn', e);
      AciCli?.print?.('city drop error: ' + (e.message || e), 'err');
      try { await CityMap?.openAt?.(pos.lat, pos.lng, { camZ: this.CITY_ZOOM }); } catch (_) {}
      return {
        error: e.message || 'city drop failed',
        lat: pos.lat,
        lng: pos.lng,
        mapActive: !!(typeof CityMap !== 'undefined' && CityMap?.active),
      };
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
    if (!navigator.geolocation) throw new Error('no geolocation');
    GlobeDeck?.setMapStatus?.('Locating…');
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 60000,
      });
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    this.markMeOnGlobe(lat, lng);
    return this.dropIn(lat, lng, { label: 'Your city' });
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
      CityTasks?.init?.();
      if (rest) await CityTasks?.handleCli?.('task ' + rest);
      else await CityTasks?.handleCli?.('task list');
    },
    job: async (rest) => {
      CityTasks?.init?.();
      await CityTasks?.handleCli?.('task job ' + (rest || 'barman 3h'));
    },
    date: async (rest) => {
      CityTasks?.init?.();
      await CityTasks?.handleCli?.('task date ' + (rest || 'coffee 2h'));
    },
    errand: async (rest) => {
      CityTasks?.init?.();
      await CityTasks?.handleCli?.('task errand ' + (rest || 'pharmacy'));
    },
    assign: async (rest) => {
      CityTasks?.init?.();
      if (rest) await FieldBrain?.claimDelivery?.(rest);
      else AciCli?.print('usage: scenario assign <order_id>', 'err');
    },
    crawl: async () => {
      const u = CityLife.userPos() || window._lastPos || { lat: 36.4341, lng: 28.2176 };
      await SpaceNetBrain?.crawlAll?.(u.lat, u.lng, 3, { force: true });
    },
    starship: async (rest) => {
      StarshipFlight13?.init?.();
      await StarshipFlight13?.handleCli?.(rest || 'starship');
    },
    starlink: async () => {
      StarlinkConstellation?.init?.();
      await StarlinkConstellation?.handleCli?.('starlink');
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