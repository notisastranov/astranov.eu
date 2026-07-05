#!/usr/bin/env node
/** Verify index.html ↔ src modules round-trip integrity */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  INDEX,
  SRC,
  readManifest,
  parseIndex,
  joinModules,
  assembleFromModules,
  normalizeForDiff,
} from './lib/monolith.mjs';

const manifest = readManifest();
const html = fs.readFileSync(INDEX, 'utf8');
const { script } = parseIndex(html);
const joined = joinModules(manifest);
const assembled = assembleFromModules(manifest);

const norm = (s) => normalizeForDiff(s).replace(/\n$/, '');
const scriptOk = norm(script) === norm(joined);

console.log(`Modules: ${manifest.modules.length}`);
console.log(`Script match: ${scriptOk ? 'OK' : 'DIFF (' + script.length + ' vs ' + joined.length + ' bytes)'}`);

const tmp = path.join(SRC, `.assembled-check-${process.pid}.js`);
fs.writeFileSync(tmp, parseIndex(assembled).script, 'utf8');
try {
  execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
  console.log('Syntax check: OK');
} catch (e) {
  console.error('Syntax check: FAIL');
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmp); } catch {}
}

if (!scriptOk) process.exit(1);