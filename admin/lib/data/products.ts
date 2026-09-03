import "server-only";
import { getAdminClient } from "../supabase";

/**
 * Product management data layer (privileged, server-only).
 * Uses the EXISTING products schema — no admin-specific tables.
 */

export type ProductAdminRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  subtitle: string;
  brand_id: string;
  category_id: string;
  subcategory: string | null;
  tagline: string;
  description: string;
  story: string;
  price: number;
  compare_at_price: number | null;
  currency: "INR";
  visual_key: string;
  accent: string;
  stock: number;
  is_active: boolean;
  is_preorder: boolean;
  highlights: string[];
  includes: string[];
  specs: { key: string; value: string }[];
  rating: number;
  review_count: number;
  shipping: string;
  warranty: string;
  added_at: string;
  created_at: string;
  updated_at: string;
};

export type ProductImageRow = {
  id: string;
  product_id: string;
  url: string;
  position: number;
  is_primary: boolean;
};

const LIST_SELECT = `
  id, sku, slug, name, price, stock, is_active, is_preorder, added_at, updated_at,
  visual_key, accent, rating, review_count,
  brands(name, slug),
  categories(name, slug),
  product_images(url, position)
`;

export type ProductListRow = {
  id: string;
  sku: string;
  slug: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  is_preorder: boolean;
  added_at: string;
  updated_at: string;
  visual_key: string;
  accent: string;
  rating: number;
  review_count: number;
  brands: { name: string; slug: string } | null;
  categories: { name: string; slug: string } | null;
  product_images: { url: string; position: number }[] | null;
};

/** PostgREST `or=` filters cannot contain commas/parens — strip them. */
function sanitizeSearchTerm(q: string): string {
  return q.replace(/[,()]/g, " ").trim();
}

export async function listProducts(opts: {
  q?: string;
  page?: number;
  pageSize?: number;
  includeInactive?: boolean;
}): Promise<{ rows: ProductListRow[]; total: number; totalPages: number }> {
  const supabase = getAdminClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, opts.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase.from("products").select(LIST_SELECT, { count: "exact" });
  if (!opts.includeInactive) query = query.eq("is_active", true);
  const term = sanitizeSearchTerm(opts.q ?? "");
  if (term) {
    query = query.or(`name.ilike.%${term}%,slug.ilike.%${term}%,sku.ilike.%${term}%`);
  }
  query = query.order("updated_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as ProductListRow[];
  const total = count ?? 0;
  return { rows, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

export async function getProduct(
  id: string
): Promise<{ product: ProductAdminRow; images: ProductImageRow[] } | null> {
  const supabase = getAdminClient();
  const [productRes, imagesRes] = await Promise.all([
    supabase.from("products").select("*").eq("id", id).maybeSingle(),
    supabase
      .from("product_images")
      .select("id, product_id, url, position, is_primary")
      .eq("product_id", id)
      .order("position", { ascending: true }),
  ]);
  if (productRes.error) throw productRes.error;
  if (!productRes.data) return null;
  if (imagesRes.error) throw imagesRes.error;
  return {
    product: productRes.data as ProductAdminRow,
    images: (imagesRes.data ?? []) as unknown as ProductImageRow[],
  };
}

import { VISUAL_KEYS as VISUAL_KEYS_CONST, type Option, type ProductInput } from "../product-constants";
export type { Option, ProductInput } from "../product-constants";

export async function getBrandOptions(): Promise<Option[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("brands")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Option[];
}

export async function getCategoryOptions(): Promise<Option[]> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as Option[];
}

export const VISUAL_KEYS = VISUAL_KEYS_CONST;

/**
 * Fallback SKU generator (10 uppercase alphanumeric chars — the exact
 * shape of the products_sku_format CHECK and the DB's generate_sku()).
 * Used when the caller leaves the SKU blank because the live test
 * database has not yet granted EXECUTE on generate_sku() to privileged
 * API roles (that grant ships with the Phase 1 migration); the
 * assign_product_sku trigger still normalises whatever SKU is provided.
 */
function generateSkuFallback(): string {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let sku = "";
  for (let i = 0; i < 10; i++) {
    sku += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return sku;
}

export async function createProduct(input: ProductInput): Promise<string> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("products")
    .insert({
      // sku: caller-provided, else a generated fallback (see above) —
      // never blank, so the assign_product_sku trigger does not need the
      // (currently ungranted) generate_sku() function.
      sku: input.sku && input.sku.length > 0 ? input.sku : generateSkuFallback(),
      slug: input.slug,
      name: input.name,
      subtitle: input.subtitle,
      brand_id: input.brand_id,
      category_id: input.category_id,
      subcategory: input.subcategory,
      tagline: input.tagline,
      description: input.description,
      story: input.story,
      price: input.price,
      compare_at_price: input.compare_at_price,
      visual_key: input.visual_key,
      accent: input.accent,
      stock: input.stock,
      is_active: input.is_active,
      is_preorder: input.is_preorder,
      highlights: input.highlights,
      includes: input.includes,
      specs: input.specs,
      shipping: input.shipping,
      warranty: input.warranty,
    })
    .select("id")
    .single();
  if (error) throw error;
  return (data as { id: string }).id;
}

export async function updateProduct(id: string, input: ProductInput): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("products")
    .update({
      slug: input.slug,
      name: input.name,
      subtitle: input.subtitle,
      brand_id: input.brand_id,
      category_id: input.category_id,
      subcategory: input.subcategory,
      tagline: input.tagline,
      description: input.description,
      story: input.story,
      price: input.price,
      compare_at_price: input.compare_at_price,
      visual_key: input.visual_key,
      accent: input.accent,
      stock: input.stock,
      is_active: input.is_active,
      is_preorder: input.is_preorder,
      highlights: input.highlights,
      includes: input.includes,
      specs: input.specs,
      shipping: input.shipping,
      warranty: input.warranty,
    })
    .eq("id", id);
  if (error) throw error;
}

/** Soft archive — the storefront hides inactive products (existing model). */
export async function setProductActive(id: string, active: boolean): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase
    .from("products")
    .update({ is_active: active })
    .eq("id", id);
  if (error) throw error;
}

/**
 * Hard delete. FK semantics of the existing schema: images/cart/wishlist/
 * reviews/variation links cascade; order_items RESTRICT blocks deleting a
 * product with order history — the error is surfaced to the caller.
 */
export async function deleteProduct(id: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("products").delete().eq("id", id);
  if (error) throw error;
}

// ── Images ────────────────────────────────────────────────────────────

export async function addProductImage(productId: string, url: string): Promise<void> {
  const supabase = getAdminClient();
  // Next free position (UNIQUE (product_id, position) in the schema).
  const { data, error } = await supabase
    .from("product_images")
    .select("position")
    .eq("product_id", productId)
    .order("position", { ascending: false })
    .limit(1);
  if (error) throw error;
  const nextPosition = ((data?.[0] as { position: number } | undefined)?.position ?? -1) + 1;
  const { error: insertError } = await supabase.from("product_images").insert({
    product_id: productId,
    url,
    position: nextPosition,
  });
  if (insertError) throw insertError;
}

export async function deleteProductImage(imageId: string): Promise<void> {
  const supabase = getAdminClient();
  const { error } = await supabase.from("product_images").delete().eq("id", imageId);
  if (error) throw error;
}

/**
 * Mark one image as the product's primary (partial unique index enforces
 * a single primary per product, so other rows are cleared first).
 */
export async function setPrimaryImage(productId: string, imageId: string): Promise<void> {
  const supabase = getAdminClient();
  const { error: clearError } = await supabase
    .from("product_images")
    .update({ is_primary: false })
    .eq("product_id", productId)
    .eq("is_primary", true);
  if (clearError) throw clearError;
  const { error: setError } = await supabase
    .from("product_images")
    .update({ is_primary: true })
    .eq("id", imageId)
    .eq("product_id", productId);
  if (setError) throw setError;
}

/** Count of active products referencing each category (delete guard). */
export async function getCategoryReferenceCounts(): Promise<Map<string, number>> {
  const supabase = getAdminClient();
  const { data, error } = await supabase.from("products").select("category_id");
  if (error) throw error;
  const counts = new Map<string, number>();
  for (const row of (data ?? []) as { category_id: string | null }[]) {
    if (row.category_id) {
      counts.set(row.category_id, (counts.get(row.category_id) ?? 0) + 1);
    }
  }
  return counts;
}
