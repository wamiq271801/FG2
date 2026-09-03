/**
 * Brand queries (server-side).
 *
 * Brands are a read-only domain in Phase 2 (no admin mutation path exists),
 * so the `brands` tag is resolved by no event — the scope simply never
 * invalidates, per the no-TTL model.
 */

import { cacheLife, cacheTag } from "next/cache";
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

/** The brand list scope — tags: `brands`. */
export async function getAllBrands(): Promise<Brand[]> {
  "use cache";
  cacheLife("indefinite");
  cacheTag("brands");

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
