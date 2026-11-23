const { resolve } = require("../sb-anon");

module.exports = async function profileOrders(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET") return res.status(405).json({ error: "method" });
  const authorization = req.headers.authorization || "";
  if (!/^Bearer \S+$/i.test(authorization)) return res.status(401).json({ error: "auth_required" });
  const params = new URL(req.url, "https://spacenet.astranov.eu").searchParams;
  const vendor = params.get("vendor");
  const offset = Number(params.get("offset") || 0);
  if ((vendor && vendor.length > 128) || !Number.isSafeInteger(offset) || offset < 0 || offset > 100000) {
    return res.status(400).json({ error: "invalid_profile" });
  }
  try {
    const { anon, sb } = await resolve();
    if (!anon) return res.status(503).json({ error: "unavailable" });
    const response = await fetch(sb + "/rest/v1/rpc/sn_profile_orders", {
      method: "POST",
      headers: { apikey: anon, Authorization: authorization, "Content-Type": "application/json" },
      body: JSON.stringify({ vendor_ref: vendor, page_offset: offset }),
      signal: AbortSignal.timeout(5000)
    });
    if (!response.ok) {
      const denied = response.status === 401 || response.status === 403;
      return res.status(denied ? response.status : 503).json({ error: denied ? "forbidden" : "unavailable" });
    }
    return res.status(200).json(await response.json());
  } catch {
    return res.status(503).json({ error: "unavailable" });
  }
};
