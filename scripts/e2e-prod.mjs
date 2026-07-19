#!/usr/bin/env node
/**
 * Self-verify production in a real browser (Playwright).
 * No human checks — agent runs this and evolves until green.
 */
import { chromium } from 'playwright';

const ORIGIN = process.argv[2] || 'https://astranov.eu';
const TIMEOUT = 45000;

const result = {
  origin: ORIGIN,
  ok: false,
  build: null,
  phase: null,
  hasCanvas: false,
  canvasSize: null,
  hasWebGL: false,
  criticalReady: false,
  appReady: false,
  bootFail: null,
  consoleErrors: [],
  pageErrors: [],
  notes: [],
};

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'],
});

const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  userAgent:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36 AstranovE2E/1',
});
const page = await context.newPage();

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    result.consoleErrors.push(msg.text().slice(0, 300));
  }
});
page.on('pageerror', (err) => {
  result.pageErrors.push(String(err.message || err).slice(0, 400));
});

try {
  await page.goto(ORIGIN + '/?e2e=' + Date.now(), {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT,
  });

  // Wait for hard boot path
  await page.waitForTimeout(4000);

  const snap = await page.evaluate(() => {
    const canvas = document.querySelector('#globe canvas');
    let hasWebGL = false;
    try {
      if (canvas) {
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        hasWebGL = !!gl;
      }
    } catch (_) {}
    const fail = document.getElementById('astranov-boot-fail');
    const build = document.querySelector('meta[name="astranov-build"]')?.content || null;
    return {
      build,
      phase: document.documentElement.dataset.astranovPhase || null,
      spartan: document.documentElement.dataset.spartan || null,
      criticalReady: !!window._astranovCriticalReady,
      appReady: !!window._astranovAppReady,
      hasTHREE: typeof window.THREE !== 'undefined',
      hasBootCritical: typeof window.__astranovBootCritical === 'function',
      hasBootApp: typeof window.__astranovBootApp === 'function',
      hasRenderer: !!(window.renderer && window.renderer.domElement),
      hasCanvas: !!canvas,
      canvasW: canvas?.width || 0,
      canvasH: canvas?.height || 0,
      canvasDisplay: canvas ? getComputedStyle(canvas).display : null,
      canvasOpacity: canvas ? getComputedStyle(canvas).opacity : null,
      globeExists: !!document.getElementById('globe'),
      cityMapExists: !!document.getElementById('city-map'),
      bootFail: fail ? fail.textContent : null,
      bodyTextSample: (document.body?.innerText || '').slice(0, 200),
    };
  });

  Object.assign(result, {
    build: snap.build,
    phase: snap.phase,
    hasCanvas: snap.hasCanvas,
    canvasSize: { w: snap.canvasW, h: snap.canvasH },
    hasWebGL: snap.hasWebGL,
    criticalReady: snap.criticalReady,
    appReady: snap.appReady,
    bootFail: snap.bootFail,
    notes: [
      'THREE=' + snap.hasTHREE,
      'bootCriticalFn=' + snap.hasBootCritical,
      'bootAppFn=' + snap.hasBootApp,
      'renderer=' + snap.hasRenderer,
      'globeEl=' + snap.globeExists,
      'cityMapEl=' + snap.cityMapExists,
      'canvasDisplay=' + snap.canvasDisplay,
      'canvasOpacity=' + snap.canvasOpacity,
      'spartan=' + snap.spartan,
    ],
  });

  // Screenshot for agent evidence
  const shotPath = 'support/e2e-prod-latest.png';
  await page.screenshot({ path: shotPath, fullPage: false });
  result.screenshot = shotPath;

  result.ok =
    snap.hasTHREE
    && snap.criticalReady
    && snap.hasCanvas
    && snap.canvasW > 0
    && snap.canvasH > 0
    && !snap.bootFail
    && snap.phase !== 'critical-error';

  // Soft: app ready is nice but Earth alone is usable
  if (result.ok && !snap.appReady) {
    result.notes.push('app layer not ready yet (Earth alone still counts as usable)');
  }
} catch (e) {
  result.notes.push('e2e exception: ' + (e.message || e));
  result.ok = false;
} finally {
  await browser.close();
}

console.log(JSON.stringify(result, null, 2));
process.exit(result.ok ? 0 : 1);
