"use client";

/**
 * Browser-side catalog reads (public anon client, RLS-constrained).
 * Only interactive surfaces that cannot wait for a server round-trip.
 */

import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types";
import { PRODUCT_CARD_SELECT, mapProductRow, type ProductRow } from "./types";

export async function searchProductsClient(query: string): Promise<Product[]> {
  const q = query.trim();
  if (!q) return [];
  const supabase = createClient();
  const pattern = `%${q}%`;
  const { data, error } = await supabase
    .from("products")
    .select(PRODUCT_CARD_SELECT)
    .eq("is_active", true)
    .or(
      `name.ilike.${pattern},subtitle.ilike.${pattern},tagline.ilike.${pattern},description.ilike.${pattern},subcategory.ilike.${pattern}`
    )
    .order("review_count", { ascending: false })
    .limit(24);
  if (error) throw error;
  return (data as ProductRow[]).map(mapProductRow);
}
