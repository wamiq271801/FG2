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
  /** Internal relational identity (uuid). */
  id: string;
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

/**
 * Live stock snapshot for one product — the ONLY source of availability
 * truth at render time. Cached catalog scopes exclude stock entirely;
 * pages merge a live `getStocks()` overlay (server) and the PDP refreshes
 * once more after hydration via `useStock` / GET /api/stock.
 */
export type StockInfo = {
  stock: number;
  isActive: boolean;
  isPreorder: boolean;
  availability: Availability;
};

/**
 * Derive the display availability state from authoritative product fields.
 * This is computed client-side from the data returned by the DB — no
 * availability_enum column exists anymore.
 *
 * Low-stock threshold: <= 5 units.
 */
export function deriveAvailability(
  stock: number,
  isPreorder: boolean,
  isActive: boolean
): Availability {
  if (!isActive) return "out-of-stock";
  if (isPreorder) return "preorder";
  if (stock === 0) return "out-of-stock";
  if (stock <= 5) return "low-stock";
  return "in-stock";
}

/**
 * One specifications row from the products.specs JSONB column.
 * `key` is the spec's own identity field — written by the product import
 * (normalizeSpecs) and verified unique within each product's specs array.
 * It is the stable React element identity for spec rows.
 */
export type ProductSpec = {
  key: string;
  value: string;
};

export type VariationItem = {
  /** The actual product UUID for this variation item */
  productId: string;
  /** URL slug for normal navigation */
  slug: string;
  /** Generic option label (e.g. "Graphite", "12/256", "Pro") */
  label: string;
  /** Display position within the variation */
  position: number;
  /** The primary/first image URL for this product */
  primaryImage?: string;
  /** Whether this item's product is currently in stock */
  inStock: boolean;
};

export type ProductVariation = {
  /** Variation ID — groups selectable alternative products */
  id: string;
  /** The variation items (>= 2 valid products) */
  items: VariationItem[];
};

export type Review = {
  id: string;
  productId: string;
  /**
   * Present only on owner-scoped reads (the authenticated edit flow).
   * Public review data (published_reviews view) carries no user
   * identity, so public reviews have no userId.
   */
  userId?: string;
  rating: number; // 1–5
  title: string;
  body: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  // Display-only: the reviewer's name (customer_name snapshot at
  // submission time). Reviews require a delivered purchase, so all
  // reviews are "verified purchases" — no stored boolean.
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
  /** SKU — unique product identifier. DB-generated, never the URL slug. */
  sku: string;
  /** URL / SEO identifier. Never the relational FK. */
  slug: Slug;
  name: string;
  subtitle: string;
  brand: Slug;
  /** Denormalized brand name for card display (avoids a separate lookup) */
  brandName?: string;
  /** Denormalized brand country — detail queries only (PDP brand line) */
  brandCountry?: string;
  category: Slug;
  /** Internal category identity (uuid) — used for ID-based relationships */
  categoryId?: string;
  /** Denormalized category name (breadcrumb / JSON-LD on detail pages) */
  categoryName?: string;
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
  /**
   * Derived availability — computed from isActive + isPreorder + stock.
   * UNSET on cached catalog data (stock never enters a shared cache); set
   * by the live stock overlay at render time (server) or by `useStock`
   * (client, after hydration).
   */
  availability?: Availability;
  /**
   * Numeric stock value (>= 0). UNSET on cached catalog data — volatile
   * stock is read live (getStocks / GET /api/stock) and never cached.
   */
  stock?: number;
  /** True if this product is a preorder item (stock may be 0 but purchasable). */
  isPreorder: boolean;
  rating: number;
  reviewCount: number;
  /** Detail-page fields — undefined on card queries to avoid over-fetching */
  specs?: ProductSpec[];
  highlights?: string[];
  includes?: string[];
  shipping?: string;
  warranty?: string;
  reviews?: Review[];
  /** When the product was added, ISO date — used for "new" display logic */
  addedAt: string;
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
  /** Product ids included — relationships are product_id-based */
  productIds: string[];
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
  /** Product UUID — the sellable product. */
  productId?: string;
  name: string;
  visualKey: ProductVisualKey;
  accent: string;
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

export type OrderEvent = {
  id: string;
  eventType: string;
  createdAt: string; // ISO
  metadata?: Record<string, unknown>;
};

export type Order = {
  id: string;
  /** Human-facing order number (FG-YYYYMMDD-NNNNNN). Present from Phase 7 onwards. */
  orderNumber?: string;
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
  /** Immutable event history from order_events. */
  events: OrderEvent[];
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
