/**
 * Catalog DB-result layer — product row shapes, select fragments and pure
 * mappers shared by the server query primitives (products.ts) and the
 * browser fetchers (client.ts, useProducts.ts).
 *
 * Identity rules:
 *   products.id   → internal relational identity for every relationship
 *   products.slug → URL/route value only
 *   products.sku  → business identifier only
 *
 * Product queries never embed variation data. Variation membership is a
 * product-detail concern resolved separately against product_variation_items.
 */

import type { Product } from "@/types";
import { deriveAvailability } from "@/types";

// ── Rows ──────────────────────────────────────────────────────────────

export type ProductImageRow = {
  url: string;
  position: number;
  is_primary: boolean;
};

/**
 * Card-level product row — lists, grids, cards. Live (per-request) queries
 * select this shape INCLUDING stock; cached scopes use the sans-stock
 * variant below (volatile stock never enters a shared cache).
 */
export type ProductRow = {
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
  brands: { slug: string; name: string; country?: string } | null;
  categories: { id: string; slug: string; name?: string } | null;
  product_images: ProductImageRow[] | null;
};

/**
 * Card-level row WITHOUT stock — the row shape every cached select uses.
 * Mapped products carry stock/availability as undefined until a live
 * stock overlay (getStocks) or useStock fills them in.
 */
export type CachedProductRow = Omit<ProductRow, "stock">;

/**
 * Detail-level row without stock — cached product-detail scope shape.
 */
export type CachedFullProductRow = Omit<FullProductRow, "stock">;

/** Detail rows add the editorial/content fields. */
export type FullProductRow = ProductRow & {
  description: string | null;
  story: string | null;
  shipping: string | null;
  warranty: string | null;
  highlights: string[];
  includes: string[];
  /** products.specs JSONB rows — actual wire shape is { key, value }. */
  specs: { key: string; value: string }[];
};

/**
 * product_variation_items row joined to its selectable product via the
 * explicit product_id FK (product_variation_items_product_id_fkey).
 */
export type VariationItemRow = {
  id: string;
  variation_id: string;
  product_id: string;
  option_label: string;
  position: number;
  products: {
    id: string;
    slug: string;
    name: string;
    price: number;
    compare_at_price: number | null;
    currency: "INR";
    stock: number;
    is_active: boolean;
    is_preorder: boolean;
    product_images: ProductImageRow[];
  } | null;
};

// ── Selects ───────────────────────────────────────────────────────────

/** Live card select — includes stock (never used inside a cached scope). */
export const PRODUCT_CARD_SELECT = `
  id, sku, slug, name, subtitle, subcategory, tagline,
  price, compare_at_price, currency, visual_key, accent,
  is_preorder, stock, is_active,
  rating, review_count, added_at,
  brands!inner(slug, name),
  categories!inner(id, slug),
  product_images(url, position, is_primary)
`;

/** Live detail select — includes stock (never used inside a cached scope). */
export const PRODUCT_DETAIL_SELECT = `
  id, sku, slug, name, subtitle, subcategory, tagline,
  description, story, price, compare_at_price, currency, visual_key, accent,
  is_preorder, stock, is_active,
  rating, review_count, shipping, warranty, added_at,
  highlights, includes, specs,
  brands!inner(slug, name, country),
  categories!inner(id, slug, name),
  product_images(url, position, is_primary)
`;

/**
 * Cached card select — PRODUCT_CARD_SELECT minus `stock`. The Phase 2
 * stock architecture: availability is never part of shared cache entries;
 * it is re-derived per request from a live stock read.
 */
export const PRODUCT_CARD_SELECT_NOSTOCK = `
  id, sku, slug, name, subtitle, subcategory, tagline,
  price, compare_at_price, currency, visual_key, accent,
  is_preorder, is_active,
  rating, review_count, added_at,
  brands!inner(slug, name),
  categories!inner(id, slug),
  product_images(url, position, is_primary)
`;

/** Cached detail select — PRODUCT_DETAIL_SELECT minus `stock`. */
export const PRODUCT_DETAIL_SELECT_NOSTOCK = `
  id, sku, slug, name, subtitle, subcategory, tagline,
  description, story, price, compare_at_price, currency, visual_key, accent,
  is_preorder, is_active,
  rating, review_count, shipping, warranty, added_at,
  highlights, includes, specs,
  brands!inner(slug, name, country),
  categories!inner(id, slug, name),
  product_images(url, position, is_primary)
`;

// ── Mappers ───────────────────────────────────────────────────────────

/**
 * Cast supabase-js results to their real PostgREST wire shape: many-to-one
 * embeds (brands, categories) come back as objects, one-to-many embeds
 * (product_images) as arrays — verified against the live API. Without a
 * generated Database schema, supabase-js conservatively infers every embed
 * as an array, so direct casts fail typecheck. Failures still throw.
 */
export function asRows<T>(data: unknown): T[] {
  return (data ?? []) as T[];
}

export function asSingle<T>(data: unknown): T | undefined {
  return (data ?? undefined) as T | undefined;
}

function sortedImageUrls(images: ProductImageRow[] | null): string[] {
  return [...(images ?? [])].sort((a, b) => a.position - b.position).map((i) => i.url);
}

/**
 * Map a card- or detail-shaped product row to the domain Product.
 *
 * Accepts both live rows (with `stock` — availability derived here) and
 * cached rows (sans stock — availability/stock map to undefined and are
 * filled in later by the live stock overlay / useStock).
 */
export function mapProductRow(row: ProductRow | CachedProductRow): Product {
  const full = row as Partial<FullProductRow>;
  return {
    id: row.id,
    sku: row.sku,
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    brand: row.brands?.slug ?? "",
    brandName: row.brands?.name,
    brandCountry: row.brands?.country,
    category: row.categories?.slug ?? "",
    categoryId: row.categories?.id,
    categoryName: row.categories?.name,
    subcategory: row.subcategory ?? undefined,
    tagline: row.tagline,
    description: full.description ?? undefined,
    story: full.story ?? undefined,
    price: row.price,
    compareAt: row.compare_at_price ?? undefined,
    currency: row.currency,
    images: sortedImageUrls(row.product_images),
    visualKey: row.visual_key,
    accent: row.accent,
    availability:
      "stock" in row && row.stock !== undefined
        ? deriveAvailability(row.stock, row.is_preorder, row.is_active)
        : undefined,
    stock: "stock" in row ? row.stock : undefined,
    isPreorder: row.is_preorder,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    specs: full.specs?.length ? full.specs : undefined,
    highlights: full.highlights?.length ? full.highlights : undefined,
    includes: full.includes?.length ? full.includes : undefined,
    shipping: full.shipping ?? undefined,
    warranty: full.warranty ?? undefined,
    addedAt: row.added_at,
  };
}
