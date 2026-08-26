"use client";

import { createContext, useContext, useMemo, useRef } from "react";
import { useCartLines, type CartLine } from "@/modules/cart";

/**
 * Global cart context — cart IDENTITY only (product ids + quantities).
 *
 * The header badge, guards and checkout gate need only membership/count, so
 * the provider resolves no product data. Surfaces that must display product
 * details (the cart page) resolve them locally via useProductsByIds, which
 * reuses data already fetched during the session.
 *
 * A hold-last-good snapshot keeps the badge/cart from flashing empty during
 * the guest→remote swap after sign-in: useCartLines keeps serving guest data
 * until the remote load completes, and the last fully-ready snapshot is held
 * while a transition is still in flight.
 */
type CartContextValue = {
  lines: CartLine[];
  count: number;
  ready: boolean;
};

const CartContext = createContext<CartContextValue>({
  lines: [],
  count: 0,
  ready: false,
});

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { lines, ready } = useCartLines();

  const count = useMemo(
    () => lines.reduce((n, l) => n + l.quantity, 0),
    [lines]
  );

  const snapshot = useMemo<CartContextValue>(
    () => ({ lines, count, ready: true }),
    [lines, count]
  );

  // Hold-last-good: while a load/merge is in flight (ready=false), keep
  // serving the previous valid snapshot instead of flashing an empty cart.
  const lastGoodRef = useRef(snapshot);
  if (ready) lastGoodRef.current = snapshot;
  const value = ready ? snapshot : lastGoodRef.current;

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCartContext() {
  return useContext(CartContext);
}
