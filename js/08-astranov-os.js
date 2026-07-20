// === ASTRANOV OS — multi-device web OS shell (globe is desktop wallpaper) ===
const AstranovOS = {
  version: '20260720-os1',
  mode: 'home',
  _inited: false,
  _apps: null,
  init() {
    if (this._inited) return this;
    this._inited = true;
    this._apps = this._defaultApps();
    this._injectCss();
    this._ensureChrome();
    this._bind();
    this._applyDeviceClass();
    this.setMode('home', { silent: true });
    try { window.AstranovBrowser?.init?.(); } catch (e) { console.warn('[OS] browser init', e); }
    document.documentElement.dataset.astranovOs = this.version;
    console.log('%c[AstranovOS] ready · ' + this.version, 'color:#7ec8ff;font-weight:700');
    return this;
  },
  _defaultApps() {
    return [
      { id: 'home', name: 'Earth', icon: '🌍', open: () => this.setMode('home') },
      { id: 'browser', name: 'Browser', icon: '🧭', open: () => this.openBrowser() },
      { id: 'locate', name: 'Locate', icon: '🎯', open: () => this.actionLocate() },
      { id: 'market', name: 'Market', icon: '🛒', open: () => this.actionMarket() },
      { id: 'chat', name: 'AI', icon: '✦', open: () => this.actionChat() },
      { id: 'plus', name: 'Create', icon: '＋', open: () => this.actionPlus() },
      { id: 'system', name: 'System', icon: '⚙', open: () => this.setMode('system') },
    ];
  },
  _applyDeviceClass() {
    const root = document.documentElement;
    const touch = matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
    const narrow = matchMedia('(max-width:720px)').matches;
    root.classList.toggle('os-touch', touch);
    root.classList.toggle('os-narrow', narrow);
    root.classList.toggle('os-desktop', !touch && !narrow);
    if (touch || narrow) {
      window._globePerfLite = true;
      try {
        if (window.SlumberManager && !SlumberManager._userPinned) {
          if (SlumberManager.applyTier) SlumberManager.applyTier('conserve', 'os touch default');
          else SlumberManager.tier = 'conserve';
        }
      } catch (_) {}
    }
  },
  _injectCss() {
    if (document.getElementById('astranov-os-css')) return;
    const st = document.createElement('style');
    st.id = 'astranov-os-css';
    st.textContent = '#astranov-os-root{position:fixed;inset:0;z-index:175;pointer-events:none;font:12px/1.35 system-ui,sans-serif;color:var(--an-text,#cfe6ff)}#astranov-os-root *{box-sizing:border-box}#os-status{pointer-events:none;position:fixed;top:max(6px,env(safe-area-inset-top));left:10px;right:10px;display:flex;justify-content:space-between;align-items:center;z-index:176;font-size:10px;color:rgba(180,210,240,.72);text-shadow:0 1px 4px #000}#os-status b{color:#9fd0ff;font-weight:600;letter-spacing:.04em}#os-dock{pointer-events:auto;position:fixed;left:50%;transform:translateX(-50%);bottom:calc(72px + env(safe-area-inset-bottom,0px));z-index:180;display:flex;gap:4px;padding:6px 8px;border-radius:22px;background:rgba(4,10,22,.78);border:1px solid rgba(80,140,220,.35);backdrop-filter:blur(16px);-webkit-backdrop-filter:blur(16px);box-shadow:0 10px 36px rgba(0,0,0,.5);max-width:min(560px,96vw);overflow-x:auto;touch-action:manipulation}html.os-narrow #os-dock{bottom:calc(78px + env(safe-area-inset-bottom,0px));gap:2px;padding:5px 6px}.os-dock-btn{appearance:none;border:0;background:transparent;color:#cfe6ff;min-width:48px;height:48px;border-radius:16px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;cursor:pointer;font:inherit;padding:4px 6px}.os-dock-btn span{font-size:18px;line-height:1}.os-dock-btn em{font-style:normal;font-size:8px;opacity:.75;letter-spacing:.02em}.os-dock-btn:active{transform:scale(.94)}.os-dock-btn[aria-current="true"]{background:rgba(61,158,255,.18);box-shadow:inset 0 0 0 1px rgba(90,170,255,.4)}#os-surface{pointer-events:none;position:fixed;inset:0;z-index:178;display:none}#os-surface.open{display:block;pointer-events:auto}#os-surface-panel{position:absolute;left:50%;top:max(56px,env(safe-area-inset-top));transform:translateX(-50%);width:min(720px,96vw);height:min(78vh,820px);border-radius:18px;background:rgba(3,8,18,.94);border:1px solid rgba(90,160,255,.35);box-shadow:0 20px 60px rgba(0,0,0,.55);display:flex;flex-direction:column;overflow:hidden;backdrop-filter:blur(18px)}#os-surface-head{display:flex;align-items:center;gap:8px;padding:10px 12px;border-bottom:1px solid rgba(80,130,190,.22)}#os-surface-head b{flex:1;font-size:13px;color:#8ec8ff}#os-surface-head button{border:1px solid rgba(100,150,200,.35);background:rgba(0,20,40,.45);color:#bcd;border-radius:10px;padding:6px 10px;cursor:pointer;font:inherit}#os-surface-body{flex:1;min-height:0;overflow:auto;padding:12px}.os-card-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:10px}.os-card{border:1px solid rgba(90,150,220,.28);background:rgba(0,16,36,.5);border-radius:14px;padding:14px 10px;text-align:center;cursor:pointer;color:#def}.os-card:active{transform:scale(.97)}.os-card i{display:block;font-style:normal;font-size:22px;margin-bottom:6px}.os-card strong{display:block;font-size:11px}.os-card small{display:block;margin-top:4px;font-size:9px;color:#8ab}.os-kv{display:grid;grid-template-columns:1fr auto;gap:6px 12px;font-size:11px;margin:0}.os-kv dt{color:#8ab}.os-kv dd{margin:0;color:#e8f4ff;text-align:right}.os-help{font-size:11px;color:#9bb;line-height:1.45;margin:0 0 12px}body.os-mode-browser #globe canvas{filter:brightness(.55) saturate(.85)}body.os-mode-browser #os-dock,body.os-mode-launcher #os-dock,body.os-mode-system #os-dock{bottom:calc(12px + env(safe-area-inset-bottom,0px))}body.os-mode-browser #super-cli-bar,body.os-mode-browser #globe-deck,body.os-mode-browser #aci-hud{opacity:.2;pointer-events:none}@media (min-width:900px){#os-dock{bottom:calc(18px + env(safe-area-inset-bottom,0px))}body:not(.os-mode-browser) #os-dock{bottom:calc(88px + env(safe-area-inset-bottom,0px))}}html.os-touch #os-dock{scrollbar-width:none}html.os-touch #os-dock::-webkit-scrollbar{display:none}';
    document.head.appendChild(st);
  },
  _ensureChrome() {
    if (document.getElementById('astranov-os-root')) return;
    const root = document.createElement('div');
    root.id = 'astranov-os-root';
    root.innerHTML = '<div id="os-status" aria-hidden="true"><b>ASTRANOV OS</b><span id="os-status-meta">booting…</span></div><nav id="os-dock" aria-label="Astranov OS dock"></nav><div id="os-surface" aria-hidden="true"><div id="os-surface-panel" role="dialog" aria-modal="true"><div id="os-surface-head"><b id="os-surface-title">Astranov</b><button type="button" id="os-surface-close" title="Close">✕</button></div><div id="os-surface-body"></div></div></div>';
    document.body.appendChild(root);
    this._renderDock();
    this._tickStatus();
  },
  _renderDock() {
    const dock = document.getElementById('os-dock');
    if (!dock) return;
    dock.innerHTML = this._apps.map((a) => '<button type="button" class="os-dock-btn" data-os-app="' + a.id + '" title="' + a.name + '"><span>' + a.icon + '</span><em>' + a.name + '</em></button>').join('');
  },
  _bind() {
    document.getElementById('os-dock')?.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-os-app]');
      if (!btn) return;
      const id = btn.getAttribute('data-os-app');
      const app = this._apps.find((a) => a.id === id);
      try { app?.open?.(); } catch (err) { console.warn('[OS app]', id, err); }
    });
    document.getElementById('os-surface-close')?.addEventListener('click', () => this.setMode('home'));
    document.getElementById('os-surface')?.addEventListener('click', (e) => {
      if (e.target.id === 'os-surface') this.setMode('home');
    });
    window.addEventListener('resize', () => this._applyDeviceClass(), { passive: true });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.mode !== 'home') { e.preventDefault(); this.setMode('home'); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') { e.preventDefault(); this.openBrowser(); setTimeout(() => document.getElementById('os-browser-url')?.focus(), 50); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 't') { e.preventDefault(); this.openBrowser({ newTab: true }); }
    });
    setInterval(() => this._tickStatus(), 4000);
  },
  _tickStatus() {
    const el = document.getElementById('os-status-meta');
    if (!el) return;
    const tier = window.SlumberManager?.tier || (window._globePerfLite ? 'lite' : 'full');
    const phase = document.documentElement.dataset.astranovPhase || '…';
    const net = navigator.onLine ? 'online' : 'offline';
    el.textContent = this.mode + ' · ' + phase + ' · ' + tier + ' · ' + net;
  },
  setMode(mode, opts = {}) {
    const next = mode || 'home';
    this.mode = next;
    document.body.classList.remove('os-mode-home', 'os-mode-browser', 'os-mode-launcher', 'os-mode-system');
    document.body.classList.add('os-mode-' + next);
    document.querySelectorAll('#os-dock .os-dock-btn').forEach((b) => {
      b.setAttribute('aria-current', b.getAttribute('data-os-app') === next || (next === 'home' && b.getAttribute('data-os-app') === 'home') ? 'true' : 'false');
    });
    const surface = document.getElementById('os-surface');
    if (next === 'home') {
      surface?.classList.remove('open');
      if (surface) surface.setAttribute('aria-hidden', 'true');
      try { window.AstranovBrowser?.hide?.(); } catch (_) {}
    } else if (next === 'browser') {
      surface?.classList.remove('open');
      try { window.AstranovBrowser?.show?.(opts); } catch (_) {}
    } else if (next === 'system') {
      this._openSurface('System', this._systemHtml());
      try { window.AstranovBrowser?.hide?.(); } catch (_) {}
      this._bindSystemActions();
    }
    if (!opts.silent) this._tickStatus();
  },
  _openSurface(title, html) {
    const surface = document.getElementById('os-surface');
    const body = document.getElementById('os-surface-body');
    const t = document.getElementById('os-surface-title');
    if (t) t.textContent = title;
    if (body) body.innerHTML = html;
    surface?.classList.add('open');
    surface?.setAttribute('aria-hidden', 'false');
  },
  _systemHtml() {
    const build = document.querySelector('meta[name="astranov-build"]')?.content || '—';
    return '<p class="os-help">Planetary Internet Operating System. Install as PWA for app-like use on every device.</p><dl class="os-kv"><dt>Build</dt><dd>' + build + '</dd><dt>OS</dt><dd>' + this.version + '</dd><dt>Phase</dt><dd>' + (document.documentElement.dataset.astranovPhase || '—') + '</dd><dt>Power</dt><dd>' + (window.SlumberManager?.tier || '—') + '</dd></dl><div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:14px"><button type="button" class="os-card" id="os-sys-lite"><strong>Lite mode</strong><small>Faster on phones</small></button><button type="button" class="os-card" id="os-sys-full"><strong>Full mode</strong><small>More detail</small></button><button type="button" class="os-card" id="os-sys-reset"><strong>Hard reset</strong><small>Reload</small></button></div>';
  },
  _bindSystemActions() {
    document.getElementById('os-sys-lite')?.addEventListener('click', () => {
      window._globePerfLite = true;
      try { SlumberManager._userPinned = true; if (SlumberManager.applyTier) SlumberManager.applyTier('conserve', 'you asked'); else SlumberManager.tier = 'conserve'; } catch (_) {}
      this._tickStatus(); this.toast('Lite mode on');
    });
    document.getElementById('os-sys-full')?.addEventListener('click', () => {
      window._globePerfLite = false;
      try { SLumberManager._userPinned = true; if (SlumberManager.applyTier) SlumberManager.applyTier('balanced', 'you asked'); else SlumberManager.tier = 'balanced'; } catch (_) {}
      this._tickStatus(); this.toast('Full mode on');
    });
    document.getElementById('os-sys-reset')?.addEventListener('click', () => { try { window.AstranovLogo?.hardReset?.(); } catch (_) {} location.reload(); });
  },
  openBrowser(opts = {}) {
    this.setMode('browser', opts);
    try { window.AstranovBrowser?.show?.(opts); } catch (e) { this.toast('Browser starting…'); console.warn(e); }
  },
  actionLocate() {
    this.setMode('home');
    try {
      if (window.CityLife?.safeLocate) void window.CityLife.safeLocate();
      else if (window.CityLife?.locateAndDropIn) void window.CityLife.locateAndDropIn();
      else document.getElementById('aci-locate')?.click();
    } catch (e) { console.warn('[OS locate]', e); }
  },
  actionMarket() {
    this.setMode('home');
    try {
      if (window.Commerce?.showPicker) window.Commerce.showPicker();
      else if (window.MenuProfilePostTile?.openPlusField) window.MenuProfilePostTile.openPlusField();
      else document.getElementById('super-add-fab')?.click();
    } catch (e) { console.warn('[OS market]', e); }
  },
  actionPlus() {
    this.setMode('home');
    try {
      if (window.MenuProfilePostTile?.openPlusField) window.MenuProfilePostTile.openPlusField();
      else document.getElementById('super-add-fab')?.click();
    } catch (e) { console.warn('[OS plus]', e); }
  },
  actionChat() {
    this.setMode('home');
    try {
      document.getElementById('globe-deck')?.classList.add('expanded');
      document.getElementById('aci-cli-in')?.focus();
      window.GlobeDeck?.expand?.();
    } catch (_) { document.getElementById('aci-cli-in')?.focus(); }
  },
  toast(msg) {
    let el = document.getElementById('os-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'os-toast';
      el.style.cssText = 'position:fixed;left:50%;bottom:calc(140px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:300;padding:10px 14px;border-radius:12px;background:rgba(0,20,40,.92);border:1px solid rgba(90,160,255,.4);color:#def;font:12px system-ui;pointer-events:none;opacity:0;transition:opacity .2s';
      document.body.appendChild(el);
    }
    el.textContent = String(msg || '');
    el.style.opacity = '1';
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => { el.style.opacity = '0'; }, 2200);
  },
};
window.AstranovOS = AstranovOS;
