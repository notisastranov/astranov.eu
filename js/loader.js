// === ASTRANOV LOADER — live-safe root bundles + fallback to /js modules ===
// NEVER assume a path works: try root astranov-*.js first, then /js/* individuals.
(function AstranovLoader(global) {
  'use strict';

  const build = document.querySelector('meta[name="astranov-build"]')?.content || '0';
  const man = global.__ASTRANOV_MANIFEST__ || {
    mode: 'root-bundles',
    critical: ['/astranov-critical.js'],
    app: ['/astranov-app.js'],
    features: ['/astranov-features.js'],
    deferred: ['/astranov-deferred.js'],
  };

  function withV(url) {
    if (!url) return url;
    const sep = url.includes('?') ? '&' : '?';
    return url + sep + 'v=' + encodeURIComponent(build);
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
        existing.addEventListener('error', () => reject(new Error('load fail ' + src)), { once: true });
        return;
      }
      const s = document.createElement('script');
      s.src = src;
      s.async = false;
      s.dataset.astranovSrc = src;
      s.onload = () => { s.dataset.loaded = '1'; resolve(); };
      s.onerror = () => reject(new Error('Failed to load ' + src));
      document.head.appendChild(s);
    });
  }

  async function loadPhase(files, label, fallbackFiles) {
    const list = files || [];
    if (!list.length && fallbackFiles?.length) {
      return loadPhase(fallbackFiles, label + '-fallback');
    }
    const t0 = performance.now();
    try {
      // Insert all at once → parallel download, ordered execute
      await Promise.all(list.map(f => loadScript(resolveUrl(f))));
      console.log(
        '%c[loader] ' + label + ' · ' + list.length + ' · ' + Math.round(performance.now() - t0) + 'ms',
        'color:#7ec8ff'
      );
      return true;
    } catch (e) {
      console.warn('[loader] ' + label + ' failed', e);
      if (fallbackFiles?.length) {
        console.warn('[loader] trying fallback for ' + label);
        // sequential individuals more reliable if bundle 404s
        for (const f of fallbackFiles) {
          await loadScript(resolveUrl(f.startsWith('/') ? f : f));
        }
        console.log('%c[loader] ' + label + ' fallback OK', 'color:#ffdd44');
        return true;
      }
      throw e;
    }
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
      if (typeof requestIdleCallback === 'function') requestIdleCallback(() => resolve(), { timeout: ms });
      else setTimeout(resolve, Math.min(ms, 500));
    });
  }

  function showDeadBanner(msg) {
    try {
      let el = document.getElementById('astranov-boot-fail');
      if (!el) {
        el = document.createElement('div');
        el.id = 'astranov-boot-fail';
        el.style.cssText = 'position:fixed;inset:auto 12px 12px 12px;z-index:99999;padding:12px 14px;'
          + 'background:rgba(40,0,0,.92);border:1px solid #f66;color:#fcc;font:12px/1.4 system-ui;border-radius:10px';
        document.body.appendChild(el);
      }
      el.textContent = msg;
    } catch (_) {}
  }

  async function run() {
    const tAll = performance.now();
    document.documentElement.dataset.astranovPhase = 'loading';
    window._bootAt = Date.now();
    const fb = man.fallback || {};

    try {
      await loadPhase(man.critical, 'critical', fb.critical);
      try {
        global.__astranovBootCritical?.();
      } catch (e) {
        console.error('[boot critical]', e);
        showDeadBanner('Globe boot error: ' + (e.message || e));
      }
    } catch (e) {
      console.error('[loader] critical dead', e);
      showDeadBanner('CRITICAL load failed — hard refresh. ' + (e.message || e));
      document.documentElement.dataset.astranovPhase = 'critical-error';
      return;
    }

    if (!global._astranovCriticalReady && !global.__astranovBootCritical) {
      showDeadBanner('Critical loaded but boot missing — bad bundle');
    }

    await afterPaint();

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

    try {
      await loadPhase(man.app, 'app', fb.app);
      global.__astranovBootApp?.();
    } catch (e) {
      console.error('[loader] app', e);
      showDeadBanner('App shell failed: ' + (e.message || e));
    }

    await afterPaint();
    const lite = !!global._globePerfLite;
    await whenIdle(lite ? 1800 : 700);

    try {
      await loadPhase(man.features, 'features', fb.features);
      global.__astranovBootFeatures?.();
    } catch (e) {
      console.error('[loader] features', e);
    }

    // Deferred uses same root pattern as proven astranov-deferred.js
    global.__ASTRANOV_DEFERRED_FILES__ = (man.deferred || []).map(f =>
      f.startsWith('/') ? f.slice(1) : f
    );
    // Special: LazyModules loads /js/ or absolute — patch list for root deferred
    global.__ASTRANOV_DEFERRED_URLS__ = (man.deferred || []).map(resolveUrl);

    global._astranovLoaderDone = true;
    document.documentElement.dataset.astranovPhase = 'ready';
    const dead = document.getElementById('astranov-boot-fail');
    if (dead && global._astranovCriticalReady) dead.remove();
    console.log(
      '%c[loader] ready · ' + Math.round(performance.now() - tAll) + 'ms · ' + build,
      'color:#00ff99;font-weight:700'
    );
  }

  global.AstranovLoader = { run, loadPhase, resolveUrl, build };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => { run().catch(e => console.error('[loader]', e)); });
  } else {
    run().catch(e => console.error('[loader]', e));
  }
})(window);
