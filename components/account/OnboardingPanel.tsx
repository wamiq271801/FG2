"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { updateProfile } from "@/modules/account";
import type { Profile } from "@/modules/account";

type Props = {
  profile: Profile;
  onComplete?: () => void;
};

const PHONE_RE = /^(\+91[\-\s]?)?[6-9]\d{9}$/;

export function OnboardingPanel({ profile, onComplete }: Props) {
  const router = useRouter();
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    setError(null);
    if (fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setError("Enter a valid Indian mobile number.");
      return;
    }
    setSaving(true);
    const { error } = await updateProfile({
      full_name: fullName.trim(),
      phone: phone.trim(),
      onboarding_state: "complete",
    });
    setSaving(false);
    if (error) {
      setError(error);
      return;
    }
    toast.success("Welcome to Fusion", {
      description: "Your account is set up.",
    });
    onComplete?.();
    router.refresh();
  }

  return (
    <div className="mt-8">
      <Card className="max-w-lg border-copper/25 bg-copper/[0.03]">
        <CardHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-copper/10 text-copper">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <CardTitle className="mt-3 font-display text-2xl tracking-tight">
            Complete your account
          </CardTitle>
          <CardDescription className="text-pretty">
            One last step — add your name and phone so we can reach you about
            orders. You can add an address later at checkout.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">{error}</p>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="onboard-name">Full name</Label>
            <Input
              id="onboard-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-phone">Phone (required)</Label>
            <Input
              id="onboard-phone"
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
              placeholder="+91 98765 43210"
            />
            <p className="text-xs text-muted-foreground">
              We use this to contact you about orders. We never share it.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleComplete}
            disabled={saving}
            className="press w-full bg-foreground text-background hover:bg-foreground/90"
          >
            {saving ? <Loader2 className="animate-spin" /> : null}
            {saving ? "Saving…" : "Complete setup"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
