/**
 * Category queries (server-side).
 *
 * Phase 2 cache architecture: the category list and the slug-resolved
 * category detail are 'use cache' scopes tagged for explicit invalidation
 * (`categories`, `category:{id}`, `category-slug:{slug}`). The
 * active-product counts derive from the cached product-card dataset so
 * every surface shows the same counts the shop grid computes.
 *
 * Categories resolve by slug at the route boundary; everything downstream
 * uses category ids.
 */

import { cacheLife, cacheTag } from "next/cache";
import { createCatalogClient } from "@/lib/supabase/catalog";
import { asRows, asSingle } from "./types";
import type { Category } from "@/types";
import { getAllProductCards } from "./products";
type CategoryRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  intro: string;
  image: string;
  accent: string;
  subcategories: string[];
  featured: string[];
  seo_note: string;
};

function mapCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    intro: row.intro,
    image: row.image,
    accent: row.accent,
    subcategories: row.subcategories ?? [],
    featured: row.featured ?? [],
    seoNote: row.seo_note,
  };
}

/**
 * The category list scope — tags: `categories`. Invalidated by every
 * category.* domain event. (The footer cache component consumes this same
 * scope, so footer category links refresh with it.)
 */
export async function getAllCategories(): Promise<Category[]> {
  "use cache";
  cacheLife("indefinite");
  cacheTag("categories");

  const supabase = createCatalogClient();
  const { data, error } = await supabase.from("categories").select("*");
  if (error) throw error;
  return asRows<CategoryRow>(data).map(mapCategory);
}

/**
 * Route-level resolution: the only place a slug identifies a category.
 *
 * Tags on a hit: `category:{id}` + `category-slug:{slug}`. Tags on a miss:
 * `category-slug:{slug}` (a category later taking this slug drops the
 * negative entry). A missing row resolves to undefined so the uncached
 * page can call notFound() outside the cached scope.
 */
export async function getCategoryBySlug(
  slug: string
): Promise<Category | undefined> {
  "use cache";
  cacheLife("indefinite");

  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  const row = asSingle<CategoryRow>(data);
  if (!row) {
    cacheTag(`category-slug:${slug}`);
    return undefined;
  }
  cacheTag(`category:${row.id}`, `category-slug:${slug}`);
  return mapCategory(row);
}

// ── Sitemap projections (raw reads; the route wraps them in a scope) ──

export type CategorySitemapRow = {
  slug: string;
  updated_at: string;
};

/** Count of categories (count-only query). */
export async function getCategorySitemapCount(): Promise<number> {
  const supabase = createCatalogClient();
  const { count, error } = await supabase
    .from("categories")
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/**
 * One deterministic batch of categories.
 *
 * Ordering is the immutable primary key (uuid) — stable across queries, so
 * `.range()` pagination is deterministic; only the requested batch's rows
 * are fetched.
 */
export async function getCategorySitemapBatch(
  batch: number,
  batchSize: number
): Promise<CategorySitemapRow[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("categories")
    .select("slug, updated_at")
    .order("id", { ascending: true })
    .range(batch * batchSize, batch * batchSize + batchSize - 1);
  if (error) throw error;
  return asRows<CategorySitemapRow>(data);
}

/**
 * Active-product counts for every category, derived from the cached
 * product-card dataset — the exact same set (and freshness) the shop grid
 * and category grids compute their counts from. No per-category count
 * queries.
 */
export async function getCategoryProductCounts(): Promise<
  Map<string, number>
> {
  const products = await getAllProductCards();
  const counts = new Map<string, number>();
  for (const p of products) {
    if (p.categoryId) {
      counts.set(p.categoryId, (counts.get(p.categoryId) ?? 0) + 1);
    }
  }
  return counts;
}
