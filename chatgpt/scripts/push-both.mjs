#!/usr/bin/env node
/**
 * Push main to both central (astranov.eu) and composer backup repos.
 */
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BRANCH = process.argv[2] || 'main';
const COMPOSER_URL = 'https://github.com/notisastranov/composer.astranov.eu.git';

function run(cmd) {
  console.log('>', cmd);
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

function hasRemote(name) {
  try {
    const out = execSync('git remote', { cwd: ROOT, encoding: 'utf8' });
    return out.split(/\r?\n/).includes(name);
  } catch {
    return false;
  }
}

console.log('=== Astranov dual-repo sync ===');
console.log('central:  origin → astranov.eu');
console.log('composer: composer → composer.astranov.eu');
console.log('branch:  ', BRANCH);
console.log('');

if (!hasRemote('composer')) {
  run(`git remote add composer ${COMPOSER_URL}`);
}

run(`git push origin ${BRANCH}`);
run(`git push composer ${BRANCH}`);

const central = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
console.log('\nSynced at', central.slice(0, 7));
console.log('  https://github.com/notisastranov/astranov.eu');
console.log('  https://github.com/notisastranov/composer.astranov.eu');