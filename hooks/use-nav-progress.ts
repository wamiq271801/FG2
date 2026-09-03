"use client";

import { create } from "zustand";

/**
 * Navigation progress store — the single global source of truth for the
 * navigation loader lifecycle.
 *
 * ONE navigation = ONE lifecycle:
 *
 *   START  — `Link`'s onClick observer sees a real router navigation begin
 *            (a user click that next/link will dispatch) → `start()`.
 *   COMMIT — the router committed a new URL (pathname or search params
 *            changed) → `end()`.
 *
 * Between START and COMMIT the loader stays active — no intermediate signal
 * can complete it, and nothing needs to: overlapping starts collapse into
 * the same `active` flag (a superseded navigation is replaced by its
 * successor, whose commit ends the cycle), and every started navigation
 * ends in a commit, a superseding commit, or a full page unload (Next's
 * hard-navigation fallback on fetch failure).
 *
 * There is intentionally NO reference counting, NO per-link pending
 * mirroring, and NO timer: a boolean with exactly two transitions.
 */
type NavProgressState = {
  /** True between a navigation start and its commit. */
  active: boolean;
  /** A real link navigation is starting. */
  start: () => void;
  /** A navigation committed (the URL changed). */
  end: () => void;
};

export const useNavProgress = create<NavProgressState>((set) => ({
  active: false,
  start: () => set((s) => (s.active ? s : { active: true })),
  end: () => set((s) => (s.active ? { active: false } : s)),
}));
