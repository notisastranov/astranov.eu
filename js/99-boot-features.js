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
    // Solo builder: seed nearby demo tasks so the field is never empty
    try { CityTasks?.seedDemoField?.(); } catch (_) {}
  });
  soft('SpaceNetGrokCli', () => {
    SpaceNetGrokCli?.init?.();
  });
  soft('SpaceNetCM', () => SpaceNetCM?.init?.());
  soft('CoreBrain', () => AstranovCoreBrain?.init?.());
  soft('Logo', () => AstranovLogo?.init?.());
  soft('Shortcuts', () => {
    try { AppShortcuts?.init?.(); } catch (_) {}
  });
  soft('ThemeSpacex', () => {
    try {
      if (!AstranovTheme) return;
      if (!localStorage.getItem('astranov_skin_v1')) AstranovTheme.setSpacex?.(true);
      else AstranovTheme.apply?.();
    } catch (_) {}
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

  if (!window.showFirstRunCoach) {
    window.showFirstRunCoach = function showFirstRunCoach() {
      try { if (localStorage.getItem('astranov:coach-v4-spacenet')) return; } catch (_) { return; }
      const el = document.getElementById('first-run-coach');
      if (!el) return;
      el.innerHTML = '<b>SpaceNet — the internet on Earth</b>'
        + '<ol style="margin:8px 0 0;padding-left:18px;line-height:1.45">'
        + '<li>🌍 Drag the globe · 🎯 locate · scroll into city</li>'
        + '<li>⌨️ Type below — <b>job barman 3h</b> · <b>date coffee</b> · <b>deliver food</b></li>'
        + '<li>🔍 <b>search</b> · <b>task list</b> · <b>task claim</b> — all paint the globe</li>'
        + '<li>Same OS on phone &amp; PC · install: Add to Home Screen</li>'
        + '</ol>'
        + '<button type="button" id="first-run-coach-ok">Start on SpaceNet</button>';
      el.hidden = false;
      document.getElementById('first-run-coach-ok')?.addEventListener('click', () => {
        el.hidden = true;
        try { localStorage.setItem('astranov:coach-v4-spacenet', '1'); } catch (_) {}
        try {
          document.getElementById('aci-cli-in')?.focus();
          GlobeDeck?.expand?.('SpaceNet');
          GlobeDeck?.setPreview?.('Type: job barman 3h · date coffee · deliver food · help');
          CliRibbon?.setNotice?.('SpaceNet CLI ready', 'ready');
        } catch (_) {}
      });
    };
  }
  setTimeout(() => {
    try { showFirstRunCoach?.(); } catch (_) {}
  }, 900);
  // Ribbon + preview: we build alone — product must speak for itself
  setTimeout(() => {
    try {
      CliRibbon?.setNotice?.('SpaceNet · type a job, date, delivery, or search', 'ready');
      GlobeDeck?.setPreview?.('SpaceNet CLI · job · date · deliver · search · locate');
      const input = document.getElementById('aci-cli-in');
      if (input && !input.value) {
        input.placeholder = 'SpaceNet · job barman 3h · date coffee · deliver · search · locate';
      }
    } catch (_) {}
  }, 1400);

  window._astranovFeaturesReady = true;
  document.documentElement.dataset.astranovPhase = 'features';
  console.log('%c[Spartan] OS · browser · field hub · channels · tasks', 'color:#ffdd44;font-weight:700');
};
