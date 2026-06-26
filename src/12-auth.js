// === ASTRANOV IDENTITY — one person across devices (guest device id → auth profile) ===
const AstranovIdentity = {
  DEVICE_KEY: 'astranov_device_id_v1',
  NODE_KEY: 'astranov_node_id',

  _uuid() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
      const r = Math.random() * 16 | 0;
      return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
  },

  deviceId() {
    try {
      let id = localStorage.getItem(this.DEVICE_KEY);
      if (!id) {
        id = localStorage.getItem(this.NODE_KEY) || ('dev-' + this._uuid());
        localStorage.setItem(this.DEVICE_KEY, id);
        if (!localStorage.getItem(this.NODE_KEY)) localStorage.setItem(this.NODE_KEY, id);
      }
      return id;
    } catch {
      return 'dev-fallback';
    }
  },

  cliKey(userId) {
    return userId ? ('aci-cli-' + userId) : ('aci-cli-guest-' + this.deviceId());
  },

  deckKey(userId) {
    return userId ? ('deck-log-' + userId) : ('deck-log-guest-' + this.deviceId());
  },

  guestMe() {
    return { id: this.deviceId(), name: 'Αξάς', guest: true };
  },

  syncMe(user) {
    const target = (typeof me !== 'undefined' && me) ? me : (window.me = this.guestMe());
    if (user) {
      target.id = user.id;
      target.email = user.email;
      target.name = user.user_metadata?.full_name || user.user_metadata?.name
        || (user.email || '').split('@')[0] || 'User';
      target.guest = false;
      target.isOwner = !!(Auth?.isOwner);
    } else {
      const g = this.guestMe();
      target.id = g.id;
      target.name = g.name;
      target.guest = true;
      delete target.email;
      delete target.isOwner;
    }
    window.me = target;
    return target;
  },

  _readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  },

  _mergeUnique(...arrays) {
    const seen = new Set();
    const out = [];
    for (const arr of arrays) {
      for (const item of (arr || [])) {
        const k = typeof item === 'string' ? item : JSON.stringify(item);
        if (seen.has(k)) continue;
        seen.add(k);
        out.push(item);
      }
    }
    return out;
  },

  mergeLocalStores(userId) {
    if (!userId) return { cli: [], deck: [] };
    const targetCli = this.cliKey(userId);
    const targetDeck = this.deckKey(userId);
    const cliParts = [this._readJson(targetCli, [])];
    const deckParts = [this._readJson(targetDeck, [])];
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k === targetCli || k === targetDeck) continue;
        if (k === 'aci-cli-anon' || k.startsWith('aci-cli-guest-') || /^aci-cli-u\d+$/.test(k)) {
          cliParts.push(this._readJson(k, []));
        }
        if (k === 'deck-log-anon' || k.startsWith('deck-log-guest-')) {
          deckParts.push(this._readJson(k, []));
        }
      }
    } catch (_) {}
    const cli = this._mergeUnique(...cliParts).slice(-80);
    const deck = this._mergeUnique(...deckParts).slice(-48);
    try {
      localStorage.setItem(targetCli, JSON.stringify(cli));
      localStorage.setItem(targetDeck, JSON.stringify(deck));
    } catch (_) {}
    return { cli, deck };
  }
};
window.AstranovIdentity = AstranovIdentity;

// === ASTRANOV IDENTITY — unified login (globe + all *.astranov.eu sites) ===
const Auth = {
  client: null,
  user: null,
  session: null,
  isOwner: false,
  isArchitect: false,
  OWNER_EMAIL: 'notisastranov@gmail.com',
  OAUTH_PROVIDERS: ['google', 'facebook', 'apple', 'twitter'],
  _siteOwners: new Map(),

  init() {
    if (typeof supabase === 'undefined') {
      console.warn('[Auth] Supabase SDK missing — login unavailable');
      return;
    }
    this.client = supabase.createClient(SB_URL, SB_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'astranov_auth_v2' }
    });
    this.client.auth.onAuthStateChange((ev, session) => {
      this.session = session;
      this.user = session?.user || null;
      if (this.user && (ev === 'SIGNED_IN' || ev === 'INITIAL_SESSION')) {
        AstranovIdentity.mergeLocalStores(this.user.id);
      }
      this.applyUser();
      this.refreshAuthority();
      this.broadcastToShell();
    });
    this.client.auth.getSession().then(({ data }) => {
      this.session = data?.session || null;
      this.user = data?.session?.user || null;
      if (this.user) AstranovIdentity.mergeLocalStores(this.user.id);
      this.applyUser();
      this.refreshAuthority();
      this.broadcastToShell();
    });
    const btn = document.getElementById('aci-login');
    if (btn) btn.onclick = () => this.user ? this.signOut() : this.openLoginModal();
    this.bindAuthModal();
    window.addEventListener('message', e => this._onChildMessage(e));
  },

  bindAuthModal() {
    const modal = document.getElementById('astranov-auth-modal');
    if (!modal || modal.dataset.bound) return;
    modal.dataset.bound = '1';
    document.getElementById('auth-close')?.addEventListener('click', () => this.closeLoginModal());
    document.getElementById('auth-signin-btn')?.addEventListener('click', () => this.signInIdentifier());
    document.getElementById('auth-signup-btn')?.addEventListener('click', () => this.signUpIdentifier());
    document.getElementById('auth-phone-btn')?.addEventListener('click', () => this.signInPhoneOtp());
    modal.querySelectorAll('[data-oauth]').forEach(btn => {
      btn.addEventListener('click', () => this.signInOAuth(btn.dataset.oauth));
    });
    modal.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        modal.querySelectorAll('.auth-pane').forEach(p => p.classList.remove('active'));
        tab.classList.add('active');
        const pane = document.getElementById(tab.dataset.pane);
        if (pane) pane.classList.add('active');
      });
    });
  },

  openLoginModal(hint) {
    const modal = document.getElementById('astranov-auth-modal');
    if (!modal) return this.signInOAuth('google');
    const status = document.getElementById('auth-status');
    if (status) status.textContent = hint || 'One Astranov account — globe, sites, batch.';
    modal.classList.add('open');
    GlobeDeck?.expand?.('Sign in · Astranov Identity');
  },

  closeLoginModal() {
    document.getElementById('astranov-auth-modal')?.classList.remove('open');
  },

  async signInOAuth(provider) {
    if (!this.client) return;
    if (provider === 'tiktok') {
      ACIControl?.reply('TikTok login — enable custom OIDC in Supabase, then wire provider tiktok.');
      return;
    }
    if (!this.OAUTH_PROVIDERS.includes(provider)) return;
    this.closeLoginModal();
    GlobeDeck?.setPreview?.('Sign in · ' + provider);
    ACIControl?.reply('Sign in with ' + provider + ' — secured by Astranov');
    const redirectTo = window.location.origin + window.location.pathname;
    await this.client.auth.signInWithOAuth({
      provider,
      options: { redirectTo, skipBrowserRedirect: false }
    });
  },

  signInGoogle() { return this.signInOAuth('google'); },

  _normalizeId(raw) {
    return String(raw || '').trim();
  },

  _emailForUsername(username) {
    return username.toLowerCase().replace(/[^a-z0-9._-]/g, '') + '@users.astranov.eu';
  },

  async signInIdentifier() {
    if (!this.client) return;
    const id = this._normalizeId(document.getElementById('auth-identifier')?.value);
    const password = document.getElementById('auth-password')?.value || '';
    const status = document.getElementById('auth-status');
    if (!id) { if (status) status.textContent = 'Enter email, phone, or username.'; return; }
    try {
      if (/^\+?[\d][\d\s\-()]{7,}$/.test(id)) {
        const { error } = await this.client.auth.signInWithOtp({ phone: id.replace(/\s/g, '') });
        if (error) throw error;
        if (status) status.textContent = 'SMS code sent — enter it when prompted.';
        return;
      }
      const email = id.includes('@') ? id : this._emailForUsername(id);
      if (!password) {
        const { error } = await this.client.auth.signInWithOtp({ email });
        if (error) throw error;
        if (status) status.textContent = 'Magic link sent to ' + email;
        return;
      }
      const { error } = await this.client.auth.signInWithPassword({ email, password });
      if (error && !id.includes('@')) {
        const { error: e2 } = await this.client.auth.signInWithPassword({ email: id, password });
        if (e2) throw error;
      } else if (error) throw error;
      this.closeLoginModal();
      ACIControl?.reply('Signed in — Astranov Identity active');
    } catch (e) {
      if (status) status.textContent = e.message || 'Sign in failed';
    }
  },

  async signUpIdentifier() {
    if (!this.client) return;
    const id = this._normalizeId(document.getElementById('auth-identifier')?.value);
    const password = document.getElementById('auth-password')?.value || '';
    const status = document.getElementById('auth-status');
    if (!id || password.length < 6) {
      if (status) status.textContent = 'Username/email + password (6+ chars) required.';
      return;
    }
    const email = id.includes('@') ? id : this._emailForUsername(id);
    try {
      const { error } = await this.client.auth.signUp({
        email,
        password,
        options: { data: { username: id.includes('@') ? id.split('@')[0] : id, display_name: id } }
      });
      if (error) throw error;
      if (status) status.textContent = 'Account created — check email if confirmation is on.';
      this.closeLoginModal();
    } catch (e) {
      if (status) status.textContent = e.message || 'Sign up failed';
    }
  },

  async signInPhoneOtp() {
    if (!this.client) return;
    const phone = this._normalizeId(document.getElementById('auth-phone')?.value).replace(/\s/g, '');
    const code = this._normalizeId(document.getElementById('auth-otp')?.value);
    const status = document.getElementById('auth-status');
    if (!phone) { if (status) status.textContent = 'Enter phone with country code e.g. +3069…'; return; }
    try {
      if (!code) {
        const { error } = await this.client.auth.signInWithOtp({ phone });
        if (error) throw error;
        if (status) status.textContent = 'Code sent — enter OTP and tap Verify.';
        return;
      }
      const { error } = await this.client.auth.verifyOtp({ phone, token: code, type: 'sms' });
      if (error) throw error;
      this.closeLoginModal();
      ACIControl?.reply('Phone verified — signed in');
    } catch (e) {
      if (status) status.textContent = e.message || 'Phone sign-in failed';
    }
  },

  async ensureSession() {
    if (!this.client) return null;
    const { data } = await this.client.auth.getSession();
    let session = data?.session || null;
    if (!session?.access_token) return null;
    const exp = session.expires_at ? session.expires_at * 1000 : 0;
    if (exp && exp < Date.now() + 120000) {
      const { data: refreshed, error } = await this.client.auth.refreshSession();
      if (!error && refreshed?.session) session = refreshed.session;
    }
    this.session = session;
    return session;
  },

  async authHeaders() {
    const h = { 'Content-Type': 'application/json', apikey: SB_KEY };
    const session = await this.ensureSession();
    h.Authorization = session?.access_token ? 'Bearer ' + session.access_token : 'Bearer ' + SB_KEY;
    return h;
  },

  handoffPayload() {
    const s = this.session;
    if (!s?.access_token) return null;
    return {
      type: 'astranov-auth',
      access_token: s.access_token,
      refresh_token: s.refresh_token,
      expires_at: s.expires_at,
      user: {
        id: this.user?.id,
        email: this.user?.email,
        name: this.user?.user_metadata?.full_name || this.user?.user_metadata?.name,
        avatar: this.user?.user_metadata?.avatar_url || this.user?.user_metadata?.picture,
      }
    };
  },

  broadcastToShell() {
    const frame = document.getElementById('as-shell-frame');
    const payload = this.handoffPayload();
    if (frame?.contentWindow && payload) {
      try { frame.contentWindow.postMessage(payload, '*'); } catch { /* */ }
    }
  },

  _onChildMessage(e) {
    if (!e.data || e.data.type !== 'astranov-auth-request') return;
    const payload = this.handoffPayload();
    if (payload && e.source) e.source.postMessage(payload, '*');
  },

  async isSiteOwner(siteId) {
    if (!this.user?.id || !siteId) return false;
    if (this._siteOwners.has(siteId)) return this._siteOwners.get(siteId);
    try {
      const headers = await this.authHeaders();
      const r = await fetch(SB_URL + '/rest/v1/booker_sites?select=owner_id&id=eq.' + encodeURIComponent(siteId) + '&limit=1', { headers });
      const rows = r.ok ? await r.json() : [];
      const ok = rows[0]?.owner_id === this.user.id;
      this._siteOwners.set(siteId, ok);
      return ok;
    } catch { return false; }
  },

  async refreshAuthority() {
    if (!this.user) {
      this.isOwner = false;
      this.isArchitect = false;
      this.updateOwnerUI();
      return;
    }
    const email = (this.user.email || '').toLowerCase();
    this.isArchitect = email === this.OWNER_EMAIL;
    try {
      const r = await fetch(ACI.url + '/functions/v1/aci', {
        method: 'POST',
        headers: await this.authHeaders(),
        body: JSON.stringify({ mode: 'owner_sync' })
      }).then(res => res.json());
      this.isOwner = !!(r.is_owner || r.is_architect);
      if (this.isOwner) {
        window._aciOwner = true;
        ACI?.feed('owner-sync', email);
      }
    } catch (_) {
      if (this.client) {
        const { data: prof } = await this.client.from('profiles').select('is_owner').eq('id', this.user.id).single();
        this.isOwner = prof?.is_owner === true || this.isArchitect;
      }
    }
    this.updateOwnerUI();
    if (window.FieldBrain) FieldBrain.onAuth();
    if (window.AciCli) AciCli.onAuthChange();
  },

  updateOwnerUI() {
    const chip = document.getElementById('user-chip');
    if (this.isOwner && chip) {
      chip.textContent = (this.user?.user_metadata?.full_name || this.user?.email?.split('@')[0] || 'Owner') + ' · OWNER';
      chip.style.color = '#8f8';
    }
    if (this.isOwner) GlobeDeck?.setTitle('Astranov Collective CLI · FULL AUTHORITY');
    const prompt = document.getElementById('aci-cli-prompt');
    if (prompt && this.isOwner) {
      const name = this.user?.email?.split('@')[0] || 'owner';
      prompt.textContent = name + '@owner $';
    }
  },

  async signOut() {
    if (!this.client) return;
    await this.client.auth.signOut();
    this.user = null;
    this.session = null;
    this.isOwner = false;
    this.isArchitect = false;
    this._siteOwners.clear();
    window._aciOwner = false;
    this.applyUser();
    this.updateOwnerUI();
    this.broadcastToShell();
    if (Voice.maySpeak()) speak('Signed out.', () => {}, true);
  },

  applyUser() {
    const btn = document.getElementById('aci-login');
    const chip = document.getElementById('user-chip');
    if (this.user) {
      const name = this.user.user_metadata?.full_name
        || this.user.user_metadata?.name
        || (this.user.email || '').split('@')[0]
        || 'User';
      const avatar = this.user.user_metadata?.avatar_url || this.user.user_metadata?.picture;
      if (btn) {
        btn.title = 'Sign out · ' + name;
        if (avatar) {
          btn.style.backgroundImage = 'url(' + avatar + ')';
          btn.style.backgroundSize = 'cover';
          btn.textContent = '';
        } else {
          btn.textContent = name.charAt(0).toUpperCase();
          btn.style.backgroundImage = '';
        }
      }
      if (chip && !this.isOwner) chip.textContent = name;
      AstranovIdentity.syncMe(this.user);
      ACI?.feed('login', name);
      if (window.AciCli) AciCli.onAuthChange();
      if (window.GlobeDeck) GlobeDeck.restoreLog?.();
    } else {
      if (btn) {
        btn.title = 'Sign in — Google · email · phone';
        btn.textContent = 'G';
        btn.style.backgroundImage = '';
      }
      if (chip) chip.textContent = '';
      AstranovIdentity.syncMe(null);
      if (window.AciCli) AciCli.onAuthChange();
      if (window.GlobeDeck) GlobeDeck.restoreLog?.();
    }
  }
};
window.Auth = Auth;