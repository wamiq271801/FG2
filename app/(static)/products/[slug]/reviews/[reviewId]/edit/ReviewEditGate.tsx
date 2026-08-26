"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/providers/AuthProvider";
import { ReviewForm } from "@/components/review/ReviewForm";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import type { Review } from "@/types";

type State =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "notOwner" }
  | { status: "owner" };

export function ReviewEditGate({
  review,
  slug,
}: {
  review: Review;
  slug: string;
}) {
  const router = useRouter();
  const { state: authState, user } = useAuthContext();
  const [s, setS] = useState<State>({ status: "checking" });

  useEffect(() => {
    if (authState === "initializing") return;
    if (authState === "unauthenticated" || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setS({ status: "unauthenticated" });
      return;
    }
    if (user.id !== review.userId) {
      setS({ status: "notOwner" });
      return;
    }
    setS({ status: "owner" });
  }, [authState, user, review.userId]);

  if (s.status === "checking") {
    return (
      <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Checking…
      </div>
    );
  }
  if (s.status === "unauthenticated") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <h2 className="font-display text-lg tracking-tight">Sign in to edit your review</h2>
        <Button asChild className="mt-4">
          <Link href="/auth/signin">Sign in</Link>
        </Button>
      </div>
    );
  }
  if (s.status === "notOwner") {
    return (
      <div className="rounded-lg border border-border bg-card p-6 text-center">
        <h2 className="font-display text-lg tracking-tight">You can&apos;t edit this review</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Only the person who wrote the review can edit it.
        </p>
      </div>
    );
  }
  // Rendered here rather than passed from the server page — functions
  // cannot cross the Server→Client component boundary.
  return (
    <ReviewForm
      mode={{
        kind: "edit",
        reviewId: review.id,
        initial: { rating: review.rating, title: review.title, body: review.body },
      }}
      slug={slug}
    />
  );
}
