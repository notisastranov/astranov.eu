#!/usr/bin/env node
/**
 * Self-verify locate + globe handoff on production (Playwright).
 * Agent-owned — never require the human to click through.
 *
 * Checks:
 *  1) Boot critical ready
 *  2) City map can open then returnToGlobe (zoom out to Earth)
 *  3) Cinematic dropIn: fly stages include global (≈2.55) + national (≈1.82) + city
 *  4) Ends with city map active, no fatal page errors
 */
import { chromium } from 'playwright';

const ORIGIN = process.argv[2] || 'https://astranov.eu';
const CINEMATIC = !process.argv.includes('--snap');

const result = {
  origin: ORIGIN,
  ok: false,
  build: null,
  cinematic: CINEMATIC,
  criticalReady: false,
  returnToGlobe: null,
  locate: null,
  pageErrors: [],
  notes: [],
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  geolocation: { latitude: 37.9838, longitude: 23.7275 },
  permissions: ['geolocation'],
});
const page = await context.newPage();
page.on('pageerror', (err) => {
  result.pageErrors.push(String(err.message || err).slice(0, 300));
});

try {
  console.error('[locate-e2e] goto…');
  await page.goto(ORIGIN + '/?e2e-locate=' + Date.now(), {
    waitUntil: 'domcontentloaded',
    timeout: 30000,
  });
  await page.waitForTimeout(3500);

  result.criticalReady = await page.evaluate(() => !!window._astranovCriticalReady);
  result.build = await page.evaluate(
    () => document.querySelector('meta[name="astranov-build"]')?.content || null
  );
  console.error('[locate-e2e] build', result.build, 'ready', result.criticalReady, 'mode', CINEMATIC ? 'cinematic' : 'snap');

  if (!result.criticalReady) {
    result.notes.push('critical not ready');
    throw new Error('boot not ready');
  }

  // A) City map → returnToGlobe must reveal Earth
  result.returnToGlobe = await page.evaluate(async () => {
    const lat = 37.9838;
    const lng = 23.7275;
    window._lastPos = { lat, lng };
    try { userLocated = true; } catch (_) {}
    window.userLocated = true;
    try {
      CityMap?.init?.();
      CityMap?.openAt?.(lat, lng, { camZ: 1.34 });
    } catch (e) {
      return { error: 'openAt ' + (e.message || e) };
    }
    const opened = !!CityMap?.active;
    try {
      if (CityMap?.returnToGlobe) CityMap.returnToGlobe({ instant: false, tier: 'global' });
      else CityMap?._exit?.();
    } catch (e) {
      return { error: 'returnToGlobe ' + (e.message || e), opened };
    }
    await new Promise((r) => setTimeout(r, 1400));
    const canvas = document.querySelector('#globe canvas');
    return {
      opened,
      mapActive: !!CityMap?.active,
      globeHasCityClass: !!document.getElementById('globe')?.classList.contains('city-map-active'),
      canvasOpacity: canvas ? getComputedStyle(canvas).opacity : null,
      camZ: typeof camera !== 'undefined' ? camera.position.z : null,
      hasReturn: typeof CityMap?.returnToGlobe === 'function',
    };
  });
  console.error('[locate-e2e] returnToGlobe', JSON.stringify(result.returnToGlobe));

  // B) Cinematic (or snap) locate with fly instrumentation
  result.locate = await page.evaluate(async (cinematic) => {
    const lat = 37.9838;
    const lng = 23.7275;
    // Start from city map to prove we leave it for globe first
    try {
      CityMap?.openAt?.(lat, lng, { camZ: 1.34 });
    } catch (_) {}
    await new Promise((r) => setTimeout(r, 150));

    const flies = [];
    const orig = window.flyToPoint;
    if (typeof orig === 'function') {
      window.flyToPoint = function (pt, z, opts) {
        flies.push({ z, dur: opts?.dur || null, t: Date.now() });
        return orig.apply(this, arguments);
      };
    }

    if (!window.CityLife?.dropIn) {
      return { error: 'CityLife.dropIn missing', flies };
    }

    const timeoutMs = cinematic ? 32000 : 12000;
    let out;
    try {
      out = await Promise.race([
        window.CityLife.dropIn(lat, lng, {
          label: 'E2E locate',
          immediate: !cinematic,
        }),
        new Promise((resolve) =>
          setTimeout(() => resolve({ error: 'dropIn timeout' }), timeoutMs)
        ),
      ]);
    } catch (e) {
      return { error: String(e?.message || e), flies };
    }

    return {
      out,
      flies,
      mapActive: !!CityMap?.active,
      lastPos: window._lastPos || null,
      camZ: typeof camera !== 'undefined' ? camera.position.z : null,
    };
  }, CINEMATIC);

  console.error('[locate-e2e] locate', JSON.stringify({
    flies: result.locate?.flies,
    mapActive: result.locate?.mapActive,
    out: result.locate?.out,
    error: result.locate?.error,
  }));

  try {
    await page.screenshot({ path: 'support/e2e-locate-latest.png', fullPage: false, timeout: 5000 });
    result.screenshot = 'support/e2e-locate-latest.png';
  } catch (e) {
    result.notes.push('screenshot: ' + (e.message || e));
  }

  const fatal = result.pageErrors.some((e) =>
    /is not defined|Unexpected token|Cannot read/i.test(e)
  );
  const rtg = result.returnToGlobe || {};
  const loc = result.locate || {};
  const flies = loc.flies || [];
  const hasGlobal = flies.some((f) => f.z >= 3.2);
  const hasNational = flies.some((f) => f.z >= 1.9 && f.z <= 2.3);
  const mapOk = !!(loc.mapActive || loc.out?.mapActive);
  const posOk = !!(loc.lastPos?.lat || loc.out?.lat);
  const returnOk =
    rtg.hasReturn !== false
    && rtg.mapActive === false
    && rtg.canvasOpacity !== '0'
    && (rtg.camZ == null || rtg.camZ >= 2.0);

  result.notes.push(
    'returnOk=' + returnOk,
    'flies=' + flies.map((f) => f.z).join('→'),
    'hasGlobal=' + hasGlobal,
    'hasNational=' + hasNational,
    'mapOk=' + mapOk
  );

  result.ok =
    result.criticalReady
    && !fatal
    && returnOk
    && posOk
    && mapOk
    && !loc.error
    && (!CINEMATIC || (hasGlobal && hasNational && flies.length >= 2));

} catch (e) {
  result.notes.push('exception: ' + (e.message || e));
  result.ok = false;
} finally {
  await browser.close().catch(() => {});
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
