"use client";

/**
 * RouteGuard — root-level client route-access policy.
 *
 * Wraps {children} in the root layout. Reads AuthContext synchronously.
 * For forbidden routes, returns null (preventing page render) and
 * triggers router.replace() to the correct destination.
 *
 * Policy:
 *   - auth initializing / onboarding resolving → render children (no enforcement)
 *   - unauthenticated → render children (normal public/auth access)
 *   - authenticated + auth-only route → null + replace("/")
 *   - authenticated + incomplete + not /account/onboarding → null + replace(/account/onboarding)
 *   - authenticated + incomplete + /account/onboarding → render children
 *   - authenticated + complete + /account/onboarding → null + replace("/")
 *   - otherwise → render children
 *
 * Does NOT modify AuthProvider. Consumes existing context only.
 */

import { useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuthContext } from "@/providers/AuthProvider";

const AUTH_ONLY_ROUTES = new Set([
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot-password",
]);

const ONBOARDING_PATH = "/account/onboarding";

function isSafeReturnTo(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//");
}

export function RouteGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, state: authState, onboardingState } = useAuthContext();
  const navigatedRef = useRef<string | null>(null);

  // ── DETERMINE IF ROUTE IS ALLOWED ─────────────────────────────────────
  const isAllowed = (() => {
    // During bootstrap or resolving — allow rendering, no enforcement.
    if (authState === "initializing" || onboardingState === "resolving") return true;

    // Unauthenticated — normal public/auth page access.
    if (authState === "unauthenticated" || !user) return true;

    // Authenticated + auth-only route → NOT allowed.
    if (AUTH_ONLY_ROUTES.has(pathname)) return false;

    // Authenticated + incomplete + on /account/onboarding → allowed.
    if (onboardingState === "incomplete" && pathname === ONBOARDING_PATH) return true;

    // Authenticated + incomplete + NOT on /account/onboarding → NOT allowed.
    if (onboardingState === "incomplete") return false;

    // Authenticated + complete + on /account/onboarding → NOT allowed.
    if (onboardingState === "complete" && pathname === ONBOARDING_PATH) return false;

    // Everything else allowed.
    return true;
  })();

  // ── NAVIGATION SIDE EFFECT ────────────────────────────────────────────
  // Runs after render. For forbidden routes, replace to the correct destination.
  useEffect(() => {
    if (isAllowed) {
      // Reset guard when route becomes allowed.
      navigatedRef.current = null;
      return;
    }

    // Prevent repeated navigation for the same path.
    if (navigatedRef.current === pathname) return;
    navigatedRef.current = pathname;

    // Auth-only route → go home.
    if (AUTH_ONLY_ROUTES.has(pathname)) {
      router.replace("/");
      return;
    }

    // Authenticated + incomplete + not on onboarding → go to onboarding.
    if (authState === "authenticated" && onboardingState === "incomplete" && pathname !== ONBOARDING_PATH) {
      const returnTo = isSafeReturnTo(pathname) ? pathname : "/";
      router.replace(`${ONBOARDING_PATH}?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }

    // Authenticated + complete + on onboarding → go home.
    if (authState === "authenticated" && onboardingState === "complete" && pathname === ONBOARDING_PATH) {
      router.replace("/");
      return;
    }
  }, [isAllowed, authState, onboardingState, pathname, router]);

  // ── RENDER ────────────────────────────────────────────────────────────
  // If route is not allowed, render nothing (prevents forbidden page flash).
  if (!isAllowed) return null;

  return <>{children}</>;
}
