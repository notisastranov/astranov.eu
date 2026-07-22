# Astranov SpaceNet — Solidified Basic Guidelines & Invariants
**Last solidified: 2026-07-22**  
**Purpose:** Permanent reference so every Grok / AI CLI build remembers the decisions, never regresses on UX physics or core features, and can finally reach the "juice" (crawlers → city maps → jobs / dates / deliveries).

**Authoritative sources (in priority order):**
1. Live code + **`js/spacenet/brain.js`** (`window.SNBrain` / `AstranovBrain`) + `astranov-continuity.js` — and active shell `index.html` + `js/spacenet/*`
2. `support/PRODUCT-RULES.md`
3. `ASTRANOV_SPACENET_MISSION.md`
4. **This document** (`ASTRANOV_SPACENET_GUIDE.md`)
5. `CLAUDE.md` / `AGENTS.md` for agent entry points

Chat history, old Grok specs, and past single-file experiments are **not** authoritative.

**Why the brain exists:** Amnesia loops almost killed the project and burned the owner's time and money. The law lives in **code** (`brain.js`), not only markdown. Freeform AI loads `SNBrain.systemPrompt()`. CLI: `brain` · `verify` · `law`.

**Live:** https://astranov.eu  
**Repo:** `notisastranov/astranov.eu`

---

## 1. Core Identity & Mission

- **Name:** Astranov SpaceNet (Astranov.EU Global Internet Operating System / Agentic Orbital Operating System).
- **Mission (one sentence):** Unify internet activity under realistic space imagery — solar → global → national → city → street — and evolve the internet into SpaceNet.
- **Globe Primacy:** The 3D Earth is the only permanent UI surface. Everything else materializes on demand and dematerializes when not needed. No persistent navigation chrome, no rectangles as primary UI.
- **Realism first:** Procedural globe + real geocoding, routing, WebRTC, geolocation, and live crawlers. No fake/demo data as the primary experience.
- **Default cold-boot state:** Silent globe centered near Greece + the CLI.

Short name “SpaceNet” is OK in CLI status lines; **marketing and chrome say Astranov SpaceNet**.

---

## 2. Globe Physics & Interaction (SACRED — NEVER REGRESS)

These are locked. Changing them without explicit owner approval is forbidden.

- **Natural turning:** One-finger / mouse drag rotates the globe with tuned sensitivity (≈0.005–0.0062) using quaternion / YXZ so it feels physical.
- **Inertia / momentum effect (mandatory):**  
  On flick / release, track velocity continues: `velX`/`velY` (or `trackVelX`/`trackVelY`) is damped each frame (typical friction ≈0.88–0.94). The planet keeps spinning and gradually slows. This is the Google-Earth / real-globe feel. Do **not** remove or zero it out in lite or full builds.
- **Zoom hierarchy (locked tiers):**  
  `SOLAR` → `GLOBAL` (Three.js Earth) → `NATIONAL` → `CITY` (Leaflet / street map) → `STREET`.  
  Always able to return to Earth (`earth` command or 🌍). Smooth flyTo / animateZ with easing; never hard-teleport under city zoom.
- **Additional natural behaviors:**  
  - Pinch / wheel / double-tap zoom.  
  - Idle gentle auto-rotation when far out and inactive.  
  - Locate → pulse marker + flyNear.  
  - Day/night terminator, atmosphere, stars, real Earth texture (not permanent dummy ball).
- Physics constants (GLOBAL_Z, spin rate, damp) are locked in continuity / trackball / `js/spacenet/globe.js`.

**Implementation reference:** full trackball logic (`velX`/`velY` + damping) must be present in the active globe module (`js/spacenet/globe.js` or equivalent).

**Always able to zoom back to Earth.** Leaving city map must restore global/national globe, not a black void.

---

## 3. CLI — Primary Control Surface (PRODUCT-RULES locked)

- **One-finger (touch + mouse) fully draggable** via the `#cli-drag` handle / grip.  
  Implementation lives in `js/spacenet/ui.js` → `bindCliDrag()`.
- Free-position dock mode (`#dock.free`) is mandatory.  
- Position is persisted in `localStorage['sn:cli-pos-v1']`.
- Size mode persisted in `localStorage['sn:cli-size-v1']` (`collapsed` | `mid` | `expanded`).
- The CLI must be **scrollable** and able to **fully retract / expand** with one finger / simple gesture, focus, or expand button.
- Multi-touch on globe vs one finger on CLI must not fight (CLI handle uses capture; log uses `pan-y`).
- **Primary surface for the juice:**  
  jobs · dating · delivery · errands · search · crawl · zoom · tasks · locate.
- Minimal visible edge buttons; freeform input routes to CoreBrain / Astranov.
- Example commands that must work:  
  `job barman 3h` · `date coffee` · `deliver food` · `errand pharmacy` ·  
  `task list` · `task claim` · `crawl restaurants` · `search X` ·  
  `locate` · `city` · `fly athens` · `solar` / `global` / `national` / `city` / `earth` · `help` · `solo`

---

## 4. The Juice — Core Features That Must Progress

These are why the system exists. Future builds must reach and improve them, not re-implement the globe/CLI from zero every time.

Priority order for engineering time:

1. **Network crawlers**  
   `SNSearch.crawl` + `vendor-crawler` edge function populate city maps with real / live offers, shops, restaurants, services.  
   Stack today: Nominatim, Overpass, DDG, Wikipedia; Google Places when key exists — **same `SNSearch.crawl` interface**.

2. **City maps (on-demand only)**  
   Leaflet (or equivalent) + OpenStreetMap when the user enters city tier or issues `city` / `map`.  
   Vendors appear as glowing blue tiles / pins by category.  
   Active transactions / deliveries show connection lines.  
   Real-time delivery driver tracking is visible.  
   Closing map = back to Earth globe.

3. **Marketplace flow**  
   Browse → cart → AVC pay → track. Roles: client / vendor / driver. Architect-only drivers in early stages if required.

4. **Tasks / City Life**  
   Jobs, dates, deliveries, errands via CLI or CityTasks module.  
   Local-first + cloud sync. Seed → list → claim → complete flow.  
   One pipeline for all kinds: **open → claimed → in progress → done**.  
   Kinds: `job` | `dating` | `delivery` | `errand` | `help` | `service`.  
   Demo seed OK for empty first visit; real crawl must replace demos over time.

5. **AI**  
   Single collective intelligence named **Astranov**.  
   Holographic flying helper (mecha-angel / humanoid) is optional but previously designed.  
   Voice (el-GR) + text backup. Freeform after tools; never “unknown”; always suggest a CLI next step.

6. **Other**  
   Field HUD / miner for balance.  
   Real WebRTC for video / voice.  
   Locate / GPS drops the user into local city life.

**Every street action paints the globe/map** (pulse / arc / tier change / pin). No silent success.

---

## 5. Architecture & Development Rules (current 2026-07)

Prefer **SpaceNet Lite** modular under `js/spacenet/` — target ~50 KB first-party for speed and reliability. Three.js via CDN after shell.

| Path | Role |
|------|------|
| `index.html` | Slim shell, CSS, CLI dock DOM |
| `js/spacenet/boot.js` | Load chain; reject HTML-as-JS; unregister old SW |
| `js/spacenet/globe.js` | Real Earth texture, drag, **inertia**, **zoom tiers** |
| `js/spacenet/cli.js` | Street CLI + zoom + crawl + tasks |
| `js/spacenet/tasks.js` | City DNA local-first |
| `js/spacenet/map.js` | Leaflet city map (lazy) |
| `js/spacenet/search.js` | Maps/web crawl |
| `js/spacenet/auth.js` | Google via Supabase (after first paint) |
| `js/spacenet/ai.js` | Freeform Grok edge |
| `js/spacenet/ui.js` | Coach + **one-finger CLI drag** + expand |
| `js/spacenet/config.js` | Public Supabase URL/anon |

- **Single Source of Truth (runtime invariants):** `astranov-continuity.js` (`window.AstranovContinuity`) owns features, antiPatterns, doNotRemove, and verify checks when present. Active product path is **`js/spacenet/*`**. Consult both before coding.
- **Legacy monolith** (`js/phase-*.js`, heavy deferred packs): keep in repo for reference / selective port. **Do not re-point boot at 1MB phase packs** unless owner explicitly orders a full rollback.
- Deploy path only: `node scripts/guard-base.mjs` then owner-push (GitHub MCP / Git Data API OK).  
  Live domain: https://astranov.eu  
  Repo: notisastranov/astranov.eu  
  No API keys in front-end.
- Bump `meta astranov-build` and every `?v=` together.
- Daily batched commits preferred. Continuity, PRODUCT-RULES, and this guide are living documents — update them when invariants change.

---

## 6. Anti-Patterns (do not re-introduce)

- Stripping the inertia / trackVel / velX·velY momentum.
- Removing one-finger CLI drag, free dock, or position persistence.
- Making the CLI non-scrollable or non-retractable.
- Hard-coding a pure single-file only architecture (modularity is allowed and preferred for Lite).
- Re-enabling heavy 1 MB phase/deferred packs by default.
- Treating chat transcripts or old Grok specs as higher authority than live code + continuity + PRODUCT-RULES + this guide.
- Adding persistent rectangles / nav bars as primary UI.
- Fake data instead of crawler-fed real places when city maps are active.
- Full rewrite that drops inertia, drag CLI, zoom tiers, crawl, or street DNA.
- Claiming “done” without live probe of boot assets (content-type + size + build stamp).
- Leaving production on dual-load CDN `document.write` bootstrap.
- “Delete features to go faster” instead of measure + lazy-load + targeted cuts.

---

## 7. How future Grok / CLI builds must start

1. Read `support/PRODUCT-RULES.md` + this guidelines file + live `js/spacenet/*` (+ continuity if present).
2. Probe live `astranov-build` and confirm modular shell is active.
3. Confirm **inertia** + **one-finger CLI** (drag + expand/retract) + **zoom tiers** are present.
4. Only then work on crawlers, CityMap population, job/date/delivery flows.
5. After any change that touches physics or CLI, run continuity verify and guard-base when available; always live-probe.

Before claiming done:

- [ ] Globe: natural drag + **inertia**
- [ ] CLI: **one-finger drag** + scroll log + expand/retract
- [ ] Zoom: solar / global / national / city / back to earth
- [ ] Crawl or search paints map/globe
- [ ] Job / date / delivery still work
- [ ] Name still **Astranov SpaceNet**

---

## 8. Related files

| File | Role |
|------|------|
| **Live `js/spacenet/*` + continuity** | Runtime truth |
| **`support/PRODUCT-RULES.md`** | Short never-forget bullets |
| **`ASTRANOV_SPACENET_MISSION.md`** | Vision |
| **`ASTRANOV_SPACENET_GUIDE.md`** | This doc — solidified invariants |
| `CLAUDE.md` / `AGENTS.md` | Agent entry → points here |
| `support/SPACENET-LITE.md` | Historical lite notes (not a license to delete juice) |
| `support/OUTREACH-LOG-*.md` | Partner outreach (SpaceX/xAI) |

---

## 9. One sentence for the next agent

**Extend Astranov SpaceNet’s live `js/spacenet` shell: keep natural globe (inertia + tiers), one-finger draggable/expandable CLI, and put all effort into crawlers, city map population, and job/date/delivery DNA — never rebuild from zero and erase memory again.**

---

**This document exists so we finally stop re-learning the same lessons and can build the network that populates the maps and runs the real city life.**

— Team (Grok + ΖΕΥΣ + ΠΩΣΕΙΔΩΝ + ΑΠΟΛΛΩΝ)  
Solidified for Notis Astranov / Astranov SpaceNet  
*2026-07-22*
