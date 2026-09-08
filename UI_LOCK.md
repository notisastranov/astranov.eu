# SpaceNet UI LOCK — 2026-09-08 · stamp 4216

Owner: Notis. This chrome is frozen until Notis unlocks it.

Locked live shell: index.html build 4216 · snapshot this rewrite.

## Visible chrome (do not move, hide, restyle, or replace)
- Canvas globe `#g` full viewport
- Brand island: ASTRANOV SPACENET · 4216 (tap = cache wipe + reboot)
- JOBS pill top-left (`#sn-tasks-btn`)
- AV€ pill (`#sn-money`) **after login only**
- LOGIN `#sn-me` bottom-left · GPS `#gps` bottom-right
- Dock: `#plus` · `#in` Talk to Astranov SpaceNet · `#go` mic
- ⏻ `#sn-power` top-left, left of JOBS, SVG power mark (not Unicode)
- Grid globe with continent labels. No HUD. No twin CLI.

## Required IDs
g, city, island, ver, heal, sn-money, sn-tasks-btn, sn-me, gps, plus, in, go, line, panel, dock, f, sn-power

## Forbidden
- Overlay scripts `js/spacenet/*-41*.js` loaded or SW-injected
- PLACEHOLDER / stub index under 4 KB
- Twin CLI / HUD / os-bootloader
- Auto-talk on boot
- Dummy shops / dummy GPS / dummy pay
- Mercator disc sold as a globe
- Moving LOGIN / GPS / JOBS / AV€ / + / mic / ⏻

## Unlock
Only Notis. Write UI_UNLOCK in a commit message and delete this file.
