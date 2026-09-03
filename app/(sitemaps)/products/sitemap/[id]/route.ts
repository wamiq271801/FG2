/**
 * Product child sitemap batch — /products/sitemap/[id].xml
 *
 * Contains product URLs only. Each request resolves exactly one batch:
 * the handler queries only that batch's rows (deterministic id ordering +
 * keyset range) and transforms only that batch. Nothing enumerates,
 * generates or warms other batches. The response is cached by ISR
 * (revalidate) independently per batch.
 */

import { cacheLife, cacheTag } from "next/cache";
import { getProductSitemapBatch } from "@/modules/catalog/products";
import {
  PRODUCT_SITEMAP_BATCH_SIZE,
  parseSitemapBatchId,
  productSitemapEntries,
  renderUrlset,
} from "@/lib/sitemap";

// Cache Components: the previous `export const revalidate = 3600` segment
// config is replaced by the cached helper below. Phase 2: each batch scope
// carries `sitemap:products` — product events drop every batch; no
// time-based revalidation (indefinite).

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const batch = parseSitemapBatchId(id);
  if (batch === null) {
    return new Response("Not found", { status: 404 });
  }

  const rows = await getProductSitemapRows(batch);
  return new Response(renderUrlset(productSitemapEntries(rows)), {
    headers: { "Content-Type": "application/xml" },
  });
}

async function getProductSitemapRows(batch: number) {
  "use cache";
  cacheLife("indefinite");
  cacheTag("sitemap:products");

  return getProductSitemapBatch(batch, PRODUCT_SITEMAP_BATCH_SIZE);
}
