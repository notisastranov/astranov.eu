# Astranov SpaceNet — Mission (vision only)

**Authority for features / UI / deploy:** `astranov-continuity.js` + `CLAUDE.md`  
**Superseded:** long incident logs and chat-recycling into `ASTRANOV_GROK_SPECS.md` (2026-07-14)

---

## Mission (one sentence)

Unify internet activity under realistic space imagery — solar → global → national → city → street — and evolve the internet into **SpaceNet**.

---

## Navigation stack (invariant)

| Tier | What binds here |
|------|-----------------|
| SOLAR | System-wide signals |
| GLOBAL | World feed, AVC, Three.js Earth |
| NATIONAL | Region map, national vendors |
| CITY | Shops, drivers, delivery |
| STREET | User marker, routes, voice, WebRTC |

Implementation: `CosmicZoom`, `ZoomTiers`, `CityMap` (see continuity for boot/perf rules).

---

## Principles (still true)

- **Realism:** procedural globe first; real geocoding/routing/orders on demand
- **Name:** Astranov (Latin letters in UI title)
- **No API keys** in front-end; owner via server auth
- **Globe + globe-deck** sacred; celestial circles disabled
- **Pre-push:** `node scripts/guard-base.mjs`

---

## Everything else

Feature requirements (+ tile, locate, video, marketplace, miner field, perf, brain):  
→ **`astranov-continuity.js`** `features` + `verify` + `antiPatterns`

Do not copy requirements from old GitHub handoff issues (#97, #99) or session transcripts.