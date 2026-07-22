/* SpaceNet AI lite — freeform after tools; non-blocking; hard timeout */
(function (global) {
  'use strict';

  async function ask(message) {
    const cfg = global.SN_CONFIG || {};
    const url = (cfg.sbUrl || global.SB_URL) + '/functions/v1/aicycle';
    const headers = global.SNAuth?.authHeaders
      ? await SNAuth.authHeaders()
      : {
          'Content-Type': 'application/json',
          apikey: cfg.sbKey || global.SB_KEY,
          Authorization: 'Bearer ' + (cfg.sbKey || global.SB_KEY),
        };
    const body = {
      mode: 'chat',
      message: String(message || '').slice(0, 900),
      system:
        'You are Grok inside Astranov SpaceNet — the real-Earth OS (solar→global→national→city). ' +
        'Short answers (2 sentences). Same language as user. No markdown lists. ' +
        'CLI: solar/global/national/city/earth, locate, crawl X, maps X, search X, job, date, deliver, task list/claim. ' +
        'Always suggest a concrete next CLI phrase when helpful.',
      fast: true,
      fallback_prefs: { force: 'groq', skip: [] },
    };
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const t = setTimeout(() => {
      try {
        ctrl?.abort();
      } catch (_) {}
    }, 12000);
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        signal: ctrl?.signal,
      });
      const j = await r.json().catch(() => ({}));
      const text = String(j.text || j.response || '').trim();
      if (!text || /try again|no model|warming/i.test(text)) return null;
      return text.slice(0, 400);
    } catch (_) {
      return null;
    } finally {
      clearTimeout(t);
    }
  }

  global.SNAi = { ask };
})(window);
