import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');
export const INDEX = path.join(ROOT, 'index.html');
export const DEFERRED = path.join(ROOT, 'astranov-deferred.js');
export const SHELL = path.join(ROOT, 'index.shell.html');
export const SRC = path.join(ROOT, 'src');
export const JS_OUT = path.join(ROOT, 'js');
export const MANIFEST = path.join(SRC, 'manifest.json');

export function readManifest() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
  // v4: critical + app + features + deferred
  // v3 compat: core + deferred
  if (manifest.version >= 4) {
    manifest.core = [
      ...(manifest.critical || []),
      ...(manifest.app || []),
      ...(manifest.features || []),
    ];
    manifest.modules = [...manifest.core, ...(manifest.deferred || [])];
  } else if (manifest.version >= 3) {
    manifest.modules = [...(manifest.core || []), ...(manifest.deferred || [])];
  }
  return manifest;
}

export function tierModules(manifest, tier) {
  if (manifest.version >= 4 && (tier === 'critical' || tier === 'app' || tier === 'features' || tier === 'deferred')) {
    return manifest[tier] || [];
  }
  if (manifest.version >= 3) return manifest[tier] || [];
  return manifest.modules || [];
}

export function allTierFiles(manifest) {
  if (manifest.version >= 4) {
    return {
      critical: (manifest.critical || []).map(m => m.file),
      app: (manifest.app || []).map(m => m.file),
      features: (manifest.features || []).map(m => m.file),
      deferred: (manifest.deferred || []).map(m => m.file),
    };
  }
  return {
    critical: (manifest.core || []).map(m => m.file),
    app: [],
    features: [],
    deferred: (manifest.deferred || []).map(m => m.file),
  };
}

/** Split index.html into { shell, script } — legacy inline block only */
export function parseIndex(html) {
  const match = html.match(/<script>(?!\s*<)\s*/i);
  const close = html.match(/\s*<\/script>\s*(?:<script[\s>]|<\/body>)/i);
  if (!match || !close) throw new Error('index.html: expected inline <script> block');
  const scriptStart = match.index + match[0].length;
  const scriptEnd = close.index;
  return {
    shell: html.slice(0, match.index).replace(/\s*$/, '\n'),
    script: html.slice(scriptStart, scriptEnd),
  };
}

export function joinModules(manifest, tier = null) {
  const list = tier ? tierModules(manifest, tier) : manifest.modules;
  const parts = [];
  for (const m of list) {
    const fp = path.join(SRC, m.file);
    if (!fs.existsSync(fp)) throw new Error(`Missing module: ${fp}`);
    let text = fs.readFileSync(fp, 'utf8');
    if (!text.endsWith('\n')) text += '\n';
    parts.push(text);
  }
  return parts.join('\n');
}

export function copyModuleToJs(file) {
  const src = path.join(SRC, file);
  if (!fs.existsSync(src)) throw new Error('Missing module: ' + src);
  const dest = path.join(JS_OUT, file);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  let text = fs.readFileSync(src, 'utf8');
  if (!text.endsWith('\n')) text += '\n';
  fs.writeFileSync(dest, text, 'utf8');
  return dest;
}

export function emitJsTree(manifest) {
  fs.mkdirSync(JS_OUT, { recursive: true });
  const tiers = allTierFiles(manifest);
  const written = [];
  for (const tier of Object.keys(tiers)) {
    for (const file of tiers[tier]) {
      copyModuleToJs(file);
      written.push(file);
    }
  }
  // loader
  const loaderSrc = path.join(SRC, 'js-loader.js');
  if (fs.existsSync(loaderSrc)) {
    fs.writeFileSync(path.join(JS_OUT, 'loader.js'), fs.readFileSync(loaderSrc, 'utf8'), 'utf8');
    written.push('loader.js');
  }
  return { written, tiers };
}

export function deferredScriptTag(buildId = '') {
  const q = buildId ? `?v=${encodeURIComponent(buildId)}` : '';
  return `<script defer src="/astranov-deferred.js${q}" data-astranov-deferred></script>\n`;
}

export function normalizeForDiff(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '\n');
}
