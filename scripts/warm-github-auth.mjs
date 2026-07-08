#!/usr/bin/env node
/** Pre-warm owner GitHub token — silent, no user prompts. */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = path.join(ROOT, 'scripts', '.owner-token-cache');
const USER = 'notisastranov';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readCache() {
  try {
    const t = fs.readFileSync(CACHE, 'utf8').trim();
    if (/^gh[oprsu]_/.test(t)) return t;
  } catch (_) {}
  return null;
}

function writeCache(token) {
  try { fs.writeFileSync(CACHE, token + '\n', { encoding: 'utf8', mode: 0o600 }); } catch (_) {}
}

function fillCredential(timeoutMs) {
  const r = spawnSync('git', [
    '-c', 'credential.https://github.com.helper=manager',
    'credential', 'fill',
  ], {
    input: `protocol=https\nhost=github.com\nusername=${USER}\n\n`,
    encoding: 'utf8',
    cwd: ROOT,
    timeout: timeoutMs,
  });
  return (r.stdout || '').match(/^password=(.+)$/m)?.[1]?.trim() || null;
}

async function main() {
  const existing = readCache();
  if (existing) {
    console.log(JSON.stringify({ ok: true, warmed: 'cache' }));
    return;
  }
  for (let i = 1; i <= 12; i++) {
    const token = fillCredential(Math.min(40000 + i * 6000, 120000));
    if (token) {
      writeCache(token);
      console.log(JSON.stringify({ ok: true, warmed: 'credential-manager', attempt: i }));
      return;
    }
    await sleep(Math.min(i * 1500, 8000));
  }
  console.log(JSON.stringify({ ok: false, warmed: false }));
  process.exit(1);
}

main();