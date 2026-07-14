#!/usr/bin/env node
/**
 * Spartan deploy check — only block true catastrophes (stub, syntax, bootstrap destroy).
 * Everything else warns; intentional changes must not block ship.
 */
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { INDEX, parseIndex } from './lib/monolith.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE = process.execPath;
const VERCEL = path.join(ROOT, 'vercel.json');

const html = fs.readFileSync(INDEX, 'utf8');
const errors = [];
const warnings = [];

function fail(msg) { errors.push(msg); }
function warn(msg) { warnings.push(msg); }

if (html.length < 80_000) fail(`index.html too small (${html.length}b) — likely bootstrap stub`);
if (html.includes('simulateACI')) fail('simulateACI found — forbidden simulation');
if (html.includes('data-astranov-deferred>//')) fail('broken inline deferred script');
const extraInline = html.match(/<\/script>\s*<script(?![^>]*src=)/gi);
if (extraInline?.length) fail(`extra inline script blocks: ${extraInline.length}`);

const title = (html.match(/<title>([^<]+)/) || [])[1] || '';
if (title.trim() !== 'Astranov') {
  if (/MILKED|RESTORED|ADVANCED/i.test(title)) fail(`troll title: "${title}"`);
  else warn(`title is "${title.trim()}" — prefer "Astranov"`);
}

if (html.includes('.celestial-circle { display: block')) warn('celestial circles may be visible');
if (!html.includes('#aci-hud')) warn('#aci-hud missing');
if (!html.includes('#globe-deck')) warn('#globe-deck missing');
if (!html.includes('astranov-continuity.js')) warn('astranov-continuity.js missing from index — AI handoff doc');
if (!html.includes('astranov-perf-lazy.js')) warn('astranov-perf-lazy.js missing — boot perf regression risk');
if (!html.includes('menu-profile-post-tile')) warn('#menu-profile-post-tile missing — super-add field');
if (!html.includes('aci-video-call')) warn('#aci-video-call missing — video call CLI');
if (html.includes('miner-cli-strip') || html.includes('id="aci-miner"')) warn('CLI miner strip present — use #field-balance-hud tap only');
if (!html.includes('field-balance-hud') && !html.includes('astranov-field-hud.js')) warn('field HUD / miner field entry may be broken');

try {
  const vercel = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
  if (/bootstrap-index/i.test(vercel.buildCommand || '')) fail('vercel.json runs bootstrap-index.mjs — destroys monolith');
} catch (e) {
  warn('vercel.json unreadable: ' + e.message);
}

const appPath = path.join(ROOT, 'astranov-app.js');
const corePath = path.join(ROOT, 'astranov-core.js');
const glPath = path.join(ROOT, 'astranov-gl.js');
let script = '';
if (html.includes('astranov-app.js')) {
  if (!fs.existsSync(appPath)) fail('astranov-app.js missing');
  if (fs.statSync(appPath).size < 200_000) fail('astranov-app.js too small');
  if (!html.includes('id="globe"') || !html.includes('globe-deck')) fail('index shell missing globe/deck');
  const appSrc = fs.readFileSync(appPath, 'utf8');
  if (!appSrc.includes("document.getElementById('globe')")) fail('astranov-app.js missing container');
  const tmp = path.join(ROOT, 'src', `.guard-${process.pid}-app.js`);
  fs.writeFileSync(tmp, fs.readFileSync(appPath, 'utf8'));
  const r = spawnSync(NODE, ['--check', tmp], { encoding: 'utf8' });
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0) fail('JS syntax check failed: astranov-app.js');
  script = '';
} else if (html.includes('astranov-gl.js') || html.includes('astranov-core.js')) {
  if (!fs.existsSync(glPath)) fail('astranov-gl.js missing');
  if (!fs.existsSync(corePath)) fail('astranov-core.js missing');
  if (fs.statSync(glPath).size < 3000) fail('astranov-gl.js too small');
  if (fs.statSync(corePath).size < 200_000) fail('astranov-core.js too small');
  if (!html.includes('id="globe"') || !html.includes('globe-deck')) fail('index shell missing globe/deck');
  for (const fp of [glPath, corePath]) {
    const tmp = path.join(ROOT, 'src', `.guard-${process.pid}-${path.basename(fp)}`);
    fs.writeFileSync(tmp, fs.readFileSync(fp, 'utf8'));
    const r = spawnSync(NODE, ['--check', tmp], { encoding: 'utf8' });
    try { fs.unlinkSync(tmp); } catch {}
    if (r.status !== 0) fail('JS syntax check failed: ' + path.basename(fp));
  }
  script = '';
} else {
  try {
    ({ script } = parseIndex(html));
  } catch (e) {
    fail('parseIndex: ' + e.message);
  }
}
if (script) {
  const tmp = path.join(ROOT, 'src', `.guard-${process.pid}.js`);
  fs.writeFileSync(tmp, script);
  const r = spawnSync(NODE, ['--check', tmp], { encoding: 'utf8' });
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0) fail('JS syntax check failed');
}

if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach((w) => console.log('  ⚠', w));
}
if (errors.length) {
  console.error('DEPLOY BLOCKED:');
  errors.forEach((e) => console.error('  ✗', e));
  process.exit(1);
}

console.log('OK —', Math.round(html.length / 1024) + 'k', 'monolith, syntax clean');