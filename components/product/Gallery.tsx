"use client";

import Image from "next/image";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { cn } from "@/lib/utils";
import type { ProductVariant, ProductVisualKey } from "@/types";

type Props = {
  visualKey: ProductVisualKey;
  /** Base accent used when no variants or no swatch is available */
  baseAccent: string;
  variants: ProductVariant[];
  selectedVariantId?: string;
  onSelectVariant?: (id: string) => void;
  /** Product name — used for alt text */
  productName: string;
  /** Real product photos, if available. The first is the main image. */
  images?: string[];
  className?: string;
};

/**
 * Gallery — the product image surface.
 *
 * Prefers real product photography (`images[0]`) for the main view. When no
 * real photo is available it falls back to the procedural `ProductVisual`.
 * Variant thumbnails remain as tinted visuals (they represent colourways, not
 * angles), unless real variant photos exist.
 */
export function Gallery({
  visualKey,
  baseAccent,
  variants,
  selectedVariantId,
  onSelectVariant,
  productName,
  images,
  className,
}: Props) {
  const hasVariants = variants.length > 0;
  const selected =
    variants.find((v) => v.id === selectedVariantId) ?? variants[0];
  const activeAccent = hasVariants
    ? selected?.swatch ?? baseAccent
    : baseAccent;
  const selectedName = hasVariants ? selected?.name : undefined;
  const mainPhoto = images?.[0];

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onSelectVariant) return;
    const inStock = variants.filter((v) => v.inStock);
    if (inStock.length === 0) return;
    const currentIdx = inStock.findIndex((v) => v.id === selectedVariantId);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (currentIdx + 1) % inStock.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (currentIdx - 1 + inStock.length) % inStock.length;
    }
    if (next !== null) {
      e.preventDefault();
      onSelectVariant(inStock[next].id);
    }
  }

  const mainAlt = selectedName
    ? `${productName} — ${selectedName} variant`
    : `${productName}`;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Main visual */}
      <div
        className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card"
        style={{ ["--accent" as string]: activeAccent }}
      >
        {mainPhoto ? (
          <Image
            src={mainPhoto}
            alt={productName}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <ProductVisual
            visualKey={visualKey}
            accent={activeAccent}
            editorial
            className="h-full w-full"
          />
        )}
        {/* sr-only image alt for crawlers / AT */}
        <p className="sr-only" role="img" aria-label={mainAlt}>
          {mainAlt}
        </p>
      </div>

      {/* Thumbnail variants (used as "angle" swatches) */}
      {hasVariants && (
        <div
          className="flex flex-wrap gap-3"
          role="radiogroup"
          aria-label={`${productName} variants`}
          onKeyDown={onKeyDown}
        >
          {variants.map((v) => {
            const isSelected = v.id === selected?.id;
            const swatch = v.swatch ?? baseAccent;
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${v.name} variant${v.inStock ? "" : " — out of stock"}`}
                disabled={!v.inStock}
                onClick={() => v.inStock && onSelectVariant?.(v.id)}
                className={cn(
                  "press relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-lg border-2 bg-card",
                  isSelected
                    ? "border-copper ring-1 ring-copper/30"
                    : "border-border hover:border-copper/40",
                  !v.inStock && "cursor-not-allowed opacity-60 hover:border-border"
                )}
              >
                <ProductVisual
                  visualKey={visualKey}
                  accent={swatch}
                  className="h-full w-full"
                />
                {!v.inStock && (
                  <span
                    className="absolute inset-0 grid place-items-center bg-background/55 text-[9px] font-medium uppercase tracking-wide text-foreground backdrop-blur-[1px]"
                    aria-hidden="true"
                  >
                    Sold out
                  </span>
                )}
                <span className="sr-only">{v.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
