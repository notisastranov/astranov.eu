// === SPACENET GROK CLI — Grok-style agent that can do anything on Astranov SpaceNet ===
// Freeform natural language → multi-tool plans. Never dead-ends with "unknown".
// SpaceNet vision: solar → global → national → city → street — replace the open internet UX.
const SpaceNetGrokCli = {
  version: '20260722-spacex-spacenet',
  history: [],
  busy: false,

  TOOLS: {
    locate: { desc: 'GPS drop-in / city map at you', run: 'locate' },
    fly: { desc: 'Fly globe to a place', run: 'fly' },
    zoom: { desc: 'Zoom tier: solar|global|national|city|street', run: 'zoom' },
    city: { desc: 'Open city / street map', run: 'city' },
    browse: { desc: 'In-OS browser (SpaceNet replaces tabs)', run: 'browse' },
    open: { desc: 'Open astranov:// or https in OS browser', run: 'open' },
    order: { desc: 'Shops / delivery marketplace', run: 'order' },
    market: { desc: 'Marketplace + field', run: 'market' },
    starlink: { desc: 'Starlink constellation on globe', run: 'starlink' },
    starship: { desc: 'Starship / SpaceX launch sim', run: 'starship' },
    spacex: { desc: 'SpaceX video tiles + brand skin', run: 'spacex' },
    crawl: { desc: 'SpaceNet crawl sector (vendors/news/weather)', run: 'crawl' },
    news: { desc: 'World news on field', run: 'news' },
    drive: { desc: 'Drive mode', run: 'drive' },
    call: { desc: 'Voice / video call path', run: 'call' },
    os: { desc: 'Astranov OS dock / system', run: 'os' },
    theme: { desc: 'Theme: spacex|dark|bright|auto', run: 'theme' },
    status: { desc: 'System + SpaceNet status', run: 'status' },
    help: { desc: 'This help', run: 'help' },
    coders: { desc: 'Talk to Grok / build queue', run: 'coders' },
    plus: { desc: 'Open Super Add / social field', run: 'plus' },
    search: { desc: 'Search users / cloud CLI', run: 'search' },
  },

  CITIES: {
    athens: [37.9838, 23.7275], rhodes: [36.4341, 28.2176], london: [51.5074, -0.1278],
    paris: [48.8566, 2.3522], berlin: [52.52, 13.405], rome: [41.9028, 12.4964],
    newyork: [40.7128, -74.006], tokyo: [35.6762, 139.6503], dubai: [25.2048, 55.2708],
    starbase: [25.997, -97.156], hawthorne: [33.9207, -118.3278], cape: [28.5721, -80.648],
    houston: [29.7604, -95.3698], seattle: [47.6062, -122.3321],
  },

  init() {
    if (this._inited) return;
    this._inited = true;
    window.SpaceNetGrokCli = this;
    try {
      const input = document.getElementById('aci-cli-in');
      if (input && !input.dataset.spacenetGrok) {
        input.dataset.spacenetGrok = '1';
        input.placeholder = 'Grok · SpaceNet — ask anything · locate · fly · browse · order';
      }
      const prompt = document.getElementById('aci-cli-prompt');
      if (prompt && !Auth?.user) prompt.textContent = '›';
    } catch (_) {}
    console.info('%c[SpaceNetGrokCli] ' + this.version + ' — SpaceX skin · do-anything CLI', 'color:#fff;background:#000;font-weight:700;padding:2px 6px');
  },

  printHelp() {
    AciCli?.print?.('── SpaceNet · Grok CLI · replace the internet ──', 'dim');
    AciCli?.print?.('Natural language works. Examples:', 'ok');
    AciCli?.print?.('  locate me · fly starbase · zoom solar · city map', 'ok');
    AciCli?.print?.('  browse https://x.com · open astranov://market', 'ok');
    AciCli?.print?.('  order food · starlink · starship · crawl here', 'ok');
    AciCli?.print?.('  theme spacex · status · help · + · search peers', 'ok');
    AciCli?.print?.('Tiers: SOLAR → GLOBAL → NATIONAL → CITY → STREET', 'dim');
    AciCli?.print?.('Tools: ' + Object.keys(this.TOOLS).join(' · '), 'dim');
    GlobeDeck?.setPreview?.('SpaceNet CLI ready — type anything');
    CliRibbon?.setNotice?.('Grok · SpaceNet', 'ready');
  },

  /** Multi-tool plan from freeform text */
  plan(message) {
    const m = String(message || '').trim();
    const low = m.toLowerCase();
    const actions = [];
    let intent = 'chat';

    if (/^help$|^\?$|what can you do|commands|how do i/i.test(low)) {
      return { message: m, intent: 'help', actions: [{ type: 'help' }] };
    }
    if (/\b(status|sysinfo|whoami|diagnostics)\b/i.test(low) && m.length < 40) {
      return { message: m, intent: 'status', actions: [{ type: 'status' }] };
    }
    if (/\btheme\b|\bspacex\s*skin\b|\bfalcon\s*theme\b|\bstarship\s*ui\b/i.test(low)
      || /^(dark|bright|spacex|auto)$/i.test(low)) {
      const mode = (low.match(/\b(spacex|dark|bright|auto|light)\b/) || [])[1] || 'spacex';
      return { message: m, intent: 'theme', actions: [{ type: 'theme', mode: mode === 'light' ? 'bright' : mode }] };
    }
    if (/locate|where am i|find me|gps|drop\s*in|🎯|📍/i.test(low) || /^(me|here)$/i.test(low)) {
      intent = 'locate';
      actions.push({ type: 'locate' });
    }
    for (const [name, ll] of Object.entries(this.CITIES)) {
      if (new RegExp('\\b' + name + '\\b', 'i').test(low)
        || (name === 'newyork' && /\bnew\s*york\b/i.test(low))
        || (name === 'cape' && /\bcape\s*(canaveral|kennedy)\b/i.test(low))) {
        intent = 'fly';
        actions.push({ type: 'fly', lat: ll[0], lng: ll[1], label: name });
        break;
      }
    }
    if (/\b(zoom|go\s*to|show)\b/i.test(low) || /^(solar|global|national|city|street)$/i.test(low)) {
      let tier = 'global';
      if (/\bsolar|galaxy|cosmos|space\b/i.test(low)) tier = 'solar';
      else if (/\bnational|country\b/i.test(low)) tier = 'national';
      else if (/\bstreet|neighborhood\b/i.test(low)) tier = 'city';
      else if (/\bcity\b/i.test(low)) tier = 'city';
      else if (/\bearth|world|global\b/i.test(low)) tier = 'global';
      if (!actions.some(a => a.type === 'fly')) {
        intent = intent === 'chat' ? 'zoom' : intent;
        actions.push({ type: 'zoom', tier });
      }
    }
    if (/\bcity\s*(map|view)|street\s*map|shops\s*near\b/i.test(low) && !actions.some(a => a.type === 'city')) {
      intent = 'city';
      actions.push({ type: 'city' });
    }
    // Browse / open — internet replacement
    const urlMatch = m.match(/https?:\/\/[^\s]+/i) || m.match(/astranov:\/\/[^\s]+/i);
    if (urlMatch || /\b(browse|open\s+site|open\s+url|visit|navigate\s+to|go\s+to\s+http)\b/i.test(low)) {
      intent = 'browse';
      const url = urlMatch ? urlMatch[0] : this._guessUrl(low);
      actions.push({ type: 'browse', url });
    }
    if (/\border|buy|shop|food|delivery|gyro|pizza|market\b/i.test(low) && !/\bstock\s*market\b/i.test(low)) {
      intent = 'order';
      actions.push({ type: 'order', query: m });
    }
    if (/\bstarlink|constellation|leo\s*sats?\b/i.test(low)) {
      actions.push({ type: 'starlink' });
      intent = 'starlink';
    }
    if (/\bstarship|flight\s*\d+|ift|starbase\s*launch\b/i.test(low)) {
      actions.push({ type: 'starship' });
      intent = 'starship';
    }
    if (/\bspacex\b/i.test(low) && !actions.some(a => a.type === 'starship' || a.type === 'starlink')) {
      actions.push({ type: 'spacex' });
      intent = 'spacex';
    }
    if (/\bcrawl|spacenet\s*scan|ingest|scan\s*(area|sector|city)\b/i.test(low)) {
      actions.push({ type: 'crawl' });
      intent = 'crawl';
    }
    if (/\bnews|headlines\b/i.test(low)) actions.push({ type: 'news' });
    if (/\bdrive\s*mode|start\s*driving\b/i.test(low)) actions.push({ type: 'drive' });
    if (/\b(call|video\s*call|phone)\b/i.test(low)) actions.push({ type: 'call' });
    if (/\b(os|dock|system\s*panel|desktop)\b/i.test(low)) actions.push({ type: 'os' });
    if (/\b(coders|summon\s*grok|talk\s*to\s*grok|build\s+me)\b/i.test(low)) actions.push({ type: 'coders', query: m });
    if (/\b(search\s+users|find\s+peer|cli\s+search)\b/i.test(low)) actions.push({ type: 'search', query: m });
    if (/\b(super\s*add|\+\s*post|open\s*\+)\b/i.test(low) || low === '+') actions.push({ type: 'plus' });
    // Internet replacement framing
    if (/\breplace\s+the\s+internet|what\s+is\s+spacenet|spacenet\s+mission\b/i.test(low)) {
      intent = 'mission';
      actions.push({ type: 'mission' });
    }

    return { message: m, low, intent, actions };
  },

  _guessUrl(low) {
    if (/\btwitter\b|\bx\.com\b/i.test(low)) return 'https://x.com';
    if (/\bgithub\b/i.test(low)) return 'https://github.com';
    if (/\byoutube\b/i.test(low)) return 'https://youtube.com';
    if (/\bspacex\b/i.test(low)) return 'https://www.spacex.com';
    if (/\bmarket|shop\b/i.test(low)) return 'astranov://market';
    if (/\bhome|earth\b/i.test(low)) return 'astranov://home';
    return 'astranov://home';
  },

  async execute(plan) {
    const results = [];
    for (const a of plan.actions || []) {
      try {
        if (a.type === 'help') { this.printHelp(); results.push('help'); }
        else if (a.type === 'mission') {
          const msg = 'SpaceNet unifies the open internet under a zoomable cosmos — solar → global → national → city → street. Browse, order, call, build, and live on one globe OS.';
          AciCli?.print?.(msg, 'ok');
          GlobeDeck?.setPreview?.(msg.slice(0, 140));
          results.push('mission');
        }
        else if (a.type === 'status') {
          const snap = {
            build: document.querySelector('meta[name="astranov-build"]')?.content,
            theme: document.documentElement.dataset.theme || AstranovTheme?.mode,
            skin: document.documentElement.dataset.skin || 'spacex',
            tier: ZoomTiers?.current?.()?.id || CosmicZoom?.level,
            user: Auth?.user?.email || 'guest',
            os: !!window.AstranovOS,
            grok: this.version,
          };
          AciCli?.print?.(JSON.stringify(snap), 'out');
          results.push('status');
        }
        else if (a.type === 'theme') {
          const mode = a.mode || 'spacex';
          if (mode === 'spacex') AstranovTheme?.setSpacex?.(true) || AstranovTheme?.set?.('dark');
          else AstranovTheme?.set?.(mode);
          document.documentElement.dataset.skin = mode === 'spacex' ? 'spacex' : (mode || 'default');
          AciCli?.print?.('theme → ' + mode + ' (SpaceX industrial)', 'ok');
          results.push('theme ' + mode);
        }
        else if (a.type === 'locate') {
          if (SuperCli?.run) await SuperCli.run('locate');
          else if (CityLife?.locateAndDropIn) await CityLife.locateAndDropIn();
          results.push('locate');
        }
        else if (a.type === 'fly') {
          GlobeControl?.flyToLatLng?.(a.lat, a.lng, a.label, GlobeControl?.Z?.national, {});
          MapDepict?.pulse?.(a.lat, a.lng, 0xffffff, a.label, 8000);
          results.push('fly ' + a.label);
        }
        else if (a.type === 'zoom') {
          ZoomTiers?.goTo?.(a.tier, true);
          results.push('zoom ' + a.tier);
        }
        else if (a.type === 'city') {
          const p = window._lastPos || { lat: 36.43, lng: 28.22 };
          await enterCityView?.(p.lat, p.lng, { openShops: true });
          results.push('city');
        }
        else if (a.type === 'browse' || a.type === 'open') {
          await this._browse(a.url || 'astranov://home');
          results.push('browse');
        }
        else if (a.type === 'order') {
          await LazyModules?.ensure?.().catch(() => {});
          if (Commerce?.showPicker) await Commerce.showPicker();
          else if (SuperCli?.run) await SuperCli.run('order');
          results.push('order');
        }
        else if (a.type === 'market') {
          MenuProfilePostTile?.openPlusField?.();
          results.push('market');
        }
        else if (a.type === 'starlink') {
          StarlinkConstellation?.init?.();
          await StarlinkConstellation?.handleCli?.(a.query || 'starlink');
          results.push('starlink');
        }
        else if (a.type === 'starship') {
          StarshipFlight13?.init?.();
          await StarshipFlight13?.handleCli?.(a.query || 'starship');
          results.push('starship');
        }
        else if (a.type === 'spacex') {
          document.documentElement.dataset.skin = 'spacex';
          AstranovTheme?.setSpacex?.(true);
          GlobeInfoTiles?.init?.();
          void GlobeInfoTiles?.refreshSpaceXVideos?.({ fly: false });
          AciCli?.print?.('SpaceX skin + mission tiles online', 'ok');
          results.push('spacex');
        }
        else if (a.type === 'crawl') {
          const p = window._lastPos || { lat: 36.43, lng: 28.22 };
          await SpaceNetBrain?.crawlAll?.(p.lat, p.lng, 3, { force: true });
          results.push('crawl');
        }
        else if (a.type === 'news') {
          window.NewsFeed?.flash?.();
          Comms?.loadNews?.();
          results.push('news');
        }
        else if (a.type === 'drive') {
          DrivingView?.activate?.();
          results.push('drive');
        }
        else if (a.type === 'call') {
          if (SuperCli?.run) await SuperCli.run('phone');
          results.push('call');
        }
        else if (a.type === 'os') {
          try {
            if (!window.AstranovOS) {
              await this._loadScript('/js/08-astranov-os.js');
              await this._loadScript('/js/08-astranov-browser.js');
            }
            AstranovOS?.init?.();
            AstranovOS?.setMode?.('system') || AstranovOS?.show?.();
            results.push('os');
          } catch (e) {
            results.push('os soft-fail');
          }
        }
        else if (a.type === 'coders') {
          await AciCoders?.enterSession?.({ expand: true, focus: true });
          if (a.query && !/^(coders|grok)$/i.test(a.query.trim())) {
            await AciCoders?.handleMessage?.(a.query);
          }
          results.push('grok');
        }
        else if (a.type === 'search') {
          await CliHub?.runSearch?.(String(a.query || '').replace(/^search\s*/i, '') || 'a');
          results.push('search');
        }
        else if (a.type === 'plus') {
          MenuProfilePostTile?.openPlusField?.() || SuperAdd?.open?.();
          results.push('plus');
        }
      } catch (e) {
        results.push(a.type + ' failed');
      }
    }
    return results;
  },

  _loadScript(src) {
    return new Promise((resolve, reject) => {
      if (document.querySelector('script[data-sn="' + src + '"]')) return resolve();
      const s = document.createElement('script');
      s.src = src + (src.includes('?') ? '&' : '?') + 'v=' + (document.querySelector('meta[name="astranov-build"]')?.content || '1');
      s.async = true;
      s.dataset.sn = src;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error(src));
      document.head.appendChild(s);
    });
  },

  async _browse(url) {
    url = String(url || 'astranov://home').trim();
    try {
      if (!window.AstranovBrowser) {
        await this._loadScript('/js/08-astranov-os.js').catch(() => {});
        await this._loadScript('/js/08-astranov-browser.js').catch(() => {});
      }
      AstranovOS?.init?.();
      if (AstranovBrowser?.navigate) {
        AstranovBrowser.show?.();
        AstranovBrowser.navigate(url);
        AciCli?.print?.('SpaceNet browser → ' + url, 'ok');
        return;
      }
      if (AstranovOS?.setMode) {
        AstranovOS.setMode('browser');
        AciCli?.print?.('OS browser · ' + url, 'ok');
        return;
      }
    } catch (_) {}
    // Fallback: open new tab only for https (never leave SpaceNet for astranov://)
    if (/^https?:\/\//i.test(url)) {
      window.open(url, '_blank', 'noopener,noreferrer');
      AciCli?.print?.('opened external · ' + url, 'dim');
    } else {
      AciCli?.print?.('browser module loading — try again in a moment: ' + url, 'dim');
    }
  },

  localReply(plan, results) {
    const acted = (results || []).filter(Boolean);
    if (plan.intent === 'help') return '';
    if (plan.intent === 'mission') return '';
    if (acted.length) {
      return 'SpaceNet · ' + acted.join(' · ') + '. What next?';
    }
    if (plan.intent === 'chat') {
      return 'SpaceNet online. Try: locate · fly starbase · browse · order · starlink · theme spacex — or just ask.';
    }
    return 'OK · SpaceNet ready.';
  },

  /**
   * Primary freeform entry — Grok-style. Always handled.
   */
  async handle(message, opts = {}) {
    this.init();
    const raw = String((window.fixVoiceHotwords || (x => x))(String(message || ''))).trim();
    if (!raw) {
      this.printHelp();
      return { ok: true, help: true };
    }

    // Architect / explicit coders keep priority
    if (ArchitectBridge?.wantsBridgeCmd?.(raw)) {
      return ArchitectBridge.handleCommand(raw);
    }

    this.busy = true;
    GlobeDeck?.expand?.('SpaceNet');
    GlobeDeck?.setThinking?.(true, 'Grok…');
    CliRibbon?.setActive?.('Grok');
    CliRibbon?.setNotice?.('Thinking…', 'thinking');

    try {
      const plan = this.plan(raw);
      let actionResults = [];
      if (plan.actions.length) {
        actionResults = await this.execute(plan);
      }

      // Always enrich with Core Brain for pure chat or residual intent
      if (!plan.actions.length || plan.intent === 'chat') {
        if (window.AstranovCoreBrain?.handle) {
          const r = await AstranovCoreBrain.handle(raw, opts);
          this.busy = false;
          GlobeDeck?.setThinking?.(false);
          return { ok: true, brain: true, ...r };
        }
        if (window.AciCoders?.handleMessage) {
          await AciCoders.handleMessage(raw, opts);
          this.busy = false;
          GlobeDeck?.setThinking?.(false);
          return { ok: true, coders: true };
        }
      }

      const reply = this.localReply(plan, actionResults);
      if (reply) {
        AciCli?.print?.(reply, 'reply');
        ACIControl?.reply?.(reply.slice(0, 200));
        GlobeDeck?.setPreview?.(reply.slice(0, 140));
        CliRibbon?.setNotice?.(reply.slice(0, 80), 'ready');
      }
      this.history.push({ role: 'user', content: raw });
      this.history.push({ role: 'assistant', content: reply || actionResults.join(',') });
      if (this.history.length > 30) this.history = this.history.slice(-30);
      return { ok: true, plan, actionResults };
    } catch (e) {
      const msg = 'SpaceNet: ' + (e.message || e);
      AciCli?.print?.(msg, 'err');
      return { ok: false, error: msg };
    } finally {
      this.busy = false;
      GlobeDeck?.setThinking?.(false);
    }
  },
};

window.SpaceNetGrokCli = SpaceNetGrokCli;
// Auto-init after features boot when present
try {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(() => SpaceNetGrokCli.init(), 600));
  } else {
    setTimeout(() => SpaceNetGrokCli.init(), 600);
  }
} catch (_) {}
