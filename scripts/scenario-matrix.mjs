/**
 * Usage scenario matrix — every user path from Astranov conversations.
 * Each entry: { id, group, run(page) }
 */

export const MATRIX = [
  // ── Boot & globals ──
  {
    id: 'boot-three',
    group: 'boot',
    run: async (page) => {
      const ok = await page.evaluate(() => !!window.THREE && !!window.CityMap?._ready);
      if (!ok) throw new Error('THREE or CityMap missing');
    },
  },
  {
    id: 'boot-modules',
    group: 'boot',
    run: async (page) => {
      const r = await page.evaluate(() => ({
        commerce: !!window.Commerce,
        yacht: !!window.YachtMatcher,
        auditor: !!window.AuditorPortal,
        avc: !!window.AvcJustice,
        unified: !!window.AstranovUnified,
        coin: !!window.CoinPortal,
        coders: !!window.AciCoders,
        voice: typeof window.fixVoiceHotwords === 'function',
        super: !!window.SuperCli,
      }));
      if (!r.commerce || !r.yacht || !r.auditor || !r.avc || !r.coin || !r.unified || !r.coders || !r.voice || !r.super) {
        throw new Error('module missing: ' + JSON.stringify(r));
      }
    },
  },
  {
    id: 'boot-perf-flag',
    group: 'boot',
    run: async (page) => {
      await page.evaluate(() => { window.setVoicePerfMode?.(true); });
      const on = await page.evaluate(() => !!window._voicePerfMode);
      if (!on) throw new Error('_voicePerfMode not set');
    },
  },

  // ── Theme ──
  {
    id: 'theme-dark',
    group: 'theme',
    run: async (page) => {
      await page.evaluate(() => AstranovTheme.set('dark'));
      const m = await page.evaluate(() => AstranovTheme.mode);
      if (m !== 'dark') throw new Error('dark failed');
    },
  },
  {
    id: 'theme-bright',
    group: 'theme',
    run: async (page) => {
      await page.evaluate(() => AstranovTheme.set('bright'));
      const m = await page.evaluate(() => AstranovTheme.mode);
      if (m !== 'bright') throw new Error('bright failed');
    },
  },
  {
    id: 'theme-toggle',
    group: 'theme',
    run: async (page) => {
      const m = await page.evaluate(() => { AstranovTheme.toggle(); return AstranovTheme.mode; });
      if (!m) throw new Error('toggle failed');
    },
  },

  // ── City map ──
  {
    id: 'city-enter-zoom',
    group: 'city',
    run: async (page) => {
      const r = await page.evaluate(() => {
        const z = (CityMap.ENTER_Z || 1.36) - 0.02;
        camera.position.z = z;
        CityMap.onCamera(z, 'earth');
        return { active: CityMap.active, cls: document.getElementById('city-map')?.classList.contains('active') };
      });
      if (!r.active || !r.cls) throw new Error('city enter failed: ' + JSON.stringify(r));
    },
  },
  {
    id: 'city-dropin-rhodes',
    group: 'city',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        await CityLife.dropIn(36.44, 28.22, { label: 'matrix' });
        const lat = window._lastPos?.lat;
        return { active: CityMap.active, lat, ok: CityMap.active && lat != null && Math.abs(lat - 36.44) <= 0.05 };
      });
      if (!r.ok) throw new Error('dropIn failed: ' + JSON.stringify(r));
    },
  },
  {
    id: 'city-demo-drivers',
    group: 'city',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        if (!CityMap.active) {
          camera.position.z = 1.34;
          CityMap.onCamera(1.34, 'earth');
        }
        await CityMap._tickDrivers?.();
        const keys = Object.keys(CityMap._markers || {}).filter(k => k.startsWith('drv_'));
        const demo = CityMap._demoDrivers?.length || 0;
        return { driverMarkers: keys.length, demo };
      });
      if (r.driverMarkers < 1 && r.demo < 1) throw new Error('no driver markers');
    },
  },

  // ── Commerce ──
  {
    id: 'commerce-parse-pitogyra',
    group: 'commerce',
    run: async (page) => {
      const w = await page.evaluate(() => Commerce.parseWantedItems('order pitogyra mpironia tsigareta'));
      if (w.length < 2) throw new Error('parse wanted failed: ' + w.length);
    },
  },
  {
    id: 'commerce-demo-drivers',
    group: 'commerce',
    run: async (page) => {
      const n = await page.evaluate(() => Commerce.demoDrivers(36.44, 28.22).length);
      if (n < 3) throw new Error('demo drivers < 3');
    },
  },
  {
    id: 'commerce-drivers-near',
    group: 'commerce',
    run: async (page) => {
      const n = await page.evaluate(async () => {
        const d = await Commerce.driversNear(36.44, 28.22);
        return d.length;
      });
      if (n < 1) throw new Error('driversNear empty');
    },
  },
  {
    id: 'commerce-vendor-score',
    group: 'commerce',
    run: async (page) => {
      const ok = await page.evaluate(() => {
        Commerce.vendors = Commerce.DEMO_VENDORS || [];
        const u = { lat: 36.44, lng: 28.22 };
        const wants = Commerce.parseWantedItems('pitogyra mpironia');
        const m = Commerce.scoreVendorForWants(Commerce.vendors[0], wants, u);
        return !!m && m.picks.length > 0;
      });
      if (!ok) throw new Error('vendor score failed');
    },
  },
  {
    id: 'commerce-platform-rate',
    group: 'commerce',
    run: async (page) => {
      const r = await page.evaluate(() => DeliveryPricing.PLATFORM_RATE);
      if (r !== 0.03) throw new Error('platform rate not 3%');
    },
  },
  {
    id: 'avc-peg-1to1',
    group: 'avc',
    run: async (page) => {
      const r = await page.evaluate(() => ({
        peg: AvcJustice.PEG_EUR,
        coin: AvcJustice.COIN,
        eur: AvcJustice.eurToAvc(10),
      }));
      if (r.peg !== 1 || r.coin !== 'AVC' || r.eur !== 10) throw new Error('peg failed: ' + JSON.stringify(r));
    },
  },
  {
    id: 'avc-format',
    group: 'avc',
    run: async (page) => {
      const s = await page.evaluate(() => AvcJustice.formatAvc(12.5));
      if (!/12\.50 AVC.*12\.50 EUR/.test(s)) throw new Error('format: ' + s);
    },
  },
  {
    id: 'avc-globe-pin',
    group: 'avc',
    run: async (page) => {
      const ok = await page.evaluate(() => {
        AvcJustice.syncGlobe();
        return GlobeEntity?.entities?.has('site-avc-ledger');
      });
      if (!ok) throw new Error('avc globe pin missing');
    },
  },
  {
    id: 'unified-pillars',
    group: 'unified',
    run: async (page) => {
      const n = await page.evaluate(() => AstranovUnified.PILLARS?.length);
      if (n !== 5) throw new Error('expected 5 pillars, got ' + n);
    },
  },
  {
    id: 'unified-globe-pin',
    group: 'unified',
    run: async (page) => {
      const ok = await page.evaluate(() => {
        AstranovUnified.syncGlobe();
        return GlobeEntity?.entities?.has('site-astranov-unified');
      });
      if (!ok) throw new Error('unified globe pin missing');
    },
  },
  {
    id: 'coin-portal-url',
    group: 'coin',
    run: async (page) => {
      const u = await page.evaluate(() => CoinPortal.SITE_URL);
      if (u !== 'https://coin.astranov.eu') throw new Error('coin url: ' + u);
    },
  },
  {
    id: 'coin-globe-pin',
    group: 'coin',
    run: async (page) => {
      const ok = await page.evaluate(() => {
        CoinPortal.syncGlobe();
        return GlobeEntity?.entities?.has('site-coin');
      });
      if (!ok) throw new Error('coin globe pin missing');
    },
  },
  {
    id: 'commerce-quote-math',
    group: 'commerce',
    run: async (page) => {
      const q = await page.evaluate(async () => DeliveryPricing.quote({ km: 2, kg: 4, subtotal_eur: 20 }));
      if (!q || q.platform_fee_eur <= 0 || q.total_eur <= q.subtotal_eur) {
        throw new Error('quote invalid: ' + JSON.stringify(q));
      }
    },
  },
  {
    id: 'commerce-globe-vendors',
    group: 'commerce',
    run: async (page) => {
      const n = await page.evaluate(() => {
        Commerce.vendors = Commerce.DEMO_VENDORS || [];
        Commerce.showOnGlobe();
        return [...(GlobeEntity?.entities?.values() || [])].filter(e => e.type === 'vendor').length;
      });
      if (n < 1) throw new Error('no vendor entities');
    },
  },
  {
    id: 'commerce-globe-drivers',
    group: 'commerce',
    run: async (page) => {
      const n = await page.evaluate(() => {
        Commerce.showDriversOnGlobe(Commerce.demoDrivers(36.44, 28.22));
        return [...(GlobeEntity?.entities?.values() || [])].filter(e => e.type === 'driver').length;
      });
      if (n < 1) throw new Error('no driver entities on globe');
    },
  },

  // ── Yachts ──
  {
    id: 'yacht-demo-fleet',
    group: 'yacht',
    run: async (page) => {
      const n = await page.evaluate(() => (YachtMatcher._demoYachts?.() || []).length);
      if (n < 1) throw new Error('no demo yachts');
    },
  },
  {
    id: 'yacht-guest-match',
    group: 'yacht',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        if (window.Auth) { Auth.user = null; Auth.session = null; }
        try {
          const res = await YachtMatcher.matchDemand({ guests: 8 });
          return { guest: !!res.guest, name: res.best?.name || res.text?.slice?.(0, 40) };
        } catch (e) {
          return { error: e.message };
        }
      });
      if (r.error) throw new Error(r.error);
      if (!r.guest && !r.name) throw new Error('guest match failed: ' + JSON.stringify(r));
    },
  },
  {
    id: 'yacht-globe-sync',
    group: 'yacht',
    run: async (page) => {
      const n = await page.evaluate(() => {
        const ys = YachtMatcher._demoYachts?.() || [];
        GlobeEntity.syncYachts(ys);
        return [...(GlobeEntity?.entities?.values() || [])].filter(e => e.type === 'yacht').length;
      });
      if (n < 1) throw new Error('yacht entities missing');
    },
  },
  {
    id: 'yacht-booking-url',
    group: 'yacht',
    run: async (page) => {
      const u = await page.evaluate(() => {
        const y = (YachtMatcher._demoYachts?.() || [])[0];
        return YachtMatcher.bookingUrl?.(y, { tab: 'booker' }) || '';
      });
      if (!/yachts\.astranov\.eu/.test(u)) throw new Error('bad booking url: ' + u);
    },
  },

  // ── Auditors ──
  {
    id: 'auditor-sync-globe',
    group: 'auditor',
    run: async (page) => {
      const ok = await page.evaluate(() => {
        AuditorPortal.syncGlobe();
        return GlobeEntity?.entities?.has('site-auditors');
      });
      if (!ok) throw new Error('auditor globe pin missing');
    },
  },
  {
    id: 'auditor-open-url',
    group: 'auditor',
    run: async (page) => {
      const u = await page.evaluate(() => AuditorPortal.open({ tab: 'dashboard' }));
      if (!/auditors\.astranov\.eu/.test(u)) throw new Error('bad auditor url');
    },
  },

  // ── Coders ──
  {
    id: 'coders-local-fix-cli',
    group: 'coders',
    run: async (page) => {
      const t = await page.evaluate(() => AciCoders.tryLocalFix('fix the cli lag'));
      if (!t || !/CLI reset|perf/i.test(t)) throw new Error('local fix cli: ' + t);
    },
  },
  {
    id: 'coders-local-fix-audit',
    group: 'coders',
    run: async (page) => {
      const t = await page.evaluate(() => AciCoders.tryLocalFix('open auditors invoice'));
      if (!t || !/auditor/i.test(t)) throw new Error('local fix audit: ' + t);
    },
  },
  {
    id: 'coders-local-fix-vendor',
    group: 'coders',
    run: async (page) => {
      const t = await page.evaluate(() => AciCoders.tryLocalFix('show vendors on map'));
      if (!t || !/vendor|scan/i.test(t)) throw new Error('local fix vendor: ' + t);
    },
  },
  {
    id: 'coders-intent-build',
    group: 'coders',
    run: async (page) => {
      const ok = await page.evaluate(() => AciCoders.isCodersIntent('fix the voice lag'));
      if (!ok) throw new Error('build intent not detected');
    },
  },
  {
    id: 'coders-handle-fix',
    group: 'coders',
    run: async (page) => {
      const r = await page.evaluate(async () => {
        const res = await AciCoders.handleMessage('coders fix cli input');
        return { ok: !!res?.local || !!res?.text, local: res?.local };
      });
      if (!r.ok) throw new Error('coders handle failed');
    },
  },
  {
    id: 'coders-listen-skips-perf',
    group: 'coders',
    run: async (page) => {
      await page.evaluate(() => { window._voicePerfMode = true; });
      const skipped = await page.evaluate(async () => {
        const before = AciCoders._listenTicks;
        await AciCoders.listenTick();
        return AciCoders._listenTicks === before;
      });
      if (!skipped) throw new Error('listenTick should skip in perf mode');
    },
  },

  // ── Voice ──
  {
    id: 'voice-hotword-coders',
    group: 'voice',
    run: async (page) => {
      const s = await page.evaluate(() => window.fixVoiceHotwords('code us fix the lag'));
      if (!/^coders\b/i.test(s)) throw new Error('hotword failed: ' + s);
    },
  },
  {
    id: 'voice-hotword-konter',
    group: 'voice',
    run: async (page) => {
      const s = await page.evaluate(() => window.fixVoiceHotwords('κοντερ φτιάξε το cli'));
      if (!/^coders\b/i.test(s)) throw new Error('greek hotword: ' + s);
    },
  },
  {
    id: 'voice-normalize-order',
    group: 'voice',
    run: async (page) => {
      const s = await page.evaluate(() => {
        const fn = window.normalizeVoiceCommand || (x => x);
        return fn('order pitogyra mpironia go');
      });
      if (!/pitogyra/i.test(s)) throw new Error('normalize failed: ' + s);
    },
  },
  {
    id: 'voice-queue-single',
    group: 'voice',
    run: async (page) => {
      const ok = await page.evaluate(() => {
        Voice.flush();
        return typeof Voice.enqueue === 'function' && Voice._queue instanceof Promise;
      });
      if (!ok) throw new Error('voice queue broken');
    },
  },
  {
    id: 'voice-should-speak-filter',
    group: 'voice',
    run: async (page) => {
      const ok = await page.evaluate(() => !Voice.shouldSpeak('{}') && Voice.shouldSpeak('hello world'));
      if (!ok) throw new Error('shouldSpeak filter wrong');
    },
  },
  {
    id: 'voice-pause-while-speaking',
    group: 'voice',
    run: async (page) => {
      const ok = await page.evaluate(() => {
        if (window.Voice) Voice.speaking = false;
        return typeof window.pauseVoiceRecognition === 'function' && !!window.Voice?.enqueue;
      });
      if (!ok) throw new Error('pause hook missing');
    },
  },

  // ── Driving ──
  {
    id: 'driving-haversine',
    group: 'driving',
    run: async (page) => {
      const d = await page.evaluate(() => DrivingView.haversineM(36.44, 28.22, 36.46, 28.24));
      if (d < 100 || d > 50000) throw new Error('haversine out of range: ' + d);
    },
  },
  {
    id: 'driving-deferred-watch',
    group: 'driving',
    run: async (page) => {
      const ok = await page.evaluate(() => typeof DrivingView._ensureWatch === 'function' && !DrivingView.watchId);
      if (!ok) throw new Error('watch should be deferred at boot');
    },
  },

  // ── CLI routing (SuperCli) ──
  ...cliCases(),

  // ── Voice command paths ──
  ...voiceCases(),
];

function cliCases() {
  const cmds = [
    ['help', true],
    ['dark', true],
    ['bright', true],
    ['theme dark', true],
    ['scenario list', true],
    ['status', true],
    ['locate me', true],
    ['city view', true],
    ['yacht list', true],
    ['yacht site', true],
    ['booker motor yacht rhodes', true],
    ['audit open', true],
    ['auditors open', true],
    ['avc justice', true],
    ['coin balance', true],
    ['drivers', true],
    ['hold', true],
    ['resume', true],
    ['sync', true],
    ['requests', true],
    ['players', true],
    ['coders fix cli input', false],
    ['order pitogyra mpironia', false],
  ];
  return cmds.map(([line, mustHandle]) => ({
    id: 'cli-' + line.replace(/\s+/g, '-').slice(0, 40),
    group: 'cli',
    run: async (page) => {
      const r = await page.evaluate(async ({ cmd, strict }) => {
        const out = [];
        const orig = AciCli?.print;
        if (AciCli) AciCli.print = (t) => out.push(String(t || ''));
        let handled = false;
        let err = null;
        try {
          const res = await SuperCli.exec(cmd, { fromVoice: false });
          handled = !!res?.handled;
        } catch (e) {
          err = e.message;
        }
        if (AciCli && orig) AciCli.print = orig;
        return { handled, err, out: out.length, strict };
      }, { cmd: line, strict: mustHandle });
      if (r.err) throw new Error(r.err);
      if (mustHandle && !r.handled) throw new Error('not handled: ' + line);
    },
  }));
}

function voiceCases() {
  const lines = [
    'coders fix the lag',
    'order pitogyra mpironia',
    'audit open',
    'yacht list',
    'locate me',
    'dark theme',
    'city view',
    'hold',
    'resume',
  ];
  return lines.map((line) => ({
    id: 'voice-cli-' + line.replace(/\s+/g, '-').slice(0, 36),
    group: 'voice-path',
    run: async (page) => {
      const r = await page.evaluate(async (cmd) => {
        const fixed = window.fixVoiceHotwords?.(cmd) || cmd;
        const norm = window.normalizeVoiceCommand?.(fixed) || fixed;
        return { fixed, norm, len: norm.length };
      }, line);
      if (r.len < 2) throw new Error('voice path empty for: ' + line);
    },
  }));
}

export const GROUPS = [...new Set(MATRIX.map(m => m.group))];

const STRESS_IDS = new Set([
  'boot-three', 'boot-modules', 'boot-perf-flag',
  'theme-dark', 'theme-bright', 'theme-toggle',
  'commerce-parse-pitogyra', 'commerce-demo-drivers', 'commerce-platform-rate', 'commerce-quote-math',
  'yacht-demo-fleet', 'yacht-booking-url',
  'auditor-sync-globe', 'auditor-open-url',
  'coders-local-fix-cli', 'coders-local-fix-audit', 'coders-local-fix-vendor',
  'coders-intent-build', 'coders-listen-skips-perf', 'coders-handle-fix',
  'voice-hotword-coders', 'voice-hotword-konter', 'voice-normalize-order',
  'voice-queue-single', 'voice-should-speak-filter', 'voice-pause-while-speaking',
  'driving-haversine', 'driving-deferred-watch',
  'voice-cli-coders-fix-the-lag', 'voice-cli-order-pitogyra-mpironia',
  'avc-peg-1to1', 'avc-format', 'avc-globe-pin',
  'unified-pillars', 'unified-globe-pin',
  'coin-portal-url', 'coin-globe-pin',
  'voice-cli-audit-open', 'voice-cli-yacht-list', 'voice-cli-locate-me',
]);

/** Lightweight scenarios safe for millions of repeat cycles (no heavy map/CLI side effects). */
export const STRESS_MATRIX = MATRIX.filter(m => STRESS_IDS.has(m.id));