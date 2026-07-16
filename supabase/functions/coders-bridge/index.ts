// Astranov Coders Bridge — Cursor Composer + Architect street-fix queue.
// Grok uses xAI via aci→aicycle. Composer / Grok Build pick up open summons.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient, SupabaseClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-coders-secret',
}

const ARCHITECT_EMAIL = 'notisastranov@gmail.com'

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

function bridgeSecret(req: Request) {
  const expected = Deno.env.get('CODERS_BRIDGE_SECRET') || ''
  if (!expected) return false
  return (req.headers.get('x-coders-secret') || '') === expected
}

async function resolveArchitect(req: Request, sb: SupabaseClient, anon: string) {
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '')
  if (!token || token === anon) {
    return { ok: false, error: 'login required — sign in as architect', userId: null as string | null, email: null as string | null }
  }
  const { data: ud } = await sb.auth.getUser(token)
  if (!ud?.user) return { ok: false, error: 'invalid session', userId: null, email: null }
  const email = (ud.user.email || '').toLowerCase()
  if (email !== ARCHITECT_EMAIL) {
    return { ok: false, error: 'architect only — notisastranov@gmail.com', userId: null, email }
  }
  return { ok: true, error: null, userId: ud.user.id, email, token }
}

function fieldContext(body: Record<string, unknown>) {
  const ctx = (body.context && typeof body.context === 'object') ? body.context as Record<string, unknown> : {}
  return {
    lat: typeof body.lat === 'number' ? body.lat : (typeof ctx.lat === 'number' ? ctx.lat : null),
    lng: typeof body.lng === 'number' ? body.lng : (typeof ctx.lng === 'number' ? ctx.lng : null),
    build: String(body.build || ctx.build || '').slice(0, 80),
    page: String(body.page || ctx.page || '').slice(0, 200),
    task: String(body.active_task || ctx.active_task || '').slice(0, 40),
    ua: String(body.ua || ctx.ua || '').slice(0, 120),
  }
}

async function notifyAgentWebhook(payload: Record<string, unknown>) {
  const url = Deno.env.get('CODERS_COMPOSER_WEBHOOK_URL') || Deno.env.get('GROK_BUILD_WEBHOOK_URL') || ''
  if (!url) return
  fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ ...payload, source: 'astranov-architect-bridge' }),
  }).catch(() => {})
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || ''
    const body = await req.json().catch(() => ({}))
    const mode = String(body.mode || 'pending')

    // ── Architect street-fix bridge (phone → desktop Grok Build) ──

    if (mode === 'architect_push') {
      const arch = await resolveArchitect(req, sb, anon)
      if (!arch.ok) return json({ error: arch.error }, arch.error === 'invalid session' ? 401 : 403)

      const task = String(body.task || body.message || '').trim().slice(0, 2000)
      if (task.length < 3) return json({ error: 'task required — e.g. fix locate button on mobile' }, 400)

      const field = fieldContext(body)
      const kind = String(body.kind || 'fix').slice(0, 24)

      const { data: qrow, error: qerr } = await sb.from('cic_queue').insert({
        user_id: arch.userId,
        question: task,
        context: {
          type: 'architect_bridge',
          source: 'streets',
          email: arch.email,
          kind,
          coder_engine: 'grok_build',
          field,
        },
        reason: 'architect_bridge',
        for_owner: true,
        status: 'open',
      }).select('id, created_at').single()

      if (qerr || !qrow?.id) return json({ error: qerr?.message || 'queue insert failed' }, 500)

      await notifyAgentWebhook({
        mode: 'architect_push',
        summon_id: qrow.id,
        task,
        kind,
        email: arch.email,
        field,
      })

      return json({
        ok: true,
        armed: true,
        summon_id: qrow.id,
        bridge: 'grok_build',
        label: 'Architect Bridge · Grok Build',
        hint: 'Desktop agent will pick up #' + qrow.id + ' — say bridge poll',
        field,
      })
    }

    if (mode === 'architect_poll') {
      const arch = await resolveArchitect(req, sb, anon)
      if (!arch.ok) return json({ error: arch.error }, 401)

      const summonId = body.summon_id ?? body.id
      if (summonId) {
        const { data, error } = await sb.from('cic_queue')
          .select('id, question, status, answer, created_at, answered_at, context')
          .eq('id', summonId)
          .eq('reason', 'architect_bridge')
          .eq('user_id', arch.userId!)
          .single()
        if (error || !data) return json({ error: 'summon not found' }, 404)
        const answered = data.status === 'answered' && data.answer
        return json({
          ok: true,
          summon_id: data.id,
          status: data.status,
          pending: data.status === 'open' || data.status === 'in_progress',
          text: answered ? String(data.answer) : '',
          response: answered ? String(data.answer) : '',
          question: data.question,
          label: answered ? 'Architect Bridge · answered' : 'Architect Bridge · waiting',
        })
      }

      const limit = Math.min(20, Number(body.limit) || 10)
      const { data, error } = await sb.from('cic_queue')
        .select('id, question, status, answer, created_at, answered_at, context')
        .eq('reason', 'architect_bridge')
        .eq('user_id', arch.userId!)
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, summons: data || [], count: (data || []).length })
    }

    if (mode === 'architect_pending') {
      if (!bridgeSecret(req)) return json({ error: 'unauthorized — set CODERS_BRIDGE_SECRET' }, 401)
      const limit = Math.min(30, Number(body.limit) || 15)
      const { data, error } = await sb.from('cic_queue')
        .select('id, question, status, created_at, context, user_id')
        .eq('reason', 'architect_bridge')
        .in('status', ['open', 'in_progress'])
        .order('created_at', { ascending: true })
        .limit(limit)
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, pending: data || [], count: (data || []).length, bridge: 'architect' })
    }

    if (mode === 'architect_ack') {
      if (!bridgeSecret(req)) return json({ error: 'unauthorized' }, 401)
      const summonId = body.summon_id ?? body.id
      if (!summonId) return json({ error: 'summon_id required' }, 400)
      const { data: row } = await sb.from('cic_queue').select('context').eq('id', summonId).eq('reason', 'architect_bridge').single()
      const prev = (row?.context && typeof row.context === 'object') ? row.context as Record<string, unknown> : {}
      const { data, error } = await sb.from('cic_queue').update({
        status: 'in_progress',
        context: { ...prev, acked_at: new Date().toISOString(), agent: body.agent || 'grok_build' },
      }).eq('id', summonId).eq('reason', 'architect_bridge').select('id, status').single()
      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, summon_id: summonId, status: data?.status || 'in_progress' })
    }

    if (mode === 'architect_answer') {
      if (!bridgeSecret(req)) return json({ error: 'unauthorized — set CODERS_BRIDGE_SECRET' }, 401)
      const summonId = body.summon_id ?? body.id
      const answer = String(body.answer || body.text || '').trim()
      if (!summonId || answer.length < 1) return json({ error: 'summon_id and answer required' }, 400)

      const { data, error } = await sb.from('cic_queue').update({
        status: 'answered',
        answer: answer.slice(0, 8000),
        answered_at: new Date().toISOString(),
      }).eq('id', summonId).eq('reason', 'architect_bridge').select('id, question, status').single()

      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, summon_id: summonId, answered: true, row: data, bridge: 'architect' })
    }

    // ── Composer queue (existing) ──

    if (mode === 'register') {
      const summonId = body.summon_id
      const task = String(body.task || '').slice(0, 2000)
      if (!summonId || !task) return json({ error: 'summon_id and task required' }, 400)

      const external = Deno.env.get('CODERS_COMPOSER_WEBHOOK_URL')
      if (external) {
        fetch(external, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            summon_id: summonId,
            task,
            coder_engine: 'composer',
            source: 'astranov-coders-bridge',
            user_id: body.user_id,
            email: body.email,
          }),
        }).catch(() => {})
      }

      return json({
        ok: true,
        registered: true,
        summon_id: summonId,
        engine: 'composer',
        label: 'Astranov Coders · Cursor Composer',
        hint: 'Cursor Composer picks up open summons — coders poll ' + summonId,
      })
    }

    if (mode === 'answer') {
      if (!bridgeSecret(req)) return json({ error: 'unauthorized — set CODERS_BRIDGE_SECRET' }, 401)
      const summonId = body.summon_id ?? body.id
      const answer = String(body.answer || body.text || '').trim()
      if (!summonId || answer.length < 1) return json({ error: 'summon_id and answer required' }, 400)

      const { data, error } = await sb.from('cic_queue').update({
        status: 'answered',
        answer: answer.slice(0, 8000),
        answered_at: new Date().toISOString(),
      }).eq('id', summonId).eq('reason', 'coder_summon').select('id, question, status').single()

      if (error) return json({ error: error.message }, 500)
      return json({ ok: true, summon_id: summonId, answered: true, row: data })
    }

    if (mode === 'status') {
      const summonId = body.summon_id ?? body.id
      if (!summonId) return json({ error: 'summon_id required' }, 400)
      const { data, error } = await sb.from('cic_queue')
        .select('id, question, status, answer, created_at, answered_at, context')
        .eq('id', summonId)
        .eq('reason', 'coder_summon')
        .single()
      if (error || !data) return json({ error: 'summon not found' }, 404)
      return json({ ok: true, summon: data })
    }

    if (mode === 'pending') {
      const limit = Math.min(30, Number(body.limit) || 15)
      const { data, error } = await sb.from('cic_queue')
        .select('id, question, status, created_at, context, user_id')
        .eq('reason', 'coder_summon')
        .eq('status', 'open')
        .order('created_at', { ascending: false })
        .limit(limit)
      if (error) return json({ error: error.message, hint: 'ensure cic_queue table exists' }, 500)
      const open = (data || []).filter((r) => {
        const ctx = r.context as { coder_engine?: string } | null
        return ctx?.coder_engine === 'composer' || !ctx?.coder_engine
      })
      return json({ ok: true, pending: open, count: open.length })
    }

    return json({
      error: 'unknown mode',
      modes: [
        'register', 'answer', 'status', 'pending',
        'architect_push', 'architect_poll', 'architect_pending', 'architect_ack', 'architect_answer',
      ],
      note: 'Composer = Cursor. architect_* = Grok Build street-fix bridge.',
    }, 400)
  } catch (e) {
    return json({ error: String(e) }, 500)
  }
})