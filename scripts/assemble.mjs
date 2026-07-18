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

/**
 * Classic multi-script pitfall: `Foo?.x` throws if Foo is undeclared in THIS file,
 * even when window.Foo exists. Critical defines stubs; later phases rebind from window.
 */
const PHASE_LEXICAL_BRIDGE = `/* phase lexical bridge — window → local (optional chaining safe) */
var sessionHeld = (typeof window !== 'undefined' && window.sessionHeld) || false;
var SessionHold = (typeof window !== 'undefined' && window.SessionHold) || { isHeld:function(){return false}, hold:function(){}, resume:function(){}, toggle:function(){}, release:function(){}, init:function(){} };
var ACIControl = (typeof window !== 'undefined' && window.ACIControl) || { init:function(){}, reply:function(){}, voiceAck:function(){}, handle:async function(){return {executed:false}} };
var AppShortcuts = (typeof window !== 'undefined' && window.AppShortcuts) || { _order:[], APPS:{}, init:function(){}, render:function(){}, track:function(){}, untrack:function(){} };
var CityMap = (typeof window !== 'undefined' && window.CityMap) || { active:false, init:function(){} };
var SB_URL = (typeof window !== 'undefined' && window.SB_URL) || 'https://lkoatrkhuigdolnjsbie.supabase.co';
var SB_KEY = (typeof window !== 'undefined' && window.SB_KEY) || '';
var ACI = (typeof window !== 'undefined' && window.ACI) || { url: SB_URL, key: SB_KEY };
var AciCoders = (typeof window !== 'undefined' && window.AciCoders) || { engine:'grok', init:function(){}, observeActivity:function(){}, handleMessage:async function(){return null}, enterSession:async function(){return null} };
var ArchitectBridge = (typeof window !== 'undefined' && window.ArchitectBridge) || { armed:false, isActive:function(){return false}, arm:function(){}, disarm:function(){}, openQuickFix:function(){}, wantsBridgeCmd:function(){return false}, handleCommand:async function(){return null}, queueBuildFromChat:async function(){return null}, _bindUi:function(){}, init:function(){} };
var CityLife = (typeof window !== 'undefined' && window.CityLife) || { locateAndDropIn:async function(){return {error:'not ready'}}, safeLocate:async function(){return {error:'not ready'}}, dropIn:async function(){return {error:'not ready'}}, init:function(){} };
// Do not redeclare userLocated — critical owns it (var) for cross-script assigns.
var CliRibbon = (typeof window !== 'undefined' && window.CliRibbon) || { setNotice:function(){}, render:function(){}, init:function(){} };
`;

/** Production loads /js/phase-*.js — must rebuild every assemble */
function writePhase(name, files, { bridge = false } = {}) {
  const parts = [];
  if (bridge) parts.push(PHASE_LEXICAL_BRIDGE);
  for (const file of files) {
    const fp = path.join(SRC, file);
    if (!fs.existsSync(fp)) throw new Error('Missing ' + file);
    let t = fs.readFileSync(fp, 'utf8');
    if (!t.endsWith('\n')) t += '\n';
    parts.push('/* === ' + file + ' === */\n' + t);
  }
  const outName = 'phase-' + name + '.js';
  const out = path.join(JS_OUT, outName);
  fs.writeFileSync(out, parts.join('\n'), 'utf8');
  return { name: outName, bytes: fs.statSync(out).size };
}
const phaseMeta = {
  critical: writePhase('critical', tiers.critical, { bridge: false }),
  app: writePhase('app', tiers.app, { bridge: true }),
  features: writePhase('features', tiers.features, { bridge: true }),
  deferred: writePhase('deferred', tiers.deferred, { bridge: true }),
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

// HARD BOOT — sequential scripts (no async loader races). Dead app fix 2026-07-18.
// Order: THREE (already in head) → critical → boot Earth → Leaflet → app → boot map → features.
// HARD BOOT must be single-line JS strings — multi-line string literals in index.html
// caused SyntaxError "Invalid or unexpected token" and Earth never started (2026-07-18).
const bootFailCss = 'position:fixed;left:12px;right:12px;bottom:12px;z-index:99999;padding:14px;background:rgba(12,0,0,.95);border:1px solid #f44;color:#fcc;font:13px/1.4 system-ui;border-radius:12px';
const bootTags = [
  `<script>window.__ASTRANOV_MANIFEST__=${JSON.stringify(liveManifest)};window._bootAt=Date.now();window._spartan=true;</script>`,
  `<script src="/js/phase-critical.js?v=${buildId}"></script>`,
  `<script>(function(){function fail(m){try{var d=document.createElement('div');d.id='astranov-boot-fail';d.style.cssText='${bootFailCss}';d.textContent=m;document.body.appendChild(d);console.error('[boot]',m);}catch(e){}}try{if(typeof THREE==='undefined')throw new Error('THREE.js missing — check network');if(typeof __astranovBootCritical!=='function')throw new Error('Earth module missing');__astranovBootCritical();}catch(e){fail('Earth failed: '+(e&&e.message||e)+' — hard refresh astranov.eu');}})();</script>`,
  `<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>`,
  `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>`,
  `<script src="/js/phase-app.js?v=${buildId}"></script>`,
  `<script>(function(){try{if(typeof __astranovBootApp==='function')__astranovBootApp();else console.warn('[boot] map layer missing');}catch(e){console.error('[boot app]',e);}})();</script>`,
  `<script src="/js/phase-features.js?v=${buildId}" defer></script>`,
  `<script>window.addEventListener('load',function(){try{if(typeof __astranovBootFeatures==='function')__astranovBootFeatures();window.__ASTRANOV_DEFERRED_URLS__=['/astranov-deferred.js?v=${buildId}'];if(window.LazyModules)LazyModules.schedule&&LazyModules.schedule();}catch(e){console.error('[boot features]',e);}});</script>`,
  `<script src="/astranov-perf-lazy.js?v=${buildId}" defer></script>`,
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
  // Phase bundles are what production loads — must parse (redeclaration traps live here)
  for (const f of ['phase-critical.js', 'phase-app.js', 'phase-features.js', 'phase-deferred.js']) {
    execSync(`node --check "${path.join(JS_OUT, f)}"`, { stdio: 'pipe' });
  }
  console.log('Syntax check: OK (modules + root + phases)');
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
  + `\n  phase critical ${kb(phaseMeta.critical.bytes)} · app ${kb(phaseMeta.app.bytes)} · features ${kb(phaseMeta.features.bytes)} · deferred ${kb(phaseMeta.deferred.bytes)}`
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
