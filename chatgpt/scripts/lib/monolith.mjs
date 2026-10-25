import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '../..');
export const INDEX = path.join(ROOT, 'index.html');
export const SHELL = path.join(ROOT, 'index.shell.html');
export const SRC = path.join(ROOT, 'src');
export const MANIFEST = path.join(SRC, 'manifest.json');

export function readManifest() {
  return JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
}

/** Split index.html into { shell, script } — inline block only (not <script src=...>) */
export function parseIndex(html) {
  const match = html.match(/<script>(?!\s*<)\s*/i);
  const close = html.match(/\s*<\/script>\s*<\/body>/i);
  if (!match || !close) throw new Error('index.html: expected inline <script> block before </body>');
  const scriptStart = match.index + match[0].length;
  const scriptEnd = close.index;
  return {
    shell: html.slice(0, match.index).replace(/\s*$/, '\n'),
    script: html.slice(scriptStart, scriptEnd),
  };
}

function findMarker(script, marker) {
  if (marker == null) return 0;
  const idx = script.indexOf(marker);
  if (idx === -1) throw new Error(`Marker not found in script: ${JSON.stringify(marker)}`);
  return idx;
}

export function splitScript(script, manifest) {
  const { modules } = manifest;
  const bounds = modules.map(m => ({
    file: m.file,
    start: findMarker(script, m.marker),
  }));

  const out = {};
  for (let i = 0; i < bounds.length; i++) {
    const start = bounds[i].start;
    const end = i + 1 < bounds.length ? bounds[i + 1].start : script.length;
    let chunk = script.slice(start, end);
    if (i < bounds.length - 1) chunk = chunk.replace(/\s*$/, '') + '\n';
    out[bounds[i].file] = chunk;
  }
  return out;
}

export function joinModules(manifest) {
  const parts = [];
  for (const m of manifest.modules) {
    const fp = path.join(SRC, m.file);
    if (!fs.existsSync(fp)) throw new Error(`Missing module: ${fp}`);
    let text = fs.readFileSync(fp, 'utf8');
    if (!text.endsWith('\n')) text += '\n';
    parts.push(text);
  }
  return parts.join('\n');
}

export function assembleFromModules(manifest) {
  const shell = fs.readFileSync(SHELL, 'utf8').replace(/\s*$/, '\n');
  const script = joinModules(manifest);
  return shell + '<script>\n' + script + '</script>\n</body>\n</html>\n';
}

export function normalizeForDiff(text) {
  return text.replace(/\r\n/g, '\n').replace(/\n+$/, '\n');
}