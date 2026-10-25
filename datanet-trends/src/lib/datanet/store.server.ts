import { getSql } from "@/lib/db";
import type { Access } from "@/lib/datanet/access.server";
import seedFile from "@/lib/datanet/eirini-seed.json";
import trendsFile from "@/lib/datanet/trends-seed.json";
import type { Board, MediaKind, MenuRow, RowDraft, Shop, ShopLink } from "@/lib/datanet/types";

type SeedRow = {
  id: string;
  sortIndex: number;
  categoryEl: string;
  categoryEn: string;
  nameEl: string;
  nameEn: string;
  descriptionEl: string;
  descriptionEn: string;
  price: number;
  priceNoteEl: string;
  priceNoteEn: string;
  available: boolean;
  mediaUrl: string;
  mediaKind: string;
  sourceCode: string;
  hasOptions: boolean;
  catalogTextEl: string;
  observedOn?: string;
  sourceUrl?: string;
  prevPrice?: number | null;
};

type SeedShop = {
  id: string;
  slug: string;
  nameEl: string;
  nameEn: string;
  tradeEl: string;
  tradeEn: string;
  address: string;
  city: string;
  postal: string;
  neighborhood: string;
  country: string;
  lat: number;
  lng: number;
  rating: number;
  ratingCount: number;
  cuisinesEl: string;
  cuisinesEn: string;
  hours: string;
  hoursEl: string;
  minOrder: number;
  deliveryFee: number;
  etaMin: number;
  isOpen: boolean;
  pickup: boolean;
  payCard: boolean;
  payCash: boolean;
  ownDelivery: boolean;
  coverUrl: string;
  logoUrl: string;
  efoodId: number;
  efoodUrl: string;
  catalogAsOf: string;
  factsAsOf: string;
};

const seed = seedFile as { shop: SeedShop; rows: SeedRow[] };
const trends = trendsFile as unknown as { shop: SeedShop; rows: SeedRow[] };

const TRENDS_NOTE =
  "Shared starting menu for every signed-in member. Copy it before you edit. Item prices are the latest public reading and say where they were measured. A national or Chalkidiki figure is not a Rhodes receipt. Shop cards are the most-reviewed Rhodes listings on the public efood list and are not item prices. The sheet is rewritten every Sunday at 00:00 Europe/Athens.";

const EIRINI_NOTE =
  "Item rows are the efood menu photographed on 22 Oct 2026 at 17:00. English text is the app’s own wording. Greek names sit beside it. Prices include VAT. “From” is a base price. Weighed rows are per kilo and the scale sets the final amount. The app hid unnamed items as not available: 1 pastry, 13 mini ice creams, 3 sandwiches and 2 burgers. Crepes had no visible items. A few English labels were garbled (I was dry, Snowmobiles, Bust the kilo, Climbs, Chickens); the Greek name is the best reading and the app label is kept in the description. Popular ranks are noted on the real row, not copied twice. Drink photos are the earlier efood pack shots. Hours, fees, rating and open state still come from the public shop list.";

function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function flag(v: unknown): boolean {
  return v === true || v === "t" || v === "true" || v === 1 || v === "1";
}

function kind(v: unknown): MediaKind {
  return v === "image" || v === "video" ? v : "none";
}

function mapShop(r: Record<string, unknown>): Shop {
  return {
    id: String(r.id),
    slug: String(r.slug),
    nameEl: String(r.name_el ?? ""),
    nameEn: String(r.name_en ?? ""),
    tradeEl: String(r.trade_el ?? ""),
    tradeEn: String(r.trade_en ?? ""),
    address: String(r.address ?? ""),
    city: String(r.city ?? ""),
    postal: String(r.postal ?? ""),
    neighborhood: String(r.neighborhood ?? ""),
    country: String(r.country ?? ""),
    lat: num(r.lat),
    lng: num(r.lng),
    rating: num(r.rating),
    ratingCount: num(r.rating_count),
    cuisinesEl: String(r.cuisines_el ?? ""),
    cuisinesEn: String(r.cuisines_en ?? ""),
    hours: String(r.hours ?? ""),
    hoursEl: String(r.hours_el ?? ""),
    minOrder: num(r.min_order),
    deliveryFee: num(r.delivery_fee),
    etaMin: num(r.eta_min),
    isOpen: flag(r.is_open),
    pickup: flag(r.pickup),
    payCard: flag(r.pay_card),
    payCash: flag(r.pay_cash),
    ownDelivery: flag(r.own_delivery),
    coverUrl: String(r.cover_url ?? ""),
    logoUrl: String(r.logo_url ?? ""),
    efoodId: num(r.efood_id),
    efoodUrl: String(r.efood_url ?? ""),
    catalogAsOf: String(r.catalog_as_of ?? ""),
    factsAsOf: String(r.facts_as_of ?? ""),
    sourceNote: String(r.source_note ?? ""),
    audience: r.audience === "owner" || r.audience === "members" ? r.audience : "self",
    userId: String(r.user_id ?? ""),
  };
}

function mapRow(r: Record<string, unknown>): MenuRow {
  return {
    id: String(r.id),
    shopId: String(r.shop_id),
    sortIndex: num(r.sort_index) ?? 0,
    categoryEl: String(r.category_el ?? ""),
    categoryEn: String(r.category_en ?? ""),
    nameEl: String(r.name_el ?? ""),
    nameEn: String(r.name_en ?? ""),
    descriptionEl: String(r.description_el ?? ""),
    descriptionEn: String(r.description_en ?? ""),
    price: num(r.price),
    priceNoteEl: String(r.price_note_el ?? ""),
    priceNoteEn: String(r.price_note_en ?? ""),
    available: flag(r.available),
    mediaUrl: String(r.media_url ?? ""),
    mediaKind: kind(r.media_kind),
    sourceCode: String(r.source_code ?? ""),
    hasOptions: flag(r.has_options),
    catalogTextEl: String(r.catalog_text_el ?? ""),
    prevPrice: num(r.prev_price),
    observedOn: String(r.observed_on ?? ""),
    sourceUrl: String(r.source_url ?? ""),
  };
}

async function ensureSeed(): Promise<void> {
  const sql = await getSql();
  const found = await sql<{ id: string }>`select id from shops where id = ${seed.shop.id}`;
  if (found.length === 0) {
    const s = seed.shop;
    await sql`
      insert into shops (
        id, slug, name_el, name_en, trade_el, trade_en, address, city, postal,
        neighborhood, country, lat, lng, rating, rating_count, cuisines_el, cuisines_en,
        hours, hours_el, min_order, delivery_fee, eta_min, is_open, pickup, pay_card,
        pay_cash, own_delivery, cover_url, logo_url, efood_id, efood_url, catalog_as_of,
        facts_as_of, source_note, audience, user_id
      ) values (
        ${s.id}, ${s.slug}, ${s.nameEl}, ${s.nameEn}, ${s.tradeEl}, ${s.tradeEn},
        ${s.address}, ${s.city}, ${s.postal}, ${s.neighborhood}, ${s.country},
        ${s.lat}, ${s.lng}, ${s.rating}, ${s.ratingCount}, ${s.cuisinesEl}, ${s.cuisinesEn},
        ${s.hours}, ${s.hoursEl}, ${s.minOrder}, ${s.deliveryFee}, ${s.etaMin}, ${s.isOpen},
        ${s.pickup}, ${s.payCard}, ${s.payCash}, ${s.ownDelivery}, ${s.coverUrl}, ${s.logoUrl},
        ${s.efoodId}, ${s.efoodUrl}, ${s.catalogAsOf}, ${s.factsAsOf}, ${EIRINI_NOTE},
        ${"owner"}, ${""}
      )
    `;
  } else {
    const stamp = await sql<{ catalog_as_of: string }>`select catalog_as_of from shops where id = ${seed.shop.id}`;
    if (String(stamp[0]?.catalog_as_of ?? "") !== seed.shop.catalogAsOf) {
      await sql`delete from menu_rows where shop_id = ${seed.shop.id}`;
      await sql`
        update shops set
          catalog_as_of = ${seed.shop.catalogAsOf},
          source_note = ${EIRINI_NOTE},
          updated_at = now()
        where id = ${seed.shop.id}
      `;
    }
  }
  const count = await sql<{ n: number }>`select count(*)::int as n from menu_rows where shop_id = ${seed.shop.id}`;
  if ((count[0]?.n ?? 0) > 0) return;
  const params: unknown[] = [];
  const tuples = seed.rows.map((row) => {
    const base = params.length;
    params.push(
      row.id,
      seed.shop.id,
      row.sortIndex,
      row.categoryEl,
      row.categoryEn,
      row.nameEl,
      row.nameEn,
      row.descriptionEl,
      row.descriptionEn,
      row.price,
      row.priceNoteEl,
      row.priceNoteEn,
      row.available,
      row.mediaUrl,
      row.mediaKind,
      row.sourceCode,
      row.hasOptions,
      row.catalogTextEl,
    );
    const ph = Array.from({ length: 18 }, (_, i) => `$${base + i + 1}`).join(", ");
    return `(${ph})`;
  });
  await sql.query(
    `insert into menu_rows (
      id, shop_id, sort_index, category_el, category_en, name_el, name_en,
      description_el, description_en, price, price_note_el, price_note_en,
      available, media_url, media_kind, source_code, has_options, catalog_text_el
    ) values ${tuples.join(",")}`,
    params,
  );
}

async function ensureTrends(): Promise<void> {
  const sql = await getSql();
  const s = trends.shop;
  const found = await sql<{ id: string }>`select id from shops where id = ${s.id}`;
  if (found.length === 0) {
    await sql`
      insert into shops (
        id, slug, name_el, name_en, trade_el, trade_en, address, city, postal,
        neighborhood, country, lat, lng, rating, rating_count, cuisines_el, cuisines_en,
        hours, hours_el, min_order, delivery_fee, eta_min, is_open, pickup, pay_card,
        pay_cash, own_delivery, cover_url, logo_url, efood_id, efood_url, catalog_as_of,
        facts_as_of, source_note, audience, user_id
      ) values (
        ${s.id}, ${s.slug}, ${s.nameEl}, ${s.nameEn}, ${s.tradeEl}, ${s.tradeEn},
        ${s.address}, ${s.city}, ${s.postal}, ${s.neighborhood}, ${s.country},
        ${s.lat}, ${s.lng}, ${s.rating}, ${s.ratingCount}, ${s.cuisinesEl}, ${s.cuisinesEn},
        ${s.hours}, ${s.hoursEl}, ${s.minOrder}, ${s.deliveryFee}, ${s.etaMin}, ${s.isOpen},
        ${s.pickup}, ${s.payCard}, ${s.payCash}, ${s.ownDelivery}, ${s.coverUrl}, ${s.logoUrl},
        ${s.efoodId}, ${s.efoodUrl}, ${s.catalogAsOf}, ${s.factsAsOf}, ${TRENDS_NOTE},
        ${"members"}, ${""}
      )
    `;
  } else {
    const stamp = await sql<{ catalog_as_of: string }>`select catalog_as_of from shops where id = ${s.id}`;
    if (String(stamp[0]?.catalog_as_of ?? "") !== s.catalogAsOf) {
      await sql`delete from menu_rows where shop_id = ${s.id}`;
      await sql`
        update shops set
          catalog_as_of = ${s.catalogAsOf},
          source_note = ${TRENDS_NOTE},
          audience = 'members',
          updated_at = now()
        where id = ${s.id}
      `;
    }
  }
  const count = await sql<{ n: number }>`select count(*)::int as n from menu_rows where shop_id = ${s.id}`;
  if ((count[0]?.n ?? 0) > 0) return;
  const params: unknown[] = [];
  const tuples = trends.rows.map((row) => {
    const base = params.length;
    params.push(
      row.id,
      s.id,
      row.sortIndex,
      row.categoryEl,
      row.categoryEn,
      row.nameEl,
      row.nameEn,
      row.descriptionEl,
      row.descriptionEn,
      row.price,
      row.priceNoteEl,
      row.priceNoteEn,
      row.available,
      row.mediaUrl,
      row.mediaKind,
      row.sourceCode,
      row.hasOptions,
      row.catalogTextEl,
      row.observedOn ?? "",
      row.sourceUrl ?? "",
      row.prevPrice ?? null,
    );
    const ph = Array.from({ length: 21 }, (_, i) => `$${base + i + 1}`).join(", ");
    return `(${ph})`;
  });
  await sql.query(
    `insert into menu_rows (
      id, shop_id, sort_index, category_el, category_en, name_el, name_en,
      description_el, description_en, price, price_note_el, price_note_en,
      available, media_url, media_kind, source_code, has_options, catalog_text_el,
      observed_on, source_url, prev_price
    ) values ${tuples.join(",")}`,
    params,
  );
}

function readable(audience: Shop["audience"], userId: string, access: Access): boolean {
  if (audience === "members") return true;
  if (audience === "owner") return access.owner;
  return userId === access.userId;
}

function writable(audience: Shop["audience"], userId: string, access: Access): boolean {
  if (audience === "self") return userId === access.userId;
  return access.owner;
}

export async function readBoard(slug: string, access: Access): Promise<Board> {
  await ensureSeed();
  await ensureTrends();
  const sql = await getSql();
  const links = await sql<Record<string, unknown>>`
    select s.slug, s.name_el, s.name_en, s.city, s.audience, s.user_id, count(m.id)::int as item_count
    from shops s
    left join menu_rows m on m.shop_id = s.id
    where
      s.audience = 'members'
      or (s.audience = 'owner' and ${access.owner})
      or (s.audience = 'self' and s.user_id = ${access.userId})
    group by s.slug, s.name_el, s.name_en, s.city, s.audience, s.user_id, s.updated_at
    order by s.updated_at asc
  `;
  const shops: ShopLink[] = links.map((r) => ({
    slug: String(r.slug),
    nameEl: String(r.name_el ?? ""),
    nameEn: String(r.name_en ?? ""),
    city: String(r.city ?? ""),
    itemCount: num(r.item_count) ?? 0,
  }));
  const role = access.owner ? "owner" : "member";
  const shopRows = await sql<Record<string, unknown>>`select * from shops where slug = ${slug}`;
  if (shopRows.length === 0) return { shop: null, rows: [], shops, signedIn: true, role, canEdit: false };
  const shop = mapShop(shopRows[0]);
  if (!readable(shop.audience, shop.userId, access)) {
    return { shop: null, rows: [], shops, signedIn: true, role, canEdit: false };
  }
  const rawRows = await sql<Record<string, unknown>>`
    select * from menu_rows where shop_id = ${shop.id} order by sort_index asc, name_el asc
  `;
  return {
    shop,
    rows: rawRows.map(mapRow),
    shops,
    signedIn: true,
    role,
    canEdit: writable(shop.audience, shop.userId, access),
  };
}

export async function readMenuPayload(slug: string, access: Access) {
  const board = await readBoard(slug, access);
  if (!board.shop) return null;
  return {
    engine: "datanet",
    contract: 1,
    shop: board.shop,
    items: board.rows,
  };
}

export async function listMenuIndex(access: Access) {
  const board = await readBoard(access.owner ? "eirini" : "rodos-trends", access);
  return {
    engine: "datanet",
    contract: 1,
    menus: board.shops.map((s) => ({
      slug: s.slug,
      nameEl: s.nameEl,
      nameEn: s.nameEn,
      city: s.city,
      itemCount: s.itemCount,
      href: `/api/menus/${s.slug}`,
    })),
  };
}

function assertMedia(url: string, mediaKind: MediaKind) {
  if (url.startsWith("data:") && url.length > 1_400_000) {
    throw new Error("That file is too large for a cell. Use a photo under 1 MB, or paste a link.");
  }
  if (mediaKind === "none" && url) {
    throw new Error("Choose image or video for a media link.");
  }
}

export async function saveRow(access: Access, draft: RowDraft): Promise<void> {
  assertMedia(draft.mediaUrl, draft.mediaKind);
  const sql = await getSql();
  const owned = await sql<Record<string, unknown>>`
    select s.*, m.price as row_price
    from menu_rows m
    join shops s on s.id = m.shop_id
    where m.id = ${draft.id}
  `;
  if (owned.length === 0) throw new Error("That row is gone.");
  const shop = mapShop(owned[0]);
  if (!writable(shop.audience, shop.userId, access)) throw new Error("This menu is not yours to edit.");
  const price = draft.price == null || Number.isNaN(draft.price) ? null : draft.price;
  const previous = num(owned[0].row_price);
  const moved = previous !== price;
  const day = new Date().toISOString().slice(0, 10);
  await sql`
    update menu_rows set
      category_el = ${draft.categoryEl},
      category_en = ${draft.categoryEn},
      name_el = ${draft.nameEl},
      name_en = ${draft.nameEn},
      description_el = ${draft.descriptionEl},
      description_en = ${draft.descriptionEn},
      price = ${price},
      prev_price = case when ${moved} then ${previous} else prev_price end,
      observed_on = case when ${moved} then ${day} else observed_on end,
      price_note_el = ${draft.priceNoteEl},
      price_note_en = ${draft.priceNoteEn},
      available = ${draft.available},
      media_url = ${draft.mediaUrl},
      media_kind = ${draft.mediaKind},
      updated_at = now()
    where id = ${draft.id} and shop_id = ${shop.id}
  `;
}

export async function addRow(access: Access, shopId: string, categoryEl: string, categoryEn: string): Promise<string> {
  const sql = await getSql();
  const found = await sql<Record<string, unknown>>`select * from shops where id = ${shopId}`;
  if (found.length === 0) throw new Error("That menu is gone.");
  const shop = mapShop(found[0]);
  if (!writable(shop.audience, shop.userId, access)) throw new Error("This menu is not yours to edit.");
  const id = `row-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const max = await sql<{ n: number }>`select coalesce(max(sort_index), 0)::int as n from menu_rows where shop_id = ${shopId}`;
  const sort = (max[0]?.n ?? 0) + 1;
  await sql`
    insert into menu_rows (
      id, shop_id, sort_index, category_el, category_en, name_el, name_en,
      description_el, description_en, price_note_el, price_note_en, available, media_kind
    ) values (
      ${id}, ${shopId}, ${sort}, ${categoryEl}, ${categoryEn}, ${""}, ${""},
      ${""}, ${""}, ${"Σταθερή τιμή καταλόγου."}, ${"Fixed catalog price."}, ${true}, ${"none"}
    )
  `;
  return id;
}

export async function removeRow(access: Access, id: string): Promise<void> {
  const sql = await getSql();
  const owned = await sql<Record<string, unknown>>`
    select s.* from menu_rows m join shops s on s.id = m.shop_id where m.id = ${id}
  `;
  if (owned.length === 0) return;
  const shop = mapShop(owned[0]);
  if (!writable(shop.audience, shop.userId, access)) throw new Error("This menu is not yours to edit.");
  await sql`delete from menu_rows where id = ${id} and shop_id = ${shop.id}`;
}

export async function applyLiveFacts(access: Access, input: {
  efoodId: number;
  rating: number | null;
  ratingCount: number | null;
  cuisinesEl: string;
  hours: string;
  hoursEl: string;
  minOrder: number | null;
  deliveryFee: number | null;
  etaMin: number | null;
  isOpen: boolean;
  pickup: boolean;
  payCard: boolean;
  payCash: boolean;
  ownDelivery: boolean;
  address: string;
  city: string;
  postal: string;
  lat: number | null;
  lng: number | null;
}): Promise<void> {
  const sql = await getSql();
  const day = new Date().toISOString().slice(0, 10);
  const targets = await sql<{ id: string; audience: string; user_id: string }>`
    select id, audience, user_id from shops where efood_id = ${input.efoodId}
  `;
  const ids = targets
    .filter((row) => writable(row.audience === "owner" || row.audience === "members" ? row.audience : "self", row.user_id, access))
    .map((row) => row.id);
  if (ids.length === 0) throw new Error("That shop is not yours to refresh.");
  for (const id of ids) {
    await sql`
      update shops set
        rating = ${input.rating},
        rating_count = ${input.ratingCount},
        cuisines_el = ${input.cuisinesEl},
        hours = ${input.hours},
        hours_el = ${input.hoursEl},
        min_order = ${input.minOrder},
        delivery_fee = ${input.deliveryFee},
        eta_min = ${input.etaMin},
        is_open = ${input.isOpen},
        pickup = ${input.pickup},
        pay_card = ${input.payCard},
        pay_cash = ${input.payCash},
        own_delivery = ${input.ownDelivery},
        address = ${input.address},
        city = ${input.city},
        postal = ${input.postal},
        lat = ${input.lat},
        lng = ${input.lng},
        facts_as_of = ${day},
        updated_at = now()
      where id = ${id}
    `;
  }
}

export async function openListingSheet(access: Access, input: {
  efoodId: number;
  title: string;
  street: string;
  area: string;
  zip: string;
  lat: number | null;
  lng: number | null;
  rating: number | null;
  ratingCount: number | null;
  cuisines: string;
  isOpen: boolean;
  minOrder: number | null;
  deliveryFee: number | null;
  etaMin: number | null;
  hours: string;
  hoursEl: string;
  slugHint: string;
  pickup: boolean;
  payCard: boolean;
  payCash: boolean;
  ownDelivery: boolean;
  logo: string;
  cover: string;
  efoodUrl: string;
}): Promise<string> {
  if (input.efoodId === seed.shop.efoodId) {
    if (!access.owner) throw new Error("Eirini is the owner's private menu.");
    return seed.shop.slug;
  }
  const sql = await getSql();
  const existing = await sql<{ slug: string }>`
    select slug from shops
    where efood_id = ${input.efoodId} and audience = 'self' and user_id = ${access.userId}
  `;
  if (existing[0]?.slug) return existing[0].slug;
  const base =
    input.slugHint
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 48) || `shop-${input.efoodId}`;
  let slug = base;
  for (let i = 2; i < 20; i++) {
    const taken = await sql<{ slug: string }>`select slug from shops where slug = ${slug}`;
    if (taken.length === 0) break;
    slug = `${base}-${i}`;
  }
  const id = `shop-${input.efoodId}-${access.userId.replace(/[^a-z0-9]/gi, "").slice(0, 12) || "me"}`;
  const day = new Date().toISOString().slice(0, 10);
  await sql`
    insert into shops (
      id, slug, name_el, name_en, trade_el, trade_en, address, city, postal,
      country, lat, lng, rating, rating_count, cuisines_el, hours, hours_el,
      min_order, delivery_fee, eta_min, is_open, pickup, pay_card, pay_cash,
      own_delivery, cover_url, logo_url, efood_id, efood_url, facts_as_of, source_note,
      audience, user_id
    ) values (
      ${id}, ${slug}, ${input.title}, ${input.title}, ${""}, ${""},
      ${input.street}, ${input.area || "Ρόδος"}, ${input.zip}, ${"Greece"},
      ${input.lat}, ${input.lng}, ${input.rating}, ${input.ratingCount}, ${input.cuisines},
      ${input.hours}, ${input.hoursEl}, ${input.minOrder}, ${input.deliveryFee}, ${input.etaMin},
      ${input.isOpen}, ${input.pickup}, ${input.payCard}, ${input.payCash}, ${input.ownDelivery},
      ${input.cover}, ${input.logo}, ${input.efoodId}, ${input.efoodUrl}, ${day},
      ${"Opened from the public efood shop list. The live item catalog requires an efood login, so this sheet starts empty."},
      ${"self"}, ${access.userId}
    )
  `;
  return slug;
}

export async function copyMenu(access: Access, slug: string): Promise<string> {
  const board = await readBoard(slug, access);
  if (!board.shop) throw new Error("That menu is not on your account.");
  const sql = await getSql();
  const stamp = Date.now().toString(36);
  let nextSlug = `my-${stamp}`;
  const id = `shop-copy-${stamp}`;
  const day = new Date().toISOString().slice(0, 10);
  const source = board.shop;
  await sql`
    insert into shops (
      id, slug, name_el, name_en, trade_el, trade_en, address, city, postal,
      neighborhood, country, lat, lng, rating, rating_count, cuisines_el, cuisines_en,
      hours, hours_el, min_order, delivery_fee, eta_min, is_open, pickup, pay_card,
      pay_cash, own_delivery, cover_url, logo_url, efood_id, efood_url, catalog_as_of,
      facts_as_of, source_note, audience, user_id
    ) values (
      ${id}, ${nextSlug}, ${`Αντίγραφο · ${source.nameEl}`}, ${`Copy · ${source.nameEn}`},
      ${source.tradeEl}, ${source.tradeEn}, ${source.address}, ${source.city}, ${source.postal},
      ${source.neighborhood}, ${source.country}, ${source.lat}, ${source.lng}, ${source.rating},
      ${source.ratingCount}, ${source.cuisinesEl}, ${source.cuisinesEn}, ${source.hours}, ${source.hoursEl},
      ${source.minOrder}, ${source.deliveryFee}, ${source.etaMin}, ${source.isOpen}, ${source.pickup},
      ${source.payCard}, ${source.payCash}, ${source.ownDelivery}, ${source.coverUrl}, ${source.logoUrl},
      ${null}, ${""}, ${day}, ${day},
      ${`Copied from ${source.nameEn} on ${day}. Edits stay on your account.`},
      ${"self"}, ${access.userId}
    )
  `;
  if (board.rows.length > 0) {
    const params: unknown[] = [];
    const tuples = board.rows.map((row, index) => {
      const base = params.length;
      params.push(
        `copy-${stamp}-${index + 1}`,
        id,
        row.sortIndex,
        row.categoryEl,
        row.categoryEn,
        row.nameEl,
        row.nameEn,
        row.descriptionEl,
        row.descriptionEn,
        row.price,
        row.priceNoteEl,
        row.priceNoteEn,
        row.available,
        row.mediaUrl,
        row.mediaKind,
        row.sourceCode,
        row.hasOptions,
        row.catalogTextEl,
        row.prevPrice,
        row.observedOn,
        row.sourceUrl,
      );
      const ph = Array.from({ length: 21 }, (_, i) => `$${base + i + 1}`).join(", ");
      return `(${ph})`;
    });
    await sql.query(
      `insert into menu_rows (
        id, shop_id, sort_index, category_el, category_en, name_el, name_en,
        description_el, description_en, price, price_note_el, price_note_en,
        available, media_url, media_kind, source_code, has_options, catalog_text_el,
        prev_price, observed_on, source_url
      ) values ${tuples.join(",")}`,
      params,
    );
  }
  return nextSlug;
}
