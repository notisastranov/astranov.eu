/* Astranov SpaceNet — ALMIGHTY crawler
 * Find anything: maps · POIs · web · wiki · wikidata · code · products · media · weather · nations
 * Results paint globe + city map + vendor profile tiles. No single source is the whole mind.
 */
(function (global) {
  'use strict';

  const UA = 'AstranovSpaceNet/2.0 (https://astranov.eu; almighty-crawl)';
  const CACHE = new Map();
  const CACHE_MS = 5 * 60 * 1000;

  function cacheGet(k) {
    const hit = CACHE.get(k);
    if (!hit) return null;
    if (Date.now() - hit.t > CACHE_MS) {
      CACHE.delete(k);
      return null;
    }
    return hit.v;
  }

  function cacheSet(k, v) {
    CACHE.set(k, { t: Date.now(), v });
    if (CACHE.size > 80) {
      const first = CACHE.keys().next().value;
      CACHE.delete(first);
    }
  }

  async function fetchJson(url, opts) {
    const r = await fetch(url, {
      ...opts,
      headers: {
        Accept: 'application/json',
        ...(opts?.headers || {}),
      },
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  async function raceOk(promises, limit) {
    const out = [];
    const settled = await Promise.allSettled(promises);
    for (const s of settled) {
      if (s.status === 'fulfilled' && s.value != null) {
        if (Array.isArray(s.value)) out.push(...s.value);
        else out.push(s.value);
      }
      if (limit && out.length >= limit) break;
    }
    return out;
  }

  // ─── GEO ─────────────────────────────────────────────
  async function geocodeNominatim(q) {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=8&addressdetails=1&q=' +
      encodeURIComponent(q);
    const data = await fetchJson(url, { headers: { 'Accept-Language': 'en,el' } });
    return (data || []).map((d) => ({
      name: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      type: d.type,
      kind: d.class || d.type || 'place',
      source: 'nominatim',
      importance: d.importance,
    }));
  }

  async function geocodePhoton(q) {
    const url = 'https://photon.komoot.io/api/?limit=8&q=' + encodeURIComponent(q);
    const data = await fetchJson(url);
    return (data.features || []).map((f) => {
      const p = f.properties || {};
      const c = f.geometry?.coordinates || [];
      return {
        name: [p.name, p.city, p.country].filter(Boolean).join(', ') || p.name || q,
        lat: c[1],
        lng: c[0],
        type: p.osm_value || p.type,
        kind: p.osm_key || 'place',
        source: 'photon',
      };
    }).filter((x) => x.lat != null);
  }

  async function geocode(q) {
    const ck = 'geo:' + q;
    const hit = cacheGet(ck);
    if (hit) return hit;
    const parts = await Promise.allSettled([geocodeNominatim(q), geocodePhoton(q)]);
    const seen = new Set();
    const out = [];
    for (const p of parts) {
      if (p.status !== 'fulfilled') continue;
      for (const row of p.value || []) {
        const key = (row.lat?.toFixed?.(3) || '') + ',' + (row.lng?.toFixed?.(3) || '') + row.name?.slice(0, 24);
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(row);
      }
    }
    cacheSet(ck, out);
    return out;
  }

  async function reverse(lat, lng) {
    try {
      const url =
        'https://nominatim.openstreetmap.org/reverse?format=json&lat=' + lat + '&lon=' + lng;
      const d = await fetchJson(url, { headers: { 'Accept-Language': 'en,el' } });
      return d?.display_name || lat.toFixed(4) + ', ' + lng.toFixed(4);
    } catch (_) {
      return lat.toFixed(4) + ', ' + lng.toFixed(4);
    }
  }

  // ─── OVERPASS POIs (broad intent → filter) ───────────
  function overpassFilter(q) {
    const s = String(q || '').toLowerCase();
    if (/restaurant|food|eat|dining|φαγητ|εστιατ/.test(s))
      return 'node["amenity"~"restaurant|cafe|fast_food|bar|biergarten|food_court"]';
    if (/cafe|coffee|καφ/.test(s)) return 'node["amenity"~"cafe|bar"]';
    if (/hotel|stay|sleep|ξενοδοχ/.test(s)) return 'node["tourism"~"hotel|guest_house|hostel|apartment"]';
    if (/shop|store|market|mall|αγορ/.test(s)) return 'node["shop"]';
    if (/pharmacy|φαρμακ|hospital|doctor|clinic|health/.test(s))
      return 'node["amenity"~"hospital|pharmacy|clinic|doctors|dentist"]';
    if (/gas|fuel|petrol|βενζιν/.test(s)) return 'node["amenity"="fuel"]';
    if (/bank|atm|τράπεζ/.test(s)) return 'node["amenity"~"bank|atm"]';
    if (/park|nature|beach|παραλί/.test(s)) return 'node["leisure"~"park|beach_resort|nature_reserve"]';
    if (/gym|fitness|sport/.test(s)) return 'node["leisure"~"fitness_centre|sports_centre"]';
    if (/job|work|office|company/.test(s)) return 'node["office"]';
    if (/school|university|education/.test(s)) return 'node["amenity"~"school|university|college|library"]';
    if (/museum|culture|art|theatre|cinema/.test(s))
      return 'node["tourism"~"museum|gallery|attraction"];node["amenity"~"theatre|cinema"]';
    if (/church|temple|mosque|religion/.test(s)) return 'node["amenity"~"place_of_worship"]';
    if (/parking|park car/.test(s)) return 'node["amenity"="parking"]';
    // Almighty default: anything named near you
    return 'node["name"]["amenity"];node["name"]["shop"];node["name"]["tourism"]';
  }

  async function nearby(lat, lng, radiusM, query) {
    const r = radiusM || 2200;
    const filter = overpassFilter(query);
    const body =
      '[out:json][timeout:18];(' +
      filter
        .split(';')
        .filter(Boolean)
        .map((f) => f + '(around:' + r + ',' + lat + ',' + lng + ');')
        .join('') +
      ');out center 40;';
    try {
      const data = await fetchJson('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'text/plain' },
      });
      return (data.elements || [])
        .map((el) => {
          const tags = el.tags || {};
          return {
            name: tags.name || tags.brand || tags.amenity || tags.shop || 'place',
            lat: el.lat || el.center?.lat,
            lng: el.lon || el.center?.lon,
            kind: tags.amenity || tags.shop || tags.tourism || tags.leisure || 'poi',
            source: 'overpass',
            cuisine: tags.cuisine || '',
            phone: tags.phone || tags['contact:phone'] || '',
            website: tags.website || tags['contact:website'] || '',
            hours: tags.opening_hours || '',
          };
        })
        .filter((p) => p.lat != null && p.name);
    } catch (_) {
      return [];
    }
  }

  /** Edge vendor-crawler (Supabase) — bulk POIs when available */
  async function edgeVendors(lat, lng, radius) {
    try {
      const cfg = global.SN_CONFIG || {};
      const url = (cfg.sbUrl || global.SB_URL) + '/functions/v1/vendor-crawler';
      const r = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: cfg.sbKey || global.SB_KEY,
          Authorization: 'Bearer ' + (cfg.sbKey || global.SB_KEY),
        },
        body: JSON.stringify({ lat, lng, radius: radius || 2500 }),
      });
      const j = await r.json().catch(() => ({}));
      return { ok: !!j.ok, count: j.count || 0, error: j.error };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  // ─── KNOWLEDGE ───────────────────────────────────────
  async function webSearch(q) {
    const url =
      'https://api.duckduckgo.com/?q=' +
      encodeURIComponent(q) +
      '&format=json&no_html=1&skip_disambig=1';
    try {
      const d = await fetchJson(url);
      const out = [];
      if (d.AbstractText) {
        out.push({
          title: d.Heading || q,
          text: d.AbstractText,
          url: d.AbstractURL || '',
          source: 'ddg',
        });
      }
      if (d.Answer) out.push({ title: 'Answer', text: String(d.Answer), url: '', source: 'ddg' });
      if (d.Definition)
        out.push({ title: 'Definition', text: String(d.Definition), url: d.DefinitionURL || '', source: 'ddg' });
      (d.RelatedTopics || []).slice(0, 10).forEach((t) => {
        if (t.Text)
          out.push({ title: (t.Text || '').slice(0, 90), text: t.Text, url: t.FirstURL || '', source: 'ddg' });
        if (t.Topics) {
          t.Topics.slice(0, 4).forEach((x) => {
            if (x.Text)
              out.push({
                title: x.Text.slice(0, 90),
                text: x.Text,
                url: x.FirstURL || '',
                source: 'ddg',
              });
          });
        }
      });
      return out.slice(0, 14);
    } catch (_) {
      return [];
    }
  }

  async function wiki(q) {
    try {
      const url =
        'https://en.wikipedia.org/api/rest_v1/page/summary/' +
        encodeURIComponent(q.replace(/\s+/g, '_'));
      const d = await fetchJson(url);
      if (d.extract) {
        return {
          title: d.title,
          text: d.extract,
          url: d.content_urls?.desktop?.page || '',
          lat: d.coordinates?.lat,
          lng: d.coordinates?.lon,
          thumb: d.thumbnail?.source || '',
          source: 'wikipedia',
        };
      }
    } catch (_) {}
    return null;
  }

  async function wikiSearch(q) {
    try {
      const url =
        'https://en.wikipedia.org/w/api.php?action=opensearch&limit=8&namespace=0&format=json&origin=*&search=' +
        encodeURIComponent(q);
      const d = await fetchJson(url);
      const titles = d[1] || [];
      const descs = d[2] || [];
      const urls = d[3] || [];
      return titles.map((t, i) => ({
        title: t,
        text: descs[i] || t,
        url: urls[i] || '',
        source: 'wiki-search',
      }));
    } catch (_) {
      return [];
    }
  }

  async function wikidata(q) {
    try {
      const url =
        'https://www.wikidata.org/w/api.php?action=wbsearchentities&search=' +
        encodeURIComponent(q) +
        '&language=en&limit=6&format=json&origin=*';
      const d = await fetchJson(url);
      return (d.search || []).map((s) => ({
        title: s.label,
        text: s.description || s.label,
        url: 'https://www.wikidata.org/wiki/' + s.id,
        id: s.id,
        source: 'wikidata',
      }));
    } catch (_) {
      return [];
    }
  }

  // ─── CODE (GitHub + npm — find anything code) ───────
  async function codeSearch(q) {
    const out = [];
    try {
      const gh =
        'https://api.github.com/search/repositories?q=' +
        encodeURIComponent(q) +
        '&per_page=6&sort=stars';
      const d = await fetchJson(gh, { headers: { Accept: 'application/vnd.github+json' } });
      (d.items || []).forEach((r) => {
        out.push({
          title: r.full_name,
          text: (r.description || '') + ' ★' + (r.stargazers_count || 0),
          url: r.html_url,
          source: 'github',
          kind: 'repo',
          lang: r.language,
        });
      });
    } catch (_) {}
    try {
      const npm =
        'https://registry.npmjs.org/-/v1/search?text=' + encodeURIComponent(q) + '&size=6';
      const d = await fetchJson(npm);
      (d.objects || []).forEach((o) => {
        const p = o.package || {};
        out.push({
          title: p.name + '@' + (p.version || ''),
          text: p.description || '',
          url: p.links?.npm || 'https://www.npmjs.com/package/' + p.name,
          source: 'npm',
          kind: 'package',
        });
      });
    } catch (_) {}
    return out;
  }

  // ─── PRODUCTS / MEDIA / NATIONS / BOOKS / WEATHER ────
  async function products(q) {
    try {
      const url =
        'https://world.openfoodfacts.org/cgi/search.pl?search_terms=' +
        encodeURIComponent(q) +
        '&search_simple=1&action=process&json=1&page_size=8';
      const d = await fetchJson(url);
      return (d.products || [])
        .filter((p) => p.product_name)
        .map((p) => ({
          title: p.product_name,
          text: [p.brands, p.categories_tags?.[0]].filter(Boolean).join(' · '),
          url: p.url || 'https://world.openfoodfacts.org/product/' + p.code,
          photo: p.image_small_url || p.image_url || '',
          source: 'openfoodfacts',
          kind: 'product',
        }));
    } catch (_) {
      return [];
    }
  }

  async function media(q) {
    try {
      const url = 'https://api.tvmaze.com/search/shows?q=' + encodeURIComponent(q);
      const d = await fetchJson(url);
      return (d || []).slice(0, 8).map((row) => {
        const s = row.show || {};
        return {
          title: s.name,
          text: (s.summary || '').replace(/<[^>]+>/g, '').slice(0, 160),
          url: s.url || '',
          photo: s.image?.medium || '',
          source: 'tvmaze',
          kind: 'show',
        };
      });
    } catch (_) {
      return [];
    }
  }

  async function books(q) {
    try {
      const url =
        'https://openlibrary.org/search.json?q=' + encodeURIComponent(q) + '&limit=6';
      const d = await fetchJson(url);
      return (d.docs || []).map((b) => ({
        title: b.title,
        text: (b.author_name || []).slice(0, 2).join(', ') + (b.first_publish_year ? ' · ' + b.first_publish_year : ''),
        url: b.key ? 'https://openlibrary.org' + b.key : '',
        source: 'openlibrary',
        kind: 'book',
      }));
    } catch (_) {
      return [];
    }
  }

  async function nations(q) {
    try {
      const url = 'https://restcountries.com/v3.1/name/' + encodeURIComponent(q) + '?fields=name,capital,latlng,population,region,flags,currencies';
      const d = await fetchJson(url);
      return (d || []).slice(0, 5).map((c) => ({
        name: c.name?.common || q,
        lat: c.latlng?.[0],
        lng: c.latlng?.[1],
        kind: 'country',
        source: 'restcountries',
        text:
          (c.capital?.[0] || '') +
          ' · ' +
          (c.region || '') +
          ' · pop ' +
          (c.population || '?'),
        flag: c.flags?.png || c.flags?.svg || '',
      }));
    } catch (_) {
      return [];
    }
  }

  async function weather(lat, lng) {
    try {
      const url =
        'https://api.open-meteo.com/v1/forecast?latitude=' +
        lat +
        '&longitude=' +
        lng +
        '&current=temperature_2m,weather_code,wind_speed_10m';
      const d = await fetchJson(url);
      const cur = d.current || {};
      return {
        temp: cur.temperature_2m,
        wind: cur.wind_speed_10m,
        code: cur.weather_code,
        text:
          (cur.temperature_2m != null ? cur.temperature_2m + '°C' : '?') +
          (cur.wind_speed_10m != null ? ' · wind ' + cur.wind_speed_10m + ' km/h' : ''),
        source: 'open-meteo',
      };
    } catch (_) {
      return null;
    }
  }

  function intentOf(q) {
    const s = String(q || '').toLowerCase();
    return {
      code: /\b(code|github|npm|library|sdk|api|repo|package|javascript|python|rust|typescript)\b/.test(s),
      product: /\b(product|food|brand|barcode|nutrition|buy)\b/.test(s),
      media: /\b(movie|film|series|tv|show|netflix|actor)\b/.test(s),
      book: /\b(book|novel|author|isbn|read)\b/.test(s),
      country: /\b(country|nation|capital of|population of)\b/.test(s),
      weather: /\b(weather|temperature|forecast|rain|wind)\b/.test(s),
      map: /\b(near|nearby|map|restaurant|cafe|hotel|shop|pharmacy|around|city|street)\b/.test(s) || s.length < 40,
    };
  }

  /**
   * ALMIGHTY crawl — parallel multi-source; paints map + profiles + knowledge
   */
  async function crawl(query, opts) {
    const q = String(query || '').trim();
    if (!q) {
      return emptyResult();
    }
    const pos = opts?.pos || global._snLastPos || global.SNTasks?.pos || { lat: 36.43, lng: 28.22 };
    const intent = intentOf(q);
    const almighty = opts?.all !== false; // default almighty

    global.SNCli?.log?.('⚡ Almighty crawl · ' + q, 'dim');
    global.SNCli?.preview?.('Crawl · ' + q);

    const results = emptyResult();
    results.query = q;
    results.intent = intent;
    results.pos = pos;

    const jobs = [];

    // Always: geo + knowledge
    jobs.push(
      geocode(q)
        .then((p) => {
          results.places = p;
        })
        .catch(() => {})
    );
    jobs.push(
      webSearch(q)
        .then((w) => {
          results.web = w;
        })
        .catch(() => {})
    );
    jobs.push(
      wiki(q)
        .then((w) => {
          results.wiki = w;
        })
        .catch(() => {})
    );
    jobs.push(
      wikiSearch(q)
        .then((w) => {
          results.wikiHits = w;
        })
        .catch(() => {})
    );
    jobs.push(
      wikidata(q)
        .then((w) => {
          results.wikidata = w;
        })
        .catch(() => {})
    );

    // Maps / POIs
    if (almighty || intent.map) {
      jobs.push(
        nearby(pos.lat, pos.lng, opts?.radiusM || 2500, q)
          .then((n) => {
            results.nearby = n;
          })
          .catch(() => {})
      );
      jobs.push(
        edgeVendors(pos.lat, pos.lng, opts?.radiusM || 2500)
          .then((e) => {
            results.edge = e;
          })
          .catch(() => {})
      );
    }

    // Specialized sources
    if (almighty || intent.code) {
      jobs.push(
        codeSearch(q)
          .then((c) => {
            results.code = c;
          })
          .catch(() => {})
      );
    }
    if (almighty || intent.product) {
      jobs.push(
        products(q)
          .then((p) => {
            results.products = p;
          })
          .catch(() => {})
      );
    }
    if (almighty || intent.media) {
      jobs.push(
        media(q)
          .then((m) => {
            results.media = m;
          })
          .catch(() => {})
      );
    }
    if (almighty || intent.book) {
      jobs.push(
        books(q)
          .then((b) => {
            results.books = b;
          })
          .catch(() => {})
      );
    }
    if (almighty || intent.country) {
      jobs.push(
        nations(q)
          .then((n) => {
            results.nations = n;
            // nations with coords act as places
            n.forEach((c) => {
              if (c.lat != null) results.places.push(c);
            });
          })
          .catch(() => {})
      );
    }

    await Promise.all(jobs);

    // Weather at focus
    const focus = results.places[0] || (results.wiki?.lat != null ? results.wiki : null) || pos;
    if (almighty || intent.weather) {
      results.weather = await weather(focus.lat, focus.lng).catch(() => null);
    }

    // Local task DNA
    try {
      results.localTasks = global.SNTasks?.search?.(q) || { tasks: [], roles: [] };
    } catch (_) {
      results.localTasks = { tasks: [], roles: [] };
    }

    // Paint globe
    results.places.slice(0, 6).forEach((p, i) => {
      if (p.lat != null)
        global.SNGlobe?.pulse?.(p.lat, p.lng, 0xffffff, String(p.name).slice(0, 20), 16000 + i * 400);
    });
    results.nearby.slice(0, 16).forEach((p) => {
      global.SNGlobe?.pulse?.(p.lat, p.lng, 0xffaa44, String(p.name).slice(0, 16), 12000);
    });
    if (results.wiki?.lat != null) {
      global.SNGlobe?.pulse?.(results.wiki.lat, results.wiki.lng, 0x66aaff, results.wiki.title, 20000);
    }

    // Fly
    if (results.places[0]?.lat != null) {
      global.SNGlobe?.flyNear?.(results.places[0].lat, results.places[0].lng, 'national');
      try {
        global.SNTasks?.setPos?.(results.places[0].lat, results.places[0].lng);
      } catch (_) {}
    } else if (results.wiki?.lat != null) {
      global.SNGlobe?.flyNear?.(results.wiki.lat, results.wiki.lng, 'national');
    }

    // City map + vendor tiles
    const mapStuff = results.nearby.concat(results.places.filter((p) => p.lat != null));
    if (mapStuff.length && opts?.openMap !== false) {
      const f = results.places[0] || pos;
      void global.SNMap?.open?.(f.lat, f.lng)?.then?.(() => {
        try {
          global.SNMap?.plotCrawl?.(mapStuff);
          global.SNMap?.showProfiles?.();
        } catch (_) {}
      });
    }

    results.sources = summarizeSources(results);
    results.score = scoreResult(results);
    return results;
  }

  function emptyResult() {
    return {
      places: [],
      nearby: [],
      web: [],
      wiki: null,
      wikiHits: [],
      wikidata: [],
      code: [],
      products: [],
      media: [],
      books: [],
      nations: [],
      weather: null,
      edge: null,
      localTasks: { tasks: [], roles: [] },
      sources: [],
      score: 0,
    };
  }

  function summarizeSources(r) {
    const s = [];
    if (r.places?.length) s.push('geo:' + r.places.length);
    if (r.nearby?.length) s.push('poi:' + r.nearby.length);
    if (r.web?.length) s.push('web:' + r.web.length);
    if (r.wiki) s.push('wiki');
    if (r.wikidata?.length) s.push('wd:' + r.wikidata.length);
    if (r.code?.length) s.push('code:' + r.code.length);
    if (r.products?.length) s.push('prod:' + r.products.length);
    if (r.media?.length) s.push('media:' + r.media.length);
    if (r.books?.length) s.push('books:' + r.books.length);
    if (r.weather) s.push('wx');
    if (r.edge?.ok) s.push('edge:' + (r.edge.count || 0));
    return s;
  }

  function scoreResult(r) {
    return (
      (r.places?.length || 0) * 3 +
      (r.nearby?.length || 0) * 2 +
      (r.web?.length || 0) +
      (r.wiki ? 4 : 0) +
      (r.code?.length || 0) * 2 +
      (r.products?.length || 0) +
      (r.media?.length || 0) +
      (r.books?.length || 0)
    );
  }

  /** Pretty dump for CLI */
  function report(results, log) {
    const L = log || ((t, c) => global.SNCli?.log?.(t, c));
    if (!results) return;
    L('── Almighty · ' + (results.sources || []).join(' · ') + ' · score ' + (results.score || 0), 'dim');
    if (results.weather?.text) L('🌤 ' + results.weather.text, 'ok');
    (results.places || []).slice(0, 5).forEach((p) => L('📍 ' + String(p.name).slice(0, 70), 'ok'));
    (results.nearby || []).slice(0, 8).forEach((p) => L('• ' + p.name.slice(0, 48) + ' · ' + p.kind, 'ok'));
    if (results.wiki?.text) L('📖 ' + results.wiki.title + ': ' + results.wiki.text.slice(0, 200), 'ok');
    (results.web || []).slice(0, 5).forEach((w) => L('· ' + (w.title || w.text).slice(0, 90), 'ok'));
    (results.code || []).slice(0, 5).forEach((c) => L('</> ' + c.title + ' · ' + (c.text || '').slice(0, 50), 'ok'));
    (results.products || []).slice(0, 4).forEach((p) => L('🛒 ' + p.title, 'ok'));
    (results.media || []).slice(0, 4).forEach((m) => L('🎬 ' + m.title, 'ok'));
    (results.books || []).slice(0, 4).forEach((b) => L('📚 ' + b.title + ' · ' + b.text, 'ok'));
    if (results.edge?.ok) L('Edge vendors upsert · ' + results.edge.count, 'dim');
    if (!(results.score > 0)) L('Empty · try: crawl restaurants near me · find Elon Musk · code three.js globe', 'dim');
  }

  global.SNSearch = {
    geocode,
    reverse,
    nearby,
    webSearch,
    wiki,
    wikiSearch,
    wikidata,
    codeSearch,
    products,
    media,
    books,
    nations,
    weather,
    edgeVendors,
    crawl,
    report,
    intentOf,
  };
})(window);
