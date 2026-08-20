"use client";

/**
 * Personalized review controls. Initial state is "checking" → renders nothing.
 * Never renders Write/Edit before eligibility is known. Only the owner's
 * existing review shows Edit; never shows delete.
 */
import Link from "next/link";
import { useReviewEligibility } from "@/modules/review/useReviewEligibility";
import { Button } from "@/components/ui/button";

export function ReviewActions({ productId, slug }: { productId: string; slug: string }) {
  const eligibility = useReviewEligibility(productId);

  // checking OR unauthenticated → render nothing (no placeholder button).
  if (eligibility.state === "checking" || eligibility.state === "unauthenticated") {
    return null;
  }
  if (eligibility.state === "hasReview" && eligibility.existingReviewId) {
    return (
      <Button asChild variant="outline" size="sm" className="press">
        <Link href={`/products/${slug}/reviews/${eligibility.existingReviewId}/edit`}>
          Edit your review
        </Link>
      </Button>
    );
  }
  if (eligibility.state === "eligible") {
    return (
      <Button asChild size="sm" className="press bg-foreground text-background hover:bg-foreground/90">
        <Link href={`/products/${slug}/reviews/new`}>Write a review</Link>
      </Button>
    );
  }
  // ineligible → no action shown.
  return null;
}
