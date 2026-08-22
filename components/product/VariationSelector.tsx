import Link from "next/link";
import Image from "next/image";
import { Ban } from "lucide-react";
import { cn } from "@/lib/utils";

type VariationOption = {
  productId: string;
  slug: string;
  label: string;
  primaryImage?: string;
  inStock: boolean;
};

type Props = {
  options: VariationOption[];
  selectedProductId: string;
  label?: string;
  className?: string;
};

/**
 * Server-rendered variation selector. Each option is a normal link to the
 * target product's page. No client-side switching, no pushState, no popstate.
 */
export function VariationSelector({
  options,
  selectedProductId,
  label = "Variation",
  className,
}: Props) {
  if (options.length === 0) return null;
  const selected = options.find((o) => o.productId === selectedProductId) ?? options[0];

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-medium text-foreground" data-selected-name>
          {selected.label}
          {!selected.inStock && (
            <span className="ml-2 text-xs text-rose-600 dark:text-rose-400">Sold out</span>
          )}
        </span>
      </legend>

      <div className="mt-3 flex flex-wrap gap-2.5" role="radiogroup" aria-label={label}>
        {options.map((item) => {
          const isSelected = item.productId === selectedProductId;
          return (
            <Link
              key={item.productId}
              href={`/product/${item.slug}`}
              role="radio"
              aria-checked={isSelected}
              aria-disabled={!item.inStock}
              title={`${item.label}${item.inStock ? "" : " · out of stock"}`}
              tabIndex={item.inStock ? 0 : -1}
              className={cn(
                "press group relative flex items-center gap-2 rounded-full border bg-card pl-1 pr-3 py-1 text-xs font-medium",
                isSelected
                  ? "border-copper text-foreground ring-1 ring-copper/30"
                  : "border-border text-muted-foreground hover:border-copper/40 hover:text-foreground",
                !item.inStock && "pointer-events-none cursor-not-allowed opacity-60 hover:border-border hover:text-muted-foreground"
              )}
            >
              {item.primaryImage ? (
                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-foreground/15">
                  <Image
                    src={item.primaryImage}
                    alt={item.label}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                  {!item.inStock && (
                    <span className="absolute inset-0 grid place-items-center bg-background/55">
                      <Ban className="h-3 w-3 text-rose-600/80 dark:text-rose-400/80" />
                    </span>
                  )}
                </span>
              ) : (
                <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-foreground/15 bg-muted">
                  {!item.inStock && (
                    <Ban className="h-3.5 w-3.5 text-rose-600/80 dark:text-rose-400/80" />
                  )}
                </span>
              )}
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </fieldset>
  );
}
