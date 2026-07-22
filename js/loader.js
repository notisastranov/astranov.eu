// === ASTRANOV LOADER — MUST work when primary URL 404s (Vercel/CDN gaps) ===
(function AstranovLoader(global) {
  'use strict';

  const build = document.querySelector('meta[name="astranov-build"]')?.content || '0';
  const man = global.__ASTRANOV_MANIFEST__ || {
    mode: 'js-phase-bundles',
    critical: ['/js/phase-critical.js'],
    app: ['/js/phase-app.js'],
    features: ['/js/phase-features.js'],
    deferred: ['/astranov-deferred.js'],
  };

  // Hardcoded rescue if manifest points at dead root paths (live incident 2026-07-18)
  const RESCUE = {
    critical: ['/js/phase-critical.js'],
    app: ['/js/phase-app.js'],
    features: ['/js/phase-features.js'],
    deferred: ['/astranov-deferred.js'],
  };
  const RESCUE_INDIVIDUAL = {
    critical: [
      '/js/00-globe.js', '/js/07-light-stubs.js', '/js/02-lazy-modules.js',
      '/js/03-slumber-manager.js', '/js/50-cosmic.js', '/js/09-zoom-tiers.js',
      '/js/10-trackball.js', '/js/04-trackball-guard.js', '/js/62-astranov-theme.js',
      '/js/63-earth-daynight.js', '/js/99-boot-critical.js',
    ],
  };

  function withV(url) {
    if (!url) return url;
    return url + (url.includes('?') ? '&' : '?') + 'v=' + encodeURIComponent(build);
  }

  function resolveUrl(file) {
    if (!file) return file;
    if (file.startsWith('http') || file.startsWith('/')) return withV(file);
    return withV('/js/' + file);
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const existing = document.querySelector('script[data-astranov-src="' + src + '"]');
      if (existing) {
        if (existing.dataset.loaded === '1') return resolve();
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('load fail')), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.astranovSrc = src;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('Failed ' + src));
      document.head.appendChild(s);
    });
  }

  async function tryUrls(urls, label) {
    const list = (urls || []).filter(Boolean);
    if (!list.length) throw new Error('empty ' + label);
    const t0 = performance.now();
    // Prefer single-bundle first URL; if it fails, try rest as ordered multi
    try {
      if (list.length === 1) {
        await loadScript(resolveUrl(list[0]));
      } else {
        await Promise.all(list.map(f => loadScript(resolveUrl(f))));
      }
      console.log('%c[loader] ' + label + ' OK · ' + Math.round(performance.now() - t0) + 'ms', 'color:#7ec8ff');
      return true;
    } catch (e) {
      console.warn('[loader] ' + label + ' primary failed', e.message || e);
      return false;
    }
  }

  async function loadPhaseSmart(primary, label, extraFallbacks) {
    const fb = man.fallback || {};
    const chains = [
      primary,
      RESCUE[label],
      (fb[label] || []).map(f => (String(f).startsWith('/') ? f : '/js/' + f)),
      extraFallbacks,
    ];
    for (const chain of chains) {
      if (!chain || !chain.length) continue;
      const ok = await tryUrls(chain, label);
      if (ok) return;
    }
    throw new Error('All chains failed for ' + label);
  }

  function loadVendor(src, ready) {
    return new Promise((resolve) => {
      if (ready()) return resolve();
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => resolve();
      document.head.appendChild(s);
    });
  }

  const afterPaint = () => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
  const whenIdle = (ms) => new Promise(resolve => {
    if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: ms });
    else setTimeout(resolve, Math.min(ms, 500));
  });

  function showDeadBanner(msg) {
    try {
      let el = document.getElementById('astranov-boot-fail');
      if (!el) {
        el = document.createElement('div');
        el.id = 'astranov-boot-fail';
        el.style.cssText = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;padding:12px;'
          + 'background:rgba(40,0,0,.94);border:1px solid #f66;color:#fcc;font:12px system-ui;border-radius:10px';
        document.body.appendChild(el);
      }
      el.textContent = msg;
    } catch (_) {}
  }

  async function run() {
    const tAll = performance.now();
    document.documentElement.dataset.astranovPhase = 'loading';
    window._bootAt = Date.now();

    try {
      await loadPhaseSmart(man.critical, 'critical', RESCUE_INDIVIDUAL.critical);
      try { global.__astranovBootCritical?.(); }
      catch (e) { showDeadBanner('Boot error: ' + (e.message || e)); }
    } catch (e) {
      showDeadBanner('CRITICAL failed — hard refresh / clear site data. ' + (e.message || e));
      document.documentElement.dataset.astranovPhase = 'critical-error';
      return;
    }

    await afterPaint();
    await Promise.all([
      loadVendor('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js',
        () => typeof global.supabase !== 'undefined'),
      loadVendor('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
        () => typeof global.L !== 'undefined'),
    ]);

    try {
      await loadPhaseSmart(man.app, 'app');
      global.__astranovBootApp?.();
    } catch (e) {
      console.error('[loader] app', e);
      showDeadBanner('App shell failed: ' + (e.message || e));
    }

    await afterPaint();
    await whenIdle(global._globePerfLite ? 1600 : 600);

    try {
      await loadPhaseSmart(man.features, 'features');
      global.__astranovBootFeatures?.();
    } catch (e) {
      console.error('[loader] features', e);
    }

    global.__ASTRANOV_DEFERRED_URLS__ = (man.deferred || RESCUE.deferred).map(resolveUrl);
    global.__ASTRANOV_DEFERRED_FILES__ = [];
    global._astranovLoaderDone = true;
    document.documentElement.dataset.astranovPhase = 'ready';
    if (global._astranovCriticalReady) {
      document.getElementById('astranov-boot-fail')?.remove();
    }
    console.log('%c[loader] ready · ' + Math.round(performance.now() - tAll) + 'ms · ' + build, 'color:#00ff99;font-weight:700');
  }

  global.AstranovLoader = { run, build };

  // Hard-boot path in index.html already loads phases sequentially.
  // loader.js still ships for live-check/guard + optional rescue (call AstranovLoader.run()).
  if (global.__ASTRANOV_HARD_BOOT__) {
    global._astranovLoaderDone = true;
    console.log('%c[loader] hard-boot mode · standby rescue ready · ' + build, 'color:#7ec8ff');
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { run().catch(e => console.error('[loader]', e)); });
  } else {
    run().catch(e => console.error('[loader]', e));
  }
})(window);
