#!/usr/bin/env node
/**
 * Silent owner push — never prompts the user.
 * Token order: env → local cache → Windows Credential Manager (retries).
 */
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = 'notisastranov';
const REPO = 'astranov.eu';
const BRANCH = 'main';
const USER = 'notisastranov';
const CACHE_FILE = path.join(ROOT, 'scripts', '.owner-token-cache');
const CACHE_MAX_AGE_MS = 20 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 18;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function readCachedToken() {
  try {
    const stat = fs.statSync(CACHE_FILE);
    if (Date.now() - stat.mtimeMs > CACHE_MAX_AGE_MS) return null;
    const token = fs.readFileSync(CACHE_FILE, 'utf8').trim();
    if (/^gh[oprsu]_[A-Za-z0-9_]+$/.test(token)) return token;
  } catch (_) {}
  return null;
}

function writeCachedToken(token) {
  try {
    fs.writeFileSync(CACHE_FILE, token + '\n', { encoding: 'utf8', mode: 0o600 });
  } catch (_) {}
}

function tokenFromEnv() {
  const t = process.env.ASTRANOV_GITHUB_TOKEN || process.env.GITHUB_TOKEN || '';
  return /^gh[oprsu]_/.test(t) ? t.trim() : null;
}

function tokenFromCredentialManager(timeoutMs) {
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

async function verifyToken(token) {
  try {
    const r = await fetch(`https://api.github.com/repos/${OWNER}/${REPO}`, {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'astranov-owner-push',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    return r.ok || r.status === 403;
  } catch (_) {
    return false;
  }
}

async function getOwnerToken() {
  const envTok = tokenFromEnv();
  if (envTok && await verifyToken(envTok)) return envTok;

  const cached = readCachedToken();
  if (cached && await verifyToken(cached)) return cached;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const timeoutMs = Math.min(35000 + attempt * 8000, 120000);
    const token = tokenFromCredentialManager(timeoutMs);
    if (token && await verifyToken(token)) {
      writeCachedToken(token);
      return token;
    }
    await sleep(Math.min(attempt * 1800, 10000));
  }
  return null;
}

async function gh(apiPath, { method = 'GET', body, token }) {
  const r = await fetch(`https://api.github.com${apiPath}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'astranov-owner-push',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`${method} ${apiPath} → ${r.status}: ${text.slice(0, 400)}`);
  return data;
}

async function putFile({ filePath, content, message, token }) {
  let sha;
  try {
    const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(filePath).replace(/%2F/g, '/')}?ref=${BRANCH}`, { token });
    sha = cur.sha;
  } catch (e) {
    if (!String(e.message || '').includes('404')) throw e;
  }
  if (!sha) {
    try {
      const cur = await gh(`/repos/${OWNER}/${REPO}/contents/${filePath}?ref=${BRANCH}`, { token });
      sha = cur.sha;
    } catch (e) {
      if (!String(e.message || '').includes('404')) throw e;
    }
  }
  return gh(`/repos/${OWNER}/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    token,
    body: {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch: BRANCH,
      ...(sha ? { sha } : {}),
    },
  });
}

const files = (process.argv.slice(2).filter((a) => !a.startsWith('--'))).length
  ? process.argv.slice(2).filter((a) => !a.startsWith('--'))
  : ['index.html', 'astranov-deferred.js'];

const msgArg = process.argv.find((a) => a.startsWith('--message='));
const message = msgArg?.slice('--message='.length)
  || process.env.ASTRANOV_COMMIT_MSG
  || 'deploy: astranov.eu production update';

async function main() {
  const token = await getOwnerToken();
  if (!token) {
    console.error(JSON.stringify({ error: 'owner_token_unavailable', silent: true, retries: MAX_ATTEMPTS }));
    process.exit(1);
  }

  const results = [];
  for (const rel of files) {
    const full = path.join(ROOT, rel);
    if (!fs.existsSync(full)) {
      results.push({ path: rel, error: 'missing' });
      continue;
    }
    const content = fs.readFileSync(full, 'utf8');
    const res = await putFile({ filePath: rel.replace(/\\/g, '/'), content, message, token });
    results.push({ path: rel, commit: res?.commit?.sha || null });
  }
  console.log(JSON.stringify({ ok: true, owner: OWNER, repo: REPO, branch: BRANCH, results }));
}

main().catch((e) => {
  console.error(JSON.stringify({ error: e.message || String(e), silent: true }));
  process.exit(1);
});