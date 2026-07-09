// === ASTRANOV COLLECTIVE INTELLIGENCE (ACI) — FINAL ===
// Synthesized from all AI specs: pure globe + three modes + council + self-evolving neurons.
// Single API: /functions/v1/aci (think | evolve | log | teach | stats | seed)
const SUPABASE_REF = 'lkoatrkhuigdolnjsbie';
const SUPABASE_CUSTOM_URL = 'https://api.astranov.eu';
const SUPABASE_DEFAULT_URL = 'https://' + SUPABASE_REF + '.supabase.co';
// Flip true after api.astranov.eu is activated — removes random ref from Google OAuth
const SUPABASE_USE_CUSTOM_DOMAIN = false;

const ACI = {
  name: 'Astranov Collective Intelligence',
  url: SUPABASE_USE_CUSTOM_DOMAIN ? SUPABASE_CUSTOM_URL : SUPABASE_DEFAULT_URL,
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

  async think(prompt) {
    if (window._aciAbort) { try { window._aciAbort.abort(); } catch (_) {} }
    window._aciAbort = new AbortController();
    const up = window._lastPos || { lat: 36.22, lng: 28.12 };
    GlobeDeck?.setMapStatus('ACI — thinking…');
    GlobeDeck?.setThinking(true, 'ACI — thinking…');
    const h = await this.headers();
    let r;
    try {
      // Monitor usage: limit history to reduce tokens (from logs ~210k prompt)
      const limitedHistory = this.history.slice(-4);
      r = await fetchJson(this.url + '/functions/v1/aci', {
        method: 'POST', headers: h,
        body: JSON.stringify({ mode: 'think', prompt, history: limitedHistory, aci_mode: this.thinkMode || undefined }),
      }, 55000);
    } catch (e) {
      r = { error: String(e.message || e) };
      // Send complaint on error
      this._sendComplaint('think_error', String(e));
    }
    GlobeDeck?.setThinking(false);
    if (r.aborted) return '';
    if (r.error) {
      const err = 'ACI error: ' + r.error + (r._httpStatus === 401 ? ' — tap G to sign in' : '');
      GlobeDeck?.showError(err);
      this._sendComplaint('aci_error', err);
      return err;
    }
    const text = (r.text || r.response || '').trim() || 'Το Astranov συγκεντρώνεται — δοκίμασε ξανά.';
    this.history.push({ role: 'user', content: prompt });
    this.history.push({ role: 'assistant', content: text });
    if (this.history.length > 20) this.history = this.history.slice(-20);
    this.feed('think', prompt.slice(0, 80));
  },

  _sendComplaint(type, detail) {
    // Monitor complaints to debug-write
    if (window.fetch) {
      fetch('https://lkoatrkhuigdolnjsbie.supabase.co/functions/v1/debug-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.key },
        body: JSON.stringify({ type: 'complaint_' + type, detail, ts: Date.now(), session: window._sessionId || 'web', url: location.href })
      }).catch(() => {});
    }
  },

  // ... rest of ACI (unchanged for brevity in this batch) 
  // [previous code for evolve, log, etc. continues]
};