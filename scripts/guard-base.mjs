#!/usr/bin/env node
/**
 * Base version lock — run before every deploy.
 * Exits non-zero if index.html would destroy the recovered astranov.eu base.
 */
import fs from 'node:fs';
import { execSync, spawnSync } from 'node:child_process';
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

// --- Size: monolith, not bootstrap stub ---
if (html.length < 200_000) fail(`index.html too small (${html.length}b) — likely bootstrap stub`);

// --- Title / branding ---
const title = (html.match(/<title>([^<]+)/) || [])[1] || '';
if (title.trim() !== 'Astranov') {
  if (/MILKED|RESTORED|ADVANCED/i.test(title)) fail(`troll title: "${title}" — must be "Astranov"`);
  else warn(`title is "${title.trim()}" — prefer exactly "Astranov"`);
}

// --- Forbidden patterns ---
if (html.includes('simulateACI')) fail('simulateACI found — forbidden simulation');
if (html.includes('data-astranov-deferred>//')) fail('broken inline deferred script');
const extraInline = html.match(/<\/script>\s*<script(?![^>]*src=)/gi);
if (extraInline?.length) fail(`extra inline script blocks: ${extraInline.length}`);

// --- Circles disabled (owner law) ---
if (html.includes('.celestial-circle { display: block')) {
  fail('celestial circles enabled (display:block) — owner forbids floating balls');
}
if (!html.includes('.celestial-circle { display:none')) {
  fail('celestial-circle CSS hide missing — balls may appear');
}
if (html.includes('_legacyDeck') && html.includes("display = 'none'")) {
  fail('JS hides #globe-deck — CLI destroyed');
}

// --- Critical CSS (app death without these) ---
if (!html.includes('#aci-hud') || !html.includes('position:fixed')) {
  fail('#aci-hud fixed positioning missing — CLI container broken');
}
if (!html.includes('#globe-deck') || !html.includes('display:flex')) {
  fail('#globe-deck display:flex missing — CLI layout broken');
}
if (html.includes('#globe-deck-header { display:none')) {
  fail('#globe-deck-header hidden — deck chrome broken');
}

// --- SpaceNet stack present ---
for (const token of ['CosmicZoom', 'ZoomTiers', 'CityMap', 'three.min.js', 'getElementById(\'globe\')']) {
  if (!html.includes(token)) fail(`SpaceNet primitive missing: ${token}`);
}

// --- Vercel must not bootstrap ---
try {
  const vercel = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
  const bc = vercel.buildCommand || '';
  if (/bootstrap-index/i.test(bc)) fail('vercel.json runs bootstrap-index.mjs — destroys monolith');
} catch (e) {
  warn('vercel.json unreadable: ' + e.message);
}

// --- Syntax ---
let script;
try {
  ({ script } = parseIndex(html));
} catch (e) {
  fail('parseIndex: ' + e.message);
}
if (script) {
  const tmp = path.join(ROOT, 'src', `.guard-${process.pid}.js`);
  fs.writeFileSync(tmp, script);
  const r = spawnSync(NODE, ['--check', tmp], { encoding: 'utf8' });
  try { fs.unlinkSync(tmp); } catch {}
  if (r.status !== 0) fail('JS syntax check failed');
}

// --- Report ---
if (warnings.length) {
  console.log('Warnings:');
  warnings.forEach((w) => console.log('  ⚠', w));
}
if (errors.length) {
  console.error('BASE LOCK FAILED:');
  errors.forEach((e) => console.error('  ✗', e));
  console.error('\nRead ASTRANOV_SPACENET_MISSION.md before changing index.html.');
  process.exit(1);
}

console.log('BASE LOCK OK —', Math.round(html.length / 1024) + 'k', 'monolith, SpaceNet primitives present');