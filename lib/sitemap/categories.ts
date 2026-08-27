/**
 * Category sitemap composition — pure transformation from the minimal
 * catalog sitemap projection to URL entries.
 *
 * URL shape mirrors the canonical category route: /categories/[slug]
 * (app/(static)/categories/[slug]/page.tsx).
 *
 * lastModified is the trigger-maintained categories.updated_at (see
 * supabase/schema/06_triggers.sql — set_updated_at() on every row update).
 * Categories carry no image data in the sitemap.
 */

import type { CategorySitemapRow } from "@/modules/catalog/categories";
import { absoluteUrl } from "@/lib/site";
import type { SitemapUrlEntry } from "./xml";
import { toW3cDatetime } from "./xml";

export function categorySitemapEntries(
  rows: CategorySitemapRow[]
): SitemapUrlEntry[] {
  return rows.map((row) => ({
    url: absoluteUrl(`/categories/${row.slug}`),
    lastModified: toW3cDatetime(row.updated_at),
  }));
}
