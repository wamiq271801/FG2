"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useOperation } from "@/hooks/use-operation";
import { updateProfile, createAddress, type Profile } from "@/modules/account";

const PHONE_RE = /^(\+91[\-\s]?)?[6-9]\d{9}$/;

type Props = {
  profile: Profile;
  onComplete: () => void;
};

export function OnboardingFlow({ profile, onComplete }: Props) {
  const [currentStep, setCurrentStep] = useState<1 | 2>(
    profile.onboarding_state === "address_optional" ? 2 : 1
  );

  // Step 1 state
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [phone, setPhone] = useState(profile.phone ?? "");

  // Step 2 state
  const [label, setLabel] = useState("Home");
  const [line1, setLine1] = useState("");
  const [line2, setLine2] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [postcode, setPostcode] = useState("");
  const [country, setCountry] = useState("India");
  const [addrPhone, setAddrPhone] = useState(profile.phone ?? "");

  const [error, setError] = useState<string | null>(null);
  const { start: startOp, stop: stopOp } = useOperation();

  // --- Step 1 → advance to Step 2 (does NOT end onboarding) ---
  async function handleStep1() {
    setError(null);
    if (fullName.trim().length < 2) {
      setError("Please enter your full name (at least 2 characters).");
      return;
    }
    if (!PHONE_RE.test(phone.trim())) {
      setError("Enter a valid Indian mobile number.");
      return;
    }
    startOp("Saving your details");
    const result = await updateProfile({
      full_name: fullName.trim(),
      phone: phone.trim(),
      onboarding_state: "address_optional",
    });
    stopOp();
    if (result.error) {
      setError(result.error);
      return;
    }
    setCurrentStep(2);
  }

  // --- Step 2 — save address → end onboarding ---
  async function handleStep2Save() {
    setError(null);
    if (!line1.trim() || !city.trim() || !state.trim() || !postcode.trim()) {
      setError("Please fill in all required address fields.");
      return;
    }
    startOp("Saving your address");
    const addrResult = await createAddress({
      label: label.trim() || "Home",
      line1: line1.trim(),
      line2: line2.trim() || null,
      city: city.trim(),
      state: state.trim(),
      postcode: postcode.trim(),
      country: country.trim(),
      phone: addrPhone.trim() || (profile.phone ?? ""),
      is_default: true,
    });
    if (addrResult.error) {
      stopOp();
      setError(addrResult.error);
      return;
    }
    const profileResult = await updateProfile({ onboarding_state: "complete" });
    stopOp();
    if (profileResult.error) {
      setError(profileResult.error);
      return;
    }
    toast.success("Account ready");
    onComplete();
  }

  // --- Step 2 — skip address → end onboarding ---
  async function handleStep2Skip() {
    setError(null);
    startOp("Finishing setup");
    const result = await updateProfile({ onboarding_state: "complete" });
    stopOp();
    if (result.error) {
      setError(result.error);
      return;
    }
    onComplete();
  }

  return (
    <div className="space-y-5">
      {/* Step indicator */}
      <div>
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Account setup · Step {currentStep} of 2
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight">
          {currentStep === 2 ? "Add a delivery address" : "Complete your profile"}
        </h1>
        <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
          {currentStep === 2
            ? "Add an address now or skip — you can always add one at checkout."
            : "We need your name and phone number to process orders."}
        </p>
      </div>

      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {currentStep === 1 ? (
        /* ── Step 1: Profile ── */
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="onboard-name">Full name</Label>
            <Input
              id="onboard-name"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              autoComplete="name"
              autoFocus
              placeholder="Your full name"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-phone">Phone number</Label>
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
              Used to contact you about orders. Never shared.
            </p>
          </div>
          <Button
            type="button"
            onClick={handleStep1}
            className="press w-full bg-foreground text-background hover:bg-foreground/90"
          >
            Continue
          </Button>
        </div>
      ) : (
        /* ── Step 2: Address ── */
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="onboard-addr-label">Label</Label>
              <Input
                id="onboard-addr-label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="Home, Office…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-addr-phone">Phone</Label>
              <Input
                id="onboard-addr-phone"
                type="tel"
                inputMode="tel"
                value={addrPhone}
                onChange={(e) => setAddrPhone(e.target.value)}
                autoComplete="tel"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="onboard-line1">
              Address line <span className="text-destructive">*</span>
            </Label>
            <Input
              id="onboard-line1"
              value={line1}
              onChange={(e) => setLine1(e.target.value)}
              autoFocus
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
              <Label htmlFor="onboard-city">
                City <span className="text-destructive">*</span>
              </Label>
              <Input id="onboard-city" value={city} onChange={(e) => setCity(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="onboard-state">
                State <span className="text-destructive">*</span>
              </Label>
              <Input id="onboard-state" value={state} onChange={(e) => setState(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="onboard-postcode">
                PIN code <span className="text-destructive">*</span>
              </Label>
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
          <div className="flex gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              onClick={handleStep2Skip}
              className="press flex-1"
            >
              Skip for now
            </Button>
            <Button
              type="button"
              onClick={handleStep2Save}
              className="press flex-1 bg-foreground text-background hover:bg-foreground/90"
            >
              Save address
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
