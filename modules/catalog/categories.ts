/**
 * Category queries (server-side).
 *
 * Categories resolve by slug at the route boundary; everything downstream
 * uses category ids.
 */

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

export async function getAllCategories(): Promise<Category[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase.from("categories").select("*");
  if (error) throw error;
  return asRows<CategoryRow>(data).map(mapCategory);
}

/** Route-level resolution: the only place a slug identifies a category. */
export async function getCategoryBySlug(
  slug: string
): Promise<Category | undefined> {
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

export async function getCategoryProductCount(
  categoryId: string
): Promise<number> {
  const supabase = createCatalogClient();
  const { count, error } = await supabase
    .from("products")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("is_active", true);
  if (error) throw error;
  return count ?? 0;
}
