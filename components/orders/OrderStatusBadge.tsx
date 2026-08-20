import { cn } from "@/lib/utils";
import type { OrderStatus } from "@/types";

type Style = {
  label: string;
  dot: string;
  badge: string;
};

const map: Record<OrderStatus, Style> = {
  processing: {
    label: "Processing",
    dot: "bg-copper",
    badge:
      "border-copper/25 bg-copper/10 text-copper",
  },
  confirmed: {
    label: "Confirmed",
    dot: "bg-foreground/60",
    badge:
      "border-border bg-muted text-foreground/80",
  },
  shipped: {
    label: "Shipped",
    dot: "bg-copper",
    badge:
      "border-copper/30 bg-copper/15 text-copper",
  },
  "out-for-delivery": {
    label: "Out for delivery",
    dot: "bg-amber-500",
    badge:
      "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-400",
  },
  delivered: {
    label: "Delivered",
    dot: "bg-emerald-500",
    badge:
      "border-emerald-500/30 bg-emerald-500/12 text-emerald-700 dark:text-emerald-400",
  },
  cancelled: {
    label: "Cancelled",
    dot: "bg-rose-500",
    badge:
      "border-rose-500/30 bg-rose-500/12 text-rose-700 dark:text-rose-400",
  },
  returned: {
    label: "Returned",
    dot: "bg-amber-500",
    badge:
      "border-amber-500/30 bg-amber-500/12 text-amber-700 dark:text-amber-400",
  },
};

type Props = {
  status: OrderStatus;
  className?: string;
  size?: "sm" | "md";
};

/**
 * OrderStatusBadge — server-rendered pill with a status dot. Uses only warm
 * paper/ink + copper, emerald, amber, rose accents (no indigo/blue). Includes
 * an aria-label so screen readers announce "Order status: Delivered".
 */
export function OrderStatusBadge({ status, className, size = "md" }: Props) {
  const s = map[status];
  const sizeClass =
    size === "sm"
      ? "px-2 py-0.5 text-[11px] gap-1.5"
      : "px-2.5 py-1 text-xs gap-1.5";
  return (
    <span
      role="status"
      aria-label={`Order status: ${s.label}`}
      className={cn(
        "inline-flex items-center rounded-full border font-medium",
        s.badge,
        sizeClass,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} aria-hidden="true" />
      {s.label}
    </span>
  );
}

export function orderStatusLabel(status: OrderStatus): string {
  return map[status].label;
}
