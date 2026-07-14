# DEPRECATED — do not use for implementation

**Superseded:** `2026-07-14` by **`astranov-continuity.js`** (`window.AstranovContinuity`).

This file previously held recycled chat specs. Those conflict with the live app (module split, MPP tile, field HUD miner, perf-lazy boot).

## Read instead

1. `astranov-continuity.js` — features, selectors, `doNotRemove`, `antiPatterns`, `verify`
2. `CLAUDE.md` — agent deploy path
3. `ASTRANOV_SPACENET_MISSION.md` — mission vision only (no feature checklist)

## Do not resurrect from old specs

- “Single file index.html only, no new files”
- “astranov-grok.html primary source”
- “No modals / no panels” (MPP tile + miner rig panel are required)
- `#aci-miner` CLI strip (removed — tap `#field-balance-hud`)
- `globe-super-add` as + target (use `MenuProfilePostTile`)
- Boot `LazyModules.ensure()` at 400ms