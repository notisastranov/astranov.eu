# Astranov Brain Protocol — never amnesia again

**Owner cost of amnesia:** wasted development time, near project death, financial damage.  
**Fix:** product memory lives in **code**, not chat.

## Where memory lives

| Layer | Path | Role |
|-------|------|------|
| Runtime brain | `js/spacenet/brain.js` | `window.SNBrain` / `AstranovBrain` |
| Continuity | `astranov-continuity.js` | features / doNotRemove / antiPatterns |
| Short law | `support/PRODUCT-RULES.md` | bullets |
| Full law | `ASTRANOV_SPACENET_GUIDE.md` | human readable |
| Agent entry | `CLAUDE.md` / `AGENTS.md` | force-read |

## Runtime API

```js
SNBrain.systemPrompt()   // → freeform AI (aicycle)
SNBrain.verify()         // → sacred checks after boot
SNBrain.summaryLines()   // → CLI "brain"
SNBrain.lawLines()       // → CLI "law"
SNBrain.remember(k, v)   // → local long-term notes
SNBrain.dumpForAgent()   // → full dump for tools
```

## CLI

- `brain` — summary of law + juice priority  
- `law` — authority + anti-patterns + mindset  
- `verify` — runtime sacred checks (inertia, drag, crawl, tasks, AI)

## Every agent session

1. Read PRODUCT-RULES + GUIDE + `brain.js`  
2. Confirm inertia + CLI drag + zoom tiers  
3. Work **only juice** (crawl → city → job/date/delivery)  
4. If owner adds a rule: update **brain.js** + guide + PRODUCT-RULES **same session**

## Mindset

Extend `js/spacenet/*`. Never rebuild from zero to “fix lag.”  
Sacred physics first. Then the network that populates maps and runs city life.
