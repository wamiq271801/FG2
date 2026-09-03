/**
 * Sitemap system configuration — the single place where batch sizes,
 * revalidation and child-sitemap URL conventions live.
 *
 * Child sitemap URL paths follow the Next.js App Router conventions for
 * the installed version (16.x): a `sitemap` segment under the resource
 * segment with a `[id].xml` leaf, e.g. /products/sitemap/0.xml. They are
 * served by route handlers (app/(sitemaps)/products/sitemap/[id]/route.ts)
 * instead of native generateSitemaps because generateSitemaps enumerates
 * every batch id at build time and materializes all child sitemaps during
 * `next build` — this system generates batches on demand (ISR). The
 * `(sitemaps)` directory is a route group: it organizes the sitemap route
 * handlers without affecting their public URLs.
 *
 * All URLs are built from the central site origin in lib/site.ts.
 */

import { absoluteUrl } from "@/lib/site";

/** Product URLs per product child sitemap.
 *
 * Deliberately far below the 50,000-URL sitemap protocol limit: keeps each
 * generated XML document small (≈1 MB incl. one image entry per URL),
 * keeps the ranged database query fast, and still yields only ~20 batches
 * for a 100k-product catalog.
 */
export const PRODUCT_SITEMAP_BATCH_SIZE = 5000;

/** Category URLs per category child sitemap (categories are a much
 * smaller, flatter collection; 1,000 keeps documents tiny). */
export const CATEGORY_SITEMAP_BATCH_SIZE = 1000;

/**
 * Revalidation window shared by every sitemap route handler.
 *
 * Catalog pages use `revalidate = 300`; sitemap documents change only when
 * catalog composition changes (products/categories added or removed), so a
 * one-hour window keeps sitemaps within the same freshness order of
 * magnitude while cutting regeneration cost.
 *
 * NOTE: the route handlers inline the literal `3600` in their
 * `export const revalidate = ...` segment configs — Next.js statically
 * analyzes segment config exports at build time and rejects imported
 * constants ("Invalid segment configuration export detected"). If you
 * change this value, update the literal in each sitemap route handler:
 * app/(sitemaps)/sitemap.xml/route.ts,
 * app/(sitemaps)/sitemap-static.xml/route.ts,
 * app/(sitemaps)/products/sitemap/[id]/route.ts,
 * app/(sitemaps)/categories/sitemap/[id]/route.ts.
 */
export const SITEMAP_REVALIDATE_SECONDS = 3600;

/** Path of the static-pages child sitemap. */
export const STATIC_SITEMAP_PATH = "/sitemap-static.xml";

/** Absolute URL of the static-pages child sitemap. */
export function staticSitemapUrl(): string {
  return absoluteUrl(STATIC_SITEMAP_PATH);
}

/** Absolute URL of product child sitemap `batch` (0-based). */
export function productSitemapUrl(batch: number): string {
  return absoluteUrl(`/products/sitemap/${batch}.xml`);
}

/** Absolute URL of category child sitemap `batch` (0-based). */
export function categorySitemapUrl(batch: number): string {
  return absoluteUrl(`/categories/sitemap/${batch}.xml`);
}

/** Number of child sitemaps needed for `total` URLs at `batchSize` (0 → 0). */
export function sitemapBatchCount(total: number, batchSize: number): number {
  return Math.ceil(total / batchSize);
}

/**
 * Parse a batch id path segment into its 0-based batch number.
 *
 * Accepts the canonical `0.xml` form (and the bare `0` form for
 * convenience); anything else is not a valid batch id → null.
 */
export function parseSitemapBatchId(id: string): number | null {
  const match = /^(\d+)(?:\.xml)?$/.exec(id);
  if (!match) return null;
  const batch = Number(match[1]);
  return Number.isSafeInteger(batch) ? batch : null;
}
