// === BOOT CRITICAL — globe interactive ASAP (no CLI / auth / heavy UI yet) ===
window._cycleTurbo = false;
if (window._globePerfLite == null) window._globePerfLite = false;
window._animFrame = 0;
window._lastUserAct = Date.now();
const _slumberDiv = (k) => SlumberManager?.frameDivisor?.(k) || (window._globePerfLite ? 10 : 6);

function globePerfActive() {
  return !!(window._voicePerfMode || window._globePerfLite);
}

['pointerdown', 'touchstart', 'wheel', 'keydown'].forEach(ev => {
  window.addEventListener(ev, () => { window._lastUserAct = Date.now(); }, { passive: true });
});

function animate() {
  requestAnimationFrame(animate);
  if (window._cycleTurbo) return;
  SlumberManager?.tickFrame?.();
  window._animFrame = (window._animFrame + 1) | 0;
  const frame = window._animFrame;
  const hidden = document.hidden;
  const lite = !!window._globePerfLite;
  const idleMs = Date.now() - (window._lastUserAct || 0);
  const dragging = !!(drag || window._globeFly || trackVelX || trackVelY);
  if (!dragging && !hidden) {
    const skipN = lite ? (idleMs > 8000 ? 4 : idleMs > 2500 ? 2 : 1) : (idleMs > 10000 ? 2 : 0);
    if (skipN && frame % (skipN + 1) !== 0) return;
  }
  if (hidden && frame % 45 !== 0) return;

  const camZ = camera?.position?.z ?? 2.55;
  const level = CosmicZoom?.level || 'earth';
  const earthView = (level === 'earth' || level === 'orbit') && camZ < 4.8;
  const solarView = level === 'system' || level === 'galaxy' || camZ > 5.5;

  const voiceActive = window._handsFreeVoice || (typeof isListening !== 'undefined' && isListening);
  const codersBusy = window.AciCoders?._cliBusy || window.AciCoders?._listenBusy;
  if (voiceActive || codersBusy || GlobeDeck?.thinking) {
    if (typeof setVoicePerfMode === 'function') setVoicePerfMode(true);
  } else if (window._voicePerfMode && typeof setVoicePerfMode === 'function') {
    setVoicePerfMode(false);
  }

  if (!drag && !window._globeFly) TrackballGuard?.applyInertia?.();
  tickGlobeFly?.();

  if (earthView && !CityMap?.active) EarthRealism?.applySpinNow?.();

  if (!hidden && frame % _slumberDiv('entity') === 0) {
    MapDepict?.tick?.();
    if (SlumberManager?.allows?.('entities') !== false) GlobeEntity?.tick?.();
  }

  const cosmicDiv = Math.max(_slumberDiv('cosmic'), lite ? 16 : 8);
  if (solarView && frame % _slumberDiv('cosmic') === 0) CosmicZoom.update(camZ);
  else if (frame % cosmicDiv === 0) CosmicZoom.update(camZ);

  if (earthView && window._astranovFlyerActive && frame % Math.max(_slumberDiv('earth'), 8) === 0) {
    AIGraphics?.update?.();
  }
  if (earthView && frame % _slumberDiv('earth') === 0) EarthRealism?.tick?.();
  if (!lite && earthView && frame % _slumberDiv('celestial') === 0 && SlumberManager?.allows?.('celestial')) {
    window.CelestialNav?.tick?.();
  }
  renderer.render(scene, camera);
}

window.__astranovBootCritical = function __astranovBootCritical() {
  window._bootEarthLock = true;
  if (typeof camera !== 'undefined' && camera) {
    camera.position.z = 2.55;
    camera.lookAt(0, 0, 0);
  }
  if (typeof globePivot !== 'undefined' && globePivot) {
    globePivot.rotation.x = 0.12;
    globePivot.rotation.y = 0.82;
    syncGlobePivotRotation?.();
  }
  try {
    CosmicZoom?.init?.();
    ZoomTiers?.init?.();
    AstranovTheme?.init?.();
    EarthRealism?.init?.();
    CosmicZoom.level = 'earth';
    if (CosmicZoom.solarGroup) CosmicZoom.solarGroup.visible = false;
    CosmicZoom.update(2.55, { tier: 'global', label: 'Earth', cosmic: 'earth' });
  } catch (e) {
    console.warn('[boot-critical]', e);
  }
  const zl0 = document.getElementById('zoom-label');
  if (zl0) zl0.textContent = PublicCopy?.zoomLine?.('global') || 'Earth · drag · 🎯 city · 🎧 chat · + post';

  const host = location.hostname || '';
  const isOfficial = host === 'astranov.eu' || host.endsWith('.astranov.eu');
  const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
  if (host && !isOfficial && !isLocal) {
    document.body.innerHTML = '<div style="color:#444;padding:40px;text-align:center;font-family:sans-serif">Available only on authorized Astranov domains</div>';
    return;
  }
  // First paint: spinning, draggable Earth — UI boots next phase
  animate();
  window._astranovCriticalReady = true;
  document.documentElement.dataset.astranovPhase = 'critical';
  console.log('%c[Astranov] critical boot · globe live', 'color:#3d9eff;font-weight:700');
};
