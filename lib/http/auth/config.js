function cors(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
  res.setHeader("Cache-Control", "no-store");
}
module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  var architect = String(process.env.ARCHITECT_EMAIL || "notisastranov@gmail.com").toLowerCase();
  res.status(200).json({
    ok: true,
    google: true,
    via: "supabase",
    architect: architect,
    phone_verify: "twilio_pending",
  });
};
