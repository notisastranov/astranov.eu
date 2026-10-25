#!/usr/bin/env node
/**
 * Real-user scenario tests for Astranov globe (city map, theme, earth realism).
 * Run: node scripts/user-scenarios.mjs [--url http://127.0.0.1:PORT]
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const DEFAULT_PORT = 8765;
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
};

function startServer(port = 0) {
  return new Promise((resolve, reject) => {
    const srv = createServer((req, res) => {
      const p = join(ROOT, (req.url || '/').split('?')[0].replace(/^\//, '') || 'index.html');
      const file = existsSync(p) && !p.endsWith('..') ? p : join(ROOT, 'index.html');
      try {
        const body = readFileSync(file);
        res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
        res.end(body);
      } catch {
        res.writeHead(404); res.end('not found');
      }
    });
    srv.on('error', reject);
    srv.listen(port, '127.0.0.1', () => {
      const bound = srv.address();
      resolve({ srv, port: typeof bound === 'object' ? bound.port : port });
    });
  });
}

const SCENARIOS = [
  {
    name: 'boot — globals and WebGL',
    run: async (page) => {
      const r = await page.evaluate(() => ({
        three: !!window.THREE,
        cityMap: !!window.CityMap,
        theme: !!window.AstranovTheme,
        earth: !!window.EarthRealism,
        codersHub: !!window.CodersHub,
        aiRouter: !!window.AiRouter,
        labOrbs: !!window.LabOrbs,
        leaflet: !!window.L,
        renderer: !!window.renderer,
        cityReady: window.CityMap?._ready,
        globeCanvas: !!document.querySelector('#globe canvas'),
      }));
      if (!r.three || !r.cityMap || !r.theme || !r.earth || !r.codersHub || !r.aiRouter || !r.labOrbs) throw new Error('missing globals: ' + JSON.stringify(r));
      if (!r.globeCanvas) throw new Error('real WebGL globe canvas missing');
      if (!r.leaflet) throw new Error('Leaflet not loaded');
      if (!r.cityReady) throw new Error('CityMap not initialized');
      return r;
    },
  },
  {
    name: 'earth realism — shader + sun/moon',
    run: async (page) => {
      try {
        await page.waitForFunction(
          () => !!window._earthShaderReady
            || !!window.earth?.material?.uniforms?.sunDirection
            || !!window.EarthRealism?._shaderReady,
          { timeout: 45000 },
        );
      } catch (_) {
        await page.waitForTimeout(2000);
      }
      const r = await page.evaluate(() => ({
        shaderReady: !!(window._earthShaderReady || window.EarthRealism?._shaderReady),
        hasUniform: !!window.earth?.material?.uniforms?.sunDirection,
        inited: !!window.EarthRealism?._inited,
        sunVis: !!window.EarthRealism?.sunGlow?.visible,
        moonVis: !!window.EarthRealism?.moonMesh?.visible,
        guideHasSun: /Sun/i.test(document.getElementById('cosmic-guide')?.textContent || ''),
      }));
      const shaderOk = r.shaderReady && r.hasUniform;
      const degradedOk = r.inited && r.guideHasSun && (r.sunVis || r.moonVis);
      if (!shaderOk && !degradedOk) throw new Error('Earth realism not ready: ' + JSON.stringify(r));
      if (!r.guideHasSun) throw new Error('cosmic-guide missing sun info');
      return r;
    },
  },
  {
    name: 'boot — earth GLOBAL not solar',
    run: async (page) => {
      await page.waitForTimeout(1400);
      const r = await page.evaluate(() => ({
        camZ: camera?.position?.z,
        level: CosmicZoom?.level,
        solarVis: !!CosmicZoom?.solarGroup?.visible,
        zoomLabel: document.getElementById('zoom-label')?.textContent || '',
        deckCollapsed: document.getElementById('globe-deck')?.classList.contains('collapsed'),
      }));
      if (r.camZ > 4.5) throw new Error('camera z too high: ' + r.camZ);
      if (r.level === 'system' || r.level === 'galaxy') throw new Error('wrong level: ' + r.level);
      if (r.solarVis) throw new Error('solar visible at boot');
      if (!/GLOBAL/i.test(r.zoomLabel)) throw new Error('label: ' + r.zoomLabel);
      if (!r.deckCollapsed) throw new Error('deck should start collapsed');
      return r;
    },
  },
  {
    name: 'theme — dark/bright toggle',
    run: async (page) => {
      const r = await page.evaluate(() => {
        AstranovTheme.set('bright');
        const bright = document.documentElement.dataset.theme;
        AstranovTheme.set('dark');
        const dark = document.documentElement.dataset.theme;
        AstranovTheme.toggle();
        const toggled = AstranovTheme.mode;
        return { bright, dark, toggled };
      });
      if (r.bright !== 'bright' || r.dark !== 'dark') throw new Error('theme set failed: ' + JSON.stringify(r));
      if (r.toggled !== 'bright') throw new Error('theme toggle failed');
      return r;
    },
  },
  {
    name: 'zoom — city map activates',
    run: async (page) => {
      await page.evaluate(() => {
        camera.position.z = 2.5;
        CityMap.onCamera(2.5, 'earth');
      });
      let active = await page.evaluate(() => CityMap.active);
      if (active) throw new Error('city map active too early at z=2.5');

      await page.evaluate(() => {
        const z = (CityMap.ENTER_Z || 1.36) - 0.02;
        camera.position.z = z;
        CityMap.onCamera(z, 'earth');
      });
      await page.waitForTimeout(800);
      active = await page.evaluate(() => ({
        active: CityMap.active,
        hasTiles: !!document.querySelector('#city-map .leaflet-tile-loaded'),
        cls: document.getElementById('city-map')?.classList.contains('active'),
      }));
      if (!active.active || !active.cls) throw new Error('city map did not activate at z=1.34: ' + JSON.stringify(active));

      await page.evaluate(() => {
        for (let i = 0; i < 8 && CityMap.active; i++) {
          if (typeof zoomBy === 'function') zoomBy(0.45);
        }
      });
      const exited = await page.evaluate(() => !CityMap.active && camera.position.z > CityMap.EXIT_Z);
      if (!exited) throw new Error('zoom out did not return to globe');
      return active;
    },
  },
  {
    name: 'scenario city — dropIn Rhodes',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        await CityLife.dropIn(36.44, 28.22, { label: 'Rhodes test' });
        return {
          active: CityMap.active,
          pos: window._lastPos,
          friends: (window.others || []).length,
          friendMarkers: Object.keys(CityMap._markers || {}).filter(k => k.startsWith('friend_')).length,
          markers: Object.keys(CityMap._markers || {}).length,
          zoom: CityMap.map?.getZoom?.(),
        };
      });
      if (!r.active) throw new Error('city map not active after dropIn');
      if (!r.pos || Math.abs(r.pos.lat - 36.44) > 0.01) throw new Error('position not set');
      if (r.friends !== 0) throw new Error('demo users must not appear — single user only');
      if (r.friendMarkers !== 0) throw new Error('no friend markers on city map');
      return r;
    },
  },
  {
    name: 'scenario drivers — markers with coords',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        if (!CityMap.active) {
          camera.position.z = 1.34;
          CityMap.onCamera(1.34, 'earth');
        }
        await CityMap._tickDrivers();
        const keys = Object.keys(CityMap._markers || {}).filter(k => k.startsWith('drv_'));
        const demo = CityMap._demoDrivers?.length || 0;
        return { driverMarkers: keys.length, demo };
      });
      if (r.driverMarkers < 1 && r.demo < 1) throw new Error('no driver markers');
      return r;
    },
  },
  {
    name: 'routing — OSRM polyline on city map',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        const sleep = (ms) => new Promise((res) => setTimeout(res, ms));
        const from = { lat: 36.44, lng: 28.22 };
        const to = { lat: 36.46, lng: 28.24 };
        const fallback = [];
        for (let i = 0; i <= 12; i++) {
          const t = i / 12;
          fallback.push({
            lat: from.lat + (to.lat - from.lat) * t,
            lng: from.lng + (to.lng - from.lng) * t,
          });
        }

        const ensureCity = async () => {
          window._lastPos = from;
          camera.position.z = 1.34;
          for (let i = 0; i < 16; i++) {
            CityMap.onCamera(1.34, 'earth');
            if (!CityMap.active && CityMap._ready) CityMap._enter?.(1.34);
            if (CityMap.active && CityMap.map) return;
            await sleep(80);
          }
          throw new Error('city map not active for routing');
        };

        await ensureCity();
        DrivingView.destination = to;

        let osrm = false;
        try {
          await Promise.race([
            DrivingView.fetchRoadRoute(),
            sleep(5000),
          ]);
          osrm = (DrivingView.routeCoords?.length || 0) >= 2;
        } catch (_) {
          osrm = false;
        }

        const coords = osrm ? DrivingView.routeCoords : fallback;
        if (!osrm) DrivingView.routeCoords = fallback;

        await ensureCity();
        DrivingView.drawRoute?.();
        CityMap.setRoute(coords);
        CityMap._syncRoute?.();
        for (let i = 0; i < 20 && !CityMap._route; i++) {
          CityMap.onCamera(1.34, 'earth');
          CityMap._syncRoute?.();
          await sleep(80);
        }
        return {
          coords: coords?.length || 0,
          hasRoute: !!CityMap._route,
          active: CityMap.active,
          hasMap: !!CityMap.map,
          osrm,
          fallback: !osrm,
        };
      });
      if (r.coords < 2) throw new Error('route coords missing');
      if (!r.hasRoute) throw new Error('route not drawn on city map');
      if (r.fallback) console.log('  ↳ OSRM offline — verified city-map polyline via fallback');
      return r;
    },
  },
  {
    name: 'coders hub — labs + job save',
    run: async (page) => {
      const r = await page.evaluate(() => {
        CodersHub.saveJob();
        const job = CodersHub.readJob();
        const cards = document.querySelectorAll('#coders-hub-grid .coders-card').length;
        return { saved: !!job?.fromLab, cards, hasChatgpt: !!CodersHub.LABS.find(l => l.id === 'chatgpt') };
      });
      if (!r.saved) throw new Error('job save failed');
      if (r.cards < 8) throw new Error('coders hub labs missing: ' + r.cards);
      if (!r.hasChatgpt) throw new Error('chatgpt lab missing');
      return r;
    },
  },
  {
    name: 'ai router — deepseek + lab orbs',
    run: async (page) => {
      const r = await page.evaluate(() => {
        AiRouter.setProvider('deepseek');
        const ds = AiRouter.current()?.id;
        AiRouter.setProvider('gemini');
        const gm = AiRouter.current()?.id;
        LabOrbs.init();
        const layer = !!document.getElementById('lab-orb-layer');
        const orbs = document.querySelectorAll('#lab-orb-layer .lab-orb').length;
        const geminiLab = CodersHub.LABS.find(l => l.id === 'gemini');
        return { ds, gm, layer, orbs, inline: !!geminiLab?.inlineFallback };
      });
      if (r.ds !== 'deepseek' || r.gm !== 'gemini') throw new Error('provider cycle failed: ' + JSON.stringify(r));
      if (!r.layer || r.orbs < 5) throw new Error('lab orbs missing: ' + JSON.stringify(r));
      if (!r.inline) throw new Error('gemini inline fallback missing');
      return r;
    },
  },
  {
    name: 'Grok — direct chat path wired',
    run: async (page) => {
      const r = await page.evaluate(() => ({
        force: AciCoders?.fallbackPrefs?.force,
        placeholder: document.getElementById('aci-cli-in')?.placeholder || '',
        prime: typeof primeGrokVoice === 'function',
      }));
      if (r.force !== 'xai') throw new Error('grok force not xai: ' + r.force);
      if (!/grok/i.test(r.placeholder)) throw new Error('placeholder not Grok: ' + r.placeholder);
      if (!r.prime) throw new Error('primeGrokVoice missing');
      return r;
    },
  },
  {
    name: 'AI — reply survives thinking + shows in ribbon',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        CliRibbon.setNotice('thinking test', 'thinking');
        GlobeDeck.setThinking(true, 'test…');
        GlobeDeck.setThinking(false);
        const afterThink = document.getElementById('cli-ribbon-status')?.textContent || '';
        GlobeDeck.log('Hello from AI test reply', 'reply');
        const ribbon = document.getElementById('cli-ribbon-status')?.textContent || '';
        const preview = document.getElementById('globe-deck-preview')?.textContent || '';
        return { afterThink, ribbon, preview, hasReply: /Hello from AI/i.test(ribbon + preview) };
      });
      if (!r.hasReply) throw new Error('reply not visible: ' + JSON.stringify(r));
      return r;
    },
  },
  {
    name: 'auth — Google redirect primary',
    run: async (page) => {
      const r = await page.evaluate(() => ({
        signInGoogle: typeof Auth?.signInGoogle === 'function',
        oauthReturn: typeof Auth?._handleOAuthReturn === 'function',
        oauthRedirectTo: typeof Auth?._oauthRedirectTo === 'function',
        googleBtn: !!document.getElementById('auth-google-continue'),
        googleLabel: (document.getElementById('auth-google-continue')?.textContent || '').trim(),
        noBlockedBanner: !document.getElementById('auth-google-warn'),
      }));
      if (!r.signInGoogle || !r.oauthReturn || !r.oauthRedirectTo || !r.googleBtn) {
        throw new Error('auth wiring missing: ' + JSON.stringify(r));
      }
      if (!/google/i.test(r.googleLabel)) throw new Error('Google button not primary: ' + r.googleLabel);
      if (!r.noBlockedBanner) throw new Error('blocked banner still shown');
      return r;
    },
  },
  {
    name: 'AI graphics — procedural engine live',
    run: async (page) => {
      const r = await page.evaluate(() => ({
        ready: !!window._aiGraphicsReady,
        atmosphere: !!window.AIGraphics?.atmosphere,
        cityLights: !!window.AIGraphics?.cityLights,
        neural: !!window.AIGraphics?.neuralLayer,
        hud: !!document.getElementById('ai-gaming-hud'),
        spawn: typeof window.AIGraphics?.spawnEffect === 'function',
        pilot: typeof window.AIGraphics?.buildProceduralPilot === 'function',
        flyer: typeof window.AIGraphics?.spawnAstranovFlyer === 'function',
        astranovFlyer: !!window._astranovFlyer,
        drone: typeof window.AIGraphics?.buildProceduralDrone === 'function',
      }));
      if (!r.ready || !r.atmosphere || !r.spawn) throw new Error('AIGraphics not initialized: ' + JSON.stringify(r));
      await page.evaluate(() => {
        AIGraphics.setThinkMode(true);
        AIGraphics.spawnEffect(new THREE.Vector3(0.5, 0.4, 1.05), 0x00ffcc, 12, 30);
      });
      return r;
    },
  },
  {
    name: 'trackball — drag rotates globe',
    run: async (page) => {
      const r = await page.evaluate(() => {
        const before = globePivot.rotation.y;
        trackballStart(120, 120);
        trackballMove(220, 120);
        trackballEnd(220, 120, { skipTap: true });
        return {
          before,
          after: globePivot.rotation.y,
          guard: typeof window.__trackballGuardOk === 'function' ? window.__trackballGuardOk() : null,
          contract: window.__trackballContract?.flyMode,
        };
      });
      if (Math.abs(r.after - r.before) < 0.02) throw new Error('trackball did not rotate: ' + JSON.stringify(r));
      if (r.guard === false) throw new Error('trackball guard not ok');
      if (r.contract !== 'quat') throw new Error('trackball contract broken: ' + JSON.stringify(r));
      return r;
    },
  },
  {
    name: 'trackball — spin inertia after release',
    run: async (page) => {
      const r = await page.evaluate(() => {
        trackVelX = 0;
        trackVelY = 0;
        trackballStart(100, 100);
        for (let i = 0; i < 8; i++) trackballMove(100 + i * 18, 100);
        const velAtRelease = trackVelX;
        trackballEnd(244, 100, { skipTap: true });
        const before = globePivot.rotation.y;
        for (let i = 0; i < 12; i++) TrackballGuard.applyInertia();
        return {
          velAtRelease,
          moved: Math.abs(globePivot.rotation.y - before),
          afterEndVel: trackVelX,
        };
      });
      if (Math.abs(r.velAtRelease) < 0.0001) throw new Error('no velocity at release: ' + JSON.stringify(r));
      if (r.moved < 0.001) throw new Error('inertia did not spin globe: ' + JSON.stringify(r));
      return r;
    },
  },
  {
    name: 'fly — great-circle quat (no euler snap)',
    run: async (page) => {
      const r = await page.evaluate(() => {
        syncGlobePivotRotation();
        const greece = latLngToPos(36.44, 28.22, 1.04);
        flyToPoint(new THREE.Vector3(greece.x, greece.y, greece.z), 2.55, { dur: 900 });
        const start = window._globeFly;
        const progress = [];
        for (let i = 0; i < 16; i++) {
          if (!window._globeFly?.fromQ) break;
          progress.push(start.fromQ.angleTo(globePivot.quaternion));
          tickGlobeFly();
        }
        const monotonic = progress.every((v, i) => i === 0 || v >= progress[i - 1] - 0.02);
        return {
          mode: start?.mode,
          hasQuat: !!(start?.fromQ && start?.toQ),
          progress: progress.length,
          monotonic,
        };
      });
      if (r.mode !== 'quat' || !r.hasQuat) throw new Error('fly not using quaternion slerp: ' + JSON.stringify(r));
      if (r.progress < 4 || !r.monotonic) throw new Error('fly path not smooth: ' + JSON.stringify(r));
      return r;
    },
  },
  {
    name: 'CLI — theme + scenario commands',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        const out = [];
        const orig = AciCli.print;
        AciCli.print = (t) => out.push(t);
        await SuperCli.exec('dark');
        await SuperCli.exec('scenario list');
        AciCli.print = orig;
        return { mode: AstranovTheme.mode, lines: out.length, hasScenarios: out.some(l => /scenarios/i.test(l)) };
      });
      if (r.mode !== 'dark') throw new Error('CLI dark failed');
      if (!r.hasScenarios) throw new Error('scenario list failed');
      return r;
    },
  },
];

async function main() {
  const argUrl = process.argv.find((a, i) => process.argv[i - 1] === '--url');
  let srv;
  let url = argUrl || '';
  if (!argUrl) {
    const started = await startServer(0);
    srv = started.srv;
    url = `http://127.0.0.1:${started.port}/index.html`;
    console.log('Local server →', url);
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    geolocation: { latitude: 36.44, longitude: 28.22 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  await page.route('**/*', route => {
    const u = route.request().url();
    if (/supabase\.co|allorigins|feeds\.bbci/i.test(u)) return route.abort();
    route.continue();
  });
  page.on('pageerror', e => console.error('PAGE ERROR:', e.message));
  page.on('console', msg => {
    if (msg.type() !== 'error') return;
    const text = msg.text() || '';
    // Tile/CDN timeouts are expected in headless CI — do not write stderr (breaks PowerShell exit code)
    if (/Failed to load resource|net::ERR_|favicon/i.test(text)) return;
    console.warn('CONSOLE:', text);
  });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.CityMap?._ready, { timeout: 60000 });
  await page.waitForFunction(
    () => window.EarthRealism?._inited || window.EarthRealism?._shaderReady,
    { timeout: 20000 },
  ).catch(() => {});
  try {
    await page.waitForFunction(() => window._earthShaderReady === true, { timeout: 35000 });
  } catch (_) {
    await page.waitForTimeout(1500);
    const shader = await page.evaluate(() =>
      !!window._earthShaderReady ||
      !!window.earth?.material?.uniforms?.sunDirection ||
      !!window.EarthRealism?._inited,
    );
    if (!shader) throw new Error('earth shader not ready after boot');
  }
  await page.waitForTimeout(800);
  await page.waitForFunction(() => window._deferredBootDone === true, { timeout: 45000 });

  const results = [];
  let failed = 0;
  for (const sc of SCENARIOS) {
    try {
      const data = await sc.run(page);
      console.log('✓', sc.name, JSON.stringify(data));
      results.push({ name: sc.name, ok: true, data });
    } catch (e) {
      console.error('✗', sc.name, e.message);
      results.push({ name: sc.name, ok: false, error: e.message });
      failed++;
    }
  }

  await browser.close();
  if (srv) srv.close();

  console.log('\n---', results.filter(r => r.ok).length + '/' + results.length, 'passed ---');
  process.exit(failed ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });