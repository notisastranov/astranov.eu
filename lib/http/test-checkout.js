/** Signed-in test credit and atomic order submission through Supabase. */
const sbAnon = require("../sb-anon");

module.exports = async function testCheckout(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "GET" && req.method !== "POST") return res.status(405).json({ error: "method" });
  const auth = req.headers.authorization || "";
  if (!/^Bearer \S+$/i.test(auth)) return res.status(401).json({ error: "auth_required" });
  let payload = {};
  if (req.method === "POST") {
    try { payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body; }
    catch { return res.status(400).json({ error: "invalid_order" }); }
    const orders = Array.isArray(payload?.batch) ? payload.batch : [payload];
    if (!payload?.action && (!orders.length || orders.length > 8 || orders.some(order =>
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(order?.order_id || "") ||
      !order.payload || JSON.stringify(order.payload).length > 16000))) {
      return res.status(400).json({ error: "invalid_order" });
    }
  }
  try {
    const { sb, anon } = await sbAnon.resolve();
    if (!sb || !anon) return res.status(503).json({ error: "checkout_config_missing" });
    const rpc = req.method === "GET" ? "sn_test_balance" : payload.action === "order_hold" ? "sn_hold_action" : payload.action ? "sn_dispatch" : payload.batch ? "sn_submit_test_order_batch" : "sn_submit_test_order";
    const upstream = await fetch(sb + "/rest/v1/rpc/" + rpc, {
      method: "POST",
      headers: { apikey: anon, Authorization: auth, "Content-Type": "application/json" },
      body: JSON.stringify(payload.action === "order_hold" ? {details:payload.details || {}} : payload),
      signal: AbortSignal.timeout(8000)
    });
    const data = await upstream.json();
    if (upstream.status === 403) return res.status(403).json({error:"order_access_denied"});
    if (upstream.status === 401) return res.status(401).json({ error: "auth_required" });
    if (!upstream.ok) {
      if (["PGRST202","42P01","42883"].includes(data.code)) return res.status(503).json({error:"dispatch_schema_missing"});
      if (data.code === "22023") return res.status(400).json({ error: "invalid_order" });
      if (data.code === "23505") return res.status(409).json({ error: "order_id_conflict" });
      return res.status(503).json({ error: "test_checkout_unavailable" });
    }
    if (req.method === "GET") return res.status(200).json({ balance_cents: data });
    return res.status(data.error ? 402 : 200).json(data);
  } catch {
    return res.status(503).json({ error: "test_checkout_unavailable" });
  }
};
