import type { Metadata } from "next";
import { Suspense } from "react";
import { OrderConfirmation } from "@/components/orders/OrderConfirmation";

export const metadata: Metadata = {
  title: "Order confirmed",
  description: "Your Fusion Gadgets order has been placed.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/checkout/success" },
};

type SearchParams = Promise<{ order?: string }>;

export default function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  return (
    <Suspense fallback={<SuccessFallback />}>
      <SuccessInner searchParams={searchParams} />
    </Suspense>
  );
}

function SuccessFallback() {
  return (
    <div className="container-edge py-6 lg:py-10">
      <h1 className="font-display text-3xl tracking-tight md:text-4xl">Confirming your order…</h1>
      <p className="mt-3 text-sm text-muted-foreground">We&apos;re pulling up your confirmation details.</p>
    </div>
  );
}

async function SuccessInner({ searchParams }: { searchParams: SearchParams }) {
  const { order: orderId } = await searchParams;
  return <OrderConfirmation orderId={orderId ?? ""} />;
}
