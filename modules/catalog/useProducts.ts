"use client";

/**
 * Browser-side product resolution hooks. Products are resolved by internal
 * id only — slugs never act as lookup keys here.
 */

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "@/types";
import { PRODUCT_CARD_SELECT, mapProductRow, type ProductRow } from "./types";

export function useProductsByIds(ids: string[]): {
  products: Product[];
  loading: boolean;
} {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (ids.length === 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProducts([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("products")
      .select(PRODUCT_CARD_SELECT)
      .in("id", ids)
      .eq("is_active", true)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error("[catalog] failed to resolve products by ids", error);
          setProducts([]);
        } else {
          const rows = data as ProductRow[];
          setProducts(
            ids
              .map((id) => rows.find((r) => r.id === id))
              .filter((r): r is ProductRow => Boolean(r))
              .map(mapProductRow)
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
