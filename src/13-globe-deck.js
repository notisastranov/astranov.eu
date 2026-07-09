// === GLOBE DECK – FULLY CELESTIAL CIRCLE (Living Truth) ===
// Refactored: no rectangle. All content in Circles.spawn AI circle.
// Compatible with ACI, voice, coders, etc.

const GlobeDeck = {
  expanded: false,
  activeTask: null,
  thinking: false,
  _circleId: 'main-cli',
  _logEl: null,

  init() {
    if (!window.Circles) {
      setTimeout(() => this.init(), 400);
      return;
    }
    let c = document.getElementById('circle-' + this._circleId);
    if (!c) {
      const spawned = Circles.spawn({
        id: this._circleId,
        type: 'ai',
        title: 'ASTRANOV CLI',
        size: '300px',
        content: '<div id="cli-log-body" style="max-height:220px; overflow:auto; font:10px/1.35 monospace; white-space:pre-wrap;"></div>'
      });
      c = spawned.el;
    }
    this._logEl = document.getElementById('cli-log-body') || c.querySelector('.circle-content');
    this.expanded = true;
    this._injectCliInput(c);
    console.log('[GlobeDeck] Celestial circle mode active (interactive input in circle)');
  },

  _injectCliInput(circleEl) {
    if (!circleEl || circleEl.querySelector('.celestial-cli-input')) return;
    const body = circleEl.querySelector('.circle-content') || circleEl.querySelector('.cc-body');
    if (!body) return;
    const wrap = document.createElement('div');
    wrap.style.cssText = 'margin-top:6px; display:flex; gap:4px; align-items:center; border-top:1px solid rgba(255,255,255,0.1); padding-top:4px;';
    wrap.innerHTML = `
      <input class="celestial-cli-input" type="text" placeholder="type cmd or ask ACI (e.g. think status, locate, coders...)" style="flex:1; font:10px monospace; background:rgba(0,0,0,0.4); border:1px solid rgba(61,158,255,0.3); color:#b8d4f0; padding:3px 6px; border-radius:4px;" />
      <button class="celestial-cli-send" style="font-size:9px; padding:2px 6px; background:rgba(61,158,255,0.2); border:1px solid #3d9eff; color:#8ab; border-radius:3px; cursor:pointer;">send</button>
    `;
    body.appendChild(wrap);
    const inp = wrap.querySelector('.celestial-cli-input');
    const send = wrap.querySelector('.celestial-cli-send');
    const execLine = (line) => {
      if (!line) return;
      this.say('> ' + line);
      if (window.AciCli && typeof AciCli.exec === 'function') {
        AciCli.exec(line);
      } else if (window.SuperCli && typeof SuperCli.exec === 'function') {
        SuperCli.exec(line);
      } else if (window.ACIControl && typeof ACIControl.handle === 'function') {
        ACIControl.handle(line);
      } else {
        this.say('CLI exec not wired');
      }
    };
    send.onclick = () => { const v=inp.value.trim(); execLine(v); inp.value=''; };
    inp.onkeydown = (e) => { if (e.key === 'Enter') { const v=inp.value.trim(); execLine(v); inp.value=''; } };
    // focus helper
    circleEl.addEventListener('click', (e) => { if (e.target === circleEl || e.target.closest('.circle-header')) inp.focus(); });
  },

  deck() { return document.getElementById('circle-' + this._circleId); },
  logEl() { return this._logEl; },

  log(text, cls = 'out') {
    const out = this.logEl();
    if (!out) return;
    const div = document.createElement('div');
    div.className = 'deck-line ' + cls;
    div.textContent = String(text || '').slice(0, 200);
    out.appendChild(div);
    out.scrollTop = out.scrollHeight;
  },

  say(text) { this.log(text); },
  expand(title) {
    const c = this.deck();
    if (c) {
      c.style.display = 'block';
      if (title) {
        const h = c.querySelector('.circle-header span') || c.querySelector('.cc-hdr');
        if (h) h.textContent = title;
      }
    }
    this.expanded = true;
  },
  collapse() {
    const c = this.deck();
    if (c) c.style.display = 'none';
    this.expanded = false;
  },
  toggle() { this.expanded ? this.collapse() : this.expand(); },
  ping() {
    const c = this.deck();
    if (c) {
      c.style.transition = 'box-shadow 0.1s';
      c.style.boxShadow = '0 0 25px #3d9eff';
      setTimeout(() => { if (c) c.style.boxShadow = ''; }, 600);
    }
  },
  setPreview(t) { /* optional in header */ },
  onUserMessage(t) { this.expand(t || 'CLI'); this.ping(); },
  setThinking(on) {
    const c = this.deck();
    if (c) c.classList.toggle('thinking', !!on);
  },
  clearLog() {
    const out = this.logEl();
    if (out) out.innerHTML = '';
  },
  showStage(id) { this.expand('Stage ' + id); },
  hideStage() {},
  completeTask() { this.collapse(); },
  finishCliIfOneShot() {},
  isOneShotCmd() { return false; },

  // Stubs for compatibility
  setTitle() {},
  setMapStatus() {},
  restoreLog() {},
  saveLog() {},
  bindDeckGestures() {},
  bindDeckResize() {},
  applySize() {},
  cycleSize() {},
  bootCollapsed() { this.collapse(); },
  superAction() { this.expand('Super'); },
};

window.GlobeDeck = GlobeDeck;