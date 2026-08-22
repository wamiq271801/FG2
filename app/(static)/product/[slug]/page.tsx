import type { Metadata } from "next";
import { Link } from "@/components/shared/Link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  Check,
  Package,
  ShieldCheck,
  Truck,
  RotateCcw,
} from "lucide-react";
import {
  getProductBySlug,
  getProductsByIds,
  getRelatedProducts,
} from "@/modules/catalog/data";
import { getBrandBySlug, getCategoryBySlug } from "@/modules/catalog/data";
import { getLatestReviews, getReviewSummary } from "@/modules/review/data";
import { Breadcrumbs } from "@/components/shared/Breadcrumbs";
import { Price } from "@/components/shared/Price";
import { RatingStars } from "@/components/shared/RatingStars";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import { ProductCard } from "@/components/shared/ProductCard";
import { ProductViewTracker } from "@/components/shared/ProductViewTracker";
import { BuyBox } from "@/components/product/BuyBox";
import { RatingSummary as ProductRatingSummary } from "@/components/review/RatingSummary";
import { RatingDistribution } from "@/components/review/RatingDistribution";
import { ReviewList } from "@/components/review/ReviewList";
import { ReviewActions } from "@/components/review/ReviewActions";
import { Button } from "@/components/ui/button";
import type { Availability, Product } from "@/types";

const SITE_URL = "https://fusiongadgets.in";

export const revalidate = 300;

type Params = Promise<{ slug: string }>;

export async function generateStaticParams() {
  const { getAllProducts } = await import("@/modules/catalog/data");
  const products = await getAllProducts();
  return products.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
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

function availabilitySchema(a: Availability): string {
  switch (a) {
    case "out-of-stock":
      return "https://schema.org/OutOfStock";
    case "preorder":
      return "https://schema.org/PreOrder";
    case "low-stock":
      return "https://schema.org/LimitedAvailability";
    default:
      return "https://schema.org/InStock";
  }
}

function productJsonLd(
  product: NonNullable<Awaited<ReturnType<typeof getProductBySlug>>>,
  brandName: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    image: product.images.length
      ? product.images
      : [`${SITE_URL}/images/hero-flatlay.jpg`],
    description: product.description ?? product.tagline,
    sku: product.slug.toUpperCase(),
    mpn: product.slug.toUpperCase(),
    brand: {
      "@type": "Brand",
      name: brandName,
    },
    category: product.subcategory ?? product.category,
    aggregateRating:
      product.reviewCount > 0
        ? {
            "@type": "AggregateRating",
            ratingValue: product.rating,
            reviewCount: product.reviewCount,
            bestRating: 5,
            worstRating: 1,
          }
        : undefined,
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/product/${product.slug}`,
      price: String(product.price),
      priceCurrency: product.currency,
      availability: availabilitySchema(product.availability),
      priceValidUntil: "2026-12-31",
      itemCondition: "https://schema.org/NewCondition",
      seller: {
        "@type": "Organization",
        name: "Fusion Gadgets",
      },
    },
  };
}

function breadcrumbJsonLd(
  name: string,
  categoryName: string,
  categorySlug: string,
  productSlug: string
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
      { "@type": "ListItem", position: 2, name: "Shop", item: `${SITE_URL}/shop` },
      {
        "@type": "ListItem",
        position: 3,
        name: categoryName,
        item: `${SITE_URL}/categories/${categorySlug}`,
      },
      {
        "@type": "ListItem",
        position: 4,
        name,
        item: `${SITE_URL}/product/${productSlug}`,
      },
    ],
  };
}

export default async function ProductPage({ params }: { params: Params }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  let allVariationProducts: Product[] = [product];
  if (product.variation && product.variation.items.length >= 2) {
    const variationProductIds = product.variation.items.map((item) => item.productId);
    allVariationProducts = await getProductsByIds(variationProductIds);
    if (allVariationProducts.length === 0) allVariationProducts = [product];
  }

  const [brand, category, related, reviewSummary, latestReviews] = await Promise.all([
    getBrandBySlug(product.brand),
    getCategoryBySlug(product.category),
    getRelatedProducts(product, 4),
    getReviewSummary(product.id),
    getLatestReviews(product.id, 4),
  ]);

  const productLd = productJsonLd(product, brand?.name ?? "Fusion Gadgets");
  const breadcrumbLd = breadcrumbJsonLd(
    product.name,
    category?.name ?? "Shop",
    product.category,
    product.slug
  );

  return (
    <article className="container-edge py-6 lg:py-10">
      <ProductViewTracker slug={slug} />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />

      <Breadcrumbs
        items={[
          { label: "Home", href: "/" },
          { label: "Shop", href: "/shop" },
          {
            label: category?.name ?? "Category",
            href: `/categories/${product.category}`,
          },
          { label: product.name },
        ]}
      />

      <BuyBox
        product={product}
        allVariationProducts={allVariationProducts}
        className="mt-6"
        header={
          <>
            {brand && (
              <p className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                <span className="h-px w-6 bg-copper" />
                {brand.name}
                <span className="text-muted-foreground/50">·</span>
                <span>{brand.country}</span>
              </p>
            )}
            <h1 className="mt-2 font-display text-3xl leading-[1.05] tracking-tight text-balance md:text-4xl lg:text-[2.75rem]">
              {product.name}
            </h1>
            {product.subtitle && (
              <p className="mt-1.5 text-sm text-muted-foreground">
                {product.subtitle}
              </p>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
              <RatingStars
                rating={product.rating}
                count={product.reviewCount}
                size="md"
              />
              {product.reviewCount > 0 && (
                <a
                  href="#reviews"
                  className="text-xs text-muted-foreground underline-offset-4 hover:text-copper hover:underline"
                >
                  Read {product.reviewCount}{" "}
                  {product.reviewCount === 1 ? "review" : "reviews"}
                </a>
              )}
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2">
              <Price
                price={product.price}
                compareAt={product.compareAt}
                size="lg"
              />
              <AvailabilityBadge
                availability={product.availability}
                stock={product.stock}
              />
            </div>

            <p className="mt-5 max-w-xl text-pretty text-[15px] leading-relaxed text-muted-foreground">
              {product.description ?? product.tagline}
            </p>
          </>
        }
        footer={
          product.highlights && product.highlights.length > 0 ? (
            <ul className="space-y-2.5 border-t border-border pt-6">
              {product.highlights.map((h) => (
                <li key={h} className="flex items-start gap-2.5 text-sm">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-copper" />
                  <span className="text-foreground/90">{h}</span>
                </li>
              ))}
            </ul>
          ) : null
        }
      />

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
            {(product.specs ?? []).map((s) => (
              <div
                key={s.label}
                className="grid grid-cols-[10rem_minmax(0,1fr)] gap-2 bg-card px-4 py-2.5 odd:bg-card/60"
              >
                <dt className="font-mono text-[11px] uppercase tracking-wide text-muted-foreground">
                  {s.label}
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
                {product.shipping ?? "Ships within 24 hours. Free delivery across India in 2–4 days."}
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
              More in {category?.name} <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="mt-8 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 lg:gap-x-6">
            {related.map((p) => (
              <ProductCard key={p.slug} product={p} />
            ))}
          </div>
        </section>
      )}
    </article>
  );
}
