import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { notFound } from "next/navigation";
import { ArrowRight, Package, ShieldCheck, Truck, RotateCcw } from "lucide-react";
import {
  getProductBySlug,
  getRelatedProducts,
  getProductVariation,
} from "@/modules/catalog/products";
import { getActiveOffersForProduct } from "@/modules/catalog/offers";
import { getReviewData } from "@/modules/review/data";
import { getStocks } from "@/modules/catalog/stock";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { ProductCard } from "@/components/shared/ProductCard";
import { LiveAvailabilityBadge } from "@/components/shared/LiveAvailabilityBadge";
import { ProductViewTracker } from "@/components/shared/ProductViewTracker";
import { Gallery } from "@/components/product/Gallery";
import { VariationSelector } from "@/components/product/VariationSelector";
import { PurchaseControls } from "@/components/product/PurchaseControls";
import { WishlistButton } from "@/components/product/WishlistButton";
import { RatingSummary as ProductRatingSummary } from "@/components/review/RatingSummary";
import { RatingDistribution } from "@/components/review/RatingDistribution";
import { ReviewList } from "@/components/review/ReviewList";
import { ReviewActions } from "@/components/review/ReviewActions";
import { Button } from "@/components/ui/button";
import { Price } from "@/components/shared/Price";
import { JsonLd } from "@/components/shared/JsonLd";
import {
  breadcrumbRef,
  buildBreadcrumbList,
  buildJsonLdGraph,
  buildProduct,
  productRef,
  webPageEntity,
} from "@/lib/schema";
import type { Product } from "@/types";

type Params = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  // Reads through the same cached product-detail scope as the page — one
  // cache entry per slug serves both the metadata and the page render.
  const product = await getProductBySlug(slug);
  if (!product) return {};

  const path = `/product/${slug}`;
  const description = product.tagline ?? product.description?.slice(0, 155) ?? "";

  return {
    title: product.name,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      title: `${product.name} · Fusion Gadgets`,
      description,
      url: path,
      siteName: "Fusion Gadgets",
      images: product.images.length
        ? product.images.map((i) => ({ url: i, alt: product.name }))
        : [{ url: "/images/hero-flatlay.jpg", alt: product.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.name} · Fusion Gadgets`,
      description,
    },
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  // COMPLETE server-rendered page: params are awaited directly in the page
  // and every scope (cached product detail, reviews, offers + LIVE variation
  // membership and stock) is resolved before the page renders. The route
  // renders per request in full — with the root layout's above-body Suspense
  // boundary as the official fully-dynamic opt-in — so the response contains
  // the complete product page and client navigation commits the new page
  // only once it is fully rendered (the previous page stays visible until
  // then).
  const { slug } = await params;

  // UNcached page render assembling the cached scopes (Phase 2): the
  // product-detail scope, the review scope, the offers scope, plus LIVE
  // variation membership (never cached — it selects stock) and one LIVE
  // batched stock read for the product and its variation siblings.
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const variation = await getProductVariation(product.id);
  const variationItems = variation?.items ?? [];
  const siblingIds = variationItems
    .map((i) => i.productId)
    .filter((id) => id !== product.id);

  const [related, reviewData, offers, stockMap] = await Promise.all([
    getRelatedProducts(product, 4),
    getReviewData(product.id),
    getActiveOffersForProduct(product.id),
    getStocks([product.id, ...siblingIds]),
  ]);
  const { summary: reviewSummary, latest: latestReviews } = reviewData;

  // Live availability overlay — the server-rendered initial state for the
  // badge, purchase controls and JSON-LD offers.availability (SEO).
  const stockInfo = stockMap.get(product.id);
  const liveProduct: Product = stockInfo
    ? { ...product, stock: stockInfo.stock, availability: stockInfo.availability }
    : product;

  const hasVariation = variationItems.length >= 2;

  const productPath = `/product/${product.slug}`;
  const description = product.tagline ?? product.description?.slice(0, 155) ?? "";

  // ONE JSON-LD graph: WebPage → BreadcrumbList + Product (main entity).
  // Built entirely from data this page has already loaded — no additional
  // queries. Brand/category names come from the product relation above; a
  // missing brand is omitted, never replaced with the store name.
  const productGraph = buildJsonLdGraph(
    webPageEntity({
      path: productPath,
      name: product.name,
      description,
      mainEntity: productRef(product.slug),
      breadcrumb: breadcrumbRef(productPath),
    }),
    buildBreadcrumbList(productPath, [
      { name: "Home", path: "/" },
      { name: "Shop", path: "/shop" },
      ...(product.categoryName
        ? [{ name: product.categoryName, path: `/categories/${product.category}` }]
        : []),
      { name: product.name },
    ]),
    buildProduct({
      product: liveProduct,
      brandName: product.brandName,
      categoryName: product.categoryName,
      reviewSummary,
      reviews: latestReviews,
    })
  );

  const primaryImage = product.images[0];

  return (
    <article className="container-edge py-6 lg:py-10">
      {/* Structural note: the article opens with pure server-rendered content.
          The two zero-visual-output nodes (ProductViewTracker client island
          and the server-owned JSON-LD script) live at the TAIL of the article
          so the server tree and the first client tree are identical,
          deterministic siblings — content first, hidden/tracking nodes last. */}
      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          {
            label: product.categoryName ?? "Category",
            href: `/categories/${product.category}`,
          },
          { label: product.name },
        ]}
      />

      <div className="mt-6 grid gap-8 lg:grid-cols-2 lg:gap-12">
        <div>
          {primaryImage ? (
            <img
              src={primaryImage}
              alt={product.name}
              width={600}
              height={600}
              data-product-main-image
              className="aspect-square w-full rounded-xl border border-border bg-card object-cover"
            />
          ) : (
            <div className="aspect-square rounded-xl border border-border bg-card" />
          )}
          {product.images.length > 1 && (
            <div className="mt-3">
              <Gallery
                images={product.images}
                name={product.name}
                visualKey={product.visualKey}
                accent={product.accent}
              />
            </div>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          {product.brandName && (
            <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              <span className="h-px w-6 bg-copper" />
              {product.brandName}
              <span className="text-muted-foreground/50">·</span>
              <span>{product.brandCountry}</span>
            </p>
          )}

          <div className="mt-2 flex items-start gap-3">
            <h1 className="font-display text-3xl leading-[1.05] tracking-tight text-balance md:text-4xl lg:text-[2.75rem]">
              {product.name}
            </h1>
            <WishlistButton
              productId={product.id}
              name={product.name}
              slug={product.slug}
              variant="outline"
              size="icon"
              className="mt-1 h-9 w-9 shrink-0 rounded-full border-border"
            />
          </div>
          {product.subtitle && (
            <p className="mt-1.5 text-sm text-muted-foreground">{product.subtitle}</p>
          )}

          <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2">
            <Price price={product.price} compareAt={product.compareAt} size="lg" />
            <LiveAvailabilityBadge
              productId={product.id}
              siblingIds={siblingIds}
              initialAvailability={liveProduct.availability}
              initialStock={liveProduct.stock}
            />
          </div>

          <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
            {product.description ?? product.tagline}
          </p>

          {hasVariation && (
            <VariationSelector
              options={variationItems}
              selectedProductId={product.id}
              className="mt-6"
            />
          )}

          <PurchaseControls product={liveProduct} offers={offers} />

          {product.highlights && product.highlights.length > 0 && (
            <ul className="mt-7 space-y-2.5 border-t border-border pt-6">
              {product.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-0.5 h-4 w-4 shrink-0 text-copper">✓</span>
                  <span className="text-foreground/90">{h}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Story */}
      {product.story && (
        <section
          id="story"
          aria-labelledby="story-heading"
          className="mt-16 border-t border-border pt-12 lg:mt-24"
        >
          <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
                The story
              </p>
              <h2
                id="story-heading"
                className="mt-3 font-display text-2xl tracking-tight md:text-3xl"
              >
                About this product
              </h2>
            </div>
            <div className="max-w-2xl text-pretty text-[16px] leading-[1.75] text-foreground/85">
              <p className="text-lg font-medium text-foreground">
                {product.tagline}
              </p>
              <p className="mt-5">{product.story}</p>
            </div>
          </div>
        </section>
      )}

      {/* In the box + Specifications */}
      <section
        aria-labelledby="details-heading"
        className="mt-16 grid gap-10 border-t border-border pt-12 lg:mt-20 lg:grid-cols-2 lg:gap-16"
      >
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
            In the box
          </p>
          <h2
            id="details-heading"
            className="mt-3 font-display text-2xl tracking-tight"
          >
            What&apos;s included
          </h2>
          <ul className="mt-5 space-y-2.5">
            {(product.includes ?? []).map((item) => (
              <li
                key={item}
                className="flex items-center gap-3 text-sm text-foreground/90"
              >
                <Package className="h-4 w-4 shrink-0 text-copper" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
            Specifications
          </p>
          <h2 className="mt-3 font-display text-2xl tracking-tight">
            Technical details
          </h2>
          <dl className="mt-5 divide-y divide-border overflow-hidden rounded-lg border border-border">
            {/* key = each spec row's own `key` field (its stable identity in
                the products.specs JSONB data — unique within a product). */}
            {(product.specs ?? []).map((s) => (
              <div
                key={s.key}
                className="grid grid-cols-[10rem_minmax(0,1fr)] gap-2 bg-card px-4 py-2.5 odd:bg-card/60"
              >
                <dt className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {s.key}
                </dt>
                <dd className="text-sm text-foreground">{s.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Shipping & returns */}
      <section
        aria-labelledby="shipping-heading"
        className="mt-16 border-t border-border pt-12 lg:mt-20"
      >
        <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
              Shipping & returns
            </p>
            <h2
              id="shipping-heading"
              className="mt-3 font-display text-2xl tracking-tight"
            >
              Shipping & returns
            </h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2.5">
                <Truck className="h-4 w-4 text-copper" />
                <h3 className="font-display text-base tracking-tight">
                  Shipping
                </h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {product.shipping ?? "Ships within 24 hours. Free delivery across India in 2\u20134 days."}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-5">
              <div className="flex items-center gap-2.5">
                <ShieldCheck className="h-4 w-4 text-copper" />
                <h3 className="font-display text-base tracking-tight">
                  Warranty & returns
                </h3>
              </div>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {product.warranty ?? "1-year manufacturer warranty. 7-day return window."}
              </p>
              <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <RotateCcw className="h-3.5 w-3.5" /> 7-day returns
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5" /> Free across India
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Reviews */}
      <section
        id="reviews"
        aria-labelledby="reviews-heading"
        className="mt-16 scroll-mt-24 border-t border-border pt-12 lg:mt-20"
      >
        <div className="grid gap-8 lg:grid-cols-[16rem_minmax(0,1fr)] lg:gap-12">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
              Reviews
            </p>
            <h2
              id="reviews-heading"
              className="mt-3 font-display text-2xl tracking-tight"
            >
              Customer reviews
            </h2>
            <ProductRatingSummary
              summary={reviewSummary}
              fallbackRating={product.rating}
              fallbackCount={product.reviewCount}
            />
            {reviewSummary && reviewSummary.count > 0 && (
              <div className="mt-4">
                <RatingDistribution
                  distribution={reviewSummary.distribution}
                  count={reviewSummary.count}
                />
              </div>
            )}
            <div className="mt-4">
              <ReviewActions productId={product.id} slug={product.slug} />
            </div>
            {reviewSummary && reviewSummary.count > 4 && (
              <Button asChild variant="link" className="mt-2 h-auto px-0 text-copper">
                <Link href={`/products/${product.slug}/reviews`}>
                  Read all {reviewSummary.count} reviews <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </Button>
            )}
          </div>

          <div>
            {latestReviews.length > 0 ? (
              <ReviewList reviews={latestReviews} slug={product.slug} />
            ) : (
              <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border bg-card/40 p-8 text-center">
                <div>
                  <h3 className="font-display text-lg tracking-tight">
                    No reviews yet.
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Reviews appear here after a delivered purchase.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Related */}
      {related.length > 0 && (
        <section
          aria-labelledby="related-heading"
          className="mt-16 border-t border-border pt-12 lg:mt-20"
        >
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                <span className="mr-2 inline-block h-px w-6 bg-copper align-middle" />
                You might also like
              </p>
              <h2
                id="related-heading"
                className="mt-3 font-display text-2xl tracking-tight md:text-3xl"
              >
                You might also like
              </h2>
            </div>
            <Link
              href={`/categories/${product.category}`}
              className="hidden shrink-0 items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground sm:flex"
            >
              More in {product.categoryName} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {/* Related cards render inside the page's request-time Suspense
                tree — the NEW badge's current-time read is a request-time
                value (no cached scope wraps it). */}
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}

      {/* Tracking island — renders nothing on server and on first client
          render; its effect fires on mount regardless of tree position. */}
      <ProductViewTracker slug={slug} />

      {/* Server-rendered JSON-LD — the final node of the article. It is
          owned entirely by the server component tree and never moves. */}
      <JsonLd data={productGraph} />
    </article>
  );
}
