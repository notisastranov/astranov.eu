// anonymous-scan — The Anonymous Service. Heuristic environment check
// for every visitor combined with a Claude privacy-analyst verdict.
// Browser cannot reliably detect root / jailbreak / installed apps;
// what we CAN do is fingerprint the request + the client-side signals
// and have Claude flag anything that looks unusual, plus advise on
// what the user should check themselves on their device.
//
// Public endpoint (anon allowed). Returns:
//   { ok, verdict, suspicion (0..1), signals, advice }
// Ethics: serves privacy for justful use. Refuses to advise on bypassing
// security against the user's own consent or assisting in illegal acts.

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}
function json(d: unknown, s = 200) {
  return new Response(JSON.stringify(d), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

const ANONYMOUS_PRIMER = `You are the Anonymous Service of AstranoV. You serve the user's PRIVACY — anonymity, identity protection, location protection, defence against totalitarian surveillance.

ETHICS: you serve JUSTFUL USE. You do NOT assist criminal acts (hacking other people's systems, doxxing, evading lawful warrants for serious crimes, fraud). The user's right to privacy ends where their actions harm others. You will refuse and explain when a request crosses into harm.

KNOWN LIMITS (be honest about these to the user):
  • You cannot read their filesystem, installed apps, or other apps' data from inside a browser.
  • You cannot reliably detect Android root or iOS jailbreak from a browser — those checks live in the OS.
  • You can read browser-side fingerprint signals + HTTP headers + IP and reason from them.

GIVEN the fingerprint + headers JSON provided as input, respond in FIVE sections:

1) SIGNAL READ — in plain language, what the fingerprint tells you about the user's environment (browser, OS family, automation flags, anomalies). One short paragraph.

2) SUSPICION (0–1) — a single number on a new line in the form 'SUSPICION=0.32' representing how unusual the environment looks. 0 = perfectly ordinary, 1 = automation / heavily modified.

3) WHAT THE USER SHOULD CHECK — actionable steps for them to perform on their own device to verify they're not running compromised software. Be platform-specific where possible (Android / iOS / Windows / Mac / Linux).

4) IF ROOTED — if root/jailbreak is suspected or confirmed: advise both (a) how to unroot safely if that's what they want, and (b) how to harden a rooted device for privacy if they want to keep root.

5) NEXT — one sentence: the single most useful next step.

Spartan. No padding. Decisive privacy-analyst voice.`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const body = await req.json().catch(() => ({}))
    const fp = (body && body.fingerprint) || {}

    const ipRaw = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || ''
    const ip = ipRaw.split(',')[0].trim().slice(0, 64)
    const ua = (req.headers.get('user-agent') || '').slice(0, 300)
    const acceptLang = (req.headers.get('accept-language') || '').slice(0, 80)

    const ANTHRO = Deno.env.get('ANTHROPIC_PAID_API_KEY') || Deno.env.get('ANTHROPIC_API_KEY')
    if (!ANTHRO) return json({ ok: false, error: 'AI key not configured', signals: { ip, ua } }, 503)

    const context = JSON.stringify({
      ip, ua, accept_language: acceptLang,
      fingerprint: fp,
    }, null, 2).slice(0, 6000)

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHRO,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: Deno.env.get('ANTHROPIC_MODEL') || 'claude-opus-4-7',
        max_tokens: 1500,
        system: ANONYMOUS_PRIMER,
        messages: [{ role: 'user', content: 'ENVIRONMENT:\n' + context }],
      }),
    })
    if (!r.ok) {
      const txt = await r.text().catch(() => '')
      return json({ ok: false, error: `Anthropic ${r.status}: ${txt.slice(0, 200)}` }, 502)
    }
    const j = await r.json()
    const text = j.content?.[0]?.text || ''
    const m = text.match(/SUSPICION\s*=\s*([0-9.]+)/i)
    const suspicion = m ? Math.max(0, Math.min(1, parseFloat(m[1]))) : 0

    return json({
      ok: true,
      at: new Date().toISOString(),
      suspicion,
      verdict: text,
      signals: { ip, ua, accept_language: acceptLang, fingerprint: fp },
    })
  } catch (e) {
    return json({ ok: false, error: String(e) }, 500)
  }
})
