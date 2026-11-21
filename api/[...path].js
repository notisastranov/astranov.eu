const handlers = {
  "ai": require("../lib/http/ai"),
  "find": require("../lib/http/find"),
  "live": require("../lib/http/live"),
  "place": require("../lib/http/place"),
  "public-config": require("../lib/http/public-config"),
  "queue": require("../lib/http/queue"),
  "sms": require("../lib/http/sms"),
  "space": require("../lib/http/space"),
  "version": require("../lib/http/version"),
  "paypal": require("../lib/http/paypal"),
  "paypal/create-order": require("../lib/http/paypal/create-order"),
  "paypal/capture-order": require("../lib/http/paypal/capture-order"),
  "support/open": require("../lib/http/support/open"),
  "auth/config": require("../lib/http/auth/config"),
  "partners/orders": require("../lib/http/partners/orders"),
  "partners/webhooks/test": require("../lib/http/partners/webhooks-test"),
  "partners/city-accounts": require("../lib/http/partners/city-accounts"),
  "partners/overflow-offers": require("../lib/http/partners/overflow-offers"),
  "partners/openapi.json": require("../lib/http/partners/openapi"),
  "vendors/direct": require("../lib/http/vendors/direct"),
  "transactions": require("../lib/http/transactions"),
  "stripe/create-checkout": require("../lib/http/stripe/create-checkout"),
  "revolut/create-order": require("../lib/http/revolut/create-order"),
};

function routeKey(req) {
  const raw = String((req && req.url) || "").split("?")[0];
  const m = raw.match(/\/api\/(.+)$/);
  if (m) return m[1].replace(/\/$/, "");
  const q = req && req.query && (req.query.path || req.query["...path"]);
  if (Array.isArray(q)) return q.join("/");
  if (typeof q === "string") return q;
  return "";
}

/** Dynamic partner/vendor paths (keep stamp router small). */
function resolve(key) {
  if (handlers[key]) return handlers[key];
  if (/^partners\/orders\/[^/]+\/status$/.test(key)) {
    return require("../lib/http/partners/order-status");
  }
  if (/^vendors\/direct\/[^/]+\/menu$/.test(key)) {
    return require("../lib/http/vendors/direct-menu");
  }
  return null;
}

module.exports = function (req, res) {
  const key = routeKey(req);
  const fn = resolve(key);
  if (typeof fn !== "function") {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "missing", path: key }));
    return;
  }
  return fn(req, res);
};
