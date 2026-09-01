/**
 * Category child sitemap batch — /categories/sitemap/[id].xml
 *
 * Contains category URLs only. Each request resolves exactly one batch
 * (deterministic id ordering + keyset range); nothing enumerates or warms
 * other batches. The response is cached by ISR (revalidate)
 * independently per batch. No image data for categories.
 */

import { cacheLife } from "next/cache";
import { getCategorySitemapBatch } from "@/modules/catalog/categories";
import {
  CATEGORY_SITEMAP_BATCH_SIZE,
  categorySitemapEntries,
  parseSitemapBatchId,
  renderUrlset,
} from "@/lib/sitemap";

// Cache Components: the previous `export const revalidate = 3600` segment
// config is replaced by the cached helper below ('sitemap' profile).

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  const batch = parseSitemapBatchId(id);
  if (batch === null) {
    return new Response("Not found", { status: 404 });
  }

  const rows = await getCategorySitemapRows(batch);
  return new Response(renderUrlset(categorySitemapEntries(rows)), {
    headers: { "Content-Type": "application/xml" },
  });
}

async function getCategorySitemapRows(batch: number) {
  "use cache";
  cacheLife("sitemap");

  return getCategorySitemapBatch(batch, CATEGORY_SITEMAP_BATCH_SIZE);
}
