"use client";

import { create } from "zustand";

/**
 * Navigation progress store.
 *
 * Two-state model: `pending` is true while a `<Link>` navigation is in
 * flight, false otherwise.
 *
 * - `start()`    — called by the `Link` wrapper when `useLinkStatus` reports
 *                  the link is pending.
 * - `complete()` — called both by the `Link` wrapper when `useLinkStatus`
 *                  reports the link is no longer pending, AND by
 *                  `NavigationProgress` when the route changes. Either path
 *                  is sufficient to clear `pending` and hide the indicator,
 *                  so completion is never missed.
 *
 * Both methods mutate state (unlike the previous "only set true" design which
 * left `pending` stuck on after the first navigation).
 */
type NavProgressState = {
  pending: boolean;
  start: () => void;
  complete: () => void;
};

export const useNavProgress = create<NavProgressState>((set) => ({
  pending: false,
  start: () => set({ pending: true }),
  complete: () => set({ pending: false }),
}));
