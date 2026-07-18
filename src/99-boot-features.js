// === BOOT FEATURES — entities, voice, product, heavy modules (idle-friendly) ===
window.__astranovBootFeatures = function __astranovBootFeatures() {
  const soft = (name, fn) => {
    try { fn?.(); } catch (e) { console.warn('[boot-features] ' + name, e); }
  };
  const idle = (fn, ms) => {
    const run = () => { try { fn(); } catch (e) { console.warn('[boot idle]', e); } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: ms });
    else setTimeout(run, ms);
  };

  soft('GlobeEntity', () => GlobeEntity?.init?.());
  soft('AiRouter', () => AiRouter?.init?.());
  soft('ProductSurface', () => ProductSurface?.init?.());
  soft('CityTasks', () => CityTasks?.init?.());

  idle(() => ArchitectBridge?.init?.(), 2500);
  idle(() => GlobeInfoTiles?.init?.({ seed: false }), 4000);
  idle(() => ProductSurface?._ensureCityDnaSection?.(), 1600);

  setTimeout(() => { try { Auth?.refreshAuthority?.(); } catch (_) {} }, 1200);
  setTimeout(() => {
    try {
      ProductSurface?.init?.();
      MenuProfilePostTile?.init?.();
    } catch (_) {}
  }, 1400);
  try { AciCli?.primeCodersCli?.(); } catch (_) {}
  setTimeout(() => { try { AciCoders?.ensureBridge?.(); } catch (_) {} }, 5000);

  if (window._lastPos) {
    try {
      const nm = Auth?.user?.user_metadata?.full_name || Auth?.user?.email?.split?.('@')?.[0] || 'You';
      GlobeEntity?.syncMe?.(_lastPos.lat, _lastPos.lng, nm);
    } catch (_) {}
  }

  setTimeout(() => {
    window._bootEarthLock = false;
    if (typeof camera !== 'undefined' && camera?.position?.z > 4.8) {
      camera.position.z = 2.55;
      ZoomTiers?.goTo?.('global', false);
    }
    CosmicZoom?.update?.(2.55, { tier: 'global', label: 'Earth', cosmic: 'earth' });
    const ready = PublicCopy?.readyNotice?.() || 'Ready · drag Earth · 🎯 city · 🎧 chat';
    ACIControl?.reply?.(ready);
    CliRibbon?.setNotice?.(ready, 'ready');
    GlobeDeck?.setPreview?.(PublicCopy?.isArchitect?.()
      ? 'Architect · fix · task · starship'
      : 'Type or 🎧 · 🎯 city · + post · date · hire · order');
    GlobeDeck?.setTitle?.(PublicCopy?.deckTitle?.() || 'Astranov');
    const inp = document.getElementById('aci-cli-in');
    if (inp && PublicCopy?.inputPlaceholder) inp.placeholder = PublicCopy.inputPlaceholder();
    try { primeGrokVoice?.(); } catch (_) {}
    try { showFirstRunCoach?.(); } catch (_) {}
    setTimeout(
      () => AciCoders?.enterSession?.({ expand: false, ping: false, focus: false }),
      window._globePerfLite ? 8000 : 4000
    );
    const zl = document.getElementById('zoom-label');
    if (zl) zl.textContent = PublicCopy?.zoomLine?.('global') || 'Earth · drag · 🎯 city · 🎧 chat · + post';
  }, 400);

  // Coach helper (was in old boot)
  if (!window.showFirstRunCoach) {
    window.showFirstRunCoach = function showFirstRunCoach() {
      try { if (localStorage.getItem('astranov:coach-v2')) return; } catch (_) { return; }
      const el = document.getElementById('first-run-coach');
      const ok = document.getElementById('first-run-coach-ok');
      if (!el || !ok) return;
      if (PublicCopy?.coachHtml) {
        el.innerHTML = PublicCopy.coachHtml()
          + '<button type="button" id="first-run-coach-ok">Got it</button>';
      }
      const okBtn = document.getElementById('first-run-coach-ok') || ok;
      el.hidden = false;
      okBtn.onclick = () => {
        el.hidden = true;
        try { localStorage.setItem('astranov:coach-v2', '1'); } catch (_) {}
      };
    };
  }

  document.documentElement.dataset.astranovPhase = 'features';
  window._astranovFeaturesReady = true;
  console.log('%c[Astranov] features boot · full surface', 'color:#ffdd44;font-weight:700');
};
