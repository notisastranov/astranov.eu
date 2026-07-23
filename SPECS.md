# Astranov SPECS (unified)

**When anyone says "specs" → open this file first.**

| Layer | Path | Role |
|--------|------|------|
| Human | **`SPECS.md`** (this file) | What the product must do |
| Machine | **`astranov-continuity.js`** → `window.AstranovContinuity` | Selectors, owners, doNotRemove |
| Live | https://astranov.eu | Product under SpaceNet globe primacy |
| Repo | https://github.com/notisastranov/astranov.eu | `main` |

### Mandatory agent rule (owner)
**Every product change MUST update this `SPECS.md` in the same change** (and `astranov-continuity.js` when features/selectors change). No silent behavior drift. Deploy SPECS with the code, not “later.”

**Ignore / deleted:** ChatGPT/Claude/Grok session dumps, old `ASTRANOV_GROK_SPECS.md`, living-truth dumps, issues #97/#99 handoffs.

Continuity version target: `20260723190000-map-places`

---

## 1. Mission

Unify internet activity under realistic space imagery — **solar → global → national → city → street** — SpaceNet.  
Globe + globe-deck are primary. Vision notes: `ASTRANOV_SPACENET_MISSION.md` (vision only).

---

## 2. Deploy rules

1. Bump `meta[name=astranov-build]` and every script `?v=` together.
2. Prefer product shell with real CLI / city / vendor (not dummy `js/spartan.js`).
3. Phase-split compact shell (~50KB+) is OK if modules load same-origin.
4. Deploy via GitHub contents / Actions (owner PAT) — do not break the product for "fast path" stubs.
5. Do not reintroduce `astranov-gl.js` split boot or `simulateACI`.
6. **Serve SPECS modules from `/js/` first** (CF github-sha proxy serves `js/*` reliably; some root `astranov-*.js` paths fall through to Vercel SSO).

### 2.1 Product boot order (SPECS-up)

```
three.js
  → phase-critical
  → leaflet/supabase (soft)
  → phase-app → __astranovBootApp
  → phase-features → __astranovBootFeatures
  → /js/astranov-field-hud.js   (FieldHud / miner / radar)
  → /js/astranov-mpp-tile.js    (MenuProfilePostTile / + / locate / video)
  → FieldHud.boot + MenuProfilePostTile.init
  → /js/astranov-os-boot.js → 08-astranov-os + 08-astranov-browser
  → deferred pack on idle/tap
```

Also defer: `astranov-continuity.js` (contract + coach kill + OS boot trigger), `astranov-perf-lazy.js`.

Architect (owner) after sign-in:

```
/js/17-architect-bridge.js → ArchitectBridge.init/arm
CLI: fix | code | dev | edit | bridge …
```

---

## 3. Feature checklist (must keep)

### 3.1 Super-add `+` → MPP tile
- Full **MenuProfilePostTile**, not small globe-super-add.
- Code: `astranov-mpp-tile.js` / `js/astranov-mpp-tile.js`
- Keep: `_bindPlusFab`, `_patchSuperAdd`, `MenuProfilePostTile.openPlusField`

### 3.2 MenuProfilePostTile
- Roles: client, vendor, driver, user, social.
- Market / shops / driver / delivery / social post / connected video peers.

### 3.3 Locate me
- GPS → city map (`CityLife.locateAndDropIn`). Rhodes fallback.
- `#aci-locate` pinned as app-shortcut.

### 3.4 Video call
- Button left of `+` (`#aci-video-call`).

### 3.5 Delivery / marketplace
- Browse → cart → pay AVC → track. Deferred commerce pack.

### 3.5b Delivery DNA (instant pay + street routing)
- **Module:** `js/85-delivery-dna.js` · `window.DeliveryDNA`
- **Instant internal payments:** AVC/Coins balance — no card wait when balance covers total (`pay instant`, cart balance pay, ledger/RPC fallback).
- **City street routing** (OSRM + alternatives, scored):
  - `avoid traffic lights` / `no lights`
  - `avoid populated roads` / `avoid busy`
  - `use hidden roads` / `backstreets` / `quiet`
  - `fast roads` · `avoid motorway` · `avoid tolls` · `reset prefs`
- **CLI:** `dna` · `route …` · `deliver route …` · `pay instant <amount>`
- Patches `DrivingView.fetchRoadRoute` to honor DNA prefs; paints CityMap route.

### 3.6 Miner rig (field HUD only)
- Tap top-right field. **No** `#aci-miner` / miner CLI strip.
- Code: `js/astranov-field-hud.js`

### 3.7 Field HUD radar + speed
- Radar ~8fps; earth speed ~**1671 km/h** global.

### 3.8 Perf-lazy boot
- No `LazyModules.ensure` at 400ms. Defer heavy pack until idle / tap.

### 3.9 AI brain
- BrainNeurons + FieldBrain stay alive; no production stubs.

### 3.10 CLI chrome — **one surface only**
- **Input field always visible:** `#aci-cli-in` textarea in `#globe-deck-input-row` must show even when deck is collapsed (never clip with tiny max-height). Collapsed mode hides log body only.
- **One product CLI:** `#super-cli-bar` inside `#globe-deck`.
- **The top handle of the CLI** is the **only** place for chrome buttons needed at any time (`#os-cli-handle` + existing CLI buttons).
- **Forbidden second bars** (must stay hidden / removed):
  - Floating `#os-dock` above the CLI (unauthorized)
  - Dual `#aci-bar` behind CLI
  - Separate `#app-shortcut-row` as its own bar
  - `#news-ticker`, `#resource-monitor` strips
- **No SpaceNet first-run coach** (`#first-run-coach` / `showFirstRunCoach` permanently off).

### 3.11 Globe physics
- Locked without owner request. Damped trackball (`TRACK_SENS` ~0.0026) allowed.

### 3.11b Zoom tiers → national / city (must work)
- **Path:** solar → global → **national** → regional → **city** → neighborhood/streets.
- **Code:** `js/09-zoom-tiers.js` + embedded copy in `js/phase-critical.js`; `GlobeControl.Z` aligned.
- Typical Z: national ~2.15, regional ~1.78, city ~1.45, neighborhood ~1.15.
- **City handoff:** entering city/neighborhood **opens Leaflet city map** (`CityMap.openAt` / `onCamera`); leaving city returns to globe (`returnToGlobe`).
- `CityMap.ENTER_Z` ~1.50, `EXIT_Z` ~1.90 so national does not stick under the street map.
- Wheel/pinch use tier steps (lower WHEEL/PINCH thresholds) so users can reach country and city normally.

### 3.11c Multi-tile (long-press place) + CLI recovery
- **Module:** `js/62-multi-tile.js` · `window.MultiTile` (loaded after phases; overrides embedded copy).
- **Open:** long-press globe (any tier) or city map (touch **and** desktop mousedown ~480ms); `+` also opens.
- **Must be visible:** inject `#multi-tile-css` (was missing → looked broken).
- **UI required:**
  - **Close** + **Clear**
  - Accurate location: **N/S/E/W nudge**, lat/lng fields, **Apply lat/lng**
  - **Unique place name** from reverse-geocode real state (e.g. island/city/road) + role tag (`Astranov Office` / driver base / …); user-editable
  - **Save** → registry `localStorage` `astranov:places-v1` with stable `id` + unique `name`
- **CLI recovery:**
  - `place list` / `places`
  - `place open <name|id>` (e.g. `place open Rodos Island Astranov Office`)
- Markers: place name + id shown on tile; recoverable after refresh via CLI.

### 3.12 Architect bridge (in-app Grok development)
- Owner only: `notisastranov@gmail.com` after Google sign-in.
- UI: `#aci-bridge` (🛠). Commands: `fix`, `code`, `dev`, `edit`, `bridge`, `bridge status`, `bridge poll`.
- Client: `js/17-architect-bridge.js` → Supabase `coders-bridge` (`architect_push` / pending / answer).
- Desktop watch: `npm run bridge-watch` → `.grok/architect-bridge/CURRENT.md`.
- **This is the path to continue development with Grok bridged inside the app.**
- Paid `XAI_API_KEY` only for architect (server free tier first).

### 3.13 Core brain
- Freeform CLI never "unknown" — act on globe, then optional aicycle.

### 3.14–3.15 Art + helper
- Real earth / atmosphere / day-night. Procedural mecha-angel helper.

### 3.16 Astranov OS
- OS apps (Earth, Browser, Locate, Market, AI, Create, System) mount as **handle buttons on `#super-cli-bar`** (`#os-cli-handle`).
- **Never** a floating `#os-dock` bar above the CLI.
- Panels (System / launcher / browser) open as surfaces — not a second toolbar.
- Code: `js/08-astranov-os.js` · version `20260723-cli-handle`+

### 3.17 Astranov Browser
- Tabs, URL bar, `astranov://` routes, sandboxed https.
- Code: `js/08-astranov-browser.js`.

### 3.18 Astranov theme (logo + accent)
- **Shape:** round corners everywhere product chrome touches (`--an-radius` ~16px, pills for icon buttons).
- **Color:** deep glowing blue Astranov accent
  - base `#1a6fd4`, bright `#3d9eff`, glow `rgba(26,111,212,0.55)`, panels near-black blue (`#00040c` / `rgba(0,8,22,…)`)
- Logo wordmark / status uses glowing blue, not flat gray or multi-rainbow chrome.
- CSS tokens: `--ax-blue*`, `--an-radius*` in OS CSS + index `:root`.

---

## 4. Bridged development loop (owner + Grok)

Use this so work continues **inside** SpaceNet, not only in external chat.

1. Hard refresh https://astranov.eu — confirm build meta + no coach popup.
2. Sign in as architect (Google) → 🛠 bridge arms.
3. In CLI: `dev <task>`, `fix <issue>`, `code <change>`, or chat a natural build task.
4. Task queues to `coders-bridge` with `coder_engine=grok_build`.
5. Desktop (or Grok Build session): read `.grok/architect-bridge/CURRENT.md` / watch script; implement; answer with:
   - `node scripts/architect-bridge-answer.mjs <id> "done: …"`
6. Phone/browser poll delivers reply into CLI / GlobeDeck.
7. Agents: **always** re-read this `SPECS.md` + `astranov-continuity.js` before structural edits.

CLI shortcuts after bridge is armed:

| Command | Effect |
|---------|--------|
| `dev …` / `fix …` / `code …` | Queue architect bridge task |
| `bridge` | Status / arm UI |
| `bridge poll <id>` | Pull answer |
| `specs` (if wired) | Print SPECS version + boot tips |

---

## 5. Verify after every deploy

1. Hard refresh — build meta matches deploy.
2. Network: `/js/astranov-field-hud.js` and `/js/astranov-mpp-tile.js` → **200** from github-sha (not Vercel SSO).
3. `+` → full social MPP tile.
4. Locate → city map (or Rhodes).
5. Video left of `+`.
6. Field HUD → miner panel (no miner strip).
7. No start coach popup.
8. OS dock + Browser after features.
9. Architect bridge when owner signed in.
10. Product CLI / city / vendor — not dummy homepage.

---

## 6. Anti-patterns

- Prefer root-only SPECS modules that 302 to Vercel SSO.
- Revert `+` to small SuperAdd only.
- Bring back miner CLI strip / dual chrome CLI.
- Dual-load remote HTML / `document.write`.
- Ship dummy mini-app as homepage.
- Change globe physics without owner sign-off.
- Remove architect bridge or freeform core brain.
- **Add any second button bar above/below the CLI** (especially floating `#os-dock`).
- Square grey chrome that ignores Astranov deep-blue + round-corner theme.

---

## 7. Code map

| Spec area | Primary files | Marker |
|-----------|---------------|--------|
| Contract | `astranov-continuity.js` | `/* SPECS: continuity source */` |
| Human | **`SPECS.md`** | — |
| Boot shell | `index.html` | `/* SPECS: boot order */` |
| + / MPP / locate / video | `js/astranov-mpp-tile.js` | `/* SPECS: */` |
| Field / miner / radar | `js/astranov-field-hud.js` | `/* SPECS: */` |
| OS boot | `js/astranov-os-boot.js` | pure JS only |
| OS / Browser | `js/08-astranov-os.js`, `js/08-astranov-browser.js` | `/* SPECS: CLI-handle only; no os-dock */` |
| CLI chrome | `index.html` + OS | `#super-cli-bar` / `#os-cli-handle` only |
| Theme | OS CSS + index `:root` | deep blue + round corners |
| Zoom tiers | `js/09-zoom-tiers.js`, `phase-critical` | national/city handoff |
| City map | `js/61-city-map.js` | ENTER/EXIT + long-press MultiTile |
| Multi-tile places | `js/62-multi-tile.js` | long-press, name, nudge, CLI `place` |
| Delivery DNA | `js/85-delivery-dna.js` | instant pay + street route prefs |
| Architect bridge | `js/17-architect-bridge.js` | phone → Grok Build |
| Coach off | continuity + phase-features | `killFirstRunCoach` / no-op coach |

---

## 8. Sync rule (non-negotiable)

1. **Every product change** updates **this `SPECS.md`** in the **same** PR/push as the code.
2. Feature/selector/CLI changes also update **`astranov-continuity.js`** (`window.AstranovContinuity`).
3. Keep in-code `/* SPECS: … */` banners accurate on modules touched.
4. Prefer English UI strings; never leave UTF-8 mojibake (looks like “Chinese” garbage).
5. If a change was shipped without SPECS, **fix SPECS immediately** before more features.
