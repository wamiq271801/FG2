/**
 * Root sitemap index — /sitemap.xml
 *
 * A standards-compliant <sitemapindex> referencing the three logical URL
 * groups of the site (static pages, product batches, category batches).
 * Served by a route handler because Next.js native metadata routes
 * (app/sitemap.ts) can only emit <urlset> documents, never a sitemap
 * index.
 *
 * Discovery (two count-only queries through the existing catalog modules)
 * lists the child sitemaps that currently exist; it never generates or
 * warms child batches. Child sitemaps are generated lazily on their first
 * request and cached independently (ISR).
 */

import { cacheLife, cacheTag } from "next/cache";
import { getCategorySitemapCount } from "@/modules/catalog/categories";
import { getProductSitemapCount } from "@/modules/catalog/products";
import {
  CATEGORY_SITEMAP_BATCH_SIZE,
  PRODUCT_SITEMAP_BATCH_SIZE,
  categorySitemapUrl,
  productSitemapUrl,
  renderSitemapIndex,
  sitemapBatchCount,
  staticSitemapUrl,
} from "@/lib/sitemap";

// Cache Components: the previous `export const revalidate = 3600` segment
// config is replaced by the cached helper below. Phase 2: the counts scope
// carries `sitemap:products` + `sitemap:categories` — product/category
// events drop it; there is no time-based revalidation (indefinite).
export async function GET() {
  const { productCount, categoryCount } = await getSitemapIndexCounts();

  const productBatches = sitemapBatchCount(
    productCount,
    PRODUCT_SITEMAP_BATCH_SIZE
  );
  const categoryBatches = sitemapBatchCount(
    categoryCount,
    CATEGORY_SITEMAP_BATCH_SIZE
  );

  const children = [
    staticSitemapUrl(),
    ...Array.from({ length: productBatches }, (_, batch) =>
      productSitemapUrl(batch)
    ),
    ...Array.from({ length: categoryBatches }, (_, batch) =>
      categorySitemapUrl(batch)
    ),
  ];

  return new Response(renderSitemapIndex(children), {
    headers: { "Content-Type": "application/xml" },
  });
}

async function getSitemapIndexCounts() {
  "use cache";
  cacheLife("indefinite");
  cacheTag("sitemap:products", "sitemap:categories");

  const [productCount, categoryCount] = await Promise.all([
    getProductSitemapCount(),
    getCategorySitemapCount(),
  ]);
  return { productCount, categoryCount };
}
