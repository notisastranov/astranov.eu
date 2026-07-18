// === BOOT APP — CLI, auth, city, money field (after globe is already spinning) ===
window.__astranovBootApp = function __astranovBootApp() {
  const soft = (name, fn) => {
    try { fn?.(); } catch (e) { console.warn('[boot-app] ' + name, e); }
  };

  soft('Auth', () => Auth?.init?.());
  soft('GlobeDeck', () => {
    GlobeDeck?.init?.();
    GlobeDeck?.bootReady?.() || GlobeDeck?.bootCollapsed?.();
    GlobeDeck?.setTitle?.(PublicCopy?.deckTitle?.() || 'Astranov');
  });
  soft('SuperCli', () => SuperCli?.init?.());
  soft('SessionHold', () => SessionHold?.init?.());
  soft('AciCli', () => AciCli?.init?.());
  soft('ACIControl', () => ACIControl?.init?.());
  soft('ACI', () => ACI?.init?.());
  soft('Logo', () => AstranovLogo?.init?.());
  soft('CityMap', () => CityMap?.init?.());
  soft('CityLife', () => CityLife?.init?.());
  soft('CityPick', () => CityPick?.init?.());
  soft('ClassifiedTriangles', () => ClassifiedTriangles?.init?.());
  soft('ResourceMonitor', () => ResourceMonitor?.init?.());
  soft('CoreBrain', () => AstranovCoreBrain?.init?.());

  LazyModules?.schedule?.();

  document.documentElement.dataset.astranovPhase = 'app';
  window._astranovAppReady = true;
  console.log('%c[Astranov] app boot · CLI + city ready', 'color:#00dd77;font-weight:700');
};
