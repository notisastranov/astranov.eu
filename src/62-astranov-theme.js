// === ASTRANOV THEME — dark / bright for globe, city map, and UI ===
const AstranovTheme = {
  mode: 'dark',
  followSystem: true,
  KEY: 'astranov_theme_v1',
  _maps: [],

  systemMode() {
    try {
      if (window.matchMedia?.('(prefers-color-scheme: light)')?.matches) return 'bright';
    } catch (_) {}
    return 'dark';
  },

  effectiveMode() {
    return this.followSystem ? this.systemMode() : this.mode;
  },

  _watchSystem() {
    if (!window.matchMedia) return;
    const mql = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => {
      if (!this.followSystem) return;
      this.mode = this.systemMode();
      this.apply();
    };
    if (mql.addEventListener) mql.addEventListener('change', onChange);
    else if (mql.addListener) mql.addListener(onChange);
    this._systemMql = mql;
  },

  init() {
    try {
      const saved = localStorage.getItem(this.KEY);
      if (saved === 'bright' || saved === 'dark') {
        this.mode = saved;
        this.followSystem = false;
      } else {
        this.followSystem = true;
        this.mode = this.systemMode();
      }
    } catch (_) {
      this.followSystem = true;
      this.mode = this.systemMode();
    }
    this._watchSystem();
    this.apply();
    const btn = document.getElementById('aci-theme');
    if (btn) {
      btn.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        this.toggle();
      };
      this._syncBtn();
    }
  },

  registerMap(mapApi) {
    if (mapApi && !this._maps.includes(mapApi)) this._maps.push(mapApi);
  },

  toggle() {
    if (this.followSystem) {
      const sys = this.systemMode();
      this.followSystem = false;
      this.mode = sys === 'bright' ? 'dark' : 'bright';
    } else {
      this.mode = this.mode === 'dark' ? 'bright' : 'dark';
    }
    try { localStorage.setItem(this.KEY, this.mode); } catch (_) {}
    this.apply();
    AciCli?.print?.('theme → ' + this.mode + ' (manual)', 'ok');
    GlobeDeck?.setPreview?.((this.mode === 'bright' ? '☀️' : '🌙') + ' ' + this.mode + ' theme');
    if (Voice?.maySpeak?.()) speak('Theme ' + this.mode + '.', () => resumeListening?.());
    return this.mode;
  },

  set(mode) {
    const next = mode === 'bright' ? 'bright' : 'dark';
    if (!this.followSystem && next === this.mode) return this.mode;
    this.followSystem = false;
    this.mode = next;
    try { localStorage.setItem(this.KEY, next); } catch (_) {}
    this.apply();
    AciCli?.print?.('theme → ' + next, 'ok');
    GlobeDeck?.setPreview?.((next === 'bright' ? '☀️' : '🌙') + ' ' + next + ' theme');
    if (Voice?.maySpeak?.()) speak('Theme ' + next + '.', () => resumeListening?.());
    return this.mode;
  },

  apply() {
    const active = this.effectiveMode();
    document.documentElement.dataset.theme = active;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.content = active === 'bright' ? '#1a6fd4' : '#0a1020';
    if (scene?.background) {
      scene.background = new THREE.Color(active === 'bright' ? 0x040810 : 0x000000);
    }
    if (renderer) renderer.setClearColor(active === 'bright' ? 0x040810 : 0x000000, 1);
    EarthRealism?.onThemeChange?.();
    this._maps.forEach(m => m.onThemeChange?.());
    this._syncBtn();
  },

  _syncBtn() {
    const btn = document.getElementById('aci-theme');
    if (!btn) return;
    const active = this.effectiveMode();
    btn.textContent = active === 'bright' ? '☀️' : '🌙';
    btn.title = this.followSystem
      ? ('Device ' + active + ' theme — tap to override')
      : (active === 'bright' ? 'Bright theme — tap for dark' : 'Dark theme — tap for bright');
    btn.classList.toggle('deck-btn-active', active === 'bright');
    btn.classList.toggle('deck-btn-system', this.followSystem);
  },
};
window.AstranovTheme = AstranovTheme;