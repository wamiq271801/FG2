"use client";

import { Check, Ban } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { VariationItem } from "@/types";

type Props = {
  variationItems: VariationItem[];
  selectedProductId?: string;
  onSelectItem: (productId: string) => void;
  label?: string;
  className?: string;
};

export function VariationSelector({
  variationItems,
  selectedProductId,
  onSelectItem,
  label = "Variation",
  className,
}: Props) {
  if (variationItems.length === 0) return null;
  const selected =
    variationItems.find((o) => o.productId === selectedProductId) ?? variationItems[0];

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const inStock = variationItems.filter((o) => o.inStock);
    if (inStock.length === 0) return;
    const currentIdx = inStock.findIndex((o) => o.productId === selectedProductId);
    let nextIdx: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextIdx = (currentIdx + 1) % inStock.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextIdx = (currentIdx - 1 + inStock.length) % inStock.length;
    }
    if (nextIdx !== null) {
      e.preventDefault();
      onSelectItem(inStock[nextIdx].productId);
    }
  }

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

      <div
        className="mt-3 flex flex-wrap gap-2.5"
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        {variationItems.map((item) => {
          const isSelected = item.productId === selectedProductId;
          return (
            <button
              key={item.productId}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!item.inStock}
              onClick={() => item.inStock && onSelectItem(item.productId)}
              title={`${item.label}${item.inStock ? "" : " · out of stock"}`}
              className={cn(
                "press group relative flex items-center gap-2 rounded-full border bg-card pl-1 pr-3 py-1 text-xs font-medium",
                isSelected
                  ? "border-copper text-foreground ring-1 ring-copper/30"
                  : "border-border text-muted-foreground hover:border-copper/40 hover:text-foreground",
                !item.inStock && "cursor-not-allowed opacity-60 hover:border-border hover:text-muted-foreground"
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
                  {isSelected && item.inStock && (
                    <span className="absolute inset-0 grid place-items-center bg-foreground/20">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
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
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
