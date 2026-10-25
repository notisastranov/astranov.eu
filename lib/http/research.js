/** Globe research. SpaceX, and only urgent crisis, war, or major business. */
module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") { res.status(204).end(); return; }
  var seed = [
    { k: "RESEARCH", lens: "STOCK", t: "SpaceX share. A published range, not a promise.", est: "$159", body: "Published prints put SpaceX near $159, after a $225 high in June and a $105 low in August. The cited market value is about $2.2 trillion. Morgan Stanley's published target is $300. Bulls print $600 to $800. Bears print $62 to $100. SpaceNet does not forecast the rise.", lat: 33.92, lng: -118.35, where: "Hawthorne" },
    { k: "RESEARCH", lens: "SPACEX", t: "Musk says SpaceX could dwarf the Earth economy. Analysts call it theatre.", est: "5,500×", body: "Musk wrote that he sees a path to SpaceX being worth orders of magnitude more than the Earth economy. One reading of that is a 5,500-fold rise. Analysts called it hype. Reported Q2 revenue was $7.8 billion, up 92%. He has spoken of an internal path to $1 trillion of revenue in 2030.", lat: 25.99, lng: -97.19, where: "Starbase" },
    { k: "RESEARCH", lens: "SPACEX", t: "What is next: Starship Flight 15.", est: "NEXT", body: "Morgan Stanley told clients to build a position before Starship Flight 15. That is the published next event. It is not a date SpaceNet invented.", lat: 28.52, lng: -80.65, where: "Cape" },
    { k: "RESEARCH", lens: "WAR", t: "Gulf war is choking Hormuz.", est: "WAR", body: "The war with Iran has slowed the Strait of Hormuz, about a fifth of the world's oil. Brent was reported near $90. This is the urgent war story on the energy route.", lat: 26.6, lng: 56.25, where: "Hormuz" },
    { k: "RESEARCH", lens: "CRISIS", t: "IMF: energy shock, record debt, an AI split.", est: "CRISIS", body: "Georgieva warned of a war energy shock and an AI boom that skips most countries. The biggest growth cuts are in economies hit by war. Bond yields are at multi-year highs.", lat: 13.75, lng: 100.5, where: "Bangkok" },
    { k: "RESEARCH", lens: "DEAL", t: "War is the top business risk. The opening is whoever can still move goods.", est: "DEAL", body: "Allianz says war is the political-violence risk companies now fear most. Trade is rerouting. The urgent opportunity is capacity on routes that still run, and energy and rare-earth supply that states are underwriting.", lat: 1.35, lng: 103.82, where: "Singapore" }
  ];
  function lensOf(t) {
    var s = String(t || "").toLowerCase();
    if (/spacex|starship|starlink|\bspcx\b/.test(s) && /stock|share|valuation|price|target|ipo|billion|trillion/.test(s)) return "STOCK";
    if (/spacex|starship|starlink|\bspcx\b/.test(s)) return "SPACEX";
    if (/war|missile|strike|invasion|hormuz|troops|attack/.test(s)) return "WAR";
    if (/crisis|shock|sanction|default|emergency|debt/.test(s)) return "CRISIS";
    if (/billion|trillion|contract|acquisition|opportunit|deal/.test(s)) return "DEAL";
    return "";
  }
  function place(t, i) {
    var s = String(t || "").toLowerCase();
    if (/starbase|boca/.test(s)) return { lat: 25.99, lng: -97.19, where: "Starbase" };
    if (/cape|florida|kennedy/.test(s)) return { lat: 28.52, lng: -80.65, where: "Cape" };
    if (/hawthorne|california/.test(s)) return { lat: 33.92, lng: -118.35, where: "Hawthorne" };
    if (/hormuz|iran|gulf/.test(s)) return { lat: 26.6, lng: 56.25, where: "Hormuz" };
    if (/ukraine|kyiv/.test(s)) return { lat: 50.45, lng: 30.52, where: "Ukraine" };
    if (/israel|gaza|tel aviv/.test(s)) return { lat: 31.5, lng: 34.8, where: "Levant" };
    if (/taiwan|china|beijing/.test(s)) return { lat: 25.0, lng: 121.5, where: "Taiwan Strait" };
    return { lat: 8 + (i % 5) * 14, lng: -90 + (i % 6) * 28, where: "World" };
  }
  function titles(xml) {
    var out = [], re = /<item>([\s\S]*?)<\/item>/g, m;
    while ((m = re.exec(xml || ""))) {
      var title = ((/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/.exec(m[1]) || [])[1] || "");
      title = title.replace(/<[^>]+>/g, "").replace(/&/g, "&").replace(/"/g, "\"").replace(/&#39;/g, "'").replace(/'/g, "'").trim();
      if (title && title.length > 12) out.push(title);
    }
    return out;
  }
  var live = [];
  try {
    var url = "https://news.google.com/rss/search?q=" + encodeURIComponent("(SpaceX OR Starship OR SPCX OR war OR crisis OR Hormuz) when:2d") + "&hl=en-US&gl=US&ceid=US:en";
    var r = await fetch(url, { headers: { "User-Agent": "AstranovSpaceNet/1" } });
    var xml = await r.text();
    titles(xml).forEach(function (t, i) {
      var lens = lensOf(t);
      if (!lens) return;
      var at = place(t, i);
      live.push({ k: "RESEARCH", lens: lens, t: t, est: lens, body: t, lat: at.lat, lng: at.lng, where: at.where });
    });
  } catch (e) {}
  var cards = seed.concat(live).slice(0, 12);
  res.status(200).json({ cards: cards });
};
