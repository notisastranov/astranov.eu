// === ASTRANOV AI GRAPHICS ENGINE — gaming procedural layer, zero legacy 3D models ===
// 100% canvas-generated textures · particles · additive shaders · AI neural pulse
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
  _flyerPack: null,
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
    console.log('%c[Astranov AI Graphics Engine] Gaming procedural graphics live — zero model assets', 'color:#00ddff;font-weight:700');
    window._aiGraphicsReady = true;
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
    const t = frame * 0.14;
    const flap = Math.sin(t) * 0.22;
    const hover = Math.sin(t * 0.7) * 3;
    const cx = w * 0.5;
    const cy = h * 0.42 + hover;
    const accent = opts.accent || '#3d9eff';
    const glow = opts.glow || '#00ffcc';
    const wing = opts.wing || '#1a6fd4';

    ctx.clearRect(0, 0, w, h);

    const aura = ctx.createRadialGradient(cx, cy, 4, cx, cy, w * 0.48);
    aura.addColorStop(0, 'rgba(0,220,255,0.35)');
    aura.addColorStop(0.55, 'rgba(61,142,255,0.12)');
    aura.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = aura;
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalCompositeOperation = 'lighter';

    const drawWing = (side) => {
      const s = side * (1 + flap * 0.35);
      ctx.beginPath();
      ctx.moveTo(8 * s, -6);
      ctx.quadraticCurveTo(42 * s, -28 - flap * 18, 58 * s, 4);
      ctx.quadraticCurveTo(36 * s, 10, 10 * s, 2);
      const wg = ctx.createLinearGradient(0, -20, 50 * s, 10);
      wg.addColorStop(0, wing);
      wg.addColorStop(1, 'rgba(0,255,200,0.15)');
      ctx.fillStyle = wg;
      ctx.fill();
      ctx.strokeStyle = glow;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    };
    drawWing(-1);
    drawWing(1);

    const body = ctx.createLinearGradient(0, -18, 0, 36);
    body.addColorStop(0, accent);
    body.addColorStop(0.5, '#0a2848');
    body.addColorStop(1, 'rgba(0,40,80,0.2)');
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.moveTo(-10, -14);
    ctx.lineTo(10, -14);
    ctx.lineTo(14, 28);
    ctx.lineTo(-14, 28);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = glow;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -22, 11, 0, Math.PI * 2);
    ctx.stroke();
    const head = ctx.createRadialGradient(0, -22, 1, 0, -22, 11);
    head.addColorStop(0, '#ffffff');
    head.addColorStop(0.35, accent);
    head.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = head;
    ctx.beginPath();
    ctx.arc(0, -22, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = 'bold 22px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e8f8ff';
    ctx.shadowColor = glow;
    ctx.shadowBlur = 10;
    ctx.fillText('A', 0, 2);
    ctx.shadowBlur = 0;

    ctx.strokeStyle = 'rgba(0,255,180,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-6, 30);
    ctx.lineTo(-10, 46 + Math.sin(t) * 4);
    ctx.moveTo(6, 30);
    ctx.lineTo(10, 46 - Math.sin(t) * 4);
    ctx.stroke();

    if (opts.jet) {
      const jet = ctx.createLinearGradient(0, 34, 0, h);
      jet.addColorStop(0, glow);
      jet.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = jet;
      ctx.fillRect(-5, 34, 10, h - 34);
    }

    ctx.restore();
  },

  _ensureFlyerPack() {
    if (this._flyerPack) return this._flyerPack;
    this._flyerPack = this._procCanvas(128, 192, (ctx, w, h) => {
      this._paintAstranovCharacter(ctx, w, h, 0, {});
    });
    return this._flyerPack;
  },

  _syncFlyerTexture(flying) {
    const pack = this._ensureFlyerPack();
    const accent = Voice?.speaking ? '#00e86e' : '#3d9eff';
    const glow = Voice?.speaking ? '#88ffbb' : '#00ddff';
    this._paintAstranovCharacter(pack.ctx, 128, 192, this._flyerFrame, {
      accent, glow, wing: '#1a6fd4', jet: !!flying,
    });
    pack.tex.needsUpdate = true;
  },

  spawnAstranovFlyer(lat, lng, opts = {}) {
    if (this._flyer?.parent) this._flyer.parent.remove(this._flyer);
    const pack = this._ensureFlyerPack();
    this._syncFlyerTexture(false);
    const mat = new THREE.SpriteMaterial({
      map: pack.tex,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const sprite = new THREE.Sprite(mat);
    const alt = opts.alt || 1.09;
    const p = this._latLngToPos(lat ?? 36.44, lng ?? 28.22, alt);
    sprite.position.set(p.x, p.y, p.z);
    sprite.userData = {
      type: 'astranov-flyer',
      name: opts.label || 'Astranov',
      lat, lng, alt,
      edition: opts.edition?.id || 'astranov',
    };
    sprite.scale.set(0.16, 0.24, 1);
    globePivot.add(sprite);
    this._flyer = sprite;
    window._astranovFlyer = sprite;
    window._pilot = sprite;
    this.spawnEffect(sprite.position, opts.color || 0x3d9eff, 22, 48);
    return sprite;
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
      if (!p.isFlyer) {
        const n = pt.clone().normalize();
        p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      }
      const camZ = camera?.position?.z ?? 2.55;
      const scale = Math.max(0.1, Math.min(0.28, 0.14 * (camZ / 2.2)));
      if (p.isFlyer && p.mesh.isSprite) {
        p.mesh.scale.set(scale, scale * 1.5, 1);
        this._flyerFrame++;
        this._syncFlyerTexture(true);
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
    const camZ = camera?.position?.z ?? 2.55;
    const scale = Math.max(0.1, Math.min(0.26, 0.13 * (camZ / 2.2)));
    this._flyer.scale.set(scale, scale * 1.5, 1);
    this._syncFlyerTexture(false);
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