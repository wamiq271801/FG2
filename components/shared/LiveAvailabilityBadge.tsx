"use client";

import { useStock } from "@/modules/catalog/use-stock";
import { AvailabilityBadge } from "@/components/shared/AvailabilityBadge";
import type { Availability } from "@/types";

type Props = {
  productId: string;
  /** Variation sibling ids — fetched in the same single batched request. */
  siblingIds?: string[];
  /** Server-rendered live values (from getStocks at request time). */
  initialAvailability?: Availability;
  initialStock?: number;
  className?: string;
};

/**
 * The PDP availability badge as a small client boundary: it renders the
 * server-provided live values first (identical SSR/hydration output), then
 * — after the one hydration-time stock refresh — re-renders ONLY the badge
 * if the live values changed. Every other product field stays server-owned.
 */
export function LiveAvailabilityBadge({
  productId,
  siblingIds = [],
  initialAvailability,
  initialStock,
  className,
}: Props) {
  const stocks = useStock([productId, ...siblingIds]);
  const info = stocks[productId];
  const availability = info?.availability ?? initialAvailability;
  const stock = info?.stock ?? initialStock;

  return (
    <AvailabilityBadge
      availability={availability}
      stock={stock}
      className={className}
    />
  );
}
