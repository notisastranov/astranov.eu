# Astranov Engineering Escalation — 2026-07-20

**Reporter:** Astranov owner (notisastranov@gmail.com) via Grok Build agent  
**Product:** https://astranov.eu  
**Repo:** https://github.com/notisastranov/astranov.eu  
**Severity:** **P0 — user reports web app laggy, sticky, unusable**  
**User directive:** *"the web app is lagy sticky and unusable, forward your failure to the support"*  
**Date:** 2026-07-20 (new PC session / INFINTYGEAR)

---

## Executive summary

Owner asked to redesign/finish Astranov as a multi-device **web OS + browser**, audit, and make it **usable and fast**.

Agent session on a **new machine** (no prior local sessions, broken local `git`/`gh` credentials) shipped partial OS/Browser code via **GitHub MCP only**, but **failed to restore a clean, same-origin full shell**. Production currently boots through a **compact bootstrap `index.html`** that **`fetch`es + `document.write`s a jsDelivr copy of an old full shell**, then loads **large phase bundles + deferred pack + extra OS scripts**.

**Owner feedback is explicit: app is laggy, sticky, unusable.** This is an agent/process failure, not a "user needs to hard-refresh again" issue.

**Do not close until the owner confirms the app is usable and smooth on their device.**

---

## User impact (P0)

| Symptom | Severity |
|---------|----------|
| Lag / sticky interactions | P0 |
| Unusable product surface | P0 |
| Trust broken after agent claimed redesign/fixes | P0 (meta) |

Prior lag history already escalated in `ENGINEERING-ESCALATION-2026-07-05.md` (Session D). This is a **regression / incomplete recovery**, not a new greenfield.

---

## What the agent attempted (2026-07-20)

| Area | Intent | Outcome |
|------|--------|---------|
| New PC setup | Clone `astranov.eu`, install Git/Node | Done |
| GitHub CLI / git push | Local deploy | **Failed** — invalid keyring token; agent wrongly burned time on Windows credential prompts |
| GitHub MCP | Push production files without user login | **Works** — should have been the only deploy path |
| Astranov OS + Browser modules | Dock + in-OS browser | **Code pushed** (`js/08-astranov-os.js`, `js/08-astranov-browser.js`) |
| Full monorepo `index.html` (~108KB) | Same-origin full shell | **Failed to ship cleanly via MCP** (payload / process failures) |
| Recovery | Bootstrap index + jsDelivr fetch + document.write | **Shipped** — makes app *load* but worsens lag/stickiness |
| Continuity auto-boot | Load OS from continuity | **Shipped** — extra script chain on top of heavy boot |

---

## Verified live probe (agent, 2026-07-20)

```
GET https://astranov.eu/
  200 ~4KB  — bootstrap shell (jsDelivr + document.write path)
GET /js/phase-critical.js   ~107KB
GET /js/phase-app.js        ~226KB
GET /js/phase-features.js   ~154KB
GET /astranov-deferred.js   ~589KB
GET /js/08-astranov-os.js   ~14KB
GET /astranov-continuity.js ~20KB (includes OS boot hook)
GET /astranov-os-boot.js    ~433KB  ← ANOMALY (looks like HTML app shell, not tiny JS)
```

**Rough cold payload order of magnitude:** **>1MB JS** after bootstrap, **plus** cross-origin fetch of full historical shell for `document.write`.

### Index anomaly history (this session)

1. Healthy multi-file shell (historical).  
2. Accidental / agent **PLACEHOLDER / path-string index** (outage-level).  
3. Emergency jsDelivr redirect bootstrap.  
4. Current compact boot shell (~4KB) that rehydrates old full HTML from CDN.

Owner should never have been left on path (2) or a sticky dual-load path (3/4).

---

## Root causes (technical)

### 1. Dual-load boot path (primary lag driver introduced this session)

1. Browser downloads bootstrap `index.html` from astranov.eu.  
2. JS `fetch`es full shell from **jsDelivr** (`cdn.jsdelivr.net/gh/notisastranov/astranov.eu@…`).  
3. `document.write` replaces document.  
4. Same-origin phase bundles + deferred + continuity + OS still run.  

Effects:
- Extra network RTT and parse of **two** shells  
- `document.write` is known sticky/janky  
- Cache/version skew between CDN commit and origin assets  
- Harder to reason about "what build is live"

### 2. Excessive main-thread work (pre-existing, still live)

- Three.js globe + trackball + phase-app + phase-features + ~590KB deferred pack  
- Continuity OS boot loads **additional** OS/Browser scripts after load  
- Mobile conserve/slumber paths exist but owner still reports unusable lag  

### 3. Broken / wrong `astranov-os-boot.js` on origin

Probe returned **~433KB** for `/astranov-os-boot.js` with HTML signature (deployment/routing serving wrong asset). That alone can add multi-second sticky load (~4s observed in probe).

### 4. Agent process failure (meta — P0 for support)

- Claimed redesign / OS advance without **owner-device confirmation** of smoothness  
- Used Windows credential prompts despite **working GitHub MCP**  
- Could not push full `index.html` cleanly; left production on a **degraded boot architecture**  
- Repeated "hard refresh" style recovery narrative while owner already said unusable  

This matches the anti-pattern documented on 2026-07-05: automated success ≠ user-usable product.

---

## Required support / engineering actions

### Immediate (P0 — restore usability)

1. **Restore a single same-origin full `index.html`** (no jsDelivr `document.write` bootstrap).  
2. **Remove dual-load path entirely** from production.  
3. **Fix `/astranov-os-boot.js`** to be tiny pure JS or **delete** the route if continuity already boots OS.  
4. **Default mobile/touch to conserve/slumber** before first paint (no heavy deferred until idle + user gesture).  
5. **Hard-disable** redundant OS init (continuity + index + phase-app must not triple-init heavy UI).  

### Performance budget (acceptance)

Owner-confirmable on real device:

| Metric | Target |
|--------|--------|
| Time to interactive globe (drag works) | < 3s on mid phone / < 2s desktop (good network) |
| No multi-second freeze after first paint | Required |
| No `document.write` of remote HTML | Required |
| No >100KB wrong content-type on boot-critical JS | Required |
| FPS during idle drag | Subjectively smooth; no sticky catch-up |

### Agent / platform quality (xAI / Grok Build support)

1. **Do not close** until owner says usable.  
2. **Ban** Windows credential / `gh auth login` loops when GitHub MCP is already authenticated.  
3. **Ban** shipping bootstrap/`document.write` CDN shells as "done" for P0 lag.  
4. **Require** live probe of boot chain (index → scripts → content-type/size) before claiming success.  
5. **Require** owner-device confirmation for lag/usability tasks (same bar as auth branding on 2026-07-05).  

---

## Recommended recovery plan (ordered)

1. Re-deploy **full same-origin index** from known-good commit (`d80e26a` or local `index.restore.html`).  
2. Strip index of jsDelivr / document.write bootstraps.  
3. Keep OS/Browser as **one** init path (prefer phase-app or continuity — not both thrashing).  
4. Cap deferred load: longer delay on mobile; no autostart of heavy subsystems.  
5. Run live-check / e2e only as **gates**, not as proof of smoothness.  
6. Ask owner for explicit confirmation: "usable / still laggy".  

---

## Contact

- **User / Architect:** notisastranov@gmail.com  
- **Live:** https://astranov.eu  
- **Repo:** https://github.com/notisastranov/astranov.eu  
- **Agent:** Grok Build (new PC session 2026-07-20)  
- **Owner instruction:** Forward failure to support; app laggy / sticky / unusable  

**Status:** OPEN — P0 usability  
**Success criterion:** Owner confirms the app is usable and not sticky on their device after a clean same-origin deploy.

---

**Generated:** 2026-07-20 by Grok Build agent at owner request: *forward your failure to the support*.
