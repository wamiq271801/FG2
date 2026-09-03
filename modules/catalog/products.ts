/**
 * Reusable product query primitives (server-side).
 *
 * Phase 2 cache architecture: every shared, reusable dataset is a
 * `'use cache'` scope tagged for explicit invalidation (see
 * docs/phase-2-architecture.md — "Cache boundaries"). Cached scopes NEVER
 * select stock (volatile availability is read live per request and merged
 * by the caller via modules/catalog/stock.ts).
 *
 * Per-request (live, never cached) primitives in this module:
 *   getAllProductSlugs (build-time param generation), getProductsByIds,
 *   getProductsByIdsCard, getRelatedProducts (cached dataset + live
 *   variation-membership + live stock), getProductVariation.
 *
 * Every relationship runs through products.id. Slug appears only as route
 * input (getProductBySlug) or as a returned URL property.
 *
 * Variation membership is intentionally a two-step lookup
 * (product_variation_items → variation_id → all items → product ids) and is
 * consumed only by the product-detail page. No other surface loads it.
 */

import { cache } from "react";
import { cacheLife, cacheTag } from "next/cache";
import { createCatalogClient } from "@/lib/supabase/catalog";
import { getStocks } from "./stock";
import type { Product, ProductVariation, VariationItem } from "@/types";
import {
  PRODUCT_CARD_SELECT,
  PRODUCT_CARD_SELECT_NOSTOCK,
  PRODUCT_DETAIL_SELECT,
  PRODUCT_DETAIL_SELECT_NOSTOCK,
  asRows,
  asSingle,
  mapProductRow,
  type ProductRow,
  type CachedProductRow,
  type FullProductRow,
  type VariationItemRow,
} from "./types";

// ── Cached scopes ─────────────────────────────────────────────────────

/**
 * THE product card dataset: every active, resolvable product as a
 * card-shaped Product (sans stock). One scope feeds the shop grid, the
 * category grids, the home feed surfaces and the category product counts.
 *
 * Tags: `products` plus `category:{id}` for every distinct category
 * present — so both the whole-dataset and per-category events drop it.
 */
export async function getAllProductCards(): Promise<Product[]> {
  "use cache";
  cacheLife("indefinite");

  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT_NOSTOCK)
    .eq("is_active", true)
    .order("added_at", { ascending: false });
  if (error) throw error;
  const rows = asRows<CachedProductRow>(data).map(mapProductRow);

  const categoryIds = [
    ...new Set(rows.map((p) => p.categoryId).filter((id): id is string => Boolean(id))),
  ];
  cacheTag("products", ...categoryIds.map((id) => `category:${id}`));
  return rows;
}

/**
 * Route-level resolution: the only place a slug identifies a product.
 * The shared product-detail cache scope (sans stock).
 *
 * Tags on a hit: `product:{id}` + `category:{categoryId}` (a category
 * update of its category drops this entry). Tags on a miss:
 * `product-slug:{slug}` (a product later taking this slug drops the
 * negative entry).
 *
 * A missing/inactive product resolves to undefined so the (uncached) page
 * can call notFound() — notFound() itself must not run inside the cached
 * scope.
 */
export async function getProductBySlug(
  slug: string
): Promise<Product | undefined> {
  "use cache";
  cacheLife("indefinite");

  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_DETAIL_SELECT_NOSTOCK)
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw error;
  const row = asSingle<CachedProductRow & Partial<FullProductRow>>(data);
  if (!row) {
    cacheTag(`product-slug:${slug}`);
    return undefined;
  }
  const product = mapProductRow(row);
  if (product.categoryId) cacheTag(`category:${product.categoryId}`);
  cacheTag(`product:${row.id}`);
  return product;
}

// ── Feed (circulation) scope ──────────────────────────────────────────

/** Public feed surface names (mapped to circulation_entries surfaces). */
export type FeedSurface = "trending" | "new-arrivals" | "featured" | "on-sale";

const CIRCULATION_SURFACE: Record<FeedSurface, string> = {
  trending: "home_trending",
  "new-arrivals": "home_new_arrivals",
  featured: "home_featured",
  "on-sale": "home_on_sale",
};

/** Editorial rotation seed per surface (same offsets as the pre-Phase 2 fallbacks). */
const FEED_SEED: Record<FeedSurface, number> = {
  trending: 0,
  "new-arrivals": 1,
  "on-sale": 2,
  featured: 3,
};

async function getCirculationIds(
  surface: string,
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
    if (error.code === "PGRST205") return [];
    throw error;
  }
  if (!data || data.length === 0) return [];
  return asRows<{ product_id: string }>(data).map((r) => r.product_id);
}

/**
 * Day-based editorial rotation over an ordered id list (identical
 * algorithm to the previous slug-keyed rotation). Runs INSIDE the cached
 * feed scope, so the rotation is baked at cache-fill time — the explicit
 * trade-off of the no-TTL model (see "Documented limitations" in
 * docs/phase-2-architecture.md).
 */
function rotatedIds(keys: string[], limit: number, seedOffset = 0): string[] {
  if (keys.length === 0) return [];
  const day = Math.floor(Date.now() / 86400000) + seedOffset;
  const start = (day * 7) % keys.length;
  const result: string[] = [];
  for (let i = 0; i < Math.min(limit, keys.length); i++) {
    result.push(keys[(start + i) % keys.length]);
  }
  return result;
}

/**
 * Editorial fallback id lists — the product-selection queries the feed
 * scope performs ITSELF (never through the product-card dataset), so
 * product events can never leak into `feed:home`.
 */
async function feedFallbackIds(
  surface: FeedSurface,
  limit: number
): Promise<string[]> {
  const supabase = createCatalogClient();
  switch (surface) {
    case "trending": {
      const { data, error } = await supabase
        .from("products")
        .select("id")
        .eq("is_active", true)
        .order("review_count", { ascending: false });
      if (error) throw error;
      return rotatedIds(
        asRows<{ id: string }>(data).map((r) => r.id),
        limit,
        FEED_SEED.trending
      );
    }
    case "new-arrivals": {
      const { data, error } = await supabase
        .from("products")
        .select("id")
        .eq("is_active", true)
        .order("added_at", { ascending: false });
      if (error) throw error;
      return rotatedIds(
        asRows<{ id: string }>(data).map((r) => r.id),
        limit,
        FEED_SEED["new-arrivals"]
      );
    }
    case "featured": {
      const { data, error } = await supabase
        .from("products")
        .select("id")
        .eq("is_active", true)
        .order("rating", { ascending: false })
        .limit(limit * 2);
      if (error) throw error;
      return rotatedIds(
        asRows<{ id: string }>(data).map((r) => r.id),
        limit,
        FEED_SEED.featured
      );
    }
    case "on-sale": {
      const { data, error } = await supabase
        .from("products")
        .select("id, price, compare_at_price")
        .eq("is_active", true)
        .not("compare_at_price", "is", null);
      if (error) throw error;
      const rows = asRows<{
        id: string;
        price: number;
        compare_at_price: number | null;
      }>(data).filter(
        (p) => p.compare_at_price !== null && p.compare_at_price > p.price
      );
      return rotatedIds(
        rows.map((r) => r.id),
        limit,
        FEED_SEED["on-sale"]
      );
    }
  }
}

/**
 * The home-feed cache scope: ordered product IDs ONLY.
 *
 * Feed independence: the ONLY tag is `feed:home`. Product/category events
 * never resolve this tag, so an editorial (circulation) or fallback
 * selection is stable across catalog changes. The PRODUCTS rendered for
 * these ids come from getAllProductCards and update independently.
 */
export async function getFeedSurfaceIds(
  surface: FeedSurface,
  limit: number
): Promise<string[]> {
  "use cache";
  cacheLife("indefinite");
  cacheTag("feed:home");

  const ids = await getCirculationIds(CIRCULATION_SURFACE[surface], limit);
  if (ids.length > 0) return ids;
  return feedFallbackIds(surface, limit);
}

/**
 * Per-request assembly: feed ids resolved against the cached card dataset.
 * Callers merge the live stock overlay before rendering cards.
 */
export async function resolveFeedProducts(
  surface: FeedSurface,
  limit: number
): Promise<Product[]> {
  const [ids, dataset] = await Promise.all([
    getFeedSurfaceIds(surface, limit),
    getAllProductCards(),
  ]);
  const byId = new Map(dataset.map((p) => [p.id, p]));
  return ids
    .map((id) => byId.get(id))
    .filter((p): p is Product => Boolean(p));
}

// ── Live (per-request) primitives ─────────────────────────────────────

/**
 * Slugs of every product whose page can render — active, with a resolvable
 * brand AND category (the same inner-join eligibility the detail select and
 * the product sitemap use. FK constraints guarantee non-null ids resolve).
 * Consumed by the product route's generateStaticParams (build time — never
 * cached).
 */
export async function getAllProductSlugs(): Promise<string[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug")
    .eq("is_active", true)
    .not("brand_id", "is", null)
    .not("category_id", "is", null);
  if (error) throw error;
  return asRows<{ slug: string }>(data).map((r) => r.slug);
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

/**
 * Card-shaped products by internal identity, returned in request order — a
 * LIVE per-request read (includes stock). Same resolution semantics as
 * getProductsByIds (active rows only, missing ids dropped, caller's order
 * preserved) on PRODUCT_CARD_SELECT.
 */
export async function getProductsByIdsCard(ids: string[]): Promise<Product[]> {
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

// ── Related products (live assembly) ─────────────────────────────────

/**
 * A product's variation membership (variation_id or undefined) — live,
 * memoized per request.
 */
const getVariationMembership = cache(
  async (productId: string): Promise<string | undefined> => {
    const supabase = createCatalogClient();
    const { data, error } = await supabase
      .from("product_variation_items")
      .select("variation_id")
      .eq("product_id", productId)
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return data?.variation_id;
  }
);

/**
 * Algorithmic recommendations scoped to the product's category, assembled
 * live per request from the cached card dataset + a live
 * variation-membership read + a live stock overlay. Selectable
 * alternatives of the current product are excluded so variation internals
 * never leak into the UI.
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

  // Live variation membership → excluded sibling ids.
  const excluded = new Set<string>([product.id]);
  const membershipVariationId = await getVariationMembership(product.id);
  if (membershipVariationId) {
    const { data: siblings, error: siblingsError } = await supabase
      .from("product_variation_items")
      .select("product_id")
      .eq("variation_id", membershipVariationId);
    if (siblingsError) throw siblingsError;
    for (const s of siblings ?? []) excluded.add(s.product_id);
  }

  // Cached card dataset (sans stock) filtered to this category.
  const dataset = await getAllProductCards();
  const rows = dataset.filter(
    (p) => p.categoryId === categoryId && !excluded.has(p.id)
  );

  // Live stock overlay — the previous DB-level `.gt("stock", 0)` filter.
  const stocks = await getStocks(rows.map((p) => p.id));
  const inStock = rows.filter((p) => {
    const info = stocks.get(p.id);
    return info ? info.stock > 0 : false;
  });

  const sameSubcat = inStock.filter((p) => p.subcategory === product.subcategory);
  const others = inStock.filter((p) => p.subcategory !== product.subcategory);
  return [...sameSubcat, ...others].slice(0, limit);
}

// ── Sitemap projections (raw reads; routes wrap them in cached scopes) ──

export type ProductSitemapRow = {
  slug: string;
  updated_at: string;
  product_images: { url: string; position: number }[] | null;
};

/** Count of products eligible for the sitemap (count-only query). */
export async function getProductSitemapCount(): Promise<number> {
  const supabase = createCatalogClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("is_active", true)
    .not("brand_id", "is", null)
    .not("category_id", "is", null);
  if (error) throw error;
  return count ?? 0;
}

/**
 * One deterministic batch of sitemap-eligible products.
 *
 * Ordering is the immutable primary key (uuid) — stable across queries,
 * so batch membership cannot shift between requests; `.range()` is always
 * paired with this ORDER BY. Only the requested batch's rows are fetched.
 */
export async function getProductSitemapBatch(
  batch: number,
  batchSize: number
): Promise<ProductSitemapRow[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select("slug, updated_at, product_images(url, position)")
    .eq("is_active", true)
    .not("brand_id", "is", null)
    .not("category_id", "is", null)
    .order("id", { ascending: true })
    .range(batch * batchSize, batch * batchSize + batchSize - 1);
  if (error) throw error;
  return asRows<ProductSitemapRow>(data);
}

// ── Variation membership (product-detail only, live) ──────────────────

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
 * A LIVE per-request read (includes stock) — variation membership never
 * enters a shared cache. Returns undefined when the product has no
 * membership or fewer than two valid items — such products simply render
 * without a selector.
 */
export const getProductVariation = cache(
  async (productId: string): Promise<ProductVariation | undefined> => {
    const supabase = createCatalogClient();

    const variationId = await getVariationMembership(productId);
    if (!variationId) return undefined;

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
      .eq("variation_id", variationId)
      .order("position", { ascending: true });
    if (error) throw error;

    const rows = asRows<VariationItemRow>(data);
    if (rows.length < 2) return undefined;

    return {
      id: variationId,
      items: rows.map(mapVariationItemRow),
    };
  }
);
