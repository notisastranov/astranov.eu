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
  execSync('node scripts/verify.mjs', { cwd: ROOT, stdio: 'pipe' });
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const superCli = ['super-cli-bar', 'globe-deck-stage', 'SuperCli', 'superAction'];
  const missing = superCli.filter(m => !html.includes(m));
  if (missing.length) throw new Error('Super CLI missing: ' + missing.join(', '));
  return 'index.html OK · Super CLI present';
});

await check('live site has coders bridge', async () => {
  const r = await fetch(SITE + '/index.html');
  const html = await r.text();
  const markers = ['AciCoders', 'alwaysOn', 'startListening', 'observeActivity', 'super-cli-bar', 'SuperCli'];
  const missing = markers.filter(m => !html.includes(m));
  if (missing.length) throw new Error('missing: ' + missing.join(', '));
  return markers.length + ' markers present';
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