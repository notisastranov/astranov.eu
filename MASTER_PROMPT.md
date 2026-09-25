# ASTRANOV SPACENET — MASTER PROMPT

**What this file is:** the only instruction document. Paste this first. Then the live shell. Do not add SPECS, LAW, AGENTS, HELM, living-truth, escalation, or log markdown.

**Date:** 2026-09-25
**Stamp:** 4275 (Money top-middle. Support own menu top-right. No overlap. Offer route fit.)
**Owner:** Notis Astranov · Rhodes, Greece · notisastranov@gmail.com · X @astranov97250
**Live:** https://astranov.eu
**Repo:** notisastranov/astranov.eu · `main`

If rebuild law changes, **edit this file**. Chat is not the archive. Latest block wins.

---

---

## Latest (2026-09-25 — overrides older chrome notes)

Full rebuild after patch piles. One entity: `index.html` + `js/spacenet/app.js` + `js/spacenet/auth.js`. No overlay scripts. No power menu. No stretched wallet. No “SUPPORT” word on the chip.

### Power `#sn-power`

The power button is a power button. It does **not** open another menu. Ever.

- Hold **3 seconds** (countdown 3-2-1) → **offers on**. The application may pop job / nearby-work offers.
- Hold **3 seconds** again → **offers off**. Pop-ups stop.
- A tap that is shorter than 3 seconds does nothing except say “Hold 3 seconds.”
- Reload, terms, withdraw, apply-role do **not** live on power.

### YOU `#sn-me`

Roles activate from the user-account icon. Out: LOGIN / Google. In: YOU sheet — Terms + apply vendor / driver / agent / ambassador. Notis activates. Phone field is not login.

### Dock

`#plus` uploads to Grok. `#in` is a black plate so type is readable on the live map. `#go` on the right:

- Text in the field → send that text to Grok (`/api/ai`).
- Empty field → one-shot voice. The real assistant. It talks, it hunts, it can `act:evolve` known rule keys. Treat it like support. No keyword router in front of it.
- Voice is one-shot. No continuous restart. No beep loop. Speak the answer only if they used the mic.

### Support `#sn-support`

Icon only (🛟). No word “SUPPORT”.

### Money `#sn-money`

Chip width fits the amount. Do not stretch it across the stand.

- Guest: no personal balance (label `AV€` only).
- Signed user: **that user’s** AV€ only.
- Pool / treasury / platform cut: **owner `notisastranov@gmail.com` only**. Never paint the pool as someone else’s wallet.
- Users put money on the app with PayPal (`ADD 10` / `ADD 50` → `/api/paypal/create-order` · capture credits that account 1:1).

### Vendor menu

Right-click or tap / long-press lists a vendor. Easy menu: photo + each product’s name, price, note. Users check out on that same menu and assign the order to a delivery driver (`drv-notis` is the live approved driver).


### Support desk (2026-09-25 evening — overrides the SUPPORT word note)

`#sn-support` is the 🛟 chip. Tap opens **support mode on the same dock input**, not a second workshop.

- Label `SUPPORT` over `#in`. The field and GO/MIC glow red.
- Type or tap MIC. One control does both: empty = voice, text = send.
- The line talks to the support desk API (`/api/support/open`). A constrained Grok answers on that line.
- Background may queue the ticket for the builder. The browser never receives a project URL, agent id, repo, or GrokBuild chrome.
- Tap 🛟 again to leave support mode and restore the normal cyan field.
- LOGIN required. Guests get LOGIN, not the desk.


### Dock tabs (2026-09-25 night)

- `#sn-money` lives **top-right**, width fits the amount. Not on the power stand.
- `#sn-support` is 🎧, centered **on top of the input field** it triggers.
- Offers throw from the bottom as overlays. Support and each offer are tabs on `#sn-tabs` above the field.
- Fill button on the tab = maximize / minimize. Several tabs can stay open. Minimized is a small lit chip, not gone.
- Feedback on the support line still goes to the desk / builder in the background. No workshop chrome on the phone.


Support field is the real dock `#in` in support mode. No empty overlay. Desk API answers without login. Money sits under the island, top-right — never on `#sn-spark`.

### Chrome place law (2026-09-25 19:08)

No two chrome pieces share pixels. `layoutChrome` pushes. Bottom offer/job sheets cap at 28vh, set `--sheet-h`, and **push** `#dock` `#gps` `#sn-me` up. Map keeps the rest. `fitOfferRoute` pads the Leaflet view so the whole offer route sits in the visible map — not under the sheet, not under the island.

- `#sn-money` top **middle**, under the island, never on `#sn-spark`.
- `#sn-support` 🎧 top **right**, opens **its own menu** (textarea + MIC + SEND). Does not steal the main field.
- Offers throw from the bottom overlay only.

### Ship

Owner asked for verify-then-ship on this rebuild. Still: no dummy shops, no HUD, no twin CLI, no overlay scripts. Guest boot stays zero Supabase.


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

**Tree lock (4246) — this is the intervention that was missing.**

- `sw.js` serves `/* TREE LOCK */` for any `/js/spacenet/*` that is not `app.js` or `auth.js`. earth-4204 cannot run even if a later agent wires it into HTML.
- `index.html` MutationObserver in `<head>` strips those script tags.
- GitHub `vercel-push.yml` **fails** if `index.html` contains overlay scripts. No invoke, no ship.
- Do not edit the SW allowlist without the owner. That is how sausage Earth lands.

**Egress law (4246) — consume nothing without a real user. Owner will not pay Pro.**

Supabase Free cap is **5.5 GB egress / month**. Org already over (mail 9 Sep). After **12 Sep 2026** they 402 unless usage drops. So:

- Guest boot: **zero** `/api/space`, **zero** `/api/public-config`, **zero** weather. IndexedDB replica only. Globe is local canvas.
- LOGIN tap or OAuth return is what loads public-config.
- GPS is what GETs `/api/space?lat&lng` rounded to 0.01°. No lat → origin returns empty `need:gps` from CDN, **no Supabase**.
- GET never `select`s `body`. Project `body->>name` etc. A jpeg in one shop must not ride every listing download.
- GET URL has no `peer=` (that busted the CDN per phone). Old `peer=` URLs 302 to the grid URL.
- GPS GET: CDN `s-maxage=120` + 120s memory + `Vercel-CDN-Cache-Control`. Empty GET: `s-maxage=300`.
- POST `/api/space` requires a signed Bearer. Guests cannot write. Photos/sdp/pack stripped. 8 KB cap.
- `/api/public-config` CDN 300s.
- Guest does not POST peer/WANT. `postPeer` requires sign-in.
- Weather only after GPS, cached 30 min on the phone.
- No overlay scripts. No photo discs.

**Anon lock (4246)**

Vercel `SUPABASE_ANON_KEY` is empty. The working key is the publishable key on `/api/public-config` (and the edge `public-config` function). Every REST handler must resolve anon via `lib/sb-anon.js` (same env chain + edge fallback). Never `SUPABASE_ANON_KEY || SB_ANON` alone. CI fails the ship if `api/space.js` drops that require. Do not commit the key.

**SMS (4246)** `api/sms.js` must parse. A stray `return }` used to 500 the function.


Grok preview (`src/spacenet/*`) is the same chrome and laws.

---

## Chrome (frozen)

- Canvas globe `#g` full viewport — sphere math, continent fill + outlines, labels, trackball, inertia. Idle sits still. Pitch follows the finger.
- Brand island: `ASTRANOV SPACENET` + stamp. Tap = reboot.
- `JOBS` `#sn-tasks-btn` **centered under the island**. Posted jobs only. Never TASKS.
- `AV€` `#sn-money` always visible, width fits the amount. Guest sees the label only. Signed user sees own AV€. Pool only for owner.
- `LOGIN` `#sn-me` bottom-left. Out: LOGIN / IN. In: YOU / photo or first **letter**. Never two-char email slices. Never digits.
- `GPS` `#gps` bottom-right. Precise, then coarse, then tap-to-set.
- Dock: `#plus` upload · `#in` black plate · `#go` MIC if empty, GO if text.
- `⏻` `#sn-power` SVG. Hold 3s offers on. Hold 3s offers off. No menu.
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

Power `⏻` hold 3s toggles offer pop-ups for the signed session. It never opens a settings menu. Roles live on YOU.

No job starts until: logged in, client drop set (GPS or 1s pin), driver base set if they are a driver. Guest sees menu + LOGIN TO ORDER.

City/neighborhood: shop **pills** (photo or initial + name), not pink dots. Tap = profile + menu in the ⅓ sheet.

Fees: engine judges night / rain / heavy. Client only opts into **VIP +3** and **room/floor +3**, plus a **tip**. Price on top of the driver/client sheet.

Send = pending. **Vendor + driver + client must all confirm.** Until then there is no job. Then fit the map to vendor, driver, drop.

Sheets default **33vh**, bottom-up. One finger: pull up = full (88vh), pull down = close. Scroll inside. When inner scroll hits the end, the sheet itself moves. Same physics on JOBS.

### Node / mesh (4246)

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

AV€ = euro 1:1. Real PayPal deposit and job pay. Withdraw 3%. Guest sees no balance. Pool only on the owner account.

### Roles

Vendor / driver / agent / ambassador from the YOU icon after Terms. Notis activates.

---

## Kept

- Pizzarium is Pizzarium in Ανάληψη, Rhodes (Athinas Tarsouli 1) unless they asked another city.
- Leaflet does not throw them back to the globe on zoom.
- DISPUTE → Grok.
- CALL only with a real official telephone (10+ digits).

---

## Login and SMS lock (2026-09-24 — overrides older SMS notes and the “will not pay Pro” sentence)

Proven on the live project this night. Do not re-guess it.

- Phone sign-in is **off** (`phone: false`) even though the SMS provider field says Twilio.
- The SMS function has a secret and from-number `+18333030833`, and still returns `phone_verify: bad_sid` with an empty account SID. A paid Twilio balance does not send.
- `auth.js` only stores the phone and says it is unverified. That is not login and not a code.
- Google leaves the user on the database project host `lkoatrkhuigdolnjsbie.supabase.co`. That name is what people see. It is not an Astranov screen. The X button is drawn while the Twitter provider is off.
- A professional database plan does not rename that host and does not turn the phone provider on.

Locks. Latest block wins.

- Sign-in chrome is Astranov SpaceNet. Never open the database project host. Never show the project id as the product. A provider page is allowed only after a custom auth domain on an `astranov.eu` host is proven in a real browser.
- Never say a code was sent, and never say Twilio is live, unless that same request returned a message id. START/STOP delivery SMS is not a login code.
- Do not ship a phone field whose only effect is saving the number.
- Pro is paid. That retires “Owner will not pay Pro.” It does **not** retire the egress caps. Guest boot stays at zero Supabase.

Evolve. The helper develops the running rules, not a new login.

- Grok may return `act:evolve` plus a patch of known rule keys only. `SN.evolve` applies it in the running engine. Never `eval` untrusted JS.
- Keys may be rates, hunt cap (max 8), voice, and courier timing. Login chrome, SMS claims, secrets, and source text are not keys.
- Asked to optimize: keep these locks, tune only those keys, say what changed. Never invent a shop. Never claim the app rewrote itself.
