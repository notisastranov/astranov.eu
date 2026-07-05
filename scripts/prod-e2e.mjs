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
      const r = await page.evaluate(async () => {
        AciCoders.history = [];
        const res = await AiRouter.ask('ping prod verify', { timeoutMs: 22000 });
        const text = String(res.text || '').trim();
        if (!text || /gathering itself|warming up|no model responded/i.test(text)) {
          return { ok: false, error: res.error || text || 'empty' };
        }
        await AciCoders.chat('prod verify hello', { forceTest: true });
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
      });
      if (!r.ok) throw new Error('ai-router failed: ' + (r.error || 'unknown'));
      if (r.hist < 1 && !r.ribbon && !r.preview) throw new Error('no visible AI reply: ' + JSON.stringify(r));
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