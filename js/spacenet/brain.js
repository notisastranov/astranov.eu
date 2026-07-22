/* Astranov SpaceNet BRAIN — permanent product memory.
 * Amnesia almost killed the project and burned the owner's time/money.
 * This module is the machine-readable law every AI + CLI + agent must load.
 * Docs: ASTRANOV_SPACENET_GUIDE.md · support/PRODUCT-RULES.md
 * Authority: live js/spacenet/* → PRODUCT-RULES → mission → guide → CLAUDE
 */
(function (global) {
  'use strict';

  const MEM_KEY = 'sn:brain-mem-v1';
  const BUILD =
    (typeof document !== 'undefined' &&
      document.querySelector('meta[name="astranov-build"]')?.content) ||
    '?';

  const LAW = {
    version: '2026-07-22-brain-v1',
    name: 'Astranov SpaceNet',
    why:
      'Amnesia loops (rewrite-from-zero, strip inertia/CLI, chase FPS, forget juice) almost killed the project and cost the owner real money and years of focus. Memory is not optional.',
    mission:
      'Unify internet activity under realistic space imagery — solar → global → national → city → street — and evolve the internet into SpaceNet.',
    identity: {
      coldBoot: 'Silent globe (Greece-centered) + CLI. No persistent nav chrome.',
      globePrimacy: '3D Earth is the only permanent UI surface.',
      realism: 'Real geocoding, routing, WebRTC, geolocation, live crawlers. No fake city data as primary.',
    },
    authority: [
      'Live code index.html + js/spacenet/* (+ astranov-continuity.js when present)',
      'support/PRODUCT-RULES.md',
      'ASTRANOV_SPACENET_MISSION.md',
      'ASTRANOV_SPACENET_GUIDE.md',
      'CLAUDE.md / AGENTS.md (entry only)',
      'Chat history is NOT authority',
    ],
    sacred: {
      globe: {
        naturalTurn: true,
        sensitivity: '0.005–0.0062',
        inertia: true,
        velKeys: ['velX', 'velY'],
        dampRange: [0.88, 0.94],
        tiers: ['solar', 'global', 'national', 'city', 'street'],
        alwaysBackToEarth: true,
        owner: 'js/spacenet/globe.js',
      },
      cli: {
        oneFingerDrag: true,
        handle: '#cli-drag',
        freeDock: true,
        posKey: 'sn:cli-pos-v1',
        sizeKey: 'sn:cli-size-v1',
        sizes: ['collapsed', 'mid', 'expanded'],
        scrollableLog: true,
        expandRetract: true,
        owner: 'js/spacenet/ui.js → bindCliDrag()',
      },
    },
    juice: [
      { id: 'unified_tile', what: 'One tile: cover/avatar + social/dating/vendor/driver/client/worker roles' },
      { id: 'crawlers', what: 'SNSearch.crawl → profile tiles on city map' },
      { id: 'city_maps', what: 'Leaflet pins open multi-role tiles' },
      { id: 'vendor_menus', what: 'Menu items with photos + prices → cart → order → delivery task' },
      { id: 'jobs', what: 'job … → list → claim → complete on globe' },
      { id: 'dating', what: 'dating profiles + date invite DNA' },
      { id: 'delivery', what: 'driver profiles online + claim deliveries' },
      { id: 'errands', what: 'errand … same DNA' },
      { id: 'marketplace', what: 'browse → cart → order → track' },
      { id: 'ai', what: 'Single collective intelligence Astranov' },
    ],
    commands: [
      'job barman 3h',
      'date coffee',
      'deliver food',
      'errand pharmacy',
      'task list',
      'task claim',
      'crawl restaurants',
      'search X',
      'locate',
      'city',
      'fly athens',
      'solar',
      'global',
      'national',
      'city',
      'earth',
      'help',
      'solo',
      'brain',
      'verify',
      'law',
    ],
    antiPatterns: [
      'Strip inertia / zero velX·velY / remove damp',
      'Remove one-finger CLI drag, free dock, or pos/size persistence',
      'Non-scrollable or non-retractable CLI',
      'Full rewrite from zero that drops juice',
      'Re-enable 1MB phase/deferred packs as default boot',
      'Treat chat transcripts as higher authority than live code + guide',
      'Persistent rectangles / nav bars as primary UI',
      'Fake city data instead of crawler-fed places',
      'Delete features to go faster — measure + lazy-load instead',
      'Claim done without live probe of build stamp + physics + CLI',
    ],
    mindset: [
      'Extend js/spacenet/* — never erase memory to chase FPS',
      'Sacred physics first; then juice only',
      'Every street action paints the globe/map',
      'Update guide + PRODUCT-RULES + this brain when owner adds a rule',
      'Deploy yourself; bump astranov-build + ?v=',
    ],
    modules: {
      'js/spacenet/brain.js': 'THIS — permanent AI product memory',
      'js/spacenet/globe.js': 'Inertia + zoom tiers',
      'js/spacenet/ui.js': 'CLI drag + expand',
      'js/spacenet/cli.js': 'Street commands',
      'js/spacenet/search.js': 'Crawlers',
      'js/spacenet/map.js': 'City map',
      'js/spacenet/tasks.js': 'City DNA',
      'js/spacenet/ai.js': 'Freeform via aicycle; system prompt from brain',
      'ASTRANOV_SPACENET_GUIDE.md': 'Full written law',
      'support/PRODUCT-RULES.md': 'Short bullets',
    },
  };

  function loadMem() {
    try {
      return JSON.parse(localStorage.getItem(MEM_KEY) || '{}') || {};
    } catch (_) {
      return {};
    }
  }

  function saveMem(obj) {
    try {
      localStorage.setItem(MEM_KEY, JSON.stringify(obj));
      return true;
    } catch (_) {
      return false;
    }
  }

  /** Long system prompt for edge AI — compressed law, not chat fluff */
  function systemPrompt() {
    return (
      'You are Astranov — the collective intelligence of Astranov SpaceNet (https://astranov.eu). ' +
      'Product: real-Earth OS. Cold boot = silent globe + CLI. No persistent nav chrome. ' +
      'SACRED (never advise removing): globe inertia (velX/velY damp), natural drag, zoom solar→global→national→city→street always back to Earth; ' +
      'CLI one-finger drag (#cli-drag), free dock, pos sn:cli-pos-v1, expand/retract sn:cli-size-v1, scrollable log. ' +
      'JUICE (default work, in order): crawlers → city map population → jobs → dating → delivery → errands → claim/done → paint globe. ' +
      'Architecture: modular js/spacenet/* lite. Do NOT rewrite from zero. Do NOT reintroduce 1MB phase boot. ' +
      'CLI phrases: solar global national city earth locate fly X crawl X search X job date deliver errand task list claim done brain verify. ' +
      'Short answers (2–3 sentences). Same language as user. Always end with one concrete next CLI phrase when helpful. ' +
      'Amnesia almost killed this project — protect sacred physics and juice. Build ' +
      BUILD +
      '.'
    );
  }

  function summaryLines() {
    return [
      '── Astranov BRAIN · ' + LAW.version + ' ──',
      'WHY  ' + LAW.why.slice(0, 120) + '…',
      'NAME ' + LAW.name + ' · build ' + BUILD,
      'GLOBE inertia ON · tiers ' + LAW.sacred.globe.tiers.join('→'),
      'CLI  drag+expand · pos/size localStorage',
      'JUICE ' + LAW.juice.map((j) => j.id).join(' · '),
      'NEXT  crawl → city map → job/date/deliver — not rewrite',
      'CMD   brain · verify · law · help',
    ];
  }

  function lawLines() {
    const lines = summaryLines();
    lines.push('── authority ──');
    LAW.authority.forEach((a) => lines.push('· ' + a));
    lines.push('── anti-patterns ──');
    LAW.antiPatterns.slice(0, 8).forEach((a) => lines.push('✗ ' + a));
    lines.push('── mindset ──');
    LAW.mindset.forEach((m) => lines.push('→ ' + m));
    return lines;
  }

  /**
   * Runtime verify of sacred surface. Returns { ok, checks: [{id, pass, detail}] }
   */
  function verify() {
    const checks = [];
    const G = global.SNGlobe;
    const U = global.SNUi;
    const C = global.SNCli;
    const S = global.SNSearch;
    const T = global.SNTasks;
    const A = global.SNAi;

    function add(id, pass, detail) {
      checks.push({ id, pass: !!pass, detail: detail || '' });
    }

    add('brain', true, LAW.version);
    add('build', !!BUILD && BUILD !== '?', BUILD);

    // Globe inertia API
    let gState = null;
    try {
      gState = G?.getState?.() || G?.state || null;
    } catch (_) {}
    const hasVel =
      (G && typeof G.velX === 'number') ||
      (gState && typeof gState.velX === 'number') ||
      (typeof G?.hasInertia === 'function' && G.hasInertia()) ||
      // Internal G is private — probe via exported verify or source contract
      true; // module always ships velX; deeper probe if getPhysics exists
    if (typeof G?.getPhysics === 'function') {
      const p = G.getPhysics();
      add(
        'inertia',
        p && typeof p.damp === 'number' && p.damp > 0.5 && p.damp < 1,
        p ? 'damp=' + p.damp : 'no physics export'
      );
    } else {
      // Contract: globe.js must expose getPhysics after this deploy
      add('inertia', typeof G?.getPhysics === 'function', G ? 'need getPhysics()' : 'no SNGlobe');
    }

    add('tiers', typeof G?.goToTier === 'function', 'goToTier');
    add('cli_drag', typeof U?.bindCliDrag === 'function' || typeof U?.init === 'function', 'SNUi');
    add('cli_run', typeof C?.run === 'function' || typeof C?.init === 'function', 'SNCli');
    add('crawl', typeof S?.crawl === 'function', 'SNSearch.crawl');
    add('tasks', typeof T?.create === 'function' && typeof T?.claim === 'function', 'SNTasks DNA');
    add('profiles', typeof global.SNProfiles?.me === 'function', 'SNProfiles');
    add('tile', typeof global.SNTile?.open === 'function', 'SNTile multi-role');
    add('ai', typeof A?.ask === 'function', 'SNAi.ask');

    // DOM sacred
    const drag = typeof document !== 'undefined' && document.getElementById('cli-drag');
    const dock = typeof document !== 'undefined' && document.getElementById('dock');
    add('dom_cli_drag', !!drag, drag ? '#cli-drag' : 'missing');
    add('dom_dock', !!dock, dock ? '#dock' : 'missing');

    const failed = checks.filter((c) => !c.pass);
    return { ok: failed.length === 0, checks, failed, build: BUILD, version: LAW.version };
  }

  function remember(key, value) {
    const m = loadMem();
    m[String(key).slice(0, 64)] = {
      v: value,
      t: Date.now(),
    };
    // cap keys
    const keys = Object.keys(m);
    if (keys.length > 40) {
      keys
        .sort((a, b) => (m[a].t || 0) - (m[b].t || 0))
        .slice(0, keys.length - 40)
        .forEach((k) => delete m[k]);
    }
    saveMem(m);
    return true;
  }

  function recall(key) {
    const m = loadMem();
    if (key) return m[key]?.v;
    return m;
  }

  function dumpForAgent() {
    return {
      law: LAW,
      build: BUILD,
      systemPrompt: systemPrompt(),
      verify: verify(),
      userMem: loadMem(),
    };
  }

  // Console breadcrumb so any agent REPL sees it
  if (typeof console !== 'undefined' && console.info) {
    console.info(
      '[AstranovBrain]',
      LAW.version,
      '— amnesia is banned. window.SNBrain.law / .verify / .systemPrompt()'
    );
  }

  global.SNBrain = {
    LAW,
    version: LAW.version,
    systemPrompt,
    summaryLines,
    lawLines,
    verify,
    remember,
    recall,
    dumpForAgent,
    why: LAW.why,
  };

  // Alias for continuity-style access
  global.AstranovBrain = global.SNBrain;
})(window);
