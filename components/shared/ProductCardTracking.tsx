"use client";

import { useEffect, useRef } from "react";
import { trackProductClick, trackProductImpression } from "@/services/tracking";

/**
 * ProductCard tracking island — fires the two card-level product events,
 * both carrying the product UUID:
 *
 *   product_impression — on mount: the card became visible to the user.
 *                        This is the exposure signal the ProcessingServer's
 *                        "Explore more" discovery selection consumes.
 *   product_click      — on a click that activates one of the card's product
 *                        links (the image or title link to the product page).
 *
 * Renders nothing (zero visual output — same pattern as ProductViewTracker).
 * Listens in the capture phase on the surrounding <article> so clicks are
 * observed even if a handler stops propagation; the wishlist heart is a
 * <button>, so it never produces a product_click.
 */
export function ProductCardTracking({
  productId,
  surface,
}: {
  productId: string;
  surface: string;
}) {
  const anchor = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    trackProductImpression(productId, surface);

    const card = anchor.current?.closest("article");
    if (!card) return;

    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (target?.closest?.("a")) {
        trackProductClick(productId, surface);
      }
    };
    card.addEventListener("click", onClick, true);
    return () => card.removeEventListener("click", onClick, true);
  }, [productId, surface]);

  return <span ref={anchor} className="hidden" aria-hidden="true" />;
}
