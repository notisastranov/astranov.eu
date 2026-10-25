/** SpaceNet place crawler — shop site + public web. Not Google. */
const UA = "AstranovSpaceNet/1 (+https://astranov.eu)";

function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type");
  res.setHeader("Cache-Control", "no-store");
}

function readBody(req) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch (_) {
      return {};
    }
  }
  return {};
}

function okUrl(u) {
  try {
    var x = new URL(String(u));
    if (x.protocol !== "http:" && x.protocol !== "https:") return "";
    var h = x.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || h === "127.0.0.1" || h.startsWith("10.") || h.startsWith("192.168.") || h.startsWith("172.")) return "";
    return x.toString();
  } catch (_) {
    return "";
  }
}

async function grab(url, ms) {
  var ctl = new AbortController();
  var t = setTimeout(function () {
    ctl.abort();
  }, ms || 8000);
  try {
    var r = await fetch(url, {
      headers: { "User-Agent": UA, Accept: "text/html,application/json;q=0.9,*/*;q=0.8" },
      signal: ctl.signal,
      redirect: "follow",
    });
    var txt = await r.text();
    return txt.slice(0, 400000);
  } catch (_) {
    return "";
  } finally {
    clearTimeout(t);
  }
}

function phones(s) {
  var out = [],
    seen = {};
  String(s || "").replace(/(?:\+?30[\s.\-/]?)?(?:2\d{9}|69\d{8}|\d{10})/g, function (m) {
    var d = m.replace(/[^\d+]/g, "");
    if (d.indexOf("+") !== 0 && d.length === 10) d = "+30" + d;
    if (d.indexOf("30") === 0 && d[0] !== "+") d = "+" + d;
    if (!seen[d] && d.length >= 12) {
      seen[d] = 1;
      out.push(d);
    }
    return m;
  });
  return out;
}

function mails(s) {
  var out = [],
    seen = {};
  String(s || "").replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, function (m) {
    var e = m.toLowerCase();
    if (/example|sentry|wixpress|cloudflare|schema/.test(e)) return m;
    if (!seen[e]) {
      seen[e] = 1;
      out.push(e);
    }
    return m;
  });
  return out;
}

function hrefs(html, re) {
  var out = [];
  String(html || "").replace(/href=["']([^"']+)["']/gi, function (_, u) {
    if (re.test(u)) out.push(u);
    return _;
  });
  return out;
}

function decode(s) {
  return String(s || "")
    .replace(/&/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, function (_, n) {
      return String.fromCharCode(Number(n));
    })
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function jsonld(html) {
  var blocks = [];
  String(html || "").replace(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi, function (_, j) {
    try {
      blocks.push(JSON.parse(j));
    } catch (e) {}
    return _;
  });
  return blocks;
}

function walkLd(node, acc) {
  if (!node) return acc;
  if (Array.isArray(node)) {
    node.forEach(function (n) {
      walkLd(n, acc);
    });
    return acc;
  }
  if (typeof node !== "object") return acc;
  var t = String(node["@type"] || "");
  if (/Restaurant|FoodEstablishment|LocalBusiness|Store|CafeOrCoffeeShop|FastFoodRestaurant/i.test(t)) {
    if (node.telephone) acc.phone = acc.phone || String(node.telephone);
    if (node.email) acc.email = acc.email || String(node.email);
    if (node.url) acc.web = acc.web || String(node.url);
    if (node.menu) acc.menuUrl = acc.menuUrl || String(node.menu);
    if (node.hasMenu) acc.menuUrl = acc.menuUrl || String(node.hasMenu.url || node.hasMenu);
  }
  Object.keys(node).forEach(function (k) {
    if (k !== "@context") walkLd(node[k], acc);
  });
  return acc;
}

function menuLines(text) {
  var items = [];
  String(text || "")
    .split(/\n+/)
    .forEach(function (line) {
      var m = decode(line).match(/^(.{2,48}?)\s*[—\-–:]\s*€?\s*(\d+[.,]\d{0,2})\s*€?$/);
      if (!m) m = decode(line).match(/^(.{2,48}?)\s+€\s*(\d+[.,]\d{0,2})\s*$/);
      if (!m) return;
      var name = m[1].replace(/\s+/g, " ").trim();
      var price = Number(String(m[2]).replace(",", "."));
      if (name.length < 2 || price < 1 || price > 80) return;
      if (/cookie|privacy|copyright|latitude|longitude/i.test(name)) return;
      items.push({ name: name, price: price, sample: false });
    });
  var seen = {};
  return items
    .filter(function (it) {
      var k = it.name.toLowerCase();
      if (seen[k]) return false;
      seen[k] = 1;
      return true;
    })
    .slice(0, 8);
}

async function fromSite(url) {
  url = okUrl(url);
  if (!url) return {};
  var html = await grab(url, 8000);
  if (!html) return {};
  var acc = walkLd(jsonld(html), {});
  var tel = hrefs(html, /^tel:/i).map(function (u) {
    return decodeURIComponent(u.replace(/^tel:/i, ""));
  });
  var em = hrefs(html, /^mailto:/i).map(function (u) {
    return u.replace(/^mailto:/i, "").split("?")[0];
  });
  var ph = phones(acc.phone || "")
    .concat(tel)
    .concat(phones(html));
  var emails = mails(acc.email || "")
    .concat(em)
    .concat(mails(html));
  var items = menuLines(decode(html.replace(/<\/(li|p|div|h\d|tr)>/gi, "\n")));
  if ((!items || !items.length) && acc.menuUrl) {
    var mu = okUrl(acc.menuUrl);
    if (mu && mu !== url) {
      var mh = await grab(mu, 7000);
      items = menuLines(decode(mh.replace(/<\/(li|p|div|h\d|tr)>/gi, "\n")));
    }
  }
  return {
    phone: ph[0] || "",
    email: emails[0] || "",
    web: acc.web || url,
    items: items || [],
    via: "site",
  };
}

async function fromDdg(name, place) {
  var q = [name, place, "τηλέφωνο", "phone"].filter(Boolean).join(" ");
  var html = await grab("https://html.duckduckgo.com/html/?q=" + encodeURIComponent(q), 7000);
  if (!html) return {};
  var ph = phones(html);
  var em = mails(html);
  var sites = [];
  String(html).replace(/uddg=([^&"]+)/g, function (_, u) {
    try {
      var d = decodeURIComponent(u);
      if (/facebook|instagram|wikipedia|tripadvisor|yelp/.test(d)) return _;
      if (okUrl(d)) sites.push(d);
    } catch (e) {}
    return _;
  });
  return { phone: ph[0] || "", email: em[0] || "", web: sites[0] || "", via: "web" };
}

async function fromOsm(name, lat, lng) {
  lat = Number(lat);
  lng = Number(lng);
  if (!isFinite(lat) || !isFinite(lng) || !name) return {};
  var safe = String(name).replace(/["\\]/g, " ").slice(0, 40);
  var q =
    "[out:json][timeout:8];nwr(around:150," +
    lat +
    "," +
    lng +
    ')["name"~"' +
    safe +
    '",i];out center tags 8;';
  var txt = await grab("https://overpass.kumi.systems/api/interpreter?data=" + encodeURIComponent(q), 8000);
  try {
    var j = JSON.parse(txt);
    var el = (j.elements || [])[0];
    var t = (el && el.tags) || {};
    return {
      phone: t.phone || t["contact:phone"] || "",
      hours: t.opening_hours || "",
      web: t.website || t["contact:website"] || "",
      cover: t.image || t["image:0"] || "",
      note: [t["addr:street"], t["addr:housenumber"], t["addr:city"]].filter(Boolean).join(" "),
      via: "osm",
    };
  } catch (_) {
    return {};
  }
}

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  var b = req.method === "GET" ? req.query || {} : readBody(req);
  var name = String(b.name || "").slice(0, 80);
  var place = String(b.place || b.city || "").slice(0, 80);
  var website = okUrl(b.website || b.web || "");
  if (!name && !website) {
    res.status(400).json({ ok: false, error: "empty" });
    return;
  }
  var out = { ok: true, phone: "", email: "", web: website, hours: "", cover: "", note: "", items: [], via: "" };
  var osm = await fromOsm(name, b.lat, b.lng);
  if (osm.phone) out.phone = osm.phone;
  if (osm.hours) out.hours = osm.hours;
  if (osm.web && !out.web) out.web = osm.web;
  if (osm.cover) out.cover = osm.cover;
  if (osm.note) out.note = osm.note;
  if (osm.via) out.via = osm.via;
  if (out.web && !website) website = out.web;
  if (website) {
    var site = await fromSite(website);
    out.phone = site.phone || out.phone;
    out.email = site.email || out.email;
    out.web = site.web || out.web;
    out.items = site.items || [];
    out.via = site.via || out.via;
  }
  if (!out.phone || !out.web) {
    var d = await fromDdg(name, place);
    if (!out.phone) out.phone = d.phone || "";
    if (!out.email) out.email = d.email || "";
    if (!out.web) out.web = d.web || "";
    if (!out.via) out.via = d.via || "";
    if (d.web && !website && !out.items.length) {
      var extra = await fromSite(d.web);
      if (extra.phone && !out.phone) out.phone = extra.phone;
      if (extra.email && !out.email) out.email = extra.email;
      if (extra.items && extra.items.length) out.items = extra.items;
      out.web = out.web || extra.web;
    }
  }
  res.status(200).json(out);
};
