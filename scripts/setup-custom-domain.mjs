#!/usr/bin/env node
/** Register api.astranov.eu as Supabase custom domain (fixes Google OAuth showing random project ref). */
import { execSync } from 'node:child_process';

const REF = 'lkoatrkhuigdolnjsbie';
const HOST = 'api.astranov.eu';
const TARGET = `${REF}.supabase.co`;

console.log('Astranov — Supabase custom domain setup');
console.log('');
console.log('Problem: Google login shows "' + REF + '.supabase.co" — users distrust it.');
console.log('Fix: custom domain so OAuth shows "' + HOST + '"');
console.log('');
console.log('1) Cloudflare DNS for astranov.eu — add CNAME:');
console.log('   Name: api');
console.log('   Target: ' + TARGET);
console.log('   Proxy: DNS only (grey cloud) recommended for first setup');
console.log('');
console.log('2) Supabase dashboard → Settings → Add-ons → enable Custom Domain (if prompted)');
console.log('');
console.log('3) Run: supabase domains create --project-ref ' + REF + ' --custom-hostname ' + HOST);
console.log('   Add any TXT records it prints to Cloudflare');
console.log('4) Run: supabase domains reverify --project-ref ' + REF);
console.log('5) Run: supabase domains activate --project-ref ' + REF);
console.log('');
console.log('6) Google Cloud Console → OAuth client → Authorized redirect URIs — add BOTH:');
console.log('   https://' + TARGET + '/auth/v1/callback');
console.log('   https://' + HOST + '/auth/v1/callback');
console.log('');
console.log('7) OAuth consent screen: App name "Astranov", home https://astranov.eu,');
console.log('   privacy https://astranov.eu/privacy.html, terms https://astranov.eu/terms.html');
console.log('');
console.log('8) Set SUPABASE_USE_CUSTOM_DOMAIN = true in src/20-aci.js, assemble, deploy');
console.log('');

try {
  const out = execSync(`nslookup -type=cname ${HOST}`, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
  console.log('DNS check:', out.trim() || '(no CNAME yet)');
} catch (e) {
  console.log('DNS check: CNAME not found yet — add the record above first.');
}