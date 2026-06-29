// === WILLA GAMES — demo players · κρυφτό/housekeeping · pyramid · multi-domain warfare ===
const WillaGames = {
  _timer: null,
  _demo: [],
  _units: [],
  _pyramids: [],
  active: null,

  KRYFTO_DEMO: [
    { id: 'demo-maria', name: 'Maria', emoji: '🔍', role: 'seeker', hidden: false, lat: 36.452, lng: 28.231 },
    { id: 'demo-kostas', name: 'Kostas', emoji: '🙈', role: 'hider', hidden: true, lat: 36.438, lng: 28.209 },
    { id: 'demo-eleni', name: 'Eleni', emoji: '🧹', role: 'housekeeping', hidden: false, lat: 36.461, lng: 28.198 },
    { id: 'demo-alex', name: 'Alex', emoji: '🏃', role: 'hider', hidden: true, lat: 36.429, lng: 28.245 },
  ],

  PYRAMID_SITES: [
    { id: 'pyr-giza', name: 'Giza Great Pyramid', lat: 29.9792, lng: 31.1342, height: '146 m' },
    { id: 'pyr-rhodes', name: 'Rhodes acropolis', lat: 36.4412, lng: 28.2225, height: 'local marker' },
    { id: 'pyr-chichen', name: 'Chichen Itza', lat: 20.6843, lng: -88.5678, height: 'El Castillo' },
  ],

  WILLA_ROSTER: [
    { id: 'w-b1', name: 'F-16 Aegean', unit: 'airfighter', domain: 'air', team: 'blue', emoji: '✈️', lat: 36.55, lng: 27.9 },
    { id: 'w-b2', name: 'Orbital Shield', unit: 'spaceforce', domain: 'air', team: 'blue', emoji: '🛰️', lat: 36.2, lng: 28.0, alt: 1.07 },
    { id: 'w-b3', name: 'Hellenic Frigate', unit: 'navy', domain: 'sea', team: 'blue', emoji: '🚢', lat: 36.15, lng: 28.35 },
    { id: 'w-b4', name: '3rd Marines', unit: 'ground', domain: 'ground', team: 'blue', emoji: '🪖', lat: 36.44, lng: 28.18 },
    { id: 'w-b5', name: 'SEAL Alpha', unit: 'seals', domain: 'underwater', team: 'blue', emoji: '🤿', lat: 36.42, lng: 28.28 },
    { id: 'w-b6', name: 'Agent Shadow', unit: 'spy', domain: 'ground', team: 'blue', emoji: '🕵️', lat: 36.46, lng: 28.22 },
    { id: 'w-b7', name: 'MQ-9 Reaper', unit: 'drone', domain: 'air', team: 'blue', emoji: '🛸', lat: 36.48, lng: 28.05 },
    { id: 'w-b8', name: 'FPV Ghost', unit: 'drone', domain: 'fpv', team: 'blue', emoji: '🥽', lat: 36.435, lng: 28.21 },
    { id: 'w-b9', name: 'UGV Scout', unit: 'drone', domain: 'ground', team: 'blue', emoji: '🚙', lat: 36.445, lng: 28.19 },
    { id: 'w-b10', name: 'USV Patrol', unit: 'drone', domain: 'sea', team: 'blue', emoji: '🚤', lat: 36.41, lng: 28.32 },
    { id: 'w-b11', name: 'UUV Hunter', unit: 'drone', domain: 'underwater', team: 'blue', emoji: '🔱', lat: 36.40, lng: 28.26 },
    { id: 'w-r1', name: 'MiG demo', unit: 'airfighter', domain: 'air', team: 'red', emoji: '✈️', lat: 36.62, lng: 28.1 },
    { id: 'w-r2', name: 'Red Corvette', unit: 'navy', domain: 'sea', team: 'red', emoji: '⚓', lat: 36.08, lng: 28.42 },
    { id: 'w-r3', name: 'Red Guard', unit: 'ground', domain: 'ground', team: 'red', emoji: '⛺', lat: 36.50, lng: 28.30 },
    { id: 'w-r4', name: 'Red Spy', unit: 'spy', domain: 'ground', team: 'red', emoji: '🕶️', lat: 36.43, lng: 28.24 },
    { id: 'w-r5', name: 'Kamikaze FPV', unit: 'drone', domain: 'fpv', team: 'red', emoji: '🥽', lat: 36.47, lng: 28.15 },
  ],

  DOMAIN_ALT: {
    air: 1.06, fpv: 1.07, ground: 1.025, sea: 1.02, underwater: 1.015,
  },

  TEAM_COLOR: { blue: 0x1a6fd4, red: 0xff2244 },

  init() {
    if (this._timer) return;
    setTimeout(() => this.boot(), 2800);
    this._timer = setInterval(() => this._tick(), 3500);
  },

  boot() {
    CosmicZoom?.trackISS?.();
    AciCli?.print?.('◎ Solar view · ISS live · games: kryfto · pyramid · willa', 'dim');
  },

  wantsPyramid(line) {
    const low = String(line || '').toLowerCase();
    return /\b(pyramid|πυραμίδ|πυραμιδ|pyramids)\b/.test(low)
      && /\b(game|play|start|find|hunt|ξεκίνα|παιχνίδι)\b/.test(low)
      || /^(pyramid|pyramids)\b/.test(low);
  },

  wantsWilla(line) {
    const low = String(line || '').toLowerCase().replace(/\s+/g, ' ');
    return /\b(willa\s*game|willagame|willa\s*war|willa)\b/.test(low)
      || /\b(airfighters?|space\s*force|navy|seals?|spies|multi\s*domain)\b.*\b(game|war|battle|drone)/.test(low);
  },

  ensureDemoPlayers(mode) {
    const real = (window.others || []).filter(u => !u.demo);
    if (real.length) return real;
    if (!this._demo.length || mode === 'kryfto') {
      this._demo = this.KRYFTO_DEMO.map(p => ({
        ...p,
        demo: true,
        game: 'kryfto',
        t: Date.now(),
      }));
    }
    AstranovPresence?._applyOthers?.(this._demo);
    return this._demo;
  },

  mergeLivePlayers(users) {
    const real = (users || []).filter(u => !u.demo);
    if (real.length) return real;
    if (this.active === 'kryfto' && this._demo.length) return this._demo;
    if (this.active === 'willa' && this._units.length) {
      return this._units.filter(u => u.unit !== 'drone' && u.unit !== 'spy').map(u => ({
        id: u.id, name: u.name, lat: u.lat, lng: u.lng, emoji: u.emoji, demo: true, game: 'willa', team: u.team,
      }));
    }
    return this._demo.length ? this._demo : [];
  },

  startKryftoDemo() {
    this.active = 'kryfto';
    AstranovPresence.game = 'kryfto';
    this.ensureDemoPlayers('kryfto');
    window.hidden = false;
    const others = window.others || [];
    others.forEach(u => {
      if (!u.hidden) MapDepict?.pulse?.(u.lat, u.lng, 0x3d9eff, (u.emoji || '👤') + ' ' + u.name + ' · seek', 16000);
    });
    const p = window._lastPos || { lat: 36.44, lng: 28.22 };
    MapDepict?.action?.('play', { lat: p.lat, lng: p.lng, detail: 'κρυφτό · housekeeping demo' });
    MapDepict?.pulse?.(p.lat, p.lng, 0x1a6fd4, 'ΚΡΥΦΤΟ DEMO', 18000);
    GlobeDeck?.expand?.(SuperCli?.title || 'Astranov Command Line');
    GlobeDeck?.setTitle?.('ΚΡΥΦΤΟ · DEMO');
    GlobeDeck?.setPreview?.('◎ ' + (others.length + 1) + ' players · hide · seek · housekeeping');
    GlobeDeck.activeTask = 'game';
    ContextTruth?.sync?.();
    AciCli?.print('◎ DEMO κρυφτό / hide & seek / housekeeping · ' + others.length + ' NPCs', 'ok');
    ACIControl?.reply('Demo κρυφτό — type hide to vanish · players to seek · 4 demo players on Rhodes');
    FieldBrain?.pulse?.('play', 'kryfto demo', { role: 'client', props: { players: others.length + 1, demo: true } });
  },

  startPyramid() {
    this.active = 'pyramid';
    AstranovPresence.game = 'pyramid';
    this._pyramids = this.PYRAMID_SITES.map(s => ({ ...s }));
    GlobeEntity?.unregisterType?.('pyramid');
    this._pyramids.forEach((site, i) => {
      GlobeEntity?.register?.({
        id: 'pyr-' + site.id,
        type: 'pyramid',
        lat: site.lat,
        lng: site.lng,
        title: '🔺 ' + site.name,
        description: 'Pyramid hunt #' + (i + 1) + ' · fly here · tap marker',
        urgency: 2,
        color: 0xffdd44,
        onTap: (e) => {
          const p = latLngToPos(e.lat, e.lng, 1.04);
          flyToPoint?.(new THREE.Vector3(p.x, p.y, p.z), 1.82);
          ACIControl?.reply('Pyramid · ' + site.name + ' — find all ' + this._pyramids.length + ' apex markers');
        },
      });
      MapDepict?.pulse?.(site.lat, site.lng, 0xffdd44, '🔺 ' + site.name, 20000);
    });
    GlobeDeck?.expand?.('Pyramid hunt');
    GlobeDeck?.setPreview?.('🔺 Find ' + this._pyramids.length + ' pyramids on the globe');
    GlobeDeck.activeTask = 'game';
    ContextTruth?.sync?.();
    AciCli?.print('◎ PYRAMID GAME · ' + this._pyramids.length + ' sites marked', 'ok');
    ACIControl?.reply('Pyramid hunt — fly to golden markers · Giza · Rhodes · Chichen Itza');
    FieldBrain?.pulse?.('play', 'pyramid hunt', { role: 'client', props: { sites: this._pyramids.length } });
  },

  startWilla() {
    this.active = 'willa';
    AstranovPresence.game = 'willa';
    this._units = this.WILLA_ROSTER.map(u => ({ ...u, demo: true, t: Date.now() }));
    this._renderWillaUnits();
    GlobeDeck?.expand?.('Willa game');
    GlobeDeck?.setPreview?.('⚔ Willa · air · sea · ground · space · spies · drones');
    GlobeDeck.activeTask = 'game';
    ContextTruth?.sync?.();
    const n = this._units.length;
    AciCli?.print('◎ WILLA GAME · ' + n + ' units · blue vs red · multi-domain', 'ok');
    ACIControl?.reply('Willa warfare — fighters · navy · spaceforce · ground · SEALs · spies · drones all domains');
    FieldBrain?.pulse?.('play', 'willa game', { role: 'client', props: { units: n } });
    TelemachosPilot?.refreshTeamStatus?.({ quiet: true });
  },

  _renderWillaUnits() {
    GlobeEntity?.unregisterType?.('unit');
    GlobeEntity?.unregisterType?.('drone');
    GlobeEntity?.unregisterType?.('spy');
    this._units.forEach(u => {
      const isDrone = u.unit === 'drone';
      const isSpy = u.unit === 'spy';
      const type = isDrone ? 'drone' : isSpy ? 'spy' : 'unit';
      const dom = TelemachosPilot?.DOMAINS?.[u.domain] || {};
      const teamColor = this.TEAM_COLOR[u.team] || 0x3d9eff;
      const alt = u.alt || this.DOMAIN_ALT[u.domain] || 1.028;
      GlobeEntity?.register?.({
        id: 'willa-' + u.id,
        type,
        lat: u.lat,
        lng: u.lng,
        altitude: alt,
        title: (u.emoji || '⚔') + ' ' + u.name,
        description: (u.team || '').toUpperCase() + ' · ' + (u.unit || 'unit') + ' · ' + (dom.label || u.domain),
        urgency: u.team === 'red' ? 3 : 2,
        color: teamColor,
        icon: u.emoji || dom.emoji || '⚔',
        data: { unit: u },
        onTap: (e) => {
          const p = latLngToPos(e.lat, e.lng, alt);
          flyToPoint?.(new THREE.Vector3(p.x, p.y, p.z), u.domain === 'air' || u.domain === 'fpv' ? 4.4 : 1.82);
          ACIControl?.reply(u.name + ' · ' + u.unit + ' · ' + u.domain + ' domain');
        },
      });
      MapDepict?.pulse?.(u.lat, u.lng, teamColor, u.emoji + ' ' + u.name, 14000);
    });
    AstranovPresence?._applyOthers?.(this.mergeLivePlayers([]));
  },

  _tick() {
    if (this.active === 'kryfto' && this._demo.length) {
      this._demo.forEach(u => {
        if (u.hidden) return;
        u.lat += (Math.random() - 0.5) * 0.004;
        u.lng += (Math.random() - 0.5) * 0.004;
        u.t = Date.now();
      });
      if (!(window.others || []).some(o => !o.demo)) {
        AstranovPresence?._applyOthers?.(this._demo);
      }
    }
    if (this.active === 'willa' && this._units.length) {
      this._units.forEach(u => {
        const drift = u.domain === 'sea' || u.domain === 'underwater' ? 0.006 : 0.003;
        u.lat += (Math.random() - 0.5) * drift;
        u.lng += (Math.random() - 0.5) * drift;
      });
      this._renderWillaUnits();
    }
  },

  listStatus() {
    if (this.active === 'pyramid') {
      return this._pyramids.map((s, i) => (i + 1) + '. ' + s.name).join(' · ');
    }
    if (this.active === 'willa') {
      return this._units.length + ' units · blue ' + this._units.filter(u => u.team === 'blue').length
        + ' · red ' + this._units.filter(u => u.team === 'red').length;
    }
    return (window.others || []).length + ' demo/live players';
  },
};

window.WillaGames = WillaGames;