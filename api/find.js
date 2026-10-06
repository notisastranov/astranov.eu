const UA = "AstranovSpaceNet/4330 (https://astranov.eu; contact@astranov.eu)";
var BUILD = (function () {
  try {
    return require("fs").readFileSync(require("path").join(process.cwd(), "VERSION"), "utf8").trim() || "4330";
  } catch (e) {
    return "4330";
  }
})();

function cors(res, empty) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  // Never edge-cache empty or wrong geocodes; no-store always for /api/find.
  res.setHeader("Cache-Control", empty ? "no-store, max-age=0, s-maxage=0" : "no-store");
}

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (e) {
      return {};
    }
  }
  return {};
}

async function grab(url, ms) {
  var ctrl = new AbortController();
  var t = setTimeout(function () {
    ctrl.abort();
  }, ms || 8000);
  try {
    var r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "application/json" },
      signal: ctrl.signal,
      redirect: "follow"
    });
    if (!r.ok) return "";
    return await r.text();
  } catch (e) {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function tokens(s) {
  return String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .split(/[^a-z0-9\u0370-\u03ff]+/)
    .filter(function (t) {
      return t.length >= 2;
    });
}

var CUISINE = {
  pizza: 1, pizzeria: 1, food: 1, coffee: 1, cafe: 1, burger: 1, pharmacy: 1,
  hotel: 1, market: 1, atm: 1, night: 1, restaurant: 1, sushi: 1, kebab: 1,
  gyro: 1, beer: 1, pharm: 1, shop: 1, vendor: 1, near: 1, places: 1, amenity: 1
};

var PLACE_HINT =
  /\b(nairobi|mombasa|kisumu|kampala|athens|athina|rhodes|rodos|\u03c1\u03cc\u03b4\u03bf\u03c2|\u03b1\u03b8\u03ae\u03bd\u03b1|london|paris|berlin|rome|kenya|greece|hellas|thessaloniki|dar\s*es\s*salaam|addis\s*ababa|lagos|cairo|sydney|tokyo|singapore)\b/i;

function mentionsRhodes(s) {
  return /rhodes|rodos|\u03c1\u03cc\u03b4/i.test(String(s || ""));
}
function wantsGreece(s) {
  return /greece|hellas|rhodes|rodos|athens|athina|\u03c1\u03cc\u03b4|\u03b1\u03b8\u03ae\u03bd/i.test(String(s || ""));
}
function kenyaCity(s) {
  return /nairobi|mombasa|kisumu|kenya/i.test(String(s || ""));
}
function inRhodesBbox(p) {
  if (!p || !isFinite(+p.lat) || !isFinite(+p.lng)) return false;
  var t = +p.lat,
    n = +p.lng;
  return t > 35.7 && t < 37.2 && n > 27.3 && n < 28.9;
}
function haversineKm(a, b) {
  var n = (+a.lat * Math.PI) / 180,
    o = (+b.lat * Math.PI) / 180,
    r = ((+b.lat - +a.lat) * Math.PI) / 180,
    i = ((+b.lng - +a.lng) * Math.PI) / 180,
    s = Math.sin(r / 2) * Math.sin(r / 2) + Math.cos(n) * Math.cos(o) * Math.sin(i / 2) * Math.sin(i / 2);
  return 12742 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function parseQuery(q0, city0) {
  var city = String(city0 || "").trim();
  var q = String(q0 || "").trim();
  if (!city && q) {
    var r = q.match(PLACE_HINT);
    if (r) {
      city = r[1].replace(/\s+/g, " ");
      q = q.replace(r[0], " ").replace(/\s+/g, " ").trim();
    } else {
      var parts = q.split(/\s+/).filter(Boolean);
      if (parts.length >= 2) {
        var last = parts[parts.length - 1];
        var head = parts.slice(0, -1).join(" ").toLowerCase();
        if (
          (parts.slice(0, -1).some(function (w) {
            return CUISINE[w.toLowerCase()];
          }) ||
            /pizza|pizzeria|\u03c0\u03b9\u03c4\u03c3|food|coffee|cafe|burger|pharm|hotel|market/i.test(head)) &&
          !CUISINE[last.toLowerCase()] &&
          last.length >= 3
        ) {
          city = last;
          q = parts.slice(0, -1).join(" ");
        }
      }
    }
  }
  if (!q && city0) q = String(q0 || "").trim();
  if (!q) q = String(q0 || "").trim() || "";
  return { q: q, city: city };
}

function isPlaceOnly(q, city) {
  var raw = String(q || "").trim();
  var c = String(city || "").trim();
  if (!raw && c) return true;
  if (!raw) return false;
  var toks = tokens(raw);
  if (!toks.length) return false;
  if (toks.some(function (t) {
    return CUISINE[t];
  }))
    return false;
  if (/pizza|pizzeria|shop|vendor|restaurant|cafe|near|food|hunt|find/i.test(raw) && !PLACE_HINT.test(raw))
    return false;
  // single place token, or "Athens Greece", or city-only after parse
  if (toks.length <= 3 && (PLACE_HINT.test(raw) || PLACE_HINT.test(c) || (!c && toks.length <= 2))) return true;
  if (c && !toks.some(function (t) {
    return CUISINE[t];
  }))
    return true;
  return false;
}

function scorePlace(p, q, preferGreece) {
  var imp = Number(p.importance) || 0;
  var pop = Number(p.population) || 0;
  var popBoost = pop > 0 ? Math.min(0.45, Math.log10(pop + 1) / 10) : 0;
  var raw = String(p.raw || "").toLowerCase();
  var name = String(p.name || "").toLowerCase();
  var typ = String(p.type || "").toLowerCase();
  var cls = String(p.cls || p.class || "").toLowerCase();
  var bonus = 0;
  if (preferGreece && (/greece|hellas|\u03b5\u03bb\u03bb\u03ac\u03c2|\u03b5\u03bb\u03bb\u03b1\u03b4\u03b1/.test(raw) || inRhodesBbox(p)))
    bonus += 0.4;
  if (typ === "city" || typ === "town" || typ === "municipality" || typ === "island") bonus += 0.2;
  if (cls === "place") bonus += 0.1;
  if (typ === "administrative" && !preferGreece) bonus -= 0.05;
  // soft name match after latin fold
  var qn = tokens(q).join(" ");
  var nn = tokens(name + " " + raw).join(" ");
  if (qn && nn.indexOf(qn) >= 0) bonus += 0.08;
  return imp + popBoost + bonus;
}

function fromPhotonFeature(f) {
  if (!f || !f.geometry || !f.properties) return null;
  var c = f.geometry.coordinates || [];
  var p = f.properties || {};
  var lng = Number(c[0]),
    lat = Number(c[1]);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  var name = p.name || p.city || p.town || p.village || "";
  if (!name) return null;
  var bits = [p.street, p.city || p.town, p.state, p.country].filter(Boolean);
  return {
    name: name,
    lat: lat,
    lng: lng,
    raw: bits.join(", ") || name,
    phone: "",
    importance: Number(p.importance) || 0,
    population: Number(p.population) || 0,
    type: p.osm_value || p.type || "",
    cls: p.osm_key || "",
    src: "photon"
  };
}

function fromNominatimRow(e) {
  if (!e) return null;
  var lat = Number(e.lat),
    lng = Number(e.lon);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  var name = e.name || String(e.display_name || "").split(",")[0];
  if (!name) return null;
  return {
    name: name,
    lat: lat,
    lng: lng,
    raw: e.display_name || "",
    phone: (e.extratags && (e.extratags.phone || e.extratags["contact:phone"])) || "",
    importance: Number(e.importance) || 0,
    population: 0,
    type: e.type || e.addresstype || "",
    cls: e.category || e.class || "",
    src: "nominatim"
  };
}

async function photonSearch(q) {
  var url =
    "https://photon.komoot.io/api/?limit=10&q=" + encodeURIComponent(q);
  var t = await grab(url, 3000);
  if (!t) return [];
  try {
    var j = JSON.parse(t);
    return (j.features || []).map(fromPhotonFeature).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function nominatimSearch(q) {
  var url =
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&q=" +
    encodeURIComponent(q);
  var t = await grab(url, 8000);
  if (!t) return [];
  try {
    return (JSON.parse(t) || []).map(fromNominatimRow).filter(Boolean);
  } catch (e) {
    return [];
  }
}

async function geocodeRanked(q, opts) {
  opts = opts || {};
  var preferGreece = !!opts.preferGreece;
  var queries = [];
  var seenQ = {};
  function add(x) {
    x = String(x || "").trim();
    if (!x || seenQ[x.toLowerCase()]) return;
    seenQ[x.toLowerCase()] = 1;
    queries.push(x);
  }
  add(q);
  if (preferGreece && !/greece|hellas/i.test(q)) add(q + " Greece");
  if (kenyaCity(q) && !/kenya/i.test(q)) add(q + " Kenya");
  // Athina alias
  if (/\bathina\b/i.test(q)) add("Athens Greece");
  if (/\brodos\b/i.test(q)) add("Rhodes Greece");

  var all = [];
  var src = "none";
  for (var i = 0; i < queries.length; i++) {
    var ph = await photonSearch(queries[i]);
    if (ph.length) {
      all = all.concat(ph);
      src = "photon";
      break;
    }
  }
  if (!all.length) {
    for (var j = 0; j < queries.length; j++) {
      var nm = await nominatimSearch(queries[j]);
      if (nm.length) {
        all = all.concat(nm);
        src = "nominatim";
        // keep collecting a couple variants for ranking
        if (all.length >= 5) break;
      }
    }
  }
  all.sort(function (a, b) {
    return scorePlace(b, q, preferGreece) - scorePlace(a, q, preferGreece);
  });
  // dedupe by ~110m
  var out = [],
    seen = {};
  for (var k = 0; k < all.length; k++) {
    var p = all[k];
    var key = (+p.lat).toFixed(3) + "|" + (+p.lng).toFixed(3);
    if (seen[key]) continue;
    seen[key] = 1;
    out.push(p);
  }
  return { places: out, src: src };
}

function stripMeta(p) {
  return {
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    raw: p.raw || "",
    phone: p.phone || ""
  };
}

async function overpassNear(lat, lng) {
  var q =
    "[out:json][timeout:12];(nwr(around:6000," +
    lat +
    "," +
    lng +
    ')["name"]["amenity"~"restaurant|fast_food|cafe|pharmacy|bar"];nwr(around:6000,' +
    lat +
    "," +
    lng +
    ')["name"]["shop"~"supermarket|convenience|bakery"];);out center tags 30;';
  var a = await grab("https://overpass.kumi.systems/api/interpreter?data=" + encodeURIComponent(q), 14000);
  try {
    return (JSON.parse(a).elements || [])
      .map(function (e) {
        var c = e.center || e,
          n = e.tags || {};
        return {
          name: n.name,
          lat: Number(c.lat),
          lng: Number(c.lon || c.lng),
          raw: [n["addr:street"], n.amenity || n.shop, n["addr:city"] || ""].filter(Boolean).join(", "),
          phone: n.phone || n["contact:phone"] || "",
          kind: n.amenity || n.shop || "shop"
        };
      })
      .filter(function (e) {
        return e.name && isFinite(e.lat);
      });
  } catch (e) {
    return [];
  }
}

function nameOk(name, raw, q, city, pizza) {
  var i = (String(name || "") + " " + String(raw || "")).toLowerCase();
  var fold = i.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  if (pizza && /pizza|pizzeria|\u03c0\u03b9\u03c4\u03c3/i.test(i)) return true;
  var o = tokens(q);
  var stop = {
    the: 1, and: 1, best: 1, near: 1, find: 1, who: 1, makes: 1, for: 1, want: 1,
    greece: 1, good: 1, around: 1, here: 1, kenya: 1, hellas: 1
  };
  var placeTok = o.filter(function (e) {
    return /rhodes|rodos|\u03c1\u03cc\u03b4|athens|athina|\u03b1\u03b8\u03ae\u03bd|nairobi|kenya/i.test(e);
  });
  var c = o.filter(function (e) {
    return !stop[e] && placeTok.indexOf(e) < 0 && e !== String(city || "").toLowerCase();
  });
  if (!c.length) return true; // place-only query
  return c.some(function (e) {
    return fold.indexOf(e) >= 0 || i.indexOf(e) >= 0;
  });
}

module.exports = async function (req, res) {
  if (req.method === "OPTIONS") {
    cors(res, false);
    return res.status(204).end();
  }
  var n = req.method === "GET" ? req.query || {} : readBody(req);
  var a = parseQuery(String(n.q || n.name || "").slice(0, 80), String(n.city || n.place || "").slice(0, 80));
  var r = a.q,
    i = a.city;
  var o = Number(n.lat),
    s = Number(n.lng);
  var shopNear = /vendor|shop|near|amenity|places/i.test(r) && isFinite(o) && isFinite(s);

  // reverse: an approximate street address for a vendor pin with no listed address
  if (String(n.reverse || "") === "1" && isFinite(o) && isFinite(s)) {
    var rv = await grab("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=" + o.toFixed(6) + "&lon=" + s.toFixed(6), 6000);
    var rj = null;
    try { rj = rv ? JSON.parse(rv) : null; } catch (e) { rj = null; }
    var ad = (rj && rj.address) || {};
    var road = [ad.road || ad.pedestrian || ad.footway || ad.square || ad.street || "", ad.house_number || ""].filter(Boolean).join(" ");
    var line = [road, [ad.postcode, ad.city || ad.town || ad.village || ad.suburb || ""].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    cors(res, !line);
    return res.status(200).json({ ok: !!line, address: line, display: (rj && rj.display_name) || "", approx: true, meta: { mode: "reverse", build: BUILD } });
  }

  if (!r && !(isFinite(o) && isFinite(s))) {
    cors(res, true);
    return res.status(400).json({ ok: false, error: "empty", places: [] });
  }

  // nearby shops by lat/lng only
  if (shopNear || (!r && isFinite(o))) {
    var near = await overpassNear(o, s);
    cors(res, !near.length);
    return res.status(200).json({ ok: true, places: near.slice(0, 16), meta: { mode: "near", build: BUILD } });
  }

  if (!r && i) r = i;

  var placeOnly = isPlaceOnly(r, i) || (!r && !!i);
  var qPlace = (i || r || "").trim();
  var pizza = /pizza|pizzeria|\u03c0\u03b9\u03c4\u03c3/i.test(r + " " + String(n.q || ""));
  var m = mentionsRhodes(r + " " + i + " " + String(n.q || ""));
  var preferGreece = wantsGreece(r + " " + i + " " + String(n.q || ""));

  if (placeOnly && qPlace) {
    var geo = await geocodeRanked(qPlace, { preferGreece: preferGreece || PLACE_HINT.test(qPlace) });
    var places = (geo.places || []).slice(0, 8).map(stripMeta);
    cors(res, !places.length);
    return res.status(200).json({
      ok: true,
      places: places,
      meta: {
        q: r || qPlace,
        city: i || "",
        wantRhodes: !!m,
        mode: "geocode",
        src: geo.src,
        build: BUILD,
        empty: !places.length,
        message: places.length ? "" : "No map pin for " + qPlace + ". Try city and country."
      }
    });
  }

  // shop hunt: geocode city first, then nominatim/overpass-ish via nominatim queries
  var anchor = null;
  if (i) {
    var gc = await geocodeRanked(i, { preferGreece: preferGreece });
    if (gc.places && gc.places[0]) anchor = gc.places[0];
  }
  if (!anchor && isFinite(o) && isFinite(s)) anchor = { lat: o, lng: s, name: i || "here" };

  var f = [];
  if (pizza && i) {
    f.push("pizza " + i);
    f.push("pizzeria " + i);
    if (kenyaCity(i)) f.push("pizza " + i + " Kenya");
  } else if (pizza && m) {
    f.push("pizza Rhodes Greece");
    f.push("pizzeria Rhodes");
  }
  f.push(r);
  if (i && f.indexOf(r + " " + i) < 0) f.push(r + " " + i);
  if (preferGreece && !/greece|hellas/i.test(r)) f.push(r + " Greece");

  var d = [],
    g = {};
  function y(arr) {
    (arr || []).forEach(function (e) {
      if (!e || !isFinite(e.lat)) return;
      if (!nameOk(e.name, e.raw, r, i, pizza)) return;
      if (anchor && haversineKm(anchor, e) > 40) return;
      if (m || !inRhodesBbox(e) || mentionsRhodes(e.name + " " + e.raw)) {
        /* ok */
      } else if (!m && inRhodesBbox(e)) return;
      var t = (+e.lat).toFixed(4) + "|" + (+e.lng).toFixed(4);
      if (g[t]) return;
      g[t] = 1;
      d.push(stripMeta(e));
    });
  }

  for (var h = 0; h < f.length && d.length < 8; h++) {
    var pack = await geocodeRanked(f[h], { preferGreece: preferGreece });
    y(pack.places);
  }

  cors(res, !d.length);
  return res.status(200).json({
    ok: true,
    places: d.slice(0, 8),
    meta: {
      q: r,
      city: i || "",
      wantRhodes: !!m,
      mode: "hunt",
      build: BUILD,
      empty: !d.length,
      message: d.length ? "" : "No real pin for that hunt."
    }
  });
};
