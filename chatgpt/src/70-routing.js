// STRONG ROUTING FALLBACK PROVIDER CYCLING ENGINE
// For safe deliveries to users & drivers (pilot/drones)
// Cycles providers + fallbacks on risk
// =====================================================
const RoutingEngine = {
  providers: ['direct', 'safeViaNorth', 'coastalDetour', 'wideSafeArc'],
  index: 0,

  getCurrentProvider() {
    return this.providers[this.index];
  },

  cycleProvider() {
    this.index = (this.index + 1) % this.providers.length;
    const p = this.getCurrentProvider();
    console.log('%c[RoutingEngine Ασφάλεια] Cycling provider → ' + p + ' (για users & drivers)', 'color:#ffaa00');
    return p;
  },

  computeRoute(startLat, startLng, endLat, endLng, userPositions = [], maxRisk = 2) {
    let provider = this.getCurrentProvider();
    console.log('%c[RoutingEngine] Υπολογισμός ασφαλούς διαδρομής με ' + provider, 'color:#00ddff');

    const start = latLngToPos(startLat, startLng);
    const end = latLngToPos(endLat, endLng);
    const points = [];
    const steps = 28;
    let riskLevel = 0;

    for (let i = 0; i <= steps; i++) {
      let t = i / steps;
      let p;

      if (provider === 'direct') {
        p = this._greatCircle(start, end, t);
      } else if (provider === 'safeViaNorth') {
        const via = latLngToPos(42, 26);
        if (t < 0.5) p = this._greatCircle(start, via, t * 2);
        else p = this._greatCircle(via, end, (t - 0.5) * 2);
      } else if (provider === 'coastalDetour') {
        const bias = Math.sin(t * Math.PI) * 3.5;
        p = latLngToPos(
          startLat + (endLat - startLat) * t + bias,
          startLng + (endLng - startLng) * t
        );
      } else { // wideSafeArc
        const arc = 4.5 * Math.sin(t * Math.PI * 1.2);
        p = latLngToPos(
          startLat + (endLat - startLat) * t + arc,
          startLng + (endLng - startLng) * t - arc * 0.6
        );
      }

      points.push(p);

      // Safety check vs users/drivers positions
      userPositions.forEach(up => {
        if (p.distanceTo(up) < 0.12) riskLevel += 0.6;
      });
    }

    if (riskLevel > maxRisk) {
      console.log('%c[RoutingEngine] ⚠️ Κίνδυνος για users/drivers! Fallback cycling...', 'color:#ff4444');
      this.cycleProvider();
      return this.computeRoute(startLat, startLng, endLat, endLng, userPositions, maxRisk);
    }

    return {
      points: points,
      provider: provider,
      etaSim: Math.round(steps * 2.5) + 'ms',
      safetyScore: (10 - riskLevel).toFixed(1)
    };
  },

  _greatCircle(a, b, t) {
    const dot = a.dot(b);
    const omega = Math.acos(Math.min(Math.max(dot, -1), 1));
    if (omega < 0.0001) return a.clone();
    const sinO = Math.sin(omega);
    const aa = Math.sin((1 - t) * omega) / sinO;
    const bb = Math.sin(t * omega) / sinO;
    return a.clone().multiplyScalar(aa).add(b.clone().multiplyScalar(bb));
  }
};

// Orbital Satellites for global connectivity visualization (illustrative, using real sphere math)
let orbitalSats = [];
function addOrbitalSats() {
  for (let i = 0; i < 6; i++) {
    const sat = new THREE.Mesh(
      new THREE.SphereGeometry(0.008, 4, 4),
      new THREE.MeshBasicMaterial({ color: 0xaaaaff })
    );
    const angle = (i / 6) * Math.PI * 2;
    sat.position.set(
      Math.cos(angle) * 1.6,
      Math.sin(i * 0.8) * 0.4,
      Math.sin(angle) * 1.6
    );
    orbitalSats.push(sat);
    scene.add(sat);
  }
}
function updateOrbitalSats() {
  orbitalSats.forEach((sat, i) => {
    const t = Date.now() * 0.0002 + i;
    sat.position.x = Math.cos(t + i) * 1.6;
    sat.position.z = Math.sin(t + i) * 1.6;
    sat.position.y = Math.sin(t * 1.5 + i) * 0.3;
  });
}
addOrbitalSats();
