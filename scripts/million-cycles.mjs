#!/usr/bin/env node
/**
 * High-volume scenario cycle runner.
 *
 * Usage:
 *   node scripts/million-cycles.mjs                    # 1 full matrix + 1000 stress cycles
 *   node scripts/million-cycles.mjs --cycles 3000000   # up to 3M (use --max-ms to cap wall time)
 *   node scripts/million-cycles.mjs --cycles 500 --quick
 *
 * Each cycle = one matrix scenario execution (re-cycled). Full matrix pass runs first.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, writeFileSync } from 'node:fs';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { MATRIX, STRESS_MATRIX, GROUPS } from './scenario-matrix.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json',
};

function arg(name, def) {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

const CYCLES = Math.max(1, parseInt(arg('--cycles', '1000'), 10) || 1000);
const MAX_MS = parseInt(arg('--max-ms', String(CYCLES > 100000 ? 3600000 : 600000)), 10);
const QUICK = process.argv.includes('--quick');
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

const rand = mulberry32(SEED);

async function bootPage(url) {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    geolocation: { latitude: 36.44, longitude: 28.22 },
    permissions: ['geolocation'],
  });
  const page = await context.newPage();
  page.setDefaultTimeout(QUICK ? 30000 : 90000);
  await page.route('**/*', route => {
    const u = route.request().url();
    if (/supabase\.co|allorigins|feeds\.bbci/i.test(u)) return route.abort();
    route.continue();
  });
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForFunction(() => window.CityMap?._ready, { timeout: 60000 });
  await page.waitForTimeout(QUICK ? 800 : 2500);
  await page.evaluate(() => {
    if (window.Commerce && !Commerce.vendors?.length) {
      Commerce.vendors = (Commerce.DEMO_VENDORS || []).map(v => ({ ...v }));
    }
  }).catch(() => {});
  return { browser, page };
}

async function main() {
  const started = await startServer(0);
  const url = `http://127.0.0.1:${started.port}/index.html`;
  const stressPool = STRESS_MATRIX.length ? STRESS_MATRIX : MATRIX;
  console.log(`Scenario matrix: ${MATRIX.length} unique paths · ${stressPool.length} fast stress paths · ${GROUPS.length} groups`);
  console.log(`Target cycles: ${CYCLES.toLocaleString()} · max wall ${(MAX_MS / 1000).toFixed(0)}s`);
  console.log('Local server →', url);

  const { browser, page } = await bootPage(url);
  const t0 = Date.now();
  const failures = new Map();
  const passes = { matrix: 0, stress: 0 };
  let total = 0;

  async function runScenario(sc, label) {
    try {
      await sc.run(page);
      return true;
    } catch (e) {
      const msg = e.message || String(e);
      failures.set(sc.id, { group: sc.group, error: msg, label });
      return false;
    }
  }

  // Phase 1 — every scenario once (mandatory coverage)
  console.log('\n── Phase 1: full matrix pass ──');
  for (const sc of MATRIX) {
    total++;
    const ok = await runScenario(sc, 'matrix');
    if (ok) {
      passes.matrix++;
      if (!QUICK) console.log(`✓ [matrix] ${sc.id}`);
    } else {
      console.error(`✗ [matrix] ${sc.id} (${sc.group}): ${failures.get(sc.id)?.error}`);
    }
  }

  const matrixFails = MATRIX.length - passes.matrix;
  if (matrixFails) {
    console.error(`\nMatrix failures: ${matrixFails} — fix before stress cycles`);
  } else {
    console.log(`\n✓ Matrix ${passes.matrix}/${MATRIX.length} green`);
  }

  // Phase 2 — stress cycles (repeat matrix with pseudo-random order)
  console.log('\n── Phase 2: stress cycles ──');
  const stressTarget = Math.max(0, CYCLES - MATRIX.length);
  let stress = 0;
  let lastLog = Date.now();

  while (stress < stressTarget && Date.now() - t0 < MAX_MS) {
    const idx = Math.floor(rand() * stressPool.length);
    const sc = stressPool[idx];
    total++;
    stress++;
    if (await runScenario(sc, 'stress')) passes.stress++;
    else if (failures.size <= 20) console.error(`✗ [stress#${stress}] ${sc.id}: ${failures.get(sc.id)?.error}`);

    if (stress % 500 === 0 || Date.now() - lastLog > 15000) {
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
      const rate = (total / (Date.now() - t0) * 1000).toFixed(0);
      console.log(`  … ${stress.toLocaleString()} / ${stressTarget.toLocaleString()} stress cycles · ${total.toLocaleString()} total · ${rate}/s · ${elapsed}s`);
      lastLog = Date.now();
    }
  }

  await browser.close();
  started.srv.close();

  const elapsed = Date.now() - t0;
  const passTotal = passes.matrix + passes.stress;
  const failCount = failures.size;
  const report = {
    at: new Date().toISOString(),
    matrixSize: MATRIX.length,
    groups: GROUPS,
    targetCycles: CYCLES,
    completedCycles: total,
    stressCycles: stress,
    passed: passTotal,
    failedUnique: failCount,
    elapsedMs: elapsed,
    cyclesPerSec: total / (elapsed / 1000),
    failures: [...failures.entries()].map(([id, v]) => ({ id, ...v })),
  };

  const reportPath = join(ROOT, 'test-cycles-report.json');
  writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\n═══ Cycle report ═══');
  console.log(`Completed: ${total.toLocaleString()} cycles in ${(elapsed / 1000).toFixed(1)}s (${report.cyclesPerSec.toFixed(0)}/s)`);
  console.log(`Passed: ${passTotal.toLocaleString()} · Unique failures: ${failCount}`);
  console.log(`Report: ${reportPath}`);

  if (failCount) {
    console.log('\nFailed scenarios:');
    report.failures.slice(0, 15).forEach(f => console.log(`  - ${f.id} [${f.group}]: ${f.error}`));
    process.exit(1);
  }
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });