"use client";

/**
 * OnboardingEnforcer — root-level auth navigation + onboarding enforcement.
 *
 * TWO SEPARATE CONDITIONS:
 *
 * 1. AUTH NAVIGATION: authenticated users cannot remain on auth-only pages
 *    (login, signup, forgot-password). They are redirected to "/".
 *    Exception: /auth/reset-password is allowed (recovery session).
 *
 * 2. ONBOARDING: authenticated + onboarding incomplete → redirect to
 *    /account/onboarding. If already on that path, do nothing.
 *    Store intended destination in returnTo query param for safe redirect.
 *
 * During auth bootstrap or when unauthenticated, does nothing — the
 * application remains fully visible.
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

export function OnboardingEnforcer() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, state: authState, onboardingState } = useAuthContext();
  const navigatedRef = useRef<string | null>(null);

  // ── AUTH NAVIGATION ────────────────────────────────────────────────────
  // Authenticated users must not remain on auth-only pages.
  // Exception: /auth/reset-password (recovery session needs the page).
  useEffect(() => {
    if (authState !== "authenticated" || !user) return;
    if (AUTH_ONLY_ROUTES.has(pathname)) {
      router.replace("/");
    }
  }, [authState, user, pathname, router]);

  // ── ONBOARDING REDIRECT ────────────────────────────────────────────────
  // When authenticated + onboarding incomplete, redirect to /account/onboarding.
  // Store intended destination for return after completion.
  // Guard against repeated navigation with navigatedRef.
  useEffect(() => {
    if (authState !== "authenticated" || !user) return;
    if (onboardingState !== "incomplete") return;

    // Already on the onboarding page — do nothing.
    if (pathname === ONBOARDING_PATH) return;

    // Prevent repeated redirects for the same path.
    if (navigatedRef.current === pathname) return;
    navigatedRef.current = pathname;

    const returnTo = isSafeReturnTo(pathname) ? pathname : "/";
    router.replace(`${ONBOARDING_PATH}?returnTo=${encodeURIComponent(returnTo)}`);
  }, [authState, user, onboardingState, pathname, router]);

  // Reset the guard when onboarding completes or user signs out.
  useEffect(() => {
    if (onboardingState === "complete" || authState === "unauthenticated") {
      navigatedRef.current = null;
    }
  }, [onboardingState, authState]);

  // During bootstrap or when unauthenticated — render nothing.
  // The application behind this component stays visible.
  return null;
}
