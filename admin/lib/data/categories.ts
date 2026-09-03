import "server-only";
import { getAdminClient } from "../supabase";

/**
 * Category management data layer (privileged, server-only).
 * Uses the EXISTING categories schema — no admin-specific tables.
 */

export type CategoryAdminRow = {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  intro: string;
  image: string;
  accent: string;
  subcategories: string[];
  seo_note: string;
  created_at: string;
  updated_at: string;
};

export type CategoryListRow = CategoryAdminRow & {
  products: { id: string }[] | null;
};

export async function listCategories(opts: {
  q?: string;
}): Promise<CategoryListRow[]> {
  const supabase = getAdminClient();
  let query = supabase
    .from("categories")
    .select("*, products(id)")
    .order("name", { ascending: true });
  const term = (opts.q ?? "").replace(/[,()%]/g, " ").trim();
  if (term) {
    query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%`);
  }
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as unknown as CategoryListRow[];
}

export async function getCategory(id: string): Promise<CategoryAdminRow | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data ?? null) as CategoryAdminRow | null;
}

export type CategoryInput = {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  intro: string;
  image: string;
  accent: string;
  subcategories: string[];
  seo_note: string;
};

export async function createCategory(input: CategoryInput): Promise<string> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ ...input })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateCategory(id: string, input: CategoryInput): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("categories").update({ ...input }).eq("id", id);
  if (error) throw error;
}

/**
 * Hard delete. products.category_id REFERENCES categories ON DELETE
 * RESTRICT — deleting a category that still has products violates the
 * FK; the caller pre-checks with product counts and surfaces the error.
 */
export async function deleteCategory(id: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}
