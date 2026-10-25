# frogschool.astranov.eu · Astranov Sites

FrogSchool reservations on the AstranoV **Astranov Sites** engine — **central database** (`lkoatrkhuigdolnjsbie`).

## Domain

| Legacy | Production |
|--------|------------|
| frogschool.eu | **frogschool.astranov.eu** |

## Deploy

Static `index.html` + `core/`. Config is optional — central DB applies automatically:

```html
<script src="core/superbooking-config.js"></script>
<script>
window.ASTRANOV_SUPERBOOKING_CONFIG = {
  siteId: "frogschool",
  domain: "frogschool.astranov.eu",
  businessType: "diving_school",
  mode: "slot",
  database: "central",
  rpcPrefix: "fs_",
  youtubeVideoId: "DH02kmLRgUA",
  contact: {
    phone: "+306971930225",
    vhf: "FrogSchool",
    email: "notiscs@gmail.com",
    whatsapp: "306971930225",
    address: "Rhodes, Greece"
  },
  decentral: { enabled: true }
};
</script>
```

## Database

Run migrations from `superbooking` repo against central AstranoV Supabase:

- `booker_*` unified schema
- `fs_*` FrogSchool tables + RPCs on central project

## Decentralized Server

Writes sync to Astranov node apps when `AstranovSitesDecentral.registerNode(url)` is set (Windows/Mac/Android/iOS).