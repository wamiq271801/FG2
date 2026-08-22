"use client";

/**
 * OnboardingGate — route-level enforcement of account setup completion.
 *
 * Consumes centralized AuthContext. Does NOT independently call getSession,
 * getUser, or register auth listeners.
 *
 * NEVER returns null during initialization. During auth bootstrap, renders
 * children so public content remains visible.
 *
 * Usage: wrap only routes that genuinely require completed onboarding.
 *
 *   <OnboardingGate>
 *     {children}
 *   </OnboardingGate>
 *
 * Public pages (Home, Shop, Product, Search, etc.) must NOT use this gate.
 */

import { useEffect, useState, useCallback } from "react";
import { Link } from "@/components/shared/Link";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";
import { OnboardingFlow } from "@/components/account/OnboardingFlow";
import type { Profile } from "@/modules/account";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, state: authState, onboardingState } = useAuthContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [needsProfile, setNeedsProfile] = useState(false);

  const fetchProfile = useCallback(async (userId: string) => {
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    setProfile(data as Profile | null);
  }, []);

  useEffect(() => {
    if (authState === "initializing") return;
    if (authState === "unauthenticated" || !user) {
      setProfile(null);
      setNeedsProfile(false);
      return;
    }
    if (onboardingState === "incomplete") {
      setNeedsProfile(true);
      fetchProfile(user.id);
    } else {
      setProfile(null);
      setNeedsProfile(false);
    }
  }, [authState, user, onboardingState, fetchProfile]);

  if (authState === "initializing" || onboardingState === "resolving") {
    return <>{children}</>;
  }

  if (authState === "unauthenticated" || !user) {
    return <>{children}</>;
  }

  if (onboardingState === "incomplete" && needsProfile && profile) {
    return (
      <div className="relative isolate flex min-h-screen items-center justify-center px-4 py-12 sm:py-16">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_50%_-10%,oklch(0.96_0.02_55/0.6),transparent_60%)]"
        />
        <div className="w-full max-w-[480px]">
          <div className="flex justify-center">
            <Link
              href="/"
              className="font-display text-2xl font-medium tracking-tight"
              aria-label="Fusion Gadgets home"
            >
              Fusion<span className="text-copper">.</span>
            </Link>
          </div>
          <div className="mt-8 rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <OnboardingFlow
              profile={profile}
              onComplete={() => user && fetchProfile(user.id)}
            />
          </div>
          <div className="mt-6 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-copper" />
            <span>
              By continuing you accept our{" "}
              <Link href="/terms" className="underline hover:text-foreground">
                Terms
              </Link>{" "}
              ·{" "}
              <Link href="/privacy" className="underline hover:text-foreground">
                Privacy
              </Link>
            </span>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
