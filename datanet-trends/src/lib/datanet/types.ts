export type MediaKind = "none" | "image" | "video";

export type Shop = {
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
  lat: number | null;
  lng: number | null;
  rating: number | null;
  ratingCount: number | null;
  cuisinesEl: string;
  cuisinesEn: string;
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
  coverUrl: string;
  logoUrl: string;
  efoodId: number | null;
  efoodUrl: string;
  catalogAsOf: string;
  factsAsOf: string;
  sourceNote: string;
  audience: "owner" | "members" | "self";
  userId: string;
};

export type ShopLink = {
  slug: string;
  nameEl: string;
  nameEn: string;
  city: string;
  itemCount: number;
};

export type MenuRow = {
  id: string;
  shopId: string;
  sortIndex: number;
  categoryEl: string;
  categoryEn: string;
  nameEl: string;
  nameEn: string;
  descriptionEl: string;
  descriptionEn: string;
  price: number | null;
  priceNoteEl: string;
  priceNoteEn: string;
  available: boolean;
  mediaUrl: string;
  mediaKind: MediaKind;
  sourceCode: string;
  hasOptions: boolean;
  catalogTextEl: string;
  prevPrice: number | null;
  observedOn: string;
  sourceUrl: string;
};

export type Board = {
  shop: Shop | null;
  rows: MenuRow[];
  shops: ShopLink[];
  signedIn: boolean;
  role: "guest" | "member" | "owner";
  canEdit: boolean;
};

export type ListingHit = {
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
  basicCuisine: string;
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
};

export type RowDraft = Omit<MenuRow, "shopId" | "sortIndex">;
