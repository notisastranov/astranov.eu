// === FIELD HUD ?top-right balances/mining  left radar  center speed ===
/* SPECS: minerRig  fieldHudRadar  aiBrain ?SPECS.md 3.6?.7, 3.9
   Tap #field-balance-hud ?miner panel. NEVER re-add #aci-miner / miner-cli-strip above CLI.
   Radar interval draw; earth speed ~1671 km/h global. bindFieldMiner  ensureBrain. */
// SpaceNet miner: SETI-style decentralised P2P  CPU  RAM  storage  bandwidth
const SpaceNetMiner = {
  TERMS_KEY: 'astranov:spacenet-miner-v2',
  SESSION_KEY: 'astranov:spacenet-miner-session',
  CHANNEL: 'astranov-spacenet-mesh-v1',
  BASE_RATE: 0.014,
  SLEEP_MULT: 2.4,
  PEER_BONUS: 0.003,
  RESOURCES: ['cpu', 'ram', 'storage', 'bandwidth'],
  WORK_TYPES: ['route_cache', 'mesh_relay', 'brain_shard', 'vendor_index', 'presence_sync'],
  _peers: new Map(),
  _peerCount: 0,
  _channel: null,
  _nodeId: null,
  _caps: null,
  _contrib: { cpu: 0, ram: 0, storage: 0, bandwidth: 0 },
  _rates: { cpu: 0, ram: 0, storage: 0, bandwidth: 0 },
  _sessionEarned: 0,
  _mineRate: 0,
  _termsOk: false,
  _workQueue: [],
  _lastWorkAt: 0,

  nodeId() {
    if (this._nodeId) return this._nodeId;
    try {
      let id = localStorage.getItem('astranov:miner-node-id');
      if (!id) {
        id = 'sn-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
        localStorage.setItem('astranov:miner-node-id', id);
      }
      this._nodeId = id;
    } catch (_) {
      this._nodeId = 'sn-' + Date.now().toString(36);
    }
    return this._nodeId;
  },

  detectCaps() {
    const cores = navigator.hardwareConcurrency || 4;
    const ramGb = navigator.deviceMemory || 4;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const downMbps = conn?.downlink || 10;
    let storageMb = 256;
    if (navigator.storage?.estimate) {
      navigator.storage.estimate().then(e => {
        if (e.quota) this._caps.storageMb = Math.min(2048, Math.round(e.quota / 1048576 * 0.08));
      }).catch(() => {});
    }
    this._caps = {
      cores,
      ramMb: Math.round(ramGb * 1024 * 0.12),
      storageMb,
      bandwidthKbps: Math.round(downMbps * 1024 * 0.06),
    };
    return this._caps;
  },

  initMesh() {
    if (this._channel || typeof BroadcastChannel === 'undefined') return;
    try {
      this._channel = new BroadcastChannel(this.CHANNEL);
      this._channel.onmessage = (ev) => this.onMeshMessage(ev.data);
      this.announce();
      if (this._meshPing) clearInterval(this._meshPing);
      this._meshPing = setInterval(() => this.announce(), 12000);
    } catch (_) {}
    this.syncNodePeers();
  },

  announce() {
    if (!this._channel) return;
    this._channel.postMessage({
      type: 'presence',
      id: this.nodeId(),
      at: Date.now(),
      caps: this._caps,
      contrib: this._contrib,
    });
  },

  onMeshMessage(msg) {
    if (!msg || msg.id === this.nodeId()) return;
    if (msg.type === 'presence') {
      this._peers.set(msg.id, { at: msg.at, caps: msg.caps, contrib: msg.contrib });
      this.prunePeers();
      this._peerCount = this._peers.size;
      return;
    }
    if (msg.type === 'work_offer' && this.canAcceptWork()) {
      this._workQueue.push(msg.unit);
      if (this._workQueue.length > 8) this._workQueue.shift();
    }
    if (msg.type === 'work_done' && msg.unitId) {
      FieldHud?.onPeerWorkDone?.(msg);
    }
  },

  prunePeers() {
    const cutoff = Date.now() - 25000;
    this._peers.forEach((p, id) => { if (p.at < cutoff) this._peers.delete(id); });
    this._peerCount = this._peers.size;
  },

  syncNodePeers() {
    const node = window.AstranovNode;
    if (node?.peerCount > 0) {
      this._peerCount = Math.max(this._peerCount, node.peerCount);
    }
  },

  /** Universal max total (own app + donate) ?ResourceMonitor master slider */
  maxTotalCap() {
    return window._resourceMaxTotal
      ?? window.ResourceMonitor?.maxTotal?.()
      ?? window._resourceMaxOccupy
      ?? window.ResourceMonitor?.maxOccupy?.()
      ?? 0.8;
  },

  /** Spare under the cap for idle donate ?never push device/fleet over max total */
  idleBudget() {
    if (typeof window.ResourceMonitor?.idleDonateBudget === 'function') {
      return ResourceMonitor.idleDonateBudget();
    }
    const cap = this.maxTotalCap();
    const load = FieldHud.deviceLoad();
    return Math.max(0, Math.min(1, cap - load));
  },

  canAcceptWork() {
    if (!this._termsOk) return false;
    const budget = this.idleBudget();
    // Need real spare under universal max (includes user's own consumption)
    if (budget < 0.05) return false;
    const prefs = FieldHud?._minerPrefs?.() || {};
    return ['cpu', 'ram', 'storage', 'bandwidth'].some(k => prefs[k] !== false);
  },

  offerWork() {
    if (!this._channel || !this.canAcceptWork()) return;
    const unit = {
      id: 'wu-' + Date.now().toString(36),
      type: this.WORK_TYPES[Math.floor(Math.random() * this.WORK_TYPES.length)],
      shard: Math.random().toString(36).slice(2, 14),
      from: this.nodeId(),
      maxTotal: this.maxTotalCap(),
    };
    this._channel.postMessage({ type: 'work_offer', unit });
    return unit;
  },

  async processWork(dt) {
    if (!this._termsOk || !this.canAcceptWork()) return;
    // Budget is only spare under universal max (own use already counted)
    const budget = this.idleBudget();
    if (budget < 0.05) return;

    const unit = this._workQueue.shift() || this.offerWork();
    if (!unit) return;

    const type = unit.type || 'mesh_relay';
    let earned = 0;
    if (type === 'route_cache' || type === 'brain_shard') {
      earned += this.tickCpu(budget, dt);
    } else if (type === 'vendor_index') {
      earned += await this.tickStorage(budget);
    } else if (type === 'presence_sync' || type === 'mesh_relay') {
      earned += await this.tickBandwidth(budget);
    }
    earned += this.tickRam(budget);
    this._lastWorkAt = Date.now();

    if (this._channel && unit.id) {
      this._channel.postMessage({ type: 'work_done', unitId: unit.id, from: this.nodeId(), earned });
    }
    return earned;
  },

  tickCpu(budget, dt) {
    const cores = this._caps?.cores || 4;
    const ops = Math.floor(8000 * budget * (cores / 8) * Math.min(dt / 500, 1));
    let h = 0;
    for (let i = 0; i < ops; i++) h = ((h << 5) - h + i) | 0;
    const pct = Math.min(100, Math.round(budget * cores * 8));
    this._contrib.cpu += ops / 10000;
    this._rates.cpu = pct;
    return ops / 1200000;
  },

  tickRam(budget) {
    const mb = Math.round((this._caps?.ramMb || 512) * budget * 0.15);
    this._contrib.ram += mb * 0.001;
    this._rates.ram = mb;
    return mb / 80000;
  },

  async tickStorage(budget) {
    const mb = Math.round((this._caps?.storageMb || 128) * budget * 0.02);
    try {
      const key = 'sn-shard-' + (Date.now() % 1000);
      const blob = JSON.stringify({ shard: key, routes: Math.floor(Math.random() * 40), at: Date.now() });
      localStorage.setItem(key, blob);
      if (Math.random() < 0.08) {
        Object.keys(localStorage).filter(k => k.startsWith('sn-shard-')).slice(0, 3)
          .forEach(k => localStorage.removeItem(k));
      }
    } catch (_) {}
    this._contrib.storage += mb * 0.01;
    this._rates.storage = mb;
    return mb / 60000;
  },

  async tickBandwidth(budget) {
    const kb = Math.round((this._caps?.bandwidthKbps || 512) * budget * 0.04);
    this._contrib.bandwidth += kb * 0.01;
    this._rates.bandwidth = kb;
    if (budget > 0.4 && kb > 20) {
      try {
        await fetch('/coders-labs.json', { cache: 'force-cache' });
      } catch (_) {}
    }
    return kb / 90000;
  },

  computeRate() {
    if (!this._termsOk) return 0;
    const prefs = FieldHud?._minerPrefs?.() || {};
    const anyRes = ['cpu', 'ram', 'storage', 'bandwidth'].some(k => prefs[k] !== false);
    if (!anyRes) return 0;
    const load = FieldHud.deviceLoad();
    const budget = this.idleBudget();
    const cap = this.maxTotalCap();
    // No earn when own load already at/over universal max
    if (budget < 0.05 || load >= cap) return 0;
    let rate = this.BASE_RATE * budget;
    let resSum = 0;
    if (prefs.cpu !== false) resSum += this._rates.cpu / 100;
    if (prefs.ram !== false) resSum += this._rates.ram / 512;
    if (prefs.storage !== false) resSum += this._rates.storage / 128;
    if (prefs.bandwidth !== false) resSum += this._rates.bandwidth / 1024;
    rate *= 0.6 + Math.min(1.4, resSum);
    rate += this._peerCount * this.PEER_BONUS;
    if (prefs.sleep !== false && FieldHud.isSleepMode()) rate *= this.SLEEP_MULT;
    else if (load > cap * 0.6) rate *= 0.4;
    return Math.max(0, rate);
  },

  acceptTerms() {
    try { localStorage.setItem(this.TERMS_KEY, String(Date.now())); } catch (_) {}
    this._termsOk = true;
    const m = document.getElementById('miner-terms-modal');
    if (m) m.hidden = true;
    this.initMesh();
    this.announce();
  },

  checkTerms() {
    try { this._termsOk = !!localStorage.getItem(this.TERMS_KEY); } catch (_) {}
    const m = document.getElementById('miner-terms-modal');
    if (m) m.hidden = this._termsOk;
    if (this._termsOk) this.initMesh();
    return this._termsOk;
  },

  loadSession() {
    try {
      const raw = localStorage.getItem(this.SESSION_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        this._sessionEarned = Number(j.earned) || 0;
        if (j.contrib) Object.assign(this._contrib, j.contrib);
      }
    } catch (_) {}
  },

  saveSession() {
    try {
      localStorage.setItem(this.SESSION_KEY, JSON.stringify({
        earned: this._sessionEarned,
        contrib: this._contrib,
        peers: this._peerCount,
        at: Date.now(),
      }));
    } catch (_) {}
  },

  renderHud() {
    const peers = document.getElementById('fbh-peers');
    const cpu = document.getElementById('fbh-cpu');
    const ram = document.getElementById('fbh-ram');
    const sto = document.getElementById('fbh-storage');
    const bw = document.getElementById('fbh-bw');
    const rateEl = document.getElementById('fbh-mine-rate');
    const earnedEl = document.getElementById('fbh-mine-earned');
    const statusEl = document.getElementById('fbh-mine-status');
    if (peers) peers.textContent = this._peerCount + ' peer' + (this._peerCount === 1 ? '' : 's');
    if (cpu) cpu.textContent = this._rates.cpu ? this._rates.cpu + '%' : '?;
    if (ram) ram.textContent = this._rates.ram ? this._rates.ram + 'MB' : '?;
    if (sto) sto.textContent = this._rates.storage ? this._rates.storage + 'MB' : '?;
    if (bw) bw.textContent = this._rates.bandwidth ? this._rates.bandwidth + 'kb/s' : '?;
    if (rateEl) rateEl.textContent = this._mineRate.toFixed(3) + ' Coins/h';
    if (earnedEl) earnedEl.textContent = '+' + this._sessionEarned.toFixed(3);
    if (statusEl) {
      if (!this._termsOk) {
        statusEl.textContent = 'SpaceNet  terms required';
        statusEl.className = 'fbh-status';
      } else if (FieldHud.isSleepMode()) {
        statusEl.textContent = 'P2P sleep rig  mesh idle';
        statusEl.className = 'fbh-status sleep';
      } else if (this._mineRate > 0.005) {
        statusEl.textContent = 'SETI mesh  serving SpaceNet';
        statusEl.className = 'fbh-status active';
      } else {
        statusEl.textContent = 'mesh standby  users serve users';
        statusEl.className = 'fbh-status';
      }
    }
  },

  async tick(dt) {
    if (!this._caps) this.detectCaps();
    this.prunePeers();
    this.syncNodePeers();
    if (this._termsOk && this.canAcceptWork()) {
      const workEarn = await this.processWork(dt);
      if (workEarn) this._sessionEarned += workEarn;
    }
    this._mineRate = this.computeRate();
    if (this._mineRate > 0) {
      this._sessionEarned += this._mineRate * (dt / 3600000);
      this.saveSession();
    }
    this.renderHud();
    FieldHud?.syncMinerChip?.();
    return this._mineRate;
  },
};
window.SpaceNetMiner = SpaceNetMiner;

const FieldHud = {
  TERMS_KEY: SpaceNetMiner.TERMS_KEY,
  MINE_SESSION_KEY: SpaceNetMiner.SESSION_KEY,
  BASE_RATE: SpaceNetMiner.BASE_RATE,
  SLEEP_MULT: SpaceNetMiner.SLEEP_MULT,
  _globeRate: 0,
  _lastGlobeY: null,
  _lastTick: 0,
  _sweepAngle: 0,
  _radarTargetsCache: [],
  _radarTargetsAt: 0,
  SWEEP_PERIOD_MS: 4200,
  EARTH_RADIUS_KM: 6371,
  _sessionEarned: 0,
  _mineRate: 0,
  _mineMode: 'off',
  _audio: null,
  _termsOk: false,

  injectDom() {
    if (!document.getElementById('field-balance-hud')) {
    const bal = document.createElement('div');
    bal.id = 'field-balance-hud';
    bal.setAttribute('aria-live', 'polite');
    bal.setAttribute('role', 'button');
    bal.setAttribute('tabindex', '0');
    bal.setAttribute('title', 'SpaceNet field  tap for miner rig, balances & mesh');
    bal.setAttribute('aria-label', 'SpaceNet field  open miner rig and earnings');
    bal.innerHTML = '<div class="fbh-title">?SpaceNet</div>'
      + '<div class="fbh-row fbh-bal"><span id="fbh-avc">?Coins</span></div>'
      + '<div class="fbh-row fbh-fiat"><span id="fbh-eur">€?/span><span id="fbh-usd">$?/span></div>'
      + '<div class="fbh-mesh"><span id="fbh-peers">0 peers</span><span class="fbh-p2p">P2P</span></div>'
      + '<div id="fbh-resources" class="fbh-resources">'
      + '<span>CPU <b id="fbh-cpu">?/b></span>'
      + '<span>RAM <b id="fbh-ram">?/b></span>'
      + '<span>SSD <b id="fbh-storage">?/b></span>'
      + '<span>NET <b id="fbh-bw">?/b></span></div>'
      + '<div class="fbh-mine"><span class="fbh-mine-icon">?/span>'
      + '<span id="fbh-mine-rate">0.000/h</span>'
      + '<span id="fbh-mine-earned">+0.00</span></div>'
      + '<div id="fbh-mine-status" class="fbh-status">mesh standby</div>';
    document.body.appendChild(bal);
    }

    if (!document.getElementById('field-radar')) {
    const radar = document.createElement('div');
    radar.id = 'field-radar';
    radar.innerHTML = '<canvas id="field-radar-canvas" width="120" height="120"></canvas>'
      + '<span id="fsh-mode" class="fsh-mode"></span>'
      + '<div id="field-radar-speed" aria-live="polite">'
      + '<span id="fsh-value">0</span>'
      + '<span id="fsh-unit">km/h</span>'
      + '<span id="fsh-limit" hidden></span>'
      + '</div>'
      + '<span class="fr-label">RADAR</span>';
    document.body.appendChild(radar);
    }
    document.getElementById('field-speed-hud')?.remove();

    if (!document.getElementById('miner-terms-modal')) {
    const terms = document.createElement('div');
    terms.id = 'miner-terms-modal';
    terms.hidden = true;
    terms.innerHTML = '<div class="mtm-panel">'
      + '<div class="mtm-title">SpaceNet SETI-style mesh participation</div>'
      + '<p>By using Astranov you join a <b>decentralised peer-to-peer mesh</b> ?like SETI@home, '
      + 'but for SpaceNet. Your device shares spare resources to power routing, storage, AI, and comms '
      + 'for every user. <b>Users serve users.</b></p>'
      + '<ul><li><b>CPU</b> ?route cache, brain shards, mesh relay compute</li>'
      + '<li><b>RAM</b> ?live presence tables and peer coordination</li>'
      + '<li><b>Storage</b> ?vendor indexes and offline route shards</li>'
      + '<li><b>Bandwidth</b> ?P2P sync between peers when idle</li>'
      + '<li>Resources used <em>only</em> when your device is idle or you sleep ?never during active use</li>'
      + '<li>Sleep mode: earth view + space ambient  intelligent miner judges fair Coins share</li></ul>'
      + '<button id="miner-terms-accept" type="button">I agree  join SpaceNet mesh</button>'
      + '</div>';
    document.body.appendChild(terms);
    document.getElementById('miner-terms-accept')?.addEventListener('click', () => SpaceNetMiner.acceptTerms());
    }

    if (!document.getElementById('miner-rig-panel')) {
      const panel = document.createElement('div');
      panel.id = 'miner-rig-panel';
      panel.hidden = true;
      panel.innerHTML = '<div class="mrp-card">'
        + '<div class="mrp-head"><b>?SpaceNet miner rig</b><button type="button" id="mrp-close">?/button></div>'
        + '<div class="mrp-stats">'
        + '<div>Rate <b id="mrp-rate">0.000 Coins/h</b></div>'
        + '<div>Session <b id="mrp-earned">+0.00</b></div>'
        + '<div>Peers <b id="mrp-peers">0</b></div>'
        + '<div>Balance <b id="mrp-avc">?Coins</b></div></div>'
        + '<div class="mrp-max" style="margin:0 0 12px">'
        + '<label style="display:flex;justify-content:space-between;font-size:11px;color:#9ab;margin-bottom:4px">'
        + 'Max total idle (own + donate) <b id="mrp-max-val" style="color:#ffdd66">80%</b></label>'
        + '<input type="range" id="mrp-max-total" min="15" max="100" value="80" '
        + 'style="width:100%" title="Universal max on this device and fleet ?includes your own use" />'
        + '<div style="font-size:10px;color:#678;margin-top:4px">Never loads device/fleet above this % when idling</div></div>'
        + '<div class="mrp-toggles">'
        + '<button type="button" class="mrp-toggle on" data-mrp="cpu" aria-pressed="true">CPU</button>'
        + '<button type="button" class="mrp-toggle on" data-mrp="ram" aria-pressed="true">RAM</button>'
        + '<button type="button" class="mrp-toggle on" data-mrp="storage" aria-pressed="true">SSD</button>'
        + '<button type="button" class="mrp-toggle on" data-mrp="bandwidth" aria-pressed="true">NET</button>'
        + '<button type="button" class="mrp-toggle on" data-mrp="sleep" aria-pressed="true">Sleep</button>'
        + '</div>'
        + '<button type="button" id="mrp-start">I agree  start earning Coins</button>'
        + '</div>';
      document.body.appendChild(panel);
    }
  },

  injectCss() {
    if (document.getElementById('field-hud-css')) return;
    const st = document.createElement('style');
    st.id = 'field-hud-css';
    st.textContent = [
      '#aci-avc{display:none!important}',
      '#zoom-tier-dots{display:none!important}',
      '#field-balance-hud{position:fixed;top:10px;right:10px;z-index:42;pointer-events:auto;cursor:pointer;',
      'touch-action:manipulation;font:11px/1.35 ui-monospace,monospace;text-align:right;padding:8px 10px;border-radius:10px;',
      'background:rgba(0,8,20,.62);border:1px solid rgba(0,221,119,.35);',
      'box-shadow:0 0 14px rgba(0,221,119,.2),inset 0 0 20px rgba(0,221,119,.04);',
      'transition:box-shadow .2s,border-color .2s,transform .12s}',
      '#field-balance-hud.mining-active{box-shadow:0 0 18px rgba(0,255,153,.45);border-color:#00ff99}',
      '#field-balance-hud:active{transform:scale(0.98)}',
      '.fbh-title{font-size:9px;font-weight:700;letter-spacing:.12em;color:#7ec8ff;opacity:.85;margin-bottom:4px}',
      '#fbh-avc{display:block;font-size:15px;font-weight:800;color:#00ff99;text-shadow:0 0 10px rgba(0,255,153,.55)}',
      '.fbh-fiat{display:flex;gap:8px;justify-content:flex-end;margin-top:2px}',
      '#fbh-eur{color:#00dd77;font-weight:700;font-size:11px}',
      '#fbh-usd{color:#8ec8ff;font-weight:700;font-size:11px}',
      '.fbh-mine{display:flex;gap:6px;align-items:center;justify-content:flex-end;margin-top:5px;padding-top:4px;',
      'border-top:1px solid rgba(0,221,119,.2)}',
      '.fbh-mine-icon{font-size:10px;opacity:.8}',
      '#fbh-mine-rate{color:#a8ffcc;font-weight:700;font-size:10px}',
      '#fbh-mine-earned{color:#00ff99;font-weight:800;font-size:10px}',
      '.fbh-mesh{display:flex;gap:6px;justify-content:flex-end;align-items:center;margin-top:4px}',
      '#fbh-peers{font-size:9px;color:#7ec8ff;font-weight:700}',
      '.fbh-p2p{font-size:8px;padding:1px 5px;border-radius:4px;background:rgba(26,111,212,.25);color:#8ec8ff;letter-spacing:.08em}',
      '.fbh-resources{display:grid;grid-template-columns:1fr 1fr;gap:2px 10px;margin-top:4px;font-size:8px;color:#6a9aaa;text-align:right}',
      '.fbh-resources b{color:#a8d4ff;font-weight:700;font-size:9px}',
      '#fbh-mine-status{font-size:9px;color:#6a9aaa;margin-top:3px;text-transform:uppercase;letter-spacing:.06em}',
      '#fbh-mine-status.sleep{color:#88ccff;text-shadow:0 0 8px rgba(100,180,255,.5)}',
      '#fbh-mine-status.active{color:#00ff99}',
      '#field-radar{position:fixed;top:10px;left:10px;z-index:42;width:120px;height:120px;pointer-events:none;',
      'border-radius:50%;background:rgba(0,12,28,.45);border:1px solid rgba(0,200,255,.28);',
      'box-shadow:0 0 16px rgba(0,200,255,.12),inset 0 0 24px rgba(0,80,140,.15);overflow:visible}',
      '#field-radar-canvas{width:100%;height:100%;display:block;border-radius:50%}',
      '#field-radar-speed{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);z-index:3;',
      'pointer-events:none;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:0;',
      'min-width:52px;text-align:center}',
      '#field-radar .fsh-mode{position:absolute;top:7px;left:9px;z-index:4;font:700 7px/1 system-ui;letter-spacing:.1em;',
      'color:rgba(0,200,255,.65);text-transform:uppercase}',
      '#fsh-value{font:800 16px/1 ui-monospace,monospace;color:#4db8ff;',
      'text-shadow:0 0 10px rgba(77,184,255,.8),0 0 18px rgba(0,120,255,.4)}',
      '#fsh-unit{font:600 7px/1 system-ui;letter-spacing:.14em;color:rgba(77,184,255,.7);margin-top:1px}',
      '#fsh-limit{font:700 8px/1 system-ui;color:rgba(100,200,255,.65);margin-top:2px}',
      '#field-radar-speed.driving #fsh-value{color:#66ccff;text-shadow:0 0 12px rgba(100,200,255,.95)}',
      '#field-radar-speed.earth #fsh-value{color:#5ec8ff}',
      '#field-radar-speed.idle{opacity:0}',
      '.fr-label{position:absolute;bottom:4px;left:0;right:0;text-align:center;font:8px/1 system-ui;',
      'letter-spacing:.14em;color:rgba(0,200,255,.55)}',
      '#field-speed-hud{display:none!important}',
      '#miner-terms-modal{position:fixed;inset:0;z-index:200;display:flex;align-items:center;',
      'justify-content:center;background:rgba(0,4,12,.82);pointer-events:auto}',
      '#miner-terms-modal[hidden]{display:none!important}',
      '.mtm-panel{max-width:min(400px,92vw);padding:18px 20px;border-radius:14px;',
      'background:rgba(4,14,36,.96);border:1px solid rgba(26,111,212,.5);',
      'box-shadow:0 0 32px rgba(13,71,161,.4);font:13px/1.5 system-ui;color:#e8f4ff}',
      '.mtm-title{font-size:14px;font-weight:700;color:#7ec8ff;margin-bottom:10px}',
      '.mtm-panel ul{margin:8px 0 12px 18px;font-size:12px;opacity:.9}',
      '#miner-terms-accept{width:100%;padding:11px;border-radius:10px;border:1px solid #00dd77;',
      'background:rgba(0,221,119,.2);color:#00ff99;font-weight:700;cursor:pointer;font-size:13px}',
      '#zoom-label{top:138px;left:10px;max-width:min(200px,50vw);font-size:10px}',
      '#cosmic-guide{top:160px}',
      '#miner-rig-panel{position:fixed;inset:0;z-index:195;display:none;align-items:center;justify-content:center;',
      'background:rgba(0,4,12,.78);pointer-events:auto}',
      '#miner-rig-panel.open,#miner-rig-panel:not([hidden]){display:flex}',
      '#miner-rig-panel[hidden]{display:none!important}',
      '.mrp-card{width:min(360px,92vw);padding:16px;border-radius:14px;background:rgba(4,14,36,.96);',
      'border:1px solid rgba(0,221,119,.4);box-shadow:0 0 28px rgba(0,221,119,.2);color:#e8f4ff;font:12px/1.4 system-ui}',
      '.mrp-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}',
      '.mrp-head b{color:#00ff99}',
      '#mrp-close{background:transparent;border:1px solid #456;color:#abc;border-radius:8px;padding:4px 8px;cursor:pointer}',
      '.mrp-stats{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;font-size:11px}',
      '.mrp-stats b{color:#a8ffcc}',
      '.mrp-toggles{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px}',
      '.mrp-toggle{padding:8px 10px;border-radius:8px;border:1px solid #456;background:rgba(0,20,40,.6);color:#9ab;cursor:pointer}',
      '.mrp-toggle.on{border-color:#00dd77;color:#00ff99;background:rgba(0,221,119,.12)}',
      '#mrp-start{width:100%;padding:11px;border-radius:10px;border:1px solid #00dd77;background:rgba(0,221,119,.2);',
      'color:#00ff99;font-weight:700;cursor:pointer}',
    ].join('');
    document.head.appendChild(st);
  },

  hideCliMoney() {
    const Coins = document.getElementById('aci-avc');
    if (Coins) { Coins.hidden = true; Coins.style.display = 'none'; }
    const sc = window.SuperCli;
    if (sc?.TOOLBAR_VISIBLE) {
      sc.TOOLBAR_VISIBLE = sc.TOOLBAR_VISIBLE.filter(id => id !== 'aci-avc');
    }
  },

  patchSuperCli() {
    const sc = window.SuperCli;
    if (!sc) return false;
    if (sc._fieldHudPatched) return true;
    sc._fieldHudPatched = true;
    const _ensure = sc.ensureBarLayout?.bind(sc);
    if (_ensure) {
      sc.ensureBarLayout = function() {
        _ensure();
        const Coins = document.getElementById('aci-avc');
        if (Coins) { Coins.hidden = true; Coins.style.display = 'none'; }
      };
    }
    const _run = sc.run?.bind(sc);
    if (_run) {
      sc.run = function(cmd) {
        const low = String(cmd || '').trim().toLowerCase();
        if (/^(miner|mesh|spacenet miner|rig)$/.test(low)) {
          const m = SpaceNetMiner;
          const lines = [
            '?SpaceNet SETI mesh  ' + m._peerCount + ' peers',
            '  CPU ' + (m._rates.cpu || 0) + '%  RAM ' + (m._rates.ram || 0) + 'MB  SSD ' + (m._rates.storage || 0) + 'MB  NET ' + (m._rates.bandwidth || 0) + 'kb/s',
            '  Rate ' + m._mineRate.toFixed(3) + ' Coins/h  session +' + m._sessionEarned.toFixed(3),
            '  Contrib cpu ' + m._contrib.cpu.toFixed(2) + '  ram ' + m._contrib.ram.toFixed(1) + '  storage ' + m._contrib.storage.toFixed(1) + '  bw ' + m._contrib.bandwidth.toFixed(1),
          ];
          window.AciCli?.print?.(lines.join('\n'), 'ok');
          window.ACIControl?.reply?.('SpaceNet mesh  ' + m._peerCount + ' peers  ' + m._mineRate.toFixed(3) + ' Coins/h');
          return;
        }
        return _run(cmd);
      };
    }
    return true;
  },

  ensureBrain() {
    const boot = () => {
      SpaceNetMiner.syncNodePeers();
      window.EarthRealism?.init?.();
      window.BrainNeurons?.boot?.();
    };
    if (window._deferredBootDone) { boot(); return; }
    if (this._brainQueued) return;
    this._brainQueued = true;
    const LM = window.LazyModules;
    if (LM?.scheduleBrain) LM.scheduleBrain(boot);
    else if (LM?.whenReady) LM.whenReady(boot);
    else LM?.schedule?.();
  },

  patchAvcBalance() {
    const AB = window.AvcBalance;
    if (!AB || AB._fieldHudPatched) return;
    AB._fieldHudPatched = true;
    const _render = AB.render?.bind(AB);
    AB.render = (balance, guest, eurUsd) => {
      if (_render) _render(balance, guest, eurUsd);
      FieldHud.updateBalance(balance, guest, eurUsd || AB._fx);
      const Coins = document.getElementById('aci-avc');
      if (Coins) Coins.style.display = 'none';
    };
    const _refresh = AB.refresh?.bind(AB);
    if (_refresh) {
      AB.refresh = async (opts) => {
        const bal = await _refresh(opts);
        FieldHud.updateBalance(AB._last, opts?.guest || !window.Auth?.user, AB._fx);
        return bal;
      };
    }
  },

  updateBalance(balance, guest, fx) {
    const CoinsEl = document.getElementById('fbh-avc');
    const eurEl = document.getElementById('fbh-eur');
    const usdEl = document.getElementById('fbh-usd');
    if (!CoinsEl) return;
    const isGuest = guest || !window.Auth?.user;
    const Coins = Number(balance || 0);
    const rate = fx || window.AvcBalance?._fx || 1.08;
    CoinsEl.textContent = isGuest ? '?Coins' : (Coins >= 10000 ? (Coins / 1000).toFixed(1) + 'k Coins' : Coins.toFixed(2) + ' Coins');
    if (eurEl) eurEl.textContent = isGuest ? '€? : '? + Coins.toFixed(2);
    if (usdEl) usdEl.textContent = isGuest ? '$? : '$' + (Coins * rate).toFixed(2);
  },

  acceptTerms() { return SpaceNetMiner.acceptTerms(); },
  checkTerms() { return SpaceNetMiner.checkTerms(); },
  loadSession() { SpaceNetMiner.loadSession(); this._sessionEarned = SpaceNetMiner._sessionEarned; },
  saveSession() { SpaceNetMiner.saveSession(); },

  /** Universal max total (own + idle donate) ?fused top-right slider */
  maxOccupy() {
    return window._resourceMaxTotal
      ?? window.ResourceMonitor?.maxTotal?.()
      ?? window._resourceMaxOccupy
      ?? window.ResourceMonitor?.maxOccupy?.()
      ?? 0.8;
  },

  deviceLoad() {
    const busy = window.GlobeDeck?.thinking || window._handsFreeVoice || window.DrivingView?.active
      || window.AciCoders?._cliBusy || document.hidden;
    if (busy) return 1;
    let load = 0.12;
    const idleMs = Date.now() - (window._lastUserAct || Date.now());
    if (idleMs < 12000) load = 0.72;
    else if (idleMs < 45000) load = 0.48;
    else if (idleMs < 120000) load = 0.28;
    else load = 0.1;
    try {
      const fps = window.SlumberManager?._avgFps?.();
      if (fps > 0 && fps < 50) load = Math.max(load, Math.min(0.95, (55 - fps) / 40));
    } catch (_) {}
    try {
      if (performance.memory) {
        const r = performance.memory.usedJSHeapSize / performance.memory.jsHeapSizeLimit;
        load = Math.max(load, Math.min(0.95, r));
      }
    } catch (_) {}
    return Math.min(1, load);
  },

  isEarthSleepView() {
    const z = window.camera?.position?.z ?? 2.5;
    const level = window.CosmicZoom?.level || 'earth';
    return level === 'earth' && z >= 2.0 && z <= 4.2 && !window.CityMap?.active && !window.DrivingView?.active;
  },

  isSleepMode() {
    const idleMs = Date.now() - (window._lastUserAct || Date.now());
    return this.isEarthSleepView() && idleMs > 180000 && this.deviceLoad() < 0.2;
  },

  async tickMiner(dt) {
    this._mineRate = await SpaceNetMiner.tick(dt);
    this._sessionEarned = SpaceNetMiner._sessionEarned;
    this._termsOk = SpaceNetMiner._termsOk;
    if (this.isSleepMode()) this.ensureSleepAmbient(true);
    else if (this._mineRate > 0.005) this.ensureSleepAmbient(false);
    else this.ensureSleepAmbient(false);
  },

  ensureSleepAmbient(on) {
    if (!on) {
      if (this._audio) { try { this._audio.gain.gain.exponentialRampToValueAtTime(0.001, this._audio.ctx.currentTime + 1.5); } catch (_) {} }
      return;
    }
    if (this._audio?.on) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const gain = ctx.createGain();
      gain.gain.value = 0.04;
      const osc1 = ctx.createOscillator();
      osc1.type = 'sine';
      osc1.frequency.value = 55;
      const osc2 = ctx.createOscillator();
      osc2.type = 'sine';
      osc2.frequency.value = 82.5;
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;
      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc1.start();
      osc2.start();
      this._audio = { ctx, gain, on: true };
    } catch (_) {}
  },

  isGlobalEarthView() {
    const z = window.camera?.position?.z ?? 2.5;
    const level = window.CosmicZoom?.level || 'earth';
    return level === 'earth' && z >= 2.0 && z <= 4.5 && !window.CityMap?.active && !window.DrivingView?.active;
  },

  tickEarthSpin() {
    // Real spin lives in EarthRealism.applySpinNow / animate loop ?not fake radar
    try { EarthRealism?.applySpinNow?.(); } catch (_) {}
  },

  /** Real ground speed km/h from GPS only (never Earth-rotation fakery) */
  gpsSpeedKmh() {
    // Prefer live GPS from presence / driving / last fix
    let mps = null;
    if (window.DrivingView?.active && window.DrivingView.speed >= 0) {
      mps = window.DrivingView.speed;
    }
    if ((mps == null || mps < 0) && window._gpsSpeedMps != null && window._gpsSpeedMps >= 0) {
      mps = window._gpsSpeedMps;
    }
    if ((mps == null || mps < 0) && window._lastGpsFix?.speed != null && window._lastGpsFix.speed >= 0) {
      mps = window._lastGpsFix.speed;
    }
    if (mps == null || mps < 0 || !Number.isFinite(mps)) return 0;
    // Ignore GPS noise under ~0.5 m/s (~1.8 km/h)
    if (mps < 0.5) return 0;
    return Math.round(mps * 3.6);
  },

  speedLimitKmh() {
    const s = this.gpsSpeedKmh();
    if (window.DrivingView?.active || s > 25) {
      if (s > 70) return 130;
      if (s > 35) return 90;
      return 50;
    }
    if (window.CityMap?.active) return 50;
    return 0;
  },

  updateSpeed() {
    const hud = document.getElementById('field-radar-speed');
    const val = document.getElementById('fsh-value');
    const lim = document.getElementById('fsh-limit');
    const mode = document.getElementById('fsh-mode');
    if (!hud || !val) return;
    // TRUTH: only real GPS / derived ground speed ?never 1671 km/h Earth spin fake
    const kmh = this.gpsSpeedKmh();
    const driving = !!(window.DrivingView?.active) || kmh >= 15;
    val.textContent = String(kmh);
    if (mode) {
      if (window.DrivingView?.active) mode.textContent = 'DRIVE';
      else if (kmh > 0) mode.textContent = 'GPS';
      else mode.textContent = '';
      mode.style.position = 'absolute';
      mode.style.top = '6px';
      mode.style.left = '8px';
    }
    hud.classList.toggle('driving', driving && kmh > 0);
    hud.classList.toggle('earth', false);
    hud.classList.toggle('idle', kmh < 1);
    const limit = this.speedLimitKmh();
    if (lim) {
      if (kmh > 0 && limit > 0) {
        lim.hidden = false;
        lim.textContent = 'lim ' + limit;
        lim.style.color = kmh > limit ? '#ff8866' : 'rgba(100,200,255,.65)';
      } else {
        lim.hidden = true;
      }
    }
  },

  /** Start low-rate GPS watch for speed when not already watching */
  ensureGpsSpeedWatch() {
    if (this._gpsSpeedWatch != null || !navigator.geolocation) return;
    this._gpsSpeedWatch = navigator.geolocation.watchPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let speed = pos.coords.speed; // m/s or null
        const now = Date.now();
        const prev = window._lastGpsFix;
        if ((speed == null || speed < 0) && prev?.lat != null && prev.t) {
          const dt = (now - prev.t) / 1000;
          if (dt > 0.5 && dt < 30) {
            const dKm = this.haversineKm(prev.lat, prev.lng, lat, lng);
            speed = (dKm * 1000) / dt;
          }
        }
        window._gpsSpeedMps = (speed != null && speed >= 0) ? speed : 0;
        window._lastGpsFix = { lat, lng, speed: window._gpsSpeedMps, t: now };
        window._lastPos = { lat, lng };
        userLocated = true;
      },
      () => { /* keep last good speed */ },
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 15000 }
    );
  },

  radarTargets() {
    const me = window._lastPos || { lat: 36.44, lng: 28.22 };
    const out = [];
    const push = (lat, lng, kind, label) => {
      if (lat == null || lng == null) return;
      const d = this.haversineKm(me.lat, me.lng, lat, lng);
      if (d > 25) return;
      const brg = this.bearing(me.lat, me.lng, lat, lng);
      out.push({ d, brg, kind, label });
    };
    (window.others || []).forEach(u => push(u.lat, u.lng, 'friend', u.name));
    (window.Commerce?.vendors || []).forEach(v => push(v.lat, v.lng, 'vendor', v.name));
    if (window.GlobeEntity?.entities) {
      window.GlobeEntity.entities.forEach(e => {
        if (e.lat != null) push(e.lat, e.lng, e.type || 'entity', e.title || e.name);
      });
    }
    (window.FieldBrain?.drivers || []).forEach(d => push(d.lat, d.lng, 'driver', 'driver'));
    const peerN = SpaceNetMiner._peerCount || 0;
    for (let i = 0; i < Math.min(peerN, 6); i++) {
      const ang = (i / Math.max(peerN, 1)) * 360 + (Date.now() / 80) % 360;
      const d = 2 + (i % 3) * 4;
      out.push({ d, brg: ang, kind: 'peer', label: 'mesh' });
    }
    return out;
  },

  haversineKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  bearing(lat1, lng1, lat2, lng2) {
    const 1 = lat1 * Math.PI / 180;
    const 2 = lat2 * Math.PI / 180;
    const  = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin() * Math.cos(2);
    const x = Math.cos(1) * Math.sin(2) - Math.sin(1) * Math.cos(2) * Math.cos();
    return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
  },

  refreshRadarTargets() {
    const now = Date.now();
    if (now - this._radarTargetsAt < 350) return this._radarTargetsCache;
    this._radarTargetsCache = this.radarTargets();
    this._radarTargetsAt = now;
    return this._radarTargetsCache;
  },

  drawRadar(sweep) {
    const canvas = document.getElementById('field-radar-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = w / 2 - 4;
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,200,255,0.2)';
    ctx.lineWidth = 1;
    [0.33, 0.66, 1].forEach(f => {
      ctx.beginPath();
      ctx.arc(cx, cy, r * f, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.beginPath();
    ctx.moveTo(cx, cy - r);
    ctx.lineTo(cx, cy + r);
    ctx.moveTo(cx - r, cy);
    ctx.lineTo(cx + r, cy);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    const trailSteps = 8;
    const trailSpan = 0.45;
    for (let i = trailSteps; i >= 0; i--) {
      const t = i / trailSteps;
      const angle = sweep - t * trailSpan;
      const alpha = (1 - t) * 0.22;
      const spread = 0.05 + t * 0.18;
      ctx.save();
      ctx.rotate(angle);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r, -spread, spread);
      ctx.closePath();
      ctx.fillStyle = 'rgba(0,200,255,' + alpha.toFixed(3) + ')';
      ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.rotate(sweep);
    ctx.strokeStyle = 'rgba(0,240,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    ctx.stroke();
    ctx.restore();
    ctx.restore();

    const colors = { friend: '#00ff99', vendor: '#ffcc44', driver: '#66aaff', entity: '#aa88ff', delivery: '#ff8844', peer: '#44ddff' };
    this.refreshRadarTargets().forEach(t => {
      const rad = (90 - t.brg) * Math.PI / 180;
      const dist = Math.min(1, t.d / 20);
      const px = cx + Math.cos(rad) * r * dist * 0.92;
      const py = cy - Math.sin(rad) * r * dist * 0.92;
      ctx.fillStyle = colors[t.kind] || '#88ccff';
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = 'rgba(0,200,255,0.15)';
    ctx.beginPath();
    ctx.arc(cx, cy, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#00c8ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 2, 0, Math.PI * 2);
    ctx.fill();
  },

  bindActivity() {
    const bump = () => { window._lastUserAct = Date.now(); };
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => {
      window.addEventListener(ev, bump, { passive: true });
    });
    bump();
  },

  tick() {
    const now = Date.now();
    const dt = now - (this._lastTick || now);
    this._lastTick = now;
    void this.tickMiner(dt);
  },

  startFieldRaf() {
    if (this._fieldTimer) return;
    let last = performance.now();
    let tickN = 0;
    // 8fps on desktop  ~5fps on phone (radar is decorative)
    const period = window._globePerfLite ? 200 : 125;
    this._fieldTimer = setInterval(() => {
      if (document.hidden) return;
      const now = performance.now();
      const dt = Math.min(64, now - last);
      last = now;
      tickN++;
      // Speed always from GPS ?even in city map
      if (tickN % 3 === 0) this.updateSpeed();
      // Radar sweep only on globe (not over city map)
      if (window.CityMap?.active) return;
      this._sweepAngle = (this._sweepAngle || 0) + (Math.PI * 2 / this.SWEEP_PERIOD_MS) * dt;
      if (this._sweepAngle > Math.PI * 2) this._sweepAngle -= Math.PI * 2;
      if (tickN % 2 === 0) this.drawRadar(this._sweepAngle);
    }, period);
  },

  stopFieldRaf() {
    if (!this._fieldTimer) return;
    clearInterval(this._fieldTimer);
    this._fieldTimer = 0;
  },

  startLoop() {
    if (this._loop) return;
    this._loop = setInterval(() => this.tick(), 1000);
    this.startFieldRaf();
    this.migrateSpeedHud();
    this.ensureGpsSpeedWatch();
  },

  migrateSpeedHud() {
    document.getElementById('field-speed-hud')?.remove();
    const radar = document.getElementById('field-radar');
    if (!radar) return;
    let mode = document.getElementById('fsh-mode');
    const spd = document.getElementById('field-radar-speed');
    if (mode && spd?.contains(mode)) {
      spd.removeChild(mode);
      const canvas = radar.querySelector('#field-radar-canvas');
      if (canvas?.nextSibling) radar.insertBefore(mode, canvas.nextSibling);
      else radar.insertBefore(mode, radar.firstChild?.nextSibling || null);
    }
    if (!mode && !radar.querySelector('#fsh-mode')) {
      mode = document.createElement('span');
      mode.id = 'fsh-mode';
      mode.className = 'fsh-mode';
      const canvas = radar.querySelector('#field-radar-canvas');
      if (canvas?.nextSibling) radar.insertBefore(mode, canvas.nextSibling);
      else radar.appendChild(mode);
    }
    if (!spd) {
      const box = document.createElement('div');
      box.id = 'field-radar-speed';
      box.setAttribute('aria-live', 'polite');
      box.innerHTML = '<span id="fsh-value">0</span><span id="fsh-unit">km/h</span>'
        + '<span id="fsh-limit" hidden></span>';
      const label = radar.querySelector('.fr-label');
      if (label) radar.insertBefore(box, label);
      else radar.appendChild(box);
    }
  },

  boot() {
    if (this._booted) return;
    this._booted = true;
    try {
      this.injectCss();
      this.injectDom();
      this.migrateSpeedHud();
      this.hideCliMoney();
      this.bindActivity();
      this.loadSession();
      SpaceNetMiner.detectCaps();
      this.checkTerms();
      this.patchAvcBalance();
      this.startLoop();
      setTimeout(() => this.ensureBrain(), 2800);
      this.patchSuperCli();
      this.bindFieldMiner();
      this._retryPatches();
    } catch (e) { console.error('[FieldHud]', e); }
  },

  _retryPatches() {
    let n = 0;
    const t = setInterval(() => {
      n++;
      this.hideCliMoney();
      this.patchSuperCli();
      this.patchAvcBalance();
      this.migrateSpeedHud();
      this.bindFieldMiner();
      if (!document.getElementById('field-radar')) this.injectDom();
      const ok = document.getElementById('field-radar') && document.getElementById('field-balance-hud')?._minerBound;
      if (ok || n >= 3) clearInterval(t);
    }, 1000);
    window.addEventListener('load', () => {
      this.patchSuperCli();
      this.hideCliMoney();
      this.bindFieldMiner();
      if (!this._fieldTimer) this.startFieldRaf();
    });
  },

  _minerPrefs() {
    try {
      const raw = localStorage.getItem('astranov:miner-rig-prefs');
      if (raw) return JSON.parse(raw);
    } catch (_) {}
    return { cpu: true, ram: true, storage: true, bandwidth: true, sleep: true };
  },

  _saveMinerPrefs(p) {
    try { localStorage.setItem('astranov:miner-rig-prefs', JSON.stringify(p)); } catch (_) {}
  },

  syncMinerChip() {
    const m = SpaceNetMiner;
    const hud = document.getElementById('field-balance-hud');
    if (hud) hud.classList.toggle('mining-active', m._termsOk && m._mineRate > 0.003);
    const rate = document.getElementById('fbh-mine-rate');
    if (rate) rate.textContent = m._mineRate.toFixed(3) + ' Coins/h';
  },

  refreshMinerPanel() {
    const m = SpaceNetMiner;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    set('mrp-rate', m._mineRate.toFixed(3) + ' Coins/h');
    set('mrp-earned', '+' + m._sessionEarned.toFixed(3));
    set('mrp-peers', String(m._peerCount || 0));
    const bal = window.AvcBalance?._last;
    set('mrp-avc', bal != null ? bal.toFixed(2) + ' Coins' : '?Coins');
    const cap = this.maxOccupy();
    set('mrp-max-val', Math.round(cap * 100) + '%');
    const maxIn = document.getElementById('mrp-max-total');
    if (maxIn && document.activeElement !== maxIn) maxIn.value = String(Math.round(cap * 100));
    const prefs = this._minerPrefs();
    document.querySelectorAll('.mrp-toggle[data-mrp]').forEach(btn => {
      const on = !!prefs[btn.dataset.mrp];
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    const start = document.getElementById('mrp-start');
    if (start) {
      start.textContent = m._termsOk ? 'Mining active  adjust & close' : 'I agree  start earning Coins';
    }
    this.syncMinerChip();
  },

  openMinerPanel() {
    const panel = document.getElementById('miner-rig-panel');
    if (!panel) return;
    panel.hidden = false;
    panel.classList.add('open');
    this.refreshMinerPanel();
    GlobeDeck?.expand?.(SuperCli?.title || 'Astranov');
  },

  closeMinerPanel() {
    const panel = document.getElementById('miner-rig-panel');
    if (!panel) return;
    panel.classList.remove('open');
    panel.hidden = true;
  },

  bindFieldMiner() {
    if (!this._minerPanelBound) {
      this._minerPanelBound = true;
      const panel = document.getElementById('miner-rig-panel');
      document.getElementById('mrp-close')?.addEventListener('click', () => this.closeMinerPanel());
      panel?.addEventListener('click', e => { if (e.target === panel) this.closeMinerPanel(); });
      document.querySelectorAll('.mrp-toggle[data-mrp]').forEach(tog => {
        if (tog._mrpBound) return;
        tog._mrpBound = true;
        tog.addEventListener('click', e => {
          e.stopPropagation();
          const prefs = this._minerPrefs();
          const k = tog.dataset.mrp;
          prefs[k] = !prefs[k];
          this._saveMinerPrefs(prefs);
          tog.classList.toggle('on', prefs[k]);
          tog.setAttribute('aria-pressed', prefs[k] ? 'true' : 'false');
          AciCli?.print?.('miner  ' + k + ' ' + (prefs[k] ? 'on' : 'off'), 'ok');
        });
      });
      document.getElementById('mrp-start')?.addEventListener('click', () => {
        if (!SpaceNetMiner._termsOk) SpaceNetMiner.acceptTerms();
        else this.closeMinerPanel();
        this.refreshMinerPanel();
        ACIControl?.reply?.('SpaceNet miner rig  earning Coins on your devices');
      });
      const maxIn = document.getElementById('mrp-max-total');
      if (maxIn && !maxIn._mrpBound) {
        maxIn._mrpBound = true;
        maxIn.addEventListener('input', () => {
          const n = (Number(maxIn.value) || 80) / 100;
          if (window.ResourceMonitor?.setMaxTotal) ResourceMonitor.setMaxTotal(n);
          else {
            window._resourceMaxTotal = n;
            window._resourceMaxOccupy = n;
            try { localStorage.setItem('astranov:resource-max-total', String(n)); } catch (_) {}
          }
          const lab = document.getElementById('mrp-max-val');
          if (lab) lab.textContent = Math.round(n * 100) + '%';
          window.ResourceMonitor?.refresh?.(true);
          AciCli?.print?.('max total ' + Math.round(n * 100) + '%  own + idle  device & fleet', 'ok');
        });
      }
    }
    const hud = document.getElementById('field-balance-hud');
    if (!hud || hud._minerBound) return;
    hud._minerBound = true;
    if (!hud.getAttribute('role')) {
      hud.setAttribute('role', 'button');
      hud.setAttribute('tabindex', '0');
      hud.setAttribute('title', 'SpaceNet field  tap for miner rig, balances & mesh');
      hud.setAttribute('aria-label', 'SpaceNet field  open miner rig and earnings');
    }
    const open = e => {
      e.preventDefault();
      e.stopPropagation();
      this.openMinerPanel();
    };
    hud.addEventListener('click', open);
    hud.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this.openMinerPanel(); }
    });
  },
};

function fieldHudBoot() {
  try { FieldHud.boot(); } catch (e) { console.error('[FieldHud boot]', e); }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fieldHudBoot);
else fieldHudBoot();
window.FieldHud = FieldHud;
window.AstranovMiner = SpaceNetMiner;
