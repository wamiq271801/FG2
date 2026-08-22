/**
 * Reusable product query primitives (server-side).
 *
 * Every relationship runs through products.id. Slug appears only as route
 * input (getProductBySlug) or as a returned URL property.
 *
 * Variation membership is intentionally a two-step lookup
 * (product_variation_items → variation_id → all items → product ids) and is
 * consumed only by the product-detail page. No other surface loads it.
 */

import { createCatalogClient } from "@/lib/supabase/catalog";
import type { Product, ProductVariation, VariationItem } from "@/types";
import {
  PRODUCT_CARD_SELECT,
  PRODUCT_DETAIL_SELECT,
  asRows,
  asSingle,
  mapProductRow,
  type ProductRow,
  type FullProductRow,
  type VariationItemRow,
} from "./types";

// ── Core reads ────────────────────────────────────────────────────────

export async function getAllProducts(): Promise<Product[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("is_active", true)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return asRows<ProductRow>(data).map(mapProductRow);
}

/** Route-level resolution: the only place a slug identifies a product. */
export async function getProductBySlug(
  slug: string
): Promise<Product | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  const row = asSingle<FullProductRow>(data);
  return row ? mapProductRow(row) : undefined;
}

/** Detail-shaped products by internal identity, returned in request order. */
export async function getProductsByIds(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT)
    .in("id", ids)
    .eq("is_active", true);
  if (error) throw error;
  const byId = new Map(asRows<FullProductRow>(data).map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is FullProductRow => Boolean(r))
    .map(mapProductRow);
}

/** Active products of a category, resolved by internal identity. */
export async function getProductsByCategoryId(
  categoryId: string
): Promise<Product[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return asRows<ProductRow>(data).map(mapProductRow);
}

// ── Circulation-backed sections ───────────────────────────────────────
//
// Reads circulation_entries positions first (ranking-owned ordering); falls
// back to deterministic editorial rotation only when a surface has no
// published entries. Ranking behaviour itself is untouched here.

type CirculationSurface =
  | "home_trending"
  | "home_new_arrivals"
  | "home_featured"
  | "home_on_sale";

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
  if (error) {
    // The ranking infrastructure publishes surfaces independently; a missing
    // circulation_entries table means no ranking is published yet — an
    // expected deployment state handled by the editorial fallback below.
    // Any other failure is surfaced.
    if (error.code === "PGRST205") return [];
    throw error;
  }
  if (!data || data.length === 0) return [];
  return asRows<{ product_id: string }>(data).map((r) => r.product_id);
}

function rotatedSlugs(
  keys: string[],
  limit: number,
  seedOffset = 0
): string[] {
  if (keys.length === 0) return [];
  const day = Math.floor(Date.now() / 86400000) + seedOffset;
  const start = (day * 7) % keys.length;
  const result: string[] = [];
  for (let i = 0; i < Math.min(limit, keys.length); i++) {
    result.push(keys[(start + i) % keys.length]);
  }
  return result;
}

async function getProductsByIdOrder(ids: string[]): Promise<Product[]> {
  if (ids.length === 0) return [];
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .in("id", ids)
    .eq("is_active", true);
  if (error) throw error;
  const byId = new Map(asRows<ProductRow>(data).map((r) => [r.id, r]));
  return ids
    .map((id) => byId.get(id))
    .filter((r): r is ProductRow => Boolean(r))
    .map(mapProductRow);
}

function pickRotated(rows: ProductRow[], limit: number, seed: number): Product[] {
  return rotatedSlugs(
    rows.map((r) => r.slug),
    limit,
    seed
  )
    .map((key) => rows.find((r) => r.slug === key))
    .filter((r): r is ProductRow => Boolean(r))
    .map(mapProductRow);
}

export async function getFeaturedProducts(limit = 8): Promise<Product[]> {
  const ids = await getCirculationIds("home_featured", limit);
  if (ids.length > 0) return getProductsByIdOrder(ids);
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("is_active", true)
    .order("rating", { ascending: false })
    .limit(limit * 2);
  if (error) throw error;
  return pickRotated(asRows<ProductRow>(data), limit, 3);
}

export async function getNewArrivals(limit = 8): Promise<Product[]> {
  const ids = await getCirculationIds("home_new_arrivals", limit);
  if (ids.length > 0) return getProductsByIdOrder(ids);
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("is_active", true)
    .order("added_at", { ascending: false });
  if (error) throw error;
  return pickRotated(asRows<ProductRow>(data), limit, 1);
}

export async function getOnSaleProducts(limit = 8): Promise<Product[]> {
  const ids = await getCirculationIds("home_on_sale", limit);
  if (ids.length > 0) return getProductsByIdOrder(ids);
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("is_active", true)
    .not("compare_at_price", "is", null);
  if (error) throw error;
  const rows = asRows<ProductRow>(data).filter(
    (p) => p.compare_at_price !== null && p.compare_at_price > p.price
  );
  return pickRotated(rows, limit, 2);
}

export async function getTrendingProducts(limit = 6): Promise<Product[]> {
  const ids = await getCirculationIds("home_trending", limit);
  if (ids.length > 0) return getProductsByIdOrder(ids);
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("is_active", true)
    .order("review_count", { ascending: false });
  if (error) throw error;
  return pickRotated(asRows<ProductRow>(data), limit, 0);
}

// ── Related products ──────────────────────────────────────────────────

/**
 * Algorithmic recommendations scoped to the product's category. Selectable
 * alternatives of the current product are excluded here so variation
 * internals never leak into the UI.
 */
export async function getRelatedProducts(
  product: Product,
  limit = 4
): Promise<Product[]> {
  const supabase = createCatalogClient();

  let categoryId = product.categoryId;
  if (!categoryId && product.category) {
    const { data: cat, error: catError } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", product.category)
      .maybeSingle();
    if (catError) throw catError;
    categoryId = cat?.id;
  }
  if (!categoryId) return [];

  const excluded = new Set<string>([product.id]);
  const { data: membership, error: membershipError } = await supabase
    .from("product_variation_items")
    .select("variation_id")
    .eq("product_id", product.id)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (membership) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("product_variation_items")
      .select("product_id")
      .eq("variation_id", membership.variation_id);
    if (siblingsError) throw siblingsError;
    for (const s of siblings ?? []) excluded.add(s.product_id);
  }

  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("category_id", categoryId)
    .eq("is_active", true)
    .gt("stock", 0);
  if (error) throw error;

  const rows = asRows<ProductRow>(data).filter((r) => !excluded.has(r.id));
  const sameSubcat = rows.filter((r) => r.subcategory === product.subcategory);
  const others = rows.filter((r) => r.subcategory !== product.subcategory);
  return [...sameSubcat, ...others].slice(0, limit).map(mapProductRow);
}

// ── Variation membership (product-detail only) ────────────────────────

function mapVariationItemRow(row: VariationItemRow): VariationItem {
  const product = row.products;
  const primaryImage = [...(product?.product_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.url)[0];
  return {
    productId: row.product_id,
    slug: product?.slug ?? "",
    label: row.option_label,
    position: row.position,
    primaryImage,
    inStock: product
      ? (product.is_preorder || product.stock > 0) && product.is_active
      : false,
  };
}

/**
 * Resolve the selectable alternatives of a product:
 *   product.id → variation membership → variation_id → all items
 *
 * Returns undefined when the product has no membership or fewer than two
 * valid items — such products simply render without a selector.
 */
export async function getProductVariation(
  productId: string
): Promise<ProductVariation | undefined> {
  const supabase = createCatalogClient();

  const { data: membership, error: membershipError } = await supabase
    .from("product_variation_items")
    .select("variation_id")
    .eq("product_id", productId)
    .limit(1)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) return undefined;

  const { data, error } = await supabase
    .from("product_variation_items")
    .select(
      `id, variation_id, product_id, option_label, position,
       products!product_variation_items_product_id_fkey(
         id, slug, name, price, compare_at_price, currency,
         stock, is_active, is_preorder,
         product_images(url, position, is_primary)
       )`
    )
    .eq("variation_id", membership.variation_id)
    .order("position", { ascending: true });
  if (error) throw error;

  const rows = asRows<VariationItemRow>(data);
  if (rows.length < 2) return undefined;

  return {
    id: membership.variation_id,
    items: rows.map(mapVariationItemRow),
  };
}
