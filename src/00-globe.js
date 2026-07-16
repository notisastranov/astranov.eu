const container = document.getElementById('globe');

// Robust WebGL + error guard so user never sees silent black
window.addEventListener('error', function(e) {
  try {
    const msg = document.createElement('div');
    msg.style.cssText = 'position:fixed;bottom:8px;left:8px;padding:4px 8px;background:rgba(20,0,0,0.7);color:#f66;font:11px/1.3 monospace;z-index:99999;pointer-events:none;';
    msg.textContent = 'Init/Render error: ' + (e.message || 'unknown') + ' — try Chrome/Firefox, enable HW accel, check console';
    document.body.appendChild(msg);
  } catch(_) {}
});

let renderer;
try {
  renderer = new THREE.WebGLRenderer({antialias:true, alpha:true});
  renderer.setClearColor(0x000000, 1);
  renderer.setSize(window.innerWidth, window.innerHeight);
  const _dprCap = window.SlumberManager?.quality?.pixelRatio ?? (window._globePerfLite ? 1.0 : 1.25);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, _dprCap));
  if (THREE.ACESFilmicToneMapping) {
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
  }
  if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
  window.renderer = renderer;
  container.appendChild(renderer.domElement);
} catch (e) {
  const fb = document.createElement('div');
  fb.style.cssText = 'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#0af;font:15px system-ui;background:#000;z-index:10;text-align:center;';
  fb.innerHTML = 'WebGL unavailable.<br>Update browser or enable hardware acceleration.<br><small>Astranov globe needs WebGL</small>';
  container.appendChild(fb);
  throw e;
}

// Hoisted top-level mutable state (must be declared BEFORE any top-level calls like initVoice/initUser)
let drag = false, px = 0, py = 0;
let dragging = false;
let idleRoll = 0;
let globePivot;
let trackVelX = 0, trackVelY = 0;
let cityLevel = false;
let voiceEnabled = false;
let voiceSessionActive = false;
let isListening = false;
let recognition;
let userLocated = false;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.PerspectiveCamera(52, window.innerWidth/window.innerHeight, 0.1, 1000);
camera.position.set(0, 0.25, 2.55);
camera.lookAt(0, 0, 0);

// Astranov lighting — deep space rim + sun key (not flat Atari fill)
scene.add(new THREE.AmbientLight(0x1a2838, 0.55));
const sun = new THREE.DirectionalLight(0xfff4e0, 1.85);
sun.position.set(5.2, 2.4, 3.6);
scene.add(sun);
const rimLight = new THREE.DirectionalLight(0x4488ff, 0.55);
rimLight.position.set(-4, -1, -3);
scene.add(rimLight);
const fillLight = new THREE.PointLight(0x66aaff, 0.35, 12);
fillLight.position.set(-2, 1.5, 3);
scene.add(fillLight);

// Multi-layer starfield — fine dust + bright beacons (cinematic, not sparse dots)
(function buildAstranovStarfield() {
  function layer(count, rMin, rMax, size, color, opacity) {
    const pos = [];
    for (let i = 0; i < count; i++) {
      const r = rMin + Math.random() * (rMax - rMin);
      const t = Math.random() * Math.PI * 2;
      const p = Math.acos(2 * Math.random() - 1);
      pos.push(r * Math.sin(p) * Math.cos(t), r * Math.sin(p) * Math.sin(t), r * Math.cos(p));
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color, size, sizeAttenuation: true, transparent: true, opacity,
      depthWrite: false, blending: THREE.AdditiveBlending,
    });
    scene.add(new THREE.Points(geo, mat));
  }
  layer(2800, 80, 420, 0.35, 0xaaccff, 0.55);
  layer(900, 100, 700, 0.9, 0xffffff, 0.85);
  layer(120, 120, 900, 2.2, 0xcce8ff, 0.95);
})();

// Earth — higher tessellation + temporary ocean/land material until day/night shader binds
const earthMat = new THREE.MeshPhongMaterial({
  color: 0x1a4a7a,
  emissive: 0x041018,
  specular: 0x335566,
  shininess: 18,
  flatShading: false,
});
const earthTexUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r128/examples/textures/planets/earth_atmos_2048.jpg';
new THREE.TextureLoader().load(
  earthTexUrl,
  (tex) => {
    tex.anisotropy = Math.min(8, renderer.capabilities?.getMaxAnisotropy?.() || 4);
    earthMat.map = tex;
    earthMat.color.set(0xffffff);
    earthMat.needsUpdate = true;
  },
  undefined,
  () => { console.log('Earth texture fallback active'); }
);
globePivot = new THREE.Group();
scene.add(globePivot);

const earthSeg = (window.innerWidth < 700 || /Mobi|Android/i.test(navigator.userAgent || '')) ? 48 : 72;
const earth = new THREE.Mesh(new THREE.SphereGeometry(1, earthSeg, earthSeg), earthMat);
globePivot.add(earth);

// Soft atmosphere shell (fresnel-ish blue rim) — upgraded further by AIGraphics
(function bootAtmosphere() {
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(1.035, earthSeg, earthSeg),
    new THREE.MeshBasicMaterial({
      color: 0x3a9fff,
      transparent: true,
      opacity: 0.09,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
  );
  atmo.userData = { type: 'boot-atmosphere' };
  globePivot.add(atmo);
})();
globePivot.rotation.y = 0.82;
globePivot.rotation.x = 0.12;
globePivot.quaternion.setFromEuler(globePivot.rotation, 'YXZ');
window.earth = earth;

function syncGlobePivotRotation() {
  if (!globePivot) return;
  globePivot.quaternion.setFromEuler(globePivot.rotation, 'YXZ');
}
window.syncGlobePivotRotation = syncGlobePivotRotation;

// lat/lng to 3D sphere position
function latLngToPos(lat, lng, r = 1) {
  const phi = (90 - lat) * Math.PI / 180;
  const theta = (lng + 180) * Math.PI / 180;
  return {
    x: -(r * Math.sin(phi) * Math.cos(theta)),
    y: r * Math.cos(phi),
    z: r * Math.sin(phi) * Math.sin(theta)
  };
}

// Globe follow vs free explore — release when user drags the globe
const GlobeControl = {
  followMode: 'free',
  userExploring: false,
  _exploreUntil: 0,
  _lastAutoFly: 0,
  _snapConflicts: 0,

  isEarthView() {
    const z = camera?.position?.z ?? 2.5;
    const level = CosmicZoom?.level || 'earth';
    return (level === 'earth' || level === 'orbit') && z < 4.5;
  },

  shouldAutoFly() {
    if (drag || dragging) return false;
    if (this.userExploring && Date.now() < this._exploreUntil) return false;
    return this.followMode !== 'free';
  },

  engageFollow(mode) {
    this.followMode = mode || 'locate';
    this.userExploring = false;
    this._exploreUntil = 0;
    const btn = document.getElementById('aci-locate');
    if (btn) btn.classList.toggle('deck-btn-active', mode === 'locate');
  },

  userTookGlobe(reason) {
    if (this.userExploring && Date.now() - this._lastAutoFly < 2500) {
      this._snapConflicts++;
      window.AciCoders?.observeActivity?.('ui_struggle', 'globe snap-back · user freed globe', { conflicts: this._snapConflicts });
    }
    this.userExploring = true;
    this._exploreUntil = Date.now() + 180000;
    this.followMode = 'free';
    window._globeFly = null;
    const btn = document.getElementById('aci-locate');
    if (btn) btn.classList.remove('deck-btn-active');
    if (window.DrivingView) window.DrivingView._cameraFollow = false;
    GlobeDeck?.setPreview('🌍 Globe free — drag to explore');
    window.SuperCli?.setContext?.(SuperCli.inferContext?.() || 'idle');
    if (reason !== 'silent') {
      window.AciCoders?.observeActivity?.('ui', 'user explore globe · follow released', { reason: reason || 'drag' });
    }
  },

  noteAutoFly() {
    this._lastAutoFly = Date.now();
  },

  Z: { global: 2.55, national: 1.82, regional: 1.65, city: 1.38 },

  /** Z depth that activates the flat city map (explicit city entry only) */
  cityEntryZ() {
    const enter = CityMap?.ENTER_Z ?? 1.36;
    return Math.min(this.Z.city, enter - 0.02);
  },

  flyDuration(fromZ, toZ) {
    const a = fromZ ?? camera?.position?.z ?? 2.55;
    const b = toZ ?? 2.55;
    return Math.min(3200, Math.round(2000 + Math.abs(a - b) * 1100));
  },

  /** Default fly — global view; never drops to city unless opts.city === true */
  flyToLatLng(lat, lng, label, targetZ, opts) {
    const o = opts && typeof opts === 'object' ? opts : {};
    if (!TrackballGuard?.beforeFly?.(lat, lng, o)) return false;
    syncGlobePivotRotation?.();
    window._globeFly = null;
    let z = targetZ;
    if (z == null) z = o.city ? this.Z.city : this.Z.global;
    else if (!o.city && z < this.Z.regional) z = this.Z.national;
    const p = latLngToPos(lat, lng, 1.04);
    if (typeof flyToPoint !== 'function') return false;
    const dist = TrackballGuard?.greatCircleKm?.(
      TrackballGuard.facingLatLng().lat,
      TrackballGuard.facingLatLng().lng,
      lat, lng
    ) || 0;
    const dur = o.dur || Math.min(5200, Math.max(900, this.flyDuration(camera?.position?.z, z) + dist * 0.14));
    flyToPoint(new THREE.Vector3(p.x, p.y, p.z), z, { dur, onTier: !!o.onTier, force: !!o.force });
    AIGraphics?.flyAstranovTo?.(lat, lng, { dur, color: 0x3d9eff });
    if (z > this.Z.regional) cityLevel = false;
    this.noteAutoFly();
    MapDepict?.pulse?.(lat, lng, 0x00ddff, label || 'task', 8000);
    return true;
  },

  async enterCity(lat, lng, opts) {
    if (lat != null && lng != null) return CityLife?.dropIn?.(lat, lng, opts || {});
    if (window._lastPos?.lat != null && window._lastPos?.lng != null) {
      return CityLife?.dropIn?.(window._lastPos.lat, window._lastPos.lng, opts || {});
    }
    if (navigator.geolocation && CityLife?.locateAndDropIn) {
      try {
        return await CityLife.locateAndDropIn();
      } catch (e) {
        const msg = 'Location denied — enable GPS to open your city map';
        if (typeof _gpsDeniedUi === 'function') _gpsDeniedUi(msg);
        else {
          ACIControl?.reply?.(msg);
          AciCli?.print?.(msg, 'err');
        }
        return { error: 'gps_denied', message: String(e?.message || e) };
      }
    }
    const msg = 'No location yet — tap 🎯 Locate and allow GPS';
    if (typeof _gpsDeniedUi === 'function') _gpsDeniedUi(msg);
    else ACIControl?.reply?.(msg);
    return { error: 'no_location', message: msg };
  },
};
window.GlobeControl = GlobeControl;

async function enterCityView(lat, lng, opts) {
  return GlobeControl.enterCity(lat, lng, opts);
}
window.enterCityView = enterCityView;
