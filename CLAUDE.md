# Astranov SpaceNet — AI agent entry

**STOP. Read the system guide before editing anything.**

## Single source of truth

1. **`ASTRANOV_SPACENET_GUIDE.md`** ← **AUTHORITATIVE** (features, globe, CLI, juice, anti-patterns, deploy)  
2. **`support/PRODUCT-RULES.md`** ← short never-forget bullets  
3. **Live code:** `index.html` + **`js/spacenet/*`** on https://astranov.eu  

Chat history, compaction summaries, and “let’s rebuild from scratch” impulses are **not** authority.

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
| `js/spacenet/auth.js` / `ai.js` | Sign-in + Grok freeform |

## Non-negotiables (summary)

1. Product name: **Astranov SpaceNet**  
2. Globe: natural turn + **inertia** + real texture + **solar → global → national → city** + always **back to Earth**  
3. CLI: **one-finger drag** + one-finger **log scroll** + **expand/retract**; position saved  
4. Every street action **paints** the globe/map  
5. **Do not full-rewrite** the live shell to “fix lag” — measure and cut  
6. Deploy yourself; bump `astranov-build` + `?v=` together  

## Deploy

```bash
# Prefer: edit js/spacenet/* + index.html, then push to notisastranov/astranov.eu main
# Live check: build stamp, inertia, CLI drag, national/city/earth, crawl, job/date/deliver
```

- **Live:** https://astranov.eu  
- **Repo:** `notisastranov/astranov.eu`  
- Owner granted autonomous deploy.

## Superseded for implementation

- Old “phase-* + 600KB deferred on boot” as the only architecture  
- `ASTRANOV_GROK_SPECS.md`  
- Session chat as sole memory (update **ASTRANOV_SPACENET_GUIDE.md** instead)  
- Continuity file alone if it conflicts with this guide and live `js/spacenet/*`

## Full law

→ **`ASTRANOV_SPACENET_GUIDE.md`**
