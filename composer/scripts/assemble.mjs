#!/usr/bin/env node
/**
 * Assemble index.shell.html + src/*.js → index.html (core inline) + astranov-deferred.js
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
  readManifest,
  joinModules,
  normalizeForDiff,
  parseIndex,
  deferredScriptTag,
} from './lib/monolith.mjs';

const manifest = readManifest();
const buildId = process.env.ASTRANOV_BUILD || new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
let shell = fs.readFileSync(SHELL, 'utf8');
shell = shell.replace(/__ASTRANOV_BUILD__/g, buildId);
const swPath = path.join(ROOT, 'sw.js');
if (fs.existsSync(swPath)) {
  const sw = fs.readFileSync(swPath, 'utf8').replace(/__ASTRANOV_BUILD__/g, buildId);
  fs.writeFileSync(swPath, sw, 'utf8');
}
fs.writeFileSync(path.join(ROOT, 'build.json'), JSON.stringify({ buildId, builtAt: new Date().toISOString() }, null, 2) + '\n', 'utf8');

const coreScript = joinModules(manifest, 'core');
const deferredScript = joinModules(manifest, 'deferred');

const TRACKBALL_CONTRACT = [
  'function trackballStart',
  'function trackballMove',
  'function trackballEnd',
  'function tickGlobeFly',
  'function flyToPoint',
  'function bindTrackballEvents',
  'TrackballGuard',
  'applyInertia',
  "mode: 'quat'",
  '__trackballContract',
];
for (const token of TRACKBALL_CONTRACT) {
  if (!coreScript.includes(token)) {
    console.error(`Trackball contract FAILED — missing: ${token}`);
    process.exit(1);
  }
}
if (coreScript.includes('fromY:') || coreScript.includes('toY:')) {
  console.error('Trackball contract FAILED — deprecated euler fly (fromY/toY) found in core');
  process.exit(1);
}
console.log('Trackball contract: OK');
const assembled = shell.replace(/\s*$/, '\n') + '<script>\n' + coreScript + '</script>\n' + deferredScriptTag(buildId) + '</body>\n</html>\n';

if (process.argv.includes('--stdout')) {
  process.stdout.write(assembled);
  process.exit(0);
}

const prev = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : '';
const prevDeferred = fs.existsSync(DEFERRED) ? fs.readFileSync(DEFERRED, 'utf8') : '';
fs.writeFileSync(INDEX, assembled, 'utf8');
fs.writeFileSync(DEFERRED, deferredScript, 'utf8');

const same = normalizeForDiff(prev) === normalizeForDiff(assembled)
  && normalizeForDiff(prevDeferred) === normalizeForDiff(deferredScript);
console.log(`Assembled → ${INDEX} (${assembled.length} bytes) + ${DEFERRED} (${deferredScript.length} bytes) build=${buildId}${same ? ' — unchanged' : ''}`);

const tmpCore = path.join(SRC, '.assembled-check-core.js');
const tmpDeferred = path.join(SRC, '.assembled-check-deferred.js');
try {
  fs.writeFileSync(tmpCore, parseIndex(assembled).script, 'utf8');
  fs.writeFileSync(tmpDeferred, deferredScript, 'utf8');
  execSync(`node --check "${tmpCore}"`, { stdio: 'pipe' });
  execSync(`node --check "${tmpDeferred}"`, { stdio: 'pipe' });
  console.log('Syntax check: OK (core + deferred)');
} catch (e) {
  console.error('Syntax check FAILED:', e.stderr?.toString() || e.message);
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpCore); } catch {}
  try { fs.unlinkSync(tmpDeferred); } catch {}
}