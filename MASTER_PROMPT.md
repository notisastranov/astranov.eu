# ASTRANOV SPACENET — MASTER PROMPT

**What this file is:** the only instruction document. Paste this first. Then the live shell. Do not add SPECS, LAW, AGENTS, HELM, living-truth, escalation, or log markdown.

**Date:** 2026-09-09
**Stamp:** 4239 (one entity. Overlays dead. Sphere globe. Vercel front door.)
**Owner:** Notis Astranov · Rhodes, Greece · notisastranov@gmail.com · X @astranov97250
**Live:** https://astranov.eu
**Repo:** notisastranov/astranov.eu · `main`

If rebuild law changes, **edit this file**. Chat is not the archive. Latest block wins.

---

## Method (2026-09-09 — overrides all older work notes)

Forbidden:

- Claiming a thing was made when it was not proven working.
- Dummy claims. Dummy shops, dummy GPS, dummy pay, dummy “it works on my side.”
- Coming to the owner with an unverified result.

Required, in this order:

1. **Do the work** on the shell as one entity. No overlay patches.
2. **Verify heavily** before speaking: real browser against the preview; for live claims, real origin https://astranov.eu (headers + HTML + the actual JS the phone will run). Console clean. Chrome IDs present. Globe pitch, LOGIN letter, JOBS under island, ⏻ SVG, no guest AV€, PayPal `approve`/`url` in the served file — each proven or listed as **not proven**.
3. **Bring the owner a verified result.** Say exactly what was proven and what was not. Never pad.
4. **Owner verifies again.**
5. Only then **stockpile** that entity for the **next 00:00 Europe/Athens** full rebuild. One push. Sequential stamp. No daytime GitHub/Vercel pile.

If a check failed, say it failed. Do not ship it. Do not narrate success.

Workflow without this loop is useless.

---

## Ship cadence

- Work all day. Revise. Spartanize. One entity.
- Grok preview is the day's entity the owner sees.
- Default ship: **00:00 Europe/Athens**, automation `spacenet-midnight-ship`, and **only** what the owner already verified.
- Keys in **Supabase secrets only**. Never GitHub.

---

## How work is judged

Four measures only: **Spartan minimalism, instant effectiveness, usefulness maximization, and truth.**

Fraud: dummy anything; Mercator-in-a-circle sold as a globe; keyword routers in front of Grok; overlay `*-41xx.js`; claiming done when the live phone does not do it; daytime deploy piles.

## Keys law

All secrets live in **Supabase secrets only**. Never commit a key, JWT, anon, service role, PayPal secret, Twilio, xAI, Vercel token. Never GitHub Actions secrets. Never `sk-` / `eyJ` / `ghp_` / `xai-` in the tree.

Browser gets public anon via `/api/public-config` from host env. PayPal create/capture on the host. Client follows `approve` or `url`, then captures on return.

## Tree law (4221)

Live page may load only:

- `index.html` — chrome
- `js/spacenet/app.js` — the OS
- `js/spacenet/auth.js` — Google / YOU
- `js/vendor/leaflet.js` + `leaflet.css`
- `sw.js` — network-first, **no inject**, never `/boot`
- `api/*` — Grok, space, find, place, paypal, sms, public-config

`js/spacenet/*-41*.js` and `*-42*.js` overlays are dead. Live page must not load earth-4204, earth-guest, money-*, pay-*, fill-*, talk-*, land-*, pizza-lock, auth-NNNN.

Grok preview (`src/spacenet/*`) is the same chrome and laws.

---

## Chrome (frozen)

- Canvas globe `#g` full viewport — sphere math, continent fill + outlines, labels, trackball, inertia. Idle sits still. Pitch follows the finger.
- Brand island: `ASTRANOV SPACENET` + stamp. Tap = reboot.
- `JOBS` `#sn-tasks-btn` **centered under the island**. Posted jobs only. Never TASKS.
- `AV€` `#sn-money` **after login only**. Owner pool, treasury 3,000,000, never zero-wiped.
- `LOGIN` `#sn-me` bottom-left. Out: LOGIN / IN. In: YOU / photo or first **letter**. Never two-char email slices. Never digits.
- `GPS` `#gps` bottom-right. Precise, then coarse, then tap-to-set.
- Dock: `#plus` (upload to Grok) · `#in` “Talk to Astranov SpaceNet” · `#go` mic.
- `⏻` `#sn-power` **top-left**, SVG power mark 44px. Offerings: reload, withdraw, hourly, terms, apply role.
- `#line` status. No auto-talk. No TTS unless they used the mic and asked.

Required IDs: `g, city, island, ver, heal, sn-money, sn-tasks-btn, sn-me, gps, plus, in, go, line, panel, dock, f, sn-power`

Forbidden: TASKS, CART, VENDORS pill, END CALL, twin CLI, HUD, LAYER flood, MAIL/PICK UP chips, FOOD/BEER/CITY chips, HOLD dummy hunts, overlay scripts.

### Globe

Trackball. Drag down = surface down. Flick inertia. Pinch / wheel. Zoom in → Leaflet OSM (CSS dark). Zoom out to 4 → globe. City: one tap zoom in, double tap zoom out, 1s long tap = the pin asked for. No Mercator-in-a-circle. No photo-disc. No `earth-4204`. No paid map keys.

### Talk

Ordinary language to Grok. No keyword router. Greetings do not hunt. Named hunt is the name. Photon + Grok `places[]`. Cap 8. Never invent a shop.

Grok may return `act:evolve` + `patch` of known rule keys. `SN.evolve` is the on-the-fly handle — the engine changes without a patch file. Never `eval` untrusted JS.

### Jobs / delivery engine (2026-09-09)

Vendor first. Never open a quote from two empty taps.

1. Hunt or tap a real pin. **Menu**, or **phone**. Same window: **TO MY GPS** or **PIN ON MAP**.
2. Then offer to drivers. Job fires then. Client who is also a driver still sees it.
3. Every stage is a verify: ACCEPT · VENDOR HANDED OFF · DRIVER GOT IT · DRIVER DELIVERED · I RECEIVED. No skip.
4. Bundled vendor % inside radius → no extra fee.

**Fault (no support desk). AI judges. At-fault pays. Bye.**

- Driver spoils the goods → driver pays replacement.
- Vendor ships the wrong goods → vendor pays the right goods **and** the new delivery fee.
- No ticket, no agent, no excuse.

**Work-legal**

Everyone who works on SpaceNet attests they can legally work at that GPS. Foreign placement only if **people here** posted a **labor-gap demand** (missing human resource, not cheaper imports). Politicians do not override the people on the ground.

Power `⏻` only if signed **vendor or driver**. Hold **3s** (countdown 3-2-1) to go live / closed. Notify “open to receive orders/jobs”. Guests and plain clients never see it.

No job starts until: logged in, client drop set (GPS or 1s pin), driver base set if they are a driver. Guest sees menu + LOGIN TO ORDER.

City/neighborhood: shop **pills** (photo or initial + name), not pink dots. Tap = profile + menu in the ⅓ sheet.

Fees: engine judges night / rain / heavy. Client only opts into **VIP +3** and **room/floor +3**, plus a **tip**. Price on top of the driver/client sheet.

Send = pending. **Vendor + driver + client must all confirm.** Until then there is no job. Then fit the map to vendor, driver, drop.

Sheets default **33vh**, bottom-up. One finger: pull up = full (88vh), pull down = close. Scroll inside. When inner scroll hits the end, the sheet itself moves. Same physics on JOBS.

### Node / mesh (4239)

Vercel (or later Hetzner) is the **front door only**. Users serve SpaceNet from their phones.

- IndexedDB replica of listings. Boots if origin is dark.
- BroadcastChannel mesh between tabs.
- Nearby nodes announce `kind:peer` on `/api/space` (existing function, no extra Hobby slot) **with a compact pack** of shops. A phone that is dark on origin hydrates from those packs. WANT / PACK / SERVED rows are the mailbox. AV€ credits when another phone takes your pack.
- WebRTC DataChannel (STUN only, `stun.l.google.com`) when GO LIVE or PULL REPLICA. If ICE fails, mailbox still works. No TURN. No extra function.
- Content id: SHA-256 CID of the replica. Helia (`js-libp2p`/IPFS) loads **only when the user goes live as a node**; if the CDN import fails, CID-IDB stays the store. Never mine on Vercel. Never sell Vercel CPU.
- `NODE` control under the island. Login required to go live. Owed AV€ for serving replica; settles from the job 3% cut when a delivery completes on a live node. Cap 40 AV€ owed.
- Island shows `node N` peer count. Map: at most 6 node dots at zoom ≥ 13.

Origin later: Hetzner EU + Cloudflare. Mesh does not wait.

### Money

AV€ = euro 1:1. Real PayPal. Withdraw 3%. Pool. Guest sees no balance.

### Roles

Vendor / driver / agent / ambassador after Terms. Notis activates.

---

## Kept

- Pizzarium is Pizzarium in Ανάληψη, Rhodes (Athinas Tarsouli 1) unless they asked another city.
- Leaflet does not throw them back to the globe on zoom.
- DISPUTE → Grok.
- CALL only with a real official telephone (10+ digits).
