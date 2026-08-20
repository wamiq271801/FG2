"use client";

/**
 * Wishlist store — supports both guest (localStorage) and authenticated
 * (Supabase) users with automatic guest-to-account merge on sign-in.
 *
 * State machine:
 *   Guest:   hydrated (localStorage rehydrated) → ready
 *   Authed:  remoteLoaded (Supabase query completed) → ready
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";

type WishlistState = {
  guestSlugs: string[];
  remoteSlugs: string[];
  hydrated: boolean;
  loading: boolean;
  remoteLoaded: boolean;
  remoteError: string | null;
  merging: boolean;
  loadedUserId: string | null;

  toggle: (slug: string, userId: string | null) => Promise<void>;
  has: (slug: string, userId: string | null) => boolean;
  remove: (slug: string, userId: string | null) => Promise<void>;
  clearGuest: () => void;
  setHydrated: (v: boolean) => void;
  loadRemote: (userId: string) => Promise<void>;
  mergeGuestIntoRemote: (userId: string) => Promise<void>;
  resetForSignOut: () => void;
};

export const useWishlist = create<WishlistState>()(
  persist(
    (set, get) => ({
      guestSlugs: [],
      remoteSlugs: [],
      hydrated: false,
      loading: false,
      remoteLoaded: false,
      remoteError: null,
      merging: false,
      loadedUserId: null,

      toggle: async (slug, userId) => {
        if (userId) {
          const supabase = createClient();
          const exists = get().remoteSlugs.includes(slug);
          if (exists) {
            const { error } = await supabase
              .from("wishlist_items")
              .delete()
              .eq("user_id", userId)
              .eq("product_slug", slug);
            if (error) throw error;
          } else {
            const { error } = await supabase
              .from("wishlist_items")
              .insert({ user_id: userId, product_slug: slug });
            if (error) throw error;
          }
          await get().loadRemote(userId);
        } else {
          set((state) => {
            if (state.guestSlugs.includes(slug)) {
              return { guestSlugs: state.guestSlugs.filter((s) => s !== slug) };
            }
            return { guestSlugs: [...state.guestSlugs, slug] };
          });
        }
      },

      has: (slug, userId) => {
        const state = get();
        return userId ? state.remoteSlugs.includes(slug) : state.guestSlugs.includes(slug);
      },

      remove: async (slug, userId) => {
        if (userId) {
          const supabase = createClient();
          const { error } = await supabase
            .from("wishlist_items")
            .delete()
            .eq("user_id", userId)
            .eq("product_slug", slug);
          if (error) throw error;
          await get().loadRemote(userId);
        } else {
          set((state) => ({ guestSlugs: state.guestSlugs.filter((s) => s !== slug) }));
        }
      },

      clearGuest: () => set({ guestSlugs: [] }),
      setHydrated: (v) => set({ hydrated: v }),

      loadRemote: async (userId) => {
        set({ loading: true, remoteError: null });
        const supabase = createClient();
        const { data, error } = await supabase
          .from("wishlist_items")
          .select("product_slug")
          .eq("user_id", userId);
        if (error) {
          set({ loading: false, remoteError: error.message });
          return;
        }
        set({
          remoteSlugs: (data ?? []).map((r: { product_slug: string }) => r.product_slug),
          loading: false,
          remoteLoaded: true,
          remoteError: null,
          loadedUserId: userId,
        });
      },

      mergeGuestIntoRemote: async (userId) => {
        const { guestSlugs, merging } = get();
        if (merging) return;
        // If no guest items, skip merge but still load remote data
        if (guestSlugs.length === 0) {
          await get().loadRemote(userId);
          return;
        }
        set({ merging: true });
        try {
          const supabase = createClient();
          const toInsert = guestSlugs.map((slug) => ({
            user_id: userId,
            product_slug: slug,
          }));
          if (toInsert.length > 0) {
            const { error } = await supabase
              .from("wishlist_items")
              .upsert(toInsert, { onConflict: "user_id,product_slug", ignoreDuplicates: true });
            if (error) throw error;
          }
          set({ guestSlugs: [], merging: false });
          await get().loadRemote(userId);
        } catch (e) {
          set({ merging: false });
          throw e;
        }
      },

      resetForSignOut: () =>
        set({
          remoteSlugs: [],
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
      partialize: (state) => ({ guestSlugs: state.guestSlugs }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated(true);
      },
    }
  )
);

export function useWishlistSlugs() {
  const { user } = useAuthContext();
  const guestSlugs = useWishlist((s) => s.guestSlugs);
  const remoteSlugs = useWishlist((s) => s.remoteSlugs);
  const hydrated = useWishlist((s) => s.hydrated);
  const loading = useWishlist((s) => s.loading);
  const remoteLoaded = useWishlist((s) => s.remoteLoaded);
  const remoteError = useWishlist((s) => s.remoteError);
  const userId = user?.id ?? null;

  // loadRemote is triggered by AuthProvider (single source), not here.
  // This hook is a pure consumer of wishlist state.
  return {
    slugs: user ? remoteSlugs : guestSlugs,
    ready: user ? remoteLoaded : hydrated,
    loading: user ? loading : false,
    error: user ? remoteError : null,
    userId,
  };
}
