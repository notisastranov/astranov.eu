// support-digest — daily problems + mission progression → support notification
// Architect: notisastranov@gmail.com

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const SUPPORT_EMAIL = 'notisastranov@gmail.com'

function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: cors })
}

function utcDateStr(d = new Date()) {
  return d.toISOString().slice(0, 10)
}

function since24h() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function summarizeList(items: unknown[], max = 12): string[] {
  if (!Array.isArray(items)) return []
  return items.slice(0, max).map((x) => {
    if (typeof x === 'string') return x.slice(0, 200)
    if (x && typeof x === 'object') {
      const o = x as Record<string, unknown>
      const type = o.type || o.action || o.subsystem || 'item'
      const msg = o.message || o.detail || o.text || JSON.stringify(o)
      return `${type}: ${String(msg).slice(0, 160)}`
    }
    return String(x).slice(0, 200)
  })
}

async function aggregateServer(sb: ReturnType<typeof createClient>) {
  const since = since24h()

  const [
    fieldEvents,
    orders,
    debugEvents,
    clientReports,
    activeDrivers,
    orderCounts,
  ] = await Promise.all([
    sb.from('field_events')
      .select('action, detail, role, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(80),
    sb.from('orders')
      .select('id, status, short_id, created_at, driver_id')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(40),
    sb.from('analytics_events')
      .select('type, data, ts, session_id')
      .like('type', 'debug_%')
      .gte('created_at', since)
      .order('ts', { ascending: false })
      .limit(50),
    sb.from('support_client_reports')
      .select('problems, progression, stats, build, session_id, created_at')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(100),
    sb.from('profiles')
      .select('id, display_name, field_seen_at')
      .contains('roles', ['driver'])
      .gte('field_seen_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .limit(30),
    sb.from('orders')
      .select('status', { count: 'exact', head: true })
      .gte('created_at', since),
  ])

  let debugSessions: string[] = []
  try {
    const { data: files } = await sb.storage.from('debug-pub').list('sessions', {
      limit: 30,
      sortBy: { column: 'created_at', order: 'desc' },
    })
    debugSessions = (files || [])
      .filter((f) => f.name?.endsWith('.json'))
      .map((f) => f.name!)
      .slice(0, 20)
  } catch { /* bucket may be empty */ }

  const problems: Record<string, unknown>[] = []
  for (const ev of debugEvents.data || []) {
    problems.push({
      type: 'debug_event',
      message: ev.type,
      detail: ev.data,
      session: ev.session_id,
      ts: ev.ts,
    })
  }
  for (const rep of clientReports.data || []) {
    for (const p of (rep.problems as unknown[]) || []) problems.push({ ...(p as object), build: rep.build, session: rep.session_id })
  }

  const progression: Record<string, unknown>[] = []
  for (const ev of fieldEvents.data || []) {
    if (['order', 'commerce', 'route', 'claim_delivery', 'vendor', 'drive', 'explore'].includes(ev.action)) {
      progression.push({ subsystem: ev.action, detail: ev.detail, role: ev.role, at: ev.created_at })
    }
  }
  for (const rep of clientReports.data || []) {
    for (const p of (rep.progression as unknown[]) || []) progression.push({ ...(p as object), build: rep.build })
  }

  const orderStatusCounts: Record<string, number> = {}
  for (const o of orders.data || []) {
    orderStatusCounts[o.status] = (orderStatusCounts[o.status] || 0) + 1
  }

  return {
    problems: problems.slice(0, 60),
    progression: progression.slice(0, 60),
    server_stats: {
      field_events_24h: fieldEvents.data?.length || 0,
      orders_24h: orders.data?.length || 0,
      order_status_24h: orderStatusCounts,
      active_drivers: activeDrivers.data?.length || 0,
      debug_events_24h: debugEvents.data?.length || 0,
      debug_sessions_recent: debugSessions,
      client_reports_24h: clientReports.data?.length || 0,
      orders_total_count_query: orderCounts.count,
    },
    raw: {
      field_events: fieldEvents.data || [],
      orders: orders.data || [],
    },
  }
}

function buildDigestText(date: string, problems: unknown[], progression: unknown[], stats: Record<string, unknown>) {
  const probLines = summarizeList(problems, 15)
  const progLines = summarizeList(progression, 15)
  const lines = [
    `Astranov SpaceNet — Daily Support Digest`,
    `Date (UTC): ${date}`,
    ``,
    `=== PROBLEMS (${probLines.length}) ===`,
    ...(probLines.length ? probLines : ['(none reported)']),
    ``,
    `=== MISSION PROGRESSION (${progLines.length}) ===`,
    ...(progLines.length ? progLines : ['(no field activity)']),
    ``,
    `=== STATS ===`,
    JSON.stringify(stats, null, 2),
    ``,
    `Live: https://astranov.eu`,
    `Digest stored in support_digests + debug-pub/digests/`,
  ]
  return lines.join('\n')
}

function buildDigestHtml(date: string, problems: unknown[], progression: unknown[], stats: Record<string, unknown>) {
  const prob = summarizeList(problems, 15).map((l) => `<li>${esc(l)}</li>`).join('') || '<li>(none)</li>'
  const prog = summarizeList(progression, 15).map((l) => `<li>${esc(l)}</li>`).join('') || '<li>(none)</li>'
  return `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;color:#111;max-width:640px">
<h2>Astranov SpaceNet — Daily Support Digest</h2>
<p><strong>Date (UTC):</strong> ${esc(date)}</p>
<h3>Problems</h3><ul>${prob}</ul>
<h3>Mission progression</h3><ul>${prog}</ul>
<h3>Stats</h3><pre style="background:#f4f4f4;padding:12px;font-size:12px">${esc(JSON.stringify(stats, null, 2))}</pre>
<p><a href="https://astranov.eu">astranov.eu</a></p>
</body></html>`
}

async function notifySupport(subject: string, text: string, html: string): Promise<{ ok: boolean; channel: string | null; detail?: string }> {
  const to = Deno.env.get('SUPPORT_EMAIL') || SUPPORT_EMAIL
  const resendKey = Deno.env.get('RESEND_API_KEY')
  if (resendKey) {
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: Deno.env.get('RESEND_FROM') || 'Astranov <onboarding@resend.dev>',
          to: [to],
          subject,
          text,
          html,
        }),
      })
      if (r.ok) return { ok: true, channel: 'resend' }
      return { ok: false, channel: 'resend', detail: await r.text() }
    } catch (e) {
      return { ok: false, channel: 'resend', detail: String(e) }
    }
  }

  const webhook = Deno.env.get('SUPPORT_WEBHOOK_URL')
  if (webhook) {
    try {
      const r = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, subject, text, html, source: 'astranov-support-digest' }),
      })
      if (r.ok) return { ok: true, channel: 'webhook' }
      return { ok: false, channel: 'webhook', detail: await r.text() }
    } catch (e) {
      return { ok: false, channel: 'webhook', detail: String(e) }
    }
  }

  return { ok: false, channel: null, detail: 'no RESEND_API_KEY or SUPPORT_WEBHOOK_URL — digest stored only' }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'run_daily')

    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    const digestDate = String(body.digest_date || utcDateStr()).slice(0, 10)

    if (action === 'client_report') {
      const problems = Array.isArray(body.problems) ? body.problems.slice(0, 40) : []
      const progression = Array.isArray(body.progression) ? body.progression.slice(0, 40) : []
      const stats = body.stats && typeof body.stats === 'object' ? body.stats : {}

      await sb.from('support_client_reports').insert({
        digest_date: digestDate,
        session_id: String(body.session_id || 'web').slice(0, 64),
        build: String(body.build || '').slice(0, 120),
        problems,
        progression,
        stats,
      })

      const cronSecret = Deno.env.get('SUPPORT_CRON_SECRET')
      const headerSecret = req.headers.get('x-cron-secret')
      const forceRun = body.force_daily === true || (cronSecret && headerSecret === cronSecret)

      if (!forceRun) {
        return json({ ok: true, stored: true, digest_date: digestDate })
      }
    }

    if (action === 'ping') {
      return json({ ok: true, service: 'support-digest', digest_date: digestDate })
    }

    if (action === 'latest') {
      const { data } = await sb.from('support_digests')
        .select('*')
        .order('digest_date', { ascending: false })
        .limit(1)
        .maybeSingle()
      return json({ ok: true, digest: data })
    }

    // run_daily — idempotent per UTC day
    const { data: existing } = await sb.from('support_digests')
      .select('id, digest_date, notified')
      .eq('digest_date', digestDate)
      .maybeSingle()

    if (existing && !body.force) {
      return json({ ok: true, skipped: true, reason: 'digest already exists', digest_date: digestDate, id: existing.id })
    }

    const agg = await aggregateServer(sb)
    const clientStats = body.stats && typeof body.stats === 'object' ? body.stats : {}
    const mergedProblems = [...agg.problems]
    if (Array.isArray(body.problems)) mergedProblems.push(...body.problems.slice(0, 20))
    const mergedProgression = [...agg.progression]
    if (Array.isArray(body.progression)) mergedProgression.push(...body.progression.slice(0, 20))

    const allStats = { ...agg.server_stats, client: clientStats }
    const summaryText = buildDigestText(digestDate, mergedProblems, mergedProgression, allStats)
    const summaryHtml = buildDigestHtml(digestDate, mergedProblems, mergedProgression, allStats)
    const subject = `Astranov SpaceNet digest ${digestDate} — ${mergedProblems.length} problems · ${mergedProgression.length} wins`

    const notify = await notifySupport(subject, summaryText, summaryHtml)

    const row = {
      digest_date: digestDate,
      problems: mergedProblems,
      progression: mergedProgression,
      server_stats: agg.server_stats,
      client_stats: clientStats,
      summary_text: summaryText.slice(0, 12000),
      notified: notify.ok,
      notify_channel: notify.channel,
    }

    const { data: saved, error: saveErr } = existing
      ? await sb.from('support_digests').update(row).eq('id', existing.id).select().single()
      : await sb.from('support_digests').insert(row).select().single()

    if (saveErr) return json({ ok: false, error: saveErr.message }, 500)

    await sb.storage.createBucket('debug-pub', { public: true }).catch(() => {})
    const blob = new Blob([JSON.stringify({ ...saved, notify_detail: notify.detail }, null, 2)], { type: 'application/json' })
    await sb.storage.from('debug-pub').upload(`digests/${digestDate}.json`, blob, { contentType: 'application/json', upsert: true })
    await sb.storage.from('debug-pub').upload('digests/latest.json', blob, { contentType: 'application/json', upsert: true })

    return json({
      ok: true,
      digest_date: digestDate,
      id: saved?.id,
      problems: mergedProblems.length,
      progression: mergedProgression.length,
      notified: notify.ok,
      notify_channel: notify.channel,
      notify_detail: notify.detail,
      public_url: `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/debug-pub/digests/latest.json`,
    })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})