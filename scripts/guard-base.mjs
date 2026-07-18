#!/usr/bin/env node
/**
 * Guard production index — multi-file mode (no monolith inline core).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';
import { INDEX, ROOT, JS_OUT } from './lib/monolith.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fail(msg) {
  console.error('GUARD FAIL:', msg);
  process.exit(1);
}
function warn(msg) {
  console.warn('GUARD WARN:', msg);
}

if (!fs.existsSync(INDEX)) fail('index.html missing');
const html = fs.readFileSync(INDEX, 'utf8');

// Multi-file: must have loader + manifest, must NOT have huge inline core
if (!html.includes('__ASTRANOV_MANIFEST__')) fail('missing multi-file manifest injection');
if (!html.includes('/js/loader.js')) fail('missing js/loader.js boot');
if (!html.includes('three.min.js')) fail('Three.js missing from shell');

// Reject reintroduction of 500KB+ inline monolith
const inlineBlocks = html.match(/<script(?![^>]*\bsrc=)[^>]*>[\s\S]*?<\/script>/gi) || [];
const bigInline = inlineBlocks.filter(b => b.length > 80_000);
if (bigInline.length) fail(`monolith inline script returned (${Math.round(bigInline[0].length / 1024)}KB) — multi-file only`);

// Phase bundles (production path) + critical individuals
const need = [
  'js/loader.js',
  'js/phase-critical.js',
  'js/phase-app.js',
  'js/phase-features.js',
  'js/phase-deferred.js',
  'js/00-globe.js',
  'js/10-trackball.js',
];
for (const rel of need) {
  if (!fs.existsSync(path.join(ROOT, rel))) fail('missing ' + rel);
}
if (!html.includes('phase-critical')) fail('index not using phase-critical bundle');

if (!html.includes('field-balance-hud') && !html.includes('astranov-field-hud.js') && !html.includes('ResourceMonitor')) {
  warn('field HUD / money field entry may be thin in shell (loads via modules)');
}

// Loader syntax
try {
  execSync(`node --check "${path.join(ROOT, 'js', 'loader.js')}"`, { stdio: 'pipe' });
  execSync(`node --check "${path.join(ROOT, 'js', '00-globe.js')}"`, { stdio: 'pipe' });
} catch (e) {
  fail('syntax: ' + (e.stderr?.toString() || e.message));
}

const indexKB = Math.round(html.length / 1024);
const jsCount = fs.existsSync(JS_OUT)
  ? fs.readdirSync(JS_OUT).filter(f => f.endsWith('.js')).length
  : 0;
console.log('OK — multi-file · index', indexKB + 'KB · js modules', jsCount);
