// === FIELD HUD — top-right balances/mining · left radar · center speed ===
// SpaceNet miner: SETI-style decentralised P2P · CPU · RAM · storage · bandwidth
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

  canAcceptWork() {
    return this._termsOk && FieldHud.deviceLoad() < 0.65;
  },

  offerWork() {
    if (!this._channel || !this.canAcceptWork()) return;
    const unit = {
      id: 'wu-' + Date.now().toString(36),
      type: this.WORK_TYPES[Math.floor(Math.random() * this.WORK_TYPES.length)],
      shard: Math.random().toString(36).slice(2, 14),
      from: this.nodeId(),
    };
    this._channel.postMessage({ type: 'work_offer', unit });
    return unit;
  },

  async processWork(dt) {
    if (!this._termsOk || !this.canAcceptWork()) return;
    const load = FieldHud.deviceLoad();
    const budget = Math.max(0, 1 - load);
    if (budget < 0.15) return;

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
    const load = FieldHud.deviceLoad();
    if (load > 0.7) return 0;
    let rate = this.BASE_RATE * (1 - load);
    const resSum = this._rates.cpu / 100 + this._rates.ram / 512 + this._rates.storage / 128 + this._rates.bandwidth / 1024;
    rate *= 0.6 + Math.min(1.4, resSum);
    rate += this._peerCount * this.PEER_BONUS;
    if (FieldHud.isSleepMode()) rate *= this.SLEEP_MULT;
    else if (load > 0.3) rate *= 0.4;
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
    if (cpu) cpu.textContent = this._rates.cpu ? this._rates.cpu + '%' : '—';
    if (ram) ram.textContent = this._rates.ram ? this._rates.ram + 'MB' : '—';
    if (sto) sto.textContent = this._rates.storage ? this._rates.storage + 'MB' : '—';
    if (bw) bw.textContent = this._rates.bandwidth ? this._rates.bandwidth + 'kb/s' : '—';
    if (rateEl) rateEl.textContent = this._mineRate.toFixed(3) + ' AVC/h';
    if (earnedEl) earnedEl.textContent = '+' + this._sessionEarned.toFixed(3);
    if (statusEl) {
      if (!this._termsOk) {
        statusEl.textContent = 'SpaceNet · terms required';
        statusEl.className = 'fbh-status';
      } else if (FieldHud.isSleepMode()) {
        statusEl.textContent = 'P2P sleep rig · mesh idle';
        statusEl.className = 'fbh-status sleep';
      } else if (this._mineRate > 0.005) {
        statusEl.textContent = 'SETI mesh · serving SpaceNet';
        statusEl.className = 'fbh-status active';
      } else {
        statusEl.textContent = 'mesh standby · users serve users';
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
  _sessionEarned: 0,
  _mineRate: 0,
  _mineMode: 'off',
  _audio: null,
  _termsOk: false,

  injectDom() {
    if (document.getElementById('field-balance-hud')) return;
    const bal = document.createElement('div');
    bal.id = 'field-balance-hud';
    bal.setAttribute('aria-live', 'polite');
    bal.innerHTML = '<div class="fbh-title">◎ SpaceNet</div>'
      + '<div class="fbh-row fbh-bal"><span id="fbh-avc">— AVC</span></div>'
      + '<div class="fbh-row fbh-fiat"><span id="fbh-eur">€—</span><span id="fbh-usd">$—</span></div>'
      + '<div class="fbh-mesh"><span id="fbh-peers">0 peers</span><span class="fbh-p2p">P2P</span></div>'
      + '<div id="fbh-resources" class="fbh-resources">'
      + '<span>CPU <b id="fbh-cpu">—</b></span>'
      + '<span>RAM <b id="fbh-ram">—</b></span>'
      + '<span>SSD <b id="fbh-storage">—</b></span>'
      + '<span>NET <b id="fbh-bw">—</b></span></div>'
      + '<div class="fbh-mine"><span class="fbh-mine-icon">⛏</span>'
      + '<span id="fbh-mine-rate">0.000/h</span>'
      + '<span id="fbh-mine-earned">+0.00</span></div>'
      + '<div id="fbh-mine-status" class="fbh-status">mesh standby</div>';
    document.body.appendChild(bal);

    const radar = document.createElement('div');
    radar.id = 'field-radar';
    radar.innerHTML = '<canvas id="field-radar-canvas" width="120" height="120"></canvas>'
      + '<span class="fr-label">RADAR</span>';
    document.body.appendChild(radar);

    const spd = document.createElement('div');
    spd.id = 'field-speed-hud';
    spd.innerHTML = '<span id="fsh-value">0</span><span id="fsh-unit">km/h</span>'
      + '<span id="fsh-limit" hidden></span>';
    document.body.appendChild(spd);

    const terms = document.createElement('div');
    terms.id = 'miner-terms-modal';
    terms.hidden = true;
    terms.innerHTML = '<div class="mtm-panel">'
      + '<div class="mtm-title">SpaceNet SETI-style mesh participation</div>'
      + '<p>By using Astranov you join a <b>decentralised peer-to-peer mesh</b> — like SETI@home, '
      + 'but for SpaceNet. Your device shares spare resources to power routing, storage, AI, and comms '
      + 'for every user. <b>Users serve users.</b></p>'
      + '<ul><li><b>CPU</b> — route cache, brain shards, mesh relay compute</li>'
      + '<li><b>RAM</b> — live presence tables and peer coordination</li>'
      + '<li><b>Storage</b> — vendor indexes and offline route shards</li>'
      + '<li><b>Bandwidth</b> — P2P sync between peers when idle</li>'
      + '<li>Resources used <em>only</em> when your device is idle or you sleep — never during active use</li>'
      + '<li>Sleep mode: earth view + space ambient · intelligent miner judges fair AVC share</li></ul>'
      + '<button id="miner-terms-accept" type="button">I agree · join SpaceNet mesh</button>'
      + '</div>';
    document.body.appendChild(terms);
    document.getElementById('miner-terms-accept')?.addEventListener('click', () => SpaceNetMiner.acceptTerms());
  },

  injectCss() {
    if (document.getElementById('field-hud-css')) return;
    const st = document.createElement('style');
    st.id = 'field-hud-css';
    st.textContent = [
      '#aci-avc{display:none!important}',
      '#zoom-tier-dots{display:none!important}',
      '#field-balance-hud{position:fixed;top:10px;right:10px;z-index:42;pointer-events:none;',
      'font:11px/1.35 ui-monospace,monospace;text-align:right;padding:8px 10px;border-radius:10px;',
      'background:rgba(0,8,20,.62);border:1px solid rgba(0,221,119,.35);',
      'box-shadow:0 0 14px rgba(0,221,119,.2),inset 0 0 20px rgba(0,221,119,.04)}',
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
      'box-shadow:0 0 16px rgba(0,200,255,.12),inset 0 0 24px rgba(0,80,140,.15);overflow:hidden}',
      '#field-radar-canvas{width:100%;height:100%;display:block}',
      '.fr-label{position:absolute;bottom:4px;left:0;right:0;text-align:center;font:8px/1 system-ui;',
      'letter-spacing:.14em;color:rgba(0,200,255,.55)}',
      '#field-speed-hud{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:41;',
      'pointer-events:none;display:flex;flex-direction:column;align-items:center;gap:2px}',
      '#fsh-value{font:700 42px/1 ui-monospace,monospace;color:#4db8ff;',
      'text-shadow:0 0 20px rgba(77,184,255,.75),0 0 40px rgba(0,120,255,.35)}',
      '#fsh-unit{font:600 11px/1 system-ui;letter-spacing:.2em;color:rgba(77,184,255,.75)}',
      '#fsh-limit{font:700 13px/1 system-ui;color:rgba(100,200,255,.65);margin-top:4px}',
      '#field-speed-hud.driving #fsh-value{color:#66ccff;text-shadow:0 0 24px rgba(100,200,255,.9)}',
      '#field-speed-hud.idle{opacity:0}',
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
    ].join('');
    document.head.appendChild(st);
  },

  hideCliMoney() {
    const avc = document.getElementById('aci-avc');
    if (avc) { avc.hidden = true; avc.style.display = 'none'; }
    const sc = window.SuperCli;
    if (sc?.TOOLBAR_VISIBLE) {
      sc.TOOLBAR_VISIBLE = sc.TOOLBAR_VISIBLE.filter(id => id !== 'aci-avc');
    }
  },

  patchSuperCli() {
    const sc = window.SuperCli;
    if (!sc || sc._fieldHudPatched) return;
    sc._fieldHudPatched = true;
    const _ensure = sc.ensureBarLayout?.bind(sc);
    if (_ensure) {
      sc.ensureBarLayout = function() {
        _ensure();
        const avc = document.getElementById('aci-avc');
        if (avc) { avc.hidden = true; avc.style.display = 'none'; }
      };
    }
    const _run = sc.run?.bind(sc);
    if (_run) {
      sc.run = function(cmd) {
        const low = String(cmd || '').trim().toLowerCase();
        if (/^(miner|mesh|spacenet miner|rig)$/.test(low)) {
          const m = SpaceNetMiner;
          const lines = [
            '◎ SpaceNet SETI mesh · ' + m._peerCount + ' peers',
            '  CPU ' + (m._rates.cpu || 0) + '% · RAM ' + (m._rates.ram || 0) + 'MB · SSD ' + (m._rates.storage || 0) + 'MB · NET ' + (m._rates.bandwidth || 0) + 'kb/s',
            '  Rate ' + m._mineRate.toFixed(3) + ' AVC/h · session +' + m._sessionEarned.toFixed(3),
            '  Contrib cpu ' + m._contrib.cpu.toFixed(2) + ' · ram ' + m._contrib.ram.toFixed(1) + ' · storage ' + m._contrib.storage.toFixed(1) + ' · bw ' + m._contrib.bandwidth.toFixed(1),
          ];
          window.AciCli?.print?.(lines.join('\n'), 'ok');
          window.ACIControl?.reply?.('SpaceNet mesh · ' + m._peerCount + ' peers · ' + m._mineRate.toFixed(3) + ' AVC/h');
          return;
        }
        return _run(cmd);
      };
    }
  },

  patchSpaceNetBrain() {
    window.LazyModules?.ensure?.().then(() => {
      SpaceNetMiner.syncNodePeers();
      const node = window.AstranovNode;
      if (node && !node._minerPatched) {
        node._minerPatched = true;
        const _hb = node.startHeartbeat?.bind(node);
        if (_hb) {
          node.startHeartbeat = function() {
            _hb();
            if (node._hb) {
              const orig = node._hb;
              clearInterval(node._hb);
              node._hb = setInterval(async () => {
                SpaceNetMiner.syncNodePeers();
              }, 30000);
            }
          };
        }
      }
    }).catch(() => {});
  },

  patchAvcBalance() {
    const AB = window.AvcBalance;
    if (!AB || AB._fieldHudPatched) return;
    AB._fieldHudPatched = true;
    const _render = AB.render?.bind(AB);
    AB.render = (balance, guest, eurUsd) => {
      if (_render) _render(balance, guest, eurUsd);
      FieldHud.updateBalance(balance, guest, eurUsd || AB._fx);
      const avc = document.getElementById('aci-avc');
      if (avc) avc.style.display = 'none';
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
    const avcEl = document.getElementById('fbh-avc');
    const eurEl = document.getElementById('fbh-eur');
    const usdEl = document.getElementById('fbh-usd');
    if (!avcEl) return;
    const isGuest = guest || !window.Auth?.user;
    const avc = Number(balance || 0);
    const rate = fx || window.AvcBalance?._fx || 1.08;
    avcEl.textContent = isGuest ? '— AVC' : (avc >= 10000 ? (avc / 1000).toFixed(1) + 'k AVC' : avc.toFixed(2) + ' AVC');
    if (eurEl) eurEl.textContent = isGuest ? '€—' : '€' + avc.toFixed(2);
    if (usdEl) usdEl.textContent = isGuest ? '$—' : '$' + (avc * rate).toFixed(2);
  },

  acceptTerms() { return SpaceNetMiner.acceptTerms(); },
  checkTerms() { return SpaceNetMiner.checkTerms(); },
  loadSession() { SpaceNetMiner.loadSession(); this._sessionEarned = SpaceNetMiner._sessionEarned; },
  saveSession() { SpaceNetMiner.saveSession(); },

  deviceLoad() {
    const busy = window.GlobeDeck?.thinking || window._handsFreeVoice || window.DrivingView?.active
      || window.AciCoders?._cliBusy || document.hidden;
    if (busy) return 1;
    const idleMs = Date.now() - (window._lastUserAct || Date.now());
    if (idleMs < 45000) return 0.85;
    if (idleMs < 120000) return 0.35;
    return 0.08;
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

  globeSpeedKmh() {
    const gp = window.globePivot;
    if (!gp) return 0;
    const y = gp.rotation.y;
    const now = performance.now();
    if (this._lastGlobeY == null) { this._lastGlobeY = y; this._lastGlobeTick = now; return 0; }
    const dt = (now - this._lastGlobeTick) / 1000;
    if (dt < 0.02) return this._globeRate;
    let dy = y - this._lastGlobeY;
    if (dy > Math.PI) dy -= Math.PI * 2;
    if (dy < -Math.PI) dy += Math.PI * 2;
    this._lastGlobeY = y;
    this._lastGlobeTick = now;
    const omega = Math.abs(dy) / dt;
    const earthKm = 6371;
    const v = omega * earthKm * 3.6;
    this._globeRate = this._globeRate * 0.7 + v * 0.3;
    return this._globeRate;
  },

  speedLimitKmh() {
    if (window.DrivingView?.active) {
      const s = (window.DrivingView?.speed || 0) * 3.6;
      if (s > 70) return 130;
      if (s > 35) return 90;
      return 50;
    }
    if (window.CityMap?.active) return 50;
    return 0;
  },

  updateSpeed() {
    const hud = document.getElementById('field-speed-hud');
    const val = document.getElementById('fsh-value');
    const lim = document.getElementById('fsh-limit');
    if (!hud || !val) return;
    let kmh = 0;
    let driving = false;
    if (window.DrivingView?.active) {
      kmh = Math.round((window.DrivingView.speed || 0) * 3.6);
      driving = true;
    } else if (!window.CityMap?.active && (window.CosmicZoom?.level === 'earth' || !window.CosmicZoom)) {
      kmh = Math.round(this.globeSpeedKmh());
    }
    val.textContent = String(kmh);
    hud.classList.toggle('driving', driving);
    hud.classList.toggle('idle', kmh < 2 && !driving);
    const limit = this.speedLimitKmh();
    if (lim) {
      if (driving && limit > 0) {
        lim.hidden = false;
        lim.textContent = 'limit ' + limit;
        lim.style.color = kmh > limit ? '#ff6688' : 'rgba(100,200,255,.65)';
      } else {
        lim.hidden = true;
      }
    }
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
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
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
    const trailSteps = 18;
    const trailSpan = 0.55;
    for (let i = trailSteps; i >= 0; i--) {
      const t = i / trailSteps;
      const angle = sweep - t * trailSpan;
      const alpha = (1 - t) * 0.28;
      const spread = 0.06 + t * 0.22;
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
    ctx.strokeStyle = 'rgba(0,240,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.shadowColor = 'rgba(0,220,255,0.9)';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -r);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    ctx.restore();

    const colors = { friend: '#00ff99', vendor: '#ffcc44', driver: '#66aaff', entity: '#aa88ff', delivery: '#ff8844', peer: '#44ddff' };
    this.refreshRadarTargets().forEach(t => {
      const rad = (90 - t.brg) * Math.PI / 180;
      const dist = Math.min(1, t.d / 20);
      const px = cx + Math.cos(rad) * r * dist * 0.92;
      const py = cy - Math.sin(rad) * r * dist * 0.92;
      ctx.fillStyle = colors[t.kind] || '#88ccff';
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    ctx.fillStyle = '#00c8ff';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.5, 0, Math.PI * 2);
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
    this.updateSpeed();
    void this.tickMiner(dt);
    this.refreshRadarTargets();
  },

  startRadarRaf() {
    if (this._radarRaf) return;
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(48, now - last);
      last = now;
      this._sweepAngle += (Math.PI * 2 / this.SWEEP_PERIOD_MS) * dt;
      if (this._sweepAngle > Math.PI * 2) this._sweepAngle -= Math.PI * 2;
      this.drawRadar(this._sweepAngle);
      this._radarRaf = requestAnimationFrame(step);
    };
    this._radarRaf = requestAnimationFrame(step);
  },

  startLoop() {
    if (this._loop) return;
    this._loop = setInterval(() => this.tick(), 500);
    this.startRadarRaf();
    requestAnimationFrame(function loop() {
      FieldHud.updateSpeed();
      requestAnimationFrame(loop);
    });
  },

  boot() {
    if (this._booted) return;
    this._booted = true;
    this.injectCss();
    this.injectDom();
    this.hideCliMoney();
    this.patchSuperCli();
    this.bindActivity();
    this.loadSession();
    SpaceNetMiner.detectCaps();
    this.checkTerms();
    this.patchAvcBalance();
    this.patchSpaceNetBrain();
    this.startLoop();
    window.LazyModules?.ensure?.().then(() => {
      this.patchAvcBalance();
      window.AvcBalance?.refresh?.();
    }).catch(() => {});
    setTimeout(() => window.AvcBalance?.refresh?.(), 2000);
  },
};

function fieldHudBoot() { FieldHud.boot(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fieldHudBoot);
else fieldHudBoot();
window.FieldHud = FieldHud;
window.AstranovMiner = SpaceNetMiner;