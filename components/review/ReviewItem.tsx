import { BadgeCheck } from "lucide-react";
import { RatingStars } from "@/components/shared/RatingStars";
import { formatDate } from "@/lib/format";
import type { Review } from "@/types";
import { ReviewOwnerActions } from "./ReviewOwnerActions";

export function ReviewItem({
  review,
  currentUserId,
  slug,
}: {
  review: Review;
  currentUserId?: string;
  slug: string;
}) {
  const isOwner = currentUserId && review.userId === currentUserId;
  return (
    <article className="py-5 first:pt-0 last:pb-0">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex items-baseline gap-2">
          <h3 className="font-display text-base tracking-tight">
            {review.title || review.authorName}
          </h3>
          <span className="inline-flex items-center gap-1 rounded-full bg-copper/10 px-2 py-0.5 text-[10px] font-medium text-copper">
            <BadgeCheck className="h-3 w-3" />
            Verified purchase
          </span>
        </div>
        <time dateTime={review.createdAt} className="text-xs text-muted-foreground">
          {formatDate(review.createdAt)}
        </time>
      </header>
      <div className="mt-1.5 flex items-center gap-2">
        <RatingStars rating={review.rating} showCount={false} size="sm" />
        <span className="text-xs text-muted-foreground">by {review.authorName}</span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-foreground/90">{review.body}</p>
      {isOwner && <ReviewOwnerActions reviewId={review.id} slug={slug} />}
    </article>
  );
}
