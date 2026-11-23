/** SpaceNet's fixed equity watchlist. Prices come from exchange quotes via Yahoo Finance. */
const groups = {
  Space: [["Rocket Lab", "RKLB"]],
  "AI and chips": [["NVIDIA", "NVDA"], ["AMD", "AMD"], ["Palantir", "PLTR"], ["TSMC", "TSM"]],
  Technology: [["Microsoft", "MSFT"], ["Alphabet", "GOOGL"], ["Apple", "AAPL"], ["ASML", "ASML.AS"]],
  Defense: [["Lockheed Martin", "LMT"], ["RTX", "RTX"], ["Dassault Aviation", "AM.PA"], ["Rheinmetall", "RHM.DE"], ["BAE Systems", "BA.L"]],
  Automotive: [["Tesla", "TSLA"], ["Toyota", "7203.T"], ["Volkswagen", "VOW3.DE"]],
  Shipping: [["Maersk B", "MAERSK-B.CO"], ["Hapag-Lloyd", "HLAG.DE"]]
};
const prices = new Map();
let spacex = { symbol: "", until: 0 };
let current;

async function fetchJSON(url, options) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(3000) });
  if (!response.ok) throw new Error("Quote source unavailable");
  return response.json();
}

async function spaceXListing() {
  if (spacex.until > Date.now()) return spacex.symbol;
  try {
    const result = await fetchJSON("https://www.sec.gov/files/company_tickers_exchange.json", {
      headers: { "User-Agent": "Astranov SpaceNet market watch info@astranov.eu", Accept: "application/json" }
    });
    const fields = Array.isArray(result.fields) ? result.fields : [];
    const n = fields.indexOf("name"), t = fields.indexOf("ticker"), e = fields.indexOf("exchange");
    const row = n >= 0 && t >= 0 && e >= 0 && Array.isArray(result.data) && result.data.find(listing =>
      /^(?:space\s?x|space exploration technologies)(?:,? (?:corp(?:oration)?|inc))?\.?$/i.test(listing[n] || "") &&
      /^(nasdaq|nyse)$/i.test(listing[e] || "") && /^[A-Z]{1,6}$/.test(listing[t] || "")
    );
    spacex = { symbol: row ? row[t] : "", until: Date.now() + 3600_000 };
  } catch {
    spacex.until = Date.now() + 120_000;
  }
  return spacex.symbol;
}

async function marketPrice(symbol) {
  if (!symbol) return null;
  const old = prices.get(symbol);
  const now = Date.now();
  if (old?.until > now) return old.value;
  try {
    const result = await fetchJSON("https://query1.finance.yahoo.com/v8/finance/chart/" + encodeURIComponent(symbol) + "?range=5d&interval=1d");
    const meta = result.chart?.result?.[0]?.meta;
    if (!meta || meta.symbol !== symbol || meta.instrumentType !== "EQUITY" ||
        !/^[A-Z]{2}[A-Za-z]$/.test(meta.currency || "") || !Number.isFinite(meta.regularMarketPrice) ||
        meta.regularMarketPrice <= 0 || !Number.isFinite(meta.regularMarketTime)) throw new Error("Invalid quote");
    const timestamp = meta.regularMarketTime * 1000;
    if (timestamp > now + 300_000 || timestamp < now - 7 * 86400_000) throw new Error("Quote outside time window");
    const value = { price: meta.regularMarketPrice, currency: meta.currency, timestamp, stale: false };
    prices.set(symbol, { value, until: now + 90000 });
    return value;
  } catch {
    const value = old?.value && old.value.timestamp >= now - 7 * 86400_000 ? { ...old.value, stale: true } : null;
    prices.set(symbol, { value, until: now + 45000 });
    return value;
  }
}

async function watchlist() {
  const rows = Object.entries(groups).flatMap(([group, entries]) =>
    entries.map(([name, symbol]) => ({ name, symbol, group }))
  );
  const quotes = await Promise.all([
    spaceXListing().then(async symbol => ({ name: "SpaceX", symbol, group: "Space", quote: await marketPrice(symbol) })),
    ...rows.map(async row => ({ ...row, quote: await marketPrice(row.symbol) }))
  ]);
  return quotes;
}

module.exports = async function marketNews(req, res) {
  if (req.method !== "GET") return res.status(405).json({ items: [] });
  if (!current) current = watchlist().finally(() => { current = null; });
  const items = await current;
  res.setHeader("Cache-Control", items.some(item => item.quote)
    ? "public, max-age=30, s-maxage=60" : "no-store");
  return res.status(200).json({ source: "Yahoo Finance", items });
};
