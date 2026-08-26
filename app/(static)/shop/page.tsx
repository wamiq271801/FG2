import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { Suspense } from "react";
import { ArrowRight, PackageOpen, SlidersHorizontal } from "lucide-react";
import { getAllProducts } from "@/modules/catalog/products";
import { getAllCategories } from "@/modules/catalog/categories";
import { getAllBrands } from "@/modules/catalog/brands";
import {
  applyFilters,
  applySort,
  buildQuery,
  countActiveFilters,
  parseFilters,
  paginate,
  priceBounds,
  type Filters,
} from "@/modules/catalog/query";
import { ProductCard } from "@/components/shared/ProductCard";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { FilterPanel, type FilterFacet } from "@/components/shop/FilterPanel";
import { SortSelect } from "@/components/shop/SortSelect";
import { MobileFilters } from "@/components/shop/MobileFilters";
import { ActiveFilters } from "@/components/shop/ActiveFilters";
import { Pagination } from "@/components/shop/Pagination";
import { Button } from "@/components/ui/button";

const BASE_PATH = "/shop";

export const metadata: Metadata = {
  title: "Shop all gadgets",
  description:
    "Browse every Fusion Gadgets product — headphones, mechanical keyboards, cameras, wearables, desk furniture and more. Shipped across India from Bahraich.",
  alternates: { canonical: "/shop" },
  openGraph: {
    title: "Shop all gadgets · Fusion Gadgets",
    description:
      "Every product we audition and ship — across audio, computing, cameras, wearables, desks and more.",
    url: "/shop",
    type: "website",
  },
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function ShopPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // Next 16 requires pages reading `searchParams` to be wrapped in a Suspense
  // boundary. The fallback renders a lightweight skeleton while the dynamic
  // filtered results resolve server-side.
  return (
    <Suspense fallback={<ShopFallback />}>
      <ShopInner searchParams={searchParams} />
    </Suspense>
  );
}

function ShopFallback() {
  return (
    <div className="container-edge py-8 lg:py-12">
      <div className="h-3 w-24 animate-pulse rounded bg-muted" />
      <div className="mt-6 h-12 w-72 animate-pulse rounded bg-muted" />
      <div className="mt-4 h-4 w-full max-w-md animate-pulse rounded bg-muted" />
      <div className="mt-8 h-10 w-full animate-pulse rounded bg-muted" />
      <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    </div>
  );
}

async function ShopInner({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const filters = parseFilters(sp);

  const [allProducts, allCategories, allBrands] = await Promise.all([
    getAllProducts(),
    getAllCategories(),
    getAllBrands(),
  ]);

  // Filtered + sorted product list (server-side).
  const filtered = applyFilters(allProducts, filters);
  const sorted = applySort(filtered, filters.sort);
  const page = paginate(sorted, filters.page);

  // Facets: counts computed against the un-filtered-by-this-facet set.
  // Category counts come from the already-loaded product list — no extra
  // per-category count queries.
  const catCountMap = new Map<string, number>();
  for (const p of allProducts) {
    if (p.categoryId) {
      catCountMap.set(p.categoryId, (catCountMap.get(p.categoryId) ?? 0) + 1);
    }
  }
  const catCounts = allCategories.map((c) => catCountMap.get(c.id) ?? 0);
  const catFacets: FilterFacet[] = allCategories
    .map((c, i) => ({ slug: c.slug, name: c.name, count: catCounts[i] }))
    .filter((c) => c.count > 0);

  const brandFacets: FilterFacet[] = allBrands
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      count: allProducts.filter((p) => p.brand === b.slug).length,
    }))
    .filter((b) => b.count > 0)
    .sort((a, b) => b.count - a.count);

  const bounds = priceBounds(allProducts);

  const activeCount = countActiveFilters(filters);

  // Query string without `page`, used by Pagination links to preserve filters.
  const pagelessQuery = buildQuery({
    categories: filters.categories,
    brands: filters.brands,
    availability: filters.availability,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    query: filters.query,
    sort: filters.sort,
  });

  return (
    <div className="container-edge py-8 lg:py-12">
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Shop" }]} />

      {/* Page identity */}
      <header className="mt-6 max-w-3xl">
        <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span className="h-px w-8 bg-copper" />
          All gadgets · {allProducts.length} products
        </p>
        <h1 className="mt-4 font-display text-4xl leading-[1.05] tracking-tight md:text-5xl">
          Shop all gadgets
        </h1>
        <p className="mt-4 text-pretty text-[15px] leading-relaxed text-muted-foreground">
          Every product on the shelf — picked by people who actually use the gear
          and shipped across India. Filter by category, brand or budget; sort by
          what people are actually buying.
        </p>
      </header>

      {/* Category discovery */}
      <section className="mt-8 border-b border-border pb-8">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Browse
          </span>
          {allCategories.map((c, i) => {
            const active = filters.categories.includes(c.slug);
            return (
              <Link
                key={c.slug}
                href={`/categories/${c.slug}`}
                aria-label={`${c.name} — ${catCounts[i]} products`}
                className={`press rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-copper/50 bg-copper/10 text-copper"
                    : "border-border bg-card text-foreground hover:border-copper/40 hover:text-copper"
                }`}
              >
                {c.name}
                <span className="ml-1.5 text-muted-foreground">
                  {catCounts[i]}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Main grid: sidebar + results */}
      <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
        {/* Desktop filter sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
            <FilterPanel
              categories={catFacets}
              brands={brandFacets}
              priceBounds={bounds}
              basePath={BASE_PATH}
            />
          </div>
        </aside>

        {/* Results column */}
        <section aria-label="Product results" className="min-w-0">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <div className="flex flex-col gap-1">
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">
                  {page.total}
                </span>{" "}
                {page.total === 1 ? "product" : "products"}
                {filters.query && (
                  <>
                    {" "}for <span className="font-medium text-foreground">“{filters.query}”</span>
                  </>
                )}
              </p>
              <p className="text-[11px] text-muted-foreground">
                Page {page.page} of {page.totalPages} · sorted by{" "}
                {labelForSort(filters.sort)}
              </p>
            </div>

            <div className="flex items-center gap-2">
              <MobileFilters
                categories={catFacets}
                brands={brandFacets}
                priceBounds={bounds}
                basePath={BASE_PATH}
                activeCount={activeCount}
              />
              <SortSelect basePath={BASE_PATH} className="w-[15rem]" />
            </div>
          </div>

          {/* Active filter chips */}
          <div className="mt-4">
            <ActiveFilters filters={filters} basePath={BASE_PATH} categories={allCategories} brands={allBrands} />
          </div>

          {/* Results */}
          {page.items.length > 0 ? (
            <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-3 lg:gap-x-6">
              {page.items.map((p) => (
                <ProductCard key={p.slug} product={p} />
              ))}
            </div>
          ) : (
            <EmptyState filters={filters} hasQuery={Boolean(filters.query)} />
          )}

          {/* Pagination */}
          <Pagination
            basePath={BASE_PATH}
            queryString={pagelessQuery}
            page={page.page}
            totalPages={page.totalPages}
          />

          {/* Helper footer */}
          <div className="mt-4 flex items-center justify-between border-t border-border pt-4 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              Use the filters to narrow by category, brand, availability or price.
            </span>
            <span>
              Showing {page.items.length} of {page.total}
            </span>
          </div>
        </section>
      </div>
    </div>
  );
}

function labelForSort(sort: Filters["sort"]): string {
  switch (sort) {
    case "price-asc":
      return "price (low → high)";
    case "price-desc":
      return "price (high → low)";
    case "newest":
      return "newest";
    case "rating":
      return "top rated";
    case "popular":
    default:
      return "popularity";
  }
}

function EmptyState({
  filters,
  hasQuery,
}: {
  filters: Filters;
  hasQuery: boolean;
}) {
  return (
    <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
      <PackageOpen className="h-10 w-10 text-muted-foreground" strokeWidth={1.25} />
      <div>
        <h2 className="font-display text-2xl tracking-tight">No products match.</h2>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {hasQuery
            ? "We couldn't find any products for those filters and that search term. Try widening your budget or clearing your filters."
            : "We couldn't find any products for those filters. Try widening your budget or clearing a facet."}
        </p>
      </div>
      <Button asChild className="press">
        <Link href={BASE_PATH}>
          <ArrowRight className="h-4 w-4" />
          Clear all filters &amp; browse everything
        </Link>
      </Button>
      {/* Also clear just the query */}
      {hasQuery && (
        <Link
          href={`${BASE_PATH}${buildQuery({
            categories: filters.categories,
            brands: filters.brands,
            availability: filters.availability,
            minPrice: filters.minPrice,
            maxPrice: filters.maxPrice,
            sort: filters.sort,
          })}`}
          className="text-xs text-muted-foreground hover:text-copper hover:underline"
        >
          Clear just the search term
        </Link>
      )}
    </div>
  );
}
