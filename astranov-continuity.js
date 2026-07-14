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
  version: '20260711220000-perf-rescue',
  updated: '2026-07-14',

  /**
   * Markdown / issues / sessions that MUST NOT drive implementation.
   */
  supersededDocs: {
    authoritative: ['astranov-continuity.js', 'CLAUDE.md', 'ASTRANOV_SPACENET_MISSION.md (vision only)'],
    deprecatedStubs: ['ASTRANOV_GROK_SPECS.md'],
    deleted: ['ASTRANOV_GROK_FULL_HANDOVER.md', 'index.restored.html'],
    notAuthoritative: [
      'Grok/Cursor/Claude session transcripts and compaction summaries',
      'GitHub issues #97 #99 old P0 handoff checklists',
      'scripts/patch-trackball-cli.mjs build pins (historical)',
      'Chat-recycled “triangle of truth” (MISSION + GROK_SPECS + CLAUDE)',
    ],
    outdatedRules: [
      'index.html only — no new files',
      'astranov-grok.html as primary source',
      'miner-cli-strip / #aci-miner above CLI',
      '+ opens globe-super-add only',
      'LazyModules.ensure() at 400ms on boot',
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
        'Radar sweep on canvas ~12fps via unified startFieldRaf (no separate earth RAF)',
        'Earth spin: EarthRealism.tick in animate(); speed HUD shows EARTH_ROTATION_KMH 1671',
        'FieldHud.boot deferred ~1.8s via requestIdleCallback after DOM ready',
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
        'First user tap sets _lazyUserReady → immediate ensure + ensureBrain',
        'ensureBrain deferred 2.8s+ until user tap or timeout; BrainNeurons.boot deduped',
        'Mobile DPR capped at 1.0 via perf-lazy after SlumberManager init',
        'animate: skip frames when tab hidden; MarketplaceDeliveryEngine.tick every 3 frames only if active',
        'mpp-tile patches on DOMContentLoaded only — no whenReady on load',
        'field-hud retry capped 5×1200ms',
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
  ],

  /**
   * Common mistakes that destroyed prior sessions
   */
  antiPatterns: [
    'Reverting + to SuperAdd.showPanel / globe-super-add only',
    'Hiding #aci-locate without app-shortcut-btn pin',
    'Adding #miner-cli-strip or #aci-miner back above CLI',
    'LazyModules.ensure() at 400ms or on every FieldHud tick',
    'Pushing index.html stub <80KB',
    'Editing astranov-globe-physics or trackball without owner sign-off',
    'Removing stopImmediatePropagation on + fab (small deck wins race)',
    'CodersHub _pingLabs on init (6 HEAD requests slow boot)',
  ],

  /** Quick file → responsibility map */
  modules: {
    'index.html': 'Shell HTML, MPP tile DOM, miner-rig-panel, CLI CSS exceptions, script tags',
    'astranov-app.js': 'Globe, boot, LazyModules, SuperCli, SlumberManager, MarketplaceDeliveryEngine stub',
    'astranov-deferred.js': 'Commerce, MapComms, CodersHub, CityMap, GlobeEntity, DeferredBoot',
    'astranov-perf-lazy.js': 'Deferred timing patch, user-activation fast path, brain dedup',
    'astranov-field-hud.js': 'field-balance-hud, radar, miner panel, AVC chip hide, brain schedule',
    'astranov-mpp-tile.js': 'MenuProfilePostTile, +/locate/video/marketplace patches',
    'astranov-galactic-sky.js': 'Galactic sky layer',
    'scripts/guard-base.mjs': 'Pre-deploy gate',
    'scripts/owner-push.mjs': 'Silent owner git push',
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