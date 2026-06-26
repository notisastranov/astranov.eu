// site-provision: instant SuperBooking web presence → {slug}.astranov.eu

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,30}[a-z0-9])?$/
const RESERVED = new Set(['www', 'api', 'app', 'mail', 'admin', 'astranov', 'booker', 'superbooking', 'frogschool', 'yachts'])

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const auth = req.headers.get('authorization') ?? ''
    if (!auth.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
    }

    const userSb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { authorization: auth } }, auth: { persistSession: false } },
    )
    const { data: { user } } = await userSb.auth.getUser()
    if (!user) {
      return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
    }

    const body = await req.json().catch(() => ({}))
    const slug = String(body.slug || '').toLowerCase().trim()
    const businessName = String(body.business_name || body.name || slug).trim()
    const businessType = String(body.business_type || 'generic').trim()
    const mode = body.mode === 'range' ? 'range' : 'slot'
    const vendorId = body.vendor_id ? String(body.vendor_id) : null

    if (!slug || !SLUG_RE.test(slug) || RESERVED.has(slug)) {
      return new Response(JSON.stringify({ error: 'invalid_slug', hint: '3-32 chars, a-z 0-9 hyphen' }), { status: 400, headers: cors })
    }

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    if (vendorId) {
      const { data: vendor } = await sb.from('vendors').select('id, owner_id').eq('id', vendorId).maybeSingle()
      if (!vendor || vendor.owner_id !== user.id) {
        return new Response(JSON.stringify({ error: 'vendor_not_owned' }), { status: 403, headers: cors })
      }
    }

    const pos = body.lat != null && body.lng != null
      ? { lat: Number(body.lat), lng: Number(body.lng) }
      : null

    const { data: result, error } = await userSb.rpc('booker_provision_site', {
      p_slug: slug,
      p_business_name: businessName,
      p_business_type: businessType,
      p_mode: mode,
      p_vendor_id: vendorId,
      p_contact: body.contact ?? {},
      p_branding: body.branding ?? {},
    })

    if (error) {
      const msg = error.message || 'provision_failed'
      const status = msg.includes('login') ? 401 : msg.includes('taken') || msg.includes('reserved') ? 409 : 400
      return new Response(JSON.stringify({ error: msg }), { status, headers: cors })
    }

    await sb.from('field_events').insert({
      user_id: user.id,
      role: 'client',
      action: 'commerce',
      detail: `superbooking site · ${slug}.astranov.eu`,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      props: { type: 'site_provision', site_id: result?.site_id, slug, domain: result?.domain },
      brain_synced: true,
    }).catch(() => {})

    if (vendorId) {
      const { data: vrow } = await sb.from('vendors').select('tags').eq('id', vendorId).maybeSingle()
      const tags = { ...(vrow?.tags && typeof vrow.tags === 'object' ? vrow.tags : {}), superbooking_domain: result?.domain, superbooking_site_id: result?.site_id }
      await sb.from('vendors').update({ tags }).eq('id', vendorId).catch(() => {})
    }

    return new Response(JSON.stringify({ ok: true, ...result }), { headers: cors })
  } catch (e) {
    const err = e && typeof e === 'object' && 'message' in e ? String((e as { message?: string }).message) : String(e)
    return new Response(JSON.stringify({ ok: false, error: err }), { status: 500, headers: cors })
  }
})