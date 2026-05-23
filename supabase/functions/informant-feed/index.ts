// informant-feed — feeds real, geo-tagged data to each user's informant
// agent. Pulls from GDELT 2.1 DOC API (free, no auth, CORS-friendly,
// geo-tagged via sourcecountry) and returns findings ready for the
// orbital orb to consume:
//   - title, url, image_url (social-card image), source_name
//   - country_code, lat, lng (so the orb relocates over the country
//     and a glowing beam shoots from ground to orb)
//   - category, created_at
//
// Input:  { informants: [{ id, category, topic }, ...] }
// Output: { ok: true, findings: { <informant_id>: [Finding, ...] } }
//
// No auth required — informant feeds are public domain news. Owner-only
// gating would defeat the purpose; the data is for every user's orbs.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

// GDELT sourcecountry is a 3-letter FIPS code. We map the most common to
// approximate country-centre lat/lng so the orb can hover over the source.
// Codes not in the map fall back to null → orb stays at Fibonacci home.
const COUNTRY_CENTERS: Record<string, [number, number]> = {
  US: [39.8, -98.6], USA: [39.8, -98.6],
  GB: [54.0, -2.0], UK: [54.0, -2.0], UKM: [54.0, -2.0],
  GR: [39.0, 22.0], GRC: [39.0, 22.0],
  DE: [51.0, 10.0], GM: [51.0, 10.0], DEU: [51.0, 10.0],
  FR: [46.5, 2.5], FRA: [46.5, 2.5],
  IT: [42.5, 12.5], ITA: [42.5, 12.5],
  ES: [40.0, -3.7], SP: [40.0, -3.7], ESP: [40.0, -3.7],
  RU: [60.0, 100.0], RUS: [60.0, 100.0],
  CN: [35.0, 105.0], CH: [35.0, 105.0], CHN: [35.0, 105.0],
  JP: [36.2, 138.0], JA: [36.2, 138.0], JPN: [36.2, 138.0],
  IN: [22.0, 79.0], IND: [22.0, 79.0],
  BR: [-10.3, -53.0], BRA: [-10.3, -53.0],
  CA: [56.1, -106.3], CAN: [56.1, -106.3],
  AU: [-25.3, 133.8], AS: [-25.3, 133.8], AUS: [-25.3, 133.8],
  MX: [23.6, -102.5], MXC: [23.6, -102.5],
  EG: [26.8, 30.8], EGY: [26.8, 30.8],
  ZA: [-30.6, 22.9], SF: [-30.6, 22.9], ZAF: [-30.6, 22.9],
  NG: [9.1, 8.7], NGA: [9.1, 8.7],
  KE: [-0.0, 37.9], KEN: [-0.0, 37.9],
  AR: [-38.4, -63.6], ARG: [-38.4, -63.6],
  TR: [38.96, 35.24], TU: [38.96, 35.24], TUR: [38.96, 35.24],
  PL: [51.9, 19.1], PO: [51.9, 19.1], POL: [51.9, 19.1],
  NL: [52.1, 5.3], NLD: [52.1, 5.3],
  BE: [50.5, 4.5], BEL: [50.5, 4.5],
  SE: [60.1, 18.6], SWE: [60.1, 18.6],
  NO: [60.5, 8.5], NOR: [60.5, 8.5],
  FI: [61.9, 25.7], FIN: [61.9, 25.7],
  DK: [56.3, 9.5], DA: [56.3, 9.5], DNK: [56.3, 9.5],
  IE: [53.4, -8.0], EI: [53.4, -8.0], IRL: [53.4, -8.0],
  PT: [39.4, -8.2], PO_PT: [39.4, -8.2], PRT: [39.4, -8.2],
  CH: [46.8, 8.2], SZ: [46.8, 8.2], CHE: [46.8, 8.2],
  AT: [47.5, 14.5], AU_AT: [47.5, 14.5], AUT: [47.5, 14.5],
  IL: [31.0, 34.9], IS: [31.0, 34.9], ISR: [31.0, 34.9],
  SA: [23.9, 45.1], SAU: [23.9, 45.1],
  AE: [23.4, 53.8], TC: [23.4, 53.8], ARE: [23.4, 53.8],
  IR: [32.4, 53.7], IRN: [32.4, 53.7],
  IQ: [33.2, 43.7], IZ: [33.2, 43.7], IRQ: [33.2, 43.7],
  SY: [34.8, 38.9], SYR: [34.8, 38.9],
  UA: [48.4, 31.2], UP: [48.4, 31.2], UKR: [48.4, 31.2],
  KR: [35.9, 127.8], KS: [35.9, 127.8], KOR: [35.9, 127.8],
  KP: [40.3, 127.5], KN: [40.3, 127.5], PRK: [40.3, 127.5],
  TH: [15.9, 100.9], THA: [15.9, 100.9],
  VN: [14.1, 108.3], VM: [14.1, 108.3], VNM: [14.1, 108.3],
  ID: [-0.8, 113.9], INS: [-0.8, 113.9], IDN: [-0.8, 113.9],
  PH: [12.9, 121.8], RP: [12.9, 121.8], PHL: [12.9, 121.8],
  MY: [4.2, 101.9], MAL: [4.2, 101.9], MYS: [4.2, 101.9],
  SG: [1.35, 103.8], SN: [1.35, 103.8], SGP: [1.35, 103.8],
  HK: [22.32, 114.17], HKG: [22.32, 114.17],
  TW: [23.7, 121.0], TWN: [23.7, 121.0],
  NZ: [-40.9, 174.9], NZL: [-40.9, 174.9],
  CL: [-35.7, -71.5], CI: [-35.7, -71.5], CHL: [-35.7, -71.5],
  CO: [4.6, -74.3], CO_CO: [4.6, -74.3], COL: [4.6, -74.3],
  PE: [-9.2, -75.0], PER: [-9.2, -75.0],
  VE: [6.4, -66.6], VEN: [6.4, -66.6],
}

function centreFor(code: string): [number, number] | null {
  if (!code) return null
  const k = code.trim().toUpperCase()
  return COUNTRY_CENTERS[k] || null
}

// Map our internal informant category → a GDELT query that's likely to
// produce on-topic, geo-tagged news.
const CATEGORY_QUERY: Record<string, string> = {
  news:        '',                                      // raw top
  jobs:        'hiring OR employment OR job',
  commerce:    'retail OR business OR ecommerce',
  social:      '"social media" OR community',
  dating:      'dating OR relationships',
  real_estate: '"real estate" OR housing',
  classifieds: 'marketplace OR "for sale"',
}

function sanitiseQuery(s: string): string {
  // GDELT query is forgiving; strip control characters and cap length.
  return (s || '').replace(/[\x00-\x1f]/g, ' ').slice(0, 160)
}

function parseSeendate(s: string): string {
  // GDELT seendate is "20260523T091500Z" — turn into ISO.
  if (!s) return new Date().toISOString()
  const m = s.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/)
  if (!m) return new Date().toISOString()
  return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`
}

async function gdeltFor(category: string, topic: string) {
  const catQ = CATEGORY_QUERY[category] ?? ''
  const topQ = sanitiseQuery(topic)
  const parts = [topQ, catQ].filter(Boolean)
  const query = parts.length ? parts.join(' AND ') : 'theme:GENERAL_GOVERNMENT'
  // GDELT 2.1 DOC API — ArtList, JSON, English sources, fresh.
  const url = `https://api.gdeltproject.org/api/v2/doc/doc?${new URLSearchParams({
    query, mode: 'ArtList', format: 'json', maxrecords: '12',
    sourcelang: 'eng', sort: 'DateDesc', timespan: '24H',
  })}`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'AstranoV-InformantFeed/1.0' } })
    if (!r.ok) return []
    const j = await r.json().catch(() => null)
    const arr = Array.isArray(j?.articles) ? j.articles : []
    return arr
  } catch { return [] }
}

interface Article {
  url?: string; title?: string; seendate?: string; domain?: string;
  socialimage?: string; sourcecountry?: string; language?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const body = await req.json().catch(() => ({}))
    const informants: Array<{ id: string; category?: string; topic?: string }> =
      Array.isArray(body.informants) ? body.informants : []
    if (!informants.length) return json({ ok: true, findings: {} })

    const result: Record<string, unknown[]> = {}
    // Run queries in parallel; GDELT can handle a few concurrent.
    await Promise.all(informants.slice(0, 12).map(async (inf) => {
      const articles: Article[] = await gdeltFor(inf.category || 'news', inf.topic || '')
      const findings = articles.slice(0, 6).map((a) => {
        const code = (a.sourcecountry || '').toString()
        const c = centreFor(code)
        const url = a.url || ''
        // Hash url → stable id
        const id = 'gdelt:' + Math.abs([...url].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 0)).toString(36)
        return {
          id,
          title: (a.title || '').slice(0, 220),
          url, source_name: a.domain || '',
          image_url: a.socialimage || '',
          country_code: code,
          lat: c ? c[0] : null,
          lng: c ? c[1] : null,
          category: inf.category || 'news',
          created_at: parseSeendate(a.seendate || ''),
        }
      }).filter(f => f.title)
      result[inf.id] = findings
    }))

    return json({ ok: true, findings: result, fetched_at: new Date().toISOString() })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
