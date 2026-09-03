import "server-only";
import { getAdminClient } from "../supabase";

/**
 * Review moderation data layer (privileged, server-only).
 *
 * Reads the physical product_reviews table (all statuses, internal
 * fields — server-side only). Moderation transitions are exactly:
 *   pending -> approved  (approve)
 *   pending -> rejected  (reject)
 * The stamp_review_moderation trigger lets privileged sessions (no user
 * identity on the secret-key connection) set status directly while
 * customers never can.
 */

export type ReviewStatus = "pending" | "approved" | "rejected";

export type ReviewListRow = {
  id: string;
  product_id: string;
  user_id: string;
  customer_name: string | null;
  rating: number;
  title: string;
  body: string;
  status: ReviewStatus;
  created_at: string;
  updated_at: string;
  products: { name: string; slug: string } | null;
};

/**
 * Thrown when the moderation columns are missing — i.e. the Phase 1
 * migration has not been applied to the connected database yet. The
 * reviews page renders an actionable setup panel for this case.
 */
export class MigrationRequiredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MigrationRequiredError";
  }
}

function isMissingColumnError(error: { code?: string; message: string }): boolean {
  if (error.code === "PGRST204" || error.code === "42703") return true;
  const message = error.message ?? "";
  return /status.*column|column.*status|schema cache/i.test(message);
}

export async function listReviews(opts: {
  status?: ReviewStatus;
  page?: number;
  pageSize?: number;
}): Promise<{ rows: ReviewListRow[]; total: number; totalPages: number }> {
  const supabase = getAdminClient();
  const page = Math.max(1, opts.page ?? 1);
  const pageSize = Math.min(50, Math.max(5, opts.pageSize ?? 20));
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  const REVIEW_LIST_SELECT = `
    id, product_id, user_id, customer_name, rating, title, body, status,
    created_at, updated_at,
    products(name, slug)
  `;

  let query = supabase.from("product_reviews").select(REVIEW_LIST_SELECT, { count: "exact" });
  if (opts.status) query = query.eq("status", opts.status);
  query = query.order("created_at", { ascending: false }).range(from, to);

  const { data, error, count } = await query;
  if (error) {
    if (isMissingColumnError(error)) {
      throw new MigrationRequiredError(
        "The review moderation migration has not been applied to this database."
      );
    }
    throw error;
  }
  const rows = (data ?? []) as unknown as ReviewListRow[];
  const total = count ?? 0;
  return { rows, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Set a review's moderation status and return the review's product_id —
 * the caller needs it to build the storefront notification event
 * (review.approved / review.rejected carry the product the public review
 * cache is scoped to). Returns null when no row matched the id.
 */
export async function setReviewStatus(
  id: string,
  status: ReviewStatus
): Promise<string | null> {
  const supabase = getAdminClient();
  const { data, error } = await supabase
    .from("product_reviews")
    .update({ status })
    .eq("id", id)
    .select("product_id")
    .maybeSingle();
  if (error) {
    if (isMissingColumnError(error)) {
      throw new MigrationRequiredError(
        "The review moderation migration has not been applied to this database."
      );
    }
    throw error;
  }
  const row = data as { product_id: string } | null;
  return row ? row.product_id : null;
}
