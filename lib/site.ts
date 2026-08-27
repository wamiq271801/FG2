/**
 * Canonical site origin — the single source of truth for absolute URLs and
 * stable schema.org entity IDs.
 *
 * The origin is environment-backed (NEXT_PUBLIC_SITE_URL, documented in
 * .env.example). No other module may hard-code the site domain.
 */

export const SITE_ORIGIN = (
  process.env.NEXT_PUBLIC_SITE_URL ?? "https://fusiongadgets.shop"
).replace(/\/+$/, "");

/**
 * Resolve a URL or site-relative path to an absolute URL.
 * Absolute URLs (e.g. product images served from the image CDN) pass
 * through unchanged; site-relative paths are joined to the origin.
 */
export function absoluteUrl(urlOrPath: string): string {
  if (/^https?:\/\//i.test(urlOrPath)) return urlOrPath;
  return `${SITE_ORIGIN}${urlOrPath.startsWith("/") ? "" : "/"}${urlOrPath}`;
}
