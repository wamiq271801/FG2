/**
 * JSON-LD primitives — ONE safe serializer and graph composer.
 *
 * This module is intentionally free of data fetching: it only shapes and
 * serializes objects that pages have already loaded.
 */

/** A loose schema.org node. Values must already be JSON-safe. */
export type JsonLdObject = Record<string, unknown>;

/** A complete `@graph` document ready for `<script type="application/ld+json">`. */
export type JsonLdGraph = {
  "@context": "https://schema.org";
  "@graph": JsonLdObject[];
};

/**
 * Compose one page graph from entity objects. Falsy entities (e.g. an
 * ItemList skipped for an empty collection) are dropped so callers can
 * build conditionally without leaking `undefined` into the graph.
 */
export function buildJsonLdGraph(
  ...entities: Array<JsonLdObject | undefined | null>
): JsonLdGraph {
  return {
    "@context": "https://schema.org",
    "@graph": entities.filter((e): e is JsonLdObject => Boolean(e)),
  };
}

/**
 * Safely serialize structured data for embedding inside
 * `<script type="application/ld+json">`.
 *
 * Follows the current Next.js JSON-LD guidance: escape `<` so user-derived
 * content (review bodies, product descriptions) can never terminate the
 * script element. Do NOT use raw JSON.stringify in pages.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
