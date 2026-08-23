"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";
import { OnboardingFlow } from "@/components/account/OnboardingFlow";
import type { Profile } from "@/modules/account";

export function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshOnboarding } = useAuthContext();
  const [profile, setProfile] = useState<Profile | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(data as Profile | null);
  }, [user]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleComplete = useCallback(async () => {
    await refreshOnboarding();
    const returnTo = searchParams.get("returnTo");
    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      router.push(returnTo);
    } else {
      router.push("/");
    }
  }, [refreshOnboarding, searchParams, router]);

  if (!profile) return null;

  return (
    <div className="mx-auto max-w-lg">
      <OnboardingFlow profile={profile} onComplete={handleComplete} />
    </div>
  );
}
