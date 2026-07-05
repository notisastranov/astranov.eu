#!/usr/bin/env node
/** Verify production OAuth authorize URL — redirect_uri must stay on Supabase host */
const ORIGIN = process.argv[2] || 'https://astranov.eu';
const url = ORIGIN + '/auth/v1/authorize?provider=google&redirect_to=' + encodeURIComponent(ORIGIN + '/');

const r = await fetch(url, { redirect: 'manual' });
const loc = r.headers.get('location') || '';
const redirectUri = decodeURIComponent((loc.match(/redirect_uri=([^&]+)/) || [])[1] || '');
const clientId = (loc.match(/client_id=([^&]+)/) || [])[1] || '';

const ok = r.status === 302 && redirectUri.includes('.supabase.co/auth/v1/callback');
console.log(JSON.stringify({ status: r.status, ok, clientId: clientId.slice(0, 20) + '…', redirectUri }, null, 2));
process.exit(ok ? 0 : 1);