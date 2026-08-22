"use client";

/**
 * Wishlist store — supports both guest (localStorage) and authenticated
 * (Supabase) users with automatic guest-to-account merge on sign-in.
 *
 * Phase 12: wishlist_items.product_id is a UUID FK (product_slug was dropped
 * in Phase 3). The store identifies items by product UUID, not slug.
 * Slug is carried for display/navigation only — it is never the identity key.
 *
 * State:
 *   Guest:   productIds in localStorage (hydrated → ready)
 *   Authed:  product UUIDs from Supabase (remoteLoaded → ready)
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";

type WishlistState = {
  /** Guest wishlist: array of product UUIDs */
  guestIds: string[];
  /** Remote wishlist: array of product UUIDs */
  remoteIds: string[];
  hydrated: boolean;
  loading: boolean;
  remoteLoaded: boolean;
  remoteError: string | null;
  merging: boolean;
  loadedUserId: string | null;

  toggle: (productId: string, userId: string | null) => Promise<void>;
  has: (productId: string, userId: string | null) => boolean;
  remove: (productId: string, userId: string | null) => Promise<void>;
  clearGuest: () => void;
  setHydrated: (v: boolean) => void;
  loadRemote: (userId: string) => Promise<void>;
  mergeGuestIntoRemote: (userId: string) => Promise<void>;
  resetForSignOut: () => void;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      guestIds: [],
      remoteIds: [],
      hydrated: false,
      loading: false,
      remoteLoaded: false,
      remoteError: null,
      merging: false,
      loadedUserId: null,

      toggle: async (productId, userId) => {
        if (userId) {
          const supabase = createClient();
          const exists = get().remoteIds.includes(productId);
          if (exists) {
            const { error } = await supabase
              .from("wishlist_items")
              .delete()
              .eq("user_id", userId)
              .eq("product_id", productId);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("wishlist_items")
              .insert({ user_id: userId, product_id: productId });
            if (error) throw error;
          }
          await get().loadRemote(userId);
        } else {
          set((state) => {
            if (state.guestIds.includes(productId)) {
              return { guestIds: state.guestIds.filter((id) => id !== productId) };
            }
            return { guestIds: [...state.guestIds, productId] };
          });
        }
      },

      has: (productId, userId) => {
        const state = get();
        return userId
          ? state.remoteIds.includes(productId)
          : state.guestIds.includes(productId);
      },

      remove: async (productId, userId) => {
        if (userId) {
          const supabase = createClient();
          const { error } = await supabase
            .from("wishlist_items")
            .delete()
            .eq("user_id", userId)
            .eq("product_id", productId);
          if (error) throw error;
          await get().loadRemote(userId);
        } else {
          set((state) => ({
            guestIds: state.guestIds.filter((id) => id !== productId),
          }));
        }
      },

      clearGuest: () => set({ guestIds: [] }),
      setHydrated: (v) => set({ hydrated: v }),

      loadRemote: async (userId) => {
        set({ loading: true, remoteError: null });
        const supabase = createClient();
        const { data, error } = await supabase
          .from("wishlist_items")
          .select("product_id")
          .eq("user_id", userId);
        if (error) {
          set({ loading: false, remoteError: error.message });
          return;
        }
        set({
          remoteIds: (data ?? []).map((r: { product_id: string }) => r.product_id),
          loading: false,
          remoteLoaded: true,
          remoteError: null,
          loadedUserId: userId,
        });
      },

      mergeGuestIntoRemote: async (userId) => {
        const { guestIds, merging } = get();
        if (merging) return;
        if (guestIds.length === 0) {
          await get().loadRemote(userId);
          return;
        }
        set({ merging: true });
        try {
          const supabase = createClient();
          const toInsert = guestIds.map((productId) => ({
            user_id: userId,
            product_id: productId,
          }));
          if (toInsert.length > 0) {
            const { error } = await supabase
              .from("wishlist_items")
              .upsert(toInsert, { onConflict: "user_id,product_id", ignoreDuplicates: true });
            if (error) throw error;
          }
          set({ guestIds: [], merging: false });
          await get().loadRemote(userId);
        } catch (e) {
          set({ merging: false });
          throw e;
        }
      },

      resetForSignOut: () =>
        set({
          remoteIds: [],
          loading: false,
          remoteLoaded: false,
          remoteError: null,
          merging: false,
          loadedUserId: null,
        }),
    }),
    {
      name: "fusion-wishlist",
      storage: createJSONStorage(() => localStorage),
      // Persist guest UUIDs; remote state is always reloaded from Supabase on sign-in
      partialize: (state) => ({ guestIds: state.guestIds }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

export function useWishlistIds() {
  const { user } = useAuthContext();
  const guestIds    = useWishlist((s) => s.guestIds);
  const remoteIds   = useWishlist((s) => s.remoteIds);
  const hydrated    = useWishlist((s) => s.hydrated);
  const loading     = useWishlist((s) => s.loading);
  const remoteLoaded = useWishlist((s) => s.remoteLoaded);
  const remoteError  = useWishlist((s) => s.remoteError);
  const userId = user?.id ?? null;

  return {
    ids:    user ? remoteIds : guestIds,
    ready:  user ? remoteLoaded : hydrated,
    loading: user ? loading : false,
    error:  user ? remoteError : null,
    userId,
  };
}
