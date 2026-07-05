// === CODERS HUB — cross-lab handoff (ported from chatgpt.astranov.eu)
const CodersHub = {
  CONTINUATION_KEY: 'astranov:job-continuation',
  LABS: [
    { id: 'main', label: 'Globe OS', glyph: '◈', url: 'https://astranov.eu', accent: '#7eb8ff' },
    { id: 'chatgpt', label: 'ChatGPT', glyph: 'CG', url: 'https://chatgpt.astranov.eu', accent: '#74c0fc' },
    { id: 'claude', label: 'Claude', glyph: 'CL', url: 'https://claude.astranov.eu', accent: '#d4a574' },
    { id: 'grok', label: 'Grok', glyph: 'GK', url: 'https://grok.astranov.eu', accent: '#e8e8e8' },
    { id: 'gemini', label: 'Gemini', glyph: 'GM', url: 'https://gemini.astranov.eu', accent: '#8ab4f8' },
    { id: 'deepseek', label: 'DeepSeek', glyph: 'DS', url: 'https://deepseek.astranov.eu', accent: '#5eead4' },
    { id: 'composer', label: 'Composer', glyph: 'CP', url: 'https://composer.astranov.eu', accent: '#a8c8ff' },
  ],
  _open: false,

  init() {
    this._bind();
    this.renderLabs();
    this.refreshJob();
    this._maybeResumeFromQuery();
  },

  _bind() {
    document.getElementById('coders-hub-trigger')?.addEventListener('click', () => this.toggle(true));
    document.getElementById('coders-hub-close')?.addEventListener('click', () => this.toggle(false));
    document.getElementById('coders-save-job')?.addEventListener('click', () => this.saveJob());
    document.getElementById('coders-resume-job')?.addEventListener('click', () => this.resumeJob());
    document.getElementById('coders-clear-job')?.addEventListener('click', () => this.clearJob());
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._open) this.toggle(false);
    });
  },

  toggle(open) {
    const panel = document.getElementById('coders-hub-panel');
    if (!panel) return;
    this._open = open !== false ? !this._open : false;
    panel.classList.toggle('open', this._open);
    panel.setAttribute('aria-hidden', this._open ? 'false' : 'true');
    if (this._open) {
      this.renderLabs();
      this.refreshJob();
    }
  },

  readJob() {
    try {
      const raw = localStorage.getItem(this.CONTINUATION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  },

  writeJob(payload) {
    try {
      localStorage.setItem(this.CONTINUATION_KEY, JSON.stringify(payload));
    } catch (_) {}
    this.refreshJob();
  },

  buildJob() {
    const hist = AciCoders?.history || [];
    const lastUser = [...hist].reverse().find((m) => m.role === 'user' || m.from === 'user');
    const lastBot = [...hist].reverse().find((m) => m.role === 'assistant' || m.from === 'assistant' || m.reply);
    const cliLines = AciCli?._lines || [];
    const lastCli = cliLines.slice(-6).map((l) => l.text || l).join('\n').slice(0, 600);
    return {
      updatedAt: new Date().toISOString(),
      fromLab: 'main',
      summary: (lastBot?.reply || lastBot?.content || lastBot?.text || lastCli || 'Globe OS thread').slice(0, 280),
      lastPrompt: (lastUser?.text || lastUser?.content || lastUser?.message || '').slice(0, 400),
      messages: hist.slice(-8).map((m) => ({
        role: m.role || (m.from === 'user' ? 'user' : 'assistant'),
        content: m.text || m.content || m.reply || m.message || '',
      })),
      engine: AciCoders?.engine || 'grok',
    };
  },

  refreshJob() {
    const job = this.readJob();
    const meta = document.getElementById('coders-job-meta');
    const preview = document.getElementById('coders-job-preview');
    if (!meta || !preview) return;
    if (!job) {
      meta.textContent = 'No saved job';
      preview.textContent = 'Save your CLI thread to hand off to ChatGPT, Claude, Grok, or another lab.';
      return;
    }
    const when = job.updatedAt ? new Date(job.updatedAt).toLocaleString() : 'unknown';
    meta.textContent = `${job.fromLab || 'lab'} · ${when}`;
    preview.textContent = job.summary || job.lastPrompt || 'Saved continuation pack.';
  },

  saveJob() {
    const job = this.buildJob();
    this.writeJob(job);
    ACIControl?.reply('Job saved — open any coder lab from the hub to continue.');
    AciCli?.print('Coders hub · job saved for cross-lab handoff', 'ok');
    this.refreshJob();
  },

  resumeJob() {
    const job = this.readJob();
    if (!job) {
      ACIControl?.reply('No saved job yet. Talk to Coders first, then Save.');
      return;
    }
    const input = document.getElementById('aci-cli-in');
    if (input && job.lastPrompt) {
      input.value = `Continue from ${job.fromLab || 'previous lab'}: ${job.lastPrompt}`;
      input.dispatchEvent(new Event('input'));
    }
    GlobeDeck?.expand?.('Coders — resumed job');
    ACIControl?.reply(`Resumed job from ${job.fromLab || 'another lab'}. Send when ready.`);
    if (job.lastPrompt) void AciCoders?.handleMessage?.(job.lastPrompt);
    this.toggle(false);
  },

  clearJob() {
    try { localStorage.removeItem(this.CONTINUATION_KEY); } catch (_) {}
    this.refreshJob();
    AciCli?.print('Coders hub · job cleared', 'dim');
  },

  openLab(lab) {
    if (!lab?.url) return;
    if (lab.id === 'main') {
      this.toggle(true);
      return;
    }
    this.writeJob(this.buildJob());
    const target = new URL(lab.url);
    target.searchParams.set('continue', '1');
    window.location.href = target.toString();
  },

  renderLabs() {
    const grid = document.getElementById('coders-hub-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const host = (location.hostname || '').replace(/^www\./, '');
    for (const lab of this.LABS) {
      const here = host === 'astranov.eu' && lab.id === 'main'
        || host === `${lab.id}.astranov.eu`;
      const card = document.createElement('article');
      card.className = 'coders-card' + (here ? ' is-here' : '');
      card.style.setProperty('--lab-accent', lab.accent || '#7eb8ff');
      card.innerHTML =
        `<div class="coders-card-top"><span class="coders-card-glyph">${this._esc(lab.glyph)}</span>`
        + `<div><h2>${this._esc(lab.label)}</h2>${here ? '<span class="coders-here">You are here</span>' : ''}</div></div>`
        + `<p class="coders-card-path">${this._esc(lab.url.replace('https://', ''))}</p>`
        + `<button type="button" class="coders-open">${here ? 'Stay in lab' : 'Open lab'}</button>`;
      card.querySelector('.coders-open')?.addEventListener('click', () => this.openLab(lab));
      grid.append(card);
    }
  },

  _maybeResumeFromQuery() {
    const params = new URLSearchParams(location.search);
    if (!params.has('continue')) return;
    const job = this.readJob();
    if (!job) return;
    window.setTimeout(() => this.resumeJob(), 700);
    params.delete('continue');
    const clean = `${location.pathname}${params.toString() ? '?' + params : ''}${location.hash}`;
    history.replaceState({}, '', clean);
  },

  _esc(v) {
    return String(v ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    }[c]));
  },
};

window.CodersHub = CodersHub;
window.openCodersHub = () => CodersHub.toggle(true);