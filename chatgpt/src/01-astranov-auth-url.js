// === ASTRANOV AUTH URL — never expose classified Supabase project ref to users ===
const ASTRANOV_GOOGLE_CLIENT_ID = '73846897360-va7gcqngfc370gfp7rl059no0vd4ts11.apps.googleusercontent.com';

function resolveAstranovSupabaseUrl() {
  try {
    const host = location.hostname || '';
    if (host === 'astranov.eu' || host.endsWith('.astranov.eu')) {
      return location.origin;
    }
  } catch (_) { /* */ }
  const c = window.ASTRANOV_CENTRAL_DB;
  if (c?.useCustomDomain && c?.customUrl) return c.customUrl;
  return 'https://lkoatrkhuigdolnjsbie.supabase.co';
}

function astranovPublicOrigin() {
  try {
    const host = location.hostname || '';
    if (host === 'astranov.eu' || host.endsWith('.astranov.eu')) return location.origin;
  } catch (_) { /* */ }
  return 'https://astranov.eu';
}

function scrubSupabaseLeak(text) {
  return String(text || '')
    .replace(/[a-z0-9]{18,}\.supabase\.co/gi, 'astranov.eu')
    .replace(/\bsupabase\b/gi, 'Astranov');
}

function astranovizeAuthUrl(url) {
  try {
    const origin = astranovPublicOrigin();
    return String(url || '')
      .replace(/https:\/\/[a-z0-9]{18,}\.supabase\.co/gi, origin)
      .replace(/redirect_uri=[^&]+/i, 'redirect_uri=' + encodeURIComponent(origin + '/auth/v1/callback'));
  } catch (_) {
    return url;
  }
}

window.ASTRANOV_GOOGLE_CLIENT_ID = ASTRANOV_GOOGLE_CLIENT_ID;
window.resolveAstranovSupabaseUrl = resolveAstranovSupabaseUrl;
window.astranovPublicOrigin = astranovPublicOrigin;
window.scrubSupabaseLeak = scrubSupabaseLeak;
window.astranovizeAuthUrl = astranovizeAuthUrl;