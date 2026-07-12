// === FIELD HUD — top-right balances/mining · left radar · center speed ===
const FieldHud = {
  TERMS_KEY: 'astranov:miner-terms-v1',
  MINE_SESSION_KEY: 'astranov:miner-session',
  BASE_RATE: 0.014,
  SLEEP_MULT: 2.4,
  _globeRate: 0,
  _lastGlobeY: null,
  _lastTick: 0,
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
    bal.innerHTML = '<div class="fbh-title">◎ Astranov</div>'
      + '<div class="fbh-row fbh-bal"><span id="fbh-avc">— AVC</span></div>'
      + '<div class="fbh-row fbh-fiat"><span id="fbh-eur">€—</span><span id="fbh-usd">$—</span></div>'
      + '<div class="fbh-mine"><span class="fbh-mine-icon">⛏</span>'
      + '<span id="fbh-mine-rate">0.000/h</span>'
      + '<span id="fbh-mine-earned">+0.00</span></div>'
      + '<div id="fbh-mine-status" class="fbh-status">miner standby</div>';
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
      + '<div class="mtm-title">Astranov mining rig participation</div>'
      + '<p>By using Astranov you agree to join the collective <b>intelligent miner</b>. '
      + 'Resources are consumed only when your device is idle or while you sleep — never during active use.</p>'
      + '<ul><li>Mining runs when CPU load is low and you are not interacting</li>'
      + '<li>Sleep mode: earth view + space ambient helps you rest while earning AVC</li>'
      + '<li>Earnings judged by the Astranov miner AI · fair share of network value</li></ul>'
      + '<button id="miner-terms-accept" type="button">I agree · start mining</button>'
      + '</div>';
    document.body.appendChild(terms);
    document.getElementById('miner-terms-accept')?.addEventListener('click', () => this.acceptTerms());
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

  acceptTerms() {
    try { localStorage.setItem(this.TERMS_KEY, String(Date.now())); } catch (_) {}
    this._termsOk = true;
    const m = document.getElementById('miner-terms-modal');
    if (m) m.hidden = true;
    this._mineMode = 'standby';
  },

  checkTerms() {
    try { this._termsOk = !!localStorage.getItem(this.TERMS_KEY); } catch (_) {}
    const m = document.getElementById('miner-terms-modal');
    if (m) m.hidden = this._termsOk;
    return this._termsOk;
  },

  loadSession() {
    try {
      const raw = localStorage.getItem(this.MINE_SESSION_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        this._sessionEarned = Number(j.earned) || 0;
      }
    } catch (_) {}
  },

  saveSession() {
    try {
      localStorage.setItem(this.MINE_SESSION_KEY, JSON.stringify({
        earned: this._sessionEarned,
        at: Date.now(),
      }));
    } catch (_) {}
  },

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

  computeMineRate() {
    if (!this._termsOk) return 0;
    const load = this.deviceLoad();
    if (load > 0.7) return 0;
    let rate = this.BASE_RATE * (1 - load);
    if (this.isSleepMode()) rate *= this.SLEEP_MULT;
    else if (load > 0.3) rate *= 0.4;
    return Math.max(0, rate);
  },

  tickMiner(dt) {
    this._mineRate = this.computeMineRate();
    const earnedEl = document.getElementById('fbh-mine-earned');
    const rateEl = document.getElementById('fbh-mine-rate');
    const statusEl = document.getElementById('fbh-mine-status');
    if (this._mineRate > 0) {
      this._sessionEarned += this._mineRate * (dt / 3600000);
      this.saveSession();
    }
    if (rateEl) rateEl.textContent = this._mineRate.toFixed(3) + ' AVC/h';
    if (earnedEl) earnedEl.textContent = '+' + this._sessionEarned.toFixed(3);
    if (statusEl) {
      if (!this._termsOk) { statusEl.textContent = 'terms required'; statusEl.className = 'fbh-status'; }
      else if (this.isSleepMode()) {
        statusEl.textContent = 'sleep mining · space ambient';
        statusEl.className = 'fbh-status sleep';
        this.ensureSleepAmbient(true);
      } else if (this._mineRate > 0.005) {
        statusEl.textContent = 'mining · idle rig';
        statusEl.className = 'fbh-status active';
        this.ensureSleepAmbient(false);
      } else {
        statusEl.textContent = 'miner standby';
        statusEl.className = 'fbh-status';
        this.ensureSleepAmbient(false);
      }
    }
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

  drawRadar() {
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
    const sweep = (Date.now() % 4000) / 4000 * Math.PI * 2;
    const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grd.addColorStop(0, 'rgba(0,200,255,0)');
    grd.addColorStop(0.85, 'rgba(0,200,255,0)');
    grd.addColorStop(1, 'rgba(0,200,255,0.35)');
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sweep);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, -0.35, 0.35);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    const colors = { friend: '#00ff99', vendor: '#ffcc44', driver: '#66aaff', entity: '#aa88ff', delivery: '#ff8844' };
    this.radarTargets().forEach(t => {
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
    this.tickMiner(dt);
    this.drawRadar();
  },

  startLoop() {
    if (this._loop) return;
    this._loop = setInterval(() => this.tick(), 500);
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
    this.checkTerms();
    this.patchAvcBalance();
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
window.AstranovMiner = FieldHud;