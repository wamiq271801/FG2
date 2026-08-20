"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { SearchX, Sparkles, Layers, ArrowRight, Loader2 } from "lucide-react";
import { Link } from "@/components/shared/Link";
import { ProductCard } from "@/components/shared/ProductCard";
import { Button } from "@/components/ui/button";
import {
  searchProductsClient,
  getTrendingProductsClient,
} from "@/modules/catalog/client";
import { trackSearch } from "@/services/tracking";
import type { Category, Product } from "@/types";

type CategoryWithCount = Category & { productCount: number };

/**
 * SearchResults — the dynamic result area of the /search page.
 *
 * The surrounding page shell (heading, search input, surrounding navigation)
 * is server-rendered and appears immediately. This component owns only the
 * result area. Search queries Supabase directly from the browser (public
 * client, RLS-constrained). The trending products and categories shown on
 * the landing/empty states are passed from the server as props so the shell
 * renders instantly without a client-side fetch.
 */
export function SearchResults({
  trendingProducts,
  categories: categoriesWithCounts,
}: {
  trendingProducts: Product[];
  categories: CategoryWithCount[];
}) {
  const searchParams = useSearchParams();
  const q = (searchParams.get("q") ?? "").trim();

  const [status, setStatus] = useState<"loading" | "done">("loading");
  const [results, setResults] = useState<Product[]>([]);

  useEffect(() => {
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([]);
      setStatus("done");
      return;
    }
    setStatus("loading");
    trackSearch(q);
    let cancelled = false;
    searchProductsClient(q)
      .then((r) => {
        if (!cancelled) {
          setResults(r);
          setStatus("done");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResults([]);
          setStatus("done");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  if (!q) {
    return <LandingBody trendingProducts={trendingProducts} categories={categoriesWithCounts} />;
  }

  if (status === "loading") {
    return <LoadingBody q={q} />;
  }

  if (results.length === 0) {
    return (
      <EmptyBody
        q={q}
        trendingProducts={trendingProducts}
        categories={categoriesWithCounts}
      />
    );
  }

  const relatedCategories = matchedCategories(q, categoriesWithCounts);

  return (
    <div className="mt-10">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">{results.length}</span>{" "}
          {results.length === 1 ? "result" : "results"} for{" "}
          <span className="font-medium text-foreground">“{q}”</span>
        </p>
        <Link
          href="/shop"
          className="text-sm font-medium text-muted-foreground hover:text-copper"
        >
          Or browse the shop →
        </Link>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {results.map((p) => (
          <ProductCard key={p.slug} product={p} />
        ))}
      </div>

      <CategoryGrid
        categories={relatedCategories}
        heading="Browse by category"
        eyebrow="Related shelves"
      />
    </div>
  );
}

function LoadingBody({ q }: { q: string }) {
  return (
    <div className="mt-10" aria-busy="true" aria-live="polite">
      <div className="flex items-center justify-between gap-4 border-b border-border pb-4">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin text-copper" />
          Searching for “{q}”…
        </p>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

function EmptyBody({
  q,
  trendingProducts,
  categories,
}: {
  q: string;
  trendingProducts: Product[];
  categories: CategoryWithCount[];
}) {
  const relatedCategories = matchedCategories(q, categories);
  return (
    <div className="mt-10">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-14 text-center">
        <SearchX className="h-10 w-10 text-muted-foreground" strokeWidth={1.25} />
        <div>
          <h2 className="font-display text-2xl tracking-tight">
            No matches for “{q}”.
          </h2>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            We couldn&apos;t find any products, brands or categories matching
            your search. Try a shorter query, a different word, or browse
            what&apos;s popular below.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild className="press">
            <Link href="/shop">
              <ArrowRight className="h-4 w-4" /> Browse all products
            </Link>
          </Button>
          <Button asChild variant="outline" className="press">
            <Link href="/search">Clear search</Link>
          </Button>
        </div>
      </div>

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-copper" />
              Popular right now
            </p>
            <h2 className="mt-2 font-display text-2xl tracking-tight">
              What other people are buying
            </h2>
          </div>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {trendingProducts.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>

      <CategoryGrid
        categories={relatedCategories}
        heading="Start with a category"
        eyebrow="Browse shelves"
      />
    </div>
  );
}

function LandingBody({
  trendingProducts,
  categories,
}: {
  trendingProducts: Product[];
  categories: CategoryWithCount[];
}) {
  return (
    <div className="mt-10">
      <p className="text-sm text-muted-foreground">
        Type a query above to search across the catalog and {categories.length}{" "}
        categories.
      </p>

      <section className="mt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-copper" />
              Popular right now
            </p>
            <h2 className="mt-2 font-display text-2xl tracking-tight">
              Or start with what&apos;s trending
            </h2>
          </div>
          <Link
            href="/shop"
            className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex"
          >
            Browse the shop <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
          {trendingProducts.map((p) => (
            <ProductCard key={p.slug} product={p} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CategoryGrid({
  categories,
  heading,
  eyebrow,
}: {
  categories: CategoryWithCount[];
  heading: string;
  eyebrow: string;
}) {
  return (
    <section className="mt-12 border-t border-border pt-10">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <Layers className="h-3.5 w-3.5 text-copper" />
            {eyebrow}
          </p>
          <h2 className="mt-2 font-display text-2xl tracking-tight">{heading}</h2>
        </div>
        <Link
          href="/shop"
          className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex"
        >
          All categories <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/categories/${c.slug}`}
            className="press group flex flex-col gap-1 rounded-xl border border-border bg-card p-4 hover:border-copper/40"
          >
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {c.productCount} products
            </span>
            <span className="font-display text-base leading-tight tracking-tight group-hover:text-copper">
              {c.name}
            </span>
            <span className="line-clamp-1 text-xs text-muted-foreground">
              {c.tagline}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function matchedCategories(
  q: string,
  categories: CategoryWithCount[]
): CategoryWithCount[] {
  const matched = categories.filter((c) => {
    const hay = `${c.name} ${c.tagline} ${c.description}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });
  return matched.length > 0 ? matched : categories.slice(0, 4);
}
