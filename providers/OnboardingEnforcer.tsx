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
 * 2. ONBOARDING: authenticated + onboarding incomplete → existing onboarding
 *    dialog opens automatically. User remains on current page.
 *
 * Consumes centralized AuthContext. Does NOT independently call getSession,
 * getUser, or register auth listeners.
 *
 * During auth bootstrap or when unauthenticated, does nothing — the
 * application remains fully visible.
 */

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";
import { OnboardingFlow } from "@/components/account/OnboardingFlow";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import type { Profile } from "@/modules/account";

/** Pages whose sole purpose is unauthenticated authentication. */
const AUTH_ONLY_ROUTES = new Set([
  "/auth/signin",
  "/auth/signup",
  "/auth/forgot-password",
]);

export function OnboardingEnforcer() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, state: authState, onboardingState } = useAuthContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  // ── AUTH NAVIGATION ────────────────────────────────────────────────────
  // Authenticated users must not remain on auth-only pages.
  // Exception: /auth/reset-password (recovery session needs the page).
  useEffect(() => {
    if (authState !== "authenticated" || !user) return;
    if (AUTH_ONLY_ROUTES.has(pathname)) {
      router.replace("/");
    }
  }, [authState, user, pathname, router]);

  // ── ONBOARDING ─────────────────────────────────────────────────────────
  // When authenticated + onboarding incomplete, fetch profile and open dialog.
  // When complete or unauthenticated, close dialog.
  useEffect(() => {
    if (authState === "initializing") return;
    if (authState === "unauthenticated" || !user) {
      setProfile(null);
      setDialogOpen(false);
      return;
    }
    if (onboardingState === "incomplete") {
      fetchProfile(user.id).then(() => setDialogOpen(true));
    } else {
      setProfile(null);
      setDialogOpen(false);
    }
  }, [authState, user, onboardingState, fetchProfile]);

  // ── RENDER ─────────────────────────────────────────────────────────────
  // During bootstrap or when unauthenticated — render nothing.
  // The application behind this component stays visible.
  if (authState === "initializing" || onboardingState === "resolving") return null;
  if (authState === "unauthenticated" || !user) return null;

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-[480px] p-0">
        {profile && (
          <div className="p-6 sm:p-8">
            <OnboardingFlow
              profile={profile}
              onComplete={() => {
                user && fetchProfile(user.id);
                setDialogOpen(false);
              }}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
