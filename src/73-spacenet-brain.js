// === SPACENET BRAIN — local + AI intent classification for place menu ===
const SpaceNetBrain = {
  _crawlBusy: new Set(),
  _lastClassify: null,

  ACTION_IDS: ['list_vendor', 'list_shop', 'driver_base', 'post', 'upload_photo', 'upload_video', 'deliver_here', 'drive_here', 'route', 'explore', 'order'],

  async classifyIntent(text, ctx) {
    ctx = ctx || {};
    const trimmed = String(text || '').trim();
    if (!trimmed) {
      return {
        primary: ClassifiedTriangles.defaultTop3(),
        more: ClassifiedTriangles.defaultMore(),
        source: 'default',
      };
    }

    const local = ClassifiedTriangles.scoreLocal(trimmed);
    const primary = local.slice(0, 3);
    const more = local.slice(3);

    void this._refineWithAi(trimmed, ctx, local);

    if (ctx.lat != null && ctx.lng != null) {
      void this.crawlArea(ctx.lat, ctx.lng, ctx.radiusKm || 2);
    }

    this._lastClassify = { text: trimmed, primary, more, at: Date.now() };
    return { primary, more, source: 'local' };
  },

  async _refineWithAi(text, ctx, localHints) {
    const ids = this.ACTION_IDS.join(', ');
    const prompt = 'SpaceNet place intent at ' + (ctx.lat?.toFixed?.(4) || '?') + ',' + (ctx.lng?.toFixed?.(4) || '?')
      + ': "' + text + '". Reply with ONLY a JSON array of action ids (max 6) from: ' + ids
      + '. First 3 = most common for this intent.';
    const r = await AiRouter?.ask?.(prompt, { timeoutMs: 14000 });
    const raw = String(r?.text || r?.raw?.text || '').trim();
    const parsed = this._parseActionIds(raw);
    if (!parsed.length) return;
    const catalog = ClassifiedTriangles.CATALOG;
    const ordered = parsed.map(id => catalog.find(c => c.id === id)).filter(Boolean);
    const rest = catalog.filter(c => !ordered.find(o => o.id === c.id));
    const full = ordered.concat(rest);
    ClassifiedTriangles.render(full.slice(0, 3), full.slice(3), ctx.pin);
    this._lastClassify = { text, primary: full.slice(0, 3), more: full.slice(3), source: 'ai' };
  },

  _parseActionIds(raw) {
    try {
      const m = raw.match(/\[[\s\S]*?\]/);
      if (m) {
        const arr = JSON.parse(m[0]);
        if (Array.isArray(arr)) return arr.map(String).filter(id => this.ACTION_IDS.includes(id));
      }
    } catch (_) {}
    const found = [];
    for (const id of this.ACTION_IDS) {
      if (new RegExp(id.replace(/_/g, '[\\s_-]+'), 'i').test(raw)) found.push(id);
    }
    return found;
  },

  async crawlArea(lat, lng, radiusKm) {
    const key = lat.toFixed(3) + ',' + lng.toFixed(3);
    if (this._crawlBusy.has(key)) return;
    this._crawlBusy.add(key);
    try {
      const h = { 'Content-Type': 'application/json' };
      if (typeof SB_KEY !== 'undefined') h.apikey = SB_KEY;
      if (Auth?.session?.access_token) h.Authorization = 'Bearer ' + Auth.session.access_token;
      else if (typeof SB_KEY !== 'undefined') h.Authorization = 'Bearer ' + SB_KEY;
      await fetch((typeof SB_URL !== 'undefined' ? SB_URL : '') + '/functions/v1/vendor-crawler', {
        method: 'POST',
        headers: h,
        body: JSON.stringify({ lat, lng, radius_km: radiusKm || 2, source: 'spacenet-brain' }),
      });
      AciCli?.print?.('crawler · sector ' + key, 'dim');
    } catch (_) {}
    setTimeout(() => this._crawlBusy.delete(key), 120000);
  },
};
window.SpaceNetBrain = SpaceNetBrain;