/* phase lexical bridge — window → local (optional chaining safe) */
var sessionHeld = (typeof window !== 'undefined' && window.sessionHeld) || false;
var SessionHold = (typeof window !== 'undefined' && window.SessionHold) || { isHeld:function(){return false}, hold:function(){}, resume:function(){}, toggle:function(){}, release:function(){}, init:function(){} };
var ACIControl = (typeof window !== 'undefined' && window.ACIControl) || { init:function(){}, reply:function(){}, voiceAck:function(){}, handle:async function(){return {executed:false}} };
var AppShortcuts = (typeof window !== 'undefined' && window.AppShortcuts) || { _order:[], APPS:{}, init:function(){}, render:function(){}, track:function(){}, untrack:function(){} };
var CityMap = (typeof window !== 'undefined' && window.CityMap) || { active:false, init:function(){} };
var SB_URL = (typeof window !== 'undefined' && window.SB_URL) || 'https://lkoatrkhuigdolnjsbie.supabase.co';
var SB_KEY = (typeof window !== 'undefined' && window.SB_KEY) || '';
var ACI = (typeof window !== 'undefined' && window.ACI) || { url: SB_URL, key: SB_KEY };
var AciCoders = (typeof window !== 'undefined' && window.AciCoders) || { engine:'grok', init:function(){}, observeActivity:function(){}, handleMessage:async function(){return null}, enterSession:async function(){return null} };
var ArchitectBridge = (typeof window !== 'undefined' && window.ArchitectBridge) || { armed:false, isActive:function(){return false}, arm:function(){}, disarm:function(){}, openQuickFix:function(){}, wantsBridgeCmd:function(){return false}, handleCommand:async function(){return null}, queueBuildFromChat:async function(){return null}, _bindUi:function(){}, init:function(){} };
var CityLife = (typeof window !== 'undefined' && window.CityLife) || { locateAndDropIn:async function(){return {error:'not ready'}}, safeLocate:async function(){return {error:'not ready'}}, dropIn:async function(){return {error:'not ready'}}, init:function(){} };
// Do not redeclare userLocated — critical owns it (var) for cross-script assigns.
var CliRibbon = (typeof window !== 'undefined' && window.CliRibbon) || { setNotice:function(){}, render:function(){}, init:function(){} };

/* === 06-fetch-json.js === */
// === FETCH JSON — timeout + visible errors for all ACI calls ===
async function fetchJson(url, options, timeoutMs) {
  const ms = timeoutMs || 55000;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    const j = await r.json().catch(() => ({}));
    if (!r.ok && !j.error) j.error = 'HTTP ' + r.status;
    j._httpStatus = r.status;
    j._ok = r.ok;
    return j;
  } catch (e) {
    if (e.name === 'AbortError') return { error: 'timeout — server slow, try again', _timeout: true };
    return { error: String(e.message || e.cause?.message || e || 'network failed') };
  } finally {
    clearTimeout(timer);
  }
}
window.fetchJson = fetchJson;

/* === 05-speak-map.js === */
// === VOICE + MAP DEPICT ===
// Astranov Voice: ONE calm female persona, ONE utterance at a time (queued).
// Server TTS preferred; browser fallback only if server unavailable.

const Voice = {
  persona: { name: 'Astranov', style: 'female calm mid-tone' },
  voices: [],
  ready: false,
  speaking: false,
  stopped: false,
  preferredListenLang: 'el-GR',
  _voicesReady: null,
  _audio: null,
  _blobUrl: null,
  _gen: 0,
  _queue: Promise.resolve(),
  engine: 'astranov',

  init() {
    const load = () => {
      this.voices = speechSynthesis.getVoices().filter(v => v.lang);
      if (this.voices.length) this.ready = true;
    };
    load();
    speechSynthesis.addEventListener('voiceschanged', load);
    setTimeout(load, 400);
    setTimeout(load, 1200);
  },

  ensureVoices() {
    if (!this._voicesReady) {
      this._voicesReady = new Promise(resolve => {
        const done = () => {
          this.voices = speechSynthesis.getVoices().filter(v => v.lang);
          this.ready = this.voices.length > 0;
          resolve();
        };
        done();
        speechSynthesis.addEventListener('voiceschanged', done, { once: true });
        setTimeout(done, 800);
      });
    }
    return this._voicesReady;
  },

  detectLang(s) {
    if (ArcangeloDialect?.looksMixed?.(s) || ArcangeloDialect?.detect?.(s)?.active) return 'el-GR';
    const g = (s.match(/[\u0370-\u03FF\u1F00-\u1FFF]/g) || []).length;
    const l = (s.match(/[a-zA-Z]/g) || []).length;
    return g >= l * 0.25 ? 'el-GR' : 'en-US';
  },

  pickFemaleCalm(lang) {
    const v = this.voices;
    if (!v.length) return null;
    const isFemale = x => /female|zira|samantha|susan|hazel|aria|victoria|linda|karen|moira|fiona|tessa|melina|elena|google.*γυναικ|natural.*female/i.test(x.name);
    if (lang === 'el-GR') {
      return v.find(x => isFemale(x) && /el/i.test(x.lang))
        || v.find(x => /melina|elena|ελληνικά/i.test(x.name))
        || v.find(x => /^el[-_]?GR$/i.test(x.lang) && !/stefanos|male|nikos/i.test(x.name));
    }
    return v.find(x => isFemale(x) && /^en/i.test(x.lang))
      || v.find(x => /zira|samantha|hazel|aria|victoria/i.test(x.name))
      || v.find(x => /^en[-_]?US$/i.test(x.lang));
  },

  hasGreekVoice() {
    return !!this.pickFemaleCalm('el-GR');
  },

  /** Browser TTS without a Greek voice spells Α→Α Κ Ο… — romanize instead */
  romanizeGreek(text) {
    const map = {
      α: 'a', ά: 'a', β: 'v', γ: 'g', δ: 'd', ε: 'e', έ: 'e', ζ: 'z', η: 'i', ή: 'i',
      θ: 'th', ι: 'i', ί: 'i', ϊ: 'i', ΐ: 'i', κ: 'k', λ: 'l', μ: 'm', ν: 'n', ξ: 'x',
      ο: 'o', ό: 'o', π: 'p', ρ: 'r', σ: 's', ς: 's', τ: 't', υ: 'y', ύ: 'y', φ: 'f',
      χ: 'ch', ψ: 'ps', ω: 'o', ώ: 'o',
      Α: 'A', Ά: 'A', Β: 'V', Γ: 'G', Δ: 'D', Ε: 'E', Έ: 'E', Ζ: 'Z', Η: 'I', Ή: 'I',
      Θ: 'Th', Ι: 'I', Ί: 'I', Κ: 'K', Λ: 'L', Μ: 'M', Ν: 'N', Ξ: 'X', Ο: 'O', Ό: 'O',
      Π: 'P', Ρ: 'R', Σ: 'S', Τ: 'T', Υ: 'Y', Ύ: 'Y', Φ: 'F', Χ: 'Ch', Ψ: 'Ps', Ω: 'O', Ώ: 'O',
    };
    return String(text || '').split('').map(c => map[c] || c).join('');
  },

  prepareForSpeech(text) {
    let s = this.humanize(text).slice(0, 420);
    if (!s) return { text: '', lang: 'en-US', speak: false };
    let lang = this.detectLang(s);
    const hasGreek = /[\u0370-\u03FF\u1F00-\u1FFF]/.test(s);
    if (hasGreek && lang === 'el-GR' && !this.hasGreekVoice()) {
      s = this.romanizeGreek(s);
      lang = 'en-US';
    }
    return { text: s, lang, speak: this.shouldSpeak(s) };
  },

  async synthHeaders() {
    if (window.Auth?.authHeaders) return Auth.authHeaders();
    return { 'Content-Type': 'application/json', apikey: SB_KEY, Authorization: 'Bearer ' + SB_KEY };
  },

  releaseAudio() {
    if (this._audio) { try { this._audio.pause(); this._audio.currentTime = 0; } catch (_) {} this._audio = null; }
    if (this._blobUrl) { try { URL.revokeObjectURL(this._blobUrl); } catch (_) {} this._blobUrl = null; }
  },

  playBlob(blob, gen) {
    return new Promise(resolve => {
      if (this.stopped || gen !== this._gen) { resolve(); return; }
      this.releaseAudio();
      this._blobUrl = URL.createObjectURL(blob);
      this._audio = new Audio(this._blobUrl);
      this._audio.onended = () => { this.releaseAudio(); resolve(); };
      this._audio.onerror = () => { this.releaseAudio(); resolve(); };
      this.speaking = true;
      AstranovLogo?.hookAiAudio?.(this._audio);
      window.syncHandsFreeBtn?.();
      this._audio.play().catch(() => resolve());
    });
  },

  async synthServer(text, lang) {
    try {
      const r = await fetch(SB_URL + '/functions/v1/voice', {
        method: 'POST',
        headers: await this.synthHeaders(),
        body: JSON.stringify({ text, lang, persona: this.persona.name })
      });
      if (r.ok && (r.headers.get('content-type') || '').includes('audio')) {
        this.engine = r.headers.get('X-Astranov-Voice') || 'astranov';
        return await r.blob();
      }
    } catch (_) {}
    return null;
  },

  speakBrowser(text, lang, gen) {
    return new Promise(resolve => {
      if (this.stopped || gen !== this._gen) { resolve(); return; }
      try { speechSynthesis.cancel(); } catch (_) {}
      let say = text;
      let sayLang = lang;
      if (/[\u0370-\u03FF\u1F00-\u1FFF]/.test(say) && !this.hasGreekVoice()) {
        say = this.romanizeGreek(say);
        sayLang = 'en-US';
      }
      const utter = new SpeechSynthesisUtterance(say);
      utter.lang = sayLang;
      utter.rate = 0.88;
      utter.pitch = 0.94;
      const voice = this.pickFemaleCalm(sayLang);
      if (voice) utter.voice = voice;
      utter.onend = () => resolve();
      utter.onerror = () => resolve();
      this.engine = 'browser-female';
      this.speaking = true;
      speechSynthesis.speak(utter);
    });
  },

  humanize(text) {
    let s = ArcangeloDialect?.repairBrands?.(String(text || '')) || String(text || '');
    return s
      .replace(/[\u{1F000}-\u{1FFFF}]/gu, '')
      .replace(/https?:\/\/\S+/gi, '')
      .replace(/[{}[\]"`#*_~|<>@$]/g, ' ')
      .replace(/\b([A-Z]{2,})\b/g, (_, w) => w.toLowerCase())
      .replace(/(\d)[.,](\d)/g, '$1 $2')
      .replace(/\s+/g, ' ')
      .trim();
  },

  shouldSpeak(text) {
    const t = (text || '').trim();
    const minLen = window._handsFreeVoice ? 2 : 4;
    if (t.length < minLen) return false;
    if (/^[\d\s.,:;+\-/]+$/.test(t)) return false;
    if (t.startsWith('{') || t.startsWith('[') || /^\s*"ok"/.test(t)) return false;
    if ((t.match(/[a-zA-Z\u0370-\u03FF]/g) || []).length < 3) return false;
    return true;
  },

  stop() {
    this._gen++;
    this.stopped = true;
    this.speaking = false;
    this.releaseAudio();
    try { speechSynthesis.cancel(); } catch (_) {}
  },

  flush() {
    this.stop();
    this._queue = Promise.resolve();
  },

  maySpeak() {
    return (voiceEnabled && voiceSessionActive && !this.stopped)
      || (window._handsFreeVoice && voiceEnabled && !this.stopped);
  },

  enqueue(text, onEnd, forceBrowser) {
    this._queue = this._queue
      .then(() => this._speakOne(text, onEnd, forceBrowser))
      .catch(() => {});
    return this._queue;
  },

  async _speakOne(text, onEnd, forceBrowser) {
    if (!voiceEnabled && !window._handsFreeVoice) { if (onEnd) onEnd(); return; }

    const gen = ++this._gen;
    this.stopped = false;
    this.speaking = true;
    AstranovLogo?.setAiActive?.(true);
    window.syncHandsFreeBtn?.();
    window.pauseVoiceRecognition?.();
    this.releaseAudio();
    try { speechSynthesis.cancel(); } catch (_) {}

    await this.ensureVoices();
    if (gen !== this._gen) { if (onEnd) onEnd(); return; }

    const prep = this.prepareForSpeech(text);
    if (!prep.speak) {
      if (gen === this._gen) {
        this.speaking = false;
        window.syncHandsFreeBtn?.();
      }
      if (onEnd) onEnd();
      return;
    }

    const { text: clean, lang } = prep;

    if (forceBrowser) {
      await this.speakBrowser(clean, lang, gen);
    } else {
      const blob = await this.synthServer(clean, lang);
      if (gen !== this._gen) { if (onEnd) onEnd(); return; }
      if (blob) {
        await this.playBlob(blob, gen);
      } else {
        await this.speakBrowser(clean, lang, gen);
      }
    }

    if (gen === this._gen) {
      this.speaking = false;
      AstranovLogo?.setAiActive?.(false);
      window.syncHandsFreeBtn?.();
      if (!onEnd) window.resumeVoiceRecognition?.();
    }
    if (onEnd && gen === this._gen && !this.stopped) onEnd();
  }
};

function speak(text, onEnd, force) {
  const handsFree = !!window._handsFreeVoice;
  if (!force && !handsFree && !Voice.maySpeak()) { if (onEnd) onEnd(); return Promise.resolve(); }
  if (handsFree && !voiceEnabled) voiceEnabled = true;
  const repaired = ArcangeloDialect?.repairOutbound?.(text, 'reply') ?? text;
  return Voice.enqueue(repaired, onEnd, !!force);
}
function stopSpeaking() { Voice.flush(); }

var MapDepict = {
  overlays: [],
  current: '',

  userPos() {
    return window._lastPos || { lat: 36.22, lng: 28.12 };
  },

  setHud(label, detail) {
    const line = detail ? label + ' — ' + detail : label;
    if (CliRibbon?.isGlobeHint?.(line)) return;
    GlobeDeck?.setMapStatus(line);
  },

  cancelAll() {
    this.overlays.forEach(o => {
      if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
      if (o.line && o.line.parent) o.line.parent.remove(o.line);
      if (o.group && o.group.parent) o.group.parent.remove(o.group);
    });
    this.overlays = [];
    this.current = '';
    GlobeDeck?.setPreview('');
  },

  pulse(lat, lng, color, label, duration = 9000) {
    if (window.GlobeEntity) {
      const e = GlobeEntity.registerTemp({
        type: 'place',
        lat, lng,
        title: label || 'Here',
        description: 'Active now · zoom closer',
        urgency: 2,
        color: color || 0x00ddff,
        expires: duration,
      });
      if (window.AIGraphics) {
        const p = latLngToPos(lat, lng, 1.04);
        AIGraphics.spawnEffect(new THREE.Vector3(p.x, p.y, p.z), color, 14, 36);
      }
      return { entity: e, born: Date.now(), duration, label };
    }
    const p = latLngToPos(lat, lng, 1.04);
    const pos = new THREE.Vector3(p.x, p.y, p.z);
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.018, 0.032, 28),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide })
    );
    ring.position.copy(pos);
    ring.lookAt(0, 0, 0);
    globePivot.add(ring);
    if (window.AIGraphics) AIGraphics.spawnEffect(pos, color, 14, 36);
    const entry = { mesh: ring, born: Date.now(), duration, label };
    this.overlays.push(entry);
    return entry;
  },

  arc(fromLat, fromLng, toLat, toLng, color = 0x00ffaa, duration = 14000) {
    const a = latLngToPos(fromLat, fromLng, 1.03);
    const b = latLngToPos(toLat, toLng, 1.03);
    const va = new THREE.Vector3(a.x, a.y, a.z);
    const vb = new THREE.Vector3(b.x, b.y, b.z);
    const mid = va.clone().add(vb).multiplyScalar(0.5).normalize().multiplyScalar(1.1);
    const curve = new THREE.QuadraticBezierCurve3(va, mid, vb);
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(curve.getPoints(28)),
      new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.75 })
    );
    globePivot.add(line);
    const entry = { line, born: Date.now(), duration };
    this.overlays.push(entry);
    return line;
  },

  action(type, opts = {}) {
    const u = this.userPos();
    const lat = opts.lat != null ? opts.lat : u.lat;
    const lng = opts.lng != null ? opts.lng : u.lng;
    const detail = (opts.detail || '').slice(0, 80);
    this.current = type;

    const palette = {
      think: 0x44ccff,
      evolve: 0xaa66ff,
      teach: 0x66ff99,
      order: 0xffaa44,
      vendor: 0xff8844,
      compare: 0x66ffcc,
      driver: 0x4488ff,
      pay: 0x88ff44,
      phone: 0x44ff88,
      vhf: 0xffdd44,
      news: 0xcc88ff,
      explore: 0x00aaff,
      video: 0x3d9eff,
      location: 0x3d9eff,
      mode: 0x88aaff,
      stop: 0xff4466,
      drive: 0x44aaff,
      batch: 0x6688ff
    };
    const color = palette[type] || 0x00ddff;
    const labels = {
      think: 'Σκέψη ACI',
      evolve: 'Εξέλιξη collective',
      teach: 'Μνήμη / neuron',
      order: 'Παραγγελία',
      vendor: 'Καταστήματα',
      compare: 'Σύγκριση τιμών',
      driver: 'Οδηγοί διανομής',
      pay: 'Πληρωμή Coins',
      phone: 'Τηλέφωνο',
      vhf: 'VHF ασύρματος',
      news: 'Ειδήσεις',
      explore: 'Εξερεύνηση',
      video: 'Video κλήση',
      location: 'Τοποθεσία',
      mode: 'Λειτουργία ACI',
      stop: 'Διακοπή',
      drive: 'Οδήγηση δρόμου',
      batch: 'Batch · δουλειά μαζί'
    };

    this.setHud(labels[type] || type, detail);
    this.pulse(lat, lng, color, labels[type]);

    if (type === 'order' && opts.vendorLat != null) {
      this.arc(opts.vendorLat, opts.vendorLng, lat, lng, color);
      const fp = latLngToPos(lat, lng, 1.04);
      focusOnGlobePoint(new THREE.Vector3(fp.x, fp.y, fp.z));
    }
    if (type === 'vendor' && opts.vendors) {
      GlobeEntity?.syncVendors?.(opts.vendors);
      const v0 = opts.vendors[0];
      if (v0 && typeof flyToPoint === 'function') {
        const fp = latLngToPos(v0.lat, v0.lng, 1.04);
        flyToPoint(new THREE.Vector3(fp.x, fp.y, fp.z), GlobeControl?.Z?.national || 1.82);
      }
    }
    if (type === 'news') {
      const nlat = opts.worldLat ?? opts.lat ?? this.userPos().lat;
      const nlng = opts.worldLng ?? opts.lng ?? this.userPos().lng;
      this.pulse(nlat, nlng, color, 'News', 10000);
      GlobeControl?.flyToLatLng?.(nlat, nlng, 'news', GlobeControl?.Z?.global);
    }
    if (type === 'batch') {
      GlobeControl?.flyToLatLng?.(lat, lng, 'batch');
    }
    if (type === 'evolve') {
      const u = this.userPos();
      this.pulse(u.lat, u.lng, color, 'neuron', 11000);
    }
    if (type === 'think') {
      const fp = latLngToPos(lat, lng, 1.04);
      focusOnGlobePoint(new THREE.Vector3(fp.x, fp.y, fp.z));
    }
    if (type === 'compare' && opts.matches) {
      GlobeEntity?.syncVendors?.(opts.matches.map(m => m.vendor).filter(Boolean));
      opts.matches.slice(0, 6).forEach((m, i) => {
        const col = i === 0 ? 0x00ff88 : 0xffaa44;
        const v = m.vendor || m;
        this.arc(v.lat, v.lng, lat, lng, col);
      });
    }
    if (type === 'driver' && opts.drivers) {
      GlobeEntity?.syncDrivers?.(opts.drivers);
    }
    if (type === 'pay' && opts.vendorLat != null) {
      this.arc(opts.vendorLat, opts.vendorLng, lat, lng, 0x88ff44);
    }

    if (window.FieldBrain?.pulse) {
      FieldBrain?.pulse?.(type, detail || labels[type] || type, { role: opts.role });
    }
    return { type, lat, lng };
  },

  zoomToUser(zoom) {
    const u = this.userPos();
    this.action('location', { lat: u.lat, lng: u.lng, detail: 'εσύ · αναζήτηση' });
    const cityZ = GlobeControl?.Z?.city || 1.38;
    const z = zoom != null && zoom <= cityZ ? zoom : (GlobeControl?.Z?.national || 1.82);
    if (ZoomTiers && zoom == null) ZoomTiers.goTo('national', true);
    const fp = latLngToPos(u.lat, u.lng, 1.04);
    if (typeof flyToPoint === 'function') flyToPoint(new THREE.Vector3(fp.x, fp.y, fp.z), z);
    else focusOnGlobePoint(new THREE.Vector3(fp.x, fp.y, fp.z), z);
    return u;
  },

  scanCity(opts = {}) {
    const u = opts.userLat != null ? { lat: opts.userLat, lng: opts.userLng } : this.userPos();
    const vendors = opts.vendors || window.Commerce?.vendors || [];
    const label = opts.label || 'Looking around the city…';
    this.cancelAll();
    this.setHud('City scan', label);
    this.zoomToUser(opts.zoom || GlobeControl?.Z?.city || 1.32);
    CityMap?.onCamera?.(opts.zoom || 1.28, 'earth');
    const rings = [0, 1, 2, 3];
    rings.forEach((i) => {
      setTimeout(() => {
        const jitter = i * 0.0018;
        this.pulse(u.lat + jitter, u.lng - jitter, 0x3d9eff, label, 4200 + i * 800);
        if (vendors[i]) {
          const v = vendors[i];
          this.pulse(v.lat, v.lng, 0xff8844, v.name, 9000);
          this.arc(v.lat, v.lng, u.lat, u.lng, 0x66ffcc, 11000);
        }
      }, i * 420);
    });
    if (vendors.length) {
      GlobeEntity?.syncVendors?.(vendors);
      this.action('vendor', { lat: u.lat, lng: u.lng, detail: vendors.length + ' shops', vendors });
    }
    return u;
  },

  showOrderSearch(opts = {}) {
    const u = opts.userLat != null ? { lat: opts.userLat, lng: opts.userLng } : this.userPos();
    const wanted = (opts.wantedLabels || []).join(' · ');
    this.scanCity({
      userLat: u.lat, userLng: u.lng,
      vendors: (opts.matches || []).map(m => m.vendor).filter(Boolean).slice(0, 8),
      label: wanted || 'Order search',
      zoom: opts.zoom || GlobeControl?.Z?.city || 1.32,
    });
    if (opts.matches?.length) {
      this.action('compare', { lat: u.lat, lng: u.lng, detail: wanted, matches: opts.matches });
    }
    if (opts.drivers?.length) {
      this.action('driver', { lat: u.lat, lng: u.lng, detail: opts.drivers.length + ' drivers', drivers: opts.drivers });
    }
    return u;
  },

  tick() {
    const now = Date.now();
    this.overlays = this.overlays.filter(o => {
      const age = (now - o.born) / o.duration;
      if (age >= 1) {
        if (o.mesh && o.mesh.parent) o.mesh.parent.remove(o.mesh);
        if (o.line && o.line.parent) o.line.parent.remove(o.line);
        return false;
      }
      if (o.mesh) {
        o.mesh.material.opacity = 0.9 * (1 - age * 0.85);
        const s = 1 + age * 1.8;
        o.mesh.scale.set(s, s, s);
      }
      if (o.line) o.line.material.opacity = 0.75 * (1 - age);
      return true;
    });
  }
};

window.Voice = Voice;
window.MapDepict = MapDepict;

function userIntervene() {
  if (window.voiceInterrupt) window.voiceInterrupt({ keepHandsFree: false });
  else Voice.flush();
  voiceSessionActive = false;
  voiceEnabled = false;
  if (window.setVoicePerfMode) window.setVoicePerfMode(false);
  if (window.stopHandsFree) window.stopHandsFree();
  SessionHold?.release?.();
  GlobeVideo?.stop?.();
  GlobeVideo?.hide?.();
  SuperSpace?.stop?.();
  window.SuperAdd?.stop?.();
  GlobeEntity?.clearSelection?.();
  document.getElementById('aci-cli-in')?.classList.remove('voice-live');
  document.getElementById('aci-handsfree')?.classList.remove('listening', 'deck-btn-active', 'speaking');
  const cliIn = document.getElementById('aci-cli-in');
  if (cliIn) cliIn.placeholder = 'type or tap 🎧 · Enter or ➡';
  GlobeControl?.userTookGlobe?.('stop');
  if (window.PmrRadio) PmrRadio.hide();
    if (window.DrivingView) window.DrivingView.deactivate();
  MapDepict.cancelAll();
  if (window._aciAbort) { try { window._aciAbort.abort(); } catch (_) {} }
  if (window._droneAnim) { clearInterval(window._droneAnim); window._droneAnim = null; }
  if (window.Comms) window.Comms.vhfActive = false;
  if (recognition) { try { recognition.stop(); } catch (_) {} }
  isListening = false;
  if (ACI) ACI.evolving = false;
  GlobeDeck?.setMapStatus((AstroGlyphs?.stop || '🛑') + ' Stopped — globe is yours');
  if (window.ACIControl) ACIControl.reply('Stopped — globe is yours.');
}

window.userIntervene = userIntervene;

/* === 01-astranov-auth-url.js === */
// === ASTRANOV AUTH URL — never expose classified Supabase project ref to users ===
const ASTRANOV_GOOGLE_CLIENT_ID = '73846897360-va7gcqngfc370gfp7rl059no0vd4ts11.apps.googleusercontent.com';

const ASTRANOV_SUPABASE_REF = 'lkoatrkhuigdolnjsbie';
const ASTRANOV_SUPABASE_DIRECT = 'https://' + ASTRANOV_SUPABASE_REF + '.supabase.co';

function resolveAstranovSupabaseUrl() {
  try {
    const host = location.hostname || '';
    if (host === 'astranov.eu' || host.endsWith('.astranov.eu')) {
      return location.origin;
    }
  } catch (_) { /* */ }
  const c = window.ASTRANOV_CENTRAL_DB;
  if (c?.useCustomDomain && c?.customUrl) return c.customUrl;
  return ASTRANOV_SUPABASE_DIRECT;
}

/** Supabase JS client (auth · realtime · .from()) — always direct; Vercel cannot proxy WebSocket */
function resolveAstranovSupabaseClientUrl() {
  return ASTRANOV_SUPABASE_DIRECT;
}

/** Edge functions — direct URL so JWT validation is reliable */
function resolveAstranovFunctionsUrl() {
  return resolveAstranovSupabaseClientUrl() + '/functions/v1';
}

function astranovPublicOrigin() {
  try {
    const host = location.hostname || '';
    if (host === 'astranov.eu' || host.endsWith('.astranov.eu')) return location.origin;
  } catch (_) { /* */ }
  return 'https://astranov.eu';
}

function scrubSupabaseLeak(text) {
  return String(text || '')
    .replace(/[a-z0-9]{18,}\.supabase\.co/gi, 'astranov.eu')
    .replace(/\bsupabase\b/gi, 'Astranov');
}

function astranovizeAuthUrl(url) {
  try {
    const origin = astranovPublicOrigin();
    // Proxy hop only — never rewrite redirect_uri (breaks Google OAuth validation)
    return String(url || '').replace(/https:\/\/[a-z0-9]{18,}\.supabase\.co/gi, origin);
  } catch (_) {
    return url;
  }
}

window.ASTRANOV_GOOGLE_CLIENT_ID = ASTRANOV_GOOGLE_CLIENT_ID;
window.resolveAstranovSupabaseUrl = resolveAstranovSupabaseUrl;
window.resolveAstranovSupabaseClientUrl = resolveAstranovSupabaseClientUrl;
window.resolveAstranovFunctionsUrl = resolveAstranovFunctionsUrl;
window.astranovPublicOrigin = astranovPublicOrigin;
window.scrubSupabaseLeak = scrubSupabaseLeak;
window.astranovizeAuthUrl = astranovizeAuthUrl;

/* === 12-auth.js === */
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
  _profileVisual: null,
  _authDegraded: false,
  _authBoot: true,
  _gsiReady: null,
  GOOGLE_CLIENT_ID: typeof ASTRANOV_GOOGLE_CLIENT_ID !== 'undefined' ? ASTRANOV_GOOGLE_CLIENT_ID : '',

  init() {
    if (typeof supabase === 'undefined') {
      console.warn('[Auth] Supabase SDK missing — login unavailable');
      return;
    }
    const clientUrl = typeof resolveAstranovSupabaseClientUrl === 'function'
      ? resolveAstranovSupabaseClientUrl()
      : SB_URL;
    this.client = supabase.createClient(clientUrl, SB_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'astranov_auth_v2' },
    });
    this.client.auth.onAuthStateChange((ev, session) => {
      if (ev === 'SIGNED_IN' && session?.user) {
        this.session = session;
        this.user = session.user;
        this._authDegraded = false;
        this.closeLoginModal();
        this.applyUser();
        this.refreshAuthority();
        const owner = (session.user.email || '').toLowerCase() === this.OWNER_EMAIL.toLowerCase();
        ACIControl?.reply(owner
          ? 'Architect signed in · Grok ready · 🎧'
          : 'Signed in · tap 🎧 talk to Astranov');
        setTimeout(() => {
          primeGrokVoice?.();
          // Architect: open AI session (paid path); do not auto-locate
          if (owner) {
            void AciCoders?.enterSession?.({ expand: true, focus: false, ping: true });
          }
        }, 800);
        try {
          const clean = location.pathname + (location.search || '').replace(/[?&]code=[^&]*/g, '').replace(/[?&]error=[^&]*/g, '').replace(/\?&/, '?').replace(/\?$/, '');
          if (location.search || location.hash) history.replaceState(null, '', clean || '/');
        } catch (_) {}
        return;
      }
      if (ev === 'TOKEN_REFRESHED' && session?.user) {
        this.session = session;
        this.user = session.user;
        this._authDegraded = false;
        this.applyUser();
        return;
      }
      if (!session?.user && this.user && ev !== 'SIGNED_OUT') {
        this._authDegraded = true;
        this.applyUser();
        this.ensureSession().then((s) => {
          if (s?.user) {
            this.session = s;
            this.user = s.user;
            this._authDegraded = false;
            this.applyUser();
            this.refreshAuthority();
          }
        });
        return;
      }
      this.session = session;
      this.user = session?.user || null;
      this._authDegraded = false;
      this.applyUser();
      this.refreshAuthority();
      this.broadcastToShell();
      if (this.user) this.loadProfileVisual();
    });
    this._handleOAuthReturn();
    this.client.auth.getSession().then(({ data }) => {
      this._authBoot = false;
      this.session = data?.session || null;
      this.user = data?.session?.user || null;
      this.applyUser();
      this.refreshAuthority();
      this.broadcastToShell();
      if (this.user) this.loadProfileVisual();
    });
    const btn = document.getElementById('aci-login');
    if (btn) btn.onclick = () => this.user ? this.openLoggedInProfile() : this.signInGoogle();
    this.bindAuthModal();
    this._recoverFromAuthError();
    window.addEventListener('message', e => this._onChildMessage(e));
  },

  _recoverFromAuthError() {
    const q = location.search + location.hash;
    if (!/[?&#]error=/i.test(q) && !/access.denied|invalid_client|oauth/i.test(q)) return;
    setTimeout(() => {
      this.openLoginModal('Google blocked you — use email sign-in link below');
      this._activateSignInPane();
      ACIControl?.reply('Google OAuth blocked — tap Send sign-in link');
    }, 400);
  },

  _activateSignInPane() {
    const modal = document.getElementById('astranov-auth-modal');
    if (!modal) return;
    modal.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    modal.querySelectorAll('.auth-pane').forEach(p => p.classList.remove('active'));
    const tab = modal.querySelector('[data-pane="auth-pane-signin"]');
    const pane = document.getElementById('auth-pane-signin');
    if (tab) tab.classList.add('active');
    if (pane) pane.classList.add('active');
  },

  bindAuthModal() {
    const modal = document.getElementById('astranov-auth-modal');
    if (!modal || modal.dataset.bound) return;
    modal.dataset.bound = '1';
    document.getElementById('auth-close')?.addEventListener('click', () => this.closeLoginModal());
    document.getElementById('auth-signin-btn')?.addEventListener('click', () => this.signInIdentifier());
    document.getElementById('auth-signup-btn')?.addEventListener('click', () => this.signUpIdentifier());
    document.getElementById('auth-phone-btn')?.addEventListener('click', () => this.signInPhoneOtp());
    document.getElementById('auth-google-continue')?.addEventListener('click', () => this.continueWithGoogle());
    document.getElementById('auth-email-link')?.addEventListener('click', () => this.sendMagicLink());
    document.getElementById('auth-email-quick')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this.sendMagicLink(); }
    });
    document.getElementById('auth-oauth-help')?.addEventListener('click', (e) => {
      e.preventDefault();
      const status = document.getElementById('auth-status');
      if (status) status.textContent = 'GCP fix: add redirect URI lkoatrkhuigdolnjsbie.supabase.co/auth/v1/callback + JS origin astranov.eu';
      ACIControl?.reply('Google OAuth needs GCP Console fix — email link works now');
    });
    modal.querySelectorAll('[data-oauth]').forEach(btn => {
      btn.addEventListener('click', () => this.signInOAuth(btn.dataset.oauth));
    });
    // Redirect OAuth only — GSI needs GCP JS origins per host and fails on astranov.eu
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

  async openLoggedInProfile() {
    if (!this.user) return this.openLoginModal();
    Responsive3D?.visualReact?.('profile', {});
    GlobeDeck?.expand?.('Your profile · 3D');
    const name = this._profileVisual?.display_name
      || this.user.user_metadata?.full_name
      || (this.user.email || '').split('@')[0]
      || 'You';
    const flyToMe = (lat, lng) => {
      if (lat == null || lng == null) return;
      GlobeEntity?.syncMe?.(lat, lng, name, { alwaysShow: true });
      const fp = latLngToPos(lat, lng, 1.04);
      const z = GlobeControl?.Z?.national || 1.82;
      const dur = GlobeControl?.flyDuration?.(camera?.position?.z, z) || 2200;
      flyToPoint?.(new THREE.Vector3(fp.x, fp.y, fp.z), z, { dur });
      GlobeControl?.noteAutoFly?.();
      MapDepict?.pulse?.(lat, lng, 0x49b7ff, name, 8000);
      ACIControl?.reply('Flying to you · ' + lat.toFixed(2) + ', ' + lng.toFixed(2));
    };
    const openProfile = (skipFly) => {
      if (!skipFly && window._lastPos) flyToMe(window._lastPos.lat, window._lastPos.lng);
      ProfileSite?.openSelf?.();
    };
    if (!navigator.geolocation) {
      openProfile(false);
      return;
    }
    GlobeDeck?.setMapStatus?.('Locating…');
    navigator.geolocation.getCurrentPosition(
      pos => {
        placeMe(pos.coords.latitude, pos.coords.longitude, { fly: true, zoom: GlobeControl?.Z?.national || 1.82 });
        openProfile(true);
      },
      () => openProfile(false),
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 15000 }
    );
  },

  publicOrigin() {
    return typeof astranovPublicOrigin === 'function' ? astranovPublicOrigin() : (location.origin || 'https://astranov.eu');
  },

  _useGoogleRedirectOnly() {
    try {
      const host = location.hostname || '';
      return host === 'astranov.eu' || host.endsWith('.astranov.eu');
    } catch (_) {
      return true;
    }
  },

  _oauthRedirectTo() {
    try {
      const url = new URL(window.location.href);
      ['code', 'error', 'error_description', 'error_code'].forEach((k) => url.searchParams.delete(k));
      url.hash = '';
      return url.origin + url.pathname + (url.search || '');
    } catch (_) {
      return this.publicOrigin() + '/';
    }
  },

  async _handleOAuthReturn() {
    if (!this.client) return;
    const params = new URLSearchParams(location.search);
    const code = params.get('code');
    const err = params.get('error') || params.get('error_description');
    if (err) return;
    if (!code) return;
    const status = document.getElementById('auth-status');
    if (status) status.textContent = 'Completing Google sign-in…';
    GlobeDeck?.setPreview?.('Signing in…');
    try {
      const { error } = await this.client.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } catch (e) {
      const msg = typeof scrubSupabaseLeak === 'function' ? scrubSupabaseLeak(e.message) : (e.message || e);
      this.openLoginModal('Google sign-in failed — ' + msg);
      ACIControl?.reply('Google sign-in failed — try email link below');
    }
  },

  openLoginModal(hint) {
    const modal = document.getElementById('astranov-auth-modal');
    if (!modal) return;
    const status = document.getElementById('auth-status');
    const origin = this.publicOrigin();
    const originEl = document.getElementById('auth-origin-url');
    if (originEl) originEl.textContent = origin;
    const inline = document.getElementById('auth-origin-inline');
    if (inline) inline.textContent = origin.replace(/^https?:\/\//, '');
    modal.classList.add('open');
    this._activateSignInPane();
    const emailQuick = document.getElementById('auth-email-quick');
    if (emailQuick && !emailQuick.value) {
      emailQuick.placeholder = this.OWNER_EMAIL;
      setTimeout(() => emailQuick.focus(), 300);
    }
    if (status) {
      status.textContent = hint || 'Continue with Google — or enter email for a sign-in link';
    }
    GlobeDeck?.expand?.('Sign in · Google or email');
    if (!hint) ACIControl?.reply('Tap Continue with Google — or use email link');
  },

  closeLoginModal() {
    document.getElementById('astranov-auth-modal')?.classList.remove('open');
  },

  _isMobileClient() {
    try {
      if (navigator.maxTouchPoints > 1 && window.innerWidth < 1024) return true;
      return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    } catch (_) {
      return false;
    }
  },

  _gsiInitialized: false,

  _ensureGoogleGsi() {
    if (window.google?.accounts?.id) return Promise.resolve();
    if (this._gsiReady) return this._gsiReady;
    this._gsiReady = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://accounts.google.com/gsi/client';
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Google sign-in script failed'));
      document.head.appendChild(s);
    });
    return this._gsiReady;
  },

  _renderGoogleButton(host) {
    if (!host || !window.google?.accounts?.id) return;
    host.innerHTML = '';
    window.google.accounts.id.renderButton(host, {
      type: 'standard',
      theme: 'filled_blue',
      size: 'large',
      text: 'signin_with',
      shape: 'pill',
      logo_alignment: 'left',
      width: Math.min(320, host.clientWidth || 280),
    });
  },

  _mountGoogleButton() {
    const host = document.getElementById('auth-google-btn');
    if (!host) return;
    this._ensureGoogleGsi().then(() => {
      if (!this.GOOGLE_CLIENT_ID) return;
      this._initGoogleCredential();
      this._renderGoogleButton(host);
    }).catch(() => {});
  },

  _initGoogleCredential() {
    if (this._gsiInitialized || !window.google?.accounts?.id || !this.GOOGLE_CLIENT_ID) return;
    this._gsiInitialized = true;
    const origin = this.publicOrigin();
    window.google.accounts.id.initialize({
      client_id: this.GOOGLE_CLIENT_ID,
      callback: async (resp) => {
        const status = document.getElementById('auth-status');
        try {
          if (!resp?.credential) throw new Error('Google sign-in cancelled');
          if (status) status.textContent = 'Signing in…';
          const { data, error } = await this.client.auth.signInWithIdToken({
            provider: 'google',
            token: resp.credential,
          });
          if (error) throw error;
          this.closeLoginModal();
          ACIControl?.reply('Signed in at ' + origin);
          return data;
        } catch (e) {
          const msg = typeof scrubSupabaseLeak === 'function' ? scrubSupabaseLeak(e.message) : (e.message || e);
          if (/invalid_client|no registered origin|401/i.test(msg)) {
            if (status) status.textContent = 'Trying alternate sign-in…';
            try { await this._signInGoogleRedirect(); return; } catch (_) {}
          }
          if (status) status.textContent = msg;
          ACIControl?.reply('Google sign-in failed — ' + msg);
        }
      },
      auto_select: false,
      cancel_on_tap_outside: true,
      context: 'signin',
      itp_support: true,
    });
  },

  async continueWithGoogle() {
    if (!this.client) return;
    return this._signInGoogleRedirect();
  },

  async sendMagicLink() {
    if (!this.client) return;
    const status = document.getElementById('auth-status');
    const emailEl = document.getElementById('auth-email-quick');
    let email = this._normalizeId(emailEl?.value || document.getElementById('auth-identifier')?.value);
    if (!email || !email.includes('@')) {
      email = this.OWNER_EMAIL;
      if (emailEl) emailEl.value = email;
    }
    try {
      if (status) status.textContent = 'Sending link to ' + email + '…';
      const redirectTo = window.location.origin + window.location.pathname;
      const { error } = await this.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo, shouldCreateUser: true },
      });
      if (error) throw error;
      if (status) status.textContent = '✓ Link sent to ' + email + ' — open Gmail on THIS phone · check spam · tap Astranov link';
      ACIControl?.reply('Email sent — open inbox on this phone');
    } catch (e) {
      const msg = typeof scrubSupabaseLeak === 'function' ? scrubSupabaseLeak(e.message) : (e.message || e);
      if (status) status.textContent = msg;
      ACIControl?.reply('Email sign-in failed — ' + msg);
    }
  },

  async signInGoogle() {
    if (!this.client) return;
    const origin = this.publicOrigin();
    GlobeDeck?.setPreview?.('Sign in · ' + origin);
    return this._signInGoogleRedirect();
  },

  async _signInGoogleRedirect() {
    if (!this.client) return;
    const origin = this.publicOrigin();
    const status = document.getElementById('auth-status');
    if (status) status.textContent = 'Opening Google… returning to ' + origin.replace(/^https?:\/\//, '');
    GlobeDeck?.setPreview?.('Sign in · ' + origin);
    ACIControl?.reply('Opening Google sign-in…');
    const redirectTo = this._oauthRedirectTo();
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        scopes: 'email profile',
        queryParams: { prompt: 'select_account', access_type: 'offline' },
        skipBrowserRedirect: false,
      },
    });
    if (error) {
      const msg = typeof scrubSupabaseLeak === 'function' ? scrubSupabaseLeak(error.message) : error.message;
      this.openLoginModal('Google sign-in failed — ' + msg);
      ACIControl?.reply('Google failed — use email sign-in link');
      throw error;
    }
    if (data?.url) window.location.assign(data.url);
  },

  async signInOAuth(provider) {
    if (!this.client) return;
    if (provider === 'google') return this.continueWithGoogle();
    if (provider === 'tiktok') {
      ACIControl?.reply('TikTok login — enable custom OIDC in Supabase, then wire provider tiktok.');
      return;
    }
    if (!this.OAUTH_PROVIDERS.includes(provider)) return;
    this.closeLoginModal();
    const origin = this.publicOrigin();
    GlobeDeck?.setPreview?.('Sign in · ' + origin);
    ACIControl?.reply('Sign in at ' + origin + ' with ' + provider);
    const redirectTo = this._oauthRedirectTo();
    const { data, error } = await this.client.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        scopes: provider === 'facebook' ? 'email profile' : undefined,
      },
    });
    if (data?.url) window.location.assign(data.url);
    if (error) throw error;
  },

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
      if (status) status.textContent = typeof scrubSupabaseLeak === 'function' ? scrubSupabaseLeak(e.message) : (e.message || 'Sign in failed');
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

  async whenReady() {
    return this.ensureSession();
  },

  async ensureSession() {
    if (!this.client) return null;
    if (this.session?.access_token) {
      const exp = this.session.expires_at ? this.session.expires_at * 1000 : 0;
      if (!exp || exp >= Date.now() + 120000) return this.session;
    }
    const { data } = await this.client.auth.getSession();
    let session = data?.session || null;
    if (!session?.access_token) return null;
    const exp = session.expires_at ? session.expires_at * 1000 : 0;
    if (exp && exp < Date.now() + 120000) {
      const { data: refreshed, error } = await this.client.auth.refreshSession();
      if (!error && refreshed?.session) {
        session = refreshed.session;
        this._authDegraded = false;
      } else if (this.user) {
        this._authDegraded = true;
        this.applyUser();
      }
    }
    this.session = session;
    return session;
  },

  async loadProfileVisual() {
    if (!this.client || !this.user?.id) return;
    try {
      const { data } = await this.client.from('profiles')
        .select('display_name, avatar_emoji')
        .eq('id', this.user.id)
        .maybeSingle();
      if (data) {
        this._profileVisual = data;
        this.applyUser();
      }
    } catch (_) {}
  },

  async authHeaders() {
    const h = { 'Content-Type': 'application/json', apikey: SB_KEY };
    let token = this.session?.access_token;
    if (!token) {
      const session = await this.ensureSession();
      token = session?.access_token;
    }
    h.Authorization = token ? 'Bearer ' + token : 'Bearer ' + SB_KEY;
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
      window._aciOwner = false;
      this.updateOwnerUI();
      return;
    }
    const email = (this.user.email || '').toLowerCase();
    // Architect email is authoritative — paid XAI + build bridge only for this account
    this.isArchitect = email === this.OWNER_EMAIL.toLowerCase();
    this.isOwner = this.isArchitect;
    if (this.isArchitect) {
      window._aciOwner = true;
      // Free/SuperGrok first — paid XAI_API_KEY only after free limit (server + notify)
      AciCoders.fallbackPrefs = { force: 'groq', skip: ['xai'] };
      AciCoders.savePrefs?.();
      AiRouter?.setProvider?.('grok');
    } else {
      if (AciCoders?.fallbackPrefs) {
        AciCoders.fallbackPrefs.force = 'groq';
        AciCoders.fallbackPrefs.skip = ['xai'];
      }
    }
    try {
      const r = await fetch(ACI.url + '/functions/v1/aci', {
        method: 'POST',
        headers: await this.authHeaders(),
        body: JSON.stringify({ mode: 'owner_sync' })
      }).then(res => res.json());
      if (r.is_owner || r.is_architect) {
        this.isOwner = true;
        this.isArchitect = this.isArchitect || r.is_architect === true || email === this.OWNER_EMAIL.toLowerCase();
      }
      if (this.isOwner) {
        window._aciOwner = true;
        ACI?.feed('owner-sync', email);
      }
    } catch (_) {
      if (this.client && !this.isArchitect) {
        const { data: prof } = await this.client.from('profiles').select('is_owner').eq('id', this.user.id).single();
        this.isOwner = prof?.is_owner === true;
      }
    }
    this.updateOwnerUI();
    if (this.isArchitect) {
      ACIControl?.reply?.('Architect online · Bridge ready · fix / code from the street');
      // Public users never see this line; architect-only mission tone OK here
      CliRibbon?.setNotice?.('Bridge armed · fix/dev', 'ready');
      ArchitectBridge?.arm?.({ quiet: true });
    } else {
      ArchitectBridge?.disarm?.();
    }
    if (window.FieldBrain) FieldBrain.onAuth();
    if (window.AciCli) AciCli.onAuthChange();
    this.loadProfileVisual();
    ContextTruth?.syncAuth?.();
  },

  updateOwnerUI() {
    const chip = document.getElementById('user-chip');
    if (this.isOwner && chip) {
      chip.textContent = 'ASTRANOV · OWNER';
      chip.style.color = '#00dd77';
    }
    if (this.isOwner) CliRibbon?.setActive?.('owner');
    const prompt = document.getElementById('aci-cli-prompt');
    if (prompt && this.isOwner) prompt.textContent = 'ASTRANOV@collective $';
    const bridgeBtn = document.getElementById('aci-bridge');
    if (bridgeBtn) bridgeBtn.hidden = !this.isArchitect;
    SuperCli?.setContext?.(SuperCli?.inferContext?.() || 'idle');
    ArchitectBridge?._bindUi?.();
  },

  async signOut() {
    if (!this.client) return;
    await AstranovPresence?.leave?.();
    await this.client.auth.signOut();
    this.user = null;
    this.session = null;
    this.isOwner = false;
    this.isArchitect = false;
    this._siteOwners.clear();
    window._aciOwner = false;
    ArchitectBridge?.disarm?.();
    this.applyUser();
    this.updateOwnerUI();
    this.broadcastToShell();
    ArcangeloDialect?.reset?.();
    if (Voice.maySpeak()) speak('Signed out.', () => {}, true);
  },

  applyUser() {
    const btn = document.getElementById('aci-login');
    const chip = document.getElementById('user-chip');
    if (this.user) {
      const isOwner = AstranovSession?.isAstranov?.()
        || this.isOwner || this.isArchitect
        || (this.user.email || '').toLowerCase() === this.OWNER_EMAIL.toLowerCase();
      const name = isOwner ? 'ASTRANOV' : (
        this._profileVisual?.display_name
        || this.user.user_metadata?.full_name
        || this.user.user_metadata?.name
        || (this.user.email || '').split('@')[0]
        || 'User'
      );
      const avatar = this.user.user_metadata?.avatar_url
        || this.user.user_metadata?.picture;
      const emoji = this._profileVisual?.avatar_emoji;
      if (btn) {
        btn.classList.remove('auth-out', 'auth-boot');
        btn.classList.add(this._authDegraded ? 'auth-degraded' : 'auth-in');
        btn.dataset.auth = this._authDegraded ? 'degraded' : 'in';
        btn.title = (this._authDegraded ? 'Session refreshing · ' : 'Signed in · ') + name + ' — tap to fly to you & edit profile';
        btn.style.backgroundSize = 'cover';
        btn.style.backgroundPosition = 'center';
        if (avatar) {
          btn.style.backgroundImage = 'url(' + avatar + ')';
          btn.textContent = '';
        } else if (emoji) {
          btn.style.backgroundImage = '';
          btn.textContent = emoji;
          btn.style.fontSize = '18px';
        } else {
          btn.textContent = name.charAt(0).toUpperCase();
          btn.style.backgroundImage = '';
          btn.style.fontSize = '13px';
        }
      }
      if (chip && !this.isOwner) {
        chip.textContent = name + (this._authDegraded ? ' · ⟳' : ' · ●');
        chip.style.color = this._authDegraded ? '#ffaa44' : '';
      }
      AstranovSession?._applyIdentity?.();
      if (typeof me !== 'undefined' && me) {
        me.name = name;
        me.id = this.user.id;
        me.email = this.user.email;
        me.isOwner = this.isOwner;
        me.isGuest = false;
      }
      AstranovSession?.onAuth?.();
      AstranovPresence?.join?.();
      ACI?.feed('login', name);
      if (window.AciCli) AciCli.onAuthChange();
      FieldBrain?.updateChip?.();
      CliRibbon?.render?.();
      ContextTruth?.syncAuth?.();
    } else {
      if (btn) {
        btn.classList.remove('auth-in', 'auth-degraded');
        btn.classList.add(this._authBoot ? 'auth-boot' : 'auth-out');
        btn.dataset.auth = 'out';
        btn.title = 'Sign in at astranov.eu — Google · email · phone';
        btn.textContent = 'G';
        btn.style.backgroundImage = '';
        btn.style.fontSize = '13px';
      }
      if (chip) {
        chip.textContent = '';
        chip.style.color = '';
      }
      if (window.AciCli) AciCli.onAuthChange();
      CliRibbon?.render?.();
      ContextTruth?.syncAuth?.();
    }
  }
};
window.Auth = Auth;

/* === 13-globe-deck.js === */
// === GLOBE DECK — one scrollable window over the globe ===
const GlobeDeck = {
  expanded: false,
  activeTask: null,
  thinking: false,
  _size: 'collapsed',
  _touchY: 0,
  _touchT: 0,
  _collapseTimer: null,
  _thinkLine: null,
  _composeLine: null,
  _lastSay: '',
  _lastSayT: 0,
  _userEngaged: false,
  _expandAt: 0,
  _handleDrag: 0,
  _lastResizeDrag: 0,
  _freeHeight: 0,
  _HEIGHT_KEY: 'astranov-deck-height',
  _scrollTouch: false,
  _NOISE_RE: /^(thinking|warming|owner-sync|heartbeat|field_pulse|subscribe|channel joined|token refresh|postgres_changes|Map live|Ghost route|hands-free on|Coders always|session held|pull failed)/i,

  init() {
    CliRibbon?.init?.();
    AppShortcuts?.init?.();
    this._restoreHeight();
    this.bindDeckResize();
    this.bindDeckGestures();
    ['sat-radio', 'node-batch', 'vendor-menu', 'globe-youtube', 'globe-super-add', 'globe-site-browser', 'cli-hub-panel'].forEach(id => {
      const el = document.getElementById(id);
      const stage = document.getElementById('globe-deck-stage');
      if (el && stage && el.parentElement !== stage) stage.appendChild(el);
    });
    CliRibbon?.setActive?.('CLI');
    if (this._size === 'free' && this._freeHeight) this.applySize();
  },

  _deckMinH() { return 118; },
  _deckMaxH() { return Math.min(window.innerHeight * 0.94, window.innerHeight - 36); },

  _deckInteractive(target) {
    return target?.closest?.('button, input, textarea, select, form, a, [contenteditable], #aci-cli-form, label');
  },

  _deckCanScroll(el, fingerDy) {
    if (!el) return false;
    const max = el.scrollHeight - el.clientHeight;
    if (max < 4) return false;
    if (fingerDy < 0 && el.scrollTop > 0) return true;
    if (fingerDy > 0 && el.scrollTop < max - 1) return true;
    return false;
  },

  bindDeckResize() {
    const deck = this.deck();
    if (!deck || deck._resizeBound) return;
    deck._resizeBound = true;
    let active = false;
    let resizing = false;
    let sy = 0;
    let sh = 0;
    let moved = 0;
    let scrollEl = null;

    const applyHeight = (nh) => {
      const d = this.deck();
      if (!d) return;
      nh = Math.min(this._deckMaxH(), Math.max(this._deckMinH(), nh));
      d.style.maxHeight = nh + 'px';
      d.style.minHeight = nh + 'px';
      d.classList.remove('collapsed', 'size-third', 'size-full');
      d.classList.add('expanded', 'deck-resizing');
      this.expanded = nh > 130;
      this._size = 'free';
      if (window.AciCli) AciCli.open = this.expanded;
    };

    const finish = () => {
      const d = this.deck();
      if (!d) return;
      d.classList.remove('deck-resizing');
      if (resizing || moved > 10) {
        this._lastResizeDrag = Date.now();
        const h = d.getBoundingClientRect().height;
        if (h < 130) this._size = 'collapsed';
        else { this._size = 'free'; this._saveHeight(h); }
        this.applySize();
      }
      active = false;
      resizing = false;
      scrollEl = null;
      moved = 0;
    };

    const onMove = (clientY, e) => {
      if (!active) return;
      const dy = sy - clientY;
      moved = Math.max(moved, Math.abs(dy));
      if (!resizing && scrollEl && this._deckCanScroll(scrollEl, dy) && moved < 28) return;
      if (moved < 6) return;
      resizing = true;
      if (e?.cancelable) e.preventDefault();
      applyHeight(sh + dy);
    };

    const onStart = (clientY, target) => {
      if (this._deckInteractive(target)) return;
      scrollEl = target?.closest?.('#globe-deck-log, #globe-deck-stage');
      active = true;
      resizing = false;
      sy = clientY;
      sh = deck.getBoundingClientRect().height;
      moved = 0;
    };

    deck.addEventListener('touchstart', (e) => {
      if (e.touches.length !== 1) return;
      onStart(e.touches[0].clientY, e.target);
    }, { passive: true });

    deck.addEventListener('touchmove', (e) => {
      if (!active || e.touches.length !== 1) return;
      onMove(e.touches[0].clientY, e);
    }, { passive: false });

    deck.addEventListener('touchend', () => finish(), { passive: true });
    deck.addEventListener('touchcancel', () => finish(), { passive: true });

    deck.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      if (this._deckInteractive(e.target)) return;
      onStart(e.clientY, e.target);
    });

    window.addEventListener('mousemove', (e) => {
      if (!active) return;
      onMove(e.clientY, e);
    });

    window.addEventListener('mouseup', () => {
      if (!active) return;
      finish();
    });
  },

  _isMobileDeck() {
    try {
      return (navigator.maxTouchPoints > 0 && window.innerWidth < 900)
        || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');
    } catch (_) {
      return window.innerWidth < 900;
    }
  },

  _mobileDeckCap() {
    return Math.min(Math.round(window.innerHeight * 0.38), 320);
  },

  _restoreHeight() {
    try {
      const h = parseInt(localStorage.getItem(this._HEIGHT_KEY), 10);
      const maxH = this._isMobileDeck() ? this._mobileDeckCap() : Math.min(window.innerHeight * 0.94, window.innerHeight - 36);
      if (h >= 118 && h <= maxH) {
        this._freeHeight = Math.min(h, maxH);
      }
    } catch (_) { /* */ }
    this._size = 'collapsed';
    this.expanded = false;
  },

  _saveHeight(h) {
    this._freeHeight = Math.round(h);
    try { localStorage.setItem(this._HEIGHT_KEY, String(this._freeHeight)); } catch (_) { /* */ }
  },

  cycleSize() {
    const order = ['collapsed', 'third', 'full'];
    const i = order.indexOf(this._size);
    this._size = order[(i + 1) % order.length];
    this.applySize();
  },

  applySize() {
    const d = this.deck();
    if (!d) return;
    d.style.maxHeight = '';
    d.style.minHeight = '';
    d.classList.remove('collapsed', 'expanded', 'size-third', 'size-full', 'size-free');
    if (this._size === 'collapsed') {
      d.classList.add('collapsed');
      this.expanded = false;
      if (window.AciCli) AciCli.open = false;
    } else if (this._size === 'free' && this._freeHeight) {
      d.classList.add('expanded', 'size-free');
      d.style.maxHeight = this._freeHeight + 'px';
      d.style.minHeight = this._freeHeight + 'px';
      this.expanded = true;
      if (window.AciCli) AciCli.open = true;
    } else {
      d.classList.add('expanded', this._size === 'full' ? 'size-full' : 'size-third');
      this.expanded = true;
      if (window.AciCli) AciCli.open = true;
    }
    CliRibbon?.render?.();
  },

  bindDeckGestures() {
    /* scroll lives in log/stage via touch-action:pan-y; resize is bindDeckResize on whole deck */
  },

  deck() { return document.getElementById('globe-deck'); },
  logEl() { return document.getElementById('globe-deck-log'); },

  setTitle(text) {
    CliRibbon?.setActive?.(text || CliRibbon?.TASK_LABEL?.[this.activeTask] || 'CLI');
  },

  _repairLine(text, kind) {
    return ArcangeloDialect?.repairOutbound?.(text, kind) ?? String(text || '');
  },

  setPreview(text) {
    const s = this._repairLine(text, 'out').slice(0, 120);
    if (s && CliRibbon?.isGlobeHint?.(s)) return;
    if (s) CliRibbon?.setNotice?.(s);
    else CliRibbon?.clearNotice?.();
    if (!this.expanded && s) this.deck()?.classList.add('has-preview');
    else if (!s) this.deck()?.classList.remove('has-preview');
  },

  setMapStatus(text) {
    const s = this._repairLine(text, 'map');
    if (!s || CliRibbon?.isGlobeHint?.(s)) return;
    this.setPreview(s);
  },

  shouldLog(text, kind) {
    const t = String(text || '').trim();
    if (!t) return false;
    if (CliRibbon?.isGlobeHint?.(t)) return false;
    if (kind !== 'reply' && kind !== 'ok' && kind !== 'out' && kind !== 'err' && kind !== 'cmd' && CliRibbon?.MOTTO_RE?.test(t)) return false;
    if (this._NOISE_RE.test(t)) return false;
    if (kind === 'dim' && /^(◎|…|\.{2,})\s/.test(t) && t.length < 90) return false;
    if (/^\{.*\}$/.test(t) || /^HTTP \d/.test(t)) return false;
    return true;
  },

  setCompose(text) {
    const t = String(text || '');
    if (this._composeLine?.parentNode) this._composeLine.remove();
    this._composeLine = null;
    const input = document.getElementById('aci-cli-in');
    if (!input) return;
    if (t && document.activeElement !== input && !input.value) {
      input.value = t;
      if (window.AciCli) AciCli.buffer = t;
    }
    window.resizeCliInput?.(input);
  },

  clearCompose() {
    this.setCompose('');
    const input = document.getElementById('aci-cli-in');
    if (input) {
      input.value = '';
      input.style.height = 'auto';
    }
    if (window.AciCli) AciCli.buffer = '';
  },

  log(text, cls) {
    const kind = cls || 'out';
    const repaired = this._repairLine(text, kind);
    if (kind === 'map') {
      this.setMapStatus(repaired);
      return;
    }
    if (!this.shouldLog(repaired, kind)) return;
    const out = this.logEl();
    if (!out) return;
    if (kind === 'dim') {
      if (this._thinkLine?.parentNode) {
        this._thinkLine.textContent = repaired;
        return;
      }
      const el = document.createElement('div');
      el.className = 'deck-line deck-dim';
      el.textContent = repaired;
      out.appendChild(el);
      while (out.children.length > 48) out.removeChild(out.firstChild);
      out.scrollTop = out.scrollHeight;
      return;
    }
    const key = kind + ':' + repaired.slice(0, 100);
    const now = Date.now();
    if (this._lastSay === key && now - this._lastSayT < 5000) return;
    this._lastSay = key;
    this._lastSayT = now;
    if (kind === 'cmd' || kind === 'err') this.expand();
    else if (this._userEngaged && this.expanded && (kind === 'reply' || kind === 'out' || kind === 'ok')) { /* stay open */ }
    const row = document.createElement('div');
    row.className = 'deck-line deck-' + kind;
    row.textContent = repaired;
    out.appendChild(row);
    while (out.children.length > 48) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
    if (kind === 'reply' || kind === 'out' || kind === 'ok') {
      this._userEngaged = true;
      this.setPreview(repaired);
      CliRibbon?.setNotice?.(repaired.slice(0, 120), 'ready');
      const prev = document.getElementById('globe-deck-preview');
      if (prev) prev.textContent = repaired.slice(0, 120);
      if (!this.expanded && this._isMobileDeck()) {
        this.deck()?.classList.add('has-preview');
        this.ping();
      }
    }
    if (kind === 'err') CliRibbon?.setNotice?.(repaired, 'err');
    if (this._userEngaged && (kind === 'reply' || kind === 'out' || kind === 'err')) this.ping();
    if (kind !== 'dim' && kind !== 'map') window.CliHub?.queueLine?.(repaired, kind);
  },

  say(text, cls) {
    this.log(text, cls || 'out');
  },

  onUserMessage(title) {
    this._userEngaged = true;
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    const t = title || 'Collective — listening';
    this.setTitle(t);
    this.setPreview(t);
    if (!this._isMobileDeck()) this.expand(t);
    this.ping();
  },

  ping() {
    const d = this.deck();
    if (!d) return;
    d.classList.remove('deck-ping');
    void d.offsetWidth;
    d.classList.add('deck-ping');
    setTimeout(() => d.classList.remove('deck-ping'), 1200);
  },

  setThinking(on, hint) {
    if (this._thinkWatchdog) { clearTimeout(this._thinkWatchdog); this._thinkWatchdog = null; }
    this.thinking = !!on;
    const d = this.deck();
    if (d) d.classList.toggle('deck-thinking', this.thinking);
    if (on && hint) CliRibbon?.setNotice?.(hint, 'thinking');
    CliRibbon?.render?.();
    if (on) {
      this.setPreview(hint || '… thinking');
      if (!this._isMobileDeck()) this.expand(hint || 'Collective — thinking…');
      const out = this.logEl();
      if (out && this.expanded) {
        if (this._thinkLine?.parentNode) this._thinkLine.remove();
        this._thinkLine = document.createElement('div');
        this._thinkLine.className = 'deck-line deck-dim deck-thinking-line';
        this._thinkLine.textContent = this._repairLine(hint || '… thinking', 'dim');
        out.appendChild(this._thinkLine);
        out.scrollTop = out.scrollHeight;
      }
      this._thinkWatchdog = setTimeout(() => {
        this._thinkWatchdog = null;
        if (this.thinking) this.setThinking(false);
      }, 45000);
    } else if (this._thinkLine?.parentNode) {
      this._thinkLine.remove();
      this._thinkLine = null;
    }
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
    if (title && (!this.expanded || now - this._expandAt > 400)) this.setTitle(title);
    this._expandAt = now;
    if (this._size === 'collapsed') {
      if (this._isMobileDeck()) {
        this._size = 'third';
        this._freeHeight = 0;
      } else {
        const cap = this._mobileDeckCap();
        this._size = (this._freeHeight > 130 && this._freeHeight <= cap) ? 'free' : 'third';
      }
    }
    this.applySize();
    if (window.AciCli) AciCli.open = true;
  },

  bootCollapsed() {
    this._size = 'collapsed';
    this.expanded = false;
    this._userEngaged = false;
    this.thinking = false;
    this.applySize();
    this.deck()?.classList.remove('deck-thinking', 'has-preview', 'deck-ping');
    CliRibbon?.clearNotice?.();
  },

  bootReady() {
    this._userEngaged = false;
    this.thinking = false;
    this._size = 'third';
    this.expanded = true;
    this.applySize();
    this.setTitle(window.PublicCopy?.deckTitle?.() || 'Astranov');
    this.setPreview(window.PublicCopy?.isArchitect?.()
      ? 'Architect · fix · task · starship'
      : 'Type or 🎧 · 🎯 city · + post · date · hire · order');
    this.deck()?.classList.add('has-preview');
    CliRibbon?.setNotice?.(window.PublicCopy?.readyNotice?.() || 'Ready', 'ready');
    if (window.AciCli) AciCli.open = true;
  },

  superAction(action) {
    this._userEngaged = true;
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    const base = window.PublicCopy?.deckTitle?.() || 'Astranov';
    // Public: no "collective / mission" jargon
    const tag = action && action !== 'collective' ? (' — ' + action) : '';
    this.expand(base + tag);
  },

  collapse() {
    this._size = 'collapsed';
    this._userEngaged = false;
    this.applySize();
  },

  toggle() {
    this.cycleSize();
  },

  showStage(panelId, task, title) {
    this.hideStage();
    this.activeTask = task || panelId;
    const stage = document.getElementById('globe-deck-stage');
    const d = this.deck();
    if (!stage) return;
    const panel = document.getElementById(panelId);
    if (panel) {
      panel.classList.add('deck-active', 'open');
      if (d) d.classList.add('has-stage');
    } else if (d) {
      d.classList.remove('has-stage');
    }
    this.expand(title || this.stageTitle(panelId));
    AppShortcuts?.track?.(task || panelId, title || this.stageTitle(panelId));
    SuperCli?.setContext?.(SuperCli.inferContext?.());
    ContextTruth?.sync?.();
    AppShortcuts?.render?.();
  },

  hideStage() {
    const stage = document.getElementById('globe-deck-stage');
    if (stage) {
      stage.querySelectorAll('.deck-active').forEach(el => {
        el.classList.remove('deck-active', 'open');
      });
    }
    this.deck()?.classList.remove('has-stage');
    if (window.PmrRadio) PmrRadio.open = false;
    if (window.AstranovNode) window.AstranovNode._open = false;
  },

  stageTitle(panelId) {
    const titles = {
      'vendor-menu': 'Καταστήματα · παραγγελία',
      'node-batch': 'Work together · Astranov node',
      'sat-radio': 'EU PMR Ch 11 · comms',
      'globe-youtube': 'YouTube on globe',
      'globe-super-add': 'Super Add · post video',
      'cli-hub-panel': 'CLI · search & chats',
    };
    return titles[panelId] || 'Collective — globe deck';
  },

  completeTask(task) {
    const keep = ['coders', 'radio', 'batch', 'commerce'];
    if (task === 'cli' && this.activeTask && keep.includes(this.activeTask)) return;
    if (this.activeTask && this.activeTask !== task && task !== 'cli') return;
    if (this._collapseTimer) { clearTimeout(this._collapseTimer); this._collapseTimer = null; }
    const done = task === 'cli' ? this.activeTask : task;
    this.hideStage();
    this.collapse();
    this.activeTask = null;
    if (done) AppShortcuts?.untrack?.(done);
    CliRibbon?.setActive?.('CLI');
    CliRibbon?.clearNotice?.();
    SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
    AppShortcuts?.render?.();
  },

  isOneShotCmd(cmd) {
    const one = new Set([
      'think', 'evolve', 'teach', 'stats', 'owner', 'seed', 'distill', 'council',
      'mode', 'locate', 'gps', 'me', 'drive', 'news', 'roles', 'claim', 'field_stats',
      'deploy', 'help', '?', 'clear', 'logout', 'connect', 'open', 'vendor',
      'dev', 'ui', 'brain', 'status', 'space', 'superspace', 'scenario',
    ]);
    return one.has((cmd || '').toLowerCase());
  },

  finishCliIfOneShot(cmd) {
    if (!this.isOneShotCmd(cmd)) return;
    if (this.activeTask && ['coders', 'radio', 'batch', 'commerce'].includes(this.activeTask)) return;
    if (this._collapseTimer) clearTimeout(this._collapseTimer);
    this._collapseTimer = setTimeout(() => {
      this._collapseTimer = null;
      if (!this.thinking) this.completeTask('cli');
    }, 8000);
  },
};
window.GlobeDeck = GlobeDeck;

/* === 13-cli-ribbon.js === */
// === CLI RIBBON — one top bar: account · apps · status · + · expand ===
var CliRibbon = {
  _active: 'CLI',
  _notice: '',
  _kind: 'idle',

  TASK_LABEL: {
    coders: 'Grok',
    commerce: 'Shops',
    batch: 'Batch',
    radio: 'PMR',
    video: 'Video',
    add: 'Post',
    drive: 'Drive',
    phone: 'Phone',
    site: 'Site',
    cli: 'CLI',
    chats: 'Chats',
    dm: 'DM',
    team: 'Team',
    game: 'ΚΡΥΦΤό',
    telemachos: 'Pilot',
    compromised: '⚠ Alert',
    guest: 'Guest',
  },

  MOTTO_RE: /justice\s*→\s*truth\s*→\s*freedom|collective intelligence|Astranov\s*—|architect\s*·\s*collective|δικαιοσύνη|αλήθεια|ελευθερία/gi,
  GLOBE_HINT_RE: /city map|scroll\/pinch|pinch\/scroll|pinch out|return to globe|zoom.tier|zoom out|zoom in|double.tap|drag to spin/i,

  init() {
    const bar = document.getElementById('super-cli-bar');
    const header = document.getElementById('globe-deck-header');
    const fab = document.getElementById('super-add-fab');

    if (header) header.style.display = 'none';

    let status = document.getElementById('cli-ribbon-status');
    if (!status && bar) {
      status = document.createElement('span');
      status.id = 'cli-ribbon-status';
      status.setAttribute('aria-live', 'polite');
      if (fab) bar.insertBefore(status, fab);
      else bar.appendChild(status);
    }
    this._el = status;

    GlobeDeck?.bindHandle?.();

    this._active = 'CLI';
    this.render();
  },

  shorten(text) {
    let s = String(text || '').trim();
    if (!s) return '';
    s = s.replace(this.MOTTO_RE, '').replace(/\s+/g, ' ').trim();
    s = s.replace(/^Astranov\b/i, 'Astranov');
    s = s.replace(/\bcollective intelligence\b/gi, 'Astranov');
    s = s.replace(/\bNear-Earth orbit\b/gi, 'Above Earth');
    s = s.replace(/\bconstellations?\b/gi, 'sky');
    s = s.replace(/^Collective Coders\s*—\s*talk here$/i, 'Coders');
    s = s.replace(/^Coders online\s*—.*$/i, 'Coders');
    s = s.replace(/warming up.*$/i, '').trim();
    const low = s.toLowerCase();
    for (const [key, label] of Object.entries(this.TASK_LABEL)) {
      if (low === key || low.startsWith(key + ' ') || low.includes(key)) return label;
    }
    if (/^cli\b/i.test(s)) return 'CLI';
    if (s.length > 28) s = s.slice(0, 28).trim() + '…';
    return s || 'CLI';
  },

  setActive(text) {
    this._active = this.shorten(text) || this.TASK_LABEL[GlobeDeck?.activeTask] || 'CLI';
    this.render();
  },

  isGlobeHint(text) {
    return this.GLOBE_HINT_RE.test(String(text || ''));
  },

  clearGlobeHint() {
    if (this._notice && this.isGlobeHint(this._notice)) this.clearNotice();
  },

  setNotice(text, kind) {
    if (this.isGlobeHint(text)) return;
    const raw = String(text || '').trim();
    const s = (kind === 'ready' || kind === 'thinking')
      ? (raw.length > 100 ? raw.slice(0, 100).trim() + '…' : raw)
      : this.shorten(text);
    this._notice = s;
    if (kind) this._kind = kind;
    else if (/error|fail|denied/i.test(s)) this._kind = 'err';
    else if (/⏸|held|pause/i.test(s)) this._kind = 'hold';
    else if (/ready|located|on globe/i.test(s)) this._kind = 'ready';
    else if (s) this._kind = 'info';
    else this._kind = 'idle';
    this.render();
  },

  clearNotice() {
    this._notice = '';
    if (this._kind !== 'err') this._kind = 'idle';
    this.render();
  },

  render() {
    if (!this._el) return;
    const parts = [];
    const task = GlobeDeck?.activeTask;
    const active = this.TASK_LABEL[task] || this._active || 'CLI';
    parts.push(active);

    const open = AppShortcuts?._order?.filter(id => id !== task) || [];
    if (open.length) {
      parts.push('+' + open.map(id => AppShortcuts?.APPS?.[id]?.title || id).join(','));
    }

    if (GlobeDeck?.thinking) parts.push('thinking…');
    if ((typeof sessionHeld !== 'undefined' && sessionHeld) || SessionHold?.isHeld?.()) parts.push('held');
    if (window._handsFreeVoice) parts.push('hands-free');
    else if (isListening) parts.push('listening');

    if (Auth?.user) {
      const who = Auth._profileVisual?.avatar_emoji
        || (Auth.user.user_metadata?.full_name || Auth.user.email?.split('@')[0] || 'user').slice(0, 12);
      parts.push((Auth._authDegraded ? '⟳ ' : '● ') + who);
    } else parts.push('guest · sign in');

    if (window.SlumberManager?.tier && window.SlumberManager.tier !== 'full') {
      parts.push('⚡' + (window.SlumberManager.TIER_LABEL[window.SlumberManager.tier] || window.SlumberManager.tier));
    }
    if (this._notice) parts.push(this._notice);

    const line = parts.filter(Boolean).join(' · ').slice(0, 140);
    this._el.textContent = line;
    this._el.title = line;
    this._el.className = 'cli-ribbon-status'
      + (GlobeDeck?.thinking ? ' thinking' : '')
      + (this._kind === 'err' ? ' alert' : '')
      + (this._kind === 'hold' ? ' hold' : '')
      + (this._kind === 'ready' ? ' ready' : '');

    const title = document.getElementById('globe-deck-title');
    const preview = document.getElementById('globe-deck-preview');
    if (title) title.textContent = active;
    if (preview) preview.textContent = this._notice || '';
  },
};
window.CliRibbon = CliRibbon;

/* === 15-super-cli.js === */
// === SUPER CLI — one window: toolbar + log + stage + input ===
// Public: "Astranov". Architect only: mission CLI tone.
const ACL_TITLE = 'Astranov';

const SuperCli = {
  _bound: false,
  _context: 'idle',
  get title() {
    return window.PublicCopy?.deckTitle?.() || 'Astranov';
  },

  // Trust bar: Sign-in · Locate · + · AI (provider/order available but may be CSS-hidden)
  TOOLBAR_VISIBLE: ['aci-login', 'aci-locate', 'aci-handsfree', 'aci-bridge', 'super-add-fab', 'aci-provider', 'aci-order'],
  INPUT_BTNS: ['globe-deck-send'],

  init() {
    if (this._bound) return;
    this._bound = true;
    this.bindToolbar();
    this.bindInputBar();
    this.setContext(this.inferContext());
    CliRibbon?.setActive?.('CLI');
  },

  inferContext() {
    if (window.ContextTruth?.infer) return window.ContextTruth.infer().ctx;
    if (window.DrivingView?.active) return 'drive';
    const task = GlobeDeck?.activeTask;
    if (task === 'commerce') return 'commerce';
    if (task === 'batch') return 'batch';
    if (task === 'radio') return 'radio';
    if (task === 'phone') return 'phone';
    if (task === 'add') return 'add';
    if (task === 'coders') return 'coders';
    if (task === 'chats') return 'chats';
    if (!Auth?.user) return 'guest';
    return 'idle';
  },

  setContext(ctx) {
    this._context = ctx || 'idle';
    const bar = document.getElementById('super-cli-bar');
    if (!bar) return;
    bar.dataset.ctx = this._context;
    const allowed = new Set(this.TOOLBAR_VISIBLE);
    bar.querySelectorAll('button').forEach(btn => {
      if (btn.classList.contains('app-shortcut-btn') && btn.id !== 'aci-locate') return;
      if (btn.id === 'aci-bridge') {
        btn.hidden = !(Auth?.isArchitect && allowed.has('aci-bridge'));
        return;
      }
      // Always keep locate + handsfree + + visible
      if (btn.id === 'aci-locate' || btn.id === 'aci-handsfree' || btn.id === 'super-add-fab' || btn.id === 'aci-login') {
        btn.hidden = false;
        btn.style.display = 'inline-flex';
        return;
      }
      if (btn.id === 'aci-video-call') {
        btn.hidden = false;
        return;
      }
      btn.hidden = !allowed.has(btn.id);
    });
    // Rescue locate if parked in hidden shortcut row
    const loc = document.getElementById('aci-locate');
    const edge = document.getElementById('super-cli-edge-right');
    const badRow = document.getElementById('app-shortcut-row');
    if (loc && edge && badRow?.contains(loc)) {
      const hf = document.getElementById('aci-handsfree');
      if (hf && edge.contains(hf)) edge.insertBefore(loc, hf);
      else edge.prepend(loc);
      loc.classList.remove('app-shortcut-btn');
      loc.hidden = false;
    }
    AppShortcuts?.render?.();
    this.INPUT_BTNS.forEach(id => {
      const b = document.getElementById(id);
      if (b) b.hidden = false;
    });
  },

  bindInputBar() {
    const hf = document.getElementById('aci-handsfree');
    const send = document.getElementById('globe-deck-send');
    if (hf && !hf._superBound) {
      hf._superBound = true;
      hf.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        // Contract: 🎧 = open AI panel. Never locate / fly / zoom.
        if (SessionHold?.isHeld?.()) { SessionHold.resume(); return; }
        if (Voice?.speaking || isListening || voiceSessionActive || window._handsFreeVoice) {
          userIntervene?.();
          AciCli?.print('🎧 voice stopped — type below or tap 🎧 again', 'dim');
          return;
        }
        void this.openAiHandsfree();
      };
    }
    if (send && !send._superBound) {
      send._superBound = true;
      send.onclick = e => {
        e.preventDefault();
        e.stopPropagation();
        AciCli?.submitFromInput?.({ emptyFocus: true });
      };
    }
  },

  /** 🎧 trust path: expand CLI + Grok session (text). Voice only if already welcomed. */
  async openAiHandsfree() {
    GlobeDeck?.expand?.(ACL_TITLE);
    GlobeDeck?.onUserMessage?.('Grok');
    CliRibbon?.setActive?.('Grok');
    CliRibbon?.setNotice?.('Grok ready — type or speak', 'ready');
    GlobeDeck?.setPreview?.('Talk to Grok — type below or speak after mic starts');
    document.getElementById('aci-cli-in')?.focus();
    try {
      await AciCoders?.enterSession?.({ expand: true, focus: true, ping: false });
    } catch (_) { /* */ }
    // Start voice after UI is open — never call locateMe from this path
    if (typeof startVoiceOptions === 'function' && !window._handsFreeVoice) {
      try { startVoiceOptions(); } catch (_) { /* */ }
    }
  },

  bindToolbar() {
    const actions = {
      'aci-login': () => Auth?.user ? Auth.openLoggedInProfile() : (Auth?.signInGoogle?.() || Auth?.openLoginModal?.()),
      'aci-cli-toggle': () => GlobeDeck?.toggle(),
      'aci-stop': () => userIntervene?.(),
      'aci-hold': () => SessionHold?.toggle?.(),
      'aci-theme': () => AstranovTheme?.toggle?.(),
      'aci-locate': () => this.run('locate'),
      'aci-bridge': () => ArchitectBridge?.openQuickFix?.(),
      'aci-provider': () => AiRouter?.cycle?.(),
      'aci-order': () => this.run('order'),
      'aci-batch': () => this.run('batch'),
      'aci-vhf': () => this.run('vhf'),
      'aci-call': () => this.run('phone'),
      'super-add-fab': () => {
        if (typeof MapPlaceMenu?.openPlusField === 'function') {
          MapPlaceMenu.openPlusField();
          return;
        }
        this.run('add');
      },
    };
    Object.entries(actions).forEach(([id, fn]) => {
      const el = document.getElementById(id);
      if (el) el.onclick = e => { e.preventDefault(); e.stopPropagation(); fn(); };
    });
  },

  flyForTask(act, opts) {
    if (!GlobeControl?.isEarthView?.()) return;
    const u = window._lastPos || { lat: 36.22, lng: 28.12 };
    if (act === 'news') {
      const u = window._lastPos || { lat: 36.44, lng: 28.22 };
      GlobeControl.flyToLatLng(opts?.worldLat ?? u.lat, opts?.worldLng ?? u.lng, 'news', GlobeControl?.Z?.global);
      return;
    }
    if (act === 'order' || act === 'commerce') {
      const v = window.Commerce?.vendors?.[0] || window.Commerce?.selected;
      if (v?.lat != null) GlobeControl.flyToLatLng(v.lat, v.lng, 'order');
      else GlobeControl.flyToLatLng(u.lat, u.lng, 'order');
      return;
    }
    if (act === 'batch') GlobeControl.flyToLatLng(u.lat, u.lng, 'batch');
    if (act === 'vhf' || act === 'radio') GlobeControl.flyToLatLng(u.lat, u.lng, 'comms');
  },

  async run(action, opts) {
    const act = String(action || '').toLowerCase();
    SlumberManager?.wakeForAction?.(act);
    if (!['locate', 'city', 'map', 'cli', 'dark', 'bright', 'theme', 'slumber', 'wake', 'sleep'].includes(act)) {
      await LazyModules.ensure();
    }
    GlobeDeck?.superAction(act, opts);
    this.setContext(this.inferContext());
    AciCli?.print('▸ ' + act, 'cmd');

    switch (act) {
      case 'locate':
        if (GlobeControl?.followMode === 'locate' && !GlobeControl?.userExploring) {
          GlobeControl.userTookGlobe('locate-off');
          AciCli?.print('Locate released — globe is yours', 'ok');
          break;
        }
        GlobeDeck?.expand?.(ACL_TITLE);
        try {
          if (CityLife?.locateAndDropIn) await CityLife.locateAndDropIn();
          else locateMe?.();
        } catch (_) {
          try { await enterCityView?.(36.44, 28.22, { openShops: false }); } catch (__) {}
        }
        GlobeDeck?.finishCliIfOneShot('locate');
        break;
      case 'city':
      case 'map':
        GlobeDeck?.expand?.(ACL_TITLE);
        GlobeDeck?.setMapStatus('Opening city map…');
        await enterCityView?.(null, null, { openShops: true });
        GlobeDeck?.finishCliIfOneShot('city');
        break;
      case 'order':
        this.flyForTask('order');
        await LazyModules?.ensure?.().catch(() => {});
        await window.Commerce?.showPicker?.(opts?.filter);
        this.setContext('commerce');
        break;
      case 'batch':
        this.flyForTask('batch');
        await window.AstranovNode?.launchBatch?.();
        this.setContext('batch');
        break;
      case 'vhf':
      case 'radio':
      case 'pmr':
        this.flyForTask('vhf');
        window.Comms?.startVHF?.();
        this.setContext('radio');
        break;
      case 'phone':
      case 'call':
        GlobeDeck?.hideStage();
        GlobeDeck.activeTask = 'phone';
        GlobeDeck?.expand(ACL_TITLE + ' — phone');
        AppShortcuts?.track?.('phone', 'Phone');
        this.setContext('phone');
        AciCli?.print('Type: call +30… (e.g. call +306912345678)', 'ok');
        ACIControl?.reply('Type call +number in chat');
        document.getElementById('aci-cli-in')?.focus();
        break;
      case 'news':
        this.flyForTask('news', opts);
        window.NewsFeed?.flash?.();
        this.setContext('news');
        GlobeDeck?.finishCliIfOneShot('news');
        break;
      case 'drive':
        window.DrivingView?.activate?.();
        AppShortcuts?.track?.('drive', 'Drive');
        this.setContext('drive');
        break;
      case 'add':
      case 'post':
      case 'superadd':
        window.SuperAdd?.open?.();
        this.setContext('add');
        break;
      case 'cli':
        GlobeDeck?.expand(ACL_TITLE);
        document.getElementById('aci-cli-in')?.focus();
        break;
      default:
        if (AciCli && act) await AciCli.run(act + (opts?.rest ? ' ' + opts.rest : ''));
    }
  },
};
window.SuperCli = SuperCli;

/* === 14-aci-cli.js === */
// === ACI CLI — Collective dev terminal (login required) ===
const AciCli = {
  open: false,
  history: [],
  histIdx: -1,
  buffer: '',

  primeCodersCli() {
    AciCoders?.autoStart?.();
    CliRibbon?.setActive?.('Grok');
    const input = document.getElementById('aci-cli-in');
    if (input) input.placeholder = 'Talk to Grok — type or tap 🎧 · Enter to send';
  },

  init() {
    const input = document.getElementById('aci-cli-in');
    const toggle = document.getElementById('aci-cli-toggle');
    const form = document.getElementById('aci-cli-form');
    SuperCli?.bindInputBar?.();
    if (toggle) toggle.onclick = () => this.toggle();
    if (form && !form._cliBound) {
      form._cliBound = true;
      form.addEventListener('submit', e => { e.preventDefault(); this.submitFromInput({ emptyFocus: true }); });
    }
    if (input) {
      input.onkeydown = (e) => this.onKey?.(e) || this._legacyKey(e);
      input.oninput = () => { this.buffer = input.value; window.resizeCliInput?.(input); };
      input.onfocus = () => { this.open = true; AciCoders?.enterSession?.({ focus: false, ping: false, expand: false }); };
    }
    this.onAuthChange();
  },

  onAuthChange() {
    const logged = !!(Auth && Auth.user);
    if (!logged) {
      this._welcomed = false;
      this._sessionOpened = false;
      this.open = false;
      GlobeDeck?.collapse?.();
      this.primeCodersCli();
      ArchitectBridge?.disarm?.();
      return;
    }
    const prompt = document.getElementById('aci-cli-prompt');
    if (prompt) {
      prompt.textContent = Auth?.isArchitect
        ? 'ASTRANOV@collective $'
        : ((Auth.user.user_metadata?.full_name || Auth.user.email?.split('@')[0] || 'dev') + '@collective $');
    }
    if (Auth?.isArchitect) ArchitectBridge?.arm?.({ quiet: true });
    if (window.AciCoders) AciCoders.autoStart();
    SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
  },

  show() {
    if (!Auth?.user) return;
    this.open = true;
    AciCoders?.autoStart?.();
    GlobeDeck?.expand?.('Grok');
    document.getElementById('aci-cli-in')?.focus();
  },

  async api(body, opts = {}) {
    const headers = { 'Content-Type': 'application/json', apikey: SB_KEY };
    if (Auth?.ensureSession) {
      const session = await Auth.ensureSession();
      headers.Authorization = session?.access_token ? 'Bearer ' + session.access_token : 'Bearer ' + SB_KEY;
    } else if (Auth?.client) {
      const { data } = await Auth.client.auth.getSession();
      headers.Authorization = data?.session?.access_token ? 'Bearer ' + data.session.access_token : 'Bearer ' + SB_KEY;
    } else {
      headers.Authorization = 'Bearer ' + SB_KEY;
    }
    const timeoutMs = opts.timeoutMs || (body.fast ? 28000 : 55000);
    const lane = ArcangeloDialect?.apiContext?.() || {};
    const j = await fetchJson(SB_URL + '/functions/v1/aci', {
      method: 'POST', headers,
      body: JSON.stringify({ ...body, ...lane, cli_user: Auth?.user?.id, cli_email: Auth?.user?.email }),
    }, timeoutMs);
    if (j._httpStatus === 401) j.error = j.error || 'login required — tap G to sign in';
    return j;
  },

  submitFromInput(opts = {}) {
    const input = document.getElementById('aci-cli-in');
    const line = String(input?.value || '').replace(/\n+$/, '').trim();
    if (!line) {
      if (opts.emptyFocus) AciCoders?.enterSession?.({ focus: true, ping: false });
      return false;
    }
    GlobeDeck?.onUserMessage?.('Grok — ' + line.slice(0, 40));
    GlobeDeck?.setThinking?.(true, 'Grok…');
    input.value = '';
    this.buffer = '';
    window.resizeCliInput?.(input);
    void this.run(line);
    return true;
  },

  async run(line, opts = {}) {
    line = (window.fixVoiceHotwords || (x => x))(String(line || '').trim());
    if (!line) { await AciCoders?.enterSession?.({ focus: true, ping: false }); return; }
    await AciCoders?.enterSession?.({ focus: false, ping: false, expand: false });
    this.history.push(line);
    this.histIdx = -1;
    this.print((document.getElementById('aci-cli-prompt')?.textContent || '›') + ' ' + line, 'cmd');
    const routed = await SuperCli?.exec?.(line, opts);
    if (routed?.handled) return;
    await this.handle(line);
  },

  onKey(e) {
    const enter = e.key === 'Enter' && !e.shiftKey && !e.altKey && !e.ctrlKey && !e.metaKey && !e.isComposing;
    if (enter) { e.preventDefault(); this.submitFromInput(); return true; }
    if (e.key === 'Escape') { this.toggle(); return true; }
    return false;
  },

  _legacyKey(e) {
    if (e.key === 'Tab') {
      e.preventDefault();
      const sug = this.suggest(e.target.value);
      if (sug) { e.target.value = sug; this.buffer = sug; window.resizeCliInput?.(e.target); }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      this.clear();
    }
  },

  toggle() {
    if (!Auth?.user) { GlobeDeck?.expand?.('Guest'); this.open = true; return; }
    GlobeDeck?.toggle?.();
    this.open = !!GlobeDeck?.expanded;
  },

  clear() {
    const input = document.getElementById('aci-cli-in');
    if (input) { input.value = ''; this.buffer = ''; window.resizeCliInput?.(input); }
    GlobeDeck?.clearLog?.();
  },

  print(t, cls) { GlobeDeck?.log?.(t, cls); },

  async handle(line) {
    const parts = line.trim().split(/\s+/);
    const cmd = (parts[0] || '').toLowerCase();
    const rest = parts.slice(1).join(' ');
    const voiceSessionActive = !!(window.Voice && Voice.session);

    if (!cmd) return;
    if (cmd === 'help' || cmd === '?') {
      this.print('locate · order · resources · channels · starship · starlink · spacex · crawl', 'dim');
      this.print('task job barman 3h · task housekeeper 1w · task date coffee 2h · task errand · task claim', 'dim');
      this.print('channels status · seed · publish · order · enable mesh', 'dim');
      this.print('think · coders · theme · Architect: fix|bridge', 'dim');
      return;
    }
    if (cmd === 'resources' || cmd === 'resource' || cmd === 'donate' || cmd === 'monitor') {
      ResourceMonitor?.init?.();
      const msg = ResourceMonitor?.handleCli?.(line);
      this.print(msg || 'resources', 'ok');
      return;
    }
    if (cmd === 'channels' || cmd === 'channel' || cmd === 'cm' || cmd === 'spacenetcm') {
      SpaceNetCM?.init?.();
      const msg = SpaceNetCM?.handleCli?.(line);
      this.print(msg || 'channels', 'ok');
      return;
    }
    if (cmd === 'starship' || cmd === 'f13') {
      try { StarshipFlight13?.init?.(); } catch (_) {}
      try { GlobeInfoTiles?.init?.({ seed: false }); } catch (_) {}
      const msg = await StarshipFlight13?.handleCli?.(rest || line);
      this.print(msg || 'f13', 'ok');
      return;
    }
    if (cmd === 'spacex' || (cmd === 'video' && /tile|spacex|globe/.test(rest))) {
      try { GlobeInfoTiles?.init?.({ seed: false }); } catch (_) {}
      const msg = await GlobeInfoTiles?.handleCli?.(rest || 'spacex');
      this.print(msg || 'spacex tiles', 'ok');
      return;
    }
    if (cmd === 'starlink') {
      try { StarlinkConstellation?.init?.(); StarlinkConstellation?.ensureBuilt?.(); } catch (_) {}
      const msg = await StarlinkConstellation?.handleCli?.(rest || 'starlink');
      this.print(msg || 'starlink', 'ok');
      return;
    }
    if (cmd === 'crawl' || cmd === 'spacenet') {
      const msg = await SpaceNetBrain?.handleCli?.(rest || 'crawl all');
      this.print(msg || 'crawl', 'ok');
      return;
    }
    if (cmd === 'task' || cmd === 'tasks' || cmd === 'job' || cmd === 'jobs'
      || cmd === 'errand' || cmd === 'date' || cmd === 'dating' || cmd === 'hire') {
      CityTasks?.init?.();
      const msg = await CityTasks?.handleCli?.(
        (cmd === 'task' || cmd === 'tasks') ? line : ('task ' + line)
      );
      this.print(msg || 'task', 'ok');
      return;
    }
    if (cmd === 'clear') { this.clear(); return; }
    if (cmd === 'exit' || cmd === 'close') { GlobeDeck?.completeTask('cli'); return; }
    if (cmd === 'logout') { await Auth.signOut(); this.print('signed out', 'ok'); return; }

    if (cmd === 'theme' || cmd === 'dark' || cmd === 'bright' || cmd === 'light' || cmd === 'auto') {
      let mode = cmd === 'theme' ? (parts[1] || '').toLowerCase() : (cmd === 'light' ? 'bright' : cmd);
      if (mode === 'auto' || mode === 'system') mode = 'auto';
      AstranovTheme?.set?.(mode);
      this.print('theme → ' + (AstranovTheme?._auto ? 'auto' : AstranovTheme?.mode || 'dark'), 'ok');
      return;
    }
    if (cmd === 'code' || cmd === 'edit') {
      if (!rest) { this.print('usage: code <desc>', 'err'); return; }
      GlobeDeck.activeTask = 'coders';
      // Architect: code/edit go straight to Grok Build bridge (in-app coding path)
      if (Auth?.isArchitect || AciCoders?.isArchitect?.()) {
        const br = await ArchitectBridge?.handleCommand?.(cmd + ' ' + rest);
        if (br && !br.error) {
          GlobeDeck?.finishCliIfOneShot(cmd);
          return;
        }
      }
      AciCoders?.handleMessage?.('edit code: ' + rest);
      this.print('code change sent to coders', 'ok');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'db' || cmd === 'database') {
      if (!rest) { this.print('usage: db <cmd>', 'err'); return; }
      try {
        const r = await ACI.api({ mode: 'db', detail: rest });
        this.print('db: ' + (r.text || 'ok'), 'ok');
      } catch (e) {
        this.print('db err, try coders', 'err');
        AciCoders?.handleMessage?.('db change: ' + rest);
      }
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'think') {
      if (!rest) { ACIControl?.reply('usage: think <prompt>'); return; }
      const r = await ACI.think(rest);
      ACIControl?.reply(r || '(empty)');
      if (voiceSessionActive && Voice.shouldSpeak(r)) speak(r.slice(0, 200));
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    // ... other commands unchanged
    if (cmd === 'evolve' || cmd === 'e') {
      const r = await ACI.evolve(rest);
      ACIControl?.reply(r || '(evolved)');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'teach') {
      if (!rest) { this.print('usage: teach <content>', 'err'); return; }
      const r = await ACI.teach(rest);
      this.print(r?.ok ? 'taught' : (r?.error || 'fail'), r?.ok ? 'ok' : 'err');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'stats' || cmd === 's') {
      const r = await ACI.api({ mode: 'stats' });
      this.print(r?.text || JSON.stringify(r).slice(0,300), 'out');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'seed') {
      const r = await ACI.api({ mode: 'seed' });
      this.print(r?.text || 'seeded', 'ok');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'council' || cmd === 'c') {
      const r = await ACI.api({ mode: 'council' });
      this.print(r?.verdict || r?.text || 'council', 'out');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'bridge' || cmd === 'dev' || cmd === 'fix' || cmd === 'code' || cmd === 'edit') {
      if (cmd !== 'bridge' && !rest) { this.print('usage: ' + cmd + ' <task>', 'err'); return; }
      GlobeDeck.activeTask = 'coders';
      await ArchitectBridge?.handleCommand?.(line);
      return;
    }
    if (cmd === 'coders' || cmd === 'composer' || cmd === 'cursor' ||
        (cmd === 'summon' && /^coders?$/i.test(parts[1] || ''))) {
      const task = cmd === 'summon' ? rest : (cmd === 'coders' ? rest : rest || '');
      if (!task) { this.print('usage: coders <task desc>', 'err'); return; }
      if (!Auth?.user) {
        this.print('sign in with G first', 'err');
        Auth?.openLoginModal?.('Sign in to use coders');
        return;
      }
      GlobeDeck.activeTask = 'coders';
      AciCoders?.handleMessage?.(task);
      this.print('coders task sent', 'ok');
      return;
    }
    if (cmd === 'vendor' || cmd === 'v') {
      await Commerce?.showPicker?.();
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'order' || cmd === 'o') {
      if (!rest) { this.print('usage: order <item>', 'err'); return; }
      const r = await Commerce?.placeOrder?.(rest);
      this.print(r?.ok ? 'ordered' : (r?.error || 'fail'), r?.ok ? 'ok' : 'err');
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'batch' || cmd === 'node') {
      AstranovNode?.showPanel?.();
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }
    if (cmd === 'radio' || cmd === 'vhf') {
      Comms?.startVHF?.();
      GlobeDeck?.finishCliIfOneShot(cmd);
      return;
    }

    // Freeform → Core Brain (globe agent). Never leave users at "unknown".
    GlobeDeck.activeTask = 'coders';
    if (window.AstranovCoreBrain?.handle) {
      await AstranovCoreBrain.handle(line);
      return;
    }
    if (window.AciCoders?.handleMessage) {
      await AciCoders.handleMessage(line);
      return;
    }
    ACIControl?.reply('Brain loading — tap 🎧 again in a moment');
  },

  suggest(prefix) {
    const p = (prefix || '').toLowerCase();
    const cmds = ['think', 'evolve', 'teach', 'stats', 'seed', 'council', 'coders', 'bridge', 'dev', 'fix', 'code', 'db', 'theme', 'auto', 'dark', 'bright', 'vendor', 'order', 'batch', 'radio', 'clear', 'exit', 'logout'];
    for (const c of cmds) if (c.startsWith(p)) return c;
    return '';
  }
};
window.AciCli = AciCli;

/* === 71-classified-triangles.js === */
// === CLASSIFIED TRIANGLES — top 3 AI-classified actions, then more options ===
const ClassifiedTriangles = {
  CATALOG: [
    { id: 'open_city', label: 'Open city', icon: '🏙', keywords: ['city', 'open city', 'streets', 'enter city', 'city map', 'πόλη'] },
    { id: 'list_shop', label: 'List my shop', icon: '🏬', keywords: ['shop', 'store', 'menu', 'my shop', 'cafe', 'restaurant', 'bakery'] },
    { id: 'list_vendor', label: 'List vendor', icon: '🏪', keywords: ['vendor', 'supplier', 'wholesale', 'list vendor', 'seller'] },
    { id: 'driver_base', label: 'Driver base', icon: '🚚', keywords: ['driver', 'delivery', 'fleet', 'courier', 'base', 'dispatch'] },
    { id: 'post', label: 'Post something', icon: '📝', keywords: ['post', 'share', 'announce', 'publish', 'status'] },
    { id: 'upload_photo', label: 'Upload photo', icon: '📷', keywords: ['photo', 'picture', 'image', 'snap', 'pic'] },
    { id: 'upload_video', label: 'Upload video', icon: '🎬', keywords: ['video', 'record', 'film', 'clip', 'reel'] },
    { id: 'deliver_here', label: 'Deliver here', icon: '📦', keywords: ['deliver', 'delivery address', 'ship here', 'drop off'] },
    { id: 'drive_here', label: 'Drive here', icon: '🚗', keywords: ['drive', 'navigate', 'go here', 'take me'] },
    { id: 'route', label: 'Show route', icon: '🛣', keywords: ['route', 'directions', 'path', 'roads'] },
    { id: 'explore', label: 'Shops nearby', icon: '🔍', keywords: ['nearby', 'explore', 'find shops', 'around', 'local'] },
    { id: 'order', label: 'Order here', icon: '🛒', keywords: ['order', 'buy', 'purchase', 'food'] },
  ],

  DEFAULT_TOP: ['list_shop', 'list_vendor', 'driver_base'],

  init() {
    document.getElementById('ge-hud-intent-go')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      void this.onIntentSubmit();
    });
    document.getElementById('ge-hud-intent')?.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); void this.onIntentSubmit(); }
    });
    document.getElementById('ct-more-toggle')?.addEventListener('click', e => {
      e.preventDefault();
      const more = document.getElementById('classified-triangles-more');
      const btn = document.getElementById('ct-more-toggle');
      if (!more || !btn) return;
      const open = more.classList.toggle('open');
      btn.textContent = open ? 'Fewer options ▴' : 'More options ▾';
    });
    document.getElementById('ge-hud-place-close')?.addEventListener('click', e => {
      e.preventDefault();
      e.stopPropagation();
      MapPlaceMenu?.close?.();
    });
  },

  defaultTop3() {
    return this.DEFAULT_TOP.map(id => this.CATALOG.find(c => c.id === id)).filter(Boolean);
  },

  defaultMore() {
    return this.CATALOG.filter(c => !this.DEFAULT_TOP.includes(c.id));
  },

  scoreLocal(text) {
    const t = String(text || '').toLowerCase();
    const scored = this.CATALOG.map(item => {
      let s = 0;
      for (const kw of item.keywords) {
        if (t.includes(kw)) s += kw.length + 2;
      }
      return { ...item, score: s };
    }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);
    if (!scored.length) return this.defaultTop3().concat(this.defaultMore());
    const rest = this.CATALOG.filter(c => !scored.find(s => s.id === c.id));
    return scored.concat(rest);
  },

  async onIntentSubmit() {
    const input = document.getElementById('ge-hud-intent');
    const text = input?.value?.trim() || '';
    const pin = MapPlaceMenu?._pin;
    const primary = document.getElementById('classified-triangles-primary');
    if (primary) primary.classList.add('ct-loading');
    const result = await SpaceNetBrain?.classifyIntent?.(text, {
      lat: pin?.lat,
      lng: pin?.lng,
      pin,
      radiusKm: 2,
    });
    if (primary) primary.classList.remove('ct-loading');
    if (result) this.render(result.primary, result.more, pin);
    const desc = document.getElementById('ge-hud-desc');
    if (desc) {
      desc.textContent = text
        ? '▸ ' + text
        : 'Pick a triangle — or type what you want to do';
    }
    AciCli?.print?.('triangles · ' + (text || 'default top 3'), 'ok');
  },

  _contextTop3(pin) {
    const tier = ZoomTiers?.current?.();
    if (tier?.city || CityMap?.active) {
      return [
        this.CATALOG.find(c => c.id === 'order'),
        this.CATALOG.find(c => c.id === 'deliver_here'),
        this.CATALOG.find(c => c.id === 'explore'),
      ].filter(Boolean);
    }
    if (tier?.national) {
      return [
        this.CATALOG.find(c => c.id === 'open_city') || { id: 'open_city', label: 'Open city', icon: '🏙', keywords: ['city', 'open city', 'streets'] },
        this.CATALOG.find(c => c.id === 'explore'),
        this.CATALOG.find(c => c.id === 'drive_here'),
      ].filter(Boolean);
    }
    return this.defaultTop3();
  },

  render(primary, more, pin, opts) {
    opts = opts || {};
    const tri = document.getElementById('classified-triangles-primary');
    const moreEl = document.getElementById('classified-triangles-more');
    const toggle = document.getElementById('ct-more-toggle');
    if (!tri) return;
    const limited = !!opts.limited || !!pin?.limited;
    const top = (primary || (limited ? this._contextTop3(pin) : this.defaultTop3())).slice(0, 3);
    tri.innerHTML = top.map(item =>
      '<button type="button" class="ct-tri ct-top" data-ct-id="' + item.id + '" title="' + item.label + '">'
      + '<span class="ct-icon">' + item.icon + '</span><span class="ct-lbl">' + item.label + '</span></button>'
    ).join('');
    tri.querySelectorAll('[data-ct-id]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.runAction(btn.dataset.ctId, pin);
      };
    });
    const extras = limited ? [] : (more || this.defaultMore()).slice(0, 5);
    if (moreEl) {
      moreEl.innerHTML = extras.map(item =>
        '<button type="button" data-ct-id="' + item.id + '">' + item.icon + ' ' + item.label + '</button>'
      ).join('');
      moreEl.querySelectorAll('[data-ct-id]').forEach(btn => {
        btn.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          this.runAction(btn.dataset.ctId, pin);
        };
      });
      moreEl.classList.remove('open');
    }
    if (toggle) {
      toggle.style.display = (!limited && extras.length) ? 'block' : 'none';
      toggle.textContent = 'More options ▾';
    }
  },

  runAction(actionId, pin) {
    const map = {
      open_city: 'open_city',
      list_shop: 'shop',
      list_vendor: 'shop',
      driver_base: 'driver_base',
      deliver_here: 'client_addr',
      drive_here: 'drive',
      route: 'route',
      explore: 'explore',
      order: 'order',
      post: 'post',
      upload_photo: 'upload_photo',
      upload_video: 'upload_video',
    };
    const act = map[actionId] || actionId;
    if (act === 'open_city') {
      const p = pin || MapPlaceMenu?._pin;
      if (p) void CityPick?.enter?.(p.lat, p.lng, CityPick?.nearestName?.(p.lat, p.lng) || 'City');
      else void CityPick?.enter?.(window._lastPos?.lat, window._lastPos?.lng, 'City');
      MapPlaceMenu?.close?.();
      return;
    }
    if (act === 'post' || act === 'upload_photo' || act === 'upload_video') {
      MapPlaceMenu?._runMedia?.(act, pin);
      return;
    }
    MapPlaceMenu?._run?.(act);
  },
};
window.ClassifiedTriangles = ClassifiedTriangles;

/* === 72-map-place-menu.js === */
// === MAP PLACE MENU — tap globe/map · plus field · classified triangles ===
const MapPlaceMenu = {
  _pin: null,

  formatCoords(lat, lng) {
    return Number(lat).toFixed(4) + ', ' + Number(lng).toFixed(4);
  },

  pointFromGlobeHit(point) {
    const dir = point.clone().normalize();
    const lat = 90 - Math.acos(Math.max(-1, Math.min(1, dir.y))) * 180 / Math.PI;
    let lng = Math.atan2(dir.z, -dir.x) * 180 / Math.PI - 180;
    if (lng > 180) lng -= 360;
    if (lng < -180) lng += 360;
    return { lat, lng };
  },

  openPlusField() {
    const pos = window._lastPos || CityMap?.globeCenterLatLng?.() || TrackballGuard?.facingLatLng?.() || { lat: 36.44, lng: 28.22 };
    this.openAt(pos.lat, pos.lng, { source: 'Plus field', hint: 'Type what you want to do — AI shows top 3', focusIntent: true });
  },

  _showPlaceMenu(show) {
    const place = document.getElementById('ge-hud-place-menu');
    const entityRow = document.getElementById('ge-hud-row');
    if (place) place.classList.toggle('open', !!show);
    if (entityRow) entityRow.style.display = show ? 'none' : '';
  },

  openAt(lat, lng, opts) {
    opts = opts || {};
    if (lat == null || lng == null) return;
    // Default: stop camera so menu feels settled. keepFly: national-entry path is mid-flight.
    if (!opts.keepFly) window._globeFly = null;
    GlobeEntity?.clearSelection?.();
    this._pin = { lat, lng, entity: opts.entity || null, limited: !!opts.limited };
    const hud = document.getElementById('globe-entity-hud');
    if (!hud) return;
    hud.classList.add('open');
    this._showPlaceMenu(true);
    document.getElementById('ge-hud-type').textContent = '▸ ' + (opts.source || 'Map');
    document.getElementById('ge-hud-title').textContent = opts.label || this.formatCoords(lat, lng);
    document.getElementById('ge-hud-desc').textContent = opts.hint || 'Type what you want to do — top 3 triangle options';
    const intent = document.getElementById('ge-hud-intent');
    if (intent) {
      intent.value = opts.prefill || '';
      if (opts.focusIntent) setTimeout(() => intent.focus(), 80);
    }
    const limited = !!opts.limited;
    const ranked = limited
      ? ClassifiedTriangles._contextTop3(this._pin)
      : ClassifiedTriangles.defaultTop3().concat(ClassifiedTriangles.defaultMore());
    if (opts?.entity?.type === 'vendor') {
      const order = ClassifiedTriangles.CATALOG.find(c => c.id === 'order');
      if (order && !limited) ranked.unshift(order);
    }
    ClassifiedTriangles.render(ranked.slice(0, 3), limited ? [] : ranked.slice(3), this._pin, { limited });
    void SpaceNetBrain?.crawlArea?.(lat, lng, 2);
    MapDepict?.pulse?.(lat, lng, 0x00ddff, opts.label || 'here', 8000);
    GlobeDeck?.setPreview?.('▸ Plus field · ' + (opts.label || this.formatCoords(lat, lng)));
    AciCli?.print?.('▸ plus field · ' + (opts.label || this.formatCoords(lat, lng)), 'map');
  },

  close() {
    this._pin = null;
    document.getElementById('globe-entity-hud')?.classList.remove('open');
    this._showPlaceMenu(false);
    const intent = document.getElementById('ge-hud-intent');
    if (intent) intent.value = '';
    document.getElementById('classified-triangles-more')?.classList.remove('open');
    GlobeEntity?.clearSelection?.();
  },

  _runMedia(action, pin) {
    const p = pin || this._pin;
    if (p) window._pendingShopLatLng = { lat: p.lat, lng: p.lng };
    const go = async () => {
      await LazyModules.ensure();
      SuperAdd?.open?.();
      if (action === 'upload_photo') {
        ACIControl?.reply?.('Super Add · snap or upload photo for this place');
      } else if (action === 'upload_video') {
        ACIControl?.reply?.('Super Add · record video for this place');
      } else {
        ACIControl?.reply?.('Super Add · post at this location');
      }
    };
    void go();
    this.close();
  },

  _run(action) {
    const p = this._pin;
    if (!p) return;
    const lat = p.lat;
    const lng = p.lng;
    if (action === 'drive' || action === 'route') {
      const go = async () => {
        await LazyModules.ensure();
        DrivingView?.setDestination?.(lat, lng);
        DrivingView?.activate?.();
      };
      void go();
      this.close();
      return;
    }
    if (action === 'client_addr') {
      const go = async () => {
        await LazyModules.ensure();
        if (!Auth?.user) {
          Auth?.openLoginModal?.('Sign in to set delivery address');
          return;
        }
        if (window.MapPins?.setClientDelivery) {
          MapPins.setClientDelivery(lat, lng, 'Deliver to ' + this.formatCoords(lat, lng));
        } else {
          window._clientDelivery = { lat, lng, label: 'Deliver to ' + this.formatCoords(lat, lng) };
          try { localStorage.setItem('astranov_client_delivery', JSON.stringify(window._clientDelivery)); } catch (_) {}
          ACIControl?.reply?.('Delivery address set · ' + this.formatCoords(lat, lng));
        }
      };
      void go();
      this.close();
      return;
    }
    if (action === 'driver_base') {
      const go = async () => {
        await LazyModules.ensure();
        if (!Auth?.user) {
          Auth?.openLoginModal?.('Sign in to set driver base');
          return;
        }
        if (window.MapPins?.setDriverBase) {
          await MapPins.setDriverBase(lat, lng, 'Driver base · ' + this.formatCoords(lat, lng));
        } else {
          window._driverBase = { lat, lng, label: 'Driver base · ' + this.formatCoords(lat, lng) };
          try { localStorage.setItem('astranov_driver_base', JSON.stringify(window._driverBase)); } catch (_) {}
          ACIControl?.reply?.('Driver base set · ' + this.formatCoords(lat, lng));
        }
      };
      void go();
      this.close();
      return;
    }
    if (action === 'shop') {
      window._pendingShopLatLng = { lat, lng };
      const go = async () => {
        await LazyModules.ensure();
        if (!Auth?.user) {
          Auth?.openLoginModal?.('Sign in to set up your shop profile');
          return;
        }
        await ProfileSite?.openShopEditor?.(lat, lng);
      };
      void go();
      MapDepict?.pulse?.(lat, lng, 0xff8844, 'new shop', 8000);
      ACIControl?.reply?.('Shop editor — logo, menu photos & prices');
      AppShortcuts?.track?.('add', 'Shop');
      this.close();
      return;
    }
    if (action === 'order') {
      const v = p.entity?.data?.vendor;
      const go = async () => {
        await LazyModules.ensure();
        if (v) window.Commerce?.openVendor?.(v);
        else window.Commerce?.showPicker?.();
      };
      void go();
      this.close();
      return;
    }
    if (action === 'explore') {
      window._lastPos = { lat, lng };
      const go = async () => {
        await LazyModules.ensure();
        await window.Commerce?.loadVendors?.();
        window.Commerce?.showPicker?.();
      };
      void go();
      MapDepict?.action?.('vendor', { lat, lng, detail: 'shops near here' });
      this.close();
      return;
    }
    if (action === 'zoom') {
      const pt = latLngToPos(lat, lng, 1.04);
      flyToPoint?.(new THREE.Vector3(pt.x, pt.y, pt.z), GlobeControl?.Z?.national || 1.82, { dur: 1100 });
      GlobeControl?.noteAutoFly?.();
      this.close();
      return;
    }
    if (action === 'open_city') {
      void CityPick?.enter?.(lat, lng, CityPick?.nearestName?.(lat, lng) || 'City');
      this.close();
    }
  },
};
window.MapPlaceMenu = MapPlaceMenu;

/* === 61-city-map.js === */
// === CITY MAP (Leaflet national/city level) ===
var CityMap = {
  map: null,
  _ready: false,
  _markers: {},
  _center: null,
  _route: null,
  _routeCoords: [],
  _demoDrivers: [],
  _demoPhase: 0,
  _forceOpen: false,
  active: false,
  ENTER_Z: 1.58,
  EXIT_Z: 1.72,

  init() {
    const el = document.getElementById('city-map');
    if (!el) return;
    if (typeof L === 'undefined') {
      // Leaflet loads after critical — retry once
      if (!this._leafletRetry) {
        this._leafletRetry = true;
        setTimeout(() => this.init(), 400);
      }
      return;
    }
    if (this._ready) return;
    // ensure dark bg to prevent white flash on enter
    el.style.background = 'var(--an-bg)';
    this.map = L.map(el, {
      zoomControl: false,
      attributionControl: false,
      dragging: true,
      touchZoom: true,
      scrollWheelZoom: false,
      doubleClickZoom: false,
      boxZoom: false
    });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      opacity: 0.42,
      attribution: '© OSM'
    }).addTo(this.map);
    this._center = this._center || { lat: 0, lng: 0 };
    this.map.setView([this._center.lat, this._center.lng], 3, { animate: false });
    this._ready = true;
    el.addEventListener('wheel', e => {
      if (!this.active) return;
      e.preventDefault();
      const dir = e.deltaY > 0 ? 1 : -1;
      const curZ = this.map.getZoom();
      if (dir > 0 && curZ <= 3) {
        this._bridgeZoomOut(0.14);
        return;
      }
      this.map.setZoom(Math.max(3, Math.min(19, curZ + dir * 0.8)), { animate: true });
    }, { passive: false });
    this._bindMapGestures();
    this._bindMapClick();
    this.map.on('moveend zoomend', () => {
      if (this.active) this._syncMarkers();
    });
  },

  _bindMapClick() {
    if (!this.map || this.map._placeClickBound) return;
    this.map._placeClickBound = true;
    this.map.on('click', (e) => {
      if (!this.active) return;
      MapPlaceMenu?.openAt?.(e.latlng.lat, e.latlng.lng, {
        source: 'City map',
        hint: 'Post · explore · order — pick a triangle',
        limited: true,
      });
    });
  },

  _bridgeZoomOut(amount) {
    if (typeof zoomBy === 'function') zoomBy(amount || 0.12);
  },

  _bindMapGestures() {
    const el = document.getElementById('city-map');
    if (!el || !this.map) return;
    let lastDist = 0;
    el.addEventListener('touchstart', e => {
      if (e.touches.length === 2) {
        lastDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    }, { passive: true });
    el.addEventListener('touchmove', e => {
      if (!this.active || e.touches.length !== 2 || !lastDist) return;
      const d = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const delta = d - lastDist;
      lastDist = d;
      const cur = this.map.getZoom();
      if (delta < 0 && cur <= 3.05) {
        this._bridgeZoomOut(0.1);
        e.preventDefault();
        return;
      }
      const nz = Math.max(3, Math.min(19, cur + (delta > 0 ? 0.03 : -0.03)));
      if (Math.abs(nz - cur) > 0.01) this.map.setZoom(nz, { animate: false });
      e.preventDefault();
    }, { passive: false });
  },

  camZToZoom(camZ) {
    if (camZ > 1.7) return 12;
    if (camZ > 1.4) return 14;
    if (camZ > 1.2) return 16;
    return 18;
  },

  globeCenterLatLng() {
    if (window._lastPos?.lat != null) return window._lastPos;
    if (this._center?.lat != null) return this._center;
    return null;
  },

  flyTo(lat, lng, zoom) {
    this._center = { lat, lng };
    if (this.map) this.map.setView([lat, lng], zoom || 15, { animate: true });
  },

  async openAt(lat, lng, opts) {
    opts = opts || {};
    if (!this._ready || !this.map) this.init();
    if (!this.map) return false;
    const c = lat != null && lng != null ? { lat, lng } : (window._lastPos || this._center);
    if (!c?.lat) return false;
    this._center = c;
    window._lastPos = { lat: c.lat, lng: c.lng };
    userLocated = true;
    const camZ = opts.camZ ?? CityLife?.CITY_ZOOM ?? 1.34;
    const lz = opts.zoom ?? this.camZToZoom(camZ);
    this._forceOpen = true;
    if (!this.active) this._enter(camZ);
    else {
      this.map.setView([c.lat, c.lng], lz, { animate: false });
      this._invalidate();
      this._syncMarkers();
      this._syncRoute();
    }
    this.map.setView([c.lat, c.lng], lz, { animate: false });
    if (typeof camera !== 'undefined' && camera) {
      camera.position.z = camZ;
      camera.lookAt(0, 0, 0);
    }
    ZoomTiers?.goTo?.('city', false);
    cityLevel = true;
    CosmicZoom?.update?.(camZ, { tier: 'city', label: 'CITY', cosmic: 'earth' });
    setTimeout(() => { this._forceOpen = false; }, 4000);
    setTimeout(() => this._invalidate(), 80);
    return true;
  },

  onCamera(camZ, level) {
    if (!this._ready) return;
    if (window._globeFly) {
      if (this.active) this._syncView(camZ);
      return;
    }
    const earth = window._cityDropLock || this._forceOpen
      || (level || CosmicZoom?.level || 'earth') === 'earth';
    const driving = !!DrivingView?.active;
    const force = this._forceOpen || window._cityDropLock;
    if (force || driving) {
      if (!this.active) this._enter(camZ);
      else this._syncView(camZ);
      return;
    }
    const shouldEnter = earth && (camZ <= this.ENTER_Z || driving);
    const shouldExit = !earth || (camZ > this.EXIT_Z && !driving);
    if (shouldEnter && !this.active) this._enter(camZ);
    else if (shouldExit && this.active) this._exit();
    else if (this.active) this._syncView(camZ);
  },

  _enter(camZ) {
    this.active = true;
    cityLevel = true;
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.add('active');
    if (globe) globe.classList.add('city-map-active');
    // prevent white flash: force dark bg before map view
    if (el) el.style.background = 'var(--an-bg)';
    const mapContainer = this.map && this.map.getContainer ? this.map.getContainer() : null;
    if (mapContainer) mapContainer.style.background = 'var(--an-bg)';
    const c = window._lastPos || this.globeCenterLatLng() || this._center;
    if (!c?.lat) return;
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
    const chip = document.getElementById('city-life-chip');
    if (chip) {
      chip.classList.add('open');
      chip.innerHTML = '<b>City map</b> · scroll/pinch <b>out</b> for globe';
    }
    MapDepict?.setHud?.('City map', 'pinch/scroll out → globe');
    GlobeDeck?.setPreview?.('City map · scroll/pinch out to return to globe');
  },

  _exit() {
    this.active = false;
    cityLevel = false;
    const el = document.getElementById('city-map');
    const globe = document.getElementById('globe');
    if (el) el.classList.remove('active');
    if (globe) globe.classList.remove('city-map-active');
    EarthRealism?._hudTimer && (EarthRealism._hudTimer = 0);
  },

  _syncView(camZ) {
    if (window._globeFly || !this.map) return;
    const c = DrivingView?.active && window._lastPos
      ? window._lastPos
      : (window._lastPos || this.globeCenterLatLng() || this._center);
    if (!c?.lat) return;
    this._center = c;
    const lz = this.camZToZoom(camZ);
    try {
      if (this.map.getZoom() !== lz) this.map.setZoom(lz, { animate: false });
      const cur = this.map.getCenter();
      if (Math.abs(cur.lat - c.lat) > 0.0004 || Math.abs(cur.lng - c.lng) > 0.0004) {
        this.map.panTo([c.lat, c.lng], { animate: false });
      }
    } catch (_) {
      this.map.setView([c.lat, c.lng], lz, { animate: false });
    }
  },

  _icon(emoji, color) {
    return L.divIcon({
      className: 'city-map-pin',
      html: '<span style="background:' + color + ';border:2px solid #fff;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,0.45)">' + emoji + '</span>',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  },

  _setMarker(id, lat, lng, opts) {
    opts = opts || {};
    if (lat == null || lng == null) return;
    const prev = this._markers[id];
    if (prev) {
      prev.setLatLng([lat, lng]);
      return prev;
    }
    const m = L.marker([lat, lng], {
      icon: this._icon(opts.emoji || '◎', opts.color || 'rgba(0,140,220,0.9)'),
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
      this._setMarker('me', me.lat, me.lng, { emoji: '●', color: 'rgba(0,255,140,0.95)', title: 'You', onClick: () => GlobeEntity?.entities?.get('me') && GlobeEntity.activate(GlobeEntity.entities.get('me')) });
    }
  },

  _driverLatLng(d, u, i) {
    const lat = d.field_lat ?? d.lat ?? d.latitude;
    const lng = d.field_lng ?? d.lng ?? d.longitude;
    if (lat != null && lng != null) return { lat: +lat, lng: +lng };
    return { lat: u.lat + (Math.sin(i * 1.7) * 0.006), lng: u.lng + (Math.cos(i * 1.3) * 0.006) };
  },

  _seedDemoDrivers(c) {
    const u = c || window._lastPos || this._center || { lat: 36.44, lng: 28.22 };
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
    if (!u) return;
    this._demoDrivers.forEach((d, i) => {
      d.field_lat = u.lat + Math.sin(this._demoPhase + i * 2.1) * 0.008;
      d.field_lng = u.lng + Math.cos(this._demoPhase + i * 1.6) * 0.008;
    });
  },

  async _tickDrivers() {
    if (!this.active) return;
    const u = window._lastPos || this._center;
    if (!u) return;
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
        emoji: '🚗',
        color: 'rgba(80,180,255,0.92)',
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

  _syncRoute() {
    if (!this.map) return;
    if (this._route) {
      this.map.removeLayer(this._route);
      this._route = null;
    }
    const coords = this._routeCoords || DrivingView?.routeCoords || [];
    if (!coords.length || !this.active) return;
    const latlngs = coords.map(c => [c.lat, c.lng]);
    this._route = L.polyline(latlngs, {
      color: (AstranovTheme?.effectiveMode?.() || AstranovTheme?.mode) === 'bright' ? '#0066cc' : '#44ccff',
      weight: 5,
      opacity: 0.88,
    }).addTo(this.map);
  },

  _invalidate() {
    if (this.map) this.map.invalidateSize();
  }
};
window.CityMap = CityMap;

/* === 45-city-life.js === */
// === CITY LIFE — locate → fly → city satellite map · shops · drivers ===
// Must work in app phase WITHOUT deferred (placeMe/locateMe live in deferred).
var CityLife = {
  get CITY_ZOOM() {
    return GlobeControl?.cityEntryZ?.() ?? 1.34;
  },
  NEARBY_KM: 12,
  _friendTimer: null,
  _lastDrop: null,
  _locating: false,

  init() {
    this._startFriendMotion();
    const locateBtn = document.getElementById('aci-locate');
    if (locateBtn && !locateBtn._cityLifeBound) {
      locateBtn._cityLifeBound = true;
      locateBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        // Never call bare locateMe — undeclared in app phase → ReferenceError (dead app)
        void CityLife.safeLocate();
      }, { capture: true });
    }
    // Expose early so features boot / ribbon can call without deferred
    if (typeof window.locateMe !== 'function') {
      window.locateMe = function locateMeEarly() { return CityLife.safeLocate(); };
    }
  },

  markLocated(lat, lng) {
    window._lastPos = { lat, lng };
    try { userLocated = true; } catch (_) {}
    window.userLocated = true;
  },

  /** Lightweight marker without deferred placeMe */
  markMeOnGlobe(lat, lng) {
    this.markLocated(lat, lng);
    try {
      if (typeof placeMe === 'function') {
        placeMe(lat, lng, { quiet: true, markerOnly: true });
        return;
      }
      if (typeof window.placeMe === 'function') {
        window.placeMe(lat, lng, { quiet: true, markerOnly: true });
        return;
      }
    } catch (_) { /* fall through */ }
    try {
      if (typeof latLngToPos !== 'function' || typeof THREE === 'undefined') return;
      if (window._meMarker && window._meMarker.parent) window._meMarker.parent.remove(window._meMarker);
      const pos = latLngToPos(lat, lng, 1.03);
      const m = new THREE.Mesh(
        new THREE.SphereGeometry(0.028, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x3d9eff })
      );
      m.position.set(pos.x, pos.y, pos.z);
      m.userData = { type: 'me', name: 'You' };
      if (typeof globePivot !== 'undefined' && globePivot) globePivot.add(m);
      window._meMarker = m;
      MapDepict?.pulse?.(lat, lng, 0x3d9eff, 'You', 6000);
      GlobeEntity?.syncMe?.(lat, lng, 'You');
    } catch (_) {}
  },

  async safeLocate() {
    if (this._locating) {
      CliRibbon?.setNotice?.('Already locating…', 'info');
      return { error: 'busy' };
    }
    this._locating = true;
    const overall = new Promise((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error('locate timeout'), { code: 3 })), 16000);
    });
    try {
      GlobeDeck?.expand?.(window.PublicCopy?.deckTitle?.() || 'Astranov');
      GlobeDeck?.setMapStatus?.('Locating your city…');
      CliRibbon?.setNotice?.('Locating…', 'thinking');
      ACIControl?.reply?.('Locating — need GPS for your city');
      const r = await Promise.race([this.locateAndDropIn(), overall]);
      if (r?.error) {
        const msg = r.message || r.error;
        CliRibbon?.setNotice?.(String(msg).slice(0, 100), 'err');
        ACIControl?.reply?.(msg);
        return r;
      }
      CliRibbon?.setNotice?.('Located · city map', 'ready');
      return r;
    } catch (err) {
      const denied = err?.code === 1 || /denied/i.test(String(err?.message || err));
      const timed = err?.code === 3 || /timeout/i.test(String(err?.message || err));
      const msg = denied
        ? 'Location denied — enable GPS for this site, then tap 🎯 again'
        : timed
          ? 'Location timed out — try again with GPS on'
          : 'Location failed — check GPS / permissions, then tap 🎯 again';
      GlobeDeck?.setMapStatus?.(msg);
      CliRibbon?.setNotice?.(msg.slice(0, 100), 'err');
      ACIControl?.reply?.(msg);
      return { error: msg };
    } finally {
      this._locating = false;
    }
  },

  userPos() {
    // Real position only — callers that need a map must locate first (no silent Rhodes)
    if (window._lastPos?.lat != null && window._lastPos?.lng != null) return window._lastPos;
    return null;
  },

  ensureEarthView() {
    if (CosmicZoom) CosmicZoom.level = 'earth';
    ZoomTiers?.goTo?.('national', false);
    CosmicZoom?.update?.(GlobeControl?.Z?.national || 1.82, { tier: 'national', label: 'NATIONAL', cosmic: 'earth' });
    cityLevel = false;
  },

  async flyToCity(lat, lng, label) {
    try { this.ensureEarthView(); } catch (_) {}
    const z = this.CITY_ZOOM;
    try {
      if (typeof latLngToPos === 'function' && typeof flyToPoint === 'function' && typeof THREE !== 'undefined') {
        const p = latLngToPos(lat, lng, 1.04);
        flyToPoint(new THREE.Vector3(p.x, p.y, p.z), z, {
          dur: GlobeControl?.flyDuration?.(camera?.position?.z, z) || 1200,
        });
        if (typeof waitForGlobeFly === 'function') {
          await Promise.race([
            waitForGlobeFly(3000),
            new Promise((r) => setTimeout(r, 3200)),
          ]);
        }
      }
    } catch (_) {}
    try { GlobeControl?.engageFollow?.('locate'); } catch (_) {}
    try { GlobeControl?.noteAutoFly?.(); } catch (_) {}
    try { MapDepict?.pulse?.(lat, lng, 0x3d9eff, label || 'Your city', 14000); } catch (_) {}
  },

  nearbyVendors(lat, lng) {
    const list = window.Commerce?.vendors || [];
    if (!list.length || !window.Commerce?.haversineKm) return list;
    return list.filter(v => v.lat != null && window.Commerce.haversineKm(lat, lng, v.lat, v.lng) <= this.NEARBY_KM);
  },

  async dropIn(lat, lng, opts) {
    opts = opts || {};
    const pos = lat != null && lng != null ? { lat, lng } : this.userPos();
    if (!pos?.lat || pos.lng == null) {
      return { error: 'no_location', message: 'no location — allow GPS or tap 🎯 Locate' };
    }

    window._cityDropLock = true;
    this.markLocated(pos.lat, pos.lng);
    this._lastDrop = { lat: pos.lat, lng: pos.lng, t: Date.now() };
    try { CityPick?.hide?.(); } catch (_) {}

    try {
      // 1) National space first (fast — capped wait)
      const nationalZ = GlobeControl?.Z?.national || 1.82;
      GlobeDeck?.setMapStatus?.('National view…');
      try { ZoomTiers?.goTo?.('national', true); } catch (_) {}
      try {
        CosmicZoom?.update?.(nationalZ, { tier: 'national', label: 'NATIONAL', cosmic: 'earth' });
      } catch (_) {}
      try {
        if (typeof latLngToPos === 'function' && typeof flyToPoint === 'function' && typeof THREE !== 'undefined') {
          const gp = latLngToPos(pos.lat, pos.lng, 1.04);
          flyToPoint(new THREE.Vector3(gp.x, gp.y, gp.z), nationalZ, { dur: 1100 });
          if (typeof waitForGlobeFly === 'function') {
            await Promise.race([
              waitForGlobeFly(3500),
              new Promise((r) => setTimeout(r, 3600)),
            ]);
          }
        } else if (typeof camera !== 'undefined' && camera) {
          camera.position.z = nationalZ;
        }
      } catch (_) {}
      try { CityMap?.onCamera?.(nationalZ, 'earth'); } catch (_) {}
      CliRibbon?.setNotice?.('National · your region', 'ready');

      // 2) City map immediately — never block on shops/news for UI
      try { ZoomTiers?.goTo?.('city', true); } catch (_) {}
      GlobeDeck?.setMapStatus?.('Opening city map…');
      let opened = false;
      try {
        opened = !!(await CityMap?.openAt?.(pos.lat, pos.lng, { camZ: this.CITY_ZOOM }));
      } catch (e) {
        console.warn('[CityLife] openAt', e);
      }
      if (!opened) {
        try {
          CityMap?.init?.();
          CityMap?.onCamera?.(this.CITY_ZOOM, 'earth');
          if (!CityMap?.active) CityMap?._enter?.(this.CITY_ZOOM);
        } catch (_) {}
      }

      // 3) Soft city fly (do not hang if fly stuck)
      try {
        await Promise.race([
          this.flyToCity(pos.lat, pos.lng, opts.label || 'Your city'),
          new Promise((r) => setTimeout(r, 4000)),
        ]);
      } catch (_) {}

      // 4) Background enrichment — never gate city UI on this
      let nearby = [];
      let drivers = [];
      try {
        if (window.Commerce?.loadVendors) {
          await Promise.race([
            window.Commerce.loadVendors(),
            new Promise((resolve) => setTimeout(() => resolve(null), 2500)),
          ]);
        }
        nearby = this.nearbyVendors(pos.lat, pos.lng);
        if (nearby.length && window.Commerce) {
          window.Commerce.vendors = nearby
            .concat((window.Commerce.vendors || []).filter((v) => !nearby.includes(v)))
            .slice(0, 40);
        }
        window.Commerce?.showOnGlobe?.();
        GlobeEntity?.syncVendors?.(window.Commerce?.vendors);
        drivers = window.Commerce?.fetchNearbyDrivers
          ? await Promise.race([
            window.Commerce.fetchNearbyDrivers(pos.lat, pos.lng),
            new Promise((resolve) => setTimeout(() => resolve([]), 2500)),
          ])
          : [];
        window.Commerce?.showDriversOnGlobe?.(drivers);
      } catch (_) {}

      try {
        this._pulseFriends();
        this._showLocalNews(pos.lat, pos.lng);
        this._updateChip(nearby.length, drivers.length);
        CityMap?.onCamera?.(this.CITY_ZOOM, 'earth');
      } catch (_) {}

      const msg = nearby.length + ' shops · ' + drivers.length + ' drivers · '
        + (window.others?.length || 0) + ' friends nearby';
      GlobeDeck?.setMapStatus?.('🏙 City map · ' + pos.lat.toFixed(2) + ', ' + pos.lng.toFixed(2));
      GlobeDeck?.setPreview?.('🏙 ' + msg);
      AciCli?.print?.('◎ City view · ' + msg, 'ok');
      ACIControl?.reply?.('City map open — ' + msg + ' · tap a shop or type: order pitogyra');
      FieldBrain?.pulse?.('city', msg, { role: 'client', props: { lat: pos.lat, lng: pos.lng, shops: nearby.length } });

      if (opts.openShops && nearby.length) {
        try {
          GlobeDeck?.expand?.(window.SuperCli?.title || 'Astranov');
          await window.Commerce?.showPicker?.();
        } catch (_) {}
      }
      return {
        vendors: nearby,
        drivers,
        lat: pos.lat,
        lng: pos.lng,
        mapActive: !!(typeof CityMap !== 'undefined' && CityMap?.active),
      };
    } catch (e) {
      console.error('[CityLife] dropIn', e);
      AciCli?.print?.('city drop error: ' + (e.message || e), 'err');
      try { await CityMap?.openAt?.(pos.lat, pos.lng, { camZ: this.CITY_ZOOM }); } catch (_) {}
      return {
        error: e.message || 'city drop failed',
        lat: pos.lat,
        lng: pos.lng,
        mapActive: !!(typeof CityMap !== 'undefined' && CityMap?.active),
      };
    } finally {
      window._cityDropLock = false;
    }
  },

  _pulseFriends() {
    (window.others || []).forEach(u => {
      MapDepict?.pulse?.(u.lat, u.lng, 0xffaa33, (u.emoji || '') + ' ' + u.name, 15000);
    });
  },

  _showLocalNews(lat, lng) {
    NewsFeed?.fetch?.();
    const item = (NewsFeed?.items || [])[0] || 'News near you';
    MapDepict?.action?.('news', { lat, lng, detail: item.slice(0, 55), worldLat: lat, worldLng: lng });
    if (!GlobeDeck?.thinking) GlobeDeck?.setPreview('📰 ' + item.slice(0, 72));
  },

  _updateChip(shops, drivers) {
    const el = document.getElementById('city-life-chip');
    if (!el) return;
    el.classList.add('open');
    el.innerHTML = '<b>City</b> · ' + shops + ' shops · ' + drivers + ' drivers · friends live';
  },

  _startFriendMotion() {
    if (this._friendTimer) return;
    this._friendTimer = setInterval(() => this._tickFriends(), 3500);
  },

  _tickFriends() {
    if (Auth?.user || AstranovPresence?.rtChannel) return;
    if (!(window.others || []).length) return;
    const friends = window.others || [];
    friends.forEach((u) => {
      u.lat += (Math.random() - 0.5) * 0.0012;
      u.lng += (Math.random() - 0.5) * 0.0012;
    });
    window.others = friends;
    GlobeEntity?.syncFriends?.(friends);
    if (CityMap?.active) CityMap._syncMarkers?.();
  },

  async locateAndDropIn() {
    if (!navigator.geolocation) throw new Error('no geolocation');
    GlobeDeck?.setMapStatus?.('Locating…');
    const pos = await new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 60000,
      });
    });
    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    this.markMeOnGlobe(lat, lng);
    return this.dropIn(lat, lng, { label: 'Your city' });
  },

  SCENARIOS: {
    wake: async () => {
      AciCli?.print('scenario · wake — news on globe', 'cmd');
      NewsFeed?.flash?.();
      const u = CityLife.userPos();
      if (!u) return locateMe?.();
      await CityLife.dropIn(u.lat, u.lng, { label: 'Morning' });
    },
    news: async () => {
      NewsFeed?.flash?.();
      const u = CityLife.userPos();
      if (!u) return AciCli?.print('locate first for local news', 'dim');
      CityLife._showLocalNews(u.lat, u.lng);
    },
    youtube: async (q) => {
      await GlobeVideo?.find?.(q || 'interesting places earth documentary');
    },
    locate: async () => {
      await CityLife.locateAndDropIn();
    },
    city: async () => {
      const u = CityLife.userPos();
      if (!u) return locateMe?.();
      await CityLife.dropIn(u.lat, u.lng, { openShops: true });
    },
    friends: async () => {
      CityLife._pulseFriends();
      AciCli?.print((window.others || []).map(u => u.name + ' · ' + u.lat.toFixed(3)).join(' · '), 'ok');
    },
    drivers: async () => {
      const u = CityLife.userPos();
      if (!u) return AciCli?.print('locate first to see drivers', 'dim');
      const d = await window.Commerce?.fetchNearbyDrivers?.(u.lat, u.lng);
      window.Commerce?.showDriversOnGlobe?.(d);
      AciCli?.print(d.length ? d.map(x => (x.display_name || 'Driver')).join(' · ') : 'no active drivers — order to summon', 'ok');
    },
    shops: async () => {
      const u = CityLife.userPos();
      if (!u) return locateMe?.();
      await CityLife.dropIn(u.lat, u.lng, { openShops: true });
    },
    groceries: async () => { await window.Commerce?.smartOrder?.('pitogyra mpironia tsigareta'); },
    order: async (rest) => { await window.Commerce?.smartOrder?.(rest || 'pitogyra beer'); },
    reviews: async (rest) => {
      const q = rest || 'best restaurant near me';
      AciCli?.print('brain · reviews · ' + q, 'dim');
      const r = await ACI?.think?.('Summarize Google-style reviews for: ' + q + '. Short bullet list, best pick.');
      ACIControl?.reply(r || 'No reviews');
    },
    task: async (rest) => {
      CityTasks?.init?.();
      if (rest) await CityTasks?.handleCli?.('task ' + rest);
      else await CityTasks?.handleCli?.('task list');
    },
    job: async (rest) => {
      CityTasks?.init?.();
      await CityTasks?.handleCli?.('task job ' + (rest || 'barman 3h'));
    },
    date: async (rest) => {
      CityTasks?.init?.();
      await CityTasks?.handleCli?.('task date ' + (rest || 'coffee 2h'));
    },
    errand: async (rest) => {
      CityTasks?.init?.();
      await CityTasks?.handleCli?.('task errand ' + (rest || 'pharmacy'));
    },
    assign: async (rest) => {
      CityTasks?.init?.();
      if (rest) await FieldBrain?.claimDelivery?.(rest);
      else AciCli?.print('usage: scenario assign <order_id>', 'err');
    },
    crawl: async () => {
      const u = CityLife.userPos() || window._lastPos || { lat: 36.4341, lng: 28.2176 };
      await SpaceNetBrain?.crawlAll?.(u.lat, u.lng, 3, { force: true });
    },
    starship: async (rest) => {
      StarshipFlight13?.init?.();
      await StarshipFlight13?.handleCli?.(rest || 'starship');
    },
    starlink: async () => {
      StarlinkConstellation?.init?.();
      await StarlinkConstellation?.handleCli?.('starlink');
    },
    explore: async () => {
      const u = CityLife.userPos();
      MapDepict?.action?.('explore', { lat: u.lat, lng: u.lng, detail: 'things to do' });
      ACIControl?.reply('Drag globe · tap shops · type order or youtube');
    },
    stars: async () => {
      ZoomTiers?.goTo?.('global', true);
      CelestialNav?.printReport?.();
    },
    nav: async () => {
      ZoomTiers?.goTo?.('global', true);
      CelestialNav?.printReport?.();
    },
    list: async () => {
      const names = Object.keys(CityLife.SCENARIOS).filter(k => k !== 'list').join(' · ');
      AciCli?.print('scenarios: ' + names, 'ok');
    },
  },

  async run(name, rest) {
    const key = (name || 'list').toLowerCase();
    const fn = this.SCENARIOS[key];
    if (!fn) {
      AciCli?.print('unknown scenario — try: scenario list', 'err');
      return { error: 'unknown' };
    }
    try {
      await fn(rest);
      return { ok: true, scenario: key };
    } catch (e) {
      AciCli?.print('scenario error: ' + (e.message || e), 'err');
      return { error: e.message };
    }
  },

  listScenarios() {
    return Object.keys(this.SCENARIOS).filter(k => k !== 'list');
  },
};
window.CityLife = CityLife;

/* === 44-city-pick.js === */
// === CITY PICK — national airspace → choose a city → city map ===
// Flow: Earth/space tap → country view → city chips / second tap → CityLife.dropIn
const CityPick = {
  MAX_CHIPS: 6,
  NEAR_KM: 750,
  FALLBACK_KM: 1800,

  /** Major cities — offline picks, no fake places. Real lat/lng only. */
  CITIES: [
    { name: 'Athens', lat: 37.9838, lng: 23.7275 },
    { name: 'Thessaloniki', lat: 40.6401, lng: 22.9444 },
    { name: 'Rhodes', lat: 36.4341, lng: 28.2176 },
    { name: 'Heraklion', lat: 35.3387, lng: 25.1442 },
    { name: 'Patras', lat: 38.2466, lng: 21.7346 },
    { name: 'Istanbul', lat: 41.0082, lng: 28.9784 },
    { name: 'Sofia', lat: 42.6977, lng: 23.3219 },
    { name: 'Belgrade', lat: 44.7866, lng: 20.4489 },
    { name: 'Bucharest', lat: 44.4268, lng: 26.1025 },
    { name: 'Tirana', lat: 41.3275, lng: 19.8187 },
    { name: 'Rome', lat: 41.9028, lng: 12.4964 },
    { name: 'Milan', lat: 45.4642, lng: 9.19 },
    { name: 'Naples', lat: 40.8518, lng: 14.2681 },
    { name: 'Paris', lat: 48.8566, lng: 2.3522 },
    { name: 'Lyon', lat: 45.764, lng: 4.8357 },
    { name: 'Berlin', lat: 52.52, lng: 13.405 },
    { name: 'Munich', lat: 48.1351, lng: 11.582 },
    { name: 'London', lat: 51.5074, lng: -0.1278 },
    { name: 'Manchester', lat: 53.4808, lng: -2.2426 },
    { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
    { name: 'Barcelona', lat: 41.3874, lng: 2.1686 },
    { name: 'Lisbon', lat: 38.7223, lng: -9.1393 },
    { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
    { name: 'Brussels', lat: 50.8503, lng: 4.3517 },
    { name: 'Vienna', lat: 48.2082, lng: 16.3738 },
    { name: 'Prague', lat: 50.0755, lng: 14.4378 },
    { name: 'Warsaw', lat: 52.2297, lng: 21.0122 },
    { name: 'Budapest', lat: 47.4979, lng: 19.0402 },
    { name: 'Stockholm', lat: 59.3293, lng: 18.0686 },
    { name: 'Oslo', lat: 59.9139, lng: 10.7522 },
    { name: 'Copenhagen', lat: 55.6761, lng: 12.5683 },
    { name: 'Dublin', lat: 53.3498, lng: -6.2603 },
    { name: 'Zurich', lat: 47.3769, lng: 8.5417 },
    { name: 'Moscow', lat: 55.7558, lng: 37.6173 },
    { name: 'Kyiv', lat: 50.4501, lng: 30.5234 },
    { name: 'Cairo', lat: 30.0444, lng: 31.2357 },
    { name: 'Dubai', lat: 25.2048, lng: 55.2708 },
    { name: 'Tel Aviv', lat: 32.0853, lng: 34.7818 },
    { name: 'New York', lat: 40.7128, lng: -74.006 },
    { name: 'Los Angeles', lat: 34.0522, lng: -118.2437 },
    { name: 'Chicago', lat: 41.8781, lng: -87.6298 },
    { name: 'Miami', lat: 25.7617, lng: -80.1918 },
    { name: 'Toronto', lat: 43.6532, lng: -79.3832 },
    { name: 'Mexico City', lat: 19.4326, lng: -99.1332 },
    { name: 'São Paulo', lat: -23.5505, lng: -46.6333 },
    { name: 'Buenos Aires', lat: -34.6037, lng: -58.3816 },
    { name: 'Tokyo', lat: 35.6762, lng: 139.6503 },
    { name: 'Osaka', lat: 34.6937, lng: 135.5023 },
    { name: 'Seoul', lat: 37.5665, lng: 126.978 },
    { name: 'Beijing', lat: 39.9042, lng: 116.4074 },
    { name: 'Shanghai', lat: 31.2304, lng: 121.4737 },
    { name: 'Hong Kong', lat: 22.3193, lng: 114.1694 },
    { name: 'Singapore', lat: 1.3521, lng: 103.8198 },
    { name: 'Bangkok', lat: 13.7563, lng: 100.5018 },
    { name: 'Mumbai', lat: 19.076, lng: 72.8777 },
    { name: 'Delhi', lat: 28.6139, lng: 77.209 },
    { name: 'Sydney', lat: -33.8688, lng: 151.2093 },
    { name: 'Melbourne', lat: -37.8136, lng: 144.9631 },
    { name: 'Auckland', lat: -36.8509, lng: 174.7645 },
    { name: 'Cape Town', lat: -33.9249, lng: 18.4241 },
    { name: 'Lagos', lat: 6.5244, lng: 3.3792 },
    { name: 'Nairobi', lat: -1.2921, lng: 36.8219 },
  ],

  _anchor: null,

  init() {
    if (this._inited) return;
    this._inited = true;
    // Ensure chip host exists even if shell markup is thin
    if (!document.getElementById('city-pick-chips')) {
      const el = document.createElement('div');
      el.id = 'city-pick-chips';
      el.setAttribute('aria-label', 'Choose a city');
      document.body.appendChild(el);
    }
  },

  km(lat1, lng1, lat2, lng2) {
    if (TrackballGuard?.greatCircleKm) return TrackballGuard.greatCircleKm(lat1, lng1, lat2, lng2);
    if (window.Commerce?.haversineKm) return Commerce.haversineKm(lat1, lng1, lat2, lng2);
    const R = 6371;
    const toR = d => d * Math.PI / 180;
    const dLat = toR(lat2 - lat1);
    const dLng = toR(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(toR(lat1)) * Math.cos(toR(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(a)));
  },

  nearestName(lat, lng) {
    let best = null;
    let bestD = Infinity;
    for (const c of this.CITIES) {
      const d = this.km(lat, lng, c.lat, c.lng);
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best && bestD < 80) return best.name;
    return null;
  },

  near(lat, lng, maxKm, limit) {
    maxKm = maxKm ?? this.NEAR_KM;
    limit = limit ?? this.MAX_CHIPS;
    const scored = this.CITIES.map(c => ({
      ...c,
      km: this.km(lat, lng, c.lat, c.lng),
    })).sort((a, b) => a.km - b.km);
    let list = scored.filter(c => c.km <= maxKm).slice(0, limit);
    if (list.length < 3) {
      list = scored.filter(c => c.km <= this.FALLBACK_KM).slice(0, Math.max(3, limit));
    }
    if (!list.length) list = scored.slice(0, Math.min(4, limit));
    return list;
  },

  hide() {
    const el = document.getElementById('city-pick-chips');
    if (!el) return;
    el.classList.remove('visible');
    el.innerHTML = '';
    this._anchor = null;
  },

  /**
   * Show city choices after national entry.
   * @param {number} lat
   * @param {number} lng
   * @param {{ title?: string }} [opts]
   */
  show(lat, lng, opts) {
    opts = opts || {};
    this.init();
    const el = document.getElementById('city-pick-chips');
    if (!el || lat == null || lng == null) return;
    this._anchor = { lat, lng };
    const cities = this.near(lat, lng);
    const gps = window._lastPos?.lat != null ? window._lastPos : null;
    const chips = [];

    // Always offer the tapped spot as a city entry
    const tapLabel = this.nearestName(lat, lng);
    chips.push({
      id: 'here',
      label: tapLabel ? 'Open ' + tapLabel : 'Open here',
      lat, lng,
      kind: 'here',
    });

    if (gps && this.km(lat, lng, gps.lat, gps.lng) > 25) {
      chips.push({
        id: 'gps',
        label: '🎯 My city',
        lat: gps.lat,
        lng: gps.lng,
        kind: 'gps',
      });
    }

    cities.forEach(c => {
      // skip near-duplicate of tap
      if (this.km(lat, lng, c.lat, c.lng) < 12) return;
      chips.push({
        id: 'c-' + c.name,
        label: c.name,
        lat: c.lat,
        lng: c.lng,
        kind: 'city',
      });
    });

    const top = chips.slice(0, this.MAX_CHIPS + 1);
    el.innerHTML = '<div class="city-pick-head">' + (opts.title || 'Choose a city') + '</div>'
      + top.map(c =>
        '<button type="button" data-city-id="' + c.id + '" data-lat="' + c.lat + '" data-lng="' + c.lng + '">'
        + this._esc(c.label) + '</button>'
      ).join('');
    el.classList.add('visible');
    el.querySelectorAll('button[data-city-id]').forEach(btn => {
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const clat = parseFloat(btn.dataset.lat);
        const clng = parseFloat(btn.dataset.lng);
        const name = (btn.textContent || 'City').replace(/^Open\s+/, '').replace(/^🎯\s*/, '');
        void this.enter(clat, clng, name);
      };
    });

    MapDepict?.pulse?.(lat, lng, 0x3d9eff, 'pick city', 5000);
    const zl = document.getElementById('zoom-label');
    if (zl && !window.DrivingView?.active) {
      zl.textContent = 'Country · choose a city below · or tap the map';
    }
    GlobeDeck?.setPreview?.(opts.title || 'Country airspace · choose a city');
    AciCli?.print?.('city pick · ' + cities.slice(0, 4).map(c => c.name).join(' · '), 'ok');
  },

  _esc(s) {
    return String(s || '').replace(/[&<>"']/g, c =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  /** Enter city map at lat/lng (from chip or national second-tap). */
  async enter(lat, lng, label) {
    if (lat == null || lng == null) return { error: 'no_coords' };
    this.hide();
    MapPlaceMenu?.close?.();
    const name = label || this.nearestName(lat, lng) || 'City';
    GlobeDeck?.setPreview?.('Opening ' + name + '…');
    AciCli?.print?.('city → ' + name, 'ok');
    MapDepict?.pulse?.(lat, lng, 0x00ff99, name, 10000);

    if (typeof CityLife?.dropIn === 'function') {
      return CityLife.dropIn(lat, lng, { label: name, openShops: false });
    }
    // Fallback without CityLife
    const z = GlobeControl?.cityEntryZ?.() || GlobeControl?.Z?.city || 1.34;
    const p = latLngToPos(lat, lng, 1.04);
    ZoomTiers?.goTo?.('city', false);
    if (typeof flyToPoint === 'function') {
      flyToPoint(new THREE.Vector3(p.x, p.y, p.z), z, { onTier: true, dur: 2200 });
      if (typeof waitForGlobeFly === 'function') await waitForGlobeFly();
    }
    await CityMap?.openAt?.(lat, lng, { camZ: z });
    window._lastPos = { lat, lng };
    return { lat, lng, label: name };
  },

  /** True when camera/tier is national (country) airspace — ready for city pick. */
  isNationalView() {
    const tier = ZoomTiers?.current?.();
    if (tier?.city || CityMap?.active || cityLevel) return false;
    if (tier?.national) return true;
    const z = camera?.position?.z;
    if (z == null) return false;
    const enter = CityMap?.ENTER_Z ?? 1.58;
    return z <= 2.08 && z > enter + 0.02;
  },
};
window.CityPick = CityPick;

/* === 28-resource-monitor.js === */
// === RESOURCE + MONEY MONITOR — top-right fused field · one universal max total slider ===
// Universal cap = own app use + idle donate, on this device and fleet (never exceed slider %).
const ResourceMonitor = {
  version: '20260718-fuse-topright',
  PREFS_KEY: 'astranov:miner-rig-prefs',
  /** Universal max total load (own + donate) when idling — 0.15…1.0 */
  MAX_KEY: 'astranov:resource-max-total',
  /** legacy key still read once for migration */
  LEGACY_MAX_KEY: 'astranov:resource-max-occupy',
  _timer: null,
  _host: null,
  _collapsed: true,
  _bindTries: 0,

  init() {
    if (this._inited) return;
    this._inited = true;
    window.ResourceMonitor = this;
    // Apply stored cap immediately so miner/fleet respect it before HUD paints
    window._resourceMaxOccupy = this.maxTotal();
    window._resourceMaxTotal = this.maxTotal();
    this._inject();
    this._bind();
    this.refresh(true);
    // 2s tick when collapsed (default) — less main-thread noise
    this._timer = setInterval(() => this.refresh(false), this._collapsed ? 2000 : 1000);
    // Field HUD loads late — re-attach into money chip when it appears
    this._watchFieldHud();
    console.log('%c[ResourceMonitor] fused money+resources · top-right · universal max', 'color:#6cf;font-weight:700');
  },

  _watchFieldHud() {
    let n = 0;
    const t = setInterval(() => {
      n++;
      const fbh = document.getElementById('field-balance-hud');
      if (fbh && !fbh.querySelector('#rm-fuse')) {
        this._mountInto(fbh);
        this._bind();
        this.refresh(true);
      }
      // Remove orphan left/standalone panel once fused
      const orphan = document.getElementById('resource-monitor');
      if (fbh?.querySelector('#rm-fuse') && orphan) orphan.remove();
      if ((fbh?.querySelector('#rm-fuse') && n > 2) || n >= 40) clearInterval(t);
    }, 500);
  },

  _prefs() {
    try { return JSON.parse(localStorage.getItem(this.PREFS_KEY) || '{}'); } catch (_) { return {}; }
  },

  _savePrefs(p) {
    try { localStorage.setItem(this.PREFS_KEY, JSON.stringify(p)); } catch (_) {}
  },

  /**
   * Universal max total resource (0.15–1) including the user's own consumption when idling.
   * Example: 0.80 → app + donate never load device/fleet above 80%.
   */
  maxTotal() {
    try {
      let v = parseFloat(localStorage.getItem(this.MAX_KEY));
      if (!Number.isFinite(v)) {
        const legacy = parseFloat(localStorage.getItem(this.LEGACY_MAX_KEY));
        if (Number.isFinite(legacy)) v = legacy;
      }
      if (Number.isFinite(v)) return Math.min(1, Math.max(0.15, v));
    } catch (_) {}
    return 0.8;
  },

  /** Alias used by FieldHud / SpaceNetMiner */
  maxOccupy() {
    return this.maxTotal();
  },

  setMaxTotal(v) {
    const n = Math.min(1, Math.max(0.15, Number(v) || 0.8));
    try {
      localStorage.setItem(this.MAX_KEY, String(n));
      localStorage.setItem(this.LEGACY_MAX_KEY, String(n));
    } catch (_) {}
    window._resourceMaxOccupy = n;
    window._resourceMaxTotal = n;
    this._applyCapToRuntime(n);
    this._broadcastFleetCap(n);
    return n;
  },

  setMaxOccupy(v) {
    return this.setMaxTotal(v);
  },

  /** Spare fraction available for donate/fleet work when idling: max(0, cap − own) */
  idleDonateBudget() {
    const cap = this.maxTotal();
    const own = this.appLoad();
    return Math.max(0, Math.min(1, cap - own));
  },

  /** Total load if we donated at full budget (for display) */
  projectedTotalLoad() {
    return Math.min(1, this.appLoad() + this.idleDonateBudget());
  },

  donateLoad() {
    // Effective donate share under the universal cap
    const prefs = this._prefs();
    const keys = ['cpu', 'ram', 'storage', 'bandwidth'];
    const any = keys.some(k => prefs[k] !== false);
    if (!any) return 0;
    return this.idleDonateBudget();
  },

  _applyCapToRuntime(n) {
    try {
      if (window.SlumberManager?.applyTier) {
        SlumberManager._userPinned = true;
        // Cap maps to quality tier so idling never over-drives the machine
        let tier = 'gaming';
        if (n <= 0.35) tier = 'slumber';
        else if (n <= 0.55) tier = 'conserve';
        else if (n <= 0.75) tier = 'balanced';
        else if (n <= 0.9) tier = 'full';
        SlumberManager.applyTier(tier, 'universal max ' + Math.round(n * 100) + '%');
      }
      if (window.renderer?.setPixelRatio) {
        // Soft pixel-ratio ceiling from universal max (own + donate headroom)
        const pr = 0.55 + n * 0.7;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pr));
      }
    } catch (_) {}
  },

  _broadcastFleetCap(n) {
    try {
      if (typeof BroadcastChannel === 'undefined') return;
      if (!this._fleetCh) this._fleetCh = new BroadcastChannel('astranov-resource-cap-v1');
      this._fleetCh.postMessage({
        type: 'max_total',
        maxTotal: n,
        from: localStorage.getItem('astranov:miner-node-id') || 'local',
        at: Date.now(),
      });
    } catch (_) {}
    try {
      window.SpaceNetFleet?.setMaxTotal?.(n);
      window.SpaceNetResourceMonitor?.setMaxOccupy?.(n);
    } catch (_) {}
  },

  _listenFleetCap() {
    if (this._fleetListen || typeof BroadcastChannel === 'undefined') return;
    try {
      this._fleetCh = this._fleetCh || new BroadcastChannel('astranov-resource-cap-v1');
      this._fleetCh.onmessage = (ev) => {
        const msg = ev?.data;
        if (!msg || msg.type !== 'max_total') return;
        const n = Number(msg.maxTotal);
        if (!Number.isFinite(n)) return;
        // Fleet peer published a cap — take the min of local preference and peer request is NOT done;
        // each device applies its own user slider. Peers only mirror if tagged fleet-sync.
        if (msg.fleetSync) {
          try {
            localStorage.setItem(this.MAX_KEY, String(Math.min(1, Math.max(0.15, n))));
          } catch (_) {}
          window._resourceMaxOccupy = n;
          window._resourceMaxTotal = n;
          this.refresh(true);
        }
      };
      this._fleetListen = true;
    } catch (_) {}
  },

  inventory() {
    const nav = navigator;
    const mem = nav.deviceMemory || 0;
    const cores = nav.hardwareConcurrency || 2;
    const conn = nav.connection || nav.mozConnection || nav.webkitConnection;
    let heap = 0; let heapLimit = 0;
    try {
      if (performance.memory) {
        heap = performance.memory.usedJSHeapSize / 1048576;
        heapLimit = performance.memory.jsHeapSizeLimit / 1048576;
      }
    } catch (_) {}
    return {
      cores,
      ramGb: mem || 0,
      heapMb: Math.round(heap),
      heapLimitMb: Math.round(heapLimit),
      netMbps: conn?.downlink || 0,
      online: nav.onLine !== false,
      saveData: !!conn?.saveData,
    };
  },

  appLoad() {
    let load = 0.12;
    try {
      if (typeof FieldHud?.deviceLoad === 'function') load = Math.max(load, FieldHud.deviceLoad());
    } catch (_) {}
    try {
      const fps = SlumberManager?._avgFps?.();
      if (fps > 0) load = Math.max(load, Math.min(1, (55 - fps) / 40));
    } catch (_) {}
    try {
      if (performance.memory) {
        load = Math.max(load, Math.min(1, performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit));
      }
    } catch (_) {}
    // Active UI — treat as higher own consumption
    try {
      if (window.GlobeDeck?.thinking || window.DrivingView?.active || window._handsFreeVoice) {
        load = Math.max(load, 0.75);
      }
    } catch (_) {}
    return Math.min(1, Math.max(0, load));
  },

  moneySnapshot() {
    const Coins = document.getElementById('fbh-avc')?.textContent || '— Coins';
    const rate = document.getElementById('fbh-mine-rate')?.textContent
      || document.getElementById('mrp-rate')?.textContent
      || '0/h';
    const earned = document.getElementById('fbh-mine-earned')?.textContent || '+0';
    const peers = document.getElementById('fbh-peers')?.textContent || '0 peers';
    const eur = document.getElementById('fbh-eur')?.textContent || '';
    const usd = document.getElementById('fbh-usd')?.textContent || '';
    return { Coins, rate, earned, peers, eur, usd };
  },

  _css() {
    if (document.getElementById('resource-monitor-css')) return;
    const st = document.createElement('style');
    st.id = 'resource-monitor-css';
    st.textContent = [
      '#cosmic-guide{display:none!important}',
      /* Standalone fuse (before field-hud) */
      '#resource-monitor.rm-standalone{position:fixed;top:max(8px, env(safe-area-inset-top));right:8px;',
      'z-index:90;width:min(200px,48vw);padding:10px 11px;border-radius:12px;',
      'background:rgba(0,8,20,0.88);border:1px solid rgba(0,221,119,0.38);',
      'box-shadow:0 0 16px rgba(0,221,119,0.18),0 8px 24px rgba(0,0,0,0.45);',
      'font:10px/1.3 system-ui,sans-serif;color:#c8e4ff;backdrop-filter:blur(12px);',
      'touch-action:manipulation;user-select:none;text-align:right}',
      /* Fused inside money field */
      '#field-balance-hud #rm-fuse{margin-top:6px;padding-top:6px;border-top:1px solid rgba(0,221,119,0.22);text-align:right}',
      '#field-balance-hud{z-index:90!important}',
      '#rm-fuse .rm-bar-wrap{position:relative;height:10px;border-radius:999px;margin:4px 0 6px;',
      'background:rgba(0,20,40,0.75);border:1px solid rgba(61,158,255,0.28);overflow:hidden}',
      '#rm-fuse .rm-bar-app{position:absolute;left:0;top:0;bottom:0;width:0%;',
      'background:linear-gradient(90deg,#a33,#ff6644);box-shadow:0 0 6px rgba(255,100,60,0.4);transition:width .2s}',
      '#rm-fuse .rm-bar-donate{position:absolute;top:0;bottom:0;width:0%;',
      'background:linear-gradient(90deg,#0a6a8a,#3d9eff);box-shadow:0 0 6px rgba(61,158,255,0.35);transition:left .2s,width .2s}',
      '#rm-fuse .rm-bar-cap{position:absolute;top:-2px;bottom:-2px;width:2px;background:#ffdd44;',
      'box-shadow:0 0 6px #ffdd44;pointer-events:none}',
      '#rm-fuse .rm-meta{display:flex;justify-content:space-between;gap:6px;font-size:8px;color:#7a9aaa;margin-bottom:4px}',
      '#rm-fuse .rm-meta b{color:#a8d4ff;font-weight:700}',
      '#rm-fuse .rm-meta .rm-Coins-mini{color:#00ffaa;font-weight:800;font-size:10px}',
      '#rm-fuse .rm-master label{display:flex;justify-content:space-between;font-size:9px;color:#8ab;margin-bottom:2px}',
      '#rm-fuse .rm-master label span{color:#ffdd66;font-weight:700}',
      '#rm-fuse .rm-master input[type=range]{width:100%;height:16px;margin:0;appearance:none;-webkit-appearance:none;',
      'background:transparent;cursor:pointer}',
      '#rm-fuse .rm-master input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:999px;',
      'background:linear-gradient(90deg,rgba(255,220,68,0.25),rgba(0,221,119,0.35))}',
      '#rm-fuse .rm-master input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;width:16px;height:16px;margin-top:-5px;',
      'border-radius:50%;background:#fff;border:2px solid #ffdd44;box-shadow:0 0 8px rgba(255,220,68,0.7)}',
      '#rm-fuse .rm-foot{font-size:8px;color:#678;margin-top:4px;line-height:1.3}',
      '#rm-fuse .rm-foot.warn{color:#ff8866}',
      '#rm-fuse .rm-tog-row{display:flex;justify-content:flex-end;gap:4px;margin-top:4px}',
      '#rm-fuse .rm-tog{background:transparent;border:1px solid #456;color:#9ab;border-radius:8px;padding:2px 7px;cursor:pointer;font-size:9px}',
      '#rm-fuse.rm-collapsed .rm-body{display:none}',
      '#rm-fuse.rm-collapsed .rm-bar-wrap{margin-bottom:0}',
      /* Hide left-rail leftovers */
      '#resource-monitor:not(.rm-standalone){display:none!important}',
      '@media (max-width:420px){#resource-monitor.rm-standalone{width:min(168px,52vw);padding:8px}}',
    ].join('');
    document.head.appendChild(st);
  },

  _fuseHtml(includeMoney) {
    return [
      '<div id="rm-fuse" class="rm-collapsed" role="region" aria-label="Money and max resource">',
      includeMoney
        ? '<div class="rm-meta"><span class="rm-Coins-mini" id="rm-Coins">— Coins</span><span id="rm-earn-mini">⛏ —</span></div>'
        : '',
      '<div class="rm-meta"><span>You <b id="rm-app-pct">—</b></span><span>Spare <b id="rm-spare-pct">—</b></span><span>Cap <b id="rm-max-pct">80%</b></span></div>',
      '<div class="rm-bar-wrap" title="Red = your app · Blue = idle donate · Yellow mark = max total">',
      '<div class="rm-bar-app" id="rm-bar-app"></div>',
      '<div class="rm-bar-donate" id="rm-bar-donate"></div>',
      '<div class="rm-bar-cap" id="rm-bar-cap"></div>',
      '</div>',
      '<div class="rm-body">',
      '<div class="rm-master">',
      '<label>Max total (idle) <span id="rm-max-val">80%</span></label>',
      '<input type="range" id="rm-max-total" min="15" max="100" value="80" ',
      'title="Universal max for your use + donate on this device and fleet when idling" />',
      '</div>',
      '<div class="rm-foot" id="rm-foot">Includes your own use · idle donate only uses spare under the cap</div>',
      '</div>',
      '<div class="rm-tog-row"><button type="button" class="rm-tog" id="rm-expand" aria-expanded="false">Max ▾</button></div>',
      '</div>',
    ].join('');
  },

  _inject() {
    this._css();
    // Kill cosmic essay rail
    const cg = document.getElementById('cosmic-guide');
    if (cg) { cg.hidden = true; cg.style.display = 'none'; cg.innerHTML = ''; }

    const fbh = document.getElementById('field-balance-hud');
    if (fbh) {
      this._mountInto(fbh);
      return;
    }
    // Standalone top-right until FieldHud arrives
    if (document.getElementById('resource-monitor')) return;
    const el = document.createElement('div');
    el.id = 'resource-monitor';
    el.className = 'rm-standalone';
    el.innerHTML = this._fuseHtml(true);
    document.body.appendChild(el);
    this._host = el;
  },

  _mountInto(fbh) {
    if (!fbh || fbh.querySelector('#rm-fuse')) {
      this._host = fbh;
      return;
    }
    const wrap = document.createElement('div');
    wrap.innerHTML = this._fuseHtml(false);
    fbh.appendChild(wrap.firstChild);
    // Soften field-hud's own resource grid — fused bar replaces it visually
    const res = fbh.querySelector('.fbh-resources');
    if (res) res.style.display = 'none';
    this._host = fbh;
    // Drop standalone if present
    document.getElementById('resource-monitor')?.remove();
  },

  _bind() {
    this._listenFleetCap();
    const expand = document.getElementById('rm-expand');
    const slider = document.getElementById('rm-max-total');
    if (expand && !expand._rmBound) {
      expand._rmBound = true;
      expand.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.toggleExpand();
      });
    }
    if (slider && !slider._rmBound) {
      slider._rmBound = true;
      // Don't open miner panel when dragging the slider
      slider.addEventListener('click', (e) => e.stopPropagation());
      slider.addEventListener('pointerdown', (e) => e.stopPropagation());
      slider.addEventListener('input', (e) => {
        e.stopPropagation();
        const n = this.setMaxTotal((Number(e.target.value) || 80) / 100);
        this.refresh(true);
        CliRibbon?.setNotice?.(
          'Max total ' + Math.round(n * 100) + '% · own + idle donate · device & fleet',
          'ready'
        );
      });
      slider.addEventListener('change', (e) => e.stopPropagation());
    }
    // Expand on bar tap without opening miner (stop bubble only on fuse controls)
    const fuse = document.getElementById('rm-fuse');
    if (fuse && !fuse._rmBound) {
      fuse._rmBound = true;
      fuse.addEventListener('click', (e) => {
        if (e.target.closest('input,button,.rm-master,.rm-body')) {
          e.stopPropagation();
        }
      });
    }
  },

  toggleExpand() {
    const fuse = document.getElementById('rm-fuse');
    if (!fuse) return;
    this._collapsed = !this._collapsed;
    fuse.classList.toggle('rm-collapsed', this._collapsed);
    const b = document.getElementById('rm-expand');
    if (b) {
      b.textContent = this._collapsed ? 'Max ▾' : 'Max ▴';
      b.setAttribute('aria-expanded', this._collapsed ? 'false' : 'true');
    }
  },

  refresh(force) {
    const fuse = document.getElementById('rm-fuse');
    if (!fuse) return;

    const cg = document.getElementById('cosmic-guide');
    if (cg && cg.style.display !== 'none') {
      cg.innerHTML = '';
      cg.style.display = 'none';
      cg.hidden = true;
    }

    const own = this.appLoad();
    const cap = this.maxTotal();
    const spare = this.idleDonateBudget();
    const money = this.moneySnapshot();

    const setTxt = (id, v) => {
      const el = document.getElementById(id);
      if (el) el.textContent = v;
    };
    setTxt('rm-app-pct', Math.round(own * 100) + '%');
    setTxt('rm-spare-pct', Math.round(spare * 100) + '%');
    setTxt('rm-max-pct', Math.round(cap * 100) + '%');
    setTxt('rm-max-val', Math.round(cap * 100) + '%');
    setTxt('rm-Coins', money.Coins);
    setTxt('rm-earn-mini', '⛏ ' + money.rate + ' · ' + money.earned);

    const appBar = document.getElementById('rm-bar-app');
    const donBar = document.getElementById('rm-bar-donate');
    const capMark = document.getElementById('rm-bar-cap');
    if (appBar) appBar.style.width = (own * 100) + '%';
    if (donBar) {
      donBar.style.left = (own * 100) + '%';
      donBar.style.width = (spare * 100) + '%';
    }
    if (capMark) capMark.style.left = 'calc(' + (cap * 100) + '% - 1px)';

    const slider = document.getElementById('rm-max-total');
    if (slider && (force || document.activeElement !== slider)) {
      slider.value = String(Math.round(cap * 100));
    }

    // Mirror into field-hud mini stats if still visible
    setTxt('fbh-cpu', Math.round(own * 100) + '%');
    setTxt('fbh-ram', Math.round(cap * 100) + '% max');
    setTxt('fbh-storage', Math.round(spare * 100) + '% spare');
    setTxt('fbh-bw', 'idle only');

    const foot = document.getElementById('rm-foot');
    if (foot) {
      const over = own > cap + 0.02;
      foot.classList.toggle('warn', over);
      foot.textContent = over
        ? 'Over cap — close heavy views or raise Max total'
        : 'Max total includes your own use · idle donate uses only spare · device + fleet';
    }

    window._resourceMaxOccupy = cap;
    window._resourceMaxTotal = cap;
  },

  wants(text) {
    return /\b(resource|resources|donate|monitor|max\s*(load|total)|fleet\s*cap)\b/i.test(String(text || ''));
  },

  handleCli(line) {
    const low = String(line || '').toLowerCase();
    this.init();
    const m = low.match(/(?:max|cap)\s*(\d{1,3})\s*%?/);
    if (m) {
      const n = this.setMaxTotal(parseInt(m[1], 10) / 100);
      this.refresh(true);
      return 'Max total set to ' + Math.round(n * 100) + '% (own + idle donate · device & fleet)';
    }
    if (/expand|open|show/.test(low)) {
      this._collapsed = true;
      this.toggleExpand();
      return 'Resource max open · top right';
    }
    if (/hide|close|collapse/.test(low)) {
      this._collapsed = false;
      this.toggleExpand();
      return 'Resource panel collapsed';
    }
    AciCli?.print?.(
      'own ' + Math.round(this.appLoad() * 100) + '% · max ' + Math.round(this.maxTotal() * 100)
      + '% · spare ' + Math.round(this.idleDonateBudget() * 100) + '% · fleet cap shared',
      'ok'
    );
    return 'Universal max · top-right money field';
  },
};
window.ResourceMonitor = ResourceMonitor;

/* === 99-boot-app.js === */
// === SPARTAN BOOT · APP — map + slim CLI. No heavy subsystems. ===
window.__astranovBootApp = function __astranovBootApp() {
  const soft = (name, fn) => {
    try { fn?.(); } catch (e) { console.warn('[spartan app] ' + name, e); }
  };

  // Auth (optional — globe already works without it)
  soft('Auth', () => Auth?.init?.());

  // CLI ribbon collapsed — Earth stays the stage
  soft('GlobeDeck', () => {
    GlobeDeck?.init?.();
    try {
      GlobeDeck.bootCollapsed?.();
      GlobeDeck.expanded = false;
      GlobeDeck._size = 'collapsed';
      GlobeDeck.applySize?.();
      const deck = document.getElementById('globe-deck');
      deck?.classList.remove('expanded', 'size-third', 'size-full');
      deck?.classList.add('collapsed');
    } catch (_) {
      GlobeDeck?.bootCollapsed?.();
    }
    GlobeDeck?.setTitle?.(PublicCopy?.deckTitle?.() || 'Astranov');
    GlobeDeck?.setPreview?.('Earth · drag · scroll country · tap city · 🎯 locate');
  });

  soft('SuperCli', () => SuperCli?.init?.());
  soft('AciCli', () => AciCli?.init?.());
  soft('ClassifiedTriangles', () => ClassifiedTriangles?.init?.());

  // MAP — core product after Earth
  soft('CityMap', () => {
    CityMap?.init?.();
    // Retry Leaflet if still loading
    if (!CityMap?._ready) setTimeout(() => CityMap?.init?.(), 500);
  });
  soft('CityLife', () => CityLife?.init?.());
  soft('CityPick', () => CityPick?.init?.());

  soft('ResourceMonitor', () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => ResourceMonitor?.init?.(), { timeout: 1200 });
    } else {
      setTimeout(() => ResourceMonitor?.init?.(), 400);
    }
  });

  // Deferred pack only after map path is up
  try { LazyModules?.schedule?.(); } catch (_) {}

  // Unlock earth after short settle
  setTimeout(() => {
    window._bootEarthLock = false;
    try {
      if (camera?.position?.z > 4.8) {
        camera.position.z = 2.55;
        ZoomTiers?.goTo?.('global', false);
      }
    } catch (_) {}
    const ready = 'Ready · drag Earth · country · city · 🎯 locate';
    try { CliRibbon?.setNotice?.(ready, 'ready'); } catch (_) {}
    try { GlobeDeck?.setPreview?.(ready); } catch (_) {}
    const zl = document.getElementById('zoom-label');
    if (zl) zl.textContent = PublicCopy?.zoomLine?.('global') || ready;
  }, 300);

  window._astranovAppReady = true;
  document.documentElement.dataset.astranovPhase = 'app';
  console.log('%c[Spartan] map + CLI ready', 'color:#00dd77;font-weight:700');
};
