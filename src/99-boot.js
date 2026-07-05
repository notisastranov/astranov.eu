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

  if (!drag && earthView) {
    globePivot.rotation.y += idleRoll + trackVelX;
    globePivot.rotation.x += trackVelY;
    globePivot.rotation.x = Math.max(-1.25, Math.min(1.25, globePivot.rotation.x));
    trackVelX *= 0.94;
    trackVelY *= 0.94;
  } else if (!drag) {
    trackVelX *= 0.9;
    trackVelY *= 0.9;
  }

  const voiceActive = window._handsFreeVoice || isListening;
  const codersBusy = window.AciCoders?._cliBusy || window.AciCoders?._listenBusy;
  if (voiceActive || codersBusy || GlobeDeck?.thinking) setVoicePerfMode?.(true);
  else if (window._voicePerfMode) setVoicePerfMode?.(false);

  tickGlobeFly?.();
  if (frame % 3 === 0) updateOrbital?.();

  if (!hidden && frame % 3 === 0) {
    MapDepict?.tick?.();
    GlobeEntity?.tick?.();
  }

  if (solarView && frame % 3 === 0) CosmicZoom.update(camZ);
  else if (frame % 8 === 0) CosmicZoom.update(camZ);

  if (earthView && frame % 4 === 0) EarthRealism?.tick?.();

  renderer.render(scene, camera);
}
animate();

Auth.init();
GlobeDeck.init();
SuperCli.init();
SessionHold.init();
AciCli.init();
ACIControl.init();
ACI.init();
CosmicZoom.init();
ZoomTiers.init();
AstranovTheme.init();
AstranovLogo.init();
CityMap.init();
EarthRealism.init();
GlobeEntity.init();
Responsive3D.init();
OrderTracking.init();
AstranovSession.init();
AstranovPresence.init();
ProfileSite.init();

setTimeout(() => Auth.refreshAuthority(), 800);
setTimeout(() => {
  AciCli?.primeCodersCli?.();
  AciCoders?.ensureBridge?.();
}, 2000);
setTimeout(() => Commerce.loadVendors().then(() => Commerce.initUI()), 3000);

if (window._lastPos) GlobeEntity.syncMe(_lastPos.lat, _lastPos.lng, me?.name || 'You');

const host = location.hostname || '';
const isOfficial = host === 'astranov.eu' || host.endsWith('.astranov.eu');
const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
if (host && !isOfficial && !isLocal) {
  document.body.innerHTML = '<div style="color:#444;padding:40px;text-align:center;font-family:sans-serif">Available only on authorized Astranov domains</div>';
}