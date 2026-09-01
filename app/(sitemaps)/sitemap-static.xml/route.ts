/**
 * Static-pages child sitemap — /sitemap-static.xml
 *
 * Contains only the audited set of public, canonical, indexable static
 * routes (lib/sitemap/static.ts). No lastModified is emitted because the
 * project has no truthful per-page content-modification source; no
 * priority/changefreq (ignored by search engines).
 */

import { renderUrlset, staticSitemapEntries } from "@/lib/sitemap";

// Cache Components: this handler renders only compile-time-constant data —
// it prerenders statically without any cached helper (the previous
// `export const revalidate = 3600` segment config is obsolete).

export async function GET() {
  return new Response(renderUrlset(staticSitemapEntries()), {
    headers: { "Content-Type": "application/xml" },
  });
}
