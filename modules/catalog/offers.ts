/**
 * Promotion/offer queries (server-side).
 *
 * Phase 2: offers are cached scopes tagged for future invalidation — no
 * admin mutation path exists for offers in this phase, so no event ever
 * resolves the `offers` / `offer:{slug}` tags. Offer→product relationships
 * use offer_products.product_id only; product records are resolved by the
 * consuming page from the product-card dataset.
 */

import { cacheLife, cacheTag } from "next/cache";
import { createCatalogClient } from "@/lib/supabase/catalog";
import { asRows, asSingle } from "./types";
import type { Promotion } from "@/types";

type OfferRow = {
  slug: string;
  title: string;
  description: string;
  badge: string;
  terms: string;
  starts_at: string | null;
  ends_at: string | null;
  status: string;
  offer_products: { product_id: string; position: number }[] | null;
};

const OFFER_SELECT = "*, offer_products(product_id, position)";

function mapPromotion(row: OfferRow): Promotion {
  const productIds = [...(row.offer_products ?? [])]
    .sort((a, b) => a.position - b.position)
    .map((op) => op.product_id);
  return {
    slug: row.slug,
    title: row.title,
    description: row.description,
    badge: row.badge,
    productIds,
    startsAt: row.starts_at ?? undefined,
    endsAt: row.ends_at ?? undefined,
    terms: row.terms,
  };
}

/** The offers list scope — tags: `offers`. */
export async function getAllPromotions(): Promise<Promotion[]> {
  "use cache";
  cacheLife("indefinite");
  cacheTag("offers");

  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("offers")
    .select(OFFER_SELECT)
    .in("status", ["active", "expired"])
    .order("ends_at", { ascending: false, nullsFirst: false });
  if (error) throw error;
  return asRows<OfferRow>(data).map(mapPromotion);
}

/** Offer-by-slug scope — tags: `offers`, `offer:{slug}`. */
export async function getPromotionBySlug(
  slug: string
): Promise<Promotion | undefined> {
  "use cache";
  cacheLife("indefinite");
  cacheTag("offers", `offer:${slug}`);

  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("offers")
    .select(OFFER_SELECT)
    .eq("slug", slug)
    .in("status", ["active", "expired"])
    .maybeSingle();
  if (error) throw error;
  const row = asSingle<OfferRow>(data);
  return row ? mapPromotion(row) : undefined;
}

/**
 * Active promotions containing a given product — tags: `offers` plus
 * `offer:{slug}` for every promotion found (filled at cache time).
 */
export async function getActiveOffersForProduct(
  productId: string
): Promise<Promotion[]> {
  "use cache";
  cacheLife("indefinite");

  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("offers")
    .select(OFFER_SELECT)
    .eq("offer_products.product_id", productId)
    .eq("status", "active")
    .order("ends_at", { ascending: true, nullsFirst: false });
  if (error) throw error;
  const promos = asRows<OfferRow>(data).map(mapPromotion);
  cacheTag("offers", ...promos.map((p) => `offer:${p.slug}`));
  return promos;
}

export function isPromotionActive(promo: Promotion): boolean {
  const now = Date.now();
  if (promo.startsAt && +new Date(promo.startsAt) > now) return false;
  if (promo.endsAt && +new Date(promo.endsAt) < now) return false;
  return true;
}
