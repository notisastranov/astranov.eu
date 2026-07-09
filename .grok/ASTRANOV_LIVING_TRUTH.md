# ASTRANOV LIVING TRUTH (Grok-built Source of Truth - 2026-07-09)

**Purpose:** Single source of truth distilled from all research: SPECS.md, CLAUDE.md, current codebase (src/, shell, index.html, supabase/, scripts/), git history, remote GitHub, previous sessions, user requirements.

**Core Identity:**
- App: Astranov (English letters only). 3D globe as the ONLY permanent UI surface.
- "Planetary Internet Operating System".
- User: Αξάς (Greek dialect voice responses natural).
- No Grok branding in UI.
- Deploy only to https://astranov.eu (Vercel `astranov` project), central repo notisastranov/astranov.eu.

**Fundamental Law - Globe Primacy + Celestial Circles UI (STRICT - NEVER VIOLATE):**
- Globe (Three.js r128 + procedural layers) is the only surface.
- NO rectangles, modals, panels, sidebars, trays, tabs, boxed content as primary UI.
- ALL UI = floating "celestial circles":
  - Frosted glass (backdrop-filter: blur(28px)), thin rim, type-specific glow.
  - Radial mask for content readability.
  - Rim-arc for scroll.
  - Drag on rim (outer 12%), scroll/pinch inside.
  - Pinch scales content then circle.
  - Tap outside or pinch-collapse to dismiss.
  - Long-press rim to pin.
  - Auto-place in empty quadrants; remember positions.
  - Can constellation-link.
- 4 Primordial Circles (always present):
  1. Economics Circle (top-left, green glow): wallet, AVC, ledger.
  2. Radar Circle (top-right, amber): orders, vendors, ETAs.
  3. AI Circle (bottom-right, violet): CIC heartbeat, providers, mic, locks. Hosts ACI chat.
  4. View Circle (on-demand, white-blue): universal carrier for chat, menus, video, posts, settings, auditor, etc.
- Use Circles.spawn({type, glow, content, ...}) for all transient UI.
- Globe interactions always available (drag rotate, wheel zoom, click focus).

**Real Technology Only (NO SIM):**
- WebRTC: real getUserMedia + RTCPeerConnection + STUN, clipboard offer for P2P.
- Orbital: real requestOrbitalTech(), no Starlink/SpaceX branding.
- Routing: real great-circle + cycling + safety vs positions.
- AIGraphics: 100% canvas procedural.
- Voice: Web Speech 'el-GR', marker-triggered, short, provoke "Τι θες Αξάς;".
- ACI: Full /functions/v1/aci with think/evolve/log/teach/stats/seed. aicycle (RAG), brain (autonomous_evolve), council (self_judge). Neurons in ai_memory. 15min heartbeat. Ground before response. No babysitting.
- Pilot ΤΗΛΕΜΑΧΟΣ: procedural 3D with animation.
- groupOrder: real drone + pilot animation on route.

**Architecture:**
- Modular src/*.js assembled to index.html (via assemble.mjs or bootstrap).
- Supabase for auth, memory, functions (aci, auditor, etc.).
- On-demand permissions only.
- Default: silent globe at Greece point (36.22, 28.12).
- Domain guard.

**Current State (Research 2026-07-09):**
- Evolved to modular src/ + index.shell.html -> index.html.
- Has GlobeDeck (rectangular violation - must refactor to circle).
- ACI partial, voice, globe core present.
- Auditor features added (GL, payroll).
- Coders hub, super-cli exist but rectangular.
- Violations present: #globe-deck, auth-modal, fixed chips, bottom panels.
- No Circles system implemented yet.
- Build/deploy scripts updated.
- Remote: notisastranov/astranov.eu (main has assembled version).
- Local has uncommitted auditor, script updates, previous branding fixes.

**To Finish (Autonomous):**
- Implement Celestial Circles system.
- Refactor all rect UI to circles (GlobeDeck -> View/AI circle content, remove modals/panels).
- Complete ACI integration, voice, WebRTC, pilot, auditor UI in circles.
- Ensure pure globe start, no upfront UI.
- Clean assembly, update SPECS.
- Push/deploy autonomously using granted access.
- Maintain perpetually.

**Forbidden (enforce):**
- Rectangles as primary.
- Sim language.
- Unauthorized brands.
- English name translit.

This is the contract. Act on it.