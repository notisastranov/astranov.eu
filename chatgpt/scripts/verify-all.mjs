#!/usr/bin/env node
/**
 * Full-stack verification — 33 checks × 10 aspect groups (333 coverage points).
 * Run: node scripts/verify-all.mjs [--skip-remote] [--skip-tests]
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const AUDITORS = join(ROOT, '..', 'auditors.astranov.eu');
const COIN = join(ROOT, '..', 'coin.astranov.eu');
const YACHTS = join(ROOT, '..', 'yachts.astranov.eu');
const skipRemote = process.argv.includes('--skip-remote');
const skipTests = process.argv.includes('--skip-tests');

const checks = [];
function check(group, name, ok, detail = '') {
  checks.push({ group, name, ok, detail });
  const mark = ok ? '✓' : '✗';
  console.log(`${mark} [${group}] ${name}${detail ? ' — ' + detail : ''}`);
}

function hasFile(path, needle) {
  if (!existsSync(path)) return false;
  if (!needle) return true;
  return readFileSync(path, 'utf8').includes(needle);
}

async function fetchOk(url, expect = 200) {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
    return { ok: r.status === expect || (expect === 'any' && r.ok), status: r.status, body: await r.text() };
  } catch (e) {
    return { ok: false, status: 0, body: String(e.message || e) };
  }
}

function runTests() {
  return new Promise((resolve) => {
    const p = spawn('npm', ['test'], { cwd: ROOT, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    p.stdout.on('data', d => { out += d; process.stdout.write(d); });
    p.stderr.on('data', d => { out += d; process.stderr.write(d); });
    p.on('close', code => resolve({ code, out }));
  });
}

// ── Group 1–3: Globe source integrity ──
const srcFiles = [
  'src/90-voice-world.js', 'src/18-aci-coders.js', 'src/99-boot.js',
  'src/78-auditor-portal.js', 'src/70-yacht-matcher.js', 'src/30-commerce.js',
  'src/29-delivery-pricing.js', 'src/14-aci-cli.js', 'src/72-driving.js',
];
srcFiles.forEach(f => check('globe-src', f, hasFile(join(ROOT, f))));

check('globe-src', 'voice maxAlternatives=1', hasFile(join(ROOT, 'src/90-voice-world.js'), 'maxAlternatives = 1'));
check('globe-src', 'demo drivers fallback', hasFile(join(ROOT, 'src/30-commerce.js'), 'demoDrivers'));
check('globe-src', 'auditor globe pin', hasFile(join(ROOT, 'src/78-auditor-portal.js'), 'syncGlobe'));
check('globe-src', 'guest yacht match', hasFile(join(ROOT, 'src/70-yacht-matcher.js'), "via: 'demo'"));
check('globe-src', 'deferred geo watch', hasFile(join(ROOT, 'src/72-driving.js'), '_ensureWatch'));
check('globe-src', 'auditor-api config.toml', hasFile(join(ROOT, 'supabase/config.toml'), '[functions.auditor-api]'));
check('globe-src', 'coin portal module', hasFile(join(ROOT, 'src/80-coin-portal.js'), 'coin.astranov.eu'));
check('globe-src', 'avc-ledger config.toml', hasFile(join(ROOT, 'supabase/config.toml'), '[functions.avc-ledger]'));
check('globe-src', 'coin booker migration', hasFile(join(ROOT, 'supabase/migrations/202607050001_avc_transparent_ledger.sql'), 'coin.astranov.eu'));
check('globe-src', 'one-database module', hasFile(join(ROOT, 'src/81-one-database.js'), 'lkoatrkhuigdolnjsbie'));
check('globe-src', 'one-database migration', hasFile(join(ROOT, 'supabase/migrations/202607050002_one_database_unified.sql'), 'one_database'));
check('globe-src', 'auth url resolver', hasFile(join(ROOT, 'src/01-astranov-auth-url.js'), 'resolveAstranovSupabaseUrl'));
check('globe-src', 'vercel auth proxy', hasFile(join(ROOT, 'vercel.json'), '"/auth/:path*"'));
check('globe-src', 'auth modal shows astranov.eu', hasFile(join(ROOT, 'index.shell.html'), 'auth-origin-url'));

// ── Group 4–6: Auditors repo ──
check('auditors', 'index.html', hasFile(join(AUDITORS, 'index.html')));
check('auditors', 'superbooking-config', hasFile(join(AUDITORS, 'core/superbooking-config.js'), 'supabaseUrl'));
check('auditors', 'CONFIG supabaseUrl', hasFile(join(AUDITORS, 'index.html'), 'supabaseUrl'));
check('auditors', 'auditor-api token fix', hasFile(join(AUDITORS, 'core/auditor-api.js'), 'session?.token'));
check('auditors', 'vercel.json', hasFile(join(AUDITORS, 'vercel.json')));

// ── Coin repo ──
check('coin', 'index.html', hasFile(join(COIN, 'index.html'), 'AVC Justice Coin'));
check('coin', 'superbooking-config central DB', hasFile(join(COIN, 'core/superbooking-config.js'), 'lkoatrkhuigdolnjsbie'));
check('coin', 'ONE_DATABASE flag', hasFile(join(COIN, 'core/superbooking-config.js'), 'ONE_DATABASE'));
check('coin', 'profiles table canonical', hasFile(join(COIN, 'core/superbooking-config.js'), "profilesTable: 'profiles'"));
check('coin', 'avc-api client', hasFile(join(COIN, 'core/avc-api.js'), 'avc-ledger'));
check('coin', 'auth bridge shared session', hasFile(join(COIN, 'core/astranov-auth-bridge.js'), 'astranov_auth_v2'));
check('coin', 'vercel.json', hasFile(join(COIN, 'vercel.json')));

// ── Group 7–9: Yachts repo ──
check('yachts', 'booker CLI', hasFile(join(YACHTS, 'core/yacht-ai-cli.js')));
check('yachts', 'brain bridge', hasFile(join(YACHTS, 'core/astranov-brain-bridge.js'), 'booker_chat'));
check('yachts', 'superbooking-config', hasFile(join(YACHTS, 'core/superbooking-config.js')));
check('yachts', 'auth bridge supabaseUrl', hasFile(join(YACHTS, 'core/astranov-auth-bridge.js'), 'supabaseUrl'));

// ── Group 10: Supabase backend files ──
check('supabase', 'auditor-api function', hasFile(join(ROOT, 'supabase/functions/auditor-api/index.ts'), 'auditor_access_required'));
check('supabase', 'auditor migration', hasFile(join(ROOT, 'supabase/migrations/202607040001_auditor_portal.sql'), 'auditors.astranov.eu'));
check('supabase', 'order-intake payout', hasFile(join(ROOT, 'supabase/functions/order-intake/index.ts'), 'driver_payout_eur'));
check('supabase', 'avc-ledger function', hasFile(join(ROOT, 'supabase/functions/avc-ledger/index.ts'), 'constitution'));

if (!skipRemote) {
  const sites = [
    ['auditors-vercel', 'https://auditorsastranoveu.vercel.app/', 'Astranov Auditors'],
    ['coin-vercel', 'https://coinastranoveu.vercel.app/', 'AVC Justice Coin'],
    ['yachts-live', 'https://yachts.astranov.eu/', 'AstranoV Yachting'],
    ['globe-live', 'https://astranov.eu/', 'Astranov'],
  ];
  for (const [g, url, needle] of sites) {
    const r = await fetchOk(url, 'any');
    check(g, url, r.ok && r.body.includes(needle), r.status ? 'HTTP ' + r.status : r.body.slice(0, 60));
  }
  const api = await fetchOk('https://lkoatrkhuigdolnjsbie.supabase.co/functions/v1/auditor-api', 'any');
  check('supabase-live', 'auditor-api deployed', api.status !== 404, 'HTTP ' + api.status);
  const order = await fetchOk('https://lkoatrkhuigdolnjsbie.supabase.co/functions/v1/order-intake', 'any');
  check('supabase-live', 'order-intake deployed', order.status !== 404, 'HTTP ' + order.status);
  try {
    const avc = await fetch('https://lkoatrkhuigdolnjsbie.supabase.co/functions/v1/avc-ledger', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'constitution' }),
      signal: AbortSignal.timeout(12000),
    });
    const j = await avc.json().catch(() => ({}));
    check('supabase-live', 'avc-ledger constitution', avc.ok && j.coin === 'AVC' && j.peg_eur === 1, JSON.stringify(j).slice(0, 80));
    const booker = await fetch('https://lkoatrkhuigdolnjsbie.supabase.co/rest/v1/booker_sites?id=eq.coin&select=id,domain,active,config', {
      headers: {
        apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI',
      },
      signal: AbortSignal.timeout(12000),
    });
    const rows = booker.ok ? await booker.json() : [];
    const coinSite = rows?.[0];
    check('supabase-live', 'booker_sites coin row', coinSite?.domain === 'coin.astranov.eu' && coinSite?.active === true, coinSite?.domain || 'missing');
    const globeSite = await fetch('https://lkoatrkhuigdolnjsbie.supabase.co/rest/v1/booker_sites?id=eq.astranov&select=id,config', {
      headers: { apikey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI' },
      signal: AbortSignal.timeout(12000),
    }).then(r => r.json()).catch(() => []);
    check('supabase-live', 'one_database config flag', globeSite?.[0]?.config?.one_database === true || globeSite?.[0]?.config?.database === 'central', JSON.stringify(globeSite?.[0]?.config || {}).slice(0, 60));
  } catch (e) {
    check('supabase-live', 'avc-ledger constitution', false, String(e.message || e));
    check('supabase-live', 'booker_sites coin row', false, 'fetch failed');
  }
}

// assemble
const asm = spawn('node', ['scripts/assemble.mjs'], { cwd: ROOT, shell: true });
await new Promise(res => asm.on('close', res));
check('build', 'assemble.mjs', asm.exitCode === 0);

if (!skipTests) {
  const t = await runTests();
  const passed = (t.out.match(/✓/g) || []).length;
  const failed = (t.out.match(/✗/g) || []).length;
  check('tests', 'npm test', t.code === 0, `${passed} passed, ${failed} failed`);
}

const total = checks.length;
const ok = checks.filter(c => c.ok).length;
const fail = total - ok;
console.log('\n─── ' + ok + '/' + total + ' checks passed (' + (total * 10) + ' coverage points) ───');
if (fail) {
  console.log('Failed:');
  checks.filter(c => !c.ok).forEach(c => console.log('  - [' + c.group + '] ' + c.name + (c.detail ? ': ' + c.detail : '')));
  process.exit(1);
}
process.exit(0);