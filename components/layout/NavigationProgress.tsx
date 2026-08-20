"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useNavProgress } from "@/hooks/use-nav-progress";

/**
 * Delay (ms) before showing the indicator. If navigation completes within
 * this window, the timer is cancelled and the bar is never shown — so fast
 * navigations produce no visible flash. Tuned to ~120ms: long enough to hide
 * the bar on fast navigations, short enough to feel responsive on slow ones.
 *
 * IMPORTANT: this measures ONLY client navigation pending state
 * (`useLinkStatus`). It does NOT detect server rendering, ISR, cache state, or
 * dynamic data fetching — those are intentionally not tracked here. Dynamic
 * data loading belongs to local component state, not this indicator.
 */
const SHOW_DELAY = 120;

/**
 * NavigationProgress — a globally integrated, indeterminate navigation
 * progress indicator.
 *
 * Two visual states: HIDDEN and VISIBLE.
 *
 * - Navigation starts → `pending` becomes true → a `SHOW_DELAY` timer starts.
 *   If navigation finishes before the timer fires, the timer is cancelled and
 *   the indicator is never shown.
 * - If the timer fires, the indicator becomes VISIBLE.
 * - Navigation completes (pathname changes, or `useLinkStatus` reports no
 *   longer pending) → `pending` becomes false → the timer is cancelled and the
 *   indicator is hidden immediately.
 *
 * Completion is detected via two independent paths, either of which is
 * sufficient: the `Link` reporter calling `complete()`, and this component
 * watching `usePathname()`. This guarantees the indicator can never remain
 * stuck on screen.
 *
 * The indicator is decorative — `aria-hidden`, no focus, no interaction.
 * Reduced-motion is respected via the CSS `@media (prefers-reduced-motion)`
 * rule that disables the comet animation.
 */
export function NavigationProgress() {
  const pending = useNavProgress((s) => s.pending);
  const complete = useNavProgress((s) => s.complete);
  const pathname = usePathname();

  const [visible, setVisible] = useState(false);

  // When `pending` is true, wait SHOW_DELAY before showing the bar.
  // Cleanup cancels the timer if `pending` returns to false before it fires
  // (i.e. navigation was fast) — so the bar is never shown for fast navs.
  useEffect(() => {
    if (!pending) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setVisible(false);
      return;
    }
    const t = setTimeout(() => setVisible(true), SHOW_DELAY);
    return () => clearTimeout(t);
  }, [pending]);

  // Route changed → navigation completed. Clear `pending` as a safety net
  // (the Link reporter also clears it, but this guarantees completion is
  // never missed even if the reporter unmounts first).
  useEffect(() => {
    complete();
  }, [pathname, complete]);

  if (!visible) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px] overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="h-full w-1/3 animate-nav-progress"
        style={{
          background:
            "linear-gradient(90deg, transparent, var(--copper), transparent)",
        }}
      />
    </div>
  );
}
