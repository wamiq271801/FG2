"use client";

import { Link } from "@/components/shared/Link";
import { Heart, ShoppingBag, ArrowRight } from "lucide-react";
import { useWishlistSlugs } from "@/modules/wishlist";
import { useProductsBySlugs } from "@/modules/catalog/useProducts";
import { ProductCard } from "@/components/shared/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Product } from "@/types";

type Props = {
  suggestedProducts?: Product[];
};

export function WishlistItems({ suggestedProducts = [] }: Props) {
  const { slugs, ready, loading } = useWishlistSlugs();
  const { products, loading: productsLoading } = useProductsBySlugs(slugs);

  if (!ready || loading || (slugs.length > 0 && productsLoading)) {
    return <WishlistSkeleton />;
  }

  if (slugs.length === 0) {
    return <EmptyState suggestedProducts={suggestedProducts} />;
  }

  return (
    <div className="mt-8">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-xl tracking-tight">
          {slugs.length} {slugs.length === 1 ? "saved item" : "saved items"}
        </h2>
        <span className="text-xs text-muted-foreground">
          Tap the heart on any product to save it here
        </span>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {products.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ suggestedProducts }: { suggestedProducts: Product[] }) {
  return (
    <div className="mt-10">
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/60 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted text-foreground/60">
          <Heart className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-2xl tracking-tight">
          Your wishlist is empty
        </h2>
        <p className="mt-2 max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground">
          Save items you love by tapping the heart icon. They&apos;ll stay here
          for quick access — across devices when you sign in.
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
                <ProductCard product={p} compact />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function WishlistSkeleton() {
  return (
    <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-square rounded-xl" />
          <Skeleton className="h-3 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      ))}
    </div>
  );
}
