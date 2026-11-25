const {resolve} = require("../sb-anon");
module.exports = async function(req,res) {
  const params = new URL(req.url,"https://spacenet.astranov.eu").searchParams;
  const lat = Number(params.get("lat")), lng = Number(params.get("lng"));
  if (req.method !== "GET" || !params.has("lat") || !params.has("lng") || !Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat)>90 || Math.abs(lng)>180) return res.status(400).json({});
  try {
    const {sb,anon} = await resolve();
    if (params.get("saved") === "1") {
      const dLat = 1.5 / 111;
      const dLng = Math.min(180,dLat / Math.max(0.00001,Math.cos(lat*Math.PI/180)));
      const query = new URLSearchParams({select:"id,name,lat,lng,category,emoji,address,tags,items",is_active:"eq.true",limit:"100"});
      query.append("lat","gte."+(lat-dLat));
      query.append("lat","lte."+(lat+dLat));
      if (lng-dLng < -180 || lng+dLng > 180) {
        const wrap = n => ((n+540)%360)-180;
        query.set("or","(lng.gte."+wrap(lng-dLng)+",lng.lte."+wrap(lng+dLng)+")");
      } else {
        query.append("lng","gte."+(lng-dLng));
        query.append("lng","lte."+(lng+dLng));
      }
      const result = await fetch(sb+"/rest/v1/vendors?"+query,{headers:{apikey:anon,Authorization:"Bearer "+anon},signal:AbortSignal.timeout(4000)});
      if (!result.ok) throw Error();
      const vendors = (await result.json()).map(r => ({id:r.id,name:r.name,lat:r.lat,lng:r.lng,category:r.category,emoji:r.emoji,
        phone:r.address?.phone,website:r.address?.website,logo:r.tags?.profile_url,cover:r.tags?.cover_url,menu:r.items || []}));
      return res.status(200).json({vendors});
    }
    const response = await fetch(sb+"/functions/v1/vendor-crawler", {method:"POST", headers:{apikey:anon,Authorization:"Bearer "+anon,"Content-Type":"application/json"},body:JSON.stringify({lat,lng,radius:1500}),signal:AbortSignal.timeout(20000)});
    if (!response.ok) throw Error();
    const data = await response.json();
    const vendors = (data.vendors || []).slice(0,100);
    res.setHeader("Cache-Control",vendors.length ? "public,s-maxage=300" : "no-store");
    return res.status(200).json({vendors});
  } catch { return res.status(503).json({error:"discovery_unavailable"}); }
};
