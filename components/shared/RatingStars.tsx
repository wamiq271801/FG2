import { cn } from "@/lib/utils";
import { ratingStars } from "@/lib/format";
import { Star } from "lucide-react";

type Props = {
  rating: number;
  count?: number;
  size?: "sm" | "md";
  className?: string;
  showCount?: boolean;
};

export function RatingStars({
  rating,
  count,
  size = "sm",
  className,
  showCount = true,
}: Props) {
  const { full, half, empty } = ratingStars(rating);
  const dim = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <span className="flex" aria-label={`Rated ${rating} out of 5`}>
        {Array.from({ length: full }).map((_, i) => (
          <Star key={`f${i}`} className={cn(dim, "fill-copper text-copper")} />
        ))}
        {half && (
          <span className="relative inline-flex">
            <Star className={cn(dim, "text-copper/30")} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: "50%" }}>
              <Star className={cn(dim, "fill-copper text-copper")} />
            </span>
          </span>
        )}
        {Array.from({ length: empty }).map((_, i) => (
          <Star key={`e${i}`} className={cn(dim, "text-copper/30")} />
        ))}
      </span>
      <span className="text-xs text-muted-foreground">
        {rating.toFixed(1)}
        {showCount && count !== undefined && (
          <span className="ml-1">({count})</span>
        )}
      </span>
    </div>
  );
}
