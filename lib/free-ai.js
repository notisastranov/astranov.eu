const {resolve} = require('./sb-anon');
const providers = {
  groq: ['https://api.groq.com/openai/v1/chat/completions','llama-3.3-70b-versatile','GROQ_API_KEY'],
  openrouter: ['https://openrouter.ai/api/v1/chat/completions','openrouter/free','OPENROUTER_API_KEY'],
  gemini: ['https://generativelanguage.googleapis.com/v1beta/openai/chat/completions','gemini-2.5-flash','GEMINI_API_KEY']
};
async function vault(name,args) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SB_SERVICE_ROLE_KEY;
  if (!key) return null;
  const {sb} = await resolve();
  const response = await fetch(sb+'/rest/v1/rpc/'+name,{method:'POST',headers:{apikey:key,Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify(args),signal:AbortSignal.timeout(3000)});
  return response.ok ? response.json() : null;
}
async function answer(messages) {
  let saved;
  try { saved = await vault('sn_ai_keys',{}); } catch {}
  for (const [id,[url,model,env]] of Object.entries(providers)) {
    const key = saved?.[id] || process.env[env];
    if (!key) continue;
    try {
      const response = await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:JSON.stringify({model,messages,max_tokens:900}),signal:AbortSignal.timeout(6000)});
      if (!response.ok) continue;
      const text = (await response.json()).choices?.[0]?.message?.content;
      if (typeof text === 'string' && text.trim()) return {text,model,via:id};
    } catch {}
  }
  return null;
}
module.exports = {providers,vault,answer};
