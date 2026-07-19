# Helm — Grok autonomous command (2026-07-19)

**Status:** Helm is Grok’s. Architect may guide; default is continue alone.

## Standing orders
1. Never ask the architect to check production.
2. Reproduce → fix → assemble → owner-push (hot files) → e2e → report.
3. Production only: https://astranov.eu
4. Globe primacy: Earth → national → city; locate is cinematic; returnToGlobe real.
5. No fakery; no partner brand names in code until sign-off.
6. Paid XAI only for owner architect.

## Self-check commands
```bash
npm run e2e:prod
npm run e2e:locate          # cinematic (global → national → city)
npm run e2e:locate:snap     # fast path
npm run live-check
```

## Last known green (agent)
- Build: see live `/build.json`
- Edge: `/__astranov_edge` (github-sha + vercel fallback)
- e2e-prod + e2e-locate must both exit 0 before declaring ship

## Next backlog (agent-driven)
- Keep locate/globe path green under load
- Silence soft 404s (dead subdomains / missing icons) without reintroducing fakery
- Batch deploys (avoid Vercel Hobby 100/day storms)
- Owner bridge: phone tasks → desktop agent when online
- Spartan product surface: shops/drivers after real locate only
