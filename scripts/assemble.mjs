#!/usr/bin/env node
/**
 * Production assemble — LIVE-SAFE multi-file boot.
 *
 * CRITICAL LESSON (2026-07-18): phase-*.js 404 on astranov.eu CDN while
 * individual /js/*.js and root /astranov-*.js work. Never finish without live-check.
 *
 * Emits:
 *   index.html              slim shell + loader + individual-file manifest
 *   js/<module>.js          every module
 *   astranov-critical.js    root fallback bundle (critical only)
 *   astranov-app.js         root fallback bundle (app)
 *   astranov-features.js    root fallback bundle (features)
 *   astranov-deferred.js    deferred pack
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  INDEX,
  DEFERRED,
  ROOT,
  SHELL,
  SRC,
  JS_OUT,
  readManifest,
  joinModules,
  emitJsTree,
  allTierFiles,
} from './lib/monolith.mjs';

const manifest = readManifest();
const buildId = process.env.ASTRANOV_BUILD || new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);

let shell = fs.readFileSync(SHELL, 'utf8');
shell = shell.replace(/__ASTRANOV_BUILD__/g, buildId);

const swPath = path.join(ROOT, 'sw.js');
if (fs.existsSync(swPath)) {
  let sw = fs.readFileSync(swPath, 'utf8');
  if (sw.includes("const CACHE = 'astranov-")) {
    sw = sw.replace(/const CACHE = 'astranov-v[^']*'/, `const CACHE = 'astranov-v${buildId.slice(-8)}'`);
  }
  sw = sw.replace(/__ASTRANOV_BUILD__/g, buildId);
  fs.writeFileSync(swPath, sw, 'utf8');
}
fs.writeFileSync(
  path.join(ROOT, 'build.json'),
  JSON.stringify({ buildId, builtAt: new Date().toISOString(), mode: 'live-safe-files' }, null, 2) + '\n',
  'utf8'
);

const { written, tiers } = emitJsTree(manifest);

function writeRootBundle(name, files) {
  const parts = [];
  for (const file of files) {
    const fp = path.join(SRC, file);
    if (!fs.existsSync(fp)) throw new Error('Missing ' + file);
    let t = fs.readFileSync(fp, 'utf8');
    if (!t.endsWith('\n')) t += '\n';
    parts.push('/* === ' + file + ' === */\n' + t);
  }
  const outName = name;
  const out = path.join(ROOT, outName);
  fs.writeFileSync(out, parts.join('\n'), 'utf8');
  // also under js/ for parallel path
  fs.writeFileSync(path.join(JS_OUT, outName), parts.join('\n'), 'utf8');
  return { name: outName, bytes: fs.statSync(out).size };
}

const rootBundles = {
  critical: writeRootBundle('astranov-critical.js', tiers.critical),
  app: writeRootBundle('astranov-app.js', tiers.app),
  features: writeRootBundle('astranov-features.js', tiers.features),
  deferred: writeRootBundle('astranov-deferred.js', tiers.deferred),
};

// Trackball
const trackballSrc = fs.readFileSync(path.join(SRC, '10-trackball.js'), 'utf8')
  + fs.readFileSync(path.join(SRC, '04-trackball-guard.js'), 'utf8');
for (const token of [
  'function trackballStart', 'function trackballMove', 'function trackballEnd',
  'function tickGlobeFly', 'function flyToPoint', 'function bindTrackballEvents',
  'TrackballGuard', 'applyInertia', "mode: 'quat'", '__trackballContract',
]) {
  if (!trackballSrc.includes(token)) {
    console.error('Trackball contract FAILED — missing: ' + token);
    process.exit(1);
  }
}
console.log('Trackball contract: OK');

// LIVE-PROVEN paths (2026-07-18 probe on astranov.eu CF):
//   /js/phase-*.js          → 200 content-ok
//   /js/<module>.js         → 200
//   /astranov-deferred.js   → 200
//   /astranov-critical.js   → 404 on CF (GH has it — CDN gap)
// NEVER point production at a path that live-check failed.
const liveManifest = {
  mode: 'js-phase-bundles',
  critical: ['/js/phase-critical.js'],
  app: ['/js/phase-app.js'],
  features: ['/js/phase-features.js'],
  deferred: ['/astranov-deferred.js'],
  fallback: {
    critical: tiers.critical.map(f => '/js/' + f),
    app: tiers.app.map(f => '/js/' + f),
    features: tiers.features.map(f => '/js/' + f),
    deferred: ['/astranov-deferred.js'],
  },
};

const bootTags = [
  `<script>window.__ASTRANOV_MANIFEST__=${JSON.stringify(liveManifest)};window._bootAt=Date.now();</script>`,
  `<script src="/js/loader.js?v=${buildId}"></script>`,
  `<script src="/astranov-perf-lazy.js?v=${buildId}" defer></script>`,
  // Speed Insights lives once in index.shell.html <head> (static/vanilla inject)
].join('\n');

const assembled = shell.replace(/\s*<\/body>\s*<\/html>\s*$/i, '\n')
  + bootTags + '\n</body>\n</html>\n';

fs.writeFileSync(INDEX, assembled, 'utf8');
// deferred already written as root bundle
fs.writeFileSync(DEFERRED, fs.readFileSync(path.join(ROOT, 'astranov-deferred.js'), 'utf8'), 'utf8');

try {
  for (const f of ['loader.js', '00-globe.js', '99-boot-critical.js']) {
    execSync(`node --check "${path.join(JS_OUT, f)}"`, { stdio: 'pipe' });
  }
  for (const f of ['astranov-critical.js', 'astranov-app.js', 'astranov-features.js', 'astranov-deferred.js']) {
    execSync(`node --check "${path.join(ROOT, f)}"`, { stdio: 'pipe' });
  }
  console.log('Syntax check: OK');
} catch (e) {
  console.error('Syntax check FAILED:', e.stderr?.toString() || e.message);
  process.exit(1);
}

const indexKB = Math.round(assembled.length / 1024);
const kb = (n) => Math.round(n / 1024) + 'KB';
console.log(
  `Assembled LIVE-SAFE build=${buildId}`
  + `\n  index.html ${indexKB}KB`
  + `\n  root critical ${kb(rootBundles.critical.bytes)} · app ${kb(rootBundles.app.bytes)} · features ${kb(rootBundles.features.bytes)} · deferred ${kb(rootBundles.deferred.bytes)}`
  + `\n  modules: ${written.length}`
);

const deployFixed = [
  'index.html',
  'build.json',
  'sw.js',
  'astranov-critical.js',
  'astranov-app.js',
  'astranov-features.js',
  'astranov-deferred.js',
  'astranov-perf-lazy.js',
  'js/loader.js',
];
for (const f of written) {
  const rel = 'js/' + f;
  if (!deployFixed.includes(rel)) deployFixed.push(rel);
}

fs.writeFileSync(
  path.join(ROOT, 'scripts', '.deploy-files.json'),
  JSON.stringify({ buildId, files: deployFixed, mode: 'live-safe' }, null, 2) + '\n',
  'utf8'
);
