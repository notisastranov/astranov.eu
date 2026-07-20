// === SPARTAN BOOT · APP — map + slim CLI. No heavy subsystems. ===
window.__astranovBootApp = function __astranovBootApp() {
  const soft = (name, fn) => {
    try { fn?.(); } catch (e) { console.warn('[spartan app] ' + name, e); }
  };

  // Auth (optional — globe already works without it)
  soft('Auth', () => Auth?.init?.());

  // CLI ribbon collapsed — Earth stays the stage
  soft('GlobeDeck', () => {
    GlobeDeck?.init?.();
    try {
      GlobeDeck.bootCollapsed?.();
      GlobeDeck.expanded = false;
      GlobeDeck._size = 'collapsed';
      GlobeDeck.applySize?.();
      const deck = document.getElementById('globe-deck');
      deck?.classList.remove('expanded', 'size-third', 'size-full');
      deck?.classList.add('collapsed');
    } catch (_) {
      GlobeDeck?.bootCollapsed?.();
    }
    GlobeDeck?.setTitle?.(PublicCopy?.deckTitle?.() || 'Astranov');
    GlobeDeck?.setPreview?.('Earth · drag · scroll country · tap city · 🎯 locate');
  });

  soft('SuperCli', () => SuperCli?.init?.());
  soft('AciCli', () => AciCli?.init?.());
  soft('ClassifiedTriangles', () => ClassifiedTriangles?.init?.());

  // MAP — core product after Earth
  soft('CityMap', () => {
    CityMap?.init?.();
    // Retry Leaflet if still loading
    if (!CityMap?._ready) setTimeout(() => CityMap?.init?.(), 500);
  });
  soft('MultiTile', () => MultiTile?.init?.());
  soft('CityLife', () => CityLife?.init?.());
  soft('CityPick', () => CityPick?.init?.());

  soft('ResourceMonitor', () => {
    if (typeof requestIdleCallback === 'function') {
      requestIdleCallback(() => ResourceMonitor?.init?.(), { timeout: 1200 });
    } else {
      setTimeout(() => ResourceMonitor?.init?.(), 400);
    }
  });

  // Astranov OS + Browser — chrome as soon as map/CLI layer is up
  soft('AstranovOS', () => {
    try { AstranovOS?.init?.(); } catch (e) { console.warn('[OS]', e); }
    try { AstranovBrowser?.init?.(); } catch (e) { console.warn('[Browser]', e); }
  });

  // Deferred pack only after map path is up (longer on lite/mobile)
  try {
    const delay = window._globePerfLite ? 2800 : 900;
    setTimeout(() => { try { LazyModules?.schedule?.(); } catch (_) {} }, delay);
  } catch (_) {
    try { LazyModules?.schedule?.(); } catch (_) {}
  }

  // Unlock earth after short settle
  setTimeout(() => {
    window._bootEarthLock = false;
    try {
      if (camera?.position?.z > 4.8) {
        camera.position.z = 2.55;
        ZoomTiers?.goTo?.('global', false);
      }
    } catch (_) {}
    const ready = 'Astranov OS · Earth desktop · dock: Browser · 🎯 locate';
    try { CliRibbon?.setNotice?.(ready, 'ready'); } catch (_) {}
    try { GlobeDeck?.setPreview?.(ready); } catch (_) {}
    const zl = document.getElementById('zoom-label');
    if (zl) zl.textContent = PublicCopy?.zoomLine?.('global') || ready;
  }, 300);

  window._astranovAppReady = true;
  document.documentElement.dataset.astranovPhase = 'app';
  console.log('%c[Spartan] OS · map · CLI ready', 'color:#00dd77;font-weight:700');
};
