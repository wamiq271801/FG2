"use client";

import { Link } from "@/components/shared/Link";
import { ArrowRight, PackageOpen, ShoppingBag } from "lucide-react";
import { formatDate, formatPrice } from "@/lib/format";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { OrderStatusBadge } from "@/components/orders/OrderStatusBadge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useOrders } from "@/modules/orders";
import { useAuthContext } from "@/providers/AuthProvider";

export function OrdersList() {
  const { orders, loading } = useOrders();
  const { user, ready: authReady } = useAuthContext();

  // Only show skeleton when actively loading authenticated orders.
  // During auth init (authReady=false, loading=false), fall through to the
  // sign-in prompt so there is no flash.
  if (loading) {
    return (
      <div className="mt-8 space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground/60">
          <PackageOpen className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-2xl tracking-tight">Sign in to view orders</h2>
        <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          Your order history is tied to your account.
        </p>
        <Button asChild className="press mt-5 bg-foreground text-background hover:bg-foreground/90">
          <Link href="/auth/signin">Sign in</Link>
        </Button>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground/60">
          <PackageOpen className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-2xl tracking-tight">No orders yet</h2>
        <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          When you place your first order, it&apos;ll appear here with shipment
          tracking, invoices, and a one-click &ldquo;buy again&rdquo;.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button asChild className="press bg-foreground text-background hover:bg-foreground/90">
            <Link href="/shop">
              <ShoppingBag className="h-4 w-4" />
              Browse the shop
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href="/offers">See what&apos;s on sale</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <ul className="mt-8 space-y-4">
      {orders.map((order) => {
        const itemCount = order.items.reduce((n, i) => n + i.quantity, 0);
        const thumbnails = order.items.slice(0, 4);
        const overflow = order.items.length - thumbnails.length;
        return (
          <li key={order.id}>
            <article className="overflow-hidden rounded-xl border border-border/70 bg-card">
              <div className="flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-wrap items-center gap-4">
                  <div className="flex -space-x-2">
                    {thumbnails.map((item, i) => (
                      <div
                        key={`${order.id}-${item.productId ?? item.name}-${i}`}
                        className="relative h-12 w-12 overflow-hidden rounded-lg border border-card bg-muted ring-1 ring-border/60"
                        style={{ zIndex: thumbnails.length - i }}
                      >
                        <ProductVisual
                          visualKey={item.visualKey}
                          accent={item.accent}
                          className="h-full w-full"
                        />
                      </div>
                    ))}
                    {overflow > 0 && (
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border/70 bg-muted text-xs font-medium text-muted-foreground ring-1 ring-border/60">
                        +{overflow}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{order.id}</span>
                      <OrderStatusBadge status={order.status} size="sm" />
                    </div>
                    <p className="mt-0.5 text-sm font-medium leading-tight">
                      {itemCount} {itemCount === 1 ? "item" : "items"} ·{" "}
                      <span className="text-muted-foreground">
                        Placed {formatDate(order.date)}
                      </span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {order.items.map((i) => i.name).join(" · ")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between gap-4 lg:flex-col lg:items-end">
                  <div className="lg:text-right">
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Total</p>
                    <p className="font-display text-lg font-medium tracking-tight">{formatPrice(order.total)}</p>
                  </div>
                  <Button asChild variant="outline" size="sm" className="press shrink-0">
                    <Link href={`/orders/${order.id}`}>
                      View order
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </Button>
                </div>
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
