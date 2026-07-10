# Astranov SpaceNet System — Mission & Base Lock

**Date solidified:** 2026-07-10  
**Recycled from:** all owner sessions, Grok Build recovery, Claude/Codex/Cursor threads, user corrections  
**Authority:** Notis Astranov · notisastranov@gmail.com  
**Live:** https://astranov.eu · **Repo:** notisastranov/astranov.eu

---

## The Mission (one sentence)

**Unify all internet activity and code under as realistic as possible space imagery — solar system → planet → nation → city → street — and evolve the internet into SpaceNet.**

SpaceNet is not a skin on the old web. It is a **single navigable cosmos** where every service, person, vendor, message, and program has a **real place** in space and scale. Zoom is navigation. The globe is the OS surface.

---

## SpaceNet Navigation Stack (invariant)

One camera, one continuous descent. No teleport menus.

| Tier | Name | What the user sees | What binds here |
|------|------|-------------------|-----------------|
| 1 | **SOLAR** | Starfield, sun, planets, orbital mechanics | System-wide signals, deep space comms |
| 2 | **GLOBAL** | Whole Earth (Three.js globe, procedural atmosphere, day/night) | World feed, global posts, AVC economy |
| 3 | **NATIONAL** | Country/region (Leaflet, borders, national radar) | National vendors, policy, country-scale orders |
| 4 | **CITY** | Satellite + streets (Leaflet city map) | Shops, drivers, local delivery, city life |
| 5 | **STREET / PERSONAL** | Block-level, user marker, pilot routes | You (Αξάς), orders, voice, WebRTC, driving view |

**Gesture law:** single tap / zoom **down** a tier; double-tap or back gesture **up**.  
**Implementation:** `CosmicZoom` + `ZoomTiers` + `CityMap` in `index.html`.

---

## What SpaceNet Unifies

- **Social** — posts, friends, presence on the globe (`GlobeEntity`, `NewsFeed`)
- **Commerce** — vendors, menus, drivers, AVC payments (`Commerce`)
- **Comms** — voice el-GR, hands-free CLI, WebRTC orbital calls, PMR radio
- **Intelligence** — ACI collective brain (`/functions/v1/aci`), memory neurons on globe
- **Code** — Coders bridge, owner push, Supabase edge functions
- **Identity** — one session across `*.astranov.eu` (`Auth`, `AstranovSession`)
- **Reality layer** — procedural graphics only (`AIGraphics`), real routing (`RoutingEngine`), real geolocation on demand

All of the above must remain **attachable to a lat/lng and a zoom tier**, never orphaned in a floating panel that hides the cosmos.

---

## Base Version Lock (2026-07-10) — DO NOT DESTROY

This is the recovered good monolith. Every agent and every user session must treat it as **read-only architecture** unless explicitly extending the mission.

### Canonical artifact

- **File:** `index.html` only (~570KB monolithic deploy)
- **Build stamp:** `astranov-build` meta tag (current: `no-circles-globe-deck-only` lineage)
- **Title:** `Astranov` (English letters only — never MILKED/RESTORED/troll titles)
- **Deploy:** Vercel serves repo as-is — **NO** `bootstrap-index.mjs` on build

### CSS that MUST exist (app is broken without these)

```css
#aci-hud { position:fixed; left:0; right:0; bottom:0; z-index:50; pointer-events:none; }
#globe-deck { display:flex; flex-direction:column; pointer-events:auto; ... }
```

If either rule is deleted, users get a black globe with no CLI — **total app death**.

### UI law (owner-confirmed 2026-07-10)

| Element | Status |
|---------|--------|
| `#globe` + Three.js Earth | **Sacred** — always visible, always interactive first |
| `#globe-deck` CLI at bottom | **Primary UI** — type, voice, wallet, apps |
| Celestial Circles (floating balls) | **DISABLED** — owner rejected; `Circles.spawn()` is no-op |
| `simulateACI`, fake balance ticks | **FORBIDDEN** |
| Bootstrap shell + `/src/*.js` tags as deploy | **FORBIDDEN** on Vercel |

### Incidents recycled into this lock (never repeat)

1. Grok Build appended extra `<script>` blocks + `simulateACI` → syntax/runtime break  
2. Vercel `bootstrap-index.mjs` replaced monolith with 138-byte stub  
3. `#aci-hud` and `#globe-deck` CSS deleted → CLI invisible  
4. JS `display:none` on `#globe-deck` → CLI hidden while init still ran  
5. Floating celestial circles spawned without owner consent → removed  
6. `src/20-aci.js` syntax fracture (`this.pulse` outside method) → run `node --check` always  

### Pre-push gate (mandatory)

```bash
node scripts/guard-base.mjs
```

Must pass before every push to `main` and deploy to astranov.eu.

---

## Realism Law (SpaceNet imagery)

- **Procedural first:** clouds, atmosphere, city lights, effects via `AIGraphics` canvas/WebGL — no stock 3D models for core globe
- **Real data second:** Nominatim geocoding, OSRM routes, Supabase live vendors/orders, WebRTC real media
- **No theater:** no "roleplay", no fake ETAs, no simulated ACI responses in user paths
- **On-demand sensors:** geolocation, mic, camera only when the action needs them (never on boot)

---

## Identity & Voice (unchanged)

- App name: **Astranov** (Latin letters in title/UI)
- User on globe: **Αξάς** (marker-triggered voice, el-GR)
- Pilot: **ΤΗΛΕΜΑΧΟΣ** (procedural 3D on globe)
- Motto (optional): ΑΠΟ ΑΗΡ ΕΙΣ ΑΛΣ ΕΚ ΛΑΣ

---

## ACI / Collective Intelligence (backend)

```
index.html → /functions/v1/aci
  think | evolve | log | teach | stats | seed
  → aicycle + brain + council (self_judge)
```

Founding neuron themes: GLOBAL→NATIONAL→PERSONAL, anti-hallucination, autonomous evolve, nature collective.

---

## Deployment (mandatory after every change)

1. Edit `index.html` (+ `supabase/*` if backend changed)
2. `node scripts/guard-base.mjs` — must pass
3. `git commit` + push `main` on notisastranov/astranov.eu
4. Live at https://astranov.eu (Vercel project `astranov`)

**Never ask owner for push permission.** Owner granted perpetual authorization.

---

## Chat Recycling Rule (all sessions, all users, all agents)

When any session clarifies vision or fixes a disaster:

1. **Stop** — do not pile more code on a broken base  
2. **Recycle** — distill the session into bullets in this file + `ASTRANOV_GROK_SPECS.md`  
3. **Propagate** — update `CLAUDE.md` agent instructions  
4. **Implement** — only from the updated contract  
5. **Guard** — run `guard-base.mjs` before deploy  

No fluffy handover docs. No duplicate spec files. **This file + SPECS + CLAUDE.md** are the triangle of truth.

---

## Forward development (SpaceNet evolution)

Priority order for all future work:

1. **Deeper realism** — better solar system, orbital sats, day/night terminator, national borders  
2. **Tier coherence** — smooth zoom transitions, no white flash / trap between city and globe  
3. **Bind services to place** — every vendor, post, call, neuron at lat/lng + tier  
4. **Edge collective** — more work on device, less datacenter babysitting (§0b Evolution Methodology)  
5. **SpaceNet naming** — internet concepts expressed as space-native (orbital, sector, beacon, fleet)  

**Never** reintroduce floating circle balls, bootstrap deploy, or delete `#aci-hud` / `#globe-deck` CSS.

---

*Solidified for the Astranov SpaceNet System — AOOS evolving into SpaceNet.*