/* SpaceNet Globe Lite — Earth only, hard perf budget */
(function (global) {
  'use strict';
  const G = {
    ready: false,
    renderer: null,
    scene: null,
    camera: null,
    earth: null,
    pivot: null,
    markers: [],
    dragging: false,
    lastAct: 0,
    frame: 0,
    targetFps: 24,
    _raf: 0,
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

  function init() {
    if (G.ready || typeof THREE === 'undefined') return false;
    const el = document.getElementById('globe');
    if (!el) return false;

    const touch = isTouch();
    const w = el.clientWidth || window.innerWidth;
    const h = el.clientHeight || window.innerHeight;

    G.scene = new THREE.Scene();
    G.scene.background = new THREE.Color(0x000000);
    G.camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    G.camera.position.set(0, 0.15, touch ? 3.2 : 2.7);

    G.renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
    });
    G.renderer.setSize(w, h, false);
    G.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, touch ? 0.85 : 1.0));
    el.innerHTML = '';
    el.appendChild(G.renderer.domElement);

    const amb = new THREE.AmbientLight(0x334455, 0.85);
    const sun = new THREE.DirectionalLight(0xffffff, 1.05);
    sun.position.set(5, 2, 3);
    G.scene.add(amb, sun);

    G.pivot = new THREE.Object3D();
    G.scene.add(G.pivot);

    // Low-poly Earth — solid color + simple grid lines feel (no 2k texture)
    const segs = touch ? 24 : 32;
    const geo = new THREE.SphereGeometry(1, segs, segs);
    const mat = new THREE.MeshPhongMaterial({
      color: 0x0a1a2e,
      emissive: 0x020810,
      specular: 0x222222,
      shininess: 8,
      flatShading: true,
    });
    G.earth = new THREE.Mesh(geo, mat);
    G.pivot.add(G.earth);

    // Thin atmosphere shell
    const atmo = new THREE.Mesh(
      new THREE.SphereGeometry(1.04, segs, segs),
      new THREE.MeshBasicMaterial({
        color: 0x3d7ab5,
        transparent: true,
        opacity: 0.08,
        side: THREE.BackSide,
      })
    );
    G.pivot.add(atmo);

    // Sparse stars (points, not sprites)
    const starN = touch ? 120 : 220;
    const starPos = new Float32Array(starN * 3);
    for (let i = 0; i < starN; i++) {
      const r = 18 + Math.random() * 30;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      starPos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      starPos[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th);
      starPos[i * 3 + 2] = r * Math.cos(ph);
    }
    const stars = new THREE.Points(
      new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPos, 3)),
      new THREE.PointsMaterial({ color: 0xffffff, size: 0.04, sizeAttenuation: true, opacity: 0.7, transparent: true })
    );
    G.scene.add(stars);

    bindInput(el);
    window.addEventListener('resize', onResize, { passive: true });
    G.ready = true;
    G.lastAct = Date.now();
    loop();
    return true;
  }

  function bindInput(el) {
    const canvas = G.renderer.domElement;
    let lx = 0, ly = 0, down = false;
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
      G.pivot.rotation.x = Math.max(-1.2, Math.min(1.2, G.pivot.rotation.x + dy * 0.004));
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
    canvas.addEventListener('touchstart', onDown, { passive: true });
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    canvas.addEventListener(
      'wheel',
      (e) => {
        G.lastAct = Date.now();
        G.camera.position.z = Math.max(1.45, Math.min(6, G.camera.position.z + e.deltaY * 0.002));
        e.preventDefault();
      },
      { passive: false }
    );
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
    G._raf = requestAnimationFrame(loop);
    if (!G.ready || document.hidden) return;
    G.frame++;
    const idle = Date.now() - G.lastAct > 2500;
    // Idle: ~12fps · active: ~24fps · dragging: full
    if (!G.dragging) {
      const skip = idle ? 5 : 2;
      if (G.frame % skip !== 0) return;
    }
    // Gentle spin when idle
    if (!G.dragging && idle) G.pivot.rotation.y += 0.0012;
    try {
      G.renderer.render(G.scene, G.camera);
    } catch (_) {}
  }

  function pulse(lat, lng, color, label, ms) {
    if (!G.ready) return null;
    const c = color != null ? color : 0x44ffaa;
    const pos = latLngToVec(lat, lng, 1.03);
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.028, 8, 8),
      new THREE.MeshBasicMaterial({ color: c })
    );
    mesh.position.copy(pos);
    G.pivot.add(mesh);
    const entry = { mesh, born: Date.now(), ms: ms || 12000, label: label || '' };
    G.markers.push(entry);
    // Cleanup old
    const now = Date.now();
    G.markers = G.markers.filter((m) => {
      if (now - m.born > m.ms) {
        try {
          G.pivot.remove(m.mesh);
          m.mesh.geometry?.dispose?.();
          m.mesh.material?.dispose?.();
        } catch (_) {}
        return false;
      }
      return true;
    });
    G.lastAct = Date.now();
    // Soft fly toward point
    flyNear(lat, lng);
    return entry;
  }

  function flyNear(lat, lng) {
    if (!G.ready) return;
    // Orient pivot so point faces camera (approx)
    const targetY = (-lng * Math.PI) / 180;
    const targetX = (lat * Math.PI) / 180 * 0.6;
    const startY = G.pivot.rotation.y;
    const startX = G.pivot.rotation.x;
    const t0 = performance.now();
    const dur = 700;
    function step(t) {
      const k = Math.min(1, (t - t0) / dur);
      const e = k * (2 - k);
      G.pivot.rotation.y = startY + (targetY - startY) * e;
      G.pivot.rotation.x = startX + (targetX - startX) * e;
      G.lastAct = Date.now();
      if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
    if (G.camera.position.z > 2.4) G.camera.position.z = 2.2;
  }

  function locate() {
    return new Promise((resolve) => {
      if (!navigator.geolocation) {
        // Rhodes demo
        const lat = 36.4341, lng = 28.2176;
        pulse(lat, lng, 0x3d9eff, 'You', 15000);
        resolve({ lat, lng, demo: true });
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          pulse(lat, lng, 0x3d9eff, 'You', 20000);
          resolve({ lat, lng });
        },
        () => {
          const lat = 36.4341, lng = 28.2176;
          pulse(lat, lng, 0x3d9eff, 'You (demo)', 15000);
          resolve({ lat, lng, demo: true });
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 60000 }
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
    setHud,
    get ready() {
      return G.ready;
    },
    get lastPos() {
      return global._snLastPos || null;
    },
  };
})(window);
