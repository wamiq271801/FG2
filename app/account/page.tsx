import type { Metadata } from "next";
import { AccountGate } from "@/components/account/AccountGate";
import { AccountContent } from "@/components/account/AccountContent";
import { OnboardingGate } from "@/providers/OnboardingGate";

export const metadata: Metadata = {
  title: "Your account",
  description:
    "Manage your Fusion Gadgets account — profile, preferences, and security settings.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account" },
};

export default function AccountPage() {
  return (
    <OnboardingGate>
      <div className="container-edge py-8 lg:py-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Account
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
          Your account
        </h1>
        <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
          Manage your profile, preferences, and account settings.
        </p>

        <AccountGate>
          <AccountContent />
        </AccountGate>
      </div>
    </OnboardingGate>
  );
}
