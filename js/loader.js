// === ASTRANOV LOADER — multi-file phased boot (replaces monolith index.html) ===
// Phases: critical (globe) → app (CLI/city) → features (heavy) → deferred (on demand)
(function AstranovLoader(global) {
  'use strict';

  const build = document.querySelector('meta[name="astranov-build"]')?.content || '0';
  const base = '/js/';
  const q = (file) => base + file + '?v=' + encodeURIComponent(build);

  // Injected at assemble time as window.__ASTRANOV_MANIFEST__
  const man = global.__ASTRANOV_MANIFEST__ || { critical: [], app: [], features: [], deferred: [] };

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-astranov-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('load fail ' + src)), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false; // preserve order within a phase
      s.dataset.astranovSrc = src;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function loadPhase(files, label) {
    const t0 = performance.now();
    for (const f of files) {
      await loadScript(q(f));
    }
    const ms = Math.round(performance.now() - t0);
    console.log('%c[loader] ' + label + ' · ' + files.length + ' files · ' + ms + 'ms', 'color:#7ec8ff');
  }

  function loadVendor(src, attr) {
    return new Promise((resolve, reject) => {
      if (attr === 'supabase' && typeof global.supabase !== 'undefined') return resolve();
      if (attr === 'leaflet' && typeof global.L !== 'undefined') return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('vendor ' + src));
      document.head.appendChild(s);
    });
  }

  async function run() {
    const tAll = performance.now();
    document.documentElement.dataset.astranovPhase = 'loading';

    // 1) CRITICAL — Earth interactive
    await loadPhase(man.critical || [], 'critical');
    try { global.__astranovBootCritical?.(); } catch (e) { console.error('[boot critical]', e); }

    // Yield so first frames paint before more JS
    await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

    // 2) Vendors needed by app (not in critical path)
    try {
      await Promise.all([
        loadVendor('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js', 'supabase'),
        loadVendor('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js', 'leaflet'),
      ]);
    } catch (e) {
      console.warn('[loader] vendor', e);
    }

    // 3) APP — UI shell
    await loadPhase(man.app || [], 'app');
    try { global.__astranovBootApp?.(); } catch (e) { console.error('[boot app]', e); }

    // 4) FEATURES — after short idle (phone: longer)
    const lite = !!global._globePerfLite;
    const featDelay = lite ? 280 : 80;
    await new Promise(r => setTimeout(r, featDelay));
    await loadPhase(man.features || [], 'features');
    try { global.__astranovBootFeatures?.(); } catch (e) { console.error('[boot features]', e); }

    global.__ASTRANOV_DEFERRED_FILES__ = man.deferred || [];
    global._astranovLoaderDone = true;
    document.documentElement.dataset.astranovPhase = 'ready';
    console.log(
      '%c[loader] done · ' + Math.round(performance.now() - tAll) + 'ms · build ' + build,
      'color:#00ff99;font-weight:700'
    );
  }

  global.AstranovLoader = { run, loadScript, loadPhase, q, build };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { run().catch(e => console.error('[loader]', e)); });
  } else {
    run().catch(e => console.error('[loader]', e));
  }
})(window);
