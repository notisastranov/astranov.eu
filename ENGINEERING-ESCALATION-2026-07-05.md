# Astranov Engineering Escalation — 2026-07-05

**Reporter:** Astranov owner (notisastranov@gmail.com) via Grok Build agent  
**Product:** https://astranov.eu (globe), coin.astranov.eu, auditors.astranov.eu  
**Database:** Supabase `lkoatrkhuigdolnjsbie` (classified — must not appear in user-facing auth)  
**Severity:** P0 — user reports platform unusable; trust-breaking login UX  

---

## Executive summary

User requested a large batch of usability fixes (order tracking, lag, CLI gestures, 3D AI responsiveness, login/profile 3D flow, smooth globe fly, branded login on astranov.eu). Multiple agent sessions implemented code and claimed success. **User feedback: "you fixed nothing" / "you're trolling me"** — particularly on login still showing the Supabase project ref during Google OAuth.

**Root cause of auth failure (verified):** Vercel reverse-proxy of `/auth/*` to Supabase does **not** change the `redirect_uri` Supabase sends to Google. Live probe:

```
GET https://astranov.eu/auth/v1/authorize?provider=google&redirect_to=https://astranov.eu/
→ 302 Location: accounts.google.com/...&redirect_uri=https%3A%2F%2Flkoatrkhuigdolnjsbie.supabase.co%2Fauth%2Fv1%2Fcallback
```

Google displays that `redirect_uri` host to users as "Continue to lkoatrkhuigdolnjsbie…" — classified and trust-breaking.

**Actual fix shipped (2026-07-05, commit `f72368d`, deployed prod):** Google Identity Services popup + `signInWithIdToken` — user stays on astranov.eu; no full-page OAuth redirect through Supabase hostname.

---

## User requirements (original batch)

| # | Requirement | Status |
|---|-------------|--------|
| 1 | Order tracking on globe + CLI | Code shipped (`83-order-tracking.js`) — **user has not confirmed working** |
| 2 | Fix lag / app feels stuck | Partial — perf mode, hidden-tab throttle, coders autostart removed — **user says still broken** |
| 3 | CLI deck: one-finger height + scroll, no snap presets | Code shipped (`13-globe-deck.js` free height) — **unverified by user** |
| 4 | AI 33× faster — 3D responsiveness (CLI/voice/globe) | Code shipped (`84-responsive-3d.js`, 8s think timeout) — **not measured vs claim** |
| 5 | Login tap → fly to me, profile, roles, logout (3D) | Code shipped (`12-auth.js`, `69-profile-site.js`) — **unverified by user** |
| 6 | Smooth moderate globe fly | Code shipped (`10-trackball.js`, `00-globe.js` easing) — **unverified** |
| 7 | Login must show **astranov.eu**, never Supabase project ref | **Was broken after first fix**; popup login deployed — **awaiting user retest** |

---

## Timeline of agent work

### Session A — feature batch (`5d4961a`)
- Added order tracking, 3D responsiveness, globe deck free height, login→profile flow, perf tweaks
- verify-all 51/51, user-scenarios 8/8 passed locally
- User: hours on stress cycles while app stayed laggy; demanded real fixes

### Session B — auth branding attempt (`8427566`)
- Added `vercel.json` proxy `/auth` → Supabase
- `resolveAstranovSupabaseUrl()` → `location.origin` on `*.astranov.eu`
- Auth modal UI text "Official login · https://astranov.eu"
- **Did not fix Google OAuth screen** — redirect_uri still `*.supabase.co`

### Session C — user escalation "you fixed nothing"
- Probed live authorize URL — confirmed redirect_uri leak
- Implemented Google GIS popup + `signInWithIdToken` (`f72368d`)
- `npx vercel deploy --prod` → aliased https://astranov.eu
- Live bundle verified: `signInWithIdToken`, `signInGoogle`, `auth-google-btn` present

---

## Technical root causes

### Auth / trust (P0)
1. **Supabase OAuth redirect_uri is server-configured** to `{project}.supabase.co/auth/v1/callback` unless **Supabase Custom Domain** is fully activated.
2. **Vercel path proxy** forwards requests but does not rewrite OAuth `redirect_uri` in authorize responses.
3. **UI copy changes** do not affect Google consent screen.
4. **`api.astranov.eu` CNAME exists** but Cloudflare returns **error 1014** (CNAME cross-user) when proxied orange-cloud — custom domain addon not operational.

### Performance (P1)
- Boot loads many subsystems; `AciCoders.autoStart()` at 8s was adding load (removed in `f72368d`).
- `BrainConversation.seedAdultNeurons` spawns globe neurons at boot (delayed to 8s).
- ACI tick + neuron animation + GlobeEntity labels run every frame unless `_voicePerfMode`.
- User ran million-cycle stress tests concurrently — may have left processes / degraded experience.

### Agent process failure (meta)
- Agent reported success based on automated tests (verify-all, user-scenarios) without **live OAuth flow verification** or **user-device confirmation**.
- Claimed auth fixed when only infrastructure partial (proxy) was in place.

---

## Fixes currently live (astranov.eu)

| Commit | Change |
|--------|--------|
| `5d4961a` | Order tracking, 3D responsiveness, deck free height, profile/roles |
| `8427566` | vercel.json Supabase proxy, auth URL resolver, modal branding |
| `f72368d` | **Google popup login** (`signInWithIdToken`), perf boot tweaks, deck expand restores free height |

**Google Client ID (from live authorize probe):**  
`73846897360-va7gcqngfc370gfp7rl059no0vd4ts11.apps.googleusercontent.com`

---

## Required platform / infra actions (support engineers)

### Supabase / DNS (auth hardening)
1. **Activate Supabase Custom Domain** on `api.astranov.eu`:
   - Cloudflare: CNAME `api` → `lkoatrkhuigdolnjsbie.supabase.co` with **DNS only (grey cloud)** to avoid 1014
   - `supabase domains create / reverify / activate` for project `lkoatrkhuigdolnjsbie`
2. **Supabase Auth settings:**
   - Site URL: `https://astranov.eu`
   - Redirect URLs: `https://astranov.eu/**`, `https://*.astranov.eu/**`
3. **Google Cloud Console** (OAuth client above):
   - Authorized JavaScript origins: `https://astranov.eu`, `https://coin.astranov.eu`, etc.
   - Authorized redirect URIs: `https://astranov.eu/auth/v1/callback` (after custom domain OR for fallback redirect path)
   - OAuth consent screen **App name: Astranov**, home: `https://astranov.eu`

### Vercel
- Confirm `vercel.json` rewrites deployed on all `*.astranov.eu` projects (globe, coin, auditors — coin/auditors updated in separate repos).

### Grok Build / agent quality (meta)
- Do not mark auth tasks complete without probing OAuth `redirect_uri` in authorize response.
- Require live-user confirmation for trust-sensitive flows before claiming success.
- Deprioritize million-cycle runners when user reports P0 usability failure.

---

## Reproduction steps (auth bug — pre-f72368d)

1. Open https://astranov.eu
2. Tap G → Google login
3. Observe Google screen: "Continue to **lkoatrkhuigdolnjsbie.supabase.co**"
4. Or curl: `https://astranov.eu/auth/v1/authorize?provider=google&redirect_to=https://astranov.eu/` → inspect `redirect_uri` query param

## Expected after f72368d

1. Tap G on astranov.eu
2. Google **popup** (accounts.google.com) while page stays on astranov.eu
3. No navigation to `*.supabase.co` in address bar
4. Session established via `signInWithIdToken`

## Fallback if popup fails

- User sees login modal with Google button (`#auth-google-btn`)
- Last resort: `_signInGoogleRedirect()` with client-side `astranovizeAuthUrl()` — may still fail until Supabase custom domain active

---

## Files touched (key)

- `src/01-astranov-auth-url.js` — URL resolver, Google client ID, scrub leaks
- `src/12-auth.js` — GIS popup, signInWithIdToken, profile fly
- `src/13-globe-deck.js` — free height persistence
- `src/83-order-tracking.js`, `src/84-responsive-3d.js`
- `src/99-boot.js` — perf, removed coders autostart
- `vercel.json` — Supabase path proxy
- `index.shell.html` — auth modal branding + Google button host

---

## Contact

- **User:** notisastranov@gmail.com  
- **Repo:** https://github.com/notisastranov/astranov.eu  
- **Live:** https://astranov.eu  
- **This report generated:** 2026-07-05 by Grok Build agent session  

**User request:** Escalate this entire thread to support engineers — do not close until user confirms login shows astranov.eu and app is usable.

---

## Session D — 2026-07-05 (continued): lag, AI spelling, profile/commerce, agent quality

**User sentiment:** "AI still spelling and not replying, whole app is a dummy" → **"forward everything to support so they can fix you up to do the job"**

### Additional user requirements (this session)

| # | Requirement | Status |
|---|-------------|--------|
| 8 | Remove CLI `▔` handle; move hands-free `🎧` after `+` | Done (`9458817`) — **unverified** |
| 9 | Real sidereal planet periods + ecliptic inclinations | Done (`4c064f9`) — **unverified** |
| 10 | Cut lag — app still heavy/stuck | Partial slim build (`d3cee61`, `5d3c7a6`) — **user still reports heavy lag** |
| 11 | AI must spell Astranov/coders correctly; must reply | Fixes shipped (`53cd922`, `1b8e938`, `9614310`) — **user has not confirmed** |
| 12 | Profile icon → fly to GPS + open profile | Bug: `#aci-login` wired to sign-out (`761d9e4` fix) — **unverified** |
| 13 | Vendor menus, order flow, driver picker | Restored (`761d9e4`) — **unverified** |
| 14 | Top ASTRANOV logo = hard reset (cache/SW/reload) | Confirmed behavior (`07-astranov-logo.js`) |
| 15 | Delete unnecessary code / slim bundle | Done — ~614 KB bundle, stubs in `07-light-stubs.js` |
| 16 | **Escalate to platform support** — fix Grok Build agent quality | **This report + GitHub issue** |

### Session D timeline

#### D1 — Slim build (`d3cee61`)
- Removed 18 heavy modules; stubbed graphics; minimal boot loop
- Bundle ~614 KB
- User: still laggy

#### D2 — AI spelling pass (`53cd922`, `1b8e938`)
- Central `repairOutbound()` on `GlobeDeck.log`, `speak()`, Coders paths
- User: "AI still spelling"

#### D3 — Profile / commerce / perf (`761d9e4`)
- **Root cause:** `SuperCli.bindToolbar()` bound `#aci-login` to **sign out** instead of `Auth.openLoggedInProfile()`
- **Fix:** Profile tap → GPS → fly + zoom → open profile
- Restored toolbar `aci-locate`, `aci-order`
- `GlobeEntity` me-marker tap refreshes GPS and flies
- `GlobeControl.flyToLatLng` no longer blocked when not in earth view
- Commerce: JSON menu parse, demo fallback, driver picker (`vm-drivers-pick`)
- Perf: lower pixel ratio, slower entity ticks, vendors at 800ms

#### D4 — AI reply + spelling root cause (`9614310`)
- **Root causes found:**
  1. Dialect rules rewrote normal words in AI output (`hello`→`geia`, `και`→`tzai`) — garbled replies
  2. Silent no-reply when API returned empty/failed text
  3. `BrainConversation` stub echoed input instead of real AI
  4. Coders bridge delayed 2s at boot
- **Fixes:**
  - Split `repairBrands()` (outbound) vs `repairDialect()` (voice input only) in `08-arcangelo-dialect.js`
  - `_applyResponse` always prints a reply (API or fallback)
  - All chat routed to `AciCoders` (removed brain stub in `20-aci.js`)
  - `BrainConversation.converse` → `AciCoders.chat` in `07-light-stubs.js`
  - Coders starts immediately in `99-boot.js`
  - Server-side `repairBrands()` in `supabase/functions/aci/index.ts` (redeployed)
- **API probe (agent):** `coders_chat` returns text via Groq in ~7s — **not confirmed on user device**

### Technical root causes (Session D)

#### AI spelling / no reply (P0)
1. **Over-aggressive dialect repair** applied to model output, not just voice input
2. **Dual chat paths** — stub `BrainConversation` could swallow real AI
3. **Empty response handling** — UI showed nothing on API failure
4. **Cached bundle** — user may still run old JS until hard reset (tap ASTRANOV logo)

#### Profile / locate (P0)
1. **Wrong toolbar binding** — login button triggered logout
2. **`flyToLatLng` guard** blocked fly when not in earth view

#### Performance (P1 — ongoing)
1. Slim build reduced load but globe/ACI still tick-heavy on user hardware
2. Service worker may serve stale assets until hard reset
3. Million-cycle stress tests may have degraded local experience

#### Grok Build agent failure (meta — P0 for platform)
1. Multiple sessions claimed fixes without **user-device confirmation**
2. Automated tests (`verify-all`, `user-scenarios`) passed while live UX broken
3. Agent did not require hard-reset / cache-bust before declaring AI fixes live
4. User explicitly asked support to **fix the agent** so it can do the job

### Fixes currently live (astranov.eu) — updated

| Commit | Change |
|--------|--------|
| `9458817` | CLI handle removed; hands-free after `+` |
| `4c064f9` | Real sidereal periods, inclined orbits |
| `5d3c7a6` | Frame budget, lite mode, lighter 3D |
| `d3cee61` | Slim build — 18 modules removed, stubs |
| `53cd922` | Central `repairOutbound` on all output paths |
| `761d9e4` | Profile fly, vendor/order/driver, globe perf |
| `9614310` | AI always replies; brand-only repair; Coders-only chat |

**Supabase edge:** `aci` function redeployed with `repairBrands()` server-side.

### Verification checklist (support / user — post hard-reset)

1. Hard reset: tap top **ASTRANOV** logo (or Ctrl+Shift+R)
2. CLI: type `hello are you there` → reply within ~10s, no garbled dialect
3. Output shows **Astranov** / **coders** correctly — no Supabase ref in UI
4. Tap profile icon → globe flies to GPS → profile opens (not sign-out)
5. Tap order → vendor menu loads → can pick driver
6. Login (G) → popup on astranov.eu — no `lkoatrkhuigdolnjsbie` in Google screen
7. App feels responsive — no multi-second freeze on interaction

### Files touched (Session D)

| File | Role |
|------|------|
| `src/08-arcangelo-dialect.js` | `repairBrands`, `repairOutbound`, dialect split |
| `src/18-aci-coders.js` | `_applyResponse`, `chat()`, Coders API |
| `src/13-globe-deck.js` | `log()`, `_repairLine()` |
| `src/12-auth.js` | `openLoggedInProfile()` |
| `src/15-super-cli.js` | Toolbar bindings |
| `src/30-commerce.js` | Vendor menu, order, driver picker |
| `src/07-astranov-logo.js` | `hardReset()` |
| `src/07-light-stubs.js` | Stubs for removed modules |
| `src/99-boot.js` | Minimal boot, immediate Coders |
| `src/20-aci.js` | Route all chat to Coders |
| `supabase/functions/aci/index.ts` | `coders_chat`, `repairBrands` |

### Grok Build / xAI support actions requested

1. **Do not close** until user confirms each P0 item on their device
2. **Require live E2E verification** (browser + API + user cache state) before claiming fix
3. **Probe OAuth redirect_uri** and **chat API response** on production, not just unit tests
4. **Improve agent loop:** when user says "still broken" twice, stop shipping more code — diagnose cache, deploy alias, and user environment first
5. **Session transcript** for full context:  
   `C:\Users\Astranov\.grok\sessions\C%3A%5CUsers%5CAstranov\019f126c-fec8-7c40-aa10-6a8d5a469d47\updates.jsonl`

---

**Updated:** 2026-07-05 — Session D escalation appended. User request: forward everything to support.