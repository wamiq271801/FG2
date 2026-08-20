"use client";

/**
 * Centralized authentication state — single source of truth for auth identity.
 *
 * - One `onAuthStateChange` listener (no duplicate listeners)
 * - Distinguishes AUTH_INITIALIZING / AUTHENTICATED / UNAUTHENTICATED
 * - Auth state is set SYNCHRONOUSLY from the session — never waits for
 *   cart/wishlist/profile loading (those fire independently after auth is known)
 * - Session persistence handled by Supabase's built-in browser client
 */

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { useCart } from "@/modules/cart";
import { useWishlist } from "@/modules/wishlist";

export type AuthUser = {
  id: string;
  email: string;
};

type AuthState = "initializing" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  user: AuthUser | null;
  state: AuthState;
  ready: boolean;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  state: "initializing",
  ready: false,
});

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return { id: u.id, email: u.email ?? "" };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<AuthState>("initializing");
  const mergedForUserId = useRef<string | null>(null);
  const loadedUserId = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    // Restore persisted session — getSession() reads from local storage.
    // This is synchronous from a storage perspective, but Supabase may
    // trigger a token refresh network call if the token is near expiry.
    // We set auth state from whatever getSession returns immediately.
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const u = toAuthUser(data.session?.user ?? null);
      setUser(u);
      setState(u ? "authenticated" : "unauthenticated");

      // Fire cart/wishlist load independently (non-blocking)
      if (u && loadedUserId.current !== u.id) {
        loadedUserId.current = u.id;
        useCart.getState().loadRemote(u.id).catch(() => {});
        useWishlist.getState().loadRemote(u.id).catch(() => {});
      }
    });

    // Single centralized auth state listener.
    // IMPORTANT: the callback is NOT async — auth state is set synchronously
    // from the session object. Cart/wishlist/merge operations are fired
    // as non-blocking background promises.
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const u = toAuthUser(session?.user ?? null);

      // Set auth state IMMEDIATELY — no awaiting before this point
      setUser(u);
      setState(u ? "authenticated" : "unauthenticated");

      // Handle auth transitions as background work (non-blocking)
      if (event === "SIGNED_IN" && u && loadedUserId.current !== u.id) {
        loadedUserId.current = u.id;
        if (mergedForUserId.current !== u.id) {
          mergedForUserId.current = u.id;
          // Merge guest data — non-blocking, runs independently
          Promise.all([
            useCart.getState().mergeGuestIntoRemote(u.id),
            useWishlist.getState().mergeGuestIntoRemote(u.id),
          ]).catch(() => {
            mergedForUserId.current = null;
          });
        } else {
          useCart.getState().loadRemote(u.id).catch(() => {});
          useWishlist.getState().loadRemote(u.id).catch(() => {});
        }
      }

      if (event === "SIGNED_OUT") {
        loadedUserId.current = null;
        mergedForUserId.current = null;
        useCart.getState().resetForSignOut();
        useWishlist.getState().resetForSignOut();
      }
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: state === "initializing" ? null : user,
      state,
      ready: state !== "initializing",
    }),
    [user, state]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
