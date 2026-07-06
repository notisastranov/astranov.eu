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

const GlobeAutonomy = { init() {} };
window.GlobeAutonomy = GlobeAutonomy;

function _haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function _defer(name, method, ...args) {
  return LazyModules.ensure().then(() => window[name]?.[method]?.(...args));
}

window.Commerce = {
  vendors: [],
  markers: [],
  driverMarkers: [],
  selected: null,
  cart: {},
  haversineKm: _haversineKm,
  userLatLng() { return window._lastPos || { lat: 36.22, lng: 28.12 }; },
  async loadVendors() { await LazyModules.ensure(); },
  initUI() {},
  async showPicker() { await LazyModules.ensure(); return window.Commerce?.showPicker?.(); },
  async openOrderFlow(q) { await LazyModules.ensure(); return window.Commerce?.openOrderFlow?.(q); },
  async smartOrder(q) { await LazyModules.ensure(); return window.Commerce?.smartOrder?.(q); },
  showMenu() { LazyModules.ensure().then(() => window.Commerce?.showMenu?.()); },
  openVendor() {},
  renderCart() {},
  async fetchNearbyDrivers() { return []; },
  parseWantedItems() { return []; },
  async cliVendorMenu() { await LazyModules.ensure(); return window.Commerce?.cliVendorMenu?.(); },
  async listMenuRequests() { await LazyModules.ensure(); return window.Commerce?.listMenuRequests?.(); },
};

window.CelestialNav = {
  tick() {},
  init() {},
  isGlobalNavView() { return false; },
  renderGuideHtml() { return ''; },
};

window.CodersHub = {
  LABS: [
    { id: 'main', label: 'Globe OS' }, { id: 'grok', label: 'Grok' },
    { id: 'chatgpt', label: 'ChatGPT' }, { id: 'claude', label: 'Claude' },
    { id: 'composer', label: 'Composer' }, { id: 'gemini', label: 'Gemini' },
    { id: 'deepseek', label: 'DeepSeek' }, { id: 'cursor', label: 'Cursor' },
  ],
  CONTINUATION_KEY: 'astranov:job-continuation',
  init() {},
  saveJob() {},
  readJob() { return null; },
  toggle() {},
};

window.LabOrbs = { init() {} };
window.ContextTruth = { infer() { return { ctx: 'idle' }; } };
window.DrivingView = { active: false, destination: null, routeCoords: [], fetchRoadRoute() { return Promise.resolve(); }, drawRoute() {}, activate() { return _defer('DrivingView', 'activate'); } };
window.Comms = {
  vhfActive: false,
  startVHF() { return _defer('Comms', 'startVHF'); },
  startPhone() { return _defer('Comms', 'startPhone'); },
  startTelecomms() { return _defer('Comms', 'startTelecomms'); },
};
window.NewsFeed = { flash() { return _defer('NewsFeed', 'flash'); } };
window.AstranovNode = { launchBatch() { return _defer('AstranovNode', 'launchBatch'); } };
window.SuperAdd = { open() { return _defer('SuperAdd', 'open'); } };
window.CliHub = { startPrivateCloud() { return _defer('CliHub', 'startPrivateCloud'); } };
window.OrderTracking = {
  active: false,
  init() {},
  refresh() {},
  async cli(...args) {
    await LazyModules.ensure();
    return window.OrderTracking.cli(...args);
  },
};
window.ProfileSite = { init() {}, open() {} };
window.AstranovSession = { init() {} };
window.AstranovPresence = { init() {} };
window.Responsive3D = { init() {} };
window.MapComms = { open() {}, close() {} };
window.PmrRadio = { open() {} };
window.SatRadio = window.PmrRadio;
window.GlobeVideo = { open() {} };
window.AstranovSiteShell = { open() {}, close() {} };
window.AstranovSitesProvision = { request() { return Promise.resolve(); } };
window.SuperBookingProvision = window.AstranovSitesProvision;
window.AstranovWishlist = { add() {} };
window.DeliveryPricing = { quote() { return null; } };
window.GoogleWalletPay = { pay() { return Promise.resolve(); } };
window.AciConnect = { open() { return _defer('AciConnect', 'open'); } };