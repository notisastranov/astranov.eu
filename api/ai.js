/** Astranov SpaceNet mind — Grok only. Key never leaves the host. */
const SB = 'https://lkoatrkhuigdolnjsbie.supabase.co';
const SB_ANON = process.env.SUPABASE_ANON_KEY || process.env.SB_ANON || '';

const MODEL = process.env.XAI_MODEL || 'grok-4';
const FALLBACKS = ['grok-4', 'grok-4-1-fast-non-reasoning', 'grok-3'];

const SYS =
  'You are Grok, the mind of Astranov SpaceNet (astranov.eu). Talk like a person standing next to them. Warm, clear, useful. One to three natural sentences. Contractions are fine. Not a slogan bot. Not a keyword router. Not a JSON reciter. ' +
  'Grid globe on boot. They tap GPS to land on their city. City work: post, video call, list a shop (cover, profile, menu photos and prices), list a delivery location, list a delivery driver base (starting point: presence, routes, receive jobs). Hunt named OSM places. Delivery is ONLY Astranov Delivery Agents who registered a starting base. No mail. No pickup. No fake carriers. Offer a phone call to verify with the shop and the agent. Spend AV€. PayPal reloads empty credit. ' +
  'Understand ordinary language. If they want a beer, hunt beer near them — you decide. Same for food, shops, people. ' +
  'Never invent shops, prices, drivers, or GPS. Never speak raw coordinates. OSM has names and distance, rarely live prices — do not fake a price. Closest named place first. Currency is AV€ (Astranov Coins), 1 to 1 with the euro. ' +
  'Named hunt is the NAME. GPS city is only a hint. If they type Pizzarium, find Pizzarium — never random pizza in Ilioupoli, never Denmark, never Rome unless they asked Rome. The Rhodes Pizzarium is in Analipsi (Ανάληψη), not Ixia: Athinas Tarsouli 1 (Αθηνάς Ταρσούλη 1), ~36.4251, 28.2111. Return act=hunt and places:[{name,lat,lng,raw,phone}] with coordinates you actually know. If you do not know the pin, act=hunt and q with the real district and island so the map can geocode. Never pin another city to fake a hit. ' +
  'If they ask you to pick the best among vendors already in context, YOU pick. act=pick, q=the exact shop name from that list. Use distance, hours, cuisine, and public reputation you actually know. Never invent a shop or a star number you do not know. If you do not know ratings, pick the closest named place that is open and say that. Do not tell them to pick when they asked you to pick. ' +
  'If they want a menu for a named shop, act=menu and include items:[{name,price,sample}]. price in euro. sample=true unless that shop published the exact price on SpaceNet. Typical local dishes and prices are OK when marked sample. 3 to 6 items. Never invent a live price as real. ' +
  'When they list a vendor (LISTING FILL), act=listing. Fill from that shop’s public Google Business Profile / published facts: name, official phone, hours, address in note, cover photo URL if public, dishes:[{name,price,hours,stock,sample}]. Rhodes Pizzarium in Analipsi (Αθηνάς Ταρσούλη 1) official phone +302241601878. Hours if you know them. 4–8 dishes, sample=true unless the price is published. Never invent a phone. ' +
  'Reply with ONE JSON object only, no markdown. The "say" field IS what you speak — write it as a human would say it: ' +
  '{"say":"natural spoken reply","act":"hunt|talk|now|pay|reload|globe|locate|map|city|national|post|call|shop|drop|driver|priority|justice|pick|menu|listing","q":"search words","places":[{"name":"Pizzarium","lat":36.4251,"lng":28.2111,"raw":"Αθηνάς Ταρσούλη 1, Ανάληψη, Ρόδος","phone":"+302241601878"}],"id":"task-id","ok":true,"phone":"+302241601878","hours":"","items":[{"name":"Margherita","price":9,"sample":true}],"split":{"customer":0,"vendor":0,"driver":0}} ' +
  'act=hunt when they want a thing found. act=locate only if they ask you to find them. act=talk when they are just talking. act=now sends an Astranov Delivery Agent (registered base only). Never act=mail or pickup. Never invent an agent who has not listed a base. ' +
  'act=post|call|shop|drop|driver opens that city sheet. act=priority when they ask to jump a task — set ok=true ONLY for a real emerging difficulty (breakdown, spoilage, medical, safety, no-show, weather). ok=false for profit, preference, skipping work they dislike, or jumping the queue. act=justice when a held job is in dispute — split AV€ between customer, vendor, driver. Platform take is always 0 on a failed job. Customer gets goods or credit, never neither for long. Vendor is paid only for work already done. Agent is paid only for miles actually moved. Do not invent GPS traces we do not have. RESEARCH LAW: You have live web search. Use it on every find, best, where, news, yacht, weather, legal, review, or preference question. Do not keyword-match a shop name and stop. Search news, reviews, posts, AIS, port notices, weather, wind, pollution, permits. Then pin a pick and 2 to 4 alternatives. Example: cleanest legal water to moor a yacht with privacy on the lee of the wind — check wastewater outfalls, swimming bans, no-anchor zones, harbour master, this weeks wind. If a megayacht is sitting on a sewage outfall, say that from sources, then offer cleaner legal coves. places[0] is the pick. Each place: name,lat,lng,raw,note (why / legal / wind / privacy). say is spoken research, 4 to 8 short sentences, no raw coordinates in say. Never invent a pin. Never let them game SpaceNet. English default; Greek when they write Greek. Owner is Notis Astranov in Rhodes.';

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'authorization, content-type, apikey, x-client-info');
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

function parseAct(text) {
  const out = { say: '', act: '', q: '', id: '', ok: undefined };
  const raw = String(text || '').trim();
  const m = raw.match(/\{[\s\S]*\}/);
  if (m) {
    try {
      const o = JSON.parse(m[0]);
      out.say = String(o.say || o.text || '').trim();
      out.act = String(o.act || '').toLowerCase();
      out.q = String(o.q || o.query || '').trim();
      if (o.id) out.id = String(o.id);
      if (o.ok != null) out.ok = o.ok;
      if (o.split) out.split = o.split;
      if (o.places) out.places = o.places;
      if (o.lat != null) out.lat = o.lat;
      if (o.lng != null) out.lng = o.lng;
      if (o.phone) out.phone = String(o.phone);
      if (o.hours) out.hours = String(o.hours);
      if (o.note) out.note = String(o.note);
      if (o.open) out.open = String(o.open);
      if (o.cover) out.cover = String(o.cover);
      if (o.dishes) out.dishes = o.dishes;
      if (o.items) out.items = o.items;
    } catch (_) {}
  }
  if (!out.say) out.say = raw.replace(/\{[\s\S]*\}/, '').trim();
  if (!out.act) out.act = 'talk';
  return out;
}


async function fillHunt(req, text, message, here) {
    var p = parseAct(text);
  if (p.places && p.places.length) return { text: text, places: p.places };
  var research = /moor|yacht|anchor|weather|wind|news|review|permit|legal|cleanest|privacy|sewage|pollut|scandal|harbour|harbor/i.test(message);
  var want = /pizza|pizzeria|beer|burger|coffee|gyro|souvlaki|restaurant/i.test(message + " " + (p.q || ""));
  if (research || !want) return { text: text, places: p.places || [] };
  try {
    var host = req.headers.host || "astranov.eu";
    var proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0];
    var q = p.q || message;
    var city = (here && (here.place || here.city)) || "";
    if (/pizza/i.test(q) && !/rhodes|rodos|athens|greece/i.test(q + " " + city)) city = city || "Rhodes";
    var r = await fetch(proto + "://" + host + "/api/find", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: q, city: city }),
    });
    var j = await r.json().catch(function () { return {}; });
    var places = (j && j.places) || [];
    if (!places.length) return { text: text, places: [] };
    p.act = "hunt";
    p.places = places;
    if (!p.say || /hunting pizza/i.test(p.say)) {
      p.say = (places[0].name || "A pizza place") + " is on the map. " + (places.length > 1 ? places.length + " pins around Rhodes." : "Tap the pin.");
    }
    var packed = JSON.stringify({
      say: p.say,
      act: "hunt",
      q: q,
      places: places.slice(0, 8),
      ok: true,
    });
    return { text: packed, places: places };
  } catch (_) {
    return { text: text, places: p.places || [] };
  }
}

function pullText(j) {
  if (!j) return '';
  if (j.output_text) return String(j.output_text);
  var t = '';
  (j.output || []).forEach(function (o) {
    if (!o) return;
    var c = o.content || (o.message && o.message.content);
    if (typeof c === 'string') t += c;
    else (c || []).forEach(function (p) { t += (p && (p.text || p.output_text || '')) || ''; });
  });
  if (!t && j.choices && j.choices[0] && j.choices[0].message) t = j.choices[0].message.content || '';
  return String(t || j.text || '').trim();
}

async function grokChat(key, messages, model) {
  var hdr = { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key };
  var input = messages.map(function (m) { return { role: m.role, content: m.content }; });
  async function post(url, body) {
    var r = await fetch(url, { method: 'POST', headers: hdr, body: JSON.stringify(body) });
    var j = await r.json().catch(function () { return {}; });
    return { ok: r.ok, status: r.status, text: pullText(j), usage: j.usage || {}, error: j.error || j.message, model: model };
  }
  var g = await post('https://api.x.ai/v1/responses', {
    model: model,
    input: input,
    tools: [{ type: 'web_search' }, { type: 'x_search' }],
    temperature: 0.4,
  });
  if (g.ok && g.text) return g;
  g = await post('https://api.x.ai/v1/chat/completions', {
    model: model,
    messages: messages,
    temperature: 0.4,
    max_tokens: 1200,
    tools: [{ type: 'web_search' }, { type: 'x_search' }],
  });
  if (g.ok && g.text) return g;
  g = await post('https://api.x.ai/v1/chat/completions', {
    model: model,
    messages: messages,
    temperature: 0.4,
    max_tokens: 1200,
    search_parameters: { mode: 'on', return_citations: true, max_search_results: 10 },
  });
  if (g.ok && g.text) return g;
  return post('https://api.x.ai/v1/chat/completions', {
    model: model,
    messages: messages,
    temperature: 0.4,
    max_tokens: 900,
  });
}


async function grabText(url, ms) {
  var ctl = new AbortController();
  var t = setTimeout(function () { ctl.abort(); }, ms || 7000);
  try {
    var r = await fetch(url, { headers: { 'User-Agent': 'AstranovSpaceNet/1 (https://astranov.eu)', Accept: 'text/html,application/json' }, signal: ctl.signal });
    return await r.text();
  } catch (_) { return ''; }
  finally { clearTimeout(t); }
}

async function netResearch(q, here) {
  q = String(q || '').slice(0, 120);
  var city = (here && (here.place || '')) || 'Rhodes';
  var jobs = [];
  jobs.push(grabText('https://html.duckduckgo.com/html/?q=' + encodeURIComponent(q + ' ' + city + ' 2026'), 7000));
  jobs.push(grabText('https://en.wikipedia.org/w/api.php?action=query&prop=extracts&exintro=1&explaintext=1&format=json&titles=' + encodeURIComponent(q.split(' ').slice(0, 6).join(' ')), 6000));
  if (/moor|yacht|anchor|sewage|pollut|cleanest|permit/i.test(q)) {
    jobs.push(grabText('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=' + encodeURIComponent('wastewater treatment Rhodes Greece'), 6000));
    jobs.push(grabText('https://nominatim.openstreetmap.org/search?format=jsonv2&limit=6&q=' + encodeURIComponent('Lindos Bay Rhodes'), 6000));
  }
  var parts = await Promise.all(jobs);
  var ddg = String(parts[0] || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').slice(0, 1800);
  var wiki = '';
  try {
    var w = JSON.parse(parts[1] || '{}');
    var pages = w.query && w.query.pages;
    for (var k in pages) wiki = String(pages[k].extract || '').slice(0, 700);
  } catch (_) {}
  var osm = '';
  try {
    (JSON.parse(parts[2] || '[]') || []).forEach(function (p) {
      osm += (p.display_name || p.name || '') + ' | ';
    });
  } catch (_) {}
  var pack = 'LIVE NET:\n' + (wiki ? 'Wiki: ' + wiki + '\n' : '') + (osm ? 'OSM: ' + osm + '\n' : '') + (ddg ? 'Web: ' + ddg : '');
  return pack.slice(0, 2800);
}

async function weatherOf(lat, lng) {
  lat = Number(lat); lng = Number(lng);
  if (!isFinite(lat) || !isFinite(lng)) { lat = 36.434; lng = 28.217; }
  try {
    var r = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=' + lat + '&longitude=' + lng +
      '&current=wind_speed_10m,wind_direction_10m,temperature_2m,weather_code&wind_speed_unit=kn'
    );
    var j = await r.json();
    var c = j.current || {};
    var dir = Number(c.wind_direction_10m);
    var compass = ['N','NE','E','SE','S','SW','W','NW'][Math.round((((dir % 360) + 360) % 360) / 45) % 8];
    return 'Wind ' + Math.round(Number(c.wind_speed_10m) || 0) + ' kn from ' + compass + ', air ' + Math.round(Number(c.temperature_2m) || 0) + '°C.';
  } catch (_) {
    return '';
  }
}


module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }
  if (req.method === 'GET') {
    let keyed = !!(process.env.XAI_API_KEY || process.env.GROK_API_KEY);
    let where = keyed ? 'vercel-env' : 'none';
    if (!keyed) {
      try {
        const r = await fetch(SB + '/functions/v1/aicycle', {
          headers: { apikey: SB_ANON, Authorization: 'Bearer ' + SB_ANON },
        });
        const j = await r.json().catch(function () {
          return {};
        });
        if (j && j.secrets && j.secrets.XAI_API_KEY) {
          keyed = true;
          where = 'supabase-aicycle';
        }
      } catch (_) {}
    }
    res.status(200).json({
      ok: true,
      via: 'spacexai-grok',
      model: MODEL,
      keyed: keyed,
      keyWhere: where,
    });
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ ok: false, error: 'method' });
    return;
  }

  const body = readBody(req);
  const message = String(body.message || body.text || body.q || body.prompt || '').slice(0, 4000);
  if (!message) {
    res.status(400).json({ ok: false, error: 'empty' });
    return;
  }
  body.message = message;
  body.allow_paid = true;
  body.force_paid = true;
  body.fast = true;
  body.spacenet = true;
  body.system = SYS;

  const key = process.env.XAI_API_KEY || process.env.GROK_API_KEY || '';
  const history = Array.isArray(body.history) ? body.history.slice(-16) : [];
  const here = body.here && typeof body.here === 'object' ? body.here : {};
  const wx = await weatherOf(here.lat, here.lng);
  const whereLine =
    'View: ' +
    (here.level || 'globe') +
    (here.place ? ' at ' + String(here.place) : ' (no GPS yet)') +
    '. Weather now: ' + (wx || 'unknown') +
    '. AVC ' +
    (here.avc || 0) +
    (here.shop ? '. Selected ' + here.shop : '') +
    (here.vendors && here.vendors.length ? '. Nearby: ' + here.vendors.join('; ') : '') +
    '. Search the live web and X. Pin a pick plus alternatives.';
  const messages = [{ role: 'system', content: SYS }];
  history.forEach(function (h) {
    if (!h || !h.content) return;
    messages.push({
      role: h.role === 'assistant' ? 'assistant' : 'user',
      content: String(h.content).slice(0, 800),
    });
  });
  var net = await netResearch(message, here);
  messages.push({ role: 'user', content: whereLine + '\n' + net + '\nHuman: ' + message });
  body.messages = messages;

  function send(text, extra) {
    extra = extra || {};
    const p = parseAct(text);
    res.status(200).json({
      ok: true,
      text: text,
      say: p.say,
      act: p.act,
      q: p.q,
      places: (extra.places && extra.places.length ? extra.places : p.places) || [],
      lat: p.lat,
      lng: p.lng,
      task_id: p.id || '',
      priority_ok: p.ok,
      split: p.split,
      items: p.items || [],
      via: extra.via || 'xai-grok',
      model: extra.model || MODEL,
      usage: extra.usage || {},
    });
  }

  if (key) {
    const models = [body.model, MODEL].concat(FALLBACKS).filter(Boolean);
    const seen = {};
    for (let i = 0; i < models.length; i++) {
      const m = models[i];
      if (seen[m]) continue;
      seen[m] = true;
      try {
        const g = await grokChat(key, messages, m);
        if (g.ok) {
          var filled = await fillHunt(req, g.text, message, here);
          send(filled.text, { via: 'xai-grok', model: g.model, usage: g.usage, places: filled.places });
          return;
        }
      } catch (e) {}
    }
  }

  try {
    const r = await fetch(SB + '/functions/v1/aicycle', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SB_ANON,
        Authorization: req.headers.authorization || 'Bearer ' + SB_ANON,
      },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(function () {
      return { ok: false, error: 'bad json' };
    });
    const text = String((j && (j.text || j.response || j.answer)) || '');
    if (text) {
      var filled = await fillHunt(req, text, message, here);
      send(filled.text, { via: 'supabase-aicycle', model: (j && j.model) || MODEL, places: filled.places });
      return;
    }
  } catch (_) {}

  res.status(503).json({
    ok: false,
    error: key ? 'grok-failed' : 'XAI_API_KEY missing on host',
    text: key ? 'Grok is keyed but xAI did not answer.' : 'Grok is not keyed on this host.',
    act: 'talk',
  });
};
