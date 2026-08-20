import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { ArrowLeft, Lock } from "lucide-react";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { CheckoutForm } from "@/components/checkout/CheckoutForm";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Checkout",
  description: "Securely complete your Fusion Gadgets order.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/checkout" },
};

export default function CheckoutPage() {
  return (
    <div className="container-edge py-6 lg:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Bag", href: "/cart" },
          { label: "Checkout" },
        ]}
      />

      {/* Server-rendered shell — always visible */}
      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-copper">
            <Lock className="h-3 w-3" />
            Secure checkout
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
            Checkout
          </h1>
          <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
            Almost there. Confirm your delivery address and place your order.
            Cash on delivery available — pay when it arrives.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="press self-start sm:self-end">
          <Link href="/cart">
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to bag
          </Link>
        </Button>
      </header>

      <CheckoutForm />
    </div>
  );
}
