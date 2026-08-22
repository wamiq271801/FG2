"use client";

import { createContext, useContext, useMemo } from "react";
import { useCart, useCartLines } from "@/modules/cart";
import { useProductsBySlugs } from "@/modules/catalog/useProducts";

/**
 * A resolved cart line: the stored cart line + current product data.
 *
 * productId is the UUID of the actual sellable product.
 * slug is the product's URL slug, used for navigation and display.
 */
export type ResolvedCartLine = {
  /** Cart line identity — the product UUID. */
  productId: string;
  /** Product URL slug — for navigation only, not cart identity. */
  slug: string;
  quantity: number;
  product: {
    name: string;
    price: number;
    visualKey: string;
    accent: string;
    /** Derived availability string from is_active + is_preorder + stock. */
    availability: string;
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

  // Resolve product data for display by slug.
  // CartLine.slug is carried from the cart store for exactly this purpose.
  const slugs = useMemo(() => [...new Set(lines.map((l) => l.slug).filter(Boolean))], [lines]);
  const { products, loading: productsLoading } = useProductsBySlugs(slugs);

  const resolvedLines: ResolvedCartLine[] = useMemo(() => {
    return lines
      .map((line) => {
        // Match by productId first (exact), fall back to slug for guest lines
        // that may have been loaded before product data arrives
        const product =
          products.find((p) => p.id === line.productId) ??
          products.find((p) => p.slug === line.slug);
        if (!product) return null;
        return {
          productId: line.productId,
          slug: line.slug,
          quantity: line.quantity,
          product: {
            name: product.name,
            price: product.price,
            visualKey: product.visualKey,
            accent: product.accent,
            availability: product.availability,
          },
        } satisfies ResolvedCartLine;
      })
      .filter((l): l is ResolvedCartLine => l !== null);
  }, [lines, products]);

  const count = resolvedLines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = resolvedLines.reduce((n, l) => n + l.quantity * l.product.price, 0);

  const fullyReady = ready && !loading && (slugs.length === 0 || !productsLoading);

  const value = useMemo<CartContextValue>(
    () => ({
      lines: fullyReady ? resolvedLines : [],
      count: fullyReady ? count : 0,
      subtotal: fullyReady ? subtotal : 0,
      ready: fullyReady,
    }),
    [resolvedLines, count, subtotal, fullyReady]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  return useContext(CartContext);
}
