#!/usr/bin/env node
/** Post Grok Build fix back to architect's phone via Architect Bridge */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB_URL = process.env.SUPABASE_URL || 'https://lkoatrkhuigdolnjsbie.supabase.co';

function loadSecret() {
  if (process.env.CODERS_BRIDGE_SECRET) return process.env.CODERS_BRIDGE_SECRET;
  try {
    return fs.readFileSync(path.join(ROOT, 'scripts', '.coders-bridge-secret'), 'utf8').trim();
  } catch { return ''; }
}

const secret = loadSecret();
const id = process.argv[2];
const answer = process.argv.slice(3).join(' ').trim();

if (!secret) {
  console.error('Missing CODERS_BRIDGE_SECRET');
  process.exit(1);
}
if (!id || !answer) {
  console.error('Usage: node scripts/architect-bridge-answer.mjs <summon_id> "fix summary"');
  process.exit(1);
}

const r = await fetch(SB_URL + '/functions/v1/coders-bridge', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', 'x-coders-secret': secret },
  body: JSON.stringify({ mode: 'architect_answer', summon_id: Number(id), answer }),
});

const j = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error('Failed:', j.error || r.status);
  process.exit(1);
}
console.log('Architect bridge answered #' + id);
console.log(JSON.stringify(j, null, 2));