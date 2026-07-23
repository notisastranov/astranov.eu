# Astranov SPECS (sole authority)

**When anyone says "specs" → this file first.** Every product change updates this file in the same deploy.

| Layer | Path | Role |
|--------|------|------|
| Human | **`SPECS.md`** | Product contract |
| Machine | **`astranov-continuity.js`** → `window.AstranovContinuity` | Selectors / owners |
| Live | https://astranov.eu | SpaceNet product |
| Repo | https://github.com/notisastranov/astranov.eu · `main` | Source of truth |

Continuity stamp: `20260723340000-clean-shell`

---

## 1. Mission

**SpaceNet:** unify internet activity under realistic space imagery  
**Path:** solar → global → national → city → street  
**Primary surface:** 3D Earth + **one** bottom CLI (`#globe-deck`).  
No second chrome bars. No pastel toy UI. No permanent start popups.

---

## 2. Visual system (mandatory)

### 2.1 Palette — deep space (not light blue)

| Token | Value | Use |
|-------|--------|-----|
| Void | `#000000` | Page / globe behind |
| Ink | `#02060c` | Deep panels |
| Text | `#b8c4d4` | Primary copy (steel, not cyan) |
| Dim | `#5a6a7e` | Meta / muted |
| Accent | `#1e4d8c` → hot `#3d6eb0` | Borders, focus, logo |
| Glow | `rgba(24,64,120,0.4)` | Soft, not neon cyan |
| User/cmd | `#5a7ab0` | CLI user lines |
| OK / Err | `#3d9a6a` / `#c44a5a` | Status only |

**Forbidden:** pastel cyan (`#7df`, `#3d9eff` floods), rainbow chrome, solid white panels, “coders lab” light-blue cards, orphan CSS tokens (`#8ab;`, `#00dd77;` mid-rules).

### 2.2 Shape
- CLI radius ~12px, handle buttons 8px rounded rects (Grok density)
- Logo = pill
- Glass: dark translucent panel + subtle navy border + soft glow (not bright ice blue)

### 2.3 CLI = Grok Build fork
Look **and** work like this agent’s TUI:
- Session strip → tool handle → mono scrollback (left accent bars) → `›` prompt
- Enter send · Shift+Enter newline · ↑↓ history · Ctrl+K clear
- Slash: `/help` `/clear` `/status` `/doctor` `/theme` `/compact` `/fix` `/code` `/dev` `/bridge`
- Agent turn: `›` user → thinking → `◆` tools → reply
- Past turns compact into foldable **cases**
- Modules: `js/90-grok-cli-parity.js`, `js/91-cli-gestures.js`

---

## 3. Chrome rules

### 3.1 One CLI surface
- `#super-cli-bar` **inside** `#globe-deck` only
- Top-right: **Send** then voice — **no permanent `+`**
- Full-width `#aci-cli-in` always visible when deck collapsed (body/log may hide)
- Prompt always `›`

### 3.2 Forbidden second bars
- `#os-dock`, `#aci-bar`, `#app-shortcut-row` as a bar, `#news-ticker`, `#resource-monitor`
- `#first-run-coach` / SpaceNet start popup — permanently off
- Sticky red error overlays — errors go to CLI scroll only

### 3.3 Touch / Earth isolation
- `#globe-deck { pointer-events: auto }` — scroll never spins Earth
- Log: `touch-action: pan-y` · **overscroll past top OR past bottom** (scrolled all the way down + keep going) → minimize CLI
- Handle: tap toggle · drag resize
- Module: `js/91-cli-gestures.js`

### 3.4 Add / MultiTile
- **Primary:** long-press any point (solar → city globe + city map) → MultiTile
- **No permanent `+`**
- If add is attempted and fails → offer `#super-add-fab` on CLI bar only (`js/92-add-plus-offer.js`, `body.cli-offer-plus`)
- Hide `+` again after successful open
- CLI recovery: `place list` · `place open <name|id>`

---

## 4. Boot (must not black-screen)

```
three.js
  → phase-critical → __astranovBootCritical → remove #boot
  → leaflet / supabase (soft)
  → phase-app → phase-features
  → field-hud · mpp-tile
  → 62-multi-tile · 17-architect-bridge · 85-delivery-dna
  → 90-grok-cli-parity · 91-cli-gestures · 92-add-plus-offer
  → os-boot · 08-os · 08-browser
  → deferred idle
```

Rules:
1. Boot IIFE must **parse** (balanced braces). Broken nested `.then` is a ship-blocker.
2. `done()` after critical Earth is up; **8s failsafe** removes `#boot` anyway.
3. Soft loads never block Earth.
4. Bump `meta astranov-build` + all `?v=` together.
5. Prefer `/js/*` paths (CF github-sha proxy).

---

## 5. Feature checklist

| Area | Requirement | Code |
|------|-------------|------|
| Earth | Damped trackball, zoom tiers solar→city | `phase-critical`, `09-zoom-tiers` |
| City map | Enter city/neighborhood → Leaflet | `61-city-map` / CityMap |
| Locate | GPS → city; Rhodes fallback | `#aci-locate` |
| MultiTile | Long-press places, name, nudge, cases | `js/62-multi-tile.js` |
| Delivery DNA | Instant AVC pay + street prefs | `js/85-delivery-dna.js` |
| Bridge | Owner `fix/code/dev` → Grok Build | `js/17-architect-bridge.js` |
| OS / Browser | Apps on CLI handle only, no dock | `js/08-astranov-os.js` |
| Field HUD | Miner / radar top-right field | `js/astranov-field-hud.js` |
| Brain | Freeform never “unknown” | `AstranovCoreBrain` |

---

## 6. Zoom tiers

Typical Z: national ~2.15 · regional ~1.78 · city ~1.45 · neighborhood ~1.15  
City enter ~1.50 · exit ~1.90  
Long-press MultiTile on **all** tiers.

---

## 7. Bridged development (owner)

1. Hard refresh live; confirm build meta  
2. Sign in as architect → bridge arms  
3. CLI: `dev` / `fix` / `code` or natural language  
4. Supabase `coders-bridge` · `coder_engine=grok_build`  
5. Desktop: `npm run bridge-watch` · answer via architect-bridge script  

---

## 8. Deploy

1. GitHub Contents API with owner PAT (User env) preferred  
2. Never ship stub homepage / dual-load catastrophe  
3. Same push: code + **SPECS.md** + continuity when selectors change  
4. Unregister SW on shell (avoid stale black screens)

---

## 9. Do not reintroduce

- Corrupted mega-CSS (orphan `#8ab;`, half-selectors, light cyan floods)
- Permanent `+` on the bar  
- Floating OS dock / dual CLI bars  
- Sticky red error bars  
- First-run coach  
- Unbalanced boot IIFE  
- “Bright ice blue” Grok-pastel on product chrome  

---

## 10. Definition of healthy

1. Hard refresh → Earth visible &lt; 3s, boot overlay gone  
2. CLI deep dark glass, steel text, navy accent — **not** light blue  
3. Scroll CLI without spinning Earth  
4. Handle tap minimize / drag resize  
5. Long-press opens MultiTile; no permanent +  
6. Type in CLI → agent turn in scrollback  
7. No coach, no dock, no stuck black “Earth?/p>”  
