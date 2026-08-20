"use client";

import { createContext, useContext, useMemo } from "react";
import { useCart, useCartLines } from "@/modules/cart";
import { useProductsBySlugs } from "@/modules/catalog/useProducts";

// A resolved cart line: the stored line + the current product data
export type ResolvedCartLine = {
  key: string;
  slug: string;
  variant: string;
  quantity: number;
  product: {
    name: string;
    price: number;
    visualKey: string;
    accent: string;
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
  const { lines, ready, userId, loading } = useCartLines();
  const slugs = lines.map((l) => l.slug);
  const { products, loading: productsLoading } = useProductsBySlugs(slugs);

  const resolvedLines: ResolvedCartLine[] = useMemo(() => {
    return lines
      .map((line) => {
        const product = products.find((p) => p.slug === line.slug);
        if (!product) return null;
        return {
          key: line.variant ? `${line.slug}::${line.variant}` : line.slug,
          slug: line.slug,
          variant: line.variant,
          quantity: line.quantity,
          product: {
            name: product.name,
            price: product.price,
            visualKey: product.visualKey,
            accent: product.accent,
            availability: product.availability,
          },
        };
      })
      .filter((l): l is ResolvedCartLine => l !== null);
  }, [lines, products]);

  const count = resolvedLines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = resolvedLines.reduce((n, l) => n + l.quantity * l.product.price, 0);

  // ready = cart data loaded AND (no products to fetch OR products fetched)
  const fullyReady = ready && (!loading) && (slugs.length === 0 || !productsLoading);

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
