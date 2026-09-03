"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuthContext } from "@/providers/AuthProvider";
import { createClient } from "@/lib/supabase/client";
import { ReviewForm } from "@/components/review/ReviewForm";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

type State =
  | { status: "checking" }
  | { status: "unauthenticated" }
  | { status: "notOwner" }
  | {
      status: "owner";
      review: { rating: number; title: string; body: string };
    };

/**
 * Owner-scoped edit gate. The review is fetched client-side with the
 * signed-in user's session: RLS lets the owner read their own review in
 * ANY moderation status (pending included — newly submitted reviews are
 * pending until approved), while anyone else can only see approved
 * reviews. Ownership is still the existing user_id check; the edit
 * itself remains protected by the owner UPDATE policy.
 */
export function ReviewEditGate({
  reviewId,
  slug,
}: {
  reviewId: string;
  slug: string;
}) {
  const { state: authState, user } = useAuthContext();
  const [s, setS] = useState<State>({ status: "checking" });

  useEffect(() => {
    if (authState === "initializing") return;
    if (authState === "unauthenticated" || !user) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setS({ status: "unauthenticated" });
      return;
    }
    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("product_reviews")
        .select("id, user_id, rating, title, body")
        .eq("id", reviewId)
        .maybeSingle();
      if (cancelled) return;
      if (!data || data.user_id !== user.id) {
        setS({ status: "notOwner" });
        return;
      }
      setS({
        status: "owner",
        review: {
          rating: data.rating,
          title: data.title,
          body: data.body,
        },
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [authState, user, reviewId]);

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
  // Rendered here rather than passed from the server page — function props
  // cannot cross the Server→Client component boundary.
  return (
    <ReviewForm
      mode={{
        kind: "edit",
        reviewId,
        initial: {
          rating: s.review.rating,
          title: s.review.title,
          body: s.review.body,
        },
      }}
      slug={slug}
    />
  );
}
