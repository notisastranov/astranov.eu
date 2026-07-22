// === ASTRANOV THEME — SpaceX industrial skin (default) + dark/bright ===
// SpaceX: pure void black, white type, thin steel borders, mission-red alerts.
// CLI: theme spacex|dark|bright|auto
const AstranovTheme = {
  mode: 'dark',
  skin: 'spacex',
  KEY: 'astranov_theme_v1',
  SKIN_KEY: 'astranov_skin_v1',
  _maps: [],
  _auto: false,

  // SpaceX palette tokens applied to :root
  SPACEX: {
    '--an-bg': '#000000',
    '--an-text': '#f5f5f5',
    '--an-panel': 'rgba(0,0,0,0.82)',
    '--an-border': 'rgba(255,255,255,0.18)',
    '--an-accent': '#ffffff',
    '--an-muted': 'rgba(180,180,180,0.72)',
    '--ax-void': '#000000',
    '--ax-panel': 'rgba(8,8,8,0.78)',
    '--ax-panel-strong': 'rgba(12,12,12,0.92)',
    '--ax-blue': '#005288',
    '--ax-blue-bright': '#ffffff',
    '--ax-blue-glow': 'rgba(255,255,255,0.22)',
    '--ax-blue-border': 'rgba(255,255,255,0.28)',
    '--ax-blue-bg': 'rgba(20,20,20,0.85)',
    '--ax-red': '#a7a7a7',
    '--ax-red-bright': '#e8412e',
    '--ax-red-glow': 'rgba(232,65,46,0.45)',
    '--ax-red-border': 'rgba(232,65,46,0.55)',
    '--ax-red-bg': 'rgba(40,8,6,0.75)',
    '--ax-yellow': '#c4a35a',
    '--ax-yellow-bright': '#f0d78c',
    '--ax-yellow-glow': 'rgba(240,215,140,0.35)',
    '--ax-yellow-border': 'rgba(196,163,90,0.5)',
    '--ax-yellow-bg': 'rgba(40,32,12,0.7)',
    '--ax-green': '#3d9b6a',
    '--ax-green-bright': '#6dffb0',
    '--ax-green-glow': 'rgba(109,255,176,0.35)',
    '--ax-green-border': 'rgba(61,155,106,0.5)',
    '--ax-green-bg': 'rgba(8,32,20,0.7)',
  },

  init() {
    try {
      const saved = localStorage.getItem(this.KEY);
      const skin = localStorage.getItem(this.SKIN_KEY);
      if (skin === 'spacex' || skin === 'default') this.skin = skin;
      else this.skin = 'spacex'; // default SpaceX industrial
      if (saved === 'bright' || saved === 'dark') {
        this.mode = saved;
        this._auto = false;
      } else if (saved === 'auto') {
        this._auto = true;
        this.mode = this._getSystem();
      } else {
        // First visit: SpaceX dark
        this._auto = false;
        this.mode = 'dark';
        this.skin = 'spacex';
      }
    } catch (_) {
      this.mode = 'dark';
      this.skin = 'spacex';
    }
    this.apply();
    const btn = document.getElementById('aci-theme');
    if (btn) {
      btn.style.display = 'none';
      btn.onclick = null;
    }
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', () => {
        if (this._auto) {
          this.mode = this._getSystem();
          this.apply();
        }
      });
    } catch (_) {}
  },

  _getSystem() {
    try {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'bright';
    } catch (_) { return 'dark'; }
  },

  registerMap(mapApi) {
    if (mapApi && !this._maps.includes(mapApi)) this._maps.push(mapApi);
  },

  toggle() {
    if (this.skin === 'spacex' && this.mode === 'dark') this.set('bright');
    else if (this.mode === 'bright') this.setSpacex(true);
    else this.set('dark');
  },

  setSpacex(on) {
    this.skin = on === false ? 'default' : 'spacex';
    this.mode = 'dark';
    this._auto = false;
    try {
      localStorage.setItem(this.SKIN_KEY, this.skin);
      localStorage.setItem(this.KEY, 'dark');
    } catch (_) {}
    this.apply();
    AciCli?.print?.('theme → spacex (Falcon industrial)', 'ok');
    GlobeDeck?.setPreview?.('SpaceX skin · pure black mission UI');
    return this.mode;
  },

  set(mode) {
    if (mode === 'spacex' || mode === 'falcon' || mode === 'starship') {
      return this.setSpacex(true);
    }
    if (mode === 'auto' || mode === 'system') {
      this._auto = true;
      this.skin = 'default';
      this.mode = this._getSystem();
      try {
        localStorage.setItem(this.KEY, 'auto');
        localStorage.setItem(this.SKIN_KEY, 'default');
      } catch (_) {}
    } else {
      const next = mode === 'bright' || mode === 'light' ? 'bright' : 'dark';
      this.mode = next;
      this._auto = false;
      if (next === 'bright') this.skin = 'default';
      try {
        localStorage.setItem(this.KEY, next);
        localStorage.setItem(this.SKIN_KEY, this.skin);
      } catch (_) {}
    }
    this.apply();
    AciCli?.print?.('theme → ' + (this._auto ? 'auto (' + this.mode + ')' : (this.skin === 'spacex' ? 'spacex' : this.mode)), 'ok');
    GlobeDeck?.setPreview?.((this.skin === 'spacex' ? '🚀 ' : (this.mode === 'bright' ? '☀️ ' : '🌙 ')) + (this.skin === 'spacex' ? 'spacex' : (this._auto ? 'auto' : this.mode)));
    if (Voice?.maySpeak?.()) speak('Theme ' + (this.skin === 'spacex' ? 'spacex' : (this._auto ? 'auto' : this.mode)) + '.', () => resumeListening?.());
    return this.mode;
  },

  apply() {
    const effective = this._auto ? this._getSystem() : this.mode;
    document.documentElement.dataset.theme = effective;
    document.documentElement.dataset.skin = this.skin || 'spacex';
    document.body?.classList?.toggle('skin-spacex', this.skin === 'spacex');

    const root = document.documentElement;
    if (this.skin === 'spacex' && effective === 'dark') {
      Object.entries(this.SPACEX).forEach(([k, v]) => root.style.setProperty(k, v));
    } else {
      // Clear inline overrides so CSS [data-theme] rules win
      Object.keys(this.SPACEX).forEach((k) => root.style.removeProperty(k));
    }

    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      meta.content = this.skin === 'spacex' ? '#000000'
        : (effective === 'bright' ? '#c8e4ff' : '#000000');
    }
    if (typeof scene !== 'undefined' && scene?.background && typeof THREE !== 'undefined') {
      scene.background = new THREE.Color(effective === 'bright' && this.skin !== 'spacex' ? 0xc8dff0 : 0x000000);
    }
    if (typeof renderer !== 'undefined' && renderer?.setClearColor) {
      renderer.setClearColor(effective === 'bright' && this.skin !== 'spacex' ? 0xc8dff0 : 0x000000, 1);
    }
    EarthRealism?.onThemeChange?.();
    this._maps.forEach(m => m.onThemeChange?.());

    // CLI Grok feel under SpaceX skin
    try {
      const input = document.getElementById('aci-cli-in');
      if (input && this.skin === 'spacex') {
        input.style.fontFamily = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';
      }
    } catch (_) {}
  },
};
window.AstranovTheme = AstranovTheme;
