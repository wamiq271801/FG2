"use client";

import NextLink from "next/link";
import type { ComponentProps, MouseEvent } from "react";
import { useNavProgress } from "@/hooks/use-nav-progress";

type LinkProps = ComponentProps<typeof NextLink>;
type LinkHref = LinkProps["href"];

/**
 * Normalizes an href to its route identity — "pathname?search", hash
 * excluded. Returns null for external URLs (they never dispatch an App
 * Router navigation).
 */
function routeKeyOf(href: LinkHref): string | null {
  if (typeof window === "undefined") return null;
  let raw: string;
  if (typeof href === "string") {
    raw = href;
  } else if (href && typeof (href as { toString?: unknown }).toString === "function") {
    // UrlObject — its toString renders pathname+search+hash (query/formatUrl).
    raw = String(href);
  } else {
    return null;
  }
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.href);
    if (url.origin !== window.location.origin) return null;
    return url.pathname + url.search;
  } catch {
    return null;
  }
}

/**
 * Mirrors next/link's own click-bail conditions (linkClicked): modified
 * clicks, download links, non-local URLs, and a user handler that already
 * called preventDefault are all left to the browser — no router navigation
 * will be dispatched, so the loader must not start. Hash-only differences
 * on the same page (e.g. `#section`) are in-page scrolls, not navigations.
 */
function isRouterNavigation(
  e: MouseEvent<HTMLAnchorElement>,
  href: LinkHref
): boolean {
  const anchor = e.currentTarget;
  if (e.defaultPrevented) return false;
  if (anchor.hasAttribute("download")) return false;
  const target = anchor.getAttribute("target");
  if (target && target !== "_self") return false;
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return false;
  if (e.nativeEvent && (e.nativeEvent as MouseEvent).which === 2) return false;
  const key = routeKeyOf(href);
  if (key === null) return false;
  // Same route (ignoring hash) → in-page scroll / no-op navigation.
  if (
    key ===
    window.location.pathname + window.location.search
  )
    return false;
  return true;
}

/**
 * Drop-in replacement for `next/link` that observes navigation for the
 * global `NavigationProgress` indicator. Same API as `next/link` — pass
 * through `href`, `className`, children, etc.
 *
 * The loader only OBSERVES navigation: this onClick runs, signals the
 * store, and returns without preventing or delaying anything — next/link
 * then dispatches the navigation exactly as it would without us. Instant
 * (cache-hit) navigations are observed just like slow ones.
 *
 * Server Components can import and render this without becoming client
 * components themselves; only this file is `"use client"`.
 */
export function Link({ onClick, href, ...props }: LinkProps) {
  const start = useNavProgress((s) => s.start);
  return (
    <NextLink
      {...props}
      href={href}
      onClick={(e) => {
        // User handler first — next/link's own order. If it prevented the
        // default, next/link will not navigate, and neither do we.
        onClick?.(e);
        if (isRouterNavigation(e, href)) start();
      }}
    />
  );
}
