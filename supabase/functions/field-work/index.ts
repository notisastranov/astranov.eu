// field-work — post availability · specialties · offers with full pricing · open verticals

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

const VERTICALS = new Set(['work', 'delivery', 'dating', 'real_estate', 'services', 'custom'])
const POST_TYPES = new Set(['availability', 'offer', 'request'])

async function userClient(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (!auth.startsWith('Bearer ')) return { userId: null as string | null, sb: null }
  const sb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { authorization: auth } }, auth: { persistSession: false } },
  )
  const { data: { user } } = await sb.auth.getUser()
  return { userId: user?.id ?? null, sb }
}

function normVertical(v: string | undefined) {
  const x = String(v || 'work').toLowerCase().replace(/\s+/g, '_')
  return VERTICALS.has(x) ? x : 'work'
}

function enrichPrice(row: Record<string, unknown>) {
  const avc = row.price_avc != null ? Number(row.price_avc) : null
  const eur = row.price_eur != null ? Number(row.price_eur) : (avc != null ? avc : null)
  return { ...row, price_eur: eur, price_avc: avc }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'POST only' }), { status: 405, headers: cors })

  const body = await req.json().catch(() => ({}))
  const action = String(body.action || 'list_nearby')
  const { userId, sb } = await userClient(req)
  const serviceSb = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } },
  )
  const db = sb || serviceSb

  if (action === 'post') {
    if (!userId || !sb) return new Response(JSON.stringify({ error: 'login required' }), { status: 401, headers: cors })
    const postType = POST_TYPES.has(body.post_type) ? body.post_type : 'availability'
    const specialty = String(body.specialty || '').trim().slice(0, 120)
    if (!specialty) return new Response(JSON.stringify({ error: 'specialty required' }), { status: 400, headers: cors })
    const priceAvc = body.price_avc != null ? Number(body.price_avc) : null
    const row = {
      user_id: userId,
      post_type: postType,
      vertical: normVertical(body.vertical),
      specialty,
      description: String(body.description || '').slice(0, 2000) || null,
      price_avc: priceAvc,
      price_eur: body.price_eur != null ? Number(body.price_eur) : priceAvc,
      price_unit: String(body.price_unit || 'job').slice(0, 24),
      pricing_detail: body.pricing_detail && typeof body.pricing_detail === 'object' ? body.pricing_detail : {},
      lat: body.lat != null ? Number(body.lat) : null,
      lng: body.lng != null ? Number(body.lng) : null,
      radius_km: body.radius_km != null ? Number(body.radius_km) : 25,
      target_user_id: body.target_user_id || null,
      status: 'open',
      expires_at: body.expires_at || new Date(Date.now() + 14 * 86400000).toISOString(),
      updated_at: new Date().toISOString(),
    }
    await sb.from('field_work_posts').update({ status: 'cancelled' })
      .eq('user_id', userId)
      .eq('post_type', postType)
      .eq('vertical', row.vertical)
      .eq('status', 'open')
    const { data, error } = await sb.from('field_work_posts').insert(row).select('*').single()
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
    return new Response(JSON.stringify({ ok: true, post: enrichPrice(data) }), { headers: cors })
  }

  if (action === 'list_nearby' || action === 'list') {
    const lat = body.lat != null ? Number(body.lat) : null
    const lng = body.lng != null ? Number(body.lng) : null
    const radius = body.radius_km != null ? Number(body.radius_km) : 40
    const vertical = body.vertical ? normVertical(body.vertical) : null
    let q = db.from('field_work_posts')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(80)
    if (vertical) q = q.eq('vertical', vertical)
    const { data, error } = await q
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
    const ids = [...new Set((data || []).map((p: { user_id: string }) => p.user_id).filter(Boolean))]
    const profMap = new Map<string, { display_name?: string; avatar_emoji?: string }>()
    if (ids.length) {
      const { data: profs } = await db.from('profiles').select('id, display_name, avatar_emoji').in('id', ids)
      for (const pr of profs || []) profMap.set(pr.id, pr)
    }
    let posts = (data || []).map((p: Record<string, unknown>) => {
      const prof = profMap.get(p.user_id as string)
      const row = enrichPrice(p)
      return {
        ...row,
        display_name: prof?.display_name || 'User',
        avatar_emoji: prof?.avatar_emoji || '◎',
      }
    })
    if (lat != null && lng != null) {
      posts = posts
        .map((p: Record<string, unknown>) => ({
          ...p,
          km: p.lat != null && p.lng != null ? haversineKm(lat, lng, p.lat as number, p.lng as number) : 9999,
        }))
        .filter((p: { km: number; radius_km?: number }) => p.km <= Math.max(radius, p.radius_km || radius))
        .sort((a: { km: number }, b: { km: number }) => a.km - b.km)
    }
    return new Response(JSON.stringify({ ok: true, posts }), { headers: cors })
  }

  if (action === 'my_posts') {
    if (!userId || !sb) return new Response(JSON.stringify({ error: 'login required' }), { status: 401, headers: cors })
    const { data, error } = await sb.from('field_work_posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(40)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
    return new Response(JSON.stringify({ ok: true, posts: (data || []).map(enrichPrice) }), { headers: cors })
  }

  if (action === 'close') {
    if (!userId || !sb) return new Response(JSON.stringify({ error: 'login required' }), { status: 401, headers: cors })
    const id = String(body.post_id || '').trim()
    if (!id) return new Response(JSON.stringify({ error: 'post_id required' }), { status: 400, headers: cors })
    const { error } = await sb.from('field_work_posts')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
    return new Response(JSON.stringify({ ok: true }), { headers: cors })
  }

  return new Response(JSON.stringify({ error: 'unknown action' }), { status: 400, headers: cors })
})