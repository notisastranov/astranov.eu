// avc-ledger — transparent Astranov Value Coin (1 AVC = 1 EUR peg, work-mint only)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function userFrom(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { authorization: auth } }, auth: { persistSession: false } },
  )
  const { data: { user } } = await sb.auth.getUser()
  return user
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {}
    const mode = String(body.mode || 'constitution')
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (mode === 'constitution') {
      const { data } = await sb.from('avc_constitution').select('*').eq('id', 1).maybeSingle()
      return new Response(JSON.stringify({
        ok: true,
        coin: 'AVC',
        peg_eur: Number(data?.peg_eur ?? 1),
        motto: data?.motto ?? 'Justice → Truth → Freedom',
        mint_rule: data?.mint_rule,
        transparent: true,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    const user = await userFrom(req)

    if (mode === 'balance') {
      if (!user) return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
      const { data: bal } = await sb.from('balance_ledger').select('balance').eq('user_id', user.id).maybeSingle()
      const { data: constitution } = await sb.from('avc_constitution').select('peg_eur').eq('id', 1).maybeSingle()
      const avc = Number(bal?.balance ?? 0)
      const peg = Number(constitution?.peg_eur ?? 1)
      return new Response(JSON.stringify({
        ok: true,
        avc,
        eur_equivalent: Math.round(avc * peg * 100) / 100,
        peg_eur: peg,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (mode === 'ledger' || mode === 'transparency') {
      const limit = Math.min(200, Math.max(1, Number(body.limit) || 40))
      let q = sb.from('avc_ledger')
        .select('seq,created_at,user_id,delta_avc,balance_after,work_type,work_proof,order_id,public_note,entry_hash')
        .order('seq', { ascending: false })
        .limit(limit)

      if (user && !body.all) {
        q = q.or(`user_id.eq.${user.id},counterparty_id.eq.${user.id}`)
      } else if (!user) {
        q = q.eq('auditor_visible', true).limit(Math.min(limit, 20))
      }

      const { data: rows, error } = await q
      if (error) throw error

      const { count } = await sb.from('avc_ledger').select('*', { count: 'exact', head: true })
      const { data: constitution } = await sb.from('avc_constitution').select('*').eq('id', 1).maybeSingle()

      return new Response(JSON.stringify({
        ok: true,
        total_entries: count ?? rows?.length ?? 0,
        peg_eur: Number(constitution?.peg_eur ?? 1),
        motto: constitution?.motto,
        entries: rows ?? [],
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    if (mode === 'mint_work') {
      if (!user) return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
      const amount = Number(body.amount)
      const workType = String(body.work_type || '').trim()
      if (!amount || amount <= 0 || amount > 50000) {
        return new Response(JSON.stringify({ error: 'invalid_amount' }), { status: 400, headers: cors })
      }
      const allowed = ['specialist_service', 'coders_build', 'vendor_sale', 'manual_adjust']
      if (!allowed.includes(workType)) {
        return new Response(JSON.stringify({ error: 'work_type_not_allowed', allowed }), { status: 400, headers: cors })
      }
      const { data: prof } = await sb.from('profiles').select('roles').eq('id', user.id).maybeSingle()
      const roles: string[] = Array.isArray(prof?.roles) ? prof.roles : []
      const email = (user.email || '').toLowerCase()
      const isStaff = roles.includes('admin') || roles.includes('architect')
        || email === 'notisastranov@gmail.com'
      if (workType === 'manual_adjust' && !isStaff) {
        return new Response(JSON.stringify({ error: 'staff_only' }), { status: 403, headers: cors })
      }

      const { data: id, error } = await sb.rpc('avc_ledger_append', {
        p_user_id: user.id,
        p_delta: amount,
        p_work_type: workType,
        p_work_proof: body.work_proof ?? { note: body.note, by: user.id },
        p_public_note: body.note ?? `Work mint · ${workType}`,
      })
      if (error) throw error
      return new Response(JSON.stringify({ ok: true, ledger_id: id, minted: amount }), { headers: cors })
    }

    if (mode === 'verify_chain') {
      const { data: rows } = await sb.from('avc_ledger')
        .select('seq,prev_hash,entry_hash,delta_avc,work_type')
        .order('seq', { ascending: true })
        .limit(500)
      let ok = true
      let prev = 'genesis'
      for (const r of rows ?? []) {
        if (r.prev_hash !== prev) { ok = false; break }
        prev = r.entry_hash
      }
      return new Response(JSON.stringify({
        ok: true,
        chain_valid: ok,
        checked: rows?.length ?? 0,
      }), { headers: { ...cors, 'Content-Type': 'application/json' } })
    }

    return new Response(JSON.stringify({ error: 'unknown_mode', modes: ['constitution', 'balance', 'ledger', 'transparency', 'mint_work', 'verify_chain'] }), { status: 400, headers: cors })
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: cors })
  }
})