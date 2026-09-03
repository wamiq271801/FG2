import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { Link } from "@/components/shared/Link";
import { ArrowRight } from "lucide-react";
import { resolveFeedProducts } from "@/modules/catalog/products";
import { getStocks, overlayStock } from "@/modules/catalog/stock";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { WishlistItems } from "@/components/wishlist/WishlistItems";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Your wishlist",
  description:
    "Save gadgets you love and revisit them anytime. Your wishlist syncs across devices when you sign in.",
  robots: { index: false, follow: false },
  alternates: { canonical: "/wishlist" },
};

// Class B (user-specific) page: the shell renders PER REQUEST (Phase 2) —
// nothing user-scoped is ever publicly cached, and the interactive wishlist
// itself lives in the WishlistItems client island. The suggestion products
// assemble the cached feed scopes + card dataset with one live stock
// overlay, streamed inside Suspense so the shell paints immediately.
export default function WishlistPage() {
  return (
    <div className="container-edge py-6 lg:py-10">
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: "Wishlist" },
        ]}
      />

      <header className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Wishlist
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight md:text-4xl">
            Your wishlist
          </h1>
          <p className="mt-2 max-w-prose text-pretty text-sm leading-relaxed text-muted-foreground">
            Save items you love. They stay here for quick access — and sync
            across devices when you sign in.
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="press self-start sm:self-end">
          <Link href="/shop">
            <ArrowRight className="h-3.5 w-3.5" />
            Keep browsing
          </Link>
        </Button>
      </header>

      <Suspense fallback={null}>
        <WishlistSuggestions />
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

async function WishlistSuggestions() {
  const [featured, onSale] = await Promise.all([
    resolveFeedProducts("featured", 2),
    resolveFeedProducts("on-sale", 2),
  ]);
  const suggestedRaw = [...featured, ...onSale]
    .filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i)
    .slice(0, 4);
  const stockMap = await getStocks(suggestedRaw.map((p) => p.id));
  const suggested = overlayStock(suggestedRaw, stockMap);

  return <WishlistItems suggestedProducts={suggested} />;
}
