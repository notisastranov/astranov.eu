#!/usr/bin/env node
/** live-check against any origin (default astranov.eu) */
const origin = (process.argv[2] || 'https://astranov.eu').replace(/\/$/, '');
const MUST = [
  [`${origin}/`, (t) => t.includes('__ASTRANOV_MANIFEST__') && t.includes('loader')],
  [`${origin}/js/loader.js`, (t) => t.includes('AstranovLoader') || t.includes('loadPhaseSmart') || t.includes('RESCUE')],
  [`${origin}/js/phase-critical.js`, (t) => t.includes('WebGLRenderer') || t.includes('__astranovBootCritical')],
  [`${origin}/js/phase-app.js`, (t) => t.length > 50000],
  [`${origin}/js/phase-features.js`, (t) => t.length > 50000],
  [`${origin}/astranov-deferred.js`, (t) => t.length > 10000],
];
let dead = 0;
for (const [u, ok] of MUST) {
  try {
    const r = await fetch(u, { cache: 'no-store' });
    const t = await r.text();
    const pass = r.status === 200 && ok(t);
    if (!pass) dead++;
    console.log(pass ? 'OK  ' : 'DEAD', r.status, String(t.length).padStart(8), u.replace(origin, ''));
  } catch (e) {
    dead++;
    console.log('ERR ', u, e.message);
  }
}
const html = await (await fetch(origin + '/', { cache: 'no-store' })).text();
const build = html.match(/astranov-build" content="([^"]+)/)?.[1];
let man;
try { man = JSON.parse(html.match(/__ASTRANOV_MANIFEST__=(\{.*?\});/)?.[1] || 'null'); } catch {}
console.log('\nORIGIN', origin);
console.log('BUILD', build || 'none');
console.log('MODE', man?.mode || 'none');
console.log('CRITICAL', man?.critical || []);
// Probe first critical path
const c = man?.critical?.[0];
if (c) {
  const u = c.startsWith('http') ? c : origin + (c.startsWith('/') ? c : '/' + c);
  const r = await fetch(u, { cache: 'no-store' });
  const t = await r.text();
  const good = r.status === 200 && (t.includes('WebGL') || t.includes('Boot') || t.length > 5000);
  console.log('critical fetch', r.status, t.length, c, good ? 'GOOD' : 'BAD');
  if (!good) dead++;
}
if (dead) {
  console.error('\nFAILED · dead=' + dead);
  process.exit(1);
}
console.log('\nPASSED');
process.exit(0);
