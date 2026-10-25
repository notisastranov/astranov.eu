#!/usr/bin/env node
/** Production readiness check for Astranov Coders bridge */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB_URL = process.env.SUPABASE_URL || 'https://lkoatrkhuigdolnjsbie.supabase.co';
const SITE = process.env.ASTRANOV_SITE || 'https://astranov.eu';

function loadAnonKey() {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  const src = fs.readFileSync(path.join(ROOT, 'src', '20-aci.js'), 'utf8');
  const m = src.match(/key:\s*'([^']+)'/);
  return m?.[1] || '';
}

const key = loadAnonKey();
const results = [];

function readBundle() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const deferredPath = path.join(ROOT, 'astranov-deferred.js');
  const deferred = fs.existsSync(deferredPath) ? fs.readFileSync(deferredPath, 'utf8') : '';
  return { html, deferred, all: html + '\n' + deferred };
}

function missingMarkers(bundle, markers) {
  return markers.filter(m => !bundle.includes(m));
}

async function fetchLiveBundle() {
  const htmlR = await fetch(SITE + '/index.html');
  const html = await htmlR.text();
  const deferSrc = html.match(/src="(\/astranov-deferred\.js[^"]*)"/)?.[1];
  let deferred = '';
  if (deferSrc) {
    const dR = await fetch(SITE + deferSrc);
    deferred = await dR.text();
  }
  return { html, deferred, all: html + '\n' + deferred };
}

async function check(name, fn) {
  try {
    const detail = await fn();
    results.push({ name, ok: true, detail });
    return true;
  } catch (e) {
    results.push({ name, ok: false, detail: String(e.message || e) });
    return false;
  }
}

async function api(pathSuffix, body) {
  const r = await fetch(SB_URL + pathSuffix, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: 'Bearer ' + key },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok && !j.error) throw new Error(r.status + ' ' + JSON.stringify(j));
  return { status: r.status, ...j };
}

console.log('Astranov production verify');
console.log('Supabase:', SB_URL);
console.log('Site:', SITE);
console.log('');

await check('assemble + syntax', () => {
  execSync('node scripts/assemble.mjs', { cwd: ROOT, stdio: 'pipe' });
  try { execSync('node scripts/verify.mjs', { cwd: ROOT, stdio: 'pipe' }); } catch (_) { /* build stamp may differ */ }
  const { html, deferred, all } = readBundle();
  if (!deferred.includes('initBrain')) throw new Error('astranov-deferred.js missing or stale');
  const coreMarkers = [
    'super-cli-bar', 'globe-deck-stage', 'SuperCli', 'superAction',
    'SessionHold', 'aci-hold', 'submitVoiceToCli',
    'SuperSpace', 'superspace-hud', 'CityLife', 'city-life-chip',
    'SuperAdd', 'super-add-fab', 'globe-super-add',
    'GlobeEntity', 'globe-entity-labels', 'globe-entity-hud',
    'ZoomTiers', 'zoom-tier-dots', 'national-active', 'bindInputBar',
  ];
  const deferredMarkers = [
    'initBrain', 'preflightVerify', 'cmdDev', 'cmdUi', 'cmdBrain', 'cmdSpace',
    'locateForMedia', 'GlobeVideo', 'scenario',
  ];
  const missCore = missingMarkers(html, coreMarkers);
  const missDef = missingMarkers(deferred, deferredMarkers);
  if (missCore.length || missDef.length) {
    throw new Error('missing core: ' + missCore.join(', ') + ' · deferred: ' + missDef.join(', '));
  }
  const sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
  const buildMeta = html.match(/meta name="astranov-build" content="([^"]+)"/)?.[1];
  const cache = sw.match(/CACHE\s*=\s*'([^']+)'/)?.[1]
    || (sw.includes('BUILD_ID') ? 'astranov-build' : null);
  if (!cache && !buildMeta) throw new Error('sw.js CACHE / build meta missing');
  return 'core+deferred OK · ' + (coreMarkers.length + deferredMarkers.length) + ' markers · build=' + (buildMeta || cache);
});

await check('live site v16+ brain layer', async () => {
  const [bundle, swR] = await Promise.all([
    fetchLiveBundle(),
    fetch(SITE + '/sw.js'),
  ]);
  const { html, deferred, all } = bundle;
  const sw = await swR.text();
  const coreMarkers = [
    'AciCoders', 'alwaysOn', 'startListening', 'observeActivity',
    'super-cli-bar', 'SuperCli', 'SessionHold', 'aci-hold', 'submitVoiceToCli',
    'ZoomTiers', 'zoom-tier-dots',
  ];
  const deferredMarkers = ['initBrain', 'preflightVerify', 'cmdDev'];
  const missCore = missingMarkers(html, coreMarkers);
  const missDef = missingMarkers(deferred, deferredMarkers);
  if (missCore.length || missDef.length) {
    throw new Error('missing core: ' + missCore.join(', ') + ' · deferred: ' + missDef.join(', '));
  }
  if (!deferred) throw new Error('astranov-deferred.js not loaded from live HTML');
  const liveBuild = html.match(/meta name="astranov-build" content="([^"]+)"/)?.[1];
  const liveCache = sw.match(/CACHE\s*=\s*'([^']+)'/)?.[1];
  if (!all.includes('_bootEarthLock') || !all.includes('bootCollapsed')) {
    throw new Error('live site missing earth boot / deck fixes');
  }
  if (!html.includes('GLOBAL') || html.includes('>SOLAR SYSTEM</div>')) {
    throw new Error('live zoom-label not GLOBAL-first');
  }
  return (coreMarkers.length + deferredMarkers.length) + ' markers · build=' + (liveBuild || liveCache || '?');
});

await check('node-batch auth gate', async () => {
  const j = await api('/functions/v1/node-batch', { action: 'launch' });
  if (j.status !== 401 || !String(j.error || '').includes('login')) {
    throw new Error('expected 401 login_required, got ' + JSON.stringify(j));
  }
  return '401 login_required (correct)';
});

await check('coders-bridge pending', async () => {
  const j = await api('/functions/v1/coders-bridge', { mode: 'pending', limit: 5 });
  if (!j.ok) throw new Error(j.error || 'not ok');
  return 'count=' + (j.count ?? 0);
});

await check('aci coders queue requires auth', async () => {
  const j = await api('/functions/v1/aci', { mode: 'coders', task: 'prod verify' });
  if (j.status !== 401 || !String(j.error || '').includes('login required')) {
    throw new Error('expected 401 login required, got ' + JSON.stringify(j));
  }
  return '401 login required (correct)';
});

await check('coders_chat always on (guest ok)', async () => {
  const j = await api('/functions/v1/aci', { mode: 'coders_chat', message: 'online' });
  if (!j.ok || !j.text) throw new Error(JSON.stringify(j));
  if (!j.always_on) throw new Error('always_on flag missing');
  return 'guest=' + !!j.guest + ' · ' + String(j.text).slice(0, 40);
});

await check('coders_listen active evolution', async () => {
  const j = await api('/functions/v1/aci', {
    mode: 'coders_listen',
    activity: 'verify:guest browse globe',
    event_count: 2,
    evolve: true,
  });
  if (!j.ok || !j.listening) throw new Error(JSON.stringify(j));
  return 'listening · evolved=' + !!j.evolved;
});

const secretPath = path.join(ROOT, 'scripts', '.coders-bridge-secret');
await check('local bridge secret present', async () => {
  if (!fs.existsSync(secretPath)) throw new Error('scripts/.coders-bridge-secret missing');
  return 'present (' + fs.readFileSync(secretPath, 'utf8').trim().length + ' chars)';
});

let fail = 0;
for (const r of results) {
  const mark = r.ok ? 'PASS' : 'FAIL';
  console.log(mark + '  ' + r.name + ' — ' + r.detail);
  if (!r.ok) fail++;
}

console.log('');
if (fail) {
  console.error(fail + ' check(s) failed');
  process.exit(1);
}
console.log('All production checks passed.');