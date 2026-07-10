// order-intake: orders · driver assign/accept · instant AVC payouts · channel manager

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

type DriverPick = { id: string; name: string; emoji: string; self?: boolean; field_lat?: number; field_lng?: number }

async function authUserId(req: Request): Promise<string | null> {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return null
  const anonSb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { authorization: auth } }, auth: { persistSession: false } },
  )
  const { data: { user } } = await anonSb.auth.getUser()
  return user?.id ?? null
}

async function pickDriver(
  sb: ReturnType<typeof createClient>,
  deliveryLat: number | null,
  deliveryLng: number | null,
  customerId: string | null,
  preferredId?: string | null,
): Promise<DriverPick | null> {
  if (preferredId) {
    const { data: pref } = await sb.from('profiles')
      .select('id, display_name, avatar_emoji, field_lat, field_lng, roles')
      .eq('id', preferredId)
      .maybeSingle()
    if (pref?.roles?.includes?.('driver') || pref) {
      return {
        id: pref.id,
        name: pref.display_name || 'Driver',
        emoji: pref.avatar_emoji || '🚚',
        field_lat: pref.field_lat ?? undefined,
        field_lng: pref.field_lng ?? undefined,
      }
    }
  }

  const since = new Date(Date.now() - 30 * 60 * 1000).toISOString()
  const { data: online } = await sb.from('profiles')
    .select('id, display_name, avatar_emoji, field_lat, field_lng, roles')
    .contains('roles', ['driver'])
    .gte('field_seen_at', since)
    .not('field_lat', 'is', null)
    .limit(40)

  const pool = (online || []).filter(p => p.id !== customerId)
  if (deliveryLat != null && deliveryLng != null && pool.length) {
    pool.sort((a, b) => {
      const da = haversineM(deliveryLat, deliveryLng, a.field_lat!, a.field_lng!)
      const db = haversineM(deliveryLat, deliveryLng, b.field_lat!, b.field_lng!)
      return da - db
    })
    const d = pool[0]
    return { id: d.id, name: d.display_name || 'Driver', emoji: d.avatar_emoji || '🚚', field_lat: d.field_lat!, field_lng: d.field_lng! }
  }
  if (pool.length) {
    const d = pool[0]
    return { id: d.id, name: d.display_name || 'Driver', emoji: d.avatar_emoji || '🚚', field_lat: d.field_lat!, field_lng: d.field_lng! }
  }
  return null
}

async function creditUser(sb: ReturnType<typeof createClient>, uid: string, delta: number) {
  if (!uid || !delta) return
  await sb.rpc('add_balance', { uid, delta }).catch(() => {})
}

async function payoutOnAccept(
  sb: ReturnType<typeof createClient>,
  order: Record<string, unknown>,
  vendor: { id: string; name: string; owner_id?: string | null },
) {
  const calc = (order.calc || {}) as Record<string, number>
  const total = Number(calc.total_avc) || 0
  const deliveryEur = Number(calc.delivery_eur) || Number(calc.delivery_avc) || 0
  const goodsEur = Number(calc.goods_eur) || Math.max(0, total - deliveryEur)
  const driverPay = Number(calc.driver_payout_eur) || Math.round(deliveryEur * 0.85 * 100) / 100
  const vendorPay = Math.round(goodsEur * 0.97 * 100) / 100
  const vendorOwner = vendor.owner_id
  const driverId = order.driver_id as string | undefined

  if (vendorOwner && vendorPay > 0) await creditUser(sb, vendorOwner, vendorPay)
  if (driverId && driverPay > 0) await creditUser(sb, driverId, driverPay)

  return { vendorPay, driverPay, vendorOwner, driverId }
}

async function handleAssignDriver(sb: ReturnType<typeof createClient>, body: Record<string, unknown>, userId: string | null) {
  const orderId = String(body.order_id || '')
  const driverId = String(body.driver_id || '')
  if (!orderId || !driverId) {
    return new Response(JSON.stringify({ error: 'order_id and driver_id required' }), { status: 400, headers: cors })
  }
  const { data: order } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (!order) return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: cors })

  const { data: driver } = await sb.from('profiles')
    .select('id, display_name, avatar_emoji, field_lat, field_lng')
    .eq('id', driverId)
    .maybeSingle()

  const { data: updated, error } = await sb.from('orders').update({
    driver_id: driverId,
    driver_name: driver?.display_name || 'Driver',
    driver_emoji: driver?.avatar_emoji || '🚚',
    status: 'assigned',
    driver_accepted_at: null,
    updated_at: new Date().toISOString(),
  }).eq('id', orderId).select().single()

  if (error) throw error
  return new Response(JSON.stringify({
    ok: true,
    order: updated,
    driver,
    awaiting_accept: true,
    actor: userId,
  }), { headers: cors })
}

async function handleDriverAccept(sb: ReturnType<typeof createClient>, body: Record<string, unknown>, userId: string | null) {
  const orderId = String(body.order_id || body.short_id || '').trim()
  if (!orderId || !userId) {
    return new Response(JSON.stringify({ error: 'login and order_id required' }), { status: 401, headers: cors })
  }

  const isUuid = /^[0-9a-f-]{36}$/i.test(orderId)
  let q = sb.from('orders').select('*')
  q = isUuid ? q.eq('id', orderId) : q.eq('short_id', orderId.toUpperCase())
  const { data: order } = await q.maybeSingle()
  if (!order) return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: cors })

  if (order.driver_id && order.driver_id !== userId) {
    return new Response(JSON.stringify({ error: 'not_assigned_driver' }), { status: 403, headers: cors })
  }

  if (!order.driver_id) {
    const driver = await pickDriver(sb, order.delivery_lat, order.delivery_lng, order.customer_id, userId)
    if (!driver || driver.id !== userId) {
      return new Response(JSON.stringify({ error: 'claim_requires_assignment' }), { status: 400, headers: cors })
    }
    order.driver_id = driver.id
    order.driver_name = driver.name
    order.driver_emoji = driver.emoji
  }

  const { data: vendor } = await sb.from('vendors').select('id, name, lat, lng, owner_id').eq('id', order.vendor_id).maybeSingle()
  const { data: driverProf } = await sb.from('profiles')
    .select('id, display_name, avatar_emoji, field_lat, field_lng')
    .eq('id', order.driver_id)
    .maybeSingle()

  const now = new Date().toISOString()
  const payouts = order.driver_accepted_at ? null : await payoutOnAccept(sb, order, vendor || { id: order.vendor_id, name: 'Vendor' })

  const { data: updated, error } = await sb.from('orders').update({
    driver_id: order.driver_id,
    driver_name: order.driver_name || driverProf?.display_name,
    driver_emoji: order.driver_emoji || driverProf?.avatar_emoji,
    status: 'active',
    driver_accepted_at: order.driver_accepted_at || now,
    updated_at: now,
    calc: {
      ...(order.calc || {}),
      ...(payouts ? { vendor_credited: payouts.vendorPay, driver_credited: payouts.driverPay, credited_at: now } : {}),
    },
  }).eq('id', order.id).select().single()

  if (error) throw error

  await sb.from('field_events').insert({
    user_id: userId,
    role: 'driver',
    action: 'driver_accept',
    detail: `accepted ${order.short_id || order.id}`,
    lat: order.delivery_lat,
    lng: order.delivery_lng,
    props: { order_id: order.id, payouts },
    brain_synced: true,
  }).catch(() => {})

  return new Response(JSON.stringify({
    ok: true,
    order: updated,
    vendor,
    driver: driverProf,
    payouts,
    triangle_active: true,
  }), { headers: cors })
}

async function handleComplete(sb: ReturnType<typeof createClient>, body: Record<string, unknown>, userId: string | null) {
  const orderId = String(body.order_id || '')
  if (!orderId || !userId) {
    return new Response(JSON.stringify({ error: 'login and order_id required' }), { status: 401, headers: cors })
  }
  const { data: order } = await sb.from('orders').select('*').eq('id', orderId).maybeSingle()
  if (!order) return new Response(JSON.stringify({ error: 'order_not_found' }), { status: 404, headers: cors })
  if (order.driver_id !== userId) {
    return new Response(JSON.stringify({ error: 'driver_only' }), { status: 403, headers: cors })
  }

  const { data: updated, error } = await sb.from('orders').update({
    status: 'delivered',
    delivered_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }).eq('id', orderId).select().single()

  if (error) throw error
  return new Response(JSON.stringify({ ok: true, order: updated }), { headers: cors })
}

async function handleChannelImport(sb: ReturnType<typeof createClient>, body: Record<string, unknown>) {
  const channel = String(body.channel || 'custom')
  const externalId = String(body.external_id || '')
  if (!externalId) {
    return new Response(JSON.stringify({ error: 'external_id required' }), { status: 400, headers: cors })
  }
  return new Response(JSON.stringify({
    ok: true,
    channel,
    external_id: externalId,
    message: 'Channel route registered — unify via MarketplaceDeliveryEngine',
    unified: true,
  }), { headers: cors })
}

async function handleCreateOrder(sb: ReturnType<typeof createClient>, body: Record<string, unknown>, customerId: string | null) {
  const { vendor_id, items, calc, delivery_lat, delivery_lng, delivery_address, notes, pay_with_balance, preferred_driver_id, channel } = body

  if (!vendor_id || !Array.isArray(items) || items.length === 0) {
    return new Response(JSON.stringify({ error: 'vendor_id and items required' }), { status: 400, headers: cors })
  }

  const { data: vendor, error: vErr } = await sb.from('vendors')
    .select('id, name, lat, lng, items, is_active, owner_id')
    .eq('id', vendor_id)
    .single()

  if (vErr || !vendor) {
    return new Response(JSON.stringify({ error: 'vendor_not_found' }), { status: 404, headers: cors })
  }
  if (!vendor.is_active) {
    return new Response(JSON.stringify({ error: 'vendor_inactive' }), { status: 400, headers: cors })
  }

  const menuItems = Array.isArray(vendor.items)
    ? vendor.items.filter((i: { name?: string }) => i && String(i.name || '').trim())
    : []
  if (!menuItems.length) {
    return new Response(JSON.stringify({
      error: 'vendor_menu_empty',
      message: 'This vendor has not set a menu yet. Request the menu first.',
      vendor_name: vendor.name,
    }), { status: 400, headers: cors })
  }

  const menuByName = new Map(menuItems.map((i: { name: string; price?: number }) => [
    String(i.name).trim().toLowerCase(),
    i,
  ]))
  for (const item of items) {
    const key = String((item as { name?: string })?.name || '').trim().toLowerCase()
    if (!menuByName.get(key)) {
      return new Response(JSON.stringify({
        error: 'invalid_menu_item',
        message: `Item not on vendor menu: ${(item as { name?: string })?.name || '?'}`,
      }), { status: 400, headers: cors })
    }
  }

  const dLat = typeof delivery_lat === 'number' ? delivery_lat : null
  const dLng = typeof delivery_lng === 'number' ? delivery_lng : null
  const driver = await pickDriver(sb, dLat, dLng, customerId, preferred_driver_id as string | null)

  const totalAvc = typeof (calc as Record<string, number>)?.total_avc === 'number'
    ? (calc as Record<string, number>).total_avc
    : (items as Array<{ qty?: number; price?: number }>).reduce(
      (s, i) => s + (i.qty || 1) * (i.price || 0), 0,
    )

  let balanceAfter: number | null = null
  let paid = false
  if (pay_with_balance) {
    if (!customerId) {
      return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
    }
    const { data: ledger } = await sb.from('balance_ledger').select('balance').eq('user_id', customerId).maybeSingle()
    let balance = Number(ledger?.balance) || 0
    if (!ledger) {
      const { data: prof } = await sb.from('profiles').select('balance').eq('id', customerId).single()
      balance = Number(prof?.balance) || 0
    }
    if (balance < totalAvc) {
      return new Response(JSON.stringify({
        error: 'insufficient_balance',
        balance,
        needed: totalAvc,
      }), { status: 402, headers: cors })
    }
    const { error: payErr } = await sb.rpc('add_balance', { uid: customerId, delta: -totalAvc })
    if (payErr) throw payErr
    balanceAfter = balance - totalAvc
    paid = true
  }

  const calcOut = {
    ...(calc as object ?? {}),
    total_avc: totalAvc,
    ...(paid ? { paid: true, paid_at: new Date().toISOString(), balance_after: balanceAfter } : {}),
  }

  const row: Record<string, unknown> = {
    vendor_id,
    customer_id: customerId,
    items,
    calc: calcOut,
    status: driver ? 'assigned' : 'seeking_driver',
    delivery_lat: dLat,
    delivery_lng: dLng,
    delivery_address: delivery_address ?? null,
    notes: notes ?? null,
    channel: channel ?? null,
    driver_accepted_at: null,
  }
  if (driver) {
    row.driver_id = driver.id
    row.driver_name = driver.name
    row.driver_emoji = driver.emoji
  }

  const { data: order, error } = await sb.from('orders').insert(row).select().single()
  if (error) throw error

  if (paid && customerId) {
    await sb.from('invoices').insert({
      id: 'INV-' + String(order.short_id || order.id).replace(/^ORD-/, ''),
      order_id: String(order.id),
      vendor_name: vendor.name,
      buyer_id: customerId,
      items,
      subtotal: totalAvc,
      total: totalAvc,
      currency: 'AVC',
      status: 'paid',
    }).catch(() => {})
  }

  if (customerId) {
    await sb.from('field_events').insert({
      user_id: customerId,
      role: 'client',
      action: 'order',
      detail: `order ${order.short_id} vendor ${vendor_id}`,
      lat: dLat,
      lng: dLng,
      props: { order_id: order.id, vendor_id, driver_id: driver?.id || null, awaiting_driver_accept: !!driver },
      brain_synced: true,
    }).catch(() => {})
  }
  if (driver) {
    await sb.from('field_events').insert({
      user_id: driver.id,
      role: 'driver',
      action: 'order_assigned',
      detail: `assigned ${order.short_id} — accept to activate triangle`,
      lat: dLat,
      lng: dLng,
      props: { order_id: order.id, assigned: true, must_accept: true },
      brain_synced: true,
    }).catch(() => {})
  }

  try {
    const ch = sb.channel(`vendor-orders-${vendor_id}`)
    await ch.send({
      type: 'broadcast',
      event: 'new_order',
      payload: {
        order_id: order.id,
        short_id: order.short_id,
        items,
        calc,
        driver: driver ? { id: driver.id, name: driver.name, emoji: driver.emoji } : null,
        seeking_driver: !driver,
        awaiting_accept: !!driver,
      },
    })
    await sb.removeChannel(ch)
  } catch { /* non-fatal */ }

  return new Response(JSON.stringify({
    ok: true,
    order,
    vendor,
    driver: driver ? { id: driver.id, name: driver.name, emoji: driver.emoji, field_lat: driver.field_lat, field_lng: driver.field_lng, self: !!driver.self } : null,
    seeking_driver: !driver,
    awaiting_accept: !!driver,
    triangle_active: false,
    paid,
    paid_amount: paid ? totalAvc : null,
    balance_after: balanceAfter,
    multi_role: true,
    decentralized: true,
  }), { headers: cors })
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const userId = await authUserId(req)
    const body = await req.json().catch(() => ({})) as Record<string, unknown>
    const action = String(body.action || 'create').toLowerCase()

    if (action === 'assign_driver') return await handleAssignDriver(sb, body, userId)
    if (action === 'driver_accept') return await handleDriverAccept(sb, body, userId)
    if (action === 'complete' || action === 'driver_complete') return await handleComplete(sb, body, userId)
    if (action === 'channel_import') return await handleChannelImport(sb, body)
    return await handleCreateOrder(sb, body, userId)
  } catch (e) {
    const err = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e)
    return new Response(JSON.stringify({ ok: false, error: err }), { status: 500, headers: cors })
  }
})