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
      <AccountGate>
        <Suspense>
          <OnboardingPageContent />
        </Suspense>
      </AccountGate>
    </div>
  );
}
