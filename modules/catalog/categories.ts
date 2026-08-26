/**
 * Category queries (server-side).
 *
 * Categories resolve by slug at the route boundary; everything downstream
 * uses category ids.
 */

import { cache } from "react";
import { createCatalogClient } from "@/lib/supabase/catalog";
import { asRows, asSingle } from "./types";
import type { Category } from "@/types";

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
 * All categories.
 *
 * Memoized per request — a category page resolves the full list twice
 * (generateStaticParams aside, the page shell and the SEO footer both call
 * it within one render).
 */
export const getAllCategories = cache(
  async (): Promise<Category[]> => {
    const supabase = createCatalogClient();
    const { data, error } = await supabase.from("categories").select("*");
    if (error) throw error;
    return asRows<CategoryRow>(data).map(mapCategory);
  }
);

/**
 * Route-level resolution: the only place a slug identifies a category.
 *
 * Memoized per request — generateMetadata(), the page shell and the results
 * component all resolve the same slug within one render (previously three
 * identical queries).
 */
export const getCategoryBySlug = cache(
  async (slug: string): Promise<Category | undefined> => {
    const supabase = createCatalogClient();
    const { data, error } = await supabase
      .from("categories")
      .select("*")
      .eq("slug", slug)
      .maybeSingle();
    if (error) throw error;
    const row = asSingle<CategoryRow>(data);
    return row ? mapCategory(row) : undefined;
  }
);

/**
 * Active-product counts for every category in ONE lightweight query
 * (id + category_id only, grouped in memory) — replaces one count query per
 * category on surfaces that show counts for the whole catalog (categories
 * index, search). Same semantics as getCategoryProductCount: active products
 * grouped by their category.
 */
export async function getCategoryProductCounts(): Promise<
  Map<string, number>
> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select("category_id")
    .eq("is_active", true);
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of asRows<{ category_id: string | null }>(data)) {
    if (row.category_id) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
  }
  return counts;
}
