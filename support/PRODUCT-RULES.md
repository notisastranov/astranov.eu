# Astranov SpaceNet — permanent product rules

Owner directives that agents must **never forget**.

## CLI

1. **CLI must be draggable with one finger** (touch + mouse).  
   - Handle: `#cli-drag` / grip on panel top  
   - Implementation: `js/spacenet/ui.js` → `bindCliDrag()`  
   - Position persisted: `localStorage['sn:cli-pos-v1']`  
   - Do not remove free-position dock mode (`#dock.free`).

2. CLI is the primary control surface for SpaceNet (jobs, dating, delivery, search, zoom, crawl).

## Identity

- Product name: **Astranov SpaceNet** (not bare “SpaceNet” only in titles).

## Zoom

- Tiers: solar → global → national → city; always able to return to Earth (`earth` / 🌍).

## Perf

- Prefer lite modular shell under `js/spacenet/`; do not re-enable 1MB phase/deferred boot by default.

---

*Updated 2026-07-22 — one-finger CLI drag.*
