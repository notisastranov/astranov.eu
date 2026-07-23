// === SPARTAN BOOT · FEATURES — field hub only. Heavy toys stay deferred. ===
window.__astranovBootFeatures = function __astranovBootFeatures() {
  const soft = (name, fn) => {
    try { fn?.(); } catch (e) { console.warn('[spartan features] ' + name, e); }
  };
  const idle = (fn, ms) => {
    const run = () => { try { fn(); } catch (e) { console.warn('[spartan idle]', e); } };
    if (typeof requestIdleCallback === 'function') requestIdleCallback(run, { timeout: ms });
    else setTimeout(run, Math.min(ms, 800));
  };

  // OS may already be up from app boot — ensure once
  soft('AstranovOS', () => {
    try { AstranovOS?.init?.(); } catch (_) {}
    try { AstranovBrowser?.init?.(); } catch (_) {}
  });

  soft('GlobeEntity', () => GlobeEntity?.init?.());
  soft('CityTasks', () => {
    CityTasks?.init?.();
    TaskBoard?.init?.();
  });
  soft('SpaceNetCM', () => SpaceNetCM?.init?.());
  soft('CoreBrain', () => AstranovCoreBrain?.init?.());
  soft('Logo', () => AstranovLogo?.init?.());
  soft('Shortcuts', () => {
    try { AppShortcuts?.init?.(); } catch (_) {}
  });

  // Locate wiring: 🎯 national → city (never bare undeclared locateMe — kills app)
  idle(() => {
    const btn = document.getElementById('aci-locate');
    if (btn && !btn._spartanLocate) {
      btn._spartanLocate = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        try {
          if (window.CityLife?.safeLocate) void window.CityLife.safeLocate();
          else if (window.CityLife?.locateAndDropIn) void window.CityLife.locateAndDropIn().catch(() => {});
          else if (typeof window.locateMe === 'function') window.locateMe();
        } catch (err) {
          console.warn('[locate]', err);
        }
      }, { capture: true });
    }
  }, 200);

  if (window._lastPos) {
    try {
      const nm = Auth?.user?.user_metadata?.full_name
        || Auth?.user?.email?.split?.('@')?.[0]
        || 'You';
      GlobeEntity?.syncMe?.(window._lastPos.lat, window._lastPos.lng, nm);
    } catch (_) {}
  }

  // SPECS / owner: no SpaceNet start popup — coach permanently off
  window.showFirstRunCoach = function showFirstRunCoach() {
    try {
      const el = document.getElementById('first-run-coach');
      if (el) { el.hidden = true; el.style.display = 'none'; el.innerHTML = ''; }
      localStorage.setItem('astranov:coach-v3-os', '1');
      localStorage.setItem('astranov:coach-v4-spacenet', '1');
      localStorage.setItem('astranov:coach-disabled', '1');
    } catch (_) {}
  };
  /* first-run coach disabled */

  window._astranovFeaturesReady = true;
  document.documentElement.dataset.astranovPhase = 'features';
  console.log('%c[Spartan] OS · browser · field hub · channels · tasks', 'color:#ffdd44;font-weight:700');
};
