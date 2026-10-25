import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { accessFor } from "@/lib/datanet/access.server";
import { listingById, searchListings } from "@/lib/datanet/efood.server";
import {
  addRow,
  applyLiveFacts,
  copyMenu,
  openListingSheet,
  readBoard,
  removeRow,
  saveRow,
} from "@/lib/datanet/store.server";
import type { RowDraft } from "@/lib/datanet/types";
import { authMiddleware } from "@/lib/auth/middleware";

const draftSchema = z.object({
  id: z.string().min(1).max(80),
  categoryEl: z.string().max(240),
  categoryEn: z.string().max(240),
  nameEl: z.string().max(240),
  nameEn: z.string().max(240),
  descriptionEl: z.string().max(2000),
  descriptionEn: z.string().max(2000),
  price: z.number().min(0).max(9999).nullable(),
  priceNoteEl: z.string().max(400),
  priceNoteEn: z.string().max(400),
  available: z.boolean(),
  mediaUrl: z.string().max(1_500_000),
  mediaKind: z.enum(["none", "image", "video"]),
  sourceCode: z.string().max(80),
  hasOptions: z.boolean(),
  catalogTextEl: z.string().max(800),
});

function parse<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Invalid input");
  }
  return parsed.data;
}

export const getBoard = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ slug: z.string().min(1).max(80) }), input))
  .handler(async ({ data, context }) => readBoard(data.slug, await accessFor(context.userId)));

export const saveMenuRow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(draftSchema, input))
  .handler(async ({ data, context }) => {
    await saveRow(await accessFor(context.userId), data as RowDraft);
    return { ok: true as const };
  });

export const createMenuRow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) =>
    parse(
      z.object({
        shopId: z.string().min(1).max(80),
        categoryEl: z.string().max(240),
        categoryEn: z.string().max(240),
      }),
      input,
    ),
  )
  .handler(async ({ data, context }) => {
    const id = await addRow(await accessFor(context.userId), data.shopId, data.categoryEl, data.categoryEn);
    return { id };
  });

export const deleteMenuRow = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ id: z.string().min(1).max(80) }), input))
  .handler(async ({ data, context }) => {
    await removeRow(await accessFor(context.userId), data.id);
    return { ok: true as const };
  });

export const researchEfood = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ query: z.string().min(2).max(80) }), input))
  .handler(async ({ data }) => {
    const hits = await searchListings(data.query);
    return { hits };
  });

export const refreshShopFacts = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ efoodId: z.number().int().positive() }), input))
  .handler(async ({ data, context }) => {
    const hit = await listingById(data.efoodId);
    if (!hit) throw new Error("That shop is not on the public Rhodes list right now.");
    await applyLiveFacts(await accessFor(context.userId), {
      efoodId: hit.efoodId,
      rating: hit.rating,
      ratingCount: hit.ratingCount,
      cuisinesEl: hit.cuisines,
      hours: hit.hours,
      hoursEl: hit.hoursEl,
      minOrder: hit.minOrder,
      deliveryFee: hit.deliveryFee,
      etaMin: hit.etaMin,
      isOpen: hit.isOpen,
      pickup: hit.pickup,
      payCard: hit.payCard,
      payCash: hit.payCash,
      ownDelivery: hit.ownDelivery,
      address: hit.street,
      city: hit.area || "Ρόδος",
      postal: hit.zip,
      lat: hit.lat,
      lng: hit.lng,
    });
    return { ok: true as const, open: hit.isOpen };
  });

const hitSchema = z.object({
  efoodId: z.number().int(),
  title: z.string().max(200),
  street: z.string().max(200),
  area: z.string().max(120),
  zip: z.string().max(20),
  lat: z.number().nullable(),
  lng: z.number().nullable(),
  rating: z.number().nullable(),
  ratingCount: z.number().nullable(),
  cuisines: z.string().max(300),
  basicCuisine: z.string().max(120),
  isOpen: z.boolean(),
  minOrder: z.number().nullable(),
  deliveryFee: z.number().nullable(),
  etaMin: z.number().nullable(),
  hours: z.string().max(400),
  hoursEl: z.string().max(400),
  slugHint: z.string().max(80),
  pickup: z.boolean(),
  payCard: z.boolean(),
  payCash: z.boolean(),
  ownDelivery: z.boolean(),
  logo: z.string().max(500),
  cover: z.string().max(500),
  efoodUrl: z.string().max(300),
});

export const adoptListing = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(hitSchema, input))
  .handler(async ({ data, context }) => {
    const slug = await openListingSheet(await accessFor(context.userId), data);
    return { slug };
  });

export const copySharedMenu = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((input: unknown) => parse(z.object({ slug: z.string().min(1).max(80) }), input))
  .handler(async ({ data, context }) => {
    const slug = await copyMenu(await accessFor(context.userId), data.slug);
    return { slug };
  });
