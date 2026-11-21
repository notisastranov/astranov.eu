# Astranov partner integration (SpaceNet)

Lean REST/JSON surface so Delivery Hero / DoorDash–class engineers (and direct vendors) can plug into the geospatial hub without learning a bespoke protocol.

## Three coexistence paths

1. **Partner API** — receive Astranov orders **or** push orders/offers to Astranov clients/drivers.
2. **Direct vendor** — restaurant or shop onboards on the map / API with **no** marketplace middleman.
3. **Platform city account (overflow)** — platforms that already hold vendor contracts create a **city / virtual office** listed as vendor type `delivery_services`, then push **overflow offers** to Astranov drivers when their own fleet is short.

## Vendor types (same map UX)

| `vendor_type` | Sells | Map UX |
| --- | --- | --- |
| `vendor` | Products / food | Insert → verify (GBP) → profile + menu → order |
| `delivery_services` | Delivery capacity | **Same UX** — DoorDash/DH (or local couriers) list as this type; “menu” = delivery SKUs / zones / rates |

## Auth

- `Authorization: Bearer <api_key>`
- Optional later: OAuth2 client-credentials (`ASTRANOV_PARTNER_OAUTH_*`)
- Creates: send `Idempotency-Key` (or `external_id` / `external_delivery_id`)

## Endpoints

| Method | Path | Who |
| --- | --- | --- |
| POST | `/api/partners/orders` | Partner → Astranov order/offer |
| POST | `/api/partners/orders/:id/status` | Status patch |
| POST | `/api/partners/webhooks/test` | Echo + header check |
| POST | `/api/partners/city-accounts` | Register city / virtual office |
| POST | `/api/partners/overflow-offers` | Overflow driver offer |
| POST | `/api/vendors/direct` | Direct vendor register |
| PUT | `/api/vendors/direct/:id/menu` | Menu / delivery-SKU sync |
| GET | `/api/partners/openapi.json` | Light OpenAPI |

## Env vars (names only)

- `ASTRANOV_PARTNER_API_KEYS`
- `ASTRANOV_PARTNER_WEBHOOK_SECRET`
- `ASTRANOV_PARTNER_OAUTH_CLIENT_ID`
- `ASTRANOV_PARTNER_OAUTH_CLIENT_SECRET`
- `ASTRANOV_PARTNER_OAUTH_TOKEN_URL`
- `ASTRANOV_VENDOR_DIRECT_ENABLED`
- `ASTRANOV_OVERFLOW_ENABLED`

## Statuses

`created` → `accepted` → `preparing` → `ready_for_pickup` → `picked_up` → `delivered` | `cancelled`

## Browser helper

```js
// after /js/spacenet/partners/types.js + client.js
SNPartners.pushOverflowOffer({
  external_id: "dd-overflow-1",
  source: "platform_overflow",
  vendor_type: "delivery_services",
  vendor: { name: "DoorDash Rhodes VO", lat: 36.43, lng: 28.22 },
  dropoff: { lat: 36.44, lng: 28.23 },
  offer: { driver_payout_cents: 500, expires_at: "…" }
}, apiKey);
```

Research: Project store `docs/partner-delivery-research.md`.
