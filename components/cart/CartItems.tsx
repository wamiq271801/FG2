"use client";

import { Link } from "@/components/shared/Link";
import {
  ArrowLeft,
  ArrowRight,
  Lock,
  Package,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Truck,
  X,
} from "lucide-react";
import { useCartContext } from "@/providers/CartProvider";
import { useCart } from "@/modules/cart";
import { useAuthContext } from "@/providers/AuthProvider";
import { useProductsByIds } from "@/modules/catalog/useProducts";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { QuantityStepper } from "@/components/product/QuantityStepper";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPrice } from "@/lib/format";
import type { Product } from "@/types";

/**
 * A resolved cart line: the stored cart line + current product data.
 * Product details are resolved HERE (cart surface only) rather than in the
 * global CartProvider, so unrelated routes never query product records.
 */
export type ResolvedCartLine = {
  /** Cart line identity — the product UUID. */
  productId: string;
  quantity: number;
  product: {
    name: string;
    /** URL slug from the resolved product — link generation only. */
    slug: string;
    price: number;
    visualKey: string;
    accent: string;
    /** Derived availability string from is_active + is_preorder + stock. */
    availability: string;
    /** Numeric stock value for quantity constraints. */
    stock: number;
  };
};

type Props = {
  /** Suggested products shown in the empty state (server-rendered source). */
  suggestedProducts?: Product[];
};

const FREE_SHIPPING_THRESHOLD = 4990;
const SHIPPING_FLAT = 149;

/**
 * CartItems — the interactive body of /cart.
 *
 * Reads cart state from `useCartContext` (hydration-safe) and write actions
 * from `useCart`. Three render states: hydrating (skeleton), empty (CTA +
 * suggestions), and populated (line items + summary sidebar).
 *
 * The surrounding page shell (H1, intro, container) is server-rendered; this
 * component owns only the interactive cart surface.
 */
export function CartItems({ suggestedProducts = [] }: Props) {
  const { lines: cartLines, ready } = useCartContext();

  // Resolve display data by productId — only on the cart surface.
  const productIds = [...new Set(cartLines.map((l) => l.productId))];
  const { products, loading: productsLoading } = useProductsByIds(productIds);

  const lines: ResolvedCartLine[] = cartLines
    .map((line): ResolvedCartLine | null => {
      const product = products.find((p) => p.id === line.productId);
      if (!product) return null;
      return {
        productId: line.productId,
        quantity: line.quantity,
        product: {
          name: product.name,
          slug: product.slug,
          price: product.price,
          visualKey: product.visualKey,
          accent: product.accent,
          availability: product.availability ?? "in-stock",
          stock: product.stock ?? 0,
        },
      };
    })
    .filter((l): l is ResolvedCartLine => l !== null);

  const count = lines.reduce((n, l) => n + l.quantity, 0);
  const subtotal = lines.reduce((n, l) => n + l.quantity * l.product.price, 0);

  // Loading state — render a neutral skeleton until the cart store has
  // rehydrated from localStorage AND display data is resolved. This avoids a
  // hydration mismatch (the server always renders an empty cart; the client
  // must wait for `ready` before showing persisted lines).
  if (!ready || (cartLines.length > 0 && productsLoading)) {
    return <CartSkeleton />;
  }

  if (lines.length === 0) {
    return <EmptyState suggestedProducts={suggestedProducts} />;
  }

  return <PopulatedCart lines={lines} subtotal={subtotal} count={count} />;
}

// ── Populated cart ─────────────────────────────────────────────────────

function PopulatedCart({
  lines,
  subtotal,
  count,
}: {
  lines: ResolvedCartLine[];
  subtotal: number;
  count: number;
}) {
  const setQuantity = useCart((s) => s.setQuantity);
  const remove = useCart((s) => s.remove);
  const { user } = useAuthContext();
  const userId = user?.id ?? null;

  const shipping = subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FLAT;
  const total = subtotal + shipping;
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const meetsFreeShipping = shipping === 0;

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]">
      {/* ── Line items ────────────────────────────────────────────── */}
      <section aria-label="Cart items" className="min-w-0">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-xl tracking-tight">
            {count} {count === 1 ? "item" : "items"}
          </h2>
          <span className="text-xs text-muted-foreground">
            Shipping calculated at checkout
          </span>
        </div>

        <ul className="mt-4 divide-y divide-border/70 overflow-hidden rounded-xl border border-border/70 bg-card">
          {lines.map((line) => (
            <li key={line.productId} className="p-4 sm:p-5">
              <CartLine
                line={line}
                onQuantity={(qty) => setQuantity(line.productId, qty, userId)}
                onRemove={() => remove(line.productId, userId)}
              />
            </li>
          ))}
        </ul>

        <div className="mt-4 flex items-center justify-between">
          <Button asChild variant="ghost" size="sm" className="press">
            <Link href="/shop">
              <ArrowLeft className="h-3.5 w-3.5" />
              Continue shopping
            </Link>
          </Button>
        </div>
      </section>

      {/* ── Order summary ────────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-24 lg:self-start" aria-label="Order summary">
        <div className="rounded-xl border border-border/70 bg-card p-5">
          <h2 className="font-display text-xl tracking-tight">Order summary</h2>

          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">
                Subtotal ({count} {count === 1 ? "item" : "items"})
              </dt>
              <dd className="font-medium tabular-nums">{formatPrice(subtotal)}</dd>
            </div>
            <div className="flex items-baseline justify-between">
              <dt className="text-muted-foreground">Shipping</dt>
              <dd className="font-medium tabular-nums">
                {meetsFreeShipping ? (
                  <span className="text-copper">Free</span>
                ) : (
                  formatPrice(shipping)
                )}
              </dd>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Discounts and promo codes are applied at checkout.
            </p>
          </dl>

          <Separator className="my-3" />

          <div className="flex items-baseline justify-between">
            <span className="font-display text-base font-medium">Total</span>
            <span className="font-display text-2xl font-medium tracking-tight tabular-nums">
              {formatPrice(total)}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Inclusive of all taxes. GST shown on invoice.
          </p>

          {/* Free-shipping progress */}
          <div className="mt-4 rounded-lg border border-border/60 bg-muted/40 p-3">
            {meetsFreeShipping ? (
              <p className="flex items-center gap-2 text-xs font-medium text-copper">
                <Truck className="h-3.5 w-3.5" />
                You&apos;ve unlocked free shipping.
              </p>
            ) : (
              <div className="space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  Add{" "}
                  <span className="font-medium text-foreground">
                    {formatPrice(amountToFreeShipping)}
                  </span>{" "}
                  more for free shipping.
                </p>
                <div
                  className="h-1.5 overflow-hidden rounded-full bg-border"
                  role="progressbar"
                  aria-label="Progress to free shipping"
                  aria-valuenow={Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100))}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="h-full bg-copper transition-[width] duration-500"
                    style={{
                      width: `${Math.min(100, Math.round((subtotal / FREE_SHIPPING_THRESHOLD) * 100))}%`,
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          <Button
            asChild
            className="press mt-5 w-full bg-foreground text-background hover:bg-foreground/90"
            size="lg"
          >
            <Link href="/checkout">
              <Lock className="h-4 w-4" />
              Proceed to checkout
            </Link>
          </Button>

          {/* Trust row */}
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

// ── Single cart line ───────────────────────────────────────────────────

function CartLine({
  line,
  onQuantity,
  onRemove,
}: {
  line: ResolvedCartLine;
  onQuantity: (qty: number) => void;
  onRemove: () => void;
}) {
  const lineTotal = line.product.price * line.quantity;

  return (
    <div className="flex gap-4">
      {/* Thumbnail */}
      <Link
        href={`/product/${line.product.slug}`}
        className="group relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border border-border/70 bg-muted press sm:h-20 sm:w-20"
        aria-label={line.product.name}
      >
        <ProductVisual
          visualKey={line.product.visualKey as "headphones" | "earbuds" | "speaker" | "keyboard" | "mouse" | "watch" | "camera" | "lens" | "drone" | "charger" | "cable" | "stand" | "lamp" | "backpack" | "controller" | "mic" | "monitor" | "tracker"}
          accent={line.product.accent}
          className="h-full w-full transition-transform duration-300 group-hover:scale-[1.04]"
        />
      </Link>

      {/* Identity + controls */}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link
              href={`/product/${line.product.slug}`}
              className="font-medium leading-tight hover:text-copper"
            >
              {line.product.name}
            </Link>
            <p className="mt-0.5 text-xs text-muted-foreground">
              <span className="font-mono">{formatPrice(line.product.price)}</span>{" "}
              each
            </p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            className="press -mr-1 -mt-1 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40"
            aria-label={`Remove ${line.product.name} from bag`}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <QuantityStepper
            value={line.quantity}
            onChange={onQuantity}
            min={1}
            max={Math.max(1, line.product.stock)}
            label={`Quantity of ${line.product.name}`}
          />
          <div className="text-right">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Line total
            </p>
            <p className="font-display text-base font-medium tabular-nums">
              {formatPrice(lineTotal)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────

function EmptyState({ suggestedProducts }: { suggestedProducts: Product[] }) {
  return (
    <div className="mt-10">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground/60">
          <ShoppingBag className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-2xl tracking-tight">
          Your bag is empty
        </h2>
        <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          Looks like you haven&apos;t added anything yet. Browse the shop and
          find something worth keeping.
        </p>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <Button
            asChild
            className="press bg-foreground text-background hover:bg-foreground/90"
          >
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

      {suggestedProducts.length > 0 && (
        <section className="mt-12" aria-label="Suggested products">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-xl tracking-tight">
              You might like these
            </h2>
            <Link
              href="/shop"
              className="inline-flex items-center gap-1 text-xs font-medium text-copper hover:underline"
            >
              Shop all <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {suggestedProducts.map((p) => (
              <li key={p.slug}>
                <SuggestedCard product={p} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

// A slim inline card for suggested products in the empty-cart state —
// intentionally simpler than the full ProductCard (no rating row, no
// availability badge) so the empty state stays visually calm.
function SuggestedCard({ product }: { product: Product }) {
  return (
    <Link
      href={`/product/${product.slug}`}
      className="group flex flex-col gap-2 press"
    >
      <div className="relative aspect-square overflow-hidden rounded-lg border border-border/70 bg-card">
        <ProductVisual
          visualKey={product.visualKey}
          accent={product.accent}
          className="h-full w-full transition-transform duration-500 group-hover:scale-[1.04]"
        />
      </div>
      <p className="line-clamp-1 text-sm font-medium leading-tight group-hover:text-copper">
        {product.name}
      </p>
      <p className="font-display text-sm font-medium tabular-nums">
        {formatPrice(product.price)}
      </p>
    </Link>
  );
}

// ── Loading skeleton ───────────────────────────────────────────────────

function CartSkeleton() {
  return (
    <div
      className="mt-8 grid gap-8 lg:grid-cols-[1fr_22rem]"
      aria-busy="true"
      aria-label="Loading your bag"
    >
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex gap-4 pb-3 last:pb-0">
              <Skeleton className="h-20 w-20 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
                <Skeleton className="h-8 w-28" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    </div>
  );
}
