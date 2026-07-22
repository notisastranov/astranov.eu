/**
 * =============================================================================
 * ASTRANOV AI CONTINUITY MANIFEST — read before editing or deploying
 * =============================================================================
 *
 * PURPOSE
 *   Machine- and human-readable contract for what the live app MUST keep doing.
 *   New AI tools: read this file first, then the module named in each feature's
 *   `owner` field. Do not rip out patches listed under `doNotRemove`.
 *
 * LIVE
 *   Site: https://astranov.eu
 *   Repo: github.com/notisastranov/astranov.eu
 *   Build stamp: meta[name="astranov-build"] in index.html (must match ?v= on scripts)
 *
 * DEPLOY (owner machine — run yourself, never ask user to run)
 *   1. node scripts/guard-base.mjs          — blocks stub/catastrophe deploys
 *   2. node scripts/owner-push.mjs <files> <short-message>
 *   Large files (astranov-app.js, astranov-deferred.js) may need separate pushes.
 *   Node path (Windows): use Codex node.exe if `node` not on PATH.
 *
 * SCRIPT LOAD ORDER (index.html — order matters)
 *   three.js → supabase → astranov-app.js → astranov-perf-lazy.js →
 *   astranov-continuity.js → galactic-sky.js → field-hud.js → mpp-tile.js
 *
 * BUNDLE SPLIT
 *   astranov-app.js      (~440KB) Globe, SuperCli, LazyModules stub, boot — parse-time WebGL
 *   astranov-deferred.js (~575KB) Commerce, MapComms, CodersHub, CityMap, BrainNeurons full
 *   astranov-perf-lazy.js        Defers deferred load until SlumberManager delay OR user tap
 *   astranov-field-hud.js        Top-right field, radar, speed, miner rig opener
 *   astranov-mpp-tile.js         MenuProfilePostTile (+ hijack, locate, video, marketplace)
 *   astranov-galactic-sky.js     Sky layer
 *
 * =============================================================================
 */
const AstranovContinuity = {
  version: '20260722270000-spacenet-brain',
  updated: '2026-07-22',

  /**
   * Markdown / issues / sessions that MUST NOT drive implementation.
   * Amnesia almost killed the project — chat is never law.
   */
  supersededDocs: {
    authoritative: [
      'Live index.html + js/spacenet/*',
      'js/spacenet/brain.js (SNBrain / AstranovBrain)',
      'astranov-continuity.js',
      'support/PRODUCT-RULES.md',
      'ASTRANOV_SPACENET_GUIDE.md',
      'ASTRANOV_SPACENET_MISSION.md (vision only)',
      'CLAUDE.md / AGENTS.md (entry only)',
    ],
    deprecatedStubs: ['ASTRANOV_GROK_SPECS.md'],
    deleted: ['ASTRANOV_GROK_FULL_HANDOVER.md', 'index.restored.html'],
    notAuthoritative: [
      'Grok/Cursor/Claude session transcripts and compaction summaries',
      'GitHub issues #97 #99 old P0 handoff checklists',
      'scripts/patch-trackball-cli.mjs build pins (historical)',
      'Chat-recycled “triangle of truth” (MISSION + GROK_SPECS + CLAUDE)',
      'Any impulse to full-rewrite the live shell to chase FPS',
    ],
    outdatedRules: [
      'index.html only — no new files',
      'astranov-grok.html as primary source',
      'miner-cli-strip / #aci-miner above CLI',
      '+ opens globe-super-add only',
      'LazyModules.ensure() at 400ms on boot',
      '1MB phase/deferred packs as default boot',
    ],
  },

  deploy: {
    guard: 'scripts/guard-base.mjs',
    push: 'scripts/owner-push.mjs',
    rules: [
      'Bump meta astranov-build and every script ?v= together on each deploy',
      'Run guard-base before every push',
      'index.html must stay >80KB (guard rejects bootstrap stubs)',
      'Do not reintroduce astranov-gl.js split boot or simulateACI',
    ],
  },

  /**
   * Features the product owner demanded — all must keep working.
   */
  features: {
    spacenetBrain: {
      summary:
        'Permanent Astranov AI brain — anti-amnesia law in js/spacenet/brain.js; system prompt for freeform AI; CLI brain/verify/law; boot loads brain first',
      owner: 'js/spacenet/brain.js',
      selectors: [],
      required: [
        'window.SNBrain / AstranovBrain with systemPrompt, verify, LAW',
        'AI freeform uses SNBrain.systemPrompt()',
        'CLI: brain · verify · law',
        'Boot runs SNBrain.verify after init',
      ],
      doNotRemove: [
        'js/spacenet/brain.js',
        'SNBrain.systemPrompt',
        'SNBrain.verify',
        'boot load order brain before ai',
      ],
    },
    spacenetSacredGlobe: {
      summary: 'Globe natural drag + inertia (velX/velY damp) + solar→global→national→city + back to Earth',
      owner: 'js/spacenet/globe.js',
      required: ['getPhysics()', 'velX', 'velY', 'damp ~0.88–0.94', 'goToTier'],
      doNotRemove: ['getPhysics', 'velX', 'velY', 'damp', 'inertia loop'],
    },
    spacenetSacredCli: {
      summary: 'One-finger CLI drag + free dock + pos/size persistence + expand/retract + scrollable log',
      owner: 'js/spacenet/ui.js',
      selectors: ['#cli-drag', '#dock'],
      required: ['bindCliDrag', 'sn:cli-pos-v1', 'sn:cli-size-v1'],
      doNotRemove: ['bindCliDrag', '#cli-drag', 'sn:cli-pos-v1', 'sn:cli-size-v1'],
    },
    spacenetJuice: {
      summary: 'Crawlers → city maps → multi-role tiles → jobs/dates/deliveries — default engineering priority',
      owner: 'js/spacenet/search.js + map.js + tasks.js + profiles.js + tile.js + cli.js',
      required: [
        'SNSearch.crawl',
        'SNTasks create/claim/complete',
        'SNProfiles multi-role',
        'SNTile cover/avatar/roles/menu',
        'city map on demand',
      ],
      doNotRemove: [
        'SNSearch.crawl',
        'job/date/deliver CLI routes',
        'SNTasks DNA',
        'SNProfiles',
        'SNTile',
        'vendor menu photo+price',
      ],
    },
    spacenetMultiRoleTile: {
      summary:
        'One tile for social/dating/vendor/driver/client/worker — cover, avatar, role chips, vendor menus with photos+prices, cart→order→delivery',
      owner: 'js/spacenet/tile.js + profiles.js',
      selectors: ['#sn-tile', '#sn-plus'],
      required: ['cover', 'avatar', 'role chips', 'menu tab', 'dating tab', 'drive tab', 'cart'],
      doNotRemove: ['#sn-tile', '#sn-plus', 'SNTile.open', 'SNProfiles.toggleRole'],
    },
    superAddPlus: {
      summary: '+ opens full MenuProfilePostTile (social profile field), NOT small globe-super-add deck',
      owner: 'astranov-mpp-tile.js',
      selectors: ['#super-add-fab', '#menu-profile-post-tile'],
      behavior: [
        'capture-phase click on #super-add-fab with stopImmediatePropagation',
        'SuperAdd.open/showPanel patched: redirect to MenuProfilePostTile unless opts.camera/media',
        'SuperCli.run(add|post|superadd) redirected to openPlusField',
        'globe-super-add deck closed via _closeSuperAddDeck before open',
      ],
      doNotRemove: ['_bindPlusFab', '_patchSuperAdd', 'MenuProfilePostTile.openPlusField'],
    },

    menuProfilePostTile: {
      summary: 'Social super-add field: cover, avatar, roles, instant post, video peers, marketplace',
      owner: 'astranov-mpp-tile.js',
      selectors: ['#menu-profile-post-tile', '#mpp-roles', '#mpp-section-market'],
      roles: ['client', 'vendor', 'driver', 'user', 'social'],
      sections: {
        market: '#mpp-section-market — visible when client OR vendor role on',
        vendor: '#mpp-section-vendor — nearby shops, list shop',
        driver: '#mpp-section-driver — online toggle, schedule, base',
        user: '#mpp-section-user — profile site, delivery address',
        social: '#mpp-section-social — caption, photo/video, post now',
        connected: '#mpp-connected — tap user to MapComms.contactUser video',
      },
      actions: {
        browse_shops: 'Commerce.showPicker',
        place_cart: 'set delivery pin → Commerce.placeCart (sign-in required)',
        track_delivery: 'MarketplaceDeliveryEngine.showHud for active order',
        set_delivery: 'MapPins.setClientDelivery',
        post_lust: 'FieldBrain pulse + globe marker',
      },
      mapPick: 'GlobeNavigate.handlePlaceClick patched — consumeMapPick when pin-pick active',
    },

    locateMe: {
      summary: 'Locate me must GPS → city map (CityLife.locateAndDropIn)',
      owner: 'astranov-mpp-tile.js (_patchLocate) + index.html CSS',
      selectors: ['#aci-locate', '#app-shortcut-row'],
      behavior: [
        '#aci-locate pinned into #app-shortcut-row with class app-shortcut-btn',
        'CSS: #super-cli-bar #aci-locate.app-shortcut-btn { display:inline-flex !important }',
        'CSS: hide bar buttons EXCEPT login, video-call, +, handsfree, avc, .app-shortcut-btn',
        'Click: CityLife.locateAndDropIn(); fallback enterCityView(36.44, 28.22) Rhodes demo',
        'GlobeControl.engageFollow(locate) on success path',
      ],
      doNotRemove: ['_patchLocate', 'AppShortcuts._pinInsideButtons wrap in mpp-tile'],
    },

    videoCall: {
      summary: 'Video call button left of + in CLI edge bar',
      owner: 'astranov-mpp-tile.js',
      selectors: ['#aci-video-call', '#super-cli-edge-right', '#super-add-fab'],
      behavior: [
        '_patchCliBar: SuperCli.ensureBarLayout inserts #aci-video-call BEFORE #super-add-fab',
        'CSS forces #aci-video-call display:inline-flex !important',
        'Click: open MPP tile, refreshConnected; if 1 peer → MapComms.contactUser(uid, video)',
        'Else scroll #mpp-connected and prompt tap-to-call',
      ],
      doNotRemove: ['_patchVideoCall', '_patchCliBar', '_openVideoCall'],
    },

    deliveryMarketplace: {
      summary: 'Monetization path: browse → cart → pay AVC → track delivery',
      owner: 'astranov-mpp-tile.js + astranov-deferred.js (Commerce)',
      selectors: ['#mpp-section-market', '#mpp-market-summary', '#miner-rig-panel'],
      behavior: [
        'refreshMarketplace shows delivery pin, vendor, cart count, AVC total',
        'Client role primary foot: Place order when cart has items else Set delivery',
        'Commerce.placeCart / placeOrder via order-intake edge function',
        'MarketplaceDeliveryEngine missions + #delivery-route-hud for drivers/clients',
      ],
    },

    minerRig: {
      summary: 'SpaceNet miner — NO separate CLI miner button; tap top-right field',
      owner: 'astranov-field-hud.js',
      selectors: ['#field-balance-hud', '#miner-rig-panel', '#fbh-mine-rate'],
      removed: ['#miner-cli-strip', '#aci-miner', '#aci-miner-rate — DO NOT ADD BACK'],
      behavior: [
        '#field-balance-hud top-right: AVC, fiat, peers, CPU/RAM/SSD/NET, mine rate',
        'Click or Enter/Space on field → openMinerPanel (#miner-rig-panel)',
        'Toggles: cpu, ram, storage, bandwidth, sleep — localStorage astranov:miner-rig-prefs',
        'SpaceNetMiner.computeRate + canAcceptWork respect prefs',
        'class mining-active on field when terms ok and rate > 0.003',
        'bindFieldMiner (not bindMinerCli / aci-miner)',
      ],
      doNotRemove: ['bindFieldMiner', 'openMinerPanel', 'SpaceNetMiner in field-hud.js'],
    },

    fieldHudRadar: {
      summary: 'Left radar scan + center speed (earth 1671 km/h, drive, city)',
      owner: 'astranov-field-hud.js',
      selectors: ['#field-radar', '#field-radar-canvas', '#field-radar-speed', '#fsh-mode'],
      behavior: [
        'Radar via setInterval 125ms (~8fps draw) — no requestAnimationFrame loop',
        'Earth spin: EarthRealism.tick in animate(); speed HUD shows EARTH_ROTATION_KMH 1671',
        'FieldHud.boot runs on DOMContentLoaded (immediate shell; unified RAF still throttled)',
        'drawRadar: no shadowBlur, 8 trail steps; field RAF pauses when hidden or city map',
      ],
    },

    perfLazyBoot: {
      summary: 'App must feel fast — defer 574KB pack without losing features',
      owner: 'astranov-perf-lazy.js + astranov-app.js boot',
      behavior: [
        'NO setTimeout(LazyModules.ensure, 400) on boot — removed',
        'Boot uses LazyModules.whenReady for EarthRealism, CityMap, GlobeEntity, scenarios',
        'perf-lazy patches ensure: delays until SlumberManager.deferredDelay OR _lazyUserReady',
        'First user tap sets _lazyUserReady → immediate ensure',
        'BrainNeurons.boot deduped via _perfDeduped wrap',
        'Mobile DPR capped at 1.0 on touch devices after SlumberManager init',
        'animate: adaptive targetFps (12–60) — skip idle frames; 60fps only when dragging/inertia',
        'SlumberManager targetFps per tier; mobile defaults to conserve tier',
        'Globe: 64 stars, earth 16 segments, no antialias on mobile, DPR ≤0.85 touch',
        'Boot: single whenReady batch; heavy inits via requestIdleCallback; scenario only ?boottest=1',
        'Deferred pack: mobile delay 4.2s+; LazyModules.schedule waits for tap or timeout',
        'ensureBrain deferred 2.8s from FieldHud.boot',
        'sw.js v41: network-first for all /astranov-*.js',
        'index.html three.js cdnjs with onerror jsdelivr fallback',
        'app.js: host gate first; THREE/WebGL guarded — CLI boots even if globe fails',
        'LazyModules.load clears _promise on error for retry; perf-lazy logs deferred failures',
        'mpp-tile: no loadHudModules duplicate injection (index script tags only)',
        'field-hud retry capped 3×1000ms',
      ],
      doNotRemove: ['astranov-perf-lazy.js script tag before field-hud', 'whenReady', 'scheduleBrain'],
    },

    aiBrain: {
      summary: 'AI brain must stay alive — BrainNeurons + FieldBrain',
      owner: 'astranov-field-hud.js (ensureBrain) + astranov-deferred.js',
      behavior: [
        'FieldHud.ensureBrain → scheduleBrain → EarthRealism.init + BrainNeurons.boot',
        'LazyModules loads deferred pack; DeferredBoot.run inits commerce, presence, etc.',
        'Do not stub BrainNeurons in production app.js',
      ],
    },

    cliBar: {
      summary: 'SuperCli edge bar layout — minimal visible buttons',
      owner: 'index.html CSS + astranov-mpp-tile.js _patchCliBar',
      visible: ['#aci-login', '#aci-video-call', '#super-add-fab', '#aci-handsfree', '.app-shortcut-btn'],
      pinnedShortcuts: ['#aci-avc', '#aci-locate in #app-shortcut-row'],
      note: 'SuperCli.TOOLBAR_VISIBLE does not list video-call; CSS !important shows it',
    },

    globePhysics: {
      summary: 'Locked — do not change without explicit owner request',
      meta: 'astranov-globe-physics locked-v20260710241000-never-change',
      constants: ['GlobeNavigate.GLOBAL_Z 3.5', 'Earth rotation display 1671 km/h', 'syncGlobePivotQuaternion'],
    },

    architectBridge: {
      summary: 'Owner-only in-app coding bridge: phone → Grok Build desktop (not public agent)',
      owner: 'src/17-architect-bridge.js + supabase/functions/coders-bridge + scripts/architect-bridge-watch.mjs',
      architect: 'notisastranov@gmail.com',
      selectors: ['#aci-bridge'],
      commands: ['fix <issue>', 'code <change>', 'dev <task>', 'bridge', 'bridge status', 'bridge poll <id>', 'bridge list'],
      behavior: [
        'After Google sign-in as architect: 🛠 visible, bridge auto-armed',
        'fix/code/dev/edit queue cic_queue reason=architect_bridge coder_engine=grok_build',
        'Natural-language build tasks from architect chat also queue Architect Bridge',
        'Desktop: npm run bridge-watch → .grok/architect-bridge/CURRENT.md',
        'Answer: node scripts/architect-bridge-answer.mjs <id> "done: …" → phone poll delivers reply',
        'Paid XAI_API_KEY only for architect (server free-tier first, then paid fallback)',
        'Composer (Cursor) remains optional via "use composer" / Coders Hub summon — not the default street path',
      ],
      doNotRemove: ['ArchitectBridge', 'architect_push', 'architect_pending', 'architect_answer', 'aci-bridge'],
    },

    coreBrain: {
      summary: 'Local-first freeform AI + globe tools — never leave freeform as "unknown"',
      owner: 'src/22-astranov-core-brain.js',
      behavior: [
        'AciCli freeform → AstranovCoreBrain.handle (not "unknown — try help")',
        'SuperCli.exec freeform → Core Brain',
        'Act on globe immediately (locate/fly/city/order/zoom) then optional aicycle ≤14s',
        'Do not block UI waiting for 80s edge latency',
      ],
      doNotRemove: ['AstranovCoreBrain', 'queue freeform to Core Brain'],
    },

    astranovArt: {
      summary: 'Cinematic globe — multi-layer stars, fresnel atmosphere, day/night limb, higher tessellation',
      owner: 'src/00-globe.js + src/63-earth-daynight.js + src/60-graphics.js',
      behavior: [
        'Earth MeshPhong/shader not flat MeshBasic 24-seg Atari sphere',
        'Additive multi-layer starfield',
        'Fresnel atmosphere shell via AIGraphics.addAtmosphere',
      ],
      doNotRemove: ['bootAtmosphere upgrade path', 'EarthRealism day/night'],
    },

    astranovHelper: {
      summary: 'AI helper character v2 — gaming mecha-angel (procedural THREE, not Atari boxes)',
      owner: 'src/60-graphics.js (spawnAstranovFlyer / _buildProceduralHumanoid gen:2)',
      behavior: [
        'Energy multi-vane wings, halo, core bloom, thruster jets, orbiters',
        'Hero scale at global zoom; flyAstranovTo uses same mesh',
        'Advanced rim/metal/pulse shaders on helper materials',
      ],
      doNotRemove: ['spawnAstranovFlyer', 'flyAstranovTo', 'AstranovFlyer'],
    },

    astranovOS: {
      summary: 'Multi-device web OS shell — Earth desktop + dock + system panel',
      owner: 'src/08-astranov-os.js',
      selectors: ['#astranov-os-root', '#os-dock', '#os-surface'],
      behavior: [
        'Dock always available after features boot: Earth, Browser, Locate, Market, AI, Create, System',
        'Touch devices default conserve/lite power via SlumberManager',
        'Globe remains primary home surface (SpaceNet primacy)',
        'PWA install tips in System; Escape returns home',
      ],
      doNotRemove: ['AstranovOS', 'os-dock', 'setMode'],
    },

    astranovBrowser: {
      summary: 'In-OS web browser — tabs, URL bar, astranov:// routes, https iframe',
      owner: 'src/08-astranov-browser.js',
      selectors: ['#os-browser', '#os-browser-url', '#os-browser-frame'],
      behavior: [
        'Ctrl/Cmd+L focuses address; Ctrl/Cmd+T new tab',
        'astranov://home|locate|market|plus|chat|system routes into OS actions',
        'External http(s) only in sandboxed iframe',
      ],
      doNotRemove: ['AstranovBrowser', 'navigate', 'show', 'hide'],
    },
  },

  /**
   * Regression checks after edits (manual or SpaceNetScenarioRunner)
   */
  verify: [
    'Hard refresh https://astranov.eu — meta astranov-build matches deploy',
    '+ opens social profile tile (not small super-add deck)',
    '🎯 locate → city map or Rhodes fallback',
    '📹 left of + → connected users / video call',
    'Top-right SpaceNet field tap → miner rig panel (no ⛏ strip above CLI)',
    'MPP marketplace: browse, place_cart, track_delivery when signed in',
    'Globe renders; radar sweeps; earth speed shows ~1671 km/h on global view',
    'First load feels faster; tap shop still loads Commerce after interaction',
    'Architect sign-in → 🛠 visible · bridge armed · fix/code queues summon',
    'Desktop bridge-watch acks task · answer script delivers reply to phone CLI',
    'OS dock visible after features boot · Browser opens tabs · System shows build',
    'index.html includes loader.js + phase-critical (live-check green)',
  ],

  /**
   * Common mistakes that destroyed prior sessions
   */
  antiPatterns: [
    'Stripping globe inertia / velX·velY / damp (amnesia catastrophe)',
    'Removing one-finger CLI drag, free dock, or expand/retract',
    'Full rewrite from zero that drops juice (crawlers/jobs/dates/delivery)',
    'Treating chat transcripts as higher authority than SNBrain + guide',
    'Re-enabling 1MB phase/deferred packs as default boot',
    'Reverting + to SuperAdd.showPanel / globe-super-add only',
    'Hiding #aci-locate without app-shortcut-btn pin',
    'Adding #miner-cli-strip or #aci-miner back above CLI',
    'LazyModules.ensure() at 400ms or on every FieldHud tick',
    'Pushing index.html stub <80KB (legacy guard; lite shell is intentional exception when spacenet boot is active)',
    'Editing globe physics without owner sign-off',
    'Removing stopImmediatePropagation on + fab (small deck wins race)',
    'CodersHub _pingLabs on init (6 HEAD requests slow boot)',
  ],

  /** Quick file → responsibility map */
  modules: {
    'index.html': 'Live SpaceNet lite shell + CLI dock',
    'js/spacenet/brain.js': 'Astranov permanent AI brain (anti-amnesia law)',
    'js/spacenet/globe.js': 'Real Earth + inertia + zoom tiers',
    'js/spacenet/ui.js': 'One-finger CLI drag + expand',
    'js/spacenet/cli.js': 'Street CLI + juice commands',
    'js/spacenet/search.js': 'Network crawlers',
    'js/spacenet/map.js': 'City map on demand',
    'js/spacenet/tasks.js': 'Jobs/dates/delivery DNA',
    'js/spacenet/ai.js': 'Freeform AI (prompt from brain)',
    'js/spacenet/boot.js': 'Lite boot chain',
    'ASTRANOV_SPACENET_GUIDE.md': 'Solidified written law',
    'support/PRODUCT-RULES.md': 'Never-forget bullets',
    'astranov-continuity.js': 'AI contract — read before editing',
    'scripts/guard-base.mjs': 'Pre-deploy gate',
    'scripts/owner-push.mjs': 'Silent owner git push',
    'index.shell.html': 'Legacy shell (reference)',
    'src/17-architect-bridge.js': 'Architect Bridge client (phone → Grok Build)',
    'astranov-deferred.js': 'Legacy deferred packs (not default boot)',
  },
};

window.AstranovContinuity = AstranovContinuity;

/** Expose one-line hint for console / AI REPL */
if (typeof console !== 'undefined' && console.info) {
  console.info(
    '[AstranovContinuity]',
    AstranovContinuity.version,
    '— read window.AstranovContinuity before editing; features:',
    Object.keys(AstranovContinuity.features).join(', ')
  );
}

/* === ASTRANOV OS BOOT (single path, idle/mobile-soft) === */
(function astranovOsBoot() {
  if (window.__ASTRANOV_OS_BOOT__) return;
  // Progressive index boot owns OS; continuity only fills if still unset after features
  var build = (document.querySelector('meta[name="astranov-build"]') || {}).content || '0';
  function load(src) {
    return new Promise(function (resolve) {
      if (document.querySelector('script[data-astranov-os="' + src + '"]')) return resolve();
      var s = document.createElement('script');
      s.src = src + (src.indexOf('?') >= 0 ? '&' : '?') + 'v=' + encodeURIComponent(build);
      s.async = true;
      s.dataset.astranovOs = src;
      s.onload = function () { resolve(); };
      s.onerror = function () { resolve(); };
      document.head.appendChild(s);
    });
  }
  function initOnce() {
    if (window.__ASTRANOV_OS_INIT__) return;
    window.__ASTRANOV_OS_INIT__ = 1;
    try { if (window.AstranovOS) AstranovOS.init(); } catch (e) { console.warn('[os]', e); }
    try { if (window.AstranovBrowser) AstranovBrowser.init(); } catch (e) { console.warn('[browser]', e); }
  }
  function run() {
    if (window.__ASTRANOV_OS_BOOT__) return;
    window.__ASTRANOV_OS_BOOT__ = 1;
    var mobile = !!(window._globePerfLite || window._spartan);
    var delay = mobile ? 8000 : 2500;
    var kick = function () {
      Promise.all([
        load('/js/08-astranov-os.js'),
        load('/js/08-astranov-browser.js'),
      ]).then(function () { initOnce(); });
    };
    if (typeof requestIdleCallback === 'function') {
      setTimeout(function () { requestIdleCallback(kick, { timeout: delay + 2000 }); }, delay);
    } else {
      setTimeout(kick, delay);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run);
  else run();
})();
