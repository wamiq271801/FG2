"use client";

import { useMemo } from "react";
import { Link } from "@/components/shared/Link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Check,
  CreditCard,
  Headphones,
  MapPin,
  Package,
  Truck,
} from "lucide-react";
import {
  formatDate,
  formatDateTime,
  formatPrice,
} from "@/lib/format";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { BuyAgainButton } from "@/components/orders/BuyAgainButton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrder } from "@/modules/orders";
import { useProductsByIds } from "@/modules/catalog/useProducts";
import type { Order } from "@/types";

export function OrderDetail({ id }: { id: string }) {
  const { order, loading } = useOrder(id);

  if (loading) {
    return (
      <div className="container-edge py-6 lg:py-10">
        <Skeleton className="h-8 w-48" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-48 w-full rounded-xl" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) {
    notFound();
  }

  return (
    <div className="container-edge py-6 lg:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Orders", href: "/orders" },
          { label: order.id },
        ]}
      />

      {/* Order header */}
      <header className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">Order</p>
          <p className="mt-1.5 font-mono text-2xl font-medium tracking-tight md:text-3xl">
            {order.orderNumber ?? order.id}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm text-muted-foreground">
            <span>
              Placed{" "}
              <time dateTime={order.date} className="font-medium text-foreground">
                {formatDateTime(order.date)}
              </time>
            </span>
            <span aria-hidden="true" className="text-border">·</span>
            <OrderStatusBadge status={order.status} />
            {order.estimatedDelivery && (
              <>
                <span aria-hidden="true" className="text-border">·</span>
                <span>
                  Est. delivery{" "}
                  <time dateTime={order.estimatedDelivery} className="font-medium text-foreground">
                    {formatDate(order.estimatedDelivery)}
                  </time>
                </span>
              </>
            )}
          </div>
          {order.trackingNumber && (
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Truck className="h-3.5 w-3.5 text-copper" />
              Tracking{" "}
              <span className="font-mono text-foreground">{order.trackingNumber}</span>
            </p>
          )}
        </div>
        <Button asChild variant="ghost" size="sm" className="press self-start">
          <Link href="/orders">
            <ArrowLeft className="h-3.5 w-3.5" /> All orders
          </Link>
        </Button>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          <Timeline order={order} />
          <ItemsList order={order} />
        </div>
        <aside className="space-y-6">
          <TotalsCard order={order} />
          <AddressCard order={order} />
          <PaymentCard order={order} />
          <ActionsCard order={order} />
        </aside>
      </div>
    </div>
  );
}

function Breadcrumbs({ items }: { items: { label: string; href?: string }[] }) {
  return (
    <nav aria-label="Breadcrumb" className="text-sm">
      <ol className="flex flex-wrap items-center gap-1.5 text-muted-foreground">
        {items.map((item, i) => (
          <li key={i} className="flex items-center gap-1.5">
            {item.href ? (
              <Link href={item.href} className="hover:text-foreground">{item.label}</Link>
            ) : (
              <span className="text-foreground">{item.label}</span>
            )}
            {i < items.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function Timeline({ order }: { order: Order }) {
  if (order.events.length === 0) {
    return (
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="font-display text-xl tracking-tight">Order timeline</CardTitle>
          <CardDescription>
            {order.status === "delivered"
              ? "Delivered. Hope you're enjoying it."
              : "Where your order is right now."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">No timeline events yet.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="font-display text-xl tracking-tight">Order timeline</CardTitle>
        <CardDescription>
          {order.status === "delivered"
            ? "Delivered. Hope you're enjoying it."
            : "Where your order is right now."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol className="relative">
          <span aria-hidden="true" className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
          {order.events.map((event) => (
            <li key={event.id} className="relative flex gap-4 pb-5 last:pb-0">
              <span
                aria-hidden="true"
                className="relative z-10 mt-0.5 flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border border-copper bg-copper text-copper-foreground"
              >
                <Check className="h-2.5 w-2.5" strokeWidth={3} />
              </span>
              <div className="flex-1">
                <p className="text-sm font-medium leading-tight text-foreground">
                  {formatEventType(event.eventType)}
                </p>
                <time dateTime={event.createdAt} className="font-mono text-[11px] text-muted-foreground">
                  {formatDateTime(event.createdAt)}
                </time>
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
    </Card>
  );
}

/**
 * Map internal event_type values to human-readable labels.
 * Per implementation.md: "packed" is a tracking event without becoming a
 * primary order status value.
 */
function formatEventType(eventType: string): string {
  const labels: Record<string, string> = {
    order_placed:     "Order placed",
    order_confirmed:  "Order confirmed",
    packed:           "Packed",
    shipped:          "Shipped",
    out_for_delivery: "Out for delivery",
    delivered:        "Delivered",
    cancelled:        "Order cancelled",
    returned:         "Return initiated",
  };
  return labels[eventType] ?? eventType.replace(/_/g, " ");
}

function ItemsList({ order }: { order: Order }) {
  const totalItems = order.items.reduce((n, i) => n + i.quantity, 0);

  // Product links resolve from product ids — slugs are URL values only.
  const productIds = useMemo(
    () => order.items.map((i) => i.productId).filter((id): id is string => Boolean(id)),
    [order.items]
  );
  const { products } = useProductsByIds(productIds);
  const slugById = useMemo(
    () => new Map(products.map((p) => [p.id, p.slug])),
    [products]
  );

  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="font-display text-xl tracking-tight">Items</CardTitle>
        <CardDescription>{totalItems} {totalItems === 1 ? "item" : "items"} in this order</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {order.items.map((item, i) => {
          const slug = item.productId ? slugById.get(item.productId) : undefined;
          return (
            <div key={`${item.productId ?? item.name}-${i}`}>
              {i > 0 && <Separator className="mb-3" />}
              <div className="flex items-start gap-4">
                {slug ? (
                  <Link
                    href={`/product/${slug}`}
                    className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted press sm:h-20 sm:w-20"
                    aria-label={item.name}
                  >
                    <ProductVisual visualKey={item.visualKey} accent={item.accent} className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04]" />
                  </Link>
                ) : (
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted sm:h-20 sm:w-20">
                    <ProductVisual visualKey={item.visualKey} accent={item.accent} className="h-full w-full" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {slug ? (
                    <Link href={`/product/${slug}`} className="font-medium leading-tight hover:text-copper">{item.name}</Link>
                  ) : (
                    <span className="font-medium leading-tight">{item.name}</span>
                  )}
                  <p className="mt-1 text-xs text-muted-foreground">Qty {item.quantity} × {formatPrice(item.unitPrice)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Line total</p>
                  <p className="font-display text-sm font-medium">{formatPrice(item.unitPrice * item.quantity)}</p>
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TotalsCard({ order }: { order: Order }) {
  return (
    <Card className="border-border/70">
      <CardHeader><CardTitle className="font-display text-xl tracking-tight">Summary</CardTitle></CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="font-medium tabular-nums">{formatPrice(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Discount</span>
            <span className="font-medium tabular-nums text-copper">− {formatPrice(order.discount)}</span>
          </div>
        )}
        <div className="flex items-baseline justify-between">
          <span className="text-muted-foreground">Shipping</span>
          <span className="font-medium tabular-nums">{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</span>
        </div>
        {order.tax > 0 && (
          <div className="flex items-baseline justify-between">
            <span className="text-muted-foreground">Tax (GST)</span>
            <span className="font-medium tabular-nums">{formatPrice(order.tax)}</span>
          </div>
        )}
        <Separator className="my-2" />
        <div className="flex items-baseline justify-between pt-1">
          <span className="font-display text-base font-medium">Total</span>
          <span className="font-display text-xl font-medium tracking-tight">{formatPrice(order.total)}</span>
        </div>
        <p className="pt-1 text-[11px] text-muted-foreground">Paid via {order.paymentMethod}.</p>
      </CardContent>
    </Card>
  );
}

function AddressCard({ order }: { order: Order }) {
  const a = order.address;
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl tracking-tight">
          <MapPin className="h-4 w-4 text-copper" /> Delivery address
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium">{a.label}</p>
        <address className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground not-italic">
          {a.line1}
          {a.line2 ? `, ${a.line2}` : ""}
          <br />
          {a.city}, {a.state} {a.postcode}
          <br />
          {a.country}
          <br />
          <span className="font-mono text-xs">{a.phone}</span>
        </address>
      </CardContent>
    </Card>
  );
}

function PaymentCard({ order }: { order: Order }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl tracking-tight">
          <CreditCard className="h-4 w-4 text-copper" /> Payment method
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm font-medium">{order.paymentMethod}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">Charged on {formatDate(order.date)}</p>
      </CardContent>
    </Card>
  );
}

function ActionsCard({ order }: { order: Order }) {
  return (
    <Card className="border-border/70">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-display text-xl tracking-tight">
          <Package className="h-4 w-4 text-copper" /> Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <BuyAgainButton
          items={order.items}
          variant="default"
          className="w-full bg-foreground text-background hover:bg-foreground/90"
        />
        <Button asChild variant="ghost" size="sm" className="press w-full text-muted-foreground hover:text-foreground">
          <Link href="/contact">
            <Headphones className="h-4 w-4" /> Contact support
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}
