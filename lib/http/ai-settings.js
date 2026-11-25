const {resolve} = require('../sb-anon');
const {providers,vault} = require('../free-ai');
module.exports = async function(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({});
  const authorization = req.headers.authorization || '';
  if (!/^Bearer \S+$/.test(authorization)) return res.status(401).json({});
  try {
    const {sb,anon} = await resolve();
    const auth = await fetch(sb+'/auth/v1/user',{headers:{apikey:anon,Authorization:authorization}});
    if (!auth.ok) return res.status(401).json({});
    const user = await auth.json();
    const meta = user.app_metadata || {};
    const roles = [meta.role].concat(Array.isArray(meta.roles) ? meta.roles : []);
    if (!(user.email_confirmed_at && user.email?.toLowerCase()==='notisastranov@gmail.com') &&
        !roles.some(role=>['owner','admin','super_admin'].includes(role))) return res.status(403).json({});
    const {provider,key} = typeof req.body==='string' ? JSON.parse(req.body) : req.body || {};
    if (!Object.hasOwn(providers,provider) || typeof key!=='string' || !key.trim() || key.length>4096) return res.status(400).json({});
    const ok = await vault('sn_save_ai_key',{provider_id:provider,credential:key.trim()});
    return res.status(ok===true ? 200 : 503).json({ok:ok===true});
  } catch {return res.status(503).json({ok:false});}
};
