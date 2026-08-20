"use client";

/**
 * Review form submission. Direct Supabase INSERT/UPDATE — the database
 * enforces auth.uid() = user_id, eligibility (can_review_product), and
 * UNIQUE(user_id, product_id). No Worker, no API route.
 */
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type ReviewFormValues = {
  rating: number;
  title: string;
  body: string;
};

export type SubmitState =
  | { status: "idle" }
  | { status: "submitting" }
  | { status: "success" }
  | { status: "error"; message: string };

function friendlyError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("row-level security") || m.includes("policy")) {
    return "You can't review this product yet. Only buyers with a delivered order can review.";
  }
  if (m.includes("duplicate") || m.includes("unique") || m.includes("already")) {
    return "You've already reviewed this product. You can edit your review instead.";
  }
  if (m.includes("rating") && m.includes("check")) {
    return "Please choose a rating from 1 to 5 stars.";
  }
  return "We couldn't save your review. Please try again.";
}

export function useReviewForm() {
  const [state, setState] = useState<SubmitState>({ status: "idle" });

  async function submit(
    mode: "create" | "edit",
    args:
      | { productId: string; values: ReviewFormValues }
      | { reviewId: string; values: ReviewFormValues }
  ): Promise<boolean> {
    setState({ status: "submitting" });
    try {
      const supabase = createClient();
      const { rating, title, body } = args.values;
      if (mode === "create") {
        const { productId } = args as { productId: string; values: ReviewFormValues };
        const { error } = await supabase.from("product_reviews").insert({
          product_id: productId,
          rating,
          title: title.trim(),
          body: body.trim(),
        });
        if (error) {
          setState({ status: "error", message: friendlyError(error.message) });
          return false;
        }
      } else {
        const { reviewId } = args as { reviewId: string; values: ReviewFormValues };
        const { error } = await supabase
          .from("product_reviews")
          .update({ rating, title: title.trim(), body: body.trim() })
          .eq("id", reviewId);
        if (error) {
          setState({ status: "error", message: friendlyError(error.message) });
          return false;
        }
      }
      setState({ status: "success" });
      return true;
    } catch {
      setState({ status: "error", message: "Network error. Please try again." });
      return false;
    }
  }

  function reset() {
    setState({ status: "idle" });
  }

  return { state, submit, reset };
}
