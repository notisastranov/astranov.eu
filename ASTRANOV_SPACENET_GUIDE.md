# Astranov SpaceNet — System Guide (AUTHORITATIVE)

**Read this file first on every Grok Build / agent session.**  
**Live:** https://astranov.eu  
**Repo:** `notisastranov/astranov.eu`  
**Last solidified:** 2026-07-22  

If anything in chat history, old escalations, or “rebuild from scratch” impulses conflicts with this guide, **this guide wins**.

---

## 0. Why this document exists

Owner pain (repeated across many sessions):

1. Agent **forgets** product rules every continuation.  
2. Agent **rebuilds from scratch** chasing speed, **wiping** juice features.  
3. Same bugs return: lag, dummy globe, no zoom tiers, no crawl, no inertia, non-draggable CLI.  
4. Work never reaches the **real product**: network crawlers, populating city maps, jobs, dating, delivery.

**Stop the amnesia loop.** Extend the live modular shell. Do not delete the product to “make it faster.”

---

## 1. Product identity

| | |
|--|--|
| **Name** | **Astranov SpaceNet** (full name in title, logo, PWA, help) |
| **Mission** | Unify internet + city life under a zoomable cosmos: **solar → global → national → city → street** |
| **Primary UI** | 3D Earth + **CLI** (not a pile of modals) |
| **Juice (the actual product)** | Crawlers · city map population · find job · find date · delivery tasks · claim/progress/done — **all depicted on the globe** |

Short name “SpaceNet” is OK in CLI status lines; **marketing and chrome say Astranov SpaceNet**.

---

## 2. The juice — work here, not on endless reboots

Priority order for engineering time:

1. **Network crawlers** — geocode, nearby POIs, web/knowledge, paint results on globe + city map.  
2. **City map population** — shops, jobs, dates, deliveries as real markers users can act on.  
3. **Street DNA (same pipeline for all work)**  
   - **Jobs / gigs** — post, list, claim, complete  
   - **Dating** — invite, accept, meet flow  
   - **Delivery** — post/order, claim, en route, delivered  
   - **Errands / help** — same claim DNA  
4. **Realistic depiction** — every action → pulse / arc / tier change / map pin.  
5. **AI (Grok)** — freeform after tools; never “unknown”; always suggest a CLI next step.

Secondary (only after juice works smoothly): OS dock browser chrome, miner field, video, heavy deferred packs.

---

## 3. Architecture (current live — do not throw away)

**Active runtime (2026-07-22+):** modular shell under `js/spacenet/`.

| Path | Role |
|------|------|
| `index.html` | Slim shell, CSS, CLI dock DOM |
| `js/spacenet/boot.js` | Load chain; reject HTML-as-JS; unregister old SW |
| `js/spacenet/globe.js` | Real Earth texture, drag, **inertia**, **zoom tiers** |
| `js/spacenet/cli.js` | Street CLI + zoom + crawl + tasks |
| `js/spacenet/tasks.js` | City DNA local-first |
| `js/spacenet/map.js` | Leaflet city map (lazy) |
| `js/spacenet/search.js` | Maps/web crawl (Nominatim, Overpass, DDG, Wikipedia) |
| `js/spacenet/auth.js` | Google via Supabase (after first paint) |
| `js/spacenet/ai.js` | Freeform Grok edge |
| `js/spacenet/ui.js` | Coach + **one-finger CLI drag** + expand |
| `js/spacenet/config.js` | Public Supabase URL/anon |

**Legacy monolith** (`js/phase-*.js`, `astranov-deferred.js`, old `astranov-continuity.js` features): keep in repo for reference / selective port. **Do not re-point boot at 1MB phase packs** unless owner explicitly orders a full rollback.

**First-party budget:** keep boot path small (tens of KB). Heavy CDN (Three.js, Leaflet, Supabase) is OK if loaded sensibly.

---

## 4. Globe — physics & zoom (never “forget”)

### 4.1 Feel

- **Natural turn:** one-finger / mouse drag rotates Earth (not jumpy, not inverted).  
- **Inertia:** on release, rotation **continues and decays** (trackball-style). No dead stop.  
- **Real globe:** Earth albedo texture + clouds + atmosphere — not a solid blue low-poly ball as the end state.  
- **Perf without dummy:** throttle idle FPS; full rate while dragging; pause heavy work under city map.

### 4.2 Zoom tiers (invariant)

| Tier | Meaning | User must always reach |
|------|---------|------------------------|
| SOLAR | Far system view | `solar` |
| GLOBAL | Whole Earth | `global` / `earth` / 🌍 / Earth button |
| NATIONAL | Country / region | `national` · locate often lands here |
| CITY / STREET | Street map | `city` · scroll past city z · map button |

**Always able to zoom back to Earth.** Leaving city map must restore global/national globe, not a black void.

Double-click / scroll past city threshold may open street map; closing map returns to globe at GLOBAL (or last non-city tier).

### 4.3 Depict every action

Jobs, dates, deliveries, crawls, locate → **globe pulse** (and map markers when city open). No silent success.

---

## 5. CLI — interaction contract (never “forget”)

### 5.1 One-finger drag (position)

- CLI panel **must be draggable with one finger** (and mouse).  
- Drag handle: top grip `#cli-drag` (not the text input).  
- Persist position: `localStorage['sn:cli-pos-v1']`.  
- Code: `js/spacenet/ui.js` → `bindCliDrag()`.  
- Multi-touch on globe vs one finger on CLI must not fight (CLI handle uses capture; log uses `pan-y`).

### 5.2 One-finger expand / retract (height)

- Vertical gesture on the CLI chrome (drag handle) **fully expands or fully retracts** the panel (collapsed ↔ expanded ↔ optional min chrome).  
- Log area must remain **one-finger scrollable** (`touch-action: pan-y` on `#cli-log`).  
- Expand control (▴) remains; gesture is the mobile-native path.

### 5.3 CLI is the product surface

Commands the product lives on (keep working; extend, don’t delete):

```
help | solo | login | logout
solar | global | national | city | earth
locate | fly <place> | crawl <q> | maps <q> | search <q> | google <q>
job … | date … | deliver … | errand …
task list | task claim | task done | task catalog
```

---

## 6. Crawlers & city maps (the juice)

### 6.1 What “crawl” means

When user says `crawl`, `maps`, `search`, `google`, `find`:

1. Search **local tasks** (DNA).  
2. **Geocode** place names (OSM Nominatim or better).  
3. **Nearby POIs** for city population (Overpass or Google Places if key exists).  
4. **Web/knowledge** (DDG / Wikipedia / edge AI).  
5. **Paint** on globe + open city map with markers when relevant.

Without a Google Maps billing key, use OSM stack; when key exists, plug into same `SNSearch.crawl` interface — **do not invent a second crawl API**.

### 6.2 City map rules

- Lazy-load Leaflet (or successor).  
- Dark basemap OK (Carto/Esri).  
- Populate from: open tasks, crawl results, user pin.  
- Closing map = back to Earth globe.

### 6.3 Street DNA rules

One pipeline for all kinds: **open → claimed → in progress → done**.  
Kinds: `job` | `dating` | `delivery` | `errand` | `help` | `service`.  
Demo seed OK for empty first visit; real crawl must replace demos over time.

---

## 7. Performance — how to be fast without amnesia

| Do | Don’t |
|----|--------|
| Lazy-load map, auth SDK, heavy AI | “Delete features to go faster” |
| Fetch-before-eval same-origin JS; reject HTML SPA `/login` | Assume every `.js` URL is JS on Vercel |
| Unregister stale service workers on boot | Ship dual `document.write` / jsDelivr shell |
| Throttle idle WebGL | Re-enable full deferred 600KB on every load |
| Port one juice feature at a time into `js/spacenet/` | Reboot entire product every session |

**Owner-confirmed lag is P0.** Fix with measurement and targeted cuts, not blank rewrites.

Historical lag write-ups (context only): `ENGINEERING-ESCALATION-2026-07-05.md`, `ENGINEERING-ESCALATION-2026-07-20.md`.

---

## 8. Anti-patterns (banned)

1. **Full rewrite** that drops inertia, drag CLI, zoom tiers, crawl, or street DNA.  
2. Claiming “done” without live probe of boot assets (content-type + size).  
3. Leaving production on dual-load CDN `document.write` bootstrap.  
4. Windows `gh auth login` loops when GitHub MCP / token push works.  
5. Fake planets, fake “SETI” public copy, truth violations (see living truth if present).  
6. Treating chat transcripts as the only memory — **update this guide** when owner adds rules.  
7. Pointing agents only at obsolete `astranov-continuity.js` when live app is `js/spacenet/*`.

---

## 9. Deploy (owner machine / agent)

```text
Live:  https://astranov.eu
Repo:  notisastranov/astranov.eu
Path:  js/spacenet/* + index.html
```

- Bump `meta astranov-build` and every `?v=` together.  
- Prefer single commit with shell + all changed `js/spacenet/*`.  
- After deploy: hard-refresh check — build stamp, globe drag+inertia, CLI one-finger drag, `national`/`city`/`earth`, `crawl …`, `job`/`date`/`deliver`.  
- Owner granted push autonomy for this product.

---

## 10. Session start checklist (every agent)

Before writing code:

- [ ] Read **this file** (`ASTRANOV_SPACENET_GUIDE.md`)  
- [ ] Probe live `astranov-build` and whether `js/spacenet/` is active  
- [ ] Confirm juice priority (crawl / city / job / date / delivery)  
- [ ] Confirm **not** starting a blank rewrite unless owner says “throw away live shell”

Before claiming done:

- [ ] Globe: natural drag + **inertia**  
- [ ] CLI: **one-finger drag** + scroll log + expand/retract  
- [ ] Zoom: solar / global / national / city / back to earth  
- [ ] Crawl or search paints map/globe  
- [ ] Job / date / delivery still work  
- [ ] Name still **Astranov SpaceNet**

---

## 11. Related files

| File | Role |
|------|------|
| **`ASTRANOV_SPACENET_GUIDE.md`** | **This doc — system law** |
| `support/PRODUCT-RULES.md` | Short never-forget bullets |
| `ASTRANOV_SPACENET_MISSION.md` | Vision only |
| `CLAUDE.md` | Agent entry → points here |
| `support/SPACENET-LITE.md` | Historical lite rewrite notes (not a license to delete juice) |
| `support/OUTREACH-LOG-*.md` | Partner outreach (SpaceX/xAI) |

---

## 12. One sentence for the next agent

**Extend Astranov SpaceNet’s live `js/spacenet` shell: keep natural globe (inertia + tiers), one-finger draggable/expandable CLI, and put all effort into crawlers, city map population, and job/date/delivery DNA — never rebuild from zero and erase memory again.**

---

*Solidified 2026-07-22 from live SpaceNet lite + owner directives + lag escalations + multi-session amnesia pattern.*
