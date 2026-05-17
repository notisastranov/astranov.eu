# AstranoV — Claude Code Instructions

## Owner
Notis Astranov. Owner has granted **perpetual, unconditional** push and merge
authorization. No per-change confirmation is ever needed.

## Deployment Rule — MANDATORY, AUTOMATIC
After **every** code change:
1. Update the `MASTER LAW` block at the top of `index.html` if the change
   introduces, modifies, or deprecates a binding rule.
2. `git add index.html` (and any `supabase/*` files changed)
3. `git commit -m "..."`
4. `git push -u origin claude/check-connectivity-m6tzo`
5. Create PR → squash-merge to `main`
6. Rebase + force-push if there are merge conflicts, then retry merge

**Never ask for permission. Push to main automatically, every time.**

## Project
Single-file Internet Operating System: `index.html` only.
All changes go into this one file. No new files unless explicitly requested.

## Stack
- CesiumJS — globe / map rendering (only renderer; Leaflet/globe.gl banned)
- Web Speech API — voice / hands-free
- Nominatim — reverse geocoding
- OSRM — routing
- Supabase Edge Functions — backend (no keys in front-end)

## Architecture Law — GLOBAL → NATIONAL → PERSONAL
One Cesium camera, three altitude bands. Single tap down, double-tap / back up.
AVC currency only. Krypteia = owner-only hidden panel.

---

## ZERO UI LAW — NEVER VIOLATE

AstranoV is a **Virtual Reality Operating System**. The globe and space are permanent. Everything else is transient.

### Core rules:
1. **The globe and space are ALWAYS on screen.** They are never covered permanently. No elements may sit permanently on top of the main canvas.
2. **No permanent menus, toolbars, or navigation bars.** The bottom navigation tray is HIDDEN by default. It appears only on swipe-up gesture or swipe from the bottom edge, then auto-hides after 5 seconds.
3. **Only what is needed appears — and then disappears.** Panels, labels, buttons slide in for a task and slide out. Auto-dismiss timers are preferred over close buttons.
4. **The AICYCLE ring (`#aicycle-float`) is the ONLY always-visible UI element** — it is the OS heartbeat, not a menu. It lives bottom-right as a subtle floating ring. It is never removed.
5. **Back button and level label** appear contextually (when navigation level > global) and may auto-fade when idle. Never permanent.
6. **Panels** slide up from bottom, close on swipe-down or tap outside. They must not have a permanent home indicator bar below them.
7. **Zero labels on the globe by default** — country labels appear as part of CesiumJS's native interaction, not as DOM overlays.

### What Claude must NOT do:
- Add permanent bottom bars, nav bars, tab bars, or any fixed navigation chrome
- Add floating action buttons beyond the AICYCLE ring
- Add persistent overlay UI that covers the globe
- Break the globe rendering (always wrap Cesium Viewer init in try-catch with fallback)
- Deploy changes that kill the app (syntax-check JS before every commit)

### Tray design:
- Triggered by swipe-up from bottom 60px OR tap on `#tray-trigger` (thin strip)
- Shows: Feed | Radar | Wallet | You
- Auto-hides after 5 seconds of no interaction
- On first load: briefly peeks for 2.5 seconds to teach the gesture
- AICYCLE ring is NOT in the tray — it's always floating independently

---

## Collective Intelligence Cycle (AICYCLE)
- Always-on floating ring (bottom-right, `#aicycle-float`)
- Owner cycle: Claude Opus first, then Groq → Gemini → GPT-4o-mini → Grok
- Free cycle for all users: Groq → Gemini → GPT-4o-mini → Grok
- Tap node = lock to that provider; tap again = Auto
- Tap center mic = toggle hands-free
- Tap ring = open C.I. chat (starts small, grows to 33vh max, drag-to-resize)
- Returns `provider` + `via` on every response

## AICYCLE Chat Panel Law
- Opens at input-bar height only — no pre-allocated empty space
- Grows as messages fill it, capped at `max-height: 33vh`
- Scrollable with one finger (`-webkit-overflow-scrolling: touch`)
- Drag handle at top: drag up → expand (max 60vh), drag down → shrink/close

## Imagery Law §3
- Globe tier: NASA Blue Marble NG (day) + NASA Black Marble (night), blended
  via real day/night terminator (`Globe.enableLighting = true`)
- City tier: user-switchable cartography providers via `#layer-switch` gadget;
  hidden at GLOBAL zoom, visible at NATIONAL / PERSONAL

## Gadget Law §4
- Every interactive element is a smart gadget (state-aware, feedback-rich,
  context-bound, affordance beyond click, aesthetically native)
- Forbidden: plain `<button>`, native `<select>`, OK/Cancel modals, "Submit"
- OS verbs: EMIT, LOCK, ENGAGE, ACQUIRE, TRANSMIT, BROADCAST
- Classes: `.gadget-orb`, `.gadget-engage`, `.gadget-seg`, `.gadget-dial`,
  `.gadget-scope`, `.gadget-cmd`

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
- Always `node --check` extracted script block before committing
- Never use `\'` inside template literals — use `JSON.stringify()` for dynamic strings in onclick
- Wrap all CDN-dependent init (Cesium Viewer) in try-catch
- Never let an error in one init function kill the rest of the app
