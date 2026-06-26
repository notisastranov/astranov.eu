#!/usr/bin/env node
/**
 * Push index.html to GitHub (fork + PR if direct push denied).
 */
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OWNER = 'notisastranov';
const REPO = 'astranov.eu';
const BRANCH = 'main';
const FILE = 'index.html';

function gitCredential() {
  const r = spawnSync('git', ['credential', 'fill'], {
    input: 'protocol=https\nhost=github.com\n\n',
    encoding: 'utf8',
    cwd: ROOT,
  });
  const out = r.stdout || '';
  const user = (out.match(/^username=(.+)$/m) || [])[1]?.trim();
  const token = (out.match(/^password=(.+)$/m) || [])[1]?.trim();
  if (!token) throw new Error('No GitHub token in git credential — run: gh auth login');
  return { user, token };
}

async function gh(path, { method = 'GET', body, token }) {
  const r = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!r.ok) throw new Error(`${method} ${path} → ${r.status}: ${text.slice(0, 400)}`);
  return data;
}

async function putFile({ owner, repo, branch, filePath, content, message, token }) {
  let sha;
  try {
    const cur = await gh(`/repos/${owner}/${repo}/contents/${filePath}?ref=${branch}`, { token });
    sha = cur.sha;
  } catch (_) {}
  return gh(`/repos/${owner}/${repo}/contents/${filePath}`, {
    method: 'PUT',
    token,
    body: {
      message,
      content: Buffer.from(content, 'utf8').toString('base64'),
      branch,
      ...(sha ? { sha } : {}),
    },
  });
}

async function main() {
  const { user, token } = gitCredential();
  const content = fs.readFileSync(path.join(ROOT, FILE), 'utf8');
  if (content.includes('@file:')) throw new Error('Refusing to push broken @file index');
  const msg = 'EMERGENCY: restore index.html — load src modules (fix broken @file pointer)';

  console.log(`GitHub user: ${user}`);
  try {
    await putFile({ owner: OWNER, repo: REPO, branch: BRANCH, filePath: FILE, content, message: msg, token });
    console.log(`Pushed ${FILE} → ${OWNER}/${REPO}@${BRANCH}`);
    return;
  } catch (e) {
    console.warn('Direct push failed:', e.message);
  }

  const forkFull = `${user}/${REPO}`;
  try {
    await gh(`/repos/${OWNER}/${REPO}/forks`, { method: 'POST', token, body: {} });
    console.log('Fork created or exists');
  } catch (e) {
    console.warn('Fork:', e.message);
  }

  await new Promise(r => setTimeout(r, 3000));
  const branchName = `fix-index-${Date.now().toString(36)}`;
  const base = await gh(`/repos/${forkFull}/git/ref/heads/${BRANCH}`, { token });
  await gh(`/repos/${forkFull}/git/refs`, {
    method: 'POST',
    token,
    body: { ref: `refs/heads/${branchName}`, sha: base.object.sha },
  });
  await putFile({
    owner: user,
    repo: REPO,
    branch: branchName,
    filePath: FILE,
    content,
    message: msg,
    token,
  });
  const pr = await gh(`/repos/${OWNER}/${REPO}/pulls`, {
    method: 'POST',
    token,
    body: {
      title: msg,
      head: `${user}:${branchName}`,
      base: BRANCH,
      body: 'Production astranov.eu serves a broken @file: stub. This restores the app by loading /src/*.js modules.',
    },
  });
  console.log(`PR opened: ${pr.html_url}`);
}

main().catch(e => {
  console.error(e.message || e);
  process.exit(1);
});