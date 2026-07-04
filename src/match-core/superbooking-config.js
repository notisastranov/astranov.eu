/* ONE DATABASE — lkoatrkhuigdolnjsbie · all *.astranov.eu tenants · no legacy split */
window.ASTRANOV_CENTRAL_DB = {
  ONE_DATABASE: true,
  supabaseRef: 'lkoatrkhuigdolnjsbie',
  supabaseUrl: 'https://lkoatrkhuigdolnjsbie.supabase.co',
  customUrl: 'https://api.astranov.eu',
  useCustomDomain: false,
  supabaseAnonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI',
  profilesTable: 'profiles',
  tenants: ['astranov.eu', 'coin.astranov.eu', 'auditors.astranov.eu', 'yachts.astranov.eu'],
};

window.ASTRANOV_SITES_DEFAULTS = {
  decentral: {
    enabled: true,
    syncPath: '/superbooking/sync',
    storageKey: 'astranov_decentral_node_v1',
    platforms: ['windows', 'mac', 'android', 'ios'],
  },
  database: 'central',
};
window.ASTRANOV_SUPERBOOKING_DEFAULTS = window.ASTRANOV_SITES_DEFAULTS;

function astranovCentralSupabaseUrl() {
  const c = window.ASTRANOV_CENTRAL_DB;
  return c.useCustomDomain && c.customUrl ? c.customUrl : c.supabaseUrl;
}

function assertOneDatabase(config) {
  const c = window.ASTRANOV_CENTRAL_DB;
  if (!c?.ONE_DATABASE) return config;
  const url = config.supabaseUrl || astranovCentralSupabaseUrl();
  if (url && !url.includes(c.supabaseRef)) {
    console.error('[Astranov] ONE DATABASE violation — expected ' + c.supabaseRef + ', got ' + url);
  }
  if (config.database === 'legacy') {
    console.warn('[Astranov] legacy database disabled — forcing central');
    config.database = 'central';
  }
  return config;
}

function applyCentralDatabase(config) {
  const c = window.ASTRANOV_CENTRAL_DB;
  if (!c) return config;
  const merged = {
    ...config,
    database: 'central',
    supabaseUrl: config.supabaseUrl || astranovCentralSupabaseUrl(),
    supabaseAnonKey: config.supabaseAnonKey || c.supabaseAnonKey,
    supabaseRef: c.supabaseRef,
    tables: { profiles: c.profilesTable, ...(config.tables || {}) },
  };
  return assertOneDatabase(merged);
}