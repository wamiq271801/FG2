"use client";

/**
 * Cart store — supports both guest (localStorage) and authenticated (Supabase)
 * users with automatic guest-to-account merge on sign-in.
 *
 * Every cart line identifies the actual sellable product by its UUID.
 * Display data is resolved separately by productId.
 *
 * State machine:
 *   Guest:   hydrated (localStorage rehydrated) → ready
 *   Authed:  remoteLoaded (Supabase query completed) → ready
 *
 * loading = a remote fetch is in progress (for skeleton display)
 * remoteLoaded = the initial remote fetch has completed (prevents empty-state flash)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";

export type CartLine = {
  /** Actual product UUID — the sellable unit and the only identity. */
  productId: string;
  quantity: number;
};

type CartState = {
  guestLines: CartLine[];
  remoteLines: CartLine[];
  hydrated: boolean;
  loading: boolean;
  remoteLoaded: boolean;
  remoteError: string | null;
  merging: boolean;
  loadedUserId: string | null;

  add: (line: CartLine, userId: string | null) => Promise<"added" | "already_in_cart">;
  setQuantity: (productId: string, quantity: number, userId: string | null) => Promise<void>;
  remove: (productId: string, userId: string | null) => Promise<void>;
  clearGuest: () => void;
  setHydrated: (v: boolean) => void;
  loadRemote: (userId: string) => Promise<boolean>;
  mergeGuestIntoRemote: (userId: string) => Promise<void>;
  resetForSignOut: () => void;
};

export const useCart = create<CartState>()(
  persist(
    (set, get) => ({
      guestLines: [],
      remoteLines: [],
      hydrated: false,
      loading: false,
      remoteLoaded: false,
      remoteError: null,
      merging: false,
      loadedUserId: null,

      add: async (line, userId) => {
        // Validate quantity before any write
        const qty = Math.max(1, Math.min(99, line.quantity));

        if (userId) {
          const supabase = createClient();
          // Check if product already exists in remote cart
          const { data: existing } = await supabase
            .from("cart_items")
            .select("product_id")
            .eq("user_id", userId)
            .eq("product_id", line.productId)
            .maybeSingle();
          if (existing) return "already_in_cart";
          // Insert only — never update existing quantity
          const { error } = await supabase
            .from("cart_items")
            .insert({ user_id: userId, product_id: line.productId, quantity: qty });
          if (error) throw error;
          await get().loadRemote(userId);
          return "added";
        } else {
          const { guestLines } = get();
          const existing = guestLines.find((l) => l.productId === line.productId);
          if (existing) return "already_in_cart";
          set({ guestLines: [...guestLines, { productId: line.productId, quantity: qty }] });
          return "added";
        }
      },

      setQuantity: async (productId, quantity, userId) => {
        const qty = Math.max(1, Math.min(99, quantity));
        if (userId) {
          const supabase = createClient();
          const { error } = await supabase
            .from("cart_items")
            .update({ quantity: qty })
            .eq("user_id", userId)
            .eq("product_id", productId);
          if (error) throw error;
          await get().loadRemote(userId);
        } else {
          set((state) => ({
            guestLines: state.guestLines
              .map((l) => (l.productId === productId ? { ...l, quantity: qty } : l))
              .filter((l) => l.quantity > 0),
          }));
        }
      },

      remove: async (productId, userId) => {
        if (userId) {
          const supabase = createClient();
          const { error } = await supabase
            .from("cart_items")
            .delete()
            .eq("user_id", userId)
            .eq("product_id", productId);
          if (error) throw error;
          await get().loadRemote(userId);
        } else {
          set((state) => ({
            guestLines: state.guestLines.filter((l) => l.productId !== productId),
          }));
        }
      },

      clearGuest: () => set({ guestLines: [] }),
      setHydrated: (v) => set({ hydrated: v }),

      loadRemote: async (userId) => {
        set({ loading: true, remoteError: null });
        const supabase = createClient();
        const { data, error } = await supabase
          .from("cart_items")
          .select("product_id, quantity")
          .eq("user_id", userId);
        if (error) {
          set({ loading: false, remoteError: error.message });
          return false;
        }
        set({
          remoteLines: (data ?? []).map((r: { product_id: string; quantity: number }) => ({
            productId: r.product_id,
            quantity: r.quantity,
          })),
          loading: false,
          remoteLoaded: true,
          remoteError: null,
          loadedUserId: userId,
        });
        return true;
      },

      mergeGuestIntoRemote: async (userId) => {
        const { guestLines, merging } = get();
        if (merging) return;
        if (guestLines.length === 0) {
          await get().loadRemote(userId);
          return;
        }
        set({ merging: true });
        try {
          const supabase = createClient();
          // Coalesce guest entries by product UUID first — persisted
          // localStorage may contain duplicates from an older schema.
          const guestQty = new Map<string, number>();
          for (const g of guestLines) {
            const qty = Math.max(1, Math.min(99, g.quantity));
            guestQty.set(g.productId, Math.min(99, (guestQty.get(g.productId) ?? 0) + qty));
          }
          // Remote cart is authoritative: lines the user already has are
          // SKIPPED (ignoreDuplicates → ON CONFLICT DO NOTHING), never
          // quantity-stacked. Only products missing from the remote cart
          // are inserted with their guest quantity.
          const toMerge = [...guestQty.entries()].map(([productId, quantity]) => ({
            user_id: userId,
            product_id: productId,
            quantity,
          }));
          if (toMerge.length > 0) {
            const { error } = await supabase
              .from("cart_items")
              .upsert(toMerge, { onConflict: "user_id,product_id", ignoreDuplicates: true });
            if (error) throw error;
          }
          // Authoritative reload BEFORE clearing guest state — if the reload
          // fails, the guest cart must survive so no local data is lost.
          const loaded = await get().loadRemote(userId);
          if (!loaded) {
            set({ merging: false });
            throw new Error("cart synchronization reload failed");
          }
          set({ guestLines: [], merging: false });
        } catch (e) {
          set({ merging: false });
          throw e;
        }
      },

      resetForSignOut: () =>
        set({
          remoteLines: [],
          loading: false,
          remoteLoaded: false,
          remoteError: null,
          merging: false,
          loadedUserId: null,
        }),
    }),
    {
      name: "fusion-cart",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ guestLines: state.guestLines }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

export function useCartLines() {
  const { user } = useAuthContext();
  const guestLines = useCart((s) => s.guestLines);
  const remoteLines = useCart((s) => s.remoteLines);
  const hydrated = useCart((s) => s.hydrated);
  const loading = useCart((s) => s.loading);
  const remoteLoaded = useCart((s) => s.remoteLoaded);
  const remoteError = useCart((s) => s.remoteError);
  const userId = user?.id ?? null;

  // When auth transitions from guest → authenticated, keep showing guest data
  // until remote data is loaded. This prevents a skeleton flash while the
  // AuthProvider triggers loadRemote/mergeGuestIntoRemote in the background.
  const useRemote = !!user && remoteLoaded;

  return {
    // During transition, keep showing guest data so the cart doesn't go blank.
    // Once remoteLoaded, switch to remote data.
    lines: useRemote ? remoteLines : guestLines,
    // During transition, ready is gated on hydrated (guest rehydration).
    // Once remoteLoaded, ready = true.
    ready: useRemote ? true : hydrated,
    loading: useRemote ? loading : false,
    error: useRemote ? remoteError : null,
    userId,
  };
}

/** Check whether a specific product is already in the cart. */
export function useProductInCart(productId: string): boolean {
  const { user } = useAuthContext();
  const guestLines = useCart((s) => s.guestLines);
  const remoteLines = useCart((s) => s.remoteLines);
  const remoteLoaded = useCart((s) => s.remoteLoaded);
  const useRemote = !!user && remoteLoaded;
  const lines = useRemote ? remoteLines : guestLines;
  return lines.some((l) => l.productId === productId);
}
