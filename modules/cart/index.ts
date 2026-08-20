"use client";

/**
 * Cart store — supports both guest (localStorage) and authenticated (Supabase)
 * users with automatic guest-to-account merge on sign-in.
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

export type GuestCartLine = {
  slug: string;
  variant: string;
  quantity: number;
};

type CartState = {
  guestLines: GuestCartLine[];
  remoteLines: GuestCartLine[];
  hydrated: boolean;
  loading: boolean;
  remoteLoaded: boolean;
  remoteError: string | null;
  merging: boolean;
  loadedUserId: string | null;

  add: (line: GuestCartLine, userId: string | null) => Promise<void>;
  setQuantity: (key: string, quantity: number, userId: string | null) => Promise<void>;
  remove: (key: string, userId: string | null) => Promise<void>;
  clearGuest: () => void;
  setHydrated: (v: boolean) => void;
  loadRemote: (userId: string) => Promise<void>;
  mergeGuestIntoRemote: (userId: string) => Promise<void>;
  resetForSignOut: () => void;
};

function lineKey(slug: string, variant: string) {
  return variant ? `${slug}::${variant}` : slug;
}

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
        if (userId) {
          const supabase = createClient();
          const { error } = await supabase
            .from("cart_items")
            .upsert(
              {
                user_id: userId,
                product_slug: line.slug,
                variant_id: line.variant || "",
                quantity: line.quantity,
              },
              { onConflict: "user_id,product_slug,variant_id" }
            );
          if (error) throw error;
          await get().loadRemote(userId);
        } else {
          set((state) => {
            const key = lineKey(line.slug, line.variant);
            const existing = state.guestLines.find(
              (l) => lineKey(l.slug, l.variant) === key
            );
            if (existing) {
              return {
                guestLines: state.guestLines.map((l) =>
                  lineKey(l.slug, l.variant) === key
                    ? { ...l, quantity: l.quantity + line.quantity }
                    : l
                ),
              };
            }
            return { guestLines: [...state.guestLines, line] };
          });
        }
      },

      setQuantity: async (key, quantity, userId) => {
        if (quantity < 1) return;
        if (userId) {
          const [slug, variant] = key.split("::");
          const supabase = createClient();
          const { error } = await supabase
            .from("cart_items")
            .update({ quantity })
            .eq("user_id", userId)
            .eq("product_slug", slug)
            .eq("variant_id", variant ?? "");
          if (error) throw error;
          await get().loadRemote(userId);
        } else {
          set((state) => ({
            guestLines: state.guestLines
              .map((l) =>
                lineKey(l.slug, l.variant) === key
                  ? { ...l, quantity: Math.max(0, quantity) }
                  : l
              )
              .filter((l) => l.quantity > 0),
          }));
        }
      },

      remove: async (key, userId) => {
        if (userId) {
          const [slug, variant] = key.split("::");
          const supabase = createClient();
          const { error } = await supabase
            .from("cart_items")
            .delete()
            .eq("user_id", userId)
            .eq("product_slug", slug)
            .eq("variant_id", variant ?? "");
          if (error) throw error;
          await get().loadRemote(userId);
        } else {
          set((state) => ({
            guestLines: state.guestLines.filter(
              (l) => lineKey(l.slug, l.variant) !== key
            ),
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
          .select("product_slug, variant_id, quantity")
          .eq("user_id", userId);
        if (error) {
          set({ loading: false, remoteError: error.message });
          return;
        }
        set({
          remoteLines: (data ?? []).map((r: { product_slug: string; variant_id: string; quantity: number }) => ({
            slug: r.product_slug,
            variant: r.variant_id || "",
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
        // If no guest items, skip merge but still load remote data
        if (guestLines.length === 0) {
          await get().loadRemote(userId);
          return;
        }
        set({ merging: true });
        try {
          const supabase = createClient();
          const { data: existing } = await supabase
            .from("cart_items")
            .select("product_slug, variant_id, quantity")
            .eq("user_id", userId);
          const existingMap = new Map(
            (existing ?? []).map((r: { product_slug: string; variant_id: string; quantity: number }) => [
              lineKey(r.product_slug, r.variant_id || ""),
              r.quantity,
            ])
          );
          const merged = guestLines.map((g) => {
            const key = lineKey(g.slug, g.variant);
            const accountQty = existingMap.get(key) ?? 0;
            return {
              user_id: userId,
              product_slug: g.slug,
              variant_id: g.variant || "",
              quantity: Math.min(99, accountQty + g.quantity),
            };
          });
          if (merged.length > 0) {
            const { error } = await supabase
              .from("cart_items")
              .upsert(merged, { onConflict: "user_id,product_slug,variant_id" });
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

  // loadRemote is triggered by AuthProvider (single source), not here.
  // This hook is a pure consumer of cart state.
  return {
    lines: user ? remoteLines : guestLines,
    ready: user ? remoteLoaded : hydrated,
    loading: user ? loading : false,
    error: user ? remoteError : null,
    userId,
  };
}
