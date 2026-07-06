// === TRACKBALL GUARD — never lose globe drag/spin; regression shield ===
const TrackballGuard = {
  _ok: false,
  _lastCheck: 0,
  FRICTION: 0.91,
  MIN_VEL: 0.00008,

  verify() {
    const ok = !!(
      typeof globePivot !== 'undefined' && globePivot
      && typeof renderer !== 'undefined' && renderer?.domElement
      && typeof trackballStart === 'function'
      && typeof trackballMove === 'function'
      && typeof trackballEnd === 'function'
      && typeof tickGlobeFly === 'function'
      && renderer.domElement.__trackballBound
    );
    this._ok = ok;
    this._lastCheck = Date.now();
    if (!ok) console.warn('[TrackballGuard] bindings missing — attempting repair');
    return ok;
  },

  repair() {
    const canvas = renderer?.domElement;
    if (!canvas || canvas.__trackballBound) return this.verify();
    try {
      canvas.addEventListener('mousedown', e => { if (e.button === 0) trackballStart(e.clientX, e.clientY); });
      canvas.addEventListener('mousemove', e => {
        if (!drag) return;
        if (Math.hypot(e.clientX - pressStartX, e.clientY - pressStartY) > 12) clearTimeout(pressTimer);
        trackballMove(e.clientX, e.clientY);
      });
      canvas.addEventListener('wheel', onWheelZoom, { passive: false });
      canvas.__trackballBound = true;
    } catch (e) {
      console.error('[TrackballGuard] repair failed', e);
    }
    return this.verify();
  },

  applyInertia() {
    if (drag || dragging || window._globeFly) return;
    if (typeof trackVelX !== 'number' || typeof trackVelY !== 'number') return;
    if (Math.abs(trackVelX) < this.MIN_VEL && Math.abs(trackVelY) < this.MIN_VEL) return;
    if (!globePivot) return;
    globePivot.rotation.y += trackVelX;
    globePivot.rotation.x += trackVelY;
    globePivot.rotation.x = Math.max(-1.25, Math.min(1.25, globePivot.rotation.x));
    trackVelX *= this.FRICTION;
    trackVelY *= this.FRICTION;
    if (Math.abs(trackVelX) < this.MIN_VEL) trackVelX = 0;
    if (Math.abs(trackVelY) < this.MIN_VEL) trackVelY = 0;
  },

  beforeFly(lat, lng, opts) {
    if (opts?.force) return true;
    if (drag || dragging) {
      GlobeControl?.userTookGlobe?.('silent');
      return true;
    }
    if (typeof lat !== 'number' || typeof lng !== 'number') return false;
    const cur = this.facingLatLng();
    const dist = this.greatCircleKm(cur.lat, cur.lng, lat, lng);
    if (dist > 12000 && !opts?.allowLongHaul) {
      CliRibbon?.setNotice?.('Fly blocked — too far · drag globe or say locate', 'hold');
      return false;
    }
    return true;
  },

  facingLatLng() {
    if (!globePivot) return { lat: 0, lng: 0 };
    const e = new THREE.Euler().setFromQuaternion(globePivot.quaternion, 'YXZ');
    const lat = THREE.MathUtils.radToDeg(e.x) * -2.2;
    const lng = THREE.MathUtils.radToDeg(-e.y) - 180;
    return { lat: Math.max(-85, Math.min(85, lat)), lng: ((lng + 540) % 360) - 180 };
  },

  greatCircleKm(lat1, lng1, lat2, lng2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
      + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  },

  init() {
    if (renderer?.domElement) renderer.domElement.__trackballBound = true;
    if (!this.verify()) this.repair();
    setInterval(() => {
      if (!this.verify()) this.repair();
    }, 8000);
    window.__trackballGuardOk = () => this._ok;
  },
};
window.TrackballGuard = TrackballGuard;
TrackballGuard.init();