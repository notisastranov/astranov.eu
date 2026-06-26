#!/usr/bin/env node
/**
 * Launch batch to GitHub — ONLY after prod-verify passes.
 * Rule: verify basics (assemble, live site, bridge, auth gates) before deploy.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB_URL = process.env.SUPABASE_URL || 'https://lkoatrkhuigdolnjsbie.supabase.co';
const REPO = process.env.GITHUB_REPO || 'notisastranov/astranov.eu';
const BRANCH = process.env.GITHUB_BRANCH || 'main';

const BATCH_RULE =
  'Always verify production basics (assemble, live markers, coders-bridge, auth gates) before launching batch to GitHub or starting work-together batch.';

function loadAnonKey() {
  if (process.env.SUPABASE_ANON_KEY) return process.env.SUPABASE_ANON_KEY;
  const src = fs.readFileSync(path.join(ROOT, 'src', '20-aci.js'), 'utf8');
  const m = src.match(/key:\s*'([^']+)'/);
  return m?.[1] || '';
}

async function rememberRule() {
  const key = loadAnonKey();
  if (!key) return;
  try {
    const r = await fetch(SB_URL + '/functions/v1/aci', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: key,
        Authorization: 'Bearer ' + key,
      },
      body: JSON.stringify({ mode: 'teach', content: BATCH_RULE }),
    });
    const j = await r.json().catch(() => ({}));
    if (j.taught || j.ok) console.log('Remembered batch rule in collective memory.');
    else console.log('Teach skipped:', j.error || 'no owner brain');
  } catch (e) {
    console.log('Teach skipped:', e.message || e);
  }
}

console.log('=== Astranov launch-batch ===');
console.log('Rule:', BATCH_RULE);
console.log('');

console.log('Step 1/3 — production verify (required)…');
try {
  execSync('node scripts/prod-verify.mjs', { cwd: ROOT, stdio: 'inherit' });
} catch {
  console.error('\nBatch launch ABORTED — fix failing checks before deploying.');
  process.exit(1);
}

console.log('\nStep 2/3 — remember rule…');
await rememberRule();

console.log('\nStep 3/3 — trigger GitHub deploy workflows…');
const gh = (args) => execSync(`gh ${args}`, { cwd: ROOT, stdio: 'inherit' });
gh(`workflow run deploy.yml --repo ${REPO} --ref ${BRANCH}`);
gh(`workflow run supabase-deploy.yml --repo ${REPO} --ref ${BRANCH}`);

console.log('\nBatch launched to GitHub after verify. Watch: https://github.com/' + REPO + '/actions');