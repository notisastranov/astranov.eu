window._cycleTurbo = false;
window._globePerfLite = false;
window._animFrame = 0;
const _slumberDiv = (k) => SlumberManager?.frameDivisor?.(k) || 6;

function globePerfActive() {
  return !!(window._voicePerfMode || window._globePerfLite);
}

function animate() {
  requestAnimationFrame(animate);
  if (window._cycleTurbo) return;
  SlumberManager?.tickFrame?.();
  window._animFrame = (window._animFrame + 1) | 0;
  const frame = window._animFrame;
  const hidden = document.hidden;
  if (hidden && frame % 30 !== 0) {
    renderer.render(scene, camera);
    return;
  }

  const camZ = camera?.position?.z ?? 2.55;
  const level = CosmicZoom?.level || 'earth';
  const earthView = (level === 'earth' || level === 'orbit') && camZ < 4.8;
  const solarView = level === 'system' || level === 'galaxy' || camZ > 5.5;

  const voiceActive = window._handsFreeVoice || isListening;
  const codersBusy = window.AciCoders?._cliBusy || window.AciCoders?._listenBusy;
  if (voiceActive || codersBusy || GlobeDeck?.thinking) setVoicePerfMode?.(true);
  else if (window._voicePerfMode) setVoicePerfMode?.(false);

  if (!drag && !window._globeFly) TrackballGuard?.applyInertia?.();
  tickGlobeFly?.();
  if (frame % _slumberDiv('orbital') === 0) window.updateOrbital?.();

  if (!hidden && frame % _slumberDiv('entity') === 0) {
    MapDepict?.tick?.();
    if (SlumberManager?.allows?.('entities')) GlobeEntity?.tick?.();
  }

  if (solarView && frame % _slumberDiv('cosmic') === 0) CosmicZoom.update(camZ);
  else if (frame % Math.max(_slumberDiv('cosmic'), 8) === 0) CosmicZoom.update(camZ);

  if (earthView && frame % Math.max(_slumberDiv('earth'), 2) === 0) AIGraphics?.update?.();
  if (earthView && frame % _slumberDiv('earth') === 0) EarthRealism?.tick?.();
  if (earthView && frame % _slumberDiv('celestial') === 0 && SlumberManager?.allows?.('celestial')) {
    window.CelestialNav?.tick?.();
  }
  renderer.render(scene, camera);
}

window._bootEarthLock = true;
camera.position.z = 2.55;
camera.lookAt(0, 0, 0);
if (typeof globePivot !== 'undefined' && globePivot) {
  globePivot.rotation.x = 0.12;
  globePivot.rotation.y = 0.82;
  syncGlobePivotRotation?.();
}

Auth.init();
GlobeDeck.init();
GlobeDeck.bootReady?.() || GlobeDeck.bootCollapsed?.();
SuperCli.init();
SessionHold.init();
AciCli.init();
ACIControl.init();
ACI.init();
CosmicZoom.init();
ZoomTiers.init();
if (typeof globePivot !== 'undefined' && globePivot) {
  globePivot.rotation.x = 0.12;
}
CosmicZoom.level = 'earth';
if (CosmicZoom.solarGroup) CosmicZoom.solarGroup.visible = false;
CosmicZoom.update(2.55, { tier: 'global', label: 'GLOBAL', cosmic: 'earth' });
const zl0 = document.getElementById('zoom-label');
if (zl0) zl0.textContent = 'GLOBAL · drag Earth · 🎯 your city · 🎧 Grok · + post';

function showFirstRunCoach() {
  try { if (localStorage.getItem('astranov:coach-v1')) return; } catch (_) { return; }
  const el = document.getElementById('first-run-coach');
  const ok = document.getElementById('first-run-coach-ok');
  if (!el || !ok) return;
  el.hidden = false;
  ok.onclick = () => {
    el.hidden = true;
    try { localStorage.setItem('astranov:coach-v1', '1'); } catch (_) {}
  };
}
window.showFirstRunCoach = showFirstRunCoach;
AstranovTheme.init();
AstranovLogo.init();
CityMap.init();
CityLife.init();
EarthRealism.init();
GlobeEntity.init();
ClassifiedTriangles.init();
AiRouter.init();

LazyModules.schedule();

ArchitectBridge?.init?.();
setTimeout(() => Auth.refreshAuthority(), 800);
AciCli?.primeCodersCli?.();
AciCoders?.ensureBridge?.();

if (window._lastPos) GlobeEntity.syncMe(_lastPos.lat, _lastPos.lng, me?.name || 'You');

setTimeout(() => {
  window._bootEarthLock = false;
  if (camera.position.z > 4.8) {
    camera.position.z = 2.55;
    ZoomTiers?.goTo?.('global', false);
  }
  CosmicZoom.update(2.55, { tier: 'global', label: 'GLOBAL', cosmic: 'earth' });
  ACIControl?.reply?.('Earth ready · 🎧 Grok · 🎯 Locate · + post');
  CliRibbon?.setNotice?.('Earth ready · 🎧 Grok · 🎯 Locate', 'ready');
  GlobeDeck?.setPreview?.('Type below or 🎧 · 🎯 for your city · + to post');
  primeGrokVoice?.();
  showFirstRunCoach();
  setTimeout(() => AciCoders?.enterSession?.({ expand: false, ping: false, focus: false }), 2800);
  const zl = document.getElementById('zoom-label');
  if (zl) zl.textContent = 'GLOBAL · drag Earth · 🎯 your city · 🎧 Grok · + post';
}, 1200);

const host = location.hostname || '';
const isOfficial = host === 'astranov.eu' || host.endsWith('.astranov.eu');
const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
if (host && !isOfficial && !isLocal) {
  document.body.innerHTML = '<div style="color:#444;padding:40px;text-align:center;font-family:sans-serif">Available only on authorized Astranov domains</div>';
} else {
  animate();
}