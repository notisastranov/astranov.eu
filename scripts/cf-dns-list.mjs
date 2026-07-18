import fs from 'fs';
import path from 'path';
import os from 'os';

const conf = fs.readFileSync(
  path.join(os.homedir(), 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml'),
  'utf8'
);
const tok = conf.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
const headers = { Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' };

// list zones full
const z = await fetch('https://api.cloudflare.com/client/v4/zones?name=astranov.eu', { headers });
const zj = await z.json();
console.log('zone', JSON.stringify(zj.result?.[0] || zj.errors, null, 2).slice(0, 600));
const zoneId = zj.result?.[0]?.id;
if (!zoneId) process.exit(1);

const list = await fetch(
  `https://api.cloudflare.com/client/v4/zones/${zoneId}/dns_records?per_page=100`,
  { headers }
);
const lj = await list.json();
console.log('list success', lj.success, 'count', lj.result?.length, 'errors', lj.errors);
for (const r of lj.result || []) {
  console.log(r.type.padEnd(6), r.name.padEnd(30), r.content, 'proxied=' + r.proxied);
}

// token verify
const v = await fetch('https://api.cloudflare.com/client/v4/user/tokens/verify', { headers });
console.log('token verify', await v.text());
