#!/usr/bin/env node
/**
 * Emergency deploy: index.shell.html + /src/*.js script tags (no 400KB monolith).
 * Vercel already serves src/ — only index.html was broken.
 */
import fs from 'node:fs';
import { INDEX, SHELL, readManifest } from './lib/monolith.mjs';

const shell = fs.readFileSync(SHELL, 'utf8').replace(/\s*$/, '\n');
const { modules } = readManifest();
const tags = modules.map(m => `<script src="/src/${m.file}"></script>`).join('\n');
const html = shell + tags + '\n</body>\n</html>\n';
fs.writeFileSync(INDEX, html, 'utf8');
console.log(`Bootstrap index → ${INDEX} (${html.length} bytes, ${modules.length} modules)`);