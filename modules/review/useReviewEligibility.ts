"use client";

/**
 * Client eligibility query. Calls the narrow can_review_product RPC + checks
 * for an existing review by the current user. Returns ONLY canReview + hasReview
 * — never orders, order items, or delivery data. The actual INSERT/UPDATE
 * remains protected by RLS; this is UX-only.
 *
 * Results are kept in a module-level session cache keyed by
 * `${userId}:${productId}` so remounting the same review surface (navigating
 * back to a product, opening the write-review gate) reuses the session's
 * answer instead of re-running the same two queries. The cache is dropped on
 * full page reload and invalidated after a review is written (see
 * invalidateReviewEligibility).
 */
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";
import { useEffect, useState } from "react";

export type ReviewEligibility = {
  state: "checking" | "unauthenticated" | "eligible" | "hasReview" | "ineligible";
  existingReviewId: string | null;
};

const eligibilityCache = new Map<string, ReviewEligibility>();

/** Drop the cached eligibility for a product (any user) — call after a write. */
export function invalidateReviewEligibility(productId: string) {
  for (const key of eligibilityCache.keys()) {
    if (key.endsWith(`:${productId}`)) eligibilityCache.delete(key);
  }
}

export function useReviewEligibility(productId: string | undefined): ReviewEligibility {
  const { state: authState, user } = useAuthContext();
  const cacheKey = productId && user ? `${user.id}:${productId}` : null;
  const [eligibility, setEligibility] = useState<ReviewEligibility>({
    state: "checking",
    existingReviewId: null,
  });

  useEffect(() => {
    if (!productId || authState === "initializing") return;
    if (authState === "unauthenticated" || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setEligibility({ state: "unauthenticated", existingReviewId: null });
      return;
    }
    // Already resolved for this (user, product) during this session — reuse.
    const cached = eligibilityCache.get(cacheKey ?? "");
    if (cached) {
      setEligibility(cached);
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [canReviewRes, existingRes] = await Promise.all([
        supabase.rpc("can_review_product", { p_product_id: productId }),
        supabase
          .from("product_reviews")
          .select("id")
          .eq("product_id", productId)
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);
      if (cancelled) return;
      let result: ReviewEligibility;
      if (existingRes.data?.id) {
        result = {
          state: "hasReview",
          existingReviewId: String(existingRes.data.id),
        };
      } else {
        result = {
          state: canReviewRes.data === true ? "eligible" : "ineligible",
          existingReviewId: null,
        };
      }
      eligibilityCache.set(`${user.id}:${productId}`, result);
      setEligibility(result);
    })();
    return () => { cancelled = true; };
  }, [productId, authState, user?.id, cacheKey]);

  return eligibility;
}
