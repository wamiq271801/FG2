/**
 * Static-pages child sitemap — /sitemap-static.xml
 *
 * Contains only the audited set of public, canonical, indexable static
 * routes (lib/sitemap/static.ts). No lastModified is emitted because the
 * project has no truthful per-page content-modification source; no
 * priority/changefreq (ignored by search engines).
 */

import { renderUrlset, staticSitemapEntries } from "@/lib/sitemap";

// Static literal required by Next.js: segment config exports are statically
// analyzed at build time and must not reference imported constants. Keep in
// sync with SITEMAP_REVALIDATE_SECONDS (lib/sitemap/config.ts).
export const revalidate = 3600;

export async function GET() {
  return new Response(renderUrlset(staticSitemapEntries()), {
    headers: { "Content-Type": "application/xml" },
  });
}
