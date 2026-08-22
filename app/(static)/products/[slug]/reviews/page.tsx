import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { getProductBySlug } from "@/modules/catalog/products";
import {
  getReviewSummary,
  getPaginatedReviews,
} from "@/modules/review/data";
import { RatingSummary } from "@/components/review/RatingSummary";
import { RatingDistribution } from "@/components/review/RatingDistribution";
import { ReviewList } from "@/components/review/ReviewList";
import { ReviewActions } from "@/components/review/ReviewActions";

export const revalidate = 300;

type Params = Promise<{ slug: string; searchParams: { page?: string } }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) return {};
  return {
    title: `Reviews · ${product.name}`,
    description: `Read customer reviews for ${product.name}.`,
    robots: { index: true, follow: true },
    alternates: { canonical: `/products/${slug}/reviews` },
  };
}

const PAGE_SIZE = 20;

export default async function ProductReviewsPage({ params }: { params: Params }) {
  const { slug, searchParams } = await params;
  const product = await getProductBySlug(slug);
  if (!product) notFound();

  const pageRaw = Number(searchParams.page);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;

  const [summary, { reviews, totalPages }] = await Promise.all([
    getReviewSummary(product.id),
    getPaginatedReviews(product.id, page, PAGE_SIZE),
  ]);

  return (
    <main className="container-edge py-8 lg:py-12">
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
