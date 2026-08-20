"use client";

/**
 * Client eligibility query. Calls the narrow can_review_product RPC + checks
 * for an existing review by the current user. Returns ONLY canReview + hasReview
 * — never orders, order items, or delivery data. The actual INSERT/UPDATE
 * remains protected by RLS; this is UX-only.
 */
import { createClient } from "@/lib/supabase/client";
import { useAuthContext } from "@/providers/AuthProvider";
import { useEffect, useState } from "react";

export type ReviewEligibility = {
  state: "checking" | "unauthenticated" | "eligible" | "hasReview" | "ineligible";
  existingReviewId: string | null;
};

export function useReviewEligibility(productId: string | undefined): ReviewEligibility {
  const { state: authState, user } = useAuthContext();
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
      if (existingRes.data?.id) {
        setEligibility({ state: "hasReview", existingReviewId: String(existingRes.data.id) });
        return;
      }
      setEligibility({
        state: canReviewRes.data === true ? "eligible" : "ineligible",
        existingReviewId: null,
      });
    })();
    return () => { cancelled = true; };
  }, [productId, authState, user?.id]);

  return eligibility;
}
