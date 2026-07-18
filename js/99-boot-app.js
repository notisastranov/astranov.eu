// === BOOT APP — CLI, auth, city, money field (after globe is already spinning) ===
window.__astranovBootApp = function __astranovBootApp() {
  const soft = (name, fn) => {
    try { fn?.(); } catch (e) { console.warn('[boot-app] ' + name, e); }
  };

  soft('Auth', () => Auth?.init?.());
  soft('GlobeDeck', () => {
    GlobeDeck?.init?.();
    // Start collapsed so Earth is the stage — CLI is the ribbon, not the whole app
    if (typeof GlobeDeck.bootCollapsed === 'function') GlobeDeck.bootCollapsed();
    else GlobeDeck.bootReady?.();
    GlobeDeck?.setTitle?.(PublicCopy?.deckTitle?.() || 'Astranov');
    GlobeDeck?.setPreview?.(PublicCopy?.readyNotice?.() || 'Earth · drag · 🎯 city · 🎧 chat');
  });
  soft('SuperCli', () => SuperCli?.init?.());
  soft('SessionHold', () => SessionHold?.init?.());
  soft('AciCli', () => AciCli?.init?.());
  soft('ACIControl', () => ACIControl?.init?.());
  soft('ACI', () => ACI?.init?.());
  soft('Logo', () => AstranovLogo?.init?.());
  // City map only needs Leaflet present; safe if L still racing
  soft('CityMap', () => CityMap?.init?.());
  soft('CityLife', () => CityLife?.init?.());
  soft('CityPick', () => CityPick?.init?.());
  soft('ClassifiedTriangles', () => ClassifiedTriangles?.init?.());
  // Money+resource fused chip — after a paint
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => soft('ResourceMonitor', () => ResourceMonitor?.init?.()), { timeout: 800 });
  } else {
    setTimeout(() => soft('ResourceMonitor', () => ResourceMonitor?.init?.()), 200);
  }
  soft('CoreBrain', () => AstranovCoreBrain?.init?.());

  // Deferred pack only after app is usable
  LazyModules?.schedule?.();

  document.documentElement.dataset.astranovPhase = 'app';
  window._astranovAppReady = true;
  console.log('%c[Astranov] app boot · CLI + city ready', 'color:#00dd77;font-weight:700');
};
