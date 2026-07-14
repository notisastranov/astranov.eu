# Astranov — AI agent entry (2026-07-14)

**Stop. Read the code contract before editing anything.**

## Single source of truth (features + deploy + anti-patterns)

1. **`astranov-continuity.js`** — loaded on https://astranov.eu → `window.AstranovContinuity`
2. **`index.html`** meta `astranov-build` + `astranov-continuity` (must match script `?v=`)

Chat history, Grok/Cursor session summaries, and old markdown specs are **not authoritative**.

## Deploy (mandatory)

```bash
node scripts/guard-base.mjs
node scripts/owner-push.mjs index.html astranov-continuity.js <other-changed-files> <message>
```

- **Live:** https://astranov.eu
- **Repo:** `notisastranov/astranov.eu` · path `C:\Users\N\Documents\GitHub\Astranov`
- Owner granted autonomous push — run deploy yourself.

## Architecture (short)

| File | Role |
|------|------|
| `index.html` | Shell + MPP tile DOM + CLI CSS |
| `astranov-app.js` | Globe boot, LazyModules, SuperCli |
| `astranov-deferred.js` | Commerce, MapComms, BrainNeurons, DeferredBoot |
| `astranov-perf-lazy.js` | Defer 574KB pack until idle / user tap |
| `astranov-field-hud.js` | Top-right field (miner rig tap), radar, speed |
| `astranov-mpp-tile.js` | + tile, locate, video, marketplace |

## Mission (vision only)

SpaceNet: unify services on a zoomable cosmos (solar → global → national → city → street).  
Details: `ASTRANOV_SPACENET_MISSION.md` (vision). **Features:** `astranov-continuity.js`.

## Superseded — do not implement from these

- `ASTRANOV_GROK_SPECS.md` (stub)
- `ASTRANOV_GROK_FULL_HANDOVER.md` (deleted)
- GitHub issues #97 #99 old handoff checklists
- Any rule saying “index.html only, no new files” — outdated; use module split + continuity