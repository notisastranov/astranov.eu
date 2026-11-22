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
    rows.push({ id, title: decodeXml(title.trim()).slice(0, 180), published, source });
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
  res.setHeader("Cache-Control", items.length ? "public, max-age=60, s-maxage=180, stale-while-revalidate=120" : "no-store");
  return res.status(200).json({ country: selected.length ? country : null, items });
};
