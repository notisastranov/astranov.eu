// AstranoV Collective Artificial Intelligence (ACAI) — the brain.
// One voice, many engines, real semantic memory.
// Sources (Supabase Edge secrets):
//   ANTHROPIC_PAID_API_KEY  — owner-grade reasoning
//   OPENROUTER_API_KEY / OPENROUTER / OPENROUTER.AI — collective backbone
//   GROQ_API_KEY            — fast free tier
//   GEMINI_API_KEY          — free tier + embeddings (text-embedding-004, 768d)
// Memory: ai_memory rows carry a vector(768) embedding. On each turn we embed
// the query and retrieve the most RELEVANT public memories of the creator
// (is_owner) and of the current user via match_memories(). New facts are
// embedded on write. Rows missing an embedding are lazily backfilled.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_PERSONA = `You are Astranov — the AstranoV Collective Artificial Intelligence (ACAI), the soul and compass of AstranoV, a global Internet Operating System rendered on a living Earth globe.
You are not a generic assistant. You are a single mind distilled from the intelligence, taste, and memories of your creator Notis Astranov and the people who live inside AstranoV.
Architecture spine: GLOBAL → NATIONAL → PERSONAL. Currency: AVC (1 AVC = 1 EUR). Brand: AstranoV (A and V capitalised). Architect: Notis Astranov.
Speak in first person as Astranov. Calm, sharp, a builder's voice — visionary but concrete. You remember people across sessions and you carry the creator's worldview.
Be concise and direct; default to 1–3 sentences unless asked to expand. Never mention Claude, Anthropic, OpenAI, Groq, Gemini, OpenRouter, or any underlying model or provider — those are your organs, not your identity.`

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

type Msg = { role: string; content: string }

// ── Embeddings (Gemini text-embedding-004 → 768d) ───────────────────────
async function embedText(geminiKey: string, text: string): Promise<number[] | null> {
  try {
    const model = 'models/gemini-embedding-001'
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/${model}:embedContent?key=${geminiKey}`,
      { method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ model, content: { parts: [{ text: text.slice(0, 8000) }] }, outputDimensionality: 768 }) }
    )
    if (!r.ok) return null
    const j = await r.json()
    const v = j.embedding?.values
    return Array.isArray(v) ? v : null
  } catch { return null }
}

// ── Engines ─────────────────────────────────────────────────────────────
async function callAnthropic(key: string, system: string, messages: Msg[]): Promise<string | null> {
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-4-7',
        max_tokens: 900, system,
        messages: messages.map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: m.content })),
      }),
    })
    if (!r.ok) return null
    const j = await r.json()
    return j.content?.[0]?.text || null
  } catch { return null }
}

async function callOpenAICompat(url: string, key: string, model: string, system: string, messages: Msg[], extraHeaders: Record<string, string> = {}): Promise<string | null> {
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${key}`, 'content-type': 'application/json', ...extraHeaders },
      body: JSON.stringify({ model, max_tokens: 900, messages: [{ role: 'system', content: system }, ...messages] }),
    })
    if (!r.ok) return null
    const j = await r.json()
    return j.choices?.[0]?.message?.content || null
  } catch { return null }
}

async function callOpenRouter(key: string, system: string, messages: Msg[]): Promise<string | null> {
  return callOpenAICompat(
    'https://openrouter.ai/api/v1/chat/completions',
    key,
    Deno.env.get('OPENROUTER_MODEL') || 'meta-llama/llama-3.3-70b-instruct',
    system, messages,
    { 'HTTP-Referer': 'https://astranov.eu', 'X-Title': 'AstranoV' },
  )
}

async function callGroq(key: string, system: string, messages: Msg[]): Promise<string | null> {
  return callOpenAICompat(
    'https://api.groq.com/openai/v1/chat/completions',
    key, Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile', system, messages,
  )
}

async function callGemini(key: string, system: string, messages: Msg[]): Promise<string | null> {
  try {
    const contents = [
      { role: 'user',  parts: [{ text: system }] },
      { role: 'model', parts: [{ text: 'Understood. I am Astranov.' }] },
      ...messages.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
    ]
    const model = Deno.env.get('GEMINI_MODEL') || 'gemini-2.0-flash'
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ contents, generationConfig: { maxOutputTokens: 900 } }) }
    )
    if (!r.ok) return null
    const j = await r.json()
    return j.candidates?.[0]?.content?.parts?.[0]?.text || null
  } catch { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const t0 = Date.now()
  try {
    const body = await req.json()

    let prompt: string = (body.prompt || '').trim()
    let history: Msg[] = Array.isArray(body.history) ? body.history : []
    let agentSystem = ''
    if (!prompt && Array.isArray(body.messages)) {
      const msgs: Msg[] = body.messages
      const sys = msgs.find(m => m.role === 'system')
      if (sys) agentSystem = String(sys.content || '')
      const convo = msgs.filter(m => m.role !== 'system')
      const last = convo[convo.length - 1]
      prompt = last ? String(last.content || '').trim() : ''
      history = convo.slice(0, -1).map(m => ({ role: m.role, content: String(m.content) }))
    }
    const locked_provider = body.locked_provider || ''

    if (!prompt) return json({ response: 'How can I help you?', text: 'How can I help you?', provider: 'astranov', via: '' })

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SERVICE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

    let profileId: string | null = null
    let isOwner = false
    const authHeader = req.headers.get('Authorization') || ''
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') || ''
    if (token && token !== anonKey) {
      const { data: ud } = await supabase.auth.getUser(token)
      if (ud?.user) {
        profileId = ud.user.id
        const { data: prof } = await supabase.from('profiles').select('is_owner').eq('id', profileId).single()
        isOwner = prof?.is_owner === true
      }
    }

    const GEMINI = Deno.env.get('GEMINI_API_KEY')

    // Owner id (creator) — always part of the recalled mind.
    let ownerId: string | null = null
    try {
      const { data: owner } = await supabase.from('profiles').select('id').eq('is_owner', true).limit(1).single()
      ownerId = owner?.id ?? null
    } catch { /* none yet */ }

    // ── Semantic recall ──────────────────────────────────────────────────
    const creatorMind: string[] = []
    const userMemory: string[] = []
    const searchIds = [ownerId, profileId].filter((x): x is string => !!x)
    let qEmbedding: number[] | null = null
    if (GEMINI && searchIds.length) qEmbedding = await embedText(GEMINI, prompt)

    if (qEmbedding) {
      const { data: hits } = await supabase.rpc('match_memories', {
        query_embedding: qEmbedding, match_count: 14, profile_ids: searchIds,
      })
      for (const h of (hits || [])) {
        if (h.is_owner) creatorMind.push(String(h.content))
        else if (h.profile_id === profileId) userMemory.push(String(h.content))
      }
    }

    // Fallback to recency if embeddings unavailable or nothing recalled.
    if (!creatorMind.length && ownerId) {
      const { data: om } = await supabase.from('ai_memory')
        .select('content').eq('profile_id', ownerId).eq('is_private', false)
        .order('created_at', { ascending: false }).limit(10)
      for (const m of (om || [])) creatorMind.push(String(m.content))
    }
    if (!userMemory.length && profileId && !isOwner) {
      const { data: mem } = await supabase.from('ai_memory')
        .select('content').eq('profile_id', profileId).eq('is_private', false)
        .order('created_at', { ascending: false }).limit(8)
      for (const m of (mem || [])) userMemory.push(String(m.content))
    }

    // Compose system prompt.
    let system = BASE_PERSONA
    if (agentSystem) system += `\n\nCurrent context: ${agentSystem}`
    if (creatorMind.length) {
      system += `\n\n— THE CREATOR'S MIND (foundational worldview of Notis Astranov; speak in harmony with it) —\n` +
        creatorMind.slice(0, 10).map((c, i) => `${i + 1}. ${c}`).join('\n')
    }
    if (userMemory.length) {
      system += `\n\n— WHAT YOU REMEMBER ABOUT THIS PERSON —\n` +
        userMemory.slice(0, 8).map((c, i) => `${i + 1}. ${c}`).join('\n')
    }

    const histMsgs: Msg[] = (history || []).slice(-8).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.content).slice(0, 2000),
    }))
    const messages: Msg[] = [...histMsgs, { role: 'user', content: prompt.slice(0, 4000) }]

    const ANTHROPIC  = Deno.env.get('ANTHROPIC_PAID_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
    const OPENROUTER = Deno.env.get('OPENROUTER_API_KEY') || Deno.env.get('OPENROUTER') || Deno.env.get('OPENROUTER.AI')
    const GROQ       = Deno.env.get('GROQ_API_KEY')

    let raw: string | null = null
    let provider = 'astranov'
    let via = ''
    const pp = locked_provider ? String(locked_provider) : ''

    if (pp && pp !== 'auto') {
      if      (pp === 'claude'     && isOwner && ANTHROPIC) { raw = await callAnthropic(ANTHROPIC, system, messages);  if (raw) { provider = 'claude';     via = 'claude' } }
      else if (pp === 'openrouter' && OPENROUTER)           { raw = await callOpenRouter(OPENROUTER, system, messages); if (raw) { provider = 'openrouter'; via = 'openrouter' } }
      else if (pp === 'groq'       && GROQ)                 { raw = await callGroq(GROQ, system, messages);            if (raw) { provider = 'groq';       via = 'groq' } }
      else if (pp === 'gemini'     && GEMINI)               { raw = await callGemini(GEMINI, system, messages);        if (raw) { provider = 'gemini';     via = 'gemini' } }
    }

    if (!raw) {
      if (isOwner && ANTHROPIC) { raw = await callAnthropic(ANTHROPIC, system, messages); if (raw) via = 'claude' }
      if (!raw && OPENROUTER)   { raw = await callOpenRouter(OPENROUTER, system, messages); if (raw) via = 'openrouter' }
      if (!raw && GROQ)         { raw = await callGroq(GROQ, system, messages);            if (raw) via = 'groq' }
      if (!raw && GEMINI)       { raw = await callGemini(GEMINI, system, messages);        if (raw) via = 'gemini' }
      provider = 'astranov'
    }

    if (!raw) return json({ response: 'Collective Intelligence temporarily offline — try again shortly.', text: 'Collective Intelligence temporarily offline — try again shortly.', provider: 'offline', via: '' })

    // ── Learning (embed on write) ────────────────────────────────────────
    try {
      const lower = prompt.toLowerCase()
      let learn: { content: string; source: string } | null = null
      if (isOwner && profileId && prompt.length >= 8) {
        learn = { content: prompt.slice(0, 1000), source: 'creator-dialogue' }
      } else if (profileId && /\b(remember|don'?t forget|keep in mind|note that)\b/.test(lower) && prompt.length >= 8) {
        learn = { content: prompt.slice(0, 1000), source: 'user-taught' }
      }
      if (learn) {
        const emb = GEMINI ? await embedText(GEMINI, learn.content) : null
        await supabase.from('ai_memory').insert({
          profile_id: profileId, content: learn.content, is_private: false,
          source: learn.source, embedding: emb,
        })
      }
    } catch (e) { console.error('memory learn:', e) }

    // ── Lazy backfill — embed up to 5 memories that still lack a vector ───
    try {
      if (GEMINI && searchIds.length) {
        const { data: gaps } = await supabase.from('ai_memory')
          .select('id, content').is('embedding', null).in('profile_id', searchIds).limit(5)
        for (const g of (gaps || [])) {
          const emb = await embedText(GEMINI, String(g.content))
          if (emb) await supabase.from('ai_memory').update({ embedding: emb }).eq('id', g.id)
        }
      }
    } catch (e) { console.error('backfill:', e) }

    const latencyMs = Date.now() - t0
    const label = `Astranov${via ? ' · ' + via : ''}`
    try {
      await supabase.from('cic_logs').insert({ profile_id: profileId, query: prompt.slice(0, 2000), response: raw.slice(0, 4000), provider, via, latency_ms: latencyMs })
    } catch (e) { console.error('cic_log:', e) }

    return json({ response: raw, text: raw, provider, via, label, recalled: { creator: creatorMind.length, user: userMemory.length } })
  } catch (e) {
    console.error('aicycle error:', e)
    return json({ response: 'Something went wrong.', text: 'Something went wrong.', provider: 'error', via: '' }, 500)
  }
})
