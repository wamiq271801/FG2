"use client";

import { Check, Ban } from "lucide-react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import type { GroupOption } from "@/types";

type Props = {
  groupOptions: GroupOption[];
  selectedProductId?: string;
  onSelectOption: (productId: string) => void;
  label?: string;
  className?: string;
};

export function GroupOptionPicker({
  groupOptions,
  selectedProductId,
  onSelectOption,
  label = "Options",
  className,
}: Props) {
  if (groupOptions.length === 0) return null;
  const selected =
    groupOptions.find((o) => o.productId === selectedProductId) ?? groupOptions[0];

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const inStock = groupOptions.filter((o) => o.inStock);
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
      onSelectOption(inStock[nextIdx].productId);
    }
  }

  return (
    <fieldset className={cn("min-w-0", className)}>
      <legend className="flex items-baseline justify-between gap-3">
        <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <span className="text-sm font-medium text-foreground" data-selected-name>
          {selected.name}
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
        {groupOptions.map((option) => {
          const isSelected = option.productId === selectedProductId;
          return (
            <button
              key={option.productId}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!option.inStock}
              onClick={() => option.inStock && onSelectOption(option.productId)}
              title={`${option.name}${option.inStock ? "" : " · out of stock"}`}
              className={cn(
                "press group relative flex items-center gap-2 rounded-full border bg-card pl-1 pr-3 py-1 text-xs font-medium",
                isSelected
                  ? "border-copper text-foreground ring-1 ring-copper/30"
                  : "border-border text-muted-foreground hover:border-copper/40 hover:text-foreground",
                !option.inStock && "cursor-not-allowed opacity-60 hover:border-border hover:text-muted-foreground"
              )}
            >
              {option.primaryImage ? (
                <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full border border-foreground/15">
                  <Image
                    src={option.primaryImage}
                    alt={option.name}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                  {!option.inStock && (
                    <span className="absolute inset-0 grid place-items-center bg-background/55">
                      <Ban className="h-3 w-3 text-rose-600/80 dark:text-rose-400/80" />
                    </span>
                  )}
                  {isSelected && option.inStock && (
                    <span className="absolute inset-0 grid place-items-center bg-foreground/20">
                      <Check className="h-3 w-3 text-white" strokeWidth={3} />
                    </span>
                  )}
                </span>
              ) : (
                <span className="relative grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-full border border-foreground/15 bg-muted">
                  {!option.inStock && (
                    <Ban className="h-3.5 w-3.5 text-rose-600/80 dark:text-rose-400/80" />
                  )}
                </span>
              )}
              <span>{option.name}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
