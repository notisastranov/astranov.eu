#!/usr/bin/env node
/**
 * Architect Bridge watcher — picks up street-fix tasks from phone (astranov.eu).
 * Run beside Grok Build / Cursor while road-testing.
 *
 * Usage: node scripts/architect-bridge-watch.mjs [interval_seconds]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB_URL = process.env.SUPABASE_URL || 'https://lkoatrkhuigdolnjsbie.supabase.co';
const INBOX = path.join(ROOT, '.grok', 'architect-bridge-inbox.json');
const SEEN = path.join(ROOT, 'scripts', '.architect-bridge-seen.json');

function loadSecret() {
  if (process.env.CODERS_BRIDGE_SECRET) return process.env.CODERS_BRIDGE_SECRET;
  try {
    return fs.readFileSync(path.join(ROOT, 'scripts', '.coders-bridge-secret'), 'utf8').trim();
  } catch { return ''; }
}

const secret = loadSecret();
if (!secret) {
  console.error('Missing CODERS_BRIDGE_SECRET — set env or scripts/.coders-bridge-secret');
  process.exit(1);
}

function loadSeen() {
  try { return JSON.parse(fs.readFileSync(SEEN, 'utf8')); } catch { return { ids: [] }; }
}

function saveSeen(data) {
  try { fs.mkdirSync(path.dirname(SEEN), { recursive: true }); } catch { /* */ }
  fs.writeFileSync(SEEN, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function writeInbox(pending, fresh) {
  try { fs.mkdirSync(path.dirname(INBOX), { recursive: true }); } catch { /* */ }
  const payload = {
    updatedAt: new Date().toISOString(),
    pending: pending.map(p => ({
      id: p.id,
      task: p.question,
      status: p.status,
      field: p.context?.field || p.context || {},
      created_at: p.created_at,
    })),
    fresh,
    answerCmd: 'node scripts/architect-bridge-answer.mjs <id> "your fix summary"',
  };
  fs.writeFileSync(INBOX, JSON.stringify(payload, null, 2) + '\n', 'utf8');
}

const interval = Number(process.argv[2]) || 8;
const seen = loadSeen();
const seenSet = new Set(seen.ids || []);

async function tick() {
  try {
    const r = await fetch(SB_URL + '/functions/v1/coders-bridge', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-coders-secret': secret,
      },
      body: JSON.stringify({ mode: 'architect_pending', limit: 20 }),
    });
    const j = await r.json().catch(() => ({}));
    const pending = j.pending || [];
    const fresh = [];

    for (const p of pending) {
      if (!seenSet.has(p.id)) {
        seenSet.add(p.id);
        fresh.push(p);
        // Ack so phone shows in_progress
        await fetch(SB_URL + '/functions/v1/coders-bridge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-coders-secret': secret },
          body: JSON.stringify({ mode: 'architect_ack', summon_id: p.id, agent: 'grok_build' }),
        }).catch(() => {});
      }
    }

    if (fresh.length) {
      seen.ids = [...seenSet].slice(-200);
      saveSeen(seen);
    }
    writeInbox(pending, fresh);

    console.clear();
    console.log('Architect Bridge Watch — Grok Build inbox — ' + new Date().toLocaleTimeString());
    console.log('Inbox:', INBOX);
    if (!pending.length) {
      console.log('(no open street-fix tasks)');
      return;
    }
    pending.forEach(p => {
      const f = p.context?.field || {};
      const geo = f.lat != null ? ` @ ${f.lat.toFixed(4)},${f.lng?.toFixed(4)}` : '';
      console.log('\n#' + p.id + ' [' + p.status + ']' + geo);
      console.log('  ' + String(p.question || '').slice(0, 220));
      console.log('  → fix in Grok Build, then: node scripts/architect-bridge-answer.mjs ' + p.id + ' "done: …"');
    });
    if (fresh.length) {
      console.log('\n⚡ NEW:', fresh.map(p => '#' + p.id).join(', '));
    }
  } catch (err) {
    console.log('\n⚠ fetch failed — retrying: ' + (err.cause?.message || err.message || err));
  }
}

console.log('Architect bridge watching every ' + interval + 's. Ctrl+C to stop.');
console.log('Phone: sign in as architect → say fix <issue> or dev <task>');
await tick();
setInterval(tick, interval * 1000);