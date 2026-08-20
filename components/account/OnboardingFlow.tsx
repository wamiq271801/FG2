"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOperation } from "@/hooks/use-operation";
import { updateProfile, createAddress, useProfile } from "@/modules/account";

const PHONE_RE = /^(\+91[\-\s]?)?[6-9]\d{9}$/;

export function OnboardingFlow({ onComplete }: { onComplete: () => void }) {
  const router = useRouter();
  const { profile, refresh: refreshProfile } = useProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [label, setLabel] = useState("Home");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("India");
  const [addrPhone, setAddrPhone] = useState(phone);
  const [error, setError] = useState<string | null>(null);
  const { start: startOp, stop: stopOp } = useOperation();

  // If onboarding is already complete, skip
  if (profile?.onboarding_state === "complete") {
    onComplete();
  }

  const handleComplete = async () => {
    setError(null);
    if (fullName.trim().length < 2) {
      setError("Please enter your full name.");
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setError("Enter a valid Indian mobile number.");
      return;
    }
    if (!line1.trim() || !city.trim() || !state.trim() || !postcode.trim() || !addrPhone.trim()) {
      setError("Please fill in all required address fields.");
      return;
    }

    startOp("Saving your details");
    try {
      const profileResult = await updateProfile({
        full_name: fullName.trim(),
        phone: phone.trim(),
        onboarding_state: "complete",
      });
      if (profileResult.error) {
        stopOp();
        setError(profileResult.error);
        return;
      }

      const addrResult = await createAddress({
        label: label.trim() || "Home",
        line1: line1.trim(),
        line2: line2.trim() || null,
        city: city.trim(),
        state: state.trim(),
        postcode: postcode.trim(),
        country: country.trim(),
        phone: addrPhone.trim(),
        is_default: true,
      });
      stopOp();
      if (addrResult.error) {
        setError(addrResult.error);
        return;
      }

      await refreshProfile();
      toast.success("Account ready", {
        description: "Welcome to Fusion Gadgets.",
      });
      onComplete();
      router.push("/account");
    } catch {
      stopOp();
      setError("Network error. Please try again.");
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-copper/10 text-copper">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Almost there
          </p>
          <h1 className="font-display text-2xl tracking-tight">Complete your account</h1>
        </div>
      </div>

      <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
        Add your phone number and a delivery address to finish setting up your account.
      </p>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Profile section */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Contact
        </p>
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
            onChange={(e) => {
              setPhone(e.target.value);
              setAddrPhone(e.target.value);
            }}
            autoComplete="tel"
            placeholder="+91 98765 43210"
          />
        </div>
      </div>

      {/* Address section */}
      <div className="space-y-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Delivery address
        </p>
        <div className="space-y-1.5">
          <Label htmlFor="onboard-addr-label">Address label</Label>
          <Input
            id="onboard-addr-label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Home, Office…"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onboard-line1">Address line</Label>
          <Input
            id="onboard-line1"
            value={line1}
            onChange={(e) => setLine1(e.target.value)}
            placeholder="Flat / House no, Street"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="onboard-line2">Area / locality (optional)</Label>
          <Input
            id="onboard-line2"
            value={line2}
            onChange={(e) => setLine2(e.target.value)}
            placeholder="Area, Landmark"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="onboard-city">City</Label>
            <Input
              id="onboard-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-state">State</Label>
            <Input
              id="onboard-state"
              value={state}
              onChange={(e) => setState(e.target.value)}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="onboard-postcode">PIN code</Label>
            <Input
              id="onboard-postcode"
              value={postcode}
              onChange={(e) => setPostcode(e.target.value)}
              inputMode="numeric"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-country">Country</Label>
            <Input
              id="onboard-country"
              value={country}
              onChange={(e) => setCountry(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Button
        type="button"
        onClick={handleComplete}
        className="press w-full bg-foreground text-background hover:bg-foreground/90"
      >
        Complete setup
      </Button>
    </div>
  );
}
