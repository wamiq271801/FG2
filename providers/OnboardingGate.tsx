"use client";

/**
 * OnboardingGate — global enforcement of account setup completion.
 *
 * Sits inside AuthProvider. When the authenticated user's persisted
 * onboarding_state is not "complete", renders OnboardingFlow instead of the
 * normal application. No route, redirect, or page-level check required.
 *
 * State machine:
 *   AUTH initializing  → render nothing (skeleton)
 *   AUTH unauthenticated → render children normally
 *   AUTH authenticated
 *     → onboarding resolving (profile not yet loaded) → skeleton
 *     → onboarding_state = incomplete      → OnboardingFlow Step 1
 *     → onboarding_state = address_optional → OnboardingFlow Step 2
 *     → onboarding_state = complete         → render children normally
 *
 * The profile is re-fetched after each onboarding step save so the gate
 * automatically advances (or clears) based on the persisted DB state.
 * This correctly handles browser-close/resume across sessions.
 */

import { useEffect, useState, useCallback } from "react";
import { Link } from "@/components/shared/Link";
import { ShieldCheck } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";
import { OnboardingFlow } from "@/components/account/OnboardingFlow";
import type { Profile } from "@/modules/account";

type GateState = "resolving" | "incomplete" | "address_optional" | "complete";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const { user, state: authState } = useAuthContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [gateState, setGateState] = useState<GateState>("resolving");

  const fetchProfile = useCallback(async (userId: string) => {
    setGateState("resolving");
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    const p = data as Profile | null;
    setProfile(p);
    if (!p || p.onboarding_state === "incomplete") {
      setGateState("incomplete");
    } else if (p.onboarding_state === "address_optional") {
      setGateState("address_optional");
    } else {
      setGateState("complete");
    }
  }, []);

  useEffect(() => {
    if (authState === "initializing") return;
    if (authState === "unauthenticated" || !user) {
      setProfile(null);
      setGateState("complete"); // unauthenticated → no gate, render normally
      return;
    }
    fetchProfile(user.id);
  }, [authState, user, fetchProfile]);

  // Auth still initializing — render nothing to avoid flashing incorrect state
  if (authState === "initializing") {
    return null;
  }

  // Authenticated but profile not yet loaded — render nothing briefly
  if (authState === "authenticated" && gateState === "resolving") {
    return null;
  }

  // Onboarding required — render the onboarding shell instead of the app
  if (gateState === "incomplete" || gateState === "address_optional") {
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
            {profile && (
              <OnboardingFlow
                profile={profile}
                onComplete={() => user && fetchProfile(user.id)}
              />
            )}
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

  // complete or unauthenticated — render normally
  return <>{children}</>;
}
