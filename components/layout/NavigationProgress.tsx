"use client";

import { Suspense, useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useNavProgress } from "@/hooks/use-nav-progress";

/**
 * NavigationProgress — a globally integrated, indeterminate navigation
 * activity indicator.
 *
 * ONE NAVIGATION = ONE LOADER = ONE ELEMENT.
 *
 *   NAVIGATION START   — a real link navigation begins (the `Link` onClick
 *   → loader appears     observer called `start()`): the comet appears
 *                        immediately. There is no threshold, no delayed
 *                        reveal, and no suppression for fast navigations —
 *                        even a cache-hit navigation shows the same loader.
 *
 *   NAVIGATION PENDING — the comet keeps running its existing animation
 *   → loader active     for the ENTIRE pending period. Nothing can end the
 *                        cycle early — no timeout, no threshold, no
 *                        intermediate signal.
 *
 *   NAVIGATION COMMIT  — the router committed a new URL (pathname or
 *   → loader hides      search params changed): the SAME loader element
 *                        hides. Completion is the commit itself: the loader
 *                        never morphs into a full-width bar, is never
 *                        replaced by a second element, and is never
 *                        remounted — the single comet element simply
 *                        unmounts. No timer can decide this.
 *
 * The loader only OBSERVES navigation — it renders in parallel with the
 * router's own transition work and never blocks or delays it. Next.js owns
 * the navigation entirely.
 *
 * This is NOT a determinate progress bar: the pending phase shows the
 * indeterminate comet (no percentage stages), and there is no fill-to-100%
 * completion state — completion is just "hide".
 *
 * The indicator is decorative — `aria-hidden`, no focus, no interaction.
 */
function CommitWatcher() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const end = useNavProgress((s) => s.end);
  const route = pathname + (searchParams.size ? `?${searchParams}` : "");

  useEffect(() => {
    end();
  }, [route, end]);

  return null;
}

export function NavigationProgress() {
  const active = useNavProgress((s) => s.active);

  // The single visual loader: the comet track, mounted while a navigation
  // is pending and unmounted when it commits. One element for the whole
  // lifecycle — nothing is swapped in, recreated, or filled on completion.
  const cometGradient = {
    background:
      "linear-gradient(90deg, transparent, var(--copper), transparent)",
  };

  return (
    <>
      {/* The watcher stays mounted for the entire session: it mounts once
          at hydration with the initial route, so every subsequent effect
          run is a real committed route change — never a remount. */}
      <Suspense fallback={null}>
        <CommitWatcher />
      </Suspense>
      {active && (
        <div
          className="pointer-events-none fixed inset-x-0 top-0 z-[200] h-[2px] max-md:h-[2.4px] overflow-hidden"
          aria-hidden="true"
        >
          <div className="h-full w-1/3 animate-nav-progress" style={cometGradient} />
        </div>
      )}
    </>
  );
}
