/**
 * P0 Force-paint twin CLIs + cli-log — Build 20260822071000 (from #126)
 * LOCKED twin CLIs. Last-wins style + inline !important. Currency ⭐. No goToTier.
 */
(function (G) {
  'use strict';
  if (G.__snCliAnswer0822c) return;
  G.__snCliAnswer0822c = 1;
  var BUILD = '20260822071000-force-paint-twin-cli';
  var ASTRANOV_BLURB =
    'Astranov is the mind of astranov.eu — Real-Earth OS / SpaceNet. ' +
    'Globe, map, ⭐ Astra coins (1⭐=1€), order, call, research. Not a chatbot brand. ' +
    'You talk to Astranov Mind here; SpaceNet is the grid under it.';
  var FORCE_CSS =
    '/* sn-force-paint ' + BUILD + ' last-wins */\n' +
    '#stc-cmd, #stc-cmd-in, #cli-form, #cli-in, #cli-log, #panel,\n' +
    '#panel.sn-open, #panel.open, body #panel, body #cli-log, body #stc-cmd {\n' +
    '  display: block !important; visibility: visible !important; opacity: 1 !important;\n' +
    '  pointer-events: auto !important; position: relative !important;\n' +
    '  clip: auto !important; clip-path: none !important; transform: none !important;\n' +
    '  max-height: none !important; overflow: visible !important;\n}\n' +
    '#stc-cmd { display: flex !important; min-height: 36px !important; height: auto !important; width: auto !important; max-width: 100% !important; }\n' +
    '#stc-cmd-in { display: block !important; min-height: 28px !important; height: 32px !important; min-width: 120px !important; width: 100% !important; opacity: 1 !important; pointer-events: auto !important; position: relative !important; z-index: 5 !important; }\n' +
    '#cli-form { display: flex !important; min-height: 36px !important; height: auto !important; width: 100% !important; align-items: center !important; }\n' +
    '#cli-in { display: block !important; min-height: 28px !important; height: 32px !important; min-width: 120px !important; width: 100% !important; opacity: 1 !important; pointer-events: auto !important; }\n' +
    '#cli-log { display: block !important; visibility: visible !important; opacity: 1 !important; min-height: 48px !important; height: auto !important; max-height: 40vh !important; overflow-y: auto !important; width: 100% !important; pointer-events: auto !important; }\n' +
    '#panel { display: flex !important; flex-direction: column !important; visibility: visible !important; opacity: 1 !important; min-height: 72px !important; height: auto !important; max-height: none !important; width: auto !important; pointer-events: auto !important; z-index: 40 !important; }\n' +
    '#sn-guest-pass-one-cli, style#sn-guest-pass-one-cli { display: none !important; }\n';
  function injectForceStyle() {
    try {
      var id = 'sn-force-paint-twin-cli';
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement('style');
        el.id = id;
        el.setAttribute('data-sn-build', BUILD);
        (document.head || document.documentElement).appendChild(el);
      }
      el.textContent = FORCE_CSS;
      try { (document.head || document.documentElement).appendChild(el); } catch (_) {}
    } catch (_) {}
  }
  function forceEl(el, display, minH, minW) {
    if (!el) return;
    try {
      el.removeAttribute('hidden');
      el.setAttribute('aria-hidden', 'false');
      el.style.setProperty('display', display || 'block', 'important');
      el.style.setProperty('visibility', 'visible', 'important');
      el.style.setProperty('opacity', '1', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      if (minH) { el.style.setProperty('min-height', minH, 'important'); el.style.setProperty('height', 'auto', 'important'); }
      if (minW) { el.style.setProperty('min-width', minW, 'important'); el.style.setProperty('width', '100%', 'important'); }
    } catch (_) {}
  }
  function forcePaint() {
    try {
      ['sn-guest-pass-one-cli', 'sn-one-cli', 'sn-quiet-cli', 'sn-p1-one-cli'].forEach(function (id) {
        var s = document.getElementById(id);
        if (s) { try { s.remove(); } catch (_) {} }
      });
      injectForceStyle();
      forceEl(document.getElementById('stc-cmd'), 'flex', '36px', '160px');
      forceEl(document.getElementById('stc-cmd-in'), 'block', '28px', '120px');
      forceEl(document.getElementById('cli-form'), 'flex', '36px', '160px');
      forceEl(document.getElementById('cli-in'), 'block', '28px', '120px');
      forceEl(document.getElementById('cli-log'), 'block', '48px', '160px');
      var panel = document.getElementById('panel');
      forceEl(panel, 'flex', '72px', '200px');
      if (panel) { panel.classList.add('sn-open', 'open'); panel.style.setProperty('flex-direction', 'column', 'important'); }
    } catch (_) {}
  }
  function log(m, c) { try { if (G.SNCli && SNCli.log) SNCli.log(String(m).slice(0, 420), c || 'ok', true); } catch (_) {} }
  function preview(m) { try { if (G.SNCli && SNCli.preview) SNCli.preview(String(m).slice(0, 90)); } catch (_) {} }
  function clearInputs() {
    try {
      var a = document.getElementById('cli-in'); if (a) a.value = '';
      var b = document.getElementById('stc-cmd-in'); if (b) b.value = '';
    } catch (_) {}
  }
  function stayPut() { try { if (G.SNMap && SNMap.active && typeof SNMap.close === 'function') SNMap.close(); } catch (_) {} }
  function isIdentity(line) {
    var low = String(line || '').trim().toLowerCase();
    if (!low) return false;
    if (/what\s+is\s+astranov|who\s+is\s+astranov|astranov\s*\?/i.test(low)) return true;
    if (/who\s+are\s+you|what\s+are\s+you|your\s+name/i.test(low)) return true;
    if (/what\s+is\s+spacenet|spacenet\s*\?/i.test(low)) return true;
    return false;
  }
  function isResearchish(line) {
    var s = String(line || '').trim();
    var low = s.toLowerCase();
    if (!s || s.length < 2) return false;
    if (isIdentity(s)) return true;
    if (/\?$/.test(s)) return true;
    if (/^(what|why|how|who|when|explain|tell me|define|is |are )\b/.test(low)) return true;
    return false;
  }
  function localMind(line) {
    var low = String(line || '').toLowerCase();
    if (/what\s+is\s+astranov|who\s+is\s+astranov|astranov\s*\?/i.test(low)) return ASTRANOV_BLURB;
    if (/who\s+are\s+you|what\s+are\s+you|your\s+name/i.test(low))
      return "I'm Astranov Mind on astranov.eu — globe, map, ⭐, order, call. Ask in plain language.";
    if (/what\s+is\s+spacenet|spacenet\s*\?/i.test(low))
      return 'SpaceNet is the internal grid name. The product face is Astranov on astranov.eu.';
    return null;
  }
  function answerInCli(line) {
    stayPut();
    forcePaint();
    clearInputs();
    log(line, 'cmd');
    var syncText = localMind(line) || ASTRANOV_BLURB;
    String(syncText).split(/\n+/).forEach(function (part) {
      var p = String(part || '').trim();
      if (p) log(p, 'ok');
    });
    preview(String(syncText).slice(0, 80));
    forcePaint();
    return syncText;
  }
  function handleLine(raw) {
    var s = String(raw || '').trim();
    if (!s) return false;
    if (!isResearchish(s) && !isIdentity(s)) return false;
    void answerInCli(s);
    return true;
  }
  function install() {
    forcePaint();
    if (!G.SNCli || typeof SNCli.run !== 'function') return;
    if (SNCli.__snCliAnswerC) return;
    SNCli.__snCliAnswerC = 1;
    var prev = SNCli.run.bind(SNCli);
    SNCli.run = function (raw) {
      try { if (handleLine(raw)) return Promise.resolve(true); } catch (_) {}
      return prev(raw);
    };
  }
  function boot() { forcePaint(); install(); }
  boot();
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  setTimeout(boot, 0);
  setTimeout(boot, 500);
  setTimeout(boot, 1500);
  setTimeout(boot, 4000);
  setInterval(function () { forcePaint(); install(); }, 6000);
  G.SNChromeCliAnswer = { build: BUILD, answer: answerInCli, stayPut: stayPut, ensureTwinCli: forcePaint, forcePaint: forcePaint };
})(typeof window !== 'undefined' ? window : globalThis);
