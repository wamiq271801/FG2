import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/modules/catalog/products";
import { getReviewData, getPaginatedReviews } from "@/modules/review/data";
import { RatingSummary } from "@/components/review/RatingSummary";
import { RatingDistribution } from "@/components/review/RatingDistribution";
import { ReviewList } from "@/components/review/ReviewList";
import { ReviewActions } from "@/components/review/ReviewActions";
import { JsonLd } from "@/components/shared/JsonLd";
import {
  breadcrumbRef,
  buildBreadcrumbList,
  buildJsonLdGraph,
  productRef,
  webPageEntity,
} from "@/lib/schema";

type Params = Promise<{ slug: string }>;
type SearchParams = Promise<{ page?: string | string[] | undefined }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  // getProductBySlug is a cached function ("product" profile) — the metadata
  // reads through the same cache entry as the page.
  const product = await getProductBySlug(slug);
  if (!product) return {}
  return {
    title: `Reviews · ${product.name}`,
    description: `Read customer reviews for ${product.name}.`,
    robots: { index: true, follow: true },
    alternates: { canonical: `/products/${slug}/reviews` },
  };
}

const PAGE_SIZE = 20;

export default async function ProductReviewsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  // COMPLETE server-rendered page: params/searchParams are awaited directly
  // in the page and the review data resolves before the page renders (the
  // root layout's above-body Suspense boundary is the official fully-dynamic
  // opt-in).
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const sp = await searchParams;
  const pageRaw = Number(Array.isArray(sp.page) ? sp.page[0] : sp.page);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const [reviewData, { reviews, totalPages }] = await Promise.all([
    getReviewData(product.id),
    getPaginatedReviews(product.id, page, PAGE_SIZE),
  ]);
  const summary = reviewData.summary;

  const reviewsPath = `/products/${product.slug}/reviews`;

  // ONE JSON-LD graph: WebPage + BreadcrumbList + a compact Product
  // reference. This page is not the Product Detail page — the merchant
  // product graph is not duplicated here, and no private review state is
  // ever exposed.
  const reviewsGraph = buildJsonLdGraph(
    webPageEntity({
      path: reviewsPath,
      name: `Reviews · ${product.name}`,
      description: `Read customer reviews for ${product.name}.`,
      mainEntity: productRef(product.slug, product.name),
      breadcrumb: breadcrumbRef(reviewsPath),
    }),
    buildBreadcrumbList(reviewsPath, [
      { name: "Home", path: "/" },
      { name: product.name, path: `/product/${product.slug}` },
      { name: "Reviews" },
    ])
  );

  return (
    <main className="container-edge py-8 lg:py-12">
      <JsonLd data={reviewsGraph} />
      <nav className="mb-6 text-sm text-muted-foreground" aria-label="Breadcrumb">
        <Link href={`/product/${product.slug}`} className="hover:text-foreground">
          {product.name}
        </Link>{" "}
        <span aria-hidden>›</span> Reviews
      </nav>

      <header className="mb-8 grid gap-6 border-b border-border pb-8 lg:grid-cols-[1fr_20rem] lg:gap-12">
        <div>
          <h1 className="font-display text-3xl tracking-tight">
            {product.name}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            SKU {product.sku}
          </p>
          <div className="mt-3">
            <RatingSummary summary={summary} fallbackRating={product.rating} fallbackCount={product.reviewCount} />
          </div>
        </div>
        {summary && summary.count > 0 && (
          <RatingDistribution distribution={summary.distribution} count={summary.count} />
        )}
      </header>

      <div className="mb-6">
        <ReviewActions productId={product.id} slug={product.slug} />
      </div>

      {reviews.length > 0 ? (
        <ReviewList reviews={reviews} slug={product.slug} />
      ) : (
        <p className="py-12 text-center text-sm text-muted-foreground">
          No reviews yet. Reviews appear after a delivered purchase.
        </p>
      )}

      {totalPages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2 text-sm" aria-label="Pagination">
          {page > 1 && (
            <Link
              href={`/products/${slug}/reviews?page=${page - 1}`}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
            >
              Previous
            </Link>
          )}
          <span className="text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={`/products/${slug}/reviews?page=${page + 1}`}
              className="rounded-md border border-border px-3 py-1.5 hover:bg-muted"
            >
              Next
            </Link>
          )}
        </nav>
      )}
    </main>
  );
}
