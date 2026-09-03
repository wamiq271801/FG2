import { cn } from "@/lib/utils";
import type { Availability } from "@/types";

type Props = {
  /**
   * Undefined when no live stock value is available (cached data before
   * the overlay / a failed refresh) — the badge renders nothing rather
   * than guessing an availability state.
   */
  availability?: Availability;
  stock?: number;
  className?: string;
};

const map: Record<Availability, { label: string; dot: string; text: string }> = {
  "in-stock": {
    label: "In stock",
    dot: "bg-emerald-500",
    text: "text-emerald-700 dark:text-emerald-400",
  },
  "low-stock": {
    label: "Low stock",
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  "out-of-stock": {
    label: "Out of stock",
    dot: "bg-rose-500",
    text: "text-rose-700 dark:text-rose-400",
  },
  preorder: {
    label: "Pre-order",
    dot: "bg-copper",
    text: "text-copper",
  },
};

export function AvailabilityBadge({ availability, stock, className }: Props) {
  if (!availability) return null;
  const m = map[availability];
  let label = m.label;
  if (availability === "low-stock" && stock) {
    label = `Only ${stock} left`;
  }
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", m.dot)} aria-hidden="true" />
      {label}
    </span>
  );
}
