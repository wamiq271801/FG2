/**
 * Server-side review data access. Public reads go through the
 * published_reviews VIEW (approved reviews only, public columns only —
 * no user_id, no moderation fields) via the public catalog client
 * (anon key, RLS-constrained). The view is the single public review
 * boundary defined by the Phase 1 review-moderation migration.
 *
 * The reviewer's name comes from product_reviews.customer_name (the
 * snapshot stamped by the database at submission time) — no profiles
 * join and no access to the protected profiles table.
 *
 * Phase 2 cache architecture: the PDP review data
 * (`getReviewData`) and each paginated reviews page
 * (`getPaginatedReviews`) are 'use cache' scopes tagged
 * `reviews:{productId}` + `reviews` — invalidated by review.* domain
 * events. Aggregates (average + distribution + count) are computed from
 * published_reviews at cache-fill time — never stored per-review.
 */
import { cacheLife, cacheTag } from "next/cache";
import { createCatalogClient } from "@/lib/supabase/catalog";
import type { Review, ReviewSummary, RatingDistribution } from "@/types";

type ReviewRow = {
  id: number;
  product_id: string;
  customer_name: string | null;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
};

const REVIEW_SELECT = `
  id, product_id, customer_name, rating, title, body, created_at, updated_at
`;

function mapReview(r: ReviewRow): Review {
  return {
    id: String(r.id),
    productId: r.product_id,
    rating: r.rating,
    title: r.title || "",
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    // Public review data carries no user identity — the view does not
    // expose user_id. Ownership is resolved client-side by the
    // authenticated edit flow, never from public review data.
    authorName: r.customer_name || "Verified buyer",
  };
}

// Aggregate: average + count + per-star distribution. Computed fresh from
// published_reviews (approved only). No stored aggregate table.
export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("published_reviews")
    .select("rating")
    .eq("product_id", productId);
  if (error || !data) {
    return { average: 0, count: 0, distribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 } };
  }
  const ratings = data as unknown as { rating: number }[];
  const count = ratings.length;
  const dist: RatingDistribution = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  let sum = 0;
  for (const r of ratings) {
    sum += r.rating;
    if (r.rating >= 1 && r.rating <= 5) dist[r.rating as 1 | 2 | 3 | 4 | 5]++;
  }
  const average = count > 0 ? Math.round((sum / count) * 10) / 10 : 0;
  return { average, count, distribution: dist };
}

// Latest 4 reviews for the product page (SSR).
export async function getLatestReviews(productId: string, limit = 4): Promise<Review[]> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("published_reviews")
    .select(REVIEW_SELECT)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as ReviewRow[]).map(mapReview);
}

/**
 * The PDP review-data scope — tags: `reviews`, `reviews:{productId}`.
 * One entry per product serves the product page's summary, distribution,
 * latest-reviews list and the reviews-page header summary.
 */
export async function getReviewData(
  productId: string
): Promise<{ summary: ReviewSummary; latest: Review[] }> {
  "use cache";
  cacheLife("indefinite");
  cacheTag("reviews", `reviews:${productId}`);

  const [summary, latest] = await Promise.all([
    getReviewSummary(productId),
    getLatestReviews(productId, 4),
  ]);
  return { summary, latest };
}

/**
 * The paginated reviews scope — tags: `reviews`, `reviews:{productId}`.
 * One entry per (productId, page); invalidated as a set by review events.
 */
export async function getPaginatedReviews(
  productId: string,
  page: number,
  pageSize = 20
): Promise<{ reviews: Review[]; total: number; totalPages: number }> {
  "use cache";
  cacheLife("indefinite");
  cacheTag("reviews", `reviews:${productId}`);

  const supabase = createCatalogClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [reviewsRes, countRes] = await Promise.all([
    supabase
      .from("published_reviews")
      .select(REVIEW_SELECT)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("published_reviews")
      .select("id", { count: "exact", head: true })
      .eq("product_id", productId),
  ]);

  if (reviewsRes.error || !reviewsRes.data) return { reviews: [], total: 0, totalPages: 0 };
  const total = countRes.count ?? 0;
  return {
    reviews: (reviewsRes.data as ReviewRow[]).map(mapReview),
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}
