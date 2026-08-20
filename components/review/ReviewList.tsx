import type { Review } from "@/types";
import { ReviewItem } from "./ReviewItem";

export function ReviewList({
  reviews,
  currentUserId,
  slug,
}: {
  reviews: Review[];
  currentUserId?: string;
  slug: string;
}) {
  if (reviews.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No reviews yet. Be the first to review this product.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border">
      {reviews.map((review) => (
        <li key={review.id}>
          <ReviewItem review={review} currentUserId={currentUserId} slug={slug} />
        </li>
      ))}
    </ul>
  );
}
