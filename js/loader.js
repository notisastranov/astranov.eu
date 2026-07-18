// === ASTRANOV LOADER — phase bundles, parallel download, globe first ===
// Production loads 4 phase files (not 76). Source stays multi-file in src/.
(function AstranovLoader(global) {
  'use strict';

  const build = document.querySelector('meta[name="astranov-build"]')?.content || '0';
  const base = '/js/';
  const q = (file) => base + file + (file.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(build);

  const man = global.__ASTRANOV_MANIFEST__ || {
    mode: 'phase',
    critical: ['phase-critical.js'],
    app: ['phase-app.js'],
    features: ['phase-features.js'],
    deferred: ['phase-deferred.js'],
  };

  function loadScriptOrdered(src) {
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
      s.async = false; // parallel download, ordered execute when batch-inserted
      s.dataset.astranovSrc = src;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  /** Insert all scripts now → browser downloads in parallel, runs in order */
  function loadPhase(files, label) {
    const t0 = performance.now();
    const list = files || [];
    if (!list.length) return Promise.resolve();
    const promises = list.map(f => loadScriptOrdered(q(f)));
    return Promise.all(promises).then(() => {
      console.log(
        '%c[loader] ' + label + ' · ' + list.length + ' file(s) · ' + Math.round(performance.now() - t0) + 'ms',
        'color:#7ec8ff'
      );
    });
  }

  function preload(files) {
    (files || []).forEach(f => {
      const href = q(f);
      if (document.querySelector('link[data-preload="' + href + '"]')) return;
      const l = document.createElement('link');
      l.rel = 'preload';
      l.as = 'script';
      l.href = href;
      l.dataset.preload = href;
      document.head.appendChild(l);
    });
  }

  function loadVendor(src, ready) {
    return new Promise((resolve) => {
      if (ready()) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { console.warn('[loader] vendor fail', src); resolve(); };
      document.head.appendChild(s);
    });
  }

  function afterPaint() {
    return new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  }

  function whenIdle(ms) {
    return new Promise(resolve => {
      const go = () => resolve();
      if (typeof requestIdleCallback === 'function') {
        requestIdleCallback(go, { timeout: ms });
      } else setTimeout(go, Math.min(ms, 400));
    });
  }

  async function run() {
    const tAll = performance.now();
    document.documentElement.dataset.astranovPhase = 'loading';
    window._bootAt = Date.now();

    // Warm next phases while critical downloads
    preload(man.app);
    preload(man.features);

    // 1) CRITICAL — Earth interactive
    try {
      await loadPhase(man.critical || [], 'critical');
      global.__astranovBootCritical?.();
    } catch (e) {
      console.error('[loader] critical', e);
      document.documentElement.dataset.astranovPhase = 'critical-error';
      return;
    }

    await afterPaint();

    // 2) Vendors (parallel) — not on critical path
    await Promise.all([
      loadVendor(
        'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
        () => typeof global.supabase !== 'undefined'
      ),
      loadVendor(
        'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        () => typeof global.L !== 'undefined'
      ),
    ]);

    // 3) APP
    try {
      await loadPhase(man.app || [], 'app');
      global.__astranovBootApp?.();
    } catch (e) {
      console.error('[loader] app', e);
    }

    await afterPaint();

    // 4) FEATURES — wait for idle so drag/zoom stay smooth
    const lite = !!global._globePerfLite;
    await whenIdle(lite ? 2200 : 900);
    try {
      await loadPhase(man.features || [], 'features');
      global.__astranovBootFeatures?.();
    } catch (e) {
      console.error('[loader] features', e);
    }

    global.__ASTRANOV_DEFERRED_FILES__ = man.deferred || [];
    global._astranovLoaderDone = true;
    document.documentElement.dataset.astranovPhase = 'ready';
    console.log(
      '%c[loader] ready · ' + Math.round(performance.now() - tAll) + 'ms · build ' + build
        + ' · mode ' + (man.mode || 'files'),
      'color:#00ff99;font-weight:700'
    );
  }

  global.AstranovLoader = { run, loadPhase, preload, q, build };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { run().catch(e => console.error('[loader]', e)); });
  } else {
    run().catch(e => console.error('[loader]', e));
  }
})(window);
