/**
 * Data access boundary — Supabase-backed catalog reads.
 *
 * Every page and component reads catalog data through these functions. The
 * storefront's public client (anon key, RLS-constrained) is used for all reads.
 * No service-role key is ever used here.
 *
 * Mock user/orders accessors removed in Phase 5 (orders now read from Supabase via RLS).
 */

import { createCatalogClient } from "@/lib/supabase/catalog";
import type {
  Brand,
  Category,
  Product,
  ProductVariant,
  Promotion,
} from "@/types";

// ── Row types (match DB columns; not exported — mapped at the boundary) ──

type ProductRow = {
  id: string;
  fgp_number: string;
  slug: string;
  name: string;
  subtitle: string;
  brand_slug: string;
  category_slug: string;
  subcategory: string | null;
  tagline: string;
  description: string | null;
  story: string | null;
  price: number;
  compare_at: number | null;
  currency: "INR";
  visual_key: Product["visualKey"];
  accent: string;
  availability: Product["availability"];
  stock: number | null;
  rating: number;
  review_count: number;
  shipping: string | null;
  warranty: string | null;
  added_at: string;
  brands: { name: string }[] | null;
  product_images: { url: string; position: number; is_primary: boolean }[];
  product_badges: { badge: string; position: number }[];
  product_variants: {
    variant_id: string; name: string; price_delta: number;
    swatch: string | null; in_stock: boolean; position: number;
  }[] | null;
  product_specs: { label: string; value: string; position: number }[] | null;
  product_highlights: { body: string; position: number }[] | null;
  product_includes: { body: string; position: number }[] | null;
  product_related: { related_slug: string; position: number }[] | null;
};

// ── Mappers (DB row → domain type) ──────────────────────────────────────

function sortByPos<T extends { position: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.position - b.position);
}

function mapProduct(row: ProductRow): Product {
  const images = sortByPos(row.product_images ?? []).map((i) => i.url);
  const badges = sortByPos(row.product_badges ?? []).map((b) => b.badge);
  const variants: ProductVariant[] | undefined = row.product_variants
    ? sortByPos(row.product_variants).map((v) => ({
        id: v.variant_id,
        name: v.name,
        priceDelta: v.price_delta || undefined,
        swatch: v.swatch ?? undefined,
        inStock: v.in_stock,
      }))
    : undefined;
  const specs = row.product_specs
    ? sortByPos(row.product_specs).map((s) => ({ label: s.label, value: s.value }))
    : undefined;
  const highlights = row.product_highlights
    ? sortByPos(row.product_highlights).map((h) => h.body)
    : undefined;
  const includes = row.product_includes
    ? sortByPos(row.product_includes).map((i) => i.body)
    : undefined;
  const related = row.product_related
    ? sortByPos(row.product_related).map((r) => r.related_slug)
    : undefined;
  return {
    id: row.id,
    fgpNumber: row.fgp_number,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    brand: row.brand_slug,
    brandName: row.brands?.[0]?.name,
    category: row.category_slug,
    subcategory: row.subcategory ?? undefined,
    tagline: row.tagline,
    description: row.description ?? undefined,
    story: row.story ?? undefined,
    price: row.price,
    compareAt: row.compare_at ?? undefined,
    currency: row.currency,
    images,
    visualKey: row.visual_key,
    accent: row.accent,
    availability: row.availability,
    stock: row.stock ?? undefined,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    specs,
    highlights,
    variants,
    includes,
    shipping: row.shipping ?? undefined,
    warranty: row.warranty ?? undefined,
    related,
    addedAt: row.added_at,
    badges: badges.length > 0 ? badges : undefined,
  };
}

// Card select: core fields + brand name + primary image + badges (no detail fields)
const CARD_SELECT = `
  id, fgp_number, slug, name, subtitle, brand_slug, category_slug, subcategory, tagline,
  price, compare_at, currency, visual_key, accent, availability, stock,
  rating, review_count, added_at,
  brands!inner(name),
  product_images(url, position, is_primary),
  product_badges(badge, position)
`;

// Detail select: everything (for product pages). The product_related join needs
// an explicit FK hint because the table has two FKs to products (product_slug +
// related_slug).
const DETAIL_SELECT = `
  id, fgp_number, slug, name, subtitle, brand_slug, category_slug, subcategory, tagline,
  description, story, price, compare_at, currency, visual_key, accent, availability, stock,
  rating, review_count, shipping, warranty, added_at,
  brands!inner(name),
  product_images(url, position, is_primary),
  product_badges(badge, position),
  product_variants(variant_id, name, price_delta, swatch, in_stock, position),
  product_specs(label, value, position),
  product_highlights(body, position),
  product_includes(body, position),
  product_related!product_related_product_slug_fkey(related_slug, position)
`;

// ── Circulation ──────────────────────────────────────────────────────
// Reads published circulation entries from Supabase. If a published version
// exists, surfaces use the pre-computed product ordering. If no published
// version exists (e.g. before the processor runs), a deterministic date-based
// rotation ensures different eligible products get exposure over time — no
// product is permanently buried by a fixed list.

type CirculationSurface =
  | "home_trending"
  | "home_new_arrivals"
  | "home_featured"
  | "home_on_sale"
  | "shop_default";

// Fetch product slugs for a surface from the published circulation version.
// Returns [] if no published version or no entries for the surface.
async function getCirculationSlugs(surface: CirculationSurface, limit: number): Promise<string[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("circulation_entries")
    .select("product_slug, position")
    .eq("surface", surface)
    .order("position", { ascending: true })
    .limit(limit);
  if (error || !data || data.length === 0) return [];
  return (data as { product_slug: string }[]).map((r) => r.product_slug);
}

// Deterministic fallback: rotates eligible products by day so different products
// get exposure over time. Uses the current date as a seed — no Math.random.
// This ensures the same page renders the same products within a day (cache-safe)
// while varying across days (fair exposure).
function rotatedSlugs(allSlugs: string[], limit: number, seedOffset = 0): string[] {
  if (allSlugs.length === 0) return [];
  const day = Math.floor(Date.now() / 86400000) + seedOffset;
  const start = (day * 7) % allSlugs.length; // step by 7 each day for variety
  const result: string[] = [];
  for (let i = 0; i < Math.min(limit, allSlugs.length); i++) {
    result.push(allSlugs[(start + i) % allSlugs.length]);
  }
  return result;
}

// Fetch products by slug list, preserving the order of the input slugs.
async function getProductsBySlugOrder(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .in("slug", slugs)
    .eq("is_active", true);
  if (error || !data) return [];
  const rows = data as ProductRow[];
  // Filter out any that became inactive, then preserve input order
  return slugs
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is ProductRow => Boolean(r))
    .map(mapProduct);
}

// Fetch all active product slugs (for fallback rotation).
async function getAllActiveSlugs(): Promise<string[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true);
  if (error || !data) return [];
  return (data as { slug: string }[]).map((r) => r.slug);
}

// ── Products ──────────────────────────────────────────────────────────

export async function getAllProducts(): Promise<Product[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("is_active", true)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data as ProductRow[]).map(mapProduct);
}

export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return mapProduct(data as ProductRow);
}

export async function getProductsByCategory(categorySlug: string): Promise<Product[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("category_slug", categorySlug)
    .eq("is_active", true)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data as ProductRow[]).map(mapProduct);
}

export async function getProductsBySlugs(slugs: string[]): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .in("slug", slugs)
    .eq("is_active", true);
  if (error) throw error;
  const rows = data as ProductRow[];
  // Preserve the order of the input slugs
  return slugs
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is ProductRow => Boolean(r))
    .map(mapProduct);
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  // Prefer published circulation entries for home_featured
  const slugs = await getCirculationSlugs("home_featured", limit);
  if (slugs.length > 0) {
    return getProductsBySlugOrder(slugs);
  }
  // Fallback: deterministic rotation of editor's pick products
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("product_badges")
    .select(`product:products!inner(${CARD_SELECT})`)
    .eq("badge", "Editor's pick")
    .eq("product.is_active", true);
  if (error) throw error;
  const rows = (data ?? []).map((d: { product: ProductRow }) => d.product);
  const allSlugs = rows.map((r) => r.slug);
  const rotated = rotatedSlugs(allSlugs, limit, 3);
  const rotatedRows = rotated
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is ProductRow => Boolean(r));
  return rotatedRows.map(mapProduct);
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  // Prefer published circulation entries for home_new_arrivals
  const slugs = await getCirculationSlugs("home_new_arrivals", limit);
  if (slugs.length > 0) {
    return getProductsBySlugOrder(slugs);
  }
  // Fallback: deterministic rotation of newest products
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("is_active", true)
    .order("added_at", { ascending: false });
  if (error) throw error;
  const rows = data as ProductRow[];
  const allSlugs = rows.map((r) => r.slug);
  const rotated = rotatedSlugs(allSlugs, limit, 1);
  return rotated
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is ProductRow => Boolean(r))
    .map(mapProduct);
}

export async function getOnSaleProducts(limit = 8): Promise<Product[]> {
  // Prefer published circulation entries for home_on_sale
  const slugs = await getCirculationSlugs("home_on_sale", limit);
  if (slugs.length > 0) {
    return getProductsBySlugOrder(slugs);
  }
  // Fallback: deterministic rotation of on-sale products
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("is_active", true)
    .not("compare_at", "is", null);
  if (error) throw error;
  const rows = (data as ProductRow[]).filter((p) => p.compare_at !== null && p.compare_at > p.price);
  const allSlugs = rows.map((r) => r.slug);
  const rotated = rotatedSlugs(allSlugs, limit, 2);
  return rotated
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is ProductRow => Boolean(r))
    .map(mapProduct);
}

export async function getTrendingProducts(limit = 6): Promise<Product[]> {
  // Prefer published circulation entries for home_trending
  const slugs = await getCirculationSlugs("home_trending", limit);
  if (slugs.length > 0) {
    return getProductsBySlugOrder(slugs);
  }
  // Fallback: deterministic rotation of most-reviewed products
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("is_active", true)
    .order("review_count", { ascending: false });
  if (error) throw error;
  const rows = data as ProductRow[];
  const allSlugs = rows.map((r) => r.slug);
  const rotated = rotatedSlugs(allSlugs, limit, 0);
  return rotated
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is ProductRow => Boolean(r))
    .map(mapProduct);
}

export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const relatedSlugs = product.related ?? [];
  if (relatedSlugs.length > 0) {
    const related = await getProductsBySlugs(relatedSlugs);
    if (related.length >= limit) return related.slice(0, limit);
    const seen = new Set(related.map((p) => p.slug));
    seen.add(product.slug);
    const sameCategory = await getProductsByCategory(product.category);
    const fillers = sameCategory.filter((p) => !seen.has(p.slug));
    return [...related, ...fillers].slice(0, limit);
  }
  const sameCategory = await getProductsByCategory(product.category);
  return sameCategory.filter((p) => p.slug !== product.slug).slice(0, limit);
}

// ── Categories ────────────────────────────────────────────────────────

type CategoryRow = {
  slug: string; name: string; tagline: string; description: string;
  intro: string; image: string; accent: string;
  subcategories: string[]; featured: string[]; seo_note: string;
};

function mapCategory(row: CategoryRow): Category {
  return {
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    intro: row.intro,
    image: row.image,
    accent: row.accent,
    subcategories: row.subcategories ?? [],
    featured: row.featured ?? [],
    seoNote: row.seo_note,
  };
}

export async function getAllCategories(): Promise<Category[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase.from("categories").select("*");
  if (error) throw error;
  return (data as CategoryRow[]).map(mapCategory);
}

export async function getCategoryBySlug(slug: string): Promise<Category | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return mapCategory(data as CategoryRow);
}

export async function getCategoryProductCount(slug: string): Promise<number> {
  const supabase = createCatalogClient();
  const { count, error } = await supabase
    .from("products")
    .select("slug", { count: "exact", head: true })
    .eq("category_slug", slug)
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}

// ── Brands ────────────────────────────────────────────────────────────

type BrandRow = { slug: string; name: string; country: string; blurb: string };

function mapBrand(row: BrandRow): Brand {
  return { slug: row.slug, name: row.name, country: row.country, blurb: row.blurb };
}

export async function getAllBrands(): Promise<Brand[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase.from("brands").select("*");
  if (error) throw error;
  return (data as BrandRow[]).map(mapBrand);
}

export async function getBrandBySlug(slug: string): Promise<Brand | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return mapBrand(data as BrandRow);
}

// ── Promotions / Offers ────────────────────────────────────────────────

type OfferRow = {
  id: string; slug: string; title: string; description: string;
  badge: string; terms: string; starts_at: string | null; ends_at: string | null;
  status: string;
  offer_products: { product_slug: string; position: number }[];
};

function mapPromotion(row: OfferRow): Promotion {
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    badge: row.badge,
    productSlugs: sortByPos(row.offer_products ?? []).map((op) => op.product_slug),
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    terms: row.terms,
  };
}

/** Returns active + expired offers (not draft/scheduled). Storefront shows lifecycle states. */
export async function getAllPromotions(): Promise<Promotion[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*, offer_products(product_slug, position)")
    .in("status", ["active", "expired"])
    .order("ends_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as OfferRow[]).map(mapPromotion);
}

export async function getPromotionBySlug(slug: string): Promise<Promotion | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*, offer_products(product_slug, position)")
    .eq("slug", slug)
    .in("status", ["active", "expired"])
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return mapPromotion(data as OfferRow);
}

export async function getPromotionProducts(promo: Promotion): Promise<Product[]> {
  return getProductsBySlugs(promo.productSlugs);
}

/** Checks if an offer is currently within its validity window. */
export function isPromotionActive(promo: Promotion): boolean {
  const now = Date.now();
  if (promo.startsAt && +new Date(promo.startsAt) > now) return false;
  if (promo.endsAt && +new Date(promo.endsAt) < now) return false;
  return true;
}

// ── Reviews ────────────────────────────────────────────────────────────



// ── Store / business info ──────────────────────────────────────────────

export const storeInfo = {
  name: "Fusion Gadgets",
  legalName: "Fusion Gadgets",
  tagline:
    "Your trusted local store for electronics, home appliances, batteries & car accessories in Bahraich, UP.",
  founded: "2024",
  address: {
    line1: "Shop No. 3, K.B. Global Square",
    line2: "Bahraich",
    city: "Bahraich",
    state: "Uttar Pradesh",
    postcode: "271801",
    country: "India",
  },
  phone: "+91 88587 63010",
  whatsapp: "+91 88587 63010",
  email: "contact@fusiongadgets.in",
  supportEmail: "contact@fusiongadgets.in",
  hours: "Mon–Fri 9 AM–8 PM, Sat 10 AM–6 PM, Sun closed",
  gst: "",
  social: {
    instagram: "https://instagram.com/fusiongadgets",
    twitter: "https://twitter.com/fusiongadgets",
    youtube: "https://youtube.com/@fusiongadgets",
  },
  mapEmbed:
    "https://www.openstreetmap.org/export/embed.html?bbox=81.585%2C27.565%2C81.610%2C27.585&layer=mapnik&marker=27.5744%2C81.5989",
} as const;
