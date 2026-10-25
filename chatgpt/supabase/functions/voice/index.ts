// Astranov Voice — synthesized female, mid-tone, calm (collective AI persona)
// Engines: ElevenLabs custom → Gemini TTS persona → OpenAI nova → browser fallback on client

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PERSONA = {
  name: 'Astranov',
  style: 'female mid-tone calm grounded',
  openai_voice: 'nova',
  gemini_voice: 'Vindemiatrix',
  speed: 0.91,
}

type SynthResult = { bytes: Uint8Array; mime: string } | null

function geminiPrompt(text: string) {
  return `Speak this calmly in a grounded female mid-tone voice. Read only the line below:\n${text}`
}

function b64ToBytes(data: string): Uint8Array {
  const bin = atob(data)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function pcmToWav(pcm: Uint8Array, sampleRate = 24000, channels = 1, bitsPerSample = 16): Uint8Array {
  const byteRate = sampleRate * channels * (bitsPerSample / 8)
  const blockAlign = channels * (bitsPerSample / 8)
  const header = new ArrayBuffer(44)
  const view = new DataView(header)
  const tag = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)) }
  tag(0, 'RIFF')
  view.setUint32(4, 36 + pcm.length, true)
  tag(8, 'WAVE')
  tag(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)
  tag(36, 'data')
  view.setUint32(40, pcm.length, true)
  const wav = new Uint8Array(44 + pcm.length)
  wav.set(new Uint8Array(header), 0)
  wav.set(pcm, 44)
  return wav
}

async function synthGemini(text: string, key: string): Promise<SynthResult> {
  const models = ['gemini-2.5-flash-preview-tts', 'gemini-2.5-pro-preview-tts']
  for (const model of models) {
    try {
      const r = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: geminiPrompt(text) }] }],
            generationConfig: {
              responseModalities: ['AUDIO'],
              speechConfig: {
                voiceConfig: {
                  prebuiltVoiceConfig: { voiceName: PERSONA.gemini_voice },
                },
              },
            },
          }),
        },
      )
      if (!r.ok) continue
      const payload = await r.json()
      const part = payload?.candidates?.[0]?.content?.parts?.[0]?.inlineData
      if (!part?.data) continue
      const raw = b64ToBytes(part.data)
      const mime = String(part.mimeType || '')
      const isWav = raw.length > 12 && raw[0] === 0x52 && raw[1] === 0x49 && raw[2] === 0x46 && raw[3] === 0x46
      const bytes = (mime.includes('wav') || isWav) ? raw : pcmToWav(raw)
      if (!bytes.length) continue
      return { bytes, mime: 'audio/wav' }
    } catch { /* try next model */ }
  }
  return null
}

async function synthElevenLabs(text: string, key: string, voiceId: string): Promise<SynthResult> {
  try {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
      method: 'POST',
      headers: { 'xi-api-key': key, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
      body: JSON.stringify({
        text: text.slice(0, 2500),
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.62, similarity_boost: 0.78, style: 0.18, use_speaker_boost: true },
      }),
    })
    if (!r.ok) return null
    return { bytes: new Uint8Array(await r.arrayBuffer()), mime: 'audio/mpeg' }
  } catch { return null }
}

async function synthOpenAI(text: string, key: string): Promise<SynthResult> {
  try {
    const r = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'tts-1',
        voice: PERSONA.openai_voice,
        input: text.slice(0, 4096),
        speed: PERSONA.speed,
        response_format: 'mp3',
      }),
    })
    if (!r.ok) return null
    return { bytes: new Uint8Array(await r.arrayBuffer()), mime: 'audio/mpeg' }
  } catch { return null }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const body = await req.json().catch(() => ({}))
    const text = String(body.text || '').trim().slice(0, 2500)
    if (text.length < 2) {
      return new Response(JSON.stringify({ error: 'text required' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const elevenKey = Deno.env.get('ELEVENLABS_API_KEY') || ''
    const voiceId = Deno.env.get('ASTRANOV_VOICE_ID') || Deno.env.get('ELEVENLABS_VOICE_ID') || ''
    const openaiKey = Deno.env.get('OPENAI_API_KEY') || ''
    const geminiKey = Deno.env.get('GEMINI_API_KEY') || ''

    let audio: SynthResult = null
    let engine = 'none'

    if (elevenKey && voiceId) {
      audio = await synthElevenLabs(text, elevenKey, voiceId)
      if (audio) engine = 'elevenlabs'
    }
    if (!audio && geminiKey) {
      audio = await synthGemini(text, geminiKey)
      if (audio) engine = 'gemini-astranov'
    }
    if (!audio && openaiKey) {
      audio = await synthOpenAI(text, openaiKey)
      if (audio) engine = 'openai-nova'
    }

    if (!audio) {
      return new Response(JSON.stringify({
        error: 'no TTS engine configured',
        fallback: true,
        persona: PERSONA,
      }), { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } })
    }

    return new Response(audio.bytes, {
      status: 200,
      headers: {
        ...CORS,
        'Content-Type': audio.mime,
        'X-Astranov-Voice': engine,
        'X-Astranov-Persona': PERSONA.name,
      },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e), fallback: true }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})