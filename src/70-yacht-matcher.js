// === YACHT MATCHER — globe + Booker CLI bridge (yachts.astranov.eu) ===
const YachtMatcher = {
  SITE_ID: 'yachts',
  SITE_URL: 'https://yachts.astranov.eu',
  yachts: [],

  PORTS: {
    rhodes: [36.4412, 28.2225],
    rodos: [36.4412, 28.2225],
    kos: [36.8932, 27.2880],
    mykonos: [37.4467, 25.3289],
    santorini: [36.3932, 25.4615],
    athens: [37.9420, 23.6460],
    piraeus: [37.9420, 23.6460],
    corfu: [39.6243, 19.9217],
    crete: [35.3387, 25.1442],
    heraklion: [35.3387, 25.1442],
    mediterranean: [36.20, 24.50],
  },

  _engine() {
    return window.AstranovMatchEngine;
  },

  CREW_RATES: { captain: 300, vice_captain: 200, cadet: 100 },

  coordsFor(y, idx) {
    const loc = (y.base_location || y.metadata?.base_location || '').toLowerCase();
    for (const k of Object.keys(this.PORTS)) {
      if (loc.includes(k)) return this.PORTS[k];
    }
    const seed = (y.id || y.name || String(idx)).split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const lat = 34.5 + (seed % 700) / 100;
    const lng = 22 + ((seed >> 4) % 1200) / 100;
    return [lat, lng];
  },

  bookingUrl(yacht, opts) {
    const u = new URL(this.SITE_URL);
    if (yacht?.id) u.searchParams.set('yacht_id', yacht.id);
    if (opts?.tab) u.searchParams.set('tab', opts.tab);
    if (opts?.start_date) u.searchParams.set('start_date', opts.start_date);
    if (opts?.end_date) u.searchParams.set('end_date', opts.end_date);
    if (opts?.guests) u.searchParams.set('guests', String(opts.guests));
    return u.toString();
  },

  openBooking(yacht, opts) {
    const url = this.bookingUrl(yacht, { tab: 'booker', ...opts });
    const meta = {
      domain: 'yachts.astranov.eu',
      site_id: this.SITE_ID,
      title: yacht?.name || 'AstranoV Yachting',
      url,
    };
    if (window.AstranovSiteShell?.open) {
      AstranovSiteShell.open(url, meta);
    } else {
      window.open(url, '_blank', 'noopener');
    }
    AciCli?.print?.('⛵ ' + (yacht?.name || 'yachts.astranov.eu'), 'ok');
    return url;
  },

  async loadYachts() {
    if (!Auth?.client) {
      this.yachts = this._demoYachts();
      return this.yachts;
    }
    try {
      const { data, error } = await Auth.client
        .from('yachting_yachts')
        .select('id,name,yacht_type,base_location,guest_capacity,cabins,length_m,minimum_crew,price_week,currency,characteristics,active')
        .eq('active', true)
        .order('name');
      if (error) throw error;
      this.yachts = data || [];
      if (!this.yachts.length) this.yachts = this._demoYachts();
    } catch (e) {
      console.warn('yacht load', e);
      this.yachts = this._demoYachts();
    }
    return this.yachts;
  },

  _demoYachts() {
    return [
      { id: 'demo-serenity', name: 'AstranoV Serenity 78', yacht_type: 'Motor Yacht', base_location: 'Rhodes', guest_capacity: 10, length_m: 24, minimum_crew: 3, price_week: 42000, currency: 'EUR' },
      { id: 'demo-aether', name: 'Aether Blue 62', yacht_type: 'Eco Yacht', base_location: 'Kos', guest_capacity: 8, length_m: 11, minimum_crew: 2, price_week: 28500, currency: 'EUR' },
    ];
  },

  syncGlobe() {
    GlobeEntity?.syncYachts?.(this.yachts);
    MapComms?.postSystem?.('⛵ ' + this.yachts.length + ' yacht' + (this.yachts.length === 1 ? '' : 's') + ' on globe — tap to book · yachts.astranov.eu');
  },

  async loadAndSyncGlobe() {
    await this.loadYachts();
    this.syncGlobe();
    return this.yachts;
  },

  findYacht(query) {
    const q = (query || '').toLowerCase().trim();
    if (!q) return null;
    return this.yachts.find(y => y.id === q)
      || this.yachts.find(y => (y.name || '').toLowerCase().includes(q))
      || this.yachts.find(y => (y.base_location || '').toLowerCase().includes(q));
  },

  listText() {
    if (!this.yachts.length) return 'No yachts on map — say yacht refresh';
    return this.yachts.map(y => {
      const c = this.coordsFor(y, 0);
      return (y.name || 'Yacht') + ' · ' + (y.yacht_type || '') + ' · ' + (y.base_location || 'Med')
        + ' · ' + (y.guest_capacity || '?') + ' pax · ' + (y.price_week ? y.price_week + ' EUR/wk' : 'quote')
        + ' · [' + c[0].toFixed(2) + ',' + c[1].toFixed(2) + ']';
    }).join('\n');
  },

  async matchDemand(opts) {
    const eng = this._engine();
    if (!eng) throw new Error('Match engine not loaded');
    opts = opts || {};
    const cfg = {
      siteId: opts.site_id || opts.siteId || this.SITE_ID,
      businessType: opts.business_type || 'yacht_charter',
      customer_id: Auth?.user?.id,
    };
    const supa = Auth?.client;
    if (!supa) {
      const demo = this.yachts?.length ? this.yachts : this._demoYachts();
      const best = demo[0];
      if (!best) throw new Error('No yachts — say yacht refresh');
      return {
        best,
        demand: opts,
        guest: true,
        via: 'demo',
        text: this.formatMatch(best),
      };
    }
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

  async bookerChat(message, ctx) {
    if (!AciCli?.api) throw new Error('CLI not ready');
    const r = await AciCli.api({
      mode: 'booker_chat',
      message,
      site_id: this.SITE_ID,
      stage: ctx?.stage || 'collect',
      demand: ctx?.demand || {},
      match: ctx?.match || null,
      suggestions: ctx?.suggestions || [],
      history: ctx?.history || [],
      fast: false,
    });
    return r;
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
    if (sub === 'help' || sub === '?') {
      ACIControl?.reply('yacht list · yacht open <name> · yacht book <start> <end> [pax] · booker <message> · yacht site · match yachts dates pax');
      AciCli?.print('yacht list | open | book | refresh | site · booker <charter request>', 'ok');
      return;
    }
    if (sub === 'list' || sub === 'fleet') {
      const txt = this.listText();
      ACIControl?.reply(this.yachts.length + ' yachts on globe');
      AciCli?.print(txt, 'ok');
      return;
    }
    if (sub === 'refresh' || sub === 'sync') {
      await this.loadAndSyncGlobe();
      ACIControl?.reply('Yacht fleet synced on globe');
      return;
    }
    if (sub === 'site' || sub === 'open' && !parts[2]) {
      this.openBooking(null, { tab: 'booker' });
      ACIControl?.reply('yachts.astranov.eu — Booker + manual backbone');
      return;
    }
    if (sub === 'open' && parts[2]) {
      const y = this.findYacht(parts.slice(2).join(' '));
      if (!y) { ACIControl?.reply('Yacht not found — yacht list'); return; }
      this.openBooking(y);
      GlobeEntity?.flyTo?.(GlobeEntity.entities.get('yacht-' + y.id));
      ACIControl?.reply('Opening ' + y.name + ' on yachts.astranov.eu');
      return;
    }
    if (sub === 'book' && parts[2] && parts[3]) {
      const start = parts[2];
      const end = parts[3];
      const guests = Number(parts[4] || 8);
      const nameQ = parts.slice(5).join(' ').trim();
      try {
        const r = await this.matchDemand({ site_id: this.SITE_ID, start_date: start, end_date: end, guests });
        const msg = r.best ? this.formatMatch(r.best) : 'No match — try yacht list or flex dates';
        ACICli?.print(msg, r.best ? 'ok' : 'dim');
        ACIControl?.reply(msg);
        if (r.best) {
          const y = r.best.supply;
          const yacht = this.yachts.find(x => x.id === y.id) || { id: y.id, name: y.name };
          this.openBooking(yacht, { start_date: start, end_date: end, guests, tab: 'booker' });
        } else {
          this.openBooking(null, { start_date: start, end_date: end, guests, tab: 'booker' });
        }
        return r;
      } catch (e) {
        ACIControl?.reply(e.message || String(e));
        this.openBooking(null, { start_date: start, end_date: end, guests, tab: 'booker' });
      }
      return;
    }
    if (sub === 'field' && parts[2]) {
      const siteId = parts[2];
      const name = parts.slice(3).join('_') || 'custom_field';
      await this.requestField(siteId, { id: name, type: 'text', label: name, description: 'User requested via CLI' });
      ACIControl?.reply('Field «' + name + '» requested — Coders will develop it');
      return;
    }
    if (sub === 'match' || sub === 'charter') {
      const siteId = parts[2] || this.SITE_ID;
      const start = parts[3];
      const end = parts[4];
      const passengers = Number(parts[5] || 8);
      const r = await this.matchDemand({ site_id: siteId, start_date: start, end_date: end, guests: passengers });
      const msg = r.best ? this.formatMatch(r.best) : 'No match — yacht list · yacht book dates pax';
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
    ACIControl?.reply('yacht list · open <name> · book <start> <end> [pax] · site · booker <message>');
  },

  async bookerCli(parts) {
    const msg = parts.slice(1).join(' ').trim();
    if (!msg) {
      ACIControl?.reply('booker <your charter request> — Astranov Brain · Agent Booker');
      this.openBooking(null, { tab: 'booker' });
      return;
    }
    try {
      const r = await this.bookerChat(msg, { stage: 'collect' });
      const text = r.text || r.response || 'Booker is thinking…';
      ACICli?.print('Booker: ' + text, 'ok');
      ACIControl?.reply(text.slice(0, 500));
      if (r.patch) AciCli?.print('fields: ' + JSON.stringify(r.patch), 'dim');
      if (r.action === 'transmit' || /transmit|book/i.test(msg)) {
        this.openBooking(null, { tab: 'booker', ...r.patch });
      }
      return r;
    } catch (e) {
      ACIControl?.reply('Booker offline — opening manual site');
      this.openBooking(null, { tab: 'booker' });
    }
  },

  async evolveFromText(text) {
    const eng = this._engine();
    const low = (text || '').toLowerCase();
    if (/book\s+(a\s+)?yacht|charter|ενοικ.*γιοτ|yacht\s+book|find\s+yacht/.test(low)) {
      const dates = text.match(/(\d{4}-\d{2}-\d{2})/g) || [];
      const guests = Number((text.match(/(\d+)\s*(guests?|pax|people)/i) || [])[1] || 8);
      if (dates.length >= 2) {
        try {
          const r = await this.matchDemand({ site_id: this.SITE_ID, start_date: dates[0], end_date: dates[1], guests });
          if (r.best) {
            const y = this.yachts.find(x => x.id === r.best.supply?.id) || { id: r.best.supply?.id, name: r.best.supply?.name };
            this.openBooking(y, { start_date: dates[0], end_date: dates[1], guests, tab: 'booker' });
            return r;
          }
        } catch (_) {}
      }
      this.openBooking(null, { tab: 'booker' });
      try {
        const br = await this.bookerChat(text, { stage: 'collect' });
        if (br?.text) ACIControl?.reply(br.text.slice(0, 400));
        return br;
      } catch (_) {}
      return { opened: this.SITE_URL };
    }
    if (!eng) return null;
    const dates = text.match(/(\d{4}-\d{2}-\d{2})/g) || [];
    const siteM = text.match(/site\s+([a-z0-9-]+)/i);
    if (dates.length >= 2 && siteM) {
      return this.matchDemand({ site_id: siteM[1], start_date: dates[0], end_date: dates[1], guests: 4 });
    }
    return eng.evolveFromText(text, { businessType: 'yacht_charter', siteId: this.SITE_ID });
  },

  listDriversText() {
    return MarketplaceComms?.listDriversText?.() || '';
  },
};

window.YachtMatcher = YachtMatcher;