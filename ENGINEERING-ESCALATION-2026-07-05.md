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