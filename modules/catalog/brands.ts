/**
 * Brand queries (server-side).
 */

import { createCatalogClient } from "@/lib/supabase/catalog";
import { asRows, asSingle } from "./types";
import type { Brand } from "@/types";

type BrandRow = {
  id: string;
  slug: string;
  name: string;
  country: string;
  blurb: string;
};

function mapBrand(row: BrandRow): Brand {
  return { slug: row.slug, name: row.name, country: row.country, blurb: row.blurb };
}

export async function getAllBrands(): Promise<Brand[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase.from("brands").select("*");
  if (error) throw error;
  return asRows<BrandRow>(data).map(mapBrand);
}

export async function getBrandBySlug(
  slug: string
): Promise<Brand | undefined> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("brands")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw error;
  const row = asSingle<BrandRow>(data);
  return row ? mapBrand(row) : undefined;
}
