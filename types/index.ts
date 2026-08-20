/**
 * Fusion Gadgets — domain types
 *
 * These types describe the shape of the data the storefront works with.
 * They are intentionally framework-agnostic so the mock data layer can be
 * swapped for a real backend (Prisma / REST / GraphQL) without rewriting
 * the UI.
 */

export type Slug = string;

export type Money = number; // stored in major currency units (INR)

export type Category = {
  slug: Slug;
  name: string;
  tagline: string;
  description: string;
  /** Short editorial intro shown above the product grid */
  intro: string;
  /** Hero/representative image */
  image: string;
  /** A secondary accent color used on the category card, in oklch */
  accent: string;
  subcategories: string[];
  /** slugs of products featured for the category */
  featured: Slug[];
  /** SEO copy placed at the bottom of the category page */
  seoNote: string;
};

export type Brand = {
  slug: Slug;
  name: string;
  country: string;
  blurb: string;
};

export type Availability = "in-stock" | "low-stock" | "out-of-stock" | "preorder";

export type ProductSpec = {
  label: string;
  value: string;
};

export type ProductVariant = {
  id: string;
  name: string;
  /** Optional surcharge applied to the base price */
  priceDelta?: Money;
  swatch?: string;
  inStock: boolean;
};

export type Review = {
  id: string;
  productId: string;
  userId: string;
  rating: number; // 1–5
  title: string;
  body: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  // Display-only: the reviewer's name. Reviews require a delivered purchase,
  // so all reviews are "verified purchases" — no stored boolean.
  authorName: string;
};

export type ReviewSummary = {
  average: number; // one decimal place, e.g. 4.6
  count: number;
  distribution: RatingDistribution;
};

export type RatingDistribution = {
  5: number;
  4: number;
  3: number;
  2: number;
  1: number;
};

export type Product = {
  /** Internal relational identity (uuid). Used by reviews. */
  id: string;
  /** Public product identifier (FGPN). DB-generated, never the URL slug. */
  fgpNumber: string;
  /** URL / SEO identifier. Never the relational FK. */
  slug: Slug;
  name: string;
  subtitle: string;
  brand: Slug;
  /** Denormalized brand name for card display (avoids a separate lookup) */
  brandName?: string;
  category: Slug;
  subcategory?: string;
  /** Short marketing line for cards */
  tagline: string;
  /** Full description — only fetched for product detail pages */
  description?: string;
  /** Longer editorial copy shown on the product page */
  story?: string;
  price: Money;
  /** Original price before discount, if on sale */
  compareAt?: Money;
  currency: "INR";
  images: string[];
  /** Visual key used by the procedural ProductVisual fallback */
  visualKey: ProductVisualKey;
  accent: string;
  availability: Availability;
  /** Numeric stock for low-stock messaging */
  stock?: number;
  rating: number;
  reviewCount: number;
  /** Detail-page fields — undefined on card queries to avoid over-fetching */
  specs?: ProductSpec[];
  highlights?: string[];
  variants?: ProductVariant[];
  includes?: string[];
  shipping?: string;
  warranty?: string;
  reviews?: Review[];
  related?: Slug[];
  /** When the product was added, ISO date — used for "new" badges */
  addedAt: string;
  badges?: string[];
};

export type ProductVisualKey =
  | "headphones"
  | "earbuds"
  | "speaker"
  | "keyboard"
  | "mouse"
  | "watch"
  | "camera"
  | "lens"
  | "drone"
  | "charger"
  | "cable"
  | "stand"
  | "lamp"
  | "backpack"
  | "controller"
  | "mic"
  | "monitor"
  | "tracker";

export type Promotion = {
  slug: Slug;
  title: string;
  description: string;
  badge: string;
  /** slugs of products included */
  productSlugs: Slug[];
  startsAt?: string;
  endsAt?: string;
  terms: string;
};

export type Address = {
  id: string;
  label: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postcode: string;
  country: string;
  phone: string;
  isDefault?: boolean;
};

export type OrderItem = {
  slug: Slug;
  name: string;
  image: string;
  visualKey: ProductVisualKey;
  accent: string;
  variant?: string;
  quantity: number;
  unitPrice: Money;
};

export type OrderStatus =
  | "processing"
  | "confirmed"
  | "shipped"
  | "out-for-delivery"
  | "delivered"
  | "cancelled"
  | "returned";

export type Order = {
  id: string;
  date: string; // ISO
  status: OrderStatus;
  items: OrderItem[];
  subtotal: Money;
  discount: Money;
  shipping: Money;
  tax: Money;
  total: Money;
  address: Address;
  paymentMethod: string;
  trackingNumber?: string;
  estimatedDelivery?: string;
  timeline: { label: string; date: string; done: boolean }[];
};

export type User = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  avatar?: string;
  memberSince: string;
  addresses: Address[];
  preferences: {
    newsletter: boolean;
    productUpdates: boolean;
    orderUpdates: boolean;
  };
};
