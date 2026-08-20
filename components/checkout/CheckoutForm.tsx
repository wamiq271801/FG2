"use client";

import { useEffect, useState } from "react";
import { Link } from "@/components/shared/Link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Banknote,
  Loader2,
  Lock,
  MapPin,
  Package,
  RotateCcw,
  ShieldCheck,
  Truck,
} from "lucide-react";
import { toast } from "sonner";

import { useCartContext } from "@/providers/CartProvider";
import { useAuthContext } from "@/providers/AuthProvider";
import { useCart } from "@/modules/cart";
import { useAddresses } from "@/modules/account";
import { createOrder } from "@/services/worker";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Address } from "@/modules/account";

const FREE_SHIPPING_THRESHOLD = 4990;
const SHIPPING_FLAT = 149;

export function CheckoutForm() {
  const router = useRouter();
  const { lines, ready, subtotal, count } = useCartContext();
  const { user, ready: authReady } = useAuthContext();
  const { addresses, loading: addressesLoading, refresh: refreshAddresses } = useAddresses();
  const loadRemote = useCart((s) => s.loadRemote);

  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);
  const [idempotencyKey, setIdempotencyKey] = useState<string>("");

  // Redirect unauthenticated users to sign-in
  useEffect(() => {
    if (authReady && !user) {
      router.replace("/auth/signin");
    }
  }, [authReady, user, router]);

  // Auto-select default address when addresses load
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find((a) => a.is_default) ?? addresses[0];
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  // Generate idempotency key once per checkout attempt
  useEffect(() => {
    if (!idempotencyKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIdempotencyKey(`${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
    }
  }, [idempotencyKey]);

  // Redirect to /cart if the cart is empty after hydration
  useEffect(() => {
    if (ready && lines.length === 0 && !submitting) {
      router.replace("/cart");
    }
  }, [ready, lines.length, submitting, router]);

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;

  async function handlePlaceOrder() {
    setServerError(null);
    if (!user) {
      setServerError("Please sign in to place your order.");
      return;
    }
    if (!selectedAddressId) {
      setServerError("Please select a delivery address.");
      return;
    }
    setSubmitting(true);
    try {
      const result = await createOrder(selectedAddressId, idempotencyKey);
      if (!result.success || !result.orderId) {
        setServerError(result.error ?? "Unable to place order. Please try again.");
        setSubmitting(false);
        return;
      }
      // Reload cart (Worker/RPC cleared ordered items)
      await loadRemote(user.id);
      toast.success("Order placed", {
        description: `Confirmation ${result.orderId}`,
      });
      router.push(`/checkout/success?order=${encodeURIComponent(result.orderId)}`);
    } catch {
      setServerError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  // Loading state
  if (!ready || !authReady || addressesLoading) {
    return <CheckoutSkeleton />;
  }

  // Not signed in
  if (!user) {
    return (
      <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground/60">
          <Lock className="h-5 w-5" />
        </div>
        <h2 className="mt-4 font-display text-2xl tracking-tight">Sign in to checkout</h2>
        <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          You need an account to place an order. Sign in to continue.
        </p>
        <Button asChild className="press mt-5 bg-foreground text-background hover:bg-foreground/90">
          <Link href="/auth/signin">Sign in</Link>
        </Button>
      </div>
    );
  }

  // Empty cart
  if (lines.length === 0 && !submitting) {
    return (
      <div className="mt-10 flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-foreground/60">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Your bag is empty — redirecting you back…
        </p>
      </div>
    );
  }

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
      {/* Left: address + payment */}
      <div className="space-y-6">
        {serverError && (
          <Alert variant="destructive" role="alert">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        {/* 1. Delivery address */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl tracking-tight">Delivery address</h2>
            <Link href="/addresses" className="text-xs font-medium text-copper hover:underline">
              Manage addresses
            </Link>
          </div>
          {addresses.length === 0 ? (
            <div className="mt-4 rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
              <MapPin className="mx-auto h-8 w-8 text-muted-foreground" strokeWidth={1.25} />
              <p className="mt-3 text-sm text-muted-foreground">
                You need a saved address to place an order.
              </p>
              <Button asChild className="press mt-4 bg-foreground text-background hover:bg-foreground/90">
                <Link href="/addresses">Add an address</Link>
              </Button>
            </div>
          ) : (
            <ul className="mt-4 space-y-3">
              {addresses.map((addr) => (
                <AddressOption
                  key={addr.id}
                  address={addr}
                  selected={selectedAddressId === addr.id}
                  onSelect={() => setSelectedAddressId(addr.id)}
                />
              ))}
            </ul>
          )}
        </section>

        {/* 2. Payment method (COD only) */}
        <section>
          <h2 className="font-display text-xl tracking-tight">Payment method</h2>
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-copper/30 bg-copper/5 p-4">
            <Banknote className="h-5 w-5 text-copper" />
            <div className="flex-1">
              <p className="text-sm font-medium">Cash on delivery</p>
              <p className="text-xs text-muted-foreground">Pay when your order arrives</p>
            </div>
            <span className="rounded-full border border-copper/30 bg-copper/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-copper">
              COD
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Online payment options will be available soon.
          </p>
        </section>
      </div>

      {/* Right: order summary */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="rounded-xl border border-border/70 bg-card p-5">
          <h2 className="font-display text-xl tracking-tight">Order summary</h2>

          {/* Items */}
          <ul className="mt-4 space-y-3">
            {lines.map((line) => (
              <li key={line.key} className="flex items-center gap-3">
                <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border/70 bg-muted">
                  <ProductVisual
                    visualKey={line.product.visualKey as "headphones" | "earbuds" | "speaker" | "keyboard" | "mouse" | "watch" | "camera" | "lens" | "drone" | "charger" | "cable" | "stand" | "lamp" | "backpack" | "controller" | "mic" | "monitor" | "tracker"}
                    accent={line.product.accent}
                    className="h-full w-full"
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="line-clamp-1 text-sm font-medium">{line.product.name}</p>
                  {line.variant && (
                    <p className="text-xs text-muted-foreground">{line.variant}</p>
                  )}
                  <p className="text-xs text-muted-foreground">Qty {line.quantity}</p>
                </div>
                <span className="font-mono text-sm tabular-nums">
                  {formatPrice(line.product.price * line.quantity)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Subtotal ({count} {count === 1 ? "item" : "items"})</span>
              <span className="font-medium tabular-nums">{formatPrice(subtotal)}</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-muted-foreground">Shipping</span>
              <span className="font-medium tabular-nums">
                {shipping === 0 ? <span className="text-copper">Free</span> : formatPrice(shipping)}
              </span>
            </div>
          </div>

          <div className="mt-3 flex items-baseline justify-between border-t border-border pt-3">
            <span className="font-display text-base font-medium">Total</span>
            <span className="font-display text-2xl font-medium tracking-tight tabular-nums">
              {formatPrice(total)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Inclusive of all taxes. Final total confirmed at checkout.
          </p>

          <Button
            type="button"
            onClick={handlePlaceOrder}
            disabled={submitting || !selectedAddressId || addresses.length === 0}
            className="press mt-5 w-full bg-foreground text-background hover:bg-foreground/90"
            size="lg"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Placing order…
              </>
            ) : (
              <>
                <Lock className="h-4 w-4" />
                Place order
              </>
            )}
          </Button>

          <ul className="mt-5 grid grid-cols-1 gap-2 text-xs text-muted-foreground">
            <li className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-copper" />
              Secure SSL checkout
            </li>
            <li className="flex items-center gap-2">
              <RotateCcw className="h-3.5 w-3.5 text-copper" />
              7-day easy returns
            </li>
            <li className="flex items-center gap-2">
              <Package className="h-3.5 w-3.5 text-copper" />
              1-year warranty on all gadgets
            </li>
          </ul>
        </div>
      </aside>
    </div>
  );
}

function AddressOption({
  address,
  selected,
  onSelect,
}: {
  address: Address;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full items-start gap-3 rounded-lg border p-4 text-left transition-colors",
          selected
            ? "border-copper bg-copper/5"
            : "border-border bg-card hover:border-copper/40"
        )}
        aria-pressed={selected}
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-foreground/70">
          <MapPin className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{address.label}</span>
            {address.is_default && (
              <span className="rounded-full border border-copper/30 bg-copper/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-copper">
                Default
              </span>
            )}
          </div>
          <address className="mt-1 text-pretty text-sm leading-relaxed text-muted-foreground not-italic">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
            <br />
            {address.city}, {address.state} {address.postcode}
            <br />
            {address.country}
            <br />
            <span className="font-mono text-xs">{address.phone}</span>
          </address>
        </div>
        <div
          className={cn(
            "mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
            selected ? "border-copper bg-copper" : "border-border"
          )}
        >
          {selected && <div className="h-2 w-2 rounded-full bg-white" />}
        </div>
      </button>
    </li>
  );
}

function CheckoutSkeleton() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]" aria-busy="true" aria-label="Loading checkout">
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-32 w-full rounded-lg" />
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-24 w-full rounded-lg" />
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
