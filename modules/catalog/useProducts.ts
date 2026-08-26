"use client";

/**
 * Browser-side product resolution hooks. Products are resolved by internal
 * id only — slugs never act as lookup keys here.
 *
 * Resolved products are kept in a module-level session cache. Remounting a
 * surface (cart, wishlist, order detail) reuses data already fetched during
 * this browser session instead of re-querying Supabase; only ids never seen
 * before are fetched. The cache lives for the page lifetime only — a full
 * reload refetches everything, so price/stock stay fresh per visit. Checkout
 * pricing/inventory authority remains entirely server-side (Worker).
 *
 * A missing/inactive product is cached as null so removed products are not
 * re-queried on every remount.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types";
import { PRODUCT_CARD_SELECT, mapProductRow, type ProductRow } from "./types";

// id → product, or null when the id is known to not resolve (inactive/deleted).
const productCache = new Map<string, Product | null>();

export function useProductsByIds(ids: string[]): {
  products: Product[];
  loading: boolean;
} {
  // Seed from the session cache so a remount renders instantly when every
  // requested id is already resolved.
  const [products, setProducts] = useState<Product[]>(() =>
    ids
      .map((id) => productCache.get(id))
      .filter((p): p is Product => Boolean(p))
  );
  const [loading, setLoading] = useState(() =>
    ids.some((id) => !productCache.has(id))
  );

  useEffect(() => {
    const missing = ids.filter((id) => !productCache.has(id));
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      setLoading(false);
      return;
    }
    if (missing.length === 0) {
      // Every id already resolved this session — reuse, no network.
      setProducts(
        ids
          .map((id) => productCache.get(id))
          .filter((p): p is Product => Boolean(p))
      );
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .in("id", missing)
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[catalog] failed to resolve products by ids", error);
          setProducts([]);
        } else {
          const rows = data as ProductRow[];
          const byId = new Map(rows.map((r) => [r.id, r]));
          for (const id of missing) {
            const row = byId.get(id);
            productCache.set(id, row ? mapProductRow(row) : null);
          }
          setProducts(
            ids
              .map((id) => productCache.get(id))
              .filter((p): p is Product => Boolean(p))
          );
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [ids.join(",")]);

  return { products, loading };
}
