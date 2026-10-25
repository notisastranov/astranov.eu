#!/usr/bin/env node
/**
 * Extract index.html → index.shell.html + src/*.js
 * Round-trip: node scripts/extract.mjs && node scripts/assemble.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  INDEX,
  SHELL,
  SRC,
  readManifest,
  parseIndex,
  splitScript,
} from './lib/monolith.mjs';

const html = fs.readFileSync(INDEX, 'utf8');
const manifest = readManifest();
const { shell, script } = parseIndex(html);

fs.mkdirSync(SRC, { recursive: true });
fs.writeFileSync(SHELL, shell, 'utf8');

const modules = splitScript(script, manifest);
for (const [file, content] of Object.entries(modules)) {
  const fp = path.join(SRC, file);
  fs.writeFileSync(fp, content, 'utf8');
  console.log(`  wrote ${path.relative(process.cwd(), fp)} (${content.length} bytes)`);
}

console.log(`\nExtracted ${Object.keys(modules).length} modules from index.html`);
console.log(`Shell: ${path.relative(process.cwd(), SHELL)}`);