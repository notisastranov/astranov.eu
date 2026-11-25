// vendor-crawler: Overpass (OSM) + optional Google Places → vendors table + profile tags
// Builds map-ready rows with GBP-style fields (name, hours, phone, website, photo)
// and social links from OSM contact:* / website discovery.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const CAT: Record<string, { emoji: string; category: string; delivery: boolean }> = {
  restaurant: { emoji: '🍴', category: 'restaurant', delivery: true },
  cafe: { emoji: '☕', category: 'cafe', delivery: true },
  fast_food: { emoji: '🍟', category: 'fast_food', delivery: true },
  pizza: { emoji: '🍕', category: 'restaurant', delivery: true },
  bakery: { emoji: '🥖', category: 'bakery', delivery: true },
  ice_cream: { emoji: '🍨', category: 'cafe', delivery: true },
  bar: { emoji: '🍻', category: 'bar', delivery: false },
  pub: { emoji: '🍺', category: 'bar', delivery: false },
  pharmacy: { emoji: '💊', category: 'pharmacy', delivery: true },
  supermarket: { emoji: '🛒', category: 'supermarket', delivery: true },
  convenience: { emoji: '🛍️', category: 'shop', delivery: true },
  clothes: { emoji: '👕', category: 'shop', delivery: false },
  electronics: { emoji: '💻', category: 'shop', delivery: false },
  books: { emoji: '📖', category: 'shop', delivery: false },
  sports: { emoji: '🏀', category: 'shop', delivery: false },
  hairdresser: { emoji: '💇', category: 'service', delivery: false },
  beauty: { emoji: '💅', category: 'service', delivery: false },
  gym: { emoji: '🏃', category: 'fitness', delivery: false },
  hotel: { emoji: '🏨', category: 'hotel', delivery: false },
  hospital: { emoji: '🏥', category: 'health', delivery: false },
  marketplace: { emoji: '🏬', category: 'shop', delivery: true },
  greengrocer: { emoji: '🥬', category: 'grocery', delivery: true },
  butcher: { emoji: '🥩', category: 'grocery', delivery: true },
}

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

function socialsFromTags(tags: Record<string, string>) {
  const pick = (...keys: string[]) => {
    for (const k of keys) {
      const v = tags[k]
      if (v && String(v).trim()) return String(v).trim()
    }
    return null
  }
  const normalize = (u: string | null, hostHint?: string) => {
    if (!u) return null
    let s = u.trim()
    if (/^@/.test(s) && hostHint) s = hostHint + s.slice(1)
    if (!/^https?:\/\//i.test(s) && /^[\w.-]+\.\w/.test(s)) s = 'https://' + s
    if (!/^https?:\/\//i.test(s) && hostHint && !s.includes('/')) s = hostHint + s.replace(/^@/, '')
    return s
  }
  return {
    facebook: normalize(pick('contact:facebook', 'facebook'), 'https://facebook.com/'),
    instagram: normalize(pick('contact:instagram', 'instagram'), 'https://instagram.com/'),
    twitter: normalize(pick('contact:twitter', 'twitter', 'contact:x'), 'https://x.com/'),
    youtube: normalize(pick('contact:youtube', 'youtube'), 'https://youtube.com/'),
    tiktok: normalize(pick('contact:tiktok', 'tiktok'), 'https://tiktok.com/@'),
    linkedin: normalize(pick('contact:linkedin', 'linkedin'), 'https://linkedin.com/'),
  }
}

function profileTags(tags: Record<string, string>, source: string, extra: Record<string, unknown> = {}) {
  const social = socialsFromTags(tags)
  const website = tags.website || tags['contact:website'] || tags.url || null
  const phone = tags.phone || tags['contact:phone'] || tags['contact:mobile'] || null
  const image = tags.image || tags['image:0'] || tags.wikimedia_commons || null
  const aboutParts = [
    tags.description,
    tags.cuisine ? 'Cuisine: ' + tags.cuisine : null,
    tags.opening_hours ? 'Hours: ' + tags.opening_hours : null,
  ].filter(Boolean)
  return {
    source,
    profile_source: source,
    amenity: tags.amenity || null,
    shop: tags.shop || null,
    cuisine: tags.cuisine || null,
    opening_hours: tags.opening_hours || null,
    phone,
    website,
    email: tags.email || tags['contact:email'] || null,
    cover_url: image,
    profile_url: image,
    about: aboutParts.join(' · ') || null,
    social,
    google_place_id: extra.google_place_id || null,
    google_rating: extra.google_rating ?? null,
    google_reviews: extra.google_reviews ?? null,
    google_photo_url: extra.google_photo_url || null,
    brand: tags.brand || null,
    ...extra,
  }
}

function metaFor(kind: string) {
  return CAT[kind] ?? { emoji: '🏬', category: 'shop', delivery: false }
}

function elLatLng(el: any): { lat: number; lng: number } | null {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon }
  if (el.center?.lat != null && el.center?.lon != null) return { lat: el.center.lat, lng: el.center.lon }
  return null
}

function rowFromOsm(el: any) {
  const tags = el.tags || {}
  const name = tags.name
  const pos = elLatLng(el)
  if (!name || !pos) return null
  const amenity = tags.amenity || tags.shop || tags.tourism || 'shop'
  const meta = metaFor(amenity)
  const id = String(el.id)
  const prefix = el.type === 'way' ? 'osm_w_' : el.type === 'relation' ? 'osm_r_' : 'osm_'
  return {
    osm_id: prefix + id,
    name: String(name),
    emoji: meta.emoji,
    category: meta.category,
    lat: pos.lat,
    lng: pos.lng,
    address: {
      street: tags['addr:street'] ?? null,
      housenumber: tags['addr:housenumber'] ?? null,
      city: tags['addr:city'] ?? null,
      postcode: tags['addr:postcode'] ?? null,
      phone: tags.phone || tags['contact:phone'] || null,
      website: tags.website || tags['contact:website'] || null,
    },
    tags: profileTags(tags, 'osm'),
    items: [],
    delivery_enabled: meta.delivery,
    is_active: true,
  }
}

async function fetchOverpass(lat: number, lng: number, radius: number) {
  const query = `[out:json][timeout:28];
(
  nwr["amenity"~"^(restaurant|cafe|fast_food|bakery|ice_cream|bar|pub|pharmacy|marketplace)$"](around:${radius},${lat},${lng});
  nwr["shop"~"^(clothes|electronics|books|sports|bakery|convenience|supermarket|hairdresser|beauty|greengrocer|butcher|mall)$"](around:${radius},${lat},${lng});
  nwr["tourism"~"^(hotel|hostel|guest_house)$"](around:${radius},${lat},${lng});
  nwr["leisure"="fitness_centre"](around:${radius},${lat},${lng});
);
out center body qt 120;`

  let lastErr = 'overpass failed'
  for (const url of OVERPASS_ENDPOINTS) {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        body: query,
        headers: { 'Content-Type': 'text/plain', 'User-Agent': 'AstranovSpaceNet/1.0 (vendor-crawler)' },
        signal: AbortSignal.timeout(26000),
      })
      if (!resp.ok) {
        lastErr = `Overpass HTTP ${resp.status}`
        continue
      }
      const data = await resp.json()
      return (data.elements ?? []).map(rowFromOsm).filter(Boolean) as any[]
    } catch (e) {
      lastErr = String(e)
    }
  }
  throw new Error(lastErr)
}

async function fetchGooglePlaces(lat: number, lng: number, radius: number) {
  const key = Deno.env.get('GOOGLE_PLACES_API_KEY') || Deno.env.get('GOOGLE_MAPS_API_KEY') || ''
  if (!key) return [] as any[]

  const types = ['restaurant', 'cafe', 'bakery', 'meal_takeaway', 'supermarket', 'pharmacy', 'store']
  const byPlace = new Map<string, any>()

  for (const type of types) {
    try {
      const url = new URL('https://maps.googleapis.com/maps/api/place/nearbysearch/json')
      url.searchParams.set('location', `${lat},${lng}`)
      url.searchParams.set('radius', String(Math.min(radius, 5000)))
      url.searchParams.set('type', type)
      url.searchParams.set('key', key)
      const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) })
      if (!resp.ok) continue
      const data = await resp.json()
      for (const p of data.results || []) {
        if (!p.place_id || !p.name || !p.geometry?.location) continue
        if (byPlace.has(p.place_id)) continue
        const photoRef = p.photos?.[0]?.photo_reference
        const photoUrl = photoRef
          ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photo_reference=${photoRef}&key=${key}`
          : null
        const meta = metaFor(
          type === 'meal_takeaway' ? 'fast_food' : type === 'store' ? 'convenience' : type,
        )
        byPlace.set(p.place_id, {
          osm_id: 'ggl_' + p.place_id,
          name: p.name,
          emoji: meta.emoji,
          category: meta.category,
          lat: p.geometry.location.lat,
          lng: p.geometry.location.lng,
          address: {
            street: p.vicinity || null,
            housenumber: null,
            city: null,
            postcode: null,
            phone: null,
            website: null,
          },
          tags: profileTags(
            {
              name: p.name,
              opening_hours: p.opening_hours?.open_now != null
                ? (p.opening_hours.open_now ? 'Open now' : 'Closed now')
                : '',
            },
            'google_places',
            {
              google_place_id: p.place_id,
              google_rating: p.rating ?? null,
              google_reviews: p.user_ratings_total ?? null,
              google_photo_url: photoUrl,
              cover_url: photoUrl,
              profile_url: photoUrl,
              about: [p.vicinity, p.rating != null ? `★ ${p.rating}` : null, p.types?.[0]]
                .filter(Boolean)
                .join(' · '),
            },
          ),
          items: [],
          delivery_enabled: meta.delivery,
          is_active: true,
        })
      }
    } catch (_) {
      /* optional enrichment */
    }
  }

  // Details pass for website/phone (cap to keep latency reasonable)
  const details = [...byPlace.values()].slice(0, 18)
  await Promise.all(
    details.map(async (row) => {
      try {
        const pid = row.tags?.google_place_id
        if (!pid) return
        const url = new URL('https://maps.googleapis.com/maps/api/place/details/json')
        url.searchParams.set('place_id', pid)
        url.searchParams.set('fields', 'formatted_phone_number,international_phone_number,website,url,opening_hours')
        url.searchParams.set('key', key)
        const resp = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
        if (!resp.ok) return
        const data = await resp.json()
        const r = data.result || {}
        if (r.website) {
          row.address.website = r.website
          row.tags.website = r.website
        }
        const phone = r.international_phone_number || r.formatted_phone_number
        if (phone) {
          row.address.phone = phone
          row.tags.phone = phone
        }
        if (r.opening_hours?.weekday_text?.length) {
          row.tags.opening_hours = r.opening_hours.weekday_text.join('; ')
        }
        if (r.url) row.tags.google_maps_url = r.url
      } catch (_) {}
    }),
  )

  return [...byPlace.values()]
}

function mergeRows(a: any[], b: any[]) {
  const out = new Map<string, any>()
  const keyOf = (r: any) => {
    if (r.osm_id) return r.osm_id
    return `${r.name}|${Number(r.lat).toFixed(4)}|${Number(r.lng).toFixed(4)}`
  }
  for (const r of a) out.set(keyOf(r), r)
  for (const r of b) {
    const k = keyOf(r)
    const prev = out.get(k)
    if (!prev) {
      // Dedup by proximity + similar name
      let found: string | null = null
      for (const [pk, pv] of out) {
        if (Math.abs(pv.lat - r.lat) < 0.00035 && Math.abs(pv.lng - r.lng) < 0.00035) {
          const n1 = String(pv.name || '').toLowerCase()
          const n2 = String(r.name || '').toLowerCase()
          if (n1 === n2 || n1.includes(n2.slice(0, 6)) || n2.includes(n1.slice(0, 6))) {
            found = pk
            break
          }
        }
      }
      if (found) {
        const base = out.get(found)
        out.set(found, {
          ...base,
          tags: {
            ...(base.tags || {}),
            ...(r.tags || {}),
            social: { ...(base.tags?.social || {}), ...(r.tags?.social || {}) },
            profile_source: base.tags?.profile_source === 'osm' && r.tags?.profile_source === 'google_places'
              ? 'hybrid'
              : (r.tags?.profile_source || base.tags?.profile_source),
            cover_url: base.tags?.cover_url || r.tags?.cover_url || r.tags?.google_photo_url,
            profile_url: base.tags?.profile_url || r.tags?.profile_url || r.tags?.google_photo_url,
          },
          address: { ...(base.address || {}), ...(r.address || {}) },
        })
      } else {
        out.set(k, r)
      }
    } else {
      out.set(k, {
        ...prev,
        tags: { ...(prev.tags || {}), ...(r.tags || {}) },
        address: { ...(prev.address || {}), ...(r.address || {}) },
      })
    }
  }
  return [...out.values()]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    const lat = Number(body.lat)
    const lng = Number(body.lng)
    if (!isFinite(lat) || !isFinite(lng)) {
      return new Response(JSON.stringify({ error: 'lat and lng required' }), { status: 400, headers: cors })
    }

    // Client may send radius_km (SpaceNetBrain) or radius meters
    let radius = Number(body.radius)
    if (!isFinite(radius) || radius <= 0) {
      const km = Number(body.radius_km ?? body.radiusKm ?? 2)
      radius = isFinite(km) && km > 0 ? Math.round(km * 1000) : 2000
    }
    radius = Math.max(400, Math.min(radius, 8000))

    const [osmRows, gglRows] = await Promise.all([
      fetchOverpass(lat, lng, radius).catch(() => [] as any[]),
      fetchGooglePlaces(lat, lng, radius).catch(() => [] as any[]),
    ])
    const rows = mergeRows(osmRows, gglRows)

    const sbUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    let upserted = 0
    let dbError: string | null = null

    let published = rows
    if (rows.length && sbUrl && sbKey) {
      const sb = createClient(sbUrl, sbKey)
      const ids = rows.map(r => r.osm_id)
      const { data: existing, error: readError } = await sb.from('vendors').select('osm_id').in('osm_id', ids)
      if (readError) throw readError
      const known = new Set((existing || []).map(r => r.osm_id))
      const fresh = rows.filter(r => !known.has(r.osm_id)).map(r => ({ ...r, id: r.osm_id }))
      if (fresh.length) {
        const { error } = await sb.from('vendors').upsert(fresh, { onConflict: 'id', ignoreDuplicates: true })
        if (error) dbError = error.message
        else upserted = fresh.length
      }
      const { data, error } = await sb.from('vendors').select('id,osm_id,name,category,emoji,lat,lng,address,tags,items,is_active').in('osm_id', ids).eq('is_active',true)
      if (error) throw error
      published = data || []
    }
    const vendors = published.map(r => ({
      id:r.id || r.osm_id, name:r.name, category:r.category, emoji:r.emoji, lat:r.lat, lng:r.lng,
      phone:r.address?.phone, website:r.address?.website, menu:r.items || [],
      logo:r.tags?.profile_url, cover:r.tags?.cover_url
    }))

    return new Response(
      JSON.stringify({
        ok: true,
        count: rows.length,
        upserted,
        sources: { osm: osmRows.length, google: gglRows.length },
        dbError,
        vendors,
      }),
      { headers: cors },
    )
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), { status: 500, headers: cors })
  }
})
