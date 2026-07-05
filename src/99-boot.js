window._cycleTurbo = false;
window._globePerfLite = false;
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
  if (hidden && frame % 24 !== 0) {
    renderer.render(scene, camera);
    return;
  }

  const camZ = camera?.position?.z ?? 7.2;
  const level = CosmicZoom?.level || 'system';
  const entityCount = GlobeEntity?.entities?.size || 0;
  const earthView = (level === 'earth' || level === 'orbit') && camZ < 4.8;
  const solarView = level === 'system' || level === 'galaxy' || camZ > 5.5;
  const mobile = window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 4;
  window._globePerfLite = solarView || entityCount > 22 || mobile;

  if (!drag && earthView && !globePerfActive()) {
    globePivot.rotation.y += idleRoll + trackVelX;
    globePivot.rotation.x += trackVelY;
    globePivot.rotation.x = Math.max(-1.25, Math.min(1.25, globePivot.rotation.x));
    trackVelX *= 0.94;
    trackVelY *= 0.94;
  } else if (!drag) {
    trackVelX *= 0.9;
    trackVelY *= 0.9;
  }
  // pilot pulse to make it alive
  if (window._pilot) {
    const t = Date.now() / 600;
    const s = 1 + Math.sin(t) * 0.12;
    window._pilot.scale.set(s, s, s);

    // Advanced thruster animation (gaming engine glow)
    if (window._pilot.userData.thrusters) {
      const thrustScale = 0.7 + Math.sin(t * 2) * 0.4;
      window._pilot.userData.thrusters.forEach(t => {
        t.scale.set(1, thrustScale, 1);
        t.material.opacity = 0.5 + Math.sin(t * 3) * 0.3;
      });
    }

    if (!globePerfActive() && Date.now() % 380 < 30 && window._pilot) {
      AIGraphics.spawnEffect(window._pilot.position, 0xff5500, 5, 18);
    }
  }

  const perf = globePerfActive();
  const codersBusy = window.AciCoders?._cliBusy || window.AciCoders?._listenBusy;
  const voiceActive = window._handsFreeVoice || isListening;
  const thinkBusy = GlobeDeck?.thinking;
  if (voiceActive || codersBusy || entityCount > 40 || thinkBusy) setVoicePerfMode?.(true);
  else if (window._voicePerfMode) setVoicePerfMode?.(false);

  tickGlobeFly?.();
  if (!perf || frame % 2 === 0) AIGraphics.update();
  if (!perf || frame % 3 === 0) updateOrbital();

  if (window.AstranovCollectiveIntelligence && !hidden && earthView && (!perf || frame % 2 === 0)) {
    ACI.tick();
    if (!perf && entityCount < 48) {
      ACI.neurons.forEach(n => {
        if (!n.userData) return;
        const t = Date.now() / 700;
        const s = 1 + Math.sin(t + (n.userData.id ? n.userData.id.length : 0)) * 0.07 * Math.min(1.8, n.userData.strength || 1);
        n.scale.set(s, s, s);
      });
    }
  }

  if (!hidden) {
    if (!perf || frame % 2 === 0) MapDepict?.tick?.();
    if (!perf || frame % 2 === 0) GlobeEntity?.tick?.();
    if (!perf || frame % 3 === 0) MapComms?.tick?.();
    SuperSpace?.tick?.();
  }

  if (solarView || camZ > 4.8) {
    if (!perf || frame % 2 === 0) CosmicZoom.update(camZ);
  } else if (frame % 4 === 0) CosmicZoom.update(camZ);

  if (earthView && (!perf || frame % 2 === 0)) EarthRealism?.tick?.();

  renderer.render(scene, camera);
}
animate();
ACI.init();
setTimeout(() => { if (!window._voicePerfMode) BrainConversation?.seedAdultNeurons?.(); }, 8000);
GlobeAutonomy.init();
AstranovNode.init();
Auth.init();
FieldBrain.init();
FieldBrain.hookFeed();
GlobeDeck.init();
SuperCli.init();
SessionHold.init();
CliHub.init();
ContextTruth.init();
GhostTravel.init();
AciCli.init();
setTimeout(() => Auth.refreshAuthority(), 800);
setTimeout(() => {
  AciCli?.primeCodersCli?.();
  AciCoders?.ensureBridge?.();
}, 1800);
// Coders auto-start only when user opens CLI — avoids boot lag
ACIControl.init();
PmrRadio.bindUI();
GlobeVideo.init();
DrivingView.init();
CosmicZoom.init();
ZoomTiers.init();
CosmicZoom?.update?.(camera.position.z, { tier: 'solar', label: 'SOLAR SYSTEM', cosmic: 'system' });
AstranovTheme.init();
AstranovLogo.init();
CityMap.init();
EarthRealism.init();
AstranovSession.init();
AstranovWishlist.init();
AstranovPresence.init();
WillaGames.init();
MapComms.init();
ProfileSite.init();
Responsive3D.init();
OrderTracking.init();
setTimeout(() => HellenicSource?.seedToBrain?.(), 2400);
SuperSpace.init();
CityLife.init();
SuperAdd.init();
AstranovSiteShell.init();
GlobeEntity.init();

if (window._lastPos) GlobeEntity.syncMe(_lastPos.lat, _lastPos.lng, me?.name || 'You');
if (typeof orbitalSats !== 'undefined') CosmicZoom.registerOrbitalSats(orbitalSats);
setTimeout(() => {
  Commerce.loadVendors().then(() => Commerce.initUI());
  YachtMatcher?.loadAndSyncGlobe?.();
  AuditorPortal?.syncGlobe?.();
  AvcJustice?.loadConstitution?.();
  AvcJustice?.syncGlobe?.();
  CoinPortal?.syncGlobe?.();
  AstranovUnified?.syncGlobe?.();
}, 2200);
setInterval(() => YachtMatcher?.loadAndSyncGlobe?.(), 300000);
setTimeout(() => NewsFeed.fetch(), 4000);
setInterval(() => NewsFeed.tick(), 12000);



// Domain guard
const host = location.hostname || '';
const isOfficial = host === 'astranov.eu' || host.endsWith('.astranov.eu');
const isLocal = host === '' || host === 'localhost' || host === '127.0.0.1' || location.protocol === 'file:';
if (host && !isOfficial && !isLocal) {
  document.body.innerHTML = '<div style="color:#444;padding:40px;text-align:center;font-family:sans-serif">Available only on authorized Astranov domains</div>';
}

// No panel restore needed - pure globe mode
// me already set as Αξάς above