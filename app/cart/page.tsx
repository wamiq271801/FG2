import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Link } from "@/components/shared/Link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { resolveFeedProducts } from "@/modules/catalog/products";
import { getStocks, overlayStock } from "@/modules/catalog/stock";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { CartItems } from "@/components/cart/CartItems";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Your bag",
  description:
    "Review the gadgets in your bag and proceed to a secure checkout. Free shipping across India over ₹4,990.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/cart" },
};

// Class B (user-specific) page: the shell renders PER REQUEST (Phase 2) —
// nothing user-scoped is ever publicly cached, and the interactive cart
// itself lives in the CartItems client island. The suggestion products
// assemble the cached feed scopes + card dataset with one live stock
// overlay, streamed inside Suspense so the shell paints immediately.
export default function CartPage() {
  return (
    <div className="container-edge py-6 lg:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: "Bag" },
        ]}
      />

      {/* Server-rendered shell — always visible */}
      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Bag
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
            Your bag
          </h1>
          <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
            Review the items you&apos;ve set aside. Adjust quantities, remove
            what you don&apos;t need, then proceed to a secure checkout when
            you&apos;re ready.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="press self-start sm:self-end">
          <Link href="/shop">
            <ShoppingBag className="h-4 w-4" />
            Keep shopping
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </header>

      {/* Interactive body — client island handles hydration + empty + populated states */}
      <Suspense fallback={null}>
        <CartSuggestions />
      </Suspense>

      {/* Dynamic marker: guarantees the shell renders per request (official
          Cache Components pattern — see the search page). */}
      <Suspense>
        <ConnectionMarker />
      </Suspense>
    </div>
  );
}

async function ConnectionMarker() {
  await connection();
  return null;
}

async function CartSuggestions() {
  // Pull a few suggestions server-side for the empty-cart state — preferred
  // editorial picks + a couple of on-sale items so the suggestions feel fresh.
  const [featured, onSale] = await Promise.all([
    resolveFeedProducts("featured", 2),
    resolveFeedProducts("on-sale", 2),
  ]);
  const suggestedRaw = [...featured, ...onSale]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .slice(0, 4);
  const stockMap = await getStocks(suggestedRaw.map((p) => p.id));
  const suggested = overlayStock(suggestedRaw, stockMap);

  return <CartItems suggestedProducts={suggested} />;
}
