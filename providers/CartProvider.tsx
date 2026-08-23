"use client";

import { createContext, useContext, useMemo, useRef } from "react";
import { useCart, useCartLines } from "@/modules/cart";
import { useProductsByIds } from "@/modules/catalog/useProducts";

/**
 * A resolved cart line: the stored cart line + current product data.
 * productId is the UUID of the actual sellable product — the only identity.
 */
export type ResolvedCartLine = {
  /** Cart line identity — the product UUID. */
  productId: string;
  quantity: number;
  product: {
    name: string;
    /** URL slug from the resolved product — link generation only. */
    slug: string;
    price: number;
    visualKey: string;
    accent: string;
    /** Derived availability string from is_active + is_preorder + stock. */
    availability: string;
    /** Numeric stock value for quantity constraints. */
    stock: number;
  };
};

type CartContextValue = {
  lines: ResolvedCartLine[];
  count: number;
  subtotal: number;
  ready: boolean;
};

const CartContext = createContext<CartContextValue>({
  lines: [],
  count: 0,
  subtotal: 0,
  ready: false,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { lines, ready, loading } = useCartLines();

  // Resolve display data by productId.
  const productIds = useMemo(
    () => [...new Set(lines.map((l) => l.productId).filter(Boolean))],
    [lines]
  );
  const { products, loading: productsLoading } = useProductsByIds(productIds);

  const resolvedLines: ResolvedCartLine[] = useMemo(() => {
    return lines
      .map((line): ResolvedCartLine | null => {
        const product = products.find((p) => p.id === line.productId);
        if (!product) return null;
        return {
          productId: line.productId,
          quantity: line.quantity,
          product: {
            name: product.name,
            slug: product.slug,
            price: product.price,
            visualKey: product.visualKey,
            accent: product.accent,
            availability: product.availability,
            stock: product.stock,
          },
        };
      })
      .filter((l): l is ResolvedCartLine => l !== null);
  }, [lines, products]);

  const count = resolvedLines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = resolvedLines.reduce((n, l) => n + l.quantity * l.product.price, 0);

  // During auth transition, useCartLines keeps returning guest data (ready=true)
  // until remote data is loaded. Once remote data is loaded, ready=true and
  // lines come from remote. If lines is empty but products are still loading,
  // keep ready=false so the badge doesn't flash zero.
  const fullyReady = ready && !loading && (productIds.length === 0 || !productsLoading);

  const resolvedSnapshot = useMemo<CartContextValue>(
    () => ({ lines: resolvedLines, count, subtotal, ready: true }),
    [resolvedLines, count, subtotal]
  );

  // Hold-last-good: right after the guest→remote swap, remote-only products
  // briefly re-resolve display data. Serve the previous valid snapshot during
  // that gap instead of flashing an empty cart / zero badge.
  const lastGoodRef = useRef(resolvedSnapshot);
  if (fullyReady) lastGoodRef.current = resolvedSnapshot;
  const value = fullyReady ? resolvedSnapshot : lastGoodRef.current;

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  return useContext(CartContext);
}
