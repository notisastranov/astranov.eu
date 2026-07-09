#!/usr/bin/env node
/**
 * Repair Grok Build damage: strip broken trailing scripts, restore Circles, fix branding.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { INDEX, SRC, parseIndex } from './lib/monolith.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function repairIndex() {
  let html = fs.readFileSync(INDEX, 'utf8');

  // 1. Truncate everything after the first inline </script> before </body>
  const closeMatch = html.match(/\s*<\/script>\s*(?:<script[\s\S]*)?<\/body>/i);
  if (!closeMatch) throw new Error('Could not find main script close');
  const closeIdx = html.indexOf(closeMatch[0]);
  const firstClose = html.indexOf('</script>', html.indexOf('<script>'));
  if (firstClose === -1) throw new Error('No </script> found');
  html = html.slice(0, firstClose + '</script>'.length) + '\n</body>\n</html>\n';

  let { shell, script } = parseIndex(html);

  // 2. Insert Celestial Circles module if missing
  const circlesPath = path.join(SRC, '64-celestial-circles.js');
  const circles = fs.readFileSync(circlesPath, 'utf8');
  const marker = '// === CELESTIAL CIRCLES UI SYSTEM';
  const bootMarker = 'function animate()';
  if (!script.includes(marker)) {
    const insertAt = script.indexOf(bootMarker);
    if (insertAt === -1) throw new Error('Boot marker not found for Circles insert');
    script = script.slice(0, insertAt) + circles + '\n\n' + script.slice(insertAt);
    console.log('Inserted 64-celestial-circles.js before boot');
  }

  // 3. Ensure Circles.init in boot (hide legacy deck)
  if (!script.includes('Circles.init()')) {
    const bootHook = 'Auth.init();';
    const hook = `// Celestial circles — primordial UI (no rectangles)\ntry { Circles.init(); } catch (e) { console.warn('Circles init:', e.message); }\nconst _deck = document.getElementById('globe-deck');\nif (_deck) { _deck.style.display = 'none'; _deck.style.pointerEvents = 'none'; }\n\n`;
    if (script.includes(bootHook)) {
      script = script.replace(bootHook, hook + bootHook);
      console.log('Wired Circles.init() into boot');
    }
  }

  // 4. Remove unauthorized Grok branding in UI strings
  const brandingFixes = [
    [/Talk to Grok/g, 'Talk to Astranov'],
    [/talk straight to Grok/gi, 'talk hands-free to Astranov'],
    [/tap 🎧 talk straight to Grok/gi, 'tap 🎧 talk hands-free'],
  ];
  for (const [re, rep] of brandingFixes) {
    shell = shell.replace(re, rep);
    script = script.replace(re, rep);
  }

  html = shell + '<script>\n' + script + '</script>\n</body>\n</html>\n';
  fs.writeFileSync(INDEX, html, 'utf8');
  console.log(`Repaired index.html (${html.length} bytes)`);

  const tmp = path.join(SRC, '.repair-check.js');
  fs.writeFileSync(tmp, script, 'utf8');
  try {
    execSync(`node --check "${tmp}"`, { stdio: 'pipe' });
    console.log('Syntax check: OK');
  } finally {
    try { fs.unlinkSync(tmp); } catch {}
  }
}

function repairAciModule() {
  const fp = path.join(SRC, '20-aci.js');
  let text = fs.readFileSync(fp, 'utf8');
  const broken = `    this.feed('think', prompt.slice(0, 80));
  },

  _sendComplaint(type, detail) {
    // Monitor complaints to debug-write
    if (window.fetch) {
      fetch('https://lkoatrkhuigdolnjsbie.supabase.co/functions/v1/debug-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.key },
        body: JSON.stringify({ type: 'complaint_' + type, detail, ts: Date.now(), session: window._sessionId || 'web', url: location.href })
      }).catch(() => {});
    }
  }
    this.pulse(1.4);
    return text;
  },`;

  const fixed = `    this.feed('think', prompt.slice(0, 80));
    this.pulse(1.4);
    return text;
  },

  _sendComplaint(type, detail) {
    if (window.fetch) {
      fetch('https://lkoatrkhuigdolnjsbie.supabase.co/functions/v1/debug-write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', apikey: this.key },
        body: JSON.stringify({ type: 'complaint_' + type, detail, ts: Date.now(), session: window._sessionId || 'web', url: location.href })
      }).catch(() => {});
    }
  },`;

  if (text.includes(broken)) {
    text = text.replace(broken, fixed);
    fs.writeFileSync(fp, text, 'utf8');
    console.log('Fixed syntax in src/20-aci.js');
  }
}

repairAciModule();
repairIndex();