/* Astranov SpaceNet crawl — places + web search (OSM/Nominatim + DDG + Wikipedia) */
(function (global) {
  'use strict';

  const UA = 'AstranovSpaceNet/1.0 (https://astranov.eu; contact notisastranov@gmail.com)';

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

  /** Geocode place name → lat/lng (OpenStreetMap Nominatim) */
  async function geocode(q) {
    const url =
      'https://nominatim.openstreetmap.org/search?format=json&limit=6&q=' +
      encodeURIComponent(q);
    const data = await fetchJson(url, { headers: { 'Accept-Language': 'en' } });
    return (data || []).map((d) => ({
      name: d.display_name,
      lat: parseFloat(d.lat),
      lng: parseFloat(d.lon),
      type: d.type,
      kind: d.class,
    }));
  }

  /** Reverse geocode */
  async function reverse(lat, lng) {
    const url =
      'https://nominatim.openstreetmap.org/reverse?format=json&lat=' +
      lat +
      '&lon=' +
      lng;
    const d = await fetchJson(url, { headers: { 'Accept-Language': 'en' } });
    return d?.display_name || lat.toFixed(4) + ', ' + lng.toFixed(4);
  }

  /** Nearby POIs via Overpass (restaurants, shops, etc.) */
  async function nearby(lat, lng, radiusM, query) {
    const r = radiusM || 1500;
    const q = String(query || 'amenity').toLowerCase();
    let filter = 'node["amenity"]';
    if (/restaurant|food|cafe|bar|pizza/.test(q)) filter = 'node["amenity"~"restaurant|cafe|fast_food|bar"]';
    else if (/hotel|sleep/.test(q)) filter = 'node["tourism"~"hotel|guest_house"]';
    else if (/shop|store|market/.test(q)) filter = 'node["shop"]';
    else if (/hospital|pharmacy|doctor/.test(q)) filter = 'node["amenity"~"hospital|pharmacy|clinic|doctors"]';
    else if (/job|work|office/.test(q)) filter = 'node["office"]';
    const body =
      '[out:json][timeout:15];(' +
      filter +
      '(around:' +
      r +
      ',' +
      lat +
      ',' +
      lng +
      '););out center 25;';
    const data = await fetchJson('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      body,
      headers: { 'Content-Type': 'text/plain' },
    });
    return (data.elements || []).map((el) => {
      const tags = el.tags || {};
      return {
        name: tags.name || tags.brand || tags.amenity || tags.shop || 'place',
        lat: el.lat || el.center?.lat,
        lng: el.lon || el.center?.lon,
        kind: tags.amenity || tags.shop || tags.tourism || 'poi',
      };
    }).filter((p) => p.lat != null);
  }

  /** Web search via DuckDuckGo Instant Answer API (no key) */
  async function webSearch(q) {
    const url =
      'https://api.duckduckgo.com/?q=' +
      encodeURIComponent(q) +
      '&format=json&no_html=1&skip_disambig=1';
    try {
      const d = await fetchJson(url);
      const out = [];
      if (d.AbstractText) {
        out.push({ title: d.Heading || q, text: d.AbstractText, url: d.AbstractURL || '' });
      }
      (d.RelatedTopics || []).slice(0, 8).forEach((t) => {
        if (t.Text) out.push({ title: (t.Text || '').slice(0, 80), text: t.Text, url: t.FirstURL || '' });
        if (t.Topics) {
          t.Topics.slice(0, 3).forEach((x) => {
            if (x.Text) out.push({ title: x.Text.slice(0, 80), text: x.Text, url: x.FirstURL || '' });
          });
        }
      });
      return out.slice(0, 10);
    } catch (_) {
      return [];
    }
  }

  /** Wikipedia summary */
  async function wiki(q) {
    try {
      const url =
        'https://en.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(q.replace(/\s+/g, '_'));
      const d = await fetchJson(url);
      if (d.extract) {
        return {
          title: d.title,
          text: d.extract,
          url: d.content_urls?.desktop?.page || '',
          lat: d.coordinates?.lat,
          lng: d.coordinates?.lon,
        };
      }
    } catch (_) {}
    return null;
  }

  /**
   * Unified crawl: geocode + nearby map + web + wiki
   * Depicts results on globe + city map
   */
  async function crawl(query, opts) {
    const q = String(query || '').trim();
    if (!q) return { places: [], web: [], wiki: null };
    const pos = opts?.pos || global._snLastPos || global.SNTasks?.pos || { lat: 36.43, lng: 28.22 };
    const results = { places: [], web: [], wiki: null, nearby: [] };

    global.SNCli?.log?.('Crawling maps & web · ' + q, 'dim');
    global.SNCli?.preview?.('Crawl · ' + q);

    const jobs = [
      geocode(q)
        .then((p) => {
          results.places = p;
        })
        .catch(() => {}),
      nearby(pos.lat, pos.lng, opts?.radiusM || 2000, q)
        .then((n) => {
          results.nearby = n;
        })
        .catch(() => {}),
      webSearch(q)
        .then((w) => {
          results.web = w;
        })
        .catch(() => {}),
      wiki(q)
        .then((w) => {
          results.wiki = w;
        })
        .catch(() => {}),
    ];
    await Promise.all(jobs);

    // Paint on globe
    results.places.slice(0, 5).forEach((p, i) => {
      global.SNGlobe?.pulse?.(p.lat, p.lng, 0xffffff, p.name.slice(0, 20), 16000 + i * 500);
    });
    results.nearby.slice(0, 12).forEach((p, i) => {
      global.SNGlobe?.pulse?.(p.lat, p.lng, 0xffaa44, p.name.slice(0, 16), 12000);
    });
    if (results.wiki?.lat != null) {
      global.SNGlobe?.pulse?.(results.wiki.lat, results.wiki.lng, 0x66aaff, results.wiki.title, 20000);
      global.SNGlobe?.flyNear?.(results.wiki.lat, results.wiki.lng, 'national');
    } else if (results.places[0]) {
      global.SNGlobe?.flyNear?.(results.places[0].lat, results.places[0].lng, 'national');
      try {
        global.SNTasks?.setPos?.(results.places[0].lat, results.places[0].lng);
      } catch (_) {}
    }

    // Open city map if local POIs
    if (results.nearby.length && opts?.openMap !== false) {
      const focus = results.places[0] || pos;
      void global.SNMap?.open?.(focus.lat, focus.lng)?.then?.(() => {
        try {
          global.SNMap?.plotCrawl?.(results.nearby.concat(results.places));
        } catch (_) {}
      });
    }

    return results;
  }

  global.SNSearch = {
    geocode,
    reverse,
    nearby,
    webSearch,
    wiki,
    crawl,
  };
})(window);
