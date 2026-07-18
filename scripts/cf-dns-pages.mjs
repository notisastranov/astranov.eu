import fs from 'fs';
import path from 'path';
import os from 'os';

const conf = fs.readFileSync(
  path.join(os.homedir(), 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml'),
  'utf8'
);
const tok = conf.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
const headers = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };
const zoneId = 'dd571aeb31649f036f3a8e49e2acd202'; // astranov.eu

const list = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`,
  { headers }
);
const lj = await list.json();
const recs = lj.result || [];
console.log('DNS records:');
for (const r of recs) {
  console.log(r.type, r.name, '→', r.content, 'proxied=' + r.proxied, 'id=' + r.id.slice(0, 8));
}

// For Cloudflare Pages on same zone, typically:
// CNAME @ → astranov.pages.dev (or CF creates it when domain is added)
// We may need to set CNAME for apex - CF supports CNAME flattening
const target = 'astranov.pages.dev';
const wanted = [
  { type: 'CNAME', name: 'astranov.eu', content: target },
  { type: 'CNAME', name: 'www.astranov.eu', content: target },
];

for (const w of wanted) {
  const existing = recs.find(
    (r) => r.name === w.name && (r.type === 'CNAME' || r.type === 'A' || r.type === 'AAAA')
  );
  if (existing) {
    console.log('\nUpdating', existing.type, existing.name, existing.content, '→', w.content);
    const r = await fetch(
      `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records/${existing.id}`,
      {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          type: 'CNAME',
          name: w.name,
          content: w.content,
          proxied: true,
          ttl: 1,
        }),
      }
    );
    const j = await r.json();
    console.log('update', r.status, j.success, j.errors || j.result?.content);
  } else {
    console.log('\nCreating CNAME', w.name, '→', w.content);
    const r = await fetch(`https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        type: 'CNAME',
        name: w.name,
        content: w.content,
        proxied: true,
        ttl: 1,
      }),
    });
    const j = await r.json();
    console.log('create', r.status, j.success, j.errors || j.result?.content);
  }
}

// Check pages domain status
const accountId = '04faced90ecdb9aae7c15537751180da';
const d = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/astranov/domains`,
  { headers }
);
const dj = await d.json();
console.log('\nPages domains status:');
for (const x of dj.result || []) {
  console.log(x.name, x.status, x.verification_data?.status, x.validation_data?.status);
}
