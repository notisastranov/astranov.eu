// === ASTRANOV SESSION — one user, one session, all devices ===
const COLLECTIVE_SESSION_NAME = 'ASTRANOV COLLECTIVE INTELLIGENCE';

const AstranovSession = {
  DEVICE_KEY: 'astranov_device_id',
  LOCAL_KEY: 'astranov_globe_session_v1',
  SESSION_NAME: COLLECTIVE_SESSION_NAME,
  _deviceId: null,
  _syncTimer: null,
  _lastPull: 0,
  _lastRemote: null,

  init() {
    this._deviceId = this._loadDeviceId();
    this._applyIdentity();
    if (Auth?.client) {
      Auth.client.auth.onAuthStateChange(() => this.onAuth());
    }
    setTimeout(() => this.onAuth(), 600);
    this._syncTimer = setInterval(() => this.push(), 45000);
    window.addEventListener('beforeunload', () => this.push(true));
  },

  _loadDeviceId() {
    try {
      let id = localStorage.getItem(this.DEVICE_KEY);
      if (!id) {
        id = 'dev-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        localStorage.setItem(this.DEVICE_KEY, id);
      }
      return id;
    } catch {
      return 'dev-anon';
    }
  },

  deviceId() {
    return this._deviceId || this._loadDeviceId();
  },

  identity() {
    if (Auth?.user?.id) {
      const isOwner = Auth.isOwner || Auth.isArchitect
        || (Auth.user.email || '').toLowerCase() === (Auth.OWNER_EMAIL || '').toLowerCase();
      const name = isOwner ? 'ASTRANOV' : (
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
        isOwner,
        email: Auth.user.email,
        sessionName: this.SESSION_NAME,
      };
    }
    return { userId: 'guest-' + this.deviceId(), name: 'Αξάς', deviceId: this.deviceId(), isGuest: true, sessionName: this.SESSION_NAME };
  },

  nodeStorageKey() {
    const uid = Auth?.user?.id || 'guest';
    return 'astranov_node_' + uid.slice(0, 8) + '_' + this.deviceId();
  },

  getDeviceNodeId() {
    try {
      const key = this.nodeStorageKey();
      let id = localStorage.getItem(key);
      if (!id && Auth?.user?.id) {
        id = 'node-' + Auth.user.id.slice(0, 8) + '-' + this.deviceId().slice(0, 10);
        localStorage.setItem(key, id);
      }
      return id;
    } catch {
      return null;
    }
  },

  _applyIdentity() {
    const id = this.identity();
    if (typeof me !== 'undefined') {
      if (!me) window.me = me = {};
      me.id = id.userId;
      me.name = id.name;
      me.deviceId = id.deviceId;
      me.isGuest = id.isGuest;
      if (id.email) me.email = id.email;
    }
    window._astranovIdentity = id;
  },

  capture() {
    return {
      userId: Auth?.user?.id || null,
      deviceId: this.deviceId(),
      sessionName: this.SESSION_NAME,
      updatedAt: Date.now(),
      lastPos: window._lastPos || null,
      batchId: AstranovNode?.batchId || null,
      shortId: AstranovNode?.shortId || null,
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
    this._lastRemote = session;
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
    this._applyIdentity();
    if (Auth?.user) {
      SessionHold?.clearForeignHold?.();
      await this.pull();
      await AstranovNode?.resumeSession?.();
      setTimeout(() => AstranovWishlist?.announceRecovered?.(), 900);
      GlobeDeck?.setTitle?.(this.SESSION_NAME);
    } else {
      this._applyLocal();
    }
    if (window._lastPos && GlobeEntity?.syncMe) {
      GlobeEntity.syncMe(_lastPos.lat, _lastPos.lng, me?.name || 'You');
    }
    showOtherUsers?.();
  },

  _localKey() {
    const uid = Auth?.user?.id || 'guest-' + this.deviceId();
    return this.LOCAL_KEY + '_' + uid;
  },

  _applyLocal() {
    try {
      const raw = localStorage.getItem(this._localKey());
      if (raw) this.applyRemote(JSON.parse(raw));
    } catch (_) {}
  },

  async pull() {
    if (!Auth?.user || !AstranovNode?.api) return;
    if (Date.now() - this._lastPull < 8000) return;
    this._lastPull = Date.now();
    try {
      const r = await AstranovNode.api({ action: 'session_get' });
      if (r.ok && r.session) {
        this.applyRemote(r.session);
        try { localStorage.setItem(this._localKey(), JSON.stringify(r.session)); } catch (_) {}
      }
    } catch (e) {
      console.warn('[AstranovSession] pull failed', e.message || e);
    }
  },

  async push(force) {
    const snap = this.capture();
    try { localStorage.setItem(this._localKey(), JSON.stringify(snap)); } catch (_) {}
    if (!Auth?.user || !AstranovNode?.api) return;
    if (!force && document.hidden) return;
    try {
      await AstranovNode.api({ action: 'session_save', session: snap });
    } catch (_) {}
  },
};
window.AstranovSession = AstranovSession;