# Astranov hub MVP (`web/`)

Next.js App Router + TypeScript + Tailwind MVP for the **central hub** [astranov.eu](https://astranov.eu) (`notisastranov/astranov.eu`).

This is the migration path for SpaceNet + Architect on the hub domain. It does **not** replace or redeploy per-AI subdomain projects (`chatgpt.astranov.eu`, `grok.astranov.eu`, etc.).

Production stamp shell (`index.html` + `js/spacenet/*`) stays at the repo root until an explicit cutover.

## Stack

| Layer | Choice |
| --- | --- |
| App | Next.js App Router + TypeScript + Tailwind |
| Globe / GIS | CesiumJS (primary) |
| Galaxy / stars | Cesium SkyBox (Three.js only if needed later) |
| Auth / data | Supabase project **Astranov.Eu** (`lkoatrkhuigdolnjsbie`, `eu-west-1`) |
| Realtime | Supabase Realtime channels + local stubs when env missing |

## Local run

```bash
cd web
cp .env.example .env.local   # fill anon / publishable key locally; never commit
npm install
npm run cesium:assets        # copies Cesium Workers/Assets into public/cesium
npm run dev                  # http://localhost:3000
```

Build check:

```bash
cd web && npm run build
```

## Env var names (no values)

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (alias)
- `NEXT_PUBLIC_CESIUM_ION_TOKEN` (optional)

## Components

`GlobeView`, `NationalLayer`, `CityServices`, `CreditsWallet`, `ArchitectCanvas`, `AICommandBar`

Types: `Plot`, `Offer`, `CreditTransaction`, `UserPost`

Stubs / comments: Vincenty + shoelace (`src/lib/survey/vincenty-shoelace.ts`), AI→canvas mapping (`src/lib/ai/canvas-mapping.ts`), Hellenic Cadastre Greece/Rhodes switch (no live WMS).

## Out of scope (TODO)

- Full CAD polish
- IGM georef collage
- Production ledger
- Live Hellenic Cadastre WMS

## Deploy note

Keep the root `vercel.json` serving the live stamp until cutover. Deploy this app as a separate Vercel project with **Root Directory = `web`**, or preview on a non-production host. Do not point `chatgpt` / `grok` / other AI subdomains at this tree.
