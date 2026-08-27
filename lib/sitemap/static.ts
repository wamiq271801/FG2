/**
 * Static sitemap URL definitions — the audited set of public, canonical,
 * indexable static pages.
 *
 * Audit (route inventory + metadata):
 *   ✓ every path below exists under app/(static)/ and renders publicly
 *   ✓ root layout sets robots index/follow; none of these pages override
 *     to noindex
 *   ✓ each is canonical (no user/state-specific variants)
 *
 * Excluded by audit:
 *   /search            — robots noindex (index: false) despite being public
 *   /cart /checkout /wishlist /account /account/onboarding /addresses
 *   /orders /auth/* /checkout/success /api/* — private, user-specific,
 *     state-specific or non-page routes
 *   /product/[slug] /products/[slug]/reviews* /categories/[slug] — dynamic
 *     catalog URLs owned by the product/category child sitemaps (review
 *     creation/editing routes are additionally non-indexable flows)
 *
 * No lastModified is emitted: the project has no truthful per-page
 * content-modification source, and fabricated dates would be worse than
 * none.
 */

import { absoluteUrl, SITE_ORIGIN } from "@/lib/site";
import type { SitemapUrlEntry } from "./xml";

export const STATIC_SITEMAP_PATHS = [
  "/",
  "/shop",
  "/categories",
  "/offers",
  "/about",
  "/contact",
  "/shipping",
  "/returns",
  "/privacy",
  "/terms",
] as const;

/**
 * Sitemap URL entries for the static pages.
 *
 * The root path is emitted origin-bare ("https://fusiongadgets.shop") to
 * exactly match the canonical URL the homepage itself declares; every
 * other path resolves through the central absoluteUrl().
 */
export function staticSitemapEntries(): SitemapUrlEntry[] {
  return STATIC_SITEMAP_PATHS.map((path) => ({
    url: path === "/" ? SITE_ORIGIN : absoluteUrl(path),
  }));
}
