#!/usr/bin/env node
/**
 * Architect Bridge watcher — picks up street-fix tasks from phone (astranov.eu).
 * Run beside Grok Build while road-testing. In-app coding loop:
 *   phone (fix/code/dev) → cic_queue architect_bridge → this inbox → Grok Build → answer
 *
 * Usage: node scripts/architect-bridge-watch.mjs [interval_seconds]
 * Answer: node scripts/architect-bridge-answer.mjs <id> "done: …"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SB_URL = process.env.SUPABASE_URL || 'https://lkoatrkhuigdolnjsbie.supabase.co';
const INBOX = path.join(ROOT, '.grok', 'architect-bridge-inbox.json');
const TASKS_DIR = path.join(ROOT, '.grok', 'architect-bridge', 'tasks');
const CURRENT = path.join(ROOT, '.grok', 'architect-bridge', 'CURRENT.md');
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

function ensureDirs() {
  try { fs.mkdirSync(TASKS_DIR, { recursive: true }); } catch { /* */ }
  try { fs.mkdirSync(path.dirname(INBOX), { recursive: true }); } catch { /* */ }
}

function writeTaskPack(p) {
  ensureDirs();
  const field = p.context?.field || p.context || {};
  const md = [
    `# Architect Bridge Task #${p.id}`,
    '',
    `**Status:** ${p.status}`,
    `**Created:** ${p.created_at || ''}`,
    `**Build (phone):** ${field.build || '—'}`,
    `**Geo:** ${field.lat != null ? `${field.lat}, ${field.lng}` : '—'}`,
    `**Page:** ${field.page || '—'}`,
    '',
    '## Task (from phone / astranov.eu)',
    '',
    String(p.question || '').trim(),
    '',
    '## Instructions for Grok Build',
    '',
    '1. Edit `src/*.js` (source of truth), then `node scripts/assemble.mjs`',
    '2. Run `node scripts/guard-base.mjs`',
    '3. Deploy: `node scripts/owner-push.mjs <files> "<msg>"`',
    '4. Answer phone:',
    '',
    '```',
    `node scripts/architect-bridge-answer.mjs ${p.id} "done: short summary of what shipped"`,
    '```',
    '',
    'Continuity contract: `astranov-continuity.js`',
    '',
  ].join('\n');
  const fp = path.join(TASKS_DIR, `${p.id}.md`);
  fs.writeFileSync(fp, md, 'utf8');
  return fp;
}

function writeCurrent(pending, fresh) {
  ensureDirs();
  const lines = [
    '# Architect Bridge — CURRENT',
    '',
    `Updated: ${new Date().toISOString()}`,
    '',
    'Phone → astranov.eu (architect sign-in) → `fix` / `code` / `dev` → this inbox → Grok Build.',
    '',
  ];
  if (!pending.length) {
    lines.push('**No open street-fix tasks.**');
    lines.push('');
    lines.push('Keep this watcher running while road-testing.');
  } else {
    lines.push(`**${pending.length} open task(s)**`);
    lines.push('');
    for (const p of pending) {
      const field = p.context?.field || p.context || {};
      lines.push(`## #${p.id} [${p.status}]`);
      lines.push('');
      lines.push(String(p.question || '').trim());
      lines.push('');
      if (field.build) lines.push(`- phone build: \`${field.build}\``);
      if (field.lat != null) lines.push(`- geo: ${field.lat}, ${field.lng}`);
      lines.push(`- answer: \`node scripts/architect-bridge-answer.mjs ${p.id} "done: …"\``);
      lines.push(`- pack: \`.grok/architect-bridge/tasks/${p.id}.md\``);
      lines.push('');
    }
  }
  if (fresh.length) {
    lines.push('## Fresh this tick');
    lines.push(fresh.map(p => `#${p.id}`).join(', '));
    lines.push('');
  }
  fs.writeFileSync(CURRENT, lines.join('\n'), 'utf8');
}

function writeInbox(pending, fresh) {
  ensureDirs();
  const payload = {
    updatedAt: new Date().toISOString(),
    pending: pending.map(p => ({
      id: p.id,
      task: p.question,
      status: p.status,
      field: p.context?.field || p.context || {},
      created_at: p.created_at,
      pack: path.join('.grok', 'architect-bridge', 'tasks', `${p.id}.md`).replace(/\\/g, '/'),
    })),
    fresh: fresh.map(p => p.id),
    currentMd: path.join('.grok', 'architect-bridge', 'CURRENT.md').replace(/\\/g, '/'),
    answerCmd: 'node scripts/architect-bridge-answer.mjs <id> "your fix summary"',
  };
  fs.writeFileSync(INBOX, JSON.stringify(payload, null, 2) + '\n', 'utf8');
  writeCurrent(pending, fresh);
  for (const p of pending) writeTaskPack(p);
}

const interval = Number(process.argv[2]) || 8;
const seen = loadSeen();
const seenSet = new Set(seen.ids || []);

async function bridgePost(body) {
  const r = await fetch(SB_URL + '/functions/v1/coders-bridge', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-coders-secret': secret,
    },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  return { ok: r.ok, status: r.status, ...j };
}

async function tick() {
  try {
    const j = await bridgePost({ mode: 'architect_pending', limit: 20 });
    if (j.error) {
      console.log('\n⚠ API error:', j.error);
      return;
    }
    const pending = j.pending || [];
    const fresh = [];

    for (const p of pending) {
      if (!seenSet.has(p.id)) {
        seenSet.add(p.id);
        fresh.push(p);
        await bridgePost({
          mode: 'architect_ack',
          summon_id: p.id,
          agent: 'grok_build',
        }).catch(() => {});
        writeTaskPack(p);
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
    console.log('Current:', CURRENT);
    if (!pending.length) {
      console.log('(no open street-fix tasks)');
      console.log('Phone: architect sign-in → fix <issue> | code <change> | dev <task> | 🛠');
      return;
    }
    pending.forEach(p => {
      const f = p.context?.field || p.context || {};
      const geo = f.lat != null ? ` @ ${Number(f.lat).toFixed(4)},${Number(f.lng || 0).toFixed(4)}` : '';
      console.log('\n#' + p.id + ' [' + p.status + ']' + geo);
      console.log('  ' + String(p.question || '').slice(0, 220));
      console.log('  → pack: .grok/architect-bridge/tasks/' + p.id + '.md');
      console.log('  → answer: node scripts/architect-bridge-answer.mjs ' + p.id + ' "done: …"');
    });
    if (fresh.length) {
      console.log('\n⚡ NEW:', fresh.map(p => '#' + p.id).join(', '));
      console.log('Open CURRENT.md and implement, then answer back to the phone.');
    }
  } catch (err) {
    console.log('\n⚠ fetch failed — retrying: ' + (err.cause?.message || err.message || err));
  }
}

console.log('Architect bridge watching every ' + interval + 's. Ctrl+C to stop.');
console.log('Phone: sign in as architect → fix | code | dev | 🛠');
await tick();
setInterval(tick, interval * 1000);
