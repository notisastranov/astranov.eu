// === YACHT MATCHER — globe bridge to AstranovMatchEngine (canonical: superbooking/core) ===
const YachtMatcher = {
  _engine() {
    return window.AstranovMatchEngine;
  },

  CREW_RATES: { captain: 300, vice_captain: 200, cadet: 100 },

  async matchDemand(opts) {
    const eng = this._engine();
    if (!eng) throw new Error('Match engine not loaded');
    opts = opts || {};
    const cfg = {
      siteId: opts.site_id || opts.siteId || 'yachts',
      businessType: opts.business_type || 'yacht_charter',
      customer_id: Auth?.user?.id,
    };
    const supa = Auth?.client;
    if (!supa) throw new Error('Sign in for yacht match');
    const r = await eng.matchDemand(supa, cfg, opts);
    if (opts.persist !== false && r.best) {
      try { await eng.persistMatch(supa, cfg, r.demand, r); } catch (_) {}
    }
    return r;
  },

  formatMatch(m) {
    return this._engine()?.formatMatch?.(m, this._engine()?.resolveConfig?.({ businessType: 'yacht_charter' }))
      || 'No match';
  },

  async upsertYacht(siteId, spec) {
    if (!Auth?.client) throw new Error('login required');
    const row = {
      site_id: siteId,
      kind: 'yacht',
      name: spec.name || 'Yacht',
      max_passengers: Number(spec.max_passengers || 8),
      max_hire_days: Number(spec.max_hire_days || 14),
      price_per_day_eur: Number(spec.price_per_day || spec.price || 0),
      metadata: { required_crew: spec.required_crew || { captain: 1, vice_captain: 1, cadet: 1 } },
      active: true,
    };
    const { data, error } = await Auth.client.from('booker_supply').insert(row).select().single();
    if (error) throw error;
    AciCoders?.observeActivity?.('yacht_spec', 'supply added · ' + row.name, { siteId });
    return data;
  },

  async requestField(siteId, spec) {
    return this._engine()?.requestField?.(Auth?.client, siteId, Auth?.user?.id, spec);
  },

  async activateFields(siteId, fields) {
    if (!Auth?.client) return;
    await Auth.client.from('booker_match_config').upsert({
      site_id: siteId,
      enabled: true,
      active_fields: fields,
      updated_at: new Date().toISOString(),
    });
    ACIControl?.reply('Match fields activated for ' + siteId);
  },

  async cli(parts) {
    const sub = (parts[1] || 'help').toLowerCase();
    if (sub === 'help') {
      ACIControl?.reply('match <site> <start> <end> [pax] · match field <site> <name> · yacht add <site> …');
      return;
    }
    if (sub === 'field' && parts[2]) {
      const siteId = parts[2];
      const name = parts.slice(3).join('_') || 'custom_field';
      await this.requestField(siteId, { id: name, type: 'text', label: name, description: 'User requested via CLI' });
      ACIControl?.reply('Field «' + name + '» requested — Coders will develop it');
      AciCoders?.observeActivity?.('field_request', name + ' for ' + siteId, { siteId });
      try {
        await AciCli.api({ mode: 'coders_chat', message: 'Develop match field ' + name + ' for site ' + siteId + ' business booking', fast: false });
      } catch (_) {}
      return;
    }
    if (sub === 'match' || sub === 'charter') {
      const siteId = parts[2];
      const start = parts[3];
      const end = parts[4];
      const passengers = Number(parts[5] || 2);
      const r = await this.matchDemand({ site_id: siteId, start_date: start, end_date: end, passengers });
      const msg = r.best ? this.formatMatch(r.best) : 'No match — add supply/resources or ask Coders';
      ACIControl?.reply(msg);
      AciCli?.print(msg, r.best ? 'ok' : 'dim');
      MapComms?.postSystem?.('⛵ ' + msg.slice(0, 200));
      return r;
    }
    if (sub === 'add' && parts[2]) {
      return this.upsertYacht(parts[2], {
        name: parts[3] || 'Yacht',
        max_passengers: Number(parts[4] || 8),
        max_hire_days: Number(parts[5] || 14),
        price_per_day: Number(parts[6] || 500),
      });
    }
    ACIControl?.reply('match <site> dates [pax] · match field <site> <name>');
  },

  async evolveFromText(text) {
    const eng = this._engine();
    if (!eng) return null;
    const ev = eng.evolveFromText(text, { businessType: 'yacht_charter', siteId: 'yachts' });
    const dates = text.match(/(\d{4}-\d{2}-\d{2})/g) || [];
    const siteM = text.match(/site\s+([a-z0-9-]+)/i);
    if (dates.length >= 2 && siteM) {
      return this.matchDemand({ site_id: siteM[1], start_date: dates[0], end_date: dates[1], passengers: 4 });
    }
    return ev;
  },

  listDriversText() {
    return MarketplaceComms?.listDriversText?.() || '';
  },
};

window.YachtMatcher = YachtMatcher;