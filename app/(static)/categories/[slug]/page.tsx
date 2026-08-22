import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowRight, PackageOpen } from "lucide-react";
import { getProductsByCategoryId } from "@/modules/catalog/products";
import { getAllCategories, getCategoryBySlug } from "@/modules/catalog/categories";
import { getAllBrands } from "@/modules/catalog/brands";
import {
  applyFilters,
  applySort,
  buildQuery,
  countActiveFilters,
  parseFilters,
  paginate,
  priceBounds,
} from "@/modules/catalog/query";
import { ProductCard } from "@/components/shared/ProductCard";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { CategoryViewTracker } from "@/components/shared/CategoryViewTracker";
import { FilterPanel, type FilterFacet } from "@/components/shop/FilterPanel";
import { SortSelect } from "@/components/shop/SortSelect";
import { MobileFilters } from "@/components/shop/MobileFilters";
import { ActiveFilters } from "@/components/shop/ActiveFilters";
import { Pagination } from "@/components/shop/Pagination";
import { Button } from "@/components/ui/button";

const SITE_URL = "https://fusiongadgets.in";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateStaticParams() {
  const categories = await getAllCategories();
  return categories.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};

  const path = `/categories/${slug}`;
  const title = `${category.name} — ${category.tagline}`;
  const description = category.description;

  return {
    title: category.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} · Fusion Gadgets`,
      description,
      url: path,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} · Fusion Gadgets`,
      description,
    },
  };
}

function breadcrumbJsonLd(name: string, path: string) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop` },
      { "@type": "ListItem", position: 3, name, item: `${SITE_URL}${path}` },
    ],
  };
}

export const revalidate = 300;

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const basePath = `/categories/${slug}`;
  const inCategory = await getProductsByCategoryId(category.id);

  // The static shell (breadcrumbs, identity, JSON-LD, SEO paragraph) renders
  // immediately. The dynamic filter+results block is wrapped in <Suspense>
  // so the page streams — required by Next 16 for `searchParams` access.
  return (
    <div className="container-edge py-8 lg:py-12">
      <CategoryViewTracker slug={slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(breadcrumbJsonLd(category.name, basePath)),
        }}
      />

      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          { label: category.name },
        ]}
      />

      {/* Category identity */}
      <header
        className="relative mt-6 overflow-hidden rounded-xl border border-border bg-card"
        style={{ ["--accent" as string]: category.accent }}
      >
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            background: `radial-gradient(110% 80% at 90% 0%, color-mix(in oklch, ${category.accent} 18%, transparent), transparent 60%)`,
          }}
        />
        <div className="relative grid gap-6 p-7 lg:grid-cols-[1.4fr_1fr] lg:gap-10 lg:p-10">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="h-px w-8 bg-copper" />
              {inCategory.length}{" "}
              {inCategory.length === 1 ? "product" : "products"} · curated shelf
            </p>
            <h1 className="mt-4 font-display text-4xl leading-[1.04] tracking-tight md:text-5xl">
              {category.name}
            </h1>
            <p className="mt-2 text-base text-muted-foreground">
              {category.tagline}
            </p>
            <p className="mt-4 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
              {category.intro}
            </p>
          </div>

          {/* Subcategory discovery */}
            {category.subcategories.length > 0 && (
            <div className="flex flex-col gap-3 lg:items-end">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Subcategories
              </span>
              <div className="flex flex-wrap gap-2 lg:justify-end">
            {category.subcategories.map((s) => (
                  <Link
                    key={s}
                    href={`${basePath}?q=${encodeURIComponent(s)}`}
                    className="press rounded-full border border-border bg-background/60 px-3 py-1 text-xs font-medium text-foreground hover:border-copper/40 hover:text-copper"
                  >
                    {s}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </header>

      <Suspense fallback={<CategoryResultsFallback />}>
        <CategoryResults slug={slug} searchParams={searchParams} />
      </Suspense>

      {/* SEO closing paragraph */}
      <section className="mt-12 border-t border-border pt-10">
        <div className="mx-auto max-w-3xl text-pretty text-sm leading-relaxed text-muted-foreground">
          <h2 className="mb-3 font-display text-base tracking-tight text-foreground">
            About {category.name} at Fusion Gadgets
          </h2>
          <p>{category.seoNote}</p>
          <p className="mt-3">
            Browse the full{" "}
            <Link
              href="/shop"
              className="text-copper underline-offset-4 hover:underline"
            >
              shop
            </Link>{" "}
            or explore another shelf:{" "}
            {await (async () => {
              const others = (await getAllCategories())
                .filter((c) => c.slug !== slug)
                .slice(0, 4);
              return others.map((c, i, arr) => (
                <span key={c.slug}>
                  <Link
                    href={`/categories/${c.slug}`}
                    className="text-copper underline-offset-4 hover:underline"
                  >
                    {c.name}
                  </Link>
                  {i < arr.length - 1 ? " · " : "."}
                </span>
              ));
            })()}
          </p>
        </div>
      </section>
    </div>
  );
}

function CategoryResultsFallback() {
  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
      <aside className="hidden lg:block">
        <div className="h-64 animate-pulse rounded-md bg-muted" />
      </aside>
      <section>
        <div className="h-6 w-48 animate-pulse rounded bg-muted" />
        <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-3 lg:gap-x-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      </section>
    </div>
  );
}

async function CategoryResults({
  slug,
  searchParams,
}: {
  slug: string;
  searchParams: SearchParams;
}) {
  const category = await getCategoryBySlug(slug);
  if (!category) return null;

  const sp = await searchParams;
  const filters = parseFilters(sp);

  const [inCategory, allBrands] = await Promise.all([
    getProductsByCategoryId(category.id),
    getAllBrands(),
  ]);

  const filtered = applyFilters(inCategory, filters);
  const sorted = applySort(filtered, filters.sort);
  const page = paginate(sorted, filters.page);

  // Brand facets — only brands present in this category.
  const brandsInCategory = new Map<string, number>();
  for (const p of inCategory) {
    brandsInCategory.set(p.brand, (brandsInCategory.get(p.brand) ?? 0) + 1);
  }
  const brandFacets: FilterFacet[] = allBrands
    .filter((b) => brandsInCategory.has(b.slug))
    .map((b) => ({
      slug: b.slug,
      name: b.name,
      count: brandsInCategory.get(b.slug) ?? 0,
    }))
    .sort((a, b) => b.count - a.count);

  const bounds = priceBounds(inCategory);
  const basePath = `/categories/${slug}`;
  const activeCount = countActiveFilters(filters);

  const pagelessQuery = buildQuery({
    brands: filters.brands,
    availability: filters.availability,
    minPrice: filters.minPrice,
    maxPrice: filters.maxPrice,
    query: filters.query,
    sort: filters.sort,
  });

  return (
    <div className="mt-8 grid gap-8 lg:grid-cols-[18rem_minmax(0,1fr)] lg:gap-10">
      {/* Desktop filter sidebar */}
      <aside className="hidden lg:block">
        <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto pr-1">
          <FilterPanel
            categories={[]}
            brands={brandFacets}
            priceBounds={bounds}
            basePath={basePath}
            lockCategory
          />
        </div>
      </aside>

      {/* Results column */}
      <section aria-label={`${category.name} products`} className="min-w-0">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div className="flex flex-col gap-1">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">{page.total}</span>{" "}
              {page.total === 1 ? "product" : "products"} in {category.name}
              {filters.query && (
                <>
                  {" "}matching{" "}
                  <span className="font-medium text-foreground">
                    “{filters.query}”
                  </span>
                </>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">
              Page {page.page} of {page.totalPages}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <MobileFilters
              categories={[]}
              brands={brandFacets}
              priceBounds={bounds}
              basePath={basePath}
              lockCategory
              activeCount={activeCount}
            />
            <SortSelect basePath={basePath} className="w-[15rem]" />
          </div>
        </div>

        {/* Active filter chips */}
        <div className="mt-4">
          <ActiveFilters filters={filters} basePath={basePath} categories={[]} brands={allBrands} lockCategory />
        </div>

        {/* Results */}
        {page.items.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-3 lg:gap-x-6">
            {page.items.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        ) : (
          <div className="mt-10 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border bg-card/50 px-6 py-16 text-center">
            <PackageOpen
              className="h-10 w-10 text-muted-foreground"
              strokeWidth={1.25}
            />
            <div>
              <h2 className="font-display text-2xl tracking-tight">
                Nothing here yet.
              </h2>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                No products in {category.name} match these filters. Try clearing
                them or browsing the whole shelf.
              </p>
            </div>
            <Button asChild className="press">
              <Link href={basePath}>
                <ArrowRight className="h-4 w-4" />
                Clear filters
              </Link>
            </Button>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          basePath={basePath}
          queryString={pagelessQuery}
          page={page.page}
          totalPages={page.totalPages}
        />
      </section>
    </div>
  );
}
