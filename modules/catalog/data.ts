/**
 * Data access boundary — Supabase-backed catalog reads.
 *
 * Products are independent rows. Optional grouping via product_variations
 * identifies selectable alternatives on the product-detail page.
 */

import { createCatalogClient } from "@/lib/supabase/catalog";
import type {
  Brand,
  Category,
  Product,
  ProductVariation,
  Promotion,
  VariationItem,
} from "@/types";
import { deriveAvailability } from "@/types";

// ── Row types ─────────────────────────────────────────────────────────

type VariationItemRow = {
  id: string;
  variation_id: string;
  product_id: string;
  option_label: string;
  position: number;
  products: {
    id: string;
    slug: string;
    name: string;
    stock: number;
    is_active: boolean;
    is_preorder: boolean;
    product_images: { url: string; position: number; is_primary: boolean }[];
  }[] | null;
};

type CardRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  subtitle: string;
  subcategory: string | null;
  tagline: string;
  price: number;
  compare_at_price: number | null;
  currency: "INR";
  visual_key: Product["visualKey"];
  accent: string;
  is_preorder: boolean;
  stock: number;
  is_active: boolean;
  rating: number;
  review_count: number;
  added_at: string;
  brands: { slug: string; name: string }[] | null;
  categories: { slug: string }[] | null;
  product_images: { url: string; position: number; is_primary: boolean }[];
  product_variation_items: VariationItemRow[] | null;
};

type FullProductRow = CardRow & {
  description: string | null;
  story: string | null;
  shipping: string | null;
  warranty: string | null;
  highlights: string[];
  includes: string[];
  specs: { label: string; value: string }[];
};

// ── Mappers ───────────────────────────────────────────────────────────

function mapVariationItem(row: VariationItemRow): VariationItem {
  const product = row.products?.[0] ?? null;
  const images = [...(product?.product_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.url);

  return {
    productId: row.product_id,
    slug: product?.slug ?? "",
    label: row.option_label,
    position: row.position,
    primaryImage: images[0],
    inStock: product
      ? (product.is_preorder || product.stock > 0) && product.is_active
      : false,
  };
}

function mapVariation(items: VariationItemRow[]): ProductVariation | undefined {
  if (items.length < 2) return undefined;
  const sorted = [...items].sort((a, b) => a.position - b.position);
  return {
    id: sorted[0].variation_id,
    items: sorted.map(mapVariationItem),
  };
}

function mapProduct(row: CardRow | FullProductRow): Product {
  const images = [...(row.product_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.url);

  const variationItems = row.product_variation_items ?? [];
  const variation = mapVariation(variationItems);

  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    brand: row.brands?.[0]?.slug ?? "",
    brandName: row.brands?.[0]?.name,
    category: row.categories?.[0]?.slug ?? "",
    subcategory: row.subcategory ?? undefined,
    tagline: row.tagline,
    description:
      "description" in row
        ? (row as FullProductRow).description ?? undefined
        : undefined,
    story:
      "story" in row ? (row as FullProductRow).story ?? undefined : undefined,
    price: row.price,
    compareAt: row.compare_at_price ?? undefined,
    currency: row.currency,
    images,
    visualKey: row.visual_key,
    accent: row.accent,
    availability: deriveAvailability(row.stock, row.is_preorder, row.is_active),
    stock: row.stock,
    isPreorder: row.is_preorder,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    specs:
      "specs" in row
        ? (row as FullProductRow).specs?.length
          ? (row as FullProductRow).specs
          : undefined
        : undefined,
    highlights:
      "highlights" in row
        ? (row as FullProductRow).highlights?.length
          ? (row as FullProductRow).highlights
          : undefined
        : undefined,
    variation,
    includes:
      "includes" in row
        ? (row as FullProductRow).includes?.length
          ? (row as FullProductRow).includes
          : undefined
        : undefined,
    shipping:
      "shipping" in row
        ? (row as FullProductRow).shipping ?? undefined
        : undefined,
    warranty:
      "warranty" in row
        ? (row as FullProductRow).warranty ?? undefined
        : undefined,
    addedAt: row.added_at,
  };
}

// ── Select strings ─────────────────────────────────────────────────────

const VARIATION_ITEM_FIELDS = `
  product_variation_items(
    id, variation_id, product_id, option_label, position,
    products!product_variation_items_product_id_fkey(
      id, slug, name, stock, is_active, is_preorder,
      product_images(url, position, is_primary)
    )
  )
`;

const CARD_SELECT = `
  id, sku, slug, name, subtitle, subcategory, tagline,
  price, compare_at_price, currency, visual_key, accent,
  is_preorder, stock, is_active,
  rating, review_count, added_at,
  brands!inner(slug, name),
  categories!inner(slug),
  product_images(url, position, is_primary),
  ${VARIATION_ITEM_FIELDS}
`;

const DETAIL_SELECT = `
  id, sku, slug, name, subtitle, subcategory, tagline,
  description, story, price, compare_at_price, currency, visual_key, accent,
  is_preorder, stock, is_active,
  rating, review_count, shipping, warranty, added_at,
  highlights, includes, specs,
  brands!inner(slug, name),
  categories!inner(slug),
  product_images(url, position, is_primary),
  ${VARIATION_ITEM_FIELDS}
`;

// ── Circulation ──────────────────────────────────────────────────────

type CirculationSurface =
  | "home_trending"
  | "home_new_arrivals"
  | "home_featured"
  | "home_on_sale"
  | "shop_default";

async function getCirculationIds(
  surface: CirculationSurface,
  limit: number
): Promise<string[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("circulation_entries")
    .select("product_id, position")
    .eq("surface", surface)
    .order("position", { ascending: true })
    .limit(limit);
  if (error || !data || data.length === 0) return [];
  return (data as { product_id: string }[]).map((r) => r.product_id);
}

function rotatedSlugs(
  allSlugs: string[],
  limit: number,
  seedOffset = 0
): string[] {
  if (allSlugs.length === 0) return [];
  const day = Math.floor(Date.now() / 86400000) + seedOffset;
  const start = (day * 7) % allSlugs.length;
  const result: string[] = [];
  for (let i = 0; i < Math.min(limit, allSlugs.length); i++) {
    result.push(allSlugs[(start + i) % allSlugs.length]);
  }
  return result;
}

async function getProductsByIdOrder(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .in("id", ids)
    .eq("is_active", true);
  if (error || !data) return [];
  const rows = data as CardRow[];
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is CardRow => Boolean(r))
    .map(mapProduct);
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
  return (data as CardRow[]).map(mapProduct);
}

export async function getProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;

  const product = mapProduct(data as FullProductRow);

  const { data: membership } = await supabase
    .from("product_variation_items")
    .select("variation_id")
    .eq("product_id", product.id)
    .maybeSingle();

  if (!membership) return product;

  const { data: allItems } = await supabase
    .from("product_variation_items")
    .select(
      "variation_id, product_id, option_label, position, products!product_variation_items_product_id_fkey(slug, stock, is_active, is_preorder, product_images(url, position, is_primary))"
    )
    .eq("variation_id", membership.variation_id)
    .order("position", { ascending: true });

  if (!allItems || allItems.length < 2) return product;

  type RawItem = {
    product_id: string;
    option_label: string;
    position: number;
    products: Record<string, unknown> | Record<string, unknown>[] | null;
  };

  product.variation = {
    id: membership.variation_id,
    items: (allItems as RawItem[]).map((item) => {
      const p = Array.isArray(item.products)
        ? (item.products[0] as Record<string, unknown> | undefined) ?? null
        : (item.products as Record<string, unknown> | null);
      const images = [...((p?.product_images as { url: string; position: number }[]) ?? [])]
        .sort((a, b) => a.position - b.position)
        .map((i) => i.url);
      return {
        productId: item.product_id,
        slug: (p?.slug as string) ?? "",
        label: item.option_label,
        position: item.position,
        primaryImage: images[0],
        inStock: p
          ? ((p.is_preorder as boolean) || (p.stock as number) > 0) && (p.is_active as boolean)
          : false,
      };
    }),
  };

  return product;
}

export async function getProductById(
  id: string
): Promise<Product | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_SELECT)
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return mapProduct(data as FullProductRow);
}

export async function getProductsByCategory(
  categorySlug: string
): Promise<Product[]> {
  const supabase = createCatalogClient();
  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", categorySlug)
    .maybeSingle();
  if (!cat) return [];
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("category_id", cat.id)
    .eq("is_active", true)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return (data as CardRow[]).map(mapProduct);
}

export async function getProductsBySlugs(
  slugs: string[]
): Promise<Product[]> {
  if (slugs.length === 0) return [];
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .in("slug", slugs)
    .eq("is_active", true);
  if (error) throw error;
  const rows = data as CardRow[];
  return slugs
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is CardRow => Boolean(r))
    .map(mapProduct);
}

export async function getProductsByIds(
  ids: string[]
): Promise<Product[]> {
  if (ids.length === 0) return [];
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(DETAIL_SELECT)
    .in("id", ids)
    .eq("is_active", true);
  if (error) throw error;
  const rows = data as FullProductRow[];
  return ids
    .map((id) => rows.find((r) => r.id === id))
    .filter((r): r is FullProductRow => Boolean(r))
    .map(mapProduct);
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const ids = await getCirculationIds("home_featured", limit);
  if (ids.length > 0) return getProductsByIdOrder(ids);
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("is_active", true)
    .order("rating", { ascending: false })
    .limit(limit * 2);
  if (error) throw error;
  const rows = data as CardRow[];
  const allSlugs = rows.map((r) => r.slug);
  return rotatedSlugs(allSlugs, limit, 3)
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is CardRow => Boolean(r))
    .map(mapProduct);
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  const ids = await getCirculationIds("home_new_arrivals", limit);
  if (ids.length > 0) return getProductsByIdOrder(ids);
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("is_active", true)
    .order("added_at", { ascending: false });
  if (error) throw error;
  const rows = data as CardRow[];
  const allSlugs = rows.map((r) => r.slug);
  return rotatedSlugs(allSlugs, limit, 1)
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is CardRow => Boolean(r))
    .map(mapProduct);
}

export async function getOnSaleProducts(limit = 8): Promise<Product[]> {
  const ids = await getCirculationIds("home_on_sale", limit);
  if (ids.length > 0) return getProductsByIdOrder(ids);
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("is_active", true)
    .not("compare_at_price", "is", null);
  if (error) throw error;
  const rows = (data as CardRow[]).filter(
    (p) => p.compare_at_price !== null && p.compare_at_price > p.price
  );
  const allSlugs = rows.map((r) => r.slug);
  return rotatedSlugs(allSlugs, limit, 2)
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is CardRow => Boolean(r))
    .map(mapProduct);
}

export async function getTrendingProducts(limit = 6): Promise<Product[]> {
  const ids = await getCirculationIds("home_trending", limit);
  if (ids.length > 0) return getProductsByIdOrder(ids);
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("is_active", true)
    .order("review_count", { ascending: false });
  if (error) throw error;
  const rows = data as CardRow[];
  const allSlugs = rows.map((r) => r.slug);
  return rotatedSlugs(allSlugs, limit, 0)
    .map((s) => rows.find((r) => r.slug === s))
    .filter((r): r is CardRow => Boolean(r))
    .map(mapProduct);
}

export async function getRelatedProducts(
  product: Product,
  limit = 4
): Promise<Product[]> {
  const supabase = createCatalogClient();
  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", product.category)
    .maybeSingle();
  if (!cat) return [];

  const { data: variationRows } = await supabase
    .from("product_variation_items")
    .select("variation_id")
    .eq("product_id", product.id);

  let siblingIds = new Set<string>();
  if (variationRows && variationRows.length > 0) {
    const variationId = variationRows[0].variation_id;
    const { data: siblings } = await supabase
      .from("product_variation_items")
      .select("product_id")
      .eq("variation_id", variationId);
    siblingIds = new Set((siblings ?? []).map((s: { product_id: string }) => s.product_id));
  }

  const { data, error } = await supabase
    .from("products")
    .select(CARD_SELECT)
    .eq("category_id", cat.id)
    .eq("is_active", true)
    .gt("stock", 0)
    .neq("id", product.id);
  if (error) return [];

  const rows = (data as CardRow[]).filter((r) => !siblingIds.has(r.id));

  const sameSubcat = rows.filter((r) => r.subcategory === product.subcategory);
  const others = rows.filter((r) => r.subcategory !== product.subcategory);
  return [...sameSubcat, ...others].slice(0, limit).map(mapProduct);
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

export async function getCategoryBySlug(
  slug: string
): Promise<Category | undefined> {
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
  const { data: cat } = await supabase
    .from("categories")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (!cat) return 0;
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", cat.id)
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

export async function getBrandBySlug(
  slug: string
): Promise<Brand | undefined> {
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
  offer_products: {
    product_id: string;
    position: number;
    product: { slug: string } | null;
  }[];
};

function mapPromotion(row: OfferRow): Promotion {
  const productSlugs = [...(row.offer_products ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((op) => op.product?.slug ?? "")
    .filter(Boolean);
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    badge: row.badge,
    productSlugs,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    terms: row.terms,
  };
}

export async function getAllPromotions(): Promise<Promotion[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*, offer_products(product_id, position, product:products!fk_offer_products_product_id(slug))")
    .in("status", ["active", "expired"])
    .order("ends_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return (data as OfferRow[]).map(mapPromotion);
}

export async function getPromotionBySlug(
  slug: string
): Promise<Promotion | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("offers")
    .select("*, offer_products(product_id, position, product:products!fk_offer_products_product_id(slug))")
    .eq("slug", slug)
    .in("status", ["active", "expired"])
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;
  return mapPromotion(data as OfferRow);
}

export async function getPromotionProducts(
  promo: Promotion
): Promise<Product[]> {
  return getProductsBySlugs(promo.productSlugs);
}

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
