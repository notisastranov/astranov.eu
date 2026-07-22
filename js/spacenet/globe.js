/* Astranov SpaceNet Globe — real Earth texture + zoom tiers (solar→global→national→city) */
(function (global) {
  'use strict';

  const TIERS = {
    solar: { z: 7.5, label: 'SOLAR' },
    global: { z: 2.75, label: 'GLOBAL' },
    national: { z: 1.95, label: 'NATIONAL' },
    city: { z: 1.52, label: 'CITY' },
  };

  const G = {
    ready: false,
    renderer: null,
    scene: null,
    camera: null,
    earth: null,
    clouds: null,
    pivot: null,
    markers: [],
    dragging: false,
    lastAct: 0,
    frame: 0,
    tier: 'global',
    zoomAnim: null,
  };

  function isTouch() {
    try {
      return matchMedia('(pointer:coarse)').matches || navigator.maxTouchPoints > 0;
    } catch (_) {
      return false;
    }
  }

  function latLngToVec(lat, lng, r) {
    const phi = (90 - lat) * (Math.PI / 180);
    const theta = (lng + 180) * (Math.PI / 180);
    return new THREE.Vector3(
      -r * Math.sin(phi) * Math.cos(theta),
      r * Math.cos(phi),
      r * Math.sin(phi) * Math.sin(theta)
    );
  }

  function tierFromZ(z) {
    if (z >= 5.5) return 'solar';
    if (z >= 2.35) return 'global';
    if (z >= 1.7) return 'national';
    return 'city';
  }

  function setTierLabel() {
    G.tier = tierFromZ(G.camera.position.z);
    const el = document.getElementById('tier-label');
    if (el) el.textContent = TIERS[G.tier]?.label || G.tier;
    const zl = document.getElementById('zoom-label');
    if (zl) zl.textContent = 'Astranov SpaceNet · ' + (TIERS[G.tier]?.label || G.tier);
  }

  function init() {
    if (G.ready || typeof THREE === 'undefined') return false;
    const el = document.getElementById('globe');
    if (!el) return false;

    const touch = isTouch();
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;

    G.scene = new THREE.Scene();
    G.scene.background = new THREE.Color(0x000000);
    G.camera = new THREE.PerspectiveCamera(42, w / h, 0.05, 200);
    G.camera.position.set(0, 0.12, TIERS.global.z);

    G.renderer = new THREE.WebGLRenderer({
      antialias: !touch,
      alpha: false,
      powerPreference: touch ? 'low-power' : 'default',
    });
    G.renderer.setSize(w, h, false);
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 1.0 : 1.5));
    el.innerHTML = '';
    el.appendChild(G.renderer.domElement);

    const amb = new THREE.AmbientLight(0x445566, 0.55);
    const sun = new THREE.DirectionalLight(0xfff5e6, 1.35);
    sun.position.set(5, 1.2, 2.5);
    G.scene.add(amb, sun);

    G.pivot = new THREE.Object3D();
    G.scene.add(G.pivot);

    const segs = touch ? 48 : 64;
    const loader = new THREE.TextureLoader();
    // Real Earth textures (public NASA/blue-marble style CDN mirrors used by many demos)
    const earthUrl =
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg';
    const specUrl =
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_specular_2048.jpg';
    const cloudUrl =
      'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_clouds_1024.png';

    const mat = new THREE.MeshPhongMaterial({
      color: 0x223344,
      specular: 0x333333,
      shininess: 12,
    });
    G.earth = new THREE.Mesh(new THREE.SphereGeometry(1, segs, segs), mat);
    G.pivot.add(G.earth);

    loader.load(
      earthUrl,
      (tex) => {
        tex.anisotropy = Math.min(4, G.renderer.capabilities.getMaxAnisotropy?.() || 1);
        mat.map = tex;
        mat.color.set(0xffffff);
        mat.needsUpdate = true;
      },
      undefined,
      () => {
        // fallback solid ocean/land look
        mat.color.set(0x1a4d7a);
        mat.emissive = new THREE.Color(0x041018);
      }
    );
    loader.load(specUrl, (tex) => {
      mat.specularMap = tex;
      mat.needsUpdate = true;
    });

    // Clouds
    const cloudMat = new THREE.MeshLambertMaterial({
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    G.clouds = new THREE.Mesh(new THREE.SphereGeometry(1.015, segs, segs), cloudMat);
    G.pivot.add(G.clouds);
    loader.load(cloudUrl, (tex) => {
      cloudMat.map = tex;
      cloudMat.needsUpdate = true;
    });

    // Atmosphere
    G.pivot.add(
      new THREE.Mesh(
        new THREE.SphereGeometry(1.045, segs, segs),
        new THREE.MeshBasicMaterial({
          color: 0x4a9fff,
          transparent: true,
          opacity: 0.12,
          side: THREE.BackSide,
        })
      )
    );

    // Stars
    const starN = touch ? 400 : 900;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 20 + Math.random() * 50;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i * 3 + 2] = r * Math.cos(ph);
    }
    G.scene.add(
      new THREE.Points(
        new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPos, 3)),
        new THREE.PointsMaterial({ color: 0xffffff, size: 0.045, sizeAttenuation: true, opacity: 0.85, transparent: true })
      )
    );

    bindInput();
    window.addEventListener('resize', onResize, { passive: true });
    G.ready = true;
    G.lastAct = Date.now();
    setTierLabel();
    loop();
    return true;
  }

  function bindInput() {
    const canvas = G.renderer.domElement;
    let lx = 0,
      ly = 0,
      down = false;
    const onDown = (e) => {
      down = true;
      G.dragging = true;
      G.lastAct = Date.now();
      const t = e.touches ? e.touches[0] : e;
      lx = t.clientX;
      ly = t.clientY;
    };
    const onMove = (e) => {
      if (!down) return;
      G.lastAct = Date.now();
      const t = e.touches ? e.touches[0] : e;
      const dx = t.clientX - lx;
      const dy = t.clientY - ly;
      lx = t.clientX;
      ly = t.clientY;
      G.pivot.rotation.y += dx * 0.005;
      G.pivot.rotation.x = Math.max(-1.35, Math.min(1.35, G.pivot.rotation.x + dy * 0.004));
      if (e.cancelable) e.preventDefault();
    };
    const onUp = () => {
      down = false;
      G.dragging = false;
      G.lastAct = Date.now();
    };
    canvas.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove, { passive: false });
    window.addEventListener('pointerup', onUp);
    canvas.addEventListener(
      'wheel',
      (e) => {
        G.lastAct = Date.now();
        const next = Math.max(1.42, Math.min(9, G.camera.position.z + e.deltaY * 0.0022));
        G.camera.position.z = next;
        setTierLabel();
        // Cross into city tier → open street map
        if (next <= TIERS.city.z + 0.02 && !global.SNMap?.active) {
          const p = global._snLastPos || global.SNTasks?.pos || { lat: 36.43, lng: 28.22 };
          void global.SNMap?.open?.(p.lat, p.lng);
        }
        e.preventDefault();
      },
      { passive: false }
    );
    canvas.addEventListener('dblclick', () => {
      // double-click: dive national → city map
      if (G.camera.position.z > TIERS.national.z) goToTier('national');
      else {
        const p = global._snLastPos || global.SNTasks?.pos || { lat: 36.43, lng: 28.22 };
        goToTier('city');
        void global.SNMap?.open?.(p.lat, p.lng);
      }
    });
  }

  function onResize() {
    if (!G.renderer) return;
    const el = document.getElementById('globe');
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;
    G.camera.aspect = w / h;
    G.camera.updateProjectionMatrix();
    G.renderer.setSize(w, h, false);
  }

  function loop() {
    requestAnimationFrame(loop);
    if (!G.ready || document.hidden) return;
    // Pause heavy render when city map covers
    if (global.SNMap?.active) {
      if (++G.frame % 40 === 0) {
        try {
          G.renderer.render(G.scene, G.camera);
        } catch (_) {}
      }
      return;
    }
    G.frame++;
    const idle = Date.now() - G.lastAct > 2800;
    if (!G.dragging && !G.zoomAnim) {
      const skip = idle ? 3 : 1;
      if (G.frame % skip !== 0) return;
    }
    if (!G.dragging && idle && G.camera.position.z > 2.2) {
      G.pivot.rotation.y += 0.0009;
    }
    if (G.clouds) G.clouds.rotation.y += 0.00035;
    try {
      G.renderer.render(G.scene, G.camera);
    } catch (_) {}
  }

  function animateZ(toZ, ms) {
    const from = G.camera.position.z;
    const t0 = performance.now();
    const dur = ms || 650;
    G.zoomAnim = true;
    function step(t) {
      const k = Math.min(1, (t - t0) / dur);
      const e = k < 0.5 ? 2 * k * k : -1 + (4 - 2 * k) * k;
      G.camera.position.z = from + (toZ - from) * e;
      setTierLabel();
      G.lastAct = Date.now();
      if (k < 1) requestAnimationFrame(step);
      else G.zoomAnim = false;
    }
    requestAnimationFrame(step);
  }

  function goToTier(name) {
    const t = TIERS[name] || TIERS.global;
    if (name !== 'city') {
      try {
        global.SNMap?.close?.();
      } catch (_) {}
    }
    animateZ(t.z, 700);
    setHud('Astranov SpaceNet · ' + t.label);
    try {
      global.SNCli?.preview?.(t.label + ' zoom');
    } catch (_) {}
    return t.label;
  }

  function pulse(lat, lng, color, label, ms) {
    if (!G.ready) return null;
    const c = color != null ? color : 0x44ffaa;
    const pos = latLngToVec(lat, lng, 1.03);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.022, 10, 10),
      new THREE.MeshBasicMaterial({ color: c })
    );
    mesh.position.copy(pos);
    G.pivot.add(mesh);
    // ring
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(0.03, 0.045, 24),
      new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.65, side: THREE.DoubleSide })
    );
    ring.position.copy(pos);
    ring.lookAt(0, 0, 0);
    G.pivot.add(ring);
    G.markers.push({ mesh, ring, born: Date.now(), ms: ms || 14000 });
    const now = Date.now();
    G.markers = G.markers.filter((m) => {
      if (now - m.born > m.ms) {
        try {
          G.pivot.remove(m.mesh);
          if (m.ring) G.pivot.remove(m.ring);
        } catch (_) {}
        return false;
      }
      return true;
    });
    G.lastAct = Date.now();
    flyNear(lat, lng);
    return mesh;
  }

  function flyNear(lat, lng, tierHint) {
    if (!G.ready) return;
    const targetY = (-lng * Math.PI) / 180;
    const targetX = ((lat * Math.PI) / 180) * 0.55;
    const startY = G.pivot.rotation.y;
    const startX = G.pivot.rotation.x;
    const t0 = performance.now();
    const dur = 800;
    function step(t) {
      const k = Math.min(1, (t - t0) / dur);
      const e = k * (2 - k);
      G.pivot.rotation.y = startY + (targetY - startY) * e;
      G.pivot.rotation.x = startX + (targetX - startX) * e;
      G.lastAct = Date.now();
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    if (tierHint) goToTier(tierHint);
    else if (G.camera.position.z > TIERS.national.z) animateZ(TIERS.national.z, 700);
  }

  function locate() {
    return new Promise((resolve) => {
      function finish(lat, lng, demo) {
        global._snLastPos = { lat, lng };
        try {
          global.SNTasks?.setPos?.(lat, lng);
        } catch (_) {}
        pulse(lat, lng, 0x3d9eff, demo ? 'You (demo)' : 'You', 22000);
        goToTier('national');
        resolve({ lat, lng, demo: !!demo });
      }
      if (!navigator.geolocation) return finish(36.4341, 28.2176, true);
      navigator.geolocation.getCurrentPosition(
        (pos) => finish(pos.coords.latitude, pos.coords.longitude, false),
        () => finish(36.4341, 28.2176, true),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
      );
    });
  }

  function setHud(text) {
    const el = document.getElementById('hud-line');
    if (el) el.textContent = text || '';
  }

  global.SNGlobe = {
    init,
    pulse,
    locate,
    flyNear,
    goToTier,
    setHud,
    TIERS,
    get tier() {
      return G.tier;
    },
    get ready() {
      return G.ready;
    },
    get lastPos() {
      return global._snLastPos || null;
    },
  };
})(window);
