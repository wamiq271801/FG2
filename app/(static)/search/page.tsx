import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { Suspense } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { SearchResults } from "@/components/search/SearchResults";
import { getAllCategories, getCategoryProductCount, getTrendingProducts } from "@/modules/catalog/data";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  if (!q) {
    return {
      title: "Search",
      description:
        "Search Fusion Gadgets for headphones, keyboards, cameras, wearables and more.",
      alternates: { canonical: "/search" },
      robots: { index: false, follow: true },
    };
  }
  return {
    title: `Search: ${q}`,
    description: `Search results for “${q}” at Fusion Gadgets — headphones, keyboards, cameras, wearables, desk furniture and more.`,
    alternates: { canonical: "/search" },
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage() {
  // Server-render the trending products + categories so the shell (landing +
  // empty states) renders instantly. The actual search query runs client-side
  // via the public Supabase client.
  const [trendingProducts, categories] = await Promise.all([
    getTrendingProducts(4),
    getAllCategories(),
  ]);
  const categoriesWithCounts = await Promise.all(
    categories.map(async (c) => ({
      ...c,
      productCount: await getCategoryProductCount(c.slug),
    }))
  );

  return (
    <div className="container-edge py-8 lg:py-12">
      <Breadcrumbs
        items={[{ label: "Home", href: "/" }, { label: "Search" }]}
      />

      <header className="mt-6 max-w-3xl">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-copper" />
          Search
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
          Search products
        </h1>
        <p className="mt-3 text-[15px] leading-relaxed text-muted-foreground">
          Search across audio, computing, cameras, wearables, desks and more.
          Try “headphones”, “mechanical”, or “Lumen”.
        </p>

        <form action="/search" role="search" className="mt-6 flex items-center gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              name="q"
              placeholder="Search products, brands, categories…"
              className="h-11 pl-9 text-base"
              aria-label="Search products"
            />
          </div>
          <Button type="submit" size="lg" className="press">
            Search
          </Button>
        </form>
      </header>

      <Suspense fallback={<ResultsFallback />}>
        <SearchResults
          trendingProducts={trendingProducts}
          categories={categoriesWithCounts}
        />
      </Suspense>
    </div>
  );
}

function ResultsFallback() {
  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">Loading results…</p>
      </div>
    </div>
  );
}
