/* === 17-architect-bridge.js === */
// === ARCHITECT BRIDGE — phone street-fix → desktop Grok Build agent ===
// Owner only: notisastranov@gmail.com after Google sign-in on astranov.eu
// In-app coding path: fix | dev | code | edit | bridge → cic_queue reason architect_bridge
// Desktop: npm run bridge-watch  ·  answer: node scripts/architect-bridge-answer.mjs <id> "…"
const ArchitectBridge = {
  armed: false,
  lastTaskId: null,
  _pollTimer: null,
  _watchIds: new Set(),
  _delivered: new Set(),
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
      engine: 'grok_build',
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
    GlobeDeck?.expand?.('Bridge — code from the street');
    GlobeDeck.activeTask = 'coders';
    CliRibbon?.setActive?.('Bridge');
    CliRibbon?.setNotice?.('Bridge · fix · code · dev', 'ready');
    const input = document.getElementById('aci-cli-in');
    if (input) {
      input.value = 'fix ';
      input.placeholder = 'fix … · code … · dev … — Grok Build on desktop';
      input.focus();
      try { input.setSelectionRange(4, 4); } catch (_) { /* */ }
      window.resizeCliInput?.(input);
    }
    ACIControl?.reply('🛠 Bridge armed — type fix/code/dev or speak after 🎧');
    AciCli?.print('Bridge ready — Grok Build picks up on desktop. Commands: fix | code | dev | bridge status', 'ok');
  },

  arm(opts = {}) {
    if (!this.isActive()) return { error: 'architect_only' };
    this.armed = true;
    window._architectBridgeArmed = true;
    this.startWatch();
    if (!opts.quiet) {
      AciCli?.print('Bridge armed — fix/code/dev reach Grok Build (in-app → desktop)', 'ok');
      ACIControl?.reply('Bridge armed · say fix <issue> or code <change>');
    }
    CliRibbon?.setNotice?.('Bridge armed · in-app coding', 'ready');
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
      // Also poll any watched open ids for multi-task street sessions
      if (ticks % 2 === 0 && this._watchIds.size) {
        for (const id of [...this._watchIds]) {
          if (id !== this.lastTaskId) await this.poll(id, true);
        }
      }
      if (ticks % 4 === 0) await this.refreshOpen();
    }, 4000);
  },

  async refreshOpen() {
    const r = await this.api({ mode: 'architect_poll', limit: 8 }).catch(() => ({}));
    const rows = r.summons || [];
    const open = rows.filter(s => s.status === 'open' || s.status === 'in_progress');
    if (open.length && !this.lastTaskId) this.lastTaskId = open[0].id;
    open.forEach(s => this._watchIds.add(s.id));
    // Deliver any newly answered while watching
    for (const s of rows) {
      if (s.status === 'answered' && s.answer && !this._delivered.has(s.id)) {
        this._deliverAnswer(s.id, s.answer, s.question);
      }
    }
    return r;
  },

  /**
   * Queue a street task for desktop Grok Build.
   * Primary in-app coding path for the architect.
   */
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

    const kind = opts.kind
      || (/^code\b|^edit\b/i.test(text) ? 'code'
        : /^dev\b/i.test(text) ? 'dev'
        : /^bridge\b/i.test(text) ? 'bridge'
        : 'fix');
    const field = { ...this.fieldContext(), ...(opts.field || {}) };

    GlobeDeck?.setThinking?.(true, 'Bridge → Grok Build…');
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
      ACIControl?.reply('Bridge error: ' + r.error);
      return r;
    }

    this.armed = true;
    this.lastTaskId = r.summon_id;
    if (r.summon_id) this._watchIds.add(r.summon_id);

    const msg = 'Bridge #' + r.summon_id + ' queued — Grok Build coding on desktop · stays in this chat when done';
    AciCli?.print(msg, 'ok');
    ACIControl?.reply(msg);
    GlobeDeck?.expand?.('Bridge #' + r.summon_id);
    GlobeDeck?.setPreview?.(text.slice(0, 120));
    CliRibbon?.setNotice?.('Bridge #' + r.summon_id + ' → Grok Build', 'ready');
    this.startWatch();
    return { ...r, text: msg, bridge: true, summon_id: r.summon_id };
  },

  /**
   * Queue a natural-language build task from chat (architect only).
   * Returns null if not applicable so chat can continue.
   */
  async queueBuildFromChat(message, opts = {}) {
    if (!this.isActive()) return null;
    const m = String(message || '').trim();
    if (m.length < 6) return null;
    if (this.wantsBridgeCmd(m)) return this.handleCommand(m);
    if (!AciCoders?.isBuildTask?.(m) && !opts.force) return null;
    // Skip pure questions that are not implementation asks
    if (/^(why|what is|how does|explain|do we have)\b/i.test(m) && !opts.force) return null;
    return this.push(m, { kind: opts.kind || 'fix' });
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
    if (this._delivered.has(id)) return;
    this._delivered.add(id);
    // Keep set bounded
    if (this._delivered.size > 80) {
      const first = this._delivered.values().next().value;
      this._delivered.delete(first);
    }
    const shown = 'Bridge #' + id + ' done: ' + String(text).slice(0, 280);
    AciCli?.print(shown, 'reply');
    ACIControl?.reply(shown);
    GlobeDeck?.expand?.('Bridge fix #' + id);
    GlobeDeck?.setPreview?.(String(text).slice(0, 140));
    CliRibbon?.setNotice?.('Bridge #' + id + ' fixed', 'ready');
    if (AciCoders?._recordReply) AciCoders._recordReply(id, text);
    if (AciCoders?.history) {
      AciCoders.history.push({ role: 'assistant', text: shown, via: 'architect_bridge', summon_id: id });
      if (AciCoders.history.length > 40) AciCoders.history = AciCoders.history.slice(-40);
    }
    if (Voice?.maySpeak?.() && Voice?.shouldSpeak?.(text)) {
      speak('Bridge fix ready. ' + String(text).slice(0, 100), () => {}, false);
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
    return { ok: true, armed: this.armed, open: open.length, last: this.lastTaskId, text: msg };
  },

  async list() {
    if (!this.isActive()) return { error: 'architect_only' };
    const r = await this.api({ mode: 'architect_poll', limit: 12 });
    const rows = r.summons || [];
    if (!rows.length) {
      AciCli?.print('no bridge tasks yet — say fix <issue> or code <change>', 'dim');
      return r;
    }
    AciCli?.print('── architect bridge · Grok Build ──', 'dim');
    rows.forEach(s => {
      AciCli?.print('#' + s.id + ' [' + s.status + '] ' + String(s.question || '').slice(0, 100),
        s.status === 'answered' ? 'ok' : 'dim');
    });
    return r;
  },

  wantsBridgeCmd(raw) {
    return /^(bridge|dev|fix|code|edit)\b/i.test(String(raw || '').trim());
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
      if (sub === 'poll') {
        const id = parts[2] ? parseInt(parts[2], 10) : this.lastTaskId;
        return this.poll(id, false);
      }
      if (rest) return this.push(rest, { kind: 'bridge' });
      return this.status();
    }

    if (cmd === 'dev' || cmd === 'fix' || cmd === 'code' || cmd === 'edit') {
      if (!rest) {
        AciCli?.print('usage: ' + cmd + ' <what to change>', 'err');
        return { error: 'usage' };
      }
      const kind = (cmd === 'code' || cmd === 'edit') ? 'code' : cmd;
      return this.push(cmd + ' ' + rest, { kind });
    }

    return null;
  },
};

window.ArchitectBridge = ArchitectBridge;

/* === 18-aci-coders.js === */
// === ASTRANOV CODERS — always online for all users ===
// Justice → Truth → Freedom (exact order) is the immutable boundary.
const AciCoders = {
  ready: false,
  alwaysOn: true,
  teamActive: true,
  history: [],
  lastSummonId: null,
  engine: 'grok',
  armed: false,
  fallbackPrefs: { force: 'xai', skip: [] },
  _pollTimer: null,
  _listenTimer: null,
  _evolveTimer: null,
  _started: false,
  _listening: false,
  _listenBusy: false,
  _activityBuffer: [],
  _activityCount: 0,
  _listenTicks: 0,
  _lastListenAt: 0,

  CAUSE: 'Justice → Truth → Freedom',
  LISTEN_MS: 900000,
  _cliBusy: false,
  EVOLVE_MS: 600000,

  loadPrefs() {
    try {
      const p = JSON.parse(localStorage.getItem('aci-coders-prefs') || '{}');
      if (p.skip) this.fallbackPrefs.skip = p.skip;
      if (p.force) this.fallbackPrefs.force = p.force;
      else this.fallbackPrefs.force = 'xai';
      if (p.causeJudge) this.fallbackPrefs.causeJudge = p.causeJudge;
    } catch (_) {
      this.fallbackPrefs.force = 'xai';
    }
  },

  savePrefs() {
    try { localStorage.setItem('aci-coders-prefs', JSON.stringify(this.fallbackPrefs)); } catch (_) {}
  },

  isPowerUser() {
    return !!(Auth?.isOwner || Auth?.isArchitect);
  },

  /** Paid XAI_API_KEY path — only architect notisastranov@gmail.com after Google login */
  isArchitect() {
    const email = (Auth?.user?.email || '').toLowerCase();
    return !!(Auth?.isArchitect || email === (Auth?.OWNER_EMAIL || 'notisastranov@gmail.com').toLowerCase());
  },

  /**
   * Free tier first (OpenRouter/Groq/Gemini). Never force paid XAI from client.
   * Server uses XAI_API_KEY only after free fails — architect only + notify.
   */
  freeTierPrefs() {
    const p = { force: 'groq', skip: ['xai'] };
    if (this.fallbackPrefs?.causeJudge && this.isArchitect()) p.causeJudge = this.fallbackPrefs.causeJudge;
    return p;
  },

  isExplicitRef(raw) {
    const s = String(raw || '').trim();
    return /^(coders|composer|cursor|summon\s+coders?)\b/i.test(s) || /^@coders\b/i.test(s);
  },

  parseCauseJudge(text) {
    if (!this.isPowerUser()) return null;
    const s = String(text || '');
    if (!/priorit|judge|cause|justice|truth|freedom|δικαιοσύνη|αλήθεια|ελευθερία|κριτ|σειρά/i.test(s)) return null;
    return { ruling: s.slice(0, 500) };
  },

  loadEngine() {
    this.engine = this.fallbackPrefs.force === 'composer' ? 'composer' : 'grok';
  },

  setEngine(eng) {
    this.engine = eng === 'composer' ? 'composer' : 'grok';
    this.fallbackPrefs.force = eng === 'composer' ? 'composer' : 'xai';
    this.savePrefs();
    return true;
  },
  toggleEngine() {
    return this.setEngine(this.engine === 'composer' ? 'grok' : 'composer');
  },

  updateHud() {
    CliRibbon?.setActive?.('Coders');
    CliRibbon?.render?.();
  },

  observeActivity(source, detail, props) {
    const d = String(detail || source || '').slice(0, 120);
    if (!d) return;
    this._activityBuffer.push({ source: String(source || 'field'), detail: d, ts: Date.now(), props: props || {} });
    if (this._activityBuffer.length > 48) this._activityBuffer = this._activityBuffer.slice(-48);
    this._activityCount++;
    this.updateHud();
  },

  _buildDigest() {
    const recent = this._activityBuffer.slice(-14);
    if (!recent.length) return '';
    return recent.map(e => e.source + ':' + e.detail).join(' · ').slice(0, 1200);
  },

  startListening() {
    if (this._listenTimer) return;
    this._listening = true;
    this.updateHud();
    this._listenTimer = setInterval(() => this.listenTick(), this.LISTEN_MS);
    this._evolveTimer = setInterval(() => this.evolveTick(), this.EVOLVE_MS);
  },

  stopListening() {
    if (this._listenTimer) { clearInterval(this._listenTimer); this._listenTimer = null; }
    if (this._evolveTimer) { clearInterval(this._evolveTimer); this._evolveTimer = null; }
    this._listening = false;
  },

  async listenTick() {
    if (document.hidden) return;
    if (window._handsFreeVoice || isListening || Voice?.speaking || this._cliBusy || this._listenBusy) return;
    if (this._activityCount < 1 && this._listenTicks > 0) return;
    this._listenBusy = true;
    this._listenTicks++;
    try {
      const digest = this._buildDigest();
      const eventCount = this._activityBuffer.length;
      const evolve = eventCount >= 3 || this._listenTicks % 3 === 0;
      const r = await AciCli.api({
        mode: 'coders_listen',
        activity: digest || 'heartbeat · coders online',
        event_count: eventCount,
        evolve,
      });
      this._lastListenAt = Date.now();
      if (r.ok) this._applyListenResult(r);
    } catch (_) {
      /* retry next tick */
    } finally {
      this._listenBusy = false;
    }
  },

  _applyListenResult(r) {
    if (r.principles?.length) ACI?.syncNeuronsFromPrinciples?.(r.principles);
    if (r.evolved) {
      MapDepict?.action('evolve', { detail: 'coders listen · brain evolved' });
      ACI?.pulse?.(1.35);
      for (let i = 0; i < 2; i++) {
        ACI?.spawnNeuron?.(
          (Math.random() - 0.5) * 60,
          (Math.random() - 0.5) * 120,
          1.1 + Math.random() * 0.3,
          r.improvement?.slice(0, 80) || 'collective neuron'
        );
      }
    }
    if (r.improvement && !document.hidden) {
      GlobeDeck?.log?.('Coders · ' + r.improvement.slice(0, 160), 'dim');
    }
    this._activityBuffer = this._activityBuffer.slice(-6);
    this._activityCount = Math.max(0, this._activityCount - 2);
    this.updateHud();
  },

  async evolveTick() {
    if (window._handsFreeVoice || isListening || Voice?.speaking) return;
    if (this._activityCount < 2) return;
    try {
      await ACI?.evolve?.('coders-active-listen');
      this._activityCount = Math.max(0, this._activityCount - 3);
      this.updateHud();
    } catch (_) {}
  },

  async ensureSession() {
    if (!Auth?.user) return true;
    const session = await Auth.ensureSession?.();
    if (!session?.access_token) {
      GlobeDeck?.showError('Session expired — tap G to sign in again');
      return false;
    }
    return true;
  },

  async ensureBridge() {
    this.loadPrefs();
    this.loadEngine();
    this.alwaysOn = true;
    window._aciCodersAlwaysOn = true;
    if (this.ready) { this.updateHud(); return; }
    this.ready = true;
    window._aciCodersReady = true;
    this.updateHud();
  },

  _guaranteeReply(userMsg, r, extra) {
    const payload = { ...(r || {}), ...(extra || {}) };
    const raw = String(payload.text || payload.response || '').trim();
    if (!raw || this.isFailedReply(raw)) {
      payload.text = this.localReply(userMsg);
      payload.response = payload.text;
      payload.via = payload.via || 'local/guarantee';
    } else {
      payload.text = raw;
      payload.response = raw;
    }
    if (payload.error && !payload.text) {
      payload.text = this.localReply(userMsg) + ' (' + String(payload.error).slice(0, 100) + ')';
      payload.response = payload.text;
    }
    return this._applyResponse(payload, userMsg);
  },

  async autoStart() {
    this.alwaysOn = true;
    this.teamActive = true;
    this.armed = true;
    await this.ensureBridge();
    this.updateHud();
    if (this._started) {
      this.startListening();
      return;
    }
    this._started = true;
    window._aciCodersAlwaysOn = true;
    this.startListening();
  },

  /** Open live Coders chat — expanded CLI, replies always visible in ribbon */
  async enterSession(opts = {}) {
    opts = opts || {};
    await this.autoStart();
    if (GlobeDeck) GlobeDeck.activeTask = 'coders';
    // Default expand so replies are not hidden under collapsed deck
    const doExpand = opts.expand !== false;
    if (doExpand) {
      GlobeDeck?.onUserMessage?.('Grok');
      GlobeDeck?.expand?.('Grok');
    } else {
      GlobeDeck?.setTitle?.('Grok');
      GlobeDeck?.setPreview?.('Grok ready — type below');
    }
    CliRibbon?.setActive?.('Grok');
    AppShortcuts?.track?.('coders', 'Grok');
    if (window.AciCli) AciCli.open = true;

    const input = document.getElementById('aci-cli-in');
    if (input) {
      input.placeholder = 'Talk to Grok — type or tap 🎧 · Enter to send';
      input.classList.remove('voice-live');
      if (opts.focus !== false) {
        setTimeout(() => input.focus(), 60);
      }
    }

    // Only auto-start mic when explicitly from voice / hands-free already on
    if (opts.fromVoice || window._handsFreeVoice || voiceSessionActive) {
      if (!window._handsFreeVoice && opts.fromVoice && typeof startVoiceOptions === 'function') {
        startVoiceOptions();
      } else if (window._handsFreeVoice || voiceSessionActive) {
        scheduleVoiceResume?.();
      }
    }

    this.updateHud();

    if (!this._sessionWelcomed || opts.ping) {
      if (!this._sessionWelcomed) this._sessionWelcomed = true;
      const line = opts.ping
        ? 'Grok still here — keep talking (type or 🎧)'
        : 'Grok here — type below or tap 🎧 to speak. Replies show in the ribbon.';
      AciCli?.print(line, 'ok');
      ACIControl?.reply(line.slice(0, 200));
      CliRibbon?.setNotice?.(line.slice(0, 120), 'ready');
      GlobeDeck?.setPreview?.(line.slice(0, 120));
      if (opts.fromVoice && window._handsFreeVoice && Voice?.maySpeak?.()) {
        speak('Grok ready. Talk normally.', () => resumeListening?.(), false);
      }
    }

    return { ok: true, session: true };
  },

  /** Strip optional legacy "coders" prefix — coders listen to all messages. */
  normalizeMessage(message) {
    return String(message || '').trim()
      .replace(/^summon\s+coders?\s*/i, '')
      .replace(/^coders\s+/i, '')
      .trim();
  },

  async handleMessage(message, opts = {}) {
    const raw = (window.fixVoiceHotwords || (x => x))(String(message || '').trim());
    if (!raw) return this.enterSession({ fromVoice: !!opts.fromVoice });

    const parts = raw.split(/\s+/);
    const sub = (parts[0] || '').toLowerCase();

    if (ArchitectBridge?.wantsBridgeCmd?.(raw)) {
      const br = await ArchitectBridge.handleCommand(raw);
      if (br) return br;
    }

    if (/^coders\b/i.test(raw)) {
      if (sub === 'list') return this.listSummons();
      if (sub === 'poll' || sub === 'status') {
        const id = parts[1] ? parseInt(parts[1], 10) : this.lastSummonId;
        return this.poll(id, false);
      }
      if (sub === 'exit' || sub === 'close' || sub === 'leave') {
        AciCli?.print('Coders stay always on', 'ok');
        ACIControl?.reply('Coders always active — building the collective brain');
        return { ok: true, always_on: true };
      }
      if (sub === 'grok' || sub === 'composer') {
        const task = parts.slice(1).join(' ');
        if (task.length < 3) {
          this.setEngine(sub);
          return this.chat('use ' + sub + ' from now on');
        }
      }
      if (parts.length === 1) {
        return this.enterSession({
          ping: !!this._sessionWelcomed,
          fromVoice: !!opts.fromVoice || !!window._handsFreeVoice || !!voiceSessionActive,
        });
      }
    }

    if (this.isPowerUser() && this.isExplicitRef(raw)) {
      const task = this.normalizeMessage(raw) || raw;
      if (/^deploy\b/i.test(task)) {
        return this.executeOrder(task, raw, { deploy: true });
      }
      return this.executeOrder(task, raw);
    }

    const text = (this.normalizeMessage(raw) || raw).trim();
    if (/^coders?$/i.test(text)) {
      return this.enterSession({
        ping: !!this._sessionWelcomed,
        fromVoice: !!opts.fromVoice || !!window._handsFreeVoice || !!voiceSessionActive,
      });
    }
    return this.chat(text, opts);
  },

  async executeOrder(task, raw, opts) {
    await this.autoStart();
    if (!this.isArchitect()) {
      const msg = 'Owner orders + paid Grok are for notisastranov@gmail.com only — sign in with Google as architect';
      AciCli?.print(msg, 'err');
      ACIControl?.reply(msg);
      return { error: 'architect_only', text: msg };
    }
    if (!(await this.ensureSession())) return { error: 'session expired' };

    const judge = this.parseCauseJudge(raw);
    if (judge) {
      this.fallbackPrefs.causeJudge = judge.ruling;
      this.savePrefs();
      AciCli?.print('Cause judge ruling — architect authority', 'ok');
      try {
        await ACI?.teach?.('Architect cause judge: ' + judge.ruling);
      } catch (_) {}
    }

    const m = String(task || '').trim();
    if (!m) return { error: 'empty order' };

    AciCli?.print('OWNER ORDER — executing: ' + m.slice(0, 100), 'cmd');
    GlobeDeck?.onUserMessage('ORDER — ' + m.slice(0, 40));
    MapDepict?.action('think', { detail: 'ORDER: ' + m.slice(0, 40) });

    try {
      GlobeDeck?.setThinking(true, 'Executing owner order…');

      const r = await AciCli.api({
        mode: 'coders_chat',
        message: m,
        explicit_order: true,
        owner_judge: !!judge,
        cause_ruling: judge?.ruling || this.fallbackPrefs.causeJudge || '',
        history: this.history.slice(-10),
        fallback_prefs: this.fallbackPrefs,
      });

      const eng = this.wantsComposer(m) ? 'composer' : 'grok';
      const build = await this.queueCoder(m, eng);
      let merged = { ...r, order_executed: true };
      if (build.text && !build.error) {
        merged.text = (r.text || r.response || '') + '\n\n[ORDER #' + (build.summon_id || '?') + ']\n' + build.text;
        merged.response = merged.text;
        merged.summon_id = build.summon_id;
        merged.composer_queued = build.composer_queued;
      }

      if (opts?.deploy || /^deploy\b/i.test(m)) {
        await AciConnect?.deploy?.(m.replace(/^deploy\s*/i, ''));
      }

      GlobeDeck?.setThinking(false);
      ACIControl?.reply('Order executing — #' + (merged.summon_id || 'queued'));
      return this._applyResponse(merged, raw);
    } catch (e) {
      GlobeDeck?.setThinking(false);
      const msg = String(e.message || e);
      GlobeDeck?.showError('Order failed: ' + msg);
      return { error: msg };
    }
  },

  stopPoll() {
    if (this._pollTimer) { clearInterval(this._pollTimer); this._pollTimer = null; }
  },

  startPoll(summonId) {
    this.stopPoll();
    if (!summonId) return;
    let tries = 0;
    this._pollTimer = setInterval(async () => {
      tries++;
      const r = await this.poll(summonId, true);
      if (r?.status === 'answered') this.stopPoll();
      if (tries > 36) {
        this.stopPoll();
        if (r?.status !== 'answered') this._pollTimeoutFallback(summonId);
      }
    }, 5000);
  },

  async _pollTimeoutFallback(summonId) {
    if (!Auth?.user) return;
    if (AciCli) AciCli.print('Composer poll timeout — asking Grok…', 'dim');
    const last = this.history.filter(h => h.role === 'user').pop();
    const task = last?.content || 'summon follow-up';
    const q = await this.queueCoder(task, 'grok');
    if (q.text && AciCli) AciCli.print('Grok fallback #' + (summonId || '?') + ': ' + q.text.slice(0, 500), 'out');
  },

  async poll(summonId, quiet) {
    const id = summonId || this.lastSummonId;
    if (!id) {
      if (!quiet && AciCli) AciCli.print('usage: coders poll <summon_id>', 'err');
      return { error: 'no id' };
    }
    const r = await AciCli.api({ mode: 'coders_poll', summon_id: id });
    if (!quiet && AciCli) {
      if (r.pending) AciCli.print('#' + id + ' pending — Composer…', 'dim');
      else if (r.text) {
        AciCli.print('Composer #' + id + ': ' + r.text.slice(0, 900), 'out');
        this._recordReply(id, r.text);
      }
    }
    if (r.text && !r.pending) {
      GlobeDeck?.expand('Coders — Composer reply');
      ACIControl?.reply('Composer #' + id + ': ' + r.text.slice(0, 160));
    }
    return r;
  },

  async listSummons() {
    if (!Auth?.user) {
      AciCli?.print('sign in with G to list your summons', 'dim');
      return { error: 'login required' };
    }
    const r = await AciCli.api({ mode: 'coders_list' });
    if (!r.summons?.length) {
      if (AciCli) AciCli.print('no coders summons yet', 'dim');
      return r;
    }
    if (AciCli) {
      AciCli.print('── coders summons ──', 'dim');
      r.summons.forEach(s => {
        AciCli.print('#' + s.id + ' [' + s.status + '] ' + s.engine + ' — ' + s.question, s.status === 'open' ? 'dim' : 'ok');
      });
    }
    return r;
  },

  _recordReply(id, text) {
    this.history.push({ role: 'assistant', content: '[#' + id + '] ' + text });
    if (this.history.length > 20) this.history = this.history.slice(-20);
  },

  _applyResponse(r, userMsg) {
    if (r.fallback_prefs) {
      this.fallbackPrefs = r.fallback_prefs;
      this.savePrefs();
      this.loadEngine();
    }
    const raw = String(r.text || r.response || '').trim();
    const err = String(r.error || '').trim();
    if (r.summon_id) this.lastSummonId = r.summon_id;

    this.history.push({ role: 'user', content: userMsg });

    const honest = raw ? this.formatHonestReply(r, userMsg) : '';
    let reply = ArcangeloDialect?.repairBrands?.(honest || raw || err) ?? (honest || raw || err);
    reply = String(reply || '').slice(0, 900);
    if (!reply || this.isFailedReply(reply)) reply = this.localReply(userMsg);
    if (err && !raw && reply === this.localReply(userMsg)) {
      reply = this.localReply(userMsg) + ' (' + err.slice(0, 120) + ')';
    }

    this.history.push({ role: 'assistant', content: reply });
    if (this.history.length > 20) this.history = this.history.slice(-20);

    // Notify architect when server switches to paid XAI_API_KEY after free limit
    if (r.paid_fallback || r.notify || /xai-paid-fallback|xai-owner/.test(String(r.via || ''))) {
      const note = String(r.paid_notice || r.notify || '⚠ Free/SuperGrok limit — using paid XAI_API_KEY');
      AciCli?.print(note, 'err');
      ACIControl?.reply(note);
      CliRibbon?.setNotice?.(note.slice(0, 120), 'err');
      try {
        if (!sessionStorage.getItem('astranov:paid-xai-notified')) {
          sessionStorage.setItem('astranov:paid-xai-notified', '1');
          if (this.isArchitect() && Voice?.maySpeak?.()) {
            speak('Paid API key activated after free limit.', () => {}, false);
          }
        }
      } catch (_) { /* */ }
    }

    const prefix = r.explicit_order || r.order_executed ? 'ORDER: ' : '';
    const kind = r.error && !raw ? 'err' : 'reply';
    const shown = prefix + reply;
    AciCli?.print(shown, kind);
    ACIControl?.reply(shown.slice(0, 260));
    // Always surface where users look (trust contract)
    GlobeDeck?.expand?.('Grok');
    GlobeDeck?.setPreview?.(shown.slice(0, 140));
    if (!(r.paid_fallback || r.notify)) {
      CliRibbon?.setNotice?.(shown.slice(0, 120), kind === 'err' ? 'err' : 'ready');
    }
    CliRibbon?.setActive?.('Grok');

    const composerQueued = r.composer_queued || (r.pending && r.summon_id);
    if (composerQueued && AciCli) AciCli.print('Composer also queued #' + composerQueued, 'dim');
    if (composerQueued) this.startPoll(composerQueued);
    else this.stopPoll();

    const spoken = ArcangeloDialect?.repairOutbound?.(reply, 'reply') ?? reply;
    if (!r.pending) {
      const wantVoice = window._handsFreeVoice || voiceSessionActive;
      if (wantVoice && Voice.shouldSpeak(spoken)) {
        voiceEnabled = true;
        speak(spoken.slice(0, 160), () => resumeListening?.(), false);
      } else if (window._handsFreeVoice || voiceSessionActive) {
        scheduleVoiceResume?.();
      }
    } else if (window._handsFreeVoice || voiceSessionActive) {
      scheduleVoiceResume?.();
    }
    GlobeDeck?.setThinking?.(false);

    this.observeActivity('chat', userMsg, { coders: true, guest: !!r.guest });
    FieldBrain?.pulse?.('think', 'coders: ' + userMsg.slice(0, 48), {
      role: Auth?.user ? 'client' : 'anon',
      props: { coders: true, guest: !!r.guest, always_on: true },
    });
    return r;
  },

  isPing(m) {
    const s = String(m || '').trim();
    if (!s || s.length > 80) return false;
    return /^(are you there|you there|hello|hi|hey|ping|online|listening|composer|grok|coders|γεια|είσαι|ακούς|παρών|εδώ|μου ακούς)/i.test(s)
      || /^(composer|grok|coders)\s+(are you there|online|there)/i.test(s);
  },

  isFailedReply(text) {
    return /gathering itself|warming up|try again in a few seconds|try again (in a moment|shortly)|no model responded/i.test(String(text || ''));
  },

  isLocalGlobeCmd(m) {
    // Strict match only — avoid voice noise triggering locate/zoom
    const s = String(m || '').trim();
    if (s.length > 48) return false;
    return /^(locate(\s+me)?|zoom\s+to\s+me|where\s+am\s+i\??|find\s+me|locate\s+button|🎯|📍)$/i.test(s);
  },

  runLocalGlobeCmd(m) {
    if (!this.isLocalGlobeCmd(m)) return null;
    GlobeDeck?.setThinking(false);
    locateMe?.();
    const pos = window._lastPos;
    const hint = pos
      ? 'On globe · ' + pos.lat.toFixed(2) + ', ' + pos.lng.toFixed(2) + ' — zoom in or say city view'
      : 'Locating you on the globe…';
    AciCli?.print(hint, 'ok');
    ACIControl?.reply(hint);
    CliRibbon?.setNotice?.('located', 'ready');
    return { ok: true, located: true, text: hint };
  },

  localReply(m) {
    const greek = /[\u0370-\u03FF]/.test(String(m || ''));
    if (this.isPing(m)) {
      return greek
        ? 'Ναι, είμαι εδώ — Grok online. Μίλα κανονικά ή πάτα 🎧.'
        : 'Yes — Grok here. Talk straight to me — type or tap 🎧.';
    }
    return greek
      ? 'Grok εδώ — δοκίμασε ξανά ή πάτα 🎧 να μιλήσεις.'
      : 'Grok here — say it again or tap 🎧 to talk.';
  },

  isBuildTask(m) {
    const s = String(m || '').toLowerCase();
    if (/^(why|what|how|do we|list|status|credits|explain|try|skip|use)\b/.test(s)) return false;
    return /fix|build|implement|add|create|remove|button|locate|globe|vendor|order|mobile|lag|hang|slow|broken|crash|φτιάξε|πρόσθεσε|διόρθωσε|κολλάει/.test(s) && s.length >= 6;
  },

  isCodersIntent(m) {
    const s = String(m || '').trim();
    if (this.isExplicitRef(s)) return true;
    return this.isBuildTask(s) || /call\s+coders?|ask\s+coders?|tell\s+coders?/i.test(s);
  },

  tryLocalFix(m) {
    const low = String(m || '').toLowerCase();
    if ((/cli|input|voice|transcri|compose|lag|hang|slow/.test(low)) && /fix|clear|reset|φτιάξε|διόρθωσε/.test(low)) {
      GlobeDeck?.setCompose?.('');
      window.setVoicePerfMode?.(true);
      const input = document.getElementById('aci-cli-in');
      if (input) {
        input.classList.remove('voice-live');
        window.resizeCliInput?.(input);
        input.focus();
      }
      AciCoders._cliBusy = false;
      return 'CLI reset · perf mode on — edit the input or speak again';
    }
    if ((/vendor|shop|καταστήμα|driver|οδηγ/.test(low)) && /fix|find|show|list|scan|βρες/.test(low)) {
      window.Commerce?.openOrderFlow?.('');
      return 'Vendor scan opened on globe — pick shop or say order pitogyra';
    }
    if (/locate|zoom|map|πόσο|where am i/.test(low)) {
      this.runLocalGlobeCmd('locate me');
      return 'Located on globe';
    }
    if (/refresh|reload|συγχρον/.test(low) && /app|globe|page/.test(low)) {
      YachtMatcher?.loadAndSyncGlobe?.();
      window.Commerce?.loadVendors?.();
      AuditorPortal?.syncGlobe?.();
      return 'Globe data refreshed — yachts · vendors · drivers · auditors';
    }
    if (/^(use\s+)?(openai|gpt|groq|gemini|deepseek|deep\s*seek|cycle|astranov)\b/i.test(low)) {
      const prov = /openai|gpt/.test(low) ? 'openai-mini'
        : /groq/.test(low) ? 'groq'
        : /gemini/.test(low) ? 'gemini'
        : /deep/.test(low) ? 'deepseek'
        : 'astranov';
      AiRouter?.setProvider?.(prov);
      LabOrbs?._syncGlyphs?.();
      return 'AI provider → ' + (AiRouter.current()?.label || prov);
    }
    if (/^summon\s+composer|^use\s+composer|^queue\s+composer/i.test(low)) {
      void CodersHub?.summonComposer?.();
      return 'Summoning Composer on your saved job…';
    }
    if (/coders?\s*hub|coder\s*labs?|ai\s*teams?|open\s*coders?|labs?\s*race|ανταγωνισμ|ομάδες/.test(low)) {
      CodersHub?.toggle?.(true);
      return 'Coders Hub open — ' + (CodersHub?.LABS?.length || 0) + ' AI teams racing on subdomains';
    }
    if (/city\s*view|zoom\s*in|shops|καταστήμα/.test(low)) {
      enterCityView?.();
      return 'City view — vendors and drivers on map';
    }
    if (/theme|bright|dark|φωτειν|σκοτειν/.test(low)) {
      const mode = /bright|light|φωτειν/.test(low) ? 'bright' : 'dark';
      AstranovTheme?.set?.(mode);
      return 'Theme → ' + mode;
    }
    if (/yacht|charter|booker|ενοικ/.test(low) && /open|list|show|άνοιξε|δείξε/.test(low)) {
      YachtMatcher?.openBooking?.(null, { tab: 'booker' });
      return 'Opened yachts.astranov.eu Booker';
    }
    if (/audit|invoice|accountant|λογιστ/.test(low)) {
      AuditorPortal?.open?.({ tab: 'dashboard' });
      return 'Opened auditors.astranov.eu';
    }
    if (/Coins|coin|ledger|justice|wallet|κρυπτο|νόμισμα/.test(low) && /balance|ledger|open|show|wallet|δείξε/.test(low)) {
      if (/open|wallet|show|δείξε/.test(low)) CoinPortal?.open?.(/ledger|transparen/.test(low) ? 'transparency' : 'wallet');
      else CoinsJustice?.cli?.(['Coins', /ledger|διαφάν|transparen/.test(low) ? 'ledger' : 'balance']);
      return 'coin.astranov.eu — Coins wallet · 1 Coin = 1 EUR · work-mint only';
    }
    return null;
  },

  formatHonestReply(r, userMsg) {
    const text = String(r.text || r.response || '').trim();
    if (!text) return '';
    const id = r.summon_id || r.composer_queued || r.bridge_id;
    if (id && this.isBuildTask(userMsg)) {
      const stripped = text.replace(/\b(done|fixed|implemented|completed|applied)\b/gi, '').trim();
      const agent = r.bridge ? 'Grok Build (Architect Bridge)' : 'desktop agent';
      return (stripped ? stripped.slice(0, 280) + '\n\n' : '')
        + 'Build queued #' + id + ' — ' + agent + '. Stay in app; reply lands here. bridge poll ' + id;
    }
    return text;
  },

  wantsComposer(m) {
    return this.fallbackPrefs.force === 'composer'
      || /^use\s+composer|queue\s+composer|summon\s+composer|back\s+to\s+composer/i.test(String(m || ''));
  },

  async queueCoder(task, engine) {
    if (!Auth?.user) return { error: 'sign in with G for build queue' };
    // Build / paid Grok queue — architect only
    if (!this.isArchitect() && (engine === 'composer' || this.isBuildTask(task))) {
      return { error: 'architect_only', text: 'Build queue is owner-only — sign in as notisastranov@gmail.com' };
    }
    const eng = engine || (this.wantsComposer(task) ? 'composer' : 'grok');
    const q = await AciCli.api({
      mode: 'coders',
      task: task,
      coder_engine: eng,
      history: this.history.slice(-6),
      fallback_prefs: this.freeTierPrefs(),
    });
    if (q.error && AciCli) AciCli.print('coders error: ' + q.error, 'err');
    if (q.paid_fallback || q.notify) this._applyResponse(q, task);
    if (q.summon_id) {
      this.lastSummonId = q.summon_id;
      if (q.composer_queued) this.startPoll(q.composer_queued);
    }
    return q;
  },

  async chat(message, opts = {}) {
    const m = String((window.fixVoiceHotwords || (x => x))(String(message || ''))).trim();
    if (m.length < 1) return this.enterSession({ fromVoice: !!opts.fromVoice });

    // Rebuild path: Core Brain owns freeform + globe tools (local-first, <14s AI)
    if (window.AstranovCoreBrain?.handle && !opts.forceLegacy && !this.wantsComposer(m)
      && !ArchitectBridge?.wantsBridgeCmd?.(m) && !this.isExplicitRef(m)) {
      return AstranovCoreBrain.handle(m, opts);
    }

    const localFix = this.tryLocalFix(m);
    if (localFix) {
      AciCli?.print(localFix, 'ok');
      ACIControl?.reply(localFix.slice(0, 260));
      if (Auth?.user && this.isBuildTask(m)) {
        if (this.isArchitect() && !this.wantsComposer(m)) {
          const br = await ArchitectBridge?.queueBuildFromChat?.(m, { kind: 'fix' }).catch(() => null);
          if (br?.summon_id) AciCli?.print('Also Bridge #' + br.summon_id + ' → Grok Build', 'dim');
        } else {
          const q = await this.queueCoder(m, 'grok').catch(() => ({}));
          if (q.summon_id) AciCli?.print('Also queued #' + q.summon_id + ' for desktop agent', 'dim');
        }
      }
      if (opts.fromVoice || window._handsFreeVoice) scheduleVoiceResume?.();
      return { ok: true, local: true, text: localFix };
    }

    const localGlobe = this.runLocalGlobeCmd(m);
    if (localGlobe) {
      GlobeDeck?.setThinking(false);
      return localGlobe;
    }
    if (AstranovPresence?.wantsKryftoStart?.(m)) {
      GlobeDeck?.setThinking(false);
      AstranovPresence?.startKryfto?.();
      return { ok: true, game: 'kryfto' };
    }
    if (TelemachosPilot?.wantsCmd?.(m)) {
      GlobeDeck?.setThinking(false);
      await TelemachosPilot.cli([], m);
      return { ok: true, pilot: 'telemachos' };
    }
    if (/yacht|charter|crew|captain|match|ενοικ|supply|demand|field\s+\w+/.test(m.toLowerCase())) {
      const ev = await YachtMatcher?.evolveFromText?.(m);
      if (ev?.best) {
        GlobeDeck?.setThinking(false);
        const msg = YachtMatcher?.formatMatch?.(ev.best) || '';
        ACIControl?.reply(msg);
        return { ok: true, yacht: ev };
      }
      if (/field|parameter|develop/.test(m.toLowerCase())) {
        this.observeActivity('field_evolve', m.slice(0, 100), {});
      }
    }
    if (/hellenic|ξενία|arete|logos|μῆτις|καιρός/i.test(m)) {
      HellenicSource?.groundCoders?.(m);
    }

    await this.enterSession({
      focus: false,
      fromVoice: !!opts.fromVoice || !!window._handsFreeVoice || !!voiceSessionActive,
    });

    if (Auth?.user && !(await this.ensureSession())) {
      return this._guaranteeReply(m, { error: 'session expired', text: 'Session expired — tap G to sign in again.' });
    }

    const build = this.isBuildTask(m);
    const fast = (!build && !this.wantsComposer(m)) || m.length < 600;
    if (!fast) MapDepict?.action('think', { detail: 'coders: ' + m.slice(0, 40) });

    this._cliBusy = true;
    if (this._chatWatchdog) clearTimeout(this._chatWatchdog);
    this._chatWatchdog = setTimeout(() => {
      this._cliBusy = false;
      GlobeDeck?.setThinking?.(false);
    }, 55000);
    try {
      GlobeDeck?.setThinking(true, 'Grok…');
      if (/^city\s*(view|level|map)?$/i.test(m.trim())) {
        const city = await Promise.race([
          enterCityView?.(),
          new Promise((_, rej) => setTimeout(() => rej(new Error('city view timeout')), 22000)),
        ]).catch(e => ({ error: String(e.message || e) }));
        const shops = city?.vendors?.length ?? 0;
        const msg = city?.error
          ? 'City view failed — ' + city.error + '. Try locate first.'
          : 'City map open — ' + shops + ' shops nearby. Tap a pin or type order.';
        return this._guaranteeReply(m, { text: msg, via: 'local/city' });
      }

      // Architect + build: primary path is Architect Bridge → Grok Build desktop (in-app coding)
      if (this.isArchitect() && build && !this.wantsComposer(m)) {
        const br = await ArchitectBridge?.queueBuildFromChat?.(m, { kind: 'fix' }).catch(() => null);
        if (br?.summon_id) {
          // Still give a short Grok chat ack so phone feels live
          let ack = '';
          try {
            const gr = await AciCli.api({
              mode: 'coders_chat',
              message: 'Confirm you queued this street fix for Grok Build (one short sentence): ' + m.slice(0, 400),
              fast: true,
              history: this.history.slice(-4),
              fallback_prefs: this.freeTierPrefs(),
            }, { timeoutMs: 18000 });
            ack = String(gr.text || gr.response || '').trim();
          } catch (_) { /* */ }
          const text = (ack && !this.isFailedReply(ack) ? ack + '\n\n' : '')
            + 'Bridge #' + br.summon_id + ' → Grok Build. Stay in the app — answer returns here.';
          GlobeDeck?.setThinking(false);
          return this._applyResponse({
            text,
            response: text,
            summon_id: br.summon_id,
            bridge: true,
            bridge_id: br.summon_id,
            via: 'architect_bridge',
            team: true,
          }, m);
        }
      }

      if (Auth?.user && this.wantsComposer(m) && build) {
        const q = await this.queueCoder(m, 'composer');
        GlobeDeck?.setThinking(false);
        if (q.text && !q.error) {
          return this._applyResponse({ ...q, label: q.label || 'Astranov Coders', team: true }, m);
        }
      }

      if (this.isPing(m)) {
        void AciCli.api({
          mode: 'coders_chat',
          message: m,
          fast: true,
          history: this.history.slice(-4),
          fallback_prefs: this.fallbackPrefs,
        }, { timeoutMs: 12000 }).catch(() => {});
        GlobeDeck?.setThinking(false);
        const pingReply = this.localReply(m);
        if (window._handsFreeVoice && Voice?.shouldSpeak?.(pingReply)) {
          speak(pingReply.slice(0, 100), () => resumeListening?.(), false);
        }
        return this._applyResponse({ text: pingReply, via: 'local/ping' }, m);
      }

      // Free tier first — server may paid-fallback for architect only after limit
      const grokPrefs = this.freeTierPrefs();
      let r = await AciCli.api({
        mode: 'coders_chat',
        message: m,
        fast: true,
        history: this.history.slice(-8),
        fallback_prefs: grokPrefs,
      }, { timeoutMs: GlobeDeck?._isMobileDeck?.() ? 32000 : 38000 });

      let text = String(r.text || r.response || '').trim();
      if (this.isFailedReply(text)) text = '';
      if (r.error || !text) {
        const fb = await AciCli.api({
          mode: 'coders',
          task: m,
          coder_engine: 'fallback',
          fallback: true,
          fallback_prefs: { force: 'groq', skip: ['xai'] },
          history: this.history.slice(-4),
        }, { timeoutMs: 22000 });
        const fbText = String(fb.text || fb.response || '').trim();
        if (fbText && !this.isFailedReply(fbText)) {
          GlobeDeck?.setThinking(false);
          return this._applyResponse({ ...fb, text: fbText, team: true, via: fb.via || 'coder/groq' }, m);
        }
        if (Auth?.user && build) {
          const q = await this.queueCoder(m, 'grok');
          if (q.text && !q.error && !this.isFailedReply(q.text)) {
            GlobeDeck?.setThinking(false);
            return this._applyResponse({ ...q, text: q.text, team: true }, m);
          }
        }
        if (r.error && !text) {
          GlobeDeck?.setThinking(false);
          return this._applyResponse({ text: this.localReply(m), via: 'local/fallback' }, m);
        }
        text = this.localReply(m);
        r = { ...r, text, response: text, via: 'local' };
      }

      if (Auth?.user && build && !r.summon_id) {
        // Prefer Architect Bridge for architect (Grok Build); Composer only when forced
        if (this.isArchitect() && !this.wantsComposer(m)) {
          const br = await ArchitectBridge?.queueBuildFromChat?.(m, { kind: 'fix' }).catch(() => null);
          if (br?.summon_id) {
            r.summon_id = br.summon_id;
            r.bridge = true;
            r.bridge_id = br.summon_id;
            const note = 'Bridge #' + br.summon_id + ' → Grok Build (desktop). Reply returns in this chat.';
            r.text = (r.text ? r.text + '\n\n' : '') + note;
            r.response = r.text;
          }
        } else {
          const q = await this.queueCoder(m, this.wantsComposer(m) ? 'composer' : 'grok');
          if (q.summon_id) {
            r.summon_id = q.summon_id;
            r.composer_queued = q.composer_queued;
            if (!r.text && q.text) { r.text = q.text; r.response = q.text; }
          }
        }
      }

      return this._guaranteeReply(m, r);
    } catch (e) {
      const msg = String(e.message || e);
      GlobeDeck?.showError('Coders failed: ' + msg);
      if (Auth?.user && build) {
        const q = await this.queueCoder(m, 'grok').catch(() => ({}));
        if (q.text) return this._guaranteeReply(m, { ...q, team: true });
      }
      return this._guaranteeReply(m, { error: msg, via: 'local/error' });
    } finally {
      if (this._chatWatchdog) { clearTimeout(this._chatWatchdog); this._chatWatchdog = null; }
      this._cliBusy = false;
      GlobeDeck?.setThinking?.(false);
    }
  },

  async handleCodersCommand(rest, opts = {}) {
    const msg = String(rest || '').trim();
    if (!msg || /^coders?$/i.test(msg)) {
      return this.enterSession({
        ping: !!this._sessionWelcomed,
        fromVoice: !!opts.fromVoice || !!window._handsFreeVoice || !!voiceSessionActive,
      });
    }
    return this.handleMessage(msg, opts);
  },

  async openTeam(intro) {
    await this.autoStart();
    const msg = intro && intro.trim().length > 0 ? intro.trim() : 'online';
    return this.chat(msg);
  },

  async summon(task) {
    return this.chat(task);
  },
};
window.AciCoders = AciCoders;

/* === 47-globe-entities.js === */
// === GLOBE ENTITIES — every map thing has a name, proximity label, tap action ===
const GlobeEntity = {
  entities: new Map(),
  _labelRoot: null,
  _selected: null,
  _hud: null,
  _clustered: new Set(),
  _clusterIds: new Set(),
  OLYMPUS_BLUE: 0x0a2d6b,
  OLYMPUS_GLOW: 0x1565c0,

  TYPES: {
    vendor: { color: 0x3d9eff, icon: '🏬', label: 'Shop' },
    driver: { color: 0x1a6fd4, icon: '🚚', label: 'Driver' },
    friend: { color: 0x3d9eff, icon: '👤', label: 'Friend' },
    post: { color: 0x1a6fd4, icon: '▶', label: 'Post' },
    me: { color: 0x3d9eff, icon: '📍', label: 'You' },
    news: { color: 0x1a6fd4, icon: '📰', label: 'News' },
    order: { color: 0x3d9eff, icon: '🛒', label: 'Order' },
    media: { color: 0x1a6fd4, icon: '🎬', label: 'Media' },
    pilot: { color: 0x3d9eff, icon: '🛸', label: 'Delivery' },
    place: { color: 0x1a6fd4, icon: '◎', label: 'Place' },
    unit: { color: 0xffaa33, icon: '⚔', label: 'Unit' },
    drone: { color: 0x44ccff, icon: '🛸', label: 'Drone' },
    spy: { color: 0xaa44ff, icon: '🕵', label: 'Spy' },
    pyramid: { color: 0xffdd44, icon: '🔺', label: 'Pyramid' },
    cluster: { color: 0x3d9eff, icon: '☁', label: 'Cloud' },
    yacht: { color: 0x69f5d0, icon: '⛵', label: 'Yacht' },
  },

  CLUSTER_TYPES: new Set(['post', 'place', 'media', 'news']),
  CLUSTER_MIN: 2,

  init() {
    this._labelRoot = document.getElementById('globe-entity-labels');
    this._hud = document.getElementById('globe-entity-hud');
    document.getElementById('ge-hud-close')?.addEventListener('click', () => MapPlaceMenu?.close?.() || this.clearSelection());
    document.getElementById('ge-hud-action')?.addEventListener('click', () => this._runSelectedAction());
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  _worldPos(lat, lng, r) {
    const p = latLngToPos(lat, lng, r || 1.028);
    const v = new THREE.Vector3(p.x, p.y, p.z);
    globePivot.localToWorld(v);
    return v;
  },

  _project(world) {
    const v = world.clone();
    v.project(camera);
    return {
      x: (v.x * 0.5 + 0.5) * window.innerWidth,
      y: (-v.y * 0.5 + 0.5) * window.innerHeight,
      behind: v.z > 1,
      depth: v.z,
    };
  },

  _urgencyClass(u) {
    return 'ge-urg-' + Math.min(3, Math.max(0, u | 0));
  },

  isGlobalView() {
    const z = camera?.position?.z ?? 2.55;
    return z >= ((GlobeControl?.Z?.global || 2.55) - 0.12);
  },

  cellKey(lat, lng) {
    const z = camera?.position?.z ?? 2.55;
    const deg = z >= 3.5 ? 3.5 : z >= 2.55 ? 2.0 : z >= 1.82 ? 0.8 : 0.35;
    return Math.round(lat / deg) + ':' + Math.round(lng / deg);
  },

  _isOlympian(opts, entity) {
    const u = opts?.data?.user || entity?.data?.user;
    return !!(opts?.olympian || u?.agent === 'grok-heavy' || (u?.team === 'blue' && u?.demo));
  },

  register(opts) {
    const id = opts.id || ('ge-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6));
    const type = opts.type || 'place';
    const meta = this.TYPES[type] || this.TYPES.place;
    const lat = opts.lat, lng = opts.lng;
    if (lat == null || lng == null) return null;

    this.unregister(id);

    const olympian = this._isOlympian(opts);
    const urgency = opts.urgency != null ? opts.urgency : (olympian ? 2 : type === 'driver' ? 2 : type === 'me' ? 2 : 1);
    const color = opts.color || (olympian ? this.OLYMPUS_BLUE : meta.color);
    const r = opts.radius || (type === 'me' ? 0.028 : type === 'vendor' ? 0.016 : 0.014);

    const group = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(r, 10, 10),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(r * 1.1, r * 1.65, 24),
      new THREE.MeshBasicMaterial({
        color: olympian ? this.OLYMPUS_GLOW : color,
        transparent: true,
        opacity: urgency >= 2 ? 0.55 : 0.28,
        side: THREE.DoubleSide,
      })
    );
    ring.lookAt(0, 0, 0);
    group.add(ring);
    group.add(core);
    if (olympian || opts.flag) {
      const flag = new THREE.Mesh(
        new THREE.PlaneGeometry(r * 1.8, r * 1.1, 1, 1),
        new THREE.MeshBasicMaterial({
          color: this.OLYMPUS_GLOW,
          transparent: true,
          opacity: 0.88,
          side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        })
      );
      flag.position.set(r * 1.4, r * 0.8, 0);
      flag.lookAt(0, 0, 0);
      group.add(flag);
      group.userData.olympianFlag = true;
    }

    const pos = latLngToPos(lat, lng, opts.altitude || 1.028);
    group.position.set(pos.x, pos.y, pos.z);
    group.lookAt(0, 0, 0);

    const entity = {
      id, type, lat, lng, title: opts.title || meta.label,
      description: opts.description || '',
      urgency, color, icon: opts.icon || meta.icon,
      persist: opts.persist !== false,
      expires: opts.expires || 0,
      born: Date.now(),
      data: opts.data || {},
      onTap: opts.onTap || null,
      mesh: group,
      ring,
      core,
      _revealed: false,
      _labelEl: null,
    };

    group.userData = { globeEntity: id, type, title: entity.title, lat, lng };
    globePivot.add(group);

    const label = document.createElement('div');
    label.className = 'ge-label ' + this._urgencyClass(urgency) + ' ge-type-' + type + (olympian ? ' ge-olympian' : '');
    label.dataset.id = id;
    const pin = entity.data?.travelTo
      ? ('<div class="ge-travel-arrow" style="transform:rotate(' + (entity.data.travelBearing || 0) + 'deg)">➤</div>')
      : olympian
      ? ('<div class="ge-pin ge-olymp-flag">🏳️</div><div class="ge-pin">' + this.esc(entity.icon) + '</div>')
      : ('<div class="ge-pin">' + this.esc(entity.icon) + '</div>');
    label.innerHTML = pin
      + '<div class="ge-text"><b>' + this.esc(entity.title) + '</b>'
      + '<span>' + this.esc(entity.description) + '</span></div>';
    if (entity.data?.alwaysShowLabel) label.classList.add('ge-travel-label');
    label.style.display = 'none';
    label.addEventListener('click', ev => {
      ev.stopPropagation();
      this.activate(entity);
    });
    this._labelRoot?.appendChild(label);
    entity._labelEl = label;

    this.entities.set(id, entity);
    return entity;
  },

  unregister(id) {
    const e = this.entities.get(id);
    if (!e) return;
    if (e.mesh?.parent) e.mesh.parent.remove(e.mesh);
    if (e._labelEl?.parentNode) e._labelEl.parentNode.removeChild(e._labelEl);
    if (this._selected === id) this.clearSelection();
    this.entities.delete(id);
  },

  unregisterType(type) {
    [...this.entities.values()].filter(e => e.type === type).forEach(e => this.unregister(e.id));
  },

  registerTemp(opts) {
    return this.register({ ...opts, persist: false, expires: opts.expires || 12000 });
  },

  _proximity(entity) {
    const world = this._worldPos(entity.lat, entity.lng, 1.03);
    const camPos = camera.position.clone();
    const toEnt = world.clone().sub(camPos).normalize();
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion).normalize();
    const dot = look.dot(toEnt);
    const z = camera.position.z;
    const zoomNear = Math.max(0, Math.min(1, (2.45 - z) / 1.35));
    const u = entity.urgency;
    const thresh = 0.94 - u * 0.12 - zoomNear * 0.22;
    const show = dot > thresh && !this._project(world).behind;
    const flash = u >= 3 && dot > 0.45;
    const glow = u >= 2 && show;
    return { show, flash, glow, dot, zoomNear, world };
  },

  _scavengeView(entity, reason) {
    if (!entity._revealed && reason === 'proximity') {
      entity._revealed = true;
      FieldBrain?.pulse?.('explore', 'saw:' + entity.type + ':' + entity.title.slice(0, 60), {
        role: 'client',
        props: { entity_id: entity.id, type: entity.type, urgency: entity.urgency, lat: entity.lat, lng: entity.lng },
      });
      AciCoders?.observeActivity?.('entity_view', entity.type + ':' + entity.title.slice(0, 80));
    }
    if (reason === 'tap') {
      FieldBrain?.pulse?.('explore', 'tap:' + entity.type + ':' + entity.title.slice(0, 60), {
        role: 'client',
        props: { entity_id: entity.id, type: entity.type, action: true },
      });
      AciCoders?.observeActivity?.('entity_tap', entity.type + ':' + entity.title.slice(0, 80));
    }
  },

  select(entity) {
    this._selected = entity.id;
    const hud = this._hud;
    if (!hud) return;
    MapPlaceMenu?._showPlaceMenu?.(false);
    hud.classList.add('open');
    document.getElementById('ge-hud-type').textContent = (entity.icon || '') + ' ' + (this.TYPES[entity.type]?.label || entity.type);
    document.getElementById('ge-hud-title').textContent = entity.title;
    document.getElementById('ge-hud-desc').textContent = entity.description || 'Tap action below';
    const btn = document.getElementById('ge-hud-action');
    if (btn) btn.textContent = entity._actionLabel || this._defaultActionLabel(entity);
    GlobeDeck?.setPreview?.(entity.icon + ' ' + entity.title + ' — ' + (entity.description || '').slice(0, 50));
    AciCli?.print('◎ ' + entity.title + ' · ' + (entity.description || entity.type), 'map');
  },

  clearSelection() {
    this._selected = null;
    this._hud?.classList.remove('open');
  },

  flyTo(entity, targetZ) {
    if (targetZ == null) targetZ = GlobeControl?.Z?.national || 1.82;
    if (!entity || entity.lat == null) return;
    window._globeFly = null;
    const fp = latLngToPos(entity.lat, entity.lng, 1.04);
    if (typeof flyToPoint === 'function') flyToPoint(new THREE.Vector3(fp.x, fp.y, fp.z), targetZ);
    GlobeControl?.noteAutoFly?.();
    MapDepict?.pulse?.(entity.lat, entity.lng, 0x00ddff, entity.title || 'here', 7000);
    GlobeDeck?.setPreview?.('◎ ' + (entity.title || 'location'));
  },

  _defaultActionLabel(entity) {
    const map = {
      vendor: 'Open shop menu',
      driver: 'Request delivery',
      friend: 'Fly here',
      post: 'Watch / read',
      me: 'Zoom to me',
      news: 'Read news',
      order: 'View order',
      media: 'Play media',
      pilot: 'Track delivery',
      place: 'Go here',
      yacht: 'Book charter',
    };
    return map[entity.type] || 'Interact';
  },

  _runSelectedAction() {
    const e = this.entities.get(this._selected);
    if (e) this.activate(e);
  },

  activate(entity) {
    this._scavengeView(entity, 'tap');
    this.select(entity);
    if (entity.onTap) {
      entity.onTap(entity);
      return;
    }
    if (entity.onAction) {
      entity.onAction(entity);
      return;
    }
    if (entity.data?.url || entity.subtitle?.includes('.astranov.eu')) {
      const url = entity.data?.url || ('https://' + entity.subtitle);
      if (window.AstranovSiteShell?.open) {
        AstranovSiteShell.open(url, { domain: entity.subtitle, title: entity.title });
        return;
      }
    }
    this._defaultTap(entity);
  },

  _defaultTap(entity) {
    const fp = latLngToPos(entity.lat, entity.lng, 1.04);
    const z = entity.type === 'vendor' ? (GlobeControl?.Z?.regional || 1.65) : (GlobeControl?.Z?.national || 1.82);
    flyToPoint?.(new THREE.Vector3(fp.x, fp.y, fp.z), z);
    GlobeControl?.noteAutoFly?.();

    switch (entity.type) {
      case 'vendor':
        if (entity.data?.vendor) ProfileSite?.openVendor?.(entity.data.vendor);
        else window.Commerce?.showPicker?.();
        break;
      case 'driver':
        if (entity.data?.driver?.id) MarketplaceComms?.selectDriver?.(entity.data.driver.id, entity.data.driver);
        else ACIControl?.reply('Driver ' + entity.title + ' — pick for delivery');
        break;
      case 'friend':
        if (entity.data?.user) {
          ProfileSite?.openUser?.(entity.data.user.id);
          MapComms?.contactMenu?.(entity.data.user);
        } else ACIControl?.reply(entity.title + ' on the map — tap contact options');
        break;
      case 'cluster':
        this._openCluster(entity);
        break;
      case 'post':
      case 'media':
        if (entity.data?.youtubeId || entity.data?.url) {
          const yt = entity.data.youtubeId || GlobeVideo?.parseId?.(entity.data.url);
          if (yt) {
            MapComms?.showCloudVideo?.(yt, entity.title);
            LazyModules?.ensure?.().then(() =>
              GlobeVideo?.play?.(yt, { title: entity.title }, entity.title)
            );
          } else if (entity.data?.url) {
            window.open(entity.data.url, '_blank', 'noopener');
          }
        } else {
          ACIControl?.reply(entity.description || entity.title);
        }
        break;
      case 'me':
        this.flyTo(entity, GlobeControl?.Z?.global || 2.55);
        ACIControl?.reply('On globe — zoom in or say city view for shops');
        break;
      case 'news':
        NewsFeed?.flash?.();
        break;
      case 'yacht':
        if (entity.data?.yacht) YachtMatcher?.openBooking?.(entity.data.yacht);
        else YachtMatcher?.openBooking?.(null, { tab: 'booker' });
        break;
      default:
        ACIControl?.reply(entity.title + (entity.description ? ' — ' + entity.description : ''));
    }
  },

  pickFromHit(object) {
    let o = object;
    for (let i = 0; i < 6 && o; i++) {
      if (o.userData?.globeEntity) return this.entities.get(o.userData.globeEntity);
      if (o.userData?.vendor) {
        const v = o.userData.vendor;
        return [...this.entities.values()].find(e => e.type === 'vendor' && e.data?.vendor?.id === v.id)
          || this.register({
            id: 'vendor-' + v.id, type: 'vendor', lat: v.lat, lng: v.lng,
            title: v.name, description: (v.category || 'shop') + ' · tap to order',
            data: { vendor: v },
            onTap: () => window.Commerce?.openVendor?.(v),
          });
      }
      if (o.userData?.driver) {
        const d = o.userData.driver;
        return [...this.entities.values()].find(e => e.type === 'driver' && e.data?.driver?.id === d.id);
      }
      if (o.userData?.type === 'post') {
        return [...this.entities.values()].find(e => e.type === 'post' && e.title === o.userData.label);
      }
      if (o.userData?.type === 'me') {
        return [...this.entities.values()].find(e => e.type === 'me');
      }
      if (o.userData?.name && o.userData?.lat != null) {
        return [...this.entities.values()].find(e => e.title === o.userData.name);
      }
      o = o.parent;
    }
    return null;
  },

  clickTargets() {
    const list = [];
    this.entities.forEach(e => { if (e.mesh) list.push(e.mesh); });
    return list;
  },

  _applyGlobalClusters() {
    const global = this.isGlobalView();
    if (!global) {
      if (this._clusterIds.size || this._clustered.size) {
        this._clusterIds.forEach((id) => this.unregister(id));
        this._clusterIds.clear();
        this._clustered.forEach((id) => {
          const e = this.entities.get(id);
          if (e?.mesh) e.mesh.visible = true;
          if (e?._labelEl) e._labelEl.style.visibility = '';
        });
        this._clustered.clear();
      }
      return;
    }

    const buckets = new Map();
    this.entities.forEach((entity, id) => {
      if (this._clusterIds.has(id) || entity.type === 'me' || entity.type === 'cluster') return;
      if (!this.CLUSTER_TYPES.has(entity.type) && !(entity.type === 'friend' && entity.data?.user?.demo)) return;
      const key = this.cellKey(entity.lat, entity.lng);
      const b = buckets.get(key) || { key, members: [], lat: 0, lng: 0, videos: [] };
      b.members.push(entity);
      b.lat += entity.lat;
      b.lng += entity.lng;
      const url = entity.data?.url || entity.data?.post?.url;
      const yt = GlobeVideo?.parseId?.(url);
      if (yt) b.videos.push({ id: yt, title: entity.title });
      buckets.set(key, b);
    });

    const nextClustered = new Set();
    const nextClusterIds = new Set();

    buckets.forEach((b) => {
      if (b.members.length < this.CLUSTER_MIN) return;
      const lat = b.lat / b.members.length;
      const lng = b.lng / b.members.length;
      const id = 'cluster-' + b.key;
      nextClusterIds.add(id);
      b.members.forEach((m) => {
        nextClustered.add(m.id);
        if (m.mesh) m.mesh.visible = false;
        if (m._labelEl) m._labelEl.style.display = 'none';
      });
      const vid = b.videos[0];
      const desc = b.members.length + ' signals'
        + (b.videos.length ? ' · ' + b.videos.length + ' video' : '')
        + ' · tap cloud';
      const existing = this.entities.get(id);
      if (existing) {
        existing.lat = lat;
        existing.lng = lng;
        existing.title = '☁ ' + b.members.length;
        existing.description = desc;
        existing.data.members = b.members;
        existing.data.youtubeId = vid?.id;
        const cp = latLngToPos(lat, lng, 1.028);
        if (existing.mesh) {
          existing.mesh.position.set(cp.x, cp.y, cp.z);
          existing.mesh.lookAt(0, 0, 0);
        }
        if (existing._labelEl) {
          const tb = existing._labelEl.querySelector('.ge-text b');
          const ts = existing._labelEl.querySelector('.ge-text span');
          if (tb) tb.textContent = existing.title;
          if (ts) ts.textContent = desc;
        }
      } else {
        this.register({
          id,
          type: 'cluster',
          lat,
          lng,
          title: '☁ ' + b.members.length,
          description: desc,
          urgency: b.videos.length ? 3 : 2,
          icon: '☁',
          persist: true,
          data: { members: b.members, youtubeId: vid?.id, clusterKey: b.key },
          onTap: (e) => this._openCluster(e),
        });
      }
    });

    this._clustered.forEach((id) => {
      if (!nextClustered.has(id)) {
        const e = this.entities.get(id);
        if (e?.mesh) e.mesh.visible = true;
        if (e?._labelEl) e._labelEl.style.visibility = '';
      }
    });
    this._clusterIds.forEach((id) => {
      if (!nextClusterIds.has(id)) this.unregister(id);
    });
    this._clustered = nextClustered;
    this._clusterIds = nextClusterIds;
  },

  _openCluster(entity) {
    const members = entity.data?.members || [];
    const yt = entity.data?.youtubeId;
    if (yt) MapComms?.showCloudVideo?.(yt, entity.title);
    if (members.length === 1 && members[0].onTap) {
      members[0].onTap(members[0]);
      return;
    }
    this.select(entity);
    const lines = members.slice(0, 8).map((m) => m.icon + ' ' + m.title).join(' · ');
    ACIControl?.reply('Cloud · ' + members.length + ' — ' + lines);
    if (GlobeControl?.Z?.national) {
      const fp = latLngToPos(entity.lat, entity.lng, 1.04);
      flyToPoint?.(new THREE.Vector3(fp.x, fp.y, fp.z), GlobeControl.Z.national);
      GlobeControl?.noteAutoFly?.();
    }
  },

  tick() {
    const now = Date.now();
    if (!this._tickLast) this._tickLast = 0;
    if (document.hidden) return;
    if (!SlumberManager?.allows?.('entities')) return;
    const minGap = SlumberManager?.tickMs?.('entity') || (window._voicePerfMode || window._globePerfLite ? 520 : 200);
    if (now - this._tickLast < minGap) return;
    this._tickLast = now;
    if (!this._clusterLast || now - this._clusterLast > 500) {
      this._clusterLast = now;
      this._applyGlobalClusters();
    }
    const toRemove = [];

    this.entities.forEach((entity, id) => {
      if (this._clustered.has(id)) return;
      if (!entity.persist && entity.expires && now - entity.born > entity.expires) {
        toRemove.push(id);
        return;
      }

      const prox = this._proximity(entity);
      // alwaysShowLabel: rotating globe tiles (video/info/me) stay visible when facing camera
      const forceShow = !!(entity.data?.alwaysShowLabel || entity.data?.pinVideo || entity.data?.infoTile);
      const el = entity._labelEl;
      if (el) {
        if (prox.show || (forceShow && !prox.behind && prox.dot > 0.05)) {
          const scr = this._project(prox.world);
          if (!scr.behind) {
            el.style.display = 'flex';
            el.style.left = scr.x + 'px';
            el.style.top = (scr.y - 8) + 'px';
            el.classList.toggle('ge-flash', prox.flash || !!entity.data?.pinVideo);
            el.classList.toggle('ge-glow', prox.glow || forceShow);
            el.classList.toggle('ge-selected', this._selected === id);
            if (!entity._revealed) this._scavengeView(entity, 'proximity');
          } else {
            el.style.display = 'none';
          }
        } else {
          el.style.display = 'none';
          el.classList.remove('ge-flash', 'ge-glow', 'ge-selected');
        }
      }

      if (entity.ring) {
        const pulse = prox.glow || forceShow ? 0.45 + Math.sin(now / 280) * 0.25 : 0.2;
        entity.ring.material.opacity = prox.flash ? 0.65 + Math.sin(now / 180) * 0.35 : pulse;
        entity.ring.visible = prox.show || entity.urgency >= 2 || forceShow;
      }
      if (entity.core && prox.flash) {
        const s = 1 + Math.sin(now / 200) * 0.18;
        entity.core.scale.set(s, s, s);
      }
    });

    toRemove.forEach(id => this.unregister(id));
  },

  // ── Adapters for existing systems ──

  syncYachts(yachts) {
    this.unregisterType('yacht');
    const ym = window.YachtMatcher;
    (yachts || []).forEach((y, i) => {
      const c = ym?.coordsFor?.(y, i) || [36.44, 28.22];
      const lat = c[0];
      const lng = c[1];
      const minC = ym?._engine?.()?.effectiveMinimumCrew?.(y) ?? y.minimum_crew ?? 3;
      this.register({
        id: 'yacht-' + y.id,
        type: 'yacht',
        lat,
        lng,
        title: '⛵ ' + (y.name || 'Yacht'),
        subtitle: 'yachts.astranov.eu',
        description: (y.yacht_type || 'Yacht') + (y.length_m ? ' · ' + y.length_m + 'm' : '')
          + ' · ' + (y.guest_capacity || '?') + ' guests · min crew ' + minC
          + (y.price_week ? ' · ' + Number(y.price_week).toLocaleString() + ' EUR/wk' : '')
          + ' · tap to book',
        urgency: i === 0 ? 2 : 1,
        radius: 0.018,
        data: { yacht: y, url: ym?.bookingUrl?.(y, { tab: 'booker' }) },
        _actionLabel: 'Book ' + (y.name || 'yacht'),
        onTap: () => ym?.openBooking?.(y, { tab: 'booker' }),
      });
    });
  },

  syncVendors(vendors) {
    this.unregisterType('vendor');
    (vendors || []).forEach((v, i) => {
      if (v.lat == null) return;
      const km = window.Commerce?.haversineKm?.(window.Commerce.userLatLng().lat, window.Commerce.userLatLng().lng, v.lat, v.lng);
      const menu = window.Commerce?.menuFor?.(v)?.length || 0;
      this.register({
        id: 'vendor-' + v.id,
        type: 'vendor',
        lat: v.lat,
        lng: v.lng,
        title: v.name,
        description: (menu ? menu + ' items' : 'menu on request') + (km != null ? ' · ' + km.toFixed(1) + ' km' : '') + ' · tap to order',
        urgency: i === 0 ? 2 : 1,
        data: { vendor: v },
        _actionLabel: 'Open ' + v.name,
        onTap: () => window.Commerce?.openVendor?.(v),
      });
    });
  },

  syncDrivers(drivers) {
    this.unregisterType('driver');
    (drivers || []).forEach((d, i) => {
      if (d.field_lat == null) return;
      const km = window.Commerce?.haversineKm?.(window.Commerce.userLatLng().lat, window.Commerce.userLatLng().lng, d.field_lat, d.field_lng);
      this.register({
        id: 'driver-' + d.id,
        type: 'driver',
        lat: d.field_lat,
        lng: d.field_lng,
        title: d.display_name || 'Driver',
        description: 'Available · ' + (km != null ? km.toFixed(1) + ' km' : 'nearby') + ' · tap to assign',
        urgency: 2,
        data: { driver: d },
        _actionLabel: 'Assign ' + (d.display_name || 'driver'),
        onTap: (e) => {
          const driverId = e.data?.driver?.id;
          if (driverId && MarketplaceComms?.selectDriver) {
            MarketplaceComms.selectDriver(driverId, e.data?.driver);
          } else {
            ACIControl?.reply('Driver ' + e.title + ' — order first, then pick driver');
          }
        },
      });
    });
  },

  syncFriends(others, opts) {
    opts = opts || {};
    this.unregisterType('friend');
    (others || []).forEach(u => {
      const isRed = u.team === 'red' || (opts.teamMode && u.team === 'red');
      const isOlympian = u.agent === 'grok-heavy' || (u.team === 'blue' && u.demo);
      const fed = !!u.fed;
      const agentTag = u.agent === 'cronian' ? 'Cronian titan' : isOlympian ? 'Grok Heavy agent' : '';
      this.register({
        id: 'friend-' + u.id,
        type: 'friend',
        lat: u.lat,
        lng: u.lng,
        title: (u.emoji || (isRed ? '🔴' : '👤')) + ' ' + u.name,
        description: u.domain
          ? (u.domain + (agentTag ? ' · ' + agentTag : ''))
          : isRed
          ? (fed ? 'RED · fed ✓ · blue team won slice' : 'RED rival · deliver pitogyro/beer/burger/tsigareta')
          : 'Player on map · tap to fly here · collab or κρυφτό',
        urgency: isRed && !fed ? 3 : isOlympian ? 2 : 1,
        color: isRed ? (fed ? 0x884444 : 0xff2244) : isOlympian ? this.OLYMPUS_BLUE : undefined,
        olympian: isOlympian,
        flag: isOlympian,
        data: { user: u },
        onTap: (e) => {
          if (isRed && !fed) {
            TelemachosPilot?.deliverToRed?.(u.id, 'pitogyra');
            return;
          }
          MapComms?.contactMenu?.(u);
          const p = latLngToPos(e.lat, e.lng, 1.04);
          flyToPoint?.(new THREE.Vector3(p.x, p.y, p.z), GlobeControl?.Z?.national || 1.82);
        },
        _actionLabel: isRed && !fed ? 'Deliver pitogyra' : 'Contact',
      });
    });
  },

  syncMe(lat, lng, name, opts) {
    opts = opts || {};
    this.unregisterType('me');
    let desc = 'Your location · tap to zoom here';
    if (opts.travelTo) {
      desc = '→ ' + opts.travelTo + (opts.travelUser ? ' · ' + opts.travelUser : '')
        + ' · ' + (opts.distKm || '?') + ' km · ' + (opts.speedKmh || 820) + ' km/h';
    }
    this.register({
      id: 'me',
      type: 'me',
      lat,
      lng,
      title: opts.travelTo ? ('→ ' + opts.travelTo) : (name || 'You'),
      description: desc,
      urgency: opts.travelTo ? 3 : 2,
      persist: true,
      data: {
        alwaysShowLabel: !!opts.alwaysShow,
        travelBearing: opts.bearing,
        travelTo: opts.travelTo,
      },
      _actionLabel: 'Zoom to me',
      onTap: (e) => {
        const flyHere = (lat, lng) => {
          if (lat == null) { this.flyTo(e, GlobeControl?.Z?.global || 2.55); return; }
          placeMe(lat, lng, { fly: true, zoom: GlobeControl?.Z?.global || 2.55, quiet: false });
        };
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            pos => flyHere(pos.coords.latitude, pos.coords.longitude),
            () => flyHere(e.lat, e.lng),
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 20000 }
          );
        } else {
          flyHere(e.lat, e.lng);
        }
        ACIControl?.reply(opts.travelTo
          ? 'En route → ' + opts.travelTo + ' · real location private'
          : 'Flying to you — zoom in or say city view for shops');
      },
    });
  },

  syncPost(p) {
    if (p.lat == null) return;
    const id = 'post-' + (p.id || p.lat + '-' + p.lng);
    this.register({
      id,
      type: 'post',
      lat: p.lat,
      lng: p.lng,
      title: (p.text || p.author || 'Post').slice(0, 48),
      description: (p.channel || 'global') + (p.mode === 'video' ? ' · video' : '') + ' · tap to open',
      urgency: p.mode === 'video' ? 2 : 1,
      data: { url: p.url, channel: p.channel, post: p },
      _actionLabel: p.url ? 'Play video' : 'Read post',
      onTap: (e) => {
        if (e.data?.url) GlobeVideo?.play?.(e.data.url, { title: e.title }, e.title);
        else ACIControl?.reply(e.description);
      },
    });
  },
};
window.GlobeEntity = GlobeEntity;

/* === 73-spacenet-brain.js === */
// === SPACENET BRAIN — intent + multi-crawler mesh for city/globe ingestion ===
const SpaceNetBrain = {
  _crawlBusy: new Set(),
  _lastClassify: null,
  _sectorCache: new Map(),
  _lastMulti: 0,

  ACTION_IDS: ['list_vendor', 'list_shop', 'driver_base', 'post', 'upload_photo', 'upload_video', 'deliver_here', 'drive_here', 'route', 'explore', 'order'],

  CRAWLERS: ['vendors', 'places', 'weather', 'news', 'drivers', 'tasks'],

  async classifyIntent(text, ctx) {
    ctx = ctx || {};
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      return {
        primary: ClassifiedTriangles.defaultTop3(),
        more: ClassifiedTriangles.defaultMore(),
        source: 'default',
      };
    }

    const local = ClassifiedTriangles.scoreLocal(trimmed);
    const primary = local.slice(0, 3);
    const more = local.slice(3);

    void this._refineWithAi(trimmed, ctx, local);

    if (ctx.lat != null && ctx.lng != null) {
      void this.crawlAll(ctx.lat, ctx.lng, ctx.radiusKm || 2);
    }

    this._lastClassify = { text: trimmed, primary, more, at: Date.now() };
    return { primary, more, source: 'local' };
  },

  async _refineWithAi(text, ctx, localHints) {
    const ids = this.ACTION_IDS.join(', ');
    const prompt = 'SpaceNet place intent at ' + (ctx.lat?.toFixed?.(4) || '?') + ',' + (ctx.lng?.toFixed?.(4) || '?')
      + ': "' + text + '". Reply with ONLY a JSON array of action ids (max 6) from: ' + ids
      + '. First 3 = most common for this intent.';
    const r = await AiRouter?.ask?.(prompt, { timeoutMs: 14000 });
    const raw = String(r?.text || r?.raw?.text || '').trim();
    const parsed = this._parseActionIds(raw);
    if (!parsed.length) return;
    const catalog = ClassifiedTriangles.CATALOG;
    const ordered = parsed.map(id => catalog.find(c => c.id === id)).filter(Boolean);
    const rest = catalog.filter(c => !ordered.find(o => o.id === c.id));
    const full = ordered.concat(rest);
    ClassifiedTriangles.render(full.slice(0, 3), full.slice(3), ctx.pin);
    this._lastClassify = { text, primary: full.slice(0, 3), more: full.slice(3), source: 'ai' };
  },

  _parseActionIds(raw) {
    try {
      const m = raw.match(/\[[\s\S]*?\]/);
      if (m) {
        const arr = JSON.parse(m[0]);
        if (Array.isArray(arr)) return arr.map(String).filter(id => this.ACTION_IDS.includes(id));
      }
    } catch (_) {}
    const found = [];
    for (const id of this.ACTION_IDS) {
      if (new RegExp(id.replace(/_/g, '[\\s_-]+'), 'i').test(raw)) found.push(id);
    }
    return found;
  },

  _headers() {
    const h = { 'Content-Type': 'application/json' };
    if (typeof SB_KEY !== 'undefined') h.apikey = SB_KEY;
    if (Auth?.session?.access_token) h.Authorization = 'Bearer ' + Auth.session.access_token;
    else if (typeof SB_KEY !== 'undefined') h.Authorization = 'Bearer ' + SB_KEY;
    return h;
  },

  /** Back-compat single sector crawl (vendors edge). */
  async crawlArea(lat, lng, radiusKm) {
    return this.crawlVendors(lat, lng, radiusKm);
  },

  async crawlVendors(lat, lng, radiusKm) {
    const key = 'v:' + lat.toFixed(3) + ',' + lng.toFixed(3);
    if (this._crawlBusy.has(key)) return { skipped: true };
    this._crawlBusy.add(key);
    try {
      const radius = Math.round((radiusKm || 2) * 1000);
      const body = {
        lat, lng,
        radius,
        radius_km: radiusKm || 2,
        source: 'spacenet-brain',
      };
      const r = await fetch((typeof SB_URL !== 'undefined' ? SB_URL : '') + '/functions/v1/vendor-crawler', {
        method: 'POST',
        headers: this._headers(),
        body: JSON.stringify(body),
      });
      const j = r.ok ? await r.json().catch(() => ({})) : {};
      this._sectorCache.set(key, { at: Date.now(), count: j.count || 0 });
      AciCli?.print?.('crawler · vendors · sector ' + key.slice(2) + (j.count != null ? ' · ' + j.count : ''), 'dim');
      // Refresh commerce markers if present
      if (j.count > 0) void window.Commerce?.loadVendors?.();
      return j;
    } catch (e) {
      AciCli?.print?.('crawler · vendors failed · local demo shops', 'dim');
      return { ok: false, error: String(e?.message || e) };
    } finally {
      setTimeout(() => this._crawlBusy.delete(key), 120000);
    }
  },

  /** Open-Meteo weather (CORS-friendly) for delivery surcharges / city HUD. */
  async crawlWeather(lat, lng) {
    const key = 'w:' + lat.toFixed(2) + ',' + lng.toFixed(2);
    if (this._crawlBusy.has(key)) return this._sectorCache.get(key)?.data;
    this._crawlBusy.add(key);
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat
        + '&longitude=' + lng + '&current=temperature_2m,weather_code,wind_speed_10m,precipitation';
      const r = await fetch(url);
      const j = await r.json();
      const cur = j.current || {};
      const data = {
        temp_c: cur.temperature_2m,
        wind: cur.wind_speed_10m,
        precip: cur.precipitation,
        code: cur.weather_code,
        at: Date.now(),
      };
      this._sectorCache.set(key, { at: Date.now(), data });
      window._spaceNetWeather = data;
      AciCli?.print?.('crawler · weather · ' + (data.temp_c ?? '?') + '°C · wind ' + (data.wind ?? '?'), 'dim');
      return data;
    } catch (_) {
      return null;
    } finally {
      setTimeout(() => this._crawlBusy.delete(key), 60000);
    }
  },

  /** Lightweight news tick for region (uses existing Comms if present). */
  async crawlNews(lat, lng) {
    try {
      Comms?.loadNews?.();
      NewsFeed?.flash?.();
      AciCli?.print?.('crawler · news · sector', 'dim');
      return { ok: true };
    } catch (_) {
      return { ok: false };
    }
  },

  /** Nearby drivers for delivery infrastructure. */
  async crawlDrivers(lat, lng) {
    try {
      await LazyModules?.ensure?.();
      const d = await window.Commerce?.fetchNearbyDrivers?.(lat, lng);
      if (d?.length) window.Commerce?.showDriversOnGlobe?.(d);
      AciCli?.print?.('crawler · drivers · ' + (d?.length || 0), 'dim');
      return { count: d?.length || 0, drivers: d || [] };
    } catch (_) {
      return { count: 0 };
    }
  },

  /** Places = vendors + city map refresh. */
  async crawlPlaces(lat, lng, radiusKm) {
    const v = await this.crawlVendors(lat, lng, radiusKm);
    try {
      CityMap?.refreshTiles?.(lat, lng);
      CityLife?._pulseFriends?.();
    } catch (_) {}
    return v;
  },

  /** Sync open city tasks onto globe. */
  async crawlTasks(lat, lng) {
    try {
      CityTasks?.init?.();
      const open = CityTasks?.list?.({ open: true }) || [];
      open.slice(0, 12).forEach(t => CityTasks?._showOnGlobe?.(t));
      AciCli?.print?.('crawler · tasks · open ' + open.length, 'dim');
      return { count: open.length };
    } catch (_) {
      return { count: 0 };
    }
  },

  /** Run all SpaceNet crawlers for a lat/lng sector. */
  async crawlAll(lat, lng, radiusKm, opts) {
    opts = opts || {};
    if (lat == null || lng == null) {
      const u = window._lastPos || { lat: 36.4341, lng: 28.2176 };
      lat = u.lat; lng = u.lng;
    }
    const key = 'all:' + lat.toFixed(3) + ',' + lng.toFixed(3);
    if (!opts.force && this._crawlBusy.has(key)) return { busy: true };
    if (!opts.force && Date.now() - this._lastMulti < 15000) return { throttled: true };
    this._crawlBusy.add(key);
    this._lastMulti = Date.now();
    FieldBrain?.pulse?.('think', 'spacenet crawl · sector', { lat, lng });
    const which = opts.only || this.CRAWLERS;
    const results = {};
    try {
      const jobs = [];
      if (which.includes('vendors') || which.includes('places')) {
        jobs.push(this.crawlPlaces(lat, lng, radiusKm || 2).then(r => { results.places = r; }));
      }
      if (which.includes('weather')) jobs.push(this.crawlWeather(lat, lng).then(r => { results.weather = r; }));
      if (which.includes('news')) jobs.push(this.crawlNews(lat, lng).then(r => { results.news = r; }));
      if (which.includes('drivers')) jobs.push(this.crawlDrivers(lat, lng).then(r => { results.drivers = r; }));
      if (which.includes('tasks')) jobs.push(this.crawlTasks(lat, lng).then(r => { results.tasks = r; }));
      await Promise.allSettled(jobs);
      // Pin crawl results as rotating globe info tiles (same UI as SpaceX video tiles)
      try {
        GlobeInfoTiles?.init?.();
        if (results.weather) GlobeInfoTiles.pinCrawlResult('weather', results.weather, lat, lng);
        if (results.drivers) GlobeInfoTiles.pinCrawlResult('drivers', results.drivers, lat, lng);
        if (results.places) GlobeInfoTiles.pinCrawlResult('places', results.places, lat, lng);
        GlobeInfoTiles.pinInfo({
          id: 'crawl-' + lat.toFixed(2) + '-' + lng.toFixed(2),
          lat, lng,
          title: 'SpaceNet · sector',
          description: Object.keys(results).join(' · ') || 'crawl',
          icon: '🕸',
          fly: false,
          urgency: 2,
        });
      } catch (_) {}
      AciCli?.print?.('spacenet · crawl done · ' + Object.keys(results).join(' · '), 'ok');
      CliRibbon?.setNotice?.('SpaceNet crawl · ' + Object.keys(results).length + ' feeds', 'ready');
      return { ok: true, results };
    } finally {
      setTimeout(() => this._crawlBusy.delete(key), 45000);
    }
  },

  wants(text) {
    return /spacenet|crawl(er|ers)?|ingest|scan\s*(city|area|sector)/i.test(String(text || ''));
  },

  async handleCli(line) {
    const low = String(line || '').toLowerCase();
    const u = window._lastPos || { lat: 36.4341, lng: 28.2176 };
    if (/weather/.test(low)) {
      const w = await this.crawlWeather(u.lat, u.lng);
      return w ? ('Weather · ' + w.temp_c + '°C · wind ' + w.wind) : 'weather crawl failed';
    }
    if (/driver/.test(low)) {
      const d = await this.crawlDrivers(u.lat, u.lng);
      return 'Drivers · ' + (d.count || 0);
    }
    if (/vendor|shop|place/.test(low)) {
      await this.crawlPlaces(u.lat, u.lng, 3);
      return 'Vendors/places crawled';
    }
    const r = await this.crawlAll(u.lat, u.lng, 3, { force: true });
    return r.ok ? 'SpaceNet crawlers finished' : 'crawl busy/throttled — retry';
  },
};
window.SpaceNetBrain = SpaceNetBrain;

/* === 54-ai-router.js === */
// === AI ROUTER — OpenAI Mini / Astranov Cycle / Groq / Gemini (shared with coder labs)
const AiRouter = {
  PROVIDERS: [
    { id: 'grok', label: 'Grok', short: 'GK' },
    { id: 'astranov', label: 'Cycle', short: 'AV' },
    { id: 'openai-mini', label: 'OpenAI', short: 'AI' },
    { id: 'groq', label: 'Groq', short: 'GQ' },
    { id: 'gemini', label: 'Gemini', short: 'GM' },
    { id: 'deepseek', label: 'DeepSeek', short: 'DS' },
  ],
  LAB_ENGINES: {
    main: 'grok',
    chatgpt: 'openai-mini',
    grok: 'astranov',
    gemini: 'gemini',
    deepseek: 'deepseek',
    claude: 'astranov',
    composer: 'astranov',
  },
  _provider: 'grok',
  _sessionId: null,

  init() {
    try {
      const saved = localStorage.getItem('astranov:ai-provider');
      // Default Grok (xAI) — only honor saved if still valid
      if (saved && this.PROVIDERS.some(p => p.id === saved)) this._provider = saved;
      else this._provider = 'grok';
    } catch (_) {
      this._provider = 'grok';
    }
    this._sessionId = this._loadSession();
    this._bindUi();
    this._syncUi();
  },

  _loadSession() {
    try {
      return localStorage.getItem('astranov:ai-session') || (window.crypto?.randomUUID?.() || 's-' + Date.now());
    } catch (_) {
      return 's-' + Date.now();
    }
  },

  _saveSession() {
    try { localStorage.setItem('astranov:ai-session', this._sessionId); } catch (_) {}
  },

  current() {
    return this.PROVIDERS.find(p => p.id === this._provider) || this.PROVIDERS[0];
  },

  setProvider(id) {
    if (!this.PROVIDERS.some(p => p.id === id)) return false;
    this._provider = id;
    try { localStorage.setItem('astranov:ai-provider', id); } catch (_) {}
    this._syncUi();
    CliRibbon?.render?.();
    return true;
  },

  cycle() {
    const i = this.PROVIDERS.findIndex(p => p.id === this._provider);
    const next = this.PROVIDERS[(i + 1) % this.PROVIDERS.length];
    this.setProvider(next.id);
    AciCli?.print('AI provider → ' + next.label + ' (' + next.id + ')', 'ok');
    LabOrbs?._syncGlyphs?.();
    return next;
  },

  forLab(lab) {
    const id = lab?.engine || lab?.id;
    return this.LAB_ENGINES[id] || (this.PROVIDERS.some(p => p.id === id) ? id : 'astranov');
  },

  applyLab(lab) {
    const prov = this.forLab(lab);
    this.setProvider(prov);
    return this.current();
  },

  _bindUi() {
    document.getElementById('aci-provider')?.addEventListener('click', () => this.cycle());
  },

  _syncUi() {
    const btn = document.getElementById('aci-provider');
    const p = this.current();
    if (btn) {
      btn.title = 'AI provider: ' + p.label + ' — tap to cycle';
      btn.textContent = p.short;
      btn.dataset.provider = p.id;
    }
  },

  async ask(prompt, opts) {
    opts = opts || {};
    const text = String(prompt || '').trim();
    if (!text) return { error: 'empty prompt' };
    const headers = { 'Content-Type': 'application/json', apikey: SB_KEY };
    if (Auth?.ensureSession) {
      const session = await Auth.ensureSession();
      headers.Authorization = session?.access_token ? 'Bearer ' + session.access_token : 'Bearer ' + SB_KEY;
    } else {
      headers.Authorization = 'Bearer ' + SB_KEY;
    }
    const history = (opts.history || []).slice(-8).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: String(m.content || m.text || m.reply || '').slice(0, 2000),
    }));
    // Free providers first; server may paid-fallback XAI for architect only after limit
    let preferred = opts.provider || this._provider || 'groq';
    if (preferred === 'xai') preferred = 'grok'; // still free-first on server
    const body = {
      text,
      prompt: text,
      level: 'global',
      preferred_provider: preferred,
      session_id: this._sessionId,
      source: 'astranov.eu-main',
      messages: history,
    };
    const timeout = opts.timeoutMs || 25000;
    try {
      const j = await fetchJson(SB_URL + '/functions/v1/ai-router', {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      }, timeout);
      if (j.error && !j.text && !j.response) return { error: j.error, raw: j };
      // Surface paid-fallback notify to architect UI
      if (j.paid_fallback || j.notify) {
        const note = String(j.paid_notice || j.notify || '⚠ Free limit — paid XAI_API_KEY');
        AciCli?.print?.(note, 'err');
        ACIControl?.reply?.(note);
        CliRibbon?.setNotice?.(note.slice(0, 120), 'err');
      }
      return {
        text: String(j.text || j.response || j.message || '').trim(),
        provider: j.provider || j.via || body.preferred_provider,
        via: j.via || '',
        paid_fallback: !!j.paid_fallback,
        paid_notice: j.paid_notice || j.notify || '',
        model: j.model || '',
        action: j.action || null,
        raw: j,
      };
    } catch (e) {
      return { error: String(e.message || e) };
    }
  },

  shouldRoute(message, opts) {
    if (opts?.forceAci) return false;
    if (AciCoders?.isBuildTask?.(message)) return false;
    if (AciCoders?.wantsComposer?.(message)) return false;
    if (/^coders\s+poll|^summon\s+coders?/i.test(message)) return false;
    return true;
  },
};

window.AiRouter = AiRouter;

/* === 76-city-tasks.js === */
// === CITY TASKS — same delivery DNA for ALL city work ===
// Pipeline: open → assigned → claimed → en_route/in_progress → delivered/done → cancelled
// Kinds: delivery · job · errand · dating · service
// Durations: 3h barman · 1w housekeeper · 2h date · one-shot errands
const CityTasks = {
  version: '20260717-jobs-dna',
  tasks: new Map(),
  _localKey: 'astranov:city-tasks-v2',

  // Shared status DNA (delivery names kept for OrderTracking mirror)
  STATUSES: ['open', 'assigned', 'claimed', 'picked_up', 'en_route', 'in_progress', 'delivered', 'done', 'cancelled'],

  KINDS: {
    delivery: {
      label: 'Delivery', icon: '📦', role: 'driver',
      actionClaim: 'Claim delivery', actionDone: 'Mark delivered',
      color: 0x44ffaa,
    },
    job: {
      label: 'Job / gig', icon: '💼', role: 'worker',
      actionClaim: 'Take job', actionDone: 'Complete shift',
      color: 0x66aaff,
    },
    errand: {
      label: 'Errand', icon: '🏃', role: 'runner',
      actionClaim: 'Run errand', actionDone: 'Errand done',
      color: 0xffcc44,
    },
    dating: {
      label: 'Dating', icon: '💕', role: 'match',
      actionClaim: 'Accept date', actionDone: 'Date done',
      color: 0xff6699,
    },
    service: {
      label: 'Service', icon: '🛠️', role: 'provider',
      actionClaim: 'Take service', actionDone: 'Service done',
      color: 0xaa88ff,
    },
  },

  // Catalog of common gigs (extend freely)
  CATALOG: [
    { kind: 'job', role: 'barman', title: 'Barman / bartender', defaultDur: '3h', rateHint: '€/h' },
    { kind: 'job', role: 'barista', title: 'Barista', defaultDur: '4h', rateHint: '€/h' },
    { kind: 'job', role: 'housekeeper', title: 'Housekeeper', defaultDur: '1w', rateHint: '€/week' },
    { kind: 'job', role: 'cleaner', title: 'Cleaner', defaultDur: '3h', rateHint: '€/h' },
    { kind: 'job', role: 'nanny', title: 'Nanny / childcare', defaultDur: '1d', rateHint: '€/d' },
    { kind: 'job', role: 'gardener', title: 'Gardener', defaultDur: '4h', rateHint: '€/h' },
    { kind: 'job', role: 'cook', title: 'Cook / private chef', defaultDur: '3h', rateHint: '€/h' },
    { kind: 'job', role: 'waiter', title: 'Waiter / server', defaultDur: '5h', rateHint: '€/h' },
    { kind: 'job', role: 'security', title: 'Security', defaultDur: '8h', rateHint: '€/h' },
    { kind: 'job', role: 'tutor', title: 'Tutor', defaultDur: '2h', rateHint: '€/h' },
    { kind: 'job', role: 'mover', title: 'Mover / helper', defaultDur: '4h', rateHint: '€/h' },
    { kind: 'job', role: 'petcare', title: 'Pet care / walker', defaultDur: '1h', rateHint: '€/h' },
    { kind: 'errand', role: 'errand', title: 'General errand', defaultDur: '1h', rateHint: 'flat' },
    { kind: 'errand', role: 'pharmacy', title: 'Pharmacy run', defaultDur: '45m', rateHint: 'flat' },
    { kind: 'errand', role: 'grocery', title: 'Grocery run', defaultDur: '1h', rateHint: 'flat' },
    { kind: 'errand', role: 'documents', title: 'Document / office run', defaultDur: '2h', rateHint: 'flat' },
    { kind: 'delivery', role: 'driver', title: 'Package / food delivery', defaultDur: '45m', rateHint: 'route' },
    { kind: 'dating', role: 'date', title: 'Date / meet', defaultDur: '2h', rateHint: 'shared' },
    { kind: 'dating', role: 'coffee', title: 'Coffee date', defaultDur: '1h', rateHint: 'shared' },
    { kind: 'dating', role: 'dinner', title: 'Dinner date', defaultDur: '3h', rateHint: 'shared' },
    { kind: 'dating', role: 'walk', title: 'Walk / activity date', defaultDur: '2h', rateHint: 'shared' },
    { kind: 'service', role: 'handyman', title: 'Handyman', defaultDur: '2h', rateHint: '€/h' },
    { kind: 'service', role: 'beauty', title: 'Beauty / hair at home', defaultDur: '2h', rateHint: '€/h' },
  ],

  init() {
    if (this._inited) return;
    this._inited = true;
    window.CityTasks = this;
    this._loadLocal();
    this._wireFieldBrain();
    console.log('%c[CityTasks] jobs · errands · dating · delivery DNA', 'color:#44ffaa;font-weight:700');
  },

  _loadLocal() {
    try {
      const raw = localStorage.getItem(this._localKey)
        || localStorage.getItem('astranov:city-tasks-v1');
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) arr.forEach(t => { if (t?.id) this.tasks.set(t.id, t); });
    } catch (_) {}
  },

  _saveLocal() {
    try {
      const arr = [...this.tasks.values()].slice(-100);
      localStorage.setItem(this._localKey, JSON.stringify(arr));
    } catch (_) {}
  },

  _id() {
    return 'ct_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  },

  _wireFieldBrain() {
    if (!window.FieldBrain) return;
    const FB = window.FieldBrain;
    FB.claimDelivery = async (orderId) => this.claim(orderId);
    FB.createCityTask = (spec) => this.create(spec);
    FB.listCityTasks = (f) => this.list(f);
    FB.completeDelivery = async (id) => this.complete(id);
    FB.postJob = (spec) => this.postJob(spec);
    FB.postDate = (spec) => this.postDate(spec);
  },

  /** Parse "3h" · "1w" · "2d" · "45m" → ms + label */
  parseDuration(raw) {
    if (raw == null || raw === '') return { ms: 0, label: 'open', unit: null, amount: 0 };
    if (typeof raw === 'number' && raw > 0) {
      return { ms: raw, label: this._fmtDur(raw), unit: 'ms', amount: raw };
    }
    const s = String(raw).trim().toLowerCase().replace(/\s+/g, '');
    const m = s.match(/^(\d+(?:\.\d+)?)(m|min|mins|h|hr|hrs|hour|hours|d|day|days|w|wk|week|weeks)?$/);
    if (!m) return { ms: 0, label: String(raw), unit: null, amount: 0 };
    const n = parseFloat(m[1]);
    const u = m[2] || 'h';
    let ms = 0;
    let label = n + u;
    if (/^m|min/.test(u)) { ms = n * 60 * 1000; label = n + 'm'; }
    else if (/^h|hr|hour/.test(u)) { ms = n * 3600 * 1000; label = n + 'h'; }
    else if (/^d|day/.test(u)) { ms = n * 86400 * 1000; label = n + 'd'; }
    else if (/^w|wk|week/.test(u)) { ms = n * 7 * 86400 * 1000; label = n + 'w'; }
    return { ms, label, unit: u, amount: n };
  },

  _fmtDur(ms) {
    if (!ms || ms < 60000) return 'open';
    if (ms < 3600000) return Math.round(ms / 60000) + 'm';
    if (ms < 86400000) return (Math.round(ms / 3600000 * 10) / 10) + 'h';
    if (ms < 7 * 86400000) return (Math.round(ms / 86400000 * 10) / 10) + 'd';
    return (Math.round(ms / (7 * 86400000) * 10) / 10) + 'w';
  },

  /** Infer kind + role + duration from free text */
  parseSpec(text) {
    const raw = String(text || '').trim();
    const low = raw.toLowerCase();
    let kind = 'job';
    let role = 'worker';
    let duration = null;
    let title = raw;

    // Duration tokens → normalize to 3h / 1w / 45m
    const durM = low.match(/(\d+(?:\.\d+)?)\s*(hours?|hrs?|h|days?|d|weeks?|wks?|w|mins?|minutes?|m)\b/i);
    if (durM) {
      const n = durM[1];
      const u = durM[2].toLowerCase();
      if (/^h|hour|hr/.test(u)) duration = n + 'h';
      else if (/^d|day/.test(u)) duration = n + 'd';
      else if (/^w|week|wk/.test(u)) duration = n + 'w';
      else duration = n + 'm';
    }

    // Kind detection
    if (/\b(date|dating|coffee\s*date|dinner\s*date|meet\s*(up)?|romantic|tinder|match)\b/i.test(low)) {
      kind = 'dating';
      role = /dinner/.test(low) ? 'dinner' : /coffee/.test(low) ? 'coffee' : /walk/.test(low) ? 'walk' : 'date';
    } else if (/\b(deliver|delivery|drop.?off|package|food\s*order|courier)\b/i.test(low)) {
      kind = 'delivery';
      role = 'driver';
    } else if (/\b(errand|pharmacy|grocery\s*run|pick\s*up|run\s*to)\b/i.test(low)) {
      kind = 'errand';
      role = /pharmacy/.test(low) ? 'pharmacy' : /grocery/.test(low) ? 'grocery' : 'errand';
    } else if (/\b(handyman|beauty|hair|repair|fix)\b/i.test(low)) {
      kind = 'service';
      role = /beauty|hair/.test(low) ? 'beauty' : 'handyman';
    }

    // Role from catalog keywords
    for (const c of this.CATALOG) {
      if (c.role !== 'driver' && c.role !== 'errand' && c.role !== 'date'
        && new RegExp('\\b' + c.role + '\\b', 'i').test(low)) {
        kind = c.kind;
        role = c.role;
        if (!duration) duration = c.defaultDur;
        title = c.title + (duration ? ' · ' + duration : '');
        break;
      }
    }
    // Explicit barman / housekeeper etc. already matched above; refine title
    if (/barman|bartender|μπάρμαν|μπαρμαν/i.test(low)) {
      kind = 'job'; role = 'barman';
      if (!duration) duration = '3h';
      title = 'Barman · ' + (duration || '3h');
    }
    if (/house\s*keep|οικιακ|καθαρίστ/i.test(low)) {
      kind = 'job'; role = 'housekeeper';
      if (!duration) duration = '1w';
      title = 'Housekeeper · ' + (duration || '1w');
    }

    if (!title || title.length < 2) {
      const k = this.KINDS[kind] || this.KINDS.job;
      title = k.icon + ' ' + k.label + (duration ? ' · ' + duration : '');
    }

    return { kind, role, duration, title: title.slice(0, 80), raw };
  },

  meta(kind) {
    return this.KINDS[kind] || this.KINDS.service;
  },

  create(spec) {
    spec = spec || {};
    const u = window._lastPos || { lat: 36.4341, lng: 28.2176 };
    const parsed = spec.rawText ? this.parseSpec(spec.rawText) : null;
    const kind = spec.kind || parsed?.kind || 'delivery';
    const role = spec.role || parsed?.role || this.meta(kind).role;
    const dur = this.parseDuration(spec.duration || parsed?.duration || spec.duration_label);
    const startAt = spec.start_at || Date.now();
    const endAt = spec.end_at || (dur.ms ? startAt + dur.ms : null);
    const km = this.meta(kind);

    const task = {
      id: spec.id || this._id(),
      kind,
      role,
      title: spec.title || parsed?.title || (km.icon + ' ' + km.label),
      status: 'open',
      lat: spec.lat ?? u.lat,
      lng: spec.lng ?? u.lng,
      // Client who posts
      poster_id: Auth?.user?.id || 'local',
      poster_name: Auth?.user?.user_metadata?.full_name
        || Auth?.user?.email?.split?.('@')?.[0] || 'You',
      // Worker / driver / match who claims
      worker_id: null,
      worker_name: null,
      driver_id: null, // alias for delivery DNA
      driver_name: null,
      // Duration DNA
      duration_ms: dur.ms,
      duration_label: dur.label,
      start_at: startAt,
      end_at: endAt,
      // Pay
      rate: spec.rate ?? null,
      rate_unit: spec.rate_unit || 'flat',
      budget: spec.budget ?? null,
      currency: spec.currency || 'EUR',
      // Commerce links
      vendor_id: spec.vendor_id || null,
      vendor_name: spec.vendor_name || null,
      order_id: spec.order_id || null,
      short_id: spec.short_id || null,
      items: spec.items || [],
      note: spec.note || '',
      // Dating extras
      dating: kind === 'dating' ? {
        vibe: spec.vibe || 'open',
        place_hint: spec.place_hint || '',
        mutual: false,
      } : null,
      created_at: Date.now(),
      updated_at: Date.now(),
    };

    this.tasks.set(task.id, task);
    this._saveLocal();
    this._showOnGlobe(task);
    FieldBrain?.pulse?.('commerce', task.kind + ' open · ' + task.title, { task });
    AciCli?.print?.(
      'city-task · ' + task.kind + ' · ' + task.duration_label + ' · ' + task.title.slice(0, 40),
      'ok'
    );
    return task;
  },

  /** Post a timed job (barman 3h, housekeeper 1w, …) */
  postJob(spec) {
    const s = typeof spec === 'string' ? this.parseSpec(spec) : (spec || {});
    if (typeof spec === 'string') {
      return this.create({
        kind: s.kind === 'dating' ? 'job' : (s.kind || 'job'),
        role: s.role,
        title: s.title,
        duration: s.duration,
        rawText: spec,
        note: 'job post',
      });
    }
    return this.create({
      kind: s.kind || 'job',
      role: s.role || 'worker',
      title: s.title,
      duration: s.duration || s.duration_label,
      rate: s.rate,
      rate_unit: s.rate_unit || 'hour',
      note: s.note || 'job post',
      lat: s.lat,
      lng: s.lng,
    });
  },

  /** Dating uses same claim DNA — open invite → accept → in progress → done */
  postDate(spec) {
    const s = typeof spec === 'string' ? this.parseSpec(spec) : (spec || {});
    const text = typeof spec === 'string' ? spec : (s.title || s.rawText || 'date');
    const p = this.parseSpec(text);
    return this.create({
      kind: 'dating',
      role: p.role || s.role || 'date',
      title: s.title || p.title || ('💕 Date · ' + (p.duration || s.duration || '2h')),
      duration: s.duration || p.duration || '2h',
      vibe: s.vibe || 'open',
      place_hint: s.place_hint || '',
      note: s.note || 'dating invite',
      lat: s.lat,
      lng: s.lng,
      rawText: text,
    });
  },

  postErrand(spec) {
    const s = typeof spec === 'string' ? this.parseSpec(spec) : (spec || {});
    const text = typeof spec === 'string' ? spec : (s.title || 'errand');
    const p = this.parseSpec(text);
    return this.create({
      kind: 'errand',
      role: p.role || 'errand',
      title: s.title || p.title,
      duration: s.duration || p.duration || '1h',
      note: s.note || 'errand',
      lat: s.lat,
      lng: s.lng,
      rawText: text,
    });
  },

  fromOrder(order, vendor, driver) {
    if (!order) return null;
    const existing = [...this.tasks.values()].find(t => t.order_id === order.id);
    if (existing) {
      existing.status = this._mapOrderStatus(order.status);
      existing.worker_id = driver?.id || order.driver_id || existing.worker_id;
      existing.worker_name = driver?.display_name || driver?.name || existing.worker_name;
      existing.driver_id = existing.worker_id;
      existing.driver_name = existing.worker_name;
      existing.updated_at = Date.now();
      this._saveLocal();
      this._showOnGlobe(existing);
      return existing;
    }
    return this.create({
      kind: 'delivery',
      role: 'driver',
      title: (vendor?.emoji || '📦') + ' ' + (vendor?.name || 'Order') + ' · ' + (order.short_id || order.id?.slice(0, 8)),
      lat: order.delivery_lat,
      lng: order.delivery_lng,
      vendor_id: vendor?.id || order.vendor_id,
      vendor_name: vendor?.name,
      order_id: order.id,
      short_id: order.short_id,
      items: order.items || [],
      duration: '45m',
      note: order.status || '',
    });
  },

  _mapOrderStatus(st) {
    const m = {
      pending: 'open',
      seeking_driver: 'open',
      assigned: 'assigned',
      picked_up: 'picked_up',
      en_route: 'en_route',
      delivered: 'delivered',
      cancelled: 'cancelled',
    };
    return m[st] || 'open';
  },

  /** Terminal statuses share DNA with delivery "delivered" */
  isOpen(t) {
    return t && !['delivered', 'done', 'cancelled'].includes(t.status);
  },

  list(filter) {
    let arr = [...this.tasks.values()].sort((a, b) => b.updated_at - a.updated_at);
    if (filter?.status) arr = arr.filter(t => t.status === filter.status);
    if (filter?.kind) arr = arr.filter(t => t.kind === filter.kind);
    if (filter?.role) arr = arr.filter(t => t.role === filter.role);
    if (filter?.open) arr = arr.filter(t => this.isOpen(t));
    if (filter?.dating) arr = arr.filter(t => t.kind === 'dating');
    if (filter?.jobs) arr = arr.filter(t => t.kind === 'job' || t.kind === 'service');
    return arr;
  },

  get(id) {
    if (!id) return null;
    const q = String(id);
    if (this.tasks.has(q)) return this.tasks.get(q);
    return [...this.tasks.values()].find(t =>
      t.id === q || t.order_id === q || (t.short_id && t.short_id.toUpperCase() === q.toUpperCase())
    ) || null;
  },

  /** Same claim DNA for driver / barman / housekeeper / date */
  async claim(idOrOrder) {
    let task = this.get(idOrOrder);
    if (!task && idOrOrder) {
      const order = await OrderTracking?.fetchOrder?.(idOrOrder);
      if (order) {
        const vendor = await OrderTracking?.resolveVendor?.(order.vendor_id);
        task = this.fromOrder(order, vendor, null);
      }
    }
    if (!task) {
      const open = this.list({ open: true })[0];
      if (open) task = open;
      else {
        const u = window._lastPos || { lat: 36.4341, lng: 28.2176 };
        task = this.create({
          kind: 'delivery',
          title: 'Demo delivery · claim me',
          lat: u.lat + 0.002,
          lng: u.lng - 0.001,
          duration: '45m',
          note: 'local demo',
        });
      }
    }
    if (!this.isOpen(task) && task.status !== 'open' && task.status !== 'assigned') {
      return { ok: false, error: 'not open', task };
    }
    const me = Auth?.user;
    const name = me?.user_metadata?.full_name || me?.email?.split('@')[0] || 'You';
    const id = me?.id || 'local-worker';
    task.status = 'claimed';
    task.worker_id = id;
    task.worker_name = name;
    // Delivery DNA aliases
    task.driver_id = id;
    task.driver_name = name;
    if (!task.start_at) task.start_at = Date.now();
    if (task.duration_ms && !task.end_at) task.end_at = task.start_at + task.duration_ms;
    if (task.kind === 'dating' && task.dating) task.dating.mutual = true;
    task.updated_at = Date.now();
    this.tasks.set(task.id, task);
    this._saveLocal();
    this._showOnGlobe(task);
    const km = this.meta(task.kind);
    FieldBrain?.pulse?.('act', 'claimed · ' + task.title, { task });
    GlobeDeck?.say?.(km.actionClaim + ': ' + task.title, 'ok');
    AciCli?.print?.(
      'city-task · claimed · ' + task.kind + ' · ' + task.duration_label + ' · ' + task.title.slice(0, 36),
      'ok'
    );

    if (task.order_id && OrderTracking) {
      try {
        OrderTracking.onOrderPlaced?.({
          id: task.order_id,
          short_id: task.short_id,
          status: 'assigned',
          delivery_lat: task.lat,
          delivery_lng: task.lng,
          vendor_id: task.vendor_id,
        }, { id: task.vendor_id, name: task.vendor_name, lat: task.lat, lng: task.lng }, {
          id: task.worker_id,
          name: task.worker_name,
          field_lat: window._lastPos?.lat,
          field_lng: window._lastPos?.lng,
        });
      } catch (_) {}
    }
    return { ok: true, task };
  },

  /** Start work / go en route (delivery DNA mid-state) */
  startWork(id) {
    const task = this.get(id);
    if (!task) return { ok: false, error: 'not found' };
    const next = task.kind === 'delivery' ? 'en_route' : 'in_progress';
    return this.advance(id, next);
  },

  complete(id) {
    const task = this.get(id);
    if (!task) return { ok: false, error: 'not found' };
    // Delivery uses "delivered"; jobs/dating use "done" (also accepted as terminal)
    const st = task.kind === 'delivery' ? 'delivered' : 'done';
    return this.advance(id, st);
  },

  advance(id, status) {
    const task = this.get(id);
    if (!task) return { ok: false, error: 'not found' };
    // Normalize done ↔ delivered for shared DNA
    if (status === 'complete' || status === 'completed' || status === 'finished') {
      status = task.kind === 'delivery' ? 'delivered' : 'done';
    }
    if (!this.STATUSES.includes(status)) return { ok: false, error: 'bad status' };
    task.status = status;
    if (status === 'in_progress' || status === 'en_route') {
      if (!task.start_at) task.start_at = Date.now();
    }
    if (status === 'delivered' || status === 'done') {
      task.end_at = task.end_at || Date.now();
    }
    task.updated_at = Date.now();
    this.tasks.set(task.id, task);
    this._saveLocal();
    this._showOnGlobe(task);
    FieldBrain?.pulse?.('commerce', status + ' · ' + task.title, { task });
    AciCli?.print?.('city-task · ' + status + ' · ' + task.id.slice(0, 12), 'ok');
    return { ok: true, task };
  },

  cancel(id) {
    return this.advance(id, 'cancelled');
  },

  /** Simple quote using delivery-style distance + duration */
  quote(taskOrSpec) {
    const t = typeof taskOrSpec === 'string'
      ? this.parseSpec(taskOrSpec)
      : (taskOrSpec || {});
    const dur = this.parseDuration(t.duration || t.duration_label || t.duration_ms);
    const kind = t.kind || 'job';
    const hours = Math.max(dur.ms / 3600000, kind === 'delivery' ? 0.5 : 1);
    let rate = t.rate;
    if (rate == null) {
      if (kind === 'dating') rate = 0; // social — optional tip later
      else if (kind === 'delivery') rate = 3.5;
      else if (kind === 'errand') rate = 12;
      else rate = 15; // €/h default gig
    }
    const base = kind === 'dating' ? 0 : (kind === 'delivery' ? rate : rate * hours);
    const platform = Math.round(base * 0.1 * 100) / 100;
    return {
      kind,
      duration_label: dur.label,
      hours: Math.round(hours * 10) / 10,
      rate,
      labour_eur: Math.round(base * 100) / 100,
      platform_eur: platform,
      total_eur: Math.round((base + platform) * 100) / 100,
      currency: 'EUR',
    };
  },

  _showOnGlobe(task) {
    if (!task || task.lat == null || task.lng == null) return;
    const km = this.meta(task.kind);
    const statusIcon = {
      open: '📋', assigned: '🤝', claimed: '✋',
      picked_up: '📦', en_route: '🛵', in_progress: '⏳',
      delivered: '✅', done: '✅', cancelled: '❌',
    };
    const who = task.worker_name || task.driver_name;
    const dur = task.duration_label && task.duration_label !== 'open'
      ? ' · ' + task.duration_label : '';
    GlobeEntity?.register?.({
      id: 'city-task-' + task.id,
      type: (task.status === 'delivered' || task.status === 'done') ? 'order' : 'pilot',
      lat: task.lat,
      lng: task.lng,
      title: (statusIcon[task.status] || km.icon) + ' ' + (task.title || 'Task').slice(0, 40),
      description: task.kind + dur + (who ? ' · ' + who : ''),
      urgency: task.status === 'open' ? 3 : 2,
      color: km.color,
      persist: true,
      data: { task, alwaysShowLabel: task.status === 'open' },
      _actionLabel: task.status === 'open' ? km.actionClaim : 'Track',
      onTap: () => {
        if (task.status === 'open' || task.status === 'assigned') this.claim(task.id);
        else {
          GlobeControl?.flyToLatLng?.(task.lat, task.lng, task.title, GlobeControl?.Z?.city, {});
          AciCli?.print?.(
            task.kind + ' · ' + task.status + ' · ' + task.duration_label + ' · ' + task.title,
            'ok'
          );
        }
      },
    });
    MapDepict?.pulse?.(task.lat, task.lng, km.color, task.title.slice(0, 24), 6000);
  },

  async startDeliveryFlow(query) {
    await LazyModules?.ensure?.().catch(() => {});
    const u = window._lastPos || { lat: 36.4341, lng: 28.2176 };
    SpaceNetBrain?.crawlArea?.(u.lat, u.lng, 3);
    if (window.Commerce?.openOrderFlow) await Commerce.openOrderFlow(query || '');
    else if (Commerce?.smartOrder) await Commerce.smartOrder(query || 'delivery');
    else if (Commerce?.showPicker) await Commerce.showPicker();
    return this.create({
      kind: 'delivery',
      title: 'Delivery · ' + String(query || 'nearby').slice(0, 40),
      lat: u.lat,
      lng: u.lng,
      duration: '45m',
      note: 'pipeline · shops + drivers',
    });
  },

  catalogPrint() {
    this.CATALOG.forEach(c => {
      AciCli?.print?.(
        c.kind + ' · ' + c.role + ' · ' + c.title + ' · default ' + c.defaultDur,
        'dim'
      );
    });
    return this.CATALOG.length + ' roles';
  },

  wants(text) {
    const low = String(text || '').toLowerCase();
    return /\b(city\s*task|task\s*list|claim\s*(delivery|order|task|job|date)|deliver(y)?\s*(here|now)|assign\s*driver)\b/i.test(low)
      || /\b(barman|bartender|housekeeper|nanny|cleaner|errand|gig|hire|job\s+for|need\s+a)\b/i.test(low)
      || /\b(date|dating|coffee\s*date|dinner\s*date)\b/i.test(low)
      || /^task\b/i.test(low);
  },

  async handleCli(line) {
    const raw = String(line || '').trim();
    const low = raw.toLowerCase();
    const parts = raw.split(/\s+/);

    // Catalog
    if (/\bcatalog|roles|kinds\b/.test(low)) {
      return this.catalogPrint();
    }

    // List filters
    if (/\blist\b/.test(low) || /\btasks?\b/.test(low) && !/create|new|post|claim|hire|date|job/.test(low)) {
      let filter = { open: true };
      if (/dating|date/.test(low)) filter = { open: true, dating: true };
      else if (/job|gig|hire/.test(low)) filter = { open: true, jobs: true };
      else if (/errand/.test(low)) filter = { open: true, kind: 'errand' };
      else if (/deliver/.test(low)) filter = { open: true, kind: 'delivery' };
      const open = this.list(filter);
      if (!open.length) {
        return 'No open tasks · try: task job barman 3h · task date coffee 2h · task errand pharmacy';
      }
      open.slice(0, 10).forEach(t => {
        AciCli?.print?.(
          t.status + ' · ' + t.kind + ' · ' + t.duration_label + ' · ' + t.title.slice(0, 42),
          'ok'
        );
      });
      return open.length + ' open';
    }

    // Dating
    if (/\b(date|dating)\b/.test(low) && !/list|claim/.test(low)) {
      const body = raw.replace(/^(task|city)\s*/i, '').replace(/^(date|dating)\s*/i, '').trim();
      const t = this.postDate(body || 'coffee date 2h');
      const q = this.quote(t);
      return 'Date open · ' + t.title + ' · ' + t.duration_label + (q.total_eur ? '' : ' · social');
    }

    // Job / hire
    if (/\b(job|hire|gig|need\s+a|barman|housekeeper|nanny|cleaner|waiter|cook)\b/.test(low)
      && !/list|claim/.test(low)) {
      const body = raw.replace(/^(task|city)\s*/i, '')
        .replace(/^(job|hire|gig)\s*/i, '').trim();
      const t = this.postJob(body || 'barman 3h');
      const q = this.quote(t);
      return 'Job open · ' + t.title + ' · ' + t.duration_label
        + (q.total_eur ? ' · ~€' + q.total_eur : '');
    }

    // Errand
    if (/\berrand\b/.test(low) && !/list|claim/.test(low)) {
      const body = raw.replace(/^(task|city)\s*/i, '').replace(/^errand\s*/i, '').trim();
      const t = this.postErrand(body || 'pharmacy');
      return 'Errand open · ' + t.title + ' · ' + t.duration_label;
    }

    // Quote
    if (/\bquote|price|cost\b/.test(low)) {
      const body = raw.replace(/^.*?(quote|price|cost)\s*/i, '').trim() || 'barman 3h';
      const q = this.quote(body);
      AciCli?.print?.(
        q.kind + ' · ' + q.duration_label + ' · labour €' + q.labour_eur
        + ' + platform €' + q.platform_eur + ' ≈ €' + q.total_eur,
        'ok'
      );
      return 'Quote €' + q.total_eur;
    }

    // Create generic
    if (/\b(create|new|post)\b/.test(low)) {
      const body = raw.replace(/^.*?(create|new|post)\s*/i, '').trim() || 'City task';
      const t = this.create({ rawText: body, title: undefined });
      return 'Created ' + t.kind + ' · ' + t.id.slice(0, 12) + ' · ' + t.title;
    }

    // Claim
    if (/\b(claim|take|accept|assign)\b/.test(low)) {
      const id = parts.find(p => p.startsWith('ct_') || /^[0-9a-f-]{8,}$/i.test(p));
      const r = await this.claim(id || null);
      return r.ok
        ? ('Claimed · ' + r.task.kind + ' · ' + r.task.duration_label + ' · ' + r.task.title)
        : (r.error || 'claim failed');
    }

    // Progress / complete
    if (/\b(start|en.?route|progress|picked)\b/.test(low)) {
      const id = parts.find(p => this.get(p)) || this.list({ open: true }).find(t => t.worker_id)?.id;
      const r = this.startWork(id);
      return r.ok ? r.task.status : (r.error || 'fail');
    }
    if (/\b(done|complete|finish|deliver(ed)?)\b/.test(low)) {
      const id = parts.find(p => this.get(p))
        || this.list({}).find(t => t.worker_id && this.isOpen(t))?.id;
      const r = this.complete(id);
      return r.ok ? r.task.status : (r.error || 'fail');
    }

    // Delivery shop pipeline
    if (/\b(order|shop|delivery)\b/.test(low)) {
      await this.startDeliveryFlow(raw.replace(/^(task|city)\s*/i, ''));
      return 'Delivery pipeline · shops + task card';
    }

    const open = this.list({ open: true });
    return 'City DNA · open ' + open.length
      + ' · task job barman 3h · task housekeeper 1w · task date coffee 2h'
      + ' · task errand · task claim · task catalog';
  },
};
window.CityTasks = CityTasks;

/* === 81-spacenet-channel-manager.js === */
// === SPACENET CHANNEL MANAGER — field OS hub for multi-path local life ===
// Original Astranov design. No third-party brand names. No scraped APIs.
// Purpose: one source of truth (place · catalog · offer · work · ledger) on the globe,
// with pluggable *channels* so the same inventory can open on Field, Mesh, walk-in, phone,
// and later signed external pipes — without forking menus or double-booking.
//
// Stands alone as SpaceNet CM. Adapters are abstract contracts only until commercial sign-off.
const SpaceNetCM = {
  version: '20260718-sncm1',
  STORAGE_KEY: 'astranov:spacenet-cm-v1',
  _places: new Map(),
  _catalog: new Map(),
  _offers: new Map(),
  _orders: new Map(),
  _channels: new Map(),
  _adapters: new Map(),
  _listeners: [],
  _inited: false,

  /** Built-in channel kinds — Astranov-native only */
  CHANNEL_KINDS: Object.freeze({
    field: {
      id: 'field',
      label: 'Field (globe)',
      desc: 'Native Astranov map · CLI · voice',
      native: true,
    },
    mesh: {
      id: 'mesh',
      label: 'SpaceNet mesh',
      desc: 'Peer devices · offline-friendly relay',
      native: true,
    },
    walk_in: {
      id: 'walk_in',
      label: 'Walk-in counter',
      desc: 'Physical place · same catalog',
      native: true,
    },
    phone: {
      id: 'phone',
      label: 'Phone / voice',
      desc: 'Call-in · voice order path',
      native: true,
    },
    /** Reserved abstract slot — never name a vendor here */
    pipe: {
      id: 'pipe',
      label: 'External pipe',
      desc: 'Signed adapter after commercial agreement',
      native: false,
      requiresAgreement: true,
    },
  }),

  ORDER_STATES: Object.freeze([
    'draft', 'open', 'accepted', 'preparing', 'ready',
    'assigned', 'en_route', 'fulfilled', 'settled', 'cancelled', 'conflict',
  ]),

  init() {
    if (this._inited) return this;
    this._inited = true;
    window.SpaceNetCM = this;
    this._load();
    this._ensureDefaultChannels();
    this._registerNativeAdapters();
    this._wireCli();
    console.log('%c[SpaceNetCM] channel manager · field hub live', 'color:#00e8ff;font-weight:700');
    return this;
  },

  // ── Identity helpers ─────────────────────────────────────────────
  _id(prefix) {
    return prefix + '_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  },

  _now() {
    return Date.now();
  },

  _save() {
    try {
      const payload = {
        v: 1,
        places: [...this._places.values()],
        catalog: [...this._catalog.values()],
        offers: [...this._offers.values()],
        orders: [...this._orders.values()].slice(-200),
        channels: [...this._channels.values()],
        at: this._now(),
      };
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(payload));
    } catch (_) {}
  },

  _load() {
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (!raw) return;
      const j = JSON.parse(raw);
      (j.places || []).forEach((p) => this._places.set(p.id, p));
      (j.catalog || []).forEach((c) => this._catalog.set(c.id, c));
      (j.offers || []).forEach((o) => this._offers.set(o.id, o));
      (j.orders || []).forEach((o) => this._orders.set(o.id, o));
      (j.channels || []).forEach((c) => this._channels.set(c.id, c));
    } catch (_) {}
  },

  _ensureDefaultChannels() {
    const defaults = ['field', 'mesh', 'walk_in', 'phone'];
    defaults.forEach((kind) => {
      const id = 'ch_' + kind;
      if (this._channels.has(id)) return;
      const meta = this.CHANNEL_KINDS[kind];
      this._channels.set(id, {
        id,
        kind,
        label: meta.label,
        enabled: kind === 'field' || kind === 'walk_in',
        priority: kind === 'field' ? 10 : kind === 'walk_in' ? 8 : 5,
        createdAt: this._now(),
      });
    });
    this._save();
  },

  // ── Places (map pins / businesses / venues) ──────────────────────
  upsertPlace(spec) {
    const id = spec.id || this._id('place');
    const prev = this._places.get(id) || {};
    const place = {
      ...prev,
      id,
      name: String(spec.name || prev.name || 'Place').slice(0, 80),
      lat: spec.lat != null ? +spec.lat : prev.lat,
      lng: spec.lng != null ? +spec.lng : prev.lng,
      kind: spec.kind || prev.kind || 'shop', // shop · stay · service · venue · person
      hours: spec.hours || prev.hours || null,
      channels: Array.isArray(spec.channels)
        ? spec.channels
        : (prev.channels || ['ch_field', 'ch_walk_in']),
      meta: { ...(prev.meta || {}), ...(spec.meta || {}) },
      updatedAt: this._now(),
      createdAt: prev.createdAt || this._now(),
    };
    this._places.set(id, place);
    this._save();
    this._emit('place.upsert', place);
    return place;
  },

  listPlaces() {
    return [...this._places.values()];
  },

  getPlace(id) {
    return this._places.get(id) || null;
  },

  // ── Catalog items (menu / services / rooms / gigs — generic SKUs) ─
  upsertCatalogItem(spec) {
    const id = spec.id || this._id('sku');
    const prev = this._catalog.get(id) || {};
    const item = {
      ...prev,
      id,
      placeId: spec.placeId || prev.placeId || null,
      title: String(spec.title || prev.title || 'Item').slice(0, 120),
      kind: spec.kind || prev.kind || 'goods', // goods · service · stay · gig · meet
      price: spec.price != null ? +spec.price : (prev.price ?? 0),
      currency: spec.currency || prev.currency || 'Coins',
      unit: spec.unit || prev.unit || 'each',
      active: spec.active != null ? !!spec.active : (prev.active !== false),
      stock: spec.stock != null ? spec.stock : (prev.stock ?? null), // null = unlimited
      attrs: { ...(prev.attrs || {}), ...(spec.attrs || {}) },
      updatedAt: this._now(),
      createdAt: prev.createdAt || this._now(),
    };
    this._catalog.set(id, item);
    this._save();
    this._emit('catalog.upsert', item);
    return item;
  },

  listCatalog(placeId) {
    const all = [...this._catalog.values()];
    if (!placeId) return all;
    return all.filter((c) => c.placeId === placeId);
  },

  // ── Offers (priced availability windows) ─────────────────────────
  upsertOffer(spec) {
    const id = spec.id || this._id('offer');
    const prev = this._offers.get(id) || {};
    const offer = {
      ...prev,
      id,
      skuId: spec.skuId || prev.skuId,
      placeId: spec.placeId || prev.placeId,
      channelIds: Array.isArray(spec.channelIds)
        ? spec.channelIds
        : (prev.channelIds || ['ch_field']),
      qty: spec.qty != null ? +spec.qty : (prev.qty ?? 1),
      price: spec.price != null ? +spec.price : prev.price,
      windowStart: spec.windowStart || prev.windowStart || null,
      windowEnd: spec.windowEnd || prev.windowEnd || null,
      open: spec.open != null ? !!spec.open : (prev.open !== false),
      updatedAt: this._now(),
      createdAt: prev.createdAt || this._now(),
    };
    this._offers.set(id, offer);
    this._save();
    this._emit('offer.upsert', offer);
    return offer;
  },

  listOffers(filter) {
    let list = [...this._offers.values()];
    if (filter?.placeId) list = list.filter((o) => o.placeId === filter.placeId);
    if (filter?.channelId) list = list.filter((o) => (o.channelIds || []).includes(filter.channelId));
    if (filter?.openOnly) list = list.filter((o) => o.open);
    return list;
  },

  // ── Channels ─────────────────────────────────────────────────────
  listChannels() {
    return [...this._channels.values()].sort((a, b) => (b.priority || 0) - (a.priority || 0));
  },

  setChannelEnabled(channelId, enabled) {
    const ch = this._channels.get(channelId);
    if (!ch) return null;
    if (ch.kind === 'pipe' && enabled && !ch.agreementId) {
      // External pipes stay dark until a signed agreement id is attached
      this._emit('channel.blocked', { channelId, reason: 'agreement_required' });
      return ch;
    }
    ch.enabled = !!enabled;
    ch.updatedAt = this._now();
    this._channels.set(channelId, ch);
    this._save();
    this._emit('channel.update', ch);
    return ch;
  },

  /**
   * Register a future external pipe (abstract). No vendor branding.
   * agreementId must be set before enable.
   */
  registerPipeChannel(spec) {
    const id = spec.id || this._id('ch_pipe');
    const ch = {
      id,
      kind: 'pipe',
      label: String(spec.label || 'External pipe').slice(0, 60),
      enabled: false,
      priority: spec.priority ?? 3,
      agreementId: spec.agreementId || null,
      adapterId: spec.adapterId || null,
      createdAt: this._now(),
    };
    this._channels.set(id, ch);
    this._save();
    this._emit('channel.register', ch);
    return ch;
  },

  // ── Orders / bookings (unified work unit) ────────────────────────
  createOrder(spec) {
    const id = spec.id || this._id('ord');
    const order = {
      id,
      placeId: spec.placeId || null,
      channelId: spec.channelId || 'ch_field',
      lines: Array.isArray(spec.lines) ? spec.lines : [],
      state: 'open',
      lat: spec.lat ?? null,
      lng: spec.lng ?? null,
      actorId: spec.actorId || null,
      taskKind: spec.taskKind || null, // optional CityTasks kind mirror
      total: spec.total != null ? +spec.total : this._sumLines(spec.lines),
      currency: spec.currency || 'Coins',
      externalRef: null, // filled only by signed adapters later
      history: [{ state: 'open', at: this._now() }],
      createdAt: this._now(),
      updatedAt: this._now(),
    };
    // Availability guard
    const conflict = this._checkOversell(order);
    if (conflict) {
      order.state = 'conflict';
      order.history.push({ state: 'conflict', at: this._now(), detail: conflict });
    }
    this._orders.set(id, order);
    this._save();
    this._emit('order.create', order);

    // Native field path: optional CityTasks mirror for fulfillment DNA
    if (order.state === 'open' && order.channelId === 'ch_field' && order.taskKind) {
      try {
        CityTasks?.init?.();
        CityTasks?.create?.({
          kind: order.taskKind,
          title: order.lines?.[0]?.title || 'Field order',
          lat: order.lat,
          lng: order.lng,
          meta: { spacenetOrderId: id },
        });
      } catch (_) {}
    }

    // Push to enabled adapters (native no-ops are fine)
    void this._dispatchOrder(order);
    return order;
  },

  _sumLines(lines) {
    if (!Array.isArray(lines)) return 0;
    return lines.reduce((s, l) => s + (+l.price || 0) * (+l.qty || 1), 0);
  },

  _checkOversell(order) {
    for (const line of order.lines || []) {
      if (!line.skuId) continue;
      const sku = this._catalog.get(line.skuId);
      if (!sku || sku.stock == null) continue;
      if (sku.stock < (line.qty || 1)) {
        return 'insufficient_stock:' + sku.id;
      }
    }
    return null;
  },

  transitionOrder(orderId, nextState, detail) {
    const order = this._orders.get(orderId);
    if (!order) return null;
    if (!this.ORDER_STATES.includes(nextState)) return order;
    order.state = nextState;
    order.updatedAt = this._now();
    order.history.push({ state: nextState, at: order.updatedAt, detail: detail || null });
    // Stock decrement on fulfill
    if (nextState === 'fulfilled') {
      (order.lines || []).forEach((line) => {
        const sku = line.skuId && this._catalog.get(line.skuId);
        if (sku && sku.stock != null) {
          sku.stock = Math.max(0, sku.stock - (line.qty || 1));
          sku.updatedAt = this._now();
          this._catalog.set(sku.id, sku);
        }
      });
    }
    this._orders.set(orderId, order);
    this._save();
    this._emit('order.transition', order);
    void this._dispatchOrder(order);
    return order;
  },

  listOrders(filter) {
    let list = [...this._orders.values()];
    if (filter?.placeId) list = list.filter((o) => o.placeId === filter.placeId);
    if (filter?.channelId) list = list.filter((o) => o.channelId === filter.channelId);
    if (filter?.state) list = list.filter((o) => o.state === filter.state);
    return list.sort((a, b) => b.createdAt - a.createdAt);
  },

  // ── Publish catalog snapshot to all enabled channels ─────────────
  async publishPlace(placeId) {
    const place = this._places.get(placeId);
    if (!place) return { error: 'no_place' };
    const catalog = this.listCatalog(placeId).filter((c) => c.active);
    const offers = this.listOffers({ placeId, openOnly: true });
    const snapshot = { place, catalog, offers, at: this._now() };
    const results = [];
    for (const chId of place.channels || []) {
      const ch = this._channels.get(chId);
      if (!ch?.enabled) continue;
      const adapter = this._adapterFor(ch);
      if (!adapter?.publish) continue;
      try {
        const r = await adapter.publish(snapshot, ch);
        results.push({ channelId: chId, ok: true, result: r });
      } catch (e) {
        results.push({ channelId: chId, ok: false, error: String(e.message || e) });
      }
    }
    this._emit('publish', { placeId, results });
    return { placeId, results };
  },

  // ── Adapter contract (abstract — no brands) ──────────────────────
  /**
   * Register an adapter implementation.
   * @param {string} id
   * @param {{ publish?: Function, ingestOrder?: Function, capabilities?: string[] }} adapter
   */
  registerAdapter(id, adapter) {
    if (!id || !adapter) return;
    this._adapters.set(id, adapter);
    this._emit('adapter.register', { id });
  },

  _adapterFor(channel) {
    if (!channel) return null;
    if (channel.kind === 'field') return this._adapters.get('native_field');
    if (channel.kind === 'mesh') return this._adapters.get('native_mesh');
    if (channel.kind === 'walk_in') return this._adapters.get('native_walk_in');
    if (channel.kind === 'phone') return this._adapters.get('native_phone');
    if (channel.adapterId) return this._adapters.get(channel.adapterId);
    return null;
  },

  _registerNativeAdapters() {
    this.registerAdapter('native_field', {
      capabilities: ['publish', 'orders'],
      async publish(snapshot) {
        // Surface on globe via MapDepict pulse — field is home channel
        try {
          const p = snapshot.place;
          if (p?.lat != null) {
            MapDepict?.pulse?.(p.lat, p.lng, 0x00e8ff, p.name || 'place', 6000);
            MapDepict?.action?.('vendor', {
              lat: p.lat, lng: p.lng,
              detail: (snapshot.catalog?.length || 0) + ' items · field',
            });
          }
        } catch (_) {}
        return { channel: 'field', items: snapshot.catalog?.length || 0 };
      },
      async ingestOrder() { /* field orders created in-app */ },
    });

    this.registerAdapter('native_mesh', {
      capabilities: ['publish'],
      async publish(snapshot) {
        try {
          // Announce availability on BroadcastChannel mesh if present
          if (typeof BroadcastChannel !== 'undefined') {
            const bc = new BroadcastChannel('astranov-spacenet-cm-v1');
            bc.postMessage({ type: 'catalog_snapshot', snapshot, at: Date.now() });
            bc.close();
          }
        } catch (_) {}
        return { channel: 'mesh', relayed: true };
      },
    });

    this.registerAdapter('native_walk_in', {
      capabilities: ['publish', 'orders'],
      async publish(snapshot) {
        return { channel: 'walk_in', items: snapshot.catalog?.length || 0, note: 'counter uses same catalog' };
      },
    });

    this.registerAdapter('native_phone', {
      capabilities: ['orders'],
      async publish() {
        return { channel: 'phone', note: 'voice path shares catalog ids' };
      },
    });

    // Placeholder: external pipe adapter must be registered after agreement
    this.registerAdapter('pipe_stub', {
      capabilities: [],
      async publish() {
        throw new Error('pipe_requires_signed_agreement');
      },
    });
  },

  async _dispatchOrder(order) {
    const ch = this._channels.get(order.channelId);
    const adapter = this._adapterFor(ch);
    if (!adapter) return;
    try {
      if (typeof adapter.onOrder === 'function') await adapter.onOrder(order, ch);
    } catch (e) {
      this._emit('order.dispatch_error', { orderId: order.id, error: String(e.message || e) });
    }
  },

  // ── Events ───────────────────────────────────────────────────────
  on(fn) {
    if (typeof fn === 'function') this._listeners.push(fn);
    return () => {
      this._listeners = this._listeners.filter((f) => f !== fn);
    };
  },

  _emit(type, payload) {
    this._listeners.forEach((fn) => {
      try { fn({ type, payload, at: this._now() }); } catch (_) {}
    });
  },

  // ── Status / CLI ─────────────────────────────────────────────────
  status() {
    return {
      version: this.version,
      places: this._places.size,
      catalog: this._catalog.size,
      offers: this._offers.size,
      orders: this._orders.size,
      channels: this.listChannels().map((c) => ({
        id: c.id,
        kind: c.kind,
        label: c.label,
        enabled: !!c.enabled,
        agreement: c.agreementId ? 'set' : (c.kind === 'pipe' ? 'required' : 'n/a'),
      })),
    };
  },

  /** Seed a demo local place for field testing — original sample data only */
  seedLocalDemo(lat, lng) {
    const place = this.upsertPlace({
      name: 'Field kitchen',
      lat: lat ?? window._lastPos?.lat ?? 36.43,
      lng: lng ?? window._lastPos?.lng ?? 28.22,
      kind: 'shop',
      channels: ['ch_field', 'ch_walk_in', 'ch_phone', 'ch_mesh'],
    });
    const a = this.upsertCatalogItem({
      placeId: place.id, title: 'House plate', kind: 'goods', price: 8, stock: 20,
    });
    const b = this.upsertCatalogItem({
      placeId: place.id, title: 'Cold drink', kind: 'goods', price: 2, stock: 50,
    });
    this.upsertOffer({
      placeId: place.id, skuId: a.id, channelIds: ['ch_field', 'ch_walk_in', 'ch_phone'], qty: 20, price: 8,
    });
    this.upsertOffer({
      placeId: place.id, skuId: b.id, channelIds: ['ch_field', 'ch_walk_in'], qty: 50, price: 2,
    });
    void this.publishPlace(place.id);
    return place;
  },

  createFieldOrder(placeId, lines, opts) {
    opts = opts || {};
    return this.createOrder({
      placeId,
      channelId: opts.channelId || 'ch_field',
      lines,
      lat: opts.lat ?? window._lastPos?.lat,
      lng: opts.lng ?? window._lastPos?.lng,
      taskKind: opts.taskKind || 'delivery',
    });
  },

  _wireCli() {
    // Lightweight hook — SuperCli / CoreBrain can call SpaceNetCM.handleCli
  },

  wants(text) {
    return /\b(channel|channels|spacenet\s*cm|catalog|publish\s*place|field\s*kitchen)\b/i.test(String(text || ''));
  },

  handleCli(line) {
    this.init();
    const low = String(line || '').trim().toLowerCase();
    const parts = low.split(/\s+/);

    if (/status|stat/.test(parts[1] || parts[0]) || parts[0] === 'channels' && !parts[1]) {
      const s = this.status();
      const lines = [
        'SpaceNet CM · places ' + s.places + ' · catalog ' + s.catalog + ' · orders ' + s.orders,
        ...s.channels.map((c) =>
          (c.enabled ? '●' : '○') + ' ' + c.label + ' [' + c.kind + ']'
          + (c.agreement === 'required' ? ' · agreement needed' : '')
        ),
      ];
      lines.forEach((t) => AciCli?.print?.(t, 'ok'));
      return lines.join('\n');
    }

    if (/seed|demo/.test(low)) {
      const p = this.seedLocalDemo();
      AciCli?.print?.('seeded · ' + p.name + ' · ' + p.id, 'ok');
      GlobeDeck?.setPreview?.('Field kitchen on map · SpaceNet CM');
      return 'seeded ' + p.id;
    }

    if (/publish/.test(low)) {
      const places = this.listPlaces();
      if (!places.length) {
        AciCli?.print?.('no places — try: channels seed', 'dim');
        return 'no places';
      }
      const id = places[0].id;
      void this.publishPlace(id).then((r) => {
        AciCli?.print?.('published · ' + id + ' · ' + (r.results?.length || 0) + ' channel(s)', 'ok');
      });
      return 'publishing ' + id;
    }

    if (/order/.test(low)) {
      const places = this.listPlaces();
      const catalog = places[0] ? this.listCatalog(places[0].id) : [];
      if (!places.length || !catalog.length) {
        this.seedLocalDemo();
      }
      const p = this.listPlaces()[0];
      const sku = this.listCatalog(p.id)[0];
      const ord = this.createFieldOrder(p.id, [{ skuId: sku.id, title: sku.title, price: sku.price, qty: 1 }]);
      AciCli?.print?.('order ' + ord.id + ' · ' + ord.state + ' · ' + ord.total + ' ' + ord.currency, 'ok');
      return ord.id;
    }

    if (/enable|on/.test(low)) {
      const kind = (parts.find((p) => ['field', 'mesh', 'walk_in', 'phone'].includes(p)) || 'mesh');
      this.setChannelEnabled('ch_' + kind, true);
      AciCli?.print?.('channel on · ' + kind, 'ok');
      return 'on ' + kind;
    }

    if (/disable|off/.test(low)) {
      const kind = (parts.find((p) => ['field', 'mesh', 'walk_in', 'phone', 'pipe'].includes(p)) || 'mesh');
      this.setChannelEnabled('ch_' + kind, false);
      AciCli?.print?.('channel off · ' + kind, 'ok');
      return 'off ' + kind;
    }

    AciCli?.print?.('channels status | seed | publish | order | enable mesh | disable phone', 'dim');
    return 'SpaceNet CM help';
  },
};

window.SpaceNetCM = SpaceNetCM;

/* === 79-product-surface.js === */
// === PRODUCT SURFACE — MPP tile · video call · field HUD · continuity contract ===
// Restores shell pieces the assemble path dropped. Safe to run multiple times.
const ProductSurface = {
  version: '20260717-product',

  init() {
    if (this._inited) return;
    this._inited = true;
    try {
      this._injectCss();
      this._ensureCliEdge();
      this._ensureVideoCall();
      this._ensureMppTile();
      this._bootProductModules();
    } catch (e) {
      console.warn('[ProductSurface] init', e);
    }
  },

  _injectCss() {
    if (document.getElementById('product-surface-css')) return;
    const st = document.createElement('style');
    st.id = 'product-surface-css';
    st.textContent = [
      '#super-cli-bar #aci-video-call{display:inline-flex!important;align-items:center;justify-content:center;',
      'width:34px;height:34px;border-radius:50%;border:1px solid var(--ax-blue-border);',
      'background:var(--ax-blue-bg);color:var(--ax-blue-bright);font-size:14px;cursor:pointer;flex-shrink:0}',
      '#super-cli-bar #aci-video-call:active{transform:scale(0.94)}',
      '#super-cli-bar button:not(#aci-login):not(#aci-locate):not(#super-add-fab):not(#aci-handsfree):not(#aci-bridge):not(#aci-video-call):not(.app-shortcut-btn){display:none!important}',
      '#super-cli-bar #aci-locate{display:inline-flex!important;visibility:visible!important;opacity:1!important}',
      '#super-cli-edge-right{display:flex!important;align-items:center;gap:5px;margin-left:auto;flex-shrink:0}',
      '#super-cli-bar #app-shortcut-row{display:none!important}',
      '#menu-profile-post-tile{display:none;position:fixed;left:50%;bottom:calc(96px + env(safe-area-inset-bottom,0px));',
      'transform:translateX(-50%);z-index:190;width:min(420px,96vw);max-height:min(72vh,640px);overflow:auto;',
      'padding:12px;border-radius:16px;background:rgba(4,12,28,0.94);border:1px solid rgba(61,158,255,0.45);',
      'box-shadow:0 12px 40px rgba(0,0,0,0.55),0 0 20px rgba(26,111,212,0.25);color:var(--an-text,#e8f4ff);',
      'font:12px/1.4 system-ui;backdrop-filter:blur(14px);touch-action:manipulation}',
      '#menu-profile-post-tile.open{display:block}',
      '#menu-profile-post-tile.mpp-pin-pick{border-color:#ffdd44;box-shadow:0 0 18px rgba(255,221,68,0.4)}',
      '.mpp-head{display:flex;align-items:center;gap:8px;margin-bottom:8px}',
      '.mpp-head b{flex:1;font-size:13px;color:#7ec8ff}',
      '.mpp-head button{background:transparent;border:1px solid #456;color:#abc;border-radius:8px;padding:6px 8px;cursor:pointer}',
      '#mpp-coords{font-size:10px;color:#8ab;margin-bottom:8px}',
      '#mpp-roles{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}',
      '.mpp-role-chip{padding:6px 10px;border-radius:999px;border:1px solid rgba(61,158,255,0.35);background:rgba(0,20,40,0.6);',
      'color:#9cf;font-size:10px;cursor:pointer}',
      '.mpp-role-chip.on{border-color:#00dd77;color:#00ff99;background:rgba(0,221,119,0.12)}',
      '.mpp-section{display:none;margin-top:10px;padding-top:8px;border-top:1px solid rgba(80,120,160,0.25)}',
      '.mpp-section.visible{display:block}',
      '.mpp-section h4{margin:0 0 6px;font-size:11px;color:#7ec8ff}',
      '.mpp-act,.mpp-vendor,#mpp-apply,#mpp-post-now,#mpp-driver-online{width:100%;margin:4px 0;padding:10px;',
      'border-radius:10px;border:1px solid rgba(61,158,255,0.4);background:rgba(0,40,80,0.45);color:#e8f4ff;',
      'font-weight:600;cursor:pointer;font-size:11px;text-align:left}',
      '#mpp-apply{background:rgba(0,221,119,0.2);border-color:#00dd77;color:#00ff99;text-align:center}',
      '#mpp-post-now{background:rgba(255,100,40,0.18);border-color:#ff8844;color:#ffb088;text-align:center}',
      '#mpp-driver-online.on{border-color:#00dd77;color:#00ff99}',
      '#mpp-cover{height:72px;border-radius:12px;background:linear-gradient(135deg,#0a2d6b,#123);',
      'position:relative;overflow:hidden;margin-bottom:8px}',
      '#mpp-cover img{width:100%;height:100%;object-fit:cover}',
      '#mpp-avatar{width:56px;height:56px;border-radius:50%;border:2px solid #3d9eff;margin-top:-28px;margin-left:12px;',
      'background:#123;overflow:hidden;position:relative}',
      '#mpp-avatar img{width:100%;height:100%;object-fit:cover}',
      '#mpp-post-caption,#mpp-driver-schedule{width:100%;box-sizing:border-box;padding:8px;border-radius:8px;',
      'border:1px solid rgba(61,158,255,0.35);background:rgba(0,0,0,0.35);color:#e8f4ff;font:inherit;margin:4px 0}',
      '#mpp-connected-users{display:flex;flex-wrap:wrap;gap:6px;min-height:28px}',
      '.mpp-connected-user{display:flex;align-items:center;gap:6px;padding:6px 8px;border-radius:10px;',
      'border:1px solid rgba(61,158,255,0.3);background:rgba(0,20,40,0.5);cursor:pointer;font-size:10px}',
      '#mpp-market-summary{font-size:10px;color:#9ab;margin:4px 0 8px}',
      '.mpp-media-row{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0}',
      '.mpp-media-row button{flex:1;min-width:70px;padding:8px;border-radius:8px;border:1px solid #456;background:rgba(0,20,40,0.5);color:#cdf;cursor:pointer}',
      '#mpp-media-preview{max-height:100px;margin:6px 0;border-radius:8px;overflow:hidden}',
      '#mpp-media-preview img,#mpp-media-preview video{max-width:100%;max-height:100px;display:block}',
    ].join('');
    document.head.appendChild(st);
  },

  _ensureCliEdge() {
    const bar = document.getElementById('super-cli-bar');
    if (!bar) return;
    let edge = document.getElementById('super-cli-edge-right')
      || document.getElementById('toolbar-trust-actions');
    if (!edge) {
      edge = document.createElement('div');
      edge.id = 'super-cli-edge-right';
      edge.style.cssText = 'display:flex;align-items:center;gap:6px;margin-left:auto';
      bar.appendChild(edge);
    }
    if (!edge.id || edge.id === 'toolbar-trust-actions') {
      edge.id = 'super-cli-edge-right';
    }
    // Trust order: 🎯 · 🎧 · 🛠 · 📹 · +  (never put 🎯 in hidden app-shortcut-row)
    const order = ['aci-locate', 'aci-handsfree', 'aci-bridge', 'aci-video-call', 'super-add-fab'];
    order.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === 'aci-locate') {
        el.classList.remove('app-shortcut-btn');
        el.hidden = false;
        el.style.display = 'inline-flex';
        el.removeAttribute('hidden');
      }
      if (el.parentElement !== edge) edge.appendChild(el);
    });
    // If MPP wrongly parked locate in app-shortcut-row, pull it back
    const loc = document.getElementById('aci-locate');
    const badRow = document.getElementById('app-shortcut-row');
    if (loc && badRow && badRow.contains(loc)) {
      const hf = document.getElementById('aci-handsfree');
      if (hf && edge.contains(hf)) edge.insertBefore(loc, hf);
      else edge.prepend(loc);
    }
  },

  _ensureVideoCall() {
    if (document.getElementById('aci-video-call')) return;
    const edge = document.getElementById('super-cli-edge-right');
    const fab = document.getElementById('super-add-fab');
    if (!edge || !fab) return;
    const btn = document.createElement('button');
    btn.id = 'aci-video-call';
    btn.type = 'button';
    btn.title = 'Video call — open peers';
    btn.setAttribute('aria-label', 'Video call');
    btn.textContent = '📹';
    edge.insertBefore(btn, fab);
  },

  _ensureMppTile() {
    if (document.getElementById('menu-profile-post-tile')) {
      this._ensureCityDnaSection();
      return;
    }
    const tile = document.createElement('div');
    tile.id = 'menu-profile-post-tile';
    tile.innerHTML = [
      '<div class="mpp-head">',
      '<b>▸ Super Add field</b>',
      '<button type="button" id="mpp-pin-pick" title="Pick pin on map">📍</button>',
      '<button type="button" id="mpp-close" title="Close">✖</button>',
      '</div>',
      '<div id="mpp-coords">📍 —</div>',
      '<div id="mpp-cover"><button type="button" id="mpp-cover-edit" style="position:absolute;right:8px;bottom:8px">Cover</button>',
      '<input id="mpp-cover-file" type="file" accept="image/*" hidden /></div>',
      '<div id="mpp-avatar"><button type="button" id="mpp-avatar-edit" style="position:absolute;right:-4px;bottom:-4px;font-size:10px">✎</button>',
      '<input id="mpp-avatar-file" type="file" accept="image/*" hidden /></div>',
      '<div id="mpp-roles">',
      '<button type="button" class="mpp-role-chip on" data-mpp-role="client">Client</button>',
      '<button type="button" class="mpp-role-chip" data-mpp-role="vendor">Vendor</button>',
      '<button type="button" class="mpp-role-chip" data-mpp-role="driver">Driver</button>',
      '<button type="button" class="mpp-role-chip on" data-mpp-role="user">User</button>',
      '<button type="button" class="mpp-role-chip on" data-mpp-role="social">Social</button>',
      '</div>',
      '<div id="mpp-section-market" class="mpp-section visible">',
      '<h4>Marketplace</h4>',
      '<div id="mpp-market-summary">Cart · delivery pin · Coins</div>',
      '<button type="button" class="mpp-act" data-mpp-act="browse_shops">Browse shops</button>',
      '<button type="button" class="mpp-act" data-mpp-act="set_delivery">Set delivery pin</button>',
      '<button type="button" class="mpp-act" data-mpp-act="place_cart">Place order (cart)</button>',
      '<button type="button" class="mpp-act" data-mpp-act="track_delivery">Track delivery</button>',
      '<div id="mpp-vendors"></div>',
      '</div>',
      '<div id="mpp-section-vendor" class="mpp-section">',
      '<h4>Vendor</h4>',
      '<button type="button" class="mpp-act" data-mpp-act="list_shop">List my shop here</button>',
      '<button type="button" class="mpp-act" data-mpp-act="browse_shops">Nearby shops</button>',
      '</div>',
      '<div id="mpp-section-driver" class="mpp-section">',
      '<h4>Driver</h4>',
      '<button type="button" id="mpp-driver-online" aria-pressed="false">Go online</button>',
      '<select id="mpp-driver-schedule"><option value="now">Available now</option>',
      '<option value="later">Later today</option><option value="off">Offline</option></select>',
      '<button type="button" class="mpp-act" data-mpp-act="set_driver_base">Set driver base</button>',
      '</div>',
      '<div id="mpp-section-user" class="mpp-section visible">',
      '<h4>Profile</h4>',
      '<button type="button" class="mpp-act" data-mpp-act="open_profile">Open profile site</button>',
      '<button type="button" class="mpp-act" data-mpp-act="set_delivery">Delivery address on map</button>',
      '</div>',
      '<div id="mpp-section-citydna" class="mpp-section visible">',
      '<h4>City DNA · jobs · dates · errands</h4>',
      '<div id="mpp-citydna-summary" style="font-size:10px;color:#9ab;margin:0 0 6px">Same as pizza: open → claim → done</div>',
      '<button type="button" class="mpp-act" data-mpp-act="post_job">💼 Post job (barman 3h…)</button>',
      '<button type="button" class="mpp-act" data-mpp-act="post_date">💕 Post date (coffee 2h…)</button>',
      '<button type="button" class="mpp-act" data-mpp-act="post_errand">🏃 Post errand</button>',
      '<button type="button" class="mpp-act" data-mpp-act="list_city_tasks">📋 Open tasks nearby</button>',
      '<button type="button" class="mpp-act" data-mpp-act="claim_open_task">✋ Claim open task</button>',
      '</div>',
      '<div id="mpp-section-social" class="mpp-section visible">',
      '<h4>Social post</h4>',
      '<textarea id="mpp-post-caption" rows="2" placeholder="Caption · job · date · errand…"></textarea>',
      '<div class="mpp-media-row">',
      '<button type="button" id="mpp-pick-photo">Photo</button>',
      '<button type="button" id="mpp-pick-video">Video</button>',
      '<button type="button" id="mpp-media-clear">Clear</button>',
      '</div>',
      '<input id="mpp-photo-file" type="file" accept="image/*" hidden />',
      '<input id="mpp-video-file" type="file" accept="video/*" hidden />',
      '<div id="mpp-media-preview"></div>',
      '<button type="button" id="mpp-post-now">Post now on globe</button>',
      '<button type="button" class="mpp-act" data-mpp-act="post_lust">Post pin</button>',
      '</div>',
      '<div id="mpp-connected" class="mpp-section visible">',
      '<h4>Connected · tap to video</h4>',
      '<div id="mpp-connected-users"></div>',
      '</div>',
      '<button type="button" id="mpp-apply">Primary action</button>',
    ].join('');
    document.body.appendChild(tile);
  },

  /** Inject City DNA actions into live MPP if shell already had an older tile */
  _ensureCityDnaSection() {
    if (document.getElementById('mpp-section-citydna')) return;
    const social = document.getElementById('mpp-section-social');
    const host = document.getElementById('menu-profile-post-tile');
    if (!host) return;
    const sec = document.createElement('div');
    sec.id = 'mpp-section-citydna';
    sec.className = 'mpp-section visible';
    sec.innerHTML = '<h4>City DNA · jobs · dates · errands</h4>'
      + '<div id="mpp-citydna-summary" style="font-size:10px;color:#9ab;margin:0 0 6px">Same as pizza: open → claim → done</div>'
      + '<button type="button" class="mpp-act" data-mpp-act="post_job">💼 Post job (barman 3h…)</button>'
      + '<button type="button" class="mpp-act" data-mpp-act="post_date">💕 Post date (coffee 2h…)</button>'
      + '<button type="button" class="mpp-act" data-mpp-act="post_errand">🏃 Post errand</button>'
      + '<button type="button" class="mpp-act" data-mpp-act="list_city_tasks">📋 Open tasks nearby</button>'
      + '<button type="button" class="mpp-act" data-mpp-act="claim_open_task">✋ Claim open task</button>';
    if (social) host.insertBefore(sec, social);
    else host.appendChild(sec);
    // Bind if MPP already inited
    sec.querySelectorAll('.mpp-act[data-mpp-act]').forEach(btn => {
      btn.addEventListener('click', () => {
        const act = btn.getAttribute('data-mpp-act');
        if (window.MenuProfilePostTile?.runAction) MenuProfilePostTile.runAction(act);
        else this._cityDnaFallback(act);
      });
    });
  },

  _cityDnaFallback(act) {
    CityTasks?.init?.();
    const cap = (document.getElementById('mpp-post-caption')?.value || '').trim();
    const pin = window.MenuProfilePostTile?.pin || window._lastPos || { lat: 36.43, lng: 28.22 };
    if (act === 'post_job') {
      CityTasks.postJob({ rawText: cap || 'barman 3h', title: cap || undefined, lat: pin.lat, lng: pin.lng });
    } else if (act === 'post_date') {
      CityTasks.postDate({ rawText: cap || 'coffee date 2h', lat: pin.lat, lng: pin.lng });
    } else if (act === 'post_errand') {
      CityTasks.postErrand({ rawText: cap || 'pharmacy', lat: pin.lat, lng: pin.lng });
    } else if (act === 'list_city_tasks') {
      CityTasks.handleCli('task list');
    } else if (act === 'claim_open_task') {
      CityTasks.claim(null);
    }
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[src^="' + src.split('?')[0] + '"]')) {
        resolve();
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('load ' + src));
      document.head.appendChild(s);
    });
  },

  async loadProductScripts() {
    if (this._scriptsLoading || this._scriptsReady) return this._scriptsLoading;
    const build = document.querySelector('meta[name="astranov-build"]')?.content || '';
    const q = build ? '?v=' + encodeURIComponent(build) : '';
    this._scriptsLoading = Promise.all([
      this._loadScript('/astranov-field-hud.js' + q),
      this._loadScript('/astranov-mpp-tile.js' + q),
    ]).then(() => {
      this._scriptsReady = true;
      this._bootProductModules();
    }).catch((e) => {
      console.warn('[ProductSurface] scripts', e);
      this._scriptsLoading = null;
    });
    return this._scriptsLoading;
  },

  _bootProductModules() {
    try {
      if (window.FieldHud?.boot) FieldHud.boot();
      else if (window.FieldHud?.injectDom) {
        FieldHud.injectCss?.();
        FieldHud.injectDom?.();
        FieldHud.bindFieldMiner?.();
        FieldHud.patchSuperCli?.();
      }
    } catch (e) { console.warn('[ProductSurface] FieldHud', e); }

    try {
      if (window.MenuProfilePostTile?.init) MenuProfilePostTile.init();
    } catch (e) { console.warn('[ProductSurface] MPP', e); }

    // Wire + to MPP (load scripts on first tap if needed)
    const fab = document.getElementById('super-add-fab');
    if (fab && !fab._psBound) {
      fab._psBound = true;
      fab.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopImmediatePropagation();
        const open = () => {
          if (window.MenuProfilePostTile?.openPlusField) MenuProfilePostTile.openPlusField();
          else AciCli?.print?.('Super Add loading…', 'dim');
        };
        if (window.MenuProfilePostTile) open();
        else this.loadProductScripts().then(open);
      }, true);
    }
    const vid = document.getElementById('aci-video-call');
    if (vid && !vid._psBound) {
      vid._psBound = true;
      vid.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const run = () => MenuProfilePostTile?._openVideoCall?.();
        if (window.MenuProfilePostTile) run();
        else this.loadProductScripts().then(run);
      }, true);
    }
  },
};

// Kick product scripts after first paint (not during core parse)
setTimeout(() => {
  try {
    if (window.ProductSurface) {
      ProductSurface.init?.();
      const delay = window._globePerfLite ? 2200 : 900;
      setTimeout(() => ProductSurface.loadProductScripts?.(), delay);
    }
  } catch (_) {}
}, 400);
window.ProductSurface = ProductSurface;

/* === 78-globe-info-tiles.js === */
// === GLOBE INFO + VIDEO TILES ===
// Popup labels that ride the rotating globe (same system as SpaceNet place tiles).
// SpaceX / YouTube updates pin as media tiles · crawl results pin as info tiles.
const GlobeInfoTiles = {
  version: '20260717-tiles',
  _lastSpaceX: 0,
  SPACEX_PINS: {
    starbase: { lat: 25.9971, lng: -97.1554, name: 'Starbase · Pad 2' },
    cape: { lat: 28.5623, lng: -80.5774, name: 'Cape Canaveral' },
    vandenberg: { lat: 34.6321, lng: -120.6106, name: 'Vandenberg' },
    hawthorne: { lat: 33.9207, lng: -118.3280, name: 'SpaceX HQ' },
  },

  init(opts) {
    if (this._inited) return;
    this._inited = true;
    opts = opts || {};
    window.GlobeInfoTiles = this;
    this._wireSuperSpace();
    // NEVER auto-fetch YouTube/Piped on boot — kills mobile main thread
    // Pin one static F13 marker only (no network)
    if (opts.seed !== false) {
      setTimeout(() => {
        try {
          this.pinInfo({
            id: 'spacex-f13-event',
            lat: this.SPACEX_PINS.starbase.lat,
            lng: this.SPACEX_PINS.starbase.lng,
            title: 'Starship Flight 13',
            description: 'Tap · or type spacex / starship',
            icon: '🚀',
            color: 0xff6622,
            urgency: 2,
            fly: false,
            onTap: async () => {
              await this.refreshSpaceXVideos({ fly: true });
              StarshipFlight13?.focusPad?.();
            },
          });
        } catch (e) {
          console.warn('[GlobeInfoTiles] seed soft-fail', e);
        }
      }, window._globePerfLite ? 6000 : 3500);
    }
    console.log('%c[GlobeInfoTiles] video/info tiles · demand-load', 'color:#3d9eff;font-weight:700');
  },

  _wireSuperSpace() {
    const self = this;
    window.SuperSpace = Object.assign(window.SuperSpace || {}, {
      init() { self.init(); },
      stop() {},
      tick() {},
      status() {
        return {
          tiles: self.count(),
          version: self.version,
        };
      },
      async locateForMedia(query, meta) {
        return self.pinVideoFromMeta(query, meta);
      },
      async locateText(text) {
        return self.pinInfoFromQuery(text);
      },
      zoomTo(level) {
        if (level === 'orbit' || level === 'space') {
          if (typeof camera !== 'undefined' && camera?.position) {
            window._globeFly = {
              mode: 'zoom', fromZ: camera.position.z, toZ: 5.05,
              t0: performance.now(), dur: 1200,
            };
          }
          if (window.CosmicZoom) CosmicZoom.level = 'orbit';
        }
      },
    });
  },

  count() {
    let n = 0;
    GlobeEntity?.entities?.forEach?.(e => {
      if (e.type === 'media' || e.type === 'news' || e.data?.infoTile) n++;
    });
    return n;
  },

  /** Resolve a place name / query to lat/lng (known POIs + heuristics). */
  resolvePlace(query) {
    const q = String(query || '').toLowerCase();
    if (/starbase|boca\s*chica|pad\s*2|starship/.test(q)) return { ...this.SPACEX_PINS.starbase };
    if (/cape\s*canaveral|kennedy|ksc|falcon/.test(q)) return { ...this.SPACEX_PINS.cape };
    if (/vandenberg|vafb|slc-4/.test(q)) return { ...this.SPACEX_PINS.vandenberg };
    if (/hawthorne|spacex\s*hq/.test(q)) return { ...this.SPACEX_PINS.hawthorne };
    if (/iss|space\s*station/.test(q)) {
      const iss = CosmicZoom?.issMarker?.userData;
      if (iss?.lat != null) return { lat: iss.lat, lng: iss.lng, name: 'ISS' };
      return { lat: 0, lng: -90, name: 'ISS (approx)' };
    }
    if (/mars|olympus\s*mons/.test(q)) return { lat: 18.65, lng: -133.8, name: 'Mars · Olympus (map proxy)' };
    if (/moon|lunar/.test(q)) return { lat: 0.67, lng: 23.47, name: 'Moon · Sea of Tranquility (proxy)' };
    if (/athens|αθήνα/.test(q)) return { lat: 37.9838, lng: 23.7275, name: 'Athens' };
    if (/rhodes|ρόδο/.test(q)) return { lat: 36.4341, lng: 28.2176, name: 'Rhodes' };
    const u = window._lastPos;
    if (u) return { lat: u.lat, lng: u.lng, name: 'Near you' };
    return { lat: 25.9971, lng: -97.1554, name: 'Starbase' };
  },

  pinInfo(opts) {
    opts = opts || {};
    const lat = opts.lat;
    const lng = opts.lng;
    if (lat == null || lng == null) return null;
    const id = opts.id || ('info-' + Math.round(lat * 100) + '-' + Math.round(lng * 100) + '-' + Date.now().toString(36).slice(-4));
    const entity = GlobeEntity?.register?.({
      id,
      type: opts.type || 'place',
      lat, lng,
      title: (opts.title || 'Info').slice(0, 64),
      description: (opts.description || opts.body || '').slice(0, 140),
      icon: opts.icon || '◎',
      urgency: opts.urgency != null ? opts.urgency : 3,
      color: opts.color || 0x3d9eff,
      persist: opts.persist !== false,
      expires: opts.expires || 0,
      altitude: opts.altitude || 1.032,
      data: {
        alwaysShowLabel: true,
        infoTile: true,
        body: opts.body || opts.description,
        url: opts.url,
        ...(opts.data || {}),
      },
      _actionLabel: opts.actionLabel || 'Open',
      onTap: opts.onTap || (() => {
        GlobeEntity?.select?.(entity);
        if (opts.url) window.open(opts.url, '_blank', 'noopener');
        ACIControl?.reply?.((opts.title || 'Info') + ' — ' + (opts.description || '').slice(0, 80));
      }),
    });
    if (opts.fly !== false) {
      GlobeControl?.flyToLatLng?.(lat, lng, opts.title || 'info', opts.zoom || GlobeControl?.Z?.national || 1.82, {});
    }
    MapDepict?.pulse?.(lat, lng, opts.color || 0x3d9eff, (opts.title || 'info').slice(0, 28), 8000);
    return entity;
  },

  pinVideo(opts) {
    opts = opts || {};
    const idYt = GlobeVideo?.parseId?.(opts.videoId || opts.url || opts.id);
    if (!idYt) return null;
    const place = opts.lat != null
      ? { lat: opts.lat, lng: opts.lng, name: opts.placeName || 'Location' }
      : this.resolvePlace(opts.placeQuery || opts.query || opts.title);
    const id = opts.entityId || ('vid-' + idYt);
    const thumb = opts.thumbnail || ('https://i.ytimg.com/vi/' + idYt + '/hqdefault.jpg');
    const title = (opts.title || 'Video').slice(0, 72);
    const desc = (opts.channel || opts.description || 'Tap to play on globe').slice(0, 100);

    const entity = GlobeEntity?.register?.({
      id,
      type: 'media',
      lat: place.lat,
      lng: place.lng,
      title: '▶ ' + title,
      description: desc,
      icon: '🎬',
      urgency: 3,
      color: 0xff6622,
      persist: opts.persist !== false,
      expires: opts.expires || 0,
      altitude: opts.altitude || 1.035,
      data: {
        alwaysShowLabel: true,
        pinVideo: true,
        youtubeId: idYt,
        thumbnail: thumb,
        infoTile: true,
        query: opts.query,
        placeName: place.name,
      },
      _actionLabel: 'Play video',
      onTap: () => {
        MapComms?.showCloudVideo?.(idYt, title);
        LazyModules?.ensure?.().then(() => {
          GlobeVideo?.play?.(idYt, { title, channel: opts.channel }, opts.query || title);
        });
        GlobeControl?.flyToLatLng?.(place.lat, place.lng, title.slice(0, 40), GlobeControl?.Z?.national || 1.82, {});
      },
    });

    // Enrich label with thumbnail (rotating tile)
    this._paintVideoLabel(entity, thumb, title, place.name);

    if (opts.fly !== false) {
      GlobeControl?.flyToLatLng?.(place.lat, place.lng, place.name || title.slice(0, 32), opts.zoom || GlobeControl?.Z?.national || 1.82, {});
    }
    MapDepict?.action?.('video', { lat: place.lat, lng: place.lng, detail: title.slice(0, 40) });
    AciCli?.print?.('video tile · ' + title.slice(0, 50) + ' @ ' + (place.name || ''), 'ok');
    return entity;
  },

  _paintVideoLabel(entity, thumb, title, placeName) {
    if (!entity?._labelEl) return;
    const el = entity._labelEl;
    el.classList.add('ge-video-tile', 'ge-travel-label');
    el.innerHTML = '<div class="ge-vid-thumb"><img src="' + this.esc(thumb) + '" alt="" loading="lazy" /></div>'
      + '<div class="ge-text"><b>' + this.esc(title.slice(0, 48)) + '</b>'
      + '<span>' + this.esc(placeName || 'Globe') + ' · tap play</span></div>';
    el.style.display = 'flex';
    el.onclick = (ev) => {
      ev.stopPropagation();
      entity.onTap?.(entity);
    };
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  async pinVideoFromMeta(query, meta) {
    const id = meta?.id || GlobeVideo?.parseId?.(meta?.url) || GlobeVideo?.parseId?.(query);
    if (!id) {
      // fall back to place pin for query
      return this.pinInfoFromQuery(query);
    }
    return this.pinVideo({
      videoId: id,
      title: meta?.title || query,
      channel: meta?.channel,
      thumbnail: meta?.thumbnail,
      query,
      placeQuery: query,
      fly: true,
    });
  },

  async pinInfoFromQuery(text) {
    const place = this.resolvePlace(text);
    // Run SpaceNet crawl at place + pin summary tile
    void SpaceNetBrain?.crawlAll?.(place.lat, place.lng, 2);
    return this.pinInfo({
      lat: place.lat,
      lng: place.lng,
      title: place.name,
      description: String(text || 'Requested info').slice(0, 120),
      icon: '◎',
      urgency: 3,
      actionLabel: 'Explore',
      onTap: () => {
        MapPlaceMenu?.openAt?.(place.lat, place.lng, { label: place.name });
        SpaceNetBrain?.crawlAll?.(place.lat, place.lng, 3, { force: true });
      },
    });
  },

  /** Seed SpaceX / Starship video tiles (search + known NET pin). */
  async seedSpaceXTiles() {
    const now = Date.now();
    if (now - this._lastSpaceX < 10 * 60 * 1000 && this.count() > 0) return;
    this._lastSpaceX = now;

    // Always pin F13 event tile at Starbase
    this.pinInfo({
      id: 'spacex-f13-event',
      lat: this.SPACEX_PINS.starbase.lat,
      lng: this.SPACEX_PINS.starbase.lng,
      title: 'Starship Flight 13',
      description: 'NET window · type starship to sim · tap for SpaceX videos',
      icon: '🚀',
      color: 0xff6622,
      urgency: 3,
      fly: false,
      actionLabel: 'SpaceX videos',
      onTap: async () => {
        await this.refreshSpaceXVideos({ fly: true });
        StarshipFlight13?.focusPad?.();
      },
    });

    // Async video search — never block boot
    void this.refreshSpaceXVideos({ fly: false });
  },

  async refreshSpaceXVideos(opts) {
    opts = opts || {};
    try {
      await LazyModules?.ensure?.();
      const queries = [
        'SpaceX Starship Flight 13',
        'SpaceX launch live',
        'SpaceX Starlink mission',
      ];
      const places = [
        this.SPACEX_PINS.starbase,
        this.SPACEX_PINS.cape,
        this.SPACEX_PINS.hawthorne,
      ];
      let placed = 0;
      for (let i = 0; i < queries.length; i++) {
        try {
          const items = await GlobeVideo?.pipedSearch?.(queries[i]);
          const v = items?.[0];
          if (!v?.id) continue;
          const place = places[i % places.length];
          this.pinVideo({
            videoId: v.id,
            title: v.title,
            channel: v.channel || 'SpaceX',
            thumbnail: v.thumbnail,
            lat: place.lat,
            lng: place.lng,
            placeName: place.name,
            query: queries[i],
            fly: false,
            entityId: 'spacex-yt-' + i + '-' + v.id,
          });
          placed++;
        } catch (_) { /* next query */ }
      }
      if (placed && opts.fly !== false) {
        const p = this.SPACEX_PINS.starbase;
        GlobeControl?.flyToLatLng?.(p.lat, p.lng, 'SpaceX tiles', GlobeControl?.Z?.national || 1.9, {});
      }
      if (placed) {
        CliRibbon?.setNotice?.('SpaceX · ' + placed + ' video tiles on globe', 'ready');
        AciCli?.print?.('SpaceX video tiles · ' + placed + ' on globe', 'ok');
      }
      return placed;
    } catch (e) {
      AciCli?.print?.('SpaceX tiles · ' + (e.message || e), 'dim');
      return 0;
    }
  },

  /** SpaceNet crawler result → globe tile */
  pinCrawlResult(kind, data, lat, lng) {
    const place = { lat: lat ?? window._lastPos?.lat ?? 36.43, lng: lng ?? window._lastPos?.lng ?? 28.22 };
    if (kind === 'weather' && data) {
      return this.pinInfo({
        id: 'wx-' + place.lat.toFixed(2) + '-' + place.lng.toFixed(2),
        lat: place.lat, lng: place.lng,
        title: 'Weather · ' + (data.temp_c ?? '?') + '°C',
        description: 'Wind ' + (data.wind ?? '?') + ' · precip ' + (data.precip ?? 0),
        icon: '🌤',
        color: 0x66ccff,
        fly: false,
        expires: 20 * 60 * 1000,
      });
    }
    if (kind === 'drivers' && data?.count != null) {
      return this.pinInfo({
        id: 'drv-' + place.lat.toFixed(2),
        lat: place.lat, lng: place.lng,
        title: 'Drivers · ' + data.count,
        description: 'Delivery fleet near you',
        icon: '🚚',
        fly: false,
      });
    }
    if (kind === 'vendors' || kind === 'places') {
      const n = data?.count ?? data?.results?.places?.count;
      return this.pinInfo({
        id: 'shops-' + place.lat.toFixed(2),
        lat: place.lat, lng: place.lng,
        title: 'Shops · sector',
        description: n != null ? (n + ' found · crawl') : 'SpaceNet places',
        icon: '🏬',
        fly: false,
      });
    }
    return null;
  },

  wants(text) {
    return /spacex\s*video|video\s*tile|globe\s*video|starship\s*video|show\s*spacex|tiles?\s*on\s*globe/i.test(String(text || ''));
  },

  async handleCli(line) {
    const low = String(line || '').toLowerCase();
    if (/spacex|starship|flight\s*13|f13/.test(low)) {
      const n = await this.refreshSpaceXVideos({ fly: true });
      StarshipFlight13?.focusPad?.();
      return 'SpaceX video tiles · ' + n + ' · Starbase';
    }
    if (/refresh|reload/.test(low)) {
      const n = await this.refreshSpaceXVideos({ fly: true });
      return 'Refreshed · ' + n + ' tiles';
    }
    // Freeform: pin video search at resolved place
    const q = String(line || '').replace(/^(video\s*tile|tiles?|spacex)\s*/i, '').trim() || 'SpaceX';
    await LazyModules?.ensure?.();
    try {
      const items = await GlobeVideo?.pipedSearch?.(q);
      if (items?.[0]) {
        this.pinVideo({
          videoId: items[0].id,
          title: items[0].title,
          channel: items[0].channel,
          thumbnail: items[0].thumbnail,
          query: q,
          placeQuery: q,
          fly: true,
        });
        return 'Video tile · ' + items[0].title.slice(0, 48);
      }
    } catch (_) {}
    this.pinInfoFromQuery(q);
    return 'Info tile pinned for · ' + q.slice(0, 40);
  },
};
window.GlobeInfoTiles = GlobeInfoTiles;

/* === 75-starship-flight13.js === */
// === STARSHIP FLIGHT 13 — lean globe launch / replay simulation ===
// Event sim for Starbase Pad 2 · not full physics. NET updates from SpaceX.
const StarshipFlight13 = {
  version: '20260717-f13',
  // Pad 2 Starbase (approx)
  PAD: { lat: 25.9971, lng: -97.1554, name: 'Starbase Pad 2' },
  // Official window open pattern: 5:45 p.m. CT = 22:45 UTC
  NET_UTC: Date.UTC(2026, 6, 20, 22, 45, 0),
  WINDOW_MIN: 90,
  playing: false,
  _raf: null,
  _t0: 0,
  _elapsed: 0,
  _speed: 1,
  _group: null,
  _ship: null,
  _booster: null,
  _trail: null,
  _hud: null,
  _phase: 'idle',
  _lastHud: 0,

  // Approximate public test profile (suborbital ship · Gulf booster · Indian Ocean entry)
  PHASES: [
    { t: 0, id: 'liftoff', label: 'Liftoff', event: '33 engines · Pad 2' },
    { t: 60, id: 'maxq', label: 'Max-Q', event: 'Peak aerodynamic pressure' },
    { t: 160, id: 'hotstage', label: 'Hot-staging', event: 'Ship ignition · stage sep' },
    { t: 180, id: 'boostback', label: 'Boostback', event: 'Booster flip · Gulf' },
    { t: 400, id: 'boostland', label: 'Booster splash', event: 'Gulf of Mexico water landing' },
    { t: 520, id: 'coast', label: 'Ship coast', event: 'Suborbital arc · Starlink V3 bay' },
    { t: 900, id: 'deploy', label: 'Payload window', event: 'Starlink V3 deploy opportunity' },
    { t: 2700, id: 'entry', label: 'Entry', event: 'Ship reentry · Indian Ocean' },
    { t: 3300, id: 'splash', label: 'Splashdown', event: 'Controlled splash · end of test' },
  ],

  // Great-circle samples: Starbase → Gulf → mid-Atlantic coast → Indian Ocean splash zone
  PATH_SHIP: [
    { t: 0, lat: 25.9971, lng: -97.1554, alt: 1.0 },
    { t: 60, lat: 26.4, lng: -96.4, alt: 1.02 },
    { t: 160, lat: 27.8, lng: -94.2, alt: 1.06 },
    { t: 400, lat: 30.5, lng: -88.0, alt: 1.09 },
    { t: 900, lat: 20.0, lng: -40.0, alt: 1.12 },
    { t: 1800, lat: 0.0, lng: 20.0, alt: 1.10 },
    { t: 2700, lat: -20.0, lng: 55.0, alt: 1.05 },
    { t: 3300, lat: -30.0, lng: 75.0, alt: 1.0 },
  ],
  PATH_BOOSTER: [
    { t: 0, lat: 25.9971, lng: -97.1554, alt: 1.0 },
    { t: 160, lat: 27.8, lng: -94.2, alt: 1.06 },
    { t: 250, lat: 27.2, lng: -94.8, alt: 1.04 },
    { t: 400, lat: 26.5, lng: -95.5, alt: 1.0 },
  ],

  init() {
    if (this._inited) return;
    this._inited = true;
    window.StarshipFlight13 = this;
    try {
      this._ensureGroup();
      this._ensureHud();
    } catch (e) {
      console.warn('[StarshipFlight13] init soft-fail', e);
    }
    console.log('%c[StarshipFlight13] F13 sim ready · say starship / flight 13', 'color:#ff8844;font-weight:700');
  },

  _ensureGroup() {
    if (this._group || typeof THREE === 'undefined' || typeof globePivot === 'undefined') return;
    this._group = new THREE.Group();
    this._group.name = 'starship-f13';
    this._group.visible = false;
    globePivot.add(this._group);

    const bodyGeo = new THREE.CylinderGeometry(0.008, 0.012, 0.055, 8);
    const bodyMat = new THREE.MeshBasicMaterial({ color: 0xdde8f0 });
    this._ship = new THREE.Mesh(bodyGeo, bodyMat.clone());
    this._ship.userData = { kind: 'ship', name: 'Ship · F13' };
    this._group.add(this._ship);

    this._booster = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.07, 8),
      new THREE.MeshBasicMaterial({ color: 0xaabbcc })
    );
    this._booster.userData = { kind: 'booster', name: 'Booster · F13' };
    this._group.add(this._booster);

    const trailGeo = new THREE.BufferGeometry();
    const trailPos = new Float32Array(90);
    trailGeo.setAttribute('position', new THREE.BufferAttribute(trailPos, 3));
    this._trail = new THREE.Line(
      trailGeo,
      new THREE.LineBasicMaterial({ color: 0xff6622, transparent: true, opacity: 0.75 })
    );
    this._trail.frustumCulled = false;
    this._group.add(this._trail);
    this._trailPts = [];
  },

  _ensureHud() {
    if (this._hud || typeof document === 'undefined') return;
    let el = document.getElementById('starship-f13-hud');
    if (!el) {
      el = document.createElement('div');
      el.id = 'starship-f13-hud';
      el.setAttribute('aria-live', 'polite');
      el.style.cssText = [
        'position:fixed', 'left:50%', 'bottom:calc(88px + env(safe-area-inset-bottom,0px))',
        'transform:translateX(-50%)', 'z-index:95', 'max-width:min(92vw,420px)',
        'padding:8px 12px', 'border-radius:12px', 'pointer-events:none',
        'background:rgba(8,12,20,0.82)', 'border:1px solid rgba(255,120,60,0.45)',
        'color:#ffe8d8', 'font:600 12px/1.35 system-ui,sans-serif',
        'box-shadow:0 8px 28px rgba(0,0,0,0.45)', 'display:none', 'text-align:center',
      ].join(';');
      document.body.appendChild(el);
    }
    this._hud = el;
  },

  netMs() { return this.NET_UTC; },

  countdownText(nowMs) {
    const d = this.NET_UTC - (nowMs || Date.now());
    if (d <= 0) return 'NET open · window ' + this.WINDOW_MIN + 'm · T+ live or replay';
    const s = Math.floor(d / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return 'NET T−' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0') + ':' + String(sec).padStart(2, '0')
      + ' · 20 Jul 2026 22:45 UTC · Starbase';
  },

  phaseAt(t) {
    let cur = this.PHASES[0];
    for (const p of this.PHASES) {
      if (t >= p.t) cur = p;
      else break;
    }
    return cur;
  },

  _lerpPath(path, t) {
    if (!path.length) return null;
    if (t <= path[0].t) return { ...path[0] };
    if (t >= path[path.length - 1].t) return { ...path[path.length - 1] };
    for (let i = 0; i < path.length - 1; i++) {
      const a = path[i];
      const b = path[i + 1];
      if (t >= a.t && t <= b.t) {
        const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
        return {
          lat: a.lat + (b.lat - a.lat) * u,
          lng: a.lng + (b.lng - a.lng) * u,
          alt: a.alt + (b.alt - a.alt) * u,
        };
      }
    }
    return { ...path[path.length - 1] };
  },

  _place(mesh, sample) {
    if (!mesh || !sample || typeof latLngToPos !== 'function') return;
    const p = latLngToPos(sample.lat, sample.lng, sample.alt);
    mesh.position.set(p.x, p.y, p.z);
    // Point roughly outward
    mesh.lookAt(0, 0, 0);
    mesh.rotateX(Math.PI / 2);
  },

  _pushTrail(sample) {
    if (!sample || !this._trail) return;
    const p = latLngToPos(sample.lat, sample.lng, sample.alt);
    this._trailPts.push(p.x, p.y, p.z);
    if (this._trailPts.length > 90) this._trailPts = this._trailPts.slice(-90);
    const arr = this._trail.geometry.attributes.position.array;
    for (let i = 0; i < 90; i++) arr[i] = this._trailPts[i] ?? this._trailPts[this._trailPts.length - 1] ?? 0;
    this._trail.geometry.attributes.position.needsUpdate = true;
    this._trail.geometry.setDrawRange(0, Math.floor(this._trailPts.length / 3));
  },

  _setHud(html, show) {
    this._ensureHud();
    if (!this._hud) return;
    this._hud.style.display = show === false ? 'none' : 'block';
    if (html != null) this._hud.innerHTML = html;
  },

  focusPad() {
    this._ensureGroup();
    GlobeControl?.flyToLatLng?.(this.PAD.lat, this.PAD.lng, 'Starbase · F13', GlobeControl?.Z?.national || 1.9, {});
    MapDepict?.pulse?.(this.PAD.lat, this.PAD.lng, 0xff6622, 'Pad 2 · F13', 12000);
    ZoomTiers?.goTo?.('national', true);
  },

  start(opts) {
    opts = opts || {};
    this.init();
    this._ensureGroup();
    this._ensureHud();
    // Snap camera once — don't spam fly every phase
    if (!opts.silent) this.focusPad();
    this._speed = Math.max(0.25, Math.min(60, opts.speed || (opts.realtime ? 1 : 12)));
    this.playing = true;
    this._elapsed = opts.fromT || 0;
    this._t0 = performance.now();
    this._trailPts = [];
    this._phase = 'liftoff';
    if (this._group) this._group.visible = true;
    if (this._booster) this._booster.visible = true;
    if (this._ship) this._ship.visible = true;
    const mode = opts.realtime ? 'live clock' : ('×' + this._speed + ' replay');
    AciCli?.print?.('starship f13 · ' + mode + ' · NET ' + new Date(this.NET_UTC).toISOString(), 'ok');
    CliRibbon?.setNotice?.('F13 · ' + mode, 'ready');
    GlobeDeck?.say?.('Starship Flight 13 sim — ' + mode, 'ok');
    this._setHud('<b>F13</b> · ' + mode + '<br>' + this.countdownText(), true);
    this._tick();
    return { ok: true, mode, net: this.NET_UTC };
  },

  stop() {
    this.playing = false;
    if (this._group) this._group.visible = false;
    this._setHud(null, false);
    AciCli?.print?.('starship f13 · stopped', 'dim');
  },

  _tick() {
    if (!this.playing) return;
    const now = performance.now();
    const dt = (now - this._t0) / 1000;
    this._t0 = now;
    this._elapsed += dt * this._speed;
    const t = this._elapsed;
    const phase = this.phaseAt(t);
    this._phase = phase.id;

    const ship = this._lerpPath(this.PATH_SHIP, t);
    const boost = this._lerpPath(this.PATH_BOOSTER, Math.min(t, 400));
    this._place(this._ship, ship);
    if (t < 160) {
      this._place(this._booster, ship);
      if (this._booster) this._booster.visible = true;
    } else if (t < 420) {
      this._place(this._booster, boost);
      if (this._booster) this._booster.visible = true;
    } else if (this._booster) {
      this._booster.visible = false;
    }
    if (ship && t % 0.2 < 0.05) this._pushTrail(ship);

    if (now - this._lastHud > 400) {
      this._lastHud = now;
      const mm = Math.floor(t / 60);
      const ss = Math.floor(t % 60);
      this._setHud(
        '<b>Starship F13</b> · T+' + String(mm).padStart(2, '0') + ':' + String(ss).padStart(2, '0')
        + ' · ×' + this._speed
        + '<br><span style="color:#ffb088">' + phase.label + '</span> — ' + phase.event
        + '<br><span style="opacity:.75">' + this.countdownText() + '</span>',
        true
      );
      if (ship && t < 500) {
        MapDepict?.pulse?.(ship.lat, ship.lng, 0xff8844, phase.label, 2500);
      }
    }

    if (t >= 3300) {
      this._setHud('<b>F13 complete</b> · splashdown · type <code>starship</code> to replay', true);
      this.playing = false;
      setTimeout(() => this._setHud(null, false), 8000);
      AciCli?.print?.('starship f13 · splashdown · replay: starship', 'ok');
      return;
    }
    requestAnimationFrame(() => this._tick());
  },

  status() {
    return {
      version: this.version,
      playing: this.playing,
      phase: this._phase,
      t: Math.round(this._elapsed),
      net: this.NET_UTC,
      countdown: this.countdownText(),
      pad: this.PAD,
    };
  },

  wants(text) {
    return /starship|flight\s*13|f13|starbase\s*launch|ift[\s-]*13/i.test(String(text || ''));
  },

  async handleCli(line) {
    const low = String(line || '').toLowerCase().trim();
    if (/stop|cancel|halt/.test(low)) { this.stop(); return 'F13 stopped'; }
    if (/pad|focus|starbase/.test(low) && !/play|start|go|launch|replay/.test(low)) {
      this.focusPad();
      return 'Focused Starbase Pad 2 · ' + this.countdownText();
    }
    if (/status|net|when|countdown/.test(low)) {
      const s = this.status();
      return s.countdown + (s.playing ? ' · playing T+' + s.t + 's · ' + s.phase : '');
    }
    const realtime = /live|real\s*time|realtime/.test(low);
    const fast = /fast|turbo|×\s*30|x30/.test(low);
    this.start({ realtime, speed: realtime ? 1 : (fast ? 30 : 12) });
    return 'F13 sim started · ' + this.countdownText();
  },
};
window.StarshipFlight13 = StarshipFlight13;

/* === 77-starlink-constellation.js === */
// === STARLINK — TRUTH MODE ===
// No analytic/fake dots around Earth. Optional live GP only if user forces "starlink live"
// and CelesTrak succeeds; otherwise nothing is drawn.
const StarlinkConstellation = {
  version: '20260718-truth',
  enabled: false,
  maxSats: 0,
  group: null,
  meshes: [],
  _elements: null,
  _built: false,
  _mode: 'off',

  init() {
    if (this._inited) return;
    this._inited = true;
    window.StarlinkConstellation = this;
    this.enabled = false;
    this._clearMeshes();
    console.log('%c[Starlink] truth · no fake constellation dots', 'color:#66aaff');
  },

  ensureBuilt() {
    // Never build analytic shells
    this._clearMeshes();
  },

  _clearMeshes() {
    if (this.group && this.group.parent) {
      try { this.group.parent.remove(this.group); } catch (_) {}
    }
    this.group = null;
    this.meshes = [];
    this._elements = null;
    this._built = false;
    this._mode = 'off';
  },

  async refresh() {
    return [];
  },

  update() {
    // no-op — never paint fake sats
    if (this.group) this.group.visible = false;
  },

  status() {
    return { version: this.version, mode: 'off', count: 0, truth: true };
  },

  wants(text) {
    return /starlink|constellation|leo\s*sat/i.test(String(text || ''));
  },

  async handleCli(line) {
    this.init();
    this._clearMeshes();
    this.enabled = false;
    AciCli?.print?.('No fake satellites · ISS only when live · no toy LEO dots', 'ok');
    return 'Starlink fake dots disabled (truth mode)';
  },
};
window.StarlinkConstellation = StarlinkConstellation;

/* === 60-graphics.js === */
// === ASTRANOV AI GRAPHICS ENGINE — WebGL gaming procedural layer (shader + particles) ===
const AIGraphics = {
  atmosphere: null,
  clouds: null,
  cityLights: null,
  idleNodes: null,
  neuralLayer: null,
  activeEffects: [],
  batchGroup: null,
  batchRing: null,
  batchNodes: null,
  superBatchActive: false,
  shellDim: false,
  voicePerf: false,
  thinkPulse: false,
  _frameSkip: 0,
  _parent: null,
  _hudCanvas: null,
  _hudCtx: null,
  _hudRaf: 0,
  _seed: (Date.now() % 9973) / 9973,
  _paths: [],
  _flyer: null,
  _flyerFrame: 0,
  _flyerFlying: false,

  init(parent, earthRadius = 1) {
    if (this._inited) return;
    this._inited = true;
    this._parent = parent || globePivot;
    const tier = SlumberManager?.tier || 'balanced';
    const lite = tier === 'conserve' || tier === 'slumber';
    this.addAtmosphere(this._parent, earthRadius);
    if (!lite) this.addClouds(this._parent, earthRadius);
    this.addCityLights(this._parent, earthRadius, lite ? 900 : 2200);
    this.addIdleAIEffects(this._parent, earthRadius, lite ? 40 : 80);
    this.addNeuralField(this._parent, earthRadius);
    this._mountGamingHud();
    if (SlumberManager?.quality?.gamingGraphics && !this._gamingLight) {
      this._gamingLight = new THREE.PointLight(0x00e8ff, 1.4, 4.5);
      this._gamingLight.position.set(0.3, 0.5, 1.2);
      scene.add(this._gamingLight);
    }
    console.log('%c[Astranov AI Graphics] Gaming shader pipeline live', 'color:#00ddff;font-weight:700');
    window._aiGraphicsReady = true;
  },

  _isGaming() {
    // Prefer high-end helper art unless device is in deep conserve
    if (SlumberManager?.tier === 'slumber' || SlumberManager?.tier === 'conserve') return false;
    return true;
  },

  _gamingVert() {
    return [
      'varying vec3 vN;',
      'varying vec3 vV;',
      'varying vec3 vW;',
      'void main(){',
      '  vN = normalize(normalMatrix * normal);',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vV = -mv.xyz;',
      '  vW = (modelMatrix * vec4(position, 1.0)).xyz;',
      '  gl_Position = projectionMatrix * mv;',
      '}',
    ].join('\n');
  },

  _gamingFrag() {
    return [
      'uniform vec3 uColor;',
      'uniform vec3 uEmit;',
      'uniform float uPulse;',
      'uniform float uRim;',
      'uniform float uAlpha;',
      'uniform float uMetal;',
      'varying vec3 vN;',
      'varying vec3 vV;',
      'varying vec3 vW;',
      'void main(){',
      '  vec3 n = normalize(vN);',
      '  vec3 v = normalize(vV);',
      '  float ndv = max(dot(n, v), 0.0);',
      '  float rim = pow(1.0 - ndv, 2.8) * uRim;',
      '  float pulse = 0.78 + 0.22 * sin(uPulse * 1.7 + vW.y * 40.0);',
      '  float fres = pow(1.0 - ndv, 3.4);',
      '  vec3 base = uColor * (0.35 + uMetal * 0.4);',
      '  vec3 emit = uEmit * pulse * (0.55 + fres * 0.9);',
      '  vec3 rimCol = mix(vec3(0.2, 0.85, 1.0), uEmit, 0.45) * rim;',
      '  vec3 col = base + emit + rimCol;',
      '  // Hot core flecks',
      '  float fleck = pow(max(sin(vW.x * 90.0 + uPulse) * sin(vW.z * 70.0), 0.0), 8.0) * 0.35;',
      '  col += uEmit * fleck;',
      '  gl_FragColor = vec4(col, uAlpha);',
      '}',
    ].join('\n');
  },

  _gamingMat(opts = {}) {
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(opts.color || 0x1a2838) },
        uEmit: { value: new THREE.Color(opts.emissive || 0x00c8ff) },
        uPulse: { value: 0 },
        uRim: { value: opts.rim ?? 1.55 },
        uAlpha: { value: opts.opacity ?? 1 },
        uMetal: { value: opts.metal ?? 0.55 },
      },
      vertexShader: this._gamingVert(),
      fragmentShader: this._gamingFrag(),
      transparent: !!opts.transparent || (opts.opacity != null && opts.opacity < 1),
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: opts.additive ? false : (opts.depthWrite !== false),
      side: opts.doubleSide ? THREE.DoubleSide : THREE.FrontSide,
    });
    mat.userData._gaming = true;
    return mat;
  },

  _pulseGamingMats(root, t) {
    root.traverse((o) => {
      const u = o.material?.uniforms;
      if (u?.uPulse) u.uPulse.value = t;
    });
  },

  _createJetVfx(group, side) {
    const COUNT = this._isGaming() ? 110 : 56;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: this._isGaming() ? 0.028 : 0.016,
      color: side < 0 ? 0x00f0ff : 0x66ccff,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    group.add(pts);
    return { points: pts, positions: pos, count: COUNT, head: 0, side };
  },

  _emitJet(vfx, origin, dir, power) {
    if (!vfx?.positions || !origin) return;
    const i = vfx.head % vfx.count;
    vfx.head++;
    const idx = i * 3;
    vfx.positions[idx] = origin.x;
    vfx.positions[idx + 1] = origin.y;
    vfx.positions[idx + 2] = origin.z;
    vfx.points.geometry.attributes.position.needsUpdate = true;
    if (!vfx.vel) vfx.vel = [];
    vfx.vel[i] = {
      x: (dir?.x || 0) * power + (Math.random() - 0.5) * 0.002,
      y: (dir?.y || -0.01) * power + (Math.random() - 0.5) * 0.002,
      z: (dir?.z || 0) * power + (Math.random() - 0.5) * 0.002,
      life: 28 + Math.floor(Math.random() * 18),
    };
  },

  _tickJetVfx(vfx, flying) {
    if (!vfx?.vel || !vfx.positions) return;
    const decay = flying ? 0.96 : 0.92;
    for (let i = 0; i < vfx.count; i++) {
      const v = vfx.vel[i];
      if (!v || v.life <= 0) continue;
      const idx = i * 3;
      vfx.positions[idx] += v.x;
      vfx.positions[idx + 1] += v.y;
      vfx.positions[idx + 2] += v.z;
      v.x *= decay; v.y *= decay; v.z *= decay;
      v.life--;
    }
    vfx.points.geometry.attributes.position.needsUpdate = true;
  },

  _latLngToPos(lat, lng, r = 1) {
    const phi = (90 - lat) * Math.PI / 180;
    const theta = (lng + 180) * Math.PI / 180;
    return {
      x: -(r * Math.sin(phi) * Math.cos(theta)),
      y: r * Math.cos(phi),
      z: r * Math.sin(phi) * Math.sin(theta),
    };
  },

  _procCanvas(w, h, drawFn) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    const ctx = c.getContext('2d', { alpha: true });
    drawFn(ctx, w, h);
    const tex = new THREE.CanvasTexture(c);
    tex.needsUpdate = true;
    return { canvas: c, tex, ctx };
  },

  setThinkPulse(on) {
    this.thinkPulse = !!on;
    if (this.neuralLayer) this.neuralLayer.visible = !!on || this.superBatchActive;
    if (this._hudCanvas) this._hudCanvas.style.opacity = on ? '0.5' : (this.superBatchActive ? '0.35' : '0');
  },

  showNeural(on) {
    if (this.neuralLayer) this.neuralLayer.visible = !!on;
  },

  addAtmosphere(parent, r) {
    // Remove boot-atmosphere duplicate if present
    try {
      const kids = parent && parent.children ? parent.children.slice() : [];
      kids.forEach((c) => {
        if (c.userData?.type === 'boot-atmosphere') parent.remove(c);
      });
    } catch (_) { /* */ }
    const segs = SlumberManager?.tier === 'full' || SlumberManager?.tier === 'gaming' ? 64 : 48;
    // Outer glow shell
    const geo = new THREE.SphereGeometry(r * 1.045, segs, segs);
    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x3aa8ff) },
        uPower: { value: 3.2 },
        uIntensity: { value: 0.55 },
      },
      vertexShader: [
        'varying vec3 vNormal;',
        'varying vec3 vView;',
        'void main(){',
        '  vNormal = normalize(normalMatrix * normal);',
        '  vec4 mv = modelViewMatrix * vec4(position,1.0);',
        '  vView = normalize(-mv.xyz);',
        '  gl_Position = projectionMatrix * mv;',
        '}',
      ].join('\n'),
      fragmentShader: [
        'uniform vec3 uColor;',
        'uniform float uPower;',
        'uniform float uIntensity;',
        'varying vec3 vNormal;',
        'varying vec3 vView;',
        'void main(){',
        '  float fres = pow(1.0 - max(dot(vNormal, vView), 0.0), uPower);',
        '  float a = fres * uIntensity;',
        '  gl_FragColor = vec4(uColor, a);',
        '}',
      ].join('\n'),
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.atmosphere = new THREE.Mesh(geo, mat);
    parent.add(this.atmosphere);
    // Thin bright rim
    const rim = new THREE.Mesh(
      new THREE.SphereGeometry(r * 1.012, segs, segs),
      new THREE.MeshBasicMaterial({
        color: 0x66ccff,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        side: THREE.FrontSide,
        depthWrite: false,
      })
    );
    this._atmoRim = rim;
    parent.add(rim);
  },

  addClouds(parent, r) {
    const { tex } = this._procCanvas(1024, 512, (ctx, w, h) => {
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = '#ffffff';
      for (let pass = 0; pass < 3; pass++) {
        for (let i = 0; i < 70; i++) {
          const x = Math.random() * w;
          const y = Math.random() * h;
          const rw = 20 + Math.random() * 60;
          ctx.globalAlpha = 0.04 + Math.random() * 0.08;
          ctx.beginPath();
          ctx.ellipse(x, y, rw, rw * 0.45, Math.random() * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });
    const geo = new THREE.SphereGeometry(r * 1.008, 40, 40);
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.11,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });
    this.clouds = new THREE.Mesh(geo, mat);
    parent.add(this.clouds);
  },

  addCityLights(parent, r, count = 2200) {
    const pos = [];
    const cols = [];
    for (let i = 0; i < count; i++) {
      const lat = Math.random() * 170 - 85;
      const popFactor = Math.sin(lat * 0.025) * 0.6 + 0.4;
      if (Math.random() < popFactor * 0.85) {
        const lng = Math.random() * 360 - 180;
        const p = this._latLngToPos(lat, lng, r * 1.003);
        pos.push(p.x, p.y, p.z);
        const warm = Math.random() > 0.4;
        cols.push(warm ? 1 : 0.6, warm ? 0.85 : 0.95, warm ? 0.5 : 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.007,
      vertexColors: true,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.cityLights = new THREE.Points(geo, mat);
    parent.add(this.cityLights);
  },

  addIdleAIEffects(parent, r, count = 80) {
    const positions = [];
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const lat = Math.sin(angle) * 35;
      const lng = (i * 4.5) % 360;
      const p = this._latLngToPos(lat, lng, r * 1.04);
      positions.push(p.x, p.y, p.z);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.004,
      color: 0x00ddff,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.idleNodes = new THREE.Points(geo, mat);
    parent.add(this.idleNodes);
  },

  addNeuralField(parent, r) {
    const pack = this._procCanvas(512, 256, (ctx, w, h) => {
      this._paintNeural(ctx, w, h, 0);
    });
    this._neuralPack = pack;
    const geo = new THREE.SphereGeometry(r * 1.012, 36, 36);
    const mat = new THREE.MeshBasicMaterial({
      map: pack.tex,
      transparent: true,
      opacity: 0.14,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.neuralLayer = new THREE.Mesh(geo, mat);
    this.neuralLayer.visible = false;
    parent.add(this.neuralLayer);
  },

  _paintNeural(ctx, w, h, t) {
    ctx.clearRect(0, 0, w, h);
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(0,30,60,0)');
    g.addColorStop(0.5, 'rgba(0,180,255,0.12)');
    g.addColorStop(1, 'rgba(0,255,140,0.08)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 48; i++) {
      const x = (i / 48) * w;
      const y = h * 0.5 + Math.sin(t * 0.04 + i * 0.55 + this._seed * 12) * h * 0.22;
      ctx.strokeStyle = `rgba(0,${180 + (i % 3) * 20},255,${0.15 + (i % 5) * 0.04})`;
      ctx.lineWidth = 1 + (i % 3);
      ctx.beginPath();
      ctx.moveTo(x, y);
      for (let j = 1; j <= 6; j++) {
        ctx.lineTo(x + j * (w / 48) * 0.15, y + Math.sin(t * 0.03 + i + j) * 8);
      }
      ctx.stroke();
    }
    for (let n = 0; n < 120; n++) {
      const nx = (Math.sin(n * 0.91 + t * 0.02) * 0.5 + 0.5) * w;
      const ny = (Math.cos(n * 0.73 + t * 0.015) * 0.5 + 0.5) * h;
      ctx.fillStyle = n % 7 === 0 ? 'rgba(0,255,120,0.55)' : 'rgba(0,200,255,0.35)';
      ctx.fillRect(nx, ny, 2, 2);
    }
  },

  _mountGamingHud() {
    const globe = document.getElementById('globe');
    if (!globe || this._hudCanvas) return;
    const c = document.createElement('canvas');
    c.id = 'ai-gaming-hud';
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;opacity:0;transition:opacity 0.35s ease;mix-blend-mode:screen';
    globe.appendChild(c);
    this._hudCanvas = c;
    this._hudCtx = c.getContext('2d');
    const resize = () => {
      const r = globe.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      c.width = Math.max(1, Math.floor(r.width * dpr));
      c.height = Math.max(1, Math.floor(r.height * dpr));
    };
    resize();
    window.addEventListener('resize', resize);
    this._hudLoop();
  },

  _hudLoop() {
    const ctx = this._hudCtx;
    const c = this._hudCanvas;
    if (ctx && c) {
      const on = this.thinkPulse || this.superBatchActive || Voice?.speaking;
      c.style.opacity = on ? '0.42' : '0';
      if (on) {
        const t = performance.now() * 0.001;
        const w = c.width;
        const h = c.height;
        ctx.clearRect(0, 0, w, h);
        ctx.strokeStyle = 'rgba(0,200,255,0.08)';
        for (let y = 0; y < h; y += 4) {
          ctx.beginPath();
          ctx.moveTo(0, y + Math.sin(t * 2 + y * 0.02) * 0.5);
          ctx.lineTo(w, y);
          ctx.stroke();
        }
        const cx = w * 0.5;
        const cy = h * 0.42;
        for (let i = 0; i < 5; i++) {
          const r = (Math.sin(t * 1.8 + i) * 0.5 + 0.5) * Math.min(w, h) * 0.12 + 20;
          ctx.strokeStyle = `rgba(0,${220 - i * 30},${140 + i * 20},${0.12 - i * 0.015})`;
          ctx.beginPath();
          ctx.arc(cx, cy, r, 0, Math.PI * 2);
          ctx.stroke();
        }
      } else {
        ctx.clearRect(0, 0, c.width, c.height);
      }
    }
    this._hudRaf = requestAnimationFrame(() => this._hudLoop());
  },

  spawnEffect(originPos, color = 0x00ffcc, count = 25, life = 45) {
    if (!originPos || !scene) return;
    if (this.voicePerf) {
      count = Math.min(count, 8);
      life = Math.min(life, 24);
    }
    const maxFx = SlumberManager?.tier === 'slumber' ? 8 : 24;
    while (this.activeEffects.length > maxFx) {
      const eff = this.activeEffects.shift();
      if (eff?.points) {
        scene.remove(eff.points);
        eff.points.geometry?.dispose?.();
        eff.points.material?.dispose?.();
      }
    }
    const positions = new Float32Array(count * 3);
    const vel = [];
    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      positions[idx] = originPos.x + (Math.random() - 0.5) * 0.04;
      positions[idx + 1] = originPos.y + (Math.random() - 0.5) * 0.04;
      positions[idx + 2] = originPos.z + (Math.random() - 0.5) * 0.04;
      vel.push(
        (Math.random() - 0.5) * 0.0035,
        (Math.random() - 0.5) * 0.0035,
        (Math.random() - 0.5) * 0.0035,
      );
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const mat = new THREE.PointsMaterial({
      size: 0.018,
      color,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pts = new THREE.Points(geo, mat);
    scene.add(pts);
    this.activeEffects.push({ points: pts, velocities: vel, life, maxLife: life });
  },

  /** 2D HUD silhouette — gaming-grade mecha angel (used by overlay only) */
  _paintAstranovCharacter(ctx, w, h, frame, opts = {}) {
    const t = frame * 0.14;
    const cx = w * 0.5;
    const cy = h * 0.44 + Math.sin(t * 0.7) * 3;
    const cyan = opts.glow || '#00f0ff';
    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.48);
    bg.addColorStop(0, 'rgba(0,80,140,0.55)');
    bg.addColorStop(0.45, 'rgba(0,30,70,0.22)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';
    // Energy wings
    [-1, 1].forEach((side) => {
      for (let i = 0; i < 5; i++) {
        const flap = Math.sin(t + i * 0.4) * 14 * side;
        ctx.beginPath();
        ctx.moveTo(8 * side, -6);
        ctx.quadraticCurveTo(40 * side + flap, -40 - i * 6, 88 * side + flap * 0.4, -8 + i * 8);
        ctx.quadraticCurveTo(50 * side, 10 + i * 4, 12 * side, 8);
        ctx.closePath();
        ctx.fillStyle = `rgba(0,${200 - i * 20},255,${0.22 - i * 0.03})`;
        ctx.fill();
      }
    });
    // Body silhouette
    ctx.globalCompositeOperation = 'source-over';
    const body = ctx.createLinearGradient(0, -36, 0, 40);
    body.addColorStop(0, '#e8f4ff');
    body.addColorStop(0.35, '#7a90a8');
    body.addColorStop(1, '#0a1520');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-16, -10);
    ctx.lineTo(16, -10);
    ctx.lineTo(20, 12);
    ctx.lineTo(12, 36);
    ctx.lineTo(-12, 36);
    ctx.lineTo(-20, 12);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = cyan;
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // Core
    const core = ctx.createRadialGradient(0, 4, 1, 0, 4, 14);
    core.addColorStop(0, '#fff');
    core.addColorStop(0.4, cyan);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 4, 12, 0, Math.PI * 2);
    ctx.fill();
    // Helmet
    ctx.fillStyle = '#c8d8e8';
    ctx.beginPath();
    ctx.ellipse(0, -26, 14, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowColor = cyan;
    ctx.shadowBlur = 16;
    ctx.fillStyle = cyan;
    ctx.fillRect(-12, -28, 24, 6);
    ctx.shadowBlur = 0;
    // Halo
    ctx.strokeStyle = 'rgba(0,240,255,0.55)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, -48, 22, 7, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  },

  /**
   * Astranov Helper v2 — high-level gaming mecha-angel on the globe.
   * Procedural THREE.js (no external models): energy wings, articulated armor,
   * halo, core bloom, thruster jets, orbital micro-drones.
   */
  _buildProceduralHumanoid(lat, lng, opts = {}) {
    const hi = this._isGaming();
    const seg = hi ? 20 : 12;
    const g = new THREE.Group();
    const mat = (o) => this._gamingMat(o);

    // ── Root skeleton groups ──
    const hips = new THREE.Group();
    const spine = new THREE.Group();
    const chestG = new THREE.Group();
    const headG = new THREE.Group();
    spine.add(chestG);
    chestG.add(headG);
    hips.add(spine);
    g.add(hips);

    // Pelvis / hip armor
    const pelvis = new THREE.Mesh(
      new THREE.CylinderGeometry(0.016, 0.02, 0.018, seg),
      mat({ color: 0x121c28, emissive: 0x004466, rim: 1.3, metal: 0.7 }),
    );
    hips.add(pelvis);

    // Torso stack
    const abdomen = new THREE.Mesh(
      new THREE.CylinderGeometry(0.015, 0.017, 0.022, seg),
      mat({ color: 0x1a2838, emissive: 0x006688, rim: 1.2, metal: 0.65 }),
    );
    abdomen.position.y = 0.018;
    spine.add(abdomen);

    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(0.042, 0.036, 0.028),
      mat({ color: 0x243848, emissive: 0x00aadd, rim: 1.85, metal: 0.75 }),
    );
    chest.position.y = 0.04;
    chestG.add(chest);

    // Chest plate ridge
    const plate = new THREE.Mesh(
      new THREE.BoxGeometry(0.028, 0.03, 0.008),
      mat({ color: 0x8899aa, emissive: 0x00e8ff, rim: 2.0, metal: 0.9 }),
    );
    plate.position.set(0, 0.04, 0.016);
    chestG.add(plate);

    // Pauldrons
    const pauldrons = [];
    [-1, 1].forEach((side) => {
      const p = new THREE.Mesh(
        new THREE.SphereGeometry(0.014, seg, seg * 0.5, 0, Math.PI * 2, 0, Math.PI * 0.55),
        mat({ color: 0x3a4a5a, emissive: 0x0088cc, rim: 1.7, metal: 0.8 }),
      );
      p.position.set(side * 0.028, 0.052, 0);
      p.rotation.z = side * -0.4;
      chestG.add(p);
      pauldrons.push(p);
    });

    // Energy core (multi-layer bloom)
    const coreInner = new THREE.Mesh(
      new THREE.SphereGeometry(0.009, seg, seg),
      mat({ color: 0xffffff, emissive: 0xffffff, rim: 0.5, additive: true, transparent: true, opacity: 0.95 }),
    );
    coreInner.position.set(0, 0.038, 0.012);
    chestG.add(coreInner);
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.014, seg, seg),
      mat({ color: 0x00e8ff, emissive: 0x00ffff, rim: 2.6, additive: true, transparent: true, opacity: 0.55 }),
    );
    core.position.set(0, 0.038, 0.012);
    chestG.add(core);
    const coreOuter = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, seg, seg),
      mat({ color: 0x0088ff, emissive: 0x00aaff, rim: 1.2, additive: true, transparent: true, opacity: 0.18 }),
    );
    coreOuter.position.set(0, 0.038, 0.012);
    chestG.add(coreOuter);

    // Head + helm + visor
    const skull = new THREE.Mesh(
      new THREE.SphereGeometry(0.016, seg, seg),
      mat({ color: 0xb8c8d8, emissive: 0x224466, rim: 1.5, metal: 0.85 }),
    );
    skull.position.y = 0.072;
    headG.add(skull);
    const helmCrest = new THREE.Mesh(
      new THREE.BoxGeometry(0.006, 0.02, 0.028),
      mat({ color: 0x00c8ff, emissive: 0x00e8ff, rim: 2.2, metal: 0.5 }),
    );
    helmCrest.position.set(0, 0.086, -0.002);
    headG.add(helmCrest);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.03, 0.01, 0.014),
      mat({ color: 0x001018, emissive: 0x00f0ff, rim: 2.8, transparent: true, opacity: 0.92 }),
    );
    visor.position.set(0, 0.072, 0.014);
    headG.add(visor);

    // Halo ring above head
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(0.028, 0.0022, 8, hi ? 48 : 24),
      mat({ color: 0x00e8ff, emissive: 0x00ffff, rim: 2.5, additive: true, transparent: true, opacity: 0.75 }),
    );
    halo.position.y = 0.102;
    halo.rotation.x = Math.PI / 2.4;
    headG.add(halo);

    // Arms (upper + lower + gauntlet)
    const arms = [];
    [-1, 1].forEach((side) => {
      const arm = new THREE.Group();
      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.0055, 0.028, seg),
        mat({ color: 0x4a5a6a, emissive: 0x0088aa, rim: 1.35, metal: 0.7 }),
      );
      upper.position.y = -0.012;
      arm.add(upper);
      const lower = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.0045, 0.024, seg),
        mat({ color: 0x3a4a58, emissive: 0x006688, rim: 1.25, metal: 0.65 }),
      );
      lower.position.y = -0.034;
      arm.add(lower);
      const gauntlet = new THREE.Mesh(
        new THREE.BoxGeometry(0.012, 0.014, 0.012),
        mat({ color: 0x00c8ff, emissive: 0x00e8ff, rim: 2.0, metal: 0.5 }),
      );
      gauntlet.position.y = -0.05;
      arm.add(gauntlet);
      // Energy blade idle
      const blade = new THREE.Mesh(
        new THREE.BoxGeometry(0.003, 0.028, 0.006),
        mat({ color: 0x00ffff, emissive: 0x00ffff, rim: 2.4, additive: true, transparent: true, opacity: 0.55 }),
      );
      blade.position.set(side * 0.006, -0.062, 0);
      arm.add(blade);
      arm.position.set(side * 0.03, 0.05, 0);
      arm.rotation.z = side * 0.25;
      chestG.add(arm);
      arms.push(arm);
    });

    // Legs
    const legs = [];
    [-1, 1].forEach((side) => {
      const leg = new THREE.Group();
      const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0065, 0.006, 0.026, seg),
        mat({ color: 0x3a4a58, emissive: 0x004466, rim: 1.15, metal: 0.7 }),
      );
      thigh.position.y = -0.014;
      leg.add(thigh);
      const shin = new THREE.Mesh(
        new THREE.CylinderGeometry(0.0055, 0.005, 0.024, seg),
        mat({ color: 0x2a3848, emissive: 0x003355, rim: 1.1, metal: 0.65 }),
      );
      shin.position.y = -0.038;
      leg.add(shin);
      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.014, 0.012, 0.02),
        mat({ color: 0x1a2838, emissive: 0x0066aa, rim: 1.4, metal: 0.8 }),
      );
      boot.position.set(0, -0.054, 0.004);
      leg.add(boot);
      leg.position.set(side * 0.012, -0.008, 0);
      hips.add(leg);
      legs.push(leg);
    });

    // Energy wings — multi-vane, not boxes
    const wings = [];
    const wingVanes = [];
    [-1, 1].forEach((side) => {
      const wing = new THREE.Group();
      for (let s = 0; s < (hi ? 5 : 3); s++) {
        const len = 0.055 - s * 0.007;
        const vane = new THREE.Mesh(
          new THREE.BoxGeometry(len, 0.0025 + s * 0.0004, 0.018 - s * 0.002),
          mat({
            color: 0x6a8aaa,
            emissive: s === 0 ? 0x00e8ff : 0x0088cc,
            rim: 1.8 + s * 0.25,
            transparent: true,
            opacity: 0.92 - s * 0.1,
            metal: 0.4,
            additive: s > 2,
          }),
        );
        vane.position.set(side * (0.02 + s * 0.018), 0.01 + s * 0.008, -0.012 - s * 0.004);
        vane.rotation.z = side * (0.15 + s * 0.08);
        vane.rotation.y = side * -0.12;
        wing.add(vane);
        wingVanes.push(vane);
        // Soft energy membrane
        if (s < 3) {
          const membrane = new THREE.Mesh(
            new THREE.PlaneGeometry(len * 0.9, 0.02),
            mat({
              color: 0x00aaff,
              emissive: 0x00e8ff,
              rim: 1.2,
              additive: true,
              transparent: true,
              opacity: 0.22,
              doubleSide: true,
            }),
          );
          membrane.position.copy(vane.position);
          membrane.position.z -= 0.002;
          membrane.rotation.z = vane.rotation.z;
          wing.add(membrane);
        }
      }
      wing.position.set(side * 0.014, 0.045, -0.012);
      chestG.add(wing);
      wings.push(wing);
    });

    // Back thruster pods
    const thrusters = [];
    const jetVfx = [];
    [-1, 1].forEach((side) => {
      const pack = new THREE.Group();
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.007, 0.01, 0.02, seg),
        mat({ color: 0x1a2838, emissive: 0x00aacc, rim: 1.5, metal: 0.75 }),
      );
      pack.add(housing);
      const nozzle = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.007, 0.01, seg),
        mat({ color: 0x2a3848, emissive: 0x0088aa, rim: 1.3 }),
      );
      nozzle.position.y = -0.014;
      pack.add(nozzle);
      const plume = new THREE.Mesh(
        new THREE.ConeGeometry(0.009, hi ? 0.05 : 0.032, seg),
        mat({ color: 0x00e8ff, emissive: 0x00ffff, rim: 2.2, additive: true, transparent: true, opacity: 0.8 }),
      );
      plume.rotation.x = Math.PI;
      plume.position.y = -0.032;
      pack.add(plume);
      pack.position.set(side * 0.016, 0.02, -0.022);
      chestG.add(pack);
      thrusters.push(plume);
      jetVfx.push(this._createJetVfx(g, side));
    });

    // Orbital micro-drones (gaming flair)
    const orbiters = [];
    if (hi) {
      for (let i = 0; i < 3; i++) {
        const orb = new THREE.Mesh(
          new THREE.OctahedronGeometry(0.005, 0),
          mat({ color: 0x00e8ff, emissive: 0x00ffff, rim: 2.0, additive: true, transparent: true, opacity: 0.85 }),
        );
        g.add(orb);
        orbiters.push({ mesh: orb, phase: (i / 3) * Math.PI * 2, radius: 0.055 + i * 0.008 });
      }
    }

    // Soft aura
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, seg, seg),
      new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        transparent: true,
        opacity: hi ? 0.1 : 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    g.add(aura);

    // Ground contact ring (reads as “helper present”)
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.04, 0.0018, 8, 40),
      mat({ color: 0x00aaff, emissive: 0x00e8ff, rim: 1.5, additive: true, transparent: true, opacity: 0.45 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = -0.06;
    g.add(ring);

    const alt = opts.alt || 1.095;
    const p = this._latLngToPos(lat ?? 36.44, lng ?? 28.22, alt);
    g.position.set(p.x, p.y, p.z);
    const n = new THREE.Vector3(p.x, p.y, p.z).normalize();
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);

    g.userData = {
      type: 'astranov-flyer',
      gen: 2,
      procedural3d: true,
      gaming: hi,
      name: opts.label || 'Astranov',
      lat, lng, alt,
      wings, wingVanes, arms, legs, thrusters, core, coreInner, coreOuter,
      aura, halo, visor, ring, orbiters, pauldrons, jetVfx,
      hips, spine, chestG, headG,
      edition: opts.edition?.id || 'astranov',
    };
    return g;
  },

  _animateFlyerPose(mesh, flying) {
    const ud = mesh?.userData;
    if (!ud?.procedural3d) return;
    const t = this._flyerFrame * 0.11;
    this._pulseGamingMats(mesh, t);

    // Body hover / lean
    if (ud.spine) {
      ud.spine.rotation.x = Math.sin(t * 0.7) * (flying ? 0.18 : 0.06) + (flying ? 0.12 : 0);
      ud.spine.position.y = Math.sin(t * 1.4) * 0.002;
    }
    if (ud.headG) {
      ud.headG.rotation.y = Math.sin(t * 0.55) * 0.15;
      ud.headG.rotation.x = Math.sin(t * 0.4) * 0.05;
    }
    if (ud.halo) {
      ud.halo.rotation.z = t * 0.9;
      if (ud.halo.material?.uniforms?.uAlpha) {
        ud.halo.material.uniforms.uAlpha.value = 0.55 + Math.sin(t * 2) * 0.25;
      }
    }
    if (ud.visor?.material?.uniforms?.uEmit) {
      const pulse = 0.7 + Math.sin(t * 2.2) * 0.3;
      ud.visor.material.uniforms.uEmit.value.setRGB(0, pulse, 1);
    }

    // Wing flap + vane shimmer
    const flap = Math.sin(t * (flying ? 1.6 : 1.0)) * (flying ? 0.62 : 0.32);
    ud.wings?.forEach((wing, i) => {
      const s = i === 0 ? 1 : -1;
      wing.rotation.z = s * flap;
      wing.rotation.y = Math.sin(t * 0.9 + i) * 0.1;
      wing.rotation.x = flying ? -0.15 : Math.sin(t * 0.5) * 0.05;
    });
    ud.wingVanes?.forEach((v, i) => {
      if (v.material?.uniforms?.uAlpha) {
        v.material.uniforms.uAlpha.value = 0.55 + Math.sin(t * 1.8 + i) * 0.25;
      }
    });

    ud.legs?.forEach((leg, i) => {
      leg.rotation.x = Math.sin(t * 0.95 + i) * (flying ? 0.28 : 0.1) + (flying ? 0.2 : 0);
    });
    ud.arms?.forEach((arm, i) => {
      const s = i === 0 ? 1 : -1;
      arm.rotation.z = s * (0.18 + Math.sin(t * 0.75) * 0.1);
      arm.rotation.x = flying ? -0.35 + Math.sin(t + i) * 0.08 : Math.sin(t * 0.6 + i) * 0.08;
    });

    // Core bloom
    const coreA = 0.45 + Math.sin(t * 1.8) * 0.35;
    [ud.core, ud.coreInner, ud.coreOuter].forEach((c, i) => {
      if (!c) return;
      if (c.material?.uniforms?.uAlpha) {
        c.material.uniforms.uAlpha.value = coreA * (i === 0 ? 1 : i === 1 ? 1.1 : 0.45);
      }
      c.scale.setScalar(1 + Math.sin(t * 1.5 + i) * 0.08);
    });

    if (ud.aura?.material) {
      ud.aura.material.opacity = (flying ? 0.16 : 0.09) + Math.sin(t * 1.1) * 0.04;
      ud.aura.scale.setScalar(1 + Math.sin(t * 0.85) * 0.08);
    }
    if (ud.ring) {
      ud.ring.rotation.z = t * 1.2;
      if (ud.ring.material?.uniforms?.uAlpha) {
        ud.ring.material.uniforms.uAlpha.value = flying ? 0.55 : 0.35;
      }
    }

    // Orbiting drones
    ud.orbiters?.forEach((o) => {
      const a = t * 1.3 + o.phase;
      o.mesh.position.set(
        Math.cos(a) * o.radius,
        0.04 + Math.sin(a * 1.7) * 0.02,
        Math.sin(a) * o.radius * 0.7 - 0.01,
      );
      o.mesh.rotation.y = a;
      o.mesh.rotation.x = a * 0.6;
    });

    // Thrusters + particle jets
    ud.thrusters?.forEach((thr, i) => {
      if (thr.material?.uniforms?.uAlpha) {
        thr.material.uniforms.uAlpha.value = flying
          ? 0.7 + Math.sin(t * 2.4 + i) * 0.28
          : 0.28 + Math.sin(t + i) * 0.12;
      }
      thr.scale.y = flying ? 1.35 + Math.sin(t * 1.6 + i) * 0.5 : 0.55 + Math.sin(t + i) * 0.1;
      thr.scale.x = thr.scale.z = flying ? 1.1 : 0.75;
    });
    const power = flying ? 0.018 : 0.007;
    const worldDown = new THREE.Vector3(0, -1, 0).applyQuaternion(mesh.quaternion);
    ud.thrusters?.forEach((thr, i) => {
      const wp = new THREE.Vector3();
      thr.getWorldPosition(wp);
      this._emitJet(ud.jetVfx?.[i], wp, worldDown, power);
    });
    ud.jetVfx?.forEach((vfx) => this._tickJetVfx(vfx, flying));

    // Follow light on helper
    if (this._gamingLight && mesh.position) {
      this._gamingLight.position.copy(mesh.position).multiplyScalar(1.03);
      this._gamingLight.intensity = flying ? 2.2 : 1.5;
    }
  },

  _orientFlyerOnGlobe(mesh, pos) {
    if (!mesh || !pos) return;
    const n = pos.clone().normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  },

  _scaleFlyer(mesh, camZ) {
    if (!mesh?.userData?.procedural3d) return;
    // Larger, readable hero scale at global zoom — gaming presence
    const base = mesh.userData.gaming ? 4.2 : 3.4;
    const scale = Math.max(2.8, Math.min(8.5, base * (camZ / 2.15)));
    mesh.scale.setScalar(scale);
  },

  spawnAstranovFlyer(lat, lng, opts = {}) {
    if (this._flyer?.parent) {
      try { this._flyer.parent.remove(this._flyer); } catch (_) { /* */ }
    }
    // Dispose old thruster particle systems lightly
    this._flyer = null;
    const robot = this._buildProceduralHumanoid(lat, lng, opts);
    globePivot.add(robot);
    this._flyer = robot;
    window._astranovFlyer = robot;
    window._pilot = robot;
    // Dedicated point light for cinematic helper
    if (!this._gamingLight) {
      this._gamingLight = new THREE.PointLight(0x00e8ff, 1.6, 5.5);
      scene.add(this._gamingLight);
    }
    this._animateFlyerPose(robot, false);
    this.spawnEffect(robot.position, opts.color || 0x00e8ff, 36, 55);
    console.log('%c[Astranov Helper v2] gaming mecha-angel spawned', 'color:#00e8ff;font-weight:700');
    return robot;
  },

  _greatCircleCurve(fromVec, toVec, alt = 1.09, segments = 36) {
    const a = fromVec.clone().normalize();
    const b = toVec.clone().normalize();
    const qA = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), a);
    const qB = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), b);
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const q = qA.clone().slerp(qB, t);
      pts.push(new THREE.Vector3(0, 0, alt).applyQuaternion(q));
    }
    return new THREE.CatmullRomCurve3(pts);
  },

  flyAstranovTo(lat, lng, opts = {}) {
    if (!this._flyer) {
      const u = window._lastPos || { lat: 36.44, lng: 28.22 };
      this.spawnAstranovFlyer(u.lat, u.lng, opts);
    }
    const alt = opts.alt || this._flyer.userData?.alt || 1.09;
    const toP = this._latLngToPos(lat, lng, alt);
    const to = new THREE.Vector3(toP.x, toP.y, toP.z);
    const from = this._flyer.position.clone();
    const dist = TrackballGuard?.greatCircleKm?.(
      this._flyer.userData?.lat ?? 0,
      this._flyer.userData?.lng ?? 0,
      lat, lng
    ) || 800;
    const dur = opts.dur || Math.min(6200, Math.max(1400, dist * 2.8));
    const curve = this._greatCircleCurve(from, to, alt);
    this._flyerFlying = true;
    this._flyer.userData.lat = lat;
    this._flyer.userData.lng = lng;
    return this.animateAlongPath(this._flyer, curve, {
      dur,
      color: opts.color || 0x3d9eff,
      isFlyer: true,
      onDone: () => {
        this._flyerFlying = false;
        opts.onDone?.();
      },
    });
  },

  buildProceduralPilot(lat, lng, opts = {}) {
    return this.spawnAstranovFlyer(lat, lng, { ...opts, label: opts.edition?.name_gr || 'Astranov' });
  },

  buildProceduralDrone(lat, lng, domain = 'air', color = 0x44ccff) {
    const spec = TelemachosPilot?.DOMAINS?.[domain] || { alt: 1.06, color };
    const pos = this._latLngToPos(lat, lng, spec.alt || 1.06);
    const g = new THREE.Group();
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.012, 0.018, 6),
      new THREE.MeshBasicMaterial({ color: color || spec.color || 0x44ccff }),
    );
    g.add(hub);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.003, 0.003),
        new THREE.MeshBasicMaterial({ color: 0x88ccff }),
      );
      arm.rotation.z = (i / 4) * Math.PI * 2;
      arm.position.x = Math.cos(arm.rotation.z) * 0.018;
      arm.position.y = Math.sin(arm.rotation.z) * 0.018;
      g.add(arm);
    }
    g.userData = { type: 'drone', domain };
    g.position.set(pos.x, pos.y, pos.z);
    const n = new THREE.Vector3(pos.x, pos.y, pos.z).normalize();
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    globePivot.add(g);
    this.spawnEffect(g.position, color, 12, 35);
    return g;
  },

  animateAlongPath(mesh, curve, opts = {}) {
    if (!mesh || !curve) return null;
    const dur = opts.dur || 4200;
    const trailColor = opts.color || 0x00ddff;
    const t0 = performance.now();
    const id = { mesh, curve, t0, dur, trailColor, done: false, isFlyer: !!opts.isFlyer, onDone: opts.onDone };
    this._paths.push(id);
    if (opts.isFlyer) this._flyerFlying = true;
    return id;
  },

  _tickPaths() {
    const now = performance.now();
    for (let i = this._paths.length - 1; i >= 0; i--) {
      const p = this._paths[i];
      const prog = Math.min(1, (now - p.t0) / p.dur);
      const pt = p.curve.getPoint(prog);
      p.mesh.position.copy(pt);
      const n = pt.clone().normalize();
      p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const camZ = camera?.position?.z ?? 2.55;
      if (p.isFlyer) {
        this._flyerFrame++;
        this._scaleFlyer(p.mesh, camZ);
        this._animateFlyerPose(p.mesh, true);
      }
      if (Math.floor(prog * 40) % (p.isFlyer ? 2 : 3) === 0) {
        this.spawnEffect(pt, p.trailColor, p.isFlyer ? 6 : 4, p.isFlyer ? 22 : 18);
      }
      if (prog >= 1) {
        p.done = true;
        this.spawnEffect(pt, p.trailColor, 16, 40);
        this._paths.splice(i, 1);
        if (p.isFlyer) this._flyerFlying = false;
        p.onDone?.();
      }
    }
  },

  _tickAstranovFlyer() {
    if (!this._flyer || this._flyerFlying) return;
    this._flyerFrame++;
    const t = Date.now() * 0.001;
    const alt = (this._flyer.userData?.alt || 1.09) + Math.sin(t * 2.2) * 0.004;
    const lat = this._flyer.userData?.lat ?? 36.44;
    const lng = this._flyer.userData?.lng ?? 28.22;
    const p = this._latLngToPos(lat, lng, alt);
    this._flyer.position.set(p.x, p.y, p.z);
    this._orientFlyerOnGlobe(this._flyer, this._flyer.position);
    const camZ = camera?.position?.z ?? 2.55;
    this._scaleFlyer(this._flyer, camZ);
    this._animateFlyerPose(this._flyer, false);
    if (this._flyerFrame % 18 === 0) {
      this.spawnEffect(this._flyer.position, 0x3d9eff, 4, 16);
    }
  },

  setSiteShellMode(on) {
    this.shellDim = !!on;
    if (this.atmosphere) this.atmosphere.material.opacity = on ? 0.12 : (this.voicePerf ? 0.04 : 0.06);
    if (this.idleNodes) this.idleNodes.material.opacity = on ? 0.55 : 0.35;
  },

  setVoicePerfMode(on) {
    this.voicePerf = !!on;
    if (this.atmosphere) this.atmosphere.material.opacity = on ? 0.04 : (this.shellDim ? 0.12 : 0.06);
    if (this.clouds) this.clouds.visible = !on;
    if (this.idleNodes) this.idleNodes.visible = !on;
    if (this.neuralLayer) this.neuralLayer.visible = on || this.thinkPulse;
    if (on) {
      while (this.activeEffects.length > 6) {
        const eff = this.activeEffects.pop();
        if (eff?.points) {
          scene.remove(eff.points);
          eff.points.geometry?.dispose?.();
          eff.points.material?.dispose?.();
        }
      }
    }
  },

  setThinkMode(on) {
    this.thinkPulse = !!on;
    if (this.neuralLayer) {
      this.neuralLayer.visible = on || this.voicePerf;
      this.neuralLayer.material.opacity = on ? 0.22 : 0.14;
    }
  },

  setSuperBatchActive(on, meta = {}) {
    this.superBatchActive = !!on;
    this._batchMeta = meta || {};
    if (!this._parent) return;
    if (!this.batchGroup) {
      this.batchGroup = new THREE.Group();
      this._parent.add(this.batchGroup);
      const ringGeo = new THREE.RingGeometry(0.04, 0.07, 48);
      const ringMat = new THREE.MeshBasicMaterial({
        color: 0xaa88ff,
        transparent: true,
        opacity: 0.55,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      this.batchRing = new THREE.Mesh(ringGeo, ringMat);
      this.batchGroup.add(this.batchRing);
      const nodeGeo = new THREE.BufferGeometry();
      const pts = new Float32Array(8 * 3);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        pts[i * 3] = Math.cos(a) * 0.09;
        pts[i * 3 + 1] = Math.sin(a) * 0.09;
        pts[i * 3 + 2] = 0;
      }
      nodeGeo.setAttribute('position', new THREE.BufferAttribute(pts, 3));
      this.batchNodes = new THREE.Points(nodeGeo, new THREE.PointsMaterial({
        size: 0.012,
        color: 0x00ddff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }));
      this.batchGroup.add(this.batchNodes);
    }
    this.batchGroup.visible = on;
    if (on) this._placeBatchRing(meta);
    if (on && meta.lat != null) {
      try {
        const p = this._latLngToPos(meta.lat, meta.lng || 0, 1.06);
        this.spawnEffect(new THREE.Vector3(p.x, p.y, p.z), 0xaa88ff, 24, 40);
      } catch (_) {}
    }
  },

  _placeBatchRing(meta = {}) {
    if (!this.batchGroup) return;
    const lat = meta.lat != null ? meta.lat : 36.44;
    const lng = meta.lng != null ? meta.lng : 28.22;
    const p = this._latLngToPos(lat, lng, 1.055);
    this.batchGroup.position.set(p.x, p.y, p.z);
    const normal = new THREE.Vector3(p.x, p.y, p.z).normalize();
    this.batchGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
  },

  pulseBatchMesh(peerCount) {
    if (!this.batchRing) return;
    this.batchRing.material.opacity = 0.45 + Math.min(peerCount, 8) * 0.04;
    if (this.batchNodes) this.batchNodes.material.color.setHex(peerCount > 2 ? 0x3d9eff : 0x1a6fd4);
    try {
      const m = this._batchMeta || {};
      if (m.lat != null) {
        const p = this._latLngToPos(m.lat, m.lng || 0, 1.06);
        this.spawnEffect(new THREE.Vector3(p.x, p.y, p.z), 0xaa88ff, 18, 35);
      }
    } catch (_) {}
  },

  _tickPilotThrusters() {
    const pilot = window._pilot;
    if (!pilot?.userData?.thrusters) return;
    const t = Date.now() * 0.008;
    pilot.userData.thrusters.forEach((thr, i) => {
      thr.material.opacity = 0.65 + Math.sin(t + i) * 0.35;
      thr.scale.y = 0.8 + Math.sin(t * 1.4 + i) * 0.35;
    });
  },

  update() {
    if (!this._inited) return;
    const thinking = !!GlobeDeck?.thinking;
    if (thinking !== this.thinkPulse) this.setThinkMode(thinking);

    if (this.voicePerf) {
      this._frameSkip = (this._frameSkip + 1) % 2;
      if (this._frameSkip) return;
    }
    const t = Date.now() * 0.001;
    if (this.batchRing && this.superBatchActive) {
      this.batchRing.rotation.z = t * 0.6;
      this.batchRing.material.opacity = 0.35 + Math.sin(t * 2.2) * 0.15;
    }
    if (this.batchNodes && this.superBatchActive) this.batchNodes.rotation.y = t * 0.5;
    if (this.clouds && !this.shellDim && !this.voicePerf) this.clouds.rotation.y += 0.00008;
    if (this.cityLights) this.cityLights.material.opacity = 0.65 + Math.sin(t * 1.5) * 0.1;
    if (this.neuralLayer?.visible && this._neuralPack) {
      this._paintNeural(this._neuralPack.ctx, 512, 256, t * 60);
      this._neuralPack.tex.needsUpdate = true;
      this.neuralLayer.rotation.y += 0.00012;
    }
    this._tickAstranovFlyer();
    this._tickPilotThrusters();
    this._tickPaths();

    for (let i = this.activeEffects.length - 1; i >= 0; i--) {
      const eff = this.activeEffects[i];
      const posAttr = eff.points.geometry.attributes.position;
      const arr = posAttr.array;
      eff.life--;
      const alpha = eff.life / eff.maxLife;
      for (let j = 0; j < arr.length; j += 3) {
        const vidx = j / 3;
        arr[j] += eff.velocities[vidx * 3] * alpha;
        arr[j + 1] += eff.velocities[vidx * 3 + 1] * alpha;
        arr[j + 2] += eff.velocities[vidx * 3 + 2] * alpha;
      }
      posAttr.needsUpdate = true;
      eff.points.material.opacity = alpha * 0.9;
      if (eff.life <= 0) {
        scene.remove(eff.points);
        eff.points.geometry.dispose();
        eff.points.material.dispose();
        this.activeEffects.splice(i, 1);
      }
    }
  },
};

window.AIGraphics = AIGraphics;
// Graphics helpers only on demand — no auto-spawn flying character / orbiters (truth + perf)
const _aiInit = () => {
  try { AIGraphics.init(globePivot); } catch (e) { console.warn('[AIGraphics] init', e); }
};
setTimeout(_aiInit, window._globePerfLite ? 1500 : 600);

// NO auto flyer / particle burst — was fake flying object around Earth
window.AstranovFlyer = {
  spawn(lat, lng, opts) {
    try {
      AIGraphics?.init?.(globePivot);
      window._astranovFlyerActive = true;
      return AIGraphics.spawnAstranovFlyer?.(lat, lng, opts);
    } catch (_) { return null; }
  },
  flyTo(lat, lng, opts) {
    try { return AIGraphics.flyAstranovTo?.(lat, lng, opts); } catch (_) { return null; }
  },
};
window._astranovFlyerActive = false;

/* === 90-voice-world.js === */
// Flow
let me = null;
let others = [];
let hidden = false;



// Identity unified via AstranovSession (same user across devices when signed in)
me = null;
window.me = me;

try { Voice.init(); initVoice(); } catch(e){ console.warn('Voice init skipped:', e.message); }

// Silent init (no panels, all on the globe) - user can play freely first
function initUser() {
  AstranovSession?._applyIdentity?.();
  if (!me) {
    me = { id: 'guest-pending', name: 'Guest', isGuest: true };
    window.me = me;
  }
  setTimeout(() => showOtherUsers(), 1500);

  // No fake GPS marker — real position only after 🎯 Locate or GPS grant
  userLocated = false;
  window._lastPos = null;

  // optional camera/storage only if ever needed later
  // navigator.mediaDevices?.getUserMedia({video: true}).catch(() => {});
  // navigator.storage?.persist?.();
}

try { initUser(); } catch(e){ console.warn('User init skipped:', e.message); }

// Let user explore the globe freely first
console.log('%c[Astranov] Globe UI: drag rotate · wheel/pinch zoom · tap/double-tap fly. 💻 CLI for tasks. 🎧 hands-free optional.', 'color:#00ddff');

// Voice → Astranov (live transcript in input, same path as typing)
let _voiceBusy = false;
let _voiceGen = 0;
let _voiceSilenceTimer = null;
let _voiceCommitting = false;
let _lastVoiceCommit = '';
let _lastVoiceCommitT = 0;
let _voiceDraft = '';
window._handsFreeVoice = false;

const VOICE_SILENCE_MS = 650;
let _voiceLangLocked = false;
let _recognitionPaused = false;
let _listenRestartAt = 0;
let _voiceResumeTimer = null;
let _listenFailStreak = 0;
const VOICE_RESTART_GAP_MS = 650;
const VOICE_RESTART_GAP_MAX_MS = 5200;
const EXECUTE_SUFFIX = /\s*(?:go(?:\s+(?:ahead|do(?:\s+it)?|now))?|do\s+it|execute(?:\s+it)?|run\s+it|send\s+it|now|πήγαινε|κάντο|καντο|εκτέλεσε|ξεκίνα|τρέξε)\s*$/i;
const EXECUTE_PREFIX = /^(?:go(?:\s+(?:ahead|do|and))?|please\s+)?\s*/i;
const CODERS_CANON = 'coders';

function voiceEditDist(a, b) {
  a = String(a || '').toLowerCase();
  b = String(b || '').toLowerCase();
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  const prev = new Array(n + 1);
  const curr = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= n; j++) prev[j] = curr[j];
  }
  return prev[n];
}

function cleanVoiceToken(tok) {
  return String(tok || '').toLowerCase().replace(/[''´`]/g, '').replace(/[^\w\u0370-\u03FF]/g, '');
}

const CODERS_MISHEAR_EXACT = new Set([
  'coders', 'coder', 'corders', 'corder', 'codas', 'coda', 'cooters', 'coaters',
  'colders', 'colder', 'koders', 'koder', 'goders', 'gorder', 'couders', 'coderrs',
  'codehers', 'codeus', 'quarters', 'quarter', 'κοντερ', 'κοντερς', 'κόντερ', 'κόντερς',
  'κοντερσ', 'κοντρς', 'κοντρ', 'κοντερσ',
]);

function tokenSoundsLikeCoders(tok) {
  const w = cleanVoiceToken(tok);
  if (!w) return false;
  if (CODERS_MISHEAR_EXACT.has(w)) return true;
  if (w === 'coders' || w.startsWith('coder')) return true;
  if (/^c[o0q][od][aeiou]*r/.test(w) && w.length <= 10) return true;
  if (/^κ[oό]?ντ[εη]?ρ/.test(w)) return true;
  if (w.length >= 4 && w.length <= 10 && voiceEditDist(w, 'coders') <= 2) return true;
  if (w.length >= 4 && w.length <= 8 && voiceEditDist(w, 'coder') <= 1) return true;
  return false;
}

function phraseIsCodersMishear(text) {
  const core = String(text || '').trim().toLowerCase().replace(EXECUTE_SUFFIX, '').trim();
  if (!core) return false;
  if (tokenSoundsLikeCoders(core)) return true;
  if (/^code\s+her?s$/i.test(core)) return true;
  if (/^code\s+us$/i.test(core)) return true;
  if (/^call\s+her?s$/i.test(core)) return true;
  if (/^go\s+ders?$/i.test(core)) return true;
  return false;
}

/** Suspect "coders" before other garbage — runs on every voice transcript */
function fixVoiceHotwords(text) {
  let s = String(text || '').trim();
  if (!s) return s;

  const suffix = EXECUTE_SUFFIX.test(s) ? (s.match(EXECUTE_SUFFIX)?.[0] || '') : '';
  let core = suffix ? s.replace(EXECUTE_SUFFIX, '').trim() : s;

  const summon = core.match(/^(summon)\s+(\S+)(?:\s+(.*))?$/i);
  if (summon && tokenSoundsLikeCoders(summon[2])) {
    core = 'summon coders' + (summon[3] ? ' ' + summon[3] : '');
    return (core + suffix).trim();
  }

  const codeHer = core.match(/^code\s+(her|hers|us|errors?)\s+(.*)$/i);
  if (codeHer) return (CODERS_CANON + ' ' + codeHer[2] + suffix).trim();

  const parts = core.split(/\s+/);
  const first = parts[0] || '';

  if (tokenSoundsLikeCoders(first)) {
    const rest = parts.slice(1).join(' ');
    if (!rest || phraseIsCodersMishear(core)) return (CODERS_CANON + (rest ? ' ' + rest : '') + suffix).trim();
    return (CODERS_CANON + (rest ? ' ' + rest : '') + suffix).trim();
  }

  if (parts.length <= 3 && phraseIsCodersMishear(core)) return (CODERS_CANON + suffix).trim();

  if (parts.length >= 2 && parts.length <= 6 && tokenSoundsLikeCoders(parts[parts.length - 1])) {
    parts[parts.length - 1] = CODERS_CANON;
    return (parts.join(' ') + suffix).trim();
  }

  if (window.ArcangeloDialect) s = ArcangeloDialect.normalizeForRouting(s) || s;
  return s;
}
window.fixVoiceHotwords = fixVoiceHotwords;

function codersTranscriptScore(text) {
  const fixed = fixVoiceHotwords(String(text || '').trim());
  if (/^coders\b/i.test(fixed)) return 100;
  const first = cleanVoiceToken(String(text || '').split(/\s+/)[0]);
  if (tokenSoundsLikeCoders(first)) return 80 - voiceEditDist(first, 'coders');
  return 0;
}

function pickVoiceTranscript(result, isFinal) {
  let best = result[0]?.transcript || '';
  if (isFinal && result.length > 1) {
    let bestScore = codersTranscriptScore(best);
    for (let j = 1; j < result.length; j++) {
      const alt = result[j]?.transcript || '';
      const score = codersTranscriptScore(alt);
      if (score > bestScore) { bestScore = score; best = alt; }
    }
  }
  if (!isFinal) return fixVoiceHotwords(best);
  const repaired = ArcangeloDialect?.repairTranscript?.(best) || best;
  ArcangeloDialect?.ingest?.(repaired);
  return fixVoiceHotwords(repaired);
}

function defaultListenLang() {
  const nav = (navigator.language || 'en-US').toLowerCase();
  if (nav.startsWith('el')) return 'el-GR';
  if (nav.startsWith('en')) return 'en-US';
  return 'el-GR';
}

function normalizeVoiceCommand(text) {
  let s = fixVoiceHotwords(String(text || '').trim());
  if (!s) return '';
  if (window.ArcangeloDialect) s = ArcangeloDialect.normalizeForRouting(s) || s;
  if (EXECUTE_SUFFIX.test(s)) s = s.replace(EXECUTE_SUFFIX, '').trim();
  if (/^(go|do|run|execute)\s+\S/i.test(s)) s = s.replace(EXECUTE_PREFIX, '').trim();
  return s;
}

function voiceListenBlocked() {
  return _recognitionPaused || Voice?.speaking || _voiceBusy || _voiceCommitting;
}

function setVoicePerfMode(on) {
  window._voicePerfMode = !!on;
  if (on) SlumberManager?.wake?.('voice', 'voice');
  if (window.AIGraphics?.setVoicePerfMode) AIGraphics.setVoicePerfMode(!!on || !!window._globePerfLite);
}
window.setVoicePerfMode = setVoicePerfMode;

function wantsExecuteNow(text) {
  const s = String(text || '').trim();
  if (!s) return false;
  return EXECUTE_SUFFIX.test(s) || /^(go|do|run|execute)\s+\S/i.test(s);
}

function syncListenLang(draft) {
  if (!recognition || !draft) return;
  if (window._handsFreeVoice && _voiceLangLocked) return;
  const lang = ArcangeloDialect?.listenLang?.(draft) || Voice?.detectLang?.(draft) || 'el-GR';
  if (lang === recognition.lang) {
    if (window._handsFreeVoice) _voiceLangLocked = true;
    return;
  }
  if (window._handsFreeVoice) return;
  recognition.lang = lang;
  Voice.preferredListenLang = lang;
}

function pauseVoiceRecognition() {
  if (!recognition) return;
  _recognitionPaused = true;
  if (!isListening) return;
  isListening = false;
  try { recognition.stop(); } catch (_) {}
}
window.pauseVoiceRecognition = pauseVoiceRecognition;

function resumeVoiceRecognition() {
  if (!_recognitionPaused) return;
  _recognitionPaused = false;
  if (window._handsFreeVoice || voiceSessionActive) scheduleVoiceResume();
}
window.resumeVoiceRecognition = resumeVoiceRecognition;

function voiceInterrupt(opts) {
  opts = opts || {};
  _voiceGen++;
  _voiceBusy = false;
  _voiceCommitting = false;
  if (_voiceResumeTimer) { clearTimeout(_voiceResumeTimer); _voiceResumeTimer = null; }
  if (_voiceSilenceTimer) { clearTimeout(_voiceSilenceTimer); _voiceSilenceTimer = null; }
  Voice?.flush?.();
  GlobeDeck?.setThinking?.(false);
  if (window._aciAbort) { try { window._aciAbort.abort(); } catch (_) {} window._aciAbort = null; }
  if (!opts.keepHandsFree) return;
  if (window._handsFreeVoice && !isListening) setTimeout(() => startListeningForOptions(), 80);
}
window.voiceInterrupt = voiceInterrupt;

function syncHandsFreeBtn() {
  const btn = document.getElementById('aci-handsfree');
  if (!btn) return;
  const on = voiceSessionActive || window._handsFreeVoice;
  btn.classList.toggle('deck-btn-active', on);
  btn.classList.toggle('listening', isListening);
  btn.classList.toggle('speaking', !!Voice?.speaking);
  if (isListening || on) AstranovLogo?.setMicActive?.(true);
  else if (!Voice?.speaking) AstranovLogo?.setMicActive?.(false);
}
window.syncHandsFreeBtn = syncHandsFreeBtn;

function openVoiceCli() {
  const title = window.SuperCli?.title || 'Astranov';
  GlobeDeck?.expand(title);
  if (window.AciCli) AciCli.open = true;
  SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
  const input = document.getElementById('aci-cli-in');
  if (input) input.classList.add('voice-live');
  syncHandsFreeBtn();
}

function scheduleVoiceResume() {
  if (sessionHeld || SessionHold?.isHeld?.()) return;
  if (Voice?.speaking) return;
  const active = voiceSessionActive || window._handsFreeVoice;
  if (!active || !voiceEnabled || isListening || voiceListenBlocked()) return;
  if (_voiceResumeTimer) return;
  const wait = Math.max(
    _listenRestartAt - Date.now(),
    window._handsFreeVoice ? VOICE_RESTART_GAP_MS : 500
  );
  _voiceResumeTimer = setTimeout(() => {
    _voiceResumeTimer = null;
    if (sessionHeld || SessionHold?.isHeld?.()) return;
    const on = voiceSessionActive || window._handsFreeVoice;
    if (!on || !voiceEnabled || isListening || voiceListenBlocked()) return;
    startListeningForOptions();
  }, wait);
}

function scheduleSilenceSubmit(draft) {
  if (!window._handsFreeVoice || !draft || _voiceCommitting) return;
  if (_voiceSilenceTimer) clearTimeout(_voiceSilenceTimer);
  _voiceSilenceTimer = setTimeout(() => {
    _voiceSilenceTimer = null;
    if (_voiceCommitting || _voiceBusy) return;
    const input = document.getElementById('aci-cli-in');
    const line = normalizeVoiceCommand((input?.value || draft).trim());
    if (line.length >= 3) commitVoiceCommand(line);
  }, VOICE_SILENCE_MS);
}

function commitVoiceCommand(raw) {
  const line = normalizeVoiceCommand(raw);
  const minLen = ArcangeloDialect?.sessionActive?.() ? 2 : 2;
  if (!line || line.length < minLen || _voiceCommitting) return;
  const now = Date.now();
  const codersLine = /^coders?\b|fix\s|build\s|implement|call\s+coders?/i.test(line);
  const dedupMs = codersLine ? 600 : 2200;
  if (_lastVoiceCommit === line && now - _lastVoiceCommitT < dedupMs) return;
  _lastVoiceCommit = line;
  _lastVoiceCommitT = now;
  _voiceCommitting = true;
  if (_voiceSilenceTimer) { clearTimeout(_voiceSilenceTimer); _voiceSilenceTimer = null; }
  GlobeDeck?.clearCompose?.();
  if (!window._handsFreeVoice) {
    isListening = false;
    try { recognition?.stop(); } catch (_) {}
  }
  console.log('Voice commit:', line);
  submitVoiceToCli(line).finally(() => { _voiceCommitting = false; });
}

function voiceWantsAciControl(line) {
  const low = line.toLowerCase();
  return /pitogyra|πιτογυρ|explore|εξερεύ|πήγαινε|go to|focus/.test(low)
    || GlobeVideo?.wantsYoutube?.(line)
    || /video\s+call|orbital\s+video|κλήση\s+βίντεο/.test(low)
    || /telecom|sat radio|satellite radio|ασύρματος/.test(low)
    || /αγγλικά|english|ελληνικά|greek|athenian|αθηναϊκ|spartan|σπαρτιατ|myrmidon|μυρμιδόν/.test(low)
    || /^(remember|θυμήσου|να θυμάσαι)\b/.test(low)
    || /evolve|neuron|collective|εξέλιξη|brain/.test(low)
    || (/μπίρ|τσιγαρ|beer|cigar|delivery|διανομ|παραγγελ|goals|work|δουλειά/.test(low) && !/^order\b/i.test(line));
}

async function submitVoiceToCli(transcript) {
  const line = normalizeVoiceCommand(transcript);
  if (!line) return;
  const gen = ++_voiceGen;
  _voiceBusy = true;
  openVoiceCli();

  const low = line.toLowerCase();
  if (gen !== _voiceGen) return;

  if (/^(hold|pause session|quiet mode|κράτα|κρατα|σίγαση|σιγαση)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    SessionHold?.hold?.();
    return;
  }
  if (/^(resume|unhold|continue|συνέχισε|συνεχισε|ξανα)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    await SessionHold?.resume?.();
    return;
  }
  if (sessionHeld || SessionHold?.isHeld?.()) {
    if (gen === _voiceGen) _voiceBusy = false;
    AciCli?.print('⏸ session held — say resume or tap ▶', 'dim');
    return;
  }
  if (/^(stop|σταμάτα|σταματα|pause|διακοπή|quiet|σιωπή|mute)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    userIntervene();
    return;
  }
  if (/^(mic|voice|handsfree|hands-free|μίκροφωνο|ακού)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    startVoiceOptions();
    return;
  }
  if (AstranovPresence?.wantsKryftoStart?.(line)) {
    if (gen === _voiceGen) _voiceBusy = false;
    AciCli?.print('🎧 ' + line, 'cmd');
    AstranovPresence?.startKryfto?.();
    if (window._handsFreeVoice && !Voice?.speaking) scheduleVoiceResume();
    return;
  }
  if (WillaGames?.wantsPyramid?.(line)) {
    if (gen === _voiceGen) _voiceBusy = false;
    AciCli?.print('🎧 ' + line, 'cmd');
    WillaGames?.startPyramid?.();
    return;
  }
  if (WillaGames?.wantsWilla?.(line)) {
    if (gen === _voiceGen) _voiceBusy = false;
    AciCli?.print('🎧 ' + line, 'cmd');
    WillaGames?.startWilla?.();
    return;
  }
  if (/^(dark|bright|light)\s*(theme|mode)?\b/.test(low) || /^theme\s+(dark|bright|light)\b/.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    const mode = /bright|light/.test(low) ? 'bright' : 'dark';
    AstranovTheme?.set?.(mode);
    AciCli?.print('theme → ' + mode, 'ok');
    return;
  }
  if (/^(use\s+)?(openai|gpt|groq|gemini|deepseek|deep\s*seek|cycle|astranov)\b/i.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    const prov = /openai|gpt/.test(low) ? 'openai-mini'
      : /groq/.test(low) ? 'groq'
      : /gemini/.test(low) ? 'gemini'
      : /deep/.test(low) ? 'deepseek'
      : 'astranov';
    AiRouter?.setProvider?.(prov);
    LabOrbs?._syncGlyphs?.();
    AciCli?.print('AI provider → ' + (AiRouter.current()?.label || prov), 'ok');
    ACIControl?.reply('AI provider → ' + (AiRouter.current()?.label || prov));
    if (window._handsFreeVoice && !Voice?.speaking) scheduleVoiceResume();
    return;
  }
  if (/^summon\s+composer|^use\s+composer|^queue\s+composer/i.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    void CodersHub?.summonComposer?.();
    if (window._handsFreeVoice && !Voice?.speaking) scheduleVoiceResume();
    return;
  }
  if (/coders?\s*hub|open\s*labs?|ai\s*teams?/i.test(low)) {
    if (gen === _voiceGen) _voiceBusy = false;
    CodersHub?.toggle?.(true);
    ACIControl?.reply('Coders Hub open');
    if (window._handsFreeVoice && !Voice?.speaking) scheduleVoiceResume();
    return;
  }

  try {
    if (gen !== _voiceGen) return;
    const low = line.toLowerCase();
    const cliCmd = /^(order|locate|city|theme|dark|bright|batch|vhf|phone|drive|logout|login|sign|help|ping)\b/.test(low);
    if (!cliCmd && !voiceWantsAciControl(line) && window.AciCoders) {
      await AciCoders.chat(line, { fromVoice: true });
    } else if (voiceWantsAciControl(line)) {
      await ACIControl.handle(line, { fromVoice: true });
    } else if (window.AciCli) {
      await AciCli.run(line, { fromVoice: true });
    } else if (window.AciCoders) {
      await AciCoders.chat(line, { fromVoice: true });
    } else {
      await ACIControl.handle(line, { fromVoice: true });
    }
  } catch (e) {
    if (gen === _voiceGen) AciCli?.print('voice error: ' + (e.message || e), 'err');
  } finally {
    if (gen === _voiceGen) {
      _voiceBusy = false;
      const input = document.getElementById('aci-cli-in');
      if (input) input.classList.remove('voice-live');
      syncHandsFreeBtn();
      if (window._handsFreeVoice && !Voice?.speaking) scheduleVoiceResume();
    }
  }
}
window.submitVoiceToCli = submitVoiceToCli;
window.scheduleVoiceResume = scheduleVoiceResume;

function initVoice() {
  if ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window) {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRec();
    Voice.preferredListenLang = Voice.preferredListenLang || defaultListenLang();
    recognition.lang = Voice.preferredListenLang;
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.onresult = handleVoiceCommand;
    recognition.onerror = (e) => {
      isListening = false;
      if (e.error === 'aborted' || _recognitionPaused) return;
      if (e.error === 'no-speech') {
        _listenFailStreak = Math.min(_listenFailStreak + 1, 6);
        if (voiceSessionActive || window._handsFreeVoice) {
          const gap = Math.min(
            VOICE_RESTART_GAP_MS + _listenFailStreak * 400,
            VOICE_RESTART_GAP_MAX_MS
          );
          _listenRestartAt = Date.now() + gap;
          scheduleVoiceResume();
        }
        return;
      }
      console.log('Voice error', e.error || e);
      if (e.error === 'not-allowed') {
        ACIControl?.reply('Mic blocked — allow microphone in browser settings');
        AciCli?.print('Mic blocked — enable microphone for astranov.eu', 'err');
      } else if (e.error === 'network') {
        ACIControl?.reply('Voice needs network — check connection');
      }
      _listenFailStreak = Math.min(_listenFailStreak + 1, 6);
      if ((voiceSessionActive || window._handsFreeVoice) && !voiceListenBlocked()) {
        const gap = Math.min(
          VOICE_RESTART_GAP_MS + _listenFailStreak * 500,
          VOICE_RESTART_GAP_MAX_MS
        );
        _listenRestartAt = Date.now() + gap;
        scheduleVoiceResume();
      }
    };
    recognition.onend = () => {
      isListening = false;
      if (_recognitionPaused || Voice?.speaking || voiceListenBlocked()) return;
      if ((voiceSessionActive || window._handsFreeVoice) && voiceEnabled) {
        const gap = _listenFailStreak > 0
          ? Math.min(VOICE_RESTART_GAP_MS + _listenFailStreak * 350, VOICE_RESTART_GAP_MAX_MS)
          : VOICE_RESTART_GAP_MS;
        _listenRestartAt = Date.now() + gap;
        scheduleVoiceResume();
      }
    };
  } else {
    console.log('Voice not supported, using console fallback.');
  }
}

function startListeningForOptions() {
  if (sessionHeld || SessionHold?.isHeld?.()) return;
  if (!recognition || isListening || voiceListenBlocked()) return;
  const wait = _listenRestartAt - Date.now();
  if (wait > 0) {
    if (!_voiceResumeTimer) {
      _voiceResumeTimer = setTimeout(() => {
        _voiceResumeTimer = null;
        startListeningForOptions();
      }, wait);
    }
    return;
  }
  openVoiceCli();
  isListening = true;
  syncHandsFreeBtn();
  try {
    recognition.start();
    _listenFailStreak = 0;
    _listenRestartAt = Date.now() + VOICE_RESTART_GAP_MS;
  } catch (e) {
    isListening = false;
    _listenFailStreak = Math.min(_listenFailStreak + 1, 6);
    if (e?.name === 'InvalidStateError') {
      _listenRestartAt = Date.now() + Math.min(
        VOICE_RESTART_GAP_MS * 2 + _listenFailStreak * 600,
        VOICE_RESTART_GAP_MAX_MS
      );
      if (voiceSessionActive || window._handsFreeVoice) scheduleVoiceResume();
    }
  }
}

function handleVoiceCommand(event) {
  const input = document.getElementById('aci-cli-in');
  let interim = '';
  let final = '';

  let hasFinal = false;
  for (let i = event.resultIndex; i < event.results.length; i++) {
    const isFinal = !!event.results[i].isFinal;
    const t = pickVoiceTranscript(event.results[i], isFinal);
    if (isFinal) { final += t; hasFinal = true; }
    else interim += t;
  }

  const draft = (final || interim).trim();
  if (!draft) return;
  if (Voice?.speaking && !hasFinal) return;

  if (_voiceCommitting) {
    if (input) {
      input.value = draft;
      input.classList.add('voice-live');
      if (AciCli) AciCli.buffer = draft;
      window.resizeCliInput?.(input);
    }
    _voiceDraft = draft;
    return;
  }
  if (_voiceBusy && input) {
    input.value = draft;
    input.classList.add('voice-live');
    if (AciCli) AciCli.buffer = draft;
    window.resizeCliInput?.(input);
    _voiceDraft = draft;
    return;
  }
  if (Voice?.speaking && window._handsFreeVoice && draft.length > (_voiceDraft?.length || 0) + 8) {
    voiceInterrupt({ keepHandsFree: true });
  }
  _voiceDraft = draft;

  voiceSessionActive = true;
  voiceEnabled = true;
  syncListenLang(draft);
  openVoiceCli();
  if (input) {
    input.value = draft;
    input.classList.add('voice-live');
    if (AciCli) AciCli.buffer = draft;
    window.resizeCliInput?.(input);
  }
  syncHandsFreeBtn();

  const live = (final || interim).trim();
  if (final.trim()) {
    if (window._handsFreeVoice) {
      commitVoiceCommand(final.trim());
    } else {
      const input = document.getElementById('aci-cli-in');
      if (input) {
        input.value = normalizeVoiceCommand(final.trim());
        input.classList.add('voice-live');
        window.resizeCliInput?.(input);
        input.focus();
      }
    }
    return;
  }
  if (wantsExecuteNow(live)) {
    const cmd = normalizeVoiceCommand(live);
    if (cmd.length >= 2) commitVoiceCommand(cmd);
    return;
  }
  scheduleSilenceSubmit(live);
}

function resumeListening() {
  scheduleVoiceResume();
}
window.resumeListening = resumeListening;

async function ensureMicPermission() {
  if (!navigator.mediaDevices?.getUserMedia) return true;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    stream.getTracks().forEach(t => t.stop());
    return true;
  } catch (_) {
    return false;
  }
}

function startVoiceOptions() {
  if (sessionHeld || SessionHold?.isHeld?.()) {
    SessionHold?.resume?.();
    return;
  }
  if (window._handsFreeVoice && isListening) {
    userIntervene();
    return;
  }
  if (!recognition) {
    AciCli?.print('Voice not supported — type below or use Chrome/Safari on HTTPS', 'err');
    ACIControl?.reply('Voice unavailable — type your message below');
    GlobeDeck?.expand?.(SuperCli?.title || 'Astranov');
    document.getElementById('aci-cli-in')?.focus();
    return;
  }
  Voice.flush();
  _voiceLangLocked = false;
  _recognitionPaused = false;
  voiceSessionActive = true;
  voiceEnabled = true;
  window._handsFreeVoice = true;
  setVoicePerfMode(true);
  GlobeDeck?.expand?.(SuperCli?.title || 'Astranov');
  AciCoders?.enterSession?.({ expand: true, focus: false, ping: false });
  openVoiceCli();
  _voiceDraft = '';
  _lastVoiceCommit = '';
  _listenFailStreak = 0;
  _listenRestartAt = 0;
  if (_voiceResumeTimer) { clearTimeout(_voiceResumeTimer); _voiceResumeTimer = null; }
  const lang = defaultListenLang();
  Voice.preferredListenLang = lang;
  if (recognition) {
    recognition.lang = lang;
    _voiceLangLocked = true;
  }
  AciCli?.print('🎧 listening — speak, pause ~1s, I reply in ribbon', 'dim');
  ACIControl?.reply('Grok listening — speak now');
  CliRibbon?.setNotice?.('Grok listening…', 'thinking');
  GlobeDeck?.setPreview?.('🎧 Listening — pause ~1s to send');
  const input = document.getElementById('aci-cli-in');
  if (input) input.placeholder = '🎧 Grok listening — pause to send';
  AstranovSession?.push?.();
  syncHandsFreeBtn();
  // Mic first — never block recognition behind TTS (mobile was stuck on "listening" with no mic)
  void ensureMicPermission().then(ok => {
    if (!ok) {
      AciCli?.print('Allow microphone for astranov.eu — then tap 🎧 again', 'err');
      CliRibbon?.setNotice?.('Mic blocked — allow in browser', 'err');
    }
    scheduleVoiceResume();
  });
  const touchMobile = window.matchMedia?.('(max-width: 900px), (pointer: coarse)')?.matches;
  if (!touchMobile && Voice?.maySpeak?.() && Voice?.shouldSpeak?.('listening')) {
    speak('Listening.', () => {}, false);
  }
}

function primeGrokVoice() {
  if (window._handsFreeVoice || isListening) return;
  const row = document.getElementById('globe-deck-input-row');
  if (!row || row.dataset.grokPrimed) return;
  row.dataset.grokPrimed = '1';
  row.addEventListener('click', () => {
    if (!window._handsFreeVoice && !isListening && !Voice?.speaking) startVoiceOptions();
  }, { once: true, passive: true });
}
window.primeGrokVoice = primeGrokVoice;

function stopHandsFree() {
  window._handsFreeVoice = false;
  voiceSessionActive = false;
  _voiceLangLocked = false;
  _recognitionPaused = false;
  _listenFailStreak = 0;
  _voiceDraft = '';
  setVoicePerfMode(false);
  if (_voiceResumeTimer) { clearTimeout(_voiceResumeTimer); _voiceResumeTimer = null; }
  if (_voiceSilenceTimer) { clearTimeout(_voiceSilenceTimer); _voiceSilenceTimer = null; }
  AstranovSession?.push?.();
}
window.stopHandsFree = stopHandsFree;

function requestLocationIfNeeded(onLocated) {
  if (userLocated || !navigator.geolocation) {
    if (onLocated) onLocated();
    return;
  }
  navigator.geolocation.getCurrentPosition(pos => {
    placeMe(pos.coords.latitude, pos.coords.longitude, { quiet: true, markerOnly: true });
    window._lastPos = { lat: pos.coords.latitude, lng: pos.coords.longitude };
    userLocated = true;
    if (onLocated) onLocated();
  }, () => {
    if (onLocated) onLocated();
  });
}



function placeMe(lat, lng, opts) {
  opts = opts || {};
  const quiet = !!opts.quiet;
  const markerOnly = !!opts.markerOnly;
  const shouldFly = !!opts.fly || (!markerOnly && GlobeControl?.shouldAutoFly?.());
  if (GhostTravel?.active?.()) {
    GhostTravel.setTruePos(lat, lng);
    window._truePos = { lat, lng };
    userLocated = true;
    const g = GhostTravel.publicPos();
    if (shouldFly && typeof flyToPoint === 'function') {
      const pos = latLngToPos(g.lat, g.lng, 1.03);
      flyToPoint(new THREE.Vector3(pos.x, pos.y, pos.z), opts.zoom ?? (GlobeControl?.Z?.global || 2.55));
    }
    GhostTravel._applyVisual?.();
    if (!quiet) FieldBrain?.pulse('location', 'ghost route · real GPS private', { role: 'client', props: { visual_truth: true } });
    return;
  }
  window._lastPos = { lat, lng };
  if (window._meMarker && window._meMarker.parent) window._meMarker.parent.remove(window._meMarker);
  const pos = latLngToPos(lat, lng, 1.03);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.028,8,8), new THREE.MeshBasicMaterial({color:0x3d9eff}));
  m.position.set(pos.x,pos.y,pos.z);
  m.userData = {type:'me', name: me ? me.name : 'You'};
  globePivot.add(m);
  window._meMarker = m;
  userLocated = true;
  GlobeEntity?.syncMe?.(lat, lng, me ? me.name : 'You');
  if (quiet) {
    MapDepict.pulse(lat, lng, 0x3d9eff, 'You', 6000);
    GlobeDeck?.setMapStatus('📍 ' + lat.toFixed(2) + ', ' + lng.toFixed(2));
  } else {
    MapDepict.action('location', { lat, lng, detail: me ? me.name : 'You' });
  }
  if (shouldFly && typeof flyToPoint === 'function') {
    const cz = CityLife?.CITY_ZOOM || GlobeControl?.Z?.city || 1.38;
    const nz = GlobeControl?.Z?.national || 1.82;
    const z = opts.zoom ?? (opts.cityDrop ? cz : nz);
    if (ZoomTiers && !opts.cityDrop) ZoomTiers.goTo('national', true);
    else if (ZoomTiers && opts.cityDrop) ZoomTiers.goTo('city', true);
    flyToPoint(new THREE.Vector3(pos.x, pos.y, pos.z), z);
    cityLevel = !!opts.cityDrop && z <= (GlobeControl?.Z?.regional || 1.65);
    GlobeControl?.noteAutoFly?.();
    CosmicZoom?.update?.(z);
    CityMap?.onCamera?.(z, 'earth');
    if (!window._globeFly) ZoomTiers?.syncFromCamZ?.(z, false);
  }
  if (!quiet) FieldBrain?.pulse('location', 'locate me', { role: 'client' });
  AstranovPresence?.onMove?.(lat, lng);
}

function _gpsDeniedUi(reason) {
  const msg = reason || 'Location denied — enable GPS in browser settings to open your city map';
  GlobeDeck?.expand?.(SuperCli?.title || 'Astranov');
  GlobeDeck?.showError?.(msg);
  GlobeDeck?.setMapStatus?.(msg);
  AciCli?.print(msg, 'err');
  ACIControl?.reply(msg);
  CliRibbon?.setNotice?.(msg.slice(0, 100), 'err');
  // Trust rule: never silent-fly to Rhodes demo coords
}

function locateMe() {
  GlobeDeck?.expand?.(SuperCli?.title || 'Astranov');
  GlobeDeck?.setMapStatus('Locating your city…');
  GlobeControl?.engageFollow?.('locate');
  ACIControl?.reply('Locating — need GPS for your city (no demo map)');
  CliRibbon?.setNotice?.('Locating…', 'thinking');
  if (!navigator.geolocation) {
    _gpsDeniedUi('This browser has no geolocation — cannot open your city');
    return;
  }
  if (CityLife?.locateAndDropIn) {
    CityLife.locateAndDropIn()
      .then((r) => {
        if (r?.error) {
          _gpsDeniedUi(r.message || r.error);
          return;
        }
        CliRibbon?.setNotice?.('Located · city map', 'ready');
      })
      .catch((err) => {
        _gpsDeniedUi(
          err?.code === 1 || /denied/i.test(String(err?.message || err))
            ? 'Location denied — enable GPS for this site, then tap 🎯 again'
            : 'Location failed — check GPS / permissions, then tap 🎯 again'
        );
      });
    return;
  }
  navigator.geolocation.getCurrentPosition(
    async pos => {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      await enterCityView?.(lat, lng);
      CliRibbon?.setNotice?.('Located · city map', 'ready');
    },
    () => {
      _gpsDeniedUi('Location denied — enable GPS in browser settings');
    },
    { enableHighAccuracy: true, timeout: 14000, maximumAge: 30000 }
  );
}
window.locateMe = locateMe;
window._gpsDeniedUi = _gpsDeniedUi;

function showOtherUsers() {
  AstranovPresence?.refresh?.();
}

function toggleKryfto() {
  return AstranovPresence?.toggleHide?.();
}

function groupOrder() {
  console.log('%c[Order] Ζητάω pitogyra + μπίρες + τσιγάρα με drone...', 'color:#ffaa33');
  TelemachosPilot?.runDemoDelivery?.();
}

function showPilotTelemachos() {
  return TelemachosPilot?.showPilot?.();
}

/* === 99-boot-features.js === */
// === BOOT FEATURES — entities, voice, product, heavy modules (idle-friendly) ===
window.__astranovBootFeatures = function __astranovBootFeatures() {
  const soft = (name, fn) => {
    try { fn?.(); } catch (e) { console.warn('[boot-features] ' + name, e); }
  };
  const idle = (fn, ms) => {
    const run = () => { try { fn(); } catch (e) { console.warn('[boot idle]', e); } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: ms });
    else setTimeout(run, ms);
  };

  soft('GlobeEntity', () => GlobeEntity?.init?.());
  soft('AiRouter', () => AiRouter?.init?.());
  soft('ProductSurface', () => ProductSurface?.init?.());
  soft('CityTasks', () => CityTasks?.init?.());
  soft('SpaceNetCM', () => SpaceNetCM?.init?.());

  idle(() => ArchitectBridge?.init?.(), 2500);
  idle(() => GlobeInfoTiles?.init?.({ seed: false }), 4000);
  idle(() => ProductSurface?._ensureCityDnaSection?.(), 1600);

  setTimeout(() => { try { Auth?.refreshAuthority?.(); } catch (_) {} }, 1200);
  setTimeout(() => {
    try {
      ProductSurface?.init?.();
      MenuProfilePostTile?.init?.();
    } catch (_) {}
  }, 1400);
  try { AciCli?.primeCodersCli?.(); } catch (_) {}
  setTimeout(() => { try { AciCoders?.ensureBridge?.(); } catch (_) {} }, 5000);

  if (window._lastPos) {
    try {
      const nm = Auth?.user?.user_metadata?.full_name || Auth?.user?.email?.split?.('@')?.[0] || 'You';
      GlobeEntity?.syncMe?.(_lastPos.lat, _lastPos.lng, nm);
    } catch (_) {}
  }

  setTimeout(() => {
    window._bootEarthLock = false;
    if (typeof camera !== 'undefined' && camera?.position?.z > 4.8) {
      camera.position.z = 2.55;
      ZoomTiers?.goTo?.('global', false);
    }
    CosmicZoom?.update?.(2.55, { tier: 'global', label: 'Earth', cosmic: 'earth' });
    const ready = PublicCopy?.readyNotice?.() || 'Ready · drag Earth · 🎯 city · 🎧 chat';
    ACIControl?.reply?.(ready);
    CliRibbon?.setNotice?.(ready, 'ready');
    GlobeDeck?.setPreview?.(PublicCopy?.isArchitect?.()
      ? 'Architect · fix · task · starship'
      : 'Type or 🎧 · 🎯 city · + post · date · hire · order');
    GlobeDeck?.setTitle?.(PublicCopy?.deckTitle?.() || 'Astranov');
    const inp = document.getElementById('aci-cli-in');
    if (inp && PublicCopy?.inputPlaceholder) inp.placeholder = PublicCopy.inputPlaceholder();
    try { primeGrokVoice?.(); } catch (_) {}
    try { showFirstRunCoach?.(); } catch (_) {}
    setTimeout(
      () => AciCoders?.enterSession?.({ expand: false, ping: false, focus: false }),
      window._globePerfLite ? 8000 : 4000
    );
    const zl = document.getElementById('zoom-label');
    if (zl) zl.textContent = PublicCopy?.zoomLine?.('global') || 'Earth · drag · 🎯 city · 🎧 chat · + post';
  }, 400);

  // Coach helper (was in old boot)
  if (!window.showFirstRunCoach) {
    window.showFirstRunCoach = function showFirstRunCoach() {
      try { if (localStorage.getItem('astranov:coach-v2')) return; } catch (_) { return; }
      const el = document.getElementById('first-run-coach');
      const ok = document.getElementById('first-run-coach-ok');
      if (!el || !ok) return;
      if (PublicCopy?.coachHtml) {
        el.innerHTML = PublicCopy.coachHtml()
          + '<button type="button" id="first-run-coach-ok">Got it</button>';
      }
      const okBtn = document.getElementById('first-run-coach-ok') || ok;
      el.hidden = false;
      okBtn.onclick = () => {
        el.hidden = true;
        try { localStorage.setItem('astranov:coach-v2', '1'); } catch (_) {}
      };
    };
  }

  document.documentElement.dataset.astranovPhase = 'features';
  window._astranovFeaturesReady = true;
  console.log('%c[Astranov] features boot · full surface', 'color:#ffdd44;font-weight:700');
};
