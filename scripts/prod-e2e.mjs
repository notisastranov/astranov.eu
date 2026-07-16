#!/usr/bin/env node
/**
 * Production E2E — Playwright against live astranov.eu (no user required).
 * Run: node scripts/prod-e2e.mjs [--url https://astranov.eu]
 */
import { chromium } from 'playwright';

const SITE = process.argv.find((a, i) => process.argv[i - 1] === '--url') || 'https://astranov.eu';
const URL = SITE.replace(/\/$/, '') + '/';

const SCENARIOS = [
  {
    name: 'live HTML — earth default + boot markers',
    run: async (page) => {
      const html = await page.content();
      if (/SOLAR SYSTEM<\/div>/.test(html) && !/GLOBAL/.test(html)) {
        throw new Error('static zoom-label still SOLAR SYSTEM only');
      }
      const r = await page.evaluate(() => ({
        bootLock: typeof window._bootEarthLock !== 'undefined',
        bootCollapsed: typeof GlobeDeck?.bootCollapsed === 'function',
        aiRouter: !!window.AiRouter,
        labOrbs: !!window.LabOrbs,
        build: document.querySelector('meta[name="astranov-build"]')?.content || '',
      }));
      if (!r.bootCollapsed || !r.aiRouter) throw new Error('missing boot markers: ' + JSON.stringify(r));
      return r;
    },
  },
  {
    name: 'live boot — GLOBAL earth not solar',
    run: async (page) => {
      await page.waitForFunction(() => window.CityMap?._ready, { timeout: 90000 });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({
        camZ: camera?.position?.z,
        level: CosmicZoom?.level,
        solarVis: !!CosmicZoom?.solarGroup?.visible,
        zoomLabel: document.getElementById('zoom-label')?.textContent || '',
        deckCollapsed: document.getElementById('globe-deck')?.classList.contains('collapsed'),
        globeCanvas: !!document.querySelector('#globe canvas'),
      }));
      if (!r.globeCanvas) throw new Error('no WebGL canvas');
      if (r.camZ > 4.5) throw new Error('camera too far: z=' + r.camZ);
      if (r.level === 'system' || r.level === 'galaxy') throw new Error('cosmic level wrong: ' + r.level);
      if (r.solarVis) throw new Error('solar group visible at boot');
      if (!/GLOBAL/i.test(r.zoomLabel)) throw new Error('zoom-label: ' + r.zoomLabel);
      return r;
    },
  },
  {
    name: 'live AI — ai-router responds in CLI',
    run: async (page) => {
      let r = null;
      for (let attempt = 0; attempt < 2; attempt++) {
        r = await page.evaluate(async (retry) => {
        AciCoders.history = [];
        const res = await AiRouter.ask('ping prod verify', { timeoutMs: retry ? 32000 : 22000 });
        const text = String(res.text || '').trim();
        if (!text || /gathering itself|warming up|no model responded/i.test(text)) {
          return { ok: false, error: res.error || text || 'empty' };
        }
        await AciCoders.chat('hello grok prod verify', { forceTest: true });
        const ribbon = document.getElementById('cli-ribbon-status')?.textContent || '';
        const preview = document.getElementById('globe-deck-preview')?.textContent || '';
        const logLines = [...(document.querySelectorAll('#globe-deck-log .deck-reply, #globe-deck-log .deck-ok') || [])]
          .map(el => el.textContent).slice(-3);
        return {
          ok: true,
          provider: res.provider || res.via,
          textLen: text.length,
          ribbon: ribbon.slice(0, 80),
          preview: preview.slice(0, 80),
          logLines,
          hist: AciCoders.history.filter(h => h.role === 'assistant').length,
        };
      }, attempt);
        if (r.ok) break;
        await page.waitForTimeout(1500);
      }
      if (!r.ok) throw new Error('ai-router failed: ' + (r.error || 'unknown'));
      const blob = (r.ribbon || '') + (r.preview || '') + (r.logLines || []).join(' ');
      const visible = /hello|verify|ready|online|grok here|talk straight|yes\b|coders/i.test(blob);
      if (r.hist < 1 && !visible) throw new Error('no visible AI reply: ' + JSON.stringify(r));
      if (!visible) {
        throw new Error('ribbon/preview missing reply after thinking: ' + JSON.stringify(r));
      }
      return r;
    },
  },
  {
    name: 'live locate — city map opens',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        await CityLife.dropIn(36.44, 28.22, { label: 'prod verify' });
        return { active: CityMap.active, pos: window._lastPos };
      });
      if (!r.active) throw new Error('city map not active');
      return r;
    },
  },
  {
    name: 'live click — + opens place menu (no silent fail)',
    run: async (page) => {
      await page.waitForFunction(() => typeof MapPlaceMenu?.openPlusField === 'function', { timeout: 60000 });
      await page.click('#super-add-fab');
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => {
        const hud = document.getElementById('globe-entity-hud');
        const tri = document.getElementById('classified-triangles-primary');
        return {
          hudOpen: hud?.classList.contains('open'),
          triangles: tri?.querySelectorAll('.ct-tri')?.length || 0,
          preview: document.getElementById('globe-deck-preview')?.textContent || '',
          ribbon: document.getElementById('cli-ribbon-status')?.textContent || '',
        };
      });
      const ok = r.hudOpen && r.triangles >= 3;
      if (!ok) throw new Error('+ did not open place menu: ' + JSON.stringify(r));
      await page.evaluate(() => MapPlaceMenu?.close?.());
      return r;
    },
  },
  {
    name: 'live click — city map opens place menu',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        if (!CityMap?.active) await CityLife?.dropIn?.(36.44, 28.22, { label: 'prod verify' });
        if (!CityMap?.active) return { ok: false, reason: 'city map not active' };
        const c = window._lastPos || { lat: 36.44, lng: 28.22 };
        MapPlaceMenu?.openAt?.(c.lat, c.lng, { source: 'City map', limited: true });
        const hud = document.getElementById('globe-entity-hud');
        const tri = document.getElementById('classified-triangles-primary');
        return {
          ok: hud?.classList.contains('open') && (tri?.querySelectorAll('.ct-tri')?.length || 0) >= 3,
          triangles: tri?.querySelectorAll('.ct-tri')?.length || 0,
        };
      });
      if (!r.ok) throw new Error('city map place menu failed: ' + JSON.stringify(r));
      await page.evaluate(() => MapPlaceMenu?.close?.());
      return r;
    },
  },
  {
    name: 'live zoom — solar system reachable',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        MapPlaceMenu?.close?.();
        CityMap?._exit?.();
        window._cityDropLock = false;
        ZoomTiers?.goTo?.('global', false);
        if (camera) { camera.position.z = 2.55; camera.lookAt(0, 0, 0); }
        CosmicZoom?.update?.(2.55, { tier: 'global', label: 'GLOBAL', cosmic: 'earth' });
        ZoomTiers?.goTo?.('solar', false);
        await new Promise(r => setTimeout(r, 400));
        return {
          tier: ZoomTiers?.current?.()?.id,
          camZ: camera?.position?.z,
          level: CosmicZoom?.level,
          solarVis: !!CosmicZoom?.solarGroup?.visible,
          planets: CosmicZoom?.planets?.length || 0,
        };
      });
      if (r.tier !== 'solar') throw new Error('tier not solar: ' + JSON.stringify(r));
      if (r.level !== 'system') throw new Error('cosmic level not system: ' + JSON.stringify(r));
      if (!r.solarVis) throw new Error('solar group not visible: ' + JSON.stringify(r));
      if (r.planets < 4) throw new Error('planets missing: ' + JSON.stringify(r));
      return r;
    },
  },
  {
    name: 'live click — 🎧 opens AI without zoom',
    run: async (page) => {
      await page.evaluate(() => {
        MapPlaceMenu?.close?.();
        CityMap?._exit?.();
        window._cityDropLock = false;
        ZoomTiers?.goTo?.('global', false);
        if (camera) { camera.position.z = 2.55; camera.lookAt(0, 0, 0); }
        CosmicZoom?.update?.(2.55, { tier: 'global', label: 'GLOBAL', cosmic: 'earth' });
      });
      const before = await page.evaluate(() => camera?.position?.z);
      await page.click('#aci-handsfree');
      await page.waitForTimeout(2000);
      const r = await page.evaluate((z0) => ({
        camZ: camera?.position?.z,
        camDelta: Math.abs((camera?.position?.z || 0) - (z0 || 0)),
        expanded: !document.getElementById('globe-deck')?.classList.contains('collapsed')
          || document.getElementById('globe-deck')?.classList.contains('size-third')
          || document.getElementById('globe-deck')?.classList.contains('size-free'),
        ribbon: document.getElementById('cli-ribbon-status')?.textContent || '',
        preview: document.getElementById('globe-deck-preview')?.textContent || '',
        placeholder: document.getElementById('aci-cli-in')?.placeholder || '',
        handsFree: !!window._handsFreeVoice,
      }), before);
      if (r.camDelta > 0.35) throw new Error('🎧 changed zoom: ' + JSON.stringify(r));
      const blob = (r.ribbon + r.preview + r.placeholder).toLowerCase();
      if (!/grok|listen|type|coders|ai|speak|ready/.test(blob) && !r.handsFree) {
        throw new Error('🎧 did not open AI UI: ' + JSON.stringify(r));
      }
      return r;
    },
  },
  {
    name: 'live click — 🎯 Locate visible in toolbar',
    run: async (page) => {
      const r = await page.evaluate(() => {
        const el = document.getElementById('aci-locate');
        if (!el) return { ok: false, reason: 'missing' };
        const st = getComputedStyle(el);
        return {
          ok: st.display !== 'none' && st.visibility !== 'hidden' && !el.hidden,
          display: st.display,
          hidden: el.hidden,
        };
      });
      if (!r.ok) throw new Error('🎯 Locate not visible: ' + JSON.stringify(r));
      return r;
    },
  },
];

async function main() {
  console.log('Production E2E →', URL);
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    geolocation: { latitude: 36.44, longitude: 28.22 },
    permissions: ['geolocation'],
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  page.on('pageerror', e => console.warn('PAGE ERROR:', e.message));

  await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 90000 });

  let failed = 0;
  for (const sc of SCENARIOS) {
    try {
      const data = await sc.run(page);
      console.log('✓', sc.name, JSON.stringify(data));
    } catch (e) {
      console.error('✗', sc.name, e.message);
      failed++;
    }
  }

  await browser.close();
  console.log('\n---', SCENARIOS.length - failed + '/' + SCENARIOS.length, 'prod e2e passed ---');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });