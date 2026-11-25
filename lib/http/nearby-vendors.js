const {resolve} = require("../sb-anon");
module.exports = async function(req,res) {
  const params = new URL(req.url,"https://spacenet.astranov.eu").searchParams;
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  if (req.method !== "GET" || !params.has("lat") || !params.has("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) return res.status(400).json({});
  try {
    const {sb,anon} = await resolve();
    const response = await fetch(sb+"/functions/v1/vendor-crawler", {method:"POST", headers:{apikey:anon,Authorization:"Bearer "+anon,"Content-Type":"application/json"},body:JSON.stringify({lat,lng,radius:1500}),signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw Error();
    const data = await response.json();
    const vendors = (data.vendors || []).slice(0,100);
    res.setHeader("Cache-Control",vendors.length ? "public,s-maxage=300" : "no-store");
    return res.status(200).json({vendors});
  } catch { return res.status(503).json({error:"discovery_unavailable"}); }
};
