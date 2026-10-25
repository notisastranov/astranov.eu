/** Root /api/paypal → status + pointer to create-order. Secrets stay server-side. */
const { cors, keyed, mode } = require("./paypal/_lib");

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method === "POST") {
    // forward shape for old clients
    res.status(200).json({
      ok: false,
      use: "/api/paypal/create-order",
      configured: keyed(),
      mode: mode(),
    });
    return;
  }
  res.status(200).json({
    ok: true,
    configured: keyed(),
    mode: mode(),
    endpoints: {
      config: "/api/paypal/config",
      create: "POST /api/paypal/create-order",
      capture: "POST /api/paypal/capture-order",
    },
    note: "EUR deposit → AVC 1:1. Set PAYPAL_CLIENT_ID + PAYPAL_CLIENT_SECRET on Vercel if configured:false.",
  });
};
