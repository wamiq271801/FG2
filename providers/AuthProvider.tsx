"use client";

/**
 * Centralized authentication state — single source of truth for client auth.
 *
 * One coherent bootstrap:
 *   getSession → user → minimum onboarding state → ready
 *
 * One onAuthStateChange listener (no duplicate listeners).
 *
 * Auth state is set SYNCHRONOUSLY from the session — never waits for
 * cart/wishlist/profile loading (those fire independently after auth is known).
 * Session persistence handled by Supabase's built-in browser client.
 *
 * The provider publishes:
 *   user, authState, onboardingState, ready
 *
 * Components consume this context instead of independently calling
 * getSession/getUser/onAuthStateChange.
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

export type AuthState = "initializing" | "authenticated" | "unauthenticated";

export type RecoveryState = "none" | "recovering";

export type OnboardingState = "resolving" | "complete" | "incomplete" | "not-required";

type AuthContextValue = {
  user: AuthUser | null;
  state: AuthState;
  recoveryState: RecoveryState;
  onboardingState: OnboardingState;
  ready: boolean;
  refreshOnboarding: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue>({
  user: null,
  state: "initializing",
  recoveryState: "none",
  onboardingState: "resolving",
  ready: false,
  refreshOnboarding: async () => {},
});

function toAuthUser(u: User | null): AuthUser | null {
  if (!u) return null;
  return { id: u.id, email: u.email ?? "" };
}

async function fetchOnboardingState(userId: string): Promise<OnboardingState> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("onboarding_state")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return "incomplete";
  const s = (data as { onboarding_state: string }).onboarding_state;
  if (s === "complete") return "complete";
  return "incomplete";
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [state, setState] = useState<AuthState>("initializing");
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("none");
  const [onboardingState, setOnboardingState] = useState<OnboardingState>("resolving");
  const mergedForUserId = useRef<string | null>(null);
  const loadedUserId = useRef<string | null>(null);
  const recoveryStateRef = useRef<RecoveryState>("none");

  const refreshOnboarding = async () => {
    const u = user;
    if (!u) {
      setOnboardingState("not-required");
      return;
    }
    setOnboardingState("resolving");
    const result = await fetchOnboardingState(u.id);
    setOnboardingState(result);
  };

  useEffect(() => {
    let mounted = true;
    const timers: number[] = [];

    // Defer Supabase-query work until after the current auth operation
    // releases its internal storage lock. Calling supabase methods
    // synchronously inside an onAuthStateChange callback deadlocks the
    // client (the query's internal getSession() waits on the same lock),
    // which stalls cart/wishlist/orders loading until a full page refresh.
    const defer = (fn: () => void) => {
      timers.push(
        window.setTimeout(() => {
          if (mounted) fn();
        }, 0)
      );
    };

    // Identity publishing is pure React state — always synchronous so the
    // context propagates immediately, before any downstream data work.
    const publishIdentity = (u: AuthUser | null) => {
      setUser(u);
      if (!u) {
        setState("unauthenticated");
        setOnboardingState("not-required");
      } else {
        setState("authenticated");
      }
    };

    const resolveOnboardingState = (userId: string) => {
      fetchOnboardingState(userId).then((os) => {
        if (!mounted) return;
        setOnboardingState(os);
      });
    };

    // Ensure remote cart/wishlist are loaded for this user; merge guest
    // data exactly once per authentication transition.
    const ensureUserData = (userId: string) => {
      if (loadedUserId.current === userId) return;
      loadedUserId.current = userId;
      if (mergedForUserId.current !== userId) {
        mergedForUserId.current = userId;
        Promise.all([
          useCart.getState().mergeGuestIntoRemote(userId),
          useWishlist.getState().mergeGuestIntoRemote(userId),
        ]).catch(() => {
          // Merge or authoritative reload failed — reset BOTH guards so the
          // next auth/data transition can retry instead of being suppressed.
          mergedForUserId.current = null;
          loadedUserId.current = null;
        });
      } else {
        useCart.getState().loadRemote(userId).catch(() => {});
        useWishlist.getState().loadRemote(userId).catch(() => {});
      }
    };

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      const u = toAuthUser(data.session?.user ?? null);
      publishIdentity(u);
      if (u) {
        defer(() => {
          // Skip onboarding resolution if a concurrent INITIAL_SESSION
          // already handled this user.
          if (!loadedUserId.current) resolveOnboardingState(u.id);
          ensureUserData(u.id);
        });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      const u = toAuthUser(session?.user ?? null);

      // Handle PASSWORD_RECOVERY event — this fires when the user clicks a
      // recovery link and Supabase establishes a recovery session.
      // The session contains a user, but the intent is password reset, not normal auth.
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryState("recovering");
        recoveryStateRef.current = "recovering";
        // Still publish identity so the recovery session is recognized
        publishIdentity(u);
        return;
      }

      // Clear recovery state on any other auth event (except TOKEN_REFRESHED)
      if (recoveryStateRef.current === "recovering" && event !== "TOKEN_REFRESHED") {
        setRecoveryState("none");
        recoveryStateRef.current = "none";
      }

      // 1) Publish identity IMMEDIATELY — Header, AccountGate, review
      //    controls etc. re-render from context without waiting for any
      //    downstream data (cart/wishlist/orders/profile/onboarding).
      publishIdentity(u);

      if (!u) {
        if (event === "SIGNED_OUT") {
          // Local-only reset — no Supabase calls, safe synchronously.
          loadedUserId.current = null;
          mergedForUserId.current = null;
          useCart.getState().resetForSignOut();
          useWishlist.getState().resetForSignOut();
        }
        return;
      }

      // 2) Data work happens OUTSIDE the auth-event callback.
      //    - SIGNED_IN / INITIAL_SESSION: one-time merge/load (ref-guarded)
      //      plus onboarding resolution.
      //    - USER_UPDATED: profile-affecting → re-resolve onboarding.
      //    - TOKEN_REFRESHED: identity already published; no data work.
      if (event === "TOKEN_REFRESHED") return;
      defer(() => {
        if (event === "USER_UPDATED" || !loadedUserId.current) {
          resolveOnboardingState(u.id);
        }
        if (
          (event === "SIGNED_IN" || event === "INITIAL_SESSION") &&
          loadedUserId.current !== u.id
        ) {
          ensureUserData(u.id);
        }
      });
    });

    return () => {
      mounted = false;
      timers.forEach((t) => window.clearTimeout(t));
      sub.subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      state,
      recoveryState,
      onboardingState,
      ready: state !== "initializing",
      refreshOnboarding,
    }),
    [user, state, recoveryState, onboardingState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  return useContext(AuthContext);
}
