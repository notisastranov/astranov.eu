#!/usr/bin/env node
/**
 * Assemble index.shell.html + src/*.js → index.html (canonical deploy artifact)
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  INDEX,
  SRC,
  readManifest,
  assembleFromModules,
  normalizeForDiff,
  parseIndex,
} from './lib/monolith.mjs';

const manifest = readManifest();
const assembled = assembleFromModules(manifest);

if (process.argv.includes('--stdout')) {
  process.stdout.write(assembled);
  process.exit(0);
}

const prev = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : '';
fs.writeFileSync(INDEX, assembled, 'utf8');
const same = normalizeForDiff(prev) === normalizeForDiff(assembled);
console.log(`Assembled → ${INDEX} (${assembled.length} bytes)${same ? ' — unchanged' : ''}`);

const tmpScript = path.join(SRC, '.assembled-check.js');
try {
  fs.writeFileSync(tmpScript, parseIndex(assembled).script, 'utf8');
  execSync(`node --check "${tmpScript}"`, { stdio: 'pipe' });
  console.log('Syntax check: OK');
} catch (e) {
  console.error('Syntax check FAILED:', e.stderr?.toString() || e.message);
  process.exit(1);
} finally {
  try { fs.unlinkSync(tmpScript); } catch {}
}