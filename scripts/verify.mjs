#!/usr/bin/env node
/** Verify index.html ↔ src modules round-trip integrity */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  INDEX,
  DEFERRED,
  SRC,
  readManifest,
  parseIndex,
  joinModules,
  assembleFromModules,
  normalizeForDiff,
} from './lib/monolith.mjs';

const manifest = readManifest();
const html = fs.readFileSync(INDEX, 'utf8');
const { script: coreScript } = parseIndex(html);
const deferredOnDisk = fs.existsSync(DEFERRED) ? fs.readFileSync(DEFERRED, 'utf8') : '';
const joinedCore = joinModules(manifest, 'core');
const joinedDeferred = joinModules(manifest, 'deferred');
const assembled = assembleFromModules(manifest);

const norm = (s) => normalizeForDiff(s).replace(/\n$/, '');
const coreOk = norm(coreScript) === norm(joinedCore);
const deferredOk = norm(deferredOnDisk) === norm(joinedDeferred);

console.log(`Core modules: ${manifest.core.length}`);
console.log(`Deferred modules: ${manifest.deferred.length}`);
console.log(`Core script match: ${coreOk ? 'OK' : 'DIFF (' + coreScript.length + ' vs ' + joinedCore.length + ' bytes)'}`);
console.log(`Deferred script match: ${deferredOk ? 'OK' : 'DIFF (' + deferredOnDisk.length + ' vs ' + joinedDeferred.length + ' bytes)'}`);

const tmpCore = path.join(SRC, `.assembled-check-core-${process.pid}.js`);
const tmpDeferred = path.join(SRC, `.assembled-check-deferred-${process.pid}.js`);
fs.writeFileSync(tmpCore, parseIndex(assembled).script, 'utf8');
fs.writeFileSync(tmpDeferred, joinedDeferred, 'utf8');
try {
  execSync(`node --check "${tmpCore}"`, { stdio: 'pipe' });
  execSync(`node --check "${tmpDeferred}"`, { stdio: 'pipe' });
  console.log('Syntax check: OK');
} catch (e) {
  console.error('Syntax check: FAIL');
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpCore); } catch {}
  try { fs.unlinkSync(tmpDeferred); } catch {}
}

if (!coreOk || !deferredOk) process.exit(1);