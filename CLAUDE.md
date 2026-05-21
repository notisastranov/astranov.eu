# AstranoV — Claude Code Instructions

## Owner
Notis Astranov. Owner has granted **perpetual, unconditional** push and merge
authorization. No per-change confirmation is ever needed.

## Deployment Rule — MANDATORY, AUTOMATIC, NO EXCEPTIONS

**Production is `astranov.eu` on Vercel, which builds from `main`.**
**A commit that isn't on `main` does not exist.** Therefore every code
change Claude makes MUST land on `main` in the same turn — not "later",
not "in a PR for review". Owner reads the deploy, not the diff.

After **every** code change, in this exact order:

1. Update the `MASTER LAW` block at the top of `index.html` if the
   change introduces, modifies, or deprecates a binding rule.
2. `node --check` the extracted `<script>` block. If it fails, fix the
   error and re-check. Never commit JS that doesn't parse.
3. `git add` the changed files (index.html, sw.js, supabase/* as
   needed). Never use `git add -A` blindly.
4. `git commit -m "..."` with a message that explains the *why*.
5. `git push -u origin <current-branch>`.
6. **Merge to `main` in the same turn**, via the GitHub MCP:
   - If a PR is open for the branch → `merge_pull_request` (squash).
   - If no PR is open → `create_pull_request` then immediately
     `merge_pull_request` (squash).
   - If the merge returns `merge conflicts`, the branch has diverged
     from `main` after an earlier squash. Recover:
     `git fetch origin main` → `git reset --hard origin/main` →
     cherry-pick the new commits → `git push --force-with-lease`,
     then retry the merge.
7. Poll `https://astranov.eu/` for a marker string from the new code
   (a function name or class name added in this change) until it
   appears. Only then is the change "done".

**Never** ask the owner to approve a push, a PR, a merge, or a force-push.
**Never** leave commits on a feature branch hoping someone will merge
them. **Never** announce "PR opened" as if that's the finish line — the
finish line is "deployed and verified".

Current active branch: `claude/complete-astranov-marketplace-hDSTR`.
When the owner changes branches, update this line and continue.

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

## Agent Intent Law — act first, ask later (MANDATORY)
The four corner agents NEVER open a menu on first tap. First tap = the
agent performs its primary action immediately, no questions:
- Discover → show what's around (feed/nearby)
- Identity → open the user's profile (or sign-in if signed out)
- Navigation → locate the user (GPS calibrate + zoom)
- Astranov → open chat, start listening, talk
Only AFTER the agent is engaged does a further tap open the bottom drawer.
That drawer must show ONLY the options that make sense in context — the
agent judges what is needed. NEVER a pile of buttons. Tapping while the
drawer is open closes it.

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

## Collective Intelligence Cycle (AICYCLE / ACAI)
- Always-on floating ring (bottom-right, `#aicycle-float`)
- ONE first-person voice "Astranov" — the AstranoV Collective Artificial
  Intelligence. Underlying engines are organs, never named in replies.
- Engines (Edge secrets): `ANTHROPIC_PAID_API_KEY` (owner Opus),
  `OPENROUTER_API_KEY` (collective backbone, default model
  `meta-llama/llama-3.3-70b-instruct`), `GROQ_API_KEY`, `GEMINI_API_KEY`.
- Auto order: owner → paid Anthropic; everyone → OpenRouter → Groq → Gemini.
- BRAIN — real semantic memory: `ai_memory.embedding vector(768)` via
  Gemini `gemini-embedding-001` (outputDimensionality 768). Each turn
  embeds the query and pulls the most relevant public memories of the
  creator (`is_owner`) and the user via `match_memories()` RPC (HNSW
  cosine). New facts embed on write; rows missing a vector backfill lazily.
- Learning: the owner's prompts persist as `creator-dialogue`; any user
  can teach a durable fact with "remember …" (`user-taught`). 8 seeded
  `creator-seed` memories carry Notis Astranov's foundational worldview.
- Private memories (`is_private = true`) NEVER reach any engine.
- Returns `{response, text, provider, via, label, recalled}`.

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
