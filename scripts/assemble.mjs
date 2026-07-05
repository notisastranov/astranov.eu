#!/usr/bin/env node
/**
 * Assemble index.shell.html + src/*.js → index.html (canonical deploy artifact)
 */
import fs from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import {
  INDEX,
  ROOT,
  SHELL,
  SRC,
  readManifest,
  joinModules,
  normalizeForDiff,
  parseIndex,
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
const assembled = shell.replace(/\s*$/, '\n') + '<script>\n' + joinModules(manifest) + '</script>\n</body>\n</html>\n';

if (process.argv.includes('--stdout')) {
  process.stdout.write(assembled);
  process.exit(0);
}

const prev = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : '';
fs.writeFileSync(INDEX, assembled, 'utf8');
const same = normalizeForDiff(prev) === normalizeForDiff(assembled);
console.log(`Assembled → ${INDEX} (${assembled.length} bytes) build=${buildId}${same ? ' — unchanged' : ''}`);

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