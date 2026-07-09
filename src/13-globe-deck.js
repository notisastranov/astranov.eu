// === GLOBE DECK — CELESTIAL CIRCLE VERSION (Living Truth compliant) ===
// All UI is circles. GlobeDeck now manages content inside a spawned celestial circle.
// No rectangles allowed.

const GlobeDeck = {
  expanded: false,
  activeTask: null,
  thinking: false,
  _circleId: 'cli-circle',
  _circleEl: null,

  init() {
    // Ensure Circles system
    if (!window.Circles) {
      console.warn('Circles not ready, deferring deck');
      setTimeout(() => this.init(), 500);
      return;
    }
    // Spawn or get the CLI circle
    this._circleEl = document.getElementById('circle-' + this._circleId);
    if (!this._circleEl) {
      const spawned = Circles.spawn({
        id: this._circleId,
        type: 'ai',
        title: 'ASTRANOV CLI',
        size: '320px',
        content: '<div id="cli-circle-body" style="max-height:240px;overflow:auto;font:11px/1.4 monospace;"></div>'
      });
      this._circleEl = spawned.el;
    }
    // Move any old stage content if needed
    const body = document.getElementById('cli-circle-body') || this._circleEl.querySelector('.circle-content');
    if (body) {
      // Bind to use this body as log
      this._logEl = body;
    }
    CliRibbon?.init?.();
    AppShortcuts?.init?.();
    this.bindDeckGestures();
    this._userEngaged = false;
    console.log('%c[GlobeDeck] Now running as celestial circle', 'color:#0a0');
  },

  _deckMinH() { return 118; },
  _deckMaxH() { return Math.min(window.innerHeight * 0.94, window.innerHeight - 36); },

  deck() { return this._circleEl; },
  logEl() { return this._logEl; },

  log(text, cls) {
    const out = this.logEl();
    if (!out) return;
    const kind = cls || 'out';
    const row = document.createElement('div');
    row.className = 'deck-line deck-' + kind;
    row.textContent = String(text || '').slice(0, 200);
    out.appendChild(row);
    out.scrollTop = out.scrollHeight;
    if (kind === 'reply' || kind === 'out' || kind === 'ok') {
      this._userEngaged = true;
      this.setPreview(text);
    }
  },

  say(text, cls) {
    this.log(text, cls || 'out');
  },

  onUserMessage(title) {
    this._userEngaged = true;
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    const t = title || 'Collective — listening';
    this.expand(t);
    this.ping();
  },

  ping() {
    const d = this.deck();
    if (!d) return;
    d.style.boxShadow = '0 0 30px var(--circle-glow, #3d9eff)';
    setTimeout(() => { if(d) d.style.boxShadow = ''; }, 1200);
  },

  setThinking(on, hint) {
    this.thinking = !!on;
    const d = this.deck();
    if (d) d.classList.toggle('deck-thinking', this.thinking);
    if (on && hint) this.setPreview(hint);
  },

  showError(msg) {
    this._userEngaged = true;
    this.expand('Error');
    this.log(msg, 'err');
    this.setPreview(msg);
    this.ping();
  },

  clearLog() {
    const out = this.logEl();
    if (out) out.innerHTML = '';
    this.setPreview('');
  },

  expand(title) {
    const now = Date.now();
    if (title) this.setTitle(title);
    const c = this.deck();
    if (c) c.style.display = 'flex';
    this.expanded = true;
  },

  collapse() {
    const c = this.deck();
    if (c) c.style.display = 'none';
    this.expanded = false;
  },

  toggle() {
    this.expanded ? this.collapse() : this.expand();
  },

  setTitle(text) {
    const c = this.deck();
    if (c) {
      const hdr = c.querySelector('.circle-header') || c.querySelector('.cc-hdr');
      if (hdr) hdr.firstChild.textContent = text || 'CLI';
    }
  },

  setPreview(text) {
    // preview in circle header or attr
    const c = this.deck();
    if (c && text) {
      c.setAttribute('data-preview', String(text).slice(0,80));
    }
  },

  setMapStatus(text) {
    this.setPreview(text);
  },

  shouldLog(text, kind) {
    const t = String(text || '').trim();
    if (!t) return false;
    return true;
  },

  setCompose(text) { /* stub */ },

  clearCompose() { /* stub */ },

  showStage(panelId, task, title) {
    this.activeTask = task || panelId;
    this.expand(title || this.stageTitle(panelId));
  },

  hideStage() {
    this.activeTask = null;
  },

  stageTitle(panelId) {
    const titles = {
      'vendor-menu': 'Καταστήματα',
      'node-batch': 'Work together',
      'sat-radio': 'PMR Comms',
    };
    return titles[panelId] || 'Collective';
  },

  completeTask(task) {
    this.hideStage();
    this.collapse();
  },

  isOneShotCmd(cmd) { return false; },

  finishCliIfOneShot(cmd) {},

  // compatibility
  restoreLog() {},
  saveLog() {},
  bindDeckGestures() {},
  bindDeckResize() {},
  applySize() {},
  cycleSize() {},
  bootCollapsed() { this.collapse(); },
  superAction(action) { this.expand('Super ' + (action||'')); },
};
window.GlobeDeck = GlobeDeck;