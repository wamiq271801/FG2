/**
 * Minimal, focused server-side XML rendering for the sitemap system.
 *
 * Implements the two document types of the sitemap protocol
 * (https://www.sitemaps.org/protocol.html):
 *   <sitemapindex> — root index referencing child sitemaps
 *   <urlset>       — URL lists (optionally with image sitemap entries,
 *                    https://developers.google.com/search/docs/crawling-indexing/sitemaps/image-sitemaps)
 *
 * Every value inserted into markup passes through escapeXml(); no naive
 * string interpolation of unescaped data.
 */

export type SitemapUrlEntry = {
  /** Absolute canonical URL of the page. */
  url: string;
  /** W3C Datetime (xsd:dateTime) of the last significant change; omit
   * when no truthful timestamp exists. */
  lastModified?: string;
  /** At most ONE primary image (absolute URL); omit when none exists. */
  image?: string;
};

const SITEMAP_NS = "http://www.sitemaps.org/schemas/sitemap/0.9";
const IMAGE_NS = "http://www.google.com/schemas/sitemap-image/1.1";

const XML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&apos;",
};

/** Escape a value for safe insertion into XML text nodes. */
export function escapeXml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => XML_ESCAPES[ch]);
}

/** Render a <sitemapindex> document listing child sitemap locations. */
export function renderSitemapIndex(locations: string[]): string {
  const children = locations
    .map(
      (loc) =>
        `  <sitemap>\n    <loc>${escapeXml(loc)}</loc>\n  </sitemap>`
    )
    .join("\n");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="${SITEMAP_NS}">\n${children}\n</sitemapindex>\n`
  );
}

/** Render a <urlset> document; the image namespace is declared only when
 * at least one entry carries image data. */
export function renderUrlset(entries: SitemapUrlEntry[]): string {
  const hasImages = entries.some((entry) => entry.image);
  const items = entries
    .map((entry) => {
      let item = `  <url>\n    <loc>${escapeXml(entry.url)}</loc>`;
      if (entry.lastModified) {
        item += `\n    <lastmod>${escapeXml(entry.lastModified)}</lastmod>`;
      }
      if (entry.image) {
        item +=
          `\n    <image:image>\n      <image:loc>${escapeXml(entry.image)}</image:loc>\n    </image:image>`;
      }
      return `${item}\n  </url>`;
    })
    .join("\n");

  const imageNs = hasImages ? ` xmlns:image="${IMAGE_NS}"` : "";
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="${SITEMAP_NS}"${imageNs}>\n${items}\n</urlset>\n`
  );
}

/**
 * Normalize a Postgres timestamptz string to W3C Datetime second
 * precision ("2026-08-26T16:42:44.502003+00:00" →
 * "2026-08-26T16:42:44+00:00"). The source value is authoritative — this
 * only drops sub-second precision that crawlers do not consume.
 */
export function toW3cDatetime(isoTimestamp: string): string {
  return isoTimestamp.replace(/\.\d+/, "");
}
