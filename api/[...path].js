const handlers = {
  "ai": require("../lib/http/ai"),
  "find": require("../lib/http/find"),
  "live": require("../lib/http/live"),
  "place": require("../lib/http/place"),
  "public-config": require("../lib/http/public-config"),
  "queue": require("../lib/http/queue"),
  "research": require("../lib/http/research"),
  "sms": require("../lib/http/sms"),
  "space": require("../lib/http/space"),
  "version": require("../lib/http/version"),
  "videos": require("../lib/http/videos"),
  "paypal": require("../lib/http/paypal"),
  "paypal/create-order": require("../lib/http/paypal/create-order"),
  "paypal/capture-order": require("../lib/http/paypal/capture-order"),
  "support/open": require("../lib/http/support/open"),
  "auth/config": require("../lib/http/auth/config"),
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

module.exports = function (req, res) {
  const key = routeKey(req);
  const fn = handlers[key];
  if (typeof fn !== "function") {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify({ error: "missing", path: key }));
    return;
  }
  return fn(req, res);
};
