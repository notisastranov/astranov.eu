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

if (html.length < 200_000) fail(`index.html too small (${html.length}b) — likely bootstrap stub`);
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

try {
  const vercel = JSON.parse(fs.readFileSync(VERCEL, 'utf8'));
  if (/bootstrap-index/i.test(vercel.buildCommand || '')) fail('vercel.json runs bootstrap-index.mjs — destroys monolith');
} catch (e) {
  warn('vercel.json unreadable: ' + e.message);
}

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