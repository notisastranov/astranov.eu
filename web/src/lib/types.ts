/** Shared SpaceNet + Architect domain types for the astranov.eu hub MVP. */

export type ZoomLevel = "galaxy" | "global" | "national" | "city" | "plot";

export interface GeoPoint {
  lat: number;
  lon: number;
}

export interface Plot {
  id: string;
  ownerId: string | null;
  name: string;
  /** Closed ring WGS84 vertices (lon/lat). */
  ring: GeoPoint[];
  centroid: GeoPoint;
  areaM2: number | null;
  /** Rhodes / Hellenic cadastre hooks (stub). */
  ktimaRef: string | null;
  nationCode: string;
  citySlug: string | null;
  createdAt: string;
}

export interface Offer {
  id: string;
  vendorId: string;
  title: string;
  priceAve: number;
  plotId: string | null;
  status: "open" | "accepted" | "delivered" | "cancelled";
  createdAt: string;
}

export interface CreditTransaction {
  id: string;
  userId: string;
  /** AV€ = EUR 1:1. Signed: credit positive, debit negative. */
  amountAve: number;
  kind: "deposit" | "spend" | "refund" | "node_serve" | "adjust";
  memo: string;
  balanceAfter: number | null;
  createdAt: string;
}

export interface UserPost {
  id: string;
  authorId: string;
  body: string;
  plotId: string | null;
  lat: number | null;
  lon: number | null;
  createdAt: string;
}

export interface PresencePeer {
  userId: string;
  displayName: string;
  lat: number;
  lon: number;
  level: ZoomLevel;
  updatedAt: string;
}

export type MenuPanel =
  | "news"
  | "profile"
  | "plots"
  | "credits"
  | "settings"
  | "help"
  | null;
