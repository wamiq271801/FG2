import { RatingStars } from "@/components/shared/RatingStars";
import type { ReviewSummary } from "@/types";

export function RatingSummary({
  summary,
  fallbackRating,
  fallbackCount,
}: {
  summary?: ReviewSummary;
  fallbackRating?: number;
  fallbackCount?: number;
}) {
  const rating = summary ? summary.average : (fallbackRating ?? 0);
  const count = summary ? summary.count : (fallbackCount ?? 0);
  return (
    <div className="flex items-center gap-2">
      <RatingStars rating={rating} showCount={false} size="md" />
      <span className="text-sm font-medium">{rating.toFixed(1)}</span>
      <span className="text-xs text-muted-foreground">
        ({count} {count === 1 ? "review" : "reviews"})
      </span>
    </div>
  );
}
