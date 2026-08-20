import { cn } from "@/lib/utils";
import { formatPrice, discountPercent } from "@/lib/format";
import type { Money } from "@/types";

type Props = {
  price: Money;
  compareAt?: Money;
  className?: string;
  size?: "sm" | "md" | "lg";
  currency?: "INR";
};

export function Price({ price, compareAt, className, size = "md" }: Props) {
  const off = discountPercent(price, compareAt);
  const sizeClass =
    size === "lg" ? "text-2xl" : size === "sm" ? "text-sm" : "text-lg";
  return (
    <div className={cn("flex flex-wrap items-baseline gap-x-2 gap-y-0.5", className)}>
      <span className={cn("font-display font-medium tracking-tight", sizeClass)}>
        {formatPrice(price)}
      </span>
      {compareAt && compareAt > price && (
        <span className="text-sm text-muted-foreground line-through decoration-copper/60">
          {formatPrice(compareAt)}
        </span>
      )}
      {off && (
        <span className="text-[11px] font-medium uppercase tracking-wide text-copper">
          −{off}%
        </span>
      )}
    </div>
  );
}
