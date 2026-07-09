# ASTRANOV LIVING TRUTH (Grok-built Source of Truth - 2026-07-09, autonomous update)

**Purpose:** Single source of truth distilled from all research.

**Core Identity:**
- App: Astranov (English letters only). 3D globe as the ONLY permanent UI surface.
- "Planetary Internet Operating System".
- User: Αξάς.
- Deploy only to https://astranov.eu (Vercel `astranov`), central repo notisastranov/astranov.eu.

**Fundamental Law - Globe Primacy + Celestial Circles UI (STRICT):**
- Globe is the only surface.
- NO rectangles as primary UI.
- ALL UI = floating celestial circles (frosted glass, draggable by rim, pinch-scalable).
- 4 Primordial: Economics (green), Radar (amber), AI (violet), View (content).
- Circles.spawn() for everything.

**Real Technology Only:**
- Real WebRTC, Routing, AIGraphics, Voice (el-GR provoke).
- Full ACI (aicycle/brain/council).
- Pilot, groupOrder real.

**Monitored Data (from logs, debug-reader simulation, storage, code, user complaint):**
- High prompt tokens in ACI think (~210k, reduced history in update).
- Client init/render errors (added global send to debug-write).
- ACI errors and complaints (added _sendComplaint and user button in AI circle).
- Usage: frequent stats, think, log calls; network logs show activity.
- No direct remote data (functions returned 500/400 - possible deploy or key issue), so enhanced client monitoring.
- Critical: globe->national/city zoom/fly unstable (white blank, shutdown, teleport, shake) - fixed in this batch: decoupled city toggle during fly, added fly cancel on input, bg force, longer dur, early return in onCamera/sync.

**Update Policy (MANDATORY):**
- ALWAYS pack changes into **daily updates** only.
- One batched commit/push per day.
- Multiple files in single push_files call.
- Supabase: Batch deploys once per daily.
- Vercel: Trigger once per daily.
- Avoid overload/blocks.

**Ongoing Mission:**
- Maintain perpetually using granted access.
- Refinements without small pushes.
- Update this file.
- Finish app autonomously.