// === MENU-PROFILE-POST TILE â€” + button Â· draggable Â· map pin Â· profile Â· order Â· driver Â· lust post ===
(function loadHudModules() {
  var v = '20260710970000-spacenet-miner';
  if (!window.GalacticSky) {
    var g = document.createElement('script');
    g.src = '/astranov-galactic-sky.js?v=' + v;
    g.defer = true;
    document.head.appendChild(g);
  }
  if (!window.FieldHud) {
    var f = document.createElement('script');
    f.src = '/astranov-field-hud.js?v=' + v;
    f.defer = true;
    document.head.appendChild(f);
  }
})();
const MenuProfilePostTile = {
  _pin: null,
  _tab: 'profile',
  _pinPick: false,
  _drag: null,
  _driverOnline: false,

  formatCoords(lat, lng) {
    return Number(lat).toFixed(4) + ', ' + Number(lng).toFixed(4);
  },

  init() {
    if (this._inited) return;
    this._inited = true;
    const tile = document.getElementById('menu-profile-post-tile');
    if (!tile) return;
    document.getElementById('mpp-close')?.addEventListener('click', () => this.close());
    document.getElementById('mpp-pin-pick')?.addEventListener('click', e => {
      e.stopPropagation();
      this.togglePinPick();
    });
    document.getElementById('mpp-apply')?.addEventListener('click', () => void this.applyTab());
    document.querySelectorAll('#mpp-tabs [data-mpp-tab]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        this.setTab(btn.dataset.mppTab);
      });
    });
    document.querySelectorAll('.mpp-panel [data-mpp-act]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        void this.runAction(btn.dataset.mppAct);
      });
    });
    document.getElementById('mpp-driver-online')?.addEventListener('click', e => {
      e.stopPropagation();
      void this.toggleDriverOnline();
    });
    document.getElementById('mpp-driver-schedule')?.addEventListener('change', e => {
      void this.saveDriverSchedule(e.target.value);
    });
    this._bindTileDrag(tile);
    document.getElementById('super-add-fab')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      this.openPlusField();
    }, { capture: true });
  },

  _bindTileDrag(tile) {
    const head = document.getElementById('mpp-head');
    const dragBtn = document.getElementById('mpp-drag');
    const startDrag = (e) => {
      if (e.target?.closest?.('button:not(#mpp-drag):not(#mpp-head)')) return;
      const pt = e.touches?.[0] || e;
      const rect = tile.getBoundingClientRect();
      this._drag = { x: pt.clientX, y: pt.clientY, left: rect.left, top: rect.top };
      tile.classList.add('mpp-dragged');
      tile.style.transform = 'none';
      tile.style.left = rect.left + 'px';
      tile.style.top = rect.top + 'px';
      e.preventDefault();
    };
    const moveDrag = (e) => {
      if (!this._drag) return;
      const pt = e.touches?.[0] || e;
      const dx = pt.clientX - this._drag.x;
      const dy = pt.clientY - this._drag.y;
      tile.style.left = (this._drag.left + dx) + 'px';
      tile.style.top = (this._drag.top + dy) + 'px';
      e.preventDefault();
    };
    const endDrag = () => { this._drag = null; };
    [head, dragBtn].forEach(el => {
      if (!el) return;
      el.addEventListener('mousedown', startDrag);
      el.addEventListener('touchstart', startDrag, { passive: false });
    });
    window.addEventListener('mousemove', moveDrag);
    window.addEventListener('touchmove', moveDrag, { passive: false });
    window.addEventListener('mouseup', endDrag);
    window.addEventListener('touchend', endDrag);
  },

  isOpen() {
    return document.getElementById('menu-profile-post-tile')?.classList.contains('open');
  },

  isPinPick() {
    return this._pinPick && this.isOpen();
  },

  togglePinPick() {
    this._pinPick = !this._pinPick;
    const btn = document.getElementById('mpp-pin-pick');
    const tile = document.getElementById('menu-profile-post-tile');
    btn?.classList.toggle('active', this._pinPick);
    tile?.classList.toggle('mpp-pin-pick', this._pinPick);
    const msg = this._pinPick ? 'Tap globe or city map to move pin' : 'Pin pick off';
    GlobeDeck?.setPreview?.('ðŸ“ ' + msg);
    AciCli?.print?.(msg, this._pinPick ? 'ok' : 'dim');
  },

  consumeMapPick(lat, lng) {
    if (!this.isPinPick()) return false;
    this.setPin(lat, lng);
    return true;
  },

  setPin(lat, lng) {
    if (lat == null || lng == null) return;
    this._pin = { lat, lng };
    window._pendingShopLatLng = { lat, lng };
    const coords = document.getElementById('mpp-coords');
    if (coords) coords.textContent = this.formatCoords(lat, lng);
    MapDepict?.pulse?.(lat, lng, 0x00ddff, 'pin', 6000);
    void GlobeNavigate?.ensureCityAt?.(lat, lng);
    this._pinPick = false;
    document.getElementById('mpp-pin-pick')?.classList.remove('active');
    document.getElementById('menu-profile-post-tile')?.classList.remove('mpp-pin-pick');
    void this._refreshVendors();
  },

  setTab(tab) {
    this._tab = tab || 'profile';
    document.querySelectorAll('#mpp-tabs [data-mpp-tab]').forEach(b => {
      b.classList.toggle('active', b.dataset.mppTab === this._tab);
    });
    document.querySelectorAll('.mpp-panel').forEach(p => {
      p.classList.toggle('active', p.id === 'mpp-panel-' + this._tab);
    });
    const apply = document.getElementById('mpp-apply');
    const labels = {
      profile: 'Set delivery here',
      order: 'Browse shops here',
      driver: 'Set driver base here',
      post: 'ðŸ”¥ Post at pin',
    };
    if (apply) apply.textContent = labels[this._tab] || 'Apply';
  },

  async _refreshVendors() {
    const box = document.getElementById('mpp-vendors');
    if (!box || !this._pin) return;
    await LazyModules.ensure().catch(() => {});
    try { await Commerce?.loadVendors?.(); } catch (_) {}
    const u = this._pin;
    const rows = (Commerce?.vendors || [])
      .filter(v => v.lat != null && v.lng != null)
      .map(v => ({ v, km: Commerce?.haversineKm?.(u.lat, u.lng, v.lat, v.lng) ?? 99 }))
      .sort((a, b) => a.km - b.km)
      .slice(0, 4);
    if (!rows.length) {
      box.innerHTML = '<p style="margin:0;font-size:10px;color:#9ab">No shops loaded â€” tap browse below</p>';
      return;
    }
    box.innerHTML = rows.map(({ v, km }) =>
      '<button type="button" class="mpp-vendor" data-vid="' + v.id + '">'
      + (v.emoji || 'ðŸ¬') + ' ' + (v.name || 'Shop') + ' Â· ' + km.toFixed(1) + ' km</button>'
    ).join('');
    box.querySelectorAll('.mpp-vendor').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        const v = (Commerce?.vendors || []).find(x => x.id === btn.dataset.vid);
        if (v) void this._openVendor(v);
      };
    });
  },

  async _openVendor(v) {
    await LazyModules.ensure().catch(() => {});
    VendorMapTile?.open?.(v);
    this.close();
  },

  openPlusField() {
    GlobeDeck?.expand?.(SuperCli?.title || 'Astranov Command Line');
    const pos = window._lastPos || CityMap?.globeCenterLatLng?.() || TrackballGuard?.facingLatLng?.() || { lat: 36.44, lng: 28.22 };
    this.openAt(pos.lat, pos.lng);
  },

  openAt(lat, lng) {
    if (lat == null || lng == null) return;
    this.init();
    MapPlaceMenu?.close?.();
    VendorMapTile?.close?.();
    this._pin = { lat, lng };
    window._pendingShopLatLng = { lat, lng };
    const tile = document.getElementById('menu-profile-post-tile');
    if (!tile) return;
    tile.classList.add('open');
    tile.classList.remove('mpp-dragged');
    tile.style.left = '';
    tile.style.top = '';
    tile.style.transform = '';
    document.getElementById('mpp-coords').textContent = this.formatCoords(lat, lng);
    this.setTab(this._tab || 'profile');
    MapDepict?.pulse?.(lat, lng, 0x44ffaa, 'plus field', 8000);
    GlobeDeck?.setPreview?.('â–¸ Profile Â· Order Â· Driver Â· Post â€” drag tile or ðŸ“ pick on map');
    AciCli?.print?.('â–¸ menu-profile-post Â· ' + this.formatCoords(lat, lng), 'map');
    SuperCli?.setContext?.('add');
    void this._refreshVendors();
    void GlobeNavigate?.ensureCityAt?.(lat, lng);
  },

  close() {
    this._pinPick = false;
    this._pin = null;
    const tile = document.getElementById('menu-profile-post-tile');
    tile?.classList.remove('open', 'mpp-pin-pick');
    document.getElementById('mpp-pin-pick')?.classList.remove('active');
    if (GlobeDeck?.activeTask === 'add') GlobeDeck?.completeTask?.('add');
    SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
  },

  _pinCoords() {
    return this._pin || window._lastPos || { lat: 36.44, lng: 28.22 };
  },

  async applyTab() {
    const map = {
      profile: 'set_delivery',
      order: 'browse_shops',
      driver: 'set_driver_base',
      post: 'post_lust',
    };
    await this.runAction(map[this._tab] || 'set_delivery');
  },

  async toggleDriverOnline() {
    await LazyModules.ensure().catch(() => {});
    if (!Auth?.user) {
      Auth?.openLoginModal?.('Sign in to drive');
      return;
    }
    const btn = document.getElementById('mpp-driver-online');
    const p = this._pinCoords();
    if (!this._driverOnline) {
      const r = await FieldBrain?.goOnlineDriver?.(p.lat, p.lng);
      if (r?.ok) {
        this._driverOnline = true;
        btn?.classList.add('on');
        btn?.setAttribute('aria-pressed', 'true');
      }
    } else {
      const r = await FieldBrain?.goOfflineDriver?.();
      if (r?.ok) {
        this._driverOnline = false;
        btn?.classList.remove('on');
        btn?.setAttribute('aria-pressed', 'false');
      }
    }
  },

  async saveDriverSchedule(value) {
    if (!Auth?.user) return;
    const sched = value || 'now';
    if (sched === 'off') {
      await this.toggleDriverOnline();
      if (this._driverOnline) await this.toggleDriverOnline();
      return;
    }
    if (sched === 'now') {
      const p = this._pinCoords();
      await FieldBrain?.goOnlineDriver?.(p.lat, p.lng);
      this._driverOnline = true;
      document.getElementById('mpp-driver-online')?.classList.add('on');
    }
    try {
      const headers = await Auth.authHeaders?.();
      const prof = await Auth.client.from('profiles').select('profile_page').eq('id', Auth.user.id).maybeSingle();
      const page = (prof?.data?.profile_page && typeof prof.data.profile_page === 'object') ? prof.data.profile_page : {};
      page.driver_schedule = sched;
      page.driver_schedule_at = new Date().toISOString();
      await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + Auth.user.id, {
        method: 'PATCH', headers,
        body: JSON.stringify({ profile_page: page, updated_at: new Date().toISOString() }),
      });
      AciCli?.print?.('driver schedule Â· ' + sched, 'ok');
    } catch (_) {}
  },

  async runAction(act) {
    await LazyModules.ensure().catch(() => {});
    const p = this._pinCoords();
    const lat = p.lat;
    const lng = p.lng;
    if (act === 'set_delivery') {
      await MapPins?.setClientDelivery?.(lat, lng, 'Customer delivery Â· ' + this.formatCoords(lat, lng));
      return;
    }
    if (act === 'open_profile') {
      if (!Auth?.user) { Auth?.openLoginModal?.('Sign in'); return; }
      Auth?.openLoggedInProfile?.() || ProfileSite?.openSelf?.();
      return;
    }
    if (act === 'browse_shops') {
      window._lastPos = { lat, lng };
      await Commerce?.showPicker?.();
      this.close();
      return;
    }
    if (act === 'list_shop') {
      if (!Auth?.user) { Auth?.openLoginModal?.('Sign in to list shop'); return; }
      await Commerce?.enlistVendorAt?.(lat, lng, { name: '' });
      this.close();
      return;
    }
    if (act === 'set_driver_base') {
      if (!Auth?.user) { Auth?.openLoginModal?.('Sign in as driver'); return; }
      await MapPins?.setDriverBase?.(lat, lng, 'Driver base Â· ' + this.formatCoords(lat, lng));
      return;
    }
    if (act === 'post_lust') {
      if (!Auth?.user) { Auth?.openLoginModal?.('Sign in to post'); return; }
      const cap = (document.getElementById('mpp-post-caption')?.value || '').trim() || 'Lust Â· ' + this.formatCoords(lat, lng);
      window._lastPos = { lat, lng };
      MapDepict?.action?.('explore', { lat, lng, detail: cap.slice(0, 80) });
      FieldBrain?.pulse?.('media', cap.slice(0, 80), { role: 'client', props: { lust: true, lat, lng } });
      if (window.SuperAdd?._placeMarker) SuperAdd._placeMarker(lat, lng, cap, 'lust');
      else GlobeEntity?.syncPost?.({ id: 'lust-' + Date.now(), lat, lng, text: cap, channel: 'lust', mode: 'text', author: Auth.user.email?.split('@')[0] });
      ACIControl?.reply?.('Posted at pin Â· ' + cap.slice(0, 60));
      AciCli?.print?.('lust post Â· ' + this.formatCoords(lat, lng), 'ok');
      this.close();
      return;
    }
    if (act === 'post_media') {
      window._pendingShopLatLng = { lat, lng };
      window._lastPos = { lat, lng };
      SuperAdd?.open?.();
      const cap = document.getElementById('mpp-post-caption');
      const saCap = document.getElementById('sa-caption');
      if (cap?.value && saCap) saCap.value = cap.value;
      this.close();
    }
  },
};
window.MenuProfilePostTile = MenuProfilePostTile;


function mppPatchBoot() {
  if (window.FieldBrain && !FieldBrain.goOfflineDriver) {
    FieldBrain.goOfflineDriver = async function() {
      if (!Auth?.user) return { error: 'login' };
      try {
        const headers = await Auth.authHeaders?.();
        const stale = new Date(Date.now() - 48 * 3600000).toISOString();
        await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + Auth.user.id, {
          method: 'PATCH', headers,
          body: JSON.stringify({ field_seen_at: stale, updated_at: new Date().toISOString() }),
        });
        ACIControl?.reply?.('Driver off duty');
        return { ok: true };
      } catch (e) { return { error: String(e.message || e) }; }
    };
    const _go = FieldBrain.goOnlineDriver?.bind(FieldBrain);
    if (_go) FieldBrain.goOnlineDriver = async function(lat, lng) {
      const base = window._driverBase || window._lastPos || {};
      if (lat != null) { window._lastPos = { lat, lng }; window._driverBase = { lat, lng, label: 'Driver base' }; }
      return _go();
    };
  }
  if (window.GlobeNavigate?.handlePlaceClick && !GlobeNavigate._mppPatched) {
    GlobeNavigate._mppPatched = true;
    const _hpc = GlobeNavigate.handlePlaceClick.bind(GlobeNavigate);
    GlobeNavigate.handlePlaceClick = async function(lat, lng, opts) {
      if (MenuProfilePostTile?.consumeMapPick?.(lat, lng)) return 'mpp-pin';
      return _hpc(lat, lng, opts);
    };
  }
  if (window.MapOverlayDismiss) {
    if (!MapOverlayDismiss.PANEL_IDS.includes('menu-profile-post-tile')) {
      MapOverlayDismiss.PANEL_IDS.unshift('menu-profile-post-tile');
    }
    const _close = MapOverlayDismiss.closeAll.bind(MapOverlayDismiss);
    MapOverlayDismiss.closeAll = function() {
      MenuProfilePostTile?.close?.();
      return _close();
    };
    const _hmc = MapOverlayDismiss.handleMapClick.bind(MapOverlayDismiss);
    MapOverlayDismiss.handleMapClick = function(e) {
      if (MenuProfilePostTile?.isPinPick?.()) return false;
      return _hmc(e);
    };
  }
  if (window.MapPlaceMenu?.openPlusField) {
    MapPlaceMenu.openPlusField = function() { return MenuProfilePostTile.openPlusField(); };
  }
  MenuProfilePostTile.init();
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mppPatchBoot);
else mppPatchBoot();
