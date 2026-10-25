#!/usr/bin/env node
/**
 * Extract index.html + astranov-deferred.js → index.shell.html + src/*.js
 * Round-trip: node scripts/extract.mjs && node scripts/assemble.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  INDEX,
  DEFERRED,
  SHELL,
  SRC,
  readManifest,
  parseIndex,
  splitScript,
  joinModules,
} from './lib/monolith.mjs';

const html = fs.readFileSync(INDEX, 'utf8');
const manifest = readManifest();
const { shell, script: coreScript } = parseIndex(html);
const deferredScript = fs.existsSync(DEFERRED) ? fs.readFileSync(DEFERRED, 'utf8') : '';

fs.mkdirSync(SRC, { recursive: true });
fs.writeFileSync(SHELL, shell, 'utf8');

const coreModules = splitScript(coreScript, { modules: manifest.core });
const deferredModules = deferredScript
  ? splitScript(deferredScript, { modules: manifest.deferred })
  : {};

for (const [file, content] of Object.entries({ ...coreModules, ...deferredModules })) {
  const fp = path.join(SRC, file);
  fs.writeFileSync(fp, content, 'utf8');
  console.log(`  wrote ${path.relative(process.cwd(), fp)} (${content.length} bytes)`);
}

const joinedDeferred = joinModules(manifest, 'deferred');
if (deferredScript && deferredScript.trim() !== joinedDeferred.trim()) {
  console.warn('Warning: astranov-deferred.js does not match manifest deferred tier');
}

console.log(`\nExtracted ${Object.keys(coreModules).length + Object.keys(deferredModules).length} modules`);
console.log(`Shell: ${path.relative(process.cwd(), SHELL)}`);