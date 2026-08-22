import type { Metadata } from "next";
import { OrdersList } from "@/components/orders/OrdersList";
import { OnboardingGate } from "@/providers/OnboardingGate";

export const metadata: Metadata = {
  title: "Your orders",
  description: "Track, return, or buy again from your Fusion Gadgets orders.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/orders" },
};

export default function OrdersPage() {
  return (
    <OnboardingGate>
      <div className="container-edge py-8 lg:py-12">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Orders
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
          Your orders
        </h1>
        <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
          Everything you&apos;ve ordered from Fusion Gadgets, newest first. Track
          shipments, download invoices, or buy again in a couple of clicks.
        </p>
        <OrdersList />
      </div>
    </OnboardingGate>
  );
}
