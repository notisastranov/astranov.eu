const sbAnon = require("../../sb-anon");

const depositPrefix = "sn-wallet:";
async function verifiedUser(req) {
  const authorization = String(req.headers?.authorization || "");
  if (!/^Bearer \S+$/i.test(authorization)) return null;
  const { sb, anon } = await sbAnon.resolve();
  if (!sb || !anon) return null;
  const response = await fetch(sb + "/auth/v1/user", {
    headers: { apikey: anon, Authorization: authorization },
    signal: AbortSignal.timeout(4000)
  });
  if (!response.ok) return null;
  const user = await response.json();
  return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(user?.id || "") ? user.id : null;
}
async function walletRPC(name, payload) {
  const { sb } = await sbAnon.resolve();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;
  if (!sb || !key) return null;
  const response = await fetch(sb + "/rest/v1/rpc/" + name, {
    method: "POST",
    headers: { apikey: key, Authorization: "Bearer " + key, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(6000)
  });
  if (!response.ok) return null;
  return response.json();
}
async function walletReady() {
  try { return (await walletRPC("sn_paypal_wallet_ready", {})) === true; }
  catch { return false; }
}
async function creditDeposit(user, orderId, captureId, cents) {
  return walletRPC("sn_credit_verified_paypal_deposit", { account: user, order_ref: orderId, capture_ref: captureId, paid_cents: cents });
}
module.exports = { depositPrefix, verifiedUser, walletReady, creditDeposit };
