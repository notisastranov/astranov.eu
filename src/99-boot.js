window._cycleTurbo = false;
window._globePerfLite = true;
window._animFrame = 0;

function globePerfActive() {
  return !!(window._voicePerfMode || window._globePerfLite);
}

function animate() {
  requestAnimationFrame(animate);
  if (window._cycleTurbo) return;
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

  if (drag) {
    trackVelX = 0;
    trackVelY = 0;
  }

  const voiceActive = window._handsFreeVoice || isListening;
  const codersBusy = window.AciCoders?._cliBusy || window.AciCoders?._listenBusy;
  if (voiceActive || codersBusy || GlobeDeck?.thinking) setVoicePerfMode?.(true);
  else if (window._voicePerfMode) setVoicePerfMode?.(false);

  tickGlobeFly?.();
  if (frame % 3 === 0) updateOrbital?.();

  if (!hidden && frame % 6 === 0) {
    MapDepict?.tick?.();
    GlobeEntity?.tick?.();
  }

  if (solarView && frame % 3 === 0) CosmicZoom.update(camZ);
  else if (frame % 8 === 0) CosmicZoom.update(camZ);

  if (earthView && frame % 4 === 0) EarthRealism?.tick?.();
  if (earthView && frame % 3 === 0) CelestialNav?.tick?.();
  renderer.render(scene, camera);
}

window._bootEarthLock = true;
camera.position.z = 2.55;
camera.lookAt(0, 0, 0);
if (typeof globePivot !== 'undefined' && globePivot) {
  globePivot.rotation.x = 0.12;
  globePivot.rotation.y = 0.82;
}

Auth.init();
GlobeDeck.init();
GlobeDeck.bootCollapsed?.();
SuperCli.init();
SessionHold.init();
AciCli.init();
ACIControl.init();
ACI.init();
CosmicZoom.init();
CelestialNav.init();
ZoomTiers.init();
if (typeof globePivot !== 'undefined' && globePivot) {
  globePivot.rotation.x = 0.12;
}
CosmicZoom.level = 'earth';
if (CosmicZoom.solarGroup) CosmicZoom.solarGroup.visible = false;
CosmicZoom.update(2.55, { tier: 'global', label: 'GLOBAL', cosmic: 'earth' });
const zl0 = document.getElementById('zoom-label');
if (zl0) zl0.textContent = 'GLOBAL · tap 🎯 Locate for city map';
AstranovTheme.init();
AstranovLogo.init();
CityMap.init();
CityLife.init();
EarthRealism.init();
GlobeEntity.init();
Responsive3D.init();
OrderTracking.init();
AstranovSession.init();
AstranovPresence.init();
ProfileSite.init();
CodersHub.init();
AiRouter.init();
LabOrbs.init();

setTimeout(() => Auth.refreshAuthority(), 800);
AciCli?.primeCodersCli?.();
AciCoders?.ensureBridge?.();
setTimeout(() => Commerce.loadVendors().then(() => Commerce.initUI()), 800);

if (window._lastPos) GlobeEntity.syncMe(_lastPos.lat, _lastPos.lng, me?.name || 'You');

setTimeout(() => {
  window._bootEarthLock = false;
  if (camera.position.z > 4.8) {
    camera.position.z = 2.55;
    ZoomTiers?.goTo?.('global', false);
  }
  CosmicZoom.update(2.55, { tier: 'global', label: 'GLOBAL', cosmic: 'earth' });
  ACIControl?.reply?.('Earth ready · tap 🎧 talk straight to Grok');
  primeGrokVoice?.();
  setTimeout(() => AciCoders?.enterSession?.({ ping: false, focus: false }), 2500);
  const zl = document.getElementById('zoom-label');
  if (zl) zl.textContent = 'GLOBAL · tap 🎯 Locate for city map';
}, 1200);

const host = location.hostname || '';
const isOfficial = host === 'astranov.eu' || host.endsWith('.astranov.eu');
const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
if (host && !isOfficial && !isLocal) {
  document.body.innerHTML = '<div style="color:#444;padding:40px;text-align:center;font-family:sans-serif">Available only on authorized Astranov domains</div>';
} else {
  animate();
}