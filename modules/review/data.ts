/**
 * Server-side review data access. Reads via the public catalog client
 * (anon key, RLS-constrained). product_reviews has public SELECT.
 *
 * Aggregates (average + distribution + count) are computed here from
 * product_reviews — never stored per-review.
 */
import { createCatalogClient } from "@/lib/supabase/catalog";
import type { Review, ReviewSummary, RatingDistribution } from "@/types";

type ReviewRow = {
  id: number;
  product_id: string;
  user_id: string;
  rating: number;
  title: string;
  body: string;
  created_at: string;
  updated_at: string;
  profiles: { full_name: string | null }[] | null;
};

const REVIEW_SELECT = `
  id, product_id, user_id, rating, title, body, created_at, updated_at,
  profiles:profiles(full_name)
`;

function mapReview(r: ReviewRow): Review {
  const profile = r.profiles?.[0];
  return {
    id: String(r.id),
    productId: r.product_id,
    userId: r.user_id,
    rating: r.rating,
    title: r.title || "",
    body: r.body,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    authorName: profile?.full_name || "Verified buyer",
  };
}

// Aggregate: average + count + per-star distribution. Computed fresh from
// product_reviews. No stored aggregate table.
export async function getReviewSummary(productId: string): Promise<ReviewSummary> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("product_reviews")
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
    .from("product_reviews")
    .select(REVIEW_SELECT)
    .eq("product_id", productId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error || !data) return [];
  return (data as ReviewRow[]).map(mapReview);
}

// Paginated reviews for the full reviews page (SSR).
export async function getPaginatedReviews(
  productId: string,
  page: number,
  pageSize = 20
): Promise<{ reviews: Review[]; total: number; totalPages: number }> {
  const supabase = createCatalogClient();
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const [reviewsRes, countRes] = await Promise.all([
    supabase
      .from("product_reviews")
      .select(REVIEW_SELECT)
      .eq("product_id", productId)
      .order("created_at", { ascending: false })
      .range(from, to),
    supabase
      .from("product_reviews")
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

// Single review by id (for the edit page). Public read; ownership is enforced
// by RLS on UPDATE. The edit page SSR-fetches this for context only.
export async function getReviewById(reviewId: string): Promise<Review | null> {
  const supabase = createCatalogClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .select(REVIEW_SELECT)
    .eq("id", reviewId)
    .maybeSingle();
  if (error || !data) return null;
  return mapReview(data as ReviewRow);
}
