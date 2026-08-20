import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { ArrowRight } from "lucide-react";
import { getFeaturedProducts, getOnSaleProducts } from "@/modules/catalog/data";
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

export default async function WishlistPage() {
  const [featured, onSale] = await Promise.all([
    getFeaturedProducts(2),
    getOnSaleProducts(2),
  ]);
  const suggested = [...featured, ...onSale]
    .filter((p, i, arr) => arr.findIndex((x) => x.slug === p.slug) === i)
    .slice(0, 4);

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

      <WishlistItems suggestedProducts={suggested} />
    </div>
  );
}
