# Astranov SpaceNet (central hub)

Live: https://astranov.eu  
Repo: `notisastranov/astranov.eu` — **hub domain only**

Per-AI subdomain apps (`chatgpt.astranov.eu`, `grok.astranov.eu`, …) are separate projects. Do not mix or redeploy them from this tree.

The only instruction file for the live stamp shell is `MASTER_PROMPT.md`.

## Two surfaces (migration path)

| Surface | Path | Status |
| --- | --- | --- |
| Live stamp shell | `index.html` + `js/spacenet/app.js` + `js/spacenet/auth.js` | Production on astranov.eu (stamp 4423) |
| Next.js hub MVP | `web/` | SpaceNet + Architect unified MVP (Cesium + Supabase) |

Numbered overlay scripts are dead. Do not load them into the stamp shell.

### MVP local run

```bash
cd web
cp .env.example .env.local
npm install
npm run dev
```

See `web/README.md` for env var names, stack, and out-of-scope TODOs.
