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

// 4368: a mirror that fails (504 / timeout / bad JSON) rests 5 min on this instance; one try per mirror per call
var OV_COOL = {};
var OV_MIRRORS = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
function ovUp(m) { return !(OV_COOL[m] > Date.now()); }
async function ovGrab(m, q, ms) {
  if (!ovUp(m)) return null;
  var t = await grab(m + "?data=" + encodeURIComponent(q), ms);
  var j = null;
  try { j = t ? JSON.parse(t) : null; } catch (e) { j = null; }
  if (!j || !Array.isArray(j.elements)) { OV_COOL[m] = Date.now() + 300000; return null; }
  return j;
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
  /\b(nairobi|mombasa|kisumu|kampala|athens|athina|rhodes|rodos|crete|kriti|heraklion|iraklio|irakleio|chania|hania|rethymno|rethymnon|sitia|thessaloniki|\u03c1\u03cc\u03b4\u03bf\u03c2|\u03b1\u03b8\u03ae\u03bd\u03b1|\u03ba\u03c1\u03ae\u03c4|\u03b7\u03c1\u03ac\u03ba\u03bb|london|paris|berlin|rome|kenya|greece|hellas|dar\s*es\s*salaam|addis\s*ababa|lagos|cairo|sydney|tokyo|singapore)\b/i;

function mentionsRhodes(s) {
  return /rhodes|rodos|\u03c1\u03cc\u03b4/i.test(String(s || ""));
}
function wantsGreece(s) {
  /* 4411: Crete / Heraklion / Chania must prefer Greece (bare "Crete" otherwise ranks Nebraska) */
  return /greece|hellas|rhodes|rodos|athens|athina|crete|kriti|heraklion|iraklio|irakleio|chania|hania|rethymno|rethymnon|sitia|thessaloniki|\u03c1\u03cc\u03b4|\u03b1\u03b8\u03ae\u03bd|\u03ba\u03c1\u03ae\u03c4|\u03b7\u03c1\u03ac\u03ba\u03bb/i.test(String(s || ""));
}
function inCreteBbox(p) {
  if (!p || !isFinite(+p.lat) || !isFinite(+p.lng)) return false;
  var t = +p.lat, n = +p.lng;
  return t > 34.7 && t < 35.85 && n > 23.3 && n < 26.5;
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
      /* 4377: "plumber in Athens" leaves "plumber", not "plumber in"; "find a plumber" leaves "plumber" */
      q = q.replace(/\s+(in|at|of|around|near|by)$/i, "").replace(/^(find|show|get|hunt)(\s+me)?\s+/i, "").replace(/^(an?|the|some)\s+/i, "").trim();
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

/* 4377: a trade or service word ("plumber", "electrician") is a thing to hunt, never a place to geocode */
var TRADE_RE = /\b(plumb|electric|locksmith|mechanic|garage|dentist|doctor|clinic|hospital|vet|lawyer|notary|bank|atm|bakery|baker|butcher|barber|hair|florist|tailor|laundry|gym|taxi|carpenter|painter|roofer|glazier|kiosk|periptero|bar|pub|gas|fuel|petrol|parking|school|church|museum|post office|courier|repair|cleaner|builder|handyman|optician|bookshop|pet)\w{0,5}\b/i;
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
  if (TRADE_RE.test(raw)) return false;
  if (/pizza|pizzeria|shops?|vendor|restaurant|cafe|near|food|hunt|find|supermarket|grocery|groceries|markets?|stores?|pharmacy|pharmacies/i.test(raw) && !PLACE_HINT.test(raw))
    return false; /* 4411: supermarket/shops are trades, never place-only geocodes */
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
  if (preferGreece && (/greece|hellas|\u03b5\u03bb\u03bb\u03ac\u03c2|\u03b5\u03bb\u03bb\u03b1\u03b4\u03b1/.test(raw) || inRhodesBbox(p) || inCreteBbox(p)))
    bonus += 0.45;
  if (preferGreece && inCreteBbox(p) && /crete|kriti|\u03ba\u03c1\u03ae\u03c4/i.test(name + " " + raw + " " + q)) bonus += 0.25;
  if (typ === "city" || typ === "town" || typ === "municipality" || typ === "island" || typ === "other") {
    if (typ === "island" || (preferGreece && inCreteBbox(p) && typ === "other")) bonus += 0.25;
    else if (typ !== "other") bonus += 0.2;
  }
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
  if (/^(shop|amenity|healthcare|craft|office)$/.test(String(p.osm_key || "")) && genericName(name, p.osm_value)) return null; /* 4387 */
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

// 4387: a shop / amenity pin carries its real name, else its brand or operator tag; a pin with none of those (or only a
// generic word such as "Supermarket" or "?") is dropped. Places (towns, streets) keep their display name. Nothing is invented.
var GENERIC_NAME = /^(super\s*-?\s*market|supermarket|mini\s*-?\s*market|minimarket|grocery|groceries|convenience|shop|store|pharmacy|chemist|bakery|kiosk|cafe|café|restaurant|pizzeria|pizza|plumber|market|σούπερ\s*μάρκετ|σουπερ\s*μαρκετ|σουπερμάρκετ|σουπερμαρκετ|μίνι\s*μάρκετ|φαρμακείο|φαρμακειο|περίπτερο|περιπτερο|καφενείο|αρτοποιείο|φούρνος|\?+|·+|-+)$/i;
var CATEGORY_TEXT = /^\s*(?:meat|and|&|\+|other|others|food|foods|goods|products|fish|fruit|fruits|vegetables|veg|grocery|groceries|drinks|beverages|store|stores|shop|shops|market|markets|supermarket|super|mini|local|various|general|deli|butcher|bakery|items|daily|fresh|household)(?:[\s,\/-]+(?:meat|and|&|\+|other|others|food|foods|goods|products|fish|fruit|fruits|vegetables|veg|grocery|groceries|drinks|beverages|store|stores|shop|shops|market|markets|supermarket|super|mini|local|various|general|deli|butcher|bakery|items|daily|fresh|household))*\s*$/i;
function genericName(n, type) {
  var t = String(n || "").trim();
  if (!t) return true;
  if (GENERIC_NAME.test(t)) return true;
  if (CATEGORY_TEXT.test(t)) return true; /* 4389: category text such as "Meat and other food" or "Mini Shop" is not a name */
  if (type && t.toLowerCase().replace(/[\s_-]+/g, "") === String(type).toLowerCase().replace(/[\s_-]+/g, "")) return true;
  return false;
}
function realShopName(e) {
  var x = e.extratags || {};
  var cands = [e.name, x.brand, x["brand:en"], x.operator];
  for (var i = 0; i < cands.length; i++) if (cands[i] && !genericName(cands[i], e.type)) return String(cands[i]).trim();
  return "";
}
function photoFromTags(x) {
  /* 4412: only a real OSM image / Wikimedia tag; never invent a photo URL */
  if (!x || typeof x !== "object") return "";
  var img = x.image || x["image:0"] || x["contact:image"] || "";
  if (img && /^https?:\/\//i.test(String(img))) return String(img).trim();
  var wc = x.wikimedia_commons || "";
  if (wc && /^File:/i.test(String(wc))) {
    return "https://commons.wikimedia.org/wiki/Special:FilePath/" + encodeURIComponent(String(wc).replace(/^File:/i, "").trim()) + "?width=480";
  }
  return "";
}
function addrFromNominatim(e) {
  var ad = (e && e.address) || {};
  var xt = (e && e.extratags) || {};
  var road = [ad.road || ad.pedestrian || ad.footway || ad.square || xt["addr:street"] || "", ad.house_number || xt["addr:housenumber"] || ""].filter(Boolean).join(" ");
  var city = ad.city || ad.town || ad.village || ad.suburb || xt["addr:city"] || "";
  var pc = ad.postcode || xt["addr:postcode"] || "";
  var line = [road, [pc, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  if (line) return { address: line, street: road, city: city, postcode: pc, approx: false };
  return { address: "", street: "", city: "", postcode: "", approx: true };
}
function fromNominatimRow(e) {
  if (!e) return null;
  var lat = Number(e.lat),
    lng = Number(e.lon);
  if (!isFinite(lat) || !isFinite(lng)) return null;
  var shopLike = /^(shop|amenity|healthcare|craft|office|tourism|leisure)$/.test(String(e.category || e["class"] || ""));
  var name = shopLike ? realShopName(e) : (e.name || String(e.display_name || "").split(",")[0]);
  if (!name) return null;
  var xt = e.extratags || {};
  var ad = addrFromNominatim(e);
  return {
    name: name,
    lat: lat,
    lng: lng,
    raw: e.display_name || "",
    phone: xt.phone || xt["contact:phone"] || xt["phone:mobile"] || "",
    website: xt.website || xt["contact:website"] || xt["contact:facebook"] || "",
    photo: photoFromTags(xt),
    address: ad.address,
    street: ad.street,
    city: ad.city,
    postcode: ad.postcode,
    approx: ad.approx,
    importance: Number(e.importance) || 0,
    population: 0,
    type: e.type || e.addresstype || "",
    cls: e.category || e.class || "",
    osm: e.osm_type && e.osm_id ? String(e.osm_type) + "/" + String(e.osm_id) : "",
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
    "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&addressdetails=1&extratags=1&q=" +
    encodeURIComponent(q);
  var t = await grab(url, 8000);
  if (!t) return [];
  try {
    return (JSON.parse(t) || []).map(fromNominatimRow).filter(Boolean);
  } catch (e) {
    return [];
  }
}

// 4374: real-result memory on this instance (never invented): the last real Overpass answer per query and the last real
// hunt answer per query + ~1 km anchor are kept 24 h and served, marked cached, only when the live sources return nothing
var REAL_MEM = {};
function memPut(k, v) { if (v && v.length) REAL_MEM[k] = { t: Date.now(), v: v }; }
function memGet(k) { var e = REAL_MEM[k]; return e && Date.now() - e.t < 86400000 ? e.v : null; }
// 4374: the browser never calls Nominatim itself; it asks here (op=nominatim) with the same parameters
async function nominatimRaw(params) {
  var qs = ["format=json", "addressdetails=1", "extratags=1", "limit=" + Math.min(40, Math.max(1, Number(params.limit) || 20)), "q=" + encodeURIComponent(String(params.q || "").slice(0, 120))];
  if (/^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/.test(String(params.viewbox || ""))) qs.push("viewbox=" + params.viewbox);
  if (String(params.bounded || "") === "1") qs.push("bounded=1");
  if (/^\d+(,\d+)*$/.test(String(params.exclude || ""))) qs.push("exclude_place_ids=" + params.exclude);
  var k = "nom|" + qs.join("&");
  var t = await grab("https://nominatim.openstreetmap.org/search?" + qs.join("&"), 5000);
  var rows = null;
  try { rows = t ? JSON.parse(t) : null; } catch (e) { rows = null; }
  if (Array.isArray(rows) && rows.length) { memPut(k, rows); return { rows: rows, cached: false }; }
  var c = memGet(k);
  return { rows: c || (Array.isArray(rows) ? rows : []), cached: !!c };
}
async function nominatimNear(q, anchor, deg) {
  /* 4412: wider box + page exclude_place_ids so a Crete / Heraklion hunt is not stuck at 8–12 rows */
  var d = deg || 0.18;
  var vb = [(anchor.lng - d).toFixed(4), (anchor.lat + d).toFixed(4), (anchor.lng + d).toFixed(4), (anchor.lat - d).toFixed(4)].join(",");
  var want = 40, out = [], exclude = "", pages = 0;
  while (out.length < want && pages < 3) {
    var r = await nominatimRaw({ q: q, viewbox: vb, bounded: "1", limit: 20, exclude: exclude });
    var rows = r.rows || [];
    if (!rows.length) break;
    rows.forEach(function (row) {
      var p = fromNominatimRow(row);
      if (p) out.push(p);
    });
    var ids = rows.map(function (row) { return row.place_id; }).filter(Boolean);
    if (!ids.length) break;
    exclude = (exclude ? exclude + "," : "") + ids.join(",");
    pages++;
    if (rows.length < 8) break;
  }
  return out;
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
  if (/\bcrete\b|\bkriti\b/i.test(q)) { add("Crete Greece"); add("\u039a\u03c1\u03ae\u03c4\u03b7"); }
  if (/\bheraklion\b|\birakli/i.test(q)) { add("Heraklion Crete Greece"); add("\u0397\u03c1\u03ac\u03ba\u03bb\u03b5\u03b9\u03bf"); }

  var all = [];
  var src = "none";
  /* 4411: with preferGreece collect every variant (bare "Crete" is Nebraska; "Crete Greece" is Κρήτη) then rank */
  for (var i = 0; i < queries.length; i++) {
    var ph = await photonSearch(queries[i]);
    if (ph.length) {
      all = all.concat(ph);
      src = "photon";
      if (!preferGreece) break;
    }
  }
  if (!all.length || (preferGreece && all.length < 3)) {
    for (var j = 0; j < queries.length; j++) {
      var nm = await nominatimSearch(queries[j]);
      if (nm.length) {
        all = all.concat(nm);
        if (src === "none") src = "nominatim";
        if (!preferGreece && all.length >= 5) break;
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
  // 4376: a city/town node beats the island / admin area of the same name ("Rhodes" = Rhodes town, not mid-island)
  var AREA = /^(island|islet|archipelago|administrative|state|region|province|county|municipality|state_district|boundary)$/i;
  var TOWN = /^(city|town|village|suburb|neighbourhood|quarter|borough|hamlet)$/i;
  if (out.length > 1 && AREA.test(String(out[0].type || ""))) {
    for (var t = 1; t < out.length; t++) {
      if (TOWN.test(String(out[t].type || "")) && haversineKm(out[0], out[t]) < 80) {
        var town = out.splice(t, 1)[0];
        out.unshift(town);
        break;
      }
    }
  }
  return { places: out, src: src };
}

function stripMeta(p) {
  return {
    name: p.name,
    lat: p.lat,
    lng: p.lng,
    raw: p.raw || "",
    phone: p.phone || "",
    website: p.website || "",
    photo: p.photo || "",
    address: p.address || "",
    street: p.street || "",
    city: p.city || "",
    postcode: p.postcode || "",
    approx: !!p.approx,
    kind: p.kind || "",
    osm: p.osm || "",
    src: p.src || ""
  };
}

async function overpassNear(lat, lng, aroundM) {
  /* 4412: wider shop tags + radius; keep phone/website/addr and image tags (never invent) */
  var m = Math.max(4000, Math.min(120000, Number(aroundM) || 12000));
  var q =
    "[out:json][timeout:18];(nwr(around:" + m + "," +
    lat + "," + lng +
    ')["name"]["amenity"~"restaurant|fast_food|cafe|pharmacy|bar|fuel"];nwr(around:' + m + "," +
    lat + "," + lng +
    ')["name"]["shop"~"supermarket|convenience|bakery|greengrocer|butcher|clothes|mall|department_store|electronics|hardware|books|florist|laundry|alcohol|shoes|furniture|car|kiosk|yes"];);out center tags 50;';
  var aj = await ovGrab(OV_MIRRORS[1], q, 16000);
  if (!aj || !Array.isArray(aj.elements) || !aj.elements.length) aj = await ovGrab(OV_MIRRORS[0], q, 16000);
  try {
    return ((aj && aj.elements) || [])
      .map(function (e) {
        var c = e.center || e,
          n = e.tags || {};
        var road = [n["addr:street"] || "", n["addr:housenumber"] || ""].filter(Boolean).join(" ");
        var city = n["addr:city"] || n["addr:town"] || "";
        var pc = n["addr:postcode"] || "";
        var addr = [road, [pc, city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        var ot = e.type === "node" ? "node" : (e.type === "way" ? "way" : (e.type === "relation" ? "relation" : ""));
        return {
          name: n.name || n.brand || n.operator || "",
          lat: Number(c.lat),
          lng: Number(c.lon || c.lng),
          raw: [road, n.amenity || n.shop, city].filter(Boolean).join(", "),
          phone: n.phone || n["contact:phone"] || "",
          website: n.website || n["contact:website"] || "",
          photo: photoFromTags(n),
          address: addr,
          street: road,
          city: city,
          postcode: pc,
          approx: !addr,
          kind: n.amenity || n.shop || "shop",
          osm: ot && e.id ? ot + "/" + e.id : "",
          src: "overpass"
        };
      })
      .filter(function (e) {
        return e.name && isFinite(e.lat) && !genericName(e.name, e.kind);
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
    greece: 1, good: 1, around: 1, here: 1, kenya: 1, hellas: 1,
    /* 4411: bare category tokens must not require the word in the pin name */
    shop: 1, shops: 1, store: 1, stores: 1, market: 1, markets: 1, supermarket: 1, supermarkets: 1,
    grocery: 1, groceries: 1, cafe: 1, coffee: 1, restaurant: 1, food: 1, bakery: 1, bakeries: 1,
    pharmacy: 1, pharmacies: 1, vendor: 1, vendors: 1, amenity: 1, places: 1, place: 1
  };
  var placeTok = o.filter(function (e) {
    return /rhodes|rodos|\u03c1\u03cc\u03b4|athens|athina|\u03b1\u03b8\u03ae\u03bd|crete|kriti|heraklion|iraklio|nairobi|kenya/i.test(e);
  });
  var c = o.filter(function (e) {
    return !stop[e] && placeTok.indexOf(e) < 0 && e !== String(city || "").toLowerCase();
  });
  if (!c.length) return true; // place-only or bare-category query
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
  // 4350: Overpass for the browser through this function (same origin, so a refusal or a rate limit is never a CORS error in the
  // page); only [out:json][timeout:N] queries up to 700 chars; overpass-api.de first, overpass.kumi.systems second; always 200
  if (String(n.op || "") === "nominatim") {
    cors(res, true);
    var nr = await nominatimRaw(n);
    // 4389: with Overpass down the hunt rests on this answer, and Nominatim gives at most 20 rows, many of them unnamed or
    // generic ("Supermarket") that the client drops, so the count swung 13 -> 5 with the order Nominatim answered in. A bounded
    // trade search pages on (exclude_place_ids, up to 2 more pages) until it holds the asked number of really named rows.
    if (String(n.bounded || "") === "1" && (Number(n.limit) || 0) > 1 && Array.isArray(nr.rows)) {
      var allR = nr.rows.slice(), seenP = {};
      allR.forEach(function (x) { if (x && x.place_id) seenP[x.place_id] = 1; });
      var named = function () { return allR.filter(function (x) { return x && (!/^(shop|amenity|healthcare|craft|office|tourism|leisure)$/.test(String(x.category || x["class"] || "")) || realShopName(x)); }).length; };
      for (var pg = 0; pg < 2 && nr.rows.length >= Math.min(20, Number(n.limit)) && named() < Math.min(40, Number(n.limit) || 16); pg++) {
        var ex = Object.keys(seenP).slice(0, 200).join(",");
        var more = await nominatimRaw(Object.assign({}, n, { limit: 20, exclude: ex }));
        var fresh = (more.rows || []).filter(function (x) { return x && x.place_id && !seenP[x.place_id]; });
        if (!fresh.length) break;
        fresh.forEach(function (x) { seenP[x.place_id] = 1; allR.push(x); });
        nr = { rows: allR, cached: nr.cached && more.cached };
      }
      nr.rows = allR.filter(function (x) { return !(x && /^(shop|amenity|healthcare|craft|office|tourism|leisure)$/.test(String(x.category || x["class"] || "")) && !realShopName(x)); });
    }
    try { res.setHeader("X-Astranov-Cached", nr.cached ? "1" : "0"); } catch (eH) {}
    return res.status(200).json(nr.rows || []);
  }
  if (String(n.op || "") === "overpass") {
    cors(res, true);
    var od = String(n.data || "");
    if (!/^\[out:json\]\[timeout:\d{1,2}\];/.test(od) || od.length > 700) return res.status(200).json({ ok: false, error: "bad query", elements: [], meta: { mode: "overpass", build: BUILD } });
    // 4368: exactly one mirror per call (the client picks it: mirror=0 overpass-api.de, 1 kumi); a resting mirror falls to the other
    var mi = Number(n.mirror) === 1 ? 1 : 0;
    if (!ovUp(OV_MIRRORS[mi]) && ovUp(OV_MIRRORS[1 - mi])) mi = 1 - mi;
    var osrc = mi ? "overpass.kumi.systems" : "overpass-api.de";
    var oj = await ovGrab(OV_MIRRORS[mi], od, 3500);
    // 4371: the mirror really used is in the response (meta.mirror 0/1, meta.asked, meta.src) and the X-Astranov-Mirror header,
    // because the Overpass call runs here, server-side, and never shows in the browser's network panel
    var asked = Number(n.mirror) === 1 ? 1 : 0;
    try { res.setHeader("X-Astranov-Mirror", mi + " " + osrc); } catch (eH) {}
    if (!oj || !Array.isArray(oj.elements)) {
      var oc = memGet("ov|" + od);
      if (oc) return res.status(200).json({ ok: true, cached: true, elements: oc, meta: { mode: "overpass", mirror: mi, asked: asked, src: osrc, cached: true, build: BUILD } });
      return res.status(200).json({ ok: false, error: "overpass unavailable", elements: [], meta: { mode: "overpass", mirror: mi, asked: asked, src: osrc, build: BUILD } });
    }
    memPut("ov|" + od, oj.elements.slice(0, 40));
    return res.status(200).json({ ok: true, elements: oj.elements.slice(0, 40), meta: { mode: "overpass", mirror: mi, asked: asked, src: osrc, build: BUILD } });
  }
  var a = parseQuery(String(n.q || n.name || "").slice(0, 80), String(n.city || n.place || "").slice(0, 80));
  var r = a.q,
    i = a.city;
  var o = Number(n.lat),
    s = Number(n.lng);
  var shopNear = /vendor|shop|near|amenity|places/i.test(r) && isFinite(o) && isFinite(s);

  // reverse: an approximate street address for a vendor pin with no listed address
  // 4412: OSM lookup by osm id — real phone/website/addr:*/image only (no fakes)
  if (String(n.op || "") === "lookup" && String(n.osm || "")) {
    var osmRaw = String(n.osm || "").trim();
    var om = osmRaw.match(/^(node|way|relation)[\/]?(\d+)$/i) || osmRaw.match(/^([nwr])(\d+)$/i);
    cors(res, true);
    if (!om) return res.status(200).json({ ok: false, error: "bad osm", place: null, meta: { mode: "lookup", build: BUILD } });
    var kind = String(om[1]).toLowerCase();
    var letter = kind.charAt(0);
    if (kind === "node" || kind === "n") letter = "N";
    else if (kind === "way" || kind === "w") letter = "W";
    else if (kind === "relation" || kind === "r") letter = "R";
    else letter = letter.toUpperCase();
    var oid = letter + om[2];
    var lt = await grab("https://nominatim.openstreetmap.org/lookup?format=json&addressdetails=1&extratags=1&osm_ids=" + encodeURIComponent(oid), 7000);
    var lj = null;
    try { lj = lt ? JSON.parse(lt) : null; } catch (eL) { lj = null; }
    var row = Array.isArray(lj) && lj[0] ? fromNominatimRow(lj[0]) : null;
    return res.status(200).json({ ok: !!row, place: row ? stripMeta(row) : null, meta: { mode: "lookup", build: BUILD } });
  }

  if (String(n.reverse || "") === "1" && isFinite(o) && isFinite(s)) {
    var rv = await grab("https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=" + o.toFixed(6) + "&lon=" + s.toFixed(6), 6000);
    var rj = null;
    try { rj = rv ? JSON.parse(rv) : null; } catch (e) { rj = null; }
    var ad = (rj && rj.address) || {};
    var road = [ad.road || ad.pedestrian || ad.footway || ad.square || ad.street || "", ad.house_number || ""].filter(Boolean).join(" ");
    var line = [road, [ad.postcode, ad.city || ad.town || ad.village || ad.suburb || ""].filter(Boolean).join(" ")].filter(Boolean).join(", ");
    /* 4379: Nominatim refuses the server at times (empty reverse); Photon's reverse names the street or area instead */
    if (!line) {
      try {
        var pv = await grab("https://photon.komoot.io/reverse?limit=1&lat=" + o.toFixed(6) + "&lon=" + s.toFixed(6), 5000);
        var pp = pv ? (((JSON.parse(pv).features || [])[0] || {}).properties || {}) : {};
        var pRoad = [pp.street || "", pp.housenumber || ""].filter(Boolean).join(" ");
        line = [pRoad || pp.name || pp.district || "", [pp.postcode, pp.city || pp.district || ""].filter(Boolean).join(" ")].filter(Boolean).join(", ");
        if (line && rj == null) rj = { display_name: [pp.name, pp.city, pp.country].filter(Boolean).join(", ") };
      } catch (eP) {}
    }
    cors(res, !line);
    return res.status(200).json({ ok: !!line, address: line, display: (rj && rj.display_name) || "", approx: true, meta: { mode: "reverse", build: BUILD } });
  }

  if (!r && !(isFinite(o) && isFinite(s))) {
    cors(res, true);
    return res.status(400).json({ ok: false, error: "empty", places: [] });
  }

  // 4412: always merge Overpass shopNear with Nominatim (never early-return a thin Overpass-only set).
  var seedNear = [];
  if (shopNear || (!r && isFinite(o))) {
    var aroundM0 = isFinite(Number(n.radius)) && Number(n.radius) > 40 ? Math.min(120000, Number(n.radius) * 1000) : 12000;
    seedNear = await overpassNear(o, s, aroundM0);
    if (!r) r = "shops";
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
    g = {},
    srcSeen = [];
  /* 4375: "X near Y" keeps 5 km around Y (10 km while fewer than 3), ranked by distance */
  // 4376: the client's near=1 and radius are honoured (the q-less "pizza" hunt carries them as params)
  var nearMode = String(n.near || "") === "1" || /\b(near|around|by|at)\b/i.test(String(n.q || ""));
  var radQ = Number(n.radius);
  var creteSpan = /crete|kriti|\u03ba\u03c1\u03ae\u03c4|sitia|siteia|\u03c3\u03b7\u03c4\u03b5\u03af/i.test(String(r + " " + i + " " + (n.q || "")));
  /* 4412: Crete-wide / Sitia hunts need island span (~150 km); Heraklion local stays ≤40 unless asked */
  var capKm = nearMode ? 10 : (creteSpan ? Math.min(160, isFinite(radQ) && radQ > 0 ? Math.max(radQ, 120) : 150) : (isFinite(radQ) && radQ > 0 ? Math.min(80, radQ) : 40));
  function y(arr, srcTag) {
    (arr || []).forEach(function (e) {
      if (!e || !isFinite(e.lat)) return;
      if (srcTag && !e.src) e.src = srcTag;
      if (!nameOk(e.name, e.raw, r, i, pizza)) return;
      /* 4377: a hunt answers shops and services only: a road, trail, boundary or town that merely carries the word is dropped ("Joe the Plumber II" is an OSM cycleway in Acharnes) */
      if (/^(highway|boundary|place|landuse|natural|waterway|railway|route|bridge|mountain_pass)$/i.test(String(e.cls || "")) || /^(city|town|village|hamlet|suburb|administrative|county|state|country|road|cycleway|path|track|footway|residential)$/i.test(String(e.type || ""))) return;
      if (anchor && haversineKm(anchor, e) > Math.max(40, capKm)) return;
      if (m || !inRhodesBbox(e) || mentionsRhodes(e.name + " " + e.raw)) {
        /* ok */
      } else if (!m && inRhodesBbox(e)) return;
      var t = (+e.lat).toFixed(4) + "|" + (+e.lng).toFixed(4);
      if (g[t]) return;
      g[t] = 1;
      if (anchor && haversineKm(anchor, e) > capKm) return;
      if (srcTag && srcSeen.indexOf(srcTag) < 0) srcSeen.push(srcTag);
      d.push(stripMeta(e));
    });
  }

  // 4412: merge Overpass seed with paged Nominatim; widen category expansion; HUNT_CAP 40 (was hard 8)
  var HUNT_CAP = 40;
  if (seedNear && seedNear.length) y(seedNear, "overpass");
  if (anchor && isFinite(+anchor.lat) && r) {
    var terms = [r];
    if (pizza && !/pizzeria/i.test(r)) terms.push("pizzeria");
    if (/^(shops?|stores?|markets?|vendors?|places?|amenity)$/i.test(String(r).trim())) {
      terms = ["supermarket", "convenience", "bakery", "cafe", "greengrocer", "butcher", "pharmacy", "clothes", "mall", "electronics", "hardware", "books", "florist", "laundry", "alcohol", "shoes", "kiosk", "\u03c3\u03bf\u03c5\u03c0\u03b5\u03c1\u03bc\u03ac\u03c1\u03ba\u03b5\u03c4"];
    } else if (/^supermarkets?$/i.test(String(r).trim())) {
      terms = ["supermarket", "convenience", "mall", "\u03c3\u03bf\u03c5\u03c0\u03b5\u03c1\u03bc\u03ac\u03c1\u03ba\u03b5\u03c4", "Mini Market"];
    }
    var degBox = nearMode ? 0.1 : (creteSpan ? 1.1 : 0.22);
    for (var bt = 0; bt < terms.length && d.length < HUNT_CAP; bt++) y(await nominatimNear(terms[bt], anchor, degBox), "nominatim");
  }
  for (var h = 0; h < f.length && d.length < Math.min(12, HUNT_CAP); h++) {
    var pack = await geocodeRanked(f[h], { preferGreece: preferGreece });
    y(pack.places, pack.src || "nominatim");
  }
  var memK = anchor ? "hunt|" + String(r).toLowerCase() + "|" + (+anchor.lat).toFixed(2) + "," + (+anchor.lng).toFixed(2) + (nearMode ? "|near" : "") : "";
  var fromMem = false;
  if (memK) {
    if (d.length) memPut(memK, d.slice(0, HUNT_CAP));
    else { var hm = memGet(memK); if (hm) { d = hm.slice(); fromMem = true; } }
  }
  var usedKm = capKm;
  if (anchor) {
    d.forEach(function (e) { e.km = Math.round(haversineKm(anchor, e) * 100) / 100; });
    d.sort(function (a, b) { return (a.km - b.km) || (String(a.osm || a.name) < String(b.osm || b.name) ? -1 : 1); });
    if (nearMode) {
      var in5 = d.filter(function (e) { return e.km <= 5; });
      usedKm = in5.length >= 3 ? 5 : 10;
      if (in5.length >= 3) d = in5;
    }
  }

  cors(res, !d.length);
  return res.status(200).json({
    ok: true,
    places: d.slice(0, HUNT_CAP || 40),
    meta: {
      q: r,
      city: i || (anchor && anchor.name && anchor.name !== "here" ? anchor.name : ""),
      anchor: anchor ? { lat: +(+anchor.lat).toFixed(5), lng: +(+anchor.lng).toFixed(5) } : null,
      wantRhodes: !!m,
      mode: "hunt",
      src: fromMem ? "cache" : (srcSeen.join("+") || "none"),
      mirror: fromMem ? "instance-cache" : (srcSeen.indexOf("photon") >= 0 && srcSeen.length === 1 ? "photon.komoot.io" : (srcSeen.length ? "nominatim.openstreetmap.org" : "")),
      cached: fromMem,
      near: nearMode,
      radiusKm: anchor ? usedKm : null,
      build: BUILD,
      empty: !d.length,
      message: d.length ? "" : "No real pin for that hunt."
    }
  });
};
