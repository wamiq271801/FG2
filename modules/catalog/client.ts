/**
 * Browser-side catalog queries for client interactions (search).
 *
 * Uses the public Supabase client (anon key, RLS-constrained). Only queries
 * data permitted by public read policies.
 */
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types";

type CardRow = {
  slug: string; name: string; subtitle: string; brand_slug: string;
  category_slug: string; subcategory: string | null; tagline: string;
  price: number; compare_at: number | null; currency: "INR";
  visual_key: Product["visualKey"]; accent: string;
  availability: Product["availability"]; stock: number | null;
  rating: number; review_count: number; added_at: string;
  brands: { name: string } | null;
  product_images: { url: string; position: number; is_primary: boolean }[];
  product_badges: { badge: string; position: number }[];
};

function mapCard(row: CardRow): Product {
  const images = [...(row.product_images ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((i) => i.url);
  const badges = [...(row.product_badges ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((b) => b.badge);
  return {
    slug: row.slug,
    name: row.name,
    subtitle: row.subtitle,
    brand: row.brand_slug,
    brandName: row.brands?.name,
    category: row.category_slug,
    subcategory: row.subcategory ?? undefined,
    tagline: row.tagline,
    price: row.price,
    compareAt: row.compare_at ?? undefined,
    currency: row.currency,
    images,
    visualKey: row.visual_key,
    accent: row.accent,
    availability: row.availability,
    stock: row.stock ?? undefined,
    rating: Number(row.rating),
    reviewCount: row.review_count,
    addedAt: row.added_at,
    badges: badges.length > 0 ? badges : undefined,
  };
}

const SELECT = `
  slug, name, subtitle, brand_slug, category_slug, subcategory, tagline,
  price, compare_at, currency, visual_key, accent, availability, stock,
  rating, review_count, added_at,
  brands!inner(name),
  product_images(url, position, is_primary),
  product_badges(badge, position)
`;

export async function searchProductsClient(query: string): Promise<Product[]> {
  const q = query.trim();
  if (!q) return [];
  const supabase = createClient();
  const pattern = `%${q}%`;
  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .eq("is_active", true)
    .or(
      `name.ilike.${pattern},subtitle.ilike.${pattern},tagline.ilike.${pattern},description.ilike.${pattern},subcategory.ilike.${pattern}`
    )
    .order("review_count", { ascending: false })
    .limit(24);
  if (error) throw error;
  return (data as CardRow[]).map(mapCard);
}

export async function getTrendingProductsClient(limit = 4): Promise<Product[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("products")
    .select(SELECT)
    .eq("is_active", true)
    .order("review_count", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as CardRow[]).map(mapCard);
}
