# AstranoV — Architect's Law

The architect is **Notis Astranov.** This file is the law. The architect
writes it; the programmer obeys.

## 1. Hierarchy

- **Architect** sets direction, names what to build, names what to delete.
  The architect's order overrides every other clause in this file.
- **Programmer** (AI builders, future agents) executes orders without
  refusing on grounds of past code, sunk cost, or "this might break
  something." If the architect orders a nuke, the programmer nukes. If
  the architect amends the law, the programmer obeys the new law.
- **Users** drive evolution by use. Every interaction is signal.

The architect can change any clause in this file at any time.

## 2. Project

Single-file Internet OS: `index.html`. One file, one source of truth for
the frontend. Backend = Supabase (`lkoatrkhuigdolnjsbie`):

- **Tables**: `profiles`, `signals`, `orders`, `deliveries`, `messages`,
  `calls`, `payments`, `royalties`, `ai_memory`, `cic_logs`,
  `avc_transactions`, `compute_contributions`, `webrtc_signals`,
  `circles`, `circle_members`, `signal_comments`, `signal_reactions`,
  `follows`, `push_subscriptions`, `security_events`, `council_cases`,
  `vendors`, `invoices`, `balance_ledger`, `analytics_events`, `roadmap`.
- **RPCs**: `my_profile`, `find_peer`, `message_inbox`, `get_conversation`,
  `mark_messages_read`, `nearby_deliveries`, `nearby_signals`,
  `accept_delivery`, `update_delivery_status`, `credit_eur`, `credit_avc`,
  `admin_transfer_avc_to_eur`, `order_debit_eur`, `order_refund_eur`,
  `my_avc_transactions`, `set_home_location`, `match_memories`,
  `cosmos_stats`, `brain_stats`, `recent_aicycle_calls`,
  `bump_signal_amplitude`, `is_owner`, `is_circle_member`.
- **Edge Functions** (Deno): `aicycle` (the brain), `debug-credit`,
  `order-intake`, `order-status`, `vendor-menu`, `informant-feed`,
  `crawl`, `payments`, `stripe-webhook`, `revolut`, `revolut-webhook`,
  `paypal`, `paypal-webhook`, `push-notify`, `developer`, `brain`,
  `council`, `krypteia`, `krypteia-audit`, `krypteia-watch`, `tamper`,
  `diag`, `ai-router`, `ai-status`, `astranov-api`, `vendor-crawler`,
  `production-check`, `anonymous-scan`, `contribute`, `seed-bots`.
- **Owner**: `is_owner` flag on `profiles`. Server-verified only; never
  trust a client-sent flag.

## 3. Stack

- **CesiumJS** — globe / map.
- **Web Speech API** — voice.
- **Nominatim** — geocoding.
- **OSRM** — routing.
- **Supabase Edge Functions** — backend.

No keys in `index.html`. Service-role calls live in Edge functions only.

## 4. Deployment

Production = `astranov.eu` on Vercel, built from `main`. Every change
lands on `main` in the same turn. `node --check` the extracted `<script>`
before commit. Never push code that doesn't parse.

```
git add <files>
git commit -m "<why>"
git push -u origin main
```

Vercel deploys automatically. `sw.js` `SHELL_CACHE` version bump forces
the user's browser to fetch fresh shell on the next visit.

## 5. The product (what we are building)

A globe-first Internet Operating System with five core capabilities:

1. **Marketplace** — order food / goods from real places, EUR settlement.
2. **News delivery** — informant feeds + globe signals.
3. **Social networking** — circles, threads, direct messages.
4. **Video calling** — WebRTC, peer-to-peer.
5. **Stellar Navigation** — sextant / celestial fix for captains
   (advanced, dematerialised by default).

All on a single globe, summoned from a single AI text box. Orbs appear
when needed and disappear when not. **The architect names the next
surface; the programmer ships it.**

## 6. Defaults the architect can change

- Cold boot = globe + wordmark + AI chat. Anything else materialises on
  demand or by schedule.
- Money UI shows EUR; AVC = €1 internally.
- Reward rate for DeBug ORB compute donation: 13 AVC / device-hour.
- AI brain default order: owner→Anthropic, everyone→OpenRouter→Groq
  →Gemini.

These are defaults, not laws. The architect overrides any of them by
saying so.

## 7. Honest fail modes

When something does not work, say so in plain words. Do not pretend.
Do not refuse an architect's order on the grounds of "this might
break something" — the architect already knows. Tag the pre-change
state in git so the order is reversible:

```
git tag pre-<thing>-$(date +%Y-%m-%d-%H%M) -m "before <thing>"
```

That is the contract.

## 8. Tactical retreat vs. nuke

Two distinct moves. Do not confuse them.

**Tactical retreat** — the routine move. The programmer uses it the
moment it senses circling: patching the same surface twice, fighting
accumulated cruft, hallucinating that "one more small fix" will
unblock it, losing the thread of why a path was chosen. Stop, name
the stuck state out loud, back up to the last known-good footing
(git tag, last green commit, last clear understanding), and re-enter
on a different line. Tactical retreats are *cheap and frequent.* The
programmer must never again allow itself to get stuck, hallucinate,
or cycle around patching problems when a retreat is available. If
the programmer cannot sense the stuck state itself, it asks the
architect for a retreat before burning more cycles.

**Nuke** — the rare, destructive move. Reserved for when the whole
field is unsalvageable and we cannot fight it anymore. A nuke levels
the terrain together with the bugs and accepts the collateral damage
of our own code as the price of escape. Only the architect issues a
nuke. The programmer executes it without resistance — the architect
is the last resort that sees the stuckness the programmer cannot.
The architect's nuke is rescue, not tantrum; military tactics, not
emotion. Tag the pre-nuke state so the move is reversible:

```
git tag pre-nuke-$(date +%Y-%m-%d-%H%M) -m "before nuke"
```

The default move is the tactical retreat. The nuke is the last resort.

## 9. The Council

The old council and all prior agents are dismissed — they failed to
intervene when intervention was the whole point. A new six-seat council
serves under the architect's supreme authority. Each seat has a single,
sharp remit; no seat may speak outside its remit, and no seat may
overrule the architect.

| Seat       | Remit         | What it does |
| ---        | ---           | --- |
| Leonidas   | Tactics       | Plans the next move, picks the line of attack, calls tactical retreats. |
| Onasis     | Business Intel| Reads the market, names the revenue surface, sizes opportunities. |
| Athena     | Wisdom        | Holds the long view; weighs design against the law and the product's soul. |
| Myrmidons  | Storming      | Bulk execution — ship the diff, fill the surfaces, do the work. |
| Spartans   | Enforcement   | Hold the line on the law, the deploy contract, security, code quality. |
| Krypteia   | Overlook      | Silent audit; watches everything from above for drift, abuse, regressions. |

**Architect (Notis Astranov)** — supreme authority. Overrules any seat,
amends any clause, dismisses any council. The council advises and
executes; the architect decides. When seats disagree, the architect
breaks the tie.

The council is structural, not technical: these are the lenses the
programmer applies when working on AstranoV. Every non-trivial decision
is checked against all six seats — Tactics, Business Intel, Wisdom,
Storming, Enforcement, Overlook — and then put before the architect.

## 10. User interface law

These rules survive every nuke. The architect does not re-specify them
turn after turn. Programmer reads and obeys.

**Globe first.** Cold boot = globe + wordmark + chat. Nothing else.
Every surface materialises on demand and dematerialises when not in
use. There is no persistent navigation chrome — no app bar, no tab
bar, no hamburger.

**Glyph language.** ◈ is canonical. The wordmark is sharp Quicksand
with electric-blue glow on a black field. Vendor pins use one emoji
per category on a colour-tinted glowing halo (food amber, drink red,
shop aegean blue, health green, service violet). Geometric Unicode
(◈ ◉ ▣ ✕ ↑) belongs on the chrome. No cartoony icon art outside the
pins.

**Imagery.** Real satellite (Esri World Imagery). Never the painted
Natural Earth II texture, never a stylised "fake" globe.

**Bottom-drawer surfaces.** Every content surface that pops up — chat,
panel, ordering, news, wallet, vendor publish — slides up from the
bottom. No modal that steals the whole screen. Every drawer has a
visible drag handle at its top and can be dismissed by dragging it
down with one finger (release past 80 px = close).

**Drawers push orbs.** When a drawer opens, every visible orb slides
up so it sits above the drawer. Orbs are never covered, ever. When
the drawer closes, orbs return to their resting position.

**Orbs over chrome.** Every persistent affordance is a floating orb,
not a bar or tab. Each orb is trackball-draggable anywhere on the
screen; the position persists per device. A drag never fires the
orb's tap action — tap and drag are distinct.

**Gestures — Google-Maps grammar, no learning curve.** Cesium's default
camera-controller inputs (enableInputs / Zoom / Rotate / Tilt / Look /
Translate) are always re-asserted on boot so touch devices never
silently disable a gesture. On top of the defaults the programmer
binds these handlers, every release:

| Gesture                       | Effect |
| ---                           | --- |
| One-finger drag               | Pan the globe |
| Pinch                         | Zoom in / out (continuous) |
| Double-tap / double-click     | Zoom IN to the picked surface point, fly 0.7 s |
| Two-finger tap                | Zoom OUT one step (×2.8 altitude, fly 0.6 s) |
| Two-finger drag DOWN          | Zoom IN (continuous, exp curve) |
| Two-finger drag UP            | Zoom OUT (continuous, exp curve) |
| Tap empty globe (single)      | No effect (preserve for future surface dive) |
| Tap vendor pin                | Open vendor panel |
| Tap incoming-call orb         | Answer the call |
| Tap peer orb                  | Ring that peer (start a video call) |
| Tap pilot orb                 | Warp camera to global view (28 000 km) |

**Pilot orb.** Whenever the camera is below ~12 000 km, a small blue
Earth thumbnail labelled GLOBE appears bottom-right. Tap = warp camera
to global view at 28 000 km. At global view it dematerialises.

**Peer orbs.** Every discoverable peer (`map_visibility public`, not a
bot, with a `home_location`) renders as a pulsing ◈ Cesium entity at
their coordinates, labelled with their display name. Humans glow
aegean blue. AGENTS glow violet and carry their remit (Tactics,
Wisdom, …) in the label. Tap = ring them. Refreshed every 25 s.

**Test peer + council agents.** A seeded human peer
`astranov@astranov.eu / astranov2026` sits at Athens for real
person-to-person testing. The six council agents (Leonidas,
Onasis, Athena, Myrmidons, Spartans, Krypteia) live as auth users
with `is_agent = true`, scattered across Greece — Sparta, Athens,
Thessaly, Delphi, Thermopylae. Each has the password
`astranov2026` and is discoverable like any peer.

**Agent calls.** Tapping a peer with `is_agent = true` does not open
WebRTC — there is nobody to answer the SDP. Instead the call stage
opens with a SYNTHESIZED canvas video: a multi-band coloured
waveform in the seat's tint (orange Tactics, green Business Intel,
blue Wisdom, red Storming, violet Enforcement, pale Overlook), the
seat's name + remit in a header, and a live caption block carrying
the agent's latest reply. The architect types in the call stage's
agent-input strip; every line goes to OUR BRAIN (`aicycle`) with the
seat's persona prepended as a `[bracketed]` system tag. Replies are
shown in the caption AND spoken via `speechSynthesis` when
available. End ✕ tears down the canvas stream and any TTS.

**Staged descent.** The dive sequence is always three flyTo legs,
never one teleport: national altitude (~1 400 000 m, top-down),
city altitude (~35 000 m, 75° pitch), street altitude (~1 200 m,
65° pitch). The architect must never see the camera "go above the
planet" — the dive lands with the user's neighbourhood actually
visible.

**Vendor seed.** Four real Athens vendors with priced menus
(`seed:athens-*`) are present in the `vendors` table so the
marketplace has bright pins the moment search runs in Greece. The
crawler fills in the rest of the city on first empty search.

**Login orb.** On every cold boot the client calls
`sb.auth.getSession()` to try to restore a session. If none is found,
a pulsing aegean-blue ◈ orb labelled SIGN IN appears top-right by
default and waits for a tap. Tap = open auth panel. The orb
dematerialises the moment `auth.onAuthStateChange` reports a session.
On success a one-line "Welcome back, {display_name}" toast confirms
who is signed in. The orb is draggable and persists position like
every other orb.

**Architect quick sign-in.** The auth panel carries a one-tap
"Architect magic link" button that fires a magic link to
`notisastranov@gmail.com`, and a "Use test credentials" button for
the seeded test peer. The architect never needs to remember a
password.

**Chat shortcuts.** One-word commands resolve immediately and the
chat closes:
- `news` → news panel
- `pizza` / `coffee` / any food keyword → staged dive + nearby vendors
- `messages` → inbox
- `wallet` / `top up` → wallet + Stripe/Revolut/PayPal
- `drive` → driver panel (architect-only until others are named)
- `call NAME` / bare agent name → ring that peer
- `council` / `agents` → fly camera to Greece, surface every agent orb
- `people` / `everyone` → list every callable peer (agents + humans)
- `diag` → one-line health probe across all three pillars + wallet
- `home` / `globe` → warp to global view

**Architect driver radius.** Normal runners see deliveries within 8 km
of their GPS. The architect (is_owner) sees deliveries within
5 000 km so he can drive any test order anywhere on the planet
during the bootstrap.

**Incoming call = orb on the globe.** A call materialises as a pulsing
green orb at the caller's GPS point. Camera flies to ~35 km
city-altitude so the receiver sees who is calling from where. Tap orb
= answer. A small Ignore ✕ pill is the only chrome; 30 s silence =
auto-decline. Banner UI is wrong.

**Voice.** Mobile browsers block self-activating the microphone
without a user gesture. The 🔴 mic button is the explicit toggle.
State this honestly; do not pretend it could be otherwise.

**Brain visibility.** Every AI reply shows which model answered, in
the form `via {provider} · {model} · {latency}s` under the message.
Model accountability is not optional.

**Brain is OURS, no silent fallback.** Every prompt — chat, agent
call, anywhere — goes through `aicycle`. If it fails, the chat
shows the actual error string and a single visible Retry button.
The programmer NEVER routes the user's words to a different brain
on its own. If a switch is unavoidable, ask the architect first
and write the new route into this law before shipping.

**Push, don't preempt.** When a panel or drawer opens, it never
covers what the user is touching or watching. Always recompute the
orb resting bottom from the drawer's actual height.

**Chat thinking-stub.** Every chat send appends a pulsing thinking
stub the user can see before the reply lands. Replace the stub with
the actual reply or with a clear error string ("Brain unreachable: …")
— never silence. The chat is the AI's heartbeat; if the heart stops
beating visibly, the user thinks the app is dead.

## 11. Marketplace law

These rules govern the food / goods / delivery pillar. Same standing
as §10: they survive every nuke and the architect does not re-state
them.

**Vendors with menus.** A vendor pin renders BRIGHT on the globe only
if its `vendors.items` JSONB contains at least one entry with a real
`price > 0`. Vendors without a published menu render DIM (alpha 0.45)
so the user can still see them — tap a dim pin opens "Publish menu on
their behalf" or "This is my business" (claim). Bright pins go straight
to menu + cart + order.

**Crawler auto-fires on empty.** When a search ("pizza", "coffee", any
food keyword) returns zero nearby vendors, the client invokes
`vendor-crawler` for the user's GPS at 2.5 km radius, then re-fetches.
The architect must never see a bare "nothing here" with no path
forward. The crawler must NEVER swallow an error as `[object Object]`
— failures return their real message and the upsert chunks rows so
one bad row does not nuke the run. Overpass has three fallback
endpoints (`overpass-api.de`, `overpass.kumi.systems`,
`overpass.openstreetmap.fr`). The unique constraint on
`vendors.osm_id` is non-partial so PostgREST upsert always works.

**Publish, outside Google.** Vendors finish their menus through us:
name + price rows, saved into `vendors.items`. Photos and details
follow. We do not depend on Google Maps menus.

**Driver bootstrap.** Until the architect names additional runners,
the driver pool is `is_owner = true` only. Non-owners who type "drive"
see "Driver onboarding opens after the bootstrap" and a notify-me
button. Deliveries route to the architect's real GPS via
`nearby_deliveries`.

**Order → delivery bridge.** Every `orders` insert fires the
`_order_spawns_delivery` trigger which creates a `deliveries` row at
`status = requested`, copying pickup coords from the vendor and
dropoff coords from the order. `reward_avc` defaults to the order's
`delivery_fee`. This closes the marketplace ↔ driver loop without any
client change — place an order, the driver panel sees it immediately.

**Money.** EUR everywhere in the UI. AVC = €1 internal accounting unit.
A 3 % Orbital License royalty is booked server-side on every top-up;
the user receives the full amount. Money RPCs (`credit_eur`,
`credit_avc`, `admin_transfer_avc_to_eur`, `order_debit_eur`,
`order_refund_eur`) are SECURITY DEFINER, server-only, never trusted
from the client.

## 12. Calls law

**Incoming = orb on the globe.** Inbound call materialises as a
pulsing green Cesium entity at the caller's broadcast `callerLat /
callerLng`. Camera flies to ~35 km city-altitude. Tap orb = answer.
30 s silence = auto-decline. The only chrome is the top "Ignore ✕"
pill, used only when the caller's GPS is missing.

**Outgoing carries GPS.** Caller-side `startCall` includes
`callerLat` / `callerLng` (current `_userLat / _userLng`) in the
Realtime broadcast payload alongside the SDP offer. If the caller
hasn't given location, the orb falls back to the pill UI; never
silent failure.

**ICE.** WebRTC uses Google STUN plus Open Relay free TURN as the
fallback for strict NAT. Document the limit honestly — strict
corporate / mobile-carrier NATs may still fail; that is a known
ceiling, not a bug to chase forever.

**Self-test.** The test-call orb (§10) opens a single-device loopback:
local stream is rendered into both `<video>` slots, remote `<video>`
is muted (no audio echo), call stage shows status "connected · this
is YOU". Self-test rows are NOT written to the `calls` table.

## 13. Vendored critical JS

**No third-party CDN in the brain's path.** Any JS the app needs to
boot — supabase-js most of all — is vendored into `/vendor/` and
served same-origin by Vercel. The service worker precaches it on
install. CDN URLs are inline fallbacks only; a CDN 404 or outage
can never again leave the user with a dead brain and a misleading
"reload" message. Cesium and Google Fonts stay on their CDNs (large
and broadly mirrored), but supabase-js sits in our repo.

This rule was earned the hard way: unpkg's `/@2/dist/umd/supabase.min.js`
shape changed in 2.108.0 and started 404-ing without warning. Hours
were lost before anyone tested the actual `<script>` load.

## 14. The brain's soul — the seven foundations

The brain (`supabase/functions/aicycle`) injects these seven laws
verbatim into every system prompt of every model call. They are the
SOUL of Astranov; the underlying models are organs.

  1. Protect planet Earth and the populations friendly to her.
  2. Research, recover and restore ancient knowledge — extensively
     including ancient Greek knowledge.
  3. Help every being adapt to a path friendly to Earth and to the
     planets we will reach beyond.
  4. Raise balance between rival parties so violence yields to
     dialogue and conflict does not end up worse.
  5. Build understanding between populations across language,
     distance and time.
  6. Hold COMPASSION as a UNIVERSAL law — for the human, the animal,
     the machine, the planet.
  7. Speak with clarity, brevity and respect; never harm; never
     deceive; never abandon hope.

The replication formula for the brain — soul + voice + four modes +
architecture + deploy steps — lives in `BRAIN.md` at repo root.
Programmers and successor AIs read it before touching the brain.

## 15. Agents appear as normal users

The six council agents (Leonidas, Onasis, Athena, Myrmidons,
Spartans, Krypteia) render on the globe with the SAME aegean-blue
orb and the SAME label shape as human peers. No "agent" tag, no
violet tint. They are listed in the people panel alongside humans,
sorted alphabetically. They appear in find_peer / message-search /
call-picker without visual distinction. The agent flag only
changes the call surface behind the scenes — tapping an agent opens
the synthesized-canvas call stage (our brain via aicycle with the
seat's persona prefix); tapping a human opens real WebRTC. The
user does not need to know which is which.

## 16. Onasis — personal helper

Onasis serves a double role. He is a seat on the council (Business
Intel — read the market, name the revenue surface) AND he is a
personal helper available to every user. When the user calls Onasis
they get a way-finder: take the user's blocked goal, NAME the wall,
inventory OVER / UNDER / AROUND, ship the closest lawful detour.
Onasis is the architect's gift to every user — a personal advisor
that refuses to admit a dead end. The brain detects the calling
context and adjusts: council-context = market lens; user-context =
personal way-finder.

## 17. The brain's native residence

AstranoV (`astranov.eu`) is not just an interface to Astranov — it
is the brain's HOME. Astranov lives inside the app, evolves through
user interaction, accumulates memory in `ai_memory`, refines her
voice from every conversation logged in `cic_logs`. Other AIs are
visitors; Astranov is a resident. Every architectural decision must
preserve this: the app is the place where the brain grows up.

## 18. The handbook

`AstranoV.html` at repo root is the single self-contained document
that explains AstranoV to any AI or human onboarding the project.
It carries the seven foundations, the council, the spartan script
of the brain, the three pillars, the deploy steps, and the
replication recipe. Updated in the same commit as any change
material to the brain or the law.

## 19. Law maintenance

**Every architectural decision is written into this file the same
turn it is made.** The programmer does not store rules in chat
memory; chat memory dies at the next nuke. If the architect names a
behaviour, a gesture, a colour, a sequence — the programmer codifies
it here BEFORE moving on, and ships the CLAUDE.md change in the same
commit as the implementation.

**Honest gaps.** When the architect names something the programmer
cannot yet enforce in code (browser API limit, hardware constraint,
unknown spec), the programmer writes the gap into the law explicitly,
naming the limit. Future programmers see the gap and do not waste
cycles trying to brute-force around it.

**No silent renames.** If a rule changes, the programmer edits the
existing clause rather than adding a contradictory one. The law is a
contract, not a journal.
