#!/usr/bin/env node
/**
 * Trigger Supabase deploy workflow + verify auditor-api endpoint.
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPO = 'notisastranov/astranov.eu';
const BRANCH = 'main';
const SB_URL = 'https://lkoatrkhuigdolnjsbie.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI';

function gh(args) {
  const r = spawnSync('gh', args.split(' '), { encoding: 'utf8', cwd: ROOT });
  if (r.status !== 0) throw new Error((r.stderr || r.stdout || 'gh failed').trim());
  return (r.stdout || '').trim();
}

async function waitAuditorApi(maxMs = 300000) {
  const url = SB_URL + '/functions/v1/auditor-api';
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: 'Bearer ' + ANON },
        body: JSON.stringify({ mode: 'whoami' }),
      });
      const j = await r.json().catch(() => ({}));
      if (r.status !== 404 && !String(j.error || '').includes('not found')) {
        return { ok: r.ok || r.status === 401, status: r.status, body: j };
      }
    } catch (_) {}
    await new Promise((res) => setTimeout(res, 12000));
  }
  return { ok: false, status: 0, body: { error: 'timeout' } };
}

console.log('Triggering supabase-deploy workflow…');
gh(`workflow run supabase-deploy.yml --repo ${REPO} --ref ${BRANCH}`);
console.log('Workflow dispatched. Waiting for auditor-api…');
const probe = await waitAuditorApi();
console.log(JSON.stringify({ probe }, null, 2));
if (!probe.ok && probe.status !== 401) process.exit(1);
console.log('auditor-api reachable (401 without user token is expected).');