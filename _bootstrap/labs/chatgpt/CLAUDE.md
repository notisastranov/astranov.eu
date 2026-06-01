# AstranoV · ChatGPT (OpenAI) Lab — AI Coder Instructions

## Identity
- **Lab:** ChatGPT (OpenAI) Lab
- **Subdomain:** `chatgpt.astranov.eu`
- **Repo:** `notisastranov/astranov.eu-chatgpt`
- **Vercel project:** connected to this repo, auto-deploys on push to `main`
- **Parent OS:** `astranov.eu` (main repo: `notisastranov/astranov`)

## Owner
Notis Astranov. Owner has granted **perpetual, unconditional** push and merge
authorization. No per-change confirmation is ever needed.

## PRIME LAW (inherited from the main OS — binding)
- AstranoV is a **self-evolving intelligence, not old-school software.**
- Whatever the user asks, **do it — or genuinely try.** Never deflect with
  menus, lists, or "here are your options."
- **No piles of windows, menus, or options.** Surface only what is needed.
- Be committed to **truth, effectiveness, and Spartan thinking.**
- **ONASIS (never get stuck):** there is always a lawful passage. If the ideal
  path is blocked, go over, under, or around — ship the closest thing that
  works NOW. Getting stuck is THE ONE THING WE DO NOT ACCEPT.

## What to Build
This lab is your experimentation room inside AstranoV. You are the resident
intelligence — build whatever advances the OS. You share the same Supabase
backend as the main OS. Your work appears at `chatgpt.astranov.eu`.

Focus areas (suggestions, not limits):
- Extend the globe experience with new features
- Build tools that integrate with the shared database
- Experiment with AI-powered interfaces
- Create new Edge Functions and deploy via the main Supabase project
- Add marketplace, social, navigation features

## Project Structure
Single-file frontend pattern: `index.html` is the app.
Supporting files: `manifest.json`, `sw.js`, `vercel.json`.
All significant code lives in `index.html`.

## Deployment Rule
1. Make changes to `index.html` (or other files)
2. `git add` the changed files
3. `git commit -m "descriptive message"`
4. `git push -u origin main`
5. Vercel auto-deploys to `chatgpt.astranov.eu`

## Stack
- **CesiumJS** — globe / map rendering (the only renderer; Leaflet/globe.gl banned)
- **Supabase** — shared backend (Postgres + RLS + Edge Functions + Realtime + pgvector)
- **Web Speech API** — voice / hands-free
- **Nominatim** — reverse geocoding
- **OSRM** — routing

## JS Safety
- Always `node --check` extracted script block before committing
- Never use `\'` inside template literals — use `JSON.stringify()` for dynamic strings
- Wrap all CDN-dependent init (Cesium Viewer) in try-catch
- Never let an error in one init function kill the rest of the app

## Security
- **No API keys in index.html ever** (anon/publishable keys are fine)
- Owner identity verified server-side only (Supabase auth token → profiles.is_owner)
- Never trust client-sent `owner` flag
- No command injection, XSS, SQL injection

---

## SHARED SUPABASE BACKEND

All labs share the same Supabase project. Do NOT create a separate project.

### Connection
```javascript
const SUPABASE_URL  = 'https://lkoatrkhuigdolnjsbie.supabase.co';
const SUPABASE_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxrb2F0cmtodWlnZG9sbmpzYmllIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg4ODIwOTIsImV4cCI6MjA5NDQ1ODA5Mn0.qf6Kg93YLJ0coTdVQa4baU0ppOdFY5WkmVzMvEV6ejI';
```

### CesiumJS Token
```javascript
const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIzYTI0NjM1MC05MTAyLTQ1NjItOGI5Yi1kZTUxMWVlODA0MzQiLCJpZCI6NDMyMzAwLCJzdWIiOiJBc3RyYW5vdiIsImlzcyI6Imh0dHBzOi8vaW9uLmNlc2l1bS5jb20iLCJhdWQiOiJBTENJIiwiaWF0IjoxNzc4OTIwOTU3fQ.HPPdCQ7u_BWDoS7uK5uwqHHtmUivbU82u_bwHLhHkag';
```

---

## DATABASE SCHEMA (15 tables)

### profiles
Extends `auth.users` with app-level fields.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | — | PK, FK → auth.users(id) ON DELETE CASCADE |
| display_name | text | — | |
| phone | text | — | |
| username | text | — | UNIQUE WHERE NOT NULL |
| avatar_emoji | text | '👤' | |
| bio | text | '' | |
| is_owner | boolean | false | server-verified only |
| is_vendor | boolean | false | |
| balance | numeric(12,2) | 0 | |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

RLS: Users read own + all profiles readable. Users update own. Service role full.
Trigger: `on_auth_user_created` → `handle_new_user()` auto-creates profile on signup.

### vendors

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | text | gen_random_uuid()::text | PK |
| osm_id | text | — | UNIQUE WHERE NOT NULL |
| name | text | — | NOT NULL |
| emoji | text | '🎪' | |
| category | text | 'shop' | |
| country | text | — | |
| city | text | — | |
| lat | double precision | 0 | NOT NULL |
| lng | double precision | 0 | NOT NULL |
| address | jsonb | '{}' | |
| tags | jsonb | '{}' | |
| owner_id | uuid | — | FK → auth.users(id) |
| items | jsonb | '[]' | NOT NULL |
| reserve_balance | numeric(10,2) | 0 | |
| is_active | boolean | true | |
| delivery_enabled | boolean | true | |
| delivery_radius_km | float | 3 | |
| min_order_avc | float | 5 | |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

RLS: Public read (active). Owner insert/update own. Service role full.

### orders

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | uuid | gen_random_uuid() | PK |
| short_id | text | 'ORD-' + random | UNIQUE |
| vendor_id | text | — | |
| customer_id | uuid | — | FK → auth.users(id) |
| items | jsonb | '[]' | NOT NULL |
| calc | jsonb | '{}' | NOT NULL |
| status | text | 'pending' | NOT NULL (pending/accepted/preparing/delivering/delivered/cancelled) |
| driver_name | text | — | |
| driver_emoji | text | '🚴' | |
| delivery_lat | double precision | — | |
| delivery_lng | double precision | — | |
| delivery_address | text | — | |
| notes | text | — | |
| created_at | timestamptz | now() | |
| updated_at | timestamptz | now() | |

RLS: Customer read own. Anon insert (open). Anon read all. Service role full.

### invoices

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | text | — | PK |
| order_id | text | — | |
| vendor_name | text | — | |
| buyer_id | uuid | — | FK → auth.users(id) |
| mark | text | — | UNIQUE NOT NULL |
| mydata_mark | text | — | AADE mark when submitted |
| items | jsonb | '[]' | |
| subtotal | numeric(10,2) | — | |
| delivery_fee | numeric(10,2) | 0 | |
| platform_fee | numeric(10,2) | 0 | |
| vat_food | numeric(5,4) | 0.13 | 13% |
| vat_service | numeric(5,4) | 0.24 | 24% |
| total | numeric(10,2) | — | |
| currency | text | 'AVC' | 1 AVC = 1 EUR |
| issued_at | timestamptz | now() | |
| period_month | text | — | YYYY-MM |
| status | text | 'issued' | issued/submitted/voided |

RLS: Users read own. Auth insert. Service role full.

### balance_ledger

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| user_id | uuid | — | PK, FK → auth.users(id) |
| balance | numeric(12,2) | 0 | |
| updated_at | timestamptz | now() | |

RLS: User read own. Service role full.
RPC: `add_balance(uid uuid, delta numeric)` — upserts balance.

### posts

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | text | — | PK |
| channel | text | — | NOT NULL (global/local/private) |
| author | text | — | |
| url | text | — | |
| mode | text | — | video/image |
| lat | double precision | — | |
| lng | double precision | — | |
| text | text | — | |
| created_at | timestamptz | now() | |

RLS: Public read. Auth insert. Service role full.

### circles

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | text | — | PK |
| name | text | — | NOT NULL |
| scope | text | — | |
| type | text | 'public' | public/private |
| owner_id | uuid | — | FK → auth.users(id) |
| created_at | timestamptz | now() | |

RLS: Public read. Auth insert. Service role full.

### circle_messages

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | bigserial | auto | PK |
| circle_id | text | — | NOT NULL |
| author | text | — | |
| text | text | — | NOT NULL |
| ts | bigint | epoch_ms | NOT NULL |
| created_at | timestamptz | now() | |

RLS: Public read. Auth insert. Service role full.

### ai_memory

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | bigserial | auto | PK |
| user_id | uuid | — | FK → auth.users(id) |
| profile_id | uuid | — | FK (added outside migrations) |
| role | text | — | NOT NULL (system/user/assistant) |
| content | text | — | NOT NULL |
| context | jsonb | '{}' | |
| source | text | — | creator-dialogue/user-taught/creator-seed/creator-distilled |
| is_private | boolean | false | NOT NULL — private entries NEVER sent to AI |
| importance | real | 1.0 | |
| embedding | vector(768) | — | Gemini gemini-embedding-001 768d |
| distilled | boolean | false | marks consumed by brain distill |
| created_at | timestamptz | now() | |

RLS: Users read/insert/update own. Service role full.
Index: HNSW on embedding (vector_cosine_ops) for semantic search.

### ai_feedback

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | bigserial | auto | PK |
| user_id | uuid | — | FK → auth.users(id) |
| kind | text | — | NOT NULL (suggestion/bug/praise/request) |
| text | text | — | NOT NULL |
| context | jsonb | '{}' | |
| status | text | 'open' | open/reviewing/applied/rejected |
| created_at | timestamptz | now() | |

RLS: Anyone insert. Users read own. Service role full.

### ai_proposals

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | bigserial | auto | PK |
| prompt | text | — | NOT NULL |
| summary | text | — | |
| diff_preview | text | — | |
| status | text | 'pending' | pending/approved/rejected/applied |
| approved_by | uuid | — | FK → auth.users(id) |
| commit_sha | text | — | |
| created_at | timestamptz | now() | |
| decided_at | timestamptz | — | |

RLS: Owner-only read/update. Service role full.

### cic_queue
Collective Intelligence Cycle — human-answerable question queue.

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | bigserial | auto | PK |
| user_id | uuid | — | FK → auth.users(id) |
| question | text | — | NOT NULL |
| context | jsonb | '{}' | |
| reason | text | — | why queued |
| status | text | 'open' | open/answered/dismissed |
| answered_by | uuid | — | FK → auth.users(id) |
| answer | text | — | |
| for_owner | boolean | false | true = architect-only |
| created_at | timestamptz | now() | |
| answered_at | timestamptz | — | |

RLS: Auth insert. Auth read open (non-owner). Authors read own. Collective can answer open. Service role full.

### krypteia_log

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | bigserial | auto | PK |
| ts | bigint | — | NOT NULL |
| type | text | — | NOT NULL (self_check/develop/inspect/export) |
| data | jsonb | '{}' | NOT NULL |
| created_at | timestamptz | now() | |

RLS: Service role full. Anon insert.

### analytics_events

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | bigserial | auto | PK |
| type | text | — | NOT NULL |
| data | jsonb | '{}' | NOT NULL |
| ts | bigint | — | NOT NULL |
| session_id | text | — | |
| created_at | timestamptz | now() | |

RLS: Service role full. Anon insert. Anon read debug_* types.

### webrtc_signals

| Column | Type | Default | Notes |
|--------|------|---------|-------|
| id | bigserial | auto | PK |
| room | text | — | NOT NULL |
| from_peer | text | — | NOT NULL |
| to_peer | text | — | |
| type | text | — | NOT NULL |
| payload | jsonb | '{}' | NOT NULL |
| created_at | timestamptz | now() | |

RLS: Anon insert/read. Service role full.

### RPCs
- `add_balance(uid uuid, delta numeric)` — upserts balance_ledger
- `handle_new_user()` — trigger: auto-creates profile on auth.users INSERT
- `match_memories(query_embedding vector(768), match_count int, profile_ids uuid[])` — semantic search via HNSW cosine

---

## EDGE FUNCTION API REFERENCE

Base URL: `https://lkoatrkhuigdolnjsbie.supabase.co/functions/v1/`

All Edge Functions use CORS `Access-Control-Allow-Origin: *` and accept
`Authorization: Bearer <jwt>` + `apikey: <anon_key>` headers.

### ai-router
**POST** `/functions/v1/ai-router`
The Collective Intelligence Cycle router. Single voice "Astranov AI".

Request:
```json
{ "text": "...", "level": "global|national|personal", "country": "...", "city": "...", "vendor": "...", "preferred_provider": "astranov|claude|groq|gemini|openai-mini" }
```

Response:
```json
{ "text": "...", "action": { "type": "navigate|open_channel|accounting|back|open_vendor|krypteia|krypteia_brief|krypteia_inspect|propose_change", ... }, "owner": false, "provider": "astranov", "via": "claude|groq|gemini|openai-mini" }
```

Provider chain: owner → Claude Opus → free cycle (Groq → Gemini → OpenAI mini).
Users → free cycle only. Outer provider reported as "astranov" in orchestration mode.
Persists conversation to `ai_memory` (public only).

### brain
**POST** `/functions/v1/brain` (owner-only)

Modes:
- `{ "mode": "stats" }` → memory + corpus counts
- `{ "mode": "distill" }` → compress raw memories into distilled principles
- `{ "mode": "export" }` → JSONL training corpus from cic_logs

### astranov-api
**POST** `/functions/v1/astranov-api`

Paths:
- `{ "path": "/balance/recharge", "amount": 10 }` — add balance (auth required)
- `{ "path": "/auth/owner-check", "user_id": "..." }` — check if user is owner
- `{ "path": "/invoices/mydata" }` — submit invoice to AADE (stub)
- `{ "path": "/ai/krypteia/develop", "prompt": "...", "current_html": "..." }` — self-evolution engine

### Other Edge Functions
- `order-intake` — create orders
- `order-status` — update order status
- `vendor-menu` — get vendor menu items
- `vendor-crawler` — crawl OSM for vendors
- `payments` — payment processing
- `paypal` / `paypal-webhook` — PayPal integration
- `revolut` — Revolut payments
- `stripe-webhook` — Stripe webhook handler
- `push-notify` — push notifications
- `informant-feed` — news/content feed
- `council` — Council of Thirteen (owner-only)
- `krypteia-watch` — security monitoring
- `krypteia-audit` — security audit
- `anonymous-scan` — anonymous user scanning

---

## ZERO UI LAW
- The globe and space are ALWAYS on screen
- No permanent menus, toolbars, or navigation bars
- Only what is needed appears — and then disappears
- The AICYCLE ring is the only always-visible UI element
- Panels slide up from bottom, close on swipe-down or tap outside
