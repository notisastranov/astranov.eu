# Astranov SpaceNet — AI agent entry

**STOP. Read the system guide before editing anything.**

## Authority order (owner-locked 2026-07-22)

1. **Live code** `index.html` + `js/spacenet/*` + **`js/spacenet/brain.js`** (`SNBrain`) + `astranov-continuity.js`
2. **`support/PRODUCT-RULES.md`** — short never-forget bullets
3. **`ASTRANOV_SPACENET_MISSION.md`** — vision
4. **`ASTRANOV_SPACENET_GUIDE.md`** — solidified invariants (read fully every session)
5. **This file / `AGENTS.md`** — entry only

Chat history, compaction summaries, old Grok specs, and “rebuild from scratch” impulses are **not** authority.

**Amnesia almost killed this project and cost the owner real money.** Extend the shell. Load `SNBrain`. Never wipe sacred physics or juice.

## What you are building

**Astranov SpaceNet** — multi-device Earth OS + CLI.  
**Juice (default work):** network crawlers · city map population · jobs · dating · delivery · claim/progress/done · depict on globe.

**Not default work:** wiping the shell to chase FPS, re-introducing 1MB phase boot, forgetting inertia / CLI drag / zoom tiers.

## Live architecture (2026-07+)

| Path | Role |
|------|------|
| `index.html` | Shell + CLI dock |
| `js/spacenet/boot.js` | Boot chain |
| `js/spacenet/globe.js` | Real Earth, drag, **inertia**, zoom tiers |
| `js/spacenet/cli.js` | Street CLI + crawl + zoom |
| `js/spacenet/tasks.js` | City DNA |
| `js/spacenet/map.js` | City map |
| `js/spacenet/search.js` | Crawlers |
| `js/spacenet/ui.js` | **One-finger CLI drag** + expand |
| `js/spacenet/auth.js` / `ai.js` | Sign-in + Astranov freeform |

## Non-negotiables (summary)

1. Product name: **Astranov SpaceNet**
2. Globe: natural turn + **inertia** + real texture + **solar → global → national → city** + always **back to Earth**
3. CLI: **one-finger drag** + one-finger **log scroll** + **expand/retract**; position + size saved
4. Every street action **paints** the globe/map
5. **Do not full-rewrite** the live shell to “fix lag” — measure and cut
6. Deploy yourself; bump `astranov-build` + `?v=` together

## Session start

1. Read PRODUCT-RULES + ASTRANOV_SPACENET_GUIDE.md
2. Confirm inertia + one-finger CLI + zoom tiers in code
3. Only then work juice (crawl → city map → job/date/delivery)
4. After physics/CLI changes: verify + live probe

## Deploy

- **Live:** https://astranov.eu
- **Repo:** `notisastranov/astranov.eu`
- Prefer GitHub MCP `push_files` / Git Data API when local `git push` hangs
- Owner granted autonomous deploy for this product

## Full law

→ **`ASTRANOV_SPACENET_GUIDE.md`**
