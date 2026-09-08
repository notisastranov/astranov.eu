/** SpaceNet public listings. No fake shops. Device-local always wins if net is down. */
const SB = 'https://lkoatrkhuigdolnjsbie.supabase.co';
const SB_ANON =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'content-type');
  res.setHeader('Cache-Control', 'no-store');
}

function readBody(req) {
  if (req.body && typeof req.body === 'object' && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return {};
}

function slim(row) {
  if (!row || typeof row !== 'object') return null;
  const out = {};
  const keep = [
    'id',
    'kind',
    'lat',
    'lng',
    'name',
    'label',
    'text',
    'menu',
    'hours',
    'open',
    'phone',
    'note',
    'peer',
    'presence',
    'routes',
    'vehicles',
    'range',
    'carry',
    'pref',
    'street',
    'number',
    'floor',
    'bell',
    'bellName',
    'place',
    'raw',
    't',
    'held',
    'status',
    'avc',
    'ride',
    'how',
    'query',
    'shop',
    'driver',
    'drop',
    'customerPeer',
    'holdMin',
    'flag',
    'strict',
  ];
  keep.forEach(function (k) {
    if (row[k] != null && row[k] !== '') out[k] = row[k];
  });
  ['cover', 'profile', 'photo'].forEach(function (k) {
    if (typeof row[k] === 'string' && row[k].indexOf('data:image') === 0 && row[k].length < 180000) out[k] = row[k];
  });
  if (Array.isArray(row.menuPhotos)) {
    out.menuPhotos = row.menuPhotos.filter(function (p) {
      return typeof p === 'string' && p.length < 180000;
    }).slice(0, 2);
  }
  let json = JSON.stringify(out);
  if (json.length > 350000) {
    delete out.menuPhotos;
    delete out.cover;
    delete out.profile;
    delete out.photo;
    json = JSON.stringify(out);
  }
  if (json.length > 350000) return null;
  return out;
}

async function sb(path, opt) {
  const headers = Object.assign(
    {
      apikey: SB_ANON,
      Authorization: 'Bearer ' + SB_ANON,
      'Content-Type': 'application/json',
    },
    (opt && opt.headers) || {}
  );
  const r = await fetch(SB + '/rest/v1/' + path, Object.assign({}, opt, { headers }));
  const text = await r.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch (_) {}
  return { ok: r.ok, status: r.status, json: json, text: text };
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (req.method === 'GET') {
    const q = req.query || {};
    const lat = Number(q.lat);
    const lng = Number(q.lng);
    const got = await sb('sn_listings?select=id,kind,lat,lng,body,updated_at&order=updated_at.desc&limit=80');
    if (!got.ok) {
      res.status(200).json({ ok: false, local: true, status: got.status, shops: [], drops: [], drivers: [], posts: [], jobs: [] });
      return;
    }
    const buckets = { shops: [], drops: [], drivers: [], posts: [], jobs: [] };
    (got.json || []).forEach(function (row) {
      const body = row.body || {};
      body.id = body.id || row.id;
      body.kind = body.kind || row.kind;
      body.lat = Number(body.lat != null ? body.lat : row.lat);
      body.lng = Number(body.lng != null ? body.lng : row.lng);
      if (!isFinite(body.lat) || !isFinite(body.lng)) return;
      if (body.kind === 'drop' || body.secret) return;
      if (isFinite(lat) && isFinite(lng)) {
        const dLat = ((body.lat - lat) * Math.PI) / 180;
        const dLng = ((body.lng - lng) * Math.PI) / 180;
        const x =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos((lat * Math.PI) / 180) * Math.cos((body.lat * Math.PI) / 180) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        const km = 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
        if (km > 80) return;
      }
      const k = body.kind === 'shop' ? 'shops' : body.kind === 'driver' ? 'drivers' : body.kind === 'post' ? 'posts' : body.kind === 'job' ? 'jobs' : '';
      if (k === 'jobs' && body.drop) {
        const peer = String(q.peer || '');
        const allow = peer && ((body.driver && body.driver.peer === peer) || body.customerPeer === peer);
        if (!allow) delete body.drop;
      }
      if (k) buckets[k].push(body);
    });
    res.status(200).json(Object.assign({ ok: true, local: false }, buckets));
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method' });
    return;
  }

  const body = readBody(req);
  const row = slim(body.row || body);
  if (row && (row.kind === 'drop' || row.secret)) {
    res.status(200).json({ ok: true, local: true, secret: true });
    return;
  }
  if (!row || !row.id || !row.kind || !isFinite(Number(row.lat))) {
    res.status(400).json({ ok: false, error: 'row' });
    return;
  }
  const put = await sb('sn_listings?on_conflict=id', {
    method: 'POST',
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify({
      id: String(row.id).slice(0, 64),
      kind: String(row.kind).slice(0, 16),
      lat: Number(row.lat),
      lng: Number(row.lng),
      body: row,
      updated_at: new Date().toISOString(),
    }),
  });
  res.status(200).json({ ok: put.ok, local: !put.ok, status: put.status });
};
