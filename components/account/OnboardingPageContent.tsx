"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";
import { OnboardingFlow } from "@/components/account/OnboardingFlow";
import type { Profile } from "@/modules/account";

export function OnboardingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, refreshOnboarding } = useAuthContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();
    setProfile(data as Profile | null);
    setLoading(false);
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading…</span>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="mt-8 max-w-lg">
      <OnboardingFlow profile={profile} onComplete={handleComplete} />
    </div>
  );
}
