#!/usr/bin/env node
/**
 * High-volume scenario cycle runner.
 *
 * Usage:
 *   node scripts/million-cycles.mjs --cycles 3000000 --turbo --workers 4
 *   node scripts/million-cycles.mjs --continue --cycles 3000000 --turbo
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATRIX, STRESS_MATRIX, GROUPS, STRESS_IDS } from './scenario-matrix.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json',
};

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const CONTINUE = process.argv.includes('--continue');
const PREV = CONTINUE && existsSync(join(ROOT, 'test-cycles-report.json'))
  ? JSON.parse(readFileSync(join(ROOT, 'test-cycles-report.json'), 'utf8'))
  : null;

const CYCLES = Math.max(1, parseInt(arg('--cycles', '1000'), 10) || 1000);
const MAX_MS = parseInt(arg('--max-ms', String(CYCLES > 100000 ? 3600000 : 600000)), 10);
const QUICK = process.argv.includes('--quick') || process.argv.includes('--turbo');
const TURBO = process.argv.includes('--turbo');
const WORKERS = Math.max(1, Math.min(8, parseInt(arg('--workers', TURBO ? '4' : '1'), 10) || 1));
const BRAIN_EVERY = parseInt(arg('--brain-every', TURBO ? '2000' : '1000'), 10) || 1000;
const SEED = parseInt(arg('--seed', '42'), 10);

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

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

async function bootPage(browser, url) {
  const context = await browser.newContext({
    geolocation: { latitude: 36.44, longitude: 28.22 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(QUICK ? 25000 : 90000);
  await page.route('**/*', route => {
    const u = route.request().url();
    if (/supabase\.co|allorigins|feeds\.bbci/i.test(u)) return route.abort();
    route.continue();
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.CityMap?._ready, { timeout: 60000 });
  if (!TURBO) await page.waitForTimeout(QUICK ? 800 : 2500);
  await page.evaluate(() => {
    if (window.Commerce && !Commerce.vendors?.length) {
      Commerce.vendors = (Commerce.DEMO_VENDORS || []).map(v => ({ ...v }));
    }
  }).catch(() => {});
  return { context, page };
}

async function main() {
  const started = await startServer(0);
  const url = `http://127.0.0.1:${started.port}/index.html`;
  const stressPool = STRESS_MATRIX.length ? STRESS_MATRIX : MATRIX;
  const prevCycles = PREV?.completedCycles || 0;
  const prevBrain = PREV?.brain || {};

  console.log(`Scenario matrix: ${MATRIX.length} unique paths · ${stressPool.length} fast stress paths · ${GROUPS.length} groups`);
  console.log(`Target cycles: ${CYCLES.toLocaleString()} · workers ${WORKERS} · max wall ${(MAX_MS / 1000).toFixed(0)}s`);
  if (CONTINUE && prevCycles) console.log(`Continue from prior: ${prevCycles.toLocaleString()} cycles · brain maturity ${prevBrain.maturity ?? 0}`);
  console.log('Local server →', url);

  const browser = await chromium.launch({ headless: true });
  const { page: matrixPage, context: matrixCtx } = await bootPage(browser, url);
  const t0 = Date.now();
  const failures = new Map();
  const passes = { matrix: 0, stress: 0 };
  let total = 0;
  const shared = { stress: 0, stop: false };

  async function runScenario(page, sc, label) {
    const timeout = TURBO ? 12000 : 45000;
    try {
      await Promise.race([
        sc.run(page),
        new Promise((_, rej) => setTimeout(() => rej(new Error('scenario timeout')), timeout)),
      ]);
      return true;
    } catch (e) {
      const msg = e.message || String(e);
      if (!failures.has(sc.id)) failures.set(sc.id, { group: sc.group, error: msg, label });
      return false;
    }
  }

  const phase1 = TURBO ? MATRIX.filter(m => STRESS_IDS.has(m.id)) : MATRIX;
  console.log(`\n── Phase 1: matrix pass (${phase1.length}${TURBO ? ' fast' : ''}) ──`);
  for (const sc of phase1) {
    total++;
    const ok = await runScenario(matrixPage, sc, 'matrix');
    if (ok) passes.matrix++;
    else console.error(`✗ [matrix] ${sc.id} (${sc.group}): ${failures.get(sc.id)?.error}`);
  }

  if (passes.matrix < phase1.length) {
    console.error(`\nMatrix failures: ${phase1.length - passes.matrix}`);
  } else {
    console.log(`\n✓ Matrix ${passes.matrix}/${phase1.length} green`);
  }

  const stressTarget = Math.max(0, CYCLES - phase1.length);
  console.log(`\n── Phase 2: stress cycles (${WORKERS} workers) ──`);

  async function stressWorker(workerId) {
    const rnd = mulberry32(SEED + workerId * 997);
    const { page, context } = await bootPage(browser, url);
    let localPass = 0;
    try {
      while (!shared.stop) {
        if (shared.stress >= stressTarget || Date.now() - t0 >= MAX_MS) break;
        const idx = Math.floor(rnd() * stressPool.length);
        const sc = stressPool[idx];
        shared.stress++;
        total++;
        if (await runScenario(page, sc, 'stress')) {
          passes.stress++;
          localPass++;
        }
      }
    } finally {
      await context.close().catch(() => {});
    }
    return localPass;
  }

  const logTimer = setInterval(() => {
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    const rate = total > 0 ? (total / (Date.now() - t0) * 1000).toFixed(0) : '0';
    console.log(`  … ${shared.stress.toLocaleString()} / ${stressTarget.toLocaleString()} stress · ${total.toLocaleString()} total · ${rate}/s · ${elapsed}s`);
  }, TURBO ? 20000 : 15000);

  shared.stop = false;
  await Promise.all(Array.from({ length: WORKERS }, (_, w) => stressWorker(w)));
  clearInterval(logTimer);
  shared.stop = true;

  const brainBatch = Math.min(5000, Math.floor(passes.stress / BRAIN_EVERY));
  let brainState = { maturity: prevBrain.maturity || 0, learns: prevBrain.learns || 0, neurons: prevBrain.neurons || 0 };
  try {
    const stressSamples = stressPool.slice(0, 43).map(s => ({ id: s.id, group: s.group }));
    brainState = await matrixPage.evaluate(({ batch, prevM, prevL, samples }) => {
      if (prevM) BrainConversation.MATURITY = prevM;
      if (prevL) BrainConversation.CYCLE_LEARNS = prevL;
      for (let i = 0; i < batch; i++) {
        const sc = samples[i % samples.length] || { id: 'stress', group: 'boot' };
        BrainConversation.learnFromScenario(sc.id, sc.group);
      }
      return {
        maturity: BrainConversation.MATURITY,
        learns: BrainConversation.CYCLE_LEARNS,
        tier: BrainConversation.maturityTier?.() || 'adult',
        neurons: ACI?.neurons?.length ?? 0,
        batch,
      };
    }, { batch: brainBatch, prevM: prevBrain.maturity, prevL: prevBrain.learns, samples: stressSamples });
  } catch (_) { /* */ }

  await matrixCtx.close();
  await browser.close();
  started.srv.close();

  const elapsed = Date.now() - t0;
  const passTotal = passes.matrix + passes.stress;
  const cumulative = prevCycles + total;
  const report = {
    at: new Date().toISOString(),
    matrixSize: MATRIX.length,
    groups: GROUPS,
    targetCycles: CYCLES,
    completedCycles: total,
    cumulativeCycles: cumulative,
    stressCycles: shared.stress,
    workers: WORKERS,
    passed: passTotal,
    failedUnique: failures.size,
    elapsedMs: elapsed,
    cyclesPerSec: total / (elapsed / 1000),
    failures: [...failures.entries()].map(([id, v]) => ({ id, ...v })),
    brain: brainState,
    continuedFrom: CONTINUE ? prevCycles : 0,
  };

  const reportPath = join(ROOT, 'test-cycles-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n═══ Cycle report ═══');
  console.log(`Completed: ${total.toLocaleString()} cycles in ${(elapsed / 1000).toFixed(1)}s (${report.cyclesPerSec.toFixed(0)}/s)`);
  console.log(`Cumulative: ${cumulative.toLocaleString()} · Passed: ${passTotal.toLocaleString()} · Unique failures: ${failures.size}`);
  if (brainState.maturity != null) {
    console.log(`Brain: tier ${brainState.tier || '?'} · maturity ${Number(brainState.maturity).toFixed(3)} · learns ${brainState.learns} · neurons ${brainState.neurons}`);
  }
  console.log(`Report: ${reportPath}`);

  if (failures.size) {
    report.failures.slice(0, 15).forEach(f => console.log(`  - ${f.id} [${f.group}]: ${f.error}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });