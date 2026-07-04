// auditor-api — financial dashboard for auditors.astranov.eu
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

async function callerFrom(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return { id: null as string | null, email: '', ok: false }
  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { authorization: auth } }, auth: { persistSession: false } },
  )
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { id: null, email: '', ok: false }
  const { data: prof } = await sb.from('profiles').select('id,email,roles,display_name').eq('id', user.id).maybeSingle()
  const roles = Array.isArray(prof?.roles) ? prof.roles : []
  const email = (prof?.email || user.email || '').toLowerCase()
  const ok = email === 'notisastranov@gmail.com'
    || roles.includes('auditor')
    || roles.includes('accountant')
    || roles.includes('admin')
  return { id: user.id, email, ok, name: prof?.display_name || email }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  try {
    const caller = await callerFrom(req)
    if (!caller.ok) return new Response(JSON.stringify({ error: 'auditor_access_required' }), { status: 403, headers: cors })

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )
    const body = await req.json().catch(() => ({}))
    const mode = String(body.mode || 'dashboard')

    const from = body.from ? String(body.from) : null
    const to = body.to ? String(body.to) : null
    const vendorId = body.vendor_id || null
    const driverId = body.driver_id || null

    const dateFilter = (q: ReturnType<typeof sb.from>, col: string) => {
      if (from) q = q.gte(col, from)
      if (to) q = q.lte(col, to + 'T23:59:59')
      return q
    }

    if (mode === 'dashboard') {
      let oq = sb.from('orders').select('id,status,calc,created_at,vendor_id,driver_id', { count: 'exact' })
      oq = dateFilter(oq, 'created_at')
      const { data: orders, count: orderCount } = await oq.order('created_at', { ascending: false }).limit(500)

      let iq = sb.from('invoices').select('id,total,subtotal,delivery_fee,platform_fee,status,period_month,created_at', { count: 'exact' })
      iq = dateFilter(iq, 'created_at')
      const { data: invoices, count: invoiceCount } = await iq.order('created_at', { ascending: false }).limit(500)

      const goods = (orders || []).reduce((s, o) => s + Number((o.calc as Record<string, unknown>)?.goods_eur ?? (o.calc as Record<string, unknown>)?.subtotal_eur ?? 0), 0)
      const delivery = (orders || []).reduce((s, o) => s + Number((o.calc as Record<string, unknown>)?.delivery_eur ?? 0), 0)
      const platform = (orders || []).reduce((s, o) => s + Number((o.calc as Record<string, unknown>)?.platform_fee_eur ?? 0), 0)
      const paidInvoices = (invoices || []).filter(i => i.status === 'issued' || i.status === 'paid').length
      const pendingInvoices = (invoices || []).filter(i => !['issued', 'paid', 'submitted'].includes(String(i.status))).length

      let pq = sb.from('field_events').select('id,detail,props,created_at,user_id').eq('action', 'payout')
      pq = dateFilter(pq, 'created_at')
      const { data: payouts } = await pq.order('created_at', { ascending: false }).limit(200)
      const driverPayouts = (payouts || []).reduce((s, p) => s + Number((p.props as Record<string, unknown>)?.payout_eur ?? 0), 0)

      return new Response(JSON.stringify({
        ok: true,
        kpis: {
          orders: orderCount ?? orders?.length ?? 0,
          invoices: invoiceCount ?? invoices?.length ?? 0,
          goods_eur: Math.round(goods * 100) / 100,
          delivery_eur: Math.round(delivery * 100) / 100,
          platform_eur: Math.round(platform * 100) / 100,
          driver_payouts_eur: Math.round(driverPayouts * 100) / 100,
          invoices_sent: paidInvoices,
          invoices_pending: pendingInvoices,
        },
        recent_orders: (orders || []).slice(0, 12),
        recent_invoices: (invoices || []).slice(0, 12),
      }), { headers: cors })
    }

    if (mode === 'orders') {
      let q = sb.from('orders').select('*, vendors(name)')
      q = dateFilter(q, 'created_at')
      if (vendorId) q = q.eq('vendor_id', vendorId)
      if (driverId) q = q.eq('driver_id', driverId)
      const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return new Response(JSON.stringify({ ok: true, rows: data || [] }), { headers: cors })
    }

    if (mode === 'invoices') {
      let q = sb.from('invoices').select('*')
      q = dateFilter(q, 'created_at')
      if (body.period_month) q = q.eq('period_month', body.period_month)
      if (vendorId) q = q.ilike('vendor_name', '%' + String(vendorId) + '%')
      const { data, error } = await q.order('created_at', { ascending: false }).limit(200)
      if (error) throw error
      return new Response(JSON.stringify({ ok: true, rows: data || [] }), { headers: cors })
    }

    if (mode === 'payments') {
      let oq = sb.from('orders').select('id,short_id,vendor_id,driver_id,driver_name,calc,status,created_at,items')
      oq = dateFilter(oq, 'created_at')
      if (vendorId) oq = oq.eq('vendor_id', vendorId)
      if (driverId) oq = oq.eq('driver_id', driverId)
      const { data: orders } = await oq.order('created_at', { ascending: false }).limit(150)

      let pq = sb.from('field_events').select('*').in('action', ['payout', 'pay', 'order'])
      pq = dateFilter(pq, 'created_at')
      if (driverId) pq = pq.eq('user_id', driverId)
      const { data: events } = await pq.order('created_at', { ascending: false }).limit(150)

      const { data: vendors } = await sb.from('vendors').select('id,name').eq('is_active', true).order('name')
      const since = new Date(Date.now() - 7 * 86400000).toISOString()
      const { data: drivers } = await sb.from('profiles')
        .select('id,display_name,avatar_emoji')
        .contains('roles', ['driver'])
        .gte('field_seen_at', since)
        .limit(80)

      return new Response(JSON.stringify({
        ok: true,
        orders: orders || [],
        events: events || [],
        vendors: vendors || [],
        drivers: drivers || [],
      }), { headers: cors })
    }

    if (mode === 'avc_ledger' || mode === 'avc') {
      let lq = sb.from('avc_ledger')
        .select('seq,created_at,user_id,delta_avc,balance_after,work_type,order_id,public_note,entry_hash,prev_hash')
      lq = dateFilter(lq, 'created_at')
      const { data: rows, error } = await lq.order('seq', { ascending: false }).limit(300)
      if (error) throw error

      const { data: constitution } = await sb.from('avc_constitution').select('*').eq('id', 1).maybeSingle()
      const peg = Number(constitution?.peg_eur ?? 1)
      const minted = (rows || []).filter(r => Number(r.delta_avc) > 0)
        .reduce((s, r) => s + Number(r.delta_avc), 0)
      const spent = (rows || []).filter(r => Number(r.delta_avc) < 0)
        .reduce((s, r) => s + Math.abs(Number(r.delta_avc)), 0)
      const byWork: Record<string, number> = {}
      for (const r of rows || []) {
        const wt = String(r.work_type || 'unknown')
        byWork[wt] = (byWork[wt] || 0) + Number(r.delta_avc)
      }

      let chainValid = true
      let prev = 'genesis'
      const asc = [...(rows || [])].sort((a, b) => Number(a.seq) - Number(b.seq))
      for (const r of asc) {
        if (r.prev_hash !== prev) { chainValid = false; break }
        prev = String(r.entry_hash)
      }

      return new Response(JSON.stringify({
        ok: true,
        peg_eur: peg,
        motto: constitution?.mint_rule,
        chain_valid: chainValid,
        kpis: {
          entries: rows?.length ?? 0,
          minted_avc: Math.round(minted * 100) / 100,
          spent_avc: Math.round(spent * 100) / 100,
          minted_eur: Math.round(minted * peg * 100) / 100,
        },
        by_work_type: byWork,
        rows: rows || [],
      }), { headers: cors })
    }

    if (mode === 'vendors' || mode === 'drivers') {
      if (mode === 'vendors') {
        const { data } = await sb.from('vendors').select('id,name,category,lat,lng,is_active').order('name')
        return new Response(JSON.stringify({ ok: true, rows: data || [] }), { headers: cors })
      }
      const since = new Date(Date.now() - 30 * 86400000).toISOString()
      const { data } = await sb.from('profiles')
        .select('id,display_name,avatar_emoji,field_lat,field_lng,field_seen_at')
        .contains('roles', ['driver'])
        .gte('field_seen_at', since)
        .order('display_name')
      return new Response(JSON.stringify({ ok: true, rows: data || [] }), { headers: cors })
    }

    return new Response(JSON.stringify({ error: 'unknown_mode' }), { status: 400, headers: cors })
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message || e) }), { status: 500, headers: cors })
  }
})