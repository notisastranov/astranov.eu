# AstranoV — Claude Code Instructions

## Owner
Notis Astranov. Owner has granted full autonomous push/merge access.

## Mission — Astranov SpaceNet System

Unify all internet and code under **as realistic as possible** space imagery (solar → global → national → city → street) and evolve the internet into **SpaceNet**. Full mission: **ASTRANOV_SPACENET_MISSION.md**.

## Chat Recycling Technique (MANDATORY — all sessions, all users)
When conversations grow long or requirements are clarified:
1. Stop.
2. Recycle into **ASTRANOV_SPACENET_MISSION.md** + **ASTRANOV_GROK_SPECS.md**.
3. Update this CLAUDE.md if agent rules change.
4. Run `node scripts/guard-base.mjs` before push.
5. Continue implementation from the updated contract only.

Never drown in fluffy back-and-forth. The spec is truth.

## Deployment Rule — MANDATORY
After **every** code change:
1. `git add index.html` (and any supabase/* files changed)
2. `git commit -m "..."`
3. `git push origin main`
4. Deploy to https://astranov.eu (Vercel project `astranov` only)

**Central repo only:** `C:\Users\Astranov\Documents\GitHub\Astranov` → notisastranov/astranov.eu. Do not continue or push to any Grok GitHub repo or `grok.astranov.eu`.

**Never ask for permission. Push to main automatically every time.**

## Project
Single-file Internet Operating System: `index.html` only.
All changes go into this one file. No new files unless explicitly requested.

## Stack
- globe.gl (Three.js) — global level
- Leaflet — national + city levels
- Web Speech API — voice / hands-free
- Nominatim — reverse geocoding
- OSRM — routing
- Supabase Edge Functions — backend (no keys in front-end)

## Architecture Law — SpaceNet Tiers

**SOLAR → GLOBAL → NATIONAL → CITY → STREET** — one camera, zoom down / back up.  
`CosmicZoom` + `ZoomTiers` + `CityMap` implement this in index.html.  
AVC currency only. Krypteia = owner-only (server-filtered).

---

## UI Law — Globe + Globe-Deck (owner-confirmed 2026-07-10)

- **`#globe`** — sacred 3D Earth + space; user explores freely before any permission
- **`#globe-deck`** — primary CLI at bottom (`#aci-hud` fixed positioning). Type, 🎧 voice, wallet, apps
- **Celestial Circles (floating balls)** — **DISABLED**. `Circles.spawn()` is no-op. Never re-enable without owner written OK
- Transient content (vendor menu, video, radio) lives in **globe-deck stage**, not floating overlays on the globe
- Never delete `#aci-hud` or `#globe-deck` base CSS — app becomes unusable black globe

---

## Base Version Lock — NEVER VIOLATE

Before every push: `node scripts/guard-base.mjs`

**Forbidden:** `bootstrap-index.mjs` on Vercel, `simulateACI`, extra inline `<script>` blocks, hiding `#globe-deck`, troll titles, index.html &lt; 200KB

**Required:** monolithic index.html, `node --check` on script block, deploy https://astranov.eu

Read **ASTRANOV_SPACENET_MISSION.md** for full incident log and forward priorities.

---

## Collective Intelligence Cycle (CIC)
- Always-on floating ring (bottom-right, `#cic-float`)
- Astranov C.I. node = orchestrator, always first, always pulsing
- Free cycle for all users: Groq → Gemini → GPT-4o mini
- Owner gets Claude Opus first, then free cycle
- Tap node = lock to that provider; tap again = Auto
- Tap center mic = toggle hands-free
- Tap ring background = open C.I. chat
- Returns `provider` + `via` on every response

## Memory Law
- `ai_memory.is_private = false` → public context (sent to AI)
- `ai_memory.is_private = true` → private (NEVER sent to any AI, never stored with personal data)
- Owner can toggle privacy per-entry via Krypteia → Memory

## Security Law
- No API keys in index.html ever
- Owner identity verified server-side only (Supabase auth token → profiles.is_owner)
- Never trust client-sent `owner` flag
- Krypteia actions filtered server-side before response

## JS Safety Law
- Always `node scripts/guard-base.mjs` before committing/deploying
- Always `node --check` extracted script block before committing
- Never use `\'` inside template literals — use `JSON.stringify()` for dynamic strings in onclick
- Wrap all CDN-dependent init (Globe, Leaflet) in try-catch
- Never let an error in one init function kill the rest of the app
