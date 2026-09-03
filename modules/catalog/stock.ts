/**
 * Live stock reads (server-side) — the Phase 2 availability architecture.
 *
 * Stock/availability NEVER enters a shared cache (no 'use cache' here, and
 * the cached catalog selects exclude the stock column). Pages assemble
 * cached card/detail data and merge a live `getStocks()` overlay at render
 * time; the PDP refreshes once more after hydration through `useStock`
 * (client) + GET /api/stock (modules/catalog/use-stock.ts).
 */

import { createCatalogClient } from "@/lib/supabase/catalog";
import { asRows } from "./types";
import { deriveAvailability, type Product, type StockInfo } from "@/types";

type StockRow = {
  id: string;
  stock: number;
  is_active: boolean;
  is_preorder: boolean;
};

/**
 * ONE live batched stock read: { stock, isActive, isPreorder, availability }
 * per requested product id. Missing ids are simply absent from the map —
 * callers decide how to treat them (the overlay leaves those products'
 * cached-side availability untouched).
 */
export async function getStocks(
  ids: string[]
): Promise<Map<string, StockInfo>> {
  const map = new Map<string, StockInfo>();
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return map;

  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, stock, is_active, is_preorder")
    .in("id", unique);
  if (error) throw error;

  for (const row of asRows<StockRow>(data)) {
    map.set(row.id, {
      stock: row.stock,
      isActive: row.is_active,
      isPreorder: row.is_preorder,
      availability: deriveAvailability(
        row.stock,
        row.is_preorder,
        row.is_active
      ),
    });
  }
  return map;
}

/**
 * Merge a live stock map over cached (sans-stock) products: only
 * availability UI fields are filled in — every other field stays exactly
 * as the cached scope produced it. Products without a live entry pass
 * through unchanged (availability stays undefined and the UI hides the
 * badge rather than guessing).
 */
export function overlayStock<T extends Product>(
  products: T[],
  stocks: Map<string, StockInfo>
): T[] {
  return products.map((p) => {
    const info = stocks.get(p.id);
    if (!info) return p;
    return { ...p, stock: info.stock, availability: info.availability };
  });
}
