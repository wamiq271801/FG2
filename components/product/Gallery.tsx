"use client";

import Image from "next/image";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { cn } from "@/lib/utils";
import type { Product, ProductVisualKey } from "@/types";

type Props = {
  product: Product;
  variationProducts: Product[];
  selectedProductId?: string;
  onSelectProduct?: (productId: string) => void;
  className?: string;
};

export function Gallery({
  product,
  variationProducts,
  selectedProductId,
  onSelectProduct,
  className,
}: Props) {
  const hasVariation = variationProducts.length > 1;
  const selected = hasVariation
    ? variationProducts.find((p) => p.id === selectedProductId) ?? product
    : product;
  const mainPhoto = selected.images?.[0];

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!onSelectProduct) return;
    const inStock = variationProducts.filter((p) => p.stock > 0 || p.isPreorder);
    if (inStock.length === 0) return;
    const currentIdx = inStock.findIndex((p) => p.id === selectedProductId);
    let next: number | null = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      next = (currentIdx + 1) % inStock.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      next = (currentIdx - 1 + inStock.length) % inStock.length;
    }
    if (next !== null) {
      e.preventDefault();
      onSelectProduct(inStock[next].id);
    }
  }

  const mainAlt = hasVariation
    ? `${product.name} — ${selected.name}`
    : product.name;

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card">
        {mainPhoto ? (
          <Image
            src={mainPhoto}
            alt={mainAlt}
            fill
            priority
            sizes="(max-width: 1024px) 100vw, 50vw"
            className="object-cover"
          />
        ) : (
          <ProductVisual
            visualKey={product.visualKey}
            accent={product.accent}
            editorial
            className="h-full w-full"
          />
        )}
        <p className="sr-only" role="img" aria-label={mainAlt}>
          {mainAlt}
        </p>
      </div>

      {hasVariation && (
        <div
          className="flex flex-wrap gap-3"
          role="radiogroup"
          aria-label={`${product.name} options`}
          onKeyDown={onKeyDown}
        >
          {variationProducts.map((vp) => {
            const isSelected = vp.id === selected?.id;
            const photo = vp.images?.[0];
            return (
              <button
                key={vp.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                aria-label={`${vp.name}${vp.stock > 0 || vp.isPreorder ? "" : " — out of stock"}`}
                disabled={vp.stock <= 0 && !vp.isPreorder}
                onClick={() =>
                  (vp.stock > 0 || vp.isPreorder) && onSelectProduct?.(vp.id)
                }
                className={cn(
                  "press relative h-[4.5rem] w-[4.5rem] overflow-hidden rounded-lg border-2 bg-card",
                  isSelected
                    ? "border-copper ring-1 ring-copper/30"
                    : "border-border hover:border-copper/40",
                  vp.stock <= 0 && !vp.isPreorder && "cursor-not-allowed opacity-60 hover:border-border"
                )}
              >
                {photo ? (
                  <Image
                    src={photo}
                    alt={vp.name}
                    fill
                    sizes="72px"
                    className="object-cover"
                  />
                ) : (
                  <ProductVisual
                    visualKey={vp.visualKey}
                    accent={vp.accent}
                    className="h-full w-full"
                  />
                )}
                {vp.stock <= 0 && !vp.isPreorder && (
                  <span
                    className="absolute inset-0 grid place-items-center bg-background/55 text-[9px] font-medium uppercase tracking-wide text-foreground backdrop-blur-[1px]"
                    aria-hidden="true"
                  >
                    Sold out
                  </span>
                )}
                <span className="sr-only">{vp.name}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
