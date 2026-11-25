const {resolve} = require('../sb-anon');
module.exports = async function(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({});
  const authorization = req.headers.authorization || '';
  if (!/^Bearer \S+$/.test(authorization)) return res.status(401).json({});
  try {
    const data = typeof req.body==='string' ? JSON.parse(req.body) : req.body;
    if (!data || JSON.stringify(data).length>16000) return res.status(400).json({});
    const {sb,anon} = await resolve();
    const upstream = await fetch(sb+'/rest/v1/rpc/'+(['chat-list','chat-count','chat-open','chat-send'].includes(data.kind)?'sn_profile_chat':data.kind==='inbox'?'sn_vendor_inbox':['message','message-read','notifications','order-status'].includes(data.kind)?'sn_notifications':'sn_listing_action'),{method:'POST',headers:{apikey:anon,Authorization:authorization,'Content-Type':'application/json'},body:JSON.stringify({data}),signal:AbortSignal.timeout(8000)});
    if (!upstream.ok) return res.status(upstream.status).json({ok:false});
    return res.status(200).json(await upstream.json());
  } catch {return res.status(503).json({ok:false});}
};
