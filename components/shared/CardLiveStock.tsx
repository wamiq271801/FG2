"use client";

import { useStock } from "@/modules/catalog/use-stock";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import type { Availability } from "@/types";

/**
 * Card-level live-stock islands — the runtime boundary that keeps volatile
 * availability OUT of cached rendered pages.
 *
 * Cached public pages (home / offers / product) render product cards from
 * sans-stock cached data, so the server passes no initial values and the
 * card's availability UI appears after the ONE shared hydration-time stock
 * refresh (modules/catalog/use-stock.ts batches every consumer on the page
 * into a single GET /api/stock request).
 *
 * Per-request pages (shop / category / search) still overlay live stock
 * server-side and pass it as the initial values — the server-rendered
 * markup is identical to the previous always-server AvailabilityBadge.
 */

type BadgeProps = {
  productId: string;
  /** Server-rendered live value (per-request pages); undefined on cached pages. */
  initialAvailability?: Availability;
  initialStock?: number;
  className?: string;
};

/** The availability badge with a hydration-time refresh. */
export function CardStockBadge({
  productId,
  initialAvailability,
  initialStock,
  className,
}: BadgeProps) {
  const stocks = useStock([productId]);
  const info = stocks[productId];
  return (
    <AvailabilityBadge
      availability={info?.availability ?? initialAvailability}
      stock={info?.stock ?? initialStock}
      className={className}
    />
  );
}

type OverlayProps = {
  productId: string;
  /** Server-rendered live value (per-request pages); undefined on cached pages. */
  initialAvailability?: Availability;
};

/**
 * The "Sold out" overlay for a card's image area — rendered only when the
 * live (or server-overlaid) availability is out-of-stock. Renders nothing
 * while stock is unknown, exactly like the badge.
 */
export function CardSoldOutOverlay({
  productId,
  initialAvailability,
}: OverlayProps) {
  const stocks = useStock([productId]);
  const info = stocks[productId];
  const availability = info?.availability ?? initialAvailability;
  if (availability !== "out-of-stock") return null;
  return (
    <div className="absolute inset-0 grid place-items-center bg-background/55 backdrop-blur-[1px]">
      <span className="rounded-full bg-foreground px-3 py-1.5 text-xs font-medium text-background">
        Sold out
      </span>
    </div>
  );
}
