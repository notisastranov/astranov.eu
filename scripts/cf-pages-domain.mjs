import fs from 'fs';
import path from 'path';
import os from 'os';

const confPaths = [
  path.join(os.homedir(), '.wrangler', 'config', 'default.toml'),
  path.join(process.env.APPDATA || '', 'xdg.config', '.wrangler', 'config', 'default.toml'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'xdg.config', '.wrangler', 'config', 'default.toml'),
];
let conf = '';
for (const p of confPaths) {
  try {
    conf = fs.readFileSync(p, 'utf8');
    console.log('config', p);
    break;
  } catch {}
}
const oauth = conf.match(/oauth_token\s*=\s*"([^"]+)"/)?.[1];
const api = conf.match(/api_token\s*=\s*"([^"]+)"/)?.[1];
const tok = oauth || api;
if (!tok) {
  console.error('no wrangler token');
  process.exit(1);
}
const accountId = '04faced90ecdb9aae7c15537751180da';
const headers = {
  Authorization: 'Bearer ' + tok,
  'Content-Type': 'application/json',
};

const z = await fetch('https://api.cloudflare.com/client/v4/zones?per_page=50', { headers });
const zj = await z.json();
console.log('zones', z.status, (zj.result || []).map((x) => x.name).join(', ') || JSON.stringify(zj.errors));

const domains = ['astranov.eu', 'www.astranov.eu'];
for (const name of domains) {
  const r = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/astranov/domains`,
    { method: 'POST', headers, body: JSON.stringify({ name }) }
  );
  const j = await r.json();
  console.log('add', name, r.status, JSON.stringify(j).slice(0, 400));
}

const list = await fetch(
  `https://api.cloudflare.com/client/v4/accounts/${accountId}/pages/projects/astranov/domains`,
  { headers }
);
const lj = await list.json();
console.log('domains now', JSON.stringify(lj.result || lj.errors, null, 2).slice(0, 800));
