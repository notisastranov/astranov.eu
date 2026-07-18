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
    // Allow full cinematic: GPS + national fly + city zoom + map (~12s typical)
    const overall = new Promise((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error('locate timeout'), { code: 3 })), 28000);
    });
    try {
      GlobeDeck?.expand?.(window.PublicCopy?.deckTitle?.() || 'Astranov');
      GlobeDeck?.setMapStatus?.('Locating your city…');
      CliRibbon?.setNotice?.('Locating…', 'thinking');
      ACIControl?.reply?.('Locating — flying globe to your country, then city');
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

  /**
   * Force full globe on screen (exit city map, canvas visible).
   * Without this, locate runs “under” the map and looks like a teleport.
   */
  ensureEarthView() {
    window._cityDropLock = false;
    window._locateCinematic = false;
    try {
      if (CityMap?.returnToGlobe) {
        CityMap.returnToGlobe({ instant: true, tier: 'global' });
      } else if (CityMap?.active) {
        CityMap._exit?.();
      }
    } catch (_) {}
    try {
      const globe = document.getElementById('globe');
      const mapEl = document.getElementById('city-map');
      if (mapEl) {
        mapEl.classList.remove('active', 'national-active');
        mapEl.style.opacity = '0';
        mapEl.style.pointerEvents = 'none';
      }
      if (globe) {
        globe.classList.remove('city-map-active', 'national-map-active');
        globe.style.opacity = '1';
        globe.style.visibility = 'visible';
        globe.style.zIndex = '2';
      }
      document.body?.classList?.remove?.('city-map-active', 'national-map-active');
      const canvas = document.querySelector('#globe canvas');
      if (canvas) {
        canvas.style.opacity = '1';
        canvas.style.pointerEvents = 'auto';
        canvas.style.display = 'block';
      }
    } catch (_) {}
    if (CosmicZoom) CosmicZoom.level = 'earth';
    try { cityLevel = false; } catch (_) {}
    try {
      if (typeof camera !== 'undefined' && camera) {
        const gZ = GlobeControl?.Z?.global || 2.55;
        if (camera.position.z < gZ - 0.05) camera.position.z = gZ;
        camera.lookAt(0, 0, 0);
      }
      ZoomTiers?.goTo?.('global', false);
      CosmicZoom?.update?.(GlobeControl?.Z?.global || 2.55, {
        tier: 'global', label: 'Earth', cosmic: 'earth',
      });
    } catch (_) {}
  },

  /** Visible zoom-out to full Earth before any locate fly (user must SEE the globe). */
  async revealGlobeForLocate() {
    this.ensureEarthView();
    const globalZ = GlobeControl?.Z?.global || 2.55;
    const fromZ = (typeof camera !== 'undefined' && camera?.position?.z) || globalZ;
    GlobeDeck?.setMapStatus?.('Zooming out to Earth…');
    CliRibbon?.setNotice?.('Globe · zooming out…', 'thinking');
    const zl = document.getElementById('zoom-label');
    if (zl) zl.textContent = PublicCopy?.zoomLine?.('global') || 'Earth · drag · locate';

    // Always animate outward if we were close — even if already ~global, brief hold
    try {
      if (typeof camera !== 'undefined' && camera) {
        const startZ = Math.min(fromZ, globalZ);
        // If stuck in city cam under map, jump start then ease out further
        if (startZ < 2.0) {
          window._globeFly = {
            mode: 'zoom',
            fromZ: startZ,
            toZ: globalZ,
            t0: performance.now(),
            dur: 1200,
            tierId: 'global',
            onTier: true,
          };
          await this._awaitFly(1600);
        } else {
          camera.position.z = globalZ;
          camera.lookAt(0, 0, 0);
          await this._yield(200);
        }
      }
    } catch (_) {}
    try {
      ZoomTiers?.goTo?.('global', false);
      CosmicZoom?.update?.(globalZ, { tier: 'global', label: 'Earth', cosmic: 'earth' });
      if (typeof renderer !== 'undefined' && renderer && scene && camera) {
        renderer.render(scene, camera);
      }
    } catch (_) {}
    await this._yield(280);
  },

  async _awaitFly(maxMs) {
    const cap = maxMs || 4500;
    try {
      if (typeof waitForGlobeFly === 'function') {
        await Promise.race([
          waitForGlobeFly(cap),
          new Promise((r) => setTimeout(r, cap + 100)),
        ]);
      } else {
        await this._yield(Math.min(cap, 1800));
      }
    } catch (_) {}
  },

  /** Globe turn + zoom to lat/lng at target camera Z (visible, not a teleport). */
  async flyGlobeTo(lat, lng, targetZ, durMs) {
    if (typeof latLngToPos !== 'function' || typeof flyToPoint !== 'function' || typeof THREE === 'undefined') {
      try {
        if (typeof camera !== 'undefined' && camera) camera.position.z = targetZ;
      } catch (_) {}
      return;
    }
    const p = latLngToPos(lat, lng, 1.04);
    flyToPoint(new THREE.Vector3(p.x, p.y, p.z), targetZ, {
      dur: durMs || GlobeControl?.flyDuration?.(camera?.position?.z, targetZ) || 1800,
    });
    await this._awaitFly((durMs || 1800) + 2200);
  },

  async flyToCity(lat, lng, label) {
    try { this.ensureEarthView(); } catch (_) {}
    const z = this.CITY_ZOOM;
    await this.flyGlobeTo(lat, lng, z, 1400);
    try { GlobeControl?.engageFollow?.('locate'); } catch (_) {}
    try { GlobeControl?.noteAutoFly?.(); } catch (_) {}
    try { MapDepict?.pulse?.(lat, lng, 0x3d9eff, label || 'Your city', 14000); } catch (_) {}
  },

  nearbyVendors(lat, lng) {
    const list = window.Commerce?.vendors || [];
    if (!list.length || !window.Commerce?.haversineKm) return list;
    return list.filter(v => v.lat != null && window.Commerce.haversineKm(lat, lng, v.lat, v.lng) <= this.NEARBY_KM);
  },

  _yield(ms) {
    return new Promise((r) => setTimeout(r, ms || 0));
  },

  async dropIn(lat, lng, opts) {
    opts = opts || {};
    const pos = lat != null && lng != null ? { lat, lng } : this.userPos();
    if (!pos?.lat || pos.lng == null) {
      return { error: 'no_location', message: 'no location — allow GPS or tap 🎯 Locate' };
    }

    // CRITICAL: do NOT set _cityDropLock yet — that forces city map open mid-fly (teleport bug)
    this.markLocated(pos.lat, pos.lng);
    this._lastDrop = { lat: pos.lat, lng: pos.lng, t: Date.now() };
    try { CityPick?.hide?.(); } catch (_) {}

    const nationalZ = GlobeControl?.Z?.national || 1.82;
    const cityZ = this.CITY_ZOOM;
    const globalZ = GlobeControl?.Z?.global || 2.55;
    const snap = !!opts.immediate; // e2e / emergency only
    window._locateCinematic = !snap;

    try {
      // 0) ALWAYS leave city map and show full globe first
      await this.revealGlobeForLocate();

      if (snap) {
        GlobeDeck?.setMapStatus?.('National view…');
        try { ZoomTiers?.goTo?.('national', false); } catch (_) {}
        await this.flyGlobeTo(pos.lat, pos.lng, nationalZ, 500);
        await this._yield(80);
        GlobeDeck?.setMapStatus?.('Opening city map…');
        try { ZoomTiers?.goTo?.('city', false); } catch (_) {}
        window._cityDropLock = true;
        window._locateCinematic = false;
        try {
          CityMap?.init?.();
          CityMap?.openAt?.(pos.lat, pos.lng, { camZ: cityZ });
        } catch (_) {}
      } else {
        // ── Cinematic: globe OUT → turn → national → city → map ──
        const zl = document.getElementById('zoom-label');

        // 1) Turn Earth toward you at GLOBAL altitude (full planet visible)
        GlobeDeck?.setMapStatus?.('Earth · flying to your country…');
        CliRibbon?.setNotice?.('Globe · turning to you…', 'thinking');
        if (zl) zl.textContent = PublicCopy?.zoomLine?.('global') || 'Earth · flying in…';
        try {
          if (CosmicZoom) CosmicZoom.level = 'earth';
        } catch (_) {}
        await this.flyGlobeTo(pos.lat, pos.lng, globalZ, 2200);
        await this._yield(350);

        // 2) Zoom in to NATIONAL (country)
        GlobeDeck?.setMapStatus?.('Country · national airspace…');
        CliRibbon?.setNotice?.('National · your region…', 'thinking');
        if (zl) zl.textContent = PublicCopy?.zoomLine?.('national') || 'Country · flying in…';
        await this.flyGlobeTo(pos.lat, pos.lng, nationalZ, 2000);
        try {
          ZoomTiers?.goTo?.('national', false);
          CosmicZoom?.update?.(nationalZ, { tier: 'national', label: 'NATIONAL', cosmic: 'earth' });
        } catch (_) {}
        CliRibbon?.setNotice?.('National · your region', 'ready');
        GlobeDeck?.setMapStatus?.('National view · your region');
        if (zl) zl.textContent = PublicCopy?.zoomLine?.('national') || 'Country · choose a city';
        await this._yield(550);

        // 3) Zoom globe into city altitude (still 3D Earth — map still closed)
        GlobeDeck?.setMapStatus?.('Zooming to your city…');
        CliRibbon?.setNotice?.('Zooming to city…', 'thinking');
        if (zl) zl.textContent = PublicCopy?.zoomLine?.('city') || 'City · streets & shops';
        await this.flyGlobeTo(pos.lat, pos.lng, cityZ, 1800);
        try {
          ZoomTiers?.goTo?.('city', false);
          CosmicZoom?.update?.(cityZ, { tier: 'city', label: 'CITY', cosmic: 'earth' });
        } catch (_) {}
        try { MapDepict?.pulse?.(pos.lat, pos.lng, 0x3d9eff, opts.label || 'Your city', 14000); } catch (_) {}
        await this._yield(320);

        // 4) Open flat city map only after globe sequence
        GlobeDeck?.setMapStatus?.('Opening city map…');
        window._cityDropLock = true;
        window._locateCinematic = false;
        try {
          CityMap?.init?.();
          if (CityMap?.openAt) {
            CityMap.openAt(pos.lat, pos.lng, { camZ: cityZ });
          } else {
            CityMap?.onCamera?.(cityZ, 'earth');
            if (!CityMap?.active) CityMap?._enter?.(cityZ);
          }
        } catch (e) {
          console.warn('[CityLife] city map open', e);
        }
      }

      try { GlobeControl?.engageFollow?.('locate'); } catch (_) {}
      try { GlobeControl?.noteAutoFly?.(); } catch (_) {}

      const nearby = this.nearbyVendors(pos.lat, pos.lng);
      try {
        if (nearby.length && window.Commerce) {
          window.Commerce.vendors = nearby
            .concat((window.Commerce.vendors || []).filter((v) => !nearby.includes(v)))
            .slice(0, 40);
          window.Commerce?.showOnGlobe?.();
        }
        this._updateChip(nearby.length, 0);
      } catch (_) {}

      const msg = nearby.length + ' shops nearby · city map open';
      GlobeDeck?.setMapStatus?.('🏙 City map · ' + pos.lat.toFixed(2) + ', ' + pos.lng.toFixed(2));
      GlobeDeck?.setPreview?.('🏙 ' + msg);
      AciCli?.print?.('◎ City view · ' + msg, 'ok');
      ACIControl?.reply?.('City map open — ' + msg);
      FieldBrain?.pulse?.('city', msg, { role: 'client', props: { lat: pos.lat, lng: pos.lng, shops: nearby.length } });
      CliRibbon?.setNotice?.('Located · city map', 'ready');

      setTimeout(() => {
        try {
          if (window.Commerce?.loadVendors) void window.Commerce.loadVendors();
          if (window.Commerce?.fetchNearbyDrivers) {
            void window.Commerce.fetchNearbyDrivers(pos.lat, pos.lng).then((drivers) => {
              window.Commerce?.showDriversOnGlobe?.(drivers || []);
              this._updateChip(nearby.length, (drivers || []).length);
            }).catch(() => {});
          }
          this._pulseFriends();
          this._showLocalNews(pos.lat, pos.lng);
          GlobeEntity?.syncVendors?.(window.Commerce?.vendors);
        } catch (_) {}
      }, 120);

      if (opts.openShops && nearby.length) {
        setTimeout(() => {
          try {
            GlobeDeck?.expand?.(window.SuperCli?.title || 'Astranov');
            void window.Commerce?.showPicker?.();
          } catch (_) {}
        }, 250);
      }

      return {
        vendors: nearby,
        drivers: [],
        lat: pos.lat,
        lng: pos.lng,
        mapActive: !!(window.CityMap?.active),
      };
    } catch (e) {
      console.error('[CityLife] dropIn', e);
      AciCli?.print?.('city drop error: ' + (e.message || e), 'err');
      try {
        window._cityDropLock = true;
        CityMap?.init?.();
        CityMap?.openAt?.(pos.lat, pos.lng, { camZ: cityZ });
      } catch (_) {}
      return {
        error: e.message || 'city drop failed',
        lat: pos.lat,
        lng: pos.lng,
        mapActive: !!(window.CityMap?.active),
      };
    } finally {
      window._cityDropLock = false;
      window._locateCinematic = false;
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
      let done = false;
      const finish = (fn, arg) => {
        if (done) return;
        done = true;
        fn(arg);
      };
      const timer = setTimeout(() => finish(reject, Object.assign(new Error('GPS timeout'), { code: 3 })), 11000);
      navigator.geolocation.getCurrentPosition(
        (p) => { clearTimeout(timer); finish(resolve, p); },
        (err) => { clearTimeout(timer); finish(reject, err); },
        { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
      );
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    this.markMeOnGlobe(lat, lng);
    // Cinematic path: globe turns → national → city zoom → map (not a teleport)
    return this.dropIn(lat, lng, { label: 'Your city', immediate: false });
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
