import type { Metadata } from "next";
import { Suspense } from "react";
import { AccountGate } from "@/components/account/AccountGate";
import { OnboardingPageContent } from "@/components/account/OnboardingPageContent";

export const metadata: Metadata = {
  title: "Complete your account",
  description:
    "Finish setting up your Fusion Gadgets account to start shopping.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/account/onboarding" },
};

export default function AccountOnboardingPage() {
  return (
    <div className="container-edge py-8 lg:py-12">
      <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        Account
      </p>
      <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
        Your account
      </h1>
      <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
        Finish setting up your profile to start shopping.
      </p>

      <AccountGate>
        <Suspense>
          <OnboardingPageContent />
        </Suspense>
      </AccountGate>
    </div>
  );
}
