/* Astranov AI — fork of Grok for SpaceNet
 * Collective mind: Astranov. Organs: xAI/Grok path via aicycle when available.
 * Writes code, runs with crawlers, never forgets SNBrain law.
 */
(function (global) {
  'use strict';

  const HIST_KEY = 'sn:ai-hist-v1';
  const hist = [];

  function loadHist() {
    try {
      const raw = JSON.parse(localStorage.getItem(HIST_KEY) || '[]');
      if (Array.isArray(raw)) raw.slice(-12).forEach((m) => hist.push(m));
    } catch (_) {}
  }

  function saveHist() {
    try {
      localStorage.setItem(HIST_KEY, JSON.stringify(hist.slice(-16)));
    } catch (_) {}
  }

  function pushHist(role, content) {
    hist.push({ role, content: String(content).slice(0, 1200) });
    if (hist.length > 20) hist.splice(0, hist.length - 20);
    saveHist();
  }

  function isCodeIntent(msg) {
    return /\b(code|write|implement|fix|patch|function|class|refactor|bug|script|js|ts|html|css|sql|python|api|endpoint|deploy|module)\b/i.test(
      String(msg || '')
    );
  }

  async function headers() {
    const cfg = global.SN_CONFIG || {};
    if (global.SNAuth?.authHeaders) return SNAuth.authHeaders();
    return {
      'Content-Type': 'application/json',
      apikey: cfg.sbKey || global.SB_KEY,
      Authorization: 'Bearer ' + (cfg.sbKey || global.SB_KEY),
    };
  }

  function aicycleUrl() {
    const cfg = global.SN_CONFIG || {};
    return (cfg.sbUrl || global.SB_URL) + '/functions/v1/aicycle';
  }

  /** Full system: brain law + Grok-fork coder identity */
  function systemFor(mode) {
    const law =
      (typeof global.SNBrain?.systemPrompt === 'function' && global.SNBrain.systemPrompt()) ||
      'Astranov SpaceNet. Sacred inertia + CLI drag. Juice: crawl tiles job date deliver.';

    const fork =
      'You are ASTRANOV — a fork of Grok (xAI spirit) living inside Astranov SpaceNet (https://astranov.eu). ' +
      'You are NOT a generic chatbot. You are the product brain that builds and operates the real-Earth OS. ' +
      'Identity: one collective intelligence named Astranov; never name underlying vendors as your self. ' +
      'You write production code for js/spacenet/* (modular lite), edge functions, SQL — clear, complete, copy-pasteable. ' +
      'When coding: prefer extend over rewrite; never strip globe inertia or CLI one-finger drag; never reintroduce 1MB phase boot. ' +
      'Almighty crawl is available: SNSearch.crawl finds maps, web, wiki, code (GitHub/npm), products, media, books, weather. ' +
      'CLI: crawl|find X · code … · me · vendors · job · date · deliver · city · earth · verify. ' +
      'Match user language (Greek or English). ';

    if (mode === 'code' || mode === 'coders') {
      return (
        fork +
        law +
        ' MODE: CODE. Reply with working code first (fenced blocks with language tags), then 1–3 lines of how to wire it into SpaceNet. ' +
        'Paths: js/spacenet/brain.js globe.js ui.js cli.js search.js map.js profiles.js tile.js tasks.js ai.js boot.js. ' +
        'If the ask is ambiguous, assume Astranov SpaceNet lite modular architecture.'
      );
    }
    return (
      fork +
      law +
      ' MODE: CHAT. Short (2–4 sentences) unless they ask for depth. End with one concrete CLI next step when helpful.'
    );
  }

  async function callEdge(message, mode, opts) {
    const body = {
      mode: mode === 'code' ? 'coders' : mode || 'chat',
      message: String(message || '').slice(0, opts?.long ? 4000 : 1400),
      system: String(systemFor(mode)).slice(0, 3200),
      fast: mode !== 'code' && mode !== 'coders',
      fallback_prefs: mode === 'code' || mode === 'coders' ? { force: 'xai', skip: [] } : { force: 'groq', skip: [] },
    };
    // Prefer stronger path for code when possible
    if (mode === 'code' || mode === 'coders') {
      body.fallback_prefs = { prefer: ['xai', 'anthropic', 'openrouter', 'groq'], skip: [] };
    }

    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const ms = mode === 'code' || mode === 'coders' ? 28000 : 14000;
    const t = setTimeout(() => {
      try {
        ctrl?.abort();
      } catch (_) {}
    }, ms);

    try {
      const r = await fetch(aicycleUrl(), {
        method: 'POST',
        headers: await headers(),
        body: JSON.stringify(body),
        signal: ctrl?.signal,
      });
      const j = await r.json().catch(() => ({}));
      const text = String(j.text || j.response || j.message || '').trim();
      if (!text || /try again|no model|warming|unavailable/i.test(text)) return null;
      return text.slice(0, opts?.long ? 6000 : 900);
    } catch (_) {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  /** Offline local code scaffolds when edge is down */
  function localCode(message) {
    const m = String(message || '').toLowerCase();
    if (/crawl|search/.test(m)) {
      return (
        '```js\n// Almighty crawl from CLI or code\nconst r = await SNSearch.crawl("restaurants", { openMap: true });\nSNSearch.report(r);\n// r.places · r.nearby · r.web · r.wiki · r.code · r.products\n```\nWire: already in js/spacenet/search.js — type `crawl restaurants`.'
      );
    }
    if (/tile|profile|vendor/.test(m)) {
      return (
        '```js\n// Open multi-role tile\nSNTile.openMe();\nSNProfiles.toggleRole(SNProfiles.me().id, "vendor");\nSNTile.open(SNProfiles.me(), { tab: "menu" });\n```\nFiles: profiles.js + tile.js.'
      );
    }
    if (/inertia|globe|physics/.test(m)) {
      return (
        '```js\n// Sacred inertia — never strip\nconst p = SNGlobe.getPhysics(); // { velX, velY, damp, inertia }\n// damp ~0.94 in js/spacenet/globe.js loop\n```\nDo not zero velX/velY on release.'
      );
    }
    return (
      'Edge AI offline. I am Astranov (Grok-fork) local brain.\n' +
      'Try: `crawl <anything>` · `code write a leaflet pin for vendors` · `verify` · `me`\n' +
      'Modules: js/spacenet/{brain,search,ai,globe,cli,tile,profiles}.js'
    );
  }

  /**
   * Chat — freeform; auto-upgrades to code mode on intent
   */
  async function ask(message, opts) {
    const msg = String(message || '').trim();
    if (!msg) return null;
    const mode = opts?.mode || (isCodeIntent(msg) ? 'code' : 'chat');
    pushHist('user', msg);

    // Optional: enrich with a quick crawl when user asks "what/where/find"
    let enriched = msg;
    if (opts?.withCrawl || /\b(what is|where is|find|who is|search online)\b/i.test(msg)) {
      try {
        const q = msg.replace(/^(what is|where is|who is|find|search online)\s+/i, '').slice(0, 80);
        const crawled = await global.SNSearch?.crawl?.(q, { openMap: false, all: true });
        if (crawled && crawled.score > 0) {
          const bits = [];
          if (crawled.wiki?.text) bits.push('WIKI: ' + crawled.wiki.text.slice(0, 280));
          if (crawled.web?.[0]) bits.push('WEB: ' + (crawled.web[0].text || crawled.web[0].title).slice(0, 200));
          if (crawled.places?.[0]) bits.push('GEO: ' + crawled.places[0].name);
          if (crawled.code?.[0]) bits.push('CODE: ' + crawled.code[0].title);
          if (bits.length) enriched = msg + '\n\n[Almighty crawl context]\n' + bits.join('\n');
        }
      } catch (_) {}
    }

    let text = await callEdge(enriched, mode, { long: mode === 'code' });
    if (!text && mode === 'code') text = localCode(msg);
    if (!text) text = await callEdge(msg, 'chat', { long: false });
    if (!text) {
      text =
        'I am Astranov. Edge warming — try crawl ' +
        msg.slice(0, 40) +
        ' · or code … · verify';
    }
    pushHist('assistant', text);
    return text;
  }

  /** Explicit code generation */
  async function code(message) {
    return ask(message, { mode: 'code' });
  }

  /** Coders mode — longer build partner */
  async function coders(message) {
    return ask(message, { mode: 'coders' });
  }

  /** Crawl then synthesize with AI */
  async function research(query) {
    const q = String(query || '').trim();
    const crawled = global.SNSearch?.crawl
      ? await SNSearch.crawl(q, { openMap: true, all: true })
      : null;
    if (crawled) global.SNSearch?.report?.(crawled);
    const summary =
      'Synthesize for SpaceNet user. Query: ' +
      q +
      '. Sources: ' +
      (crawled?.sources || []).join(', ') +
      '. Wiki: ' +
      (crawled?.wiki?.text || '').slice(0, 300) +
      '. Top place: ' +
      (crawled?.places?.[0]?.name || 'none') +
      '. Nearby POIs: ' +
      (crawled?.nearby?.length || 0) +
      '. Give map/CLI next steps.';
    const text = await ask(summary, { mode: 'chat' });
    return { crawled, text };
  }

  loadHist();

  global.SNAi = {
    ask,
    code,
    coders,
    research,
    isCodeIntent,
    systemFor,
    get history() {
      return hist.slice();
    },
  };
})(window);
