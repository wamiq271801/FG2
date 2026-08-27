/**
 * Product child sitemap batch — /products/sitemap/[id].xml
 *
 * Contains product URLs only. Each request resolves exactly one batch:
 * the handler queries only that batch's rows (deterministic id ordering +
 * keyset range) and transforms only that batch. Nothing enumerates,
 * generates or warms other batches. The response is cached by ISR
 * (revalidate) independently per batch.
 */

import { getProductSitemapBatch } from "@/modules/catalog/products";
import {
  PRODUCT_SITEMAP_BATCH_SIZE,
  parseSitemapBatchId,
  productSitemapEntries,
  renderUrlset,
} from "@/lib/sitemap";

// Static literal required by Next.js: segment config exports are statically
// analyzed at build time and must not reference imported constants. Keep in
// sync with SITEMAP_REVALIDATE_SECONDS (lib/sitemap/config.ts).
export const revalidate = 3600;

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const batch = parseSitemapBatchId(id);
  if (batch === null) {
    return new Response("Not found", { status: 404 });
  }

  const rows = await getProductSitemapBatch(batch, PRODUCT_SITEMAP_BATCH_SIZE);
  return new Response(renderUrlset(productSitemapEntries(rows)), {
    headers: { "Content-Type": "application/xml" },
  });
}
