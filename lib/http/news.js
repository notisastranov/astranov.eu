/** Recent uploads from a fixed set of official broadcaster feeds. */
const world = [
  ["BBC News", "UC16niRr50-MSBwiO3YDb3RA"],
  ["Reuters", "UChqUTb7kYRX8-EiaN3XFrSQ"],
  ["Associated Press", "UC52X5wxOL_s5yw0dQk7NtgA"],
  ["Al Jazeera English", "UCNye-wNBqNL5ZzHSJj3l8Bg"],
  ["France 24 English", "UCQfwfsi5VrQ8yKZ-UWmAEFg"],
  ["DW News", "UCknLrEdhRCp1aegoMqRaCZg"]
];
const national = {
  GR: [["ERT News", "@ertnews"], ["SKAI", "@skaigr"]],
  GB: [world[0], ["Sky News", "UCoMdktPbSTixAyNGwb-UYkQ"]],
  US: [["PBS NewsHour", "UC6ZFN9Tx6xh-skXCuRHCDpQ"], world[2]],
  FR: [["France 24", "@France24_fr"], ["franceinfo", "@franceinfo"]],
  DE: [["tagesschau", "@tagesschau"], world[5]],
  IN: [["NDTV", "UCZFMm1mMw0F81Z37aaEzTUA"], ["India Today", "@indiatoday"]],
  AU: [["ABC News Australia", "@abcnewsaustralia"], ["SBS News", "@SBSNews"]],
  CA: [["CBC News", "@CBCNews"], ["CTV News", "@CTVNews"]],
  JP: [["ANN News", "@ANNnewsCH"], ["NHK World-Japan", "@NHKWORLDJAPAN"]],
  IT: [["Rai News", "@RaiNews"], ["Sky TG24", "@SkyTG24"]],
  ES: [["RTVE Noticias", "@RTVENoticias"], ["laSexta Noticias", "@lasextanoticias"]],
  SG: [["CNA", "UC83jt4dlz1Gjl58fzQrrKZg"]]
};
// Use explicit locations in headlines. When a headline has no usable location,
// the UI labels the pin as the broadcaster's base.
const places = [
  ["New York", 40.71, -74.01, "new york city|new york|nyc"],
  ["Washington, DC", 38.90, -77.04, "washington[, ]+d\\.?c\\.?|white house|capitol hill"],
  ["United States", 39.83, -98.58, "united states|u\\.s\\.|usa"],
  ["Canada", 55.9, -106.3], ["Ottawa", 45.42, -75.70],
  ["Mexico", 23.63, -102.55], ["Mexico City", 19.43, -99.13],
  ["Brazil", -10, -52], ["Rio de Janeiro", -22.91, -43.17],
  ["Argentina", -35, -65], ["Buenos Aires", -34.60, -58.38],
  ["London", 51.51, -.13], ["United Kingdom", 54.8, -2.8, "united kingdom|britain"],
  ["Paris", 48.86, 2.35], ["France", 46.6, 2.5],
  ["Berlin", 52.52, 13.40], ["Germany", 51.16, 10.45],
  ["Rome", 41.90, 12.50], ["Italy", 42.8, 12.8],
  ["Madrid", 40.42, -3.70], ["Spain", 40.42, -3.70],
  ["Brussels", 50.85, 4.35], ["Warsaw", 52.23, 21.01],
  ["Athens", 37.98, 23.73, "athens|αθήνα"], ["Greece", 39.2, 22.0, "greece|ελλάδα"],
  ["Rhodes", 36.43, 28.22, "rhodes|ρόδος"],
  ["Istanbul", 41.01, 28.98], ["Turkey", 39.06, 35.17, "turkey|türkiye"],
  ["Kyiv", 50.45, 30.52, "kyiv|kiev"], ["Ukraine", 49, 31.4],
  ["Moscow", 55.76, 37.62], ["Russia", 61.5, 95.5],
  ["Gaza", 31.44, 34.39, "gaza strip|gaza"], ["West Bank", 31.95, 35.25],
  ["Jerusalem", 31.77, 35.23], ["Israel", 31.0, 34.85],
  ["Beirut", 33.89, 35.50], ["Lebanon", 33.9, 35.9],
  ["Damascus", 33.51, 36.29], ["Syria", 35.0, 38.0],
  ["Tehran", 35.69, 51.39], ["Iran", 32.4, 53.6],
  ["Doha", 25.29, 51.53], ["Cairo", 30.04, 31.24], ["Egypt", 26.8, 30.8],
  ["Sudan", 15.6, 30.2], ["Nairobi", -1.29, 36.82], ["Kenya", .18, 37.9],
  ["South Africa", -29, 25], ["Cape Town", -33.92, 18.42],
  ["New Delhi", 28.61, 77.21, "new delhi|delhi"], ["India", 22.6, 79.7],
  ["Islamabad", 33.69, 73.05], ["Pakistan", 30.4, 69.3],
  ["Beijing", 39.90, 116.41], ["China", 35.9, 104.2],
  ["Taipei", 25.03, 121.57], ["Taiwan", 23.7, 120.96],
  ["Tokyo", 35.68, 139.69], ["Japan", 36.2, 138.3],
  ["Seoul", 37.57, 126.98], ["South Korea", 36.4, 127.8], ["North Korea", 40.1, 127.5],
  ["Singapore", 1.35, 103.82], ["Sydney", -33.87, 151.21], ["Australia", -25.3, 133.8],
  ["New Zealand", -41.3, 173.0]
].map(([name, lat, lng, aliases]) => ({
  name, lat, lng, match: new RegExp("(?<![\\p{L}\\p{N}])(?:" + (aliases || name) + ")(?![\\p{L}\\p{N}])", "iu")
}));

const sourceBases = [
  ["London", 51.51, -.13, ["BBC News", "Reuters", "Sky News"]],
  ["New York", 40.71, -74.01, ["Associated Press"]],
  ["Doha", 25.29, 51.53, ["Al Jazeera English"]],
  ["Paris", 48.86, 2.35, ["France 24 English", "France 24", "franceinfo"]],
  ["Bonn", 50.74, 7.10, ["DW News"]], ["Hamburg", 53.55, 9.99, ["tagesschau"]],
  ["Athens", 37.98, 23.73, ["ERT News", "SKAI"]],
  ["Arlington", 38.88, -77.10, ["PBS NewsHour"]],
  ["New Delhi", 28.61, 77.21, ["NDTV", "India Today"]],
  ["Sydney", -33.87, 151.21, ["ABC News Australia", "SBS News"]],
  ["Toronto", 43.65, -79.38, ["CBC News", "CTV News"]],
  ["Tokyo", 35.68, 139.69, ["ANN News", "NHK World-Japan"]],
  ["Rome", 41.90, 12.50, ["Rai News", "Sky TG24"]],
  ["Madrid", 40.42, -3.70, ["RTVE Noticias", "laSexta Noticias"]],
  ["Singapore", 1.35, 103.82, ["CNA"]]
];

function publisherLocation(source) {
  const base = sourceBases.find(([, , , sources]) => sources.includes(source));
  return base ? { name: base[0], lat: base[1], lng: base[2], kind: "publisher" } : null;
}

function storyLocation(title, source, entry) {
  const point = entry.match(/<georss:point>\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)\s*<\/georss:point>/);
  if (point && Math.abs(Number(point[1])) <= 90 && Math.abs(Number(point[2])) <= 180) {
    return { name: "Story location", lat: Number(point[1]), lng: Number(point[2]), kind: "story" };
  }
  const matches = places.flatMap(({ match, ...place }) => {
    const found = match.exec(title);
    return found ? [{ ...place, at: found.index, length: found[0].length }] : [];
  }).sort((a, b) => a.at - b.at || b.length - a.length);
  if (!matches.length) return publisherLocation(source);
  const { name, lat, lng } = matches[0];
  return { name, lat, lng, kind: "story" };
}

const cache = new Map();
const handles = new Map();
const channelPattern = /^UC[\w-]{22}$/;
const maxAge = 3 * 24 * 3600_000;

function decodeXml(value) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (match, name) => {
    if (name[0] !== "#") return { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" }[name] || match;
    const code = name[1].toLowerCase() === "x" ? parseInt(name.slice(2), 16) : Number(name.slice(1));
    return code <= 0x10ffff ? String.fromCodePoint(code) : match;
  });
}

function parseFeed(xml, source) {
  const rows = [];
  for (const block of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = block[1].match(/<yt:videoId>([\w-]{11})<\/yt:videoId>/)?.[1];
    const title = block[1].match(/<title>([\s\S]*?)<\/title>/)?.[1];
    const published = Date.parse(block[1].match(/<published>([^<]+)<\/published>/)?.[1]);
    if (!id || !title || !Number.isFinite(published)) continue;
    const text = decodeXml(title.trim());
    rows.push({ id, title: text.slice(0, 180), published, source, location: storyLocation(text, source, block[1]) });
  }
  return rows;
}

async function fetchText(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(3500) });
  if (!response.ok) throw new Error("Publisher unavailable");
  return response.text();
}

async function channelId(reference) {
  if (channelPattern.test(reference)) return reference;
  const cached = handles.get(reference);
  if (cached && cached.until > Date.now()) return cached.id;
  const html = await fetchText("https://www.youtube.com/" + reference);
  const id = html.match(/"externalId":"(UC[\w-]{22})"/)?.[1] ||
    html.match(/"channelUrl":"https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1] ||
    html.match(/<link rel="canonical" href="https:\/\/www\.youtube\.com\/channel\/(UC[\w-]{22})"/)?.[1];
  if (!id) throw new Error("Publisher channel not found");
  handles.set(reference, { id, until: Date.now() + 86400_000 });
  return id;
}

async function publisherNews([source, reference]) {
  const cached = cache.get(reference);
  if (cached?.until > Date.now()) return cached.rows;
  try {
    const id = await channelId(reference);
    const xml = await fetchText("https://www.youtube.com/feeds/videos.xml?channel_id=" + id);
    const rows = parseFeed(xml, source);
    cache.set(reference, { until: Date.now() + 300_000, rows });
    return rows;
  } catch {
    const rows = cached?.rows || [];
    cache.set(reference, { until: Date.now() + 60_000, rows });
    return rows;
  }
}

async function headlines(sources) {
  const since = Date.now() - maxAge;
  const lists = await Promise.all(sources.map(publisherNews));
  const seen = new Set();
  return lists.flatMap(list => list.filter(row => row.published >= since).slice(0, 2))
    .sort((a, b) => b.published - a.published)
    .filter(row => {
      if (seen.has(row.id)) return false;
      seen.add(row.id);
      return true;
    }).slice(0, 12);
}

module.exports = async function news(req, res) {
  if (req.method !== "GET") return res.status(405).json({ items: [] });
  const requested = new URL(req.url, "https://spacenet.astranov.eu").searchParams.get("country");
  const country = Object.hasOwn(national, requested) ? requested : null;
  const selected = country ? await headlines(national[country]) : [];
  const items = selected.length ? selected : await headlines(world);
  const fallback = items.length ? [] : world.map(([source, id]) => ({
    id: "UU" + id.slice(2), playlist: true, title: "Latest uploads", source, location: publisherLocation(source)
  }));
  res.setHeader("Cache-Control", items.length ? "public, max-age=60, s-maxage=180, stale-while-revalidate=120" : "no-store");
  return res.status(200).json({ country: selected.length ? country : null, items: items.length ? items : fallback, fallback: !items.length });
};
