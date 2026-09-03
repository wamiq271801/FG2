import { Link } from "@/components/shared/Link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { ProductVisual } from "@/components/shared/ProductVisual";
import { Price } from "@/components/shared/Price";
import { RatingStars } from "@/components/shared/RatingStars";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import { WishlistButton } from "@/components/product/WishlistButton";
import type { Product } from "@/types";

type Props = {
  product: Product;
  className?: string;
  /** Render a more compact card for carousels / dense grids */
  compact?: boolean;
  priority?: boolean;
};

/**
 * NEW badge business rule: a product is NEW for exactly 7 × 24 hours (168
 * hours) from its `addedAt` timestamp. At precisely 7 days it is no longer
 * NEW (strict `<`).
 *
 * This file renders from both server (cached page scopes — where the value
 * is computed at cache-fill time, the officially supported pattern for
 * current-time reads under Cache Components) and client trees (where it is
 * computed at the viewer's clock). Same rule, same UI, both contexts.
 */
export const NEW_BADGE_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

/** The exact 7-day NEW rule, injectable `now` for tests. */
export function isNewProduct(addedAt: string, now: number = Date.now()): boolean {
  return now - +new Date(addedAt) < NEW_BADGE_WINDOW_MS;
}

export function ProductCard({ product, className, compact, priority }: Props) {
  const brandName = product.brandName;
  const href = `/product/${product.slug}`;
  const isNew = isNewProduct(product.addedAt);
  const photo = product.images[0];

  return (
    <article
      className={cn(
        "group relative flex flex-col press",
        className
      )}
    >
      <Link
        href={href}
        className="block overflow-hidden rounded-xl border border-border/70 bg-card"
        aria-label={product.name}
      >
        <div className="relative aspect-square">
          {photo ? (
            <Image
              src={photo}
              alt={product.name}
              fill
              priority={priority}
              sizes="(max-width: 768px) 50vw, (max-width: 1280px) 33vw, 25vw"
              className="object-cover transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          ) : (
            <ProductVisual
              visualKey={product.visualKey}
              accent={product.accent}
              className="h-full w-full transition-transform duration-500 ease-out group-hover:scale-[1.03]"
            />
          )}
          {/* Derived badge states — from authoritative product/offer state.
              No product_badges table. Per implementation.md:
              Sale → compare_at_price > price | New → addedAt within 60 days
              Preorder → isPreorder | Out of stock → availability */}
          <div className="absolute left-3 top-3 flex flex-col items-start gap-1.5">
            {product.compareAt && product.compareAt > product.price && (
              <span className="rounded-full bg-copper/90 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-white backdrop-blur-sm">
                Sale
              </span>
            )}
            {product.isPreorder && (
              <span className="rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground backdrop-blur-sm">
                Pre-order
              </span>
            )}
            {/* Stock is undefined on cached data before the live overlay —
                an unknown stock never hides the NEW badge (optimistic, same
                as the pre-overlay availability display). */}
            {!product.isPreorder && (product.stock === undefined || product.stock > 0) && isNew && (
              <span className="rounded-full bg-background/85 px-2.5 py-1 text-[10px] font-medium uppercase tracking-wide text-foreground backdrop-blur-sm">
                New
              </span>
            )}
          </div>
          {/* Wishlist heart — top-right, overlays the image */}
          <div className="absolute right-2 top-2">
            <WishlistButton
              productId={product.id}
              slug={product.slug}
              name={product.name}
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full bg-background/85 backdrop-blur-sm hover:bg-background"
            />
          </div>
          {product.availability === "out-of-stock" && (
            <div className="absolute inset-0 grid place-items-center bg-background/55 backdrop-blur-[1px]">
              <span className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background">
                Sold out
              </span>
            </div>
          )}
        </div>
      </Link>

      <div className={cn("flex flex-1 flex-col gap-1.5 pt-3", compact && "pt-2.5")}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
            {brandName}
          </span>
          <RatingStars rating={product.rating} count={product.reviewCount} showCount={false} />
        </div>
        <h3 className="font-display text-[15px] leading-snug tracking-tight">
          <Link href={href} className="hover:text-copper">
            {product.name}
          </Link>
        </h3>
        {!compact && (
          <p className="line-clamp-1 text-xs text-muted-foreground">{product.tagline}</p>
        )}
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <Price price={product.price} compareAt={product.compareAt} size="sm" className="min-w-0" />
          <AvailabilityBadge
            availability={product.availability}
            stock={product.stock}
            className="shrink-0"
          />
        </div>
      </div>
    </article>
  );
}
