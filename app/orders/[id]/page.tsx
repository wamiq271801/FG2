import type { Metadata } from "next";
import { OrderDetail } from "@/components/orders/OrderDetail";

export const metadata: Metadata = {
  title: "Order details",
  description: "Your Fusion Gadgets order details.",
  robots: { index: false, follow: false },
};

type Params = Promise<{ id: string }>;

export default async function OrderDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  return <OrderDetail id={id} />;
}
