"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useReviewEligibility } from "@/modules/review/useReviewEligibility";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type GateState =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "ineligible" }
  | { status: "hasReview"; reviewId: string }
  | { status: "eligible" };

export function ReviewGate({
  productId,
  slug,
  renderForm,
}: {
  productId: string;
  slug: string;
  renderForm: (productId: string) => React.ReactNode;
}) {
  const router = useRouter();
  const eligibility = useReviewEligibility(productId);
  const [state, setState] = useState<GateState>({ status: "checking" });

  useEffect(() => {
    if (eligibility.state === "checking") return;
    if (eligibility.state === "unauthenticated") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setState({ status: "unauthenticated" });
      return;
    }
    if (eligibility.state === "hasReview" && eligibility.existingReviewId) {
      // Redirect to the edit page for the existing review.
      router.replace(`/products/${slug}/reviews/${eligibility.existingReviewId}/edit`);
      return;
    }
    if (eligibility.state === "eligible") {
      setState({ status: "eligible" });
      return;
    }
    setState({ status: "ineligible" });
  }, [eligibility, router, slug]);

  if (state.status === "checking") {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Checking…
      </div>
    );
  }

  if (state.status === "unauthenticated") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <h2 className="font-display text-lg tracking-tight">Sign in to write a review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only customers with a delivered order can review this product.
        </p>
        <Button asChild className="mt-4">
          <Link href={`/auth/signin?redirect=/products/${slug}/reviews/new`}>Sign in</Link>
        </Button>
      </div>
    );
  }

  if (state.status === "ineligible") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <h2 className="font-display text-lg tracking-tight">Not eligible yet</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          You can review this product after your order is delivered.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href={`/product/${slug}`}>Back to product</Link>
        </Button>
      </div>
    );
  }

  if (state.status === "eligible") {
    return <>{renderForm(productId)}</>;
  }

  // hasReview → redirect is in-flight.
  return (
    <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      Redirecting to your review…
    </div>
  );
}
