import Link from "next/link";
import { Button } from "@/components/ui/button";

export function ReviewOwnerActions({
  reviewId,
  slug,
}: {
  reviewId: string;
  slug: string;
}) {
  return (
    <div className="mt-3">
      <Button asChild variant="outline" size="sm" className="press">
        <Link href={`/products/${slug}/reviews/${reviewId}/edit`}>Edit your review</Link>
      </Button>
    </div>
  );
}
