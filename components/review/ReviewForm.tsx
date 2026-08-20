"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { createClient } from "@/lib/supabase/client";
import { useOperation } from "@/hooks/use-operation";

type Mode =
  | { kind: "create"; productId: string }
  | { kind: "edit"; reviewId: string; initial: { rating: number; title: string; body: string } };

export function ReviewForm({ mode, slug }: { mode: Mode; slug: string }) {
  const router = useRouter();
  const { start: startOp, stop: stopOp } = useOperation();
  const [rating, setRating] = useState(mode.kind === "edit" ? mode.initial.rating : 0);
  const [hoverRating, setHoverRating] = useState(0);
  const [title, setTitle] = useState(mode.kind === "edit" ? mode.initial.title : "");
  const [body, setBody] = useState(mode.kind === "edit" ? mode.initial.body : "");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (rating < 1 || rating > 5) {
      setError("Please choose a rating from 1 to 5 stars.");
      return;
    }
    if (!body.trim()) {
      setError("Please write your review.");
      return;
    }
    setSubmitting(true);
    startOp(mode.kind === "create" ? "Submitting your review" : "Saving your review");
    try {
      const supabase = createClient();
      if (mode.kind === "create") {
        const { error: err } = await supabase.from("product_reviews").insert({
          product_id: mode.productId,
          rating,
          title: title.trim(),
          body: body.trim(),
        });
        if (err) { setError(friendlyError(err.message)); stopOp(); setSubmitting(false); return; }
      } else {
        const { error: err } = await supabase
          .from("product_reviews")
          .update({ rating, title: title.trim(), body: body.trim() })
          .eq("id", mode.reviewId);
        if (err) { setError(friendlyError(err.message)); stopOp(); setSubmitting(false); return; }
      }
      stopOp();
      router.push(`/products/${slug}/reviews`);
      router.refresh();
    } catch {
      stopOp();
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5" aria-label="Review form">
      {error && (
        <Alert variant="destructive" role="alert">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-2">
        <Label>Your rating</Label>
        <div className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              onMouseEnter={() => setHoverRating(n)}
              onMouseLeave={() => setHoverRating(0)}
              aria-label={`Rate ${n} star${n > 1 ? "s" : ""}`}
              className="p-0.5"
            >
              <Star
                className={cn(
                  "h-7 w-7 transition-colors",
                  n <= (hoverRating || rating) ? "fill-copper text-copper" : "text-copper/30"
                )}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-muted-foreground">{rating} of 5</span>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-title">Title (optional)</Label>
        <Input
          id="review-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={120}
          placeholder="Sum up your experience"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="review-body">Your review</Label>
        <Textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={6}
          required
          placeholder="What did you like? What didn't work? How was the experience?"
        />
      </div>

      <Button
        type="submit"
        disabled={submitting}
        className="press w-full bg-foreground text-background hover:bg-foreground/90"
      >
        {submitting ? (
          <>
            <Loader2 className="animate-spin" />
            {mode.kind === "create" ? "Submitting…" : "Saving…"}
          </>
        ) : mode.kind === "create" ? (
          "Submit review"
        ) : (
          "Save changes"
        )}
      </Button>
    </form>
  );
}

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
