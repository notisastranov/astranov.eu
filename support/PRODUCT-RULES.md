# Astranov SpaceNet — never-forget rules

**Full law:** `ASTRANOV_SPACENET_GUIDE.md`  
**Authority order:** live code + continuity → this file → mission → guide → CLAUDE/AGENTS

## Identity
- Name: **Astranov SpaceNet**
- Globe primacy; silent Earth + CLI on cold boot
- Realism first — no fake data as primary city experience

## Juice (default engineering)
- Crawlers · city map population · **jobs** · **dating** · **delivery** · claim/done · globe depiction
- Not: endless full rewrites of globe/CLI

## Globe (SACRED)
- Natural one-finger turn + **inertia on release** (`velX`/`velY` + damp ≈0.88–0.94)
- Real Earth texture (not permanent dummy ball)
- Zoom: **solar → global → national → city → street**; always **back to Earth**
- Implementation: `js/spacenet/globe.js`

## CLI (SACRED)
- **One-finger drag** to move panel (`#cli-drag`, `sn:cli-pos-v1`, free dock)
- **One-finger scroll** on log
- **One-finger vertical gesture / control** to fully expand or retract (`sn:cli-size-v1`)
- Primary control surface for the product
- Implementation: `js/spacenet/ui.js` → `bindCliDrag()`

## Commands that must work
`job` · `date` · `deliver` · `errand` · `task list|claim` · `crawl` · `search` · `locate` · `city` · `fly` · `solar|global|national|city|earth` · `help` · `solo`

## Perf
- Keep modular `js/spacenet/*` boot (~50KB first-party target)
- No dual-load CDN shell; reject HTML-as-JS
- Fast without deleting juice

## Anti-patterns
- Strip inertia · remove CLI drag/free dock · non-scrollable/non-retractable CLI
- 1MB phase packs by default · persistent nav rectangles · fake city data
- Chat history over live code / PRODUCT-RULES / this guide

## Amnesia ban
- Do not rebuild from zero and drop the above
- When owner adds a rule, update **ASTRANOV_SPACENET_GUIDE.md** + this file the same session
