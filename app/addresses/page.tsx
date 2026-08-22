import type { Metadata } from "next";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { AddressManager } from "@/components/account/AddressManager";
import { OnboardingGate } from "@/providers/OnboardingGate";

export const metadata: Metadata = {
  title: "Addresses",
  description: "Manage your saved delivery addresses.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/addresses" },
};

export default function AddressesPage() {
  return (
    <OnboardingGate>
      <div className="container-edge py-8 lg:py-12">
        <Breadcrumbs
          items={[
            { label: "Home", href: "/" },
            { label: "Account", href: "/account" },
            { label: "Addresses" },
          ]}
        />

        <header className="mt-6">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Addresses
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
            Addresses
          </h1>
          <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
            Manage your saved delivery addresses. These are used at checkout.
          </p>
        </header>

        <AddressManager />
      </div>
    </OnboardingGate>
  );
}
