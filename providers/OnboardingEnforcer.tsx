"use client";

/**
 * OnboardingEnforcer — root-level enforcement of account setup completion.
 *
 * Consumes centralized AuthContext. Does NOT independently call getSession,
 * getUser, or register auth listeners.
 *
 * During auth bootstrap or when onboarding is complete, renders nothing —
 * the application remains fully visible behind it.
 *
 * When authenticated + onboarding incomplete, fetches the profile once and
 * renders the OnboardingFlow inline, blocking navigation until completed.
 */

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";
import { OnboardingFlow } from "@/components/account/OnboardingFlow";
import type { Profile } from "@/modules/account";

export function OnboardingEnforcer() {
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

  // During bootstrap, when unauthenticated, or when onboarding is complete —
  // render nothing. The application behind this component stays visible.
  if (authState === "initializing" || onboardingState === "resolving") return null;
  if (authState === "unauthenticated" || !user) return null;
  if (onboardingState === "incomplete" && needsProfile && profile) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div className="w-full max-w-[480px] px-4">
          <div className="rounded-xl border border-border bg-card p-6 shadow-sm sm:p-8">
            <OnboardingFlow
              profile={profile}
              onComplete={() => user && fetchProfile(user.id)}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}
