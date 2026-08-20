"use client";

import NextLink from "next/link";
import { useLinkStatus } from "next/link";
import { useEffect } from "react";
import type { ComponentProps } from "react";
import { useNavProgress } from "@/hooks/use-nav-progress";

/**
 * LinkStatusReporter — renders null. Mirrors `useLinkStatus()` into the
 * global nav-progress store: `start()` when the enclosing link is pending,
 * `complete()` when it is not.
 *
 * Only one navigation can be in flight at a time (clicking a link navigates
 * away), so there is no "OR problem" between multiple links — it is safe for
 * each reporter to clear `pending` when its own link stops being pending.
 */
function LinkStatusReporter() {
  const { pending } = useLinkStatus();
  const start = useNavProgress((s) => s.start);
  const complete = useNavProgress((s) => s.complete);
  useEffect(() => {
    if (pending) start();
    else complete();
  }, [pending, start, complete]);
  return null;
}

/**
 * Drop-in replacement for `next/link` that reports navigation-pending state
 * to the global `NavigationProgress` indicator. Same API as `next/link` —
 * pass through `href`, `className`, `asChild`, children, etc.
 *
 * Server Components can import and render this without becoming client
 * components themselves; only this file is `"use client"`.
 */
export function Link({ children, ...props }: ComponentProps<typeof NextLink>) {
  return (
    <NextLink {...props}>
      {children}
      <LinkStatusReporter />
    </NextLink>
  );
}
