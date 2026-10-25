import type { ListingHit } from "@/lib/datanet/types";

const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36";

const RHODES = { lat: 36.4412, lng: 28.2225 };

type RawShop = {
  id?: number;
  title?: string;
  average_rating?: number;
  num_ratings?: number;
  minimum_order?: number;
  delivery_cost?: number;
  delivery_eta?: number;
  is_open?: boolean;
  has_pickup?: boolean;
  has_credit?: boolean;
  has_cash_on_delivery?: boolean;
  has_own_delivery?: boolean;
  basic_cuisine?: string;
  cuisines?: string[];
  slug?: string;
  logo?: string;
  cover?: string;
  address?: {
    street?: string;
    zip?: string;
    longitude?: number;
    latitude?: number;
    area?: { name?: string };
  };
  timetable?: { day?: string; times?: string }[];
};

let cache: { at: number; rows: RawShop[] } | null = null;

function fold(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

function hoursOf(rows: RawShop["timetable"]): { en: string; el: string } {
  const list = rows ?? [];
  if (list.length === 0) return { en: "", el: "" };
  const times = [...new Set(list.map((d) => d.times || ""))];
  if (times.length === 1 && times[0]) {
    const span = times[0].replace("-", "–");
    return { en: `Every day ${span}`, el: `Κάθε μέρα ${span}` };
  }
  const enDays: Record<string, string> = {
    monday: "Mon",
    tuesday: "Tue",
    wednesday: "Wed",
    thursday: "Thu",
    friday: "Fri",
    saturday: "Sat",
    sunday: "Sun",
  };
  const elDays: Record<string, string> = {
    monday: "Δευ",
    tuesday: "Τρι",
    wednesday: "Τετ",
    thursday: "Πεμ",
    friday: "Παρ",
    saturday: "Σαβ",
    sunday: "Κυρ",
  };
  const en = list.map((d) => `${enDays[d.day ?? ""] ?? d.day} ${d.times ?? ""}`).join(", ");
  const el = list.map((d) => `${elDays[d.day ?? ""] ?? d.day} ${d.times ?? ""}`).join(", ");
  return { en, el };
}

function toHit(shop: RawShop): ListingHit {
  const hours = hoursOf(shop.timetable);
  const slug = (shop.slug ?? "").split("/").filter(Boolean).pop() ?? "";
  return {
    efoodId: shop.id ?? 0,
    title: shop.title ?? "",
    street: shop.address?.street ?? "",
    area: shop.address?.area?.name ?? "",
    zip: shop.address?.zip ?? "",
    lat: shop.address?.latitude ?? null,
    lng: shop.address?.longitude ?? null,
    rating: shop.average_rating ?? null,
    ratingCount: shop.num_ratings ?? null,
    cuisines: (shop.cuisines ?? []).join(", "),
    basicCuisine: shop.basic_cuisine ?? "",
    isOpen: Boolean(shop.is_open),
    minOrder: shop.minimum_order ?? null,
    deliveryFee: shop.delivery_cost ?? null,
    etaMin: shop.delivery_eta ?? null,
    hours: hours.en,
    hoursEl: hours.el,
    slugHint: slug,
    pickup: Boolean(shop.has_pickup),
    payCard: Boolean(shop.has_credit),
    payCash: Boolean(shop.has_cash_on_delivery),
    ownDelivery: Boolean(shop.has_own_delivery),
    logo: shop.logo ?? "",
    cover: shop.cover ?? "",
    efoodUrl: shop.slug ? `https://www.e-food.gr/delivery${shop.slug.startsWith("/") ? shop.slug : `/${shop.slug}`}` : "",
  };
}

async function loadRhodes(): Promise<RawShop[]> {
  if (cache && Date.now() - cache.at < 5 * 60 * 1000) return cache.rows;
  const url = new URL("https://api.e-food.gr/api/v1/restaurants/");
  url.searchParams.set("latitude", String(RHODES.lat));
  url.searchParams.set("longitude", String(RHODES.lng));
  url.searchParams.set("mode", "filter");
  url.searchParams.set("version", "3");
  url.searchParams.set("filters", "{}");
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": UA },
  });
  if (!res.ok) throw new Error("efood did not answer the shop list.");
  const body = (await res.json()) as { status?: string; data?: { restaurants?: RawShop[] } };
  if (body.status !== "ok" || !body.data?.restaurants) {
    throw new Error("efood returned an unexpected shop list.");
  }
  cache = { at: Date.now(), rows: body.data.restaurants };
  return cache.rows;
}

export async function searchListings(query: string): Promise<ListingHit[]> {
  const q = fold(query.trim());
  if (q.length < 2) throw new Error("Type at least two letters.");
  const rows = await loadRhodes();
  return rows
    .filter((shop) => {
      const hay = fold(
        `${shop.title ?? ""} ${shop.address?.street ?? ""} ${shop.slug ?? ""} ${(shop.cuisines ?? []).join(" ")} ${shop.basic_cuisine ?? ""}`,
      );
      return hay.includes(q);
    })
    .slice(0, 16)
    .map(toHit);
}

export async function listingById(efoodId: number): Promise<ListingHit | null> {
  const rows = await loadRhodes();
  const shop = rows.find((row) => row.id === efoodId);
  return shop ? toHit(shop) : null;
}
