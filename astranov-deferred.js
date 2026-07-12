/* split-lite moved from astranov-app.js */
// === BRAIN NEURONS — autonomous collective memory · globe pins · never stops growing ===
const BrainNeurons = {
  _principles: [],
  _spawned: new Set(),
  _activity: [],
  _evolving: false,
  _flushTimer: null,
  _booted: false,
  EVOLVE_EVERY: 3,
  MAX_GLOBE: 56,
  MAX_EPHEMERAL: 28,

  count() { return this._principles.length + (ACI?.neurons?.length || 0); },

  _hash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
    return h;
  },

  _seedLatLng(idx, text) {
    const h = this._hash(String(text || idx));
    const lat = ((Math.abs(h) % 11000) / 100) - 55 + ((idx * 13) % 15) / 10;
    const lng = (((h >> 10) % 36000) / 100) - 180;
    return { lat: Math.max(-70, Math.min(70, lat)), lng };
  },

  _activityLatLng() {
    const p = window._lastPos || CityMap?.mapViewCenter?.() || TrackballGuard?.facingLatLng?.() || {};
    if (p.lat != null && p.lng != null) {
      return { lat: p.lat + (Math.random() - 0.5) * 0.08, lng: p.lng + (Math.random() - 0.5) * 0.08 };
    }
    return this._seedLatLng(this._principles.length + Date.now() % 97, 'field');
  },

  _ingest(list, source) {
    if (!Array.isArray(list)) return 0;
    let n = 0;
    list.forEach((row, i) => {
      const content = typeof row === 'string' ? row : (row?.content || '');
      if (!content || content.length < 6) return;
      if (this._principles.some(p => p.content === content)) return;
      const strength = typeof row === 'object' ? (row.strength || row.importance || 1.2) : 1.2;
      this._principles.push({ content, strength, source: source || 'server' });
      const ll = this._seedLatLng(this._principles.length + i, content);
      this._spawnGlobe(ll.lat, ll.lng, strength, content);
      n++;
    });
    this._syncChip();
    return n;
  },

  _trimPermanent() {
    const ents = [...(GlobeEntity?.entities?.values?.() || [])].filter(e => e.type === 'neuron' && !e.data?.ephemeral);
    if (ents.length <= this.MAX_GLOBE) return;
    ents.sort((a, b) => (a.data?.strength || 1) - (b.data?.strength || 1));
    ents.slice(0, ents.length - this.MAX_GLOBE).forEach(e => GlobeEntity?.unregister?.(e.id));
  },

  _spawnGlobe(lat, lng, strength, principle, opts) {
    opts = opts || {};
    if (lat == null || lng == null) return;
    if (!opts.ephemeral) this._trimPermanent();
    const key = (opts.ephemeral ? 'e:' : '') + (principle || '').slice(0, 120) + ':' + Date.now();
    if (!opts.ephemeral && this._spawned.has((principle || '').slice(0, 120))) return;
    if (!opts.ephemeral) this._spawned.add((principle || '').slice(0, 120));
    const id = 'neuron-' + (opts.ephemeral ? 'e-' : '') + this._hash(key + lat + lng);
    GlobeEntity?.unregister?.(id);
    GlobeEntity?.register?.({
      id,
      type: 'neuron',
      lat,
      lng,
      title: '🧠 ' + (principle || 'Neuron').slice(0, 48),
      description: (principle || '') + (opts.ephemeral ? '\n· live field signal' : '\n· collective principle'),
      urgency: opts.ephemeral ? 1 : (strength > 1.3 ? 2 : 1),
      data: { principle, strength, ephemeral: !!opts.ephemeral, ts: Date.now() },
      onTap: () => this._showHud(principle, strength),
    });
    if (!opts.ephemeral) ACI?.spawnNeuron?.(lat, lng, strength, principle);
    if (opts.ephemeral) this._trimEphemeral();
    CityMap?._syncMarkers?.();
  },

  _trimEphemeral() {
    const ents = [...(GlobeEntity?.entities?.values?.() || [])].filter(e => e.type === 'neuron' && e.data?.ephemeral);
    if (ents.length <= this.MAX_EPHEMERAL) return;
    ents.sort((a, b) => (a.data?.ts || 0) - (b.data?.ts || 0));
    ents.slice(0, ents.length - this.MAX_EPHEMERAL).forEach(e => GlobeEntity?.unregister?.(e.id));
  },

  _showHud(principle, strength) {
    const hud = document.getElementById('globe-entity-hud');
    if (!hud) return;
    hud.classList.add('open');
    document.getElementById('ge-hud-type').textContent = '▸ neuron · strength ' + (strength || 1).toFixed(1);
    document.getElementById('ge-hud-title').textContent = 'Collective memory';
    document.getElementById('ge-hud-desc').textContent = principle || 'Astranov brain principle';
    const actions = document.getElementById('ge-hud-actions');
    if (actions) actions.style.display = 'none';
    GlobeDeck?.setPreview?.('◎ ' + this.count() + ' neurons · Justice → Truth → Freedom');
  },

  _syncChip() {
    const n = this.count();
    const guide = document.getElementById('cosmic-guide');
    if (guide && n > 0) guide.textContent = '◎ ' + n + ' neurons · every action grows the brain';
    const deck = document.getElementById('globe-deck-title');
    if (deck && !GlobeDeck?.thinking) deck.dataset.neurons = String(n);
  },

  recordActivity(action, detail, opts) {
    opts = opts || {};
    this._activity.push({ action, detail: String(detail || '').slice(0, 160), role: opts.role, ts: Date.now() });
    ACI?.feed?.(action, detail);
    const sig = /think|teach|order|delivery|work|drive|vendor|evolve|explore|location|commerce|route|claim|city|post/i.test(action);
    if (sig) {
      const ll = this._activityLatLng();
      this._spawnGlobe(ll.lat, ll.lng, 0.95, (detail || action).slice(0, 90), { ephemeral: true });
      if (this._activity.length >= 8) void this._flush();
    }
  },

  async _flush() {
    if (!this._activity.length) return;
    const batch = this._activity.splice(0, 16);
    const digest = batch.map(b => b.action + ':' + b.detail).join('; ').slice(0, 520);
    try {
      await ACI?.api?.({ mode: 'log', action: 'field_batch', detail: digest, role: batch[0]?.role || 'client' });
    } catch (_) {}
    if (batch.length >= 6) void this._maybeEvolve('field x' + batch.length);
  },

  async _maybeEvolve(reason) {
    if (this._evolving) return;
    this._evolving = true;
    try {
      const r = await ACI?.api?.({ mode: 'evolve', activity: reason || 'spacenet' });
      const fresh = (r?.principles || []).filter(p => !this._principles.some(x => x.content === p));
      if (fresh.length) this._ingest(fresh, 'evolved');
      const births = Math.max(1, Math.min(4, Number(r?.brain?.inserted) || (fresh.length ? 2 : 1)));
      for (let i = 0; i < births; i++) {
        const ll = this._activityLatLng();
        this._spawnGlobe(ll.lat, ll.lng, 1.15 + Math.random() * 0.25, 'collective · ' + (reason || 'grow').slice(0, 60), { ephemeral: true });
      }
      ACI?.pulse?.(1.9);
      MissionSupportReporter?.recordProgress?.('brain', 'evolve · +' + births + ' · total ' + this.count(), { reason, total: this.count() });
      if (!document.hidden) GlobeDeck?.setPreview?.('Brain +' + births + ' neurons · ' + this.count() + ' total', 'dim');
    } catch (_) {}
    finally { this._evolving = false; }
  },

  onCycle(n) {
    void this._flush();
    if (n % this.EVOLVE_EVERY === 0) void this._maybeEvolve('cycle ' + n);
  },

  tick() {
    ACI?.tick?.();
    const t = Date.now() / 550;
    (ACI?.neurons || []).forEach((n, i) => {
      const s = (n.userData?.strength || 1) * (0.82 + Math.sin(t + i * 0.65) * 0.18);
      n.scale.setScalar(s);
    });
  },

  async boot() {
    if (this._booted) return;
    this._booted = true;
    try {
      const ensured = await ACI?.api?.({ mode: 'ensure_neurons' });
      if (ensured?.principles?.length) this._ingest(ensured.principles, 'seed');
      const stats = await ACI?.api?.({ mode: 'stats' });
      if (stats?.principles?.length) this._ingest(stats.principles, 'memory');
    } catch (_) {}
    this._syncChip();
    if (!this._flushTimer) this._flushTimer = setInterval(() => this._flush(), 28000);
    setTimeout(() => this._maybeEvolve('boot warm'), 90000);
    setTimeout(() => this._maybeEvolve('session digest'), 300000);
  },
};
window.BrainNeurons = BrainNeurons;


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
    MissionSupportReporter?.recordProgress?.(String(source || 'field'), d, props);
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

  /** Open live Coders chat — expanded CLI, mic ready, replies visible */
  async enterSession(opts = {}) {
    opts = opts || {};
    await this.autoStart();
    if (GlobeDeck) GlobeDeck.activeTask = 'coders';
    if (opts.expand) {
      GlobeDeck?.onUserMessage?.('Coders');
      GlobeDeck?.expand?.('Coders');
    } else {
      GlobeDeck?.setTitle?.('Coders');
      GlobeDeck?.setPreview?.('Coders ready — type below');
      CliRibbon?.setActive?.('Coders');
    }
    AppShortcuts?.track?.('coders', 'Coders');
    if (window.AciCli) AciCli.open = true;

    const input = document.getElementById('aci-cli-in');
    if (input) {
      input.placeholder = 'Talk to Astranov — type or tap 🎧 · Enter to send';
      input.classList.remove('voice-live');
      if (opts.focus !== false) {
        setTimeout(() => input.focus(), 60);
      }
    }

    if (opts.fromVoice || window._handsFreeVoice || voiceSessionActive) {
      if (!window._handsFreeVoice && typeof startVoiceOptions === 'function') {
        startVoiceOptions();
      } else {
        scheduleVoiceResume?.();
      }
    }

    this.updateHud();

    if (!this._sessionWelcomed || opts.ping) {
      if (!this._sessionWelcomed) this._sessionWelcomed = true;
      const line = opts.ping
        ? 'Grok still here — keep talking (type or 🎧)'
        : 'talk hands-free to Astranov — type or tap 🎧 and speak. I reply in ribbon + voice.';
      AciCli?.print(line, 'ok');
      ACIControl?.reply(line.slice(0, 200));
      if (opts.fromVoice && window._handsFreeVoice && Voice?.maySpeak?.()) {
        speak('Coders ready. Talk normally.', () => resumeListening?.(), false);
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

    const prefix = r.explicit_order || r.order_executed ? 'ORDER: ' : '';
    const kind = r.error && !raw ? 'err' : 'reply';
    AciCli?.print(prefix + reply, kind);
    ACIControl?.reply(prefix + reply.slice(0, 260));

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
    return /^(are you there|you there|hello|hi|hey|ping|online|listening|composer|grok|coders|γεια|είσαι|ακούς|π��ρών|εδώ|μου ακούς)/i.test(s)
      || /^(composer|grok|coders)\s+(are you there|online|there)/i.test(s);
  },

  isFailedReply(text) {
    return /gathering itself|warming up|try again in a few seconds|try again (in a moment|shortly)|no model responded/i.test(String(text || ''));
  },

  isLocalGlobeCmd(m) {
    const s = String(m || '').trim();
    return /^locate\s*(me|button)?$/i.test(s)
      || /^zoom\s+to\s+me$/i.test(s)
      || /^where\s+am\s+i\??$/i.test(s)
      || /^find\s+me$/i.test(s)
      || /^🎯|📍$/.test(s);
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
    if (/audit|auditor|accountant|λογιστ|λογιστή|λογιστές|ισολογισμ|ισοζύγι|καθολικ/.test(low) && /open|άνοιξε|show|δείξε|πήγαινε|go|start|^audit|^λογιστ/.test(low)) {
      const tab = /ισολογισμ/.test(low) ? 'balance' : /ισοζύγι/.test(low) ? 'trial' : /καθολικ|ledger/.test(low) ? 'ledger' : /μισθοδοσ/.test(low) ? 'payroll' : /φόρ|tax/.test(low) ? 'tax' : 'company';
      AuditorPortal?.open?.({ tab });
      return 'Άνοιγμα auditors.astranov.eu · ' + tab;
    }
    if (/^(audit|auditors|λογιστ)/.test(low)) {
      AuditorPortal?.open?.({ tab: 'company' });
      return 'Άνοιγμα auditors.astranov.eu';
    }
    if (/avc|coin|ledger|justice|wallet|κρυπτο|νόμισμα/.test(low) && /balance|ledger|open|show|wallet|δείξε/.test(low)) {
      if (/open|wallet|show|δείξε/.test(low)) CoinPortal?.open?.(/ledger|transparen/.test(low) ? 'transparency' : 'wallet');
      else AvcJustice?.cli?.(['avc', /ledger|διαφάν|transparen/.test(low) ? 'ledger' : 'balance']);
      return 'coin.astranov.eu — AVC wallet · 1 AVC = 1 EUR · work-mint only';
    }
    return null;
  },

  formatHonestReply(r, userMsg) {
    const text = String(r.text || r.response || '').trim();
    if (!text) return '';
    const id = r.summon_id || r.composer_queued;
    if (id && this.isBuildTask(userMsg)) {
      const stripped = text.replace(/\b(done|fixed|implemented|completed|applied)\b/gi, '').trim();
      return (stripped ? stripped.slice(0, 280) + '\n\n' : '')
        + 'Build queued #' + id + ' — Composer applies code. Say: coders poll ' + id;
    }
    return text;
  },

  wantsComposer(m) {
    return this.fallbackPrefs.force === 'composer'
      || /^use\s+composer|queue\s+composer|summon\s+composer|back\s+to\s+composer/i.test(String(m || ''));
  },

  async queueCoder(task, engine) {
    if (!Auth?.user) return { error: 'sign in with G for build queue' };
    const eng = engine || (this.wantsComposer(task) ? 'composer' : 'grok');
    const q = await AciCli.api({
      mode: 'coders',
      task: task,
      coder_engine: eng,
      history: this.history.slice(-6),
      fallback_prefs: this.fallbackPrefs,
    });
    if (q.error && AciCli) AciCli.print('coders error: ' + q.error, 'err');
    if (q.summon_id) {
      this.lastSummonId = q.summon_id;
      if (q.composer_queued) this.startPoll(q.composer_queued);
    }
    return q;
  },

  async chat(message, opts = {}) {
    const m = String((window.fixVoiceHotwords || (x => x))(String(message || ''))).trim();
    if (m.length < 1) return this.enterSession({ fromVoice: !!opts.fromVoice });

    const localFix = this.tryLocalFix(m);
    if (localFix) {
      AciCli?.print(localFix, 'ok');
      ACIControl?.reply(localFix.slice(0, 260));
      if (Auth?.user && this.isBuildTask(m)) {
        const q = await this.queueCoder(m, 'grok').catch(() => ({}));
        if (q.summon_id) AciCli?.print('Also queued #' + q.summon_id + ' for Composer', 'dim');
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

      const grokPrefs = { ...this.fallbackPrefs, force: this.fallbackPrefs.force || 'xai' };
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
          fallback_prefs: { ...this.fallbackPrefs, force: 'groq' },
          history: this.history.slice(-4),
        }, { timeoutMs: 22000 });
        const fbText = String(fb.text || fb.response || '').trim();
        if (fbText && !this.isFailedReply(fbText)) {
          GlobeDeck?.setThinking(false);
          return this._applyResponse({ ...fb, text: fbText, team: true }, m);
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
        const q = await this.queueCoder(m, this.wantsComposer(m) ? 'composer' : 'grok');
        if (q.summon_id) {
          r.summon_id = q.summon_id;
          r.composer_queued = q.composer_queued;
          if (!r.text && q.text) { r.text = q.text; r.response = q.text; }
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


// === MISSION SUPPORT REPORTER — daily problems + progression → support digest ===
const MissionSupportReporter = {
  LS_DAY: 'astranov:support-digest-day',
  LS_PROBLEMS: 'astranov:support-problems',
  LS_WINS: 'astranov:support-wins',
  CHECK_MS: 60 * 60 * 1000,
  _bootAt: Date.now(),
  _timer: null,
  _submitting: false,

  utcDay() {
    return new Date().toISOString().slice(0, 10);
  },

  buildStamp() {
    return document.querySelector('meta[name="astranov-build"]')?.content || '';
  },

  _load(key) {
    try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { return []; }
  },

  _save(key, arr) {
    try { localStorage.setItem(key, JSON.stringify(arr.slice(-80))); } catch (_) {}
  },

  recordProblem(type, message, context) {
    const row = { type: String(type || 'problem'), message: String(message || '').slice(0, 400), ts: Date.now(), context: context || {} };
    const buf = this._load(this.LS_PROBLEMS);
    buf.push(row);
    this._save(this.LS_PROBLEMS, buf);
    if (buf.length >= 3) this._maybeSubmit('problem_threshold');
  },

  recordProgress(subsystem, detail, props) {
    const s = String(subsystem || 'field');
    if (!/order|commerce|route|delivery|vendor|driver|globe|city|mission|claim|evolve|crawler|channel|chat|coders|think|voice|grok|xai|brain/i.test(s + ' ' + (detail || ''))) return;
    const row = { subsystem: s, detail: String(detail || '').slice(0, 200), ts: Date.now(), props: props || {} };
    const buf = this._load(this.LS_WINS);
    buf.push(row);
    this._save(this.LS_WINS, buf);
  },

  collectStats() {
    const missions = MarketplaceDeliveryEngine?.missions || [];
    const active = missions.filter(m => MarketplaceDeliveryEngine?.STATUS?.[m.status]?.active).length;
    return {
      build: this.buildStamp(),
      globe_tier: ZoomTiers?.current || CosmicZoom?.level || 'earth',
      active_missions: active,
      total_missions: missions.length,
      session_minutes: Math.round((Date.now() - this._bootAt) / 60000),
      coders_events: AciCoders?._activityCount || 0,
      user_logged_in: !!Auth?.user,
      host: location.hostname || '',
    };
  },

  async submitDaily(trigger) {
    if (this._submitting) return;
    const today = this.utcDay();
    let lastDay = '';
    try { lastDay = localStorage.getItem(this.LS_DAY) || ''; } catch (_) {}
    if (lastDay === today && trigger !== 'force') return;

    this._submitting = true;
    const problems = this._load(this.LS_PROBLEMS);
    const progression = this._load(this.LS_WINS);
    const stats = this.collectStats();
    const fnUrl = (typeof resolveAstranovFunctionsUrl === 'function' ? resolveAstranovFunctionsUrl() : SB_URL + '/functions/v1') + '/support-digest';
    const key = ACI?.key || '';
    const sessionId = window._sessionId || AiRouter?._sessionId || 'web';

    try {
      const r = await fetch(fnUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key },
        body: JSON.stringify({
          action: 'client_report',
          digest_date: today,
          session_id: sessionId,
          build: stats.build,
          problems,
          progression,
          stats,
          trigger: trigger || 'daily',
          force_daily: true,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (j.ok) {
        try { localStorage.setItem(this.LS_DAY, today); } catch (_) {}
        this._save(this.LS_PROBLEMS, []);
        this._save(this.LS_WINS, []);
        if (j.notified) GlobeDeck?.log?.('Support digest sent · Astranov + xAI · ' + today, 'dim');
        else if (!j.skipped) GlobeDeck?.log?.('Support digest stored · Astranov + xAI · ' + today, 'dim');
      }
    } catch (_) { /* retry next hour */ }
    finally { this._submitting = false; }
  },

  _maybeSubmit(reason) {
    const today = this.utcDay();
    let lastDay = '';
    try { lastDay = localStorage.getItem(this.LS_DAY) || ''; } catch (_) {}
    if (lastDay !== today) void this.submitDaily(reason);
  },

  reportBootRegression(checks) {
    const fails = (checks || []).filter(c => !c.ok);
    if (!fails.length) return;
    this.recordProblem('grok_build_regression', fails.map(f => f.id).join(', '), {
      build: this.buildStamp(),
      fails,
      trackball: !!TrackballGuard?._ok,
      cam_z: typeof camera !== 'undefined' ? camera?.position?.z : null,
    });
    void this.submitDaily('force');
  },

  init() {
    setTimeout(() => this._maybeSubmit('boot'), 8000);
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => this._maybeSubmit('hourly'), this.CHECK_MS);
    this.recordProgress('mission', 'SpaceNet boot · build ' + this.buildStamp(), { subsystems: ['GlobeNavigate', 'MarketplaceDeliveryEngine', 'FieldWork', 'BrainNeurons', 'SpaceNetScenarioRunner', 'SpaceNetGeo', 'SpaceNetCycle', 'ClassifiedTriangles'] });
  },
};
window.MissionSupportReporter = MissionSupportReporter;

const ACI = {
  name: 'Astranov Collective Intelligence',
  url: SB_URL,
  key: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI',
  neurons: [],
  history: [],
  thinkMode: '',
  evolving: false,
  heartbeat: null,
  lastPulse: 0,

  async headers() {
    if (window.Auth?.authHeaders) return Auth.authHeaders();
    return { 'Content-Type': 'application/json', apikey: this.key, Authorization: 'Bearer ' + this.key };
  },

  api(body) {
    return this.headers().then(h => fetchJson(this.url + '/functions/v1/aci', {
      method: 'POST', headers: h, body: JSON.stringify(body || {})
    }, 55000));
  },

  _logQueue: [],
  _logTimer: null,
  feed(action, detail) {
    this._logQueue.push({ action, detail: detail || '', ts: Date.now() });
    if (!this._logTimer) {
      this._logTimer = setTimeout(() => {
        const batch = this._logQueue.splice(0, 8);
        this._logTimer = null;
        if (batch.length) this.api({ mode: 'log', action: 'batch', detail: batch.map(b => b.action + ':' + b.detail).join('; ').slice(0, 600) });
      }, 30000);
    }
  },

  spawnNeuron(lat, lng, strength, principle) {
    const pos = latLngToPos(lat, lng, 1.035);
    const n = new THREE.Mesh(
      new THREE.SphereGeometry(0.018, 6, 6),
      new THREE.MeshBasicMaterial({ color: 0x66ff99, transparent: true, opacity: 0.85 })
    );
    n.position.set(pos.x, pos.y, pos.z);
    n.userData = { strength: strength || 1, id: 'neuron-' + Date.now() + Math.random(), principle: principle || '' };
    earth.add(n);
    this.neurons.push(n);
    if (window.AIGraphics) AIGraphics.spawnEffect(n.position, 0x00ffaa, 10, 20);
    return n;
  },

  syncNeuronsFromPrinciples(principles) {
    if (!Array.isArray(principles) || !principles.length) return;
    const seeds = [
      { lat: 36.22, lng: 28.12 }, { lat: 40, lng: 20 }, { lat: -15, lng: 45 },
      { lat: 55, lng: -30 }, { lat: 10, lng: -75 }, { lat: -35, lng: 140 }
    ];
    principles.slice(0, seeds.length).forEach((p, i) => {
      const s = seeds[i];
      const str = typeof p === 'string' ? 1.2 : (p.strength || p.importance || 1.2);
      const text = typeof p === 'string' ? p : (p.content || '');
      this.spawnNeuron(s.lat, s.lng, str, text);
    });
  },

  async think(prompt, opts = {}) {
    if (window._aciAbort) { try { window._aciAbort.abort(); } catch (_) {} }
    window._aciAbort = new AbortController();
    const fast = opts.fast !== false;
    if (!opts._wrapped) {
      GlobeDeck?.setMapStatus('ACI — thinking…');
      GlobeDeck?.setThinking(true, '◎ 3D think…');
    }
    const h = await this.headers();
    let r;
    try {
      r = await fetchJson(this.url + '/functions/v1/aci', {
        method: 'POST', headers: h,
        body: JSON.stringify({
          mode: 'think', prompt, fast: true,
          history: this.history.slice(-4),
          aci_mode: this.thinkMode || undefined,
        }),
      }, Responsive3D?.FAST_MS || 8000);
    } catch (e) {
      r = { error: String(e.message || e) };
    }
    GlobeDeck?.setThinking(false);
    if (r.aborted) return '';
    if (r.error) {
      const err = 'ACI error: ' + r.error + (r._httpStatus === 401 ? ' — tap G to sign in' : '');
      GlobeDeck?.showError(err);
      return err;
    }
    const raw = (r.text || r.response || '').trim() || 'Το Astranov συγκεντρώνεται — δοκίμασε ξανά.';
    const text = ArcangeloDialect?.repairTranscript?.(raw) || raw;
    this.history.push({ role: 'user', content: prompt });
    this.history.push({ role: 'assistant', content: text });
    if (this.history.length > 20) this.history = this.history.slice(-20);
    this.feed('think', prompt.slice(0, 80));
    BrainNeurons?.recordActivity?.('think', prompt.slice(0, 120));
    this.pulse(1.4);
    GlobeDeck?.say(text, 'reply');
    return text;
  },

  async teach(content) {
    const tLat = 36.2 + (Math.random() - 0.5) * 4;
    const tLng = 28.1 + (Math.random() - 0.5) * 4;
    MapDepict.action('teach', { lat: tLat, lng: tLng, detail: content.slice(0, 50) });
    await this.api({ mode: 'teach', content });
    this.feed('teach', content.slice(0, 120));
    BrainNeurons?._ingest?.([{ content, strength: 1.5 }], 'taught');
    this.spawnNeuron(tLat, tLng, 1.4, content);
    return true;
  },

  async evolve(reason) {
    if (this.evolving) return null;
    this.evolving = true;
    MapDepict.action('evolve', { detail: reason || 'collective' });
    try {
      const r = await this.api({ mode: 'evolve', activity: reason || 'user-triggered' });
      const births = Math.max(1, Math.min(4, Number(r.brain && r.brain.new_neurons) || 1));
      for (let i = 0; i < births; i++) {
        this.spawnNeuron((Math.random() - 0.5) * 80, (Math.random() - 0.5) * 160, 1.1 + Math.random() * 0.4);
      }
      if (r.principles && r.principles.length) {
        this.syncNeuronsFromPrinciples(r.principles);
        BrainNeurons?._ingest?.(r.principles, 'evolve');
      }
      if (window.AIGraphics) AIGraphics.spawnEffect(new THREE.Vector3(0, 1.2, 0), 0x00ff88, 35, 45);
      const avg = this.neurons.length ? this.neurons.reduce((s, n) => s + (n.userData.strength || 1), 0) / this.neurons.length : 1;
      idleRoll = 0;
      this.pulse(2.0);
      console.log('%c[ACI FINAL] evolved', 'color:#00ff88', r);
      return r;
    } finally { this.evolving = false; }
  },

  async init() {
    console.log('%c[ACI] ready — neurons growing with every user', 'color:#00ddff');
    this.attachHeartbeat();
  },

  attachHeartbeat() {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.09, 0.008, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xaa66ff, transparent: true, opacity: 0.75 })
    );
    ring.position.set(0.75, -0.55, -1.2);
    camera.add(ring);
    this.heartbeat = ring;
  },

  pulse(scale) {
    this.lastPulse = Date.now();
    if (this.heartbeat) this.heartbeat.scale.set(scale, scale, scale);
  },

  tick() {
    if (!this.heartbeat) return;
    const t = Date.now() / 500;
    const base = 0.85 + Math.sin(t) * 0.12;
    const boost = (Date.now() - this.lastPulse < 2000) ? 0.25 : 0;
    this.heartbeat.scale.set(base + boost, base + boost, base + boost);
    this.heartbeat.material.opacity = 0.55 + Math.sin(t * 1.3) * 0.2 + boost;
  }
};
window.AstranovCollectiveIntelligence = ACI;

const SB_KEY = ACI.key;
const sbHeaders = () => ({ apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY, 'Content-Type': 'application/json' });


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
    client_addr: { color: 0x44ff88, icon: '📦', label: 'Deliver here' },
    driver_base: { color: 0xffaa44, icon: '🚚', label: 'Driver base' },
    place: { color: 0x1a6fd4, icon: '◎', label: 'Place' },
    unit: { color: 0xffaa33, icon: '⚔', label: 'Unit' },
    drone: { color: 0x44ccff, icon: '🛸', label: 'Drone' },
    spy: { color: 0xaa44ff, icon: '🕵', label: 'Spy' },
    pyramid: { color: 0xffdd44, icon: '🔺', label: 'Pyramid' },
    cluster: { color: 0x3d9eff, icon: '☁', label: 'Cloud' },
    yacht: { color: 0x69f5d0, icon: '⛵', label: 'Yacht' },
    work: { color: 0xffcc44, icon: '🔧', label: 'Work' },
    neuron: { color: 0x66ff99, icon: '🧠', label: 'Neuron' },
  },

  CLUSTER_TYPES: new Set(['post', 'place', 'media', 'news']),
  CLUSTER_MIN: 2,

  init() {
    this._labelRoot = document.getElementById('globe-entity-labels');
    this._hud = document.getElementById('globe-entity-hud');
    document.getElementById('ge-hud-close')?.addEventListener('click', () => MapPlaceMenu?.close?.() || this.clearSelection());
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
    const z = camera?.position?.z ?? GlobeNavigate.GLOBAL_Z;
    return z >= ((GlobeControl?.Z?.global || GlobeNavigate.GLOBAL_Z) - 0.12);
  },

  cellKey(lat, lng) {
    const z = camera?.position?.z ?? GlobeNavigate.GLOBAL_Z;
    const deg = z >= 3.5 ? 3.5 : z >= GlobeNavigate.GLOBAL_Z ? 2.0 : z >= 1.82 ? 0.8 : 0.35;
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
    const photoUrl = opts.photoUrl || opts.logoUrl || entity.data?.photoUrl || entity.data?.logoUrl || '';
    const pin = entity.data?.travelTo
      ? ('<div class="ge-travel-arrow" style="transform:rotate(' + (entity.data.travelBearing || 0) + 'deg)">➤</div>')
      : photoUrl
      ? ('<div class="ge-pin ge-pin-photo" style="background-image:url(' + this.esc(photoUrl) + ')"></div>')
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
    const business = ['vendor', 'driver', 'friend', 'order', 'pilot', 'me'].includes(entity.type);
    if (business) {
      const behind = this._project(world).behind;
      const show = !behind && (dot > 0.42 || z < 2.4);
      const flash = u >= 3 && dot > 0.35;
      const glow = u >= 2 || (entity.type === 'vendor' && z < 2.8);
      return { show, flash, glow, dot, zoomNear, world };
    }
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
    MapPlaceMenu?.openAt?.(entity.lat, entity.lng, {
      source: this.TYPES[entity.type]?.label || entity.type,
      label: (entity.icon || '') + ' ' + entity.title,
      hint: entity.description || 'Choose an action',
      entity,
    });
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
    this.select(entity);
  },

  _defaultTap(entity) {
    const fp = latLngToPos(entity.lat, entity.lng, 1.04);
    const z = entity.type === 'vendor' ? (GlobeControl?.Z?.regional || 1.65) : (GlobeControl?.Z?.national || 1.82);
    flyToPoint?.(new THREE.Vector3(fp.x, fp.y, fp.z), z);
    GlobeControl?.noteAutoFly?.();

    switch (entity.type) {
      case 'vendor':
        if (entity.data?.vendor) VendorMapTile?.open?.(entity.data.vendor);
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
        if (entity.data?.url) {
          const yt = GlobeVideo?.parseId?.(entity.data.url);
          if (yt) MapComms?.showCloudVideo?.(yt, entity.title);
          GlobeVideo?.play?.(entity.data.url, { title: entity.title }, entity.title);
        } else {
          ACIControl?.reply(entity.description || entity.title);
        }
        break;
      case 'me':
        this.flyTo(entity, GlobeControl?.Z?.global || GlobeNavigate.GLOBAL_Z);
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
      const forceShow = !!entity.data?.alwaysShowLabel || (entity.type === 'me' && entity.data?.alwaysShow);
      if (entity.mesh && ['vendor', 'driver', 'friend', 'order', 'pilot', 'me'].includes(entity.type)) {
        entity.mesh.visible = true;
        const z = camera?.position?.z ?? 2.5;
        const scale = entity.type === 'vendor' ? (z > 2 ? 1.8 : 1.2) : (z > 2 ? 1.4 : 1);
        entity.mesh.scale.set(scale, scale, scale);
      }
      const el = entity._labelEl;
      if (el) {
        if (prox.show || forceShow) {
          const scr = this._project(prox.world);
          el.style.display = 'flex';
          el.style.left = scr.x + 'px';
          el.style.top = (scr.y - 8) + 'px';
          el.classList.toggle('ge-flash', prox.flash);
          el.classList.toggle('ge-glow', prox.glow);
          el.classList.toggle('ge-selected', this._selected === id);
          if (!entity._revealed) this._scavengeView(entity, 'proximity');
        } else {
          el.style.display = 'none';
          el.classList.remove('ge-flash', 'ge-glow', 'ge-selected');
        }
      }

      if (entity.ring) {
        const pulse = prox.glow ? 0.45 + Math.sin(now / 280) * 0.25 : 0.2;
        entity.ring.material.opacity = prox.flash ? 0.65 + Math.sin(now / 180) * 0.35 : pulse;
        entity.ring.visible = prox.show || entity.urgency >= 2;
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
      const logoUrl = MapPins?.vendorLogo?.(v) || '';
      const isConstruction = window.AstranovCityShop?.isConstructionVendor?.(v);
      const city = isConstruction ? (window.AstranovCityShop?._tags?.(v)?.city || 'city center') : '';
      this.register({
        id: 'vendor-' + v.id,
        type: 'vendor',
        lat: v.lat,
        lng: v.lng,
        title: isConstruction ? 'Astranov Shop · Under Construction' : v.name,
        description: isConstruction
          ? '🚧 Under Construction · ' + city + ' center · Astranov marketplace opening soon · tap to preview'
          : (menu ? menu + ' items · menu w/ photos' : 'menu on request') + (km != null ? ' · ' + km.toFixed(1) + ' km' : '') + ' · tap to order',
        urgency: isConstruction ? 4 : (i === 0 ? 3 : 2),
        radius: isConstruction ? 0.034 : 0.022,
        logoUrl: logoUrl || (isConstruction ? '/icon.svg' : ''),
        data: { vendor: v, logoUrl: logoUrl || (isConstruction ? '/icon.svg' : ''), alwaysShowLabel: isConstruction || i < 8 },
        _actionLabel: isConstruction ? 'Astranov Shop · Under Construction' : 'Open ' + v.name,
        onTap: () => window.Commerce?.openVendor?.(v),
      });
    });
  },

  syncMapPins() {
    this.unregisterType('client_addr');
    this.unregisterType('driver_base');
    const cd = window._clientDelivery;
    if (cd?.lat != null) {
      const clientPhoto = MapPins?.clientPinPhoto?.(cd) || '';
      this.register({
        id: 'pin-client-delivery',
        type: 'client_addr',
        lat: cd.lat,
        lng: cd.lng,
        title: cd.label || 'Delivery address',
        description: 'Client delivery · orders arrive here · tap to route',
        urgency: 3,
        persist: true,
        photoUrl: clientPhoto,
        data: { alwaysShowLabel: true, photoUrl: clientPhoto },
        onTap: () => {
          DrivingView?.setRoutePlan?.({ from: window._driverBase || window._lastPos, to: cd });
          DrivingView?.setDestination?.(cd.lat, cd.lng);
          DrivingView?.fetchRoadRoute?.();
        },
      });
    }
    const db = window._driverBase;
    if (db?.lat != null) {
      const basePhoto = MapPins?.driverBasePhoto?.(db) || '';
      this.register({
        id: 'pin-driver-base',
        type: 'driver_base',
        lat: db.lat,
        lng: db.lng,
        title: db.label || 'Driver base',
        description: 'Driver start · routes begin here',
        urgency: 2,
        persist: true,
        photoUrl: basePhoto,
        data: { alwaysShowLabel: true, photoUrl: basePhoto },
        onTap: () => {
          placeMe(db.lat, db.lng, { fly: true, zoom: GlobeControl?.Z?.national || 1.82, quiet: true });
        },
      });
    }
  },

  syncDrivers(drivers) {
    this.unregisterType('driver');
    (drivers || []).forEach((d, i) => {
      if (d.field_lat == null) return;
      const km = window.Commerce?.haversineKm?.(window.Commerce.userLatLng().lat, window.Commerce.userLatLng().lng, d.field_lat, d.field_lng);
      const driverPhoto = MapPins?.driverPhotoUrl?.(d) || '';
      this.register({
        id: 'driver-' + d.id,
        type: 'driver',
        lat: d.field_lat,
        lng: d.field_lng,
        title: d.display_name || 'Driver',
        description: 'Available · ' + (km != null ? km.toFixed(1) + ' km' : 'nearby') + ' · tap to assign',
        urgency: 2,
        photoUrl: driverPhoto,
        data: { driver: d, photoUrl: driverPhoto },
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
    const mePhoto = opts.photoUrl || MapPins?.authAvatarUrl?.() || '';
    this.register({
      id: 'me',
      type: 'me',
      lat,
      lng,
      title: opts.travelTo ? ('→ ' + opts.travelTo) : (name || 'You'),
      description: desc,
      urgency: opts.travelTo ? 3 : 2,
      persist: true,
      photoUrl: mePhoto,
      data: {
        alwaysShowLabel: !!opts.alwaysShow,
        travelBearing: opts.bearing,
        travelTo: opts.travelTo,
        photoUrl: mePhoto,
      },
      _actionLabel: 'Zoom to me',
      onTap: (e) => {
        const flyHere = (lat, lng) => {
          if (lat == null) { this.flyTo(e, GlobeControl?.Z?.global || GlobeNavigate.GLOBAL_Z); return; }
          placeMe(lat, lng, { fly: true, zoom: GlobeControl?.Z?.global || GlobeNavigate.GLOBAL_Z, quiet: false });
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


// === CITY MAP — satellite + streets when zoomed to city level ===
const CityMap = {
  NATIONAL_ENTER_Z: 1.92,
  NATIONAL_EXIT_Z: 1.44,
  ENTER_Z: 1.40,
  EXIT_Z: 1.50,
  active: false,
  _nationalActive: false,
  map: null,
  _ready: false,
  _center: { lat: 36.44, lng: 28.22 },
  _layers: {},
  _onMap: new Set(),
  _markers: {},
  _route: null,
  _driverTimer: null,
  _syncTimer: null,
  _demoDrivers: [],
  _demoPhase: 0,
  _forceOpen: false,
  _initAttempts: 0,
  _blend: 0,
  _mapStyle: 'satellite',
  STYLE_KEY: 'astranov_map_style_v1',
  _stackIdx: 0,
  _tileStats: { ok: 0, err: 0, lastOk: 0 },
  _healthTimer: null,
  _lastEscalate: 0,
  _leafletLoading: null,

  _globeZ() {
    return ZoomTiers?.tierZ?.('global') ?? GlobeControl?.Z?.global ?? GlobeNavigate.GLOBAL_Z;
  },

  _nationalZ() {
    return ZoomTiers?.tierZ?.('national') ?? GlobeControl?.Z?.national ?? 1.82;
  },

  _setGlobeSurfaceVisible(show) {
    if (window.earth) window.earth.visible = !!show;
    const g = window.AIGraphics;
    if (!g) return;
    ['atmosphere', 'clouds', 'cityLights', 'neuralLayer', 'idleNodes'].forEach((k) => {
      if (g[k]) g[k].visible = !!show;
    });
  },

  _applyGlobeMapCrossfade(camZ) {
    if (this.active) {
      document.documentElement.style.setProperty('--globe-opacity', '0');
      document.documentElement.style.setProperty('--map-opacity', '1');
      this._setGlobeSurfaceVisible(false);
      return;
    }
    const z0 = this._globeZ();
    const z1 = this._nationalZ();
    let t = 0;
    if (camZ <= z1) t = 1;
    else if (camZ < z0) t = 1 - (camZ - z1) / (z0 - z1);
    t = Math.max(0, Math.min(1, Math.pow(t, 0.65)));
    this._blend = t;
    document.documentElement.style.setProperty('--globe-opacity', String(1 - t));
    document.documentElement.style.setProperty('--map-opacity', String(t));
    this._setGlobeSurfaceVisible(t < 0.92);
    const mapEl = document.getElementById('city-map');
    if (mapEl && t > 0.04 && !this.active) {
      if (!mapEl.classList.contains('national-active')) mapEl.classList.add('national-active');
      if (this.map) {
        const c = this.mapViewCenter();
        this._center = c;
        const lz = this.nationalLeafletZoom(camZ);
        if (this.map.getZoom() !== lz) this.map.setZoom(lz, { animate: false });
        const cur = this.map.getCenter();
        if (Math.abs(cur.lat - c.lat) > 0.03 || Math.abs(cur.lng - c.lng) > 0.03) {
          this.map.panTo([c.lat, c.lng], { animate: false });
        }
        this._applyBaseLayers();
        this.syncMapPins();
        this._invalidate();
      }
    } else if (mapEl && !this._nationalActive && t <= 0.04) {
      mapEl.classList.remove('national-active');
      mapEl.style.removeProperty('opacity');
    }
    this._updateStyleSwitchVisible();
  },

  async _loadLeaflet() {
    if (window.L) return true;
    if (this._leafletLoading) return this._leafletLoading;
    this._leafletLoading = (async () => {
      const sources = [
        { css: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', js: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js' },
        { css: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css', js: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js' },
        { css: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css', js: 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js' },
      ];
      for (const src of sources) {
        const ok = await this._injectLeaflet(src.css, src.js);
        if (ok) return true;
      }
      return false;
    })();
    try {
      return await this._leafletLoading;
    } finally {
      this._leafletLoading = null;
    }
  },

  _injectLeaflet(cssUrl, jsUrl) {
    return new Promise(resolve => {
      if (window.L) return resolve(true);
      if (!document.querySelector('link[href*="leaflet"]')) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = cssUrl;
        link.crossOrigin = '';
        document.head.appendChild(link);
      }
      const existing = document.querySelector('script[src*="leaflet"]');
      if (existing) {
        const done = () => resolve(!!window.L);
        if (window.L) return done();
        existing.addEventListener('load', done, { once: true });
        existing.addEventListener('error', () => resolve(false), { once: true });
        setTimeout(() => resolve(!!window.L), 4500);
        return;
      }
      const script = document.createElement('script');
      script.src = jsUrl;
      script.crossOrigin = '';
      script.onload = () => resolve(!!window.L);
      script.onerror = () => resolve(false);
      document.head.appendChild(script);
    });
  },

  async ensureReady() {
    if (this._ready && this.map) return true;
    const deadline = Date.now() + 14000;
    while (Date.now() < deadline) {
      if (!window.L) await this._loadLeaflet();
      if (!this._ready && this._initAttempts < 8) {
        this._initAttempts++;
        this.init();
      }
      if (this._ready && this.map) return true;
      await new Promise(r => setTimeout(r, 350));
    }
    return !!(this._ready && this.map);
  },

  init() {
    if (!window.L) {
      console.warn('[CityMap] Leaflet not loaded');
      return;
    }
    if (this._ready && this.map) return;
    let el = document.getElementById('city-map');
    if (!el) {
      el = document.createElement('div');
      el.id = 'city-map';
      document.body.appendChild(el);
    }
    this.map = L.map(el, {
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      touchZoom: false,
      boxZoom: false,
    });
    this._buildLayers();
    AstranovTheme?.registerMap?.(this);
    this.map.setView([this._center.lat, this._center.lng], 14);
    this.map.on('zoomend moveend', () => {
      if (!this.active) return;
      const c = this.map.getCenter();
      this._center = { lat: c.lat, lng: c.lng };
    });
    this.map.on('click', (e) => {
      if (!this.active && !this._nationalActive) return;
      const dom = e.originalEvent;
      if (MapOverlayDismiss.handleMapClick(dom || { target: document.getElementById('city-map') })) return;
      if (this._nationalActive && !this.active) {
        void GlobeNavigate?.handlePlaceClick?.(e.latlng.lat, e.latlng.lng, {});
      } else {
        MapPlaceMenu?.openAt?.(e.latlng.lat, e.latlng.lng, { source: 'City map', hint: '3 smart picks only', limited: true });
      }
    });
    window.addEventListener('resize', () => {
      if (this.active) this._invalidate();
    });
    this._bindZoomBridge(el);
    this._bindStyleSwitch();
    this._loadMapStyle();
    this._ready = true;
    const driverMs = SlumberManager?.tickMs?.('cityDriver') || 4500;
    this._driverTimer = setInterval(() => this._tickDrivers(), driverMs);
    this._syncTimer = setInterval(() => { if (this.active) this._syncMarkers(); }, 2000);
  },

  _invalidate() {
    if (!this.map) return;
    try {
      this.map.invalidateSize({ animate: false });
    } catch (_) {}
  },

  _mapIsVisible() {
    return !!(this.active || this._nationalActive || (this._blend || 0) > 0.06);
  },

  _onTileOk() {
    this._tileStats.ok++;
    this._tileStats.lastOk = Date.now();
  },

  _onTileErr(layerKey) {
    this._tileStats.err++;
    if (this._mapIsVisible()) this._maybeEscalateLayers('tileerror:' + (layerKey || '?'));
  },

  _wrapTileLayer(layer, key) {
    if (!layer) return layer;
    layer.on('tileload', () => this._onTileOk());
    layer.on('tileerror', () => this._onTileErr(key));
    return layer;
  },

  _getLayerStacks() {
    const Lyr = this._layers;
    if (!Lyr?.sat) return [];
    return [
      { id: 'sat_hd', label: 'Satellite HD', layers: [
        { layer: Lyr.sat, opacity: 1 },
        { layer: Lyr.streetLabels, opacity: 1 },
        { layer: Lyr.placeLabels, opacity: 0.92 },
      ]},
      { id: 'sat_streets', label: 'Satellite + streets', layers: [
        { layer: Lyr.sat, opacity: 1 },
        { layer: Lyr.voyager, opacity: 0.44 },
      ]},
      { id: 'osm_labels', label: 'OSM + labels', layers: [
        { layer: Lyr.satFallback, opacity: 1 },
        { layer: Lyr.streetLabels, opacity: 0.86 },
      ]},
      { id: 'voyager', label: 'Street map', layers: [
        { layer: Lyr.voyager, opacity: 1 },
      ]},
      { id: 'osm', label: 'OpenStreetMap', layers: [
        { layer: Lyr.satFallback, opacity: 1 },
      ]},
      { id: 'osm_alt', label: 'OSM mirror', layers: [
        { layer: Lyr.osmAlt, opacity: 1 },
      ]},
      { id: 'dark', label: 'Dark streets', layers: [
        { layer: Lyr.darkStreets, opacity: 1 },
      ]},
    ];
  },

  _baseStackForStyle(style) {
    if (style === 'bright') return 3;
    if (style === 'dark') return 6;
    return 0;
  },

  _preferredStackIdx() {
    return this._baseStackForStyle(this.getMapStyle?.() || 'satellite');
  },

  _recoverPreferredStack() {
    const pref = this._preferredStackIdx();
    if (this._stackIdx <= pref || !this._tileStats?.ok || this._tileStats.ok < 6) return false;
    this._applyLayerStack(pref);
    this._tileStats = { ok: 0, err: 0, lastOk: Date.now() };
    AciCli?.print?.('map · restored HD tiles', 'ok');
    return true;
  },

  _applyLayerStack(idx) {
    if (!this.map) return false;
    const stacks = this._getLayerStacks();
    if (!stacks.length) return false;
    idx = Math.max(0, Math.min(stacks.length - 1, idx));
    this._stackIdx = idx;
    const stack = stacks[idx];
    this._onMap.forEach(l => { try { this.map.removeLayer(l); } catch (_) {} });
    this._onMap.clear();
    stack.layers.forEach(entry => {
      const layer = entry.layer;
      if (!layer) return;
      const op = entry.opacity != null ? entry.opacity : 1;
      if (layer.setOpacity) layer.setOpacity(op);
      layer.addTo(this.map);
      this._onMap.add(layer);
    });
    const el = document.getElementById('city-map');
    if (el) el.dataset.layerStack = stack.id;
    this._syncStyleUi();
    this._updateStyleSwitchVisible();
    if (this._mapIsVisible()) this._invalidate();
    return true;
  },

  _maybeEscalateLayers(reason) {
    const stacks = this._getLayerStacks();
    if (!stacks.length || this._stackIdx >= stacks.length - 1) return false;
    const now = Date.now();
    if (now - (this._lastEscalate || 0) < 1600) return false;
    this._lastEscalate = now;
    const next = this._stackIdx + 1;
    console.warn('[CityMap] fallback layer →', stacks[next].id, reason || '');
    this._applyLayerStack(next);
    this._tileStats = { ok: 0, err: 0, lastOk: this._tileStats.lastOk || 0 };
    AciCli?.print?.('map · fallback · ' + stacks[next].label, 'warn');
    GlobeDeck?.setPreview?.('Map · ' + stacks[next].label);
    return true;
  },

  _startHealthWatch() {
    this._stopHealthWatch();
    this._tileStats = { ok: 0, err: 0, lastOk: 0 };
    let checks = 0;
    this._healthTimer = setInterval(() => {
      if (!this._mapIsVisible()) {
        this._stopHealthWatch();
        return;
      }
      checks++;
      const stale = !this._tileStats.lastOk && checks >= 2;
      const staleLong = this._tileStats.lastOk && Date.now() - this._tileStats.lastOk > 6000;
      const noTiles = checks >= 2 && this._tileStats.ok === 0 && this._tileStats.err >= 2;
      const errHeavy = this._tileStats.err >= 5 && this._tileStats.err > this._tileStats.ok * 1.5;
      if (noTiles || errHeavy || stale || staleLong) {
        if (!this._maybeEscalateLayers('health')) this._stopHealthWatch();
        checks = 0;
      }
      if (this._tileStats.ok >= 10 && this._stackIdx > this._preferredStackIdx()) {
        this._recoverPreferredStack();
      }
      if (checks > 10) this._stopHealthWatch();
    }, 2800);
  },

  _stopHealthWatch() {
    if (this._healthTimer) {
      clearInterval(this._healthTimer);
      this._healthTimer = null;
    }
  },

  _loadMapStyle() {
    try {
      const s = localStorage.getItem(this.STYLE_KEY);
      if (s === 'satellite' || s === 'bright' || s === 'dark') this._mapStyle = s;
    } catch (_) {}
    return this._mapStyle;
  },

  getMapStyle() {
    return this._mapStyle || 'satellite';
  },

  setMapStyle(style) {
    const s = style === 'bright' || style === 'dark' ? style : 'satellite';
    this._mapStyle = s;
    this._stackIdx = this._baseStackForStyle(s);
    try { localStorage.setItem(this.STYLE_KEY, s); } catch (_) {}
    this._applyBaseLayers();
    this._syncStyleUi();
    const labels = { satellite: 'Satellite', bright: 'Bright streets', dark: 'Dark streets' };
    GlobeDeck?.setPreview?.('Map · ' + (labels[s] || s));
    AciCli?.print?.('map style → ' + s, 'ok');
    return s;
  },

  cycleMapStyle() {
    const order = ['satellite', 'bright', 'dark'];
    const i = order.indexOf(this.getMapStyle());
    return this.setMapStyle(order[(i + 1) % order.length]);
  },

  _syncStyleUi() {},

  _updateStyleSwitchVisible() {},

  _bindStyleSwitch() {},

  _buildLayers() {
    const maxZ = Math.max(20, SlumberManager?.quality?.cityMaxZoom || 20);
    const sat = this._wrapTileLayer(L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: maxZ, attribution: 'Esri · satellite' }
    ), 'sat');
    const satFallback = this._wrapTileLayer(L.tileLayer(
      'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OSM fallback' }
    ), 'osm');
    const osmAlt = this._wrapTileLayer(L.tileLayer(
      'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      { maxZoom: 19, attribution: '© OSM mirror' }
    ), 'osm_alt');
    const streetLabels = this._wrapTileLayer(L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, opacity: 1, attribution: '© CARTO © OSM' }
    ), 'labels');
    const placeLabels = this._wrapTileLayer(L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 20, minZoom: 10, opacity: 0.92, attribution: 'Esri · places' }
    ), 'places');
    const voyager = this._wrapTileLayer(L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, attribution: '© CARTO © OSM · streets & blocks' }
    ), 'voyager');
    const darkStreets = this._wrapTileLayer(L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { maxZoom: 20, attribution: '© CARTO © OSM · dark' }
    ), 'dark');
    this._layers = { sat, satFallback, osmAlt, streetLabels, placeLabels, voyager, brightStreets: voyager, darkStreets, streets: voyager };
    this._loadMapStyle();
    this._stackIdx = this._baseStackForStyle(this.getMapStyle());
    this._applyBaseLayers();
  },

  _mapTheme() {
    return AstranovTheme?.effectiveMode?.() || AstranovTheme?.systemMode?.() || AstranovTheme?.mode || 'dark';
  },

  _applyBaseLayers() {
    if (!this.map || !this._layers?.sat) return;
    const uiTheme = this._mapTheme();
    const el = document.getElementById('city-map');
    let savedStyle = this.getMapStyle();
    if (!this.active && (this._nationalActive || (this._blend || 0) > 0.2) && savedStyle === 'satellite') {
      savedStyle = uiTheme === 'bright' ? 'bright' : 'dark';
    }
    const style = (this.active || this._nationalActive || (this._blend || 0) > 0.12) ? savedStyle : 'satellite';
    if (el) {
      el.dataset.theme = uiTheme;
      el.dataset.mapStyle = style;
    }
    const preferred = this._baseStackForStyle(style);
    if (this._stackIdx < preferred || !this._getLayerStacks()[this._stackIdx]) {
      this._stackIdx = preferred;
    }
    this._applyLayerStack(this._stackIdx);
  },

  onThemeChange() {
    const el = document.getElementById('city-map');
    if (el) el.dataset.theme = this._mapTheme();
    if (!this.active && (this._nationalActive || (this._blend || 0) > 0.12)) {
      const uiTheme = this._mapTheme();
      if (this.getMapStyle() === 'satellite') this.setMapStyle(uiTheme === 'bright' ? 'bright' : 'dark');
      else this._applyBaseLayers();
    }
  },

  camZToZoom(camZ) {
    if (camZ <= 1.06) return 18;
    if (camZ <= 1.12) return 17;
    if (camZ <= 1.22) return 16;
    if (camZ <= 1.32) return 15;
    const z = Math.max(1.02, Math.min(1.48, camZ));
    const t = (1.48 - z) / (1.48 - 1.02);
    return Math.round(11 + t * 4);
  },

  nationalLeafletZoom(camZ) {
    if (camZ >= 1.78) return 6;
    if (camZ >= 1.62) return 8;
    return 10;
  },

  _bindZoomBridge(el) {
    if (!el || el._cityZoomBridge) return;
    el._cityZoomBridge = true;
    let pinchDist = 0;
    let pinchLastT = 0;

    el.addEventListener('wheel', e => {
      if (!this.active && !this._nationalActive) return;
      e.preventDefault();
      e.stopPropagation();
      GlobeZoom.impuls(e.clientX, e.clientY, e.deltaY, e.deltaMode);
    }, { passive: false });

    el.addEventListener('touchstart', e => {
      if ((!this.active && !this._nationalActive) || e.touches.length !== 2) return;
      pinchLastT = performance.now();
      pinchDist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
    }, { passive: true });

    el.addEventListener('touchmove', e => {
      if ((!this.active && !this._nationalActive) || e.touches.length !== 2 || !pinchDist) return;
      e.preventDefault();
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const now = performance.now();
      const pdt = pinchLastT ? now - pinchLastT : 16;
      pinchLastT = now;
      const delta = pinchDist - d;
      pinchDist = d;
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      GlobeZoom.impuls(midX, midY, delta * 0.34, 0, pdt);
    }, { passive: false });

    el.addEventListener('touchend', () => { pinchDist = 0; pinchLastT = 0; });
  },

  globeCenterLatLng() {
    globePivot.updateMatrixWorld(true);
    const v = new THREE.Vector3(0, 0, 1);
    const inv = new THREE.Matrix4().copy(globePivot.matrixWorld).invert();
    v.applyMatrix4(inv);
    const r = Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z) || 1;
    const lat = 90 - Math.acos(Math.max(-1, Math.min(1, v.y / r))) * 180 / Math.PI;
    let lng = Math.atan2(v.z, -v.x) * 180 / Math.PI - 180;
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    return { lat, lng };
  },

  /** Map viewport — follows globe bearing, not stale GPS / delivery base */
  mapViewCenter(opts) {
    opts = opts || {};
    if (opts.lat != null && opts.lng != null) return { lat: opts.lat, lng: opts.lng };
    if (DrivingView?.active && window._lastPos?.lat != null) return window._lastPos;
    if (GlobeControl?.followMode === 'locate' && window._lastPos?.lat != null && !GlobeControl?.userExploring) {
      return window._lastPos;
    }
    return this.globeCenterLatLng();
  },

  flyTo(lat, lng, zoom) {
    this._center = { lat, lng };
    if (this.map) this.map.setView([lat, lng], zoom || 15, { animate: true });
  },

  /** Force-open city map at coordinates — bypasses camera threshold race conditions */
  async openAt(lat, lng, opts) {
    opts = opts || {};
    let ready = await this.ensureReady();
    if (!ready || !this.map) {
      this._initAttempts = 0;
      ready = await this.ensureReady();
    }
    if (!ready || !this.map) {
      GlobeDeck?.setMapStatus('City map failed — retrying fallback tiles…');
      AciCli?.print('city map init failed — trying OSM fallback', 'warn');
      return false;
    }
    const c = lat != null && lng != null
      ? { lat, lng }
      : (window._lastPos || this._center);
    if (!c?.lat) return false;

    this._center = c;
    window._lastPos = { lat: c.lat, lng: c.lng };
    userLocated = true;

    const camZ = opts.camZ ?? CityLife?.CITY_ZOOM ?? GlobeControl?.cityEntryZ?.() ?? 1.34;
    if (typeof camera !== 'undefined' && camera) {
      camera.position.z = camZ;
      camera.lookAt(0, 0, 0);
    }
    CosmicZoom?.update?.(camZ, { tier: 'city', label: 'CITY', cosmic: 'earth' });
    ZoomTiers?.goTo?.('city', false);
    cityLevel = true;

    this._forceOpen = true;
    const lz = opts.zoom ?? this.camZToZoom(camZ);
    if (!this.active) this._enter(camZ);
    else {
      this.map.setView([c.lat, c.lng], lz, { animate: false });
      this._invalidate();
      this._syncMarkers();
      this._syncRoute();
    }
    if (this.map.getZoom() !== lz) this.map.setZoom(lz, { animate: false });
    this.map.panTo([c.lat, c.lng], { animate: false });
    setTimeout(() => { this._forceOpen = false; }, 4000);
    setTimeout(() => this._invalidate(), 80);
    setTimeout(() => this._invalidate(), 400);
    this._startHealthWatch();
    setTimeout(() => {
      if (this._tileStats.ok === 0 && this._tileStats.err >= 1) this._maybeEscalateLayers('open');
    }, 3200);
    GlobeDeck?.setMapStatus('🏙 City map · ' + c.lat.toFixed(2) + ', ' + c.lng.toFixed(2));
    return true;
  },

  async enter(lat, lng, opts) {
    if (CityLife?.dropIn) return CityLife.dropIn(lat, lng, opts || {});
    const c = lat != null && lng != null ? { lat, lng } : this.mapViewCenter();
    if (!c?.lat) return { error: 'no location' };
    const z = GlobeControl?.cityEntryZ?.() ?? this.ENTER_Z - 0.06;
    const p = latLngToPos(c.lat, c.lng, 1.04);
    if (typeof flyToPoint === 'function') {
      flyToPoint(new THREE.Vector3(p.x, p.y, p.z), z);
      if (typeof waitForGlobeFly === 'function') await waitForGlobeFly();
    }
    this.onCamera(z, 'earth');
    return { lat: c.lat, lng: c.lng };
  },

  onCamera(camZ, level) {
    if (!this._ready) return;
    this._applyGlobeMapCrossfade(camZ);
    const earth = window._cityDropLock || this._forceOpen
      || (level || CosmicZoom?.level || 'earth') === 'earth';
    const driving = !!DrivingView?.active;
    const force = this._forceOpen || window._cityDropLock;
    const h = 0.07;

    if (force || driving) {
      if (!this.active) {
        if (this._nationalActive) this._exitNational();
        this._enter(camZ);
      } else {
        this._syncView(camZ);
      }
      return;
    }

    if (this.active) {
      if (camZ > this.EXIT_Z + h) {
        this._exit();
        if (camZ <= this.NATIONAL_ENTER_Z && camZ > this.NATIONAL_EXIT_Z + h) this._enterNational(camZ);
      } else {
        this._syncView(camZ);
      }
      return;
    }

    if (this._nationalActive) {
      if (camZ > this.NATIONAL_ENTER_Z + h) {
        this._exitNational();
      } else if (camZ <= this.NATIONAL_EXIT_Z - h) {
        this._exitNational();
        if (camZ <= this.ENTER_Z) this._enter(camZ);
      } else {
        this._syncNational(camZ);
      }
      return;
    }

    if (!earth) return;
    if (camZ <= this.ENTER_Z - h * 0.5) {
      this._enter(camZ);
    } else if (camZ <= this.NATIONAL_ENTER_Z && camZ > this.NATIONAL_EXIT_Z + h) {
      this._enterNational(camZ);
    }
  },

  _enter(camZ) {
    if (!this.map) return;
    SlumberManager?.wake?.('city_hd', 'city map');
    this.active = true;
    cityLevel = true;
    this._applyBaseLayers();
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.add('active');
    if (globe) globe.classList.add('city-map-active');
    document.body.classList.add('city-map-active');
    this._applyGlobeMapCrossfade(camZ);
    const c = this.mapViewCenter();
    this._center = c;
    this.map.setView([c.lat, c.lng], this.camZToZoom(camZ), { animate: false });
    this._invalidate();
    setTimeout(() => this._invalidate(), 120);
    setTimeout(() => this._invalidate(), 500);
    this._syncMarkers();
    this._syncRoute();
    this._seedDemoDrivers(c);
    CityLife?._updateChip?.(
      (CityLife?.nearbyVendors?.(c.lat, c.lng) || []).length,
      Object.keys(this._markers).filter(k => k.startsWith('drv_')).length
    );
    this._updateStyleSwitchVisible();
    this._startHealthWatch();
  },

  _enterNational(camZ) {
    if (!this.map) return;
    this._nationalActive = true;
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) { el.classList.add('national-active'); el.classList.remove('active'); }
    if (globe) { globe.classList.add('national-map-active'); globe.classList.remove('city-map-active'); }
    document.body.classList.add('national-map-active');
    document.body.classList.remove('city-map-active');
    this._applyGlobeMapCrossfade(camZ);
    this._applyBaseLayers();
    this.syncMapPins();
    const c = this.mapViewCenter();
    this._center = c;
    this.map.setView([c.lat, c.lng], this.nationalLeafletZoom(camZ), { animate: false });
    this._invalidate();
    GlobeDeck?.setPreview?.('National · ' + (ZoomTiers?.countryHint?.() || 'region') + ' · pinch in for city');
    this._updateStyleSwitchVisible();
    this._startHealthWatch();
  },

  _syncNational(camZ) {
    const c = this.mapViewCenter();
    this._center = c;
    const lz = this.nationalLeafletZoom(camZ);
    if (this.map.getZoom() !== lz) this.map.setZoom(lz, { animate: false });
    const cur = this.map.getCenter();
    if (Math.abs(cur.lat - c.lat) > 0.02 || Math.abs(cur.lng - c.lng) > 0.02) {
      this.map.panTo([c.lat, c.lng], { animate: false });
    }
  },

  _exitNational() {
    this._nationalActive = false;
    this._stopHealthWatch();
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.remove('national-active');
    if (globe) globe.classList.remove('national-map-active');
    document.body.classList.remove('national-map-active');
    const camZ = camera?.position?.z ?? this._globeZ();
    this._applyGlobeMapCrossfade(camZ);
    this._updateStyleSwitchVisible();
  },

  _exit() {
    this.active = false;
    cityLevel = false;
    this._stopHealthWatch();
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) { el.classList.remove('active'); el.classList.remove('national-active'); }
    if (globe) { globe.classList.remove('city-map-active'); globe.classList.remove('national-map-active'); }
    document.body.classList.remove('city-map-active');
    document.body.classList.remove('national-map-active');
    const camZ = camera?.position?.z ?? this._globeZ();
    this._applyGlobeMapCrossfade(camZ);
    EarthRealism?._hudTimer && (EarthRealism._hudTimer = 0);
    const chip = document.getElementById('city-life-chip');
    if (chip) chip.classList.remove('open');
    CliRibbon?.clearGlobeHint?.();
    this._updateStyleSwitchVisible();
  },

  _syncView(camZ) {
    const c = this.mapViewCenter();
    this._center = c;
    const lz = this.camZToZoom(camZ);
    if (this.map.getZoom() !== lz) this.map.setZoom(lz, { animate: false });
    const cur = this.map.getCenter();
    if (Math.abs(cur.lat - c.lat) > 0.0004 || Math.abs(cur.lng - c.lng) > 0.0004) {
      this.map.panTo([c.lat, c.lng], { animate: false });
    }
  },

  _icon(emoji, color, photoUrl, opts) {
    opts = opts || {};
    const size = photoUrl ? 36 : 28;
    const ring = opts.ring || '#fff';
    const inner = photoUrl
      ? '<span class="city-map-pin-photo" style="background-image:url(' + photoUrl + ');border:2px solid ' + ring + ';width:' + size + 'px;height:' + size + 'px"></span>'
      : '<span class="city-map-pin-fallback" style="background:' + color + ';border:2px solid ' + ring + ';width:' + size + 'px;height:' + size + 'px">' + (opts.initial || '') + '</span>';
    return L.divIcon({
      className: 'city-map-pin',
      html: inner,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
  },

  syncMapPins() {
    if (!this.map) return;
    const cd = window._clientDelivery;
    if (cd?.lat != null) {
      this._setMarker('pin_client', cd.lat, cd.lng, {
        color: 'rgba(68,255,136,0.9)', ring: '#66ffaa',
        logoUrl: MapPins?.clientPinPhoto?.(cd),
        initial: MapPins?.initials?.(cd.label || 'Deliver'),
        title: cd.label || 'Delivery',
      });
    } else if (this._markers.pin_client) {
      this.map.removeLayer(this._markers.pin_client);
      delete this._markers.pin_client;
    }
    const db = window._driverBase;
    if (db?.lat != null) {
      this._setMarker('pin_driver', db.lat, db.lng, {
        color: 'rgba(255,170,68,0.92)', ring: '#ffb060',
        logoUrl: MapPins?.driverBasePhoto?.(db),
        initial: MapPins?.initials?.(db.label || 'Driver'),
        title: db.label || 'Driver base',
      });
    } else if (this._markers.pin_driver) {
      this.map.removeLayer(this._markers.pin_driver);
      delete this._markers.pin_driver;
    }
    (window.Commerce?.vendors || []).forEach((v, i) => {
      if (v.lat == null) return;
      const logo = MapPins?.vendorLogo?.(v);
      const id = 'shop_' + (v.id || i);
      const prev = this._markers[id];
      if (prev) this.map.removeLayer(prev);
      const m = L.marker([v.lat, v.lng], {
        icon: this._icon('', 'rgba(26,111,212,0.88)', logo, { ring: '#7ec8ff', initial: MapPins?.initials?.(v.name || 'Shop') }),
        title: v.name || 'Shop',
      });
      m.on('click', () => VendorMapTile?.open?.(v));
      m.addTo(this.map);
      this._markers[id] = m;
    });
  },

  _setMarker(id, lat, lng, opts) {
    opts = opts || {};
    if (lat == null || lng == null) return;
    const prev = this._markers[id];
    const icon = this._icon(opts.emoji || '', opts.color || 'rgba(0,140,220,0.9)', opts.logoUrl, {
      ring: opts.ring || '#fff',
      initial: opts.initial || MapPins?.initials?.(opts.title || id),
    });
    if (prev) {
      prev.setLatLng([lat, lng]);
      prev.setIcon(icon);
      return prev;
    }
    const m = L.marker([lat, lng], {
      icon,
      title: opts.title || id,
    });
    if (opts.onClick) m.on('click', opts.onClick);
    m.addTo(this.map);
    this._markers[id] = m;
    return m;
  },

  _syncMarkers() {
    if (!this.active || !this.map) return;
    const me = window._lastPos;
    if (me) {
      this._setMarker('me', me.lat, me.lng, {
        color: 'rgba(26,111,212,0.92)', ring: '#7ec8ff',
        logoUrl: MapPins?.authAvatarUrl?.(),
        initial: MapPins?.initials?.(me?.name || 'You'),
        title: me?.name || 'You',
        onClick: () => GlobeEntity?.entities?.get('me') && GlobeEntity.activate(GlobeEntity.entities.get('me')),
      });
    }
    (window.others || []).forEach((u, i) => {
      this._setMarker('friend_' + (u.id || i), u.lat, u.lng, {
        color: 'rgba(61,158,255,0.88)', ring: '#7ec8ff',
        logoUrl: u.photo_url || u.avatar_url || '',
        initial: MapPins?.initials?.(u.name || 'User'),
        title: u.name,
      });
    });
    this.syncMapPins();
  },

  _driverLatLng(d, u, i) {
    const lat = d.field_lat ?? d.lat ?? d.latitude;
    const lng = d.field_lng ?? d.lng ?? d.longitude;
    if (lat != null && lng != null) return { lat: +lat, lng: +lng };
    return { lat: u.lat + (Math.sin(i * 1.7) * 0.006), lng: u.lng + (Math.cos(i * 1.3) * 0.006) };
  },

  _seedDemoDrivers(u) {
    if (this._demoDrivers.length) return;
    this._demoDrivers = [
      { id: 'demo1', display_name: 'Nikos · delivery', field_lat: u.lat + 0.004, field_lng: u.lng - 0.003 },
      { id: 'demo2', display_name: 'Elena · courier', field_lat: u.lat - 0.003, field_lng: u.lng + 0.005 },
      { id: 'demo3', display_name: 'Alex · ride', field_lat: u.lat + 0.002, field_lng: u.lng + 0.004 },
    ];
  },

  _animateDemoDrivers() {
    this._demoPhase += 0.0012;
    const u = window._lastPos || this._center;
    this._demoDrivers.forEach((d, i) => {
      d.field_lat = u.lat + Math.sin(this._demoPhase + i * 2.1) * 0.008;
      d.field_lng = u.lng + Math.cos(this._demoPhase + i * 1.6) * 0.008;
    });
  },

  async _tickDrivers() {
    if (!this.active) return;
    const u = window._lastPos || this._center;
    let drivers = window.Commerce?.fetchNearbyDrivers
      ? await window.Commerce.fetchNearbyDrivers(u.lat, u.lng)
      : [];
    if (!drivers.length) {
      this._seedDemoDrivers(u);
      this._animateDemoDrivers();
      drivers = this._demoDrivers;
    }
    window.Commerce?.showDriversOnGlobe?.(drivers);
    const seen = new Set();
    drivers.forEach((d, i) => {
      const p = this._driverLatLng(d, u, i);
      const id = 'drv_' + (d.id || i);
      seen.add(id);
      this._setMarker(id, p.lat, p.lng, {
        color: 'rgba(80,180,255,0.92)', ring: '#ffb060',
        logoUrl: MapPins?.driverPhotoUrl?.(d),
        initial: MapPins?.initials?.(d.display_name || 'Driver'),
        title: d.display_name || 'Driver',
      });
    });
    Object.keys(this._markers).forEach(k => {
      if (k.startsWith('drv_') && !seen.has(k)) {
        this.map.removeLayer(this._markers[k]);
        delete this._markers[k];
      }
    });
  },

  setRoute(coords) {
    this._routeCoords = coords || [];
    this._syncRoute();
  },

  _deliveryRoutes: {},

  setDeliveryRoute(id, coords, opts) {
    opts = opts || {};
    if (!id) return;
    this._deliveryRoutes[id] = { coords: coords || [], opts };
    this._syncDeliveryRoutes();
  },

  removeDeliveryRoute(id) {
    if (this._deliveryRoutes[id]) {
      const rec = this._deliveryRoutes[id];
      if (rec.layer && this.map) try { this.map.removeLayer(rec.layer); } catch (_) {}
      if (rec.polyLayer && this.map) try { this.map.removeLayer(rec.polyLayer); } catch (_) {}
      delete this._deliveryRoutes[id];
    }
  },

  setDeliveryPolygon(id, stops, opts) {
    opts = opts || {};
    if (!id) return;
    if (!this._deliveryRoutes[id]) this._deliveryRoutes[id] = { coords: [], opts: {} };
    this._deliveryRoutes[id].polygon = stops || [];
    this._deliveryRoutes[id].polyOpts = opts;
    this._syncDeliveryRoutes();
  },

  _syncDeliveryRoutes() {
    if (!this.map) return;
    const show = this.active || this._nationalActive || (this._blend || 0) > 0.08;
    Object.keys(this._deliveryRoutes).forEach(id => {
      const rec = this._deliveryRoutes[id];
      if (rec.layer) {
        try { this.map.removeLayer(rec.layer); } catch (_) {}
        rec.layer = null;
      }
      if (rec.polyLayer) {
        try { this.map.removeLayer(rec.polyLayer); } catch (_) {}
        rec.polyLayer = null;
      }
      if (!show) return;
      if (rec.polygon?.length >= 3) {
        const pOpts = rec.polyOpts || rec.opts || {};
        const pColor = pOpts.color || '#00dd88';
        rec.polyLayer = L.polygon(rec.polygon.map(s => [s.lat, s.lng]), {
          color: pColor,
          fillColor: pColor,
          fillOpacity: pOpts.pending ? 0.08 : (pOpts.polygon ? 0.16 : 0.11),
          weight: pOpts.pending ? 2 : 3,
          dashArray: pOpts.pending ? '7 9' : null,
          className: 'delivery-task-polygon',
        }).addTo(this.map);
        rec.polyLayer.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          pOpts.onClick?.();
        });
      }
      if (!rec.coords?.length) return;
      const latlngs = rec.coords.map(c => [c.lat, c.lng]);
      const color = rec.opts?.color || ((AstranovTheme?.effectiveMode?.() || 'dark') === 'bright' ? '#00aa66' : '#00dd88');
      rec.layer = L.polyline(latlngs, {
        color,
        weight: 6,
        opacity: 0.9,
        className: 'delivery-route-line',
      }).addTo(this.map);
      rec.layer.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        rec.opts?.onClick?.();
      });
    });
  },

  _syncRoute() {
    if (!this.map) return;
    if (this._route) {
      this.map.removeLayer(this._route);
      this._route = null;
    }
    const coords = this._routeCoords || DrivingView?.routeCoords || [];
    const show = this.active || this._nationalActive || (this._blend || 0) > 0.08;
    if (!coords.length || !show) {
      this._syncDeliveryRoutes();
      return;
    }
    const latlngs = coords.map(c => [c.lat, c.lng]);
    this._route = L.polyline(latlngs, {
      color: (AstranovTheme?.effectiveMode?.() || AstranovTheme?.mode) === 'bright' ? '#0066cc' : '#44ccff',
      weight: 5,
      opacity: 0.88,
    }).addTo(this.map);
    this._syncDeliveryRoutes();
  },
};
window.CityMap = CityMap;


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
    /* Space globe only — no idle waveform / neural overlay / gaming HUD scanlines */
    if (SlumberManager?.quality?.gamingGraphics && !this._gamingLight) {
      this._gamingLight = new THREE.PointLight(0x00e8ff, 1.4, 4.5);
      this._gamingLight.position.set(0.3, 0.5, 1.2);
      scene.add(this._gamingLight);
    }
    console.log('%c[Astranov AI Graphics] Gaming shader pipeline live', 'color:#00ddff;font-weight:700');
    window._aiGraphicsReady = true;
  },

  _isGaming() {
    return !!(SlumberManager?.quality?.gamingGraphics || SlumberManager?.tier === 'gaming' || SlumberManager?.tier === 'full');
  },

  _gamingVert() {
    return [
      'varying vec3 vN;',
      'varying vec3 vV;',
      'void main(){',
      '  vN = normalize(normalMatrix * normal);',
      '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
      '  vV = -mv.xyz;',
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
      'varying vec3 vN;',
      'varying vec3 vV;',
      'void main(){',
      '  vec3 n = normalize(vN);',
      '  vec3 v = normalize(vV);',
      '  float rim = pow(1.0 - max(dot(n, v), 0.0), 2.4) * uRim;',
      '  float pulse = 0.82 + 0.18 * sin(uPulse);',
      '  vec3 col = uColor * 0.45 + uEmit * pulse + vec3(0.15, 0.75, 1.0) * rim;',
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
        uRim: { value: opts.rim ?? 1.35 },
        uAlpha: { value: opts.opacity ?? 1 },
      },
      vertexShader: this._gamingVert(),
      fragmentShader: this._gamingFrag(),
      transparent: !!opts.transparent || (opts.opacity != null && opts.opacity < 1),
      blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
      depthWrite: !opts.additive,
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
    const COUNT = 72;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(COUNT * 3);
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      size: this._isGaming() ? 0.022 : 0.014,
      color: side < 0 ? 0x00e8ff : 0x44aaff,
      transparent: true,
      opacity: 0.92,
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

  addAtmosphere(parent, r) {
    const geo = new THREE.SphereGeometry(r * 1.018, SlumberManager?.tier === 'full' ? 48 : 32, SlumberManager?.tier === 'full' ? 48 : 32);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x2288cc,
      transparent: true,
      opacity: 0.06,
      blending: THREE.AdditiveBlending,
      side: THREE.BackSide,
      depthWrite: false,
    });
    this.atmosphere = new THREE.Mesh(geo, mat);
    parent.add(this.atmosphere);
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

  _paintAstranovCharacter(ctx, w, h, frame, opts = {}) {
    const t = frame * 0.12;
    const flap = Math.sin(t) * 0.12;
    const cx = w * 0.5;
    const cy = h * 0.46 + Math.sin(t * 0.65) * 2;
    const cyan = opts.glow || '#00e8ff';
    const silver = '#b8c8d8';
    const dark = '#0a1420';

    ctx.clearRect(0, 0, w, h);

    const bg = ctx.createRadialGradient(cx, cy, 8, cx, cy, w * 0.52);
    bg.addColorStop(0, 'rgba(0,40,80,0.5)');
    bg.addColorStop(0.6, 'rgba(0,10,24,0.25)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    for (let i = 0; i < 40; i++) {
      const sx = (Math.sin(i * 2.17 + frame * 0.02) * 0.5 + 0.5) * w;
      const sy = (Math.cos(i * 1.73) * 0.5 + 0.5) * h;
      ctx.fillStyle = i % 5 === 0 ? 'rgba(180,220,255,0.9)' : 'rgba(100,160,255,0.45)';
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';

    const drawMechWing = (side) => {
      const s = side;
      const tilt = flap * 8 * s;
      const segs = [
        [[6 * s, -4], [52 * s, -36 + tilt], [72 * s, -8 + tilt], [38 * s, 6]],
        [[10 * s, 2], [58 * s, -18 + tilt], [78 * s, 8 + tilt], [42 * s, 14]],
        [[14 * s, 10], [48 * s, 4 + tilt], [62 * s, 22 + tilt], [32 * s, 20]],
      ];
      segs.forEach((pts, i) => {
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        pts.slice(1).forEach(p => ctx.lineTo(p[0], p[1]));
        ctx.closePath();
        const g = ctx.createLinearGradient(0, -30, 60 * s, 20);
        g.addColorStop(0, silver);
        g.addColorStop(0.45, '#4a5a6a');
        g.addColorStop(1, dark);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.strokeStyle = i === 0 ? cyan : 'rgba(0,200,255,0.35)';
        ctx.lineWidth = i === 0 ? 1.8 : 1;
        ctx.stroke();
      });
    };

    if (opts.jet) {
      const jetLen = 38 + Math.sin(t * 2) * 8;
      [-1, 1].forEach((side) => {
        const jg = ctx.createLinearGradient(side * 20, 8, side * 20, 8 + jetLen);
        jg.addColorStop(0, cyan);
        jg.addColorStop(0.4, 'rgba(0,180,255,0.55)');
        jg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = jg;
        ctx.beginPath();
        ctx.moveTo(side * 14, 10);
        ctx.lineTo(side * 28, 10);
        ctx.lineTo(side * 18, 10 + jetLen);
        ctx.closePath();
        ctx.fill();
      });
    }

    drawMechWing(-1);
    drawMechWing(1);

    ctx.globalCompositeOperation = 'source-over';
    const torso = ctx.createLinearGradient(0, -20, 0, 32);
    torso.addColorStop(0, silver);
    torso.addColorStop(0.35, '#5a6a7a');
    torso.addColorStop(0.7, dark);
    torso.addColorStop(1, '#1a2838');
    ctx.fillStyle = torso;
    ctx.beginPath();
    ctx.moveTo(-14, -12);
    ctx.lineTo(14, -12);
    ctx.lineTo(18, 8);
    ctx.lineTo(12, 30);
    ctx.lineTo(-12, 30);
    ctx.lineTo(-18, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = cyan;
    ctx.lineWidth = 1.2;
    ctx.stroke();

    const corePulse = 0.75 + Math.sin(t * 1.6) * 0.25;
    const core = ctx.createRadialGradient(0, 4, 1, 0, 4, 10);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, cyan);
    core.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = corePulse;
    ctx.fillStyle = core;
    ctx.beginPath();
    ctx.arc(0, 4, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;

    [-1, 1].forEach((side) => {
      ctx.fillStyle = '#6a7a8a';
      ctx.fillRect(side * 10, -8, 8, 22);
      ctx.fillStyle = cyan;
      ctx.fillRect(side * 12, 2, 5, 8);
      ctx.beginPath();
      ctx.ellipse(side * 22, -2, 10, 6, side * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = '#7a8a9a';
      ctx.fill();
    });

    const helm = ctx.createLinearGradient(-12, -34, 12, -18);
    helm.addColorStop(0, '#e8f0ff');
    helm.addColorStop(0.5, silver);
    helm.addColorStop(1, '#4a5a68');
    ctx.fillStyle = helm;
    ctx.beginPath();
    ctx.ellipse(0, -24, 13, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = cyan;
    ctx.shadowColor = cyan;
    ctx.shadowBlur = 12;
    ctx.fillRect(-11, -26, 22, 5);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#5a6a78';
    ctx.fillRect(-7, 28, 5, 14);
    ctx.fillRect(2, 30, 5, 12);

    ctx.restore();
  },

  _buildProceduralHumanoid(lat, lng, opts = {}) {
    const hi = this._isGaming();
    const seg = hi ? 16 : 10;
    const g = new THREE.Group();
    const torso = new THREE.Mesh(
      new THREE.CylinderGeometry(0.014, 0.018, 0.048, seg),
      this._gamingMat({ color: 0x141e2a, emissive: 0x006688, rim: 1.1 }),
    );
    g.add(torso);
    const chest = new THREE.Mesh(
      new THREE.BoxGeometry(0.032, 0.028, 0.022),
      this._gamingMat({ color: 0x2a3a4a, emissive: 0x00aacc, rim: 1.6 }),
    );
    chest.position.y = 0.008;
    g.add(chest);
    const head = new THREE.Mesh(
      new THREE.IcosahedronGeometry(0.014, hi ? 1 : 0),
      this._gamingMat({ color: 0x8899aa, emissive: 0x224466, rim: 1.4 }),
    );
    head.position.y = 0.036;
    g.add(head);
    const visor = new THREE.Mesh(
      new THREE.BoxGeometry(0.026, 0.008, 0.012),
      this._gamingMat({ color: 0x001822, emissive: 0x00e8ff, rim: 2.2, transparent: true, opacity: 0.95 }),
    );
    visor.position.set(0, 0.038, 0.014);
    g.add(visor);
    const arms = [];
    [-1, 1].forEach((side) => {
      const arm = new THREE.Group();
      const upper = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.005, 0.02, seg),
        this._gamingMat({ color: 0x4a5a6a, emissive: 0x0088aa, rim: 1.2 }),
      );
      upper.rotation.z = side * 0.35;
      arm.add(upper);
      const gauntlet = new THREE.Mesh(
        new THREE.BoxGeometry(0.01, 0.012, 0.01),
        this._gamingMat({ color: 0x00c8ff, emissive: 0x00e8ff, rim: 1.8 }),
      );
      gauntlet.position.set(side * 0.014, -0.012, 0);
      arm.add(gauntlet);
      arm.position.set(side * 0.02, 0.014, 0);
      g.add(arm);
      arms.push(arm);
    });
    const legs = [];
    [-1, 1].forEach((side) => {
      const leg = new THREE.Group();
      const thigh = new THREE.Mesh(
        new THREE.CylinderGeometry(0.005, 0.006, 0.018, seg),
        this._gamingMat({ color: 0x3a4a58, emissive: 0x004466, rim: 1.0 }),
      );
      leg.add(thigh);
      const boot = new THREE.Mesh(
        new THREE.BoxGeometry(0.011, 0.014, 0.014),
        this._gamingMat({ color: 0x2a3848, emissive: 0x0066aa, rim: 1.3 }),
      );
      boot.position.y = -0.018;
      leg.add(boot);
      leg.position.set(side * 0.011, -0.028, 0);
      g.add(leg);
      legs.push(leg);
    });
    const wings = [];
    [-1, 1].forEach((side) => {
      const wing = new THREE.Group();
      for (let s = 0; s < 3; s++) {
        const segMesh = new THREE.Mesh(
          new THREE.BoxGeometry(0.022 - s * 0.004, 0.003, 0.012 - s * 0.002),
          this._gamingMat({
            color: 0x6a7a8a,
            emissive: s === 0 ? 0x00c8ff : 0x006688,
            rim: 1.5 + s * 0.3,
            transparent: s > 0,
            opacity: s === 0 ? 1 : 0.82,
          }),
        );
        segMesh.position.set(side * (0.018 + s * 0.016), s * 0.006, -s * 0.003);
        wing.add(segMesh);
      }
      wing.position.set(side * 0.016, 0.012, -0.01);
      g.add(wing);
      wings.push(wing);
    });
    const thrusters = [];
    const jetVfx = [];
    [-1, 1].forEach((side) => {
      const pack = new THREE.Group();
      const housing = new THREE.Mesh(
        new THREE.CylinderGeometry(0.006, 0.008, 0.016, seg),
        this._gamingMat({ color: 0x2a3848, emissive: 0x00aacc, rim: 1.4 }),
      );
      pack.add(housing);
      const plume = new THREE.Mesh(
        new THREE.ConeGeometry(0.007, hi ? 0.038 : 0.024, seg),
        this._gamingMat({ color: 0x00e8ff, emissive: 0x00ffff, rim: 2.0, additive: true, transparent: true, opacity: 0.75 }),
      );
      plume.rotation.x = Math.PI;
      plume.position.y = -0.022;
      pack.add(plume);
      pack.position.set(side * 0.014, -0.03, -0.016);
      g.add(pack);
      thrusters.push(plume);
      jetVfx.push(this._createJetVfx(g, side));
    });
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.011, seg, seg),
      this._gamingMat({ color: 0xffffff, emissive: 0x00e8ff, rim: 2.4, additive: true, transparent: true, opacity: 0.7 }),
    );
    core.position.y = 0.006;
    g.add(core);
    const aura = new THREE.Mesh(
      new THREE.SphereGeometry(0.052, seg, seg),
      new THREE.MeshBasicMaterial({
        color: 0x00c8ff,
        transparent: true,
        opacity: hi ? 0.12 : 0.08,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    g.add(aura);
    const alt = opts.alt || 1.09;
    const p = this._latLngToPos(lat ?? 36.44, lng ?? 28.22, alt);
    g.position.set(p.x, p.y, p.z);
    const n = new THREE.Vector3(p.x, p.y, p.z).normalize();
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    g.userData = {
      type: 'astranov-flyer',
      procedural3d: true,
      gaming: hi,
      name: opts.label || 'Astranov',
      lat, lng, alt,
      wings, arms, legs, thrusters, core, aura, jetVfx,
      edition: opts.edition?.id || 'astranov',
    };
    return g;
  },

  _animateFlyerPose(mesh, flying) {
    const ud = mesh?.userData;
    if (!ud?.procedural3d) return;
    const t = this._flyerFrame * 0.12;
    this._pulseGamingMats(mesh, t);
    const flap = Math.sin(t) * (flying ? 0.52 : 0.28);
    ud.wings?.forEach((wing, i) => {
      wing.rotation.z = (i === 0 ? 1 : -1) * flap;
      wing.rotation.y = Math.sin(t * 0.8 + i) * 0.08;
    });
    ud.legs?.forEach((leg, i) => {
      leg.rotation.x = Math.sin(t * 0.9 + i) * (flying ? 0.22 : 0.12);
    });
    ud.arms?.forEach((arm, i) => {
      arm.rotation.z = (i === 0 ? 1 : -1) * (0.12 + Math.sin(t * 0.7) * 0.08);
    });
    if (ud.core?.material?.uniforms?.uAlpha) {
      ud.core.material.uniforms.uAlpha.value = 0.55 + Math.sin(t * 1.6) * 0.3;
    }
    if (ud.aura?.material) {
      ud.aura.material.opacity = (flying ? 0.16 : 0.1) + Math.sin(t * 1.2) * 0.04;
      ud.aura.scale.setScalar(1 + Math.sin(t * 0.9) * 0.06);
    }
    ud.thrusters?.forEach((thr, i) => {
      if (thr.material?.uniforms?.uAlpha) {
        thr.material.uniforms.uAlpha.value = flying
          ? 0.65 + Math.sin(t * 2 + i) * 0.3
          : 0.3 + Math.sin(t + i) * 0.12;
      }
      thr.scale.y = flying ? 1.2 + Math.sin(t * 1.4 + i) * 0.45 : 0.65;
    });
    const power = flying ? 0.014 : 0.006;
    const worldDown = new THREE.Vector3(0, -1, 0).applyQuaternion(mesh.quaternion);
    ud.thrusters?.forEach((thr, i) => {
      const wp = new THREE.Vector3();
      thr.getWorldPosition(wp);
      this._emitJet(ud.jetVfx?.[i], wp, worldDown, power);
    });
    ud.jetVfx?.forEach((vfx) => this._tickJetVfx(vfx, flying));
    if (this._gamingLight && mesh.position) {
      this._gamingLight.position.copy(mesh.position).multiplyScalar(1.02);
    }
  },

  _orientFlyerOnGlobe(mesh, pos) {
    if (!mesh || !pos) return;
    const n = pos.clone().normalize();
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
  },

  _scaleFlyer(mesh, camZ) {
    if (!mesh?.userData?.procedural3d) return;
    const scale = Math.max(0.85, Math.min(2.4, 1.35 * (camZ / 2.2)));
    mesh.scale.setScalar(scale);
  },

  spawnAstranovFlyer(lat, lng, opts = {}) {
    if (this._flyer?.parent) this._flyer.parent.remove(this._flyer);
    const robot = this._buildProceduralHumanoid(lat, lng, opts);
    globePivot.add(robot);
    this._flyer = robot;
    window._astranovFlyer = robot;
    window._pilot = robot;
    this._animateFlyerPose(robot, false);
    this.spawnEffect(robot.position, opts.color || 0x3d9eff, 22, 48);
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
      const camZ = camera?.position?.z ?? GlobeNavigate.GLOBAL_Z;
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
    const camZ = camera?.position?.z ?? GlobeNavigate.GLOBAL_Z;
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
AIGraphics.init(globePivot);

setTimeout(() => {
  try {
    AIGraphics.spawnEffect(new THREE.Vector3(0.6, 0.3, 1.1), 0x00ffaa, 28, 32);
    const u = window._lastPos || { lat: 36.44, lng: 28.22 };
    AIGraphics.spawnAstranovFlyer(u.lat, u.lng, { label: 'Astranov' });
  } catch (_) {}
}, 480);

window.AstranovFlyer = {
  spawn: (lat, lng, opts) => AIGraphics.spawnAstranovFlyer(lat, lng, opts),
  flyTo: (lat, lng, opts) => AIGraphics.flyAstranovTo(lat, lng, opts),
};



// === SUPER CLI BRAIN — full command of collective intelligence + UI ===
Object.assign(SuperCli, {
  devMode: false,
  _devKey: 'astranov-dev-mode',

  PANELS: {
    vendor: 'vendor-menu', vendors: 'vendor-menu', order: 'vendor-menu', shop: 'vendor-menu',
    batch: 'node-batch', node: 'node-batch',
    radio: 'sat-radio', vhf: 'sat-radio', pmr: 'sat-radio',
    video: 'globe-youtube', youtube: 'globe-youtube', yt: 'globe-youtube',
  },

  CITIES: {
    athens: [37.98, 23.73], athina: [37.98, 23.73], rhodes: [36.44, 28.22], rodos: [36.44, 28.22],
    london: [51.51, -0.13], paris: [48.86, 2.35], berlin: [52.52, 13.41], rome: [41.90, 12.50],
    newyork: [40.71, -74.01], tokyo: [35.68, 139.69], sydney: [-33.87, 151.21],
  },

  ZOOM: { earth: 2.2, orbit: 4.4, leo: 4.4, solar: 8, system: 8, galaxy: 16 },

  initBrain() {
    try {
      this.devMode = sessionStorage.getItem(this._devKey) === '1';
      if (this.devMode) this._applyDevHud();
    } catch (_) {}
  },

  _applyDevHud() {
    if (!this.devMode) return;
    GlobeDeck?.setTitle(ACL_TITLE + ' · DEV');
    GlobeDeck?.setPreview('DEV — brain + UI under command line');
  },

  _setDevMode(on) {
    this.devMode = !!on;
    try { sessionStorage.setItem(this._devKey, on ? '1' : '0'); } catch (_) {}
    if (on) {
      this._applyDevHud();
      AciCoders?.autoStart?.();
      GlobeDeck.activeTask = 'coders';
    } else {
      GlobeDeck?.setTitle(ACL_TITLE);
    }
    this.setContext(this.inferContext());
  },

  parseParts(line) {
    return (line.match(/(?:[^\s"]+|"[^"]*")+/g) || []).map(p => p.replace(/^"|"$/g, ''));
  },

  isStructuredCmd(cmd) {
    const c = (cmd || '').toLowerCase();
    const known = new Set([
      'help', '?', 'dev', 'ui', 'brain', 'coders', 'composer', 'cursor', 'grok', 'summon',
      'connect', 'open', 'deploy', 'clear', 'exit', 'close', 'logout', 'think', 'evolve',
      'teach', 'stats', 'owner', 'seed', 'distill', 'council', 'mode', 'batch', 'vendors',
      'shops', 'order', 'vendor', 'ping', 'locate', 'gps', 'me', 'vhf', 'call', 'phone',
      'drive', 'news', 'roles', 'claim', 'field_stats', 'hold', 'resume', 'stop',
      'sync', 'requests', 'wishlist', 'players', 'friends', 'kryfto', 'hide', 'seek', 'collab',
      'hideandseek', 'housekeeping', 'συγυρισμα', 'συγύρισμα', 'pyramid', 'pyramids', 'willa', 'willagame',
      'team', 'contact', 'msg',
      'telemachos', 'tilemaxos', 'telemachus', 'tilemachos', 'teledromos', 'teledromus',
      'pilot', 'drone', 'drones', 'fleet',
      'youtube', 'yt', 'watch', 'play', 'space', 'scenario', 'add', 'post', 'superadd',
      'theme', 'dark', 'bright', 'light',
      'yacht', 'yachts', 'charter', 'booker',
    ]);
    return known.has(c);
  },

  out(text, cls) { AciCli?.print(text, cls || 'out'); },

  zoomTo(level) {
    const map = {
      earth: 'global', global: 'global', national: 'national', country: 'national',
      city: 'city', neighborhood: 'neighborhood', solar: 'solar', system: 'solar',
    };
    const id = map[(level || 'global').toLowerCase()] || (level || 'global').toLowerCase();
    if (ZoomTiers?.goTo?.(id)) {
      this.out('zoom → ' + ZoomTiers.current().label, 'ok');
      return;
    }
    const z = this.ZOOM[(level || 'earth').toLowerCase()] || this.ZOOM.earth;
    window._globeFly = {
      mode: 'zoom',
      fromZ: camera.position.z,
      toZ: z,
      t0: performance.now(),
      dur: GlobeControl?.flyDuration?.(camera.position.z, z) || 1400,
    };
    CosmicZoom.update(z);
    this.out('zoom → ' + (level || 'earth') + ' (z=' + z + ')', 'ok');
  },

  async flyTo(lat, lng, label, opts) {
    if (!TrackballGuard?.beforeFly?.(lat, lng, opts)) return;
    const z = opts?.city ? (GlobeControl?.Z?.city || 1.38) : (GlobeControl?.Z?.global || 2.55);
    GlobeControl?.flyToLatLng?.(lat, lng, label || 'fly', z, { city: !!opts?.city, force: !!opts?.force });
    MapDepict?.pulse?.(lat, lng, 0x00ddff, label || 'fly', 8000);
    GlobeControl?.noteAutoFly?.();
    this.out('fly → ' + (label || lat.toFixed(2) + ', ' + lng.toFixed(2)), 'ok');
  },

  statusSnapshot() {
    return {
      devMode: this.devMode,
      context: this._context,
      deck: { expanded: GlobeDeck?.expanded, task: GlobeDeck?.activeTask, thinking: GlobeDeck?.thinking },
      brain: {
        neurons: ACI?.neurons?.length || 0,
        thinkMode: ACI?.thinkMode || 'default',
        codersListening: !!AciCoders?._listening,
        codersEngine: AciCoders?.engine,
        cause: AciCoders?.CAUSE,
      },
      batch: { session: AstranovSession?.SESSION_NAME, id: AstranovSession?.BATCH_SHORT_ID, devices: AstranovNode?.peerCount },
      superspace: SuperSpace?.status?.(),
      globe: { level: CosmicZoom?.level, follow: GlobeControl?.followMode, exploring: GlobeControl?.userExploring },
      user: AstranovSession?.isAstranov?.() ? 'ASTRANOV' : (Auth?.user ? (Auth.user.email?.split('@')[0] || 'user') : 'guest'),
      session: AstranovSession?.SESSION_NAME || 'ASTRANOV COLLECTIVE INTELLIGENCE',
      owner: !!Auth?.isOwner,
    };
  },

  printHelp() {
    const owner = Auth?.isOwner;
    this.out('── Astranov Command Line — brain + UI + dev ──', 'dim');
    this.out('dev on|off · dev task <msg> · dev peers · dev deploy · dev status', 'ok');
    this.out('ui show batch|radio|vendor|youtube · ui hide · ui fly athens · ui zoom galaxy', 'ok');
    this.out('youtube <search> · watch <url> · play 2 (pick result)', 'ok');
    this.out('space locate <topic> · space status — brain places media on globe/cosmos', 'ok');
    this.out('scenario wake|city|groceries|youtube|reviews|list — real user flows', 'ok');
    this.out('players · kryfto · ΣΥΓΥΡΙΣΜΑ · pyramid · willa — 12 Olympians 🔵 · 12 Cronians 🔴', 'ok');
    this.out('team create <name> · team join <id> · contact video|voice|message <name>', 'ok');
    this.out('cli search <text> · cli users · cli view <name> · cloud dm <name> · chat <name> <msg>', 'ok');
    this.out('drivers · driver <name> — pick delivery driver on map/cloud', 'ok');
    this.out('tilemaxos — takeover ANY drone (FPV priority) · flyback to pilot · scan · evolve', 'ok');
    this.out('profile me · match <site> dates [pax] · match field <site> <name> · site approve <slug>', 'ok');
    this.out('theme dark|bright · or just: dark · bright — globe + city map + UI', 'ok');
    this.out('add · post — Super Add camera · global/team/local channel', 'ok');
    this.out('Tri-UI: SuperCli + SuperVoice + SuperSpace · mic+send at bottom bar', 'dim');
    this.out('brain think|evolve|teach|coders|listen on|off|status · brain order <task>', owner ? 'ok' : 'dim');
    this.out('locate · order · batch · vhf · coders · deploy · think · type anything', 'ok');
    if (owner) this.out('Owner: brain order <task> = execute · coders <task> = explicit order', 'dim');
    ACIControl?.reply('Full command: dev on · ui status · brain status · then build');
    GlobeDeck?.finishCliIfOneShot('help');
  },

  async cmdDev(parts) {
    const sub = (parts[1] || 'status').toLowerCase();
    const rest = parts.slice(2).join(' ');

    if (sub === 'on' || sub === 'start') {
      this._setDevMode(true);
      GlobeDeck?.expand(ACL_TITLE + ' · DEV');
      await AciCoders?.autoStart?.();
      this.out('DEV on — brain + UI under your command · peers see tasks', 'ok');
      ACIControl?.reply('Dev mode on — type tasks, ui commands, or brain orders');
      return { ok: true };
    }
    if (sub === 'off' || sub === 'stop') {
      this._setDevMode(false);
      this.out('DEV off', 'ok');
      return { ok: true };
    }
    if (sub === 'task' || sub === 'broadcast') {
      if (!rest) { this.out('usage: dev task <message>', 'err'); return { error: 'empty' }; }
      if (AstranovNode?.batchId) AstranovNode.broadcastTask(rest);
      else this.out('no batch — run batch first', 'dim');
      GlobeDeck.activeTask = 'coders';
      await AciCoders?.handleMessage(rest);
      return { ok: true };
    }
    if (sub === 'peers') {
      this.out((AstranovSession?.SESSION_NAME || 'collective') + ' · ' + (AstranovNode?.peerCount ?? 0) + ' device(s)', 'ok');
      GlobeDeck?.finishCliIfOneShot('dev');
      return { ok: true };
    }
    if (sub === 'deploy') {
      await AciConnect?.deploy(rest || 'continue deployment');
      GlobeDeck?.finishCliIfOneShot('deploy');
      return { ok: true };
    }
    if (sub === 'connect') {
      await AciConnect?.connect(true);
      GlobeDeck?.finishCliIfOneShot('connect');
      return { ok: true };
    }
    if (sub === 'status') {
      this.out(JSON.stringify(this.statusSnapshot(), null, 0).slice(0, 700), 'out');
      GlobeDeck?.finishCliIfOneShot('dev');
      return { ok: true };
    }
    this.out('usage: dev on|off|task|peers|deploy|connect|status', 'err');
    return { error: 'unknown dev subcommand' };
  },

  async cmdUi(parts) {
    const sub = (parts[1] || 'status').toLowerCase();
    const rest = parts.slice(2).join(' ');

    if (sub === 'show' || sub === 'open') {
      const key = (parts[2] || '').toLowerCase();
      const panel = this.PANELS[key];
      if (panel) {
        GlobeDeck?.showStage(panel, key === 'batch' || key === 'node' ? 'batch' : key === 'radio' || key === 'vhf' ? 'radio' : 'commerce');
        if (key === 'vendor' || key === 'order') await Commerce?.showPicker?.();
        if (key === 'batch' || key === 'node') AstranovNode?.showPanel?.();
        if (key === 'radio' || key === 'vhf') Comms?.startVHF?.();
        if (key === 'video' || key === 'youtube' || key === 'yt') GlobeVideo?.showPanel?.('YouTube on globe');
        this.setContext(this.inferContext());
        this.out('ui show → ' + key, 'ok');
        return { ok: true };
      }
      if (key === 'deck' || key === 'cli') {
        GlobeDeck?.expand(ACL_TITLE);
        document.getElementById('aci-cli-in')?.focus();
        return { ok: true };
      }
      this.out('usage: ui show vendor|batch|radio|deck', 'err');
      return { error: 'unknown panel' };
    }
    if (sub === 'hide' || sub === 'close') {
      GlobeDeck?.hideStage();
      this.out('ui hidden', 'ok');
      this.setContext(this.inferContext());
      return { ok: true };
    }
    if (sub === 'expand') { GlobeDeck?.expand(ACL_TITLE); return { ok: true }; }
    if (sub === 'collapse') { GlobeDeck?.collapse(); return { ok: true }; }
    if (sub === 'toggle') { GlobeDeck?.toggle(); return { ok: true }; }
    if (sub === 'zoom') {
      this.zoomTo(parts[2] || 'earth');
      GlobeDeck?.finishCliIfOneShot('ui');
      return { ok: true };
    }
    if (sub === 'fly' || sub === 'go') {
      const a = parts[2], b = parts[3];
      if (a && b && !isNaN(parseFloat(a))) {
        await this.flyTo(parseFloat(a), parseFloat(b), rest || 'target');
        return { ok: true };
      }
      const city = (a || '').toLowerCase().replace(/\s/g, '');
      const c = this.CITIES[city];
      if (c) { await this.flyTo(c[0], c[1], city); return { ok: true }; }
      this.out('usage: ui fly athens | ui fly 36.4 28.2', 'err');
      return { error: 'bad fly' };
    }
    if (sub === 'title') {
      GlobeDeck?.setTitle(rest || ACL_TITLE);
      this.out('title set', 'ok');
      return { ok: true };
    }
    if (sub === 'stop') {
      userIntervene?.();
      return { ok: true };
    }
    if (sub === 'status') {
      this.out(JSON.stringify(this.statusSnapshot().deck, null, 0) + ' · ' + CosmicZoom?.level, 'out');
      GlobeDeck?.finishCliIfOneShot('ui');
      return { ok: true };
    }
    this.out('usage: ui show|hide|fly|zoom|expand|collapse|status', 'err');
    return { error: 'unknown ui subcommand' };
  },

  async cmdBrain(parts) {
    const sub = (parts[1] || 'status').toLowerCase();
    const rest = parts.slice(2).join(' ');

    if (sub === 'think') {
      if (!rest) { ACIControl?.reply('usage: brain think <prompt>'); return { error: 'empty' }; }
      const r = await ACI.think(rest);
      ACIControl?.reply(r || '(empty)');
      GlobeDeck?.finishCliIfOneShot('think');
      return { ok: true, text: r };
    }
    if (sub === 'evolve') {
      this.out('evolving…', 'dim');
      const r = await ACI.evolve(rest || 'cli');
      this.out(JSON.stringify(r || { ok: true }).slice(0, 400), 'out');
      GlobeDeck?.finishCliIfOneShot('evolve');
      return { ok: true };
    }
    if (sub === 'teach') {
      if (!rest) { this.out('usage: brain teach <content>', 'err'); return { error: 'empty' }; }
      await ACI.teach(rest);
      this.out('remembered · neuron spawned', 'ok');
      GlobeDeck?.finishCliIfOneShot('teach');
      return { ok: true };
    }
    if (sub === 'stats' || sub === 'owner') {
      const r = await AciCli.api({ mode: sub === 'owner' ? 'owner_sync' : 'stats' });
      this.out(JSON.stringify(r, null, 0).slice(0, 600), 'out');
      if (r.is_owner) Auth.isOwner = true;
      GlobeDeck?.finishCliIfOneShot(sub);
      return { ok: true };
    }
    if (sub === 'seed' || sub === 'distill' || sub === 'council') {
      if (!Auth?.isOwner) { this.out('owner only', 'err'); return { error: 'owner' }; }
      const body = { mode: sub };
      if (sub === 'council') {
        body.council_mode = (parts[2] || 'list').toLowerCase();
        if (body.council_mode === 'convene') {
          body.title = parts[3] || 'CLI case';
          body.description = parts.slice(4).join(' ') || body.title;
        }
      }
      const r = await AciCli.api(body);
      this.out(JSON.stringify(r).slice(0, 600), 'out');
      GlobeDeck?.finishCliIfOneShot(sub);
      return { ok: true };
    }
    if (sub === 'mode') {
      ACI.thinkMode = rest || '';
      this.out('brain mode: ' + (ACI.thinkMode || 'default'), 'ok');
      GlobeDeck?.finishCliIfOneShot('mode');
      return { ok: true };
    }
    if (sub === 'listen') {
      const on = (parts[2] || 'on').toLowerCase();
      if (on === 'off') { AciCoders?.stopListening?.(); this.out('coders listen off', 'ok'); }
      else { AciCoders?.startListening?.(); this.out('coders listen on', 'ok'); }
      return { ok: true };
    }
    if (sub === 'coders' || sub === 'chat') {
      GlobeDeck.activeTask = 'coders';
      await AciCoders?.handleMessage(rest || 'status');
      return { ok: true };
    }
    if (sub === 'order' || sub === 'execute') {
      if (!Auth?.isOwner) { this.out('owner only — brain order <task>', 'err'); return { error: 'owner' }; }
      GlobeDeck.activeTask = 'coders';
      await AciCoders?.handleMessage('coders ' + rest);
      return { ok: true };
    }
    if (sub === 'ping') {
      const r = await ACI.think('ping');
      ACIControl?.reply(r || 'pong');
      GlobeDeck?.finishCliIfOneShot('ping');
      return { ok: true };
    }
    if (sub === 'status') {
      const s = this.statusSnapshot().brain;
      s.batch = this.statusSnapshot().batch;
      s.devMode = this.devMode;
      this.out(JSON.stringify(s, null, 0), 'out');
      GlobeDeck?.finishCliIfOneShot('brain');
      return { ok: true };
    }
    this.out('usage: brain think|evolve|teach|coders|listen|order|status', 'err');
    return { error: 'unknown brain subcommand' };
  },

  async cmdScenario(parts, rest) {
    const name = (parts[1] || 'list').toLowerCase();
    const topic = parts.slice(2).join(' ') || rest.replace(/^[^\s]+\s*/, '');
    await CityLife?.run?.(name, topic);
    return { ok: true };
  },

  async cmdSpace(parts, rest) {
    const sub = (parts[1] || 'status').toLowerCase();
    if (sub === 'status') {
      this.out(JSON.stringify(SuperSpace?.status?.(), null, 0), 'out');
      GlobeDeck?.finishCliIfOneShot('space');
      return { ok: true };
    }
    if (sub === 'locate' || sub === 'find' || sub === 'place') {
      const topic = parts.slice(2).join(' ') || rest.replace(/^locate\s*/i, '');
      if (!topic) { this.out('usage: space locate mars documentary', 'err'); return { error: 'empty' }; }
      await SuperSpace?.locateText?.(topic);
      return { ok: true };
    }
    if (sub === 'zoom') {
      SuperSpace?.zoomTo?.(parts[2] || 'earth');
      return { ok: true };
    }
    if (rest) {
      await SuperSpace?.locateText?.(rest);
      return { ok: true };
    }
    this.out('usage: space locate <topic> · space status · space zoom galaxy', 'err');
    return { error: 'unknown' };
  },

  async devBrain(line) {
    GlobeDeck.activeTask = 'coders';
    AciCoders?.observeActivity?.('dev', line.slice(0, 120));
    if (AstranovNode?.batchId) AstranovNode.broadcastTask(line);
    await AciCoders?.handleMessage(line);
    return { ok: true };
  },

  async exec(line, opts = {}) {
    const raw = String(line || '').trim();
    if (!raw) return { handled: false };
    const parts = this.parseParts(raw);
    const cmd = (parts[0] || '').toLowerCase();
    const rest = parts.slice(1).join(' ');

    try {
      if (TelemachosPilot?.wantsCmd?.(raw)) {
        await TelemachosPilot.cli(parts, raw);
        return { handled: true };
      }
      if (AstranovPresence?.wantsKryftoStart?.(raw)) {
        AstranovPresence?.startKryfto?.();
        return { handled: true };
      }
      if (WillaGames?.wantsPyramid?.(raw)) {
        WillaGames?.startPyramid?.();
        return { handled: true };
      }
      if (WillaGames?.wantsWilla?.(raw) || cmd === 'willa' || cmd === 'willagame') {
        WillaGames?.startWilla?.();
        return { handled: true };
      }
      if (cmd === 'pyramid' || cmd === 'pyramids') {
        WillaGames?.startPyramid?.();
        return { handled: true };
      }
      if (AciCoders?.isLocalGlobeCmd?.(raw)) {
        const r = AciCoders.runLocalGlobeCmd(raw);
        GlobeDeck?.finishCliIfOneShot('locate');
        return { handled: true, ...r };
      }
      if (cmd === 'locate' || cmd === 'gps' || cmd === 'me' || (cmd === 'zoom' && /^to\s+me$/i.test(rest))) {
        await SuperCli.run('locate');
        return { handled: true };
      }
      if (cmd === 'help' || cmd === '?') {
        this.printHelp();
        return { handled: true };
      }
      if (cmd === 'dev') {
        await this.cmdDev(parts);
        return { handled: true };
      }
      if (cmd === 'ui') {
        await this.cmdUi(parts);
        return { handled: true };
      }
      if (cmd === 'brain') {
        await this.cmdBrain(parts);
        return { handled: true };
      }
      if (cmd === 'space' || cmd === 'superspace') {
        await this.cmdSpace(parts, rest);
        return { handled: true };
      }
      if (cmd === 'scenario' || cmd === 'day') {
        await this.cmdScenario(parts, rest);
        return { handled: true };
      }
      if (cmd === 'theme' || cmd === 'dark' || cmd === 'bright' || cmd === 'light') {
        const mode = cmd === 'theme'
          ? (parts[1] || rest || '').toLowerCase()
          : (cmd === 'light' ? 'bright' : cmd);
        if (mode === 'dark' || mode === 'bright') {
          AstranovTheme?.set?.(mode);
          this.out('theme → ' + mode, 'ok');
        } else {
          AstranovTheme?.toggle?.();
          this.out('theme → ' + (AstranovTheme?.mode || 'dark'), 'ok');
        }
        return { handled: true };
      }
      if (cmd === 'add' || cmd === 'post' || cmd === 'superadd') {
        SuperAdd?.open?.();
        return { handled: true };
      }
      if (cmd === 'status') {
        this.out(JSON.stringify(this.statusSnapshot(), null, 0).slice(0, 800), 'out');
        GlobeDeck?.finishCliIfOneShot('status');
        return { handled: true };
      }
      if (cmd === 'sync') {
        if (AstranovSession?.isAstranov?.()) await AstranovSession?.unifyCollective?.();
        else {
          await AstranovSession?.pull?.();
          await AstranovNode?.resumeSession?.();
          await AstranovSession?.push?.(true);
        }
        AstranovWishlist?.announceRecovered?.();
        this.out('◎ ' + (AstranovSession?.SESSION_NAME || 'collective') + ' · synced across devices', 'ok');
        return { handled: true };
      }
      if (cmd === 'requests' || cmd === 'wishlist') {
        const pending = AstranovWishlist?.pending?.() || [];
        if (!pending.length) {
          this.out('No pending requests — all recovered items done or empty', 'dim');
        } else {
          pending.forEach((it, i) => {
            this.out((i + 1) + '. ' + it.text.slice(0, 140), 'ok');
          });
        }
        return { handled: true };
      }
      if (cmd === 'players' || cmd === 'friends') {
        AstranovPresence?.listPlayers?.();
        return { handled: true };
      }
      if (cmd === 'hide' || cmd === 'κρύψου') {
        AstranovPresence?.toggleHide?.();
        return { handled: true };
      }
      if (cmd === 'seek' || cmd === 'show') {
        window.hidden = false;
        if (typeof hidden !== 'undefined') hidden = false;
        if (window._meMarker) window._meMarker.visible = true;
        AstranovPresence?.broadcast?.();
        AstranovPresence?.listPlayers?.();
        return { handled: true };
      }
      if (cmd === 'collab') {
        AstranovPresence.game = 'collab';
        window.hidden = false;
        AstranovPresence?.broadcast?.();
        ACIControl?.reply('Collab mode — visible on map for all signed-in users');
        return { handled: true };
      }
      if (cmd === 'team') {
        await window.MapComms?.cmd?.(parts);
        return { handled: true };
      }
      if (cmd === 'drivers') {
        const txt = MarketplaceComms?.listDriversText?.() || 'No drivers — order first';
        ACIControl?.reply(txt);
        AciCli?.print(txt, 'ok');
        return { handled: true };
      }
      if (cmd === 'driver' && parts[1]) {
        const q = parts.slice(1).join(' ').toLowerCase();
        const pool = MarketplaceComms?.state?.drivers || [];
        const hit = pool.find(d => (d.display_name || '').toLowerCase().includes(q));
        if (hit) {
          await MarketplaceComms?.selectDriver?.(hit.id);
        } else {
          ACIControl?.reply('No driver matching «' + parts.slice(1).join(' ') + '» — try drivers');
        }
        return { handled: true };
      }
      if (cmd === 'profile') {
        await ProfileSite?.cmd?.(parts);
        return { handled: true };
      }
      if (cmd === 'booker') {
        await YachtMatcher?.bookerCli?.(parts);
        return { handled: true };
      }
      if (cmd === 'yacht' || cmd === 'yachts' || cmd === 'charter' || (cmd === 'match' && (parts[2] || '').toLowerCase() === 'yachts')) {
        await YachtMatcher?.cli?.(parts);
        return { handled: true };
      }
      if (cmd === 'auditor' || cmd === 'auditors' || cmd === 'audit') {
        await AuditorPortal?.cli?.(parts);
        return { handled: true };
      }
      if (cmd === 'brain' || cmd === 'converse' || cmd === 'talk') {
        await BrainConversation?.cli?.(parts);
        return { handled: true };
      }
      if (cmd === 'db' || cmd === 'database' || cmd === 'onedb') {
        await AstranovOneDatabase?.cli?.(parts);
        return { handled: true };
      }
      if (cmd === 'unified' || cmd === 'astranov' || cmd === 'platform') {
        await AstranovUnified?.cli?.(parts);
        return { handled: true };
      }
      if (cmd === 'coin' || cmd === 'wallet' || cmd === 'money') {
        await CoinPortal?.cli?.(parts.length > 1 && cmd === 'coin' ? parts : ['coin', ...parts.slice(1)]);
        return { handled: true };
      }
      if (cmd === 'avc') {
        await AvcJustice?.cli?.(parts);
        return { handled: true };
      }
      if (cmd === 'ledger' || cmd === 'justice') {
        await AvcJustice?.cli?.(['avc', cmd, ...parts.slice(1)]);
        return { handled: true };
      }
      if (cmd === 'hellenic' || cmd === 'hellas') {
        HellenicSource?.cli?.(parts);
        return { handled: true };
      }
      if (cmd === 'book' && /^\d{4}-\d{2}-\d{2}/.test(parts[1] || '')) {
        await YachtMatcher?.cli?.(['yacht', 'book', ...parts.slice(1)]);
        return { handled: true };
      }
      if (cmd === 'site' || cmd === 'sites' || cmd === 'book') {
        await AstranovSitesProvision?.cli?.(parts);
        return { handled: true };
      }
      if (cmd === 'cli') {
        await CliHub?.cmd?.(parts);
        return { handled: true };
      }
      if (cmd === 'cloud' && (parts[1] || '').toLowerCase() === 'dm') {
        await CliHub?.startPrivateCloud?.(parts.slice(2).join(' '));
        return { handled: true };
      }
      if (cmd === 'chat' && parts[1]) {
        const msg = parts.slice(2).join(' ');
        if (msg && window.MapComms?.dmUser && window.MapComms?.kind === 'dm') {
          window.MapComms.sendMessage(msg);
        } else {
          await CliHub?.startPrivateCloud?.(parts[1]);
          if (msg) window.MapComms?.sendMessage?.(msg);
        }
        return { handled: true };
      }
      if (cmd === 'contact') {
        await window.MapComms?.contactCmd?.(parts);
        return { handled: true };
      }
      if (cmd === 'msg' && parts[1]) {
        window.MapComms?.sendMessage?.(parts.slice(1).join(' '));
        return { handled: true };
      }
      if (cmd === 'city' || cmd === 'cityview') {
        await enterCityView?.();
        return { handled: true };
      }
      if (cmd === 'stars' || cmd === 'constellations' || cmd === 'constellation' || cmd === 'nav') {
        ZoomTiers?.goTo?.('global', true);
        CelestialNav?.printReport?.();
        return { handled: true };
      }
      if (cmd === 'hold' || cmd === 'pause') {
        SessionHold?.hold?.();
        return { handled: true };
      }
      if (cmd === 'resume' || cmd === 'unhold') {
        await SessionHold?.resume?.();
        return { handled: true };
      }
      if (cmd === 'stop') {
        userIntervene?.();
        return { handled: true };
      }
      if (cmd === 'youtube' || cmd === 'yt') {
        await GlobeVideo?.find?.(rest || parts.slice(1).join(' '));
        return { handled: true };
      }
      if (cmd === 'watch' || cmd === 'play') {
        const arg = rest || parts[1] || '';
        if (/^\d+$/.test(arg)) { await GlobeVideo?.playIndex?.(arg); return { handled: true }; }
        const id = GlobeVideo?.parseId?.(arg);
        if (id) { await GlobeVideo?.play?.(id, { title: arg }); return { handled: true }; }
        if (arg) await GlobeVideo?.find?.(arg);
        else ACIControl?.reply('usage: watch <url|#> · play 2');
        return { handled: true };
      }
      if (GlobeVideo?.wantsYoutube?.(raw)) {
        const q = GlobeVideo.queryFromText(raw);
        if (q) await GlobeVideo.find(q);
        return { handled: true };
      }

      if (this.devMode && !this.isStructuredCmd(cmd)) {
        await this.devBrain(raw);
        return { handled: true };
      }
    } catch (e) {
      GlobeDeck?.setThinking(false);
      const msg = 'exec error: ' + (e.message || e);
      this.out(msg, 'err');
      GlobeDeck?.showError(msg);
      return { handled: true, error: msg };
    }

    return { handled: false };
  },
});

const _superInit = SuperCli.init.bind(SuperCli);
SuperCli.init = function () {
  _superInit();
  SuperCli.initBrain();
};

// === CLI HUB — cloud transcripts · search users/chats · private cloud DM ===
const CliHub = {
  _pending: [],
  _flushTimer: null,
  _viewUserId: null,
  _searchDebounce: null,

  init() {
    this._bindUi();
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange((_e, s) => {
        if (s?.user) this._subscribe();
        else this._viewUserId = null;
      });
    }
    setTimeout(() => { if (Auth?.user) this._subscribe(); }, 2000);
  },

  async api(body) {
    const headers = Auth?.authHeaders ? await Auth.authHeaders() : { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
    const r = await fetch(SB_URL + '/functions/v1/cli-hub', {
      method: 'POST', headers,
      body: JSON.stringify(body),
    });
    return r.json().catch(() => ({ error: 'network' }));
  },

  canViewAll() {
    return !!(AstranovSession?.isAstranov?.() || Auth?.isOwner);
  },

  queueLine(line, cls, opts) {
    if (!Auth?.user || !line) return;
    opts = opts || {};
    this._pending.push({
      line: String(line).slice(0, 2000),
      cls: String(cls || 'out').slice(0, 24),
      circle_id: opts.circle_id || window.MapComms?.teamId || null,
      peer_id: opts.peer_id || window.MapComms?.dmUser?.id || null,
    });
    if (this._pending.length > 32) this._pending = this._pending.slice(-32);
    if (!this._flushTimer) {
      this._flushTimer = setTimeout(() => this._flush(), 1800);
    }
  },

  async _flush() {
    this._flushTimer = null;
    if (!this._pending.length || !Auth?.user) return;
    const batch = this._pending.splice(0, 24);
    await this.api({ action: 'append', lines: batch });
  },

  _bindUi() {
    const search = document.getElementById('cli-hub-search');
    const btn = document.getElementById('cli-hub-search-btn');
    if (search && !search.dataset.bound) {
      search.dataset.bound = '1';
      search.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); this.runSearch(search.value); }
        if (e.key === 'Escape') this.closePanel();
      });
      search.addEventListener('input', () => {
        clearTimeout(this._searchDebounce);
        const q = search.value.trim();
        if (q.length < 2) return;
        this._searchDebounce = setTimeout(() => this.runSearch(q), 420);
      });
    }
    if (btn && !btn.dataset.bound) {
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => {
        const q = document.getElementById('cli-hub-search')?.value?.trim();
        if (q) this.runSearch(q);
        else this.openPanel();
      });
    }
    const panel = document.getElementById('cli-hub-panel');
    if (panel && !panel.dataset.bound) {
      panel.dataset.bound = '1';
      panel.addEventListener('click', (e) => {
        const el = e.target.closest('[data-ch-action]');
        if (!el) return;
        const act = el.dataset.chAction;
        const uid = el.dataset.chUser;
        const cid = el.dataset.chCircle;
        if (act === 'view' && uid) this.viewUser(uid);
        if (act === 'dm' && uid) this.startPrivateCloud(uid);
        if (act === 'chat' && cid) window.MapComms?.joinTeam?.(cid);
      });
    }
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  openPanel() {
    GlobeDeck?.showStage?.('cli-hub-panel', 'chats');
    GlobeDeck?.expand?.('CLI · search');
    document.getElementById('cli-hub-bar')?.classList.add('open');
    document.getElementById('cli-hub-search')?.focus();
    if (this.canViewAll()) this.listUsers();
  },

  closePanel() {
    document.getElementById('cli-hub-bar')?.classList.remove('open');
    const panel = document.getElementById('cli-hub-panel');
    if (panel) panel.classList.remove('deck-active');
    if (GlobeDeck?.activeTask === 'chats') GlobeDeck?.completeTask?.('chats');
  },

  async listUsers() {
    const r = await this.api({ action: 'users' });
    const box = document.getElementById('cli-hub-results');
    if (!box) return;
    if (!r.ok) {
      box.innerHTML = '<div class="ch-empty">' + this.esc(r.error || 'login required') + '</div>';
      return;
    }
    const head = this.canViewAll()
      ? '<div class="ch-head">◎ All users · cloud CLI' + (r.owner ? ' · owner view' : '') + '</div>'
      : '<div class="ch-head">◎ Players on field</div>';
    box.innerHTML = head + (r.users || []).map((u) => {
      const last = u.last_cli?.line ? u.last_cli.line.slice(0, 72) : '—';
      return '<button type="button" class="ch-row" data-ch-action="view" data-ch-user="' + this.esc(u.id) + '">'
        + '<span class="ch-name">' + this.esc(u.emoji) + ' ' + this.esc(u.name) + (u.self ? ' · you' : '') + (u.live ? ' · live' : '') + '</span>'
        + '<span class="ch-sub">' + this.esc(last) + '</span>'
        + '<span class="ch-actions">'
        + '<span class="ch-link" data-ch-action="dm" data-ch-user="' + this.esc(u.id) + '">cloud dm</span>'
        + '</span></button>';
    }).join('') || '<div class="ch-empty">No live users — invite sign-in</div>';
    this.openPanel();
  },

  async runSearch(q) {
    q = String(q || '').trim();
    if (q.length < 2) {
      ACIControl?.reply('Search: 2+ chars — users · chats · CLI lines');
      return;
    }
    const r = await this.api({ action: 'search', q });
    const box = document.getElementById('cli-hub-results');
    if (!box) return;
    if (!r.ok) {
      box.innerHTML = '<div class="ch-empty">' + this.esc(r.error) + '</div>';
      this.openPanel();
      return;
    }
    let html = '<div class="ch-head">Search · «' + this.esc(q) + '»</div>';
    if (r.users?.length) {
      html += '<div class="ch-section">Users</div>';
      html += r.users.map((u) =>
        '<button type="button" class="ch-row" data-ch-action="view" data-ch-user="' + this.esc(u.id) + '">'
        + '<span class="ch-name">' + this.esc(u.emoji) + ' ' + this.esc(u.name) + '</span>'
        + '<span class="ch-link" data-ch-action="dm" data-ch-user="' + this.esc(u.id) + '">cloud dm →</span></button>'
      ).join('');
    }
    if (r.chats?.length) {
      html += '<div class="ch-section">Conversations</div>';
      html += r.chats.slice(0, 12).map((c) =>
        '<button type="button" class="ch-row" data-ch-action="chat" data-ch-circle="' + this.esc(c.circle_id) + '">'
        + '<span class="ch-name">' + this.esc(c.author || '?') + '</span>'
        + '<span class="ch-sub">' + this.esc(c.text?.slice(0, 80)) + '</span></button>'
      ).join('');
    }
    if (r.cli_lines?.length) {
      html += '<div class="ch-section">CLI lines</div>';
      html += r.cli_lines.slice(0, 10).map((l) =>
        '<div class="ch-line deck-' + this.esc(l.cls || 'out') + '">'
        + '<button type="button" class="ch-mini" data-ch-action="view" data-ch-user="' + this.esc(l.user_id) + '">view</button> '
        + this.esc(l.line?.slice(0, 120)) + '</div>'
      ).join('');
    }
    if (!r.users?.length && !r.chats?.length && !r.cli_lines?.length) {
      html += '<div class="ch-empty">No matches</div>';
    }
    box.innerHTML = html;
    this.openPanel();
    AciCli?.print?.('search · ' + q + ' · ' + (r.users?.length || 0) + ' users', 'dim');
  },

  async viewUser(userId) {
    if (!userId) return;
    const owner = this.canViewAll();
    if (userId !== Auth?.user?.id && !owner) {
      ACIControl?.reply('Owner only — or view your own CLI');
      return;
    }
    const r = await this.api({ action: 'feed', user_id: userId, limit: 50 });
    if (!r.ok) {
      AciCli?.print('view failed · ' + (r.error || '?'), 'err');
      return;
    }
    this._viewUserId = userId;
    const name = r.user?.display_name || String(userId).slice(0, 8);
    GlobeDeck?.clearLog?.();
    GlobeDeck?.expand('CLI · ' + name + (r.owner_view ? ' · owner' : ''));
    AciCli?.print('── Cloud CLI · ' + name + ' ──', 'dim');
    (r.lines || []).forEach((row) => {
      GlobeDeck?.log?.(row.line, row.cls || 'out');
    });
    if (!(r.lines || []).length) AciCli?.print('(no cloud lines yet)', 'dim');
    CliRibbon?.setActive?.('CLI · ' + name);
  },

  async startPrivateCloud(targetRef) {
    if (!Auth?.user) {
      Auth?.openLoginModal?.('Sign in for CLI hub');
      return;
    }
    let targetId = String(targetRef || '');
    if (!targetId.match(/^[0-9a-f-]{36}$/i)) {
      const q = targetRef.toLowerCase();
      const hit = (window.others || []).find((u) => (u.name || '').toLowerCase().includes(q))
        || [...(window.MapComms?.members?.values() || [])].find((u) => (u.name || '').toLowerCase().includes(q));
      if (hit?.id) targetId = hit.id;
      else {
        const sr = await this.api({ action: 'search', q: targetRef });
        if (sr.users?.[0]?.id) targetId = sr.users[0].id;
      }
    }
    if (!targetId) {
      ACIControl?.reply('User not found — search name in CLI hub');
      return;
    }
    const r = await this.api({ action: 'open_dm', target_user_id: targetId });
    if (!r.ok) {
      AciCli?.print('dm failed · ' + (r.error || '?'), 'err');
      return;
    }
    const target = {
      id: r.target.id,
      name: r.target.display_name || 'User',
      lat: r.target.field_lat,
      lng: r.target.field_lng,
      emoji: r.target.avatar_emoji || '👤',
    };
    const msgs = (r.messages || []).map((m) => ({
      author: m.author || '?',
      body: m.text,
      t: m.ts || Date.now(),
      author_id: m.author_id,
    }));
    await window.MapComms?.openPrivateCloud?.({
      circleId: r.circle_id,
      target,
      messages: msgs,
    });
    AciCli?.print('◎ Private cloud · ' + target.name + ' · mapdm open', 'ok');
    ACIControl?.reply('Cloud DM with ' + target.name + ' — type in cloud or: chat ' + target.name + ' <message>');
  },

  async cmd(parts) {
    const sub = (parts[1] || 'help').toLowerCase();
    const rest = parts.slice(2).join(' ').trim();
    if (sub === 'search' && rest) return this.runSearch(rest);
    if (sub === 'users' || sub === 'list') return this.listUsers();
    if (sub === 'view' && rest) {
      const q = rest.toLowerCase();
      if (q === 'me' || q === 'self') return this.viewUser(Auth.user.id);
      const sr = await this.api({ action: 'search', q: rest });
      const uid = sr.users?.[0]?.id;
      if (uid) return this.viewUser(uid);
      AciCli?.print('no user · ' + rest, 'err');
      return;
    }
    if (sub === 'dm' && rest) return this.startPrivateCloud(rest);
    if (sub === 'open') { this.openPanel(); return; }
    AciCli?.print([
      'cli search <text> — users · chats · CLI lines',
      'cli users — live roster' + (this.canViewAll() ? ' (owner: all CLIs)' : ''),
      'cli view <name> — cloud transcript',
      'cli dm <name> — private cloud conversation',
      'cloud dm <name> — same',
    ].join('\n'), 'ok');
  },

  _subscribe() {
    if (!Auth?.client || this._rtChannel) return;
    if (!this.canViewAll()) return;
    this._rtChannel = Auth.client.channel('cli-hub-owner');
    this._rtChannel.on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'cli_transcripts',
    }, ({ new: row }) => {
      if (!row || row.user_id === Auth?.user?.id) return;
      if (this._viewUserId === row.user_id) {
        GlobeDeck?.log?.(row.line, row.cls || 'out');
      }
    });
    this._rtChannel.subscribe();
  },
};

window.CliHub = CliHub;

// === CONTEXT TRUTH — visual mirror of auth · channel · game · compromise ===
const ContextTruth = {
  compromised: null,
  _lastLabel: '',

  AUTH_KEEP: new Set(['astranov_auth_v2']),

  init() {
    setInterval(() => this.sync(), 2500);
    window.addEventListener('astranov-context', () => this.sync());
  },

  infer() {
    if (window.MapComms?.compromised || this.compromised) {
      const c = window.MapComms?.compromised || this.compromised;
      return {
        mode: 'compromised',
        ctx: 'compromised',
        label: '⚠ COMPROMISED · ' + (c.name || c.id?.slice(0, 8) || '?'),
        detail: 'Intruder: ' + (c.name || 'unknown'),
        intruder: c,
      };
    }
    if (AstranovPresence?.game === 'kryfto' || WillaGames?.active === 'kryfto') {
      const hidden = !!window.hidden;
      return {
        mode: 'game',
        ctx: 'game',
        label: hidden ? 'ΚΡΥΦΤό · hidden' : 'ΚΡΥΦΤό · hide & seek',
        detail: hidden ? 'You are hidden on the map' : 'ΣΥΓΥΡΙΣΜΑ · κρυφτό LIVE',
      };
    }
    if (AstranovPresence?.game === 'pyramid' || WillaGames?.active === 'pyramid') {
      return {
        mode: 'game',
        ctx: 'game',
        label: '🔺 Pyramid hunt',
        detail: 'Find apex markers · Giza · Rhodes · Chichen Itza',
      };
    }
    if (AstranovPresence?.game === 'willa' || WillaGames?.active === 'willa') {
      return {
        mode: 'game',
        ctx: 'game',
        label: '⚔ Willa game',
        detail: 'Olympians 🔵 vs Cronians 🔴 · Kronos leads red · multi-domain warfare',
      };
    }
    if (window.MapComms?.teamId && window.MapComms?.kind === 'dm' && window.MapComms?.dmUser) {
      return {
        mode: 'dm',
        ctx: 'dm',
        label: 'DM · ' + (window.MapComms.dmUser.name || 'User'),
        detail: 'Private cloud · ' + (window.MapComms.teamId || ''),
        peer: window.MapComms.dmUser,
      };
    }
    if (window.MapComms?.teamId && window.MapComms?.kind === 'team') {
      return {
        mode: 'team',
        ctx: 'team',
        label: 'Team · ' + (window.MapComms.teamName || 'Cloud'),
        detail: (window.MapComms.members?.size || 0) + ' on map cloud',
      };
    }
    if (MarketplaceComms?.teamId) {
      return {
        mode: 'market',
        ctx: 'commerce',
        label: 'Delivery · ' + (MarketplaceComms.teamName || 'order'),
        detail: 'Marketplace cloud',
      };
    }
    const task = GlobeDeck?.activeTask;
    if (task === 'coders' || window._aciCodersAlwaysOn) {
      return { mode: 'coders', ctx: 'coders', label: 'Coders · collective', detail: 'Task conversation · dev bridge' };
    }
    if (task === 'chats') {
      return { mode: 'chats', ctx: 'chats', label: 'CLI hub · search', detail: 'Users · conversations · transcripts' };
    }
    if (task === 'commerce') {
      return { mode: 'commerce', ctx: 'commerce', label: 'Shops · order', detail: 'Commerce task' };
    }
    if (task === 'batch') {
      return { mode: 'batch', ctx: 'batch', label: 'Batch · node', detail: 'Collaborative task' };
    }
    if (task === 'radio') {
      return { mode: 'radio', ctx: 'radio', label: 'PMR · radio', detail: 'VHF comms task' };
    }
    if (task === 'phone') {
      return { mode: 'phone', ctx: 'phone', label: 'Phone · call', detail: 'Voice call task' };
    }
    if (task === 'video') {
      return { mode: 'video', ctx: 'video', label: 'Video', detail: 'YouTube / video task' };
    }
    if (task === 'add') {
      return { mode: 'add', ctx: 'add', label: 'Super Add', detail: 'Post · vendor · site' };
    }
    if (GhostTravel?.active?.() && GhostTravel._target) {
      return {
        mode: 'travel',
        ctx: 'travel',
        label: '→ ' + GhostTravel._target.city,
        detail: 'Ghost route · ±' + GhostTravel.SCRAMBLE_KM + ' km mask · ' + GhostTravel.SPEED_KMH + ' km/h',
      };
    }
    if (TelemachosPilot?.edition && (GlobeDeck?.activeTask === 'telemachos' || window._pilot)) {
      return {
        mode: 'telemachos',
        ctx: 'telemachos',
        label: (TelemachosPilot.edition.name_gr || 'ΤΗΛΕΜΑΧΟΣ') + ' · pilot',
        detail: 'In-game drone field',
      };
    }
    if (DrivingView?.active) {
      return { mode: 'drive', ctx: 'drive', label: 'Drive · navigate', detail: 'Road routing' };
    }
    if (!Auth?.user) {
      return { mode: 'guest', ctx: 'guest', label: 'Guest · sign in', detail: 'Not authenticated' };
    }
    return { mode: 'cli', ctx: 'idle', label: 'CLI · central', detail: 'Astranov command line' };
  },

  syncAuth() {
    this.sync();
  },

  setCompromised(intruder) {
    this.compromised = intruder || null;
    if (intruder) {
      CliRibbon?.setNotice?.('⚠ compromised · ' + (intruder.name || '?'), 'err');
      window.MapComms?._applyCloudTruth?.();
    }
    this.sync();
  },

  clearCompromised() {
    this.compromised = null;
    if (window.MapComms) window.MapComms.compromised = null;
    window.MapComms?._applyCloudTruth?.();
    CliRibbon?.clearNotice?.();
    this.sync();
  },

  sync() {
    const ctx = this.infer();
    const bar = document.getElementById('super-cli-bar');
    const deck = document.getElementById('globe-deck');
    if (bar) {
      bar.dataset.truth = ctx.ctx;
      bar.dataset.mode = ctx.mode;
    }
    if (deck) deck.dataset.truth = ctx.mode;

    const cloud = document.getElementById('map-comms-cloud');
    if (cloud?.classList.contains('open')) {
      cloud.dataset.truth = ctx.mode === 'compromised' ? 'compromised' : (window.MapComms?.kind || 'team');
      this._renderCloudBadge(ctx);
    }

    const label = ctx.label;
    if (label !== this._lastLabel) {
      this._lastLabel = label;
      CliRibbon?.setActive?.(label);
      if (GlobeDeck?.expanded && ctx.mode !== 'cli' && ctx.mode !== 'idle' && ctx.mode !== 'guest') {
        GlobeDeck?.setPreview?.(ctx.detail);
      }
    }
    SuperCli?.setContext?.(ctx.ctx);
    CliRibbon?.render?.();
    this._renderAuthChip(ctx);
  },

  _renderAuthChip(ctx) {
    const chip = document.getElementById('user-chip');
    if (!chip || !Auth?.user) return;
    const channel = ctx.mode === 'compromised' ? ' · ⚠ INTRUSION'
      : ctx.mode === 'dm' ? ' · DM'
      : ctx.mode === 'team' ? ' · TEAM'
      : ctx.mode === 'game' ? ' · ΚΡΥΦΤό'
      : ctx.mode === 'telemachos' ? ' · PILOT'
      : ctx.mode === 'coders' ? ' · CODERS'
      : '';
    if (!AstranovSession?.isAstranov?.() && !Auth.isOwner && channel) {
      const base = chip.textContent?.split(' · ')[0] || Auth.user.email?.split('@')[0] || 'User';
      chip.textContent = (base + channel).slice(0, 52);
      chip.title = ctx.detail || ctx.label;
    }
  },

  _renderCloudBadge(ctx) {
    let badge = document.getElementById('mc-badge');
    const head = document.getElementById('mc-head');
    if (!head) return;
    if (!badge) {
      badge = document.createElement('span');
      badge.id = 'mc-badge';
      head.insertBefore(badge, head.querySelector('#mc-close'));
    }
    if (ctx.mode === 'compromised' && ctx.intruder) {
      badge.className = 'mc-badge mc-badge-alert';
      badge.innerHTML = '⚠ <button type="button" class="mc-intruder" data-intruder="' + (ctx.intruder.id || '') + '">'
        + String(ctx.intruder.name || 'intruder').replace(/[<>&"]/g, '') + '</button>';
      badge.querySelector('.mc-intruder')?.addEventListener('click', () => {
        CliHub?.viewUser?.(ctx.intruder.id);
        ACIControl?.reply('Compromised cloud — intruder: ' + (ctx.intruder.name || ctx.intruder.id));
      });
    } else if (window.MapComms?.kind === 'dm') {
      badge.className = 'mc-badge mc-badge-dm';
      badge.textContent = '🔒 private';
    } else if (window.MapComms?.kind === 'team') {
      badge.className = 'mc-badge mc-badge-team';
      badge.textContent = '◎ team';
    } else {
      badge.className = 'mc-badge';
      badge.textContent = '';
    }
  },
};
window.ContextTruth = ContextTruth;

// === ACI CONNECT — link architect to collective AI for deployment ===
const AciConnect = {
  connected: false,
  sessionId: null,

  async open() {
    if (!Auth?.user) {
      ACIControl?.reply('Sign in with G — then collective AI opens');
      Auth.openLoginModal?.('Sign in to connect');
      return null;
    }
    if (window.AciCli) AciCli.show();
    await Auth.refreshAuthority();
    return this.connect(true);
  },

  async connect(speakGreeting) {
    if (!Auth?.user) {
      ACIControl?.reply('Login required for collective connection');
      return { error: 'login required' };
    }
    GlobeDeck?.setThinking(true, 'Connecting…');

    const sync = await AciCli.api({ mode: 'owner_sync' });
    if (sync.is_owner) Auth.isOwner = true;

    const conn = await AciCli.api({
      mode: 'connect',
      deploy_context: true,
      architect: Auth.OWNER_EMAIL
    });

    this.connected = !!(conn.ok && conn.connected);
    this.sessionId = AstranovSession?.SESSION_NAME || 'ASTRANOV COLLECTIVE INTELLIGENCE';
    window._aciConnected = this.connected;
    GlobeDeck?.setThinking(false);

    const greeting = conn.greeting || (this.connected ? 'ACI connected.' : 'Connect failed: ' + (conn.error || 'unknown'));
    if (this.connected) {
      ACIControl?.reply(greeting.slice(0, 220));
      if (speakGreeting && Voice.maySpeak() && Voice.shouldSpeak(greeting)) {
        speak(greeting.slice(0, 120), () => resumeListening());
      }
    } else if (AciCli) {
      AciCli.print(greeting, 'err');
    }
    GlobeDeck?.setMapStatus(this.connected ? 'ACI linked' : 'connect failed');
    return conn;
  },

  async deploy(task) {
    if (!Auth?.isOwner) {
      const msg = 'Owner only — login as notisastranov@gmail.com';
      if (AciCli) AciCli.print(msg, 'err');
      return null;
    }
    if (!this.connected) await this.connect(false);
    if (AciCli) AciCli.print('deploy → collective AI: ' + (task || 'continue batch'), 'dim');
    const r = await AciCli.api({
      mode: 'deploy',
      task: task || 'continue deployment from streets',
      session_id: this.sessionId
    });
    const text = r.plan || r.text || r.response || r.error || '';
    if (AciCli) AciCli.print(text.slice(0, 800), r.ok ? 'out' : 'err');
    ACIControl?.reply(text.slice(0, 220));
    if (Voice.maySpeak() && Voice.shouldSpeak(text)) speak(text.slice(0, 120));
    return r;
  }
};
window.AciConnect = AciConnect;

// === DELIVERY PRICING + WEATHER + GOOGLE WALLET ===
const DeliveryPricing = {
  PLATFORM_RATE: 0.03,
  BASE_DELIVERY_EUR: 3,
  BLOCK_EUR: 3,
  KM_BLOCK: 3,
  KG_BLOCK: 3,
  INCLUDED_KM: 3,
  INCLUDED_KG: 3,
  SURCHARGE_EUR: 3,

  _cache: null,
  _cacheAt: 0,

  blockFee(units, blockSize) {
    const extra = Math.max(0, units - blockSize);
    if (extra <= 0) return 0;
    return Math.ceil(extra / blockSize) * this.BLOCK_EUR;
  },

  isNightOrMorning(date) {
    const h = (date || new Date()).getHours();
    return h < 9 || h >= 21;
  },

  async fetchWeather(lat, lng) {
    const now = Date.now();
    if (this._cache && now - this._cacheAt < 600000) return this._cache;
    try {
      const url = 'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng
        + '&current=weather_code,precipitation,wind_speed_10m&timezone=auto';
      const r = await fetch(url);
      const j = await r.json();
      const c = j.current || {};
      const code = c.weather_code ?? 0;
      const precip = c.precipitation ?? 0;
      const wind = c.wind_speed_10m ?? 0;
      const bad = precip > 0.4 || wind > 40 || [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 71, 73, 75, 77, 80, 81, 82, 85, 86, 95, 96, 99].includes(code);
      this._cache = { bad, precip, wind, code, at: now };
      this._cacheAt = now;
      return this._cache;
    } catch (_) {
      return { bad: false, precip: 0, wind: 0, code: 0 };
    }
  },

  async quote(opts) {
    opts = opts || {};
    const km = Math.max(0, Number(opts.km) || 0);
    const kg = Math.max(0, Number(opts.kg) || 3);
    const subtotal = Math.max(0, Number(opts.subtotal_eur) || 0);
    const when = opts.at ? new Date(opts.at) : new Date();
    const weather = opts.weather || (opts.lat != null ? await this.fetchWeather(opts.lat, opts.lng) : { bad: false });

    const distanceFee = this.BASE_DELIVERY_EUR + this.blockFee(km, this.KM_BLOCK);
    const weightFee = this.blockFee(kg, this.KG_BLOCK);
    let surcharges = [];
    if (this.isNightOrMorning(when)) surcharges.push({ id: 'night_morning', label: 'Night / before 09:00', eur: this.SURCHARGE_EUR });
    if (weather.bad) surcharges.push({ id: 'weather', label: 'Bad weather', eur: this.SURCHARGE_EUR });

    const deliveryEur = distanceFee + weightFee + surcharges.reduce((s, x) => s + x.eur, 0);
    const goodsEur = subtotal;
    const platformEur = Math.round((goodsEur + deliveryEur) * this.PLATFORM_RATE * 100) / 100;
    const totalEur = Math.round((goodsEur + deliveryEur + platformEur) * 100) / 100;
    const driverPayoutEur = Math.round(deliveryEur * 0.85 * 100) / 100;

    return {
      currency: 'AVC',
      peg_eur: 1,
      km, kg,
      subtotal_eur: goodsEur,
      delivery_eur: deliveryEur,
      distance_fee_eur: distanceFee,
      weight_fee_eur: weightFee,
      surcharges,
      platform_fee_eur: platformEur,
      platform_rate: this.PLATFORM_RATE,
      total_eur: totalEur,
      total_avc: totalEur,
      driver_payout_eur: driverPayoutEur,
      weather,
      invoice_note: 'Monthly invoice · platform 3% · driver paid on delivery',
    };
  },

  formatQuote(q) {
    if (!q) return '';
    let s = q.total_avc.toFixed(2) + ' AVC (= ' + q.total_eur.toFixed(2) + ' EUR)';
    s += ' · delivery ' + q.delivery_eur.toFixed(2);
    if (q.surcharges?.length) s += ' · ' + q.surcharges.map(x => x.label).join(', ');
    s += ' · fee 3%';
    return s;
  },
};

const GoogleWalletPay = {
  supported() {
    try {
      return typeof PaymentRequest !== 'undefined';
    } catch (_) { return false; }
  },

  async pay(amountEur, label, opts) {
    opts = opts || {};
    if (!this.supported()) throw new Error('Google Pay / Wallet not available in this browser');
    const total = Math.max(0.01, Number(amountEur) || 0);
    const methods = [{
      supportedMethods: 'https://google.com/pay',
      data: {
        environment: opts.test ? 'TEST' : 'PRODUCTION',
        apiVersion: 2,
        apiVersionMinor: 0,
        allowedPaymentMethods: [{
          type: 'CARD',
          parameters: {
            allowedAuthMethods: ['PAN_ONLY', 'CRYPTOGRAM_3DS'],
            allowedCardNetworks: ['MASTERCARD', 'VISA'],
          },
          tokenizationSpecification: {
            type: 'PAYMENT_GATEWAY',
            parameters: { gateway: 'example', gatewayMerchantId: 'astranov' },
          },
        }],
        merchantInfo: { merchantName: 'Astranov', merchantId: opts.merchantId || 'astranov' },
        transactionInfo: {
          totalPriceStatus: 'FINAL',
          totalPrice: total.toFixed(2),
          currencyCode: 'EUR',
          countryCode: 'GR',
        },
      },
    }];
    const fallback = [{
      supportedMethods: 'basic-card',
      data: { supportedNetworks: ['visa', 'mastercard'], supportedTypes: ['debit', 'credit'] },
    }];
    let pr;
    try {
      pr = new PaymentRequest(methods, { total: { label: label || 'Astranov order', amount: { currency: 'EUR', value: total.toFixed(2) } } });
      const can = await pr.canMakePayment();
      if (!can) pr = new PaymentRequest(fallback, { total: { label: label || 'Astranov order', amount: { currency: 'EUR', value: total.toFixed(2) } } });
    } catch (_) {
      pr = new PaymentRequest(fallback, { total: { label: label || 'Astranov order', amount: { currency: 'EUR', value: total.toFixed(2) } } });
    }
    const resp = await pr.show();
    const detail = {
      method: resp.methodName,
      paid: true,
      amount_eur: total,
      at: new Date().toISOString(),
      wallet: /google/i.test(resp.methodName || '') ? 'google_wallet' : 'card',
    };
    await resp.complete('success');
    return detail;
  },
};

window.DeliveryPricing = DeliveryPricing;
window.GoogleWalletPay = GoogleWalletPay;

function resizeCliInput(el) {
  if (!el) return;
  el.style.height = 'auto';
  const max = Math.min(window.innerHeight * 0.38, 220);
  el.style.height = Math.min(Math.max(el.scrollHeight, 40), max) + 'px';
}
window.resizeCliInput = resizeCliInput;

// ── COMMERCE: real vendors, real menus only, smart order on globe ──
const ORDER_ITEM_ALIASES = [
  { id: 'pita', label: 'Πιτογύρα', keys: ['πιτογυρ', 'πιτογύρα', 'pitogyra', 'pita', 'πιτο', 'gyro', 'γύρο', 'gyros', 'pitogyro'], match: /πιτο|pita|gyro|γύρο|pitogyra|pitogyro/i },
  { id: 'beer', label: 'Μπύρα', keys: ['μπυρ', 'μπίρ', 'mpira', 'mpironia', 'mpironi', 'beer', 'beers', 'μπύρες'], match: /μπύρ|μπυρ|beer|lager|αμστελ|heineken|mpironi/i },
  { id: 'cigarettes', label: 'Τσιγάρα', keys: ['τσιγαρ', 'tsigar', 'tsigareta', 'cigarette', 'cigarettes', 'μαλαμ'], match: /τσιγαρ|cigar|μαλαμ|marlboro|winston/i },
  { id: 'burger', label: 'Burger', keys: ['burger', 'burgers', 'μπεργκερ', 'χάμπουργκερ', 'hamburger'], match: /burger|μπεργκ|hamburger|χάμπουρ/i },
  { id: 'water', label: 'Νερό', keys: ['νερ', 'nero', 'water'], match: /νερό|νερο|water/i },
];

const TEAM_WIN_ITEM_IDS = new Set(['pita', 'beer', 'cigarettes', 'burger']);

// === ASTRANOV CITY SHOP — virtual under-construction shop at each login city center ===
const AstranovCityShop = {
  LOGO: '/icon.svg',
  _cache: new Map(),
  _current: null,

  _tags(v) {
    let t = v?.tags;
    if (typeof t === 'string') { try { t = JSON.parse(t); } catch { t = {}; } }
    return (t && typeof t === 'object') ? t : {};
  },

  cityKey(city, lat, lng) {
    const c = String(city || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return c || ('loc-' + lat.toFixed(2) + '-' + lng.toFixed(2));
  },

  async resolveCityCenter(lat, lng) {
    const probe = `${lat.toFixed(3)}_${lng.toFixed(3)}`;
    if (this._cache.has(probe)) return this._cache.get(probe);
    let out = null;
    try {
      const url = 'https://nominatim.openstreetmap.org/reverse?lat=' + encodeURIComponent(lat)
        + '&lon=' + encodeURIComponent(lng) + '&format=json&addressdetails=1&zoom=10';
      const r = await fetch(url, {
        headers: { Accept: 'application/json', 'User-Agent': 'Astranov/1.0 (astranov.eu; city-shop)' },
      });
      if (r.ok) {
        const data = await r.json();
        const addr = data.address || {};
        const city = addr.city || addr.town || addr.village || addr.municipality || addr.county || data.name || 'Your city';
        let cLat = lat;
        let cLng = lng;
        const bb = data.boundingbox;
        if (bb && bb.length === 4) {
          cLat = (parseFloat(bb[0]) + parseFloat(bb[1])) / 2;
          cLng = (parseFloat(bb[2]) + parseFloat(bb[3])) / 2;
        }
        out = { lat: cLat, lng: cLng, city, cityKey: this.cityKey(city, cLat, cLng) };
      }
    } catch (_) {}
    if (!out) out = { lat, lng, city: 'Your city', cityKey: this.cityKey('', lat, lng) };
    this._cache.set(probe, out);
    return out;
  },

  buildVendor(center) {
    const city = center.city || 'Your city';
    return {
      id: 'astranov-city-' + center.cityKey,
      name: 'Astranov Shop',
      emoji: '🏬',
      lat: center.lat,
      lng: center.lng,
      category: 'field_shop',
      is_active: true,
      delivery_enabled: false,
      under_construction: true,
      tags: {
        profile_url: this.LOGO,
        cover_url: this.LOGO,
        about: 'Under Construction — Astranov marketplace opening soon in ' + city + '.',
        construction: true,
        city,
      },
      items: [],
    };
  },

  ensureInVendorList() {
    if (!this._current || !window.Commerce) return;
    const v = this._current;
    Commerce.vendors = (Commerce.vendors || []).filter(x => !String(x.id).startsWith('astranov-city-'));
    Commerce.vendors.unshift(v);
  },

  injectCurrent() {
    if (!this._current) return;
    this.ensureInVendorList();
    Commerce?.showOnGlobe?.();
    CityMap?.syncMapPins?.();
  },

  async placeForUser(lat, lng, opts) {
    opts = opts || {};
    if (lat == null || lng == null) return null;
    const center = await this.resolveCityCenter(lat, lng);
    const prevKey = this._current?.id;
    const vendor = this.buildVendor(center);
    this._current = vendor;
    try {
      localStorage.setItem('astranov_city_shop_v1', JSON.stringify({
        lat: center.lat, lng: center.lng, city: center.city, cityKey: center.cityKey, placedAt: Date.now(),
      }));
    } catch (_) {}
    this.ensureInVendorList();
    Commerce?.showOnGlobe?.();
    CityMap?.syncMapPins?.();
    const cityLabel = center.city || 'city center';
    MapDepict?.pulse?.(center.lat, center.lng, 0x1a6fd4, 'Astranov Shop · Under Construction · ' + cityLabel, 16000);
    GlobeDeck?.setPreview?.('🏬 Astranov Shop · Under Construction · ' + cityLabel);
    if (opts.fly && Commerce?.flyToVendor) Commerce.flyToVendor(vendor);
    if (prevKey !== vendor.id) {
      AciCli?.print?.('Astranov Shop placed at ' + cityLabel + ' center · under construction', 'ok');
    }
    return vendor;
  },

  loadPersisted() {
    try {
      const raw = localStorage.getItem('astranov_city_shop_v1');
      if (!raw) return;
      const data = JSON.parse(raw);
      if (data?.lat == null) return;
      this._current = this.buildVendor(data);
      this.ensureInVendorList();
    } catch (_) {}
  },

  isConstructionVendor(v) {
    return !!(v?.under_construction || this._tags(v).construction);
  },
};
window.AstranovCityShop = AstranovCityShop;

const DEMO_VENDORS = [
  { id: 'demo-pitogyra', name: 'Πιτογύρα Rhodes', emoji: '🥙', lat: 36.4412, lng: 28.2225, category: 'food', is_active: true, delivery_enabled: true, tags: { cover_url: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=640&h=200&fit=crop', profile_url: 'https://images.unsplash.com/photo-1529006557810-274db1b03838?w=128&h=128&fit=crop', about: 'Rhodes pitogyra · delivery 24/7 via Astranov drivers' }, items: [{ name: 'Πιτογύρα χοιρινό', price: 3.5, description: 'Classic pork gyro' }, { name: 'Μπύρα Alpha', price: 2.5, description: 'Cold 330ml' }, { name: 'Τσιγάρα Marlboro', price: 5.5 }, { name: 'Burger classic', price: 6, description: 'Beef burger meal' }] },
  { id: 'demo-kafeneio', name: 'Kafeneio Astranov', emoji: '☕', lat: 36.4358, lng: 28.2188, category: 'cafe', is_active: true, delivery_enabled: true, tags: { cover_url: 'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=640&h=200&fit=crop', profile_url: 'https://images.unsplash.com/photo-1511920170033-f8396924c10b?w=128&h=128&fit=crop', about: 'Greek café · frappe · beer · snacks' }, items: [{ name: 'Φραπέ', price: 2.2 }, { name: 'Μπύρα Fix', price: 2.8 }, { name: 'Νερό 500ml', price: 0.5 }] },
  { id: 'demo-minimarket', name: 'Mini Market Kos', emoji: '🏪', lat: 36.8932, lng: 27.288, category: 'grocery', is_active: true, delivery_enabled: true, tags: { cover_url: 'https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=640&h=200&fit=crop', profile_url: '/icon.svg', about: 'Neighborhood mini market · Kos island' }, items: [{ name: 'Μπύρα Heineken', price: 2.9 }, { name: 'Τσιγάρα Winston', price: 5.2 }, { name: 'Burger frozen', price: 4.5 }, { name: 'Νερό', price: 0.6 }] },
];

const Commerce = {
  DEMO_VENDORS,
  vendors: [],
  markers: [],
  driverMarkers: [],
  selected: null,
  cart: {},
  _uiReady: false,
  _menuRequestSent: false,
  _suggestion: null,
  _quote: null,
  _balance: null,
  _preferredDriverId: null,
  _preferredDriver: null,
  _lastWants: [],

  haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  userLatLng() {
    if (GhostTravel?.active?.()) {
      const m = GhostTravel.maskedTrue?.();
      if (m) return m;
      return GhostTravel.publicPos?.() || { lat: 36.4239, lng: 28.2245 };
    }
    if (window._clientDelivery?.lat != null) return { lat: window._clientDelivery.lat, lng: window._clientDelivery.lng };
    if (userLocated && window._lastPos) return { lat: window._lastPos.lat, lng: window._lastPos.lng };
    return { lat: 36.4239, lng: 28.2245 };
  },

  menuFor(vendor) {
    let raw = vendor?.items;
    if (typeof raw === 'string') {
      try { raw = JSON.parse(raw); } catch { raw = []; }
    }
    const items = Array.isArray(raw) ? raw.filter(i => i && i.name) : [];
    return items.map(i => ({
      ...i,
      image: i.image || i.photo || i.imageUrl || (typeof resolveMenuItemPhoto === 'function' ? resolveMenuItemPhoto(i) : ''),
      price: Number(i.price) || 0,
    }));
  },

  _normalizeVendor(v) {
    if (!v) return v;
    if (v.owner_id || v.category === 'field_shop') return v;
    if (this.menuFor(v).length) return v;
    const demo = DEMO_VENDORS.find(d =>
      d.id === v.id
      || (v.name && d.name.toLowerCase().includes(String(v.name).toLowerCase().slice(0, 5)))
    );
    if (!demo) return v;
    const demoItems = (demo.items || []).map(di => ({
      ...di,
      image: di.image || (typeof resolveMenuItemPhoto === 'function' ? resolveMenuItemPhoto(di) : ''),
    }));
    let tags = v.tags;
    if (typeof tags === 'string') { try { tags = JSON.parse(tags); } catch { tags = {}; } }
    tags = { ...(demo.tags || {}), ...(tags || {}) };
    return { ...v, items: demoItems, tags, delivery_enabled: v.delivery_enabled !== false };
  },

  hasMenu(vendor) {
    return this.menuFor(vendor).length > 0;
  },

  async loadVendors() {
    try {
      const r = await fetch(SB_URL + '/rest/v1/vendors?select=id,name,emoji,lat,lng,category,items,tags,owner_id,is_active,delivery_enabled&is_active=eq.true&limit=80', {
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
      });
      this.vendors = r.ok ? await r.json() : [];
    } catch { this.vendors = []; }
    if (!this.vendors.length) this.vendors = DEMO_VENDORS.map(v => ({ ...v }));
    else this.vendors = this.vendors.map(v => this._normalizeVendor(v));
    AstranovCityShop?.ensureInVendorList?.();
    const u = this.userLatLng();
    this.vendors.sort((a, b) => {
      if (AstranovCityShop?.isConstructionVendor?.(a)) return -1;
      if (AstranovCityShop?.isConstructionVendor?.(b)) return 1;
      return this.haversineKm(u.lat, u.lng, a.lat, a.lng) - this.haversineKm(u.lat, u.lng, b.lat, b.lng);
    });
    this.showOnGlobe();
    return this.vendors;
  },

  async enlistVendorAt(lat, lng, opts) {
    opts = opts || {};
    if (!Auth?.user) {
      Auth?.openLoginModal?.('Sign in to list your vendor on the map');
      return null;
    }
    lat = Number(lat);
    lng = Number(lng);
    if (!isFinite(lat) || !isFinite(lng)) return null;

    window._lastPos = { lat, lng };
    window._pendingShopLatLng = { lat, lng };

    if (window.GlobeNavigate?.ensureCityAt) {
      await GlobeNavigate.ensureCityAt(lat, lng);
    }

    const name = String(opts.name || '').trim() || Auth.user.user_metadata?.full_name || 'My shop';
    const headers = await Auth.authHeaders();
    let vendor = null;

    try {
      const r = await fetch(SB_URL + '/rest/v1/vendors?select=id,name,emoji,lat,lng,category,items,tags,owner_id,is_active,delivery_enabled&owner_id=eq.' + Auth.user.id + '&limit=20', { headers });
      const owned = r.ok ? await r.json() : [];
      vendor = owned.find(v => v.lat != null && this.haversineKm(lat, lng, v.lat, v.lng) < 0.5) || null;
    } catch (_) {}

    if (!vendor) {
      const id = 'v-' + Auth.user.id.slice(0, 8) + '-' + Date.now().toString(36);
      const body = {
        id,
        owner_id: Auth.user.id,
        name,
        emoji: '🏬',
        lat,
        lng,
        country: 'GR',
        city: 'field',
        items: [],
        tags: {},
        is_active: true,
        delivery_enabled: true,
        category: opts.category || 'field_shop',
      };
      const ins = await fetch(SB_URL + '/rest/v1/vendors', { method: 'POST', headers, body: JSON.stringify(body) });
      if (!ins.ok) {
        const j = await ins.json().catch(() => ({}));
        ACIControl?.reply?.('Vendor create failed: ' + (j.message || j.error || 'sign in & retry'));
        AciCli?.print?.('vendor enlist failed · ' + (j.message || j.error || ''), 'err');
        return null;
      }
      vendor = body;
    }

    await this.loadVendors();
    await FieldBrain?.onAuth?.();
    MapDepict?.pulse?.(lat, lng, 0xff8844, vendor.name, 16000);
    GlobeEntity?.syncVendors?.(this.vendors || []);
    MapPins?.syncGlobe?.();
    CityMap?.syncMapPins?.();
    FieldBrain.vendorIds = Array.from(new Set([...(FieldBrain?.vendorIds || []), vendor.id]));

    const norm = this._normalizeVendor(vendor);
    VendorMapTile?.open?.(norm, { preview: true, enlist: true, skipFly: false });
    ACIControl?.reply?.('Vendor listed — fill menu photos & prices in the tile');
    AciCli?.print?.('vendor enlisted · ' + norm.name + ' · + Add menu in tile', 'ok');
    return norm;
  },

  async myVendors() {
    if (!Auth?.user) return [];
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/vendors?select=id,name,emoji,items,category&owner_id=eq.' + Auth.user.id, { headers });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  },

  resolveVendorRef(ref) {
    const q = String(ref || '').trim().toLowerCase();
    if (!q) return null;
    return this.vendors.find(v => v.id === ref || v.name.toLowerCase().includes(q)) || null;
  },

  async resolveOwnedVendor(ref) {
    const owned = await this.myVendors();
    if (!owned.length) return null;
    const q = String(ref || '').trim().toLowerCase();
    if (!q) return owned[0];
    return owned.find(v => v.id === ref || v.name.toLowerCase().includes(q)) || owned[0];
  },

  flyToVendor(v) {
    if (!v || v.lat == null) return;
    const u = this.userLatLng();
    MapDepict?.scanCity?.({ userLat: u.lat, userLng: u.lng, vendors: [v], label: 'Found · ' + v.name, zoom: GlobeControl?.Z?.city || 1.32 });
    const p = latLngToPos(v.lat, v.lng, 1.03);
    if (typeof flyToPoint === 'function') flyToPoint(new THREE.Vector3(p.x, p.y, p.z), GlobeControl?.Z?.city || 1.32);
    MapDepict?.action('vendor', { lat: v.lat, lng: v.lng, detail: v.name, vendors: [v] });
  },

  showOnGlobe() {
    this.markers.forEach(m => { if (m.parent) m.parent.remove(m); });
    this.markers = [];
    if (!this.vendors.length) return;
    GlobeEntity?.syncVendors?.(this.vendors);
    this.markers = [...(GlobeEntity?.entities?.values() || [])].filter(e => e.type === 'vendor').map(e => e.mesh);
    MapDepict?.setHud?.('Καταστήματα', this.vendors.length + ' shops on globe · tap marker or deck commerce');
    GlobeDeck?.setPreview?.(this.vendors.length + ' vendors · team · clients — tap 🏬 or marker to order');
  },

  initUI() {
    if (this._uiReady) return;
    this._uiReady = true;
    const panel = document.getElementById('vendor-menu');
    document.getElementById('vm-close')?.addEventListener('click', () => {
      this.hideMenu();
      GlobeDeck?.completeTask('commerce');
    });
    document.getElementById('vm-back')?.addEventListener('click', () => this.showPicker());
    document.getElementById('vm-compare-back')?.addEventListener('click', () => this.showPicker());
    document.getElementById('vm-place')?.addEventListener('click', () => this.placeCart());
    document.getElementById('vm-request')?.addEventListener('click', () => this.requestMenu());
    document.getElementById('vm-confirm-pay')?.addEventListener('click', () => this.confirmAndPay(false));
    document.getElementById('vm-wallet-pay')?.addEventListener('click', () => this.confirmAndPay(true));
    if (panel) panel.addEventListener('click', e => e.stopPropagation());
    this.subscribeVendorOrders();
  },

  _vendorCh: false,
  subscribeVendorOrders() {
    if (this._vendorCh || !Auth?.client || !Auth?.user) return;
    void (FieldBrain?.load?.() || Promise.resolve()).then(async () => {
      const owned = await this.myVendors().catch(() => []);
      const ids = [...new Set([...(FieldBrain?.vendorIds || []), ...owned.map(v => v.id)])];
      ids.forEach((vid) => {
        if (!vid) return;
        const ch = Auth.client.channel('vendor-orders-' + vid);
        ch.on('broadcast', { event: 'new_order' }, ({ payload }) => {
          const sid = payload?.short_id || payload?.id || '';
          AciCli?.print?.('📦 New order ' + sid + ' · tap route on globe', 'ok');
          GlobeDeck?.setPreview?.('Vendor order ' + sid + ' · awaiting driver');
          void MarketplaceDeliveryEngine?.refreshVendorPolygons?.(vid);
        }).subscribe();
      });
      this._vendorCh = true;
    });
  },

  async importChannelOrder(channel, payload) {
    payload = payload || {};
    const headers = Auth?.authHeaders ? await Auth.authHeaders() : sbHeaders();
    const r = await fetch(SB_URL + '/functions/v1/order-intake', {
      method: 'POST',
      headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'channel_import',
        channel: channel || 'custom',
        external_id: payload.external_id || payload.externalId || ('ch-' + Date.now()),
        vendor_id: payload.vendor_id,
        items: payload.items,
        calc: payload.calc,
        delivery_lat: payload.delivery_lat,
        delivery_lng: payload.delivery_lng,
        delivery_address: payload.delivery_address,
        notes: payload.notes,
        pay_on_delivery: payload.pay_on_delivery,
        pay_with_balance: payload.pay_with_balance,
        preferred_driver_id: payload.preferred_driver_id,
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.order) {
      const vendor = this.vendors.find(v => v.id === j.order.vendor_id) || { id: j.order.vendor_id, name: j.order.vendor_name, lat: j.order.vendor_lat, lng: j.order.vendor_lng };
      await MarketplaceDeliveryEngine?.importChannelOrder?.({ order: j.order, vendor, driver: j.driver, channel });
      ACIControl?.reply?.('Channel ' + (channel || 'import') + ' · order ' + (j.order.short_id || j.order.id));
    }
    return j;
  },

  async buildQuote(suggestion) {
    const sug = suggestion || this._suggestion;
    if (!sug) return null;
    const u = this.userLatLng();
    const km = this.haversineKm(u.lat, u.lng, sug.vendor.lat, sug.vendor.lng);
    const kg = 3 + (sug.picks?.length || 1);
    const quote = await DeliveryPricing?.quote?.({
      km, kg, subtotal_eur: sug.total, lat: u.lat, lng: u.lng,
    });
    this._quote = quote;
    return quote;
  },

  renderPricing(quote) {
    const box = document.getElementById('vm-pricing');
    const walletBtn = document.getElementById('vm-wallet-pay');
    if (!box || !quote) { if (box) box.style.display = 'none'; return; }
    box.style.display = 'block';
    const sur = (quote.surcharges || []).map(s => s.label + ' +' + s.eur.toFixed(2) + '€').join(' · ');
    box.innerHTML = '<div class="vm-pricing-title">Delivery quote</div>'
      + '<div>Goods <strong>' + quote.subtotal_eur.toFixed(2) + '€</strong> · Delivery <strong>' + quote.delivery_eur.toFixed(2) + '€</strong>'
      + ' · Platform 3% <strong>' + quote.platform_fee_eur.toFixed(2) + '€</strong></div>'
      + '<div class="muted">' + quote.km.toFixed(1) + ' km · ' + quote.kg + ' kg'
      + (sur ? ' · ' + sur : '')
      + (quote.weather?.bad ? ' · ⚠ weather' : '') + '</div>'
      + '<div>Total <strong>' + quote.total_avc.toFixed(2) + ' AVC</strong> (= ' + quote.total_eur.toFixed(2) + ' EUR) · <a href="https://coin.astranov.eu" target="_blank" rel="noopener" style="color:#e8c547">coin.astranov.eu</a> · work-mint ledger</div>';
    if (walletBtn) {
      walletBtn.style.display = GoogleWalletPay?.supported?.() ? 'block' : 'none';
      walletBtn.textContent = 'Google Wallet · ' + quote.total_eur.toFixed(2) + '€';
    }
  },

  showMenu() {
    this.initUI();
    GlobeDeck?.showStage('vendor-menu', 'commerce');
  },

  hideMenu() {
    document.getElementById('vendor-menu')?.classList.remove('open', 'deck-active');
    this.selected = null;
    this.cart = {};
    this._menuRequestSent = false;
    this._suggestion = null;
    this.clearDriverMarkers();
  },

  clearDriverMarkers() {
    this.driverMarkers.forEach(m => { if (m.parent) m.parent.remove(m); });
    this.driverMarkers = [];
  },

  showDriversOnGlobe(drivers) {
    this.clearDriverMarkers();
    GlobeEntity?.syncDrivers?.(drivers || []);
    this.driverMarkers = [...(GlobeEntity?.entities?.values() || [])].filter(e => e.type === 'driver').map(e => e.mesh);
  },

  async renderDriverPick() {
    const box = document.getElementById('vm-drivers-pick');
    if (!box) return;
    const u = this.userLatLng();
    const drivers = await this.driversNear(u.lat, u.lng);
    this.showDriversOnGlobe(drivers);
    if (!drivers.length) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    box.style.display = 'block';
    box.innerHTML = '<div class="vm-drivers-title">' + (AstroGlyphs?.driver || '🚚') + ' Pick driver (tap):</div>'
      + drivers.slice(0, 5).map(d => {
        const km = this.haversineKm(u.lat, u.lng, d.field_lat, d.field_lng).toFixed(1);
        const picked = this._preferredDriverId === d.id ? ' picked' : '';
        return '<span class="vm-tag driver' + picked + '" data-driver-id="' + d.id + '">'
          + driverIcon(d) + ' ' + (d.display_name || 'Driver') + ' · ' + km + ' km</span>';
      }).join('');
    box.querySelectorAll('.vm-tag.driver[data-driver-id]').forEach(tag => {
      tag.onclick = (e) => {
        e.stopPropagation();
        const id = tag.dataset.driverId;
        const d = drivers.find(x => x.id === id);
        MarketplaceComms?.selectDriver?.(id, d);
        box.querySelectorAll('.vm-tag.driver').forEach(el => el.classList.remove('picked'));
        tag.classList.add('picked');
      };
    });
    MarketplaceComms?.openForBrowse?.({
      vendor: this.selected,
      drivers,
      wants: this._lastWants?.map?.(w => w.label)?.join(' + ') || '',
      preferredDriverId: this._preferredDriverId,
    });
  },

  parseWantedItems(text) {
    const low = String(text || '').toLowerCase();
    return ORDER_ITEM_ALIASES.filter(a => a.keys.some(k => low.includes(k)));
  },

  looksLikeVendorOnly(text) {
    const q = String(text || '').trim().toLowerCase();
    if (!q || q.length < 2) return false;
    const wants = this.parseWantedItems(q);
    if (wants.length) return false;
    return this.vendors.some(v => v.name.toLowerCase().includes(q) || q.includes(v.name.toLowerCase().slice(0, 4)));
  },

  findMenuItemForWant(menu, want) {
    const hits = menu.filter(i => want.match.test(String(i.name || '')));
    if (!hits.length) return null;
    hits.sort((a, b) => (a.price || 0) - (b.price || 0));
    return hits[0];
  },

  scoreVendorForWants(vendor, wants, u) {
    const menu = this.menuFor(vendor);
    if (!menu.length) return null;
    const picks = [];
    wants.forEach(w => {
      const item = this.findMenuItemForWant(menu, w);
      if (item) picks.push({ want: w, item, price: item.price || 0 });
    });
    if (!picks.length) return null;
    const total = picks.reduce((s, p) => s + p.price, 0);
    const km = this.haversineKm(u.lat, u.lng, vendor.lat, vendor.lng);
    const coverage = picks.length / wants.length;
    const score = coverage * 1000 - total * 0.5 - km * 3;
    return { vendor, picks, matched: picks.length, wanted: wants.length, total, km, score, coverage };
  },

  async fetchNearbyDrivers(lat, lng) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    try {
      const r = await fetch(SB_URL + '/rest/v1/profiles?select=id,display_name,avatar_emoji,profile_page,field_lat,field_lng,field_seen_at&roles=cs.%5B%22driver%22%5D&field_seen_at=gte.' + since + '&field_lat=not.is.null&limit=25', {
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
      });
      const rows = r.ok ? await r.json() : [];
      rows.sort((a, b) => this.haversineKm(lat, lng, a.field_lat, a.field_lng) - this.haversineKm(lat, lng, b.field_lat, b.field_lng));
      return rows;
    } catch { return []; }
  },

  async driversNear(lat, lng) {
    return this.fetchNearbyDrivers(lat, lng);
  },

  async fetchBalance() {
    if (!Auth?.user) return 0;
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/balance_ledger?select=balance&user_id=eq.' + Auth.user.id, { headers });
      if (r.ok) {
        const rows = await r.json();
        if (rows[0]) { this._balance = Number(rows[0].balance) || 0; return this._balance; }
      }
      const pr = await fetch(SB_URL + '/rest/v1/profiles?select=balance&id=eq.' + Auth.user.id, { headers });
      if (pr.ok) {
        const rows = await pr.json();
        this._balance = Number(rows[0]?.balance) || 0;
        return this._balance;
      }
    } catch { /* */ }
    window.AvcBalance?.render?.(this._balance ?? 0, !Auth?.user);
    return 0;
  },

  hideComparePanels() {
    ['vm-list', 'vm-detail', 'vm-compare'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });
  },

  renderCompare(matches, drivers, wants, balance) {
    const compare = document.getElementById('vm-compare');
    const wanted = document.getElementById('vm-wanted');
    const matchBox = document.getElementById('vm-matches');
    const driverBox = document.getElementById('vm-drivers');
    const balBox = document.getElementById('vm-balance');
    const confirmBtn = document.getElementById('vm-confirm-pay');
    if (!compare) return;

    this.hideComparePanels();
    compare.style.display = 'block';

    if (wanted) {
      wanted.innerHTML = '<div class="vm-wanted-title">Ζητάς:</div>' + wants.map(w => '<span class="vm-tag">' + w.label + '</span>').join('');
    }
    if (matchBox) {
      matchBox.innerHTML = '';
      matches.slice(0, 5).forEach((m, i) => {
        const row = document.createElement('div');
        row.className = 'vm-match' + (i === 0 ? ' best' : '');
        const miss = m.wanted - m.matched;
        const detail = m.picks.map(p => p.item.name + ' ' + p.price + ' AVC').join(' · ');
        row.innerHTML = '<div class="vm-match-head"><span>' + vendorIcon(m.vendor) + ' ' + m.vendor.name + '</span><strong>' + m.total.toFixed(1) + ' AVC</strong></div>'
          + '<div class="vm-match-sub">' + m.km.toFixed(1) + ' km · ' + m.matched + '/' + m.wanted + ' είδη' + (miss ? ' · <span style="color:#ffd633">-' + miss + '</span>' : '') + '</div>'
          + '<div class="vm-match-items">' + detail + '</div>';
        row.onclick = () => {
          this._suggestion = m;
          matchBox.querySelectorAll('.vm-match').forEach(el => el.classList.remove('picked'));
          row.classList.add('picked');
          if (confirmBtn) confirmBtn.textContent = 'Επιβεβαίωση & Πληρωμή · ' + m.vendor.name + ' · ' + m.total.toFixed(1) + ' AVC';
          this.flyToVendor(m.vendor);
        };
        if (i === 0) { row.classList.add('picked'); this._suggestion = m; }
        matchBox.appendChild(row);
      });
    }
    if (driverBox) {
      const n = drivers.length;
      driverBox.innerHTML = n
        ? '<div class="vm-drivers-title">' + (AstroGlyphs?.driver || '🚚') + ' ' + n + ' οδηγοί κοντά · tap to pick:</div>' + drivers.slice(0, 4).map(d => {
          const km = this.haversineKm(this.userLatLng().lat, this.userLatLng().lng, d.field_lat, d.field_lng).toFixed(1);
          const picked = this._preferredDriverId === d.id ? ' picked' : '';
          return '<span class="vm-tag driver' + picked + '" data-driver-id="' + d.id + '">' + driverIcon(d) + ' ' + (d.display_name || 'Driver') + ' · ' + km + ' km</span>';
        }).join('')
        : '<div class="vm-drivers-title" style="color:#ffd633">Δεν βρέθηκαν ενεργοί οδηγοί — θα αναζητηθεί μετά την παραγγελία</div>';
      driverBox.querySelectorAll('.vm-tag.driver[data-driver-id]').forEach(tag => {
        tag.onclick = (e) => {
          e.stopPropagation();
          MarketplaceComms?.selectDriver?.(tag.dataset.driverId);
          driverBox.querySelectorAll('.vm-tag.driver').forEach(el => el.classList.remove('picked'));
          tag.classList.add('picked');
        };
      });
    }
    if (balBox) {
      const b = balance != null ? balance : 0;
      const need = this._suggestion?.total || matches[0]?.total || 0;
      const ok = b >= need;
      balBox.innerHTML = '<div>Υπόλοιπο: <strong>' + b.toFixed(1) + ' AVC</strong>'
        + (need ? ' · Παραγγελία: <strong>' + need.toFixed(1) + ' AVC</strong>' : '')
        + (ok ? '' : ' · <span style="color:#ff3344">ανεπαρκές — recharge στο CLI</span>') + '</div>';
    }
    if (confirmBtn && this._suggestion) {
      confirmBtn.style.display = 'block';
      confirmBtn.textContent = 'Επιβεβαίωση & Πληρωμή · AVC balance';
      this.buildQuote(this._suggestion).then(q => this.renderPricing(q)).catch(() => {});
    }
  },

  async smartOrder(query) {
    const run = async () => {
      const q = String(query || '').replace(/^(order|παραγγελία?)\s*/i, '').trim();
      const wants = this.parseWantedItems(q);
      this._lastWants = wants;
      if (!wants.length) {
        ACIControl?.reply('Δεν κατάλαβα είδη — π.χ. order pitogyra mpironia tsigareta');
        return this.openOrderFlow(q);
      }

      await this.loadVendors();
      const u = this.userLatLng();
      MapDepict?.showOrderSearch({ userLat: u.lat, userLng: u.lng, wantedLabels: wants.map(w => w.label), zoom: 1.22 });

      const matches = [];
      this.vendors.forEach(v => {
        const m = this.scoreVendorForWants(v, wants, u);
        if (m) matches.push(m);
      });
      matches.sort((a, b) => b.score - a.score || a.total - b.total || a.km - b.km);

      const drivers = await this.driversNear(u.lat, u.lng);
      this.showDriversOnGlobe(drivers);
      MapDepict?.showOrderSearch({ userLat: u.lat, userLng: u.lng, wantedLabels: wants.map(w => w.label), matches, drivers, zoom: 1.22 });

      const balance = Auth?.user ? await this.fetchBalance() : 0;
      this.showMenu();
      this.hideComparePanels();
      document.getElementById('vm-compare').style.display = 'block';
      const title = document.getElementById('vm-title');
      if (title) title.textContent = 'Σύγκριση · ' + wants.map(w => w.label).join(' + ');

      if (!matches.length) {
        this.renderCompare([], drivers, wants, balance);
        MarketplaceComms?.openForBrowse?.({ vendor: null, drivers, wants: wants.map(w => w.label).join(' + ') });
        const msg = 'Κανένα κατάστημα με πραγματικό μενού για αυτά τα είδη — ζήτησε μενού από κοντινό κατάστημα';
        ACIControl?.reply(msg);
        if (Voice.maySpeak()) speak(msg.slice(0, 120), () => resumeListening());
        return;
      }

      this.renderCompare(matches, drivers, wants, balance);
      const bestVendor = matches[0]?.vendor || null;
      MarketplaceComms?.openForBrowse?.({
        vendor: bestVendor,
        drivers,
        wants: wants.map(w => w.label).join(' + '),
        preferredDriverId: this._preferredDriverId,
      });
      const best = matches[0];
      const driverNames = drivers.slice(0, 2).map(d => d.display_name || 'Driver').join(', ');
      const msg = 'Πρόταση: ' + best.vendor.name + ' · ' + best.total.toFixed(1) + ' AVC · ' + best.km.toFixed(1) + ' km'
        + (driverNames ? ' · οδηγοί: ' + driverNames : ' · αναζήτηση οδηγού');
      ACIControl?.reply(msg);
      if (Voice.maySpeak()) speak(msg.slice(0, 140), () => resumeListening());
      FieldBrain?.pulse('commerce', wants.map(w => w.label).join('+') + ' → ' + best.vendor.name, { role: 'client' });
    };

    if (!userLocated && navigator.geolocation) {
      ACIControl?.reply('Zoom στον χάρτη σου…');
      navigator.geolocation.getCurrentPosition(pos => {
        placeMe(pos.coords.latitude, pos.coords.longitude, { quiet: true, markerOnly: true });
        run();
      }, () => run());
    } else {
      MapDepict?.zoomToUser(GlobeControl?.Z?.national || 1.82);
      run();
    }
  },

  async confirmAndPay(useWallet) {
    const sug = this._suggestion;
    if (!sug) { ACIControl?.reply('Διάλεξε πρόταση από τη λίστα'); return; }
    if (!Auth?.user) {
      ACIControl?.reply('Σύνδεση για πληρωμή');
      Auth?.openLoginModal?.('Sign in to order');
      return;
    }
    const quote = await this.buildQuote(sug);
    const total = quote?.total_eur ?? sug.total;
    let walletPayment = null;
    if (useWallet) {
      try {
        walletPayment = await GoogleWalletPay.pay(total, sug.vendor.name + ' · Astranov', { test: location.hostname === 'localhost' });
      } catch (e) {
        ACIControl?.reply('Wallet payment cancelled or unavailable — try AVC balance');
        return;
      }
    } else {
      const balance = await this.fetchBalance();
      if (balance < total) {
        ACIControl?.reply('Pay on delivery · AVC balance ' + balance.toFixed(1) + ' · total ' + total.toFixed(2));
      }
    }
    const items = sug.picks.map(p => ({ name: p.item.name, qty: 1, price: p.item.price }));
    const vendor = sug.vendor;
    const balance = await this.fetchBalance();
    const payOnDelivery = !useWallet && balance < total;
    MapDepict?.action('pay', {
      lat: this.userLatLng().lat, lng: this.userLatLng().lng,
      vendorLat: vendor.lat, vendorLng: vendor.lng,
      detail: vendor.name + ' · ' + total.toFixed(2) + ' EUR' + (payOnDelivery ? ' · COD' : ''),
    });
    await this.placeOrder(vendor, items, 'Smart order · ' + sug.picks.map(p => p.want.label).join(' + '), !useWallet && !payOnDelivery, {
      quote, walletPayment, payWithWallet: !!walletPayment, payOnDelivery,
    });
  },

  async showPicker(filter) {
    await this.loadVendors();
    if (!userLocated && navigator.geolocation) {
      await new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(
          pos => { placeMe(pos.coords.latitude, pos.coords.longitude, { fly: true, quiet: true }); resolve(); },
          () => resolve(),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
        );
      });
    } else if (window._lastPos) {
      placeMe(window._lastPos.lat, window._lastPos.lng, { fly: true, quiet: true });
    }
    this.showMenu();
    this.selected = null;
    this.cart = {};
    this._menuRequestSent = false;
    this.hideComparePanels();
    const list = document.getElementById('vm-list');
    if (list) list.style.display = 'block';
    this._suggestion = null;
    const title = document.getElementById('vm-title');
    if (title) title.textContent = 'Επίλεξε κατάστημα · ' + this.vendors.length;

    let rows = this.vendors;
    if (filter) {
      const q = filter.toLowerCase();
      rows = this.vendors.filter(v => (v.name + ' ' + v.category).toLowerCase().includes(q));
      if (!rows.length) rows = this.vendors;
    }

    if (!list) return;
    list.innerHTML = '';
    const u = this.userLatLng();
    rows.slice(0, 24).forEach(v => {
      const km = this.haversineKm(u.lat, u.lng, v.lat, v.lng).toFixed(1);
      const hasMenu = this.hasMenu(v);
      const under = AstranovCityShop?.isConstructionVendor?.(v);
      const logo = window.MapPins?.vendorLogo?.(v) || '';
      const icon = logo
        ? '<img class="vm-vendor-logo" src="' + logo.replace(/"/g, '') + '" alt="" />'
        : '<span style="font-size:22px">' + vendorIcon(v) + '</span>';
      const row = document.createElement('div');
      row.className = 'vm-vendor' + (under ? ' vm-vendor-construction' : '');
      const sub = under
        ? '<span style="color:#ffd633">🚧 Under Construction · ' + (AstranovCityShop._tags(v).city || 'city center') + '</span>'
        : (v.category || 'shop') + ' · ' + km + ' km' + (hasMenu ? '' : ' · <span style="color:#ffd633">χωρίς μενού</span>');
      row.innerHTML = icon + '<div><div style="color:#3d9eff;font-weight:600">' + v.name + '</div><div style="color:#9ab;font-size:10px">' + sub + '</div></div>';
      row.onclick = () => this.openVendor(v);
      list.appendChild(row);
    });
    if (rows[0]) this.flyToVendor(rows[0]);
    await this.renderDriverPick();
    ACIControl?.reply('Tap vendor on globe or list — ' + rows.length + ' shops · pick driver above');
  },

  _renderUnderConstruction(vendor) {
    const tags = AstranovCityShop?._tags?.(vendor) || {};
    const city = tags.city || 'your city';
    const logo = tags.profile_url || AstranovCityShop?.LOGO || '/icon.svg';
    const box = document.getElementById('vm-items');
    const empty = document.getElementById('vm-empty');
    const placeBtn = document.getElementById('vm-place');
    const requestBtn = document.getElementById('vm-request');
    const drivers = document.getElementById('vm-drivers-pick');
    if (placeBtn) placeBtn.style.display = 'none';
    if (requestBtn) requestBtn.style.display = 'none';
    if (drivers) { drivers.style.display = 'none'; drivers.innerHTML = ''; }
    if (empty) empty.style.display = 'none';
    if (box) {
      box.innerHTML = ''
        + '<div class="vm-construction">'
        + '<div class="vm-construction-cover" style="background-image:url(' + logo + ')"></div>'
        + '<img class="vm-construction-logo" src="' + logo + '" alt="Astranov" />'
        + '<h3>Astranov Shop</h3>'
        + '<p class="vm-construction-badge">🚧 Under Construction</p>'
        + '<p class="vm-construction-city">City center · ' + city + '</p>'
        + '<p class="vm-construction-about">' + (tags.about || 'Opening soon — marketplace, delivery &amp; local vendors.') + '</p>'
        + '</div>';
    }
    const title = document.getElementById('vm-title');
    if (title) title.textContent = 'Astranov Shop · Under Construction';
    GlobeDeck?.setMapStatus('🚧 Astranov Shop · Under Construction · ' + city);
    ACIControl?.reply('Astranov Shop is under construction at the center of ' + city + ' — opening soon.');
  },

  async openVendor(vendor) {
    if (!vendor) return;
    await LazyModules.ensure().catch(() => {});
    const norm = this._normalizeVendor(vendor);
    if (window.VendorMapTile?.open) {
      VendorMapTile.open(norm);
      this.selected = norm;
      return;
    }
    this.selected = vendor;
    this.cart = {};
    this._menuRequestSent = false;
    this.flyToVendor(vendor);
    this.showMenu();
    this.hideComparePanels();
    const list = document.getElementById('vm-list');
    const detail = document.getElementById('vm-detail');
    if (list) list.style.display = 'none';
    if (detail) detail.style.display = 'block';
    const compare = document.getElementById('vm-compare');
    if (compare) compare.style.display = 'none';
    if (AstranovCityShop?.isConstructionVendor?.(vendor)) {
      this._renderUnderConstruction(vendor);
      return;
    }
    const title = document.getElementById('vm-title');
    if (title) title.textContent = vendorIcon(vendor) + ' ' + vendor.name;
    this.renderCart();
    await this.renderDriverPick();
    GlobeDeck?.setMapStatus(this.hasMenu(vendor) ? vendor.name + ' — add items' : vendor.name + ' — request menu');
  },

  renderCart() {
    const box = document.getElementById('vm-items');
    const empty = document.getElementById('vm-empty');
    const placeBtn = document.getElementById('vm-place');
    const requestBtn = document.getElementById('vm-request');
    if (!box || !this.selected) return;

    const menu = this.menuFor(this.selected);
    if (!menu.length) {
      box.innerHTML = '';
      if (empty) {
        empty.style.display = 'block';
        empty.innerHTML = '<p>Το κατάστημα δεν έχει ανεβάσει μενού στο Astranov ακόμα.</p><p style="color:#9ab;font-size:11px">Πάτα παρακάτω — θα ειδοποιηθεί ο ιδιοκτήτης να συμπληρώσει τα πραγματικά προϊόντα.</p>';
      }
      if (placeBtn) placeBtn.style.display = 'none';
      if (requestBtn) {
        requestBtn.style.display = 'block';
        requestBtn.textContent = this._menuRequestSent ? 'Αίτημα στάλθηκε ' + (AstroGlyphs?.ok || '✔️') : (AstroGlyphs?.menu || '📋') + ' Ζήτησε μενού από κατάστημα';
        requestBtn.disabled = !!this._menuRequestSent;
      }
      return;
    }

    if (empty) empty.style.display = 'none';
    if (requestBtn) requestBtn.style.display = 'none';
    if (placeBtn) placeBtn.style.display = 'block';

    box.innerHTML = '';
    menu.forEach(item => {
      const key = item.name;
      const qty = this.cart[key] || 0;
      const row = document.createElement('div');
      row.className = 'vm-item';
      const img = item.image || item.photo || item.imageUrl || (typeof resolveMenuItemPhoto === 'function' ? resolveMenuItemPhoto(item) : '');
      const imgHtml = img ? '<img class="vm-item-img" src="' + img.replace(/"/g, '') + '" alt="" onerror="this.src=\'/icon.svg\'" />' : '';
      row.innerHTML = imgHtml + '<span class="vm-item-body">' + item.name + ' <small style="color:#9ab">' + (item.price || 0) + ' AVC</small></span>';
      const q = document.createElement('div');
      q.className = 'vm-qty';
      const minus = document.createElement('button');
      minus.textContent = '−';
      minus.onclick = () => { this.cart[key] = Math.max(0, (this.cart[key] || 0) - 1); this.renderCart(); };
      const span = document.createElement('span');
      span.textContent = String(qty);
      span.style.minWidth = '18px';
      span.style.textAlign = 'center';
      const plus = document.createElement('button');
      plus.textContent = '+';
      plus.onclick = () => { this.cart[key] = (this.cart[key] || 0) + 1; this.renderCart(); };
      q.append(minus, span, plus);
      row.appendChild(q);
      box.appendChild(row);
    });
    const total = menu.reduce((s, i) => s + (this.cart[i.name] || 0) * (i.price || 0), 0);
    if (placeBtn) placeBtn.textContent = total > 0 ? 'Παραγγελία · ' + total.toFixed(1) + ' AVC' : 'Παραγγελία';
  },

  cartItems() {
    const menu = this.menuFor(this.selected || {});
    return menu
      .filter(i => (this.cart[i.name] || 0) > 0)
      .map(i => ({ name: i.name, qty: this.cart[i.name], price: i.price }));
  },

  async requestMenu() {
    const vendor = this.selected;
    if (!vendor) { ACIControl?.reply('Pick a vendor first'); return; }
    if (this.hasMenu(vendor)) {
      ACIControl?.reply('Menu already available — add items to order');
      return;
    }
    if (!Auth?.user) {
      ACIControl?.reply('Sign in to request menu');
      Auth?.openLoginModal?.('Sign in to order');
      return;
    }
    if (this._menuRequestSent) return;

    const u = this.userLatLng();
    let errMsg = '';
    let ok = false;
    let result = null;
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/functions/v1/menu-request', {
        method: 'POST', headers,
        body: JSON.stringify({
          vendor_id: vendor.id,
          notes: 'Customer waiting for menu · ' + vendor.name,
          delivery_lat: u.lat,
          delivery_lng: u.lng,
        }),
      });
      result = await r.json().catch(() => ({}));
      ok = r.ok && result.ok;
      if (!ok) errMsg = result.error || result.message || ('HTTP ' + r.status);
      else this._menuRequestSent = true;
    } catch (e) { errMsg = String(e.message || e); }

    const msg = ok
      ? 'Αίτημα μενού στο ' + vendor.name + (result?.already_pending ? ' (ήδη σε αναμονή)' : ' — ο ιδιοκτήτης ειδοποιήθηκε')
      : 'Αίτημα απέτυχε: ' + (errMsg || 'server error');

    if (ok) {
      this.renderCart();
      MapDepict?.action('order', { lat: u.lat, lng: u.lng, vendorLat: vendor.lat, vendorLng: vendor.lng, detail: 'menu request · ' + vendor.name });
      FieldBrain?.pulse('commerce', 'menu request · ' + vendor.name, { role: 'client' });
    }

    ACIControl?.reply(msg);
    if (Voice.maySpeak()) speak(msg.slice(0, 120), () => resumeListening());
  },

  async placeCart() {
    const vendor = this.selected;
    if (!vendor) { ACIControl?.reply('Pick a vendor first'); return; }
    if (!this.hasMenu(vendor)) {
      ACIControl?.reply('No menu yet — tap Ζήτησε μενού to notify the vendor');
      return;
    }
    const items = this.cartItems();
    if (!items.length) { ACIControl?.reply('Add at least one item'); return; }
    if (!Auth?.user) {
      ACIControl?.reply('Sign in to place order');
      Auth?.openLoginModal?.('Sign in to order');
      return;
    }
    await this.placeOrder(vendor, items);
  },

  async placeOrder(vendor, items, notes, payWithBalance, opts) {
    opts = opts || {};
    requestLocationIfNeeded(async () => {
      const u = this.userLatLng();
      let dLat = opts.deliveryLat ?? u.lat;
      let dLng = opts.deliveryLng ?? u.lng;
      window._clientDelivery = { lat: dLat, lng: dLng, label: 'Delivery' };
      try { localStorage.setItem('astranov_client_delivery', JSON.stringify(window._clientDelivery)); } catch (_) {}
      const subtotal = items.reduce((s, i) => s + (i.qty || 1) * (i.price || 0), 0);
      const km = this.haversineKm(u.lat, u.lng, vendor.lat, vendor.lng);
      const quote = opts.quote || await DeliveryPricing?.quote?.({ km, kg: 3 + items.length, subtotal_eur: subtotal, lat: dLat, lng: dLng });
      const total = quote?.total_eur ?? subtotal;
      let orderResult = null;
      let errMsg = '';
      try {
        const headers = Auth?.authHeaders ? await Auth.authHeaders() : sbHeaders();
        const r = await fetch(SB_URL + '/functions/v1/order-intake', {
          method: 'POST', headers,
          body: JSON.stringify({
            vendor_id: vendor.id,
            items: items.map(i => ({ name: i.name, qty: i.qty || 1, price: i.price })),
            delivery_lat: dLat,
            delivery_lng: dLng,
            notes: notes || ('Astranov order · ' + vendor.name),
            calc: {
              ...(quote || {}),
              subtotal_eur: subtotal,
              total_avc: total,
              goods_eur: subtotal,
              wallet_payment: opts.walletPayment || null,
              paid_via: opts.payWithWallet ? 'google_wallet' : (payWithBalance ? 'avc_balance' : null),
            },
            pay_with_balance: !!payWithBalance && !opts.payWithWallet && !opts.payOnDelivery,
            pay_on_delivery: !!opts.payOnDelivery,
            pay_with_wallet: !!opts.payWithWallet,
            preferred_driver_id: this._preferredDriverId || null,
            target_user_id: opts.targetUserId || null,
          }),
        });
        const j = await r.json().catch(() => ({}));
        if (r.ok) orderResult = j;
        else {
          if (j.error === 'vendor_menu_empty') errMsg = 'Το κατάστημα δεν έχει μενού — ζήτησε μενού πρώτα';
          else if (j.error === 'insufficient_balance') errMsg = 'Ανεπαρκές υπόλοιπο · έχεις ' + (j.balance || 0) + ' AVC, χρειάζεσαι ' + (j.needed || total);
          else errMsg = j.error || j.message || ('HTTP ' + r.status);
        }
      } catch (e) { errMsg = String(e.message || e); }

      const driverObj = orderResult?.driver;
      const driver = driverObj?.name || orderResult?.order?.driver_name || (orderResult?.seeking_driver ? 'seeking driver' : null);
      const ordId = orderResult?.order?.short_id || orderResult?.order?.id;

      const clientAddr = window._clientDelivery || { lat: dLat, lng: dLng, label: 'Delivery' };
      MapDepict?.action('order', {
        lat: clientAddr.lat, lng: clientAddr.lng,
        vendorLat: vendor.lat, vendorLng: vendor.lng,
        detail: vendor.name + (ordId ? ' · ' + ordId : ''),
      });
      if (orderResult?.order && window.MarketplaceDeliveryEngine) {
        const prevMission = MarketplaceDeliveryEngine.missions?.find(m =>
          m.active && m.order?.driver_id && m.order.driver_id === orderResult.order.driver_id && m.order.driver_accepted_at);
        if (prevMission && orderResult.order.driver_accepted_at) {
          await MarketplaceDeliveryEngine.addDeliveryToRoute(prevMission.id, {
            order_id: orderResult.order.id,
            vendor_lat: vendor.lat,
            vendor_lng: vendor.lng,
            vendor_name: vendor.name,
            delivery_lat: dLat,
            delivery_lng: dLng,
            label: ordId || 'Stop',
          });
        } else {
          void MarketplaceDeliveryEngine.onOrderPlaced(orderResult.order, vendor, driverObj);
        }
      } else if (window.DrivingView) {
        const driverBase = window._driverBase || u;
        DrivingView.setRoutePlan?.({
          from: driverBase,
          via: { lat: vendor.lat, lng: vendor.lng },
          to: { lat: clientAddr.lat, lng: clientAddr.lng },
        });
        DrivingView.setDestination(clientAddr.lat, clientAddr.lng);
        DrivingView.fetchRoadRoute?.().then?.(() => {
          CityMap?.setRoute?.(DrivingView.routeCoords || []);
        });
      }
      MapPins?.syncGlobe?.();

      let msg;
      if (orderResult?.order) {
        const paid = orderResult.paid ? ' · Πληρώθηκε ' + (orderResult.paid_amount || total).toFixed(1) + ' AVC' : '';
        const cod = orderResult.pay_on_delivery ? ' · πληρωμή στην παράδοση' : '';
        msg = orderResult.seeking_driver
          ? 'Παραγγελία ' + (ordId || '') + ' στο ' + vendor.name + paid + cod + '. Αναζητούμε οδηγό — πες driver jobs ή driver online.'
          : orderResult.awaiting_accept
          ? 'Παραγγελία ' + (ordId || '') + ' στο ' + vendor.name + paid + '. Οδηγός ' + (driver || '') + ' — πρέπει να υπογράψει/αποδεχτεί για ενεργό triangle.'
          : 'Παραγγελία ' + (ordId || '') + ' στο ' + vendor.name + paid + '. Οδηγός: ' + (driver || 'pending') + '.';
        if (orderResult.balance_after != null) this._balance = orderResult.balance_after;
        window.AvcBalance?.render?.(this._balance, false);
        this.hideMenu();
        GlobeDeck?.completeTask('commerce');
        const nearDrivers = await this.fetchNearbyDrivers(dLat, dLng);
        MarketplaceComms?.openForOrder?.({
          order: orderResult.order,
          vendor,
          drivers: nearDrivers,
          seeking_driver: orderResult.seeking_driver,
          wants: items.map(i => i.name).join(', '),
        });
        const wants = items.map(i => i.name).join(', ');
        TelemachosPilot?.coordinateMarketplaceDelivery?.({
          vendor,
          order: orderResult.order,
          items,
          driver: driverObj,
          deliveryLat: dLat,
          deliveryLng: dLng,
          seekingDriver: orderResult.seeking_driver,
          wants,
          targetUser: opts.targetUser,
        });
        if (opts.targetUser) {
          await TelemachosPilot?.onTeamOrder?.({
            target: opts.targetUser,
            items,
            order: orderResult.order,
            deliveryLat: dLat,
            deliveryLng: dLng,
          });
        }
        OrderTracking?.onOrderPlaced?.(orderResult.order, vendor, driverObj);
        if (vendor?.id) void MarketplaceDeliveryEngine?.refreshVendorPolygons?.(vendor.id);
      } else {
        msg = 'Παραγγελία απέτυχε: ' + (errMsg || 'server error') + '. Δοκίμασε ξανά.';
      }

      ACIControl?.reply(msg);
      FieldBrain?.pulse('order', vendor.name + ' → ' + (driver || 'pending'), { role: 'client' });
      if (Voice.maySpeak()) speak(msg.slice(0, 120), () => resumeListening());
    });
  },

  async updateVendorMenu(vendorId, items) {
    const headers = await Auth.authHeaders();
    const r = await fetch(SB_URL + '/rest/v1/vendors?id=eq.' + encodeURIComponent(vendorId), {
      method: 'PATCH',
      headers: { ...headers, Prefer: 'return=representation' },
      body: JSON.stringify({ items, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      return { error: j.message || j.error || ('HTTP ' + r.status) };
    }
    const rows = await r.json();
    await this.fulfillMenuRequests(vendorId);
    await this.loadVendors();
    if (this.selected?.id === vendorId && rows[0]) this.selected = rows[0];
    return { ok: true, vendor: rows[0] };
  },

  async fulfillMenuRequests(vendorId) {
    try {
      const headers = await Auth.authHeaders();
      await fetch(SB_URL + '/rest/v1/vendor_menu_requests?vendor_id=eq.' + encodeURIComponent(vendorId) + '&status=eq.pending', {
        method: 'PATCH',
        headers,
        body: JSON.stringify({ status: 'fulfilled', updated_at: new Date().toISOString() }),
      });
    } catch { /* non-fatal */ }
  },

  async listMenuRequests() {
    const owned = await this.myVendors();
    if (!owned.length) return { error: 'no owned vendors' };
    const ids = owned.map(v => v.id).join(',');
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/vendor_menu_requests?select=id,vendor_id,status,notes,created_at&vendor_id=in.(' + ids + ')&status=eq.pending&order=created_at.desc&limit=20', { headers });
      const rows = r.ok ? await r.json() : [];
      const byId = Object.fromEntries(owned.map(v => [v.id, v.name]));
      return { ok: true, requests: rows.map(row => ({ ...row, vendor_name: byId[row.vendor_id] || row.vendor_id })) };
    } catch (e) { return { error: String(e.message || e) }; }
  },

  async cliVendorMenu(args) {
    if (!Auth?.user) return { error: 'login required' };
    const sub = (args[0] || 'list').toLowerCase();
    if (sub === 'list' || sub === 'ls') {
      const owned = await this.myVendors();
      if (!owned.length) return { error: 'you do not own any vendor — claim shop in dashboard first' };
      return {
        ok: true,
        vendors: owned.map(v => ({
          id: v.id,
          name: v.name,
          items: this.menuFor(v).length,
        })),
      };
    }
    if (sub === 'add') {
      const ref = args[1];
      const price = parseFloat(args[args.length - 1]);
      const name = args.slice(2, -1).join(' ').trim();
      if (!ref || !name || isNaN(price)) return { error: 'usage: vendor menu add <shop> <item name> <price>' };
      const v = await this.resolveOwnedVendor(ref);
      if (!v) return { error: 'owned vendor not found: ' + ref };
      const items = this.menuFor(v).concat([{ name, price }]);
      const r = await this.updateVendorMenu(v.id, items);
      if (r.error) return r;
      return { ok: true, message: 'added ' + name + ' @ ' + price + ' AVC to ' + v.name, items: items.length };
    }
    if (sub === 'clear') {
      const ref = args[1];
      if (!ref) return { error: 'usage: vendor menu clear <shop>' };
      const v = await this.resolveOwnedVendor(ref);
      if (!v) return { error: 'owned vendor not found: ' + ref };
      const r = await this.updateVendorMenu(v.id, []);
      if (r.error) return r;
      return { ok: true, message: 'cleared menu for ' + v.name };
    }
    if (sub === 'show') {
      const ref = args[1];
      const v = await this.resolveOwnedVendor(ref);
      if (!v) return { error: 'owned vendor not found' };
      return { ok: true, vendor: v.name, menu: this.menuFor(v) };
    }
    return { error: 'usage: vendor menu list|add|clear|show' };
  },

  announceVendors() {
    this.showPicker();
  },

  async openOrderFlow(query) {
    const q = String(query || '').trim();
    if (this.parseWantedItems(q).length && !this.looksLikeVendorOnly(q)) {
      return this.smartOrder(q);
    }
    await this.loadVendors();
    const u = this.userLatLng();
    if (!this.vendors.length) {
      ACIControl?.reply('No vendors on map yet');
      return;
    }
    MapDepict?.scanCity?.({ userLat: u.lat, userLng: u.lng, vendors: this.vendors.slice(0, 8), label: q || 'Shops near you' });
    if (q.length >= 2) {
      const hit = this.vendors.find(v => (v.name + ' ' + v.category).toLowerCase().includes(q.toLowerCase()));
      if (hit) { this.openVendor(hit); return; }
    }
    this.showPicker(q.length >= 2 ? q : '');
  },

  async orderPitogyra() {
    await this.smartOrder('pitogyra mpironia tsigareta');
  },
};
window.Commerce = Commerce;

// === ASTRANOV NODE — PWA/native install + decentralized batch work together ===
const AstranovNode = {
  batchId: null,
  shortId: null,
  nodeId: null,
  channel: null,
  rtChannel: null,
  peerCount: 0,
  deferredPrompt: null,
  _hb: null,
  _open: false,

  platform() {
    const ua = navigator.userAgent || '';
    if (/android/i.test(ua)) return 'android';
    if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
    return 'desktop';
  },

  isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true
      || localStorage.getItem('astranov_installed') === '1';
  },

  installMode() {
    if (this.isInstalled()) return this.platform() === 'ios' ? 'pwa-ios' : 'pwa';
    return 'browser';
  },

  async api(body) {
    if (Auth?.whenReady) await Auth.whenReady();
    const headers = Auth?.authHeaders ? await Auth.authHeaders() : sbHeaders();
    const fnBase = typeof resolveAstranovFunctionsUrl === 'function' ? resolveAstranovFunctionsUrl() : (SB_URL + '/functions/v1');
    const r = await fetch(fnBase + '/node-batch', {
      method: 'POST', headers,
      body: JSON.stringify(body),
    });
    return r.json().catch(() => ({}));
  },

  pos() {
    return window._lastPos || { lat: 36.4239, lng: 28.2245 };
  },

  getDeviceNodeId() {
    return AstranovSession?.getDeviceNodeId?.() || this.nodeId;
  },

  async resumeSession() {
    if (!Auth?.user) return null;
    const nodeId = this.getDeviceNodeId();
    const r = await this.api({
      action: 'resume',
      node_id: nodeId,
      device_id: AstranovSession?.deviceId?.(),
      platform: this.platform(),
      install_mode: this.installMode(),
      lat: this.pos().lat,
      lng: this.pos().lng,
      session_name: AstranovSession?.SESSION_NAME,
      batch_short_id: AstranovSession?.BATCH_SHORT_ID,
    });
    if (r.ok && r.resume) return this._applyBatchResult(r, { quiet: true });
    return null;
  },

  resumeFromServer(session) {
    if (!session?.shortId || !Auth?.user) return;
    if (this.batchId && this.shortId === session.shortId) return;
    this.api({
      action: 'resume',
      node_id: session.nodeId || this.getDeviceNodeId(),
      device_id: AstranovSession?.deviceId?.(),
      platform: this.platform(),
      install_mode: this.installMode(),
      lat: session.lastPos?.lat ?? this.pos().lat,
      lng: session.lastPos?.lng ?? this.pos().lng,
    }).then(r => {
      if (r.ok && (r.resume || r.batch_id)) this._applyBatchResult(r, { quiet: true });
    }).catch(() => {});
  },

  async _applyBatchResult(r, opts) {
    opts = opts || {};
    this.batchId = r.batch_id;
    this.shortId = r.short_id;
    this.nodeId = r.node_id;
    this.peerCount = r.peers || 1;

    await this.joinBatchChannel(r.channel || ('astranov-batch-' + r.short_id));
    this.startHeartbeat();
    const label = AstranovSession?.sessionLabel?.() || 'ASTRANOV COLLECTIVE INTELLIGENCE';
    if (!opts.quiet) {
      AciCli?.print('◎ ' + label + ' · ' + this.peerCount + ' device(s)', 'ok');
    } else {
      GlobeDeck?.setPreview?.('◎ ' + label + ' · ' + this.peerCount + ' device(s)');
    }
    GlobeDeck?.setTitle?.(label);
    if (window.AIGraphics?.setSuperBatchActive) {
      AIGraphics.setSuperBatchActive(true, { batchId: r.short_id, peers: this.peerCount, lat: this.pos().lat, lng: this.pos().lng });
    }
    return r;
  },

  init() {
    try {
      this.nodeId = AstranovSession?.getDeviceNodeId?.() || null;
    } catch { /* */ }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.deferredPrompt = e;
      this.updateInstallUI();
    });
    window.addEventListener('appinstalled', () => {
      localStorage.setItem('astranov_installed', '1');
      this.setStep(2, 'done', 'Εγκατεστημένο — Astranov node ενεργό');
      this.updateInstallUI();
      FieldBrain?.pulse('batch', 'pwa installed', { props: { visual_truth: true } });
    });
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
      navigator.serviceWorker.register('/sw.js').then(reg => {
        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          if (!worker) return;
          worker.addEventListener('statechange', () => {
            if (worker.state === 'installed' && navigator.serviceWorker.controller) {
              ACIControl?.reply('New Astranov build — tap logo to refresh');
            }
          });
        });
      }).catch(() => {});
      let reloaded = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloaded) return;
        reloaded = true;
        const build = document.querySelector('meta[name="astranov-build"]')?.content;
        if (build) {
          const url = new URL(location.href);
          url.searchParams.set('v', build);
          location.replace(url.toString());
        }
      });
    }
    this.bindUI();
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange((_e, session) => {
        if (session?.user) setTimeout(() => this.maybePromptInstall(), 4000);
      });
    }
    if (location.hash === '#install-android' || location.hash === '#install-ios') this.showPanel();
  },

  bindUI() {
    document.getElementById('nb-close')?.addEventListener('click', () => this.hidePanel());
    document.getElementById('nb-launch')?.addEventListener('click', () => this.launchBatch());
    document.getElementById('nb-install-android')?.addEventListener('click', () => this.installAndroid());
    document.getElementById('nb-install-ios')?.addEventListener('click', () => this.showIosHelp());
    document.getElementById('nb-join-comms')?.addEventListener('click', () => Comms?.startVHF?.());
  },

  showPanel() {
    this._open = true;
    GlobeDeck?.showStage('node-batch', 'batch');
    this.renderPlatform();
    this.updateInstallUI();
    MapDepict?.action('batch', { detail: 'work together · install node' });
  },

  hidePanel() {
    this._open = false;
    document.getElementById('node-batch')?.classList.remove('open', 'deck-active');
    if (GlobeDeck?.activeTask === 'batch') GlobeDeck?.completeTask('batch');
  },

  renderPlatform() {
    const el = document.getElementById('nb-platform');
    if (!el) return;
    const p = this.platform();
    const labels = { android: '🤖 Android', ios: '🍎 Apple iOS', desktop: '💻 Desktop' };
    el.textContent = labels[p] || p;
    const iosBox = document.getElementById('nb-ios-steps');
    const andBtn = document.getElementById('nb-install-android');
    const iosBtn = document.getElementById('nb-install-ios');
    if (iosBox) iosBox.style.display = p === 'ios' ? 'block' : 'none';
    if (iosBtn) iosBtn.style.display = p === 'ios' ? 'block' : 'none';
    if (andBtn) andBtn.style.display = p === 'ios' ? 'none' : 'block';
  },

  setStep(n, state, msg) {
    const el = document.getElementById('nb-step-' + n);
    if (!el) return;
    el.className = 'nb-step nb-' + state;
    const m = el.querySelector('.nb-step-msg');
    if (m) m.textContent = msg;
  },

  updateInstallUI() {
    const installed = this.isInstalled();
    const canPwa = !!this.deferredPrompt;
    const p = this.platform();
    if (installed) {
      this.setStep(2, 'done', 'Native/PWA node εγκατεστημένο — relay + comms ενεργά');
    } else if (p === 'ios') {
      this.setStep(2, 'active', 'Safari → Share → Add to Home Screen');
    } else if (canPwa) {
      this.setStep(2, 'active', 'Πάτα Εγκατάσταση Android — PWA node');
    } else {
      this.setStep(2, 'active', 'Εγκατάσταση native app (σύντομα) ή PWA από Chrome');
    }
    const st = document.getElementById('nb-status');
    if (st) {
      st.textContent = installed
        ? 'Node installed · batch channel: ' + (this.shortId || '—')
        : 'Εγκατάστησε Astranov node για δουλειά μαζί χωρίς browser tabs';
    }
  },

  maybePromptInstall() {
    if (this.isInstalled() || this._open) return;
    if (sessionStorage.getItem('astranov_install_nudge') === '1') return;
    sessionStorage.setItem('astranov_install_nudge', '1');
    this.showPanel();
    ACIControl?.reply('Εγκατάστησε Astranov node — δουλεύουμε μαζί από την εφαρμογή');
  },

  async installAndroid() {
    if (this.deferredPrompt) {
      this.deferredPrompt.prompt();
      const { outcome } = await this.deferredPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
      this.deferredPrompt = null;
      if (outcome === 'accepted') {
        localStorage.setItem('astranov_installed', '1');
        this.setStep(2, 'done', 'Εγκατάσταση ξεκίνησε — άνοιξε από home screen');
        AciCli?.print('Astranov PWA install accepted', 'ok');
        return;
      }
    }
    ACIControl?.reply('Chrome: Menu ⋮ → Install app · ή Add to Home Screen');
    AciCli?.print('No install prompt — use Chrome menu → Install Astranov', 'dim');
  },

  showIosHelp() {
    this.setStep(2, 'active', 'Safari Share ⬆️ → Add to Home Screen ➕ → open Astranov');
    ACIControl?.reply('iOS: Share → Add to Home Screen — μετά άνοιξε το Astranov icon');
    const box = document.getElementById('nb-ios-steps');
    if (box) box.style.display = 'block';
  },

  /** Rule: always verify basics before batch launch (think, session, bridge). */
  BATCH_RULE: 'Verify production basics before launching batch — never skip preflight.',

  async preflightVerify() {
    const checks = [];
    const record = (name, ok, detail) => { checks.push({ name, ok, detail }); return ok; };

    const session = Auth?.ensureSession ? await Auth.ensureSession() : null;
    if (!record('session', !!(session?.access_token), session?.access_token ? 'jwt ok' : 'expired — sign in again')) {
      return { ok: false, checks, error: 'session expired — tap G' };
    }

    try {
      const think = AciCli?.api
        ? await AciCli.api({ mode: 'think', prompt: 'ping' })
        : await ACI.api({ mode: 'think', prompt: 'ping' });
      const thinkText = String(think?.text || think?.response || '').trim();
      if (!record('aci think', !!thinkText && !think.error, thinkText ? thinkText.slice(0, 40) : (think?.error || 'no response'))) {
        return { ok: false, checks, error: 'ACI think unreachable' };
      }
    } catch (e) {
      record('aci think', false, String(e.message || e));
      return { ok: false, checks, error: 'ACI think failed' };
    }

    try {
      const headers = await Auth.authHeaders();
      const bridge = await fetchJson(SB_URL + '/functions/v1/coders-bridge', {
        method: 'POST', headers,
        body: JSON.stringify({ mode: 'pending', limit: 3 }),
      }, 20000);
      if (!record('coders bridge', !!bridge.ok, bridge.ok ? 'reachable' : (bridge.error || 'down'))) {
        return { ok: false, checks, error: 'coders bridge down' };
      }
    } catch (e) {
      record('coders bridge', false, String(e.message || e));
      return { ok: false, checks, error: 'coders bridge failed' };
    }

    try {
      const sync = await AciCli?.api({ mode: 'owner_sync' });
      record('owner sync', !!sync.ok, sync.is_owner ? 'owner' : 'user');
    } catch (e) {
      record('owner sync', false, String(e.message || e));
    }

    return { ok: true, checks };
  },

  async launchBatch() {
    if (!Auth?.user) {
      this.showPanel();
      this.setStep(1, 'active', 'Σύνδεση απαιτείται — πάτα G');
      Auth?.openLoginModal?.('Sign in to launch super batch');
      ACIControl?.reply('Sign in with G — then launch batch again');
      return;
    }

    this.showPanel();
    const who = AstranovSession?.isAstranov?.() ? 'ASTRANOV' : (Auth.user.email?.split('@')[0] || 'user');
    this.setStep(1, 'done', 'Συνδεδεμένος · ' + who);
    this.setStep(3, 'active', 'Σύνδεση στη συλλογική συνεδρία…');

    let existing = await this.resumeSession();
    if (!existing && AstranovSession?.isAstranov?.()) {
      await AstranovNode.api({ action: 'session_purge' });
      existing = await this.resumeSession();
    }
    if (existing) {
      const label = AstranovSession?.sessionLabel?.() || 'ASTRANOV COLLECTIVE INTELLIGENCE';
      const peerEl = document.getElementById('nb-peers');
      if (peerEl) peerEl.textContent = String(this.peerCount);
      const idEl = document.getElementById('nb-batch-id');
      if (idEl) idEl.textContent = label;
      this.setStep(3, 'done', label + ' · ' + this.peerCount + ' device(s)');
      ACIControl?.reply(label + ' · resumed on this device');
      return existing;
    }

    if (AstranovSession?.isAstranov?.()) {
      this.setStep(3, 'blocked', 'Collective session missing — retry');
      ACIControl?.reply('Collective session unavailable — refresh and sign in as ASTRANOV');
      return { ok: false, error: 'collective_unavailable' };
    }

    this.setStep(3, 'active', 'Preflight verify…');

    const pre = await this.preflightVerify();
    if (!pre.ok) {
      this.setStep(3, 'blocked', pre.error || 'preflight failed');
      const failed = (pre.checks || []).filter(c => !c.ok).map(c => c.name).join(', ');
      AciCli?.print('batch blocked — verify failed: ' + (failed || pre.error), 'err');
      ACIControl?.reply('Batch blocked — fix: ' + (pre.error || failed));
      return { ok: false, preflight: pre };
    }

    if (AciCli) {
      AciCli.print('preflight OK — ' + pre.checks.map(c => c.name).join(', '), 'ok');
    }
    this.setStep(3, 'active', 'Εκκίνηση batch…');

    const pos = this.pos();
    const r = await this.api({
      action: 'launch',
      node_id: this.getDeviceNodeId() || undefined,
      device_id: AstranovSession?.deviceId?.(),
      platform: this.platform(),
      install_mode: this.installMode(),
      lat: pos.lat,
      lng: pos.lng,
      session_name: AstranovSession?.SESSION_NAME,
      batch_short_id: AstranovSession?.BATCH_SHORT_ID,
      props: { ua: navigator.userAgent?.slice(0, 120), session_name: AstranovSession?.SESSION_NAME },
    });

    if (!r.ok) {
      this.setStep(3, 'blocked', r.error || 'batch failed');
      ACIControl?.reply('Batch failed: ' + (r.error || 'server'));
      return;
    }

    await this._applyBatchResult(r);
    this.peerCount = r.peers || 1;

    const peerEl = document.getElementById('nb-peers');
    if (peerEl) peerEl.textContent = String(this.peerCount);
    const idEl = document.getElementById('nb-batch-id');
    const label = AstranovSession?.sessionLabel?.() || r.short_id;
    if (idEl) idEl.textContent = label;

    this.setStep(3, 'done', label + ' · channel live');
    if (!this.isInstalled()) this.setStep(2, 'active', 'Εγκατάστασε node για πλήρη native relay');
    else this.setStep(2, 'done', 'Node ενεργό — decentralized server applet');

    this.registerSuperBookingSync();

    const resumed = r.resumed ? ' — same session on all devices' : '';
    const msg = label + ' live · ' + this.peerCount + ' device(s)' + resumed;
    ACIControl?.reply(msg);
    MapDepict?.action('batch', { lat: pos.lat, lng: pos.lng, detail: r.short_id + ' · ' + this.peerCount + ' nodes' });
    FieldBrain?.pulse('batch', r.short_id + ' · peers ' + this.peerCount, { role: 'client', props: { batch_id: r.batch_id, node_id: r.node_id } });

    document.getElementById('node-batch')?.classList.add('nb-super-live');
    const meshSt = document.getElementById('nb-mesh-status');
    if (meshSt) meshSt.textContent = 'mesh live · ' + this.peerCount + ' device(s)';
    if (window.AIGraphics?.setSuperBatchActive) {
      AIGraphics.setSuperBatchActive(true, { batchId: r.short_id, peers: this.peerCount, lat: pos.lat, lng: pos.lng });
    }
    if (window.SuperSpaceHud?.showBatch) SuperSpaceHud.showBatch(label, this.peerCount);

    if (Voice.maySpeak()) speak(msg.slice(0, 120), () => resumeListening());
  },

  /** Register local Astranov Decentralized Server for Astranov Sites sync relay */
  registerSuperBookingSync() {
    const port = localStorage.getItem('astranov_decentral_port') || '8787';
    const url = 'http://127.0.0.1:' + port;
    const meta = { platform: this.platform(), nodeId: this.nodeId, batchId: this.batchId };
    try {
      localStorage.setItem('astranov_decentral_node_v1', JSON.stringify({ url, registeredAt: Date.now(), ...meta }));
    } catch { /* */ }
    const decentral = window.AstranovSitesDecentral || window.SuperBookingDecentral;
    if (decentral?.registerNode) decentral.registerNode(url, meta);
    AciCli?.print('Astranov Sites sync node · ' + url + '/superbooking/sync', 'ok');
  },

  async joinBatchChannel(name) {
    if (!Auth?.client || !name) return;
    if (this.rtChannel) {
      try { await Auth.client.removeChannel(this.rtChannel); } catch { /* */ }
      this.rtChannel = null;
    }
    this.channel = name;
    this.rtChannel = Auth.client.channel(name, { config: { broadcast: { ack: true, self: true }, presence: { key: this.nodeId || Auth.user.id } } });
    this.rtChannel.on('broadcast', { event: 'collab' }, ({ payload }) => this.onCollab(payload));
    this.rtChannel.on('presence', { event: 'sync' }, () => {
      const state = this.rtChannel.presenceState();
      const n = Object.keys(state).length;
      this.peerCount = Math.max(n, this.peerCount);
      const peerEl = document.getElementById('nb-peers');
      if (peerEl) peerEl.textContent = String(this.peerCount);
    });
    await this.rtChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        await this.rtChannel.track({
          node_id: this.nodeId,
          user: AstranovSession?.isAstranov?.() ? 'ASTRANOV' : (Auth.user?.email?.split('@')[0] || 'user'),
          platform: this.platform(),
          install: this.installMode(),
        });
        this.rtChannel.send({
          type: 'broadcast',
          event: 'collab',
          payload: { type: 'hello', from: this.nodeId, batch: this.shortId },
        });
      }
    });
  },

  onCollab(payload) {
    if (!payload || payload.from === this.nodeId) return;
    if (payload.type === 'hello') {
      this.peerCount++;
      const peerEl = document.getElementById('nb-peers');
      if (peerEl) peerEl.textContent = String(this.peerCount);
      MapDepict?.pulse(this.pos().lat, this.pos().lng, 0xaa88ff, 'peer joined super batch', 8000);
      if (window.AIGraphics?.pulseBatchMesh) AIGraphics.pulseBatchMesh(this.peerCount);
      const meshSt = document.getElementById('nb-mesh-status');
      if (meshSt) meshSt.textContent = 'mesh · ' + this.peerCount + ' device(s)';
    }
    if (payload.type === 'task' && payload.text) {
      AciCli?.print('batch task · ' + payload.text.slice(0, 100), 'dim');
    }
  },

  broadcastTask(text) {
    this.rtChannel?.send({
      type: 'broadcast',
      event: 'collab',
      payload: { type: 'task', from: this.nodeId, text: String(text || '').slice(0, 300) },
    });
  },

  startHeartbeat() {
    if (this._hb) clearInterval(this._hb);
    this._hb = setInterval(async () => {
      if (!this.nodeId || !this.batchId) return;
      const pos = this.pos();
      const r = await this.api({
        action: 'heartbeat',
        node_id: this.nodeId,
        batch_id: this.batchId,
        lat: pos.lat,
        lng: pos.lng,
      });
      if (r.peers != null) {
        this.peerCount = r.peers;
        const peerEl = document.getElementById('nb-peers');
        if (peerEl) peerEl.textContent = String(r.peers);
      }
    }, 90000);
  },
};

window.AstranovNode = AstranovNode;

// ── COMMS: phone + EU PMR (real audio, no simulation) ──
const Comms = {
  vhfActive: false,
  pmr: { channel: 11, freqMHz: 446.13125, label: 'EU PMR 11' },

  async startPhone() {
    await SuperCli?.run('phone');
  },

  startVHF() {
    if (this.vhfActive && PmrRadio?.open) {
      GlobeDeck?.showStage('sat-radio', 'radio');
      return;
    }
    this.vhfActive = true;
    PmrRadio.show();
  },

  startTelecomms() {
    this.startVHF();
  }
};

// ── NEWS (real RSS) ──
const NewsFeed = {
  items: [],
  async fetch() {
    try {
      const url = 'https://api.allorigins.win/raw?url=' + encodeURIComponent('https://feeds.bbci.co.uk/news/world/rss.xml');
      const r = await fetch(url);
      const xml = await r.text();
      const titles = [...xml.matchAll(/<title>(?:<!\[CDATA\[)?([^\]<]+)/g)].map(m => m[1]).filter(t => t.length > 12 && !t.includes('BBC'));
      const max = SlumberManager?.quality?.newsMax ?? 8;
      this.items = max > 0 ? titles.slice(0, max) : [];
    } catch { this.items = ['Astranov Collective Intelligence online', 'Globe trackball active', 'ACI ready for orders and comms']; }
    this.tick();
  },
  tick() {
    if (!SlumberManager?.allows?.('news')) return;
    if (!this.items.length) return;
    const interval = SlumberManager?.tickMs?.('news') || 12000;
    if (!interval) return;
    const i = Math.floor(Date.now() / interval) % this.items.length;
    const line = (AstroGlyphs?.news || '📰') + ' ' + this.items[i];
    if (GlobeDeck && !GlobeDeck.thinking && !GlobeDeck._userEngaged) {
      GlobeDeck.setPreview(line);
    }
  },
  flash() {
    SlumberManager?.wake?.('news', 'news');
    this.fetch();
    const u = window._lastPos || { lat: 36.44, lng: 28.22 };
    MapDepict.action('news', { lat: u.lat, lng: u.lng, detail: (this.items[0] || '').slice(0, 50) });
    GlobeControl?.flyToLatLng?.(u.lat, u.lng, 'news', GlobeControl?.Z?.global);
    if (Voice.maySpeak()) speak((this.items[0] || 'News').slice(0, 100), () => resumeListening());
  }
};
window.Comms = Comms;
window.NewsFeed = NewsFeed;

// === PMR RADIO — REAL AUDIO ONLY (no simulation) ===
// Browser cannot transmit 446.13125 MHz RF. Real: mic PTT + WebRTC voice mesh.
// Physical PMR446 Ch11: tune YOUR handheld — app shows exact frequency.
const PmrRadio = {
  open: false,
  channel: 11,
  freqMHz: 446.13125,
  callsign: 'ASTRANOV-AXAS',
  peerId: null,
  micStream: null,
  audioCtx: null,
  micGain: null,
  analyser: null,
  pttDown: false,
  pc: null,
  remoteAudio: null,
  rtChannel: null,
  peerCount: 0,
  micReady: false,
  channelLive: false,
  vuAnim: null,

  async show() {
    this.open = true;
    GlobeDeck?.showStage('sat-radio', 'radio');
    this.setFreqUI();
    this.setStep(1, 'active', 'Tap Enable Mic — browser will ask permission');
    const up = window._lastPos || { lat: 36.22, lng: 28.12 };
    MapDepict.action('vhf', { lat: up.lat, lng: up.lng, detail: 'EU PMR 11 · setup' });
    ACIControl.reply('PMR Ch11 446.13125 MHz — follow the 3 steps below. No simulation.');
  },

  hide() {
    this.open = false;
    this.pttDown = false;
    document.getElementById('sat-radio')?.classList.remove('open', 'deck-active');
    if (GlobeDeck?.activeTask === 'radio') GlobeDeck?.completeTask('radio');
    if (this.vuAnim) cancelAnimationFrame(this.vuAnim);
    this.teardown();
    if (Comms) Comms.vhfActive = false;
  },

  setFreqUI() {
    const ch = document.querySelector('.sr-ch');
    const fq = document.querySelector('.sr-freq');
    if (ch) ch.textContent = 'EU PMR Ch ' + this.channel;
    if (fq) fq.textContent = this.freqMHz + ' MHz';
  },

  setStep(n, state, msg) {
    const el = document.getElementById('sr-step-' + n);
    if (!el) return;
    el.className = 'sr-step sr-' + state;
    el.querySelector('.sr-step-msg').textContent = msg;
  },

  setStatus(line) {
    const el = document.getElementById('sr-status');
    if (el) el.textContent = line;
    ACIControl?.reply(line.slice(0, 220));
  },

  async enableMic() {
    this.setStep(1, 'active', 'Requesting microphone…');
    try {
      this.teardownMic();
      this.micStream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false
      });
      this.micStream.getAudioTracks().forEach(t => { t.enabled = false; });
      this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const src = this.audioCtx.createMediaStreamSource(this.micStream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 256;
      this.micGain = this.audioCtx.createGain();
      this.micGain.gain.value = 0;
      src.connect(this.analyser);
      src.connect(this.micGain);
      this.micReady = true;
      this.setStep(1, 'done', 'Microphone ON — hold PTT to test level meter');
      this.setStep(2, 'active', 'Tap Join Channel for live WebRTC voice');
      this.startVuMeter();
      this.setStatus('Mic ready. Hold PTT — meter must move when you speak.');
    } catch (err) {
      this.setStep(1, 'blocked', 'Mic blocked: ' + (err.message || 'denied') + ' — allow mic in browser settings');
      this.setStatus('Cannot continue without microphone permission.');
    }
  },

  startVuMeter() {
    const bar = document.getElementById('sr-vu');
    if (!bar || !this.analyser) return;
    const data = new Uint8Array(this.analyser.frequencyBinCount);
    const tick = () => {
      if (!this.open) return;
      this.analyser.getByteFrequencyData(data);
      let sum = 0;
      for (let i = 0; i < data.length; i++) sum += data[i];
      const level = Math.min(100, Math.round((sum / data.length) * 1.2));
      bar.style.width = level + '%';
      bar.style.opacity = this.pttDown ? '1' : '0.5';
      this.vuAnim = requestAnimationFrame(tick);
    };
    tick();
  },

  async joinChannel() {
    if (!this.micReady) {
      this.setStatus('Step 1 first: Enable Mic.');
      return;
    }
    this.setStep(2, 'active', 'Joining voice channel pmr-ch11…');
    const sbUrl = typeof resolveAstranovSupabaseClientUrl === 'function' ? resolveAstranovSupabaseClientUrl() : SB_URL;
    const sb = typeof supabase !== 'undefined' ? supabase.createClient(sbUrl, SB_KEY) : null;
    if (!sb) {
      this.setStep(2, 'blocked', 'Supabase unavailable — cannot open live voice channel');
      return;
    }
    this.peerId = 'pmr-' + Date.now() + '-' + Math.random().toString(36).slice(2, 7);
    const chName = 'pmr-voice-ch11-44613125';
    this.rtChannel = sb.channel(chName, { config: { broadcast: { ack: true, self: false } } });
    this.rtChannel.on('broadcast', { event: 'sig' }, ({ payload }) => this.onSignal(payload));
    await this.rtChannel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        this.channelLive = true;
        this.setStep(2, 'done', 'Channel LIVE — open astranov.eu on another device & join too');
        this.setStep(3, 'active', 'Hold PTT: real voice TX · release: RX listen');
        this.setStatus('Channel live. Peers: 0. Hold PTT and speak — VU meter must peak.');
        this.setupPeer();
        this.rtChannel.send({ type: 'broadcast', event: 'sig', payload: { type: 'hello', from: this.peerId } });
      }
    });
  },

  setupPeer() {
    if (this.pc) { this.pc.close(); this.pc = null; }
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }, { urls: 'stun:stun1.l.google.com:19302' }]
    });
    this.pc.ontrack = (ev) => {
      if (!this.remoteAudio) {
        this.remoteAudio = document.createElement('audio');
        this.remoteAudio.autoplay = true;
        this.remoteAudio.id = 'pmr-remote-audio';
        document.body.appendChild(this.remoteAudio);
      }
      this.remoteAudio.srcObject = ev.streams[0];
      this.setStatus('RX: receiving real audio from peer');
      MapDepict.action('vhf', { detail: 'RX peer audio' });
    };
    this.pc.onicecandidate = (ev) => {
      if (ev.candidate) this.broadcast({ type: 'ice', from: this.peerId, candidate: ev.candidate });
    };
    this.pc.oniceconnectionstatechange = () => {
      const s = this.pc?.iceConnectionState;
      if (s === 'connected') this.setStatus('WebRTC connected — real two-way voice active');
      if (s === 'failed' || s === 'disconnected') this.setStatus('WebRTC ' + s + ' — tap Join Channel again');
    };
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => this.pc.addTrack(t, this.micStream));
    }
  },

  broadcast(payload) {
    this.rtChannel?.send({ type: 'broadcast', event: 'sig', payload });
  },

  async onSignal(payload) {
    if (!payload || payload.from === this.peerId) return;
    if (payload.type === 'hello') {
      this.peerCount++;
      document.getElementById('sr-peers').textContent = String(this.peerCount);
      if (this.pc.signalingState === 'stable') {
        const offer = await this.pc.createOffer();
        await this.pc.setLocalDescription(offer);
        this.broadcast({ type: 'offer', from: this.peerId, sdp: offer });
      }
    }
    if (payload.type === 'offer' && payload.sdp) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      this.broadcast({ type: 'answer', from: this.peerId, sdp: answer });
    }
    if (payload.type === 'answer' && payload.sdp) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
    }
    if (payload.type === 'ice' && payload.candidate) {
      try {
        await this.pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch (_) {}
    }
  },

  pttPress() {
    if (!this.micReady) {
      this.setStatus('Enable Mic first (step 1).');
      return;
    }
    this.pttDown = true;
    this.micStream?.getAudioTracks().forEach(t => { t.enabled = true; });
    if (this.micGain) this.micGain.gain.value = 1;
    document.getElementById('sr-ptt')?.classList.add('active');
    this.setStatus(this.channelLive ? 'TX LIVE — mic open on WebRTC channel' : 'TX local test — VU must move; step 2 for peers');
    MapDepict.action('vhf', { detail: 'PTT TX live' });
  },

  pttRelease() {
    this.pttDown = false;
    this.micStream?.getAudioTracks().forEach(t => { t.enabled = false; });
    if (this.micGain) this.micGain.gain.value = 0;
    document.getElementById('sr-ptt')?.classList.remove('active');
    this.setStatus(this.channelLive ? 'RX — mic muted, listening for peers' : 'Standby — mic muted');
  },

  teardownMic() {
    if (this.micStream) {
      this.micStream.getTracks().forEach(t => t.stop());
      this.micStream = null;
    }
    if (this.audioCtx) { this.audioCtx.close().catch(() => {}); this.audioCtx = null; }
    this.micReady = false;
  },

  teardown() {
    this.teardownMic();
    if (this.pc) { this.pc.close(); this.pc = null; }
    if (this.rtChannel) { this.rtChannel.unsubscribe(); this.rtChannel = null; }
    if (this.remoteAudio) { this.remoteAudio.remove(); this.remoteAudio = null; }
    this.channelLive = false;
    this.peerCount = 0;
  },

  bindUI() {
    document.getElementById('sr-mic-btn')?.addEventListener('click', () => this.enableMic());
    document.getElementById('sr-join-btn')?.addEventListener('click', () => this.joinChannel());
    const ptt = document.getElementById('sr-ptt');
    if (ptt) {
      const down = (e) => { e.preventDefault(); this.pttPress(); };
      const up = () => this.pttRelease();
      ptt.addEventListener('mousedown', down);
      ptt.addEventListener('touchstart', down, { passive: false });
      ptt.addEventListener('mouseup', up);
      ptt.addEventListener('mouseleave', up);
      ptt.addEventListener('touchend', up);
    }
    document.getElementById('sr-close')?.addEventListener('click', () => this.hide());
  }
};

window.PmrRadio = PmrRadio;
window.SatRadio = PmrRadio;

// === SUPER ADD (+) — camera video post · channels · vendor · driver · map pin ===
const SuperAdd = {
  _stream: null,
  _recorder: null,
  _chunks: [],
  _blob: null,
  _facing: 'user',
  _recording: false,
  _markers: [],

  CHANNELS: [
    { id: 'global', label: 'Global channel' },
    { id: 'team', label: 'Team / batch' },
    { id: 'local', label: 'Local · near me' },
    { id: 'custom', label: 'Type channel…' },
  ],

  init() {
    document.getElementById('sa-close')?.addEventListener('click', () => this.hide());
    document.getElementById('sa-flip')?.addEventListener('click', () => this.flipCamera());
    document.getElementById('sa-record')?.addEventListener('click', () => this.toggleRecord());
    document.getElementById('sa-post')?.addEventListener('click', () => this.publish());
    document.getElementById('sa-channel')?.addEventListener('change', () => this._syncChannelUi());
    document.getElementById('sa-as-vendor')?.addEventListener('change', e => {
      const n = document.getElementById('sa-vendor-name');
      if (n) n.style.display = e.target.checked ? 'block' : 'none';
    });
    document.getElementById('sa-as-booker')?.addEventListener('change', e => {
      const on = e.target.checked;
      ['sa-booker-slug', 'sa-booker-name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.style.display = on ? 'block' : 'none';
      });
    });
    document.getElementById('super-add-fab')?.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      this.open();
    });
    this._syncChannelUi();
    this.loadPostsOnGlobe();
  },

  open() {
    GlobeDeck?.expand?.(SuperCli?.title || 'Astranov Command Line');
    this.showPanel();
    this.startCamera();
    SuperCli?.setContext?.('add');
    AciCli?.print('▸ super add · camera', 'cmd');
  },

  hide() {
    this.stopCamera();
    document.getElementById('globe-super-add')?.classList.remove('open', 'deck-active');
    if (GlobeDeck?.activeTask === 'add') GlobeDeck?.completeTask?.('add');
    SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
  },

  showPanel() {
    GlobeDeck?.showStage?.('globe-super-add', 'add', 'Super Add · post video');
    const panel = document.getElementById('globe-super-add');
    if (panel) panel.classList.add('open', 'deck-active');
    const batch = AstranovNode?.shortId;
    const teamOpt = document.getElementById('sa-channel-team');
    if (teamOpt) teamOpt.textContent = batch ? ('Team · batch ' + batch) : 'Team · launch batch first';
  },

  _syncChannelUi() {
    const sel = document.getElementById('sa-channel');
    const custom = document.getElementById('sa-channel-custom');
    if (!sel || !custom) return;
    custom.style.display = sel.value === 'custom' ? 'block' : 'none';
  },

  _videoEl() {
    return document.getElementById('sa-preview');
  },

  async startCamera() {
    if (!navigator.mediaDevices?.getUserMedia) {
      ACIControl?.reply('Camera not supported in this browser');
      return;
    }
    try {
      await this.stopCamera();
      this._stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: this._facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      });
      const v = this._videoEl();
      if (v) {
        v.srcObject = this._stream;
        v.muted = true;
        await v.play().catch(() => {});
      }
      document.getElementById('sa-status')?.replaceChildren(document.createTextNode('Camera ready · tap ● to record'));
    } catch (e) {
      ACIControl?.reply('Camera denied — allow camera in browser settings');
      AciCli?.print('camera error: ' + (e.message || e), 'err');
    }
  },

  async stopCamera() {
    if (this._recording) await this.stopRecord();
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    const v = this._videoEl();
    if (v) v.srcObject = null;
  },

  async flipCamera() {
    this._facing = this._facing === 'user' ? 'environment' : 'user';
    await this.startCamera();
    AciCli?.print('camera → ' + (this._facing === 'user' ? 'front' : 'back'), 'dim');
  },

  async toggleRecord() {
    if (this._recording) await this.stopRecord();
    else await this.startRecord();
  },

  async startRecord() {
    if (!this._stream) { await this.startCamera(); if (!this._stream) return; }
    this._chunks = [];
    this._blob = null;
    const mime = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
      ? 'video/webm;codecs=vp9,opus'
      : (MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4');
    try {
      this._recorder = new MediaRecorder(this._stream, { mimeType: mime });
    } catch {
      this._recorder = new MediaRecorder(this._stream);
    }
    this._recorder.ondataavailable = e => { if (e.data?.size) this._chunks.push(e.data); };
    this._recorder.onstop = () => {
      this._blob = new Blob(this._chunks, { type: this._recorder.mimeType || 'video/webm' });
      const playback = document.getElementById('sa-playback');
      if (playback) {
        playback.src = URL.createObjectURL(this._blob);
        playback.classList.add('has-clip');
      }
    };
    this._recorder.start(400);
    this._recording = true;
    const btn = document.getElementById('sa-record');
    if (btn) { btn.textContent = '■ Stop'; btn.classList.add('recording'); }
    document.getElementById('sa-status')?.replaceChildren(document.createTextNode('Recording…'));
  },

  async stopRecord() {
    if (!this._recorder || this._recorder.state === 'inactive') {
      this._recording = false;
      return;
    }
    return new Promise(resolve => {
      this._recorder.onstop = () => {
        this._blob = new Blob(this._chunks, { type: this._recorder.mimeType || 'video/webm' });
        const playback = document.getElementById('sa-playback');
        if (playback) {
          playback.src = URL.createObjectURL(this._blob);
          playback.classList.add('has-clip');
        }
        resolve();
      };
      this._recorder.stop();
      this._recording = false;
      const btn = document.getElementById('sa-record');
      if (btn) { btn.textContent = '● Record'; btn.classList.remove('recording'); }
      document.getElementById('sa-status')?.replaceChildren(document.createTextNode('Clip ready · choose channel & post'));
    });
  },

  _channelValue() {
    const sel = document.getElementById('sa-channel');
    const custom = document.getElementById('sa-channel-custom');
    const v = sel?.value || 'global';
    if (v === 'team') return AstranovNode?.channel || ('batch-' + (AstranovNode?.shortId || 'team'));
    if (v === 'local') return 'local';
    if (v === 'custom') return (custom?.value || '').trim() || 'custom';
    return 'global';
  },

  async _uploadVideo(blob) {
    if (!Auth?.user || !Auth?.client) throw new Error('login required — tap G');
    const ext = (blob.type || '').includes('mp4') ? 'mp4' : 'webm';
    const path = Auth.user.id + '/' + Date.now() + '.' + ext;
    const { error } = await Auth.client.storage.from('posts').upload(path, blob, {
      contentType: blob.type || 'video/webm',
      upsert: false,
    });
    if (error) throw new Error(error.message || 'upload failed');
    const { data } = Auth.client.storage.from('posts').getPublicUrl(path);
    return data?.publicUrl || (SB_URL + '/storage/v1/object/public/posts/' + path);
  },

  async registerDriver() {
    if (!Auth?.user) return;
    const pos = window._lastPos || {};
    const roles = Array.from(new Set([...(FieldBrain?.roles || ['client']), 'driver']));
    const headers = await Auth.authHeaders();
    await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + Auth.user.id, {
      method: 'PATCH', headers,
      body: JSON.stringify({ roles, field_lat: pos.lat ?? null, field_lng: pos.lng ?? null, field_seen_at: new Date().toISOString() }),
    });
    FieldBrain.roles = roles;
    FieldBrain?.updateChip?.();
    FieldBrain?.pulse?.('roles_sync', 'driver via Super Add', { role: 'driver' });
    AciCli?.print('registered as driver · visible to deliveries', 'ok');
  },

  async registerVendor(name) {
    if (!Auth?.user) return;
    const pos = window._lastPos || { lat: 36.44, lng: 28.22 };
    const vname = String(name || '').trim() || (Auth.user.user_metadata?.full_name || 'My shop');
    const v = await Commerce?.enlistVendorAt?.(pos.lat, pos.lng, { name: vname, category: 'field_add' });
    return v?.id || null;
  },

  async pinMapDiscovery(caption, channel) {
    const pos = window._lastPos || { lat: 36.44, lng: 28.22 };
    MapDepict?.action?.('explore', { lat: pos.lat, lng: pos.lng, detail: caption || 'discovery' });
    this._placeMarker(pos.lat, pos.lng, caption || 'Found here', channel);
    FieldBrain?.pulse?.('explore', caption || 'map discovery', { role: 'client' });
  },

  _placeMarker(lat, lng, label, channel, url) {
    GlobeEntity?.syncPost?.({ id: 'live-' + Date.now(), lat, lng, text: label, channel, mode: url ? 'video' : 'text', url, author: Auth?.user?.email?.split('@')[0] });
  },

  async publish() {
    const caption = (document.getElementById('sa-caption')?.value || '').trim();
    const asVendor = document.getElementById('sa-as-vendor')?.checked;
    const asDriver = document.getElementById('sa-as-driver')?.checked;
    const asBooker = document.getElementById('sa-as-booker')?.checked;
    const asMap = document.getElementById('sa-as-map')?.checked;
    const vendorName = (document.getElementById('sa-vendor-name')?.value || '').trim();
    const bookerSlug = (document.getElementById('sa-booker-slug')?.value || '').trim();
    const bookerName = (document.getElementById('sa-booker-name')?.value || '').trim();
    const channel = this._channelValue();

    if (!Auth?.user) {
      ACIControl?.reply('Sign in (G) to post');
      Auth?.openLoginModal?.('Sign in to post');
      return;
    }

    if (!userLocated && navigator.geolocation) {
      await new Promise(resolve => {
        navigator.geolocation.getCurrentPosition(p => {
          placeMe(p.coords.latitude, p.coords.longitude, { quiet: true, markerOnly: true });
          resolve();
        }, () => resolve());
      });
    }

    const pos = window._lastPos || { lat: 36.44, lng: 28.22 };
    const author = Auth.user.user_metadata?.full_name || Auth.user.email?.split('@')[0] || 'user';
    GlobeDeck?.setThinking?.(true, 'Posting…');

    try {
      let url = '';
      if (this._blob && this._blob.size > 800) {
        url = await this._uploadVideo(this._blob);
      }

      const postId = 'p-' + Date.now().toString(36);
      const headers = await Auth.authHeaders();
      const row = {
        id: postId,
        channel,
        author,
        url: url || null,
        mode: url ? 'video' : 'text',
        lat: pos.lat,
        lng: pos.lng,
        text: caption || (asMap ? 'Map discovery' : 'Super Add'),
      };
      const ins = await fetch(SB_URL + '/rest/v1/posts', { method: 'POST', headers, body: JSON.stringify(row) });
      if (!ins.ok) {
        const j = await ins.json().catch(() => ({}));
        throw new Error(j.message || j.error || 'post save failed');
      }

      if (asDriver) await this.registerDriver();
      let vendorId = null;
      if (asVendor) vendorId = await this.registerVendor(vendorName || caption);
      if (asBooker) {
        const prov = window.AstranovSitesProvision || window.SuperBookingProvision;
        const parsed = prov?.parseAsk?.(bookerSlug || bookerName || caption || vendorName) || {};
        await prov?.provision?.({
          slug: bookerSlug || parsed.slug,
          business_name: bookerName || parsed.name || vendorName || caption,
          business_type: parsed.businessType,
          mode: parsed.mode,
          vendor_id: vendorId,
        });
      }
      if (asMap || url) this._placeMarker(pos.lat, pos.lng, caption || author, channel, url);

      if (channel === 'global' || channel === 'local') {
        MapDepict?.action?.('video', { lat: pos.lat, lng: pos.lng, detail: caption || 'posted' });
      }

      FieldBrain?.pulse?.('post', channel + ' · ' + (caption || 'video').slice(0, 80), { role: 'client' });
      AciCli?.print('posted → ' + channel + (url ? ' · video' : ' · pin'), 'ok');
      ACIControl?.reply('Posted to ' + channel + (asVendor ? ' · vendor on map' : '') + (asBooker ? ' · Astranov Site' : '') + (asDriver ? ' · driver on' : ''));
      GlobeDeck?.setPreview?.('➕ posted · ' + channel);

      this._blob = null;
      this._chunks = [];
      const playback = document.getElementById('sa-playback');
      if (playback) { playback.removeAttribute('src'); playback.classList.remove('has-clip'); }
      const cap = document.getElementById('sa-caption');
      if (cap) cap.value = '';
    } catch (e) {
      AciCli?.print('post failed: ' + (e.message || e), 'err');
      ACIControl?.reply('Post failed — ' + (e.message || e));
    } finally {
      GlobeDeck?.setThinking?.(false);
    }
  },

  async loadPostsOnGlobe() {
    try {
      const r = await fetch(SB_URL + '/rest/v1/posts?select=id,channel,author,url,mode,lat,lng,text&order=created_at.desc&limit=24', {
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
      });
      const rows = r.ok ? await r.json() : [];
      rows.forEach(p => {
        if (p.lat == null) return;
        GlobeEntity?.syncPost?.(p);
      });
    } catch { /* */ }
  },

  stop() {
    this.stopCamera();
  },
};
window.SuperAdd = SuperAdd;

// === YOUTUBE ON GLOBE — search + watch in Astranov Command Line deck ===
const GlobeVideo = {
  _results: [],
  _currentId: null,
  _lastQuery: '',

  PIPED: [
    'https://pipedapi.kavin.rocks',
    'https://pipedapi.adminforge.de',
    'https://api.piped.projectsegfau.lt',
  ],

  init() {
    document.getElementById('yt-close')?.addEventListener('click', () => this.hide());
    document.getElementById('yt-open-ext')?.addEventListener('click', () => {
      if (this._currentId) window.open('https://www.youtube.com/watch?v=' + this._currentId, '_blank', 'noopener');
    });
  },

  parseId(input) {
    const s = String(input || '').trim();
    if (!s) return null;
    const m1 = s.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/i);
    if (m1) return m1[1];
    if (/^[A-Za-z0-9_-]{11}$/.test(s)) return s;
    return null;
  },

  async pipedSearch(query) {
    const q = encodeURIComponent(query);
    let lastErr = '';
    for (const base of this.PIPED) {
      try {
        const r = await fetch(base + '/search?q=' + q + '&filter=videos', {
          headers: { Accept: 'application/json' },
        });
        if (!r.ok) { lastErr = r.status + ' ' + base; continue; }
        const items = await r.json();
        if (!Array.isArray(items) || !items.length) { lastErr = 'empty ' + base; continue; }
        return items.slice(0, 8).map((it, i) => {
          const url = it.url || '';
          const id = it.id || this.parseId(url) || this.parseId('https://youtube.com' + url);
          return {
            id,
            title: it.title || ('Video ' + (i + 1)),
            channel: it.uploaderName || it.uploader || '',
            duration: it.duration || 0,
            thumbnail: it.thumbnail,
          };
        }).filter(v => v.id);
      } catch (e) {
        lastErr = String(e.message || e);
      }
    }
    throw new Error(lastErr || 'search failed');
  },

  showPanel(title) {
    GlobeDeck?.showStage('globe-youtube', 'video', title || 'YouTube on globe');
    SuperCli?.setContext?.('idle');
    const panel = document.getElementById('globe-youtube');
    if (panel) panel.classList.add('open', 'deck-active');
  },

  hide() {
    this.stop();
    document.getElementById('globe-youtube')?.classList.remove('open', 'deck-active');
    if (GlobeDeck?.activeTask === 'video') GlobeDeck?.completeTask('video');
    SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
  },

  stop() {
    const frame = document.getElementById('yt-frame');
    if (frame) frame.src = 'about:blank';
    this._currentId = null;
    SuperSpace?.stop?.();
  },

  renderResults(items, query) {
    const list = document.getElementById('yt-results');
    if (!list) return;
    list.innerHTML = '';
    items.forEach((v, i) => {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'yt-row';
      const mins = v.duration ? Math.floor(v.duration / 60) + ':' + String(v.duration % 60).padStart(2, '0') : '';
      row.innerHTML = '<span class="yt-n">' + (i + 1) + '</span>'
        + '<span class="yt-meta"><b>' + this.esc(v.title) + '</b>'
        + '<small>' + this.esc(v.channel) + (mins ? ' · ' + mins : '') + '</small></span>';
      row.onclick = () => this.play(v.id, v, this._lastQuery);
      list.appendChild(row);
    });
    const hint = document.getElementById('yt-hint');
    if (hint) hint.textContent = items.length
      ? 'Tap a result or type: play 2 · ' + query
      : 'No results — try another search';
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  async play(videoId, meta, searchQuery) {
    const id = this.parseId(videoId);
    if (!id) {
      AciCli?.print('invalid video id', 'err');
      return;
    }
    this._currentId = id;
    const title = meta?.title || id;
    await SuperSpace?.locateForMedia?.(searchQuery || title, meta);
    window.MapComms?.showCloudVideo?.(id, title);
    this.showPanel(title.slice(0, 48));
    const frame = document.getElementById('yt-frame');
    const titleEl = document.getElementById('yt-now-title');
    if (titleEl) titleEl.textContent = title;
    if (frame) {
      frame.src = 'https://www.youtube-nocookie.com/embed/' + id
        + '?autoplay=1&rel=0&modestbranding=1&playsinline=1';
    }
    GlobeDeck?.expand('YouTube · ' + title.slice(0, 40));
    AciCli?.print('▶ ' + title, 'ok');
    ACIControl?.reply('SuperSpace + SuperCli — ' + title.slice(0, 80));
    MapDepict?.action('video', { detail: title.slice(0, 40) });
    AciCoders?.observeActivity?.('youtube', title.slice(0, 80));
    FieldBrain?.pulse?.('media', 'youtube · ' + title.slice(0, 60), { role: 'client' });
  },

  async find(query) {
    this._lastQuery = String(query || '').trim();
    const q = String(query || '').trim();
    if (!q) {
      ACIControl?.reply('usage: youtube <search> · watch <url> · find video about …');
      return { error: 'empty' };
    }
    const direct = this.parseId(q);
    if (direct) {
      await this.play(direct, { title: q }, q);
      return { ok: true, id: direct };
    }

    this.showPanel('Searching YouTube…');
    GlobeDeck?.setThinking(true, 'Finding videos…');
    AciCli?.print('youtube search · ' + q, 'cmd');

    try {
      const items = await this.pipedSearch(q);
      this._results = items;
      this.renderResults(items, q);
      GlobeDeck?.setThinking(false);
      if (!items.length) {
        AciCli?.print('no videos found', 'err');
        return { error: 'empty' };
      }
      items.forEach((v, i) => {
        AciCli?.print((i + 1) + '. ' + v.title.slice(0, 70) + (v.channel ? ' · ' + v.channel : ''), 'dim');
      });
      ACIControl?.reply('Found ' + items.length + ' — brain locating #1 on globe');
      await this.play(items[0].id, items[0], q);
      return { ok: true, count: items.length };
    } catch (e) {
      GlobeDeck?.setThinking(false);
      const msg = 'YouTube search failed: ' + (e.message || e);
      AciCli?.print(msg, 'err');
      ACIControl?.reply('Search failed — try again or paste a youtube link');
      return { error: msg };
    }
  },

  async playIndex(n) {
    const idx = parseInt(n, 10) - 1;
    const v = this._results[idx];
    if (!v) {
      AciCli?.print('no result #' + n + ' — search first', 'err');
      return;
    }
    await this.play(v.id, v, this._lastQuery);
  },

  wantsYoutube(text) {
    const low = String(text || '').toLowerCase();
    return /youtube|youtu\.be|^yt\b|find\s+(me\s+)?(a\s+)?videos?\b|watch\s+.*video|βίντεο\s+(για|στο)|δες\s+(βίντεο|youtube)|παρακολούθησε|show\s+me\s+.*video/.test(low)
      || this.parseId(text);
  },

  queryFromText(text) {
    return String(text || '')
      .replace(/^(youtube|yt|find\s+videos?\s+(about|on|for)?|find\s+me\s+a\s+video\s+(about|on|for)?|watch\s+videos?\s+(about|on|for)?|watch|video\s+find|βίντεο\s+(για|στο)?|δες\s+βίντεο\s+(για|στο)?|παρακολούθησε)\s*/i, '')
      .trim();
  },
};
window.GlobeVideo = GlobeVideo;

// === CELESTIAL NAV — constellations visible at your position (global view) ===
const CelestialNav = {
  SKY_R: 1.36,
  MIN_ALT: 8,
  _group: null,
  _lines: [],
  _points: null,
  _pointMap: {},
  _lastGuide: '',
  _tickAt: 0,

  STARS: {
    Polaris:   { ra: 2.530301, dec: 89.26411, nav: true, label: 'Polaris · N' },
    Kochab:    { ra: 14.845003, dec: 74.15500 },
    Dubhe:     { ra: 11.06206, dec: 61.75097 },
    Merak:     { ra: 11.03364, dec: 56.38243 },
    Phecda:    { ra: 11.89706, dec: 53.69477 },
    Megrez:    { ra: 12.25732, dec: 57.03255 },
    Alioth:    { ra: 12.90043, dec: 55.95982 },
    Mizar:     { ra: 13.39871, dec: 54.92536 },
    Alkaid:    { ra: 13.79229, dec: 49.31330 },
    Schedar:   { ra: 0.67511, dec: 56.53733 },
    Caph:      { ra: 0.15295, dec: 59.14978 },
    Navi:      { ra: 0.94514, dec: 60.71667 },
    Ruchbah:   { ra: 1.43056, dec: 60.23528 },
    Betelgeuse:{ ra: 5.91953, dec: 7.40706 },
    Bellatrix: { ra: 5.41885, dec: 6.34970 },
    Mintaka:   { ra: 5.53344, dec: -0.29910 },
    Alnilam:   { ra: 5.60329, dec: -1.20192 },
    Alnitak:   { ra: 5.67928, dec: -1.94259 },
    Rigel:     { ra: 5.24230, dec: -8.20164 },
    Saiph:     { ra: 5.79592, dec: -9.66961 },
    Sirius:    { ra: 6.75248, dec: -16.71612, nav: true, label: 'Sirius' },
    Acrux:     { ra: 12.44332, dec: -63.09912, nav: true, label: 'Acrux' },
    Mimosa:    { ra: 12.79536, dec: -59.68876 },
    Gacrux:    { ra: 12.51943, dec: -57.11321 },
    Imai:      { ra: 12.69460, dec: -59.04143 },
    Antares:   { ra: 16.49013, dec: -26.43194, nav: true, label: 'Antares' },
  },

  SETS: [
    {
      id: 'uma', name: 'Ursa Major', short: 'Big Dipper',
      nav: 'Pointer stars → Polaris · north',
      lines: [['Dubhe','Merak'],['Merak','Phecda'],['Phecda','Megrez'],['Megrez','Alioth'],['Alioth','Mizar'],['Mizar','Alkaid'],['Dubhe','Megrez']],
    },
    {
      id: 'umi', name: 'Ursa Minor', short: 'Little Dipper',
      nav: 'Polaris at handle tip · true north',
      lines: [['Polaris','Kochab']],
    },
    {
      id: 'cas', name: 'Cassiopeia', short: 'W',
      nav: 'Opposite Big Dipper · circumpolar N',
      lines: [['Caph','Schedar'],['Schedar','Navi'],['Navi','Ruchbah'],['Ruchbah','Caph']],
    },
    {
      id: 'ori', name: 'Orion', short: 'Hunter',
      nav: 'Belt E→W · rises east, sets west',
      lines: [['Betelgeuse','Bellatrix'],['Bellatrix','Mintaka'],['Mintaka','Alnilam'],['Alnilam','Alnitak'],['Alnitak','Saiph'],['Saiph','Rigel'],['Rigel','Mintaka'],['Betelgeuse','Mintaka']],
    },
    {
      id: 'cma', name: 'Canis Major',
      nav: 'Sirius — brightest star · SE/S reference',
      lines: [['Sirius','Betelgeuse']],
    },
    {
      id: 'cru', name: 'Crux', short: 'Southern Cross',
      nav: 'Long axis → south celestial pole',
      lines: [['Acrux','Mimosa'],['Mimosa','Gacrux'],['Gacrux','Imai'],['Imai','Acrux']],
    },

  ],

  init() {
    if (this._group || typeof globePivot === 'undefined') return;
    this._group = new THREE.Group();
    this._group.visible = false;
    globePivot.add(this._group);

    this.SETS.forEach(set => {
      set.lines.forEach((pair, i) => {
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(6, 3));
        const mat = new THREE.LineBasicMaterial({
          color: 0xa8d4ff,
          transparent: true,
          opacity: 0.62,
          depthWrite: false,
        });
        const line = new THREE.Line(geo, mat);
        line.visible = false;
        line.userData = { setId: set.id, stars: pair };
        this._group.add(line);
        this._lines.push(line);
      });
    });

    const starNames = Object.keys(this.STARS);
    const pos = new Float32Array(starNames.length * 3);
    const col = new Float32Array(starNames.length * 3);
    starNames.forEach((name, i) => {
      this._pointMap[name] = i;
      const nav = this.STARS[name].nav;
      col[i * 3] = nav ? 1.0 : 0.72;
      col[i * 3 + 1] = nav ? 0.82 : 0.86;
      col[i * 3 + 2] = nav ? 0.45 : 1.0;
    });
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const pMat = new THREE.PointsMaterial({
      size: 0.028,
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this._points = new THREE.Points(pGeo, pMat);
    this._group.add(this._points);
    this._starNames = starNames;
  },

  gmstDeg(date) {
    const jd = date.getTime() / 86400000 + 2440587.5;
    const t = (jd - 2451545.0) / 36525;
    let g = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + 0.000387933 * t * t;
    return ((g % 360) + 360) % 360;
  },

  lstHours(lng, date) {
    return ((this.gmstDeg(date) / 15 + lng / 15) % 24 + 24) % 24;
  },

  horizontal(raH, decDeg, lat, lng, date) {
    const lst = this.lstHours(lng, date);
    const H = (lst - raH) * 15 * Math.PI / 180;
    const dec = decDeg * Math.PI / 180;
    const latR = lat * Math.PI / 180;
    const sinAlt = Math.sin(dec) * Math.sin(latR) + Math.cos(dec) * Math.cos(latR) * Math.cos(H);
    const alt = Math.asin(Math.max(-1, Math.min(1, sinAlt))) * 180 / Math.PI;
    const cosAlt = Math.cos(alt * Math.PI / 180) || 1e-6;
    const sinAz = -Math.cos(dec) * Math.sin(H) / cosAlt;
    const cosAz = (Math.sin(dec) - Math.sin(latR) * sinAlt) / (Math.cos(latR) * cosAlt);
    let az = Math.atan2(sinAz, cosAz) * 180 / Math.PI;
    if (az < 0) az += 360;
    return { alt, az, lst };
  },

  bearing(az) {
    const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
    return dirs[Math.round(az / 22.5) % 16];
  },

  observerBasis(lat, lng) {
    const base = latLngToPos(lat, lng, 1.02);
    const up = new THREE.Vector3(base.x, base.y, base.z).normalize();
    const nPos = latLngToPos(lat + 0.08, lng, 1);
    const ePos = latLngToPos(lat, lng + 0.08, 1);
    const cPos = latLngToPos(lat, lng, 1);
    const north = new THREE.Vector3(nPos.x - cPos.x, nPos.y - cPos.y, nPos.z - cPos.z).normalize();
    const east = new THREE.Vector3(ePos.x - cPos.x, ePos.y - cPos.y, ePos.z - cPos.z).normalize();
    return { base, up, north, east };
  },

  skyPoint(alt, az, basis) {
    const a = alt * Math.PI / 180;
    const z = az * Math.PI / 180;
    const dir = new THREE.Vector3()
      .addScaledVector(basis.up, Math.sin(a))
      .addScaledVector(basis.north, Math.cos(a) * Math.cos(z))
      .addScaledVector(basis.east, Math.cos(a) * Math.sin(z))
      .normalize();
    return new THREE.Vector3(
      basis.base.x + dir.x * this.SKY_R,
      basis.base.y + dir.y * this.SKY_R,
      basis.base.z + dir.z * this.SKY_R
    );
  },

  observer() {
    return window._lastPos || { lat: 36.44, lng: 28.22, name: 'You' };
  },

  isGlobalNavView(camZ) {
    const z = camZ ?? camera?.position?.z ?? 2.55;
    const level = CosmicZoom?.level || 'earth';
    return level === 'earth' && z >= 2.05 && z < 4.2 && !CityMap?.active;
  },

  compute(date) {
    date = date || new Date();
    const obs = this.observer();
    const basis = this.observerBasis(obs.lat, obs.lng);
    const stars = {};
    Object.entries(this.STARS).forEach(([name, s]) => {
      const h = this.horizontal(s.ra, s.dec, obs.lat, obs.lng, date);
      stars[name] = Object.assign({ name }, s, h, {
        visible: h.alt >= this.MIN_ALT,
        bearing: this.bearing(h.az),
      });
    });

    const sets = this.SETS.map(set => {
      const pts = set.lines.flatMap(p => p);
      const alts = [...new Set(pts)].map(n => stars[n]?.alt ?? -90);
      const visCount = alts.filter(a => a >= this.MIN_ALT).length;
      const avgAlt = alts.reduce((a, b) => a + b, 0) / (alts.length || 1);
      return Object.assign({}, set, {
        visible: visCount >= 2,
        visCount,
        avgAlt,
      });
    }).filter(s => s.visible).sort((a, b) => b.avgAlt - a.avgAlt);

    const navStars = Object.values(stars).filter(s => s.nav && s.visible)
      .sort((a, b) => b.alt - a.alt);

    return { obs, stars, sets, navStars, date, basis };
  },

  tick() {
    if (!this._group) return;
    const camZ = camera?.position?.z ?? 2.55;
    const show = this.isGlobalNavView(camZ);
    this._group.visible = show;
    if (!show) return;

    const now = Date.now();
    if (now - this._tickAt < 900) return;
    this._tickAt = now;

    const sky = this.compute();
    const posAttr = this._points.geometry.attributes.position;

    this._starNames.forEach((name, i) => {
      const s = sky.stars[name];
      if (!s?.visible) {
        posAttr.setXYZ(i, 0, -99, 0);
        return;
      }
      const p = this.skyPoint(s.alt, s.az, sky.basis);
      posAttr.setXYZ(i, p.x, p.y, p.z);
    });
    posAttr.needsUpdate = true;

    const visibleSets = new Set(sky.sets.map(s => s.id));
    this._lines.forEach(line => {
      const pair = line.userData.stars;
      const a = sky.stars[pair[0]];
      const b = sky.stars[pair[1]];
      const showLine = visibleSets.has(line.userData.setId) && a?.visible && b?.visible;
      line.visible = showLine;
      if (!showLine) return;
      const pa = this.skyPoint(a.alt, a.az, sky.basis);
      const pb = this.skyPoint(b.alt, b.az, sky.basis);
      const arr = line.geometry.attributes.position.array;
      arr[0] = pa.x; arr[1] = pa.y; arr[2] = pa.z;
      arr[3] = pb.x; arr[4] = pb.y; arr[5] = pb.z;
      line.geometry.attributes.position.needsUpdate = true;
      const fade = Math.min(1, Math.min(a.alt, b.alt) / 35);
      line.material.opacity = 0.28 + fade * 0.5;
    });

    this._lastSky = sky;
  },

  summary() {
    return this._lastSky || this.compute();
  },

  renderGuideHtml(camZ) {
    return '';
  },

  printReport() {
    const sky = this.compute();
    const lines = ['◎ Celestial nav · ' + sky.sets.length + ' constellations above horizon'];
    sky.sets.forEach(s => {
      lines.push('  ' + (s.short || s.name) + ' — ' + s.nav);
    });
    if (sky.obs.lat >= 5 && sky.stars.Polaris?.visible) {
      lines.push('  Polaris alt ' + sky.stars.Polaris.alt.toFixed(1) + '° → latitude ≈ ' + sky.obs.lat.toFixed(1) + '°');
    }
    sky.navStars.forEach(s => {
      lines.push('  ★ ' + (s.label || s.name) + ' ' + s.bearing + ' ' + s.alt.toFixed(0) + '°');
    });
    AciCli?.print(lines.join('\n'), 'ok');
    const speak = sky.sets.slice(0, 3).map(s => s.short || s.name).join(', ') || 'no major constellations';
    ACIControl?.reply('Visible: ' + speak + ' · type nav for bearings');
    return sky;
  },
};
window.CelestialNav = CelestialNav;

// === CODERS HUB — multi-team race board + cross-lab handoff
const CodersHub = {
  CONTINUATION_KEY: 'astranov:job-continuation',
  REGISTRY_URL: '/coders-labs.json',
  LABS: [
    { id: 'main', label: 'Globe OS', glyph: '◈', url: 'https://astranov.eu', accent: '#7eb8ff', team: 'Astranov', provider: 'Grok Build', engine: 'grok' },
    { id: 'grok', label: 'Grok', glyph: 'GK', url: 'https://grok.astranov.eu', accent: '#e8e8e8', team: 'xAI', provider: 'Grok', engine: 'grok' },
    { id: 'chatgpt', label: 'ChatGPT', glyph: 'CG', url: 'https://chatgpt.astranov.eu', accent: '#74c0fc', team: 'OpenAI', provider: 'GPT-4o mini', engine: 'openai-mini' },
    { id: 'claude', label: 'Claude', glyph: 'CL', url: 'https://claude.astranov.eu', accent: '#d4a574', team: 'Anthropic', provider: 'Claude', engine: 'claude' },
    { id: 'composer', label: 'Composer', glyph: 'CP', url: 'https://composer.astranov.eu', accent: '#a8c8ff', team: 'Cursor', provider: 'Composer', engine: 'composer' },
    { id: 'gemini', label: 'Gemini', glyph: 'GM', url: 'https://gemini.astranov.eu', accent: '#8ab4f8', team: 'Google', provider: 'Gemini', engine: 'gemini' },
    { id: 'deepseek', label: 'DeepSeek', glyph: 'DS', url: 'https://deepseek.astranov.eu', accent: '#5eead4', team: 'DeepSeek', provider: 'DeepSeek', engine: 'deepseek' },
    { id: 'cursor', label: 'Cursor', glyph: 'CR', url: 'https://cursor.astranov.eu', accent: '#c8d8ff', team: 'Cursor', provider: 'Cursor IDE', engine: 'cursor', comingSoon: true },
  ],
  _open: false,
  _status: {},
  _pinging: false,

  async init() {
    this._bind();
    await this._loadRegistry();
    this.renderLabs();
    this.refreshJob();
    this._updateRaceBoard();
    this._maybeResumeFromQuery();
    if (SlumberManager?.allows?.('coders_ping')) this._pingLabs();
  },

  _bind() {
    document.getElementById('coders-hub-trigger')?.addEventListener('click', () => this.toggle(true));
    document.getElementById('coders-hub-close')?.addEventListener('click', () => this.toggle(false));
    document.getElementById('coders-save-job')?.addEventListener('click', () => this.saveJob());
    document.getElementById('coders-resume-job')?.addEventListener('click', () => this.resumeJob());
    document.getElementById('coders-clear-job')?.addEventListener('click', () => this.clearJob());
    document.getElementById('coders-summon-composer')?.addEventListener('click', () => this.summonComposer());
    document.getElementById('coders-refresh-labs')?.addEventListener('click', () => {
      SlumberManager?.wake?.('coders_ping', 'refresh');
      if (SlumberManager?.allows?.('coders_ping')) this._pingLabs();
      this.renderLabs();
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._open) this.toggle(false);
    });
  },

  async _loadRegistry() {
    try {
      const r = await fetch(this.REGISTRY_URL, { cache: 'no-store' });
      if (!r.ok) return;
      const data = await r.json();
      if (Array.isArray(data?.labs) && data.labs.length) {
        this.LABS = data.labs;
        if (data.continuationKey) this.CONTINUATION_KEY = data.continuationKey;
      }
    } catch (_) {}
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
      this._updateRaceBoard();
      if (SlumberManager?.allows?.('coders_ping')) this._pingLabs();
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
    this._updateRaceBoard();
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
      preview.textContent = 'Save your CLI thread to hand off to any AI coder team.';
      return;
    }
    const when = job.updatedAt ? new Date(job.updatedAt).toLocaleString() : 'unknown';
    meta.textContent = `${job.fromLab || 'lab'} · ${when}`;
    preview.textContent = job.summary || job.lastPrompt || 'Saved continuation pack.';
  },

  saveJob() {
    const job = this.buildJob();
    this.writeJob(job);
    ACIControl?.reply('Job saved — any coder team can pick it up from their lab.');
    AciCli?.print('Coders race · job saved for cross-team handoff', 'ok');
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
    ACIControl?.reply(`Resumed job from ${job.fromLab || 'another team'}. Send when ready.`);
    if (job.lastPrompt) void AciCoders?.handleMessage?.(job.lastPrompt);
    this.toggle(false);
  },

  clearJob() {
    try { localStorage.removeItem(this.CONTINUATION_KEY); } catch (_) {}
    this.refreshJob();
    this._updateRaceBoard();
    AciCli?.print('Coders hub · job cleared', 'dim');
  },

  _inlineLabs: new Set(['gemini', 'deepseek']),

  canInline(lab) {
    if (!lab || lab.comingSoon || lab.id === 'main') return false;
    if (lab.inlineFallback || this._inlineLabs.has(lab.id)) return true;
    const st = this._status[lab.id];
    return st === 'offline' || st === 'soon' || st === 'slow';
  },

  openLabInline(lab) {
    const job = this.buildJob();
    this.writeJob(job);
    const prov = AiRouter?.applyLab?.(lab);
    GlobeDeck?.expand?.(lab.label + ' · inline on Globe OS');
    const input = document.getElementById('aci-cli-in');
    if (input && job.lastPrompt) {
      input.value = `Continue on ${lab.label}: ${job.lastPrompt}`;
      input.dispatchEvent(new Event('input'));
    }
    ACIControl?.reply(`${lab.label} inline — AI provider → ${prov?.label || lab.provider} (subdomain ${this._status[lab.id] || 'pending'})`);
    AciCli?.print(`${lab.label} lab routed via ai-router · ${prov?.id || lab.engine}`, 'ok');
    this.toggle(false);
    void AciCoders?.enterSession?.({ focus: true });
  },

  openLab(lab) {
    if (!lab?.url || lab.comingSoon) {
      ACIControl?.reply(`${lab?.label || 'Lab'} subdomain not live yet — stay on Globe OS or try ChatGPT/Claude/Grok.`);
      return;
    }
    const st = this._status[lab.id];
    if (st === 'offline' || (this.canInline(lab) && st !== 'live')) {
      if (this.canInline(lab)) return this.openLabInline(lab);
      ACIControl?.reply(`${lab.label} lab is offline right now — try another team or save job for later.`);
      return;
    }
    if (lab.id === 'main') {
      this.toggle(true);
      return;
    }
    this.writeJob(this.buildJob());
    const target = new URL(lab.url);
    target.searchParams.set('continue', '1');
    target.searchParams.set('from', 'main');
    window.location.href = target.toString();
  },

  async summonComposer() {
    const job = this.buildJob();
    this.writeJob(job);
    const task = job.lastPrompt || job.summary || 'Continue Globe OS development';
    if (!Auth?.user) {
      ACIControl?.reply('Sign in with G first — then Summon Composer queues your build.');
      Auth?.openLoginModal?.('Sign in to summon Composer on your job');
      return;
    }
    AciCli?.print('Summoning Composer…', 'dim');
    const q = await AciCoders?.queueCoder?.(task, 'composer');
    if (q?.summon_id) {
      ACIControl?.reply(`Composer queued #${q.summon_id} — polling for answer`);
      AciCli?.print('Composer #' + q.summon_id + ' · say "coders poll" or wait', 'ok');
    } else {
      ACIControl?.reply(q?.text || q?.error || 'Composer queue failed — try again');
    }
    this.toggle(false);
  },

  async _pingLabs() {
    if (!SlumberManager?.allows?.('coders_ping')) return;
    if (this._pinging) return;
    this._pinging = true;
    const badge = document.getElementById('coders-hub-trigger');
    if (badge) badge.dataset.pinging = '1';
    await Promise.all(this.LABS.map(async (lab) => {
      if (lab.comingSoon || lab.id === 'main') {
        this._status[lab.id] = lab.comingSoon ? 'soon' : 'live';
        return;
      }
      try {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), 6000);
        const r = await fetch(lab.url, { method: 'HEAD', mode: 'no-cors', signal: ctrl.signal, cache: 'no-store' });
        clearTimeout(t);
        this._status[lab.id] = r.type === 'opaque' || r.ok ? 'live' : 'offline';
      } catch (e) {
        this._status[lab.id] = e?.name === 'AbortError' ? 'slow' : 'offline';
      }
    }));
    this._pinging = false;
    if (badge) delete badge.dataset.pinging;
    this._updateTriggerBadge();
    if (this._open) this.renderLabs();
  },

  _liveCount() {
    return this.LABS.filter((l) => this._status[l.id] === 'live' || l.id === 'main').length;
  },

  _updateTriggerBadge() {
    const badge = document.getElementById('coders-hub-live-count');
    const n = this._liveCount();
    if (badge) badge.textContent = String(n);
  },

  _updateRaceBoard() {
    const el = document.getElementById('coders-race-board');
    if (!el) return;
    const job = this.readJob();
    const live = this._liveCount();
    const leader = job?.fromLab ? `Last handoff: ${job.fromLab}` : 'No handoff yet';
    el.textContent = `${live} labs live · ${this.LABS.length} teams racing · ${leader}`;
  },

  _statusLabel(id) {
    const s = this._status[id];
    if (s === 'live') return { text: 'LIVE', cls: 'live' };
    if (s === 'slow') return { text: 'SLOW', cls: 'slow' };
    if (s === 'soon') return { text: 'SOON', cls: 'soon' };
    if (s === 'offline') return { text: 'OFF', cls: 'off' };
    return { text: '…', cls: 'check' };
  },

  renderLabs() {
    const grid = document.getElementById('coders-hub-grid');
    if (!grid) return;
    grid.innerHTML = '';
    const host = (location.hostname || '').replace(/^www\./, '');
    const sorted = [...this.LABS].sort((a, b) => {
      const rank = (id) => {
        const s = this._status[id];
        if (id === 'main') return 0;
        if (s === 'live') return 1;
        if (s === 'slow') return 2;
        if (s === 'soon') return 4;
        return 3;
      };
      return rank(a.id) - rank(b.id);
    });
    for (const lab of sorted) {
      const here = (host === 'astranov.eu' && lab.id === 'main') || host === `${lab.id}.astranov.eu`;
      const st = this._statusLabel(lab.id);
      const card = document.createElement('article');
      card.className = 'coders-card' + (here ? ' is-here' : '') + (st.cls === 'off' ? ' is-off' : '');
      card.style.setProperty('--lab-accent', lab.accent || '#7eb8ff');
      const team = lab.team ? `<span class="coders-team">${this._esc(lab.team)}</span>` : '';
      const provider = lab.provider ? `<span class="coders-provider">${this._esc(lab.provider)}</span>` : '';
      card.innerHTML =
        `<div class="coders-card-top"><span class="coders-card-glyph">${this._esc(lab.glyph)}</span>`
        + `<div><h2>${this._esc(lab.label)}</h2>${team}${here ? '<span class="coders-here">You are here</span>' : ''}</div>`
        + `<span class="coders-status coders-status-${st.cls}">${st.text}</span></div>`
        + `${provider ? `<p class="coders-card-provider">${provider}</p>` : ''}`
        + `<p class="coders-card-path">${this._esc((lab.url || '').replace('https://', ''))}</p>`
        + `<button type="button" class="coders-open" ${lab.comingSoon ? 'disabled' : ''}>${here ? 'Stay in lab' : lab.comingSoon ? 'Coming soon' : st.cls === 'off' && this.canInline(lab) ? 'Open inline' : st.cls === 'off' ? 'Offline' : 'Open lab'}</button>`;
      const btn = card.querySelector('.coders-open');
      if (btn && !btn.disabled) btn.addEventListener('click', () => this.openLab(lab));
      grid.append(card);
    }
    this._updateRaceBoard();
    this._updateTriggerBadge();
  },

  _maybeResumeFromQuery() {
    const params = new URLSearchParams(location.search);
    if (!params.has('continue')) return;
    const job = this.readJob();
    if (!job) return;
    const from = params.get('from');
    if (from) AciCli?.print?.(`Handoff from ${from} lab — resuming job`, 'ok');
    window.setTimeout(() => this.resumeJob(), 700);
    params.delete('continue');
    params.delete('from');
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

// === LAB ORBS — ChatGPT-lab affordances on real WebGL globe (no static Earth overlay)
const LabOrbs = {
  ORBS: [
    { id: 'coders', label: 'Coders', glyph: 'CD', color: '#b8d4ff', angle: -68, panel: 'coders' },
    { id: 'locate', label: 'Locate', glyph: '🎯', color: '#54e6ff', angle: -22, panel: 'locate' },
    { id: 'provider', label: 'AI', glyph: 'AV', color: '#6df2bd', angle: 22, panel: 'provider' },
    { id: 'theme', label: 'Theme', glyph: '☀', color: '#ffd166', angle: 68, panel: 'theme' },
    { id: 'hub', label: 'Labs', glyph: '⬡', color: '#8fb7ff', angle: 130, panel: 'hub' },
  ],
  _open: false,
  _bound: false,
  _introDone: false,

  _isMobile() {
    try {
      return (navigator.maxTouchPoints > 0 && window.innerWidth < 900)
        || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    } catch (_) {
      return window.innerWidth < 900;
    }
  },

  init() {
    if (!SlumberManager?.allows?.('lab_orbs')) return;
    if (this._bound) return;
    this._bound = true;
    this._mount();
    this._bind();
    this._layout();
    window.addEventListener('resize', () => this._layout());
    if (!this._isMobile() && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.setTimeout(() => this._runIntro(), 1200);
    }
  },

  _mount() {
    if (document.getElementById('lab-orb-layer')) return;
    const layer = document.createElement('div');
    layer.id = 'lab-orb-layer';
    layer.setAttribute('aria-label', 'Quick actions');
    const tray = document.createElement('button');
    tray.id = 'lab-orb-tray';
    tray.type = 'button';
    tray.title = 'Astranov orbs — tap for Coders, Locate, AI provider';
    tray.innerHTML = '<span class="lab-orb-tray-glyph">◈</span><span class="lab-orb-tray-label">Orbs</span>';
    layer.appendChild(tray);
    for (const orb of this.ORBS) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'lab-orb';
      btn.dataset.orb = orb.id;
      btn.dataset.panel = orb.panel;
      btn.title = orb.label;
      btn.style.setProperty('--orb-color', orb.color);
      btn.innerHTML = `<span class="lab-orb-glyph">${orb.glyph}</span><span class="lab-orb-label">${orb.label}</span>`;
      layer.appendChild(btn);
    }
    document.body.appendChild(layer);
  },

  _bind() {
    document.getElementById('lab-orb-tray')?.addEventListener('click', () => this.toggle());
    document.querySelectorAll('#lab-orb-layer .lab-orb').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this._activate(btn.dataset.panel, btn.dataset.orb);
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._open) this.toggle(false);
    });
  },

  toggle(open) {
    const layer = document.getElementById('lab-orb-layer');
    if (!layer) return;
    this._open = open !== false ? !this._open : false;
    layer.classList.toggle('open', this._open);
    if (this._open) this._syncGlyphs();
  },

  _syncGlyphs() {
    const prov = document.querySelector('#lab-orb-layer .lab-orb[data-orb="provider"] .lab-orb-glyph');
    if (prov && window.AiRouter) prov.textContent = AiRouter.current()?.short || 'AV';
    const theme = document.querySelector('#lab-orb-layer .lab-orb[data-orb="theme"] .lab-orb-glyph');
    if (theme) theme.textContent = AstranovTheme?.mode === 'bright' ? '☀' : '🌙';
  },

  _layout() {
    const layer = document.getElementById('lab-orb-layer');
    if (!layer) return;
    const tray = document.getElementById('lab-orb-tray');
    const rect = tray?.getBoundingClientRect();
    const cx = (rect?.left || 48) + (rect?.width || 44) / 2;
    const cy = (rect?.top || window.innerHeight - 120) + (rect?.height || 44) / 2;
    const radius = Math.min(92, window.innerWidth * 0.22);
    layer.querySelectorAll('.lab-orb').forEach((btn, i) => {
      const orb = this.ORBS[i];
      if (!orb) return;
      const rad = (orb.angle * Math.PI) / 180;
      const x = cx + Math.cos(rad) * radius - 22;
      const y = cy + Math.sin(rad) * radius - 22;
      btn.style.left = x + 'px';
      btn.style.top = y + 'px';
    });
  },

  _runIntro() {
    if (this._introDone || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    this._introDone = true;
    const layer = document.getElementById('lab-orb-layer');
    if (!layer) return;
    layer.classList.add('intro');
    window.setTimeout(() => {
      layer.classList.add('open');
      this._open = true;
      this._syncGlyphs();
      window.setTimeout(() => {
        layer.classList.remove('open', 'intro');
        this._open = false;
      }, 2400);
    }, 400);
  },

  _activate(panel, orbId) {
    this.toggle(false);
    if (panel === 'coders') {
      GlobeDeck?.expand?.('Coders');
      void AciCoders?.enterSession?.({ focus: true });
      return;
    }
    if (panel === 'locate') {
      locateMe?.();
      return;
    }
    if (panel === 'provider') {
      const next = AiRouter?.cycle?.();
      ACIControl?.reply('AI provider → ' + (next?.label || 'Cycle'));
      this._syncGlyphs();
      return;
    }
    if (panel === 'theme') {
      AstranovTheme?.toggle?.();
      ACIControl?.reply('Theme → ' + (AstranovTheme?.mode || 'dark'));
      this._syncGlyphs();
      return;
    }
    if (panel === 'hub') {
      CodersHub?.toggle?.(true);
      return;
    }
    ACIControl?.reply('Orb · ' + (orbId || panel));
  },
};

window.LabOrbs = LabOrbs;

// STRONG ROUTING FALLBACK PROVIDER CYCLING ENGINE
// For safe deliveries to users & drivers (pilot/drones)
// Cycles providers + fallbacks on risk
// =====================================================
const RoutingEngine = {
  providers: ['direct', 'safeViaNorth', 'coastalDetour', 'wideSafeArc'],
  index: 0,

  getCurrentProvider() {
    return this.providers[this.index];
  },

  cycleProvider() {
    this.index = (this.index + 1) % this.providers.length;
    const p = this.getCurrentProvider();
    console.log('%c[RoutingEngine Ασφάλεια] Cycling provider → ' + p + ' (για users & drivers)', 'color:#ffaa00');
    return p;
  },

  computeRoute(startLat, startLng, endLat, endLng, userPositions = [], maxRisk = 2) {
    let provider = this.getCurrentProvider();
    console.log('%c[RoutingEngine] Υπολογισμός ασφαλούς διαδρομής με ' + provider, 'color:#00ddff');

    const start = latLngToPos(startLat, startLng);
    const end = latLngToPos(endLat, endLng);
    const points = [];
    const steps = 28;
    let riskLevel = 0;

    for (let i = 0; i <= steps; i++) {
      let t = i / steps;
      let p;

      if (provider === 'direct') {
        p = this._greatCircle(start, end, t);
      } else if (provider === 'safeViaNorth') {
        const via = latLngToPos(42, 26);
        if (t < 0.5) p = this._greatCircle(start, via, t * 2);
        else p = this._greatCircle(via, end, (t - 0.5) * 2);
      } else if (provider === 'coastalDetour') {
        const bias = Math.sin(t * Math.PI) * 3.5;
        p = latLngToPos(
          startLat + (endLat - startLat) * t + bias,
          startLng + (endLng - startLng) * t
        );
      } else { // wideSafeArc
        const arc = 4.5 * Math.sin(t * Math.PI * 1.2);
        p = latLngToPos(
          startLat + (endLat - startLat) * t + arc,
          startLng + (endLng - startLng) * t - arc * 0.6
        );
      }

      points.push(p);

      // Safety check vs users/drivers positions
      userPositions.forEach(up => {
        if (p.distanceTo(up) < 0.12) riskLevel += 0.6;
      });
    }

    if (riskLevel > maxRisk) {
      console.log('%c[RoutingEngine] ⚠️ Κίνδυνος για users/drivers! Fallback cycling...', 'color:#ff4444');
      this.cycleProvider();
      return this.computeRoute(startLat, startLng, endLat, endLng, userPositions, maxRisk);
    }

    return {
      points: points,
      provider: provider,
      etaSim: Math.round(steps * 2.5) + 'ms',
      safetyScore: (10 - riskLevel).toFixed(1)
    };
  },

  _greatCircle(a, b, t) {
    const dot = a.dot(b);
    const omega = Math.acos(Math.min(Math.max(dot, -1), 1));
    if (omega < 0.0001) return a.clone();
    const sinO = Math.sin(omega);
    const aa = Math.sin((1 - t) * omega) / sinO;
    const bb = Math.sin(t * omega) / sinO;
    return a.clone().multiplyScalar(aa).add(b.clone().multiplyScalar(bb));
  }
};

// Orbital Satellites for global connectivity visualization (illustrative, using real sphere math)
let orbitalSats = [];
function addOrbitalSats() {
  for (let i = 0; i < 6; i++) {
    const sat = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xaaaaff })
    );
    const angle = (i / 6) * Math.PI * 2;
    sat.position.set(
      Math.cos(angle) * 1.6,
      Math.sin(i * 0.8) * 0.4,
      Math.sin(angle) * 1.6
    );
    orbitalSats.push(sat);
    scene.add(sat);
  }
}
function updateOrbitalSats() {
  orbitalSats.forEach((sat, i) => {
    const t = Date.now() * 0.0002 + i;
    sat.position.x = Math.cos(t + i) * 1.6;
    sat.position.z = Math.sin(t + i) * 1.6;
    sat.position.y = Math.sin(t * 1.5 + i) * 0.3;
  });
}
addOrbitalSats();

// === DRIVING VIEW + OSRM ROAD ROUTING ===
const DrivingView = {
  active: false,
  speed: 0,
  mode: 'still',
  watchId: null,
  lastFix: null,
  lastTime: 0,
  routeLine: null,
  routeCoords: [],
  steps: [],
  stepIdx: 0,
  destination: null,
  WALK_THRESHOLD: 2.2,
  DRIVE_THRESHOLD: 4.5,

  haversineM(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  init() {
    this._geoReady = !!navigator.geolocation;
  },

  _ensureWatch() {
    if (this.watchId || !this._geoReady) return;
    this.watchId = navigator.geolocation.watchPosition(
      pos => this.onFix(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 1500, timeout: 12000 }
    );
  },

  setDestination(lat, lng) {
    this.destination = { lat, lng };
    if (this.active) this.fetchRoadRoute();
  },

  setRoutePlan(plan) {
    this._routePlan = plan || null;
  },

  onFix(pos) {
    const now = Date.now();
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    let speed = pos.coords.speed;
    if (this.lastFix && this.lastTime) {
      const dt = (now - this.lastTime) / 1000;
      if (dt > 0.4) {
        const d = this.haversineM(this.lastFix.lat, this.lastFix.lng, lat, lng);
        if (speed == null || speed < 0) speed = d / dt;
      }
    }
    this.speed = Math.max(0, speed || 0);
    this.lastFix = { lat, lng };
    this.lastTime = now;
    window._lastPos = { lat, lng };
    if (typeof placeMe === 'function') placeMe(lat, lng, { quiet: true, markerOnly: true });

    const prev = this.mode;
    if (this.speed < 0.6) this.mode = 'still';
    else if (this.speed < this.WALK_THRESHOLD) this.mode = 'walk';
    else if (this.speed < this.DRIVE_THRESHOLD) this.mode = 'run';
    else this.mode = 'drive';

    const fast = this.mode === 'run' || this.mode === 'drive';
    if (fast && !this.active) this.activate();
    if (this.active && this.mode === 'still' && this.speed < 0.5) this.deactivate();
    if (this.active) {
      this.updateCamera(pos);
      this.updateGuidance(lat, lng);
    }
    if (prev !== this.mode) {
      FieldBrain?.pulse('drive', this.mode + ' ' + Math.round(this.speed * 3.6) + 'km/h', { role: 'driver' });
    }
    if (prev !== this.mode && fast) {
      const g = window.AstroGlyphs || { drive: '🚗', fast: '⚡' };
      GlobeDeck?.setPreview((this.mode === 'drive' ? g.drive + ' DRIVING' : g.fast + ' FAST') + ' · ' + Math.round(this.speed * 3.6) + ' km/h');
    }
  },

  activate() {
    this._ensureWatch();
    this.active = true;
    this._cameraFollow = true;
    GlobeControl?.engageFollow?.('drive');
    SuperCli?.setContext?.('drive');
    cityLevel = true;
    CityMap?.onCamera?.(1.22, 'earth');
    const pos = window._lastPos || { lat: 36.44, lng: 28.22 };
    const p = latLngToPos(pos.lat, pos.lng, 1.04);
    if (typeof flyToPoint === 'function') {
      flyToPoint(new THREE.Vector3(p.x, p.y, p.z), 1.28, {
        dur: GlobeControl?.flyDuration?.(camera?.position?.z, 1.28),
      });
      GlobeControl?.noteAutoFly?.();
    }
    GlobeDeck?.setPreview('DRIVE VIEW · ' + Math.round(this.speed * 3.6) + ' km/h');
    document.getElementById('zoom-label').textContent = (this.mode === 'drive' ? 'DRIVE VIEW' : 'RUN VIEW');
    MapDepict?.action('drive', { detail: Math.round(this.speed * 3.6) + ' km/h' });
    if (!this.destination) {
      const v = Commerce?.vendors?.[0];
      this.destination = v ? { lat: v.lat, lng: v.lng } : { lat: 36.89, lng: 27.29 };
    }
    this.fetchRoadRoute();
    AppShortcuts?.track?.('drive', 'Drive');
    if (Voice.maySpeak()) speak('Driving on.', () => resumeListening());
  },

  deactivate() {
    this.active = false;
    this._cameraFollow = false;
    if (GlobeControl?.followMode === 'drive') GlobeControl.followMode = 'free';
    AppShortcuts?.untrack?.('drive');
    SuperCli?.setContext?.(SuperCli?.inferContext?.() || 'idle');
    GlobeDeck?.setPreview('');
    if (this.routeLine?.parent) this.routeLine.parent.remove(this.routeLine);
    this.routeLine = null;
    CityMap?.setRoute?.([]);
    const pos = window._lastPos || this.lastFix;
    const cityZ = GlobeControl?.Z?.city || 1.38;
    if (pos && typeof flyToPoint === 'function') {
      const p = latLngToPos(pos.lat, pos.lng, 1.04);
      flyToPoint(new THREE.Vector3(p.x, p.y, p.z), cityZ, { dur: 0.85 });
      GlobeControl?.noteAutoFly?.();
    }
    cityLevel = true;
    camera.position.z = cityZ;
    CityMap?.onCamera?.(cityZ, 'earth');
    document.getElementById('zoom-label').textContent = 'CITY VIEW';
    MapDepict?.pulse?.(pos?.lat, pos?.lng, 0x3d9eff, 'Stopped · city view', 5000);
    CosmicZoom?.update(camera.position.z);
  },

  updateCamera(pos) {
    if (!this._cameraFollow || GlobeControl?.userExploring) return;
    camera.position.z = this.mode === 'drive' ? 1.22 : 1.32;
    const h = pos.coords.heading;
    if (h != null && !isNaN(h) && window._meMarker) {
      globePivot.rotation.y = (-h + 90) * Math.PI / 180;
    }
  },

  async fetchRoadRoute() {
    const plan = this._routePlan;
    const from = plan?.from || window._driverBase || window._lastPos || this.lastFix;
    const via = plan?.via;
    const to = plan?.to || this.destination;
    if (!from || !to) return;
    try {
      const pts = [from, via, to].filter(p => p && p.lat != null && p.lng != null);
      const coordStr = pts.map(p => p.lng + ',' + p.lat).join(';');
      const url = 'https://router.project-osrm.org/route/v1/driving/'
        + coordStr
        + '?overview=full&geometries=geojson&steps=true';
      const r = await fetch(url);
      const j = await r.json();
      if (j.code !== 'Ok' || !j.routes?.[0]) return;
      const route = j.routes[0];
      this.routeCoords = route.geometry.coordinates.map(c => ({ lng: c[0], lat: c[1] }));
      this.steps = (route.legs[0]?.steps || []).map(s => ({
        instruction: (s.maneuver?.type || 'continue') + ' ' + (s.name || ''),
        dist: s.distance,
        loc: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] }
      }));
      this.stepIdx = 0;
      this.drawRoute();
      if (this.steps[0]) this.showStep(this.steps[0]);
    } catch (e) {
      console.warn('[DrivingView] OSRM failed', e);
    }
    if ((this.routeCoords?.length || 0) < 2 && from && to) {
      const fallback = [];
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        fallback.push({
          lat: from.lat + (to.lat - from.lat) * t,
          lng: from.lng + (to.lng - from.lng) * t,
        });
      }
      this.routeCoords = fallback;
      this.drawRoute();
    }
  },

  drawRoute() {
    if (this.routeLine?.parent) this.routeLine.parent.remove(this.routeLine);
    const pts = this.routeCoords.map(c => {
      const p = latLngToPos(c.lat, c.lng, 1.026);
      return new THREE.Vector3(p.x, p.y, p.z);
    });
    if (pts.length < 2) return;
    this.routeLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x44aaff, transparent: true, opacity: 0.85 })
    );
    globePivot.add(this.routeLine);
    CityMap?.setRoute?.(this.routeCoords);
    MapDepict?.pulse(window._lastPos.lat, window._lastPos.lng, 0x44aaff, 'road route', 6000);
  },

  showStep(step) {
    const km = step.dist > 1000 ? (step.dist / 1000).toFixed(1) + ' km' : Math.round(step.dist) + ' m';
    const line = '➤ ' + step.instruction + ' · ' + km;
    GlobeDeck?.setPreview(line);
    ACIControl?.reply(line);
    if (step.loc) MapDepict?.pulse(step.loc.lat, step.loc.lng, 0x44aaff, step.instruction.slice(0, 40), 5000);
  },

  updateGuidance(lat, lng) {
    if (!this.steps.length) return;
    const step = this.steps[this.stepIdx];
    if (!step?.loc) return;
    const d = this.haversineM(lat, lng, step.loc.lat, step.loc.lng);
    if (d < 35 && this.stepIdx < this.steps.length - 1) {
      this.stepIdx++;
      this.showStep(this.steps[this.stepIdx]);
    }
  }
};
window.DrivingView = DrivingView;

// === MAP COMMS — team polygon · cloud chat · video/voice/phone/message ===
const MapComms = {
  kind: 'team',
  teamId: null,
  teamName: 'Team',
  members: new Map(),
  messages: [],
  dmUser: null,
  compromised: null,
  rtChannel: null,
  callChannel: null,
  _viz: null,
  _lines: [],
  _beamSvg: null,
  _pulse: 0,
  CLOUD_R: 1.22,
  SURFACE_R: 1.031,
  BLUE: 0x1a6fd4,
  BLUE_GLOW: 0x3d9eff,

  init() {
    this._beamSvg = document.getElementById('map-comms-beam');
    this._bindCloud();
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange((_e, s) => {
        if (!s?.user) this.leaveTeam();
      });
    }
  },

  _bindCloud() {
    const cloud = document.getElementById('map-comms-cloud');
    if (!cloud || cloud.dataset.bound) return;
    cloud.dataset.bound = '1';
    document.getElementById('mc-close')?.addEventListener('click', () => this.closeCloud());
    document.getElementById('mc-send')?.addEventListener('click', () => this.sendFromInput());
    document.getElementById('mc-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.sendFromInput(); }
    });
    document.querySelectorAll('#map-comms-contact [data-mc]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const hud = document.getElementById('map-comms-contact');
        const uid = hud?.dataset?.userId;
        if (uid) this.contactUser(uid, btn.dataset.mc);
      });
    });
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  selfMember() {
    const p = GhostTravel?.active?.()
      ? GhostTravel.publicPos()
      : (window._lastPos || { lat: 36.22, lng: 28.12 });
    return {
      id: Auth?.user?.id || 'guest',
      name: AstranovPresence?.displayName?.() || me?.name || 'You',
      lat: p.lat,
      lng: p.lng,
      emoji: '◎',
    };
  },

  memberList() {
    const list = [...this.members.values()];
    const self = this.selfMember();
    if (!list.find(m => m.id === self.id)) list.unshift(self);
    return list.filter(m => m.lat != null && m.lng != null);
  },

  async openPrivateCloud(opts) {
    opts = opts || {};
    const target = opts.target;
    const circleId = opts.circleId;
    if (!Auth?.user || !target?.id || !circleId) return null;
    this.kind = 'dm';
    this.dmUser = { id: target.id, name: target.name, lat: target.lat, lng: target.lng, emoji: target.emoji };
    this.teamId = circleId;
    this.teamName = 'DM · ' + (target.name || 'User');
    this.members.clear();
    const self = this.selfMember();
    this.members.set(self.id, self);
    this.members.set(target.id, {
      id: target.id,
      name: target.name || 'User',
      lat: target.lat ?? self.lat,
      lng: target.lng ?? self.lng,
      emoji: target.emoji || '👤',
    });
    this.messages = (opts.messages || []).map((m) => ({
      author: m.author || '?',
      name: m.author,
      body: m.body || m.text,
      t: m.t || Date.now(),
      author_id: m.author_id,
    }));
    this.compromised = null;
    ContextTruth?.clearCompromised?.();
    await this._joinChannel(circleId);
    this._openCloud(this.teamName);
    this._rebuildViz();
    this._renderMessages();
    ContextTruth?.sync?.();
    return circleId;
  },

  async openSession(opts) {
    opts = opts || {};
    if (!Auth?.user) {
      ACIControl?.reply('Sign in for map chat');
      return null;
    }
    const id = opts.id || ('mapteam-' + Date.now().toString(36));
    this.kind = opts.kind || 'team';
    this.teamName = (opts.name || opts.title || 'Cloud chat').slice(0, 56);
    this.teamId = id;
    this.members.clear();
    (opts.members || []).forEach((m) => {
      const id = m?.id ?? m?.user_id;
      if (id != null && m.lat != null && m.lng != null) {
        this.members.set(id, { ...m, id, name: m.name || m.display_name || 'User' });
      }
    });
    const self = this.selfMember();
    if (!this.members.has(self.id)) this.members.set(self.id, { ...self, role: opts.selfRole || 'member' });
    if (opts.persist !== false && this.kind === 'team') {
      try {
        await Auth.client.from('circles').upsert({
          id,
          name: this.teamName,
          scope: 'map_team',
          type: 'team',
          owner_id: Auth.user.id,
          map_members: [...this.members.values()],
          map_center_lat: this._centroid(this.memberList()).lat,
          map_center_lng: this._centroid(this.memberList()).lng,
        });
      } catch (_) {}
    }
    if (opts.messages) this.messages = opts.messages.slice();
    await this._joinChannel(id);
    this._openCloud(this.teamName);
    this._rebuildViz();
    this._renderMessages();
    if (opts.showDriverPicker && opts.drivers?.length) {
      this.renderDriverPicker(opts.drivers, opts.orderId);
    } else if (opts.showDriverPicker === false) {
      this.hideDriverPicker();
    }
    return id;
  },

  async createTeam(name) {
    const self = this.selfMember();
    const id = await this.openSession({
      name: name || 'Cloud team',
      kind: 'team',
      members: [self],
    });
    if (id) {
      ACIControl?.reply('Team «' + this.teamName + '» — share: team join ' + id);
      AciCli?.print('team id · ' + id, 'ok');
    }
    return id;
  },

  async joinTeam(id) {
    if (!Auth?.user) {
      ACIControl?.reply('Sign in to join a map team');
      return;
    }
    const teamId = (id || '').trim();
    if (!teamId.startsWith('mapteam-') && !teamId.startsWith('mapdm-')) {
      ACIControl?.reply('usage: team join mapteam-… · mapdm-…');
      return;
    }
    this.teamId = teamId;
    this.kind = teamId.startsWith('mapdm-') ? 'dm' : 'team';
    if (this.kind !== 'dm') this.dmUser = null;
    try {
      const { data } = await Auth.client.from('circles').select('name,map_members').eq('id', teamId).maybeSingle();
      if (data?.name) this.teamName = data.name;
      (data?.map_members || []).forEach((m) => {
        if (m?.id) this.members.set(m.id, m);
      });
      const msgs = await fetch(SB_URL + '/rest/v1/circle_messages?circle_id=eq.' + encodeURIComponent(teamId) + '&order=ts.desc&limit=40', {
        headers: await Auth.authHeaders(),
      }).then(r => r.ok ? r.json() : []);
      this.messages = (msgs || []).reverse();
    } catch (_) {}
    const self = this.selfMember();
    this.members.set(self.id, self);
    if (this.kind === 'dm') {
      const other = [...this.members.values()].find((m) => m.id && m.id !== Auth.user.id);
      if (other) {
        this.dmUser = { id: other.id, name: other.name, lat: other.lat, lng: other.lng, emoji: other.emoji };
        if (!this.teamName || this.teamName === teamId) this.teamName = 'DM · ' + (other.name || 'User');
      } else {
        const peerId = teamId.replace(/^mapdm-/, '').split('--').find((p) => p && p !== Auth.user.id);
        if (peerId) {
          try {
            const { data: prof } = await Auth.client.from('profiles')
              .select('id, display_name, field_lat, field_lng, avatar_emoji')
              .eq('id', peerId).maybeSingle();
            if (prof) {
              this.dmUser = {
                id: prof.id,
                name: prof.display_name || 'User',
                lat: prof.field_lat,
                lng: prof.field_lng,
                emoji: prof.avatar_emoji || '👤',
              };
              this.members.set(prof.id, this.dmUser);
              if (!this.teamName || this.teamName === teamId) this.teamName = 'DM · ' + (prof.display_name || 'User');
            }
          } catch (_) {}
        }
      }
    }
    await this._joinChannel(teamId);
    this._openCloud(this.teamName);
    this._rebuildViz();
    this._renderMessages();
    AciCli?.print('◎ joined ' + this.teamName, 'ok');
    ContextTruth?.sync?.();
  },

  async leaveTeam() {
    if (this.rtChannel && Auth?.client) {
      try { await Auth.client.removeChannel(this.rtChannel); } catch (_) {}
    }
    this.rtChannel = null;
    this.teamId = null;
    this.kind = 'team';
    this.members.clear();
    this.messages = [];
    this.dmUser = null;
    this.compromised = null;
    ContextTruth?.clearCompromised?.();
    this._clearViz();
    this.closeCloud();
    this.hideDriverPicker();
    ContextTruth?.sync?.();
  },

  async _joinChannel(teamId) {
    if (!Auth?.client) return;
    if (this.rtChannel) {
      try { await Auth.client.removeChannel(this.rtChannel); } catch (_) {}
      this.rtChannel = null;
    }
    const ch = Auth.client.channel('map-team-' + teamId, {
      config: { broadcast: { self: false }, presence: { key: Auth.user.id } },
    });
    ch.on('broadcast', { event: 'chat' }, ({ payload }) => this._onChat(payload));
    ch.on('broadcast', { event: 'member' }, ({ payload }) => this._onMember(payload));
    ch.on('broadcast', { event: 'call' }, ({ payload }) => this._onCallSignal(payload));
    ch.on('presence', { event: 'sync' }, () => this._syncPresence(ch));
    await ch.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') {
        const self = this.selfMember();
        await ch.track(self);
        ch.send({ type: 'broadcast', event: 'member', payload: self });
      }
    });
    this.rtChannel = ch;
  },

  _syncPresence(ch) {
    const state = ch.presenceState();
    Object.keys(state).forEach((key) => {
      (state[key] || []).forEach((p) => {
        if (p?.id) this.members.set(p.id, p);
      });
    });
    this._rebuildViz();
  },

  _onMember(m) {
    if (!m?.id) return;
    this.members.set(m.id, m);
    this._rebuildViz();
  },

  _onChat(msg) {
    if (!msg?.body) return;
    this._checkIntrusion(msg);
    this.messages.push(msg);
    if (this.messages.length > 80) this.messages.shift();
    this._renderMessages();
    this._persistMessage(msg);
  },

  _checkIntrusion(msg) {
    const uid = msg.author_id || msg.from || msg.user_id;
    const selfId = Auth?.user?.id;
    if (!uid || uid === selfId) return;
    if (this.kind === 'dm' && this.dmUser?.id && uid !== this.dmUser.id) {
      this.compromised = { id: uid, name: msg.author || msg.name || 'Intruder', at: Date.now() };
      ContextTruth?.setCompromised?.(this.compromised);
      this.postSystem('⚠ COMPROMISED — unexpected sender: ' + (msg.author || uid.slice(0, 8)));
      return;
    }
    if (this.kind === 'team' && this.members?.size && !this.members.has(uid)) {
      this.compromised = { id: uid, name: msg.author || msg.name || 'Intruder', at: Date.now() };
      ContextTruth?.setCompromised?.(this.compromised);
      this.postSystem('⚠ COMPROMISED — non-member on team cloud: ' + (msg.author || uid.slice(0, 8)));
    }
  },

  _applyCloudTruth() {
    const cloud = document.getElementById('map-comms-cloud');
    if (!cloud) return;
    const mode = this.compromised ? 'compromised' : (this.kind || 'team');
    cloud.dataset.truth = mode;
    if (this.compromised) {
      cloud.classList.add('compromised');
      this.BLUE = 0xff3344;
      this.BLUE_GLOW = 0xff6688;
    } else {
      cloud.classList.remove('compromised');
      this.BLUE = 0x1a6fd4;
      this.BLUE_GLOW = 0x3d9eff;
    }
    this._rebuildViz();
    ContextTruth?.sync?.();
  },

  async _persistMessage(msg) {
    if (!this.teamId || !Auth?.client) return;
    try {
      await Auth.client.from('circle_messages').insert({
        circle_id: this.teamId,
        author: msg.author || msg.name || 'user',
        author_id: msg.author_id || Auth?.user?.id || null,
        text: msg.body,
        ts: msg.t || Date.now(),
      });
    } catch (_) {}
  },

  sendFromInput() {
    const input = document.getElementById('mc-input');
    const body = (input?.value || '').trim();
    if (!body) return;
    if (input) input.value = '';
    this.sendMessage(body);
  },

  postSystem(body) {
    const msg = { author: '◎', name: '◎', body: String(body || '').slice(0, 500), t: Date.now(), system: true };
    this._onChat(msg);
  },

  sendMessage(body) {
    const self = this.selfMember();
    const msg = {
      author: self.name,
      author_id: self.id,
      body: body.slice(0, 500),
      lat: self.lat,
      lng: self.lng,
      t: Date.now(),
    };
    this._onChat(msg);
    this.rtChannel?.send({ type: 'broadcast', event: 'chat', payload: msg });
    if (this.dmUser) this._sendDm(msg);
    if (this.kind === 'dm' && this.dmUser?.id) {
      CliHub?.queueLine?.(msg.body, 'out', { peer_id: this.dmUser.id, circle_id: this.teamId });
    }
  },

  _youtubeFromMsg(m) {
    return GlobeVideo?.parseId?.(m.body) || GlobeVideo?.parseId?.(m.url) || null;
  },

  _lineHtml(m) {
    const yt = this._youtubeFromMsg(m);
    const vid = yt
      ? ('<div class="mc-yt-card"><iframe title="YouTube preview" src="https://www.youtube-nocookie.com/embed/'
        + yt + '?rel=0&modestbranding=1&playsinline=1" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>')
      : '';
    return '<div class="mc-line"><b>' + this.esc(m.author || m.name) + '</b> ' + this.esc(m.body) + vid + '</div>';
  },

  showCloudVideo(videoId, title) {
    const box = document.getElementById('mc-media');
    const cloud = document.getElementById('map-comms-cloud');
    if (!box) return;
    const id = GlobeVideo?.parseId?.(videoId) || videoId;
    if (!id) return;
    cloud?.classList.add('has-media');
    if (!cloud?.classList.contains('open')) cloud?.classList.add('open');
    box.classList.add('open');
    box.innerHTML = '<div class="mc-yt-title">▶ ' + this.esc((title || 'YouTube').slice(0, 56)) + '</div>'
      + '<div class="mc-yt-wrap"><button type="button" class="mc-yt-close">✖</button>'
      + '<iframe title="' + this.esc(title || 'YouTube') + '" src="https://www.youtube-nocookie.com/embed/'
      + id + '?rel=0&modestbranding=1&playsinline=1" allow="autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe></div>';
    box.querySelector('.mc-yt-close')?.addEventListener('click', () => this.hideCloudVideo());
  },

  hideCloudVideo() {
    const box = document.getElementById('mc-media');
    if (box) { box.classList.remove('open'); box.innerHTML = ''; }
    document.getElementById('map-comms-cloud')?.classList.remove('has-media');
  },

  _renderMessages() {
    const log = document.getElementById('mc-log');
    if (!log) return;
    const msgs = this.messages.slice(-40);
    const global = GlobeEntity?.isGlobalView?.();

    if (global && msgs.length >= 3) {
      const groups = new Map();
      msgs.forEach((m) => {
        const lat = m.lat ?? this._center?.lat ?? 36.22;
        const lng = m.lng ?? this._center?.lng ?? 28.12;
        const key = GlobeEntity?.cellKey?.(lat, lng) || '0:0';
        const g = groups.get(key) || { key, lat, lng, items: [] };
        g.items.push(m);
        groups.set(key, g);
      });
      log.innerHTML = [...groups.values()].map((g) => {
        if (g.items.length < 2) return this._lineHtml(g.items[0]);
        const yt = g.items.map((m) => this._youtubeFromMsg(m)).find(Boolean);
        const vid = yt
          ? ('<div class="mc-yt-card"><iframe title="YouTube" src="https://www.youtube-nocookie.com/embed/'
            + yt + '?rel=0&modestbranding=1&playsinline=1" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe></div>')
          : '';
        return '<details class="mc-cluster"><summary>☁ ' + g.items.length + ' · '
          + g.lat.toFixed(1) + '°, ' + g.lng.toFixed(1) + '°</summary><div class="mc-cluster-body">'
          + g.items.map((m) => this._lineHtml(m)).join('') + vid + '</div></details>';
      }).join('');
    } else {
      log.innerHTML = msgs.slice(-24).map((m) => this._lineHtml(m)).join('');
      const lastYt = [...msgs].reverse().map((m) => this._youtubeFromMsg(m)).find(Boolean);
      if (lastYt) this.showCloudVideo(lastYt, 'Latest video');
    }
    log.scrollTop = log.scrollHeight;
  },

  _openCloud(title) {
    const cloud = document.getElementById('map-comms-cloud');
    if (!cloud) return;
    document.getElementById('mc-title').textContent = title || 'Cloud chat';
    cloud.classList.add('open');
    cloud.dataset.kind = this.kind || 'team';
    this._applyCloudTruth();
    this._renderMessages();
    ContextTruth?.sync?.();
  },

  closeCloud() {
    document.getElementById('map-comms-cloud')?.classList.remove('open');
    document.getElementById('map-comms-contact')?.classList.remove('open');
    this.hideCloudVideo();
    this.hideDriverPicker();
    if (this._beamSvg) this._beamSvg.innerHTML = '';
  },

  renderDriverPicker(drivers, orderId) {
    const box = document.getElementById('mc-drivers');
    if (!box) return;
    const list = drivers || [];
    if (!list.length) {
      box.style.display = 'none';
      box.innerHTML = '';
      return;
    }
    box.style.display = 'block';
    box.dataset.orderId = orderId || '';
    const u = Commerce?.userLatLng?.() || window._lastPos || {};
    box.innerHTML = '<div class="mc-drivers-title">🚚 Choose delivery driver</div>'
      + list.slice(0, 8).map((d) => {
        const km = d.km != null ? d.km.toFixed(1) : (Commerce?.haversineKm?.(u.lat, u.lng, d.field_lat, d.field_lng)?.toFixed(1) || '?');
        return '<button type="button" class="mc-driver-pick" data-driver-id="' + this.esc(d.id) + '">'
          + this.esc(d.avatar_emoji || d.emoji || '🚚') + ' ' + this.esc(d.display_name || d.name || 'Driver')
          + ' · ' + km + ' km</button>';
      }).join('');
    box.querySelectorAll('.mc-driver-pick').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.driverId;
        if (id) MarketplaceComms?.selectDriver?.(id);
      });
    });
  },

  hideDriverPicker() {
    const box = document.getElementById('mc-drivers');
    if (box) { box.style.display = 'none'; box.innerHTML = ''; }
  },

  contactMenu(user) {
    if (!user?.id) return;
    const hud = document.getElementById('map-comms-contact');
    if (!hud) return;
    hud.dataset.userId = user.id;
    document.getElementById('mc-contact-name').textContent = (user.emoji || '👤') + ' ' + (user.name || 'User');
    hud.classList.add('open');
    GlobeEntity?.clearSelection?.();
  },

  async contactUser(userId, mode) {
    const u = [...(window.others || []), this.selfMember()].find(x => x.id === userId)
      || this.members.get(userId);
    if (!u) {
      ACIControl?.reply('User not on map');
      return;
    }
    document.getElementById('map-comms-contact')?.classList.remove('open');
    const m = (mode || 'message').toLowerCase();
    if (m === 'message' || m === 'msg' || m === 'chat') {
      if (CliHub?.startPrivateCloud) {
        await CliHub.startPrivateCloud(u.id);
        return;
      }
      this.dmUser = u;
      this._openCloud('DM · ' + u.name);
      ACIControl?.reply('Message ' + u.name + ' in the cloud above the map');
      return;
    }
    if (m === 'video') return this.startVideoCall(u);
    if (m === 'voice' || m === 'audio') return this.startVoiceCall(u);
    if (m === 'landline' || m === 'cellular' || m === 'phone') return this.startPhoneCall(u, m);
    ACIControl?.reply('contact: video · voice · message · landline · cellular');
  },

  async _userPhone(userId) {
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/profiles?select=phone,display_name&id=eq.' + encodeURIComponent(userId) + '&limit=1', { headers });
      const rows = r.ok ? await r.json() : [];
      return rows[0]?.phone || null;
    } catch { return null; }
  },

  async startPhoneCall(user, kind) {
    const phone = await this._userPhone(user.id);
    if (!phone) {
      ACIControl?.reply('No phone on file — use message or ask them to add phone in profile');
      this.dmUser = user;
      this._openCloud('DM · ' + user.name);
      return;
    }
    const tel = phone.replace(/\s/g, '');
    ACIControl?.reply((kind === 'landline' ? 'Landline' : 'Cellular') + ' · ' + user.name);
    AciCli?.print('tel:' + tel, 'ok');
    window.open('tel:' + tel, '_self');
  },

  async startVoiceCall(user) {
    if (!navigator.mediaDevices?.getUserMedia) {
      ACIControl?.reply('Microphone not available');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this._inviteCall(user, 'voice');
      ACIControl?.reply('Voice call to ' + user.name + ' — invite sent on map mesh');
      MapDepict?.pulse?.(user.lat, user.lng, 0x3d9eff, 'voice → ' + user.name, 10000);
      setTimeout(() => stream.getTracks().forEach(t => t.stop()), 60000);
    } catch (e) {
      ACIControl?.reply('Mic denied — allow microphone for voice call');
    }
  },

  async startVideoCall(user) {
    this._inviteCall(user, 'video');
    if (typeof startOrbitalVideoCall === 'function') {
      startOrbitalVideoCall(user.name);
    } else {
      ACIControl?.reply('Video invite to ' + user.name + ' — WebRTC starting');
    }
    MapDepict?.pulse?.(user.lat, user.lng, 0x3d9eff, 'video → ' + user.name, 12000);
  },

  _inviteCall(user, kind) {
    const payload = {
      type: 'invite',
      kind,
      from: this.selfMember(),
      to: user.id,
      t: Date.now(),
    };
    const chName = 'map-call-' + [Auth.user.id, user.id].sort().join('-');
    if (!this.callChannel) {
      this.callChannel = Auth.client.channel(chName, { config: { broadcast: { self: false } } });
      this.callChannel.on('broadcast', { event: 'call' }, ({ payload: p }) => this._onCallSignal(p));
      this.callChannel.subscribe();
    }
    this.callChannel.send({ type: 'broadcast', event: 'call', payload });
    this.rtChannel?.send({ type: 'broadcast', event: 'call', payload });
  },

  _onCallSignal(p) {
    if (!p || p.to !== Auth?.user?.id) return;
    const from = p.from?.name || 'User';
    if (p.type === 'invite') {
      ACIControl?.reply(from + ' · ' + (p.kind || 'call') + ' — tap player or type: contact ' + from + ' ' + p.kind);
      GlobeDeck?.setPreview?.('📞 ' + from + ' · ' + p.kind);
    }
  },

  async _sendDm(msg) {
    if (!this.dmUser?.id || !Auth?.client) return;
    const chName = 'map-dm-' + [Auth.user.id, this.dmUser.id].sort().join('-');
    const ch = Auth.client.channel(chName, { config: { broadcast: { self: false } } });
    await ch.subscribe();
    ch.send({ type: 'broadcast', event: 'chat', payload: { ...msg, to: this.dmUser.id } });
    setTimeout(() => { try { Auth.client.removeChannel(ch); } catch (_) {} }, 3000);
  },

  _centroid(members) {
    if (!members.length) return { lat: 36.22, lng: 28.12 };
    let lat = 0, lng = 0;
    members.forEach((m) => { lat += m.lat; lng += m.lng; });
    return { lat: lat / members.length, lng: lng / members.length };
  },

  _clearViz() {
    if (this._viz?.parent) this._viz.parent.remove(this._viz);
    this._viz = null;
    this._lines = [];
  },

  _rebuildViz() {
    if (!globePivot) return;
    this._clearViz();
    const members = this.memberList();
    if (members.length < 1) return;

    const group = new THREE.Group();
    group.name = 'mapCommsViz';
    const center = this._centroid(members);
    this._center = center;

    const sorted = members.slice().sort((a, b) => {
      const angA = Math.atan2(a.lat - center.lat, a.lng - center.lng);
      const angB = Math.atan2(b.lat - center.lat, b.lng - center.lng);
      return angA - angB;
    });

    const ringPts = sorted.map((m) => {
      const p = latLngToPos(m.lat, m.lng, this.SURFACE_R);
      return new THREE.Vector3(p.x, p.y, p.z);
    });
    if (ringPts.length >= 2) {
      const closed = ringPts.concat([ringPts[0].clone()]);
      this._addGlowLine(group, closed);
      ringPts.forEach((pt) => this._addGlowLine(group, [this._surfaceCenter(center), pt]));
    }

    const sky = this._skyPoint(center);
    this._skyAnchor = sky;
    this._addGlowLine(group, [this._surfaceCenter(center), sky]);

    const cloudGeo = new THREE.SphereGeometry(0.045, 12, 12);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: this.BLUE_GLOW,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMesh.position.copy(sky);
    group.add(cloudMesh);

    globePivot.add(group);
    this._viz = group;
  },

  _surfaceCenter(c) {
    const p = latLngToPos(c.lat, c.lng, this.SURFACE_R);
    return new THREE.Vector3(p.x, p.y, p.z);
  },

  _skyPoint(c) {
    const p = latLngToPos(c.lat, c.lng, this.CLOUD_R);
    return new THREE.Vector3(p.x, p.y, p.z);
  },

  _addGlowLine(group, points) {
    const glow = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: this.BLUE, transparent: true, opacity: 0.22 })
    );
    const core = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(points),
      new THREE.LineBasicMaterial({ color: this.BLUE_GLOW, transparent: true, opacity: 0.78 })
    );
    group.add(glow);
    group.add(core);
    this._lines.push(glow, core);
  },

  tick() {
    const global = GlobeEntity?.isGlobalView?.();
    if (global !== this._wasGlobal) {
      this._wasGlobal = global;
      if (document.getElementById('map-comms-cloud')?.classList.contains('open') && this.messages.length) {
        this._renderMessages();
      }
    }
    if (!this._viz || !this._lines.length) {
      if (this._beamSvg) this._beamSvg.innerHTML = '';
      return;
    }
    this._pulse += 0.04;
    const o = 0.55 + Math.sin(this._pulse) * 0.22;
    this._lines.forEach((ln, i) => {
      if (ln.material) ln.material.opacity = (i % 2 ? 0.78 : 0.22) * (0.85 + Math.sin(this._pulse + i) * 0.15);
    });

    const members = this.memberList();
    (window.others || []).forEach((u) => {
      if (this.teamId && !this.members.has(u.id)) {
        this.members.set(u.id, u);
      }
    });
    if (Auth?.user) {
      const self = this.selfMember();
      this.members.set(self.id, self);
    }
    if (members.length >= 1 && this.teamId) this._rebuildVizThrottled();

    this._updateBeam();
    this._updateMemberPositions();
  },

  _rebuildTick: 0,
  _rebuildVizThrottled() {
    const now = Date.now();
    if (now - this._rebuildTick < 2800) return;
    this._rebuildTick = now;
    this._rebuildViz();
  },

  _updateMemberPositions() {
    if (!this.rtChannel || !Auth?.user) return;
    const self = this.selfMember();
    const prev = this.members.get(self.id);
    if (!prev || Math.abs(prev.lat - self.lat) > 0.0001 || Math.abs(prev.lng - self.lng) > 0.0001) {
      this.members.set(self.id, self);
      this.rtChannel.track(self);
      this.rtChannel.send({ type: 'broadcast', event: 'member', payload: self });
    }
  },

  _updateBeam() {
    const svg = this._beamSvg;
    const cloud = document.getElementById('map-comms-cloud');
    if (!svg || !cloud?.classList.contains('open') || !this._center || !camera) {
      if (svg) svg.innerHTML = '';
      return;
    }
    const centerWorld = this._surfaceCenter(this._center);
    const cScr = centerWorld.clone().project(camera);
    const cx = (cScr.x * 0.5 + 0.5) * window.innerWidth;
    const cy = (-cScr.y * 0.5 + 0.5) * window.innerHeight;
    const cr = cloud.getBoundingClientRect();
    const x1 = cr.left + cr.width / 2;
    const y1 = cr.bottom - 4;
    if (cScr.z > 1) { svg.innerHTML = ''; return; }
    svg.innerHTML = '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + cx + '" y2="' + cy + '" />'
      + '<line class="mc-beam-glow" x1="' + x1 + '" y1="' + y1 + '" x2="' + cx + '" y2="' + cy + '" />';
  },

  async cmd(parts) {
    const sub = (parts[1] || 'help').toLowerCase();
    const rest = parts.slice(2).join(' ');
    if (sub === 'create' || sub === 'new') return this.createTeam(rest || 'Cloud team');
    if (sub === 'join') return this.joinTeam(rest);
    if (sub === 'leave') { await this.leaveTeam(); ACIControl?.reply('Left map team'); return; }
    if (sub === 'msg' || sub === 'say') { this.sendMessage(rest); return; }
    ACIControl?.reply('team create <name> · team join <id> · team leave · team say <text>');
  },

  async contactCmd(parts) {
    const mode = (parts[1] || 'message').toLowerCase();
    const name = parts.slice(2).join(' ').toLowerCase();
    const u = (window.others || []).find(x => (x.name || '').toLowerCase().includes(name));
    if (!u) {
      ACIControl?.reply('Tap a player on the map or: contact video <name>');
      return;
    }
    return this.contactUser(u.id, mode);
  },
};

window.MapComms = MapComms;

(function(){
// === TELEMACHOS PILOT — gaming · commercial · extreme takeover ===
// ΤΗΛΕΜΑΧΟΣ (gaming) · ΤΗΛΕΔΡΟΜΟΣ (commercial) · tilemaxos (extreme tech / hostile takeover)
const Pilot = {
  HOME: { lat: 36.2, lng: 28.1 },
  EVO_KEY: 'astranov_telemachos_evolve_v1',

  EDITIONS: {
    telemachos: {
      id: 'telemachos',
      name_gr: 'ΤΗΛΕΜΑΧΟΣ',
      name_latin: 'telemachos',
      tier: 'gaming',
      tagline: 'Ο ισχυρότερος πιλότος drone — εξελίσσεται με πραγματικούς gamers στο Astranov.',
      takeover: true,
      evolve: true,
      color: 0x00ccff,
    },
    teledromos: {
      id: 'teledromos',
      name_gr: 'ΤΗΛΕΔΡΟΜΟΣ',
      name_latin: 'teledromos',
      tier: 'commercial',
      tagline: 'Εμπορική έκδοση — marketplace delivery, vendors, drivers, ασφαλείς διαδρομές.',
      takeover: false,
      evolve: false,
      color: 0x3d9eff,
    },
    tilemaxos: {
      id: 'tilemaxos',
      name_gr: 'tilemaxos',
      name_latin: 'tilemaxos',
      tier: 'extreme',
      parent: 'telemachos',
      tagline: 'Extreme stack — ανάληψη ΟΠΟΙΟΥΔΗΠΟΤΕ drone (ειδικά FPV) · RTB στον πιλότο του.',
      takeover: true,
      evolve: true,
      color: 0xff3366,
    },
  },

  EXTREME_TECH: [
    { id: 'mesh_hijack', label: 'Mesh C2 hijack', desc: 'Override opponent drone command mesh on globe field' },
    { id: 'rf_dominance', label: 'RF spectrum dominance', desc: 'Jam + seize control link in 2.4/5.8 GHz + PMR guard band' },
    { id: 'swarm_handoff', label: 'Swarm handoff', desc: 'Captured unit joins your fleet instantly — unlimited scale' },
    { id: 'metis_routing', label: 'Metis anti-counter', desc: 'Hellenic cunning — reroute when enemy tries to reclaim' },
    { id: 'multi_domain', label: 'Multi-domain relay', desc: 'Air ↔ ground ↔ sea ↔ underwater bridge for takeover probe' },
    { id: 'user_telemetry', label: 'Real-user telemetry fusion', desc: 'Power grows from live gamers on map — no simulation' },
    { id: 'ghost_echo', label: 'Ghost echo decoy', desc: 'Opponent sees false drone while you own the real unit' },
    { id: 'justice_gate', label: 'Justice gate', desc: 'Takeover only in gaming field — never on civilian marketplace routes' },
    { id: 'fpv_seize', label: 'FPV link seizure', desc: 'Hijack analog/digital FPV video+C2 — highest priority target class' },
    { id: 'pilot_rtb', label: 'Pilot RTB flyback', desc: 'After capture, fly drone home to its pilot on globe — handoff at feet' },
  ],

  TEAM_BLUE: 0x1a6fd4,
  TEAM_RED: 0xff2244,
  WIN_ITEM_IDS: ['pita', 'beer', 'cigarettes', 'burger'],

  _team: { red: [], pending: [], hits: [], won: false, fed: 0, redCount: 0 },

  DOMAINS: {
    fpv: { emoji: '🥽', label: 'FPV', color: 0xff66cc, alt: 1.07 },
    air: { emoji: '🛸', label: 'Air', color: 0x44ccff, alt: 1.06 },
    ground: { emoji: '🚙', label: 'Ground', color: 0xffaa33, alt: 1.025 },
    sea: { emoji: '🚤', label: 'Sea', color: 0x0088ff, alt: 1.02 },
    underwater: { emoji: '🤿', label: 'Underwater', color: 0x2266aa, alt: 1.015 },
  },

  SPELLINGS_TELEMACHOS: [
    'telemachos', 'telemachus', 'telemakhos', 'tilemaxos', 'tilemachos', 'tilemachus',
    'telemaxos', 'telmaxos', 'telmachos', 'tilemax', 'thilemaxos', 'thilemachos',
    'τηλεμαχος', 'τηλεμαχοσ', 'τηλεμαχός', 'τηλεμαχ',
  ],

  SPELLINGS_TELEDROMOS: [
    'teledromos', 'teledromus', 'teledromo', 'tilestromos', 'τηλεδρομος', 'τηλεδρομός', 'τηλεδρομ',
  ],

  _edition: 'telemachos',
  _fleet: { fpv: [], air: [], ground: [], sea: [], underwater: [] },
  _fieldDrones: [],
  _hostile: [],
  _captured: [],
  _activeMissions: [],
  _nextId: 1,
  _evolution: {
    xp: 0,
    level: 1,
    takeovers: 0,
    flybacks: 0,
    fpv_captures: 0,
    deliveries: 0,
    gamers_seen: 0,
    power: 100,
  },

  get edition() { return this.EDITIONS[this._edition] || this.EDITIONS.telemachos; },
  get NAME_GR() { return this.edition.name_gr; },
  get NAME_LATIN() { return this.edition.name_latin; },

  async init() {
    this._loadEvolutionLocal();
    this._initRealtime();
    this._initTeamRealtime();
    if (Auth?.whenReady) await Auth.whenReady();
    this._loadEvolutionFromServer();
    this._subscribeC2Signals();
    if (Auth?.user) this.refreshTeamStatus({ quiet: true });
  },

  async api(body) {
    if (Auth?.whenReady) await Auth.whenReady();
    const headers = Auth?.authHeaders ? await Auth.authHeaders() : sbHeaders();
    const fnBase = typeof resolveAstranovFunctionsUrl === 'function' ? resolveAstranovFunctionsUrl() : (SB_URL + '/functions/v1');
    const r = await fetch(fnBase + '/pilot-command', {
      method: 'POST', headers,
      body: JSON.stringify(body),
    });
    return r.json().catch(() => ({ error: 'network' }));
  },

  _loadEvolutionLocal() {
    try {
      const raw = localStorage.getItem(this.EVO_KEY);
      if (raw) Object.assign(this._evolution, JSON.parse(raw));
    } catch (_) {}
  },

  _saveEvolutionLocal() {
    try { localStorage.setItem(this.EVO_KEY, JSON.stringify(this._evolution)); } catch (_) {}
  },

  async _loadEvolutionFromServer() {
    if (!Auth?.user) return;
    const r = await this.api({ action: 'evolution_get' });
    if (r.ok && r.evolution) {
      Object.assign(this._evolution, r.evolution);
      this._saveEvolutionLocal();
    }
  },

  _applyEvolution(evo) {
    if (!evo) return;
    Object.assign(this._evolution, evo);
    this._saveEvolutionLocal();
  },

  _initRealtime() {
    if (!Auth?.client || this._rtChannel) return;
    this._rtChannel = Auth.client.channel('pilot-fleet-live');
    this._rtChannel.on('postgres_changes', {
      event: '*', schema: 'public', table: 'pilot_drones',
    }, () => { this.scanAllDrones({ quiet: true }); });
    this._rtChannel.subscribe();
  },

  _subscribeC2Signals() {
    if (!Auth?.user?.id || !Auth?.client || this._c2Channel) return;
    const room = 'pilot-c2-' + Auth.user.id;
    this._c2Channel = Auth.client.channel('pilot-c2-' + Auth.user.id);
    this._c2Channel.on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'webrtc_signals',
      filter: 'room=eq.' + room,
    }, ({ new: sig }) => {
      if (!sig) return;
      if (sig.type === 'drone_seized') {
        ACIControl?.reply('C2 alert — your ' + (sig.payload?.domain || 'drone') + ' link seized · tilemaxos RTB incoming');
      }
      if (sig.type === 'drone_rtb') {
        ACIControl?.reply('C2 — drone returning to you on OSRM route');
      }
      if (sig.type === 'blue_victory') {
        this._declareVictory(sig.payload);
      }
    });
    this._c2Channel.subscribe();
  },

  _initTeamRealtime() {
    if (!Auth?.client || this._teamChannel) return;
    this._teamChannel = Auth.client.channel('pilot-team-hits');
    this._teamChannel.on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'pilot_team_hits',
    }, () => { this.refreshTeamStatus({ quiet: true }); });
    this._teamChannel.subscribe();
  },

  _blueAllyIds() {
    const ids = [];
    if (Auth?.user?.id) ids.push(Auth.user.id);
    (window.MapComms?.members ? [...window.MapComms.members.keys()] : []).forEach((id) => {
      if (id && id !== Auth?.user?.id) ids.push(id);
    });
    return ids;
  },

  async refreshTeamStatus(opts) {
    opts = opts || {};
    if (!Auth?.user) {
      const titans = WillaGames?.getDemoRedTeam?.() || [];
      if (titans.length) {
        this._team = {
          red: titans,
          pending: titans.map((p) => ({ id: p.id, name: p.name })),
          hits: [],
          won: false,
          fed: 0,
          redCount: titans.length,
        };
        this._visualizeTeams();
      } else {
        this._team = { red: [], pending: [], hits: [], won: false, fed: 0, redCount: 0 };
      }
      return this._team;
    }
    const r = await this.api({ action: 'team_status', blue_allies: this._blueAllyIds() });
    if (!r.ok) return this._team;
    this._team = {
      red: r.red || [],
      pending: r.pending || [],
      hits: r.hits || [],
      won: !!r.won,
      fed: r.fed_count || 0,
      redCount: r.red_count || 0,
    };
    this._visualizeTeams();
    if (r.won && !opts.quiet) this._declareVictory({ fed_count: r.fed_count, red_count: r.red_count });
    return this._team;
  },

  _findRedPlayer(q) {
    const list = this._team.red || [];
    const s = String(q || '').toLowerCase().trim();
    if (!s || s === 'all' || s === 'any') return list[0] || null;
    return list.find((p) => p.id === q || String(p.id).includes(s))
      || list.find((p) => (p.name || '').toLowerCase().includes(s))
      || null;
  },

  _resolveWinItemFromOrder(items) {
    const names = (items || []).map((i) => String(i.name || '')).join(' ');
    const wants = Commerce?.parseWantedItems?.(names) || [];
    return wants.find((w) => this.WIN_ITEM_IDS.includes(w.id)) || null;
  },

  _visualizeTeams() {
    const red = this._team.red || [];
    const pending = this._team.pending || [];
    const pendingIds = new Set(pending.map((p) => p.id));
    red.forEach((p) => {
      const fed = !pendingIds.has(p.id);
      MapDepict?.pulse?.(p.lat, p.lng, fed ? 0x884444 : this.TEAM_RED, (fed ? '✓ ' : '🔴 ') + p.name, 14000);
    });
    const enrichedRed = red.map((p) => ({
      ...p,
      team: 'red',
      emoji: pendingIds.has(p.id) ? '🔴' : '✓',
      fed: !pendingIds.has(p.id),
    }));
    const redIds = new Set(red.map((p) => p.id));
    const blues = (window.others || []).filter((u) => !redIds.has(u.id) && u.team !== 'red');
    GlobeEntity?.syncFriends?.([...blues, ...enrichedRed], { teamMode: true });
    const u = Commerce?.userLatLng?.() || window._lastPos || this.HOME;
    MapDepict?.pulse?.(u.lat, u.lng, this.TEAM_BLUE, '🔵 BLUE TEAM', 10000);
  },

  _declareVictory(payload) {
    if (this._team._victoryShown) return;
    this._team._victoryShown = true;
    this._team.won = true;
    const n = payload?.red_count || this._team.redCount || 0;
    const msg = '🏆 BLUE TEAM WINS — delivered burger/beer/pitogyro/mpironi/tsigareta to all ' + n + ' red players!';
    MapDepict?.action?.('play', { lat: this.HOME.lat, lng: this.HOME.lng, detail: msg });
    window.MapComms?.postSystem?.(msg);
    ACI?.feed?.('blue-victory', String(n) + ' red fed');
    this._gainXp(500, 'delivery');
    this._logField('pilot', 'blue_team_victory', { visual_truth: true, red_count: n });
    this.say(msg);
    setTimeout(() => { this._team._victoryShown = false; }, 60000);
  },

  teamsText() {
    const t = this._team;
    if (!t.redCount) {
      return [
        '── Blue vs Red · ΤΗΛΕΜΑΧΟΣ ──',
        '🔵 You are always BLUE TEAM',
        '🔴 Opponents = Cronian titans (Kronos leads) or live players on map',
        'Win: deliver πιτογύρο · burger · μπύρα/mpironi · τσιγάρα to EVERY red player',
        'Demo: players · kryfto · willa — 12 titans spawn as red team',
        'deliver red <name> pitogyra · teams · attack',
      ].join('\n');
    }
    const lines = [
      '── Blue vs Red · field warfare ──',
      '🔵 BLUE (us): you' + (this._blueAllyIds().length > 1 ? ' + ' + (this._blueAllyIds().length - 1) + ' allies' : ''),
      '🔴 RED: ' + t.redCount + ' · fed: ' + t.fed + '/' + t.redCount + (t.won ? ' · 🏆 WON' : ''),
    ];
    t.red.forEach((p, i) => {
      const fed = !(t.pending || []).find((x) => x.id === p.id);
      lines.push((i + 1) + '. ' + (fed ? '✓' : '🔴') + ' ' + p.name + ' · ' + p.lat.toFixed(3) + ',' + p.lng.toFixed(3));
    });
    if (t.pending?.length) {
      lines.push('Still need: ' + t.pending.map((p) => p.name).join(', '));
      lines.push('deliver red <name> pitogyra|beer|burger|tsigareta');
    } else if (!t.won) {
      lines.push('All fed — checking victory…');
    }
    return lines.join('\n');
  },

  async deliverToRed(targetQ, itemQuery) {
    if (!Auth?.user) {
      this.say('Sign in — blue team delivers to red rivals on real GPS');
      Auth?.signInGoogle?.();
      return { error: 'login_required' };
    }
    this._setEdition('telemachos');
    await this.refreshTeamStatus({ quiet: true });
    const red = this._findRedPlayer(targetQ);
    if (!red) {
      this.say('No red player — teams to list rivals on map');
      return { error: 'no_red_target' };
    }

    let wants = Commerce?.parseWantedItems?.(itemQuery || 'pitogyra') || [];
    wants = wants.filter((w) => this.WIN_ITEM_IDS.includes(w.id));
    if (!wants.length) wants = Commerce?.parseWantedItems?.('pitogyra beer')?.filter((w) => this.WIN_ITEM_IDS.includes(w.id)) || [];

    if (!wants.length) {
      this.say('Win items only: pitogyro · burger · mpironi/beer · tsigareta');
      return { error: 'no_win_items' };
    }

    await Commerce.loadVendors();
    const u = { lat: red.lat, lng: red.lng };
    const matches = [];
    Commerce.vendors.forEach((v) => {
      const m = Commerce.scoreVendorForWants(v, wants, u);
      if (m) matches.push(m);
    });
    matches.sort((a, b) => b.score - a.score);
    const pick = matches[0];
    if (!pick) {
      this.say('No vendor menu matches — try another item or vendor with menu');
      return { error: 'no_vendor_match' };
    }

    const orderItems = pick.picks.map((p) => ({ name: p.item.name, qty: 1, price: p.item.price || 0 }));
    const notes = 'BLUE→RED · ' + red.name + ' · ' + wants.map((w) => w.label).join('+');
    await Commerce.placeOrder(pick.vendor, orderItems, notes, false, {
      deliveryLat: red.lat,
      deliveryLng: red.lng,
      targetUserId: red.id,
      targetUser: red,
    });
    this.showPilot(red.lat, red.lng, 'telemachos');
    const msg = '🔵→🔴 OSRM delivery to ' + red.name + ' · ' + wants.map((w) => w.label).join(' · ');
    this.out(msg, 'ok');
    return { ok: true, target: red, wants };
  },

  async onTeamOrder(opts) {
    opts = opts || {};
    const target = opts.target;
    if (!target?.id) return;
    const winItem = this._resolveWinItemFromOrder(opts.items);
    if (!winItem) return;
    const r = await this.api({
      action: 'team_hit',
      red_target_id: target.id,
      item_type: winItem.id,
      order_id: opts.order?.id,
      lat: opts.deliveryLat ?? target.lat,
      lng: opts.deliveryLng ?? target.lng,
    });
    await this.refreshTeamStatus({ quiet: true });
    if (r.won) this._declareVictory(r);
    else if (r.ok) {
      const tag = r.already_fed ? 'already fed today' : 'hit logged';
      window.MapComms?.postSystem?.('🔵 ' + tag + ' · ' + (target.name || 'red') + ' · ' + winItem.label);
      this._gainXp(80, 'delivery');
    }
    return r;
  },

  _logField(action, detail, props) {
    FieldBrain?.pulse?.(action, detail, { role: 'pilot', props });
  },

  async _fetchOsrmRoute(fromLat, fromLng, toLat, toLng) {
    const url = 'https://router.project-osrm.org/route/v1/driving/'
      + fromLng + ',' + fromLat + ';' + toLng + ',' + toLat
      + '?overview=full&geometries=geojson';
    const r = await fetch(url);
    const j = await r.json();
    if (j.code !== 'Ok' || !j.routes?.[0]?.geometry?.coordinates) return null;
    return j.routes[0].geometry.coordinates.map((c) => ({ lng: c[0], lat: c[1] }));
  },

  _globePointsFromCoords(coords, alt) {
    const spec = this.DOMAINS.fpv;
    const a = alt ?? spec?.alt ?? 1.06;
    return (coords || []).map((c) => {
      const p = latLngToPos(c.lat, c.lng, a);
      return new THREE.Vector3(p.x, p.y, p.z);
    });
  },

  _syncGamerTelemetry() {
    const n = AstranovPresence?._live?.size ?? (others?.length || 0);
    if (n > this._evolution.gamers_seen) {
      this._gainXp((n - this._evolution.gamers_seen) * 12, 'live_gamers');
      this._evolution.gamers_seen = n;
      this._saveEvolutionLocal();
    }
  },

  _gainXp(amount, reason) {
    if (!this.edition.evolve && this._edition !== 'tilemaxos') return;
    this._evolution.xp += amount;
    const lvl = Math.floor(this._evolution.xp / 500) + 1;
    if (lvl > this._evolution.level) {
      this._evolution.level = lvl;
      this._evolution.power = 100 + (lvl - 1) * 35;
      MapDepict?.pulse?.(this.HOME.lat, this.HOME.lng, 0xff00aa, 'LEVEL ' + lvl, 6000);
    }
    if (reason === 'delivery') this._evolution.deliveries++;
    this._saveEvolutionLocal();
    this._logField('pilot', reason + ' +' + amount + 'xp', {});
  },

  norm(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/θ/g, 'th')
      .replace(/χ/g, 'ch')
      .replace(/ς/g, 's')
      .replace(/[^a-z0-9\u0370-\u03ffa-z\s]/gi, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  },

  foldedGreek(s) {
    return this.norm(s)
      .replace(/[άα]/g, 'a')
      .replace(/[ήη]/g, 'e')
      .replace(/[ίι]/g, 'i')
      .replace(/[όοω]/g, 'o')
      .replace(/[ύυ]/g, 'y');
  },

  mentionsTelemachos(text) {
    const raw = String(text || '');
    if (/τηλεμαχ/i.test(raw)) return true;
    const n = this.foldedGreek(raw);
    return this.SPELLINGS_TELEMACHOS.some((sp) => {
      const f = this.foldedGreek(sp);
      return n.includes(f) || n.split(' ').some((w) => w.startsWith(f.slice(0, 5)) && f.length >= 5);
    });
  },

  mentionsTeledromos(text) {
    const raw = String(text || '');
    if (/τηλεδρομ/i.test(raw)) return true;
    const n = this.foldedGreek(raw);
    return this.SPELLINGS_TELEDROMOS.some((sp) => n.includes(this.foldedGreek(sp)));
  },

  mentionsTilemaxos(text) {
    const n = this.foldedGreek(text);
    return n.includes('tilemaxos') || n.includes('tilemax') || n.includes('telemaxos');
  },

  wantsIntro(text) {
    const n = this.foldedGreek(text);
    return /who are you|introduce|present yourself|say hello|tell me about|τι εισαι|παρουσιασ|γνωρισ|abilities|δυνατοτητες|skills|τι κανεις|what can you|editions|εκδοση/.test(n)
      || /^hi\b|^hello\b|^γεια\b/.test(n.trim());
  },

  wantsCmd(line) {
    const raw = String(line || '').trim();
    if (!raw) return false;
    const parts = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    const cmd = (parts[0] || '').toLowerCase().replace(/^"|"$/g, '');
    const cmds = [
      'telemachos', 'tilemaxos', 'telemachus', 'tilemachos', 'teledromos', 'teledromus',
      'pilot', 'drone', 'drones', 'fleet',
    ];
    if (cmds.includes(cmd)) return true;
    if (this.mentionsTelemachos(raw) || this.mentionsTeledromos(raw) || this.mentionsTilemaxos(raw)) return true;
    if (/takeover|take over|ανάληψη|αναληψη|hostile|αντιπαλ|opponent|fpv|flyback|fly back|rtb|return to pilot/.test(this.foldedGreek(raw))) return true;
    if (/blue team|red team|deliver red|attack red|team war|μπλε|κοκκιν/.test(this.foldedGreek(raw))) return true;
    if (this.wantsIntro(raw) && /pilot|drone|delivery|παραδοση|διανομε|gaming|commercial/.test(this.foldedGreek(raw))) return true;
    return false;
  },

  _setEdition(id) {
    if (this.EDITIONS[id]) this._edition = id;
    return this.edition;
  },

  _friendlyIds() {
    const ids = new Set();
    if (Auth?.user?.id) ids.add(Auth.user.id);
    (window.MapComms?.members ? [...window.MapComms.members.keys()] : []).forEach((id) => ids.add(id));
    return ids;
  },

  async scanAllDrones(opts) {
    opts = opts || {};
    this._syncGamerTelemetry();
    const r = await this.api({ action: 'scan' });
    if (!r.ok) {
      if (!opts.quiet) this.out('Scan failed — sign in · ' + (r.error || 'server'), 'err');
      this._fieldDrones = [];
      return [];
    }
    this._fieldDrones = (r.drones || []).map((d) => ({
      id: d.id,
      owner: d.owner,
      ownerId: d.owner_id,
      operatorId: d.operator_id,
      pilotLat: d.pilot_lat,
      pilotLng: d.pilot_lng,
      team: d.team,
      domain: d.domain,
      fpv: d.fpv || d.domain === 'fpv',
      status: d.status,
      lat: d.lat,
      lng: d.lng,
      signal: d.link_strength,
      link_mhz: d.link_mhz,
      mesh: this._fieldDrones.find((x) => x.id === d.id)?.mesh || null,
    }));
    this._hostile = this._fieldDrones.filter((d) => d.team !== 'friendly' && d.ownerId !== Auth?.user?.id);
    if (!opts.quiet) this._logField('drone_scan', r.count + ' registered drones', { visual_truth: true });
    return this._fieldDrones;
  },

  scanHostiles() {
    return this.scanAllDrones();
  },

  _findDrone(targetId) {
    const list = this._fieldDrones;
    const q = String(targetId || '').toLowerCase();
    if (!q) return list.find((d) => d.fpv) || list[0] || null;
    if (q === 'fpv' || q === 'goggles') return list.find((d) => d.fpv || d.domain === 'fpv') || null;
    if (q === 'any' || q === 'all') return list.find((d) => d.team !== 'friendly') || list[0] || null;
    return list.find((d) => d.id === targetId || String(d.id).includes(q))
      || list.find((d) => (d.owner || '').toLowerCase().includes(q))
      || list.find((d) => d.domain === q)
      || null;
  },

  _visualizeDrone(d) {
    if (d.mesh?.parent) return d.mesh;
    const spec = this.DOMAINS[d.domain] || this.DOMAINS.air;
    const col = d.captured ? 0x00ff88 : (d.fpv ? 0xff66cc : (d.team === 'friendly' ? 0x44aaff : 0xff2244));
    const mesh = this._meshForDomain(d.domain, col);
    const pos = latLngToPos(d.lat, d.lng, spec.alt);
    mesh.position.set(pos.x, pos.y, pos.z);
    mesh.userData = { fieldDrone: true, id: d.id, owner: d.owner, fpv: !!d.fpv, captured: !!d.captured };
    globePivot.add(mesh);
    d.mesh = mesh;
    return mesh;
  },

  _visualizeHostile(h) {
    return this._visualizeDrone(h);
  },

  async flyBackToPilot(droneRec, targetMeta, opts) {
    opts = opts || {};
    const droneId = targetMeta?.id || droneRec?.meta?.fieldId;
    if (!droneId) return { error: 'no_drone_id' };

    const rtb = await this.api({ action: 'rtb', drone_id: droneId });
    if (!rtb.ok) {
      this.say('RTB failed — ' + (rtb.error || 'server'));
      return rtb;
    }
    this._applyEvolution(rtb.evolution);

    const from = rtb.from || { lat: targetMeta.lat, lng: targetMeta.lng };
    const to = rtb.to || { lat: targetMeta.pilotLat, lng: targetMeta.pilotLng };
    const spec = this.DOMAINS[targetMeta.domain] || this.DOMAINS.fpv;

    if (!droneRec?.mesh) {
      this._visualizeDrone({ ...targetMeta, lat: from.lat, lng: from.lng });
      droneRec = droneRec || {};
      droneRec.mesh = targetMeta.mesh;
      droneRec.domain = targetMeta.domain;
    }

    const osrm = await this._fetchOsrmRoute(from.lat, from.lng, to.lat, to.lng);
    let points;
    if (osrm?.length >= 2) {
      points = this._globePointsFromCoords(osrm, spec.alt);
      CityMap?.setRoute?.(osrm);
    } else {
      const routeData = RoutingEngine?.computeRoute?.(from.lat, from.lng, to.lat, to.lng, this._userObstacles());
      points = routeData?.points || this._globePointsFromCoords([from, to], spec.alt);
    }

    if (points?.length >= 2) {
      const routeGeo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(
        routeGeo,
        new THREE.LineBasicMaterial({ color: 0xff66cc, transparent: true, opacity: 0.55 })
      );
      globePivot.add(line);
      setTimeout(() => { if (line.parent) line.parent.remove(line); }, 120000);
    }

    droneRec.meta = { ...droneRec.meta, rtb: true, fieldId: droneId, pilot: rtb.owner };
    this._animateAlongRoute(droneRec, { points: points || [droneRec.mesh.position] }, {
      maxSteps: osrm ? 80 : 58,
      speed: 0.02,
      onComplete: async () => {
        await this.api({ action: 'handoff', drone_id: droneId, lat: to.lat, lng: to.lng });
        MapDepict?.pulse?.(to.lat, to.lng, 0xff66cc, '🥽 RTB · ' + (rtb.owner || 'pilot'), 9000);
        AIGraphics?.spawnEffect?.(droneRec.mesh?.position, 0xff66cc, 20, 45);
        const handoff = '🥽 OSRM RTB — ' + (targetMeta.domain || 'fpv') + ' returned to pilot ' + (rtb.owner || '');
        window.MapComms?.postSystem?.(handoff);
        ACI?.feed?.('tilemaxos-rtb', rtb.owner + ' · ' + targetMeta.domain);
        this._logField('drone_rtb', handoff, { visual_truth: true });
        this.out(handoff, 'ok');
        setTimeout(() => {
          if (droneRec.mesh?.parent) droneRec.mesh.parent.remove(droneRec.mesh);
          droneRec.mesh = null;
        }, 2800);
      },
    });

    const msg = 'RTB OSRM — ' + (targetMeta.domain || 'drone') + ' → pilot ' + (rtb.owner || '') + ' · ' + to.lat.toFixed(4) + ', ' + to.lng.toFixed(4);
    console.log('%c[tilemaxos] ' + msg, 'color:#ff66cc');
    if (!opts.quiet) this.say(msg);
    return { ok: true, rtb };
  },

  async takeover(targetId, opts) {
    opts = opts || {};
    if (!Auth?.user) {
      this.say('Sign in — real drone registry requires Supabase auth');
      Auth?.signInGoogle?.();
      return { error: 'login_required' };
    }
    this._setEdition('tilemaxos');
    if (this._edition === 'teledromos') {
      this.say('ΤΗΛΕΔΡΟΜΟΣ commercial — use telemachos/tilemaxos for C2 seize');
      return { error: 'commercial_locked' };
    }

    await this.scanAllDrones({ quiet: true });
    const q = String(targetId || 'fpv').toLowerCase();
    const target = this._findDrone(q);
    if (!target) {
      this.say('No registered drones on field — rivals must deploy: telemachos deploy fpv 1');
      return { error: 'no_drones' };
    }
    if (target.ownerId === Auth.user.id) {
      this.say('Cannot seize your own drone — scan for rival units');
      return { error: 'own_drone' };
    }

    this._visualizeDrone(target);
    const r = await this.api({
      action: 'seize',
      drone_id: target.id,
      edition: this._edition,
    });

    if (!r.seized) {
      AIGraphics?.spawnEffect?.(target.mesh?.position, 0xff4400, 14, 30);
      this.say('Seize failed — link ' + (r.link_strength?.toFixed(2) || '?') + ' · score ' + (r.seize_score ?? '?') + '/' + (r.min_score ?? '?') + ' · evolve');
      this._applyEvolution(r.evolution);
      this._logField('drone_seize', 'failed ' + target.domain, { link: r.link_strength });
      return { ok: false, target, ...r };
    }

    this._applyEvolution(r.evolution);
    if (target.mesh) {
      target.mesh.traverse((c) => {
        if (c.material?.color) c.material.color.setHex(target.fpv ? 0xff66cc : 0x00ff88);
      });
      target.captured = true;
      AIGraphics?.spawnEffect?.(target.mesh.position, target.fpv ? 0xff66cc : 0x00ff88, 28, 50);
    }

    const rec = this._registerDrone(target.domain, {
      captured: true,
      fieldId: target.id,
      from: target.owner,
      fpv: target.fpv,
    });
    rec.mesh = target.mesh;
    this._captured.push({ ...target, capturedAt: Date.now(), fleetId: rec.id, dbId: target.id });
    this._logField('drone_seize', (target.fpv ? 'FPV ' : '') + target.domain + ' · ' + target.owner, { visual_truth: true });

    const msg = '✓ seized ' + (target.fpv ? 'FPV ' : '') + target.domain + ' · link ' + r.link_strength + ' · score ' + r.seize_score + ' · RTB…';
    window.MapComms?.postSystem?.('⚔️ ' + msg);
    ACI?.feed?.('tilemaxos-takeover', target.domain + ' from ' + target.owner);

    if (opts.flyBack !== false) {
      await this.flyBackToPilot(rec, target, { quiet: true });
      this.say(msg + ' OSRM flyback to ' + target.owner);
    } else {
      this.say(msg);
    }
    await this.scanAllDrones({ quiet: true });
    return { ok: true, target, drone: r.drone, ...r };
  },

  out(text, cls) {
    AciCli?.print(text, cls || 'ok');
    return text;
  },

  say(text) {
    ACIControl?.reply(text);
    this.out(text, 'ok');
    if (Voice?.maySpeak?.()) speak(String(text).slice(0, 220), () => resumeListening?.());
    return text;
  },

  introduce(editionId) {
    if (editionId) this._setEdition(editionId);
    const e = this.edition;
    const lines = [
      'Εγώ είμαι ' + e.name_gr + ' (' + e.name_latin + ') — ' + e.tier + ' edition.',
      e.tagline,
    ];
    if (e.tier === 'gaming' || e.id === 'tilemaxos') {
      lines.push('Εξέλιξη με real gamers: level ' + this._evolution.level + ' · power ' + this._evolution.power + ' · takeovers ' + this._evolution.takeovers);
      lines.push('🔵 BLUE TEAM (always us) — win by delivering pitogyro/burger/mpironi/tsigareta to ALL 🔴 red players.');
      lines.push('tilemaxos: scan · takeover fpv · deliver red <name> · teams');
    }
    if (e.tier === 'commercial') {
      lines.push('Marketplace: deliver · drivers · vendors — χωρίς hostile takeover.');
    }
    lines.push('editions · abilities · fleet · deploy · scan · takeover');
    const msg = lines.join(' ');
    console.log('%c[' + e.name_gr + '] ' + msg, 'color:#00ddff');
    return this.say(msg);
  },

  editionsText() {
    return [
      '── Pilot editions ──',
      '🎮 ΤΗΛΕΜΑΧΟΣ — gaming · evolves with real users · most powerful model',
      '🏢 ΤΗΛΕΔΡΟΜΟΣ — commercial · marketplace delivery & drivers',
      '⚔️ tilemaxos — ANY drone takeover (FPV priority) · fly back to pilot',
      'Active: ' + this.edition.name_gr + ' (' + this.edition.tier + ')',
    ].join('\n');
  },

  abilitiesText() {
    const e = this.edition;
    const lines = [
      '── ' + e.name_gr + ' · δυνατότητες ──',
      '• Unlimited fleet — FPV 🥽 / air / ground / sea / underwater',
      '• Marketplace delivery (ΤΗΛΕΔΡΟΜΟΣ) — vendor → you · MapComms · drivers',
      '• Gaming evolution (ΤΗΛΕΜΑΧΟΣ) — XP from real users on globe · level ' + this._evolution.level,
      '• Blue vs Red — you are always 🔵 BLUE · rivals are 🔴 RED · feed all reds to win',
    ];
    if (e.takeover || e.id === 'tilemaxos') {
      lines.push('• Real C2 — pilot_drones DB · pilot-command edge · OSRM RTB · webrtc_signals handoff');
      lines.push('• Seize score = power − link_strength (haversine RF range) — no random rolls');
      this.EXTREME_TECH.forEach((t) => lines.push('  ⚡ ' + t.label + ' — ' + t.desc));
    }
    lines.push('• CLI: scan · takeover fpv · takeover any · flyback · rtb · evolve');
    return lines.join('\n');
  },

  evolveText() {
    this._syncGamerTelemetry();
    return [
      '── Evolution · ΤΗΛΕΜΑΧΟΣ gaming model ──',
      'Level: ' + this._evolution.level + ' · Power: ' + this._evolution.power,
      'XP: ' + this._evolution.xp + ' · Takeovers: ' + this._evolution.takeovers,
      'FPV captures: ' + (this._evolution.fpv_captures || 0) + ' · Flybacks to pilot: ' + (this._evolution.flybacks || 0),
      'Deliveries: ' + this._evolution.deliveries + ' · Live gamers seen: ' + this._evolution.gamers_seen,
      'Stronger with every real user on the map — no simulated grind.',
    ].join('\n');
  },

  scanText() {
    const list = this._fieldDrones;
    if (!list.length) {
      return 'No registered drones in Supabase — deploy yours: telemachos deploy fpv 1 · rivals too.';
    }
    const fpv = list.filter((d) => d.fpv);
    return [
      '── Field drones (ANY — tilemaxos can seize all) ──',
      'FPV units: ' + fpv.length + ' · total: ' + list.length,
      ...list.map((h, i) => {
        const tag = h.fpv ? '🥽 FPV' : h.domain;
        const team = h.team === 'friendly' ? '· ally' : '· ' + h.team;
        return (i + 1) + '. ' + h.id + ' · ' + tag + ' · ' + h.owner + team + ' · sig ' + h.signal.toFixed(2);
      }),
      'takeover fpv · takeover any · takeover <id> · flyback',
    ].join('\n');
  },

  fleetStatusText() {
    const lines = ['── Fleet · ' + this.NAME_GR + ' ──'];
    let total = 0;
    Object.entries(this.DOMAINS).forEach(([k, d]) => {
      const n = this._fleet[k].length;
      total += n;
      const cap = this._fleet[k].filter((x) => x.meta?.captured).length;
      const active = this._fleet[k].filter((x) => x.busy).length;
      lines.push(d.emoji + ' ' + d.label + ': ' + n + (cap ? ' (' + cap + ' captured)' : '') + (active ? ' · ' + active + ' busy' : ''));
    });
    lines.push('Field: ' + this._fieldDrones.length + ' · FPV: ' + this._fieldDrones.filter((d) => d.fpv).length + ' · Captured: ' + this._captured.length);
    lines.push('Edition: ' + this.edition.name_gr + ' · missions: ' + this._activeMissions.length);
    if (MarketplaceComms?.state?.orderId) {
      lines.push('📦 Order: ' + String(MarketplaceComms.state.orderId).slice(0, 8));
    }
    return lines.join('\n');
  },

  _registerDrone(domain, meta) {
    const id = 'tlm-' + (this._nextId++);
    const rec = { id, domain, busy: false, mesh: null, meta: meta || {} };
    this._fleet[domain].push(rec);
    return rec;
  },

  showPilot(lat, lng, editionId) {
    if (editionId) this._setEdition(editionId);
    const e = this.edition;
    if (AIGraphics?.spawnAstranovFlyer) {
      if (window._pilot?.parent) window._pilot.parent.remove(window._pilot);
      const col = e.id === 'tilemaxos' ? 0xff3366 : (e.color || 0x00ccff);
      window._pilot = AIGraphics.spawnAstranovFlyer(lat ?? this.HOME.lat, lng ?? this.HOME.lng, {
        edition: e, label: e.name_gr, color: col,
      });
      MapDepict?.pulse?.(lat ?? this.HOME.lat, lng ?? this.HOME.lng, col, e.name_gr, 12000);
      return window._pilot;
    }
    if (window._pilot && window._pilot.parent) window._pilot.parent.remove(window._pilot);

    const pos = latLngToPos(lat ?? this.HOME.lat, lng ?? this.HOME.lng, 1.04);
    const pilotGroup = new THREE.Group();
    const bodyColor = e.color || 0x00ccff;

    const body = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 10, 10),
      new THREE.MeshBasicMaterial({ color: bodyColor, transparent: true, opacity: 0.95 })
    );
    pilotGroup.add(body);

    const cockpit = new THREE.Mesh(
      new THREE.ConeGeometry(0.014, 0.032, 4),
      new THREE.MeshBasicMaterial({ color: e.id === 'tilemaxos' ? 0xff3366 : 0x00ff99 })
    );
    cockpit.rotation.x = Math.PI / 2;
    cockpit.position.z = 0.02;
    pilotGroup.add(cockpit);

    const wing = new THREE.Mesh(
      new THREE.BoxGeometry(0.05, 0.005, 0.01),
      new THREE.MeshBasicMaterial({ color: 0x0088ff })
    );
    wing.position.z = 0.005;
    pilotGroup.add(wing);

    const core = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })
    );
    pilotGroup.add(core);

    const thruster1 = new THREE.Mesh(
      new THREE.ConeGeometry(0.006, 0.018, 4),
      new THREE.MeshBasicMaterial({ color: 0xff4400, transparent: true, opacity: 0.7 })
    );
    thruster1.rotation.x = Math.PI / 2;
    thruster1.position.set(0.015, 0, -0.02);
    pilotGroup.add(thruster1);
    const thruster2 = thruster1.clone();
    thruster2.position.set(-0.015, 0, -0.02);
    pilotGroup.add(thruster2);

    pilotGroup.userData = { type: 'pilot', name: e.name_gr, edition: e.id, thrusters: [thruster1, thruster2] };
    pilotGroup.position.set(pos.x, pos.y, pos.z);
    globePivot.add(pilotGroup);
    window._pilot = pilotGroup;

    AIGraphics?.spawnEffect?.(pilotGroup.position, e.id === 'tilemaxos' ? 0xff3366 : 0x00ff99, 18, 55);
    MapDepict?.pulse?.(lat ?? this.HOME.lat, lng ?? this.HOME.lng, bodyColor, e.name_gr, 12000);
    return pilotGroup;
  },

  _meshForDomain(domain, overrideColor) {
    const spec = this.DOMAINS[domain] || this.DOMAINS.air;
    const col = overrideColor ?? spec.color;
    const g = new THREE.Group();
    g.userData = { domain, spec };

    if (domain === 'fpv') {
      const frame = new THREE.Mesh(
        new THREE.BoxGeometry(0.016, 0.004, 0.012),
        new THREE.MeshBasicMaterial({ color: col })
      );
      g.add(frame);
      const cam = new THREE.Mesh(
        new THREE.SphereGeometry(0.005, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      cam.position.set(0, 0, 0.008);
      g.add(cam);
      const lens = new THREE.Mesh(
        new THREE.CylinderGeometry(0.003, 0.004, 0.004, 6),
        new THREE.MeshBasicMaterial({ color: 0x111111 })
      );
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0, 0.012);
      g.add(lens);
      const armA = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.002, 0.002),
        new THREE.MeshBasicMaterial({ color: col })
      );
      g.add(armA);
      const armB = armA.clone();
      armB.rotation.z = Math.PI / 2;
      g.add(armB);
      const vtx = new THREE.Mesh(
        new THREE.ConeGeometry(0.003, 0.008, 3),
        new THREE.MeshBasicMaterial({ color: 0xff3366, transparent: true, opacity: 0.8 })
      );
      vtx.rotation.x = -Math.PI / 2;
      vtx.position.y = 0.006;
      g.add(vtx);
    } else if (domain === 'air') {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(0.008, 0.008, 0.02, 6),
        new THREE.MeshBasicMaterial({ color: col })
      );
      body.rotation.x = Math.PI / 2;
      g.add(body);
      const hub = new THREE.Mesh(
        new THREE.SphereGeometry(0.006, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x00ff88 })
      );
      hub.position.y = 0.01;
      g.add(hub);
      const arm1 = new THREE.Mesh(
        new THREE.BoxGeometry(0.03, 0.003, 0.003),
        new THREE.MeshBasicMaterial({ color: 0x0088ff })
      );
      g.add(arm1);
      const arm2 = arm1.clone();
      arm2.rotation.z = Math.PI / 2;
      g.add(arm2);
    } else if (domain === 'ground') {
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(0.022, 0.008, 0.014),
        new THREE.MeshBasicMaterial({ color: col })
      );
      g.add(base);
      const wheel = new THREE.Mesh(
        new THREE.SphereGeometry(0.004, 6, 6),
        new THREE.MeshBasicMaterial({ color: 0x333333 })
      );
      wheel.position.set(0.008, -0.006, 0);
      g.add(wheel);
      const wheel2 = wheel.clone();
      wheel2.position.x = -0.008;
      g.add(wheel2);
    } else if (domain === 'sea') {
      const hull = new THREE.Mesh(
        new THREE.BoxGeometry(0.028, 0.006, 0.012),
        new THREE.MeshBasicMaterial({ color: col })
      );
      g.add(hull);
      const mast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.002, 0.002, 0.018, 4),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      mast.position.y = 0.012;
      g.add(mast);
    } else {
      const sub = new THREE.Mesh(
        new THREE.SphereGeometry(0.012, 8, 8),
        new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.85 })
      );
      g.add(sub);
      const fin = new THREE.Mesh(
        new THREE.BoxGeometry(0.004, 0.012, 0.002),
        new THREE.MeshBasicMaterial({ color: 0x00aaff })
      );
      fin.position.y = 0.01;
      g.add(fin);
    }
    return g;
  },

  _userObstacles() {
    const out = [];
    (others || []).forEach((o) => {
      if (o.lat != null) out.push(latLngToPos(o.lat, o.lng, 1.025));
    });
    if (window._meMarker) out.push(window._meMarker.position);
    (Commerce?.driverMarkers || []).forEach((m) => { if (m?.position) out.push(m.position); });
    return out;
  },

  _animateAlongRoute(droneRec, routeData, opts) {
    if (!droneRec?.mesh || !routeData?.points?.length) return;
    const mesh = droneRec.mesh;
    const spec = this.DOMAINS[droneRec.domain] || this.DOMAINS.air;
    let steps = 0;
    let routeIdx = 0;
    const maxSteps = opts?.maxSteps || 48;
    const userPos = this._userObstacles();
    droneRec.busy = true;

    const tick = () => {
      steps++;
      if (routeIdx < routeData.points.length - 1) {
        const target = routeData.points[routeIdx + 1];
        mesh.position.lerp(target, 0.11 + (opts?.speed || 0));
        if (mesh.position.distanceTo(target) < 0.008) routeIdx++;
      }
      if (window._pilot && opts?.pilotFollow) {
        const final = routeData.points[routeData.points.length - 1];
        window._pilot.position.lerp(final, 0.18);
      }
      if (steps % 4 === 0) AIGraphics?.spawnEffect?.(mesh.position, spec.color, 6, 20);
      userPos.forEach((up) => {
        if (mesh.position.distanceTo(up) < 0.09) {
          console.log('%c[' + this.NAME_GR + '] proximity guard active', 'color:#ff8800');
        }
      });
      if (steps > maxSteps || routeIdx >= routeData.points.length - 1) {
        droneRec.busy = false;
        if (opts?.onComplete) {
          opts.onComplete(droneRec);
        } else if (!droneRec.meta?.captured && mesh.parent) {
          mesh.parent.remove(mesh);
          droneRec.mesh = null;
        }
        return;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  },

  async deploy(domain, count, opts) {
    opts = opts || {};
    if (!Auth?.user) {
      this.say('Sign in to register real drones in pilot_drones table');
      Auth?.signInGoogle?.();
      return { error: 'login_required' };
    }
    const d = String(domain || 'air').toLowerCase();
    if (!this.DOMAINS[d]) {
      this.say('Domain: fpv · air · ground · sea · underwater');
      return { error: 'bad_domain' };
    }
    const n = Math.max(1, Math.min(20, parseInt(count, 10) || 1));
    const u = Commerce?.userLatLng?.() || window._lastPos || this.HOME;
    const pilotLat = u.lat;
    const pilotLng = u.lng;
    const startLat = opts.startLat ?? pilotLat;
    const startLng = opts.startLng ?? pilotLng;
    const endLat = opts.endLat ?? startLat;
    const endLng = opts.endLng ?? startLng;
    const spec = this.DOMAINS[d];

    const deployed = [];
    for (let i = 0; i < n; i++) {
      const lat = startLat + (i - (n - 1) / 2) * 0.0008;
      const lng = startLng + (i - (n - 1) / 2) * 0.0006;
      const reg = await this.api({
        action: 'register',
        domain: d,
        lat, lng,
        pilot_lat: pilotLat,
        pilot_lng: pilotLng,
        link_mhz: d === 'fpv' ? 5800 : null,
        metadata: opts.meta || {},
      });
      if (!reg.ok) {
        this.out('Register failed: ' + (reg.error || 'server'), 'err');
        break;
      }
      const rec = this._registerDrone(d, { dbId: reg.drone?.id, registered: true });
      const mesh = this._meshForDomain(d);
      const pos = latLngToPos(lat, lng, spec.alt);
      mesh.position.set(pos.x, pos.y, pos.z);
      globePivot.add(mesh);
      rec.mesh = mesh;
      deployed.push(rec);
      this._logField('drone_register', d + ' · ' + reg.drone.id.slice(0, 8), { visual_truth: true });
    }

    const osrm = await this._fetchOsrmRoute(startLat, startLng, endLat, endLng);
    const points = osrm?.length >= 2
      ? this._globePointsFromCoords(osrm, spec.alt)
      : (RoutingEngine?.computeRoute?.(startLat, startLng, endLat, endLng, this._userObstacles())?.points || []);
    if (deployed[0] && points.length) {
      this._animateAlongRoute(deployed[0], { points }, { pilotFollow: true });
    }

    await this.scanAllDrones({ quiet: true });
    const msg = spec.emoji + ' ' + deployed.length + ' ' + spec.label + ' registered in pilot_drones · GPS ' + pilotLat.toFixed(4);
    this.out(msg, 'ok');
    return { ok: true, domain: d, count: deployed.length, deployed };
  },

  async coordinateMarketplaceDelivery(opts) {
    this._setEdition('teledromos');
    opts = opts || {};
    if (!Auth?.user) {
      this.say('Sign in — ΤΗΛΕΔΡΟΜΟΣ registers real drones in pilot_drones');
      Auth?.signInGoogle?.();
      return { error: 'login_required' };
    }
    const vendor = opts.vendor || Commerce?.selected || Commerce?.vendors?.[0];
    const u = {
      lat: opts.deliveryLat ?? Commerce?.userLatLng?.()?.lat ?? window._lastPos?.lat ?? this.HOME.lat,
      lng: opts.deliveryLng ?? Commerce?.userLatLng?.()?.lng ?? window._lastPos?.lng ?? this.HOME.lng,
    };
    const vLat = vendor?.lat ?? u.lat;
    const vLng = vendor?.lng ?? u.lng;
    const wants = opts.wants || opts.items?.map((i) => i.name).join(', ') || 'delivery';
    const driver = opts.driver || Commerce?._preferredDriver;
    const orderId = opts.order?.id || opts.orderId || MarketplaceComms?.state?.orderId || null;

    this.showPilot(u.lat, u.lng, 'teledromos');
    if (typeof flyToPoint === 'function') {
      const p = latLngToPos(u.lat, u.lng, 1.04);
      flyToPoint(new THREE.Vector3(p.x, p.y, p.z), GlobeControl?.Z?.national || 1.82);
      GlobeControl?.noteAutoFly?.();
    }

    const mission = {
      id: orderId || ('msn-' + Date.now()),
      edition: 'teledromos',
      vendor: vendor?.name,
      wants,
      driver: driver?.display_name || driver?.name || null,
      seekingDriver: !!opts.seekingDriver,
      orderId,
    };
    this._activeMissions.push(mission);

    const osrm = await this._fetchOsrmRoute(vLat, vLng, u.lat, u.lng);
    const routeCoords = osrm?.length >= 2 ? osrm : null;
    if (routeCoords) {
      CityMap?.setRoute?.(routeCoords);
      const points = this._globePointsFromCoords(routeCoords, this.DOMAINS.air.alt);
      const routeGeo = new THREE.BufferGeometry().setFromPoints(points);
      const routeLine = new THREE.Line(
        routeGeo,
        new THREE.LineBasicMaterial({ color: 0x3d9eff, transparent: true, opacity: 0.35 })
      );
      globePivot.add(routeLine);
      setTimeout(() => { if (routeLine.parent) routeLine.parent.remove(routeLine); }, 120000);
    } else {
      const routeData = RoutingEngine?.computeRoute?.(vLat, vLng, u.lat, u.lng, this._userObstacles());
      if (routeData?.points?.length) {
        const routeGeo = new THREE.BufferGeometry().setFromPoints(routeData.points);
        const routeLine = new THREE.Line(
          routeGeo,
          new THREE.LineBasicMaterial({ color: 0x3d9eff, transparent: true, opacity: 0.35 })
        );
        globePivot.add(routeLine);
        setTimeout(() => { if (routeLine.parent) routeLine.parent.remove(routeLine); }, 120000);
      }
    }

    const plan = opts.seekingDriver ? ['air', 'ground'] : ['air', 'ground'];
    const meta = {
      mission: mission.id,
      escort: !!driver,
      commercial: true,
      order_id: orderId,
      vendor: vendor?.name,
    };
    for (let i = 0; i < plan.length; i++) {
      await this.deploy(plan[i], 1, {
        startLat: vLat,
        startLng: vLng,
        endLat: u.lat,
        endLng: u.lng,
        meta,
      });
      if (i < plan.length - 1) await new Promise((r) => setTimeout(r, 350));
    }

    const driverTxt = driver
      ? 'Escorting ' + (driver.display_name || driver.name)
      : (opts.seekingDriver ? 'Seeking driver + drone relay' : 'Direct relay');
    const sys = '🏢 ΤΗΛΕΔΡΟΜΟΣ · ' + driverTxt + ' · ' + wants.slice(0, 80);
    window.MapComms?.postSystem?.(sys);
    ACI?.feed?.('teledromos-delivery', wants);
    this._logField('pilot', 'teledromos delivery · ' + wants.slice(0, 60), { order_id: orderId });
    this._gainXp(40, 'delivery');

    const msg = 'ΤΗΛΕΔΡΟΜΟΣ · OSRM route · ' + wants + '. ' + driverTxt + '.';
    console.log('%c[ΤΗΛΕΔΡΟΜΟΣ] ' + msg, 'color:#3d9eff');
    ACIControl?.reply(msg.slice(0, 200));
    return { ok: true, mission };
  },

  async runDemoDelivery() {
    const vendor = Commerce?.selected || Commerce?.vendors?.[0];
    const u = Commerce?.userLatLng?.() || window._lastPos || this.HOME;
    if (!vendor?.lat) {
      this.say('Open marketplace & pick a vendor — real GPS delivery, no demo coords');
      return { error: 'no_vendor' };
    }
    this._setEdition('telemachos');
    this.showPilot(u.lat, u.lng, 'telemachos');
    const wants = Commerce?._lastWants?.map((w) => w.label).join(' + ') || 'group order';
    ACI?.feed?.('group-order', wants);
    await this.coordinateMarketplaceDelivery({
      vendor,
      deliveryLat: u.lat,
      deliveryLng: u.lng,
      wants,
      driver: Commerce?._preferredDriver,
    });
    this._gainXp(25, 'delivery');
    this.say('ΤΗΛΕΜΑΧΟΣ gaming relay — real vendor GPS · evolve με gamers στο χάρτη.');
    return { ok: true };
  },

  _resolveCmd(line, p) {
    let cmd = (p[0] || '').toLowerCase().replace(/^"|"$/g, '');
    if (cmd === 'drone' || cmd === 'drones' || cmd === 'pilot') cmd = 'telemachos';
    if (['tilemaxos', 'tilemachos', 'telemachus'].includes(cmd)) cmd = 'telemachos';
    if (['teledromus'].includes(cmd)) cmd = 'teledromos';

    if (!['telemachos', 'teledromos', 'fleet'].includes(cmd)) {
      if (this.mentionsTeledromos(line)) return { cmd: 'teledromos', sub: p[1], p };
      if (this.mentionsTilemaxos(line)) return { cmd: 'telemachos', sub: 'tilemaxos', p };
      if (this.mentionsTelemachos(line)) return { cmd: 'telemachos', sub: p[1], p };
      if (/takeover|ανάληψη|αναληψη/.test(this.foldedGreek(line))) return { cmd: 'telemachos', sub: 'takeover', p, raw: line };
      if (/flyback|fly back|rtb|return to pilot|επιστροφη|γυρισμα/.test(this.foldedGreek(line))) return { cmd: 'telemachos', sub: 'flyback', p };
      if (/deliver red|attack red|blue team|red team|teams|μπλε|κοκκιν/.test(this.foldedGreek(line))) {
        if (/deliver red/.test(this.foldedGreek(line))) return { cmd: 'telemachos', sub: 'deliver', p: ['telemachos', 'deliver', 'red', ...p.slice(1)], raw: line };
        return { cmd: 'telemachos', sub: 'teams', p };
      }
      if (/scan|hostile|αντιπαλ|fpv/.test(this.foldedGreek(line))) return { cmd: 'telemachos', sub: 'scan', p };
    }
    return { cmd, sub: (p[1] || '').toLowerCase(), p };
  },

  async cli(parts, raw) {
    const line = String(raw || parts?.join(' ') || '').trim();
    const p = parts?.length ? parts : (line.match(/(?:[^\s"]+|"[^"]*")+/g) || []);
    const { cmd, sub, p: pp } = this._resolveCmd(line, p);
    const arg2 = (pp[2] || '').toLowerCase();
    const rest = pp.slice(1).join(' ');

    if (cmd === 'teledromos') {
      this._setEdition('teledromos');
      if (!sub || this.wantsIntro(sub + ' ' + rest)) { this.introduce('teledromos'); }
      else if (sub === 'deliver') {
        const vendor = Commerce?.selected || Commerce?.vendors?.[0];
        const u = Commerce?.userLatLng?.() || {};
        await this.coordinateMarketplaceDelivery({ vendor, deliveryLat: u.lat, deliveryLng: u.lng, wants: Commerce?._lastWants?.map((w) => w.label).join(' + ') || 'order' });
      } else if (sub === 'abilities') this.out(this.abilitiesText(), 'ok');
      else this.introduce('teledromos');
      GlobeDeck?.finishCliIfOneShot('teledromos');
      return { ok: true };
    }

    if (cmd === 'fleet' && !sub) {
      this.out(this.fleetStatusText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('fleet');
      return { ok: true };
    }

    this._setEdition(sub === 'tilemaxos' || this.mentionsTilemaxos(line) ? 'tilemaxos' : 'telemachos');

    if (!sub || sub === 'hi' || sub === 'hello' || sub === 'γεια' || (this.wantsIntro(line) && !arg2)) {
      this.introduce(this._edition);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'tilemaxos' || sub === 'extreme') {
      this._setEdition('tilemaxos');
      this.showPilot((Commerce?.userLatLng?.() || this.HOME).lat, (Commerce?.userLatLng?.() || this.HOME).lng, 'tilemaxos');
      this.out([
        '⚔️ tilemaxos — extreme tech on ΤΗΛΕΜΑΧΟΣ',
        'ANY drone · FPV priority · RTB to pilot after capture',
        ...this.EXTREME_TECH.map((t) => '  ' + t.label),
        'scan · takeover fpv · flyback',
      ].join('\n'), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'editions' || sub === 'edition') {
      this.out(this.editionsText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'teledromos' || sub === 'commercial') {
      this.introduce('teledromos');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'abilities' || sub === 'skills' || sub === 'help') {
      this.out(this.abilitiesText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'evolve' || sub === 'power' || sub === 'level') {
      await this._loadEvolutionFromServer();
      this.out(this.evolveText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'fleet' || sub === 'status') {
      this.out(this.fleetStatusText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'teams' || sub === 'team' || sub === 'red' || sub === 'blue' || sub === 'attack' || sub === 'war') {
      await this.refreshTeamStatus();
      this.out(this.teamsText(), 'ok');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'scan' || sub === 'hostiles' || sub === 'opponents' || sub === 'drones') {
      this._setEdition('tilemaxos');
      await this.scanAllDrones();
      this.out(this.scanText(), 'ok');
      this._fieldDrones.forEach((h) => this._visualizeDrone(h));
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'takeover' || sub === 'capture' || sub === 'hijack' || sub === 'seize') {
      this._setEdition('tilemaxos');
      const target = pp.slice(2).join(' ') || arg2 || 'fpv';
      await this.takeover(target);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'flyback' || sub === 'rtb' || sub === 'return' || sub === 'home') {
      this._setEdition('tilemaxos');
      const q = pp.slice(2).join(' ') || arg2;
      const cap = this._captured[this._captured.length - 1];
      const rec = cap?.fleetId
        ? Object.values(this._fleet).flat().find((r) => r.id === cap.fleetId)
        : null;
      if (rec && cap) {
        await this.flyBackToPilot(rec, cap);
      } else if (q) {
        await this.scanAllDrones({ quiet: true });
        const t = this._findDrone(q);
        if (t) await this.takeover(t.id, { flyBack: true });
        else this.say('No match — scan then takeover fpv first.');
      } else {
        this.say('No captured drone — takeover fpv first, or flyback <id>.');
      }
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'show' || sub === 'locate') {
      const u = Commerce?.userLatLng?.() || this.HOME;
      this.showPilot(u.lat, u.lng, this._edition);
      this.say(this.NAME_GR + ' on globe · L' + this._evolution.level);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'deploy' || sub === 'launch') {
      await this.deploy(arg2 || 'fpv', parseInt(pp[3], 10) || 1);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'deliver' && arg2 === 'red') {
      const nameParts = [];
      const itemParts = [];
      pp.slice(3).forEach((x) => {
        if (/pitogy|burger|beer|mpir|μπυρ|τσιγαρ|pita|gyro|mpironi/i.test(x)) itemParts.push(x);
        else nameParts.push(x);
      });
      await this.deliverToRed(nameParts.join(' ') || 'all', itemParts.join(' ') || 'pitogyra');
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'deliver' || sub === 'coordinate') {
      if (arg2 === 'commercial') await this.coordinateMarketplaceDelivery({});
      else {
        this._setEdition('telemachos');
        const vendor = Commerce?.selected || Commerce?.vendors?.[0];
        const u = Commerce?.userLatLng?.() || {};
        this.showPilot(u.lat, u.lng, 'telemachos');
        await this.deploy('air', 2, { startLat: vendor?.lat, startLng: vendor?.lng, endLat: u.lat, endLng: u.lng });
        this._gainXp(30, 'delivery');
        this.say('ΤΗΛΕΜΑΧΟΣ gaming relay active.');
      }
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (sub === 'demo' || sub === 'grouporder') {
      await this.runDemoDelivery();
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }
    if (this.mentionsTelemachos(line) || this.mentionsTilemaxos(line)) {
      this.introduce(this._edition);
      GlobeDeck?.finishCliIfOneShot('telemachos');
      return { ok: true };
    }

    this.out('usage: teams · deliver red <name> pitogyra · scan · takeover fpv · flyback', 'dim');
    GlobeDeck?.finishCliIfOneShot('telemachos');
    return { ok: true };
  },
};

window.TelemachosPilot = Pilot;
window.showPilotTelemachos = function () { return Pilot.showPilot(); };
})();

// WebRTC Video Calling + Orbital global compatibility
// Real browser tech to reduce wireless pollution via orbital mesh
let orbitalCallActive = false;
let localStream = null;
let pc = null;
let videoUI = null;

function requestOrbitalTech() {
  const request = {
    from: "Astranov",
    to: "Advanced Orbital Technology Providers",
    request: "Integrate advanced orbital-based global connectivity with WebRTC for real-time video calling on mobile phones and browsers worldwide.",
    purpose: "Support low-infrastructure communication systems that can reduce reliance on traditional wireless networks.",
    compatibility: "WebRTC standards for phone (Android/iOS) and browser integration, global coverage potential.",
    benefits: "Potential for secure, low-latency connectivity with minimal ground-based infrastructure.",
    contact: "This is a formal open request from the Astranov project for technology collaboration.",
    timestamp: new Date().toISOString()
  };

  console.log('%c[Orbital Tech Request] Formal technology request prepared:', 'color:#ffaa00');
  console.log(request);

  // Copy the formal request to clipboard for user to submit to providers
  const requestText = JSON.stringify(request, null, 2);
  navigator.clipboard.writeText(requestText).then(() => {
    console.log('Request copied to clipboard. Paste and submit to appropriate providers.');
  }).catch(() => {
    console.log('Request text (copy manually):\n' + requestText);
  });

  // Speak the request - direct, no roleplay
  MapDepict?.action('think', { detail: 'orbital tech request' });
  if (Voice.maySpeak()) speak('Request copied.', () => resumeListening());

  // Visual on globe: signal
  AIGraphics.spawnEffect( new THREE.Vector3(0, 1.5, 0), 0xffaa00, 20, 60 );
}

async function startOrbitalVideoCall(targetName = 'Αξαδίνα') {
  if (orbitalCallActive) {
    if (Voice.maySpeak()) speak('Call active.');
    return;
  }

  orbitalCallActive = true;

  // 1. Request location ONLY if not set (per previous rules)
  if (!userLocated) {
    await new Promise(resolve => {
      requestLocationIfNeeded(() => resolve());
    });
  }

  // 2. Request Orbital tech from Orbital Provider first (advance the request)
  requestOrbitalTech();

  // 3. Real WebRTC - get media (permission on demand)
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ 
      video: { facingMode: 'user' }, 
      audio: true 
    });

    // Create minimal non-window UI for call (holographic on globe concept)
    videoUI = document.createElement('div');
    videoUI.style.position = 'absolute';
    videoUI.style.bottom = '10px';
    videoUI.style.left = '50%';
    videoUI.style.transform = 'translateX(-50%)';
    videoUI.style.background = 'rgba(0, 10, 20, 0.85)';
    videoUI.style.border = '2px solid #00aaff';
    videoUI.style.padding = '8px';
    videoUI.style.borderRadius = '8px';
    videoUI.style.zIndex = '300';
    videoUI.style.color = '#00ddff';
    videoUI.style.fontFamily = 'system-ui';
    videoUI.innerHTML = `<div>ORBITAL VIDEO CALL - ${targetName}<br>Global Mesh • Reduced Impact</div>`;

    const localV = document.createElement('video');
    localV.srcObject = localStream;
    localV.autoplay = true;
    localV.muted = true;
    localV.style.width = '160px';
    localV.style.marginRight = '8px';
    localV.style.border = '1px solid #333';
    videoUI.appendChild(localV);

    const remoteV = document.createElement('video');
    remoteV.autoplay = true;
    remoteV.style.width = '160px';
    remoteV.style.border = '1px solid #333';
    videoUI.appendChild(remoteV);

    const endBtn = document.createElement('button');
    endBtn.textContent = 'END ORBITAL CALL';
    endBtn.style.marginTop = '4px';
    endBtn.style.width = '100%';
    endBtn.onclick = endRealOrbitalCall;
    videoUI.appendChild(endBtn);

    document.body.appendChild(videoUI);

    // 4. Real WebRTC PeerConnection - advanced as far as allowed in browser
    // Using public STUN for real ICE connectivity. For full P2P, copy offer to remote party (e.g. another tab or phone via Orbital).
    pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    pc.ontrack = (event) => {
      remoteV.srcObject = event.streams[0];
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('%c[WebRTC] ICE candidate (for real P2P):', 'color:#00ddff', JSON.stringify(event.candidate));
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log('%c[WebRTC] ICE state: ' + pc.iceConnectionState, 'color:#00ff88');
      if (pc.iceConnectionState === 'connected') {
        if (Voice.maySpeak()) speak('Video connected.');
      }
    };

    // Create real offer
    const offer = await pc.createOffer({ offerToReceiveVideo: true, offerToReceiveAudio: true });
    await pc.setLocalDescription(offer);

    // Show the offer for manual exchange (advances to real P2P)
    const offerStr = JSON.stringify(offer);
    console.log('%c[WebRTC] OFFER (copy this to remote party for real orbital P2P):', 'color:#00ddff');
    console.log(offerStr);
    navigator.clipboard.writeText(offerStr).then(() => {
      console.log('Offer copied to clipboard. Paste into remote (phone or another browser on orbital mesh).');
    });

    // For demo in this file: if you paste an answer in console or modify, it works.
    // In practice, exchange with phone via orbital internet for true global P2P.
    // To complete demo here, we can wait for manual answer paste, but for now show self video and note.
    // To make it work immediately in one file for testing, set a simple answer if needed, but this is the real API.

    // 5. Orbital globe visualization using real positions
    const myPos = window._meMarker ? window._meMarker.position : new THREE.Vector3();
    const targetPos = latLngToPos(36.2, 28.1, 1.04);
    showOrbitalSignal(myPos, targetPos);

    console.log('%c[Orbital] Real WebRTC video call active. Request for orbital tech prepared.', 'color:#00ff00');

    // Pollution reduction
    reduceWirelessPollution();

  } catch (err) {
    console.error('Orbital WebRTC error:', err);
    if (Voice.maySpeak()) speak('Camera needed for video.');
    endRealOrbitalCall();
  }
}

function showOrbitalSignal(from, to) {
  // Real visualization using orbital sats + globe math (no simulation)
  if (!orbitalSats || orbitalSats.length === 0) return;

  const sat = orbitalSats[0];
  // Draw real path lines on globe
  const points1 = [from, sat.position.clone().multiplyScalar(0.9)];
  const line1 = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points1),
    new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 })
  );
  scene.add(line1);

  const points2 = [sat.position.clone().multiplyScalar(0.9), to];
  const line2 = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points2),
    new THREE.LineBasicMaterial({ color: 0x00ff88, linewidth: 2 })
  );
  scene.add(line2);

  setTimeout(() => {
    if (line1.parent) line1.parent.remove(line1);
    if (line2.parent) line2.parent.remove(line2);
  }, 8000);
}

// simulateOrbitalSignal removed - use real showOrbitalSignal only

function reduceWirelessPollution() {
  console.log('%c[Planet Save] Wireless pollution reduced! Orbital + WebRTC is the future.', 'color:#00ff00');
  if (earth && earth.material) {
    const orig = earth.material.color.getHex();
    earth.material.color.setHex(0x00ffaa);
    setTimeout(() => {
      if (earth.material) earth.material.color.setHex(orig);
    }, 4000);
  }
}


function endRealOrbitalCall() {
  orbitalCallActive = false;
  if (pc) {
    pc.close();
    pc = null;
  }
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }
  if (videoUI) {
    videoUI.remove();
    videoUI = null;
  }
  console.log('%c[Orbital] Call ended.', 'color:#ffaa00');
  if (Voice.maySpeak()) speak('Call ended.');
}

// Update animate to include sats
// (added in existing AIGraphics update if extended, or here)
function updateOrbital() {
  updateOrbitalSats();
}
window.updateOrbital = updateOrbital;

// === ASTRANOV SESSION — one user, one cloud session, no local copies ===
const COLLECTIVE_SESSION_NAME = 'ASTRANOV COLLECTIVE INTELLIGENCE';
const COLLECTIVE_BATCH_SHORT_ID = 'ACI';

const AstranovSession = {
  CLOUD_ONLY: true,
  SESSION_NAME: COLLECTIVE_SESSION_NAME,
  BATCH_SHORT_ID: COLLECTIVE_BATCH_SHORT_ID,
  _deviceId: null,
  _syncTimer: null,
  _lastPull: 0,
  _lastRemote: null,

  init() {
    this._deviceId = this._deriveDeviceId();
    this._applyIdentity();
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange(() => this.onAuth());
    }
    setTimeout(() => this.onAuth(), 600);
    setTimeout(() => this.guardCollective(), 1800);
    this._syncTimer = setInterval(() => this.push(), 45000);
    this._guardTimer = setInterval(() => {
      if (Auth?.user && this.isAstranov()) this.guardCollective();
    }, 90000);
    window.addEventListener('beforeunload', () => this.push(true));
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && Auth?.user && this.isAstranov()) this.guardCollective();
    });
  },

  async guardCollective() {
    if (!Auth?.user || !this.isAstranov()) return;
    this.purgeAllLocalState();
    await this.unifyCollective();
  },

  _deriveDeviceId() {
    if (this._lastRemote?.deviceId) return this._lastRemote.deviceId;
    if (Auth?.user?.id) {
      const ua = (navigator.userAgent || 'web').slice(0, 20);
      let h = 0;
      for (let i = 0; i < ua.length; i++) h = ((h << 5) - h + ua.charCodeAt(i)) | 0;
      return 'dev-' + Auth.user.id.slice(0, 8) + '-' + Math.abs(h).toString(36).slice(0, 6);
    }
    return 'dev-guest-' + Math.random().toString(36).slice(2, 8);
  },

  deviceId() {
    return this._deviceId || this._deriveDeviceId();
  },

  isAstranov() {
    if (!Auth?.user) return false;
    const email = (Auth.user.email || '').toLowerCase();
    const owner = (Auth.OWNER_EMAIL || 'notisastranov@gmail.com').toLowerCase();
    return email === owner || !!Auth.isOwner || !!Auth.isArchitect;
  },

  sessionLabel() {
    return this.SESSION_NAME;
  },

  identity() {
    if (Auth?.user?.id) {
      const isAstranov = this.isAstranov();
      const name = isAstranov ? 'ASTRANOV' : (
        Auth.user.user_metadata?.full_name
        || Auth.user.user_metadata?.name
        || (Auth.user.email || '').split('@')[0]
        || 'User'
      );
      return {
        userId: Auth.user.id,
        name,
        deviceId: this.deviceId(),
        isGuest: false,
        isAstranov,
        isOwner: isAstranov,
        email: Auth.user.email,
        sessionName: this.SESSION_NAME,
        batchShortId: this.BATCH_SHORT_ID,
      };
    }
    return {
      userId: 'guest-' + this.deviceId(),
      name: 'Guest',
      deviceId: this.deviceId(),
      isGuest: true,
      sessionName: this.SESSION_NAME,
      batchShortId: this.BATCH_SHORT_ID,
    };
  },

  purgeAllLocalState() {
    try {
      const keep = ContextTruth?.AUTH_KEEP || new Set(['astranov_auth_v2']);
      const drop = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || keep.has(k)) continue;
        if (k.startsWith('astranov_')) drop.push(k);
        if (k.startsWith('aci-')) drop.push(k);
      }
      drop.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  },

  async unifyCollective() {
    if (Auth?.whenReady) await Auth.whenReady();
    if (!Auth?.user) return;
    this._applyIdentity();
    this.purgeAllLocalState();
    SessionHold?.clearForeignHold?.();
    if (AstranovNode?.api) {
      try {
        const r = await AstranovNode.api({ action: 'session_purge' });
        if (r.ok && r.closed > 0) {
          AciCli?.print?.('◎ Closed ' + r.closed + ' old session(s) — cloud collective only', 'dim');
        }
      } catch (_) {}
    }
    AstranovPresence?.refresh?.();
    await this.pull();
    await AstranovNode?.resumeSession?.();
    await this.push(true);
    GlobeDeck?.setTitle?.(this.SESSION_NAME);
    const chip = document.getElementById('user-chip');
    if (chip && this.isAstranov()) chip.textContent = 'ASTRANOV · OWNER';
  },

  getDeviceNodeId() {
    if (!Auth?.user?.id) return null;
    return 'node-' + Auth.user.id.slice(0, 8) + '-' + this.deviceId().slice(0, 10);
  },

  _applyIdentity() {
    const id = this.identity();
    if (typeof me !== 'undefined') {
      if (!me) window.me = me = {};
      me.id = id.userId;
      me.name = id.name;
      me.deviceId = id.deviceId;
      me.isGuest = id.isGuest;
      me.isAstranov = !!id.isAstranov;
      if (id.email) me.email = id.email;
      if (id.isAstranov) me.sessionName = this.SESSION_NAME;
    }
    window._astranovIdentity = id;
  },

  capture() {
    return {
      userId: Auth?.user?.id || null,
      deviceId: this.deviceId(),
      sessionName: this.SESSION_NAME,
      cloudOnly: true,
      updatedAt: Date.now(),
      lastPos: window._lastPos || null,
      batchId: AstranovNode?.batchId || null,
      shortId: this.BATCH_SHORT_ID,
      batchLabel: this.SESSION_NAME,
      nodeId: AstranovNode?.nodeId || this.getDeviceNodeId(),
      theme: AstranovTheme?.mode || 'dark',
      followMode: GlobeControl?.followMode || 'free',
      deckExpanded: !!GlobeDeck?.expanded,
      activeTask: GlobeDeck?.activeTask || null,
      context: SuperCli?._context || 'idle',
      handsFree: !!window._handsFreeVoice,
      wishlist: AstranovWishlist?.snapshot?.() || [],
      cliHistory: AciCli?.history?.slice?.(-40) || [],
    };
  },

  applyRemote(session) {
    if (!session || typeof session !== 'object') return;
    session.shortId = this.BATCH_SHORT_ID;
    session.sessionName = this.SESSION_NAME;
    session.batchLabel = this.SESSION_NAME;
    this._lastRemote = session;
    if (session.deviceId) this._deviceId = session.deviceId;
    if (session.lastPos?.lat != null) {
      window._lastPos = session.lastPos;
      placeMe?.(session.lastPos.lat, session.lastPos.lng, { quiet: true, markerOnly: true });
    }
    if (session.theme && AstranovTheme?.set) AstranovTheme.set(session.theme);
    if (session.shortId && AstranovNode?.resumeFromServer) {
      AstranovNode.resumeFromServer(session);
    }
    if (session.wishlist?.length && AstranovWishlist?.applyRemote) {
      AstranovWishlist.applyRemote(session.wishlist);
    }
    if (session.cliHistory?.length && AciCli?.mergeHistory) {
      AciCli.mergeHistory(session.cliHistory);
    }
    if (session.handsFree && !SessionHold?.isHeld?.()) {
      window._handsFreeVoice = true;
      voiceSessionActive = true;
      voiceEnabled = true;
      setTimeout(() => scheduleVoiceResume?.(), 1200);
    }
    window.dispatchEvent(new CustomEvent('astranov-session-pulled', { detail: session }));
  },

  async onAuth() {
    if (this.isAstranov()) this.purgeAllLocalState();
    this._deviceId = this._deriveDeviceId();
    this._applyIdentity();
    if (Auth?.user) {
      if (this.isAstranov()) {
        await this.unifyCollective();
      } else {
        SessionHold?.clearForeignHold?.();
        await this.pull();
        await AstranovNode?.resumeSession?.();
      }
      setTimeout(() => AstranovWishlist?.announceRecovered?.(), 900);
      if (this.isAstranov()) {
        GlobeDeck?.setTitle?.(this.SESSION_NAME);
        const chip = document.getElementById('user-chip');
        if (chip) {
          chip.textContent = 'ASTRANOV · OWNER';
          chip.style.color = '#00dd77';
        }
      }
    }
    if (window._lastPos && GlobeEntity?.syncMe) {
      GlobeEntity.syncMe(_lastPos.lat, _lastPos.lng, me?.name || 'You');
    }
    AstranovPresence?.refresh?.();
  },

  async pull() {
    if (!Auth?.user || !AstranovNode?.api) return;
    if (Date.now() - this._lastPull < 8000) return;
    this._lastPull = Date.now();
    try {
      const r = await AstranovNode.api({ action: 'session_get' });
      if (r.ok && r.session) this.applyRemote(r.session);
    } catch (e) {
      console.warn('[AstranovSession] pull failed', e.message || e);
    }
  },

  async push(force) {
    if (!Auth?.user || !AstranovNode?.api) return;
    if (!force && document.hidden) return;
    try {
      await AstranovNode.api({ action: 'session_save', session: this.capture() });
    } catch (_) {}
  },
};
window.AstranovSession = AstranovSession;

// === ASTRANOV WISHLIST — recover requests across all devices ===
const AstranovWishlist = {
  MAX: 48,
  items: [],

  SEED: [
    { text: 'Unify user + session across all computers (one ASTRANOV, one collective session)', status: 'done', tag: 'session' },
    { text: 'City map on zoom — satellite, streets, routing, friends, moving drivers', status: 'done', tag: 'globe' },
    { text: 'Dark/bright theme toggle + CLI commands (dark, bright, theme)', status: 'done', tag: 'ui' },
    { text: 'Real Earth — day/night terminator, sun, moon', status: 'done', tag: 'globe' },
    { text: 'Super Add + inline in CLI bar, right edge, normal size', status: 'done', tag: 'ui' },
    { text: 'City view zoom-out trap — scroll/pinch returns to globe', status: 'done', tag: 'globe' },
    { text: 'Voice hands-free UX — mic stays listening between commands', status: 'done', tag: 'voice' },
    { text: 'Tiered smooth zoom — city → national → earth → orbit → solar → galaxy', status: 'done', tag: 'globe' },
    { text: 'Pinch/scroll zoom only — no rotation while two-finger zooming', status: 'done', tag: 'globe' },
    { text: 'Coders always online — listening, evolving brain for all users', status: 'done', tag: 'brain' },
    { text: 'CLI flood reduction — quiet locate/status, unified globe deck', status: 'done', tag: 'ui' },
    { text: 'Astranov Sites — instant subdomain provision via + or collective', status: 'done', tag: 'sites' },
    { text: 'Uniform login across globe + subdomains (Google, email, phone)', status: 'done', tag: 'auth' },
    { text: 'Google OAuth show Astranov not suspicious Supabase ref — api.astranov.eu', status: 'pending', tag: 'auth' },
    { text: 'Uniform subdomain site templates (frogschool, yachts, vendors)', status: 'done', tag: 'sites' },
    { text: 'Profile page for every user/vendor — tap to open, fill on demand', status: 'done', tag: 'sites' },
    { text: 'Subdomain on admin approval · profile live immediately', status: 'done', tag: 'sites' },
    { text: 'Yacht matcher — demand/supply, captain+crew, 300/200/100 EUR per day', status: 'done', tag: 'commerce' },
    { text: 'Universal match engine in superbooking — all business types, activatable fields, Coders field requests', status: 'done', tag: 'sites' },
    { text: 'Hellenic canon — Greek mythology & philosophy as Coders truth layer', status: 'done', tag: 'brain' },
    { text: 'Logged-in users on map — collab + κρυφτό hide-and-seek', status: 'done', tag: 'globe' },
    { text: 'Map team polygon + cloud chat + video/voice/phone/message any user', status: 'done', tag: 'comms' },
    { text: 'Marketplace task polygon + cloud chat — client picks delivery driver on map', status: 'done', tag: 'commerce' },
    { text: 'Real user scenarios — 8 automated tests passing before batch push', status: 'done', tag: 'qa' },
  ],

  init() {
    if (!AstranovSession?.CLOUD_ONLY) this._loadLocal();
    if (!this.items.length && !Auth?.user) this._seed();
    window.addEventListener('astranov-session-pulled', () => this._onRemote());
  },

  _key() {
    const uid = Auth?.user?.id || 'guest-' + (AstranovSession?.deviceId?.() || 'local');
    return 'astranov_wishlist_v1_' + uid.slice(0, 12);
  },

  _loadLocal() {
    try {
      const raw = localStorage.getItem(this._key());
      if (raw) this.items = JSON.parse(raw);
    } catch { this.items = []; }
  },

  _saveLocal() {
    if (AstranovSession?.CLOUD_ONLY && Auth?.user) {
      AstranovSession?.push?.();
      return;
    }
    try { localStorage.setItem(this._key(), JSON.stringify(this.items.slice(0, this.MAX))); } catch (_) {}
  },

  _seed() {
    const now = Date.now();
    this.items = this.SEED.map((s, i) => ({
      id: 'seed-' + i,
      text: s.text,
      status: s.status,
      tag: s.tag || 'general',
      source: 'recovered',
      deviceId: 'seed',
      at: now - (this.SEED.length - i) * 60000,
    }));
    this._saveLocal();
  },

  _norm(text) {
    return String(text || '').trim().replace(/\s+/g, ' ').slice(0, 400);
  },

  _dup(text) {
    const n = this._norm(text).toLowerCase();
    return this.items.some(it => this._norm(it.text).toLowerCase() === n);
  },

  add(text, opts) {
    opts = opts || {};
    const t = this._norm(text);
    if (!t || t.length < 4) return null;
    if (this._dup(t)) return null;
    const item = {
      id: 'w-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      text: t,
      status: opts.status || 'pending',
      tag: opts.tag || 'user',
      source: opts.source || AstranovSession?.deviceId?.() || 'local',
      deviceId: AstranovSession?.deviceId?.() || 'local',
      at: Date.now(),
    };
    this.items.unshift(item);
    if (this.items.length > this.MAX) this.items.length = this.MAX;
    this._saveLocal();
    AstranovSession?.push?.();
    return item;
  },

  markDone(match) {
    const m = String(match || '').toLowerCase();
    let hit = false;
    this.items.forEach(it => {
      if (it.status === 'done') return;
      if (it.id === match || it.text.toLowerCase().includes(m)) {
        it.status = 'done';
        it.doneAt = Date.now();
        hit = true;
      }
    });
    if (hit) { this._saveLocal(); AstranovSession?.push?.(); }
    return hit;
  },

  pending() {
    return this.items.filter(it => it.status !== 'done');
  },

  snapshot() {
    return this.items.slice(0, this.MAX);
  },

  mergeRemote(list) {
    if (!Array.isArray(list) || !list.length) return 0;
    let added = 0;
    list.forEach(remote => {
      const t = this._norm(remote?.text);
      if (!t) return;
      if (this._dup(t)) return;
      this.items.push({
        id: remote.id || ('r-' + added + '-' + Date.now().toString(36)),
        text: t,
        status: remote.status || 'pending',
        tag: remote.tag || 'remote',
        source: remote.source || remote.deviceId || 'remote',
        deviceId: remote.deviceId || 'remote',
        at: remote.at || Date.now(),
      });
      added++;
    });
    this.items.sort((a, b) => (b.at || 0) - (a.at || 0));
    if (this.items.length > this.MAX) this.items.length = this.MAX;
    if (added) this._saveLocal();
    return added;
  },

  applyRemote(list) {
    const n = this.mergeRemote(list);
    if (n > 0) this._announce(n);
    return n;
  },

  _onRemote() {
    const snap = AstranovSession?._lastRemote;
    if (snap?.wishlist?.length) this.applyRemote(snap.wishlist);
  },

  announceRecovered() {
    const pending = this.pending();
    if (!pending.length) return;
    const fromOther = pending.filter(it => it.source && it.source !== 'seed' && it.deviceId !== AstranovSession?.deviceId?.());
    AciCli?.print('── Recovered from your other devices ──', 'dim');
    pending.slice(0, 8).forEach((it, i) => {
      const src = it.source === 'recovered' || it.source === 'seed' ? 'archive' : (it.source || 'device').slice(0, 12);
      AciCli?.print((i + 1) + '. [' + (it.status === 'done' ? '✓' : '○') + '] ' + it.text.slice(0, 120), it.status === 'done' ? 'dim' : 'ok');
    });
    if (fromOther.length) {
      AciCli?.print(fromOther.length + ' request(s) synced from another computer — type requests to list', 'ok');
    } else {
      AciCli?.print('Type requests · wishlist · sync — no need to retype', 'dim');
    }
    GlobeDeck?.setPreview?.('◎ ' + pending.length + ' collective request(s) recovered');
  },

  _announce(n) {
    AciCli?.print('◎ Synced ' + n + ' request(s) from another device', 'ok');
  },

  captureCliLine(line) {
    const t = this._norm(line);
    if (!t || t.length < 12) return;
    if (/^(help|\?|locate|me|ping|hold|resume|stop|sync|requests|wishlist)\b/i.test(t)) return;
    this.add(t, { source: 'cli', tag: 'cli', status: 'pending' });
  },
};
window.AstranovWishlist = AstranovWishlist;

// === GLOBE PRESENCE — logged-in users on map · collab · κρυφτό hide-and-seek ===
const AstranovPresence = {
  CHANNEL: 'astranov-globe-live',
  TICK_MS: 3000,
  POLL_MS: 15000,
  DB_MIN_MS: 12000,
  rtChannel: null,
  _hb: null,
  _poll: null,
  _watchId: null,
  _lastDbAt: 0,
  _live: new Map(),
  game: null,
  _gameStartedAt: 0,

  wantsKryftoStart(line) {
    const low = String(line || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (!low) return false;
    if (/^(κρυφτό|κρυφτο|kryfto|hideandseek|hide-and-seek|συγύρισμα|συγυρισμα|συγυρίσμα)\b/.test(low)) return true;
    if (/\bhide\s*(and|&|n)?\s*seek/.test(low)) return true;
    if (/\bhouse\s*keep(ing)?\b/.test(low)) return true;
    if (/\bσυγύρισμα|συγυρισμα|συγυρίσμα\b/.test(low)) return true;
    if (/\b(start|play|begin|παίξε|παιξε|άρχισε|αρχισε|ξεκίνα|ξεκινα)\b.*\b(κρυφτ|kryfto|hide\s*and\s*seek|house\s*keep|συγύρισμα|συγυρισμα|συγυρίσμα)/.test(low)) return true;
    if (/\b(κρυφτ|kryfto|hide\s*and\s*seek|house\s*keep|συγύρισμα|συγυρισμα|συγυρίσμα).*\b(start|play|game|ξεκίνα|ξεκινα)\b/.test(low)) return true;
    if (/\bπαιχνίδι\s+(κρυφτ|kryfto)\b/.test(low)) return true;
    return false;
  },

  init() {
    if (!SlumberManager?.allows?.('presence')) return;
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange((_ev, session) => {
        if (session?.user) setTimeout(() => this.join(), 400);
        else this.leave();
      });
      setTimeout(() => { if (Auth?.user) this.join(); }, 2500);
    }
  },

  displayName() {
    if (AstranovSession?.isAstranov?.()) return 'ASTRANOV';
    const u = Auth?.user;
    if (!u) return 'Guest';
    return u.user_metadata?.full_name
      || u.user_metadata?.name
      || (u.email || '').split('@')[0]
      || 'User';
  },

  pos() {
    if (GhostTravel?.active?.()) return GhostTravel.publicPos();
    return window._lastPos || { lat: 36.22, lng: 28.12 };
  },

  async join() {
    if (!SlumberManager?.allows?.('presence')) return;
    if (!Auth?.client || !Auth?.user) return;
    if (Auth?.whenReady) await Auth.whenReady();
    if (this.rtChannel) return;
    const uid = Auth.user.id;
    this.rtChannel = Auth.client.channel(this.CHANNEL, {
      config: { presence: { key: uid } },
    });
    this.rtChannel.on('presence', { event: 'sync' }, () => this._onPresenceSync());
    this.rtChannel.on('presence', { event: 'join' }, () => this._onPresenceSync());
    this.rtChannel.on('presence', { event: 'leave' }, () => this._onPresenceSync());
    this.rtChannel.on('broadcast', { event: 'pos' }, ({ payload }) => {
      if (payload?.user_id && payload.user_id !== Auth?.user?.id) {
        GhostTravel?.ingestUserPos?.(payload);
        this._ingest(payload);
        this._render();
      }
    });
    this.rtChannel.on('broadcast', { event: 'game' }, ({ payload }) => {
      if (payload?.type === 'kryfto_start' && payload.from !== this.displayName()) {
        this.game = 'kryfto';
        GlobeDeck?.setPreview?.('◎ ' + payload.from + ' started κρυφτό — hide or seek!');
        AciCli?.print('◎ ' + payload.from + ' · κρυφτό game', 'dim');
      }
    });
    await this.rtChannel.subscribe(async (status) => {
      if (status === 'SUBSCRIBED') await this.broadcast();
    });
    if (this._hb) clearInterval(this._hb);
    this._hb = setInterval(() => this._tick(), this.TICK_MS);
    if (this._poll) clearInterval(this._poll);
    this._poll = setInterval(() => this._pollProfiles(), this.POLL_MS);
    if (userLocated) this._startGpsWatch();
    await this._pollProfiles();
    if (GhostTravel?.active?.()) {
      GhostTravel._pollLastLogin?.();
      AciCli?.print?.('◎ Ghost route · ±3 km scramble · real GPS never leaves device', 'dim');
    } else {
      AciCli?.print?.('◎ Map live — sign-in players visible · kryfto · hide · players', 'dim');
    }
  },

  async leave() {
    this._stopGpsWatch();
    if (this._hb) { clearInterval(this._hb); this._hb = null; }
    if (this._poll) { clearInterval(this._poll); this._poll = null; }
    if (this.rtChannel && Auth?.client) {
      try { await Auth.client.removeChannel(this.rtChannel); } catch (_) {}
      this.rtChannel = null;
    }
    this._live.clear();
    this._applyOthers([]);
    this.game = null;
  },

  payload() {
    const p = this.pos();
    return {
      user_id: Auth.user.id,
      name: this.displayName(),
      lat: p.lat,
      lng: p.lng,
      hidden: !!window.hidden,
      game: this.game,
      emoji: '👤',
      t: Date.now(),
    };
  },

  async broadcast() {
    if (!Auth?.user) return;
    const pl = this.payload();
    const now = Date.now();
    const writeDb = now - (this._lastDbAt || 0) >= this.DB_MIN_MS;
    try {
      if (this.rtChannel) await this.rtChannel.track(pl);
      if (writeDb && Auth?.client) {
        await Auth.client.from('profiles').update({
          field_lat: pl.lat,
          field_lng: pl.lng,
          field_seen_at: new Date().toISOString(),
          map_hidden: pl.hidden,
          map_mode: this.game || 'collab',
          display_name: pl.name,
        }).eq('id', Auth.user.id);
        this._lastDbAt = now;
      }
      if (this.rtChannel) {
        this.rtChannel.send({ type: 'broadcast', event: 'pos', payload: pl });
      }
    } catch (e) {
      console.warn('[Presence] broadcast', e.message || e);
    }
  },

  _onGpsFix(pos) {
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    if (GhostTravel?.active?.()) {
      GhostTravel.setTruePos(lat, lng);
      window._truePos = { lat, lng };
      userLocated = true;
      GhostTravel._applyVisual?.();
      return;
    }
    window._lastPos = { lat, lng };
    userLocated = true;
    if (window._meMarker) {
      const p = latLngToPos(lat, lng, 1.03);
      window._meMarker.position.set(p.x, p.y, p.z);
    }
    GlobeEntity?.syncMe?.(lat, lng, me?.name || 'You');
    if (CityMap?.active) CityMap._syncMarkers?.();
  },

  _startGpsWatch() {
    if (this._watchId != null || !navigator.geolocation) return;
    this._watchId = navigator.geolocation.watchPosition(
      (pos) => this._onGpsFix(pos),
      () => {},
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 }
    );
  },

  _stopGpsWatch() {
    if (this._watchId == null || !navigator.geolocation) return;
    navigator.geolocation.clearWatch(this._watchId);
    this._watchId = null;
  },

  async _tick() {
    if (!Auth?.user) return;
    if (!GhostTravel?.active?.()) await this.broadcast();
  },

  async broadcastGhost() {
    if (!GhostTravel?.active?.()) return;
    await this.broadcast();
  },

  onMove(lat, lng) {
    if (!Auth?.user) return;
    if (GhostTravel?.active?.()) {
      GhostTravel.setTruePos(lat, lng);
      window._truePos = { lat, lng };
      userLocated = true;
      this._startGpsWatch();
      return;
    }
    window._lastPos = { lat, lng };
    userLocated = true;
    this._startGpsWatch();
    this.broadcast();
  },

  refresh() {
    if (!Auth?.user) {
      this._applyOthers([]);
      return;
    }
    if (!this.rtChannel) this.join();
    else {
      this._onPresenceSync();
      this._pollProfiles();
    }
  },

  _ingest(p) {
    if (!p?.user_id || p.user_id === Auth?.user?.id || p.hidden) return;
    if (p.lat == null || p.lng == null) return;
    this._live.set(p.user_id, {
      id: p.user_id,
      name: p.name || 'Player',
      lat: +p.lat,
      lng: +p.lng,
      emoji: p.emoji || '👤',
      game: p.game,
      t: p.t || Date.now(),
    });
  },

  _onPresenceSync() {
    if (!this.rtChannel) return;
    const state = this.rtChannel.presenceState();
    Object.keys(state).forEach((key) => {
      (state[key] || []).forEach((pres) => this._ingest(pres));
    });
    this._render();
  },

  async _pollProfiles() {
    if (!Auth?.user || !Auth?.client) return;
    if (Auth?.whenReady) await Auth.whenReady();
    try {
      const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      const { data: rows, error } = await Auth.client
        .from('profiles')
        .select('id,display_name,avatar_emoji,field_lat,field_lng,field_seen_at,map_hidden')
        .gte('field_seen_at', since)
        .not('field_lat', 'is', null)
        .not('field_lng', 'is', null)
        .eq('map_hidden', false)
        .neq('id', Auth.user.id)
        .limit(80);
      if (error) return;
      (rows || []).forEach((row) => {
        this._ingest({
          user_id: row.id,
          name: row.display_name || 'User',
          lat: row.field_lat,
          lng: row.field_lng,
          emoji: row.avatar_emoji || '👤',
          hidden: row.map_hidden,
          t: row.field_seen_at ? new Date(row.field_seen_at).getTime() : Date.now(),
        });
      });
      this._render();
    } catch (e) {
      console.warn('[Presence] poll', e.message || e);
    }
  },

  _render() {
    const users = [...this._live.values()].sort((a, b) => (b.t || 0) - (a.t || 0));
    this._applyOthers(users);
    TelemachosPilot?._syncGamerTelemetry?.();
    TelemachosPilot?.refreshTeamStatus?.({ quiet: true });
  },

  _applyOthers(users) {
    users = WillaGames?.mergeLivePlayers?.(users) || users;
    window.others = users;
    if (typeof others !== 'undefined') others = users;
    GlobeEntity?.syncFriends?.(users);
    if (CityMap?.active) CityMap._syncMarkers?.();
    const chip = document.getElementById('city-life-chip');
    if (chip?.classList.contains('open') && users.length) {
      const shops = (Commerce?.vendors || []).length;
      chip.innerHTML = '<b>City</b> · ' + shops + ' shops · ' + users.length + ' player(s) live';
    }
  },

  toggleHide() {
    if (!Auth?.user) {
      ACIControl?.reply('Sign in first — then hide for κρυφτό');
      return !!window.hidden;
    }
    window.hidden = !window.hidden;
    if (typeof hidden !== 'undefined') hidden = window.hidden;
    if (window._meMarker) window._meMarker.visible = !window.hidden;
    const ge = GlobeEntity?.entities?.get('me');
    if (ge?.mesh) ge.mesh.visible = !window.hidden;
    this.broadcast();
    const msg = window.hidden
      ? 'Κρυφτό — hidden from other players'
      : 'Visible — back on the map for collab';
    ACIControl?.reply(msg);
    ContextTruth?.sync?.();
    if (Voice.maySpeak()) speak(msg.slice(0, 80), () => resumeListening?.());
    return window.hidden;
  },

  startKryfto() {
    if (!Auth?.user) {
      WillaGames?.ensureDemoPlayers?.('kryfto');
      WillaGames?.startKryftoDemo?.();
      return;
    }
    WillaGames?.ensureDemoPlayers?.('kryfto');
    this.game = 'kryfto';
    this._gameStartedAt = Date.now();
    window.hidden = false;
    if (typeof hidden !== 'undefined') hidden = false;
    if (window._meMarker) window._meMarker.visible = true;
    const ge = GlobeEntity?.entities?.get('me');
    if (ge?.mesh) ge.mesh.visible = true;

    const afterLocate = () => this._kryftoLive();
    if (!userLocated && typeof requestLocationIfNeeded === 'function') {
      requestLocationIfNeeded(afterLocate);
      ACIControl?.reply('Κρυφτό — locating you on the map…');
      return;
    }
    if (!userLocated && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (typeof placeMe === 'function') {
            placeMe(pos.coords.latitude, pos.coords.longitude, { quiet: true, markerOnly: true });
          }
          afterLocate();
        },
        () => afterLocate(),
        { enableHighAccuracy: true, maximumAge: 4000, timeout: 12000 }
      );
      ACIControl?.reply('Κρυφτό — locating…');
      return;
    }
    afterLocate();
  },

  _kryftoLive() {
    this.broadcast();
    this.rtChannel?.send({
      type: 'broadcast',
      event: 'game',
      payload: { type: 'kryfto_start', from: this.displayName(), t: Date.now() },
    });
    const others = window.others || [];
    const n = others.length;
    const total = n + 1;
    others.forEach((u) => {
      const color = u.team === 'red' ? 0xff2244 : 0x3d9eff;
      MapDepict?.pulse?.(u.lat, u.lng, color, 'κρυφτό · ' + u.name, 16000);
    });
    const p = this.pos();
    MapDepict?.action?.('play', { lat: p.lat, lng: p.lng, detail: 'κρυφτό · hide and seek LIVE' });
    MapDepict?.pulse?.(p.lat, p.lng, 0x1a6fd4, 'ΚΡΥΦΤΟ', 18000);
    GlobeDeck?.expand?.(SuperCli?.title || 'Astranov Command Line');
    GlobeDeck?.setTitle?.('ΚΡΥΦΤΟ');
    GlobeDeck?.setPreview?.('◎ ' + total + ' player(s) · say hide to vanish · players to seek');
    GlobeDeck.activeTask = 'game';
    ContextTruth?.sync?.();
    AciCli?.print('◎ GAME START · κρυφτό / hide and seek · ' + total + ' on map', 'ok');
    const olympians = others.filter(u => u.agent === 'grok-heavy').length;
    const titans = others.filter(u => u.agent === 'cronian').length;
    const msg = olympians >= 12 && titans >= 12
      ? 'Κρυφτό · 12 gods 🔵 · 12 titans 🔴 on map. Πες hide · players'
      : n > 0
      ? 'Κρυφτό ξεκίνησε! ' + total + ' παίκτες. Πες hide · players'
      : 'Κρυφτό ξεκίνησε! Πες hide — ή players για gods vs titans';
    ACIControl?.reply(msg);
    if (Voice.maySpeak()) speak('Κρυφτό. Πες hide.', () => resumeListening?.());
    FieldBrain?.pulse?.('play', 'kryfto started', { role: 'client', props: { players: total } });
  },

  listPlayers() {
    WillaGames?.ensureDemoPlayers?.(this.game || 'lobby');
    const list = window.others || [];
    if (!list.length) {
      AciCli?.print('No other players on map — try: kryfto · pyramid · willa', 'dim');
      ACIControl?.reply('No players yet — say kryfto · pyramid game · willa game for demos');
      return list;
    }
    list.forEach((u) => {
      const color = u.team === 'red' ? 0xff2244 : u.team === 'blue' ? 0x3d9eff : 0xffaa33;
      MapDepict?.pulse?.(u.lat, u.lng, color, (u.emoji || '👤') + ' ' + u.name, 12000);
    });
    AciCli?.print(list.map((u) => (u.emoji || '👤') + ' ' + u.name
      + (u.domain ? ' · ' + u.domain : '') + ' · ' + u.lat.toFixed(3)).join(' · '), 'ok');
    ACIControl?.reply(list.length + ' on map — tap a marker or type locate');
    return list;
  },
};

window.AstranovPresence = AstranovPresence;

// ═══════════════════════════════════════════════════════════════
// ASTRANOV — Marketplace Comms (vendors · clients · drivers)
// Same polygon + glowing lines + cloud chat as MapComms teams.
// Clients pick from available delivery drivers on map + in cloud.
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  const MC = {
    active: false,
    orderId: null,
    vendor: null,
    drivers: [],
    wants: '',
    preferredDriverId: null,
    seekingDriver: false,
    _poll: null,
  };

  function uid() {
    return Auth?.user?.id || null;
  }

  function displayName(p) {
    return p?.display_name || p?.name || (p?.id ? String(p.id).slice(0, 8) : 'User');
  }

  function emojiFor(role) {
    if (role === 'driver') return '🚚';
    if (role === 'vendor') return '🏬';
    return '🛒';
  }

  function myRole() {
    const u = uid();
    if (!u) return 'client';
    if (MC.drivers.some((d) => d.id === u)) return 'driver';
    if (MC.vendor?.id === u || MC.vendor?.owner_id === u) return 'vendor';
    return 'client';
  }

  function coords(p) {
    const lat = p?.lat ?? p?.field_lat ?? null;
    const lng = p?.lng ?? p?.field_lng ?? null;
    return lat != null && lng != null ? { lat, lng } : null;
  }

  function toMapMember(p, role) {
    const c = coords(p);
    if (!p?.id || !c) return null;
    return {
      id: p.id,
      name: displayName(p),
      lat: c.lat,
      lng: c.lng,
      emoji: p.avatar_emoji || p.emoji || emojiFor(role),
      role,
    };
  }

  function membersFromContext() {
    const out = [];
    const seen = new Set();
    const add = (p, role) => {
      const m = toMapMember(p, role);
      if (!m || seen.has(m.id)) return;
      seen.add(m.id);
      out.push(m);
    };

    const p = window._lastPos;
    if (uid() && p) {
      add({
        id: uid(),
        display_name: AstranovPresence?.displayName?.() || me?.name || 'You',
        lat: p.lat,
        lng: p.lng,
      }, myRole());
    }

    if (MC.vendor) add(MC.vendor, 'vendor');
    (MC.drivers || []).forEach((d) => add(d, 'driver'));
    return out;
  }

  function cloudTitle() {
    if (MC.orderId) {
      const short = String(MC.orderId).slice(0, 8);
      return `📦 Task ${short}${MC.seekingDriver ? ' · pick driver' : ''}`;
    }
    if (MC.vendor) return `🛒 ${displayName(MC.vendor)} · order chat`;
    return '🛒 Marketplace';
  }

  function syncCloud() {
    if (!window.MapComms || !Auth?.user) return;
    const members = membersFromContext();
    const sessionId = MC.orderId
      ? ('maptask-' + MC.orderId)
      : ('maptask-browse-' + (MC.vendor?.id || Date.now().toString(36)));
    window.MapComms.openSession({
      id: sessionId,
      kind: 'task',
      name: cloudTitle(),
      members,
      persist: false,
      orderId: MC.orderId,
      showDriverPicker: MC.seekingDriver && myRole() === 'client' && MC.drivers.length > 0,
      drivers: MC.drivers,
      selfRole: myRole(),
    });
    MC.active = true;
  }

  function hide() {
    MC.active = false;
    MC.orderId = null;
    MC.vendor = null;
    MC.drivers = [];
    MC.wants = '';
    MC.preferredDriverId = null;
    MC.seekingDriver = false;
    if (MC._poll) {
      clearInterval(MC._poll);
      MC._poll = null;
    }
    if (window.MapComms) window.MapComms.leaveTeam();
  }

  async function fetchOrderDrivers() {
    const C = window.Commerce;
    if (!C?.fetchNearbyDrivers) return [];
    const u = C.userLatLng?.() || window._lastPos || {};
    if (u.lat == null) return [];
    return C.fetchNearbyDrivers(u.lat, u.lng);
  }

  async function refreshOrder(orderId) {
    if (!Auth?.client || !orderId) return null;
    const { data } = await Auth.client
      .from('orders')
      .select('id,status,driver_id,customer_id,vendor_id,driver_accepted_at,short_id,delivery_lat,delivery_lng,items,calc')
      .eq('id', orderId)
      .maybeSingle();
    return data;
  }

  function startOrderPoll(orderId) {
    if (MC._poll) clearInterval(MC._poll);
    MC._poll = setInterval(async () => {
      const o = await refreshOrder(orderId);
      if (!o) return;
      MC.seekingDriver = !o.driver_id && (o.status === 'seeking_driver' || o.status === 'pending');
      if (o.driver_id && MC.preferredDriverId !== o.driver_id) {
        MC.preferredDriverId = o.driver_id;
        const d = MC.drivers.find((x) => x.id === o.driver_id);
        window.MapComms?.postSystem?.(`${emojiFor('driver')} Driver ${displayName(d || { id: o.driver_id })} assigned — must accept to activate triangle`);
        MC.awaitingAccept = !o.driver_accepted_at && o.status === 'assigned';
      }
      if (o.driver_accepted_at && o.status === 'active') {
        MC.awaitingAccept = false;
        void MarketplaceDeliveryEngine?.onDriverAccepted?.(o, MC.vendor, MC.drivers.find((x) => x.id === o.driver_id));
      }
      if (!MC.seekingDriver) window.MapComms?.hideDriverPicker?.();
      syncCloud();
    }, 8000);
  }

  /** Pre-order: client browsing vendor + nearby drivers */
  function openForBrowse(opts) {
    opts = opts || {};
    MC.orderId = null;
    MC.vendor = opts.vendor || null;
    MC.drivers = opts.drivers || [];
    MC.wants = opts.wants || '';
    MC.preferredDriverId = opts.preferredDriverId || Commerce?._preferredDriverId || null;
    MC.seekingDriver = myRole() === 'client' && MC.drivers.length > 0 && !MC.preferredDriverId;
    syncCloud();
    if (MC.wants) window.MapComms?.postSystem?.(`Order: ${MC.wants.slice(0, 120)}`);
    window.MapComms?.postSystem?.(
      MC.drivers.length
        ? `${MC.drivers.length} driver(s) nearby — tap map marker or pick in cloud`
        : 'No drivers on map yet — order will broadcast to field'
    );
  }

  /** Post-order task thread: client, vendor, drivers */
  async function openForOrder(opts) {
    opts = opts || {};
    MC.orderId = opts.order?.id || opts.orderId || null;
    MC.vendor = opts.vendor || null;
    MC.drivers = opts.drivers || [];
    if (!MC.drivers.length) MC.drivers = await fetchOrderDrivers();
    MC.wants = opts.order?.items?.map?.((i) => i.name || i).join(', ') || opts.wants || '';
    MC.preferredDriverId = opts.order?.driver_id || opts.preferredDriverId || null;
    MC.seekingDriver = opts.seeking_driver ?? (!MC.preferredDriverId);
    syncCloud();
    window.MapComms?.postSystem?.(`📦 Order placed${MC.wants ? ': ' + MC.wants.slice(0, 80) : ''}`);
    if (MC.orderId) startOrderPoll(MC.orderId);
  }

  async function selectDriver(driverId, driverObj) {
    if (!driverId) return;
    if (driverObj && !MC.drivers.some((x) => x.id === driverId)) MC.drivers.push(driverObj);
    const d = MC.drivers.find((x) => x.id === driverId)
      || driverObj
      || { id: driverId, display_name: 'Driver' };
    MC.preferredDriverId = driverId;
    MC.seekingDriver = false;
    Commerce._preferredDriverId = driverId;
    Commerce._preferredDriver = d;

    syncCloud();
    window.MapComms?.postSystem?.(`${emojiFor('driver')} Selected ${displayName(d)}`);
    ACIControl?.reply('Driver ' + displayName(d) + (MC.orderId ? ' assigned to order' : ' — will use on checkout'));

    if (MC.orderId) {
      try {
        const headers = Auth?.authHeaders ? await Auth.authHeaders() : {};
        const r = await fetch(SB_URL + '/functions/v1/order-intake', {
          method: 'POST',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'assign_driver', order_id: MC.orderId, driver_id: driverId }),
        });
        const j = await r.json().catch(() => ({}));
        if (j.awaiting_accept) {
          MC.awaitingAccept = true;
          window.MapComms?.postSystem?.('Driver must accept assignment — triangle activates on sign');
        }
      } catch (e) {
        console.warn('[MarketplaceComms] assign_driver', e);
      }
    } else if (Commerce?.renderCompare && Commerce._suggestion) {
      Commerce.renderCompare(
        [Commerce._suggestion],
        MC.drivers,
        Commerce._lastWants || [],
        Commerce._balance
      );
    }
  }

  function listDriversText() {
    if (!MC.drivers.length) return 'No delivery drivers on map.';
    const u = Commerce?.userLatLng?.() || {};
    return MC.drivers
      .map((d, i) => {
        const km = u.lat != null
          ? Commerce.haversineKm(u.lat, u.lng, d.field_lat, d.field_lng).toFixed(1)
          : '?';
        return `${i + 1}. ${displayName(d)} · ${km} km`;
      })
      .join('\n');
  }

  async function acceptAssignment(orderId) {
    const oid = orderId || MC.orderId;
    if (!oid) return { error: 'no order' };
    return FieldBrain?.claimDelivery?.(oid);
  }

  function init() {
    window.MarketplaceComms = {
      openForBrowse,
      openForOrder,
      selectDriver,
      acceptAssignment,
      hide,
      membersFromContext,
      get state() { return MC; },
      listDriversText,
    };
    console.log('[MarketplaceComms] ready — vendor/client/driver polygon · P2P 24/7');
  }

  init();
})();

// === PROFILE SITE — every user & vendor fills their page; opens on tap ===
const ProfileSite = {
  targetId: null,
  targetType: 'user',
  _vendor: null,
  _draft: null,
  _shopMode: false,
  _shopDraft: null,

  init() {
    this._bind();
  },

  _bind() {
    const panel = document.getElementById('profile-site-panel');
    if (!panel || panel.dataset.bound) return;
    panel.dataset.bound = '1';
    document.getElementById('ps-close')?.addEventListener('click', () => this.close());
    document.getElementById('ps-save')?.addEventListener('click', () => {
      if (this._shopMode) this.saveShop();
      else this.save();
    });
    document.getElementById('ps-site-req')?.addEventListener('click', () => this.requestSubdomain());
    document.getElementById('ps-open-site')?.addEventListener('click', () => this.openLiveSite());
    document.getElementById('ps-shop')?.addEventListener('click', () => {
      if (this._vendor) Commerce?.openVendor?.(this._vendor);
    });
    document.getElementById('ps-logout')?.addEventListener('click', () => Auth?.signOut?.());
  },

  esc(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  isSelf(id) {
    return Auth?.user?.id && id === Auth.user.id;
  },

  async loadProfile(userId) {
    if (!Auth?.client) return null;
    const { data } = await Auth.client
      .from('profiles')
      .select('id,username,display_name,avatar_emoji,bio,phone,public_email,profile_page,site_slug,site_request_status,roles,is_vendor')
      .eq('id', userId)
      .maybeSingle();
    return data;
  },

  async openUser(userId, opts) {
    opts = opts || {};
    if (!userId) return;
    this.targetId = userId;
    this.targetType = 'user';
    this._vendor = opts.vendor || null;
    const prof = await this.loadProfile(userId);
    if (!prof) {
      ACIControl?.reply('Profile not found');
      return;
    }
    this._render(prof);
    document.getElementById('profile-site-panel')?.classList.add('open');
    const lat = window._lastPos?.lat;
    const lng = window._lastPos?.lng;
    if (lat != null && this.isSelf(userId)) {
      Responsive3D?.visualReact?.('profile', { lat, lng });
      GlobeEntity?.syncMe?.(lat, lng, prof.display_name || 'You', { alwaysShow: true });
    } else {
      MapDepict?.pulse?.(lat, lng, 0x49b7ff, prof.display_name || 'Profile', 8000);
    }
  },

  async openVendor(vendor) {
    if (!vendor) return;
    this._vendor = vendor;
    const ownerId = vendor.owner_id;
    if (ownerId) {
      await this.openUser(ownerId, { vendor });
    } else {
      this.targetType = 'vendor';
      this._renderVendorOnly(vendor);
      document.getElementById('profile-site-panel')?.classList.add('open');
    }
  },

  _page(prof) {
    const p = prof?.profile_page;
    return (p && typeof p === 'object') ? p : {};
  },

  _render(prof) {
    const panel = document.getElementById('profile-site-panel');
    if (!panel) return;
    const page = this._page(prof);
    const self = this.isSelf(prof.id);
    const meta = Auth?.user?.user_metadata || {};
    const avatarUrl = page.avatar_url || page.profile_photo_url || meta.avatar_url || meta.picture || '';
    const entranceUrl = page.entrance_photo_url || page.delivery_entrance_url || '';
    const title = page.title || prof.display_name || prof.username || 'Profile';
    const subtitle = page.subtitle || prof.bio || '';
    const about = page.about || prof.bio || '';
    const services = Array.isArray(page.services) ? page.services : [];
    const contact = page.contact || {};

    const titleEl = document.getElementById('ps-title');
    if (titleEl) {
      titleEl.textContent = title;
      if (avatarUrl) {
        titleEl.style.backgroundImage = 'url(' + avatarUrl + ')';
        titleEl.style.backgroundSize = 'cover';
        titleEl.style.backgroundPosition = 'center';
        titleEl.style.paddingLeft = '36px';
        titleEl.style.minHeight = '28px';
      } else {
        titleEl.style.backgroundImage = '';
        titleEl.style.paddingLeft = '';
      }
    }
    document.getElementById('ps-sub').textContent = subtitle;
    const body = document.getElementById('ps-body');
    if (!body) return;

    if (self) {
      this._draft = {
        title: page.title || prof.display_name || '',
        subtitle: page.subtitle || '',
        about: about,
        services: services.join('\n'),
        phone: prof.phone || contact.phone || '',
        email: prof.public_email || contact.email || Auth?.user?.email || '',
        site_slug: prof.site_slug || '',
        avatarUrl,
        entranceUrl,
        avatarFile: null,
        entranceFile: null,
      };
      const avStyle = avatarUrl ? ' style="background-image:url(' + this.esc(avatarUrl) + ')"' : '';
      const enStyle = entranceUrl ? ' style="background-image:url(' + this.esc(entranceUrl) + ')"' : '';
      body.innerHTML = ''
        + '<div class="ps-photo-row">'
        + '<div class="ps-photo-card"><div class="ps-photo-thumb ps-photo-avatar"' + avStyle + '></div><button type="button" id="ps-avatar-pick">Profile photo</button><input type="file" id="ps-avatar-in" accept="image/*" hidden /></div>'
        + '<div class="ps-photo-card"><div class="ps-photo-thumb ps-photo-entrance"' + enStyle + '></div><button type="button" id="ps-entrance-pick">House entrance</button><input type="file" id="ps-entrance-in" accept="image/*" hidden /></div>'
        + '</div><div class="ps-hint">Photos appear on map pins — shop logo · driver face · delivery door</div>'
        + '<label class="ps-field">Title<input id="ps-in-title" value="' + this.esc(this._draft.title) + '" /></label>'
        + '<label class="ps-field">Subtitle<input id="ps-in-sub" value="' + this.esc(this._draft.subtitle) + '" /></label>'
        + '<label class="ps-field">About<textarea id="ps-in-about" rows="3">' + this.esc(this._draft.about) + '</textarea></label>'
        + '<label class="ps-field">Services (one per line)<textarea id="ps-in-svc" rows="2">' + this.esc(this._draft.services) + '</textarea></label>'
        + '<label class="ps-field">Phone<input id="ps-in-phone" value="' + this.esc(this._draft.phone) + '" /></label>'
        + '<label class="ps-field">Public email<input id="ps-in-email" value="' + this.esc(this._draft.email) + '" /></label>'
        + '<label class="ps-field">Subdomain slug<input id="ps-in-slug" placeholder="my-yachts" value="' + this.esc(this._draft.site_slug) + '" /></label>'
        + '<div class="ps-hint">Subdomain needs admin approval · profile page is live now on tap</div>'
        + this._rolesHtml(prof.roles);
      const saveBtn = document.getElementById('ps-save');
      if (saveBtn) { saveBtn.style.display = 'inline-block'; saveBtn.textContent = 'Save profile'; }
      document.getElementById('ps-site-req').style.display = 'inline-block';
      document.getElementById('ps-logout').style.display = 'inline-block';
      this._bindRoleToggles();
      this._bindProfilePhotos();
    } else {
      body.innerHTML = ''
        + (about ? '<div class="ps-about">' + this.esc(about) + '</div>' : '')
        + (services.length ? '<div class="ps-svc">' + services.map(s => '<span class="ps-tag">' + this.esc(s) + '</span>').join('') + '</div>' : '')
        + (contact.phone || prof.phone ? '<div class="ps-line">📞 ' + this.esc(contact.phone || prof.phone) + '</div>' : '')
        + (contact.email || prof.public_email ? '<div class="ps-line">✉ ' + this.esc(contact.email || prof.public_email) + '</div>' : '')
        + (prof.site_slug ? '<div class="ps-line">◎ ' + this.esc(prof.site_slug) + '.astranov.eu · ' + this.esc(prof.site_request_status || 'none') + '</div>' : '');
      document.getElementById('ps-save').style.display = 'none';
      document.getElementById('ps-site-req').style.display = 'none';
      document.getElementById('ps-logout').style.display = 'none';
    }

    const shopBtn = document.getElementById('ps-shop');
    if (shopBtn) shopBtn.style.display = this._vendor ? 'inline-block' : 'none';

    const siteBtn = document.getElementById('ps-open-site');
    const live = prof.site_request_status === 'approved' || prof.site_request_status === 'live';
    if (siteBtn) {
      siteBtn.style.display = (prof.site_slug && live) ? 'inline-block' : 'none';
      siteBtn.dataset.url = prof.site_slug ? ('https://' + prof.site_slug + '.astranov.eu') : '';
    }

    const statusEl = document.getElementById('ps-status');
    if (statusEl) {
      const st = prof.site_request_status || 'none';
      statusEl.textContent = st === 'pending' ? '⏳ Subdomain pending admin approval'
        : st === 'live' || st === 'approved' ? '✓ ' + (prof.site_slug || '') + '.astranov.eu live'
        : '';
    }
  },

  _bindProfilePhotos() {
    const bindPick = (btnId, inputId, key, sel) => {
      document.getElementById(btnId)?.addEventListener('click', () => document.getElementById(inputId)?.click());
      document.getElementById(inputId)?.addEventListener('change', (e) => {
        const f = e.target.files?.[0];
        if (!f || !this._draft) return;
        this._draft[key + 'File'] = f;
        const url = URL.createObjectURL(f);
        this._draft[key + 'Url'] = url;
        const el = document.querySelector(sel);
        if (el) el.style.backgroundImage = 'url(' + url + ')';
      });
    };
    bindPick('ps-avatar-pick', 'ps-avatar-in', 'avatar', '.ps-photo-avatar');
    bindPick('ps-entrance-pick', 'ps-entrance-in', 'entrance', '.ps-photo-entrance');
  },

  _renderVendorOnly(vendor) {
    const logo = window.MapPins?.vendorLogo?.(vendor) || '';
    const titleEl = document.getElementById('ps-title');
    if (titleEl) {
      titleEl.textContent = vendor.name || 'Shop';
      if (logo) {
        titleEl.style.backgroundImage = 'url(' + logo + ')';
        titleEl.style.backgroundSize = 'cover';
        titleEl.style.backgroundPosition = 'center';
        titleEl.style.paddingLeft = '36px';
      } else titleEl.style.backgroundImage = '';
    }
    document.getElementById('ps-sub').textContent = vendor.category || 'vendor';
    const body = document.getElementById('ps-body');
    if (body) {
      body.innerHTML = '<div class="ps-about">Tap Shop to order · vendor on Astranov map</div>';
    }
    document.getElementById('ps-save').style.display = 'none';
    document.getElementById('ps-site-req').style.display = 'none';
    document.getElementById('ps-shop').style.display = 'inline-block';
    this._vendor = vendor;
  },

  _normRoles(roles) {
    const arr = Array.isArray(roles) ? roles.slice() : ['client', 'driver'];
    if (!arr.includes('client')) arr.unshift('client');
    return arr;
  },

  _rolesHtml(roles) {
    const r = this._normRoles(roles);
    const defs = [
      { id: 'client', label: 'Customer', icon: '🧑' },
      { id: 'driver', label: 'Delivery driver', icon: '🚚' },
      { id: 'vendor', label: 'Vendor', icon: '🏬' },
    ];
    return '<div class="ps-roles-title">Active roles · tap to toggle</div>'
      + '<div class="ps-role-row">'
      + defs.map(d => {
        const on = r.includes(d.id);
        return '<button type="button" class="ps-role-btn' + (on ? ' active' : '') + '" data-role="' + d.id + '">'
          + d.icon + ' ' + d.label + '</button>';
      }).join('')
      + '</div>';
  },

  _bindRoleToggles() {
    document.querySelectorAll('.ps-role-btn[data-role]').forEach(btn => {
      if (btn.dataset.bound) return;
      btn.dataset.bound = '1';
      btn.addEventListener('click', () => this.toggleRole(btn.dataset.role));
    });
  },

  async toggleRole(role) {
    if (!Auth?.user || !this.isSelf(this.targetId)) return;
    const allowed = ['client', 'driver', 'vendor'];
    if (!allowed.includes(role)) return;
    const prof = await this.loadProfile(Auth.user.id);
    const roles = this._normRoles(prof?.roles);
    const i = roles.indexOf(role);
    if (role === 'client') {
      if (i < 0) roles.push('client');
    } else if (i >= 0) {
      if (role === 'driver' && roles.length <= 1) {
        ACIControl?.reply('Keep at least customer role active');
        return;
      }
      roles.splice(i, 1);
    } else {
      roles.push(role);
    }
    try {
      const headers = await Auth.authHeaders();
      await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + Auth.user.id, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          roles,
          is_vendor: roles.includes('vendor'),
          updated_at: new Date().toISOString(),
        }),
      });
      FieldBrain.roles = roles;
      FieldBrain?.updateChip?.();
      ACIControl?.reply('Roles: ' + roles.join(' · '));
      Responsive3D?.visualReact?.('profile', {});
      await this.openUser(Auth.user.id, { vendor: this._vendor });
    } catch (e) {
      ACIControl?.reply('Role update failed: ' + (e.message || e));
    }
  },

  _collectDraft() {
    return {
      title: document.getElementById('ps-in-title')?.value?.trim() || '',
      subtitle: document.getElementById('ps-in-sub')?.value?.trim() || '',
      about: document.getElementById('ps-in-about')?.value?.trim() || '',
      services: (document.getElementById('ps-in-svc')?.value || '').split('\n').map(s => s.trim()).filter(Boolean),
      phone: document.getElementById('ps-in-phone')?.value?.trim() || '',
      email: document.getElementById('ps-in-email')?.value?.trim() || '',
      site_slug: document.getElementById('ps-in-slug')?.value?.trim() || '',
    };
  },

  async save() {
    if (!Auth?.user || !this.isSelf(this.targetId)) return;
    const d = this._collectDraft();
    let avatarUrl = this._draft?.avatarUrl || '';
    let entranceUrl = this._draft?.entranceUrl || '';
    try {
      if (this._draft?.avatarFile) avatarUrl = await this._uploadShopImage(this._draft.avatarFile);
      if (this._draft?.entranceFile) entranceUrl = await this._uploadShopImage(this._draft.entranceFile);
    } catch (e) {
      ACIControl?.reply('Photo upload failed: ' + (e.message || e));
      return;
    }
    const prevPage = this._page(await this.loadProfile(Auth.user.id));
    const profile_page = {
      ...prevPage,
      title: d.title,
      subtitle: d.subtitle,
      about: d.about,
      services: d.services,
      contact: { phone: d.phone, email: d.email },
      avatar_url: avatarUrl && !avatarUrl.startsWith('blob:') ? avatarUrl : (prevPage.avatar_url || ''),
      entrance_photo_url: entranceUrl && !entranceUrl.startsWith('blob:') ? entranceUrl : (prevPage.entrance_photo_url || ''),
      updated_at: new Date().toISOString(),
    };
    Auth._profilePage = profile_page;
    if (window._clientDelivery?.lat != null) {
      window._clientDelivery.photo_url = profile_page.entrance_photo_url || profile_page.avatar_url || window._clientDelivery.photo_url;
      MapPins?.persist?.();
    }
    if (window._driverBase?.lat != null) {
      window._driverBase.photo_url = profile_page.avatar_url || window._driverBase.photo_url;
      MapPins?.persist?.();
    }
    try {
      const headers = await Auth.authHeaders();
      await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + Auth.user.id, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          display_name: d.title || undefined,
          bio: d.about || undefined,
          phone: d.phone || null,
          public_email: d.email || null,
          profile_page,
          updated_at: new Date().toISOString(),
        }),
      });
      MapPins?.syncGlobe?.();
      ACIControl?.reply('Profile saved — photos live on map pins');
      AciCli?.print('profile saved', 'ok');
      await this.openUser(Auth.user.id, { vendor: this._vendor });
    } catch (e) {
      ACIControl?.reply('Save failed: ' + (e.message || e));
    }
  },

  async requestSubdomain() {
    if (!Auth?.user) return Auth?.openLoginModal?.('Sign in for profile');
    const d = this._collectDraft();
    const slug = AstranovSitesProvision?.slugify?.(d.site_slug) || '';
    if (!slug || slug.length < 3) {
      ACIControl?.reply('Enter subdomain slug (3+ letters) in profile');
      return;
    }
    try {
      const r = await AstranovSitesProvision.provision({
        slug,
        business_name: d.title || slug,
        business_type: /yacht|charter/i.test(d.about + d.title) ? 'yacht_charter' : 'generic',
        mode: /yacht|charter/i.test(d.about + d.title) ? 'range' : 'slot',
      });
      if (r.pending_approval) {
        ACIControl?.reply('Subdomain ' + r.domain + ' requested — pending admin approval. Profile page is live on map.');
      }
      await this.save();
    } catch (e) {
      ACIControl?.reply(String(e.message || e));
    }
  },

  openLiveSite() {
    const url = document.getElementById('ps-open-site')?.dataset?.url;
    if (!url) return;
    AstranovSiteShell?.open?.(url, { domain: url.replace(/^https:\/\//, ''), title: document.getElementById('ps-title')?.textContent });
  },

  close() {
    const panel = document.getElementById('profile-site-panel');
    panel?.classList.remove('open', 'shop-mode');
    this.targetId = null;
    this._vendor = null;
    this._shopMode = false;
    this._shopDraft = null;
  },

  formatCoords(lat, lng) {
    return Number(lat).toFixed(4) + ', ' + Number(lng).toFixed(4);
  },

  _vendorTags(vendor) {
    const t = vendor?.tags;
    return (t && typeof t === 'object') ? t : {};
  },

  async _fetchOwnedVendors() {
    if (!Auth?.user) return [];
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/vendors?select=id,name,emoji,lat,lng,items,tags,category,owner_id&owner_id=eq.' + Auth.user.id, { headers });
      return r.ok ? await r.json() : [];
    } catch { return []; }
  },

  async _vendorNear(lat, lng, owned) {
    const list = owned || await this._fetchOwnedVendors();
    let best = null;
    let bestKm = 0.12;
    list.forEach(v => {
      if (v.lat == null || v.lng == null) return;
      const km = Commerce?.haversineKm?.(lat, lng, v.lat, v.lng) ?? 999;
      if (km < bestKm) { bestKm = km; best = v; }
    });
    return best;
  },

  async _uploadShopImage(file) {
    if (!Auth?.user || !Auth?.client) throw new Error('login required — tap G');
    const ext = String(file.name || '').split('.').pop()?.toLowerCase() || 'jpg';
    const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(ext) ? ext : 'jpg';
    const path = Auth.user.id + '/shop/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + safeExt;
    const { error } = await Auth.client.storage.from('posts').upload(path, file, {
      contentType: file.type || 'image/jpeg',
      upsert: false,
    });
    if (error) throw new Error(error.message || 'upload failed');
    const { data } = Auth.client.storage.from('posts').getPublicUrl(path);
    return data?.publicUrl || (SB_URL + '/storage/v1/object/public/posts/' + path);
  },

  async openShopEditor(lat, lng) {
    if (!Auth?.user) return Auth?.openLoginModal?.('Sign in to set up your shop');
    lat = Number(lat);
    lng = Number(lng);
    if (!isFinite(lat) || !isFinite(lng)) return;
    window._pendingShopLatLng = { lat, lng };

    this._shopMode = true;
    this.targetType = 'shop';
    this.targetId = Auth.user.id;

    const prof = await this.loadProfile(Auth.user.id);
    const owned = await this._fetchOwnedVendors();
    const vendor = await this._vendorNear(lat, lng, owned);
    const tags = this._vendorTags(vendor);
    const menu = vendor ? Commerce?.menuFor?.(vendor) || [] : [];

    this._shopDraft = {
      vendorId: vendor?.id || null,
      lat,
      lng,
      name: vendor?.name || prof?.display_name || Auth.user.user_metadata?.full_name || 'My shop',
      phone: tags.phone || prof?.phone || '',
      email: tags.email || prof?.public_email || Auth.user.email || '',
      about: tags.about || prof?.bio || '',
      coverUrl: tags.cover_url || '',
      profileUrl: tags.profile_url || '',
      coverFile: null,
      profileFile: null,
      menuRows: menu.length
        ? menu.map(i => ({ name: i.name || '', price: i.price ?? '', imageUrl: i.image || i.photo || '', imageFile: null }))
        : [{ name: '', price: '', imageUrl: '', imageFile: null }],
    };
    this._vendor = vendor;
    this._renderShopEditor();
    document.getElementById('profile-site-panel')?.classList.add('open', 'shop-mode');
    MapDepict?.pulse?.(lat, lng, 0xff8844, this._shopDraft.name, 12000);
    Responsive3D?.visualReact?.('profile', { lat, lng });
  },

  _renderShopEditor() {
    const d = this._shopDraft;
    if (!d) return;
    const panel = document.getElementById('profile-site-panel');
    if (!panel) return;

    document.getElementById('ps-title').textContent = '🏬 Shop profile';
    document.getElementById('ps-sub').textContent = d.vendorId ? 'Edit your shop at this address' : 'New shop at this pin';
    const body = document.getElementById('ps-body');
    if (!body) return;

    const coverStyle = d.coverUrl ? ' style="background-image:url(' + this.esc(d.coverUrl) + ')"' : '';
    const avatarStyle = d.profileUrl ? ' style="background-image:url(' + this.esc(d.profileUrl) + ')"' : '';

    body.innerHTML = ''
      + '<div class="ps-shop-cover"' + coverStyle + '><button type="button" class="ps-shop-cover-btn" id="ps-shop-cover-pick">'
      + (d.coverUrl ? 'Change cover' : '+ Cover photo') + '</button>'
      + '<div class="ps-shop-avatar"' + avatarStyle + '><button type="button" class="ps-shop-avatar-btn" id="ps-shop-avatar-pick">'
      + (d.profileUrl ? '' : '📷') + '</button></div></div>'
      + '<input type="file" id="ps-shop-cover-in" accept="image/*" hidden />'
      + '<input type="file" id="ps-shop-avatar-in" accept="image/*" hidden />'
      + '<div class="ps-shop-addr">📍 ' + this.esc(this.formatCoords(d.lat, d.lng)) + '</div>'
      + '<label class="ps-field">Shop name<input id="ps-shop-name" value="' + this.esc(d.name) + '" /></label>'
      + '<label class="ps-field">Phone<input id="ps-shop-phone" type="tel" value="' + this.esc(d.phone) + '" /></label>'
      + '<label class="ps-field">Email<input id="ps-shop-email" type="email" value="' + this.esc(d.email) + '" /></label>'
      + '<label class="ps-field">About<textarea id="ps-shop-about" rows="2">' + this.esc(d.about) + '</textarea></label>'
      + '<div class="ps-menu-title">Menu · photo + price</div>'
      + '<div id="ps-menu-rows">' + this._shopMenuRowsHtml(d.menuRows) + '</div>'
      + '<button type="button" id="ps-menu-add">+ Add menu item</button>'
      + '<div class="ps-hint">Saved to map · customers order from your menu</div>';

    document.getElementById('ps-save').style.display = 'inline-block';
    document.getElementById('ps-save').textContent = 'Save shop';
    document.getElementById('ps-site-req').style.display = 'none';
    document.getElementById('ps-open-site').style.display = 'none';
    document.getElementById('ps-shop').style.display = d.vendorId ? 'inline-block' : 'none';
    document.getElementById('ps-logout').style.display = 'none';

    const statusEl = document.getElementById('ps-status');
    if (statusEl) statusEl.textContent = d.vendorId ? 'Editing existing shop' : 'Creates shop on save';

    this._bindShopEditor();
  },

  _shopMenuRowsHtml(rows) {
    return rows.map((row, i) => {
      const thumbStyle = row.imageUrl ? ' style="background-image:url(' + this.esc(row.imageUrl) + ')"' : '';
      return '<div class="ps-menu-row" data-menu-idx="' + i + '">'
        + '<div class="ps-menu-thumb"' + thumbStyle + '><input type="file" accept="image/*" data-menu-photo="' + i + '" title="Photo" /></div>'
        + '<input type="text" data-menu-name="' + i + '" placeholder="Item name" value="' + this.esc(row.name) + '" />'
        + '<input type="number" step="0.1" min="0" data-menu-price="' + i + '" placeholder="AVC" value="' + (row.price === '' ? '' : this.esc(String(row.price))) + '" />'
        + '<button type="button" class="ps-menu-rm" data-menu-rm="' + i + '" title="Remove">×</button>'
        + '</div>';
    }).join('');
  },

  _bindShopEditor() {
    const pickCover = () => document.getElementById('ps-shop-cover-in')?.click();
    const pickAvatar = () => document.getElementById('ps-shop-avatar-in')?.click();

    document.getElementById('ps-shop-cover-pick')?.addEventListener('click', pickCover);
    document.getElementById('ps-shop-avatar-pick')?.addEventListener('click', pickAvatar);

    document.getElementById('ps-shop-cover-in')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f || !this._shopDraft) return;
      this._shopDraft.coverFile = f;
      const url = URL.createObjectURL(f);
      this._shopDraft.coverUrl = url;
      const el = document.querySelector('.ps-shop-cover');
      if (el) { el.style.backgroundImage = 'url(' + url + ')'; el.querySelector('.ps-shop-cover-btn').textContent = 'Change cover'; }
    });

    document.getElementById('ps-shop-avatar-in')?.addEventListener('change', (e) => {
      const f = e.target.files?.[0];
      if (!f || !this._shopDraft) return;
      this._shopDraft.profileFile = f;
      const url = URL.createObjectURL(f);
      this._shopDraft.profileUrl = url;
      const el = document.querySelector('.ps-shop-avatar');
      if (el) { el.style.backgroundImage = 'url(' + url + ')'; }
    });

    document.getElementById('ps-menu-add')?.addEventListener('click', () => {
      if (!this._shopDraft) return;
      this._collectShopMenuFromDom();
      this._shopDraft.menuRows.push({ name: '', price: '', imageUrl: '', imageFile: null });
      const box = document.getElementById('ps-menu-rows');
      if (box) box.innerHTML = this._shopMenuRowsHtml(this._shopDraft.menuRows);
      this._bindShopMenuRows();
    });

    this._bindShopMenuRows();
  },

  _bindShopMenuRows() {
    document.querySelectorAll('[data-menu-photo]').forEach(inp => {
      inp.onchange = (e) => {
        const i = parseInt(inp.dataset.menuPhoto, 10);
        const f = e.target.files?.[0];
        if (!f || !this._shopDraft?.menuRows[i]) return;
        this._shopDraft.menuRows[i].imageFile = f;
        const url = URL.createObjectURL(f);
        this._shopDraft.menuRows[i].imageUrl = url;
        const thumb = inp.closest('.ps-menu-thumb');
        if (thumb) thumb.style.backgroundImage = 'url(' + url + ')';
      };
    });
    document.querySelectorAll('[data-menu-rm]').forEach(btn => {
      btn.onclick = () => {
        const i = parseInt(btn.dataset.menuRm, 10);
        if (!this._shopDraft) return;
        this._collectShopMenuFromDom();
        this._shopDraft.menuRows.splice(i, 1);
        if (!this._shopDraft.menuRows.length) {
          this._shopDraft.menuRows.push({ name: '', price: '', imageUrl: '', imageFile: null });
        }
        const box = document.getElementById('ps-menu-rows');
        if (box) box.innerHTML = this._shopMenuRowsHtml(this._shopDraft.menuRows);
        this._bindShopMenuRows();
      };
    });
  },

  _collectShopMenuFromDom() {
    if (!this._shopDraft) return;
    this._shopDraft.menuRows.forEach((row, i) => {
      row.name = document.querySelector('[data-menu-name="' + i + '"]')?.value?.trim() || row.name || '';
      const p = document.querySelector('[data-menu-price="' + i + '"]')?.value;
      row.price = p === '' || p == null ? row.price : parseFloat(p);
    });
  },

  _collectShopDraft() {
    const d = this._shopDraft;
    if (!d) return null;
    this._collectShopMenuFromDom();
    d.name = document.getElementById('ps-shop-name')?.value?.trim() || d.name || 'My shop';
    d.phone = document.getElementById('ps-shop-phone')?.value?.trim() || '';
    d.email = document.getElementById('ps-shop-email')?.value?.trim() || '';
    d.about = document.getElementById('ps-shop-about')?.value?.trim() || '';
    return d;
  },

  async saveShop() {
    if (!Auth?.user || !this._shopMode) return;
    const d = this._collectShopDraft();
    if (!d) return;

    const statusEl = document.getElementById('ps-status');
    if (statusEl) statusEl.textContent = 'Saving shop…';
    GlobeDeck?.setThinking?.(true, 'Saving shop…');

    try {
      let coverUrl = d.coverUrl;
      let profileUrl = d.profileUrl;
      if (d.coverFile) coverUrl = await this._uploadShopImage(d.coverFile);
      if (d.profileFile) profileUrl = await this._uploadShopImage(d.profileFile);

      const items = [];
      for (const row of d.menuRows) {
        const name = String(row.name || '').trim();
        if (!name) continue;
        let image = row.imageUrl || '';
        if (row.imageFile) image = await this._uploadShopImage(row.imageFile);
        else if (image.startsWith('blob:')) image = '';
        const price = parseFloat(row.price);
        const item = { name, price: isNaN(price) ? 0 : price };
        if (image && !image.startsWith('blob:')) item.image = image;
        items.push(item);
      }

      const tags = {
        cover_url: coverUrl && !coverUrl.startsWith('blob:') ? coverUrl : '',
        profile_url: profileUrl && !profileUrl.startsWith('blob:') ? profileUrl : '',
        phone: d.phone,
        email: d.email,
        about: d.about,
        updated_at: new Date().toISOString(),
      };

      const headers = await Auth.authHeaders();
      let vendorId = d.vendorId;

      if (!vendorId) {
        vendorId = 'v-' + Auth.user.id.slice(0, 8) + '-' + Date.now().toString(36);
        const body = {
          id: vendorId,
          owner_id: Auth.user.id,
          name: d.name,
          emoji: '🏬',
          lat: d.lat,
          lng: d.lng,
          country: 'GR',
          city: 'field',
          items,
          tags,
          is_active: true,
          delivery_enabled: true,
          category: 'field_shop',
        };
        const r = await fetch(SB_URL + '/rest/v1/vendors', { method: 'POST', headers, body: JSON.stringify(body) });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.message || j.error || 'shop create failed');
        }
      } else {
        const r = await fetch(SB_URL + '/rest/v1/vendors?id=eq.' + encodeURIComponent(vendorId), {
          method: 'PATCH',
          headers: { ...headers, Prefer: 'return=representation' },
          body: JSON.stringify({
            name: d.name,
            lat: d.lat,
            lng: d.lng,
            items,
            tags,
            updated_at: new Date().toISOString(),
          }),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.message || j.error || 'shop update failed');
        }
      }

      const profPage = {
        contact: { phone: d.phone, email: d.email },
        about: d.about,
        updated_at: new Date().toISOString(),
      };
      await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + Auth.user.id, {
        method: 'PATCH', headers,
        body: JSON.stringify({
          phone: d.phone || null,
          public_email: d.email || null,
          bio: d.about || undefined,
          profile_page: profPage,
          is_vendor: true,
          updated_at: new Date().toISOString(),
        }),
      });

      const roles = Array.from(new Set([...(FieldBrain?.roles || ['client']), 'vendor']));
      if (!roles.includes('vendor')) roles.push('vendor');
      await fetch(SB_URL + '/rest/v1/profiles?id=eq.' + Auth.user.id, {
        method: 'PATCH', headers,
        body: JSON.stringify({ roles, is_vendor: true }),
      });
      FieldBrain.roles = roles;
      FieldBrain?.updateChip?.();

      await Commerce?.loadVendors?.();
      MapDepict?.pulse?.(d.lat, d.lng, 0xff8844, d.name, 16000);
      GlobeEntity?.syncVendors?.(Commerce?.vendors || []);
      MapPins?.syncGlobe?.();
      CityMap?.syncMapPins?.();

      d.vendorId = vendorId;
      d.coverUrl = tags.cover_url;
      d.profileUrl = tags.profile_url;
      d.coverFile = null;
      d.profileFile = null;
      d.menuRows = items.length
        ? items.map(i => ({ name: i.name, price: i.price, imageUrl: i.image || '', imageFile: null }))
        : [{ name: '', price: '', imageUrl: '', imageFile: null }];

      if (statusEl) statusEl.textContent = '✓ Shop saved on map';
      ACIControl?.reply('Shop saved — cover, menu & prices live at ' + this.formatCoords(d.lat, d.lng));
      AciCli?.print('shop profile saved · ' + d.name + ' · ' + items.length + ' items', 'ok');
      document.getElementById('ps-shop').style.display = 'inline-block';
      this._vendor = { id: vendorId, name: d.name, lat: d.lat, lng: d.lng, items, tags, owner_id: Auth.user.id, emoji: '🏬', delivery_enabled: true, category: 'shop' };
      FieldBrain.vendorIds = Array.from(new Set([...(FieldBrain?.vendorIds || []), vendorId]));
      VendorMapTile?.open?.(this._vendor, { preview: true, skipFly: false });
    } catch (e) {
      if (statusEl) statusEl.textContent = 'Save failed';
      ACIControl?.reply('Shop save failed: ' + (e.message || e));
    } finally {
      GlobeDeck?.setThinking?.(false);
    }
  },

  async openSelf() {
    if (!Auth?.user) return Auth?.openLoginModal?.('Sign in to edit your profile page');
    await this.openUser(Auth.user.id);
  },

  async cmd(parts) {
    const sub = (parts[1] || 'me').toLowerCase();
    if (sub === 'me' || sub === 'edit') return this.openSelf();
    if (sub === 'shop') {
      const pos = window._pendingShopLatLng || window._lastPos;
      if (pos?.lat != null) return this.openShopEditor(pos.lat, pos.lng);
      ACIControl?.reply('Tap map · Shop address to pin your shop first');
      return;
    }
    if (sub === 'save') {
      if (this._shopMode) return this.saveShop();
      return this.save();
    }
    const name = parts.slice(1).join(' ').toLowerCase();
    const hit = (window.others || []).find(u => (u.name || '').toLowerCase().includes(name));
    if (hit?.id) return this.openUser(hit.id);
    ACIControl?.reply('profile me · profile save · tap a player on map');
  },
};

window.ProfileSite = ProfileSite;

// === ASTRANOV SITES PROVISION — instant {slug}.astranov.eu web presence ===
const AstranovSitesProvision = {
  BASE_DOMAIN: 'astranov.eu',

  slugify(text) {
    return String(text || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 32);
  },

  parseAsk(text) {
    const raw = String(text || '').trim();
    const low = raw.toLowerCase();
    const m = raw.match(/(?:create|make|start|open|provision|build)\s+(?:my\s+)?(?:astranov\s+)?(?:sites?|shop|page|presence|profile|booking|superbook(?:er|ing)?)\s*(?:at|on|for)?\s*([a-z0-9][a-z0-9-]{1,30}[a-z0-9])?/i)
      || raw.match(/([a-z0-9][a-z0-9-]{1,30}[a-z0-9])\.astranov\.eu/i)
      || raw.match(/(?:^|\s)([a-z0-9][a-z0-9-]{2,30}[a-z0-9])(?:\s|$)/i);
    let slug = m?.[1] ? this.slugify(m[1]) : '';
    let name = '';
    if (/diving|scuba|dive/.test(low)) name = 'Diving school';
    else if (/yacht|charter|boat/.test(low)) name = 'Yacht charter';
    else if (/restaurant|tavern|food|cafe/.test(low)) name = 'Restaurant';
    else if (/hotel|rooms|stay/.test(low)) name = 'Hotel';
    else if (/rental|car/.test(low)) name = 'Rental';
    const businessType = /yacht|charter|boat/.test(low) ? 'yacht_charter'
      : /diving|scuba/.test(low) ? 'diving_school'
      : /restaurant|tavern|food|cafe/.test(low) ? 'restaurant'
      : /hotel/.test(low) ? 'hotel'
      : /rental|car/.test(low) ? 'rental_car'
      : 'generic';
    const mode = /charter|yacht|week|range/.test(low) ? 'range' : 'slot';
    if (!slug) {
      const words = raw.replace(/\.astranov\.eu/gi, '').split(/\s+/).filter(w => w.length > 2 && !/^(my|the|a|an|for|at|on|create|make|site|sites|shop|page|astranov)$/i.test(w));
      slug = this.slugify(words.slice(0, 2).join('-') || Auth?.user?.email?.split('@')[0] || 'my-place');
    }
    if (!name) name = slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { slug, name, businessType, mode };
  },

  async provision(opts = {}) {
    if (!Auth?.user) {
      Auth?.openLoginModal?.('Sign in to provision site');
      throw new Error('Sign in (G) to create your Astranov Site.');
    }
    const slug = this.slugify(opts.slug);
    if (!slug || slug.length < 3) throw new Error('Choose a subdomain (3+ letters, e.g. my-shop).');

    const pos = window._lastPos || {};
    const headers = await Auth.authHeaders();
    const r = await fetch(SB_URL + '/functions/v1/site-provision', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        slug,
        business_name: opts.business_name || opts.name || slug,
        business_type: opts.business_type || 'generic',
        mode: opts.mode || 'slot',
        vendor_id: opts.vendor_id || null,
        lat: pos.lat,
        lng: pos.lng,
        branding: opts.branding || {},
        contact: opts.contact || {},
      }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(j.error || j.message || 'Site provision failed');

    if (j.pending_approval) {
      ACIControl?.reply('Subdomain ' + (j.domain || j.slug + '.astranov.eu') + ' requested — pending admin approval. Profile page is live on map.');
      AciCli?.print('site pending approval · ' + j.slug, 'dim');
      return j;
    }
    this._onLive(j, opts);
    return j;
  },

  _onLive(result, opts = {}) {
    const url = result.url || ('https://' + (result.domain || result.slug + '.astranov.eu'));
    const pos = window._lastPos || { lat: 36.44, lng: 28.22 };
    const title = opts.business_name || result.slug;

    GlobeEntity?.register?.({
      id: 'site-' + result.site_id,
      type: 'place',
      lat: pos.lat,
      lng: pos.lng,
      title,
      subtitle: result.domain,
      actionLabel: 'Open site',
      onTap: () => (window.AstranovSiteShell?.open ? AstranovSiteShell.open(url, { domain: result.domain, site_id: result.site_id, title }) : window.open(url, '_blank', 'noopener')),
      urgency: 2,
    });

    MapDepict?.pulse?.(pos.lat, pos.lng, 0x49b7ff, title + ' · live', 14000);
    FieldBrain?.pulse?.('commerce', 'astranov site live · ' + result.domain, { role: 'client', props: { site_id: result.site_id } });
    AciCli?.print('Astranov Site live → ' + url, 'ok');
    ACIControl?.reply('Your Astranov Site is live: ' + url);
    GlobeDeck?.setPreview?.('◎ ' + result.domain);
    if (window.AstranovSiteShell?.open) AstranovSiteShell.open(url, { domain: result.domain, site_id: result.site_id, title });
  },

  async cli(parts) {
    const sub = (parts[1] || 'create').toLowerCase();
    if (sub === 'list' || sub === 'mine') {
      if (!Auth?.user) return { error: 'login_required' };
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/booker_sites?select=id,slug,domain,business_type,mode,active&owner_id=eq.' + Auth.user.id + '&order=created_at.desc', { headers });
      const rows = r.ok ? await r.json() : [];
      return { sites: rows };
    }
    if (sub === 'open' && parts[2]) {
      const slug = this.slugify(parts[2]);
      const url = 'https://' + slug + '.' + this.BASE_DOMAIN;
      if (window.AstranovSiteShell?.open) AstranovSiteShell.open(url, { domain: slug + '.' + this.BASE_DOMAIN, title: slug });
      return { url };
    }
    if (sub === 'approve' && parts[2]) {
      if (!Auth?.isOwner) return { error: 'admin_required' };
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/rpc/booker_approve_site', {
        method: 'POST', headers,
        body: JSON.stringify({ p_site_id: parts[2], p_approve: parts[3] !== 'reject' }),
      });
      const j = r.ok ? await r.json() : {};
      ACIControl?.reply(r.ok ? 'Site ' + parts[2] + ' approved' : (j.message || 'approve failed'));
      return j;
    }
    if (sub === 'create' || sub === 'open' || sub === 'provision') {
      const slug = parts[2] || '';
      const name = parts.slice(3).join(' ') || slug;
      return this.provision({ slug, business_name: name });
    }
    return { error: 'usage: site create <slug> [name] | site list  (aliases: sites, book)' };
  },
};
window.SuperBookingProvision = AstranovSitesProvision;
window.AstranovSitesProvision = AstranovSitesProvision;

// === AVC BALANCE — live wallet chip in top CLI row (1 AVC = 1 EUR · USD via live FX) ===
const AvcBalance = {
  _btn: null,
  _timer: null,
  _last: null,
  _fx: null,
  _fxAt: 0,
  EUR_USD_FALLBACK: 1.08,

  formatFiat(n, symbol) {
    const v = Number(n);
    if (!Number.isFinite(v)) return symbol + '…';
    if (v >= 10000) return symbol + (v / 1000).toFixed(1) + 'k';
    if (v >= 1000) return symbol + v.toFixed(0);
    return symbol + v.toFixed(1);
  },

  async fetchFx() {
    const now = Date.now();
    if (this._fx && now - this._fxAt < 3600000) return this._fx;
    try {
      const r = await fetch('https://api.frankfurter.app/latest?from=EUR&to=USD', {
        headers: { Accept: 'application/json' },
      });
      if (r.ok) {
        const data = await r.json();
        const rate = Number(data?.rates?.USD);
        if (rate > 0) {
          this._fx = rate;
          this._fxAt = now;
          return rate;
        }
      }
    } catch (_) {}
    return this._fx || this.EUR_USD_FALLBACK;
  },

  render(balance, guest, eurUsd) {
    const btn = this._btn || document.getElementById('aci-avc');
    if (!btn) return;
    this._btn = btn;
    const isGuest = guest || !Auth?.user;
    const avc = Number(balance || 0);
    const fx = eurUsd || this._fx || this.EUR_USD_FALLBACK;
    const avcTxt = isGuest ? '— AVC' : (avc >= 10000 ? (avc / 1000).toFixed(1) + 'k AVC' : avc.toFixed(1) + ' AVC');
    const eurTxt = isGuest ? '€—' : this.formatFiat(avc, '€');
    const usdTxt = isGuest ? '$—' : this.formatFiat(avc * fx, '$');
    let emoji = btn.querySelector('.avc-emoji');
    let coreEl = btn.querySelector('.avc-core');
    let eurEl = btn.querySelector('.avc-eur');
    let usdEl = btn.querySelector('.avc-usd');
    if (!emoji || !coreEl || !eurEl || !usdEl) {
      btn.innerHTML = '<span class="avc-emoji">◎</span><span class="avc-core"></span><span class="avc-fiat"><span class="avc-eur"></span><span class="avc-usd"></span></span>';
      btn.classList.add('app-shortcut-btn');
      btn.hidden = false;
      emoji = btn.querySelector('.avc-emoji');
      coreEl = btn.querySelector('.avc-core');
      eurEl = btn.querySelector('.avc-eur');
      usdEl = btn.querySelector('.avc-usd');
    }
    if (emoji) emoji.textContent = '◎';
    if (coreEl) coreEl.textContent = avcTxt;
    if (eurEl) eurEl.textContent = eurTxt;
    if (usdEl) usdEl.textContent = usdTxt;
    btn.title = isGuest
      ? 'AVC wallet · sign in to see € / $ balance'
      : avc.toFixed(2) + ' AVC · €' + avc.toFixed(2) + ' · $' + (avc * fx).toFixed(2)
        + ' · 1 AVC = 1 EUR · USD @ ' + fx.toFixed(4) + ' · tap for wallet';
    btn.classList.toggle('avc-guest', isGuest);
    btn.classList.toggle('avc-loaded', !isGuest);
    if (!isGuest && this._last != null && balance != null && Math.abs(avc - this._last) > 0.001) {
      btn.classList.add('avc-changed');
      clearTimeout(btn._chgT);
      btn._chgT = setTimeout(() => btn.classList.remove('avc-changed'), 1200);
    }
    if (!isGuest && balance != null) this._last = avc;
  },

  async refresh(opts) {
    opts = opts || {};
    if (opts.guest || !Auth?.user) {
      this.render(null, true);
      return 0;
    }
    const [bal, fx] = await Promise.all([
      window.Commerce?.fetchBalance ? window.Commerce.fetchBalance() : Promise.resolve(0),
      this.fetchFx(),
    ]);
    this.render(bal, false, fx);
    return bal;
  },

  init() {
    const btn = document.getElementById('aci-avc');
    if (!btn || btn._avcInit) return;
    btn._avcInit = true;
    this._btn = btn;
    btn.classList.add('app-shortcut-btn');
    btn.hidden = false;
    if (!btn._avcChipBound) {
      btn._avcChipBound = true;
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.SuperCli?.run?.('wallet');
      };
    }
    this.render(null, !Auth?.user);
    void this.refresh({ quiet: true });
    if (this._timer) clearInterval(this._timer);
    this._timer = setInterval(() => void this.refresh({ quiet: true }), 45000);
  },
};
window.AvcBalance = AvcBalance;

if (window.AuditorPortal) {
  Object.assign(window.AuditorPortal, {
    open(opts) {
      opts = opts || {};
      const tab = opts.tab || 'company';
      AstranovSiteShell?.close?.();
      const sess = window.Auth?.session;
      if (!sess?.access_token) {
        AciCli?.print?.('Συνδεθείτε πρώτα στο Astranov — μετά Λογιστές', 'warn');
        Auth?.openLoginModal?.('Σύνδεση για auditors.astranov.eu');
        return;
      }
      const url = 'https://auditors.astranov.eu/?tab=' + encodeURIComponent(tab) + '&from_app=1';
      let w = null;
      try { w = window.open(url, 'astranov_auditors'); } catch (_) {}
      if (!w) {
        const a = document.createElement('a');
        a.href = url;
        a.target = 'astranov_auditors';
        a.rel = 'noopener';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      const bridge = () => {
        const s = window.Auth?.session;
        if (!s?.access_token) return;
        const payload = { type: 'astranov-auth', access_token: s.access_token, refresh_token: s.refresh_token };
        try { if (w && !w.closed) w.postMessage(payload, 'https://auditors.astranov.eu'); } catch (_) {}
      };
      [400, 900, 1500, 3000, 5000, 8000].forEach((ms) => setTimeout(bridge, ms));
      AppShortcuts?.track?.('auditors', 'Auditors');
      SuperCli?.setContext?.('auditors');
      GlobeDeck?.setPreview?.('📊 auditors.astranov.eu · λογιστική');
      AciCli?.print?.('auditors.astranov.eu · πλήρης οθόνη · καθολικό Τ', 'ok');
    },
    async cli(parts) {
      const sub = String(parts[1] || 'open').toLowerCase();
      const tabMap = {
        open: 'company', dashboard: 'dashboard', ledger: 'ledger', trial: 'trial',
        balance: 'balance', invoices: 'invoices', tax: 'tax', mine: 'mine',
        ισολογισμός: 'balance', ισοζύγιο: 'trial', καθολικό: 'ledger', λογιστική: 'company',
      };
      const tab = tabMap[sub] || 'company';
      this.open({ tab });
    },
    syncGlobe() {},
  });
}

if (window.CoinPortal) {
  Object.assign(window.CoinPortal, {
    open(tab) {
      const path = tab === 'transparency' ? '/transparency' : '';
      const url = 'https://coin.astranov.eu' + path;
      if (window.AstranovSiteShell?.open) {
        AstranovSiteShell.open(url, { domain: 'coin.astranov.eu', title: 'AVC · Astranov Coin' });
      } else {
        window.open(url, '_blank', 'noopener');
      }
      AppShortcuts?.track?.('coin', 'AVC');
      SuperCli?.setContext?.('coin');
    },
    async cli(parts) {
      const sub = String(parts[1] || 'balance').toLowerCase();
      if (sub === 'open' || sub === 'wallet') {
        this.open('wallet');
        return;
      }
      const bal = await AvcBalance.refresh();
      const fx = await AvcBalance.fetchFx();
      const eur = Number(bal || 0);
      AciCli?.print?.('◎ ' + eur.toFixed(2) + ' AVC · €' + eur.toFixed(2) + ' · $' + (eur * fx).toFixed(2), 'ok');
      GlobeDeck?.setPreview?.('◎ €' + eur.toFixed(2) + ' · $' + (eur * fx).toFixed(2));
    },
    syncGlobe() {},
  });
}

// === ASTRANOV SITE SHELL — subdomains open over the globe (Earth browser) ===
const AstranovSiteShell = {
  active: null,

  init() {
    document.getElementById('as-shell-close')?.addEventListener('click', () => this.close());
    document.getElementById('as-shell-external')?.addEventListener('click', () => {
      if (this.active?.url) window.open(this.active.url, '_blank', 'noopener');
    });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this.active) this.close();
    });
    window.addEventListener('message', (e) => {
      if (e.data?.type === 'astranov-match-field-request') {
        AciCoders?.observeActivity?.('field_request', JSON.stringify(e.data.spec || {}).slice(0, 80), e.data);
        ACIControl?.reply('Field request from site — Coders notified');
        void AciCli?.api?.({ mode: 'coders_chat', message: 'Develop booking field for site ' + e.data.siteId + ': ' + JSON.stringify(e.data.spec), fast: false });
      }
    });
  },

  shellUrl(url) {
    const u = new URL(url, window.location.origin);
    u.searchParams.set('shell', '1');
    u.searchParams.set('embed', '1');
    return u.toString();
  },

  open(url, meta = {}) {
    const shell = document.getElementById('astranov-site-shell');
    const frame = document.getElementById('as-shell-frame');
    const domainEl = document.getElementById('as-shell-domain');
    if (!shell || !frame) {
      window.open(url, '_blank', 'noopener');
      return;
    }
    const full = url.startsWith('http') ? url : 'https://' + url;
    this.active = { url: full, ...meta };
    if (domainEl) domainEl.textContent = meta.domain || meta.title || new URL(full).hostname;
    frame.src = this.shellUrl(full);
    shell.classList.add('open');
    document.body.classList.add('site-shell-open');
    if (window.AIGraphics?.setSiteShellMode) AIGraphics.setSiteShellMode(true);
    GlobeDeck?.collapse?.();
    GlobeDeck?.setPreview?.('◎ ' + (meta.domain || full));
    AppShortcuts?.rememberSite?.({ url: full, ...meta });
    AppShortcuts?.track?.('site', meta.domain || meta.title || new URL(full).hostname);
    AciCli?.print?.('site shell · ' + (meta.domain || full), 'ok');
    setTimeout(() => Auth?.broadcastToShell?.(), 1200);
  },

  close() {
    const shell = document.getElementById('astranov-site-shell');
    const frame = document.getElementById('as-shell-frame');
    if (shell) shell.classList.remove('open');
    document.body.classList.remove('site-shell-open');
    if (frame) frame.src = 'about:blank';
    this.active = null;
    AppShortcuts?.untrack?.('site');
    if (window.AIGraphics?.setSiteShellMode) AIGraphics.setSiteShellMode(false);
    GlobeDeck?.setPreview?.('');
  },

  isOpen() { return !!this.active; }
};
window.AstranovSiteShell = AstranovSiteShell;

// === ORDER TRACKING — live status on globe + CLI (delivery parity) ===
const OrderTracking = {
  active: null,
  _poll: null,
  _vendorCache: new Map(),

  STATUS: {
    pending: { label: 'Pending', icon: '⏳', step: 0, color: 0xffaa33 },
    seeking_driver: { label: 'Finding driver', icon: '🔍', step: 1, color: 0xffaa33 },
    assigned: { label: 'Driver assigned', icon: '🚚', step: 2, color: 0x3d9eff },
    picked_up: { label: 'Picked up', icon: '📦', step: 3, color: 0x44ccff },
    en_route: { label: 'On the way', icon: '🛵', step: 4, color: 0x00ddff },
    delivered: { label: 'Delivered', icon: '✅', step: 5, color: 0x00ff88 },
    cancelled: { label: 'Cancelled', icon: '❌', step: -1, color: 0xff3344 },
  },

  FLOW: ['pending', 'seeking_driver', 'assigned', 'picked_up', 'en_route', 'delivered'],

  init() {
    if (Auth?.user) setTimeout(() => this.trackLatest({ quiet: true }), 3500);
  },

  meta(status) {
    return this.STATUS[status] || { label: status || 'Unknown', icon: '🛒', step: 0, color: 0x3d9eff };
  },

  async fetchOrder(idOrShort) {
    if (!Auth?.user) return null;
    const q = String(idOrShort || '').trim();
    if (!q) return null;
    try {
      const headers = await Auth.authHeaders();
      const isUuid = /^[0-9a-f-]{36}$/i.test(q);
      const filter = isUuid ? ('id=eq.' + q) : ('short_id=eq.' + q.toUpperCase());
      const r = await fetch(SB_URL + '/rest/v1/orders?select=*&customer_id=eq.' + Auth.user.id + '&' + filter + '&limit=1', { headers });
      if (!r.ok) return null;
      const rows = await r.json();
      return rows[0] || null;
    } catch { return null; }
  },

  async fetchLatest() {
    if (!Auth?.user) return null;
    try {
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/orders?select=*&customer_id=eq.' + Auth.user.id + '&order=created_at.desc&limit=1', { headers });
      if (!r.ok) return null;
      const rows = await r.json();
      return rows[0] || null;
    } catch { return null; }
  },

  async resolveVendor(vendorId) {
    if (!vendorId) return null;
    if (this._vendorCache.has(vendorId)) return this._vendorCache.get(vendorId);
    try {
      const r = await fetch(SB_URL + '/rest/v1/vendors?select=id,name,lat,lng,emoji&id=eq.' + encodeURIComponent(vendorId) + '&limit=1', {
        headers: { apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY },
      });
      const rows = r.ok ? await r.json() : [];
      const v = rows[0] || null;
      if (v) this._vendorCache.set(vendorId, v);
      return v;
    } catch { return null; }
  },

  onOrderPlaced(order, vendor, driver) {
    if (!order) return;
    this.active = order;
    this.showOnGlobe(order, vendor, driver);
    void MarketplaceDeliveryEngine?.onOrderPlaced?.(order, vendor, driver);
    this.startPoll();
    const m = this.meta(order.status);
    const msg = m.icon + ' Order ' + (order.short_id || order.id?.slice(0, 8)) + ' · ' + m.label
      + (driver?.name ? ' · ' + driver.name : '')
      + (order.driver_accepted_at ? '' : ' · tap route when driver accepts');
    GlobeDeck?.say?.(msg, 'ok');
    Responsive3D?.visualReact?.('order', { order, vendor, lat: order.delivery_lat, lng: order.delivery_lng });
  },

  showOnGlobe(order, vendor, driver) {
    if (!order) return;
    const st = this.meta(order.status);
    const dLat = order.delivery_lat;
    const dLng = order.delivery_lng;
    const v = vendor || null;

    GlobeEntity?.unregisterType?.('order');
    GlobeEntity?.unregisterType?.('pilot');

    if (dLat != null && dLng != null) {
      GlobeEntity?.register?.({
        id: 'order-delivery',
        type: 'order',
        lat: dLat,
        lng: dLng,
        title: st.icon + ' ' + (order.short_id || 'Order'),
        description: st.label + ' · tap to track',
        urgency: order.status === 'delivered' ? 1 : 3,
        persist: true,
        data: { order, vendor: v },
        _actionLabel: 'Track order',
        onTap: () => this.flyToOrder(order, v),
      });
    }

    if (v?.lat != null && v?.lng != null) {
      GlobeEntity?.register?.({
        id: 'order-vendor',
        type: 'vendor',
        lat: v.lat,
        lng: v.lng,
        title: (v.emoji || '🏬') + ' ' + (v.name || 'Shop'),
        description: 'Order source · ' + st.label,
        urgency: 2,
        persist: true,
        data: { vendor: v, order },
        onTap: () => Commerce?.openVendor?.(v),
      });
    }

    if (driver?.field_lat != null && driver?.field_lng != null) {
      GlobeEntity?.register?.({
        id: 'order-driver',
        type: 'driver',
        lat: driver.field_lat,
        lng: driver.field_lng,
        title: (driver.avatar_emoji || '🚚') + ' ' + (driver.display_name || order.driver_name || 'Driver'),
        description: st.label + ' · your delivery',
        urgency: 3,
        persist: true,
        data: { driver, order },
        onTap: () => this.flyToOrder(order, v),
      });
    } else if (order.driver_name && dLat != null) {
      const off = 0.006;
      GlobeEntity?.register?.({
        id: 'order-driver',
        type: 'pilot',
        lat: dLat + off,
        lng: dLng - off,
        title: (order.driver_emoji || '🚚') + ' ' + order.driver_name,
        description: st.label,
        urgency: 2,
        persist: true,
        data: { order },
        onTap: () => this.flyToOrder(order, v),
      });
    }

    MapDepict?.action?.('order', {
      lat: dLat,
      lng: dLng,
      vendorLat: v?.lat,
      vendorLng: v?.lng,
      detail: (order.short_id || '') + ' · ' + st.label,
    });
  },

  async flyToOrder(order, vendor) {
    order = order || this.active;
    if (!order) return;
    const v = vendor || await this.resolveVendor(order.vendor_id);
    const dLat = order.delivery_lat ?? window._lastPos?.lat;
    const dLng = order.delivery_lng ?? window._lastPos?.lng;
    if (dLat == null) {
      ACIControl?.reply('No delivery coordinates on this order');
      return;
    }
    const dur = GlobeControl?.flyDuration?.(camera?.position?.z, GlobeControl?.Z?.national || 1.82) || 2200;
    GlobeControl?.flyToLatLng?.(dLat, dLng, this.meta(order.status).label, GlobeControl?.Z?.national || 1.82, { dur });
    if (v?.lat != null) {
      setTimeout(() => {
        MapDepict?.pulse?.(v.lat, v.lng, 0x3d9eff, v.name || 'Shop', 5000);
      }, dur * 0.55);
    }
    this.renderStatus(order, v);
    Responsive3D?.visualReact?.('track', { lat: dLat, lng: dLng, order });
  },

  renderStatus(order, vendor) {
    if (!order) return '';
    const m = this.meta(order.status);
    const items = Array.isArray(order.items) ? order.items : [];
    const total = order.calc?.total_avc ?? order.calc?.total_eur ?? items.reduce((s, i) => s + (i.qty || 1) * (i.price || 0), 0);
    const lines = [
      m.icon + ' ' + (order.short_id || order.id?.slice(0, 8)) + ' · ' + m.label,
      (vendor?.name || order.vendor_id || 'vendor') + ' · ' + Number(total).toFixed(1) + ' AVC',
    ];
    if (order.driver_name) lines.push('Driver: ' + order.driver_name);
    const step = m.step;
    if (step >= 0) {
      const bar = this.FLOW.map((s, i) => (i <= step ? '●' : '○')).join(' ');
      lines.push(bar);
    }
    const msg = lines.join('\n');
    ACIControl?.reply(msg);
    AciCli?.print(msg, 'ok');
    GlobeDeck?.setPreview?.(m.icon + ' ' + m.label + ' · ' + (order.short_id || ''));
    return msg;
  },

  async refresh(opts) {
    opts = opts || {};
    const order = this.active?.id
      ? await this.fetchOrder(this.active.short_id || this.active.id)
      : await this.fetchLatest();
    if (!order) {
      if (!opts.quiet) ACIControl?.reply('No orders yet — say: order pitogyra mpironia');
      return null;
    }
    const prev = this.active?.status;
    this.active = order;
    const vendor = await this.resolveVendor(order.vendor_id);
    let driver = null;
    if (order.driver_id) {
      try {
        const headers = await Auth.authHeaders();
        const r = await fetch(SB_URL + '/rest/v1/profiles?select=id,display_name,avatar_emoji,field_lat,field_lng&id=eq.' + order.driver_id + '&limit=1', { headers });
        const rows = r.ok ? await r.json() : [];
        driver = rows[0] || null;
      } catch { /* */ }
    }
    this.showOnGlobe(order, vendor, driver);
    const v = vendor || await this.resolveVendor(order.vendor_id);
    if (order.driver_accepted_at && (order.status === 'active' || order.status === 'en_route' || order.status === 'picked_up')) {
      void MarketplaceDeliveryEngine?.onDriverAccepted?.(order, v, driver);
    } else if (order.status !== 'delivered' && order.status !== 'cancelled') {
      void MarketplaceDeliveryEngine?.onOrderPlaced?.(order, v, driver);
    }
    if (!opts.quiet && prev && prev !== order.status) {
      const m = this.meta(order.status);
      GlobeDeck?.say?.(m.icon + ' ' + (order.short_id || '') + ' → ' + m.label, 'ok');
      if (Voice.maySpeak?.()) speak(m.label, () => resumeListening?.());
      Responsive3D?.visualReact?.('order_update', { order, lat: order.delivery_lat, lng: order.delivery_lng });
    }
    if (order.status === 'delivered' || order.status === 'cancelled') this.stopPoll();
    return order;
  },

  startPoll() {
    this.stopPoll();
    this._poll = setInterval(() => this.refresh({ quiet: true }), 14000);
  },

  stopPoll() {
    if (this._poll) { clearInterval(this._poll); this._poll = null; }
  },

  async trackLatest(opts) {
    opts = opts || {};
    const order = await this.fetchLatest();
    if (!order) {
      if (!opts.quiet) ACIControl?.reply('No active orders — order from CLI or tap a shop');
      return null;
    }
    this.active = order;
    const vendor = await this.resolveVendor(order.vendor_id);
    await this.flyToOrder(order, vendor);
    if (order.status !== 'delivered' && order.status !== 'cancelled') this.startPoll();
    return order;
  },

  async trackId(id) {
    const order = await this.fetchOrder(id);
    if (!order) {
      ACIControl?.reply('Order not found: ' + id);
      return null;
    }
    this.active = order;
    const vendor = await this.resolveVendor(order.vendor_id);
    await this.flyToOrder(order, vendor);
    if (order.status !== 'delivered' && order.status !== 'cancelled') this.startPoll();
    return order;
  },

  async cli(parts) {
    const sub = (parts[1] || 'status').toLowerCase();
    const arg = parts.slice(2).join(' ').trim();
    if (sub === 'track' || sub === 'fly') {
      if (arg) return this.trackId(arg);
      return this.trackLatest();
    }
    if (sub === 'status' || sub === 'last' || sub === 'active') {
      const order = arg ? await this.fetchOrder(arg) : (this.active || await this.fetchLatest());
      if (!order) {
        ACIControl?.reply('No orders — say: order pitogyra mpironia');
        return;
      }
      this.active = order;
      const vendor = await this.resolveVendor(order.vendor_id);
      this.showOnGlobe(order, vendor, null);
      this.renderStatus(order, vendor);
      if (order.status !== 'delivered' && order.status !== 'cancelled') this.startPoll();
      return;
    }
    if (sub === 'list') {
      if (!Auth?.user) return Auth?.openLoginModal?.();
      const headers = await Auth.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/orders?select=short_id,status,created_at&customer_id=eq.' + Auth.user.id + '&order=created_at.desc&limit=8', { headers });
      const rows = r.ok ? await r.json() : [];
      if (!rows.length) { ACIControl?.reply('No orders yet'); return; }
      rows.forEach(o => {
        const m = this.meta(o.status);
        AciCli?.print(m.icon + ' ' + o.short_id + ' · ' + m.label, 'ok');
      });
      return;
    }
    ACIControl?.reply('order status · order track · order track ORD-xxx · order list');
  },
};

window.OrderTracking = OrderTracking;

// === 3D RESPONSIVENESS — instant ack + parallel fast think (CLI · voice · globe) ===
const Responsive3D = {
  FAST_MS: 8000,
  _pending: 0,
  _origThink: null,
  _origConverse: null,

  ACKS: [
    '◎ On it…',
    '◎ Globe synced…',
    '◎ Thinking fast…',
    '◎ 3D path active…',
    '◎ Collective pulse…',
  ],

  init() {
    this._wrapACI();
    this._wrapBrain();
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden && OrderTracking?.active) OrderTracking.refresh({ quiet: true });
    });
  },

  _pickAck(text) {
    const low = String(text || '').toLowerCase();
    if (/order|παραγγελ|delivery|διανομ/.test(low)) return '🛒 Tracking on globe…';
    if (/locate|gps|where|που/.test(low)) return '📍 Flying to you…';
    if (/profile|login|account|ρόλ/.test(low)) return '👤 Profile orbit…';
    if (/coin|wallet|avc|balance/.test(low)) return '◎ AVC pulse…';
    return this.ACKS[this._pending % this.ACKS.length];
  },

  instantAck(text, source) {
    const ack = this._pickAck(text);
    this._pending++;
    GlobeDeck?.say?.(ack, 'dim');
    CliRibbon?.setNotice?.(ack);
    const pos = window._lastPos || { lat: 36.44, lng: 28.22 };
    MapDepict?.pulse?.(pos.lat, pos.lng, 0x3d9eff, ack.replace(/^[^\s]+\s*/, ''), 2800);
    if (source === 'voice' && Voice.maySpeak?.()) {
      speak(ack.replace(/◎\s*/, '').slice(0, 48), () => {}, true);
    }
    return ack;
  },

  visualReact(kind, opts) {
    opts = opts || {};
    const lat = opts.lat ?? opts.order?.delivery_lat ?? window._lastPos?.lat;
    const lng = opts.lng ?? opts.order?.delivery_lng ?? window._lastPos?.lng;
    if (lat == null) return;

    const colors = {
      think: 0x3d9eff,
      order: 0x00ddff,
      order_update: 0x00ff88,
      track: 0x44ccff,
      profile: 0x49b7ff,
      voice: 0x69f5d0,
    };
    const color = colors[kind] || 0x3d9eff;
    MapDepict?.pulse?.(lat, lng, color, kind, 4200);

    if (kind === 'profile' || kind === 'track' || kind === 'order') {
      const z = kind === 'profile' ? (GlobeControl?.Z?.national || 1.82) : (GlobeControl?.Z?.regional || 1.65);
      const dur = GlobeControl?.flyDuration?.(camera?.position?.z, z) || 2200;
      GlobeControl?.flyToLatLng?.(lat, lng, kind, z, { dur });
    }

    if (window.AIGraphics && kind === 'think') {
      const p = latLngToPos(lat, lng, 1.05);
      AIGraphics.spawnEffect(new THREE.Vector3(p.x, p.y, p.z), color, 4, 14);
    }
  },

  _wrapACI() {
    if (!window.ACI || this._origThink) return;
    this._origThink = ACI.think.bind(ACI);
    ACI.think = async (prompt, opts = {}) => {
      if (!opts._noAck) {
        this.instantAck(prompt, opts.fromVoice ? 'voice' : 'cli');
        this.visualReact('think', {});
      }
      GlobeDeck?.setThinking(true, '◎ 3D think…');
      const out = await this._origThink(prompt, { ...opts, fast: true, _wrapped: true });
      GlobeDeck?.setThinking(false);
      return out;
    };
  },

  _wrapBrain() {
    if (!window.BrainConversation || this._origConverse) return;
    this._origConverse = BrainConversation.converse.bind(BrainConversation);
    BrainConversation.converse = async (text, opts = {}) => {
      const prompt = String(text || '').trim();
      if (!prompt) return '';
      const wantsThink = opts.forceThink || prompt.length > 20 || /[?]/.test(prompt)
        || /^(explain|why|how|what|tell|describe|ποιος|τι|γιατί|πες)\b/i.test(prompt);
      if (!wantsThink) return this._origConverse(text, opts);

      const local = BrainConversation._matchLocal(prompt);
      if (local && !opts.forceThink && prompt.length < 28) {
        ACI?.history?.push?.({ role: 'user', content: prompt });
        ACI?.history?.push?.({ role: 'assistant', content: local });
        ACIControl?.reply(local);
        return local;
      }

      if (window.ACI && this._origThink) {
        const out = await ACI.think(prompt, { fast: true, fromVoice: opts.fromVoice });
        if (out && !/^ACI error:/i.test(out)) return out;
      }
      return this._origConverse(text, { ...opts, forceThink: true });
    };
  },

  async fastConverse(text, opts = {}) {
    return BrainConversation?.converse?.(text, { ...opts, forceThink: true });
  },
};

window.Responsive3D = Responsive3D;

// === DEFERRED BOOT — init subsystems moved out of 99-boot.js ===
const DeferredBoot = {
  _done: false,

  run() {
    if (this._done) return;
    this._done = true;
    window._deferredBootDone = true;
    const sl = window.SlumberManager;
    const go = (id, fn) => { if (!sl || sl.shouldInit(id)) fn?.(); };

    go('celestial', () => window.CelestialNav?.init?.());
    go('globe', () => window.Responsive3D?.init?.());
    go('commerce', () => window.OrderTracking?.init?.());
    go('presence', () => window.AstranovSession?.init?.());
    go('presence', () => window.AstranovPresence?.init?.());
    go('cli', () => window.ProfileSite?.init?.());
    go('coders_ping', () => window.CodersHub?.init?.());
    go('lab_orbs', () => window.LabOrbs?.init?.());
    go('cli', () => window.SuperCli?.initBrain?.());
    go('globe', () => window.TelemachosPilot?.init?.());
    go('globe', () => window.DrivingView?.init?.());
    go('avc_balance', () => window.AvcBalance?.init?.());
    void window.AvcBalance?.refresh?.();

    if (sl?.allows('commerce')) {
      const bootCommerce = () => {
        const c = window.Commerce;
        if (!c?.loadVendors) return;
        c.loadVendors().then(() => {
          c.initUI?.();
          c.showOnGlobe?.();
          window.AstranovPresence?.refresh?.();
          MapDepict?.setHud?.('Business map', (c.vendors?.length || 0) + ' vendors · tap shop · order via deck');
        }).catch(() => {});
      };
      const boot = () => {
        bootCommerce();
        AstranovCityShop?.loadPersisted?.();
        AvcBalance?.init?.();
        const u = window._lastPos;
        if (u?.lat != null) void AstranovCityShop?.placeForUser?.(u.lat, u.lng);
        void AvcBalance?.refresh?.();
      };
      boot();
      setTimeout(boot, sl?.tier === 'slumber' ? 800 : 200);
    }

    const p = new URLSearchParams(location.search);
    if (p.get('open') === 'auditors') {
      const tab = p.get('tab') || 'company';
      p.delete('open');
      const qs = p.toString();
      history.replaceState(null, '', location.pathname + (qs ? '?' + qs : ''));
      setTimeout(() => window.AuditorPortal?.open?.({ tab }), 900);
    }
  },
};
window.DeferredBoot = DeferredBoot;
DeferredBoot.run();
