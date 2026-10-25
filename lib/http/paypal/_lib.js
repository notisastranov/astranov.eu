/** PayPal server helper. Secrets stay in env. Never ship to the client. */
function mode() {
  var m = String(process.env.PAYPAL_MODE || process.env.PAYPAL_ENV || "live").toLowerCase();
  return m === "sandbox" || m === "test" ? "sandbox" : "live";
}
function base() {
  return mode() === "sandbox" ? "https://api-m.sandbox.paypal.com" : "https://api-m.paypal.com";
}
function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "authorization, content-type");
  res.setHeader("Cache-Control", "no-store");
}
function keyed() {
  return !!(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}
async function token() {
  var id = process.env.PAYPAL_CLIENT_ID || "";
  var secret = process.env.PAYPAL_CLIENT_SECRET || "";
  if (!id || !secret) throw new Error("paypal_not_configured");
  var r = await fetch(base() + "/v1/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: "Basic " + Buffer.from(id + ":" + secret).toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  var j = await r.json().catch(function () {
    return {};
  });
  if (!r.ok || !j.access_token) throw new Error(j.error_description || j.error || "paypal_token");
  return j.access_token;
}
module.exports = { mode, base, cors, keyed, token };
