# SpaceNet Lite — from-scratch redesign (2026-07-22)

## Why

Production was **unusable**: ~1.2MB first-party JS (phase packs + deferred), multi-init OS, dual boot paths, HTML-as-JS Vercel fallbacks. Patches could not recover.

## New architecture

| File | Role | Budget |
|------|------|--------|
| `index.html` | Shell CSS + DOM | ~6.5KB |
| `js/spacenet/boot.js` | Load three → globe → tasks → cli | ~3KB |
| `js/spacenet/globe.js` | Low-poly Earth, drag, pulse, locate | ~8.5KB |
| `js/spacenet/tasks.js` | City DNA local-first | ~6.5KB |
| `js/spacenet/cli.js` | Street CLI | ~7KB |
| **Total first-party** | | **~31KB** |
| three.js r128 CDN | WebGL only after shell | ~600KB gzipped network (unavoidable for 3D) |

**Not loaded on boot:** phase-*, astranov-deferred (~590KB), OS dual-init, continuity OS thrash, field-hud/mpp auto HTML.

## Perf rules

- DPR ≤ 0.85 mobile / 1.0 desktop  
- Sphere segments 24/32, no Earth texture  
- Idle RAF ~12fps · active ~24fps · full while dragging  
- Fetch-before-eval for same-origin JS (reject HTML SPA fallback)  
- SW unregister on boot (kill sticky caches)  

## CLI

`job barman 3h` · `date coffee` · `deliver food` · `errand pharmacy` · `task list` · `task claim` · `search X` · `locate` · `help` · `solo`

## Rollback

Old monolith files remain in repo (`js/phase-*.js`, etc.) but are **not** referenced by `index.html`. To rollback, restore previous `index.html` from git history before this commit.

## Ready surface (20260722220000)

| Module | Role |
|--------|------|
| config.js | Supabase public URL/anon |
| auth.js | Google sign-in (SDK after paint) |
| map.js | Leaflet city map on demand |
| ui.js | Coach + panel expand |
| cli.js | Full street CLI |
| tasks.js | claim / complete / search / seed |
| globe.js | Lite Earth |

**First-party ~50KB** · map CSS/JS and supabase only after user needs them.

## Build stamp

`20260722220000` · mode `spacenet-lite-ready`
