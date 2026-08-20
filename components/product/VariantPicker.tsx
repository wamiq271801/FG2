"use client";

import { Check, Ban } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProductVariant } from "@/types";

type Props = {
  variants: ProductVariant[];
  selectedVariantId?: string;
  onSelectVariant: (id: string) => void;
  /** Label shown above the swatches */
  label?: string;
  className?: string;
};

/**
 * VariantPicker — accessible swatch selector.
 *
 * Controlled: parent owns the selected id. Renders one button per variant
 * with a colour swatch and name. Out-of-stock variants are disabled and
 * marked with a slash; the selected variant has a copper ring.
 *
 * Keyboard: arrow keys move between variants, Space/Enter selects. We use
 * a radiogroup pattern for AT compatibility.
 */
export function VariantPicker({
  variants,
  selectedVariantId,
  onSelectVariant,
  label = "Variant",
  className,
}: Props) {
  if (variants.length === 0) return null;
  const selected = variants.find((v) => v.id === selectedVariantId) ?? variants[0];

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const currentIndex = variants.findIndex((v) => v.id === selectedVariantId);
    const inStockIndexes = variants
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => v.inStock);
    if (inStockIndexes.length === 0) return;

    const currentStockIdx = inStockIndexes.findIndex(({ v }) => v.id === selectedVariantId);
    let nextStockIdx: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      nextStockIdx = (currentStockIdx + 1) % inStockIndexes.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      nextStockIdx = (currentStockIdx - 1 + inStockIndexes.length) % inStockIndexes.length;
    }
    if (nextStockIdx !== null) {
      e.preventDefault();
      onSelectVariant(inStockIndexes[nextStockIdx].v.id);
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
        {variants.map((v) => {
          const isSelected = v.id === selectedVariantId;
          return (
            <button
              key={v.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!v.inStock}
              onClick={() => v.inStock && onSelectVariant(v.id)}
              title={`${v.name}${v.inStock ? "" : " · out of stock"}`}
              className={cn(
                "press group relative flex items-center gap-2 rounded-full border bg-card pl-1.5 pr-3 py-1.5 text-xs font-medium",
                isSelected
                  ? "border-copper text-foreground ring-1 ring-copper/30"
                  : "border-border text-muted-foreground hover:border-copper/40 hover:text-foreground",
                !v.inStock && "cursor-not-allowed opacity-60 hover:border-border hover:text-muted-foreground"
              )}
            >
              <span className="relative grid h-5 w-5 place-items-center overflow-hidden rounded-full border border-foreground/15">
                <span
                  className="absolute inset-0"
                  style={{ backgroundColor: v.swatch ?? "transparent" }}
                  aria-hidden="true"
                />
                {isSelected && v.inStock && (
                  <Check
                    className="relative h-3 w-3"
                    strokeWidth={3}
                    style={{
                      color: pickReadableOn(v.swatch),
                    }}
                  />
                )}
                {!v.inStock && (
                  <Ban
                    className="relative h-3.5 w-3.5 text-rose-600/80 dark:text-rose-400/80"
                    aria-hidden="true"
                  />
                )}
              </span>
              <span>{v.name}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Pick a readable foreground (white-ish or ink-ish) for a checkmark on top of
 * a swatch. Approximates luminance from a hex/rgb colour.
 */
function pickReadableOn(color?: string): string {
  if (!color) return "var(--foreground)";
  const hex = color.startsWith("#") ? color.slice(1) : null;
  if (!hex) return "var(--foreground)";
  const full =
    hex.length === 3
      ? hex
          .split("")
          .map((c) => c + c)
          .join("")
      : hex;
  const r = parseInt(full.slice(0, 2), 16) / 255;
  const g = parseInt(full.slice(2, 4), 16) / 255;
  const b = parseInt(full.slice(4, 6), 16) / 255;
  const lin = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "var(--foreground)" : "var(--background)";
}
