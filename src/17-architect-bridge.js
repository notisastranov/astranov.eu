// === ARCHITECT BRIDGE — phone street-fix → desktop Grok Build agent ===
// Owner only: notisastranov@gmail.com after Google sign-in on astranov.eu
const ArchitectBridge = {
  armed: false,
  lastTaskId: null,
  _pollTimer: null,
  _watchIds: new Set(),
  BRIDGE_URL: null,

  bridgeUrl() {
    if (this.BRIDGE_URL) return this.BRIDGE_URL;
    const fn = typeof resolveAstranovFunctionsUrl === 'function'
      ? resolveAstranovFunctionsUrl()
      : (SB_URL + '/functions/v1');
    this.BRIDGE_URL = fn + '/coders-bridge';
    return this.BRIDGE_URL;
  },

  isActive() {
    return !!(Auth?.isArchitect || AciCoders?.isArchitect?.());
  },

  fieldContext() {
    const pos = window._lastPos || null;
    let build = '';
    try { build = document.querySelector('meta[name="astranov-build"]')?.content || ''; } catch (_) { /* */ }
    return {
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      build,
      page: location.pathname + location.search,
      active_task: GlobeDeck?.activeTask || 'idle',
      ua: navigator.userAgent?.slice(0, 120) || '',
    };
  },

  async api(body) {
    const headers = await Auth.authHeaders();
    return fetchJson(this.bridgeUrl(), {
      method: 'POST',
      headers,
      body: JSON.stringify(body || {}),
    }, 28000);
  },

  init() {
    if (this._inited) return;
    this._inited = true;
    this._bindUi();
    if (this.isActive()) this.arm({ quiet: true });
  },

  _bindUi() {
    const btn = document.getElementById('aci-bridge');
    if (!btn || btn._bridgeBound) return;
    btn._bridgeBound = true;
    btn.onclick = e => {
      e.preventDefault();
      e.stopPropagation();
      void this.openQuickFix();
    };
  },

  openQuickFix() {
    if (!Auth?.user) {
      Auth?.openLoginModal?.('Sign in as architect to use dev bridge');
      return;
    }
    if (!this.isActive()) {
      ACIControl?.reply('Dev bridge is architect-only — sign in as notisastranov@gmail.com');
      return;
    }
    this.arm({ quiet: true });
    GlobeDeck?.expand?.('Bridge — fix from street');
    CliRibbon?.setNotice?.('Bridge · describe bug', 'ready');
    const input = document.getElementById('aci-cli-in');
    if (input) {
      input.value = 'fix ';
      input.focus();
      try { input.setSelectionRange(4, 4); } catch (_) { /* */ }
      window.resizeCliInput?.(input);
    }
    ACIControl?.reply('🛠 Bridge — type what to fix, or speak after 🎧');
    AciCli?.print('Bridge ready — finish with: fix <what broke>', 'ok');
  },

  arm(opts = {}) {
    if (!this.isActive()) return { error: 'architect_only' };
    this.armed = true;
    window._architectBridgeArmed = true;
    this.startWatch();
    if (!opts.quiet) {
      AciCli?.print('Bridge armed — dev/fix tasks reach Grok Build on desktop', 'ok');
      ACIControl?.reply('Bridge armed · say fix <issue> or dev <task>');
    }
    CliRibbon?.setNotice?.('Bridge armed · fix/dev', 'ready');
    return { ok: true, armed: true };
  },

  disarm() {
    this.armed = false;
    window._architectBridgeArmed = false;
    this.stopWatch();
    this._watchIds.clear();
  },

  stopWatch() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  startWatch() {
    if (!this.isActive()) return;
    this.stopWatch();
    let ticks = 0;
    this._pollTimer = setInterval(async () => {
      if (!this.isActive() || document.hidden) return;
      ticks++;
      if (this.lastTaskId) await this.poll(this.lastTaskId, true);
      if (ticks % 6 === 0) await this.refreshOpen();
    }, 5000);
  },

  async refreshOpen() {
    const r = await this.api({ mode: 'architect_poll', limit: 8 }).catch(() => ({}));
    const rows = r.summons || [];
    const open = rows.filter(s => s.status === 'open' || s.status === 'in_progress');
    if (open.length && !this.lastTaskId) this.lastTaskId = open[0].id;
    open.forEach(s => this._watchIds.add(s.id));
  },

  async push(task, opts = {}) {
    if (!Auth?.user) {
      ACIControl?.reply('Sign in with G as architect first');
      Auth?.openLoginModal?.('Sign in to arm Architect Bridge');
      return { error: 'login required' };
    }
    if (!this.isActive()) {
      const msg = 'Bridge is architect-only — notisastranov@gmail.com';
      AciCli?.print(msg, 'err');
      return { error: 'architect_only', text: msg };
    }
    if (!(await AciCoders?.ensureSession?.())) return { error: 'session expired' };

    const text = String(task || '').trim();
    if (text.length < 3) return { error: 'task too short' };

    const kind = opts.kind || (/^dev\b/i.test(text) ? 'dev' : 'fix');
    const field = { ...this.fieldContext(), ...(opts.field || {}) };

    GlobeDeck?.setThinking?.(true, 'Bridge push…');
    const r = await this.api({
      mode: 'architect_push',
      task: text,
      kind,
      ...field,
      context: field,
    });
    GlobeDeck?.setThinking?.(false);

    if (r.error) {
      AciCli?.print('Bridge error: ' + r.error, 'err');
      return r;
    }

    this.armed = true;
    this.lastTaskId = r.summon_id;
    if (r.summon_id) this._watchIds.add(r.summon_id);

    const msg = 'Bridge #' + r.summon_id + ' queued — Grok Build will fix on desktop';
    AciCli?.print(msg, 'ok');
    ACIControl?.reply(msg);
    GlobeDeck?.setPreview?.(msg.slice(0, 140));
    CliRibbon?.setNotice?.('Bridge #' + r.summon_id + ' queued', 'ready');
    this.startWatch();
    return r;
  },

  async poll(summonId, quiet) {
    const id = summonId || this.lastTaskId;
    if (!id) {
      if (!quiet) AciCli?.print('usage: bridge poll <id>', 'err');
      return { error: 'no id' };
    }
    const r = await this.api({ mode: 'architect_poll', summon_id: id });
    if (!quiet) {
      if (r.pending) AciCli?.print('#' + id + ' pending — Grok Build working…', 'dim');
      else if (r.text) AciCli?.print('Bridge #' + id + ': ' + r.text.slice(0, 900), 'out');
    }
    if (r.text && !r.pending) {
      this._deliverAnswer(id, r.text, r.question);
    }
    return r;
  },

  _deliverAnswer(id, text, question) {
    const shown = 'Bridge #' + id + ': ' + text.slice(0, 260);
    AciCli?.print(shown, 'reply');
    ACIControl?.reply(shown);
    GlobeDeck?.expand?.('Bridge fix');
    GlobeDeck?.setPreview?.(text.slice(0, 140));
    CliRibbon?.setNotice?.('Bridge #' + id + ' fixed', 'ready');
    if (AciCoders?._recordReply) AciCoders._recordReply(id, text);
    if (Voice?.maySpeak?.() && Voice?.shouldSpeak?.(text)) {
      speak('Bridge fix ready. ' + text.slice(0, 100), () => {}, false);
    }
    this._watchIds.delete(id);
    if (this.lastTaskId === id) this.lastTaskId = null;
  },

  async status() {
    if (!this.isActive()) return { error: 'architect_only' };
    const r = await this.api({ mode: 'architect_poll', limit: 6 });
    const open = (r.summons || []).filter(s => s.status === 'open' || s.status === 'in_progress');
    const msg = this.armed
      ? 'Bridge armed · ' + open.length + ' open · last #' + (this.lastTaskId || '—')
      : 'Bridge idle — say bridge to arm';
    AciCli?.print(msg, 'ok');
    ACIControl?.reply(msg);
    return { ok: true, armed: this.armed, open: open.length, last: this.lastTaskId };
  },

  async list() {
    if (!this.isActive()) return { error: 'architect_only' };
    const r = await this.api({ mode: 'architect_poll', limit: 12 });
    const rows = r.summons || [];
    if (!rows.length) {
      AciCli?.print('no bridge tasks yet — say fix <issue>', 'dim');
      return r;
    }
    AciCli?.print('── architect bridge ──', 'dim');
    rows.forEach(s => {
      AciCli?.print('#' + s.id + ' [' + s.status + '] ' + String(s.question || '').slice(0, 100),
        s.status === 'answered' ? 'ok' : 'dim');
    });
    return r;
  },

  wantsBridgeCmd(raw) {
    return /^(bridge|dev|fix)\b/i.test(String(raw || '').trim());
  },

  async handleCommand(raw) {
    const line = String(raw || '').trim();
    const parts = line.split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const rest = parts.slice(1).join(' ').trim();

    if (cmd === 'bridge') {
      const sub = (parts[1] || '').toLowerCase();
      if (!sub || sub === 'arm' || sub === 'on') return this.arm();
      if (sub === 'off' || sub === 'disarm') { this.disarm(); AciCli?.print('Bridge disarmed', 'dim'); return { ok: true }; }
      if (sub === 'status' || sub === 'stat') return this.status();
      if (sub === 'list') return this.list();
      if (sub === 'poll' || sub === 'status') {
        const id = parts[2] ? parseInt(parts[2], 10) : this.lastTaskId;
        return this.poll(id, false);
      }
      if (rest) return this.push(rest, { kind: 'bridge' });
      return this.status();
    }

    if (cmd === 'dev' || cmd === 'fix') {
      const task = rest || line;
      if (!rest) {
        AciCli?.print('usage: ' + cmd + ' <what to change>', 'err');
        return { error: 'usage' };
      }
      return this.push(cmd + ' ' + rest, { kind: cmd });
    }

    return null;
  },
};

window.ArchitectBridge = ArchitectBridge;