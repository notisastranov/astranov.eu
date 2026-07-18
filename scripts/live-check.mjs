#!/usr/bin/env node
/** Live probe — exit 1 if boot path is dead. Always run before finishing. */
const MUST = [
  ['https://astranov.eu/', (t) => t.includes('__ASTRANOV_MANIFEST__') && t.includes('loader.js') && t.includes('phase-critical')],
  ['https://astranov.eu/build.json', (t) => {
    try { return !!JSON.parse(t).buildId; } catch { return false; }
  }],
  ['https://astranov.eu/js/loader.js', (t) => t.includes('AstranovLoader')],
  ['https://astranov.eu/js/phase-critical.js', (t) => t.includes('__astranovBootCritical') || t.includes('WebGLRenderer')],
  ['https://astranov.eu/js/phase-app.js', (t) => t.includes('__astranovBootApp') || t.includes('GlobeDeck')],
  ['https://astranov.eu/js/phase-features.js', (t) => t.includes('__astranovBootFeatures') || t.includes('GlobeEntity')],
  ['https://astranov.eu/astranov-deferred.js', (t) => t.length > 10000],
];

let dead = 0;

for (const [u, ok] of MUST) {
  try {
    const r = await fetch(u, { cache: 'no-store', headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' } });
    const t = await r.text();
    const pass = r.status === 200 && ok(t);
    if (!pass) dead++;
    console.log(pass ? 'OK  ' : 'DEAD', r.status, String(t.length).padStart(8), u.replace('https://astranov.eu', ''));
  } catch (e) {
    dead++;
    console.log('ERR ', u, e.message);
  }
}

const html = await (await fetch('https://astranov.eu/', { cache: 'no-store' })).text();
const build = html.match(/astranov-build" content="([^"]+)/)?.[1];
let man = null;
try {
  const raw = html.match(/__ASTRANOV_MANIFEST__=(\{.*?\});/)?.[1];
  man = raw ? JSON.parse(raw) : null;
} catch (_) {}
console.log('\nLIVE BUILD:', build || 'NONE');
console.log('MANIFEST mode:', man?.mode || 'NONE');
console.log('critical:', man?.critical || []);

if (dead) {
  console.error('\nLIVE CHECK FAILED — ' + dead + ' dead asset(s). DO NOT finish.');
  process.exit(1);
}
console.log('\nLIVE CHECK PASSED — boot path reachable.');
process.exit(0);
