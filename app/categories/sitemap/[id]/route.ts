/**
 * Category child sitemap batch — /categories/sitemap/[id].xml
 *
 * Contains category URLs only. Each request resolves exactly one batch
 * (deterministic id ordering + keyset range); nothing enumerates or warms
 * other batches. The response is cached by ISR (revalidate)
 * independently per batch. No image data for categories.
 */

import { getCategorySitemapBatch } from "@/modules/catalog/categories";
import {
  CATEGORY_SITEMAP_BATCH_SIZE,
  categorySitemapEntries,
  parseSitemapBatchId,
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

  const rows = await getCategorySitemapBatch(
    batch,
    CATEGORY_SITEMAP_BATCH_SIZE
  );
  return new Response(renderUrlset(categorySitemapEntries(rows)), {
    headers: { "Content-Type": "application/xml" },
  });
}
