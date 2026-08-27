/**
 * Product sitemap composition — pure transformation from the minimal
 * catalog sitemap projection to URL entries.
 *
 * URL shape mirrors the canonical product route: /product/[slug]
 * (app/(static)/product/[slug]/page.tsx).
 *
 * lastModified is the trigger-maintained products.updated_at (see
 * supabase/schema/06_triggers.sql — set_updated_at() on every row update),
 * i.e. the real last modification time of the product record.
 *
 * The image is the canonical page's primary image: product_images ordered
 * by position, first URL — exactly what the product page renders as its
 * main image (mapProductRow → sortedImageUrls → product.images[0]).
 * Gallery/variation images are never included; when no image exists the
 * image element is omitted entirely.
 */

import type { ProductSitemapRow } from "@/modules/catalog/products";
import { absoluteUrl } from "@/lib/site";
import type { SitemapUrlEntry } from "./xml";
import { toW3cDatetime } from "./xml";

export function productSitemapEntries(
  rows: ProductSitemapRow[]
): SitemapUrlEntry[] {
  return rows.map((row) => {
    const primaryImage = [...(row.product_images ?? [])]
      .sort((a, b) => a.position - b.position)
      .map((image) => image.url)[0];

    return {
      url: absoluteUrl(`/product/${row.slug}`),
      lastModified: toW3cDatetime(row.updated_at),
      ...(primaryImage ? { image: absoluteUrl(primaryImage) } : {}),
    };
  });
}
