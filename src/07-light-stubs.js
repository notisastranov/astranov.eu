// === LIGHT STUBS — removed heavy subsystems; keep optional chaining safe ===
const FieldBrain = {
  vendorIds: [],
  roles: [],
  init() {},
  hookFeed() {},
  pulse() {},
  onAuth() {},
};
window.FieldBrain = FieldBrain;

const GhostTravel = {
  SCRAMBLE_KM: 0,
  SPEED_KMH: 0,
  _target: null,
  active() { return false; },
  publicPos() { return window._lastPos || { lat: 36.22, lng: 28.12 }; },
  maskedTrue() { return null; },
  ingestUserPos() {},
  init() {},
};
window.GhostTravel = GhostTravel;

const WillaGames = {
  active: null,
  init() {},
  mergeLivePlayers(users) { return users || []; },
  ensureDemoPlayers() { return []; },
  getDemoRedTeam() { return []; },
  wantsPyramid() { return false; },
  wantsWilla() { return false; },
  startPyramid() {},
  startWilla() {},
  startKryftoDemo() {},
  listStatus() { return ''; },
};
window.WillaGames = WillaGames;

const TelemachosPilot = {
  edition: { name_gr: 'Pilot', name_latin: 'Pilot' },
  DOMAINS: {},
  async cli() { ACIControl?.reply('Pilot offline — use CLI order/locate'); },
  refreshTeamStatus() {},
  deliverToRed() {},
};
window.TelemachosPilot = TelemachosPilot;

const BrainConversation = {
  seedAdultNeurons() {},
  _matchLocal() { return null; },
  async converse(text, opts = {}) {
    const m = String(text || '').trim();
    if (!m) return '';
    if (window.AciCoders?.chat) {
      const r = await AciCoders.chat(m, { fromVoice: !!opts.fromVoice });
      return String(r?.text || r?.response || '').trim();
    }
    return '';
  },
};
window.BrainConversation = BrainConversation;

const HellenicSource = { seedToBrain() {} };
window.HellenicSource = HellenicSource;

const YachtMatcher = {
  async loadAndSyncGlobe() {},
  formatMatch() { return ''; },
  openBooking() {},
};
window.YachtMatcher = YachtMatcher;

const AuditorPortal = { syncGlobe() {} };
window.AuditorPortal = AuditorPortal;

const AvcJustice = { loadConstitution() {}, syncGlobe() {} };
window.AvcJustice = AvcJustice;

const CoinPortal = { syncGlobe() {} };
window.CoinPortal = CoinPortal;

const AstranovUnified = { syncGlobe() {}, async cli() { ACIControl?.reply('Unified platform — use order · locate · profile'); } };
window.AstranovUnified = AstranovUnified;

const AstranovOneDatabase = { async cli() {} };
window.AstranovOneDatabase = AstranovOneDatabase;

const SuperSpace = {
  init() {},
  tick() {},
  stop() {},
  async locateForMedia() {},
};
window.SuperSpace = SuperSpace;

const CityLife = {
  CITY_ZOOM: 1.38,
  userPos() { return window._lastPos || { lat: 36.44, lng: 28.22 }; },
  init() {},
  async dropIn(lat, lng, opts) {
    if (CityMap?.enter) return CityMap.enter(lat, lng, opts || {});
    return { ok: true };
  },
  async locateAndDropIn() {
    const u = this.userPos();
    return this.dropIn(u.lat, u.lng, {});
  },
};
window.CityLife = CityLife;

const GlobeAutonomy = { init() {} };
window.GlobeAutonomy = GlobeAutonomy;