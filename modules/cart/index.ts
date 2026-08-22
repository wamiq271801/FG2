"use client";

/**
 * Cart store — supports both guest (localStorage) and authenticated (Supabase)
 * users with automatic guest-to-account merge on sign-in.
 *
 * Every cart line identifies the actual sellable product by its UUID.
 * The slug is carried for display/lookup only.
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
  /** Actual product UUID — the sellable unit. */
  productId: string;
  /**
   * Product slug — carried for display purposes only.
   * NOT used as the cart identity — productId is the identity.
   */
  slug: string;
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

  add: (line: CartLine, userId: string | null) => Promise<void>;
  setQuantity: (productId: string, quantity: number, userId: string | null) => Promise<void>;
  remove: (productId: string, userId: string | null) => Promise<void>;
  clearGuest: () => void;
  setHydrated: (v: boolean) => void;
  loadRemote: (userId: string) => Promise<void>;
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
        const safeLines: CartLine = { ...line, quantity: qty };

        if (userId) {
          const supabase = createClient();
          const { error } = await supabase
            .from("cart_items")
            .upsert(
              { user_id: userId, product_id: safeLines.productId, quantity: safeLines.quantity },
              { onConflict: "user_id,product_id" }
            );
          if (error) throw error;
          await get().loadRemote(userId);
        } else {
          set((state) => {
            const existing = state.guestLines.find((l) => l.productId === safeLines.productId);
            if (existing) {
              return {
                guestLines: state.guestLines.map((l) =>
                  l.productId === safeLines.productId
                    ? { ...l, quantity: Math.min(99, l.quantity + safeLines.quantity) }
                    : l
                ),
              };
            }
            return { guestLines: [...state.guestLines, safeLines] };
          });
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
          .select("product_id, quantity, product:products!fk_cart_items_product_id(slug)")
          .eq("user_id", userId);
        if (error) {
          set({ loading: false, remoteError: error.message });
          return;
        }
        set({
          remoteLines: (data ?? []).map((r: {
            product_id: string;
            quantity: number;
            product: { slug: string }[] | null;
          }) => ({
            productId: r.product_id,
            slug: r.product?.[0]?.slug ?? "",
            quantity: r.quantity,
          })),
          loading: false,
          remoteLoaded: true,
          remoteError: null,
          loadedUserId: userId,
        });
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
          const { data: existing } = await supabase
            .from("cart_items")
            .select("product_id, quantity")
            .eq("user_id", userId);
          const existingMap = new Map<string, number>(
            (existing ?? []).map((r: { product_id: string; quantity: number }) => [
              r.product_id,
              r.quantity,
            ])
          );
          const merged = guestLines.map((g) => ({
            user_id: userId,
            product_id: g.productId,
            quantity: Math.min(99, (existingMap.get(g.productId) ?? 0) + g.quantity),
          }));
          if (merged.length > 0) {
            const { error } = await supabase
              .from("cart_items")
              .upsert(merged, { onConflict: "user_id,product_id" });
            if (error) throw error;
          }
          set({ guestLines: [], merging: false });
          await get().loadRemote(userId);
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

  return {
    lines: user ? remoteLines : guestLines,
    ready: user ? remoteLoaded : hydrated,
    loading: user ? loading : false,
    error: user ? remoteError : null,
    userId,
  };
}
