"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { formatDate } from "@/lib/format";
import type { Promotion } from "@/types";

type Props = {
  promo: Promotion;
  dark?: boolean;
};

/**
 * A promotion's remaining-time display as a small client island.
 *
 * The offers page is a cached rendered output; current-time reads must not
 * freeze into it. This component renders the server-side (cache-fill-time)
 * state first — identical markup to the previous always-server version —
 * then re-renders once with the viewer's clock after hydration, the same
 * current-time dual rule the ProductCard NEW badge uses. "Ends tomorrow" /
 * "Ended" therefore stay correct on a cached page.
 */
export function PromotionExpiry({ promo, dark = false }: Props) {
  // One post-hydration clock read: the initial render must match the
  // server-rendered (cache-fill-time) markup exactly for hydration; this
  // effect then re-renders once with the viewer's clock. Same intentional
  // pattern as SearchResults' post-hydration state update.
  const [clientNow, setClientNow] = useState<number | null>(null);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional one-shot post-hydration clock read
    setClientNow(Date.now());
  }, []);

  const now = clientNow ?? Date.now();

  if (!promo.endsAt) {
    return (
      <p
        className={
          dark
            ? "text-xs text-background/60"
            : "text-xs text-muted-foreground"
        }
      >
        <Clock
          className={`mr-1 inline h-3 w-3 ${dark ? "text-background/60" : "text-muted-foreground"}`}
          aria-hidden="true"
        />
        Ongoing promotion
      </p>
    );
  }
  const end = new Date(promo.endsAt);
  const expired = end.getTime() < now;
  const daysLeft = Math.max(
    0,
    Math.ceil((end.getTime() - now) / (1000 * 60 * 60 * 24))
  );

  if (expired) {
    return (
      <p className="text-xs text-rose-600 dark:text-rose-400">
        <Clock className="mr-1 inline h-3 w-3" aria-hidden="true" />
        Ended {formatDate(promo.endsAt)}
      </p>
    );
  }

  return (
    <p
      className={
        dark ? "text-xs text-background/70" : "text-xs text-muted-foreground"
      }
    >
      <Clock
        className={`mr-1 inline h-3 w-3 ${dark ? "text-copper" : "text-copper"}`}
        aria-hidden="true"
      />
      {daysLeft === 0
        ? "Ends today"
        : daysLeft === 1
          ? "Ends tomorrow"
          : `Ends ${formatDate(promo.endsAt)} · ${daysLeft} days left`}
    </p>
  );
}
