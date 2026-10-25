// cli-hub: cloud CLI transcripts · search users/chats · private DM circles

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'npm:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

function dmCircleId(a: string, b: string) {
  return 'mapdm-' + [a, b].sort().join('--')
}

async function isOwner(sb: ReturnType<typeof createClient>, userId: string) {
  const { data } = await sb.from('profiles').select('is_owner').eq('id', userId).maybeSingle()
  return !!data?.is_owner
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })

  try {
    const sb = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    )

    let userId: string | null = null
    const auth = req.headers.get('authorization') ?? ''
    if (auth.startsWith('Bearer ')) {
      const anonSb = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { authorization: auth } }, auth: { persistSession: false } },
      )
      const { data: { user } } = await anonSb.auth.getUser()
      userId = user?.id ?? null
    }

    const body = await req.json().catch(() => ({}))
    const action = String(body.action || 'search')

    if (!userId && action !== 'health') {
      return new Response(JSON.stringify({ error: 'login_required' }), { status: 401, headers: cors })
    }

    if (action === 'append') {
      const lines = Array.isArray(body.lines) ? body.lines : []
      if (!lines.length) return new Response(JSON.stringify({ ok: true, n: 0 }), { headers: cors })
      const rows = lines.slice(0, 24).map((l: { line?: string; cls?: string; circle_id?: string; peer_id?: string }) => ({
        user_id: userId,
        line: String(l.line || '').slice(0, 2000),
        cls: String(l.cls || 'out').slice(0, 24),
        circle_id: l.circle_id ? String(l.circle_id) : null,
        peer_id: l.peer_id ? String(l.peer_id) : null,
      })).filter((r) => r.line.length > 0)
      if (!rows.length) return new Response(JSON.stringify({ ok: true, n: 0 }), { headers: cors })
      const { error } = await sb.from('cli_transcripts').insert(rows)
      if (error) return new Response(JSON.stringify({ error: error.message }), { status: 400, headers: cors })
      return new Response(JSON.stringify({ ok: true, n: rows.length }), { headers: cors })
    }

    if (action === 'feed') {
      const targetId = String(body.user_id || userId)
      const owner = await isOwner(sb, userId!)
      if (targetId !== userId && !owner) {
        return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403, headers: cors })
      }
      const limit = Math.min(80, Math.max(1, Number(body.limit) || 40))
      const { data: prof } = await sb.from('profiles')
        .select('id, display_name, avatar_emoji, field_seen_at')
        .eq('id', targetId)
        .maybeSingle()
      const { data: rows } = await sb.from('cli_transcripts')
        .select('id, line, cls, circle_id, peer_id, created_at')
        .eq('user_id', targetId)
        .order('created_at', { ascending: false })
        .limit(limit)
      return new Response(JSON.stringify({
        ok: true,
        user: prof,
        lines: (rows || []).reverse(),
        owner_view: owner && targetId !== userId,
      }), { headers: cors })
    }

    if (action === 'users') {
      const owner = await isOwner(sb, userId!)
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      const profCols = 'id, display_name, avatar_emoji, field_seen_at, field_lat, field_lng, map_hidden'
      let profiles: { id: string; display_name: string | null; avatar_emoji: string | null; field_seen_at: string | null; field_lat: number | null; field_lng: number | null; map_hidden: boolean | null }[] = []

      if (owner) {
        const { data: fieldRows } = await sb.from('profiles')
          .select(profCols)
          .gte('field_seen_at', since)
          .not('field_seen_at', 'is', null)
          .order('field_seen_at', { ascending: false })
          .limit(80)
        const seen = new Set<string>()
        profiles = (fieldRows || []).filter((p) => { seen.add(p.id); return true })

        const cliSince = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
        const { data: cliRows } = await sb.from('cli_transcripts')
          .select('user_id')
          .gte('created_at', cliSince)
          .order('created_at', { ascending: false })
          .limit(400)
        const cliIds = [...new Set((cliRows || []).map((r) => r.user_id).filter((id) => !seen.has(id)))]
        if (cliIds.length) {
          const { data: cliProfs } = await sb.from('profiles').select(profCols).in('id', cliIds.slice(0, 120))
          ;(cliProfs || []).forEach((p) => { if (!seen.has(p.id)) { seen.add(p.id); profiles.push(p) } })
        }
        if (profiles.length < 40) {
          const { data: more } = await sb.from('profiles').select(profCols).order('field_seen_at', { ascending: false, nullsFirst: false }).limit(120)
          ;(more || []).forEach((p) => { if (!seen.has(p.id)) { seen.add(p.id); profiles.push(p) } })
        }
      } else {
        const { data: rows } = await sb.from('profiles')
          .select(profCols)
          .gte('field_seen_at', since)
          .not('field_seen_at', 'is', null)
          .order('field_seen_at', { ascending: false })
          .limit(40)
        profiles = rows || []
      }

      const ids = profiles.map((p) => p.id)
      const lastByUser = new Map<string, { line: string; cls: string; at: string }>()
      if (ids.length) {
        const { data: lastLines } = await sb.from('cli_transcripts')
          .select('user_id, line, cls, created_at')
          .in('user_id', ids)
          .order('created_at', { ascending: false })
          .limit(200)
        for (const row of lastLines || []) {
          if (!lastByUser.has(row.user_id)) {
            lastByUser.set(row.user_id, { line: row.line, cls: row.cls, at: row.created_at })
          }
        }
      }

      const users = profiles
        .filter((p) => owner || p.id === userId || !p.map_hidden)
        .map((p) => ({
          id: p.id,
          name: p.display_name || String(p.id).slice(0, 8),
          emoji: p.avatar_emoji || '👤',
          live: !!p.field_seen_at && new Date(p.field_seen_at).getTime() > Date.now() - 15 * 60 * 1000,
          last_cli: lastByUser.get(p.id) || null,
          self: p.id === userId,
        }))

      return new Response(JSON.stringify({ ok: true, users, owner }), { headers: cors })
    }

    if (action === 'search') {
      const q = String(body.q || '').trim().toLowerCase()
      if (q.length < 2) {
        return new Response(JSON.stringify({ ok: true, users: [], chats: [], cli_lines: [] }), { headers: cors })
      }
      const owner = await isOwner(sb, userId!)
      const like = '%' + q.replace(/[%_]/g, '') + '%'

      const { data: userHits } = await sb.from('profiles')
        .select('id, display_name, avatar_emoji, field_seen_at')
        .ilike('display_name', like)
        .limit(20)

      let cliQ = sb.from('cli_transcripts')
        .select('id, user_id, line, cls, created_at, peer_id, circle_id')
        .ilike('line', like)
        .order('created_at', { ascending: false })
        .limit(30)
      if (!owner) cliQ = cliQ.or(`user_id.eq.${userId},peer_id.eq.${userId}`)
      const { data: cliHits } = await cliQ

      let msgHits: { id: string; circle_id: string; author: string; text: string; ts: number; created_at?: string; author_id?: string }[] = []
      const { data: msgData, error: msgErr } = await sb.from('circle_messages')
        .select('id, circle_id, author, text, ts, created_at, author_id')
        .ilike('text', like)
        .order('ts', { ascending: false })
        .limit(30)
      if (!msgErr) msgHits = msgData || []

      const dmCircles = new Set<string>()
      const peerIds = new Set<string>()
      ;(cliHits || []).forEach((r) => {
        if (r.circle_id?.startsWith('mapdm-')) dmCircles.add(r.circle_id)
        if (r.peer_id) peerIds.add(r.peer_id)
      })
      ;(msgHits || []).forEach((m) => {
        if (m.circle_id?.startsWith('mapdm-')) dmCircles.add(m.circle_id)
      })

      const profMap = new Map((userHits || []).map((u) => [u.id, u]))
      if (peerIds.size) {
        const { data: peers } = await sb.from('profiles')
          .select('id, display_name, avatar_emoji')
          .in('id', [...peerIds])
        ;(peers || []).forEach((p) => profMap.set(p.id, p))
      }

      return new Response(JSON.stringify({
        ok: true,
        users: (userHits || []).map((u) => ({
          id: u.id,
          name: u.display_name || String(u.id).slice(0, 8),
          emoji: u.avatar_emoji || '👤',
        })),
        cli_lines: (cliHits || []).map((r) => ({
          id: r.id,
          user_id: r.user_id,
          line: r.line,
          cls: r.cls,
          at: r.created_at,
        })),
        chats: (msgHits || []).map((m) => ({
          id: m.id,
          circle_id: m.circle_id,
          author: m.author,
          text: m.text,
          at: m.created_at || m.ts,
        })),
        dm_circles: [...dmCircles],
      }), { headers: cors })
    }

    if (action === 'open_dm') {
      const targetId = String(body.target_user_id || '')
      if (!targetId || targetId === userId) {
        return new Response(JSON.stringify({ error: 'target_user_id_required' }), { status: 400, headers: cors })
      }
      const { data: target } = await sb.from('profiles')
        .select('id, display_name, avatar_emoji, field_lat, field_lng')
        .eq('id', targetId)
        .maybeSingle()
      if (!target) return new Response(JSON.stringify({ error: 'user_not_found' }), { status: 404, headers: cors })

      const circleId = dmCircleId(userId!, targetId)
      const { data: me } = await sb.from('profiles')
        .select('display_name, field_lat, field_lng')
        .eq('id', userId!)
        .maybeSingle()

      const members = [
        {
          id: userId,
          name: me?.display_name || 'You',
          lat: me?.field_lat ?? 36.22,
          lng: me?.field_lng ?? 28.12,
          emoji: '◎',
        },
        {
          id: target.id,
          name: target.display_name || 'User',
          lat: target.field_lat ?? 36.22,
          lng: target.field_lng ?? 28.12,
          emoji: target.avatar_emoji || '👤',
        },
      ]

      await sb.from('circles').upsert({
        id: circleId,
        name: 'DM · ' + (target.display_name || 'User'),
        scope: 'map_dm',
        type: 'private',
        owner_id: userId,
        map_members: members,
        map_center_lat: target.field_lat,
        map_center_lng: target.field_lng,
      })

      let msgs: { author: string; text: string; ts: number; author_id?: string }[] = []
      const { data: dmMsgs, error: dmErr } = await sb.from('circle_messages')
        .select('author, text, ts, author_id')
        .eq('circle_id', circleId)
        .order('ts', { ascending: true })
        .limit(60)
      if (!dmErr) msgs = dmMsgs || []

      return new Response(JSON.stringify({
        ok: true,
        circle_id: circleId,
        target,
        messages: msgs,
      }), { headers: cors })
    }

    return new Response(JSON.stringify({ error: 'unknown_action' }), { status: 400, headers: cors })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: cors })
  }
})