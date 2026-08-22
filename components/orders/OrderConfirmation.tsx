"use client";

import { useMemo } from "react";
import { Link } from "@/components/shared/Link";
import {
  ArrowRight,
  CheckCircle2,
  Headphones,
  Mail,
  Package,
  RotateCcw,
  ShoppingBag,
  Truck,
} from "lucide-react";
import { storeInfo } from "@/lib/store-info";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDate, formatPrice } from "@/lib/format";
import { useOrder } from "@/modules/orders";
import { useProductsByIds } from "@/modules/catalog/useProducts";
import type { Order } from "@/types";

export function OrderConfirmation({ orderId }: { orderId: string }) {
  const { order, loading } = useOrder(orderId);

  if (loading || !order) {
    return (
      <div className="container-edge py-6 lg:py-10">
        <Skeleton className="h-9 w-64" />
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-48 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

  return (
    <div className="container-edge py-6 lg:py-10">
      {/* Confirmation header */}
      <header className="mt-8 flex flex-col items-start gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-copper/10 text-copper">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-copper">Order received</p>
          </div>
          <h1 className="mt-3 font-display text-3xl tracking-tight md:text-4xl">Thank you for your order</h1>
          <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
            We&apos;ve received your order and sent a confirmation email. Our
            team is already getting your gadgets ready to ship.
          </p>
        </div>
        <div className="rounded-xl border border-border/70 bg-card p-4 lg:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Order number</p>
          <p className="font-mono text-lg font-medium tracking-tight">{order.id}</p>
          {order.estimatedDelivery && (
            <p className="mt-1 text-xs text-muted-foreground">
              Est. delivery{" "}
              <time dateTime={order.estimatedDelivery} className="font-medium text-foreground">
                {formatDate(order.estimatedDelivery)}
              </time>
            </p>
          )}
        </div>
      </header>

      {/* Body */}
      <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-6">
          {/* What happens next */}
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="font-display text-xl tracking-tight">What happens next</CardTitle>
              <CardDescription>Three quick steps from your desk to your door.</CardDescription>
            </CardHeader>
            <CardContent>
              <ol className="space-y-4">
                <TimelineStep step={1} icon={<Mail className="h-4 w-4" />} title="Email confirmation" description="You'll receive a confirmation email with your order details and invoice in the next few minutes." />
                <TimelineStep step={2} icon={<Package className="h-4 w-4" />} title="Packed with care" description="Our team in Bahraich inspects and packs each item — typically within 24 hours of ordering." />
                <TimelineStep step={3} icon={<Truck className="h-4 w-4" />} title="Shipped & delivered" description="You'll get a tracking number by email once it ships. Standard delivery takes 3–5 business days." />
              </ol>
            </CardContent>
          </Card>

          {/* Ordered items */}
          <OrderedItemsCard order={order} />

          {/* Est. delivery */}
          {order.estimatedDelivery && (
            <Card className="border-border/70">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 font-display text-xl tracking-tight">
                  <Truck className="h-4 w-4 text-copper" /> Estimated delivery
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Your order should arrive by{" "}
                  <time dateTime={order.estimatedDelivery} className="font-medium text-foreground">{formatDate(order.estimatedDelivery)}</time>
                  . We&apos;ll email a tracking number once it&apos;s on its way.
                </p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions + trust */}
        <aside className="space-y-6">
          <Card className="border-border/70">
            <CardHeader><CardTitle className="font-display text-xl tracking-tight">Next steps</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Button asChild className="press w-full bg-foreground text-background hover:bg-foreground/90">
                <Link href="/shop"><ShoppingBag className="h-4 w-4" /> Continue shopping</Link>
              </Button>
              <Button asChild variant="outline" className="press w-full">
                <Link href={`/orders/${order.id}`}>View order <ArrowRight className="h-3.5 w-3.5" /></Link>
              </Button>
            </CardContent>
          </Card>
          <Card className="border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 font-display text-xl tracking-tight">
                <Headphones className="h-4 w-4 text-copper" /> Need a hand?
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-muted-foreground">
                Reach us at{" "}
                <a href={`mailto:${storeInfo.supportEmail}`} className="font-medium text-foreground hover:text-copper">{storeInfo.supportEmail}</a>
                {" "}or call{" "}
                <span className="font-mono text-foreground">{storeInfo.phone}</span>.
              </p>
              <p className="text-muted-foreground">Changed your mind? Returns are easy within 7 days.</p>
              <Button asChild variant="ghost" size="sm" className="press -ml-2">
                <Link href="/returns"><RotateCcw className="h-3.5 w-3.5" /> Read the returns policy</Link>
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function TimelineStep({ step, icon, title, description }: { step: number; icon: React.ReactNode; title: string; description: string }) {
  return (
    <li className="flex items-start gap-3">
      <span aria-hidden="true" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-copper/30 bg-copper/5 text-copper">
        {icon}
      </span>
      <div className="flex-1">
        <p className="text-sm font-medium leading-tight">
          <span className="sr-only">Step {step}: </span>{title}
        </p>
        <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
    </li>
  );
}

function OrderedItemsCard({ order }: { order: Order }) {
  const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);

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
        <CardTitle className="font-display text-xl tracking-tight">What you ordered</CardTitle>
        <CardDescription>
          {itemCount} {itemCount === 1 ? "item" : "items"} · placed{" "}
          <time dateTime={order.date} className="font-medium text-foreground">{formatDate(order.date)}</time>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {order.items.map((item, i) => {
          const slug = item.productId ? slugById.get(item.productId) : undefined;
          return (
            <div key={`${item.productId ?? item.name}-${i}`}>
              {i > 0 && <Separator className="mb-3" />}
              <div className="flex items-start gap-3">
                {slug ? (
                  <Link href={`/product/${slug}`} className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted press" aria-label={item.name}>
                    <ProductVisual visualKey={item.visualKey} accent={item.accent} className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04]" />
                  </Link>
                ) : (
                  <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted">
                    <ProductVisual visualKey={item.visualKey} accent={item.accent} className="h-full w-full" />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  {slug ? (
                    <Link href={`/product/${slug}`} className="line-clamp-2 text-sm font-medium leading-tight hover:text-copper">{item.name}</Link>
                  ) : (
                    <span className="line-clamp-2 text-sm font-medium leading-tight">{item.name}</span>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">Qty {item.quantity} × {formatPrice(item.unitPrice)}</p>
                </div>
                <span className="font-mono text-sm tabular-nums">{formatPrice(item.unitPrice * item.quantity)}</span>
              </div>
            </div>
          );
        })}
        <Separator className="my-1" />
        <dl className="space-y-1.5 text-sm">
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Subtotal</dt>
            <dd className="font-medium tabular-nums">{formatPrice(order.subtotal)}</dd>
          </div>
          {order.discount > 0 && (
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="font-medium tabular-nums text-copper">− {formatPrice(order.discount)}</dd>
            </div>
          )}
          <div className="flex items-baseline justify-between">
            <dt className="text-muted-foreground">Shipping</dt>
            <dd className="font-medium tabular-nums">{order.shipping === 0 ? "Free" : formatPrice(order.shipping)}</dd>
          </div>
        </dl>
        <Separator className="my-1" />
        <div className="flex items-baseline justify-between">
          <span className="font-display text-base font-medium">Total</span>
          <span className="font-display text-xl font-medium tracking-tight tabular-nums">{formatPrice(order.total)}</span>
        </div>
      </CardContent>
    </Card>
  );
}
