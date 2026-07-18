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
  if (!renderer || !scene || !camera) return;

  window._animFrame = (window._animFrame + 1) | 0;
  const frame = window._animFrame;
  const hidden = document.hidden;
  // Tab hidden: almost sleep
  if (hidden) {
    if (frame % 60 !== 0) return;
    try { renderer.render(scene, camera); } catch (_) {}
    return;
  }

  const lite = !!window._globePerfLite;
  const idleMs = Date.now() - (window._lastUserAct || 0);
  const dragging = !!(drag || window._globeFly || trackVelX || trackVelY);
  // Aggressive idle frame skip — keeps UI butter while idling
  if (!dragging) {
    let skipN = 0;
    if (lite) {
      if (idleMs > 12000) skipN = 5;
      else if (idleMs > 4000) skipN = 3;
      else if (idleMs > 1200) skipN = 2;
      else skipN = 1;
    } else if (idleMs > 15000) skipN = 3;
    else if (idleMs > 5000) skipN = 1;
    if (skipN && frame % (skipN + 1) !== 0) return;
  }

  // FPS probe only when needed
  if (frame % 8 === 0) SlumberManager?.tickFrame?.();

  const camZ = camera.position.z;
  const level = CosmicZoom?.level || 'earth';
  const earthView = (level === 'earth' || level === 'orbit') && camZ < 4.8;
  const solarView = level === 'system' || level === 'galaxy' || camZ > 5.5;

  // Voice perf mode — throttle checks
  if (frame % 6 === 0) {
    const voiceActive = window._handsFreeVoice || (typeof isListening !== 'undefined' && isListening);
    const codersBusy = window.AciCoders?._cliBusy || window.AciCoders?._listenBusy;
    if (voiceActive || codersBusy || GlobeDeck?.thinking) {
      if (typeof setVoicePerfMode === 'function') setVoicePerfMode(true);
    } else if (window._voicePerfMode && typeof setVoicePerfMode === 'function') {
      setVoicePerfMode(false);
    }
  }

  if (!drag && !window._globeFly) TrackballGuard?.applyInertia?.();
  tickGlobeFly?.();

  // Spin every rendered frame (already frame-skipped when idle)
  if (earthView && !CityMap?.active) EarthRealism?.applySpinNow?.();

  const entityDiv = Math.max(_slumberDiv('entity'), lite ? 12 : 6);
  if (frame % entityDiv === 0) {
    MapDepict?.tick?.();
    if (SlumberManager?.allows?.('entities') !== false) GlobeEntity?.tick?.();
  }

  const cosmicDiv = Math.max(_slumberDiv('cosmic'), lite ? 20 : 10);
  if (solarView && frame % Math.max(_slumberDiv('cosmic'), 4) === 0) CosmicZoom?.update?.(camZ);
  else if (frame % cosmicDiv === 0) CosmicZoom?.update?.(camZ);

  if (earthView && window._astranovFlyerActive && frame % Math.max(_slumberDiv('earth'), 10) === 0) {
    AIGraphics?.update?.();
  }
  if (earthView && frame % Math.max(_slumberDiv('earth'), lite ? 10 : 4) === 0) EarthRealism?.tick?.();
  if (!lite && earthView && frame % _slumberDiv('celestial') === 0 && idleMs < 8000
    && SlumberManager?.allows?.('celestial') !== false) {
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
  try {
    document.getElementById('globe')?.classList.remove('city-map-active', 'national-map-active');
    if (renderer?.domElement) {
      renderer.domElement.style.opacity = '1';
      renderer.domElement.style.pointerEvents = 'auto';
      renderer.domElement.style.display = 'block';
    }
    // One immediate frame so user never sees empty void while waiting for RAF
    if (renderer && scene && camera) renderer.render(scene, camera);
  } catch (_) {}
  animate();
  window._astranovCriticalReady = true;
  document.documentElement.dataset.astranovPhase = 'critical';
  console.log('%c[Astranov] critical boot · globe live', 'color:#3d9eff;font-weight:700');
};
